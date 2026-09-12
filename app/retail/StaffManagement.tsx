"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import VoiceInput from './VoiceInput';
type Staff={id:string;name:string;username:string;active:boolean};
type Rpc=(action:string,data:Record<string,unknown>)=>Promise<Staff[]>;
export default function StaffManagement({shopName,rpc}:{shopName:string;rpc:Rpc}){
 const [rows,setRows]=useState<Staff[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false);
 const [credential,setCredential]=useState<{username:string;password:string}|null>(null);
 const lock=useRef(false),call=useRef(rpc);
 useEffect(()=>{call.current=rpc;},[rpc]);
 useEffect(()=>{let alive=true;call.current('list',{}).then(rows=>{if(alive){setRows(rows);setLoaded(true);}}).catch(error=>{if(alive)setError(error.message);});return()=>{alive=false;};},[]);
 const password=()=>`Staff@${Array.from(crypto.getRandomValues(new Uint8Array(12)),n=>n.toString(16).padStart(2,'0')).join('')}`;
 async function change(action:string,data:Record<string,unknown>){
  if(lock.current)return false;lock.current=true;setBusy(true);setError('');
  try{setRows(await call.current(action,data));setLoaded(true);return true;}catch(error){setError(error instanceof Error?error.message:'Could not update staff');return false;}finally{lock.current=false;setBusy(false);}
 }
 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget;const values=new FormData(form);const secret=password();const username=String(values.get('username')).trim().toLowerCase();
  if(await change('create',{name:values.get('name'),username,password:secret})){setCredential({username,password:secret});form.reset();}
 }
 return <details className="staff-management owner-controls panel border p-4 my-4">
  <summary>Staff access · {shopName}</summary>
  <p className="text-sm my-3">Each operator has full access to this shop, including stock, bills and reports. Only the super admin can manage staff accounts.</p>
  {error&&<p role="alert" className="retail-error">{error}</p>}
  {!loaded&&!error&&<p role="status">Loading staff…</p>}
  {loaded&&!rows.length&&<p>No individual operators yet.</p>}
  <div className="grid gap-3 my-4">{rows.map(row=><div key={row.id} className="flex flex-wrap items-center gap-3 border p-3">
   <div className="min-w-0 flex-1"><strong>{row.name}</strong><p className="break-all">{row.username} · {row.active?'Active':'Paused'}</p></div>
   <button type="button" className="border p-2" disabled={busy} onClick={()=>void change(row.active?'pause':'resume',{id:row.id})}>{row.active?'Pause access':'Resume access'}</button>
   <details><summary className="cursor-pointer p-2">Reset password</summary><p className="text-sm my-2">This signs the operator out. Share the new password with them.</p><button className="border p-2" disabled={busy} type="button" onClick={async()=>{const secret=password();if(await change('reset',{id:row.id,password:secret}))setCredential({username:row.username,password:secret});}}>Generate new password</button></details>
  </div>)}</div>
  <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
   <label>Operator name<VoiceInput className="block w-full border p-3" name="name" required maxLength={120}/></label>
   <label>Username<VoiceInput className="block w-full border p-3" name="username" required minLength={3} maxLength={80} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,79}" autoComplete="off"/></label>
   <button className="border p-3" disabled={busy||!loaded}>{busy?'Saving…':'Create operator login'}</button>
  </form>
  {credential&&<div role="status" className="border p-4 my-4"><p>New login: <strong>{credential.username}</strong></p><p className="break-all">Temporary display: <code>{credential.password}</code></p><p className="text-sm">Share it privately. This password is shown only here and cannot be retrieved later.</p><button type="button" className="border p-2 mt-2" onClick={()=>setCredential(null)}>Hide password</button></div>}
 </details>;
}
