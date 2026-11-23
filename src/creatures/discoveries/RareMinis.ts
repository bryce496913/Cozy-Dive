import * as THREE from 'three';
import type { AssetLease, AssetLoader } from '../../assets/AssetLoader';
import type { PlantPlacement } from '../../environment/HabitatRegions';
import type { FishHabitat } from '../../fish/FishHabitat';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import type { SightCandidate } from '../../discovery/journal';
import { AQUARIUM_SIGHTS } from '../../discovery/sights';
import { creatureStroke } from '../../environment/creatureStroke';
import type { Vec3 } from '../../config/world';
import {
  discoveryView,
  occludedFromChannel,
  surfaceHome,
  type DiscoveryClearance,
  type DiscoveryHome,
  type DiscoverySurfaceGroup,
} from './DiscoveryHabitat';

/**
 * V0.8 Pass 100: the aquarium's three rare miniatures. Each has one fixed, persistent home in a
 * fitting microhabitat of the existing tank (nothing is rebuilt or added to the scenery):
 *
 * - **Pikachu nudibranch** (Thecacera pacifica) crawls a slow loop on a level face of reef rock;
 * - **leaf sheep** (Costasiella kuroshimae) feeds in one of the tank's Caulerpa patches;
 * - **candy crab** (Hoplophrys oatesii) perches on a finger of one of its finger-leather corals.
 *
 * They are small (9 to 16 cm at the tank's scale, where its fish are about 40 cm) and only count
 * as seen from close by, looked at directly, so they are easy to overlook but always where they
 * were: no random spawning. Homes are chosen deterministically from the tank's own layout, keep
 * clear of the other discoveries, and each has a clear viewing spot reachable from the spawn.
 *
 * The models are the same canonical library nodes the album cards and the aquarium miniatures use
 * (`rareMinis`). Until the library loads, nothing is shown and nothing can be sighted; if it fails,
 * the tank is unchanged and nothing is lost (sightings already made stay in the journal).
 */
export type RareMiniKind = 'pikachu' | 'leafSheep' | 'candyCrab';
export const RARE_MINI_NODES: Readonly<Record<RareMiniKind, string>> = {
  pikachu: 'Pikachu_Nudibranch',
  leafSheep: 'Leaf_Sheep',
  candyCrab: 'Candy_Crab',
};
/** Tuning (m, s, rad). */
export const RARE_MINI_TUNING = {
  /** Sighted only from this close, and only near the middle of the view. */
  reach: 1.7,
  cone: 0.38,
  /** The diver this close makes them pause, stop feeding or crouch. */
  shy: 0.75,
  /** Clearance from other discoveries' homes and from each other. */
  clearance: 1.1,
  /** The nudibranch's crawl loop on its rock face, and how fast it goes round (rad/s). */
  loop: { x: 0.05, z: 0.08, rate: 0.018 },
  /**
   * Shown size relative to the model (the leaf sheep and crab are tiny animals: a little larger
   * here so that, once found, they can be made out).
   */
  scale: { pikachu: 1, leafSheep: 1.35, candyCrab: 1.3 },
  /** The crab shifts its grip now and then: every `every` s, over `takes` s. */
  shift: { every: 26, takes: 3 },
} as const;

export interface RareMiniHome extends DiscoveryHome {
  readonly kind: RareMiniKind;
  /** Surface frame: local +Y is the surface normal, +Z the resting heading. */
  readonly rotation: THREE.Quaternion;
  /** The plant it lives on (leaf sheep, candy crab). */
  readonly plant?: PlantPlacement;
}

const up = new THREE.Vector3(0, 1, 0);
function frame(
  normal: THREE.Vector3,
  heading: THREE.Vector3,
): THREE.Quaternion {
  const y = normal.clone().normalize(),
    z = heading.clone().addScaledVector(y, -heading.dot(y));
  if (z.lengthSq() < 1e-8) z.set(0, 0, 1).addScaledVector(y, -y.z);
  z.normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(x, y, z),
  );
}
const far = (p: Vec3, used: readonly DiscoveryClearance[]) =>
  used.every(
    (q) =>
      Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) >=
      (q.clearance ?? RARE_MINI_TUNING.clearance),
  );

