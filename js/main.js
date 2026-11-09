import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PARTS, STATION_PARTS, KEY_FIGURES, ABOUT, SITE, UI } from './content.js';
import { buildStation, glow } from './station.js';
import { buildTankStructure } from './tank.js';
import { initProcessExplainer } from './process.js';
import { initMap } from './map.js';

// ---------------------------------------------------------------- settings
const VE = 3;                     // vertical exaggeration below sea level
const VE_LAND = 1;                // land is shown at its true height (EU-DEM 25 m)
const vy = (h) => h * (h < 0 ? VE : VE_LAND);                     // vertical exaggeration of the terrain
const PIPE_R = .125;              // HDPE SDR9 OD 250 mm; widened with distance so the route stays visible
const PIPE_LIFT = .45;            // pipe centre above the seabed (sits in the saddle of the concrete weights)
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 820px)').matches;
const qs = new URLSearchParams(location.search);
const state = { part: null, mode: null, soc: .4, tankLayout: qs.get('tanks') === '3' ? 'three' : 'single', survey: false, cycle: null };

const loaderFill = document.getElementById('loader-fill');
const loaderText = document.getElementById('loader-text');
const progress = (p, t) => { loaderFill.style.width = `${p}%`; if (t) loaderText.textContent = t; };

// ---------------------------------------------------------------- renderer, scene, camera
const host = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: !MOBILE, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.25 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
host.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight);
document.getElementById('labels').appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, .3, 80000);
camera.position.set(1500, 3600, 9800);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = .08;
controls.maxDistance = 22000; controls.minDistance = 4;
controls.maxPolarAngle = Math.PI * .495;
controls.target.set(1400, -150, 2400);
controls.zoomToCursor = true;

const hemi = new THREE.HemisphereLight(0xdff1ff, 0x5d5446, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.2); sun.position.set(-3000, 6000, 2500); scene.add(sun);
const SUN_DIR = sun.position.clone().normalize();

// sky dome
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { uUnder: { value: 0 } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `varying vec3 vP; uniform float uUnder;
    void main(){ float h = vP.y; vec3 top = vec3(.36,.62,.82), hor = vec3(.86,.92,.93), low = vec3(.10,.33,.45);
      vec3 c = h > 0. ? mix(hor, top, pow(clamp(h,0.,1.), .55)) : mix(hor, low, clamp(-h*4.,0.,1.));
      vec3 u = mix(vec3(.04,.26,.38), vec3(.01,.08,.13), clamp(-h*1.4+.4,0.,1.));
      gl_FragColor = vec4(mix(c, u, uUnder), 1.); }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(60000, 32, 16), skyMat); scene.add(sky);

// ---------------------------------------------------------------- load data
progress(10, UI.load[0]);
const geo = await fetch('data/geo.json').then((r) => r.json());
const G = geo.grid;
const H = new Int16Array(await fetch('data/terrain.bin').then((r) => r.arrayBuffer()));
progress(35, UI.load[1]);

function heightAt(x, z) {
  const fx = (x - G.x0) / G.res, fz = (z - G.y0) / G.res;
  const i = Math.max(0, Math.min(G.nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(G.ny - 2, Math.floor(fz)));
  const u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fz - j));
  const h = (a, b) => H[b * G.nx + a] / 10;
  return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
}
const yAt = (x, z) => vy(heightAt(x, z));
const toLL = (x, z) => [G.lat0 - z / G.ky, G.lon0 + x / G.kx];
const fromLL = (lon, lat) => [(lon - G.lon0) * G.kx, -(lat - G.lat0) * G.ky];

// ---------------------------------------------------------------- satellite imagery for the land (Esri World Imagery)
// Two layers: a sharp one (zoom 16) around the station and landfall, a coarse one (zoom 14) for the wider coast.
const tileX = (lon, z) => (lon + 180) / 360 * 2 ** z;
const tileY = (lat, z) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z; };
function satLayer(z, lonW, lonE, latN, latS) {
  const X0 = Math.floor(tileX(lonW, z)), X1 = Math.floor(tileX(lonE, z)), Y0 = Math.floor(tileY(latN, z)), Y1 = Math.floor(tileY(latS, z));
  return { z, X0, X1, Y0, Y1, uv: (lat, lon) => [(tileX(lon, z) - X0) / (X1 - X0 + 1), 1 - (tileY(lat, z) - Y0) / (Y1 - Y0 + 1)], tex: { value: null } };
}
const [gN] = toLL(0, G.y0); const [, gW] = toLL(G.x0, 0); const [, gE] = toLL(G.x0 + (G.nx - 1) * G.res, 0);
const SAT_HI = satLayer(16, toLL(-2400, 0)[1], toLL(3600, 0)[1], toLL(0, -1500)[0], 34.7005);
const SAT_LO = satLayer(14, gW, gE, gN, 34.698);
async function loadSat(L, flag) {
  const nx = L.X1 - L.X0 + 1, ny = L.Y1 - L.Y0 + 1;
  const c = document.createElement('canvas'); c.width = nx * 256; c.height = ny * 256;
  const ctx = c.getContext('2d'); const jobs = [];
  for (let x = L.X0; x <= L.X1; x++) for (let y = L.Y0; y <= L.Y1; y++) {
    jobs.push(new Promise((res) => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => { ctx.drawImage(im, (x - L.X0) * 256, (y - L.Y0) * 256); res(true); };
      im.onerror = () => res(false);
      im.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${L.z}/${y}/${x}`;
    }));
  }
  const ok = (await Promise.all(jobs)).filter(Boolean).length;
  if (!ok) return;
  try { ctx.getImageData(0, 0, 1, 1); } catch { return; }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  L.tex.value = t; terrainMat.uniforms[flag].value = 1;
}
setTimeout(() => { loadSat(SAT_LO, 'uHasLo'); loadSat(SAT_HI, 'uHasHi'); }, 0);

