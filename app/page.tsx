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

type CredentialNote = {
  username: string;
  password: string;
  label: string;
};

type Lang = 'en' | 'mr';

const dictionary = {
  en: {
    appName: 'Store Inventory Management',
    eyebrow: 'Store stock desk',
    heroTitle: 'Multi-store inventory backed by Supabase',
    heroCopy:
      "Owner admin can create shops, generate usernames and passwords, then track each shop's items, stock, daily sales, profit, and fast moving products separately.",
    shopLogins: 'Shop logins',
    cloudData: 'Cloud data',
    profitView: 'Profit view',
    adminLogin: 'Admin login',
    username: 'Username',
    password: 'Password',
    openDashboard: 'Open dashboard',
    opening: 'Opening...',
    loginHint: 'Use your owner or shop credentials. Ask the owner admin to reset a shop password if needed.',
    configMissing:
      'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.',
    ownerDashboard: 'Owner Admin Dashboard',
    shopAccounts: 'Shop accounts',
    credentialsHint: 'Credentials are revealed only when generated or reset',
    addNewShop: 'Add new shop',
    shopName: 'Shop name',
    area: 'Area',
    generateLogin: 'Generate shop login',
    newShopHint: 'New stores start with the standard inventory item list. Copy credentials when they appear here.',
    manageShop: 'Manage selected shop',
    selectedShop: 'Selected shop',
    totalShops: 'Total shops',
    todaySales: 'Today sales',
    todayProfit: 'Today profit',
    stockValue: 'Stock value',
    lowStockItems: 'Low stock items',
    unitsSold: 'Units sold',
    highestSeller: 'Highest seller',
    availableItems: 'Available shop items',
    activeItems: 'active items',
    item: 'Item',
    category: 'Category',
    buy: 'Buy',
    sell: 'Sell',
    stock: 'Stock',
    closingCount: 'Closing count',
    status: 'Status',
    restock: 'Restock',
    ok: 'OK',
    recordSold: 'Record sold product',
    product: 'Product',
    qtySold: 'Qty sold',
    soldPrice: 'Sold price per pc',
    saveSale: 'Save sale',
    addItem: 'Add custom shop item',
    itemName: 'Item name',
    buyingPrice: 'Buying price',
    sellingPrice: 'Selling price',
    totalQty: 'Total qty',
    restockAlert: 'Restock alert',
    addItemAction: 'Add item',
    lowStockAnalysis: 'Low stock analysis',
    noLowStock: 'No low stock items today.',
    todaySalesLog: 'Today sales log',
    noSales: 'Sales added today will appear here.',
    loading: 'Loading shop data...',
    syncing: 'Syncing...',
    logout: 'Logout',
    view: 'View',
    reset: 'Reset',
    copy: 'Copy',
    copied: 'Copied',
    generatedCredential: 'Generated credential',
  },
  mr: {
    appName: 'स्टोअर इन्व्हेंटरी व्यवस्थापन',
    eyebrow: 'स्टोअर स्टॉक डेस्क',
    heroTitle: 'Supabase सह मल्टी-स्टोअर इन्व्हेंटरी',
    heroCopy:
      'मालक अॅडमिन दुकाने तयार करू शकतो, युजरनेम आणि पासवर्ड जनरेट करू शकतो, आणि प्रत्येक दुकानाचा स्टॉक, विक्री, नफा आणि जलद विकली जाणारी उत्पादने वेगळी पाहू शकतो.',
    shopLogins: 'दुकान लॉगिन',
    cloudData: 'क्लाउड डेटा',
    profitView: 'नफा दृश्य',
    adminLogin: 'अॅडमिन लॉगिन',
    username: 'युजरनेम',
    password: 'पासवर्ड',
    openDashboard: 'डॅशबोर्ड उघडा',
    opening: 'उघडत आहे...',
    loginHint: 'मालक किंवा दुकान क्रेडेन्शियल्स वापरा. गरज असल्यास मालक अॅडमिनकडून दुकान पासवर्ड रीसेट करा.',
    configMissing:
      'Supabase कॉन्फिगर केलेले नाही. Vercel मध्ये NEXT_PUBLIC_SUPABASE_URL आणि NEXT_PUBLIC_SUPABASE_ANON_KEY जोडा.',
    ownerDashboard: 'मालक अॅडमिन डॅशबोर्ड',
    shopAccounts: 'दुकान खाती',
    credentialsHint: 'क्रेडेन्शियल्स फक्त तयार किंवा रीसेट केल्यावर दिसतील',
    addNewShop: 'नवीन दुकान जोडा',
    shopName: 'दुकानाचे नाव',
    area: 'एरिया',
    generateLogin: 'दुकान लॉगिन जनरेट करा',
    newShopHint: 'नवीन दुकानांना स्टँडर्ड इन्व्हेंटरी यादी मिळेल. क्रेडेन्शियल्स दिसल्यावर कॉपी करा.',
    manageShop: 'निवडलेले दुकान व्यवस्थापित करा',
    selectedShop: 'निवडलेले दुकान',
    totalShops: 'एकूण दुकाने',
    todaySales: 'आजची विक्री',
    todayProfit: 'आजचा नफा',
    stockValue: 'स्टॉक मूल्य',
    lowStockItems: 'कमी स्टॉक आयटम',
    unitsSold: 'विकलेले युनिट्स',
    highestSeller: 'सर्वाधिक विक्री',
    availableItems: 'उपलब्ध दुकान आयटम',
    activeItems: 'सक्रिय आयटम',
    item: 'आयटम',
    category: 'कॅटेगरी',
    buy: 'खरेदी',
    sell: 'विक्री',
    stock: 'स्टॉक',
    closingCount: 'क्लोजिंग काउंट',
    status: 'स्थिती',
    restock: 'रीस्टॉक',
    ok: 'ठीक',
    recordSold: 'विकलेला प्रॉडक्ट नोंदवा',
    product: 'प्रॉडक्ट',
    qtySold: 'विकलेली संख्या',
    soldPrice: 'प्रति पीस विक्री किंमत',
    saveSale: 'विक्री सेव्ह करा',
    addItem: 'कस्टम दुकान आयटम जोडा',
    itemName: 'आयटम नाव',
    buyingPrice: 'खरेदी किंमत',
    sellingPrice: 'विक्री किंमत',
    totalQty: 'एकूण संख्या',
    restockAlert: 'रीस्टॉक अलर्ट',
    addItemAction: 'आयटम जोडा',
    lowStockAnalysis: 'कमी स्टॉक विश्लेषण',
    noLowStock: 'आज कोणताही कमी स्टॉक आयटम नाही.',
    todaySalesLog: 'आजची विक्री नोंद',
    noSales: 'आज जोडलेली विक्री येथे दिसेल.',
    loading: 'दुकान डेटा लोड होत आहे...',
    syncing: 'सिंक होत आहे...',
    logout: 'लॉगआउट',
    view: 'पहा',
    reset: 'रीसेट',
    copy: 'कॉपी',
    copied: 'कॉपी झाले',
    generatedCredential: 'जनरेटेड क्रेडेन्शियल',
  },
} satisfies Record<Lang, Record<string, string>>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

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

function getSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase environment variables are missing.');
  }

  return supabase;
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
  const [credentialNote, setCredentialNote] = useState<CredentialNote | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [lang, setLang] = useState<Lang>('en');
  const copy = dictionary[lang];

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
        getSupabaseClient().rpc('owner_summary', { p_token: token }),
        getSupabaseClient().rpc('list_shops', { p_token: token }),
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
    const { data, error } = await getSupabaseClient().rpc('owner_summary', { p_token: token });
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
    const { data, error } = await getSupabaseClient().rpc('get_shop_dashboard', {
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
      const { data, error } = await getSupabaseClient().rpc('login_user', {
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
      await getSupabaseClient().rpc('logout_user', { p_token: session.token });
    }
    setSession(null);
    setDashboard(null);
    setCredentialNote(null);
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
      const { data, error } = await getSupabaseClient().rpc('create_shop', {
        p_token: session.token,
        p_name: name,
        p_area: String(form.get('area') || 'Pune').trim() || 'Pune',
        p_username: username,
        p_password: password,
      });
      const shop = getRpcData<Record<string, unknown>>(data, error);
      const shopId = String(shop.id);
      setCredentialNote({
        label: String(shop.name),
        username: String(shop.username),
        password: String(shop.password),
      });
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
      const { data, error } = await getSupabaseClient().rpc('reset_shop_password', {
        p_token: session.token,
        p_shop_id: shopId,
        p_password: password,
      });
      const shop = getRpcData<Record<string, unknown>>(data, error);
      setCredentialNote({
        label: String(shop.name),
        username: String(shop.username),
        password: String(shop.password),
      });
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
      const { data, error } = await getSupabaseClient().rpc('add_item', {
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
      const { data, error } = await getSupabaseClient().rpc('record_sale', {
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
      const { data, error } = await getSupabaseClient().rpc('update_stock', {
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
      <main className="auth-shell min-h-screen bg-[#f8f7f2] text-[#20221f]">
        <section className="auth-grid mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 py-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="auth-copy">
            <div className="topline">
              <p className="text-sm font-semibold uppercase text-[#66735c]">{copy.eyebrow}</p>
              <LanguageToggle lang={lang} setLang={setLang} />
            </div>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight sm:text-6xl">
              {copy.heroTitle}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#62655f]">
              {copy.heroCopy}
            </p>
            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {[copy.shopLogins, copy.cloudData, copy.profitView].map((label) => (
                <div key={label} className="feature-tile border border-[#d8d3c5] bg-white p-4">
                  <p className="text-sm font-semibold">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleLogin} className="auth-card border border-[#d8d3c5] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">{copy.adminLogin}</h2>
            {!isSupabaseConfigured ? (
              <p className="mt-4 rounded-lg border border-[#f0c7a5] bg-[#fff1df] px-3 py-2 text-sm text-[#8a3f20]">
                {copy.configMissing}
              </p>
            ) : null}
            <label className="mt-6 block text-sm font-medium" htmlFor="username">
              {copy.username}
            </label>
            <input
              id="username"
              name="username"
              required
              autoComplete="username"
              className="mt-2 w-full border border-[#cfc8b8] px-3 py-3 outline-none focus:border-[#2d6a4f]"
              placeholder="owner"
            />
            <label className="mt-4 block text-sm font-medium" htmlFor="password">
              {copy.password}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-2 w-full border border-[#cfc8b8] px-3 py-3 outline-none focus:border-[#2d6a4f]"
              placeholder="owner123"
            />
            <button
              disabled={isBusy || !isSupabaseConfigured}
              className="mt-6 w-full bg-[#2d6a4f] px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              {isBusy ? copy.opening : copy.openDashboard}
            </button>
            <p className="mt-4 text-sm text-[#62655f]">
              {copy.loginHint}
            </p>
            <p className="mt-2 text-sm text-[#8a3f20]" role="status" aria-live="polite">
              {message}
            </p>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell min-h-screen bg-[#f8f7f2] text-[#20221f]">
      <header className="dashboard-header border-b border-[#ddd7c7] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[#66735c]">{copy.appName}</p>
            <h1 className="text-2xl font-semibold">
              {session.role === 'owner' ? copy.ownerDashboard : `${dashboard?.shop.name ?? 'Shop'} Dashboard`}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <LanguageToggle lang={lang} setLang={setLang} />
            <span className="border border-[#d8d3c5] bg-[#f8f7f2] px-3 py-2">
              {isBusy ? copy.syncing : message}
            </span>
            <button type="button" onClick={handleLogout} className="border border-[#20221f] px-3 py-2">
              {copy.logout}
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-6">
        {session.role === 'owner' ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Metric label={copy.totalShops} value={`${ownerSummary.shopCount}`} />
              <Metric label={copy.todaySales} value={money(ownerSummary.revenue)} />
              <Metric label={copy.todayProfit} value={money(ownerSummary.profit)} />
              <Metric label={copy.stockValue} value={money(ownerSummary.inventoryValue)} />
              <Metric label={copy.lowStockItems} value={`${ownerSummary.lowStockCount}`} />
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_0.75fr]">
              <section className="panel border border-[#d8d3c5] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2ddcf] px-4 py-3">
                  <h2 className="text-lg font-semibold">{copy.shopAccounts}</h2>
                  <span className="text-sm text-[#62655f]">{copy.credentialsHint}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-[#eef1e9] text-xs uppercase text-[#4f5f48]">
                      <tr>
                        <th className="px-4 py-3">Shop</th>
                        <th className="px-4 py-3">{copy.area}</th>
                        <th className="px-4 py-3">{copy.username}</th>
                        <th className="px-4 py-3">{copy.item}</th>
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
                                type="button"
                                onClick={() => void loadOwner(session.token, shop.id)}
                                className="border border-[#2d6a4f] px-3 py-2 text-[#2d6a4f]"
                              >
                                {copy.view}
                              </button>
                              <button
                                type="button"
                                onClick={() => void resetShopPassword(shop.id)}
                                className="border border-[#8a3f20] px-3 py-2 text-[#8a3f20]"
                              >
                                {copy.reset}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <form onSubmit={handleAddShop} className="panel border border-[#d8d3c5] bg-white p-4">
                <h2 className="text-lg font-semibold">{copy.addNewShop}</h2>
                <div className="mt-4 grid gap-3">
                  <Field label={copy.shopName} name="shopName" required />
                  <Field label={copy.area} name="area" defaultValue="Pune" required />
                </div>
                <button
                  disabled={isBusy}
                  className="mt-4 w-full bg-[#2d6a4f] px-4 py-3 font-semibold text-white disabled:opacity-60"
                >
                  {copy.generateLogin}
                </button>
                {credentialNote ? (
                  <CredentialCard credential={credentialNote} copy={copy} />
                ) : (
                  <p className="mt-3 text-sm text-[#62655f]">
                    {copy.newShopHint}
                  </p>
                )}
              </form>
            </div>

            <div className="panel mt-6 border border-[#d8d3c5] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{copy.manageShop}</h2>
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
            copy={copy}
            selectedItemId={selectedItemId}
            selectedItem={selectedItem}
            metrics={metrics}
            setSelectedItemId={setSelectedItemId}
            handleRecordSale={handleRecordSale}
            handleAddItem={handleAddItem}
            updateClosingCount={updateClosingCount}
          />
        ) : (
          <section className="panel mt-6 border border-[#d8d3c5] bg-white p-6">{copy.loading}</section>
        )}
      </section>
    </main>
  );
}

function ShopDashboard({
  dashboard,
  copy,
  selectedItemId,
  selectedItem,
  metrics,
  setSelectedItemId,
  handleRecordSale,
  handleAddItem,
  updateClosingCount,
}: {
  dashboard: ShopDashboardData;
  copy: (typeof dictionary)[Lang];
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
        <Metric label={copy.selectedShop} value={dashboard.shop.name} />
        <Metric label={copy.todaySales} value={money(metrics.revenue)} />
        <Metric label={copy.todayProfit} value={money(metrics.profit)} />
        <Metric label={copy.unitsSold} value={`${metrics.units} pcs`} />
        <Metric label={copy.highestSeller} value={metrics.topSeller} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="panel border border-[#d8d3c5] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2ddcf] px-4 py-3">
            <h2 className="text-lg font-semibold">{copy.availableItems}</h2>
            <span className="text-sm text-[#62655f]">
              {dashboard.items.length} {copy.activeItems}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-[#eef1e9] text-xs uppercase text-[#4f5f48]">
                <tr>
                  <th className="px-4 py-3">{copy.item}</th>
                  <th className="px-4 py-3">{copy.category}</th>
                  <th className="px-4 py-3">{copy.buy}</th>
                  <th className="px-4 py-3">{copy.sell}</th>
                  <th className="px-4 py-3">{copy.stock}</th>
                  <th className="px-4 py-3">{copy.closingCount}</th>
                  <th className="px-4 py-3">{copy.status}</th>
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
                        {item.stock <= item.reorderLevel ? copy.restock : copy.ok}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-5">
          <form onSubmit={handleRecordSale} className="panel border border-[#d8d3c5] bg-white p-4">
            <h2 className="text-lg font-semibold">{copy.recordSold}</h2>
            <label className="mt-4 block text-sm font-medium" htmlFor="sale-item">
              {copy.product}
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
              <Field label={copy.qtySold} name="qty" type="number" defaultValue="1" />
              <Field
                key={selectedItemId}
                label={copy.soldPrice}
                name="soldPrice"
                type="number"
                defaultValue={String(selectedItem?.defaultSellingPrice ?? 0)}
              />
            </div>
            <button className="mt-4 w-full bg-[#2d6a4f] px-4 py-3 font-semibold text-white">
              {copy.saveSale}
            </button>
          </form>

          <form onSubmit={handleAddItem} className="panel border border-[#d8d3c5] bg-white p-4">
            <h2 className="text-lg font-semibold">{copy.addItem}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label={copy.itemName} name="name" required />
              <Field label={copy.category} name="category" defaultValue="General" required />
              <Field label={copy.buyingPrice} name="buyingPrice" type="number" required />
              <Field label={copy.sellingPrice} name="sellingPrice" type="number" required />
              <Field label={copy.totalQty} name="stock" type="number" required />
              <Field label={copy.restockAlert} name="reorderLevel" type="number" defaultValue="5" />
            </div>
            <button className="mt-4 w-full border border-[#2d6a4f] px-4 py-3 font-semibold text-[#2d6a4f]">
              {copy.addItemAction}
            </button>
          </form>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="panel border border-[#d8d3c5] bg-white p-4">
          <h2 className="text-lg font-semibold">{copy.lowStockAnalysis}</h2>
          <div className="mt-3 space-y-2">
            {metrics.lowStock.length ? (
              metrics.lowStock.map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-[#fbf1e8] px-3 py-2 text-sm">
                  <span>{item.name}</span>
                  <span>{item.stock} pcs left</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#62655f]">{copy.noLowStock}</p>
            )}
          </div>
        </section>

        <section className="panel border border-[#d8d3c5] bg-white p-4">
          <h2 className="text-lg font-semibold">{copy.todaySalesLog}</h2>
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
              <p className="text-sm text-[#62655f]">{copy.noSales}</p>
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

function LanguageToggle({ lang, setLang }: { lang: Lang; setLang: (lang: Lang) => void }) {
  return (
    <div className="language-toggle" aria-label="Language selector">
      <button
        type="button"
        className={lang === 'en' ? 'active' : ''}
        onClick={() => setLang('en')}
      >
        EN
      </button>
      <button
        type="button"
        className={lang === 'mr' ? 'active' : ''}
        onClick={() => setLang('mr')}
      >
        मर
      </button>
    </div>
  );
}

function CredentialCard({
  credential,
  copy,
}: {
  credential: CredentialNote;
  copy: (typeof dictionary)[Lang];
}) {
  const [copied, setCopied] = useState(false);
  const credentialText = `${credential.username} / ${credential.password}`;

  async function copyCredential() {
    await navigator.clipboard.writeText(credentialText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="credential-card mt-3 border border-[#d8d3c5] bg-[#f8f7f2] p-3">
      <p className="text-xs font-semibold uppercase text-[#66735c]">{copy.generatedCredential}</p>
      <p className="mt-1 text-sm font-semibold">{credential.label}</p>
      <p className="mt-2 break-all font-mono text-xs">{credentialText}</p>
      <button
        type="button"
        onClick={() => void copyCredential()}
        className="mt-3 border border-[#2d6a4f] px-3 py-2 text-sm font-semibold text-[#2d6a4f]"
      >
        {copied ? copy.copied : copy.copy}
      </button>
    </div>
  );
}

const Field = memo(function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="form-field block text-sm font-medium">
      {label}
      <input
        name={name}
        type={type}
        min={type === 'number' ? '0' : undefined}
        step={type === 'number' ? '0.01' : undefined}
        defaultValue={defaultValue}
        required={required}
        className="mt-2 w-full border border-[#cfc8b8] px-3 py-3 font-normal outline-none focus:border-[#2d6a4f]"
      />
    </label>
  );
});
