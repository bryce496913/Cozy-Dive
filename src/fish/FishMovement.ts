import { angleDifference, randomFish, type FishEntity } from './FishEntity';
import { FISH_STEERING, FISH_TIMING } from './FishSpecies';
import { safeFishPosition, type FishHabitat } from './FishHabitat';

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, value));
function chooseTarget(fish: FishEntity, habitat: FishHabitat): void {
  const { species: s, target, position: p } = fish;
  const b = habitat.bounds;
  const oldX = target.x,
    oldY = target.y,
    oldZ = target.z;
  let found = false;
  for (let attempt = 0; attempt < 24; attempt++) {
    // Reject outward samples instead of clamping many targets onto the same wall/corner.
    target.x = p.x + (randomFish(fish) * 2 - 1) * 8;
    target.y = s.depth[0] + randomFish(fish) * (s.depth[1] - s.depth[0]);
    target.z = p.z + (randomFish(fish) * 2 - 1) * 8;
    if (
      target.x < b.min.x + 2 ||
      target.x > b.max.x - 2 ||
      target.z < b.min.z + 2 ||
      target.z > b.max.z - 2
    )
      continue;
    if (safeFishPosition(target, fish.radius, habitat)) {
      found = true;
      break;
    }
  }
  if (!found) {
    target.x = oldX;
    target.y = oldY;
    target.z = oldZ;
    if (!safeFishPosition(target, fish.radius, habitat)) {
      target.x = p.x;
      target.y = p.y;
      target.z = p.z;
    }
  }
  fish.targetTime =
    s.wanderSeconds[0] +
    randomFish(fish) * (s.wanderSeconds[1] - s.wanderSeconds[0]);
}

