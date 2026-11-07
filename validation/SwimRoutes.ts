import * as THREE from 'three';
import type { Aquarium } from '../src/environment/Aquarium';
import { AQUARIUM, COLLISION, SPAWN, type Vec3 } from '../src/config/world';
import { clearFishRoute, safeFishPosition } from '../src/fish/FishHabitat';
import { createSwimState, integrateSwimming } from '../src/player/swimming';

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

/** Deterministic steering fixture using the production swimming integrator and complete collision world. */
export function swimRoute(q: Aquarium, points: readonly Readonly<Vec3>[]) {
  const state = createSwimState({ ...points[0] }),
    direction = { x: 0, y: 0, z: 0 },
    h = q.fish.simulation.habitat;
  let frames = 0,
    maximumError = 0;
  for (const target of points.slice(1)) {
    let reached = false;
    for (let frame = 0; frame < 3600; frame++) {
      const dx = target.x - state.position.x,
        dy = target.y - state.position.y,
        dz = target.z - state.position.z,
        distance = Math.hypot(dx, dy, dz);
      if (distance < 0.075) {
        reached = true;
        maximumError = Math.max(maximumError, distance);
        break;
      }
      direction.x = dx / distance;
      direction.y = dy / distance;
      direction.z = dz / distance;
      integrateSwimming(
        state,
        direction,
        1 / 30,
        {
          speed: Math.min(2.8, Math.max(0.25, distance * 1.5)),
          feel: 'natural',
          reducedMotion: false,
        },
        AQUARIUM,
        q.collision,
      );
      if (!safeFishPosition(state.position, COLLISION.playerRadius, h))
        throw Error('Player entered a solid');
      frames++;
    }
    if (!reached)
      throw Error(
        `Player route stuck near ${JSON.stringify(target)} at ${JSON.stringify(state.position)}`,
      );
  }
  return { state, frames, maximumError };
}
