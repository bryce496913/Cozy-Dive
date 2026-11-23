import { TankBabies } from '../environment/TankBabies';
import { keepFocusIn } from '../ui/focus';
import { TankBabyHabitat } from '../environment/TankBabyHabitat';
import type { TankCreatureId } from '../config/babies';
import * as THREE from 'three';
import type { UnderwaterScene } from '../rendering/UnderwaterScene';
import type { Sighting } from '../discovery/journal';
import {
  TankCatalog,
  keptEntries,
  loadTankFish,
  loadTankState,
  NO_KEPT,
  type KeptEntries,
  saveTank,
  itemCollider,
  targetTankItem,
  type TankKind,
} from './catalog';
import { tankContext } from './TankContext';
import { TankFish } from '../environment/TankFish';
import type { SpeciesId } from '../fish/FishSpecies';
import type { FishEntity } from '../fish/FishEntity';
import { renderCatalog } from './TankCatalogPanel';
import type { AlbumTank } from '../ui/album/Album';
import { canAddToTank } from '../collection/registry';
import { BABY_CAP } from '../config/babies';
import { fishDefinition, fishRoom } from './fishCatalog';
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
  /** V0.8 Pass 099: opens the field album with this aquarium's actions (set by the application). */
  onAlbum?: (tank: AlbumTank) => void;
  private selected?: string;
  private artReady = false;
  private disposed = false;
  private colliders: ReturnType<typeof itemCollider>[] = [];
  /** Saved entries this visit could not show; written back so they are never erased. */
  private kept: KeptEntries = NO_KEPT;
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
      '<p>Remove your added corals, plants and stones, and return the added fish and little visitors to the sea? Your sightings and settings stay.</p><button type="button" data-confirm>Restore tank</button><button type="button" data-cancel>Keep my tank</button>';
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
        // Restoring the tank removes every addition, including any kept unseen.
        this.kept = this.kept.newer ? this.kept : NO_KEPT;
        this.world.babies?.dispose();
        this.world.babies = undefined;
        this.fishChanged(false);
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
        } else keepFocusIn(this.panel, e);
      },
      { signal },
    );
    document.addEventListener('keydown', this.key, { signal });
    // A left click places, too (while swimming, with the mouse captured).
    document.addEventListener(
      'mousedown',
      (e) => {
        if (e.button !== 0 || !this.editing()) return;
        const m = this.model;
        if (m?.preview && this.canPlace() && m.place()) this.changed();
      },
      { signal },
    );
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
        let saved: ReturnType<typeof loadTankState> = { items: [], babies: [] },
          fish: ReturnType<typeof loadTankFish> = {};
        try {
          saved = loadTankState(localStorage, this.seen(), actual);
          fish = loadTankFish(localStorage, this.seen());
          this.kept = keptEntries(localStorage, saved, this.seen());
        } catch {
          /* unavailable storage */
        }
        if (this.disposed) return;
        this.model = new TankCatalog(saved.items, actual, saved.babies, fish);
        this.reset.disabled = false;
        if (this.kept.newer)
          this.notice.textContent =
            'This tank was saved by a newer version of Cozy Diver, so it is left as it is. Your changes last for this visit.';
        this.artReady = await this.decoration.prepare();
        if (this.disposed) return;
        if (this.artReady) this.changed(false);
        else
          this.notice.textContent =
            'Tank details could not load. You can keep exploring and your saved additions are unchanged.';
        this.babiesChanged(false);
        this.fishChanged(false);
      })
      .catch((error) => {
        if (!this.disposed) {
          this.notice.textContent =
            'Tank decorating is temporarily unavailable. You can keep exploring.';
          console.warn('Cozy Diver: tank catalog unavailable.', error);
        }
      });
  }
  private open(focusKey?: string) {
    if (!this.current?.eligible || this.current.active || !this.model) return;
    this.root.querySelector<HTMLElement>('#settings-panel')!.hidden = true;
    this.root.querySelector<HTMLElement>('#seen-panel')!.hidden = true;
    const focus = renderCatalog(
      this.panel,
      this.model,
      this.seen(),
      this.artReady,
      {
        choose: (kind) => this.choose(kind),
        baby: (id) => this.chooseBaby(id),
        fish: (species, add) => this.chooseFish(species, add),
        album: () => {
          this.panel.hidden = true;
          this.toggle.setAttribute('aria-expanded', 'false');
          this.onAlbum?.(this.albumTank());
        },
        undo: () => {
          this.undo();
          this.open('undo');
        },
        close: () => this.close(),
      },
      focusKey,
    );
    this.panel.hidden = false;
    this.toggle.setAttribute('aria-expanded', 'true');
    focus.focus();
  }
  /** Both fish populations: the tank's own and the ones the swimmer added. */
  private allFish(): readonly FishEntity[] {
    const home = this.world.aquarium.fish.simulation.fish,
      added = this.world.tankFish?.bodies ?? [];
    return added.length ? [...home, ...added] : home;
  }
  /** v0.6 Pass 051: add or return one fish, staying in the panel (focus kept on the button). */
  private chooseFish(species: SpeciesId, add: boolean) {
    if (!this.current?.eligible || this.current.active || !this.model) return;
    if (add) {
      const room = this.model.addFish(species, this.seen());
      if (!room.ok) {
        this.notice.textContent = room.reason;
        return;
      }
    } else if (!this.model.removeFish(species)) return;
    this.notice.textContent = '';
    if (!this.fishChanged()) this.model.undo();
    this.open(`fish-${add ? 'add' : 'remove'}-${species}`);
  }
  /**
   * Rebuild the added fish for the model's counts. If the tank cannot seat them, nothing changes
   * and false is returned (the caller steps the model back).
   */
  private fishChanged(persist = true): boolean {
    if (!this.model) return false;
    const counts = this.model.fish;
    if (!this.world.tankFish && Object.keys(counts).length) {
      const fish = new TankFish(
        this.world.authored.loader,
        this.world.aquarium.fish.simulation.habitat,
        this.world.aquarium.fish.simulation.fish,
        (message) => {
          if (!this.disposed) this.notice.textContent = message;
        },
      );
      this.world.tankFish = fish;
      this.world.aquarium.root.add(fish.root);
    }
    if (this.world.tankFish && !this.world.tankFish.set(counts)) return false;
    if (persist) this.persist();
    return true;
  }
  /** Step back one change and bring everything in line with it. */
  private undo() {
    const m = this.model;
    if (!m?.undo()) return;
    this.decoration.showPreview(null, false);
    this.changed(false);
    if (!m.babies.length) {
      this.world.babies?.dispose();
      this.world.babies = undefined;
    }
    this.babiesChanged(false);
    this.fishChanged(false);
    this.persist();
  }
  /**
   * V0.8 Pass 099: the aquarium's side of the field album. Every action goes through the same
   * catalog, placement and capacity rules and saves as before; the album stays open on its page.
   */
  albumTank(): AlbumTank {
    const here = () =>
      !!(this.current?.eligible && !this.current.active && this.model);
    const away = 'Visit your aquarium to add it there.';
    return {
      state: (entry) => {
        const t = entry.tank,
          m = this.model,
          seen = this.seen();
        if (!t || t.slot === 'decoration') return undefined;
        if (t.slot === 'animal') {
          const placed = m?.babies.includes(t.key) ? 1 : 0,
            room = !!m && m.babies.length < BABY_CAP,
            canAdd = here() && canAddToTank(entry, seen) && room;
          return {
            canAdd,
            placed,
            max: 1,
            reason: !here()
              ? away
              : !room
                ? 'The aquarium has all the visitors it can hold for now.'
                : undefined,
          };
        }
        const placed = m?.fish[t.key] ?? 0,
          room = m ? fishRoom(m.fish, t.key, seen) : undefined;
        return {
          canAdd: here() && !!room?.ok,
          placed,
          max: fishDefinition(t.key)?.max ?? 0,
          reason: !here() ? away : room && !room.ok ? room.reason : undefined,
        };
      },
      add: (entry) => {
        const t = entry.tank,
          m = this.model,
          seen = this.seen();
        if (!here() || !m || !t || t.slot === 'decoration') return away;
        if (t.slot === 'animal') {
          if (!canAddToTank(entry, seen) || !m.addBaby(t.key, seen))
            return 'There is no room for another visitor just now.';
          this.babiesChanged();
          return `${entry.name} will be waiting in your aquarium.`;
        }
        const room = m.addFish(t.key, seen);
        if (!room.ok) return room.reason;
        if (!this.fishChanged()) {
          m.undo();
          return 'The aquarium cannot seat another just now.';
        }
        return `A ${entry.name.toLowerCase()} joins your aquarium.`;
      },
      remove: (entry) => {
        const t = entry.tank,
          m = this.model;
        if (!here() || !m || !t || t.slot === 'decoration') return away;
        if (t.slot === 'animal') {
          if (!m.babies.includes(t.key)) return '';
          m.removeBaby(t.key);
          this.babiesChanged();
          return `${entry.name} returns to the sea.`;
        }
        if (!m.removeFish(t.key)) return '';
        this.fishChanged();
        return `A ${entry.name.toLowerCase()} returns to the sea.`;
      },
    };
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
  private chooseBaby(id: TankCreatureId) {
    if (!this.current?.eligible || this.current.active || !this.model) return;
    if (this.model.babies.includes(id)) this.model.removeBaby(id);
    else if (!this.model.addBaby(id, this.seen())) return;
    this.babiesChanged();
    this.close();
    this.resume();
  }
  private babiesChanged(persist = true) {
    if (!this.model) return;
    if (this.model.babies.length && !this.world.babies) {
      const babies = new TankBabies(
        this.world.authored.loader,
        new TankBabyHabitat(this.world.aquarium, this.model.context),
        this.world.aquarium.fish.simulation.habitat,
        (message) => {
          if (!this.disposed) this.notice.textContent = message;
        },
        this.world.aquarium.fish.simulation.fish,
      );
      this.world.babies = babies;
      this.world.aquarium.root.add(babies.root);
    }
    this.world.babies?.set(
      this.model.babies,
      this.current?.eye ?? this.world.camera.position,
    );
    if (persist) this.persist();
  }
  private persist() {
    if (!this.model) return;
    let saved = false;
    try {
      saved = saveTank(
        localStorage,
        this.model.items,
        this.model.babies,
        this.kept,
        this.model.fish,
      );
    } catch {
      /* unavailable storage */
    }
    this.notice.textContent = saved
      ? ''
      : this.kept.newer
        ? 'This tank was saved by a newer version of Cozy Diver, so it is left as it is. Your changes last for this visit.'
        : 'Storage unavailable. Your tank changes last for this visit.';
  }
  private changed(persist = true) {
    if (!this.model) return;
    this.decoration.rebuild(this.model.items);
    const next = this.decoration.colliders;
    this.world.aquarium.replacePresentationColliders(this.colliders, next);
    this.colliders = next;
    // Restored items can occupy water where a fish was initialized before assets settled.
    // Re-seat only obstructed fish, once per edit, never during simulation frames.
    for (const f of this.allFish()) {
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

    this.world.babies?.replan();
    if (persist) this.persist();
  }

  locked(locked: boolean) {
    this.lastProbe = -Infinity;
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
      // Far enough to reach the sand from a normal swimming height while looking down.
      for (let d = 0.5; d <= 9; d += 0.1) {
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
      // If it does not fit where it is aimed, slide it to the nearest spot nearby that it does.
      if (!model.valid) this.snap(model, x, z);
      const ok = this.canPlace();
      this.decoration.showPreview(model.preview, ok);
      this.setHint(
        ok
          ? 'R turn (Shift+R back) · F or click to place · Z or Esc cancel'
          : model.valid
            ? 'Wait for the fish to pass · Esc cancel'
            : 'Too close to rock, the sand channel or a fish route — look for open sand · Esc cancel',
      );
    } else {
      this.decoration.showPreview(null, false);
      this.setHint(
        this.selected
          ? `G move · X remove${model.canUndo ? ' · Z undo' : ''}`
          : model.canUndo
            ? 'Z undo'
            : '',
      );
    }
  }
  /** Try spots in widening rings around (x, z), and keep the first one that is valid. */
  private snap(model: TankCatalog, x: number, z: number): void {
    const surface = model.context.surface;
    for (let r = 0.3; r <= 2.4; r += 0.3)
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + r,
          px = x + Math.cos(a) * r,
          pz = z + Math.sin(a) * r;
        model.aim({ x: px, y: surface(px, pz), z: pz });
        if (model.valid) return;
      }
    // Nothing fits nearby: leave it where it was aimed (shown as blocked).
    model.aim({ x, y: surface(x, z), z });
  }
  private canPlace() {
    const m = this.model;
    if (!m?.preview || !m.valid) return false;
    const collider = itemCollider(m.preview);
    if (this.world.babies?.intersects(collider)) return false;
    if (this.current && insideRock(this.current.eye, 0.65, collider))
      return false;
    // Checked against both populations without building a combined list (runs while aiming).
    const clear = (f: FishEntity) =>
      !insideRock(f.position, f.radius + 0.1, collider);
    return (
      this.world.aquarium.fish.simulation.fish.every(clear) &&
      (this.world.tankFish?.bodies ?? []).every(clear)
    );
  }
  private setHint(text: string) {
    if (text !== this.lastHint) {
      this.lastHint = text;
      this.hint.textContent = text;
    }
    this.hint.hidden = !text;
  }
  /** Whether editing input applies now: in the tank, swimming, with the mouse captured. */
  private editing(): boolean {
    return (
      !!this.current?.eligible &&
      this.current.active &&
      document.pointerLockElement === this.world.renderer.domElement &&
      !!this.model
    );
  }
  private key = (e: KeyboardEvent) => {
    if (!this.editing() || e.repeat || e.ctrlKey || e.metaKey || e.altKey)
      return;
    if (!this.model) return;
    const m = this.model;
    if (m.preview && e.code === 'KeyR') {
      m.turn(e.shiftKey ? -1 : 1);
      e.preventDefault();
    } else if (e.code === 'KeyZ') {
      // Z: with a preview, put it down unplaced (a move keeps the original); otherwise undo.
      if (m.preview) m.cancel();
      else this.undo();
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
