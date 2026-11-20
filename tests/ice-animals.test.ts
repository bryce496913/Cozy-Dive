import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { AssetId } from '../src/assets/AssetRegistry';
import { validateAsset } from '../src/assets/AssetValidation';
import { PROCEDURAL_ASSETS } from '../src/assets/ProceduralAssets';
import { ICE_ANIMALS } from '../src/environment/ice/IceAnimals';

describe('the big animals under the ice, rebuilt in code (playtest)', () => {
  it('stand in for every one of their predecessors, valid as their assets', () => {
    for (const [id, build] of Object.entries(ICE_ANIMALS)) {
      expect(PROCEDURAL_ASSETS[id as AssetId]).toBe(build);
      const scene = build();
      expect(() =>
        validateAsset(id as AssetId, { scene, scenes: [], animations: [] }),
      ).not.toThrow();
    }
  });
  it('swim with their stroke morphs, which really move them', () => {
    for (const build of Object.values(ICE_ANIMALS)) {
      const body = build().getObjectByName('Body') as THREE.Mesh,
        base = body.geometry.getAttribute('position'),
        morphs = body.geometry.morphAttributes.position ?? [],
        [left, right] = morphs;
      expect(morphs).toHaveLength(2);
      expect(body.morphTargetDictionary).toEqual({
        Stroke_Left: 0,
        Stroke_Right: 1,
      });
      let moved = 0;
      for (let i = 0; i < base.count; i++)
        moved = Math.max(
          moved,
          Math.hypot(
            left.getX(i) - base.getX(i),
            left.getY(i) - base.getY(i),
            left.getZ(i) - base.getZ(i),
          ),
          Math.hypot(
            right.getX(i) - base.getX(i),
            right.getY(i) - base.getY(i),
            right.getZ(i) - base.getZ(i),
          ),
        );
      expect(moved).toBeGreaterThan(0.05);
    }
  });
});
