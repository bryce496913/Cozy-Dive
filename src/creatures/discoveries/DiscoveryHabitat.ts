import * as THREE from 'three';
import type { CreatureAnchor } from '../CreatureAnchor';
import type { ConvexCollider } from '../../player/collision';
import {
  safeFishPosition,
  clearFishRoute,
  type FishHabitat,
} from '../../fish/FishHabitat';
import { SPAWN, type Vec3 } from '../../config/world';
export interface DiscoveryClearance extends Vec3 {
  readonly clearance?: number;
}
export interface DiscoverySurfaceGroup {
  readonly id: string;
  readonly colliders: readonly ConvexCollider[];
}
export interface DiscoveryHome extends CreatureAnchor {
  readonly view: Readonly<Vec3>;
  readonly focus: Readonly<Vec3>;
  readonly approach: readonly Readonly<Vec3>[];
  readonly channelOccluded: boolean;
}
export interface SurfaceHome extends DiscoveryHome {
  readonly support: ConvexCollider;
  readonly planeIndex: number;
  readonly rotation: THREE.Quaternion;
}
/** Default eye height of a discovery view above its focus. */
export const DISCOVERY_VIEW_LIFT = 0.55;
/**
 * Frogfish view: a higher eye than other discoveries (first needed beside the Pass 013 wreck
 * hulls; since Pass 019 it looks down onto the frogfish's rock-top perch).
 */
