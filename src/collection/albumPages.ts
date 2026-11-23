import {
  ALBUM_SECTIONS,
  COLLECTION,
  type AlbumSection,
  type CollectionEntry,
} from './registry';

/**
 * V0.8 Pass 099: how the album's pages are laid out. Pure. The album opens on a contents spread;
 * each habitat then fills as many spreads as it needs, six cards to a page, two pages to a spread.
 * A habitat always starts on a fresh spread, so its tab lands on its own first page.
 */
export const CARDS_PER_PAGE = 6;
export const CARDS_PER_SPREAD = CARDS_PER_PAGE * 2;

export type Spread =
  | { readonly kind: 'contents' }
  | {
      readonly kind: 'habitat';
      readonly section: AlbumSection;
      /** Which of this habitat's spreads (0-based), and how many it has. */
      readonly part: number;
      readonly parts: number;
      /** The entries on the left and right pages, in slot order. */
      readonly left: readonly CollectionEntry[];
      readonly right: readonly CollectionEntry[];
    };

function build(): readonly Spread[] {
  const spreads: Spread[] = [{ kind: 'contents' }];
  for (const section of ALBUM_SECTIONS) {
    const entries = COLLECTION.filter((e) => e.section === section),
      parts = Math.max(1, Math.ceil(entries.length / CARDS_PER_SPREAD));
    for (let part = 0; part < parts; part++) {
      const at = part * CARDS_PER_SPREAD;
      spreads.push({
        kind: 'habitat',
        section,
        part,
        parts,
        left: entries.slice(at, at + CARDS_PER_PAGE),
        right: entries.slice(at + CARDS_PER_PAGE, at + CARDS_PER_SPREAD),
      });
    }
  }
  return spreads;
}
/** Every spread, in reading order (stable). */
export const SPREADS: readonly Spread[] = build();

/** The first spread of a habitat (its tab's target). */
export function firstSpread(section: AlbumSection): number {
  return SPREADS.findIndex(
    (s) => s.kind === 'habitat' && s.section === section,
  );
}
/** The spread `step` pages on from `index`, clamped to the album (no wrapping). */
export function turn(index: number, step: number): number {
  return Math.max(0, Math.min(SPREADS.length - 1, index + step));
}
/** The habitat a spread belongs to (none for the contents). */
export function sectionOf(index: number): AlbumSection | undefined {
  const s = SPREADS[index];
  return s?.kind === 'habitat' ? s.section : undefined;
}

/**
 * The page the album last showed, for the rest of this visit (it is not saved: the album always
 * opens on the contents in a new session).
 */
let remembered = 0;
export function lastSpread(): number {
  return remembered;
}
export function rememberSpread(index: number): void {
  remembered = turn(index, 0);
}
