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
export class Interface {
  private readonly abort = new AbortController();
  private readonly overlay: HTMLElement;
  private readonly enter: HTMLButtonElement;
  private readonly settingsPanel: HTMLElement;
  private readonly status: HTMLElement;
  private readonly depth: HTMLElement;
  private lastDepth = '';
  private fatalMessage = '';

  constructor(
    readonly root: HTMLElement,
    settings: Settings,
    onEnter: () => void,
    onSettings: (settings: Settings) => void,
  ) {
    root.innerHTML = `
      <div class="scene" id="scene"></div><div class="vignette" aria-hidden="true"></div>
      <header class="topbar"><a class="brand" href="./" aria-label="Cozy Diver home">${wave}<span>COZY DIVER</span></a><span class="edition">A LITTLE WORLD. A LITTLE PEACE.</span><div class="preferences"><button id="audio-toggle" class="audio-toggle" type="button" aria-pressed="false">Mute audio</button><button class="settings-toggle" aria-expanded="false" aria-controls="settings-panel">Settings <span aria-hidden="true">⚙</span></button></div></header>
      <main class="overlay" id="overlay"><div class="welcome">
        <p class="eyebrow"><span></span> YOUR FIRST DIVE</p>
        <h1>Let the world<br>drift <em>away.</em></h1>
        <p class="intro">A quiet place beneath the surface.<br>No rush. No destination. Just you and the water.</p>
        <button class="enter" id="enter">Enter the Water ${arrow}</button>
        <p class="entry-note">Look up or down and swim to change depth.</p>
        <p class="status" id="status" role="status" aria-live="polite"></p>
      </div><div class="scene-label"><span class="label-line"></span><span>THE SUNLIT REEF AQUARIUM<small>01 / FIRST DIVE</small></span></div></main>
      <aside class="settings-panel" id="settings-panel" aria-label="Experience settings" hidden>
        <div class="panel-heading"><h2>Make yourself at home.</h2><button id="close-settings" aria-label="Close settings">×</button></div>
        <label for="sensitivity">Mouse sensitivity <output id="sensitivity-value"></output></label><input id="sensitivity" type="range" min="0.25" max="2.5" step="0.05" />
        <label for="speed">Swimming speed <output id="speed-value"></output></label><input id="speed" type="range" min="${SWIM_SPEED.min}" max="${SWIM_SPEED.max}" step="${SWIM_SPEED.step}" />
        <label for="swimming-feel">Swimming feel</label><select id="swimming-feel"><option value="relaxed">Relaxed</option><option value="natural">Natural</option><option value="responsive">Responsive</option></select>
        <label class="check"><input id="reduced-motion" type="checkbox" />Reduced camera motion</label><p>Direct mouse-look, with plant and particle motion still. Breathing buoyancy and subtle swimming sway are suppressed.</p>
        <label class="check"><input id="audio-enabled" type="checkbox" />Ambient audio</label>
        <label for="master-volume">Master volume <output id="master-volume-value"></output></label><input id="master-volume" type="range" min="0" max="100" step="1" />
        <p id="audio-status" role="status">Audio begins when you enter. Press M while swimming to mute.</p>
        <p class="save-status" id="save-status" role="status">Preferences saved on this device.</p>
      </aside>
      <div class="swim-hud" hidden><span class="crosshair" aria-hidden="true">·</span><span class="hud-message">You have nowhere else to be.</span></div>
      <footer class="bottom-bar"><div class="controls" aria-label="Swimming controls"><span><kbd>W A S D</kbd> swim</span><span><kbd>MOUSE</kbd> look</span><span>Look up/down + <kbd>W / S</kbd> change depth</span><span><kbd>ESC</kbd> pause</span></div><span class="depth" id="depth">↓ 9.4 m <span>BELOW THE SURFACE</span></span></footer>`;
    this.overlay = this.get('overlay');
    this.enter = this.get('enter');
    this.settingsPanel = this.get('settings-panel');
    this.status = this.get('status');
    this.depth = this.get('depth');
    const signal = this.abort.signal;
    this.enter.addEventListener('click', onEnter, { signal });
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
    const sensitivity = this.get<HTMLInputElement>('sensitivity'),
      speed = this.get<HTMLInputElement>('speed'),
      reduced = this.get<HTMLInputElement>('reduced-motion'),
      audio = this.get<HTMLInputElement>('audio-enabled'),
      volume = this.get<HTMLInputElement>('master-volume'),
      mute = this.get<HTMLButtonElement>('audio-toggle');
    const feel = this.get<HTMLSelectElement>('swimming-feel');
    feel.value = settings.swimmingFeel;
    sensitivity.value = String(settings.sensitivity);
    speed.value = String(settings.speed);
    reduced.checked = settings.reducedMotion;
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
        });
    };
    for (const input of [sensitivity, speed, reduced, feel, audio, volume])
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
  setLocked(locked: boolean, entered: boolean): void {
    this.overlay.hidden = locked;
    this.root.querySelector<HTMLElement>('.swim-hud')!.hidden = !locked;
    this.root.classList.toggle('is-swimming', locked);
    this.settingsPanel.hidden = true;
    this.root
      .querySelector('.settings-toggle')!
      .setAttribute('aria-expanded', 'false');
    if (!locked && entered) {
      this.root.querySelector('h1')!.innerHTML =
        'Stay a little<br><em>longer.</em>';
      this.root.querySelector('.intro')!.innerHTML =
        'The world can wait.<br>Your quiet corner is right where you left it.';
      this.enter.innerHTML = `Return to the Water ${arrow}`;
    }
    this.status.textContent = this.fatalMessage;
    if (!locked && entered) this.enter.focus();
  }
  setDepth(depth: number): void {
    const text = depth.toFixed(1);
    if (text === this.lastDepth) return;
    this.lastDepth = text;
    this.depth.innerHTML = `↓ ${text} m <span>BELOW THE SURFACE</span>`;
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
    this.abort.abort();
    this.root.replaceChildren();
  }
}
