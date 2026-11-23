import {
  AlbumPreviews,
  type PreviewLoaders,
} from '../../collection/AlbumPreviews';
import {
  SPREADS,
  firstSpread,
  lastSpread,
  rememberSpread,
  sectionOf,
  turn,
} from '../../collection/albumPages';
import { DESCRIPTIONS } from '../../collection/descriptions';
import {
  ALBUM_SECTIONS,
  SECTION_NAMES,
  isDiscovered,
  sectionProgress,
  type CollectionEntry,
  type Rarity,
} from '../../collection/registry';
import type { Sighting } from '../../discovery/journal';
import { keepFocusIn } from '../focus';

/**
 * V0.8 Pass 099: the field album. One bound book of collectible cards, a spread at a time: a
 * contents spread, then each habitat's pages (six cards a page). It replaces the "Seen" list and
 * the tank's creature lists; the tank's decorations keep their own panel.
 *
 * - Discovered cards show the animal's own model (see `AlbumPreviews`), its name, habitat, rarity
 *   and a short note. Unseen cards are plain mysteries: no name, model or rarity.
 * - Opening a card shows it large; drag (or the arrow buttons) to turn the model. If the album was
 *   opened with an aquarium, the card offers to add the animal, or return it.
 * - Turn pages with the arrow buttons, the ← → (or Page Up / Down) keys, or a sideways swipe;
 *   jump with the habitat tabs. The last page shown is kept for this visit.
 * - Keyboard: Tab stays inside the album; Escape closes the open card, then the album. Reduced
 *   motion turns pages without the page-turn movement and stills the models.
 */

/** What the album needs to know about the aquarium, when it was opened from (or near) it. */
export interface AlbumTankState {
  /** Whether it can be added right now (and if not, a calm reason). */
  readonly canAdd: boolean;
  /** How many are in the tank (0 or 1 for animals; a count for fish), and the most allowed. */
  readonly placed: number;
  readonly max: number;
  readonly reason?: string;
}
export interface AlbumTank {
  state(entry: CollectionEntry): AlbumTankState | undefined;
  add(entry: CollectionEntry): string;
  remove(entry: CollectionEntry): string;
}
export interface AlbumOptions {
  readonly loaders: PreviewLoaders;
  readonly seen: () => readonly Sighting[];
  readonly reducedMotion: () => boolean;
}

const RARITY_LABEL: Readonly<Record<Rarity, string>> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
};
const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};
const button = (className: string, text: string, label?: string) => {
  const b = el('button', className, text);
  b.type = 'button';
  if (label) b.setAttribute('aria-label', label);
  return b;
};
/** Card canvases (CSS pixels); the detail view is larger. */
const CARD = { w: 200, h: 140 } as const,
  DETAIL = { w: 520, h: 360 } as const;
const TURN_MS = 420;

export class Album {
  readonly root = el('div', 'album-backdrop');
  private readonly book = el('div', 'album');
  private readonly tabs = el('nav', 'album-tabs');
  private readonly spread = el('div', 'album-spread');
  private readonly prev = button('album-turn album-prev', '‹', 'Previous page');
  private readonly next = button('album-turn album-next', '›', 'Next page');
  private readonly closer = button('album-close', 'Close', 'Close the album');
  private readonly back = button('album-back', 'Back', 'Back to the page');
  private readonly status = el('p', 'album-status');
  private readonly detail = el('div', 'album-detail');
  private readonly abort = new AbortController();
  private previews?: AlbumPreviews;
  private tank?: AlbumTank;
  private index = 0;
  private open_ = false;
  private frame = 0;
  private opener?: HTMLElement;
  private selected?: CollectionEntry;
  private swipeX?: number;
  private turning?: ReturnType<typeof setTimeout>;

