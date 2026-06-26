import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const applyChanges = process.argv.includes('--apply');
const pageSize = 100;

const targetCategoryNames = {
  beauty: 'BEAUTY',
  baby: 'BABY',
  clothing: 'CLOTHING',
  groceries: 'GROCERIES',
};

const phraseRules = {
  baby: [
    'my baby',
    'baby powder',
    'baby oil',
    'baby bath',
    'baby cologne',
    'tooth spray',
    'nose hygiene baby',
    'babies blink',
    'johnson baby',
    'kodomo',
    'mommyhana',
    'mommy hana',
    'heinz farley',
    'milna biskut',
    'minyak telon',
    'yu yee oil',
    'kids',
    'kid',
    'abaya kids',
    'kids telekung',
  ],
  clothing: [
    'dress',
    'abaya',
    'khimar',
    'telekung',
    'clothing',
    'apparel',
    'shirt',
    'blouse',
    'trouser',
    'pants',
    'skirt',
    'jacket',
    'blazer',
    'coat',
    'trench',
    'knit',
    'cardigan',
    'wardrobe',
  ],
  beauty: [
    'skintific',
    'sobella',
    'faycy',
    'cubremi',
    'okaya',
    'rosel',
    'g2g',
    'omputeh',
    'tabita',
    'wawa',
    'maeez',
    'maaez',
    'bihan',
    'sea makeup',
    'betty cosmetics',
    '1minute miracle',
    'beauteshi',
    'demica',
    'pwl',
    'perfect skin',
    'mary beauty',
    'jabs spf',
    'lipmatte',
    'liptint',
    'lip tint',
    'lipstick',
    'lip oil',
    'lip serum',
    'lipgloss',
    'lip gloss',
    'mascara',
    'eyeliner',
    'eyebrow',
    'eyelash',
    'palette',
    'blush',
    'makeup',
    'cushion',
    'foundation',
    'concealer',
    'setting spray',
    'setting powder',
    'loose powder',
    'powder foundation',
    'serum',
    'sunscreen',
    'suncreen',
    'suncream',
    'spf',
    'cleanser',
    'cleansing',
    'toner',
    'moisturiser',
    'moisturizer',
    'moisture gel',
    'facial wash',
    'feminine wash',
    'body serum',
    'body lotion',
    'whitening lotion',
    'repairing lotion',
    'dark fading cream',
    'night cream',
    'daily cream',
    'hand body lotion',
    'hair serum',
    'hair oil',
    'shampoo',
    'conditioner',
    'face mist',
    'perfume',
    'fragrance',
    'soap',
    'balm',
    'creme',
    'cream',
    'wash exclusive',
    'love oil',
  ],
};

function loadEnvFile() {
  const envPath = path.join(rootDir, '.env');

  if (!fs.existsSync(envPath)) {
    return;
  }

  fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        return;
      }

      const equalsIndex = trimmed.indexOf('=');

      if (equalsIndex === -1) {
        return;
      }

      const key = trimmed.slice(0, equalsIndex).trim();
      let value = trimmed.slice(equalsIndex + 1).trim();

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
}

