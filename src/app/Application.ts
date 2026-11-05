import { AQUARIUM, SPAWN, SWIMMING } from '../config/world';
import { SwimControls } from '../controls/SwimControls';
import {
  integrateSwimming,
  movementDirection,
  createSwimState,
  resetSwimming,
  type SwimTuning,
} from '../player/swimming';
import { UnderwaterScene } from '../rendering/UnderwaterScene';
import { Interface } from '../ui/Interface';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
} from '../ui/settings';

export class Application {
  private readonly ui: Interface;
  private world?: UnderwaterScene;
  private controls?: SwimControls;
  private readonly state = createSwimState(SPAWN);
  private readonly direction = { x: 0, y: 0, z: 0 };
  private readonly tuning: SwimTuning = {
    speed: DEFAULT_SETTINGS.speed,
    feel: DEFAULT_SETTINGS.swimmingFeel,
    reducedMotion: DEFAULT_SETTINGS.reducedMotion,
  };
  private settings: Settings;
  private entered = false;
  private frame = 0;
  private previous = 0;
  private elapsed = 0;
  private disposed = false;
  private readonly abort = new AbortController();
  constructor(root: HTMLElement) {
    const prefersReduced = matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    try {
      this.settings = loadSettings(localStorage, prefersReduced);
    } catch {
      this.settings = { ...DEFAULT_SETTINGS, reducedMotion: prefersReduced };
    }
    this.ui = new Interface(
      root,
      this.settings,
      this.enter,
      this.changeSettings,
    );
    try {
      this.world = new UnderwaterScene(this.ui.sceneHost, () => {
        if (document.pointerLockElement) document.exitPointerLock();
        cancelAnimationFrame(this.frame);
        this.ui.showError(
          'The graphics connection was interrupted. Reload this page to return to the water.',
          true,
        );
      });
      this.controls = new SwimControls(
        this.world.renderer.domElement,
        (locked) => {
          if (locked) this.entered = true;
          resetSwimming(this.state);
          this.previous = 0;
          this.ui.setLocked(locked, this.entered);
        },
      );
      this.applySettings();
      document.addEventListener('pointerlockerror', this.lockError, {
        signal: this.abort.signal,
      });
      document.addEventListener(
        'visibilitychange',
        () => {
          this.previous = 0;
          this.controls?.clear();
          resetSwimming(this.state);
          if (document.hidden && this.controls?.locked)
            document.exitPointerLock();
        },
        { signal: this.abort.signal },
      );
      window.addEventListener(
        'pagehide',
        (event) => {
          // Cached pages retain their systems and resume after pageshow.
          if (!event.persisted) this.dispose();
        },
        { signal: this.abort.signal },
      );
      this.frame = requestAnimationFrame(this.tick);
    } catch (error) {
      this.world?.dispose();
      this.world = undefined;
      this.ui.showError(
        'This aquarium needs WebGL. Try a current desktop browser with graphics acceleration enabled.',
        true,
      );
      console.warn('Cozy Diver could not initialize graphics.', error);
    }
  }
  private enter = (): void => {
    const canvas = this.world?.renderer.domElement;
    if (!canvas || !this.controls) return;
    if (!canvas.requestPointerLock) {
      this.ui.showError(
        'Mouse capture is unavailable. Open this page in a supported desktop browser.',
      );
      return;
    }
    try {
      const request = canvas.requestPointerLock() as Promise<void> | undefined;
      request?.catch(this.lockError);
    } catch {
      this.lockError();
    }
  };
  private lockError = (): void => {
    this.ui.showError(
      'Mouse capture was not granted. Click Enter again, or allow pointer lock in your browser.',
    );
  };
  private changeSettings = (settings: Settings): void => {
    this.settings = settings;
    this.applySettings();
    try {
      this.ui.storageResult(saveSettings(localStorage, settings));
    } catch {
      this.ui.storageResult(false);
    }
  };
  private applySettings(): void {
    this.tuning.speed = this.settings.speed;
    this.tuning.feel = this.settings.swimmingFeel;
    this.tuning.reducedMotion = this.settings.reducedMotion;
    if (this.controls) {
      this.controls.sensitivity = this.settings.sensitivity;
      this.controls.reducedMotion = this.settings.reducedMotion;
    }
  }
  private tick = (now: number): void => {
    if (this.disposed || !this.world || !this.controls) return;
    const dt = this.previous
      ? Math.max(
          0,
          Math.min((now - this.previous) / 1000, SWIMMING.maxFrameDelta),
        )
      : 0;
    this.previous = now;
    if (this.controls.locked && !document.hidden) {
      this.elapsed += dt;
      this.controls.update(dt);
      movementDirection(
        this.controls.input,
        this.controls.yaw,
        this.controls.pitch,
        this.direction,
      );
      integrateSwimming(
        this.state,
        this.direction,
        dt,
        this.tuning,
        AQUARIUM,
        this.world.aquarium.collision,
      );
    }
    this.world.camera.position.set(
      this.state.position.x,
      this.state.position.y,
      this.state.position.z,
    );
    this.world.camera.rotation.set(
      this.controls.pitch +
        (this.settings.reducedMotion ? 0 : this.state.bodyPitch),
      this.controls.yaw,
      0,
      'YXZ',
    );
    this.ui.setDepth(AQUARIUM.max.y - this.state.position.y);
    if (!document.hidden)
      this.world.render(
        this.elapsed,
        this.settings.reducedMotion,
        dt,
        this.controls.locked,
      );
    this.frame = requestAnimationFrame(this.tick);
  };
  dispose = (): void => {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.abort.abort();
    this.controls?.dispose();
    this.world?.dispose();
    this.ui.dispose();
  };
}
