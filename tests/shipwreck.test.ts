import { describe, expect, it } from 'vitest';
import {
  SINKHOLE,
  SINKHOLE_FRAME,
  WRECK,
  WRECK_FRAME,
} from '../src/config/wreck';
import type { Vec3 } from '../src/config/world';
import { crossing, mapPoint, passageDarkness } from '../src/player/passage';
import { WreckEnvironment } from '../src/environment/wreck/WreckEnvironment';
import {
  DECK_TOP,
  SHIP,
  fromShip,
  wreckFloor,
  wreckShade,
} from '../src/environment/wreck/WreckLayout';
/** A point given in the ship's own frame, where she lies in the cavern. */
const at = (x: number, y: number, z: number): Vec3 =>
  fromShip({ x, y, z }, { x: 0, y: 0, z: 0 });
import {
  ColliderGrid,
  TerrainCollisionWorld,
} from '../src/player/terrainCollision';
import {
  KelpEnvironment,
  boulderLayout,
} from '../src/environment/kelp/KelpEnvironment';
import { stalkPlacements } from '../src/environment/kelp/KelpStalks';
import {
  KELP_SWIM_BOUNDS,
  kelpFloor,
  kelpSwimFloor,
  laneWeight,
} from '../src/environment/kelp/KelpTerrain';

const ready = { outer: true, kelp: true, cave: true, ice: true, wreck: true };
const environment = new WreckEnvironment();
const world = new TerrainCollisionWorld(
  new ColliderGrid(environment.colliders),
  WRECK.bounds,
  wreckFloor,
);
/** Swim in small steps from `a` towards `b`; where the swimmer ends up. */
function swim(a: Vec3, b: Vec3, through: TerrainCollisionWorld = world): Vec3 {
  const state = {
    position: { ...a },
    velocity: { x: 0, y: 0, z: 0 },
  };
  const n = 200;
  for (let i = 1; i <= n; i++) {
    const from = { ...state.position };
    state.position.x = from.x + (b.x - a.x) / n;
    state.position.y = from.y + (b.y - a.y) / n;
    state.position.z = from.z + (b.z - a.z) / n;
    through.move(state, from.x, from.y, from.z);
  }
  return state.position;
}
const near = (p: Vec3, q: Vec3) =>
  Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) < 0.15;

describe('the sinkhole passage', () => {
  it('goes down from the kelp forest into the wreck, and back up', () => {
    const hole = { x: SINKHOLE.x, y: SINKHOLE.threshold - 0.2, z: SINKHOLE.z };
    expect(crossing('kelp', hole, ready)?.target).toBe('wreck');
    expect(crossing('kelp', hole, { ...ready, wreck: false })).toBeNull();
    // Above the threshold: still in the kelp forest.
    expect(
      crossing('kelp', { ...hole, y: SINKHOLE.threshold + 1 }, ready),
    ).toBeNull();
    const mapped = mapPoint(hole, SINKHOLE_FRAME, WRECK_FRAME, {
      x: 0,
      y: 0,
      z: 0,
    });
    expect(crossing('wreck', mapped, ready)).toBeNull();
    expect(
      crossing('wreck', { ...mapped, y: mapped.y + 0.4 }, ready)?.target,
    ).toBe('kelp');
  });
  it('is darkest at the threshold, and clear at the mouth and in the cavern', () => {
    const at = (y: number) => ({ x: SINKHOLE.x, y, z: SINKHOLE.z });
    expect(passageDarkness('kelp', at(2))).toBe(0);
    expect(passageDarkness('kelp', at(SINKHOLE.threshold))).toBeGreaterThan(
      0.9,
    );
    expect(passageDarkness('kelp', at(-8))).toBeGreaterThan(0.2);
    const s = WRECK.shaft;
    expect(
      passageDarkness('wreck', { x: s.x, y: s.threshold, z: s.z }),
    ).toBeGreaterThan(0.9);
    expect(
      passageDarkness('wreck', { x: s.x, y: WRECK.ceiling - 1, z: s.z }),
    ).toBe(0);
  });
  it('is hidden: off the open lane, tucked against a boulder, ringed by kelp', () => {
    expect(laneWeight(SINKHOLE.x, SINKHOLE.z)).toBeLessThan(0.05);
    const boulders = boulderLayout(),
      nearest = Math.min(
        ...boulders.map(
          (b) => Math.hypot(b.x - SINKHOLE.x, b.z - SINKHOLE.z) - b.size * 0.5,
        ),
      );
    expect(nearest).toBeGreaterThan(SINKHOLE.radius - 0.2);
    expect(nearest).toBeLessThan(SINKHOLE.radius + 1);
    const stalks = stalkPlacements().map((p) =>
      Math.hypot(p.x - SINKHOLE.x, p.z - SINKHOLE.z),
    );
    expect(Math.min(...stalks)).toBeGreaterThan(SINKHOLE.radius + 0.4);
    expect(stalks.filter((d) => d < 6).length).toBeGreaterThan(3);
    // Only a shallow dip round its mouth, and open all the way down.
    expect(kelpSwimFloor(SINKHOLE.x, SINKHOLE.z)).toBeLessThan(
      SINKHOLE.threshold - 2,
    );
    const edge = SINKHOLE.radius + 0.4;
    expect(kelpSwimFloor(SINKHOLE.x + edge, SINKHOLE.z)).toBeLessThan(
      kelpFloor(SINKHOLE.x + edge, SINKHOLE.z) - 0.3,
    );
    expect(kelpSwimFloor(SINKHOLE.x + 4, SINKHOLE.z)).toBeCloseTo(
      kelpFloor(SINKHOLE.x + 4, SINKHOLE.z),
      6,
    );
  });
  it('can be swum into from its open side, under the ledge', () => {
    const kelp = new KelpEnvironment(),
      ground = new TerrainCollisionWorld(
        new ColliderGrid(kelp.colliders),
        KELP_SWIM_BOUNDS,
        kelpSwimFloor,
      ),
      b = boulderLayout().reduce((best, o) =>
        Math.hypot(o.x - SINKHOLE.x, o.z - SINKHOLE.z) <
        Math.hypot(best.x - SINKHOLE.x, best.z - SINKHOLE.z)
          ? o
          : best,
      ),
      a = Math.atan2(SINKHOLE.z - b.z, SINKHOLE.x - b.x),
      lip = kelpFloor(SINKHOLE.x, SINKHOLE.z),
      path: Vec3[] = [
        {
          x: SINKHOLE.x + Math.cos(a) * 4,
          y: lip + 1.2,
          z: SINKHOLE.z + Math.sin(a) * 4,
        },
        {
          x: SINKHOLE.x + Math.cos(a) * 0.3,
          y: lip - 2,
          z: SINKHOLE.z + Math.sin(a) * 0.3,
        },
        { x: SINKHOLE.x, y: SINKHOLE.threshold - 0.5, z: SINKHOLE.z },
      ];
    let p = path[0];
    for (const next of path.slice(1)) p = swim(p, next, ground);
    expect(p.y).toBeLessThan(SINKHOLE.threshold);
    kelp.dispose();
  });
});

