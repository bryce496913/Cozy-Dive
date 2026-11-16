import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SightCandidate } from '../../discovery/journal';
import { CAVE_SIGHTS } from '../../discovery/sights';
import type { PlayerPresence } from '../../fish/FishDiverReaction';

/**
 * v0.6 Pass 034/035: spiny lobsters peering out of the cave's cracks, built in code. Each has a
 * spiny reddish-brown carapace with two horns over stalked eyes, banded walking legs, a segmented
 * tail with pale spots and a tail fan, and two long, thick, banded antennae that sweep slowly.
 * When the swimmer comes close a lobster backs quickly into its crack, antennae flicking, and
 * creeps out again once they have gone. Two instanced draws for all of them (bodies, antennae).
 * Owns its geometry and materials.
 */
export const LOBSTER = {
  /** How far each lobster sits back into its crack (m), and how much further it retreats. */
  inset: 0.1,
  retreat: 0.42,
  /** It retreats when the swimmer is within `wary` m; out again after they pass `easy`. */
  wary: 2.6,
  easy: 3.4,
  /** Retreat and emerge rates (fraction per second). */
  backRate: 3.5,
  outRate: 0.3,
  /** Antenna sweep: amplitude (radians) and rate (radians per second), calm and alarmed. */
  sweep: 0.22,
  rate: 0.9,
  alarmedRate: 4,
  /** Size multiplier on the authored body (about 0.45 m from horns to tail fan). */
  scale: 1.25,
} as const;

export interface LobsterSpot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Heading the lobster faces out of its crack (radians about y; 0 faces +z). */
  readonly yaw: number;
}

/** Positions, normals and a flat colour only (non-indexed), so every part merges. */
function part(
  g: THREE.BufferGeometry,
  r: number,
  gr: number,
  b: number,
): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  for (const name of Object.keys(out.attributes))
    if (name !== 'position' && name !== 'normal') out.deleteAttribute(name);
  const n = out.getAttribute('position').count,
    c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const speck = 0.9 + 0.1 * Math.sin(i * 12.9898);
    c[i * 3] = r * speck;
    c[i * 3 + 1] = gr * speck;
    c[i * 3 + 2] = b * speck;
  }
  out.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return out;
}
function tinted(
  g: THREE.BufferGeometry,
  c: readonly [number, number, number],
): THREE.BufferGeometry {
  return part(g, c[0], c[1], c[2]);
}
function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const m = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!m) throw Error('Lobster could not be built');
  m.computeVertexNormals();
  return m;
}
const SHELL = [0.55, 0.2, 0.1] as const,
  DARK = [0.38, 0.13, 0.07] as const,
  PALE = [0.86, 0.72, 0.5] as const,
  LEG = [0.78, 0.55, 0.28] as const;

/** A thin limb from a to b (a tapered cylinder). */
function limb(
  a: THREE.Vector3,
  b: THREE.Vector3,
  r0: number,
  r1: number,
  color: readonly [number, number, number],
): THREE.BufferGeometry {
  const d = b.clone().sub(a),
    g = new THREE.CylinderGeometry(r1, r0, d.length(), 5, 1, false);
  g.translate(0, d.length() / 2, 0);
  g.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      d.normalize(),
    ),
  );
  g.translate(a.x, a.y, a.z);
  return part(g, color[0], color[1], color[2]);
}

