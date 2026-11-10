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
/**
 * Pass 019 playtest: the moray lives in a hole in a large reef rock. Its local frame sits on the
 * hole's mouth with +z pointing out of the rock. The body lies straight along the hole, hidden
 * inside the stone; only the head (and at most a short neck) comes out. `extension` 0 has the
 * head pulled back inside the hole, 1 has it resting out in the open.
 */
export const MORAY_DEN = {
  /** Hole radius and depth carved into the rock's visible surface. */
  radius: 0.3,
  depth: 0.8,
  /** Body length along the hole. */
  length: 1.3,
  /** Head-centre z when fully retreated and when fully out. */
  headIn: -0.4,
  headOut: 0.3,
  /** Small sideways sway of the exposed head and neck. */
  sway: 0.025,
} as const;
/** Matches the GPU deformation: a straight body along the hole with a gently swaying head. */
export function morayCenter(
  t: number,
  extension: number,
  phase: number,
  out: { x: number; y: number; z: number },
): void {
  const head =
    MORAY_DEN.headIn + (MORAY_DEN.headOut - MORAY_DEN.headIn) * extension;
  out.x = MORAY_DEN.sway * Math.sin(phase * 0.5 + t * 3) * t * t * t;
  out.y = 0.012 * Math.sin(phase * 0.35 + t * 5) * t * t;
  out.z = head - MORAY_DEN.length * (1 - t);
}
export const MORAY_GLSL = `
uniform float morayExtension;
uniform float morayPhase;
attribute float morayT;
vec3 morayCenter(float t){float head=${MORAY_DEN.headIn.toFixed(4)}+${(MORAY_DEN.headOut - MORAY_DEN.headIn).toFixed(4)}*morayExtension;return vec3(${MORAY_DEN.sway.toFixed(4)}*sin(morayPhase*.5+t*3.)*t*t*t,.012*sin(morayPhase*.35+t*5.)*t*t,head-${MORAY_DEN.length.toFixed(4)}*(1.-t));}
`;
