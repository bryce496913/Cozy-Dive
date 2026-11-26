import * as THREE from 'three';
import type { FishHabitat } from '../../fish/FishHabitat';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import {
  FROGFISH_VIEW_DISTANCE,
  FROGFISH_VIEW_LIFT,
  rockTopHome,
  surfaceHome,
  type SurfaceHome,
  type DiscoverySurfaceGroup,
} from './DiscoveryHabitat';
import { anchoredFishGeometry } from '../../fish/lowPoly/anchored';
import { lowPolyMaterial } from '../../rendering/lowPoly/resources';
const PERCHES = [
  [-0.06, -0.03],
  [0.06, -0.03],
  [0.06, 0.07],
  [-0.06, 0.07],
] as const;
export interface FrogfishMotion {
  x: number;
  z: number;
  walking: boolean;
  stride: number;
}
export function frogfishStep(time: number, out: FrogfishMotion): void {
  const cycle = Math.floor(time / 112),
    phase = time % 112,
    from = PERCHES[cycle % 4],
    to = PERCHES[(cycle + 1) % 4],
    t = Math.max(0, Math.min(1, (phase - 104) / 8)),
    ease = t * t * (3 - 2 * t);
  out.x = from[0] + (to[0] - from[0]) * ease;
  out.z = from[1] + (to[1] - from[1]) * ease;
  out.walking = phase >= 104;
  out.stride = t;
}
/** Lower-jaw hinge in body-local units: the axis (parallel to X) the mouth opens about. */
export const FROGFISH_JAW_HINGE = { x: 0, y: 0.31, z: 0.16 } as const;
/** Base of the illicium (fishing rod) on the snout, in body-local units. */
export const FROGFISH_LURE_BASE = { x: 0, y: 0.455, z: 0.275 } as const;
/** Gentle respiratory gulping: a slow, rhythmic part-opening of the mouth. */
export const FROGFISH_GULP = { period: 3.2, gape: 0.11 } as const;
/** Occasional wide yawn: once per cycle, open, hold briefly, then close slowly. */
export const FROGFISH_YAWN = {
  period: 19,
  start: 11,
  open: 0.8,
  hold: 0.7,
  close: 1.3,
  gape: 0.42,
} as const;
const smooth = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};
/**
 * Lower-jaw rotation (radians, positive opens) at a motion time in seconds. Continuous and
 * periodic: rhythmic gulps that blend into an occasional yawn.
 */
export function frogfishGape(time: number): number {
  const gulp =
    FROGFISH_GULP.gape *
    (0.5 - 0.5 * Math.cos((time / FROGFISH_GULP.period) * Math.PI * 2)) ** 1.5;
  const y = FROGFISH_YAWN,
    phase = (((time - y.start) % y.period) + y.period) % y.period,
    yawn =
      phase < y.open
        ? smooth(phase / y.open)
        : phase < y.open + y.hold
          ? 1
          : 1 - smooth((phase - y.open - y.hold) / y.close);
  return gulp + (y.gape - gulp) * Math.max(0, yawn);
}
/**
 * Pass 019 playtest: the frogfish is half its former modelled size and perches on the top of a
 * reef rock, where its mottled skin blends in, rather than in the shipwreck. Geometry keeps its
 * local units; the root carries the scale.
 */