// ---------------------------------------------------------------- terrain mesh
const terrainGeo = new THREE.BufferGeometry();
{
  const n = G.nx * G.ny, pos = new Float32Array(n * 3), sat = new Float32Array(n * 2), sat2 = new Float32Array(n * 2), hm = new Float32Array(n);
  for (let j = 0; j < G.ny; j++) for (let i = 0; i < G.nx; i++) {
    const k = j * G.nx + i, x = G.x0 + i * G.res, z = G.y0 + j * G.res, h = H[k] / 10;
    pos[k * 3] = x; pos[k * 3 + 1] = vy(h); pos[k * 3 + 2] = z; hm[k] = h;
    const [lat, lon] = toLL(x, z);
    const a = SAT_HI.uv(lat, lon), b = SAT_LO.uv(lat, lon);
    sat[k * 2] = a[0]; sat[k * 2 + 1] = a[1]; sat2[k * 2] = b[0]; sat2[k * 2 + 1] = b[1];
  }
  const idx = new Uint32Array((G.nx - 1) * (G.ny - 1) * 6); let p = 0;
  for (let j = 0; j < G.ny - 1; j++) for (let i = 0; i < G.nx - 1; i++) {
    const a = j * G.nx + i, b = a + 1, c = a + G.nx, d = c + 1;
    idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d;
  }
  terrainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  terrainGeo.setAttribute('satUv', new THREE.BufferAttribute(sat, 2));
  terrainGeo.setAttribute('satUv2', new THREE.BufferAttribute(sat2, 2));
  terrainGeo.setAttribute('hm', new THREE.BufferAttribute(hm, 1));
  terrainGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  terrainGeo.computeVertexNormals();
}
const mb = geo.mbes; const [mbW, mbN] = fromLL(mb.w, mb.n); const [mbE, mbS] = fromLL(mb.e, mb.s);
let surveyLoaded = false;
function loadSurvey() { if (surveyLoaded) return; surveyLoaded = true; const t = new THREE.TextureLoader().load('assets/img/mbes.png'); t.colorSpace = THREE.SRGBColorSpace; terrainMat.uniforms.uSurvey.value = t; }
const terrainMat = new THREE.ShaderMaterial({
  uniforms: {
    uSat: SAT_HI.tex, uSat2: SAT_LO.tex, uHasHi: { value: 0 }, uHasLo: { value: 0 }, uSurvey: { value: null }, uSurveyOn: { value: 0 },
    uBox: { value: new THREE.Vector4(mbW, mbE, mbN, mbS) }, uSun: { value: SUN_DIR }, uTime: { value: 0 },
    uFogColor: { value: new THREE.Color(0xcfe3ea) }, uFogDensity: { value: .00004 }, uUnder: { value: 0 },
    uDom: { value: new THREE.Vector4(G.x0, G.x0 + (G.nx - 1) * G.res, G.y0, G.y0 + (G.ny - 1) * G.res) },
  },
  vertexShader: `attribute vec2 satUv; attribute vec2 satUv2; attribute float hm; varying vec2 vSat; varying vec2 vSat2; varying float vH; varying vec3 vN; varying vec3 vW; varying float vDist;
    void main(){ vSat = satUv; vSat2 = satUv2; vH = hm; vN = normal; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; vec4 mv = viewMatrix*w; vDist = -mv.z; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `uniform sampler2D uSat, uSat2, uSurvey; uniform float uHasHi, uHasLo, uSurveyOn, uTime, uFogDensity, uUnder; uniform vec4 uBox, uDom; uniform vec3 uSun, uFogColor;
    varying vec2 vSat; varying vec2 vSat2; varying float vH; varying vec3 vN; varying vec3 vW; varying float vDist;
    float caus(vec2 p){ p *= .045; float t = uTime*.6; float a = sin(p.x*3.1+t)+sin(p.y*2.7-t*1.1)+sin((p.x+p.y)*2.3+t*.7); return pow(max(0.,a/3.),3.); }
    void main(){
      vec3 n = normalize(vN); float lam = clamp(dot(n, uSun), 0., 1.);
      vec3 c;
      if (vH > .25) {
        vec3 lime = mix(vec3(.80,.76,.66), vec3(.62,.60,.47), smoothstep(2.,20.,vH));
        c = lime;
        if (uHasLo > .5) c = texture2D(uSat2, vSat2).rgb;
        bool inHi = vSat.x > 0. && vSat.x < 1. && vSat.y > 0. && vSat.y < 1.;
        if (uHasHi > .5 && inHi) { float e = min(min(vSat.x, 1.-vSat.x), min(vSat.y, 1.-vSat.y)); c = mix(c, texture2D(uSat, vSat).rgb, smoothstep(0., .04, e)); }
        c *= .55 + .55*lam;
      } else {
        float d = -vH;
        vec3 sand = vec3(.80,.73,.57), mid = vec3(.48,.56,.52), deep = vec3(.22,.33,.38);
        c = mix(sand, mid, smoothstep(0.,45.,d)); c = mix(c, deep, smoothstep(45.,110.,d));
        c *= .45 + .65*lam;
        float gr = fract(sin(dot(floor(vW.xz*1.5), vec2(12.9898,78.233)))*43758.5453);
        c *= mix(1., .94 + .1*gr, 1.-smoothstep(30., 160., vDist));
        c += vec3(.55,.75,.8)*caus(vW.xz)*(1.-smoothstep(0.,30.,d))*.35;
        // isobaths: 2 m (only close up), 10 m, and 50 m lines, drawn in screen pixels so they stay crisp
        float w = fwidth(d);
        float d2 = abs(fract(d/2.+.5)-.5)*2./w, d10 = abs(fract(d/10.+.5)-.5)*10./w, d50 = abs(fract(d/50.+.5)-.5)*50./w;
        float shore = smoothstep(1.,3.,d), under = 1.-uUnder*.9;
        float minor = (1.-smoothstep(.4, 1.2, d2)) * (1.-smoothstep(.05, .25, w)) * .28;
        float l10 = (1.-smoothstep(.7, 1.6, d10)) * (1.-smoothstep(1.5, 4., w)) * .8;
        float l50 = 1.-smoothstep(1.2, 2.4, d50);
        c = mix(c, vec3(.04,.16,.24), minor*shore*under);
        c = mix(c, vec3(.03,.14,.22), l10*shore*under);
        c = mix(c, vec3(.96,.98,1.), l50*.9*shore*under);
        vec2 uv = vec2((vW.x-uBox.x)/(uBox.y-uBox.x), 1.-(vW.z-uBox.z)/(uBox.w-uBox.z));
        if (uSurveyOn > .5 && uv.x>0. && uv.x<1. && uv.y>0. && uv.y<1.) { vec4 s = texture2D(uSurvey, uv); c = mix(c, s.rgb*(.65+.45*lam), s.a*.9); }
      }
      float f = 1. - exp(-pow(vDist*uFogDensity, 1.6));
      float edge = min(min(vW.x-uDom.x, uDom.y-vW.x), min(vW.z-uDom.z, uDom.w-vW.z));
      if (vH > .25 && uUnder < .5) c = mix(c, vec3(.80,.79,.74), 1.-smoothstep(0., 1600., edge));
      gl_FragColor = vec4(mix(c, uFogColor, clamp(f,0.,1.)), 1.);
      #include <colorspace_fragment>
    }`,
  extensions: { derivatives: true },
});
const terrain = new THREE.Mesh(terrainGeo, terrainMat); terrain.name = 'terrain'; scene.add(terrain);
// hazy land beyond the modelled area, so the coast does not end abruptly
{
  const haze = new THREE.MeshBasicMaterial({ color: 0xccc9bd });
  const X0 = G.x0, X1 = G.x0 + (G.nx - 1) * G.res, Z0 = G.y0;
  const coastZ = (x) => { let best = null, bd = 1e9; for (const [cx, cz] of geo.coast) { const d = Math.abs(cx - x); if (d < bd) { bd = d; best = cz; } } return best; };
  const plane = (x0, x1, z0, z1, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), haze); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); scene.add(m); };
  plane(-60000, 60000, -60000, Z0 + 2, 6);
  plane(-60000, X0 + 2, Z0, coastZ(X0) - 40, 4);
  plane(X1 - 2, 60000, Z0, coastZ(X1) - 40, 4);
}
progress(55, UI.load[3]);

// ---------------------------------------------------------------- sea surface
const seaMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  uniforms: { uTime: { value: 0 }, uCam: { value: camera.position }, uUnder: { value: 0 }, uSun: { value: SUN_DIR }, uDom: { value: new THREE.Vector4(G.x0, G.x0 + (G.nx - 1) * G.res, G.y0, G.y0 + (G.ny - 1) * G.res) } },
  vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
  fragmentShader: `uniform float uTime, uUnder; uniform vec3 uCam, uSun; uniform vec4 uDom; varying vec3 vW;
    float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x), mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x), f.y); }
    void main(){
      vec2 p = vW.xz*.02; float t = uTime*.25;
      float nx = noise(p+vec2(t,0.))-noise(p+vec2(t+.15,0.)); float nz = noise(p*1.3+vec2(0.,t))-noise(p*1.3+vec2(0.,t+.15));
      vec3 n = normalize(vec3(nx*1.6, 1., nz*1.6));
      vec3 v = normalize(uCam - vW); float fr = pow(1.-max(dot(n, v*sign(v.y+1e-4)),0.), 3.);
      vec3 water = vec3(.03,.29,.43), skyc = vec3(.72,.85,.91);
      vec3 c = mix(water, skyc, fr*.55);
      float sp = pow(max(dot(reflect(-uSun, n), v),0.), 180.); c += sp*.9;
      float dist = length(uCam.xz - vW.xz);
      float edge = min(min(vW.x-uDom.x, uDom.y-vW.x), min(vW.z-uDom.z, uDom.w-vW.z));
      float a = mix(.38, .88, fr);
      a = mix(a, 1., 1.-smoothstep(150., 1600., edge));
      c = mix(c, vec3(.70,.82,.87), smoothstep(9000., 30000., dist));
      if (uUnder > .5) { c = mix(vec3(.55,.8,.9), vec3(.12,.42,.56), .5); a = .55; }
      gl_FragColor = vec4(c, a);
      #include <colorspace_fragment>
    }`,
});
const sea = new THREE.Mesh(new THREE.PlaneGeometry(80000, 80000, 1, 1), seaMat);
sea.rotation.x = -Math.PI / 2; sea.renderOrder = 2; scene.add(sea);

// ---------------------------------------------------------------- shore station
progress(40, UI.load[2]);
const stationMeta = await fetch('data/station.json').then((r) => r.json());
const station = await buildStation(SITE.stationModel || 'assets/models/shore_station.glb', stationMeta);
const stationXY = geo.station.xy;
// turn the pad so the air line leaves it towards the landfall
// placed on the pad outline (BLD) of the PROTEAS site plan; the pad's north end points along it
const STATION_ROT = geo.station.rot;
const padTop = (() => {
  const [W, D] = stationMeta.pad; let m = -1e9; const c = Math.cos(STATION_ROT), sn = Math.sin(STATION_ROT);
  for (const [dx, dz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2], [0, 0], [-W / 2, 0], [W / 2, 0]]) m = Math.max(m, yAt(stationXY[0] + dx * c + dz * sn, stationXY[1] - dx * sn + dz * c));
  return m;
})();
station.group.position.set(stationXY[0], padTop + .25, stationXY[1]);
station.group.rotation.y = STATION_ROT;
scene.add(station.group);
station.group.updateMatrixWorld(true);
state.realStation = true;
const stationWorld = (v) => station.group.localToWorld(v.clone());

// power cables between the grid connection, the electrical room, the compressor and the turbine (drawn on the pad)
const ELEC = {
  toCompressor: [[-4.84, .12, 13.08], [-4.84, .12, 11.0], [-4.2, .12, 11.0], [-4.2, .12, 6.4], [1.3, .12, 6.4], [1.3, .12, 5.7]],
  fromTeg: [[3.1, .12, -1.5], [4.7, .12, -1.5], [4.7, .12, 6.4], [-4.2, .12, 6.4], [-4.2, .12, 11.0], [-4.84, .12, 11.0], [-4.84, .12, 13.08]],
};
{
  const cm = new THREE.MeshStandardMaterial({ color: 0xe3b62a, roughness: .6 });
  const seg = (a, b) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const L = A.distanceTo(B); const m = new THREE.Mesh(new THREE.BoxGeometry(.14, .07, L + .14), cm); m.position.copy(A).lerp(B, .5); m.lookAt(B); m.userData.part = 'station:electrical'; station.group.add(m); };
  [ELEC.toCompressor, ELEC.fromTeg.slice(0, 3)].forEach((pts) => pts.slice(1).forEach((p, i) => seg(pts[i], p)));
}
// what moves through the station in each mode, along the model's own pipe runs
const FLOW_STYLE = { air: [0xffffff, .14, 1.6], hot: [0xff4a2a, .09, 1.1], cool: [0x6fc0ff, .09, 1.1], elec: [0xffd23f, .1, 4] };
const stFlows = [];
function stationFlow(pts, type, mode, parent = station.group) {
  const path = new THREE.CurvePath(); const P = pts.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(...p)));
  for (let i = 1; i < P.length; i++) if (P[i].distanceToSquared(P[i - 1]) > 1e-4) path.add(new THREE.LineCurve3(P[i - 1], P[i]));
  const len = path.getLength(); const [col, r, speed] = FLOW_STYLE[type]; const n = Math.max(4, Math.round(len / (type === 'elec' ? 1.6 : 1.1)));
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 10, 6), new THREE.MeshBasicMaterial({ color: col }), n);
  mesh.visible = false; mesh.frustumCulled = false; parent.add(mesh);
  if (parent !== station.group) { mesh.material.depthTest = false; mesh.renderOrder = 7; }   // buried cable: show through the ground
  stFlows.push({ path, len, type, mode, mesh, n, speed, t: 0 });
}
const F = station.flows;
stationFlow(F.airCharge, 'air', 'charge'); stationFlow(F.hotCharge, 'hot', 'charge'); stationFlow(F.coolCharge, 'cool', 'charge'); stationFlow(ELEC.toCompressor, 'elec', 'charge');
stationFlow(F.airGen, 'air', 'generate'); stationFlow(F.hotGen1, 'hot', 'generate'); stationFlow(F.hotGen2, 'hot', 'generate'); stationFlow(F.coolGen, 'cool', 'generate'); stationFlow(ELEC.fromTeg, 'elec', 'generate');
const sfM = new THREE.Matrix4(), sfP = new THREE.Vector3();
function updateStationFlows(dt, near) {
  // beads grow a little with distance so the flow still reads from the station overview
  const sc = THREE.MathUtils.clamp(camera.position.distanceTo(station.group.position) / 45, 1, 2.2);
  stFlows.forEach((f) => {
    const on = near && state.mode === f.mode && stExplode.k === 0; f.mesh.visible = on; if (!on) return;
    f.t = (f.t + dt * f.speed / f.len) % 1;
    for (let i = 0; i < f.n; i++) { f.path.getPointAt((f.t + i / f.n) % 1, sfP); sfM.makeScale(sc, sc, sc).setPosition(sfP); f.mesh.setMatrixAt(i, sfM); }
    f.mesh.instanceMatrix.needsUpdate = true;
  });
}
// exploded view of the station: each pipe system and the steel structure lift to their own level
const stExplode = { k: 0, target: 0 };


// ---------------------------------------------------------------- pipeline
const route = geo.route; // [x, z] in metres, landfall → manifold
function sampled(points, step = 12, lift = PIPE_R * .9) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i], [bx, bz] = points[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 0; k < n; k++) { const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; out.push(new THREE.Vector3(x, yAt(x, z) + lift, z)); }
  }
  const [lx, lz] = points[points.length - 1]; out.push(new THREE.Vector3(lx, yAt(lx, lz) + lift, lz));
  return out;
}
const exitW = stationWorld(station.exit);
// onshore pipe, buried about 1.2 m deep along the surveyed route (NEW LINE PIPE250, PROTEAS site plan),
// from the station down to the transition chamber on the shore, where the subsea pipe starts
const BURY = 1.2;
const onshoreRoute = geo.onshore.route.slice(0, -1).reverse();     // station end first; last surveyed point sits inside the pad
// from the end flange the pipe runs out level, then bends down into the ground
const flangeOut = stationWorld(station.exit.clone().add(new THREE.Vector3(-1.2, 0, 0)));
const onshorePts = [exitW.clone(), flangeOut, flangeOut.clone().add(stationWorld(new THREE.Vector3(-2.2, 0, 0)).sub(station.group.position)).setY(yAt(flangeOut.x, flangeOut.z) - BURY)];
onshoreRoute.forEach(([x, z], i, arr) => {
  const prev = i ? arr[i - 1] : [exitW.x, exitW.z]; const n = Math.max(1, Math.ceil(Math.hypot(x - prev[0], z - prev[1]) / 3));
  for (let k = 1; k <= n; k++) { const t = k / n, px = prev[0] + (x - prev[0]) * t, pz = prev[1] + (z - prev[1]) * t; onshorePts.push(new THREE.Vector3(px, yAt(px, pz) - BURY, pz)); }
});
// transition chamber on the shore (site plan 'NEW MH'): the onshore and the subsea pipe meet in it, in one
// straight run through a controlled valve, so the line passes through without a step
const chamberPoly = geo.onshore.chamber;
const chamberPos = (() => { const x = chamberPoly.reduce((a, p) => a + p[0], 0) / 4, z = chamberPoly.reduce((a, p) => a + p[1], 0) / 4; return new THREE.Vector3(x, yAt(x, z), z); })();
const chamberC = chamberPos.clone().setY(chamberPos.y - .55);              // pipe axis inside the chamber
const chamberDir = (() => {                                                  // direction of the run through the chamber
  const a = onshorePts[onshorePts.length - 1], b = new THREE.Vector3(route[1][0], 0, route[1][1]);
  return b.sub(a).setY(0).normalize();
})();
// the run leaves the chamber straight, then rises to the surface where the subsea pipe begins
const chamberOut = chamberC.clone().addScaledVector(chamberDir, 1.4);
const chamberRise = (() => { const p = chamberC.clone().addScaledVector(chamberDir, 4); p.y = yAt(p.x, p.z) + PIPE_LIFT; return p; })();
{
  // approach: drop out of the ground line to the chamber floor and line up with the run
  const last = onshorePts[onshorePts.length - 1]; const inA = chamberC.clone().addScaledVector(chamberDir, -1.4);
  const mid = last.clone().lerp(inA, .5); mid.y = Math.min(yAt(mid.x, mid.z) - BURY, (last.y + inA.y) / 2);
  onshorePts.push(mid, inA, chamberC.clone(), chamberOut.clone(), chamberRise.clone());
}
const subseaPts = [chamberC.clone(), chamberOut.clone(), chamberRise.clone(), ...sampled(route, 12, PIPE_LIFT).filter((p) => p.clone().sub(chamberC).setY(0).dot(chamberDir) > 5.5)];   // only points ahead of the chamber
const allPts = [...onshorePts, ...subseaPts.slice(3)];
const pathCurve = new THREE.CatmullRomCurve3(allPts, false, 'centripetal', .1);
const pathLen = pathCurve.getLength();

// colour code: black pipe, white air, dark blue seawater, red hot water, yellow electricity
const pipeMat = new THREE.MeshStandardMaterial({ color: 0x15191c, roughness: .55, metalness: .15, emissive: 0x000000 });
// widen the pipe with distance so the route stays readable from far away
const widen = { value: 0 };
const flowU = { uFlowOn: { value: 0 }, uFlowPhase: { value: 0 }, uFlowLevel: { value: 0 }, uFlowColor: { value: new THREE.Color(0xffffff) } };
function flowShader(mat, length, widenIt, offset = 0) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, flowU, { uWiden: widen, uLen: { value: length }, uOff: { value: offset } });
    sh.vertexShader = 'uniform float uWiden;\nvarying float vS;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vS = uv.x;' + (widenIt ? '\n transformed += normal * uWiden;' : ''));
    sh.fragmentShader = 'uniform float uFlowOn, uFlowPhase, uFlowLevel, uLen, uOff;\nuniform vec3 uFlowColor;\nvarying float vS;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      if (uFlowOn != 0.0) {
        // two pulse trains a factor 4 apart, cross-faded with the zoom level, so the spacing always reads well
        float lv = floor(uFlowLevel), fr = uFlowLevel - lv;
        float spA = 6.0 * pow(4.0, lv), spB = spA * 4.0, s = uOff + vS * uLen;
        float a = fract(s / spA - uFlowOn * uFlowPhase), b = fract(s / spB - uFlowOn * uFlowPhase);
        if (uFlowOn < 0.0) { a = 1.0 - a; b = 1.0 - b; }
        float pa = pow(a, 5.0) * smoothstep(1.0, .93, a), pb = pow(b, 5.0) * smoothstep(1.0, .93, b);
        float pulse = mix(pa, pb, fr);
        totalEmissiveRadiance = mix(totalEmissiveRadiance * .55, uFlowColor * 2.2, pulse);
      }`);
  };
}

