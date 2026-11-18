import * as THREE from 'three';
import type { AssetLoader } from '../assets/AssetLoader';
import { ICE, ICE_FRAME } from '../config/passage';
import type { Bounds, Vec3 } from '../config/world';
import type { SightCandidate } from '../discovery/journal';
import { ICE_SIGHTS } from '../discovery/sights';
import { IceEnvironment } from '../environment/ice/IceEnvironment';
import { IceGarden } from '../environment/ice/IceGarden';
import { IceLife } from '../environment/ice/IceLife';
import { IceRare } from '../environment/ice/IceRare';
import { IceExtras } from '../environment/ice/IceExtras';
import { iceHabitat, iceSpecies } from '../environment/ice/IceSchools';
import { OuterSchools } from '../environment/outer/OuterSchools';
import { iceLimits } from '../creatures/iceLife';
import type { PlayerPresence } from '../fish/FishDiverReaction';
import { easeInIce, iceFloor } from '../environment/ice/IceTerrain';
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

export interface IceLibraries {
  /** The tank's fish loader (for the animals to come in later passes). */
  readonly fish: AssetLoader;
  readonly soundSpots: number;
}

/**
 * v0.6 Pass 046: the waters under the ice, as a water world: the environment and its garden, cold
 * clear blue water and drifting particles, lit like the other worlds (so programs are shared).
 * Its animals come in Passes 047–048.
 */
export class UnderIceScene implements WaterWorld {
  readonly id = 'ice' as const;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(64, 1, 0.08, 120);
  readonly environment: IceEnvironment;
  readonly garden: IceGarden;
  /** v0.6 Pass 046 review: how long each piece took to build (see `UnderIceScene.build`). */
  buildStats?: BuildStats;
  readonly snow = new MarineSnow({
    count: 650,
    reach: 11,
    size: 0.035,
    color: 0xe8f4ff,
    opacity: 0.55,
    sink: 0.015,
    wander: 0.025,
  });
  readonly sightings: SightCandidate[] = [];
  /** v0.6 Pass 046 review: how far it has got, and which parts loaded. */
  readonly preparation = new WorldPreparation();
  readonly soundSpots: Vec3[] = [];
  /** Resolves once it can be entered: built and its shaders compiled. */
  readonly prepared: Promise<boolean>;
  private readonly world: TerrainCollisionWorld;
  private readonly lights: THREE.Light[] = [];
  private readonly size = new THREE.Vector2();
  private ready = false;
  /** v0.6 Pass 047: its everyday life. */
  life?: IceLife;
  /** v0.6 Pass 048: its rare encounters. */
  rare?: IceRare;
  /** v0.6 Pass 052: its detail and drifting life, and its mid-water school. */
  readonly extras: IceExtras;
  schools?: OuterSchools;
  private disposed = false;

