import { describe, expect, it } from 'vitest';
import { CRUISE_SPECIES, type CruiseSpecies } from '../src/config/creatures';
import { OUTER } from '../src/config/passage';
import type { Vec3 } from '../src/config/world';
import {
  CruiseRoute,
  Cruiser,
  liftRoute,
  sampleLoop,
  type Obstacles,
} from '../src/creatures/cruising';
import { SightingTracker, SIGHTING } from '../src/discovery/journal';
import {
  SIGHTS,
  creatureSight,
  seenList,
  sightLabel,
} from '../src/discovery/sights';
import {
  OUTER_CRUISERS,
  outerCruisers,
  reefObstacles,
} from '../src/environment/outer/OuterCreatures';
import {
  ROCK_HALF,
  outerReefLayout,
} from '../src/environment/outer/OuterReefLayout';
import { seabedHeight } from '../src/environment/outer/OuterTerrain';
import {
  REEF_SIGHT_SAMPLES,
  reefSightings,
} from '../src/environment/outer/outerSightings';
import type { PlayerPresence } from '../src/fish/FishDiverReaction';

const flat: Obstacles = () => 0;
const square = (size: number, y: number): Vec3[] => [
  { x: -size, y, z: -size },
  { x: size, y, z: -size },
  { x: size, y, z: size },
  { x: -size, y, z: size },
];
const shark = CRUISE_SPECIES['blacktip-reef-shark'];
const run = (
  c: Cruiser,
  seconds: number,
  hz: number,
  player?: PlayerPresence,
) => {
  for (let i = 0; i < Math.round(seconds * hz); i++) c.update(1 / hz, player);
};
const still = (x: number, y: number, z: number): PlayerPresence => ({
  position: { x, y, z },
  velocity: { x: 0, y: 0, z: 0 },
  active: true,
});

describe('Pass 025 cruising routes', () => {
  it('samples a closed loop evenly and travels it by distance, wrapping', () => {
    const samples = sampleLoop(square(10, 3), 0.5),
      route = new CruiseRoute(samples);
    for (let i = 0; i < samples.length; i++) {
      const a = samples[i],
        b = samples[(i + 1) % samples.length];
      expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeLessThan(0.8);
    }
    // A Catmull-Rom loop through a square's corners is a rounded square.
    expect(route.length).toBeGreaterThan(62);
    expect(route.length).toBeLessThan(90);
    const p = route.at(0, { x: 0, y: 0, z: 0 }),
      q = route.at(route.length * 3, { x: 0, y: 0, z: 0 }),
      r = route.at(-route.length, { x: 0, y: 0, z: 0 });
    expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeLessThan(1e-6);
    expect(Math.hypot(p.x - r.x, p.z - r.z)).toBeLessThan(1e-6);
    const d = route.direction(5, { x: 0, y: 0, z: 0 });
    expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 6);
    expect(() => sampleLoop(square(1, 0).slice(0, 2))).toThrow();
  });

  it('lifts a route smoothly over what lies beneath, keeping its clearance', () => {
    // A 5 m tall mound in the middle of one side of the loop.
    const mound: Obstacles = (x, z, r) =>
      Math.hypot(x - 10, z) < 2 + r ? 5 : 0;
    const samples = sampleLoop(square(10, 1)),
      lifted = liftRoute(samples, mound, 1, 1.5);
    let steepest = 0;
    lifted.forEach((p, i) => {
      expect(p.y).toBeGreaterThanOrEqual(mound(p.x, p.z, 1) + 1.5 - 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(samples[i].y - 1e-9);
      const n = lifted[(i + 1) % lifted.length];
      steepest = Math.max(
        steepest,
        Math.abs(n.y - p.y) / Math.hypot(n.x - p.x, n.z - p.z),
      );
    });
    // Over the mound, and back down on the far side, with no sudden steps.
    expect(Math.max(...lifted.map((p) => p.y))).toBeCloseTo(6.5, 6);
    // Elsewhere it keeps its clearance over the flat floor (1.5 m above 0).
    expect(Math.min(...lifted.map((p) => p.y))).toBe(1.5);
    expect(steepest).toBeLessThan(0.6);
  });

  it('keeps every outer route clear of the reef and wall, out in the blue off the lip', () => {
    const layout = outerReefLayout(),
      obstacles = reefObstacles(layout.placements),
      cruisers = outerCruisers(obstacles);
    expect(cruisers).toHaveLength(
      OUTER_CRUISERS.reduce((n, g) => n + g.members.length, 0),
    );
    expect(new Set(cruisers.map((c) => c.species.id)).size).toBe(3);
    const p = { x: 0, y: 0, z: 0 };
    for (const c of new Set(cruisers.map((c) => c.route))) {
      const species = cruisers.find((k) => k.route === c)!.species;
      for (let d = 0; d < c.length; d += 0.5) {
        c.at(d, p);
        // Between its 0.5 m samples a route is straight, so allow a few centimetres.
        expect(p.y - obstacles(p.x, p.z, species.radius)).toBeGreaterThan(
          species.clearance - 0.05,
        );
        expect(Math.abs(p.x)).toBeLessThan(OUTER.reef.maxX - 6);
        // Pass 026: out in the blue, past the reef's lip, within reach of the eye.
        expect(p.z).toBeLessThan(OUTER.dropOff.start);
        expect(p.z).toBeGreaterThan(OUTER.bounds.min.z + 6);
        expect(p.y).toBeLessThan(OUTER.reach.up);
      }
    }
  });

  it('builds the obstacle field from the seabed and every rock and colony', () => {
    const layout = outerReefLayout(),
      obstacles = reefObstacles(layout.placements);
    for (const [x, z] of [
      [0, -50],
      [20, -80],
      [-30, -120],
    ])
      expect(obstacles(x, z, 0)).toBeGreaterThanOrEqual(
        seabedHeight(x, z) - 0.6,
      );
    for (const p of layout.placements.filter((p) => p.family === 'rock'))
      expect(obstacles(p.position.x, p.position.z, 0.5)).toBeGreaterThanOrEqual(
        p.position.y + ROCK_HALF * p.scale.y - 1e-4,
      );
  });
});

