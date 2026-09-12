'use client';

import { createClient } from '@supabase/supabase-js';
import { FormEvent, memo, useEffect, useEffectEvent, useRef, useState } from 'react';
import RetailWorkspace from './retail/RetailWorkspace';
import InventoryWorkspace from './inventory/InventoryWorkspace';
import VoiceInput from './retail/VoiceInput';
import { readLocal, writeLocal, clearLocalSession, listLocal } from './retail/offline';
import LandingPage from './landing/LandingPage';
import { money } from './inventory/domain';

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
  active: boolean;
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
    ownerDashboard: 'Super Admin · All Shops',
    shopAccounts: 'Shop accounts',
    credentialsHint: 'Credentials are revealed only when generated or reset',
    addNewShop: 'Add new shop',
    shopName: 'Shop name',
    area: 'Area',
    generateLogin: 'Generate shop login',
    newShopHint: 'New stores start empty. Add the products your shop actually sells.',
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
    ownerDashboard: 'सुपर अॅडमिन · सर्व दुकाने',
    shopAccounts: 'दुकान खाती',
    credentialsHint: 'क्रेडेन्शियल्स फक्त तयार किंवा रीसेट केल्यावर दिसतील',
    addNewShop: 'नवीन दुकान जोडा',
    shopName: 'दुकानाचे नाव',
    area: 'एरिया',
    generateLogin: 'दुकान लॉगिन जनरेट करा',
    newShopHint: 'नवीन दुकानात साठा रिकामा असेल. दुकानात विकली जाणारी उत्पादने जोडा.',
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

const cleanSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