// buried: drawn as a ghost through the ground, like the subsea pipe through the water
const onshoreMat = new THREE.MeshStandardMaterial({ color: 0x15191c, roughness: .8, emissive: 0x000000, transparent: true, opacity: .7, depthTest: false, depthWrite: false });
const subseaCurve = new THREE.CatmullRomCurve3(subseaPts.slice(2), false, 'centripetal', .1);   // starts at the end of the run through the chamber
const pipe = new THREE.Mesh(new THREE.TubeGeometry(subseaCurve, Math.min(4000, subseaPts.length * 2), PIPE_R, 10, false), pipeMat);
pipe.userData.part = 'pipeline'; scene.add(pipe);

const onshoreCurve = new THREE.CatmullRomCurve3(onshorePts, false, 'centripetal', .2);
const trench = new THREE.Mesh(new THREE.TubeGeometry(onshoreCurve, onshorePts.length * 3, PIPE_R, 10, false), onshoreMat);   // same size as the subsea pipe
trench.userData.part = 'landfall'; trench.renderOrder = 6; scene.add(trench);
// a faint line on the ground marks the buried route
{
  const pts = onshorePts.slice(2).map((p) => new THREE.Vector3(p.x, yAt(p.x, p.z) + .08, p.z));
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0x6b5a3e, dashSize: 2, gapSize: 1.4, transparent: true, opacity: .8 }));
  l.computeLineDistances(); scene.add(l);
}
flowShader(onshoreMat, onshoreCurve.getLength(), true);
flowShader(pipeMat, subseaCurve.getLength(), true, onshoreCurve.getLength());

