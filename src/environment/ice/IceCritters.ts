import * as THREE from 'three';
import {
  GELATINOUS_PRESETS,
  gelatinousMaterial,
} from '../../rendering/Gelatinous';
import {
  combJellyShape,
  krillShape,
  seaButterflyShape,
} from './IceCritterShapes';
import { ICE } from '../../config/passage';
import type { Vec3 } from '../../config/world';
import { driftAt, krillAt, type IceLimits } from '../../creatures/iceLife';
import type { SightCandidate } from '../../discovery/journal';
import { ICE_SIGHTS } from '../../discovery/sights';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import { dotTexture } from '../shared/MarineSnow';

/**
 * v0.6 Pass 047: the small life under the ice, built in code:
 *   - a krill swarm, a dense, slowly turning pink cloud in the light below a breathing hole, which
 *     parts round a swimmer who swims into it;
 *   - sea butterflies (pteropods), tiny shelled snails rowing with two wing-like lobes, drifting;
 *   - comb jellies, clear little ovals whose comb rows shimmer with travelling rainbow colours;
 *   - giant sea spiders walking slowly over the seabed on eight long, jointed legs;
 *   - ribbon worms, long bright-orange worms gliding over the gravel in slow waves;
 *   - bubbles trailing from diving penguins.
 * One instanced draw per kind (the worms' tubes are one small mesh each, rewritten each frame).
 * Allocation-free per frame. Owns its GPU resources.
 */
export const CRITTERS = {
  krill: 520,
  butterflies: 40,
  jellies: 14,
  spiders: 6,
  worms: 2,
  bubbles: 60,
  /** Krill part round a swimmer within this distance (m). */
  part: 2.2,
} as const;
const LEGS = 8,
  WORM_SEGMENTS = 44,
  WORM_SIDES = 6;

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
interface Spider {
  at: Vec3;
  heading: number;
  turn: number;
  phase: number;
  readonly size: number;
}
interface Worm {
  at: Vec3;
  heading: number;
  phase: number;
  readonly mesh: THREE.Mesh;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
}

