const CACHE = 'storestock-shell-v2';
async function warmShell() {
  const cache = await caches.open(CACHE);
  const response = await fetch('/', {cache:'reload'});
  if (!response.ok) throw new Error('Could not prepare offline shell');
  const html = await response.clone().text();
  await cache.put('/', response);
  const assets = [...html.matchAll(/(?:src|href)=["']([^"']*\/_next\/static\/[^"']+)["']/g)].map(m => m[1].replaceAll('&amp;', '&'));
  await Promise.all([...new Set(assets)].map(asset => cache.add(asset)));
}
self.addEventListener('install', event => { event.waitUntil(warmShell().then(() => self.skipWaiting())); });
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('storestock-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_APP_ASSETS' || !Array.isArray(event.data.assets)) return;
  const assets = event.data.assets.slice(0,100).filter(asset => {
    try { const url = new URL(asset, self.location.origin); return url.origin === self.location.origin && url.pathname.startsWith('/_next/static/'); } catch { return false; }
  });
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(assets.map(asset => cache.add(asset).catch(() => {})))));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Never cache API or authenticated database responses in the shared shell.
  if (event.request.mode === 'navigate') event.respondWith(fetch(event.request).then(response => {
    if(response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put('/', copy))); }
    return response;
  }).catch(() => caches.match('/').then(response => response || Response.error())));
  else if (url.pathname.startsWith('/_next/static/') || url.pathname === '/favicon.svg') event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if(response.ok) { const copy=response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request,copy))); }
    return response;
  })));
});
