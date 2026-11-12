import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import type { AssetLease, AssetLoader } from '../../assets/AssetLoader';
import { isCollisionNode } from '../../assets/AssetValidation';
import type { ConvexCollider } from '../../player/collision';
import { triplanarMaterial } from '../../rendering/Triplanar';
import { authoredPlantGeometry } from '../AuthoredReef';
import { boxCollider } from '../passage/Crevice';
import { REEF_LAYOUT } from '../ReefLayout';
import { createRockGeometry } from '../RockGeometry';
import { rockCollider } from '../rockCollider';
import { LevelInstances, type DetailLevel } from './LevelInstances';
import { seabedHeight } from './OuterTerrain';
import {
  outerReefLayout,
  type ReefFamily,
  type ReefLayout,
  type ReefPlacement,
} from './OuterReefLayout';

/**
 * v0.4 Pass 024: the outer reef, dressed from the same authored reef library as the tank (rocks,
 * corals, soft corals, sea fans, seagrass, shells and rubble), so both places share one look.
 *
 * Every piece is instanced per template and detail level, re-sorted by distance a few times a
 * second, so the reef costs a fixed, small number of draws however many pieces it has. Rocks and
 * corals collide through their authored convex parts; fish get one coarse box per piece. The
 * library is leased from the tank's own loader, so nothing is decoded twice. If it cannot load,
 * plain procedural rocks stand in at the same places.
 */
/**
 * Detail distances (m), chosen from measured library budgets: rocks are 20k / 5k / 1.3k
 * triangles, massive corals 82k (5k far), branching 45k (16k far), plates 17k (no far level),
 * soft corals and fans 7-13k. Beyond the last distance a piece is not drawn (fog hides it).
 */
export const OUTER_DETAIL = {
  // Pass 026: the reef top is far denser, so full detail is kept closer (fog hides the rest).
  rock: [4, 10, 40],
  /** Massive colonies: full, far level, then a 1.3k-triangle mound in their own colour. */
  massive: [2.5, 11, 40],
  branching: [3.5, 11],
  plate: 13,
  plant: 13,
  debris: 12,
  /** Re-sort when the eye has moved this far, or this often (s). */
  resortDistance: 1.5,
  resortInterval: 0.4,
} as const;
const CORAL_NODES: Partial<Record<ReefFamily, string>> = {
  branching: 'Coral_Branching',
  massive: 'Coral_Massive',
  plate: 'Coral_Plate',
};
const PLANT_NODES: Partial<Record<ReefFamily, string>> = {
  soft: 'Soft_Coral',
  fan: 'Sea_Fan',
  grass: 'Turtle_Grass',
  blade: 'Meadow_Blade',
};
const PLANT_MOTION: Partial<
  Record<ReefFamily, { sway: number; frequency: number }>
> = {
  soft: { sway: 0.06, frequency: 0.55 },
  fan: { sway: 0.035, frequency: 0.45 },
  grass: { sway: 0.07, frequency: 0.7 },
  blade: { sway: 0.075, frequency: 0.65 },
};

/** A library mesh's material (library pieces are single-material). */
function single(mesh: THREE.Mesh): THREE.Material {
  if (Array.isArray(mesh.material))
    throw Error(`${mesh.name}: expected a single material`);
  return mesh.material;
}
/**
 * Top of a convex hull above (x, z), or -Infinity when (x, z) is outside it. Exact: the hull is
 * the intersection of its planes, so its top is the lowest upward-facing plane over the point.
 */
