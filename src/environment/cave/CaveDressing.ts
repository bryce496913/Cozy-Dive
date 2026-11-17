import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAVE } from '../../config/passage';
import type { Vec3 } from '../../config/world';
import { createRockGeometry } from '../RockGeometry';
import { dotTexture } from '../shared/MarineSnow';
import { CAVE_ROCKS } from './CaveEnvironment';
import { caveFloor, wallPoint } from './CaveTerrain';

/**
 * v0.6 Pass 035: the sea cave's detail, built in code. Knobbly limestone formations hang from the
 * roof; clusters of orange cup corals (sun corals, which shun the light) crowd the lower walls and
 * the shaded sides of the boulders, their yellow polyps opening and closing slowly; rubble and
 * broken shell litter the sand; and motes of sediment hang glittering in the sunbeam. One
 * instanced draw per kind, plus the motes. Owns its GPU resources.
 */
export const CAVE_DRESSING = {
  seed: 35041,
  // v0.6 Pass 041: more, and each a cluster of fluted stalactites.
  hanging: 64,
  // v0.6 Pass 041: stalagmites rising from the sand by the walls and at the feet of the rocks.
  stalagmites: 44,
  corals: 64,
  rubble: 260,
  motes: 160,
} as const;

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function only(g: THREE.BufferGeometry, keep: readonly string[]) {
  for (const name of Object.keys(g.attributes))
    if (!keep.includes(name)) g.deleteAttribute(name);
  return g;
}
/** A unit rock (1 m box, base at y 0) with positions, normals and colours. */
function unitRock(seed: number, family: number, detail: number) {
  const g = only(createRockGeometry(seed, family, detail), [
    'position',
    'normal',
    'color',
  ]);
  g.computeBoundingBox();
  const b = g.boundingBox!,
    size = b.getSize(new THREE.Vector3());
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  g.scale(1 / size.x, 1 / size.y, 1 / size.z);
  return g;
}
/**
 * One fluted stalactite hanging from y 0 to y -len: ribbed down its length, with drip bulges, a
 * fine wet tip and a drop of rock at its end. Positions, normals and colours, non-indexed.
 */
