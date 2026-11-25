import * as THREE from 'three';
import type { Vec3 } from '../../config/world';

interface Snapshot {
  geometry: THREE.BufferGeometry;
  matrix: THREE.Matrix4;
}
/**
 * Exact rendered steel, cropped to each miniature's observation neighbourhood. These CPU-only
 * meshes never enter a scene or upload to the GPU. A sighting's eye and target are both within
 * `reach` of its home, so a triangle outside that box cannot obstruct their connecting segment.
 */
export class WreckMiniOcclusion<K extends string> {
  private readonly meshes = new Map<K, THREE.Mesh[]>();
  private snapshots: Snapshot[] = [];
  private disposed = false;
  private readonly ray = new THREE.Raycaster();
  private readonly origin = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly hits: THREE.Intersection[] = [];
  constructor(
    private readonly source: readonly THREE.Mesh[],
    private readonly homes: Readonly<
      Record<K, { readonly target: Readonly<Vec3> }>
    >,
    private readonly reach: number,
  ) {}
  private clear(): void {
    for (const meshes of this.meshes.values())
      for (const mesh of meshes) mesh.geometry.dispose();
    this.meshes.clear();
  }
  private prepare(): void {
    if (this.disposed) return;
    let current = this.snapshots.length === this.source.length;
    for (let i = 0; current && i < this.source.length; i++) {
      const mesh = this.source[i],
        snapshot = this.snapshots[i];
      current =
        mesh.geometry === snapshot.geometry &&
        mesh.matrixWorld.equals(snapshot.matrix);
    }
    if (current) return;
    this.clear();
    this.snapshots = this.source.map((m) => ({
      geometry: m.geometry,
      matrix: m.matrixWorld.clone(),
    }));
    const keys = Object.keys(this.homes) as K[];
    for (const key of keys) this.meshes.set(key, []);
    const point = new THREE.Vector3(),
      r = this.reach + 0.05;
    for (const source of this.source) {
      const p = source.geometry.getAttribute('position'),
        index = source.geometry.index;
      const positions = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        point.fromBufferAttribute(p, i).applyMatrix4(source.matrixWorld);
        positions[i * 3] = point.x;
        positions[i * 3 + 1] = point.y;
        positions[i * 3 + 2] = point.z;
      }
      for (const key of keys) {
        const at = this.homes[key].target,
          local: number[] = [];
        for (let i = 0; i < (index?.count ?? p.count); i += 3) {
          const a = (index ? index.getX(i) : i) * 3,
            b = (index ? index.getX(i + 1) : i + 1) * 3,
            c = (index ? index.getX(i + 2) : i + 2) * 3;
          if (
            Math.min(positions[a], positions[b], positions[c]) > at.x + r ||
            Math.max(positions[a], positions[b], positions[c]) < at.x - r ||
            Math.min(positions[a + 1], positions[b + 1], positions[c + 1]) >
              at.y + r ||
            Math.max(positions[a + 1], positions[b + 1], positions[c + 1]) <
              at.y - r ||
            Math.min(positions[a + 2], positions[b + 2], positions[c + 2]) >
              at.z + r ||
            Math.max(positions[a + 2], positions[b + 2], positions[c + 2]) <
              at.z - r
          )
            continue;
          local.push(
            positions[a],
            positions[a + 1],
            positions[a + 2],
            positions[b],
            positions[b + 1],
            positions[b + 2],
            positions[c],
            positions[c + 1],
            positions[c + 2],
          );
        }
        if (!local.length) continue;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(local, 3),
        );
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, source.material);
        mesh.name = `CPU visibility: ${source.name}`;
        this.meshes.get(key)!.push(mesh);
      }
    }
  }
  warmUp(): void {
    this.prepare();
  }
  visible(kind: K, eye: Readonly<Vec3>, at: Readonly<Vec3>): boolean {
    if (this.disposed) return false;
    this.origin.set(eye.x, eye.y, eye.z);
    this.direction.set(at.x - eye.x, at.y - eye.y, at.z - eye.z);
    const distance = this.direction.length();
    if (distance > this.reach + 0.001) return false;
    this.prepare();
    this.ray.far = Math.max(0, distance - 0.025);
    this.ray.set(this.origin, this.direction.normalize());
    this.hits.length = 0;
    this.ray.intersectObjects(this.meshes.get(kind)!, false, this.hits);
    return this.hits.length === 0;
  }
  triangleCount(kind: K): number {
    if (this.disposed) return 0;
    this.prepare();
    return this.meshes
      .get(kind)!
      .reduce((n, m) => n + m.geometry.getAttribute('position').count / 3, 0);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    this.snapshots = [];
  }
}
