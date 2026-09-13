"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {cash,downloadCsv,today,type CartLine,type Invoice,type Workspace} from './domain';
import VoiceInput from './VoiceInput';

type Quote={id:string;customer:{name:string};lines:(CartLine&{name:string})[];total:number;status:string;valid_until:string;created_at:string};
type Props={data:Workspace;cart:CartLine[];disabled:boolean;rpc:(name:string,args:Record<string,unknown>)=>Promise<unknown>;onInvoice:(invoice:Invoice)=>void;onCreated:()=>void;onChanged:()=>Promise<void>};

export default function Quotes({data,cart,disabled,rpc,onInvoice,onCreated,onChanged}:Props){
 const [rows,setRows]=useState<Quote[]>([]),[offset,setOffset]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState<Quote|null>(null);
 const api=useRef(rpc),lock=useRef(false),request=useRef<{key:string;id:string}|null>(null),generation=useRef(0);
 useEffect(()=>{api.current=rpc;},[rpc]);
 const load=useCallback(async()=>{const n=++generation.current;const result=await api.current('retail_quote_list',{p_shop_id:data.shop.id,p_offset:offset});if(n===generation.current)setRows(result as Quote[]);},[data.shop.id,offset]);
 useEffect(()=>{let active=true;const counter=generation;void load().catch(e=>{if(active)setError(e.message);});return()=>{active=false;counter.current++;};},[load]);
 async function act(action:string,details:Record<string,unknown>){
  if(lock.current||disabled)return;lock.current=true;setBusy(true);setError('');
  const key=JSON.stringify({action,details});if(request.current?.key!==key)request.current={key,id:crypto.randomUUID()};
  try{
   const result=await api.current('retail_quote_action',{p_shop_id:data.shop.id,p_request_id:request.current.id,p_action:action,p_data:details});
   request.current=null;setSelected(null);
   if(action==='create')onCreated();if(action==='invoice')onInvoice(result as Invoice);
   await load();await onChanged();
  }catch(e){setError(e instanceof Error?e.message:'Could not save quotation');}finally{lock.current=false;setBusy(false);}
 }
 function create(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);void act('create',{customerId:form.get('customer'),validUntil:form.get('validUntil'),lines:cart});}
 return <section className="retail-panel" aria-busy={busy}>
  <h3>Quotations & sales orders</h3><p>Add products to the Sell cart, then save a quotation here. Confirm it as an order and collect payment when ready to invoice. Stock is checked and deducted only when invoicing.</p>
  {error&&<p className="retail-error" role="alert">{error}</p>}
  <form onSubmit={create}><fieldset className="retail-form-grid" disabled={busy||disabled}>
   <label>Customer<select name="customer" required defaultValue=""><option value="">Choose customer</option>{data.contacts.filter(c=>c.kind==='customer').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <label>Valid until<VoiceInput type="date" name="validUntil" required min={today()} defaultValue={today()}/></label>
   <button className="primary" disabled={!cart.length}>Save cart as quotation ({cart.length} products)</button>
  </fieldset></form>
  {rows.slice(0,50).map(q=><article className="retail-panel" key={q.id}>
   <h4>{q.customer.name} · {cash(q.total)}</h4><p>{q.status} · Valid until {q.valid_until} · Ref {q.id}</p>
   <details><summary>Quoted products</summary>{q.lines.map(l=><p key={l.id}>{l.name} × {l.qty} · {cash(l.price)} · {l.discount}% discount</p>)}</details>
   <div className="retail-row-actions">
    <button onClick={()=>downloadCsv(`quotation-${q.id}.csv`,[['Quotation',q.id],['Customer',q.customer.name],['Status',q.status],['Valid until',q.valid_until],['Item','Qty','Price','Discount %'],...q.lines.map(l=>[l.name,l.qty,l.price,l.discount]),['Total incl. configured tax',q.total]])}>Download quotation</button>
    {q.status==='quotation'&&<button disabled={busy||disabled} onClick={()=>void act('order',{id:q.id})}>Confirm sales order</button>}
    {q.status==='order'&&<button disabled={busy||disabled} onClick={()=>setSelected(q)}>Invoice order</button>}
    {['quotation','order'].includes(q.status)&&<button disabled={busy||disabled} onClick={()=>setSelected(q)}>Review / cancel</button>}
   </div>
   {selected?.id===q.id&&<form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void act('invoice',{id:q.id,method:f.get('method'),paid:Number(f.get('paid')),interstate:f.get('interstate')==='on',supplyState:f.get('supplyState')||''});}}>
    <fieldset disabled={busy||disabled} className="retail-form-grid">
     {q.status==='order'&&<><label>Payment<select name="method"><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="credit">Credit (enter zero paid)</option></select></label>
      <label>Amount paid<VoiceInput name="paid" type="number" required min={0} max={q.total} step="0.01" defaultValue={q.total}/></label>
      <label><input type="checkbox" name="interstate"/>Inter-state supply</label><label>Place of supply<VoiceInput name="supplyState"/></label>
      <button className="primary">Save invoice & deduct stock</button></>}
     <button type="button" onClick={()=>void act('cancel',{id:q.id})}>Confirm cancellation</button><button type="button" onClick={()=>setSelected(null)}>Close</button>
    </fieldset>
   </form>}
  </article>)}
  {!rows.length&&<p>No quotations on this page.</p>}
  <nav className="retail-pagination" aria-label="Quotation pages"><button disabled={busy||offset===0} onClick={()=>setOffset(offset-50)}>Previous</button><span>Page {offset/50+1}</span><button disabled={busy||rows.length<=50} onClick={()=>setOffset(offset+50)}>Next</button></nav>
 </section>;
}
