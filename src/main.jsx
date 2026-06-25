import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import defaultContent from './data/content.json';
import './styles.css';

const CONTENT_STORAGE_KEY = 'zelis_shop_content';
const ADMIN_USER = 'admin';
const ADMIN_PASSWORD = '12345678';

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

function BeautyCatalog({ content, highlightedPath = '' }) {
  const beauty = content.catalogs.beauty;
  return (
    <section className="catalogPageSection" aria-label="Beauty product catalogue">
      <div {...previewPathProps(['catalogs', 'beauty'], highlightedPath, 'catalogHeroHeader')}>
        <div>
          <h1 {...previewPathProps(['catalogs', 'beauty', 'title'], highlightedPath)}>{beauty.title}</h1>
          <p {...previewPathProps(['catalogs', 'beauty', 'description'], highlightedPath)}>{beauty.description}</p>
        </div>
        <span {...previewPathProps(['catalogs', 'beauty', 'volume'], highlightedPath)}>{beauty.volume}</span>
      </div>

      <div className="beautyCatalog" id="beauty-catalog">
        <aside className="catalogFilters" aria-label="Beauty catalog filters">
          <div className="filterGroup">
            <h3>Categories</h3>
            <a href="#skincare"><span>Skincare</span><em>31</em></a>
            <a className="active" href="#makeup"><span>Makeup</span><em>18</em></a>
            <a href="#fragrance"><span>Fragrance</span><em>09</em></a>
            <a href="#wellness"><span>Wellness</span><em>05</em></a>
          </div>

          <div className="filterGroup">
            <h3>Skin Type</h3>
            <label><input type="checkbox" /> Sensitive</label>
            <label><input type="checkbox" defaultChecked /> Dry &amp; Dehydrated</label>
            <label><input type="checkbox" /> Oily / Combination</label>
          </div>

          <div className="filterGroup">
            <h3>Price Range</h3>
            <div className="rangeTrack" aria-hidden="true"><span /></div>
            <div className="rangeLabels"><span>$0</span><span>$200+</span></div>
          </div>
        </aside>

        <div className="catalogMain">
          <div className="catalogToolbar">
            <p {...previewPathProps(['catalogs', 'beauty', 'showing'], highlightedPath)}>{beauty.showing}</p>
            <button type="button">Sort By</button>
          </div>

          <div className="catalogGrid">
            {beauty.products.map((product, index) => (
              <article {...previewPathProps(['catalogs', 'beauty', 'products', index], highlightedPath, 'catalogProductCard')} key={product.name}>
                <div className={`catalogProductImage ${product.imageClass}`} style={imageStyle(product.imageUrl)} aria-hidden="true">
                  {product.badge ? <span className="catalogBadge">{product.badge}</span> : null}
                  <i />
                </div>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <strong>{product.price}</strong>
              </article>
            ))}
          </div>

          <nav className="catalogPagination" aria-label="Beauty catalog pagination">
            <button type="button" aria-label="Previous page">{'<'}</button>
            <a className="active" href="#page-1">01</a>
            <a href="#page-2">02</a>
            <a href="#page-3">03</a>
            <a href="#page-4">04</a>
            <button type="button" aria-label="Next page">{'>'}</button>
          </nav>
        </div>
      </div>
    </section>
  );
}

