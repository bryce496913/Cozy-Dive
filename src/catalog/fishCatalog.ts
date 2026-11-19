import {
  TANK_FISH,
  TANK_FISH_CAP,
  type TankFishDefinition,
} from '../config/tankFish';
import type { Sighting } from '../discovery/journal';
import { OUTER_EXTRA_SPECIES } from '../environment/outer/OuterExtraSpecies';
import {
  FISH_SPECIES,
  type FishSpecies,
  type SpeciesId,
} from '../fish/FishSpecies';

/**
 * v0.6 Pass 051: fish added to the home tank, by species. Pure: what may be added, how much room
 * is left, how saved counts are read back, and the population the tank's added fish swim as.
 */
export type TankFishCounts = Readonly<Partial<Record<SpeciesId, number>>>;
export const NO_FISH: TankFishCounts = {};

export const fishDefinition = (
  species: SpeciesId,
): TankFishDefinition | undefined =>
  TANK_FISH.find((f) => f.species === species);

const isSeen = (seen: readonly Sighting[], id: string | null): boolean =>
  id === null || seen.some((s) => s.id === id);

/** Fish that may be offered: the tank's own species, and the outer reef's once seen. */
export function unlockedFish(
  seen: readonly Sighting[],
): readonly TankFishDefinition[] {
  return TANK_FISH.filter((f) => isSeen(seen, f.sighting));
}
export function fishTotal(counts: TankFishCounts): number {
  let total = 0;
  for (const f of TANK_FISH) total += counts[f.species] ?? 0;
  return total;
}
export type FishRoom =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };
/** Whether one more of a species fits, and if not, a calm reason to show. */
export function fishRoom(
  counts: TankFishCounts,
  species: SpeciesId,
  seen: readonly Sighting[],
): FishRoom {
  const d = fishDefinition(species);
  if (!d)
    return { ok: false, reason: 'This creature is not in the catalog yet.' };
  if (!isSeen(seen, d.sighting))
    return { ok: false, reason: 'Seen beyond the tank, it can join you here.' };
  if ((counts[species] ?? 0) >= d.max)
    return {
      ok: false,
      reason:
        d.max === 1
          ? 'Already in your collection.'
          : `${d.max} ${d.label.toLowerCase()} already added.`,
    };
  return { ok: true };
}
export function addFish(
  counts: TankFishCounts,
  species: SpeciesId,
  seen: readonly Sighting[],
): TankFishCounts | null {
  if (!fishRoom(counts, species, seen).ok) return null;
  return { ...counts, [species]: (counts[species] ?? 0) + 1 };
}
export function removeFish(
  counts: TankFishCounts,
  species: SpeciesId,
): TankFishCounts {
  const n = counts[species] ?? 0;
  if (n <= 0) return counts;
  const next: Partial<Record<SpeciesId, number>> = { ...counts };
  if (n === 1) delete next[species];
  else next[species] = n - 1;
  return next;
}

/** Saved fish read back: valid counts, plus what this visit cannot show (kept for later). */
export interface LoadedFish {
  readonly counts: TankFishCounts;
  /** Entries for species not offered this visit (not yet seen, or unknown to this version). */
  readonly kept: Readonly<Record<string, number>>;
}
const SPECIES_KEY = /^[a-z][a-z-]{0,40}$/;
export function readFish(raw: unknown, seen: readonly Sighting[]): LoadedFish {
  const counts: Partial<Record<SpeciesId, number>> = {},
    kept: Record<string, number> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return { counts, kept };
  let total = 0,
    entries = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (++entries > 64) break;
    if (
      !SPECIES_KEY.test(key) ||
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value <= 0
    )
      continue;
    const d = TANK_FISH.find((f) => f.species === key);
    if (!d || !isSeen(seen, d.sighting)) {
      kept[key] = Math.min(value, 99);
      continue;
    }
    const n = Math.min(value, d.max, TANK_FISH_CAP - total);
    if (n <= 0) continue;
    counts[d.species] = n;
    total += n;
  }
  return { counts, kept };
}

/** The species definitions the added fish swim as: the tank's own, or the outer reef's. */
export function guestSpecies(counts: TankFishCounts): readonly FishSpecies[] {
  const out: FishSpecies[] = [];
  for (const d of TANK_FISH) {
    const count = counts[d.species] ?? 0;
    if (count <= 0) continue;
    // Playtest: species with no swimming entry of their own (the big reef fish, the kelp and
    // cave fish) swim with the chromis' behaviour, on their own rig or a recoloured chromis.
    const chromis = FISH_SPECIES.find((s) => s.id === 'blue-green-chromis');
    const base =
      FISH_SPECIES.find((s) => s.id === d.species) ??
      OUTER_EXTRA_SPECIES.find((s) => s.id === d.species) ??
      (chromis && { ...chromis, id: d.species, name: d.label });
    if (!base) continue;
    // The rig keeps the size it was built at, and is scaled to the tank length.
    const length = d.length ?? base.length,
      k = length / base.length,
      built =
        d.modelLength ??
        (d.length !== undefined
          ? (base.authoredLength ?? base.length)
          : base.authoredLength);
    out.push({
      ...base,
      count,
      length,
      height: base.height * k,
      width: base.width * k,
      authoredLength: built,
      ...(d.tint !== undefined
        ? { color: d.tint, backColor: d.tint, finColor: d.tint }
        : {}),
      // Big fish range a little more slowly in the tank.
      speed: length > 0.8 ? base.speed * 0.8 : base.speed,
      schooling: { ...base.schooling, enabled: d.group === 'schooling' },
      individualScale: undefined,
      hostAnchorId: undefined,
    });
  }
  return out;
}
