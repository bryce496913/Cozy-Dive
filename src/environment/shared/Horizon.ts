import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Vec3 } from '../../config/world';

/**
 * v0.6 Pass 053 (open-ocean freedom): faint shapes far out in the water, beyond where the haze
 * would hide everything, so a world reads as part of a bigger ocean rather than a closed arena.
 *
 *  - **Silhouettes**: distant terrain (pinnacles, ridges, more reef, more kelp) as single flat-
 *    coloured, fog-free meshes in a dark tint of the water, drawn faintly behind everything. They
 *    are low-poly (a few hundred triangles each) and merged into one draw per kind.
 *  - **Passers**: a few far-off animal shapes (a whale, a manta, a school) drifting slowly along
 *    long paths at the edge of sight, never near the swimmer. One draw each; no models loaded.
 *
 * Fog-free, so the haze does not swallow them; their faintness is their opacity, and they fade
 * towards the water colour with height (the `fade` band), so they sit in the blue. Allocation-free
 * per frame. Owns its GPU resources.
 */
export interface HorizonOptions {
  /** The tint they are drawn in (a dark shade of the water), and how faint they are (0..1). */
  readonly colour: number;
  readonly opacity: number;
}
export interface PasserPath {
  /** The shape: a whale, a manta, or a loose school of small shapes. */
  readonly kind: 'whale' | 'manta' | 'school';
  /** Its path: a long, slow ellipse (centre, radii, height) and its speed (rad/s), and size. */
  readonly centre: Readonly<Vec3>;
  readonly rx: number;
  readonly rz: number;
  readonly speed: number;
  readonly scale: number;
  readonly phase: number;
}

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** Positions only (non-indexed), so the pieces merge into one silhouette. */
function bare(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  for (const name of Object.keys(out.attributes))
    if (name !== 'position') out.deleteAttribute(name);
  return out;
}
/** A rough, tapering pinnacle (unit base radius, unit height), its foot at y 0. */
export function pinnacleGeometry(seed: number): THREE.BufferGeometry {
  const rand = random(seed),
    g = new THREE.CylinderGeometry(0.35, 1, 1, 9, 6, true),
    p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i)),
      y = p.getY(i) + 0.5,
      k = 1 + 0.25 * Math.sin(a * 3 + seed) * Math.sin(y * 7 + rand());
    p.setXYZ(i, p.getX(i) * k, y, p.getZ(i) * k);
  }
  return bare(g);
}
/** A long, lumpy ridge (unit length along x, unit height), its foot at y 0. */
export function ridgeGeometry(seed: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 16, true, 0, Math.PI),
    p = g.getAttribute('position');
  g.rotateZ(Math.PI / 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = Math.max(0, p.getY(i)),
      bump =
        1 + 0.35 * Math.sin(x * 9 + seed) + 0.2 * Math.sin(x * 23 + seed * 2);
    p.setXYZ(i, x, y * 2 * bump, p.getZ(i) * 0.6);
  }
  return bare(g);
}
/** A tall stalk of kelp, swaying sideways a little (unit height), its foot at y 0. */
export function stalkGeometry(seed: number): THREE.BufferGeometry {
  const rand = random(seed),
    parts: THREE.BufferGeometry[] = [],
    lean = (rand() - 0.5) * 0.15;
  const stem = new THREE.CylinderGeometry(0.012, 0.02, 1, 4, 8, true),
    sp = stem.getAttribute('position');
  for (let i = 0; i < sp.count; i++) {
    const y = sp.getY(i) + 0.5;
    sp.setXYZ(
      i,
      sp.getX(i) + lean * y + 0.03 * Math.sin(y * 9 + seed),
      y,
      sp.getZ(i),
    );
  }
  parts.push(bare(stem));
  // Blades along it, as flat diamonds, alternating sides.
  for (let k = 0; k < 10; k++) {
    const y = 0.15 + k * 0.08,
      side = k % 2 ? 1 : -1,
      blade = new THREE.PlaneGeometry(0.09, 0.03);
    blade.rotateZ(side * 0.6);
    blade.translate(lean * y + side * 0.05, y, 0);
    parts.push(bare(blade));
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!merged) throw Error('Horizon stalk could not be built');
  return merged;
}
/** A whale's outline: a long spindle with flukes and long pectorals (unit length along x). */
function whaleShape(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    body = new THREE.SphereGeometry(0.5, 12, 6);
  body.scale(1, 0.18, 0.2);
  parts.push(bare(body));
  const fluke = new THREE.ConeGeometry(0.16, 0.18, 3);
  fluke.rotateZ(Math.PI / 2);
  fluke.scale(1, 0.25, 1.3);
  fluke.translate(-0.55, 0, 0);
  parts.push(bare(fluke));
  for (const side of [-1, 1]) {
    const fin = new THREE.BoxGeometry(0.08, 0.01, 0.3);
    fin.rotateY(side * 0.5);
    fin.translate(0.15, -0.06, side * 0.2);
    parts.push(bare(fin));
  }
  const m = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!m) throw Error('Horizon whale could not be built');
  return m;
}
/** A manta's outline: a broad diamond with a tail (unit span). */
function mantaShape(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  // Two flattened wedges (top and bottom) meeting at the wing tips.
  const v = [
    [0.3, 0, 0],
    [0, 0.03, 0.5],
    [-0.15, 0, 0],
    [0, -0.03, 0.5],
    [0, 0.03, -0.5],
    [0, -0.03, -0.5],
    [-0.6, 0, 0],
  ];
  const tri = [0, 1, 2, 0, 2, 4, 0, 3, 2, 0, 2, 5, 2, 6, 1, 2, 4, 6];
  g.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      tri.flatMap((i) => v[i]),
      3,
    ),
  );
  return g;
}
/** A loose school of small fish shapes (unit spread), drawn as one mesh. */
function schoolShape(seed: number): THREE.BufferGeometry {
  const rand = random(seed),
    parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 60; k++) {
    const f = new THREE.ConeGeometry(0.012, 0.05, 3);
    f.rotateZ(-Math.PI / 2);
    const r = Math.sqrt(rand()) * 0.5,
      a = rand() * Math.PI * 2;
    f.translate(Math.cos(a) * r, (rand() - 0.5) * 0.3, Math.sin(a) * r);
    parts.push(bare(f));
  }
  const m = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!m) throw Error('Horizon school could not be built');
  return m;
}

