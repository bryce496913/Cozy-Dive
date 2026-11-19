import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ICE } from '../../config/passage';
import { iceUndersideAt } from './IceTerrain';

/**
 * Playtest (life on the ice): the underside of Antarctic sea ice is stained brown-green by the
 * algae that grow in and under it, and sea angels (Clione, small naked sea snails) flap slowly
 * past beneath it. Both peaceful: the film is fixed; the sea angels drift on gentle loops, their
 * two wing-lobes beating (they hang still, wings slow, with reduced motion).
 */
export const ICE_UNDERSIDE = {
  seed: 4721,
  patches: 170,
  angels: 18,
  /** How far below the ice the sea angels wander (m). */
  band: { low: 1.2, high: 5 },
} as const;

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** Positions, normals and one flat colour, non-indexed, so parts merge. */
function coloured(
  g: THREE.BufferGeometry,
  c: readonly [number, number, number],
): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  for (const name of Object.keys(out.attributes))
    if (name !== 'position' && name !== 'normal') out.deleteAttribute(name);
  const n = out.getAttribute('position').count,
    col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set(c, i * 3);
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeVertexNormals();
  return out;
}

/** An irregular, soft-edged algal patch facing down (about 1.6 m across), centre darker. */
function patchGeometry(): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(0.8, 24, 0, Math.PI * 2),
    p = g.getAttribute('position'),
    c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      a = Math.atan2(y, x),
      r = 1 + 0.3 * Math.sin(a * 3 + 1) + 0.15 * Math.sin(a * 7);
    p.setXY(i, x * r, y * r * 0.8);
    const k = Math.hypot(x, y) < 0.01 ? 0.75 : 1;
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k;
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  // Face down from the ice.
  g.rotateX(Math.PI / 2);
  return g;
}
/** A sea angel's body, head up (about 3 cm): translucent, with its orange gut and head-cap. */
function angelBody(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12,
      r =
        0.006 * Math.sin(Math.PI * Math.pow(u, 0.7)) * (1 - 0.35 * u) + 0.0005;
    pts.push(new THREE.Vector2(r, u * 0.03));
  }
  const body = coloured(new THREE.LatheGeometry(pts, 12), [0.86, 0.9, 0.95]),
    gut = new THREE.SphereGeometry(0.0032, 10, 8);
  gut.scale(1, 1.6, 1);
  gut.translate(0, 0.012, 0);
  const cap = new THREE.SphereGeometry(0.0026, 10, 6);
  cap.translate(0, 0.027, 0);
  const parts = [
    body,
    coloured(gut, [0.98, 0.45, 0.12]),
    coloured(cap, [0.95, 0.55, 0.25]),
  ];
  const m = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!m) throw Error('Sea angels could not be built');
  return m;
}
/** One wing-lobe, from its root on the neck out along +x: a thin rounded paddle. */
function angelWing(): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(0.006, 14);
  g.scale(1, 0.55, 1);
  g.translate(0.006, 0, 0);
  return coloured(g, [0.9, 0.92, 0.97]);
}

export class IceUnderside {
  readonly root = new THREE.Group();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly bodies: THREE.InstancedMesh;
  private readonly wings: THREE.InstancedMesh;
  private readonly home: Float32Array;
  private readonly phase: Float32Array;
  private readonly m = new THREE.Matrix4();
  private readonly w = new THREE.Matrix4();
  private readonly r = new THREE.Matrix4();
  private readonly flip = new THREE.Matrix4().makeRotationY(Math.PI);
  private readonly neck = new THREE.Matrix4().makeTranslation(0, 0.02, 0);
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3(1, 1, 1);
  /** Drawn a little large (about 5 cm), so they read at swimming distance. */
  private readonly size = new THREE.Vector3(1.6, 1.6, 1.6);
  private time = 0;
  private disposed = false;

