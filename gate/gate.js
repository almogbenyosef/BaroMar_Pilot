// Access gate. Everything confidential (texts, figures, 3D models, seabed and route data, the app code)
// ships only inside secure.bin, encrypted with AES-256-GCM. The key is derived from the access
// password with PBKDF2-SHA-256 (600 000 rounds), in the visitor's browser. Without the password
// the files in the repository cannot be read.
const ITER = 600000;
const KEY_STORE = 'altum-gate-key';
const enc = new TextEncoder();
const $ = (id) => document.getElementById(id);
const store = { get: () => { try { return localStorage.getItem(KEY_STORE); } catch { return null; } }, set: (v) => { try { localStorage.setItem(KEY_STORE, v); } catch { /* private mode */ } }, del: () => { try { localStorage.removeItem(KEY_STORE); } catch { /* ignore */ } } };
const b64 = { to: (u8) => btoa(String.fromCharCode(...u8)), from: (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) };

const packed = fetch('secure.bin', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('missing'); return r.arrayBuffer(); }).then((b) => new Uint8Array(b));

async function keyFromPassword(pw, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
}
async function unpack(key) {
  const buf = await packed; const iv = buf.subarray(16, 28);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, buf.subarray(28));   // throws on a wrong key
  const raw = new Uint8Array(await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  const hlen = new DataView(raw.buffer, raw.byteOffset).getUint32(0, true);
  const list = JSON.parse(new TextDecoder().decode(raw.subarray(4, 4 + hlen)));
  const files = {}; let off = 4 + hlen;
  for (const f of list) { files[f.path] = new Blob([raw.subarray(off, off + f.len)], { type: f.type }); off += f.len; }
  return files;
}

// serve the decrypted files to the app: fetch() and <img src> calls for these paths are answered from memory
function serve(files) {
  const urls = Object.fromEntries(Object.entries(files).map(([p, b]) => [p, URL.createObjectURL(b)]));
  const base = new URL('.', document.baseURI).pathname;
  const rel = (u) => { try { const U = new URL(u, document.baseURI); if (U.origin !== location.origin || !U.pathname.startsWith(base)) return null; return decodeURIComponent(U.pathname.slice(base.length)); } catch { return null; } };
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const k = rel(typeof input === 'string' ? input : input.url);
    if (k && files[k]) return Promise.resolve(new Response(files[k], { status: 200, headers: { 'Content-Type': files[k].type } }));
    return nativeFetch(input, init);
  };
  const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', { configurable: true, get() { return d.get.call(this); }, set(v) { const k = rel(v); d.set.call(this, k && urls[k] ? urls[k] : v); } });
  return urls;
}

async function start(files) {
  const urls = serve(files);
  $('gate').classList.add('open');
  setTimeout(() => $('gate').remove(), 600);
  await import(urls['app.js']);
}

async function tryStored() {
  const k = store.get(); if (!k) return false;
  let files;
  try { const key = await crypto.subtle.importKey('raw', b64.from(k), 'AES-GCM', true, ['decrypt']); files = await unpack(key); }
  catch { store.del(); return false; }
  await start(files); return true;
}

$('gate-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = $('gate-pw').value; if (!pw) return;
  const btn = $('gate-go'); btn.disabled = true; btn.textContent = 'Opening…'; $('gate-err').hidden = true;
  try {
    const salt = (await packed).subarray(0, 16);
    const key = await keyFromPassword(pw, salt);
    const files = await unpack(key);                       // throws on a wrong password
    if ($('gate-remember').checked) store.set(b64.to(new Uint8Array(await crypto.subtle.exportKey('raw', key))));
    await start(files);
  } catch (err) {
    $('gate-err').hidden = false; $('gate-err').textContent = String(err && err.message) === 'missing' ? 'The protected files are missing from this site.' : 'That password did not open the presentation.';
    btn.disabled = false; btn.textContent = 'Open'; $('gate-pw').select();
  }
});

// on-site QR: the link may carry the access key after "#k=" (never sent to the server); keep it on this
// device like "Remember", and take it out of the address bar
{ const m = location.hash.match(/(?:^#|&)k=([A-Za-z0-9_-]+)/);
  if (m) { store.set(m[1].replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - m[1].length % 4) % 4)); history.replaceState(null, '', location.pathname + location.search); } }
tryStored().then((ok) => { if (!ok) { $('gate').classList.add('ready'); $('gate-pw').focus(); } });
