import { it, expect } from 'vitest';
import { TANK_BABIES, isLargeMiniature } from '../src/config/babies';
import { ASSET_REGISTRY } from '../src/assets/AssetRegistry';
import { ReefAsset } from '../validation/ReefAsset';

/**
 * Every GLB miniature's collision radius and half-height enclose both shipped detail levels, tail
 * tips and every authored stroke, at its displayed size (V0.8 Pass 096: all of them, at the
 * doubled sizes; the game centres a size-normalised model on its rest bounds, as here).
 */
it('encloses both shipped detail levels, tail tips and every authored stroke at the chosen baby scales', () => {
  for (const d of TANK_BABIES.filter((b) => b.asset && !b.nodes)) {
    const asset = new ReefAsset('public/' + ASSET_REGISTRY[d.asset!].path);
    const levels = ['Body', 'Body_LOD1'].map((name) => ({
      base: asset.primitive(name).positions,
      morphs: asset.morphPositions(name),
    }));
    // The rest bounds of both levels (what the game normalises and centres by).
    const lo = [Infinity, Infinity, Infinity],
      hi = [-Infinity, -Infinity, -Infinity];
    for (const { base } of levels)
      for (let i = 0; i < base.length; i += 3)
        for (let k = 0; k < 3; k++) {
          lo[k] = Math.min(lo[k], base[i + k]);
          hi[k] = Math.max(hi[k], base[i + k]);
        }
    const centre = d.size ? lo.map((l, k) => (l + hi[k]) / 2) : [0, 0, 0],
      scale =
        d.scale *
        (d.size ? d.size / Math.max(...hi.map((h, k) => h - lo[k])) : 1);
    for (const { base, morphs } of levels) {
      expect(morphs, d.id).toHaveLength(2);
      let radius = 0,
        height = 0,
        neutralHeight = 0;
      for (let i = 0; i < base.length; i += 3) {
        neutralHeight = Math.max(
          neutralHeight,
          Math.abs(base[i + 1] - centre[1]) * scale,
        );
        for (const morph of [undefined, ...morphs]) {
          const x = (base[i] + (morph?.[i] ?? 0) - centre[0]) * scale,
            y = (base[i + 1] + (morph?.[i + 1] ?? 0) - centre[1]) * scale,
            z = (base[i + 2] + (morph?.[i + 2] ?? 0) - centre[2]) * scale;
          radius = Math.max(radius, Math.hypot(x, z));
          height = Math.max(height, Math.abs(y));
        }
      }
      expect(radius, `${d.id} horizontal envelope`).toBeLessThan(
        d.radius - 0.02,
      );
      expect(height, `${d.id} vertical envelope`).toBeLessThan(
        d.halfHeight - 0.02,
      );
      // The eagle ray lies flat on the sand at its (grown) resting half-height.
      if (d.id === 'spotted-eagle-ray')
        expect(neutralHeight).toBeLessThan(
          0.045 * (isLargeMiniature(d) ? 2 : 1) - 0.02,
        );
    }
  }
}, 60000);
