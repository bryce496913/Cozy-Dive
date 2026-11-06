import * as THREE from 'three';
import type { FishVisual } from './FishGeometry';
/** Reuses the actual articulated rigs: each component gets its own instanced matrix, not a billboard. */
export class FishRenderBatch {
  readonly root = new THREE.Group();
  readonly meshes: readonly THREE.InstancedMesh[];
  private readonly parts: readonly (readonly THREE.Mesh[])[];
  private disposed = false;
  constructor(readonly visuals: readonly FishVisual[]) {
    this.parts = visuals.map((v) => {
      const parts: THREE.Mesh[] = [];
      v.root.traverse((o) => {
        if (o instanceof THREE.Mesh) parts.push(o);
      });
      return parts;
    });
    this.meshes = this.parts[0].map((part, i) => {
      const mesh = new THREE.InstancedMesh(
        part.geometry,
        part.material,
        visuals.length,
      );
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.name = `Articulated fish part ${i}`;
      this.root.add(mesh);
      return mesh;
    });
  }
  update(): void {
    if (this.disposed) return;
    for (let i = 0; i < this.visuals.length; i++) {
      this.visuals[i].root.updateMatrixWorld(true);
      for (let j = 0; j < this.meshes.length; j++)
        this.meshes[j].setMatrixAt(i, this.parts[i][j].matrixWorld);
    }
    for (const mesh of this.meshes) mesh.instanceMatrix.needsUpdate = true;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.meshes.forEach((m) => m.dispose());
    this.root.clear();
  }
}
