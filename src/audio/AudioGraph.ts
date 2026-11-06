import type { Vec3 } from '../config/world';
import type { WaterEvent } from './AudioEvents';
import { AUDIO, ambientMix, noiseSamples, spatialMix } from './AudioTuning';

/** All graph resources belong to one context; no entities or render resources are touched. */
export class AudioGraph {
  readonly master: GainNode;
  readonly buffers: readonly AudioBuffer[];
  private readonly nodes: AudioNode[] = [];
  private readonly loops: AudioBufferSourceNode[] = [];
  private readonly foundation: { gain: GainNode; filter: BiquadFilterNode };
  private readonly current: { gain: GainNode; filter: BiquadFilterNode };
  private readonly swim: { gain: GainNode; filter: BiquadFilterNode };
  private readonly currentPan: StereoPannerNode;
  private readonly eventFilter: BiquadFilterNode;
  private readonly eventGain: GainNode;
  private readonly eventPan: StereoPannerNode;
  private readonly eventDistance: GainNode;
  private voice?: AudioBufferSourceNode;
  private eventPosition?: Readonly<Vec3>;
  private readonly mix = {
    foundation: 0,
    cutoff: 640,
    current: 0,
    currentCutoff: 430,
    pan: 0,
  };
  private readonly spatial = { pan: 0, gain: 0 };
  private disposed = false;
  constructor(private readonly context: BaseAudioContext) {
    this.master = this.own(context.createGain());
    this.master.gain.value = 0;
    this.master.connect(context.destination);
    this.buffers = AUDIO.bufferSeconds.map((seconds, i) => {
      const buffer = context.createBuffer(
        1,
        Math.round(seconds * AUDIO.sampleRate),
        AUDIO.sampleRate,
      );
      buffer.copyToChannel(noiseSamples(buffer.length, 18573 + i * 7949), 0);
      return buffer;
    });
    this.currentPan = this.own(context.createStereoPanner());
    this.currentPan.connect(this.master);
    this.foundation = this.layer(this.buffers[0], 1, 75, 640, this.master);
    this.current = this.layer(this.buffers[1], 0.87, 110, 430, this.currentPan);
    this.swim = this.layer(this.buffers[1], 1.03, 120, 850, this.master);
    this.eventFilter = this.own(context.createBiquadFilter());
    this.eventGain = this.own(context.createGain());
    this.eventDistance = this.own(context.createGain());
    this.eventPan = this.own(context.createStereoPanner());
    this.eventGain.gain.value = 0;
    this.eventFilter
      .connect(this.eventGain)
      .connect(this.eventDistance)
      .connect(this.eventPan)
      .connect(this.master);
    this.update(0, 0, { x: 0, y: 0, z: 0 }, 0);
  }
  private own<T extends AudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }
  private layer(
    buffer: AudioBuffer,
    rate: number,
    high: number,
    low: number,
    output: AudioNode,
  ) {
    const source = this.own(this.context.createBufferSource()),
      hp = this.own(this.context.createBiquadFilter()),
      filter = this.own(this.context.createBiquadFilter()),
      gain = this.own(this.context.createGain());
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = rate;
    hp.type = 'highpass';
    hp.frequency.value = high;
    hp.Q.value = 0.5;
    filter.type = 'lowpass';
    filter.frequency.value = low;
    filter.Q.value = 0.5;
    gain.gain.value = 0;
    source.connect(hp).connect(filter).connect(gain).connect(output);
    this.loops.push(source);
    source.start();
    return { gain, filter };
  }
  fade(volume: number, tau: number): void {
    this.master.gain.setTargetAtTime(volume, this.context.currentTime, tau);
  }
  quietSwimming(): void {
    this.swim.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.06);
  }
  update(
    time: number,
    swimming: number,
    listener: Readonly<Vec3>,
    yaw: number,
  ): void {
    if (this.disposed) return;
    const now = this.context.currentTime,
      mix = ambientMix(time, this.mix);
    this.foundation.gain.gain.setTargetAtTime(mix.foundation, now, 0.8);
    this.foundation.filter.frequency.setTargetAtTime(mix.cutoff, now, 1.5);
    this.current.gain.gain.setTargetAtTime(mix.current, now, 1.5);
    this.current.filter.frequency.setTargetAtTime(mix.currentCutoff, now, 1.5);
    this.currentPan.pan.setTargetAtTime(mix.pan, now, 1.5);
    this.swim.gain.gain.setTargetAtTime(
      swimming,
      now,
      swimming > 0 ? 0.09 : 0.16,
    );
    if (this.eventPosition) {
      const s = spatialMix(this.eventPosition, listener, yaw, this.spatial);
      this.eventPan.pan.setTargetAtTime(s.pan, now, 0.25);
      this.eventDistance.gain.setTargetAtTime(s.gain, now, 0.25);
    }
  }
  get voices(): number {
    return this.voice ? 1 : 0;
  }
  play(
    event: WaterEvent,
    position: Readonly<Vec3>,
    listener: Readonly<Vec3>,
    yaw: number,
  ): void {
    if (this.voice || this.disposed) return;
    const now = this.context.currentTime,
      source = this.context.createBufferSource();
    source.buffer = this.buffers[event.kind === 'bubbles' ? 0 : 1];
    this.eventFilter.type = event.kind === 'bubbles' ? 'bandpass' : 'lowpass';
    this.eventFilter.Q.value = event.kind === 'bubbles' ? 0.9 : 0.5;
    this.eventFilter.frequency.cancelScheduledValues(now);
    this.eventFilter.frequency.setValueAtTime(
      event.kind === 'bubbles' ? 370 : 470,
      now,
    );
    this.eventFilter.frequency.linearRampToValueAtTime(
      event.kind === 'bubbles' ? 260 : 340,
      now + event.duration,
    );
    const s = spatialMix(position, listener, yaw, this.spatial);
    this.eventPan.pan.value = s.pan;
    this.eventDistance.gain.value = s.gain;
    // Two broad, soft noise lobes suggest a delicate bubble cluster, with no tonal chirp.
    const envelope = new Float32Array(96);
    for (let i = 0; i < envelope.length; i++) {
      const t = i / (envelope.length - 1);
      envelope[i] =
        AUDIO.eventCeiling *
        event.strength *
        Math.sin(Math.PI * t) ** 2 *
        (event.kind === 'bubbles'
          ? 0.65 + 0.35 * Math.cos(t * Math.PI * 4) ** 2
          : 1);
    }
    this.eventGain.gain.cancelScheduledValues(now);
    this.eventGain.gain.setValueCurveAtTime(envelope, now, event.duration);
    source.connect(this.eventFilter);
    this.voice = source;
    this.eventPosition = position;
    source.onended = () => {
      source.disconnect();
      if (this.voice === source) {
        this.voice = undefined;
        this.eventPosition = undefined;
      }
    };
    source.start(now, event.location % 5, event.duration);
  }
  stopEvent(): void {
    if (!this.voice) return;
    this.voice.onended = null;
    this.voice.stop();
    this.voice.disconnect();
    this.voice = undefined;
    this.eventPosition = undefined;
    this.eventGain.gain.cancelScheduledValues(this.context.currentTime);
    this.eventGain.gain.value = 0;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopEvent();
    for (const source of this.loops) source.stop();
    for (const node of this.nodes) node.disconnect();
  }
}
