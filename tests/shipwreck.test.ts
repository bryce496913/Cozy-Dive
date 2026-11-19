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
  SHIP,
  wreckFloor,
  wreckShade,
} from '../src/environment/wreck/WreckLayout';
import {
  ColliderGrid,
  TerrainCollisionWorld,
} from '../src/player/terrainCollision';
import { boulderLayout } from '../src/environment/kelp/KelpEnvironment';
import {
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
function swim(a: Vec3, b: Vec3): Vec3 {
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
    world.move(state, from.x, from.y, from.z);
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
  it('lies in the sandy lane, clear of the boulders, and opens all the way down', () => {
    expect(laneWeight(SINKHOLE.x, SINKHOLE.z)).toBeGreaterThan(0.8);
    for (const b of boulderLayout())
      expect(Math.hypot(b.x - SINKHOLE.x, b.z - SINKHOLE.z)).toBeGreaterThan(
        SINKHOLE.radius + b.size * 0.6,
      );
    expect(kelpSwimFloor(SINKHOLE.x, SINKHOLE.z)).toBeLessThan(
      SINKHOLE.threshold - 2,
    );
    // The sand slumps into a funnel round the mouth, and is untouched beyond it.
    expect(kelpSwimFloor(SINKHOLE.x + 2.5, SINKHOLE.z)).toBeLessThan(
      kelpFloor(SINKHOLE.x + 2.5, SINKHOLE.z) - 0.5,
    );
    expect(kelpSwimFloor(SINKHOLE.x + 6, SINKHOLE.z)).toBeCloseTo(
      kelpFloor(SINKHOLE.x + 6, SINKHOLE.z),
      6,
    );
  });
});

describe('the shipwreck', () => {
  it('opens out of its shaft above the deck, with a little way still to swim down', () => {
    const s = WRECK.shaft,
      exit = swim(
        { x: s.x, y: s.threshold - 0.1, z: s.z },
        { x: s.x, y: 0, z: s.z },
      );
    // Down the shaft and on to the deck, which stops the swimmer.
    const deckTop = SHIP.deck + SHIP.plate;
    expect(exit.y).toBeGreaterThan(deckTop);
    expect(exit.y).toBeLessThan(deckTop + 1);
    expect(WRECK.ceiling - deckTop).toBeGreaterThan(8);
  });
  it('can be entered by the hatch, the breach and the bridge door', () => {
    const h = SHIP.hatch;
    const inHold = { x: 0, y: 3, z: (h.foreZ + h.aftZ) / 2 };
    expect(near(swim({ ...inHold, y: 10 }, inHold), inHold)).toBe(true);
    const b = SHIP.breach,
      breachIn = { x: 1.5, y: (b.low + b.high) / 2, z: (b.foreZ + b.aftZ) / 2 };
    expect(near(swim({ ...breachIn, x: 7 }, breachIn), breachIn)).toBe(true);
    // Just inside the door (the wheel stands a little further in).
    const bridgeIn = { x: 0, y: SHIP.deck + 1.2, z: -21.2 };
    expect(near(swim({ ...bridgeIn, z: -25 }, bridgeIn), bridgeIn)).toBe(true);
  });
  it('is solid elsewhere: the deck, the sides and the bridge walls', () => {
    const overDeck = { x: 0, y: 10, z: -37 },
      down = swim(overDeck, { x: 0, y: 3, z: -37 });
    expect(down.y).toBeGreaterThan(SHIP.deck);
    const portSide = swim({ x: -7, y: 3, z: -30 }, { x: 0, y: 3, z: -30 });
    expect(portSide.x).toBeLessThan(-SHIP.half);
    const bridgeSide = swim(
      { x: 6, y: SHIP.deck + 1.2, z: -19.5 },
      { x: 0, y: SHIP.deck + 1.2, z: -19.5 },
    );
    expect(bridgeSide.x).toBeGreaterThan(SHIP.bridge.half);
  });
  it('is dark inside the hold and bridge only, deepening from the openings', () => {
    expect(wreckShade({ x: 0, y: 11, z: -30 })).toBe(0);
    expect(wreckShade({ x: 0, y: 3.5, z: -32 })).toBe(1);
    expect(wreckShade({ x: 0, y: SHIP.deck + 1.4, z: -19.5 })).toBe(1);
    expect(wreckShade({ x: 0, y: 6.2, z: -31 })).toBeLessThan(0.6);
    expect(wreckShade({ x: 7, y: 3, z: -36 })).toBe(0);
  });
});
