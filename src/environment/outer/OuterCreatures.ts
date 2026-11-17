import { creatureStroke } from '../creatureStroke';
import * as THREE from 'three';
import type { AssetLease, AssetLoader } from '../../assets/AssetLoader';
import {
  CRUISE_SPECIES,
  CRUISING,
  cruiseSize,
  type BigCreatureId,
} from '../../config/creatures';
import { OUTER } from '../../config/passage';
import type { Vec3 } from '../../config/world';
import {
  CruiseRoute,
  Cruiser,
  liftRoute,
  sampleLoop,
  type CruiserPlacement,
  type Obstacles,
} from '../../creatures/cruising';
import type { SightCandidate } from '../../discovery/journal';
import { creatureSight } from '../../discovery/sights';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import { ROCK_HALF, type ReefPlacement } from './OuterReefLayout';
import { seabedHeight } from './OuterTerrain';

/**
 * The outer reef's big creatures: three sharks on distinct patrol depths, four eagle rays
 * and two turtles along the wall. Larger adults and broad, gently rising routes make the
 * blue feel inhabited. Their routes are lifted over everything
 * beneath them (`reefObstacles`), and they give the swimmer room (see `Cruiser`).
 */

/** How tall and wide each kind of reef piece is, per unit of scale (measured from the library). */
const REACH: Partial<
  Record<ReefPlacement['family'], { top: number; reach: number }>
> = {
  branching: { top: 2.1, reach: 0.85 },
  massive: { top: 1.25, reach: 0.78 },
  plate: { top: 2.0, reach: 0.82 },
  soft: { top: 1.05, reach: 0.4 },
  fan: { top: 1.05, reach: 0.4 },
  grass: { top: 1.0, reach: 0.2 },
  blade: { top: 1.0, reach: 0.2 },
};
/**
 * The highest thing near each point of the outer waters: the seabed, and every rock, coral and
 * plant of the layout (shells and rubble are too low to matter). A 1 m grid, built once.
 */
export function reefObstacles(placements: readonly ReefPlacement[]): Obstacles {
  const b = OUTER.bounds,
    nx = Math.ceil(b.max.x - b.min.x) + 1,
    nz = Math.ceil(b.max.z - b.min.z) + 1,
    tops = new Float32Array(nx * nz);
  for (let i = 0; i < nx; i++)
    for (let k = 0; k < nz; k++)
      tops[k * nx + i] = seabedHeight(b.min.x + i, b.min.z + k);
  const stamp = (x: number, z: number, reach: number, top: number) => {
    const i0 = Math.max(0, Math.floor(x - reach - b.min.x)),
      i1 = Math.min(nx - 1, Math.ceil(x + reach - b.min.x)),
      k0 = Math.max(0, Math.floor(z - reach - b.min.z)),
      k1 = Math.min(nz - 1, Math.ceil(z + reach - b.min.z));
    for (let k = k0; k <= k1; k++)
      for (let i = i0; i <= i1; i++)
        if (
          Math.hypot(b.min.x + i - x, b.min.z + k - z) <= reach + 0.71 &&
          tops[k * nx + i] < top
        )
          tops[k * nx + i] = top;
  };
  for (const p of placements) {
    const s = p.scale;
    if (p.family === 'rock' || p.family === 'backdrop')
      stamp(
        p.position.x,
        p.position.z,
        ROCK_HALF * Math.max(s.x, s.z) * 1.1,
        p.position.y + ROCK_HALF * s.y,
      );
    else {
      const r = REACH[p.family];
      if (r)
        stamp(
          p.position.x,
          p.position.z,
          r.reach * Math.max(s.x, s.z),
          p.position.y + r.top * s.y,
        );
    }
  }
  return (x, z, radius) => {
    let top = -Infinity;
    const i0 = Math.max(0, Math.floor(x - radius - b.min.x)),
      i1 = Math.min(nx - 1, Math.ceil(x + radius - b.min.x)),
      k0 = Math.max(0, Math.floor(z - radius - b.min.z)),
      k1 = Math.min(nz - 1, Math.ceil(z + radius - b.min.z));
    for (let k = k0; k <= k1; k++)
      for (let i = i0; i <= i1; i++) top = Math.max(top, tops[k * nx + i]);
    return Number.isFinite(top) ? top : seabedHeight(x, z);
  };
}

