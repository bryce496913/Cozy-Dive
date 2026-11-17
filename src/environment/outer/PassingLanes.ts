import { OUTER } from '../../config/passage';
import type { Vec3 } from '../../config/world';
import type { Cruiser } from '../../creatures/cruising';

/**
 * v0.6 Pass 037: where the outer reef's big animals pass the glass. Each group (a shark, a line of
 * rays, the hammerhead school) picks its next pass while it is out of sight: sometimes close, its
 * near side a couple of metres beyond the glass, where it is easily seen (and counts as seen);
 * otherwise far out in the blue, a faint shape at the edge of what the swimmer can make out. The
 * whole loop is shifted along z (towards or away from the glass), so the rest of it follows.
 * Allocation-free per frame.
 */
export const LANES = {
  /** A close pass leaves this much water between the glass and the animal's side (m). */
  close: 1.8,
  /**
   * A far pass keeps the animal's near side this far beyond the glass (m).
   * v0.6 Pass 042: a little closer (was 9), so the far passes read better in the blue.
   */
  far: 6.5,
  /** Chance a pass is close. */
  closeChance: 0.45,
  /** A group may change lane only this far from the eye (m: beyond the view distance)... */
  unseen: 24,
  /** ...and at most once in this many seconds (a random time in the range). */
  hold: [35, 80] as const,
} as const;

interface Group {
  readonly members: readonly Cruiser[];
  /** The loop's nearest reach towards the glass, members' sides and bodies included (z, m). */
  readonly reach: number;
  wait: number;
}

/** The nearest the group's loop comes to the glass (z): its route, lanes and body size. */
function loopReach(members: readonly Cruiser[]): number {
  const route = members[0].route,
    p: Vec3 = { x: 0, y: 0, z: 0 },
    side = Math.max(...members.map((m) => Math.abs(m.placementSide))),
    radius = Math.max(...members.map((m) => m.species.radius));
  let reach = -Infinity;
  for (let d = 0; d < route.length; d += 1)
    reach = Math.max(reach, route.at(d, p).z);
  return reach + side + radius;
}

export class PassingLanes {
  private readonly groups: Group[] = [];
  private seed: number;

  constructor(
    cruisers: readonly Cruiser[],
    groupOf: readonly number[],
    seed = 37011,
  ) {
    this.seed = seed >>> 0;
    const byGroup = new Map<number, Cruiser[]>();
    cruisers.forEach((c, i) => {
      const list = byGroup.get(groupOf[i]) ?? [];
      list.push(c);
      byGroup.set(groupOf[i], list);
    });
    for (const members of byGroup.values()) {
      const g: Group = { members, reach: loopReach(members), wait: 0 };
      this.groups.push(g);
      // Start each one in a lane of its own, chosen now (everything starts out of sight).
      this.choose(g, this.random() < LANES.closeChance, true);
    }
  }
  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  /** The z shift that puts the group's loop close to the glass, or far out in the blue. */
  shiftFor(index: number, close: boolean): number {
    const g = this.groups[index],
      glass = OUTER.glass.z;
    return (close ? glass - LANES.close : glass - LANES.far) - g.reach;
  }
  private choose(g: Group, close: boolean, snap: boolean): void {
    const shift = this.shiftFor(this.groups.indexOf(g), close);
    for (const m of g.members) m.setLane(shift, snap);
    g.wait = LANES.hold[0] + this.random() * (LANES.hold[1] - LANES.hold[0]);
  }
  /**
   * v0.6 Pass 037: put group `index` in the close lane at once (a wall visitor's first pass, so it
   * is seen); call only while it is out of sight.
   */
  passClose(index: number): void {
    this.choose(this.groups[index], true, true);
  }
  /** Change lanes now and then, only while a group is well out of sight. */
  update(dt: number, active: boolean, eye: Readonly<Vec3>): void {
    if (!active || !(dt > 0)) return;
    for (const g of this.groups) {
      g.wait -= dt;
      if (g.wait > 0) continue;
      let near = Infinity;
      for (const m of g.members) {
        const p = m.position;
        near = Math.min(
          near,
          Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z),
        );
      }
      if (near < LANES.unseen) continue;
      this.choose(g, this.random() < LANES.closeChance, false);
    }
  }
}
