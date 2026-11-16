import * as THREE from 'three';
import { KELP } from '../../config/passage';
import type { Vec3 } from '../../config/world';
import { beamGeometry, beamMaterial } from '../shared/LightBeam';

/**
 * v0.6 Pass 035: sunbeams slanting down through gaps in the kelp canopy. Each beam leans with the
 * sun and sways slightly as the canopy moves; it fades with distance (the beams ignore the fog,
 * which would otherwise brighten them), so only those near the swimmer show. Owns its resources.
 */
export const KELP_BEAMS = {
  /** Where the gaps in the canopy are (x, z), over glades and the lane. */
  at: [
    [-3, -16],
    [9, -24],
    [-14, -31],
    [4, -38],
    [16, -47],
    [-8, -50],
    [10, -61],
    [-18, -64],
    [2, -72],
    [22, -33],
  ] as readonly (readonly [number, number])[],
  length: 21,
  /** The sun's direction (towards it), as the scene's sun light. */
  sun: { x: -15, y: 60, z: -30 },
  /** Fully visible within `near` m of the eye, gone beyond `far`. */
  near: 9,
  far: 24,
  sway: 0.035,
} as const;

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface Beam {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshBasicMaterial;
  readonly mid: Vec3;
  readonly phase: number;
}

export class KelpLight {
  readonly root = new THREE.Group();
  private readonly geometry: THREE.BufferGeometry;
  private readonly beams: Beam[] = [];
  private readonly tilt = new THREE.Quaternion();
  private readonly swayQ = new THREE.Quaternion();
  private readonly axis = new THREE.Vector3();
  private time = 0;
  private disposed = false;

  constructor() {
    this.root.name = 'Kelp forest sunbeams';
    const b = KELP_BEAMS;
    this.geometry = beamGeometry({
      length: b.length,
      topRadius: 1.2,
      bottomRadius: 2.6,
      intensity: 0.07,
      tint: [0.95, 1, 0.8],
      topFade: 0.45,
    });
    // Lean each beam along the sunlight (from the sun, downwards).
    const down = new THREE.Vector3(0, -1, 0),
      light = new THREE.Vector3(-b.sun.x, -b.sun.y, -b.sun.z).normalize();
    this.tilt.setFromUnitVectors(down, light);
    this.axis.set(light.z, 0, -light.x).normalize();
    b.at.forEach(([x, z], i) => {
      const material = beamMaterial(`Kelp sunbeam ${i}`),
        mesh = new THREE.Mesh(this.geometry, material);
      mesh.name = `Kelp sunbeam ${i}`;
      mesh.position.set(x, KELP.surfaceY - 0.5, z);
      mesh.quaternion.copy(this.tilt);
      mesh.renderOrder = 2;
      this.root.add(mesh);
      this.beams.push({
        mesh,
        material,
        mid: {
          x: x + light.x * b.length * 0.5,
          y: KELP.surfaceY + light.y * b.length * 0.5,
          z: z + light.z * b.length * 0.5,
        },
        phase: i * 1.7,
      });
    });
  }
  /** Fade beams by distance from the eye; sway them on simulation time. */
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    eye: Readonly<Vec3>,
  ): void {
    if (this.disposed) return;
    const b = KELP_BEAMS,
      moving = active && !reducedMotion && dt > 0;
    if (moving) this.time += Math.min(dt, 0.1);
    for (const beam of this.beams) {
      const d = Math.hypot(
          beam.mid.x - eye.x,
          (beam.mid.y - eye.y) * 0.5,
          beam.mid.z - eye.z,
        ),
        k = 1 - smooth(b.near, b.far, d);
      beam.mesh.visible = k > 0.01;
      beam.material.color.setScalar(k);
      if (moving) {
        this.swayQ.setFromAxisAngle(
          this.axis,
          b.sway * Math.sin(this.time * 0.25 + beam.phase),
        );
        beam.mesh.quaternion.multiplyQuaternions(this.swayQ, this.tilt);
      }
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    this.geometry.dispose();
    this.beams.forEach((b) => b.material.dispose());
  }
}
