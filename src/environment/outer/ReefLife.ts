import * as THREE from 'three';
import type { AssetId } from '../../assets/AssetRegistry';
import type { AssetLease, AssetLoader } from '../../assets/AssetLoader';
import { OUTER } from '../../config/passage';
import type { Vec3 } from '../../config/world';
import {
  CirclingVisit,
  type BarracudaPose,
  type CirclingConfig,
} from '../../creatures/barracuda';
import {
  CleaningEncounter,
  CuriousWrasse,
  GREAT_WHITE,
  ParrotGrazers,
  RarePass,
} from '../../creatures/reefEncounters';
import type { SightCandidate } from '../../discovery/journal';
import { OUTER_SIGHTS } from '../../discovery/sights';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import type { Obstacles } from '../../creatures/cruising';
import { Octopus } from '../shared/Octopus';
import type { ReefPlacement } from './OuterReefLayout';
import { seabedHeight } from './OuterTerrain';
import { createPose, PosedFish, type FishPose } from './PosedFish';
import { SandPuffs } from './SandPuffs';
import { SoloCreature } from './SoloCreature';

/**
 * v0.6 Pass 043: the outer reef's newer life, beyond its simulated schools:
 *   - parrotfish grazing from coral to coral, a puff of sand at every bite;
 *   - a humphead wrasse that comes over for a look at the swimmer now and then;
 *   - a day octopus in its den, creeping between rocks and changing colour, hiding when approached;
 *   - now and then a tight ball of bigeye trevally circling out in the blue;
 *   - very rarely, bannerfish gathering beyond the glass and an ocean sunfish rising to be cleaned;
 *   - now and then a great white passing the length of the glass, close by it.
 * Each part loads on its own and is simply left out if it cannot. Owns everything it creates.
 */
export const TREVALLY: CirclingConfig = {
  count: 48,
  radius: [0.8, 2.4],
  height: 4,
  speed: 1.5,
  out: 9.5,
  spots: [
    { x: -10, y: 2 },
    { x: 2, y: -1 },
    { x: 12, y: 3 },
  ],
  hidden: 36,
  drift: 1,
  first: [60, 150],
  every: [150, 260],
  chance: 0.25,
  stay: [90, 150],
  strokeHz: 2,
  stroke: 0.8,
  ball: true,
};
/** Body lengths (m) the scripted fish are drawn at, matching their authored models. */
const LENGTH = {
  parrotfish: 1.1,
  wrasse: 2.4,
  trevally: 0.9,
  bannerfish: 0.55,
} as const;
/** The sunfish's scale on its authored 1.2 m body (about 2.2 m long, 3 m fin to fin). */
const SUNFISH_SCALE = 1.8;

export class ReefLife {
  readonly root = new THREE.Group();
  readonly sightings: SightCandidate[] = [];
  readonly ready: Promise<boolean>;
  readonly grazers: ParrotGrazers;
  readonly wrasse: CuriousWrasse;
  readonly trevally: CirclingVisit;
  readonly cleaning: CleaningEncounter;
  readonly greatWhite: RarePass;
  readonly octopus: Octopus;
  private readonly puffs = new SandPuffs();
  private readonly trevallyPoses: FishPose[];
  private readonly scratch: BarracudaPose = {
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    effort: 0,
  };
  private parrotFish?: PosedFish;
  private wrasseFish?: PosedFish;
  private trevallyFish?: PosedFish;
  private bannerFish?: PosedFish;
  private sunfish?: SoloCreature;
  private shark?: SoloCreature;
  private readonly textures = new Map<string, THREE.Texture>();
  private disposed = false;

