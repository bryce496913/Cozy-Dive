import * as THREE from 'three';
import type { AssetLease, AssetLoader } from '../../assets/AssetLoader';
import { WRECK } from '../../config/wreck';
import type { Vec3 } from '../../config/world';
import type { SightCandidate } from '../../discovery/journal';
import { KELP_SIGHTS } from '../../discovery/sights';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import type { FishHabitat } from '../../fish/FishHabitat';
import { FISH_SPECIES, type FishSpecies } from '../../fish/FishSpecies';
import { OuterSchools } from '../outer/OuterSchools';
import { PosedFish, createPose, type FishPose } from '../outer/PosedFish';
import { DECK_TOP, fromShip, wreckColliders, wreckFloor } from './WreckLayout';

/**
 * Life on the wreck, as on the wrecks under California's kelp forests. All of it calm:
 *   - a **giant sea bass** keeps the dark hold, patrolling slowly up and down its length and
 *     turning at each end: met in the torch's beam, a great grey shape hanging there;
 *   - **blacksmith** school over the deck and round the bow;
 *   - **kelp bass** hang in loose groups along the hull's sides;
 *   - **señoritas** pick their way round the deckhouse.
 * The fish steer round the ship (its solid parts are their rocks). Owns everything it creates.
 */
export const WRECK_LIFE = {
  /** The sea bass's patrol in the hold (ship's frame): its ends, height, and seconds per lap. */
  bass: { foreZ: -36.2, aftZ: -26.6, y: 3.3, lap: 80, length: 2.2 },
} as const;

/** A point in the ship's frame, in the cavern. */
const at = (x: number, y: number, z: number): Vec3 =>
  fromShip({ x, y, z }, { x: 0, y: 0, z: 0 });

/** Where the schools gather (ship's frame): kind, place, how many, how far they spread. */
const GROUPS = [
  { id: 'blacksmith', p: at(0, DECK_TOP + 4.5, -32), count: 34, spread: 4.5 },
  { id: 'blacksmith', p: at(0.5, DECK_TOP + 5.5, -45), count: 22, spread: 3.5 },
  { id: 'kelp-bass', p: at(-6, 3.4, -34), count: 6, spread: 3.5 },
  { id: 'kelp-bass', p: at(6.2, 4.2, -24), count: 5, spread: 3 },
  { id: 'senorita', p: at(0, DECK_TOP + 1.2, -24.2), count: 7, spread: 2.6 },
] as const;

