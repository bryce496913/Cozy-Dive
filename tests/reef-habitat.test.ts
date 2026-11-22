import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ASSET_REGISTRY } from '../src/assets/AssetRegistry';
import { tankContext } from '../src/catalog/TankContext';
import {
  TANK_ITEMS,
  validPlacement,
  type PlacementContext,
  type TankItem,
} from '../src/catalog/catalog';
import { AQUARIUM, SPAWN } from '../src/config/world';
import { MORAY_DEN } from '../src/creatures/MorayBehavior';
import { insideRock } from '../src/fish/FishHabitat';
import { Aquarium } from '../src/environment/Aquarium';
import { substrateHeight } from '../src/environment/HabitatRegions';
import {
  REEF_BENCHMARK,
  insideAny,
  isBenchmarkCoral,
  isBenchmarkRock,
} from '../src/environment/ReefBenchmark';
import {
  REEF_HABITAT,
  isHabitatCoral,
  isHabitatRock,
  reefPresentation,
  strayScatter,
} from '../src/environment/ReefHabitat';
import { integrationRoutes } from '../src/environment/SwimRoutes';
import type { ConvexCollider } from '../src/player/collision';
import { ReefAsset } from '../validation/ReefAsset';

/** V0.8 Pass 083: the whole-tank habitat stays safe to swim, fish, decorate and roll back. */
const asset = new ReefAsset(`public/${ASSET_REGISTRY.reefHabitat.path}`);
const bench = new ReefAsset(`public/${ASSET_REGISTRY.reefBenchmark.path}`);
const solids = asset.colliders('ReefHabitat_Root', new THREE.Matrix4());
const benchSolids = bench.colliders('ReefBenchmark_Root', new THREE.Matrix4());
const FORMATIONS = [
  'WestMassif',
  'WestTerraces',
  'WestOutcrops',
  'EastMassif',
  'EastTerraces',
  'EastChannel',
  'EastOutcrops',
];
const points = (name: string, a = asset) => {
  const p = a.primitive(name).positions,
    out: THREE.Vector3[] = [];
  for (let i = 0; i < p.length; i += 3)
    out.push(new THREE.Vector3(p[i], p[i + 1], p[i + 2]));
  return out;
};
const mesh = (name: string, a = asset) => {
  const p = a.primitive(name),
    g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p.positions, 3));
  g.setIndex(new THREE.BufferAttribute(p.indices, 1));
  return new THREE.Mesh(
    g,
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
};
/** The aquarium with both composed sections' hulls installed, as `AuthoredReef` does. */
function composedAquarium(): Aquarium {
  const q = new Aquarium();
  const originals: ConvexCollider[] = [];
  for (const r of q.rocks)
    if (
      r.collider &&
      (isBenchmarkRock(r.mesh.name) || isHabitatRock(r.mesh.name))
    )
      originals.push(r.collider);
  for (const f of q.hardscape.formations)
    if (isBenchmarkCoral(f.position) || isHabitatCoral(f.position))
      originals.push(...f.colliders);
  q.replacePresentationColliders(originals, [...benchSolids, ...solids]);
  const all = [...benchSolids, ...solids];
  q.suspendInterests((p) => insideAny(p, all, REEF_BENCHMARK.clearance));
  return q;
}

