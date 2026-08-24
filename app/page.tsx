'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Item = {
  id: string;
  name: string;
  category: string;
  buyingPrice: number;
  defaultSellingPrice: number;
  stock: number;
  reorderLevel: number;
};

type Sale = {
  id: string;
  itemId: string;
  itemName: string;
  qty: number;
  buyingPrice: number;
  soldPrice: number;
  date: string;
};

type Shop = {
  id: string;
  name: string;
  area: string;
  username: string;
  password: string;
  items: Item[];
  sales: Sale[];
};

type Session = {
  role: 'owner' | 'shop';
  shopId?: string;
};

const seedItems: Item[] = [
  {
    id: 'gold-flake-kings',
    name: 'Gold Flake Kings',
    category: 'Cigarettes',
    buyingPrice: 17,
    defaultSellingPrice: 20,
    stock: 38,
    reorderLevel: 12,
  },
  {
    id: 'classic-milds',
    name: 'Classic Milds',
    category: 'Cigarettes',
    buyingPrice: 18,
    defaultSellingPrice: 22,
    stock: 24,
    reorderLevel: 10,
  },
  {
    id: 'vimal-pouch',
    name: 'Vimal Pouch',
    category: 'Pan Masala',
    buyingPrice: 4,
    defaultSellingPrice: 5,
    stock: 82,
    reorderLevel: 25,
  },
  {
    id: 'rajnigandha',
    name: 'Rajnigandha',
    category: 'Pan Masala',
    buyingPrice: 18,
    defaultSellingPrice: 20,
    stock: 18,
    reorderLevel: 8,
  },
  {
    id: 'lighter',
    name: 'Pocket Lighter',
    category: 'Accessories',
    buyingPrice: 8,
    defaultSellingPrice: 12,
    stock: 17,
    reorderLevel: 6,
  },
];

const seedShops: Shop[] = [
  {
    id: 'fc-road-tapri',
    name: 'FC Road Tapri',
    area: 'Shivajinagar, Pune',
    username: 'fcroad.admin',
    password: 'Tapri@4217',
    items: seedItems,
    sales: [],
  },
  {
    id: 'kothrud-corner',
    name: 'Kothrud Corner Shop',
    area: 'Kothrud, Pune',
    username: 'kothrud.admin',
    password: 'Tapri@8362',
    items: seedItems.map((item) => ({
      ...item,
      id: `kothrud-${item.id}`,
      stock: Math.max(8, item.stock - 9),
    })),
    sales: [],
  },
];

const storageKey = 'tapri-inventory-v2';
const ownerUsername = 'owner';
const ownerPassword = 'owner123';

const todayIso = () => new Date().toISOString().slice(0, 10);
const money = (value: number) => `Rs ${Math.round(value).toLocaleString('en-IN')}`;
const numeric = (value: FormDataEntryValue | null) => Number(value || 0);
const cleanSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

function cloneSeedItems(prefix: string) {
  return seedItems.map((item) => ({ ...item, id: `${prefix}-${item.id}` }));
}

