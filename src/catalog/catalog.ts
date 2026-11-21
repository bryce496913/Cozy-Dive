import { TANK_BABIES, BABY_CAP } from '../config/babies';
import type { TankCreatureId } from '../config/babies';
import type { Sighting, JournalStore } from '../discovery/journal';
import { AQUARIUM, type Vec3 } from '../config/world';
import type { ConvexCollider } from '../player/collision';
import type { SpeciesId } from '../fish/FishSpecies';
import {
  NO_FISH,
  addFish,
  fishRoom,
  readFish,
  removeFish,
  type FishRoom,
  type TankFishCounts,
} from './fishCatalog';

export const TANK_KEY = 'cozy-diver.tank.v1';
/** v0.6 Pass 051: the save format written now (1 and 2 are read and migrated). */
export const TANK_SAVE_VERSION = 3;
export const TANK_CAP = 20;
/**
 * v0.6 Pass 051: the catalog's decoration groups. Items with an empty `sighting` already grow in
 * the tank (its algae, rock and stone), so they are offered from the start; the rest once seen.
 */
export type TankCategory = 'coral-plant' | 'rock-decoration';
export const TANK_ITEMS = [
  {
    kind: 'boulder',
    category: 'coral-plant',
    sighting: 'coral:boulder',
    label: 'Boulder coral',
    node: 'Coral_Massive_0',
    width: 1.05,
    depth: 0.95,
    height: 0.8,
  },
  {
    kind: 'branching',
    category: 'coral-plant',
    sighting: 'coral:branching',
    label: 'Branching coral',
    node: 'Coral_Branching_0',
    // V0.7 Pass 077: the spreading thicket's own proportions (broader than tall).
    width: 0.97,
    depth: 0.93,
    height: 0.75,
  },
  {
    kind: 'plate',
    category: 'coral-plant',
    sighting: 'coral:plate',
    label: 'Plate coral',
    node: 'Coral_Plate_0',
    width: 1.15,
    depth: 1.05,
    height: 0.65,
  },
  {
    kind: 'soft',
    category: 'coral-plant',
    sighting: 'coral:soft',
    label: 'Soft coral',
    node: 'Soft_Coral_0',
    width: 0.8,
    depth: 0.8,
    height: 1,
  },
  {
    kind: 'sea-fan',
    category: 'coral-plant',
    sighting: 'coral:sea-fan',
    label: 'Sea fan',
    node: 'Sea_Fan_0',
    width: 1,
    depth: 0.4,
    height: 1.15,
  },
  {
    kind: 'seagrass',
    category: 'coral-plant',
    sighting: 'plant:seagrass',
    label: 'Seagrass patch',
    node: 'Turtle_Grass_0',
    width: 0.8,
    depth: 0.8,
    height: 0.65,
  },
  {
    // v0.6 Pass 032: seen in the kelp forest. A small stand of kelp, built in code (no library node).
    kind: 'kelp',
    category: 'coral-plant',
    sighting: 'plant:giant-kelp',
    label: 'Kelp',
    node: '',
    width: 1.1,
    depth: 1.1,
    height: 2.4,
  },
  {
    // v0.6 Pass 034: seen in the sea cave. A small limestone arch, built in code (no library node).
    kind: 'arch',
    category: 'rock-decoration',
    sighting: 'place:sea-cave',
    label: 'Limestone arch',
    node: '',
    width: 1.2,
    depth: 0.55,
    height: 0.9,
  },
  {
    // v0.6 Pass 051: more from the authored reef library (no new assets).
    kind: 'branching-tall',
    category: 'coral-plant',
    sighting: 'coral:branching',
    // V0.7 Pass 077: now a lopsided corymbose head (the id is kept for saved tanks).
    label: 'Branching coral head',
    node: 'Coral_Branching_1',
    width: 0.96,
    depth: 0.7,
    height: 0.85,
  },
  {
    kind: 'plate-tiered',
    category: 'coral-plant',
    sighting: 'coral:plate',
    label: 'Tiered plate coral',
    node: 'Coral_Plate_1',
    width: 0.85,
    depth: 0.8,
    height: 1.15,
  },
  {
    kind: 'caulerpa',
    category: 'coral-plant',
    sighting: '',
    label: 'Caulerpa',
    node: 'Caulerpa_0',
    width: 0.45,
    depth: 0.26,
    height: 1,
  },
  {
    kind: 'halimeda',
    category: 'coral-plant',
    sighting: '',
    label: 'Halimeda',
    node: 'Halimeda_0',
    width: 0.4,
    depth: 0.4,
    height: 0.85,
  },
  {
    kind: 'red-algae',
    category: 'coral-plant',
    sighting: '',
    label: 'Red algae',
    node: 'Red_Algae_0',
    width: 0.5,
    depth: 0.46,
    height: 0.95,
  },
  {
    kind: 'reef-rock',
    category: 'rock-decoration',
    sighting: '',
    label: 'Reef rock',
    node: 'Rock_1',
    width: 1,
    depth: 1,
    height: 1.15,
  },
  {
    kind: 'stone',
    category: 'rock-decoration',
    sighting: '',
    label: 'Smooth stone',
    node: 'Pebble_0',
    width: 0.5,
    depth: 0.5,
    height: 0.55,
  },
] as const;
export type TankKind = (typeof TANK_ITEMS)[number]['kind'];
export interface TankItem {
  readonly id: string;
  readonly kind: TankKind;
  readonly position: Readonly<Vec3>;
  readonly rotation: number;
}
export const tankDefinition = (kind: TankKind) =>
  TANK_ITEMS.find((i) => i.kind === kind)!;
