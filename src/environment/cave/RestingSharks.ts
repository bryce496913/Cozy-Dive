import * as THREE from 'three';
import type { AssetLease, AssetLoader } from '../../assets/AssetLoader';
import { CRUISE_SPECIES } from '../../config/creatures';
import type { SightCandidate } from '../../discovery/journal';
import { creatureSight } from '../../discovery/sights';
import type { Vec3 } from '../../config/world';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import { CAVE } from '../../config/passage';
import { creatureStroke } from '../creatureStroke';
import { caveFloor, wallDistance } from './CaveTerrain';

/**
 * v0.6 Pass 034: whitetip reef sharks resting on the cave's sand, as they do by day. Each lies
 * still on its belly, its body flexing very slightly as it breathes. Models are leased from the
 * shared fish loader (the circling whitetip shares the same cache entry).
 */
export const RESTING = {
  /** Height of the model's centre above the sand (m, at the whitetip's scale). */
  lift: 0.15,
  /** The breathing flex: how much of the authored stroke, and how often (per second). */
  stroke: 0.12,
  rate: 0.35,
  /**
   * v0.6 Pass 035: now and then (every `every` s or so) a shark stirs: a few strong beats of its
   * tail over `stir` s lift it a little off the sand and turn it a touch, then it settles again.
   */
  every: [22, 45] as const,
  stir: 4.5,
  stirStroke: 0.6,
  stirLift: 0.08,
  stirTurn: 0.35,
  /**
   * v0.6 Pass 041: a swimmer coming within `scare` m startles a resting shark: it bolts away with
   * hard beats of its tail for `flee` s at up to `dash` m/s, lifting off the sand, then swims
   * calmly (`cruise` m/s) to another resting place well away from the swimmer and settles there.
   * It will not startle again for `calm` s after settling.
   */
  scare: 3.2,
  flee: 3.5,
  dash: 2.8,
  cruise: 1.1,
  calm: 6,
  /** Swimming height above the sand while it flees or moves (m). */
  swimLift: 1.1,
} as const;

export interface RestSpot {
  readonly x: number;
  readonly z: number;
  /** Heading about +y (0 faces +x, as the cruisers do). */
  readonly yaw: number;
}
type Mood = 'rest' | 'flee' | 'settle';
interface Rig {
  readonly root: THREE.Group;
  mood: Mood;
  /** Time in this mood (s), its horizontal velocity, and where it is going to rest. */
  moodTime: number;
  vx: number;
  vz: number;
  spot: RestSpot;
  /** Seconds before it can be startled again. */
  calm: number;
  readonly near: THREE.Mesh;
  readonly far: THREE.Mesh;
  readonly left: number;
  readonly right: number;
  readonly phase: number;
  rest: number;
  /** Heading now, and the heading it is turning to while it stirs. */
  yaw: number;
  from: number;
  to: number;
  /** Seconds until it next stirs; how far through a stir it is (negative when still). */
  wait: number;
  stirring: number;
}

export class RestingSharks {
  readonly root = new THREE.Group();
  readonly sightings: SightCandidate[] = [];
  readonly ready: Promise<boolean>;
  private leases: AssetLease[] = [];
  private rigs: Rig[] = [];
  private time = 0;
  private disposed = false;

