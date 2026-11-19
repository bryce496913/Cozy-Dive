import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { KELP, KELP_FRAME, PASSAGE } from '../../config/passage';
import type { ConvexCollider } from '../../player/collision';
import { boxCollider } from '../passage/Crevice';
import { rockShape } from '../RockGeometry';
import { rockCollider } from '../rockCollider';
import { STALKS } from './KelpStalks';
import {
  inGrottoClear,
  kelpFloor,
  kelpSeabed,
  laneWeight,
  overSinkhole,
  sinkholeDip,
} from './KelpTerrain';
import { SINKHOLE } from '../../config/wreck';
import { shaftColliders, shaftLining } from '../shared/Shaft';

/**
 * v0.6 Pass 032: the kelp forest's ground and walls. The tunnel from the cleft runs straight
 * south from its start (capped behind, where the darkness is deepest) through a rock wall, and
 * opens onto a rocky seabed with boulders, under a bright, distant surface. Everything solid is
 * sealed by colliders: the tunnel is the only way in or out. Owns its geometries and materials.
 */
export const KELP_LAYOUT = {
  boulders: 30,
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
      inGrottoClear(x, z, size * 0.6) ||
      (Math.abs(x) < STALKS.exitClear.halfWidth + 1 &&
        z > KELP.tunnel.wallZ - STALKS.exitClear.depth - 2) ||
      out.some((b) => Math.hypot(b.x - x, b.z - z) < (b.size + size) * 0.6)
    )
      continue;
    out.push({ x, y: kelpFloor(x, z), z, size, height, yaw });
  }
  return out;
}

/** v0.6 Pass 036: big rocks along the foot of the side and far walls (pure, deterministic). */
export function wallRockLayout(): Boulder[] {
  const rand = random(36021),
    w = KELP.walls,
    out: Boulder[] = [];
  const add = (x: number, z: number) => {
    const size = 2.4 + rand() * 2.6,
      height = size * (0.5 + rand() * 0.4);
    out.push({
      x,
      y: kelpFloor(x, z),
      z,
      size,
      height,
      yaw: rand() * Math.PI * 2,
    });
  };
  for (const side of [-1, 1])
    for (let z = KELP.tunnel.wallZ - 3; z > w.farZ; z -= 3 + rand() * 2.5)
      add(side * (w.x + 0.2 - rand() * 0.8), z);
  for (let x = -w.x; x < w.x; x += 3 + rand() * 2.5)
    add(x, w.farZ + 0.2 - rand() * 0.8);
  return out;
}

/** v0.6 Pass 052B: how far inside the side and far walls' line their colliders start (m). */
export const KELP_WALL_FACE = 1.2;

