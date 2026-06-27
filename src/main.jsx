import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import defaultContent from './data/content.json';
import './styles.css';

const CONTENT_STORAGE_KEY = 'zelis_shop_content';
const ADMIN_TOKEN_STORAGE_KEY = 'zelis_admin_token';

function mergeContent(defaultValue, savedValue) {
  if (Array.isArray(defaultValue)) {
    return Array.isArray(savedValue)
      ? defaultValue.map((item, index) => mergeContent(item, savedValue[index]))
      : defaultValue;
  }

  if (defaultValue && typeof defaultValue === 'object') {
    return Object.fromEntries(
      Object.entries(defaultValue).map(([key, value]) => [key, mergeContent(value, savedValue?.[key])])
    );
  }

  return savedValue ?? defaultValue;
}

function getInitialContent() {
  try {
    const savedContent = window.localStorage.getItem(CONTENT_STORAGE_KEY);
    return savedContent ? mergeContent(defaultContent, JSON.parse(savedContent)) : defaultContent;
  } catch {
    return defaultContent;
  }
}

async function fetchContent() {
  const response = await fetch('/api/content');

  if (!response.ok) {
    throw new Error('Unable to load content.');
  }

  return mergeContent(defaultContent, await response.json());
}

async function fetchCatalogPage(category, cursor = '', filters = {}) {
  const params = new URLSearchParams();

  if (cursor) {
    params.set('cursor', cursor);
  }

  if (filters.maxPrice && filters.maxPrice < 200) {
    params.set('maxPrice', filters.maxPrice);
  }

  if (filters.sort) {
    params.set('sort', filters.sort);
  }

  if (filters.search) {
    params.set('search', filters.search);
  }

  const query = params.toString() ? `?${params}` : '';
  const response = await fetch(`/api/products/${category}${query}`);

  if (!response.ok) {
    throw new Error('Unable to load Square products.');
  }

  return response.json();
}

async function fetchHomeFeaturedProducts() {
  const response = await fetch('/api/home-featured-products');

  if (!response.ok) {
    throw new Error('Unable to load homepage products.');
  }

  return response.json();
}

async function fetchProductDetail(productId) {
  const response = await fetch(`/api/product/${encodeURIComponent(productId)}`);

  if (!response.ok) {
    throw new Error('Unable to load product detail.');
  }

  const data = await response.json();
  return data.product;
}

