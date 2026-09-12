"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';

export default function DeleteProductDialog({name,onDelete,onClose,lang}:{name:string;onDelete:(password:string)=>Promise<void>;onClose:()=>void;lang:'en'|'mr'}) {
 const dialog=useRef<HTMLDialogElement>(null);
 const lock=useRef(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(lock.current)return;
  const form=event.currentTarget;
  const password=String(new FormData(form).get('password')||'');
  lock.current=true;setBusy(true);setError('');
  try{await onDelete(password);onClose();}catch(error){setError(error instanceof Error?error.message:'Could not delete product.');form.reset();}
  finally{lock.current=false;setBusy(false);}
 }
 return <dialog ref={dialog} className="retail-dialog" aria-labelledby="delete-product-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
  <form onSubmit={submit}>
   <h2 id="delete-product-title">{lang==='mr'?'उत्पादन हटवायचे?':'Delete product?'}</h2>
   <p><strong>{name}</strong></p>
   <p>{lang==='mr'?'हे उत्पादन हटवण्यासाठी तुमचा सध्याचा लॉगिन पासवर्ड टाका.':'Enter your current login password to delete this product.'}</p>
   <p>{lang==='mr'?'जुनी बिले कायम राहतील. बिलात किंवा सक्रिय नियमित बिलात वापरलेले उत्पादन हटवता येणार नाही.':'Past records are retained. Products used in bills or active recurring templates cannot be deleted.'}</p>
   <label>{lang==='mr'?'सध्याचा पासवर्ड':'Current password'}<input name="password" type="password" autoComplete="current-password" required autoFocus disabled={busy}/></label>
   {error&&<p className="retail-error" role="alert">{error}</p>}
   <footer><button type="button" disabled={busy} onClick={onClose}>{lang==='mr'?'रद्द करा':'Cancel'}</button><button className="danger" disabled={busy}>{busy?'Checking…':lang==='mr'?'उत्पादन हटवा':'Delete product'}</button></footer>
  </form>
 </dialog>;
}
