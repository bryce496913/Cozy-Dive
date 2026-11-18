import * as THREE from 'three';
import type { AssetLoader } from '../assets/AssetLoader';
import { CAVE, CAVE_FRAME } from '../config/passage';
import type { Bounds, Vec3 } from '../config/world';
import type { SightCandidate } from '../discovery/journal';
import { CAVE_SIGHTS } from '../discovery/sights';
import {
  CaveEnvironment,
  CAVE_ROCKS,
} from '../environment/cave/CaveEnvironment';
import {
  CAVE_CRUISERS,
  CAVE_LIFE,
  caveHabitat,
  caveObstacles,
  caveSpecies,
} from '../environment/cave/CaveLife';
import { CaveDressing } from '../environment/cave/CaveDressing';
import { CaveCrabs } from '../environment/cave/CaveCrabs';
import { CaveVisitors } from '../environment/cave/CaveVisitors';
import {
  caveNooks,
  ledgeColliders,
  type CaveNooks,
} from '../environment/cave/CaveNooks';
import { CaveLobsters } from '../environment/cave/CaveLobsters';
import { MarineSnow } from '../environment/shared/MarineSnow';
import { caveFloor, easeInCave } from '../environment/cave/CaveTerrain';
import { RestingSharks } from '../environment/cave/RestingSharks';
import { OuterCreatures } from '../environment/outer/OuterCreatures';
import { OuterSchools } from '../environment/outer/OuterSchools';
import type { PlayerPresence } from '../fish/FishDiverReaction';
import type { CollisionWorld } from '../player/collision';
import {
  ColliderGrid,
  TerrainCollisionWorld,
} from '../player/terrainCollision';
import type { WaterWorld } from './WaterWorld';
import { WorldPreparation } from './WorldPreparation';
import { warmUpScene } from './warmUp';
import {
  nextFrame,
  Staging,
  type BuildStats,
  type FrameWait,
} from './StagedBuild';

/**
 * v0.6 Pass 034: the sea cave, the fourth water world, reached through the grotto in the kelp
 * forest. Built when the swimmer nears the grotto and released once they are well away from it;
 * only one world renders per frame. A dim limestone dome lit by a shaft of sunlight through its
 * roof, with whitetips resting on the sand and one circling, glassy sweepers in the shade, spiny
 * lobsters in the cracks and faintly glowing sponges. It reuses the tank's fish loader (nothing
 * decoded twice) and the outer reef's school and creature systems.
 */
export interface CaveLibraries {
  readonly fish: AssetLoader;
  /** How many sound locations the soundscape uses (the cave supplies as many). */
  readonly soundSpots: number;
}

export class SeaCaveScene implements WaterWorld {
  readonly id = 'cave' as const;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(64, 1, 0.08, 80);
  readonly environment: CaveEnvironment;
  /** v0.6 Pass 046 review: how long each piece took to build (see `SeaCaveScene.build`). */
  buildStats?: BuildStats;
  readonly lobsters: CaveLobsters;
  /** v0.6 Pass 041 */
  readonly crabs: CaveCrabs;
  /** v0.6 Pass 035: hanging formations, sun corals, rubble and motes; drifting particles. */
  readonly dressing: CaveDressing;
  readonly snow = new MarineSnow({
    count: 500,
    reach: 10,
    size: 0.04,
    color: 0xcfe4e0,
    opacity: 0.45,
    sink: 0.02,
    wander: 0.03,
  });
  schools?: OuterSchools;
  creatures?: OuterCreatures;
  resting?: RestingSharks;
  /** v0.6 Pass 045 */
  visitors?: CaveVisitors;
  readonly nooks: CaveNooks;
  readonly sightings: SightCandidate[] = [];
  /** v0.6 Pass 046 review: how far it has got, and which parts loaded. */
  readonly preparation = new WorldPreparation();
  readonly soundSpots: Vec3[] = [];
  /** Resolves once it can be entered: built, its life loaded, its shaders compiled. */
  readonly prepared: Promise<boolean>;
  private readonly world: TerrainCollisionWorld;
  private readonly lights: THREE.Light[] = [];
  private readonly size = new THREE.Vector2();
  private ready = false;
  private disposed = false;

