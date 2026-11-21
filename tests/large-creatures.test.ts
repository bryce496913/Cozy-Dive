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

describe('V0.7 Pass 080 loader bounds', () => {
  /**
   * The runtime loader measures each model as three.js does: the rest pose united with every
   * morph target (Box3 over the base and each stroke). Pass 078 shipped a sea lion whose two
   * strokes together measured 2.63 m against a 2.6 m limit, so it fell back to the procedural
   * model in game while each stroke alone passed. Check the union, as the loader does.
   */
  const MORPHED = (Object.keys(ASSET_REGISTRY) as AssetId[]).filter(
    (id) =>
      ASSET_REGISTRY[id].requireMorphs &&
      ASSET_REGISTRY[id].path.startsWith('assets/models/creatures/'),
  );
  it.each(MORPHED)('%s fits its registry bounds with every stroke', (id) => {
    const entry = ASSET_REGISTRY[id];
    const a = new ReefAsset(`public/${entry.path}`);
    const box = (pos: ArrayLike<number>) => {
      const lo = [Infinity, Infinity, Infinity],
        hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < pos.length; i++) {
        lo[i % 3] = Math.min(lo[i % 3], pos[i]);
        hi[i % 3] = Math.max(hi[i % 3], pos[i]);
      }
      return { lo, hi };
    };
    const lo = [Infinity, Infinity, Infinity],
      hi = [-Infinity, -Infinity, -Infinity];
    for (const name of ['Body', 'Body_LOD1'].filter((n) => a.has(n))) {
      // BufferGeometry.computeBoundingBox with relative morphs: the base box, then for each morph
      // in turn the box's current corners offset by that morph's delta box (cumulatively, so the
      // two strokes' reaches add up), united per mesh in the asset's space.
      const { lo: mlo, hi: mhi } = box(a.primitive(name).positions);
      for (const morph of a.morphPositions(name)) {
        const d = box(morph);
        for (let k = 0; k < 3; k++) {
          mlo[k] = Math.min(mlo[k], mlo[k] + d.lo[k]);
          mhi[k] = Math.max(mhi[k], mhi[k] + d.hi[k]);
        }
      }
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], mlo[k]);
        hi[k] = Math.max(hi[k], mhi[k]);
      }
    }
    const size = Math.max(...hi.map((h, k) => h - lo[k]));
    expect(size).toBeGreaterThanOrEqual(entry.minDimension);
    expect(size).toBeLessThanOrEqual(entry.maxDimension);
  });
});
