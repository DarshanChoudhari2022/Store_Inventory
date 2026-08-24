'use client';

import { createClient } from '@supabase/supabase-js';
import { FormEvent, memo, useEffect, useMemo, useState } from 'react';

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
  itemId: string | null;
  itemName: string;
  qty: number;
  buyingPrice: number;
  soldPrice: number;
  date: string;
};

type ShopAccount = {
  id: string;
  name: string;
  area: string;
  username: string;
  itemCount: number;
};

type ShopProfile = {
  id: string;
  name: string;
  area: string;
  username: string;
};

type ShopDashboardData = {
  shop: ShopProfile;
  items: Item[];
  todaysSales: Sale[];
};

type OwnerSummary = {
  shopCount: number;
  revenue: number;
  profit: number;
  inventoryValue: number;
  lowStockCount: number;
};

type Session = {
  token: string;
  role: 'owner' | 'shop';
  shopId?: string;
};

const supabaseUrl = 'https://yrpuetarxtuvnhenkigr.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlycHVldGFyeHR1dm5oZW5raWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NTI5NTQsImV4cCI6MjEwMzEyODk1NH0.Euw5G9m-R-oVnJmS14FX4TV_IoGDO59Zgjw58Kh8lhw';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const sessionKey = 'store-inventory-session-v1';

const money = (value: number) => `Rs ${Math.round(value).toLocaleString('en-IN')}`;
const numeric = (value: FormDataEntryValue | null) => Number(value || 0);
const cleanSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

