import * as THREE from 'three';
import type { AssetLease, AssetLoader } from '../../assets/AssetLoader';
import type { SightCandidate } from '../../discovery/journal';
import { OUTER_SIGHTS } from '../../discovery/sights';
import type { Sight } from '../../discovery/sights';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import type { Vec3 } from '../../config/world';
import { OUTER } from '../../config/passage';
import { creatureStroke } from '../creatureStroke';
import type { ReefPlacement } from './OuterReefLayout';
import { seabedHeight } from './OuterTerrain';

/**
 * V0.8 Pass 101: the outer reef's four rare miniatures. Each lives in one stable microhabitat
 * of the existing reef (nothing is added to the reef itself and nothing spawns at random):
 *
 * - a **pair of harlequin shrimp** (Hymenocera picta) on the sand in the shade beneath a plate
 *   coral's shelf, stepping now and then and waving their petal claws;
 * - an **ornate ghost pipefish** (Solenostomus paradoxus) hovering head-down in front of a sea
 *   fan, swaying with it;
 * - a **hairy frogfish** (Antennarius striatus) by a patch of rubble, shuffling slowly on its fins
 *   and now and then flicking its lure;
 * - a **mimic octopus** (Thaumoctopus mimicus) at a sandy margin with its burrow: out most of the
 *   time, now and then taking a flatfish or lionfish posture, and slipping into its burrow for a
 *   short while on a fixed cycle (never a rare chance).
 *
 * The homes come from the reef's own layout in a stable order, near four quiet corners of the reef
 * top inside the glass, well apart, and away from the day octopus's den. All of them are small
 * and only count as seen close up, looked at directly, so the dense water never needs clearing.
 * The models are the canonical `reefMinis` library nodes the album and the aquarium use.
 */
export type ReefMiniKind = 'harlequin' | 'pipefish' | 'frogfish' | 'mimic';
export const REEF_MINI_NODES: Readonly<Record<ReefMiniKind, string>> = {
  harlequin: 'Harlequin_Shrimp',
  pipefish: 'Ghost_Pipefish',
  frogfish: 'Hairy_Frogfish',
  mimic: 'Mimic_Octopus',
};
const SIGHT: Readonly<Record<ReefMiniKind, Sight>> = {
  harlequin: OUTER_SIGHTS.harlequinShrimp,
  pipefish: OUTER_SIGHTS.ghostPipefish,
  frogfish: OUTER_SIGHTS.hairyFrogfish,
  mimic: OUTER_SIGHTS.mimicOctopus,
};
/** Tuning (m, s, rad). */
export const REEF_MINI_TUNING = {
  /** Where each lives: the home nearest each of these reef-top points (x, z). */
  anchors: {
    harlequin: { x: -12, z: -40 },
    pipefish: { x: 9, z: -47 },
    frogfish: { x: -3, z: -53 },
    mimic: { x: 13, z: -38 },
  },
  /** The day octopus's den is near here: the mimic keeps well clear of it. */
  dayOctopus: { x: -4, z: -44, clearance: 7 },
  /** Homes keep at least this far apart. */
  spacing: 5,
  /** Sighted only from this close (m, from the eye), within this half-angle of the view. */
  reach: 2.4,
  cone: 0.4,
  /** The diver this close makes them still, hide or (octopus) slip into its burrow. */
  shy: 0.9,
  /** The octopus's cycle: out for `out` s, then in its burrow for `hidden` s. */
  burrow: { out: 52, hidden: 14 },
  /** Its mimicry: a posture every `every` s, held about `hold` s. */
  mimicry: { every: 17, hold: 5 },
} as const;

export interface ReefMiniHome {
  readonly kind: ReefMiniKind;
  /** The reef piece it lives by (stable). */
  readonly source: {
    readonly family: ReefPlacement['family'];
    readonly index: number;
  };
  readonly position: Readonly<Vec3>;
  /** Heading (rad about +Y) its head points. */
  readonly yaw: number;
  /** Where to look from: a clear spot a little above and in front of it. */
  readonly view: Readonly<Vec3>;
}

/** The reef top inside the glass, away from its edges (where the swimmer explores). */
function inside(p: Readonly<Vec3>): boolean {
  const g = OUTER.glass;
  return (
    Math.abs(p.x) < OUTER.reach.halfWidth - 3 &&
    p.z > g.z + 3 &&
    p.z < OUTER.cliffZ - 4
  );
}
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);

/**
 * The four homes from the reef's layout alone (pure; no WebGL). `placements` are the reef's
 * pieces as drawn (seated on the rocks).
 */