// the chamber itself: square precast box set into the sand, lid with lifting hooks (site photos);
// lid and walls are see-through so the valve on the run can be seen
{
  const g = new THREE.Group(); const conc = new THREE.MeshStandardMaterial({ color: 0xc4c0b6, roughness: .95, transparent: true, opacity: .55, depthWrite: false });
  const [p0, p1] = chamberPoly; const side = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); const yaw = -Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
  const H = 1.6, top = .3, t = .2;
  [[side, t, 0, side / 2 - t / 2], [side, t, 0, -side / 2 + t / 2], [t, side, side / 2 - t / 2, 0], [t, side, -side / 2 + t / 2, 0]].forEach(([w, d, x, z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), conc); m.position.set(x, top - H / 2, z); g.add(m);
  });
  const lid = new THREE.Mesh(new THREE.BoxGeometry(side + .1, .22, side + .1), conc); lid.position.y = top + .11; g.add(lid);
  const hook = new THREE.TorusGeometry(.07, .015, 6, 12, Math.PI); const steel = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
  [[-.8, -.8], [.8, -.8], [.8, .8], [-.8, .8]].forEach(([x, z]) => { const h = new THREE.Mesh(hook, steel); h.position.set(x * side / 2.4, top + .22, z * side / 2.4); g.add(h); });
  // a low sand bank half covers the box
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(side * .62, side * .95, .22, 24), new THREE.MeshStandardMaterial({ color: 0xd8ccb0, roughness: 1, transparent: true, opacity: .8, depthWrite: false })); sand.position.y = .02; g.add(sand);
  g.position.copy(chamberPos); g.rotation.y = yaw; g.traverse((m) => { if (m.isMesh) m.userData.part = 'landfall'; }); scene.add(g);
  // controlled valve on the run: flanged body, stem and actuator
  const v = new THREE.Group(); const body = new THREE.MeshStandardMaterial({ color: 0x3b4650, metalness: .6, roughness: .35 });
  const act = new THREE.MeshStandardMaterial({ color: 0x2c4a73, metalness: .4, roughness: .4 });
  const cyl = (r, l, m) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 20), m); c.rotation.z = Math.PI / 2; return c; };
  v.add(cyl(.2, .55, body)); [-.3, .3].forEach((x) => { const f = cyl(.27, .06, body); f.position.x = x; v.add(f); });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .35, 8), body); stem.position.y = .35; v.add(stem);
  const a1 = new THREE.Mesh(new THREE.BoxGeometry(.38, .26, .3), act); a1.position.y = .62; v.add(a1);
  const ind = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .05, 12), new THREE.MeshStandardMaterial({ color: 0xf2c230, emissive: 0x5a4300 })); ind.position.y = .78; v.add(ind);
  v.position.copy(chamberC); v.rotation.y = -Math.atan2(chamberDir.z, chamberDir.x);
  // the chamber sits below ground level: draw the valve and the pipe run through it as see-through, like the buried pipe
  v.traverse((m) => { if (m.isMesh) { m.userData.part = 'landfall'; m.material = m.material.clone(); m.material.depthTest = false; m.material.transparent = true; m.material.opacity = .92; m.renderOrder = 8; } });
  scene.add(v);

}

// EAC substation (site plan: 'SdeLtmEStationGM') and the buried supply cable to the electrical room, along the route of
// the electrical design (051 EX01) to the cable manhole under the slab (BaroMar Points 3)
const subC = geo.substation.gm.reduce((a, [x, z]) => a.add(new THREE.Vector3(x / 4, 0, z / 4)), new THREE.Vector3()); subC.y = yAt(subC.x, subC.z);
{
  const g = new THREE.Group();
  const prism = (poly, h, mat, y0 = 0) => {
    const sh = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x - subC.x, -(z - subC.z)))); const geo2 = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false });
    geo2.rotateX(-Math.PI / 2); const m = new THREE.Mesh(geo2, mat); m.position.y = y0; return m;
  };
  g.add(prism(geo.substation.gm, 2.8, new THREE.MeshStandardMaterial({ color: 0xd8d1c0, roughness: .9 })));
  g.add(prism(geo.substation.bld, 2.4, new THREE.MeshStandardMaterial({ color: 0xc9c1ad, roughness: .9 })));
  g.position.set(subC.x, subC.y - .1, subC.z); g.traverse((m) => { if (m.isMesh) m.userData.part = 'station:substation'; }); scene.add(g);
}
station.anchors.substation = station.group.worldToLocal(subC.clone().add(new THREE.Vector3(0, 4.2, 0)));
const SLAB_MH = new THREE.Vector3(-4.84, 0, 13.08);                        // cable manhole, station-local
const gridCablePts = (() => {
  const c = geo.substation.cable; const pts = [subC.clone().setY(subC.y + .2)];
  const mh = stationWorld(SLAB_MH); const all = [[subC.x, subC.z], ...c.slice(0, -1), [mh.x, mh.z]];
  for (let i = 1; i < all.length; i++) {
    const [ax, az] = all[i - 1], [bx, bz] = all[i]; const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 4));
    for (let k = 1; k <= n; k++) { const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; pts.push(new THREE.Vector3(x, Math.min(yAt(x, z), station.group.position.y) - .9, z)); }
  }
  pts.push(mh.clone().setY(station.group.position.y - .5), mh.clone().setY(station.group.position.y + .12)); return pts;
})();
{ // manhole cover on the slab where the cable comes up
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, .04, 1.2), new THREE.MeshStandardMaterial({ color: 0x2b3236, metalness: .4 }));   // ~1.6 × 1.2 m opening (site measurements)
  m.position.copy(SLAB_MH).setY(.03); m.userData.part = 'station:electrical'; station.group.add(m);
}
{
  const cm = new THREE.MeshStandardMaterial({ color: 0xe3b62a, transparent: true, opacity: .55, depthTest: false, depthWrite: false });
  const under = gridCablePts.slice(0, -2), up = gridCablePts.slice(-3);   // buried run (ghost) and the riser into the room (solid)
  const c = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(under, false, 'centripetal', .1), under.length * 2, .07, 6, false), cm); c.renderOrder = 6; scene.add(c);
  const r = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(up, false, 'centripetal', .1), 12, .07, 6, false), new THREE.MeshStandardMaterial({ color: 0xe3b62a })); scene.add(r);
}
stationFlow(gridCablePts, 'elec', 'charge', scene);
stationFlow(gridCablePts.slice().reverse(), 'elec', 'generate', scene);
// always-visible route line (1 px) for far views
const routeLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(allPts.map((p) => p.clone().setY(p.y + PIPE_R * 1.6))),
  new THREE.LineBasicMaterial({ color: 0x0d1114, transparent: true, opacity: .85 }));
scene.add(routeLine);

// concrete weights along the subsea pipeline (Leonardo Stadler BAROMAR-C-07: standard block for the
// HDPE SDR9 OD 250 mm pipe, 1.30 m across × 1.00 m along × 0.60 m high, with a saddle on top)
const WEIGHT_SPACING = SITE.weightSpacing || 12;
const subseaLen = subseaCurve.getLength();
const weights = (() => {
  const sh = new THREE.Shape();
  sh.moveTo(-.65, 0); sh.lineTo(.65, 0); sh.lineTo(.62, .6); sh.lineTo(.2, .6); sh.lineTo(.12, .42); sh.lineTo(-.12, .42); sh.lineTo(-.2, .6); sh.lineTo(-.62, .6); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); geo.translate(0, 0, -.5);
  const n = Math.floor((subseaLen - 20) / WEIGHT_SPACING);
  const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xa8a49a, roughness: .95 }), n);
  const p = new THREE.Vector3(), t = new THREE.Vector3(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), m4 = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const u = (10 + i * WEIGHT_SPACING) / subseaLen;
    subseaCurve.getPointAt(u, p); subseaCurve.getTangentAt(u, t); t.y = 0; t.normalize();
    q.setFromAxisAngle(up, Math.atan2(t.x, t.z));
    const wet = heightAt(p.x, p.z) < -.5;                                   // weights only in the water, not on the beach
    m4.compose(new THREE.Vector3(p.x, yAt(p.x, p.z) - .05, p.z), q, wet ? one : new THREE.Vector3(0, 0, 0)); m.setMatrixAt(i, m4);
  }
  m.frustumCulled = false; m.userData.part = 'pipeline'; scene.add(m);
  return { mesh: m, count: n };
})();

