import { afterAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AQUARIUM, COLLISION, SPAWN } from '../src/config/world';
import { Aquarium } from '../src/environment/Aquarium';
import {
  SAND_RELIEF_MAX,
  sandRelief,
  substrateHeight,
} from '../src/environment/HabitatRegions';
import { createRockTemplates } from '../src/environment/RockGeometry';
import { reefSurfaceHeight } from '../src/environment/MarineHabitat';
import {
  backdropRocks,
  meadowUnderstory,
  REEF_LAYOUT,
  scatterDebris,
} from '../src/environment/ReefLayout';
import { PLANT_TEMPLATE_NODES } from '../src/environment/AuthoredReef';
import {
  clearFishRoute,
  insideRock,
  safeFishPosition,
} from '../src/fish/FishHabitat';
import { ASSET_REGISTRY } from '../src/assets/AssetRegistry';
import { triplanarWeights } from '../src/rendering/Triplanar';
import type { ConvexCollider } from '../src/player/collision';
import { installReefHulls, ReefAsset } from '../validation/ReefAsset';

const asset = new ReefAsset();
const q = new Aquarium();
afterAll(() => q.dispose());
const inside = (c: ConvexCollider, p: THREE.Vector3, eps: number): boolean =>
  c.planes.every((s) => s.x * p.x + s.y * p.y + s.z * p.z <= s.offset + eps);
const outside = (c: ConvexCollider, p: THREE.Vector3): number =>
  Math.max(
    ...c.planes.map((s) => s.x * p.x + s.y * p.y + s.z * p.z - s.offset),
  );
const triangles = (name: string): number =>
  asset.primitive(name).indices.length / 3;