export function hullTop(c: ConvexCollider, x: number, z: number): number {
  if (x < c.min.x || x > c.max.x || z < c.min.z || z > c.max.z)
    return -Infinity;
  let top = Infinity,
    bottom = -Infinity;
  for (const p of c.planes) {
    const rest = p.offset - p.x * x - p.z * z;
    if (p.y > 1e-6) top = Math.min(top, rest / p.y);
    else if (p.y < -1e-6) bottom = Math.max(bottom, rest / p.y);
    else if (rest < 0) return -Infinity;
  }
  return top >= bottom ? top : -Infinity;
}
/** Colonies and soft corals seated on the rock (or sand) actually beneath them. */
export function seatOnRocks(
  placements: readonly ReefPlacement[],
  rocks: readonly ConvexCollider[],
  ground: (x: number, z: number) => number,
): ReefPlacement[] {
  return placements.map((p) => {
    if (!SEATED.has(p.family)) return p;
    let top = ground(p.position.x, p.position.z);
    for (const c of rocks)
      top = Math.max(top, hullTop(c, p.position.x, p.position.z));
    return { ...p, position: { ...p.position, y: top - 0.12 } };
  });
}
const SEATED = new Set<ReefFamily>([
  'branching',
  'massive',
  'plate',
  'soft',
  'fan',
]);
export function placementMatrix(p: ReefPlacement): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(p.position.x, p.position.y, p.position.z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw),
    new THREE.Vector3(p.scale.x, p.scale.y, p.scale.z),
  );
}

export class OuterReef {
  readonly root = new THREE.Group();
  /** Resolves true once dressed from the library (false: procedural stand-ins). */
  readonly ready: Promise<boolean>;
  /** Exact collision for the swimmer. */
  readonly colliders: ConvexCollider[] = [];
  /** Coarse obstacles for fish (one box per rock or colony). */
  readonly fishObstacles: ConvexCollider[] = [];
  /** The seabed's authored sand material, once ready (for the terrain mesh). */
  sand?: THREE.MeshStandardMaterial;
  /** The reef rock material, once ready (for the tunnel and cliff). */
  rock?: THREE.MeshStandardMaterial;
  readonly placements: readonly ReefPlacement[];
  readonly heads: ReefLayout['heads'];
  private readonly sets: LevelInstances[] = [];
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly textures: THREE.Texture[] = [];
  private readonly plantTime = { value: 0 };
  private lease?: AssetLease;
  /** Placements with colonies seated on the rocks (once the rocks' hulls exist). */
  private seated: readonly ReefPlacement[];
  private readonly eye = new THREE.Vector3(Infinity, 0, 0);
  private sinceSort = Infinity;
  private disposed = false;

  constructor(
    loader: AssetLoader,
    private readonly plantSource: THREE.MeshStandardMaterial,
  ) {
    this.root.name = 'Outer reef';
    const layout = outerReefLayout();
    this.placements = layout.placements;
    this.heads = layout.heads;
    this.seated = this.placements;
    this.ready = this.started.then(() => this.load(loader));
  }
  /**
   * Pass 026: start building (leasing the library, instancing, collision). Until then the reef
   * costs nothing: the outer waters call this once the swimmer is in the tunnel.
   */
  begin(): void {
    this.go();
  }
  private go: () => void = () => {};
  private readonly started = new Promise<void>((resolve) => {
    this.go = resolve;
  });

  private own<T extends THREE.Material | THREE.BufferGeometry>(value: T): T {
    if (value instanceof THREE.Material) this.materials.add(value);
    else this.geometries.add(value);
    return value;
  }
  private node(name: string): THREE.Mesh | undefined {
    const n = this.lease?.model.getObjectByName(name);
    return n instanceof THREE.Mesh ? n : undefined;
  }
  private part(name: string): THREE.Mesh {
    const n = this.node(name);
    if (!n) throw Error(`Missing reef node ${name}`);
    return n;
  }
  private standard(name: string): THREE.MeshStandardMaterial {
    const m = this.part(name).material;
    if (!(m instanceof THREE.MeshStandardMaterial))
      throw Error(`${name}: reef material is not PBR`);
    return m;
  }

  private async load(loader: AssetLoader): Promise<boolean> {
    try {
      this.lease = await loader.acquire('reef');
    } catch {
      if (!this.disposed) this.buildFallback();
      return false;
    }
    if (this.disposed) {
      this.lease.release();
      this.lease = undefined;
      return false;
    }
    try {
      this.lease.model.updateMatrixWorld(true);
      this.build();
      return true;
    } catch (error) {
      console.error('Cozy Diver: outer reef dressing unavailable.', error);
      this.clear();
      this.buildFallback();
      return false;
    }
  }