function imageStyle(imageUrl) {
  return imageUrl
    ? { backgroundImage: `url("${imageUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined;
}

function multilineText(text) {
  return String(text).split('\n').map((line, index) => (
    <React.Fragment key={`${line}-${index}`}>
      {index > 0 ? <br /> : null}
      {line}
    </React.Fragment>
  ));
}

function pathKey(path) {
  return path.join('.');
}

function previewPathProps(path, highlightedPath, className = '') {
  const key = pathKey(path);
  const isActive = highlightedPath && (highlightedPath === key || highlightedPath.startsWith(`${key}.`));
  const classNames = [className, isActive ? 'previewHighlight' : ''].filter(Boolean).join(' ');

  return {
    'data-preview-path': key,
    className: classNames || undefined,
  };
}

function findPreviewElement(targetPath) {
  const parts = targetPath.split('.');

  while (parts.length) {
    const selector = `[data-preview-path="${parts.join('.')}"]`;
    const element = document.querySelector(selector);

    if (element) {
      return element;
    }

    parts.pop();
  }

  return null;
}

function Icon({ children, label }) {
  return (
    <button className="iconButton" aria-label={label} type="button">
      {children}
    </button>
  );
}

function catalogStatusText(category, products, state, fallbackText = '') {
  if (state?.loading) {
    return 'Loading products...';
  }

  if (state?.error) {
    return state.error;
  }

  if (state?.products?.length) {
    return `Page ${state.page || 1} - ${products.length} ${category} products`;
  }

  return fallbackText || `Showing ${products.length} products`;
}

function CatalogPager({ state = {}, onPrevious, onNext, label }) {
  return (
    <nav className="catalogPagination" aria-label={label}>
      <button type="button" aria-label="Previous page" disabled={state.loading || (state.page || 1) <= 1} onClick={onPrevious}>
        {'<'}
      </button>
      <span className="active">{String(state.page || 1).padStart(2, '0')}</span>
      <button type="button" aria-label="Next page" disabled={state.loading || !state.nextCursor} onClick={onNext}>
        {'>'}
      </button>
    </nav>
  );
}

function CatalogLoadingPopup({ active }) {
  if (!active) {
    return null;
  }

  return (
    <div className="catalogLoadingOverlay" role="status" aria-live="polite">
      <div className="catalogLoadingPopup">
        <span aria-hidden="true" />
        <strong>Loading Products</strong>
        <p>Fetching the latest catalogue from Square.</p>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  highlightedPath,
  path,
  cardClass,
  imageClass,
  badgeClass = '',
  onAddToCart,
  onViewProduct,
}) {
  const hasImage = Boolean(product.imageUrl);
  const productImageClass = hasImage
    ? `${imageClass} ${product.imageClass || ''}`
    : `${imageClass} productImagePlaceholder`;

  return (
    <article {...previewPathProps(path, highlightedPath, cardClass)} key={product.id || product.name}>
      <div className={productImageClass} style={imageStyle(product.imageUrl)} aria-hidden="true">
        {product.badge ? <span className={badgeClass}>{product.badge}</span> : null}
        <i />
      </div>
      <h3>{product.name}</h3>
      <p>{product.description}</p>
      <strong>{product.price}</strong>
      <div className="productActions">
        <button className="viewProductButton" type="button" onClick={() => onViewProduct(product.id)}>
          View
        </button>
        <button className="addToCartButton" type="button" onClick={() => onAddToCart(product)}>
          Add to Cart
        </button>
      </div>
    </article>
  );
}

function ProductDetailPage({ product, loading, error, onBack, onAddToCart }) {
  if (loading) {
    return (
      <section className="productDetailPage">
        <button className="backButton" type="button" onClick={onBack}>Back to products</button>
        <p className="productDetailStatus">Loading product...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="productDetailPage">
        <button className="backButton" type="button" onClick={onBack}>Back to products</button>
        <p className="productDetailStatus">{error}</p>
      </section>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <section className="productDetailPage" aria-label="Product details">
      <button className="backButton" type="button" onClick={onBack}>Back to products</button>

      <div className="productDetailLayout">
        <div
          className={product.imageUrl ? 'productDetailImage' : 'productDetailImage productImagePlaceholder'}
          style={imageStyle(product.imageUrl)}
          aria-hidden="true"
        >
          <i />
        </div>

        <div className="productDetailContent">
          <div className="productDetailHeading">
            <span>{product.categories?.join(' / ') || 'Zelis Shop'}</span>
            <h1>{product.name}</h1>
            <strong>{product.price}</strong>
          </div>

          <p className="productDetailDescription">{product.plainDescription || product.description}</p>

          <button className="detailAddButton" type="button" onClick={() => onAddToCart(product)}>
            Add to Cart
          </button>

          <div className="productInfoGrid">
            <div><span>Product Type</span><strong>{product.productType || 'Standard'}</strong></div>
            <div><span>Online Visibility</span><strong>{product.ecomVisibility || 'Not specified'}</strong></div>
            <div><span>Taxable</span><strong>{product.isTaxable ? 'Yes' : 'No'}</strong></div>
            <div><span>Square Item ID</span><strong>{product.id}</strong></div>
            {product.abbreviation ? <div><span>Abbreviation</span><strong>{product.abbreviation}</strong></div> : null}
            {product.updatedAt ? <div><span>Updated</span><strong>{new Date(product.updatedAt).toLocaleDateString()}</strong></div> : null}
          </div>

          <section className="variationSection" aria-label="Product variations">
            <h2>Variations</h2>
            <div className="variationList">
              {product.variations?.map((variation) => (
                <article key={variation.id}>
                  <div>
                    <h3>{variation.name}</h3>
                    {variation.sku ? <p>SKU: {variation.sku}</p> : null}
                  </div>
                  <strong>{variation.price}</strong>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

const beautyCatalogProducts = [
  {
    name: 'Botanical Radiance Oil',
    description: 'Organic Rosehip & Squalane',
    price: '$82.00',
    badge: 'Bestseller',
    imageClass: 'catalogOil',
  },
  {
    name: 'Velvet Matte Crayon',
    description: 'High-Pigment 12hr Wear',
    price: '$42.00',
    badge: 'New Arrival',
    imageClass: 'catalogLipstick',
  },
  {
    name: 'Ethereal Dusk Palette',
    description: 'Mineral Earth Pigments',
    price: '$65.00',
    imageClass: 'catalogPalette',
  },
  {
    name: 'Moonlit Repair Cream',
    description: 'Nightly Renewal Complex',
    price: '$94.00',
    imageClass: 'catalogCream',
  },
  {
    name: 'Hydra-Bloom Mist',
    description: 'Rose Water & Glycerin',
    price: '$38.00',
    badge: 'Restocked',
    imageClass: 'catalogMist',
  },
  {
    name: 'Silk & Cedarwood EDP',
    description: 'Limited Edition Fragrance',
    price: '$145.00',
    imageClass: 'catalogPerfume',
  },
];

const groceryCatalogProducts = [
  {
    name: 'Bario Heirloom Rice',
    description: 'Highland cultivation, nutty aroma',
    price: 'RM 45.00',
    badge: 'Sarawak Heritage',
    imageClass: 'groceryRice',
  },
  {
    name: 'Artisan Laksa Paste',
    description: 'Small-batch, Malacca traditional',
    price: 'RM 28.50',
    imageClass: 'groceryLaksa',
  },
  {
    name: 'Premium Santan Milk',
    description: 'First-press, organic coconuts',
    price: 'RM 12.00',
    badge: 'Bestseller',
    imageClass: 'grocerySantan',
  },
  {
    name: 'Organic Lemongrass',
    description: 'Pahang farm, hand-picked',
    price: 'RM 6.50',
    imageClass: 'groceryLemongrass',
  },
  {
    name: "Bird's Eye Chili Flakes",
    description: 'Extra spicy, sun-dried naturally',
    price: 'RM 18.00',
    imageClass: 'groceryChili',
  },
  {
    name: 'Heritage Gula Melaka',
    description: 'Pure palm nectar, hand-crafted',
    price: 'RM 24.00',
    imageClass: 'groceryGula',
  },
];

const babyCatalogProducts = [
  {
    name: 'Organic Cotton Muslin Set',
    description: 'Breathable swaddles',
    price: '$64.00',
    badge: 'New Arrival',
    imageClass: 'babyCatalogMuslin',
  },
  {
    name: 'Heirloom Wooden Blocks',
    description: 'Sustainably sourced wood',
    price: '$88.00',
    imageClass: 'babyCatalogBlocks',
  },
  {
    name: 'Gentle Dream Wash',
    description: 'Hypoallergenic formula',
    price: '$32.00',
    badge: 'Top Rated',
    imageClass: 'babyCatalogWash',
  },
  {
    name: 'Sage Cashmere Set',
    description: 'Premium blend',
    price: '$120.00',
    imageClass: 'babyCatalogCashmere',
  },
  {
    name: 'Ethereal Mobile',
    description: 'Nursery decor',
    price: '$75.00',
    imageClass: 'babyCatalogMobile',
  },
  {
    name: 'Petal Soft Booties',
    description: 'Vegetable tanned leather',
    price: '$52.00',
    imageClass: 'babyCatalogBooties',
  },
];

const clothingCatalogProducts = [
  {
    name: 'Silk Blouse',
    description: 'Mulberry silk, moon stone',
    price: '$190',
    badge: 'Limited',
    imageClass: 'clothingSilkBlouse',
  },
  {
    name: 'Tailored Linen Trousers',
    description: 'Belgian linen, charcoal',
    price: '$220',
    imageClass: 'clothingTrousers',
  },
  {
    name: 'Cashmere Knit',
    description: 'Grade-A cashmere, soft blush',
    price: '$310',
    imageClass: 'clothingCashmere',
  },
  {
    name: 'Structured Blazer',
    description: 'Wool blend, ivory',
    price: '$450',
    imageClass: 'clothingBlazer',
  },
  {
    name: 'Silk Slip Dress',
    description: 'Sand washed silk, charcoal',
    price: '$290',
    badge: 'Signature',
    imageClass: 'clothingSlipDress',
  },
  {
    name: 'Heritage Trench',
    description: 'Cotton twill, stone',
    price: '$380',
    imageClass: 'clothingTrench',
  },
];

function PriceRangeFilter({ value, onChange }) {
  return (
    <div className="filterGroup priceFilter">
      <div className="priceFilterHeader">
        <h3>Price Range</h3>
        <strong>{value >= 200 ? '$200+' : `$${value}`}</strong>
      </div>
      <input
        type="range"
        min="0"
        max="200"
        step="5"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="rangeLabels"><span>$0</span><span>$200+</span></div>
    </div>
  );
}

function SortFilter({ category, value, onChange }) {
  return (
    <label className="sortFilter">
      <span>Sort By</span>
      <select value={value} onChange={(event) => onChange(category, event.target.value)}>
        <option value="image-name">Images First</option>
        <option value="name">Name A-Z</option>
        <option value="price-low">Price Low-High</option>
        <option value="price-high">Price High-Low</option>
      </select>
    </label>
  );
}

function SearchFilter({ category, value, onChange }) {
  return (
    <label className="searchFilter">
      <span>Search</span>
      <input
        type="search"
        value={value}
        placeholder="Search product"
        onChange={(event) => onChange(category, event.target.value)}
      />
    </label>
  );
}

function CatalogControls({
  category,
  products,
  catalogState,
  fallbackText,
  priceFilter,
  onPriceFilterChange,
  sortFilter,
  onSortFilterChange,
  searchFilter,
  onSearchFilterChange,
  highlightedPath,
  showingPath,
}) {
  const statusProps = showingPath
    ? previewPathProps(showingPath, highlightedPath)
    : {};

  return (
    <div className="catalogToolbar catalogTopFilters">
      <p {...statusProps}>{catalogStatusText(category, products, catalogState, fallbackText)}</p>
      <div className="catalogFilterControls">
        <SearchFilter category={category} value={searchFilter} onChange={onSearchFilterChange} />
        <PriceRangeFilter value={priceFilter} onChange={(value) => onPriceFilterChange(category, value)} />
        <SortFilter category={category} value={sortFilter} onChange={onSortFilterChange} />
      </div>
    </div>
  );
}

function BeautyCatalog({
  content,
  highlightedPath = '',
  products,
  catalogState,
  onPage,
  onAddToCart,
  onViewProduct,
  priceFilter,
  onPriceFilterChange,
  sortFilter,
  onSortFilterChange,
  searchFilter,
  onSearchFilterChange,
}) {
  const beauty = content.catalogs.beauty;
  const displayProducts = products || beauty.products;
  return (
    <section className="catalogPageSection" aria-label="Beauty product catalogue">
      <div {...previewPathProps(['catalogs', 'beauty'], highlightedPath, 'catalogHeroHeader')}>
        <div>
          <h1 {...previewPathProps(['catalogs', 'beauty', 'title'], highlightedPath)}>{beauty.title}</h1>
          <p {...previewPathProps(['catalogs', 'beauty', 'description'], highlightedPath)}>{beauty.description}</p>
        </div>
        {beauty.volume ? (
          <span {...previewPathProps(['catalogs', 'beauty', 'volume'], highlightedPath)}>{beauty.volume}</span>
        ) : null}
      </div>

      <div className="beautyCatalog" id="beauty-catalog">
        <div className="catalogMain">
          <CatalogControls
            category="beauty"
            products={displayProducts}
            catalogState={catalogState}
            fallbackText={beauty.showing}
            priceFilter={priceFilter}
            onPriceFilterChange={onPriceFilterChange}
            sortFilter={sortFilter}
            onSortFilterChange={onSortFilterChange}
            searchFilter={searchFilter}
            onSearchFilterChange={onSearchFilterChange}
            highlightedPath={highlightedPath}
            showingPath={['catalogs', 'beauty', 'showing']}
          />

          <div className="catalogProductsArea">
            <CatalogLoadingPopup active={catalogState?.loading} />
            <div className="catalogGrid">
              {displayProducts.map((product, index) => (
                <ProductCard
                  key={product.id || product.name}
                  product={product}
                  index={index}
                  highlightedPath={highlightedPath}
                  path={['catalogs', 'beauty', 'products', index]}
                  cardClass="catalogProductCard"
                  imageClass="catalogProductImage"
                  badgeClass="catalogBadge"
                  onAddToCart={onAddToCart}
                  onViewProduct={onViewProduct}
                />
              ))}
            </div>
          </div>

          <CatalogPager
            state={catalogState}
            label="Beauty catalog pagination"
            onPrevious={() => onPage('beauty', 'previous')}
            onNext={() => onPage('beauty', 'next')}
          />
        </div>
      </div>
    </section>
  );
}

function ClothingCatalog({
  content,
  highlightedPath = '',
  products,
  catalogState,
  onPage,
  onAddToCart,
  onViewProduct,
  priceFilter,
  onPriceFilterChange,
  sortFilter,
  onSortFilterChange,
  searchFilter,
  onSearchFilterChange,
}) {
  const clothing = content.catalogs.clothing;
  const displayProducts = products || clothing.products;
  return (
    <section className="clothingCatalogPage" aria-label="Clothing product catalogue">
      <div className="clothingHero">
        <div {...previewPathProps(['catalogs', 'clothing'], highlightedPath, 'clothingHeroCopy')}>
          <span {...previewPathProps(['catalogs', 'clothing', 'eyebrow'], highlightedPath)}>{clothing.eyebrow}</span>
          <h1 {...previewPathProps(['catalogs', 'clothing', 'title'], highlightedPath)}>{clothing.title}</h1>
          <p {...previewPathProps(['catalogs', 'clothing', 'description'], highlightedPath)}>{clothing.description}</p>
        </div>
        <div className="clothingHeroRack" style={imageStyle(clothing.heroImageUrl)} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>

      <div className="clothingCatalog" id="clothing-catalog">
        <div className="clothingCatalogMain">
          <CatalogControls
            category="clothing"
            products={displayProducts}
            catalogState={catalogState}
            fallbackText="Showing clothing products"
            priceFilter={priceFilter}
            onPriceFilterChange={onPriceFilterChange}
            sortFilter={sortFilter}
            onSortFilterChange={onSortFilterChange}
            searchFilter={searchFilter}
            onSearchFilterChange={onSearchFilterChange}
          />

          <div className="catalogProductsArea">
            <CatalogLoadingPopup active={catalogState?.loading} />
            <div className="clothingGrid" id="clothing-grid">
              {displayProducts.map((product, index) => (
                <ProductCard
                  key={product.id || product.name}
                  product={product}
                  index={index}
                  highlightedPath={highlightedPath}
                  path={['catalogs', 'clothing', 'products', index]}
                  cardClass="clothingProductCard"
                  imageClass="clothingProductImage"
                  onAddToCart={onAddToCart}
                  onViewProduct={onViewProduct}
                />
              ))}
            </div>
          </div>

          <CatalogPager
            state={catalogState}
            label="Clothing catalogue pagination"
            onPrevious={() => onPage('clothing', 'previous')}
            onNext={() => onPage('clothing', 'next')}
          />
        </div>
      </div>

      <section className="clothingPhilosophy">
        <div className="philosophyImage" style={imageStyle(clothing.philosophyImageUrl)} aria-hidden="true">
          <span />
        </div>
        <div className="philosophyCopy">
          <h2 {...previewPathProps(['catalogs', 'clothing', 'philosophyTitle'], highlightedPath)}>{clothing.philosophyTitle}</h2>
          <p {...previewPathProps(['catalogs', 'clothing', 'philosophyDescription'], highlightedPath)}>{clothing.philosophyDescription}</p>
          <form className="philosophyForm">
            <input type="email" placeholder="Email Address" />
            <button type="submit">Subscribe</button>
          </form>
        </div>
      </section>
    </section>
  );
}

function BabyCatalog({
  content,
  highlightedPath = '',
  products,
  catalogState,
  onPage,
  onAddToCart,
  onViewProduct,
  priceFilter,
  onPriceFilterChange,
  sortFilter,
  onSortFilterChange,
  searchFilter,
  onSearchFilterChange,
}) {
  const baby = content.catalogs.baby;
  const displayProducts = products || baby.products;
  return (
    <section className="catalogPageSection babyCatalogPage" aria-label="Baby product catalogue">
      <div className="babyCatalogHeader">
        <div>
          <span {...previewPathProps(['catalogs', 'baby', 'eyebrow'], highlightedPath)}>{baby.eyebrow}</span>
          <h1 {...previewPathProps(['catalogs', 'baby', 'title'], highlightedPath)}>{baby.title}</h1>
          <p {...previewPathProps(['catalogs', 'baby', 'description'], highlightedPath)}>{baby.description}</p>
        </div>

      </div>

      <div className="babyCatalog" id="baby-catalog">
        <div className="babyCatalogMain">
          <CatalogControls
            category="baby"
            products={displayProducts}
            catalogState={catalogState}
            fallbackText="Showing baby products"
            priceFilter={priceFilter}
            onPriceFilterChange={onPriceFilterChange}
            sortFilter={sortFilter}
            onSortFilterChange={onSortFilterChange}
            searchFilter={searchFilter}
            onSearchFilterChange={onSearchFilterChange}
          />

          <div className="catalogProductsArea">
            <CatalogLoadingPopup active={catalogState?.loading} />
            <div className="babyCatalogGrid">
              {displayProducts.map((product, index) => (
                <ProductCard
                  key={product.id || product.name}
                  product={product}
                  index={index}
                  highlightedPath={highlightedPath}
                  path={['catalogs', 'baby', 'products', index]}
                  cardClass="babyCatalogProduct"
                  imageClass="babyCatalogImage"
                  onAddToCart={onAddToCart}
                  onViewProduct={onViewProduct}
                />
              ))}
            </div>
          </div>

          <CatalogPager
            state={catalogState}
            label="Baby catalogue pagination"
            onPrevious={() => onPage('baby', 'previous')}
            onNext={() => onPage('baby', 'next')}
          />
        </div>
      </div>
    </section>
  );
}

function GroceryCatalog({
  content,
  highlightedPath = '',
  products,
  catalogState,
  onPage,
  onAddToCart,
  onViewProduct,
  priceFilter,
  onPriceFilterChange,
  sortFilter,
  onSortFilterChange,
  searchFilter,
  onSearchFilterChange,
}) {
  const groceries = content.catalogs.groceries;
  const displayProducts = products || groceries.products;
  return (
    <section className="catalogPageSection groceryPageSection" aria-label="Groceries product catalogue">
      <div className="groceryCatalogHero">
        <div className="groceryCatalogCopy">
          <span {...previewPathProps(['catalogs', 'groceries', 'eyebrow'], highlightedPath)}>{groceries.eyebrow}</span>
          <h1 {...previewPathProps(['catalogs', 'groceries', 'title'], highlightedPath)}>{groceries.title}</h1>
          <p {...previewPathProps(['catalogs', 'groceries', 'description'], highlightedPath)}>{groceries.description}</p>
        </div>
        <div className="groceryHeroImage" style={imageStyle(groceries.heroImageUrl)} aria-hidden="true">
          <span />
        </div>
      </div>

      <div className="groceryCatalog" id="grocery-catalog">
        <div className="groceryCatalogMain">
          <CatalogControls
            category="groceries"
            products={displayProducts}
            catalogState={catalogState}
            fallbackText="Showing groceries products"
            priceFilter={priceFilter}
            onPriceFilterChange={onPriceFilterChange}
            sortFilter={sortFilter}
            onSortFilterChange={onSortFilterChange}
            searchFilter={searchFilter}
            onSearchFilterChange={onSearchFilterChange}
          />

          <div className="catalogProductsArea">
            <CatalogLoadingPopup active={catalogState?.loading} />
            <div className="groceryCatalogGrid">
              {displayProducts.map((product, index) => (
                <ProductCard
                  key={product.id || product.name}
                  product={product}
                  index={index}
                  highlightedPath={highlightedPath}
                  path={['catalogs', 'groceries', 'products', index]}
                  cardClass="groceryProductCard"
                  imageClass="groceryProductImage"
                  onAddToCart={onAddToCart}
                  onViewProduct={onViewProduct}
                />
              ))}
            </div>
          </div>

          <CatalogPager
            state={catalogState}
            label="Groceries catalogue pagination"
            onPrevious={() => onPage('groceries', 'previous')}
            onNext={() => onPage('groceries', 'next')}
          />
        </div>
      </div>
    </section>
  );
}

function Storefront({ content, preview = false, highlightedPath = '' }) {
  const [activePage, setActivePage] = useState('home');
  const [catalogPages, setCatalogPages] = useState({});
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [fulfillmentType, setFulfillmentType] = useState('delivery');
  const [homeFeaturedProducts, setHomeFeaturedProducts] = useState({ beauty: [], baby: [] });
  const checkoutAbortRef = useRef(null);
  const [productDetail, setProductDetail] = useState({ loading: false, error: '', product: null, fromPage: 'home' });
  const [priceFilters, setPriceFilters] = useState({
    beauty: 200,
    groceries: 200,
    baby: 200,
    clothing: 200,
  });
  const [sortFilters, setSortFilters] = useState({
    beauty: 'image-name',
    groceries: 'image-name',
    baby: 'image-name',
    clothing: 'image-name',
  });
  const [searchFilters, setSearchFilters] = useState({
    beauty: '',
    groceries: '',
    baby: '',
    clothing: '',
  });
  const [debouncedSearchFilters, setDebouncedSearchFilters] = useState(searchFilters);

  const loadCatalogPage = async (category, direction = 'initial') => {
    if (preview) {
      return;
    }

    const current = catalogPages[category] || { page: 1, cursors: [''], cursor: '' };
    let cursor = current.cursor || '';
    let page = current.page || 1;
    let cursors = current.cursors || [''];

    if (direction === 'next') {
      if (!current.nextCursor) {
        return;
      }
      cursor = current.nextCursor;
      page += 1;
      cursors = [...cursors, current.nextCursor];
    } else if (direction === 'previous') {
      if (page <= 1) {
        return;
      }
      page -= 1;
      cursor = cursors[page - 1] || '';
      cursors = cursors.slice(0, page);
    }

    setCatalogPages((pages) => ({
      ...pages,
      [category]: {
        ...(pages[category] || {}),
        loading: true,
        error: '',
      },
    }));

    try {
      const data = await fetchCatalogPage(category, cursor, {
        maxPrice: priceFilters[category],
        sort: sortFilters[category],
        search: debouncedSearchFilters[category],
      });
      setCatalogPages((pages) => ({
        ...pages,
        [category]: {
          products: data.products || [],
          nextCursor: data.nextCursor || '',
          cursor,
          cursors,
          page,
          loading: false,
          error: '',
        },
      }));
    } catch {
      setCatalogPages((pages) => ({
        ...pages,
        [category]: {
          ...(pages[category] || {}),
          loading: false,
          error: 'Unable to load Square products.',
        },
      }));
    }
  };

  const changePriceFilter = (category, value) => {
    setPriceFilters((filters) => ({
      ...filters,
      [category]: value,
    }));
    setCatalogPages((pages) => ({
      ...pages,
      [category]: {
        ...(pages[category] || {}),
        products: [],
        nextCursor: '',
        cursor: '',
        cursors: [''],
        page: 1,
      },
    }));
  };

  const resetCatalogPage = (category) => {
    setCatalogPages((pages) => ({
      ...pages,
      [category]: {
        ...(pages[category] || {}),
        products: [],
        nextCursor: '',
        cursor: '',
        cursors: [''],
        page: 1,
      },
    }));
  };

  const changeSortFilter = (category, value) => {
    setSortFilters((filters) => ({
      ...filters,
      [category]: value,
    }));
    resetCatalogPage(category);
  };

  const changeSearchFilter = (category, value) => {
    setSearchFilters((filters) => ({
      ...filters,
      [category]: value,
    }));
    resetCatalogPage(category);
  };

  const addToCart = (product) => {
    if (!product.squareVariationId) {
      setCheckoutError('This product is missing a Square variation and cannot be checked out.');
      return;
    }

    setCartItems((items) => {
      const existing = items.find((item) => item.squareVariationId === product.squareVariationId);

      if (existing) {
        return items.map((item) => (
          item.squareVariationId === product.squareVariationId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      }

      return [...items, { ...product, quantity: 1 }];
    });
    setCheckoutError('');
    setIsCartOpen(true);
  };

  const viewProduct = async (productId) => {
    if (!productId || preview) {
      return;
    }

    const fromPage = activePage;
    setProductDetail({ loading: true, error: '', product: null, fromPage });
    setActivePage('product');
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));

    try {
      const product = await fetchProductDetail(productId);
      setProductDetail({ loading: false, error: '', product, fromPage });
    } catch {
      setProductDetail({ loading: false, error: 'Unable to load product detail.', product: null, fromPage });
    }
  };

  const closeProductDetail = () => {
    setActivePage(productDetail.fromPage && productDetail.fromPage !== 'product' ? productDetail.fromPage : 'home');
    setProductDetail((detail) => ({ ...detail, loading: false, error: '', product: null }));
  };

  const updateCartQuantity = (variationId, quantity) => {
    setCartItems((items) => items
      .map((item) => (
        item.squareVariationId === variationId
          ? { ...item, quantity: Math.max(0, quantity) }
          : item
      ))
      .filter((item) => item.quantity > 0));
  };

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  const checkoutCart = async () => {
    setIsCheckingOut(true);
    setCheckoutError('');
    checkoutAbortRef.current?.abort();
    const checkoutAbort = new AbortController();
    checkoutAbortRef.current = checkoutAbort;

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: checkoutAbort.signal,
        body: JSON.stringify({
          fulfillmentType,
          items: cartItems.map((item) => ({
            squareVariationId: item.squareVariationId,
            quantity: item.quantity,
          })),
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error || 'Unable to create checkout.');
      }

      window.location.href = data.checkoutUrl;
    } catch (error) {
      if (error.name !== 'AbortError') {
        setCheckoutError(error.message || 'Unable to create checkout.');
      }
      setIsCheckingOut(false);
    } finally {
      if (checkoutAbortRef.current === checkoutAbort) {
        checkoutAbortRef.current = null;
      }
    }
  };

  const cancelCheckout = () => {
    checkoutAbortRef.current?.abort();
    checkoutAbortRef.current = null;
    setIsCheckingOut(false);
    setCheckoutError('');
    setIsCartOpen(false);
  };

  const navigateTo = (page) => (event) => {
    event.preventDefault();
    setActivePage(page);
    if (!preview) {
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }
  };

  const navigateToSection = (sectionId) => (event) => {
    event.preventDefault();
    setActivePage('home');
    if (preview) {
      return;
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      });
    });
  };

  useEffect(() => {
    const revealItems = document.querySelectorAll('[data-reveal]');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      revealItems.forEach((item) => item.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          } else {
            entry.target.classList.remove('is-visible');
          }
        });
      },
      { threshold: 0.16, rootMargin: '0px 0px -8% 0px' }
    );

    revealItems.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [activePage]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchFilters(searchFilters);
    }, 320);

    return () => window.clearTimeout(timeout);
  }, [searchFilters]);

  useEffect(() => {
    if (preview) {
      return undefined;
    }

    let isActive = true;

    fetchHomeFeaturedProducts()
      .then((data) => {
        if (isActive) {
          setHomeFeaturedProducts(data.products || { beauty: [], baby: [] });
        }
      })
      .catch(() => {
        if (isActive) {
          setHomeFeaturedProducts({ beauty: [], baby: [] });
        }
      });

    return () => {
      isActive = false;
    };
  }, [preview]);

  useEffect(() => {
    if (preview || activePage === 'home' || activePage === 'product' || catalogPages[activePage]?.products?.length) {
      return;
    }

    loadCatalogPage(activePage);
  }, [activePage, preview, priceFilters[activePage], sortFilters[activePage], debouncedSearchFilters[activePage]]);

  useEffect(() => {
    if (!preview || !highlightedPath) {
      return;
    }

    if (highlightedPath.startsWith('catalogs.beauty')) {
      setActivePage('beauty');
    } else if (highlightedPath.startsWith('catalogs.groceries')) {
      setActivePage('groceries');
    } else if (highlightedPath.startsWith('catalogs.baby')) {
      setActivePage('baby');
    } else if (highlightedPath.startsWith('catalogs.clothing')) {
      setActivePage('clothing');
    } else {
      setActivePage('home');
    }
  }, [highlightedPath, preview]);

  useEffect(() => {
    if (!preview || !highlightedPath) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        findPreviewElement(highlightedPath)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        });
      });
    });
  }, [activePage, highlightedPath, preview]);

  const beautyHomeProducts = homeFeaturedProducts.beauty || [];
  const beautyFeaturedProduct = beautyHomeProducts[0] || null;
  const beautyFeatured = {
    product: beautyFeaturedProduct,
    title: beautyFeaturedProduct?.name || content.home.beautyIntro.productTitle,
    description: beautyFeaturedProduct?.description || content.home.beautyIntro.description,
    price: beautyFeaturedProduct?.price || content.home.beautyIntro.price,
    imageUrl: beautyFeaturedProduct?.imageUrl || content.home.beautyIntro.imageUrl,
    hasLiveImage: Boolean(beautyFeaturedProduct?.imageUrl),
  };
  const beautyMiniProducts = content.home.beautyIntro.miniProducts.map((fallbackProduct, index) => {
    const product = beautyHomeProducts[index + 1] || null;

    return {
      product,
      name: product?.name || fallbackProduct.name,
      price: product?.price || fallbackProduct.price,
      imageUrl: product?.imageUrl || fallbackProduct.imageUrl,
      hasLiveImage: Boolean(product?.imageUrl),
    };
  });
  const babyHomeProducts = homeFeaturedProducts.baby || [];
  const babyProducts = content.home.babyIntro.products.map((fallbackProduct, index) => {
    const product = babyHomeProducts[index] || null;

    return {
      product,
      name: product?.name || fallbackProduct.name,
      description: product?.description || fallbackProduct.description,
      price: product?.price || fallbackProduct.price,
      button: product ? 'VIEW PRODUCT' : fallbackProduct.button,
      imageUrl: product?.imageUrl || fallbackProduct.imageUrl,
      hasLiveImage: Boolean(product?.imageUrl),
    };
  });
  const openHomeProduct = (product, page) => (event) => {
    event.preventDefault();

    if (product?.id) {
      viewProduct(product.id);
      return;
    }

    setActivePage(page);
    if (!preview) {
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }
  };

  return (
    <main className="pageShell">
      <section className="shopFrame" aria-label="Zelis Shop landing page">
        <header className="topNav">
          <a {...previewPathProps(['site', 'brand'], highlightedPath, 'brand')} href="/" onClick={navigateTo('home')}>
            {content.site.brand}
          </a>

          <nav className="categoryNav" aria-label="Shop categories">
            <a className={activePage === 'home' ? 'active' : undefined} href="/" onClick={navigateTo('home')}>{content.site.nav.home}</a>
            <a className={activePage === 'beauty' ? 'active' : undefined} href="#beauty-catalog" onClick={navigateTo('beauty')}>{content.site.nav.beauty}</a>
            <a className={activePage === 'groceries' ? 'active' : undefined} href="#grocery-catalog" onClick={navigateTo('groceries')}>{content.site.nav.groceries}</a>
            <a className={activePage === 'baby' ? 'active' : undefined} href="#baby-catalog" onClick={navigateTo('baby')}>{content.site.nav.baby}</a>
            <a className={activePage === 'clothing' ? 'active' : undefined} href="#clothing-catalog" onClick={navigateTo('clothing')}>{content.site.nav.clothing}</a>
          </nav>

        </header>

        {activePage === 'product' ? (
          <ProductDetailPage
            product={productDetail.product}
            loading={productDetail.loading}
            error={productDetail.error}
            onBack={closeProductDetail}
            onAddToCart={addToCart}
          />
        ) : activePage === 'beauty' ? (
          <BeautyCatalog
            content={content}
            highlightedPath={highlightedPath}
            products={catalogPages.beauty?.products}
            catalogState={catalogPages.beauty}
            onPage={loadCatalogPage}
            onAddToCart={addToCart}
            onViewProduct={viewProduct}
            priceFilter={priceFilters.beauty}
            onPriceFilterChange={changePriceFilter}
            sortFilter={sortFilters.beauty}
            onSortFilterChange={changeSortFilter}
            searchFilter={searchFilters.beauty}
            onSearchFilterChange={changeSearchFilter}
          />
        ) : activePage === 'groceries' ? (
          <GroceryCatalog
            content={content}
            highlightedPath={highlightedPath}
            products={catalogPages.groceries?.products}
            catalogState={catalogPages.groceries}
            onPage={loadCatalogPage}
            onAddToCart={addToCart}
            onViewProduct={viewProduct}
            priceFilter={priceFilters.groceries}
            onPriceFilterChange={changePriceFilter}
            sortFilter={sortFilters.groceries}
            onSortFilterChange={changeSortFilter}
            searchFilter={searchFilters.groceries}
            onSearchFilterChange={changeSearchFilter}
          />
        ) : activePage === 'baby' ? (
          <BabyCatalog
            content={content}
            highlightedPath={highlightedPath}
            products={catalogPages.baby?.products}
            catalogState={catalogPages.baby}
            onPage={loadCatalogPage}
            onAddToCart={addToCart}
            onViewProduct={viewProduct}
            priceFilter={priceFilters.baby}
            onPriceFilterChange={changePriceFilter}
            sortFilter={sortFilters.baby}
            onSortFilterChange={changeSortFilter}
            searchFilter={searchFilters.baby}
            onSearchFilterChange={changeSearchFilter}
          />
        ) : activePage === 'clothing' ? (
          <ClothingCatalog
            content={content}
            highlightedPath={highlightedPath}
            products={catalogPages.clothing?.products}
            catalogState={catalogPages.clothing}
            onPage={loadCatalogPage}
            onAddToCart={addToCart}
            onViewProduct={viewProduct}
            priceFilter={priceFilters.clothing}
            onPriceFilterChange={changePriceFilter}
            sortFilter={sortFilters.clothing}
            onSortFilterChange={changeSortFilter}
            searchFilter={searchFilters.clothing}
            onSearchFilterChange={changeSearchFilter}
          />
        ) : (
          <>
        <div {...previewPathProps(['hero'], highlightedPath, 'hero')} style={imageStyle(content.hero.imageUrl)}>
          <div className="heroStillLife" aria-hidden="true">
            <div className="wallEdge" />
            <div className="marbleShelf mainShelf" />
            <div className="marbleShelf frontShelf" />
            <div className="bottle tallBottle" />
            <div className="bottle shortBottle" />
            <div className="bowl">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="heroCopy" data-reveal="fade">
            <h1 {...previewPathProps(['hero', 'title'], highlightedPath)}>{content.hero.title}</h1>
            <p {...previewPathProps(['hero', 'subtitle'], highlightedPath)}>{content.hero.subtitle}</p>
            <a {...previewPathProps(['hero', 'button'], highlightedPath, 'cta')} href="#beauty-catalog" onClick={navigateTo('beauty')}>{content.hero.button}</a>
          </div>
        </div>

        <footer className="partners" aria-label="Luxury partners" data-reveal="up">
          <p>{content.home.partnersTitle}</p>
          <div {...previewPathProps(['home', 'partners'], highlightedPath, 'partnerCarousel')} aria-label={content.home.partnerLogosText}>
            <div className="partnerTrack" aria-hidden="true">
              {[...(content.home.partners || []), ...(content.home.partners || [])].map((partner, index) => (
                <div className="partnerLogo" key={`${partner.name}-${index}`}>
                  {partner.imageUrl ? (
                    <img src={partner.imageUrl} alt="" loading="lazy" />
                  ) : (
                    <span>{partner.name}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </footer>

        <section className="categoryShowcase" aria-label="Featured categories">
          <a {...previewPathProps(['home', 'categories', 0], highlightedPath, 'categoryTile beautyTile')} style={imageStyle(content.home.categories[0].imageUrl)} href="#beauty-catalog" onClick={navigateTo('beauty')} data-reveal="up">
            <span className="beautyProducts" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <strong>{multilineText(content.home.categories[0].title)}</strong>
          </a>

          <a {...previewPathProps(['home', 'categories', 1], highlightedPath, 'categoryTile groceriesTile')} style={imageStyle(content.home.categories[1].imageUrl)} href="#grocery-catalog" onClick={navigateTo('groceries')} data-reveal="up">
            <span className="palmLeaves" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="produce" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <strong>{multilineText(content.home.categories[1].title)}</strong>
          </a>

          <a {...previewPathProps(['home', 'categories', 2], highlightedPath, 'categoryTile babyTile')} style={imageStyle(content.home.categories[2].imageUrl)} href="#baby-catalog" onClick={navigateTo('baby')} data-reveal="up">
            <span className="babyOnesie" aria-hidden="true" />
            <strong>{multilineText(content.home.categories[2].title)}</strong>
          </a>

          <a {...previewPathProps(['home', 'categories', 3], highlightedPath, 'categoryTile clothingTile')} style={imageStyle(content.home.categories[3].imageUrl)} href="#clothing-catalog" onClick={navigateTo('clothing')} data-reveal="up">
            <span className="clothingRack" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <strong>{multilineText(content.home.categories[3].title)}</strong>
          </a>
        </section>

        <section className="editorialSections" aria-label="Curated shop selections">
          <div className="beautyEditorial">
            <div {...previewPathProps(['home', 'beautyIntro'], highlightedPath, 'sectionHeading')} data-reveal="left">
              <span>{content.home.beautyIntro.eyebrow}</span>
              <h2>{content.home.beautyIntro.title}</h2>
            </div>
            <a className="viewAll" href="#beauty-catalog" onClick={navigateTo('beauty')} data-reveal="right">{content.home.beautyIntro.viewAll}</a>

            <article {...previewPathProps(['home', 'beautyIntro'], highlightedPath, 'featuredProduct')} data-reveal="up">
              <div className="productCopy">
                <span className="badge">{content.home.beautyIntro.badge}</span>
                <h3>{multilineText(beautyFeatured.title)}</h3>
                <p>{beautyFeatured.description}</p>
                <strong>{beautyFeatured.price}</strong>
                <button
                  type="button"
                  onClick={beautyFeatured.product ? () => addToCart(beautyFeatured.product) : navigateTo('beauty')}
                >
                  {content.home.beautyIntro.button}
                </button>
              </div>
              <div className="oilPlaceholder" style={imageStyle(beautyFeatured.imageUrl)} aria-label={`${beautyFeatured.title} product image`}>
                {beautyFeatured.hasLiveImage ? null : <span />}
              </div>
            </article>

            <div className="miniProducts">
              <a {...previewPathProps(['home', 'beautyIntro', 'miniProducts', 0], highlightedPath, 'miniProduct silkProduct')} style={imageStyle(beautyMiniProducts[0].imageUrl)} href="#beauty-catalog" onClick={openHomeProduct(beautyMiniProducts[0].product, 'beauty')} data-reveal="right">
                {beautyMiniProducts[0].hasLiveImage ? null : <span aria-hidden="true" />}
                <strong>{beautyMiniProducts[0].name}</strong>
                <em>{beautyMiniProducts[0].price}</em>
              </a>
              <a {...previewPathProps(['home', 'beautyIntro', 'miniProducts', 1], highlightedPath, 'miniProduct balmProduct')} style={imageStyle(beautyMiniProducts[1].imageUrl)} href="#beauty-catalog" onClick={openHomeProduct(beautyMiniProducts[1].product, 'beauty')} data-reveal="right">
                {beautyMiniProducts[1].hasLiveImage ? null : <span aria-hidden="true" />}
                <strong>{beautyMiniProducts[1].name}</strong>
                <em>{beautyMiniProducts[1].price}</em>
              </a>
            </div>
          </div>

          <div {...previewPathProps(['home', 'groceriesIntro'], highlightedPath, 'groceryEditorial')} id="groceries">
            <div
              {...previewPathProps(['home', 'groceriesIntro', 'imageUrl'], highlightedPath, 'groceryImages')}
              style={imageStyle(content.home.groceriesIntro.imageUrl)}
              aria-hidden="true"
              data-reveal="left"
            >
              <div className="fruitImage" />
              <div className="spiceImage" />
              <div className="marketImage" />
            </div>

            <div className="groceryCopy" data-reveal="right">
              <span>{content.home.groceriesIntro.eyebrow}</span>
              <h2>{content.home.groceriesIntro.title}</h2>
              <p>{content.home.groceriesIntro.description}</p>

              <ol>
                {content.home.groceriesIntro.items.map((item, index) => (
                  <li key={item}><span>{String(index + 1).padStart(2, '0')}</span>{item}</li>
                ))}
              </ol>

              <a href="#grocery-catalog" onClick={navigateTo('groceries')}>{content.home.groceriesIntro.button}</a>
            </div>
          </div>
        </section>

        <section {...previewPathProps(['home', 'babyIntro'], highlightedPath, 'littleOnesSection')} id="baby" aria-label="New for little ones">
          <div className="centeredHeading" data-reveal="up">
            <span>{content.home.babyIntro.eyebrow}</span>
            <h2>{content.home.babyIntro.title}</h2>
          </div>

          <div className="babyProductGrid">
            <article {...previewPathProps(['home', 'babyIntro', 'products', 0], highlightedPath, 'babyProductCard')} data-reveal="up">
              <div className="babyProductImage cottonSuitImage" style={imageStyle(babyProducts[0].imageUrl)} aria-hidden="true">
                {babyProducts[0].hasLiveImage ? null : <span />}
              </div>
              <h3>{babyProducts[0].name}</h3>
              <p>{babyProducts[0].description}</p>
              <strong>{babyProducts[0].price}</strong>
              <a href="#baby-catalog" onClick={openHomeProduct(babyProducts[0].product, 'baby')}>{babyProducts[0].button}</a>
            </article>

            <article {...previewPathProps(['home', 'babyIntro', 'products', 1], highlightedPath, 'babyProductCard')} data-reveal="up">
              <div className="babyProductImage blocksImage" style={imageStyle(babyProducts[1].imageUrl)} aria-hidden="true">
                {babyProducts[1].hasLiveImage ? null : (
                  <>
                    <span className="toyBear" />
                    <span className="toyStack leftStack" />
                    <span className="toyStack rightStack" />
                  </>
                )}
              </div>
              <h3>{babyProducts[1].name}</h3>
              <p>{babyProducts[1].description}</p>
              <strong>{babyProducts[1].price}</strong>
              <a href="#baby-catalog" onClick={openHomeProduct(babyProducts[1].product, 'baby')}>{babyProducts[1].button}</a>
            </article>

            <article {...previewPathProps(['home', 'babyIntro', 'products', 2], highlightedPath, 'babyProductCard')} data-reveal="up">
              <div className="babyProductImage dreamWashImage" style={imageStyle(babyProducts[2].imageUrl)} aria-hidden="true">
                {babyProducts[2].hasLiveImage ? null : (
                  <>
                    <span />
                    <span />
                    <span />
                  </>
                )}
              </div>
              <h3>{babyProducts[2].name}</h3>
              <p>{babyProducts[2].description}</p>
              <strong>{babyProducts[2].price}</strong>
              <a href="#baby-catalog" onClick={openHomeProduct(babyProducts[2].product, 'baby')}>{babyProducts[2].button}</a>
            </article>
          </div>
        </section>

        <section {...previewPathProps(['home', 'clothingIntro'], highlightedPath, 'capsuleWardrobe')} id="clothing" aria-label="The capsule wardrobe">
          <div className="capsuleCopy" data-reveal="left">
            <span>{content.home.clothingIntro.eyebrow}</span>
            <h2>{multilineText(content.home.clothingIntro.title)}</h2>
            <p>{content.home.clothingIntro.description}</p>
            <a href="#clothing-catalog" onClick={navigateTo('clothing')}>{content.home.clothingIntro.button}</a>
          </div>

          <div className="capsuleImage" style={imageStyle(content.home.clothingIntro.imageUrl)} aria-label="Capsule wardrobe fashion placeholder" data-reveal="right">
            <span className="modelHead" />
            <span className="modelBody" />
            <span className="modelPants" />
          </div>
        </section>
          </>
        )}

        <section {...previewPathProps(['home', 'newsletter'], highlightedPath, 'newsletterSection')} aria-label="Newsletter signup" data-reveal="up">
          <h2>{content.home.newsletter.title}</h2>
          <p>{content.home.newsletter.description}</p>

          <form className="subscribeForm">
            <label>
              <span>{content.home.newsletter.placeholder}</span>
              <input type="email" placeholder={content.home.newsletter.placeholder} />
            </label>
            <button type="submit">{content.home.newsletter.button}</button>
          </form>

          <small>{content.home.newsletter.small}</small>
        </section>

        <footer className="siteFooter">
          <div {...previewPathProps(['site'], highlightedPath, 'footerBrand')} data-reveal="up">
            <a href="/">{content.site.brand}</a>
            <p>{content.site.footerTagline}</p>
          </div>

          <nav aria-label="Footer collections" data-reveal="up">
            <h3>Collections</h3>
            <a href="#beauty-catalog" onClick={navigateTo('beauty')}>Beauty</a>
            <a href="#grocery-catalog" onClick={navigateTo('groceries')}>Groceries</a>
            <a href="#baby-catalog" onClick={navigateTo('baby')}>Baby</a>
            <a href="#clothing-catalog" onClick={navigateTo('clothing')}>Clothing</a>
          </nav>

          <nav aria-label="Footer information" data-reveal="up">
            <h3>Information</h3>
            <a href="#about">About Us</a>
            <a href="#shipping">Shipping &amp; Returns</a>
            <a href="#privacy">Privacy Policy</a>
            <a href="#contact">Contact</a>
          </nav>

          <nav aria-label="Footer social links" data-reveal="up">
            <h3>Connect</h3>
            <a href="https://www.instagram.com/zelis.shop/" target="_blank" rel="noreferrer">Instagram</a>
          </nav>

          <div className="footerBottom">
            <p>{content.site.copyright}</p>
            <div className="paymentMarks" aria-label="Payment methods">
              <span />
              <span />
            </div>
          </div>
        </footer>

        {isCartOpen ? (
          <aside className="cartDrawer" aria-label="Shopping cart">
            <div className="cartDrawerHeader">
              <h2>Cart</h2>
              <button type="button" onClick={() => setIsCartOpen(false)} aria-label="Close cart">x</button>
            </div>
            {cartItems.length ? (
              <div className="cartItems">
                {cartItems.map((item) => (
                  <article className="cartItem" key={item.squareVariationId}>
                    <div className="cartItemImage" style={imageStyle(item.imageUrl)} aria-hidden="true" />
                    <div>
                      <h3>{item.name}</h3>
                      <p>{item.price}</p>
                      <div className="cartQuantity">
                        <button type="button" onClick={() => updateCartQuantity(item.squareVariationId, item.quantity - 1)}>-</button>
                        <span>{item.quantity}</span>
                        <button type="button" onClick={() => updateCartQuantity(item.squareVariationId, item.quantity + 1)}>+</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="cartEmpty">Your cart is empty.</p>
            )}
            <fieldset className="cartFulfillment" disabled={isCheckingOut || !cartItems.length}>
              <legend>Fulfillment</legend>
              <label>
                <input
                  type="radio"
                  name="fulfillmentType"
                  value="delivery"
                  checked={fulfillmentType === 'delivery'}
                  onChange={() => setFulfillmentType('delivery')}
                />
                <span>Delivery</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="fulfillmentType"
                  value="pickup"
                  checked={fulfillmentType === 'pickup'}
                  onChange={() => setFulfillmentType('pickup')}
                />
                <span>Self pickup</span>
              </label>
            </fieldset>
            {checkoutError ? <p className="cartError">{checkoutError}</p> : null}
            <div className="cartActions">
              <button className="checkoutButton" type="button" disabled={!cartItems.length || isCheckingOut} onClick={checkoutCart}>
                {isCheckingOut ? 'Opening Checkout...' : 'Checkout with Square'}
              </button>
              <button className="cancelCheckoutButton" type="button" onClick={cancelCheckout}>
                Cancel
              </button>
            </div>
          </aside>
        ) : null}

        <button className="floatingCartButton" type="button" aria-label={`Checkout cart with ${cartCount} items`} onClick={() => setIsCartOpen(true)}>
          <span className="floatingCartIcon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M7 8h10l-.8 11H7.8L7 8Z" />
              <path d="M9 8a3 3 0 0 1 6 0" />
            </svg>
          </span>
          <span className="cartButtonText">Cart</span>
          <span className="cartCount" aria-hidden="true">{cartCount}</span>
        </button>
      </section>
    </main>
  );
}

function updateAtPath(source, path, value) {
  const next = JSON.parse(JSON.stringify(source));
  let cursor = next;
  path.slice(0, -1).forEach((part) => {
    cursor = cursor[part];
  });
  cursor[path[path.length - 1]] = value;
  return next;
}

function labelFromKey(key) {
  return String(key)
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function imageSizeHint(path) {
  const pathString = pathKey(path);

  if (pathString === 'hero.imageUrl') {
    return 'recommended 1800 x 1300px';
  }

  if (pathString.startsWith('home.categories.')) {
    return 'recommended 900 x 1200px';
  }

  if (pathString.startsWith('home.partners.')) {
    return 'recommended 600 x 220px';
  }

  if (pathString === 'home.beautyIntro.imageUrl') {
    return 'recommended 900 x 900px';
  }

  if (pathString.startsWith('home.beautyIntro.miniProducts.')) {
    return 'recommended 700 x 700px';
  }

  if (pathString === 'home.groceriesIntro.imageUrl') {
    return 'recommended 900 x 700px';
  }

  if (pathString.startsWith('home.babyIntro.products.')) {
    return 'recommended 900 x 900px';
  }

  if (pathString === 'home.clothingIntro.imageUrl') {
    return 'recommended 1200 x 900px';
  }

  if (pathString === 'catalogs.groceries.heroImageUrl') {
    return 'recommended 1200 x 520px';
  }

  if (pathString.includes('.products.') || pathString.includes('.miniProducts.')) {
    return 'recommended 900 x 900px';
  }

  if (pathString.includes('heroImageUrl')) {
    return 'recommended 1200 x 650px';
  }

  return 'recommended 1200 x 900px';
}

function imageTargetSize(path) {
  const hint = imageSizeHint(path);
  const match = hint.match(/(\d+)\s*x\s*(\d+)px/i);

  return match
    ? { width: Number(match[1]), height: Number(match[2]) }
    : { width: 1200, height: 900 };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Unable to prepare image upload.'));
      }
    }, type, quality);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',').pop() : result);
    });
    reader.addEventListener('error', () => reject(new Error('Unable to prepare image upload.')));
    reader.readAsDataURL(blob);
  });
}

async function prepareImageForUpload(file, path) {
  const target = imageTargetSize(path);
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, target.width / bitmap.width, target.height / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to prepare image upload.');
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const outputType = file.type === 'image/png' && file.size < 800000
    ? 'image/png'
    : 'image/jpeg';
  const blob = await canvasToBlob(canvas, outputType, 0.82);
  const dataBase64 = await blobToBase64(blob);

  return {
    fileName: file.name.replace(/\.[^.]+$/, outputType === 'image/jpeg' ? '.jpg' : '.png'),
    contentType: outputType,
    dataBase64,
  };
}

function ContentEditor({ value, path = [], onChange, onFocus, onUploadImage, uploadingPath = '' }) {
  if (Array.isArray(value)) {
    return (
      <div className="adminGroup">
        {value.map((item, index) => (
          <details className="adminDetails" key={`${path.join('.')}-${index}`} open={index === 0}>
            <summary>{item?.name || item?.title || `Item ${index + 1}`}</summary>
            <ContentEditor
              value={item}
              path={[...path, index]}
              onChange={onChange}
              onFocus={onFocus}
              onUploadImage={onUploadImage}
              uploadingPath={uploadingPath}
            />
          </details>
        ))}
      </div>
    );
  }

  if (value && typeof value === 'object') {
    return (
      <div className="adminGroup">
        {Object.entries(value).map(([key, childValue]) => {
          if (key === 'imageClass') {
            return null;
          }

          if (childValue && typeof childValue === 'object') {
            return (
              <details className="adminDetails" key={[...path, key].join('.')} open={path.length < 1}>
                <summary>{labelFromKey(key)}</summary>
                <ContentEditor
                  value={childValue}
                  path={[...path, key]}
                  onChange={onChange}
                  onFocus={onFocus}
                  onUploadImage={onUploadImage}
                  uploadingPath={uploadingPath}
                />
              </details>
            );
          }

          const fieldPath = [...path, key];
          const fieldPathKey = pathKey(fieldPath);
          const isImage = key.toLowerCase().includes('imageurl');
          const isLong = typeof childValue === 'string' && childValue.length > 72;
          const label = isImage
            ? `${labelFromKey(key)} (${imageSizeHint(fieldPath)})`
            : labelFromKey(key);

          return (
            <div className="adminField" key={fieldPath.join('.')}>
              <span>{label}</span>
              {isImage ? (
                <div className="adminImageField">
                  <input
                    type="url"
                    value={childValue ?? ''}
                    placeholder="Upload an image or paste a URL"
                    onFocus={() => onFocus(fieldPath)}
                    onChange={(event) => onChange(fieldPath, event.target.value)}
                  />
                  <label className="adminUploadButton">
                    {uploadingPath === fieldPathKey ? 'Uploading...' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingPath === fieldPathKey}
                      onFocus={() => onFocus(fieldPath)}
                      onChange={(event) => onUploadImage(fieldPath, event.target.files?.[0], event)}
                    />
                  </label>
                </div>
              ) : isLong ? (
                <textarea
                  value={childValue ?? ''}
                  rows={4}
                  onFocus={() => onFocus(fieldPath)}
                  onChange={(event) => onChange(fieldPath, event.target.value)}
                />
              ) : (
                <input
                  type="text"
                  value={childValue ?? ''}
                  onFocus={() => onFocus(fieldPath)}
                  onChange={(event) => onChange(fieldPath, event.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}

function AdminPage({ content, setContent, previewContent = content }) {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [token, setToken] = useState(() => window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '');
  const [adminView, setAdminView] = useState('dashboard');
  const [error, setError] = useState('');
  const [selectedPath, setSelectedPath] = useState('');
  const [uploadingPath, setUploadingPath] = useState('');

  const expireAdminSession = () => {
    setToken('');
    setAdminView('dashboard');
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    setError('Admin session expired. Please login again.');
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.token);
        setAdminView('dashboard');
        window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, data.token);
        setError('');
        return;
      }
    } catch {
      setError('Admin API is unavailable. Start the backend server and try again.');
      return;
    }

    setError('Invalid username or password.');
  };

  const handleContentChange = async (path, value) => {
    const nextContent = updateAtPath(content, path, value);
    setContent(nextContent);
    window.localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(nextContent));

    if (token) {
      try {
        const response = await fetch('/api/content', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(nextContent),
        });

        if (response.status === 401) {
          expireAdminSession();
          return;
        }

        if (!response.ok) {
          setError('Content changed locally, but database save failed.');
        }
      } catch {
        setError('Content changed locally, but database save failed.');
      }
    }
  };

  const resetContent = async () => {
    setContent(defaultContent);
    window.localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(defaultContent));

    if (token) {
      try {
        const response = await fetch('/api/content', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(defaultContent),
        });

        if (response.status === 401) {
          expireAdminSession();
        }
      } catch {
        setError('Content reset locally, but database save failed.');
      }
    }
  };

  const uploadImage = async (path, file, event) => {
    if (!file) {
      return;
    }

    const targetPath = pathKey(path);
    setSelectedPath(targetPath);
    setUploadingPath(targetPath);
    setError('');

    try {
      const uploadPayload = await prepareImageForUpload(file, path);
      const response = await fetch('/api/admin/upload-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: uploadPayload.fileName,
          contentType: uploadPayload.contentType,
          dataBase64: uploadPayload.dataBase64,
          contentPath: targetPath,
        }),
      });
      const data = await response.json();

      if (response.status === 401) {
        expireAdminSession();
        return;
      }

      if (!response.ok || !data.imageUrl) {
        throw new Error(data.error || 'Image upload failed. Check DigitalOcean Spaces credentials.');
      }

      await handleContentChange(path, data.imageUrl);
    } catch (uploadError) {
      setError(uploadError.message || 'Image upload failed.');
    } finally {
      setUploadingPath('');
      if (event?.target) {
        event.target.value = '';
      }
    }
  };

  if (!token) {
    return (
      <main className="adminLoginPage">
        <form className="adminLoginCard" onSubmit={handleLogin}>
          <a className="brand" href="/">Zelis Shop</a>
          <h1>Admin Login</h1>
          <label>
            <span>Username</span>
            <input
              value={credentials.username}
              onChange={(event) => setCredentials({ ...credentials, username: event.target.value })}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={credentials.password}
              onChange={(event) => setCredentials({ ...credentials, password: event.target.value })}
            />
          </label>
          {error ? <p className="adminError">{error}</p> : null}
          <button type="submit">Login</button>
        </form>
      </main>
    );
  }

  if (adminView === 'dashboard') {
    return (
      <main className="adminDashboard">
        <header className="adminDashboardTop">
          <div>
            <a className="brand" href="/">Zelis Shop</a>
            <span>Admin Dashboard</span>
          </div>
          <nav aria-label="Admin quick actions">
            <a href="/">Open Website</a>
            <button type="button" onClick={() => setAdminView('editor')}>Edit Website</button>
          </nav>
        </header>

        {error ? <p className="adminError">{error}</p> : null}

        <section className="adminDashboardGrid" aria-label="Website dashboard">
          <article className="adminDashboardPrimary">
            <span>Website Content</span>
            <h1>Manage storefront content</h1>
            <p>Update homepage copy, partner logos, category imagery, catalogue sections, and uploaded media from the website editor.</p>
            <button type="button" onClick={() => setAdminView('editor')}>Edit Website</button>
          </article>

          <div className="adminDashboardStats" aria-label="Website status">
            <article>
              <span>Sections</span>
              <strong>{Object.keys(content.home || {}).length}</strong>
              <p>Homepage content groups</p>
            </article>
            <article>
              <span>Partners</span>
              <strong>{content.home?.partners?.length || 0}</strong>
              <p>Logo slots ready</p>
            </article>
            <article>
              <span>Checkout</span>
              <strong>Square</strong>
              <p>Delivery and pickup enabled</p>
            </article>
          </div>
        </section>

        <section className="adminDashboardCards" aria-label="Admin tools">
          <article>
            <span>01</span>
            <strong>Website Editor</strong>
            <p>Open the live preview editor to change text and images.</p>
            <button type="button" onClick={() => setAdminView('editor')}>Open Editor</button>
          </article>
          <article>
            <span>02</span>
            <strong>Image Uploads</strong>
            <p>Images upload to Spaces CDN and are stored against their content path.</p>
            <button type="button" onClick={() => setAdminView('editor')}>Manage Images</button>
          </article>
          <article>
            <span>03</span>
            <strong>Storefront</strong>
            <p>Review the live customer-facing website in a separate tab.</p>
            <a href="/">View Website</a>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="adminShell">
      <aside className="adminPanel">
        <div className="adminPanelHeader">
          <div>
            <h1>Content Admin</h1>
            <p>Edit copy and upload images. Changes save to the website content database.</p>
            {selectedPath ? <small>Selected: {selectedPath}</small> : null}
            {error ? <p className="adminError">{error}</p> : null}
          </div>
          <div className="adminPanelActions">
            <button type="button" onClick={() => setAdminView('dashboard')}>Back to Dashboard</button>
            <button type="button" onClick={resetContent}>Reset</button>
          </div>
        </div>
        <ContentEditor
          value={content}
          onChange={handleContentChange}
          onFocus={(path) => setSelectedPath(pathKey(path))}
          onUploadImage={uploadImage}
          uploadingPath={uploadingPath}
        />
      </aside>

      <section className="adminPreview">
        <div className="adminPreviewTop">
          <strong>Live Preview</strong>
          <a href="/">Open site</a>
        </div>
        <div className="adminPreviewFrame">
          <Storefront content={previewContent} preview highlightedPath={selectedPath} />
        </div>
      </section>
    </main>
  );
}

function App() {
  const [content, setContent] = useState(getInitialContent);
  const isAdminPage = window.location.pathname === '/admin';

  useEffect(() => {
    fetchContent()
      .then((loadedContent) => {
        setContent(loadedContent);
        window.localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(loadedContent));
      })
      .catch(() => {
        setContent(getInitialContent());
      });
  }, []);

  return isAdminPage ? (
    <AdminPage content={content} setContent={setContent} previewContent={content} />
  ) : (
    <Storefront content={content} />
  );
}

createRoot(document.getElementById('root')).render(<App />);
