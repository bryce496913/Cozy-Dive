import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SightCandidate } from '../../discovery/journal';
import { CAVE_SIGHTS } from '../../discovery/sights';

/**
 * v0.6 Pass 034: spiny lobsters peering out of the cave's cracks, built in code. Each is a
 * reddish-brown body with banded legs and a pale-spotted tail; its two long antennae sweep slowly.
 * Two instanced draws for all of them (bodies, antennae). Owns its geometry and materials.
 */
export const LOBSTER = {
  /** Body length (m) from the head to the tail fan. */
  length: 0.42,
  /** How far each lobster sits back into its crack (m). */
  inset: 0.14,
  /** Antenna sweep: amplitude (radians) and rate (radians per second). */
  sweep: 0.22,
  rate: 0.9,
} as const;

export interface LobsterSpot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Heading the lobster faces out of its crack (radians about y; 0 faces +z). */
  readonly yaw: number;
}

/** Give a part a flat colour (lightly speckled), keeping only positions, normals and colours. */
function colored(g: THREE.BufferGeometry, r: number, gr: number, b: number) {
  const n = g.getAttribute('position').count,
    c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const speck = 0.88 + 0.12 * Math.sin(i * 12.9898);
    c[i * 3] = r * speck;
    c[i * 3 + 1] = gr * speck;
    c[i * 3 + 2] = b * speck;
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  g.deleteAttribute('uv');
  return g;
}
/** The body, facing +z, its underside at y 0: carapace, banded tail, tail fan and legs. */
export function lobsterBody(): THREE.BufferGeometry {
  const L = LOBSTER.length,
    parts: THREE.BufferGeometry[] = [];
  const shell = new THREE.SphereGeometry(1, 12, 8);
  shell.scale(0.07, 0.055, 0.13);
  shell.translate(0, 0.06, L * 0.18);
  parts.push(colored(shell, 0.55, 0.22, 0.12));
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.SphereGeometry(1, 10, 6);
    seg.scale(0.06 - i * 0.006, 0.042 - i * 0.003, 0.05);
    seg.translate(0, 0.055 - i * 0.004, L * 0.0 - i * 0.055);
    // Pale spots on alternate segments.
    parts.push(
      i % 2 ? colored(seg, 0.78, 0.6, 0.42) : colored(seg, 0.5, 0.2, 0.11),
    );
  }
  const fan = new THREE.ConeGeometry(0.06, 0.07, 6, 1);
  fan.rotateX(-Math.PI / 2);
  fan.scale(1.3, 0.35, 1);
  fan.translate(0, 0.045, -0.3);
  parts.push(colored(fan, 0.6, 0.3, 0.16));
  for (const side of [-1, 1])
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.CylinderGeometry(0.008, 0.006, 0.12, 4);
      leg.rotateZ(side * 1.05);
      leg.translate(side * 0.08, 0.03, L * 0.25 - i * 0.04);
      parts.push(colored(leg, 0.72, 0.5, 0.3));
    }
  // The two short, thick horns over the eyes.
  for (const side of [-1, 1]) {
    const horn = new THREE.ConeGeometry(0.014, 0.06, 5);
    horn.rotateX(Math.PI / 2.6);
    horn.translate(side * 0.03, 0.1, L * 0.33);
    parts.push(colored(horn, 0.6, 0.3, 0.15));
  }
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((g) => g.dispose());
  merged.computeVertexNormals();
  return merged;
}
/** The two long antennae, curving out and back from a pivot at the head (origin), facing +z. */
export function lobsterAntennae(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.025, 0, 0),
        new THREE.Vector3(side * 0.12, 0.05, 0.16),
        new THREE.Vector3(side * 0.24, 0.04, 0.32),
        new THREE.Vector3(side * 0.34, -0.02, 0.5),
      ]),
      tube = new THREE.TubeGeometry(curve, 10, 0.009, 4, false);
    parts.push(colored(tube, 0.62, 0.32, 0.17));
  }
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((g) => g.dispose());
  merged.computeVertexNormals();
  return merged;
}

export class CaveLobsters {
  readonly root = new THREE.Group();
  readonly sightings: SightCandidate[] = [];
  private readonly bodies: THREE.InstancedMesh;
  private readonly antennae: THREE.InstancedMesh;
  private readonly heads: THREE.Matrix4[] = [];
  private readonly phases: number[] = [];
  private readonly material = new THREE.MeshStandardMaterial({
    name: 'Spiny lobster',
    vertexColors: true,
    roughness: 0.6,
  });
  private readonly sway = new THREE.Matrix4();
  private readonly scratch = new THREE.Matrix4();
  private time = 0;
  private disposed = false;

  constructor(spots: readonly LobsterSpot[]) {
    this.root.name = 'Spiny lobsters';
    this.bodies = new THREE.InstancedMesh(
      lobsterBody(),
      this.material,
      spots.length,
    );
    this.bodies.name = 'Lobster bodies';
    this.antennae = new THREE.InstancedMesh(
      lobsterAntennae(),
      this.material,
      spots.length,
    );
    this.antennae.name = 'Lobster antennae';
    const q = new THREE.Quaternion(),
      e = new THREE.Euler(),
      m = new THREE.Matrix4(),
      one = new THREE.Vector3(1.3, 1.3, 1.3),
      head = new THREE.Matrix4().makeTranslation(0, 0.09, LOBSTER.length * 0.3);
    spots.forEach((s, i) => {
      e.set(-0.08, s.yaw, 0);
      q.setFromEuler(e);
      const back = LOBSTER.inset;
      m.compose(
        new THREE.Vector3(
          s.x - Math.sin(s.yaw) * back,
          s.y,
          s.z - Math.cos(s.yaw) * back,
        ),
        q,
        one,
      );
      this.bodies.setMatrixAt(i, m);
      const h = m.clone().multiply(head);
      this.heads.push(h);
      this.antennae.setMatrixAt(i, h);
      this.phases.push(i * 1.9);
      this.sightings.push({
        id: CAVE_SIGHTS.lobster.id,
        label: CAVE_SIGHTS.lobster.label,
        position: { x: s.x, y: s.y + 0.1, z: s.z },
        radius: 0.6,
      });
    });
    this.bodies.instanceMatrix.needsUpdate = true;
    this.antennae.instanceMatrix.needsUpdate = true;
    this.root.add(this.bodies, this.antennae);
  }
  /** The antennae sweep slowly, on simulation time only. */
  update(dt: number, active: boolean, reducedMotion: boolean): void {
    if (this.disposed || !active || reducedMotion || !(dt > 0)) return;
    this.time += Math.min(dt, 0.1);
    for (let i = 0; i < this.heads.length; i++) {
      const a =
        LOBSTER.sweep * Math.sin(this.time * LOBSTER.rate + this.phases[i]);
      this.sway.makeRotationY(a);
      this.scratch.multiplyMatrices(this.heads[i], this.sway);
      this.antennae.setMatrixAt(i, this.scratch);
    }
    this.antennae.instanceMatrix.needsUpdate = true;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    this.bodies.geometry.dispose();
    this.antennae.geometry.dispose();
    this.bodies.dispose();
    this.antennae.dispose();
    this.material.dispose();
    this.sightings.length = 0;
  }
}
