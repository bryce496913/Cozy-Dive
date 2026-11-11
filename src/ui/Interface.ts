import type { AudioStatus } from '../audio/AudioSystem';
import { SWIM_SPEED, type Settings } from './settings';

const wave =
  '<svg viewBox="0 0 40 26" fill="none" aria-hidden="true"><path d="M2 8c6-8 12 8 18 0s12 8 18 0M2 18c6-8 12 8 18 0s12 8 18 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
const arrow =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" stroke="currentColor" stroke-width="1.5"/></svg>';
/** Keep browser/OS shortcuts and held-key repeat outside the gameplay mute action. */
export function isAudioMuteShortcut(
  event: Pick<
    KeyboardEvent,
    'code' | 'repeat' | 'ctrlKey' | 'metaKey' | 'altKey'
  >,
): boolean {
  return (
    event.code === 'KeyM' &&
    !event.repeat &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  );
}
/** v0.4 Pass 025: how long the "New sighting" note stays, then fades (ms). */
export const SIGHTING_NOTE = { shown: 4200, fade: 900 } as const;
/** Where the player is: the office (v0.3) or inside the aquarium. */
/** In-world prompts: the E actions, and the first-visit hint. */
export type Prompt = 'dive' | 'surface' | 'hint';
export type ExperienceMode = 'office' | 'aquarium';
export class Interface {
  private readonly abort = new AbortController();
  private readonly overlay: HTMLElement;
  private readonly enter: HTMLButtonElement;
  private readonly office: HTMLButtonElement;
  private mode: ExperienceMode = 'office';
  private readonly settingsPanel: HTMLElement;
  private readonly status: HTMLElement;
  private readonly depth: HTMLElement;
  private lastDepth = '';
  private prompt: Prompt | null = null;
  private frameText = '';
  private veil = 0;
  private darkness = 0;
  private readonly veilElement: HTMLElement;
  private readonly bubbles: HTMLElement;
  private burstTimer?: ReturnType<typeof setTimeout>;
  private noteTimer?: ReturnType<typeof setTimeout>;
  private readonly seenPanel: HTMLElement;
  private readonly seenToggle: HTMLButtonElement;
  private fatalMessage = '';

