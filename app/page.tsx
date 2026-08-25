'use client';

import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { useMemo, useState } from 'react';

type Product = {
  id: number;
  name: string;
  image: string;
  review: string;
  performance: 'Excellent' | 'Good' | 'Bad';
  views: number;
  sales: number;
  score: number;
  stock: number;
  price: string;
  category: string;
  sku: string;
  material: string;
  visible: boolean;
};

type SortMode = 'name' | 'stock' | 'performance' | 'price';

const initialProducts: Product[] = [
  {
    id: 1,
    name: '4 Tier Shelving',
    image: 'shelf',
    review: '4,5',
    performance: 'Excellent',
    views: 994,
    sales: 12400,
    score: 88,
    stock: 92,
    price: 'Custom',
    category: 'Desk Setup',
    sku: 'STR-SHEL-2001',
    material: 'Wood & Steel',
    visible: true,
  },
  {
    id: 2,
    name: 'Insence Holder',
    image: 'holder',
    review: '4,5',
    performance: 'Good',
    views: 123,
    sales: 12400,
    score: 61,
    stock: 594,
    price: '66.00 USD',
    category: 'Decoration Lamp',
    sku: 'STR-INCN-4B11',
    material: 'Steel',
    visible: true,
  },
  {
    id: 3,
    name: 'Ashtray',
    image: 'ashtray',
    review: '4,5',
    performance: 'Good',
    views: 637,
    sales: 12400,
    score: 78,
    stock: 362,
    price: '81.00 USD',
    category: 'Desk Setup',
    sku: 'STR-ASH-7841',
    material: 'Ceramic',
    visible: false,
  },
  {
    id: 4,
    name: 'Coffee Table',
    image: 'table',
    review: '4,5',
    performance: 'Excellent',
    views: 148,
    sales: 12400,
    score: 86,
    stock: 746,
    price: 'Custom',
    category: 'Desk Setup',
    sku: 'STR-TABL-8890',
    material: 'Aluminium',
    visible: false,
  },
  {
    id: 5,
    name: '3 Seater Sofa',
    image: 'sofa',
    review: '4,5',
    performance: 'Bad',
    views: 817,
    sales: 12400,
    score: 24,
    stock: 909,
    price: 'Custom',
    category: 'Man Fashion',
    sku: 'STR-SOFA-9093',
    material: 'Fabric',
    visible: true,
  },
  {
    id: 6,
    name: 'Candle Holder',
    image: 'candle',
    review: '4,5',
    performance: 'Bad',
    views: 926,
    sales: 12400,
    score: 38,
    stock: 333,
    price: '50.00 USD',
    category: 'Decoration Lamp',
    sku: 'STR-CNDL-5510',
    material: 'Steel',
    visible: true,
  },
  {
    id: 7,
    name: 'Table Lamp',
    image: 'lamp',
    review: '4,5',
    performance: 'Good',
    views: 43000,
    sales: 1200,
    score: 73,
    stock: 310,
    price: '318.00 USD',
    category: 'Decoration Lamp',
    sku: 'STR-D343-4BFE',
    material: 'Stainless Steel',
    visible: true,
  },
  {
    id: 8,
    name: 'Laptop Stand',
    image: 'shelf',
    review: '4,4',
    performance: 'Excellent',
    views: 328,
    sales: 980,
    score: 83,
    stock: 220,
    price: '92.00 USD',
    category: 'Laptop & Device',
    sku: 'STR-LSTD-2240',
    material: 'Aluminium',
    visible: true,
  },
  {
    id: 9,
    name: 'Monitor Riser',
    image: 'table',
    review: '4,6',
    performance: 'Good',
    views: 502,
    sales: 1410,
    score: 69,
    stock: 145,
    price: '115.00 USD',
    category: 'Laptop & Device',
    sku: 'STR-MRSE-8112',
    material: 'Wood',
    visible: false,
  },
];

const categories = [
  { name: 'Man Fashion', count: '120', color: '#ff4b4b' },
  { name: 'Laptop & Device', count: '120', color: '#4968ff' },
  { name: 'Desk Setup', count: '120', color: '#21b54a' },
];

const pageSize = 7;

