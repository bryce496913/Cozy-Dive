import { limestoneGeometry } from '../shared/LimestoneGeometry';
import { HabitatSurface } from '../shared/HabitatSurface';
import * as THREE from 'three';
import {
  mergeGeometries,
  mergeVertices,
} from 'three/addons/utils/BufferGeometryUtils.js';
import { CAVE, CAVE_FRAME, PASSAGE } from '../../config/passage';
import type { Vec3 } from '../../config/world';
import type { ConvexCollider } from '../../player/collision';
import { boxCollider } from '../passage/Crevice';
import {
  icicles,
  tunnelThroat,
  mouthCollar,
  rockTubeColliders,
  rockTubeGeometry,
} from '../shared/RockTube';
import { createRockGeometry, rockShape } from '../RockGeometry';
import { rockCollider } from '../rockCollider';
import { faceByBisection, mouthArch } from '../shared/MouthArch';
import { seaFan } from '../wreck/WreckGrowth';
import {
  strapAlgaGeometry,
  SwayingAlgae,
  type AlgaPlacement,
} from '../shared/LargeLife';
import { CAVE_LIFE } from './CaveLife';
import { caveFloor, chamberDepth, wallLumps, wallPoint } from './CaveTerrain';

/**
 * V0.7 Pass 080: the stone of the rocks heaped round the cave's two tunnel mouths, matched to the
 * cavern's limestone boulders (their vertex tone under the 'Cave limestone' tint). They used the
 * ice world's dark basalt and read as a ring of blue-slate rubble in a pale cave.
 */
const CAVE_MOUTH_STONE = [0.44, 0.4, 0.31] as const;
/** V0.8 Pass 086: whether a point is beyond the dome's wall (in the rock). */
const inCaveRock = (x: number, y: number, z: number): boolean =>
  chamberDepth({ x, y, z }) >= 1;

/**
 * v0.6 Pass 034: the sea cave's rock and sand. A tunnel from the grotto runs south into a dome of
 * pale limestone, lumpy and stained darker low down. Through a hole in its roof a shaft of sunlight
 * falls to a pool of light on the sand. Boulders lie around its edges, with lobsters' cracks at
 * their feet, and small sponges glow faintly on the lower walls at the back. The tunnel is sealed
 * by colliders; the cavern's walls by soft limits (`easeInCave`). Owns its GPU resources.
 */
export const CAVE_LAYOUT = {
  /** The tunnel's colliders: a square duct a little inside its rock, and its rock's thickness. */
  duct: 1.22,
  wall: 0.6,
  /** Glowing sponges on the lower walls at the back. */
  sponges: 70,
  seed: 34017,
} as const;

/** A boulder on the cavern floor (x, z, footprint and height, m). */
export interface CaveRock {
  readonly x: number;
  readonly z: number;
  readonly size: number;
  readonly height: number;
  readonly yaw: number;
}
/** Around the edges and one low rock near the middle, leaving open sand under the light. */
export const CAVE_ROCKS: readonly CaveRock[] = [
  { x: -11, z: -15, size: 3.2, height: 1.8, yaw: 0.4 },
  { x: 12, z: -14.5, size: 2.6, height: 1.6, yaw: 1.9 },
  { x: -14, z: -26, size: 3.6, height: 2.4, yaw: 2.7 },
  { x: 14, z: -28, size: 3.2, height: 2.0, yaw: 0.9 },
  { x: -6, z: -33, size: 3.0, height: 2.2, yaw: 4.1 },
  { x: 6.5, z: -33.5, size: 3.4, height: 1.9, yaw: 5.2 },
  { x: -4.5, z: -27, size: 2.2, height: 1.3, yaw: 3.3 },
  { x: 0.5, z: -34.5, size: 2.6, height: 1.6, yaw: 1.2 },
  // v0.6 Pass 041: more rock, banked against the walls and in the corners.
  { x: -15.5, z: -20, size: 2.4, height: 1.7, yaw: 0.8 },
  { x: 15.5, z: -21, size: 2.8, height: 1.9, yaw: 2.2 },
  { x: -12, z: -34, size: 2.6, height: 2.1, yaw: 5.6 },
  { x: 13, z: -34.5, size: 2.4, height: 1.6, yaw: 3.9 },
  { x: -8, z: -11.5, size: 2.0, height: 1.2, yaw: 1.1 },
  { x: 7.5, z: -11.5, size: 2.2, height: 1.4, yaw: 4.6 },
  { x: -16, z: -31, size: 2.0, height: 1.5, yaw: 2.9 },
  { x: -16.5, z: -14, size: 2.2, height: 1.8, yaw: 0.3 },
];

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** v0.6 Pass 046: where the back tunnel meets the cavern's wall (z on its axis). */
export function backMouthZ(): number {
  const b = CAVE.backTunnel,
    p: Vec3 = { x: b.x, y: b.y, z: CAVE.chamber.z };
  for (; p.z > b.endZ; p.z -= 0.02) if (chamberDepth(p) >= 1) break;
  return p.z;
}
/** Where the tunnel meets the cavern's wall (z on its axis). */
export function tunnelMouthZ(): number {
  const c = CAVE.chamber,
    p: Vec3 = { x: 0, y: CAVE.tunnel.y, z: c.z };
  // Step along the tunnel's axis from the cavern's middle until it meets the wall.
  for (; p.z < CAVE.tunnel.startZ; p.z += 0.02) if (chamberDepth(p) >= 1) break;
  return p.z;
}

