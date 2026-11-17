import * as THREE from 'three';
import type { AssetLoader } from '../assets/AssetLoader';
import { GROTTO, KELP, KELP_FRAME } from '../config/passage';
import type { Bounds, Vec3 } from '../config/world';
import type { SightCandidate } from '../discovery/journal';
import { KELP_SIGHTS } from '../discovery/sights';
import { KelpEnvironment } from '../environment/kelp/KelpEnvironment';
import { KelpDressing } from '../environment/kelp/KelpDressing';
import { KelpLight } from '../environment/kelp/KelpLight';
import { KelpVisitors } from '../environment/kelp/KelpVisitors';
import { SeaLion, kelpSeaLionLimits } from '../environment/kelp/SeaLion';
import { MarineSnow } from '../environment/shared/MarineSnow';
import {
  KELP_CRUISERS,
  kelpBassSpecies,
  kelpSchoolSpecies,
  kelpHabitat,
  kelpObstacles,
  kelpSpecies,
} from '../environment/kelp/KelpLife';
import { KelpStalks, STALKS } from '../environment/kelp/KelpStalks';
import { easeInKelp, kelpFloor } from '../environment/kelp/KelpTerrain';
import { OuterCreatures } from '../environment/outer/OuterCreatures';
import { OuterSchools } from '../environment/outer/OuterSchools';
import { TurnedCrevice } from '../environment/passage/TurnedCrevice';
import type { PlayerPresence } from '../fish/FishDiverReaction';
import type { CollisionWorld } from '../player/collision';
import {
  ColliderGrid,
  TerrainCollisionWorld,
} from '../player/terrainCollision';
import type { WaterWorld } from './WaterWorld';
import { WorldPreparation } from './WorldPreparation';
import { warmUpScene } from './warmUp';

/**
 * v0.6 Pass 032: the kelp forest, the third water world. Built when the swimmer nears the cleft
 * at the outer reef's cliff, and released once they are well away from it; only one world renders
 * per frame. Cool green water, golden kelp swaying up to a bright surface, boulders with garibaldi,
 * and bat rays gliding along a sandy lane. It reuses the tank's fish loader (nothing decoded
 * twice) and the outer reef's school and creature systems.
 */
export interface KelpLibraries {
  readonly fish: AssetLoader;
  /** How many sound locations the soundscape uses (the forest supplies as many). */
  readonly soundSpots: number;
}

