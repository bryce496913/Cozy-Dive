import * as THREE from 'three';

/** A minute-long cycle: rest, a short fin-controlled hop, rest at the next perch, return. */
export function wreckPerch(time: number): number {
  const p = time % 60;
  if (p < 35 || p >= 55) return 0;
  if (p < 40) return (1 - Math.cos(((p - 35) / 5) * Math.PI)) / 2;
  if (p < 50) return 1;
  return (1 + Math.cos(((p - 50) / 5) * Math.PI)) / 2;
}
export function wreckLift(time: number): number {
  const p = time % 60;
  return p >= 35 && p < 40
    ? Math.sin(((p - 35) / 5) * Math.PI)
    : p >= 50 && p < 55
      ? Math.sin(((p - 50) / 5) * Math.PI)
      : 0;
}
/** Shared canonical pose rig for habitat, collection cards and aquarium. No per-frame allocations. */
export function animateWreckMini(
  mesh: THREE.Mesh,
  time: number,
  retreat = 0,
): void {
  const keys = mesh.morphTargetDictionary,
    w = mesh.morphTargetInfluences;
  if (!keys || !w) return;
  const rate =
    mesh.name === 'Skeleton_Shrimp'
      ? 0.55
      : mesh.name === 'Juvenile_Wolf_Eel'
        ? 0.7
        : 0.4;
  const stroke = Math.sin(time * rate) * 0.45;
  if (keys.Stroke_Left !== undefined) w[keys.Stroke_Left] = Math.max(0, stroke);
  if (keys.Stroke_Right !== undefined)
    w[keys.Stroke_Right] = Math.max(0, -stroke);
  if (keys.Reposition !== undefined) {
    const p = time % 90;
    w[keys.Reposition] = p < 70 ? 0 : Math.sin(((p - 70) / 20) * Math.PI) ** 2;
  }
  if (keys.Retreat !== undefined) w[keys.Retreat] = retreat;
  if (keys.Perch !== undefined) w[keys.Perch] = wreckPerch(time);
  if (keys.Lift !== undefined) w[keys.Lift] = wreckLift(time);
}
