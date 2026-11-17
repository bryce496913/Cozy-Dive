import * as THREE from 'three';
import type { Vec3 } from '../../config/world';
import type { SightCandidate } from '../../discovery/journal';
import { CAVE_SIGHTS } from '../../discovery/sights';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import type { CaveRock } from './CaveEnvironment';
import { limb, merged, tinted } from './CaveLobsters';
import { caveFloor } from './CaveTerrain';

/**
 * v0.6 Pass 041: small rock crabs picking their way round the feet of the cave's boulders, built
 * in code. Each walks sideways round its rock in short bouts, pausing between them; when the
 * swimmer comes close it scuttles quickly round to the far side of the rock, and stays there
 * until they have gone. One instanced draw for all of them. Pure motion on simulation time,
 * allocation-free per frame. Owns its geometry and material.
 */
export const CRAB = {
  /** How far out from the rock's centre it walks, as a share of the rock's footprint, plus m. */
  reach: 0.55,
  clear: 0.12,
  /** Walking and scuttling speeds round the rock (m/s). */
  walk: 0.09,
  scuttle: 0.75,
  /** Bouts of walking and pauses (s). */
  bout: [1.5, 4] as const,
  pause: [2, 7] as const,
  /** Scuttles off when the swimmer is within `wary` m; calm again beyond `easy` m. */
  wary: 2.4,
  easy: 3.6,
  /** Size multiplier on the authored body (about 0.16 m across the shell). */
  scale: 1.5,
} as const;

const SHELL = [0.62, 0.24, 0.12] as const,
  DARK = [0.35, 0.12, 0.06] as const,
  CLAW = [0.78, 0.36, 0.18] as const,
  TIP = [0.12, 0.08, 0.06] as const;

/** A crab facing +z (walking sideways along x), its underside at y 0. */
export function crabBody(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  // A broad, flattened shell, bumpy at its front edge.
  const shell = new THREE.SphereGeometry(1, 14, 8);
  shell.scale(0.08, 0.032, 0.06);
  shell.translate(0, 0.045, 0);
  parts.push(tinted(shell, SHELL));
  for (let i = -2; i <= 2; i++) {
    const bump = new THREE.SphereGeometry(0.012, 6, 4);
    bump.translate(i * 0.025, 0.06, 0.045 - Math.abs(i) * 0.006);
    parts.push(tinted(bump, DARK));
  }
  for (const side of [-1, 1]) {
    // Eyes on stalks.
    parts.push(
      limb(
        v(side * 0.015, 0.06, 0.05),
        v(side * 0.02, 0.085, 0.062),
        0.004,
        0.003,
        DARK,
      ),
    );
    const eye = new THREE.SphereGeometry(0.007, 6, 4);
    eye.translate(side * 0.02, 0.088, 0.064);
    parts.push(tinted(eye, TIP));
    // A claw: an arm out and forward, and a fat pincer with a dark tip.
    const elbow = v(side * 0.085, 0.05, 0.07),
      wrist = v(side * 0.06, 0.04, 0.115);
    parts.push(limb(v(side * 0.05, 0.04, 0.04), elbow, 0.01, 0.009, CLAW));
    parts.push(limb(elbow, wrist, 0.009, 0.008, CLAW));
    const palm = new THREE.SphereGeometry(1, 8, 6);
    palm.scale(0.02, 0.016, 0.03);
    palm.translate(wrist.x, wrist.y, wrist.z + 0.02);
    parts.push(tinted(palm, CLAW));
    parts.push(
      limb(
        v(wrist.x, wrist.y + 0.004, wrist.z + 0.045),
        v(wrist.x - side * 0.01, wrist.y, wrist.z + 0.07),
        0.006,
        0.002,
        TIP,
      ),
    );
    // Four walking legs: up and out to a knee, then down to the rock.
    for (let i = 0; i < 4; i++) {
      const z = 0.03 - i * 0.025,
        hip = v(side * 0.065, 0.04, z),
        knee = v(side * 0.13, 0.075, z - i * 0.01),
        foot = v(side * 0.17, 0, z - 0.01 - i * 0.02);
      parts.push(limb(hip, knee, 0.007, 0.005, SHELL));
      parts.push(limb(knee, foot, 0.005, 0.002, i % 2 ? DARK : SHELL));
    }
  }
  return merged(parts);
}