  /** Hull geometries of a library piece, in its own space (built once per template). */
  private hulls(root: string): THREE.BufferGeometry[] {
    const node = this.lease!.model.getObjectByName(root),
      out: THREE.BufferGeometry[] = [];
    node?.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !isCollisionNode(o)) return;
      const p = o.geometry.getAttribute('position'),
        points: THREE.Vector3[] = [];
      for (let i = 0; i < p.count; i++)
        points.push(new THREE.Vector3().fromBufferAttribute(p, i));
      out.push(this.own(new ConvexGeometry(points)));
    });
    return out;
  }
  /** Add collision (exact for the swimmer, a box for fish) for copies of one piece. */
  private collide(
    hulls: THREE.BufferGeometry[],
    matrices: THREE.Matrix4[],
  ): void {
    for (const m of matrices) {
      const min = new THREE.Vector3(Infinity, Infinity, Infinity),
        max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
      for (const hull of hulls) {
        const c = rockCollider(hull, m);
        this.colliders.push(c);
        min.min(new THREE.Vector3(c.min.x, c.min.y, c.min.z));
        max.max(new THREE.Vector3(c.max.x, c.max.y, c.max.z));
      }
      if (hulls.length)
        this.fishObstacles.push(
          boxCollider([min.x, min.y, min.z], [max.x, max.y, max.z]),
        );
    }
  }
  private add(
    name: string,
    levels: DetailLevel[],
    material: THREE.Material,
    matrices: THREE.Matrix4[],
  ): void {
    const set = new LevelInstances(name, levels, material, matrices);
    for (const mesh of set.drawn) this.root.add(mesh);
    this.sets.push(set);
  }
  private groups(family: ReefFamily): Map<number, THREE.Matrix4[]> {
    const map = new Map<number, THREE.Matrix4[]>();
    for (const p of this.seated)
      if (p.family === family) {
        let list = map.get(p.template);
        if (!list) map.set(p.template, (list = []));
        list.push(placementMatrix(p));
      }
    return map;
  }
  private plantMaterial(source: string): THREE.MeshStandardMaterial {
    const base = this.standard(source),
      m = this.own(this.plantSource.clone());
    m.map = base.map;
    m.normalMap = base.normalMap;
    m.normalScale.set(0.6, 0.6);
    m.roughnessMap = base.roughnessMap;
    m.roughness = 0.9;
    // The tank's sway shader, driven by this reef's own clock.
    const inject = this.plantSource.onBeforeCompile,
      time = this.plantTime;
    m.onBeforeCompile = (shader, renderer) => {
      inject.call(this.plantSource, shader, renderer);
      shader.uniforms.plantTime = time;
    };
    m.customProgramCacheKey = () => 'cozy-plants-authored-v1';
    return m;
  }

  private build(): void {
    const D = OUTER_DETAIL;
    // Rocks: three detail levels, the reef's tinted limestone.
    this.rock = this.own(
      triplanarMaterial(this.standard('Rock_0'), {
        scale: REEF_LAYOUT.rockTexelScale,
        ao: 0.55,
      }),
    );
    this.rock.vertexColors = true;
    this.rock.color.setHex(0xe4e6dc);
    for (const [t, matrices] of this.groups('rock')) {
      this.add(
        `Outer rock ${t}`,
        [
          { geometry: this.part(`Rock_${t}`).geometry, until: D.rock[0] },
          { geometry: this.part(`Rock_${t}_LOD1`).geometry, until: D.rock[1] },
          { geometry: this.part(`Rock_${t}_LOD2`).geometry, until: D.rock[2] },
          // Pass 026: beyond this the fog has them entirely.
          { geometry: null, until: Infinity },
        ],
        this.rock,
        matrices,
      );
      this.collide(this.hulls(`Rock_${t}_Root`), matrices);
    }
    // Backdrop: far detail only, a little cooler and darker.
    const backdrop = this.own(this.rock.clone());
    backdrop.onBeforeCompile = this.rock.onBeforeCompile;
    backdrop.customProgramCacheKey = this.rock.customProgramCacheKey;
    backdrop.color.setHex(0xc6ceca);
    for (const [t, matrices] of this.groups('backdrop')) {
      this.add(
        `Outer backdrop ${t}`,
        [{ geometry: this.part(`Rock_${t}_LOD2`).geometry, until: Infinity }],
        backdrop,
        matrices,
      );
      this.collide(this.hulls(`Rock_${t}_Root`), matrices);
    }
    // Seat colonies, soft corals and fans on the rocks now that their hulls exist.
    this.seated = seatOnRocks(this.placements, this.colliders, seabedHeight);
    // Corals: authored materials (the massive colonies triplanar, as in the tank).
    const massive = this.own(
      triplanarMaterial(this.standard('Coral_Massive_0'), {
        scale: REEF_LAYOUT.coralTexelScale,
        ao: 0.5,
      }),
    );
    massive.vertexColors = true;
    for (const family of ['branching', 'massive', 'plate'] as const)
      for (const [t, matrices] of this.groups(family)) {
        const name = `${CORAL_NODES[family]}_${t}`;
        for (const suffix of ['', '_Tips']) {
          const near = this.node(name + suffix);
          if (!near) continue;
          const far = this.node(`${name}${suffix}_LOD1`),
            reach: readonly number[] =
              family === 'massive' ? D.massive : D.branching,
            material = family === 'massive' && t < 2 ? massive : single(near);
          this.add(
            `Outer coral ${name}${suffix}`,
            far
              ? [
                  { geometry: near.geometry, until: reach[0] },
                  { geometry: far.geometry, until: reach[1] },
                  { geometry: null, until: Infinity },
                ]
              : [
                  { geometry: near.geometry, until: D.plate },
                  { geometry: null, until: Infinity },
                ],
            material,
            matrices,
          );
        }
        // Pass 026: far massive colonies become simple mounds in their colony's own colour (the
        // coral material on the rock-derived mound read as pale stones in the denser reef).
        if (family === 'massive')
          this.add(
            `Outer coral ${name} mound`,
            [
              { geometry: null, until: D.massive[1] },
              { geometry: this.mound(), until: D.massive[2] },
              { geometry: null, until: Infinity },
            ],
            this.moundMaterial(t),
            matrices,
          );
        this.collide(this.hulls(`${name}_Root`), matrices);
      }
    // Soft corals, sea fans and seagrass, swaying in the reef's current.
    const tissue = this.plantMaterial('Sea_Fan_0'),
      algae = this.plantMaterial('Caulerpa_0');
    for (const family of ['soft', 'fan', 'grass', 'blade'] as const)
      for (const [t, matrices] of this.groups(family)) {
        const geometry = this.own(
          authoredPlantGeometry(
            this.part(`${PLANT_NODES[family]}_${t}`).geometry,
            PLANT_MOTION[family]!,
          ),
        );
        this.add(
          `Outer ${family} ${t}`,
          [
            { geometry, until: D.plant },
            { geometry: null, until: Infinity },
          ],
          family === 'soft' || family === 'fan' ? tissue : algae,
          matrices,
        );
      }
    // Shells and rubble, only near the eye.
    for (const family of ['shell', 'rubble'] as const)
      for (const [t, matrices] of this.groups(family)) {
        const node = this.part(
          `${family === 'shell' ? 'Shell' : 'Rubble'}_${t}`,
        );
        this.add(
          `Outer ${family} ${t}`,
          [
            { geometry: node.geometry, until: D.debris },
            { geometry: null, until: Infinity },
          ],
          single(node),
          matrices,
        );
      }
    // The seabed's sand.
    const sand = this.standard('Sand_Material'),
      m = this.own(sand.clone());
    for (const slot of ['map', 'normalMap', 'roughnessMap'] as const) {
      const texture = m[slot];
      if (!texture) continue;
      const t = texture.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(36, 36);
      t.needsUpdate = true;
      this.textures.push(t);
      m[slot] = t;
    }
    m.normalScale.set(0.9, 0.9);
    m.vertexColors = true;
    m.roughness = 1;
    this.sand = m;
  }

  /** Far mounds' colours, per massive template (dusky mauve, olive and brown, as up close). */
  private moundMaterial(template: number): THREE.MeshStandardMaterial {
    const colours = [0x6b5466, 0x5f6a48, 0x6e5c48];
    return this.own(
      new THREE.MeshStandardMaterial({
        color: colours[template % colours.length],
        roughness: 0.95,
        metalness: 0,
      }),
    );
  }
  /** A far mound for massive colonies: the reef's lightest rock, set on y 0 like a colony. */
  private moundGeometry?: THREE.BufferGeometry;
  private mound(): THREE.BufferGeometry {
    if (!this.moundGeometry) {
      const g = this.own(this.part('Rock_2_LOD2').geometry.clone());
      g.scale(0.85, 0.75, 0.85);
      g.computeBoundingBox();
      g.translate(0, -g.boundingBox!.min.y - 0.05, 0);
      this.moundGeometry = g;
    }
    return this.moundGeometry;
  }
  /** If the library cannot load: plain rocks at the same places, so the reef is still solid. */
  private buildFallback(): void {
    const material = this.own(
      new THREE.MeshStandardMaterial({
        color: 0x7d8a80,
        vertexColors: true,
        roughness: 0.96,
      }),
    );
    for (const [t, matrices] of this.groups('rock')) {
      const geometry = this.own(createRockGeometry(9300 + t * 31, t % 4));
      this.add(
        `Outer rock ${t} (fallback)`,
        [{ geometry, until: Infinity }],
        material,
        matrices,
      );
      for (const m of matrices) {
        const c = rockCollider(geometry, m);
        this.colliders.push(c);
        this.fishObstacles.push(
          boxCollider([c.min.x, c.min.y, c.min.z], [c.max.x, c.max.y, c.max.z]),
        );
      }
    }
  }

  /** Placements as drawn: colonies seated on the rocks beneath them once ready (Pass 025). */
  get drawnPlacements(): readonly ReefPlacement[] {
    return this.seated;
  }
  /** Re-sort pieces into detail levels as the eye moves, and advance the plants' sway. */
  update(eye: THREE.Vector3, dt: number, reducedMotion: boolean): void {
    if (this.disposed) return;
    if (!reducedMotion) this.plantTime.value += Math.min(dt, 0.1);
    this.sinceSort += dt;
    if (
      this.eye.distanceTo(eye) < OUTER_DETAIL.resortDistance &&
      this.sinceSort < OUTER_DETAIL.resortInterval
    )
      return;
    this.eye.copy(eye);
    this.sinceSort = 0;
    for (const set of this.sets) set.update(eye.x, eye.y, eye.z);
  }
  /** Copies drawn at each level, summed over the reef (for budgets). */
  drawnCounts(): { pieces: number; draws: number } {
    let pieces = 0,
      draws = 0;
    for (const set of this.sets)
      for (const n of set.counts()) {
        pieces += n;
        if (n) draws++;
      }
    return { pieces, draws };
  }

  private clear(): void {
    this.sets.forEach((s) => s.dispose());
    this.sets.length = 0;
    this.colliders.length = 0;
    this.fishObstacles.length = 0;
    this.root.clear();
    this.geometries.forEach((g) => g.dispose());
    this.geometries.clear();
    this.materials.forEach((m) => m.dispose());
    this.materials.clear();
    this.textures.forEach((t) => t.dispose());
    this.textures.length = 0;
    this.sand = undefined;
    this.moundGeometry = undefined;
    this.rock = undefined;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.clear();
    this.lease?.release();
    this.lease = undefined;
  }
}
