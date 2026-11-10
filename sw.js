// Offline support. The build fills in VERSION and SHELL (every file of the site).
// - the site's own files are stored on install and always answered from the device;
// - satellite tiles (Esri) and anything else from outside are stored the first time they load,
//   so after one online visit the whole presentation, maps included, works without a connection;
// - a new version of the site installs in the background and is used from the next start.
const VERSION = '183d39440348';
const SHELL = ["./","assets/img/favicon.png","assets/img/icon-180.png","assets/img/icon-192.png","assets/img/icon-512.png","assets/img/icon-maskable-512.png","assets/img/logo.png","css/style.css","gate/gate.css","gate/gate.js","gate/pwa.js","index.html","manifest.webmanifest","secure.bin","vendor/fonts/OFL.txt","vendor/fonts/barlow-condensed-latin-500-normal.woff2","vendor/fonts/barlow-condensed-latin-600-normal.woff2","vendor/fonts/barlow-latin-400-normal.woff2","vendor/fonts/barlow-latin-500-normal.woff2","vendor/fonts/barlow-latin-600-normal.woff2","vendor/fonts/fonts.css","vendor/leaflet/images/layers-2x.png","vendor/leaflet/images/layers.png","vendor/leaflet/images/marker-icon-2x.png","vendor/leaflet/images/marker-icon.png","vendor/leaflet/images/marker-shadow.png","vendor/leaflet/leaflet.css","vendor/leaflet/leaflet.js"];
const SITE_CACHE = 'altum-site-' + VERSION, EXT_CACHE = 'altum-ext-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SITE_CACHE).then((c) => c.addAll(SHELL.map((p) => new Request(p, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('altum-site-') && k !== SITE_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// messages from the page: version, and "download everything again" (fresh copies of every site file)
self.addEventListener('message', (e) => {
  const port = e.ports[0]; if (!port) return;
  if (e.data === 'version') port.postMessage({ version: VERSION });
  if (e.data === 'recache') caches.open(SITE_CACHE).then((c) => c.addAll(SHELL.map((p) => new Request(p, { cache: 'reload' })))).then(() => port.postMessage({ ok: true, version: VERSION }), () => port.postMessage({ ok: false }));
});

self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(SITE_CACHE);
      const hit = req.mode === 'navigate' ? await c.match('./index.html') || await c.match('./') : await c.match(req, { ignoreSearch: true });
      return hit || fetch(req);
    })());
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(EXT_CACHE);
    const hit = await c.match(req.url, { ignoreVary: true }); if (hit) return hit;
    try { const res = await fetch(req); if (res.ok || res.type === 'opaque') c.put(req.url, res.clone()); return res; }
    catch { return Response.error(); }
  })());
});
