import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Aquarium } from '../src/environment/Aquarium';
import {
  REEF_BENCHMARK,
  benchmarkRequested,
  insideAny,
  isBenchmarkCoral,
  isBenchmarkRock,
} from '../src/environment/ReefBenchmark';
import { ReefAsset } from '../validation/ReefAsset';
import { ASSET_REGISTRY } from '../src/assets/AssetRegistry';

/** V0.8 Pass 082: the reef benchmark section stays safe to swim, fish and roll back. */
const asset = new ReefAsset(`public/${ASSET_REGISTRY.reefBenchmark.path}`);
const solids = asset.colliders('ReefBenchmark_Root', new THREE.Matrix4());
const points = (name: string) => {
  const p = asset.primitive(name).positions,
    out: THREE.Vector3[] = [];
  for (let i = 0; i < p.length; i += 3)
    out.push(new THREE.Vector3(p[i], p[i + 1], p[i + 2]));
  return out;
};

describe('V0.8 Pass 082 reef benchmark', () => {
  it('rolls back to the accepted section with ?reef=original only', () => {
    expect(benchmarkRequested('')).toBe(true);
    expect(benchmarkRequested('?reef=benchmark')).toBe(true);
    expect(benchmarkRequested('?reef=original')).toBe(false);
  });

  it('replaces rocks and colonies that exist in the accepted layout', () => {
    const q = new Aquarium();
    try {
      const names = q.rocks.filter((r) => r.solid).map((r) => r.mesh.name);
      for (const name of REEF_BENCHMARK.rocks) expect(names).toContain(name);
      expect(q.rocks.filter((r) => isBenchmarkRock(r.mesh.name))).toHaveLength(
        REEF_BENCHMARK.rocks.length,
      );
      expect(
        q.hardscape.formations.filter((f) => isBenchmarkCoral(f.position)),
      ).toHaveLength(REEF_BENCHMARK.corals.length);
    } finally {
      q.dispose();
    }
  });

  it('gives every composed rock mass its own convex collider, covering what is drawn', () => {
    expect(solids.length).toBeGreaterThanOrEqual(17);
    for (const name of ['Reef_Ridge', 'Reef_Bommie']) {
      const vs = points(name);
      const covered = vs.filter((v) => insideAny(v, solids, 0.12)).length;
      // Rock above the sand is solid to the swimmer and the fish (the foot below the sand and
      // a few chips of the chipped edges may stand just proud of the parts).
      const visible = vs.filter((v) => v.y > 0.05);
      const coveredVisible = visible.filter((v) =>
        insideAny(v, solids, 0.12),
      ).length;
      expect(coveredVisible / visible.length, name).toBeGreaterThan(0.97);
      expect(covered).toBeGreaterThan(0);
    }
  });

  it('keeps the host anemone seated on the rock and the central channel open', () => {
    const anemone = { x: -7.2268, y: 2.2608, z: 0.9917 };
    const ridge = points('Reef_Ridge').filter(
      (v) => Math.hypot(v.x - anemone.x, v.z - anemone.z) < 0.18,
    );
    const top = Math.max(...ridge.map((v) => v.y));
    expect(Math.abs(top - anemone.y)).toBeLessThan(0.2);
    for (const s of solids) expect(s.max.x).toBeLessThan(-2.6);
  });

  it('ships unit-height plant templates for the shared sway contract', () => {
    for (const kind of Object.keys(REEF_BENCHMARK.plantMotion)) {
      const ys = points(`Reef_Plant_${kind}`).map((v) => v.y);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(-0.01);
      expect(Math.max(...ys)).toBeCloseTo(1, 2);
      expect(asset.primitive(`Reef_Plant_${kind}`).attributes).toContain(
        'TEXCOORD_1',
      );
    }
  });
});

describe('V0.8 Pass 082 fish interests under the benchmark rock', () => {
  it('withholds covered interest points and restores them in place', () => {
    const q = new Aquarium();
    try {
      const interests = q.fish.simulation.habitat.interests!;
      const before = interests.slice();
      q.suspendInterests((p) => p.x < -5 && p.z > -1);
      expect(interests.length).toBeLessThan(before.length);
      expect(
        interests.every((i) => !(i.position.x < -5 && i.position.z > -1)),
      ).toBe(true);
      q.restoreInterests();
      expect(interests).toEqual(before);
    } finally {
      q.dispose();
    }
  });
});
