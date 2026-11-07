import * as THREE from 'three';
import { AQUARIUM } from '../../config/world';
/** One bounded burst, one geometry/material and one instance draw; no timers or transient objects. */
export class OrnamentBubbles {
  readonly geometry = new THREE.SphereGeometry(1, 8, 6);
  readonly material = new THREE.MeshBasicMaterial({
    color: 0xbce5e6,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    wireframe: true,
  });
  readonly mesh = new THREE.InstancedMesh(this.geometry, this.material, 18);
  readonly capacity = 18;
  activeCount = 0;
  bursts = 0;
  private age = 0;
  private readonly origin = new THREE.Vector3();
  private readonly matrix = new THREE.Matrix4();
  private disposed = false;
  constructor() {
    this.mesh.name = 'Occasional chest bubble pool';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
  }
  emit(origin: THREE.Vector3): void {
    if (this.disposed) return;
    this.origin.copy(origin);
    this.age = 0;
    this.activeCount = this.capacity;
    this.bursts++;
    this.draw();
  }
  update(dt: number, active: boolean, reduced: boolean): void {
    if (this.disposed || !active || !Number.isFinite(dt) || dt <= 0) return;
    if (reduced) {
      this.activeCount = 0;
      this.mesh.count = 0;
      return;
    }
    if (!this.activeCount) return;
    this.age += Math.min(dt, 0.1);
    this.draw();
  }
  private draw(): void {
    let count = 0;
    for (let i = 0; i < this.capacity; i++) {
      const life = this.age - i * 0.045;
      const y = this.origin.y + life * (0.85 + (i % 5) * 0.07);
      if (life < 0 || life > 18 || y >= AQUARIUM.max.y - 0.08) continue;
      const radius =
        (0.025 + (i % 4) * 0.009) *
        Math.min(1, life * 4 + 0.3) *
        Math.min(1, (AQUARIUM.max.y - y) * 2);
      this.matrix.makeScale(radius, radius, radius);
      this.matrix.setPosition(
        this.origin.x + Math.sin(i * 2.3 + life * 1.4) * (0.08 + life * 0.025),
        y,
        this.origin.z + Math.cos(i * 1.7 + life) * 0.12,
      );
      this.mesh.setMatrixAt(count++, this.matrix);
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    // Delayed bubbles still belong to the live pool until their bounded lifetime ends.
    this.activeCount = this.age < 19 ? this.capacity : 0;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.activeCount = 0;
    this.mesh.count = 0;
  }
}
