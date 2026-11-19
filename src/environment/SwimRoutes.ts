import * as THREE from 'three';
import type { Aquarium } from './Aquarium';
import { SPAWN } from '../config/world';
import { clearFishRoute } from '../fish/FishHabitat';

export function integrationRoutes(q: Aquarium) {
  const arch = q.ornaments.models.find((m) => m.kind === 'arch')!,
    from = new THREE.Vector3(0, 1.35, 2.2).applyMatrix4(arch.root.matrixWorld),
    to = new THREE.Vector3(0, 1.35, -1.2).applyMatrix4(arch.root.matrixWorld),
    wreck = q.ornaments.models.find((m) => m.kind === 'shipwreck')!,
    box = new THREE.Box3().setFromObject(wreck.root),
    h = q.fish.simulation.habitat;
  const routes = q.anchoredLife.hidden.homes.map((home) => ({
    id: home.id,
    points: home.approach,
    focus: home.focus,
  }));
  routes.push({
    id: 'stone-arch-through',
    points: [
      SPAWN,
      { ...SPAWN, y: 11 },
      { x: from.x, y: 11, z: from.z },
      from,
      to,
    ],
    focus: new THREE.Vector3(0, 1.35, 0).applyMatrix4(arch.root.matrixWorld),
  });
  // Find a complete clear circuit around the actual wreck, never through a box standing in for its hulls.
  for (const y of [1.4, 2.5, 3.5, 4.5, 6]) {
    const ring = [
      { x: box.min.x - 0.8, y, z: box.min.z - 0.8 },
      { x: box.max.x + 0.8, y, z: box.min.z - 0.8 },
      { x: box.max.x + 0.8, y, z: box.max.z + 0.8 },
      { x: box.min.x - 0.8, y, z: box.max.z + 0.8 },
      { x: box.min.x - 0.8, y, z: box.min.z - 0.8 },
    ];
    const points = [SPAWN, { ...SPAWN, y: 11 }, { ...ring[0], y: 11 }, ...ring];
    if (
      points.every((p, i) => !i || clearFishRoute(points[i - 1], p, 0.65, h))
    ) {
      routes.push({
        id: 'shipwreck-circuit',
        points,
        focus: wreck.root.position,
      });
      break;
    }
  }
  if (routes.length !== 9) throw Error('No safe full-wreck circuit');
  for (const route of routes)
    for (let i = 1; i < route.points.length; i++)
      if (!clearFishRoute(route.points[i - 1], route.points[i], 0.65, h))
        throw Error(`Unsafe route ${route.id}/${i}`);
  return routes;
}
