import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  collectionInventory,
  inventoryMarkdown,
} from '../validation/CollectionInventory';
import { TANK_BABIES } from '../src/config/babies';
import { isAuthoredSmallAnimal } from '../src/creatures/babies/SmallAnimalHabitat';
import {
  ALBUM_SECTIONS,
  COLLECTION,
  sectionProgress,
} from '../src/collection/registry';
import { SIGHTS } from '../src/discovery/sights';
describe('Pass 107 acceptance inventory', () => {
  it('accounts for exactly the approved 22 with canonical wild/card/tank nodes and compatible IDs', () => {
    const rows = collectionInventory();
    expect(rows).toHaveLength(22);
    expect(rows.map((r) => r.tankId).sort()).toEqual(
      TANK_BABIES.filter(isAuthoredSmallAnimal)
        .map((d) => d.id)
        .sort(),
    );
    const manifest: { file: string; bytes: number; sha256: string }[] =
      JSON.parse(readFileSync('public/assets/manifest.json', 'utf8'));
    const checked = new Set<string>();
    for (const r of rows) {
      expect(r.eligible, r.id).toBe(true);
      expect(r.canonicalEntryCount, r.id).toBe(1);
      expect(r.tankAsset, r.id).toBe(r.asset);
      expect(r.tankNodes, r.id).toContain(r.wildNode);
      expect(
        SIGHTS.filter((s) => s.id === r.id),
        r.id,
      ).toHaveLength(1);
      expect(r.location && r.hint && r.animation, r.id).toBeTruthy();
      if (!checked.has(r.file)) {
        const bytes = readFileSync(`public/${r.file}`),
          row = manifest.find((m) => m.file === r.file)!;
        expect(bytes.length).toBe(row.bytes);
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(
          row.sha256,
        );
        const gltf: { nodes: { name: string }[] } = JSON.parse(
          bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)),
        );
        for (const animal of rows.filter((x) => x.file === r.file))
          expect(gltf.nodes.some((n) => n.name === animal.node)).toBe(true);
        checked.add(r.file);
      }
    }
    expect(COLLECTION).toHaveLength(115);
    expect(new Set(COLLECTION.map((e) => e.id)).size).toBe(115);
    const counts = Object.fromEntries(
      ALBUM_SECTIONS.map((s) => [s, sectionProgress(s, []).total]),
    );
    expect(counts).toEqual({
      aquarium: 12,
      'outer-reef': 30,
      'kelp-forest': 17,
      shipwreck: 5,
      'sea-cave': 18,
      antarctic: 33,
    });
    const output = process.env.COZY_ACCEPTANCE_OUTPUT;
    if (output) {
      mkdirSync(output, { recursive: true });
      writeFileSync(
        `${output}/collection-inventory.json`,
        JSON.stringify(
          {
            rows,
            counts,
            libraries: [...checked].map((file) =>
              manifest.find((m) => m.file === file),
            ),
          },
          null,
          2,
        ),
      );
      writeFileSync(`${output}/collection-matrix.md`, inventoryMarkdown(rows));
    }
  });
});
