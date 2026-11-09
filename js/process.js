// "How it works": an animated cross-section from the grid to the tanks, one view per operating mode.
import { PROCESS, DIAGRAM } from './content.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };

export function initProcessExplainer({ onRun }) {
  const modal = document.getElementById('how');
  const host = document.getElementById('how-svg');
  const textBox = document.getElementById('how-text');
  const tabs = [...modal.querySelectorAll('[role="tab"]')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const svg = el('svg', { viewBox: '0 0 1000 470', role: 'img', 'aria-label': 'Cross-section from the shore station to the underwater tanks' });
  const defs = el('defs', {}, svg);
  const lg = el('linearGradient', { id: 'gsea', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el('stop', { offset: 0, 'stop-color': '#2b8fbe' }, lg); el('stop', { offset: 1, 'stop-color': '#082f45' }, lg);
  const ls = el('linearGradient', { id: 'gsky', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el('stop', { offset: 0, 'stop-color': '#dceff7' }, ls); el('stop', { offset: 1, 'stop-color': '#f7f4ec' }, ls);
  const cp = el('clipPath', { id: 'tankclip' }, defs);

  el('rect', { x: 0, y: 0, width: 1000, height: 470, fill: 'url(#gsky)' }, svg);
  // sea and seabed
  el('path', { d: 'M380 170 L1000 170 L1000 470 L380 470 Z', fill: 'url(#gsea)' }, svg);
  el('path', { d: 'M0 180 L380 180 Q410 182 440 200 C580 262 740 330 1000 405 L1000 470 L0 470 Z', fill: '#d9cfba' }, svg);
  el('path', { d: 'M0 180 L380 180 Q410 182 440 200 C580 262 740 330 1000 405', fill: 'none', stroke: '#b9ab8d', 'stroke-width': 2 }, svg);
  el('line', { x1: 380, y1: 170, x2: 1000, y2: 170, stroke: '#cfeaf6', 'stroke-width': 2 }, svg);
  const t = (x, y, s, o = {}) => { const e = el('text', { x, y, 'font-family': 'Barlow, sans-serif', 'font-size': 21, 'font-weight': 500, fill: '#0c2a3a', ...o }, svg); e.textContent = s; return e; };
  t(452, 160, DIAGRAM.sea, { fill: '#2a6f8f', 'font-size': 18 });
  t(450, 452, DIAGRAM.pipe, { fill: '#5b4f38', 'font-size': 19 });

  // colour code used everywhere: yellow electricity, white air, red hot water, dark blue seawater, black pipe
  const C = { power: '#f2c230', air: '#ffffff', hot: '#d8452b', cool: '#e7b9a8', sea: '#0b3f8f', pipe: '#111820' };
  // grid pylon
  const gx = 18;
  el('path', { d: `M${gx} 180 L${gx + 14} 90 L${gx + 28} 180 M${gx + 3} 120 L${gx + 25} 120 M${gx + 6} 105 L${gx + 22} 105`, stroke: '#44606e', 'stroke-width': 2.5, fill: 'none' }, svg);
  t(gx - 6, 214, DIAGRAM.grid, { 'font-size': 18 });

  // underground air lines (drawn first so the machines sit on top)
  const line = (d, o = {}) => el('path', { d, fill: 'none', stroke: '#9aa6ad', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...o }, svg);
  const airC1 = line('M112 180 L112 194 L262 194 L262 180');            // compressor → heat exchanger (hot air)
  const airC2 = line('M282 180 L282 194 L356 194 L356 186');            // heat exchanger → pipeline (cooled air)
  const airG1 = line('M356 186 L356 206 L276 206 L276 180');            // pipeline → heat exchanger
  const airG2 = line('M268 180 L268 214 L190 214 L190 180');            // heat exchanger → turbine (reheated air)
  // water loop between heat exchanger and heat store
  const loopA = line('M286 150 L312 150', { stroke: '#c9a89c' });
  const loopB = line('M312 166 L286 166', { stroke: '#c9a89c' });

  // machines
  const comp = el('rect', { x: 82, y: 128, width: 60, height: 52, rx: 4, fill: '#1d2c44' }, svg);
  el('path', { d: 'M96 140 l12 10 l-12 10 M114 140 l12 10 l-12 10', stroke: '#9fb4c2', 'stroke-width': 2, fill: 'none' }, svg);
  const teg = el('rect', { x: 162, y: 134, width: 58, height: 46, rx: 4, fill: '#2f4f7a' }, svg);
  el('circle', { cx: 191, cy: 157, r: 12, stroke: '#9fb4c2', 'stroke-width': 2, fill: 'none' }, svg);
  const hx = el('rect', { x: 254, y: 138, width: 34, height: 42, rx: 3, fill: '#55626a' }, svg);
  el('path', { d: 'M260 146 h22 M260 154 h22 M260 162 h22 M260 170 h22', stroke: '#c7d0d5', 'stroke-width': 1.5 }, svg);
  // heat store: insulated tank with a red hot-water level
  el('clipPath', { id: 'tesclip' }, defs).appendChild(el('rect', { x: 312, y: 92, width: 44, height: 88, rx: 14 }));
  el('rect', { x: 312, y: 92, width: 44, height: 88, rx: 14, fill: '#e9e2d4' }, svg);
  const tesFill = el('rect', { x: 312, y: 92, width: 44, height: 88, fill: C.hot, 'clip-path': 'url(#tesclip)' }, svg);
  const tes = el('rect', { x: 312, y: 92, width: 44, height: 88, rx: 14, fill: 'none', stroke: '#8b6a5c', 'stroke-width': 3 }, svg);

  // labels with leaders
  const lead = (x, y1, y2) => el('path', { d: `M${x} ${y1} L${x} ${y2}`, stroke: '#8a9aa3', 'stroke-width': 1.2 }, svg);
  t(66, 244, DIAGRAM.compressor, { 'font-size': 19 }); lead(100, 196, 226);
  t(140, 270, DIAGRAM.teg, { 'font-size': 19 }); lead(176, 216, 252);
  t(226, 298, DIAGRAM.hx, { 'font-size': 19 }); lead(250, 216, 280);
  t(300, 326, DIAGRAM.store, { 'font-size': 19 }); lead(334, 182, 308);

  // power lines from the grid: one drops to the compressor, one to the turbine-generator
  const powerC = el('path', { d: `M${gx + 14} 95 L${gx + 14} 66 L112 66 L112 128`, fill: 'none', stroke: C.power, 'stroke-width': 3.5, 'stroke-dasharray': '7 7' }, svg);
  const powerG = el('path', { d: `M191 134 L191 56 L${gx + 14} 56 L${gx + 14} 95`, fill: 'none', stroke: C.power, 'stroke-width': 3.5, 'stroke-dasharray': '7 7' }, svg);
  el('path', { d: `M${gx + 14} 95 L${gx + 14} 56`, stroke: '#44606e', 'stroke-width': 2.5 }, svg);

  // pipeline path from station to tanks (black, like the real HDPE pipe)
  const pipeD = 'M356 186 L405 186 Q425 188 442 196 C580 258 740 326 808 352 L836 352';
  el('path', { d: pipeD, fill: 'none', stroke: C.pipe, 'stroke-width': 8, 'stroke-linecap': 'round' }, svg);
  const pipe = el('path', { d: pipeD, fill: 'none', stroke: C.pipe, 'stroke-width': 1 }, svg);
  const heatA = loopA, heatB = loopB, power = powerC;

  // tanks: three tubes on a slab
  el('rect', { x: 826, y: 382, width: 150, height: 12, fill: '#8f8b80' }, svg);
  const tubes = [];
  [838, 884, 930].forEach((x) => {
    const r = el('rect', { x, y: 270, width: 34, height: 112, rx: 3 }, cp);
    const gTube = el('g', { 'clip-path': 'url(#tankclip)' }, svg);
    const water = el('rect', { x, y: 270, width: 34, height: 112, fill: C.sea }, gTube);
    const air = el('rect', { x, y: 270, width: 34, height: 40, fill: '#ffffff' }, gTube);
    el('rect', { x, y: 270, width: 34, height: 112, rx: 3, fill: 'none', stroke: '#7b4f3e', 'stroke-width': 3 }, svg);
    tubes.push({ air, water, r, x });
  });
  el('path', { d: 'M836 352 L836 262 L964 262 L964 270 M855 262 L855 270 M901 262 L901 270 M947 262 L947 270', fill: 'none', stroke: '#c27a4e', 'stroke-width': 3 }, svg);
  t(818, 246, DIAGRAM.tubes, { 'font-size': 19, fill: '#eef5f7' });
  t(990, 422, DIAGRAM.depth, { 'font-size': 17, 'text-anchor': 'end', fill: '#eef5f7' });

  // moving things
  const mk = (n, attrs) => Array.from({ length: n }, () => el('circle', attrs, svg));
  const dots = mk(14, { r: 5, fill: C.air, stroke: '#0c2a3a', 'stroke-width': 1 });
  const water = mk(10, { r: 3.5, fill: C.sea, stroke: '#9fd6f0', 'stroke-width': .8 });
  const stationAir = mk(12, { r: 4, fill: C.air, stroke: '#0c2a3a', 'stroke-width': 1 });
  const hotWater = mk(6, { r: 3.5, fill: C.hot });
  const pipeLen = pipe.getTotalLength();
  const lens = new Map(); const L = (p) => { if (!lens.has(p)) lens.set(p, p.getTotalLength()); return lens.get(p); };
  const along = (path, f, d) => { const q = path.getPointAtLength(f * L(path)); d.setAttribute('cx', q.x); d.setAttribute('cy', q.y); };
  host.appendChild(svg);

  let mode = 'charge', soc = .3, last = 0, raf = 0, stepT = 0, step = 0;

  function renderText() {
    const p = PROCESS[mode];
    textBox.innerHTML = `<h3 style="margin:0;font-family:var(--font-c);font-size:24px">${p.title}</h3><p class="when">${p.when}</p><ol>${p.steps.map((s) => `<li>${s}</li>`).join('')}</ol>`;
    step = 0; stepT = 0; highlight();
  }
  function highlight() { textBox.querySelectorAll('li').forEach((li, i) => li.classList.toggle('on', i === step)); }

  function frame(ts) {
    const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
    stepT += dt; const n = PROCESS[mode].steps.length;
    if (stepT > 2.6) { stepT = 0; step = (step + 1) % n; highlight(); }
    const dir = mode === 'charge' ? 1 : mode === 'generate' ? -1 : 0;
    if (mode === 'charge') soc = Math.min(.95, soc + dt * .06); else if (mode === 'generate') soc = Math.max(.1, soc - dt * .06);
    if (soc >= .95 && mode === 'charge') soc = .25; if (soc <= .1 && mode === 'generate') soc = .9;
    const k = ts / 1000;
    dots.forEach((d, i) => {
      if (!dir) { d.setAttribute('visibility', 'hidden'); return; }
      d.setAttribute('visibility', 'visible');
      let f = ((k * .22 + i / dots.length) % 1); if (dir < 0) f = 1 - f;
      const p = pipe.getPointAtLength(f * pipeLen); d.setAttribute('cx', p.x); d.setAttribute('cy', p.y);
      
    });
    tubes.forEach((tb) => { const h = 112 * soc; tb.air.setAttribute('height', h); });
    water.forEach((w, i) => {
      if (!dir) { w.setAttribute('visibility', 'hidden'); return; }
      w.setAttribute('visibility', 'visible');
      const f = ((k * .5 + i / water.length) % 1); const tb = tubes[i % 3];
      const out = dir > 0 ? f : 1 - f;
      w.setAttribute('cx', tb.x + 17 + (i % 2 ? 1 : -1) * out * 22); w.setAttribute('cy', 384 - out * 4 + (i % 3));
      w.setAttribute('opacity', 1 - out * .8);
    });
    const ch = mode === 'charge', gen = mode === 'generate';
    // electricity: grid → compressor on charge, turbine-generator → grid on generate
    powerC.setAttribute('opacity', ch ? 1 : .18); powerC.setAttribute('stroke-dashoffset', ch ? -k * 40 : 0);
    powerG.setAttribute('opacity', gen ? 1 : .18); powerG.setAttribute('stroke-dashoffset', gen ? -k * 40 : 0);
    // active air lines
    [airC1, airC2].forEach((p) => p.setAttribute('stroke', ch ? '#e9eef1' : '#9aa6ad'));
    [airG1, airG2].forEach((p) => p.setAttribute('stroke', gen ? '#e9eef1' : '#9aa6ad'));
    const paths = ch ? [airC1, airC2] : gen ? [airG1, airG2] : [];
    stationAir.forEach((d, i) => {
      if (!paths.length) { d.setAttribute('visibility', 'hidden'); return; }
      d.setAttribute('visibility', 'visible');
      const f = (k * .35 + i / stationAir.length) % 1; const seg = f < .5 ? 0 : 1; along(paths[seg], (f % .5) * 2, d);
      // hot air leaving the compressor / reheated air into the turbine gets a red rim
      const hot = (ch && seg === 0) || (gen && seg === 1); d.setAttribute('stroke', hot ? C.hot : '#0c2a3a'); d.setAttribute('stroke-width', hot ? 2 : 1);
    });
    // hot water: heat exchanger → heat store on charge (store fills), store → exchanger on generate (store empties)
    const tesLevel = ch ? soc : gen ? soc : .9; const h = 88 * Math.max(.04, Math.min(1, tesLevel));
    tesFill.setAttribute('y', 180 - h); tesFill.setAttribute('height', h);
    hotWater.forEach((d, i) => {
      if (!ch && !gen) { d.setAttribute('visibility', 'hidden'); return; }
      d.setAttribute('visibility', 'visible');
      const f = (k * .5 + i / hotWater.length) % 1; along(ch ? loopA : loopB, ch ? f : f, d);
      d.setAttribute('fill', ch ? C.hot : C.hot);
    });
    loopA.setAttribute('stroke', ch ? C.hot : '#c9a89c'); loopB.setAttribute('stroke', gen ? C.hot : '#c9a89c');
    comp.setAttribute('fill', ch ? '#2c4a73' : '#1d2c44'); comp.setAttribute('stroke', ch ? C.power : 'none'); comp.setAttribute('stroke-width', 3);
    teg.setAttribute('fill', gen ? '#2c4a73' : '#2f4f7a'); teg.setAttribute('stroke', gen ? C.power : 'none'); teg.setAttribute('stroke-width', 3);
    if (!reduce) raf = requestAnimationFrame(frame);
  }

  function setMode(m) {
    mode = m; tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.step === m)));
    soc = m === 'generate' ? .9 : m === 'hold' ? .85 : .25; renderText();
    if (reduce) frame(1000);
  }
  tabs.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.step)));
  document.getElementById('how-run').addEventListener('click', () => { close(); onRun(mode); });

  function open(m = 'charge') { modal.hidden = false; setMode(m); cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(frame); modal.querySelector('[role="tab"][aria-selected="true"]').focus(); }
  function close() { modal.hidden = true; cancelAnimationFrame(raf); }
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });
  return { open, close };
}