  constructor(
    host: HTMLElement,
    private readonly options: AlbumOptions,
  ) {
    const r = this.root;
    r.hidden = true;
    r.setAttribute('role', 'dialog');
    r.setAttribute('aria-modal', 'true');
    r.setAttribute('aria-labelledby', 'album-title');
    const header = el('header', 'album-header'),
      title = el('h2', 'album-title', 'Field Album');
    title.id = 'album-title';
    this.status.setAttribute('role', 'status');
    this.back.hidden = true;
    header.append(title, this.status, this.back, this.closer);
    this.tabs.setAttribute('aria-label', 'Habitats');
    const bookRow = el('div', 'album-book');
    this.spread.setAttribute('aria-live', 'polite');
    bookRow.append(this.prev, this.spread, this.next);
    this.detail.hidden = true;
    this.detail.setAttribute('role', 'group');
    this.book.append(header, this.tabs, bookRow, this.detail);
    r.append(this.book);
    host.append(r);
    const signal = this.abort.signal;
    this.prev.addEventListener('click', () => this.go(this.index - 1), {
      signal,
    });
    this.next.addEventListener('click', () => this.go(this.index + 1), {
      signal,
    });
    this.closer.addEventListener('click', () => this.close(), { signal });
    this.back.addEventListener('click', () => this.closeDetail(), { signal });
    // Keys reach the album wherever focus is (a drag on the model can leave it on the page),
    // and before the game's own keys while it is open.
    document.addEventListener(
      'keydown',
      (e) => {
        if (this.open_) this.key(e);
      },
      { signal, capture: true },
    );
    // A sideways swipe turns the page (pointer: mouse, pen or touch).
    this.spread.addEventListener(
      'pointerdown',
      (e) => {
        this.swipeX = e.clientX;
      },
      { signal },
    );
    this.spread.addEventListener(
      'pointerup',
      (e) => {
        if (this.swipeX === undefined) return;
        const dx = e.clientX - this.swipeX;
        this.swipeX = undefined;
        if (Math.abs(dx) > 60) this.go(this.index + (dx < 0 ? 1 : -1));
      },
      { signal },
    );
  }
  get isOpen(): boolean {
    return this.open_;
  }
  /** The spread now shown (for tests and the harness). */
  get page(): number {
    return this.index;
  }
  /**
   * Open the album where it was last left this visit (or at `section`). `tank` offers the
   * aquarium's add and return actions; without it the cards are for looking only.
   */
  open(
    options: {
      tank?: AlbumTank;
      section?: (typeof ALBUM_SECTIONS)[number];
    } = {},
  ): void {
    this.tank = options.tank;
    this.opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;
    this.previews ??= new AlbumPreviews(this.options.loaders);
    this.open_ = true;
    this.root.hidden = false;
    this.index = options.section ? firstSpread(options.section) : lastSpread();
    this.status.textContent = '';
    this.render();
    this.closer.focus();
    const loop = (ms: number) => {
      if (!this.open_) return;
      this.previews?.frame(ms / 1000, this.options.reducedMotion());
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }
  /** Close: every preview model and the preview renderer (its WebGL context) are released. */
  close(): void {
    if (!this.open_) return;
    this.open_ = false;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.turning);
    this.closeDetail(false);
    this.previews?.dispose();
    this.previews = undefined;
    this.root.hidden = true;
    this.spread.replaceChildren();
    this.opener?.focus();
  }
  /** Turn to spread `index` (clamped), with the page-turn movement unless motion is reduced. */
  go(index: number): void {
    const to = turn(index, 0);
    if (to === this.index || !this.open_) return;
    const forward = to > this.index;
    this.index = to;
    rememberSpread(to);
    this.closeDetail(false);
    this.render();
    if (!this.options.reducedMotion()) {
      this.spread.classList.remove('turn-next', 'turn-prev');
      // Restart the animation.
      void this.spread.offsetWidth;
      this.spread.classList.add(forward ? 'turn-next' : 'turn-prev');
      clearTimeout(this.turning);
      this.turning = setTimeout(
        () => this.spread.classList.remove('turn-next', 'turn-prev'),
        TURN_MS,
      );
    }
  }
  private key(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (!this.detail.hidden) this.closeDetail();
      else this.close();
      return;
    }
    if (this.detail.hidden) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        this.go(this.index + 1);
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        this.go(this.index - 1);
        return;
      }
    }
    keepFocusIn(this.book, e);
  }
  private render(): void {
    const seen = this.options.seen(),
      at = SPREADS[this.index],
      current = sectionOf(this.index);
    // Tabs: the contents and each habitat, with its count.
    this.tabs.replaceChildren(
      ...[
        {
          label: 'Contents',
          name: 'Contents',
          to: 0,
          active: at.kind === 'contents',
        },
        ...ALBUM_SECTIONS.map((s) => {
          const p = sectionProgress(s, seen);
          return {
            label: `${SECTION_NAMES[s]} ${p.discovered}/${p.total}`,
            name: `${SECTION_NAMES[s]}, ${p.discovered} of ${p.total} found`,
            to: firstSpread(s),
            active: current === s,
          };
        }),
      ].map((t) => {
        const b = button('album-tab', t.label, t.name);
        if (t.active) b.setAttribute('aria-current', 'page');
        b.addEventListener('click', () => this.go(t.to));
        return b;
      }),
    );
    this.prev.disabled = this.index === 0;
    this.next.disabled = this.index === SPREADS.length - 1;
    const cards: { canvas: HTMLCanvasElement; entry: CollectionEntry }[] = [];
    if (at.kind === 'contents') {
      const left = el('section', 'album-page album-page-left'),
        right = el('section', 'album-page album-page-right');
      left.append(
        el('h3', 'album-page-title', 'A field album of the sea'),
        el(
          'p',
          'album-note',
          'Every creature you meet is kept here, habitat by habitat. Turn the pages, or choose a habitat.',
        ),
      );
      const list = el('ol', 'album-contents');
      for (const s of ALBUM_SECTIONS) {
        const p = sectionProgress(s, seen),
          item = el('li'),
          go = button('album-contents-link', SECTION_NAMES[s]),
          count = el(
            'span',
            'album-count',
            `${p.discovered} of ${p.total} found`,
          );
        go.addEventListener('click', () => this.go(firstSpread(s)));
        item.append(go, count);
        list.append(item);
      }
      right.append(el('h3', 'album-page-title', 'Contents'), list);
      this.spread.replaceChildren(left, right);
    } else {
      const p = sectionProgress(at.section, seen),
        pages = [at.left, at.right].map((entries, side) => {
          const page = el(
            'section',
            `album-page album-page-${side ? 'right' : 'left'}`,
          );
          page.setAttribute(
            'aria-label',
            `${SECTION_NAMES[at.section]}, page ${at.part * 2 + side + 1}`,
          );
          if (side === 0)
            page.append(
              el(
                'h3',
                'album-page-title',
                `${SECTION_NAMES[at.section]}${at.parts > 1 ? ` (${at.part + 1} of ${at.parts})` : ''}`,
              ),
              el('p', 'album-count', `${p.discovered} of ${p.total} found`),
            );
          const grid = el('div', 'album-grid');
          for (const entry of entries)
            grid.append(this.card(entry, seen, cards));
          page.append(grid);
          return page;
        });
      this.spread.replaceChildren(...pages);
    }
    this.previews?.show(cards);
  }
  /** One card: a discovered animal (a button) or a mystery slot (nothing told). */
  private card(
    entry: CollectionEntry,
    seen: readonly Sighting[],
    cards: { canvas: HTMLCanvasElement; entry: CollectionEntry }[],
  ): HTMLElement {
    const total = sectionProgress(entry.section, seen).total;
    if (!isDiscovered(entry, seen)) {
      const slot = el('div', 'album-card album-card-mystery');
      slot.setAttribute(
        'aria-label',
        `Not yet found: card ${entry.order + 1} of ${total}`,
      );
      slot.append(
        el('span', 'album-mystery-mark', '?'),
        el('span', 'album-mystery-label', 'Not yet found'),
      );
      return slot;
    }
    const card = button(`album-card album-card-${entry.rarity}`, ''),
      canvas = el('canvas', 'album-card-model'),
      placed = this.tank?.state(entry)?.placed ?? 0;
    canvas.width = CARD.w;
    canvas.height = CARD.h;
    canvas.setAttribute('aria-hidden', 'true');
    card.dataset.id = entry.id;
    card.setAttribute(
      'aria-label',
      `${entry.name}, ${SECTION_NAMES[entry.section]}, ${RARITY_LABEL[entry.rarity]}${placed ? ', in your aquarium' : ''}. Open card.`,
    );
    card.append(
      canvas,
      el('span', 'album-card-name', entry.name),
      el('span', 'album-card-habitat', SECTION_NAMES[entry.section]),
      el(
        'span',
        `album-rarity album-rarity-${entry.rarity}`,
        RARITY_LABEL[entry.rarity],
      ),
      el('span', 'album-card-note', DESCRIPTIONS[entry.id] ?? ''),
    );
    if (placed)
      card.append(el('span', 'album-card-placed', 'In your aquarium'));
    card.addEventListener('click', () => this.openDetail(entry));
    cards.push({ canvas, entry });
    return card;
  }
  /** The card, large: its model to turn, its note, and the aquarium action. */
  private openDetail(entry: CollectionEntry): void {
    this.selected = entry;
    const seen = this.options.seen(),
      d = this.detail,
      canvas = el('canvas', 'album-detail-model'),
      first = seen.find((s) => s.id === entry.id)?.first;
    canvas.width = DETAIL.w;
    canvas.height = DETAIL.h;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${entry.name}: drag to turn`);
    const turnBy = (dx: number) => this.previews?.drag(canvas, dx, 0),
      left = button('album-spin', '⟲', 'Turn left'),
      right = button('album-spin', '⟳', 'Turn right');
    left.addEventListener('click', () => turnBy(-40));
    right.addEventListener('click', () => turnBy(40));
    let drag: { x: number; y: number } | undefined;
    canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      this.previews?.drag(canvas, e.clientX - drag.x, e.clientY - drag.y);
      drag = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerup', () => (drag = undefined));
    const info = el('div', 'album-detail-info');
    info.append(
      el('h3', 'album-detail-name', entry.name),
      el(
        'p',
        'album-detail-meta',
        `${SECTION_NAMES[entry.section]}${entry.alsoIn.length ? ` (also ${entry.alsoIn.map((s) => SECTION_NAMES[s]).join(', ')})` : ''} · ${RARITY_LABEL[entry.rarity]}`,
      ),
      el('p', 'album-detail-note', DESCRIPTIONS[entry.id] ?? ''),
      el(
        'p',
        'album-detail-found',
        entry.discovery === 'home'
          ? 'Lives in your aquarium.'
          : first && Date.parse(first) > 0
            ? `First seen ${new Date(first).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}.`
            : 'Found.',
      ),
    );
    const actions = el('div', 'album-actions');
    info.append(actions);
    this.renderActions(entry, actions);
    const view = el('div', 'album-detail-view');
    view.append(canvas, left, right);
    d.replaceChildren(view, info);
    d.setAttribute('aria-label', `${entry.name} card`);
    d.hidden = false;
    this.spread.hidden = true;
    this.prev.hidden = this.next.hidden = true;
    this.back.hidden = false;
    this.previews?.show([{ canvas, entry, spin: false }]);
    this.back.focus();
  }
  private renderActions(entry: CollectionEntry, box: HTMLElement): void {
    box.replaceChildren();
    const state = this.tank?.state(entry);
    if (!this.tank || !state) {
      if (entry.tank && entry.tank.slot !== 'decoration')
        box.append(
          el('p', 'album-action-note', 'Visit your aquarium to add it there.'),
        );
      else if (entry.tank?.slot === 'decoration')
        box.append(
          el(
            'p',
            'album-action-note',
            'Place it from your tank’s decoration list.',
          ),
        );
      return;
    }
    const tank = this.tank,
      fish = entry.tank?.slot === 'fish',
      add = button(
        'album-action',
        fish ? 'Add one to the aquarium' : 'Add to Aquarium',
      ),
      back = button(
        'album-action',
        fish ? 'Return one to the sea' : 'Return it to the sea',
      );
    add.disabled = !state.canAdd || (!fish && state.placed > 0);
    back.disabled = state.placed === 0;
    add.addEventListener('click', () => {
      this.status.textContent = tank.add(entry);
      this.renderActions(entry, box);
    });
    back.addEventListener('click', () => {
      this.status.textContent = tank.remove(entry);
      this.renderActions(entry, box);
    });
    box.append(
      el(
        'p',
        'album-action-note',
        fish
          ? `${state.placed} of ${state.max} in your aquarium.`
          : state.placed
            ? 'In your aquarium.'
            : 'Not in your aquarium.',
      ),
    );
    if (!state.canAdd && state.reason && !state.placed)
      box.append(el('p', 'album-action-why', state.reason));
    if (fish || !state.placed) box.append(add);
    if (state.placed) box.append(back);
  }
  private closeDetail(restore = true): void {
    if (this.detail.hidden) return;
    const was = this.selected;
    this.detail.hidden = true;
    this.detail.replaceChildren();
    this.selected = undefined;
    this.spread.hidden = false;
    this.prev.hidden = this.next.hidden = false;
    this.back.hidden = true;
    if (!restore) return;
    // Back to the page, with its cards (placement badges refreshed) and focus on the card.
    this.render();
    this.spread
      .querySelector<HTMLElement>(`[data-id="${was?.id ?? ''}"]`)
      ?.focus();
  }
  dispose(): void {
    this.close();
    this.abort.abort();
    this.root.remove();
  }
}
