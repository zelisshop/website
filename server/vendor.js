import crypto from 'node:crypto';

export const vendorFoodSchema = `CREATE TABLE IF NOT EXISTS vendor_food (
  id INT AUTO_INCREMENT PRIMARY KEY,
  food_name VARCHAR(191) NOT NULL,
  vendor_name VARCHAR(191) NOT NULL,
  count INT UNSIGNED NOT NULL DEFAULT 0,
  updated_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY vendor_food (vendor_name, food_name)
)`;

export const vendorsSchema = `CREATE TABLE IF NOT EXISTS vendors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_name VARCHAR(191) NOT NULL UNIQUE
)`;

export async function initializeVendors(db) {
  const [tables] = await db.execute(
    'SELECT TABLE_NAME AS table_name FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?)',
    ['vendor', 'vendor_food']
  );
  const names = new Set(tables.map(table => table.table_name));
  if (names.has('vendor') && names.has('vendor_food')) {
    throw new Error('Both vendor and vendor_food tables exist. Resolve the duplicate tables before initializing food management.');
  }
  if (names.has('vendor')) await db.execute('RENAME TABLE vendor TO vendor_food');
  await db.execute(vendorFoodSchema);
  await db.execute(vendorsSchema);
  await db.execute(`CREATE TABLE IF NOT EXISTS vendor_edit_sessions (
    token_hash CHAR(64) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.execute('INSERT IGNORE INTO vendors (vendor_name) SELECT DISTINCT vendor_name FROM vendor_food');
}

export function registerVendorRoutes(app, getConnection, requireAuth) {
  const attempts = new Map();
  const sessionHash = token => crypto.createHash('sha256').update(token).digest('hex');
  function verifyCode(req, res, next) {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
    const key = req.ip;
    const attempt = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    if (attempt.count >= 10) return res.status(429).json({ error: 'Too many incorrect codes. Try again in 15 minutes.' });
    const supplied = typeof req.body?.code === 'string' ? req.body.code : '';
    const digest = (value) => crypto.createHash('sha256').update(value).digest();
    const valid = (process.env.ADMIN_CODE || '').split(',').map(v => v.trim()).filter(Boolean)
      .some(code => crypto.timingSafeEqual(digest(code), digest(supplied)));
    if (!valid) {
      attempt.count++;
      attempts.set(key, attempt);
      return res.status(401).json({ error: 'Incorrect admin code.' });
    }
    attempts.delete(key);
    return next();
  }
  async function authorize(req, res, next) {
    const token = req.headers['x-vendor-session'];
    if (token) {
      let db;
      try {
        db = await getConnection();
        const [rows] = await db.execute('SELECT token_hash FROM vendor_edit_sessions WHERE token_hash=?', [sessionHash(token)]);
        if (!rows.length) return res.status(401).json({ error: 'Edit mode has ended. Enter your PIN again.' });
      } catch { return res.status(503).json({ error: 'Unable to verify edit mode. Please try again.' }); }
      finally { if (db) await db.end(); }
      return next();
    }
    if (req.headers.authorization && requireAuth) return requireAuth(req, res, next);
    return verifyCode(req, res, next);
  }
  app.post('/api/vendor/edit-session', verifyCode, async (req, res) => {
    if (!/^[0-9]{4}$/.test(req.body.code)) return res.status(400).json({ error: 'Enter a four-digit PIN.' });
    let db;
    try {
      const token = crypto.randomBytes(32).toString('hex');
      db = await getConnection();
      await db.execute('INSERT INTO vendor_edit_sessions (token_hash) VALUES (?)', [sessionHash(token)]);
      res.set('Cache-Control', 'no-store').json({ token });
    } catch { res.status(503).json({ error: 'Unable to save edit mode. Please try again.' }); }
    finally { if (db) await db.end(); }
  });
  app.get('/api/vendor/edit-session', authorize, (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ ok: true });
  });
  app.post('/api/vendor/exit-edit-mode', async (req, res) => {
    let db;
    try {
      const token = req.headers['x-vendor-session'];
      if (token) {
        db = await getConnection();
        await db.execute('DELETE FROM vendor_edit_sessions WHERE token_hash=?', [sessionHash(token)]);
      }
      res.json({ ok: true });
    } catch { res.status(503).json({ error: 'Unable to exit edit mode. Please try again.' }); }
    finally { if (db) await db.end(); }
  });
  app.get(['/api/vendor', '/api/rte-food'], async (req, res) => {
    let db;
    try {
      db = await getConnection();
      const [items] = await db.execute(`SELECT id, food_name, vendor_name, count,
        UNIX_TIMESTAMP(updated_time) * 1000 AS updated_time FROM vendor_food
        ${req.path === '/api/rte-food' ? 'WHERE count > 0' : ''} ORDER BY vendor_name, food_name`);
      const [vendors] = req.path === '/api/vendor' ? await db.execute('SELECT id, vendor_name FROM vendors ORDER BY vendor_name') : [[]];
      res.set('Cache-Control', 'no-store').json({ vendors, items: items.map(item => ({ ...item, updated_time: new Date(Number(item.updated_time)).toISOString() })) });
    } catch { res.status(503).json({ error: 'Unable to load food availability. Please try again.' }); }
    finally { if (db) await db.end(); }
  });
  async function save(req, res) {
    const { food_name, vendor_name, count } = req.body || {};
    if (typeof food_name !== 'string' || !food_name.trim() || food_name.trim().length > 191 ||
        typeof vendor_name !== 'string' || !vendor_name.trim() || vendor_name.trim().length > 191 ||
        !Number.isInteger(count) || count < 0 || count > 4294967295) {
      return res.status(400).json({ error: 'Enter a food name, vendor name, and a non-negative whole-number count.' });
    }
    if (req.params.id && !/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid item ID.' });
    let db;
    try {
      db = await getConnection();
      await db.execute('INSERT IGNORE INTO vendors (vendor_name) VALUES (?)', [vendor_name.trim()]);
      if (req.params.id) {
        const [result] = await db.execute('UPDATE vendor_food SET food_name=?, vendor_name=?, count=?, updated_time=CURRENT_TIMESTAMP WHERE id=?', [food_name.trim(), vendor_name.trim(), count, req.params.id]);
        if (!result.affectedRows) return res.status(404).json({ error: 'Food item no longer exists.' });
      } else {
        await db.execute('INSERT INTO vendor_food (food_name, vendor_name, count) VALUES (?, ?, ?)', [food_name.trim(), vendor_name.trim(), count]);
      }
      res.json({ ok: true });
    } catch (error) { res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 503).json({ error: error.code === 'ER_DUP_ENTRY' ? 'This food already exists for that vendor. Update its existing entry.' : 'Unable to save food. Please try again.' }); }
    finally { if (db) await db.end(); }
  }
  async function saveVendor(req, res) {
    const name = req.body?.vendor_name;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 191) return res.status(400).json({ error: 'Enter a vendor name (up to 191 characters).' });
    if (req.params.id && !/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid vendor ID.' });
    let db;
    try {
      db = await getConnection();
      await db.beginTransaction();
      if (req.params.id) {
        const [rows] = await db.execute('SELECT vendor_name FROM vendors WHERE id=? FOR UPDATE', [req.params.id]);
        if (!rows.length) { await db.rollback(); return res.status(404).json({ error: 'Vendor no longer exists.' }); }
        await db.execute('UPDATE vendors SET vendor_name=? WHERE id=?', [name.trim(), req.params.id]);
        await db.execute('UPDATE vendor_food SET vendor_name=?, updated_time=CURRENT_TIMESTAMP WHERE vendor_name=?', [name.trim(), rows[0].vendor_name]);
      } else {
        await db.execute('INSERT INTO vendors (vendor_name) VALUES (?)', [name.trim()]);
      }
      await db.commit();
      res.json({ ok: true });
    } catch (error) {
      if (db) await db.rollback();
      res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 503).json({ error: error.code === 'ER_DUP_ENTRY' ? 'A vendor with this name already exists.' : 'Unable to save vendor. Please try again.' });
    } finally { if (db) await db.end(); }
  }
  async function deleteFood(req, res) {
    if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid food ID.' });
    let db;
    try {
      db = await getConnection();
      const [result] = await db.execute('DELETE FROM vendor_food WHERE id=?', [req.params.id]);
      if (!result.affectedRows) return res.status(404).json({ error: 'Food item no longer exists.' });
      res.json({ ok: true });
    } catch { res.status(503).json({ error: 'Unable to delete food. Please try again.' }); }
    finally { if (db) await db.end(); }
  }
  async function deleteVendor(req, res) {
    if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid vendor ID.' });
    let db;
    try {
      db = await getConnection();
      await db.beginTransaction();
      const [rows] = await db.execute('SELECT vendor_name FROM vendors WHERE id=? FOR UPDATE', [req.params.id]);
      if (!rows.length) { await db.rollback(); return res.status(404).json({ error: 'Vendor no longer exists.' }); }
      await db.execute('DELETE FROM vendor_food WHERE vendor_name=?', [rows[0].vendor_name]);
      await db.execute('DELETE FROM vendors WHERE id=?', [req.params.id]);
      await db.commit();
      res.json({ ok: true });
    } catch {
      if (db) await db.rollback();
      res.status(503).json({ error: 'Unable to delete vendor. Please try again.' });
    } finally { if (db) await db.end(); }
  }
  app.delete('/api/vendor/:id', authorize, deleteFood);
  app.delete('/api/vendors/:id', authorize, deleteVendor);
  app.post('/api/vendors', authorize, saveVendor);
  app.put('/api/vendors/:id', authorize, saveVendor);
  app.post('/api/vendor', authorize, save);
  app.put('/api/vendor/:id', authorize, save);
}