/** The seabed's colour at (x, z): pale sand in the lane, darker rubble elsewhere, dark in the sinkhole's funnel. */
function sandColour(x: number, z: number): [number, number, number] {
  const lane = laneWeight(x, z),
    speck = 0.08 * Math.sin(x * 3.1 + z * 2.3) * Math.sin(x * 1.7 - z * 2.9),
    // Darker rubble and shell grit between the rocks, paler sand in the lane.
    k =
      (0.3 + 0.26 * lane + speck) *
      (1 - 0.85 * (sinkholeDip(x, z) / SINKHOLE.funnel.depth));
  return [k * 0.98, k * 0.86, k * 0.64];
}
/** Sand within this distance of the sinkhole's centre is drawn by its finer collar (m). */
const COLLAR = SINKHOLE.radius + SINKHOLE.funnel.width + 0.6;

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
        // Dark rock, encrusted pinkish-brown (coralline algae) over the vertex mottling.
        color: 0x7d6a62,
        vertexColors: true,
        roughness: 0.96,
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
    // The sinkhole down to the shipwreck: a rock-lined shaft, darkening to black below.
    // Its lining starts under the funnel's lip, so the sand overlaps its top edge.
    const rim = kelpSeabed(SINKHOLE.x + SINKHOLE.radius, SINKHOLE.z),
      shaft = {
        x: SINKHOLE.x,
        z: SINKHOLE.z,
        radius: SINKHOLE.radius,
        top: rim - 0.1,
        bottom: SINKHOLE.bottom,
      };
    this.add(
      shaftLining(
        shaft,
        (y) =>
          Math.max(0.02, 0.35 * (1 - (rim - y) / (rim - SINKHOLE.threshold))),
        3,
      ),
      this.own(
        new THREE.MeshStandardMaterial({
          name: 'Kelp sinkhole',
          vertexColors: true,
          roughness: 0.96,
          side: THREE.BackSide,
        }),
      ),
      'Kelp sinkhole',
    );
    const floor = new THREE.CircleGeometry(SINKHOLE.radius + 0.8, 20);
    floor.rotateX(-Math.PI / 2);
    floor.translate(SINKHOLE.x, SINKHOLE.bottom, SINKHOLE.z);
    floor.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(
        new Float32Array(floor.getAttribute('position').count * 3).fill(0.01),
        3,
      ),
    );
    this.add(floor, sand, 'Kelp sinkhole floor');
    this.boulders = boulderLayout();
    const colliders: ConvexCollider[] = [
      ...this.tunnelColliders(),
      ...this.wallColliders(),
      // The shaft's rock, just below the sand's rim (so the swimmer glides over the rim and down).
      ...shaftColliders(
        { ...shaft, top: rim - 0.4, bottom: SINKHOLE.bottom - 1 },
        1.4,
      ),
    ];
    const rocks: THREE.BufferGeometry[] = [],
      m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      e = new THREE.Euler();
    this.boulders.forEach((b, i) => {
      const g = rockShape(32100 + (i % 12) * 17, i % 4, 3);
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
    // v0.6 Pass 036: big rocks piled along the foot of the tank's walls.
    wallRockLayout().forEach((b, i) => {
      const g = rockShape(36100 + (i % 12) * 7, i % 4, 2);
      g.computeBoundingBox();
      const box = g.boundingBox!,
        size = box.getSize(new THREE.Vector3()),
        centre = box.getCenter(new THREE.Vector3());
      e.set(0, b.yaw, 0);
      q.setFromEuler(e);
      m.compose(
        new THREE.Vector3(b.x, b.y + b.height * 0.25, b.z),
        q,
        new THREE.Vector3(b.size / size.x, b.height / size.y, b.size / size.z),
      ).multiply(
        new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z),
      );
      colliders.push(rockCollider(g, m));
      rocks.push(g.applyMatrix4(m));
    });
    const merged = mergeGeometries(rocks, false);
    rocks.forEach((g) => g.dispose());
    if (merged) this.add(merged, this.rock, 'Kelp boulders');
    this.add(this.tankWalls(), this.rock, 'Kelp tank walls');
    colliders.push(...this.tankWallColliders());
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
      pos.setY(i, kelpSeabed(x, z));
      colors.push(...sandColour(x, z));
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    // Open round the sinkhole: drop the coarse triangles there; a finer collar of sand (drawn
    // with the seabed) slopes smoothly down to the shaft's round lip instead.
    const flat = g.toNonIndexed();
    g.dispose();
    const p = flat.getAttribute('position'),
      n = flat.getAttribute('normal'),
      c = flat.getAttribute('color'),
      keep: number[] = [],
      normals: number[] = [],
      tints: number[] = [];
    for (let t = 0; t < p.count; t += 3) {
      let inside = true;
      for (let k = t; k < t + 3; k++)
        if (!overSinkhole(p.getX(k), p.getZ(k), COLLAR - SINKHOLE.radius - 0.4))
          inside = false;
      if (inside) continue;
      for (let k = t; k < t + 3; k++) {
        keep.push(p.getX(k), p.getY(k), p.getZ(k));
        normals.push(n.getX(k), n.getY(k), n.getZ(k));
        tints.push(c.getX(k), c.getY(k), c.getZ(k));
      }
    }
    flat.dispose();
    // The collar: a fine ring from the lip out under the coarse mesh's ragged edge.
    const ring = new THREE.RingGeometry(
      SINKHOLE.radius + 0.02,
      COLLAR + 1.2,
      56,
      18,
    );
    ring.rotateX(-Math.PI / 2);
    ring.translate(SINKHOLE.x, 0, SINKHOLE.z);
    const rp = ring.getAttribute('position');
    for (let i = 0; i < rp.count; i++) {
      const x = rp.getX(i),
        z = rp.getZ(i);
      // Just under the coarse sand where they overlap, so the coarse mesh wins there.
      const r = Math.hypot(x - SINKHOLE.x, z - SINKHOLE.z);
      rp.setY(i, kelpSeabed(x, z) - (r > COLLAR - 0.6 ? 0.03 : 0));
    }
    const collar = ring.toNonIndexed();
    ring.dispose();
    collar.deleteAttribute('uv');
    const cp = collar.getAttribute('position');
    const tint: number[] = [];
    for (let i = 0; i < cp.count; i++)
      tint.push(...sandColour(cp.getX(i), cp.getZ(i)));
    collar.setAttribute('color', new THREE.Float32BufferAttribute(tint, 3));
    collar.computeVertexNormals();
    const base = new THREE.BufferGeometry();
    base.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
    base.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    base.setAttribute('color', new THREE.Float32BufferAttribute(tints, 3));
    const out = mergeGeometries([base, collar], false);
    base.dispose();
    collar.dispose();
    if (!out) throw Error('The kelp seabed could not be built');
    return out;
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
  /**
   * v0.6 Pass 036: the tank's rock walls on the sides and far end: lumpy faces of stacked rock
   * rising from the seabed past the surface, bulging out up to a metre or so from their line.
   */
  private tankWalls(): THREE.BufferGeometry {
    const w = KELP.walls,
      faces: THREE.BufferGeometry[] = [],
      y0 = -3,
      y1 = KELP.surfaceY + 4,
      near = KELP.tunnel.wallZ + 2;
    // Each face: a start and end along the wall's line, and its inward direction.
    const lines: [number, number, number, number, number, number][] = [
      // x0, z0, x1, z1, inward x, inward z
      [-w.x, near, -w.x, w.farZ - 2, 1, 0],
      [w.x, w.farZ - 2, w.x, near, -1, 0],
      [-w.x - 2, w.farZ, w.x + 2, w.farZ, 0, 1],
    ];
    for (const [x0, z0, x1, z1, nx, nz] of lines) {
      const length = Math.hypot(x1 - x0, z1 - z0),
        g = new THREE.PlaneGeometry(
          length,
          y1 - y0,
          Math.ceil(length / 0.8),
          Math.ceil((y1 - y0) / 0.8),
        ),
        pos = g.getAttribute('position'),
        colors: number[] = [];
      for (let i = 0; i < pos.count; i++) {
        const u = (pos.getX(i) + length / 2) / length,
          y = pos.getY(i) + (y0 + y1) / 2,
          x = x0 + (x1 - x0) * u,
          z = z0 + (z1 - z0) * u,
          // Stacked boulders: broad lumps, smaller lumps on them, and cracks between.
          a = x * 0.37 + z * 0.37,
          lump =
            0.5 +
            0.5 * Math.sin(a * 0.9 + y * 0.55) * Math.sin(a * 0.45 - y * 0.8),
          small =
            0.5 +
            0.5 * Math.sin(a * 2.3 + y * 1.9) * Math.sin(a * 1.7 - y * 2.2),
          crack = Math.abs(Math.sin(a * 0.6 + Math.sin(y * 0.4) * 1.2)),
          bulge = 1.1 * lump + 0.25 * small - 0.35 * (1 - crack),
          floor = kelpFloor(x, z),
          // The foot of the wall sits in the sand.
          base = y < floor ? floor : y;
        pos.setXYZ(i, x + nx * bulge, base, z + nz * bulge);
        const tone =
            (0.24 + lump * 0.14 + small * 0.06) * (0.55 + 0.45 * crack),
          // Coralline pink low down, olive and brown above.
          pink = Math.max(0, 1 - (y - floor) / 6);
        colors.push(
          tone * (0.95 + 0.1 * pink),
          tone * (0.85 - 0.1 * pink),
          tone * (0.72 + 0.05 * pink),
        );
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      g.deleteAttribute('uv');
      faces.push(g);
    }
    const merged = mergeGeometries(faces, false)!;
    faces.forEach((g) => g.dispose());
    // Each face's winding (along its line, then up) already faces into the forest.
    merged.computeVertexNormals();
    return merged;
  }
  /** Solid rock behind the tank's side and far walls. */
  private tankWallColliders(): ConvexCollider[] {
    const b = KELP.bounds,
      w = KELP.walls;
    return [
      boxCollider(
        [b.min.x - 1, b.min.y - 1, b.min.z - 1],
        [-w.x, b.max.y + 1, b.max.z + 1],
      ),
      boxCollider(
        [w.x, b.min.y - 1, b.min.z - 1],
        [b.max.x + 1, b.max.y + 1, b.max.z + 1],
      ),
      boxCollider(
        [b.min.x - 1, b.min.y - 1, b.min.z - 1],
        [b.max.x + 1, b.max.y + 1, w.farZ],
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
    // v0.6 Pass 052B: the side and far walls are solid just inside their rocky face, so the rock
    // itself stops the swimmer (the easing now starts only a few metres short of it).
    const w = KELP.walls,
      face = KELP_WALL_FACE;
    return [
      boxCollider(
        [w.x - face, b.min.y - 1, w.farZ - 4],
        [b.max.x + 1, b.max.y + 1, z0],
      ),
      boxCollider(
        [b.min.x - 1, b.min.y - 1, w.farZ - 4],
        [-w.x + face, b.max.y + 1, z0],
      ),
      boxCollider(
        [b.min.x - 1, b.min.y - 1, b.min.z - 1],
        [b.max.x + 1, b.max.y + 1, w.farZ + face],
      ),
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
