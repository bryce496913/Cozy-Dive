/**
 * v0.4 Pass 023: the sightings journal, the foundation of gentle discovery. Things seen in the
 * outer waters are remembered locally; v0.5's tank catalog is built from this list. There are no
 * counts to complete and nothing can be lost: an entry, once written, stays.
 *
 * Pure and storage-tolerant: absent, corrupt or unavailable storage reads as an empty journal,
 * and failed writes are reported rather than thrown.
 */
export interface SightCandidate {
  /** Stable identifier (e.g. "species:blacktip-reef-shark"); what the catalog unlocks by. */
  readonly id: string;
  readonly label: string;
  /** Where it is now (updated in place by its owner) and roughly how big (m). */
  readonly position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly radius: number;
}
export interface Sighting {
  readonly id: string;
  /** ISO date of the first sighting. */
  readonly first: string;
}
export interface JournalStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const JOURNAL_KEY = 'cozy-diver.journal.v1';
const ID = /^[a-z0-9][a-z0-9:._-]{0,79}$/;

/** Read the journal; anything unreadable is ignored entry by entry, never thrown. */
export function loadJournal(store: JournalStore): Sighting[] {
  try {
    const raw = store.getItem(JOURNAL_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    const list =
      data && typeof data === 'object' && 'seen' in data
        ? (data as { seen: unknown }).seen
        : undefined;
    if (!Array.isArray(list)) return [];
    const seen = new Map<string, Sighting>();
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue;
      const { id, first } = entry as Record<string, unknown>;
      if (typeof id !== 'string' || !ID.test(id) || seen.has(id)) continue;
      seen.set(id, {
        id,
        first:
          typeof first === 'string' && !Number.isNaN(Date.parse(first))
            ? first
            : new Date(0).toISOString(),
      });
    }
    return [...seen.values()];
  } catch {
    return [];
  }
}
export function saveJournal(
  store: JournalStore,
  seen: readonly Sighting[],
): boolean {
  try {
    store.setItem(JOURNAL_KEY, JSON.stringify({ version: 1, seen }));
    return true;
  } catch {
    return false;
  }
}

export const SIGHTING = {
  /** How long something must stay in view, and how close (beyond its own size), to count. */
  dwell: 1.5,
  distance: 6,
  /** Half-angle of the view cone (radians) — roughly the middle of the screen. */
  cone: 0.6,
  /** Time in view decays at this rate when it leaves view (so glances add up slowly). */
  decay: 0.5,
} as const;

/**
 * Accumulates how long each candidate has been comfortably in view and reports a candidate the
 * moment it first counts as seen. Fixed per-candidate state, no per-frame allocation.
 */
export class SightingTracker {
  private readonly progress = new Map<string, number>();
  private readonly known: Set<string>;
  constructor(seen: readonly Sighting[]) {
    this.known = new Set(seen.map((s) => s.id));
  }
  has(id: string): boolean {
    return this.known.has(id);
  }
  /**
   * Advance by `dt` seconds with the camera at `eye` looking along unit `forward`. Returns the
   * first candidate newly seen this frame, if any (others follow on later frames).
   */
  update(
    candidates: readonly SightCandidate[],
    eye: { x: number; y: number; z: number },
    forward: { x: number; y: number; z: number },
    dt: number,
  ): SightCandidate | null {
    if (!(dt > 0)) return null;
    let found: SightCandidate | null = null;
    const cosCone = Math.cos(SIGHTING.cone);
    for (const c of candidates) {
      if (this.known.has(c.id)) continue;
      const dx = c.position.x - eye.x,
        dy = c.position.y - eye.y,
        dz = c.position.z - eye.z,
        d = Math.hypot(dx, dy, dz),
        near = d - c.radius <= SIGHTING.distance,
        facing =
          d < 1e-6 ||
          (dx * forward.x + dy * forward.y + dz * forward.z) / d >= cosCone;
      const before = this.progress.get(c.id) ?? 0,
        now =
          near && facing
            ? before + dt
            : Math.max(0, before - dt * SIGHTING.decay);
      if (now >= SIGHTING.dwell && !found) {
        found = c;
        this.known.add(c.id);
        this.progress.delete(c.id);
      } else if (now > 0) this.progress.set(c.id, now);
      else this.progress.delete(c.id);
    }
    return found;
  }
}

/** Add a sighting (idempotent); returns the new list, or the same list when already present. */
export function recordSighting(
  seen: readonly Sighting[],
  id: string,
  when: Date,
): readonly Sighting[] {
  if (!ID.test(id) || seen.some((s) => s.id === id)) return seen;
  return [...seen, { id, first: when.toISOString() }];
}