function ClothingCatalog({ content, highlightedPath = '' }) {
  const clothing = content.catalogs.clothing;
  return (
    <section className="clothingCatalogPage" aria-label="Clothing product catalogue">
      <div className="clothingHero">
        <div {...previewPathProps(['catalogs', 'clothing'], highlightedPath, 'clothingHeroCopy')}>
          <span {...previewPathProps(['catalogs', 'clothing', 'eyebrow'], highlightedPath)}>{clothing.eyebrow}</span>
          <h1 {...previewPathProps(['catalogs', 'clothing', 'title'], highlightedPath)}>{clothing.title}</h1>
          <p {...previewPathProps(['catalogs', 'clothing', 'description'], highlightedPath)}>{clothing.description}</p>
          <a {...previewPathProps(['catalogs', 'clothing', 'button'], highlightedPath)} href="#clothing-grid">{clothing.button}</a>
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
        <aside className="clothingFilters" aria-label="Clothing catalogue filters">
          <div className="filterGroup">
            <h3>Collections</h3>
            <a className="active" href="#modern-classics"><span>Modern Classics</span><em>16</em></a>
            <a href="#silk-series"><span>The Silk Series</span><em>09</em></a>
            <a href="#linen-living"><span>Linen Living</span><em>12</em></a>
            <a href="#winter-knits"><span>Winter Knits</span><em>07</em></a>
          </div>

          <div className="filterGroup">
            <h3>Fabrics</h3>
            <label><input type="checkbox" /> Silk</label>
            <label><input type="checkbox" /> Linen</label>
            <label><input type="checkbox" /> Wool</label>
            <label><input type="checkbox" /> Cashmere</label>
          </div>

          <div className="filterGroup">
            <h3>Size</h3>
            <div className="sizeGrid">
              <button type="button">XS</button>
              <button type="button">S</button>
              <button className="active" type="button">M</button>
              <button type="button">L</button>
            </div>
          </div>

          <article className="clothingNote">
            <h4>Complete Your Set</h4>
            <p>Save 10% when you pair trousers and knitwear from the same capsule.</p>
            <a href="#sets">Learn More</a>
          </article>
        </aside>

        <div className="clothingCatalogMain">
          <div className="clothingToolbar">
            <p>Showing 1-6 of 48 items</p>
            <button type="button">Sort By <strong>Featured</strong></button>
          </div>

          <div className="clothingGrid" id="clothing-grid">
            {clothing.products.map((product, index) => (
              <article {...previewPathProps(['catalogs', 'clothing', 'products', index], highlightedPath, 'clothingProductCard')} key={product.name}>
                <div className={`clothingProductImage ${product.imageClass}`} style={imageStyle(product.imageUrl)} aria-hidden="true">
                  {product.badge ? <span>{product.badge}</span> : null}
                  <i />
                </div>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <strong>{product.price}</strong>
              </article>
            ))}
          </div>

          <nav className="clothingPagination" aria-label="Clothing catalogue pagination">
            <button type="button" aria-label="Previous page">{'<'}</button>
            <a className="active" href="#clothing-page-1">1</a>
            <a href="#clothing-page-2">2</a>
            <a href="#clothing-page-3">3</a>
            <span>...</span>
            <a href="#clothing-page-8">8</a>
            <button type="button" aria-label="Next page">{'>'}</button>
          </nav>
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

function BabyCatalog({ content, highlightedPath = '' }) {
  const baby = content.catalogs.baby;
  return (
    <section className="catalogPageSection babyCatalogPage" aria-label="Baby product catalogue">
      <div className="babyCatalogHeader">
        <div>
          <span {...previewPathProps(['catalogs', 'baby', 'eyebrow'], highlightedPath)}>{baby.eyebrow}</span>
          <h1 {...previewPathProps(['catalogs', 'baby', 'title'], highlightedPath)}>{baby.title}</h1>
          <p {...previewPathProps(['catalogs', 'baby', 'description'], highlightedPath)}>{baby.description}</p>
        </div>

        <div className="babyCatalogActions">
          <button type="button">Filter Results</button>
          <button type="button">Sort By: Newest</button>
        </div>
      </div>

      <div className="babyCatalog" id="baby-catalog">
        <aside className="babyCatalogFilters" aria-label="Baby catalogue filters">
          <div className="filterGroup">
            <h3>Category</h3>
            <label><input type="checkbox" defaultChecked /> Nursery Bedding</label>
            <label><input type="checkbox" /> Heirloom Toys</label>
            <label><input type="checkbox" /> Skin &amp; Bath</label>
            <label><input type="checkbox" /> Newborn Sets</label>
          </div>

          <div className="filterGroup">
            <h3>Material</h3>
            <label><input type="checkbox" /> Organic Cotton</label>
            <label><input type="checkbox" /> Bamboo Linen</label>
            <label><input type="checkbox" /> Sustainable Wood</label>
            <label><input type="checkbox" /> Cashmere Blend</label>
          </div>

          <div className="filterGroup">
            <h3>Age Range</h3>
            <label><input type="checkbox" /> Newborn (0-3m)</label>
            <label><input type="checkbox" /> Infant (3-12m)</label>
            <label><input type="checkbox" /> Toddler (1-3y)</label>
          </div>

          <article className="babyPromoCard">
            <span>Limited Edition</span>
            <h4>The Blush Edit</h4>
            <p>Explore seasonal softness.</p>
          </article>
        </aside>

        <div className="babyCatalogMain">
          <div className="babyCatalogGrid">
            {baby.products.map((product, index) => (
              <article {...previewPathProps(['catalogs', 'baby', 'products', index], highlightedPath, 'babyCatalogProduct')} key={product.name}>
                <div className={`babyCatalogImage ${product.imageClass}`} style={imageStyle(product.imageUrl)} aria-hidden="true">
                  {product.badge ? <span>{product.badge}</span> : null}
                  <i />
                </div>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <strong>{product.price}</strong>
              </article>
            ))}
          </div>

          <nav className="babyPagination" aria-label="Baby catalogue pagination">
            <button type="button" aria-label="Previous page">{'<'}</button>
            <a className="active" href="#baby-page-1">1</a>
            <a href="#baby-page-2">2</a>
            <a href="#baby-page-3">3</a>
            <button type="button" aria-label="Next page">{'>'}</button>
          </nav>
        </div>
      </div>
    </section>
  );
}

function GroceryCatalog({ content, highlightedPath = '' }) {
  const groceries = content.catalogs.groceries;
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
        <aside className="groceryCatalogFilters" aria-label="Groceries catalogue filters">
          <div className="filterGroup">
            <h3>Categories</h3>
            <a className="active" href="#pantry-staples"><span>Pantry Staples</span><em>12</em></a>
            <a href="#fresh-produce"><span>Fresh Produce</span><em>18</em></a>
            <a href="#spices-pastes"><span>Spices &amp; Pastes</span><em>21</em></a>
            <a href="#organic-snacks"><span>Organic Snacks</span><em>08</em></a>
          </div>

          <div className="filterGroup">
            <h3>Dietary</h3>
            <div className="dietaryTags">
              <button type="button">Halal</button>
              <button type="button">Vegan</button>
              <button className="active" type="button">Organic</button>
            </div>
          </div>

          <blockquote>
            We partner with 16 independent Malaysian farms to bring you heritage crops that are pesticide-free and fairly traded.
          </blockquote>
        </aside>

        <div className="groceryCatalogMain">
          <div className="groceryCatalogGrid">
            {groceries.products.map((product, index) => (
              <article {...previewPathProps(['catalogs', 'groceries', 'products', index], highlightedPath, 'groceryProductCard')} key={product.name}>
                <div className={`groceryProductImage ${product.imageClass}`} style={imageStyle(product.imageUrl)} aria-hidden="true">
                  {product.badge ? <span>{product.badge}</span> : null}
                  <i />
                </div>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <strong>{product.price}</strong>
              </article>
            ))}
          </div>

          <a className="groceryMoreButton" href="#more-staples">EXPLORE MORE STAPLES</a>
        </div>
      </div>
    </section>
  );
}

function Storefront({ content, preview = false, highlightedPath = '' }) {
  const [activePage, setActivePage] = useState('home');

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

          <div className="navActions" aria-label="Shop actions">
            <Icon label="Search">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.2" />
                <path d="m16 16 4 4" />
              </svg>
            </Icon>
            <Icon label="Cart">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 8h10l-.8 11H7.8L7 8Z" />
                <path d="M9 8a3 3 0 0 1 6 0" />
              </svg>
            </Icon>
            <Icon label="Account">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="3" />
                <path d="M6.5 20a5.5 5.5 0 0 1 11 0" />
              </svg>
            </Icon>
          </div>
        </header>

        {activePage === 'beauty' ? (
          <BeautyCatalog content={content} highlightedPath={highlightedPath} />
        ) : activePage === 'groceries' ? (
          <GroceryCatalog content={content} highlightedPath={highlightedPath} />
        ) : activePage === 'baby' ? (
          <BabyCatalog content={content} highlightedPath={highlightedPath} />
        ) : activePage === 'clothing' ? (
          <ClothingCatalog content={content} highlightedPath={highlightedPath} />
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
          <div className="partnerPlaceholder">{content.home.partnerLogosText}</div>
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
                <h3>{multilineText(content.home.beautyIntro.productTitle)}</h3>
                <p>{content.home.beautyIntro.description}</p>
                <strong>{content.home.beautyIntro.price}</strong>
                <button type="button" onClick={navigateTo('beauty')}>{content.home.beautyIntro.button}</button>
              </div>
              <div className="oilPlaceholder" style={imageStyle(content.home.beautyIntro.imageUrl)} aria-label="Botanical radiance oil product placeholder">
                <span />
              </div>
            </article>

            <div className="miniProducts">
              <a {...previewPathProps(['home', 'beautyIntro', 'miniProducts', 0], highlightedPath, 'miniProduct silkProduct')} style={imageStyle(content.home.beautyIntro.miniProducts[0].imageUrl)} href="#beauty-catalog" onClick={navigateTo('beauty')} data-reveal="right">
                <span aria-hidden="true" />
                <strong>{content.home.beautyIntro.miniProducts[0].name}</strong>
                <em>{content.home.beautyIntro.miniProducts[0].price}</em>
              </a>
              <a {...previewPathProps(['home', 'beautyIntro', 'miniProducts', 1], highlightedPath, 'miniProduct balmProduct')} style={imageStyle(content.home.beautyIntro.miniProducts[1].imageUrl)} href="#beauty-catalog" onClick={navigateTo('beauty')} data-reveal="right">
                <span aria-hidden="true" />
                <strong>{content.home.beautyIntro.miniProducts[1].name}</strong>
                <em>{content.home.beautyIntro.miniProducts[1].price}</em>
              </a>
            </div>
          </div>

          <div {...previewPathProps(['home', 'groceriesIntro'], highlightedPath, 'groceryEditorial')} id="groceries">
            <div className="groceryImages" aria-hidden="true" data-reveal="left">
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
              <div className="babyProductImage cottonSuitImage" style={imageStyle(content.home.babyIntro.products[0].imageUrl)} aria-hidden="true">
                <span />
              </div>
              <h3>{content.home.babyIntro.products[0].name}</h3>
              <p>{content.home.babyIntro.products[0].description}</p>
              <strong>{content.home.babyIntro.products[0].price}</strong>
              <a href="#baby-catalog" onClick={navigateTo('baby')}>{content.home.babyIntro.products[0].button}</a>
            </article>

            <article {...previewPathProps(['home', 'babyIntro', 'products', 1], highlightedPath, 'babyProductCard')} data-reveal="up">
              <div className="babyProductImage blocksImage" style={imageStyle(content.home.babyIntro.products[1].imageUrl)} aria-hidden="true">
                <span className="toyBear" />
                <span className="toyStack leftStack" />
                <span className="toyStack rightStack" />
              </div>
              <h3>{content.home.babyIntro.products[1].name}</h3>
              <p>{content.home.babyIntro.products[1].description}</p>
              <strong>{content.home.babyIntro.products[1].price}</strong>
              <a href="#baby-catalog" onClick={navigateTo('baby')}>{content.home.babyIntro.products[1].button}</a>
            </article>

            <article {...previewPathProps(['home', 'babyIntro', 'products', 2], highlightedPath, 'babyProductCard')} data-reveal="up">
              <div className="babyProductImage dreamWashImage" style={imageStyle(content.home.babyIntro.products[2].imageUrl)} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <h3>{content.home.babyIntro.products[2].name}</h3>
              <p>{content.home.babyIntro.products[2].description}</p>
              <strong>{content.home.babyIntro.products[2].price}</strong>
              <a href="#baby-catalog" onClick={navigateTo('baby')}>{content.home.babyIntro.products[2].button}</a>
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
            <a href="#instagram">Instagram</a>
            <a href="#pinterest">Pinterest</a>
            <a href="#tiktok">TikTok</a>
            <a href="#store-locator">Store Locator</a>
          </nav>

          <div className="footerBottom">
            <p>{content.site.copyright}</p>
            <div className="paymentMarks" aria-label="Payment methods">
              <span />
              <span />
            </div>
          </div>
        </footer>

        <button className="floatingCartButton" type="button" aria-label="Checkout cart with 3 items">
          <span className="floatingCartIcon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M7 8h10l-.8 11H7.8L7 8Z" />
              <path d="M9 8a3 3 0 0 1 6 0" />
            </svg>
          </span>
          <span className="cartButtonText">Cart</span>
          <span className="cartCount" aria-hidden="true">3</span>
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

function ContentEditor({ value, path = [], onChange, onFocus }) {
  if (Array.isArray(value)) {
    return (
      <div className="adminGroup">
        {value.map((item, index) => (
          <details className="adminDetails" key={`${path.join('.')}-${index}`} open={index === 0}>
            <summary>{item?.name || item?.title || `Item ${index + 1}`}</summary>
            <ContentEditor value={item} path={[...path, index]} onChange={onChange} onFocus={onFocus} />
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
                <ContentEditor value={childValue} path={[...path, key]} onChange={onChange} onFocus={onFocus} />
              </details>
            );
          }

          const fieldPath = [...path, key];
          const isImage = key.toLowerCase().includes('imageurl');
          const isLong = typeof childValue === 'string' && childValue.length > 72;

          return (
            <label className="adminField" key={fieldPath.join('.')}>
              <span>{labelFromKey(key)}</span>
              {isLong ? (
                <textarea
                  value={childValue ?? ''}
                  rows={4}
                  onFocus={() => onFocus(fieldPath)}
                  onChange={(event) => onChange(fieldPath, event.target.value)}
                />
              ) : (
                <input
                  type={isImage ? 'url' : 'text'}
                  value={childValue ?? ''}
                  placeholder={isImage ? 'https://example.com/image.jpg' : ''}
                  onFocus={() => onFocus(fieldPath)}
                  onChange={(event) => onChange(fieldPath, event.target.value)}
                />
              )}
            </label>
          );
        })}
      </div>
    );
  }

  return null;
}

function AdminPage({ content, setContent }) {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [isAuthed, setIsAuthed] = useState(false);
  const [error, setError] = useState('');
  const [selectedPath, setSelectedPath] = useState('');

  const handleLogin = (event) => {
    event.preventDefault();
    if (credentials.username === ADMIN_USER && credentials.password === ADMIN_PASSWORD) {
      setIsAuthed(true);
      setError('');
      return;
    }
    setError('Invalid username or password.');
  };

  const handleContentChange = (path, value) => {
    const nextContent = updateAtPath(content, path, value);
    setContent(nextContent);
    window.localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(nextContent));
  };

  const resetContent = () => {
    setContent(defaultContent);
    window.localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(defaultContent));
  };

  if (!isAuthed) {
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

  return (
    <main className="adminShell">
      <aside className="adminPanel">
        <div className="adminPanelHeader">
          <div>
            <h1>Content Admin</h1>
            <p>Edit copy and image URLs. Changes save to this browser.</p>
            {selectedPath ? <small>Selected: {selectedPath}</small> : null}
          </div>
          <button type="button" onClick={resetContent}>Reset</button>
        </div>
        <ContentEditor value={content} onChange={handleContentChange} onFocus={(path) => setSelectedPath(pathKey(path))} />
      </aside>

      <section className="adminPreview">
        <div className="adminPreviewTop">
          <strong>Live Preview</strong>
          <a href="/">Open site</a>
        </div>
        <div className="adminPreviewFrame">
          <Storefront content={content} preview highlightedPath={selectedPath} />
        </div>
      </section>
    </main>
  );
}

function App() {
  const [content, setContent] = useState(getInitialContent);
  const isAdminPage = window.location.pathname === '/admin';

  return isAdminPage ? (
    <AdminPage content={content} setContent={setContent} />
  ) : (
    <Storefront content={content} />
  );
}

createRoot(document.getElementById('root')).render(<App />);
