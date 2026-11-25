import * as THREE from 'three';
import type { Vec3 } from '../../config/world';
import type { SightCandidate } from '../../discovery/journal';
import { KELP_SIGHTS } from '../../discovery/sights';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import { crabBody } from '../cave/CaveCrabs';
import type { Boulder } from './KelpEnvironment';

/**
 * v0.6 Pass 044: small things to find in the kelp forest, built in code.
 * Spanish shawl has moved to the single canonical KelpMinis library.
 *   - kelp crabs: olive-brown, long-legged, clinging to the kelp stalks low down, climbing a little
 *     way up and down; one that the swimmer comes close to sidles round to the far side of its stalk.
 * One instanced crab draw. Allocation-free per frame. Owns its GPU resources.
 */
export const CRITTERS = {
  // Spanish shawl is owned once by KelpMinis (the saved species id is unchanged).
  crabs: 20,
  /** Crab climb range above the seabed (m) and speed (m/s). */

  climb: [0.4, 3.5] as const,
  crawl: 0.06,
  crabSize: 1.4,
  /** Crabs sidle round their stalk from a swimmer within this distance (m). */
  wary: 1.6,
} as const;

interface Crab {
  readonly x: number;
  readonly z: number;
  readonly floor: number;
  y: number;
  goal: number;
  angle: number;
  wait: number;
  readonly at: Vec3;
}

export class KelpCritters {
  readonly root = new THREE.Group();
  readonly sightings: SightCandidate[] = [];
  private readonly crabMesh: THREE.InstancedMesh;
  private readonly material = new THREE.MeshStandardMaterial({
    name: 'Kelp critters',
    vertexColors: true,
    roughness: 0.5,
  });
  private readonly crabs: Crab[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly e = new THREE.Euler();
  private seed = 44051;
  private disposed = false;

  constructor(
    _boulders: readonly Boulder[],
    stalks: readonly {
      readonly x: number;
      readonly z: number;
      readonly y: number;
    }[],
  ) {
    this.root.name = 'Kelp critters';
    const crab = crabBody();
    this.crabMesh = new THREE.InstancedMesh(
      crab,
      this.material,
      CRITTERS.crabs,
    );
    this.crabMesh.name = 'Kelp crabs';
    const olive = new THREE.Color(0.55, 0.62, 0.3);
    const pick = stalks.filter((_, i) => i % 3 === 0);
    for (let i = 0; i < CRITTERS.crabs && pick.length; i++) {
      const st = pick[(i * 5) % pick.length],
        y = st.y + CRITTERS.climb[0] + this.random() * 1.5,
        crab: Crab = {
          x: st.x,
          z: st.z,
          floor: st.y,
          y,
          goal: y,
          angle: this.random() * Math.PI * 2,
          wait: this.random() * 10,
          at: { x: st.x, y, z: st.z },
        };
      this.crabs.push(crab);
      this.crabMesh.setColorAt(i, olive);
    }
    this.crabMesh.count = this.crabs.length;
    this.crabs.forEach((c, i) => {
      if (i % 3 === 0)
        this.sightings.push({
          ...KELP_SIGHTS.kelpCrab,
          position: c.at,
          radius: 0.5,
        });
    });
    this.place();
    this.root.add(this.crabMesh);
  }
  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private place(): void {
    this.crabs.forEach((c, i) => {
      // Clinging to the stalk: its back to the stalk, legs round it, belly out, facing up.
      const r = 0.07;
      c.at.x = c.x + Math.sin(c.angle) * r;
      c.at.y = c.y;
      c.at.z = c.z + Math.cos(c.angle) * r;
      this.e.set(-Math.PI / 2, c.angle, 0, 'YXZ');
      this.q.setFromEuler(this.e);
      this.m.compose(
        this.p.set(c.at.x, c.at.y, c.at.z),
        this.q,
        this.s.setScalar(CRITTERS.crabSize),
      );
      this.crabMesh.setMatrixAt(i, this.m);
    });
    this.crabMesh.instanceMatrix.needsUpdate = true;
  }
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    player: PlayerPresence,
  ): void {
    if (this.disposed || !active || !(dt > 0)) return;
    const step = Math.min(dt, 0.1) * (reducedMotion ? 0.5 : 1),
      e = player.position;
    for (const c of this.crabs) {
      const near =
        player.active &&
        Math.hypot(e.x - c.at.x, e.y - c.at.y, e.z - c.at.z) < CRITTERS.wary;
      if (near) {
        // Round to the far side of the stalk.
        const hide = Math.atan2(c.x - e.x, c.z - e.z),
          off = Math.atan2(Math.sin(hide - c.angle), Math.cos(hide - c.angle));
        c.angle += Math.max(-3 * step, Math.min(3 * step, off));
        continue;
      }
      c.wait -= step;
      if (c.wait <= 0) {
        c.goal =
          c.floor +
          CRITTERS.climb[0] +
          this.random() * (CRITTERS.climb[1] - CRITTERS.climb[0]);
        c.wait = 8 + this.random() * 20;
      }
      const d = c.goal - c.y;
      c.y += Math.sign(d) * Math.min(Math.abs(d), CRITTERS.crawl * step);
    }
    this.place();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    this.crabMesh.geometry.dispose();
    this.crabMesh.dispose();
    this.material.dispose();
    this.sightings.length = 0;
  }
}
