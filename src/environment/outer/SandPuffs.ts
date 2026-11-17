import * as THREE from 'three';
import { dotTexture } from '../shared/MarineSnow';

/**
 * v0.6 Pass 043: little puffs of sand and coral dust where a parrotfish bites. A small pool of
 * point clouds, each billowing out and settling as it fades over a second or two; idle ones are
 * hidden. Allocation-free once built. Owns its GPU resources.
 */
export const PUFF = {
  pool: 8,
  grains: 16,
  life: 1.8,
  spread: 0.35,
  rise: 0.25,
} as const;

interface Puff {
  readonly points: THREE.Points;
  readonly material: THREE.PointsMaterial;
  readonly origin: THREE.Vector3;
  readonly dir: Float32Array;
  age: number;
}

export class SandPuffs {
  readonly root = new THREE.Group();
  private readonly puffs: Puff[] = [];
  private readonly dot = dotTexture();
  private next = 0;
  private disposed = false;

  constructor(color = 0xe2d6b8) {
    this.root.name = 'Sand puffs';
    for (let k = 0; k < PUFF.pool; k++) {
      const geometry = new THREE.BufferGeometry(),
        dir = new Float32Array(PUFF.grains * 3);
      for (let i = 0; i < PUFF.grains; i++) {
        const a = (i / PUFF.grains) * Math.PI * 2 + k,
          up = 0.3 + 0.7 * Math.abs(Math.sin(i * 2.3 + k));
        dir[i * 3] = Math.cos(a) * (0.6 + 0.4 * Math.sin(i * 1.7));
        dir[i * 3 + 1] = up;
        dir[i * 3 + 2] = Math.sin(a) * (0.6 + 0.4 * Math.cos(i * 1.3));
      }
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(
          new Float32Array(PUFF.grains * 3),
          3,
        ).setUsage(THREE.DynamicDrawUsage),
      );
      const material = new THREE.PointsMaterial({
        color,
        size: 0.09,
        map: this.dot,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      });
      const points = new THREE.Points(geometry, material);
      points.name = 'Sand puff';
      points.frustumCulled = false;
      points.visible = false;
      this.root.add(points);
      this.puffs.push({
        points,
        material,
        origin: new THREE.Vector3(),
        dir,
        age: PUFF.life,
      });
    }
  }
  /** A new puff at (x, y, z), reusing the oldest. */
  spawn(x: number, y: number, z: number): void {
    const p = this.puffs[this.next];
    this.next = (this.next + 1) % this.puffs.length;
    p.origin.set(x, y, z);
    p.age = 0;
    p.points.visible = true;
  }
  update(dt: number): void {
    if (this.disposed || !(dt > 0)) return;
    for (const p of this.puffs) {
      if (p.age >= PUFF.life) continue;
      p.age = Math.min(PUFF.life, p.age + dt);
      const k = p.age / PUFF.life,
        // Billowing out quickly, then drifting and settling.
        out = PUFF.spread * (1 - Math.exp(-4 * k)),
        settle = PUFF.rise * Math.sin(Math.PI * Math.min(1, k * 1.3)),
        a = p.points.geometry.getAttribute('position');
      for (let i = 0; i < PUFF.grains; i++)
        a.setXYZ(
          i,
          p.origin.x + p.dir[i * 3] * out,
          p.origin.y + p.dir[i * 3 + 1] * settle,
          p.origin.z + p.dir[i * 3 + 2] * out,
        );
      a.needsUpdate = true;
      p.material.opacity = 0.75 * (1 - k) * Math.min(1, k * 8);
      if (p.age >= PUFF.life) p.points.visible = false;
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    for (const p of this.puffs) {
      p.points.geometry.dispose();
      p.material.dispose();
    }
    this.dot.dispose();
    this.root.clear();
  }
}