  constructor(
    private readonly spots: readonly RestSpot[],
    private readonly loader: AssetLoader,
    /** v0.6 Pass 041: open sand where a startled shark may settle again. */
    private readonly pool: readonly RestSpot[] = spots,
    /** The highest rock or sand near a point, to swim over. */
    private readonly ground: (
      x: number,
      z: number,
      radius: number,
    ) => number = (x, z) => caveFloor(x, z),
  ) {
    this.root.name = 'Resting whitetips';
    this.ready = this.load();
  }
  private async load(): Promise<boolean> {
    const species = CRUISE_SPECIES['whitetip-reef-shark'],
      results = await Promise.allSettled(
        this.spots.map(() => this.loader.acquire(species.asset)),
      );
    this.leases = results.flatMap((r) =>
      r.status === 'fulfilled' ? [r.value] : [],
    );
    const failed = results.find((r) => r.status === 'rejected');
    if (this.disposed || failed) {
      if (failed?.status === 'rejected' && !this.disposed)
        console.error(
          'Cozy Diver: the resting sharks could not be loaded.',
          failed.reason,
        );
      this.release();
      return false;
    }
    this.spots.forEach((s, i) => {
      const model = this.leases[i].model,
        near = model.getObjectByName('Body'),
        far = model.getObjectByName('Body_LOD1');
      if (!(near instanceof THREE.Mesh) || !(far instanceof THREE.Mesh))
        throw Error('whitetipShark: Body and Body_LOD1 must be meshes');
      // Lying still, close by: the full model only.
      far.visible = false;
      const root = new THREE.Group();
      root.name = `${species.name} resting`;
      root.scale.setScalar(species.scale);
      root.position.set(s.x, caveFloor(s.x, s.z) + RESTING.lift, s.z);
      root.rotation.set(0, s.yaw, 0);
      root.add(model);
      this.root.add(root);
      const keys = near.morphTargetDictionary ?? {};
      this.rigs.push({
        root,
        mood: 'rest',
        moodTime: 0,
        vx: 0,
        vz: 0,
        spot: s,
        calm: 0,
        near,
        far,
        left: keys.Stroke_Left ?? 0,
        right: keys.Stroke_Right ?? 1,
        phase: i * 2.1,
        rest: root.position.y,
        yaw: s.yaw,
        from: s.yaw,
        to: s.yaw,
        // Staggered, so they do not all stir together.
        wait: RESTING.every[0] * (0.4 + 0.5 * i),
        stirring: -1,
      });
      this.sightings.push({
        id: creatureSight(species.id),
        label: species.name,
        // Follows the shark (it may swim off and settle elsewhere).
        position: root.position,
        radius: species.radius + 0.5,
      });
    });
    return true;
  }
  /**
   * A slow breathing flex, and now and then a stir; a close swimmer startles it into bolting off
   * to rest elsewhere. On simulation time only (still while paused). With reduced motion they
   * only breathe, more gently, and a startled shark swims off without the burst.
   */
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    player?: PlayerPresence,
  ): void {
    if (this.disposed || !active || !(dt > 0)) return;
    const step = Math.min(dt, 0.1);
    this.time += step;
    for (const r of this.rigs) {
      r.moodTime += step;
      r.calm = Math.max(0, r.calm - step);
      const p = r.root.position;
      if (
        r.mood === 'rest' &&
        r.calm <= 0 &&
        player?.active &&
        Math.hypot(
          player.position.x - p.x,
          player.position.y - p.y,
          player.position.z - p.z,
        ) < RESTING.scare
      ) {
        r.mood = 'flee';
        r.moodTime = 0;
        r.stirring = -1;
        // Off the way it faces, turned away from the swimmer.
        const ax = p.x - player.position.x,
          az = p.z - player.position.z,
          l = Math.hypot(ax, az) || 1;
        r.vx = (ax / l) * 0.6;
        r.vz = (az / l) * 0.6;
      }
      if (r.mood === 'rest') this.rest(r, step, reducedMotion);
      else this.swim(r, step, reducedMotion, player);
    }
  }
  /** Lying on the sand: breathing, and now and then a stir. */
  private rest(r: Rig, step: number, reducedMotion: boolean): void {
    let effort =
      RESTING.stroke *
      (reducedMotion ? 0.5 : 1) *
      Math.sin(this.time * RESTING.rate * Math.PI * 2 + r.phase);
    if (!reducedMotion) {
      if (r.stirring < 0) {
        r.wait -= step;
        if (r.wait <= 0) {
          r.stirring = 0;
          r.from = r.yaw;
          r.to = r.yaw + RESTING.stirTurn * Math.sin(this.time * 7.3 + r.phase);
        }
      } else {
        r.stirring += step / RESTING.stir;
        const k = Math.min(1, r.stirring),
          env = Math.sin(Math.PI * k),
          ease = k * k * (3 - 2 * k);
        effort +=
          RESTING.stirStroke *
          env *
          Math.sin(this.time * 1.3 * Math.PI * 2 + r.phase);
        r.yaw = r.from + (r.to - r.from) * ease;
        r.root.rotation.set(0, r.yaw, 0);
        r.root.position.y = r.rest + RESTING.stirLift * env;
        if (k >= 1) {
          r.stirring = -1;
          r.wait =
            RESTING.every[0] +
            (RESTING.every[1] - RESTING.every[0]) *
              (0.5 + 0.5 * Math.sin(this.time * 3.1 + r.phase));
        }
      }
    }
    creatureStroke(r.near, r, effort);
  }
  /** Bolting away from the swimmer, then swimming calmly to another place and settling. */
  private swim(
    r: Rig,
    step: number,
    reducedMotion: boolean,
    player?: PlayerPresence,
  ): void {
    const p = r.root.position,
      c = CAVE.chamber;
    let ax = 0,
      az = 0,
      speed: number = RESTING.cruise;
    if (r.mood === 'flee') {
      // Away from the swimmer, fast; turning in from the walls.
      if (player) {
        ax = p.x - player.position.x;
        az = p.z - player.position.z;
      }
      speed = reducedMotion
        ? RESTING.cruise
        : RESTING.dash * Math.min(1, 0.4 + r.moodTime);
      if (r.moodTime > RESTING.flee) {
        r.mood = 'settle';
        r.moodTime = 0;
        r.spot = this.restingPlace(r, player?.position);
      }
    } else {
      ax = r.spot.x - p.x;
      az = r.spot.z - p.z;
    }
    if (wallDistance(p) < 3) {
      ax += (c.x - p.x) * 0.4;
      az += (c.z - p.z) * 0.4;
    }
    const l = Math.hypot(ax, az) || 1,
      left = Math.hypot(r.spot.x - p.x, r.spot.z - p.z),
      arriving = r.mood === 'settle' && left < 2.5;
    if (arriving) speed *= Math.max(0.15, left / 2.5);
    const k = 1 - Math.exp(-2.5 * step);
    r.vx += ((ax / l) * speed - r.vx) * k;
    r.vz += ((az / l) * speed - r.vz) * k;
    p.x += r.vx * step;
    p.z += r.vz * step;
    // Up off the sand while it swims, and down again as it arrives.
    const floor = caveFloor(p.x, p.z),
      over = this.ground(p.x, p.z, 0.9) + 0.4,
      height = arriving
        ? floor +
          RESTING.lift +
          (RESTING.swimLift - RESTING.lift) * (left / 2.5)
        : Math.max(over, floor + RESTING.swimLift);
    p.y += (height - p.y) * (1 - Math.exp(-3 * step));
    // Face along its motion, banking a little into its turn.
    const v = Math.hypot(r.vx, r.vz);
    if (v > 0.05) {
      const want = Math.atan2(-r.vz, r.vx),
        turn = Math.atan2(Math.sin(want - r.yaw), Math.cos(want - r.yaw));
      r.yaw += turn * (1 - Math.exp(-4 * step));
      r.root.rotation.set(reducedMotion ? 0 : -turn * 0.4, r.yaw, 0);
    }
    // Hard, quick beats while it bolts; easy ones as it swims on.
    const hz = r.mood === 'flee' ? 1.8 : 0.9,
      amp = r.mood === 'flee' ? 0.85 : 0.5;
    creatureStroke(
      r.near,
      r,
      amp *
        (reducedMotion ? 0.6 : 1) *
        Math.sin(this.time * hz * Math.PI * 2 + r.phase),
    );
    if (arriving && left < 0.3 && v < 0.35) {
      // Settled: turn to lie as it lies there, and rest.
      r.mood = 'rest';
      r.moodTime = 0;
      r.calm = RESTING.calm;
      r.rest = floor + RESTING.lift;
      p.y = r.rest;
      r.vx = r.vz = 0;
      r.root.rotation.set(0, r.yaw, 0);
      r.wait = RESTING.every[0];
    }
  }
  /** The free resting place furthest from the swimmer. */
  private restingPlace(r: Rig, eye?: Readonly<Vec3>): RestSpot {
    let best = r.spot,
      far = -Infinity;
    for (const s of this.pool) {
      if (this.rigs.some((o) => o !== r && o.spot === s)) continue;
      const d = eye ? Math.hypot(s.x - eye.x, s.z - eye.z) : 0;
      if (d > far) {
        far = d;
        best = s;
      }
    }
    return best;
  }
  private release(): void {
    this.leases.forEach((l) => l.release());
    this.leases = [];
    this.loader.evictUnused(CRUISE_SPECIES['whitetip-reef-shark'].asset);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sightings.length = 0;
    this.rigs = [];
    this.release();
    this.root.removeFromParent();
    this.root.clear();
  }
}
