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
import { limb, merged, tinted } from './CaveLobsters';
import { OCTOPUS_DEN, octopusDenGeometry } from '../shared/OctopusDen';
import { CAVE_LIFE, caveHabitat, caveObstacles } from './CaveLife';
import type { CaveNooks } from './CaveNooks';
import { caveFloor, wallDistance } from './CaveTerrain';
import { CAVE } from '../../config/passage';
import {
  SharkBolt,
  type BoltWorld,
  type RestSpot,
} from '../../creatures/sharkBolt';

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
/**
 * v0.6 Pass 052 (playtest: "the lionfish needs more detail"): 13 dorsal spines and 8 rays in each
 * pectoral fan (was 8 and 6).
 */
/** v0.6 Pass 052: the nurse shark keeps low for this far (m) as it slips from under its ledge,
 * and goes home once the swimmer has been beyond `homeClear` m for `homeAfter` s. */
const NURSE = { slipOut: 2.2, homeClear: 9, homeAfter: 25 } as const;
/**
 * v0.6 Pass 052: the moray's crack (an outcrop built like the octopus's den): its size, and how far
 * its mouth sits behind the moray's head, so the head rests just inside the crack.
 */
const MORAY_CRACK = { scale: 2.4, back: 0.4 } as const;
const LION = { dorsal: 13, pectoral: 8, rays: 13 + 2 * 8, scale: 1.6 } as const;

/** A cleaner shrimp facing +z, its legs at y 0 (about 6 cm before scaling): a slender, arched
 * body (carapace with a pointed rostrum, six tail segments curving down to a fanned tail), red
 * flanks with the white stripe down its back, stalked black eyes, three pairs of long white
 * antennae, and five pairs of jointed legs, the front two ending in little claws. */
function shrimpGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z),
    red: [number, number, number] = [0.85, 0.12, 0.1],
    white: [number, number, number] = [0.97, 0.95, 0.92];
  /** Height of the body's centreline along z: an arch over the tail. */
  const spine = (z: number) => 0.01 + 0.004 * Math.cos((z - 0.008) * 70);
  // Carapace: a laterally flattened ellipsoid, and the rostrum.
  const shell = new THREE.SphereGeometry(1, 14, 10);
  shell.scale(0.0055, 0.0065, 0.014);
  shell.translate(0, spine(0.016), 0.016);
  parts.push(tinted(shell, red));
  const rostrum = new THREE.ConeGeometry(0.0016, 0.012, 5);
  rostrum.rotateX(Math.PI / 2);
  rostrum.translate(0, spine(0.016) + 0.003, 0.034);
  parts.push(tinted(rostrum, red));
  // Six tail segments, tapering and bending down.
  for (let k = 0; k < 6; k++) {
    const z = 0.0 - k * 0.0062,
      r = 0.005 - k * 0.0005,
      seg = new THREE.SphereGeometry(1, 10, 8);
    seg.scale(r * 0.9, r * 1.1, 0.0042);
    seg.rotateX(-0.25 - k * 0.12);
    seg.translate(0, spine(z) - k * k * 0.0004, z);
    parts.push(tinted(seg, red));
  }
  // The white stripe along the back, carapace to tail.
  for (let k = 0; k < 9; k++) {
    const z = 0.026 - k * 0.0055,
      dot = new THREE.SphereGeometry(1, 6, 4);
    dot.scale(0.0016, 0.0012, 0.0036);
    dot.translate(
      0,
      spine(z) +
        (k < 4 ? 0.0063 : 0.005 - (k - 4) * 0.0005) -
        Math.max(0, k - 4) ** 2 * 0.0004,
      z,
    );
    parts.push(tinted(dot, white));
  }
  // Tail fan: a telson and two uropods each side, white with red bases.
  for (const a of [-0.5, -0.2, 0, 0.2, 0.5]) {
    const blade = new THREE.ConeGeometry(0.0024, 0.009, 4);
    blade.rotateX(-Math.PI / 2 - 0.6);
    blade.scale(1, 0.35, 1);
    blade.rotateY(a);
    blade.translate(0, spine(-0.037) - 0.012, -0.04);
    parts.push(tinted(blade, white));
  }
  for (const s of [-1, 1]) {
    // Stalked eyes.
    parts.push(
      limb(
        v(s * 0.002, spine(0.028), 0.028),
        v(s * 0.005, spine(0.028) + 0.002, 0.031),
        0.0009,
        0.0008,
        red,
      ),
    );
    const eye = new THREE.SphereGeometry(0.0017, 8, 6);
    eye.translate(s * 0.0055, spine(0.028) + 0.0022, 0.0315);
    parts.push(tinted(eye, [0.05, 0.04, 0.04]));
    // Three pairs of long white antennae, sweeping forward and out.
    for (const [spread, rise, reach] of [
      [0.022, 0.024, 0.085],
      [0.03, 0.012, 0.07],
      [0.012, 0.03, 0.06],
    ] as const)
      parts.push(
        limb(
          v(s * 0.0015, spine(0.03), 0.032),
          v(s * spread, spine(0.03) + rise, 0.032 + reach),
          0.0006,
          0.00025,
          white,
        ),
      );
    // Five pairs of legs, each in two segments; the front two with tiny claws.
    for (let k = 0; k < 5; k++) {
      const z = 0.024 - k * 0.005,
        hip = v(s * 0.003, spine(z) - 0.004, z),
        knee = v(s * 0.008, spine(z) - 0.001, z + 0.002),
        foot = v(s * 0.011, 0, z + 0.001);
      parts.push(
        limb(hip, knee, 0.0007, 0.0006, k < 2 ? white : [0.9, 0.35, 0.28]),
      );
      parts.push(limb(knee, foot, 0.0006, 0.0003, white));
      if (k < 2) {
        const claw = new THREE.SphereGeometry(0.0011, 5, 4);
        claw.scale(1, 0.6, 1.6);
        claw.translate(foot.x, foot.y + 0.001, foot.z + 0.002);
        parts.push(tinted(claw, white));
      }
    }
  }
  return merged(parts);
}
/** Lionfish stripes: broad red-brown bands with fine ones between, on cream (z along the body). */
function lionStripe(x: number, y: number, z: number): [number, number, number] {
  // The bands lean back a little and curve over the head; a fine band between each broad one.
  const t = z * 95 + Math.sin(y * 30) * 0.8 + Math.abs(x) * 20,
    broad = Math.sin(t) > 0.35,
    fine = Math.abs(Math.sin(t * 2 + 1.6)) > 0.93,
    throat = y < 0.03 && z > 0.02;
  if (throat) return [0.96, 0.9, 0.82];
  if (broad) return [0.6, 0.14, 0.08];
  if (fine) return [0.45, 0.12, 0.08];
  return [0.97, 0.9, 0.8];
}
/** A thin fin membrane: a fan of triangles from `base`, spotted, see-through (alpha in the material). */
function finFan(
  base: THREE.Vector3,
  tips: readonly THREE.Vector3[],
): THREE.BufferGeometry {
  const pos: number[] = [],
    col: number[] = [];
  for (let i = 0; i < tips.length - 1; i++) {
    const a = tips[i],
      b = tips[i + 1];
    // Both faces, so the fin shows from either side whatever the material's culling.
    pos.push(base.x, base.y, base.z, a.x, a.y, a.z, b.x, b.y, b.z);
    pos.push(base.x, base.y, base.z, b.x, b.y, b.z, a.x, a.y, a.z);
    for (let k = 0; k < 6; k++) {
      const spot = (i + k) % 3 === 0 ? 0.35 : 1;
      col.push(0.85 * spot, 0.62 * spot, 0.5 * spot);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
/** A lionfish body facing +z, its belly at y 0 (about 30 cm before scaling), with head tentacles. */
function lionBody(): THREE.BufferGeometry {
  // A deep, compressed body: big head, deepest behind it, tapering to a slim tail stalk.
  const body = new THREE.SphereGeometry(1, 28, 18),
    bp = body.getAttribute('position');
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i),
      y = bp.getY(i),
      z = bp.getZ(i),
      // Depth along the body (z from +1 snout to -1 tail).
      deep =
        0.75 + 0.35 * Math.cos((z - 0.25) * 1.7) - 0.45 * Math.max(0, -z - 0.4),
      wide = 0.8 + 0.25 * Math.cos((z - 0.2) * 1.5);
    bp.setXYZ(i, x * 0.034 * wide, y * 0.056 * deep, z * 0.13);
  }
  body.translate(0, 0.055, 0);
  const g = body.toNonIndexed();
  body.dispose();
  const pos = g.getAttribute('position'),
    col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++)
    col.set(lionStripe(pos.getX(i), pos.getY(i) - 0.055, pos.getZ(i)), i * 3);
  g.deleteAttribute('uv');
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const parts = [g],
    v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  // Soft dorsal, anal and tail fins: spotted see-through fans.
  parts.push(
    finFan(v(0, 0.1, -0.06), [
      v(0, 0.11, -0.02),
      v(0, 0.16, -0.05),
      v(0, 0.17, -0.09),
      v(0, 0.15, -0.12),
      v(0, 0.1, -0.13),
    ]),
    finFan(v(0, 0.015, -0.07), [
      v(0, 0.01, -0.03),
      v(0, -0.04, -0.07),
      v(0, -0.045, -0.1),
      v(0, 0.01, -0.12),
    ]),
    finFan(v(0, 0.055, -0.13), [
      v(0, 0.1, -0.17),
      v(0, 0.11, -0.21),
      v(0, 0.08, -0.235),
      v(0, 0.03, -0.235),
      v(0, 0.0, -0.21),
      v(0, 0.01, -0.17),
    ]),
  );
  // A big-lipped mouth.
  const lips = new THREE.TorusGeometry(0.012, 0.004, 5, 10);
  lips.scale(1.1, 0.8, 1);
  lips.translate(0, 0.045, 0.128);
  parts.push(tinted(lips, [0.7, 0.3, 0.22]));
  for (const s of [-1, 1]) {
    // Glossy eyes in a red ring, a stripe running through each.
    const ring = new THREE.SphereGeometry(0.012, 10, 8);
    ring.translate(s * 0.022, 0.075, 0.085);
    parts.push(tinted(ring, [0.55, 0.12, 0.07]));
    const eye = new THREE.SphereGeometry(0.0085, 10, 8);
    eye.translate(s * 0.028, 0.076, 0.088);
    parts.push(tinted(eye, [0.04, 0.03, 0.03]));
    // Banded, fleshy tentacles over the eyes, and small tabs below the mouth.
    for (let k = 0; k < 3; k++) {
      const seg = new THREE.ConeGeometry(0.004 - k * 0.001, 0.014, 5);
      seg.translate(s * 0.02, 0.098 + k * 0.012, 0.082 - k * 0.003);
      parts.push(tinted(seg, k % 2 ? [0.95, 0.88, 0.8] : [0.7, 0.2, 0.12]));
    }
    const tab = new THREE.ConeGeometry(0.003, 0.012, 4);
    tab.rotateX(Math.PI);
    tab.translate(s * 0.012, 0.028, 0.11);
    parts.push(tinted(tab, [0.9, 0.8, 0.72]));
    // Pelvic fins below, spotted.
    parts.push(
      finFan(v(s * 0.01, 0.01, 0.04), [
        v(s * 0.02, -0.03, 0.03),
        v(s * 0.03, -0.045, -0.01),
        v(s * 0.02, -0.03, -0.04),
      ]),
    );
  }
  return merged(parts);
}
/** One fin ray (spine), its base at the origin, pointing up +y (1 unit long): finely banded. */
function rayGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    bands = 8;
  for (let k = 0; k < bands; k++) {
    const r0 = 0.008 * (1 - k / bands) + 0.0015,
      r1 = 0.008 * (1 - (k + 1) / bands) + 0.0015,
      seg = new THREE.CylinderGeometry(r1, r0, 1 / bands, 5, 1);
    seg.translate(0, (k + 0.5) / bands, 0);
    parts.push(tinted(seg, k % 2 ? [0.96, 0.9, 0.82] : [0.62, 0.15, 0.09]));
  }
  // The membrane trailing each ray: wider, from its base to two-thirds up, banded like the ray.
  const web: number[] = [],
    tone: number[] = [],
    steps = 6;
  for (let k = 0; k < steps; k++) {
    const y0 = 0.04 + (k / steps) * 0.66,
      y1 = 0.04 + ((k + 1) / steps) * 0.66,
      w0 = 0.09 * (1 - k / steps),
      w1 = 0.09 * (1 - (k + 1) / steps);
    web.push(0, y0, 0, 0, y1, 0, 0, y0 - 0.03, -w0);
    web.push(0, y1, 0, 0, y1 - 0.03, -w1, 0, y0 - 0.03, -w0);
    const c = k % 2 ? [0.95, 0.85, 0.75] : [0.75, 0.32, 0.24];
    for (let n = 0; n < 6; n++) tone.push(c[0], c[1], c[2]);
  }
  const membrane = new THREE.BufferGeometry();
  membrane.setAttribute('position', new THREE.Float32BufferAttribute(web, 3));
  membrane.setAttribute('color', new THREE.Float32BufferAttribute(tone, 3));
  membrane.computeVertexNormals();
  parts.push(membrane);
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
  /**
   * v0.6 Pass 052 (playtest: "the zebra shark needs to be scared away like the other sharks"): the
   * nurse shark startles and bolts like the resting whitetips (see `SharkBolt`): it slips out
   * from under its ledge, dashes off and settles on open sand, and goes home under the ledge
   * once the swimmer has been gone a while.
   */
  private readonly nurseBolt: SharkBolt;
  private readonly nurseHome: RestSpot;
  private nurseAway = 0;
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
    // The moray's crack. v0.6 Pass 052 (playtest: "the moray eel and the cave are broken"): it was
    // the lobsters' thin open hood hung on the wall at the moray's height, floating above the
    // banked sand with gaps behind it. Now a solid outcrop of rock rises from the sand against the
    // wall, its deep dark crack at the moray's head and its back sunk into the wall, hiding the body.
    const mo = nooks.moray,
      denScale = MORAY_CRACK.scale,
      pocketMid = OCTOPUS_DEN.mouth.high * 0.6 * denScale,
      base = mo.mouth.y - pocketMid,
      ground = caveFloor(mo.mouth.x, mo.mouth.z),
      denGeometry = octopusDenGeometry(
        Math.max(0, (base - ground) / denScale + 0.15),
      );
    this.geometries.push(denGeometry);
    const den = new THREE.Mesh(denGeometry, rock);
    den.name = 'Moray crack';
    den.position.set(
      mo.mouth.x - mo.axis.x * MORAY_CRACK.back,
      base,
      mo.mouth.z - mo.axis.z * MORAY_CRACK.back,
    );
    den.rotation.y = Math.atan2(mo.axis.x, mo.axis.z);
    den.scale.setScalar(denScale);
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
    this.nurseHome = {
      x: nooks.nurse.at.x,
      z: nooks.nurse.at.z,
      yaw: nooks.nurse.yaw,
    };
    this.nurseBolt = new SharkBolt(
      this.nurseHome,
      nooks.nurse.at.y,
      nooks.nurse.at.y - caveFloor(nooks.nurse.at.x, nooks.nurse.at.z),
      1.3,
      NURSE.slipOut,
    );
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
      // v0.6 Pass 052: it walks on the cave floor, never over the tops of boulders.
      (x, z) => caveFloor(x, z),
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
        if (!(await body.ready) || this.disposed) throw Error('nurse shark');
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
        if (!(await body.ready) || this.disposed) throw Error('turtle');
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
        if (r < LION.dorsal) {
          // Dorsal spines along the back: swept back at rest, raised and splayed when alarmed.
          const u = r / (LION.dorsal - 1);
          ox = 0;
          oy = 0.1;
          oz = 0.075 - u * 0.15;
          rx = -0.9 * (1 - sp) - 0.15 + 0.1 * u * sp;
          rz = 0;
          len = 0.11 + 0.06 * Math.sin(u * Math.PI);
        } else {
          // Pectoral fans either side: folded back along the body at rest, a wide fan when alarmed.
          const j = (r - LION.dorsal) % LION.pectoral,
            side = r < LION.dorsal + LION.pectoral ? 1 : -1,
            u = j / (LION.pectoral - 1);
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
      this.nurseUpdate(step, reducedMotion, player);
    }
    this.moray?.update(dt, active, reducedMotion, player);
    this.octopus.update(dt, active, reducedMotion, player);
    this.place();
  }
  /** The nurse shark: asleep (its tail stirring slowly), or startled, bolting and settling. */
  private nurseUpdate(
    step: number,
    reducedMotion: boolean,
    player: PlayerPresence,
  ): void {
    const b = this.nurseBolt,
      eye = player.active ? player.position : undefined,
      pose = this.nursePose;
    if (eye) b.startle(eye);
    b.update(step, this.nurseWorld, reducedMotion, eye);
    if (b.mood === 'rest') {
      pose.effort = 0.08 * Math.sin(this.time * 0.35);
      pose.pitch = 0;
      pose.roll = 0;
      // Resting away from home: once the swimmer has been well away a while, go home.
      const away =
        Math.hypot(
          b.position.x - this.nurseHome.x,
          b.position.z - this.nurseHome.z,
        ) > 0.5;
      const gone =
        !eye ||
        Math.hypot(eye.x - this.nurseHome.x, eye.z - this.nurseHome.z) >
          NURSE.homeClear;
      this.nurseAway = away && gone ? this.nurseAway + step : 0;
      if (this.nurseAway > NURSE.homeAfter) {
        this.nurseAway = 0;
        b.goTo(this.nurseHome);
      }
    } else {
      pose.effort = b.effort;
      pose.pitch = b.pitch;
      pose.roll = b.bank;
    }
    pose.position.x = b.position.x;
    pose.position.y = b.position.y;
    pose.position.z = b.position.z;
    pose.yaw = b.yaw;
  }
  /** The cave as the nurse shark sees it while it swims. */
  private readonly nurseWorld: BoltWorld = {
    floor: (x, z) => caveFloor(x, z),
    over: (x, z, radius) => caveObstacles(x, z, radius),
    avoid: (p, push) => {
      const c = CAVE.chamber;
      if (wallDistance(p) < 3) {
        push.x += (c.x - p.x) * 0.08;
        push.z += (c.z - p.z) * 0.08;
      }
    },
    settleAt: (eye) => {
      let best: RestSpot = this.nurseHome,
        far = -Infinity;
      for (const s of CAVE_LIFE.settle) {
        const d = eye ? Math.hypot(s.x - eye.x, s.z - eye.z) : 0;
        // Beside the whitetips' places (never on top of one that has settled there).
        if (d > far) {
          far = d;
          best = { x: s.x + 1.6, z: s.z + 1.2, yaw: s.yaw + 0.4 };
        }
      }
      return best;
    },
  };
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
