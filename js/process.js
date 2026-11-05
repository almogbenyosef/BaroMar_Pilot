// "How it works": an animated cross-section from the grid to the tanks, one view per operating mode.
import { PROCESS } from './content.js';

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
  t(452, 160, 'Sea level', { fill: '#2a6f8f', 'font-size': 18 });
  t(470, 452, '~6 km pipeline along the seabed', { fill: '#5b4f38', 'font-size': 19 });

  // grid pylon
  const gx = 26;
  el('path', { d: `M${gx} 180 L${gx + 14} 90 L${gx + 28} 180 M${gx + 3} 120 L${gx + 25} 120 M${gx + 6} 105 L${gx + 22} 105`, stroke: '#44606e', 'stroke-width': 2.5, fill: 'none' }, svg);
  t(gx - 4, 214, 'Grid');

  // station machines
  const comp = el('rect', { x: 96, y: 124, width: 76, height: 56, rx: 4, fill: '#1d2c44' }, svg);
  t(96, 214, 'Compressor');
  const tes = el('rect', { x: 204, y: 96, width: 50, height: 84, rx: 16, fill: '#c9967a' }, svg);
  t(190, 248, 'Heat store');
  const teg = el('rect', { x: 286, y: 134, width: 66, height: 46, rx: 4, fill: '#2f4f7a' }, svg);
  el('path', { d: 'M229 182 L229 228 M319 182 L319 256', stroke: '#8a9aa3', 'stroke-width': 1.5 }, svg);
  t(262, 278, 'Turbine-generator');
  // power line
  const power = el('path', { d: `M${gx + 14} 95 L${gx + 14} 70 L319 70 L319 134`, fill: 'none', stroke: '#e9973a', 'stroke-width': 3, 'stroke-dasharray': '6 8' }, svg);
  // heat links
  const heatA = el('path', { d: 'M172 150 L204 150', stroke: '#e9973a', 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' }, svg);
  const heatB = el('path', { d: 'M254 150 L286 150', stroke: '#e9973a', 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' }, svg);

  // pipeline path from station to tanks
  const pipeD = 'M352 176 L405 183 Q425 186 442 196 C580 258 740 326 808 352 L836 352';
  el('path', { d: pipeD, fill: 'none', stroke: '#16384a', 'stroke-width': 7, 'stroke-linecap': 'round' }, svg);
  const pipe = el('path', { d: pipeD, fill: 'none', stroke: '#6b8796', 'stroke-width': 3 }, svg);

  // tanks: three tubes on a slab
  el('rect', { x: 826, y: 382, width: 150, height: 12, fill: '#8f8b80' }, svg);
  const tubes = [];
  [838, 884, 930].forEach((x) => {
    const r = el('rect', { x, y: 270, width: 34, height: 112, rx: 3 }, cp);
    const gTube = el('g', { 'clip-path': 'url(#tankclip)' }, svg);
    const water = el('rect', { x, y: 270, width: 34, height: 112, fill: '#1f6e95' }, gTube);
    const air = el('rect', { x, y: 270, width: 34, height: 40, fill: '#ffffff' }, gTube);
    el('rect', { x, y: 270, width: 34, height: 112, rx: 3, fill: 'none', stroke: '#7b4f3e', 'stroke-width': 3 }, svg);
    tubes.push({ air, water, r, x });
  });
  el('path', { d: 'M836 352 L836 262 L964 262 L964 270 M855 262 L855 270 M901 262 L901 270 M947 262 L947 270', fill: 'none', stroke: '#c27a4e', 'stroke-width': 3 }, svg);
  t(818, 246, 'Storage tubes', { 'font-size': 19, fill: '#eef5f7' });
  t(826, 422, '100 m deep, ~11 bar', { 'font-size': 18, fill: '#eef5f7' });

  // moving things
  const dots = []; for (let i = 0; i < 14; i++) dots.push(el('circle', { r: 5, fill: '#fff', stroke: '#0c2a3a', 'stroke-width': 1 }, svg));
  const water = []; for (let i = 0; i < 8; i++) water.push(el('circle', { r: 3, fill: '#8fd3f0' }, svg));
  const pipeLen = pipe.getTotalLength();
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
      d.setAttribute('fill', dir > 0 ? '#ffffff' : '#bff3ea');
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
    power.setAttribute('stroke', mode === 'generate' ? '#3fc7b5' : '#e9973a');
    power.setAttribute('stroke-dashoffset', dir > 0 ? -k * 40 : dir < 0 ? k * 40 : 0);
    power.setAttribute('opacity', dir ? 1 : .25);
    heatA.setAttribute('opacity', mode === 'charge' ? .5 + .5 * Math.sin(k * 6) : .15);
    heatB.setAttribute('opacity', mode === 'generate' ? .5 + .5 * Math.sin(k * 6) : .15);
    comp.setAttribute('fill', mode === 'charge' ? '#e9973a' : '#1d2c44');
    teg.setAttribute('fill', mode === 'generate' ? '#3fc7b5' : '#2f4f7a');
    tes.setAttribute('fill', mode === 'hold' ? '#d9a283' : '#c9967a');
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
