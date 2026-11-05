import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PARTS, STATION_PARTS, KEY_FIGURES, ABOUT, SITE } from './content.js';
import { buildStation, glow } from './station.js';
import { buildTankStructure } from './tank.js';
import { initProcessExplainer } from './process.js';
import { initMap } from './map.js';

// ---------------------------------------------------------------- settings
const VE = 3;                     // vertical exaggeration of the terrain
const PIPE_R = .25;               // pipe radius at close range; widened with distance so it stays visible
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 820px)').matches;
const qs = new URLSearchParams(location.search);
const state = { part: null, mode: null, soc: .4, tankLayout: qs.get('tanks') === '3' ? 'three' : 'single', survey: false, cycle: null };

const loaderFill = document.getElementById('loader-fill');
const loaderText = document.getElementById('loader-text');
const progress = (p, t) => { loaderFill.style.width = `${p}%`; if (t) loaderText.textContent = t; };

// ---------------------------------------------------------------- renderer, scene, camera
const host = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.5 : 2));
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
progress(10, 'Loading the seabed…');
const geo = await fetch('data/geo.json').then((r) => r.json());
const G = geo.grid;
const H = new Int16Array(await fetch('data/terrain.bin').then((r) => r.arrayBuffer()));
progress(35, 'Building the terrain…');

function heightAt(x, z) {
  const fx = (x - G.x0) / G.res, fz = (z - G.y0) / G.res;
  const i = Math.max(0, Math.min(G.nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(G.ny - 2, Math.floor(fz)));
  const u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fz - j));
  const h = (a, b) => H[b * G.nx + a] / 10;
  return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
}
const yAt = (x, z) => heightAt(x, z) * VE;
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
    pos[k * 3] = x; pos[k * 3 + 1] = h * VE; pos[k * 3 + 2] = z; hm[k] = h;
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
const surveyTex = new THREE.TextureLoader().load('assets/img/mbes.png'); surveyTex.colorSpace = THREE.SRGBColorSpace;
const terrainMat = new THREE.ShaderMaterial({
  uniforms: {
    uSat: SAT_HI.tex, uSat2: SAT_LO.tex, uHasHi: { value: 0 }, uHasLo: { value: 0 }, uSurvey: { value: surveyTex }, uSurveyOn: { value: 0 },
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
        float iso = abs(fract(d/10.+.5)-.5)*10.; float w = fwidth(d)*1.2;
        float line = 1.-smoothstep(0., w, iso);
        float major = 1.-smoothstep(0., w*1.4, abs(fract(d/50.+.5)-.5)*50.);
        float lk = (1.-smoothstep(.6, 2.5, w)) * (1.-uUnder*.85);
        c = mix(c, c*.72 + vec3(.06), line*.55*smoothstep(1.,4.,d)*lk);
        c = mix(c, vec3(.93,.96,.97), major*.5*smoothstep(1.,4.,d)*lk);
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
progress(55, 'Placing the pipeline and tanks…');

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
const stationXY = geo.station.xy;
const STATION_ROT = -1.3; // rotate pad so the pipe exit faces the landfall
const station = buildStation();
station.group.position.set(stationXY[0], yAt(stationXY[0], stationXY[1]) + .3, stationXY[1]);
station.group.rotation.y = STATION_ROT;
scene.add(station.group);
station.group.updateMatrixWorld(true);
// replace with the engineering model once it has been exported (set SITE.stationModel in content.js)
if (SITE.stationModel) {
  new GLTFLoader().load(SITE.stationModel, (gltf) => {
    station.group.children.slice().forEach((c) => { if (!Object.values(station.parts).includes(c)) station.group.remove(c); });
    Object.values(station.parts).forEach((p) => { p.visible = false; });
    gltf.scene.traverse((o) => { if (o.isMesh) o.userData.part = 'station'; });
    station.group.add(gltf.scene); state.realStation = true;
  }, undefined, () => {});
}
const stationWorld = (v) => station.group.localToWorld(v.clone());

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
const onshorePts = sampled([[exitW.x, exitW.z], route[0]], 6, .15);
onshorePts[0] = exitW.clone();
const subseaPts = sampled(route);
const allPts = [...onshorePts, ...subseaPts.slice(1)];
const pathCurve = new THREE.CatmullRomCurve3(allPts, false, 'centripetal', .1);
const pathLen = pathCurve.getLength();

const pipeMat = new THREE.MeshStandardMaterial({ color: 0x1b2a33, roughness: .5, metalness: .3, emissive: 0x1a8fd1, emissiveIntensity: .55 });
// widen the pipe with distance so the route stays readable from far away
const widen = { value: 0 };
pipeMat.onBeforeCompile = (sh) => { sh.uniforms.uWiden = widen; sh.vertexShader = 'uniform float uWiden;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normal * uWiden;'); };
const onshoreMat = new THREE.MeshStandardMaterial({ color: 0x8a7d62, roughness: .9, emissive: 0x1a8fd1, emissiveIntensity: .25 });
const subseaCurve = new THREE.CatmullRomCurve3(subseaPts, false, 'centripetal', .1);
const pipe = new THREE.Mesh(new THREE.TubeGeometry(subseaCurve, Math.min(4000, subseaPts.length * 2), PIPE_R, 10, false), pipeMat);
pipe.userData.part = 'pipeline'; scene.add(pipe);
const trench = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(onshorePts), onshorePts.length * 2, .45, 8, false), onshoreMat);
trench.userData.part = 'landfall'; scene.add(trench);
// always-visible route line (1 px) for far views
const routeLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(allPts.map((p) => p.clone().setY(p.y + PIPE_R * 1.6))),
  new THREE.LineBasicMaterial({ color: 0x7fd0f5, transparent: true, opacity: .85 }));