/** Independent steering. Future group steering can add a vector before the heading/speed limits. */
export function stepFish(
  fish: FishEntity,
  habitat: FishHabitat,
  dt: number,
): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, FISH_TIMING.step);
  const p = fish.position,
    s = fish.species,
    b = habitat.bounds;
  fish.previousPosition.x = p.x;
  fish.previousPosition.y = p.y;
  fish.previousPosition.z = p.z;
  fish.previousYaw = fish.yaw;
  fish.previousPitch = fish.pitch;
  fish.previousPhase = fish.phase;
  fish.previousBank = fish.bank;
  fish.age += dt;
  fish.targetTime -= dt;
  let tx = fish.target.x - p.x,
    ty = fish.target.y - p.y,
    tz = fish.target.z - p.z;
  if (
    fish.targetTime <= 0 ||
    !safeFishPosition(fish.target, fish.radius, habitat) ||
    Math.hypot(tx, ty, tz) < FISH_STEERING.targetDistance
  ) {
    chooseTarget(fish, habitat);
    tx = fish.target.x - p.x;
    ty = fish.target.y - p.y;
    tz = fish.target.z - p.z;
  }
  const length = Math.max(1e-8, Math.hypot(tx, ty, tz));
  tx /= length;
  ty /= length;
  tz /= length;
  // Gentle soft habitat preference, rather than an invisible depth boundary.
  if (p.y < s.depth[0]) ty += (s.depth[0] - p.y) * 0.5;
  if (p.y > s.depth[1]) ty -= (p.y - s.depth[1]) * 0.5;
  const hx = Math.cos(fish.yaw) * Math.cos(fish.pitch),
    hy = Math.sin(fish.pitch),
    hz = -Math.sin(fish.yaw) * Math.cos(fish.pitch);
  const range =
    fish.radius +
    FISH_STEERING.safetyMargin +
    fish.speed * FISH_STEERING.lookAheadSeconds;
  const nearXMin = clamp(1 - (p.x - b.min.x - fish.radius) / range, 0, 1);
  const nearXMax = clamp(1 - (b.max.x - p.x - fish.radius) / range, 0, 1);
  const nearYMin = clamp(1 - (p.y - b.min.y - fish.radius) / range, 0, 1);
  const nearYMax = clamp(1 - (b.max.y - p.y - fish.radius) / range, 0, 1);
  const nearZMin = clamp(1 - (p.z - b.min.z - fish.radius) / range, 0, 1);
  const nearZMax = clamp(1 - (b.max.z - p.z - fish.radius) / range, 0, 1);
  let danger = Math.max(
    nearXMin,
    nearXMax,
    nearYMin,
    nearYMax,
    nearZMin,
    nearZMax,
  );
  const wallWeight = FISH_STEERING.avoidanceWeight;
  tx += (nearXMin ** 2 - nearXMax ** 2) * wallWeight;
  ty += (nearYMin ** 2 - nearYMax ** 2) * wallWeight;
  tz += (nearZMin ** 2 - nearZMax ** 2) * wallWeight;
  for (const rock of habitat.rocks) {
    if (
      p.x < rock.min.x - range ||
      p.x > rock.max.x + range ||
      p.y < rock.min.y - range ||
      p.y > rock.max.y + range ||
      p.z < rock.min.z - range ||
      p.z > rock.max.z + range
    )
      continue;
    let distance = -Infinity,
      nx = 0,
      ny = 0,
      nz = 0;
    for (const plane of rock.planes) {
      const d =
        plane.x * p.x +
        plane.y * p.y +
        plane.z * p.z -
        plane.offset -
        fish.radius;
      if (d > distance) {
        distance = d;
        nx = plane.x;
        ny = plane.y;
        nz = plane.z;
      }
    }
    const approaching = Math.max(0, -(nx * hx + ny * hy + nz * hz));
    const influence = clamp(1 - distance / range, 0, 1);
    const weight =
      influence *
      influence *
      FISH_STEERING.avoidanceWeight *
      (0.55 + approaching);
    danger = Math.max(danger, influence);
    tx += nx * weight;
    ty += ny * weight;
    tz += nz * weight;
    // A persistent individual side bias breaks head-on symmetry without per-frame noise.
    const side = fish.id % 2 === 0 ? 1 : -1;
    tx += -nz * weight * 0.32 * side;
    tz += nx * weight * 0.32 * side;
  }
  const desiredYaw = Math.atan2(-tz, tx);
  const desiredPitch = clamp(
    Math.atan2(ty, Math.hypot(tx, tz)),
    -FISH_STEERING.maxPitch,
    FISH_STEERING.maxPitch,
  );
  let yawDelta = angleDifference(desiredYaw, fish.yaw),
    pitchDelta = desiredPitch - fish.pitch;
  const desiredTurn = Math.hypot(yawDelta, pitchDelta);
  const limit = s.turnRate * fish.turnFactor * dt;
  const factor = Math.min(1, limit / Math.max(1e-8, desiredTurn));
  yawDelta *= factor;
  pitchDelta *= factor;
  fish.yaw += yawDelta;
  fish.pitch += pitchDelta;
  const variation =
    0.88 +
    0.12 *
      Math.sin(fish.age * (0.27 + fish.temperament * 0.09) + fish.id * 2.3);
  const targetSpeed =
    Math.min(
      s.maxSpeed * fish.speedFactor,
      s.speed * fish.speedFactor * variation,
    ) *
    (1 - 0.45 * danger) *
    (1 - 0.3 * Math.min(1, desiredTurn));
  fish.speed += clamp(
    targetSpeed - fish.speed,
    -s.acceleration * dt,
    s.acceleration * dt,
  );
  const vx = Math.cos(fish.yaw) * Math.cos(fish.pitch) * fish.speed,
    vy = Math.sin(fish.pitch) * fish.speed,
    vz = -Math.sin(fish.yaw) * Math.cos(fish.pitch) * fish.speed;
  // Reuse velocity as candidate storage; final guard holds position rather than teleporting.
  fish.velocity.x = p.x + vx * dt;
  fish.velocity.y = p.y + vy * dt;
  fish.velocity.z = p.z + vz * dt;
  if (safeFishPosition(fish.velocity, fish.radius, habitat)) {
    p.x = fish.velocity.x;
    p.y = fish.velocity.y;
    p.z = fish.velocity.z;
    fish.velocity.x = vx;
    fish.velocity.y = vy;
    fish.velocity.z = vz;
  } else {
    fish.corrections++;
    fish.speed = Math.max(0, fish.speed - s.acceleration * dt);
    fish.velocity.x = fish.velocity.y = fish.velocity.z = 0;
  }
  const actualSpeed = Math.hypot(
    fish.velocity.x,
    fish.velocity.y,
    fish.velocity.z,
  );
  fish.phase =
    (fish.phase +
      2 *
        Math.PI *
        s.tailHz *
        (0.25 + (0.75 * actualSpeed) / (s.speed * fish.speedFactor)) *
        dt) %
    (2 * Math.PI);
  fish.bank +=
    (clamp((-yawDelta / dt) * 0.14, -0.14, 0.14) - fish.bank) *
    -Math.expm1(-4 * dt);
}

/** Fixed cadence simulation, independent of render FPS and player updates. */
export class FishSimulation {
  readonly fish: FishEntity[];
  private accumulator = 0;
  time = 0;
  steps = 0;
  constructor(
    fish: FishEntity[],
    readonly habitat: FishHabitat,
  ) {
    this.fish = fish;
  }
  get alpha(): number {
    return this.accumulator / FISH_TIMING.step;
  }
  advance(dt: number, active: boolean): void {
    if (!active || !Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += Math.min(dt, FISH_TIMING.step * FISH_TIMING.maxCatchUp);
    let catchUp = 0;
    while (
      this.accumulator + 1e-10 >= FISH_TIMING.step &&
      catchUp < FISH_TIMING.maxCatchUp
    ) {
      for (const fish of this.fish)
        stepFish(fish, this.habitat, FISH_TIMING.step);
      this.accumulator = Math.max(0, this.accumulator - FISH_TIMING.step);
      this.time += FISH_TIMING.step;
      this.steps++;
      catchUp++;
    }
  }
}
