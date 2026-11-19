import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Playtest (small life on the reef): Christmas tree worms set into the massive coral colonies.
 * Each worm shows a pair of little spiral plumes (a few centimetres tall) in its own bright
 * colour, turning gently in the current. Shy, never alarming: when the swimmer comes close they
 * whisk back into their tubes, then slowly unfurl again once left alone.
 */
export const XMAS_WORMS = {
  seed: 2207,
  /** Worms tried per colony, and the most on the whole reef. */
  perColony: 4,
  max: 420,
  /** The swimmer's distance (m) at which a worm hides, and (further) at which it may come out. */
  hide: 1.6,
  emerge: 2.4,
  /** Seconds to hide (quick) and to unfurl again (slow). */
  hideTime: 0.15,
  emergeTime: 4,
  /** Only worms within this distance (m) of the eye are animated each frame. */
  near: 16,
} as const;
type RGB = readonly [number, number, number];
const COLOURS: readonly RGB[] = [
  [0.95, 0.25, 0.2],
  [0.98, 0.65, 0.12],
  [0.98, 0.9, 0.25],
  [0.25, 0.55, 0.95],
  [0.92, 0.95, 0.98],
  [0.6, 0.3, 0.85],
  [0.2, 0.75, 0.55],
];

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Two spiral plumes side by side on y 0 (about 4 cm tall), shaded darker at the base. */
export function wormPlumes(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    // A spiral staircase of tiny gill fans winding up a cone.
    const turns = 5,
      steps = 30;
    for (let i = 0; i < steps; i++) {
      const u = i / steps,
        a = u * turns * Math.PI * 2 * side,
        r = 0.013 * (1 - u) + 0.002,
        fan = new THREE.ConeGeometry(r * 0.9, 0.004, 6, 1, true);
      fan.rotateZ(Math.PI / 2 - 0.5);
      fan.rotateY(-a);
      fan.translate(Math.cos(a) * r, 0.004 + u * 0.034, Math.sin(a) * r);
      parts.push(fan);
    }
    const stem = new THREE.CylinderGeometry(0.0015, 0.002, 0.036, 5);
    stem.translate(0, 0.02, 0);
    parts.push(stem);
    for (const g of parts.slice(-steps - 1)) g.translate(side * 0.011, 0, 0);
  }
  const m = mergeGeometries(
    parts.map((g) => {
      const out = g.index ? g.toNonIndexed() : g;
      if (out !== g) g.dispose();
      for (const n of Object.keys(out.attributes))
        if (n !== 'position' && n !== 'normal') out.deleteAttribute(n);
      return out;
    }),
    false,
  );
  parts.forEach((g) => g.dispose());
  if (!m) throw Error('Christmas tree worms could not be built');
  const p = m.getAttribute('position'),
    c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++)
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = 0.55 + 12 * p.getY(i);
  m.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  m.computeVertexNormals();
  return m;
}

/**
 * How far out (0 hidden … 1 open) a worm is after `dt` seconds, with the swimmer `distance`
 * metres away. Pure, for tests.
 */
export function wormOpenness(
  open: number,
  distance: number,
  dt: number,
): number {
  if (distance < XMAS_WORMS.hide)
    return Math.max(0, open - dt / XMAS_WORMS.hideTime);
  if (distance > XMAS_WORMS.emerge)
    return Math.min(1, open + dt / XMAS_WORMS.emergeTime);
  return open;
}

export class ChristmasTreeWorms {
  readonly root = new THREE.Group();
  private readonly geometry = wormPlumes();
  private readonly material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.55,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  private readonly mesh: THREE.InstancedMesh;
  private readonly base: THREE.Matrix4[] = [];
  private readonly at: THREE.Vector3[] = [];
  private readonly open: Float32Array;
  private readonly phase: Float32Array;
  private readonly m = new THREE.Matrix4();
  private readonly r = new THREE.Matrix4();
  private readonly sc = new THREE.Matrix4();
  private time = 0;
  private disposed = false;