scene.add(routeLine);

// air "flow" particles along the whole path
const FLOW_N = 520;
const flowGeo = new THREE.BufferGeometry(); flowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FLOW_N * 3), 3));
const flowMat = new THREE.PointsMaterial({ color: 0xffffff, size: 5, sizeAttenuation: false, transparent: true, opacity: .95, depthTest: true });
const flow = new THREE.Points(flowGeo, flowMat); flow.visible = false; flow.frustumCulled = false; scene.add(flow);
const flowT = new Float32Array(FLOW_N).map((_, i) => i / FLOW_N);

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
    const j = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(pts[0], pts[1]), 8, .5, 8, false), pipeMat); tankGroups.three.add(j);
  });
  const man = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), new THREE.MeshStandardMaterial({ color: 0xc27a4e, metalness: .5, roughness: .4 }));
  man.position.copy(tankSite).setY(tankSite.y + 1); tankGroups.three.add(man);
  scene.add(tankGroups.single, tankGroups.three);
}
// seawater pushed out of / drawn into the open tube bottoms
const WX_N = 160;
const wxGeo = new THREE.BufferGeometry(); wxGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WX_N * 3), 3));
const wx = new THREE.Points(wxGeo, new THREE.PointsMaterial({ color: 0x9fdcf5, size: 3.5, sizeAttenuation: false, transparent: true, opacity: .8 }));
wx.visible = false; wx.frustumCulled = false; scene.add(wx);
const wxSeed = Array.from({ length: WX_N }, () => ({ a: Math.random() * Math.PI * 2, t: Math.random(), h: Math.random() }));
function updateWater(dt, dir) {
  const set = tankSets[state.tankLayout]; const arr = wxGeo.attributes.position.array;
  wxSeed.forEach((p, i) => {
    p.t = (p.t + dt * .25) % 1; const k = dir > 0 ? p.t : 1 - p.t;
    const g = set[i % set.length].group.position; const r = 6.5 + k * 9;
    arr[i * 3] = g.x + Math.cos(p.a) * r; arr[i * 3 + 1] = g.y + 1.2 + p.h * 1.5 + k * 1.5; arr[i * 3 + 2] = g.z + Math.sin(p.a) * r;
  });
  wxGeo.attributes.position.needsUpdate = true;
}
function setTankLayout(l) {
  state.tankLayout = l; tankGroups.single.visible = l === 'single'; tankGroups.three.visible = l === 'three';
  applyFill();
}
function applyFill() { const xr = !!state.mode || state.part === 'tanks'; tankSets[state.tankLayout].forEach((t) => { t.setXray(xr); t.setFill(state.soc); }); }

