import { CAVE_SIGHTS, type Sight } from '../../discovery/sights';
import type { SightCandidate } from '../../discovery/journal';
import * as THREE from 'three';
import { smoothed } from '../shared/organicGeometry';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAVE } from '../../config/passage';
import { caveFloor, wallPoint } from './CaveTerrain';
import { krillShape } from '../ice/IceCritterShapes';

/**
 * Playtest (a cave that feels alive): the life that coats real sea-cave walls, and the tiny
 * drifters that hang in its one shaft of light. All peaceful, all fixed or gently drifting.
 *   - **Encrusting sponges:** low, lobed cushions in orange, yellow and violet, with open oscula,
 *     spreading over the lower walls and the roof.
 *   - **Tube sponges:** clusters of three to five tapering, open-mouthed tubes standing out from
 *     the rock.
 *   - **Sea squirts:** little glassy barrels in clusters, each with its two siphons.
 *   - **Mysids:** a loose swarm of tiny pale shrimp hovering in the sunbeam under the skylight,
 *     drifting as one, each on its own small wander (still with reduced motion).
 */
export const CAVE_ENCRUSTING = {
  seed: 9137,
  cushions: 90,
  tubeClusters: 26,
  squirtClusters: 34,
  mysids: 70,
  /** The swarm's column under the skylight: its radius (m) and its height above the sand. */
  swarm: { radius: 1.1, low: 1.2, high: 3.4 },
} as const;
type RGB = readonly [number, number, number];
const SPONGE: readonly RGB[] = [
  [0.95, 0.45, 0.12],
  [0.98, 0.78, 0.18],
  [0.55, 0.3, 0.68],
  [0.9, 0.3, 0.25],
];

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** Positions and normals only, non-indexed, light vertex shading kept in `color`. */
function shaded(
  g: THREE.BufferGeometry,
  tone: (p: THREE.Vector3) => number,
): THREE.BufferGeometry {
  // V0.7 Pass 069: creased normals (smooth across gentle bends), kept through the merge.
  const out = smoothed(g);
  const p = out.getAttribute('position'),
    c = new Float32Array(p.count * 3),
    v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const k = tone(v.fromBufferAttribute(p, i));
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k;
  }
  out.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return out;
}
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const m = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!m) throw Error('Cave life could not be built');
  return m;
}

/** A low, lobed sponge cushion on y 0 (about 30 cm across), pocked with dark oscula. */
export function cushionGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      a = Math.atan2(z, x),
      lobe = 1 + 0.22 * Math.sin(a * 5) + 0.1 * Math.sin(a * 11 + 1),
      bumps = 1 + 0.12 * Math.sin(x * 9) * Math.sin(z * 8);
    p.setXYZ(i, x * 0.15 * lobe, y * 0.045 * bumps, z * 0.13 * lobe);
  }
  return shaded(g, (v) => {
    // Dark pits where the oscula open on the upper surface.
    const pit = Math.max(0, Math.sin(v.x * 70) * Math.sin(v.z * 64) - 0.82);
    return v.y > 0.02 && pit > 0 ? 0.35 : 0.8 + v.y * 3;
  });
}
/** A cluster of open-mouthed tube sponges on y 0 (up to about 25 cm tall). */
export function tubeClusterGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    tubes = [
      [0, 0, 0.24, 0.035, 0],
      [0.05, 0.02, 0.18, 0.03, 0.25],
      [-0.045, 0.03, 0.15, 0.028, -0.3],
      [0.015, -0.05, 0.2, 0.032, 0.15],
      [-0.03, -0.04, 0.11, 0.024, -0.2],
    ] as const;
  for (const [x, z, h, r, lean] of tubes) {
    // Open-ended, flaring a little at the lip; the inside is dark.
    const outer = new THREE.CylinderGeometry(r * 1.15, r * 0.8, h, 14, 4, true),
      inner = new THREE.CylinderGeometry(
        r * 0.95,
        r * 0.65,
        h * 0.98,
        14,
        1,
        true,
      );
    for (const [g, k] of [
      [outer, 0.85],
      [inner, 0.3],
    ] as const) {
      g.translate(0, h / 2, 0);
      g.rotateZ(lean);
      g.translate(x, 0, z);
      parts.push(shaded(g, (v) => k * (0.85 + 0.6 * v.y)));
    }
  }
  return merge(parts);
}
/** A cluster of sea squirts on y 0: glassy barrels (about 5 cm) each with two siphons. */
export function squirtClusterGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 6; k++) {
    const a = k * 2.4,
      d = k === 0 ? 0 : 0.03 + (k % 2) * 0.015,
      x = Math.cos(a) * d,
      z = Math.sin(a) * d,
      h = 0.045 + (k % 3) * 0.01,
      body = new THREE.CylinderGeometry(0.014, 0.017, h, 12, 4);
    const p = body.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / h + 0.5,
        bulge = 1 + 0.25 * Math.sin(y * Math.PI);
      p.setX(i, p.getX(i) * bulge);
      p.setZ(i, p.getZ(i) * bulge);
    }
    body.translate(x, h / 2, z);
    parts.push(shaded(body, (v) => 0.75 + 2 * v.y));
    // The in- and out-flowing siphons at the top, one a little lower.
    for (const [sx, up] of [
      [-0.006, 0.012],
      [0.007, 0.007],
    ] as const) {
      const siphon = new THREE.CylinderGeometry(0.004, 0.006, up, 8, 1, true);
      siphon.translate(x + sx, h + up / 2, z);
      parts.push(shaded(siphon, () => 1));
    }
  }
  return merge(parts);
}

