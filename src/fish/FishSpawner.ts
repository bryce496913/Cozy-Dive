import { SPAWN, type Vec3 } from '../config/world';
import {
  FISH_SPECIES,
  FISH_STEERING,
  FISH_TIMING,
  type FishSpecies,
} from './FishSpecies';
import type { FishEntity } from './FishEntity';
import { safeFishPosition, type FishHabitat } from './FishHabitat';

/** All allocation and population validation happen at initialization. */
export function spawnFish(
  habitat: FishHabitat,
  species = FISH_SPECIES,
  seed: number = FISH_TIMING.seed,
  player: Vec3 = SPAWN,
): FishEntity[] {
  let randomState = seed >>> 0;
  const random = (): number => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  const fish: FishEntity[] = [];
  for (const config of species) {
    if (!Number.isInteger(config.count) || config.count < 0)
      throw new Error('Fish population must be a nonnegative integer.');
    for (let i = 0; i < config.count; i++) {
      const size = 0.9 + random() * 0.2;
      // Half the full nose-to-tail length conservatively encloses fins and body.
      const radius = config.length * size * 0.56;
      const position = { x: 0, y: 0, z: 0 };
      let placed = false;
      for (let attempt = 0; attempt < 400; attempt++) {
        position.x = config.region.x + (random() * 2 - 1) * config.spread.x;
        position.y = Math.max(
          config.depth[0],
          Math.min(
            config.depth[1],
            config.region.y + (random() * 2 - 1) * config.spread.y,
          ),
        );
        position.z = config.region.z + (random() * 2 - 1) * config.spread.z;
        if (!safeFishPosition(position, radius, habitat)) continue;
        if (
          Math.hypot(
            position.x - player.x,
            position.y - player.y,
            position.z - player.z,
          ) <
          FISH_STEERING.spawnPlayerClearance + radius
        )
          continue;
        if (
          fish.some(
            (other) =>
              Math.hypot(
                position.x - other.position.x,
                position.y - other.position.y,
                position.z - other.position.z,
              ) <
              radius + other.radius + FISH_STEERING.spawnSeparation,
          )
        )
          continue;
        placed = true;
        break;
      }
      if (!placed)
        throw new Error(
          `No safe spawn found for ${config.name}; reduce population or adjust habitat.`,
        );
      const yaw = (random() * 2 - 1) * Math.PI,
        pitch = (random() * 2 - 1) * 0.12;
      const speedFactor = 0.88 + random() * 0.24,
        turnFactor = 0.88 + random() * 0.24,
        temperament = 0.8 + random() * 0.4;
      const speed = config.speed * speedFactor * (0.6 + random() * 0.3),
        phase = random() * Math.PI * 2;
      fish.push({
        id: fish.length,
        species: config,
        size,
        radius,
        speedFactor,
        turnFactor,
        temperament,
        position,
        previousPosition: { ...position },
        velocity: {
          x: Math.cos(yaw) * Math.cos(pitch) * speed,
          y: Math.sin(pitch) * speed,
          z: -Math.sin(yaw) * Math.cos(pitch) * speed,
        },
        target: { ...position },
        yaw,
        previousYaw: yaw,
        pitch,
        previousPitch: pitch,
        speed,
        phase,
        previousPhase: phase,
        bank: 0,
        previousBank: 0,
        targetTime: random() * 3,
        randomState: (random() * 4294967296) >>> 0,
        age: random() * 30,
        corrections: 0,
      });
    }
  }
  return fish;
}
export function populationCount(
  species: readonly FishSpecies[] = FISH_SPECIES,
): number {
  return species.reduce((sum, s) => sum + s.count, 0);
}