export function wreckSpecies(): FishSpecies[] {
  const chromis = FISH_SPECIES.find((f) => f.id === 'blue-green-chromis')!;
  return GROUPS.map((g) => {
    const look = {
        blacksmith: { colour: 0x3f4d5e, size: 1.4, name: 'Blacksmith' },
        'kelp-bass': { colour: 0x7a6a45, size: 2.5, name: 'Kelp bass' },
        senorita: { colour: 0xe0b23a, size: 1.1, name: 'Señorita' },
      }[g.id],
      slender = g.id === 'senorita',
      schools = g.id === 'blacksmith';
    return {
      ...chromis,
      id: g.id,
      name: look.name,
      count: g.count,
      length: chromis.length * look.size * (slender ? 1.15 : 1),
      height: chromis.height * look.size * (slender ? 0.6 : 0.95),
      width: chromis.width * look.size * (slender ? 0.7 : 1),
      color: look.colour,
      backColor: look.colour,
      finColor: look.colour,
      accentColor: look.colour,
      schooling: {
        ...chromis.schooling,
        enabled: !slender,
        spacing: chromis.schooling.spacing * (schools ? 1.4 : 2.2),
        separationRange:
          chromis.schooling.separationRange * (schools ? 1 : 2.2),
      },
      speed: chromis.speed * (slender ? 1.2 : schools ? 1 : 0.8),
      region: { x: g.p.x, y: g.p.y, z: g.p.z },
      spread: { x: g.spread, y: schools ? 2 : 1.2, z: g.spread },
      depth: [g.p.y - (schools ? 2.5 : 1.5), g.p.y + (schools ? 2.5 : 1.5)],
      individualScale: undefined,
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

/**
 * The giant sea bass's slow patrol of the hold (pure): up its length and back, turning gently at
 * each end, drifting a little from side to side and up and down. Writes its pose in the cavern.
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
      speed = Math.abs(dz);
    this.local.x = 0.7 * Math.sin(w * t * 2.3);
    this.local.y = b.y + 0.3 * Math.sin(w * t * 1.7);
    this.local.z = z;
    fromShip(this.local, this.pose.position);
    // Facing the way it moves (forward is -z in the ship, yaw π/2), turning round at the ends.
    const want = dz < 0 ? Math.PI / 2 : -Math.PI / 2,
      turn = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw));
    if (dt > 0)
      this.yaw +=
        turn * Math.min(1, step * (0.3 + 1.5 * (1 - speed / (half * w))));
    else this.yaw = want;
    this.pose.yaw = this.yaw;
    this.pose.pitch = 0.05 * Math.sin(w * t * 1.7);
    this.pose.roll = -0.15 * turn;
    // A slow tail beat, a little more as it turns.
    this.pose.effort = 0.18 + 0.4 * (speed / (half * w)) + 0.2 * Math.abs(turn);
    this.pose.fins = 0.5 + 0.5 * Math.sin(t * 1.3);
  }
}

export class WreckLife {
  readonly root = new THREE.Group();
  readonly sightings: SightCandidate[] = [];
  readonly ready: Promise<boolean>;
  readonly patrol = new HoldPatrol();
  readonly schools: OuterSchools;
  private bass?: PosedFish;
  private readonly textures = new Map<string, THREE.Texture>();
  private disposed = false;

  constructor(private readonly loader: AssetLoader) {
    this.root.name = 'Wreck life';
    this.schools = new OuterSchools(wreckHabitat(), wreckSpecies(), loader);
    this.ready = this.load();
  }
  private async load(): Promise<boolean> {
    const [schools, bass] = await Promise.all([
      this.schools.ready,
      this.loadBass(),
    ]);
    if (this.disposed) return false;
    this.root.add(this.schools.root);
    // Each school counts as seen from close by its leading fish (they carry their sightings).
    const firstOf = (id: string) =>
      this.schools.fish.simulation.fish.find((f) => f.species.id === id);
    for (const [id, sight, radius] of [
      ['blacksmith', KELP_SIGHTS.blacksmith, 4],
      ['kelp-bass', KELP_SIGHTS.bass, 2.5],
      ['senorita', KELP_SIGHTS.senorita, 1.5],
    ] as const) {
      const lead = firstOf(id);
      if (lead)
        this.sightings.push({ ...sight, position: lead.position, radius });
    }
    return schools || bass;
  }
  private async loadBass(): Promise<boolean> {
    let lease: AssetLease | undefined;
    try {
      lease = await this.loader.acquire('giantSeaBass');
      if (this.disposed) {
        lease.release();
        return false;
      }
      this.bass = new PosedFish(
        [lease],
        [this.patrol.pose],
        'Giant sea bass in the hold',
        WRECK_LIFE.bass.length,
        8,
        this.textures,
      );
      this.root.add(this.bass.root);
      this.sightings.push({
        ...KELP_SIGHTS.seaBass,
        position: this.patrol.pose.position,
        radius: 2,
      });
      return true;
    } catch (error) {
      if (!this.disposed)
        console.error(
          'Cozy Diver: the wreck’s sea bass could not be loaded.',
          error,
        );
      return false;
    }
  }
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    player: PlayerPresence,
    camera: THREE.Camera,
  ): void {
    if (this.disposed) return;
    if (active) this.patrol.update(dt, reducedMotion);
    this.bass?.update(camera);
    this.schools.update(dt, active, reducedMotion, player, camera);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sightings.length = 0;
    this.bass?.dispose();
    this.schools.dispose();
    this.root.removeFromParent();
    this.root.clear();
    this.loader.evictUnused('giantSeaBass');
  }
}
