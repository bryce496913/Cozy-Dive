import { AudioSystem } from '../audio/AudioSystem';
import { AQUARIUM, SPAWN, SWIMMING, type Vec3 } from '../config/world';
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
import { UNDERWATER_HAZE, UnderwaterScene } from '../rendering/UnderwaterScene';
import {
  DivePath,
  canDive,
  canSurface,
  interruptedChoice,
  tankDistance,
  type DiveFrame,
  type Pose,
} from '../player/dive';
import { OfficeScene } from '../rendering/OfficeScene';
import { OuterWatersScene } from '../rendering/OuterWatersScene';
import type { WaterWorld } from '../rendering/WaterWorld';
import { PASSAGE } from '../config/passage';
import {
  frameTurn,
  mapPoint,
  mapVector,
  mouthDistance,
  passageDarkness,
  passageFrame,
  passageTarget,
  returnPose,
  type WaterWorldId,
} from '../player/passage';
import {
  SightingTracker,
  loadJournal,
  recordSighting,
  saveJournal,
  type Sighting,
} from '../discovery/journal';
import { OfficeAmbience } from '../audio/OfficeAmbience';
import { OFFICE, OFFICE_FOOTPRINTS } from '../config/office';
import { FrameMeter, formatFrameSummary } from '../ui/frameMeter';

