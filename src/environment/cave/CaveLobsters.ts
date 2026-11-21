import { benthicGait } from './BenthicGait';
import * as THREE from 'three';
import { organicTube, smoothed } from '../shared/organicGeometry';
import { spinyLobsterBody } from './SpinyLobster';
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
 * v0.6 Pass 041: each lives in a den, a dark hole under a hood of rock ringed by stones, and
 * backs right into it out of sight (a third instanced draw for the dens). Owns its geometry and
 * materials.
 */
export const LOBSTER = {
  /** How far each lobster sits back into its crack (m), and how much further it retreats. */
  // v0.6 Pass 041: out, it sits at the mouth of its den; it backs into the dark, out of sight.
  inset: -0.1,
  retreat: 0.72,
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
  // V0.7 Pass 068: creased normals (smooth across gentle bends), kept through the merge.
  const out = smoothed(g);
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
export function tinted(
  g: THREE.BufferGeometry,
  c: readonly [number, number, number],
): THREE.BufferGeometry {
  return part(g, c[0], c[1], c[2]);
}
export function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const m = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!m) throw Error('Lobster could not be built');
  return m;
}
const SHELL = [0.55, 0.2, 0.1] as const,
  DARK = [0.38, 0.13, 0.07] as const,
  PALE = [0.86, 0.72, 0.5] as const,
  LEG = [0.78, 0.55, 0.28] as const;

/** A thin limb from a to b (a tapered cylinder). */
export function limb(
  a: THREE.Vector3,
  b: THREE.Vector3,
  r0: number,
  r1: number,
  color: readonly [number, number, number],
): THREE.BufferGeometry {
  const d = b.clone().sub(a),
    g = new THREE.CylinderGeometry(r1, r0, d.length(), 8, 1, false);
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

type RGB = readonly [number, number, number];
/**
 * V0.7 Pass 078: one exoskeleton segment (podomere) from joint `a` to joint `b`, as a crustacean's
 * is: it leaves the previous segment through a narrow, darker articular membrane, swells into a
 * slightly flattened shaft, and ends in a flared, paler rim, the socket the next segment seats
 * into. Chained, the segments overlap at every joint like real articulation instead of meeting as
 * plain cylinders. Smooth, vertex-coloured, non-indexed (merges with the other parts).
 */
export function podomere(
  a: THREE.Vector3,
  b: THREE.Vector3,
  r0: number,
  r1: number,
  shell: RGB,
  rim: RGB = shell,
  membrane: RGB = [shell[0] * 0.55, shell[1] * 0.55, shell[2] * 0.55],
  sides = 8,
  bow = 0.06,
): THREE.BufferGeometry {
  const d = b.clone().sub(a),
    len = d.length(),
    dir = d.clone().normalize(),
    // A slight outward bow, so long segments are not ruler-straight.
    side = new THREE.Vector3(0, 1, 0).cross(dir),
    mid = a
      .clone()
      .lerp(b, 0.5)
      .addScaledVector(
        side.lengthSq() > 1e-8 ? side.normalize() : new THREE.Vector3(1, 0, 0),
        len * bow * 0.3,
      )
      .add(new THREE.Vector3(0, len * bow, 0)),
    radius = (u: number) => {
      const shaft = r0 + (r1 - r0) * u,
        neck = 0.7 + 0.3 * Math.min(1, u / 0.16),
        flare = 1 + 0.16 * Math.exp(-(((u - 0.9) / 0.06) ** 2));
      return shaft * neck * flare * (1 + 0.05 * Math.sin(u * Math.PI));
    };
  const g = smoothed(
      organicTube([a, mid, b], radius, 14, sides, 0.82),
      Math.PI / 2,
    ),
    pos = g.getAttribute('position'),
    col = new Float32Array(pos.count * 3),
    q = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    q.fromBufferAttribute(pos, i).sub(a);
    const u = Math.min(1, Math.max(0, q.dot(dir) / len)),
      m = Math.max(0, 1 - u / 0.14),
      r = Math.exp(-(((u - 0.92) / 0.05) ** 2)),
      speck = 0.92 + 0.08 * Math.sin(i * 12.9898);
    for (let k = 0; k < 3; k++)
      col[i * 3 + k] =
        (shell[k] * (1 - m - r) + membrane[k] * m + rim[k] * r) * speck;
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
/** Podomeres along a chain of joints, tapering from `r0` to `r1`, alternately banded. */
export function articulated(
  joints: readonly THREE.Vector3[],
  r0: number,
  r1: number,
  shell: RGB,
  band: RGB,
  sides = 8,
): THREE.BufferGeometry[] {
  const n = joints.length - 1;
  return joints.slice(0, -1).map((j, i) =>
    podomere(
      j,
      // Each segment seats a little inside the previous one's flared rim.
      joints[i + 1].clone().lerp(j, i === n - 1 ? 0 : -0.04),
      r0 + ((r1 - r0) * i) / n,
      r0 + ((r1 - r0) * (i + 1)) / n,
      i % 2 ? band : shell,
      band,
      undefined,
      sides,
    ),
  );
}

/**
 * The two long antennae from a pivot at the head (origin), facing +z. V0.7 Pass 078: three thick,
 * spiny, articulated basal segments, then a long annulated whip (a continuous surface ringed every
 * centimetre, banded in groups), and a short pair of feelers.
 */
export function lobsterAntennae(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const base = [
      new THREE.Vector3(side * 0.02, 0, 0),
      new THREE.Vector3(side * 0.045, 0.022, 0.045),
      new THREE.Vector3(side * 0.072, 0.04, 0.095),
      new THREE.Vector3(side * 0.1, 0.05, 0.15),
    ];
    parts.push(...articulated(base, 0.017, 0.011, SHELL, PALE, 9));
    // Spines along the thick base, raked forward.
    for (let k = 0; k < 6; k++) {
      const s = Math.floor(k / 2),
        at = base[s].clone().lerp(base[s + 1], 0.35 + (k % 2) * 0.35),
        spine = new THREE.ConeGeometry(0.0035, 0.016, 5);
      spine.rotateX(0.5);
      spine.translate(at.x, at.y + 0.013 - s * 0.002, at.z);
      parts.push(part(spine, ...DARK));
    }
    // The whip: one smooth, ringed surface sweeping out and down.
    const whip = [
        base[3],
        new THREE.Vector3(side * 0.16, 0.062, 0.24),
        new THREE.Vector3(side * 0.28, 0.045, 0.42),
        new THREE.Vector3(side * 0.4, -0.01, 0.6),
      ],
      rings = 60,
      w = smoothed(
        organicTube(
          whip,
          (u) =>
            (0.0095 - 0.0072 * u) *
            (1 + 0.11 * Math.abs(Math.sin(u * Math.PI * rings))),
          rings * 3,
          6,
        ),
      ),
      wp = w.getAttribute('position'),
      wc = new Float32Array(wp.count * 3),
      q = new THREE.Vector3(),
      start = whip[0];
    for (let i = 0; i < wp.count; i++) {
      const u = Math.min(
          1,
          q.fromBufferAttribute(wp, i).distanceTo(start) / 0.62,
        ),
        c = Math.floor(u * 9) % 2 ? PALE : SHELL;
      wc.set([c[0], c[1], c[2]], i * 3);
    }
    w.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3));
    parts.push(w);
    // A shorter pair of feelers between them.
    parts.push(
      ...articulated(
        [
          new THREE.Vector3(side * 0.008, -0.01, 0.01),
          new THREE.Vector3(side * 0.018, 0.0, 0.06),
          new THREE.Vector3(side * 0.03, 0.01, 0.11),
        ],
        0.0035,
        0.0018,
        LEG,
        PALE,
        6,
      ),
    );
  }
  return merged(parts);
}