export function reefMiniHomes(
  placements: readonly ReefPlacement[],
): Readonly<Record<ReefMiniKind, ReefMiniHome>> {
  const t = REEF_MINI_TUNING,
    taken: Vec3[] = [];
  const pick = (
    kind: ReefMiniKind,
    families: readonly ReefPlacement['family'][],
    accept: (p: ReefPlacement) => boolean = () => true,
  ) => {
    const a = t.anchors[kind];
    let best = -1;
    placements.forEach((p, i) => {
      if (
        !families.includes(p.family) ||
        !inside(p.position) ||
        !accept(p) ||
        taken.some((q) => flat(q, p.position) < t.spacing)
      )
        return;
      if (best < 0 || flat(p.position, a) < flat(placements[best].position, a))
        best = i;
    });
    if (best < 0) throw Error(`No reef home for the ${kind}`);
    return best;
  };
  // Towards the open water (the tunnel side, +z), where the swimmer comes from.
  const out = (p: Readonly<Vec3>, r: number, angle = 0) => ({
    x: p.x + Math.sin(angle) * r,
    z: p.z + Math.cos(angle) * r,
  });
  const home = (
    kind: ReefMiniKind,
    index: number,
    at: { x: number; y: number; z: number },
    yaw: number,
    lift: number,
  ): ReefMiniHome => {
    taken.push(at);
    const p = placements[index];
    return {
      kind,
      source: { family: p.family, index },
      position: at,
      yaw,
      view: { x: at.x, y: at.y + lift, z: at.z + 1.1 },
    };
  };
  // Harlequin shrimp: on the sand at the foot of a plate coral that stands on the seabed, in the
  // shade under its shelf.
  const plateIndex = pick(
      'harlequin',
      ['plate'],
      (p) => p.position.y - seabedHeight(p.position.x, p.position.z) < 0.3,
    ),
    plate = placements[plateIndex],
    under = out(plate.position, 0.28 * plate.scale.x);
  const harlequin = home(
    'harlequin',
    plateIndex,
    { ...under, y: seabedHeight(under.x, under.z) },
    Math.PI,
    0.55,
  );
  // Ghost pipefish: in front of a sea fan's face, half-way up, head down.
  const fanIndex = pick('pipefish', ['fan']),
    fan = placements[fanIndex],
    face = out(fan.position, 0.14, fan.yaw);
  const pipefish = home(
    'pipefish',
    fanIndex,
    { ...face, y: fan.position.y + 0.45 * fan.scale.y },
    fan.yaw,
    0.15,
  );
  // Hairy frogfish: on the sand beside rubble.
  const rubbleIndex = pick('frogfish', ['rubble', 'shell']),
    rubble = placements[rubbleIndex],
    beside = out(rubble.position, 0.35 * Math.max(rubble.scale.x, 0.6));
  const frogfish = home(
    'frogfish',
    rubbleIndex,
    { ...beside, y: seabedHeight(beside.x, beside.z) },
    0.4,
    0.6,
  );
  // Mimic octopus: on open sand at the edge of a seagrass patch, far from the day octopus.
  const d = t.dayOctopus,
    grassIndex = pick(
      'mimic',
      ['grass', 'blade'],
      (p) => flat(p.position, d) > d.clearance,
    ),
    grass = placements[grassIndex],
    margin = out(grass.position, 0.9 * Math.max(grass.scale.x, 0.8));
  const mimic = home(
    'mimic',
    grassIndex,
    { ...margin, y: seabedHeight(margin.x, margin.z) },
    -0.6,
    0.8,
  );
  return { harlequin, pipefish, frogfish, mimic };
}

/** The octopus's burrow cycle at time `t` (s): 0 out .. 1 in its burrow. */
export function burrowAt(t: number): number {
  const { out, hidden } = REEF_MINI_TUNING.burrow,
    phase = t % (out + hidden),
    ease = 2;
  if (phase < out - ease) return 0;
  if (phase < out) return (phase - (out - ease)) / ease;
  if (phase < out + hidden - ease) return 1;
  return 1 - (phase - (out + hidden - ease)) / ease;
}
/** Its mimicry posture at `t`: which (0 flatfish, 1 lionfish) and how far (0..1). */
export function mimicryAt(t: number): { posture: 0 | 1; amount: number } {
  const { every, hold } = REEF_MINI_TUNING.mimicry,
    n = Math.floor(t / every),
    phase = t - n * every,
    amount = phase < hold ? Math.sin((phase / hold) * Math.PI) : 0;
  return { posture: (n % 2) as 0 | 1, amount: Math.min(1, amount * 1.6) };
}