  constructor(
    private readonly loader: AssetLoader,
    placements: readonly ReefPlacement[],
    top: Obstacles,
  ) {
    this.root.name = 'Outer reef life';
    const g = OUTER.glass,
      inside = (x: number, z: number) =>
        Math.abs(x) < OUTER.reach.halfWidth - 2 &&
        z > g.z + 2 &&
        z < OUTER.cliffZ - 4;
    // Parrotfish graze the corals inside the tank.
    const corals: Vec3[] = placements
      .filter(
        (p) =>
          (p.family === 'branching' ||
            p.family === 'massive' ||
            p.family === 'plate') &&
          inside(p.position.x, p.position.z),
      )
      .map((p) => ({
        x: p.position.x,
        y: top(p.position.x, p.position.z, 0.3),
        z: p.position.z,
      }));
    this.grazers = new ParrotGrazers(corals, createPose);
    this.wrasse = new CuriousWrasse(createPose(), {
      ground: top,
      minX: -OUTER.reach.halfWidth + 3,
      maxX: OUTER.reach.halfWidth - 3,
      minZ: g.z + 2,
      maxZ: OUTER.cliffZ - 5,
      top: OUTER.reach.up - 1,
    });
    this.trevally = new CirclingVisit(TREVALLY, 43061);
    this.trevallyPoses = Array.from({ length: TREVALLY.count }, createPose);
    this.cleaning = new CleaningEncounter(createPose);
    this.greatWhite = new RarePass(createPose());
    // The octopus: its den at the foot of a rock in the middle of the reef, other rocks nearby.
    const rocks = placements.filter(
        (p) => p.family === 'rock' && inside(p.position.x, p.position.z),
      ),
      home =
        rocks.reduce<ReefPlacement | undefined>(
          (best, r) =>
            !best ||
            Math.hypot(r.position.x + 4, r.position.z + 44) <
              Math.hypot(best.position.x + 4, best.position.z + 44)
              ? r
              : best,
          undefined,
        ) ?? null,
      den = denBeside(home?.position ?? { x: -4, y: 0, z: -44 }, top),
      near = rocks
        .filter(
          (r) =>
            r !== home &&
            Math.hypot(r.position.x - den.x, r.position.z - den.z) < 8,
        )
        .slice(0, 4)
        .map((r) => ({ x: r.position.x, y: 0, z: r.position.z }));
    this.octopus = new Octopus(
      den,
      near,
      (x, z) => top(x, z, 0.15),
      (x, z) => top(x, z, 0.1) - seabedHeight(x, z) > 0.2,
      { sand: 0xc7b28c, rock: 0x7c6c58, alarm: 0x5a2016 },
      OUTER_SIGHTS.octopus,
      1.5,
    );
    this.root.add(this.puffs.root, this.octopus.root);
    this.sightings.push(...this.octopus.sightings);
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
        console.error(`Cozy Diver: the ${what} could not be loaded.`, error);
      return false;
    }
  }
  private async load(): Promise<boolean> {
    const results = await Promise.all([
      this.part(async () => {
        const poses = this.grazers.poses;
        this.parrotFish = new PosedFish(
          await this.lease('parrotfish', poses.length),
          poses,
          'Parrotfish',
          LENGTH.parrotfish,
          10,
          this.textures,
        );
        this.root.add(this.parrotFish.root);
        poses.forEach(
          (p, i) =>
            i % 2 === 0 &&
            this.sightings.push({
              ...OUTER_SIGHTS.parrotfish,
              position: p.position,
              radius: 0.9,
            }),
        );
      }, 'parrotfish'),
      this.part(async () => {
        const pose = this.wrasse.pose;
        this.wrasseFish = new PosedFish(
          await this.lease('humpheadWrasse', 1),
          [pose],
          'Humphead wrasse',
          LENGTH.wrasse,
          8,
          this.textures,
        );
        this.root.add(this.wrasseFish.root);
        this.sightings.push({
          ...OUTER_SIGHTS.wrasse,
          position: pose.position,
          radius: 1.6,
        });
      }, 'humphead wrasse'),
      this.part(async () => {
        this.trevallyFish = new PosedFish(
          await this.lease('trevally', TREVALLY.count),
          this.trevallyPoses,
          'Bigeye trevally',
          LENGTH.trevally,
          6,
          this.textures,
        );
        this.root.add(this.trevallyFish.root);
        this.sightings.push({
          ...OUTER_SIGHTS.trevally,
          position: this.trevally.centre,
          radius: 6,
        });
      }, 'bigeye trevally'),
      this.part(async () => {
        const poses = this.cleaning.bannerfish.map((b) => b.pose);
        this.bannerFish = new PosedFish(
          await this.lease('bannerfish', poses.length),
          poses,
          'Longfin bannerfish',
          LENGTH.bannerfish,
          10,
          this.textures,
        );
        this.root.add(this.bannerFish.root);
        poses.forEach(
          (p, i) =>
            i % 3 === 0 &&
            this.sightings.push({
              ...OUTER_SIGHTS.bannerfish,
              position: p.position,
              radius: 0.7,
            }),
        );
        const sun = new SoloCreature(
          this.loader,
          'sunfish',
          this.cleaning.sunfish.pose,
          SUNFISH_SCALE,
          'Ocean sunfish',
        );
        this.sunfish = sun;
        if (!(await sun.ready) || this.disposed) throw Error('sunfish');
        this.root.add(sun.root);
        this.sightings.push({
          ...OUTER_SIGHTS.sunfish,
          position: this.cleaning.sunfish.pose.position,
          radius: 2,
        });
      }, 'cleaning station'),
      this.part(async () => {
        const shark = new SoloCreature(
          this.loader,
          'greatWhite',
          this.greatWhite.swim.pose,
          GREAT_WHITE.scale,
          'Great white shark',
          24,
        );
        this.shark = shark;
        if (!(await shark.ready) || this.disposed) throw Error('great white');
        this.root.add(shark.root);
        this.sightings.push({
          ...OUTER_SIGHTS.greatWhite,
          position: this.greatWhite.swim.pose.position,
          radius: 2.6,
        });
      }, 'great white'),
    ]);
    if (this.disposed) return false;
    this.place(undefined);
    // Shown (far out of sight) until the first update, so the warm-up draws and compiles them.
    if (this.trevallyFish) {
      this.trevallyFish.visible = true;
      this.trevallyFish.update();
    }
    if (this.sunfish) this.sunfish.root.visible = true;
    if (this.shark) this.shark.root.visible = true;
    return results.some(Boolean);
  }
  /** The swimmer has entered the outer reef again: the rare ones start over, away. */
  arrive(): void {
    this.trevally.arrive();
    this.cleaning.arrive();
    this.greatWhite.arrive();
  }
  private place(camera: THREE.Camera | undefined): void {
    this.parrotFish?.update(camera);
    this.wrasseFish?.update(camera);
    if (this.trevallyFish) {
      this.trevallyFish.visible = this.trevally.present;
      if (this.trevally.present) {
        for (let i = 0; i < TREVALLY.count; i++) {
          const s = this.trevally.pose(i, this.scratch),
            p = this.trevallyPoses[i];
          p.position.x = s.x;
          p.position.y = s.y;
          p.position.z = s.z;
          p.yaw = s.yaw;
          p.effort = s.effort * TREVALLY.stroke;
          p.fins = s.effort;
        }
        this.trevallyFish.update(camera);
      }
    }
    this.bannerFish?.update(camera);
    if (this.sunfish) {
      this.sunfish.root.visible = this.cleaning.sunfishPresent;
      this.sunfish.update(camera);
    }
    if (this.shark) {
      this.shark.root.visible = this.greatWhite.passing;
      this.shark.update(camera);
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
    if (active && dt > 0) {
      this.grazers.update(dt, player);
      for (let i = 0; i < this.grazers.bitCount; i++) {
        const b = this.grazers.bites[i];
        if (!reducedMotion) this.puffs.spawn(b.x, b.y, b.z);
      }
      this.wrasse.update(dt, player);
      this.trevally.update(dt);
      this.cleaning.update(dt);
      this.greatWhite.update(dt);
      this.puffs.update(dt);
    }
    this.octopus.update(dt, active, reducedMotion, player);
    this.place(camera);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sightings.length = 0;
    this.root.removeFromParent();
    this.parrotFish?.dispose();
    this.wrasseFish?.dispose();
    this.trevallyFish?.dispose();
    this.bannerFish?.dispose();
    this.sunfish?.dispose();
    this.shark?.dispose();
    this.octopus.dispose();
    this.puffs.dispose();
    this.root.clear();
  }
}

/** A den at the foot of a rock: step out from its middle (towards the tunnel) until on the sand. */
function denBeside(rock: Readonly<Vec3>, top: Obstacles) {
  let z = rock.z;
  for (let i = 0; i < 40; i++, z += 0.1)
    if (top(rock.x, z, 0.05) - seabedHeight(rock.x, z) < 0.15) break;
  return { x: rock.x, y: seabedHeight(rock.x, z), z: z - 0.05, yaw: 0 };
}
