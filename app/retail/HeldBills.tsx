"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import VoiceInput from './VoiceInput';
export type HeldRef={id:string;version:number;label:string};
type Held=HeldRef&{draft:Record<string,unknown>};
type Props={shopId:string;draft:Record<string,unknown>;held:HeldRef|null;hasCart:boolean;disabled:boolean;revision:unknown;
 rpc:(name:string,args:Record<string,unknown>)=>Promise<unknown>;onSaved:()=>void;onResume:(draft:Record<string,unknown>,held:HeldRef)=>void};
export default function HeldBills({shopId,draft,held,hasCart,disabled,revision,rpc,onSaved,onResume}:Props){
 const [rows,setRows]=useState<Held[]>([]),[label,setLabel]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const api=useRef(rpc),locked=useRef(false),request=useRef<{key:string;id:string}|null>(null),generation=useRef(0);
 useEffect(()=>{api.current=rpc;},[rpc]);
 const load=useCallback(async()=>{const n=++generation.current;const result=await api.current('retail_hold',{p_shop_id:shopId,p_request_id:crypto.randomUUID(),p_action:'list',p_data:{}});if(n===generation.current)setRows(result as Held[]);},[shopId]);
 useEffect(()=>{const counter=generation;let active=true;void load().catch(e=>{if(active)setError(e.message);});return()=>{active=false;counter.current++;};},[load,revision]);
 async function act(action:string,data:Record<string,unknown>){
  if(locked.current||disabled)return;locked.current=true;setBusy(true);setError('');
  const key=JSON.stringify({action,data});if(request.current?.key!==key)request.current={key,id:crypto.randomUUID()};
  try{await api.current('retail_hold',{p_shop_id:shopId,p_request_id:request.current.id,p_action:action,p_data:data});request.current=null;
   if(action==='save'){onSaved();setLabel('');}await load();
  }catch(e){setError(e instanceof Error?e.message:'Could not save held bill');}finally{locked.current=false;setBusy(false);}
 }
 return <section className="retail-panel" aria-busy={busy}>
  <h3>Held bills</h3><p>Park a customer’s cart and serve the next person. Stock is checked when billing. Held bills are shared with this shop’s operators.</p>
  {error&&<p role="alert" className="retail-error">{error}</p>}
  {held&&<p>Resumed: {held.label}</p>}
  <div className="retail-toolbar"><label>Customer / bill label<VoiceInput value={label} onChange={e=>setLabel(e.target.value)} maxLength={80} placeholder={held?.label||'e.g. Blue shirt customer'}/></label>
   <button disabled={disabled||busy||!hasCart||!(label.trim()||held?.label)} onClick={()=>void act('save',{...held,label:label.trim()||held?.label,draft})}>Hold current bill</button>
   <button disabled={disabled||busy} onClick={()=>void load().catch(e=>setError(e.message))}>Refresh held bills</button>
  </div>
  {hasCart&&<small>Hold or clear the current cart before resuming another bill.</small>}
  {rows.map(row=><div className="retail-toolbar" key={row.id}><strong>{row.label}</strong>
   <button disabled={disabled||busy||hasCart} onClick={()=>onResume(row.draft,{id:row.id,version:row.version,label:row.label})}>Resume</button>
   <button disabled={disabled||busy||held?.id===row.id} onClick={()=>{if(window.confirm(`Discard held bill "${row.label}"?`))void act('cancel',{id:row.id,version:row.version});}}>Discard</button>
  </div>)}
  {!rows.length&&<p>No held bills.</p>}
 </section>;
}
