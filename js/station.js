// Simplified shore-station model, laid out after the design render ("On-Shore render 9").
// It is a stand-in until the current engineering model is exported: drop a file at
// assets/models/shore_station.glb (metres, Y up, origin at pad centre) and it is used instead.
// Units are metres; origin is the centre of the pad top surface. +X east, +Z south.
import * as THREE from 'three';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .7, metalness: .1, ...o });
const mats = {
  pad: M(0xcfc9bb, { roughness: .95 }),
  plinth: M(0xb5ad9b, { roughness: 1 }),
  steel: M(0xd9dde0, { metalness: .5, roughness: .4 }),
  roof: M(0xb9bec2, { metalness: .4, roughness: .5, side: THREE.DoubleSide }),
  navy: M(0x1d2c44, { metalness: .4, roughness: .45 }),
  motor: M(0x2f4f7a, { metalness: .5, roughness: .4 }),
  container: M(0xeeeeea, { roughness: .6 }),
  window: M(0x26475c, { metalness: .6, roughness: .2 }),
  blue: M(0x9cb6d6, { metalness: .35, roughness: .35 }),
  copper: M(0xc9967a, { metalness: .55, roughness: .4 }),
  cold: M(0xb9c9cf, { metalness: .5, roughness: .4 }),
  tower: M(0xe8eef2, { roughness: .5 }),
  pipe: M(0xc8ccd0, { metalness: .6, roughness: .35 }),
  rail: M(0xe1e4e6, { metalness: .5, roughness: .4 }),
};

function box(w, h, d, m, x, y, z) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); return o; }
function cyl(r, h, m, x, y, z, seg = 24) { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); o.position.set(x, y + h / 2, z); return o; }
function hpipe(a, b, r, m) {
  const v = new THREE.Vector3().subVectors(b, a); const len = v.length();
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), m);
  o.position.copy(a).addScaledVector(v, .5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); return o;
}

