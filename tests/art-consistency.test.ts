import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KelpEnvironment } from '../src/environment/kelp/KelpEnvironment';
import { CaveEnvironment } from '../src/environment/cave/CaveEnvironment';
import { mouthRocks } from '../src/environment/shared/RockTube';
import { ShipwreckModel } from '../src/environment/wreck/ShipwreckModel';

/** V0.7 Pass 080: artistic consistency between the worlds' shared surfaces. */
const meshNamed = (root: THREE.Object3D, name: string): THREE.Mesh => {
  const found = root.getObjectByName(name);
  if (!(found instanceof THREE.Mesh)) throw Error(`no mesh ${name}`);
  return found;
};
const meanColour = (g: THREE.BufferGeometry): number[] => {
  const c = g.getAttribute('color'),
    sum = [0, 0, 0];
  for (let i = 0; i < c.count; i++) {
    sum[0] += c.getX(i);
    sum[1] += c.getY(i);
    sum[2] += c.getZ(i);
  }
  return sum.map((v) => v / c.count);
};

describe('V0.7 Pass 080 rock surfaces', () => {
  it('gives the kelp boulders, walls and tunnel the shared rock surface the cave uses', () => {
    const kelp = new KelpEnvironment(),
      cave = new CaveEnvironment();
    try {
      for (const name of ['Kelp boulders', 'Kelp wall', 'Kelp tunnel']) {
        const m = meshNamed(kelp.root, name).material;
        if (!(m instanceof THREE.MeshStandardMaterial))
          throw Error(`${name}: not PBR`);
        // Relief and roughness maps (they were a plain colour), at the limestone template's
        // roughness (0.82 to 0.92), like the cave's carved stone.
        expect(m.normalMap, name).toBeTruthy();
        expect(m.roughnessMap, name).toBeTruthy();
        expect(m.roughness).toBeGreaterThanOrEqual(0.82);
        expect(m.roughness).toBeLessThanOrEqual(0.92);
      }
      const caveRock = meshNamed(cave.root, 'Cave tunnel').material;
      if (!(caveRock instanceof THREE.MeshStandardMaterial))
        throw Error('cave rock: not PBR');
      expect(caveRock.normalMap).toBeTruthy();
    } finally {
      kelp.dispose();
      cave.dispose();
    }
  });

  it('builds the cave tunnel mouths from its pale limestone, not the ice world basalt', () => {
    const cave = new CaveEnvironment();
    try {
      for (const name of [
        'Cave entrance eroded rim',
        'Cave back tunnel mouth',
      ]) {
        const [r, g, b] = meanColour(meshNamed(cave.root, name).geometry);
        // Warm (red over blue) and well above the basalt's 0.22 tone.
        expect(r, name).toBeGreaterThan(0.36);
        expect(r, name).toBeGreaterThan(b);
        expect(g, name).toBeGreaterThan(0.3);
      }
    } finally {
      cave.dispose();
    }
  });

  it('keeps the ice world mouth rocks dark basalt by default', () => {
    const g = mouthRocks({ x: 0, y: 4, radius: 2.2 }, -6, -1);
    try {
      const [r, , b] = meanColour(g);
      expect(r).toBeLessThan(0.3);
      expect(b).toBeGreaterThanOrEqual(r);
    } finally {
      g.dispose();
    }
  });
});

describe('V0.7 Pass 080 wreck growth', () => {
  /**
   * Clark–Evans ratio of the growth on the hull's sides: mean nearest-neighbour distance over its
   * expectation for an even random scatter of the same density (about 1 when uniform, lower when
   * clumped). Pass 076 scattered every kind uniformly, which read as stickers in bands.
   */
  it('settles each hull growth kind in colonies rather than an even sprinkle', () => {
    const model = new ShipwreckModel();
    try {
      for (const name of ['Wreck soft corals', 'Wreck encrusting sponges']) {
        const mesh = model.root.getObjectByName(name);
        if (!(mesh instanceof THREE.InstancedMesh)) throw Error(name);
        const m = new THREE.Matrix4(),
          p = new THREE.Vector3(),
          side: [number, number][] = [];
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, m);
          p.setFromMatrixPosition(m);
          // Hull-side instances, on the starboard (x > 0) flank, as (z, y).
          if (p.x > 0.5 && Math.abs(p.x) > 1.5) side.push([p.z, p.y]);
        }
        expect(side.length, name).toBeGreaterThan(20);
        let zLo = Infinity,
          zHi = -Infinity,
          yLo = Infinity,
          yHi = -Infinity,
          sum = 0;
        for (const [z, y] of side) {
          zLo = Math.min(zLo, z);
          zHi = Math.max(zHi, z);
          yLo = Math.min(yLo, y);
          yHi = Math.max(yHi, y);
        }
        for (const [z, y] of side) {
          let best = Infinity;
          for (const [z2, y2] of side)
            if (z2 !== z || y2 !== y)
              best = Math.min(best, Math.hypot(z2 - z, y2 - y));
          sum += best;
        }
        const density = side.length / ((zHi - zLo) * (yHi - yLo)),
          ratio = sum / side.length / (0.5 / Math.sqrt(density));
        expect(ratio, name).toBeLessThan(0.8);
      }
    } finally {
      model.dispose();
    }
  });
});