/** Every viewable home on the plants of `species`, in a stable order (initialization only). */
function plantHomes(
  kind: 'leafSheep' | 'candyCrab',
  plants: readonly PlantPlacement[],
  species: PlantPlacement['species']['id'],
  h: FishHabitat,
  used: readonly DiscoveryClearance[],
): RareMiniHome[] {
  const homes: RareMiniHome[] = [];
  const candidates = plants
    .filter((p) => p.species.id === species)
    .slice()
    // Away from the central channel first (more sheltered), then by id (deterministic).
    .sort(
      (a, b) => Math.abs(b.position.x) - Math.abs(a.position.x) || a.id - b.id,
    );
  for (const plant of candidates) {
    const n = new THREE.Vector3(plant.normal.x, plant.normal.y, plant.normal.z),
      base = new THREE.Vector3(
        plant.position.x,
        plant.position.y,
        plant.position.z,
      ),
      // Facing the open water (the channel), where the viewer comes from.
      out = new THREE.Vector3(-Math.sign(plant.position.x) || 1, 0, 0.35)
        .addScaledVector(n, 0)
        .normalize();
    const position =
      kind === 'candyCrab'
        ? // Provisional perch half-way up the coral, on its open side (refined on the
          // authored fingers once the reef has loaded: see `perchCrab`).
          base
            .clone()
            .addScaledVector(n, plant.height * 0.5)
            .addScaledVector(out, plant.radius * 0.35)
        : // Among the Caulerpa runners, on the ground it grows from.
          base.clone().addScaledVector(n, 0.004);
    if (!far(position, used)) continue;
    const target = position.clone().addScaledVector(n, 0.05),
      view = discoveryView(target, out, h, 1.0, 0.85);
    if (!view) continue;
    const normal =
      kind === 'candyCrab' ? out.clone().multiplyScalar(0.55).add(n) : n;
    homes.push({
      id: kind === 'candyCrab' ? 'candy-crab-home' : 'leaf-sheep-home',
      sourceId: `vegetation-${plant.id}-${plant.species.id}`,
      kind,
      plant,
      position: { x: position.x, y: position.y, z: position.z },
      orientation: { x: n.x, y: n.y, z: n.z },
      homeRadius: 0.03,
      habitatKind: kind === 'candyCrab' ? 'coral-edge' : 'seagrass-meadow',
      rotation: frame(normal, kind === 'candyCrab' ? up : out),
      ...view,
      channelOccluded: occludedFromChannel(target, h),
    });
  }
  if (!homes.length) throw Error(`No viewable ${species} home for the ${kind}`);
  return homes;
}
const clearances = (
  used: readonly DiscoveryClearance[],
): DiscoveryClearance[] =>
  used.map((u) => ({
    x: u.x,
    y: u.y,
    z: u.z,
    clearance: Math.max(u.clearance ?? 0, RARE_MINI_TUNING.clearance),
  }));

/**
 * The three homes, from the tank's layout alone (pure; no WebGL). `used` are the other
 * discoveries' homes, which each keeps clear of.
 */
export function rareMiniHomes(
  h: FishHabitat,
  plants: readonly PlantPlacement[],
  groups: readonly DiscoverySurfaceGroup[],
  used: readonly DiscoveryClearance[],
): Readonly<Record<RareMiniKind, RareMiniHome>> {
  const taken = clearances(used);
  const keep = (p: Vec3) =>
    taken.push({ ...p, clearance: RARE_MINI_TUNING.clearance });
  const candyCrab = plantHomes('candyCrab', plants, 'soft-coral', h, taken)[0];
  keep(candyCrab.position);
  const leafSheep = plantHomes('leafSheep', plants, 'caulerpa', h, taken)[0];
  keep(leafSheep.position);
  // A level face of the reef's own rock (its rubble tops); the circular envelope covers the
  // whole crawl loop at every heading.
  const rock = surfaceHome(
    'nudibranch-pikachu',
    groups.filter((g) => g.id === 'reef'),
    h,
    0.17,
    0.17,
    0.05,
    taken,
    0.8,
  );
  const pikachu: RareMiniHome = {
    ...rock,
    id: 'pikachu-nudibranch-home',
    kind: 'pikachu',
    habitatKind: 'reef-face',
  };
  return { pikachu, leafSheep, candyCrab };
}
/**
 * The candy crab's homes in order of preference: every viewable finger-leather coral clear of the
 * other discoveries. The composed reef may reseat or withhold corals growing on its rocks, so the
 * crab takes the first one actually drawn (see `RareMinis.perchCrab`).
 */
