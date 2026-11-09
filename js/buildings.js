// Shelters and rooms of the shore station, drawn on top of the engineering model:
// - compressor shelter and electrical room: the steel frames come from the model; here they get
//   a translucent mono-pitch roof, translucent cladding and a mesh band, after the Karipis
//   "COMPRESSOR SHELTER" / "ELECTRICAL ROOM" drawings and the site photos (white sandwich panels);
// - electrical room contents: a tidy line-up of panels (no detailed layout exists yet);
// - control room: a simple glazed room with control desks, in place of the site container.
// Local station coordinates: metres, origin at the pad centre, +x east-ish, -z towards the north end.
import * as THREE from 'three';

const glassy = (color, opacity) => new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: .25, metalness: .1, side: THREE.DoubleSide, depthWrite: false });
const solid = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .7, metalness: .1, ...o });

let meshTex = null;
function meshTexture() {           // a square wire-mesh pattern for the grille bands
  if (meshTex) return meshTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.strokeStyle = 'rgba(235,240,243,1)'; x.lineWidth = 3; x.strokeRect(0, 0, 64, 64);
  meshTex = new THREE.CanvasTexture(c); meshTex.wrapS = meshTex.wrapT = THREE.RepeatWrapping; meshTex.colorSpace = THREE.SRGBColorSpace;
  return meshTex;
}
const MAT = {
  roof: glassy(0xf4f6f7, .32), clad: glassy(0xf7f8f8, .2), trim: solid(0xf2f3f3, { roughness: .5 }),
  glass: glassy(0x9cc8de, .28), mullion: solid(0x39444b, { metalness: .5, roughness: .4 }), wall: solid(0xeeece6, { roughness: .85 }),
  floor: solid(0x5d666c), cabinet: solid(0xd3d6d4, { metalness: .3, roughness: .45 }), cabinetDark: solid(0x47525a, { metalness: .3 }),
  desk: solid(0x2f3a42, { roughness: .5 }), deskTop: solid(0xe6e4df, { roughness: .4 }), chair: solid(0x1f2a33),
  screen: new THREE.MeshStandardMaterial({ color: 0x0b1d2a, emissive: 0x2f8fd0, emissiveIntensity: .55, roughness: .3 }),
  wallScreen: new THREE.MeshStandardMaterial({ color: 0x0b1d2a, emissive: 0x1a8fd1, emissiveIntensity: .45, roughness: .3 }),
  ledG: new THREE.MeshBasicMaterial({ color: 0x3fdc7a }), ledY: new THREE.MeshBasicMaterial({ color: 0xffd23f }),
};
function grilleMat(w, h) { const m = glassy(0xffffff, .55); m.map = meshTexture().clone(); m.map.needsUpdate = true; m.map.repeat.set(w / .45, h / .45); m.alphaTest = .05; m.opacity = .7; return m; }

const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); return o; };
// a quad in a vertical plane between two plan points, from y0 to y1a at a and y1b at b
function wallQuad(a, b, y0, y1a, y1b, mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([a[0], y0, a[1], b[0], y0, b[1], b[0], y1b, b[1], a[0], y1a, a[1]], 3));
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
  const m = mat === 'grille' ? grilleMat(L, Math.max(y1a, y1b) - y0) : mat;
  return new THREE.Mesh(g, m);
}

// Mono-pitch shelter over an existing frame: roof from height hW (x0 side) to hE (x1 side).
// open: which sides have a mesh band above the cladding (the rest is clad to the roof).
function shelter({ x0, x1, z0, z1, hW, hE, cladTo = 2.4, open = ['n', 's', 'e', 'w'] }) {
  const g = new THREE.Group(); const o = .3;
  const h = (x) => hW + (hE - hW) * (x - x0) / (x1 - x0);
  // roof slab (translucent) with a solid edge trim
  const rg = new THREE.BufferGeometry(); const X0 = x0 - o, X1 = x1 + o;
  rg.setAttribute('position', new THREE.Float32BufferAttribute([X0, h(X0) + .12, z0 - o, X1, h(X1) + .12, z0 - o, X1, h(X1) + .12, z1 + o, X0, h(X0) + .12, z1 + o], 3));
  rg.setIndex([0, 2, 1, 0, 3, 2]); rg.computeVertexNormals(); g.add(new THREE.Mesh(rg, MAT.roof));
  [[X0, z0 - o, X1, z0 - o], [X0, z1 + o, X1, z1 + o]].forEach(([a, za, b, zb]) => {
    const L = Math.hypot(b - a, zb - za); const m = new THREE.Mesh(new THREE.BoxGeometry(L, .14, .08), MAT.trim);
    m.position.set((a + b) / 2, (h(a) + h(b)) / 2 + .12, za); m.rotation.z = Math.atan2(h(b) - h(a), b - a); g.add(m);
  });
  [[X0, z0 - o, X0, z1 + o], [X1, z0 - o, X1, z1 + o]].forEach(([a, za, , zb]) => { const m = box(.08, .14, zb - za, MAT.trim, a, h(a) + .05, (za + zb) / 2); g.add(m); });
  // walls: translucent cladding up to cladTo, then mesh (open sides) or cladding (closed sides) to the roof
  const sides = { n: [[x0, z0], [x1, z0]], s: [[x1, z1], [x0, z1]], e: [[x1, z0], [x1, z1]], w: [[x0, z1], [x0, z0]] };
  for (const [k, [a, b]] of Object.entries(sides)) {
    g.add(wallQuad(a, b, 0, cladTo, cladTo, MAT.clad));
    g.add(wallQuad(a, b, cladTo, h(a[0]), h(b[0]), open.includes(k) ? 'grille' : MAT.clad));
  }
  g.traverse((m) => { if (m.isMesh) { m.userData.part = 'station'; m.renderOrder = 3; } });
  return g;
}