// distance along the route and depth markers where the pipe crosses each 10 m isobath
const routeS = [0]; for (let i = 1; i < subseaPts.length; i++) routeS.push(routeS[i - 1] + Math.hypot(subseaPts[i].x - subseaPts[i - 1].x, subseaPts[i].z - subseaPts[i - 1].z));
const routeLen = routeS[routeS.length - 1];
const onshoreLen = onshorePts.reduce((a, p, i) => (i ? a + Math.hypot(p.x - onshorePts[i - 1].x, p.z - onshorePts[i - 1].z) : 0), 0);
const depthAtIndex = (i) => Math.max(0, -heightAt(subseaPts[i].x, subseaPts[i].z));
const depthMarks = [];
for (let L = 20, i = 0; L <= 100 && i < subseaPts.length; L += 20) {
  while (i < subseaPts.length && depthAtIndex(i) < L) i++;
  if (i < subseaPts.length) depthMarks.push({ depth: L, i, s: routeS[i] });
}

const flow = { visible: false };

// ---------------------------------------------------------------- tanks
const T = geo.tanks;
const tankSite = new THREE.Vector3(T.Manifold.xy[0], yAt(T.Manifold.xy[0], T.Manifold.xy[1]), T.Manifold.xy[1]);
const tankGroups = { single: new THREE.Group(), three: new THREE.Group() };
const tankSets = { single: [], three: [] };
function placeTank(set, xy, rot) {
  const t = buildTankStructure();
  t.group.position.set(xy[0], yAt(xy[0], xy[1]) - .4, xy[1]); t.group.rotation.y = rot; t.group.updateMatrixWorld(true);
  tankGroups[set].add(t.group); tankSets[set].push(t); return t;
}
{
  // single structure next to the manifold point, inlet (local -x) facing the incoming pipe
  const M0 = T.Manifold.xy, last = route[route.length - 3];
  let dx = last[0] - M0[0], dz = last[1] - M0[1]; const dl = Math.hypot(dx, dz); dx /= dl; dz /= dl;
  placeTank('single', [M0[0] - dx * 8.4, M0[1] - dz * 8.4], Math.atan2(dz, -dx));
  ['Tank 1', 'Tank 2', 'Tank 3'].forEach((k) => {
    const [x, z] = T[k].xy; let ux = M0[0] - x, uz = M0[1] - z; const ul = Math.hypot(ux, uz); ux /= ul; uz /= ul;
    const t = placeTank('three', [x, z], Math.atan2(uz, -ux));
    // jumper from the manifold to each structure
    const inlet = t.group.localToWorld(t.inlet.clone());
    const pts = [tankSite.clone().setY(tankSite.y + 1.2), inlet];
    // jumper at the real pipe size, with its own flow pulses
    const jm = new THREE.MeshStandardMaterial({ color: 0x15191c, roughness: .55, metalness: .15 }); flowShader(jm, pts[0].distanceTo(pts[1]), false);
    const j = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(pts[0], pts[1]), 24, PIPE_R * 1.4, 10, false), jm); j.userData.part = 'tanks'; tankGroups.three.add(j);
  });
  const man = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), new THREE.MeshStandardMaterial({ color: 0xc27a4e, metalness: .5, roughness: .4 }));
  man.position.copy(tankSite).setY(tankSite.y + 1); tankGroups.three.add(man);
  scene.add(tankGroups.single, tankGroups.three);
}
// seawater pushed out of (charge) / drawn into (generate) the open tube bottoms: short streaks that
// leave from under the slab edge and fade as they spread, one stream per outer tube
const WX_PER = 9, WX_N = WX_PER * 10 * 3;
const wxStreak = new THREE.CylinderGeometry(.055, .055, 1.4, 5, 1); wxStreak.rotateZ(Math.PI / 2);
const wx = new THREE.InstancedMesh(wxStreak, new THREE.MeshBasicMaterial({ color: 0x1846a8, transparent: true, opacity: .95, depthWrite: false }), WX_N);
wx.visible = false; wx.frustumCulled = false; scene.add(wx);
const wxSeed = Array.from({ length: WX_N }, (_, i) => ({ a: (Math.floor(i / WX_PER) % 10) / 10 * Math.PI * 2 + .3 + ((i * 7919) % 100) / 100 * .5, t: (i % WX_PER) / WX_PER + ((i * 31) % 17) / 170, h: ((i * 13) % 11) / 11 }));
const wxM = new THREE.Matrix4(), wxQ = new THREE.Quaternion(), wxS = new THREE.Vector3(), wxP = new THREE.Vector3(), wxUp = new THREE.Vector3(0, 1, 0);
function updateWater(dt, dir) {
  const set = tankSets[state.tankLayout];
  wxSeed.forEach((p, i) => {
    p.t = (p.t + dt * .3) % 1; const k = dir > 0 ? p.t : 1 - p.t;
    const tg = set[Math.floor(i / (WX_PER * 10)) % set.length].group; const g = tg.position;
    const a = p.a, r = 7.6 + k * 11;
    wxP.set(g.x + Math.cos(a) * r, g.y + .9 + p.h * 1.2 + k * 1.6, g.z + Math.sin(a) * r);
    wxQ.setFromAxisAngle(wxUp, -a);
    const f = Math.sin(Math.PI * Math.min(1, k * 1.1)); wxS.set(.4 + .6 * f, f, f);
    wxM.compose(wxP, wxQ, wxS); wx.setMatrixAt(i, wxM);
  });
  wx.instanceMatrix.needsUpdate = true;
}
function setTankLayout(l) {
  state.tankLayout = l; tankGroups.single.visible = l === 'single'; tankGroups.three.visible = l === 'three';
  applyFill();
}
function applyFill() { const xr = !!state.mode; tankSets[state.tankLayout].forEach((t) => { t.setXray(xr); t.setFill(state.soc); }); }

// ---------------------------------------------------------------- labels
const labels = [];
function pin(text, pos, partId, { small = false, num = '', near = 0 } = {}) {
  const d = document.createElement('button'); d.type = 'button'; d.className = 'pin' + (small ? ' small' : '');
  d.innerHTML = `<i>${num}</i><span>${text}</span>`;
  d.addEventListener('click', (e) => { e.stopPropagation(); partId.startsWith('station:') ? openStationPart(partId.split(':')[1]) : openPart(partId); });
  const o = new CSS2DObject(d); o.position.copy(pos); scene.add(o); labels.push({ o, d, partId, small, near });
  return o;
}
const railIndex = (id) => PARTS.findIndex((p) => p.id === id);
const stationTop = station.group.position.clone().add(new THREE.Vector3(0, 26, 0));
pin(UI.pin.station, stationTop, 'station', { num: railIndex('station') });
const lf = chamberPos.clone(); lf.y += 14; pin(UI.pin.landfall, lf, 'landfall', { num: railIndex('landfall') });
const mid = subseaPts[Math.floor(subseaPts.length * .45)].clone(); mid.y += 40; pin(UI.pin.pipeline, mid, 'pipeline', { num: railIndex('pipeline') });
const tankPinPos = tankSite.clone().add(new THREE.Vector3(0, 40, 0)); pin(UI.pin.tanks, tankPinPos, 'tanks', { num: railIndex('tanks') });
Object.entries(station.anchors).forEach(([k, a]) => pin(STATION_PARTS[k].title, stationWorld(a), 'station:' + k, { small: true, num: '', near: k === 'substation' ? 450 : 0 }));
// the manhole on the shore and the buried power cable get their own labels, shown when the camera is near them
pin(UI.pin.manhole, chamberPos.clone().add(new THREE.Vector3(0, 3.2, 0)), 'landfall', { small: true, near: 260 });
pin(STATION_PARTS.cable.title, gridCablePts[Math.floor(gridCablePts.length * .45)].clone().setY(yAt(gridCablePts[Math.floor(gridCablePts.length * .45)].x, gridCablePts[Math.floor(gridCablePts.length * .45)].z) + 2.5), 'station:cable', { small: true, near: 450 });
station.anchors.cable = station.group.worldToLocal(gridCablePts[Math.floor(gridCablePts.length * .45)].clone().setY(station.group.position.y + 2));
depthMarks.forEach((m) => {
  const d = document.createElement('div'); d.className = 'depth-tag'; d.textContent = `${m.depth} m`;
  const o = new CSS2DObject(d); o.position.copy(subseaPts[m.i]).add(new THREE.Vector3(0, 8, 0)); scene.add(o);
  labels.push({ o, d, partId: 'depth', depth: true });
});

