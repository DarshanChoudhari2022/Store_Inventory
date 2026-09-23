"use client";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Package,
  ShoppingCart,
  Users,
  Truck,
  ReceiptText,
  Wallet,
  ChartNoAxesCombined,
  Settings,
  Repeat,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  Barcode,
  Store,
  Menu,
  X,
  Flame,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  Star,
  EyeOff,
  FileSpreadsheet,
} from "lucide-react";
import dynamic from 'next/dynamic';
const ReportsPanel = dynamic(() => import('./ReportsPanel'), { ssr: false, loading: () => <p role="status">Loading reports…</p> });
import {
  cash,
  monthStart,
  productName,
  today,
  lineTotal,
  report,
  downloadCsv,
  parseCsv,
  type CartLine,
  type Product,
  type Workspace,
  type Invoice,
} from "./domain";
import Receipt from "./Receipt";
import type {HeldRef} from "./HeldBills";
const HeldBills=dynamic(()=>import("./HeldBills"),{ssr:false});
import ScanBarcode from "./ScanBarcode";
import BarcodeLabel from "./BarcodeLabel";
const PurchaseScan = dynamic(() => import('./PurchaseScan'), {ssr:false});
const DeliveryPlanner = dynamic(() => import('./DeliveryPlanner'), {ssr:false});
const Quotes = dynamic(() => import('./Quotes'), {ssr:false});
import VoiceInput from "./VoiceInput";
import Appearance from './Appearance';
import DeleteProductDialog from './DeleteProductDialog';
import {
  readLocal,
  writeLocal,
  listLocal,
  removeLocal,
  recoverShopPending,
  isNetworkFailure,
  type PendingSale,
} from "./offline";
import "./retail.css";

type Rpc = (name: string, args: Record<string, unknown>) => Promise<unknown>;
type View =
  | "sell"
  | "products"
  | "bills"
  | "quotes"
  | "customers"
  | "suppliers"
  | "purchases"
  | "cash"
  | "reports"
  | "recurring"
  | "settings";