function stalactite(
  x: number,
  z: number,
  radius: number,
  len: number,
  seed: number,
): THREE.BufferGeometry {
  const rand = random(seed),
    sides = 12,
    rings = 14,
    flutes = 5 + Math.floor(rand() * 4),
    bulges = 2 + rand() * 3,
    twist = (rand() - 0.5) * 1.2,
    lean = (rand() - 0.5) * 0.12,
    phase = rand() * 6.3,
    positions: number[] = [],
    colors: number[] = [],
    ring = (j: number, i: number): [number, number, number, number] => {
      const t = j / rings,
        a = (i / sides) * Math.PI * 2,
        rib = Math.sin(a * flutes + t * twist * 6 + phase),
        r =
          radius *
            Math.pow(1 - t, 0.85) *
            (1 + 0.12 * Math.sin(t * Math.PI * bulges + phase)) *
            (1 + 0.1 * rib * (1 - 0.6 * t)) +
          (j < rings ? 0.012 : 0);
      // Shade: darker in the flutes' grooves and near the roof; paler and wet towards the tip.
      const shade = (0.82 + 0.1 * rib) * (0.86 + 0.2 * t);
      return [
        x + Math.cos(a) * r + lean * t * len,
        -t * len,
        z + Math.sin(a) * r,
        shade,
      ];
    };
  for (let j = 0; j < rings; j++)
    for (let i = 0; i < sides; i++) {
      const q = [
        ring(j, i),
        ring(j, i + 1),
        ring(j + 1, i + 1),
        ring(j + 1, i),
      ];
      for (const k of [0, 2, 1, 0, 3, 2]) {
        positions.push(q[k][0], q[k][1], q[k][2]);
        colors.push(q[k][3], q[k][3] * 0.97, q[k][3] * 0.9);
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  // A drop of rock forming at the tip.
  const drip = new THREE.SphereGeometry(Math.max(0.012, radius * 0.16), 6, 4);
  drip.scale(1, 1.5, 1);
  drip.translate(x + lean * len, -len - radius * 0.1, z);
  return mergeGeometries([g, painted(drip, 0.98)], false)!;
}
/** Non-indexed, with a flat pale colour. */
function painted(g: THREE.BufferGeometry, shade: number): THREE.BufferGeometry {
  const out = only(g.toNonIndexed(), ['position', 'normal']);
  g.dispose();
  const n = out.getAttribute('position').count,
    c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = shade;
    c[i * 3 + 1] = shade * 0.97;
    c[i * 3 + 2] = shade * 0.9;
  }
  out.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return out;
}
/** How many hanging-formation templates there are (one instanced draw each). */
export const HANGING_KINDS = 3;
/**
 * v0.6 Pass 041: a hanging formation, one of `HANGING_KINDS`: a knobbly boss of rock set into
 * the roof (its top at y 0) with a cluster of fluted stalactites beneath, one long (to y -1) and
 * several shorter, plus a few thin soda straws.
 */
export function hangingGeometry(kind = 0): THREE.BufferGeometry {
  const rand = random(35101 + kind * 977),
    parts: THREE.BufferGeometry[] = [];
  const boss = unitRock(35101 + kind * 31, kind % 4, 2);
  boss.rotateX(Math.PI);
  boss.scale(1.1, 0.3, 1.1);
  boss.translate(0, 0.04, 0);
  const flat = boss.index ? boss.toNonIndexed() : boss;
  if (flat !== boss) boss.dispose();
  parts.push(flat);
  // The long one and its neighbours, then the short ones round them.
  const stems = 3 + kind * 2;
  for (let i = 0; i < stems; i++) {
    const main = i === 0,
      a = rand() * Math.PI * 2,
      d = main ? rand() * 0.08 : 0.12 + rand() * 0.28,
      len = main ? 1 : 0.3 + rand() * 0.5,
      r = main ? 0.2 : 0.07 + rand() * 0.1;
    parts.push(
      stalactite(
        Math.cos(a) * d,
        Math.sin(a) * d,
        r,
        len,
        35200 + kind * 50 + i,
      ),
    );
  }
  for (let i = 0; i < 2 + kind; i++) {
    const a = rand() * Math.PI * 2,
      d = 0.2 + rand() * 0.25;
    parts.push(
      stalactite(
        Math.cos(a) * d,
        Math.sin(a) * d,
        0.025,
        0.15 + rand() * 0.25,
        35300 + kind * 50 + i,
      ),
    );
  }
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return g;
}
/** A cluster of sun-coral cups: short orange tubes, each crowned with a ring of yellow polyp tips. */
export function coralClusterGeometry(seed: number): {
  cups: THREE.BufferGeometry;
  polyps: THREE.BufferGeometry;
} {
  const rand = random(seed),
    cups: THREE.BufferGeometry[] = [],
    polyps: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2,
      r = Math.sqrt(rand()) * 0.13,
      h = 0.04 + rand() * 0.05,
      w = 0.018 + rand() * 0.012,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    const cup = new THREE.CylinderGeometry(w, w * 0.8, h, 8, 1, true);
    cup.translate(x, h / 2, z);
    cups.push(only(cup.toNonIndexed(), ['position', 'normal']));
    cup.dispose();
    for (let k = 0; k < 8; k++) {
      const b = (k / 8) * Math.PI * 2,
        t = new THREE.ConeGeometry(0.005, 0.028, 3);
      t.translate(0, 0.014, 0);
      t.rotateZ(0.6);
      t.rotateY(-b);
      t.translate(x + Math.cos(b) * w * 0.8, h, z + Math.sin(b) * w * 0.8);
      polyps.push(only(t.toNonIndexed(), ['position', 'normal']));
      t.dispose();
    }
  }
  const out = {
    cups: mergeGeometries(cups, false)!,
    polyps: mergeGeometries(polyps, false)!,
  };
  cups.forEach((g) => g.dispose());
  polyps.forEach((g) => g.dispose());
  out.cups.computeVertexNormals();
  out.polyps.computeVertexNormals();
  return out;
}