  constructor() {
    this.root.name = 'Under-ice algae and sea angels';
    const rand = random(ICE_UNDERSIDE.seed),
      w = ICE.walls,
      nearZ = ICE.tunnel.wallZ - 1,
      colour = new THREE.Color(),
      up = new THREE.Vector3(0, 1, 0),
      clear = (x: number, z: number, margin: number) =>
        ICE.holes.every((h) => Math.hypot(x - h.x, z - h.z) > h.r + margin);

    // Algae film: brown-green patches, just under the ice, none at the holes' rims.
    const patch = patchGeometry();
    const film = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.geometries.push(patch);
    this.materials.push(film);
    const patches = new THREE.InstancedMesh(patch, film, ICE_UNDERSIDE.patches);
    patches.name = 'Ice algae';
    for (let i = 0; i < ICE_UNDERSIDE.patches; i++) {
      let x: number,
        z: number,
        tries = 0;
      do {
        x = (rand() * 2 - 1) * (w.x - 1);
        z = nearZ + rand() * (w.farZ + 1 - nearZ);
      } while (!clear(x, z, 2.5) && ++tries < 20);
      this.q.setFromAxisAngle(up, rand() * Math.PI * 2);
      this.p.set(x, iceUndersideAt(x, z) - 0.06, z);
      this.s.set(0.8 + rand() * 1.4, 1, 0.8 + rand() * 1.4);
      patches.setMatrixAt(i, this.m.compose(this.p, this.q, this.s));
      const k = rand();
      patches.setColorAt(
        i,
        colour.setRGB(0.42 + 0.1 * k, 0.36 + 0.08 * k, 0.16 + 0.05 * k),
      );
    }
    this.s.set(1, 1, 1);
    patches.instanceMatrix.needsUpdate = true;
    if (patches.instanceColor) patches.instanceColor.needsUpdate = true;
    this.root.add(patches);

    // Sea angels: a translucent body and its two wing-lobes (two instances per angel).
    const n = ICE_UNDERSIDE.angels,
      body = angelBody(),
      wing = angelWing(),
      flesh = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.3,
        metalness: 0,
        transparent: true,
        opacity: 0.8,
        emissive: 0x221410,
      }),
      sail = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.3,
        metalness: 0,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
    this.geometries.push(body, wing);
    this.materials.push(flesh, sail);
    this.bodies = new THREE.InstancedMesh(body, flesh, n);
    this.bodies.name = 'Sea angels';
    this.wings = new THREE.InstancedMesh(wing, sail, n * 2);
    this.wings.name = 'Sea angel wings';
    this.bodies.frustumCulled = this.wings.frustumCulled = false;
    this.home = new Float32Array(n * 3);
    this.phase = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let x: number,
        z: number,
        tries = 0;
      do {
        x = (rand() * 2 - 1) * (w.x - 4);
        z = nearZ - 3 + rand() * (w.farZ + 6 - nearZ);
      } while (!clear(x, z, 1.5) && ++tries < 20);
      const b = ICE_UNDERSIDE.band;
      this.home[i * 3] = x;
      this.home[i * 3 + 1] =
        iceUndersideAt(x, z) - b.low - rand() * (b.high - b.low);
      this.home[i * 3 + 2] = z;
      this.phase[i] = rand() * 100;
    }
    this.root.add(this.bodies, this.wings);
    this.update(0, true, false);
  }
  /** Sea angels drift on slow loops, wings beating (seconds of simulation). */
  update(dt: number, active: boolean, reducedMotion: boolean): void {
    if (this.disposed || !active) return;
    const step = Math.min(Math.max(dt, 0), 0.1);
    this.time += reducedMotion ? step * 0.3 : step;
    const t = this.time;
    for (let i = 0; i < this.phase.length; i++) {
      const ph = this.phase[i],
        // A slow figure loop, rising a little on each beat.
        lx = 0.6 * Math.sin(t * 0.05 + ph),
        lz = 0.6 * Math.sin(t * 0.07 + ph * 1.3),
        beat = Math.sin(t * (reducedMotion ? 1.2 : 3.2) + ph);
      this.p.set(
        this.home[i * 3] + lx,
        this.home[i * 3 + 1] + 0.25 * Math.sin(t * 0.11 + ph) + 0.004 * beat,
        this.home[i * 3 + 2] + lz,
      );
      // Mostly head-up, leaning into its drift, turning slowly.
      this.e.set(
        0.25 * Math.cos(t * 0.07 + ph * 1.3),
        t * 0.08 + ph,
        -0.25 * Math.cos(t * 0.05 + ph),
        'YXZ',
      );
      this.q.setFromEuler(this.e);
      this.m.compose(this.p, this.q, this.size);
      this.bodies.setMatrixAt(i, this.m);
      // Wing-lobes on the neck, beating up and down together like a pair of oars.
      this.m.multiply(this.neck);
      this.r.makeRotationZ(0.6 * beat);
      this.wings.setMatrixAt(i * 2, this.w.multiplyMatrices(this.m, this.r));
      this.w.multiplyMatrices(this.m, this.flip).multiply(this.r);
      this.wings.setMatrixAt(i * 2 + 1, this.w);
    }
    this.bodies.instanceMatrix.needsUpdate = true;
    this.wings.instanceMatrix.needsUpdate = true;
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
  }
}