describe('Pass 014 reef library', () => {
  it('bundles every required node with complete, finite visual attributes', () => {
    for (const name of ASSET_REGISTRY.reef.requiredNodes)
      expect(asset.has(name), name).toBe(true);
    let meshes = 0;
    for (const node of asset.doc.nodes) {
      if (node.mesh === undefined || node.name.startsWith('COLLIDER_'))
        continue;
      meshes++;
      const p = asset.primitive(node.name);
      for (const attr of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0'])
        expect(p.attributes, `${node.name}/${attr}`).toContain(attr);
      expect(p.positions.every(Number.isFinite), node.name).toBe(true);
      expect(p.indices.reduce((a, b) => Math.max(a, b), 0)).toBeLessThan(
        p.positions.length / 3,
      );
    }
    expect(meshes).toBeGreaterThan(40);
    // Pass 015 hero corals (level-5 brain lobes, budding corallites) raised the library to ~31 MB.
    expect(asset.bytes).toBeLessThan(34 * 1024 * 1024);
  });
  it('gives each rock archetype a hero silhouette and cheaper distance levels', () => {
    for (let i = 0; i < 6; i++) {
      expect(triangles(`Rock_${i}`)).toBeGreaterThan(15000);
      expect(triangles(`Rock_${i}_LOD1`)).toBeLessThan(
        triangles(`Rock_${i}`) / 3,
      );
      expect(triangles(`Rock_${i}_LOD2`)).toBeLessThan(
        triangles(`Rock_${i}_LOD1`) / 3,
      );
      const kinds = asset.node(`Rock_${i}_Root`).extras?.archetype;
      expect([
        'porous-limestone',
        'organic-outcrop',
        'layered-sedimentary',
        'crevice-overhang',
      ]).toContain(kinds);
    }
    const archetypes = new Set(
      [0, 1, 2, 3, 4, 5].map(
        (i) => asset.node(`Rock_${i}_Root`).extras?.archetype,
      ),
    );
    expect(archetypes.size).toBe(4);
  });
  it('keeps closed solids single-sided and thin vegetation double-sided', () => {
    expect(asset.primitive('Rock_0').doubleSided).toBe(false);
    expect(asset.primitive('Coral_Plate_0').doubleSided).toBe(false);
    expect(asset.primitive('Sea_Fan_0').doubleSided).toBe(true);
    expect(asset.primitive('Meadow_Blade_0').doubleSided).toBe(true);
  });
  it('normalises plant templates to a rooted unit height with a phase channel', () => {
    for (const prefix of [
      ...Object.values(PLANT_TEMPLATE_NODES),
      'Meadow_Blade',
    ])
      for (let t = 0; t < 3; t++) {
        const p = asset.primitive(`${prefix}_${t}`);
        expect(p.attributes, prefix).toContain('TEXCOORD_1');
        let low = Infinity,
          high = -Infinity;
        for (let i = 1; i < p.positions.length; i += 3) {
          low = Math.min(low, p.positions[i]);
          high = Math.max(high, p.positions[i]);
        }
        expect(low, prefix).toBeGreaterThanOrEqual(-1e-4);
        expect(high, prefix).toBeGreaterThan(0.45);
        expect(high, prefix).toBeLessThan(1.05);
      }
  });
  it('sizes debris for the miniature diver scale', () => {
    for (const [i, name] of [
      'Shell_0',
      'Shell_1',
      'Shell_2',
      'Rubble_0',
      'Rubble_1',
    ].entries()) {
      const p = asset.primitive(name).positions;
      const box = new THREE.Box3().setFromArray(p);
      const size = box.getSize(new THREE.Vector3()).length();
      const [, hi] = REEF_LAYOUT.debrisScale[i];
      // Largest placed shell/rubble stays a few centimetres against ~0.5-0.8 unit fish.
      expect(size * hi).toBeLessThan(0.45);
      expect(size * hi).toBeGreaterThan(0.05);
    }
  });
});

describe('authored reef rock collision', () => {
  const templates = createRockTemplates();
  afterAll(() => {
    templates.major.forEach((g) => g.dispose());
    templates.pebbles.forEach((g) => g.dispose());
  });
  it('carves every authored level and structural part inside the accepted hull', () => {
    const identity = new THREE.Matrix4();
    for (let i = 0; i < 6; i++) {
      const pts = asset.primitive(`Rock_${i}`).positions;
      const hull = q.rocks.find((r) => r.solid && r.template === i)!;
      void hull;
      const original = (() => {
        const g = templates.major[i];
        const planes: ConvexCollider['planes'][number][] = [];
        const pos = g.attributes.position;
        const a = new THREE.Vector3(),
          b = new THREE.Vector3(),
          c = new THREE.Vector3(),
          plane = new THREE.Plane();
        for (let k = 0; k < pos.count; k += 3) {
          a.fromBufferAttribute(pos, k);
          b.fromBufferAttribute(pos, k + 1);
          c.fromBufferAttribute(pos, k + 2);
          plane.setFromCoplanarPoints(a, b, c);
          planes.push({
            x: plane.normal.x,
            y: plane.normal.y,
            z: plane.normal.z,
            offset: -plane.constant,
          });
        }
        return {
          planes,
          min: { x: -1, y: -1, z: -1 },
          max: { x: 1, y: 1, z: 1 },
        };
      })();
      const v = new THREE.Vector3();
      for (const suffix of ['', '_LOD1', '_LOD2']) {
        const p = asset.primitive(`Rock_${i}${suffix}`).positions;
        for (let k = 0; k < p.length; k += 3)
          expect(inside(original, v.set(p[k], p[k + 1], p[k + 2]), 1e-4)).toBe(
            true,
          );
      }
      void pts;
      for (const part of asset.colliders(`Rock_${i}_Root`, identity))
        for (const plane of part.planes)
          expect(Number.isFinite(plane.offset)).toBe(true);
      const parts = asset
        .children(`Rock_${i}_Root`)
        .filter((n) => n.name.startsWith('COLLIDER_'));
      expect(parts.length).toBeGreaterThanOrEqual(i === 4 ? 8 : 5);
      for (const n of parts) {
        const p = asset.primitive(n.name).positions;
        for (let k = 0; k < p.length; k += 3)
          expect(inside(original, v.set(p[k], p[k + 1], p[k + 2]), 1e-4)).toBe(
            true,
          );
      }
    }
  });
  it('aligns structural parts with the visible carved surface', () => {
    const v = new THREE.Vector3();
    let worst = 0;
    for (const rock of q.rocks.filter((r) => r.solid)) {
      const parts = asset.colliders(
        `Rock_${rock.template}_Root`,
        rock.mesh.matrix,
      );
      const p = asset.primitive(`Rock_${rock.template}`).positions;
      for (let k = 0; k < p.length; k += 3 * 13) {
        v.set(p[k], p[k + 1], p[k + 2]).applyMatrix4(rock.mesh.matrix);
        if (v.y < 0.02) continue; // buried below the sand reference
        worst = Math.max(worst, Math.min(...parts.map((c) => outside(c, v))));
      }
    }
    // Visible rock may extend beyond its convex parts only by a few centimetres (passable texture-scale
    // relief between reduced support points); never by a player radius.
    expect(worst).toBeLessThan(0.12);
    expect(worst).toBeLessThan(COLLISION.playerRadius * 0.5);
  });
  it('never adds solid volume, and restores collider identity', () => {
    const before = q.collision.colliders.slice();
    const world = new Aquarium();
    try {
      installReefHulls(world, asset);
      const v = new THREE.Vector3();
      for (const rock of world.rocks.filter((r) => r.solid)) {
        const parts = asset.colliders(
          `Rock_${rock.template}_Root`,
          rock.mesh.matrix,
        );
        for (const part of parts) {
          // Every reduced support point lies inside the accepted procedural hull.
          const n = asset
            .children(`Rock_${rock.template}_Root`)
            .filter((c) => c.name.startsWith('COLLIDER_'));
          for (const node of n) {
            const p = asset.primitive(node.name).positions;
            for (let k = 0; k < p.length; k += 3)
              expect(
                inside(
                  rock.collider!,
                  v
                    .set(p[k], p[k + 1], p[k + 2])
                    .applyMatrix4(rock.mesh.matrix),
                  1e-4,
                ),
              ).toBe(true);
          }
          expect(part.planes.length).toBeGreaterThan(3);
        }
      }
      expect(world.collision.colliders.length).toBeGreaterThan(before.length);
      expect(
        safeFishPosition(
          SPAWN,
          COLLISION.playerRadius,
          world.fish.simulation.habitat,
        ),
      ).toBe(true);
      // The open channel remains free of invisible walls.
      for (let z = -12; z <= 12; z += 0.5)
        for (const y of [1, 3, 5, 8])
          expect(
            safeFishPosition(
              { x: 0, y, z },
              COLLISION.playerRadius,
              world.fish.simulation.habitat,
            ),
            `${y}/${z}`,
          ).toBe(true);
    } finally {
      world.dispose();
    }
  });
  it('physically swims spawn, channel, arch, wreck, every discovery, anemone and moray routes', async () => {
    const { integrationRoutes, swimRoute } =
      await import('../validation/SwimRoutes');
    const world = new Aquarium();
    try {
      installReefHulls(world, asset);
      const h = world.fish.simulation.habitat;
      const routes = integrationRoutes(world);
      const view = (target: THREE.Vector3, id: string) => {
        for (const lift of [0.9, 1.4, 2])
          for (const reach of [1.6, 2.2, 3]) {
            const p = target
              .clone()
              .add(new THREE.Vector3(-Math.sign(target.x) * reach, lift, 0.4));
            const points = [
              SPAWN,
              { ...SPAWN, y: 11 },
              { x: p.x, y: 11, z: p.z },
              p,
            ];
            if (
              points.every(
                (x, i) => !i || clearFishRoute(points[i - 1], x, 0.65, h),
              )
            )
              return { id, points };
          }
        throw Error(`No clear ${id} viewing route`);
      };
      const anemone = new THREE.Vector3();
      world.anchoredLife.anemone.root.getWorldPosition(anemone);
      const moray = new THREE.Vector3();
      world.anchoredLife.moray.head.getWorldPosition(moray);
      const channel = {
        id: 'channel',
        points: [SPAWN, { x: 0, y: 3, z: -10 }, { x: 0, y: 6, z: 0 }],
      };
      for (const route of [
        ...routes,
        channel,
        view(anemone, 'anemone'),
        view(moray, 'moray'),
      ]) {
        const result = swimRoute(world, route.points);
        expect(result.maximumError, route.id).toBeLessThan(0.075);
      }
    } finally {
      world.dispose();
    }
  }, 60000);
});

describe('production structural composition', () => {
  it('physically reaches every discovery with Pass 013 ornament and Pass 014 reef hulls together', async () => {
    const { integrationRoutes, swimRoute } =
      await import('../validation/SwimRoutes');
    const { installAuthoredHulls } =
      await import('../validation/AuthoredCollision');
    const world = new Aquarium();
    try {
      installAuthoredHulls(world);
      installReefHulls(world, asset);
      expect(world.collision.colliders.length).toBe(503); // Pass 019: 124 wreck hulls (was 56)
      // Every route keeps its conservative 0.65 sweep clear in the composed structural world.
      expect(integrationRoutes(world)).toHaveLength(9);
      for (const home of world.anchoredLife.hidden.homes) {
        const result = swimRoute(world, home.approach);
        expect(result.maximumError, home.id).toBeLessThan(0.075);
      }
    } finally {
      world.dispose();
    }
  }, 120000);
});

describe('attachment and habitat integration', () => {
  // Ray-cast straight down onto the visible authored rock under its accepted transform.
  const surfaceBelow = (
    x: number,
    z: number,
    y: number,
  ): number | undefined => {
    // Only the rock whose accepted upper hull carries this seat (overlapping banks are ignored).
    const supports = q.rocks.filter((r) => {
      if (!r.solid || !r.collider) return false;
      const top = reefSurfaceHeight(r.collider, x, z);
      return top !== undefined && Math.abs(top - y) < 0.08;
    });
    const ray = new THREE.Ray(
      new THREE.Vector3(x, y + 0.5, z),
      new THREE.Vector3(0, -1, 0),
    );
    const a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3(),
      hit = new THREE.Vector3();
    let best: number | undefined;
    for (const rock of supports) {
      const box = new THREE.Box3().setFromObject(rock.mesh);
      if (x < box.min.x || x > box.max.x || z < box.min.z || z > box.max.z)
        continue;
      const p = asset.primitive(`Rock_${rock.template}`);
      for (let k = 0; k < p.indices.length; k += 3) {
        a.fromArray(p.positions, p.indices[k] * 3).applyMatrix4(
          rock.mesh.matrix,
        );
        b.fromArray(p.positions, p.indices[k + 1] * 3).applyMatrix4(
          rock.mesh.matrix,
        );
        c.fromArray(p.positions, p.indices[k + 2] * 3).applyMatrix4(
          rock.mesh.matrix,
        );
        if (
          ray.intersectTriangle(a, b, c, false, hit) &&
          (best === undefined || hit.y > best)
        )
          best = hit.y;
      }
    }
    return best;
  };
  it('keeps the host anemone, living corals and rock-top vegetation seated on visible rock', () => {
    const seats: { id: string; p: THREE.Vector3 }[] = [];
    const anemone = new THREE.Vector3();
    q.anchoredLife.anemone.root.getWorldPosition(anemone);
    seats.push({ id: 'anemone', p: anemone });
    for (const f of q.hardscape.formations)
      if (f.role === 'stony-coral')
        seats.push({ id: `coral-${f.kind}`, p: f.position.clone() });
    for (const p of q.plants.placements)
      if (p.species.category === 'coral')
        seats.push({
          id: `${p.species.id}-${p.id}`,
          p: new THREE.Vector3(p.position.x, p.position.y, p.position.z),
        });
    let checked = 0;
    for (const seat of seats) {
      const top = surfaceBelow(seat.p.x, seat.p.z, seat.p.y);
      if (top === undefined) continue;
      checked++;
      // Bases may sink into the surface (embedded) but never float visibly above it.
      expect(seat.p.y - top, seat.id).toBeLessThan(0.06);
      expect(seat.p.y - top, seat.id).toBeGreaterThan(-0.2);
    }
    expect(checked).toBeGreaterThan(10);
  }, 60000);
  it('fits authored vegetation inside every accepted placement envelope', () => {
    const probe = new THREE.Vector3(),
      matrix = new THREE.Matrix4(),
      rotation = new THREE.Quaternion(),
      yaw = new THREE.Quaternion(),
      up = new THREE.Vector3(0, 1, 0);
    const rocks = [...q.rockColliders, ...q.hardscape.colliders];
    let worst = 0;
    for (const plant of q.plants.placements) {
      if (plant.species.id === 'turtle-grass-meadow') continue;
      const p = asset.primitive(
        `${PLANT_TEMPLATE_NODES[plant.species.id]}_${plant.template}`,
      ).positions;
      rotation
        .setFromUnitVectors(
          up,
          new THREE.Vector3(plant.normal.x, plant.normal.y, plant.normal.z),
        )
        .multiply(yaw.setFromAxisAngle(up, plant.yaw));
      matrix.compose(
        new THREE.Vector3(plant.position.x, plant.position.y, plant.position.z),
        rotation,
        new THREE.Vector3(plant.height, plant.height, plant.height),
      );
      for (let k = 0; k < p.length; k += 3) {
        const t = Math.min(1, Math.max(0, p[k + 1]));
        probe.set(p[k], p[k + 1], p[k + 2]).applyMatrix4(matrix);
        if (t < 0.12) continue; // rooted base is embedded in its substrate by design
        for (const r of rocks)
          if (insideRock(probe, 0, r))
            worst = Math.max(worst, -outside(r, probe));
      }
    }
    // Swaying tissue may brush a neighbouring hull by at most a couple of centimetres.
    expect(worst).toBeLessThan(0.03);
  });
});

describe('reef layout', () => {
  const habitat = {
    rocks: q.rocks,
    solids: [
      ...q.rockColliders,
      ...q.hardscape.colliders,
      ...q.ornaments.colliders,
    ],
  };
  it('scatters deterministic, appropriately scaled debris outside every solid', () => {
    const a = scatterDebris(habitat),
      b = scatterDebris(habitat);
    expect(a.map((d) => d.matrix.elements)).toEqual(
      b.map((d) => d.matrix.elements),
    );
    expect(a.length).toBeGreaterThan(200);
    const channel = a.filter(
      (d) => Math.abs(d.position.x) < REEF_LAYOUT.channelHalfWidth,
    );
    expect(channel.length / a.length).toBeLessThan(0.08);
    for (const d of a) {
      expect(
        habitat.solids.some((s) => insideRock(d.position, 0.06 * d.scale, s)),
      ).toBe(false);
      expect(
        Math.abs(d.position.y - substrateHeight(d.position.x, d.position.z)),
      ).toBeLessThan(0.05);
      expect(
        Math.hypot(d.position.x - SPAWN.x, d.position.z - SPAWN.z),
      ).toBeGreaterThan(1.4);
    }
  });
  it('layers a centre-weighted understory inside each accepted meadow', () => {
    const blades = meadowUnderstory(q.grass.patches);
    expect(blades).toEqual(meadowUnderstory(q.grass.patches));
    const p = new THREE.Vector3();
    for (const b of blades) {
      p.setFromMatrixPosition(b.matrix);
      const patch = q.grass.patches.find(
        (g) => Math.hypot(g.x - p.x, (g.z - p.z) / 0.7) <= g.radius + 1e-6,
      );
      expect(patch).toBeDefined();
      expect(b.height).toBeLessThan(0.45);
    }
    const inner = blades.filter((b) => {
      p.setFromMatrixPosition(b.matrix);
      const g = q.grass.patches.find(
        (g) => Math.hypot(g.x - p.x, (g.z - p.z) / 0.7) <= g.radius,
      )!;
      return Math.hypot(g.x - p.x, (g.z - p.z) / 0.7) < g.radius * 0.5;
    });
    expect(inner.length / blades.length).toBeGreaterThan(0.5);
  });
  it('keeps the distant reef relief against the glass and clear of swimmers and equipment', () => {
    const filter = q.ornaments.models.find((m) => m.kind === 'filter')!.root
      .position;
    const rocks = backdropRocks([{ x: filter.x, z: filter.z }]);
    expect(rocks.length).toBeGreaterThan(20);
    const box = new THREE.Box3();
    for (const r of rocks) {
      box
        .set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1))
        .applyMatrix4(r.matrix);
      const back = box.min.z - AQUARIUM.min.z,
        left = box.min.x - AQUARIUM.min.x,
        right = AQUARIUM.max.x - box.max.x;
      const wall = Math.min(Math.abs(back), Math.abs(left), Math.abs(right));
      expect(wall).toBeLessThan(0.01);
      const depth =
        Math.abs(back) < 0.01
          ? box.max.z - AQUARIUM.min.z
          : Math.abs(left) < 0.01
            ? box.max.x - AQUARIUM.min.x
            : AQUARIUM.max.x - box.min.x;
      expect(depth).toBeLessThanOrEqual(REEF_LAYOUT.backdropDepth + 1e-6);
      // The player's body never reaches the relief.
      expect(depth).toBeLessThan(AQUARIUM.clearance - COLLISION.playerRadius);
      // Nearest edge of the relief stays clear of the wall-mounted filter.
      const edge = new THREE.Vector3(
        Math.max(box.min.x, Math.min(filter.x, box.max.x)),
        0,
        Math.max(box.min.z, Math.min(filter.z, box.max.z)),
      );
      expect(Math.hypot(edge.x - filter.x, edge.z - filter.z)).toBeGreaterThan(
        REEF_LAYOUT.backdropEquipmentClearance - 0.25,
      );
    }
  });
  it('keeps the rippled sand at or slightly above the habitat reference', () => {
    for (let x = -17; x <= 17; x += 0.37)
      for (let z = -13; z <= 13; z += 0.41)
        for (const contact of [0, 0.5, 1]) {
          const r = sandRelief(x, z, contact);
          expect(r).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThanOrEqual(SAND_RELIEF_MAX);
        }
    const p = q.sand.geometry.attributes.position;
    let lowest = Infinity,
      highest = -Infinity;
    for (let i = 0; i < p.count; i++) {
      const d = p.getY(i) - substrateHeight(p.getX(i), p.getZ(i));
      lowest = Math.min(lowest, d);
      highest = Math.max(highest, d);
    }
    expect(lowest).toBeGreaterThanOrEqual(-1e-6);
    expect(highest).toBeLessThanOrEqual(SAND_RELIEF_MAX + 1e-6);
    expect(highest).toBeGreaterThan(0.03); // visible ripples and banking exist
    expect(p.count).toBeGreaterThan(30000);
  });
  it('blends triplanar projections with normalised weights', () => {
    for (const n of [
      { x: 0, y: 1, z: 0 },
      { x: 0.6, y: 0.64, z: 0.48 },
      { x: -0.2, y: -0.1, z: 0.97 },
    ]) {
      const w = triplanarWeights(n);
      expect(w[0] + w[1] + w[2]).toBeCloseTo(1, 10);
      expect(w.every((x) => x >= 0)).toBe(true);
    }
  });
});