export function candyCrabHomes(
  h: FishHabitat,
  plants: readonly PlantPlacement[],
  used: readonly DiscoveryClearance[],
): RareMiniHome[] {
  return plantHomes('candyCrab', plants, 'soft-coral', h, clearances(used));
}
/** Where a coral is drawn now: its template's local points and their placement, if shown. */
export type CoralLookup = (
  plant: PlantPlacement,
) => { points?: ArrayLike<number>; toWorld: THREE.Matrix4 } | undefined;

interface Animal {
  home: RareMiniHome;
  readonly pose: THREE.Group;
  /** Where it rests (moves when re-perched or settled). */
  readonly origin: THREE.Vector3;
  rotation: THREE.Quaternion;
  mesh?: THREE.Mesh;
  strokes?: { mesh: THREE.Mesh; left: number; right: number };
  readonly sight: SightCandidate & { position: Vec3 };
  /** How far it has crawled round (nudibranch) or how settled it is (others). */
  progress: number;
  /** 0 relaxed .. 1 fully shy. */
  shy: number;
}

export class RareMinis {
  readonly root = new THREE.Group();
  /** Where each lives (the crab's may change once, when it perches on a drawn coral). */
  get homes(): Readonly<Record<RareMiniKind, RareMiniHome>> {
    return {
      pikachu: this.animals.pikachu.home,
      leafSheep: this.animals.leafSheep.home,
      candyCrab: this.animals.candyCrab.home,
    };
  }
  private readonly crabOptions: readonly RareMiniHome[];
  /** Sighting candidates, present once the models are shown (updated in place). */
  readonly sightings: SightCandidate[] = [];
  private readonly animals: Record<RareMiniKind, Animal>;
  private lease?: AssetLease;
  private loader?: Pick<AssetLoader, 'evictUnused'>;
  private disposed = false;
  /** No coral to perch on was drawn: the crab is not shown. */
  private crabHidden = false;
  private readonly point = new THREE.Vector3();
  constructor(
    private readonly habitat: FishHabitat,
    plants: readonly PlantPlacement[],
    groups: readonly DiscoverySurfaceGroup[],
    used: readonly DiscoveryClearance[],
  ) {
    const h = habitat;
    this.root.name = 'Rare miniature discoveries';
    const homes = rareMiniHomes(h, plants, groups, used);
    const labels: Record<
      RareMiniKind,
      (typeof AQUARIUM_SIGHTS)[keyof typeof AQUARIUM_SIGHTS]
    > = {
      pikachu: AQUARIUM_SIGHTS.pikachu,
      leafSheep: AQUARIUM_SIGHTS.leafSheep,
      candyCrab: AQUARIUM_SIGHTS.candyCrab,
    };
    const make = (kind: RareMiniKind): Animal => {
      const home = homes[kind],
        pose = new THREE.Group();
      pose.name = RARE_MINI_NODES[kind];
      pose.visible = false;
      this.root.add(pose);
      const origin = new THREE.Vector3(
        home.position.x,
        home.position.y,
        home.position.z,
      );
      return {
        home,
        pose,
        origin,
        rotation: home.rotation.clone(),
        sight: {
          id: labels[kind].id,
          label: labels[kind].label,
          position: { ...home.position },
          radius: 0.08,
          reach: RARE_MINI_TUNING.reach,
          cone: RARE_MINI_TUNING.cone,
        },
        progress: 0,
        shy: 0,
      };
    };
    this.animals = {
      pikachu: make('pikachu'),
      leafSheep: make('leafSheep'),
      candyCrab: make('candyCrab'),
    };
    this.crabOptions = candyCrabHomes(h, plants, [
      ...used,
      { ...homes.pikachu.position, clearance: RARE_MINI_TUNING.clearance },
      { ...homes.leafSheep.position, clearance: RARE_MINI_TUNING.clearance },
    ]);
    this.pose(0, 0, false);
  }
  /** Show the canonical models (once). Resolves false if the library is unavailable. */
  async load(
    loader: Pick<AssetLoader, 'acquire' | 'evictUnused'>,
  ): Promise<boolean> {
    if (this.lease || this.disposed) return !!this.lease;
    let lease: AssetLease;
    try {
      lease = await loader.acquire('rareMinis');
    } catch {
      return false;
    }
    if (this.disposed) {
      lease.release();
      loader.evictUnused('rareMinis');
      return false;
    }
    this.lease = lease;
    this.loader = loader;
    for (const kind of Object.keys(this.animals) as RareMiniKind[]) {
      const a = this.animals[kind],
        node = lease.model.getObjectByName(RARE_MINI_NODES[kind]);
      if (!(node instanceof THREE.Mesh)) continue;
      node.removeFromParent();
      node.position.set(0, 0, 0);
      node.quaternion.identity();
      node.scale.setScalar(1);
      node.frustumCulled = true;
      a.pose.add(node);
      a.mesh = node;
      const keys = node.morphTargetDictionary;
      if (keys?.Stroke_Left !== undefined && keys.Stroke_Right !== undefined)
        a.strokes = {
          mesh: node,
          left: keys.Stroke_Left,
          right: keys.Stroke_Right,
        };
      if (kind === 'candyCrab' && this.crabHidden) continue;
      a.pose.visible = true;
      this.sightings.push(a.sight);
    }
    return true;
  }
  /**
   * Seat the crab on a coral as it is actually drawn: the first of its homes whose coral is shown
   * (`lookup`), on the finger point nearest its provisional perch in the coral's upper half, with
   * its back to the finger. A coral drawn without template points keeps the provisional perch,
   * moved with the coral. If none of its corals is shown, the crab stays hidden (and cannot be
   * sighted) rather than perch on nothing. Initialization only.
   */
  perchCrab(lookup: CoralLookup): boolean {
    const a = this.animals.candyCrab;
    for (const home of [
      a.home,
      ...this.crabOptions.filter((o) => o !== a.home),
    ]) {
      const plant = home.plant,
        found = plant && lookup(plant);
      if (!plant || !found) continue;
      a.home = home;
      const n = new THREE.Vector3(0, 1, 0).transformDirection(found.toWorld),
        axis = new THREE.Vector3().setFromMatrixPosition(found.toWorld),
        // The provisional perch, carried with the coral if the reef moved it.
        want = new THREE.Vector3(
          home.position.x,
          home.position.y,
          home.position.z,
        )
          .sub(
            new THREE.Vector3(
              plant.position.x,
              plant.position.y,
              plant.position.z,
            ),
          )
          .add(axis);
      const best = want.clone();
      if (found.points) {
        const p = new THREE.Vector3();
        let score = Infinity;
        for (let i = 0; i + 2 < found.points.length; i += 3) {
          p.set(found.points[i], found.points[i + 1], found.points[i + 2]);
          // Template units: y 0..1 along the coral's height.
          if (p.y < 0.35 || p.y > 0.8) continue;
          p.applyMatrix4(found.toWorld);
          const d = p.distanceToSquared(want);
          if (d < score) {
            score = d;
            best.copy(p);
          }
        }
      }
      const along = best.clone().sub(axis),
        radial = along.addScaledVector(n, -along.dot(n));
      const outward = radial.lengthSq() > 1e-8 ? radial.normalize() : n.clone();
      const origin = best.clone().addScaledVector(outward, 0.006);
      // A viewing spot for where it really is (the reef may have moved the coral).
      const target = origin.clone().addScaledVector(n, 0.05),
        view = discoveryView(target, outward, this.habitat, 1.0, 0.85);
      if (!view) continue;
      a.home = {
        ...home,
        position: { x: origin.x, y: origin.y, z: origin.z },
        orientation: { x: n.x, y: n.y, z: n.z },
        ...view,
        channelOccluded: occludedFromChannel(target, this.habitat),
      };
      a.origin.copy(origin);
      a.rotation = frame(outward.multiplyScalar(0.6).add(n), n);
      this.pose(0, 0, false);
      return true;
    }
    a.pose.visible = false;
    const i = this.sightings.indexOf(a.sight);
    if (i >= 0) this.sightings.splice(i, 1);
    this.crabHidden = true;
    return false;
  }
  /** Lower the nudibranch onto the authored rock `distance` m beneath its home (from its normal). */
  settleNudibranch(distance: number): void {
    const a = this.animals.pikachu,
      n = a.home.orientation;
    if (!(Math.abs(distance) < 0.3)) return;
    a.origin.set(
      a.home.position.x - n.x * distance,
      a.home.position.y - n.y * distance,
      a.home.position.z - n.z * distance,
    );
    this.pose(0, 0, false);
  }
  /**
   * Advance by `dt` active seconds at motion time `time`. Reduced motion keeps them still (they
   * stay where they are, no crawl, sway or stepping); paused, nothing is called.
   */
  update(
    time: number,
    dt: number,
    reduced: boolean,
    player?: PlayerPresence,
  ): void {
    if (this.disposed) return;
    const t = RARE_MINI_TUNING;
    for (const a of Object.values(this.animals)) {
      const p = a.sight.position,
        near =
          !!player?.active &&
          Math.hypot(
            player.position.x - p.x,
            player.position.y - p.y,
            player.position.z - p.z,
          ) < t.shy;
      a.shy += ((near ? 1 : 0) - a.shy) * Math.min(1, dt * 2);
      // The nudibranch creeps on unless the diver is close (frame-rate independent).
      if (!reduced) a.progress += dt * t.loop.rate * (1 - a.shy);
    }
    this.pose(time, 1, reduced);
  }
  private pose(time: number, effort: number, reduced: boolean): void {
    const motion = reduced ? 0 : effort;
    for (const kind of Object.keys(this.animals) as RareMiniKind[]) {
      const a = this.animals[kind];
      let stroke: number,
        yaw = 0,
        lift = 0,
        nod = 0;
      this.point.set(0, 0, 0);
      if (kind === 'pikachu') {
        const s = a.progress,
          l = RARE_MINI_TUNING.loop;
        this.point.set(l.x * Math.cos(s), 0, l.z * Math.sin(s));
        yaw = Math.atan2(-l.x * Math.sin(s), l.z * Math.cos(s));
        // The body ripples as it crawls, less when it pauses.
        stroke = motion * (1 - a.shy) * 0.7 * Math.sin(time * 1.1);
      } else if (kind === 'leafSheep') {
        // Grazing: the head dips to the Caulerpa now and then; it inches along its runner.
        const graze = Math.max(0, Math.sin(time * 0.7));
        nod = motion * (1 - a.shy) * 0.12 * graze * graze;
        this.point.z = motion * 0.008 * Math.sin(time * 0.05);
        stroke = motion * (1 - a.shy) * 0.35 * Math.sin(time * 0.6);
      } else {
        // The crab holds motion; every so often it shifts its grip a little, stepping as it goes.
        const { every, takes } = RARE_MINI_TUNING.shift,
          phase = time % every,
          moving =
            motion > 0 && phase < takes
              ? Math.sin((phase / takes) * Math.PI)
              : 0,
          turn = Math.floor(time / every) % 3;
        yaw =
          motion * ((turn - 1) * 0.18 + 0.18 * moving * (turn === 2 ? -1 : 1));
        stroke = moving * Math.sin(phase * 7);
        // Crouched against the coral when the diver is close.
        lift = -0.006 * a.shy;
      }
      this.point.y += lift;
      this.point.applyQuaternion(a.rotation);
      a.pose.position.copy(a.origin).add(this.point);
      a.pose.quaternion.copy(a.rotation);
      a.pose.rotateY(yaw);
      if (nod) a.pose.rotateX(nod);
      const k = RARE_MINI_TUNING.scale[kind];
      a.pose.scale.set(k, k * (1 - 0.08 * a.shy), k);
      if (a.strokes) creatureStroke(a.strokes.mesh, a.strokes, stroke);
      Object.assign(a.sight.position, {
        x: a.pose.position.x,
        y: a.pose.position.y,
        z: a.pose.position.z,
      });
    }
  }
  /** Where each animal is now (tests and the harness). */
  positionOf(kind: RareMiniKind): Readonly<Vec3> {
    return this.animals[kind].sight.position;
  }
  get loaded(): boolean {
    return !!this.lease;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sightings.length = 0;
    this.root.removeFromParent();
    this.root.clear();
    this.lease?.release();
    this.loader?.evictUnused('rareMinis');
    this.lease = undefined;
  }
}
