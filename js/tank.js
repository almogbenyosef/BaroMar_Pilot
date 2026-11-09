// Underwater storage structure, after Leonardo Stadler drawings BAROMAR-C-01..C-05 (Rev.05) and the
// "Gabion reef" renders: an octagonal concrete slab (14.3 × 13.37 m), 14 steel tubes Ø2.5 m × 10.4 m at
// 3.5 m centres, rock-filled gabion cages closing the gaps between the outer tubes, and a rock core in
// the middle of the cluster. Units are metres; origin is the centre of the slab underside.
import * as THREE from 'three';
import { UI } from './content.js';

const SLAB_W = 14.3, SLAB_D = 13.37, SLAB_T = 0.8;
const CUT_X = 3.65, CUT_Z = 4.02;
const TUBE_R = 1.25, TUBE_H = 10.4;
const ROW_Z = [-4.78, -1.75, 1.75, 4.78];
const ROWS = [[-3.5, 0, 3.5], [-5.25, -1.75, 1.75, 5.25], [-5.25, -1.75, 1.75, 5.25], [-3.5, 0, 3.5]];

const mat = {
  concrete: new THREE.MeshStandardMaterial({ color: 0x8f8d84, roughness: .95 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x9aa3a8, roughness: .45, metalness: .55, transparent: true, opacity: 1 }),
  cap: new THREE.MeshStandardMaterial({ color: 0xa9b1b5, roughness: .4, metalness: .6, transparent: true, opacity: 1 }),
  pipe: new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: .5, metalness: .2 }),
  mesh: new THREE.MeshStandardMaterial({ color: 0x8c9296, roughness: .6, metalness: .7, wireframe: true, transparent: true, opacity: .75 }),
  rock: new THREE.MeshStandardMaterial({ color: 0x7d7262, roughness: 1, flatShading: true }),
  air: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xcfeaff, emissiveIntensity: .55, transparent: true, opacity: .85, roughness: .3 }),
  line: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .95 }),
  water: new THREE.MeshStandardMaterial({ color: 0x0b3f8f, emissive: 0x06245a, emissiveIntensity: .35, transparent: true, opacity: .7, roughness: .2 }),
};

function octagon() {
  const hw = SLAB_W / 2, hd = SLAB_D / 2;
  const s = new THREE.Shape();
  s.moveTo(-hw + CUT_X, -hd); s.lineTo(hw - CUT_X, -hd); s.lineTo(hw, -hd + CUT_Z); s.lineTo(hw, hd - CUT_Z);
  s.lineTo(hw - CUT_X, hd); s.lineTo(-hw + CUT_X, hd); s.lineTo(-hw, hd - CUT_Z); s.lineTo(-hw, -hd + CUT_Z); s.closePath();
  return s;
}

// tube centres, and the outer ring in order around the structure
const CENTRES = []; ROW_Z.forEach((z, r) => ROWS[r].forEach((x) => CENTRES.push([x, z])));
const ring = CENTRES.filter(([x, z]) => !(Math.abs(x) === 1.75 && Math.abs(z) === 1.75))
  .sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
const inner = CENTRES.filter(([x, z]) => Math.abs(x) === 1.75 && Math.abs(z) === 1.75);

const rockGeo = new THREE.DodecahedronGeometry(.36, 0);
const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();

