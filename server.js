import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');

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

loadEnvFile();

const app = express();
const sessions = new Map();
const defaultContent = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'src', 'data', 'content.json'), 'utf8')
);

const port = process.env.PORT || 5173;
const sslCaPath = process.env.DB_SSL_CA_PATH || path.join(__dirname, 'ca-certificate (5).crt');
const squareApiVersion = process.env.SQUARE_API_VERSION || '2026-05-20';
const squareEnvironment = (process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase();
const squareBaseUrl = process.env.SQUARE_BASE_URL
  || (squareEnvironment === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com');

const catalogKeys = ['beauty', 'groceries', 'baby', 'clothing'];
const categoryAliases = {
  beauty: ['beauty', 'beauty collection', 'skincare', 'makeup', 'fragrance', 'wellness'],
  groceries: ['groceries', 'grocery', 'malaysian groceries', 'pantry', 'malaysian pantry', 'fresh produce', 'spices'],
  baby: ['baby', 'little essentials', 'nursery', 'newborn', 'kids'],
  clothing: ['clothing', 'capsule wardrobe', 'fashion', 'apparel', 'wardrobe'],
};
const categoryImageClasses = {
  beauty: ['catalogOil', 'catalogLipstick', 'catalogPalette', 'catalogCream', 'catalogMist', 'catalogPerfume'],
  groceries: ['groceryRice', 'groceryLaksa', 'grocerySantan', 'groceryLemongrass', 'groceryChili', 'groceryGula'],
  baby: ['babyCatalogMuslin', 'babyCatalogBlocks', 'babyCatalogWash', 'babyCatalogCashmere', 'babyCatalogMobile', 'babyCatalogBooties'],
  clothing: ['clothingSilkBlouse', 'clothingTrousers', 'clothingCashmere', 'clothingBlazer', 'clothingSlipDress', 'clothingTrench'],
};
const imageAvailabilityCache = new Map();

app.use(express.json({ limit: '20mb' }));

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

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function getBucketConfig() {
  const endpoint = process.env.BUCKET_ENDPOINT || 'https://zelis.syd1.digitaloceanspaces.com';
  const endpointUrl = new URL(endpoint);
  const hostParts = endpointUrl.hostname.split('.');
  const bucket = process.env.BUCKET_NAME || hostParts[0];
  const region = process.env.BUCKET_REGION || hostParts[1] || 'syd1';
  const accessKey = process.env.BUCKET_ACCESS_KEY;
  const secretKey = process.env.BUCKET_SECRET_KEY || process.env.BUCKET_SECRET_ACCESS_KEY;

  return {
    endpoint: endpointUrl.origin,
    host: endpointUrl.host,
    bucket,
    region,
    accessKey,
    secretKey,
    publicBaseUrl: process.env.BUCKET_PUBLIC_URL || endpointUrl.origin,
  };
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value).digest(encoding);
}

function sha256(value, encoding = 'hex') {
  return crypto.createHash('sha256').update(value).digest(encoding);
}

function getSpacesSigningKey(secretKey, dateStamp, region) {
  const dateKey = hmac(`AWS4${secretKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, 's3');
  return hmac(serviceKey, 'aws4_request');
}

function cleanUploadFileName(fileName) {
  const extension = path.extname(fileName || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
  const baseName = path.basename(fileName || 'image', extension)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'image';

  return `${baseName}-${Date.now()}${extension || '.jpg'}`;
}

async function uploadImageToBucket({ fileName, contentType, dataBase64 }) {
  const bucket = getBucketConfig();

  if (!bucket.accessKey || !bucket.secretKey) {
    throw new Error('Missing BUCKET_ACCESS_KEY or BUCKET_SECRET_KEY environment variable.');
  }

  if (!contentType?.startsWith('image/')) {
    throw new Error('Only image uploads are supported.');
  }

  const fileBuffer = Buffer.from(String(dataBase64 || ''), 'base64');

  if (!fileBuffer.length) {
    throw new Error('Uploaded image is empty.');
  }

  const objectKey = `website-content/${cleanUploadFileName(fileName)}`;
  const objectPath = `/${objectKey}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(fileBuffer);
  const canonicalHeaders = [
    `host:${bucket.host}`,
    'x-amz-acl:public-read',
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n');
  const signedHeaders = 'host;x-amz-acl;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'PUT',
    objectPath,
    '',
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${bucket.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n');
  const signingKey = getSpacesSigningKey(bucket.secretKey, dateStamp, bucket.region);
  const signature = hmac(signingKey, stringToSign, 'hex');
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${bucket.accessKey}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ');
  const response = await fetch(`${bucket.endpoint}${objectPath}`, {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      'x-amz-acl': 'public-read',
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    throw new Error(`Bucket upload failed (${response.status}): ${await response.text()}`);
  }

  return `${bucket.publicBaseUrl}/${objectKey}`;
}

function classifyCategory(categoryName) {
  const normalizedName = normalizeText(categoryName);

  return catalogKeys.find((key) => (
    categoryAliases[key].some((alias) => normalizedName.includes(alias))
  ));
}

function getItemCategoryIds(itemData = {}) {
  const categoryIds = new Set();

  if (itemData.category_id) {
    categoryIds.add(itemData.category_id);
  }

  if (Array.isArray(itemData.categories)) {
    itemData.categories.forEach((category) => {
      if (category?.id) {
        categoryIds.add(category.id);
      }
    });
  }

  return [...categoryIds];
}

function isAvailableAtSquareLocation(item) {
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!locationId) {
    return true;
  }

  if (item.present_at_all_locations) {
    return true;
  }

  return Array.isArray(item.present_at_location_ids) && item.present_at_location_ids.includes(locationId);
}

function formatSquareMoney(priceMoney) {
  if (!priceMoney || typeof priceMoney.amount !== 'number' || !priceMoney.currency) {
    return 'Price unavailable';
  }

  const amount = priceMoney.amount / 100;

  try {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: priceMoney.currency,
    }).format(amount);
  } catch {
    return `${priceMoney.currency} ${amount.toFixed(2)}`;
  }
}

function getVariation(itemData = {}) {
  const variations = Array.isArray(itemData.variations) ? itemData.variations : [];

  return variations.find((variation) => variation?.item_variation_data?.price_money)
    || variations[0]
    || null;
}

function getSquareItemImageUrl(itemData = {}, imagesById) {
  const imageIds = Array.isArray(itemData.image_ids) ? itemData.image_ids : [];
  const imageId = imageIds.find((id) => imagesById.has(id));

  return imageId ? imagesById.get(imageId)?.image_data?.url || '' : '';
}

function normalizeSquareItem(item, categoryKey, index, imagesById) {
  const itemData = item.item_data || {};
  const variation = getVariation(itemData);
  const variationData = variation?.item_variation_data || {};
  const description = itemData.description
    || (variationData.name && variationData.name !== 'Regular' ? variationData.name : '')
    || 'Freshly added to the Zelis Shop catalogue.';
  const imageClasses = categoryImageClasses[categoryKey];
  const imageUrl = getSquareItemImageUrl(itemData, imagesById);

  return {
    id: item.id,
    squareVariationId: variation?.id || '',
    name: itemData.name || 'Untitled product',
    description,
    price: formatSquareMoney(variationData.price_money),
    priceAmount: variationData.price_money?.amount || 0,
    currency: variationData.price_money?.currency || '',
    badge: index === 0 ? 'Featured' : '',
    imageClass: imageClasses[index % imageClasses.length],
    imageUrl,
    imageAvailable: Boolean(imageUrl),
  };
}

function normalizeSquareProductDetail(item, imagesById, relatedObjects = []) {
  const itemData = item.item_data || {};
  const variation = getVariation(itemData);
  const variationData = variation?.item_variation_data || {};
  const categoriesById = new Map(
    relatedObjects
      .filter((object) => object.type === 'CATEGORY')
      .map((category) => [category.id, category.category_data?.name])
  );
  const categoryNames = getItemCategoryIds(itemData)
    .map((categoryId) => categoriesById.get(categoryId))
    .filter(Boolean);
  const imageUrls = (itemData.image_ids || [])
    .map((imageId) => imagesById.get(imageId)?.image_data?.url)
    .filter(Boolean);
  const description = itemData.description_html || itemData.description || 'No description provided.';

  return {
    id: item.id,
    squareVariationId: variation?.id || '',
    name: itemData.name || 'Untitled product',
    description,
    plainDescription: itemData.description || '',
    price: formatSquareMoney(variationData.price_money),
    priceAmount: variationData.price_money?.amount || 0,
    currency: variationData.price_money?.currency || '',
    imageUrl: imageUrls[0] || '',
    imageUrls,
    categories: categoryNames,
    productType: itemData.product_type || '',
    isTaxable: Boolean(itemData.is_taxable),
    ecomAvailable: Boolean(itemData.ecom_available),
    ecomVisibility: itemData.ecom_visibility || '',
    skipModifierScreen: Boolean(itemData.skip_modifier_screen),
    abbreviation: itemData.abbreviation || '',
    labelColor: itemData.label_color || '',
    availableAtAllLocations: Boolean(item.present_at_all_locations),
    presentAtLocationIds: item.present_at_location_ids || [],
    updatedAt: item.updated_at || '',
    createdAt: item.created_at || '',
    variations: (itemData.variations || []).map((itemVariation) => {
      const data = itemVariation.item_variation_data || {};

      return {
        id: itemVariation.id,
        name: data.name || 'Regular',
        sku: data.sku || '',
        upc: data.upc || '',
        ordinal: data.ordinal || 0,
        pricingType: data.pricing_type || '',
        price: formatSquareMoney(data.price_money),
        priceAmount: data.price_money?.amount || 0,
        currency: data.price_money?.currency || '',
        sellable: Boolean(data.sellable),
        stockable: Boolean(data.stockable),
      };
    }),
  };
}

async function squareRequest(pathname, query = {}, options = {}) {
  if (!process.env.SQUARE_ACCESS_TOKEN) {
    return null;
  }

  const url = new URL(pathname, squareBaseUrl);
  Object.entries(query).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'Square-Version': squareApiVersion,
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Square request failed (${response.status}): ${body}`);
  }

  return response.json();
}

function getSquareLocationId() {
  if (!process.env.SQUARE_LOCATION_ID) {
    throw new Error('Missing SQUARE_LOCATION_ID environment variable.');
  }

  return process.env.SQUARE_LOCATION_ID;
}

async function listSquareCatalog(types) {
  const objects = [];
  let cursor;

  do {
    const data = await squareRequest('/v2/catalog/list', { types, cursor });

    if (!data) {
      return [];
    }

    objects.push(...(data.objects || []));
    cursor = data.cursor;
  } while (cursor);

  return objects;
}

async function getSquareCategoriesByName() {
  const categories = await listSquareCatalog('CATEGORY');

  return new Map(
    categories
      .filter((category) => category.type === 'CATEGORY' && !category.is_deleted)
      .map((category) => [normalizeText(category.category_data?.name), category])
  );
}

async function batchRetrieveCatalogObjects(objectIds) {
  const uniqueObjectIds = [...new Set(objectIds.filter(Boolean))];

  if (!uniqueObjectIds.length) {
    return [];
  }

  const data = await squareRequest('/v2/catalog/batch-retrieve', {}, {
    method: 'POST',
    body: {
      object_ids: uniqueObjectIds,
      include_related_objects: false,
    },
  });

  return data?.objects || [];
}

async function retrieveSquareCatalogObject(objectId, includeRelatedObjects = false) {
  const data = await squareRequest(`/v2/catalog/object/${encodeURIComponent(objectId)}`, {
    include_related_objects: includeRelatedObjects ? 'true' : '',
  });

  return data;
}

async function getSquareImagesById(items) {
  const imageIds = items.flatMap((item) => item.item_data?.image_ids || []);
  const images = await batchRetrieveCatalogObjects(imageIds);

  return new Map(images.map((image) => [image.id, image]));
}

function getSquareItemPriceAmount(item) {
  const variation = getVariation(item.item_data || {});
  return variation?.item_variation_data?.price_money?.amount || 0;
}

function squareItemMatchesSearch(item, searchTerm) {
  const normalizedSearch = normalizeText(searchTerm);

  if (!normalizedSearch) {
    return true;
  }

  const itemData = item.item_data || {};
  const variationNames = (itemData.variations || [])
    .map((variation) => variation?.item_variation_data?.name)
    .filter(Boolean)
    .join(' ');
  const searchableText = normalizeText([
    itemData.name,
    itemData.description,
    variationNames,
  ].filter(Boolean).join(' '));

  return searchableText.includes(normalizedSearch);
}

async function isImageUrlAvailable(imageUrl) {
  if (!imageUrl) {
    return false;
  }

  if (imageAvailabilityCache.has(imageUrl)) {
    return imageAvailabilityCache.get(imageUrl);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    let response = await fetch(imageUrl, {
      method: 'HEAD',
      signal: controller.signal,
    });

    if (response.status === 405 || response.status === 403) {
      response = await fetch(imageUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        signal: controller.signal,
      });
    }

    const contentType = response.headers.get('content-type') || '';
    const available = response.ok && (!contentType || contentType.startsWith('image/'));
    imageAvailabilityCache.set(imageUrl, available);
    return available;
  } catch {
    imageAvailabilityCache.set(imageUrl, false);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(limit, 1), items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }));

  return results;
}

async function markImageAvailability(products) {
  return mapWithConcurrency(products, 8, async (product) => {
    const imageAvailable = await isImageUrlAvailable(product.imageUrl);

    return {
      ...product,
      imageAvailable,
      imageUrl: imageAvailable ? product.imageUrl : '',
    };
  });
}

function sortNormalizedProducts(products, sortBy = 'image-name') {
  const sortedProducts = [...products];
  const byImage = (left, right) => (
    Number(Boolean(right.imageAvailable)) - Number(Boolean(left.imageAvailable))
  );
  const byName = (left, right) => normalizeText(left.name).localeCompare(normalizeText(right.name));
  const byImageThenName = (left, right) => {
    const imageScore = byImage(left, right);

    if (imageScore !== 0) {
      return imageScore;
    }

    return byName(left, right);
  };

  sortedProducts.sort((left, right) => {
    if (sortBy === 'price-low') {
      return byImage(left, right)
        || (left.priceAmount || 0) - (right.priceAmount || 0)
        || byName(left, right);
    }

    if (sortBy === 'price-high') {
      return byImage(left, right)
        || (right.priceAmount || 0) - (left.priceAmount || 0)
        || byName(left, right);
    }

    if (sortBy === 'name') {
      return byImageThenName(left, right);
    }

    return byImageThenName(left, right);
  });

  return sortedProducts;
}

async function normalizeItems(categoryKey, items) {
  const imagesById = await getSquareImagesById(items);
  const normalizedProducts = items.map((item, index) => normalizeSquareItem(item, categoryKey, index, imagesById));
  return markImageAvailability(normalizedProducts);
}

async function searchSquareCatalogPage(categoryKey, cursor, maxPriceAmount = 0, sortBy = 'image-name', searchTerm = '') {
  if (!process.env.SQUARE_ACCESS_TOKEN) {
    return { configured: false, products: [], nextCursor: '', pageSize: 12 };
  }

  const categoriesByName = await getSquareCategoriesByName();
  const category = categoriesByName.get(categoryKey);

  if (!category) {
    return { configured: true, products: [], nextCursor: '', pageSize: 12 };
  }

  const pageSize = Number(process.env.SQUARE_PAGE_SIZE || 12);
  const limit = Math.min(Math.max(pageSize, 1), 100);
  let squareCursor = '';
  const matchedItems = [];
  const offset = cursor?.startsWith('offset:')
    ? Number(cursor.replace('offset:', '')) || 0
    : 0;

  do {
    const body = {
      category_ids: [category.id],
      enabled_location_ids: [getSquareLocationId()],
      limit: 100,
      sort_order: 'ASC',
      product_types: ['REGULAR'],
      archived_state: 'ARCHIVED_STATE_NOT_ARCHIVED',
      ...(squareCursor ? { cursor: squareCursor } : {}),
    };
    const data = await squareRequest('/v2/catalog/search-catalog-items', {}, {
      method: 'POST',
      body,
    });

    matchedItems.push(...(data?.items || []).filter((item) => (
      (maxPriceAmount <= 0 || getSquareItemPriceAmount(item) <= maxPriceAmount)
      && squareItemMatchesSearch(item, searchTerm)
    )));
    squareCursor = data?.cursor || '';
  } while (squareCursor);

  const normalizedProducts = sortNormalizedProducts(await normalizeItems(categoryKey, matchedItems), sortBy);
  const pagedProducts = normalizedProducts.slice(offset, offset + limit);
  const nextOffset = offset + limit;

  return {
    configured: true,
    products: pagedProducts,
    nextCursor: nextOffset < normalizedProducts.length ? `offset:${nextOffset}` : '',
    pageSize: limit,
  };
}

async function getSquareCatalogProducts() {
  const groupedProducts = Object.fromEntries(catalogKeys.map((key) => [key, []]));

  if (!process.env.SQUARE_ACCESS_TOKEN) {
    return { configured: false, products: groupedProducts };
  }

  const objects = await listSquareCatalog('ITEM,CATEGORY,IMAGE');
  const categoriesById = new Map(
    objects
      .filter((object) => object.type === 'CATEGORY')
      .map((category) => [category.id, category])
  );
  const imagesById = new Map(
    objects
      .filter((object) => object.type === 'IMAGE')
      .map((image) => [image.id, image])
  );

  objects
    .filter((object) => (
      object.type === 'ITEM'
      && !object.is_deleted
      && !object.item_data?.is_archived
      && isAvailableAtSquareLocation(object)
    ))
    .sort((left, right) => normalizeText(left.item_data?.name).localeCompare(normalizeText(right.item_data?.name)))
    .forEach((item) => {
      const itemData = item.item_data || {};
      const categoryKey = getItemCategoryIds(itemData)
        .map((categoryId) => categoriesById.get(categoryId)?.category_data?.name)
        .map(classifyCategory)
        .find(Boolean);

      if (!categoryKey) {
        return;
      }

      groupedProducts[categoryKey].push(
        normalizeSquareItem(item, categoryKey, groupedProducts[categoryKey].length, imagesById)
      );
    });

  return { configured: true, products: groupedProducts };
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

app.post('/api/admin/upload-image', requireAuth, async (req, res) => {
  try {
    const imageUrl = await uploadImageToBucket(req.body || {});
    res.json({ imageUrl });
  } catch (error) {
    console.error('Failed to upload admin image');
    console.error(error);
    res.status(502).json({ error: error.message || 'Unable to upload image.' });
  }
});

app.get('/api/content', async (_req, res) => {
  const db = await getConnection();
  const [rows] = await db.execute('SELECT content_json FROM site_content WHERE id = 1 LIMIT 1');
  await db.end();
  res.json(rows[0]?.content_json || defaultContent);
});

app.get('/api/products', async (_req, res) => {
  try {
    const squareProducts = await getSquareCatalogProducts();
    res.set('Cache-Control', 'no-store');
    res.json(squareProducts);
  } catch (error) {
    console.error('Failed to fetch Square products');
    console.error(error);
    res.status(502).json({ error: 'Unable to fetch Square products.' });
  }
});

app.get('/api/product/:id', async (req, res) => {
  try {
    const data = await retrieveSquareCatalogObject(req.params.id, true);
    const item = data?.object;

    if (!item || item.type !== 'ITEM' || item.is_deleted) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const imagesById = new Map(
      (data.related_objects || [])
        .filter((object) => object.type === 'IMAGE')
        .map((image) => [image.id, image])
    );

    res.set('Cache-Control', 'no-store');
    res.json({
      product: normalizeSquareProductDetail(item, imagesById, data.related_objects || []),
    });
  } catch (error) {
    console.error('Failed to fetch Square product detail');
    console.error(error);
    res.status(502).json({ error: 'Unable to fetch product detail.' });
  }
});

app.get('/api/products/:category', async (req, res) => {
  try {
    const category = normalizeText(req.params.category);

    if (!catalogKeys.includes(category)) {
      res.status(404).json({ error: 'Unknown product category.' });
      return;
    }

    const maxPriceAmount = Math.max(0, Math.round(Number(req.query.maxPrice || 0) * 100));
    const sortBy = ['image-name', 'name', 'price-low', 'price-high'].includes(req.query.sort)
      ? req.query.sort
      : 'image-name';
    const productsPage = await searchSquareCatalogPage(
      category,
      req.query.cursor || '',
      maxPriceAmount,
      sortBy,
      req.query.search || ''
    );
    res.set('Cache-Control', 'no-store');
    res.json(productsPage);
  } catch (error) {
    console.error('Failed to fetch Square product page');
    console.error(error);
    res.status(502).json({ error: 'Unable to fetch Square products.' });
  }
});

app.post('/api/checkout', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const lineItems = items
      .map((item) => ({
        catalog_object_id: String(item.squareVariationId || ''),
        quantity: String(Math.max(1, Number(item.quantity || 1))),
      }))
      .filter((item) => item.catalog_object_id);

    if (!lineItems.length) {
      res.status(400).json({ error: 'Cart is empty.' });
      return;
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const data = await squareRequest('/v2/online-checkout/payment-links', {}, {
      method: 'POST',
      body: {
        idempotency_key: crypto.randomUUID(),
        order: {
          location_id: getSquareLocationId(),
          line_items: lineItems,
        },
        checkout_options: {
          redirect_url: `${baseUrl}/?checkout=complete`,
        },
      },
    });

    const checkoutUrl = data?.payment_link?.url || data?.payment_link?.long_url;

    if (!checkoutUrl) {
      res.status(502).json({ error: 'Square did not return a checkout URL.' });
      return;
    }

    res.json({ checkoutUrl });
  } catch (error) {
    console.error('Failed to create Square checkout');
    console.error(error);
    res.status(502).json({ error: 'Unable to create checkout.' });
  }
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
