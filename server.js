import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const sessions = new Map();
const defaultContent = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'src', 'data', 'content.json'), 'utf8')
);

const port = process.env.PORT || 5173;
const sslCaPath = process.env.DB_SSL_CA_PATH || path.join(__dirname, 'ca-certificate (5).crt');

app.use(express.json({ limit: '8mb' }));

function getDbConfig() {
  const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'ADMIN_PASSWORD'];
  const missingEnv = requiredEnv.filter((key) => !process.env[key]);

  if (missingEnv.length) {
    throw new Error(`Missing required database environment variables: ${missingEnv.join(', ')}`);
  }

  const hasSslCa = fs.existsSync(sslCaPath);
  const ssl = process.env.DB_SSL_MODE === 'DISABLED'
    ? undefined
    : {
        ...(hasSslCa ? { ca: fs.readFileSync(sslCaPath, 'utf8') } : {}),
        rejectUnauthorized: hasSslCa,
      };

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 25060),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'defaultdb',
    ssl,
  };
}

async function getConnection() {
  return mysql.createConnection(getDbConfig());
}

async function initDatabase() {
  const db = await getConnection();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(191) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'admin',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_name VARCHAR(255),
      customer_email VARCHAR(255),
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      total DECIMAL(10, 2) NOT NULL DEFAULT 0,
      items_json JSON,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS site_content (
      id INT PRIMARY KEY,
      content_json JSON NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await db.execute(
    `
      INSERT INTO users (username, password, role)
      VALUES (?, ?, 'admin')
      ON DUPLICATE KEY UPDATE username = username
    `,
    [process.env.ADMIN_USERNAME || 'admin', process.env.ADMIN_PASSWORD]
  );

  await db.execute(
    `
      INSERT INTO site_content (id, content_json)
      VALUES (1, CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE id = id
    `,
    [JSON.stringify(defaultContent)]
  );

  await db.end();
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token || !sessions.has(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  const db = await getConnection();
  const [rows] = await db.execute(
    'SELECT id, username, role FROM users WHERE username = ? AND password = ? LIMIT 1',
    [username, password]
  );
  await db.end();

  if (!rows.length) {
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: rows[0].id, username: rows[0].username, role: rows[0].role });
  res.json({ token, user: rows[0] });
});

app.get('/api/content', async (_req, res) => {
  const db = await getConnection();
  const [rows] = await db.execute('SELECT content_json FROM site_content WHERE id = 1 LIMIT 1');
  await db.end();
  res.json(rows[0]?.content_json || defaultContent);
});

app.put('/api/content', requireAuth, async (req, res) => {
  const db = await getConnection();
  await db.execute(
    `
      INSERT INTO site_content (id, content_json)
      VALUES (1, CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE content_json = VALUES(content_json)
    `,
    [JSON.stringify(req.body)]
  );
  await db.end();
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'dist')));

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

initDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Zelis Shop listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database');
    console.error(error);
    process.exit(1);
  });
