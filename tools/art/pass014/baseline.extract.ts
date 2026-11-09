// Run with: npx vitest run --config tools/art/pass014/vitest.config.ts
// Extracts the accepted pre-Pass-014 structural envelopes the authored reef must conform to.
import { test } from 'vitest';
import { writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { Aquarium } from '../../../src/environment/Aquarium';
import { createRockTemplates } from '../../../src/environment/RockGeometry';
import { createPlantGeometry } from '../../../src/environment/PlantGeometry';
import {
  PLANT_SPECIES,
  PLANT_TEMPLATES,
  MEADOW_GRASS,
} from '../../../src/environment/PlantSpecies';
import type { ConvexCollider } from '../../../src/player/collision';

const round = (v: number): number => Math.round(v * 1e6) / 1e6;
function unique(g: THREE.BufferGeometry): number[][] {
  const p = g.attributes.position,
    seen = new Map<string, number[]>();
  for (let i = 0; i < p.count; i++) {
    const v = [round(p.getX(i)), round(p.getY(i)), round(p.getZ(i))];
    seen.set(v.join(','), v);
  }
  return [...seen.values()];
}
/** Vertex enumeration of a convex collider from its support planes. */
function hullPoints(c: ConvexCollider, origin: THREE.Vector3): number[][] {
  const out = new Map<string, number[]>(),
    m = new THREE.Matrix3(),
    n = c.planes;
  for (let a = 0; a < n.length; a++)
    for (let b = a + 1; b < n.length; b++)
      for (let d = b + 1; d < n.length; d++) {
        m.set(
          n[a].x,
          n[a].y,
          n[a].z,
          n[b].x,
          n[b].y,
          n[b].z,
          n[d].x,
          n[d].y,
          n[d].z,
        );
        if (Math.abs(m.determinant()) < 1e-9) continue;
        const v = new THREE.Vector3(
          n[a].offset,
          n[b].offset,
          n[d].offset,
        ).applyMatrix3(m.clone().invert());
        if (n.some((p) => p.x * v.x + p.y * v.y + p.z * v.z > p.offset + 1e-6))
          continue;
        const r = [
          round(v.x - origin.x),
          round(v.y - origin.y),
          round(v.z - origin.z),
        ];
        out.set(r.map((x) => x.toFixed(4)).join(','), r);
      }
  return [...out.values()];
}
function envelope(g: THREE.BufferGeometry): number[] {
  const bins = new Array<number>(21).fill(0),
    p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const bin = Math.max(0, Math.min(20, Math.round(p.getY(i) * 20)));
    bins[bin] = Math.max(bins[bin], round(Math.hypot(p.getX(i), p.getZ(i))));
  }
  return bins;
}
test('extract Pass 014 baseline', () => {
  const templates = createRockTemplates();
  const q = new Aquarium();
  const rocks: unknown[] = [];
  q.root.children.forEach((o) => {
    if (!(o instanceof THREE.Mesh) || !o.name.startsWith('Rock ')) return;
    const major = templates.major.findIndex((g) => g.uuid === o.geometry.uuid);
    rocks.push({
      name: o.name,
      family: o.geometry.name,
      position: o.position.toArray().map(round),
      scale: o.scale.toArray().map(round),
      rotation: [o.rotation.x, o.rotation.y, o.rotation.z].map(round),
      major,
    });
  });
  const plants: Record<string, number[][]> = {};
  PLANT_SPECIES.concat([MEADOW_GRASS]).forEach((species, s) => {
    plants[species.id] = [];
    for (let t = 0; t < PLANT_TEMPLATES; t++) {
      const g =
        species === MEADOW_GRASS
          ? createPlantGeometry(
              { ...MEADOW_GRASS, width: t === 2 ? 0.045 : 0.022 },
              92047 + t * 193,
            )
          : createPlantGeometry(species, 48193 + s * 193 + t * 41);
      plants[species.id].push(envelope(g));
      g.dispose();
    }
  });
  const data = {
    note: 'Pre-Pass-014 structural envelopes. Regenerate only when the accepted layout intentionally changes.',
    majorTemplates: templates.major.map((g) => ({
      name: g.name,
      points: unique(g),
    })),
    pebbleTemplates: templates.pebbles.map((g) => ({
      name: g.name,
      points: unique(g),
    })),
    rocks,
    formations: q.hardscape.formations.map((f, i) => ({
      index: i,
      kind: f.kind,
      role: f.role,
      origin: f.position.toArray().map(round),
      parts: f.colliders.map((c) => hullPoints(c, f.position)),
    })),
    plantEnvelopes: plants,
    plantPlacements: q.plants.placements.map((p) => ({
      id: p.id,
      species: p.species.id,
      template: p.template,
      height: round(p.height),
    })),
  };
  writeFileSync('tools/art/pass014/baseline.json', JSON.stringify(data));
  q.dispose();
  templates.major.forEach((g) => g.dispose());
  templates.pebbles.forEach((g) => g.dispose());
});
