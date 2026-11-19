import type { Mesh } from 'three';
/** Shared authored stroke for adult and miniature models, with no geometry copies. */
export function creatureStroke(
  mesh: Mesh,
  keys: { readonly left: number; readonly right: number },
  effort: number,
): void {
  const w = mesh.morphTargetInfluences;
  if (!w) return;
  w[keys.left] = Math.max(0, effort);
  w[keys.right] = Math.max(0, -effort);
}
