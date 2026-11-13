import * as THREE from 'three';
import type { AssetLoader } from '../assets/AssetLoader';
import { OUTER } from '../config/passage';
import type { Bounds, Vec3 } from '../config/world';
import type { SightCandidate } from '../discovery/journal';
import { boxCollider } from '../environment/passage/Crevice';
import {
  OuterCreatures,
  reefObstacles,
} from '../environment/outer/OuterCreatures';
import { OuterEnvironment } from '../environment/outer/OuterEnvironment';
import { OuterReef } from '../environment/outer/OuterReef';
import {
  OuterSchools,
  outerInterests,
  outerSpecies,
} from '../environment/outer/OuterSchools';
import {
  easeAtEdges,
  easeFactor,
  seabedHeight,
} from '../environment/outer/OuterTerrain';
import { reefSightings } from '../environment/outer/outerSightings';
import { WATER_LIGHT, WaterDome } from '../environment/outer/WaterDome';
import type { PlayerPresence } from '../fish/FishDiverReaction';
import type { FishHabitat } from '../fish/FishHabitat';
import type { CollisionWorld, ConvexCollider } from '../player/collision';
import {
  ColliderGrid,
  TerrainCollisionWorld,
} from '../player/terrainCollision';
import type { WaterWorld } from './WaterWorld';
import { warmUpScene } from './warmUp';

/**
 * v0.4 Pass 023/024/025: renders the outer waters with the tank's renderer. Built when the swimmer
 * nears the hidden crevice and released once they are well away, so its resources only exist
 * while it might be needed. Pass 024 dresses it as a reef from the tank's own libraries (shared
 * caches, nothing decoded twice), with reef fish, a sand seabed and soft edges; Pass 025 adds its big creatures and the things
 * that can be seen here. Only one water
 * world renders per frame.
 */
const WATER = 0x1d5d76;
/**
 * Pass 026: while the reef loads, the light beyond the tunnel stays at `dark` (fraction), and
 * swimming eases to a stop over `band` m, `hold` m inside the cliff. Once ready, the light opens
 * over `reveal` s.
 */
export const LOADING = { dark: 0.12, hold: 4, band: 3, reveal: 1.8 } as const;
/** The tank's libraries and plant shader, shared with the outer reef. */
export interface SharedLibraries {
  readonly reef: AssetLoader;
  readonly fish: AssetLoader;
  readonly plants: THREE.MeshStandardMaterial;
  /** How many sound locations the soundscape uses (the outer reef supplies as many). */
  readonly soundSpots: number;
}

