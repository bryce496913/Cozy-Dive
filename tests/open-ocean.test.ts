import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ICE, KELP, OUTER } from '../src/config/passage';
import { BARRACUDA } from '../src/creatures/barracuda';
import { CLEANING, GREAT_WHITE } from '../src/creatures/reefEncounters';
import { easeInIce } from '../src/environment/ice/IceTerrain';
import { easeInKelp } from '../src/environment/kelp/KelpTerrain';
import {
  KELP_WALL_FACE,
  KelpEnvironment,
} from '../src/environment/kelp/KelpEnvironment';
import {
  OUTER_CRUISERS,
  outerCruisers,
  reefObstacles,
} from '../src/environment/outer/OuterCreatures';
import {
  OUTER_HORIZON,
  outerHorizon,
} from '../src/environment/outer/OuterHorizon';
import { outerReefLayout } from '../src/environment/outer/OuterReefLayout';
import { easeAtEdges } from '../src/environment/outer/OuterTerrain';
import { PassingLanes } from '../src/environment/outer/PassingLanes';
import { TREVALLY } from '../src/environment/outer/ReefLife';
import { WALL_VISITORS } from '../src/environment/outer/WallVisitors';
import { TankGlass, glassFade } from '../src/environment/shared/TankGlass';

/**
 * v0.6 Pass 052B: open-ocean freedom and boundaries. The swimmer can go further and meets natural
 * limits; nothing new lets them out of valid space; the wildlife stays where it belongs; the far
 * silhouettes stay far.
 */
type V = { x: number; y: number; z: number };
const v = (x: number, y: number, z: number): V => ({ x, y, z });
/**
 * Swim with `dir` from `p` for `seconds` at 1 m/s, easing as the world does and clamped to the
 * swimmer's collision box (its camera clearance already taken off); where it ends.
 */
function swim(
  ease: (p: V, d: V) => unknown,
  p: V,
  dir: V,
  seconds = 60,
  box?: { min: V; max: V },
): V {
  const at = { ...p };
  for (let t = 0; t < seconds * 30; t++) {
    const d = { ...dir };
    ease(at, d);
    at.x += d.x / 30;
    at.y += d.y / 30;
    at.z += d.z / 30;
    if (box)
      for (const k of ['x', 'y', 'z'] as const)
        at[k] = Math.min(box.max[k], Math.max(box.min[k], at[k]));
  }
  return at;
}
/** The outer reef swimmer's collision box, as `OuterWatersScene` builds it, less clearance. */
const outerBox = {
  min: v(
    -OUTER.glass.halfWidth + OUTER.glass.gap,
    OUTER.bounds.min.y + OUTER.bounds.clearance,
    OUTER.glass.z + OUTER.glass.gap,
  ),
  max: v(
    OUTER.glass.halfWidth - OUTER.glass.gap,
    OUTER.bounds.max.y - OUTER.bounds.clearance,
    OUTER.bounds.max.z - OUTER.bounds.clearance,
  ),
};