function getSquareBaseUrl() {
  const environment = (process.env.SQUARE_ENVIRONMENT || 'production').toLowerCase();

  if (process.env.SQUARE_BASE_URL) {
    return process.env.SQUARE_BASE_URL;
  }

  return environment === 'sandbox'
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasPhrase(text, phrase) {
  return ` ${text} `.includes(` ${normalize(phrase)} `);
}

function classifyItem(item) {
  const itemData = item.item_data || {};
  const text = normalize([
    itemData.name,
    itemData.description,
    itemData.description_html,
    itemData.abbreviation,
  ].filter(Boolean).join(' '));

  for (const key of ['baby', 'clothing', 'beauty']) {
    if (phraseRules[key].some((phrase) => hasPhrase(text, phrase))) {
      return key;
    }
  }

  if (/wash/.test(text) && !/(dish|laundry|detergent)/.test(text)) {
    return 'beauty';
  }

  return 'groceries';
}

function getCurrentCategory(item) {
  return item.item_data?.categories?.[0] || null;
}

function getCurrentCategoryId(item) {
  return getCurrentCategory(item)?.id || item.item_data?.category_id || '';
}

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function squareRequest(pathname, options = {}, attempt = 1) {
  if (!process.env.SQUARE_ACCESS_TOKEN) {
    throw new Error('Missing SQUARE_ACCESS_TOKEN in .env.');
  }

  const response = await fetch(new URL(pathname, getSquareBaseUrl()), {
    ...options,
    headers: {
      'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      'Square-Version': process.env.SQUARE_API_VERSION || '2026-05-20',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if ((response.status === 429 || response.status >= 500) && attempt <= 8) {
    await sleep(1200 * attempt);
    return squareRequest(pathname, options, attempt + 1);
  }

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Square ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : {};
}

async function listCatalog(types, includeDeleted = false) {
  const objects = [];
  let cursor = '';

  do {
    const params = new URLSearchParams({ types });

    if (cursor) {
      params.set('cursor', cursor);
    }

    const data = await squareRequest(`/v2/catalog/list?${params}`);
    objects.push(...(data.objects || []));
    cursor = data.cursor || '';
  } while (cursor);

  if (includeDeleted) {
    const data = await squareRequest('/v2/catalog/search', {
      method: 'POST',
      body: JSON.stringify({
        object_types: types.split(','),
        include_deleted_objects: true,
        limit: pageSize,
      }),
    });

    const byId = new Map(objects.map((object) => [object.id, object]));
    (data.objects || []).forEach((object) => byId.set(object.id, object));
    return [...byId.values()];
  }

  return objects;
}

async function createCategory(name) {
  const temporaryId = `#${name.toLowerCase()}-${crypto.randomUUID()}`;
  const body = {
    idempotency_key: crypto.randomUUID(),
    object: {
      type: 'CATEGORY',
      id: temporaryId,
      category_data: { name },
    },
  };
  const data = await squareRequest('/v2/catalog/object', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return data.catalog_object;
}

async function getOrCreateTargetCategories() {
  const categories = await listCatalog('CATEGORY', true);
  const activeByName = new Map(
    categories
      .filter((category) => category.type === 'CATEGORY' && !category.is_deleted)
      .map((category) => [normalize(category.category_data?.name), category])
  );
  const deletedByName = new Map(
    categories
      .filter((category) => category.type === 'CATEGORY' && category.is_deleted)
      .map((category) => [normalize(category.category_data?.name), category])
  );
  const targets = {};

  for (const [key, name] of Object.entries(targetCategoryNames)) {
    const normalizedName = normalize(name);
    const activeCategory = activeByName.get(normalizedName);

    if (activeCategory) {
      targets[key] = activeCategory;
      continue;
    }

    if (!applyChanges) {
      targets[key] = deletedByName.get(normalizedName) || null;
      continue;
    }

    targets[key] = await createCategory(name);
    console.log(`Created category ${name}: ${targets[key].id}`);
  }

  return targets;
}

function updateItemCategory(item, categoryId, ordinal) {
  const next = JSON.parse(JSON.stringify(item));
  next.item_data = {
    ...(next.item_data || {}),
    categories: [{ id: categoryId, ordinal }],
  };
  delete next.item_data.category_id;
  return next;
}

function nextOrdinal(usedSet) {
  let ordinal = 0;

  while (usedSet.has(ordinal)) {
    ordinal += 1;
  }

  usedSet.add(ordinal);
  return ordinal;
}

async function main() {
  loadEnvFile();

  const environment = (process.env.SQUARE_ENVIRONMENT || 'production').toLowerCase();
  console.log(`${applyChanges ? 'APPLY' : 'DRY RUN'} Square categorization`);
  console.log(`Environment: ${environment}`);
  console.log(`Location: ${process.env.SQUARE_LOCATION_ID || 'not set'}`);

  const targets = await getOrCreateTargetCategories();
  const missingTargets = Object.entries(targets)
    .filter(([, category]) => !category || category.is_deleted)
    .map(([key]) => targetCategoryNames[key]);

  if (missingTargets.length) {
    console.log(`Missing active categories: ${missingTargets.join(', ')}`);
    console.log('Run with --apply to recreate missing/deleted categories and assign products.');
    return;
  }

  const itemSummaries = (await listCatalog('ITEM'))
    .filter((item) => item.type === 'ITEM' && !item.is_deleted && !item.item_data?.is_archived);
  const targetIds = new Set(Object.values(targets).map((category) => category.id));
  const usedOrdinals = Object.fromEntries(Object.values(targets).map((category) => [category.id, new Set()]));
  const records = [];
  const counts = { beauty: 0, baby: 0, clothing: 0, groceries: 0 };

  let fetched = 0;

  for (const summary of itemSummaries) {
    const item = (await squareRequest(`/v2/catalog/object/${summary.id}`)).object;
    const key = classifyItem(item);
    const current = getCurrentCategory(item);

    counts[key] += 1;

    if (current?.id && targetIds.has(current.id) && Number.isInteger(current.ordinal)) {
      usedOrdinals[current.id].add(current.ordinal);
    }

    records.push({ item, key, destination: targets[key] });
    fetched += 1;

    if (fetched % 250 === 0 || fetched === itemSummaries.length) {
      console.log(`Fetched ${fetched}/${itemSummaries.length}`);
    }
  }

  const changes = records
    .filter((record) => getCurrentCategoryId(record.item) !== record.destination.id)
    .map((record) => ({
      ...record,
      ordinal: nextOrdinal(usedOrdinals[record.destination.id]),
    }));

  console.log(`Items: ${records.length}`);
  console.log(`Already correct: ${records.length - changes.length}`);
  console.log(`Will update: ${changes.length}`);
  console.log(`Target counts: ${JSON.stringify(counts)}`);

  changes.slice(0, 30).forEach((change) => {
    console.log(`CHANGE | ${change.item.item_data?.name || change.item.id} -> ${change.destination.category_data.name}`);
  });

  if (!applyChanges) {
    console.log('Dry run only. Run `node scripts/square-categorize-items.js --apply` to apply.');
    return;
  }

  let updated = 0;

  for (const change of changes) {
    const body = {
      idempotency_key: crypto
        .createHash('sha256')
        .update(`zelis-category-sync:${change.item.id}:${change.destination.id}:${change.ordinal}:${change.item.version}`)
        .digest('hex'),
      object: updateItemCategory(change.item, change.destination.id, change.ordinal),
    };

    await squareRequest('/v2/catalog/object', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    updated += 1;

    if (updated % 100 === 0 || updated === changes.length) {
      console.log(`Updated ${updated}/${changes.length}`);
    }
  }

  console.log(`Done. Updated ${updated}. Target counts: ${JSON.stringify(counts)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
