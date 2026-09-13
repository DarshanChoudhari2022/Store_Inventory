"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import VoiceInput from "../retail/VoiceInput";

export default function LoginPage() {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/session', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({username:String(form.get('username')||''),password:String(form.get('password')||'')})});
      const result = await response.json() as Record<string, unknown>;
      if (!response.ok || !result.cacheId) throw new Error(String(result.error || 'Invalid username or password'));
      localStorage.setItem('store-inventory-session-v2', JSON.stringify({cacheId:String(result.cacheId),role:result.role==='owner'?'owner':'shop',shopId:result.shopId ? String(result.shopId):undefined,staffRole:result.staffRole==='cashier'?'cashier':result.role==='shop'?'manager':undefined}));
      router.push('/');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to sign in'); setBusy(false); }
  }
  return <main className="auth-shell min-h-screen grid place-items-center px-5 py-12"><div className="auth-grid w-full max-w-md"><Link href="/" className="mb-8 block text-sm font-semibold text-[#246b4b]">← StoreStock</Link><form onSubmit={submit} className="auth-card"><span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#246b4b]">Secure access</span><h1 className="mt-2 text-3xl font-semibold">Sign in to your workspace</h1><p className="mt-2 text-sm text-[#657266]">Use your owner, manager, or cashier credentials.</p><label className="mt-7 block text-sm font-medium" htmlFor="login-username">Username</label><VoiceInput id="login-username" name="username" required autoComplete="username" className="mt-2 w-full border border-[#cfd9d0] px-3 py-3" autoFocus/><label className="mt-4 block text-sm font-medium" htmlFor="login-password">Password</label><VoiceInput id="login-password" name="password" type="password" required autoComplete="current-password" className="mt-2 w-full border border-[#cfd9d0] px-3 py-3"/><button disabled={busy} className="mt-6 w-full bg-[#246b4b] px-4 py-3 font-semibold text-white">{busy ? 'Opening…' : 'Open dashboard'}</button>{error && <p className="mt-4 text-sm text-[#9a3412]" role="alert">{error}</p>}</form></div></main>;
}