describe('Pass 052B: the outer reef opens out', () => {
  it('lets the swimmer out over the drop-off and down the wall further, and still stops before the glass', () => {
    const out = swim(easeAtEdges, v(0, 2, -50), v(0, 0, -1), 60, outerBox);
    // Hover just off the reef lip, close to the shoreward glass.
    expect(out.z).toBeLessThan(OUTER.dropOff.start);
    expect(out.z).toBeLessThan(OUTER.glass.z + OUTER.glass.gap + 0.1);
    expect(out.z).toBeGreaterThanOrEqual(OUTER.glass.z + OUTER.glass.gap);
    const down = swim(easeAtEdges, v(0, 0, -60), v(0, -1, 0), 60, outerBox);
    expect(down.y).toBeLessThan(-9);
    expect(down.y).toBeGreaterThan(
      OUTER.reach.down - OUTER.reach.depth - OUTER.reach.stop - 0.1,
    );
  });
  it('eases to a hover at the sides well inside the reef, which carries on beyond it', () => {
    const side = swim(easeAtEdges, v(20, 3, -45), v(1, 0, 0), 60, outerBox);
    expect(side.x).toBeLessThanOrEqual(OUTER.glass.halfWidth - OUTER.glass.gap);
    expect(side.x).toBeGreaterThan(OUTER.reach.halfWidth);
    // The reef is built out past where the swimmer stops, so the flank is reef fading into haze.
    expect(OUTER.reef.maxX).toBeGreaterThan(side.x + 10);
  });
  it('keeps every big animal outside the glass, and leaves the turtles on the reef', () => {
    const layout = outerReefLayout(),
      obstacles = reefObstacles(layout.placements),
      p = { x: 0, y: 0, z: 0 },
      cruisers = outerCruisers(obstacles, OUTER_CRUISERS),
      groupOf = OUTER_CRUISERS.flatMap((g, i) => g.members.map(() => i)),
      residents = OUTER_CRUISERS.map((g) => !!g.resident);
    // As the game places them: the passers on lanes beyond the glass, the turtles left on the reef
    // (before Pass 052B their lane shift carried them out into the blue).
    new PassingLanes(cruisers, groupOf, undefined, residents);
    for (const c of cruisers)
      for (let d = 0; d < c.route.length; d += 1) {
        c.route.at(d, p);
        const z = p.z + c.lane;
        if (c.species.id === 'green-sea-turtle') {
          expect(c.lane).toBe(0);
          expect(z).toBeGreaterThan(OUTER.glass.z + 2);
          expect(z).toBeLessThan(OUTER.cliffZ - 4);
        } else
          expect(z + c.species.radius + Math.abs(c.placementSide)).toBeLessThan(
            OUTER.glass.z + 1e-6,
          );
      }
    // Wall visitors pass well out (their lanes are also measured from the glass).
    for (const g of Object.values(WALL_VISITORS))
      expect(Math.max(...g.waypoints.map((w) => w.z))).toBeLessThan(
        OUTER.glass.z + 8,
      );
    // Encounters beyond the glass are measured out from it.
    for (const out of [
      CLEANING.station.out,
      GREAT_WHITE.gap,
      BARRACUDA.out,
      TREVALLY.out,
    ])
      expect(out).toBeGreaterThan(0);
  });
  it('shows a frameless window that fades in only near it', () => {
    expect(glassFade(0.5)).toBeCloseTo(1, 5);
    expect(glassFade(20)).toBeLessThan(0.15);
    for (let d = 0; d < 20; d += 0.5)
      expect(glassFade(d + 0.5)).toBeLessThanOrEqual(glassFade(d) + 1e-9);
    const glass = new TankGlass(
      [{ x: 0, y: 0, z: -10, width: 16, height: 8, yaw: 0 }],
      'test',
      { frame: false, fade: true },
    );
    const names: string[] = [];
    glass.root.traverse((o) => names.push(o.name));
    expect(names.some((n) => / post| bar/.test(n))).toBe(false);
    const pane = glass.root.getObjectByName('test pane');
    if (!(pane instanceof THREE.Mesh)) throw Error('no pane');
    const material: unknown = pane.material;
    if (!(material instanceof THREE.MeshBasicMaterial)) throw Error('no glass');
    glass.update(new THREE.Vector3(0, 0, -10.5));
    expect(material.opacity).toBeCloseTo(1, 5);
    glass.update(new THREE.Vector3(0, 0, 10));
    expect(material.opacity).toBeLessThan(0.15);
    glass.dispose();
  });
  it('places its far silhouettes and passing shapes well beyond anywhere the swimmer can reach', () => {
    const away = (x: number, z: number) =>
      Math.hypot(
        Math.max(outerBox.min.x - x, 0, x - outerBox.max.x),
        Math.max(outerBox.min.z - z, 0, z - OUTER.cliffZ),
      );
    const h = outerHorizon();
    for (const s of h.silhouettes)
      for (const a of s.at)
        expect(away(a.x, a.z), JSON.stringify(a)).toBeGreaterThan(
          OUTER_HORIZON.clear,
        );
    for (const p of h.passers)
      for (let t = 0; t < Math.PI * 2; t += 0.1)
        expect(
          away(
            p.centre.x + Math.cos(t) * p.rx,
            p.centre.z + Math.sin(t) * p.rz,
          ),
        ).toBeGreaterThan(OUTER_HORIZON.clear);
  });
});

describe('Pass 052B: the walled worlds let the swimmer reach their walls', () => {
  it('kelp forest: full speed until near the rock, and solid colliders just inside the wall face', () => {
    const side = swim(easeInKelp, v(10, 5, -35), v(1, 0, 0), 30);
    expect(side.x).toBeGreaterThan(KELP.walls.x - 3);
    const far = swim(easeInKelp, v(0, 5, -40), v(0, 0, -1), 30);
    expect(far.z).toBeLessThan(KELP.walls.farZ + 3.5);
    // Moving out from the middle at full speed until 3 m short of the wall.
    const fast = v(1, 0, 0);
    easeInKelp(v(KELP.walls.x - 3.5, 5, -35), fast);
    expect(fast.x).toBe(1);
    const env = new KelpEnvironment();
    const inner = KELP.walls.x - KELP_WALL_FACE;
    expect(env.colliders.some((c) => Math.abs(c.min.x - inner) < 1e-6)).toBe(
      true,
    );
    expect(env.colliders.some((c) => Math.abs(c.max.x + inner) < 1e-6)).toBe(
      true,
    );
    expect(
      env.colliders.some(
        (c) => Math.abs(c.max.z - (KELP.walls.farZ + KELP_WALL_FACE)) < 1e-6,
      ),
    ).toBe(true);
    env.dispose();
  });
  it('under the ice: the slowing starts close to the icebergs (they are solid there)', () => {
    const fast = v(1, 0, 0);
    easeInIce(v(ICE.walls.x - ICE.ease.inset - 0.1, 6, -30), fast);
    expect(fast.x).toBe(1);
    expect(ICE.ease.inset).toBeLessThan(4);
  });
});