export function unlockedItems(seen: readonly Sighting[]) {
  return TANK_ITEMS.filter(
    (i) => i.sighting === '' || seen.some((s) => s.id === i.sighting),
  );
}
export interface KeepOut {
  readonly name: string;
  readonly min: Readonly<Vec3>;
  readonly max: Readonly<Vec3>;
}
export interface PlacementContext {
  readonly keepOut: readonly KeepOut[];
  readonly routes: readonly (readonly Readonly<Vec3>[])[];
  readonly surface: (x: number, z: number) => number;
}
export function rotatedSize(kind: TankKind, rotation: number) {
  const d = tankDefinition(kind),
    c = Math.abs(Math.cos(rotation)),
    s = Math.abs(Math.sin(rotation));
  return {
    x: (d.width * c + d.depth * s) / 2 + 0.08,
    y: d.height + 0.08,
    z: (d.width * s + d.depth * c) / 2 + 0.08,
  };
}
export function itemBounds(item: TankItem): KeepOut {
  const r = rotatedSize(item.kind, item.rotation),
    p = item.position;
  return {
    name: item.id,
    min: { x: p.x - r.x, y: p.y - 0.04, z: p.z - r.z },
    max: { x: p.x + r.x, y: p.y + r.y, z: p.z + r.z },
  };
}
function overlaps(a: KeepOut, b: KeepOut, pad = 0) {
  return (
    a.min.x < b.max.x + pad &&
    a.max.x > b.min.x - pad &&
    a.min.y < b.max.y + pad &&
    a.max.y > b.min.y - pad &&
    a.min.z < b.max.z + pad &&
    a.max.z > b.min.z - pad
  );
}
/** Slab segment/AABB intersection, including the swept swimmer's clearance. */
function blocksRoute(
  a: Readonly<Vec3>,
  b: Readonly<Vec3>,
  box: KeepOut,
): boolean {
  let lo = 0,
    hi = 1;
  for (const axis of ['x', 'y', 'z'] as const) {
    const delta = b[axis] - a[axis],
      min = box.min[axis] - 0.75,
      max = box.max[axis] + 0.75;
    if (Math.abs(delta) < 1e-9) {
      if (a[axis] < min || a[axis] > max) return false;
    } else {
      const t1 = (min - a[axis]) / delta,
        t2 = (max - a[axis]) / delta;
      lo = Math.max(lo, Math.min(t1, t2));
      hi = Math.min(hi, Math.max(t1, t2));
      if (lo > hi) return false;
    }
  }
  return true;
}
export function validPlacement(
  item: TankItem,
  items: readonly TankItem[],
  c: PlacementContext,
): boolean {
  const p = item.position;
  if (![p.x, p.y, p.z, item.rotation].every(Number.isFinite)) return false;
  if (items.filter((i) => i.id !== item.id).length >= TANK_CAP) return false;
  const b = itemBounds(item),
    q = AQUARIUM,
    margin = q.clearance;
  if (
    b.min.x < q.min.x + margin ||
    b.max.x > q.max.x - margin ||
    b.min.z < q.min.z + margin ||
    b.max.z > q.max.z - margin ||
    b.max.y > q.max.y - margin
  )
    return false;
  if (Math.abs(p.y - c.surface(p.x, p.z)) > 0.08) return false;
  const radius = rotatedSize(item.kind, item.rotation);
  for (const [dx, dz] of [
    [radius.x, radius.z],
    [-radius.x, radius.z],
    [radius.x, -radius.z],
    [-radius.x, -radius.z],
  ]) {
    // v0.6: a little more forgiving on slopes (the piece settles into the sand a touch).
    const support = c.surface(p.x + dx, p.z + dz);
    if (support > p.y + 0.3 || support < p.y - 0.6) return false;
  }
  // The entire central sand channel stays open, at every height.
  if (b.min.x < 3.4 && b.max.x > -3.4) return false;
  if (c.keepOut.some((k) => overlaps(b, k, 0.3))) return false;
  if (items.some((i) => i.id !== item.id && overlaps(b, itemBounds(i), 0.25)))
    return false;
  return !c.routes.some((route) =>
    route.some((v, i) => i > 0 && blocksRoute(route[i - 1], v, b)),
  );
}
export function itemCollider(item: TankItem): ConvexCollider {
  const { min, max } = itemBounds(item);
  return {
    min,
    max,
    planes: [
      { x: 1, y: 0, z: 0, offset: max.x },
      { x: -1, y: 0, z: 0, offset: -min.x },
      { x: 0, y: 1, z: 0, offset: max.y },
      { x: 0, y: -1, z: 0, offset: -min.y },
      { x: 0, y: 0, z: 1, offset: max.z },
      { x: 0, y: 0, z: -1, offset: -min.z },
    ],
  };
}
function loadItems(
  store: JournalStore,
  seen: readonly Sighting[],
  c: PlacementContext,
): TankItem[] {
  try {
    const data: unknown = JSON.parse(store.getItem(TANK_KEY) ?? 'null');
    if (
      !data ||
      typeof data !== 'object' ||
      !('version' in data) ||
      (data.version !== 1 && data.version !== 2 && data.version !== 3) ||
      !('items' in data) ||
      !Array.isArray(data.items)
    )
      return [];
    const allowed = unlockedItems(seen),
      items: TankItem[] = [];
    for (const raw of data.items.slice(0, 1000)) {
      if (!raw || typeof raw !== 'object') continue;
      const { id, kind, position, rotation } = raw as Record<string, unknown>;
      if (
        typeof id !== 'string' ||
        !/^tank-[a-z0-9-]{1,64}$/.test(id) ||
        items.some((i) => i.id === id) ||
        !allowed.some((i) => i.kind === kind) ||
        !position ||
        typeof position !== 'object' ||
        typeof rotation !== 'number'
      )
        continue;
      const p = position as Record<string, unknown>;
      if (
        typeof p.x !== 'number' ||
        typeof p.y !== 'number' ||
        typeof p.z !== 'number'
      )
        continue;
      const item: TankItem = {
        id,
        kind: kind as TankKind,
        position: { x: p.x, y: p.y, z: p.z },
        rotation: ((rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
      };
      if (validPlacement(item, items, c)) items.push(item);
    }
    return items;
  } catch {
    return [];
  }
}
export function unlockedBabies(seen: readonly Sighting[]) {
  return TANK_BABIES.filter((b) => seen.some((s) => s.id === b.sighting));
}
export interface TankSave {
  readonly items: TankItem[];
  readonly babies: TankCreatureId[];
}
/** Version 1 decorations migrate independently; malformed animal data cannot erase them. */
export function loadTankState(
  store: JournalStore,
  seen: readonly Sighting[],
  c: PlacementContext,
): TankSave {
  const items = loadItems(store, seen, c),
    babies: TankCreatureId[] = [];
  try {
    const data: unknown = JSON.parse(store.getItem(TANK_KEY) ?? 'null');
    if (
      data &&
      typeof data === 'object' &&
      'version' in data &&
      (data.version === 2 || data.version === 3) &&
      'babies' in data &&
      Array.isArray(data.babies)
    ) {
      for (const raw of data.babies.slice(0, 1000)) {
        const definition = unlockedBabies(seen).find((b) => b.id === raw);
        if (
          definition &&
          !babies.includes(definition.id) &&
          babies.length < BABY_CAP
        )
          babies.push(definition.id);
      }
    }
  } catch {
    /* unavailable or corrupt storage */
  }
  return { items, babies };
}
export function loadTank(
  store: JournalStore,
  seen: readonly Sighting[],
  c: PlacementContext,
): TankItem[] {
  return loadTankState(store, seen, c).items;
}
/**
 * v0.6 Pass 050: saved entries that this load did not bring into the tank, so that the next save
 * keeps them rather than erasing them. An addition is skipped when it is not (yet) unlocked, for
 * example after the sightings were lost, or when it no longer fits; a baby likewise. A save written
 * by a newer version is never overwritten.
 */
export interface KeptEntries {
  readonly items: readonly unknown[];
  readonly babies: readonly string[];
  /** v0.6 Pass 051: added fish of species not offered this visit. */
  readonly fish?: Readonly<Record<string, number>>;
  /** The save is from a newer version; it is left untouched. */
  readonly newer: boolean;
}
export const KEPT_CAP = 40;
export const NO_KEPT: KeptEntries = { items: [], babies: [], newer: false };
export function keptEntries(
  store: JournalStore,
  loaded: Readonly<TankSave>,
  seen: readonly Sighting[] = [],
): KeptEntries {
  try {
    const data: unknown = JSON.parse(store.getItem(TANK_KEY) ?? 'null');
    if (!data || typeof data !== 'object' || !('version' in data))
      return NO_KEPT;
    if (typeof data.version === 'number' && data.version > TANK_SAVE_VERSION)
      return { ...NO_KEPT, newer: true };
    if (data.version !== 1 && data.version !== 2 && data.version !== 3)
      return NO_KEPT;
    const ids = new Set(loaded.items.map((i) => i.id)),
      items: unknown[] = [];
    if ('items' in data && Array.isArray(data.items))
      for (const raw of data.items) {
        if (items.length >= KEPT_CAP) break;
        if (!raw || typeof raw !== 'object' || !('id' in raw)) continue;
        const id = raw.id;
        if (
          typeof id !== 'string' ||
          !/^tank-[a-z0-9-]{1,64}$/.test(id) ||
          ids.has(id)
        )
          continue;
        ids.add(id);
        items.push(raw);
      }
    const babies: string[] = [];
    if (
      (data.version === 2 || data.version === 3) &&
      'babies' in data &&
      Array.isArray(data.babies)
    )
      for (const raw of data.babies)
        if (
          typeof raw === 'string' &&
          TANK_BABIES.some((b) => b.id === raw) &&
          !loaded.babies.some((b) => b === raw) &&
          !babies.includes(raw)
        )
          babies.push(raw);
    const fish =
      data.version === 3 && 'fish' in data
        ? readFish(data.fish, seen).kept
        : {};
    return { items, babies, fish, newer: false };
  } catch {
    return NO_KEPT;
  }
}
/** v0.6 Pass 051: the added fish saved with the tank (version 3; none before). */
export function loadTankFish(
  store: JournalStore,
  seen: readonly Sighting[],
): TankFishCounts {
  try {
    const data: unknown = JSON.parse(store.getItem(TANK_KEY) ?? 'null');
    if (!data || typeof data !== 'object' || !('version' in data))
      return NO_FISH;
    if (data.version !== 3 || !('fish' in data)) return NO_FISH;
    return readFish(data.fish, seen).counts;
  } catch {
    return NO_FISH;
  }
}
export function saveTank(
  store: JournalStore,
  items: readonly TankItem[],
  babies: readonly TankCreatureId[] = [],
  kept: Readonly<KeptEntries> = NO_KEPT,
  fish: TankFishCounts = NO_FISH,
): boolean {
  if (kept.newer) return false;
  try {
    const ids = new Set(items.map((i) => i.id));
    store.setItem(
      TANK_KEY,
      JSON.stringify({
        version: TANK_SAVE_VERSION,
        fish: { ...kept.fish, ...fish },
        items: [
          ...items,
          ...kept.items.filter(
            (raw) =>
              !!raw &&
              typeof raw === 'object' &&
              'id' in raw &&
              typeof raw.id === 'string' &&
              !ids.has(raw.id),
          ),
        ],
        babies: [
          ...babies,
          ...kept.babies.filter((b) => !babies.some((id) => id === b)),
        ],
      }),
    );
    return true;
  } catch {
    return false;
  }
}
/** Transactions retain the original item while moving; cancellation never loses it. */
/** v0.6 Pass 051: one undoable state of the tank (what you added, not the preview). */
interface TankSnapshot {
  readonly items: readonly TankItem[];
  readonly babies: readonly TankCreatureId[];
  readonly fish: TankFishCounts;
}
/** How many changes Undo can step back through. */
export const UNDO_DEPTH = 20;
/** One turn step (30°); Shift turns the other way. */
export const TURN_STEP = Math.PI / 6;
export class TankCatalog {
  private list: readonly TankItem[];
  private animals: readonly TankCreatureId[];
  private school: TankFishCounts;
  private readonly history: TankSnapshot[] = [];
  preview: TankItem | null = null;
  constructor(
    items: readonly TankItem[],
    readonly context: PlacementContext,
    babies: readonly TankCreatureId[] = [],
    fish: TankFishCounts = NO_FISH,
  ) {
    this.list = items;
    this.animals = [...new Set(babies)]
      .filter((id) => TANK_BABIES.some((b) => b.id === id))
      .slice(0, BABY_CAP);
    this.school = { ...fish };
  }
  get items() {
    return this.list;
  }
  get babies() {
    return this.animals;
  }
  /** v0.6 Pass 051: added fish by species. */
  get fish(): TankFishCounts {
    return this.school;
  }
  get canUndo(): boolean {
    return this.history.length > 0;
  }
  private remember() {
    this.history.push({
      items: this.list,
      babies: this.animals,
      fish: this.school,
    });
    if (this.history.length > UNDO_DEPTH) this.history.shift();
  }
  /** Step back one change (placing, moving, removing, or adding/returning an animal). */
  undo(): boolean {
    const last = this.history.pop();
    if (!last) return false;
    this.list = last.items;
    this.animals = last.babies;
    this.school = last.fish;
    this.preview = null;
    return true;
  }
  addBaby(id: TankCreatureId, seen: readonly Sighting[]): boolean {
    if (
      this.animals.includes(id) ||
      this.animals.length >= BABY_CAP ||
      !unlockedBabies(seen).some((b) => b.id === id)
    )
      return false;
    this.remember();
    this.animals = [...this.animals, id];
    return true;
  }
  removeBaby(id: TankCreatureId) {
    if (!this.animals.includes(id)) return;
    this.remember();
    this.animals = this.animals.filter((b) => b !== id);
  }
  /** v0.6 Pass 051: add one fish of a species, if it is offered and there is room. */
  addFish(species: SpeciesId, seen: readonly Sighting[]): FishRoom {
    const room = fishRoom(this.school, species, seen);
    if (!room.ok) return room;
    this.remember();
    this.school = addFish(this.school, species, seen) ?? this.school;
    return room;
  }
  /** Return one added fish of a species to the sea. */
  removeFish(species: SpeciesId): boolean {
    if (!(this.school[species] ?? 0)) return false;
    this.remember();
    this.school = removeFish(this.school, species);
    return true;
  }
  begin(kind: TankKind, id = `tank-${crypto.randomUUID()}`): boolean {
    if (this.list.length >= TANK_CAP) return false;
    this.preview = { id, kind, position: { x: 0, y: 0, z: 0 }, rotation: 0 };
    return true;
  }
  move(id: string): boolean {
    const item = this.list.find((i) => i.id === id);
    if (!item) return false;
    this.preview = { ...item, position: { ...item.position } };
    return true;
  }
  /** Turn the preview a step (anticlockwise seen from above; `-1` turns back). */
  turn(direction: 1 | -1 = 1) {
    if (this.preview) {
      const full = Math.PI * 2;
      this.preview = {
        ...this.preview,
        rotation:
          (((this.preview.rotation + direction * TURN_STEP) % full) + full) %
          full,
      };
    }
  }
  aim(position: Readonly<Vec3>) {
    if (this.preview)
      this.preview = { ...this.preview, position: { ...position } };
  }
  get valid() {
    return (
      !!this.preview && validPlacement(this.preview, this.list, this.context)
    );
  }
  place(): boolean {
    const preview = this.preview;
    if (!preview || !this.valid) return false;
    this.remember();
    this.list = [...this.list.filter((i) => i.id !== preview.id), preview];
    this.preview = null;
    return true;
  }
  cancel() {
    this.preview = null;
  }
  remove(id: string) {
    if (this.list.some((i) => i.id === id)) {
      this.remember();
      this.list = this.list.filter((i) => i.id !== id);
    }
    if (this.preview?.id === id) this.cancel();
  }
  /** Restore the original tank: every addition, visitor and added fish goes; Undo is cleared. */
  reset() {
    this.animals = [];
    this.list = [];
    this.school = {};
    this.history.length = 0;
    this.cancel();
  }
}

/** First unexpanded convex ray hit; used for looking at additions through real scenery. */
function rayHit(
  c: ConvexCollider,
  eye: Readonly<Vec3>,
  direction: Readonly<Vec3>,
  reach: number,
): number {
  let near = 0,
    far = reach;
  for (const p of c.planes) {
    const gap = p.offset - p.x * eye.x - p.y * eye.y - p.z * eye.z;
    const speed = p.x * direction.x + p.y * direction.y + p.z * direction.z;
    if (Math.abs(speed) < 1e-9) {
      if (gap < 0) return Infinity;
    } else if (speed > 0) far = Math.min(far, gap / speed);
    else near = Math.max(near, gap / speed);
    if (near > far) return Infinity;
  }
  return near;
}
export function targetTankItem(
  items: readonly TankItem[],
  own: readonly ConvexCollider[],
  scenery: readonly ConvexCollider[],
  eye: Readonly<Vec3>,
  direction: Readonly<Vec3>,
): string | undefined {
  let closest = 5,
    selected = -1;
  for (let i = 0; i < own.length; i++) {
    const distance = rayHit(own[i], eye, direction, closest);
    if (distance < closest) {
      closest = distance;
      selected = i;
    }
  }
  if (selected < 0) return undefined;
  for (const c of scenery)
    if (
      c !== own[selected] &&
      rayHit(c, eye, direction, closest) < closest - 1e-5
    )
      return undefined;
  return items[selected]?.id;
}
