import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { describe, expect, it } from 'vitest';
import { OUTER } from '../src/config/passage';
import { FishSystem } from '../src/fish/FishSystem';
import { reefObstacles } from '../src/environment/outer/OuterCreatures';
import {
  placementMatrix,
  seatOnRocks,
} from '../src/environment/outer/OuterReef';
import {
  REEF_TEMPLATES,
  outerReefLayout,
} from '../src/environment/outer/OuterReefLayout';
import {
  outerInterests,
  outerSpecies,
} from '../src/environment/outer/OuterSchools';
import { seabedHeight } from '../src/environment/outer/OuterTerrain';
import { boxCollider } from '../src/environment/passage/Crevice';
import { rockCollider } from '../src/environment/rockCollider';
import {
  STALKS,
  downstream,
  stalkTemplate,
} from '../src/environment/kelp/KelpStalks';
import type { ConvexCollider } from '../src/player/collision';
import { ReefAsset } from '../validation/ReefAsset';

/** V0.8 Pass 085: the outer reef's authored variants and the kelp forest's new plants. */
const variants = new ReefAsset('public/assets/models/reef/reef-outer.glb');
const hulls = (root: string) =>
  variants
    .children(root)
    .filter((c) => c.name.startsWith('COLLIDER_'))
    .map((c) => {
      const p = variants.primitive(c.name).positions,
        pts: THREE.Vector3[] = [];
      for (let i = 0; i < p.length; i += 3)
        pts.push(new THREE.Vector3(p[i], p[i + 1], p[i + 2]));
      return new ConvexGeometry(pts);
    });
const positions = (name: string) => variants.primitive(name).positions;

describe('V0.8 Pass 085 outer reef variants', () => {
  it('ships a composed variant for every rock template, inside the library footprint', () => {
    for (let t = 0; t < REEF_TEMPLATES.rock; t++) {
      const p = positions(`OuterRock_${t}`);
      for (let i = 0; i < p.length; i++)
        expect(Math.abs(p[i])).toBeLessThan(0.9);
      expect(hulls(`OuterRock_${t}_Root`).length).toBeGreaterThan(1);
    }
  });

  it('ships colonies for every coral template, low and spreading rather than pedestals', () => {
    for (const family of ['massive', 'branching', 'plate'] as const)
      for (let t = 0; t < REEF_TEMPLATES[family]; t++) {
        const p = positions(`OuterCoral_${family}_${t}`);
        let top = -Infinity,
          wide = 0;
        for (let i = 0; i < p.length; i += 3) {
          top = Math.max(top, p[i + 1]);
          wide = Math.max(wide, Math.hypot(p[i], p[i + 2]));
        }
        // The library's massive heads stood 1.1-1.2 m and its plating towers 1.95 m tall on a
        // 1.4 m footprint; the variants spread over the rock (thickets keep their height).
        expect(top, `${family} ${t}`).toBeLessThan(
          family === 'branching' ? 1.25 : 0.8,
        );
        expect(wide, `${family} ${t}`).toBeGreaterThan(0.3);
        expect(hulls(`OuterCoral_${family}_${t}_Root`).length).toBe(1);
      }
  });

  it('ships unit-height arching seagrass for the grass and blade families', () => {
    for (const kind of ['grass', 'blade']) {
      const p = positions(`OuterPlant_${kind}`);
      let lo = Infinity,
        hi = -Infinity;
      for (let i = 1; i < p.length; i += 3) {
        lo = Math.min(lo, p[i]);
        hi = Math.max(hi, p[i]);
      }
      expect(lo).toBeGreaterThanOrEqual(-0.01);
      expect(hi).toBeCloseTo(1, 2);
    }
  });

  it("spawns every reef school with the variants' collision (fish containment)", () => {
    const layout = outerReefLayout(),
      colliders: ConvexCollider[] = [],
      boxes: ConvexCollider[] = [];
    const add = (root: string, m: THREE.Matrix4) => {
      const min = new THREE.Vector3(Infinity, Infinity, Infinity),
        max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
      for (const h of hulls(root)) {
        const c = rockCollider(h, m);
        colliders.push(c);
        min.min(new THREE.Vector3(c.min.x, c.min.y, c.min.z));
        max.max(new THREE.Vector3(c.max.x, c.max.y, c.max.z));
      }
      boxes.push(boxCollider([min.x, min.y, min.z], [max.x, max.y, max.z]));
    };
    for (const p of layout.placements)
      if (p.family === 'rock' || p.family === 'backdrop')
        add(`OuterRock_${p.template}_Root`, placementMatrix(p));
    const seated = seatOnRocks(layout.placements, colliders, seabedHeight);
    for (const p of seated)
      if (
        p.family === 'branching' ||
        p.family === 'massive' ||
        p.family === 'plate'
      )
        add(`OuterCoral_${p.family}_${p.template}_Root`, placementMatrix(p));
    const g = OUTER.glass,
      habitat = {
        bounds: {
          min: { x: -g.halfWidth, y: g.bottom, z: g.z },
          max: { x: g.halfWidth, y: g.top, z: OUTER.bounds.max.z },
          clearance: OUTER.bounds.clearance,
        },
        rocks: [
          ...boxes,
          boxCollider(
            [OUTER.bounds.min.x - 1, OUTER.bounds.min.y - 1, OUTER.cliffZ - 1],
            [
              OUTER.bounds.max.x + 1,
              OUTER.bounds.max.y + 1,
              OUTER.bounds.max.z + 1,
            ],
          ),
        ],
        interests: outerInterests({
          placements: [...layout.placements],
          heads: layout.heads,
        }),
        substrateHeight: seabedHeight,
        floorHeight: seabedHeight,
      };
    const fish = new FishSystem(
      habitat,
      outerSpecies(reefObstacles(seated)),
      24024,
    );
    try {
      expect(fish.simulation.fish.length).toBeGreaterThan(50);
      for (const f of fish.simulation.fish)
        for (const r of habitat.rocks)
          expect(
            f.position.x > r.min.x &&
              f.position.x < r.max.x &&
              f.position.y > r.min.y &&
              f.position.y < r.max.y &&
              f.position.z > r.min.z &&
              f.position.z < r.max.z,
          ).toBe(false);
    } finally {
      fish.dispose();
    }
  });
});

describe('V0.8 Pass 085 kelp', () => {
  it('turns every plant broadly downstream, within the current spread', () => {
    for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      const yaw = downstream(u);
      expect(Math.abs(yaw - STALKS.current)).toBeLessThanOrEqual(
        STALKS.currentSpread + 1e-9,
      );
    }
  });

  it('keeps each template within its triangle budget', () => {
    STALKS.heights.forEach((h, t) => {
      const g = stalkTemplate(h, 101 + t * 37, STALKS.stipes[t]);
      const tris = g.getAttribute('position').count / 3;
      // Seven templates instanced over ~230 plants: about the Pass 071 forest's cost.
      expect(tris, `template ${t}`).toBeLessThan(8000 * STALKS.stipes[t]);
      g.dispose();
    });
  });
});