/** v0.6 Pass 041: den size: the mouth's half-width and height, and its depth to the dark (m). */
export const DEN = { half: 0.32, high: 0.27, deep: 0.36, rim: 9 } as const;
const STONE = [0.5, 0.47, 0.41] as const,
  STONE_DARK = [0.3, 0.28, 0.24] as const,
  HOLE = [0.025, 0.022, 0.02] as const;

/** Both windings of a triangle list, so it shows from either side (small, so cheap). */
function twoSided(
  points: readonly number[],
  color: readonly [number, number, number],
): THREE.BufferGeometry {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 9)
    out.push(
      ...points.slice(i, i + 9),
      ...points.slice(i, i + 3),
      ...points.slice(i + 6, i + 9),
      ...points.slice(i + 3, i + 6),
    );
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  return tinted(g, color);
}

/**
 * A lobster's den, facing +z with its mouth at z 0 and its floor at y 0: a lumpy hood of rock
 * arching over a dark hole that runs back `DEN.deep` m into the rock, closed by darkness, with
 * stones heaped round the mouth.
 */
export function lobsterDen(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    { half, high, deep } = DEN,
    arc = 10,
    lump = (a: number, z: number) =>
      1 + 0.12 * Math.sin(a * 5.3 + z * 9) + 0.08 * Math.sin(a * 11.7 - z * 4),
    ring = (a: number, z: number, r: number): [number, number, number] => [
      Math.cos(a) * half * r * lump(a, z),
      Math.sin(a) * high * r * lump(a, z),
      z,
    ];
  // The dark inside of the hole (a half tube) and the darkness at its back.
  const inside: number[] = [],
    hood: number[] = [],
    back: number[] = [],
    zs = [0.03, -deep * 0.5, -deep];
  for (let i = 0; i < arc; i++) {
    const a0 = (i / arc) * Math.PI,
      a1 = ((i + 1) / arc) * Math.PI;
    for (let j = 0; j < zs.length - 1; j++) {
      const p = [
        ring(a0, zs[j], 1),
        ring(a1, zs[j], 1),
        ring(a1, zs[j + 1], 1),
        ring(a0, zs[j + 1], 1),
      ];
      inside.push(...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]);
      // Its rock hood: the same arch, thicker and rougher, a little further out.
      const q = [
        ring(a0, zs[j] + 0.04, 1.45),
        ring(a1, zs[j] + 0.04, 1.45),
        ring(a1, zs[j + 1], 1.5),
        ring(a0, zs[j + 1], 1.5),
      ];
      hood.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
    }
    // The hood's lip, closing the gap between it and the hole at the mouth.
    const l = [
      ring(a0, 0.03, 1),
      ring(a1, 0.03, 1),
      ring(a1, 0.07, 1.45),
      ring(a0, 0.07, 1.45),
    ];
    hood.push(...l[0], ...l[1], ...l[2], ...l[0], ...l[2], ...l[3]);
    back.push(0, 0, -deep, ...ring(a0, -deep, 1), ...ring(a1, -deep, 1));
  }
  // The hole's floor, dark too.
  inside.push(
    -half,
    0.002,
    0.03,
    half,
    0.002,
    0.03,
    half,
    0.002,
    -deep,
    -half,
    0.002,
    0.03,
    half,
    0.002,
    -deep,
    -half,
    0.002,
    -deep,
  );
  parts.push(
    twoSided(inside, HOLE),
    twoSided(back, HOLE),
    twoSided(hood, STONE),
  );
  // Stones heaped round the mouth and along the hood.
  for (let i = 0; i < DEN.rim; i++) {
    const a = -0.15 + (i / (DEN.rim - 1)) * (Math.PI + 0.3),
      r = 0.05 + 0.03 * Math.abs(Math.sin(i * 2.7)),
      stone = new THREE.IcosahedronGeometry(r, 0);
    stone.scale(1.3, 0.8, 1);
    stone.rotateY(i * 1.7);
    const [x, y] = ring(a, 0.05, 1.55);
    stone.translate(x, Math.max(r * 0.5, y), 0.06 + 0.03 * Math.sin(i * 1.3));
    parts.push(tinted(stone, i % 3 ? STONE : STONE_DARK));
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
  private readonly gait: THREE.InstancedBufferAttribute;
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly bodies: THREE.InstancedMesh;
  private readonly antennae: THREE.InstancedMesh;
  private readonly dens: THREE.InstancedMesh;
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
    this.bodyMaterial = this.material.clone();
    benthicGait(this.bodyMaterial, 0.07);
    this.gait = new THREE.InstancedBufferAttribute(
      new Float32Array(spots.length * 2),
      2,
    );
    this.bodies = new THREE.InstancedMesh(
      // v0.6 Pass 053: the rebuilt spiny lobster.
      spinyLobsterBody(),
      this.bodyMaterial,
      spots.length,
    );
    this.bodies.name = 'Lobster bodies';
    this.bodies.geometry.setAttribute('legGait', this.gait);
    this.antennae = new THREE.InstancedMesh(
      lobsterAntennae(),
      this.material,
      spots.length,
    );
    this.antennae.name = 'Lobster antennae';
    this.dens = new THREE.InstancedMesh(
      lobsterDen(),
      this.material,
      spots.length,
    );
    this.dens.name = 'Lobster dens';
    spots.forEach((spot, i) => {
      this.e.set(0, spot.yaw, 0);
      this.q.setFromEuler(this.e);
      this.at.set(spot.x, spot.y - 0.02, spot.z);
      this.m.compose(this.at, this.q, this.size.set(1, 1, 1));
      this.dens.setMatrixAt(i, this.m);
    });
    this.size.setScalar(LOBSTER.scale);
    this.dens.instanceMatrix.needsUpdate = true;
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
    this.root.add(this.bodies, this.antennae, this.dens);
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
      this.gait.setXY(
        i,
        t * (l.wary ? 15 : 6) + l.phase,
        l.out > 0.01 && l.out < 0.99 ? 1 : 0,
      );
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
    this.gait.needsUpdate = true;
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
    this.dens.geometry.dispose();
    this.bodies.dispose();
    this.antennae.dispose();
    this.dens.dispose();
    this.material.dispose();
    this.bodyMaterial.dispose();
    this.sightings.length = 0;
  }
}
