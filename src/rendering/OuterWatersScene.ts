import * as THREE from 'three';
import { OUTER } from '../config/passage';
import type { Bounds } from '../config/world';
import type { SightCandidate } from '../discovery/journal';
import { OuterEnvironment } from '../environment/outer/OuterEnvironment';
import { CollisionWorld } from '../player/collision';
import type { WaterWorld } from './WaterWorld';
import { warmUpScene } from './warmUp';

/**
 * v0.4 Pass 023: renders the outer waters with the tank's renderer. Created when the swimmer
 * nears the hidden crevice and released once they are well away, so its GPU resources only exist
 * while it might be needed. Only one water world renders per frame.
 */
const WATER = 0x1d5d76;

export class OuterWatersScene implements WaterWorld {
  readonly id = 'outer' as const;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(64, 1, 0.08, 170);
  readonly environment = new OuterEnvironment();
  readonly collision: CollisionWorld;
  readonly sightings: readonly SightCandidate[] = [];
  /** Resolves once its shaders are compiled and textures uploaded (false if disposed first). */
  readonly prepared: Promise<boolean>;
  private readonly lights: THREE.Light[] = [];
  private readonly size = new THREE.Vector2();
  private ready = false;
  private disposed = false;

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.scene.name = 'Outer waters';
    this.scene.background = new THREE.Color(WATER);
    this.scene.fog = new THREE.FogExp2(WATER, OUTER.fog);
    this.scene.add(this.environment.root);
    const sky = new THREE.HemisphereLight(0xb5e6ea, 0x3d5a4e, 1.7),
      sun = new THREE.DirectionalLight(0xfff1d2, 2.4);
    sun.position.set(-20, 60, -40);
    this.lights.push(sky, sun);
    this.scene.add(sky, sun);
    this.collision = new CollisionWorld(
      this.environment.colliders,
      OUTER.bounds,
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(
      OUTER.tunnel[1].x,
      OUTER.tunnel[1].y,
      OUTER.tunnel[1].z,
    );
    this.prepared = warmUpScene(renderer, this.scene, this.camera).then(
      () => {
        if (this.disposed) return false;
        this.ready = true;
        return true;
      },
      () => !this.disposed && ((this.ready = true), true),
    );
  }
  get bounds(): Bounds {
    return OUTER.bounds;
  }
  /** Whether it can be entered (shaders compiled). */
  get isReady(): boolean {
    return this.ready && !this.disposed;
  }
  render(): void {
    if (this.disposed) return;
    this.renderer.getDrawingBufferSize(this.size);
    const aspect = this.size.x / Math.max(1, this.size.y);
    if (Math.abs(this.camera.aspect - aspect) > 1e-6) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.ready = false;
    this.environment.dispose();
    this.lights.forEach((l) => l.dispose());
    this.scene.clear();
  }
}
