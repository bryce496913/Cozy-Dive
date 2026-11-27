import { fishFinStroke } from '../fish/lowPoly/motion';
import type { Mesh } from 'three';
/** Shared authored stroke for adult and miniature models, with no geometry copies. */
export function creatureStroke(
  mesh: Mesh,
  keys: { readonly left: number; readonly right: number },
  effort: number,
  fins = effort,
): void {
  const w = mesh.morphTargetInfluences;
  if (!w) return;
  fishFinStroke(mesh, fins);
  w[keys.left] = Math.max(0, effort);
  w[keys.right] = Math.max(0, -effort);
}
