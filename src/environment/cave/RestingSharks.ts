import * as THREE from 'three';
import type { AssetLease, AssetLoader } from '../../assets/AssetLoader';
import { CRUISE_SPECIES } from '../../config/creatures';
import type { SightCandidate } from '../../discovery/journal';
import { creatureSight } from '../../discovery/sights';
import type { Vec3 } from '../../config/world';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import { CAVE } from '../../config/passage';
import { creatureStroke } from '../creatureStroke';
import {
  BOLT,
  SharkBolt,
  type BoltWorld,
  type RestSpot,
} from '../../creatures/sharkBolt';
import { caveFloor, wallDistance } from './CaveTerrain';

export type { RestSpot };

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
   * v0.6 Pass 041: a swimmer coming close startles a resting shark; it bolts off and settles
   * elsewhere. v0.6 Pass 052: the bolt itself (flinch, dash, settle) is `SharkBolt` (see `BOLT`).
   */
  scare: BOLT.scare,
} as const;

interface Rig {
  readonly root: THREE.Group;
  readonly bolt: SharkBolt;
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
      root.rotation.order = 'YZX';
      root.rotation.set(0, s.yaw, 0);
      root.add(model);
      this.root.add(root);
      const keys = near.morphTargetDictionary ?? {};
      this.rigs.push({
        root,
        bolt: new SharkBolt(s, root.position.y, RESTING.lift, i * 2.1),
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
    const step = Math.min(dt, 0.1),
      eye = player?.active ? player.position : undefined;
    this.time += step;
    for (const r of this.rigs) {
      const b = r.bolt;
      if (eye && b.startle(eye)) r.stirring = -1;
      if (b.mood === 'rest') {
        b.update(step, this.world, reducedMotion, eye);
        this.rest(r, step, reducedMotion);
        // A stir turns it a little: it bolts from the way it now faces.
        b.yaw = r.yaw;
        continue;
      }
      b.update(step, this.world, reducedMotion, eye);
      r.root.position.set(b.position.x, b.position.y, b.position.z);
      r.root.rotation.set(b.bank, b.yaw + b.sway, b.pitch);
      r.yaw = b.yaw;
      creatureStroke(r.near, r, b.effort);
      if (b.resting) {
        // Just settled: lie there, level.
        r.rest = b.position.y;
        r.root.rotation.set(0, b.yaw, 0);
        r.wait = RESTING.every[0];
      }
    }
  }
  /** The cave, as a bolting shark sees it. */
  private readonly world: BoltWorld = {
    floor: (x, z) => caveFloor(x, z),
    over: (x, z, radius) => this.ground(x, z, radius),
    avoid: (p, push) => {
      const c = CAVE.chamber;
      if (wallDistance(p) < 3) {
        push.x += (c.x - p.x) * 0.08;
        push.z += (c.z - p.z) * 0.08;
      }
    },
    settleAt: (eye) => this.restingPlace(eye),
  };
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
  /** The free resting place furthest from the swimmer. */
  private restingPlace(eye?: Readonly<Vec3>): RestSpot {
    let best = this.pool[0],
      far = -Infinity;
    for (const s of this.pool) {
      if (this.rigs.some((o) => o.bolt.spot === s && o.bolt.mood !== 'flee'))
        continue;
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