export function buildStation() {
  const g = new THREE.Group(); g.name = 'station';
  const parts = { compressor: new THREE.Group(), tes: new THREE.Group(), teg: new THREE.Group(), cooling: new THREE.Group(), control: new THREE.Group() };
  Object.entries(parts).forEach(([k, p]) => { p.name = k; g.add(p); });

  // pad 26 × 19 m (~500 m²) on a plinth
  g.add(box(26, .6, 19, mats.pad, 0, -.6, 0));
  g.add(box(26.6, 4, 19.6, mats.plinth, 0, -4.6, 0));

  // canopy over the machinery
  const cx0 = -11, cx1 = 3, cz0 = -7.5, cz1 = 3.5, H = 5.6;
  for (const x of [cx0, (cx0 + cx1) / 2, cx1]) for (const z of [cz0, cz1]) g.add(box(.25, H, .25, mats.steel, x, 0, z));
  const roof = box(cx1 - cx0 + 1, .18, cz1 - cz0 + 1, mats.roof, (cx0 + cx1) / 2, H, (cz0 + cz1) / 2);
  roof.userData.roof = true; g.add(roof);

  // compressors: three skids with motors, plus a tall air receiver
  [[-8.5, -4.6], [-5.6, -4.6], [-8.5, -1.2]].forEach(([x, z]) => {
    parts.compressor.add(box(2.4, 1.7, 2.1, mats.navy, x, 0, z));
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, 1.3, 20), mats.motor);
    m.rotation.z = Math.PI / 2; m.position.set(x + .2, 2.1, z); parts.compressor.add(m);
  });
  parts.compressor.add(cyl(1.25, 9.5, mats.blue, 6.2, 0, -1.8, 32));
  parts.compressor.add(cyl(1.32, .2, mats.rail, 6.2, 9.5, -1.8, 32));
  for (let i = 0; i < 6; i++) parts.compressor.add(box(.05, .05, 2.8, mats.rail, 6.2 - 1.4, 1.2 + i * 1.5, -1.8));

  // turboexpander-generator skid (two stages + generator)
  parts.teg.add(box(4.2, .4, 2.4, mats.navy, -2.4, 0, -1.4));
  const v1 = new THREE.Mesh(new THREE.TorusGeometry(.5, .22, 12, 24), mats.steel); v1.position.set(-3.6, 1.15, -1.4); parts.teg.add(v1);
  const v2 = v1.clone(); v2.position.x = -1.2; parts.teg.add(v2);
  const gen = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, 1.6, 24), mats.motor); gen.rotation.z = Math.PI / 2; gen.position.set(-2.4, 1.15, -1.4); parts.teg.add(gen);

  // thermal energy storage: hot and cold water tanks (10 m³ class) beside the canopy
  parts.tes.add(cyl(1.5, 5.2, mats.copper, 8.6, 0, 2.2, 32));
  parts.tes.add(cyl(1.55, .15, mats.steel, 8.6, 5.2, 2.2, 32));
  // heat exchangers under the canopy
  [[-5.4, 1.6], [-3.4, 1.6]].forEach(([x, z]) => { const h = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 2.6, 16), mats.steel); h.rotation.x = Math.PI / 2; h.position.set(x, .9, z); parts.tes.add(h); });

  // cooling: cold-water tank and cooling tower
  parts.cooling.add(cyl(1.4, 4.6, mats.cold, 11.2, 0, -.6, 32));
  parts.cooling.add(box(2.6, 4.2, 2.6, mats.tower, 11.0, 0, 5.6));
  parts.cooling.add(cyl(.9, .5, mats.navy, 11.0, 4.2, 5.6, 20));

  // control container with windows
  parts.control.add(box(2.6, 2.9, 12.2, mats.container, -13.6 + 3.4, 0, 6.2));
  for (let i = 0; i < 3; i++) parts.control.add(box(.06, 1.1, 1.6, mats.window, -11.5, 1.2, 2.2 + i * 3.4));

  // pipe rack to the pipeline exit (south-west corner)
  for (let x = -4; x <= 10; x += 3) { g.add(box(.18, 1.2, .18, mats.rail, x, 0, 8.6)); g.add(box(.18, .1, 1.2, mats.rail, x, 1.2, 8.6)); }
  g.add(hpipe(new THREE.Vector3(-4, 1.4, 8.4), new THREE.Vector3(10.5, 1.4, 8.4), .14, mats.pipe));
  g.add(hpipe(new THREE.Vector3(-4, 1.4, 8.8), new THREE.Vector3(10.5, 1.4, 8.8), .1, mats.pipe));
  g.add(hpipe(new THREE.Vector3(6.2, 2.2, -1.8), new THREE.Vector3(6.2, 2.2, 8.4), .14, mats.pipe));
  g.add(hpipe(new THREE.Vector3(-4, 1.4, 8.4), new THREE.Vector3(-4, 1.4, 1.8), .14, mats.pipe));

  // anchors for labels (local coordinates, above each part)
  const anchors = {
    compressor: new THREE.Vector3(-7, 7.5, -4), teg: new THREE.Vector3(-2.4, 2.6, -1.4), tes: new THREE.Vector3(8.6, 6.5, 2.2),
    cooling: new THREE.Vector3(11.2, 5, -.6), control: new THREE.Vector3(-10.2, 4, 6.2),
  };
  const exit = new THREE.Vector3(10.5, 1.4, 8.4); // where the air line leaves the pad
  Object.entries(parts).forEach(([k, p]) => p.traverse((o) => { if (o.isMesh) o.userData.part = 'station:' + k; }));
  g.traverse((o) => { if (o.isMesh && !o.userData.part) o.userData.part = 'station'; });
  return { group: g, parts, anchors, exit };
}

// Tint a part group to show it is working (charge = heat, generate = power).
export function glow(group, color, k) {
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.userData.baseEmissive) { o.material = o.material.clone(); o.userData.baseEmissive = o.material.emissive.clone(); }
    o.material.emissive.copy(o.userData.baseEmissive).lerp(new THREE.Color(color), k);
    o.material.emissiveIntensity = 1;
  });
}