function generatePassword() {
  return `Tapri@${Math.floor(1000 + Math.random() * 9000)}`;
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [shops, setShops] = useState<Shop[]>(seedShops);
  const [selectedShopId, setSelectedShopId] = useState(seedShops[0].id);
  const [selectedItemId, setSelectedItemId] = useState(seedShops[0].items[0].id);
  const [message, setMessage] = useState('Ready for today');

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as { shops?: Shop[] };
      if (parsed.shops?.length) {
        setShops(parsed.shops);
        setSelectedShopId(parsed.shops[0].id);
        setSelectedItemId(parsed.shops[0].items[0]?.id ?? '');
      }
    } catch {
      setMessage('Saved data could not be loaded');
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify({ shops }));
  }, [shops]);

  const visibleShopId = session?.role === 'shop' ? session.shopId ?? selectedShopId : selectedShopId;
  const activeShop = shops.find((shop) => shop.id === visibleShopId) ?? shops[0];
  const selectedItem = activeShop.items.find((item) => item.id === selectedItemId) ?? activeShop.items[0];

  useEffect(() => {
    if (!activeShop.items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(activeShop.items[0]?.id ?? '');
    }
  }, [activeShop, selectedItemId]);

  const ownerMetrics = useMemo(() => {
    const allSales = shops.flatMap((shop) => shop.sales);
    const todaysSales = allSales.filter((sale) => sale.date === todayIso());
    const revenue = todaysSales.reduce((sum, sale) => sum + sale.soldPrice * sale.qty, 0);
    const profit = todaysSales.reduce(
      (sum, sale) => sum + (sale.soldPrice - sale.buyingPrice) * sale.qty,
      0,
    );
    const inventoryValue = shops.reduce(
      (sum, shop) => sum + shop.items.reduce((itemSum, item) => itemSum + item.stock * item.buyingPrice, 0),
      0,
    );
    const lowStockCount = shops.reduce(
      (sum, shop) => sum + shop.items.filter((item) => item.stock <= item.reorderLevel).length,
      0,
    );

    return { revenue, profit, inventoryValue, lowStockCount };
  }, [shops]);

  const metrics = useMemo(() => {
    const todaysSales = activeShop.sales.filter((sale) => sale.date === todayIso());
    const revenue = todaysSales.reduce((sum, sale) => sum + sale.soldPrice * sale.qty, 0);
    const profit = todaysSales.reduce(
      (sum, sale) => sum + (sale.soldPrice - sale.buyingPrice) * sale.qty,
      0,
    );
    const units = todaysSales.reduce((sum, sale) => sum + sale.qty, 0);
    const inventoryValue = activeShop.items.reduce((sum, item) => sum + item.stock * item.buyingPrice, 0);
    const lowStock = activeShop.items.filter((item) => item.stock <= item.reorderLevel);

    const byProduct = todaysSales.reduce<Record<string, number>>((acc, sale) => {
      acc[sale.itemName] = (acc[sale.itemName] ?? 0) + sale.qty;
      return acc;
    }, {});
    const topSeller = Object.entries(byProduct).sort((a, b) => b[1] - a[1])[0];

    return {
      revenue,
      profit,
      units,
      inventoryValue,
      lowStock,
      topSeller: topSeller ? `${topSeller[0]} (${topSeller[1]} pcs)` : 'No sales yet',
      todaysSales,
    };
  }, [activeShop]);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get('username') || '').trim();
    const password = String(form.get('password') || '').trim();

    if (username === ownerUsername && password === ownerPassword) {
      setSession({ role: 'owner' });
      setMessage('Logged in as owner admin');
      return;
    }

    const shop = shops.find((entry) => entry.username === username && entry.password === password);
    if (shop) {
      setSession({ role: 'shop', shopId: shop.id });
      setSelectedShopId(shop.id);
      setSelectedItemId(shop.items[0]?.id ?? '');
      setMessage(`Logged in to ${shop.name}`);
      return;
    }

    setMessage('Invalid username or password');
  }

  function handleAddShop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('shopName') || '').trim();
    if (!name) return;

    const slug = cleanSlug(name) || `shop-${Date.now()}`;
    const username = `${slug}.admin`;
    const password = generatePassword();
    const shop: Shop = {
      id: `${slug}-${Date.now()}`,
      name,
      area: String(form.get('area') || 'Pune').trim() || 'Pune',
      username,
      password,
      items: cloneSeedItems(slug),
      sales: [],
    };

    setShops((current) => [...current, shop]);
    setSelectedShopId(shop.id);
    setSelectedItemId(shop.items[0]?.id ?? '');
    setMessage(`Created ${name} login: ${username} / ${password}`);
    event.currentTarget.reset();
  }

  function updateActiveShop(updater: (shop: Shop) => Shop) {
    setShops((current) => current.map((shop) => (shop.id === activeShop.id ? updater(shop) : shop)));
  }

  function handleAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    if (!name) return;

    const newItem: Item = {
      id: `${activeShop.id}-${cleanSlug(name)}-${Date.now()}`,
      name,
      category: String(form.get('category') || 'General').trim() || 'General',
      buyingPrice: numeric(form.get('buyingPrice')),
      defaultSellingPrice: numeric(form.get('sellingPrice')),
      stock: numeric(form.get('stock')),
      reorderLevel: numeric(form.get('reorderLevel')),
    };

    updateActiveShop((shop) => ({ ...shop, items: [...shop.items, newItem] }));
    setSelectedItemId(newItem.id);
    setMessage(`${name} added to ${activeShop.name}`);
    event.currentTarget.reset();
  }

  function handleRecordSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedItem) return;

    const form = new FormData(event.currentTarget);
    const qty = Math.max(1, numeric(form.get('qty')));
    const soldPrice = Math.max(0, numeric(form.get('soldPrice')));
    const sellableQty = Math.min(qty, selectedItem.stock);

    if (sellableQty <= 0) {
      setMessage(`${selectedItem.name} is out of stock`);
      return;
    }

    const sale: Sale = {
      id: `${selectedItem.id}-${Date.now()}`,
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      qty: sellableQty,
      buyingPrice: selectedItem.buyingPrice,
      soldPrice,
      date: todayIso(),
    };

    updateActiveShop((shop) => ({
      ...shop,
      sales: [sale, ...shop.sales],
      items: shop.items.map((item) =>
        item.id === selectedItem.id ? { ...item, stock: item.stock - sellableQty } : item,
      ),
    }));
    setMessage(`Sold ${sellableQty} ${selectedItem.name} at ${activeShop.name}`);
    event.currentTarget.reset();
  }

  function updateClosingCount(itemId: string, stock: number) {
    updateActiveShop((shop) => ({
      ...shop,
      items: shop.items.map((item) => (item.id === itemId ? { ...item, stock: Math.max(0, stock) } : item)),
    }));
    setMessage(`Closing stock updated for ${activeShop.name}`);
  }

  function resetShopPassword(shopId: string) {
    const password = generatePassword();
    setShops((current) => current.map((shop) => (shop.id === shopId ? { ...shop, password } : shop)));
    const shop = shops.find((entry) => entry.id === shopId);
    setMessage(`${shop?.name ?? 'Shop'} new password: ${password}`);
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#f8f7f2] text-[#20221f]">
        <section className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 py-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm font-semibold uppercase text-[#66735c]">Tapri stock desk</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight sm:text-6xl">
              Multi-shop inventory and profit tracking for Pune tapris
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#62655f]">
              Owner admin can create shops, generate usernames and passwords, then track each
              shop's items, stock, daily sales, profit, and fast moving products separately.
            </p>
            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {['Shop logins', 'Stock count', 'Profit view'].map((label) => (
                <div key={label} className="border border-[#d8d3c5] bg-white p-4">
                  <p className="text-sm font-semibold">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleLogin} className="border border-[#d8d3c5] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Admin login</h2>
            <label className="mt-6 block text-sm font-medium" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              name="username"
              className="mt-2 w-full border border-[#cfc8b8] px-3 py-3 outline-none focus:border-[#2d6a4f]"
              placeholder="owner"
            />
            <label className="mt-4 block text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="mt-2 w-full border border-[#cfc8b8] px-3 py-3 outline-none focus:border-[#2d6a4f]"
              placeholder="owner123"
            />
            <button className="mt-6 w-full bg-[#2d6a4f] px-4 py-3 font-semibold text-white">
              Open dashboard
            </button>
            <p className="mt-4 text-sm text-[#62655f]">
              Owner demo: owner / owner123. Shop demo: fcroad.admin / Tapri@4217.
            </p>
            <p className="mt-2 text-sm text-[#8a3f20]">{message}</p>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f7f2] text-[#20221f]">
      <header className="border-b border-[#ddd7c7] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[#66735c]">Pune Tapri Inventory</p>
            <h1 className="text-2xl font-semibold">
              {session.role === 'owner' ? 'Owner Admin Dashboard' : `${activeShop.name} Dashboard`}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="border border-[#d8d3c5] bg-[#f8f7f2] px-3 py-2">{message}</span>
            <button onClick={() => setSession(null)} className="border border-[#20221f] px-3 py-2">
              Logout
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-6">
        {session.role === 'owner' ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Metric label="Total shops" value={`${shops.length}`} />
              <Metric label="Today sales" value={money(ownerMetrics.revenue)} />
              <Metric label="Today profit" value={money(ownerMetrics.profit)} />
              <Metric label="Stock value" value={money(ownerMetrics.inventoryValue)} />
              <Metric label="Low stock items" value={`${ownerMetrics.lowStockCount}`} />
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_0.75fr]">
              <section className="border border-[#d8d3c5] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2ddcf] px-4 py-3">
                  <h2 className="text-lg font-semibold">Shop accounts</h2>
                  <span className="text-sm text-[#62655f]">Generated credentials for each shop</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-[#eef1e9] text-xs uppercase text-[#4f5f48]">
                      <tr>
                        <th className="px-4 py-3">Shop</th>
                        <th className="px-4 py-3">Area</th>
                        <th className="px-4 py-3">Username</th>
                        <th className="px-4 py-3">Password</th>
                        <th className="px-4 py-3">Items</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shops.map((shop) => (
                        <tr key={shop.id} className="border-t border-[#eee9dc]">
                          <td className="px-4 py-3 font-medium">{shop.name}</td>
                          <td className="px-4 py-3">{shop.area}</td>
                          <td className="px-4 py-3 font-mono text-xs">{shop.username}</td>
                          <td className="px-4 py-3 font-mono text-xs">{shop.password}</td>
                          <td className="px-4 py-3">{shop.items.length}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setSelectedShopId(shop.id);
                                  setSelectedItemId(shop.items[0]?.id ?? '');
                                  setMessage(`Viewing ${shop.name}`);
                                }}
                                className="border border-[#2d6a4f] px-3 py-2 text-[#2d6a4f]"
                              >
                                View
                              </button>
                              <button
                                onClick={() => resetShopPassword(shop.id)}
                                className="border border-[#8a3f20] px-3 py-2 text-[#8a3f20]"
                              >
                                Reset
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <form onSubmit={handleAddShop} className="border border-[#d8d3c5] bg-white p-4">
                <h2 className="text-lg font-semibold">Add new shop</h2>
                <div className="mt-4 grid gap-3">
                  <Field label="Shop name" name="shopName" />
                  <Field label="Area" name="area" defaultValue="Pune" />
                </div>
                <button className="mt-4 w-full bg-[#2d6a4f] px-4 py-3 font-semibold text-white">
                  Generate shop login
                </button>
                <p className="mt-3 text-sm text-[#62655f]">
                  New shops start with the standard tapri item list. You can edit their stock after
                  selecting the shop.
                </p>
              </form>
            </div>

            <div className="mt-6 border border-[#d8d3c5] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Manage selected shop</h2>
                  <p className="text-sm text-[#62655f]">
                    {activeShop.name} - {activeShop.area}
                  </p>
                </div>
                <select
                  value={selectedShopId}
                  onChange={(event) => {
                    const shop = shops.find((entry) => entry.id === event.target.value);
                    setSelectedShopId(event.target.value);
                    setSelectedItemId(shop?.items[0]?.id ?? '');
                  }}
                  className="border border-[#cfc8b8] px-3 py-3"
                >
                  {shops.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        ) : null}

        <ShopDashboard
          activeShop={activeShop}
          selectedItemId={selectedItemId}
          selectedItem={selectedItem}
          metrics={metrics}
          setSelectedItemId={setSelectedItemId}
          handleRecordSale={handleRecordSale}
          handleAddItem={handleAddItem}
          updateClosingCount={updateClosingCount}
        />
      </section>
    </main>
  );
}

function ShopDashboard({
  activeShop,
  selectedItemId,
  selectedItem,
  metrics,
  setSelectedItemId,
  handleRecordSale,
  handleAddItem,
  updateClosingCount,
}: {
  activeShop: Shop;
  selectedItemId: string;
  selectedItem?: Item;
  metrics: {
    revenue: number;
    profit: number;
    units: number;
    inventoryValue: number;
    lowStock: Item[];
    topSeller: string;
    todaysSales: Sale[];
  };
  setSelectedItemId: (id: string) => void;
  handleRecordSale: (event: FormEvent<HTMLFormElement>) => void;
  handleAddItem: (event: FormEvent<HTMLFormElement>) => void;
  updateClosingCount: (itemId: string, stock: number) => void;
}) {
  return (
    <>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric label="Selected shop" value={activeShop.name} />
        <Metric label="Today sales" value={money(metrics.revenue)} />
        <Metric label="Today profit" value={money(metrics.profit)} />
        <Metric label="Units sold" value={`${metrics.units} pcs`} />
        <Metric label="Highest seller" value={metrics.topSeller} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="border border-[#d8d3c5] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2ddcf] px-4 py-3">
            <h2 className="text-lg font-semibold">Available shop items</h2>
            <span className="text-sm text-[#62655f]">{activeShop.items.length} active items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-[#eef1e9] text-xs uppercase text-[#4f5f48]">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Buy</th>
                  <th className="px-4 py-3">Sell</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Closing count</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {activeShop.items.map((item) => (
                  <tr key={item.id} className="border-t border-[#eee9dc]">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3">{item.category}</td>
                    <td className="px-4 py-3">{money(item.buyingPrice)}</td>
                    <td className="px-4 py-3">{money(item.defaultSellingPrice)}</td>
                    <td className="px-4 py-3">{item.stock} pcs</td>
                    <td className="px-4 py-3">
                      <input
                        aria-label={`Closing count for ${item.name}`}
                        type="number"
                        min="0"
                        value={item.stock}
                        onChange={(event) => updateClosingCount(item.id, Number(event.target.value))}
                        className="w-24 border border-[#cfc8b8] px-2 py-2"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          item.stock <= item.reorderLevel
                            ? 'bg-[#f7d8c4] px-2 py-1 text-[#8a3f20]'
                            : 'bg-[#dfeadb] px-2 py-1 text-[#2d6a4f]'
                        }
                      >
                        {item.stock <= item.reorderLevel ? 'Restock' : 'OK'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-5">
          <form onSubmit={handleRecordSale} className="border border-[#d8d3c5] bg-white p-4">
            <h2 className="text-lg font-semibold">Record sold product</h2>
            <label className="mt-4 block text-sm font-medium" htmlFor="sale-item">
              Product
            </label>
            <select
              id="sale-item"
              value={selectedItemId}
              onChange={(event) => setSelectedItemId(event.target.value)}
              className="mt-2 w-full border border-[#cfc8b8] px-3 py-3"
            >
              {activeShop.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {item.stock} pcs left
                </option>
              ))}
            </select>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Qty sold" name="qty" type="number" defaultValue="1" />
              <Field
                key={selectedItemId}
                label="Sold price per pc"
                name="soldPrice"
                type="number"
                defaultValue={String(selectedItem?.defaultSellingPrice ?? 0)}
              />
            </div>
            <button className="mt-4 w-full bg-[#2d6a4f] px-4 py-3 font-semibold text-white">
              Save sale
            </button>
          </form>

          <form onSubmit={handleAddItem} className="border border-[#d8d3c5] bg-white p-4">
            <h2 className="text-lg font-semibold">Add custom shop item</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Item name" name="name" />
              <Field label="Category" name="category" defaultValue="General" />
              <Field label="Buying price" name="buyingPrice" type="number" />
              <Field label="Selling price" name="sellingPrice" type="number" />
              <Field label="Total qty" name="stock" type="number" />
              <Field label="Restock alert" name="reorderLevel" type="number" defaultValue="5" />
            </div>
            <button className="mt-4 w-full border border-[#2d6a4f] px-4 py-3 font-semibold text-[#2d6a4f]">
              Add item
            </button>
          </form>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="border border-[#d8d3c5] bg-white p-4">
          <h2 className="text-lg font-semibold">Low stock analysis</h2>
          <div className="mt-3 space-y-2">
            {metrics.lowStock.length ? (
              metrics.lowStock.map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-[#fbf1e8] px-3 py-2 text-sm">
                  <span>{item.name}</span>
                  <span>{item.stock} pcs left</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#62655f]">No low stock items today.</p>
            )}
          </div>
        </section>

        <section className="border border-[#d8d3c5] bg-white p-4">
          <h2 className="text-lg font-semibold">Today sales log</h2>
          <div className="mt-3 max-h-64 space-y-2 overflow-auto">
            {metrics.todaysSales.length ? (
              metrics.todaysSales.map((sale) => (
                <div key={sale.id} className="grid grid-cols-[1fr_auto] gap-3 border-b border-[#eee9dc] pb-2 text-sm">
                  <span>
                    {sale.itemName} x {sale.qty}
                  </span>
                  <span>{money(sale.soldPrice * sale.qty)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#62655f]">Sales added today will appear here.</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="border border-[#d8d3c5] bg-white p-4">
      <p className="text-xs font-semibold uppercase text-[#66735c]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </article>
  );
}

function Field({
  label,
  name,
  type = 'text',
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        name={name}
        type={type}
        min={type === 'number' ? '0' : undefined}
        step={type === 'number' ? '0.01' : undefined}
        defaultValue={defaultValue}
        className="mt-2 w-full border border-[#cfc8b8] px-3 py-3 font-normal outline-none focus:border-[#2d6a4f]"
      />
    </label>
  );
}
