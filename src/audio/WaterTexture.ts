import { AUDIO } from './AudioTuning';

/** Baked, seeded liquid texture: a quiet colored bed and short, damped cavity resonances.
 * Resonances live for milliseconds, not sustained tones; no oscillators or new runtime voices.
 */
export function waterTexture(
  length: number,
  seed: number,
  detail = false,
): Float32Array<ArrayBuffer> {
  const samples = new Float32Array(length);
  const random = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < length; i++) samples[i] = random() * 2 - 1;
  let body = 0,
    dc = 0;
  const color = (value: number): number => {
    body += (value - body) * 0.12;
    dc += (body - dc) * 0.006;
    return body - dc;
  };
  // Warm from the end of the same circular noise bed before writing its start.
  for (let i = Math.max(0, length - 4096); i < length; i++) color(samples[i]);
  for (let i = 0; i < length; i++)
    samples[i] = color(samples[i]) * (detail ? 0.015 : 0.08);
  const seconds = length / AUDIO.sampleRate;
  let at = detail ? 0.16 : random() * 0.3;
  while (at < seconds) {
    const frequency = (detail ? 280 : 190) + random() * (detail ? 240 : 260);
    const decay = 0.018 + random() * 0.026;
    const duration = decay * 7;
    const amplitude = 0.06 + random() * (detail ? 0.1 : 0.065);
    const start = Math.floor(at * AUDIO.sampleRate);
    const count = Math.ceil(duration * AUDIO.sampleRate);
    for (let j = 0; j < count; j++) {
      const t = j / AUDIO.sampleRate;
      const attack = 1 - Math.exp(-t / 0.008);
      const tail = 1 - j / count;
      // A small falling cavity frequency, mixed partial and low-level noise excitation.
      const phase = 2 * Math.PI * frequency * (t - (0.045 * t * t) / duration);
      const liquid =
        Math.sin(phase) +
        0.24 * Math.sin(phase * 1.71) +
        0.22 * (random() * 2 - 1);
      const envelope = attack * Math.exp(-t / decay) * tail * tail;
      const index = start + j;
      if (detail && index >= length) break;
      samples[index % length] += amplitude * envelope * liquid;
    }
    at += detail ? 0.24 + random() * 0.36 : 0.12 + random() * 0.38;
  }
  // Global scaling, never clipping/compression: retain individual soft envelopes and mix headroom.
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  const scale = peak > 0 ? (detail ? 0.65 : 0.7) / peak : 1;
  for (let i = 0; i < length; i++) samples[i] *= scale;
  return samples;
}