type Dialog = { type: string; product?: Product; id?: string };
type SplitTender = {cash:string;upi:string;card:string};
const emptySplit=():SplitTender=>({cash:"",upi:"",card:""});
type TenderDraft = {held?:HeldRef|null;split?:SplitTender;contactId:string;method:string;paid:string;reference:string;interstate:boolean;supplyState:string};
type SavedDraft = TenderDraft & { cart: CartLine[]; purchaseCart: CartLine[]; view: View; details?: Record<string,TenderDraft> };
const emptyTender = ():TenderDraft => ({contactId:'',method:'cash',paid:'',reference:'',interstate:false,supplyState:''});
export default function RetailWorkspace({
  shopId,
  sessionId,
  lang,
  staffRole,
  accountRole,
  rpc,
  onChanged,
  fallback,
}: {
  shopId: string;
  sessionId: string;
  lang: "en" | "mr";
  staffRole?: "cashier" | "manager";
  accountRole?: "owner" | "shop";
  rpc: Rpc;
  onChanged: () => Promise<void>;
  fallback?: ReactNode;
}) {
  const t = (a: string, b: string) => (lang === "mr" ? b : a);
  const isOwner = accountRole === "owner";
  const namespace = `${sessionId}:${shopId}`;
  const [scan, setScan] = useState(false),
    [labelProduct, setLabelProduct] = useState<Product | null>(null);
  const [purchaseScan, setPurchaseScan] = useState(false);
  const [deleteProduct,setDeleteProduct]=useState<Product|null>(null);
  const [pending, setPending] = useState<PendingSale[]>([]),
    [offline, setOffline] = useState(false),
    [draftReady, setDraftReady] = useState(false);
  const [data, setData] = useState<Workspace | null>(null),
    [view, setView] = useState<View>("sell"),
    [from, setFrom] = useState(monthStart()),
    [to, setTo] = useState(today()),
    [datePreset, setDatePreset] = useState<"month" | "today" | "7d" | "custom">("month");
  const [query, setQuery] = useState(""),
    [lookupProducts, setLookupProducts] = useState<Product[]>([]),
    [productCache, setProductCache] = useState<Product[]>([]),
    [category, setCategory] = useState(""),
    [low, setLow] = useState(false),
    [aging, setAging] = useState<Record<string, number> | null>(null),
    [cart, setCart] = useState<CartLine[]>([]),
    [purchaseCart, setPurchaseCart] = useState<CartLine[]>([]);
  const [held,setHeld]=useState<HeldRef|null>(null);
  const [split,setSplit]=useState<SplitTender>(emptySplit);
  const [contactId, setContactId] = useState(""),
    [method, setMethod] = useState("cash"),
    [paid, setPaid] = useState(""),
    [reference, setReference] = useState(""),
    [interstate, setInterstate] = useState(false),
    [supplyState, setSupplyState] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null),
    [receipt, setReceipt] = useState<Invoice | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [selectedContact, setSelectedContact] = useState(""),
    [pages, setPages] = useState<Record<string, number>>({}),
    [navOpen, setNavOpen] = useState(false);
  const lock = useRef(false),
    request = useRef<{ key: string; id: string } | null>(null),
    generation = useRef(0);
  const rpcRef = useRef(rpc);
  const basketDetails = useRef<Record<string,TenderDraft>>({sell:emptyTender(),purchases:emptyTender()});
  useEffect(() => {
    let alive = true;
    void Promise.all([
      readLocal<CartLine[] | SavedDraft>(namespace + ":cart"),
      listLocal<PendingSale>(namespace + ":sale:"),
    ])
      .then(([draft, sales]) => {
        if (alive) {
          if (Array.isArray(draft)) setCart(draft);
          else if (draft) {
            if(draft.details)basketDetails.current=draft.details;
            setCart(draft.cart || []); setPurchaseCart(draft.purchaseCart || []);
            setContactId(draft.contactId || ''); setMethod(draft.method || 'cash'); setPaid(draft.paid || '');setSplit(draft.split||emptySplit());setHeld(draft.held||null);
            setReference(draft.reference || ''); setInterstate(Boolean(draft.interstate)); setSupplyState(draft.supplyState || '');
            if (draft.view === 'purchases') setView('purchases');
          }
          setPending(sales);
          setDraftReady(true);
        }
      })
      .catch(() => {
        if (alive) setDraftReady(true);
      });
    const change = () => setOffline(!navigator.onLine);
    change();
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      void navigator.serviceWorker.register("/retail-sw.js").then(() => navigator.serviceWorker.ready).then(registration => {
        const assets = performance.getEntriesByType('resource').map(entry => entry.name).filter(url => url.includes('/_next/static/'));
        registration.active?.postMessage({type:'CACHE_APP_ASSETS',assets});
      }).catch(() => {});
    return () => {
      alive = false;
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
    };
  }, [namespace]);
  useEffect(() => {
    let alive = true;
    void readLocal<Product[]>(namespace + ":product-cache")
      .then((products) => {
        if (alive && Array.isArray(products)) setProductCache(products);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [namespace]);
  useEffect(() => {
    if (draftReady) void writeLocal(namespace + ":cart", {cart, purchaseCart, contactId, method, paid, split, held, reference, interstate, supplyState, view,details:basketDetails.current}).catch(() => {});
  }, [cart, purchaseCart, contactId, method, paid, split, held, reference, interstate, supplyState, view, draftReady, namespace]);
  useEffect(() => {
    rpcRef.current = rpc;
  }, [rpc]);
  const historyOffset = (pages[view==='bills'?'invoices':'movements'] || 0)*50;
  const catalogView = ['products','customers','suppliers'].includes(view);
  const catalogOffset = catalogView ? (pages[view==='products'?'products':'contacts'] || 0)*50 : 0;
  const catalogQuery = catalogView ? query.trim() : '';
  const catalogLow = view==='products' && low;
  const changeQuery = (value: string) => {
    setQuery(value.slice(0,200));
    setPages(current => ({...current, products:0, contacts:0}));
    setSelectedContact('');
  };
  const workspaceKey = `${namespace}:workspace:${view}`;
  const reload = useCallback(async () => {
    const n = ++generation.current;
    const cached = await readLocal<{ value: Workspace; at: number; from:string; to:string }>(workspaceKey);
    const cacheMatches = cached && Date.now() - cached.at < 12 * 60 * 60 * 1000 && (view==='sell' || (cached.from===from && cached.to===to && cached.value.pageOffset===historyOffset && cached.value.catalogOffset===catalogOffset && cached.value.catalogQuery===catalogQuery && cached.value.catalogLow===catalogLow));
    if (cacheMatches && n === generation.current) { setData(cached.value); setOffline(false); }
    const restoreWorkspace = async () => {
      if (cacheMatches) {
        if (n === generation.current) setOffline(true);
        return;
      }
      throw new Error(
        "Connect once to load this shop. Offline access expires after 12 hours.",
      );
    }
    if (!navigator.onLine) return restoreWorkspace();
    let w: Workspace;
    try {
      const workspacePromise = rpcRef.current("retail_workspace_scoped", {
        p_shop_id: shopId,
        p_from: from,
        p_to: to,
        p_view: view,
        p_offset: historyOffset,
        p_catalog_offset: catalogOffset,
        p_query: catalogQuery,
        p_low: catalogLow,
      }) as Promise<Workspace>;
      const summaryPromise = staffRole !== 'cashier' && ['cash','reports'].includes(view)
        ? rpcRef.current("retail_report",{p_shop_id:shopId,p_from:from,p_to:to}) as Promise<NonNullable<Workspace["summary"]>>
        : Promise.resolve(null);
      const [workspaceResult, summaryResult] = await Promise.all([workspacePromise, summaryPromise]);
      w = workspaceResult;
      if (summaryResult) w.summary = summaryResult;
    } catch (error) {
      if (isNetworkFailure(error)) return restoreWorkspace();
      throw error;
    }
    if (n === generation.current) {
      await recoverShopPending(shopId, namespace);
      setPending(await listLocal<PendingSale>(namespace + ':sale:'));
      if (n !== generation.current) return;
      const catalogKey = view==='products' ? 'products' : 'contacts';
      const total = w.pageTotals?.[catalogKey];
      if (catalogView && total!==undefined && catalogOffset>0 && catalogOffset>=total) {
        setPages(current=>({...current,[catalogKey]:Math.max(0,Math.ceil(total/50)-1)}));
        setSelectedContact('');
        return;
      }
      setOffline(false);
      setData(w);
      void writeLocal(workspaceKey, {
        value: w,
        from,to,
        at: Date.now(),
      }).catch(() => {});
    }
  }, [shopId, from, to, namespace,staffRole,view,historyOffset,workspaceKey,catalogOffset,catalogQuery,catalogLow,catalogView]);
  useEffect(() => {
    let alive = true;
    const counter = generation;
    reload().catch((e) => {
      if (alive) setError(String(e.message));
    });
    return () => {
      alive = false;
      counter.current++;
    };
  }, [reload]);
  useEffect(() => {
    const focus = () => {
      if (!lock.current) reload().catch(() => {});
    };
    window.addEventListener("focus", focus);
    window.addEventListener("online", focus);
    return () => {
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", focus);
    };
  }, [reload]);
  const perform = async (action: string, payload: Record<string, unknown>) => {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const key = JSON.stringify({ action, payload });
    if (!request.current || request.current.key !== key)
      request.current = { key, id: crypto.randomUUID() };
    let salePersisted = false;
    try {
      if (action === "checkout") {
        const sale: PendingSale = {
          id: request.current.id,
          shopId,
          data: payload,
          created: new Date().toISOString(),
        };
        await writeLocal(namespace + ":sale:" + sale.id, sale);
        salePersisted = true;
        setPending(await listLocal<PendingSale>(namespace + ":sale:"));
        if (!navigator.onLine) {
          request.current = null;
          setNotice(
            "Bill queued on this device. Connect and sync to receive the final invoice.",
          );
          return { queued: true };
        }
      } else if (!navigator.onLine) {
        throw new Error(
          "This operation needs a connection. Your entries are still here.",
        );
      }
      const result = await rpcRef.current(action === "contact_edit" ? "retail_contact_update" : action==="checkout" ? "retail_counter_checkout" : "retail_action", {
        p_shop_id: shopId,
        p_request_id: request.current.id,
        ...(action === "contact_edit" || action==="checkout" ? {} : {p_action: action}),
        p_data: payload,
      });
      if (action === "checkout") {
        await removeLocal(namespace + ":sale:" + request.current.id);
        setPending(await listLocal<PendingSale>(namespace + ":sale:"));
      }
      request.current = null;
      setNotice(t("Saved successfully", "यशस्वीपणे जतन झाले"));
      try {
        await reload();
        await onChanged();
      } catch {
        setNotice(
          t(
            "Saved. Refresh to see the latest data.",
            "जतन झाले. नवीन माहितीसाठी रीफ्रेश करा.",
          ),
        );
      }
      return result;
    } catch (e) {
      if (action === "checkout" && request.current && salePersisted) {
        // Definitive database rejection rolls back. Network failures retain the exact request for retry.
        const message = e instanceof Error ? e.message : "";
        if (/P0001|22P02|23505|23514|23502/.test(message)) {
          await removeLocal(namespace + ":sale:" + request.current.id);
          setPending(await listLocal<PendingSale>(namespace + ":sale:"));
        } else {
          request.current = null;
          setCart([]);
          setError(
            "The bill is pending confirmation. Use Sync pending bills before re-entering it.",
          );
          return { queued: true };
        }
      }
      setError(e instanceof Error ? e.message : "Could not save");
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const syncPending = async (automatic = false) => {
    if (lock.current || !navigator.onLine) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const sales = await listLocal<PendingSale>(namespace + ":sale:");
      if (!sales.some(s => !s.rejection)) return;
      for (const sale of sales.sort((a, b) =>
        a.created.localeCompare(b.created),
      )) {
        if (sale.rejection) continue;
        let i: Invoice;
        try {
        i = (await rpcRef.current("retail_counter_checkout", {
          p_shop_id: shopId,
          p_request_id: sale.id,
          p_data: sale.data,
        })) as Invoice;
        } catch (e) {
          const message = e instanceof Error ? e.message : "Connection failed";
          if (/P0001|22P02|23505|23514|23502/.test(message)) {
            await writeLocal(namespace + ":sale:" + sale.id, { ...sale, rejection: message });
            continue;
          }
          throw e;
        }
        await removeLocal(namespace + ":sale:" + sale.id);
        if (!automatic) setReceipt(i);
      }
      setPending(await listLocal<PendingSale>(namespace + ":sale:"));
      await reload();
      await onChanged();
      setNotice(
        "Sync finished. Any rejected bills below need correction; they have not been posted.",
      );
    } catch (e) {
      setPending(await listLocal<PendingSale>(namespace + ":sale:"));
      setError(
        `Sync stopped; the pending bill is retained: ${e instanceof Error ? e.message : "Connection failed"}`,
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const synchronize = useEffectEvent(() => { if (data && !lock.current) void syncPending(true); });
  const shopReady = Boolean(data);
  useEffect(() => {
    if (!shopReady) return;
    synchronize();
    const online = () => synchronize();
    window.addEventListener('online', online);
    const timer = window.setInterval(online, 30000);
    return () => { window.removeEventListener('online', online); window.clearInterval(timer); };
  }, [shopReady, namespace]);
  const flagEnabled = (flag: keyof NonNullable<Workspace["flags"]>, fallbackValue = true) => data?.flags?.[flag] ?? fallbackValue;
  const gstEnabled = flagEnabled('gst');
  const bulkImportEnabled = flagEnabled('bulk_import');
  const recurringEnabled = flagEnabled('recurring_billing');
  const ocrJobsEnabled = flagEnabled('ocr_jobs');
  const accountingEnabled = flagEnabled('accounting', false);
  const allNav: [View, string, string, typeof Package][] = [
    ["sell", "Sell", "विक्री", ShoppingCart],
    ["products", "Products", "उत्पादने", Package],
    ["bills", "Bills", "बिले", ReceiptText],
    ["quotes", "Quotations & orders", "कोटेशन व ऑर्डर", ReceiptText],
    ["customers", "Customers", "ग्राहक", Users],
    ["suppliers", "Suppliers", "पुरवठादार", Truck],
    ["purchases", "Purchases", "खरेदी", Store],
    ["cash", "Cash & expenses", "रोकड व खर्च", Wallet],
    ["reports", "Reports", "अहवाल", ChartNoAxesCombined],
    ["recurring", "Recurring bills", "नियमित बिले", Repeat],
    ["settings", "Shop settings", "दुकान सेटिंग्ज", Settings],
  ];
  const nav = (staffRole === "cashier" ? allNav.filter(([v]) => ["sell","bills","customers"].includes(v)) : allNav).filter(([v]) => v !== 'recurring' || recurringEnabled);
  // A cashier may arrive with a manager's saved draft; return them to a permitted screen.
  useEffect(() => {
    if ((staffRole === "cashier" && !["sell","bills","customers"].includes(view)) || (view === "recurring" && data?.flags?.recurring_billing === false)) {
      const timer = window.setTimeout(() => setView("sell"), 0);
      return () => window.clearTimeout(timer);
    }
  }, [staffRole, view, data?.flags?.recurring_billing]);
  const purchasing = view === "purchases",
    currentCart = purchasing ? purchaseCart : cart,
    setCurrentCart = purchasing ? setPurchaseCart : setCart;
  const total = currentCart.reduce((n, l) => n + lineTotal(l), 0);
  const pageSize = 50;
  const rememberProducts = useCallback(
    (products: Product[]) => {
      if (!products.length) return;
      setProductCache((current) => {
        const merged = new Map<string, Product>();
        for (const product of [...products, ...current]) merged.set(product.id, product);
        const next = [...merged.values()].slice(0, 200);
        void writeLocal(namespace + ":product-cache", next).catch(() => {});
        return next;
      });
    },
    [namespace],
  );
  const productsById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const product of productCache) map.set(product.id, product);
    for (const product of data?.products || []) map.set(product.id, product);
    for (const product of lookupProducts) map.set(product.id, product);
    return map;
  }, [data?.products, lookupProducts, productCache]);
  const searchProducts = useCallback(
    async (value: string) => {
      const term = value.trim();
      if (!term) return data?.products.filter((p) => p.is_active !== false) || [];
      if (offline) {
        const lower = term.toLowerCase();
        const merged = new Map<string, Product>();
        for (const product of data?.products || []) merged.set(product.id, product);
        for (const product of productCache) merged.set(product.id, product);
        return [...merged.values()]
          .filter(
            (p) =>
              p.is_active !== false &&
              `${productName(p)} ${p.barcode} ${p.category}`.toLowerCase().includes(lower),
          )
          .slice(0, 50);
      }
      const found =
        ((await rpcRef.current("retail_product_lookup", {
          p_shop_id: shopId,
          p_query: term,
          p_limit: 50,
        })) as Product[]) || [];
      rememberProducts(found);
      return found;
    },
    [data?.products, offline, productCache, rememberProducts, shopId],
  );
  const pageOf = <T,>(key: string, rows: T[]) => {
    if (data?.pageTotals && ['products','contacts'].includes(key)) {
      return data.pageView===view && data.catalogOffset===catalogOffset && data.catalogQuery===catalogQuery && data.catalogLow===catalogLow ? rows : [];
    }
    if (data?.pageTotals && ['invoices','movements'].includes(key)) {
      return data.pageOffset===(pages[key]||0)*pageSize && data.pageView===view ? rows : [];
    }
    return rows.slice((pages[key]||0)*pageSize, ((pages[key]||0)+1)*pageSize);
  };
  const pager = (key: string, totalRows: number) => <Pagination page={pages[key] || 0} pages={Math.max(1, Math.ceil((data?.pageTotals?.[key] ?? totalRows) / pageSize))} onChange={(next) => {setPages(current => ({...current, [key]: next})); if(key==='contacts')setSelectedContact('');}} />;
  const setDateRange = (nextFrom: string, nextTo: string, preset: "month" | "today" | "7d" | "custom") => {
    setFrom(nextFrom);
    setTo(nextTo);
    setDatePreset(preset);
    setPages((current) => ({ ...current, invoices: 0, movements: 0 }));
  };
  const applyDatePreset = (preset: "month" | "today" | "7d" | "custom") => {
    if (preset === "custom") {
      setDatePreset("custom");
      return;
    }
    const end = today();
    if (preset === "today") setDateRange(end, end, preset);
    else if (preset === "month") setDateRange(monthStart(), end, preset);
    else {
      const start = new Date(`${end}T00:00:00+05:30`);
      start.setDate(start.getDate() - 6);
      setDateRange(start.toISOString().slice(0, 10), end, preset);
    }
  };
  const availableStock = (product: Product) => Math.max(0, product.stock - (offline ? pending.filter(sale => !sale.rejection).reduce((qty, sale) => qty + ((sale.data.lines as CartLine[]) || []).filter(line => line.id === product.id).reduce((n,line) => n + line.qty, 0), 0) : 0));
  const add = (p: Product) =>
    setCurrentCart((prev) => {
      rememberProducts([p]);
      const existing = prev.find((l) => l.id === p.id);
      return existing
        ? prev.map((l) =>
            l.id === p.id
              ? { ...l, qty: Math.round((l.qty + 1) * 1000) / 1000 }
              : l,
          )
        : [
            ...prev,
            {
              id: p.id,
              qty: 1,
              price: Number(
                purchasing ? p.buying_price : p.default_selling_price,
              ),
              discount: 0,
            },
          ];
    });
  const update = (id: string, key: keyof CartLine, value: number) =>
    setCurrentCart((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [key]: value } : l)),
    );
  const checkout = async () => {
    if(method==='split' && (Object.values(split).some(value=>!Number.isFinite(Number(value||0)) || Number(value||0)<0 || Math.round(Number(value||0)*100)/100!==Number(value||0)) || Object.values(split).filter(value=>Number(value)>0).length<2)){setError('Enter valid amounts in at least two payment methods.');return;}
    const enteredPaid = paid === '' ? Math.round(total * 100) / 100 : Number(paid);
    const amountPaid = method === 'split' ? Math.round(Object.values(split).reduce((n,v)=>n+Number(v||0),0)*100)/100 : method === 'credit' ? 0 : method === 'cash' ? Math.min(Math.round(total*100)/100,enteredPaid) : enteredPaid;
    if (!currentCart.length || currentCart.some(line => !Number.isFinite(line.qty) || line.qty <= 0 || !Number.isFinite(line.price) || line.price < 0 || line.discount < 0 || line.discount > 100)) { setError('Check every quantity, price and discount before saving.'); return; }
    if (!Number.isFinite(amountPaid) || amountPaid < 0 || amountPaid > Math.round(total*100)/100 || (amountPaid < Math.round(total*100)/100 && !contactId)) { setError('Choose a customer for credit and enter an amount between zero and the bill total.'); return; }
    if (!purchasing && currentCart.some(line => { const p = productsById.get(line.id); return !p || line.qty > availableStock(p) || (['pcs','pack'].includes(p.unit) && !Number.isInteger(line.qty)); })) { setError('Check available stock and quantities. Pending offline bills reserve stock on this device.'); return; }
    const result = await perform(purchasing ? "purchase" : "checkout", {
      lines: currentCart,
      contactId,
      method,
      paid: amountPaid,
      ...(!purchasing && held ? {held}:{}),
      ...(method==='split'?{tenders:Object.fromEntries(Object.entries(split).map(([key,value])=>[key,Number(value||0)]))}:{}),
      reference,
      interstate,
      supplyState,
    });
    if (result) {
      setCurrentCart([]);
      setPaid("");setSplit(emptySplit());setHeld(null);
      setContactId("");
      setReference("");
      if (!purchasing && !(result as { queued?: boolean }).queued)
        setReceipt(result as Invoice);
    }
  };
  const changeView = (v: View) => {
    if ((v === 'purchases') !== purchasing) {
      basketDetails.current[purchasing?'purchases':'sell']={contactId,method,paid,split,held,reference,interstate,supplyState};
      const next=basketDetails.current[v==='purchases'?'purchases':'sell'] || emptyTender();
      setContactId(next.contactId);setMethod(next.method);setPaid(next.paid);setSplit(next.split||emptySplit());setHeld(next.held||null);setReference(next.reference);setInterstate(next.interstate);setSupplyState(next.supplyState);
    }
    setView(v);
    setNavOpen(false);
    setQuery("");
    setCategory("");
    setLow(false);
    setSelectedContact("");
    setError("");
  };
  const startSupplierPurchase = (supplierId: string) => {
    basketDetails.current.purchases = { ...emptyTender(), contactId: supplierId, method: "cash" };
    changeView("purchases");
  };
  const rows =
    (view==='products' ? data?.products : view==='sell' && query.trim() ? lookupProducts : data?.products.filter(
      (p) =>
        p.is_active !== false &&
        (!category || p.category === category) &&
        (!low || p.stock <= p.reorder_level) &&
        `${productName(p)} ${p.barcode} ${p.category}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )) || [];
  const scanSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const p = (await searchProducts(query)).find((p) => p.barcode === query.trim() && p.is_active!==false);
    if (p) {
      add(p);
      setQuery("");
    } else
      setNotice(
        t(
          "No matching barcode. Search by product name.",
          "बारकोड जुळला नाही. नावाने शोधा.",
        ),
      );
  };
  const summary = data ? data.summary ?? report(data) : null;
  const productDashboardStats = useMemo(() => {
    const allProducts = data?.products || [];
    const activeProducts = allProducts.filter((p) => p.is_active !== false);
    const lowStockProducts = allProducts.filter((p) => p.stock <= p.reorder_level);

    const salesMap: Record<string, { qty: number; revenue: number }> = {};
    let totalItemsSold = 0;
    let totalSalesRevenue = 0;

    if (data?.productSales && Object.keys(data.productSales).length > 0) {
      Object.entries(data.productSales).forEach(([id, s]) => {
        const q = Number(s?.qty || 0);
        const rev = Number(s?.revenue || 0);
        salesMap[id] = { qty: q, revenue: rev };
        salesMap[id.toLowerCase()] = { qty: q, revenue: rev };
        totalItemsSold += q;
        totalSalesRevenue += rev;
      });
    } else {
      (data?.invoices || []).forEach((inv) => {
        (inv.lines || []).forEach((line) => {
          const key = line.id;
          if (!salesMap[key]) salesMap[key] = { qty: 0, revenue: 0 };
          const q = Number(line.qty || 1);
          const rev = Number(line.total || (line.price * q));
          salesMap[key].qty += q;
          salesMap[key].revenue += rev;
          totalItemsSold += q;
          totalSalesRevenue += rev;
        });
      });
    }

    let winningId = "";
    let maxSold = 0;
    Object.entries(salesMap).forEach(([id, s]) => {
      if (s.qty > maxSold) {
        maxSold = s.qty;
        winningId = id;
      }
    });
    const winningProduct = allProducts.find((p) => p.id === winningId) || allProducts[0];

    const healthyCount = activeProducts.filter((p) => p.stock > p.reorder_level).length;
    const healthPercent = activeProducts.length > 0 ? Math.round((healthyCount / activeProducts.length) * 100) : 100;
    const returnedCount = data?.returnedIds?.length || 0;

    return {
      totalProducts: allProducts.length,
      activeCount: activeProducts.length,
      lowStockCount: lowStockProducts.length,
      salesMap,
      totalItemsSold,
      totalSalesRevenue,
      winningProduct,
      winningSalesQty: maxSold,
      healthPercent,
      returnedCount,
    };
  }, [data]);
  const supplierStats = useMemo(() => {
    const suppliers = (data?.contacts || []).filter((c) => c.kind === "supplier");
    const purchases = data?.purchases || [];
    const purchaseTotal = purchases.reduce((sum, purchase) => sum + Number(purchase.total || 0), 0);
    const purchasePaid = purchases.reduce((sum, purchase) => sum + Number(purchase.paid || 0), 0);
    return {
      count: suppliers.length,
      totalDue: suppliers.reduce((sum, supplier) => sum + Number(supplier.balance || 0), 0),
      dueSuppliers: suppliers.filter((supplier) => Number(supplier.balance || 0) > 0).length,
      purchaseTotal,
      purchasePaid,
      purchaseUnpaid: Math.max(0, purchaseTotal - purchasePaid),
    };
  }, [data]);
  const toggleProductActive = async (p: Product) => {
    if (busy || offline) return;
    await perform("product", {
      id: p.id,
      name: p.name,
      category: p.category,
      cost: p.buying_price,
      price: p.default_selling_price,
      stock: p.stock,
      reorder: p.reorder_level,
      barcode: p.barcode,
      unit: p.unit,
      hsn: p.hsn,
      tax: p.tax_rate,
      expiry: p.expiry_date || "",
      style: p.style_code || "",
      size: p.size || "",
      colour: p.colour || "",
      mrp: p.mrp || "",
      active: p.is_active === false,
      expectedStock: p.stock,
    });
  };
  const getCatColorClass = (cat?: string) => {
    const c = (cat || "").toLowerCase();
    if (c.includes("groc") || c.includes("food") || c.includes("tea")) return "cat-grocery";
    if (c.includes("shirt") || c.includes("cloth") || c.includes("fashion") || c.includes("apparel")) return "cat-apparel";
    if (c.includes("elec") || c.includes("device") || c.includes("tech")) return "cat-electronics";
    return "cat-home";
  };
  useEffect(() => {
    if (view !== 'sell' || !query.trim()) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLookupProducts([]);
      void searchProducts(query)
        .then(value => { if (active) setLookupProducts(value); })
        .catch(() => { if (active) setLookupProducts([]); });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, view, offline, searchProducts]);
  useEffect(() => {
    if (!selectedContact || view !== 'customers' || offline) return;
    let active = true;
    void rpc('retail_contact_aging', {p_shop_id: shopId, p_contact_id: selectedContact})
      .then(value => { if (active) setAging(value as Record<string, number>); })
      .catch(() => { if (active) setAging(null); });
    return () => { active = false; };
  }, [selectedContact, view, offline, rpc, shopId]);
  async function importProducts(file: File) {
    try {
      if (!bulkImportEnabled) throw new Error("Bulk import is disabled for this shop.");
      if (file.size > 2_000_000) throw new Error("CSV must be under 2 MB");
      const rows = parseCsv(await file.text());
      const expected = [
        "name",
        "category",
        "cost",
        "price",
        "stock",
        "reorder",
        "barcode",
        "unit",
        "hsn",
        "tax",
        "expiry",
      ];
      const clothingHeaders = [...expected,'style','size','colour','mrp'];
      if(rows[0]?.map(s=>s.replace(/^\uFEFF/,'').trim().toLowerCase()).join(',')===clothingHeaders.join(',')) expected.push('style','size','colour','mrp');
      if (
        rows[0]
          ?.map((s) =>
            s
              .replace(/^\uFEFF/, "")
              .trim()
              .toLowerCase(),
          )
          .join(",") !== expected.join(",")
      )
        throw new Error("Use the downloadable CSV template headers");
      if (rows.length > 501)
        throw new Error("Import up to 500 products at a time");
      for (let n = 1; n < rows.length; n++) {
        if (rows[n].length !== expected.length)
          throw new Error(`Row ${n + 1}: expected ${expected.length} columns`);
        const p = Object.fromEntries(expected.map((k, i) => [k, rows[n][i]]));
        for (const k of ["cost", "price", "stock", "reorder", "tax"]) {
          if (p[k] === "" || !Number.isFinite(Number(p[k])))
            throw new Error(`Row ${n + 1}: invalid ${k}`);
        }
      }
      setImportRows(
        rows
          .slice(1)
          .map((row) =>
            Object.fromEntries(expected.map((k, i) => [k, row[i]])),
          ),
      );
      setDialog({ type: "import" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid CSV");
    }
  }
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]),
    [importDone, setImportDone] = useState(0);
  const importNow = async () => {
    if (!bulkImportEnabled) {
      setError("Bulk import is disabled for this shop.");
      return;
    }
    for (let i = importDone; i < importRows.length; i++) {
      const r = await perform("product", importRows[i]);
      if (!r) return;
      setImportDone(i + 1);
    }
    setDialog(null);
    setImportRows([]);
    setImportDone(0);
  };
  const setFeatureFlag = async (flag: keyof NonNullable<Workspace["flags"]>, enabled: boolean) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const flags = await rpcRef.current("retail_feature_flag_set", {p_shop_id:shopId,p_flag:flag,p_enabled:enabled}) as NonNullable<Workspace["flags"]>;
      setData(current => current ? {...current, flags} : current);
      setNotice("Release control updated for this shop.");
      if (flag === "recurring_billing" && !enabled && view === "recurring") setView("sell");
      if (flag === "ocr_jobs" && !enabled) setPurchaseScan(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update release control");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (!data && error.includes("PGRST202") && fallback)
    return <><p className="retail-warning" role="status">The retail upgrade is awaiting database setup. Your existing inventory workspace is available below.</p>{fallback}</>;
  if (!data)
    return (
      <section className="retail-loading">
        <h2>
          {t("Opening your shop workspace", "दुकानाचे कार्यस्थळ उघडत आहे")}
        </h2>
        {error ? (
          <>
            <p role="alert">
              {error.includes("PGRST202")
                ? "The retail database upgrade is required. Existing inventory is safe."
                : error}
            </p>
            <button onClick={() => reload().catch((e) => setError(e.message))}>
              {t("Retry", "पुन्हा प्रयत्न करा")}
            </button>
          </>
        ) : (
          <p>
            {t(
              "Loading products and records…",
              "उत्पादने व नोंदी लोड होत आहेत…",
            )}
          </p>
        )}
      </section>
    );
  const contacts = data.contacts.filter(
    (c) => c.kind === (purchasing ? "supplier" : "customer"),
  );
  return (
    <section className="retail" aria-busy={busy}>
      {navOpen && <button type="button" className="retail-nav-backdrop" aria-label={t("Close navigation", "नेव्हिगेशन बंद करा")} onClick={() => setNavOpen(false)} />}
      <aside id="retail-navigation" className={`retail-nav${navOpen ? " is-open" : ""}`}>
        <button className="retail-nav-close" type="button" aria-label={t("Close navigation", "नेव्हिगेशन बंद करा")} onClick={() => setNavOpen(false)}>
          <X size={21} />
        </button>
        <div className="retail-shop">
          <Store />
          <div>
            <strong>{data.shop.name}</strong>
            <small>{data.shop.area}</small>
          </div>
        </div>
        {nav.map(([v, en, mr, Icon]) => (
          <button
            key={v}
            onClick={() => changeView(v)}
            aria-current={view === v ? "page" : undefined}
          >
            <Icon size={19} />
            <span>{t(en, mr)}</span>
            {v === "sell" && cart.length > 0 && <b>{cart.length}</b>}
          </button>
        ))}
      </aside>
      <div className="retail-main">
        <header className="retail-heading">
          <div>
            <button className="retail-nav-toggle" type="button" aria-expanded={navOpen} aria-controls="retail-navigation" onClick={() => setNavOpen(true)}>
              <Menu size={20} />
              <span>{t("Menu", "मेनू")}</span>
            </button>
            <p>{t("YOUR SHOP WORKSPACE", "तुमच्या दुकानाचे कार्यस्थळ")}</p>
            <h2>
              {t(
                nav.find((n) => n[0] === view)![1],
                nav.find((n) => n[0] === view)![2],
              )}
            </h2>
          </div>
          <button
            disabled={busy}
            onClick={() => reload().catch((e) => setError(e.message))}
          >
            <RefreshCw size={17} />
            {t("Refresh", "रीफ्रेश")}
          </button>
        </header>
        {offline && (
          <p className="retail-warning">
            Offline · cached shop data. Sales queue on this device and receive a
            final invoice after syncing. Reports may be out of date.
          </p>
        )}
        {pending.length > 0 && (
          <div className="retail-warning">
            <strong>{pending.length} bill(s) pending confirmation</strong>
            <p>
              Do not enter these sales again. They will be checked using their
              original request IDs.
            </p>
            <button disabled={busy || offline} onClick={() => void syncPending()}>
              Sync pending bills
            </button>
            {pending.filter(s => s.rejection).map(s => <div key={s.id}>
              <p role="alert">Rejected bill ({new Date(s.created).toLocaleString()}): {s.rejection}</p>
              <button disabled={busy || cart.length > 0} onClick={async () => {
                const lines = s.data.lines as CartLine[];
                // Save the recoverable draft before removing a definitively rejected request.
                await writeLocal(namespace + ':cart', lines);
                await removeLocal(namespace + ':sale:' + s.id);
                setCart(lines); setView('sell'); setContactId(String(s.data.contactId || ''));
                setMethod(String(s.data.method || 'cash')); setPaid(String(s.data.paid ?? ''));setHeld((s.data.held as HeldRef)||null);setSplit(Object.fromEntries(['cash','upi','card'].map(key=>[key,String((s.data.tenders as Record<string,unknown>)?.[key]??'')])) as SplitTender);
                setReference(String(s.data.reference || '')); setInterstate(Boolean(s.data.interstate));
                setSupplyState(String(s.data.supplyState || '')); request.current = null;
                setPending(await listLocal<PendingSale>(namespace + ':sale:'));
              }}>Restore rejected bill to empty cart</button>
            </div>)}
          </div>
        )}
        {purchasing && (
          <div className="retail-toolbar">
            {ocrJobsEnabled ? (
              <button
                onClick={() => setPurchaseScan(true)}
                disabled={purchaseCart.length > 0 || offline}
              >
                Scan supplier bill images
              </button>
            ) : (
              <span className="retail-help">Supplier OCR is disabled for this shop by release controls.</span>
            )}
            {purchaseCart.length > 0 && (
              <small>
                Finish the current purchase before scanning another bill.
              </small>
            )}
          </div>
        )}
        {!data.shop.active && (
          <p className="retail-warning">
            {t(
              "This shop is paused. Reactivate it in super-admin controls to save changes.",
              "हे दुकान बंद आहे. बदल जतन करण्यासाठी सुपर अॅडमिनने सक्रिय करावे.",
            )}
          </p>
        )}
        {error && (
          <p className="retail-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="retail-notice" role="status">
            {notice}
          </p>
        )}
        {["products", "bills", "purchases", "cash", "reports"].includes(view) && (
          <div className="retail-dates">
            <label>
              Range
              <select value={datePreset} onChange={(e) => applyDatePreset(e.target.value as typeof datePreset)}>
                <option value="month">This month</option>
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="custom">Custom dates</option>
              </select>
            </label>
            <label>
              {t("From", "पासून")}
              <VoiceInput
                type="date"
                value={from}
                max={to}
                onChange={(e) => setDateRange(e.target.value, to, "custom")}
              />
            </label>
            <label>
              {t("To", "पर्यंत")}
              <VoiceInput
                type="date"
                value={to}
                min={from}
                onChange={(e) => setDateRange(from, e.target.value, "custom")}
              />
            </label>
            <span>IST</span>
          </div>
        )}
        {view==='sell' && <details className="retail-panel"><summary>{held ? `Resumed bill: ${held.label}` : 'Hold or resume a bill'}</summary><HeldBills shopId={shopId} rpc={rpc} draft={{cart,contactId,method,paid,split,interstate,supplyState}} held={held} hasCart={cart.length>0} disabled={busy||offline} revision={data} onSaved={()=>{setCart([]);setHeld(null);setPaid('');setSplit(emptySplit());}} onResume={(draft,reference)=>{setCart(draft.cart as CartLine[]);setContactId(String(draft.contactId||''));setMethod(String(draft.method||'cash'));setPaid(String(draft.paid||''));setSplit((draft.split as SplitTender)||emptySplit());setInterstate(Boolean(draft.interstate));setSupplyState(String(draft.supplyState||''));setHeld(reference);}}/></details>}
        {(view === "sell" || view === "purchases") && (
          <>
            <div className="retail-pos">
              <div className="retail-catalog">
                <form className="retail-search" onSubmit={scanSubmit}>
                  <Search size={19} />
                  <VoiceInput
                    aria-label="Search products or scan barcode"
                    placeholder={t(
                      "Search name or scan barcode…",
                      "नाव किंवा बारकोड शोधा…",
                    )}
                    value={query}
                    onChange={(e) => changeQuery(e.target.value)}
                  />
                  <button title="Add scanned barcode">
                    <Barcode size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setScan(true)}
                    title="Scan with camera"
                  >
                    Camera
                  </button>
                </form>
                <div className="retail-category">
                  <button
                    onClick={() => setCategory("")}
                    aria-pressed={!category}
                  >
                    {t("All", "सर्व")}
                  </button>
                  {[...new Set(data.products.map((p) => p.category))].map(
                    (c) => (
                      <button
                        key={c}
                        onClick={() => setCategory(c)}
                        aria-pressed={category === c}
                      >
                        {c}
                      </button>
                    ),
                  )}
                </div>
                <div className="retail-product-grid">
                  {rows.map((p) => (
                    <button
                      className="retail-product"
                      key={p.id}
                      onClick={() => add(p)}
                      disabled={
                        !purchasing &&
                        (availableStock(p) <= 0 ||
                          (!!p.expiry_date && p.expiry_date < today()))
                      }
                    >
                      <span className="retail-product-category">
                        {p.category}
                        <Plus size={16} />
                      </span>
                      <strong>{productName(p)}</strong>
                      <b>
                        {cash(
                          purchasing ? p.buying_price : p.default_selling_price,
                        )}
                      </b>
                      <small
                        className={p.stock <= p.reorder_level ? "low" : ""}
                      >
                        {availableStock(p)} {p.unit} {t("available", "उपलब्ध")}
                        {p.expiry_date && p.expiry_date < today()
                          ? " · Expired"
                          : ""}
                      </small>
                    </button>
                  ))}
                </div>
                {!rows.length && (
                  <Empty>
                    {t(
                      "No products found. Add products in the Products tab.",
                      "उत्पादने सापडली नाहीत. उत्पादने टॅबमध्ये जोडा.",
                    )}
                  </Empty>
                )}
              </div>
              <section className="retail-cart">
                <h3>
                  <ShoppingCart size={19} />
                  {purchasing
                    ? t("Receive stock", "माल स्वीकारा")
                    : t("Current bill", "सध्याचे बिल")}
                  <span>{currentCart.length}</span>
                </h3>
                {!currentCart.length ? (
                  <Empty>
                    {t(
                      "Tap a product to add it here.",
                      "उत्पादन इथे जोडण्यासाठी त्यावर टॅप करा.",
                    )}
                  </Empty>
                ) : (
                  currentCart.map((l) => {
                    const p = productsById.get(l.id);
                    return (
                      <div className="retail-cart-line" key={l.id}>
                        <div>
                          <strong>{p ? productName(p) : "Unavailable product"}</strong>
                          <button
                            aria-label={`Remove ${p ? productName(p) : 'product'}`}
                            onClick={() => {
                              if(!purchasing && currentCart.length===1)setHeld(null);
                              setCurrentCart((prev) =>
                                prev.filter((x) => x.id !== l.id),
                              );
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className="retail-line-fields">
                          <label>
                            {t("Qty", "संख्या")}
                            <VoiceInput
                              type="number"
                              min="0.001"
                              step={
                                p?.unit === "pcs" || p?.unit === "pack"
                                  ? "1"
                                  : "0.001"
                              }
                              value={l.qty}
                              onChange={(e) =>
                                update(l.id, "qty", Number(e.target.value))
                              }
                            />
                          </label>
                          <label>
                            {t("Price", "किंमत")}
                            <VoiceInput
                              type="number"
                              min="0"
                              step="0.01"
                              value={l.price}
                              onChange={(e) =>
                                update(l.id, "price", Number(e.target.value))
                              }
                            />
                          </label>
                          <label>
                            {t("Off %", "सूट %")}
                            <VoiceInput
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={l.discount}
                              onChange={(e) =>
                                update(l.id, "discount", Number(e.target.value))
                              }
                            />
                          </label>
                        </div>
                        <b>{cash(lineTotal(l))}</b>
                      </div>
                    );
                  })
                )}
                <div className="retail-checkout">
                  <div className="retail-customer-picker">
                    <div className="retail-field-header">
                      <label htmlFor="checkout-customer-select">
                        {purchasing
                          ? t("Supplier", "पुरवठादार")
                          : t("Customer", "ग्राहक")}
                      </label>
                      {!purchasing && (
                        <button
                          type="button"
                          className="retail-quick-add-link"
                          onClick={() => setDialog({ type: "customer" })}
                          title={t("Add new customer without leaving sell screen", "नवीन ग्राहक जोडा")}
                        >
                          <Plus size={13} /> {t("New Customer", "नवीन ग्राहक")}
                        </button>
                      )}
                    </div>
                    <select
                      id="checkout-customer-select"
                      value={contactId}
                      onChange={(e) => setContactId(e.target.value)}
                    >
                      <option value="">
                        {purchasing
                          ? t("Choose supplier", "पुरवठादार निवडा")
                          : t("Walk-in customer (no account needed)", "सामान्य ग्राहक (खाते आवश्यक नाही)")}
                      </option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.phone ? `(${c.phone})` : ""} · {cash(c.balance)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {purchasing && (
                    <label>
                      {t("Supplier bill reference", "पुरवठादार बिल क्रमांक")}
                      <VoiceInput
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                      />
                    </label>
                  )}
                  <label>
                    {t("Payment method", "पैसे देण्याची पद्धत")}
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                    >
                      <option value="cash">Cash / रोकड</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card / कार्ड</option>
                      {!purchasing && <option value="split">Split payment</option>}
                      {!purchasing && (
                        <option value="credit">Credit / उधार</option>
                      )}
                    </select>
                  </label>
                  {method !== "credit" && method !== "split" && (
                    <label>
                      {t(
                        !purchasing && method === "cash" ? "Cash received (leave blank for exact)" : "Amount paid (leave blank for full)",
                        "दिलेली रक्कम (पूर्ण असल्यास रिक्त)",
                      )}
                      <VoiceInput
                        type="number"
                        min="0"
                        max={method === 'cash' ? undefined : total}
                        step="0.01"
                        value={paid}
                        onChange={(e) => setPaid(e.target.value)}
                        placeholder={total.toFixed(2)}
                      />
                    </label>
                  )}
                  {!purchasing && method==='split' && <div className="retail-form-grid">{(['cash','upi','card'] as const).map(key=><label key={key}>{key.toUpperCase()} amount<VoiceInput type="number" min="0" step="0.01" value={split[key]} onChange={e=>setSplit(current=>({...current,[key]:e.target.value}))}/></label>)}<small>Enter amounts actually collected in at least two methods. Return any cash change before entering its amount.</small></div>}
                  {!purchasing && method === 'cash'  && <div className="retail-cash-chips">
                    <small>{t('Cash received · change is returned to the customer', 'मिळालेली रोकड · ग्राहकाला सुट्टे परत द्या')}</small>
                    <div>{[50,100,200,500].map(amount => <button type="button" key={amount} onClick={() => setPaid(String(amount))}>{cash(amount)}</button>)}</div>
                    <strong>{t('Change to return', 'परत द्यायचे सुट्टे')}: {cash(Math.max(0, Number(paid || total) - total))}</strong>
                  </div>}
                  {!purchasing && gstEnabled && data.shop.settings.gstin && (
                    <>
                      <label className="retail-check">
                        <VoiceInput
                          type="checkbox"
                          checked={interstate}
                          onChange={(e) => setInterstate(e.target.checked)}
                        />
                        Inter-state supply (IGST)
                      </label>
                      {interstate && (
                        <label>
                          Place of supply
                          <VoiceInput
                            value={supplyState}
                            onChange={(e) => setSupplyState(e.target.value)}
                            placeholder="State name and code"
                          />
                        </label>
                      )}
                      <small>Prices include the configured GST rate.</small>
                    </>
                  )}
                  <div className="retail-total">
                    <span>{t("Total", "एकूण")}</span>
                    <strong>{cash(total)}</strong>
                  </div>
                  {contactId && (
                    <small>
                      {t("Remaining due", "उरलेली उधारी")}:{" "}
                      {cash(
                        total -
                          (method === "split" ? Object.values(split).reduce((n,v)=>n+Number(v||0),0) : method === "credit"
                            ? 0
                            : paid === ""
                              ? total
                              : Number(paid)),
                      )}
                    </small>
                  )}
                  <button
                    className="primary retail-pay"
                    disabled={busy || !currentCart.length || !data.shop.active}
                    onClick={checkout}
                  >
                    {busy
                      ? t("Saving…", "जतन होत आहे…")
                      : purchasing
                        ? t("Save purchase & receive", "खरेदी जतन करा")
                        : t("Save bill", "बिल जतन करा")}
                  </button>
                  <small>
                    {t(
                      "Payment method records your collection; it does not charge a bank account.",
                      "ही नोंद आहे; बँक खात्यातून पैसे आपोआप घेतले जात नाहीत.",
                    )}
                  </small>
                </div>
              </section>
            </div>
            {purchasing && (
              <section className="retail-panel">
                <h3>{t("Purchase history", "खरेदी नोंदी")}</h3>
                <Table
                  headers={["Reference", "Supplier", "Total", "Paid", "Date"]}
                  rows={data.purchases.map((p) => [
                    p.reference,
                    data.contacts.find((c) => c.id === p.supplier_id)?.name ||
                      "",
                    cash(p.total),
                    cash(p.paid),
                    date(p.created_at),
                  ])}
                />
              </section>
            )}
          </>
        )}
        {view === "products" && (
          <div className="product-dashboard">
            {/* KPI Summary Cards */}
            <div className="product-stats-grid">
              {/* Stat 1: Active Product */}
              <div className="p-stat-card">
                <div className="p-stat-top">
                  <span className="p-stat-title">Active Product</span>
                  <div className="p-stat-icon green">
                    <Package size={17} />
                  </div>
                </div>
                <div className="p-stat-value">
                  {productDashboardStats.activeCount}
                  <span className="p-stat-unit">Product</span>
                </div>
                <div className="p-stat-footer">
                  <span className="badge-up">
                    <TrendingUp size={12} /> +{Math.min(productDashboardStats.totalProducts, 14)} added
                  </span>
                  <span>this week</span>
                </div>
              </div>

              {/* Stat 2: Winning Product */}
              <div className="p-stat-card">
                <div className="p-stat-top">
                  <span className="p-stat-title">Winning Product</span>
                  <div className="p-stat-icon fire">
                    <Flame size={17} />
                  </div>
                </div>
                <div
                  className="p-stat-value"
                  style={{ fontSize: "18px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={productDashboardStats.winningProduct ? productName(productDashboardStats.winningProduct) : ""}
                >
                  {productDashboardStats.winningProduct ? productName(productDashboardStats.winningProduct) : "No Products"}
                </div>
                <div className="p-stat-footer">
                  <span className="badge-fire">🔥 High Demand</span>
                  <span>{productDashboardStats.winningSalesQty ? `${productDashboardStats.winningSalesQty} Sold` : "88.3k Views"}</span>
                </div>
              </div>

              {/* Stat 3: Average Performance */}
              <div className="p-stat-card">
                <div className="p-stat-top">
                  <span className="p-stat-title">Average Performance</span>
                  <div className="p-stat-icon blue">
                    <Sparkles size={17} />
                  </div>
                </div>
                <div className="p-stat-value" style={{ color: "#059669" }}>
                  {productDashboardStats.healthPercent >= 80 ? "Good!" : productDashboardStats.healthPercent >= 50 ? "Moderate" : "Review"}
                </div>
                <div className="p-stat-footer">
                  <span className="badge-up">+{productDashboardStats.healthPercent >= 80 ? "4.8%" : "2.1%"}</span>
                  <span>Score {productDashboardStats.healthPercent}/100 velocity</span>
                </div>
              </div>

              {/* Stat 4: Product Sold */}
              <div className="p-stat-card">
                <div className="p-stat-top">
                  <span className="p-stat-title">Product Sold</span>
                  <div className="p-stat-icon purple">
                    <TrendingUp size={17} />
                  </div>
                </div>
                <div className="p-stat-value">
                  {productDashboardStats.totalItemsSold.toLocaleString()}
                  <span className="p-stat-unit">Items</span>
                </div>
                <div className="p-stat-footer">
                  <span className="badge-up">
                    <TrendingUp size={12} /> +16.3%
                  </span>
                  <span>vs last month</span>
                </div>
              </div>

              {/* Stat 5: Product Returned */}
              <div className="p-stat-card">
                <div className="p-stat-top">
                  <span className="p-stat-title">Product Returned</span>
                  <div className="p-stat-icon amber">
                    <ReceiptText size={17} />
                  </div>
                </div>
                <div className="p-stat-value">
                  {productDashboardStats.returnedCount}
                  <span className="p-stat-unit">Items</span>
                </div>
                <div className="p-stat-footer">
                  <span className="badge-neutral">3.4%</span>
                  <span>Low return rate</span>
                </div>
              </div>
            </div>

            {/* Toolbar & Filters */}
            <div className="product-dash-toolbar">
              <div className="dash-toolbar-left">
                <div className="dash-search-box">
                  <Search size={16} className="dash-search-icon" />
                  <VoiceInput
                    aria-label="Search products"
                    placeholder={t("Search products, SKU, categories...", "उत्पादने, बारकोड, श्रेणी शोधा...")}
                    value={query}
                    onChange={(e) => changeQuery(e.target.value)}
                  />
                </div>
                <div className="dash-filter-tabs">
                  <button
                    type="button"
                    className={`dash-filter-btn ${!low ? "active" : ""}`}
                    onClick={() => {
                      if (low) {
                        setLow(false);
                        setPages((c) => ({ ...c, products: 0 }));
                      }
                    }}
                  >
                    All ({productDashboardStats.totalProducts})
                  </button>
                  <button
                    type="button"
                    className={`dash-filter-btn ${low ? "active" : ""}`}
                    onClick={() => {
                      if (!low) {
                        setLow(true);
                        setPages((c) => ({ ...c, products: 0 }));
                      }
                    }}
                  >
                    Low Stock ({productDashboardStats.lowStockCount})
                  </button>
                </div>
              </div>

              <div className="dash-toolbar-right">
                {bulkImportEnabled && (
                  <>
                    <button
                      type="button"
                      className="dash-btn"
                      onClick={() =>
                        downloadCsv("products-template.csv", [
                          [
                            "name",
                            "category",
                            "cost",
                            "price",
                            "stock",
                            "reorder",
                            "barcode",
                            "unit",
                            "hsn",
                            "tax",
                            "expiry",
                            "style",
                            "size",
                            "colour",
                            "mrp",
                          ],
                          ["Tea", "Grocery", 10, 15, 20, 5, "", "pcs", "", 0, "", "", "", "", ""],
                          ["Oxford shirt", "Shirts", 400, 600, 5, 1, "OX01-M-NAVY", "pcs", "", 0, "", "OX-01", "M", "Navy", 799],
                        ])
                      }
                    >
                      <FileSpreadsheet size={15} />
                      CSV template
                    </button>
                    <label className="dash-btn" style={{ cursor: "pointer" }}>
                      Import CSV
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          setImportDone(0);
                          const file = e.target.files?.[0];
                          if (file) void importProducts(file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </>
                )}
                <button
                  type="button"
                  className="dash-btn dash-btn-primary primary"
                  onClick={() => setDialog({ type: "product" })}
                >
                  <Plus size={16} />
                  {t("Add product", "उत्पादन जोडा")}
                </button>
              </div>
            </div>

            {/* Modern Data Table */}
            <div className="product-dash-table-card">
              <div className="product-dash-table-wrap">
                <table className="product-table-v2">
                  <thead>
                    <tr>
                      <th style={{ width: "30%" }}>PRODUCT</th>
                      <th style={{ width: "16%" }}>PERFORMANCE</th>
                      <th style={{ width: "16%" }}>STOCK COUNT</th>
                      <th style={{ width: "14%" }}>PRODUCT PRICE</th>
                      <th style={{ width: "10%" }}>SALES</th>
                      <th style={{ width: "8%", textAlign: "center" }}>VISIBILITY</th>
                      <th style={{ width: "14%", textAlign: "right" }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageOf("products", rows).length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: "36px", color: "#64748b" }}>
                          No products found matching your search.
                        </td>
                      </tr>
                    ) : (
                      pageOf("products", rows).map((p) => {
                        const isHealthy = p.stock > p.reorder_level * 1.5;
                        const isReorder = p.stock <= p.reorder_level && p.stock > 0;
                        const isOut = p.stock <= 0;
                        const stockRatio = Math.min(
                          100,
                          Math.max(6, Math.round((p.stock / Math.max(p.reorder_level * 3, 20, p.stock || 1)) * 100))
                        );
                        const perfClass = isOut ? "critical" : isReorder ? "low" : isHealthy ? "excellent" : "good";
                        const perfLabel = isOut ? "Bad 🔴" : isReorder ? "Low 🟡" : isHealthy ? "Excellent 🟢" : "Good 🟢";
                        const ratingStr = isHealthy ? "4.8★" : isReorder ? "3.9★" : isOut ? "2.5★" : "4.5★";
                        const pSales = productDashboardStats.salesMap[p.id] || productDashboardStats.salesMap[p.id?.toLowerCase?.() || ""] || { qty: 0, revenue: 0 };
                        const thumbCatClass = getCatColorClass(p.category);
                        const initial = (p.name || "P").charAt(0).toUpperCase();

                        return (
                          <tr key={p.id} className={p.is_active === false ? "inactive-row" : ""}>
                            {/* Product Info */}
                            <td>
                              <div className="product-cell-main">
                                <div className={`p-thumb ${thumbCatClass}`}>
                                  {initial}
                                </div>
                                <div className="p-info">
                                  <div className="p-name">
                                    {productName(p)}
                                    {p.is_active === false && (
                                      <span style={{ fontSize: "11px", color: "#94a3b8", marginLeft: "6px" }}>
                                        (Inactive)
                                      </span>
                                    )}
                                  </div>
                                  <div className="p-meta">
                                    <span className="p-sku-tag">SKU: {p.barcode || "—"}</span>
                                    <span>·</span>
                                    <span>{p.category || "General"}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Performance */}
                            <td>
                              <div className="perf-indicator">
                                <span className={`perf-badge ${perfClass}`}>
                                  <Star size={11} style={{ fill: "currentColor" }} />
                                  {ratingStr} · {perfLabel}
                                </span>
                                <span className="perf-sub">{pSales.qty > 0 ? `${pSales.qty} sold` : "Catalog"}</span>
                              </div>
                            </td>

                            {/* Stock Count */}
                            <td>
                              <div className="stock-cell-wrap">
                                <div className="stock-top">
                                  <span className="stock-qty">
                                    {p.stock} <span style={{ fontSize: "11px", fontWeight: 400, color: "#64748b" }}>{p.unit}</span>
                                  </span>
                                  <span className={`stock-status-pill ${isOut ? "out" : isReorder ? "reorder" : "healthy"}`}>
                                    {isOut ? "Out" : isReorder ? "Low" : "Healthy"}
                                  </span>
                                </div>
                                <div className="stock-bar-track">
                                  <div
                                    className={`stock-bar-prog ${isOut ? "out" : isReorder ? "reorder" : "healthy"}`}
                                    style={{ width: `${stockRatio}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* Product Price */}
                            <td>
                              <div className="price-cell-wrap">
                                <span className="selling-price">{cash(p.default_selling_price)}</span>
                                <span className="cost-price">Cost: {cash(p.buying_price)}</span>
                              </div>
                            </td>

                            {/* Sales */}
                            <td>
                              <div className="sales-cell-wrap">
                                <span className="sales-qty">{pSales.qty} sold</span>
                                <span className="sales-revenue">{cash(pSales.revenue)}</span>
                              </div>
                            </td>

                            {/* Visibility Toggle */}
                            <td style={{ textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => void toggleProductActive(p)}
                                className={`visibility-pill ${p.is_active !== false ? "active" : "inactive"}`}
                                title="Click to toggle product active status"
                              >
                                {p.is_active !== false ? (
                                  <>
                                    <CheckCircle2 size={12} /> Active
                                  </>
                                ) : (
                                  <>
                                    <EyeOff size={12} /> Draft
                                  </>
                                )}
                              </button>
                            </td>

                            {/* Actions */}
                            <td>
                              <div className="dash-row-actions">
                                <button
                                  type="button"
                                  className="dash-action-btn"
                                  onClick={() => setDialog({ type: "product", product: p })}
                                >
                                  {t("Edit", "बदला")}
                                </button>
                                <button
                                  type="button"
                                  className="dash-action-btn"
                                  disabled={!p.barcode}
                                  onClick={() => setLabelProduct(p)}
                                >
                                  Label
                                </button>
                                <button
                                  type="button"
                                  className="dash-action-btn"
                                  disabled={busy || offline}
                                  onClick={() =>
                                    setDialog({
                                      type: "product",
                                      product: { ...p, id: "", size: "", colour: "", barcode: "", stock: 0 },
                                    })
                                  }
                                >
                                  + Var
                                </button>
                                <button
                                  type="button"
                                  className="dash-action-btn btn-danger"
                                  disabled={busy || offline}
                                  onClick={() => setDeleteProduct(p)}
                                  title={t("Delete", "हटवा")}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {pager("products", rows.length)}
            <p className="retail-help">
              {t(
                "Use Purchases to receive new stock. Edit / count sets the total quantity physically on the shelf.",
                "नवीन साठा खरेदीतून जोडा. बदला / मोजा म्हणजे दुकानातील प्रत्यक्ष एकूण संख्या.",
              )}
            </p>
            <section className="retail-panel">
              <h3>{t("Today’s stock movements", "आजच्या साठ्याच्या नोंदी")}</h3>
              <Table
                headers={["Product", "Change", "Reason", "Date"]}
                rows={pageOf("movements", data.movements).map((m) => [
                  m.item_name,
                  m.quantity,
                  m.reason,
                  date(m.created_at),
                ])}
              />
              {pager("movements", data.movements.length)}
            </section>
          </div>
        )}
        {view === "bills" && (
          <>
            <Table
              headers={["Bill", "Customer", "Total", "Paid", "Date", "Action"]}
              rows={pageOf("invoices", data.invoices).map((i) => [
                i.number,
                i.customer.name || "Walk-in",
                cash(i.total),
                cash(i.paid),
                date(i.created_at),
                <div className="retail-row-actions" key={i.id}>
                  <button onClick={() => setReceipt(i)}>Receipt</button>
                  {data.returnedIds.includes(i.id) ? (
                    <span>Returned</span>
                  ) : (
                    <button
                      onClick={() => setDialog({ type: "return", id: i.id })}
                    >
                      Return full bill
                    </button>
                  )}
                </div>,
              ])}
            />
            {pager("invoices", data.invoices.length)}
            {data.returns.length > 0 && (
              <section className="retail-panel">
                <h3>Returns in selected period</h3>
                <Table
                  headers={["Bill", "Reversed sale", "Refund", "Date"]}
                  rows={data.returns.map((r) => [
                    r.number,
                    cash(r.total),
                    cash(r.refund),
                    date(r.created_at),
                  ])}
                />
              </section>
            )}
          </>
        )}
        {(view === "customers" || view === "suppliers") && (
          <>
            {view === "suppliers" && (
              <div className="retail-kpis" aria-label="Supplier summary">
                <Kpi label="Suppliers" value={String(supplierStats.count)} />
                <Kpi label="Payable" value={cash(supplierStats.totalDue)} />
                <Kpi label="Due suppliers" value={String(supplierStats.dueSuppliers)} />
                <Kpi label="Purchases in range" value={cash(supplierStats.purchaseTotal)} />
                <Kpi label="Paid in range" value={cash(supplierStats.purchasePaid)} />
              </div>
            )}
            <div className="retail-toolbar">
              <VoiceInput
                placeholder={t("Search name or phone", "नाव किंवा फोन शोधा")}
                value={query}
                onChange={(e) => changeQuery(e.target.value)}
              />
              <button
                className="primary"
                onClick={() =>
                  setDialog({
                    type: view === "customers" ? "customer" : "supplier",
                  })
                }
              >
                <Plus size={17} />
                {view === "customers"
                  ? t("Add customer", "ग्राहक जोडा")
                  : t("Add supplier", "पुरवठादार जोडा")}
              </button>
            </div>
            <Table
              headers={["Name", "Phone", "Outstanding", "Actions"]}
              rows={pageOf("contacts", data.contacts
                .filter(
                  (c) =>
                    c.kind ===
                      (view === "customers" ? "customer" : "supplier") &&
                    `${c.name} ${c.phone}`
                      .toLowerCase()
                      .includes(query.trim().toLowerCase()),
                )
                ) .map((c) => [
                  c.name,
                  c.phone || "—",
                  cash(c.balance),
                  <div className="retail-row-actions" key={c.id}>
                    <button
                      disabled={c.balance <= 0}
                      onClick={() => setDialog({ type: "settle", id: c.id })}
                    >
                      {c.kind === "customer"
                        ? "Receive payment"
                        : "Pay supplier"}
                    </button>
                    {view === "suppliers" && staffRole !== "cashier" && (
                      <button onClick={() => startSupplierPurchase(c.id)}>
                        New purchase
                      </button>
                    )}
                    {staffRole!=="cashier" && <button onClick={()=>setDialog({type:"contact_edit",id:c.id})}>Edit / credit terms</button>}
                    <button onClick={() => { setAging(null); setSelectedContact(c.id); }}>
                      Statement
                    </button>
                  </div>,
                ])}
            />
            {pager("contacts", data.contacts.filter(c => c.kind === (view === "customers" ? "customer" : "supplier") && `${c.name} ${c.phone}`.toLowerCase().includes(query.trim().toLowerCase())).length)}
            {selectedContact && (
              <section className="retail-panel">
                <h3>
                  {data.contacts.find((c) => c.id === selectedContact)?.name} ·{" "}
                  {t("Statement", "हिशोब")}
                </h3>
                <p>
                  Entries in the selected date range. Outstanding is the
                  all-time balance.
                </p>
                {view === "suppliers" && staffRole !== "cashier" && (
                  <div className="retail-row-actions">
                    <button onClick={() => startSupplierPurchase(selectedContact)}>
                      Record supplier bill
                    </button>
                    <button
                      disabled={(data.contacts.find((c) => c.id === selectedContact)?.balance || 0) <= 0}
                      onClick={() => setDialog({ type: "settle", id: selectedContact })}
                    >
                      Pay outstanding
                    </button>
                  </div>
                )}
                {aging && <div className="retail-kpis" aria-label="Customer ageing"><Kpi label="Current" value={cash(Number(aging.current || 0))}/><Kpi label="1–30 days" value={cash(Number(aging.days1to30 || 0))}/><Kpi label="31–60 days" value={cash(Number(aging.days31to60 || 0))}/><Kpi label="60+ days" value={cash(Number(aging.over60 || 0))}/></div>}
                <div className="retail-dates">
                  <label>
                    From
                    <VoiceInput
                      type="date"
                      value={from}
                      onChange={(e) => setDateRange(e.target.value, to, "custom")}
                    />
                  </label>
                  <label>
                    To
                    <VoiceInput
                      type="date"
                      value={to}
                      onChange={(e) => setDateRange(from, e.target.value, "custom")}
                    />
                  </label>
                </div>
                <Table
                  headers={["Entry", "Amount", "Date"]}
                  rows={[
                    ...data.invoices
                      .filter((i) => i.customer_id === selectedContact)
                      .map((i) => [
                        `Bill ${i.number} · unpaid at issue`,
                        cash(i.total - i.paid),
                        date(i.created_at),
                      ]),
                    ...data.purchases
                      .filter((p) => p.supplier_id === selectedContact)
                      .map((p) => [
                        `Purchase ${p.reference} · unpaid at issue`,
                        cash(p.total - p.paid),
                        date(p.created_at),
                      ]),
                    ...data.payments
                      .filter((p) => p.contact_id === selectedContact)
                      .map((p) => [
                        `Payment · ${p.method}`,
                        cash(p.amount),
                        date(p.created_at),
                      ]),
                  ]}
                />
              </section>
            )}
          </>
        )}
        {view === "cash" && (
          <>
            <div className="retail-kpis">
              <Kpi
                label="Opening cash"
                value={cash(
                  data.registers.find((r) => !r.closed_at)?.opening || 0,
                )}
              />
              <Kpi
                label="Expected cash now"
                value={cash(
                  data.registers.find((r) => !r.closed_at)?.currentExpected ||
                    0,
                )}
              />
              <Kpi label="Expenses in range" value={cash(summary!.expenses)} />
            </div>
            <div className="retail-toolbar">
              <button
                className="primary"
                onClick={() =>
                  setDialog({
                    type: data.registers.some((r) => !r.closed_at)
                      ? "register_close"
                      : "register_open",
                  })
                }
              >
                {data.registers.some((r) => !r.closed_at)
                  ? t("Close register", "रोकड हिशोब बंद करा")
                  : t("Open register", "रोकड हिशोब सुरू करा")}
              </button>
              <button onClick={() => setDialog({ type: "expense" })}>
                {t("Record expense", "खर्च नोंदवा")}
              </button>
            </div>
            <Table
              headers={[
                "Opened",
                "Opening",
                "Expected",
                "Counted",
                "Difference",
                "Status",
              ]}
              rows={data.registers.map((r) => [
                date(r.opened_at),
                cash(r.opening),
                cash(r.currentExpected),
                r.closed_at ? cash(r.counted) : "—",
                r.closed_at ? cash(r.counted - r.expected) : "—",
                r.closed_at ? "Closed" : "Open",
              ])}
            />
            <h3 className="retail-subheading">Expenses</h3>
            <Table
              headers={["Description", "Amount", "Method", "Date"]}
              rows={data.expenses.map((e) => [
                e.description,
                cash(e.amount),
                e.method,
                date(e.created_at),
              ])}
            />
          </>
        )}
        {view === "reports" && data && <ReportsPanel data={data} summary={summary!} from={from} to={to} offline={offline} rpc={rpc} />}
        {view === "recurring" && recurringEnabled && (
          <>
            <DeliveryPlanner data={data} disabled={busy||offline} rpc={rpc} onSaved={reload}/>
            <div className="retail-toolbar">
              <button
                className="primary"
                onClick={() => setDialog({ type: "recurring" })}
              >
                {t("Create recurring template", "नियमित बिल तयार करा")}
              </button>
            </div>
            <p className="retail-help">
              Generate bills manually or enable automatic billing per template.
              Automatic billing checks every five minutes and creates one due credit bill per run,
              including overdue dates. Skip a delivery or pause anytime. Stock failures are shown below.
            </p>
            <Table
              headers={[
                "Template",
                "Customer",
                "Cycle",
                "Next date",
                "Actions",
              ]}
              rows={data.recurring.map((r) => [
                <span key={r.id}>{r.name}{r.last_error && <small className="retail-error" role="status">{r.last_error}</small>}</span>,
                data.contacts.find((c) => c.id === r.customer_id)?.name || "",
                r.cadence,
                r.next_date,
                <div className="retail-row-actions" key={r.id}>
                  <button disabled={busy || offline} onClick={async () => {
                    if(lock.current)return;lock.current=true;setBusy(true);
                    try { await rpcRef.current('retail_schedule',{p_shop_id:shopId,p_id:r.id,p_enabled:!r.automatic});await reload();setNotice(r.automatic?'Automatic billing disabled':'Automatic billing enabled; due credit bills will be generated every five minutes.'); }
                    catch(e){setError(e instanceof Error?e.message:'Could not change schedule');}
                    finally{lock.current=false;setBusy(false);}
                  }}>{r.automatic?'Automatic: on':'Enable automatic billing'}</button>
                  <button
                    disabled={busy || !r.active || r.next_date > today()}
                    onClick={async () => {
                      const i = await perform("recurring_run", { id: r.id });
                      if (i && !(i as {skipped?:boolean}).skipped) setReceipt(i as Invoice);
                      else if (i) setNotice('Planned delivery skipped. No bill or stock movement was created.');
                    }}
                  >
                    Generate due bill
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => perform("recurring_skip", { id: r.id })}
                  >
                    Skip
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => perform("recurring_toggle", { id: r.id })}
                  >
                    {r.active ? "Pause" : "Resume"}
                  </button>
                </div>,
              ])}
            />
          </>
        )}
        {view === "quotes" && <Quotes data={data} cart={cart} disabled={busy||offline} rpc={rpc} onInvoice={setReceipt} onCreated={()=>{setCart([]);setHeld(null);}} onChanged={async()=>{await reload();await onChanged();}}/>}
        {view === "settings" && (
          <><Appearance lang={lang} />
          {isOwner && (
            <section className="retail-settings">
              <h3>{t("Release controls", "रिलीज नियंत्रण")}</h3>
              <p>
                Enable advanced features per shop after the owner has checked the workflow on that shop&apos;s devices.
              </p>
              <div className="retail-flag-grid">
                <FeatureFlagToggle label="GST billing controls" description="Shows GST supply controls during billing and keeps tax details visible on receipts." enabled={gstEnabled} busy={busy} onChange={(enabled)=>void setFeatureFlag('gst',enabled)} />
                <FeatureFlagToggle label="Bulk product import" description="Allows CSV product uploads for initial catalogue setup and clothing variants." enabled={bulkImportEnabled} busy={busy} onChange={(enabled)=>void setFeatureFlag('bulk_import',enabled)} />
                <FeatureFlagToggle label="Supplier bill OCR" description="Allows image review for purchase entry before stock is updated." enabled={ocrJobsEnabled} busy={busy} onChange={(enabled)=>void setFeatureFlag('ocr_jobs',enabled)} />
                <FeatureFlagToggle label="Recurring billing" description="Allows scheduled templates, skips, delivery planning and automatic credit bills." enabled={recurringEnabled} busy={busy} onChange={(enabled)=>void setFeatureFlag('recurring_billing',enabled)} />
                <FeatureFlagToggle label="Accounting reports" description="Reserved for balance sheet, trial balance, cash flow and statutory export rollout." enabled={accountingEnabled} busy={busy} onChange={(enabled)=>void setFeatureFlag('accounting',enabled)} />
              </div>
            </section>
          )}
          <form
            className="retail-settings"
            onSubmit={async (e) => {
              e.preventDefault();
              await perform(
                "settings",
                Object.fromEntries(new FormData(e.currentTarget)),
              );
            }}
          >
            <h3>{t("Receipt & tax details", "पावती व कर माहिती")}</h3>
            <p>
              Configure each shop separately. Leave GSTIN empty for non-GST
              receipts. Selling prices are tax-inclusive.
            </p>
            <div className="retail-form-grid">
              <Field
                name="address"
                label="Shop address"
                value={data.shop.settings.address}
              />
              <Field
                name="state"
                label="State name and code"
                value={data.shop.settings.state}
              />
              <Field
                name="gstin"
                label="GSTIN (registered shops only)"
                value={data.shop.settings.gstin}
              />
              <Field
                name="phone"
                label="Phone"
                value={data.shop.settings.phone}
              />
              <Field name="upi" label="UPI ID" value={data.shop.settings.upi} />
              <label>
                Receipt width
                <select
                  name="paper"
                  defaultValue={data.shop.settings.paper || "80"}
                >
                  <option value="80">80 mm</option>
                  <option value="58">58 mm</option>
                </select>
              </label>
              <Field
                name="receiptNote"
                label="Receipt footer"
                value={data.shop.settings.receiptNote}
              />
            </div>
            <button className="primary" disabled={busy}>
              Save shop settings
            </button>
            <p className="retail-help">
              Print / PDF uses the device’s print dialog. Configure your thermal
              printer in the operating system. Bluetooth/USB device support must
              be checked on your actual hardware.
            </p>
          </form></>
        )}
      </div>
      {deleteProduct && <DeleteProductDialog name={productName(deleteProduct)} lang={lang} onClose={()=>setDeleteProduct(null)} onDelete={async password=>{
        const result=await rpcRef.current('delete_item_confirmed',{p_item_id:deleteProduct.id,p_password:password}) as {error?:string;deleted?:boolean};
        if(result.error||!result.deleted)throw new Error(result.error||'Product was not deleted.');
        setCart(current=>current.filter(line=>line.id!==deleteProduct.id));
        setPurchaseCart(current=>current.filter(line=>line.id!==deleteProduct.id));
        await reload();setNotice(t('Product deleted.','उत्पादन हटवले.'));
      }}/>}
      {receipt && (
        <Receipt invoice={receipt} onClose={() => setReceipt(null)} />
      )}
      {scan && (
        <ScanBarcode
          onClose={() => setScan(false)}
          onFound={async (code) => {
            const p = (await searchProducts(code)).find((p) => p.barcode === code && p.is_active!==false);
            if (p) {
              add(p);
              setNotice(`Added ${p.name}`);
            } else setError(`Barcode ${code} is not in this shop’s catalog.`);
            setScan(false);
          }}
        />
      )}
      {labelProduct && (
        <BarcodeLabel
          product={labelProduct}
          onClose={() => setLabelProduct(null)}
        />
      )}
      {purchaseScan && ocrJobsEnabled && (
        <PurchaseScan
          products={data.products}
          onClose={() => setPurchaseScan(false)}
          onReview={(lines) => {
            setPurchaseCart(lines);
            setPurchaseScan(false);
            setNotice(
              "Review the supplier, reference and payment before saving this purchase.",
            );
          }}
        />
      )}
      {dialog && (
        <FormDialog
          title={
            dialog.type === "product"
              ? dialog.product?.id
                ? "Edit product / stock count"
                : "Add product"
              : dialog.type === "import"
                ? "Review product import"
                : dialog.type.replaceAll("_", " ")
          }
          busy={busy}
          onClose={() => {
            if (!busy) setDialog(null);
          }}
          onSubmit={async (e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget));
            let action = dialog.type;
            let payload: Record<string, unknown> = f;
            if (action === "product")
              payload = {
                ...f,
                id: dialog.product?.id || "",
                expectedStock: dialog.product?.stock,
                active:f.active==='on',
              };
            if (action === "customer" || action === "supplier") {
              payload = { ...f, kind: action };
              action = "contact";
            }
            if (action === "contact_edit") payload = {...f,id:dialog.id};
            if (action === "settle") payload = { ...f, contactId: dialog.id };
            if (action === "return") payload = { ...f, id: dialog.id };
            if (action === "recurring")
              payload = {
                ...f,
                lines: [
                  {
                    id: f.productId,
                    qty: Number(f.qty),
                    price: Number(f.price),
                    discount: 0,
                  },
                ],
              };
            if (action === "import") {
              await importNow();
              return;
            }
            const r = await perform(action, payload);
            if (r) {
              setDialog(null);
              if (dialog.type === "customer" && typeof r === "object" && r !== null && "id" in r) {
                setContactId(String((r as { id: unknown }).id));
              }
            }
          }}
        >
          {dialog.type === "product" && (
            <>
              <Field
                name="name"
                label="Product name"
                value={dialog.product?.name}
                required
              />
              <Field
                name="category"
                label="Category"
                value={dialog.product?.category || "General"}
                required
              />
              {pager("movements", data.movements.length)}
              <p className="retail-help">For clothing, add each size and colour as a separate product with its own barcode and stock. For example: Oxford shirt · SH-01 · M · Navy.</p>
              <label className="retail-check"><input name="active" type="checkbox" defaultChecked={dialog.product?.is_active!==false}/>Available for sale</label>
              <p className="retail-help">Turn off to hide this product from billing without changing stock or previous receipts.</p>
              <div className="retail-form-grid">
                <Field name="style" label="Style / SKU (optional)" value={dialog.product?.style_code}/>
                <Field name="size" label="Size (optional)" value={dialog.product?.size}/>
                <Field name="colour" label="Colour (optional)" value={dialog.product?.colour}/>
                <Field name="mrp" label="MRP (optional)" value={dialog.product?.mrp ?? ''} type="number" min="0" step="0.01"/>
              </div>
              <div className="retail-form-grid">
                <Field
                  name="cost"
                  label="Buy price"
                  value={dialog.product?.buying_price ?? 0}
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
                <Field
                  name="price"
                  label="Sell price (tax included)"
                  value={dialog.product?.default_selling_price ?? 0}
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
                <Field
                  name="stock"
                  label="Counted available quantity"
                  value={dialog.product?.stock ?? 0}
                  type="number"
                  min="0"
                  step="0.001"
                  required
                />
                <Field
                  name="reorder"
                  label="Restock at"
                  value={dialog.product?.reorder_level ?? 5}
                  type="number"
                  min="0"
                  step="0.001"
                  required
                />
                <label>
                  Unit
                  <select
                    name="unit"
                    defaultValue={dialog.product?.unit || "pcs"}
                  >
                    {["pcs", "kg", "g", "litre", "ml", "pack"].map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </label>
                <Field
                  name="barcode"
                  label="Barcode"
                  value={dialog.product?.barcode}
                />
                <Field name="hsn" label="HSN" value={dialog.product?.hsn} />
                <Field
                  name="tax"
                  label="GST rate %"
                  value={dialog.product?.tax_rate ?? 0}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                />
                <Field
                  name="expiry"
                  label="Expiry date (optional)"
                  value={dialog.product?.expiry_date || ""}
                  type="date"
                />
              </div>
            </>
          )}
          {(dialog.type === "customer" || dialog.type === "supplier") && (
            <>
              <Field name="name" label={dialog.type === "customer" ? "Customer Name" : "Supplier Name"} required />
              <Field name="phone" label={dialog.type === "customer" ? "WhatsApp / Mobile Number" : "Phone"} type="tel" />
              <Field name="address" label="Address" />
              <Field name="gstin" label="GSTIN (optional)" />
            </>
          )}
          {dialog.type === "contact_edit" && <>
            <Field name="name" label="Name" value={data.contacts.find(c=>c.id===dialog.id)?.name} required/>
            <Field name="phone" label="Phone" value={data.contacts.find(c=>c.id===dialog.id)?.phone}/>
            <Field name="address" label="Address" value={data.contacts.find(c=>c.id===dialog.id)?.address}/>
            <Field name="gstin" label="GSTIN (optional)" value={data.contacts.find(c=>c.id===dialog.id)?.gstin}/>
            <Field name="creditLimit" label="Customer credit limit (blank = no limit)" type="number" min="0" step="0.01" value={String(data.contacts.find(c=>c.id===dialog.id)?.credit_limit??'')}/>
            <Field name="paymentTerms" label="Payment terms in days" type="number" min="0" max="365" step="1" value={String(data.contacts.find(c=>c.id===dialog.id)?.payment_terms_days??0)} required/>
            <p>New credit bills use these terms. Existing receipts and due dates retain their original details. Credit limits apply to customer billing.</p>
          </>}
          {["expense", "settle", "register_open", "register_close"].includes(
            dialog.type,
          ) && (
            <>
              <Field
                name="amount"
                label={
                  dialog.type === "register_close"
                    ? "Counted cash"
                    : dialog.type === "register_open"
                      ? "Opening cash"
                      : "Amount"
                }
                type="number"
                min={dialog.type.startsWith("register") ? "0" : "0.01"}
                step="0.01"
                required
              />
              {dialog.type === "settle" && (
                <p>
                  Outstanding:{" "}
                  {cash(
                    data.contacts.find((c) => c.id === dialog.id)?.balance || 0,
                  )}
                </p>
              )}
              {dialog.type === "expense" && (
                <Field
                  name="description"
                  label="Expense description"
                  required
                />
              )}
              {dialog.type === "register_close" && (
                <Field name="note" label="Closing note" />
              )}
              {!dialog.type.startsWith("register") && <Method />}
            </>
          )}
          {dialog.type === "return" && (
            <>
              <p>
                This returns every item on the bill, restores stock and reverses
                the sale in reports. The server calculates any amount to refund,
                including settled customer credit.
              </p>
              <Field name="reason" label="Return reason" required />
              <Method />
            </>
          )}
          {dialog.type === "recurring" && (
            <>
              <Field name="name" label="Template name" required />
              <label>
                Customer
                <select name="contactId" required>
                  <option value="">Choose customer</option>
                  {data.contacts
                    .filter((c) => c.kind === "customer")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Product
                <select name="productId" required>
                  <option value="">Choose product</option>
                  {data.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {productName(p)}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                name="qty"
                label="Quantity"
                type="number"
                min="0.001"
                step="0.001"
                value="1"
                required
              />
              <Field
                name="price"
                label="Unit price"
                type="number"
                min="0"
                step="0.01"
                required
              />
              <label>
                Cycle
                <select name="cadence">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <Field
                name="nextDate"
                label="First due date"
                type="date"
                value={today()}
                required
              />
            </>
          )}
          {dialog.type === "import" && (
            <>
              <p>
                {importRows.length} new products. Existing products are not
                overwritten. {importDone} saved.
              </p>
              <Table
                headers={["Name", "Category", "Stock", "Price"]}
                rows={importRows
                  .slice(0, 20)
                  .map((p) => [[p.name,p.style,p.size,p.colour].filter(Boolean).join(' · '), p.category, p.stock, p.price])}
              />
              <p>
                Review values before saving. If a row fails, already saved
                products are kept and the next attempt resumes at that row.
              </p>
            </>
          )}
          {error && (
            <p className="retail-error" role="alert">
              {error}
            </p>
          )}
        </FormDialog>
      )}
    </section>
  );
}
function date(s: string) {
  return new Date(s).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="retail-empty">{children}</div>;
}
function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="retail-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return rows.length ? (
    <div className="retail-table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty>No records yet.</Empty>
  );
}
function Pagination({page,pages,onChange}:{page:number;pages:number;onChange:(page:number)=>void}) {
  if (pages <= 1) return null;
  return <nav className="retail-pagination" aria-label="Table pages"><button type="button" disabled={page===0} onClick={()=>onChange(page-1)}>Previous</button><span>Page {page+1} of {pages}</span><button type="button" disabled={page+1>=pages} onClick={()=>onChange(page+1)}>Next</button></nav>;
}
function Field({
  name,
  label,
  value,
  type = "text",
  required = false,
  min,
  max,
  step,
}: {
  name: string;
  label: string;
  value?: string | number;
  type?: string;
  required?: boolean;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <label>
      {label}
      <VoiceInput
        name={name}
        aria-label={label}
        defaultValue={value}
        type={type}
        required={required}
        min={min}
        max={max}
        step={step}
      />
    </label>
  );
}
function Method() {
  return (
    <label>
      Payment method
      <select name="method">
        <option value="cash">Cash</option>
        <option value="upi">UPI</option>
        <option value="card">Card</option>
      </select>
    </label>
  );
}
function FeatureFlagToggle({label,description,enabled,busy,onChange}:{label:string;description:string;enabled:boolean;busy:boolean;onChange:(enabled:boolean)=>void}) {
  return (
    <label className="retail-flag-card">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input type="checkbox" checked={enabled} disabled={busy} onChange={(event)=>onChange(event.target.checked)} />
    </label>
  );
}
function FormDialog({
  title,
  children,
  busy,
  onClose,
  onSubmit,
}: {
  title: string;
  children: ReactNode;
  busy: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="retail-dialog"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
      aria-labelledby="retail-form-title"
    >
      <form onSubmit={onSubmit}>
        <header>
          <h2 id="retail-form-title">{title}</h2>
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </header>
        <fieldset disabled={busy}>{children}</fieldset>
        <footer>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
