import * as THREE from 'three';
import { safeFishPosition } from '../../fish/FishHabitat';
import { AQUARIUM, SPAWN } from '../../config/world';
import type { ConvexCollider } from '../../player/collision';
import { substrateHeight } from '../HabitatRegions';
import type { OrnamentKind, OrnamentModel } from './OrnamentGeometry';
const preferred: Record<OrnamentKind, readonly [number, number, number]> = {
  chest: [-5.1, 9.7, -0.25],
  filter: [16.95, -13.39, 0],
  arch: [-7, -7, 0.25],
  shipwreck: [-12, 8, 0.25],
  log: [8, 6, -0.3],
  statue: [12, -9, -0.2],
};
export const LOCAL_ANCHORS: Record<
  OrnamentKind,
  readonly [number, number, number]
> = {
  arch: [0, 1.35, 0],
  shipwreck: [0, 1.02, 1.08],
  log: [0, 1.28, 0],
  statue: [0, 1.1, -1.6],
  chest: [0, 1.1, 2.2],
  filter: [0, 0, 1.9],
};
/** Bounded deterministic bank search; reserve complete object envelopes, not just a root point. */
export function placeOrnament(
  model: OrnamentModel,
  existing: readonly ConvexCollider[],
  reserved: readonly THREE.Box3[],
): THREE.Box3 {
  const [px, pz, yaw] = preferred[model.kind];
  model.root.rotation.y = yaw;
  for (let attempt = 0; attempt < 1500; attempt++) {
    const x = attempt === 0 ? px : Math.sign(px) * (4.9 + (attempt % 15) * 0.7),
      z = attempt === 0 ? pz : -11.7 + (Math.floor(attempt / 15) % 35) * 0.7;
    model.root.position.set(x, model.kind === 'filter' ? 8 : 0, z);
    model.root.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(model.root);
    if (model.kind !== 'filter') {
      let floor = -Infinity;
      for (const sx of [box.min.x, x, box.max.x])
        for (const sz of [box.min.z, z, box.max.z])
          floor = Math.max(floor, substrateHeight(sx, sz));
      model.root.position.y = floor - box.min.y + 0.015;
      model.root.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(model.root);
    }
    if (model.kind === 'chest') box.max.y += 1.2;
    const anchor = new THREE.Vector3(...LOCAL_ANCHORS[model.kind]).applyMatrix4(
      model.root.matrixWorld,
    );
    if (!safeFishPosition(anchor, 0.7, { bounds: AQUARIUM, rocks: existing }))
      continue;
    const padded = box.clone().expandByScalar(0.22);
    padded.union(
      new THREE.Box3().setFromCenterAndSize(
        anchor,
        new THREE.Vector3(1.4, 1.4, 1.4),
      ),
    );
    const wallBox = model.kind === 'filter' ? box : padded;
    const wallMargin = model.kind === 'filter' ? 0.02 : 0.3;
    if (
      wallBox.min.x < AQUARIUM.min.x + wallMargin ||
      wallBox.max.x > AQUARIUM.max.x - wallMargin ||
      wallBox.min.z < AQUARIUM.min.z + wallMargin ||
      wallBox.max.z > AQUARIUM.max.z - wallMargin
    )
      continue;
    if (padded.min.x < 3.3 && padded.max.x > -3.3) continue;
    if (
      padded.distanceToPoint(new THREE.Vector3(SPAWN.x, SPAWN.y, SPAWN.z)) < 2
    )
      continue;
    if (reserved.some((b) => padded.intersectsBox(b))) continue;
    if (
      existing.some((r) =>
        padded.intersectsBox(
          new THREE.Box3(
            new THREE.Vector3(r.min.x, r.min.y, r.min.z),
            new THREE.Vector3(r.max.x, r.max.y, r.max.z),
          ),
        ),
      )
    )
      continue;
    return padded;
  }
  throw new Error(`No clear deterministic placement for ${model.kind}`);
}
