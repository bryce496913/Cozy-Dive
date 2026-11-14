import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { KELP, KELP_FRAME, PASSAGE } from '../../config/passage';
import type { ConvexCollider } from '../../player/collision';
import { boxCollider } from '../passage/Crevice';
import { createRockGeometry } from '../RockGeometry';
import { rockCollider } from '../rockCollider';
import { STALKS } from './KelpStalks';
import { kelpFloor, laneWeight } from './KelpTerrain';

/**
 * v0.6 Pass 032: the kelp forest's ground and walls. The tunnel from the cleft runs straight
 * south from its start (capped behind, where the darkness is deepest) through a rock wall, and
 * opens onto a rocky seabed with boulders, under a bright, distant surface. Everything solid is
 * sealed by colliders: the tunnel is the only way in or out. Owns its geometries and materials.
 */
export const KELP_LAYOUT = {
  boulders: 44,
  seed: 32033,
  /** The tunnel's colliders: a square duct a little inside its rock, and its rock's thickness. */
  duct: 1.22,
  wall: 0.6,
} as const;

export interface Boulder {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly size: number;
  readonly height: number;
  readonly yaw: number;
}
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** Boulders over the forest floor (pure): off the sandy lane and the tunnel's exit, apart. */
export function boulderLayout(): Boulder[] {
  const rand = random(KELP_LAYOUT.seed),
    f = KELP.forest,
    out: Boulder[] = [];
  for (
    let tries = 0;
    out.length < KELP_LAYOUT.boulders && tries < 4000;
    tries++
  ) {
    const x = -f.halfWidth + rand() * f.halfWidth * 2,
      z = f.minZ + rand() * (f.maxZ - f.minZ),
      size = 1.6 + rand() * 2.8,
      height = size * (0.45 + rand() * 0.35),
      yaw = rand() * Math.PI * 2;
    if (
      laneWeight(x, z) > 0.02 ||
      (Math.abs(x) < STALKS.exitClear.halfWidth + 1 &&
        z > KELP.tunnel.wallZ - STALKS.exitClear.depth - 2) ||
      out.some((b) => Math.hypot(b.x - x, b.z - z) < (b.size + size) * 0.6)
    )
      continue;
    out.push({ x, y: kelpFloor(x, z), z, size, height, yaw });
  }
  return out;
}