// Electrical room line-up: low-voltage panels along the north wall, control and UPS along the south wall.
function electricalRoom({ x0, x1, z0, z1 }) {
  const g = new THREE.Group(); const cw = .8, cd = .6, ch = 2.1;
  const row = (n, z, face) => {
    const span = n * cw + (n - 1) * .04; let x = (x0 + x1) / 2 - span / 2 + cw / 2;
    for (let i = 0; i < n; i++, x += cw + .04) {
      const c = box(cw, ch, cd, MAT.cabinet, x, .1, z); g.add(c);
      g.add(box(cw, .1, cd + .02, MAT.cabinetDark, x, 0, z));                       // plinth
      g.add(box(cw - .12, .02, .01, MAT.cabinetDark, x, 1.95, z + face * (cd / 2 + .006)));   // door top line
      g.add(box(.012, ch - .3, .01, MAT.cabinetDark, x, .25, z + face * (cd / 2 + .006)));    // door split
      [-.2, 0, .2].forEach((dx, k) => g.add(box(.05, .05, .01, k === 1 ? MAT.ledY : MAT.ledG, x + dx, 1.7, z + face * (cd / 2 + .01))));
    }
  };
  row(5, z0 + .35 + cd / 2, 1);
  row(4, z1 - .35 - cd / 2, -1);
  g.add(box(x1 - x0 - .2, .05, z1 - z0 - .2, MAT.floor, (x0 + x1) / 2, 0, (z0 + z1) / 2));
  g.traverse((m) => { if (m.isMesh) m.userData.part = 'station:electrical'; });
  return g;
}

// Control room: two solid walls, two glass walls, a video wall and two desks with screens.
function controlRoom({ x0, x1, z0, z1, h = 3.2 }) {
  const g = new THREE.Group(); const t = .15;
  g.add(box(x1 - x0 + .3, .25, z1 - z0 + .3, MAT.floor, (x0 + x1) / 2, -.05, (z0 + z1) / 2));
  // solid walls: south and east
  g.add(box(x1 - x0, h, t, MAT.wall, (x0 + x1) / 2, .2, z1 - t / 2));
  g.add(box(t, h, z1 - z0, MAT.wall, x1 - t / 2, .2, (z0 + z1) / 2));
  // glass walls with mullions: north and west
  const glassWall = (a, b) => {
    g.add(wallQuad(a, b, .2, h + .2, h + .2, MAT.glass));
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.round(L / 1.2);
    for (let i = 0; i <= n; i++) { const k = i / n; g.add(box(.07, h, .07, MAT.mullion, a[0] + (b[0] - a[0]) * k, .2, a[1] + (b[1] - a[1]) * k)); }
    const mid = box(Math.abs(b[0] - a[0]) || .05, .06, Math.abs(b[1] - a[1]) || .05, MAT.mullion, (a[0] + b[0]) / 2, 1.1, (a[1] + b[1]) / 2); g.add(mid);
  };
  glassWall([x0, z0], [x1, z0]); glassWall([x0, z1], [x0, z0]);
  // roof: translucent, with a solid fascia
  g.add(box(x1 - x0 + .5, .1, z1 - z0 + .5, MAT.roof, (x0 + x1) / 2, h + .2, (z0 + z1) / 2));
  g.add(box(x1 - x0 + .5, .3, .08, MAT.trim, (x0 + x1) / 2, h + .05, z0 - .25));
  g.add(box(.08, .3, z1 - z0 + .5, MAT.trim, x0 - .25, h + .05, (z0 + z1) / 2));
  // video wall on the east wall
  g.add(box(.05, 1.1, 2.8, MAT.wallScreen, x1 - t - .03, 1.25, (z0 + z1) / 2));
  // two desks facing the video wall, three screens each
  [(z0 + z1) / 2 - 1.1, (z0 + z1) / 2 + 1.1].forEach((zc) => {
    const xd = x0 + (x1 - x0) * .45;
    g.add(box(.75, .72, 1.8, MAT.desk, xd, .2, zc)); g.add(box(.85, .04, 1.9, MAT.deskTop, xd, .92, zc));
    [-.6, 0, .6].forEach((dz, i) => { const s = box(.04, .42, .55, MAT.screen, xd + .22, 1.02, zc + dz); s.rotation.y = (i - 1) * -.25; g.add(s); });
    g.add(box(.5, .5, .5, MAT.chair, xd - .75, .2, zc)); g.add(box(.08, .55, .5, MAT.chair, xd - 1.0, .7, zc));
  });
  g.traverse((m) => { if (m.isMesh) { m.userData.part = 'station:control'; if (m.material.transparent) m.renderOrder = 3; } });
  return g;
}

export const ROOMS = {
  compressorShelter: { x0: -2.44, x1: 4.94, z0: -4.46, z1: 7.42, hW: 3.51, hE: 3.81, open: ['n', 's', 'e', 'w'] },
  electricalRoom: { x0: -6.06, x1: -1.56, z0: 8.05, z1: 13.55, hW: 3.81, hE: 3.61, open: ['e'] },
  controlRoom: { x0: 2.2, x1: 7.9, z0: 8.6, z1: 14.3 },
};

// roofs and cladding (lift with the steel structure in the exploded view) and the room contents (stay)
export function buildRooms() {
  const shell = new THREE.Group(); const inside = new THREE.Group();
  shell.add(shelter(ROOMS.compressorShelter));
  shell.add(shelter({ ...ROOMS.electricalRoom, cladTo: 2.6 }));
  inside.add(electricalRoom(ROOMS.electricalRoom));
  inside.add(controlRoom(ROOMS.controlRoom));
  return { shell, inside };
}
