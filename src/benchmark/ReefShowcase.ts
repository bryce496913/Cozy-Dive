import * as THREE from 'three';
import { AssetLoader, type AssetLease } from '../assets/AssetLoader';
import { isCollisionNode } from '../assets/AssetValidation';
import type {
  UnderwaterScene,
  Presentation,
} from '../rendering/UnderwaterScene';
import { assetColliders } from '../assets/AssetCollision';
import { AuthoredSchool } from './AuthoredSchool';
/** Owned, removable presentation benchmark. Normal gameplay never imports this module. */
export class ReefShowcase implements Presentation {
  readonly school: AuthoredSchool;
  readonly coral: THREE.Object3D;
  readonly formation;
  readonly colliders;
  private disposed = false;
  private upgraded = false;
  private readonly original: readonly boolean[];
  private readonly originalLighting: readonly number[];
  private readonly sunTarget = new THREE.Vector3();
  constructor(
    readonly world: UnderwaterScene,
    readonly loader: AssetLoader,
    private readonly coralLease: AssetLease,
    fish: readonly AssetLease[],
  ) {
    this.school = new AuthoredSchool(world.aquarium.fish, fish);
    this.coral = coralLease.model;
    this.formation = world.aquarium.hardscape.formations.find(
      (f) => f.kind === 'branching' && f.role === 'stony-coral',
    )!;
    this.coral.position.copy(this.formation.position);
    this.coral.updateMatrixWorld(true);
    this.colliders = assetColliders(this.coral);
    this.coral.traverse((object) => {
      if (object instanceof THREE.Mesh && !isCollisionNode(object)) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    world.aquarium.root.add(this.school.root, this.coral);
    const lights = world.scene.children.filter(
      (o): o is THREE.Light => o instanceof THREE.Light,
    );
    this.originalLighting = lights.map((l) => l.intensity);
    const sun = lights.find((l) => l instanceof THREE.DirectionalLight);
    if (sun instanceof THREE.DirectionalLight)
      this.sunTarget.copy(sun.target.position);
    this.original = world.aquarium.fish.batches.map((b) => b.root.visible);
    this.setUpgraded(true);
  }
  static async create(
    world: UnderwaterScene,
    loader: AssetLoader,
  ): Promise<ReefShowcase> {
    const leases: AssetLease[] = [];
    try {
      const coral = await loader.acquire('acropora');
      leases.push(coral);
      const results = await Promise.allSettled(
        Array.from({ length: 20 }, async () => {
          const lease = await loader.acquire('chromis');
          leases.push(lease);
          return lease;
        }),
      );
      const failed = results.find((r) => r.status === 'rejected');
      if (failed?.status === 'rejected') throw failed.reason;
      const fish: AssetLease[] = [];
      for (const result of results)
        if (result.status === 'fulfilled') fish.push(result.value);
      return new ReefShowcase(world, loader, coral, fish);
    } catch (error) {
      leases.forEach((l) => l.release());
      throw error;
    }
  }
  setUpgraded(value: boolean, lighting = value): void {
    const q = this.world.aquarium;
    this.upgraded = value;
    this.school.root.visible = value;
    this.coral.visible = value;
    this.formation.mesh.visible = !value;
    q.fish.batches.forEach((b, i) => {
      if (b.visuals[0].root.name.startsWith('Blue-green chromis'))
        b.root.visible = value ? false : this.original[i];
    });
    q.replacePresentationColliders(
      value ? this.formation.colliders : this.colliders,
      value ? this.colliders : this.formation.colliders,
    );
    const lights = this.world.scene.children.filter(
      (o): o is THREE.Light => o instanceof THREE.Light,
    );
    lights.forEach((l, i) => {
      l.intensity = lighting
        ? l instanceof THREE.HemisphereLight
          ? 0.95
          : i === 1
            ? 3.5
            : 0.55
        : this.originalLighting[i];
    });
    this.world.renderer.toneMappingExposure = lighting ? 1.13 : 1.35;
    this.world.renderer.shadowMap.enabled = lighting;
    this.world.renderer.shadowMap.type = THREE.PCFShadowMap;
    const sun = lights.find(
      (l): l is THREE.DirectionalLight => l instanceof THREE.DirectionalLight,
    );
    if (sun) {
      sun.castShadow = lighting;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = this.formation.position.x - 3;
      sun.shadow.camera.right = this.formation.position.x + 3;
      // A focused shadow frustum follows the benchmark in light space via its target.
      sun.target.position.copy(
        lighting ? this.formation.position : this.sunTarget,
      );
      this.world.scene.add(sun.target);
      sun.shadow.camera.left = -4;
      sun.shadow.camera.right = 4;
      sun.shadow.camera.top = 4;
      sun.shadow.camera.bottom = -4;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 45;
      sun.shadow.normalBias = 0.012;
      sun.shadow.bias = -0.0002;
      sun.shadow.camera.updateProjectionMatrix();
    }
    q.root.traverse((o) => {
      if (
        o instanceof THREE.Mesh &&
        ['Weathered', 'Sedimentary', 'Fractured'].some((name) =>
          o.geometry.name.startsWith(name),
        )
      ) {
        o.receiveShadow = lighting;
        o.castShadow =
          lighting && o.position.distanceTo(this.formation.position) < 3;
      }
    });
    this.update();
  }
  update(): void {
    if (!this.disposed && this.upgraded) this.school.update();
  }
  dispose(): void {
    if (this.disposed) return;
    this.setUpgraded(false, false);
    this.disposed = true;
    this.coral.removeFromParent();
    this.school.dispose();
    this.coralLease.release();
    this.loader.dispose();
    const sun = this.world.scene.children.find(
      (o) => o instanceof THREE.DirectionalLight,
    );
    if (sun instanceof THREE.DirectionalLight) {
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  }
}
