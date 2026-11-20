import * as THREE from 'three';
import type { AssetLease, AssetLoader } from '../../assets/AssetLoader';
import type { AssetId } from '../../assets/AssetRegistry';
import { CRUISE_SPECIES } from '../../config/creatures';
import { WRECK } from '../../config/wreck';
import type { Vec3 } from '../../config/world';
import type { SightCandidate } from '../../discovery/journal';
import {
  CAVE_SIGHTS,
  OUTER_SIGHTS,
  WRECK_SIGHTS,
  creatureSight,
} from '../../discovery/sights';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import type { FishHabitat } from '../../fish/FishHabitat';
import {
  FISH_SPECIES,
  type FishSpecies,
  type SpeciesId,
} from '../../fish/FishSpecies';
import { OuterSchools } from '../outer/OuterSchools';
import { PosedFish, createPose, type FishPose } from '../outer/PosedFish';
import { SoloCreature } from '../outer/SoloCreature';
import {
  DECK_TOP,
  SHIP,
  fromShip,
  wreckColliders,
  wreckFloor,
} from './WreckLayout';

/**
 * Life on the wreck, as on the SS Yongala off Townsville, among the richest wreck dives anywhere:
 * the ship all but hidden by the fish around it. All of it calm; nothing hunts.
 *   - **Queensland groupers**, the wreck's famous residents: one slowly patrolling the dark hold
 *     (met in the torch's beam), one hanging in the shade under the stern;
 *   - a great school of **trevally** wheeling slowly over the deck;
 *   - **barracuda** hanging in a still column off the bow, all facing into the current;
 *   - a **humphead Māori wrasse** cruising the length of the hull;
 *   - **green turtles**: one asleep on the forecastle, one swimming slow laps;
 *   - a **whitetip reef shark** circling wide and low;
 *   - clouds of **chromis** over the decks, **glassy sweepers** packed in the hold, and **Moorish
 *     idols**, **butterflyfish** and **blue tangs** round the superstructure.
 * The schooling fish steer round the ship (its solid parts are their rocks). Owns all it makes.
 */
export const WRECK_LIFE = {
  /** The grouper's patrol in the hold (ship's frame): its ends, height, seconds per lap, length. */
  bass: { foreZ: -36.2, aftZ: -26.6, y: 3.3, lap: 80, length: 2.4 },
  trevally: { count: 22, radius: 5, y: 13.5, z: -31, lap: 50, length: 0.9 },
  barracuda: { count: 16, z: -55, y: 8.5 },
} as const;

/** A point in the ship's frame, in the cavern. */
const at = (x: number, y: number, z: number): Vec3 =>
  fromShip({ x, y, z }, { x: 0, y: 0, z: 0 });

/** Where the reef fish gather (ship's frame): kind, place, how many, how far they spread. */
const GROUPS: readonly {
  id: SpeciesId;
  p: Vec3;
  count: number;
  spread: Vec3;
}[] = [
  {
    id: 'blue-green-chromis',
    p: at(0, DECK_TOP + 2.5, -35),
    count: 60,
    spread: { x: 3.5, y: 1.5, z: 5 },
  },
  {
    id: 'blue-green-chromis',
    p: at(0, DECK_TOP + 4.5, -45),
    count: 40,
    spread: { x: 3, y: 1.5, z: 3 },
  },
  {
    id: 'blue-green-chromis',
    p: at(-1, DECK_TOP + 4, -19),
    count: 36,
    spread: { x: 3, y: 1.4, z: 3 },
  },
  // Packed into the hold's dark ends, where the torch finds them.
  {
    id: 'glassy-sweeper',
    p: at(0.3, 3.6, -37.8),
    count: 26,
    spread: { x: 2.6, y: 1.5, z: 1.6 },
  },
  {
    id: 'glassy-sweeper',
    p: at(-0.4, 3.8, -25.4),
    count: 20,
    spread: { x: 2.4, y: 1.5, z: 1.1 },
  },
  {
    id: 'moorish-idol',
    p: at(-4.5, DECK_TOP + 2, -19.5),
    count: 6,
    spread: { x: 1.5, y: 1, z: 2.5 },
  },
  {
    id: 'threadfin-butterflyfish',
    p: at(5.5, 4.5, -28),
    count: 8,
    spread: { x: 1.5, y: 1.2, z: 4 },
  },
  {
    id: 'threadfin-butterflyfish',
    p: at(-5.5, 3.5, -40),
    count: 6,
    spread: { x: 1.5, y: 1, z: 3 },
  },
  {
    id: 'blue-tang',
    p: at(5, DECK_TOP + 1.5, -44),
    count: 8,
    spread: { x: 2, y: 1, z: 2.5 },
  },
];

