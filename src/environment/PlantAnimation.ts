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
  out.x =
    (out.x + Math.sin(time * frequency + phase + x * 1.7 + z * 2.1) * 0.22) *
    flex;
  out.z =
    (out.z +
      Math.cos(time * frequency * 0.83 + phase + x * 1.7 + z * 2.1) * 0.18) *
    flex;
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
 // V0.7 Pass 071: normalised height along the plant, recovered from the motion contract
 // (flex = h^2 sway, tilt = 2 h sway). Higher parts follow the current a moment later, so stems
 // and blades bend through the water with continuous curvature instead of tipping as one piece,
 // and each plant's gusts swell and ease on their own slow cycle (no synchronised swaying).
 float h=plantMotion.z>1e-5?2.*plantMotion.x/plantMotion.z:0.;
 float t=plantTime-h*1.4;
 float gust=.78+.22*sin(plantTime*.061+origin.x*.37+origin.z*.29);
 vec2 flow=vec2(sin(t*.23+origin.x*.09+origin.z*.06)*.7+sin(t*.13-origin.z*.07)*.3,
 cos(t*.19+origin.z*.08-origin.x*.05)*.65)*gust;
 flow+=vec2(sin(t*plantMotion.w+plantMotion.y+origin.x*1.7+origin.z*2.1)*.22,cos(t*plantMotion.w*.83+plantMotion.y+origin.x*1.7+origin.z*2.1)*.18);
 vec3 ax=normalize(instanceMatrix[0].xyz),az=normalize(instanceMatrix[2].xyz);
 return vec2(dot(vec3(flow.x,0.,flow.y),ax),dot(vec3(flow.x,0.,flow.y),az));
}
`;
