"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {downloadCsv,productName,today,type CartLine,type Workspace} from './domain';
import VoiceInput,{VoiceTextarea} from './VoiceInput';

type Delivery={id:string;template:string;route:string;customer:string;phone:string;address:string;date:string;lines:CartLine[]};
type Props={data:Workspace;disabled:boolean;rpc:(name:string,args:Record<string,unknown>)=>Promise<unknown>;onSaved:()=>Promise<void>};
export default function DeliveryPlanner({data,disabled,rpc,onSaved}:Props){
 const [date,setDate]=useState(today()),[list,setList]=useState<Delivery[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[editing,setEditing]=useState(''),[filter,setFilter]=useState('');
 const alive=useRef(true),locked=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const template=data.recurring.find(row=>row.id===editing);
 async function run(work:()=>Promise<void>){
  if(disabled||locked.current)return;
  locked.current=true;setBusy(true);setError('');
  try{await work();}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Could not load deliveries');}
  finally{locked.current=false;if(alive.current)setBusy(false);}
 }
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const values=new FormData(event.currentTarget);
  const dates=String(values.get('dates')||'').split(/[\s,]+/).filter(Boolean);
  if(dates.some(value=>!/^\d{4}-\d{2}-\d{2}$/.test(value))){setError('Use YYYY-MM-DD dates separated by commas or new lines.');return;}
  await run(async()=>{
   await rpc('retail_delivery_settings',{p_shop_id:data.shop.id,p_id:editing,p_route:String(values.get('route')||''),p_skip_dates:dates});
   if(alive.current){setEditing('');setList(null);}await onSaved();
  });
 }
 const shown=(list||[]).filter(row=>!filter||row.route===filter);
 const itemText=(lines:CartLine[])=>lines.map(line=>{const p=data.products.find(p=>p.id===line.id);return `${p?productName(p):'Unavailable product'} × ${line.qty}`;}).join('; ');
 return <section className="retail-panel">
  <h3>Delivery routes & skip dates</h3>
  <p>Assign recurring customers to routes. Planned skip dates advance the schedule without billing or reducing stock.</p>
  {error&&<p className="retail-error" role="alert">{error}</p>}
  <label>Recurring template<select disabled={busy||disabled} value={editing} onChange={e=>setEditing(e.target.value)}><option value="">Choose a template to edit</option>{data.recurring.map(row=><option key={row.id} value={row.id}>{row.name}{row.route?` · ${row.route}`:''}</option>)}</select></label>
  {template&&<form key={template.id} onSubmit={save}><fieldset disabled={busy||disabled} className="retail-form-grid">
   <label>Route<VoiceInput name="route" maxLength={80} defaultValue={template.route||''} placeholder="Market road"/></label>
   <label>Skip dates<VoiceTextarea name="dates" rows={4} defaultValue={(template.skip_dates||[]).join('\n')} placeholder="2026-09-20, 2026-09-21"/></label>
   <button className="primary">{busy?'Saving…':'Save delivery settings'}</button>
  </fieldset></form>}
  <div className="retail-toolbar">
   <label>Delivery date<VoiceInput type="date" min={today()} value={date} disabled={busy} onChange={e=>{setDate(e.target.value);setList(null);}}/></label>
   <button disabled={disabled||busy||!date} onClick={()=>void run(async()=>{const result=await rpc('retail_delivery_list',{p_shop_id:data.shop.id,p_date:date});if(alive.current){setList(result as Delivery[]);setFilter('');}})}>{busy?'Loading…':'Load delivery list'}</button>
   {list&&<><label>Route<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">All routes</option>{[...new Set(list.map(row=>row.route).filter(Boolean))].map(route=><option key={route}>{route}</option>)}</select></label>
   <button disabled={!shown.length} onClick={()=>downloadCsv(`deliveries-${date}.csv`,[['Date','Route','Customer','Phone','Address','Template','Products'],...shown.map(row=>[row.date,row.route||'Unassigned',row.customer,row.phone,row.address,row.template,itemText(row.lines)])])}>Export delivery CSV</button></>}
  </div>
  {list&&<><p>{shown.length} scheduled deliveries. Paused templates and skipped dates are excluded. Shows upcoming unbilled occurrences; this is not proof of delivery.</p>{shown.map(row=><article className="retail-panel" key={row.id}><strong>{row.route||'Unassigned'} · {row.customer}</strong><p>{row.address} {row.phone}</p><p>{itemText(row.lines)}</p></article>)}</>}
 </section>;
}
