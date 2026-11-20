import { describe, expect, it } from 'vitest';
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
] as const;

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
