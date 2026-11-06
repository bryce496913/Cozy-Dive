import { SWIM_FEELS } from '../config/world';
import type { Vec3 } from '../config/world';
import {
  strokeEnvelope,
  type SwimState,
  type SwimTuning,
} from '../player/swimming';

export const AUDIO = {
  sampleRate: 16000,
  bufferSeconds: [11.3, 17.9, 2.8] as const,
  masterCeiling: 0.8,
  swimmingCeiling: 0.14,
  eventCeiling: 0.1,
  fadeOut: 0.06,
  suspendDelay: 420,
  maxVoices: 1,
  eventInterval: [28, 65] as const,
  firstEvent: [22, 42] as const,
  resumeQuiet: 12,
};
export const unit = (n: number): number =>
  Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
export const volumeGain = (volume: number): number =>
  AUDIO.masterCeiling * unit(volume) ** 1.35;
export interface AmbientMix {
  foundation: number;
  cutoff: number;
  current: number;
  currentCutoff: number;
  pan: number;
}
/** Slow, small, independently phased changes; there is no audible oscillator. */
export function ambientMix(time: number, out: AmbientMix): AmbientMix {
  const t = Number.isFinite(time) ? time : 0;
  out.foundation =
    0.24 + 0.009 * Math.sin(t * 0.031) + 0.006 * Math.sin(t * 0.047 + 1.4);
  out.cutoff = 340 + 25 * Math.sin(t * 0.023 + 0.7);
  out.current =
    0.018 + 0.004 * Math.sin(t * 0.041 + 2) + 0.002 * Math.sin(t * 0.019);
  out.currentCutoff = 260 + 20 * Math.sin(t * 0.029 + 2.4);
  out.pan = 0.04 * Math.sin(t * 0.017);
  return out;
}
/** Reads the actual physical stroke, thrust and 3D velocity, never advances their clocks. */
export function swimmingGain(
  state: Readonly<SwimState>,
  tuning: Readonly<SwimTuning>,
): number {
  const feel = SWIM_FEELS[tuning.feel];
  const velocity = Math.hypot(
    state.velocity.x,
    state.moving || state.depthChanging ? state.velocity.y : 0,
    state.velocity.z,
  );
  const speed = unit(velocity / 4);
  if (!state.moving) return AUDIO.swimmingCeiling * 0.12 * speed;
  const stroke = strokeEnvelope(state.strokeTime / feel.cycle, feel.active);
  const thrust = unit(
    Math.hypot(state.thrust.x, state.thrust.y, state.thrust.z) /
      (Math.max(1, tuning.speed) * feel.drag * 3),
  );
  return (
    AUDIO.swimmingCeiling *
    Math.sqrt(speed) *
    (0.22 + 0.5 * stroke + 0.28 * thrust)
  );
}
export interface SpatialMix {
  pan: number;
  gain: number;
}
/** Mild stereo only. Camera right is (cos(yaw), 0, -sin(yaw)); mono remains valid. */
export function spatialMix(
  source: Readonly<Vec3>,
  listener: Readonly<Vec3>,
  yaw: number,
  out: SpatialMix,
): SpatialMix {
  const x = source.x - listener.x,
    y = source.y - listener.y,
    z = source.z - listener.z;
  const distance = Math.hypot(x, y, z);
  out.pan =
    distance > 0
      ? Math.max(
          -0.4,
          Math.min(
            0.4,
            (0.4 * (x * Math.cos(yaw) - z * Math.sin(yaw))) / distance,
          ),
        )
      : 0;
  const edge = unit((30 - distance) / 12);
  out.gain =
    (edge * edge * (3 - 2 * edge)) / (1 + Math.max(0, distance - 2) / 10);
  return out;
}
