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
    heroTitle: 'Inventory, sales, and closing count for every shop',
    heroCopy:
      'A fast daily desk for kirana, tapri, and small retail teams: see every product count, record sales, catch low stock, and keep each shop separate.',
    shopLogins: 'Shop logins',
    cloudData: 'Live stock',
    profitView: 'Restock list',
    shopAccess: 'Owner + shop',
    everyProduct: 'Every product',
    lowStockFocus: 'Low-stock focus',
    livePreview: 'Live store preview',
    dailyClosing: 'Daily closing',
    stockWatch: 'Stock watch',
    secureAccess: 'Secure access',
    readyForToday: 'Ready for today',
    shop: 'Shop',
    action: 'Action',
    productSection: 'Product',
    myStore: 'My Store',
    pcsLeft: 'pcs left',
    unitPcs: 'pcs',
    storeControl: 'Store Control',
    restockPriority: 'Restock Priority',
    allInventory: 'All Inventory',
    stockCount: 'Stock Count',
    fastMoving: 'Fast Moving',
    catalog: 'Catalog',
    dailyClosingPanel: 'Daily Closing',
    inventoryControl: 'Inventory Control',
    searchProduct: 'Search Product',
    sortProducts: 'Sort products',
    needsRestock: 'Needs Restock',
    showAllItems: 'Show All Items',
    storeSnapshot: 'Store Snapshot',
    inventoryItems: 'Inventory Items',
    noItem: 'No item',
    soldToday: 'Sold Today',
    revenueLabel: 'Revenue',
    profitLabel: 'Profit',
    sellBuy: 'Sell / Buy',
    needed: 'Needed',
    availableQty: 'Available qty',
    updateQty: 'Update available qty',
    chooseItem: 'Choose product',
    qtyHint: 'Select any shop product and enter today’s available quantity after counting stock.',
    addProductHint: 'Add a product when the shop starts selling a new item.',
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
    heroTitle: 'प्रत्येक दुकानासाठी स्टॉक, विक्री आणि क्लोजिंग काउंट',
    heroCopy:
      'किराणा, टपरी आणि छोट्या रिटेल टीमसाठी जलद डेली डेस्क: प्रत्येक उत्पादनाचा काउंट पाहा, विक्री नोंदवा, कमी स्टॉक पकडा आणि प्रत्येक दुकान वेगळे ठेवा.',
    shopLogins: 'दुकान लॉगिन',
    cloudData: 'लाईव्ह स्टॉक',
    profitView: 'रीस्टॉक यादी',
    shopAccess: 'मालक + दुकान',
    everyProduct: 'प्रत्येक उत्पादन',
    lowStockFocus: 'कमी स्टॉक फोकस',
    livePreview: 'लाईव्ह स्टोअर प्रिव्ह्यू',
    dailyClosing: 'डेली क्लोजिंग',
    stockWatch: 'स्टॉक वॉच',
    secureAccess: 'सुरक्षित अॅक्सेस',
    readyForToday: 'आजसाठी तयार',
    shop: 'दुकान',
    action: 'कृती',
    productSection: 'प्रॉडक्ट',
    myStore: 'माझे स्टोअर',
    pcsLeft: 'पीस बाकी',
    unitPcs: 'पीस',
    storeControl: 'स्टोअर कंट्रोल',
    restockPriority: 'रीस्टॉक प्राधान्य',
    allInventory: 'सर्व इन्व्हेंटरी',
    stockCount: 'स्टॉक काउंट',
    fastMoving: 'फास्ट मूव्हिंग',
    catalog: 'कॅटलॉग',
    dailyClosingPanel: 'डेली क्लोजिंग',
    inventoryControl: 'इन्व्हेंटरी कंट्रोल',
    searchProduct: 'प्रॉडक्ट शोधा',
    sortProducts: 'प्रॉडक्ट सॉर्ट करा',
    needsRestock: 'रीस्टॉक पाहिजे',
    showAllItems: 'सर्व आयटम दाखवा',
    storeSnapshot: 'स्टोअर स्नॅपशॉट',
    inventoryItems: 'इन्व्हेंटरी आयटम',
    noItem: 'आयटम नाही',
    soldToday: 'आज विकले',
    revenueLabel: 'रेव्हेन्यू',
    profitLabel: 'नफा',
    sellBuy: 'विक्री / खरेदी',
    needed: 'पाहिजे',
    availableQty: 'उपलब्ध संख्या',
    updateQty: 'उपलब्ध संख्या अपडेट करा',
    chooseItem: 'प्रॉडक्ट निवडा',
    qtyHint: 'स्टॉक मोजल्यानंतर कोणताही दुकान प्रॉडक्ट निवडा आणि आजची उपलब्ध संख्या टाका.',
    addProductHint: 'दुकानात नवीन आयटम विकायला सुरू झाला की प्रॉडक्ट इथे जोडा.',
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
      topSeller: topSeller ? `${topSeller[0]} (${topSeller[1]} ${copy.unitPcs})` : copy.noSales,
      todaysSales,
    };
  }, [copy.noSales, copy.unitPcs, dashboard]);

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
      <main className="auth-shell min-h-screen text-[#20221f]">
        <section className="auth-grid mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-5">
          <div className="auth-topbar">
            <div className="auth-brand">
              <span className="auth-logo">SE</span>
              <div>
                <p>{copy.appName}</p>
                <span>{copy.eyebrow}</span>
              </div>
            </div>
            <div className="auth-actions">
              <LanguageToggle lang={lang} setLang={setLang} />
              <span>{copy.secureAccess}</span>
            </div>
          </div>

          <div className="auth-stage grid flex-1 items-center gap-7 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="auth-copy">
              <p className="auth-kicker">{copy.livePreview}</p>
              <h1>{copy.heroTitle}</h1>
              <p className="auth-lede">{copy.heroCopy}</p>
              <div className="landing-features">
                {[
                  { label: copy.shopLogins, value: copy.shopAccess },
                  { label: copy.cloudData, value: copy.everyProduct },
                  { label: copy.profitView, value: copy.lowStockFocus },
                ].map((feature) => (
                  <div key={feature.label} className="feature-tile">
                    <p>{feature.label}</p>
                    <span>{feature.value}</span>
                  </div>
                ))}
              </div>
              <div className="landing-preview">
                <div className="landing-preview-head">
                  <span>{copy.livePreview}</span>
                  <strong>{copy.inventoryControl}</strong>
                </div>
                <div className="landing-preview-grid">
                  <div>
                    <span>{copy.stockCount}</span>
                    <strong>{copy.availableQty}</strong>
                  </div>
                  <div>
                    <span>{copy.addItem}</span>
                    <strong>{copy.product}</strong>
                  </div>
                  <div>
                    <span>{copy.restockPriority}</span>
                    <strong>{copy.needsRestock}</strong>
                  </div>
                </div>
                <div className="landing-preview-row">
                  <span>{copy.updateQty}</span>
                  <strong>{copy.dailyClosingPanel}</strong>
                </div>
                <div className="landing-preview-row is-alert">
                  <span>{copy.addProductHint}</span>
                  <strong>{copy.addItemAction}</strong>
                </div>
              </div>
            </div>

            <div className="auth-panel-wrap">
              <div className="auth-summary">
                <div>
                  <span>{copy.dailyClosing}</span>
                  <strong>5 {copy.activeItems}</strong>
                </div>
                <div>
                  <span>{copy.stockWatch}</span>
                  <strong>3 {copy.restock}</strong>
                </div>
              </div>
              <form onSubmit={handleLogin} className="auth-card">
                <div className="auth-card-title">
                  <div>
                    <span>{copy.secureAccess}</span>
                    <h2>{copy.adminLogin}</h2>
                  </div>
                  <span className="auth-status">{message === 'Ready for today' ? copy.readyForToday : message || copy.readyForToday}</span>
                </div>
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
                <p className="sr-only" role="status" aria-live="polite">
                  {message}
                </p>
              </form>
              <p className="auth-footnote">
                {copy.todaySales} · {copy.todayProfit} · {copy.closingCount}
              </p>
            </div>
          </div>
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
              {isBusy ? copy.syncing : message === 'Ready for today' ? copy.readyForToday : message}
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
                        <th className="px-4 py-3">{copy.shop}</th>
                        <th className="px-4 py-3">{copy.area}</th>
                        <th className="px-4 py-3">{copy.username}</th>
                        <th className="px-4 py-3">{copy.item}</th>
                        <th className="px-4 py-3">{copy.action}</th>
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
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<'name' | 'stock' | 'sold' | 'profit' | 'restock'>('restock');
  const allCategoryLabel = copy.allInventory;
  const [categoryFilter, setCategoryFilter] = useState(allCategoryLabel);
  const [showOnlyRestock, setShowOnlyRestock] = useState(false);
  const salesByItem = useMemo(() => {
    return metrics.todaysSales.reduce<Record<string, { qty: number; revenue: number; profit: number }>>((acc, sale) => {
      const key = sale.itemId ?? sale.itemName;
      acc[key] = acc[key] ?? { qty: 0, revenue: 0, profit: 0 };
      acc[key].qty += sale.qty;
      acc[key].revenue += sale.qty * sale.soldPrice;
      acc[key].profit += sale.qty * (sale.soldPrice - sale.buyingPrice);
      return acc;
    }, {});
  }, [metrics.todaysSales]);
  const filteredItems = useMemo(() => {
    return dashboard.items
      .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
      .filter((item) => (categoryFilter === allCategoryLabel ? true : item.category === categoryFilter))
      .filter((item) => (showOnlyRestock ? item.stock <= item.reorderLevel : true))
      .sort((a, b) => {
        if (sortMode === 'stock') return b.stock - a.stock;
        if (sortMode === 'sold') return (salesByItem[b.id]?.qty ?? 0) - (salesByItem[a.id]?.qty ?? 0);
        if (sortMode === 'profit') return (salesByItem[b.id]?.profit ?? 0) - (salesByItem[a.id]?.profit ?? 0);
        if (sortMode === 'restock') return restockPriority(b) - restockPriority(a);
        return a.name.localeCompare(b.name);
      });
  }, [allCategoryLabel, categoryFilter, dashboard.items, query, salesByItem, showOnlyRestock, sortMode]);
  const winningItem = [...dashboard.items].sort((a, b) => (salesByItem[b.id]?.qty ?? 0) - (salesByItem[a.id]?.qty ?? 0))[0];
  const stockValue = dashboard.items.reduce((sum, item) => sum + item.stock * item.buyingPrice, 0);
  const categories = [allCategoryLabel, ...Array.from(new Set(dashboard.items.map((item) => item.category)))];

  return (
    <>
      <section className="commerce-dashboard mt-6">
        <aside className="commerce-sidebar">
          <div className="side-brand">
            <span className="status-dot" />
            <p>{copy.storeControl}</p>
          </div>
          <button type="button" className="side-link" onClick={() => setSortMode('sold')}>⌁ <span>{copy.todaySales}</span></button>
          <button type="button" className="side-link" onClick={() => setShowOnlyRestock(true)}>♧ <span>{copy.lowStockItems}</span><b>{metrics.lowStock.length}</b></button>
          <button type="button" className="side-link active" onClick={() => setSortMode('restock')}>◎ <span>{copy.restockPriority}</span></button>
          <button type="button" className="side-link" onClick={() => setSortMode('profit')}>▥ <span>{copy.todayProfit}</span><em>{money(metrics.profit)}</em></button>
          <p className="side-title">{copy.productSection}</p>
          <button type="button" className="side-link selected" onClick={() => { setCategoryFilter(allCategoryLabel); setShowOnlyRestock(false); }}>▰ <span>{copy.allInventory}</span></button>
          <button type="button" className="side-link" onClick={() => setSortMode('stock')}>♨ <span>{copy.stockCount}</span></button>
          <button type="button" className="side-link" onClick={() => setSortMode('sold')}>◌ <span>{copy.fastMoving}</span></button>
          <button type="button" className="side-link" onClick={() => setSortMode('name')}>◇ <span>{copy.catalog}</span></button>
          <p className="side-title">{copy.myStore}</p>
          <div className="category-block">
            <div className="category-heading">▧ {copy.category} <span>⌃</span></div>
            {categories.slice(1).map((name, index) => (
              <button key={name} type="button" onClick={() => setCategoryFilter(name)}>
                <i style={{ background: ['#ff5555', '#4968ff', '#23b44d'][index] }} />
                {name}
                <b>• {dashboard.items.filter((item) => item.category === name).length}</b>
              </button>
            ))}
          </div>
          <button type="button" className="side-link" onClick={() => setSortMode('profit')}>♧ <span>{copy.todayProfit}</span></button>
          <button type="button" className="side-link" onClick={() => setShowOnlyRestock(false)}>♙ <span>{copy.dailyClosingPanel}</span></button>
        </aside>

        <section className="commerce-main">
          <header className="commerce-topbar">
            <h2>{copy.inventoryControl}</h2>
            <label className="commerce-search">
              <span>⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.searchProduct}
                aria-label={copy.searchProduct}
              />
            </label>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as 'name' | 'stock' | 'sold' | 'profit' | 'restock')}
              aria-label={copy.sortProducts}
            >
              <option value="restock">{copy.restock}</option>
              <option value="stock">{copy.stock}</option>
              <option value="sold">{copy.soldToday}</option>
              <option value="profit">{copy.todayProfit}</option>
              <option value="name">{copy.itemName}</option>
            </select>
            <button type="button" onClick={() => setShowOnlyRestock((value) => !value)}>
              ▣ {showOnlyRestock ? copy.showAllItems : copy.needsRestock} <span>{metrics.lowStock.length}</span>
            </button>
          </header>

          <section className="commerce-stats">
            <h3>{copy.storeSnapshot}</h3>
            <div>
              <CommerceStat label={copy.inventoryItems} value={String(dashboard.items.length)} suffix={copy.product} />
              <CommerceStat label={copy.stockValue} value={money(stockValue)} />
              <CommerceStat label={copy.lowStockItems} value={String(metrics.lowStock.length)} suffix={copy.item} />
              <CommerceStat label={copy.highestSeller} value={metrics.topSeller === copy.noSales ? winningItem?.name ?? copy.noItem : metrics.topSeller} />
            </div>
          </section>

          <div className="commerce-products">
            {filteredItems.map((item) => {
              const saleStats = salesByItem[item.id] ?? salesByItem[item.name] ?? { qty: 0, revenue: 0, profit: 0 };
              const restock = item.stock <= item.reorderLevel;
              return (
                <article key={item.id} className="commerce-row">
                  <div className="commerce-product">
                    <div className="item-initial" aria-hidden="true">{item.name.slice(0, 1)}</div>
                    <div>
                      <h4>{item.name}</h4>
                      <p>{item.category}</p>
                    </div>
                  </div>
                  <div className="commerce-performance">
                    <p>{copy.soldToday} <span>{saleStats.qty} {copy.unitPcs}</span></p>
                    <div>
                      <span>{copy.revenueLabel} {money(saleStats.revenue)}</span>
                      <span>{copy.profitLabel} {money(saleStats.profit)}</span>
                    </div>
                  </div>
                  <div className="commerce-info">
                    <p>{copy.availableQty}</p>
                    <span>◇ {item.stock} {copy.unitPcs}</span>
                  </div>
                  <div className="commerce-info">
                    <p>{copy.sellBuy}</p>
                    <span>{money(item.defaultSellingPrice)} / {money(item.buyingPrice)}</span>
                  </div>
                  <div className="commerce-visible">
                    <p>{copy.restock}</p>
                    <span className={restock ? 'restock-pill alert' : 'restock-pill'}>{restock ? copy.needed : copy.ok}</span>
                  </div>
                  <div className="commerce-actions">
                    <input
                      aria-label={`${copy.availableQty} for ${item.name}`}
                      type="number"
                      min="0"
                      defaultValue={item.stock}
                      onBlur={(event) => {
                        const nextStock = Number(event.target.value);
                        if (nextStock !== item.stock) void updateClosingCount(item.id, nextStock);
                      }}
                    />
                    <button type="button" aria-label={`${copy.chooseItem} ${item.name}`} onClick={() => setSelectedItemId(item.id)}>
                      {copy.view}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>

      <div className="management-strip mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="panel border border-[#d8d3c5] bg-white p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const itemId = String(form.get('itemId') || selectedItemId);
              const stock = Number(form.get('availableQty'));
              if (itemId && Number.isFinite(stock)) void updateClosingCount(itemId, stock);
            }}
          >
            <h2 className="text-lg font-semibold">{copy.updateQty}</h2>
            <p className="mt-2 text-sm text-[#62655f]">{copy.qtyHint}</p>
            <label className="mt-4 block text-sm font-medium" htmlFor="sale-item">
              {copy.chooseItem}
            </label>
            <select
              id="sale-item"
              name="itemId"
              value={selectedItemId}
              onChange={(event) => setSelectedItemId(event.target.value)}
              className="mt-2 w-full border border-[#cfc8b8] px-3 py-3"
            >
              {dashboard.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {item.stock} {copy.pcsLeft}
                </option>
              ))}
            </select>
            <Field
              key={selectedItemId}
              label={copy.availableQty}
              name="availableQty"
              type="number"
              defaultValue={String(selectedItem?.stock ?? 0)}
            />
            <button className="mt-4 w-full bg-[#2d6a4f] px-4 py-3 font-semibold text-white">
              {copy.updateQty}
            </button>
          </form>
        </section>

        <form onSubmit={handleAddItem} className="panel border border-[#d8d3c5] bg-white p-4">
          <h2 className="text-lg font-semibold">{copy.addItem}</h2>
          <p className="mt-2 text-sm text-[#62655f]">{copy.addProductHint}</p>
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
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="panel border border-[#d8d3c5] bg-white p-4">
          <h2 className="text-lg font-semibold">{copy.lowStockAnalysis}</h2>
          <div className="mt-3 space-y-2">
            {metrics.lowStock.length ? (
              metrics.lowStock.map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-[#fbf1e8] px-3 py-2 text-sm">
                  <span>{item.name}</span>
                  <span>{item.stock} {copy.pcsLeft}</span>
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

function CommerceStat({
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
    <article className="commerce-stat">
      <p>{label}</p>
      <strong>
        {gauge ? <span className="tiny-gauge" /> : null}
        {value}
        {suffix ? <em>{suffix}</em> : null}
      </strong>
    </article>
  );
}

function restockPriority(item: Item) {
  if (item.stock <= item.reorderLevel) return 1000 + (item.reorderLevel - item.stock);
  return Math.max(0, item.reorderLevel * 4 - item.stock);
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
