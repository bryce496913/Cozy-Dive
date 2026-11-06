import type { Vec3 } from '../config/world';
/** Reference current/bending functions match the material's small vertex hook. Outputs are reused. */
export function sampleCurrent(
  time: number,
  x: number,
  z: number,
  out: Vec3,
): Vec3 {
  out.x =
    Math.sin(time * 0.23 + x * 0.09 + z * 0.06) * 0.7 +
    Math.sin(time * 0.13 - z * 0.07) * 0.3;
  out.y = 0;
  out.z = Math.cos(time * 0.19 + z * 0.08 - x * 0.05) * 0.65;
  return out;
}
export function samplePlantBend(
  time: number,
  x: number,
  z: number,
  phase: number,
  frequency: number,
  flex: number,
  out: Vec3,
): Vec3 {
  sampleCurrent(time, x, z, out);
  out.x = (out.x + Math.sin(time * frequency + phase) * 0.22) * flex;
  out.z = (out.z + Math.cos(time * frequency * 0.83 + phase) * 0.18) * flex;
  return out;
}
export class PlantClock {
  time = 0;
  rate = 1;
  update(dt: number, active: boolean, reducedMotion: boolean): void {
    if (!active || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    const target = reducedMotion ? 0 : 1,
      decay = Math.exp(-3 * dt);
    // Integrate the rate ramp analytically: toggles stop/start motion without resetting its pose.
    this.time += target * dt + ((this.rate - target) * (1 - decay)) / 3;
    this.rate = target + (this.rate - target) * decay;
    if (reducedMotion && this.rate < 1e-6) this.rate = 0;
  }
}
export const PLANT_VERTEX_GLSL = `
uniform float plantTime;
attribute vec4 plantMotion;
vec2 plantFlow() {
 vec3 origin=instanceMatrix[3].xyz;
 vec2 flow=vec2(sin(plantTime*.23+origin.x*.09+origin.z*.06)*.7+sin(plantTime*.13-origin.z*.07)*.3,
 cos(plantTime*.19+origin.z*.08-origin.x*.05)*.65);
 flow+=vec2(sin(plantTime*plantMotion.w+plantMotion.y)*.22,cos(plantTime*plantMotion.w*.83+plantMotion.y)*.18);
 vec3 ax=normalize(instanceMatrix[0].xyz),az=normalize(instanceMatrix[2].xyz);
 return vec2(dot(vec3(flow.x,0.,flow.y),ax),dot(vec3(flow.x,0.,flow.y),az));
}
`;