export const FROGFISH_VIEW_LIFT = 0.9;
export const FROGFISH_VIEW_DISTANCE = 1.3;
/** A clear camera/body location with an explicit, swept, three-leg route from spawn. Initialization only. */
export function discoveryView(
  center: Readonly<Vec3>,
  normal: Readonly<Vec3>,
  h: FishHabitat,
  distance = 1.25,
  lift = DISCOVERY_VIEW_LIFT,
): { view: Vec3; focus: Vec3; approach: readonly Vec3[] } | undefined {
  const sky = { x: SPAWN.x, y: 11, z: SPAWN.z };
  for (const d of [distance, distance + 0.35])
    for (const angle of [0.8, 0, -0.8, 1.6, -1.6, 2.4, -2.4, Math.PI]) {
      const sideX = Math.cos(angle),
        sideZ = Math.sin(angle);
      const view = {
        x: center.x + sideX * d + normal.x * 0.4,
        y: center.y + lift + Math.max(0, normal.y) * 0.35,
        z: center.z + sideZ * d + normal.z * 0.4,
      };
      const above = { x: view.x, y: 11, z: view.z };
      if (
        !safeFishPosition(view, 0.65, h) ||
        !clearFishRoute(view, center, 0.015, h)
      )
        continue;
      if (
        !clearFishRoute(SPAWN, sky, 0.65, h) ||
        !clearFishRoute(sky, above, 0.65, h) ||
        !clearFishRoute(above, view, 0.65, h)
      )
        continue;
      return {
        view,
        focus: { ...center },
        approach: [{ ...SPAWN }, sky, above, view],
      };
    }
}
export function occludedFromChannel(
  center: Readonly<Vec3>,
  h: FishHabitat,
): boolean {
  return !clearFishRoute({ x: 0, y: center.y, z: center.z }, center, 0.005, h);
}
/** Real convex face patches; fixed local tangent paths never need a runtime raycast. */
export function surfaceHome(
  id: string,
  groups: readonly DiscoverySurfaceGroup[],
  h: FishHabitat,
  halfWidth: number,
  halfLength: number,
  height: number,
  used: readonly DiscoveryClearance[] = [],
  /** Smallest upward component of an accepted support face (1 = level ground). */
  minUp = 0.45,
): SurfaceHome {
  const circular = id.startsWith('nudibranch'),
    count = circular ? 16 : 4,
    footprintX: number[] = [],
    footprintZ: number[] = [];
  for (let sample = 0; sample < count; sample++) {
    const angle = (sample * Math.PI) / 8;
    footprintX.push(
      circular
        ? Math.cos(angle) * halfWidth
        : sample % 2
          ? halfWidth
          : -halfWidth,
    );
    footprintZ.push(
      circular
        ? Math.sin(angle) * halfLength
        : sample < 2
          ? -halfLength
          : halfLength,
    );
  }
  const n = new THREE.Vector3(),
    u = new THREE.Vector3(),
    v = new THREE.Vector3(),
    p = new THREE.Vector3(),
    probe = new THREE.Vector3();
  for (const group of groups)
    for (let index = 0; index < group.colliders.length; index++) {
      const support = group.colliders[index],
        center = new THREE.Vector3(
          (support.min.x + support.max.x) / 2,
          (support.min.y + support.max.y) / 2,
          (support.min.z + support.max.z) / 2,
        );
      for (
        let planeIndex = 0;
        planeIndex < support.planes.length;
        planeIndex++
      ) {
        const plane = support.planes[planeIndex];
        if (plane.y < minUp) continue;
        n.set(plane.x, plane.y, plane.z);
        u.set(1, 0, 0).addScaledVector(n, -n.x).normalize();
        v.crossVectors(u, n).normalize();
        const origin = center
          .clone()
          .addScaledVector(n, plane.offset - n.dot(center));
        for (const dx of [0, -0.25, 0.25, -0.5, 0.5])
          for (const dz of [0, 0.35, -0.35, 0.7, -0.7]) {
            p.copy(origin).addScaledVector(u, dx).addScaledVector(v, dz);
            if (
              Math.abs(p.x) < 4 ||
              p.y < 0.15 ||
              p.y > 8 ||
              used.some(
                (q) =>
                  Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) <
                  (q.clearance ?? 0.68),
              )
            )
              continue;
            let valid = true;
            // A circular crawler envelope includes every heading; larger perch animals use their rectangular foot envelope.
            for (let sample = 0; sample < count; sample++) {
              probe
                .copy(p)
                .addScaledVector(u, footprintX[sample])
                .addScaledVector(v, footprintZ[sample]);
              if (
                support.planes.some(
                  (f) =>
                    f.x * probe.x + f.y * probe.y + f.z * probe.z >
                    f.offset + 1e-5,
                )
              ) {
                valid = false;
                break;
              }
            }
            if (!valid) continue;
            // Conservative local volume samples protect tissue from adjacent structural components.
            const nearby = h.rocks.filter(
              (r) =>
                r !== support &&
                r.max.x > p.x - 1 &&
                r.min.x < p.x + 1 &&
                r.max.y > p.y - 0.1 &&
                r.min.y < p.y + height + 1 &&
                r.max.z > p.z - 1 &&
                r.min.z < p.z + 1,
            );
            const localHabitat = { bounds: h.bounds, rocks: nearby };
            volume: for (const x of [-halfWidth, 0, halfWidth])
              for (const z of [-halfLength, 0, halfLength])
                for (const y of [0.007, height * 0.5, height]) {
                  probe
                    .copy(p)
                    .addScaledVector(u, x)
                    .addScaledVector(v, z)
                    .addScaledVector(n, y);
                  if (!safeFishPosition(probe, 0.002, localHabitat)) {
                    valid = false;
                    break volume;
                  }
                }
            if (!valid) continue;
            const target = p.clone().addScaledVector(n, height * 0.5 + 0.03),
              frogfish = id === 'frogfish',
              view = frogfish
                ? discoveryView(
                    target,
                    n,
                    h,
                    FROGFISH_VIEW_DISTANCE,
                    FROGFISH_VIEW_LIFT,
                  )
                : discoveryView(target, n, h, 0.9);
            if (!view) continue;
            const rotation = new THREE.Quaternion().setFromRotationMatrix(
              new THREE.Matrix4().makeBasis(u, n, v),
            );
            const position = p.clone().addScaledVector(n, 0.006);
            return {
              id,
              sourceId: `${group.id}/${index}/${planeIndex}`,
              position: { x: position.x, y: position.y, z: position.z },
              orientation: { x: n.x, y: n.y, z: n.z },
              homeRadius: Math.max(halfWidth, halfLength),
              habitatKind: 'reef-face',
              support,
              planeIndex,
              rotation,
              ...view,
              channelOccluded: occludedFromChannel(target, h),
            };
          }
      }
    }
  throw new Error(`No safely viewable surface patch for ${id}`);
}

/**
 * Height of a convex hull's upper surface above (x, z) and the index of the face supplying it,
 * or undefined when the vertical line misses the hull.
 */
export function hullTop(
  hull: ConvexCollider,
  x: number,
  z: number,
): { y: number; planeIndex: number } | undefined {
  let top = Infinity,
    bottom = -Infinity,
    planeIndex = -1;
  for (let i = 0; i < hull.planes.length; i++) {
    const p = hull.planes[i],
      rest = p.offset - p.x * x - p.z * z;
    if (Math.abs(p.y) < 1e-6) {
      if (rest < 0) return undefined;
    } else if (p.y > 0) {
      if (rest / p.y < top) {
        top = rest / p.y;
        planeIndex = i;
      }
    } else bottom = Math.max(bottom, rest / p.y);
  }
  return top > bottom && planeIndex >= 0 ? { y: top, planeIndex } : undefined;
}