describe('the shipwreck', () => {
  it('opens out of its shaft above the deck, with a little way still to swim down', () => {
    const s = WRECK.shaft,
      exit = swim(
        { x: s.x, y: s.threshold - 0.1, z: s.z },
        { x: s.x, y: 0, z: s.z },
      ),
      deck = at(s.x, DECK_TOP, s.z - 0.0).y;
    // Down the shaft and on to the deck, which stops the swimmer.
    expect(exit.y).toBeGreaterThan(deck);
    expect(exit.y).toBeLessThan(deck + 1);
    expect(WRECK.ceiling - deck).toBeGreaterThan(8);
  });
  it('can be entered by the hatch, the breach and the deckhouse door', () => {
    const h = SHIP.hatch,
      inHold = at(0, 3, (h.foreZ + h.aftZ) / 2);
    expect(near(swim(at(0, 10, (h.foreZ + h.aftZ) / 2), inHold), inHold)).toBe(
      true,
    );
    const b = SHIP.breach,
      y = (b.low + b.high) / 2,
      z = (b.foreZ + b.aftZ) / 2,
      breachIn = at(1.5, y, z);
    expect(near(swim(at(7, y, z), breachIn), breachIn)).toBe(true);
    // Just inside the door (the wheel stands a little further in).
    const bridgeIn = at(0, DECK_TOP + 0.95, -21.2);
    expect(near(swim(at(0, DECK_TOP + 0.95, -25), bridgeIn), bridgeIn)).toBe(
      true,
    );
  });
  it('is solid elsewhere: the deck, the sides and the deckhouse walls', () => {
    const down = swim(at(0, 10, -37), at(0, 3, -37));
    expect(down.y).toBeGreaterThan(at(0, SHIP.deck, -37).y);
    const port = swim(at(-7, 3, -30), at(0, 3, -30));
    expect(port.x).toBeLessThan(at(-SHIP.half, 3, -30).x);
    const side = swim(
      at(6, DECK_TOP + 0.95, -19.5),
      at(0, DECK_TOP + 0.95, -19.5),
    );
    expect(side.x).toBeGreaterThan(
      at(SHIP.bridge.half, DECK_TOP + 0.95, -19.5).x,
    );
  });
  it('is dark inside the hold and deckhouse only, deepening from the openings', () => {
    expect(wreckShade(at(0, 11, -30))).toBe(0);
    expect(wreckShade(at(0, 3.5, -32))).toBe(1);
    expect(wreckShade(at(0, DECK_TOP + 1.4, -19.5))).toBe(1);
    expect(wreckShade(at(0, 6.2, -31))).toBeLessThan(0.6);
    expect(wreckShade(at(7, 3, -36))).toBe(0);
  });
  it('lies listing a little, settled into the sand', () => {
    const port = at(-SHIP.half, DECK_TOP, -30),
      starboard = at(SHIP.half, DECK_TOP, -30);
    expect(Math.abs(port.y - starboard.y)).toBeGreaterThan(0.4);
    expect(at(0, SHIP.keel, -30).y).toBeLessThan(wreckFloor(0, -30));
  });
});