export interface CruiseGroup {
  readonly species: BigCreatureId;
  readonly scale?: number;
  /** Loop waypoints; their heights are minimums (the route is lifted over the reef). */
  readonly waypoints: readonly Vec3[];
  readonly members: readonly CruiserPlacement[];
  /** v0.6 Pass 032: a colour multiplied into the model's own (e.g. the bat ray's dark back). */
  readonly tint?: number;
}
/** An oval of `n` waypoints at height `y(x, z)`, travelled anticlockwise seen from above. */
export function oval(
  cx: number,
  cz: number,
  rx: number,
  rz: number,
  y: (x: number, z: number) => number,
  n = 12,
): Vec3[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2,
      x = cx + Math.cos(a) * rx,
      z = cz - Math.sin(a) * rz;
    return { x, y: y(x, z), z };
  });
}
/**
 * v0.6 Pass 043: the deepest any big animal passes (its body's middle, m). The swimmer eases to a
 * stop not far below the reef's lip, so everything passes where it can be seen from there.
 */
export const PASSING_DEEPEST = -8;
/**
 * Pass 026: they live in the blue just off the wall, on long loops parallel to it, so a swimmer
 * hovering past the lip sees something pass every half-minute or so. Loop lengths at their
 * speeds: sharks about 2 minutes, rays about 2.5, turtles about 2. Distinct depth bands
 * and wider turns leave room for the larger bodies. The viewing-edge adjustment brings each
 * loop 4 m shoreward so creatures pass closer to a swimmer resting at the lip.
 */
export const OUTER_CRUISERS: readonly CruiseGroup[] = [
  {
    // Mid-water, a little way out.
    species: 'blacktip-reef-shark',
    scale: 1.1,
    // v0.6 Pass 043: above the deeper patrols, now they are all within sight.
    waypoints: oval(0, -71, 30, 8, (x) => 1.5 + 0.3 * Math.sin(x * 0.09)),
    members: [{ start: 0, side: 0, up: 0, phase: 0 }],
  },
  {
    // Deeper and further out, fading into the dark.
    species: 'blacktip-reef-shark',
    scale: 1.15,
    // v0.6 Pass 043: no deeper than the swimmer can see (was 15 m down).
    waypoints: oval(6, -74, 26, 8, (x) => -5.5 + 0.5 * Math.sin(x * 0.08 + 1)),
    members: [{ start: 60, side: 0, up: 0, phase: 1.7 }],
  },
  {
    // A larger adult passes near the wall, above the deeper patrols: visible from the lip.
    species: 'blacktip-reef-shark',
    scale: 1.2,
    waypoints: oval(-6, -69, 24, 7, (x) => 7 + 0.5 * Math.sin(x * 0.1)),
    members: [{ start: 35, side: 0, up: 0, phase: 3.4 }],
  },
  {
    // A loose line gliding along the wall just below the lip.
    species: 'spotted-eagle-ray',
    scale: 1.15,
    waypoints: oval(-4, -69, 26, 9, () => -2.5),
    members: [
      { start: 0, side: 0, up: 0, phase: 0 },
      { start: -8.5, side: 1, up: 0.6, phase: 2.1 },
      { start: -17, side: -1, up: 1.1, phase: 4.2 },
      { start: -25.5, side: 0.5, up: 1.6, phase: 5.6 },
    ],
  },
  {
    // Along the wall's face below the lip.
    species: 'green-sea-turtle',
    scale: 1.2,
    waypoints: oval(-10, -63.5, 14, 3.5, (x) => -4.5 + 0.3 * Math.sin(x * 0.1)),
    members: [{ start: 0, side: 0, up: 0, phase: 0.8 }],
  },
  {
    // A second turtle follows a separate, deeper loop, with an independent glide rhythm.
    species: 'green-sea-turtle',
    scale: 1.05,
    waypoints: oval(8, -64, 12, 3.5, (x) => -6 + 0.3 * Math.sin(x * 0.1 + 1)),
    members: [{ start: 20, side: 0, up: 0, phase: 3.7 }],
  },
];

