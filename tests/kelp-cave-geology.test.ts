import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ASSET_REGISTRY } from '../src/assets/AssetRegistry';
import { KelpEnvironment } from '../src/environment/kelp/KelpEnvironment';
import {
  ROCK_HOLDFAST,
  inRock,
  stalkPlacements,
  wallStalkPlacements,
} from '../src/environment/kelp/KelpStalks';
import { CaveEnvironment } from '../src/environment/cave/CaveEnvironment';
import { onBoulder } from '../src/environment/kelp/KelpDressing';
import { KELP as KELP_WORLD } from '../src/config/passage';
import { CollisionWorld } from '../src/player/collision';
import { geologyAsset, testGeology } from '../validation/geologyModel';

/** V0.8 Pass 091: the kelp forest's and sea cave's authored geology. */
const asset = geologyAsset();
const KELP = [0, 1, 2, 3, 4, 5].map((i) => `KelpRock_${i}`),
  CAVE = [0, 1, 2, 3, 4, 5].map((i) => `CaveRock_${i}`),
  PILLARS = ['CavePillar_0', 'CavePillar_1'];

const tris = (name: string) => asset.primitive(name).indices.length / 3;
/** Outline of a variant seen from above: radius from its centre at 32 headings, over its mean. */
function plan(name: string): number[] {
  const p = asset.primitive(name).positions,
    r = new Array<number>(32).fill(0);
  let cx = 0,
    cz = 0;
  for (let i = 0; i < p.length; i += 3) {
    cx += p[i];
    cz += p[i + 2];
  }
  cx /= p.length / 3;
  cz /= p.length / 3;
  for (let i = 0; i < p.length; i += 3) {
    const dx = p[i] - cx,
      dz = p[i + 2] - cz,
      k =
        Math.floor(((Math.atan2(dz, dx) + Math.PI) / (Math.PI * 2)) * 32) % 32;
    r[k] = Math.max(r[k], Math.hypot(dx, dz));
  }
  const mean = r.reduce((s, x) => s + x, 0) / 32;
  return r.map((x) => x / mean);
}

