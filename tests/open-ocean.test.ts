import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ICE, KELP, OUTER } from '../src/config/passage';
import { BARRACUDA } from '../src/creatures/barracuda';
import { TREVALLY } from '../src/environment/outer/ReefLife';
import { CLEANING, GREAT_WHITE } from '../src/creatures/reefEncounters';
import { easeInIce } from '../src/environment/ice/IceTerrain';
import { easeInKelp } from '../src/environment/kelp/KelpTerrain';
import { KelpEnvironment } from '../src/environment/kelp/KelpEnvironment';
import {
  OUTER_CRUISERS,
  outerCruisers,
} from '../src/environment/outer/OuterCreatures';
import { reefObstacles } from '../src/environment/outer/OuterReef';
import { outerReefLayout } from '../src/environment/outer/OuterReefLayout';
import { easeAtEdges } from '../src/environment/outer/OuterTerrain';
import { OUTER_HORIZON, outerHorizon } from '../src/environment/outer/OuterHorizon';
import { TankGlass, glassFade } from '../src/environment/shared/TankGlass';
import { WALL_VISITORS } from '../src/environment/outer/WallVisitors';
import { LANES } from '../src/environment/outer/PassingLanes';

/**
 * v0.6 Pass 053: open-ocean freedom and boundaries. The swimmer can go further and meets natural
 * limits; nothing new lets them out of valid space; the wildlife stays where it belongs; the far
 * silhouettes stay far.
 */
const v = (x: number, y: number, z: number) => ({ x, y, z });
/** Swim with `dir` from `p` for `seconds` at 1 m/s, easing as the world does; where it ends. */
function swim(
  ease: (p: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }) => unknown,
  p: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  seconds = 60,
) {
  const at = { ...p };
  for (let t = 0; t < seconds * 30; t++) {
    const d = { ...dir };
    ease(at, d);
    at.x += d.x / 30;
    at.y += d.y / 30;
    at.z += d.z / 30;
  }
  return at;
}