// ---------------------------------------------------------------- labels
const labels = [];
function pin(text, pos, partId, { small = false, num = '' } = {}) {
  const d = document.createElement('button'); d.type = 'button'; d.className = 'pin' + (small ? ' small' : '');
  d.innerHTML = `<i>${num}</i><span>${text}</span>`;
  d.addEventListener('click', (e) => { e.stopPropagation(); partId.startsWith('station:') ? openStationPart(partId.split(':')[1]) : openPart(partId); });
  const o = new CSS2DObject(d); o.position.copy(pos); scene.add(o); labels.push({ o, d, partId, small });
  return o;
}
const railIndex = (id) => PARTS.findIndex((p) => p.id === id);
const stationTop = station.group.position.clone().add(new THREE.Vector3(0, 22, -40));
pin('Shore station', stationTop, 'station', { num: railIndex('station') });
const lf = subseaPts[0].clone(); lf.y += 18; pin('Landfall', lf, 'landfall', { num: railIndex('landfall') });
const mid = subseaPts[Math.floor(subseaPts.length * .45)].clone(); mid.y += 40; pin('Subsea pipeline', mid, 'pipeline', { num: railIndex('pipeline') });
const tankPinPos = tankSite.clone().add(new THREE.Vector3(0, 40, 0)); pin('Storage tanks', tankPinPos, 'tanks', { num: railIndex('tanks') });
Object.entries(station.anchors).forEach(([k, a]) => pin(STATION_PARTS[k].title, stationWorld(a), 'station:' + k, { small: true, num: '' }));

// ---------------------------------------------------------------- camera views
const VIEWS = {
  overview: () => { const k = camera.aspect < 1 ? 1.9 : 1; const t = new THREE.Vector3(1450, -150, 2350); return { target: t, pos: t.clone().add(new THREE.Vector3(-2950, 4450, 4550).multiplyScalar(k)) }; },
  station: () => { const p = station.group.position; return { target: p.clone().add(new THREE.Vector3(0, 2, 0)), pos: p.clone().add(new THREE.Vector3(-38, 30, 52)) }; },
  landfall: () => { const p = subseaPts[0]; return { target: p.clone().add(new THREE.Vector3(30, 0, -60)), pos: p.clone().add(new THREE.Vector3(-260, 170, 230)) }; },
  pipeline: () => { const p = subseaPts[Math.floor(subseaPts.length * .5)]; return { target: p.clone(), pos: p.clone().add(new THREE.Vector3(-1900, 1200, 1300)) }; },
  tanks: () => { const p = (state.tankLayout === 'three' ? tankSite : tankSets.single[0].group.position).clone().add(new THREE.Vector3(0, 6, 0)); const r = (state.tankLayout === 'three' ? 2.6 : 1) * (camera.aspect < 1 ? 1.7 : 1); return { target: p, pos: p.clone().add(new THREE.Vector3(-26 * r, 16 * r, 30 * r)) }; },
  seabed: () => { const t = new THREE.Vector3(2300, -200, 2900); return { target: t, pos: t.clone().add(new THREE.Vector3(-2600, 3300, 2700).multiplyScalar(camera.aspect < 1 ? 1.7 : 1)) }; },
};
let fly = null;
function flyTo(v, dur = 1.8) {
  const end = VIEWS[v] ? VIEWS[v]() : v;
  if (REDUCED) { camera.position.copy(end.pos); controls.target.copy(end.target); return; }
  fly = { t: 0, dur, p0: camera.position.clone(), t0: controls.target.clone(), p1: end.pos, t1: end.target };
}
const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ---------------------------------------------------------------- UI: rail and panel
const rail = document.getElementById('rail');
rail.innerHTML = `<h2>Follow the air</h2><ol>${PARTS.map((p, i) => `<li><button type="button" data-part="${p.id}"><span class="dot">${i === 0 ? '◎' : i}</span><span>${p.rail}</span></button></li>`).join('')}</ol>`;
rail.addEventListener('click', (e) => { const b = e.target.closest('[data-part]'); if (b) openPart(b.dataset.part); });
document.querySelector('.brand').addEventListener('click', (e) => { e.preventDefault(); openPart('overview'); });

