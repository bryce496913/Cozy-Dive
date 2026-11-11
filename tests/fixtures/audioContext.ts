import { vi } from 'vitest';

/** Minimal Web Audio contract with observable resource ownership and automation. */
export class FakeParam {
  value = 0;
  readonly targets: number[] = [];
  setTargetAtTime = vi.fn((value: number, time: number, tau: number) => {
    if (![value, time, tau].every(Number.isFinite) || tau <= 0)
      throw new Error('Invalid automation');
    this.targets.push(value);
    this.value = value;
    return this;
  });
  setValueAtTime = vi.fn((value: number) => {
    this.value = value;
    return this;
  });
  linearRampToValueAtTime = vi.fn((value: number) => {
    this.value = value;
    return this;
  });
  exponentialRampToValueAtTime = vi.fn((value: number) => {
    this.value = value;
    return this;
  });
  cancelScheduledValues = vi.fn(() => this);
  setValueCurveAtTime = vi.fn((values: Float32Array) => {
    if (![...values].every(Number.isFinite)) throw new Error('Invalid curve');
    this.value = values[values.length - 1];
    return this;
  });
}
export class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  Q = new FakeParam();
  pan = new FakeParam();
  playbackRate = new FakeParam();
  buffer?: AudioBuffer;
  loop = false;
  type = 'lowpass';
  onended: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  disconnect = vi.fn();
  connect = vi.fn((destination: FakeNode) => destination);
}
export class FakeContext {
  readonly sampleRate = 48000;
  state: AudioContextState = 'suspended';
  currentTime = 0;
  readonly destination = new FakeNode();
  readonly nodes: FakeNode[] = [];
  readonly buffers: Float32Array[] = [];
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  suspend = vi.fn(async () => {
    this.state = 'suspended';
  });
  close = vi.fn(async () => {
    this.state = 'closed';
  });
  private node(): FakeNode {
    const n = new FakeNode();
    this.nodes.push(n);
    return n;
  }
  createGain = vi.fn(() => this.node());
  createBufferSource = vi.fn(() => this.node());
  createOscillator = vi.fn(() => this.node());
  createBiquadFilter = vi.fn(() => this.node());
  createStereoPanner = vi.fn(() => this.node());
  createBuffer = vi.fn(
    (_channels: number, length: number, sampleRate: number) => {
      const data = new Float32Array(length);
      this.buffers.push(data);
      return {
        length,
        sampleRate,
        getChannelData: () => data,
        copyToChannel: (values: Float32Array) => data.set(values),
      };
    },
  );
  // The mock deliberately implements only the graph's Web Audio surface, not a browser renderer.
  get api(): AudioContext {
    return this as unknown as AudioContext;
  }
}