// exploded view of the storage structure
const explode = { k: 0, target: 0 };
const exLabels = [];
{
  const t0 = tankSets.single[0];
  t0.explodeLabels.forEach((e) => {
    const d = document.createElement('div'); d.className = 'pin small ex'; d.innerHTML = `<i></i><span>${e.text}</span>`;
    const o = new CSS2DObject(d); o.position.copy(t0.group.localToWorld(e.pos.clone())); scene.add(o);
    const l = { o, d, partId: 'explode', small: true, explode: true }; labels.push(l); exLabels.push(l);
  });
}
station.explodeLabels.forEach((e) => {
  const d = document.createElement('div'); d.className = 'pin small ex'; d.innerHTML = `<i></i><span>${e.text}</span>`;
  const o = new CSS2DObject(d); o.position.copy(stationWorld(e.pos)); scene.add(o);
  labels.push({ o, d, partId: 'stexplode', small: true, stExplode: true });
});
function setStationExplode(on) {
  stExplode.target = on ? 1 : 0;
  const b = pbody.querySelector('#st-explode-btn'); if (b) { b.setAttribute('aria-pressed', String(on)); b.textContent = on ? UI.putBack : UI.takeApart; }
  if (on && state.mode) { state.cycle = null; state.mode = null; setMode(null); }
  if (state.part === 'station') flyTo('station', 1.4);
}
function setExplode(on) {
  explode.target = on ? 1 : 0;
  pbody.querySelector('#explode-btn')?.setAttribute('aria-pressed', String(on));
  if (on && state.mode) { state.cycle = null; state.mode = null; setMode(null); }
  if (state.part === 'tanks') flyTo(tankView(on), 1.4);
}

// ---------------------------------------------------------------- camera views
const VIEWS = {
  overview: () => { const k = camera.aspect < 1 ? 1.7 : 1; const t = new THREE.Vector3(1500, -150, 2450); return { target: t, pos: t.clone().add(new THREE.Vector3(-2300, 7600, 4300).multiplyScalar(k)) }; },
  station: () => {
    const ex = stExplode.target > 0; const p = station.group.position.clone().add(new THREE.Vector3(0, ex ? 10 : 2, 0)); const k = (ex ? 1.35 : 1) * (camera.aspect < 1 ? 1.6 : 1);
    return { target: p, pos: p.clone().add(stationWorld(new THREE.Vector3(-30, 0, 26)).sub(station.group.position).setY(0).normalize().multiplyScalar((ex ? 50 : 46) * k)).add(new THREE.Vector3(0, (ex ? 13 : 30) * k, 0)) };
  },
  landfall: () => { const t = chamberPos.clone().lerp(station.group.position, .38); const k = camera.aspect < 1 ? 1.6 : 1; return { target: t, pos: t.clone().add(new THREE.Vector3(-240 * k, 260 * k, 120 * k)) }; },
  pipeline: () => { const p = subseaPts[Math.floor(subseaPts.length * .5)]; return { target: p.clone(), pos: p.clone().add(new THREE.Vector3(-1900, 1200, 1300)) }; },
  tanks: () => tankView(explode.target > 0),
  seabed: () => { const t = new THREE.Vector3(2300, -200, 2900); return { target: t, pos: t.clone().add(new THREE.Vector3(-2600, 3300, 2700).multiplyScalar(camera.aspect < 1 ? 1.7 : 1)) }; },
};
function tankView(ex) {
  const p = (state.tankLayout === 'three' ? tankSite : tankSets.single[0].group.position).clone().add(new THREE.Vector3(0, ex ? 21 : 6, 0));
  const r = (state.tankLayout === 'three' ? 2.6 : 1) * (ex ? 2.15 : 1) * (camera.aspect < 1 ? 1.7 : 1);
  return { target: p, pos: p.clone().add(new THREE.Vector3(-26 * r, (ex ? 7 : 16) * r, 30 * r)) };
}
let fly = null;
function flyTo(v, dur = 1.8) {
  const end = VIEWS[v] ? VIEWS[v]() : v;
  if (REDUCED) { camera.position.copy(end.pos); controls.target.copy(end.target); return; }
  fly = { t: 0, dur, p0: camera.position.clone(), t0: controls.target.clone(), p1: end.pos, t1: end.target };
}
const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ---------------------------------------------------------------- UI: rail and panel
const rail = document.getElementById('rail');
// static texts in index.html, filled from content.js
document.querySelector('.topbar h1').textContent = SITE.title; document.querySelector('.topbar .title p').textContent = SITE.subtitle;
document.getElementById('btn-how').textContent = UI.howButton; document.getElementById('how-title').textContent = UI.howTitle;
document.getElementById('how-run').textContent = UI.howRun; document.querySelector('.minimap-head span').textContent = UI.siteMap;
document.getElementById('btn-cycle').textContent = UI.playCycle;
rail.innerHTML = `<h2>${UI.menuHeading}</h2><ol>${PARTS.map((p, i) => `<li><button type="button" data-part="${p.id}"><span class="dot">${i === 0 ? '◎' : i}</span><span>${p.rail}</span></button></li>`).join('')}</ol>`;
rail.addEventListener('click', (e) => { const b = e.target.closest('[data-part]'); if (b) openPart(b.dataset.part); });
document.querySelector('.brand').addEventListener('click', (e) => { e.preventDefault(); openPart('overview'); });

const panel = document.getElementById('panel'); const pbody = document.getElementById('panel-body');
document.getElementById('panel-close').addEventListener('click', closePanel);
function closePanel() { panel.classList.add('hidden'); document.body.classList.remove('panel-open'); setOffset(); }
function showPanel() { panel.classList.remove('hidden'); document.body.classList.add('panel-open'); pbody.scrollTop = 0; setOffset(); }
// shift the 3D view so the subject is centred in the space left free by the rail and the panel
function setOffset() {
  const desk = innerWidth > 820; const open = !panel.classList.contains('hidden');
  const shift = desk ? (open ? (panel.offsetWidth + 200) / 2 - 120 : -60) : 0;
  const shiftY = !desk && open ? Math.min(panel.offsetHeight, innerHeight * .52) / 2 - 30 : 0;
  camera.setViewOffset(innerWidth, innerHeight, shift, shiftY, innerWidth, innerHeight);
}

