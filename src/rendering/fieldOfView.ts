import type * as THREE from 'three';

/**
 * v0.6 Pass 057 (motion comfort): the player's field-of-view preference, as degrees added to each
 * camera's own designed field of view (the office 66°, the waters 64°). A wider view helps many
 * people who feel motion sick in first person. Applied only when it changes, so it costs nothing
 * per frame once set.
 */
export const FIELD_OF_VIEW = { min: -8, max: 16, step: 1, default: 0 } as const;
const base = new WeakMap<THREE.PerspectiveCamera, number>();
export function applyFieldOfView(
  camera: THREE.PerspectiveCamera,
  offset: number,
): void {
  let designed = base.get(camera);
  if (designed === undefined) {
    designed = camera.fov;
    base.set(camera, designed);
  }
  const fov = designed + offset;
  if (camera.fov === fov) return;
  camera.fov = fov;
  camera.updateProjectionMatrix();
}
