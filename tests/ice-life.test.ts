import { describe, expect, it } from 'vitest';
import { ICE } from '../src/config/passage';
import type { Vec3 } from '../src/config/world';
import {
  AdelieGroup,
  EmperorDives,
  IcefishRest,
  iceLimits,
  krillAt,
  Notothens,
  WEDDELL,
  WeddellSeal,
} from '../src/creatures/iceLife';
import { ICE_SIGHTS, SIGHTS, sightLabel } from '../src/discovery/sights';
import { IceCritters, CRITTERS } from '../src/environment/ice/IceCritters';
import { iceFloor } from '../src/environment/ice/IceTerrain';
import { createPose } from '../src/environment/outer/PosedFish';
import type { PlayerPresence } from '../src/fish/FishDiverReaction';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const presence = (p: Vec3, active = true): PlayerPresence => ({
  position: p,
  velocity: v(0, 0, 0),
  active,
});
const limits = iceLimits(iceFloor);
const inside = (p: Vec3, floor = 0.2, roof = 0.3) => {
  expect(p.x).toBeGreaterThanOrEqual(limits.minX - 1e-6);
  expect(p.x).toBeLessThanOrEqual(limits.maxX + 1e-6);
  expect(p.z).toBeGreaterThanOrEqual(limits.minZ - 1e-6);
  expect(p.z).toBeLessThanOrEqual(limits.maxZ + 1e-6);
  expect(p.y).toBeGreaterThanOrEqual(iceFloor(p.x, p.z) + floor - 1e-6);
  expect(p.y).toBeLessThanOrEqual(ICE.ceiling - roof + 1e-6);
};
const far = presence(v(0, 5, -12), false);