export class CaveEnvironment {
  readonly root = new THREE.Group();
  private readonly stoneSurface = new HabitatSurface('limestone');
  private readonly sandSurface = new HabitatSurface('sediment');
  readonly colliders: readonly ConvexCollider[];
  readonly rock: THREE.MeshStandardMaterial;
  /** Where the lobsters' cracks are: low against boulders and the wall (with their outward facing). */
  readonly cracks: readonly { x: number; y: number; z: number; yaw: number }[];
  /** The light shaft and pool's material (their brightness breathes gently). */
  private readonly shaft: THREE.MeshBasicMaterial;
  private readonly glow: THREE.MeshBasicMaterial;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private time = 0;
  /** V0.7 Pass 079: the kelp under the skylight and by the entrance, swaying. */
  private readonly algae: SwayingAlgae[] = [];
  private disposed = false;
  /** The roof's height at the skylight (where the sunbeam starts). */
  readonly skylightTop: number;
  /** v0.6 Pass 035: the pool of light's resting colours, and its geometry (it shimmers). */
  private poolBase?: Float32Array;
  private poolGeometry?: THREE.BufferGeometry;

  constructor() {
    this.root.name = 'Sea cave';
    this.rock = this.own(
      this.stoneSurface.material({
        name: 'Cave limestone',
        color: 0xc4b9a6,
        vertexColors: true,
        roughness: 0.95,
      }),
    );
    const wall = this.own(
        this.stoneSurface.material({
          name: 'Cave wall',
          vertexColors: true,
          roughness: 0.96,
          side: THREE.BackSide,
        }),
      ),
      sand = this.own(
        this.sandSurface.material({
          name: 'Cave sand',
          vertexColors: true,
          roughness: 1,
        }),
      ),
      tunnel = this.own(
        this.stoneSurface.material({
          name: 'Cave tunnel',
          vertexColors: true,
          roughness: 0.95,
          side: THREE.DoubleSide,
        }),
      ),
      sky = this.own(
        new THREE.MeshBasicMaterial({
          name: 'Cave skylight',
          color: 0xcdeee6,
          fog: false,
        }),
      );
    this.shaft = this.own(
      new THREE.MeshBasicMaterial({
        name: 'Cave light shaft',
        opacity: 0.3,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    this.glow = this.own(
      new THREE.MeshBasicMaterial({ name: 'Cave glow', color: 0x3fb8a4 }),
    );
    const mouthZ = tunnelMouthZ();
    this.add(this.shellMesh(), wall, 'Cave wall');
    this.add(this.floorMesh(), sand, 'Cave sand');
    this.add(this.tunnelMesh(mouthZ), tunnel, 'Cave tunnel');
    // V0.8 Pass 086: one sculpted arch of bedded limestone round each tunnel mouth, growing out of
    // the dome's own wall (Pass 052's heaped boulders read as an assembled ring).
    this.add(
      mouthArch(
        { x: 0, y: CAVE.tunnel.y, radius: CAVE.tunnel.radius },
        mouthZ,
        -1,
        {
          face: faceByBisection(inCaveRock, mouthZ - 3, mouthZ + 3),
          stone: CAVE_MOUTH_STONE,
          silt: 0.3,
          reach: 2.4,
          proud: 0.75,
          seed: 86010,
        },
      ),
      tunnel,
      'Cave entrance arch',
    );
    // v0.6 Pass 046: the back tunnel, from the back wall to its threshold (and a little beyond).
    const back = CAVE.backTunnel,
      backTube = {
        x: back.x,
        y: back.y,
        radius: back.radius,
        from: backMouthZ() + 0.3,
        to: back.endZ - 3,
        dark: back.endZ,
        // v0.6 Pass 052: frost creeping over the rock as the tunnel nears the ice.
        frost: { from: backMouthZ() - 1, to: back.endZ + 0.5 },
      };
    this.add(rockTubeGeometry(backTube), tunnel, 'Cave back tunnel');
    // v0.6 Pass 052 (playtest: "the tunnel to the ice needs to be better designed"): boulders
    // heaped round its mouth (frosted a little), and icicles hanging in its colder half.
    this.add(
      mouthCollar(backTube, backMouthZ() + 0.15, 1, 1.2, 0.34),
      tunnel,
      'Cave back tunnel collar',
    );
    this.add(
      mouthArch(backTube, backMouthZ(), 1, {
        face: faceByBisection(inCaveRock, backMouthZ() + 3, backMouthZ() - 3),
        stone: CAVE_MOUTH_STONE,
        // The cold from the ice: a little frost on its up-facing ledges.
        frost: 0.25,
        silt: 0.15,
        reach: 2.6,
        proud: 0.85,
        seed: 86020,
      }),
      tunnel,
      'Cave back tunnel arch',
    );
    this.add(
      icicles(backTube, (backMouthZ() + back.endZ) / 2, back.endZ + 0.4, 30),
      tunnel,
      'Cave back tunnel icicles',
    );
    // Its far end fades into darkness (beyond the threshold, where the swap has happened).
    // V0.7 Pass 079: a receding throat, not a flat black disc.
    this.add(
      tunnelThroat(backTube, backTube.to + 0.05, -1),
      tunnel,
      'Cave back tunnel end',
    );
    const s = CAVE.skylight,
      top = this.roofAt(s.x, s.z);
    this.skylightTop = top;
    // The hole's chimney, and the bright water above it.
    this.add(this.chimneyMesh(top), wall, 'Cave chimney');
    const disc = new THREE.CircleGeometry(s.radius + 0.3, 32);
    disc.rotateX(Math.PI / 2);
    disc.translate(s.x, top + 2.95, s.z);
    this.add(disc, sky, 'Cave skylight');
    const beam = this.add(this.shaftMesh(top), this.shaft, 'Cave light shaft');
    beam.renderOrder = 2;
    const pool = this.add(this.poolMesh(), this.shaft, 'Cave light pool');
    pool.renderOrder = 2;
    this.poolGeometry = pool.geometry;
    this.poolBase = Float32Array.from(
      pool.geometry.getAttribute('color').array,
    );

    const colliders: ConvexCollider[] = [
      ...this.tunnelColliders(mouthZ),
      ...rockTubeColliders(backTube),
      boxCollider(
        [back.x - 2, back.y - 2, backTube.to - 1],
        [back.x + 2, back.y + 2, backTube.to + 0.6],
      ),
    ];
    const rocks: THREE.BufferGeometry[] = [],
      cracks: { x: number; y: number; z: number; yaw: number }[] = [],
      m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      e = new THREE.Euler();
    CAVE_ROCKS.forEach((r, i) => {
      // V0.7 Pass 079: carved inside the same hull (its collider), so silhouettes read as rock.
      const g = limestoneGeometry(34100 + (i % 8) * 13, i % 3, true);
      g.computeBoundingBox();
      const box = g.boundingBox!,
        size = box.getSize(new THREE.Vector3()),
        centre = box.getCenter(new THREE.Vector3()),
        y = caveFloor(r.x, r.z);
      e.set(0, r.yaw, 0);
      q.setFromEuler(e);
      m.compose(
        new THREE.Vector3(r.x, y + r.height * 0.3, r.z),
        q,
        new THREE.Vector3(r.size / size.x, r.height / size.y, r.size / size.z),
      ).multiply(
        new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z),
      );
      colliders.push(rockCollider(g, m));
      rocks.push(g.applyMatrix4(m));
      // A crack at the boulder's foot, on the side facing the middle of the cavern.
      const c = CAVE.chamber,
        a = Math.atan2(c.x - r.x, c.z - r.z),
        reach = r.size * 0.48;
      cracks.push({
        x: r.x + Math.sin(a) * reach,
        y: caveFloor(r.x + Math.sin(a) * reach, r.z + Math.cos(a) * reach),
        z: r.z + Math.cos(a) * reach,
        yaw: a,
      });
    });
    rocks.push(...this.skylightRubble(), ...this.pillars(colliders));
    const merged = mergeGeometries(rocks, false);
    rocks.forEach((g) => g.dispose());
    if (merged) this.add(merged, this.rock, 'Cave boulders');
    this.largeLife();
    this.add(this.sponges(), this.glow, 'Cave glowing sponges');
    // A crack low in the wall at the back, too.
    for (const a of [2.6, 3.4, -2.5]) {
      const p = wallPoint(Math.sin(a), -0.32, Math.cos(a), {
        x: 0,
        y: 0,
        z: 0,
      });
      const c = CAVE.chamber,
        k = 0.92;
      cracks.push({
        x: c.x + (p.x - c.x) * k,
        y: caveFloor(c.x + (p.x - c.x) * k, c.z + (p.z - c.z) * k),
        z: c.z + (p.z - c.z) * k,
        yaw: Math.atan2(c.x - p.x, c.z - p.z),
      });
    }
    this.cracks = cracks;
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
  /** The roof's height above (x, z). */
  private roofAt(x: number, z: number): number {
    const c = CAVE.chamber,
      p: Vec3 = { x, y: c.y, z };
    // Bisect along the vertical for the wall's height.
    let lo: number = c.y,
      hi: number = c.y + c.ry * 1.3;
    for (let i = 0; i < 30; i++) {
      p.y = (lo + hi) / 2;
      if (chamberDepth(p) < 1) lo = p.y;
      else hi = p.y;
    }
    return lo;
  }
  /**
   * The dome: a lumpy ellipsoid seen from inside, without the faces where the tunnel and the
   * skylight pass through it. Pale limestone, darker low down and at the back, with a green tinge
   * of algae around the skylight.
   */
  private shellMesh(): THREE.BufferGeometry {
    const c = CAVE.chamber,
      sphere = new THREE.SphereGeometry(1, 120, 72),
      pos = sphere.getAttribute('position'),
      p: Vec3 = { x: 0, y: 0, z: 0 },
      colors: number[] = [],
      s = CAVE.skylight;
    for (let i = 0; i < pos.count; i++) {
      const ux = pos.getX(i),
        uy = pos.getY(i),
        uz = pos.getZ(i);
      wallPoint(ux * c.rx, uy * c.ry, uz * c.rz, p);
      pos.setXYZ(i, p.x, p.y, p.z);
      const lump = wallLumps(ux, uy, uz),
        stain = 0.5 + 0.5 * Math.sin(ux * 17 + uy * 23) * Math.sin(uz * 19),
        low = smooth(-0.1, 0.5, uy),
        algae =
          (1 - smooth(3, 8, Math.hypot(p.x - s.x, p.z - s.z))) *
          smooth(0.3, 0.8, uy),
        // v0.6 Pass 035: streaks where water has run down the rock, and faint bands of strata.
        // On the walls only: on the roof the streaks would gather into rays.
        walls = 1 - smooth(0.45, 0.8, Math.abs(uy)),
        streak =
          1 +
          0.14 *
            walls *
            (Math.sin(
              Math.atan2(ux, uz) * 37 + 2.2 * Math.sin(uy * 5 + ux * 3),
            ) -
              1),
        strata = 0.93 + 0.07 * Math.sin(uy * 28 + 0.8 * Math.sin(ux * 6)),
        tone =
          (0.46 + 0.9 * lump + 0.04 * stain) *
          (0.6 + 0.4 * low) *
          streak *
          strata;
      colors.push(
        tone * (1 - 0.25 * algae),
        tone * (0.96 + 0.08 * algae),
        tone * (0.88 - 0.2 * algae),
      );
    }
    sphere.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    // Weld the seam and poles, so the lighting runs on across them.
    sphere.deleteAttribute('uv');
    sphere.deleteAttribute('normal');
    const welded = mergeVertices(sphere, 1e-4);
    sphere.dispose();
    return this.cutHoles(welded);
  }
  /** Drop the dome's faces where the tunnel and the skylight pass through it. */
  private cutHoles(sphere: THREE.BufferGeometry): THREE.BufferGeometry {
    const c = CAVE.chamber,
      s = CAVE.skylight,
      pos = sphere.getAttribute('position');
    const index = sphere.getIndex()!,
      kept: number[] = [],
      t = CAVE.tunnel,
      b = CAVE.backTunnel;
    for (let f = 0; f < index.count; f += 3) {
      let cx = 0,
        cy = 0,
        cz = 0;
      for (let k = 0; k < 3; k++) {
        const v = index.getX(f + k);
        cx += pos.getX(v) / 3;
        cy += pos.getY(v) / 3;
        cz += pos.getZ(v) / 3;
      }
      const tunnelHole = cz > c.z && Math.hypot(cx, cy - t.y) < t.radius + 0.25,
        skyHole = cy > c.y && Math.hypot(cx - s.x, cz - s.z) < s.radius,
        // v0.6 Pass 046: and where the back tunnel leaves for the waters under the ice.
        backHole = cz < c.z && Math.hypot(cx - b.x, cy - b.y) < b.radius + 0.25;
      if (!tunnelHole && !skyHole && !backHole)
        kept.push(index.getX(f), index.getX(f + 1), index.getX(f + 2));
    }
    sphere.setIndex(kept);
    // Round off each hole's edge: the kept rock nearest a hole is pulled out onto a clean circle,
    // so its rim is smooth rather than the stepped outline of the faces left around it.
    const used = new Set(kept),
      edge = 0.3;
    for (const v of used) {
      const x = pos.getX(v),
        y = pos.getY(v),
        z = pos.getZ(v);
      if (y > c.y) {
        const d = Math.hypot(x - s.x, z - s.z),
          r = s.radius + edge;
        if (d < r && d > 1e-6)
          pos.setXYZ(
            v,
            s.x + ((x - s.x) * r) / d,
            y,
            s.z + ((z - s.z) * r) / d,
          );
      }
      if (z > c.z) {
        const d = Math.hypot(x, y - t.y),
          r = t.radius + 0.25 + edge;
        if (d < r && d > 1e-6)
          pos.setXYZ(v, (x * r) / d, t.y + ((y - t.y) * r) / d, z);
      } else {
        const d = Math.hypot(x - b.x, y - b.y),
          r = b.radius + 0.25 + edge;
        if (d < r && d > 1e-6)
          pos.setXYZ(
            v,
            b.x + ((x - b.x) * r) / d,
            b.y + ((y - b.y) * r) / d,
            z,
          );
      }
    }
    sphere.computeVertexNormals();
    return sphere;
  }
  /** The sand: soft ripples, banking up at the walls, darker away from the light. */
  private floorMesh(): THREE.BufferGeometry {
    const c = CAVE.chamber,
      s = CAVE.skylight,
      g = new THREE.PlaneGeometry(c.rx * 2 + 4, c.rz * 2 + 4, 110, 110),
      // Where the sunbeam's pool falls (as in poolMesh) and its radius.
      poolX = s.x - 0.12 * (this.roofAt(s.x, s.z) - caveFloor(s.x, s.z)),
      poolR = s.radius * 2.2;
    g.rotateX(-Math.PI / 2);
    g.translate(c.x, 0, c.z);
    const pos = g.getAttribute('position'),
      colors: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i),
        // v0.6 Pass 052 (playtest: "a weird square texture at the entrance"): the sheet is square
        // and reaches past the cavern's wall; at the front its banked-up edge stood above the
        // tunnel's floor, a square of sand inside the tunnel's mouth. Beyond the wall it now
        // drops well down, out of sight under the rock.
        rim =
          (Math.abs((x - c.x) / c.rx) ** c.squareness +
            Math.abs((z - c.z) / c.rz) ** c.squareness) **
          (1 / c.squareness),
        tuck = 4 * smooth(1, 1.06, rim);
      pos.setY(i, caveFloor(x, z) - tuck);
      const lit = 1 - smooth(2, 9, Math.hypot(x - s.x, z - s.z)),
        speck =
          0.04 * Math.sin(x * 0.9 + z * 0.6) * Math.sin(x * 0.5 - z * 1.1),
        k = 0.36 + 0.22 * lit + speck;
      // V0.7 Pass 079: the floor under the sunbeam reads as grown and settled, not plain sand: a
      // patchy green-gold diatom film where the light falls, a bleached centre, silt darkening
      // round the pool's edge, and gravel flecks, all in colour (the floor's height is unchanged).
      const pd = Math.hypot(x - poolX, z - s.z) / poolR,
        inPool = 1 - smooth(0.55, 1.15, pd),
        film =
          inPool *
          smooth(
            0.15,
            0.6,
            0.5 +
              0.5 *
                Math.sin(x * 2.3 + Math.sin(z * 1.7) * 1.4) *
                Math.sin(z * 2.1 - Math.sin(x * 1.3) * 1.2),
          ),
        bleach = 1 - smooth(0, 0.45, pd),
        silt = Math.exp(-(((pd - 1.05) / 0.22) ** 2)),
        gravel =
          Math.max(
            0,
            Math.sin(x * 9.7 + z * 3.1) * Math.sin(z * 8.3 - x * 2.9) - 0.75,
          ) *
          3 *
          (0.4 + inPool);
      let r = k * (1 + 0.08 * bleach - 0.16 * silt - 0.25 * gravel),
        gg = k * 0.94 * (1 + 0.06 * bleach - 0.14 * silt - 0.25 * gravel),
        b = k * 0.8 * (1 + 0.04 * bleach - 0.12 * silt - 0.25 * gravel);
      r = r * (1 - 0.6 * film) + k * 0.74 * 0.6 * film;
      gg = gg * (1 - 0.6 * film) + k * 0.92 * 0.6 * film;
      b = b * (1 - 0.6 * film) + k * 0.42 * 0.6 * film;
      colors.push(r, gg, b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }
  /**
   * V0.7 Pass 079: stones fallen through the skylight over the years, lying in a loose fan under
   * the beam: a few flat slabs and pebbles, half-buried, small enough to swim over (so they need
   * no colliders). Merged with the boulders (no extra draw).
   */
  private skylightRubble(): THREE.BufferGeometry[] {
    const s = CAVE.skylight,
      poolX = s.x - 0.12 * (this.roofAt(s.x, s.z) - caveFloor(s.x, s.z)),
      rand = random(79100),
      out: THREE.BufferGeometry[] = [],
      m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      e = new THREE.Euler(),
      size = new THREE.Vector3(),
      centre = new THREE.Vector3();
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2,
        d = s.radius * (0.2 + 1.3 * rand() * rand() + 0.3 * rand()),
        x = poolX + Math.cos(a) * d,
        z = s.z + Math.sin(a) * d,
        slab = i % 4 === 0,
        w = slab ? 0.5 + rand() * 0.35 : 0.14 + rand() * 0.22,
        h = slab ? 0.12 + rand() * 0.06 : w * (0.5 + rand() * 0.3),
        g = rockShape(34500 + (i % 6) * 17, slab ? 1 : i % 3, 1);
      g.computeBoundingBox();
      g.boundingBox!.getSize(size);
      g.boundingBox!.getCenter(centre);
      e.set((rand() - 0.5) * 0.3, rand() * Math.PI * 2, (rand() - 0.5) * 0.3);
      q.setFromEuler(e);
      m.compose(
        new THREE.Vector3(x, caveFloor(x, z) + h * 0.15, z),
        q,
        new THREE.Vector3(
          w / size.x,
          h / size.y,
          (w * (0.7 + rand() * 0.3)) / size.z,
        ),
      ).multiply(
        new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z),
      );
      out.push(g.applyMatrix4(m));
    }
    return out;
  }
  /**
   * V0.7 Pass 079 (playtest: "feels like a large empty room"): two great limestone pillars from
   * sand to roof against the side walls, between the boulders: a flared foot, a carved shaft and a
   * broad head spreading into the roof, each part carved inside its own hull (its collider). Clear
   * of the fish schools, the whitetips' resting and settling spots, the nooks and the sunbeam.
   */
  private pillars(colliders: ConvexCollider[]): THREE.BufferGeometry[] {
    const out: THREE.BufferGeometry[] = [],
      m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      size = new THREE.Vector3(),
      centre = new THREE.Vector3();
    const part = (
      seed: number,
      family: number,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      yaw: number,
    ) => {
      const g = limestoneGeometry(seed, family, true);
      g.computeBoundingBox();
      g.boundingBox!.getSize(size);
      g.boundingBox!.getCenter(centre);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      m.compose(
        new THREE.Vector3(x, y, z),
        q,
        new THREE.Vector3(w / size.x, h / size.y, d / size.z),
      ).multiply(
        new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z),
      );
      colliders.push(rockCollider(g, m));
      out.push(g.applyMatrix4(m));
    };
    [
      [-15.3, -22.6],
      [15.4, -25],
    ].forEach(([x, z], i) => {
      const floor = caveFloor(x, z),
        roof = this.roofAt(x, z),
        span = roof - floor;
      part(79600 + i * 31, 0, x, floor + 1.3, z, 4.4, 3.4, 4.0, i * 1.3);
      part(
        79610 + i * 31,
        2,
        x,
        floor + span * 0.48,
        z,
        3.0,
        span * 0.72,
        2.8,
        0.6 + i,
      );
      part(
        79615 + i * 31,
        1,
        x + 0.5,
        floor + span * 0.4,
        z - 0.4,
        2.4,
        span * 0.45,
        2.2,
        1.7 + i,
      );
      part(79620 + i * 31, 1, x, roof - 1.1, z, 4.8, 3.4, 4.4, 2.1 + i);
    });
    return out;
  }
  /**
   * V0.7 Pass 079: large living structure. Big orange and red sea fans on the walls and pillars,
   * facing into the cavern's slow current (one instanced draw), and a ring of strap kelp round the
   * edge of the sunbeam's pool with a few stands by the entrance, swaying (one draw).
   */
  private largeLife(): void {
    const rand = random(79700),
      fanGeometry = seaFan(11),
      fans = new THREE.InstancedMesh(
        fanGeometry,
        this.own(
          new THREE.MeshStandardMaterial({
            name: 'Cave sea fans',
            vertexColors: !!fanGeometry.getAttribute('color'),
            roughness: 0.75,
            side: THREE.DoubleSide,
          }),
        ),
        26,
      );
    this.geometries.push(fanGeometry);
    fans.name = 'Cave sea fans';
    const c = CAVE.chamber,
      m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      e = new THREE.Euler(),
      p = { x: 0, y: 0, z: 0 },
      colour = new THREE.Color();
    let n = 0;
    for (let i = 0; i < 60 && n < 26; i++) {
      const a = rand() * Math.PI * 2,
        up = -0.55 + rand() * 0.45;
      wallPoint(Math.sin(a), up, Math.cos(a), p);
      // Not over the tunnels' mouths, not in the sunbeam's pool.
      if (p.z > c.z + c.rz - 3.5 && Math.abs(p.x) < 4.5) continue;
      if (p.z < c.z - c.rz + 3.5 && Math.abs(p.x - CAVE.backTunnel.x) < 4.5)
        continue;
      const k = 0.9,
        x = c.x + (p.x - c.x) * k,
        z = c.z + (p.z - c.z) * k,
        y = Math.max(caveFloor(x, z) + 0.2, p.y),
        s = 1.3 + rand() * 1.1;
      e.set(
        (rand() - 0.5) * 0.25,
        Math.atan2(c.x - x, c.z - z) + (rand() - 0.5) * 0.5,
        (rand() - 0.5) * 0.3,
      );
      m.compose(
        new THREE.Vector3(x, y, z),
        q.setFromEuler(e),
        new THREE.Vector3(s, s, s),
      );
      fans.setMatrixAt(n, m);
      fans.setColorAt(
        n,
        rand() < 0.5
          ? colour.setRGB(0.95, 0.45, 0.2)
          : colour.setRGB(0.8, 0.2, 0.18),
      );
      n++;
    }
    fans.count = n;
    this.root.add(fans);
    // Kelp: round the sunbeam's pool (in its light) and in the entrance's light.
    const s = CAVE.skylight,
      poolX = s.x - 0.12 * (this.roofAt(s.x, s.z) - caveFloor(s.x, s.z)),
      clear = [...CAVE_LIFE.settle, ...CAVE_LIFE.resting],
      kelp: AlgaPlacement[] = [],
      free = (x: number, z: number) =>
        clear.every((r) => Math.hypot(x - r.x, z - r.z) > 1.8) &&
        CAVE_ROCKS.every(
          (r) => Math.hypot(x - r.x, z - r.z) > r.size * 0.6 + 0.5,
        );
    for (let i = 0; i < 40 && kelp.length < 22; i++) {
      const a = rand() * Math.PI * 2,
        d = s.radius * 2.1 + rand() * 2.2,
        x = poolX + Math.cos(a) * d,
        z = s.z + Math.sin(a) * d;
      if (free(x, z))
        kelp.push({
          x,
          y: caveFloor(x, z) - 0.05,
          z,
          scale: 0.65 + rand() * 0.55,
          yaw: rand() * Math.PI * 2,
        });
    }
    for (let i = 0; i < 20 && kelp.length < 32; i++) {
      const x = (rand() < 0.5 ? -1 : 1) * (3 + rand() * 4),
        z = c.z + c.rz - 2.5 - rand() * 3;
      if (free(x, z))
        kelp.push({
          x,
          y: caveFloor(x, z) - 0.05,
          z,
          scale: 0.5 + rand() * 0.4,
          yaw: rand() * Math.PI * 2,
        });
    }
    const algae = new SwayingAlgae(
      'Cave kelp',
      strapAlgaGeometry(3.2, 79710, [0.22, 0.2, 0.08], [0.48, 0.44, 0.18]),
      kelp,
      0.25,
    );
    this.algae.push(algae);
    this.root.add(algae.mesh);
  }
  /** Inside-facing tube from just behind its start to the dome, black at the start, lit at the end. */
  private tunnelMesh(mouthZ: number): THREE.BufferGeometry {
    const t = CAVE.tunnel;
    return rockTubeGeometry(
      {
        x: 0,
        y: t.y,
        radius: t.radius,
        from: t.startZ + 0.2,
        to: mouthZ - 0.5,
        dark: CAVE_FRAME.origin.z,
      },
      PASSAGE.darkReach,
    );
  }
  /** A short rough shaft up through the roof from the hole. */
  private chimneyMesh(top: number): THREE.BufferGeometry {
    const s = CAVE.skylight,
      // Wider than the hole at its foot and reaching below the roof, so it hides the hole's edge.
      g = new THREE.CylinderGeometry(
        s.radius + 0.3,
        s.radius + 0.8,
        3.3,
        28,
        4,
        true,
      );
    // Its foot only just below the roof, so it does not hang down into the cave.
    g.translate(s.x, top + 1.35, s.z);
    const pos = g.getAttribute('position'),
      colors: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const a = Math.atan2(pos.getZ(i) - s.z, pos.getX(i) - s.x),
        k = 0.35 + 0.08 * Math.sin(a * 5 + pos.getY(i) * 2);
      colors.push(k * 0.85, k, k * 0.8);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return g;
  }
  /**
   * The sunbeam: three nested cones widening from the hole to the sand, bright above and fading
   * below. Seen through, the layers add up most at the beam's middle, so its edges are soft.
   */
  private shaftMesh(top: number): THREE.BufferGeometry {
    const s = CAVE.skylight,
      floor = caveFloor(s.x, s.z),
      h = top - floor,
      layers: THREE.BufferGeometry[] = [];
    for (const scale of [0.5, 0.75, 1]) {
      const g = new THREE.CylinderGeometry(
        s.radius * 0.95 * scale,
        s.radius * 1.6 * scale,
        h,
        32,
        8,
        true,
      );
      g.deleteAttribute('uv');
      // Leaning a little, as the sun is not straight overhead.
      g.translate(0, h / 2, 0);
      g.applyMatrix4(new THREE.Matrix4().makeShear(0, 0, 0, 0, 0.12, 0));
      g.translate(s.x - 0.12 * h, floor, s.z);
      const pos = g.getAttribute('position'),
        colors: number[] = [];
      for (let i = 0; i < pos.count; i++) {
        const t = (pos.getY(i) - floor) / h,
          k =
            0.085 *
            smooth(0, 1, t) *
            (1 - 0.5 * smooth(0.9, 1, t)) *
            (0.75 + 0.25 * Math.sin(i * 1.7 + scale * 5));
        colors.push(k * 0.85, k, k * 0.9);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      layers.push(g);
    }
    const merged = mergeGeometries(layers, false)!;
    layers.forEach((g) => g.dispose());
    return merged;
  }
  /** The pool of light where the beam meets the sand: a grid that follows the ripples. */
  private poolMesh(): THREE.BufferGeometry {
    const s = CAVE.skylight,
      x = s.x - 0.12 * (this.roofAt(s.x, s.z) - caveFloor(s.x, s.z)),
      r = s.radius * 2.2,
      g = new THREE.PlaneGeometry(r * 2, r * 2, 40, 40);
    g.rotateX(-Math.PI / 2);
    const pos = g.getAttribute('position'),
      colors: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i) + x,
        pz = pos.getZ(i) + s.z,
        d = Math.hypot(pos.getX(i), pos.getZ(i)) / r,
        k = 0.22 * (1 - smooth(0.3, 1, d));
      pos.setXYZ(i, px, caveFloor(px, pz) + 0.05, pz);
      colors.push(k, k * 0.98, k * 0.85);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return g;
  }
  /** Small glowing sponges on the lower walls at the back, in loose clusters. */
  private sponges(): THREE.BufferGeometry {
    const rand = random(CAVE_LAYOUT.seed),
      c = CAVE.chamber,
      parts: THREE.BufferGeometry[] = [],
      p: Vec3 = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < CAVE_LAYOUT.sponges; i++) {
      const cluster = Math.floor(i / 7),
        // Ten clusters spread round the back of the cavern (away from the tunnel).
        base = Math.PI - 1.3 + cluster * 0.29,
        a = base + (rand() - 0.5) * 0.25,
        uy = -0.32 + rand() * 0.45 + (cluster % 3) * 0.05;
      wallPoint(Math.sin(a), uy, Math.cos(a), p);
      // Just off the rock, towards the middle.
      const k = 0.985,
        x = c.x + (p.x - c.x) * k,
        y = c.y + (p.y - c.y) * k,
        z = c.z + (p.z - c.z) * k;
      if (y < caveFloor(x, z) + 0.15) continue;
      const g = new THREE.IcosahedronGeometry(0.05 + rand() * 0.08, 1);
      g.scale(1, 0.7, 1);
      g.translate(x, y, z);
      parts.push(g);
    }
    const merged = mergeGeometries(parts, false) ?? new THREE.BufferGeometry();
    parts.forEach((g) => g.dispose());
    return merged;
  }
  /** A square duct a little inside the tube's rock, capped behind its start. */
  private tunnelColliders(mouthZ: number): ConvexCollider[] {
    const t = CAVE.tunnel,
      d = CAVE_LAYOUT.duct,
      w = CAVE_LAYOUT.wall,
      z0 = mouthZ - 0.3,
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
  /** The light shaft breathes slowly and the sponges pulse, on simulation time only. */
  update(dt: number, active: boolean, reducedMotion: boolean): void {
    if (this.disposed || !active || reducedMotion || !(dt > 0)) return;
    this.time += Math.min(dt, 0.1);
    for (const a of this.algae) a.update(dt, active, reducedMotion);
    this.shaft.color.setScalar(0.85 + 0.15 * Math.sin(this.time * 0.6));
    const g = 0.8 + 0.2 * Math.sin(this.time * 0.45 + 1);
    this.glow.color.setRGB(0.35 * g, 0.91 * g, 0.81 * g);
    // The pool of light ripples with caustics, as the surface far above moves.
    const geometry = this.poolGeometry,
      base = this.poolBase;
    const color = geometry?.getAttribute('color');
    if (geometry && base && color && color.array instanceof Float32Array) {
      const pos = geometry.getAttribute('position'),
        t = this.time,
        out = color.array;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i),
          z = pos.getZ(i),
          w =
            Math.sin(x * 2.1 + t * 0.9) +
            Math.sin(z * 2.6 - t * 0.7) +
            Math.sin((x + z) * 1.7 + t * 1.1),
          k = 0.55 + 0.9 * Math.max(0, w / 3) ** 2 + 0.25 * (w / 3 + 1) * 0.5;
        out[i * 3] = base[i * 3] * k;
        out[i * 3 + 1] = base[i * 3 + 1] * k;
        out[i * 3 + 2] = base[i * 3 + 2] * k;
      }
      color.needsUpdate = true;
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.algae.forEach((a) => a.dispose());
    this.root.clear();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.stoneSurface.dispose();
    this.sandSurface.dispose();
  }
}