export const FROGFISH_SCALE = 0.5;
/** Rock tops only: the support face must be within about 32 degrees of level. */
export const FROGFISH_MIN_UP = 0.85;
/** Still, warty, limb-finned perch animal with rare small walking steps and a breathing, yawning mouth. */
export class Frogfish {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly leftFoot: THREE.Mesh;
  readonly rightFoot: THREE.Mesh;
  readonly lure = new THREE.Group();
  /** Lower-jaw pivot at FROGFISH_JAW_HINGE; the authored FrogJaw attaches here. */
  readonly jaw = new THREE.Group();
  readonly material = lowPolyMaterial({ role: 'body', vertexColors: true });
  readonly geometries: readonly THREE.BufferGeometry[];
  readonly home: SurfaceHome;
  walking = false;
  awareness = 0;
  /** How far the visible rock surface lies below the hull-top perch (set once assets load). */
  private drop = 0;
  private readonly offset = new THREE.Vector3();
  private readonly step: FrogfishMotion = {
    x: 0,
    z: 0,
    walking: false,
    stride: 0,
  };
  private disposed = false;
  constructor(h: FishHabitat, groups: readonly DiscoverySurfaceGroup[]) {
    this.root.name = 'Hidden frogfish';
    this.root.scale.setScalar(FROGFISH_SCALE);
    const bodyGeometry = anchoredFishGeometry('FrogBody'),
      footGeometry = anchoredFishGeometry('FrogFoot'),
      lureGeometry = anchoredFishGeometry('FrogLure'),
      jawGeometry = anchoredFishGeometry('FrogJaw');
    this.body.add(new THREE.Mesh(bodyGeometry, this.material));
    this.jaw.position.set(
      FROGFISH_JAW_HINGE.x,
      FROGFISH_JAW_HINGE.y,
      FROGFISH_JAW_HINGE.z,
    );
    this.jaw.add(new THREE.Mesh(jawGeometry, this.material));
    this.body.add(this.jaw);
    this.root.add(this.body);
    this.leftFoot = new THREE.Mesh(footGeometry, this.material);
    this.rightFoot = new THREE.Mesh(footGeometry, this.material);
    this.rightFoot.scale.x = -1;
    this.root.add(this.leftFoot, this.rightFoot);
    this.lure.position.set(
      FROGFISH_LURE_BASE.x,
      FROGFISH_LURE_BASE.y,
      FROGFISH_LURE_BASE.z,
    );
    this.lure.add(new THREE.Mesh(lureGeometry, this.material));
    this.body.add(this.lure);
    this.geometries = [bodyGeometry, footGeometry, lureGeometry, jawGeometry];
    try {
      const k = FROGFISH_SCALE,
        reef = groups.find((g) => g.id === 'reef');
      let home: SurfaceHome | undefined;
      if (reef)
        try {
          home = rockTopHome(
            'frogfish',
            reef.colliders,
            h,
            0.53 * k,
            0.56 * k,
            0.78 * k,
            FROGFISH_MIN_UP,
            {
              distance: FROGFISH_VIEW_DISTANCE,
              lift: FROGFISH_VIEW_LIFT,
            },
          );
        } catch {
          home = undefined;
        }
      // Without a usable rock top, fall back to any level structural surface.
      this.home =
        home ??
        surfaceHome(
          'frogfish',
          groups.filter((g) => g.id !== 'reef'),
          h,
          0.53 * k,
          0.56 * k,
          0.78 * k,
          [],
          FROGFISH_MIN_UP,
        );
    } catch (error) {
      this.dispose();
      throw error;
    }
    this.pose(0);
  }
  respond(dt: number, player?: PlayerPresence): void {
    const p = this.home.position,
      near =
        player?.active &&
        Math.hypot(
          player.position.x - p.x,
          player.position.y - p.y - 0.3 * FROGFISH_SCALE,
          player.position.z - p.z,
        ) < 1
          ? 1
          : 0;
    this.awareness += (near - this.awareness) * -Math.expm1(-0.8 * dt);
  }
  pose(time: number): void {
    if (this.disposed) return;
    const phase = this.step;
    frogfishStep(time, phase);
    this.walking = phase.walking;
    this.offset.set(phase.x, 0, phase.z).multiplyScalar(FROGFISH_SCALE);
    this.offset.y = -this.drop;
    this.root.position
      .copy(this.offset)
      .applyQuaternion(this.home.rotation)
      .add(this.home.position);
    this.root.quaternion.copy(this.home.rotation);
    this.root.rotateY(Math.sin(time * 0.023) * 0.035 + this.awareness * 0.04);
    this.body.scale.y = 1 + Math.sin(time * 0.8) * 0.007;
    this.lure.rotation.z = Math.sin(time * 0.27) * 0.045;
    this.jaw.rotation.x = frogfishGape(time);
    this.leftFoot.position.y = this.walking
      ? Math.max(0, Math.sin(phase.stride * Math.PI * 4)) * 0.018
      : 0;
    this.rightFoot.position.y = this.walking
      ? Math.max(0, -Math.sin(phase.stride * Math.PI * 4)) * 0.018
      : 0;
  }
  /**
   * Seat the perch on the visible surface: authored rocks are carved slightly inside their
   * collision hulls, so the hull-top home can sit a little above the stone. Bounded to 0-0.25.
   */
  settle(drop: number): void {
    this.drop = Number.isFinite(drop) ? Math.min(0.25, Math.max(0, drop)) : 0;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    this.geometries?.forEach((g) => g.dispose());
    this.material.dispose();
  }
}