interface Passer {
  readonly mesh: THREE.Mesh;
  readonly path: PasserPath;
}

export class Horizon {
  readonly root = new THREE.Group();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly material: THREE.MeshBasicMaterial;
  private readonly passers: Passer[] = [];
  private time = 0;
  private disposed = false;

  constructor(
    name: string,
    options: HorizonOptions,
    /** Silhouettes: each a set of pieces (geometry and where it stands), merged into one draw. */
    silhouettes: readonly {
      readonly geometry: (seed: number) => THREE.BufferGeometry;
      readonly at: readonly {
        readonly x: number;
        readonly y: number;
        readonly z: number;
        readonly sx: number;
        readonly sy: number;
        readonly sz: number;
        readonly yaw: number;
      }[];
    }[],
    passers: readonly PasserPath[] = [],
  ) {
    this.root.name = name;
    this.material = new THREE.MeshBasicMaterial({
      name: `${name} silhouettes`,
      color: options.colour,
      transparent: true,
      opacity: options.opacity,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      e = new THREE.Euler(),
      pos = new THREE.Vector3(),
      scl = new THREE.Vector3();
    silhouettes.forEach((kind, k) => {
      const pieces = kind.at.map((a, i) => {
        const g = kind.geometry(53000 + k * 97 + i * 13);
        e.set(0, a.yaw, 0);
        m.compose(
          pos.set(a.x, a.y, a.z),
          q.setFromEuler(e),
          scl.set(a.sx, a.sy, a.sz),
        );
        return g.applyMatrix4(m);
      });
      if (!pieces.length) return;
      const merged = mergeGeometries(pieces, false);
      pieces.forEach((g) => g.dispose());
      if (!merged) return;
      this.geometries.push(merged);
      const mesh = new THREE.Mesh(merged, this.material);
      mesh.name = `${name} silhouette ${k + 1}`;
      // Drawn first, behind everything (it never writes depth).
      mesh.renderOrder = -1;
      mesh.frustumCulled = false;
      this.root.add(mesh);
    });
    const shapes = {
      whale: whaleShape(),
      manta: mantaShape(),
      school: schoolShape(53501),
    };
    this.geometries.push(shapes.whale, shapes.manta, shapes.school);
    for (const p of passers) {
      const mesh = new THREE.Mesh(shapes[p.kind], this.material);
      mesh.name = `${name} distant ${p.kind}`;
      mesh.renderOrder = -1;
      mesh.frustumCulled = false;
      mesh.scale.setScalar(p.scale);
      this.root.add(mesh);
      this.passers.push({ mesh, path: p });
    }
    this.update(0, true);
  }
  /** The far animals drift along their paths (on simulation time; still while paused). */
  update(dt: number, active: boolean): void {
    if (this.disposed || !active) return;
    this.time += Math.min(Math.max(dt, 0), 0.1);
    for (const { mesh, path } of this.passers) {
      const a = path.phase + this.time * path.speed,
        x = path.centre.x + Math.cos(a) * path.rx,
        z = path.centre.z + Math.sin(a) * path.rz,
        // Heading along the path (its tangent); +x is the shape's nose.
        dx = -Math.sin(a) * path.rx * Math.sign(path.speed),
        dz = Math.cos(a) * path.rz * Math.sign(path.speed);
      mesh.position.set(
        x,
        path.centre.y + 0.6 * Math.sin(this.time * 0.05 + path.phase),
        z,
      );
      mesh.rotation.set(
        0,
        Math.atan2(-dz, dx),
        0.04 * Math.sin(this.time * 0.3 + path.phase),
      );
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    this.geometries.forEach((g) => g.dispose());
    this.material.dispose();
  }
}
