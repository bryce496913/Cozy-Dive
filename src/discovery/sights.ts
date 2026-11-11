import { CRUISE_SPECIES, type BigCreatureId } from '../config/creatures';
import type { Sighting } from './journal';

/**
 * v0.4 Pass 025: everything the outer waters can show the swimmer, with its stable journal id
 * and how it is named. v0.5's tank catalog unlocks by these ids, so they must never change.
 */
export interface Sight {
  readonly id: string;
  readonly label: string;
}
export const creatureSight = (id: BigCreatureId): string => `species:${id}`;

/** Reef features worth noticing, by the outer reef layout's family names. */
export const REEF_SIGHTS = {
  branching: { id: 'coral:branching', label: 'Branching coral' },
  massive: { id: 'coral:boulder', label: 'Boulder coral' },
  plate: { id: 'coral:plate', label: 'Plate coral' },
  soft: { id: 'coral:soft', label: 'Soft coral' },
  fan: { id: 'coral:sea-fan', label: 'Sea fan' },
  grass: { id: 'plant:seagrass', label: 'Seagrass' },
  blade: { id: 'plant:seagrass', label: 'Seagrass' },
} as const satisfies Record<string, Sight>;

const REEF: Readonly<Record<string, Sight | undefined>> = REEF_SIGHTS;
/** The sight a kind of reef piece shows, if any (by the layout's family name). */
export function reefSight(family: string): Sight | undefined {
  return Object.hasOwn(REEF, family) ? REEF[family] : undefined;
}

/** Every sight, in the order the "Seen" page lists them when first seen together. */
export const SIGHTS: readonly Sight[] = [
  ...Object.values(CRUISE_SPECIES).map((s) => ({
    id: creatureSight(s.id),
    label: s.name,
  })),
  ...Object.values(REEF_SIGHTS).filter(
    (s, i, all) => all.findIndex((o) => o.id === s.id) === i,
  ),
];
/** A sight's name, or null for an id this version does not know (kept, but not listed). */
export function sightLabel(id: string): string | null {
  return SIGHTS.find((s) => s.id === id)?.label ?? null;
}
/**
 * The pause screen's "Seen" list: names and first dates, in the order first seen. Ids this
 * version does not know (from a newer version, say) stay in the journal but are not listed.
 */
export function seenList(
  seen: readonly Sighting[],
): { label: string; first: string }[] {
  return seen
    .map((s, order) => ({ s, order, label: sightLabel(s.id) }))
    .filter((e): e is typeof e & { label: string } => e.label !== null)
    .sort(
      (a, b) =>
        Date.parse(a.s.first) - Date.parse(b.s.first) || a.order - b.order,
    )
    .map((e) => ({ label: e.label, first: e.s.first }));
}