describe('Pass 025 cruisers', () => {
  const route = () =>
    new CruiseRoute(liftRoute(sampleLoop(square(15, 4)), flat, 1, 1));
  const place = { start: 0, side: 0, up: 0, phase: 0 };

  it('cruise the same path at any frame rate, facing where they go', () => {
    const r = route(),
      slow = new Cruiser(shark, r, place),
      fast = new Cruiser(shark, r, place);
    run(slow, 40, 24);
    run(fast, 40, 144);
    expect(
      Math.hypot(
        slow.position.x - fast.position.x,
        slow.position.y - fast.position.y,
        slow.position.z - fast.position.z,
      ),
    ).toBeLessThan(0.02);
    expect(Math.abs(slow.yaw - fast.yaw)).toBeLessThan(0.02);
    // Heading follows the route's direction (yaw 0 faces +X, positive turns towards -Z).
    const d = r.direction(shark.speed * 40, { x: 0, y: 0, z: 0 });
    expect(Math.cos(slow.yaw) * d.x - Math.sin(slow.yaw) * d.z).toBeGreaterThan(
      0.97,
    );
    // A long frame gap is handled like any other step, and a zero step does nothing.
    const before = { ...slow.position };
    slow.update(0);
    expect(slow.position).toEqual(before);
  });

  it('bank into turns, but not with reduced motion', () => {
    const r = route(),
      c = new Cruiser(shark, r, place),
      calm = new Cruiser(shark, r, place);
    let most = 0;
    for (let i = 0; i < 60 * 30; i++) {
      c.update(1 / 30);
      calm.update(1 / 30, undefined, true);
      most = Math.max(most, Math.abs(c.bank));
      expect(calm.bank).toBe(0);
    }
    expect(most).toBeGreaterThan(0.05);
    expect(most).toBeLessThanOrEqual(0.45 + 1e-9);
  });

  it.each(Object.values(CRUISE_SPECIES))(
    '%s gives the swimmer room, sideways or up, and drifts back afterwards',
    (species: CruiseSpecies) => {
      const r = route(),
        c = new Cruiser(species, r, place),
        // The swimmer waits right on its route, a little way ahead.
        ahead = r.at(species.speed * 12, { x: 0, y: 0, z: 0 }),
        player = still(ahead.x, ahead.y, ahead.z),
        base = { x: 0, y: 0, z: 0 };
      let closest = Infinity,
        most = 0;
      for (let i = 0; i < 30 * 30; i++) {
        c.update(1 / 30, player);
        const p = c.position;
        closest = Math.min(
          closest,
          Math.hypot(p.x - ahead.x, p.y - ahead.y, p.z - ahead.z),
        );
        most = Math.max(most, c.aside);
        r.at((species.speed * (i + 1)) / 30, base);
        // Never down towards the reef.
        expect(p.y).toBeGreaterThanOrEqual(base.y - 1e-9);
      }
      expect(closest).toBeGreaterThan(species.radius + 0.8);
      expect(most).toBeGreaterThan(species.giveWay * 0.5);
      expect(most).toBeLessThanOrEqual(species.giveWay + 1e-9);
      // Long after passing, it is back on its route.
      run(c, 40, 30, player);
      expect(c.aside).toBeLessThan(0.05);
    },
  );

  it('stroke within their range, resting during glides, gentler with reduced motion', () => {
    const ray = CRUISE_SPECIES['spotted-eagle-ray'],
      r = route(),
      c = new Cruiser(ray, r, place),
      calm = new Cruiser(ray, r, place);
    let most = 0,
      calmest = 0,
      restFrames = 0;
    const frames = Math.round(ray.glide!.period * 4 * 30);
    for (let i = 0; i < frames; i++) {
      c.update(1 / 30);
      calm.update(1 / 30, undefined, true);
      most = Math.max(most, Math.abs(c.effort));
      calmest = Math.max(calmest, Math.abs(calm.effort));
      if (Math.abs(c.effort) < 1e-3) restFrames++;
    }
    expect(most).toBeLessThanOrEqual(ray.stroke + 1e-9);
    expect(most).toBeGreaterThan(ray.stroke * 0.9);
    expect(calmest).toBeLessThan(most * 0.7);
    // Rests take up a good part of each glide cycle.
    expect(restFrames / frames).toBeGreaterThan(ray.glide!.share * 0.6);
  });
});

