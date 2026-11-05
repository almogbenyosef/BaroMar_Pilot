// Underwater storage structure, after Leonardo Stadler drawings BAROMAR-C-01..C-05 (Rev.05):
// octagonal concrete slab 14.3 × 13.37 m, 14 steel tubes Ø2.5 m × 10.4 m at 3.5 m centres,
// ballast stopper cages between the tubes and a compressed-air manifold across the tops.
// Units are metres; origin is the centre of the slab underside.
import * as THREE from 'three';

const SLAB_W = 14.3, SLAB_D = 13.37, SLAB_T = 0.8;
const CUT_X = 3.65, CUT_Z = 4.02;
const TUBE_R = 1.25, TUBE_H = 10.4;
const ROW_Z = [-4.78, -1.75, 1.75, 4.78];
const ROWS = [[-3.5, 0, 3.5], [-5.25, -1.75, 1.75, 5.25], [-5.25, -1.75, 1.75, 5.25], [-3.5, 0, 3.5]];
const CAGES = [[-1.75, -3.27], [1.75, -3.27], [-1.75, 3.27], [1.75, 3.27], [-3.5, 0], [3.5, 0]];

const mat = {
  concrete: new THREE.MeshStandardMaterial({ color: 0x9a978c, roughness: .95 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x7b4f3e, roughness: .55, metalness: .35, transparent: true, opacity: 1 }),
  cap: new THREE.MeshStandardMaterial({ color: 0x8a5a46, roughness: .5, metalness: .4, transparent: true, opacity: 1 }),
  pipe: new THREE.MeshStandardMaterial({ color: 0xc27a4e, roughness: .4, metalness: .5 }),
  cage: new THREE.MeshStandardMaterial({ color: 0x5a5f63, roughness: .7, metalness: .6, wireframe: true }),
  rock: new THREE.MeshStandardMaterial({ color: 0x6f665a, roughness: 1, flatShading: true }),
  air: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xcfeaff, emissiveIntensity: .55, transparent: true, opacity: .85, roughness: .3 }),
  water: new THREE.MeshStandardMaterial({ color: 0x1f6e95, emissive: 0x0b3a52, emissiveIntensity: .3, transparent: true, opacity: .55, roughness: .2 }),
};

function octagon() {
  const hw = SLAB_W / 2, hd = SLAB_D / 2;
  const s = new THREE.Shape();
  s.moveTo(-hw + CUT_X, -hd); s.lineTo(hw - CUT_X, -hd); s.lineTo(hw, -hd + CUT_Z); s.lineTo(hw, hd - CUT_Z);
  s.lineTo(hw - CUT_X, hd); s.lineTo(-hw + CUT_X, hd); s.lineTo(-hw, hd - CUT_Z); s.lineTo(-hw, -hd + CUT_Z); s.closePath();
  return s;
}

