import { createFishBurst } from './FishBurst';
import { createFishBehavior } from './FishBehavior';
import { SPAWN, type Vec3 } from '../config/world';
import {
  FISH_SPECIES,
  FISH_STEERING,
  FISH_TIMING,
  type FishSpecies,
} from './FishSpecies';
import type { FishEntity } from './FishEntity';
import {
  safeFishPosition,
  clearFishRoute,
  type FishHabitat,
} from './FishHabitat';

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
      const size = (0.9 + random() * 0.2) * (config.individualScale?.[i] ?? 1);
      // Half the full nose-to-tail length conservatively encloses fins and body.
      const radius = config.length * size * (config.radiusFactor ?? 0.56);
      const position = { x: 0, y: 0, z: 0 };
      let placed = false;
      const host = config.hostAnchorId
        ? (habitat.creatureAnchors?.find(
            (a) => a.id === config.hostAnchorId,
          ) ?? {
            id: config.hostAnchorId,
            position: config.region,
            orientation: { x: 0, y: 1, z: 0 },
            homeRadius: config.homeRadius ?? 3,
            habitatKind: 'coral-edge' as const,
          })
        : undefined;
      if (
        config.hostAnchorId &&
        habitat.creatureAnchors &&
        !habitat.creatureAnchors.some((a) => a.id === config.hostAnchorId)
      )
        throw new Error('Missing required fish host anchor.');
      const candidates = config.habitatKinds
        ? habitat.interests?.filter(
            (p) =>
              config.habitatKinds!.includes(p.kind) &&
              safeFishPosition(p.position, radius + 0.15, habitat),
          )
        : undefined;
      const priority = candidates?.length
        ? Math.min(
            ...candidates.map((p) => config.habitatKinds!.indexOf(p.kind)),
          )
        : -1;
      const homes = candidates?.filter(
        (p) => config.habitatKinds!.indexOf(p.kind) === priority,
      );
      let home =
        host?.position ??
        (homes?.length
          ? homes[(i + species.indexOf(config) * 7) % homes.length].position
          : undefined);
      for (let attempt = 0; attempt < 400; attempt++) {
        // Crowded anchors can retry another compatible shelter without relaxing any clearance.
        if (homes?.length && attempt > 0 && attempt % 80 === 0)
          home =
            homes[
              (i + species.indexOf(config) * 7 + attempt / 80) % homes.length
            ].position;
        position.x = config.region.x + (random() * 2 - 1) * config.spread.x;
        position.y = Math.max(
          config.depth[0],
          Math.min(
            config.depth[1],
            config.region.y + (random() * 2 - 1) * config.spread.y,
          ),
        );
        position.z = config.region.z + (random() * 2 - 1) * config.spread.z;
        if (config.substrateOffset)
          position.y =
            (habitat.substrateHeight?.(position.x, position.z) ?? 0) +
            Math.max(
              radius + 0.12,
              config.substrateOffset[0] +
                random() *
                  (config.substrateOffset[1] - config.substrateOffset[0]),
            );
        if (home) {
          position.x = home.x + (random() * 2 - 1) * 1.3;
          position.z = home.z + (random() * 2 - 1) * 1.3;
          position.y = home.y + (random() * 2 - 1) * 0.25;
        }
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
      let yaw = (random() * 2 - 1) * Math.PI;
      const pitch = (random() * 2 - 1) * 0.12;
      const speedFactor = 0.88 + random() * 0.24,
        turnFactor = 0.88 + random() * 0.24,
        temperament = 0.8 + random() * 0.4;
      const speed = config.speed * speedFactor * (0.6 + random() * 0.3),
        phase = random() * Math.PI * 2;
      const targetTime = random() * 3,
        individualSeed = (random() * 4294967296) >>> 0,
        age = random() * 30;
      // Keep seeded positions and RNG consumption; only reject an initial heading
      // whose existing steering look-ahead already crosses a solid. This is setup,
      // not a change to the ongoing steering/avoidance controller.
      const ahead = { x: 0, y: 0, z: 0 },
        originalYaw = yaw;
      let headingClear = false;
      for (let turn = 0; turn <= 16; turn++) {
        const offset =
          ((Math.ceil(turn / 2) * Math.PI) / 8) * (turn % 2 ? 1 : -1);
        const candidate = originalYaw + offset;
        ahead.x =
          position.x +
          Math.cos(candidate) *
            Math.cos(pitch) *
            speed *
            FISH_STEERING.lookAheadSeconds;
        ahead.y =
          position.y + Math.sin(pitch) * speed * FISH_STEERING.lookAheadSeconds;
        ahead.z =
          position.z -
          Math.sin(candidate) *
            Math.cos(pitch) *
            speed *
            FISH_STEERING.lookAheadSeconds;
        if (clearFishRoute(position, ahead, radius, habitat)) {
          yaw =
            turn === 0
              ? originalYaw
              : Math.atan2(Math.sin(candidate), Math.cos(candidate));
          headingClear = true;
          break;
        }
      }
      const initialSpeed = headingClear ? speed : 0;
      fish.push({
        id: fish.length,
        species: config,
        size,
        shelter: home ? { ...home } : undefined,
        host,
        radius,
        speedFactor,
        turnFactor,
        temperament,
        position,
        previousPosition: { ...position },
        velocity: {
          x: Math.cos(yaw) * Math.cos(pitch) * initialSpeed,
          y: Math.sin(pitch) * initialSpeed,
          z: -Math.sin(yaw) * Math.cos(pitch) * initialSpeed,
        },
        target: { ...position },
        yaw,
        previousYaw: yaw,
        pitch,
        previousPitch: pitch,
        speed: initialSpeed,
        phase,
        previousPhase: phase,
        bank: 0,
        previousBank: 0,
        targetTime,
        randomState: individualSeed,
        age,
        behavior: createFishBehavior(
          individualSeed ^ fish.length,
          position,
          config,
          temperament,
        ),
        burst: createFishBurst(individualSeed),
        corrections: 0,
        reaction: {
          awareness: 0,
          scatter: 0,
          direction: { x: 0, y: 0, z: 0 },
          probe: { x: 0, y: 0, z: 0 },
        },
      });
    }
  }
  for (const f of fish)
    if (f.host)
      f.hostMate = fish.find(
        (other) => other !== f && other.host?.id === f.host!.id,
      )?.position;
  return fish;
}
export function populationCount(
  species: readonly FishSpecies[] = FISH_SPECIES,
): number {
  return species.reduce((sum, s) => sum + s.count, 0);
}
