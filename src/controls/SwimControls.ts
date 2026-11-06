import type { SwimInput } from '../player/swimming';

const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
export function isSwimMovementKey(code: string): boolean {
  return MOVEMENT_KEYS.has(code);
}
export function inputFromKeys(keys: ReadonlySet<string>, out: SwimInput): void {
  out.forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
  out.right = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
}
const PITCH_LIMIT = Math.PI / 2 - 0.08;
export class SwimControls {
  yaw = 0;
  pitch = -0.06;
  private targetYaw = 0;
  private targetPitch = -0.06;
  private keys = new Set<string>();
  private readonly abort = new AbortController();
  readonly input: SwimInput = { forward: 0, right: 0 };
  sensitivity = 1;
  reducedMotion = false;
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onLock: (locked: boolean) => void,
  ) {
    const options = { signal: this.abort.signal };
    document.addEventListener('keydown', this.keyDown, options);
    document.addEventListener('keyup', this.keyUp, options);
    document.addEventListener('mousemove', this.mouseMove, options);
    document.addEventListener('pointerlockchange', this.lockChange, options);
    window.addEventListener('blur', this.blur, options);
  }
  get locked(): boolean {
    return document.pointerLockElement === this.canvas;
  }
  private keyDown = (event: KeyboardEvent): void => {
    if (this.locked && event.code === 'Escape') {
      document.exitPointerLock();
      return;
    }
    if (!this.locked || !isSwimMovementKey(event.code)) return;
    event.preventDefault();
    this.keys.add(event.code);
  };
  private keyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };
  private mouseMove = (event: MouseEvent): void => {
    if (!this.locked) return;
    // Mouse events already represent displacement; multiplying by dt would cause FPS-dependent look.
    this.targetYaw -= event.movementX * 0.0016 * this.sensitivity;
    this.targetPitch = Math.max(
      -PITCH_LIMIT,
      Math.min(
        PITCH_LIMIT,
        this.targetPitch - event.movementY * 0.0016 * this.sensitivity,
      ),
    );
  };
  private lockChange = (): void => {
    this.clear();
    this.onLock(this.locked);
  };
  private blur = (): void => {
    this.clear();
    if (this.locked) document.exitPointerLock();
  };
  clear(): void {
    this.keys.clear();
    this.input.forward = this.input.right = 0;
    this.targetYaw = this.yaw;
    this.targetPitch = this.pitch;
  }
  update(dt: number): void {
    const blend = this.reducedMotion ? 1 : -Math.expm1(-22 * dt);
    this.yaw += (this.targetYaw - this.yaw) * blend;
    this.pitch += (this.targetPitch - this.pitch) * blend;
    inputFromKeys(this.keys, this.input);
  }
  dispose(): void {
    this.abort.abort();
    this.clear();
    if (this.locked) document.exitPointerLock();
  }
}
