import { COLLISION, type Vec3 } from '../config/world';
import type { FishEntity } from './FishEntity';

/** Read-only physical diver input. Fish never own controls, the camera, or player collisions. */
export interface PlayerPresence {
  readonly position: Readonly<Vec3>;
  readonly velocity: Readonly<Vec3>;
  readonly active: boolean;
}
export interface DiverReaction {
  awareness: number;
  scatter: number;
  readonly direction: Vec3;
  readonly probe: Vec3;
}
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const smooth = (x: number): number => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/** Blended awareness/scatter envelopes, with a slower finite recovery and no behavior state machine. */
export function updateDiverReaction(
  fish: FishEntity,
  player: PlayerPresence | undefined,
  dt: number,
): void {
  const state = fish.reaction,
    config = fish.species.diver;
  let awareness = 0,
    scatter = 0;
  if (player?.active) {
    const dx = fish.position.x - player.position.x,
      dy = fish.position.y - player.position.y,
      dz = fish.position.z - player.position.z;
    const squared = dx * dx + dy * dy + dz * dz,
      limit = config.awarenessRadius + fish.radius + COLLISION.playerRadius;
    if (squared < limit * limit) {
      const distance = Math.sqrt(squared),
        clearance = distance - fish.radius - COLLISION.playerRadius;
      const angle = fish.id * 2.399963229728653;
      const nx = distance > 1e-8 ? dx / distance : Math.cos(angle),
        ny = distance > 1e-8 ? dy / distance : 0,
        nz = distance > 1e-8 ? dz / distance : Math.sin(angle);
      const closing = Math.max(
        0,
        (player.velocity.x - fish.velocity.x) * nx +
          (player.velocity.y - fish.velocity.y) * ny +
          (player.velocity.z - fish.velocity.z) * nz,
      );
      const approach = clamp01(closing / config.approachSpeed);
      awareness =
        smooth((config.awarenessRadius - clearance) / config.awarenessRadius) *
        config.sensitivity;
      const contact = smooth(
        (config.strongRadius - clearance) / config.strongRadius,
      );
      const approachScatter =
        smooth(
          (config.comfortRadius - clearance) /
            (config.comfortRadius - config.strongRadius),
        ) * approach;
      scatter = Math.max(contact, approachScatter) * config.sensitivity;
      // Independent side choices clear an approaching diver's path instead of only fleeing straight ahead.
      const side = fish.id % 2 === 0 ? 1 : -1,
        variation = Math.sin(angle) * 0.25;
      const horizontal = Math.hypot(player.velocity.x, player.velocity.z);
      const sx =
        horizontal > 1e-6 ? player.velocity.z / horizontal : Math.cos(angle);
      const sz =
        horizontal > 1e-6 ? -player.velocity.x / horizontal : Math.sin(angle);
      const ex = nx - nz * variation + sx * side * approach * 1.1;
      const ey = ny * 0.7 + Math.sin(angle + 1) * 0.1 * scatter;
      const ez = nz + nx * variation + sz * side * approach * 1.1;
      const length = Math.max(1e-8, Math.hypot(ex, ey, ez));
      const blend = -Math.expm1(-config.directionResponse * dt);
      state.direction.x += (ex / length - state.direction.x) * blend;
      state.direction.y += (ey / length - state.direction.y) * blend;
      state.direction.z += (ez / length - state.direction.z) * blend;
    }
  }
  const awarenessRate =
    awareness > state.awareness
      ? config.awarenessResponse
      : 3 / config.recoverySeconds;
  const scatterRate =
    scatter > state.scatter
      ? config.scatterResponse
      : 3 / config.recoverySeconds;
  state.awareness +=
    (awareness - state.awareness) * -Math.expm1(-awarenessRate * dt);
  state.scatter += (scatter - state.scatter) * -Math.expm1(-scatterRate * dt);
  if (awareness === 0 && state.awareness < 1e-5) state.awareness = 0;
  if (scatter === 0 && state.scatter < 1e-5) state.scatter = 0;
  if (state.awareness === 0 && state.scatter === 0) {
    state.direction.x = state.direction.y = state.direction.z = 0;
    state.probe.x = state.probe.y = state.probe.z = 0;
  }
}
