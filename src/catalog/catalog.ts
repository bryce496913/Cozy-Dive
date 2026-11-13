import type { Sighting, JournalStore } from '../discovery/journal';
import { AQUARIUM, type Vec3 } from '../config/world';
import type { ConvexCollider } from '../player/collision';

export const TANK_KEY = 'cozy-diver.tank.v1';
export const TANK_CAP = 20;
export const TANK_ITEMS = [
  {
    kind: 'boulder',
    sighting: 'coral:boulder',
    label: 'Boulder coral',
    node: 'Coral_Massive_0',
    width: 1.05,
    depth: 0.95,
    height: 0.8,
  },
  {
    kind: 'branching',
    sighting: 'coral:branching',
    label: 'Branching coral',
    node: 'Coral_Branching_0',
    width: 0.95,
    depth: 0.9,
    height: 1.1,
  },
  {
    kind: 'plate',
    sighting: 'coral:plate',
    label: 'Plate coral',
    node: 'Coral_Plate_0',
    width: 1.15,
    depth: 1.05,
    height: 0.65,
  },
  {
    kind: 'soft',
    sighting: 'coral:soft',
    label: 'Soft coral',
    node: 'Soft_Coral_0',
    width: 0.8,
    depth: 0.8,
    height: 1,
  },
  {
    kind: 'sea-fan',
    sighting: 'coral:sea-fan',
    label: 'Sea fan',
    node: 'Sea_Fan_0',
    width: 1,
    depth: 0.4,
    height: 1.15,
  },
  {
    kind: 'seagrass',
    sighting: 'plant:seagrass',
    label: 'Seagrass patch',
    node: 'Turtle_Grass_0',
    width: 0.8,
    depth: 0.8,
    height: 0.65,
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
  return TANK_ITEMS.filter((i) => seen.some((s) => s.id === i.sighting));
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
    const support = c.surface(p.x + dx, p.z + dz);
    if (support > p.y + 0.12 || support < p.y - 0.45) return false;
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
export function loadTank(
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
      data.version !== 1 ||
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
export function saveTank(
  store: JournalStore,
  items: readonly TankItem[],
): boolean {
  try {
    store.setItem(TANK_KEY, JSON.stringify({ version: 1, items }));
    return true;
  } catch {
    return false;
  }
}
/** Transactions retain the original item while moving; cancellation never loses it. */
export class TankCatalog {
  private list: readonly TankItem[];
  preview: TankItem | null = null;
  constructor(
    items: readonly TankItem[],
    readonly context: PlacementContext,
  ) {
    this.list = items;
  }
  get items() {
    return this.list;
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
  turn() {
    if (this.preview)
      this.preview = {
        ...this.preview,
        rotation: (this.preview.rotation + Math.PI / 6) % (Math.PI * 2),
      };
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
    if (!this.preview || !this.valid) return false;
    this.list = [
      ...this.list.filter((i) => i.id !== this.preview!.id),
      this.preview,
    ];
    this.preview = null;
    return true;
  }
  cancel() {
    this.preview = null;
  }
  remove(id: string) {
    this.list = this.list.filter((i) => i.id !== id);
    if (this.preview?.id === id) this.cancel();
  }
  reset() {
    this.list = [];
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
