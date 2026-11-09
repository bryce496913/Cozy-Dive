import { expect, it } from 'vitest';
import * as THREE from 'three';
import inventory from '../tools/art/pass013/collisions.json';
import { Aquarium } from '../src/environment/Aquarium';
import { installAuthoredHulls } from '../validation/AuthoredCollision';
import { safeFishPosition } from '../src/fish/FishHabitat';
import { integrationRoutes } from '../validation/SwimRoutes';

it('preserves passable log/arch openings and accepted creature homes with authored structural hulls', () => {
  const q = new Aquarium();
  try {
    installAuthoredHulls(q);
    for (const kind of ['log', 'arch'] as const) {
      const m = q.ornaments.models.find((m) => m.kind === kind)!;
      for (let i = 0; i <= 20; i++) {
        const p = new THREE.Vector3(
          0,
          kind === 'log' ? 1.28 : 1.35,
          -1.8 + i * 0.18,
        ).applyMatrix4(m.root.matrixWorld);
        expect(
          safeFishPosition(p, 0.3, q.fish.simulation.habitat),
          `${kind} opening ${i}`,
        ).toBe(true);
      }
    }
    for (const a of q.ornaments.anchors)
      expect(
        safeFishPosition(a.position, 0.3, q.fish.simulation.habitat),
        a.anchorId,
      ).toBe(true);
    const identity = q.ornaments.lidCollider;
    const chest = q.ornaments.models.find((m) => m.kind === 'chest')!;
    const hinge = chest.hinge!.getWorldPosition(new THREE.Vector3());
    q.ornaments.update(0.1, true, false, {
      position: hinge,
      velocity: { x: 0, y: 0, z: 0 },
      active: true,
    });
    expect(q.ornaments.chest.angle).toBe(0);
    expect(q.ornaments.lidCollider).toBe(identity);
  } finally {
    q.dispose();
  }
});
it('keeps every discovery approach, arch passage and wreck circuit clear with authored structural hulls', () => {
  const procedural = new Aquarium(),
    q = new Aquarium();
  try {
    installAuthoredHulls(q);
    // Homes are chosen against procedural hulls; installing authored hulls must not move them.
    expect(
      q.anchoredLife.hidden.homes.map((h) => [h.sourceId, h.position]),
    ).toEqual(
      procedural.anchoredLife.hidden.homes.map((h) => [h.sourceId, h.position]),
    );
    expect(integrationRoutes(q).map((r) => r.id)).toContain('frogfish');
  } finally {
    q.dispose();
    procedural.dispose();
  }
});
it('keeps every authored lid vertex inside the existing occupant sweep guard', () => {
  const lid = inventory.Chest.find((r) => r.name.startsWith('DYNAMIC_'))!;
  for (const [x, y, z] of lid.points)
    expect(Math.hypot(x, y + 0.065, z + 0.59)).toBeLessThan(1.52);
});