export function buildTankStructure() {
  const g = new THREE.Group();
  g.name = 'tank-structure';

  // slab, with a skirt below so it sits cleanly on a sloping seabed
  const slabGeo = new THREE.ExtrudeGeometry(octagon(), { depth: SLAB_T + 3, bevelEnabled: false });
  slabGeo.rotateX(Math.PI / 2); slabGeo.translate(0, SLAB_T, 0);
  const slab = new THREE.Mesh(slabGeo, mat.concrete); slab.userData.part = 'tanks'; g.add(slab);

  const tubes = [];
  const tubeGeo = new THREE.CylinderGeometry(TUBE_R, TUBE_R, TUBE_H, 40, 1, true);
  const capGeo = new THREE.CylinderGeometry(TUBE_R + .02, TUBE_R + .02, .12, 40);
  const flangeGeo = new THREE.TorusGeometry(TUBE_R + .03, .06, 6, 40);
  const innerGeo = new THREE.CylinderGeometry(TUBE_R - .06, TUBE_R - .06, 1, 32);
  ROW_Z.forEach((z, r) => ROWS[r].forEach((x) => {
    const t = new THREE.Group(); t.position.set(x, SLAB_T, z);
    const shell = new THREE.Mesh(tubeGeo, mat.steel); shell.position.y = TUBE_H / 2; shell.userData.part = 'tanks';
    const cap = new THREE.Mesh(capGeo, mat.cap); cap.position.y = TUBE_H; cap.userData.part = 'tanks';
    const fl = new THREE.Mesh(flangeGeo, mat.pipe); fl.rotation.x = Math.PI / 2; fl.position.y = .15;
    const air = new THREE.Mesh(innerGeo, mat.air); const water = new THREE.Mesh(innerGeo, mat.water);
    air.visible = water.visible = false;
    t.add(shell, cap, fl, air, water);
    g.add(t); tubes.push({ air, water });
  }));

  // ballast stopper cages with rock fill
  const cageGeo = new THREE.CylinderGeometry(.5, .5, TUBE_H, 12, 8, true);
  const rockGeo = new THREE.DodecahedronGeometry(.42, 0);
  CAGES.forEach(([x, z]) => {
    const c = new THREE.Mesh(cageGeo, mat.cage); c.position.set(x, SLAB_T + TUBE_H / 2, z); g.add(c);
    for (let i = 0; i < 12; i++) {
      const r = new THREE.Mesh(rockGeo, mat.rock);
      r.position.set(x + (Math.random() - .5) * .3, SLAB_T + .4 + i * .85, z + (Math.random() - .5) * .3);
      r.rotation.set(Math.random() * 3, Math.random() * 3, 0); g.add(r);
    }
  });

  // manifold: one header pipe per row across the tube tops, collected on the west side and taken down to the slab
  const pr = .11, yTop = SLAB_T + TUBE_H + .35;
  const addPipe = (a, b) => {
    const v = new THREE.Vector3().subVectors(b, a); const len = v.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, len, 10), mat.pipe);
    m.position.copy(a).addScaledVector(v, .5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
    m.userData.part = 'tanks'; g.add(m);
  };
  const xW = -6.9;
  ROW_Z.forEach((z, r) => {
    const xs = ROWS[r];
    addPipe(new THREE.Vector3(xs[xs.length - 1], yTop, z), new THREE.Vector3(xW, yTop, z));
    xs.forEach((x) => addPipe(new THREE.Vector3(x, SLAB_T + TUBE_H, z), new THREE.Vector3(x, yTop, z)));
  });
  addPipe(new THREE.Vector3(xW, yTop, ROW_Z[0]), new THREE.Vector3(xW, yTop, ROW_Z[3]));
  addPipe(new THREE.Vector3(xW, yTop, 0), new THREE.Vector3(xW, SLAB_T + .3, 0));
  addPipe(new THREE.Vector3(xW, SLAB_T + .3, 0), new THREE.Vector3(-SLAB_W / 2 - 1.2, SLAB_T + .3, 0));

  // lifting lugs
  const lug = new THREE.BoxGeometry(.9, .55, .9);
  [[-5.25, -3.27], [5.25, -3.27], [-5.25, 3.27], [5.25, 3.27]].forEach(([x, z]) => {
    const m = new THREE.Mesh(lug, mat.pipe); m.position.set(x, SLAB_T + .28, z); g.add(m);
  });

  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  const inlet = new THREE.Vector3(-SLAB_W / 2 - 1.2, SLAB_T + .3, 0);
  return {
    group: g, tubes, inlet,
    setXray(on) {
      mat.steel.opacity = on ? .22 : 1; mat.cap.opacity = on ? .35 : 1;
      mat.steel.depthWrite = !on; mat.cap.depthWrite = !on;
      tubes.forEach((t) => { t.air.visible = t.water.visible = on; });
    },
    setFill(soc) {
      const a = Math.max(.02, Math.min(.98, soc)) * (TUBE_H - .3);
      const w = TUBE_H - .3 - a;
      tubes.forEach((t) => {
        t.air.scale.y = a; t.air.position.y = TUBE_H - .15 - a / 2;
        t.water.scale.y = w; t.water.position.y = .15 + w / 2;
      });
    },
  };
}

export const TANK_INFO = { tubeHeight: TUBE_H, slabThickness: SLAB_T };
