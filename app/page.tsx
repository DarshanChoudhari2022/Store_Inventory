'use client';

import type { CSSProperties, ReactNode } from 'react';

const products = [
  {
    name: '4 Tier Shelving',
    image: 'shelf',
    review: '4,5',
    performance: 'Excellent',
    views: '994',
    sales: '12,4k',
    score: 88,
    stock: '92',
    price: 'Custom',
    visible: true,
  },
  {
    name: 'Insence Holder',
    image: 'holder',
    review: '4,5',
    performance: 'Good',
    views: '123',
    sales: '12,4k',
    score: 61,
    stock: '594',
    price: '66.00 USD',
    visible: true,
  },
  {
    name: 'Ashtray',
    image: 'ashtray',
    review: '4,5',
    performance: 'Good',
    views: '637',
    sales: '12,4k',
    score: 78,
    stock: '362',
    price: '81.00 USD',
    visible: false,
  },
  {
    name: 'Coffee Table',
    image: 'table',
    review: '4,5',
    performance: 'Excellent',
    views: '148',
    sales: '12,4k',
    score: 86,
    stock: '746',
    price: 'Custom',
    visible: false,
  },
  {
    name: '3 Seater Sofa',
    image: 'sofa',
    review: '4,5',
    performance: 'Bad',
    views: '817',
    sales: '12,4k',
    score: 24,
    stock: '909',
    price: 'Custom',
    visible: true,
  },
  {
    name: 'Candle Holder',
    image: 'candle',
    review: '4,5',
    performance: 'Bad',
    views: '926',
    sales: '12,4k',
    score: 38,
    stock: '333',
    price: '50.00 USD',
    visible: true,
  },
  {
    name: 'Table Lamp',
    image: 'lamp',
    review: '4,5',
    performance: 'Good',
    views: '71',
    sales: '12,4k',
    score: 73,
    stock: '530',
    price: '318.00 USD',
    visible: true,
  },
];

const categories = [
  { name: 'Man Fashion', count: '120', color: '#ff4b4b' },
  { name: 'Laptop & Device', count: '120', color: '#4968ff' },
  { name: 'Desk Setup', count: '120', color: '#21b54a' },
];

export default function Home() {
  return (
    <main className="commerce-app">
      <DesktopDashboard />
      <MobileProduct />
    </main>
  );
}

