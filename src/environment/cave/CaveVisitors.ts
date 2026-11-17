import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AssetLoader } from '../../assets/AssetLoader';
import {
  blinkOn,
  CleaningVisit,
  LionfishFan,
  SleepingTurtle,
} from '../../creatures/caveEncounters';
import { Moray } from '../../creatures/Moray';
import type { SightCandidate } from '../../discovery/journal';
import { CAVE_SIGHTS, OUTER_SIGHTS } from '../../discovery/sights';
import type { FishEntity } from '../../fish/FishEntity';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import { createPose, PosedFish } from '../outer/PosedFish';
import { SoloCreature } from '../outer/SoloCreature';
import { createRockGeometry } from '../RockGeometry';
import { Octopus } from '../shared/Octopus';
import { lobsterDen, limb, merged, tinted } from './CaveLobsters';
import { caveHabitat, caveObstacles } from './CaveLife';
import type { CaveNooks } from './CaveNooks';
import { caveFloor } from './CaveTerrain';

/**
 * v0.6 Pass 045: the sea cave's newer life:
 *   - a moray in a crack low in the wall (the tank's moray), gaping slowly, pulling back when
 *     approached;
 *   - flashlight fish in the darkest corner, their light organs blinking (their glow ignores the
 *     cave's murk, as light does);
 *   - a green turtle asleep on the sand, rising now and then up the sunbeam to breathe;
 *   - a nurse shark asleep under a rock ledge against the back wall;
 *   - cleaner shrimps on the wall, where a soldierfish comes now and then to be cleaned;
 *   - a day octopus in a den at a boulder's foot (the reef's octopus);
 *   - two lionfish on boulder tops, fanning their fins and spines at a swimmer who comes close.
 * Each part loads on its own and is left out if it cannot. Owns everything it creates.
 */
const LION = { rays: 20, scale: 1.6 } as const;

/** A cleaner shrimp facing +z, its legs at y 0 (about 6 cm before scaling): red and white. */
function shrimpGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.SphereGeometry(1, 8, 6);
    seg.scale(0.006 - i * 0.0005, 0.006 - i * 0.0004, 0.006);
    seg.translate(0, 0.008, 0.02 - i * 0.009);
    parts.push(tinted(seg, i % 2 ? [0.95, 0.92, 0.88] : [0.82, 0.12, 0.1]));
  }
  for (const s of [-1, 1]) {
    // Long white antennae, waving forward.
    parts.push(
      limb(
        v(s * 0.002, 0.01, 0.025),
        v(s * 0.02, 0.03, 0.08),
        0.0007,
        0.0003,
        [0.98, 0.98, 0.96],
      ),
    );
    for (let k = 0; k < 3; k++)
      parts.push(
        limb(
          v(s * 0.004, 0.006, 0.015 - k * 0.008),
          v(s * 0.012, 0, 0.018 - k * 0.008),
          0.0008,
          0.0005,
          [0.85, 0.3, 0.25],
        ),
      );
  }
  return merged(parts);
}
/** A lionfish body facing +z, its belly at y 0 (about 30 cm before scaling), with head tentacles. */
function lionBody(): THREE.BufferGeometry {
  const body = new THREE.SphereGeometry(1, 16, 10);
  body.scale(0.035, 0.05, 0.13);
  body.translate(0, 0.05, 0);
  const g = body.toNonIndexed();
  body.dispose();
  const pos = g.getAttribute('position'),
    col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    // Bold vertical bands, red-brown and cream, narrowing towards the tail.
    const z = pos.getZ(i),
      band = Math.sin(z * 110 + Math.sin(pos.getY(i) * 40)) > 0.1;
    col.set(band ? [0.62, 0.16, 0.1] : [0.95, 0.88, 0.78], i * 3);
  }
  g.deleteAttribute('uv');
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const parts = [g];
  // A tail fan and fleshy tentacles over the eyes.
  const tail = new THREE.ConeGeometry(0.035, 0.07, 8);
  tail.rotateX(-Math.PI / 2);
  tail.scale(0.3, 1, 1);
  tail.translate(0, 0.05, -0.15);
  parts.push(tinted(tail, [0.9, 0.85, 0.78]));
  for (const s of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.008, 6, 4);
    eye.translate(s * 0.024, 0.07, 0.09);
    parts.push(tinted(eye, [0.08, 0.06, 0.05]));
    const t = new THREE.ConeGeometry(0.004, 0.03, 4);
    t.translate(s * 0.02, 0.1, 0.08);
    parts.push(tinted(t, [0.75, 0.25, 0.15]));
  }
  return merged(parts);
}
/** One fin ray (spine), its base at the origin, pointing up +y (1 unit long): banded. */
function rayGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 4; k++) {
    const seg = new THREE.CylinderGeometry(
      0.008 * (1 - k / 4) + 0.002,
      0.008 * (1 - (k - 1) / 4) + 0.002,
      0.25,
      4,
      1,
    );
    seg.translate(0, 0.125 + k * 0.25, 0);
    parts.push(tinted(seg, k % 2 ? [0.95, 0.88, 0.8] : [0.6, 0.15, 0.1]));
  }
  // A thin, tapering sliver of membrane trailing each ray, joined at its base.
  const web = new THREE.BufferGeometry();
  web.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [0, 0.05, 0, 0, 0.75, 0, 0, 0.4, -0.06],
      3,
    ),
  );
  web.computeVertexNormals();
  parts.push(tinted(web, [0.85, 0.6, 0.5]));
  return merged(parts);
}

