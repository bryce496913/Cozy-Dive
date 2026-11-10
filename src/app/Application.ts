import { AudioSystem } from '../audio/AudioSystem';
import { AQUARIUM, SPAWN, SWIMMING } from '../config/world';
import { SwimControls } from '../controls/SwimControls';
import {
  integrateSwimming,
  advanceHoverPreview,
  movementDirection,
  createSwimState,
  resetSwimming,
  type SwimTuning,
  type SwimState,
} from '../player/swimming';
import { UnderwaterScene } from '../rendering/UnderwaterScene';
import { OfficeScene } from '../rendering/OfficeScene';
import { OfficeAmbience } from '../audio/OfficeAmbience';
import { OFFICE, OFFICE_FOOTPRINTS, TANK } from '../config/office';
import {
  createWalkState,
  stepWalking,
  stopWalking,
  type WalkWorld,
} from '../player/walking';
import { Interface, type ExperienceMode } from '../ui/Interface';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
} from '../ui/settings';

export interface ApplicationOptions {
  /** Where the start screen opens (v0.3 default: the office). */
  readonly startMode?: ExperienceMode;
}
const OFFICE_WORLD: WalkWorld = {
  min: OFFICE.room.min,
  max: OFFICE.room.max,
  obstacles: OFFICE_FOOTPRINTS,
  radius: OFFICE.playerRadius,
};
const OFFICE_WALK = {
  speed: OFFICE.walkSpeed,
  response: OFFICE.walkResponse,
  maxFrameDelta: OFFICE.maxFrameDelta,
};

