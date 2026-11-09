// Shore station, from the engineering model (BAROMAR 3D model FBX, Nov 2026), lightly simplified:
// meshes are merged by system (air, hot water, cooling water, structure) and by main equipment item,
// and decimated so the page stays light. Converted once to assets/models/shore_station.glb
// (metres, Y up, origin at the centre of the pad top). data/station.json holds the label anchors,
// the pipe exit and the flow paths traced along the model's own pipe lines.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildRooms } from './buildings.js';
import { UI } from './content.js';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .65, metalness: .15, flatShading: true, ...o });
// colour code used across the site: white air, red hot water, blue cooling water, yellow electricity
const MATS = {
  pad: M(0xcfc9bb, { roughness: .95, flatShading: false }),
  structure: M(0xa3abb0, { metalness: .4 }), supports: M(0xb4babd, { metalness: .4 }),
  pipe_air: M(0xf2f4f6, { roughness: .45 }), valves_air: M(0xf2f4f6),
  pipe_hot: M(0xd8452b), pipe_cool: M(0x4a90d0), valves_cool: M(0x4a90d0), pipe_misc: M(0x7d858a),
  compressor: M(0x2c4a73, { metalness: .35 }), teg: M(0x2f7a5c, { metalness: .35 }), hx: M(0x3fa7a0, { metalness: .35 }),
  // T2: steel tank in an insulated aluminium jacket; T1: plastic (PP) tank
  hotTank: M(0xd9dcdc, { metalness: .55, roughness: .35, emissive: 0x1c0704 }), coldTank: M(0xe9eef0, { metalness: 0, roughness: .8 }), coolingTower: M(0x4a6fa5),
  dryer: M(0x6b7c8a, { metalness: .35 }), electrical: M(0x8a9095), control: M(0xe6e1d6, { roughness: .8 }), equipOther: M(0x8a9095),
};
// mesh name in the model → part key used by the labels and the info panel
const PART_OF = { compressor: 'compressor', dryer: 'dryer', hx: 'hx', teg: 'teg', hotTank: 'tes', coldTank: 'coldTank', coolingTower: 'cooling', electrical: 'electrical', control: 'control' };
// exploded view: each system lifts to its own level above the equipment
const LIFT = { pipe_cool: 5, valves_cool: 5, pipe_misc: 5, pipe_hot: 10, pipe_air: 15, valves_air: 15, structure: 21, supports: 21 };

export async function buildStation(url, meta) {
  const g = new THREE.Group(); g.name = 'station';
  const parts = {};
  const [W, D] = meta.pad;
  // earthwork platform under the pad, so it sits level on the sloping ground
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + 2, 8, D + 2), new THREE.MeshStandardMaterial({ color: 0xb8a988, roughness: 1 }));
  plinth.position.y = -4.4; plinth.userData.part = 'station'; g.add(plinth);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, .4, D), MATS.pad); slab.position.y = -.2; slab.userData.part = 'station'; g.add(slab);

  const gltf = await new GLTFLoader().loadAsync(url);
  const layers = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const k = o.name;
    if (k === 'pad') { o.visible = false; return; }   // replaced by a clean slab below
    o.material = (MATS[k] || MATS.equipOther).clone();
    const pk = PART_OF[k];
    o.userData.part = pk ? 'station:' + pk : 'station';
    if (pk) parts[pk] = o;
    if (LIFT[k]) layers.push({ o, lift: LIFT[k], y0: o.position.y });   // quantized meshes carry their own offset
  });
  g.add(gltf.scene);
  // roofs, cladding and mesh on the steel frames; tidy electrical room; glazed control room
  const rooms = buildRooms(); g.add(rooms.shell, rooms.inside);
  layers.push({ o: rooms.shell, lift: LIFT.structure, y0: 0 });

  const v = (a) => new THREE.Vector3(...a);
  const anchors = Object.fromEntries(Object.entries(meta.anchors).map(([k, a]) => [k, v(a)]));
  const explodeLabels = [
    { text: UI.explodeStation.air, pos: new THREE.Vector3(-8, LIFT.pipe_air + 2.5, 14) },
    { text: UI.explodeStation.hot, pos: new THREE.Vector3(-8.2, LIFT.pipe_hot + 2.5, -8) },
    { text: UI.explodeStation.cool, pos: new THREE.Vector3(5.5, LIFT.pipe_cool + 3.5, -10) },
    { text: UI.explodeStation.steel, pos: new THREE.Vector3(5, LIFT.structure + 4.6, 2) },
  ];
  return {
    group: g, parts, anchors, exit: v(meta.exit), explodeLabels,
    flows: Object.fromEntries(Object.entries(meta.flows).map(([k, pts]) => [k, pts.map(v)])),
    setExplode(k) { layers.forEach((l) => { l.o.position.y = l.y0 + l.lift * k; }); },
  };
}

// Tint a part to show it is working.
export function glow(obj, color, k) {
  if (!obj) return;
  obj.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.userData.baseEmissive) { o.userData.baseEmissive = o.material.emissive.clone(); }
    o.material.emissive.copy(o.userData.baseEmissive).lerp(new THREE.Color(color), k);
    o.material.emissiveIntensity = 1;
  });
}