export default function Home() {
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('name');
  const [showVisibleOnly, setShowVisibleOnly] = useState(false);
  const [category, setCategory] = useState('All Product');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(7);
  const [sortOpen, setSortOpen] = useState(false);
  const [modal, setModal] = useState<'new' | 'edit' | 'view' | null>(null);
  const [toast, setToast] = useState('Ready');

  const selectedProduct = products.find((product) => product.id === selectedId) ?? products[0];

  const visibleProducts = useMemo(() => {
    const performanceRank = { Excellent: 3, Good: 2, Bad: 1 };
    return products
      .filter((product) => product.name.toLowerCase().includes(query.toLowerCase()))
      .filter((product) => (showVisibleOnly ? product.visible : true))
      .filter((product) => (category === 'All Product' ? true : product.category === category))
      .sort((a, b) => {
        if (sortMode === 'stock') return b.stock - a.stock;
        if (sortMode === 'performance') return performanceRank[b.performance] - performanceRank[a.performance];
        if (sortMode === 'price') return priceValue(b.price) - priceValue(a.price);
        return a.name.localeCompare(b.name);
      });
  }, [category, products, query, showVisibleOnly, sortMode]);

  const totalPages = Math.max(1, Math.ceil(visibleProducts.length / pageSize));
  const pageProducts = visibleProducts.slice((page - 1) * pageSize, page * pageSize);

  function toggleVisibility(id: number) {
    setProducts((current) =>
      current.map((product) =>
        product.id === id ? { ...product, visible: !product.visible } : product,
      ),
    );
    setToast('Visibility updated');
  }

  function deleteProduct(id: number) {
    setProducts((current) => current.filter((product) => product.id !== id));
    setToast('Product deleted');
    if (selectedId === id) setSelectedId(products[0]?.id ?? 0);
  }

  function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const stock = Number(form.get('stock') || 0);
    const price = String(form.get('price') || 'Custom').trim() || 'Custom';
    const nextCategory = String(form.get('category') || 'Desk Setup');
    const performance = String(form.get('performance') || 'Good') as Product['performance'];

    if (!name) return;

    if (modal === 'edit' && selectedProduct) {
      setProducts((current) =>
        current.map((product) =>
          product.id === selectedProduct.id
            ? {
                ...product,
                name,
                stock,
                price,
                category: nextCategory,
                performance,
                score: scoreFromPerformance(performance),
              }
            : product,
        ),
      );
      setToast('Product edited');
    } else {
      const nextProduct: Product = {
        id: Date.now(),
        name,
        image: 'table',
        review: '4,5',
        performance,
        views: 0,
        sales: 0,
        score: scoreFromPerformance(performance),
        stock,
        price,
        category: nextCategory,
        sku: `STR-${name.slice(0, 4).toUpperCase()}-${String(Date.now()).slice(-4)}`,
        material: 'Stainless Steel',
        visible: true,
      };
      setProducts((current) => [nextProduct, ...current]);
      setSelectedId(nextProduct.id);
      setToast('New product added');
    }

    setModal(null);
    setPage(1);
  }

  const dashboardProps = {
    products,
    pageProducts,
    selectedProduct,
    query,
    sortMode,
    sortOpen,
    showVisibleOnly,
    category,
    page,
    totalPages,
    toast,
    setQuery: (value: string) => {
      setQuery(value);
      setPage(1);
    },
    setSortMode: (mode: SortMode) => {
      setSortMode(mode);
      setSortOpen(false);
    },
    setSortOpen,
    setShowVisibleOnly: () => {
      setShowVisibleOnly((value) => !value);
      setPage(1);
    },
    setCategory: (value: string) => {
      setCategory(value);
      setPage(1);
    },
    setPage,
    setSelectedId,
    setModal,
    toggleVisibility,
    deleteProduct,
  };

  return (
    <main className="commerce-app">
      <DesktopDashboard {...dashboardProps} />
      <MobileProduct
        product={selectedProduct}
        onEdit={() => setModal('edit')}
        onShare={() => setToast(`${selectedProduct.name} link copied`)}
        onBoost={() => setToast(`${selectedProduct.name} boosted`)}
        onDelete={() => deleteProduct(selectedProduct.id)}
      />
      {modal ? (
        <ProductModal
          mode={modal}
          product={selectedProduct}
          onClose={() => setModal(null)}
          onSubmit={saveProduct}
        />
      ) : null}
    </main>
  );
}

