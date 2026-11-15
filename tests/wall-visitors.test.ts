import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AssetLoader } from '../src/assets/AssetLoader';
import { ASSET_REGISTRY } from '../src/assets/AssetRegistry';
import { CRUISE_SPECIES } from '../src/config/creatures';
import { OUTER } from '../src/config/passage';
import { VISITING, WALL_VISITOR_IDS } from '../src/config/visitors';
import type { Vec3 } from '../src/config/world';
import {
  atWallEdge,
  entryDistance,
  loadVisits,
  saveVisits,
  visitorOrder,
  visitorsDue,
  type VisitStore,
} from '../src/creatures/wallVisitors';
import type { SightCandidate } from '../src/discovery/journal';
import { SIGHTS, creatureSight, sightLabel } from '../src/discovery/sights';
import {
  outerCruisers,
  reefObstacles,
} from '../src/environment/outer/OuterCreatures';
import { outerReefLayout } from '../src/environment/outer/OuterReefLayout';
import {
  WALL_VISITORS,
  WallVisitors,
  hiddenMargin,
} from '../src/environment/outer/WallVisitors';
import type { PlayerPresence } from '../src/fish/FishDiverReaction';
import { assetFixture } from './fixtures/assetFixture';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const lip = OUTER.dropOff.start;
/** The furthest the swimmer can go past the lip (the swimmer-only wall). */
const edgeZ =
  lip - OUTER.reach.past - OUTER.reach.stop - OUTER.bounds.clearance;
const widest = OUTER.reach.halfWidth + OUTER.reach.side;
const obstacles = reefObstacles(outerReefLayout().placements);
const groups = WALL_VISITOR_IDS.map((id) => WALL_VISITORS[id]);
/** Where a swimmer might rest at the edge: along the lip, over it, at its foot. */
const edgeSpots = [-widest, -18, -6, 0, 9, 22, widest].flatMap((x) => [
  v(x, 1.2, edgeZ),
  v(x, 3.5, lip - 1),
  v(x, -4, edgeZ + 0.3),
  v(x, -9, edgeZ + 0.3),
]);

describe('Pass 033 wall visitors: who comes, and when', () => {
  it('opens each visit with a different animal, and brings all five', () => {
    const firsts = new Set<string>();
    for (let visit = 0; visit < 40; visit++) {
      const order = visitorOrder(visit);
      expect([...order].sort()).toEqual([...WALL_VISITOR_IDS].sort());
      expect(visitorOrder(visit)).toEqual(order);
      expect(order[0]).not.toBe(visitorOrder(visit + 1)[0]);
      if (visit < WALL_VISITOR_IDS.length) firsts.add(order[0]);
    }
    // Five visits in a row open with each of the five.
    expect(firsts.size).toBe(WALL_VISITOR_IDS.length);
    // The rest are not always in the same order.
    const tails = new Set(
      Array.from({ length: 20 }, (_, i) => visitorOrder(i).slice(1).join()),
    );
    expect(tails.size).toBeGreaterThan(5);
    // Nonsense visit numbers still give a full order.
    for (const odd of [Number.NaN, -3, 2.7, Number.MAX_SAFE_INTEGER])
      expect(visitorOrder(odd)).toHaveLength(WALL_VISITOR_IDS.length);
  });
  it('brings one more kind the longer the swimmer stays at the edge', () => {
    expect(visitorsDue(0)).toBe(0);
    expect(visitorsDue(VISITING.first - 0.01)).toBe(0);
    expect(visitorsDue(VISITING.first)).toBe(1);
    expect(visitorsDue(VISITING.first + VISITING.interval - 0.01)).toBe(1);
    expect(visitorsDue(VISITING.first + VISITING.interval)).toBe(2);
    expect(visitorsDue(VISITING.first + 4 * VISITING.interval)).toBe(5);
    expect(visitorsDue(1e9)).toBe(WALL_VISITOR_IDS.length);
    expect(visitorsDue(Number.NaN)).toBe(0);
  });
  it('counts as at the edge only near the lip, across the reef', () => {
    for (const p of edgeSpots)
      expect(atWallEdge(p), JSON.stringify(p)).toBe(true);
    expect(atWallEdge(v(0, 2, lip + VISITING.near + 1))).toBe(false);
    expect(atWallEdge(v(0, 7, OUTER.cliffZ - 2))).toBe(false);
    expect(atWallEdge(v(widest + 1, 1, edgeZ))).toBe(false);
  });
  it('keeps its visit counter through absent, corrupt and unavailable storage', () => {
    const map = new Map<string, string>(),
      store: VisitStore = {
        getItem: (k) => map.get(k) ?? null,
        setItem: (k, value) => void map.set(k, value),
      };
    expect(loadVisits(store)).toBe(0);
    expect(saveVisits(store, 3)).toBe(true);
    expect(loadVisits(store)).toBe(3);
    for (const bad of ['-2', 'three', '1.5', '1e400', '{}']) {
      map.set(VISITING.storageKey, bad);
      expect(loadVisits(store)).toBe(0);
    }
    const broken: VisitStore = {
      getItem: () => {
        throw Error('denied');
      },
      setItem: () => {
        throw Error('full');
      },
    };
    expect(loadVisits(broken)).toBe(0);
    expect(saveVisits(broken, 4)).toBe(false);
  });
  it('lists each visitor as a sight with its own name', () => {
    expect(sightLabel('species:manta-ray')).toBe('Reef manta ray');
    expect(sightLabel('species:whale-shark')).toBe('Whale shark');
    expect(sightLabel('species:humpback-whale')).toBe('Humpback whale');
    expect(sightLabel('species:great-hammerhead')).toBe('Great hammerhead');
    expect(sightLabel('species:scalloped-hammerhead')).toBe(
      'Scalloped hammerhead',
    );
    expect(new Set(SIGHTS.map((s) => s.id)).size).toBe(SIGHTS.length);
    for (const id of WALL_VISITOR_IDS)
      expect(ASSET_REGISTRY[CRUISE_SPECIES[id].asset].requireMorphs).toBe(true);
  });
});

