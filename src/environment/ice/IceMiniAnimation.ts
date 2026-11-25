import type { Mesh } from 'three';
/** Same anatomical poses for wild, album and aquarium; no motion when time is frozen. */
export function animateIceMini(mesh: Mesh, time: number): void {
  const k = mesh.morphTargetDictionary,
    w = mesh.morphTargetInfluences;
  if (!k || !w) return;
  const rate =
    mesh.name === 'Clione_Antarctica'
      ? 1.4
      : mesh.name === 'Glyptonotus_Antarcticus'
        ? 0.65
        : 0.3;
  const stroke = Math.sin(time * rate) * 0.65;
  if (k.Stroke_Left !== undefined) w[k.Stroke_Left] = Math.max(0, stroke);
  if (k.Stroke_Right !== undefined) w[k.Stroke_Right] = Math.max(0, -stroke);
}
