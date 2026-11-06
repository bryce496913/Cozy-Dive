import { nextFishRandom, type FishEntity } from './FishEntity';
export interface FishBurst {
  randomState: number;
  remaining: number;
  elapsed: number;
  duration: number;
  strength: number;
}
export function createFishBurst(seed: number): FishBurst {
  return {
    randomState: seed ^ 0x510e527f,
    remaining: 3 + ((seed >>> 0) / 4294967296) * 9,
    elapsed: 0,
    duration: 0,
    strength: 0,
  };
}
/** Species-only short force/speed intention. Never changes position, heading or the behavior state. */
export function updateFishBurst(f: FishEntity, dt: number): void {
  const b = f.burst,
    c = f.species.burst;
  if (!c) return;
  b.strength = 0;
  if (
    f.reaction.scatter > 0.05 ||
    !(f.behavior.activity === 'cruising' || f.behavior.activity === 'exploring')
  ) {
    b.elapsed = 0;
    b.duration = 0;
    b.remaining = Math.max(2, b.remaining);
    return;
  }
  if (b.duration > 0) {
    b.elapsed += dt;
    if (b.elapsed < b.duration) {
      b.strength = Math.sin((Math.PI * b.elapsed) / b.duration) ** 2;
      return;
    }
    b.duration = 0;
    b.elapsed = 0;
  }
  b.remaining -= dt;
  if (b.remaining > 0) return;
  b.randomState = nextFishRandom(b.randomState);
  b.duration =
    c.duration[0] +
    (b.randomState / 4294967296) * (c.duration[1] - c.duration[0]);
  b.randomState = nextFishRandom(b.randomState);
  b.remaining =
    c.interval[0] +
    (b.randomState / 4294967296) * (c.interval[1] - c.interval[0]);
  b.elapsed = 0;
}