export class KelpForestScene implements WaterWorld {
  readonly id = 'kelp' as const;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(64, 1, 0.08, 120);
  readonly environment = new KelpEnvironment();
  readonly stalks = new KelpStalks();
  /** v0.6 Pass 035: urchins, sea stars, anemones and cobbles; sunbeams; drifting particles. */
  readonly dressing: KelpDressing;
  readonly light = new KelpLight();
  readonly snow = new MarineSnow({
    count: 700,
    reach: 11,
    size: 0.05,
    color: 0xd8e8c8,
    opacity: 0.55,
    sink: 0.03,
    wander: 0.05,
  });
  /** v0.6 Pass 034: the grotto against the wall, east of the tunnel: the way on to the sea cave. */
  readonly grotto = new TurnedCrevice(GROTTO.offset, 'Grotto to the sea cave');
  schools?: OuterSchools;
  creatures?: OuterCreatures;
  /** v0.6 Pass 039: a playful sea lion that comes to circle the swimmer. */
  seaLion?: SeaLion;
  /** v0.6 Pass 044 */
  visitors?: KelpVisitors;
  readonly sightings: SightCandidate[] = [];
  /** v0.6 Pass 047: how far it has got, and which parts loaded. */
  readonly preparation = new WorldPreparation();
  readonly soundSpots: Vec3[] = [];
  /** Resolves once it can be entered: built, its fish and rays loaded, its shaders compiled. */
  readonly prepared: Promise<boolean>;
  private readonly world: TerrainCollisionWorld;
  private readonly lights: THREE.Light[] = [];
  private readonly size = new THREE.Vector2();
  private ready = false;
  private disposed = false;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    libraries: KelpLibraries,
  ) {
    this.scene.name = 'Kelp forest';
    this.scene.background = new THREE.Color(KELP.water);
    this.scene.fog = new THREE.FogExp2(KELP.water, KELP.fog);
    this.dressing = new KelpDressing(this.environment.boulders);
    this.scene.add(
      this.environment.root,
      this.stalks.root,
      this.grotto.root,
      this.dressing.root,
      this.light.root,
      this.snow.points,
    );
    // The same kinds and number of lights as the tank, so most programs are shared with it.
    const sky = new THREE.HemisphereLight(0xd8f0c8, 0x3a4630, 1.35),
      sun = new THREE.DirectionalLight(0xfff0c6, 2.3),
      fill = new THREE.DirectionalLight(0x8fd0aa, 0.45);
    sun.position.set(-15, 60, -30);
    fill.position.set(25, 15, 30);
    this.lights.push(sky, sun, fill);
    this.scene.add(sky, sun, fill);
    this.world = new TerrainCollisionWorld(
      new ColliderGrid([
        ...this.environment.colliders,
        ...this.grotto.colliders,
      ]),
      KELP.bounds,
      kelpFloor,
    );
    const rocks = this.environment.boulders;
    for (let i = 0; i < libraries.soundSpots; i++) {
      const r = rocks[(i * 7) % rocks.length];
      this.soundSpots.push({ x: r.x, y: r.y + r.height + 1, z: r.z });
    }
    // Giant kelp counts as seen from a handful of stalks near the tunnel's exit and beyond.
    // From the forest's own kelp (not the dense band along its walls, Pass 036).
    const near = this.stalks.placements
      .slice(0, STALKS.count)
      .sort((a, b) => b.z - a.z)
      .slice(0, 40);
    for (let i = 0; i < near.length; i += 8) {
      const s = near[i];
      this.sightings.push({
        id: KELP_SIGHTS.kelp.id,
        label: KELP_SIGHTS.kelp.label,
        position: { x: s.x, y: s.y + 4, z: s.z },
        radius: 2.5,
      });
    }
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(
      KELP_FRAME.origin.x,
      KELP_FRAME.origin.y,
      KELP_FRAME.origin.z,
    );
    this.prepared = this.prepare(libraries.fish).then(
      (ok) => ok,
      (error: unknown) => {
        console.error(
          'Cozy Diver: the kelp forest could not be prepared.',
          error,
        );
        this.preparation.fail();
        // Without its life it is still a forest to swim in.
        if (!this.disposed) this.ready = true;
        return !this.disposed;
      },
    );
  }
  private async prepare(fish: AssetLoader): Promise<boolean> {
    const boulders = this.environment.boulders;
    this.schools = new OuterSchools(
      kelpHabitat(boulders),
      [...kelpSpecies(boulders), ...kelpBassSpecies(), ...kelpSchoolSpecies()],
      fish,
    );
    this.creatures = new OuterCreatures(
      kelpObstacles(boulders),
      fish,
      KELP_CRUISERS,
      'Kelp forest rays',
    );
    this.seaLion = new SeaLion(
      kelpSeaLionLimits(kelpObstacles(boulders)),
      fish,
    );
    this.visitors = new KelpVisitors(
      fish,
      boulders,
      this.stalks.placements.slice(0, STALKS.count),
      this.dressing.urchinSpots,
      kelpObstacles(boulders),
    );
    const prep = this.preparation;
    const [, loaded, lion] = await Promise.all([
      prep.track('schools', this.schools.ready),
      prep.track('rays and sharks', this.creatures.ready),
      prep.track('sea lion', this.seaLion.ready),
      prep.track('visitors', this.visitors.ready),
    ]);
    if (this.disposed) return false;
    this.scene.add(this.schools.root);
    if (loaded) this.scene.add(this.creatures.root);
    if (lion) {
      this.scene.add(this.seaLion.root);
      this.sightings.push(...this.seaLion.sightings);
    }
    this.sightings.push(...this.creatures.sightings);
    this.scene.add(this.visitors.root);
    this.sightings.push(...this.visitors.sightings);
    // A garibaldi is seen by following one fish from each of the first few groups.
    const garibaldi = this.schools.fish.simulation.fish.filter(
      (f) => f.species.id === 'garibaldi',
    );
    for (let i = 0; i < garibaldi.length && i < 12; i += 4)
      this.sightings.push({
        id: KELP_SIGHTS.garibaldi.id,
        label: KELP_SIGHTS.garibaldi.label,
        position: garibaldi[i].position,
        radius: 1.2,
      });
    // v0.6 Pass 035: a kelp bass is seen by following one fish from each group.
    const bass = this.schools.fish.simulation.fish.filter(
      (f) => f.species.id === 'kelp-bass',
    );
    // v0.6 Pass 041: and a blacksmith and a señorita likewise.
    for (const kind of ['blacksmith', 'senorita'] as const) {
      const sight = KELP_SIGHTS[kind],
        fish = this.schools.fish.simulation.fish.filter(
          (f) => f.species.id === kind,
        );
      for (let i = 0; i < fish.length; i += 8)
        this.sightings.push({
          id: sight.id,
          label: sight.label,
          position: fish[i].position,
          radius: 1.4,
        });
    }
    for (let i = 0; i < bass.length; i += 8)
      this.sightings.push({
        id: KELP_SIGHTS.bass.id,
        label: KELP_SIGHTS.bass.label,
        position: bass[i].position,
        radius: 1.6,
      });
    await warmUpScene(this.renderer, this.scene, this.camera);
    if (this.disposed) return false;
    prep.settle();
    this.ready = true;
    return true;
  }
  get bounds(): Bounds {
    return KELP.bounds;
  }
  get collision(): CollisionWorld {
    return this.world;
  }
  get isReady(): boolean {
    return this.ready && !this.disposed;
  }
  ease(p: Vec3, dir: Vec3): Vec3 {
    return easeInKelp(p, dir);
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
    this.stalks.update(dt, active, reducedMotion);
    this.dressing.update(dt, active, reducedMotion);
    this.light.update(dt, active, reducedMotion, this.camera.position);
    this.snow.update(dt, active, reducedMotion, this.camera.position);
    this.schools?.update(dt, active, reducedMotion, player, this.camera);
    this.creatures?.update(dt, active, reducedMotion, player, this.camera);
    this.seaLion?.update(dt, active, reducedMotion, player, this.camera);
    // Only once warmed up, so everything is drawn (and compiled) in the warm-up first.
    if (this.ready)
      this.visitors?.update(dt, active, reducedMotion, player, this.camera);
    this.renderer.render(this.scene, this.camera);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.preparation.dispose();
    this.ready = false;
    this.schools?.dispose();
    this.creatures?.dispose();
    this.seaLion?.dispose();
    this.visitors?.dispose();
    this.sightings.length = 0;
    this.stalks.dispose();
    this.dressing.dispose();
    this.light.dispose();
    this.snow.dispose();
    this.grotto.dispose();
    this.environment.dispose();
    this.lights.forEach((l) => l.dispose());
    this.scene.clear();
  }
}
