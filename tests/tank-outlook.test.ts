import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AQUARIUM } from '../src/config/world';
import { substrateHeight, sandRelief } from '../src/environment/HabitatRegions';
import { TankOutlook } from '../src/rendering/TankOutlook';

describe('tank outlook seabed clearance', () => {
  it('keeps its bottom below the reference sand and all detailed ripple troughs', () => {
    const outlook = new TankOutlook(new THREE.Color(0x225d73));
    try {
      outlook.mesh.geometry.computeBoundingBox();
      const bottom = outlook.mesh.geometry.boundingBox!.min.y;
      // Both reference sinusoids can reach their negative amplitudes; relief is nonnegative.
      expect(bottom).toBeLessThan(-0.035 - 0.025);
      let lowestRipple = Infinity;
      for (let x = AQUARIUM.min.x; x <= AQUARIUM.max.x; x += 1 / 6)
        for (let z = AQUARIUM.min.z; z <= AQUARIUM.max.z; z += 1 / 6)
          lowestRipple = Math.min(
            lowestRipple,
            substrateHeight(x, z) + sandRelief(x, z),
          );
      expect(bottom).toBeLessThan(lowestRipple);
    } finally {
      outlook.dispose();
    }
  });
});