/** The body, facing +z, its underside at y 0 (about 0.45 m long). */
export function lobsterBody(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  // Carapace: a long rounded shell, with spines along its top and sides.
  const shell = new THREE.SphereGeometry(1, 14, 10);
  shell.scale(0.065, 0.055, 0.12);
  shell.translate(0, 0.07, 0.07);
  parts.push(part(shell, ...SHELL));
  for (let i = 0; i < 9; i++) {
    const z = 0.0 + i * 0.022,
      side = (i % 3) - 1,
      spine = new THREE.ConeGeometry(0.006, 0.022, 4);
    spine.rotateZ(-side * 0.6);
    spine.translate(side * 0.035, 0.12 - Math.abs(side) * 0.012, z);
    parts.push(part(spine, ...DARK));
  }
  // The two big horns over the eyes, and the eyes on short stalks.
  for (const side of [-1, 1]) {
    const horn = new THREE.ConeGeometry(0.016, 0.07, 6);
    horn.rotateX(Math.PI / 2.4);
    horn.rotateZ(-side * 0.25);
    horn.translate(side * 0.028, 0.12, 0.2);
    parts.push(part(horn, ...SHELL));
    parts.push(
      limb(
        v(side * 0.018, 0.09, 0.18),
        v(side * 0.035, 0.105, 0.2),
        0.006,
        0.005,
        DARK,
      ),
    );
    const eye = new THREE.SphereGeometry(0.011, 8, 6);
    eye.translate(side * 0.038, 0.108, 0.205);
    parts.push(part(eye, 0.04, 0.03, 0.03));
  }
  // The tail: six segments, alternate ones pale-spotted, with little side lappets.
  for (let i = 0; i < 6; i++) {
    const w = 0.058 - i * 0.004,
      seg = new THREE.SphereGeometry(
        1,
        12,
        6,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.6,
      );
    seg.scale(w, 0.038 - i * 0.002, 0.03);
    seg.translate(0, 0.04 - i * 0.002, -0.06 - i * 0.042);
    parts.push(tinted(seg, i % 2 ? PALE : SHELL));
    for (const side of [-1, 1]) {
      const lap = new THREE.BoxGeometry(0.012, 0.025, 0.03);
      lap.translate(side * w, 0.03, -0.06 - i * 0.042);
      parts.push(part(lap, ...DARK));
    }
  }
  // The tail fan: five flaps spread wide.
  for (let k = -2; k <= 2; k++) {
    const flap = new THREE.BoxGeometry(0.035, 0.006, 0.07);
    flap.translate(0, 0, -0.035);
    flap.rotateY(k * 0.38);
    flap.translate(0, 0.03, -0.31);
    parts.push(tinted(flap, k === 0 ? SHELL : DARK));
  }
  // Five pairs of walking legs, jointed, banded: out and up from the body, then down to the rock.
  for (const side of [-1, 1])
    for (let i = 0; i < 5; i++) {
      const z = 0.14 - i * 0.035,
        hip = v(side * 0.04, 0.045, z),
        knee = v(side * (0.11 + i * 0.005), 0.08, z + 0.02 - i * 0.01),
        foot = v(side * (0.16 + i * 0.006), 0.0, z + 0.04 - i * 0.02);
      parts.push(limb(hip, knee, 0.008, 0.006, LEG));
      parts.push(limb(knee, foot, 0.006, 0.003, i % 2 ? PALE : LEG));
    }
  // Small mouthparts under the head.
  parts.push(limb(v(0, 0.04, 0.17), v(0, 0.02, 0.22), 0.01, 0.004, DARK));
  return merged(parts);
}
/** The two long antennae from a pivot at the head (origin), facing +z: thick spiny bases, long whips. */
export function lobsterAntennae(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const points = [
      new THREE.Vector3(side * 0.02, 0, 0),
      new THREE.Vector3(side * 0.07, 0.04, 0.09),
      new THREE.Vector3(side * 0.16, 0.06, 0.24),
      new THREE.Vector3(side * 0.28, 0.04, 0.42),
      new THREE.Vector3(side * 0.4, -0.01, 0.6),
    ];
    // Banded: alternate segments of the whip in pale and dark.
    for (let i = 0; i < points.length - 1; i++) {
      const r0 = 0.016 * (1 - i / points.length) + 0.003,
        r1 = 0.016 * (1 - (i + 1) / points.length) + 0.002;
      parts.push(limb(points[i], points[i + 1], r0, r1, i % 2 ? PALE : SHELL));
    }
    // Spines on the thick base.
    for (let k = 0; k < 4; k++) {
      const at = points[0].clone().lerp(points[1], (k + 0.5) / 4),
        spine = new THREE.ConeGeometry(0.004, 0.018, 3);
      spine.translate(at.x, at.y + 0.012, at.z);
      parts.push(part(spine, ...DARK));
    }
    // A shorter pair of feelers between them.
    parts.push(
      limb(
        new THREE.Vector3(side * 0.008, -0.01, 0.01),
        new THREE.Vector3(side * 0.03, 0.01, 0.11),
        0.003,
        0.0015,
        LEG,
      ),
    );
  }
  return merged(parts);
}

