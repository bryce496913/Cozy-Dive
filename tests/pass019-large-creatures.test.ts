import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ASSET_REGISTRY } from '../src/assets/AssetRegistry';
import { validateAsset } from '../src/assets/AssetValidation';
import {
  LARGE_CREATURE_IDS,
  LARGE_CREATURES,
  largeCreatureDesign,
} from '../src/creatures/lowPoly/designs';
import {
  largeCreatureAsset,
  largeCreatureGeometry,
} from '../src/creatures/lowPoly/model';

describe('Pass 019 canonical large creatures', () => {
  it('accounts for every existing marine showcase asset in the migration roster', () => {
    expect(LARGE_CREATURE_IDS).toHaveLength(22);
    expect(new Set(LARGE_CREATURE_IDS).size).toBe(LARGE_CREATURE_IDS.length);
    for (const id of LARGE_CREATURE_IDS) {
      expect(ASSET_REGISTRY[id].path).toMatch(/^assets\/models\/creatures\//);
      expect(LARGE_CREATURES[id].target).toBeGreaterThanOrEqual(
        ASSET_REGISTRY[id].minDimension,
      );
      expect(LARGE_CREATURES[id].target).toBeLessThanOrEqual(
        ASSET_REGISTRY[id].maxDimension,
      );
    }
  });

  it.each(LARGE_CREATURE_IDS)(
    '%s builds finite faceted geometry, palette regions and the established stroke contract',
    (id) => {
      const g = largeCreatureGeometry(id),
        p = g.getAttribute('position'),
        colors = g.getAttribute('color');
      expect(p.count).toBeGreaterThan(80);
      expect(p.count).toBeLessThan(3000);
      expect(colors.count).toBe(p.count);
      expect(g.morphAttributes.position?.map((m) => m.name)).toEqual([
        'Stroke_Left',
        'Stroke_Right',
      ]);
      expect([...p.array].every(Number.isFinite)).toBe(true);
      const spec = ASSET_REGISTRY[id],
        asset = largeCreatureAsset(
          id,
          spec.requiredNodes[0],
          spec.requiredNodes,
        );
      expect(() => validateAsset(id, asset)).not.toThrow();
    },
  );

  it('uses vertical cetacean flukes and lateral shark tails', () => {
    const movement = (id: 'minkeWhale' | 'greatWhite') => {
      const g = largeCreatureGeometry(id),
        m = g.morphAttributes.position?.[0],
        result = new THREE.Vector3();
      if (!m) throw Error(`${id}: missing stroke`);
      for (let i = 0; i < m.count; i++)
        result.set(
          Math.max(result.x, Math.abs(m.getX(i))),
          Math.max(result.y, Math.abs(m.getY(i))),
          Math.max(result.z, Math.abs(m.getZ(i))),
        );
      return result;
    };
    const whale = movement('minkeWhale'),
      shark = movement('greatWhite');
    expect(whale.y).toBeGreaterThan(whale.z * 4);
    expect(shark.z).toBeGreaterThan(shark.y * 4);
  });

  it('keeps every semantic design independent rather than recolouring one record', () => {
    const signatures = LARGE_CREATURE_IDS.map((id) => {
      const d = largeCreatureDesign(id);
      return JSON.stringify([
        d.family,
        d.depth,
        d.width,
        d.snout,
        d.tail,
        d.appendage,
        d.markings,
      ]);
    });
    expect(new Set(signatures).size).toBe(signatures.length);
  });
});
