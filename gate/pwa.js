// App mode: offline storage, "install" prompt and update notice. Works on desktop (Chrome/Edge),
// Android (Chrome) and iPad/iPhone (Safari → Share → Add to Home Screen).
const EXT_CACHE = 'altum-ext-v1';
const LS = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let box = null;
function pill(html, actions = {}, ms = 0) {
  if (!box) { box = document.createElement('div'); box.className = 'pwa-box'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
  const p = document.createElement('div'); p.className = 'pwa-pill'; p.innerHTML = html;
  for (const [sel, fn] of Object.entries(actions)) p.querySelector(sel)?.addEventListener('click', () => { fn(); p.remove(); });
  const x = document.createElement('button'); x.type = 'button'; x.className = 'pwa-x'; x.setAttribute('aria-label', 'Close'); x.textContent = '×'; x.onclick = () => p.remove(); p.appendChild(x);
  box.appendChild(p); if (ms) setTimeout(() => p.remove(), ms);
  return p;
}

// ---- service worker
const swOk = 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');
if (swOk) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) pill('A new version of the presentation is ready. <button type="button" class="pwa-btn" data-a="r">Restart</button>', { '[data-a="r"]': () => location.reload() });
  });
}

// ---- satellite tiles: the app hands over the tiles it uses, they are stored for offline use
let queue = [], running = 0, total = 0, done = 0;
async function pump(cache) {
  while (queue.length && running < 4) {
    const u = queue.shift(); running++;
    (async () => { try { if (!(await cache.match(u, { ignoreVary: true }))) { const r = await fetch(u, { mode: 'cors' }); if (r.ok) await cache.put(u, r); } } catch { /* offline: try next time */ } running--; done++; pump(cache); if (done === total) finished(); })();
  }
}
function finished() {
  if (!swOk || LS.get('altum-offline-ok')) return;
  navigator.serviceWorker.ready.then(() => { LS.set('altum-offline-ok', '1'); pill('Saved on this device: the presentation now also works offline.', {}, 7000); });
}
window.__offline = {
  cacheTiles(urls) {
    if (!('caches' in window) || !navigator.onLine) return;
    const fresh = [...new Set(urls)].filter((u) => !queue.includes(u)); queue.push(...fresh); total += fresh.length;
    setTimeout(() => caches.open(EXT_CACHE).then(pump), 3000);   // after the scene has loaded
  },
};

// ---- install
if (!standalone && !LS.get('altum-install-hide')) {
  const hide = () => LS.set('altum-install-hide', '1');
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    const p = pill('Use this presentation offline: <button type="button" class="pwa-btn" data-a="i">Install app</button>', { '[data-a="i"]': () => e.prompt() });
    p.querySelector('.pwa-x').addEventListener('click', hide);
  });
  if (iOS && swOk) setTimeout(() => {
    const p = pill('To use offline on this iPad/iPhone: tap <b>Share</b> then <b>Add to Home Screen</b>.');
    p.querySelector('.pwa-x').addEventListener('click', hide);
  }, 4000);
}