describe('Pass 025 sightings', () => {
  it('counts a sight once per frame however many candidates share its id', () => {
    const tracker = new SightingTracker([]),
      eye = { x: 0, y: 0, z: 0 },
      forward = { x: 0, y: 0, z: -1 },
      seen = { id: 'species:spotted-eagle-ray', label: 'Ray', radius: 1.5 },
      candidates = [
        { ...seen, position: { x: 0, y: 0, z: -4 } },
        { ...seen, position: { x: 0, y: 0, z: -4.5 } },
        // Behind the swimmer: must not decay the others' progress.
        { ...seen, position: { x: 0, y: 0, z: 30 } },
      ];
    let at = 0;
    for (let i = 1; i <= 120 && !at; i++)
      if (tracker.update(candidates, eye, forward, 1 / 60)) at = i / 60;
    expect(at).toBeGreaterThanOrEqual(SIGHTING.dwell - 1e-9);
    expect(at).toBeLessThan(SIGHTING.dwell + 0.05);
    expect(tracker.has(seen.id)).toBe(true);
  });

  it('offers the reef’s corals, fans and seagrass, spread through the layout', () => {
    const layout = outerReefLayout(),
      sightings = reefSightings(layout.placements),
      ids = new Set(sightings.map((s) => s.id));
    expect([...ids].sort()).toEqual(
      [
        'coral:boulder',
        'coral:branching',
        'coral:plate',
        'coral:sea-fan',
        'coral:soft',
        'plant:seagrass',
      ].sort(),
    );
    for (const id of ids) {
      const some = sightings.filter((s) => s.id === id);
      expect(some.length).toBeGreaterThan(0);
      expect(some.length).toBeLessThanOrEqual(REEF_SIGHT_SAMPLES);
      expect(sightLabel(id)).toBe(some[0].label);
    }
  });

  it('names every sight once, with stable journal ids', () => {
    const ids = SIGHTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9][a-z0-9:._-]{0,79}$/);
    for (const s of Object.values(CRUISE_SPECIES))
      expect(sightLabel(creatureSight(s.id))).toBe(s.name);
    expect(sightLabel('species:unknown')).toBeNull();
  });

  it('lists what was seen by name and first date, oldest first, skipping unknown ids', () => {
    expect(
      seenList([
        { id: 'species:green-sea-turtle', first: '2026-11-11T10:00:00.000Z' },
        {
          id: 'species:from-a-later-version',
          first: '2026-11-10T10:00:00.000Z',
        },
        { id: 'coral:sea-fan', first: '2026-11-09T10:00:00.000Z' },
        { id: 'coral:soft', first: '2026-11-09T10:00:00.000Z' },
      ]),
    ).toEqual([
      { label: 'Sea fan', first: '2026-11-09T10:00:00.000Z' },
      { label: 'Soft coral', first: '2026-11-09T10:00:00.000Z' },
      { label: 'Green sea turtle', first: '2026-11-11T10:00:00.000Z' },
    ]);
    expect(seenList([])).toEqual([]);
  });
});