interface Crab {
  readonly rock: CaveRock;
  readonly radius: number;
  /** Where round the rock it is (radians: 0 is +z of the rock's centre). */
  angle: number;
  /** Walking direction round the rock (+1 or -1), and how long until it walks or pauses. */
  dir: number;
  walking: boolean;
  left: number;
  wary: boolean;
  readonly phase: number;
  readonly at: Vec3;
}

export class CaveCrabs {
  readonly root = new THREE.Group();
  readonly sightings: SightCandidate[] = [];
  private readonly mesh: THREE.InstancedMesh;
  private readonly crabs: Crab[] = [];
  private readonly material = new THREE.MeshStandardMaterial({
    name: 'Rock crab',
    vertexColors: true,
    roughness: 0.6,
  });
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3();
  private readonly size = new THREE.Vector3().setScalar(CRAB.scale);
  private time = 0;
  private seed = 41077;
  private disposed = false;

  constructor(rocks: readonly CaveRock[], count: number) {
    this.root.name = 'Rock crabs';
    this.mesh = new THREE.InstancedMesh(crabBody(), this.material, count);
    this.mesh.name = 'Rock crab bodies';
    for (let i = 0; i < count && rocks.length; i++) {
      const rock = rocks[(i * 5) % rocks.length],
        crab: Crab = {
          rock,
          radius: rock.size * CRAB.reach + CRAB.clear,
          angle: this.random() * Math.PI * 2,
          dir: this.random() < 0.5 ? 1 : -1,
          walking: false,
          left: this.between(CRAB.pause),
          wary: false,
          phase: this.random() * 6.3,
          at: { x: 0, y: 0, z: 0 },
        };
      this.crabs.push(crab);
      this.sightings.push({
        id: CAVE_SIGHTS.crab.id,
        label: CAVE_SIGHTS.crab.label,
        position: crab.at,
        radius: 0.8,
      });
    }
    this.mesh.count = this.crabs.length;
    this.place();
    this.root.add(this.mesh);
  }
  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private between(range: readonly [number, number]): number {
    return range[0] + this.random() * (range[1] - range[0]);
  }
  private place(): void {
    this.crabs.forEach((c, i) => {
      const x = c.rock.x + Math.sin(c.angle) * c.radius,
        z = c.rock.z + Math.cos(c.angle) * c.radius,
        moving = c.walking || c.wary,
        bob = moving ? 0.004 * Math.abs(Math.sin(this.time * 14 + c.phase)) : 0;
      c.at.x = x;
      c.at.y = caveFloor(x, z) + bob;
      c.at.z = z;
      // Facing out from the rock, so it walks sideways round it; a slight tilt as it steps.
      this.e.set(
        0,
        c.angle,
        moving ? 0.06 * Math.sin(this.time * 14 + c.phase) : 0,
      );
      this.q.setFromEuler(this.e);
      this.p.set(c.at.x, c.at.y, c.at.z);
      this.m.compose(this.p, this.q, this.size);
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  /** Walk round the rocks, pause, and scuttle round out of sight of a close swimmer. */
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    player: PlayerPresence,
  ): void {
    if (this.disposed || !active || !(dt > 0)) return;
    const step = Math.min(dt, 0.1),
      e = player.position;
    this.time += reducedMotion ? 0 : step;
    for (const c of this.crabs) {
      const d = Math.hypot(e.x - c.at.x, e.y - c.at.y, e.z - c.at.z);
      if (player.active && d < CRAB.wary) c.wary = true;
      else if (!player.active || d > CRAB.easy) {
        if (c.wary) {
          c.wary = false;
          c.walking = false;
          c.left = this.between(CRAB.pause);
        }
      }
      if (c.wary) {
        // Round to the far side of its rock from the swimmer.
        const hide = Math.atan2(c.rock.x - e.x, c.rock.z - e.z),
          off = Math.atan2(Math.sin(hide - c.angle), Math.cos(hide - c.angle)),
          most = (CRAB.scuttle * (reducedMotion ? 0.5 : 1) * step) / c.radius;
        c.angle += Math.max(-most, Math.min(most, off));
        continue;
      }
      c.left -= step;
      if (c.left <= 0) {
        c.walking = !c.walking;
        c.left = this.between(c.walking ? CRAB.bout : CRAB.pause);
        if (c.walking && this.random() < 0.4) c.dir = -c.dir;
      }
      if (c.walking) c.angle += (c.dir * CRAB.walk * step) / c.radius;
    }
    this.place();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    this.mesh.geometry.dispose();
    this.mesh.dispose();
    this.material.dispose();
    this.sightings.length = 0;
  }
}