export function wreckSpecies(): FishSpecies[] {
  const chromis = FISH_SPECIES.find((f) => f.id === 'blue-green-chromis')!;
  return GROUPS.map((g) => {
    const sweeper = g.id === 'glassy-sweeper',
      species = sweeper
        ? chromis
        : (FISH_SPECIES.find((f) => f.id === g.id) ?? chromis),
      copper = 0xc98a4e;
    return {
      ...species,
      id: g.id,
      name: sweeper ? 'Glassy sweeper' : species.name,
      count: g.count,
      ...(sweeper
        ? {
            length: chromis.length * 1.2,
            height: chromis.height * 1.4,
            width: chromis.width * 1.2,
            color: copper,
            backColor: copper,
            finColor: copper,
            accentColor: copper,
          }
        : {}),
      schooling: {
        ...species.schooling,
        enabled: g.id === 'blue-green-chromis' || sweeper,
        spacing: species.schooling.spacing * (sweeper ? 0.8 : 1),
        cohesionWeight: species.schooling.cohesionWeight * (sweeper ? 1.5 : 1),
      },
      speed: species.speed * (sweeper ? 0.5 : 0.85),
      region: { x: g.p.x, y: g.p.y, z: g.p.z },
      spread: g.spread,
      depth: [g.p.y - g.spread.y - 0.6, g.p.y + g.spread.y + 0.6],
      individualScale: undefined,
      // Placed by their region alone (not near the sand, nor at the tank's shelters).
      substrateOffset: undefined,
      habitatKinds: undefined,
    };
  });
}

/** The fish's world: the cavern's open water, the ship as solid rock. */
export function wreckHabitat(): FishHabitat {
  const w = WRECK.walls;
  return {
    bounds: {
      min: { x: -w.x + 3, y: 0.6, z: w.farZ + 3 },
      max: { x: w.x - 3, y: WRECK.ceiling - 2, z: w.nearZ - 3 },
      clearance: 0.3,
    },
    rocks: wreckColliders(),
    substrateHeight: wreckFloor,
    floorHeight: wreckFloor,
  };
}

/** A slow, steady tail beat (the pose's stroke is the beat itself, -1..1). */
const beat = (t: number, rate: number, amp: number): number =>
  amp * Math.sin(t * rate * Math.PI * 2);

/**
 * The grouper's slow patrol of the hold (pure): up its length and back, turning gently at each
 * end, drifting a little from side to side and up and down. Writes its pose in the cavern.
 */
export class HoldPatrol {
  readonly pose: FishPose = createPose();
  private time = 0;
  private yaw = Math.PI / 2;
  private readonly local = { x: 0, y: 0, z: 0 };
  constructor(start = 0) {
    this.time = start;
    this.update(0, false);
  }
  update(dt: number, reducedMotion: boolean): void {
    const b = WRECK_LIFE.bass,
      step = Math.min(Math.max(dt, 0), 0.1) * (reducedMotion ? 0.5 : 1);
    this.time += step;
    const w = (Math.PI * 2) / b.lap,
      t = this.time,
      mid = (b.foreZ + b.aftZ) / 2,
      half = (b.aftZ - b.foreZ) / 2,
      z = mid + half * Math.sin(w * t),
      dz = half * w * Math.cos(w * t),
      pace = Math.abs(dz) / (half * w);
    this.local.x = 0.7 * Math.sin(w * t * 2.3);
    this.local.y = b.y + 0.3 * Math.sin(w * t * 1.7);
    this.local.z = z;
    fromShip(this.local, this.pose.position);
    // Facing the way it moves (forward is -z in the ship, yaw π/2), turning round at the ends.
    const want = dz < 0 ? Math.PI / 2 : -Math.PI / 2,
      turn = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw));
    if (dt > 0) this.yaw += turn * Math.min(1, step * (0.3 + 1.5 * (1 - pace)));
    else this.yaw = want;
    this.pose.yaw = this.yaw;
    this.pose.pitch = 0.05 * Math.sin(w * t * 1.7);
    this.pose.roll = -0.15 * turn;
    this.pose.effort = beat(t, 0.45, 0.2 + 0.25 * pace + 0.25 * Math.abs(turn));
    this.pose.fins = Math.sin(t * 1.3);
  }
}

