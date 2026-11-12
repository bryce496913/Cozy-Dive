import * as THREE from 'three';
import type { AssetLease, AssetLoader } from '../../assets/AssetLoader';
import {
  CRUISE_SPECIES,
  CRUISING,
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
 * v0.4 Pass 025/026: the outer reef's big creatures, out in the blue off the wall (Pass 026): two
 * blacktip reef sharks at two depths, three spotted eagle rays along the wall below the lip, and
 * a green sea turtle along its face. Their routes are lifted over everything
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
  /** Loop waypoints; their heights are minimums (the route is lifted over the reef). */
  readonly waypoints: readonly Vec3[];
  readonly members: readonly CruiserPlacement[];
}
/** An oval of `n` waypoints at height `y(x, z)`, travelled anticlockwise seen from above. */
function oval(
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
 * Pass 026: they live in the blue just off the wall, on long loops parallel to it, so a swimmer
 * hovering past the lip sees something pass every half-minute or so. Loop lengths at their
 * speeds: sharks about 2 minutes, rays about 2.5, the turtle about 2.
 */
export const OUTER_CRUISERS: readonly CruiseGroup[] = [
  {
    // Mid-water, a little way out.
    species: 'blacktip-reef-shark',
    waypoints: oval(0, -70, 30, 6, () => -4),
    members: [{ start: 0, side: 0, up: 0, phase: 0 }],
  },
  {
    // Deeper and further out, fading into the dark.
    species: 'blacktip-reef-shark',
    waypoints: oval(6, -76, 26, 7, () => -11),
    members: [{ start: 60, side: 0, up: 0, phase: 1.7 }],
  },
  {
    // A loose line gliding along the wall just below the lip.
    species: 'spotted-eagle-ray',
    waypoints: oval(-4, -66, 28, 3.5, () => -2.5),
    members: [
      { start: 0, side: 0, up: 0, phase: 0 },
      { start: -7, side: 1.4, up: 0.6, phase: 2.1 },
      { start: -14, side: -1.2, up: 1.1, phase: 4.2 },
    ],
  },
  {
    // Along the wall's face below the lip.
    species: 'green-sea-turtle',
    waypoints: oval(-10, -62.5, 15, 2.5, () => -4),
    members: [{ start: 0, side: 0, up: 0, phase: 0.8 }],
  },
];

/** Cruisers for the groups: routes sampled and lifted over `obstacles` (pure, deterministic). */
export function outerCruisers(
  obstacles: Obstacles,
  groups: readonly CruiseGroup[] = OUTER_CRUISERS,
): Cruiser[] {
  return groups.flatMap((g) => {
    const species = CRUISE_SPECIES[g.species],
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
/** Blend the authored stroke: Stroke_Left for positive effort, Stroke_Right for negative. */
function stroke(
  mesh: THREE.Mesh,
  keys: { readonly left: number; readonly right: number },
  effort: number,
): void {
  const w = mesh.morphTargetInfluences;
  if (!w) return;
  w[keys.left] = Math.max(0, effort);
  w[keys.right] = Math.max(0, -effort);
}
/** Draws the cruisers with their authored models (leased from the shared fish loader). */
export class OuterCreatures {
  readonly root = new THREE.Group();
  readonly cruisers: readonly Cruiser[];
  /** One per creature, following it; empty until the models have loaded. */
  readonly sightings: SightCandidate[] = [];
  readonly ready: Promise<boolean>;
  private rigs: Rig[] = [];
  private leases: AssetLease[] = [];
  private readonly eye = new THREE.Vector3();
  private disposed = false;
  constructor(
    obstacles: Obstacles,
    private readonly loader: AssetLoader,
  ) {
    this.root.name = 'Outer reef big creatures';
    this.cruisers = outerCruisers(obstacles);
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
      const keys = near.morphTargetDictionary ?? {},
        root = new THREE.Group();
      root.name = cruiser.species.name;
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
      stroke(r.near, r, c.effort);
      stroke(r.far, r, c.effort);
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
  /** Creatures currently drawn at full detail. */
  get nearCount(): number {
    let n = 0;
    for (const r of this.rigs) if (r.isNear) n++;
    return n;
  }
  private release(): void {
    this.leases.forEach((l) => l.release());
    this.leases = [];
    // Only the outer reef uses these models: free them rather than keep them cached.
    for (const id of new Set(this.cruisers.map((c) => c.species.asset)))
      this.loader.evict(id);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sightings.length = 0;
    this.rigs = [];
    this.release();
    this.root.removeFromParent();
    this.root.clear();
  }
}
