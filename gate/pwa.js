// App mode: offline storage and install. Nothing pops up on screen: everything about it lives in the
// "i" (About) box (version, update and save for offline, install). Works on desktop (Chrome/Edge),
// Android (Chrome) and iPad/iPhone (Safari → Share → Add to Home Screen).
const EXT_CACHE = 'altum-ext-v1';
const LS = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);


// ---- service worker
const swOk = 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');
if (swOk) {
  // a new version installs in the background; if it arrives in the first seconds after opening, before the
  // visitor has done anything, the page quietly reloads into it (otherwise it is used from the next start)
  const hadController = !!navigator.serviceWorker.controller; let touched = false;
  ['pointerdown', 'keydown'].forEach((t) => addEventListener(t, () => { touched = true; }, { once: true, capture: true }));
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !touched && performance.now() < 25000) location.reload(); });
  navigator.serviceWorker.register('sw.js').then((r) => r.update().catch(() => {})).catch(() => {});
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
  navigator.serviceWorker.ready.then(() => { LS.set('altum-offline-ok', '1'); document.querySelectorAll('.offline-box .ov').forEach((o) => { if (/Not saved|Checking/.test(o.textContent)) o.textContent = 'Saved for offline use'; }); });
}
const ask = (sw, msg) => new Promise((res) => { const ch = new MessageChannel(); ch.port1.onmessage = (e) => res(e.data); sw.postMessage(msg, [ch.port2]); setTimeout(() => res(null), 60000); });
let allTiles = [];
window.__offline = {
  // "About" box: version of the saved copy, and a button to check for a new version / save everything again
  mount(el) {
    if (!el) return;
    if (!swOk) { el.innerHTML = '<p class="credits">Offline use is available once the site is opened from its web address.</p>'; return; }
    el.innerHTML = `<div class="offline-box"><div><b>Offline app</b><span class="ov">Checking…</span></div><button type="button" class="btn small" data-a="save">Update and save for offline</button></div>
      <div class="offline-box install-box" hidden><div><b>Install as an app</b><span class="iv"></span></div><button type="button" class="btn small" data-a="install">Install app</button></div>`;
    const ov = el.querySelector('.ov'), btn = el.querySelector('[data-a="save"]');
    const ib = el.querySelector('.install-box'), iv = ib.querySelector('.iv'), ibtn = ib.querySelector('button');
    if (!standalone) {
      if (installEvt) { ib.hidden = false; iv.textContent = 'Opens full screen and works without a connection'; }
      else if (iOS) { ib.hidden = false; iv.innerHTML = 'On iPad / iPhone: tap <b>Share</b>, then <b>Add to Home Screen</b>'; ibtn.hidden = true; }
      ibtn.addEventListener('click', async () => { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch { /* ignore */ } installEvt = null; ib.hidden = true; });
    }
    navigator.serviceWorker.ready.then((r) => ask(r.active, 'version')).then((v) => { ov.textContent = v ? `Saved version ${v.version}` : 'Not saved yet'; });
    btn.addEventListener('click', async () => {
      if (!navigator.onLine) { ov.textContent = 'Connect to the internet to update'; return; }
      btn.disabled = true; ov.textContent = 'Checking for a new version…';
      const reg = await navigator.serviceWorker.getRegistration(); if (!reg) { ov.textContent = 'Not available here'; btn.disabled = false; return; }
      await reg.update().catch(() => {});
      const nw = reg.installing || reg.waiting;
      if (nw) {   // a newer version: wait until it is saved and active, then restart into it
        ov.textContent = 'Downloading the new version…';
        await new Promise((res) => { if (nw.state === 'activated') res(); nw.addEventListener('statechange', () => nw.state === 'activated' && res()); });
        location.reload(); return;
      }
      ov.textContent = 'Saving everything again…';
      const r = await ask(reg.active, 'recache');
      try { const c = await caches.open(EXT_CACHE); await Promise.all(allTiles.map((u) => c.add(u).catch(() => {}))); } catch { /* ignore */ }
      ov.textContent = r && r.ok ? `Up to date and saved (version ${r.version})` : 'Could not save, try again'; btn.disabled = false;
    });
  },
  cacheTiles(urls) {
    allTiles.push(...urls);
    if (!('caches' in window) || !navigator.onLine) return;
    const fresh = [...new Set(urls)].filter((u) => !queue.includes(u)); queue.push(...fresh); total += fresh.length;
    setTimeout(() => caches.open(EXT_CACHE).then(pump), 3000);   // after the scene has loaded
  },
};

// ---- install: the browser's install offer is kept for the button in the About box (no pop-up)
let installEvt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; document.querySelectorAll('.install-box').forEach((b) => { b.hidden = false; b.querySelector('.iv').textContent = 'Opens full screen and works without a connection'; b.querySelector('button').hidden = false; }); });
