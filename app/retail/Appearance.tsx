"use client";
import { useEffect, useEffectEvent, useState } from 'react';
type Preferences = { theme: 'light'|'dark'; accent: string; size: string; autoPrint: boolean; receiptSound: boolean; receiptLogo: string };
const defaults: Preferences = {theme:'light',accent:'green',size:'normal',autoPrint:false,receiptSound:false,receiptLogo:''};
const colors: Record<string,string> = {green:'#205b42',blue:'#245bd6',orange:'#ab4713',purple:'#7240b2'};
export function readAppearance(): Preferences {
  try {
    const p = JSON.parse(localStorage.getItem('store-appearance') || '{}');
    return {
      theme:p.theme === 'dark'?'dark':'light',
      accent:colors[p.accent]?p.accent:'green',
      size:['normal','large','extra'].includes(p.size)?p.size:'normal',
      autoPrint:p.autoPrint===true,
      receiptSound:p.receiptSound===true,
      receiptLogo:typeof p.receiptLogo === 'string' && p.receiptLogo.startsWith('data:image/') && p.receiptLogo.length < 120_000 ? p.receiptLogo : '',
    };
  } catch { return defaults; }
}
export function applyAppearance(p: Preferences) {
  document.documentElement.dataset.retailTheme=p.theme;
  document.documentElement.style.setProperty('--retail-accent',colors[p.accent]);
  document.documentElement.style.setProperty('--retail-font',p.size==='extra'?'20px':p.size==='large'?'18px':'16px');
}
export function playReceiptSound() {
  if (!readAppearance().receiptSound) return;
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass(), oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.14);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.16);
    window.setTimeout(() => void context.close().catch(() => {}), 250);
  } catch {}
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
  const uploadLogo = async (file?: File) => {
    if (!file) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 90_000) {
      setNotice(lang==='mr'?'PNG, JPG किंवा WebP लोगो 90 KB पेक्षा कमी हवा.':'Use a PNG, JPG or WebP logo under 90 KB.');
      return;
    }
    const logo = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    update({receiptLogo:logo});
  };
  return <section className="retail-settings">
    <h3>{lang==='mr'?'दिसणे आणि छपाई':'Appearance & printing'}</h3>
    <p>{lang==='mr'?'या डिव्हाइसवरील सर्व दुकानांसाठी.':'For all shops on this device.'}</p>
    <div className="retail-form-grid">
      <label>{lang==='mr'?'थीम':'Theme'}<select value={preferences.theme} onChange={e=>update({theme:e.target.value as Preferences['theme']})}><option value="light">Light</option><option value="dark">Dark</option></select></label>
      <label>{lang==='mr'?'रंग':'Accent colour'}<select value={preferences.accent} onChange={e=>update({accent:e.target.value})}>{Object.keys(colors).map(c=><option key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</option>)}</select></label>
      <label>{lang==='mr'?'अक्षर आकार':'Text size'}<select value={preferences.size} onChange={e=>update({size:e.target.value})}><option value="normal">Normal</option><option value="large">Large</option><option value="extra">Extra large</option></select></label>
      <label><input type="checkbox" checked={preferences.autoPrint} onChange={e=>update({autoPrint:e.target.checked})}/>{lang==='mr'?'बिलानंतर छपाई संवाद उघडा':'Open print dialog after a saved bill'}</label>
      <label><input type="checkbox" checked={preferences.receiptSound} onChange={e=>update({receiptSound:e.target.checked})}/>{lang==='mr'?'बिल जतन झाल्यावर आवाज':'Play sound after a saved bill'}</label>
      <label>{lang==='mr'?'पावती लोगो':'Receipt logo'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void uploadLogo(e.target.files?.[0]).finally(()=>{e.currentTarget.value='';})}/></label>
    </div>
    {preferences.receiptLogo&&<div className="retail-logo-preview">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preferences.receiptLogo} alt="Receipt logo preview"/>
      <button type="button" onClick={()=>update({receiptLogo:''})}>{lang==='mr'?'लोगो काढा':'Remove logo'}</button>
    </div>}
    {notice&&<p role="status">{notice}</p>}
  </section>;
}