  /**
   * v0.6 Pass 046 review: build the waters under the ice a piece per frame (ice and rock, garden), so no
   * one frame carries it all; resolves undefined if no longer wanted while building.
   */
  static async build(
    renderer: THREE.WebGLRenderer,
    libraries: IceLibraries,
    frame: FrameWait = nextFrame,
    wanted: () => boolean = () => true,
  ): Promise<UnderIceScene | undefined> {
    const stage = new Staging(frame, wanted);
    try {
      const environment = await stage.step(
          'ice and rock',
          () => new IceEnvironment(),
        ),
        garden = await stage.step(
          'garden',
          () => new IceGarden(environment.stones),
        ),
        // v0.6 Pass 052: more detail and life (brinicles, seabed life, jellyfish, salps).
        extras = await stage.step(
          'detail',
          () => new IceExtras(environment.stones),
        ),
        scene = await stage.step(
          'scene',
          () =>
            new UnderIceScene(renderer, libraries, {
              environment,
              garden,
              extras,
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
    libraries: IceLibraries,
    parts: {
      readonly environment: IceEnvironment;
      readonly garden: IceGarden;
      readonly extras: IceExtras;
    },
  ) {
    this.environment = parts.environment;
    this.extras = parts.extras;
    this.scene.name = 'Under the ice';
    this.scene.background = new THREE.Color(ICE.water);
    this.scene.fog = new THREE.FogExp2(ICE.water, ICE.fog);
    this.garden = parts.garden;
    this.scene.add(
      this.environment.root,
      this.garden.root,
      this.extras.root,
      this.snow.points,
    );
    this.sightings.push(...this.extras.sightings);
    // The same kinds and number of lights as the tank: a cold sky light (the ice glowing above,
    // the seabed dark below), the sun low and pale through the ice, and a blue fill.
    const sky = new THREE.HemisphereLight(0xdff2ff, 0x2a3442, 1.25),
      sun = new THREE.DirectionalLight(0xf2f6ff, 1.5),
      fill = new THREE.DirectionalLight(0x6fa8d8, 0.45);
    sun.position.set(-10, 60, -20);
    fill.position.set(20, 10, 30);
    this.lights.push(sky, sun, fill);
    this.scene.add(sky, sun, fill);
    this.world = new TerrainCollisionWorld(
      new ColliderGrid(this.environment.colliders),
      ICE.bounds,
      iceFloor,
    );
    const stones = this.environment.stones;
    for (let i = 0; i < libraries.soundSpots; i++) {
      const s = stones[(i * 5) % Math.max(1, stones.length)];
      this.soundSpots.push(
        s ? { x: s.x, y: s.y + 2, z: s.z } : { x: 0, y: 4, z: -30 },
      );
    }
    // The place counts as seen from a few spots out of the tunnel; the garden's kinds close by.
    for (const [x, z] of [
      [0, -14],
      [-6, -28],
      [8, -42],
    ])
      this.sightings.push({
        ...ICE_SIGHTS.place,
        position: { x, y: 5, z },
        radius: 4,
      });
    const g = this.garden.spots;
    for (const [kind, sight, radius] of [
      ['sponge', ICE_SIGHTS.sponge, 1.2],
      ['coral', ICE_SIGHTS.coral, 0.9],
      ['anemone', ICE_SIGHTS.anemone, 0.8],
      ['star', ICE_SIGHTS.star, 0.8],
      ['feather', ICE_SIGHTS.feather, 0.8],
    ] as const)
      for (const p of g[kind])
        this.sightings.push({ ...sight, position: p, radius });
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(
      ICE_FRAME.origin.x,
      ICE_FRAME.origin.y,
      ICE_FRAME.origin.z,
    );
    this.prepared = this.prepare(libraries.fish).then(
      (ok) => ok,
      (error: unknown) => {
        console.error(
          'Cozy Diver: the waters under the ice could not be prepared.',
          error,
        );
        this.preparation.fail();
        if (!this.disposed) this.ready = true;
        return !this.disposed;
      },
    );
  }
  private async prepare(fish: AssetLoader): Promise<boolean> {
    // v0.6 Pass 047: its life, on the seabed (and its stones), under the ice, inside the walls.
    await nextFrame();
    if (this.disposed) return false;
    const stones = this.environment.stones,
      ground = (x: number, z: number): number => {
        let g = iceFloor(x, z);
        for (const s of stones)
          if (Math.hypot(s.x - x, s.z - z) < s.size * 0.6)
            g = Math.max(g, s.y + s.size * 0.6);
        return g;
      };
    const life = new IceLife(fish, ground, stones);
    this.life = life;
    const rare = new IceRare(fish, iceLimits(ground), this.sightings);
    this.rare = rare;
    const schools = new OuterSchools(iceHabitat(), iceSpecies(), fish);
    this.schools = schools;
    await Promise.all([
      this.preparation.track('wildlife', life.ready),
      this.preparation.track('rare encounters', rare.ready),
      this.preparation.track('schools', schools.ready),
    ]);
    if (this.disposed) return false;
    this.scene.add(life.root, rare.root, schools.root);
    // The school counts as seen from close by its leading fish (it carries its sighting with it).
    const lead = schools.fish.simulation.fish[0];
    if (lead)
      this.sightings.push({
        ...ICE_SIGHTS.silverfish,
        position: lead.position,
        radius: 4,
      });
    this.sightings.push(...life.sightings);
    await warmUpScene(
      this.renderer,
      this.scene,
      this.camera,
      () => !this.disposed,
    );
    if (this.disposed) return false;
    this.preparation.settle();
    this.ready = true;
    return true;
  }
  /** v0.6 Pass 048: the swimmer has come under the ice: the rare encounters start over. */
  arrive(): void {
    this.rare?.arrive();
  }
  get bounds(): Bounds {
    return ICE.bounds;
  }
  get collision(): CollisionWorld {
    return this.world;
  }
  get isReady(): boolean {
    return this.ready && !this.disposed;
  }
  ease(p: Vec3, dir: Vec3): Vec3 {
    return easeInIce(p, dir);
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
    this.garden.update(dt, active, reducedMotion);
    this.extras.update(dt, active, reducedMotion, player);
    // Only once warmed up, so everything is drawn (and compiled) in the warm-up first.
    if (this.ready) {
      this.life?.update(dt, active, reducedMotion, player, this.camera);
      this.rare?.update(dt, active, reducedMotion, player, this.camera);
      this.schools?.update(dt, active, reducedMotion, player, this.camera);
    }
    this.snow.update(dt, active, reducedMotion, this.camera.position);
    this.renderer.render(this.scene, this.camera);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.preparation.dispose();
    this.ready = false;
    this.garden.dispose();
    this.life?.dispose();
    this.rare?.dispose();
    this.schools?.dispose();
    this.extras.dispose();
    this.snow.dispose();
    this.environment.dispose();
    this.lights.forEach((l) => l.dispose());
    this.scene.clear();
  }
}