/** A closed loop to swim round at a steady pace (pure): for the wrasse, the shark, the turtle. */
export class LoopSwim {
  readonly pose: FishPose = createPose();
  private readonly curve: THREE.CatmullRomCurve3;
  private readonly length: number;
  private readonly p = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private u: number;
  private time = 0;
  constructor(
    points: readonly Vec3[],
    private readonly speed: number,
    private readonly rate: number,
    start = 0,
  ) {
    this.curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
      true,
      'centripetal',
    );
    this.length = this.curve.getLength();
    this.u = start;
    this.update(0, false);
  }
  update(dt: number, reducedMotion: boolean): void {
    const step = Math.min(Math.max(dt, 0), 0.1) * (reducedMotion ? 0.5 : 1);
    this.time += step;
    this.u = (this.u + (step * this.speed) / this.length) % 1;
    this.curve.getPointAt(this.u, this.p);
    this.curve.getTangentAt(this.u, this.tangent);
    const pose = this.pose,
      yaw = Math.atan2(-this.tangent.z, this.tangent.x),
      turn = Math.atan2(Math.sin(yaw - pose.yaw), Math.cos(yaw - pose.yaw));
    pose.position.x = this.p.x;
    pose.position.y = this.p.y;
    pose.position.z = this.p.z;
    pose.yaw = yaw;
    pose.pitch = Math.asin(Math.max(-1, Math.min(1, this.tangent.y))) * 0.8;
    // Banking a little into its turns.
    if (step > 0)
      pose.roll +=
        (-Math.max(-0.3, Math.min(0.3, (turn / step) * 0.4)) - pose.roll) *
        Math.min(1, step * 2);
    pose.effort = beat(this.time, this.rate, 0.45);
    pose.fins = Math.sin(this.time * this.rate * Math.PI * 2);
  }
}

/** A loop round the ship (its plan in the ship's frame), at a level height in the cavern. */
const around = (rx: number, rz: number, y: number, n = 10): Vec3[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2,
      p = at(Math.cos(a) * rx, 0, -31.5 + Math.sin(a) * rz);
    p.y = y + 0.6 * Math.sin(a * 2);
    return p;
  });

type Sight = { readonly id: string; readonly label: string };

export class WreckLife {
  readonly root = new THREE.Group();
  readonly sightings: SightCandidate[] = [];
  readonly ready: Promise<boolean>;
  readonly patrol = new HoldPatrol();
  readonly schools: OuterSchools;
  /** The second grouper, hanging in the shade under the stern. */
  readonly sternGrouper = createPose();
  readonly trevally: FishPose[];
  readonly barracuda: FishPose[];
  readonly wrasse: LoopSwim;
  readonly shark: LoopSwim;
  /** Playtest (more big life): eagle rays, a manta, blacktip sharks. */
  readonly rays: LoopSwim[];
  readonly manta: LoopSwim;
  readonly blacktips: LoopSwim[];
  /** Two more groupers hanging beside the hull, and a whitetip asleep on the sand. */
  readonly hullGroupers = [createPose(), createPose()];
  readonly restingShark = createPose();
  readonly turtle: LoopSwim;
  /** The turtle asleep on the forecastle. */
  readonly sleeper = createPose();
  private readonly posed: PosedFish[] = [];
  private readonly solos: SoloCreature[] = [];
  private readonly textures = new Map<string, THREE.Texture>();
  private readonly offsets: Float32Array;
  private time = 0;
  private disposed = false;