interface Lobster {
  readonly spot: LobsterSpot;
  readonly phase: number;
  /** How far out of its crack it is (1 out, 0 tucked in). */
  out: number;
  wary: boolean;
}

export class CaveLobsters {
  readonly root = new THREE.Group();
  readonly sightings: SightCandidate[] = [];
  private readonly bodies: THREE.InstancedMesh;
  private readonly antennae: THREE.InstancedMesh;
  private readonly lobsters: Lobster[] = [];
  private readonly material = new THREE.MeshStandardMaterial({
    name: 'Spiny lobster',
    vertexColors: true,
    roughness: 0.55,
  });
  private readonly m = new THREE.Matrix4();
  private readonly head = new THREE.Matrix4().makeTranslation(0, 0.1, 0.17);
  private readonly sway = new THREE.Matrix4();
  private readonly scratch = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly at = new THREE.Vector3();
  private readonly size = new THREE.Vector3().setScalar(LOBSTER.scale);
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
    spots.forEach((spot, i) => {
      this.lobsters.push({ spot, phase: i * 1.9, out: 1, wary: false });
      this.sightings.push({
        id: CAVE_SIGHTS.lobster.id,
        label: CAVE_SIGHTS.lobster.label,
        position: { x: spot.x, y: spot.y + 0.1, z: spot.z },
        radius: 0.7,
      });
    });
    this.place();
    this.root.add(this.bodies, this.antennae);
  }
  /** Pose every lobster: how far out of its crack, a slight bob, and its antennae's sweep. */
  private place(): void {
    const t = this.time;
    this.lobsters.forEach((l, i) => {
      const s = l.spot,
        back = LOBSTER.inset + LOBSTER.retreat * (1 - l.out),
        bob = 0.004 * Math.sin(t * 1.3 + l.phase);
      this.e.set(-0.08, s.yaw, 0);
      this.q.setFromEuler(this.e);
      this.at.set(
        s.x - Math.sin(s.yaw) * back,
        s.y + bob,
        s.z - Math.cos(s.yaw) * back,
      );
      this.m.compose(this.at, this.q, this.size);
      this.bodies.setMatrixAt(i, this.m);
      const rate = l.wary ? LOBSTER.alarmedRate : LOBSTER.rate,
        a = LOBSTER.sweep * Math.sin(t * rate + l.phase),
        lift = 0.12 * Math.sin(t * rate * 0.7 + l.phase * 2);
      this.e.set(lift, a, 0);
      this.sway.makeRotationFromEuler(this.e);
      this.scratch.multiplyMatrices(this.m, this.head).multiply(this.sway);
      this.antennae.setMatrixAt(i, this.scratch);
    });
    this.bodies.instanceMatrix.needsUpdate = true;
    this.antennae.instanceMatrix.needsUpdate = true;
  }
  /** Back into the crack when the swimmer comes close, out again slowly; on simulation time. */
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    player: PlayerPresence,
  ): void {
    if (this.disposed || !active || !(dt > 0)) return;
    const step = Math.min(dt, 0.1);
    if (!reducedMotion) this.time += step;
    const p = player.position;
    for (const l of this.lobsters) {
      const d = Math.hypot(p.x - l.spot.x, p.y - l.spot.y, p.z - l.spot.z);
      if (player.active && d < LOBSTER.wary) l.wary = true;
      else if (!player.active || d > LOBSTER.easy) l.wary = false;
      l.out = l.wary
        ? Math.max(0, l.out - LOBSTER.backRate * step)
        : Math.min(1, l.out + LOBSTER.outRate * step);
    }
    this.place();
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