export class CaveEncrusting {
  readonly root = new THREE.Group();
  readonly sightings: SightCandidate[] = [];
  private readonly mysidAt: THREE.Vector3[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly mysids: THREE.InstancedMesh;
  private readonly home: Float32Array;
  private readonly phase: Float32Array;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3(1, 1, 1);
  private time = 0;
  private disposed = false;

  constructor(beamTop: number) {
    this.root.name = 'Cave walls life';
    const rand = random(CAVE_ENCRUSTING.seed),
      c = CAVE.chamber,
      up = new THREE.Vector3(0, 1, 0),
      n = new THREE.Vector3(),
      p = { x: 0, y: 0, z: 0 },
      colour = new THREE.Color();
    /** A point on the wall or roof, facing into the cavern, set just into the rock. */
    const onWall = (low: number, high: number): THREE.Vector3 => {
      let tries = 0;
      do {
        const a = rand() * Math.PI * 2,
          uy = low + rand() * (high - low),
          h = Math.sqrt(Math.max(0, 1 - uy * uy));
        wallPoint(Math.sin(a) * h, uy, Math.cos(a) * h, p);
      } while (
        (p.y < caveFloor(p.x, p.z) + 0.4 ||
          // Keep the tunnels' mouths and the skylight clear.
          p.z > c.z + c.rz * 0.75 ||
          Math.hypot(p.x - CAVE.skylight.x, p.z - CAVE.skylight.z) <
            CAVE.skylight.radius + 0.8) &&
        ++tries < 24
      );
      n.set(c.x - p.x, c.y - p.y, c.z - p.z).normalize();
      return new THREE.Vector3(p.x, p.y, p.z).addScaledVector(n, -0.02);
    };
    const place = (
      geometry: THREE.BufferGeometry,
      count: number,
      low: number,
      high: number,
      size: () => number,
      tint: () => RGB,
      material: THREE.Material,
      name: string,
      sight: Sight,
    ) => {
      this.geometries.push(geometry);
      this.materials.push(material);
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      mesh.name = name;
      for (let i = 0; i < count; i++) {
        const at = onWall(low, high);
        this.sightings.push({ ...sight, position: at, radius: 0.6 });
        this.q.setFromUnitVectors(up, n);
        this.q.multiply(
          new THREE.Quaternion().setFromAxisAngle(up, rand() * Math.PI * 2),
        );
        mesh.setMatrixAt(
          i,
          this.m.compose(at, this.q, this.s.setScalar(size())),
        );
        const [r, g, b] = tint();
        mesh.setColorAt(i, colour.setRGB(r, g, b));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.root.add(mesh);
    };
    const sponge = () => SPONGE[Math.floor(rand() * SPONGE.length)];
    const fleshy = () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.85,
        metalness: 0,
      });
    // Cushions everywhere from the lower walls to the roof; tubes on the walls; squirts in the
    // shade lower down.
    place(
      cushionGeometry(),
      CAVE_ENCRUSTING.cushions,
      -0.1,
      0.92,
      () => 0.6 + rand() * 1.1,
      sponge,
      fleshy(),
      'Encrusting sponges',
      CAVE_SIGHTS.encrustingSponge,
    );
    place(
      tubeClusterGeometry(),
      CAVE_ENCRUSTING.tubeClusters,
      -0.05,
      0.55,
      () => 0.7 + rand() * 0.7,
      sponge,
      fleshy(),
      'Tube sponges',
      CAVE_SIGHTS.tubeSponge,
    );
    place(
      squirtClusterGeometry(),
      CAVE_ENCRUSTING.squirtClusters,
      -0.1,
      0.45,
      () => 0.8 + rand() * 0.6,
      () => (rand() < 0.5 ? [0.82, 0.9, 0.95] : [0.95, 0.88, 0.62]),
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.2,
        metalness: 0,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      }),
      'Sea squirts',
      CAVE_SIGHTS.seaSquirt,
    );

    // Mysids: a loose swarm hovering in the sunbeam's column.
    const mysid = krillShape();
    mysid.scale(0.7, 0.7, 0.7);
    this.geometries.push(mysid);
    const mysidMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.4,
      metalness: 0,
      color: 0xf3efe6,
      emissive: 0x332a20,
    });
    this.materials.push(mysidMaterial);
    const count = CAVE_ENCRUSTING.mysids,
      sw = CAVE_ENCRUSTING.swarm,
      sky = CAVE.skylight,
      floor = caveFloor(sky.x, sky.z),
      high = Math.min(floor + sw.high, beamTop - 1);
    this.mysids = new THREE.InstancedMesh(mysid, mysidMaterial, count);
    this.mysids.name = 'Mysid swarm';
    this.mysids.frustumCulled = false;
    this.home = new Float32Array(count * 3);
    this.phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2,
        r = Math.sqrt(rand()) * sw.radius;
      this.home[i * 3] = sky.x + Math.cos(a) * r;
      this.home[i * 3 + 1] = floor + sw.low + rand() * (high - floor - sw.low);
      this.home[i * 3 + 2] = sky.z + Math.sin(a) * r;
      this.phase[i] = rand() * 100;
      const at = new THREE.Vector3();
      this.mysidAt.push(at);
      this.sightings.push({ ...CAVE_SIGHTS.mysid, position: at, radius: 0.25 });
    }
    this.root.add(this.mysids);
    this.update(0, true, true);
  }
  /** The mysids hover and drift (seconds of simulation); still with reduced motion. */
  update(dt: number, active: boolean, reducedMotion: boolean): void {
    if (this.disposed || !active) return;
    if (!reducedMotion) this.time += Math.min(dt, 0.1);
    const t = this.time,
      // The whole swarm faces into a slowly turning current, as a swarm does.
      heading = 0.6 * Math.sin(t * 0.07);
    for (let i = 0; i < this.phase.length; i++) {
      const ph = this.phase[i];
      this.p.set(
        this.home[i * 3] + 0.25 * Math.sin(t * 0.31 + ph),
        this.home[i * 3 + 1] + 0.12 * Math.sin(t * 0.47 + ph * 1.7),
        this.home[i * 3 + 2] + 0.25 * Math.cos(t * 0.27 + ph * 0.6),
      );
      this.mysidAt[i].copy(this.p);
      this.e.set(0.1 * Math.sin(t * 0.9 + ph), heading + 0.3 * Math.sin(ph), 0);
      this.q.setFromEuler(this.e);
      this.mysids.setMatrixAt(
        i,
        this.m.compose(this.p, this.q, this.s.set(1, 1, 1)),
      );
    }
    this.mysids.instanceMatrix.needsUpdate = true;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.dispose();
    });
    this.root.clear();
    this.sightings.length = 0;
    this.mysidAt.length = 0;
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