describe('V0.8 Pass 083 reef habitat', () => {
  it('chooses the composed reef by default and rolls back with ?reef=original', () => {
    expect(reefPresentation('')).toBe('habitat');
    expect(reefPresentation('?reef=benchmark')).toBe('benchmark');
    expect(reefPresentation('?reef=original')).toBe('original');
    expect(reefPresentation('?reef=other')).toBe('habitat');
  });

  it('replaces every accepted reef rock and coral with the benchmark or a formation, once', () => {
    const q = new Aquarium();
    try {
      const solid = q.rocks.filter((r) => r.solid).map((r) => r.mesh.name);
      for (const name of REEF_HABITAT.rocks) expect(solid).toContain(name);
      for (const name of solid)
        expect(
          Number(isHabitatRock(name)) + Number(isBenchmarkRock(name)),
          name,
        ).toBe(1);
      expect(
        q.hardscape.formations.filter((f) => isHabitatCoral(f.position)),
      ).toHaveLength(REEF_HABITAT.corals.length);
    } finally {
      q.dispose();
    }
  });

  it('gives each formation three detail levels and solid parts covering what is drawn', () => {
    expect(solids.length).toBeGreaterThan(80);
    for (const f of FORMATIONS) {
      const name = `Habitat_Rock_${f}`;
      for (const suffix of ['_LOD1', '_LOD2'])
        expect(asset.has(name + suffix)).toBe(true);
      const visible = points(name).filter(
        (v) => v.y > substrateHeight(v.x, v.z) + 0.05,
      );
      const covered = visible.filter((v) => insideAny(v, solids, 0.12)).length;
      expect(covered / visible.length, f).toBeGreaterThan(0.97);
    }
  });

  it('stays inside the accepted rock hulls, except low rubble saddles between neighbours', () => {
    const q = new Aquarium();
    try {
      const accepted = q.rocks
        .filter((r) => r.collider && isHabitatRock(r.mesh.name))
        .map((r) => r.collider!);
      for (const f of FORMATIONS) {
        const outside = points(`Habitat_Rock_${f}`).filter(
          (v) =>
            !accepted.some((c) => insideRock(v, 0.22, c)) &&
            v.y > substrateHeight(v.x, v.z) + 0.8,
        );
        expect(outside.length, f).toBe(0);
      }
    } finally {
      q.dispose();
    }
  });

  it('keeps the central channel, the spawn and the swimming routes open', () => {
    for (const s of [...solids, ...benchSolids])
      expect(s.max.x < -2.6 || s.min.x > 2.6).toBe(true);
    const q = composedAquarium();
    try {
      expect(
        q.collision.colliders.some((c) => insideRock(SPAWN, 0.65, c)),
      ).toBe(false);
      // Every creature-home approach, the arch and the full wreck circuit stay clear for fish.
      expect(() => integrationRoutes(q)).not.toThrow();
      expect(() => tankContext(q)).not.toThrow();
    } finally {
      q.dispose();
    }
  });

  it('carves the moray den through solid rock, open at its mouth', () => {
    const q = new Aquarium();
    try {
      const den = q.anchoredLife.moray.den;
      const rock = points('Habitat_Rock_WestMassif');
      const axis = new THREE.Vector3(den.axis.x, den.axis.y, den.axis.z);
      const near = (lo: number, hi: number, r0: number, r1: number) =>
        rock.filter((v) => {
          const d = v.clone().sub(den.mouth);
          const along = d.dot(axis),
            radial = d.addScaledVector(axis, -along).length();
          return along > lo && along < hi && radial > r0 && radial < r1;
        }).length;
      // Open: no rock inside the tunnel the body lies in, or in the water the head swims into.
      expect(
        near(
          -MORAY_DEN.depth + 0.15,
          MORAY_DEN.headOut + 0.2,
          0,
          MORAY_DEN.radius * 0.8,
        ),
      ).toBe(0);
      // Hidden: the tunnel walls are rock all round.
      expect(
        near(
          -MORAY_DEN.depth + 0.15,
          -0.1,
          MORAY_DEN.radius,
          MORAY_DEN.radius + 0.25,
        ),
      ).toBeGreaterThan(40);
    } finally {
      q.dispose();
    }
  });

  it('seats the frogfish on the rock at the height of its perch', () => {
    const q = new Aquarium();
    try {
      const home = q.anchoredLife.hidden.frogfish.home.position;
      const ray = new THREE.Raycaster(
        new THREE.Vector3(home.x, home.y + 0.3, home.z),
        new THREE.Vector3(0, -1, 0),
        0,
        0.6,
      );
      const hit = ray.intersectObject(mesh('Habitat_Rock_EastChannel'))[0];
      expect(hit).toBeDefined();
      expect(Math.abs(hit.point.y - home.y)).toBeLessThan(0.2);
    } finally {
      q.dispose();
    }
  });

  it('ships unit-height organic plant templates and roots every plant clear of solid rock', () => {
    for (const kind of Object.keys(REEF_HABITAT.plantMotion)) {
      const ys = points(`Habitat_Plant_${kind}`).map((v) => v.y);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(-0.01);
      expect(Math.max(...ys)).toBeCloseTo(1, 2);
      expect(asset.primitive(`Habitat_Plant_${kind}`).attributes).toContain(
        'TEXCOORD_1',
      );
    }
    const spots = asset.doc.nodes.filter((n) =>
      n.name.startsWith('Habitat_PlantSpot_'),
    );
    expect(spots.length).toBeGreaterThan(400);
    const buried = spots.filter((n) => {
      const [x, y, z] = n.translation ?? [0, 0, 0];
      // A plant's lower stem standing well inside a solid part.
      return insideAny({ x, y: y + 0.15, z }, solids, -0.15);
    });
    expect(buried.length / spots.length).toBeLessThan(0.03);
  });

  it('withholds only loose scatter out on open sand', () => {
    expect(strayScatter({ x: 0, y: 0, z: 0 }, solids)).toBe(true);
    const c = solids[0];
    expect(
      strayScatter(
        { x: (c.min.x + c.max.x) / 2, y: c.min.y, z: (c.min.z + c.max.z) / 2 },
        solids,
      ),
    ).toBe(false);
  });
});