/**
 * v0.6 Pass 034: the tank's keepsake from the sea cave: a small limestone arch (two rocks and a
 * lintel), built in code, in unit height. Has positions, normals, colours and (empty) UVs.
 */
export function caveArchGeometry(): THREE.BufferGeometry {
  const parts = [
    { seed: 34501, at: [-0.42, 0.42, 0], size: [0.42, 0.95, 0.5] },
    { seed: 34511, at: [0.44, 0.4, 0.04], size: [0.46, 0.9, 0.52] },
    { seed: 34521, at: [0.02, 0.98, 0.02], size: [1.35, 0.38, 0.55] },
  ].map((r, i) => {
    const g = createRockGeometry(r.seed, i % 4, 2);
    g.computeBoundingBox();
    const box = g.boundingBox!,
      size = box.getSize(new THREE.Vector3()),
      centre = box.getCenter(new THREE.Vector3());
    g.translate(-centre.x, -centre.y, -centre.z);
    g.scale(r.size[0] / size.x, r.size[1] / size.y, r.size[2] / size.z);
    g.translate(r.at[0], r.at[1], r.at[2]);
    for (const name of Object.keys(g.attributes))
      if (name !== 'position' && name !== 'normal' && name !== 'color')
        g.deleteAttribute(name);
    return g.index ? g.toNonIndexed() : g;
  });
  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!merged) throw Error('Cave arch could not be built');
  merged.computeBoundingBox();
  const b = merged.boundingBox!;
  merged.translate(0, -b.min.y, 0);
  const top = b.max.y - b.min.y;
  merged.scale(1 / top, 1 / top, 1 / top);
  merged.setAttribute(
    'uv',
    new THREE.BufferAttribute(
      new Float32Array(merged.getAttribute('position').count * 2),
      2,
    ),
  );
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}
