import { describe, expect, it } from 'vitest';
import { ASSET_REGISTRY, type AssetId } from '../src/assets/AssetRegistry';
import { ReefAsset } from '../validation/ReefAsset';
import { validateGlbFile } from '../validation/AssetStandards';

/** V0.7 Pass 067: the large animals rebuilt to the V0.7 standard keep the creature contract. */
const CREATURES = [
  ['reef-shark', 'Shark'],
  ['whitetip-shark', 'Whitetip'],
  ['great-white-shark', 'GreatWhite'],
  ['hammerhead', 'Hammerhead'],
  ['leopard-shark', 'LeopardShark'],
  ['nurse-shark', 'NurseShark'],
  ['whale-shark', 'WhaleShark'],
  ['barracuda', 'Barracuda'],
  ['eagle-ray', 'Ray'],
  ['manta-ray', 'Manta'],
  ['sea-turtle', 'Turtle'],
  ['ocean-sunfish', 'Sunfish'],
  ['humpback-whale', 'Humpback'],
  // V0.7 Pass 068: marine mammals, penguins and the gull, authored in Blender (they replace the
  // ice world's code-built stand-ins and the kelp forest's earlier models).
  ['killer-whale', 'Orca'],
  ['minke-whale', 'Minke'],
  ['leopard-seal', 'LeopardSeal'],
  ['harbour-seal', 'Seal'],
  ['sea-lion', 'SeaLion'],
  ['polar-bear', 'PolarBear'],
  ['sea-otter', 'Otter'],
  ['emperor-penguin', 'EmperorPenguin'],
  ['adelie-penguin', 'AdeliePenguin'],
  ['western-gull', 'Gull'],
] as const;

const MAMMALS: readonly AssetId[] = [
  'killerWhale',
  'minkeWhale',
  'leopardSeal',
  'harbourSeal',
  'seaLion',
  'polarBear',
  'seaOtter',
  'emperorPenguin',
  'adeliePenguin',
  'westernGull',
];

const tris = (a: ReefAsset, name: string) =>
  a.doc.meshes[a.node(name).mesh!].primitives.reduce(
    (sum, p) =>
      sum + (a.doc.accessors as { count: number }[])[p.indices].count / 3,
    0,
  );

describe('V0.7 Pass 067 large creatures', () => {
  it.each(CREATURES)(
    '%s keeps the root, single-material Body, LOD and stroke morphs at rest',
    (id, root) => {
      const a = new ReefAsset(`public/assets/models/creatures/${id}.glb`);
      expect(a.has(`${root}_Root`)).toBe(true);
      for (const name of ['Body', 'Body_LOD1']) {
        const mesh = a.doc.meshes[
          a.node(name).mesh!
        ] as (typeof a.doc.meshes)[number] & {
          weights?: number[];
        };
        // One primitive: SoloCreature reads Body as a single Mesh, not a Group.
        expect(mesh.primitives, name).toHaveLength(1);
        expect(mesh.primitives[0].targets?.length ?? 0, name).toBe(2);
        // The default weights are the rest pose; the runtime drives the stroke.
        expect(
          (mesh.weights ?? [0, 0]).every((w: number) => w === 0),
          name,
        ).toBe(true);
        expect(a.primitive(name).positions.every(Number.isFinite)).toBe(true);
      }
      expect(tris(a, 'Body')).toBeLessThan(8000);
      expect(tris(a, 'Body_LOD1')).toBeLessThan(tris(a, 'Body') * 0.2);
    },
  );

  it.each(CREATURES)('%s passes the V0.7 production checks', async (id) => {
    const r = await validateGlbFile(`public/assets/models/creatures/${id}.glb`);
    expect(r.errors).toEqual([]);
    expect(r.stats.morphTargets).toEqual(['Stroke_Left', 'Stroke_Right']);
  });
});

describe('V0.7 Pass 068 mammals and birds', () => {
  it.each(MAMMALS)(
    '%s loads from its file, fits its registry bounds and really strokes',
    (id) => {
      const entry = ASSET_REGISTRY[id];
      const a = new ReefAsset(`public/${entry.path}`);
      const base = a.primitive('Body').positions;
      const extent = (pos: ArrayLike<number>, add?: Float32Array) => {
        const lo = [Infinity, Infinity, Infinity],
          hi = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < pos.length; i++) {
          const v = pos[i] + (add ? add[i] : 0);
          lo[i % 3] = Math.min(lo[i % 3], v);
          hi[i % 3] = Math.max(hi[i % 3], v);
        }
        return Math.max(...hi.map((h, k) => h - lo[k]));
      };
      const rest = extent(base);
      expect(rest).toBeGreaterThanOrEqual(entry.minDimension);
      expect(rest).toBeLessThanOrEqual(entry.maxDimension);
      for (const morph of a.morphPositions('Body')) {
        expect(extent(base, morph)).toBeLessThanOrEqual(entry.maxDimension);
        let moved = 0;
        for (let i = 0; i < morph.length; i += 3)
          moved = Math.max(
            moved,
            Math.hypot(morph[i], morph[i + 1], morph[i + 2]),
          );
        // Each stroke visibly moves part of the animal (at least 4 % of its size).
        expect(moved).toBeGreaterThan(rest * 0.04);
      }
    },
  );
});