describe('Pass 033 wall visitors: their loops', () => {
  const cruisers = outerCruisers(obstacles, groups);
  const leaders = WALL_VISITOR_IDS.map((id) =>
    cruisers.find((c) => c.species.id === id)!,
  );
  it('pass back and forth in the blue beyond the lip, turning out of reach at the sides', () => {
    expect(cruisers).toHaveLength(
      groups.reduce((n, g) => n + g.members.length, 0),
    );
    expect(
      cruisers.filter((c) => c.species.id === 'scalloped-hammerhead'),
    ).toHaveLength(12);
    for (const c of leaders) {
      const p = v(0, 0, 0);
      let towards = 0,
        back = 0;
      for (let d = 0; d < c.route.length; d += 0.5) {
        c.route.at(d, p);
        // Always out past the wall's face, beyond where the swimmer can go.
        expect(p.z, c.species.id).toBeLessThan(edgeZ - 3);
        // Clear of the wall and reef beneath, and of the far surface.
        expect(p.y - c.species.radius).toBeGreaterThan(
          obstacles(p.x, p.z, 0.5),
        );
        expect(p.y).toBeLessThan(OUTER.reach.up);
        // Within the reef's width it runs along the wall, one way or the other.
        if (Math.abs(p.x) < widest) {
          const t = c.route.direction(d, v(0, 0, 0));
          if (t.x > 0.9) towards++;
          else if (t.x < -0.9) back++;
          else throw Error(`${c.species.id} turns in sight at x ${p.x}`);
        }
      }
      expect(towards).toBeGreaterThan(0);
      expect(back).toBeGreaterThan(0);
    }
  });
  it('never fly through each other: lanes apart in depth or distance from the wall', () => {
    const p = v(0, 0, 0),
      q = v(0, 0, 0);
    for (let i = 0; i < leaders.length; i++)
      for (let k = i + 1; k < leaders.length; k++) {
        const a = leaders[i],
          b = leaders[k];
        let closest = Infinity;
        for (let d = 0; d < a.route.length; d += 1) {
          a.route.at(d, p);
          for (let e = 0; e < b.route.length; e += 1) {
            b.route.at(e, q);
            closest = Math.min(
              closest,
              Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z),
            );
          }
        }
        expect(closest, `${a.species.id} / ${b.species.id}`).toBeGreaterThan(
          a.species.radius * 0.5 + b.species.radius * 0.5,
        );
      }
  });
  it('arrive out of sight, wherever the swimmer waits, and soon swim past them', () => {
    const p = v(0, 0, 0);
    leaders.forEach((c, i) => {
      const id = WALL_VISITOR_IDS[i],
        hidden =
          VISITING.hidden + hiddenMargin(WALL_VISITORS[id], c.species.scale),
        best = new Map<number, number>();
      for (const eye of edgeSpots) {
        const start = entryDistance(c.route, eye, p, VISITING.lead, hidden);
        c.route.at(start, p);
        expect(
          Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z),
          `${id} from ${JSON.stringify(eye)}`,
        ).toBeGreaterThanOrEqual(hidden);
        let nearest = Infinity;
        for (let t = 0; t < 90; t += 0.5) {
          c.route.at(start + c.species.speed * t, p);
          nearest = Math.min(
            nearest,
            Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z) -
              c.species.radius,
          );
        }
        best.set(eye.x, Math.min(best.get(eye.x) ?? Infinity, nearest));
      }
      // Within a minute and a half of swimming it passes within clear sight of the swimmer at one
      // of the depths along the edge (the haze leaves about half of anything 7 m away, a third at
      // 9 m), wherever along the edge they are.
      for (const [x, nearest] of best)
        expect(nearest, `${id} at x ${x}`).toBeLessThan(9);
    });
  });
});

