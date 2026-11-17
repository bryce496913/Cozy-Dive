import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Vec3 } from '../../config/world';
import type { SightCandidate } from '../../discovery/journal';
import { KELP_SIGHTS } from '../../discovery/sights';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import { crabBody } from '../cave/CaveCrabs';
import type { Boulder } from './KelpEnvironment';
import { onBoulder } from './KelpDressing';

/**
 * v0.6 Pass 044: small things to find in the kelp forest, built in code.
 *   - Spanish shawl nudibranchs: violet-blue slugs crowned with bright orange cerata and red
 *     rhinophores, creeping very slowly over the boulders;
 *   - kelp crabs: olive-brown, long-legged, clinging to the kelp stalks low down, climbing a little
 *     way up and down; one that the swimmer comes close to sidles round to the far side of its stalk.
 * One instanced draw each. Allocation-free per frame. Owns its GPU resources.
 */
export const CRITTERS = {
  nudibranchs: 26,
  crabs: 20,
  /** Nudibranch creep (m/s) and size; crab climb range above the seabed (m) and speed (m/s). */
  creep: 0.01,
  slug: 2.2,
  climb: [0.4, 3.5] as const,
  crawl: 0.06,
  crabSize: 1.4,
  /** Crabs sidle round their stalk from a swimmer within this distance (m). */
  wary: 1.6,
} as const;

function painted(
  g: THREE.BufferGeometry,
  rgb: readonly [number, number, number],
): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  for (const name of Object.keys(out.attributes))
    if (name !== 'position' && name !== 'normal') out.deleteAttribute(name);
  const n = out.getAttribute('position').count,
    c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set(rgb, i * 3);
  out.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return out;
}
/** A Spanish shawl, facing +z, its foot at y 0 (about 7 cm long before scaling). */
export function nudibranchGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const body = new THREE.SphereGeometry(1, 12, 8);
  body.scale(0.012, 0.007, 0.035);
  body.translate(0, 0.007, 0);
  parts.push(painted(body, [0.42, 0.28, 0.78]));
  // Orange cerata in clusters down its back.
  for (let i = 0; i < 14; i++) {
    const z = -0.025 + (i / 13) * 0.045,
      side = i % 2 ? 1 : -1,
      c = new THREE.ConeGeometry(0.003, 0.012, 5);
    c.rotateZ(side * 0.5);
    c.translate(side * 0.006, 0.016, z);
    parts.push(painted(c, [0.98, 0.45, 0.08]));
  }
  for (const side of [-1, 1]) {
    const r = new THREE.ConeGeometry(0.0025, 0.012, 5);
    r.rotateX(-0.3);
    r.translate(side * 0.004, 0.017, 0.03);
    parts.push(painted(r, [0.85, 0.12, 0.1]));
  }
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  g.computeVertexNormals();
  return g;
}

interface Slug {
  readonly boulder: Boulder;
  a: number;
  readonly e: number;
  readonly dir: number;
}
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
  private readonly slugMesh: THREE.InstancedMesh;
  private readonly crabMesh: THREE.InstancedMesh;
  private readonly material = new THREE.MeshStandardMaterial({
    name: 'Kelp critters',
    vertexColors: true,
    roughness: 0.5,
  });
  private readonly slugs: Slug[] = [];
  private readonly crabs: Crab[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly n = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly e = new THREE.Euler();
  private seed = 44051;
  private disposed = false;

  constructor(
    boulders: readonly Boulder[],
    stalks: readonly {
      readonly x: number;
      readonly z: number;
      readonly y: number;
    }[],
  ) {
    this.root.name = 'Kelp critters';
    this.slugMesh = new THREE.InstancedMesh(
      nudibranchGeometry(),
      this.material,
      CRITTERS.nudibranchs,
    );
    this.slugMesh.name = 'Spanish shawl nudibranchs';
    const crab = crabBody();
    this.crabMesh = new THREE.InstancedMesh(
      crab,
      this.material,
      CRITTERS.crabs,
    );
    this.crabMesh.name = 'Kelp crabs';
    const olive = new THREE.Color(0.55, 0.62, 0.3);
    for (let i = 0; i < CRITTERS.nudibranchs && boulders.length; i++)
      this.slugs.push({
        boulder: boulders[(i * 7) % boulders.length],
        a: this.random() * Math.PI * 2,
        e: 0.35 + this.random() * 0.8,
        dir: this.random() < 0.5 ? 1 : -1,
      });
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
    this.slugMesh.count = this.slugs.length;
    this.crabMesh.count = this.crabs.length;
    this.slugs.forEach((sl, i) => {
      if (i % 4 === 0) {
        const at = onBoulder(sl.boulder, sl.a, sl.e);
        this.sightings.push({
          ...KELP_SIGHTS.nudibranch,
          position: { x: at.x, y: at.y, z: at.z },
          radius: 0.5,
        });
      }
    });
    this.crabs.forEach((c, i) => {
      if (i % 3 === 0)
        this.sightings.push({
          ...KELP_SIGHTS.kelpCrab,
          position: c.at,
          radius: 0.5,
        });
    });
    this.place();
    this.root.add(this.slugMesh, this.crabMesh);
  }
  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private place(): void {
    this.slugs.forEach((sl, i) => {
      const at = onBoulder(sl.boulder, sl.a, sl.e);
      // Lying on the rock (up along its normal), heading round the boulder.
      this.n.set(at.nx, at.ny, at.nz);
      this.q.setFromUnitVectors(this.up, this.n);
      this.turn.setFromAxisAngle(this.up, -sl.a + (sl.dir > 0 ? 0 : Math.PI));
      this.q.multiply(this.turn);
      this.m.compose(
        this.p.set(at.x, at.y, at.z),
        this.q,
        this.s.setScalar(CRITTERS.slug),
      );
      this.slugMesh.setMatrixAt(i, this.m);
    });
    this.slugMesh.instanceMatrix.needsUpdate = true;
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
    for (const sl of this.slugs)
      sl.a +=
        (sl.dir * CRITTERS.creep * step) /
        Math.max(0.3, sl.boulder.size * 0.46);
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
    this.slugMesh.geometry.dispose();
    this.crabMesh.geometry.dispose();
    this.slugMesh.dispose();
    this.crabMesh.dispose();
    this.material.dispose();
    this.sightings.length = 0;
  }
}