describe('V0.8 Pass 083 habitat with fish, creatures and the tank editor', () => {
  it('keeps simulated fish out of the new rock', () => {
    const q = composedAquarium();
    try {
      for (let i = 0; i < 600; i++) q.update(i / 30, false, 1 / 30, true);
      const stuck = q.fish.simulation.fish.filter((f) =>
        [...solids, ...benchSolids].some((s) => insideRock(f.position, 0, s)),
      );
      expect(stuck).toHaveLength(0);
    } finally {
      q.dispose();
    }
  });

  it('keeps saved decorations on open sand valid on the habitat surface', () => {
    const q = composedAquarium();
    try {
      const accepted = tankContext(q);
      // The browser seats decorations on the visible rock (TankEditor raycasts the authored
      // surfaces); mirror that with the composed rock meshes.
      const rocks = [
        ...FORMATIONS.map((f) => mesh(`Habitat_Rock_${f}`)),
        mesh('Reef_Ridge', bench),
        mesh('Reef_Bommie', bench),
      ];
      const ray = new THREE.Raycaster();
      const down = new THREE.Vector3(0, -1, 0);
      const surface = (x: number, z: number) => {
        ray.set(new THREE.Vector3(x, 13, z), down);
        ray.far = 14;
        const hit = ray.intersectObjects(rocks, false)[0];
        return Math.max(
          substrateHeight(x, z) + 0.04,
          hit ? hit.point.y : -Infinity,
        );
      };
      const composed: PlacementContext = { ...accepted, surface };
      const kind = TANK_ITEMS[0].kind;
      const saved: TankItem[] = [];
      // A grid of decorations a player could have placed on the accepted tank's open sand.
      for (let x = AQUARIUM.min.x + 1.5; x < AQUARIUM.max.x - 1.5; x += 1.7)
        for (let z = AQUARIUM.min.z + 1.5; z < AQUARIUM.max.z - 1.5; z += 1.7) {
          const item: TankItem = {
            id: `tank-grid-${saved.length}`,
            kind,
            position: { x, y: substrateHeight(x, z) + 0.04, z },
            rotation: 0,
          };
          if (
            validPlacement(item, [], accepted) &&
            !q.rockColliders.some((c) => insideRock(item.position, 0.6, c))
          )
            saved.push(item);
        }
      expect(saved.length).toBeGreaterThan(40);
      const kept = saved.filter((i) => validPlacement(i, [], composed));
      // Saddles may cover a narrow gap between two rocks; nothing out on open sand changes.
      expect(kept.length / saved.length).toBeGreaterThan(0.95);
    } finally {
      q.dispose();
    }
  });
});