describe('V0.8 Pass 091 kelp and cave geology', () => {
  it('ships six kelp rocks, six cave rocks and two pillars, each with collision parts', () => {
    for (const name of [...KELP, ...CAVE, ...PILLARS]) {
      expect(asset.has(name), name).toBe(true);
      const hulls = asset
        .children(`${name}_Root`)
        .filter((n) => n.name.startsWith('COLLIDER_'));
      expect(hulls.length, name).toBeGreaterThan(0);
    }
    expect(ASSET_REGISTRY.geology.requiredNodes).toContain('CavePillar_1');
  });

  it('keeps every variant within its triangle budget (optimized, not dense sculpts)', () => {
    for (const name of [...KELP, ...CAVE])
      expect(tris(name), name).toBeLessThanOrEqual(2500);
    for (const name of PILLARS)
      expect(tris(name), name).toBeLessThanOrEqual(6200);
  });

  it('gives each rock its own asymmetric outline, not one repeated round boulder', () => {
    for (const family of [KELP, CAVE]) {
      const shapes = family.map(plan);
      for (const s of shapes) {
        // A round ovoid's outline varies a few per cent; a fractured, layered rock's far more.
        const spread = Math.max(...s) - Math.min(...s);
        expect(spread).toBeGreaterThan(0.25);
      }
      for (let i = 0; i < shapes.length; i++)
        for (let j = i + 1; j < shapes.length; j++) {
          const d = shapes[i].reduce(
            (t, x, k) => t + Math.abs(x - shapes[j][k]),
            0,
          );
          expect(d, `${family[i]} vs ${family[j]}`).toBeGreaterThan(1);
        }
    }
  });

  it('places authored rock in the kelp forest and the cave, with their collision', () => {
    const geology = testGeology();
    for (const [authored, code] of [
      [new KelpEnvironment(geology), new KelpEnvironment()],
      [new CaveEnvironment(geology), new CaveEnvironment()],
    ] as const) {
      const rock = (e: KelpEnvironment | CaveEnvironment) => {
        let n = 0;
        e.root.traverse((o) => {
          if (o instanceof THREE.Mesh && /boulders/.test(o.name))
            n = o.geometry.getAttribute('position').count;
        });
        return n;
      };
      // More detailed rock than the code-built 506-triangle boulders, and as solid.
      expect(rock(authored)).toBeGreaterThan(rock(code) * 2);
      expect(authored.colliders.length).toBeGreaterThanOrEqual(
        code.colliders.length,
      );
      authored.dispose();
      code.dispose();
    }
  }, 60_000);

  it('roots every kelp holdfast in the sand round a rock, never in it', () => {
    const env = new KelpEnvironment(testGeology()),
      rocks = [...env.boulders, ...env.wallRocks],
      stalks = [
        ...stalkPlacements(undefined, undefined, rocks),
        ...wallStalkPlacements(undefined, rocks),
      ];
    for (const s of stalks) expect(inRock(s.x, s.z, rocks)).toBe(false);
    // The forest is as full as before (the kelp grows round the rocks rather than being thinned),
    // and the wall thicket nearly so: it only leaves bare a few stretches of piled rock.
    expect(stalkPlacements(undefined, undefined, rocks).length).toBe(
      stalkPlacements().length,
    );
    expect(wallStalkPlacements(undefined, rocks).length).toBeGreaterThan(
      wallStalkPlacements().length * 0.85,
    );
    // And some grip the sand right at a rock's foot, so rock and kelp read as one habitat.
    const atFoot = stalks.filter((s) =>
      rocks.some(
        (r) =>
          Math.hypot(r.x - s.x, r.z - s.z) <
          r.size * ROCK_HOLDFAST.share + ROCK_HOLDFAST.margin + 1,
      ),
    ).length;
    expect(atFoot).toBeGreaterThan(20);
    env.dispose();
  });

  it('seats the sea stars, anemones and nudibranchs on the authored rock, not on an old ovoid', () => {
    const env = new KelpEnvironment(testGeology()),
      world = new CollisionWorld(env.colliders, KELP_WORLD.bounds, 0.01),
      solid = (x: number, y: number, z: number) =>
        world.colliders.some((c) => world.contains(c, x, y, z));
    /** Shares of seats with no rock 0.25 m behind them, and with rock 0.4 m in front of them. */
    const measure = (surface: boolean) => {
      let floating = 0,
        buried = 0,
        n = 0;
      for (const b0 of env.boulders) {
        expect(
          b0.surface,
          'authored boulders carry their surface',
        ).toBeDefined();
        const b = surface ? b0 : { ...b0, surface: undefined };
        for (let i = 0; i < 24; i++) {
          const s = onBoulder(b, i * 0.26, 0.3 + (i % 4) * 0.33);
          n++;
          if (!solid(s.x - s.nx * 0.25, s.y - s.ny * 0.25, s.z - s.nz * 0.25))
            floating++;
          if (solid(s.x + s.nx * 0.4, s.y + s.ny * 0.4, s.z + s.nz * 0.4))
            buried++;
        }
      }
      return { floating: floating / n, buried: buried / n };
    };
    const real = measure(true),
      ovoid = measure(false);
    // The old ellipsoid seats would leave a quarter of the life hanging off the fractured rock
    // (0.25 when measured); on its real surface very few are (0.07). The collision hulls are
    // convex, so a seat in a hollow can read as 'buried' though it is on the rock face (0.10).
    expect(real.floating).toBeLessThan(0.12);
    expect(real.floating).toBeLessThan(ovoid.floating * 0.5);
    expect(real.buried).toBeLessThan(0.15);
    env.dispose();
  }, 60_000);
});