describe('Pass 053: the outer reef opens out', () => {
  it('lets the swimmer out over the drop-off and down the wall further, and still stops before the glass', () => {
    const out = swim(easeAtEdges, v(0, 2, -50), v(0, 0, -1));
    // Past the reef's lip, hanging out over the blue (was about -59).
    expect(out.z).toBeLessThan(-61.5);
    expect(out.z).toBeGreaterThan(OUTER.glass.z + OUTER.glass.gap - 0.05);
    const down = swim(easeAtEdges, v(0, 0, -60), v(0, -1, 0));
    expect(down.y).toBeLessThan(-9);
    expect(down.y).toBeGreaterThan(OUTER.reach.down - OUTER.reach.depth - 2.5);
  });
  it('eases to a hover at the sides well inside the reef, which carries on beyond it', () => {
    const side = swim(easeAtEdges, v(20, 3, -45), v(1, 0, 0));
    expect(side.x).toBeLessThan(OUTER.glass.halfWidth - OUTER.glass.gap);
    expect(side.x).toBeGreaterThan(OUTER.reach.halfWidth);
    // The reef is built out past where the swimmer stops, so the side is reef fading into haze.
    expect(OUTER.reef.maxX).toBeGreaterThan(side.x + 10);
  });
  it('keeps every big animal outside the glass (the turtles live on the reef, inside)', () => {
    const layout = outerReefLayout(),
      obstacles = reefObstacles(layout.placements),
      p = { x: 0, y: 0, z: 0 };
    for (const c of outerCruisers(obstacles, OUTER_CRUISERS)) {
      for (let d = 0; d < c.route.length; d += 1) {
        c.route.at(d, p);
        if (c.species.id === 'green-sea-turtle') {
          expect(p.z).toBeGreaterThan(OUTER.glass.z + 2);
        } else expect(p.z + c.species.radius).toBeLessThan(OUTER.glass.z);
      }
    }
    // Wall visitors: their lanes are placed relative to the glass, so they follow it out.
    expect(LANES.close).toBeGreaterThan(1);
    for (const g of Object.values(WALL_VISITORS))
      expect(Math.max(...g.waypoints.map((w) => w.z))).toBeLessThan(OUTER.glass.z + 8);
    // Encounters beyond the glass are measured from it.
    expect(OUTER.glass.z - CLEANING.station.out).toBeLessThan(OUTER.glass.z);
    expect(GREAT_WHITE.gap).toBeGreaterThan(0);
    expect(BARRACUDA.out).toBeGreaterThan(0);
    expect(TREVALLY.out).toBeGreaterThan(0);
  });
  it('shows a frameless window that fades in only near it', () => {
    expect(glassFade(0.5)).toBeCloseTo(1, 5);
    expect(glassFade(20)).toBeLessThan(0.15);
    for (let d = 0; d < 20; d += 0.5) expect(glassFade(d + 0.5)).toBeLessThanOrEqual(glassFade(d) + 1e-9);
    const glass = new TankGlass(
      [{ x: 0, y: 0, z: -10, width: 16, height: 8, yaw: 0 }],
      'test',
      { frame: false },
    );
    const names: string[] = [];
    glass.root.traverse((o) => names.push(o.name));
    expect(names.some((n) => / post| bar/.test(n))).toBe(false);
    glass.update(new THREE.Vector3(0, 0, -9));
    glass.dispose();
  });
  it('places its far silhouettes and passing shapes well beyond anywhere the swimmer can reach', () => {
    const reach = {
      minX: -OUTER.glass.halfWidth,
      maxX: OUTER.glass.halfWidth,
      minZ: OUTER.glass.z,
      maxZ: OUTER.cliffZ,
    };
    const away = (x: number, z: number) =>
      Math.hypot(
        Math.max(reach.minX - x, 0, x - reach.maxX),
        Math.max(reach.minZ - z, 0, z - reach.maxZ),
      );
    const h = outerHorizon();
    for (const s of h.silhouettes)
      for (const a of s.at) expect(away(a.x, a.z), JSON.stringify(a)).toBeGreaterThan(OUTER_HORIZON.clear);
    for (const p of h.passers) {
      for (let t = 0; t < Math.PI * 2; t += 0.1) {
        const x = p.centre.x + Math.cos(t) * p.rx,
          z = p.centre.z + Math.sin(t) * p.rz;
        expect(away(x, z)).toBeGreaterThan(OUTER_HORIZON.clear);
      }
    }
  });
});

describe('Pass 053: the walled worlds let the swimmer reach their walls', () => {
  it('kelp forest: full speed until near the rock, and solid colliders just inside the wall face', () => {
    const side = swim(easeInKelp, v(10, 5, -35), v(1, 0, 0), 30);
    expect(side.x).toBeGreaterThan(KELP.walls.x - 3);
    const far = swim(easeInKelp, v(0, 5, -40), v(0, 0, -1), 30);
    expect(far.z).toBeLessThan(KELP.walls.farZ + 3.5);
    const env = new KelpEnvironment();
    const walls = env.colliders.filter(
      (c) => c.min.x >= KELP.walls.x - 1.5 || c.max.x <= -KELP.walls.x + 1.5 || c.max.z <= KELP.walls.farZ + 1.5,
    );
    expect(walls.length).toBeGreaterThanOrEqual(3);
    for (const c of walls)
      if (c.min.x >= KELP.walls.x - 1.5) expect(c.min.x).toBeLessThan(KELP.walls.x);
    env.dispose();
  });
  it('under the ice: the slowing starts close to the icebergs (they are solid there)', () => {
    const side = swim(easeInIce, v(10, 6, -30), v(1, 0, 0), 30);
    expect(side.x).toBeGreaterThan(ICE.walls.x - 3.6);
    const fast = { x: 1, y: 0, z: 0 };
    easeInIce(v(ICE.walls.x - ICE.ease.inset - 0.1, 6, -30), fast);
    expect(fast.x).toBe(1);
  });
});
