import * as THREE from 'three';
import type { AssetLoader } from '../assets/AssetLoader';
import { OUTER } from '../config/passage';
import type { Bounds, Vec3 } from '../config/world';
import type { SightCandidate } from '../discovery/journal';
import { boxCollider } from '../environment/passage/Crevice';
import { OuterEnvironment } from '../environment/outer/OuterEnvironment';
import { OuterReef } from '../environment/outer/OuterReef';
import {
  OuterSchools,
  outerInterests,
  outerSpecies,
} from '../environment/outer/OuterSchools';
import { edgeCurrent, seabedHeight } from '../environment/outer/OuterTerrain';
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
 * v0.4 Pass 023/024: renders the outer waters with the tank's renderer. Built when the swimmer
 * nears the hidden crevice and released once they are well away, so its resources only exist
 * while it might be needed. Pass 024 dresses it as a reef from the tank's own libraries (shared
 * caches, nothing decoded twice), with reef fish, a sand seabed and soft edges. Only one water
 * world renders per frame.
 */
const WATER = 0x1d5d76;
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
  readonly sightings: readonly SightCandidate[] = [];
  /** Where the soundscape's small sounds come from here (at the coral heads). */
  readonly soundSpots: Vec3[] = [];
  /** Resolves once dressed, populated and its shaders compiled (false if disposed first). */
  readonly prepared: Promise<boolean>;
  private world: TerrainCollisionWorld;
  private readonly lights: THREE.Light[] = [];
  private readonly size = new THREE.Vector2();
  private ready = false;
  private disposed = false;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    libraries: SharedLibraries,
  ) {
    this.scene.name = 'Outer waters';
    this.scene.background = new THREE.Color(WATER);
    this.scene.fog = new THREE.FogExp2(WATER, OUTER.fog);
    this.scene.add(this.environment.root);
    // The same kinds and number of lights as the tank, so most shader programs are shared with
    // it and need no new compilation (programs are keyed by light counts).
    const sky = new THREE.HemisphereLight(0xb5e6ea, 0x3d5a4e, 1.7),
      sun = new THREE.DirectionalLight(0xfff1d2, 2.4),
      fill = new THREE.DirectionalLight(0x75ced0, 0.5);
    sun.position.set(-20, 60, -40);
    fill.position.set(30, 20, 40);
    this.lights.push(sky, sun, fill);
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
    this.prepared = this.prepare(libraries.fish).then(
      (ok) => ok,
      (error: unknown) => {
        console.error('Cozy Diver: outer waters could not be prepared.', error);
        if (!this.disposed) this.ready = true;
        return !this.disposed;
      },
    );
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
  private async prepare(fishLoader: AssetLoader): Promise<boolean> {
    await this.reef.ready;
    if (this.disposed) return false;
    this.environment.dress(this.reef.sand, this.reef.rock);
    this.world = this.collisionFor([
      ...this.environment.colliders,
      ...this.reef.colliders,
    ]);
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
    };
    this.schools = new OuterSchools(
      habitat,
      outerSpecies(this.reef.heads),
      fishLoader,
    );
    await this.schools.ready;
    if (this.disposed) return false;
    this.scene.add(this.schools.root);
    this.reef.update(this.camera.position, 0, false);
    await warmUpScene(this.renderer, this.scene, this.camera);
    if (this.disposed) return false;
    this.ready = true;
    return true;
  }
  get bounds(): Bounds {
    return OUTER.bounds;
  }
  get collision(): CollisionWorld {
    return this.world;
  }
  /** Whether it can be entered (dressed, populated, shaders compiled). */
  get isReady(): boolean {
    return this.ready && !this.disposed;
  }
  /** The gentle current near the reef's edges (m/s). */
  current(p: Vec3, out: Vec3): Vec3 {
    return edgeCurrent(p, out);
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
    this.reef.update(this.camera.position, dt, reducedMotion);
    this.schools?.update(dt, active, reducedMotion, player, this.camera);
    this.renderer.render(this.scene, this.camera);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.ready = false;
    this.environment.undress();
    this.schools?.dispose();
    this.reef.dispose();
    this.environment.dispose();
    this.lights.forEach((l) => l.dispose());
    this.scene.clear();
  }
}
