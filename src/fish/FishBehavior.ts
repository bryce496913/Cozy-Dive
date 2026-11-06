import type { Vec3 } from '../config/world';
import { COLLISION } from '../config/world';
import { nextFishRandom, type FishEntity } from './FishEntity';
import type { PlayerPresence } from './FishDiverReaction';
import type { FishActivity, FishBehavior } from './FishBehaviorTypes';
import type { FishSpecies } from './FishSpecies';
import {
  clearFishRoute,
  safeFishPosition,
  type FishHabitat,
} from './FishHabitat';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
function random(b: FishBehavior): number {
  b.randomState = nextFishRandom(b.randomState);
  return b.randomState / 4294967296;
}
function range(b: FishBehavior, values: readonly [number, number]): number {
  return values[0] + random(b) * (values[1] - values[0]);
}
function cruiseDuration(b: FishBehavior, s: FishSpecies): number {
  return range(b, s.behavior.interval) / b.initiative;
}
/** Fork the existing individual seed without consuming spawn or wandering randomness. */
export function createFishBehavior(
  seed: number,
  position: Readonly<Vec3>,
  species: FishSpecies,
  temperament: number,
): FishBehavior {
  const b: FishBehavior = {
    activity: 'cruising',
    elapsed: 0,
    duration: 0,
    cooldown: 0,
    randomState: seed ^ 0x6a09e667,
    initiative: 1,
    restPreference: 1,
    curiosity: 1,
    recovery: 1,
    target: { ...position },
    weight: 0,
    speed: 1,
    social: 1,
    gesture: 0,
    previousGesture: 0,
    arrived: false,
    arrivedTime: 0,
    progressTime: 0,
    bestDistance: Infinity,
  };
  // Traits are immutable after construction and vary independently within small bounds.
  const traits = {
    initiative: 0.8 + random(b) * 0.4,
    restPreference: 0.7 + random(b) * 0.6,
    curiosity: 0.6 + random(b) * 0.8,
    recovery: (0.8 + random(b) * 0.4) * (1.1 - (temperament - 0.8) * 0.5),
  };
  const result = { ...b, ...traits };
  result.duration = cruiseDuration(result, species);
  return result;
}
function begin(
  fish: FishEntity,
  activity: FishActivity,
  duration: number,
): void {
  const b = fish.behavior;
  b.activity = activity;
  b.elapsed = 0;
  b.duration = duration;
  b.arrived = false;
  b.arrivedTime = 0;
  b.progressTime = 0;
  b.bestDistance = Infinity;
}
function cruise(fish: FishEntity): void {
  const b = fish.behavior;
  begin(fish, 'cruising', cruiseDuration(b, fish.species));
}
function distanceToTarget(fish: FishEntity): number {
  const t = fish.behavior.target,
    p = fish.position;
  return Math.hypot(t.x - p.x, t.y - p.y, t.z - p.z);
}
/** Bounded nearby selection; no scene traversal or raycasting. Surface offsets include the body. */
export function selectBehaviorTarget(
  fish: FishEntity,
  habitat: FishHabitat,
  foraging: boolean,
): boolean {
  const b = fish.behavior,
    points = habitat.interests;
  const maxDistance = foraging ? 4.5 : 6;
  if (points?.length)
    for (let attempt = 0; attempt < 24; attempt++) {
      const point = points[Math.floor(random(b) * points.length)];
      if (
        foraging &&
        point.kind === 'open-water' &&
        fish.species.id !== 'neon-tetra'
      )
        continue;
      const angle = random(b) * Math.PI * 2,
        offset = fish.radius + 0.45;
      b.target.x =
        point.position.x + point.normal.x * offset + Math.cos(angle) * 0.35;
      b.target.y = point.position.y + point.normal.y * offset;
      b.target.z =
        point.position.z + point.normal.z * offset + Math.sin(angle) * 0.35;
      const distance = distanceToTarget(fish);
      if (distance < 0.6 || distance > maxDistance) continue;
      if (
        safeFishPosition(b.target, fish.radius + 0.15, habitat) &&
        clearFishRoute(fish.position, b.target, fish.radius + 0.08, habitat)
      )
        return true;
    }
  if (foraging) return false;
  // Open-water exploration remains useful in a habitat without interest metadata.
  for (let attempt = 0; attempt < 8; attempt++) {
    const angle = random(b) * Math.PI * 2,
      distance = 1.5 + random(b) * 2.5;
    b.target.x = fish.position.x + Math.cos(angle) * distance;
    b.target.y = fish.position.y + (random(b) - 0.5) * 1.8;
    b.target.z = fish.position.z + Math.sin(angle) * distance;
    if (
      safeFishPosition(b.target, fish.radius + 0.15, habitat) &&
      clearFishRoute(fish.position, b.target, fish.radius + 0.08, habitat)
    )
      return true;
  }
  return false;
}
/** Curiosity eligibility only; all threat strength continues to come from FishDiverReaction. */
export function canObserveDiver(
  fish: FishEntity,
  player?: PlayerPresence,
): boolean {
  const b = fish.behavior;
  if (
    !player?.active ||
    b.cooldown > 0 ||
    fish.reaction.awareness > 0.02 ||
    fish.reaction.scatter > 0.01
  )
    return false;
  const speed = Math.hypot(
    player.velocity.x,
    player.velocity.y,
    player.velocity.z,
  );
  const gap =
    Math.hypot(
      fish.position.x - player.position.x,
      fish.position.y - player.position.y,
      fish.position.z - player.position.z,
    ) -
    fish.radius -
    COLLISION.playerRadius;
  return (
    speed < 0.35 &&
    gap > fish.species.diver.awarenessRadius + 0.6 &&
    gap < fish.species.diver.awarenessRadius + 4
  );
}
function schedule(
  fish: FishEntity,
  habitat: FishHabitat,
  player?: PlayerPresence,
): void {
  const b = fish.behavior,
    c = fish.species.behavior,
    w = c.weights;
  const explore = w[0],
    rest = w[1] * b.restPreference,
    forage = w[2],
    observe = canObserveDiver(fish, player) ? w[3] * b.curiosity : 0;
  const draw = random(b) * (explore + rest + forage + observe);
  const activity: FishActivity =
    draw < explore
      ? 'exploring'
      : draw < explore + rest
        ? 'resting'
        : draw < explore + rest + forage
          ? 'foraging'
          : 'observing';
  if (activity === 'exploring' || activity === 'foraging') {
    if (!selectBehaviorTarget(fish, habitat, activity === 'foraging')) {
      cruise(fish);
      return;
    }
  } else Object.assign(b.target, fish.position);
  begin(
    fish,
    activity,
    activity === 'resting'
      ? range(b, c.restDuration)
      : activity === 'observing'
        ? 5 + random(b) * 3
        : range(b, c.duration),
  );
  if (activity === 'observing') b.cooldown = 35 + random(b) * 25;
}
/** Select intentions only. Locomotion, body state, neighbors and safety remain owned by stepFish. */
export function updateFishBehavior(
  fish: FishEntity,
  habitat: FishHabitat,
  dt: number,
  player?: PlayerPresence,
): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  const b = fish.behavior,
    c = fish.species.behavior;
  b.previousGesture = b.gesture;
  b.elapsed += dt;
  b.cooldown = Math.max(0, b.cooldown - dt);
  const disturbed =
    fish.reaction.scatter > 0.08 || fish.reaction.awareness > 0.35;
  const observationInterrupted =
    b.activity === 'observing' &&
    (!player?.active ||
      fish.reaction.awareness > 0.025 ||
      !canRemainObserving(fish, player));
  if ((disturbed || observationInterrupted) && b.activity !== 'recovering') {
    begin(fish, 'recovering', c.recoverySeconds * b.recovery);
    b.cooldown = Math.max(b.cooldown, b.duration + 25);
  }
  if (b.activity === 'recovering') {
    if (disturbed) b.elapsed = 0;
    else if (b.elapsed >= b.duration) cruise(fish);
  } else if (b.elapsed >= b.duration) {
    if (b.activity === 'cruising') schedule(fish, habitat, player);
    else cruise(fish);
  }
  let speed = 1,
    social = 1,
    weight = 0,
    gesture = 0;
  if (b.activity === 'resting' || b.activity === 'observing') {
    speed = c.restSpeed;
    weight = 1;
    social = c.socialRetention;
  } else if (b.activity === 'exploring' || b.activity === 'foraging') {
    const distance = distanceToTarget(fish);
    weight = 1;
    speed = 0.9;
    social = c.socialRetention;
    if (!safeFishPosition(b.target, fish.radius + 0.1, habitat)) {
      cruise(fish);
      weight = 0;
      speed = 1;
      social = 1;
    } else {
      if (distance < 0.9) b.arrived = true;
      if (b.arrived) {
        b.arrivedTime += dt;
        speed = b.activity === 'foraging' ? c.restSpeed : 0.5;
        // Two restrained inspection dips, then quiet hovering; never a perpetual pecking loop.
        if (b.activity === 'foraging' && b.arrivedTime < 4)
          gesture = -0.07 * Math.sin((Math.PI * b.arrivedTime) / 2) ** 2;
        if (b.arrivedTime > (b.activity === 'foraging' ? 5 : 2)) cruise(fish);
      } else {
        b.progressTime += dt;
        if (distance < b.bestDistance - 0.15) {
          b.bestDistance = distance;
          b.progressTime = 0;
        }
        if (b.progressTime > 6) {
          cruise(fish);
          weight = 0;
          speed = 1;
          social = 1;
        }
      }
    }
  }
  // Optional activities fade out before they can compete with diver avoidance.
  weight *=
    1 - clamp01(fish.reaction.awareness * 3 + fish.reaction.scatter * 4);
  if (b.activity === 'cruising' || b.activity === 'recovering') {
    weight = 0;
    speed = 1;
    social = 1;
    gesture = 0;
  }
  const blend = -Math.expm1(-1.8 * dt);
  b.weight += (weight - b.weight) * blend;
  b.speed += (speed - b.speed) * blend;
  b.social += (social - b.social) * blend;
  b.gesture += (gesture - b.gesture) * blend;
}
function canRemainObserving(fish: FishEntity, player: PlayerPresence): boolean {
  const gap =
    Math.hypot(
      fish.position.x - player.position.x,
      fish.position.y - player.position.y,
      fish.position.z - player.position.z,
    ) -
    fish.radius -
    COLLISION.playerRadius;
  return (
    Math.hypot(player.velocity.x, player.velocity.y, player.velocity.z) < 0.5 &&
    gap > fish.species.diver.awarenessRadius + 0.2 &&
    gap < fish.species.diver.awarenessRadius + 5
  );
}
