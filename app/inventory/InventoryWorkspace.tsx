'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { closingCsv, Dashboard, indiaDate, Item, ItemDraft, money, stockStatus, totals, validateItem } from './domain';
import { inventoryCopy } from './copy';
import './inventory.css';
import VoiceInput from '../retail/VoiceInput';

type Rpc = (name: string, args: Record<string, unknown>) => Promise<unknown>;
type Action = { type: 'sale' | 'stock' | 'add' | 'edit' | 'delete'; item?: Item };

export default function InventoryWorkspace({ data, lang, rpc, refresh }: {
  data: Dashboard; lang: 'en' | 'mr'; rpc: Rpc; refresh: () => Promise<void>;
}) {
  const c = inventoryCopy[lang];
  const [view, setView] = useState<'inventory' | 'sales' | 'closing'>('inventory');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('');
  const [action, setAction] = useState<Action | null>(null);
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const refreshLock = useRef(false);
  const summary = useMemo(() => totals(data.todaysSales), [data.todaysSales]);
  const categories = useMemo(() => [...new Set(data.items.map(i => i.category))].sort(), [data.items]);
  const lowCount = data.items.filter(i => stockStatus(i) !== 'in').length;
  const rows = useMemo(() => data.items.filter(i =>
    (!category || i.category === category) &&
    (!stock || (stock === 'restock' ? stockStatus(i) !== 'in' : stockStatus(i) === stock)) &&
    `${i.name} ${i.category}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  ).sort((a, b) => a.name.localeCompare(b.name)), [data.items, category, stock, query]);
  const salesByItem = useMemo(() => {
    const result = new Map<string, ReturnType<typeof totals>>();
    for (const s of data.todaysSales) {
      if (!s.itemId) continue;
      const prev = result.get(s.itemId) ?? { qty: 0, revenue: 0, profit: 0 };
      const next = totals([s]);
      result.set(s.itemId, { qty: prev.qty + next.qty, revenue: prev.revenue + next.revenue, profit: prev.profit + next.profit });
    }
    return result;
  }, [data.todaysSales]);

  async function reload() {
    if (refreshLock.current) return;
    refreshLock.current = true;
    setRefreshing(true);
    try { await refresh(); setNotice(''); } catch { setNotice(c.refreshError); }
    finally { refreshLock.current = false; setRefreshing(false); }
  }
  useEffect(() => {
    // Refresh after returning to the counter and across the IST day boundary.
    const onFocus = () => { if (!action) void reload(); };
    const timer = window.setInterval(() => { if (!document.hidden && !action) void reload(); }, 60000);
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  });

  function download() {
    const url = URL.createObjectURL(new Blob([closingCsv(data)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url; link.download = `closing-${indiaDate()}.csv`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="inventory-workspace" aria-busy={refreshing}>
    <div className="workspace-title"><div><h2>{data.shop.name}</h2><p>{data.shop.area} · {indiaDate()} IST</p></div>
      <button onClick={() => void reload()} disabled={refreshing}>{refreshing ? c.refreshing : c.refresh}</button></div>
    <div className="workspace-kpis">
      <Kpi label={c.todaySales} value={money(summary.revenue)} />
      <Kpi label={c.todayProfit} value={money(summary.profit)} />
      <button className="workspace-kpi" onClick={() => { setView('inventory'); setStock('restock'); setCategory(''); setQuery(''); }}><span>{c.lowStock}</span><strong className={lowCount ? 'stock-warning' : ''}>{lowCount}</strong></button>
      <Kpi label={c.products} value={String(data.items.length)} />
    </div>
    <div className="workspace-actions" aria-label={c.actions}>
      <button className="primary" onClick={() => setAction({ type: 'sale' })} disabled={!data.items.some(i => i.stock > 0)}>{c.addSale}</button>
      <button onClick={() => setAction({ type: 'stock' })} disabled={!data.items.length}>{c.updateStock}</button>
      <button onClick={() => setAction({ type: 'add' })}>{c.addItem}</button>
      <button onClick={() => setView('closing')}>{c.closing}</button>
    </div>
    <nav className="workspace-nav" aria-label={c.inventory}>
      {(['inventory', 'sales', 'closing'] as const).map(v => <button key={v} aria-current={view === v ? 'page' : undefined} onClick={() => setView(v)}>{c[v]}</button>)}
    </nav>
    {notice && <p className="workspace-notice" role="status">{notice}</p>}
    {view === 'inventory' && <>
      <div className="workspace-filters">
        <label className="search-field">{c.search}<VoiceInput type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={c.search} /></label>
        <label>{c.category}<select value={category} onChange={e => setCategory(e.target.value)}><option value="">{c.allCategories}</option>{categories.map(cat => <option key={cat}>{cat}</option>)}</select></label>
        <label>{c.status}<select value={stock} onChange={e => setStock(e.target.value)}><option value="">{c.allStock}</option><option value="in">{c.in}</option><option value="low">{c.low}</option><option value="out">{c.out}</option><option value="restock">{c.lowStock}</option></select></label>
        {(query || category || stock) && <button onClick={() => { setQuery(''); setCategory(''); setStock(''); }}>{c.clear}</button>}
      </div>
      {!rows.length ? <Empty title={data.items.length ? (stock === 'restock' && !query && !category ? c.noRestock : c.noMatch) : c.noItems}>
        {!data.items.length && <><p>{c.firstItem}</p><button className="primary" onClick={() => setAction({ type: 'add' })}>{c.addItem}</button></>}
      </Empty> : <div className="inventory-table-wrap"><table className="inventory-table"><caption className="sr-only">{c.inventory}</caption><thead><tr>
        {[c.name,c.category,c.stock,c.buy,c.sell,c.sold,c.revenue,c.profit,c.status,c.actions].map(h => <th key={h} scope="col">{h}</th>)}
      </tr></thead><tbody>{rows.map(i => {
        const stats = salesByItem.get(i.id) ?? { qty: 0, revenue: 0, profit: 0 };
        const status = stockStatus(i);
        return <tr key={i.id}>
          <td data-label={c.name} className="item-name">{i.name}</td><td data-label={c.category}>{i.category}</td>
          <td data-label={c.stock}><button className="quantity-button" aria-label={`${c.updateStock}: ${i.name}`} onClick={() => setAction({ type: 'stock', item: i })}>{i.stock}</button></td>
          <td data-label={c.buy}>{money(i.buyingPrice)}</td><td data-label={c.sell}>{money(i.defaultSellingPrice)}</td>
          <td data-label={c.sold}>{stats.qty}</td><td data-label={c.revenue}>{money(stats.revenue)}</td><td data-label={c.profit}>{money(stats.profit)}</td>
          <td data-label={c.status}><span className={`stock-badge ${status}`}>{c[status]}</span></td>
          <td data-label={c.actions}><div className="row-actions"><button onClick={() => setAction({ type: 'sale', item: i })} disabled={!i.stock}>{c.addSale}</button><button onClick={() => setAction({ type: 'edit', item: i })}>{c.edit}</button></div></td>
        </tr>;
      })}</tbody></table></div>}
      <p className="result-count">{rows.length} / {data.items.length} {c.results}</p>
    </>}
    {view === 'sales' && (!data.todaysSales.length ? <Empty title={c.noSales} /> : <div className="inventory-table-wrap"><table className="sales-table"><thead><tr>{[c.name,c.qty,c.salePrice,c.revenue,c.profit].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{data.todaysSales.map(s => <tr key={s.id}><td>{s.itemName}</td><td>{s.qty}</td><td>{money(s.soldPrice)}</td><td>{money(s.qty*s.soldPrice)}</td><td>{money(s.qty*(s.soldPrice-s.buyingPrice))}</td></tr>)}</tbody><tfoot><tr><th>{c.closing}</th><td>{summary.qty}</td><td></td><td>{money(summary.revenue)}</td><td>{money(summary.profit)}</td></tr></tfoot></table></div>)}
    {view === 'closing' && <section className="closing-view"><h3>{c.closing} · {indiaDate()}</h3><p>{c.closingHint}</p>
      <dl>{[[c.todaySales,money(summary.revenue)],[c.todayProfit,money(summary.profit)],[c.units,summary.qty],[c.transactions,data.todaysSales.length],[c.value,money(data.items.reduce((n,i) => n+i.stock*i.buyingPrice,0))],[c.lowStock,lowCount]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <button className="primary" onClick={download}>{c.download}</button>
    </section>}
    {action && <ActionDialog action={action} data={data} lang={lang} rpc={rpc} onClose={() => setAction(null)} onDelete={item => setAction({ type: 'delete', item })} onSaved={async () => {
      setAction(null); setNotice(c.saved);
      try { await refresh(); } catch { setNotice(`${c.saved} ${c.refreshError}`); }
    }} />}
  </section>;
}

function Kpi({ label, value }: { label: string; value: string }) { return <div className="workspace-kpi"><span>{label}</span><strong>{value}</strong></div>; }
function Empty({ title, children }: { title: string; children?: ReactNode }) { return <div className="workspace-empty"><h3>{title}</h3>{children}</div>; }

function ActionDialog({ action, data, lang, rpc, onClose, onSaved, onDelete }: {
  action: Action; data: Dashboard; lang: 'en' | 'mr'; rpc: Rpc;
  onClose: () => void; onSaved: () => Promise<void>; onDelete: (item: Item) => void;
}) {
  const c = inventoryCopy[lang];
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const requestId = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [search, setSearch] = useState('');
  const [itemId, setItemId] = useState(action.item?.id ?? '');
  const selected = data.items.find(i => i.id === itemId);
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState(String(action.item?.defaultSellingPrice ?? ''));
  const [count, setCount] = useState(String(action.item?.stock ?? ''));
  const [draft, setDraft] = useState<ItemDraft>(action.item ?? { name: '', category: '', buyingPrice: 0, defaultSellingPrice: 0, stock: 0, reorderLevel: 5 });
  const title = action.type === 'sale' ? c.addSale : action.type === 'stock' ? c.updateStock : action.type === 'add' ? c.addItem : action.type === 'edit' ? c.editItem : c.deleteTitle;
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const change = (key: keyof ItemDraft, value: string | number) => setDraft(d => ({ ...d, [key]: value }));
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    setError('');
    const amount = Number(qty), unitPrice = Number(price), stockCount = Number(count);
    if ((action.type === 'add' || action.type === 'edit') && !validateItem(draft)) { setError(c.invalid); return; }
    if (action.type === 'sale' && (!selected || !qty || !price || !Number.isSafeInteger(amount) || amount <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0)) { setError(c.invalid); return; }
    if (action.type === 'sale' && selected && amount > selected.stock && !uncertain) { setError(c.overStock); return; }
    if (action.type === 'stock' && (!selected || !count || !Number.isSafeInteger(stockCount) || stockCount < 0 || stockCount > 2147483647)) { setError(c.invalid); return; }
    lock.current = true; setBusy(true);
    try {
      if (action.type === 'sale') {
        requestId.current ??= crypto.randomUUID();
        await rpc('record_sale_v2', { p_shop_id: data.shop.id, p_item_id: itemId, p_qty: amount, p_sold_price: unitPrice, p_request_id: requestId.current });
      } else if (action.type === 'stock') {
        await rpc('set_stock_checked', { p_item_id: itemId, p_stock: stockCount, p_expected_stock: selected!.stock });
      } else if (action.type === 'delete') {
        const result=await rpc('delete_item_confirmed', { p_item_id: action.item!.id, p_password:String(new FormData(e.currentTarget).get('password')||'') }) as {error?:string;deleted?:boolean};
        if(result.error||!result.deleted)throw new Error(result.error||'Product was not deleted.');
      } else {
        const args = { p_name: draft.name.trim(), p_category: draft.category.trim(), p_buying_price: draft.buyingPrice, p_selling_price: draft.defaultSellingPrice, p_reorder_level: draft.reorderLevel };
        if (action.type === 'add') await rpc('add_item', { ...args, p_shop_id: data.shop.id, p_stock: draft.stock });
        else await rpc('edit_item', { ...args, p_item_id: action.item!.id });
      }
      await onSaved();
    } catch (err) {
      const detail = err instanceof Error ? err.message : '';
      const known = /STOCK_CHANGED|INSUFFICIENT_STOCK|VALIDATION|PGRST202|Could not find the function/.test(detail);
      if (action.type === 'sale' && !known) setUncertain(true);
      if (action.type === 'sale' && known) { requestId.current = null; setUncertain(false); }
      setError(action.type==='delete' ? detail : detail.includes('STOCK_CHANGED') ? c.stale : detail.includes('INSUFFICIENT_STOCK') ? c.overStock : /PGRST202|Could not find the function/.test(detail) ? c.setup : action.type === 'sale' && !known ? c.uncertain : c.failed);
    } finally { lock.current = false; setBusy(false); }
  }
  return <dialog ref={dialog} className="inventory-dialog" aria-labelledby="action-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <form onSubmit={submit}><header><h2 id="action-title">{title}</h2><button type="button" disabled={busy} onClick={onClose}>{c.cancel}</button></header>
      <fieldset disabled={busy || uncertain}>
        {(action.type === 'sale' || action.type === 'stock') && <>
          <label>{c.saleSearch}<VoiceInput autoFocus type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
          <label>{c.product}<select required value={itemId} onChange={e => { setItemId(e.target.value); const i = data.items.find(i => i.id === e.target.value); setPrice(String(i?.defaultSellingPrice ?? '')); setCount(String(i?.stock ?? '')); }}><option value="">{c.choose}</option>{data.items.filter(i => i.id === itemId || `${i.name} ${i.category}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(i => <option value={i.id} key={i.id} disabled={action.type === 'sale' && i.stock === 0}>{i.name} ({c.available}: {i.stock})</option>)}</select></label>
          {action.type === 'stock' ? <><p>{c.stockHint}</p><label>{c.stock}<VoiceInput required type="number" min="0" step="1" max="2147483647" value={count} onChange={e => setCount(e.target.value)} /></label></> : <>
            <div className="form-pair"><label>{c.qty}<VoiceInput required type="number" min="1" step="1" max={selected?.stock} value={qty} onChange={e => setQty(e.target.value)} /></label>
              <label>{c.salePrice}<VoiceInput required type="number" min="0" max="9999999999.99" step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></label></div>
            <div className="sale-preview"><span>{c.revenue}: {money(Number(qty)*Number(price))}</span><span>{c.profit}: {money(Number(qty)*(Number(price)-(selected?.buyingPrice ?? 0)))}</span></div>
          </>}
        </>}
        {(action.type === 'add' || action.type === 'edit') && <>
          <label>{c.name}<VoiceInput autoFocus required maxLength={120} value={draft.name} onChange={e => change('name', e.target.value)} /></label>
          <label>{c.category}<VoiceInput required list="shop-categories" maxLength={80} value={draft.category} onChange={e => change('category', e.target.value)} /><datalist id="shop-categories">{[...new Set([...data.items.map(i => i.category), 'Kirana', 'Pan Masala', 'Cigarettes', 'Accessories', 'General'])].map(cat => <option key={cat} value={cat} />)}</datalist></label>
          <div className="form-pair"><label>{c.buy}<VoiceInput required type="number" min="0" step="0.01" max="9999999999.99" value={draft.buyingPrice} onChange={e => change('buyingPrice', e.target.value === '' ? '' : Number(e.target.value))} /></label><label>{c.sell}<VoiceInput required type="number" min="0" step="0.01" max="9999999999.99" value={draft.defaultSellingPrice} onChange={e => change('defaultSellingPrice', e.target.value === '' ? '' : Number(e.target.value))} /></label></div>
          <div className="form-pair">{action.type === 'add' && <label>{c.stock}<VoiceInput required type="number" min="0" step="1" max="2147483647" value={draft.stock} onChange={e => change('stock', e.target.value === '' ? '' : Number(e.target.value))} /></label>}
          <label>{c.threshold}<VoiceInput required type="number" min="0" step="1" max="2147483647" value={draft.reorderLevel} onChange={e => change('reorderLevel', e.target.value === '' ? '' : Number(e.target.value))} /></label></div>
        </>}
        {action.type === 'delete' && <><p className="delete-name">{action.item?.name}</p><p>{c.deleteHint}</p><label>{lang==='mr'?'सध्याचा पासवर्ड':'Current password'}<input name="password" type="password" autoComplete="current-password" required /></label></>}
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer>{action.type === 'edit' && <button className="danger-text" type="button" disabled={busy} onClick={() => onDelete(action.item!)}>{c.remove}</button>}
        <button className={action.type === 'delete' ? 'danger' : 'primary'} disabled={busy}>{busy ? c.saving : uncertain ? c.retry : action.type === 'sale' ? c.saveSale : action.type === 'delete' ? c.remove : c.save}</button></footer>
    </form>
  </dialog>;
}