function generatePassword() {
  return `Store@${Array.from(crypto.getRandomValues(new Uint8Array(12)), n => n.toString(16).padStart(2, '0')).join('')}`;
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
  const shopRequest = useRef(0);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [message, setMessage] = useState('Ready for today');
  const [credentialNote, setCredentialNote] = useState<CredentialNote | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [lang, setLang] = useState<Lang>('en');
  function changeLanguage(value: Lang) { setLang(value); window.localStorage.setItem('store-language', value); }
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const copy = dictionary[lang];

  const restorePreferences = useEffectEvent(() => {
    setLang(window.localStorage.getItem('store-language') === 'mr' ? 'mr' : 'en');
    const saved = window.localStorage.getItem(sessionKey);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as Session;
      if (!parsed.token || !['owner', 'shop'].includes(parsed.role) || (parsed.role === 'shop' && !parsed.shopId)) throw new Error('Invalid saved session');
      setSession(parsed);
      void loadAfterLogin(parsed);
    } catch {
      window.localStorage.removeItem(sessionKey);
    }
  });
  // Restore external browser storage once after hydration; the server cannot read it.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { restorePreferences(); }, []);

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
    if (!navigator.onLine) {
      const cached = await readLocal<{shops: ShopAccount[]; summary: OwnerSummary; at:number}>(token+':owner');
      if (!cached || Date.now()-cached.at>12*60*60*1000) throw new Error('Connect to load your shops.');
      setShops(cached.shops); setOwnerSummary(cached.summary);
      const id=preferredShopId||cached.shops[0]?.id;
      if(id) await loadShop(token,id);
      return;
    }
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
      active: shop.active !== false,
    }));

    setOwnerSummary({
      shopCount: toNumber(summary.shopCount),
      revenue: toNumber(summary.revenue),
      profit: toNumber(summary.profit),
      inventoryValue: toNumber(summary.inventoryValue),
      lowStockCount: toNumber(summary.lowStockCount),
    });
    setShops(shopRows);
    void writeLocal(token+':owner',{shops:shopRows,summary:{shopCount:toNumber(summary.shopCount),revenue:toNumber(summary.revenue),profit:toNumber(summary.profit),inventoryValue:toNumber(summary.inventoryValue),lowStockCount:toNumber(summary.lowStockCount)},at:Date.now()}).catch(()=>{});

    const nextShopId = preferredShopId && shopRows.some((shop) => shop.id === preferredShopId)
      ? preferredShopId
      : shopRows[0]?.id ?? '';
    setSelectedShopId(nextShopId);
    if (nextShopId) await loadShop(token, nextShopId);
    else { setDashboard(null); setOwnerOpen(true); }
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
    const request = ++shopRequest.current;
    if(!navigator.onLine){
      const cached=await readLocal<{data:ShopDashboardData;at:number}>(token+':base:'+shopId);
      if(!cached||Date.now()-cached.at>12*60*60*1000)throw new Error('Connect once to load this shop.');
      if(request===shopRequest.current){setDashboard(cached.data);setSelectedShopId(shopId);}return;
    }
    const { data, error } = await getSupabaseClient().rpc('get_shop_dashboard', {
      p_token: token,
      p_shop_id: shopId,
    });
    if (request !== shopRequest.current) return;
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
    void writeLocal(token+':base:'+shopId,{data:{shop:{id:String(shop.id),name:String(shop.name),area:String(shop.area),username:String(shop.username)},items,todaysSales},at:Date.now()}).catch(()=>{});
    setShops(current => current.map(account => account.id === String(shop.id) ? { ...account, itemCount: items.length } : account));

  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get('username') || '').trim();
    const password = String(form.get('password') || '');

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

  async function selectShop(shopId: string) {
    if (!session || isBusy) return;
    setIsBusy(true);
    setDashboard(null);
    try { await loadOwner(session.token, shopId); }
    catch (error) { setMessage(error instanceof Error ? error.message : copy.loading); }
    finally { setIsBusy(false); }
  }

  async function handleLogout() {
    const token = session?.token;
    if(token){
      const entries=await listLocal<{shopId?:string}>(token+':').catch(()=>[]);
      if(entries.some(entry=>entry?.shopId)){setMessage('Sync pending bills before logging out to avoid losing unsynced sales.');return;}
      await clearLocalSession(token).catch(()=>{});
    }
    shopRequest.current += 1;
    setSession(null);
    setDashboard(null);
    setCredentialNote(null);
    window.localStorage.removeItem(sessionKey);
    if (token) {
      try { await getSupabaseClient().rpc('logout_user', { p_token: token }); }
      catch { /* Local sign-out still completes if the network is unavailable. */ }
    }
  }

  async function handleAddShop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
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
      formElement.reset();
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

  async function updateShop(shop: ShopAccount, name: string, area: string, active: boolean) {
    if (!session || isBusy) return;
    setIsBusy(true);
    try {
      const { error } = await getSupabaseClient().rpc('admin_update_shop', {
        p_token: session.token, p_shop_id: shop.id, p_name: name, p_area: area, p_active: active,
      });
      if (error) throw new Error(error.message);
      setMessage(active ? `${name} updated and active` : `${name} paused. Shop sessions revoked.`);
      await loadOwner(session.token, selectedShopId);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update shop'); }
    finally { setIsBusy(false); }
  }

  if (!session) {
    return (
<LandingPage lang={lang} languageToggle={<LanguageToggle lang={lang} setLang={changeLanguage} />}><form onSubmit={handleLogin} className="auth-card">
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
        <VoiceInput
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
                <VoiceInput
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="mt-2 w-full border border-[#cfc8b8] px-3 py-3 outline-none focus:border-[#2d6a4f]"
                  placeholder=""
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
              </form></LandingPage>
    );
  }

  return (
    <main className="dashboard-shell min-h-screen">
      <header className="dashboard-header border-b border-[#ddd7c7] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[#66735c]">{copy.appName}</p>
            <h1 className="text-2xl font-semibold">
              {session.role === 'owner' ? copy.ownerDashboard : copy.inventoryControl}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <LanguageToggle lang={lang} setLang={changeLanguage} />
            <span className="border border-[#d8d3c5] bg-[#f8f7f2] px-3 py-2">
              {isBusy ? copy.syncing : message === 'Ready for today' ? copy.readyForToday : message}
            </span>
            <button type="button" onClick={handleLogout} className="border border-[#20221f] px-3 py-2">
              {copy.logout}
            </button>
          </div>
        </div>
      </header>

      <section className="workspace-container">
        {session.role === 'owner' ? (
          <details className="owner-controls" open={ownerOpen} onToggle={e => setOwnerOpen(e.currentTarget.open)}><summary>{copy.shopAccounts}</summary>
            <p role="status" className="mb-4 text-sm">{isBusy ? copy.syncing : message === 'Ready for today' ? copy.readyForToday : message}</p>
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
                          <td className="px-4 py-3 font-medium">{shop.name}<span className="ml-2 text-xs">{shop.active ? 'Active' : 'Paused'}</span></td>
                          <td className="px-4 py-3">{shop.area}</td>
                          <td className="px-4 py-3 font-mono text-xs">{shop.username}</td>
                          <td className="px-4 py-3">{shop.itemCount}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void selectShop(shop.id)}
                                className="border border-[#2d6a4f] px-3 py-2 text-[#2d6a4f]"
                              >
                                {copy.view}
                              </button>
                              <details>
                                <summary className="cursor-pointer p-2">Edit / access</summary>
                                <form className="grid gap-2 py-3" onSubmit={e => {
                                  e.preventDefault();
                                  const f = new FormData(e.currentTarget);
                                  void updateShop(shop, String(f.get('name')), String(f.get('area')), f.get('active') === 'on');
                                }}>
                                  <label>Shop name<VoiceInput name="name" defaultValue={shop.name} required maxLength={120} className="block border p-2" /></label>
                                  <label>Area<VoiceInput name="area" defaultValue={shop.area} required maxLength={120} className="block border p-2" /></label>
                                  <label><VoiceInput type="checkbox" name="active" defaultChecked={shop.active} /> Shop active</label>
                                  <button disabled={isBusy} className="border p-2">Save shop</button>
                                </form>
                              </details>
                              <button
                                type="button"
                                onClick={() => void resetShopPassword(shop.id)}
                                disabled={isBusy}
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
                  disabled={isBusy}
                  onChange={event => void selectShop(event.target.value)}
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
          </details>
        ) : null}

        {session.role === 'owner' && shops.length > 0 && <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-[#d5e1da] bg-white p-3">
          <label htmlFor="active-shop">{lang === 'mr' ? 'दुकान निवडा' : 'Working in shop'}</label>
          <select id="active-shop" value={selectedShopId} disabled={isBusy} onChange={e => void selectShop(e.target.value)} className="rounded border p-2">
            {shops.map(shop => <option key={shop.id} value={shop.id}>{shop.name}{shop.active ? '' : ' (Paused)'}</option>)}
          </select>
          <button className="ml-auto rounded border px-3 py-2" onClick={() => setOwnerOpen(true)}>{lang === 'mr' ? 'दुकाने व्यवस्थापित करा' : 'Manage / add shops'}</button>
        </div>}

        {dashboard ? (
          <RetailWorkspace
            fallback={<InventoryWorkspace data={dashboard} lang={lang} rpc={async (name, args) => {
              const { data, error } = await getSupabaseClient().rpc(name, { ...args, p_token: session.token });
              if (error) throw new Error(`${error.code}: ${error.message}`);
              return data;
            }} refresh={async () => {
              await loadShop(session.token, dashboard.shop.id);
              if (session.role === 'owner') await loadOwnerSummary(session.token);
            }} />}
            key={dashboard.shop.id}
            sessionId={session.token}
            shopId={dashboard.shop.id}
            lang={lang}
            rpc={async (name, args) => {
              const { data, error } = await getSupabaseClient().rpc(name, { ...args, p_token: session.token });
              if (error) throw new Error(`${error.code}: ${error.message}`);
              return data;
            }}
            onChanged={async () => {
              await loadShop(session.token, dashboard.shop.id);
              if (session.role === 'owner') await loadOwnerSummary(session.token);
            }}
          />
        ) : (
          <section className="workspace-empty" role="status">{isBusy ? copy.loading : shops.length === 0 && session.role === 'owner' ? copy.addNewShop : message}
            {!isBusy && <button onClick={() => void loadAfterLogin(session)}>{lang === 'mr' ? 'पुन्हा प्रयत्न करा' : 'Retry'}</button>}
          </section>
        )}
      </section>
    </main>
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
      <VoiceInput
        name={name}
        aria-label={label}
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