/**
 * Pass 019: a level perch on the top of a reef rock for a still, rock-coloured animal. Rock tops
 * are rounded hulls made of small faces, so the footprint is tested against the sampled top height
 * (within `tolerance`) rather than a single face. The animal faces the open channel.
 */
export function rockTopHome(
  id: string,
  rocks: readonly ConvexCollider[],
  h: FishHabitat,
  halfWidth: number,
  halfLength: number,
  height: number,
  minUp: number,
  view: { distance: number; lift: number },
  tolerance = 0.035,
): SurfaceHome {
  const ordered = rocks
    .map((rock, index) => ({ rock, index }))
    .filter(({ rock }) => rock.max.y > 1 && rock.max.y < 6)
    .sort(
      (a, b) =>
        Math.abs((a.rock.min.x + a.rock.max.x) / 2) -
          Math.abs((b.rock.min.x + b.rock.max.x) / 2) || a.index - b.index,
    );
  const n = new THREE.Vector3(),
    u = new THREE.Vector3(),
    v = new THREE.Vector3(),
    probe = new THREE.Vector3();
  for (const { rock: support, index } of ordered) {
    const cx = (support.min.x + support.max.x) / 2,
      cz = (support.min.z + support.max.z) / 2;
    for (const dx of [0, -0.3, 0.3, -0.6, 0.6, -0.9, 0.9])
      for (const dz of [0, -0.3, 0.3, -0.6, 0.6, -0.9, 0.9]) {
        const x = cx + dx,
          z = cz + dz;
        if (Math.abs(x) < 4) continue;
        const top = hullTop(support, x, z);
        if (!top || top.y < 0.15 || top.y > 8) continue;
        const plane = support.planes[top.planeIndex];
        if (plane.y < minUp) continue;
        n.set(plane.x, plane.y, plane.z);
        // Face the open channel (x = 0), within the support face.
        v.set(-Math.sign(x), 0, 0).addScaledVector(n, n.x * Math.sign(x));
        v.normalize();
        u.crossVectors(n, v).normalize();
        let level = true;
        for (const [sx, sz] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ] as const) {
          probe
            .set(x, top.y, z)
            .addScaledVector(u, sx * halfWidth)
            .addScaledVector(v, sz * halfLength);
          const corner = hullTop(support, probe.x, probe.z);
          if (!corner || Math.abs(corner.y - probe.y) > tolerance) {
            level = false;
            break;
          }
        }
        if (!level) continue;
        const p = new THREE.Vector3(x, top.y, z);
        const nearby = h.rocks.filter(
          (r) =>
            r !== support &&
            r.max.x > x - 1 &&
            r.min.x < x + 1 &&
            r.max.y > top.y - 0.1 &&
            r.min.y < top.y + height + 1 &&
            r.max.z > z - 1 &&
            r.min.z < z + 1,
        );
        let clear = true;
        for (const sx of [-halfWidth, 0, halfWidth])
          for (const sz of [-halfLength, 0, halfLength])
            for (const y of [tolerance + 0.007, height * 0.5, height]) {
              probe
                .copy(p)
                .addScaledVector(u, sx)
                .addScaledVector(v, sz)
                .addScaledVector(n, y);
              if (
                !safeFishPosition(probe, 0.002, {
                  bounds: h.bounds,
                  rocks: nearby,
                })
              )
                clear = false;
            }
        if (!clear) continue;
        const target = p.clone().addScaledVector(n, height * 0.5 + 0.03),
          seen = discoveryView(target, n, h, view.distance, view.lift);
        if (!seen) continue;
        const position = p.clone().addScaledVector(n, 0.006);
        return {
          id,
          sourceId: `reef/${index}/${top.planeIndex}`,
          position: { x: position.x, y: position.y, z: position.z },
          orientation: { x: n.x, y: n.y, z: n.z },
          homeRadius: Math.max(halfWidth, halfLength),
          habitatKind: 'reef-face',
          support,
          planeIndex: top.planeIndex,
          rotation: new THREE.Quaternion().setFromRotationMatrix(
            new THREE.Matrix4().makeBasis(u, n, v),
          ),
          ...seen,
          channelOccluded: occludedFromChannel(target, h),
        };
      }
  }
  throw new Error(`No level, viewable rock top for ${id}`);
}