/** Pass 022: seconds in the office before the first-visit hint appears. */
const HINT_DELAY = 4;
import {
  createWalkState,
  stepWalking,
  stopWalking,
  type WalkWorld,
} from '../player/walking';
import { Interface, type ExperienceMode } from '../ui/Interface';
import {
  DEFAULT_SETTINGS,
  loadDived,
  loadSettings,
  saveDived,
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
  /** v0.4 Pass 023: the outer waters, while they might be needed. */
  private outer?: OuterWatersScene;
  /** Which water world the swimmer is in. */
  private waterWorld: WaterWorldId = 'aquarium';
  /** Seconds the outer waters have been out of range (released after a delay). */
  private outerIdle = 0;
  /** "Return to the tank" arrives out of darkness (1 → 0). */
  private arrival = 0;
  private readonly mapped = { x: 0, y: 0, z: 0 };
  private sightings: readonly Sighting[] = [];
  private tracker = new SightingTracker([]);
  private readonly lookForward = { x: 0, y: 0, z: -1 };
  /** Pass 024: the tank's sound spots, and the outer reef's edge current (reused). */
  private tankSoundSpots: readonly Vec3[] = [];
  private readonly drift = { x: 0, y: 0, z: 0 };
  private officeAudio?: OfficeAmbience;
  private mode: ExperienceMode;
  private readonly walk = createWalkState(OFFICE.spawn);
  private officeTime = 0;
  /** Pass 022: whether the player has ever dived (hides the first-visit hint for good). */
  private dived = false;
  /** Seconds walked in the office this visit, before the first-visit hint appears. */
  private officeVisit = 0;
  private readonly frameMeter = new FrameMeter();
  private lastFrameAt = 0;
  /** v0.3 Pass 021: the dive or surfacing in progress, if any. */
  private dive?: { path: DivePath; elapsed: number; splashed: boolean };
  /** Reused every frame for the prompt check (no per-frame allocation). */
  private readonly currentPose: Pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  private readonly diveFrame: DiveFrame = {
    space: 'office',
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    veil: 0,
    fog: 0,
    bubbles: 0,
    water: 0,
  };
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
    try {
      this.dived = loadDived(localStorage);
    } catch {
      this.dived = false;
    }
    this.ui = new Interface(
      root,
      this.settings,
      this.enter,
      this.changeSettings,
      this.returnToTank,
    );
    try {
      this.sightings = loadJournal(localStorage);
    } catch {
      this.sightings = [];
    }
    this.tracker = new SightingTracker(this.sightings);
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
      this.tankSoundSpots = [
        ...this.world.aquarium.hardscape.formations.map((f) => ({
          x: f.position.x,
          y: f.position.y + 1.4,
          z: f.position.z,
        })),
        ...this.world.aquarium.ornaments.anchors
          .filter((a) => a.ornament === 'chest' || a.ornament === 'filter')
          .map((a) => a.position),
      ];
      this.audio = new AudioSystem(this.tankSoundSpots, {
        onStatus: (status) => this.ui.audioStatus(status),
      });
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
      document.addEventListener('keydown', this.action, {
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
    // A transition paused by Escape: choosing its destination resumes it; choosing where it came
    // from cancels it and puts the player back where they pressed E.
    const resuming =
      !!this.dive && interruptedChoice(this.dive.path, mode) === 'resume';
    if (this.dive && !resuming) this.cancelDive();
    if (!resuming && mode !== this.mode && !this.entered) {
      // The first entry from the start screen (whose overlay covers the view) is a plain cut.
      this.cut(mode);
    } else if (!resuming && mode !== this.mode) {
      // Pass 022: the pause screen's buttons switch spaces with a calm fade (it plays once pointer
      // lock is granted); in the world, E dives (Pass 021). Each space keeps its own position and
      // look direction.
      this.looks[this.mode] = {
        yaw: this.controls.yaw,
        pitch: this.controls.pitch,
      };
      const there =
        mode === 'office' ? this.walk.position : this.state.position;
      this.controls.clear();
      stopWalking(this.walk);
      resetSwimming(this.state);
      this.ui.setPrompt(null);
      this.dive = {
        path: new DivePath('switch', { ...this.pose() }, true, {
          space: mode,
          pose: {
            x: there.x,
            y: there.y,
            z: there.z,
            yaw: this.looks[mode].yaw,
            pitch: this.looks[mode].pitch,
          },
        }),
        elapsed: 0,
        splashed: false,
      };
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
  /** Switch spaces at once (first entry), each keeping its own look direction. */
  private cut(mode: ExperienceMode): void {
    const controls = this.controls!;
    this.looks[this.mode] = { yaw: controls.yaw, pitch: controls.pitch };
    controls.yaw = this.looks[mode].yaw;
    controls.pitch = this.looks[mode].pitch;
    this.mode = mode;
    this.ui.setMode(mode);
    controls.clear();
    stopWalking(this.walk);
    resetSwimming(this.state);
  }
  /**
   * Only the current space is heard: the office ambience or the underwater soundscape. During a
   * transition (Pass 022) both play, crossfaded by the frame's underwater share.
   */
  private updateAudio(locked: boolean): void {
    const audible = locked && !document.hidden,
      crossfading = !!this.dive;
    this.audio?.setActive(audible && (crossfading || this.mode === 'aquarium'));
    this.officeAudio?.setActive(
      audible && (crossfading || this.mode === 'office'),
    );
    if (!crossfading) {
      this.audio?.setMix(1);
      this.officeAudio?.setMix(1);
    }
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
  /** The current camera pose in the current space. */
  private pose(): Pose {
    const c = this.controls!,
      p = this.mode === 'office' ? this.walk.position : this.state.position,
      out = this.currentPose;
    out.x = p.x;
    out.y = p.y;
    out.z = p.z;
    out.yaw = c.yaw;
    out.pitch = c.pitch;
    return out;
  }
  /** E: dive in at the tank, or return to the office near the surface. */
  private action = (event: KeyboardEvent): void => {
    if (
      event.code !== 'KeyE' ||
      event.repeat ||
      this.dive ||
      !this.controls?.locked ||
      document.hidden
    )
      return;
    const pose = this.pose();
    const kind =
      this.mode === 'office' && canDive(pose)
        ? 'dive'
        : this.mode === 'aquarium' && canSurface(pose.y, this.waterWorld)
          ? 'surface'
          : undefined;
    if (!kind) return;
    event.preventDefault();
    // The key press is a user gesture: unlock the destination's audio now.
    if (kind === 'dive') this.audio?.unlockFromGesture();
    else this.officeAudio?.unlockFromGesture();
    // The dive always lands in the tank (the outer waters are released once out of range).
    if (kind === 'dive') this.setWaterWorld('aquarium');
    if (kind === 'dive' && !this.dived) {
      this.dived = true;
      try {
        saveDived(localStorage);
      } catch {
        /* Storage unavailable: the hint may show again next visit. */
      }
    }
    this.controls.clear();
    stopWalking(this.walk);
    resetSwimming(this.state);
    this.ui.setPrompt(null);
    this.dive = {
      path: new DivePath(kind, { ...pose }, this.settings.reducedMotion),
      elapsed: 0,
      splashed: false,
    };
    // Both soundscapes play through the transition, crossfaded frame by frame.
    this.updateAudio(this.controls.locked);
  };
  /** Advance and draw the dive; hand control back at its end. */
  private tickDive(dt: number): void {
    const dive = this.dive!,
      controls = this.controls!,
      running = controls.locked && !document.hidden;
    // The transition and the aquarium's own clock advance together; both pause with the game.
    if (running) {
      dive.elapsed += dt;
      this.elapsed += dt;
    }
    const f = dive.path.sample(dive.elapsed, this.diveFrame);
    if (f.space !== this.mode) {
      this.mode = f.space;
      this.ui.setMode(f.space);
      this.updateAudio(controls.locked);
    }
    this.ui.setVeil(f.veil);
    this.audio?.setMix(f.water);
    this.officeAudio?.setMix(1 - f.water);
    if (f.bubbles > 0.95 && !dive.splashed) {
      dive.splashed = true;
      if (!this.settings.reducedMotion) this.ui.burst();
    }
    if (f.space === 'office') {
      this.office!.camera.position.set(f.x, f.y, f.z);
      this.office!.camera.rotation.set(f.pitch, f.yaw, 0, 'YXZ');
      this.officeAudio?.update(tankDistance(f));
      if (!document.hidden)
        this.office!.render(
          this.clockBase + this.officeTime,
          this.elapsed,
          this.settings.reducedMotion,
          dt,
          running,
        );
    } else {
      const tank = this.world!,
        w = this.water();
      w.camera.position.set(f.x, f.y, f.z);
      w.camera.rotation.set(f.pitch, f.yaw, 0, 'YXZ');
      if (w === tank) tank.setHaze(f.fog);
      // Surfacing: the front glass shows the office from the swimmer's mapped viewpoint.
      if (
        w === tank &&
        dive.path.kind === 'surface' &&
        !this.settings.reducedMotion &&
        !document.hidden
      )
        tank.setOutsideView(
          this.office!.renderOutside(w.camera),
          this.office!.resolution,
        );
      this.ui.setDepth(w.bounds.max.y - f.y);
      // The underwater soundscape follows the drifting camera (swimming is reset, so it is still).
      this.state.position.x = f.x;
      this.state.position.y = f.y;
      this.state.position.z = f.z;
      this.audio?.update(dt, this.state, this.tuning, f.yaw);
      this.playerPresence.active = false;
      if (!document.hidden)
        w.render(
          this.elapsed,
          this.settings.reducedMotion,
          dt,
          running,
          this.playerPresence,
        );
    }
    if (running) this.officeTime += dt;
    if (dive.elapsed >= dive.path.duration) this.endDive();
  }
  /** Cancel a paused transition: back where it started, in the space it started from. */
  private cancelDive(): void {
    const dive = this.dive;
    if (dive) this.endDive(dive.path.start);
  }
  /**
   * Finish a transition, settling into `to` (by default its destination) with controls released
   * and the walking or swimming state matching the camera, so nothing jumps afterwards.
   */
  private endDive(to?: { space: ExperienceMode; pose: Pose }): void {
    const dive = this.dive;
    this.dive = undefined;
    this.world?.setHaze(UNDERWATER_HAZE);
    this.world?.setOutsideView(null);
    this.office?.releaseOutside();
    this.ui.setVeil(0);
    if (!dive || !this.controls) return;
    const { space, pose } = to ?? dive.path.end;
    if (space === 'aquarium') {
      Object.assign(this.state.position, { x: pose.x, y: pose.y, z: pose.z });
      this.state.neutralDepth = pose.y;
      resetSwimming(this.state);
    } else {
      Object.assign(this.walk.position, { x: pose.x, y: pose.y, z: pose.z });
      stopWalking(this.walk);
    }
    this.mode = space;
    this.ui.setMode(space);
    this.controls.yaw = pose.yaw;
    this.controls.pitch = pose.pitch;
    this.controls.clear();
    this.looks[space] = { yaw: pose.yaw, pitch: pose.pitch };
    this.updateAudio(this.controls.locked);
  }
  /** v0.4 Pass 023: the water world the swimmer is in (the tank unless in the outer waters). */
  private water(): WaterWorld {
    return this.waterWorld === 'outer' && this.outer ? this.outer : this.world!;
  }
  private setWaterWorld(id: WaterWorldId): void {
    this.waterWorld = id;
    this.ui.setOuter(id === 'outer');
    // Pass 024: the soundscape's small sounds come from the current world's places.
    this.audio?.setLocations(
      id === 'outer' && this.outer
        ? this.outer.soundSpots
        : this.tankSoundSpots,
    );
  }
  /**
   * Load the outer waters as the swimmer nears the crevice and release them once well away from
   * it (after a delay, so passing by does not reload them); they stay while the swimmer is there.
   */
  private manageOuter(dt: number): void {
    const swimming = this.mode === 'aquarium',
      distance = mouthDistance(this.state.position),
      inTank = this.waterWorld === 'aquarium';
    if (!this.outer) {
      if (swimming && inTank && distance < PASSAGE.preload)
        this.outer = new OuterWatersScene(this.world!.renderer, {
          reef: this.world!.reefLoader,
          fish: this.world!.authored.loader,
          plants: this.world!.aquarium.plants.material,
          soundSpots: this.tankSoundSpots.length,
        });
      this.outerIdle = 0;
      return;
    }
    const keep =
      !inTank || (swimming && distance < PASSAGE.release) || !!this.dive;
    this.outerIdle = keep ? 0 : this.outerIdle + dt;
    if (this.outerIdle > PASSAGE.releaseDelay) {
      this.outer.dispose();
      this.outer = undefined;
      this.outerIdle = 0;
    }
  }
  /**
   * Past the threshold in the crevice (or back out of the tunnel's start), continue in the other
   * world from the identical relative pose: position, velocity, thrust and look all carry across.
   */
  private crossPassage(): void {
    const target = passageTarget(
      this.waterWorld,
      this.state.position,
      !!this.outer?.isReady,
    );
    if (target === this.waterWorld) return;
    const from = passageFrame(this.waterWorld),
      to = passageFrame(target),
      s = this.state;
    mapPoint(s.position, from, to, this.mapped);
    s.position.x = this.mapped.x;
    s.position.y = this.mapped.y;
    s.position.z = this.mapped.z;
    mapVector(s.velocity, from, to, s.velocity);
    mapVector(s.thrust, from, to, s.thrust);
    s.neutralDepth += to.origin.y - from.origin.y;
    this.controls!.turn(frameTurn(from, to));
    this.setWaterWorld(target);
  }
  /** "Return to the tank" from the pause screen: back outside the crevice, out of darkness. */
  private returnToTank = (): void => {
    if (this.waterWorld !== 'outer' || !this.controls) return;
    if (this.dive) this.cancelDive();
    const pose = returnPose();
    Object.assign(this.state.position, { x: pose.x, y: pose.y, z: pose.z });
    this.state.neutralDepth = pose.y;
    resetSwimming(this.state);
    // From the office, the water's remembered look is used by the pause-screen fade instead.
    if (this.mode === 'aquarium') {
      this.controls.yaw = pose.yaw;
      this.controls.pitch = pose.pitch;
      this.controls.clear();
    }
    this.looks.aquarium = { yaw: pose.yaw, pitch: pose.pitch };
    this.setWaterWorld('aquarium');
    this.arrival = 1;
    this.enter('aquarium');
  };
  /** Count anything comfortably in view as seen (the sightings journal). */
  private lookFor(water: WaterWorld, dt: number): void {
    if (!water.sightings.length) return;
    const c = this.controls!,
      cp = Math.cos(c.pitch),
      f = this.lookForward;
    f.x = -Math.sin(c.yaw) * cp;
    f.y = Math.sin(c.pitch);
    f.z = -Math.cos(c.yaw) * cp;
    const seen = this.tracker.update(
      water.sightings,
      this.state.position,
      f,
      dt,
    );
    if (!seen) return;
    this.sightings = recordSighting(this.sightings, seen.id, new Date());
    try {
      saveJournal(localStorage, this.sightings);
    } catch {
      /* Unavailable storage: the sighting is kept for this visit only. */
    }
  }
  /** Pass 022: feed the optional frame-time readout with real frame intervals. */
  private measureFrame(now: number): void {
    if (!this.settings.frameTime) {
      this.ui.setFrameTime(null);
      this.lastFrameAt = 0;
      return;
    }
    const interval = this.lastFrameAt ? now - this.lastFrameAt : 0;
    this.lastFrameAt = now;
    const summary = this.frameMeter.record(interval);
    if (summary) this.ui.setFrameTime(formatFrameSummary(summary));
    else if (!this.frameMeter.summary) this.ui.setFrameTime('measuring…');
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
    this.measureFrame(now);
    if (this.dive) {
      this.tickDive(dt);
      this.frame = requestAnimationFrame(this.tick);
      return;
    }
    const pose = this.pose();
    if (this.mode === 'office' && this.controls.locked && !document.hidden)
      this.officeVisit += dt;
    this.ui.setPrompt(
      !this.controls.locked
        ? null
        : this.mode === 'office'
          ? canDive(pose)
            ? 'dive'
            : !this.dived && this.officeVisit > HINT_DELAY
              ? 'hint'
              : null
          : canSurface(pose.y, this.waterWorld)
            ? 'surface'
            : null,
    );
    this.manageOuter(dt);
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
      const swim = this.water();
      // Pass 024: near soft edges a gentle current turns the swimmer back (through collision).
      if (swim.current) {
        swim.current(this.state.position, this.drift);
        this.state.velocity.x += this.drift.x * dt * PASSAGE.currentResponse;
        this.state.velocity.y += this.drift.y * dt * PASSAGE.currentResponse;
        this.state.velocity.z += this.drift.z * dt * PASSAGE.currentResponse;
      }
      integrateSwimming(
        this.state,
        this.direction,
        dt,
        this.tuning,
        swim.bounds,
        swim.collision,
      );
      this.crossPassage();
    }
    const water = this.water();
    water.camera.position.set(
      this.state.position.x,
      this.state.position.y,
      this.state.position.z,
    );
    water.camera.rotation.set(
      this.controls.pitch +
        (this.settings.reducedMotion ? 0 : this.state.bodyPitch),
      this.controls.yaw,
      0,
      'YXZ',
    );
    this.audio?.update(dt, this.state, this.tuning, this.controls.yaw);
    this.ui.setDepth(water.bounds.max.y - this.state.position.y);
    this.arrival = Math.max(0, this.arrival - dt / PASSAGE.arrivalFade);
    this.ui.setDarkness(
      Math.max(
        this.arrival,
        passageDarkness(this.waterWorld, this.state.position),
      ),
    );
    if (this.controls.locked && !document.hidden) this.lookFor(water, dt);
    this.playerPresence.active = this.controls.locked && !document.hidden;
    if (!document.hidden)
      water.render(
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
      office = this.office!,
      running = controls.locked && !document.hidden;
    if (running) this.officeTime += dt;
    if (running) {
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
    this.officeAudio?.update(tankDistance(p));
    this.playerPresence.active = false;
    if (!document.hidden)
      office.render(
        this.clockBase + this.officeTime,
        this.elapsed,
        this.settings.reducedMotion,
        dt,
        running,
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
    this.outer?.dispose();
    this.outer = undefined;
    this.world?.dispose();
    this.ui.dispose();
  };
}