export class Application {
  private readonly ui: Interface;
  private world?: UnderwaterScene;
  /** v0.3 Pass 020: the office around the tank, sharing the aquarium's renderer. */
  private office?: OfficeScene;
  private officeAudio?: OfficeAmbience;
  private mode: ExperienceMode;
  private readonly walk = createWalkState(OFFICE.spawn);
  private officeTime = 0;
  /** Each space keeps its own look direction across switches. */
  private readonly looks: Record<
    ExperienceMode,
    { yaw: number; pitch: number }
  > = {
    office: { yaw: OFFICE.spawnYaw, pitch: -0.12 },
    aquarium: { yaw: 0, pitch: -0.06 },
  };
  /** Local time of day when the app started, for the office clock (no per-frame Date). */
  private readonly clockBase: number;
  private controls?: SwimControls;
  private audio?: AudioSystem;
  private readonly state = createSwimState(SPAWN);
  private readonly playerPresence = {
    position: this.state.position,
    velocity: this.state.velocity,
    active: false,
  };
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
  constructor(
    root: HTMLElement,
    configureWorld?: (world: UnderwaterScene, state: SwimState) => void,
    options: ApplicationOptions = {},
  ) {
    this.mode = options.startMode ?? 'office';
    const now = new Date();
    this.clockBase =
      now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
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
        this.audio?.setActive(false);
        this.ui.showError(
          'The graphics connection was interrupted. Reload this page to return to the water.',
          true,
        );
      });
      configureWorld?.(this.world, this.state);
      this.audio = new AudioSystem(
        [
          ...this.world.aquarium.hardscape.formations.map((f) => ({
            x: f.position.x,
            y: f.position.y + 1.4,
            z: f.position.z,
          })),
          ...this.world.aquarium.ornaments.anchors
            .filter((a) => a.ornament === 'chest' || a.ornament === 'filter')
            .map((a) => a.position),
        ],
        { onStatus: (status) => this.ui.audioStatus(status) },
      );
      this.audio.setVisible(!document.hidden);
      this.office = new OfficeScene(this.world);
      this.officeAudio = new OfficeAmbience({
        onStatus: (status) => this.ui.audioStatus(status),
      });
      this.officeAudio.setVisible(!document.hidden);
      this.controls = new SwimControls(
        this.world.renderer.domElement,
        (locked) => {
          if (locked) this.entered = true;
          this.updateAudio(locked);
          resetSwimming(this.state);
          stopWalking(this.walk);
          this.previous = 0;
          this.ui.setLocked(locked, this.entered);
        },
      );
      this.controls.yaw = this.looks[this.mode].yaw;
      this.controls.pitch = this.looks[this.mode].pitch;
      this.controls.clear();
      this.ui.setMode(this.mode);
      this.applySettings();
      document.addEventListener('pointerlockerror', this.lockError, {
        signal: this.abort.signal,
      });
      document.addEventListener(
        'visibilitychange',
        () => {
          this.previous = 0;
          this.audio?.setVisible(!document.hidden);
          this.officeAudio?.setVisible(!document.hidden);
          this.controls?.clear();
          resetSwimming(this.state);
          stopWalking(this.walk);
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
          else {
            this.audio?.setVisible(false);
            this.officeAudio?.setVisible(false);
          }
        },
        { signal: this.abort.signal },
      );
      window.addEventListener(
        'pageshow',
        () => {
          this.audio?.setVisible(!document.hidden);
          this.officeAudio?.setVisible(!document.hidden);
        },
        { signal: this.abort.signal },
      );
      this.frame = requestAnimationFrame(this.tick);
    } catch (error) {
      this.audio?.dispose();
      this.officeAudio?.dispose();
      this.office?.dispose();
      this.office = undefined;
      this.world?.dispose();
      this.world = undefined;
      this.ui.showError(
        'This aquarium needs WebGL. Try a current desktop browser with graphics acceleration enabled.',
        true,
      );
      console.warn('Cozy Diver could not initialize graphics.', error);
    }
  }
  private enter = (mode: ExperienceMode): void => {
    const canvas = this.world?.renderer.domElement;
    if (!canvas || !this.controls) return;
    if (mode !== this.mode) {
      // Pass 020 switches by a cut from the pause screen; Pass 021 adds the dive transition.
      this.looks[this.mode] = {
        yaw: this.controls.yaw,
        pitch: this.controls.pitch,
      };
      this.controls.yaw = this.looks[mode].yaw;
      this.controls.pitch = this.looks[mode].pitch;
      this.mode = mode;
      this.ui.setMode(mode);
      this.controls.clear();
      stopWalking(this.walk);
      resetSwimming(this.state);
    }
    if (!canvas.requestPointerLock) {
      this.ui.showError(
        'Mouse capture is unavailable. Open this page in a supported desktop browser.',
      );
      return;
    }
    // Only the space being entered needs its audio; the other unlocks on its own Enter click.
    if (mode === 'office') this.officeAudio?.unlockFromGesture();
    else this.audio?.unlockFromGesture();
    try {
      const request = canvas.requestPointerLock() as Promise<void> | undefined;
      request?.catch(this.lockError);
    } catch {
      this.lockError();
    }
  };
  /** Only the current space is heard: the office ambience or the underwater soundscape. */
  private updateAudio(locked: boolean): void {
    const audible = locked && !document.hidden;
    this.audio?.setActive(audible && this.mode === 'aquarium');
    this.officeAudio?.setActive(audible && this.mode === 'office');
  }
  private lockError = (): void => {
    this.audio?.setActive(false);
    this.officeAudio?.setActive(false);
    this.ui.showError(
      'Mouse capture was not granted. Click Enter again, or allow pointer lock in your browser.',
    );
  };
  private changeSettings = (settings: Settings): void => {
    this.settings = settings;
    this.applySettings();
    // Settings changes are direct user gestures; the initial preview still cannot unlock audio.
    if (this.entered) {
      if (this.mode === 'office') this.officeAudio?.unlockFromGesture();
      else this.audio?.unlockFromGesture();
    }
    try {
      this.ui.storageResult(saveSettings(localStorage, settings));
    } catch {
      this.ui.storageResult(false);
    }
  };
  private applySettings(): void {
    this.audio?.configure(this.settings);
    this.officeAudio?.configure(this.settings);
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
    if (this.mode === 'office' && this.office) {
      this.tickOffice(dt);
      this.frame = requestAnimationFrame(this.tick);
      return;
    }
    if (!this.entered && !document.hidden)
      advanceHoverPreview(
        this.state,
        dt,
        this.tuning,
        AQUARIUM,
        this.world.aquarium.collision,
      );
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
    this.audio?.update(dt, this.state, this.tuning, this.controls.yaw);
    this.ui.setDepth(AQUARIUM.max.y - this.state.position.y);
    this.playerPresence.active = this.controls.locked && !document.hidden;
    if (!document.hidden)
      this.world.render(
        this.elapsed,
        this.settings.reducedMotion,
        dt,
        this.controls.locked,
        this.playerPresence,
      );
    this.frame = requestAnimationFrame(this.tick);
  };
  /** Walk the office and draw it with the live miniature aquarium. */
  private tickOffice(dt: number): void {
    const controls = this.controls!,
      office = this.office!;
    if (!document.hidden) this.officeTime += dt;
    if (controls.locked && !document.hidden) {
      this.elapsed += dt;
      controls.update(dt);
      stepWalking(
        this.walk,
        controls.input,
        controls.yaw,
        dt,
        OFFICE_WALK,
        OFFICE_WORLD,
      );
    }
    const p = this.walk.position;
    office.camera.position.set(p.x, p.y, p.z);
    office.camera.rotation.set(controls.pitch, controls.yaw, 0, 'YXZ');
    this.officeAudio?.update(
      Math.hypot(
        p.x - TANK.position.x,
        p.y - TANK.position.y - 0.2,
        p.z - TANK.position.z,
      ),
    );
    this.playerPresence.active = false;
    if (!document.hidden)
      office.render(
        this.clockBase + this.officeTime,
        this.settings.reducedMotion,
        dt,
      );
  }
  dispose = (): void => {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.abort.abort();
    this.audio?.dispose();
    this.officeAudio?.dispose();
    this.controls?.dispose();
    this.office?.dispose();
    this.world?.dispose();
    this.ui.dispose();
  };
}
