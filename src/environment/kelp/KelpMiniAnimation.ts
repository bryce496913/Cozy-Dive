import * as THREE from 'three';

/** One pose vocabulary for the wild animal, album and aquarium. Time zero is reduced motion. */
export function kelpMiniMouth(time: number): number {
  const phase = time % 31;
  return phase < 26 ? 0 : Math.sin(((phase - 26) / 5) * Math.PI) ** 2;
}
/** Rest in shelter for 70 s, then make a gentle 20 s excursion and return. */
export function kelpMiniExplore(time: number): number {
  const phase = time % 90;
  return phase < 70 ? 0 : Math.sin(((phase - 70) / 20) * Math.PI) ** 2;
}
export function animateKelpMini(mesh: THREE.Mesh, time: number): void {
  const k = mesh.morphTargetDictionary,
    w = mesh.morphTargetInfluences;
  if (!k || !w) return;
  const rate = mesh.name === 'Weedy_Seadragon' ? 4 : 0.65;
  const stroke = 0.35 * Math.sin(time * rate);
  if (k.Stroke_Left !== undefined) w[k.Stroke_Left] = Math.max(0, stroke);
  if (k.Stroke_Right !== undefined) w[k.Stroke_Right] = Math.max(0, -stroke);
  if (k.Mouth_Open !== undefined) w[k.Mouth_Open] = kelpMiniMouth(time);
  if (k.Camouflage !== undefined) {
    const camo = Math.sin(time * 0.09) ** 2;
    w[k.Camouflage] = camo;
    if (Array.isArray(mesh.material)) {
      for (const m of mesh.material) tint(m, camo);
    } else tint(mesh.material, camo);
  }
}
function tint(m: THREE.Material, amount: number): void {
  if (m instanceof THREE.MeshStandardMaterial)
    m.color.setRGB(1 - amount * 0.18, 1 - amount * 0.1, 1 - amount * 0.15);
}
