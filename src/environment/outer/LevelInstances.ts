import * as THREE from 'three';

/**
 * v0.4 Pass 024: many copies of one library piece at several detail levels. Each level is one
 * instanced draw; every few frames each copy is written into the level its distance from the eye
 * calls for (compacted), so far copies cost a fraction of the triangles and the draw count stays
 * one per level. No allocation per update.
 */
export interface DetailLevel {
  /** Null: copies at this distance are not drawn at all (small pieces far away). */
  readonly geometry: THREE.BufferGeometry | null;
  /** Copies nearer than this (m) use this level; the last level takes everything beyond. */
  readonly until: number;
}
export class LevelInstances {
  /** One instanced mesh per drawn level (null where a level is not drawn). */
  readonly meshes: readonly (THREE.InstancedMesh | null)[];
  private readonly centres: Float32Array;
  private readonly matrices: readonly THREE.Matrix4[];
  private readonly level: Uint8Array;
  constructor(
    name: string,
    readonly levels: readonly DetailLevel[],
    material: THREE.Material,
    matrices: readonly THREE.Matrix4[],
  ) {
    this.matrices = matrices;
    this.centres = new Float32Array(matrices.length * 3);
    this.level = new Uint8Array(matrices.length).fill(255);
    const p = new THREE.Vector3();
    matrices.forEach((m, i) => {
      p.setFromMatrixPosition(m);
      this.centres[i * 3] = p.x;
      this.centres[i * 3 + 1] = p.y;
      this.centres[i * 3 + 2] = p.z;
    });
    this.meshes = levels.map((l, i) => {
      if (!l.geometry) return null;
      const mesh = new THREE.InstancedMesh(
        l.geometry,
        material,
        Math.max(1, matrices.length),
      );
      mesh.name = `${name} (detail ${i})`;
      mesh.count = 0;
      return mesh;
    });
  }
  get count(): number {
    return this.matrices.length;
  }
  /** Re-sort copies into levels for an eye at (x, y, z). */
  update(x: number, y: number, z: number): void {
    for (const m of this.meshes) if (m) m.count = 0;
    const last = this.levels.length - 1;
    for (let i = 0; i < this.matrices.length; i++) {
      const dx = this.centres[i * 3] - x,
        dy = this.centres[i * 3 + 1] - y,
        dz = this.centres[i * 3 + 2] - z,
        d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      let l = 0;
      while (l < last && d >= this.levels[l].until) l++;
      this.level[i] = l;
      const mesh = this.meshes[l];
      if (mesh) mesh.setMatrixAt(mesh.count++, this.matrices[i]);
    }
    for (const mesh of this.meshes) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = mesh.count > 0;
      if (mesh.count) mesh.computeBoundingSphere();
    }
  }
  /** Copies currently drawn at each level (for budgets and tests). */
  counts(): number[] {
    return this.meshes.map((m) => m?.count ?? 0);
  }
  /** The meshes that exist (to add to a scene). */
  get drawn(): THREE.InstancedMesh[] {
    return this.meshes.filter((m): m is THREE.InstancedMesh => !!m);
  }
  dispose(): void {
    for (const m of this.drawn) {
      m.removeFromParent();
      m.dispose();
    }
  }
}
