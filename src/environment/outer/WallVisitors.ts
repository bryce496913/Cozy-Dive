import * as THREE from 'three';
import type { AssetLoader } from '../../assets/AssetLoader';
import {
  VISITING,
  WALL_VISITOR_IDS,
  type WallVisitorId,
} from '../../config/visitors';
import type { Vec3 } from '../../config/world';
import type { CruiserPlacement, Obstacles } from '../../creatures/cruising';
import {
  atWallEdge,
  entryDistance,
  visitorOrder,
  visitorsDue,
} from '../../creatures/wallVisitors';
import type { SightCandidate } from '../../discovery/journal';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import { OuterCreatures, type CruiseGroup } from './OuterCreatures';
import { PassingLanes } from './PassingLanes';

/**
 * v0.6 Pass 033: visitors along the outer reef's wall. A manta, a whale shark, a school of
 * scalloped hammerheads, a great hammerhead and a humpback whale each swim a long loop parallel to
 * the wall, out in the blue past the lip: along a near lane in one direction, round a wide turn
 * far out at the side, and back along a lane further out. Their turns lie beyond the reef's
 * swimmable width, deep in the haze.
 *
 * None is there when the swimmer arrives. The longer they stay at the edge, the more come (see
 * `VISITING`), one kind at a time, in an order that starts with a different animal on each visit.
 * Each appears out of sight, in the haze, and swims into view: nothing appears from nowhere.
 */

/**
 * A stadium-shaped loop: a near lane `r` m in front of `cz`, travelled towards +x, a half-circle
 * of radius `r` at each end, and the far lane back. `reverse` travels it the other way round.
 */
export function stadium(
  cx: number,
  cz: number,
  half: number,
  r: number,
  y: (x: number) => number,
  reverse = false,
): Vec3[] {
  const points: Vec3[] = [],
    lane = Math.max(2, Math.round((2 * half) / 9)),
    bend = 6;
  for (let i = 0; i < lane; i++) {
    const x = cx - half + (2 * half * i) / lane;
    points.push({ x, y: y(x), z: cz + r });
  }
  for (let i = 0; i < bend; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / bend,
      x = cx + half + r * Math.cos(a);
    points.push({ x, y: y(x), z: cz - r * Math.sin(a) });
  }
  for (let i = 0; i < lane; i++) {
    const x = cx + half - (2 * half * i) / lane;
    points.push({ x, y: y(x), z: cz - r });
  }
  for (let i = 0; i < bend; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / bend,
      x = cx - half + r * Math.cos(a);
    points.push({ x, y: y(x), z: cz - r * Math.sin(a) });
  }
  return reverse ? points.reverse() : points;
}

const alone: readonly CruiserPlacement[] = [
  { start: 0, side: 0, up: 0, phase: 0 },
];
/** A loose school: lanes either side and above and below, staggered back along the route. */
const school: readonly CruiserPlacement[] = [
  [0, 0, 0],
  [-2.2, 1.6, 0.8],
  [-2.8, -1.7, -0.6],
  [-4.6, 0.4, 1.8],
  [-5.4, 2.6, -1.2],
  [-6.6, -2.4, 1.1],
  [-7.8, 0.9, -1.9],
  [-9.1, -0.8, 0.4],
  [-10.2, 2.1, 2.2],
  [-11.6, -2.0, -0.2],
  [-12.8, 0.2, 1.4],
  [-14.4, 1.3, -1.0],
].map(([start, side, up], i) => ({ start, side, up, phase: i * 1.37 }));

/**
 * Their loops (m). The lip is at z -56 and the swimmer can go about 3.6 m past it. The near lanes
 * run 6–7 m beyond that, just clear of the reef at the lip (a route is lifted over anything within
 * its reach), and the far lanes fade into the haze. They pass one above another, about 4.5 m
 * apart: the humpback highest, against the bright water above, then the whale shark, the manta,
 * the great hammerhead and the school of scalloped hammerheads deepest, beside the wall's face.
 */
export const WALL_VISITORS: Readonly<Record<WallVisitorId, CruiseGroup>> = {
  'humpback-whale': {
    species: 'humpback-whale',
    waypoints: stadium(0, -72.5, 50, 6, (x) => 9 + 0.5 * Math.sin(x * 0.05)),
    members: alone,
  },
  'whale-shark': {
    species: 'whale-shark',
    waypoints: stadium(-3, -70.5, 46, 4, (x) => 4 + 0.4 * Math.sin(x * 0.07)),
    members: alone,
  },
  'manta-ray': {
    species: 'manta-ray',
    waypoints: stadium(
      0,
      -68.5,
      40,
      3,
      (x) => -0.5 + 0.4 * Math.sin(x * 0.06),
      true,
    ),
    members: alone,
  },
  'great-hammerhead': {
    species: 'great-hammerhead',
    waypoints: stadium(2, -68.5, 40, 3, () => -5, true),
    members: alone,
  },
  'scalloped-hammerhead': {
    species: 'scalloped-hammerhead',
    waypoints: stadium(3, -72, 42, 4, (x) => -9.5 + 0.5 * Math.sin(x * 0.08)),
    members: school,
  },
};

