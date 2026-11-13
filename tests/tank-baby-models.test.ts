import { it, expect } from 'vitest';
import { TANK_BABIES } from '../src/config/babies';
import { ASSET_REGISTRY } from '../src/assets/AssetRegistry';
import { ReefAsset } from '../validation/ReefAsset';
it('encloses both shipped detail levels, tail tips and every authored stroke at the chosen baby scales', () => {
  for (const d of TANK_BABIES) {
    const asset = new ReefAsset('public/' + ASSET_REGISTRY[d.asset].path);
    for (const name of ['Body', 'Body_LOD1']) {
      const base = asset.primitive(name).positions,
        morphs = asset.morphPositions(name);
      expect(morphs).toHaveLength(2);
      let radius = 0,
        height = 0,
        neutralHeight = 0;
      for (let i = 0; i < base.length; i += 3) {
        neutralHeight = Math.max(
          neutralHeight,
          Math.abs(base[i + 1]) * d.scale,
        );
        for (const morph of [undefined, ...morphs]) {
          const x = (base[i] + (morph?.[i] ?? 0)) * d.scale,
            y = (base[i + 1] + (morph?.[i + 1] ?? 0)) * d.scale,
            z = (base[i + 2] + (morph?.[i + 2] ?? 0)) * d.scale;
          radius = Math.max(radius, Math.hypot(x, z));
          height = Math.max(height, Math.abs(y));
        }
      }
      expect(radius, `${d.id} ${name} horizontal envelope`).toBeLessThan(
        d.radius - 0.02,
      );
      expect(height, `${d.id} ${name} vertical envelope`).toBeLessThan(
        d.halfHeight - 0.02,
      );
      if (d.id === 'spotted-eagle-ray')
        expect(neutralHeight).toBeLessThan(0.045 - 0.02);
    }
  }
}, 20000);