function DesktopDashboard({
  products,
  pageProducts,
  selectedProduct,
  query,
  sortMode,
  sortOpen,
  showVisibleOnly,
  category,
  page,
  totalPages,
  toast,
  setQuery,
  setSortMode,
  setSortOpen,
  setShowVisibleOnly,
  setCategory,
  setPage,
  setSelectedId,
  setModal,
  toggleVisibility,
  deleteProduct,
}: {
  products: Product[];
  pageProducts: Product[];
  selectedProduct: Product;
  query: string;
  sortMode: SortMode;
  sortOpen: boolean;
  showVisibleOnly: boolean;
  category: string;
  page: number;
  totalPages: number;
  toast: string;
  setQuery: (value: string) => void;
  setSortMode: (mode: SortMode) => void;
  setSortOpen: (value: boolean) => void;
  setShowVisibleOnly: () => void;
  setCategory: (value: string) => void;
  setPage: (value: number) => void;
  setSelectedId: (value: number) => void;
  setModal: (value: 'new' | 'edit' | 'view') => void;
  toggleVisibility: (id: number) => void;
  deleteProduct: (id: number) => void;
}) {
  const activeProducts = products.filter((product) => product.visible).length;
  const sold = products.reduce((sum, product) => sum + product.sales, 0);

  return (
    <section className="desktop-frame" aria-label="All product list dashboard">
      <div className="brand-rail">
        <div className="logo-box">SE</div>
        <RailIcon active label="Catalog" badge="20">
          <span className="rail-shape rail-capsule" />
        </RailIcon>
        <RailIcon label="Workspace" badge="99+">
          <span className="rail-shape rail-sun" />
        </RailIcon>
        <RailIcon label="Create">
          <span className="rail-plus">+</span>
        </RailIcon>
        <button type="button" className="rail-bottom" aria-label="Settings">⌘</button>
      </div>

      <aside className="side-nav">
        <button type="button" className="top-item">Performance</button>
        <NavDivider />
        <NavItem icon="⌁" label="Analytics" active={false} onClick={() => setCategory('All Product')} />
        <NavItem icon="♧" label="Notification" badge="99+" onClick={() => setCategory('All Product')} />
        <NavItem icon="◎" label="Performance" active onClick={() => setSortMode('performance')} />
        <NavItem icon="▥" label="Orders" badge="120" muted onClick={() => setSortMode('stock')} />
        <NavDivider />
        <p className="nav-label">PRODUCT</p>
        <NavItem icon="▰" label="All Product" selected={category === 'All Product'} onClick={() => setCategory('All Product')} />
        <NavItem icon="♨" label="Shipping" onClick={() => setSortMode('stock')} />
        <NavItem icon="◌" label="Campaign" onClick={() => setSortMode('performance')} />
        <NavItem icon="◇" label="Catalog" onClick={() => setCategory('Desk Setup')} />
        <NavDivider />
        <p className="nav-label">MY STORE</p>
        <button type="button" className="category-head" onClick={() => setCategory('All Product')}>
          <span>▧ Product Category</span>
          <span>⌃</span>
        </button>
        <div className="category-list">
          {categories.map((item) => (
            <button
              key={item.name}
              type="button"
              className={category === item.name ? 'category-row selected-category' : 'category-row'}
              onClick={() => setCategory(item.name)}
            >
              <span style={{ background: item.color }} />
              <p>{item.name}</p>
              <b style={{ color: item.color }}>• {item.count}</b>
            </button>
          ))}
        </div>
        <NavItem icon="♧" label="Finance" onClick={() => setSortMode('price')} />
        <NavItem icon="♙" label="Customer" onClick={() => setShowVisibleOnly()} />
      </aside>

      <section className="content-pane">
        <header className="topbar">
          <h1>All Product List</h1>
          <label className="search">
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Product"
              aria-label="Search Product"
            />
          </label>
          <div className="menu-wrap">
            <button type="button" className="toolbar-button" onClick={() => setSortOpen(!sortOpen)}>
              <IconSort /> Sort By
            </button>
            {sortOpen ? (
              <div className="sort-menu">
                {(['name', 'stock', 'performance', 'price'] as SortMode[]).map((mode) => (
                  <button key={mode} type="button" onClick={() => setSortMode(mode)}>
                    {sortMode === mode ? '✓ ' : ''}{labelSort(mode)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button type="button" className={showVisibleOnly ? 'toolbar-button pressed' : 'toolbar-button'} onClick={setShowVisibleOnly}>
            <IconBox /> Show All Product <span>{products.length + 111}</span>
          </button>
          <button type="button" className="new-product" onClick={() => setModal('new')}>
            + New Product
          </button>
        </header>

        <section className="stats-panel">
          <div className="panel-title">
            <h2>Product Statistic</h2>
            <span>{toast}</span>
          </div>
          <div className="stat-grid">
            <Statistic label="Active Product" value={String(activeProducts + 347)} suffix="Product" />
            <Statistic label="Winning Product" value={`🧡 ${selectedProduct.name.slice(0, 9)} ...`} />
            <Statistic label="Average Performance" value="Good!" gauge />
            <Statistic label="Product Sold" value={sold.toLocaleString('en-US')} suffix="Items" />
            <Statistic label="Product Returned" value="420" suffix="Items" />
          </div>
        </section>

        <div className="product-list">
          {pageProducts.map((product) => (
            <article key={product.id} className="product-row">
              <button
                type="button"
                className="product-info"
                onClick={() => {
                  setSelectedId(product.id);
                  setModal('view');
                }}
              >
                <ProductThumb kind={product.image} />
                <div>
                  <h3>{product.name}</h3>
                  <p>Review : <b>{product.review}★</b></p>
                </div>
              </button>

              <div className="row-separator" />
              <div className="performance">
                <p>Performance <span>{product.performance}</span></p>
                <div className="mini-metrics">
                  <span><IconTrend /> {formatCompact(product.views)}</span>
                  <span><IconBag /> {formatCompact(product.sales)}</span>
                </div>
              </div>
              <Gauge value={product.score} />
              <div className="row-separator" />
              <InfoBlock label="Stock" value={String(product.stock)} icon={<IconCube />} />
              <div className="row-separator" />
              <InfoBlock label="Product Price" value={product.price} icon={<span className="dollar">$</span>} />
              <div className="visibility">
                <p>Visibility</p>
                <button
                  type="button"
                  className={product.visible ? 'toggle on' : 'toggle'}
                  onClick={() => toggleVisibility(product.id)}
                  aria-label={`Toggle visibility for ${product.name}`}
                />
              </div>
              <div className="actions" aria-label={`Actions for ${product.name}`}>
                <button
                  type="button"
                  aria-label={`Edit ${product.name}`}
                  onClick={() => {
                    setSelectedId(product.id);
                    setModal('edit');
                  }}
                >
                  <IconPen />
                </button>
                <button
                  type="button"
                  aria-label={`View ${product.name}`}
                  onClick={() => {
                    setSelectedId(product.id);
                    setModal('view');
                  }}
                >
                  <IconEye />
                </button>
                <button type="button" aria-label={`Delete ${product.name}`} onClick={() => deleteProduct(product.id)}>
                  <IconMore />
                </button>
              </div>
            </article>
          ))}
        </div>

        <footer className="pager">
          <button type="button" disabled={page === 1} onClick={() => setPage(Math.max(1, page - 1))}>
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button type="button" disabled={page === totalPages} onClick={() => setPage(Math.min(totalPages, page + 1))}>
            Next
          </button>
        </footer>
      </section>
    </section>
  );
}

function MobileProduct({
  product,
  onEdit,
  onShare,
  onBoost,
  onDelete,
}: {
  product: Product;
  onEdit: () => void;
  onShare: () => void;
  onBoost: () => void;
  onDelete: () => void;
}) {
  return (
    <section className="mobile-scene" aria-label={`${product.name} product detail`}>
      <article className="phone-card">
        <header className="phone-head">
          <div>
            <h1>{product.name}</h1>
            <p>$ {product.price.replace(' USD', '')}</p>
          </div>
          <div className="phone-actions">
            <button type="button" aria-label="Product gallery"><IconGrid /></button>
            <button type="button" aria-label="Close product">×</button>
          </div>
        </header>

        <div className="gallery">
          <button type="button" className="hero-product" aria-label="Front image">
            <ProductThumb kind={product.image} large />
            <span>◆ Front Image</span>
          </button>
          <button type="button" className="side-product" aria-label="Side image">
            <ProductThumb kind={product.image} large />
          </button>
          <div className="thumb-row">
            <button type="button" aria-label="Thumbnail one"><ProductThumb kind={product.image} /></button>
            <button type="button" aria-label="Thumbnail two"><ProductThumb kind="candle" /></button>
            <button type="button" aria-label="Thumbnail three"><ProductThumb kind="lamp" /></button>
          </div>
        </div>

        <h2>Details</h2>
        <dl className="details-grid">
          <Detail label="SKU" value={product.sku} />
          <Detail label="Stock" value={`${product.stock} Ready`} />
          <Detail label="Price" value={`$${product.price.replace(' USD', '')}`} />
          <Detail label="Material" value={product.material} />
          <Detail label="Category" value={product.category} />
          <Detail label="Status" value={product.visible ? '• Active' : '• Hidden'} active={product.visible} />
        </dl>

        <div className="stats-title">
          <h2>Statistics</h2>
          <button type="button">6 Month⌄</button>
        </div>
        <div className="phone-stat-grid">
          <Statistic label="Product View" value={formatPhoneNumber(product.views)} suffix="View" />
          <Statistic label="Product Sales" value={formatPhoneNumber(product.sales)} suffix="Items" />
          <Statistic label="Product Returned" value="420" suffix="Items" />
        </div>
        <div className="chart">
          {Array.from({ length: 34 }).map((_, index) => (
            <span
              key={index}
              className={index > 26 ? 'dark' : index === 25 ? 'green' : ''}
              style={{ height: `${30 + ((index * 17) % 96)}px` }}
            />
          ))}
          <div className="chart-tip">
            <p>Gross Profit <b>$4.3K</b></p>
            <p>Item Sold <b>{product.stock}</b></p>
          </div>
        </div>
        <footer className="detail-actions">
          <button type="button" onClick={onEdit}><IconPen /> Edit Product</button>
          <button type="button" onClick={onShare}><IconShare /> Share Product</button>
          <button type="button" className="boost" onClick={onBoost}><IconBoost /> Boost Product</button>
          <button type="button" aria-label="Delete product" onClick={onDelete}><IconTrash /></button>
        </footer>
      </article>
    </section>
  );
}

function ProductModal({
  mode,
  product,
  onClose,
  onSubmit,
}: {
  mode: 'new' | 'edit' | 'view';
  product: Product;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (mode === 'view') {
    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true">
        <article className="view-modal">
          <button type="button" className="modal-close" onClick={onClose}>×</button>
          <ProductThumb kind={product.image} large />
          <div>
            <h2>{product.name}</h2>
            <p>{product.sku}</p>
            <dl className="modal-details">
              <Detail label="Stock" value={`${product.stock} Ready`} />
              <Detail label="Price" value={product.price} />
              <Detail label="Category" value={product.category} />
              <Detail label="Status" value={product.visible ? 'Active' : 'Hidden'} active={product.visible} />
            </dl>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="product-modal" onSubmit={onSubmit}>
        <button type="button" className="modal-close" onClick={onClose}>×</button>
        <h2>{mode === 'edit' ? 'Edit Product' : 'New Product'}</h2>
        <label>
          Product Name
          <input name="name" defaultValue={mode === 'edit' ? product.name : ''} required />
        </label>
        <label>
          Stock
          <input name="stock" type="number" min="0" defaultValue={mode === 'edit' ? product.stock : 120} required />
        </label>
        <label>
          Product Price
          <input name="price" defaultValue={mode === 'edit' ? product.price : 'Custom'} required />
        </label>
        <label>
          Category
          <select name="category" defaultValue={mode === 'edit' ? product.category : 'Desk Setup'}>
            <option>Desk Setup</option>
            <option>Laptop & Device</option>
            <option>Decoration Lamp</option>
            <option>Man Fashion</option>
          </select>
        </label>
        <label>
          Performance
          <select name="performance" defaultValue={mode === 'edit' ? product.performance : 'Good'}>
            <option>Excellent</option>
            <option>Good</option>
            <option>Bad</option>
          </select>
        </label>
        <button type="submit" className="save-button">{mode === 'edit' ? 'Save Product' : 'Add Product'}</button>
      </form>
    </div>
  );
}

function RailIcon({
  children,
  badge,
  active,
  label,
}: {
  children: ReactNode;
  badge?: string;
  active?: boolean;
  label: string;
}) {
  return (
    <button type="button" className={active ? 'rail-icon active' : 'rail-icon'} aria-label={label}>
      {children}
      {badge ? <b>{badge}</b> : null}
    </button>
  );
}

function NavItem({
  icon,
  label,
  badge,
  selected,
  active,
  muted,
  onClick,
}: {
  icon: string;
  label: string;
  badge?: string;
  selected?: boolean;
  active?: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={selected ? 'nav-item selected' : active ? 'nav-item active' : 'nav-item'}
      onClick={onClick}
    >
      <span>{icon}</span>
      <p>{label}</p>
      {badge ? <b className={muted ? 'muted-badge' : ''}>{badge}</b> : null}
    </button>
  );
}

function NavDivider() {
  return <div className="nav-divider" />;
}

function Statistic({
  label,
  value,
  suffix,
  gauge,
}: {
  label: string;
  value: string;
  suffix?: string;
  gauge?: boolean;
}) {
  return (
    <div className="statistic">
      <p>{label}</p>
      <strong>
        {gauge ? <span className="small-gauge" /> : null}
        {value}
        {suffix ? <span>{suffix}</span> : null}
      </strong>
    </div>
  );
}

function InfoBlock({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="info-block">
      <p>{label}</p>
      <span>{icon} {value}</span>
    </div>
  );
}

function Detail({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={active ? 'active-detail' : ''}>{value}</dd>
    </div>
  );
}

function Gauge({ value }: { value: number }) {
  return (
    <div
      className="gauge"
      style={{
        '--score': `${Math.max(0, Math.min(100, value))}%`,
      } as CSSProperties}
      aria-label={`Performance ${value}%`}
    />
  );
}

function ProductThumb({ kind, large = false }: { kind: string; large?: boolean }) {
  return (
    <div className={large ? `product-thumb ${kind} large` : `product-thumb ${kind}`} aria-hidden="true">
      <i />
      <b />
      <span />
    </div>
  );
}

function priceValue(price: string) {
  const parsed = Number(price.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function scoreFromPerformance(performance: Product['performance']) {
  if (performance === 'Excellent') return 88;
  if (performance === 'Good') return 68;
  return 31;
}

function formatCompact(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace('.', ',')}k`;
  return String(value);
}

function formatPhoneNumber(value: number) {
  if (value >= 10000) return `${Math.round(value / 1000)}K`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace('.', ',')}K`;
  return String(value);
}

function labelSort(mode: SortMode) {
  return mode === 'name' ? 'Product Name' : mode === 'stock' ? 'Stock' : mode === 'price' ? 'Price' : 'Performance';
}

function IconSort() {
  return <span className="ui-icon">≡</span>;
}

function IconBox() {
  return <span className="ui-icon">▣</span>;
}

function IconTrend() {
  return <span className="row-icon">⌁</span>;
}

function IconBag() {
  return <span className="row-icon">▢</span>;
}

function IconCube() {
  return <span className="row-icon">◇</span>;
}

function IconPen() {
  return <span className="icon-pen" />;
}

function IconEye() {
  return <span className="icon-eye" />;
}

function IconMore() {
  return <span className="icon-more">•••</span>;
}

function IconGrid() {
  return <span className="icon-grid">▦</span>;
}

function IconShare() {
  return <span className="icon-share">⌁</span>;
}

function IconBoost() {
  return <span className="icon-boost">♻</span>;
}

function IconTrash() {
  return <span className="icon-trash">⌫</span>;
}