describe('v0.6 Pass 047: everyday life under the ice', () => {
  it('emperor penguins dive in through a hole, swoop low, and leave through it, trailing bubbles', () => {
    const e = new EmperorDives(createPose, limits),
      moods: string[] = [];
    let bubbles = 0,
      lowest = Infinity;
    e.dive(0);
    for (let i = 0; i < 10 * 120; i++) {
      e.update(0.1, far);
      const d = e.divers[0],
        p = d.swim.pose.position;
      if (moods[moods.length - 1] !== d.mood) moods.push(d.mood);
      bubbles += e.bubbleCount;
      if (p.y < ICE.ceiling - 0.6) {
        inside(p, 0.7, 0.5);
        lowest = Math.min(lowest, p.y - iceFloor(p.x, p.z));
      }
      if (d.mood === 'away' && moods.length > 1) break;
    }
    expect(moods).toEqual(['down', 'swoop', 'up', 'away']);
    expect(lowest).toBeLessThan(3);
    expect(bubbles).toBeGreaterThan(5);
  });
  it('the Adélie penguins zip about just under the ice, inside the tank, swerving from a swimmer', () => {
    const g = new AdelieGroup(createPose, limits);
    let moved = 0;
    for (let i = 0; i < 10 * 120; i++) {
      const before = { ...g.swims[0].pose.position };
      g.update(0.1, presence(v(2, ICE.ceiling - 2.5, -38)));
      moved += Math.hypot(
        g.swims[0].pose.position.x - before.x,
        g.swims[0].pose.position.z - before.z,
      );
      for (const s of g.swims) {
        inside(s.pose.position, 0.9, 0.7);
        // v0.6 Pass 052: lower down, where the swimmer is (4 to 7.5 m under the ice, swerving lower from a swimmer).
        expect(s.pose.position.y).toBeGreaterThan(ICE.ceiling - 10);
      }
    }
    expect(moved / 120).toBeGreaterThan(1);
  });
  it('the Weddell seal hangs by its hole, rises into it to breathe, calls now and then, and keeps its distance', () => {
    const s = new WeddellSeal(createPose(), limits, 0),
      moods = new Set<string>(),
      hole = ICE.holes[0];
    let calls = 0,
      highest = -Infinity;
    for (let i = 0; i < 10 * 400; i++) {
      s.update(0.1, far);
      moods.add(s.mood);
      if (s.called) calls++;
      highest = Math.max(highest, s.pose.position.y);
      if (s.mood === 'breathe')
        expect(
          Math.hypot(s.pose.position.x - hole.x, s.pose.position.z - hole.z),
        ).toBeLessThan(hole.r);
    }
    expect([...moods]).toEqual(
      expect.arrayContaining(['hang', 'rise', 'breathe', 'sink']),
    );
    expect(highest).toBeGreaterThan(ICE.ceiling);
    expect(calls).toBeGreaterThan(5);
    // A swimmer right beside it: it eases away.
    const calm = new WeddellSeal(createPose(), limits, 0),
      eye = { ...calm.pose.position, x: calm.pose.position.x + 1 };
    for (let i = 0; i < 100; i++) calm.update(0.1, presence(eye));
    const p = calm.pose.position;
    expect(Math.hypot(p.x - eye.x, p.z - eye.z)).toBeGreaterThan(1.5);
    expect(WEDDELL.personal).toBeGreaterThan(2);
  });
  it('icefish rest on the seabed and hop away from a close swimmer', () => {
    const f = new IcefishRest(createPose, limits, [v(-6, 0, -34)]),
      fish = f.fish[0],
      start = { ...fish.swim.pose.position };
    for (let i = 0; i < 50; i++) f.update(0.1, far);
    // Resting still.
    expect(
      Math.hypot(
        fish.swim.pose.position.x - start.x,
        fish.swim.pose.position.z - start.z,
      ),
    ).toBeLessThan(0.05);
    for (let i = 0; i < 10 * 10; i++) {
      f.update(0.1, presence(v(start.x + 0.5, start.y + 0.5, start.z)));
      for (const g of f.fish) {
        const p = g.swim.pose.position;
        expect(p.y).toBeGreaterThanOrEqual(iceFloor(p.x, p.z) + 0.1 - 1e-6);
        expect(p.y).toBeLessThan(iceFloor(p.x, p.z) + 1.2);
      }
    }
    expect(
      Math.hypot(
        fish.swim.pose.position.x - start.x,
        fish.swim.pose.position.z - start.z,
      ),
    ).toBeGreaterThan(1);
  });
  it('bald notothens stay in the hollows under the ice', () => {
    const n = new Notothens(createPose, limits);
    for (let i = 0; i < 10 * 60; i++) {
      n.update(0.1, presence(v(0, ICE.ceiling - 1, -30)));
      for (const s of n.swims) {
        inside(s.pose.position, 1.9, 0.39);
        expect(s.pose.position.y).toBeGreaterThan(ICE.ceiling - 2.5);
      }
    }
  });
  it('the krill swarm is a compact cloud that parts round a swimmer inside it', () => {
    const c = v(0, 7, -30),
      p = v(0, 0, 0);
    for (let i = 0; i < 500; i++)
      expect(
        Math.hypot(krillAt(i, 500, c, 3, p).x - c.x, p.y - c.y, p.z - c.z),
      ).toBeLessThan(3);
    const critters = new IceCritters(limits, []);
    const swimmer = { ...critters.swarm };
    critters.update(0.1, true, false, presence(swimmer));
    for (const k of critters.krillPositions)
      expect(
        Math.hypot(k.x - swimmer.x, k.y - swimmer.y, k.z - swimmer.z),
      ).toBeGreaterThan(CRITTERS.part - 0.05);
    for (let i = 0; i < 300; i++) critters.update(0.1, true, false, far);
    critters.dispose();
    critters.dispose();
  });
  it('names every new sight once', () => {
    for (const key of [
      'emperor',
      'adelie',
      'weddell',
      'krill',
      'icefish',
      'notothen',
      'seaSpider',
      'ribbonWorm',
      'seaButterfly',
      'combJelly',
    ] as const)
      expect(sightLabel(ICE_SIGHTS[key].id)).toBe(ICE_SIGHTS[key].label);
    expect(new Set(SIGHTS.map((s) => s.id)).size).toBe(SIGHTS.length);
  });
});
