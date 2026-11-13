import type { Aquarium } from '../src/environment/Aquarium';
import { AQUARIUM, COLLISION, type Vec3 } from '../src/config/world';
import { safeFishPosition } from '../src/fish/FishHabitat';
import { createSwimState, integrateSwimming } from '../src/player/swimming';

export { integrationRoutes } from '../src/environment/SwimRoutes';

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