export class OuterWatersScene implements WaterWorld {
  readonly id = 'outer' as const;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(64, 1, 0.08, 150);
  readonly environment = new OuterEnvironment();
  readonly reef: OuterReef;
  schools?: OuterSchools;
  /** v0.4 Pass 025: sharks, eagle rays and a turtle (absent if their models cannot load). */
  creatures?: OuterCreatures;
  /** What can be seen here: the reef's corals and seagrass, and its big creatures. */
  readonly sightings: SightCandidate[] = [];
  /** Where the soundscape's small sounds come from here (at the coral heads). */
  readonly soundSpots: Vec3[] = [];
  /**
   * Resolves once it can be entered: the tunnel and cliff built and their shaders compiled
   * (false if disposed first). Pass 026: the reef itself is prepared later, in the tunnel.
   */
  readonly prepared: Promise<boolean>;
  /** Pass 026: resolves once the reef, its fish and creatures are ready and compiled. */
  readonly reefPrepared: Promise<boolean>;
  private world: TerrainCollisionWorld;
  private readonly lights: THREE.Light[] = [];
  /** Each light's intensity at the reef top (Pass 026: they dim with depth). */
  private readonly brightness: number[] = [];
  /** Pass 026: the blue around the eye; the fog and background follow its horizon. */
  private readonly dome = new WaterDome();
  private readonly fog: THREE.FogExp2;
  private readonly background: THREE.Color;
  private readonly size = new THREE.Vector2();
  private ready = false;
  private reefReady = false;
  /** Pass 026: how far the light has opened at the tunnel's exit (0 dark, 1 open). */
  private reveal = 0;
  private begun = false;
  /** Pass 026: how long the reef took to prepare after the swimmer entered the tunnel (ms). */
  reefPrepareMs = 0;
  private begunAt = 0;
  private start: () => void = () => {};
  private disposed = false;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    libraries: SharedLibraries,
  ) {
    this.scene.name = 'Outer waters';
    this.background = new THREE.Color(WATER);
    this.fog = new THREE.FogExp2(WATER, OUTER.fog);
    this.scene.background = this.background;
    this.scene.fog = this.fog;
    this.scene.add(this.dome.mesh, this.environment.root);
    // The same kinds and number of lights as the tank, so most shader programs are shared with
    // it and need no new compilation (programs are keyed by light counts).
    // Pass 026: a softer sky light, so the reef's lit tops sink into the blue instead of glowing.
    const sky = new THREE.HemisphereLight(0x9fd6e0, 0x3d5a4e, 1.25),
      sun = new THREE.DirectionalLight(0xfff1d2, 2.4),
      fill = new THREE.DirectionalLight(0x75ced0, 0.5);
    sun.position.set(-20, 60, -40);
    fill.position.set(30, 20, 40);
    this.lights.push(sky, sun, fill);
    for (const l of this.lights) this.brightness.push(l.intensity);
    this.scene.add(sky, sun, fill);
    this.reef = new OuterReef(libraries.reef, libraries.plants);
    this.scene.add(this.reef.root);
    this.world = this.collisionFor(this.environment.colliders);
    for (let i = 0; i < libraries.soundSpots; i++) {
      const h = this.reef.heads[i % this.reef.heads.length];
      this.soundSpots.push({ x: h.x, y: h.y + 1.4, z: h.z });
    }
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(
      OUTER.tunnel[1].x,
      OUTER.tunnel[1].y,
      OUTER.tunnel[1].z,
    );
    const failed = (error: unknown): boolean => {
      console.error('Cozy Diver: outer waters could not be prepared.', error);
      if (!this.disposed) this.ready = this.reefReady = true;
      return !this.disposed;
    };
    this.prepared = this.prepareTunnel().then((ok) => ok, failed);
    const begun = new Promise<void>((resolve) => {
      this.start = resolve;
    });
    this.reefPrepared = begun
      .then(() => this.prepareReef(libraries.fish))
      .then((ok) => ok, failed);
  }
  /**
   * Pass 026: the tunnel is the loading screen. Call once the swimmer is in it (crossing into the
   * outer waters does): the reef, its fish and creatures are built and compiled while they swim
   * through the dark, and the light at the exit opens once they are ready.
   */
  begin(): void {
    if (this.begun || this.disposed) return;
    this.begun = true;
    this.begunAt = performance.now();
    this.reef.begin();
    this.start();
  }
  /** Whether the reef beyond the tunnel is ready (its light has begun to open). */
  get isReefReady(): boolean {
    return this.reefReady && !this.disposed;
  }
  private collisionFor(
    colliders: readonly ConvexCollider[],
  ): TerrainCollisionWorld {
    return new TerrainCollisionWorld(
      new ColliderGrid(colliders),
      OUTER.bounds,
      seabedHeight,
    );
  }
  /** Stage one: the tunnel and cliff, so the swimmer can cross into the outer waters. */
  private async prepareTunnel(): Promise<boolean> {
    await warmUpScene(this.renderer, this.scene, this.camera);
    if (this.disposed) return false;
    this.ready = true;
    return true;
  }
  /** Stage two, in the tunnel: dress the reef, then add the fish and creatures. */
  private async prepareReef(fishLoader: AssetLoader): Promise<boolean> {
    await this.reef.ready;
    if (this.disposed) return false;
    this.environment.dress(this.reef.sand, this.reef.rock);
    this.world = this.collisionFor([
      ...this.environment.colliders,
      ...this.reef.colliders,
    ]);
    // Pass 026: one map of the reef's tops places the schools and lifts the creatures' routes.
    const drawn = this.reef.drawnPlacements,
      obstacles = reefObstacles(drawn);
    const habitat: FishHabitat = {
      bounds: OUTER.bounds,
      // Coarse boxes keep the fish cheap; one more keeps them off the cliff.
      rocks: [
        ...this.reef.fishObstacles,
        boxCollider(
          [OUTER.bounds.min.x - 1, OUTER.bounds.min.y - 1, OUTER.cliffZ - 1],
          [
            OUTER.bounds.max.x + 1,
            OUTER.bounds.max.y + 1,
            OUTER.bounds.max.z + 1,
          ],
        ),
      ],
      interests: outerInterests({
        placements: [...this.reef.placements],
        heads: this.reef.heads,
      }),
      substrateHeight: seabedHeight,
      floorHeight: seabedHeight,
    };
    this.schools = new OuterSchools(
      habitat,
      outerSpecies(obstacles),
      fishLoader,
    );
    const creatures = new OuterCreatures(obstacles, fishLoader);
    this.creatures = creatures;
    const [, loaded] = await Promise.all([this.schools.ready, creatures.ready]);
    if (this.disposed) return false;
    this.scene.add(this.schools.root);
    if (loaded) this.scene.add(creatures.root);
    this.sightings.push(...reefSightings(drawn), ...creatures.sightings);
    this.reef.update(this.camera.position, 0, false);
    await warmUpScene(this.renderer, this.scene, this.camera);
    if (this.disposed) return false;
    this.reefReady = true;
    this.reefPrepareMs = performance.now() - this.begunAt;
    return true;
  }
  get bounds(): Bounds {
    return OUTER.bounds;
  }
  get collision(): CollisionWorld {
    return this.world;
  }
  /** Whether it can be entered (the tunnel and cliff built, their shaders compiled). */
  get isReady(): boolean {
    return this.ready && !this.disposed;
  }
  /** Pass 026: swimming outwards slows to a hover near the edges (see `easeAtEdges`). */
  ease(p: Vec3, dir: Vec3): Vec3 {
    // Pass 026: until the reef is ready, swimming slows to a stop before the tunnel's exit.
    if (!this.reefReady && dir.z < 0)
      dir.z *= easeFactor(p.z - (OUTER.cliffZ + LOADING.hold), LOADING.band);
    return easeAtEdges(p, dir);
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
    if (this.reefReady)
      this.reveal = Math.min(1, this.reveal + dt / LOADING.reveal);
    this.dome.update(this.camera.position, this.reveal);
    this.fog.color.copy(this.dome.horizon);
    this.fog.density =
      OUTER.fog * (1 + WATER_LIGHT.thickening * this.dome.shade);
    const dim =
      (1 - WATER_LIGHT.dimming * this.dome.shade) *
      (LOADING.dark + (1 - LOADING.dark) * this.reveal);
    for (let i = 0; i < this.lights.length; i++)
      this.lights[i].intensity = this.brightness[i] * dim;
    this.background.copy(this.dome.horizon);
    this.reef.update(this.camera.position, dt, reducedMotion);
    this.schools?.update(dt, active, reducedMotion, player, this.camera);
    this.creatures?.update(dt, active, reducedMotion, player, this.camera);
    this.renderer.render(this.scene, this.camera);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.ready = false;
    this.environment.undress();
    this.schools?.dispose();
    this.creatures?.dispose();
    this.sightings.length = 0;
    this.reef.dispose();
    this.environment.dispose();
    this.dome.dispose();
    this.lights.forEach((l) => l.dispose());
    this.scene.clear();
  }
}