/**
 * How much further than `VISITING.hidden` a visitor's route must be from the eye: its school's
 * widest lane and half its body (the models are authored about 3 m long, the manta 4.4 m across).
 */
export function hiddenMargin(group: CruiseGroup, scale: number): number {
  const lane = Math.max(...group.members.map((m) => Math.hypot(m.side, m.up)));
  return lane + 2.2 * scale;
}

export class WallVisitors {
  readonly creatures: OuterCreatures;
  readonly ready: Promise<boolean>;
  /** Seconds the swimmer has spent at the edge this visit. */
  edgeTime = 0;
  /** This visit's order, and how many of them have come so far. */
  order: readonly WallVisitorId[] = visitorOrder(0);
  arrived = 0;
  private readonly eye = new THREE.Vector3();
  private readonly scratch: Vec3 = { x: 0, y: 0, z: 0 };
  /** Each visitor's sighting candidates, added to `sightings` once it has come. */
  private readonly candidates = new Map<WallVisitorId, SightCandidate[]>();
  private loaded = false;
  /** v0.6 Pass 037: close by the glass or far out in the blue, pass by pass. */
  private lanes?: PassingLanes;
  /** The eye, moved into the loop's own frame (its lane shift taken off). */
  private readonly shifted: Vec3 = { x: 0, y: 0, z: 0 };
  /** Whether those yet to come have been hidden (after the reef's warm-up has drawn them). */
  private settled = false;
  private disposed = false;

  constructor(
    obstacles: Obstacles,
    loader: AssetLoader,
    /** The world's sightings: a visitor can be seen once it has come. */
    private readonly sightings: SightCandidate[],
  ) {
    this.creatures = new OuterCreatures(
      obstacles,
      loader,
      WALL_VISITOR_IDS.map((id) => WALL_VISITORS[id]),
      'Wall visitors',
    );
    this.ready = this.creatures.ready.then((ok) => {
      if (!ok || this.disposed) return false;
      this.creatures.sightings.forEach((c, i) => {
        const id = WALL_VISITOR_IDS[this.creatures.groupOf[i]],
          list = this.candidates.get(id) ?? [];
        list.push(c);
        this.candidates.set(id, list);
      });
      this.lanes = new PassingLanes(
        this.creatures.cruisers,
        this.creatures.groupOf,
        37021,
      );
      this.loaded = true;
      return true;
    });
  }
  get root(): THREE.Group {
    return this.creatures.root;
  }
  /**
   * A new visit to the outer reef (visit number `visit`): nobody is here yet, and they will come
   * in this visit's order. Call while the swimmer is far from the wall (in the tunnel or the
   * cleft), where nothing of them can be seen.
   */
  arrive(visit: number): void {
    this.order = visitorOrder(visit);
    this.edgeTime = 0;
    this.arrived = 0;
    for (const list of this.candidates.values())
      for (const c of list) {
        const i = this.sightings.indexOf(c);
        if (i >= 0) this.sightings.splice(i, 1);
      }
    // Hidden on the next update (so a reef still warming up draws each of them once).
    this.settled = false;
  }
  /** Whether visitor `id` has come and is passing back and forth. */
  isHere(id: WallVisitorId): boolean {
    return this.creatures.isGroupShown(WALL_VISITOR_IDS.indexOf(id));
  }
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    player: PlayerPresence,
    camera: THREE.Camera,
    position: Readonly<Vec3>,
  ): void {
    if (this.disposed || !this.loaded) return;
    // Those yet to come stay hidden (they are drawn once, while the reef warms up).
    if (!this.settled) {
      this.settled = true;
      for (let k = this.arrived; k < this.order.length; k++)
        this.creatures.showGroup(
          WALL_VISITOR_IDS.indexOf(this.order[k]),
          false,
        );
    }
    if (active && dt > 0 && atWallEdge(position)) this.edgeTime += dt;
    const due = visitorsDue(this.edgeTime, this.order.length);
    if (this.arrived < due) {
      camera.getWorldPosition(this.eye);
      const id = this.order[this.arrived],
        g = WALL_VISITOR_IDS.indexOf(id),
        lead = this.creatures.cruisers[this.creatures.groupOf.indexOf(g)];
      // Its first pass is close to the glass, so the swimmer sees it (and it counts as seen).
      this.lanes?.passClose(g);
      this.shifted.x = this.eye.x;
      this.shifted.y = this.eye.y;
      this.shifted.z = this.eye.z - lead.lane;
      this.creatures.restartGroup(
        g,
        entryDistance(
          lead.route,
          this.shifted,
          this.scratch,
          VISITING.lead,
          VISITING.hidden + hiddenMargin(WALL_VISITORS[id], lead.species.scale),
        ),
      );
      this.creatures.showGroup(g, true);
      this.sightings.push(...(this.candidates.get(id) ?? []));
      this.arrived++;
    }
    if (this.lanes) {
      camera.getWorldPosition(this.eye);
      this.lanes.update(dt, active, this.eye);
    }
    this.creatures.update(dt, active, reducedMotion, player, camera);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.candidates.clear();
    this.creatures.dispose();
  }
}
