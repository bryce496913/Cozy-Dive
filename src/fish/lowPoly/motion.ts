import type { Mesh } from 'three';

/** Existing controllers supply their own fin phase. Models without these optional poses are untouched. */
export function fishFinStroke(mesh: Mesh, effort: number): void {
  const keys = mesh.morphTargetDictionary,
    weights = mesh.morphTargetInfluences;
  if (
    !keys ||
    !weights ||
    keys.Fin_Left === undefined ||
    keys.Fin_Right === undefined
  )
    return;
  const bounded = Math.max(-1, Math.min(1, effort));
  weights[keys.Fin_Left] = Math.max(0, bounded);
  weights[keys.Fin_Right] = Math.max(0, -bounded);
}