export class KelpEnvironment {
  readonly root = new THREE.Group();
  readonly colliders: readonly ConvexCollider[];
  readonly boulders: readonly Boulder[];
  /** The rock surfaces (wall, tunnel, boulders). */
  readonly rock: THREE.MeshStandardMaterial;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private disposed = false;
  constructor() {
    this.root.name = 'Kelp forest ground';
    this.rock = this.own(
      new THREE.MeshStandardMaterial({
        name: 'Kelp rock',
        vertexColors: true,
        roughness: 0.94,
      }),
    );
    const sand = this.own(
        new THREE.MeshStandardMaterial({
          name: 'Kelp seabed',
          vertexColors: true,
          roughness: 1,
        }),
      ),
      tunnel = this.own(
        new THREE.MeshStandardMaterial({
          name: 'Kelp tunnel',
          vertexColors: true,
          roughness: 0.95,
          side: THREE.DoubleSide,
        }),
      ),
      surface = this.own(
        new THREE.MeshBasicMaterial({
          name: 'Kelp surface',
          color: 0xb9e3c4,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        }),
      );
    this.add(this.seabed(), sand, 'Kelp seabed');
    this.add(this.wallMesh(), this.rock, 'Kelp wall');
    this.add(this.tunnelMesh(), tunnel, 'Kelp tunnel');
    this.boulders = boulderLayout();
    const colliders: ConvexCollider[] = [
      ...this.tunnelColliders(),
      ...this.wallColliders(),
    ];
    const rocks: THREE.BufferGeometry[] = [],
      m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      e = new THREE.Euler();
    this.boulders.forEach((b, i) => {
      const g = createRockGeometry(32100 + i * 17, i % 4);
      g.computeBoundingBox();
      const box = g.boundingBox!,
        size = box.getSize(new THREE.Vector3()),
        centre = box.getCenter(new THREE.Vector3());
      e.set(0, b.yaw, 0);
      q.setFromEuler(e);
      const scale = new THREE.Vector3(
        b.size / size.x,
        b.height / size.y,
        b.size / size.z,
      );
      // Sunk a third into the seabed, so it sits in it rather than on it.
      m.compose(
        new THREE.Vector3(b.x, b.y + b.height * 0.2, b.z),
        q,
        scale,
      ).multiply(
        new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z),
      );
      colliders.push(rockCollider(g, m));
      rocks.push(g.applyMatrix4(m));
    });
    const merged = mergeGeometries(rocks, false);
    rocks.forEach((g) => g.dispose());
    if (merged) this.add(merged, this.rock, 'Kelp boulders');
    const sky = new THREE.PlaneGeometry(260, 260);
    sky.rotateX(Math.PI / 2);
    sky.translate(0, KELP.surfaceY, -40);
    const top = this.add(sky, surface, 'Kelp surface');
    top.renderOrder = -1;
    this.colliders = colliders;
  }

  private own<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }
  private add(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    name: string,
  ): THREE.Mesh {
    this.geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.root.add(mesh);
    return mesh;
  }
  /** The forest floor as a height field: pale sand in the lane, darker rubble and rock elsewhere. */
  private seabed(): THREE.BufferGeometry {
    const b = KELP.bounds,
      w = b.max.x - b.min.x + 40,
      d = KELP.tunnel.wallZ + 4 - (b.min.z - 10),
      g = new THREE.PlaneGeometry(w, d, 120, 140);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, KELP.tunnel.wallZ + 4 - d / 2);
    const pos = g.getAttribute('position'),
      colors: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i);
      pos.setY(i, kelpFloor(x, z));
      const lane = laneWeight(x, z),
        speck =
          0.08 * Math.sin(x * 3.1 + z * 2.3) * Math.sin(x * 1.7 - z * 2.9),
        k = 0.42 + 0.3 * lane + speck;
      colors.push(k * 0.92, k * 0.88, k * 0.72);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }
  /** A rough rock wall across the forest's north side, open only at the tunnel's exit. */
  private wallMesh(): THREE.BufferGeometry {
    const R = KELP.tunnel.radius + 0.12,
      g = new THREE.RingGeometry(R, 90, 48, 26),
      pos = g.getAttribute('position'),
      colors: number[] = [],
      cy = KELP.tunnel.y;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        y = pos.getY(i),
        r = Math.hypot(x, y),
        rough =
          0.5 +
          0.5 * Math.sin(x * 0.31 + y * 0.23) * Math.sin(x * 0.17 - y * 0.41),
        fine = 0.5 + 0.5 * Math.sin(x * 1.3 + y * 1.1);
      const depth = Math.min(1.1, (r - R) * 0.55) + rough * 2.2 + fine * 0.35;
      pos.setXYZ(i, x, cy + y, KELP.tunnel.wallZ + Math.max(0, depth));
      const tone = 0.3 + rough * 0.18 + fine * 0.06;
      // Coralline pink and olive patches on dark rock.
      colors.push(tone * 0.95, tone * 0.82, tone * 0.78);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }
  /** Inside-facing tube from just behind its start to the wall, black at the start, lit at the exit. */
  private tunnelMesh(): THREE.BufferGeometry {
    const t = KELP.tunnel,
      from = t.startZ + 0.2,
      to = t.wallZ - 0.4,
      steps = 40,
      around = 28,
      positions: number[] = [],
      colors: number[] = [],
      indices: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const z = from + ((to - from) * i) / steps,
        past = KELP_FRAME.origin.z - z,
        light = Math.max(
          0,
          Math.min(1, (past - 0.4) / (PASSAGE.darkReach + 4)),
        );
      for (let j = 0; j <= around; j++) {
        const a = (j / around) * Math.PI * 2,
          bump = 0.12 * Math.sin(a * 3 + z * 1.7) * Math.sin(a * 5 - z * 0.9),
          r = t.radius + bump;
        positions.push(Math.cos(a) * r, t.y + Math.sin(a) * r, z);
        const tone =
          (0.08 + 0.32 * light * light) * (0.85 + 0.15 * Math.sin(a * 7 + z));
        colors.push(tone, tone * 0.95, tone * 0.85);
      }
    }
    for (let i = 0; i < steps; i++)
      for (let j = 0; j < around; j++) {
        const a = i * (around + 1) + j,
          b = a + around + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }
  /** A square duct a little inside the tube's rock, capped behind its start. */
  private tunnelColliders(): ConvexCollider[] {
    const t = KELP.tunnel,
      d = KELP_LAYOUT.duct,
      w = KELP_LAYOUT.wall,
      z0 = t.wallZ - 0.5,
      z1 = t.startZ + 0.6,
      y = t.y;
    return [
      boxCollider([d, y - d - w, z0], [d + w, y + d + w, z1]),
      boxCollider([-d - w, y - d - w, z0], [-d, y + d + w, z1]),
      boxCollider([-d - w, y + d, z0], [d + w, y + d + w, z1]),
      boxCollider([-d - w, y - d - w, z0], [d + w, y - d, z1]),
      boxCollider(
        [-d - w, y - d - w, t.startZ + 0.2],
        [d + w, y + d + w, z1 + w],
      ),
    ];
  }
  /** Everything behind the wall's face is rock, except the tunnel (sealed by its own duct). */
  private wallColliders(): ConvexCollider[] {
    const b = KELP.bounds,
      R = KELP.tunnel.radius,
      y = KELP.tunnel.y,
      z0 = KELP.tunnel.wallZ,
      z1 = z0 + 1.4;
    return [
      boxCollider([b.min.x - 1, b.min.y - 1, z0], [-R, b.max.y + 1, z1]),
      boxCollider([R, b.min.y - 1, z0], [b.max.x + 1, b.max.y + 1, z1]),
      boxCollider([-R, y + R, z0], [R, b.max.y + 1, z1]),
      boxCollider([-R, b.min.y - 1, z0], [R, y - R, z1]),
    ];
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
