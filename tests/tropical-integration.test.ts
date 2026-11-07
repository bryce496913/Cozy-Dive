import * as THREE from 'three';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { Aquarium } from '../src/environment/Aquarium';
import { tropicalSnapshot } from '../validation/TropicalAudit';

let q: Aquarium;
beforeAll(() => {
  q = new Aquarium();
});
afterAll(() => q.dispose());

it('freezes the complete marine scene across a long paused gap and resumes one bounded step', () => {
  for (let i = 0; i < 900; i++) q.update(i / 30, false, 1 / 30, true);
  const before = tropicalSnapshot(q),
    matrices: number[][] = [];
  q.root.traverse((o) => matrices.push(o.matrixWorld.toArray()));
  q.update(899 / 30, false, 3600, false);
  expect(tropicalSnapshot(q)).toEqual(before);
  const after: number[][] = [];
  q.root.traverse((o) => after.push(o.matrixWorld.toArray()));
  expect(after).toEqual(matrices);
  q.update(30 + 1 / 30, false, 1 / 30, true);
  const resumed = tropicalSnapshot(q);
  expect(resumed.clocks[2] - before.clocks[2]).toBeCloseTo(1 / 30, 8);
  expect(resumed.population).toEqual(before.population);
  expect(resumed.geometries).toBe(before.geometries);
  expect(resumed.materials).toBe(before.materials);
});

it('couples multiple real hinge cycles to one pooled burst each without growing resources', () => {
  const o = q.ornaments,
    b = o.bubbles,
    pool = b.mesh.instanceMatrix.array,
    initial = tropicalSnapshot(q),
    openings = o.chest.openings,
    bursts = b.bursts;
  let previous = o.chest.angle,
    maxJump = 0,
    emptyIntervals = 0;
  for (let i = 0; i < 9000; i++) {
    o.update(1 / 30, true, false);
    maxJump = Math.max(maxJump, Math.abs(o.chest.angle - previous));
    previous = o.chest.angle;
    if (!b.activeCount && !b.mesh.count) emptyIntervals++;
    expect(b.mesh.count).toBeLessThanOrEqual(18);
    expect(b.mesh.instanceMatrix.array).toBe(pool);
  }
  expect(o.chest.openings - openings).toBeGreaterThan(7);
  expect(b.bursts - bursts).toBe(o.chest.openings - openings);
  expect(maxJump).toBeLessThan(0.015);
  expect(emptyIntervals).toBeGreaterThan(60);
  const end = tropicalSnapshot(q);
  expect(end.bubblesInside).toBe(true);
  expect(end.geometries).toBe(initial.geometries);
  expect(end.materials).toBe(initial.materials);
  const time = o.chest.time;
  o.update(0.1, true, true);
  expect(o.chest.time).toBe(time);
  expect(b.mesh.count).toBe(0);
  expect(b.activeCount).toBe(0);
  o.update(1 / 30, true, false);
  expect(o.chest.time - time).toBeCloseTo(1 / 30, 8);
});

it('terminates a surface-adjacent burst before crossing the water and reuses its exact pool', () => {
  const b = q.ornaments.bubbles,
    pool = b.mesh.instanceMatrix.array,
    matrix = new THREE.Matrix4();
  b.emit(new THREE.Vector3(-5, 13.7, 9));
  for (let i = 0; i < 600; i++) {
    b.update(1 / 30, true, false);
    for (let j = 0; j < b.mesh.count; j++) {
      b.mesh.getMatrixAt(j, matrix);
      expect(matrix.elements[13]).toBeLessThan(13.92);
    }
  }
  expect(b.activeCount).toBe(0);
  expect(b.mesh.count).toBe(0);
  expect(b.mesh.instanceMatrix.array).toBe(pool);
});

it('physically swims all seven discovery routes, through the arch and around the wreck', async () => {
  const { integrationRoutes, swimRoute } =
    await import('../validation/SwimRoutes');
  const routes = integrationRoutes(q);
  expect(routes).toHaveLength(9);
  for (const route of routes) {
    const result = swimRoute(q, route.points);
    expect(result.maximumError).toBeLessThan(0.075);
    expect(result.frames).toBeGreaterThan(30);
  }
});