  /** Seats worms on the colonies: `colonies` pairs a coral's geometry with its placements. */
  constructor(
    colonies: readonly {
      geometry: THREE.BufferGeometry;
      matrices: readonly THREE.Matrix4[];
    }[],
  ) {
    this.root.name = 'Christmas tree worms';
    const rand = random(XMAS_WORMS.seed),
      ray = new THREE.Raycaster(),
      probe = new THREE.Mesh(),
      hits: THREE.Intersection[] = [],
      down = new THREE.Vector3(0, -1, 0),
      up = new THREE.Vector3(0, 1, 0),
      box = new THREE.Box3(),
      normal = new THREE.Vector3(),
      q = new THREE.Quaternion(),
      spin = new THREE.Quaternion(),
      one = new THREE.Vector3(1, 1, 1),
      colours: RGB[] = [];
    probe.material = this.material;
    for (const { geometry, matrices } of colonies) {
      geometry.computeBoundingBox();
      probe.geometry = geometry;
      for (const matrix of matrices) {
        probe.matrixWorld.copy(matrix);
        box.copy(geometry.boundingBox ?? box.makeEmpty()).applyMatrix4(matrix);
        if (box.isEmpty()) continue;
        for (let k = 0; k < XMAS_WORMS.perColony; k++) {
          if (this.base.length >= XMAS_WORMS.max) break;
          // Drop a ray from above onto the colony's upper surface.
          const x = box.min.x + (0.2 + rand() * 0.6) * (box.max.x - box.min.x),
            z = box.min.z + (0.2 + rand() * 0.6) * (box.max.z - box.min.z);
          ray.set(new THREE.Vector3(x, box.max.y + 1, z), down);
          hits.length = 0;
          probe.raycast(ray, hits);
          const hit = hits.sort((a, b) => a.distance - b.distance)[0];
          if (!hit?.face) continue;
          normal.copy(hit.face.normal).transformDirection(matrix).normalize();
          // Only on the colony's upper faces, leaning out a little as they grow.
          if (normal.y < 0.35) continue;
          normal.lerp(up, 0.5).normalize();
          q.setFromUnitVectors(up, normal).multiply(
            spin.setFromAxisAngle(up, rand() * Math.PI * 2),
          );
          const s = 0.8 + rand() * 0.6;
          this.base.push(
            new THREE.Matrix4().compose(
              hit.point.clone().addScaledVector(normal, -0.004),
              q,
              one.clone().multiplyScalar(s),
            ),
          );
          this.at.push(hit.point.clone());
          colours.push(COLOURS[Math.floor(rand() * COLOURS.length)]);
        }
      }
    }
    const n = Math.max(1, this.base.length);
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, n);
    this.mesh.count = this.base.length;
    this.mesh.name = 'Christmas tree worms';
    const colour = new THREE.Color();
    this.base.forEach((b, i) => {
      this.mesh.setMatrixAt(i, b);
      const [r, g, bl] = colours[i];
      this.mesh.setColorAt(i, colour.setRGB(r, g, bl));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.computeBoundingSphere();
    this.open = new Float32Array(this.base.length).fill(1);
    this.phase = new Float32Array(this.base.length).map(() => rand() * 10);
    this.root.add(this.mesh);
  }
  get count(): number {
    return this.base.length;
  }
  /** Hide from a close swimmer, unfurl again slowly, turn gently in the current. */
  update(eye: THREE.Vector3, dt: number, reducedMotion: boolean): void {
    if (this.disposed || !this.base.length) return;
    const step = Math.min(Math.max(dt, 0), 0.1);
    if (!reducedMotion) this.time += step;
    const t = this.time;
    let changed = false;
    for (let i = 0; i < this.base.length; i++) {
      const d = this.at[i].distanceTo(eye);
      if (d > XMAS_WORMS.near) continue;
      const was = this.open[i],
        now = wormOpenness(was, d, step);
      this.open[i] = now;
      if (reducedMotion && now === was) continue;
      // Ease the plumes' size (out slowly, in quickly) and a gentle sway.
      const k = now * now * (3 - 2 * now),
        sway = reducedMotion ? 0 : 0.08 * Math.sin(t * 0.8 + this.phase[i]);
      this.sc.makeScale(0.15 + 0.85 * k, 0.05 + 0.95 * k, 0.15 + 0.85 * k);
      this.r.makeRotationZ(sway);
      this.m.multiplyMatrices(this.base[i], this.r).multiply(this.sc);
      this.mesh.setMatrixAt(i, this.m);
      changed = true;
    }
    if (changed) this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
