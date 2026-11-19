import * as THREE from 'three';
import type { Vec3 } from '../../config/world';

/**
 * v0.6 Pass 035: drifting particles in the water ("marine snow"): specks of life and sediment that
 * hang and drift slowly, giving the water depth and a sense of movement. A field of points that
 * wraps around the eye, so it is everywhere without being infinite: each speck keeps its place in
 * the world (moving past it shows parallax), and one that falls out of the box around the eye
 * reappears on the far side. One draw; allocation-free per frame. Owns its GPU resources.
 */
export interface SnowOptions {
  readonly count: number;
  /** Half-size of the box around the eye (m). */
  readonly reach: number;
  /** Speck size (m) and colour. */
  readonly size: number;
  readonly color: number;
  readonly opacity: number;
  /** Drift: sinking speed and sideways wander (m/s). */
  readonly sink: number;
  readonly wander: number;
  readonly seed?: number;
}

/** A soft round dot, white with alpha falling to the edge (built once per field). */
export function dotTexture(): THREE.DataTexture {
  const n = 32,
    data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2),
        a = Math.max(0, 1 - d) ** 1.6;
      const i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  const t = new THREE.DataTexture(data, n, n);
  t.needsUpdate = true;
  return t;
}

export class MarineSnow {
  readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly phases: Float32Array;
  private readonly texture = dotTexture();
  private readonly material: THREE.PointsMaterial;
  private time = 0;
  private placed = false;
  private disposed = false;

  constructor(private readonly options: SnowOptions) {
    const n = options.count;
    this.positions = new Float32Array(n * 3);
    this.phases = new Float32Array(n);
    let s = (options.seed ?? 35011) >>> 0;
    const rand = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let i = 0; i < n; i++) {
      this.positions[i * 3] = (rand() * 2 - 1) * options.reach;
      this.positions[i * 3 + 1] = (rand() * 2 - 1) * options.reach;
      this.positions[i * 3 + 2] = (rand() * 2 - 1) * options.reach;
      this.phases[i] = rand() * Math.PI * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.material = new THREE.PointsMaterial({
      name: 'Marine snow',
      color: options.color,
      size: options.size,
      map: this.texture,
      transparent: true,
      opacity: options.opacity,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.name = 'Marine snow';
    // The field follows the eye, so it never leaves the view: skip culling.
    this.points.frustumCulled = false;
  }
  /** Drift (on simulation time, while playing and without reduced motion) and wrap round the eye. */
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    eye: Readonly<Vec3>,
  ): void {
    if (this.disposed) return;
    const o = this.options,
      p = this.positions,
      r = o.reach,
      span = 2 * r,
      moving = active && !reducedMotion && dt > 0,
      step = moving ? Math.min(dt, 0.1) : 0;
    if (moving) this.time += step;
    if (!this.placed) {
      // First frame: move the field from around the origin to around the eye.
      for (let i = 0; i < p.length; i += 3) {
        p[i] += eye.x;
        p[i + 1] += eye.y;
        p[i + 2] += eye.z;
      }
      this.placed = true;
    }
    for (let i = 0, k = 0; i < p.length; i += 3, k++) {
      if (step) {
        const ph = this.phases[k],
          t = this.time;
        p[i] += Math.sin(t * 0.21 + ph) * o.wander * step;
        p[i + 1] -= o.sink * (0.6 + 0.4 * Math.sin(ph * 3)) * step;
        p[i + 2] += Math.cos(t * 0.17 + ph * 1.3) * o.wander * step;
      }
      // Wrap into the box around the eye.
      let d = p[i] - eye.x;
      if (d > r || d < -r)
        p[i] = eye.x + (((((d + r) % span) + span) % span) - r);
      d = p[i + 1] - eye.y;
      if (d > r || d < -r)
        p[i + 1] = eye.y + (((((d + r) % span) + span) % span) - r);
      d = p[i + 2] - eye.z;
      if (d > r || d < -r)
        p[i + 2] = eye.z + (((((d + r) % span) + span) % span) - r);
    }
    this.points.geometry.getAttribute('position').needsUpdate = true;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.points.removeFromParent();
    this.points.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