const panel = document.getElementById('panel'); const pbody = document.getElementById('panel-body');
document.getElementById('panel-close').addEventListener('click', closePanel);
function closePanel() { panel.classList.add('hidden'); document.body.classList.remove('panel-open'); setOffset(); }
function showPanel() { panel.classList.remove('hidden'); document.body.classList.add('panel-open'); pbody.scrollTop = 0; setOffset(); }
// shift the 3D view so the subject is centred in the space left free by the rail and the panel
function setOffset() {
  const desk = innerWidth > 820; const open = !panel.classList.contains('hidden');
  const shift = desk ? (open ? (panel.offsetWidth + 64) / 2 - 120 : -110) : 0;
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
  rail.querySelectorAll('[data-part]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.part === id)));
  labels.forEach((l) => l.d.classList.toggle('active', l.partId === id));
  let h = `<h2>${p.title}</h2><p class="lead">${p.lead}</p>`;
  if (p.figures) h += `<div class="figures">${KEY_FIGURES.map((f) => `<div><b>${f.value}<small>${f.unit}</small></b><span>${f.label}</span></div>`).join('')}</div>`;
  h += p.body.map((t) => `<p>${t}</p>`).join('');
  if (p.stats) h += `<dl class="stats">${p.stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  if (p.tankToggle) h += `<p style="margin-bottom:2px"><b>Show</b></p><div class="seg-inline" id="tank-layout"><button type="button" data-l="single" aria-pressed="${state.tankLayout === 'single'}">One structure</button><button type="button" data-l="three" aria-pressed="${state.tankLayout === 'three'}">Three structures</button></div><p class="note">The drawings show one 14-tube structure (~700 m³). The site plan marks three positions; the final arrangement is still being confirmed.</p>`;
  if (p.surveyToggle) h += `<label class="switch"><input type="checkbox" id="survey-toggle" ${state.survey ? 'checked' : ''}> Show the multibeam survey map</label>`;
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
  pbody.innerHTML = `<p style="margin:0 0 6px"><button type="button" class="btn ghost small" data-back style="background:#fff;color:var(--ink);border-color:var(--line)">Shore station</button></p><h2>${s.title}</h2><p class="lead">${s.text}</p>
    <div class="chips">${Object.keys(STATION_PARTS).map((c) => `<button type="button" data-sub="${c}" aria-pressed="${c === k}">${STATION_PARTS[c].title}</button>`).join('')}</div>
    <p class="note">Simplified layout. Equipment positions follow the design render, not the final engineering model.</p>`;
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
  pbody.querySelector('#survey-toggle')?.addEventListener('change', (e) => { state.survey = e.target.checked; terrainMat.uniforms.uSurveyOn.value = state.survey ? 1 : 0; });
}
const lb = document.getElementById('lightbox');
function lightbox(src, cap) { lb.querySelector('img').src = src; lb.querySelector('img').alt = cap; lb.querySelector('p').textContent = cap; lb.hidden = false; lb.querySelector('button').focus(); }
lb.addEventListener('click', () => { lb.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!lb.hidden) lb.hidden = true; else if (document.getElementById('about').hidden && document.getElementById('how').hidden) closePanel(); } });

// about
const about = document.getElementById('about');
document.getElementById('about-body').innerHTML = `<h2>${ABOUT.title}</h2>${ABOUT.text.map((t) => `<p>${t}</p>`).join('')}<p class="credits">${ABOUT.credits}</p><p class="credits">${SITE.confidential} Depth is exaggerated ×3; the pipe is drawn thicker than it is.</p>`;
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
  flowMat.color.set(state.mode === 'generate' ? 0x8ff5e6 : 0xffffff);
  applyFill();
  if (focus && state.mode && !['tanks', 'station'].includes(state.part)) { openPart('tanks'); }
}
segBtns.forEach((b) => b.addEventListener('click', () => { state.cycle = null; setMode(b.dataset.mode); }));
const cycleBtn = document.getElementById('btn-cycle');
cycleBtn.addEventListener('click', () => {
  if (state.cycle) { state.cycle = null; cycleBtn.textContent = 'Play full cycle'; setMode(null); return; }
  state.cycle = { phase: 'charge', t: 0 }; cycleBtn.textContent = 'Stop'; state.soc = Math.min(state.soc, .2);
  state.mode = null; setMode('charge');
});
function updateCycle(dt) {
  const c = state.cycle; if (!c) return; c.t += dt;
  if (c.phase === 'charge' && state.soc >= .97) { c.phase = 'hold'; c.t = 0; state.mode = null; setMode('hold', { focus: false }); }
  else if (c.phase === 'hold' && c.t > 4) { c.phase = 'generate'; c.t = 0; state.mode = null; setMode('generate', { focus: false }); }
  else if (c.phase === 'generate' && state.soc <= .12) { state.cycle = null; cycleBtn.textContent = 'Play full cycle'; state.mode = 'hold'; setMode('hold', { focus: false }); }
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

// ---------------------------------------------------------------- gauge
const gMark = document.getElementById('gauge-mark'), gDepth = document.getElementById('g-depth'), gPress = document.getElementById('g-press');
let gaugeLast = 0;
function updateGauge(now) {
  if (now - gaugeLast < 120) return; gaugeLast = now;
  const t = controls.target; const ground = heightAt(t.x, t.z);
  const depth = Math.max(0, -Math.min(t.y / VE, ground < 0 ? ground : 0));
  gMark.style.top = `${Math.min(100, depth / 110 * 100)}%`;
  gDepth.textContent = depth < .5 ? 'Land' : `${Math.round(depth)} m`;
  gPress.textContent = `${(1.013 + depth * .1005).toFixed(1)} bar`;
  const [lat, lon] = toLL(t.x, t.z); mapApi.setFocus(lat, lon);
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
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
  terrainMat.uniforms.uTime.value = time; seaMat.uniforms.uTime.value = time; seaMat.uniforms.uUnder.value = under;
  skyMat.uniforms.uUnder.value = under;
  terrainMat.uniforms.uFogColor.value.set(under ? 0x0b3d55 : 0xcfe3ea); terrainMat.uniforms.uUnder.value = under;
  terrainMat.uniforms.uFogDensity.value = under ? .0016 : .000035;
  scene.fog = under ? new THREE.FogExp2(0x0b3d55, .0016 / 1.2) : null;
  hemi.intensity = under ? .8 : 1.1;

  // process simulation
  updateCycle(dt);
  const rate = 1 / 22;
  if (state.mode === 'charge') state.soc = Math.min(1, state.soc + dt * rate);
  if (state.mode === 'generate') state.soc = Math.max(.05, state.soc - dt * rate);
  if (state.mode === 'charge' && state.soc >= 1 && !state.cycle) setMode('hold', { focus: false });
  if (state.mode) tankSets[state.tankLayout].forEach((t) => t.setFill(state.soc));
  socFill.style.width = `${Math.round(state.soc * 100)}%`; socLabel.textContent = `Tanks ${Math.round(state.soc * 100)}% full`;
  glow(station.parts.compressor, 0xe9973a, state.mode === 'charge' ? .35 + .25 * Math.sin(time * 4) : 0);
  glow(station.parts.teg, 0x3fc7b5, state.mode === 'generate' ? .35 + .25 * Math.sin(time * 4) : 0);
  glow(station.parts.tes, state.mode === 'generate' ? 0x3fc7b5 : 0xe9973a, state.mode === 'charge' || state.mode === 'generate' ? .25 + .15 * Math.sin(time * 3) : 0);

  wx.visible = flow.visible && dist < 400;
  if (wx.visible) updateWater(dt, state.mode === 'charge' ? 1 : -1);
  if (flow.visible) {
    const arr = flowGeo.attributes.position.array; const dir = state.mode === 'charge' ? 1 : -1; const speed = 220 / pathLen;
    for (let i = 0; i < FLOW_N; i++) {
      flowT[i] = (flowT[i] + dir * dt * speed + 1) % 1;
      pathCurve.getPointAt(flowT[i], tmp); arr[i * 3] = tmp.x; arr[i * 3 + 1] = tmp.y + PIPE_R * 1.3; arr[i * 3 + 2] = tmp.z;
    }
    flowGeo.attributes.position.needsUpdate = true;
    flowMat.size = dist < 200 ? 7 : 4.5;
  }

  // labels: station sub-parts only when close; main pins hide when very close to their own part
  const dStation = camera.position.distanceTo(station.group.position);
  labels.forEach((l) => {
    let vis = true;
    if (l.small) vis = dStation < 140;
    else if (l.partId === 'station') vis = dStation > 90;
    else if (l.partId === 'landfall') vis = dStation > 90 && camera.position.distanceTo(l.o.position) < 3200;
    else vis = camera.position.distanceTo(l.o.position) > 60;
    l.o.visible = vis;
  });
  routeLine.material.opacity = Math.min(.6, Math.max(0, (dist - 300) / 1500));
  widen.value = Math.max(0, Math.min(60, dist * .0038 - PIPE_R));

  renderer.render(scene, camera); labelRenderer.render(scene, camera);
  updateGauge(performance.now());
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
window.__pilot = { state, flyTo, openPart, setMode, camera, controls };
