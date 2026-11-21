import * as THREE from 'three';
import { organicTube, smoothed } from '../shared/organicGeometry';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ICE } from '../../config/passage';
import type { Vec3 } from '../../config/world';
import { anemoneColumn, anemoneCrown } from '../kelp/KelpDressing';
import { seaStarShape } from '../kelp/KelpShapes';
import { iceFloor } from './IceTerrain';

/**
 * v0.6 Pass 046: the pale garden on the seabed under the ice, built in code: vase- and barrel-
 * shaped glass sponges, branching soft corals in white, pink and orange, white and pink anemones,
 * red and orange sea stars (a few of them very large), and feather stars holding up their arms on
 * the stones and sponges, swaying in the faint current. One instanced draw per kind. Owns its GPU
 * resources.
 */
export const GARDEN = {
  seed: 46201,
  // v0.6 Pass 052 (playtest: "a lot more life ... more detail"): a far denser garden.
  sponges: 110,
  corals: 120,
  anemones: 90,
  stars: 110,
  feathers: 50,
} as const;

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function only(g: THREE.BufferGeometry): THREE.BufferGeometry {
  // V0.7 Pass 068: creased normals (smooth across gentle bends), kept through the merge.
  const out = smoothed(g);
  return out;
}
/** A glass sponge: a lumpy vase with a flared rim, open at the top (unit height). */
export function spongeGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(
      new THREE.Vector2(
        0.18 + 0.2 * Math.sin(t * Math.PI * 0.9) + 0.12 * t * t,
        t,
      ),
    );
  }
  // Back down inside the rim, so the wall has thickness.
  for (let i = 12; i >= 2; i--) {
    const t = i / 12;
    pts.push(
      new THREE.Vector2(
        0.14 + 0.2 * Math.sin(t * Math.PI * 0.9) + 0.1 * t * t,
        t,
      ),
    );
  }
  const g = new THREE.LatheGeometry(pts, 36);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      a = Math.atan2(z, x),
      k = 1 + 0.08 * Math.sin(a * 5 + y * 6) + 0.05 * Math.sin(a * 11 - y * 9);
    p.setXYZ(i, x * k, y, z * k);
  }
  return only(g);
}
/** A soft coral: a short trunk branching into lobes tipped with polyps (unit height). */
export function softCoralGeometry(): THREE.BufferGeometry {
  const rand = random(46211),
    parts: THREE.BufferGeometry[] = [];
  // V0.7 Pass 069: a continuous fleshy colony: a flaring trunk dividing into curving branches that
  // swell into polyp-covered club tips (it was cylinders tipped with loose spheres).
  const trunkPts = [
    new THREE.Vector3(0, -0.02, 0),
    new THREE.Vector3(0.01, 0.15, 0.005),
    new THREE.Vector3(0, 0.32, 0),
  ];
  parts.push(
    only(
      organicTube(
        trunkPts,
        (u) => 0.13 - 0.07 * u + 0.05 * Math.exp(-u / 0.12),
        8,
        10,
      ),
    ),
  );
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rand(),
      lean = 0.35 + rand() * 0.4,
      len = 0.35 + rand() * 0.35,
      dir = new THREE.Vector3(
        Math.sin(lean) * Math.cos(a),
        Math.cos(lean),
        Math.sin(lean) * Math.sin(a),
      ),
      start = new THREE.Vector3(0, 0.24 + rand() * 0.06, 0),
      mid = start
        .clone()
        .addScaledVector(dir, len * 0.5)
        .add(new THREE.Vector3(0, 0.04, 0)),
      end = start
        .clone()
        .addScaledVector(dir, len)
        .add(new THREE.Vector3(0, 0.08, 0)),
      club = organicTube(
        [start, mid, end],
        // Slim near the trunk, swelling into a rounded club of polyps.
        (u) => 0.042 - 0.012 * u + 0.05 * Math.max(0, (u - 0.62) / 0.38) ** 1.4,
        12,
        9,
      );
    // Polyp texture: small bumps over the swollen tip.
    const p = club.getAttribute('position');
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k),
        y = p.getY(k),
        z = p.getZ(k),
        tipness = Math.max(
          0,
          1 - Math.hypot(x - end.x, y - end.y, z - end.z) / 0.11,
        ),
        bump =
          1 + 0.18 * tipness * Math.sin(x * 160) * Math.sin(y * 150 + z * 130);
      p.setXYZ(
        k,
        end.x + (x - end.x) * bump,
        end.y + (y - end.y) * bump,
        end.z + (z - end.z) * bump,
      );
    }
    parts.push(only(club));
  }
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return g;
}
/** A feather star: a small cup on short cirri, ten feathery arms held up and out (unit span). */
export function featherStarGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const cup = new THREE.SphereGeometry(0.06, 10, 6);
  cup.translate(0, 0.05, 0);
  parts.push(only(cup));
  // V0.7 Pass 068: each arm is one continuous tube curling up and out (it was four stacked
  // four-sided cylinders), fringed with rounded pinnules along both sides.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2,
      pts: THREE.Vector3[] = [];
    let x = 0,
      y = 0.07,
      lift = 1.1;
    pts.push(new THREE.Vector3(0, y, 0));
    for (let s = 0; s < 4; s++) {
      x += Math.sin(lift) * 0.12;
      y += Math.cos(lift) * 0.12;
      lift -= 0.25;
      pts.push(new THREE.Vector3(x, y, 0));
    }
    const arm = organicTube(pts, (u) => 0.012 - 0.007 * u, 10, 5);
    arm.rotateY(a);
    parts.push(only(arm));
    const curve = new THREE.CatmullRomCurve3(pts);
    for (let k = 1; k <= 7; k++) {
      const u = k / 8,
        at = curve.getPointAt(u),
        tan = curve.getTangentAt(u);
      for (const side of [-1, 1]) {
        const len = 0.055 * (1 - 0.5 * u),
          tip = at
            .clone()
            .add(
              new THREE.Vector3(tan.y * 0.3, -tan.x * 0.3, side)
                .normalize()
                .multiplyScalar(len),
            ),
          pin = new THREE.ConeGeometry(0.0045, len, 5, 1, true);
        // Point the pinnule from the arm out along `tip`.
        pin.translate(0, len / 2, 0);
        pin.applyQuaternion(
          new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            tip.clone().sub(at).normalize(),
          ),
        );
        pin.translate(at.x, at.y, at.z);
        pin.rotateY(a);
        parts.push(only(pin));
      }
    }
  }
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return g;
}

