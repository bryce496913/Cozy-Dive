import * as THREE from 'three';
import type { UnderwaterScene } from '../rendering/UnderwaterScene';
import type { Sighting } from '../discovery/journal';
import {
  TankCatalog,
  loadTank,
  saveTank,
  unlockedItems,
  itemCollider,
  targetTankItem,
  type TankKind,
} from './catalog';
import { tankContext } from './TankContext';
import { TankDecoration } from '../environment/TankDecoration';
import { insideRock, safeFishPosition } from '../fish/FishHabitat';

export interface EditorState {
  eligible: boolean;
  active: boolean;
  eye: Readonly<{ x: number; y: number; z: number }>;
  yaw: number;
  pitch: number;
  time: number;
}
/** Owns catalog DOM and editing input; application supplies world eligibility and explicit resume. */
export class TankEditor {
  readonly decoration: TankDecoration;
  model?: TankCatalog;
  readonly ready: Promise<void>;
  private readonly abort = new AbortController();
  private readonly panel = document.createElement('aside');
  private readonly toggle = document.createElement('button');
  private readonly hint = document.createElement('p');
  private readonly reset = document.createElement('button');
  private readonly confirmation = document.createElement('div');
  private readonly notice = document.createElement('p');
  private current?: EditorState;
  private selected?: string;
  private artReady = false;
  private disposed = false;
  private colliders: ReturnType<typeof itemCollider>[] = [];
  private lastHint = '';
  private lastProbe = -Infinity;
  private readonly direction = new THREE.Vector3();
  constructor(
    private readonly root: HTMLElement,
    private readonly world: UnderwaterScene,
    private readonly seen: () => readonly Sighting[],
    private readonly resume: () => void,
  ) {
    this.decoration = new TankDecoration(
      world.reefLoader,
      world.aquarium.plants.material,
    );
    world.aquarium.root.add(this.decoration.root);
    world.decoration = this.decoration;
    this.toggle.textContent = 'For your tank';
    this.toggle.className = 'seen-toggle';
    this.toggle.hidden = true;
    root.querySelector('.welcome')!.append(this.toggle);
    this.panel.className = 'settings-panel tank-catalog';
    this.panel.hidden = true;
    this.panel.setAttribute('aria-label', 'For your tank');
    this.hint.className = 'dive-prompt';
    this.hint.hidden = true;
    this.hint.setAttribute('role', 'status');
    this.notice.setAttribute('role', 'status');
    this.notice.className = 'status';
    root.append(this.panel, this.hint);
    root.querySelector('.welcome')!.append(this.notice);
    this.reset.textContent = 'Restore the original tank';
    this.reset.type = 'button';
    this.reset.disabled = true;
    this.confirmation.hidden = true;
    this.confirmation.innerHTML =
      '<p>Remove your added corals and plants? Your sightings stay.</p><button type="button" data-confirm>Restore tank</button><button type="button" data-cancel>Keep my tank</button>';
    root
      .querySelector('#settings-panel')!
      .append(this.reset, this.confirmation);
    const signal = this.abort.signal;
    for (const button of root.querySelectorAll('.settings-toggle,#seen-toggle'))
      button.addEventListener(
        'click',
        () => {
          this.panel.hidden = true;
          this.toggle.setAttribute('aria-expanded', 'false');
        },
        { signal },
      );
    this.reset.addEventListener(
      'click',
      () => {
        this.confirmation.hidden = false;
        this.confirmation
          .querySelector<HTMLButtonElement>('[data-cancel]')!
          .focus();
      },
      { signal },
    );
    this.confirmation.querySelector('[data-cancel]')!.addEventListener(
      'click',
      () => {
        this.confirmation.hidden = true;
        this.reset.focus();
      },
      { signal },
    );
    this.confirmation.querySelector('[data-confirm]')!.addEventListener(
      'click',
      () => {
        this.model?.reset();
        this.changed();
        this.confirmation.hidden = true;
        this.reset.focus();
      },
      { signal },
    );
    this.toggle.addEventListener('click', () => this.open(), { signal });
    this.panel.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          this.close();
        }
      },
      { signal },
    );
    document.addEventListener('keydown', this.key, { signal });
    this.ready = world.prepared
      .then(async () => {
        if (this.disposed) return;
        const context = tankContext(world.aquarium);
        // Use the visible authored rock surface rather than a coarse procedural support hull.
        const origin = new THREE.Vector3(),
          down = new THREE.Vector3(0, -1, 0),
          base = context.surface;
        const surface = (x: number, z: number) => {
          origin.set(x, 13, z);
          const d = world.reef.rockSurfaceDistance(origin, down, 14);
          return d === undefined ? base(x, z) : 13 - d;
        };
        const actual = { ...context, surface };
        let items: ReturnType<typeof loadTank> = [];
        try {
          items = loadTank(localStorage, this.seen(), actual);
        } catch {
          /* unavailable storage */
        }
        if (this.disposed) return;
        this.model = new TankCatalog(items, actual);
        this.reset.disabled = false;
        this.artReady = await this.decoration.prepare();
        if (this.disposed) return;
        if (this.artReady) this.changed(false);
        else
          this.notice.textContent =
            'Tank details could not load. You can keep exploring and your saved additions are unchanged.';
      })
      .catch((error) => {
        if (!this.disposed) {
          this.notice.textContent =
            'Tank decorating is temporarily unavailable. You can keep exploring.';
          console.warn('Cozy Diver: tank catalog unavailable.', error);
        }
      });
  }
  private open() {
    if (!this.current?.eligible || this.current.active || !this.model) return;
    this.root.querySelector<HTMLElement>('#settings-panel')!.hidden = true;
    this.root.querySelector<HTMLElement>('#seen-panel')!.hidden = true;
    this.panel.replaceChildren();
    const h = document.createElement('h2');
    h.textContent = 'For your tank';
    const close = document.createElement('button');
    close.textContent = 'Close';
    close.onclick = () => this.close();
    this.panel.append(h, close);
    const items = unlockedItems(this.seen());
    if (!items.length) {
      const p = document.createElement('p');
      p.textContent = 'Things you see beyond the tank can find a home here.';
      this.panel.append(p);
    }
    for (const item of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = item.label;
      b.disabled = !this.artReady;
      b.onclick = () => this.choose(item.kind);
      this.panel.append(b);
    }
    this.panel.hidden = false;
    this.toggle.setAttribute('aria-expanded', 'true');
    close.focus();
  }
  private close() {
    this.panel.hidden = true;
    this.toggle.setAttribute('aria-expanded', 'false');
    this.toggle.focus();
  }
  private choose(kind: TankKind) {
    if (
      !this.current?.eligible ||
      this.current.active ||
      !this.model ||
      !this.artReady
    )
      return;
    if (!this.model.begin(kind)) {
      this.notice.textContent = 'The tank feels full here';
      return;
    }
    this.notice.textContent = '';
    this.close();
    this.resume();
  }
  private changed(persist = true) {
    if (!this.model) return;
    this.decoration.rebuild(this.model.items);
    const next = this.decoration.colliders;
    this.world.aquarium.replacePresentationColliders(this.colliders, next);
    this.colliders = next;
    // Restored items can occupy water where a fish was initialized before assets settled.
    // Re-seat only obstructed fish, once per edit, never during simulation frames.
    for (const f of this.world.aquarium.fish.simulation.fish) {
      const habitat = this.world.aquarium.fish.simulation.habitat;
      if (safeFishPosition(f.position, f.radius, habitat)) continue;
      let found = false;
      for (let r = 0.25; r <= 4 && !found; r += 0.25)
        for (const axis of [
          { x: 0, y: 1, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: -1, y: 0, z: 0 },
          { x: 0, y: 0, z: 1 },
          { x: 0, y: 0, z: -1 },
        ]) {
          const p = {
            x: f.position.x + axis.x * r,
            y: f.position.y + axis.y * r,
            z: f.position.z + axis.z * r,
          };
          if (!safeFishPosition(p, f.radius + 0.05, habitat)) continue;
          Object.assign(f.position, p);
          Object.assign(f.previousPosition, p);
          Object.assign(f.target, p);
          found = true;
          break;
        }
    }

    if (persist) {
      let saved = false;
      try {
        saved = saveTank(localStorage, this.model.items);
      } catch {
        /* unavailable storage */
      }
      this.notice.textContent = saved
        ? ''
        : 'Storage unavailable. Your tank changes last for this visit.';
    }
  }
  locked(locked: boolean) {
    if (!locked) {
      if (this.current) this.current.active = false;
      this.selected = undefined;
      this.hint.hidden = true;
      this.model?.cancel();
      this.decoration.showPreview(null, false);
    }
    this.panel.hidden = true;
    this.confirmation.hidden = true;
  }
  suspend() {
    this.locked(false);
    if (this.current) this.current.eligible = false;
    this.toggle.hidden = true;
  }
  update(state: EditorState) {
    this.current = state;
    this.toggle.hidden = !state.eligible;
    const model = this.model;
    if (!model || !state.eligible || !state.active) {
      this.hint.hidden = true;
      this.decoration.showPreview(null, false);
      if (!state.eligible) {
        model?.cancel();
        this.panel.hidden = true;
      }
      return;
    }
    if (state.time - this.lastProbe < 0.08) return;
    this.lastProbe = state.time;
    const { eye, yaw, pitch } = state;
    this.direction.set(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    );
    this.selected = targetTankItem(
      model.items,
      this.colliders,
      this.world.aquarium.collision.colliders,
      eye,
      this.direction,
    );
    if (model.preview) {
      // Short ray march against sand/rock tops: aim down to seat nearby, never decorate across the tank.
      let x = eye.x + this.direction.x * 4,
        z = eye.z + this.direction.z * 4,
        y = model.context.surface(x, z);
      for (let d = 0.5; d <= 5; d += 0.1) {
        const px = eye.x + this.direction.x * d,
          pz = eye.z + this.direction.z * d,
          py = eye.y + this.direction.y * d,
          top = model.context.surface(px, pz);
        if (py <= top) {
          x = px;
          z = pz;
          y = top;
          break;
        }
      }
      model.aim({ x, y, z });
      this.decoration.showPreview(model.preview, this.canPlace());
      this.setHint('R turn · F place · Esc cancel');
    } else {
      this.decoration.showPreview(null, false);
      this.setHint(this.selected ? 'G move · X remove' : '');
    }
  }
  private canPlace() {
    const m = this.model;
    if (!m?.preview || !m.valid) return false;
    const collider = itemCollider(m.preview),
      q = this.world.aquarium;
    if (this.current && insideRock(this.current.eye, 0.65, collider))
      return false;
    return !q.fish.simulation.fish.some((f) =>
      insideRock(f.position, f.radius + 0.1, collider),
    );
  }
  private setHint(text: string) {
    if (text !== this.lastHint) {
      this.lastHint = text;
      this.hint.textContent = text;
    }
    this.hint.hidden = !text;
  }
  private key = (e: KeyboardEvent) => {
    if (
      !this.current?.eligible ||
      !this.current.active ||
      document.pointerLockElement !== this.world.renderer.domElement ||
      e.repeat ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      !this.model
    )
      return;
    const m = this.model;
    if (m.preview && e.code === 'KeyR') {
      m.turn();
      e.preventDefault();
    } else if (m.preview && e.code === 'KeyF') {
      if (this.canPlace() && m.place()) this.changed();
      e.preventDefault();
    } else if (!m.preview && this.selected && e.code === 'KeyG') {
      m.move(this.selected);
      e.preventDefault();
    } else if (!m.preview && this.selected && e.code === 'KeyX') {
      m.remove(this.selected);
      this.changed();
      e.preventDefault();
    }
  };
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.world.aquarium.replacePresentationColliders(this.colliders, []);
    this.decoration.dispose();
    this.world.decoration = undefined;
    for (const el of [
      this.panel,
      this.toggle,
      this.hint,
      this.reset,
      this.confirmation,
      this.notice,
    ])
      el.remove();
  }
}