/** Cruisers for the groups: routes sampled and lifted over `obstacles` (pure, deterministic). */
export function outerCruisers(
  obstacles: Obstacles,
  groups: readonly CruiseGroup[] = OUTER_CRUISERS,
): Cruiser[] {
  return groups.flatMap((g) => {
    // Without a group scale, the species' own size (Pass 033: whales are far beyond 1.5).
    const base = CRUISE_SPECIES[g.species],
      species = g.scale === undefined ? base : cruiseSize(base, g.scale),
      lane = Math.max(...g.members.map((m) => Math.abs(m.side))),
      route = new CruiseRoute(
        liftRoute(
          sampleLoop(g.waypoints),
          obstacles,
          // Half a metre more sideways covers the straight steps between route samples.
          species.radius + lane + CRUISING.step,
          species.clearance,
        ),
      );
    return g.members.map((m) => new Cruiser(species, route, m));
  });
}

interface Rig {
  readonly cruiser: Cruiser;
  readonly root: THREE.Group;
  readonly near: THREE.Mesh;
  readonly far: THREE.Mesh;
  readonly left: number;
  readonly right: number;
  isNear: boolean;
}
/** Draws the cruisers with their authored models (leased from the shared fish loader). */
export class OuterCreatures {
  readonly root = new THREE.Group();
  readonly cruisers: readonly Cruiser[];
  /** One per creature, following it; empty until the models have loaded. */
  readonly sightings: SightCandidate[] = [];
  readonly ready: Promise<boolean>;
  /** v0.6 Pass 033: which group each cruiser belongs to (by index into the groups given). */
  readonly groupOf: readonly number[];
  private rigs: Rig[] = [];
  private leases: AssetLease[] = [];
  private readonly eye = new THREE.Vector3();
  /** Tinted copies of the models' materials (owned here; the originals stay shared). */
  private readonly tinted: THREE.Material[] = [];
  private readonly tints: readonly (number | undefined)[];
  private disposed = false;
  constructor(
    obstacles: Obstacles,
    private readonly loader: AssetLoader,
    /** v0.6 Pass 032: other waters bring their own creatures and routes. */
    groups: readonly CruiseGroup[] = OUTER_CRUISERS,
    name = 'Outer reef big creatures',
  ) {
    this.root.name = name;
    this.cruisers = outerCruisers(obstacles, groups);
    this.tints = groups.flatMap((g) => g.members.map(() => g.tint));
    this.groupOf = groups.flatMap((g, i) => g.members.map(() => i));
    this.ready = this.load();
  }
  private async load(): Promise<boolean> {
    const results = await Promise.allSettled(
      this.cruisers.map((c) => this.loader.acquire(c.species.asset)),
    );
    this.leases = results.flatMap((r) =>
      r.status === 'fulfilled' ? [r.value] : [],
    );
    const failed = results.find((r) => r.status === 'rejected');
    if (this.disposed || failed) {
      if (failed?.status === 'rejected' && !this.disposed)
        console.error(
          'Cozy Diver: the big creatures could not be loaded.',
          failed.reason,
        );
      this.release();
      return false;
    }
    this.rigs = this.cruisers.map((cruiser, i) => {
      const model = this.leases[i].model,
        near = model.getObjectByName('Body'),
        far = model.getObjectByName('Body_LOD1');
      if (!(near instanceof THREE.Mesh) || !(far instanceof THREE.Mesh))
        throw Error(
          `${cruiser.species.asset}: Body and Body_LOD1 must be meshes`,
        );
      const tint = this.tints[i];
      if (tint !== undefined)
        for (const mesh of [near, far]) {
          if (Array.isArray(mesh.material)) continue;
          const own = mesh.material.clone();
          if ('color' in own && own.color instanceof THREE.Color)
            own.color.multiply(new THREE.Color(tint));
          this.tinted.push(own);
          mesh.material = own;
        }
      const keys = near.morphTargetDictionary ?? {},
        root = new THREE.Group();
      root.name = cruiser.species.name;
      root.scale.setScalar(cruiser.species.scale);
      root.rotation.order = 'YZX';
      root.add(model);
      this.root.add(root);
      // Both levels start visible so the scene's warm-up compiles and uploads them.
      return {
        cruiser,
        root,
        near,
        far,
        left: keys.Stroke_Left ?? 0,
        right: keys.Stroke_Right ?? 1,
        isNear: true,
      };
    });
    for (const c of this.cruisers)
      this.sightings.push({
        id: creatureSight(c.species.id),
        label: c.species.name,
        position: c.position,
        // Big animals are seen from further across the clear blue.
        radius: c.species.radius + CRUISING.sightReach,
      });
    this.place();
    return true;
  }
  /** Copy each cruiser's pose and stroke onto its model. */
  private place(): void {
    for (const r of this.rigs) {
      const c = r.cruiser;
      r.root.position.set(c.position.x, c.position.y, c.position.z);
      r.root.rotation.set(c.bank, c.yaw, c.pitch);
      creatureStroke(r.near, r, c.effort);
      creatureStroke(r.far, r, c.effort);
    }
  }
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    player: PlayerPresence,
    camera: THREE.Camera,
  ): void {
    if (this.disposed || !this.rigs.length) return;
    camera.getWorldPosition(this.eye);
    for (const r of this.rigs) {
      // v0.6 Pass 033: a hidden creature waits where it is (the wall's visitors come and go).
      if (!r.root.visible) continue;
      if (active) r.cruiser.update(dt, player, reducedMotion);
      const p = r.cruiser.position,
        limit = r.cruiser.species.detailDistance,
        d = Math.hypot(p.x - this.eye.x, p.y - this.eye.y, p.z - this.eye.z);
      r.isNear = d < limit * (r.isNear ? 1 + CRUISING.hysteresis : 1);
      r.near.visible = r.isNear;
      r.far.visible = !r.isNear;
    }
    this.place();
  }
  /** v0.6 Pass 033: show or hide every creature of group `group`. */
  showGroup(group: number, visible: boolean): void {
    this.rigs.forEach((r, i) => {
      if (this.groupOf[i] === group) r.root.visible = visible;
    });
    if (visible) this.place();
  }
  /** Whether group `group`'s creatures are drawn (false until their models have loaded). */
  isGroupShown(group: number): boolean {
    for (let i = 0; i < this.rigs.length; i++)
      if (this.groupOf[i] === group) return this.rigs[i].root.visible;
    return false;
  }
  /** v0.6 Pass 033: start group `group` again `distance` m along its route (see `Cruiser`). */
  restartGroup(group: number, distance: number): void {
    this.cruisers.forEach((c, i) => {
      if (this.groupOf[i] === group) c.restart(distance);
    });
    if (this.rigs.length) this.place();
  }
  /** Creatures currently drawn at full detail. */
  get nearCount(): number {
    let n = 0;
    for (const r of this.rigs) if (r.isNear && r.root.visible) n++;
    return n;
  }
  private release(): void {
    this.leases.forEach((l) => l.release());
    this.leases = [];
    // Tank babies may share these leases. Retain their cache entry until the last user leaves.
    for (const id of new Set(this.cruisers.map((c) => c.species.asset)))
      this.loader.evictUnused(id);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sightings.length = 0;
    this.rigs = [];
    this.release();
    this.tinted.forEach((m) => m.dispose());
    this.tinted.length = 0;
    this.root.removeFromParent();
    this.root.clear();
  }
}