export class IceGarden {
  readonly root = new THREE.Group();
  /** Where some of each kind are (for sightings). */
  readonly spots: Record<
    'sponge' | 'coral' | 'anemone' | 'star' | 'feather',
    Vec3[]
  > = {
    sponge: [],
    coral: [],
    anemone: [],
    star: [],
    feather: [],
  };
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly feathers: THREE.InstancedMesh;
  private readonly featherBase: THREE.Matrix4[] = [];
  private readonly sway = new THREE.Matrix4();
  private readonly scratch = new THREE.Matrix4();
  private time = 0;
  private disposed = false;

  constructor(
    stones: readonly { x: number; y: number; z: number; size: number }[],
  ) {
    this.root.name = 'Under-ice garden';
    const rand = random(GARDEN.seed),
      w = ICE.walls,
      t = ICE.tunnel,
      m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      e = new THREE.Euler(),
      p = new THREE.Vector3(),
      s = new THREE.Vector3(),
      c = new THREE.Color();
    const spot = (clear = 0) => {
      for (let i = 0; i < 40; i++) {
        const x = (rand() * 2 - 1) * (w.x - 4),
          z = t.wallZ - 3 + rand() * (w.farZ - t.wallZ + 6);
        if (Math.abs(x) < 3.5 + clear && z > t.wallZ - 8) continue;
        return { x, y: iceFloor(x, z), z };
      }
      return { x: 0, y: iceFloor(0, -30), z: -30 };
    };
    const kind = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      count: number,
      name: string,
    ) => {
      this.geometries.push(geometry);
      this.materials.push(material);
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      mesh.name = name;
      this.root.add(mesh);
      return mesh;
    };
    // Glass sponges: pale and slightly translucent, in clumps; a few big barrels.
    const sponges = kind(
      spongeGeometry(),
      new THREE.MeshStandardMaterial({
        name: 'Glass sponges',
        color: 0xf0e8d6,
        roughness: 0.7,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      }),
      GARDEN.sponges,
      'Glass sponges',
    );
    let at = spot();
    for (let i = 0; i < GARDEN.sponges; i++) {
      if (i % 4 === 0) at = spot();
      const x = at.x + (rand() - 0.5) * 3,
        z = at.z + (rand() - 0.5) * 3,
        y = iceFloor(x, z),
        h = 0.5 + rand() * rand() * (i % 9 === 0 ? 2.6 : 1.3),
        r = h * (0.55 + rand() * 0.4);
      e.set((rand() - 0.5) * 0.15, rand() * Math.PI * 2, (rand() - 0.5) * 0.15);
      m.compose(p.set(x, y - 0.05, z), q.setFromEuler(e), s.set(r, h, r));
      sponges.setMatrixAt(i, m);
      sponges.setColorAt(
        i,
        c.setRGB(
          0.95 + rand() * 0.05,
          0.92 + rand() * 0.06,
          0.85 + rand() * 0.1,
        ),
      );
      if (i % 12 === 0) this.spots.sponge.push({ x, y: y + h * 0.6, z });
    }
    // Soft corals: white, pink and orange.
    const corals = kind(
      softCoralGeometry(),
      new THREE.MeshStandardMaterial({
        name: 'Soft corals',
        color: 0xffffff,
        roughness: 0.6,
      }),
      GARDEN.corals,
      'Soft corals',
    );
    const coralColours = [
      [0.96, 0.94, 0.92],
      [0.95, 0.6, 0.66],
      [0.98, 0.55, 0.25],
    ];
    for (let i = 0; i < GARDEN.corals; i++) {
      if (i % 5 === 0) at = spot();
      const x = at.x + (rand() - 0.5) * 2.5,
        z = at.z + (rand() - 0.5) * 2.5,
        y = iceFloor(x, z),
        h = 0.4 + rand() * 0.8;
      e.set(0, rand() * Math.PI * 2, 0);
      m.compose(p.set(x, y - 0.03, z), q.setFromEuler(e), s.setScalar(h));
      corals.setMatrixAt(i, m);
      const k = coralColours[i % 3];
      corals.setColorAt(i, c.setRGB(k[0], k[1], k[2]));
      if (i % 14 === 0) this.spots.coral.push({ x, y: y + h * 0.5, z });
    }
    // Anemones: white and pink, on the stones and the gravel.
    const columns = kind(
      anemoneColumn(),
      new THREE.MeshStandardMaterial({
        name: 'Anemone columns',
        color: 0xffffff,
        roughness: 0.6,
      }),
      GARDEN.anemones,
      'Anemone columns',
    );
    const crowns = kind(
      anemoneCrown(),
      new THREE.MeshStandardMaterial({
        name: 'Anemone crowns',
        color: 0xffffff,
        roughness: 0.5,
      }),
      GARDEN.anemones,
      'Anemone crowns',
    );
    for (let i = 0; i < GARDEN.anemones; i++) {
      const st = stones.length && i % 2 ? stones[i % stones.length] : undefined,
        pos = st
          ? {
              x: st.x + (rand() - 0.5) * st.size * 0.6,
              y: st.y + st.size * 0.5,
              z: st.z + (rand() - 0.5) * st.size * 0.6,
            }
          : spot(),
        size = 1.4 + rand() * 1.6;
      e.set(0, rand() * Math.PI * 2, 0);
      m.compose(
        p.set(pos.x, pos.y, pos.z),
        q.setFromEuler(e),
        s.setScalar(size),
      );
      columns.setMatrixAt(i, m);
      crowns.setMatrixAt(i, m);
      const pink = i % 3 === 0;
      columns.setColorAt(
        i,
        c.setRGB(pink ? 0.9 : 0.95, pink ? 0.7 : 0.93, pink ? 0.75 : 0.9),
      );
      crowns.setColorAt(
        i,
        c.setRGB(pink ? 0.98 : 1, pink ? 0.62 : 0.98, pink ? 0.75 : 0.96),
      );
      if (i % 12 === 0) this.spots.anemone.push({ ...pos });
    }
    // Sea stars: red and orange, a few very large.
    const stars = kind(
      // v0.6 Pass 053: the rebuilt sea star (it was a flat extruded star).
      seaStarShape(),
      new THREE.MeshStandardMaterial({
        name: 'Antarctic sea stars',
        color: 0xffffff,
        roughness: 0.65,
      }),
      GARDEN.stars,
      'Antarctic sea stars',
    );
    for (let i = 0; i < GARDEN.stars; i++) {
      const pos = spot(),
        size = (i % 8 === 0 ? 3.6 : 1.4) + rand() * 1.2;
      e.set(0, rand() * Math.PI * 2, 0);
      m.compose(
        p.set(pos.x, pos.y + 0.01, pos.z),
        q.setFromEuler(e),
        s.setScalar(size),
      );
      stars.setMatrixAt(i, m);
      stars.setColorAt(
        i,
        i % 2 ? c.setRGB(0.85, 0.16, 0.1) : c.setRGB(0.95, 0.45, 0.12),
      );
      if (i % 10 === 0) this.spots.star.push({ ...pos });
    }
    // Feather stars: on the stones and the bigger sponges' rims, arms held up in the current.
    this.feathers = kind(
      featherStarGeometry(),
      new THREE.MeshStandardMaterial({
        name: 'Feather stars',
        color: 0xffffff,
        roughness: 0.6,
      }),
      GARDEN.feathers,
      'Feather stars',
    );
    for (let i = 0; i < GARDEN.feathers; i++) {
      const st = stones.length ? stones[(i * 3) % stones.length] : undefined,
        pos = st ? { x: st.x, y: st.y + st.size * 0.55, z: st.z } : spot(),
        size = 0.8 + rand() * 0.6;
      e.set(0, rand() * Math.PI * 2, 0);
      m.compose(
        p.set(pos.x, pos.y, pos.z),
        q.setFromEuler(e),
        s.setScalar(size),
      );
      this.featherBase.push(m.clone());
      this.feathers.setMatrixAt(i, m);
      this.feathers.setColorAt(
        i,
        i % 2 ? c.setRGB(0.98, 0.7, 0.2) : c.setRGB(0.95, 0.35, 0.15),
      );
      if (i % 7 === 0) this.spots.feather.push({ ...pos });
    }
  }
  /** The feather stars sway in the current, on simulation time only. */
  update(dt: number, active: boolean, reducedMotion: boolean): void {
    if (this.disposed || !active || reducedMotion || !(dt > 0)) return;
    this.time += Math.min(dt, 0.1);
    this.featherBase.forEach((base, i) => {
      this.sway.makeRotationX(0.12 * Math.sin(this.time * 0.6 + i * 1.7));
      this.scratch.multiplyMatrices(base, this.sway);
      this.feathers.setMatrixAt(i, this.scratch);
    });
    this.feathers.instanceMatrix.needsUpdate = true;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    for (const mesh of this.root.children)
      if (mesh instanceof THREE.InstancedMesh) mesh.dispose();
    this.root.clear();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