export function buildTankStructure({ detail = 1 } = {}) {
  const g = new THREE.Group(); g.name = 'tank-structure';

  const slabGeo = new THREE.ExtrudeGeometry(octagon(), { depth: SLAB_T + 3, bevelEnabled: false });
  slabGeo.rotateX(Math.PI / 2); slabGeo.translate(0, SLAB_T, 0);
  const slab = new THREE.Mesh(slabGeo, mat.concrete); slab.userData.part = 'tanks'; g.add(slab);

  // exploded view: every component lives in its own group so it can be moved apart
  const tubesG = new THREE.Group(), cagesG = new THREE.Group(), coreG = new THREE.Group(), manG = new THREE.Group();
  g.add(tubesG, cagesG, coreG, manG);
  const slabG = slab;

  const tubes = [];
  const tubeGeo = new THREE.CylinderGeometry(TUBE_R, TUBE_R, TUBE_H, 36, 1, true);
  const capGeo = new THREE.CylinderGeometry(TUBE_R + .03, TUBE_R + .03, .14, 36);
  const ribGeo = new THREE.TorusGeometry(TUBE_R + .02, .035, 5, 36);
  const innerGeo = new THREE.CylinderGeometry(TUBE_R - .06, TUBE_R - .06, 1, 28);
  const lineGeo = new THREE.CylinderGeometry(TUBE_R - .04, TUBE_R - .04, .06, 28);
  CENTRES.forEach(([x, z]) => {
    const t = new THREE.Group(); t.position.set(x, SLAB_T, z); t.userData.home = t.position.clone();
    const shell = new THREE.Mesh(tubeGeo, mat.steel); shell.position.y = TUBE_H / 2; shell.userData.part = 'tanks';
    const cap = new THREE.Mesh(capGeo, mat.cap); cap.position.y = TUBE_H; cap.userData.part = 'tanks';
    t.add(shell, cap);
    [.12, TUBE_H - .1].forEach((y) => { const r = new THREE.Mesh(ribGeo, mat.cap); r.rotation.x = Math.PI / 2; r.position.y = y; t.add(r); });
    const air = new THREE.Mesh(innerGeo, mat.air); const water = new THREE.Mesh(innerGeo, mat.water);
    const line = new THREE.Mesh(lineGeo, mat.line);
    air.visible = water.visible = line.visible = false; t.add(air, water, line);
    tubesG.add(t); tubes.push({ air, water, line, group: t });
  });

  // rocks: one instanced mesh per gabion cage (so each cage can move out on its own) and one for the core
  const insideTube = (x, z) => CENTRES.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < TUBE_R + .25);
  const cageH = TUBE_H - .4, step = .62 / detail;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), e = new THREE.Euler();
  const rockMeshes = [];
  const instRocks = (list) => {
    const im = new THREE.InstancedMesh(rockGeo, mat.rock, list.length);
    list.forEach(([x, y, z], i) => {
      e.set(rnd() * 3, rnd() * 3, rnd() * 3); q.setFromEuler(e); const s = .75 + rnd() * .6; sc.set(s, s * (.7 + rnd() * .4), s);
      m4.compose(new THREE.Vector3(x, y, z), q, sc); im.setMatrixAt(i, m4);
    });
    im.userData.part = 'tanks'; rockMeshes.push(im); return im;
  };
  const cages = [];
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const out = Math.hypot(mx, mz) || 1; const ox = mx / out, oz = mz / out;
    const cg = new THREE.Group(); cg.userData.dir = new THREE.Vector3(ox, 0, oz);
    const cage = new THREE.Mesh(new THREE.BoxGeometry(len - .6, cageH, 1.1, 3, 10, 2), mat.mesh);
    cage.position.set(mx + ox * .55, SLAB_T + cageH / 2, mz + oz * .55); cage.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    cage.userData.part = 'tanks'; cg.add(cage);
    const rocks = [];
    for (let y = .4; y < cageH; y += step) for (let k = -1; k <= 1; k++) {
      const t = .5 + k * .28 + (rnd() - .5) * .1, x = a[0] + (b[0] - a[0]) * t + ox * (.4 + rnd() * .4), z = a[1] + (b[1] - a[1]) * t + oz * (.4 + rnd() * .4);
      if (!insideTube(x, z)) rocks.push([x, SLAB_T + y, z]);
    }
    cg.add(instRocks(rocks)); cagesG.add(cg); cages.push(cg);
  });
  const core = [];
  for (let y = .4; y < cageH - .3; y += step) for (let x = -4.6; x <= 4.6; x += step) for (let z = -4.2; z <= 4.2; z += step) {
    const jx = x + (rnd() - .5) * .3, jz = z + (rnd() - .5) * .3;
    const r = Math.hypot(jx, jz); if (r > 4.9 || insideTube(jx, jz)) continue;
    // keep only the core between the tubes, not the cage zone
    if (ring.some(([cx, cz]) => Math.hypot(jx - cx, jz - cz) < TUBE_R + .25) ) continue;
    core.push([jx, SLAB_T + y, jz]);
  }
  coreG.add(instRocks(core));

  // air manifold: header across the tube tops, down the west side to the pipeline connection
  const pr = .11, yTop = SLAB_T + TUBE_H + .3;
  const addPipe = (a, b, parent = manG) => {
    const v = new THREE.Vector3().subVectors(b, a); const len = v.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, len, 8), mat.pipe);
    m.position.copy(a).addScaledVector(v, .5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
    m.userData.part = 'tanks'; parent.add(m);
  };
  const xW = -7.3;
  ROW_Z.forEach((z, r) => {
    const xs = ROWS[r];
    addPipe(new THREE.Vector3(xs[xs.length - 1], yTop, z), new THREE.Vector3(xW, yTop, z));
    xs.forEach((x) => addPipe(new THREE.Vector3(x, SLAB_T + TUBE_H, z), new THREE.Vector3(x, yTop, z)));
  });
  addPipe(new THREE.Vector3(xW, yTop, ROW_Z[0]), new THREE.Vector3(xW, yTop, ROW_Z[3]));
  // the riser down to the seabed connection stays with the slab so the pipeline still meets it
  const riserG = new THREE.Group(); g.add(riserG);
  addPipe(new THREE.Vector3(xW, yTop, 0), new THREE.Vector3(xW, SLAB_T + .3, 0), riserG);
  addPipe(new THREE.Vector3(xW, SLAB_T + .3, 0), new THREE.Vector3(-SLAB_W / 2 - 1.4, SLAB_T + .3, 0), riserG);

  // where to put the labels of the exploded view (local coordinates, at full explosion)
  const EX = { slab: 0, core: 3.5, tubes: 14, tubeSpread: .55, cages: 7.5, cageUp: 3.5, man: 22 };
  const explodeLabels = [
    { key: 'man', text: UI.explodeTank.manifold, pos: new THREE.Vector3(0, yTop + EX.man + 1.2, 0) },
    { key: 'tubes', text: UI.explodeTank.tubes, pos: new THREE.Vector3(0, SLAB_T + TUBE_H + EX.tubes + 1, -ROW_Z[3] * (1 + EX.tubeSpread) - 1) },
    { key: 'cages', text: UI.explodeTank.cages, pos: new THREE.Vector3(0, SLAB_T + EX.cageUp + cageH + .8, ROW_Z[3] + EX.cages + 1.6) },
    { key: 'core', text: UI.explodeTank.core, pos: new THREE.Vector3(0, SLAB_T + EX.core + cageH + .6, 0) },
    { key: 'slab', text: UI.explodeTank.slab, pos: new THREE.Vector3(SLAB_W / 2 - 1, SLAB_T + .3, SLAB_D / 2 - 1) },
  ];
  const inlet = new THREE.Vector3(-SLAB_W / 2 - 1.4, SLAB_T + .3, 0);
  return {
    group: g, tubes, inlet, explodeLabels,
    setExplode(k) {
      slabG.position.y = EX.slab * k; riserG.position.y = EX.slab * k;
      coreG.position.y = EX.core * k;
      tubes.forEach((t) => { const h = t.group.userData.home; t.group.position.set(h.x * (1 + EX.tubeSpread * k), h.y + EX.tubes * k, h.z * (1 + EX.tubeSpread * k)); });
      cages.forEach((c) => { c.position.copy(c.userData.dir).multiplyScalar(EX.cages * k); c.position.y = EX.cageUp * k; });
      manG.position.set(0, EX.man * k, 0); manG.scale.set(1 + EX.tubeSpread * k, 1, 1 + EX.tubeSpread * k);
    },
    setXray(on) {
      mat.steel.opacity = on ? .22 : 1; mat.cap.opacity = on ? .35 : 1;
      mat.steel.depthWrite = !on; mat.cap.depthWrite = !on;
      mat.mesh.opacity = on ? .3 : .75; rockMeshes.forEach((r) => { r.visible = !on; });
      tubes.forEach((t) => { t.air.visible = t.water.visible = t.line.visible = on; });
    },
    setFill(soc) {
      const a = Math.max(.02, Math.min(.98, soc)) * (TUBE_H - .3);
      const w = TUBE_H - .3 - a;
      tubes.forEach((t) => {
        t.air.scale.y = a; t.air.position.y = TUBE_H - .15 - a / 2;
        t.water.scale.y = w; t.water.position.y = .15 + w / 2;
        t.line.position.y = .15 + w;
      });
    },
  };
}
