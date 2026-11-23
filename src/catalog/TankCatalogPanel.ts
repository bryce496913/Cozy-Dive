import type { TankCreatureId } from '../config/babies';
import type { Sighting } from '../discovery/journal';
import type { SpeciesId } from '../fish/FishSpecies';
import {
  TANK_ITEMS,
  unlockedItems,
  type TankCatalog,
  type TankKind,
} from './catalog';

/**
 * v0.6 Pass 051: the "For your tank" panel, grouped as the catalog is: schooling fish,
 * aquarium fish, little visitors, plants and corals, rocks and decorations, discoveries from every habitat. Plain buttons in reading order, so it is fully usable
 * from the keyboard; each control carries a stable `data-key` so focus can be kept across a
 * refresh.
 */
export interface CatalogActions {
  choose(kind: TankKind): void;
  baby(id: TankCreatureId): void;
  fish(species: SpeciesId, add: boolean): void;
  /** V0.8 Pass 099: open the field album (with the aquarium's add and return actions). */
  album(): void;
  undo(): void;
  close(): void;
}
const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  return e;
};
function button(
  text: string,
  key: string,
  onClick: () => void,
): HTMLButtonElement {
  const b = el('button', text);
  b.type = 'button';
  b.dataset.key = key;
  b.onclick = onClick;
  return b;
}
function section(title: string): HTMLElement {
  const s = el('section');
  s.className = 'tank-catalog-group';
  s.setAttribute('aria-label', title);
  s.append(el('h3', title));
  return s;
}
/** Fill `panel`; returns the control to focus (the one with `focusKey`, else Close). */
export function renderCatalog(
  panel: HTMLElement,
  model: TankCatalog,
  seen: readonly Sighting[],
  artReady: boolean,
  act: CatalogActions,
  focusKey?: string,
): HTMLElement {
  panel.replaceChildren();
  const close = button('Close', 'close', () => act.close());
  const undo = button('Undo', 'undo', () => act.undo());
  undo.disabled = !model.canUndo;
  panel.append(el('h2', 'For your tank'), close, undo);

  // V0.8 Pass 099: the fish and the little visitors are in the field album now (the same cards
  // as everywhere else); this panel keeps the corals, plants, rocks and decorations.
  const album = section('Creatures and fish');
  album.append(
    el(
      'p',
      'Add the animals you have found, and return them to the sea, from their cards.',
    ),
    button('Open the field album', 'album', () => act.album()),
  );
  panel.append(album);

  const items = unlockedItems(seen);
  for (const [category, title] of [
    ['coral-plant', 'Plants and corals'],
    ['rock-decoration', 'Rocks and decorations'],
  ] as const) {
    const list = items.filter((i) => i.category === category);
    if (!list.length) continue;
    const s = section(title);
    for (const item of list) {
      const b = button(item.label, `item-${item.kind}`, () =>
        act.choose(item.kind),
      );
      b.disabled = !artReady;
      s.append(b);
    }
    panel.append(s);
  }
  const unseen = TANK_ITEMS.length - items.length;
  if (unseen > 0)
    panel.append(
      el(
        'p',
        'More corals and plants can find a home here once seen beyond the tank.',
      ),
    );

  return (
    (focusKey &&
      panel.querySelector<HTMLElement>(
        `[data-key="${focusKey}"]:not(:disabled)`,
      )) ||
    close
  );
}