function DesktopDashboard() {
  return (
    <section className="desktop-frame" aria-label="All product list dashboard">
      <div className="brand-rail">
        <div className="logo-box">SE</div>
        <RailIcon active label="Catalog" badge="20">
          ▭
        </RailIcon>
        <RailIcon label="Workspace" badge="99+">
          ✺
        </RailIcon>
        <RailIcon label="Create">＋</RailIcon>
        <div className="rail-bottom">⌘</div>
      </div>

      <aside className="side-nav">
        <div className="top-item active-dot">Performance</div>
        <NavDivider />
        <NavItem icon="⌁" label="Analytics" />
        <NavItem icon="♧" label="Notification" badge="99+" />
        <NavItem icon="◎" label="Performance" active />
        <NavItem icon="▥" label="Orders" badge="120" muted />
        <NavDivider />
        <p className="nav-label">PRODUCT</p>
        <NavItem icon="▰" label="All Product" selected />
        <NavItem icon="♨" label="Shipping" />
        <NavItem icon="◌" label="Campaign" />
        <NavItem icon="◇" label="Catalog" />
        <NavDivider />
        <p className="nav-label">MY STORE</p>
        <div className="category-head">
          <span>▧ Product Category</span>
          <span>⌃</span>
        </div>
        <div className="category-list">
          {categories.map((category) => (
            <div key={category.name} className="category-row">
              <span style={{ background: category.color }} />
              <p>{category.name}</p>
              <b style={{ color: category.color }}>• {category.count}</b>
            </div>
          ))}
        </div>
        <NavItem icon="♧" label="Finance" />
        <NavItem icon="♙" label="Customer" />
      </aside>

      <section className="content-pane">
        <header className="topbar">
          <h1>All Product List</h1>
          <div className="search">Search Product</div>
          <button type="button">≡ Sort By</button>
          <button type="button">▣ Show All Product <span>120</span></button>
          <button type="button" className="new-product">＋ New Product</button>
        </header>

        <section className="stats-panel">
          <div className="panel-title">
            <h2>Product Statistic</h2>
            <span>⌃</span>
          </div>
          <div className="stat-grid">
            <Statistic label="Active Product" value="352" suffix="Product" />
            <Statistic label="Winning Product" value="🧡 3 Seater ..." />
            <Statistic label="Average Performance" value="Good!" gauge />
            <Statistic label="Product Sold" value="12,340" suffix="Items" />
            <Statistic label="Product Returned" value="420" suffix="Items" />
          </div>
        </section>

        <div className="product-list">
          {products.map((product) => (
            <article key={product.name} className="product-row">
              <div className="product-info">
                <ProductThumb kind={product.image} />
                <div>
                  <h3>{product.name}</h3>
                  <p>Review : <b>{product.review}★</b></p>
                </div>
              </div>

              <div className="row-separator" />
              <div className="performance">
                <p>Performance <span>{product.performance}</span></p>
                <div className="mini-metrics">
                  <span>⌁ {product.views}</span>
                  <span>▢ {product.sales}</span>
                </div>
              </div>
              <Gauge value={product.score} />
              <div className="row-separator" />
              <InfoBlock label="Stock" value={product.stock} icon="◇" />
              <div className="row-separator" />
              <InfoBlock label="Product Price" value={product.price} icon="$" />
              <div className="visibility">
                <p>Visibility</p>
                <span className={product.visible ? 'toggle on' : 'toggle'} />
              </div>
              <div className="actions" aria-label={`Actions for ${product.name}`}>
                <button type="button">⌁</button>
                <button type="button">◉</button>
                <button type="button">•••</button>
              </div>
            </article>
          ))}
        </div>

        <footer className="pager">
          <button type="button">Previous</button>
          <span>Page 1 of 10</span>
          <button type="button">Next</button>
        </footer>
      </section>
    </section>
  );
}

function MobileProduct() {
  return (
    <section className="mobile-scene" aria-label="Table Lamp product detail">
      <article className="phone-card">
        <header className="phone-head">
          <div>
            <h1>Table Lamp</h1>
            <p>$ 318.00 USD</p>
          </div>
          <div className="phone-actions">
            <button type="button">▦</button>
            <button type="button">×</button>
          </div>
        </header>

        <div className="gallery">
          <div className="hero-product">
            <ProductThumb kind="lamp" large />
            <span>◆ Front Image</span>
          </div>
          <div className="side-product">
            <ProductThumb kind="lamp" large />
          </div>
          <div className="thumb-row">
            <ProductThumb kind="lamp" />
            <ProductThumb kind="candle" />
            <ProductThumb kind="lamp" />
          </div>
        </div>

        <h2>Details</h2>
        <dl className="details-grid">
          <Detail label="SKU" value="STR-D343-4BFE" />
          <Detail label="Stock" value="310 Ready" />
          <Detail label="Price" value="$318.00" />
          <Detail label="Material" value="Stainless Steel" />
          <Detail label="Category" value="Decoration Lamp" />
          <Detail label="Status" value="• Active" active />
        </dl>

        <div className="stats-title">
          <h2>Statistics</h2>
          <button type="button">6 Month⌄</button>
        </div>
        <div className="phone-stat-grid">
          <Statistic label="Product View" value="43K" suffix="View" />
          <Statistic label="Product Sales" value="1,2K" suffix="Items" />
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
            <p>Item Sold <b>310</b></p>
          </div>
        </div>
        <footer className="detail-actions">
          <button type="button">✎ Edit Product</button>
          <button type="button">⌁ Share Product</button>
          <button type="button" className="boost">♻ Boost Product</button>
          <button type="button" aria-label="Delete product">⌫</button>
        </footer>
      </article>
    </section>
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
      {badge ? <span>{badge}</span> : null}
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
}: {
  icon: string;
  label: string;
  badge?: string;
  selected?: boolean;
  active?: boolean;
  muted?: boolean;
}) {
  return (
    <button type="button" className={selected ? 'nav-item selected' : active ? 'nav-item active' : 'nav-item'}>
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

function InfoBlock({ label, value, icon }: { label: string; value: string; icon: string }) {
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