  /**
   * v0.6 Pass 046 review: build the cave a piece per frame (its rock and sand, lobsters and crabs, its
   * detail), so no one frame carries it all; resolves undefined if no longer wanted while building.
   */
  static async build(
    renderer: THREE.WebGLRenderer,
    libraries: CaveLibraries,
    frame: FrameWait = nextFrame,
    wanted: () => boolean = () => true,
  ): Promise<SeaCaveScene | undefined> {
    const stage = new Staging(frame, wanted);
    try {
      const environment = await stage.step(
          'environment',
          () => new CaveEnvironment(),
        ),
        lobsters = await stage.step(
          'lobsters',
          () => new CaveLobsters(environment.cracks),
        ),
        crabs = await stage.step(
          'crabs',
          () => new CaveCrabs(CAVE_ROCKS, CAVE_LIFE.crabs),
        ),
        dressing = await stage.step(
          'detail',
          () => new CaveDressing(environment.skylightTop),
        ),
        scene = await stage.step(
          'scene',
          () =>
            new SeaCaveScene(renderer, libraries, {
              environment,
              lobsters,
              crabs,
              dressing,
            }),
        );
      scene.buildStats = stage.stats;
      return scene;
    } catch (error) {
      if (error === Staging.cancelled) return undefined;
      throw error;
    }
  }
  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    libraries: CaveLibraries,
    parts: {
      readonly environment: CaveEnvironment;
      readonly lobsters: CaveLobsters;
      readonly crabs: CaveCrabs;
      readonly dressing: CaveDressing;
    },
  ) {
    this.environment = parts.environment;
    this.scene.name = 'Sea cave';
    this.scene.background = new THREE.Color(CAVE.water);
    this.scene.fog = new THREE.FogExp2(CAVE.water, CAVE.fog);
    this.lobsters = parts.lobsters;
    this.crabs = parts.crabs;
    this.dressing = parts.dressing;
    this.scene.add(
      this.environment.root,
      this.lobsters.root,
      this.crabs.root,
      this.dressing.root,
      this.snow.points,
    );
    // The same kinds and number of lights as the tank, so most programs are shared with it: a
    // sky light (its ground colour lighting the rock roof from below, so the roof reads), the sun from above through the roof, and a cool fill.
    const sky = new THREE.HemisphereLight(0x8fc4c4, 0x6a6452, 1.1),
      sun = new THREE.DirectionalLight(0xfff0cf, 1.7),
      fill = new THREE.DirectionalLight(0x6aaabb, 0.35);
    sun.position.set(CAVE.skylight.x + 6, 60, CAVE.skylight.z - 4);
    fill.position.set(-20, 10, 30);
    this.lights.push(sky, sun, fill);
    this.scene.add(sky, sun, fill);
    this.nooks = caveNooks(this.environment.skylightTop);
    this.world = new TerrainCollisionWorld(
      new ColliderGrid([
        ...this.environment.colliders,
        ...ledgeColliders(this.nooks),
      ]),
      CAVE.bounds,
      caveFloor,
    );
    for (let i = 0; i < libraries.soundSpots; i++) {
      const r = CAVE_ROCKS[(i * 3) % CAVE_ROCKS.length];
      this.soundSpots.push({ x: r.x, y: caveFloor(r.x, r.z) + 2, z: r.z });
    }
    // The cave itself counts as seen from a few places inside it, and its lobsters from close by.
    const c = CAVE.chamber;
    for (const [x, z] of [
      [0, -18],
      [CAVE.skylight.x, CAVE.skylight.z],
      [-4, -32],
    ])
      this.sightings.push({
        id: CAVE_SIGHTS.cave.id,
        label: CAVE_SIGHTS.cave.label,
        position: { x: c.x + x, y: c.y, z },
        radius: 4,
      });
    this.sightings.push(...this.lobsters.sightings, ...this.crabs.sightings);
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(
      CAVE_FRAME.origin.x,
      CAVE_FRAME.origin.y,
      CAVE_FRAME.origin.z,
    );
    this.prepared = this.prepare(libraries.fish).then(
      (ok) => ok,
      (error: unknown) => {
        console.error('Cozy Diver: the sea cave could not be prepared.', error);
        this.preparation.fail();
        // Without its life it is still a cave to swim in.
        if (!this.disposed) this.ready = true;
        return !this.disposed;
      },
    );
  }
  private async prepare(fish: AssetLoader): Promise<boolean> {
    // v0.6 Pass 046 review: its life is set up a part per frame too (stopping if let go meanwhile).
    if (!(await this.nextPart())) return false;
    this.schools = new OuterSchools(caveHabitat(), caveSpecies(), fish);
    this.creatures = new OuterCreatures(
      caveObstacles,
      fish,
      CAVE_CRUISERS,
      'Sea cave whitetip',
    );
    if (!(await this.nextPart())) return false;
    this.resting = new RestingSharks(
      CAVE_LIFE.resting,
      fish,
      CAVE_LIFE.settle,
      caveObstacles,
    );
    if (!(await this.nextPart())) return false;
    this.visitors = new CaveVisitors(fish, this.nooks);
    const prep = this.preparation;
    const [schooled, cruising, resting, visiting] = await Promise.all([
      prep.track('schools', this.schools.ready),
      prep.track('cruisers', this.creatures.ready),
      prep.track('resting sharks', this.resting.ready),
      prep.track('visitors', this.visitors.ready),
    ]);
    // v0.6 Pass 046 review: nothing is added once the cave has been let go.
    if (this.disposed) return false;
    // The schools show their simple fish if their rigs failed, so they are always added.
    this.scene.add(this.schools.root);
    if (cruising) {
      this.scene.add(this.creatures.root);
      this.sightings.push(...this.creatures.sightings);
    }
    if (resting) {
      this.scene.add(this.resting.root);
      this.sightings.push(...this.resting.sightings);
    }
    // The visitors' built-in-code parts are always there; each loaded part only if it loaded.
    this.scene.add(this.visitors.root);
    this.sightings.push(...this.visitors.sightings);
    if (schooled || visiting)
      this.visitors.attachGlows(
        this.schools.fish.simulation.fish.filter(
          (f) => f.species.id === 'flashlight-fish',
        ),
      );
    // A sweeper is seen by following one fish from each school.
    const sweepers = this.schools.fish.simulation.fish.filter(
      (f) => f.species.id === 'glassy-sweeper',
    );
    for (let i = 0; i < sweepers.length; i += 13)
      this.sightings.push({
        id: CAVE_SIGHTS.sweeper.id,
        label: CAVE_SIGHTS.sweeper.label,
        position: sweepers[i].position,
        radius: 1.5,
      });
    // v0.6 Pass 041: and a soldierfish by coming close to one in each group.
    const soldiers = this.schools.fish.simulation.fish.filter(
      (f) => f.species.id === 'soldierfish',
    );
    for (let i = 0; i < soldiers.length; i += 4)
      this.sightings.push({
        id: CAVE_SIGHTS.soldierfish.id,
        label: CAVE_SIGHTS.soldierfish.label,
        position: soldiers[i].position,
        radius: 1.4,
      });
    await warmUpScene(
      this.renderer,
      this.scene,
      this.camera,
      () => !this.disposed,
    );
    if (this.disposed) return false;
    prep.settle();
    this.ready = true;
    return true;
  }
  /** Wait a frame; whether the cave is still wanted. */
  private async nextPart(): Promise<boolean> {
    await nextFrame();
    return !this.disposed;
  }
  get bounds(): Bounds {
    return CAVE.bounds;
  }
  get collision(): CollisionWorld {
    return this.world;
  }
  get isReady(): boolean {
    return this.ready && !this.disposed;
  }
  ease(p: Vec3, dir: Vec3): Vec3 {
    return easeInCave(p, dir);
  }
  render(
    _time: number,
    reducedMotion: boolean,
    dt: number,
    active: boolean,
    player: PlayerPresence,
  ): void {
    if (this.disposed) return;
    this.renderer.getDrawingBufferSize(this.size);
    const aspect = this.size.x / Math.max(1, this.size.y);
    if (Math.abs(this.camera.aspect - aspect) > 1e-6) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
    this.environment.update(dt, active, reducedMotion);
    this.dressing.update(dt, active, reducedMotion);
    this.snow.update(dt, active, reducedMotion, this.camera.position);
    this.lobsters.update(dt, active, reducedMotion, player);
    this.crabs.update(dt, active, reducedMotion, player);
    this.resting?.update(dt, active, reducedMotion, player);
    this.schools?.update(dt, active, reducedMotion, player, this.camera);
    this.creatures?.update(dt, active, reducedMotion, player, this.camera);
    // Only once warmed up, so everything is drawn (and compiled) in the warm-up first.
    if (this.ready) this.visitors?.update(dt, active, reducedMotion, player);
    this.renderer.render(this.scene, this.camera);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.preparation.dispose();
    this.ready = false;
    this.schools?.dispose();
    this.creatures?.dispose();
    this.resting?.dispose();
    this.sightings.length = 0;
    this.lobsters.dispose();
    this.visitors?.dispose();
    this.crabs.dispose();
    this.dressing.dispose();
    this.snow.dispose();
    this.environment.dispose();
    this.lights.forEach((l) => l.dispose());
    this.scene.clear();
  }
}
