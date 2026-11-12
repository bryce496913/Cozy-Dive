import type * as THREE from 'three';
import type { Bounds, Vec3 } from '../config/world';
import type { PlayerPresence } from '../fish/FishDiverReaction';
import type { CollisionWorld } from '../player/collision';
import type { WaterWorldId } from '../player/passage';
import type { SightCandidate } from '../discovery/journal';

/**
 * v0.4 Pass 023: one swimmable world. The tank and the outer waters both provide this; the
 * application swims, renders and looks for sightings in whichever one the player is in, and only
 * that one renders.
 */
export interface WaterWorld {
  readonly id: WaterWorldId;
  readonly bounds: Bounds;
  readonly collision: CollisionWorld;
  readonly camera: THREE.PerspectiveCamera;
  /** Things that can be seen here for the first time (none in the tank itself). */
  readonly sightings: readonly SightCandidate[];
  /**
   * Pass 026: soft limits, if any. Scales down the outward part of the swimming direction `dir`
   * (in place) near the world's edges, so the swimmer slows to a hover instead of meeting a wall.
   */
  ease?(p: Vec3, dir: Vec3): Vec3;
  render(
    time: number,
    reducedMotion: boolean,
    dt: number,
    active: boolean,
    player: PlayerPresence,
  ): void;
}