  constructor(
    readonly root: HTMLElement,
    settings: Settings,
    onEnter: (mode: ExperienceMode) => void,
    onSettings: (settings: Settings) => void,
    /** v0.4 Pass 023: "Return to the tank" from the outer waters. */
    onReturnToTank: () => void = () => {},
  ) {
    root.innerHTML = `
      <div class="scene" id="scene"></div><div class="vignette" aria-hidden="true"></div>
      <header class="topbar"><a class="brand" href="./" aria-label="Cozy Diver home">${wave}<span>COZY DIVER</span></a><span class="edition">A LITTLE WORLD. A LITTLE PEACE.</span><div class="preferences"><button id="audio-toggle" class="audio-toggle" type="button" aria-pressed="false">Mute audio</button><button class="settings-toggle" aria-expanded="false" aria-controls="settings-panel">Settings <span aria-hidden="true">⚙</span></button></div></header>
      <main class="overlay" id="overlay"><div class="welcome">
        <p class="eyebrow"><span></span> YOUR FIRST DIVE</p>
        <h1>Let the world<br>drift <em>away.</em></h1>
        <p class="intro">A quiet room, a little tank, and a whole reef inside it.<br>No rush. No destination. Just you and the water.</p>
        <div class="entry-actions"><button class="enter" id="office">Enter the Office ${arrow}</button><button class="enter secondary" id="enter">Enter the Water ${arrow}</button><button class="enter secondary" id="return-tank" hidden>Return to the tank ${arrow}</button></div>
        <p class="entry-note" id="entry-note">Walk with W A S D and look around with the mouse.</p>
        <button class="seen-toggle" id="seen-toggle" type="button" aria-expanded="false" aria-controls="seen-panel" hidden>Seen in the outer waters</button>
        <p class="status" id="status" role="status" aria-live="polite"></p>
      </div><div class="scene-label"><span class="label-line"></span><span>THE SUNLIT REEF AQUARIUM<small>01 / FIRST DIVE</small></span></div></main>
      <aside class="settings-panel" id="settings-panel" aria-label="Experience settings" hidden>
        <div class="panel-heading"><h2>Make yourself at home.</h2><button id="close-settings" aria-label="Close settings">×</button></div>
        <label for="sensitivity">Mouse sensitivity <output id="sensitivity-value"></output></label><input id="sensitivity" type="range" min="0.25" max="2.5" step="0.05" />
        <label for="speed">Swimming speed <output id="speed-value"></output></label><input id="speed" type="range" min="${SWIM_SPEED.min}" max="${SWIM_SPEED.max}" step="${SWIM_SPEED.step}" />
        <label for="swimming-feel">Swimming feel</label><select id="swimming-feel"><option value="relaxed">Relaxed</option><option value="natural">Natural</option><option value="responsive">Responsive</option></select>
        <label class="check"><input id="reduced-motion" type="checkbox" />Reduced camera motion</label><p>Direct mouse-look, with plant and particle motion still. Breathing buoyancy and subtle swimming sway are suppressed.</p>
        <label class="check"><input id="audio-enabled" type="checkbox" />Ambient audio</label>
        <label class="check"><input id="frame-time" type="checkbox" />Show frame time</label><p>A small readout of frame time and frame rate, for checking performance on this device.</p>
        <label for="master-volume">Master volume <output id="master-volume-value"></output></label><input id="master-volume" type="range" min="0" max="100" step="1" />
        <p id="audio-status" role="status">Audio begins when you enter. Press M while swimming to mute.</p>
        <p class="save-status" id="save-status" role="status">Preferences saved on this device.</p>
      </aside>
      <aside class="settings-panel seen-panel" id="seen-panel" aria-labelledby="seen-heading" hidden>
        <div class="panel-heading"><h2 id="seen-heading">Seen out there.</h2><button id="close-seen" aria-label="Close the list of things seen">×</button></div>
        <p>Things you have come across beyond the tank.</p><ul class="seen-list" id="seen-list"></ul>
      </aside>
      <p class="sighting-note" id="sighting-note" role="status" aria-live="polite" hidden></p>
      <div class="dive-veil" aria-hidden="true"></div><div class="passage-veil" aria-hidden="true"></div><div class="dive-bubbles" aria-hidden="true"></div>
      <p class="dive-prompt" id="dive-prompt" role="status" aria-live="polite" hidden></p>
      <p class="frame-time" id="frame-readout" aria-hidden="true" hidden></p>
      <div class="swim-hud" hidden><span class="crosshair" aria-hidden="true">·</span><span class="hud-message">You have nowhere else to be.</span></div>
      <footer class="bottom-bar"><div class="controls" id="controls" aria-label="Controls"></div><span class="depth" id="depth">↓ 9.4 m <span>BELOW THE SURFACE</span></span></footer>`;
    this.overlay = this.get('overlay');
    this.enter = this.get('enter');
    this.office = this.get('office');
    this.veilElement = root.querySelector<HTMLElement>('.dive-veil')!;
    this.bubbles = root.querySelector<HTMLElement>('.dive-bubbles')!;
    // A fixed set of bubbles, animated by CSS only when a dive splashes.
    for (let i = 0; i < 22; i++) {
      const b = document.createElement('span');
      b.style.left = `${8 + ((i * 37) % 84)}%`;
      b.style.setProperty('--size', `${6 + ((i * 13) % 14)}px`);
      b.style.setProperty('--delay', `${((i * 7) % 10) * 0.04}s`);
      b.style.setProperty('--drift', `${((i * 29) % 40) - 20}px`);
      this.bubbles.append(b);
    }
    this.settingsPanel = this.get('settings-panel');
    this.status = this.get('status');
    this.depth = this.get('depth');
    const signal = this.abort.signal;
    this.enter.addEventListener('click', () => onEnter('aquarium'), { signal });
    this.office.addEventListener('click', () => onEnter('office'), { signal });
    this.get('return-tank').addEventListener('click', () => onReturnToTank(), {
      signal,
    });
    const toggle = root.querySelector<HTMLButtonElement>('.settings-toggle')!;
    const setOpen = (open: boolean): void => {
      this.settingsPanel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (open) this.get<HTMLInputElement>('sensitivity').focus();
      else toggle.focus();
    };
    toggle.addEventListener(
      'click',
      () => setOpen(Boolean(this.settingsPanel.hidden)),
      {
        signal,
      },
    );
    this.get('close-settings').addEventListener('click', () => setOpen(false), {
      signal,
    });
    this.settingsPanel.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') setOpen(false);
      },
      { signal },
    );
    // v0.4 Pass 025: the list of things seen in the outer waters (one panel open at a time).
    this.seenPanel = this.get('seen-panel');
    this.seenToggle = this.get<HTMLButtonElement>('seen-toggle');
    const setSeenOpen = (open: boolean): void => {
      this.seenPanel.hidden = !open;
      this.seenToggle.setAttribute('aria-expanded', String(open));
      if (open) {
        setOpen(false);
        this.get('close-seen').focus();
      } else this.seenToggle.focus();
    };
    this.seenToggle.addEventListener(
      'click',
      () => setSeenOpen(Boolean(this.seenPanel.hidden)),
      { signal },
    );
    this.get('close-seen').addEventListener('click', () => setSeenOpen(false), {
      signal,
    });
    this.seenPanel.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') setSeenOpen(false);
      },
      { signal },
    );
    toggle.addEventListener(
      'click',
      () => {
        if (!this.settingsPanel.hidden) {
          this.seenPanel.hidden = true;
          this.seenToggle.setAttribute('aria-expanded', 'false');
        }
      },
      { signal },
    );
    const sensitivity = this.get<HTMLInputElement>('sensitivity'),
      speed = this.get<HTMLInputElement>('speed'),
      reduced = this.get<HTMLInputElement>('reduced-motion'),
      frameTime = this.get<HTMLInputElement>('frame-time'),
      audio = this.get<HTMLInputElement>('audio-enabled'),
      volume = this.get<HTMLInputElement>('master-volume'),
      mute = this.get<HTMLButtonElement>('audio-toggle');
    const feel = this.get<HTMLSelectElement>('swimming-feel');
    feel.value = settings.swimmingFeel;
    sensitivity.value = String(settings.sensitivity);
    speed.value = String(settings.speed);
    reduced.checked = settings.reducedMotion;
    frameTime.checked = settings.frameTime;
    audio.checked = settings.audioEnabled;
    volume.value = String(Math.round(settings.masterVolume * 100));
    const update = (persist: boolean): void => {
      this.get('sensitivity-value').textContent =
        `${Number(sensitivity.value).toFixed(2)}×`;
      this.get('speed-value').textContent =
        `${Number(speed.value).toFixed(2)} m/s`;
      this.get('master-volume-value').textContent = `${volume.value}%`;
      mute.textContent = audio.checked ? 'Mute audio' : 'Enable audio';
      mute.setAttribute('aria-pressed', String(!audio.checked));
      mute.title = audio.checked ? 'Mute audio (M)' : 'Enable audio (M)';
      if (persist)
        onSettings({
          swimmingFeel:
            feel.value === 'relaxed' || feel.value === 'responsive'
              ? feel.value
              : 'natural',
          sensitivity: Number(sensitivity.value),
          speed: Number(speed.value),
          reducedMotion: reduced.checked,
          audioEnabled: audio.checked,
          masterVolume: Number(volume.value) / 100,
          frameTime: frameTime.checked,
        });
    };
    for (const input of [
      sensitivity,
      speed,
      reduced,
      frameTime,
      feel,
      audio,
      volume,
    ])
      input.addEventListener('input', () => update(true), { signal });
    const toggleAudio = (): void => {
      audio.checked = !audio.checked;
      update(true);
    };
    mute.addEventListener('click', toggleAudio, { signal });
    document.addEventListener(
      'keydown',
      (event) => {
        if (
          isAudioMuteShortcut(event) &&
          this.root.classList.contains('is-swimming')
        ) {
          event.preventDefault();
          toggleAudio();
        }
      },
      { signal },
    );
    update(false);
  }
  private get<T extends HTMLElement>(id: string): T {
    return this.root.querySelector<T>(`#${id}`)!;
  }
  get sceneHost(): HTMLElement {
    return this.get('scene');
  }
  /** Office and aquarium differ in controls, the depth readout and the entry note. */
  setMode(mode: ExperienceMode): void {
    this.mode = mode;
    this.root.dataset.mode = mode;
    this.get('controls').innerHTML =
      mode === 'office'
        ? '<span><kbd>W A S D</kbd> walk</span><span><kbd>MOUSE</kbd> look</span><span><kbd>ESC</kbd> pause</span>'
        : '<span><kbd>W A S D</kbd> swim</span><span><kbd>MOUSE</kbd> look</span><span>Look up/down + <kbd>W / S</kbd> change depth</span><span><kbd>ESC</kbd> pause</span>';
    this.get('entry-note').textContent =
      mode === 'office'
        ? 'Walk with W A S D and look around with the mouse.'
        : 'Look up or down and swim to change depth.';
  }
  setLocked(locked: boolean, entered: boolean): void {
    this.overlay.hidden = locked;
    this.root.querySelector<HTMLElement>('.swim-hud')!.hidden = !locked;
    this.root.classList.toggle('is-swimming', locked);
    this.settingsPanel.hidden = true;
    this.root
      .querySelector('.settings-toggle')!
      .setAttribute('aria-expanded', 'false');
    this.seenPanel.hidden = true;
    this.seenToggle.setAttribute('aria-expanded', 'false');
    if (!locked && entered) {
      this.root.querySelector('h1')!.innerHTML =
        'Stay a little<br><em>longer.</em>';
      this.root.querySelector('.intro')!.innerHTML =
        'The world can wait.<br>Your quiet corner is right where you left it.';
      const inOffice = this.mode === 'office';
      this.office.innerHTML = `${inOffice ? 'Return to the Office' : 'Enter the Office'} ${arrow}`;
      this.enter.innerHTML = `${inOffice ? 'Enter the Water' : 'Return to the Water'} ${arrow}`;
      // The way back to where you were is the primary action.
      this.office.classList.toggle('secondary', !inOffice);
      this.enter.classList.toggle('secondary', inOffice);
    }
    this.status.textContent = this.fatalMessage;
    if (!locked && entered)
      (this.mode === 'office' ? this.office : this.enter).focus();
  }
  /**
   * v0.3 Pass 021: the in-world action offered right now (E key), or none. Pass 022 adds a
   * one-time hint pointing new players at the tank.
   */
  setPrompt(prompt: Prompt | null): void {
    if (prompt === this.prompt) return;
    this.prompt = prompt;
    const element = this.get('dive-prompt');
    element.hidden = prompt === null;
    element.innerHTML =
      prompt === 'dive'
        ? '<kbd>E</kbd> Dive in'
        : prompt === 'surface'
          ? '<kbd>E</kbd> Return to the office'
          : prompt === 'hint'
            ? 'Walk up to the tank and look into it to dive in'
            : '';
    element.classList.toggle('is-hint', prompt === 'hint');
  }
  /** Pass 022: the optional frame-time readout; null hides it. Writes only on change. */
  setFrameTime(text: string | null): void {
    const value = text ?? '';
    if (value === this.frameText) return;
    this.frameText = value;
    const element = this.get('frame-readout');
    element.hidden = text === null;
    element.textContent = value;
  }
  /** v0.4 Pass 023: whether the player is in the outer waters (offers "Return to the tank"). */
  setOuter(outer: boolean): void {
    this.get('return-tank').hidden = !outer;
  }
  /** v0.4 Pass 023: the passage's darkness (0..1); writes only when it visibly changes. */
  setDarkness(value: number): void {
    const v = Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
    if (v === this.darkness) return;
    this.darkness = v;
    this.root.querySelector<HTMLElement>('.passage-veil')!.style.opacity =
      String(v);
  }
  /** Water-entry wash (0..1); only touches the DOM when it visibly changes. */
  setVeil(value: number): void {
    const v = Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
    if (v === this.veil) return;
    this.veil = v;
    this.veilElement.style.opacity = String(v);
  }
  /** A burst of rising bubbles as the diver enters or leaves the water. */
  burst(): void {
    this.bubbles.classList.remove('is-bursting');
    void this.bubbles.offsetWidth; // restart the CSS animation
    this.bubbles.classList.add('is-bursting');
    clearTimeout(this.burstTimer);
    this.burstTimer = setTimeout(
      () => this.bubbles.classList.remove('is-bursting'),
      1800,
    );
  }
  setDepth(depth: number): void {
    const text = depth.toFixed(1);
    if (text === this.lastDepth) return;
    this.lastDepth = text;
    this.depth.innerHTML = `↓ ${text} m <span>BELOW THE SURFACE</span>`;
  }
  /**
   * v0.4 Pass 025: a quiet note when something is seen for the first time. It fades after a
   * few seconds; a newer sighting replaces it.
   */
  noteSighting(label: string): void {
    const note = this.get('sighting-note');
    note.textContent = `New sighting \u00b7 ${label}`;
    note.hidden = false;
    note.classList.remove('is-fading');
    clearTimeout(this.noteTimer);
    this.noteTimer = setTimeout(() => {
      note.classList.add('is-fading');
      this.noteTimer = setTimeout(() => {
        note.hidden = true;
      }, SIGHTING_NOTE.fade);
    }, SIGHTING_NOTE.shown);
  }
  /**
   * v0.4 Pass 025: what has been seen, for the pause screen's "Seen" list, in the order first
   * seen. Just names and when; no counts. The list stays hidden until there is something on it.
   */
  setSeen(entries: readonly { label: string; first: string }[]): void {
    const list = this.get('seen-list'),
      date = (iso: string) => {
        const d = new Date(iso);
        return d.getTime() > 0
          ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
          : '';
      };
    list.replaceChildren(
      ...entries.map((e) => {
        const item = document.createElement('li'),
          name = document.createElement('span'),
          when = document.createElement('time');
        name.textContent = e.label;
        when.dateTime = e.first;
        when.textContent = date(e.first);
        item.append(name, when);
        return item;
      }),
    );
    this.seenToggle.hidden = entries.length === 0;
    if (!entries.length) this.seenPanel.hidden = true;
  }
  storageResult(saved: boolean): void {
    this.get('save-status').textContent = saved
      ? 'Preferences saved on this device.'
      : 'Storage unavailable. Preferences apply for this visit.';
  }
  showError(message: string, fatal = false): void {
    this.status.textContent = message;
    if (fatal) {
      this.fatalMessage = message;
      this.enter.disabled = true;
      this.office.disabled = true;
      this.enter.textContent = 'Water temporarily unavailable';
    }
  }
  audioStatus(status: AudioStatus): void {
    this.get('audio-status').textContent =
      status === 'unavailable'
        ? 'Audio is unavailable in this browser. You can keep exploring silently.'
        : status === 'blocked'
          ? 'Audio is paused by the browser. Enter again or toggle audio to retry.'
          : 'Audio begins when you enter. Press M while swimming to mute.';
  }
  dispose(): void {
    clearTimeout(this.burstTimer);
    clearTimeout(this.noteTimer);
    this.abort.abort();
    this.root.replaceChildren();
  }
}
