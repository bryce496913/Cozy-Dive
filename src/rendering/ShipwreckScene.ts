import * as THREE from 'three';
import { WRECK, WRECK_FRAME } from '../config/wreck';
import type { Bounds, Vec3 } from '../config/world';
import type { SightCandidate } from '../discovery/journal';
import { WRECK_SIGHTS } from '../discovery/sights';
import { WreckEnvironment } from '../environment/wreck/WreckEnvironment';
import {
  DECK_TOP,
  easeInWreck,
  fromShip,
  wreckFloor,
  wreckShade,
} from '../environment/wreck/WreckLayout';
import { MarineSnow } from '../environment/shared/MarineSnow';
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

export interface WreckLibraries {
  readonly soundSpots: number;
}

/** How far the torch reaches ahead of the eye to aim (m). */
const AIM = 5;

/**
 * The shipwreck, as a water world: a dim, deep cavern under the kelp forest with an old freighter
 * on its floor. Inside the ship (the hold, the bridge) the cavern's light falls away and the
 * swimmer's torch comes on by itself, fading out again on the way back out. The torch is always in
 * the scene (dark when not needed), so turning it on never compiles anything.
 */
export class ShipwreckScene implements WaterWorld {
  readonly id = 'wreck' as const;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(64, 1, 0.08, 120);
  readonly environment: WreckEnvironment;
  buildStats?: BuildStats;
  readonly snow = new MarineSnow({
    count: 420,
    reach: 10,
    size: 0.02,
    color: 0xd8e6e0,
    opacity: 0.28,
    sink: 0.012,
    wander: 0.02,
  });
  readonly sightings: SightCandidate[] = [];
  readonly preparation = new WorldPreparation();
  readonly soundSpots: Vec3[] = [];
  readonly prepared: Promise<boolean>;
  /** How dark it is around the swimmer now (0 in the cavern … 1 deep inside the ship). */
  shade = 0;
  readonly torch = new THREE.SpotLight(
    0xfff1d8,
    0,
    WRECK.torch.distance,
    WRECK.torch.angle,
    WRECK.torch.penumbra,
    1,
  );
  private readonly world: TerrainCollisionWorld;
  private readonly lights: THREE.Light[] = [];
  private readonly base: number[] = [];
  private readonly water = new THREE.Color(WRECK.water);
  private readonly black = new THREE.Color(0x020405);
  private readonly fog: THREE.FogExp2;
  private readonly size = new THREE.Vector2();
  private readonly ahead = new THREE.Vector3();
  private ready = false;
  private disposed = false;