export class IceCritters {
  readonly root = new THREE.Group();
  readonly sightings: SightCandidate[] = [];
  /** The krill swarm's centre (it drifts slowly round its light shaft). */
  readonly swarm: Vec3;
  private readonly krill: THREE.InstancedMesh;
  private readonly butterflies: THREE.InstancedMesh;
  private readonly jellies: THREE.InstancedMesh;
  private readonly legs: THREE.InstancedMesh;
  private readonly spiderBodies: THREE.InstancedMesh;
  private readonly bubblePoints: THREE.Points;
  private readonly bubbleAge = new Float32Array(CRITTERS.bubbles);
  private bubbleNext = 0;
  private readonly spiders: Spider[] = [];
  private readonly worms: Worm[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly dot = dotTexture();
  /** Each krill's position this frame. */
  readonly krillPositions: Vec3[] = [];
  private readonly jellyColour = new THREE.Color();
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3();
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly scratch: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly swarmHome: Vec3;
  private time = 0;
  private disposed = false;

  constructor(
    private readonly limits: IceLimits,
    private readonly stones: readonly { x: number; z: number; size: number }[],
  ) {
    this.root.name = 'Under-ice small life';
    const shaft = ICE.holes[0],
      floor = limits.ground(shaft.x, shaft.z);
    this.swarmHome = {
      x: shaft.x + 1.5,
      y: floor + (limits.ceiling - floor) * 0.55,
      z: shaft.z - 1.5,
    };
    this.swarm = { ...this.swarmHome };
    const lit = this.own(
      new THREE.MeshStandardMaterial({
        name: 'Under-ice critters',
        vertexColors: true,
        roughness: 0.5,
      }),
    );
    // V0.7 Pass 078: clear bodies, denser at the rim, comb rows diffracting with the view.
    const clear = this.own(gelatinousMaterial(GELATINOUS_PRESETS.combJelly));
    const instanced = (
      g: THREE.BufferGeometry,
      m: THREE.Material,
      n: number,
      name: string,
    ) => {
      this.geometries.push(g);
      const mesh = new THREE.InstancedMesh(g, m, n);
      mesh.name = name;
      mesh.frustumCulled = false;
      this.root.add(mesh);
      return mesh;
    };
    this.krill = instanced(krillShape(), lit, CRITTERS.krill, 'Krill swarm');
    for (let i = 0; i < CRITTERS.krill; i++)
      this.krillPositions.push({ x: 0, y: 0, z: 0 });
    this.butterflies = instanced(
      // v0.6 Pass 053: the rebuilt sea butterflies, comb jellies and krill.
      seaButterflyShape(),
      lit,
      CRITTERS.butterflies,
      'Sea butterflies',
    );
    this.jellies = instanced(
      combJellyShape(),
      clear,
      CRITTERS.jellies,
      'Comb jellies',
    );
    // Sea spiders: a small body and eight long legs (two segments each, one instanced draw).
    const body = new THREE.SphereGeometry(0.05, 10, 8);
    body.scale(0.7, 0.5, 1.4);
    this.spiderBodies = instanced(
      painted(body, [0.75, 0.6, 0.45]),
      lit,
      CRITTERS.spiders,
      'Sea spider bodies',
    );
    const seg = new THREE.CylinderGeometry(0.008, 0.012, 1, 6);
    seg.translate(0, 0.5, 0);
    this.legs = instanced(
      painted(seg, [0.82, 0.68, 0.5]),
      lit,
      CRITTERS.spiders * LEGS * 2,
      'Sea spider legs',
    );
    for (let i = 0; i < CRITTERS.spiders; i++) {
      const at = this.seabedSpot(i * 7.3);
      this.spiders.push({
        at,
        heading: i * 2.1,
        turn: 0,
        phase: i,
        size: 1.4 + (i % 3) * 0.3,
      });
      if (i % 2 === 0)
        this.sightings.push({
          ...ICE_SIGHTS.seaSpider,
          position: at,
          radius: 0.6,
        });
    }
    // Ribbon worms: a tube rewritten each frame along a travelling wave.
    const wormMaterial = this.own(
      new THREE.MeshStandardMaterial({
        name: 'Ribbon worms',
        color: 0xf27a1a,
        roughness: 0.45,
      }),
    );
    for (let w = 0; w < CRITTERS.worms; w++) {
      const verts = (WORM_SEGMENTS + 1) * WORM_SIDES,
        positions = new Float32Array(verts * 3),
        normals = new Float32Array(verts * 3),
        index: number[] = [];
      for (let j = 0; j < WORM_SEGMENTS; j++)
        for (let s = 0; s < WORM_SIDES; s++) {
          const a0 = j * WORM_SIDES + s,
            b0 = j * WORM_SIDES + ((s + 1) % WORM_SIDES);
          index.push(
            a0,
            a0 + WORM_SIDES,
            b0,
            b0,
            a0 + WORM_SIDES,
            b0 + WORM_SIDES,
          );
        }
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3).setUsage(
          THREE.DynamicDrawUsage,
        ),
      );
      g.setAttribute(
        'normal',
        new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage),
      );
      g.setIndex(index);
      this.geometries.push(g);
      const mesh = new THREE.Mesh(g, wormMaterial);
      mesh.name = 'Ribbon worm';
      mesh.frustumCulled = false;
      this.root.add(mesh);
      const at = this.seabedSpot(31 + w * 13);
      this.worms.push({
        at,
        heading: w * 2.7,
        phase: w,
        mesh,
        positions,
        normals,
      });
      this.sightings.push({
        ...ICE_SIGHTS.ribbonWorm,
        position: at,
        radius: 0.8,
      });
    }
    // Bubbles: a pool of points rising and fading.
    const bubbleGeometry = new THREE.BufferGeometry();
    bubbleGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array(CRITTERS.bubbles * 3).fill(-100),
        3,
      ).setUsage(THREE.DynamicDrawUsage),
    );
    this.geometries.push(bubbleGeometry);
    this.bubbleAge.fill(99);
    this.bubblePoints = new THREE.Points(
      bubbleGeometry,
      this.own(
        new THREE.PointsMaterial({
          name: 'Penguin bubbles',
          color: 0xeaf6ff,
          size: 0.09,
          map: this.dot,
          transparent: true,
          depthWrite: false,
          opacity: 0.8,
        }),
      ),
    );
    this.bubblePoints.frustumCulled = false;
    this.root.add(this.bubblePoints);
    this.sightings.push({
      ...ICE_SIGHTS.krill,
      position: this.swarm,
      radius: 3,
    });
    for (let i = 0; i < 3; i++) {
      this.sightings.push({
        ...ICE_SIGHTS.seaButterfly,
        position: { x: 0, y: 0, z: 0 },
        radius: 1,
      });
      this.sightings.push({
        ...ICE_SIGHTS.combJelly,
        position: { x: 0, y: 0, z: 0 },
        radius: 1,
      });
    }
    this.place(undefined);
  }
  private own<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }
  /** A spot on the open seabed (clear of the stones and the tunnel's mouth), from a seed. */
  private seabedSpot(seed: number): Vec3 {
    const l = this.limits;
    for (let k = 0; k < 30; k++) {
      const x =
          l.minX +
          2 +
          ((((Math.sin(seed * 12.9898 + k * 7.1) * 43758.5453) % 1) + 1) % 1) *
            (l.maxX - l.minX - 4),
        z =
          l.minZ +
          2 +
          ((((Math.sin(seed * 78.233 + k * 3.7) * 12345.678) % 1) + 1) % 1) *
            (l.maxZ - l.minZ - 4);
      if (
        this.onStone(x, z, 0.6) ||
        (Math.abs(x) < 4 && z > ICE.tunnel.wallZ - 8)
      )
        continue;
      return { x, y: l.ground(x, z), z };
    }
    return { x: 0, y: l.ground(0, -30), z: -30 };
  }
  private onStone(x: number, z: number, margin: number): boolean {
    return this.stones.some(
      (s) => Math.hypot(s.x - x, s.z - z) < s.size * 0.6 + margin,
    );
  }
  /** A diving penguin trails a bubble from here. */
  bubble(x: number, y: number, z: number): void {
    const i = this.bubbleNext;
    this.bubbleNext = (this.bubbleNext + 1) % CRITTERS.bubbles;
    this.bubbleAge[i] = 0;
    this.bubblePoints.geometry.getAttribute('position').setXYZ(i, x, y, z);
  }
  /** Walk forward over the seabed, turning away from stones and the walls; true if it moved. */
  private walk(
    at: Vec3,
    heading: number,
    speed: number,
    dt: number,
    avoid: number,
  ): number {
    const nx = at.x + Math.sin(heading) * speed * dt,
      nz = at.z + Math.cos(heading) * speed * dt,
      l = this.limits;
    if (
      this.onStone(nx, nz, avoid) ||
      nx < l.minX + 1 ||
      nx > l.maxX - 1 ||
      nz < l.minZ + 1 ||
      nz > l.maxZ - 1
    )
      return heading + 1.2 * dt + 0.6;
    at.x = nx;
    at.z = nz;
    at.y = l.ground(nx, nz);
    return heading;
  }
  private place(player: PlayerPresence | undefined): void {
    const t = this.time;
    // Krill: the swarm turns slowly; any krill near the swimmer is pushed out round them.
    const e = player?.active ? player.position : undefined;
    for (let i = 0; i < CRITTERS.krill; i++) {
      const k = krillAt(
        i,
        CRITTERS.krill,
        this.swarm,
        t,
        this.krillPositions[i],
      );
      if (e) {
        const dx = k.x - e.x,
          dy = k.y - e.y,
          dz = k.z - e.z,
          d = Math.hypot(dx, dy, dz);
        if (d < CRITTERS.part && d > 1e-4) {
          const push = (CRITTERS.part - d) / d;
          k.x += dx * push;
          k.y += dy * push;
          k.z += dz * push;
        }
      }
      // Facing round the swarm's turn, flickering as they row.
      this.e.set(
        0.2 * Math.sin(t * 9 + i),
        Math.atan2(k.z - this.swarm.z, -(k.x - this.swarm.x)),
        0,
      );
      this.m.compose(
        this.p.set(k.x, k.y, k.z),
        this.q.setFromEuler(this.e),
        this.s.setScalar(2.2),
      );
      this.krill.setMatrixAt(i, this.m);
    }
    this.krill.instanceMatrix.needsUpdate = true;
    // Sea butterflies, rowing (their lobes beating fast), and comb jellies, turning slowly.
    for (let i = 0; i < CRITTERS.butterflies; i++) {
      const h = ICE.holes[i % ICE.holes.length],
        c = this.scratch;
      c.x = h.x;
      c.z = h.z;
      c.y = this.limits.ceiling - 4;
      const d = driftAt(i, c, 5, t, this.scratch),
        flap = 0.55 + 0.45 * Math.abs(Math.sin(t * 7 + i));
      this.m.compose(
        this.p.set(d.x, d.y, d.z),
        this.q.setFromEuler(this.e.set(0, i, 0)),
        this.s.set(3 * flap, 3, 3),
      );
      this.butterflies.setMatrixAt(i, this.m);
      if (i < 3)
        Object.assign(
          this.sightings[this.sightings.length - 6 + i * 2].position,
          d,
        );
    }
    this.butterflies.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < CRITTERS.jellies; i++) {
      const c = this.scratch;
      c.x = (i % 2 ? 1 : -1) * 8;
      c.z = -26 - (i % 3) * 10;
      c.y = this.limits.ceiling - 6;
      const d = driftAt(i + 50, c, 7, t * 0.6, this.scratch);
      this.m.compose(
        this.p.set(d.x, d.y, d.z),
        this.q.setFromEuler(
          this.e.set(0.2 * Math.sin(t * 0.4 + i), t * 0.2 + i, 0),
        ),
        this.s.setScalar(2.4),
      );
      this.jellies.setMatrixAt(i, this.m);
      // Light running along the comb rows: V0.7 Pass 078 keeps it a pale wash, so the body
      // stays clear and the material's view-dependent shimmer carries the rainbow on the combs.
      this.jellies.setColorAt(
        i,
        this.jellyColour.setHSL((t * 0.25 + i * 0.13) % 1, 0.45, 0.88),
      );
      if (i < 3)
        Object.assign(
          this.sightings[this.sightings.length - 5 + i * 2].position,
          d,
        );
    }
    this.jellies.instanceMatrix.needsUpdate = true;
    if (this.jellies.instanceColor)
      this.jellies.instanceColor.needsUpdate = true;
    // Sea spiders: body high on its legs; each leg up to a knee, down to a foot planted on the
    // seabed, stepping in a slow wave.
    this.spiders.forEach((sp, k) => {
      const s = sp.size,
        bodyY = sp.at.y + 0.18 * s;
      this.e.set(0, sp.heading, 0);
      this.m.compose(
        this.p.set(sp.at.x, bodyY, sp.at.z),
        this.q.setFromEuler(this.e),
        this.s.setScalar(s),
      );
      this.spiderBodies.setMatrixAt(k, this.m);
      for (let l = 0; l < LEGS; l++) {
        const side = l < 4 ? 1 : -1,
          along = ((l % 4) - 1.5) * 0.45,
          out = sp.heading + side * (Math.PI / 2) + along,
          step = Math.sin(sp.phase + l * 1.3) * 0.12 * s,
          hipX = sp.at.x + Math.sin(sp.heading) * along * 0.04 * s,
          hipZ = sp.at.z + Math.cos(sp.heading) * along * 0.04 * s,
          footX = hipX + Math.sin(out) * 0.42 * s + Math.sin(sp.heading) * step,
          footZ = hipZ + Math.cos(out) * 0.42 * s + Math.cos(sp.heading) * step,
          kneeX = (hipX + footX) / 2,
          kneeZ = (hipZ + footZ) / 2,
          lift =
            Math.max(0, Math.sin(sp.phase + l * 1.3 + Math.PI / 2)) * 0.05 * s;
        this.a.set(hipX, bodyY, hipZ);
        this.b.set(kneeX, bodyY + 0.16 * s + lift, kneeZ);
        this.segment(k * LEGS * 2 + l * 2, this.a, this.b);
        this.a.set(footX, this.limits.ground(footX, footZ) + lift * 0.5, footZ);
        this.segment(k * LEGS * 2 + l * 2 + 1, this.b, this.a);
      }
    });
    this.spiderBodies.instanceMatrix.needsUpdate = true;
    this.legs.instanceMatrix.needsUpdate = true;
    // Ribbon worms: a slow travelling wave along each worm, lying on the gravel.
    for (const w of this.worms) {
      const len = 1.8,
        cos = Math.cos(w.heading),
        sin = Math.sin(w.heading);
      for (let j = 0; j <= WORM_SEGMENTS; j++) {
        const u = j / WORM_SEGMENTS,
          back = u * len,
          wave = 0.12 * Math.sin(w.phase - u * 9) * (0.3 + u),
          cx = w.at.x - sin * back + cos * wave,
          cz = w.at.z - cos * back - sin * wave,
          cy = this.limits.ground(cx, cz) + 0.02,
          r = 0.018 * (1 - 0.6 * u) + 0.006;
        for (let s = 0; s < WORM_SIDES; s++) {
          const ang = (s / WORM_SIDES) * Math.PI * 2,
            nx = Math.cos(ang) * cos,
            ny = Math.sin(ang),
            nz = -Math.cos(ang) * sin,
            v = (j * WORM_SIDES + s) * 3;
          w.positions[v] = cx + nx * r * 1.6;
          w.positions[v + 1] = cy + ny * r * 0.6;
          w.positions[v + 2] = cz + nz * r * 1.6;
          w.normals[v] = nx;
          w.normals[v + 1] = ny;
          w.normals[v + 2] = nz;
        }
      }
      w.mesh.geometry.getAttribute('position').needsUpdate = true;
      w.mesh.geometry.getAttribute('normal').needsUpdate = true;
    }
  }
  /** One leg segment's instance: a unit cylinder stretched from `from` to `to`. */
  private segment(i: number, from: THREE.Vector3, to: THREE.Vector3): void {
    const len = from.distanceTo(to);
    this.s.subVectors(to, from).normalize();
    this.q.setFromUnitVectors(this.up, this.s);
    this.m.compose(from, this.q, this.s.set(1, len, 1));
    this.legs.setMatrixAt(i, this.m);
  }
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    player: PlayerPresence,
  ): void {
    if (this.disposed || !active || !(dt > 0)) return;
    const step = Math.min(dt, 0.1) * (reducedMotion ? 0.5 : 1);
    this.time += step;
    // The swarm drifts slowly round its light shaft.
    this.swarm.x = this.swarmHome.x + 1.2 * Math.sin(this.time * 0.05);
    this.swarm.z = this.swarmHome.z + 1.2 * Math.cos(this.time * 0.04);
    this.swarm.y = this.swarmHome.y + 0.5 * Math.sin(this.time * 0.07);
    for (const sp of this.spiders) {
      sp.phase += step * 1.6;
      sp.turn +=
        (Math.sin(this.time * 0.05 + sp.size * 7) * 0.3 - sp.turn) * step;
      sp.heading = this.walk(
        sp.at,
        sp.heading + sp.turn * step,
        0.035,
        step,
        0.5,
      );
    }
    for (const w of this.worms) {
      w.phase += step * 2;
      w.heading = this.walk(
        w.at,
        w.heading + Math.sin(this.time * 0.07 + w.phase * 0.01) * 0.1 * step,
        0.025,
        step,
        0.4,
      );
    }
    // Bubbles rise and fade.
    const pos = this.bubblePoints.geometry.getAttribute('position');
    for (let i = 0; i < CRITTERS.bubbles; i++) {
      if (this.bubbleAge[i] > 3) continue;
      this.bubbleAge[i] += step;
      pos.setY(i, pos.getY(i) + step * 1.2);
      if (this.bubbleAge[i] > 3 || pos.getY(i) > this.limits.ceiling - 0.1)
        pos.setXYZ(i, 0, -100, 0);
    }
    pos.needsUpdate = true;
    this.place(player);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    for (const o of this.root.children)
      if (o instanceof THREE.InstancedMesh) o.dispose();
    this.root.clear();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.dot.dispose();
    this.sightings.length = 0;
  }
}
