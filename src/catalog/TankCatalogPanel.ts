import type { TankCreatureId } from '../config/babies';
import type { TankFishDefinition } from '../config/tankFish';
import type { Sighting } from '../discovery/journal';
import type { SpeciesId } from '../fish/FishSpecies';
import {
  TANK_ITEMS,
  unlockedBabies,
  unlockedItems,
  type TankCatalog,
  type TankKind,
} from './catalog';
import { fishRoom, unlockedFish } from './fishCatalog';

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
function fishRow(
  d: TankFishDefinition,
  model: TankCatalog,
  seen: readonly Sighting[],
  act: CatalogActions,
): HTMLElement {
  const row = el('div'),
    count = model.fish[d.species] ?? 0,
    room = fishRoom(model.fish, d.species, seen),
    name = el('h4', d.label),
    note = el('p', count ? `${d.note} ${count} added.` : d.note);
  row.className = 'tank-catalog-fish';
  const add = button('Add one', `fish-add-${d.species}`, () =>
    act.fish(d.species, true),
  );
  const back = button('Return one to the sea', `fish-remove-${d.species}`, () =>
    act.fish(d.species, false),
  );
  back.disabled = count === 0;
  row.append(name, note, add, back);
  if (!room.ok) {
    add.disabled = true;
    const why = el('p', room.reason);
    why.id = `fish-why-${d.species}`;
    why.className = 'tank-catalog-why';
    add.setAttribute('aria-describedby', why.id);
    row.append(why);
  }
  return row;
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

  const fish = unlockedFish(seen);
  for (const [group, title] of [
    ['schooling', 'Schooling fish'],
    ['individual', 'Aquarium fish'],
  ] as const) {
    const list = fish.filter((f) => f.group === group);
    if (!list.length) continue;
    const s = section(title);
    for (const d of list) s.append(fishRow(d, model, seen, act));
    panel.append(s);
  }

  const animals = unlockedBabies(seen);
  if (animals.length) {
    const s = section('Creature collection');
    for (const animal of animals) {
      const row = el('div');
      row.append(
        el('h4', animal.label),
        button(
          model.babies.includes(animal.id)
            ? 'Return it to the sea'
            : 'Add to the tank',
          `baby-${animal.id}`,
          () => act.baby(animal.id),
        ),
      );
      s.append(row);
    }
    panel.append(s);
  }

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