  static async build(
    renderer: THREE.WebGLRenderer,
    libraries: WreckLibraries,
    frame: FrameWait = nextFrame,
    wanted: () => boolean = () => true,
  ): Promise<ShipwreckScene | undefined> {
    const stage = new Staging(frame, wanted);
    try {
      const environment = await stage.step(
          'cavern and wreck',
          () => new WreckEnvironment(),
        ),
        scene = await stage.step(
          'scene',
          () => new ShipwreckScene(renderer, libraries, environment),
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
    libraries: WreckLibraries,
    environment: WreckEnvironment,
  ) {
    this.environment = environment;
    this.scene.name = 'Shipwreck';
    this.scene.background = this.water.clone();
    this.fog = new THREE.FogExp2(WRECK.water, WRECK.fog);
    this.scene.fog = this.fog;
    this.scene.add(environment.root, this.snow.points);
    // Dim light from far above (through the kelp and the shaft), deep blue-green fill.
    const sky = new THREE.HemisphereLight(0x9fc8c4, 0x161c1c, 0.9),
      sun = new THREE.DirectionalLight(0xd8eee6, 0.7),
      fill = new THREE.DirectionalLight(0x3f7f86, 0.35);
    sun.position.set(4, 60, -20);
    fill.position.set(-20, 10, 30);
    this.lights.push(sky, sun, fill);
    this.base.push(sky.intensity, sun.intensity, fill.intensity);
    this.scene.add(sky, sun, fill, this.torch, this.torch.target);
    this.world = new TerrainCollisionWorld(
      new ColliderGrid(environment.colliders),
      WRECK.bounds,
      wreckFloor,
    );
    for (let i = 0; i < libraries.soundSpots; i++) {
      const a = (i / Math.max(1, libraries.soundSpots)) * Math.PI * 2;
      this.soundSpots.push({
        x: Math.cos(a) * 14,
        y: 4,
        z: -32 + Math.sin(a) * 18,
      });
    }
    // The place counts as seen from above the deck; the hold and the bridge from inside them.
    this.sightings.push(
      { ...WRECK_SIGHTS.place, position: { x: 0, y: 11, z: -30 }, radius: 6 },
      {
        ...WRECK_SIGHTS.hold,
        position: fromShip({ x: 0, y: 3.5, z: -32 }, { x: 0, y: 0, z: 0 }),
        radius: 3,
      },
      {
        ...WRECK_SIGHTS.bridge,
        position: fromShip(
          { x: 0, y: DECK_TOP + 1.4, z: -19.5 },
          { x: 0, y: 0, z: 0 },
        ),
        radius: 2,
      },
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(
      WRECK_FRAME.origin.x,
      WRECK_FRAME.origin.y,
      WRECK_FRAME.origin.z,
    );
    this.prepared = this.prepare().then(
      (ok) => ok,
      (error: unknown) => {
        console.error(
          'Cozy Diver: the shipwreck could not be prepared.',
          error,
        );
        this.preparation.fail();
        if (!this.disposed) this.ready = true;
        return !this.disposed;
      },
    );
  }
  private async prepare(): Promise<boolean> {
    await nextFrame();
    if (this.disposed) return false;
    // Compiled with the torch lit, so it never compiles on the way into the ship.
    this.torch.intensity = WRECK.torch.intensity;
    await warmUpScene(
      this.renderer,
      this.scene,
      this.camera,
      () => !this.disposed,
    );
    this.torch.intensity = 0;
    if (this.disposed) return false;
    this.preparation.settle();
    this.ready = true;
    return true;
  }
  get bounds(): Bounds {
    return WRECK.bounds;
  }
  get collision(): CollisionWorld {
    return this.world;
  }
  get isReady(): boolean {
    return this.ready && !this.disposed;
  }
  ease(p: Vec3, dir: Vec3): Vec3 {
    return easeInWreck(p, dir);
  }
  /** Ease the darkness towards how far inside the ship the eye is, and light the torch to match. */
  private light(dt: number, active: boolean): void {
    const want = wreckShade(this.camera.position),
      step = Math.min(Math.max(dt, 0), 0.1) * WRECK.dim;
    if (active)
      this.shade += Math.max(-step, Math.min(step, want - this.shade));
    const k = this.shade,
      dim = 1 - WRECK.darkness * k;
    this.lights.forEach((l, i) => {
      l.intensity = this.base[i] * dim;
    });
    (this.scene.background as THREE.Color).copy(this.water).lerp(this.black, k);
    this.fog.color.copy(this.water).lerp(this.black, k);
    this.torch.intensity = WRECK.torch.intensity * k;
    this.torch.visible = k > 0.001;
    // From the eye, along the look.
    this.torch.position.copy(this.camera.position);
    this.camera.getWorldDirection(this.ahead);
    this.torch.target.position
      .copy(this.camera.position)
      .addScaledVector(this.ahead, AIM);
    this.torch.target.updateMatrixWorld();
  }
  render(
    _time: number,
    reducedMotion: boolean,
    dt: number,
    active: boolean,
  ): void {
    if (this.disposed) return;
    this.renderer.getDrawingBufferSize(this.size);
    const aspect = this.size.x / Math.max(1, this.size.y);
    if (Math.abs(this.camera.aspect - aspect) > 1e-6) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
    this.light(dt, active);
    this.snow.update(dt, active, reducedMotion, this.camera.position);
    this.renderer.render(this.scene, this.camera);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.preparation.dispose();
    this.ready = false;
    this.snow.dispose();
    this.environment.dispose();
    this.lights.forEach((l) => l.dispose());
    this.torch.dispose();
    this.scene.clear();
  }
}
