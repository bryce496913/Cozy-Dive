import type { PlayerPresence } from '../fish/FishDiverReaction';
import { randomFish, type FishEntity } from '../fish/FishEntity';
import { clearFishRoute, type FishHabitat } from '../fish/FishHabitat';
/** Host-associated intentions only: existing locomotion, separation and solid safety still own movement. */
export function updateHostBehavior(
  f: FishEntity,
  h: FishHabitat,
  dt: number,
  player?: PlayerPresence,
): void {
  const home = f.host!,
    b = f.behavior;
  b.previousGesture = b.gesture;
  b.elapsed += dt;
  const disturbed = f.reaction.awareness > 0.3 || f.reaction.scatter > 0.08;
  if (disturbed) {
    b.activity = 'recovering';
    b.elapsed = 0;
    b.duration = 4;
    // Retreat within the host region, including when the diver enters the crown itself.
    let dx = home.position.x - (player?.position.x ?? home.position.x - 1),
      dy = home.position.y - (player?.position.y ?? home.position.y),
      dz = home.position.z - (player?.position.z ?? home.position.z);
    let d = Math.hypot(dx, dy, dz);
    if (d < 0.1) {
      dx = f.position.x - home.position.x;
      dy = 0.1;
      dz = f.position.z - home.position.z;
      d = Math.max(0.1, Math.hypot(dx, dy, dz));
    }
    const radius = Math.max(0.35, Math.min(1.6, 2.4 - d)),
      side = f.id % 2 ? -0.28 : 0.28;
    b.target.x = home.position.x + (dx / d) * radius + (dz / d) * side;
    b.target.y = home.position.y + (dy / d) * radius;
    b.target.z = home.position.z + (dz / d) * radius - (dx / d) * side;
  } else if (b.elapsed >= b.duration || b.duration > 20) {
    b.elapsed = 0;
    b.duration = 5 + randomFish(f) * 8;
    b.activity = randomFish(f) < 0.6 ? 'resting' : 'exploring';
    for (let attempt = 0; attempt < 16; attempt++) {
      const angle = randomFish(f) * Math.PI * 2,
        r = 0.3 + randomFish(f) * (b.activity === 'resting' ? 0.55 : 1.3);
      b.target.x = home.position.x + Math.cos(angle) * r;
      b.target.y = home.position.y + (randomFish(f) - 0.35) * 0.7;
      b.target.z = home.position.z + Math.sin(angle) * r;
      if (clearFishRoute(f.position, b.target, f.radius + 0.08, h)) break;
      b.target.x = home.position.x;
      b.target.y = home.position.y;
      b.target.z = home.position.z;
    }
  }
  const near =
    Math.hypot(
      b.target.x - f.position.x,
      b.target.y - f.position.y,
      b.target.z - f.position.z,
    ) < 0.45;
  b.arrived = near;
  const blend = -Math.expm1(-2 * dt);
  b.weight += (1 - b.weight) * blend;
  b.speed += ((near ? 0.1 : disturbed ? 0.8 : 0.65) - b.speed) * blend;
  b.social += (1 - b.social) * blend;
  b.gesture += (0 - b.gesture) * blend;
}
