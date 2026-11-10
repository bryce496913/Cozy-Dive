import * as THREE from 'three';
import type { ConvexCollider } from '../player/collision';
import { safeFishPosition, type FishHabitat } from '../fish/FishHabitat';
import { discoveryView } from './discoveries/DiscoveryHabitat';
import { MORAY_DEN } from './MorayBehavior';
import type { Vec3 } from '../config/world';

/** A hole in a large reef rock: the mouth on the rock's surface and the outward axis. */
export interface MorayDen {
  readonly support: ConvexCollider;
  readonly supportIndex: number;
  /** Where the hole meets the rock's collision surface. */
  readonly mouth: THREE.Vector3;
  /** Horizontal unit direction out of the rock. */
  readonly axis: THREE.Vector3;
  /** A clear viewing position for the head, with its approach from spawn. */
  readonly view: Vec3;
  readonly focus: Vec3;
  readonly approach: readonly Vec3[];
}

/** Distance along `dir` from `origin` (inside) to where the ray leaves `hull`. */
export function hullExit(
  hull: ConvexCollider,
  origin: THREE.Vector3,
  dir: THREE.Vector3,
): number {
  let t = Infinity;
  for (const p of hull.planes) {
    const along = p.x * dir.x + p.y * dir.y + p.z * dir.z;
    if (along > 1e-9)
      t = Math.min(
        t,
        (p.offset - (p.x * origin.x + p.y * origin.y + p.z * origin.z)) / along,
      );
  }
  return t;
}

/** Signed clearance of a point inside a hull (negative when outside). */
export function hullDepth(hull: ConvexCollider, p: THREE.Vector3): number {
  let depth = Infinity;
  for (const plane of hull.planes)
    depth = Math.min(
      depth,
      plane.offset - (plane.x * p.x + plane.y * p.y + plane.z * p.z),
    );
  return depth;
}

/**
 * Pass 019: choose the moray's den deterministically. The rock must be large enough to hide the
 * whole body along the hole (with margin for the visible stone sitting inside the hull), the
 * mouth must be well above the sand on a side facing the open channel, the exposed head must be
 * clear of every other solid, and the head must be viewable from a reachable position.
 */
export function findMorayDen(
  h: FishHabitat,
  supports: readonly ConvexCollider[],
): MorayDen {
  const candidates: (MorayDen & { score: number })[] = [];
  const center = new THREE.Vector3(),
    axis = new THREE.Vector3(),
    p = new THREE.Vector3();
  supports.forEach((support, supportIndex) => {
    const sx = support.max.x - support.min.x,
      sy = support.max.y - support.min.y,
      sz = support.max.z - support.min.z;
    if (Math.min(sx, sz) < 2 || sy < 1.6) return;
    const cx = (support.min.x + support.max.x) / 2,
      cz = (support.min.z + support.max.z) / 2,
      sand = h.substrateHeight?.(cx, cz) ?? 0,
      y = Math.min(support.max.y - 0.8, Math.max(support.min.y, sand) + 1.05);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      axis.set(Math.cos(a), 0, Math.sin(a));
      center.set(cx, y, cz);
      if (hullDepth(support, center) < 0.5) continue;
      const exit = hullExit(support, center, axis);
      if (!Number.isFinite(exit)) continue;
      const mouth = center.clone().addScaledVector(axis, exit);
      const ground = h.substrateHeight?.(mouth.x, mouth.z) ?? 0;
      if (mouth.y - ground < 0.75 || Math.abs(mouth.x) < 3.5) continue;
      // The whole body, from just inside the pit to the tail, stays deep inside the rock.
      let hidden = true;
      for (
        let d = MORAY_DEN.depth - 0.2;
        d <= MORAY_DEN.length - MORAY_DEN.headIn + 0.15;
        d += 0.1
      ) {
        p.copy(mouth).addScaledVector(axis, -d);
        if (hullDepth(support, p) < 0.3) hidden = false;
      }
      if (!hidden) continue;
      // The emerged head is clear of every solid, its own rock included once outside the mouth.
      const others = h.rocks.filter((r) => r !== support);
      let clear = true;
      for (let z = 0.1; z <= MORAY_DEN.headOut + 0.3; z += 0.05) {
        p.copy(mouth).addScaledVector(axis, z);
        if (
          !safeFishPosition(p, 0.24, { bounds: h.bounds, rocks: others }) ||
          (z >= 0.25 &&
            !safeFishPosition(p, 0.1, { bounds: h.bounds, rocks: [support] }))
        )
          clear = false;
      }
      if (!clear) continue;
      const focus = mouth.clone().addScaledVector(axis, MORAY_DEN.headOut);
      const seen = discoveryView(focus, axis, h, 1.8);
      if (!seen) continue;
      // Prefer a mouth facing the open channel at a comfortable height.
      const score =
        -axis.x * Math.sign(mouth.x) - Math.abs(mouth.y - 1.4) * 0.3;
      candidates.push({
        support,
        supportIndex,
        mouth,
        axis: axis.clone(),
        ...seen,
        score,
      });
    }
  });
  if (!candidates.length)
    throw new Error('No reef rock can host the moray den.');
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return {
    support: best.support,
    supportIndex: best.supportIndex,
    mouth: best.mouth,
    axis: best.axis,
    view: best.view,
    focus: best.focus,
    approach: best.approach,
  };
}