/** The test fixture model, named and sized as the visitor model at `url` is. */
function visitorFixture(url: string) {
  const asset = assetFixture(),
    spec = Object.values(ASSET_REGISTRY).find((s) => url.endsWith(s.path)),
    root = asset.scene.getObjectByName('Chromis_Root'),
    body = asset.scene.getObjectByName('Body');
  if (!spec || !root || !(body instanceof THREE.Mesh)) throw Error(url);
  root.name = spec.requiredNodes[0];
  // Every mesh shares the box: scale it once to the middle of the allowed size.
  const k = (spec.minDimension + spec.maxDimension) / 2 / 0.46;
  body.geometry.scale(k, k, k);
  return asset;
}

describe('Pass 033 wall visitors: on the reef', () => {
  const player = (p: Vec3): PlayerPresence => ({
    position: p,
    velocity: v(0, 0, 0),
    active: true,
  });
  const camera = (p: Vec3) => {
    const c = new THREE.PerspectiveCamera();
    c.position.set(p.x, p.y, p.z);
    c.updateMatrixWorld();
    return c;
  };
  it('come one by one while the swimmer waits at the edge, each out of sight, and start over on the next visit', async () => {
    const sightings: SightCandidate[] = [],
      loader = new AssetLoader(async (url) => visitorFixture(url)),
      w = new WallVisitors(obstacles, loader, sightings);
    try {
      expect(await w.ready).toBe(true);
      w.arrive(2);
      const order = visitorOrder(2);
      expect(w.order).toEqual(order);
      // Away from the edge, nobody comes however long the swimmer stays.
      const back = v(0, 2, OUTER.cliffZ - 6),
        edge = v(-6, 1.2, edgeZ);
      for (let i = 0; i < 30 * 60; i++)
        w.update(1 / 30, true, false, player(back), camera(back), back);
      expect(w.arrived).toBe(0);
      for (const id of WALL_VISITOR_IDS) expect(w.isHere(id)).toBe(false);
      expect(w.creatures.root.children.filter((c) => c.visible)).toHaveLength(
        0,
      );
      // Paused at the edge, time does not count.
      for (let i = 0; i < 30 * 60; i++)
        w.update(1 / 30, false, false, player(edge), camera(edge), edge);
      expect(w.arrived).toBe(0);
      // At the edge: the first after `first` seconds, then one more each interval.
      const seen = new Set<string>();
      for (
        let i = 0;
        i < 30 * (VISITING.first + 4 * VISITING.interval + 1);
        i++
      ) {
        const before = w.arrived;
        w.update(1 / 30, true, false, player(edge), camera(edge), edge);
        if (w.arrived > before) {
          const id = w.order[before];
          expect(id).toBe(order[before]);
          expect(w.isHere(id)).toBe(true);
          // Every member of it starts out of sight.
          w.creatures.cruisers.forEach((c, k) => {
            if (WALL_VISITOR_IDS[w.creatures.groupOf[k]] !== id) return;
            const p = c.position;
            expect(
              Math.hypot(p.x - edge.x, p.y - edge.y, p.z - edge.z),
            ).toBeGreaterThan(VISITING.hidden);
          });
          seen.add(id);
        }
      }
      expect(seen.size).toBe(WALL_VISITOR_IDS.length);
      expect(w.arrived).toBe(WALL_VISITOR_IDS.length);
      // Each one that has come can be seen (the school as one sight with twelve candidates).
      const ids = new Set(sightings.map((s) => s.id));
      for (const id of WALL_VISITOR_IDS)
        expect(ids.has(creatureSight(id))).toBe(true);
      expect(sightings).toHaveLength(w.creatures.cruisers.length);
      // They swim: the first to come has moved along its loop.
      const first =
          w.creatures.cruisers[
            w.creatures.groupOf.indexOf(WALL_VISITOR_IDS.indexOf(order[0]))
          ],
        was = { ...first.position };
      for (let i = 0; i < 60; i++)
        w.update(1 / 30, true, false, player(edge), camera(edge), edge);
      expect(
        Math.hypot(first.position.x - was.x, first.position.z - was.z),
      ).toBeGreaterThan(1.5);
      // The next visit starts over: nobody here, no sights, a different first animal.
      w.arrive(3);
      w.update(1 / 30, true, false, player(back), camera(back), back);
      expect(w.arrived).toBe(0);
      expect(sightings).toHaveLength(0);
      expect(w.creatures.root.children.filter((c) => c.visible)).toHaveLength(
        0,
      );
      expect(w.order[0]).not.toBe(order[0]);
    } finally {
      w.dispose();
      w.dispose();
      loader.dispose();
    }
    expect(w.creatures.root.children).toHaveLength(0);
  });
});