function gallery(imgs) {
  if (!imgs || !imgs.length) return '';
  return `<div class="gallery ${imgs.length === 1 ? 'one' : ''}">${imgs.map((im) => `<button type="button" data-img="${im.src}" data-cap="${im.caption}"><img src="${im.src}" alt="${im.caption}" loading="lazy"><span>${im.caption}</span></button>`).join('')}</div>`;
}
function openPart(id, { fly: doFly = true } = {}) {
  const p = PARTS.find((x) => x.id === id); if (!p) return;
  state.part = id;
  if (id !== 'tanks' && explode.target) explode.target = 0;
  if (id !== 'station' && stExplode.target) stExplode.target = 0;
  rail.querySelectorAll('[data-part]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.part === id)));
  labels.forEach((l) => l.d.classList.toggle('active', l.partId === id));
  let h = `<h2>${p.title}</h2><p class="lead">${p.lead}</p>`;
  if (p.figures) h += `<div class="figures">${KEY_FIGURES.map((f) => `<div><b>${f.value}<small>${f.unit}</small></b><span>${f.label}</span></div>`).join('')}</div>`;
  h += p.body.map((t) => `<p>${t}</p>`).join('');
  if (p.stats) h += `<dl class="stats">${p.stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  if (p.tankToggle) h += `<p style="margin-bottom:2px"><b>${UI.tankShow}</b></p><div class="seg-inline" id="tank-layout"><button type="button" data-l="single" aria-pressed="${state.tankLayout === 'single'}">${UI.oneStructure}</button><button type="button" data-l="three" aria-pressed="${state.tankLayout === 'three'}">${UI.threeStructures}</button></div><p class="note">${UI.tankLayoutNote}</p>`;
  if (p.tankToggle) h += `<p style="margin:14px 0 4px"><b>${UI.builtHeading}</b></p><button type="button" class="btn explode-btn" id="explode-btn" aria-pressed="${explode.target > 0}">${explode.target > 0 ? UI.putBack : UI.takeApart}</button><p class="note">${UI.tankExplodeNote}</p>`;
  if (p.surveyToggle) h += `<label class="switch"><input type="checkbox" id="survey-toggle" ${state.survey ? 'checked' : ''}> Show the multibeam survey map</label>`;
  if (id === 'station') h += `<p style="margin:14px 0 4px"><b>${UI.builtHeading}</b></p><button type="button" class="btn explode-btn" id="st-explode-btn" aria-pressed="${stExplode.target > 0}">${stExplode.target > 0 ? UI.putBack : UI.takeApart}</button><p class="note">${UI.stationExplodeNote}</p>`;
  if (p.children) h += `<div class="chips">${p.children.map((c) => `<button type="button" data-sub="${c}">${STATION_PARTS[c].title}</button>`).join('')}</div>`;
  h += gallery(p.images);
  if (id === 'station' && !state.realStation) h += '';
  pbody.innerHTML = h; showPanel();
  bindPanel();
  applyFill();
  if (doFly) flyTo(p.view);
}
function openStationPart(k) {
  const s = STATION_PARTS[k]; state.part = 'station';
  rail.querySelectorAll('[data-part]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.part === 'station')));
  pbody.innerHTML = `<p style="margin:0 0 6px"><button type="button" class="btn ghost small" data-back style="background:#fff;color:var(--ink);border-color:var(--line)">Shore station</button></p><h2>${s.title}</h2>${s.tag ? `<p class="note" style="margin:-4px 0 8px">${s.tag}</p>` : ''}<p class="lead">${s.text}</p>
    <div class="chips">${Object.keys(STATION_PARTS).map((c) => `<button type="button" data-sub="${c}" aria-pressed="${c === k}">${STATION_PARTS[c].title}</button>`).join('')}</div>
    <p class="note">${UI.componentNote}</p>${gallery(s.images)}`;
  showPanel(); bindPanel();
  const a = stationWorld(station.anchors[k]);
  flyTo({ target: a.clone().add(new THREE.Vector3(0, -2, 0)), pos: a.clone().add(new THREE.Vector3(-14, 9, 18)) }, 1.3);
}
function bindPanel() {
  pbody.querySelectorAll('[data-sub]').forEach((b) => b.addEventListener('click', () => openStationPart(b.dataset.sub)));
  pbody.querySelector('[data-back]')?.addEventListener('click', () => openPart('station'));
  pbody.querySelectorAll('[data-img]').forEach((b) => b.addEventListener('click', () => lightbox(b.dataset.img, b.dataset.cap)));
  pbody.querySelectorAll('#tank-layout [data-l]').forEach((b) => b.addEventListener('click', () => {
    setTankLayout(b.dataset.l); pbody.querySelectorAll('#tank-layout [data-l]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); flyTo('tanks', 1.2);
  }));
  pbody.querySelector('#st-explode-btn')?.addEventListener('click', () => setStationExplode(stExplode.target === 0));
  pbody.querySelector('#explode-btn')?.addEventListener('click', () => { const on = explode.target === 0; setExplode(on); pbody.querySelector('#explode-btn').textContent = on ? UI.putBack : UI.takeApart; });
  pbody.querySelector('#survey-toggle')?.addEventListener('change', (e) => { state.survey = e.target.checked; if (state.survey) loadSurvey(); terrainMat.uniforms.uSurveyOn.value = state.survey ? 1 : 0; });
}
const lb = document.getElementById('lightbox');
function lightbox(src, cap) { lb.querySelector('img').src = src; lb.querySelector('img').alt = cap; lb.querySelector('p').textContent = cap; lb.hidden = false; lb.querySelector('button').focus(); }
lb.addEventListener('click', () => { lb.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!lb.hidden) lb.hidden = true; else if (document.getElementById('about').hidden && document.getElementById('how').hidden) closePanel(); } });

// about
const about = document.getElementById('about');
document.getElementById('about-body').innerHTML = `<img class="about-logo" src="assets/img/logo.png" alt="BaroMar"><h2>${ABOUT.title}</h2>${ABOUT.text.map((t) => `<p>${t}</p>`).join('')}<p class="credits">${ABOUT.credits}</p><p class="credits">${ABOUT.note}</p><p class="credits">${SITE.confidential}</p>`;
document.getElementById('btn-about').addEventListener('click', () => { about.hidden = false; about.querySelector('[data-close]').focus(); });
about.addEventListener('click', (e) => { if (e.target === about || e.target.closest('[data-close]')) about.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') about.hidden = true; });

// ---------------------------------------------------------------- process simulation (charge / store / generate)
const segBtns = [...document.querySelectorAll('.seg [data-mode]')];
const socFill = document.getElementById('soc-fill'); const socLabel = document.getElementById('soc-label');
function setMode(m, { focus = true } = {}) {
  state.mode = state.mode === m && !state.cycle ? null : m;
  segBtns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === state.mode)));
  flow.visible = state.mode === 'charge' || state.mode === 'generate';
  flowU.uFlowOn.value = state.mode === 'charge' ? 1 : state.mode === 'generate' ? -1 : 0;
  flowU.uFlowColor.value.set(0xffffff);
  if (state.mode && stExplode.target) stExplode.target = 0;
  if (state.mode && explode.target) { explode.target = 0; const b = pbody.querySelector('#explode-btn'); if (b) { b.textContent = UI.takeApart; b.setAttribute('aria-pressed', 'false'); } }
  applyFill();
  if (focus && state.mode && !['tanks', 'station'].includes(state.part)) { openPart('tanks'); }
}
segBtns.forEach((b) => b.addEventListener('click', () => { state.cycle = null; setMode(b.dataset.mode); }));
const cycleBtn = document.getElementById('btn-cycle');
cycleBtn.addEventListener('click', () => {
  if (state.cycle) { state.cycle = null; cycleBtn.textContent = UI.playCycle; setMode(null); return; }
  state.cycle = { phase: 'charge', t: 0 }; cycleBtn.textContent = UI.stopCycle; state.soc = Math.min(state.soc, .2);
  state.mode = null; setMode('charge');
});
function updateCycle(dt) {
  const c = state.cycle; if (!c) return; c.t += dt;
  if (c.phase === 'charge' && state.soc >= .97) { c.phase = 'hold'; c.t = 0; state.mode = null; setMode('hold', { focus: false }); }
  else if (c.phase === 'hold' && c.t > 4) { c.phase = 'generate'; c.t = 0; state.mode = null; setMode('generate', { focus: false }); }
  else if (c.phase === 'generate' && state.soc <= .12) { state.cycle = null; cycleBtn.textContent = UI.playCycle; state.mode = 'hold'; setMode('hold', { focus: false }); }
}

const how = initProcessExplainer({ onRun: (m) => { state.cycle = null; state.mode = null; setMode(m); } });
document.getElementById('btn-how').addEventListener('click', () => how.open(state.mode || 'charge'));

// ---------------------------------------------------------------- picking
const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2(); let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; fly = null; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
  ptr.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(ptr, camera);
  const hits = ray.intersectObjects([station.group, tankGroups.single, tankGroups.three, pipe, trench], true);
  const h = hits.find((x) => x.object.userData.part); if (!h) return;
  const part = h.object.userData.part;
  if (part.startsWith('station:')) openStationPart(part.split(':')[1]); else openPart(part);
});
controls.addEventListener('start', () => { fly = null; });

// ---------------------------------------------------------------- map
const mapApi = initMap(geo, { onPick: (id) => openPart(id) });

// ---------------------------------------------------------------- route ruler (right side)
const ruler = document.getElementById('ruler');
const sMin = -onshoreLen, sMax = routeLen;
const sToPct = (s) => {
  // the short onshore stretch gets a fixed share so the station and landfall do not collide
  if (s <= 0) return 6 * (1 - s / sMin);
  return 6 + (s / sMax) * 94;
};
const stops = [
  { id: 'station', name: UI.pin.station, depth: '', s: sMin, go: () => openPart('station') },
  { id: 'landfall', name: UI.pin.landfall, depth: '0 m', s: 0, go: () => openPart('landfall') },
];
depthMarks.filter((m) => m.s < routeLen - 300).forEach((m) => {
  const i = m.i, km = m.depth;
  stops.push({ id: 'd' + m.depth, name: `${(m.s / 1000).toFixed(1)} km`, depth: `${m.depth} m`, s: m.s, i, km: true,
    go: () => { const p = subseaPts[i]; openPart('pipeline', { fly: false }); flyTo({ target: p.clone(), pos: p.clone().add(new THREE.Vector3(-260, 190, 230)) }, 1.6); } });
});
stops.push({ id: 'tanks', name: UI.pin.tanks, depth: `${Math.round(depthAtIndex(subseaPts.length - 1))} m`, s: routeLen, go: () => openPart('tanks') });
ruler.innerHTML = `<div class="ruler-track"><div class="ruler-mark" id="ruler-mark"></div></div>` + stops.map((st) =>
  `<button type="button" class="stop${st.km ? ' km' : ''}" data-stop="${st.id}" style="top:${sToPct(st.s)}%"><i></i><span class="n">${st.name}</span>${st.depth ? `<span class="d">${st.depth}</span>` : ""}</button>`).join('');
ruler.addEventListener('click', (e) => { const b = e.target.closest('[data-stop]'); if (b) stops.find((x) => x.id === b.dataset.stop).go(); });
const rMark = document.getElementById('ruler-mark');
let rulerLast = 0;
const corner = new THREE.Vector2(), seaPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitP = new THREE.Vector3(), rc = new THREE.Raycaster();
function updateRuler(now) {
  if (now - rulerLast < 150) return; rulerLast = now;
  const t = controls.target;
  let best = 1e12, bi = 0; for (let i = 0; i < subseaPts.length; i += 2) { const d = (subseaPts[i].x - t.x) ** 2 + (subseaPts[i].z - t.z) ** 2; if (d < best) { best = d; bi = i; } }
  const ds = (t.x - station.group.position.x) ** 2 + (t.z - station.group.position.z) ** 2;
  let sNow = routeS[bi]; if (ds < best) sNow = sMin;
  const near = Math.min(best, ds) < 900 ** 2;
  rMark.style.opacity = near ? 1 : 0; rMark.style.top = `${sToPct(sNow)}%`;
  ruler.querySelectorAll('.stop').forEach((b) => { const st = stops.find((x) => x.id === b.dataset.stop); b.classList.toggle('here', near && Math.abs(st.s - sNow) < (st.km ? 250 : 400)); });
  const [lat, lon] = toLL(t.x, t.z); mapApi.setFocus(lat, lon);
  // footprint of the 3D view on the site map
  const pts = [];
  for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    corner.set(x, y); rc.setFromCamera(corner, camera);
    if (!rc.ray.intersectPlane(seaPlane, hitP) || hitP.distanceTo(camera.position) > 16000) { mapApi.setView(null); return; }
    pts.push(toLL(hitP.x, hitP.z));
  }
  mapApi.setView(pts);
}

// ---------------------------------------------------------------- label layout (no overlaps)
const pv = new THREE.Vector3();
const prio = (l) => (l.explode || l.stExplode ? 0 : l.d.classList.contains('active') ? 0 : l.depth ? 3 : l.small ? 2 : 1);
function layoutLabels() {
  const placed = [];
  // never place a label under the open panel, the rail or the ruler
  if (!panel.classList.contains('hidden')) { const r = panel.getBoundingClientRect(); placed.push({ x: r.left, y: r.top, w: r.width, h: r.height }); }
  for (const el of [rail, document.querySelector('.topbar .title')]) { const r = el.getBoundingClientRect(); placed.push({ x: r.left, y: r.top, w: r.width, h: r.height }); } const list = labels.slice().sort((a, b) => prio(a) - prio(b));
  for (const l of list) {
    if (!l.vis) { l.o.visible = false; continue; }
    pv.copy(l.o.position).project(camera);
    if (pv.z > 1 || pv.z < -1 || Math.abs(pv.x) > 1.1 || Math.abs(pv.y) > 1.1) { l.o.visible = false; continue; }
    const x = (pv.x * .5 + .5) * innerWidth, y = (-pv.y * .5 + .5) * innerHeight;
    if (l.d.offsetWidth) { l.w = l.d.offsetWidth; l.h = l.d.offsetHeight; }
    const w = (l.w || 110) + 8, h = (l.h || 26) + 6, b = { x: x - w / 2, y: y - h / 2, w, h };
    if (placed.some((q) => b.x < q.x + q.w && b.x + b.w > q.x && b.y < q.y + q.h && b.y + b.h > q.y)) { l.o.visible = false; continue; }
    placed.push(b); l.o.visible = true;
  }
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
const underFog = new THREE.FogExp2(0x0b3d55, .0013); let lastUnder = -1; let glowWasOn = true;
const tmp = new THREE.Vector3();
function tick() {
  const rawDt = clock.getDelta(); const dt = Math.min(.05, rawDt); const time = clock.elapsedTime;
  if (fly) {
    fly.t += Math.min(.1, rawDt) / fly.dur; const k = ease(Math.min(1, fly.t));
    camera.position.lerpVectors(fly.p0, fly.p1, k); controls.target.lerpVectors(fly.t0, fly.t1, k);
    if (fly.t >= 1) fly = null;
  }
  controls.update();

  // keep the camera above the seabed
  const gy = yAt(camera.position.x, camera.position.z) + 3;
  if (camera.position.y < gy) camera.position.y = gy;

  const under = camera.position.y < 0 ? 1 : 0;
  const dist = camera.position.distanceTo(controls.target);
  const near = Math.min(20, Math.max(.2, dist * .004));
  if (Math.abs(camera.near - near) > near * .2) { camera.near = near; camera.far = Math.max(40000, dist * 25); camera.updateProjectionMatrix(); }
  terrainMat.uniforms.uTime.value = time; seaMat.uniforms.uTime.value = time; seaMat.uniforms.uUnder.value = under;
  skyMat.uniforms.uUnder.value = under;
  terrainMat.uniforms.uFogColor.value.set(under ? 0x0b3d55 : 0xcfe3ea); terrainMat.uniforms.uUnder.value = under;
  terrainMat.uniforms.uFogDensity.value = under ? .0016 : .000035;
  if (under !== lastUnder) { scene.fog = under ? underFog : null; lastUnder = under; }
  hemi.intensity = under ? .8 : 1.1;

  // process simulation
  updateCycle(dt);
  const rate = 1 / 22;
  if (state.mode === 'charge') state.soc = Math.min(1, state.soc + dt * rate);
  if (state.mode === 'generate') state.soc = Math.max(.05, state.soc - dt * rate);
  if (state.mode === 'charge' && state.soc >= 1 && !state.cycle) setMode('hold', { focus: false });
  if (state.mode) tankSets[state.tankLayout].forEach((t) => t.setFill(state.soc));
  socFill.style.width = `${Math.round(state.soc * 100)}%`; socLabel.textContent = UI.tanksFull(Math.round(state.soc * 100));
  const glowOn = state.mode === 'charge' || state.mode === 'generate';
  if (glowOn || glowWasOn) {
    // yellow: the machine taking or giving electricity; red: the hot-water store filling or emptying
    glow(station.parts.compressor, 0xf2c230, state.mode === 'charge' ? .35 + .25 * Math.sin(time * 4) : 0);
    glow(station.parts.teg, 0xf2c230, state.mode === 'generate' ? .35 + .25 * Math.sin(time * 4) : 0);
    glow(station.parts.tes, 0xd8452b, glowOn ? .3 + .2 * Math.sin(time * 3) : 0);
    glowWasOn = glowOn;
  }

  wx.visible = flow.visible && dist < 400;
  if (wx.visible) updateWater(dt, state.mode === 'charge' ? 1 : -1);
  if (flow.visible) {
    // calm pace: about half a pulse spacing per second, whatever the zoom
    flowU.uFlowPhase.value = (flowU.uFlowPhase.value + dt * .45) % 64;
    flowU.uFlowLevel.value = Math.max(0, Math.log(Math.max(1, dist * .03 / 6)) / Math.log(4));
  }

  if (explode.k !== explode.target) {
    const sp = dt / 1.3; explode.k = explode.target > explode.k ? Math.min(explode.target, explode.k + sp) : Math.max(explode.target, explode.k - sp);
    const e = explode.k < .5 ? 4 * explode.k ** 3 : 1 - (-2 * explode.k + 2) ** 3 / 2;
    tankSets.single.concat(tankSets.three).forEach((t) => t.setExplode(e));
  }

  if (stExplode.k !== stExplode.target) {
    const sp = dt / 1.3; stExplode.k = stExplode.target > stExplode.k ? Math.min(stExplode.target, stExplode.k + sp) : Math.max(stExplode.target, stExplode.k - sp);
    station.setExplode(stExplode.k < .5 ? 4 * stExplode.k ** 3 : 1 - (-2 * stExplode.k + 2) ** 3 / 2);
  }
  updateStationFlows(dt, camera.position.distanceTo(station.group.position) < 320);

  // labels: decide which are relevant at this distance, then hide any that would overlap a more important one
  const dStation = camera.position.distanceTo(station.group.position);
  labels.forEach((l) => {
    let vis = true;
    if (l.explode) vis = explode.k > .92 && state.tankLayout === 'single';
    else if (l.stExplode) vis = stExplode.k > .92;
    else if (l.depth) vis = dist > 25 && dist < 7500;
    else if (l.near) vis = camera.position.distanceTo(l.o.position) < l.near;
    else if (l.small) vis = dStation < 140;
    else if (l.partId === 'station') vis = dStation > 90;
    else if (l.partId === 'landfall') vis = dStation > 90 && camera.position.distanceTo(l.o.position) < 3200;
    else if (l.partId === 'tanks' && explode.k > .3) vis = false;
    else vis = camera.position.distanceTo(l.o.position) > 60;
    l.vis = vis;
  });
  layoutLabels();
  routeLine.material.opacity = Math.min(.6, Math.max(0, (dist - 300) / 1500));
  widen.value = Math.max(0, Math.min(30, dist * .0019 - PIPE_R));

  renderer.render(scene, camera); labelRenderer.render(scene, camera);
  updateRuler(performance.now());
  requestAnimationFrame(tick);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; setOffset();
  renderer.setSize(innerWidth, innerHeight); labelRenderer.setSize(innerWidth, innerHeight);
});

setTankLayout(state.tankLayout);
progress(100, 'Ready');
setTimeout(() => document.getElementById('loader').classList.add('done'), 250);
const startPart = qs.get('part') || 'overview';
if (MOBILE) { flyTo('overview', .01); closePanel(); rail.querySelector('[data-part="overview"]').setAttribute('aria-current', 'true'); }
else { openPart(startPart, { fly: false }); camera.position.copy(VIEWS.overview().pos).add(new THREE.Vector3(1500, 2500, 2500)); flyTo(startPart === 'overview' ? 'overview' : startPart, 3); }
tick();
window.__pilot = { state, flyTo, openPart, setMode, setExplode, setStationExplode, openStationPart, camera, controls, station, stExplode, chamberPos, V: THREE.Vector3 };
