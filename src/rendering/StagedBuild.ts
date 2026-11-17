/**
 * v0.6 Pass 047: building a world a piece at a time. A world's environment, kelp, dressing and so
 * on each take tens to a hundred milliseconds or more to generate; built together in one frame
 * they stall the swimmer for several hundred milliseconds as they near a passage. Built one piece
 * per frame (`Staging.step`), each frame carries only one piece. The time each piece took is kept
 * (`BuildStats`) so the cost can be measured, and building stops early if the world is no longer
 * wanted.
 */
export interface BuildStats {
  /** Milliseconds each piece took to build, by name, and the longest of them. */
  readonly pieces: Record<string, number>;
  longest: number;
  total: number;
}
/** Wait for the next frame (or, without one, the next turn of the event loop). */
export type FrameWait = () => Promise<void>;
export const nextFrame: FrameWait = () =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function')
      requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
/** Builds right away, without waiting (the synchronous default). */
export const noWait: FrameWait = () => Promise.resolve();

export class Staging {
  readonly stats: BuildStats = { pieces: {}, longest: 0, total: 0 };
  private readonly built: { dispose(): void }[] = [];
  constructor(
    private readonly frame: FrameWait,
    private readonly wanted: () => boolean,
  ) {}
  /**
   * Wait a frame, then build one piece and time it. Throws `Staging.cancelled` (disposing every
   * piece built so far) if the world is no longer wanted.
   */
  async step<T extends { dispose(): void }>(
    name: string,
    make: () => T,
  ): Promise<T> {
    await this.frame();
    if (!this.wanted()) this.cancel();
    const t0 = performance.now(),
      piece = make(),
      ms = performance.now() - t0;
    this.built.push(piece);
    this.stats.pieces[name] = ms;
    this.stats.longest = Math.max(this.stats.longest, ms);
    this.stats.total += ms;
    return piece;
  }
  /** Built synchronously (for a plain value without disposal). */
  async value<T>(name: string, make: () => T): Promise<T> {
    await this.frame();
    if (!this.wanted()) this.cancel();
    const t0 = performance.now(),
      v = make(),
      ms = performance.now() - t0;
    this.stats.pieces[name] = ms;
    this.stats.longest = Math.max(this.stats.longest, ms);
    this.stats.total += ms;
    return v;
  }
  private cancel(): never {
    for (const b of this.built.splice(0)) b.dispose();
    throw Staging.cancelled;
  }
  /** The world was let go while it was being built. */
  static readonly cancelled = new Error('World build cancelled');
}
