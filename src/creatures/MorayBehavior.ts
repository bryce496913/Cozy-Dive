export type MorayState =
  'hidden' | 'peeking' | 'resting' | 'emerging' | 'retreating';
const sequence: readonly MorayState[] = [
  'hidden',
  'peeking',
  'resting',
  'emerging',
  'retreating',
];
const targets: Record<MorayState, number> = {
  hidden: 0,
  peeking: 0.6,
  resting: 0.8,
  emerging: 1,
  retreating: 0,
};
/** Localized active-time behavior; no locomotion engine, scene traversal or pursuit. */
export class MorayBehavior {
  state: MorayState = 'hidden';
  elapsed = 0;
  duration = 16;
  extension = 0;
  time = 0;
  retreats = 0;
  private seed = 90217;
  private next(): void {
    this.state = sequence[(sequence.indexOf(this.state) + 1) % sequence.length];
    this.elapsed = 0;
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    const r = this.seed / 4294967296;
    this.duration =
      this.state === 'hidden'
        ? 14 + r * 12
        : this.state === 'resting'
          ? 20 + r * 14
          : this.state === 'peeking'
            ? 5 + r * 4
            : this.state === 'emerging'
              ? 5 + r * 3
              : 7 + r * 3;
  }
  update(dt: number, active: boolean, nearby: boolean): void {
    if (!active || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.elapsed += dt;
    if (nearby) {
      if (this.state !== 'retreating' && this.state !== 'hidden') {
        this.state = 'retreating';
        this.elapsed = 0;
        this.duration = 8;
        this.retreats++;
      }
      if (this.state === 'hidden') this.elapsed = 0;
    }
    if (this.elapsed >= this.duration && !nearby) this.next();
    if (this.state === 'retreating' && this.extension < 0.01 && nearby) {
      this.state = 'hidden';
      this.elapsed = 0;
    }
    const target = nearby ? 0 : targets[this.state];
    // Analytic damping gives gradual emergence/retreat and no pose jump at state changes.
    this.extension +=
      (target - this.extension) *
      -Math.expm1(-(target < this.extension ? 1.1 : 0.65) * dt);
  }
}
/** Matches the GPU deformation; body unfolds gently from a tucked S inside its shelter. */
export function morayCenter(
  t: number,
  extension: number,
  phase: number,
  out: { x: number; y: number; z: number },
): void {
  out.x =
    (0.3 - 0.09 * extension) *
    Math.sin(t * Math.PI * 2 + Math.sin(phase * 0.45) * 0.15) *
    Math.sin(Math.PI * t);
  out.y = 0.055 * Math.sin(Math.PI * t) * Math.sin(t * 5 + phase * 0.35);
  out.z = -1.25 + (1.6 + 1.5 * extension) * t;
}
export const MORAY_GLSL = `
uniform float morayExtension;
uniform float morayPhase;
attribute float morayT;
vec3 morayCenter(float t){return vec3((.30-.09*morayExtension)*sin(t*6.2831853+sin(morayPhase*.45)*.15)*sin(3.14159265*t),.055*sin(3.14159265*t)*sin(t*5.+morayPhase*.35),-1.25+(1.6+1.5*morayExtension)*t);}
`;