export class CaveVisitors {
  readonly root = new THREE.Group();
  readonly sightings: SightCandidate[] = [];
  readonly ready: Promise<boolean>;
  readonly turtle: SleepingTurtle;
  readonly cleaning: CleaningVisit;
  readonly lionfish: LionfishFan[];
  readonly octopus: Octopus;
  moray?: Moray;
  private readonly nursePose = createPose();
  private nurse?: SoloCreature;
  private turtleBody?: SoloCreature;
  private cleanerFish?: PosedFish;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly shrimpMesh: THREE.InstancedMesh;
  private readonly lionBodies: THREE.InstancedMesh;
  private readonly lionRays: THREE.InstancedMesh;
  glowMesh?: THREE.InstancedMesh;
  private glowFish: readonly FishEntity[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly m2 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private time = 0;
  private disposed = false;

  constructor(
    private readonly loader: AssetLoader,
    private readonly nooks: CaveNooks,
  ) {
    this.root.name = 'Sea cave visitors';
    const rock = this.own(
      new THREE.MeshStandardMaterial({
        name: 'Cave ledge',
        color: 0xc8bea9,
        vertexColors: true,
        roughness: 0.92,
      }),
    );
    const critters = this.own(
      new THREE.MeshStandardMaterial({
        name: 'Cave critters',
        vertexColors: true,
        roughness: 0.5,
      }),
    );
    // The ledge: a slab of rock against the back wall on two pillars, the shark asleep beneath.
    const L = nooks.ledge,
      ax = Math.cos(L.yaw),
      az = -Math.sin(L.yaw),
      floor = caveFloor(L.x, L.z),
      pieces: THREE.BufferGeometry[] = [];
    const piece = (
      seed: number,
      family: number,
      at: THREE.Vector3,
      size: THREE.Vector3,
      yaw: number,
    ) => {
      const g = createRockGeometry(seed, family, 2);
      for (const name of Object.keys(g.attributes))
        if (!['position', 'normal', 'color'].includes(name))
          g.deleteAttribute(name);
      g.computeBoundingBox();
      const b = g.boundingBox!,
        sz = b.getSize(new THREE.Vector3()),
        ce = b.getCenter(new THREE.Vector3());
      g.translate(-ce.x, -ce.y, -ce.z);
      g.scale(size.x / sz.x, size.y / sz.y, size.z / sz.z);
      g.rotateY(yaw);
      g.translate(at.x, at.y, at.z);
      pieces.push(g.index ? g.toNonIndexed() : g);
    };
    const inX = -az,
      inZ = ax;
    piece(
      45101,
      2,
      new THREE.Vector3(L.x, L.y + 0.1, L.z),
      new THREE.Vector3(L.length, 0.5, L.depth),
      L.yaw,
    );
    for (const s of [-1, 1])
      piece(
        45111 + s,
        1,
        new THREE.Vector3(
          L.x + ax * s * (L.length / 2 - 0.25) + inX * 0.55,
          (floor + L.y) / 2,
          L.z + az * s * (L.length / 2 - 0.25) + inZ * 0.55,
        ),
        new THREE.Vector3(0.7, L.y - floor + 0.3, 0.7),
        s,
      );
    const ledge = mergeGeometries(pieces, false);
    pieces.forEach((g) => g.dispose());
    if (ledge) {
      ledge.computeVertexNormals();
      this.geometries.push(ledge);
      const mesh = new THREE.Mesh(ledge, rock);
      mesh.name = 'Cave ledge';
      this.root.add(mesh);
    }
    // The moray's crack: a dark hole under a hood of rock, low in the wall.
    const mo = nooks.moray,
      denGeometry = lobsterDen();
    this.geometries.push(denGeometry);
    const den = new THREE.Mesh(denGeometry, critters);
    den.name = 'Moray crack';
    den.position.set(
      mo.mouth.x - mo.axis.x * 0.05,
      mo.mouth.y - 0.3,
      mo.mouth.z - mo.axis.z * 0.05,
    );
    den.rotation.y = Math.atan2(mo.axis.x, mo.axis.z);
    den.scale.setScalar(1.7);
    this.root.add(den);
    try {
      this.moray = new Moray(caveHabitat(), [], mo);
      this.root.add(this.moray.root);
      this.sightings.push({
        ...CAVE_SIGHTS.moray,
        position: { ...mo.mouth },
        radius: 1,
      });
    } catch (error) {
      console.error('Cozy Diver: the cave moray could not be placed.', error);
    }
    // The turtle and the nurse shark.
    const t = nooks.turtle;
    this.turtle = new SleepingTurtle(createPose(), t.bed, t.yaw, t.air);
    this.nursePose.position.x = nooks.nurse.at.x;
    this.nursePose.position.y = nooks.nurse.at.y;
    this.nursePose.position.z = nooks.nurse.at.z;
    this.nursePose.yaw = nooks.nurse.yaw;
    // Cleaner shrimps, and the soldierfish that visits them.
    const st = nooks.station;
    this.cleaning = new CleaningVisit(createPose(), st.patch, st.out, st.home);
    const shrimp = shrimpGeometry();
    this.geometries.push(shrimp);
    this.shrimpMesh = new THREE.InstancedMesh(
      shrimp,
      critters,
      this.cleaning.shrimps.length,
    );
    this.shrimpMesh.name = 'Cleaner shrimps';
    this.sightings.push({
      ...CAVE_SIGHTS.shrimp,
      position: { ...st.patch },
      radius: 0.6,
    });
    // The octopus.
    const o = nooks.octopus;
    this.octopus = new Octopus(
      o,
      nooks.octopusRocks,
      (x, z) => caveObstacles(x, z, 0.15),
      (x, z) => caveObstacles(x, z, 0.1) - caveFloor(x, z) > 0.2,
      { sand: 0xb9ae95, rock: 0x9d927d, alarm: 0x5a2016 },
      OUTER_SIGHTS.octopus,
      1.4,
      45031,
    );
    this.sightings.push(...this.octopus.sightings);
    // Lionfish: bodies, and every fin ray of both in one draw.
    this.lionfish = nooks.lionfish.map((l) => new LionfishFan(l.at, l.yaw));
    const lb = lionBody(),
      lr = rayGeometry();
    this.geometries.push(lb, lr);
    this.lionBodies = new THREE.InstancedMesh(
      lb,
      critters,
      this.lionfish.length,
    );
    this.lionBodies.name = 'Lionfish';
    this.lionRays = new THREE.InstancedMesh(
      lr,
      this.own(
        new THREE.MeshStandardMaterial({
          name: 'Lionfish fins',
          vertexColors: true,
          roughness: 0.6,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
        }),
      ),
      this.lionfish.length * LION.rays,
    );
    this.lionRays.name = 'Lionfish fins';
    for (const l of this.lionfish)
      this.sightings.push({
        ...CAVE_SIGHTS.lionfish,
        position: l.at,
        radius: 0.8,
      });
    this.root.add(
      this.shrimpMesh,
      this.lionBodies,
      this.lionRays,
      this.octopus.root,
    );
    this.place();
    this.ready = this.load();
  }
  private own<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }
  private async part(
    build: () => Promise<void>,
    what: string,
  ): Promise<boolean> {
    try {
      await build();
      return !this.disposed;
    } catch (error) {
      if (!this.disposed)
        console.error(
          `Cozy Diver: the cave's ${what} could not be loaded.`,
          error,
        );
      return false;
    }
  }
  private async load(): Promise<boolean> {
    const results = await Promise.all([
      this.part(async () => {
        const body = new SoloCreature(
          this.loader,
          'nurseShark',
          this.nursePose,
          1,
          'Nurse shark',
          14,
        );
        this.nurse = body;
        if (!(await body.ready)) throw Error('nurse shark');
        this.root.add(body.root);
        this.sightings.push({
          ...CAVE_SIGHTS.nurseShark,
          position: this.nursePose.position,
          radius: 1.6,
        });
      }, 'nurse shark'),
      this.part(async () => {
        const body = new SoloCreature(
          this.loader,
          'seaTurtle',
          this.turtle.pose,
          1.05,
          'Sleeping turtle',
          14,
        );
        this.turtleBody = body;
        if (!(await body.ready)) throw Error('turtle');
        this.root.add(body.root);
        this.sightings.push({
          id: 'species:green-sea-turtle',
          label: 'Green sea turtle',
          position: this.turtle.pose.position,
          radius: 1.2,
        });
      }, 'turtle'),
      this.part(async () => {
        const lease = await this.loader.acquire('chromis');
        if (this.disposed) {
          lease.release();
          return;
        }
        this.cleanerFish = new PosedFish(
          [lease],
          [this.cleaning.fish.pose],
          'Soldierfish at the cleaners',
          0.46,
          10,
          undefined,
          0xc23a22,
        );
        this.root.add(this.cleanerFish.root);
      }, 'cleaning station'),
    ]);
    if (this.disposed) return false;
    this.place();
    return results.some(Boolean);
  }
  /** Give the flashlight fish their lights (once the cave's schools are ready). */
  attachGlows(fish: readonly FishEntity[]): void {
    if (this.disposed || this.glowMesh || !fish.length) return;
    const g = new THREE.SphereGeometry(0.035, 8, 6);
    g.scale(1.6, 0.8, 1);
    this.geometries.push(g);
    const glow = this.own(
      new THREE.MeshBasicMaterial({
        name: 'Flashlight fish light',
        color: 0xaafff0,
        fog: false,
        toneMapped: false,
      }),
    );
    this.glowMesh = new THREE.InstancedMesh(g, glow, fish.length);
    this.glowMesh.name = 'Flashlight fish lights';
    this.glowMesh.frustumCulled = false;
    this.glowFish = fish;
    for (let i = 0; i < fish.length; i += 6)
      this.sightings.push({
        ...CAVE_SIGHTS.flashlight,
        position: fish[i].position,
        radius: 1.2,
      });
    this.root.add(this.glowMesh);
    this.placeGlows();
  }
  private placeGlows(): void {
    const mesh = this.glowMesh;
    if (!mesh) return;
    this.glowFish.forEach((f, i) => {
      const v = f.velocity,
        l = Math.hypot(v.x, v.y, v.z) || 1,
        fx = l > 1e-3 ? v.x / l : Math.cos(f.yaw),
        fz = l > 1e-3 ? v.z / l : -Math.sin(f.yaw),
        len = f.species.length * f.size,
        on = blinkOn(i, this.time);
      // Under each eye, a little forward of the middle.
      this.p.set(
        f.position.x + fx * len * 0.32,
        f.position.y - len * 0.04,
        f.position.z + fz * len * 0.32,
      );
      this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.atan2(fx, fz));
      this.m.compose(this.p, this.q, this.s.setScalar(on ? len * 0.9 : 0.0001));
      mesh.setMatrixAt(i, this.m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  private place(): void {
    // Shrimps: facing out from the wall (or over the fish), antennae waving.
    const out = this.nooks.station.out;
    this.cleaning.shrimps.forEach((s, i) => {
      this.e.set(
        -0.3 + 0.2 * Math.sin(this.time * 2 + i),
        Math.atan2(out.x, out.z) + Math.sin(this.time * 0.7 + i) * 0.4,
        0,
      );
      this.q.setFromEuler(this.e);
      this.m.compose(this.p.set(s.x, s.y, s.z), this.q, this.s.setScalar(2.4));
      this.shrimpMesh.setMatrixAt(i, this.m);
    });
    this.shrimpMesh.instanceMatrix.needsUpdate = true;
    // Lionfish: the body hovering just over its rock; dorsal spines and pectoral fans by `spread`.
    this.lionfish.forEach((l, k) => {
      const bob = 0.01 * Math.sin(this.time * 0.9 + k);
      this.e.set(0, l.heading, 0);
      this.q.setFromEuler(this.e);
      this.m.compose(
        this.p.set(l.at.x, l.at.y + 0.05 + bob, l.at.z),
        this.q,
        this.s.setScalar(LION.scale),
      );
      this.lionBodies.setMatrixAt(k, this.m);
      const sp = l.spread;
      for (let r = 0; r < LION.rays; r++) {
        let rx: number,
          rz: number,
          len: number,
          ox: number,
          oy: number,
          oz: number;
        if (r < 8) {
          // Dorsal spines along the back: swept back at rest, raised and splayed when alarmed.
          const u = r / 7;
          ox = 0;
          oy = 0.09;
          oz = 0.07 - u * 0.15;
          rx = -0.9 * (1 - sp) - 0.15 + 0.1 * u * sp;
          rz = 0;
          len = 0.11 + 0.05 * Math.sin(u * Math.PI);
        } else {
          // Pectoral fans either side: folded back along the body at rest, a wide fan when alarmed.
          const j = (r - 8) % 6,
            side = r < 14 ? 1 : -1,
            u = j / 5;
          ox = side * 0.03;
          oy = 0.04;
          oz = 0.04;
          rz = -side * (0.4 + (1.2 + 0.2 * u) * sp);
          rx = -1.3 + (0.9 - u * 1.2) * sp - u * 0.25 * (1 - sp);
          len = 0.14 + 0.04 * Math.sin(u * Math.PI);
        }
        this.e.set(rx, 0, rz, 'XZY');
        this.m2.compose(
          this.p.set(ox, oy, oz),
          this.q.setFromEuler(this.e),
          this.s.set(1, len, 1),
        );
        this.lionRays.setMatrixAt(
          k * LION.rays + r,
          this.m2.premultiply(this.m),
        );
      }
    });
    this.lionBodies.instanceMatrix.needsUpdate = true;
    this.lionRays.instanceMatrix.needsUpdate = true;
    this.turtleBody?.update();
    this.nurse?.update();
    this.cleanerFish?.update();
    this.placeGlows();
  }
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    player: PlayerPresence,
  ): void {
    if (this.disposed) return;
    if (active && dt > 0) {
      const step = Math.min(dt, 0.1);
      this.time += step;
      this.turtle.update(step);
      this.cleaning.update(step);
      for (const l of this.lionfish) l.update(step, player);
      // The nurse shark sleeps, its tail stirring slowly; a close swimmer sets it sweeping.
      const n = this.nursePose.position,
        e = player.position,
        near =
          player.active && Math.hypot(e.x - n.x, e.y - n.y, e.z - n.z) < 2.2;
      this.nursePose.effort =
        (near ? 0.35 : 0.08) * Math.sin(this.time * (near ? 1.2 : 0.35));
    }
    this.moray?.update(dt, active, reducedMotion, player);
    this.octopus.update(dt, active, reducedMotion, player);
    this.place();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sightings.length = 0;
    this.root.removeFromParent();
    this.moray?.dispose();
    this.nurse?.dispose();
    this.turtleBody?.dispose();
    this.cleanerFish?.dispose();
    this.octopus.dispose();
    this.shrimpMesh.dispose();
    this.lionBodies.dispose();
    this.lionRays.dispose();
    this.glowMesh?.dispose();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.root.clear();
  }
}