interface Animal {
  readonly kind: ReefMiniKind;
  readonly pose: THREE.Group;
  readonly origin: THREE.Vector3;
  readonly yaw: number;
  readonly sight: SightCandidate & { position: Vec3 };
  meshes: THREE.Mesh[];
  shy: number;
  /** Its own movement time: it stops while the diver is close (frame-rate independent). */
  progress: number;
}

/** Owner of the four animals' scene objects, behaviour and sighting candidates. */
export class ReefMinis {
  readonly root = new THREE.Group();
  readonly homes: Readonly<Record<ReefMiniKind, ReefMiniHome>>;
  /** Sighting candidates (once the models are shown), updated in place. */
  readonly sightings: SightCandidate[] = [];
  private readonly animals: Animal[] = [];
  private lease?: AssetLease;
  private loader?: Pick<AssetLoader, 'evictUnused'>;
  private disposed = false;
  private time = 0;
  /** The second shrimp of the pair (a clone of the first). */
  private readonly partner: THREE.Group;
  private readonly morphs = new Map<
    THREE.Mesh,
    { left: number; right: number; flat?: number; lion?: number }
  >();

  constructor(placements: readonly ReefPlacement[]) {
    this.root.name = 'Outer reef rare miniatures';
    this.homes = reefMiniHomes(placements);
    for (const kind of Object.keys(REEF_MINI_NODES) as ReefMiniKind[]) {
      const h = this.homes[kind],
        pose = new THREE.Group();
      pose.name = REEF_MINI_NODES[kind];
      pose.visible = false;
      this.root.add(pose);
      this.animals.push({
        kind,
        pose,
        origin: new THREE.Vector3(h.position.x, h.position.y, h.position.z),
        yaw: h.yaw,
        sight: {
          id: SIGHT[kind].id,
          label: SIGHT[kind].label,
          position: { ...h.position },
          radius: kind === 'mimic' ? 0.25 : 0.08,
          reach: REEF_MINI_TUNING.reach,
          cone: REEF_MINI_TUNING.cone,
        },
        meshes: [],
        shy: 0,
        progress: 0,
      });
    }
    this.partner = new THREE.Group();
    this.partner.name = 'Harlequin_Shrimp_Partner';
    this.partner.visible = false;
    this.root.add(this.partner);
    this.pose(false);
  }
  /** Show the canonical models (once). Resolves false if the library is unavailable. */
  async load(
    loader: Pick<AssetLoader, 'acquire' | 'evictUnused'>,
  ): Promise<boolean> {
    if (this.lease || this.disposed) return !!this.lease;
    let lease: AssetLease;
    try {
      lease = await loader.acquire('reefMinis');
    } catch {
      return false;
    }
    if (this.disposed) {
      lease.release();
      loader.evictUnused('reefMinis');
      return false;
    }
    this.lease = lease;
    this.loader = loader;
    for (const a of this.animals) {
      const node = lease.model.getObjectByName(REEF_MINI_NODES[a.kind]);
      if (!(node instanceof THREE.Mesh)) continue;
      node.removeFromParent();
      node.position.set(0, 0, 0);
      node.quaternion.identity();
      node.scale.setScalar(1);
      a.pose.add(node);
      a.meshes = [node];
      if (a.kind === 'harlequin') {
        // Its mate: the same model (shared geometry and material), its own morph weights.
        const mate = node.clone();
        mate.morphTargetInfluences = node.morphTargetInfluences?.slice();
        this.partner.add(mate);
        this.partner.visible = true;
        a.meshes.push(mate);
      }
      for (const m of a.meshes) {
        const k = m.morphTargetDictionary;
        if (k?.Stroke_Left === undefined || k.Stroke_Right === undefined)
          continue;
        this.morphs.set(m, {
          left: k.Stroke_Left,
          right: k.Stroke_Right,
          flat: k.Mimic_Flatfish,
          lion: k.Mimic_Lionfish,
        });
      }
      a.pose.visible = true;
      this.sightings.push(a.sight);
    }
    this.pose(false);
    return true;
  }
  /**
   * Advance by `dt` active seconds. Paused, nothing is called. Reduced motion keeps them still in
   * their resting poses (the octopus stays out, with no postures).
   */
  update(dt: number, reduced: boolean, player?: PlayerPresence): void {
    if (this.disposed || !(dt > 0)) return;
    const step = Math.min(dt, 0.1);
    if (!reduced) this.time += step;
    for (const a of this.animals) {
      const p = a.sight.position,
        near =
          !!player?.active &&
          Math.hypot(
            player.position.x - p.x,
            player.position.y - p.y,
            player.position.z - p.z,
          ) < REEF_MINI_TUNING.shy;
      a.shy += ((near ? 1 : 0) - a.shy) * Math.min(1, step * 1.5);
      if (!reduced) a.progress += step * (1 - a.shy);
    }
    this.pose(reduced);
  }
  private readonly offset = new THREE.Vector3();
  private pose(reduced: boolean): void {
    const t = this.time,
      move = reduced ? 0 : 1;
    for (const a of this.animals) {
      let stroke = 0,
        lift = 0,
        pitch = 0,
        turn = 0,
        squash = 1,
        flatW = 0,
        lionW = 0;
      this.offset.set(0, 0, 0);
      switch (a.kind) {
        case 'harlequin': {
          // Small deliberate steps now and then; claws waving slowly. Shy: they hold still.
          const s = a.progress,
            step = Math.max(0, Math.sin(s * 0.35)) ** 6;
          this.offset.set(0.02 * Math.sin(s * 0.07), 0, 0.015 * step);
          stroke = move * (1 - a.shy) * 0.6 * Math.sin(t * 1.3);
          turn = 0.25 * Math.sin(t * 0.05);
          break;
        }
        case 'pipefish': {
          // Hovering head-down, swaying with the fan; it turns its side to a close diver.
          pitch = -1.25;
          this.offset.set(
            0.012 * Math.sin(t * 0.6),
            0.008 * Math.sin(t * 0.45),
            0,
          );
          stroke = move * 0.5 * Math.sin(t * 0.6);
          turn = 0.6 * a.shy;
          break;
        }
        case 'frogfish': {
          // A slow shuffle on its fins along a short path, a pause, and back; frozen when shy.
          const s = a.progress,
            walk = Math.sin(s * 0.03);
          this.offset.set(0.12 * walk, 0, 0.05 * Math.sin(s * 0.06));
          const walking = Math.abs(Math.cos(s * 0.03)) * (1 - a.shy);
          stroke = move * walking * Math.sin(s * 2.2);
          turn = 0.5 * Math.cos(s * 0.03);
          break;
        }
        case 'mimic': {
          // Out on the sand; now and then a flatfish or lionfish posture; at times in its burrow
          // (it slips in quickly if the diver comes very close).
          const hidden = Math.max(reduced ? 0 : burrowAt(t), a.shy);
          lift = -0.07 * hidden;
          squash = 1 - 0.7 * hidden;
          const m = reduced ? { posture: 0, amount: 0 } : mimicryAt(t);
          flatW = m.posture === 0 ? m.amount : 0;
          lionW = m.posture === 1 ? m.amount : 0;
          stroke = move * (1 - hidden) * 0.5 * Math.sin(t * 0.8);
          turn = 0.3 * Math.sin(t * 0.04);
          // While in its burrow it cannot be seen (its candidate moves out of the world).
          a.sight.position.y = hidden > 0.5 ? -1e4 : a.origin.y;
          break;
        }
      }
      if (reduced) {
        this.offset.set(0, 0, 0);
        turn = a.kind === 'pipefish' ? turn : 0;
      }
      a.pose.position.copy(a.origin).add(this.offset);
      a.pose.position.y += lift;
      a.pose.rotation.set(pitch, a.yaw + turn, 0, 'YXZ');
      a.pose.scale.set(1, squash, 1);
      for (const mesh of a.meshes) {
        const k = this.morphs.get(mesh);
        if (!k) continue;
        creatureStroke(mesh, k, stroke);
        const w = mesh.morphTargetInfluences!;
        if (k.flat !== undefined) w[k.flat] = flatW;
        if (k.lion !== undefined) w[k.lion] = lionW;
      }
      if (a.kind === 'harlequin') {
        // The mate, a hand's width beside it, a little out of step.
        this.partner.position.set(
          a.pose.position.x + 0.09,
          a.pose.position.y,
          a.pose.position.z - 0.03,
        );
        this.partner.rotation.set(0, a.yaw + 0.5 - turn, 0);
        const mate = a.meshes[1];
        const k = mate && this.morphs.get(mate);
        if (k) creatureStroke(mate, k, -stroke * 0.8);
      }
      if (a.kind !== 'mimic' || a.sight.position.y > -1e3) {
        a.sight.position.x = a.pose.position.x;
        a.sight.position.y = a.pose.position.y;
        a.sight.position.z = a.pose.position.z;
      }
    }
  }
  /** Where an animal is now (tests, the harness). */
  positionOf(kind: ReefMiniKind): Readonly<Vec3> {
    return this.animals.find((a) => a.kind === kind)!.pose.position;
  }
  /** Its sighting position (moved out of the world while the octopus is in its burrow). */
  sightOf(kind: ReefMiniKind): Readonly<Vec3> {
    return this.animals.find((a) => a.kind === kind)!.sight.position;
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
    this.loader?.evictUnused('reefMinis');
    this.lease = undefined;
  }
}
