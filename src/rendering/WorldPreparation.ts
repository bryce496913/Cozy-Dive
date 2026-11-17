/**
 * v0.6 Pass 047: how far a water world has got in preparing itself, and which of its parts are
 * usable. A world is `loading` until its preparation settles, then `ready` (every part loaded),
 * `partial` (it can be swum in, but some parts failed and are left out), or `failed` (its
 * preparation itself failed; it is still a place to swim, without its life). Once disposed it is
 * `disposed` for good, and nothing that finishes loading later changes it.
 */
export type PreparationState =
  'loading' | 'ready' | 'partial' | 'failed' | 'disposed';
export type PartState = 'loading' | 'ready' | 'failed';

export class WorldPreparation {
  private current: PreparationState = 'loading';
  private readonly parts = new Map<string, PartState>();

  get state(): PreparationState {
    return this.current;
  }
  get disposed(): boolean {
    return this.current === 'disposed';
  }
  /** Each part's state, by name (for diagnostics and harnesses). */
  get summary(): Readonly<Record<string, PartState>> {
    return Object.fromEntries(this.parts);
  }
  /** Whether a named part loaded (and the world is not disposed). */
  has(name: string): boolean {
    return !this.disposed && this.parts.get(name) === 'ready';
  }
  /**
   * Follow a part's loading: it is `ready` if `ready` resolves true, `failed` if it resolves false
   * or rejects. Resolves to whether it loaded and the world is still wanted.
   */
  track(name: string, ready: Promise<boolean>): Promise<boolean> {
    this.parts.set(name, 'loading');
    return ready.then(
      (ok) => this.mark(name, ok),
      () => this.mark(name, false),
    );
  }
  private mark(name: string, ok: boolean): boolean {
    if (this.disposed) return false;
    this.parts.set(name, ok ? 'ready' : 'failed');
    return ok;
  }
  /** Preparation finished: ready, or partial if any part failed. */
  settle(): void {
    if (this.disposed) return;
    const states = [...this.parts.values()];
    this.current = states.every((s) => s === 'ready') ? 'ready' : 'partial';
  }
  /** Preparation itself failed (the world is still swimmable, without its life). */
  fail(): void {
    if (!this.disposed) this.current = 'failed';
  }
  dispose(): void {
    this.current = 'disposed';
  }
}
