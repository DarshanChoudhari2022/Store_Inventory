"use client";
import { useEffect, useEffectEvent, useState } from 'react';
type Preferences = { theme: 'light'|'dark'; accent: string; size: string; autoPrint: boolean };
const defaults: Preferences = {theme:'light',accent:'green',size:'normal',autoPrint:false};
const colors: Record<string,string> = {green:'#205b42',blue:'#245bd6',orange:'#ab4713',purple:'#7240b2'};
export function readAppearance(): Preferences {
  try { const p = JSON.parse(localStorage.getItem('store-appearance') || '{}'); return {theme:p.theme === 'dark'?'dark':'light',accent:colors[p.accent]?p.accent:'green',size:['normal','large','extra'].includes(p.size)?p.size:'normal',autoPrint:p.autoPrint===true}; } catch { return defaults; }
}
export function applyAppearance(p: Preferences) {
  document.documentElement.dataset.retailTheme=p.theme;
  document.documentElement.style.setProperty('--retail-accent',colors[p.accent]);
  document.documentElement.style.setProperty('--retail-font',p.size==='extra'?'20px':p.size==='large'?'18px':'16px');
}
export function AppearanceBootstrap() {
  useEffect(() => { applyAppearance(readAppearance()); }, []);
  return null;
}
export default function Appearance({lang}:{lang:'en'|'mr'}) {
  const [preferences,setPreferences]=useState(defaults);
  const [notice,setNotice]=useState('');
  const restore=useEffectEvent(()=>setPreferences(readAppearance()));
  // Hydrate a device preference after SSR; localStorage is not available on the server.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{restore();},[]);
  const update=(patch:Partial<Preferences>)=>{
    const next={...preferences,...patch}; setPreferences(next); applyAppearance(next);
    try{localStorage.setItem('store-appearance',JSON.stringify(next));setNotice(lang==='mr'?'या डिव्हाइसवर जतन केले':'Saved on this device');}catch{setNotice('Applied for now. Device storage is unavailable.');}
  };
  return <section className="retail-settings">
    <h3>{lang==='mr'?'दिसणे आणि छपाई':'Appearance & printing'}</h3>
    <p>{lang==='mr'?'या डिव्हाइसवरील सर्व दुकानांसाठी.':'For all shops on this device.'}</p>
    <div className="retail-form-grid">
      <label>{lang==='mr'?'थीम':'Theme'}<select value={preferences.theme} onChange={e=>update({theme:e.target.value as Preferences['theme']})}><option value="light">Light</option><option value="dark">Dark</option></select></label>
      <label>{lang==='mr'?'रंग':'Accent colour'}<select value={preferences.accent} onChange={e=>update({accent:e.target.value})}>{Object.keys(colors).map(c=><option key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</option>)}</select></label>
      <label>{lang==='mr'?'अक्षर आकार':'Text size'}<select value={preferences.size} onChange={e=>update({size:e.target.value})}><option value="normal">Normal</option><option value="large">Large</option><option value="extra">Extra large</option></select></label>
      <label><input type="checkbox" checked={preferences.autoPrint} onChange={e=>update({autoPrint:e.target.checked})}/>{lang==='mr'?'बिलानंतर छपाई संवाद उघडा':'Open print dialog after a saved bill'}</label>
    </div>
    {notice&&<p role="status">{notice}</p>}
  </section>;
}
