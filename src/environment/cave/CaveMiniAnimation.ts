import * as THREE from 'three';
/** Deterministic cycles, never rare random spawning. Stargazer eyes remain above sand at rest. */
export function caveBurrow(kind: string, time: number): number {
  const p = time % 90;
  if (kind === 'Stargazer')
    return p < 68 ? 1 : 1 - Math.sin(((p - 68) / 22) * Math.PI) ** 2;
  if (kind === 'Wonderpus')
    return p < 70 ? 0 : Math.sin(((p - 70) / 20) * Math.PI) ** 2;
  return 0;
}
export function caveStep(time: number): number {
  const p = time % 50;
  return p < 40 ? 0 : Math.sin(((p - 40) / 10) * Math.PI) ** 2;
}
/** Same anatomical rigs in the habitat, card and tank; presentation leaves burial unweighted. */
export function animateCaveMini(
  mesh: THREE.Mesh,
  time: number,
  habitat = false,
): void {
  const k = mesh.morphTargetDictionary,
    w = mesh.morphTargetInfluences;
  if (!k || !w) return;
  const stroke =
    0.4 * Math.sin(time * (mesh.name === 'Banded_Coral_Shrimp' ? 0.55 : 0.45));
  if (k.Stroke_Left !== undefined) w[k.Stroke_Left] = Math.max(0, stroke);
  if (k.Stroke_Right !== undefined) w[k.Stroke_Right] = Math.max(0, -stroke);
  if (k.Burrow !== undefined)
    w[k.Burrow] = habitat ? caveBurrow(mesh.name, time) : 0;
  if (k.Shift !== undefined) w[k.Shift] = 1 - caveBurrow('Stargazer', time);
  if (k.Step !== undefined) w[k.Step] = caveStep(time);
  if (k.Hop !== undefined) w[k.Hop] = Math.sin(caveStep(time) * Math.PI);
  if (k.Explore !== undefined) w[k.Explore] = 0.5 - 0.5 * Math.cos(time * 0.06);
}