  constructor(private readonly loader: AssetLoader) {
    this.root.name = 'Wreck life';
    this.schools = new OuterSchools(wreckHabitat(), wreckSpecies(), loader);
    this.trevally = Array.from(
      { length: WRECK_LIFE.trevally.count },
      createPose,
    );
    this.barracuda = Array.from(
      { length: WRECK_LIFE.barracuda.count },
      createPose,
    );
    // Each school fish's own place in its school: angle or slot, height, and a phase.
    let s = 7919;
    const rand = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    this.offsets = new Float32Array(
      (this.trevally.length + this.barracuda.length) * 3,
    ).map(() => rand());
    this.wrasse = new LoopSwim(around(7.5, 22, 3.6, 14), 0.55, 0.6, 0.3);
    this.shark = new LoopSwim(around(11, 24.5, 2.2, 14), 0.75, 0.5, 0.7);
    // A pair of eagle rays gliding low laps, a manta wheeling slowly high over the wreck, and
    // two blacktips circling wide (each loop round the whole ship, clear of it and each other).
    this.rays = [
      new LoopSwim(around(15, 25, 5, 14), 0.8, 0.22, 0.15),
      new LoopSwim(around(15.6, 25.6, 5.6, 14), 0.8, 0.22, 0.19),
    ];
    this.manta = new LoopSwim(around(9.5, 18, 13.6, 14), 0.6, 0.12, 0.5);
    this.blacktips = [
      new LoopSwim(around(18, 27, 3.5, 14), 0.9, 0.55, 0.05),
      new LoopSwim(around(17, 26, 9.5, 14), 0.95, 0.55, 0.62),
    ];
    Object.assign(this.hullGroupers[0].position, at(-5.6, 2.8, -33.5));
    this.hullGroupers[0].yaw = Math.PI / 2 + 0.3;
    Object.assign(this.hullGroupers[1].position, at(5.8, 3.2, -26));
    this.hullGroupers[1].yaw = -Math.PI / 2 - 0.2;
    {
      const p = at(-8.5, 0, -40);
      p.y = wreckFloor(p.x, p.z) + 0.14;
      Object.assign(this.restingShark.position, p);
      this.restingShark.yaw = 1.2;
    }
    this.turtle = new LoopSwim(around(8.5, 21, 9.8, 12), 0.35, 0.25, 0.1);
    Object.assign(this.sternGrouper.position, at(0, 3.0, SHIP.sternZ - 0.4));
    this.sternGrouper.yaw = -Math.PI / 2 + 0.5;
    Object.assign(
      this.sleeper.position,
      at(1.2, DECK_TOP + SHIP.forecastle.rise + 0.25, -46.8),
    );
    this.sleeper.yaw = 2.3;
    this.place(0, false);
    this.ready = this.load();
  }
  private async lease(id: AssetId, n: number): Promise<AssetLease[]> {
    const all = await Promise.allSettled(
        Array.from({ length: n }, () => this.loader.acquire(id)),
      ),
      ok = all.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    if (ok.length !== n || this.disposed) {
      ok.forEach((l) => l.release());
      throw Error(`${id} could not be loaded`);
    }
    return ok;
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
          `Cozy Diver: the wreck's ${what} could not be loaded.`,
          error,
        );
      return false;
    }
  }
  /** A failed animal must not let its still-loading companions escape the warm-up. */
  private async group(parts: Promise<void>[]): Promise<void> {
    const results = await Promise.allSettled(parts);
    const failed = results.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
  }
  private async fish(
    id: AssetId,
    poses: FishPose[],
    name: string,
    length: number,
    detail = 10,
  ): Promise<void> {
    const leases = await this.lease(id, poses.length),
      f = new PosedFish(leases, poses, name, length, detail, this.textures);
    this.posed.push(f);
    this.root.add(f.root);
  }
  private async solo(
    id: AssetId,
    pose: FishPose,
    scale: number,
    name: string,
  ): Promise<void> {
    const body = new SoloCreature(this.loader, id, pose, scale, name, 16);
    this.solos.push(body);
    if (!(await body.ready) || this.disposed) {
      body.dispose();
      const index = this.solos.indexOf(body);
      if (index !== -1) this.solos.splice(index, 1);
      throw Error(name);
    }
    this.root.add(body.root);
  }
  private sight(s: Sight, position: Vec3, radius: number): void {
    this.sightings.push({ ...s, position, radius });
  }
  private async load(): Promise<boolean> {
    const turtle: Sight = {
        id: creatureSight('green-sea-turtle'),
        label: CRUISE_SPECIES['green-sea-turtle'].name,
      },
      whitetip = CRUISE_SPECIES['whitetip-reef-shark'];
    const results = await Promise.all([
      this.schools.ready,
      this.part(async () => {
        await this.fish(
          'giantSeaBass',
          [this.patrol.pose, this.sternGrouper, ...this.hullGroupers],
          'Queensland groupers',
          WRECK_LIFE.bass.length,
          8,
        );
        this.sight(WRECK_SIGHTS.grouper, this.patrol.pose.position, 2.2);
        this.sight(WRECK_SIGHTS.grouper, this.sternGrouper.position, 2.4);
      }, 'groupers'),
      this.part(async () => {
        await this.fish(
          'trevally',
          this.trevally,
          'Trevally school',
          WRECK_LIFE.trevally.length,
          6,
        );
        this.sight(OUTER_SIGHTS.trevally, this.trevally[0].position, 6);
      }, 'trevally'),
      this.part(async () => {
        // A creature model (not the fish rig): one body each, at about 1.3 m.
        await this.group(
          this.barracuda.map((p, n) =>
            this.solo('barracuda', p, 0.85, `Barracuda ${n + 1}`),
          ),
        );
        this.sight(OUTER_SIGHTS.barracuda, this.barracuda[0].position, 5);
      }, 'barracuda'),
      this.part(async () => {
        await this.fish(
          'humpheadWrasse',
          [this.wrasse.pose],
          'Humphead Māori wrasse',
          1.8,
          8,
        );
        this.sight(OUTER_SIGHTS.wrasse, this.wrasse.pose.position, 2);
      }, 'wrasse'),
      this.part(async () => {
        await this.group([
          this.solo('seaTurtle', this.turtle.pose, 1, 'Green turtle'),
          this.solo('seaTurtle', this.sleeper, 0.95, 'Green turtle asleep'),
        ]);
        this.sight(turtle, this.turtle.pose.position, 1.6);
        this.sight(turtle, this.sleeper.position, 1.4);
      }, 'turtles'),
      this.part(async () => {
        await this.solo(
          whitetip.asset,
          this.shark.pose,
          whitetip.scale,
          'Whitetip reef shark',
        );
        this.sight(
          { id: creatureSight(whitetip.id), label: whitetip.name },
          this.shark.pose.position,
          whitetip.radius + 0.6,
        );
      }, 'shark'),
      this.part(async () => {
        const ray = CRUISE_SPECIES['spotted-eagle-ray'],
          manta = CRUISE_SPECIES['manta-ray'],
          tip = CRUISE_SPECIES['blacktip-reef-shark'],
          white = CRUISE_SPECIES['whitetip-reef-shark'];
        await this.group([
          ...this.rays.map((r, n) =>
            this.solo(ray.asset, r.pose, ray.scale, `Eagle ray ${n + 1}`),
          ),
          this.solo(manta.asset, this.manta.pose, manta.scale, 'Manta ray'),
          ...this.blacktips.map((b, n) =>
            this.solo(tip.asset, b.pose, tip.scale, `Blacktip ${n + 1}`),
          ),
          this.solo(
            white.asset,
            this.restingShark,
            white.scale,
            'Whitetip asleep',
          ),
        ]);
        this.sight(
          { id: creatureSight(ray.id), label: ray.name },
          this.rays[0].pose.position,
          ray.radius + 0.8,
        );
        this.sight(
          { id: creatureSight(manta.id), label: manta.name },
          this.manta.pose.position,
          manta.radius + 1,
        );
        this.sight(
          { id: creatureSight(tip.id), label: tip.name },
          this.blacktips[0].pose.position,
          tip.radius + 0.6,
        );
      }, 'rays and sharks'),
    ]);
    if (this.disposed) return false;
    this.root.add(this.schools.root);
    // Each reef school counts as seen from close by its leading fish (it carries the sighting).
    const lead = (id: SpeciesId) =>
      this.schools.fish.simulation.fish.find((f) => f.species.id === id);
    for (const [id, s, r] of [
      ['glassy-sweeper', CAVE_SIGHTS.sweeper, 2],
      ['moorish-idol', OUTER_SIGHTS.idol, 1.5],
      ['threadfin-butterflyfish', OUTER_SIGHTS.butterflyfish, 1.5],
      ['blue-tang', OUTER_SIGHTS.tang, 1.5],
    ] as const) {
      const f = lead(id);
      if (f) this.sight(s, f.position, r);
    }
    return results.every(Boolean);
  }
  /** The schools' and resting animals' poses for this moment. */
  private place(dt: number, reducedMotion: boolean): void {
    const step = Math.min(Math.max(dt, 0), 0.1) * (reducedMotion ? 0.5 : 1);
    this.time += step;
    const t = this.time,
      o = this.offsets,
      tv = WRECK_LIFE.trevally,
      spin = (Math.PI * 2) / tv.lap,
      centre = at(0, tv.y, tv.z);
    // Trevally: a slow wheel over the deck, a few layers deep, each fish on its own radius.
    this.trevally.forEach((p, i) => {
      const a =
          (i / this.trevally.length) * Math.PI * 2 + spin * t + o[i * 3] * 0.4,
        r = tv.radius * (0.7 + 0.6 * o[i * 3 + 1]),
        y = (o[i * 3 + 2] - 0.5) * 3 + 0.3 * Math.sin(t * 0.3 + i);
      p.position.x = centre.x + Math.cos(a) * r;
      p.position.y = centre.y + y;
      p.position.z = centre.z + Math.sin(a) * r;
      // Heading along the circle (the way the angle grows).
      p.yaw = Math.atan2(-Math.cos(a), -Math.sin(a));
      p.pitch = 0;
      p.roll = 0.15;
      p.effort = beat(t + o[i * 3] * 3, 1.1, 0.4);
      p.fins = Math.sin(t * 3 + i);
    });
    // Barracuda: a still column off the bow, every one facing into the current, barely finning.
    const bc = WRECK_LIFE.barracuda,
      k = this.trevally.length * 3,
      column = at(0, bc.y, bc.z);
    this.barracuda.forEach((p, i) => {
      const row = i % 4,
        tier = Math.floor(i / 4),
        jitter = o[k + i * 3] - 0.5;
      p.position.x =
        column.x +
        (row - 1.5) * 0.9 +
        jitter * 0.4 +
        0.3 * Math.sin(t * 0.07 + i);
      p.position.y =
        column.y + (tier - 1.5) * 1.1 + 0.15 * Math.sin(t * 0.2 + i * 1.3);
      p.position.z = column.z + (o[k + i * 3 + 1] - 0.5) * 1.6;
      p.yaw = Math.PI / 2 - 0.25 + jitter * 0.1;
      p.pitch = 0;
      p.roll = 0;
      p.effort = beat(t + o[k + i * 3 + 2] * 5, 0.35, 0.12);
      p.fins = Math.sin(t * 1.5 + i);
    });
    // The stern's grouper hangs still in the shade, fins sculling; the turtle on deck breathes.
    const g = this.sternGrouper;
    g.effort = beat(t, 0.25, 0.12);
    g.fins = Math.sin(t * 1.1);
    g.pitch = 0.04 * Math.sin(t * 0.2);
    this.sleeper.effort = 0.06 * Math.sin(t * 0.3);
    this.hullGroupers.forEach((h, i) => {
      h.effort = beat(t + i * 3, 0.22, 0.12);
      h.fins = Math.sin(t * 1.1 + i);
      h.pitch = 0.04 * Math.sin(t * 0.17 + i);
    });
    // The resting whitetip only breathes, its tail stirring now and then.
    this.restingShark.effort = 0.08 * Math.sin(t * 0.35);
  }
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    player: PlayerPresence,
    camera: THREE.Camera,
  ): void {
    if (this.disposed) return;
    if (active) {
      this.patrol.update(dt, reducedMotion);
      this.wrasse.update(dt, reducedMotion);
      for (const loop of [...this.rays, this.manta, ...this.blacktips])
        loop.update(dt, reducedMotion);
      this.shark.update(dt, reducedMotion);
      this.turtle.update(dt, reducedMotion);
      this.place(dt, reducedMotion);
    }
    for (const f of this.posed) f.update(camera);
    for (const s of this.solos) s.update(camera);
    this.schools.update(dt, active, reducedMotion, player, camera);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sightings.length = 0;
    this.posed.forEach((f) => f.dispose());
    this.solos.forEach((s) => s.dispose());
    this.schools.dispose();
    this.root.removeFromParent();
    this.root.clear();
    for (const id of ['giantSeaBass', 'trevally', 'humpheadWrasse'] as const)
      this.loader.evictUnused(id);
  }
}