export class CaveDressing {
  readonly root = new THREE.Group();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly polyps: THREE.InstancedMesh;
  private readonly polypBase: THREE.Matrix4[] = [];
  private readonly motes: THREE.Points;
  private readonly moteHome: Float32Array;
  private readonly moteAt: Float32Array;
  private readonly polypMaterial: THREE.MeshStandardMaterial;
  private readonly dot = dotTexture();
  private readonly scale = new THREE.Matrix4();
  private readonly scratch = new THREE.Matrix4();
  private time = 0;
  private disposed = false;

  constructor(beamTop: number) {
    this.root.name = 'Sea cave detail';
    const rand = random(CAVE_DRESSING.seed),
      c = CAVE.chamber,
      sky = CAVE.skylight,
      m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      e = new THREE.Euler(),
      s = new THREE.Vector3(),
      up = new THREE.Vector3(0, 1, 0),
      n = new THREE.Vector3(),
      p: Vec3 = { x: 0, y: 0, z: 0 },
      color = new THREE.Color();

    // Hanging formations from the roof, away from the skylight and the tunnel.
    const rock = this.own(
      new THREE.MeshStandardMaterial({
        name: 'Cave formations',
        color: 0xc8bea9,
        vertexColors: true,
        roughness: 0.92,
      }),
    );
    const hanging = Array.from({ length: HANGING_KINDS }, (_, k) =>
      this.instanced(
        hangingGeometry(k),
        rock,
        CAVE_DRESSING.hanging,
        'Cave hanging formations',
      ),
    );
    const perKind = hanging.map(() => 0);
    let total = 0;
    for (let tries = 0; total < CAVE_DRESSING.hanging && tries < 600; tries++) {
      const a = rand() * Math.PI * 2,
        uy = 0.3 + rand() * 0.62,
        h = Math.sqrt(1 - uy * uy);
      wallPoint(Math.sin(a) * h, uy, Math.cos(a) * h, p);
      if (Math.hypot(p.x - sky.x, p.z - sky.z) < sky.radius + 1.5) continue;
      if (p.z > c.z + c.rz * 0.5 && Math.abs(p.x) < 4) continue;
      const len = 0.6 + rand() * rand() * 2.6,
        w = 0.7 + rand() * 0.8,
        k = total % HANGING_KINDS;
      e.set(0, rand() * Math.PI * 2, 0);
      q.setFromEuler(e);
      // Its top set well into the roof, so it grows from the rock.
      m.compose(
        new THREE.Vector3(p.x, p.y + 0.35, p.z),
        q,
        s.set(w, len + 0.35, w),
      );
      hanging[k].setMatrixAt(perKind[k]++, m);
      total++;
    }
    hanging.forEach((mesh, k) => {
      mesh.count = perKind[k];
      mesh.instanceMatrix.needsUpdate = true;
    });

    // v0.6 Pass 041: stalagmites, the same formations standing up from the sand: banked against
    // the walls, and beside the boulders (never in the pool of light or at the tunnel's foot).
    const standing = hangingGeometry(1);
    standing.rotateX(Math.PI);
    const stalagmites = this.instanced(
      standing,
      rock,
      CAVE_DRESSING.stalagmites,
      'Cave stalagmites',
    );
    let raised = 0;
    for (
      let tries = 0;
      raised < CAVE_DRESSING.stalagmites && tries < 400;
      tries++
    ) {
      let x: number, z: number;
      if (raised % 2) {
        const r = CAVE_ROCKS[(raised * 7) % CAVE_ROCKS.length],
          a = rand() * Math.PI * 2,
          d = r.size * (0.45 + rand() * 0.25);
        x = r.x + Math.sin(a) * d;
        z = r.z + Math.cos(a) * d;
      } else {
        const a = rand() * Math.PI * 2;
        wallPoint(Math.sin(a) * 0.96, -0.28, Math.cos(a) * 0.96, p);
        const k = 0.9 - rand() * 0.06;
        x = c.x + (p.x - c.x) * k;
        z = c.z + (p.z - c.z) * k;
      }
      if (Math.hypot(x - sky.x, z - sky.z) < sky.radius + 2) continue;
      if (z > c.z + c.rz * 0.45 && Math.abs(x) < 4) continue;
      const tall = 0.4 + rand() * rand() * 1.6,
        w = 0.5 + rand() * 0.6;
      e.set((rand() - 0.5) * 0.15, rand() * Math.PI * 2, (rand() - 0.5) * 0.15);
      q.setFromEuler(e);
      m.compose(
        new THREE.Vector3(x, caveFloor(x, z) - 0.2, z),
        q,
        s.set(w, tall + 0.2, w),
      );
      stalagmites.setMatrixAt(raised++, m);
    }
    stalagmites.count = raised;
    stalagmites.instanceMatrix.needsUpdate = true;

    // Sun-coral clusters: on the lower walls and the shaded sides of the boulders.
    const { cups, polyps } = coralClusterGeometry(35061);
    const cupMaterial = this.own(
      new THREE.MeshStandardMaterial({
        name: 'Sun coral cups',
        color: 0xe0661c,
        emissive: 0x3a1204,
        roughness: 0.6,
      }),
    );
    this.polypMaterial = this.own(
      new THREE.MeshStandardMaterial({
        name: 'Sun coral polyps',
        color: 0xffc23a,
        emissive: 0x5a3a06,
        roughness: 0.5,
      }),
    );
    const cupMesh = this.instanced(
      cups,
      cupMaterial,
      CAVE_DRESSING.corals,
      'Sun coral cups',
    );
    this.polyps = this.instanced(
      polyps,
      this.polypMaterial,
      CAVE_DRESSING.corals,
      'Sun coral polyps',
    );
    for (let i = 0; i < CAVE_DRESSING.corals; i++) {
      let pos: THREE.Vector3;
      if (i % 3 === 0) {
        // The side of a boulder away from the light.
        const r = CAVE_ROCKS[i % CAVE_ROCKS.length],
          a = Math.atan2(r.x - sky.x, r.z - sky.z) + (rand() - 0.5) * 1.4,
          y = caveFloor(r.x, r.z) + r.height * (0.25 + rand() * 0.35);
        n.set(Math.sin(a), -0.2, Math.cos(a)).normalize();
        pos = new THREE.Vector3(
          r.x + Math.sin(a) * r.size * 0.3,
          y,
          r.z + Math.cos(a) * r.size * 0.3,
        );
      } else {
        // The bare rock of the lower walls, above the sand banked against them, away from the
        // tunnel's side (so the walls deeper in the cave are the richest).
        let tries = 0;
        do {
          const a = Math.PI + (rand() - 0.5) * 4.4,
            uy = -0.05 + rand() * 0.4,
            h = Math.sqrt(1 - uy * uy);
          wallPoint(Math.sin(a) * h, uy, Math.cos(a) * h, p);
        } while (p.y < caveFloor(p.x, p.z) + 0.5 && ++tries < 20);
        // Facing back into the cavern.
        n.set(c.x - p.x, (c.y - p.y) * 0.3, c.z - p.z).normalize();
        // Just into the rock, so the cups' bases are hidden.
        pos = new THREE.Vector3(
          p.x - n.x * 0.04,
          p.y - n.y * 0.04,
          p.z - n.z * 0.04,
        );
      }
      q.setFromUnitVectors(up, n);
      const size = 0.7 + rand() * 0.6;
      m.compose(pos, q, s.setScalar(size));
      cupMesh.setMatrixAt(i, m);
      this.polypBase.push(m.clone());
      this.polyps.setMatrixAt(i, m);
      cupMesh.setColorAt(i, color.setRGB(1, 0.85 + rand() * 0.3, 0.8));
    }
    cupMesh.instanceMatrix.needsUpdate = true;
    if (cupMesh.instanceColor) cupMesh.instanceColor.needsUpdate = true;
    this.polyps.instanceMatrix.needsUpdate = true;

    // Rubble and shell on the sand, thicker near the walls and rocks.
    const rubble = this.instanced(
      unitRock(35071, 2, 1),
      this.own(
        new THREE.MeshStandardMaterial({
          name: 'Cave rubble',
          color: 0xbdb19c,
          vertexColors: true,
          roughness: 0.95,
        }),
      ),
      CAVE_DRESSING.rubble,
      'Cave rubble',
    );
    let placed = 0;
    for (
      let tries = 0;
      placed < CAVE_DRESSING.rubble && tries < CAVE_DRESSING.rubble * 5;
      tries++
    ) {
      const a = rand() * Math.PI * 2,
        r = 0.25 + Math.sqrt(rand()) * 0.72,
        x = c.x + Math.sin(a) * r * c.rx,
        z = c.z + Math.cos(a) * r * c.rz;
      // Keep the pool of light and the tunnel's foot clear; more near the edges.
      if (Math.hypot(x - sky.x, z - sky.z) < 3.5) continue;
      if (z > c.z + c.rz * 0.6 && Math.abs(x) < 3) continue;
      if (rand() > r * 1.2) continue;
      const w = 0.08 + rand() * rand() * 0.45;
      e.set(rand() * 0.5, rand() * Math.PI * 2, rand() * 0.5);
      q.setFromEuler(e);
      m.compose(
        new THREE.Vector3(x, caveFloor(x, z) - w * 0.2, z),
        q,
        s.set(w, w * (0.35 + rand() * 0.35), w * (0.6 + rand() * 0.5)),
      );
      rubble.setMatrixAt(placed++, m);
    }
    rubble.count = placed;
    rubble.instanceMatrix.needsUpdate = true;

    // Motes glittering in the sunbeam.
    const count = CAVE_DRESSING.motes,
      floor = caveFloor(sky.x, sky.z);
    this.moteHome = new Float32Array(count * 3);
    this.moteAt = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const y = floor + 0.5 + rand() * (beamTop - floor - 1),
        t = (y - floor) / (beamTop - floor),
        // Within the beam's cone, leaning with it.
        rad = sky.radius * (1.4 - 0.5 * t) * Math.sqrt(rand()),
        a = rand() * Math.PI * 2,
        lean = 0.12 * (beamTop - y);
      this.moteHome[i * 3] = sky.x - lean + Math.cos(a) * rad;
      this.moteHome[i * 3 + 1] = y;
      this.moteHome[i * 3 + 2] = sky.z + Math.sin(a) * rad;
    }
    this.moteAt.set(this.moteHome);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.moteAt, 3));
    this.geometries.push(g);
    const moteMaterial = this.own(
      new THREE.PointsMaterial({
        name: 'Cave motes',
        color: 0xeafff4,
        map: this.dot,
        size: 0.07,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    this.motes = new THREE.Points(g, moteMaterial);
    this.motes.name = 'Cave motes';
    this.root.add(this.motes);
  }
  private own<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }
  private instanced(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    count: number,
    name: string,
  ): THREE.InstancedMesh {
    this.geometries.push(geometry);
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = name;
    this.root.add(mesh);
    return mesh;
  }
  /** Polyps open and close slowly; motes drift in the beam; on simulation time only. */
  update(dt: number, active: boolean, reducedMotion: boolean): void {
    if (this.disposed || !active || reducedMotion || !(dt > 0)) return;
    this.time += Math.min(dt, 0.1);
    const t = this.time;
    for (let i = 0; i < this.polypBase.length; i++) {
      const k = 0.75 + 0.25 * Math.sin(t * 0.35 + i * 0.9);
      this.scale.makeScale(1, k, 1);
      this.scratch.multiplyMatrices(this.polypBase[i], this.scale);
      this.polyps.setMatrixAt(i, this.scratch);
    }
    this.polyps.instanceMatrix.needsUpdate = true;
    const h = this.moteHome,
      a = this.moteAt;
    for (let i = 0; i < a.length; i += 3) {
      const ph = i * 0.37;
      a[i] = h[i] + 0.25 * Math.sin(t * 0.13 + ph);
      a[i + 1] = h[i + 1] + 0.3 * Math.sin(t * 0.09 + ph * 1.7);
      a[i + 2] = h[i + 2] + 0.25 * Math.cos(t * 0.11 + ph);
    }
    this.motes.geometry.getAttribute('position').needsUpdate = true;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    for (const child of this.root.children)
      if (child instanceof THREE.InstancedMesh) child.dispose();
    this.root.clear();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.dot.dispose();
  }
}