function generatePassword() {
  return `Store@${Math.floor(1000 + Math.random() * 9000)}`;
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function mapItem(raw: Record<string, unknown>): Item {
  return {
    id: String(raw.id),
    name: String(raw.name),
    category: String(raw.category),
    buyingPrice: toNumber(raw.buyingPrice),
    defaultSellingPrice: toNumber(raw.defaultSellingPrice),
    stock: toNumber(raw.stock),
    reorderLevel: toNumber(raw.reorderLevel),
  };
}

function mapSale(raw: Record<string, unknown>): Sale {
  return {
    id: String(raw.id),
    itemId: raw.itemId ? String(raw.itemId) : null,
    itemName: String(raw.itemName),
    qty: toNumber(raw.qty),
    buyingPrice: toNumber(raw.buyingPrice),
    soldPrice: toNumber(raw.soldPrice),
    date: String(raw.date),
  };
}

function getRpcData<T>(data: T | null, error: { message?: string } | null) {
  if (error) throw new Error(error.message || 'Supabase request failed');
  if (data === null) throw new Error('Supabase returned no data');
  return data;
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [shops, setShops] = useState<ShopAccount[]>([]);
  const [ownerSummary, setOwnerSummary] = useState<OwnerSummary>({
    shopCount: 0,
    revenue: 0,
    profit: 0,
    inventoryValue: 0,
    lowStockCount: 0,
  });
  const [dashboard, setDashboard] = useState<ShopDashboardData | null>(null);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [message, setMessage] = useState('Ready for today');
  const [credentialNote, setCredentialNote] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(sessionKey);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as Session;
      setSession(parsed);
      void loadAfterLogin(parsed);
    } catch {
      window.localStorage.removeItem(sessionKey);
    }
  }, []);

  const selectedItem = dashboard?.items.find((item) => item.id === selectedItemId) ?? dashboard?.items[0];

  useEffect(() => {
    if (!dashboard?.items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(dashboard?.items[0]?.id ?? '');
    }
  }, [dashboard, selectedItemId]);

  const metrics = useMemo(() => {
    const items = dashboard?.items ?? [];
    const todaysSales = dashboard?.todaysSales ?? [];
    const revenue = todaysSales.reduce((sum, sale) => sum + sale.soldPrice * sale.qty, 0);
    const profit = todaysSales.reduce(
      (sum, sale) => sum + (sale.soldPrice - sale.buyingPrice) * sale.qty,
      0,
    );
    const units = todaysSales.reduce((sum, sale) => sum + sale.qty, 0);
    const lowStock = items.filter((item) => item.stock <= item.reorderLevel);

    const byProduct = todaysSales.reduce<Record<string, number>>((acc, sale) => {
      acc[sale.itemName] = (acc[sale.itemName] ?? 0) + sale.qty;
      return acc;
    }, {});
    const topSeller = Object.entries(byProduct).sort((a, b) => b[1] - a[1])[0];

    return {
      revenue,
      profit,
      units,
      lowStock,
      topSeller: topSeller ? `${topSeller[0]} (${topSeller[1]} pcs)` : 'No sales yet',
      todaysSales,
    };
  }, [dashboard]);

  async function loadAfterLogin(nextSession: Session) {
    try {
      setIsBusy(true);
      if (nextSession.role === 'owner') {
        await loadOwner(nextSession.token, nextSession.shopId);
      } else if (nextSession.shopId) {
        await loadShop(nextSession.token, nextSession.shopId);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load Supabase data');
      setSession(null);
      window.localStorage.removeItem(sessionKey);
    } finally {
      setIsBusy(false);
    }
  }

  async function loadOwner(token: string, preferredShopId?: string) {
    const [{ data: summaryData, error: summaryError }, { data: shopsData, error: shopsError }] =
      await Promise.all([
        supabase.rpc('owner_summary', { p_token: token }),
        supabase.rpc('list_shops', { p_token: token }),
      ]);

    const summary = getRpcData<Record<string, unknown>>(summaryData, summaryError);
    const shopRows = getRpcData<Record<string, unknown>[]>(shopsData, shopsError).map((shop) => ({
      id: String(shop.id),
      name: String(shop.name),
      area: String(shop.area),
      username: String(shop.username),
      itemCount: toNumber(shop.itemCount),
    }));

    setOwnerSummary({
      shopCount: toNumber(summary.shopCount),
      revenue: toNumber(summary.revenue),
      profit: toNumber(summary.profit),
      inventoryValue: toNumber(summary.inventoryValue),
      lowStockCount: toNumber(summary.lowStockCount),
    });
    setShops(shopRows);

    const nextShopId = preferredShopId && shopRows.some((shop) => shop.id === preferredShopId)
      ? preferredShopId
      : shopRows[0]?.id ?? '';
    setSelectedShopId(nextShopId);
    if (nextShopId) await loadShop(token, nextShopId);
  }

  async function loadOwnerSummary(token: string) {
    const { data, error } = await supabase.rpc('owner_summary', { p_token: token });
    const summary = getRpcData<Record<string, unknown>>(data, error);
    setOwnerSummary({
      shopCount: toNumber(summary.shopCount),
      revenue: toNumber(summary.revenue),
      profit: toNumber(summary.profit),
      inventoryValue: toNumber(summary.inventoryValue),
      lowStockCount: toNumber(summary.lowStockCount),
    });
  }

  async function loadShop(token: string, shopId: string) {
    const { data, error } = await supabase.rpc('get_shop_dashboard', {
      p_token: token,
      p_shop_id: shopId,
    });
    const raw = getRpcData<Record<string, unknown>>(data, error);
    const shop = raw.shop as Record<string, unknown>;
    const items = (raw.items as Record<string, unknown>[]).map(mapItem);
    const todaysSales = (raw.todaysSales as Record<string, unknown>[]).map(mapSale);

    setDashboard({
      shop: {
        id: String(shop.id),
        name: String(shop.name),
        area: String(shop.area),
        username: String(shop.username),
      },
      items,
      todaysSales,
    });
    setSelectedShopId(String(shop.id));
    setSelectedItemId(items[0]?.id ?? '');
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get('username') || '').trim();
    const password = String(form.get('password') || '').trim();

    try {
      setIsBusy(true);
      const { data, error } = await supabase.rpc('login_user', {
        p_username: username,
        p_password: password,
      });
      const login = getRpcData<Record<string, unknown>>(data, error);
      const nextSession: Session = {
        token: String(login.token),
        role: login.role === 'owner' ? 'owner' : 'shop',
        shopId: login.shopId ? String(login.shopId) : undefined,
      };
      setSession(nextSession);
      window.localStorage.setItem(sessionKey, JSON.stringify(nextSession));
      setMessage(nextSession.role === 'owner' ? 'Logged in as owner admin' : `Logged in to ${login.shopName}`);
      await loadAfterLogin(nextSession);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invalid username or password');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLogout() {
    if (session?.token) {
      await supabase.rpc('logout_user', { p_token: session.token });
    }
    setSession(null);
    setDashboard(null);
    setCredentialNote('');
    window.localStorage.removeItem(sessionKey);
  }

  async function handleAddShop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;

    const form = new FormData(event.currentTarget);
    const name = String(form.get('shopName') || '').trim();
    if (!name) return;

    const slug = cleanSlug(name) || `shop-${Date.now()}`;
    const username = `${slug}-${Date.now().toString().slice(-4)}.admin`;
    const password = generatePassword();

    try {
      setIsBusy(true);
      const { data, error } = await supabase.rpc('create_shop', {
        p_token: session.token,
        p_name: name,
        p_area: String(form.get('area') || 'Pune').trim() || 'Pune',
        p_username: username,
        p_password: password,
      });
      const shop = getRpcData<Record<string, unknown>>(data, error);
      const shopId = String(shop.id);
      setCredentialNote(`New login: ${shop.username} / ${shop.password}`);
      setMessage(`${shop.name} created`);
      event.currentTarget.reset();
      await loadOwner(session.token, shopId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create shop');
    } finally {
      setIsBusy(false);
    }
  }

  async function resetShopPassword(shopId: string) {
    if (!session) return;

    const password = generatePassword();
    try {
      setIsBusy(true);
      const { data, error } = await supabase.rpc('reset_shop_password', {
        p_token: session.token,
        p_shop_id: shopId,
        p_password: password,
      });
      const shop = getRpcData<Record<string, unknown>>(data, error);
      setCredentialNote(`Reset login: ${shop.username} / ${shop.password}`);
      setMessage(`${shop.name} password reset`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not reset password');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !dashboard) return;

    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    if (!name) return;

    try {
      setIsBusy(true);
      const { data, error } = await supabase.rpc('add_item', {
        p_token: session.token,
        p_shop_id: dashboard.shop.id,
        p_name: name,
        p_category: String(form.get('category') || 'General').trim() || 'General',
        p_buying_price: numeric(form.get('buyingPrice')),
        p_selling_price: numeric(form.get('sellingPrice')),
        p_stock: numeric(form.get('stock')),
        p_reorder_level: numeric(form.get('reorderLevel')),
      });
      const item = mapItem(getRpcData<Record<string, unknown>>(data, error));
      setSelectedItemId(item.id);
      setMessage(`${item.name} added to ${dashboard.shop.name}`);
      event.currentTarget.reset();
      setDashboard((current) =>
        current
          ? {
              ...current,
              items: [...current.items, item],
            }
          : current,
      );
      setShops((current) =>
        current.map((shop) =>
          shop.id === dashboard.shop.id ? { ...shop, itemCount: shop.itemCount + 1 } : shop,
        ),
      );
      if (session.role === 'owner') await loadOwnerSummary(session.token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add item');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRecordSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !dashboard || !selectedItem) return;

    const form = new FormData(event.currentTarget);
    try {
      setIsBusy(true);
      const { data, error } = await supabase.rpc('record_sale', {
        p_token: session.token,
        p_shop_id: dashboard.shop.id,
        p_item_id: selectedItem.id,
        p_qty: Math.max(1, numeric(form.get('qty'))),
        p_sold_price: Math.max(0, numeric(form.get('soldPrice'))),
      });
      const rawSale = getRpcData<Record<string, unknown>>(data, error);
      const sale = mapSale(rawSale);
      const remainingStock = toNumber(rawSale.remainingStock);
      setMessage(`Sold ${sale.qty} ${sale.itemName} at ${dashboard.shop.name}`);
      event.currentTarget.reset();
      setDashboard((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === selectedItem.id ? { ...item, stock: remainingStock } : item,
              ),
              todaysSales: [sale, ...current.todaysSales],
            }
          : current,
      );
      if (session.role === 'owner') await loadOwnerSummary(session.token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not record sale');
    } finally {
      setIsBusy(false);
    }
  }

  async function updateClosingCount(itemId: string, stock: number) {
    if (!session) return;

    try {
      setIsBusy(true);
      const { data, error } = await supabase.rpc('update_stock', {
        p_token: session.token,
        p_item_id: itemId,
        p_stock: stock,
      });
      if (error) throw new Error(error.message);
      const updatedItem = mapItem(getRpcData<Record<string, unknown>>(data, null));
      setMessage('Closing stock updated');
      setDashboard((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) => (item.id === itemId ? updatedItem : item)),
            }
          : current,
      );
      if (session.role === 'owner') await loadOwnerSummary(session.token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update stock');
    } finally {
      setIsBusy(false);
    }
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#f8f7f2] text-[#20221f]">
        <section className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 py-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm font-semibold uppercase text-[#66735c]">Store stock desk</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight sm:text-6xl">
              Multi-shop inventory backed by Supabase
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#62655f]">
              Owner admin can create shops, generate usernames and passwords, then track each
              shop's items, stock, daily sales, profit, and fast moving products separately.
            </p>
            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {['Shop logins', 'Cloud data', 'Profit view'].map((label) => (
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
            <button
              disabled={isBusy}
              className="mt-6 w-full bg-[#2d6a4f] px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              {isBusy ? 'Opening...' : 'Open dashboard'}
            </button>
            <p className="mt-4 text-sm text-[#62655f]">
              Owner demo: owner / owner123. Shop demo: fcroad.admin / Store@4217.
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
            <p className="text-xs font-semibold uppercase text-[#66735c]">Store Inventory Management</p>
            <h1 className="text-2xl font-semibold">
              {session.role === 'owner' ? 'Owner Admin Dashboard' : `${dashboard?.shop.name ?? 'Shop'} Dashboard`}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="border border-[#d8d3c5] bg-[#f8f7f2] px-3 py-2">
              {isBusy ? 'Syncing...' : message}
            </span>
            <button onClick={handleLogout} className="border border-[#20221f] px-3 py-2">
              Logout
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-6">
        {session.role === 'owner' ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Metric label="Total shops" value={`${ownerSummary.shopCount}`} />
              <Metric label="Today sales" value={money(ownerSummary.revenue)} />
              <Metric label="Today profit" value={money(ownerSummary.profit)} />
              <Metric label="Stock value" value={money(ownerSummary.inventoryValue)} />
              <Metric label="Low stock items" value={`${ownerSummary.lowStockCount}`} />
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_0.75fr]">
              <section className="border border-[#d8d3c5] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2ddcf] px-4 py-3">
                  <h2 className="text-lg font-semibold">Shop accounts</h2>
                  <span className="text-sm text-[#62655f]">Credentials are revealed only when generated or reset</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-[#eef1e9] text-xs uppercase text-[#4f5f48]">
                      <tr>
                        <th className="px-4 py-3">Shop</th>
                        <th className="px-4 py-3">Area</th>
                        <th className="px-4 py-3">Username</th>
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
                          <td className="px-4 py-3">{shop.itemCount}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => void loadOwner(session.token, shop.id)}
                                className="border border-[#2d6a4f] px-3 py-2 text-[#2d6a4f]"
                              >
                                View
                              </button>
                              <button
                                onClick={() => void resetShopPassword(shop.id)}
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
                <button
                  disabled={isBusy}
                  className="mt-4 w-full bg-[#2d6a4f] px-4 py-3 font-semibold text-white disabled:opacity-60"
                >
                  Generate shop login
                </button>
                {credentialNote ? (
                  <p className="mt-3 border border-[#d8d3c5] bg-[#f8f7f2] p-3 font-mono text-xs">
                    {credentialNote}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-[#62655f]">
                    New stores start with the standard inventory item list. Copy credentials when they
                    appear here.
                  </p>
                )}
              </form>
            </div>

            <div className="mt-6 border border-[#d8d3c5] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Manage selected shop</h2>
                  <p className="text-sm text-[#62655f]">
                    {dashboard?.shop.name ?? 'No shop selected'} - {dashboard?.shop.area ?? ''}
                  </p>
                </div>
                <select
                  value={selectedShopId}
                  onChange={(event) => void loadOwner(session.token, event.target.value)}
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

        {dashboard ? (
          <ShopDashboard
            dashboard={dashboard}
            selectedItemId={selectedItemId}
            selectedItem={selectedItem}
            metrics={metrics}
            setSelectedItemId={setSelectedItemId}
            handleRecordSale={handleRecordSale}
            handleAddItem={handleAddItem}
            updateClosingCount={updateClosingCount}
          />
        ) : (
          <section className="mt-6 border border-[#d8d3c5] bg-white p-6">Loading shop data...</section>
        )}
      </section>
    </main>
  );
}

function ShopDashboard({
  dashboard,
  selectedItemId,
  selectedItem,
  metrics,
  setSelectedItemId,
  handleRecordSale,
  handleAddItem,
  updateClosingCount,
}: {
  dashboard: ShopDashboardData;
  selectedItemId: string;
  selectedItem?: Item;
  metrics: {
    revenue: number;
    profit: number;
    units: number;
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
        <Metric label="Selected shop" value={dashboard.shop.name} />
        <Metric label="Today sales" value={money(metrics.revenue)} />
        <Metric label="Today profit" value={money(metrics.profit)} />
        <Metric label="Units sold" value={`${metrics.units} pcs`} />
        <Metric label="Highest seller" value={metrics.topSeller} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="border border-[#d8d3c5] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2ddcf] px-4 py-3">
            <h2 className="text-lg font-semibold">Available shop items</h2>
            <span className="text-sm text-[#62655f]">{dashboard.items.length} active items</span>
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
                {dashboard.items.map((item) => (
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
                        defaultValue={item.stock}
                        onBlur={(event) => {
                          const nextStock = Number(event.target.value);
                          if (nextStock !== item.stock) void updateClosingCount(item.id, nextStock);
                        }}
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
              {dashboard.items.map((item) => (
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

const Metric = memo(function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="border border-[#d8d3c5] bg-white p-4">
      <p className="text-xs font-semibold uppercase text-[#66735c]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </article>
  );
});

const Field = memo(function Field({
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
});
