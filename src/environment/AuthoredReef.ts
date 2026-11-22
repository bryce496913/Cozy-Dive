import * as THREE from 'three';
import { WATER_PROFILES } from '../config/waterProfiles';
import { addCaustics } from '../rendering/atmosphere/Caustics';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { AssetLoader, type AssetLease } from '../assets/AssetLoader';
import { isCollisionNode } from '../assets/AssetValidation';
import { triplanarMaterial } from '../rendering/Triplanar';
import { carveDen } from './RockDen';
import { MORAY_DEN } from '../creatures/MorayBehavior';
import type { ConvexCollider } from '../player/collision';
import type { Aquarium } from './Aquarium';
import type { PlantSpecies, PlantSpeciesId } from './PlantSpecies';
import { rockCollider } from './rockCollider';
import { substrateHeight } from './HabitatRegions';
import {
  backdropRocks,
  meadowUnderstory,
  REEF_LAYOUT,
  scatterDebris,
} from './ReefLayout';
import {
  REEF_BENCHMARK,
  insideAny,
  isBenchmarkCoral,
  isBenchmarkRock,
  type BenchmarkPlant,
} from './ReefBenchmark';
import {
  REEF_HABITAT,
  isHabitatCoral,
  isHabitatRock,
  strayScatter,
  type HabitatPlant,
  type ReefPresentation,
} from './ReefHabitat';

/** Library node prefixes for each procedural plant species template family. */
export const PLANT_TEMPLATE_NODES: Readonly<
  Record<Exclude<PlantSpeciesId, 'turtle-grass-meadow'>, string>
> = {
  'turtle-grass': 'Turtle_Grass',
  caulerpa: 'Caulerpa',
  halimeda: 'Halimeda',
  'red-macroalgae': 'Red_Algae',
  'soft-coral': 'Soft_Coral',
  'sea-fan': 'Sea_Fan',
};
const CORAL_NODES = {
  branching: 'Coral_Branching',
  rounded: 'Coral_Massive',
  plate: 'Coral_Plate',
} as const;
/**
 * Per-rock mineral tints multiplied over the authored limestone maps. V0.7 Pass 080: the four tints
 * were within a few percent of one white, so under the tank's aqua light every boulder read as the
 * same olive mound. They now span the art bible's rock palette (warm beige, cool grey, pale sand,
 * a faint coralline pink) at the same overall value, so neighbouring rocks separate without any
 * one becoming a colour accent.
 */
const ROCK_TINTS = [0xfae6cf, 0xd2dadf, 0xefe5c8, 0xf6d8d0] as const;

/**
 * Authored plant templates carry RGB colour and a per-stem phase in their second UV set. The runtime
 * restores the existing `plantMotion` contract (flex grows with normalised height), so current,
 * pause and reduced-motion behaviour stay identical to the procedural vegetation.
 */
export function authoredPlantGeometry(
  source: THREE.BufferGeometry,
  species: Pick<PlantSpecies, 'sway' | 'frequency'>,
): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const position = source.getAttribute('position'),
    color = source.getAttribute('color'),
    phases = source.getAttribute('uv1');
  g.setAttribute('position', position.clone());
  g.setAttribute('normal', source.getAttribute('normal').clone());
  g.setAttribute('uv', source.getAttribute('uv').clone());
  if (source.index) g.setIndex(source.index.clone());
  const rgb = new Float32Array(position.count * 3),
    motion = new Float32Array(position.count * 4);
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, position.getY(i)));
    const phase = phases ? phases.getX(i) : 0;
    rgb[i * 3] = color ? color.getX(i) : 1;
    rgb[i * 3 + 1] = color ? color.getY(i) : 1;
    rgb[i * 3 + 2] = color ? color.getZ(i) : 1;
    motion[i * 4] = t * t * species.sway;
    motion[i * 4 + 1] = phase * Math.PI * 2;
    motion[i * 4 + 2] = 2 * t * species.sway;
    motion[i * 4 + 3] = species.frequency;
  }
  g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  g.setAttribute('plantMotion', new THREE.BufferAttribute(motion, 4));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  g.name = source.name;
  return g;
}

/** Decode authored convex point sets for one asset into colliders under `transform`. */
export function reefColliders(
  root: THREE.Object3D,
  transform: THREE.Matrix4,
): ConvexCollider[] {
  const colliders: ConvexCollider[] = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !isCollisionNode(object)) return;
    object.visible = false;
    const p = object.geometry.getAttribute('position'),
      points: THREE.Vector3[] = [];
    for (let i = 0; i < p.count; i++)
      points.push(new THREE.Vector3().fromBufferAttribute(p, i));
    const hull = new ConvexGeometry(points);
    try {
      colliders.push(rockCollider(hull, transform));
    } finally {
      hull.dispose();
    }
  });
  return colliders;
}

interface GeometrySwap {
  readonly mesh: THREE.Mesh;
  readonly original: THREE.BufferGeometry;
  readonly originalMaterial: THREE.Material | THREE.Material[];
  readonly authored: THREE.BufferGeometry;
  readonly authoredMaterial: THREE.Material;
}

/**
 * Pass 014 reef presentation. Owned by `UnderwaterScene`, applied over the procedural aquarium.
 *
 * Placement, home selection and simulation stay authoritative in `Aquarium`; this layer swaps
 * visible geometry and replaces each reef rock's single convex hull with authored convex parts
 * that lie inside it (never adding solid volume). If loading fails the procedural reef remains.
 */
export class AuthoredReef {
  readonly ready: Promise<boolean>;
  state: 'loading' | 'ready' | 'fallback' = 'loading';
  readonly root = new THREE.Group();
  /** Full-detail authored rock meshes, for settling perched animals onto the visible surface. */
  private readonly rockSurfaces: THREE.Mesh[] = [];
  private readonly ray = new THREE.Raycaster();
  private lease?: AssetLease;
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly textures: THREE.Texture[] = [];
  private readonly instanced: THREE.InstancedMesh[] = [];
  private readonly hidden: THREE.Object3D[] = [];
  private readonly swaps: GeometrySwap[] = [];
  private readonly hulls: {
    original: readonly ConvexCollider[];
    authored: readonly ConvexCollider[];
  }[] = [];
  private sandMaterial?: THREE.Material;
  /** V0.8 Pass 082: the reef benchmark section (absent under `?reef=original` or if it fails). */
  private benchLease?: AssetLease;
  /** V0.8 Pass 083: the whole-tank habitat (absent unless asked for, or if it fails). */
  private habitatLease?: AssetLease;
  /** Accepted hulls the composed sections replace, and the sections' own convex parts. */
  private readonly sectionOriginals: ConvexCollider[] = [];
  private readonly sectionSolids: ConvexCollider[] = [];
  /** Shared composed-reef materials (both sections draw with the same families). */
  private sectionMaterials?: Record<
    'rock' | 'branching' | 'massive' | 'soft' | 'sponge' | 'algae',
    THREE.MeshStandardMaterial
  >;
  /**
   * Plant, rubble and understory instances inside the composed rock, and (with the habitat) loose
   * pebbles and shells out on open sand, withheld while the sections show.
   */
  private readonly reseated: {
    mesh: THREE.InstancedMesh;
    index: number;
    original: THREE.Matrix4;
    moved: THREE.Matrix4;
  }[] = [];
  private readonly withheld: {
    mesh: THREE.InstancedMesh;
    index: number;
    matrix: THREE.Matrix4;
  }[] = [];
  /** Pass 019: shaded seabed sand draped over sand drifted into the wreck, and what it replaced. */
  private drifted?: THREE.MeshStandardMaterial;
  private readonly draped: {
    mesh: THREE.Mesh;
    original: THREE.Material | THREE.Material[];
  }[] = [];
  private originalSandMaterial?: THREE.Material | THREE.Material[];
  private enabled = false;
  private disposed = false;
  constructor(
    private readonly q: Aquarium,
    private readonly loader = new AssetLoader(),
    private readonly presentation: ReefPresentation | boolean = 'original',
  ) {
    this.root.name = 'Authored reef environment';
    this.root.visible = false;
    this.ready = this.load();
  }
  /** Reef asset statistics for validation tooling. */
  get inventory(): { rocks: number; corals: number; debris: number } {
    let rocks = 0,
      corals = 0;
    for (const child of this.root.children)
      if (child.name.startsWith('Authored rock')) rocks++;
      else if (child.name.startsWith('Authored coral')) corals++;
    const debris = this.instanced
      .filter((m) => m.name.startsWith('Reef debris'))
      .reduce((sum, m) => sum + m.count, 0);
    return { rocks, corals, debris };
  }
  private part(name: string): THREE.Mesh {
    const node = this.lease!.model.getObjectByName(name);
    if (!(node instanceof THREE.Mesh)) throw Error(`Missing reef node ${name}`);
    return node;
  }
  private own<T extends THREE.Material | THREE.BufferGeometry>(value: T): T {
    if (value instanceof THREE.Material) this.materials.add(value);
    else this.geometries.add(value);
    return value;
  }
  private standard(name: string): THREE.MeshStandardMaterial {
    const m = this.part(name).material;
    if (!(m instanceof THREE.MeshStandardMaterial))
      throw Error(`${name}: reef material is not PBR`);
    return m;
  }
  private async load(): Promise<boolean> {
    try {
      this.lease = await this.loader.acquire('reef');
    } catch {
      this.cleanup();
      this.state = 'fallback';
      return false;
    }
    if (this.disposed) {
      this.cleanup();
      return false;
    }
    try {
      this.lease.model.updateMatrixWorld(true);
      // `true` (the Pass 082 signature) asks for the benchmark section alone.
      const mode =
        this.presentation === true
          ? 'benchmark'
          : this.presentation === false
            ? 'original'
            : this.presentation;
      if (mode !== 'original') {
        try {
          this.benchLease = await this.loader.acquire('reefBenchmark');
          this.benchLease.model.updateMatrixWorld(true);
        } catch (error) {
          console.warn(
            'Cozy Diver: reef benchmark unavailable; keeping the accepted section.',
            error,
          );
        }
        if (this.disposed) {
          this.cleanup();
          return false;
        }
      }
      if (mode === 'habitat') {
        try {
          this.habitatLease = await this.loader.acquire('reefHabitat');
          this.habitatLease.model.updateMatrixWorld(true);
        } catch (error) {
          console.warn(
            'Cozy Diver: reef habitat unavailable; keeping the accepted tank.',
            error,
          );
        }
        if (this.disposed) {
          this.cleanup();
          return false;
        }
      }
      this.buildRocks();
      this.buildCorals();
      this.buildVegetation();
      this.buildSubstrate();
      this.buildBackdrop();
      if (this.benchLease) this.buildBenchmark();
      if (this.habitatLease) this.buildHabitat();
      this.withholdCovered();
      this.q.root.add(this.root);
      this.state = 'ready';
      this.setEnabled(true);
      return true;
    } catch (error) {
      console.error(
        'Cozy Diver: authored reef unavailable; keeping procedural reef.',
        error,
      );
      this.setEnabled(false);
      this.cleanup();
      this.state = 'fallback';
      return false;
    }
  }
  private buildRocks(): void {
    const base = this.standard('Rock_0');
    const materials = ROCK_TINTS.map((tint) => {
      const m = this.own(
        triplanarMaterial(base, {
          scale: REEF_LAYOUT.rockTexelScale,
          ao: 0.55,
        }),
      );
      m.color.setHex(tint);
      m.vertexColors = true;
      return m;
    });
    const majors = this.q.rocks.filter((r) => r.solid),
      den = this.q.anchoredLife.moray.den;
    this.rockSurfaces.length = 0;
    majors.forEach((rock, i) => {
      // V0.8 Pass 082: the benchmark section replaces these rocks (their hulls swap as a group).
      // V0.8 Pass 083: and the habitat formations replace every other reef rock.
      if (
        (this.benchLease && isBenchmarkRock(rock.mesh.name)) ||
        (this.habitatLease && isHabitatRock(rock.mesh.name))
      ) {
        this.hidden.push(rock.mesh);
        this.sectionOriginals.push(rock.collider!);
        return;
      }
      const lod = new THREE.LOD();
      lod.name = `Authored rock ${i} (${rock.mesh.name})`;
      const material = materials[(i * 7 + rock.template) % materials.length];
      for (const [level, suffix] of (
        ['', '_LOD1', '_LOD2'] as const
      ).entries()) {
        const distance = REEF_LAYOUT.rockLodDistances[level];
        const template = this.part(`Rock_${rock.template}${suffix}`).geometry;
        // Pass 019: the moray's rock gets its den carved into every detail level.
        const mesh = new THREE.Mesh(
          rock.collider === den.support
            ? this.own(
                carveDen(template, rock.mesh.matrix, {
                  mouth: den.mouth,
                  axis: den.axis,
                  radius: MORAY_DEN.radius,
                  depth: MORAY_DEN.depth,
                }),
              )
            : template,
          material,
        );
        mesh.name = `Rock_${rock.template}${suffix}`;
        lod.addLevel(mesh, distance);
        if (level === 0) this.rockSurfaces.push(mesh);
      }
      lod.matrixAutoUpdate = false;
      lod.matrix.copy(rock.mesh.matrix);
      lod.matrix.decompose(lod.position, lod.quaternion, lod.scale);
      this.root.add(lod);
      this.hidden.push(rock.mesh);
      const authored = reefColliders(
        this.lease!.model.getObjectByName(`Rock_${rock.template}_Root`)!,
        rock.mesh.matrix,
      );
      if (!authored.length) throw Error('Reef rock lost its structural parts');
      this.hulls.push({ original: [rock.collider!], authored });
    });
    // Pass 023: the hidden crevice wears the same tinted reef rock (triplanar, so its procedural
    // boulders need no UVs). Geometry stays the crevice's own; only the material swaps.
    this.q.crevice.rocks.forEach((mesh, i) =>
      this.swaps.push({
        mesh,
        original: mesh.geometry,
        originalMaterial: mesh.material,
        authored: mesh.geometry,
        authoredMaterial: materials[(i * 3 + 1) % materials.length],
      }),
    );
    // Accepted pebble transforms keep their positions; authored rubble shares three templates.
    const pebbles = this.q.rocks.filter((r) => !r.solid);
    for (let template = 0; template < 3; template++) {
      const items = pebbles.filter((p) => p.template === template);
      const mesh = new THREE.InstancedMesh(
        this.part(`Pebble_${template}`).geometry,
        materials[template],
        items.length,
      );
      mesh.name = `Reef debris pebbles ${template}`;
      items.forEach((p, i) => {
        mesh.setMatrixAt(i, p.mesh.matrix);
        this.hidden.push(p.mesh);
      });
      mesh.computeBoundingSphere();
      this.instanced.push(mesh);
      this.root.add(mesh);
    }
  }
  private buildCorals(): void {
    const seen: Record<string, number> = {};
    const brain = this.standard('Coral_Massive_0'),
      massive = this.own(
        triplanarMaterial(brain, {
          scale: REEF_LAYOUT.coralTexelScale,
          ao: 0.5,
        }),
      );
    massive.vertexColors = true;
    const boulder = this.own(
      triplanarMaterial(this.standard('Coral_Massive_2'), {
        scale: REEF_LAYOUT.coralTexelScale * 1.6,
        ao: 0.5,
      }),
    );
    boulder.vertexColors = true;
    for (const formation of this.q.hardscape.formations) {
      const variant = (seen[formation.kind] = (seen[formation.kind] ?? -1) + 1);
      if (
        (this.benchLease && isBenchmarkCoral(formation.position)) ||
        (this.habitatLease && isHabitatCoral(formation.position))
      ) {
        this.hidden.push(formation.mesh);
        this.sectionOriginals.push(...formation.colliders);
        continue;
      }
      const name = `${CORAL_NODES[formation.kind]}_${variant}`;
      const group = new THREE.Group();
      group.name = `Authored coral ${name}`;
      group.position.copy(formation.position);
      for (const suffix of ['', '_Tips']) {
        const node = this.lease!.model.getObjectByName(name + suffix);
        if (!(node instanceof THREE.Mesh)) continue;
        const material =
          formation.kind === 'rounded'
            ? variant < 2
              ? massive
              : boulder
            : node.material;
        const mesh = new THREE.Mesh(node.geometry, material);
        mesh.name = node.name;
        // Pass 015 hero colonies carry a cheaper distance level where authored.
        const far = this.lease!.model.getObjectByName(`${name + suffix}_LOD1`);
        if (far instanceof THREE.Mesh) {
          const lod = new THREE.LOD();
          lod.name = `${node.name} levels`;
          lod.addLevel(mesh, 0);
          lod.addLevel(
            new THREE.Mesh(far.geometry, material),
            REEF_LAYOUT.coralLodDistance,
          );
          group.add(lod);
        } else group.add(mesh);
      }
      if (!group.children.length) throw Error(`Missing reef coral ${name}`);
      this.root.add(group);
      this.hidden.push(formation.mesh);
    }
  }
  private plantMaterial(
    source: THREE.MeshStandardMaterial,
  ): THREE.MeshStandardMaterial {
    const plants = this.q.plants.material,
      m = this.own(plants.clone());
    m.map = source.map;
    m.normalMap = source.normalMap;
    m.normalScale.set(0.6, 0.6);
    m.roughnessMap = source.roughnessMap;
    m.roughness = 0.9;
    m.onBeforeCompile = plants.onBeforeCompile;
    // Algae and soft tissue differ only in maps/uniforms, so they share one program.
    m.customProgramCacheKey = () => 'cozy-plants-authored-v2';
    return m;
  }
  private buildVegetation(): void {
    const algae = this.plantMaterial(this.standard('Caulerpa_0')),
      tissue = this.plantMaterial(this.standard('Sea_Fan_0'));
    const templates = new Map<string, THREE.BufferGeometry>();
    for (const batch of this.q.plants.batches) {
      if (batch.species.id === 'turtle-grass-meadow') continue;
      // V0.8 Pass 083: the habitat redraws the algae and seagrass sprigs as organic, clustered
      // plants (placements, species and fish interests stay the accepted ones).
      const organic = this.habitatLease
        ? REEF_HABITAT.speciesTemplates[batch.species.id]
        : undefined;
      const node = organic
        ? `Habitat_Plant_${organic}`
        : `${PLANT_TEMPLATE_NODES[batch.species.id]}_${batch.template}`;
      let geometry = templates.get(node);
      if (!geometry) {
        const source = organic
          ? this.habitatNode(node).geometry
          : this.part(node).geometry;
        geometry = this.own(
          authoredPlantGeometry(
            source,
            organic ? REEF_HABITAT.plantMotion[organic] : batch.species,
          ),
        );
        templates.set(node, geometry);
      }
      this.swap(
        batch.mesh,
        geometry,
        batch.species.category === 'coral' ? tissue : algae,
      );
    }
    // V0.8 Pass 083: the habitat replaces the needle-blade meadows with beds of whole tufts.
    if (this.habitatLease) {
      this.hidden.push(...this.q.grass.batches);
      return;
    }
    const meadowSpecies = { sway: 0.075, frequency: 0.65 };
    const blades = this.q.grass.batches.map((mesh, template) => {
      const g = this.own(
        authoredPlantGeometry(
          this.part(`Meadow_Blade_${template}`).geometry,
          meadowSpecies,
        ),
      );
      this.swap(mesh, g, algae);
      return g;
    });
    // Denser, layered understory: short centre-weighted blades beneath the accepted meadow.
    const extra = meadowUnderstory(this.q.grass.patches, REEF_LAYOUT.seed);
    blades.forEach((g, template) => {
      const items = extra.filter((b) => b.template === template);
      const mesh = new THREE.InstancedMesh(g, algae, items.length);
      mesh.name = `Meadow understory ${template}`;
      items.forEach((b, i) => {
        mesh.setMatrixAt(i, b.matrix);
        mesh.setColorAt(i, new THREE.Color().setScalar(b.tint));
      });
      mesh.computeBoundingSphere();
      if (mesh.boundingSphere) mesh.boundingSphere.radius += 0.3;
      this.instanced.push(mesh);
      this.root.add(mesh);
    });
  }
  private swap(
    mesh: THREE.InstancedMesh,
    authored: THREE.BufferGeometry,
    authoredMaterial: THREE.Material,
  ): void {
    this.swaps.push({
      mesh,
      original: mesh.geometry,
      originalMaterial: mesh.material,
      authored,
      authoredMaterial,
    });
  }
  private buildSubstrate(): void {
    const sand = this.standard('Sand_Material'),
      m = this.own(sand.clone());
    for (const texture of [m.map, m.normalMap, m.roughnessMap]) {
      if (!texture) throw Error('Sand material lost a PBR map');
      const t = texture.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(REEF_LAYOUT.sandRepeat[0], REEF_LAYOUT.sandRepeat[1]);
      t.needsUpdate = true;
      this.textures.push(t);
    }
    m.map = this.textures[0];
    m.normalMap = this.textures[1];
    m.roughnessMap = this.textures[2];
    m.normalScale.set(0.9, 0.9);
    m.vertexColors = true;
    m.roughness = 1;
    // V0.7 Pass 064: surface caustics on the tank sand.
    const caustics = WATER_PROFILES.tank.caustics;
    if (caustics) addCaustics(m, caustics);
    this.sandMaterial = m;
    this.originalSandMaterial = this.q.sand.material;
    const debris = scatterDebris(
      {
        rocks: this.q.rocks,
        solids: [
          ...this.q.rockColliders,
          ...this.q.hardscape.colliders,
          ...this.q.ornaments.colliders,
        ],
      },
      REEF_LAYOUT.seed,
    );
    const sources = [
      'Shell_0',
      'Shell_1',
      'Shell_2',
      'Rubble_0',
      'Rubble_1',
    ] as const;
    sources.forEach((name, template) => {
      const items = debris.filter((d) => d.template === template);
      const node = this.part(name);
      const mesh = new THREE.InstancedMesh(
        node.geometry,
        node.material,
        items.length,
      );
      mesh.name = `Reef debris ${name}`;
      items.forEach((d, i) => mesh.setMatrixAt(i, d.matrix));
      mesh.computeBoundingSphere();
      this.instanced.push(mesh);
      this.root.add(mesh);
    });
  }
  private buildBackdrop(): void {
    const filter = this.q.ornaments.models.find((m) => m.kind === 'filter');
    const keep = filter
      ? [{ x: filter.root.position.x, z: filter.root.position.z }]
      : [];
    const rocks = backdropRocks(keep);
    const base = this.standard('Rock_0'),
      material = this.own(
        triplanarMaterial(base, {
          scale: REEF_LAYOUT.rockTexelScale * 1.3,
          ao: 0.6,
        }),
      );
    material.vertexColors = true;
    // Slightly cooler and darker: distant reef reads behind the hero formations.
    material.color.setHex(0xd6dcd9);
    for (let template = 0; template < 6; template++) {
      const items = rocks.filter((r) => r.template === template);
      if (!items.length) continue;
      const mesh = new THREE.InstancedMesh(
        this.part(`Rock_${template}_LOD2`).geometry,
        material,
        items.length,
      );
      mesh.name = `Backdrop reef ${template}`;
      items.forEach((r, i) => mesh.setMatrixAt(i, r.matrix));
      mesh.computeBoundingSphere();
      this.instanced.push(mesh);
      this.root.add(mesh);
    }
  }
  /**
   * Give `mesh` (sand drifted into an ornament, with seabed-scale UVs) the authored seabed sand,
   * slightly shaded. Restored when the reef is disabled or disposed.
   */
  drapeSand(mesh: THREE.Mesh): void {
    if (
      this.state !== 'ready' ||
      !(this.sandMaterial instanceof THREE.MeshStandardMaterial) ||
      this.draped.some((d) => d.mesh === mesh)
    )
      return;
    if (!this.drifted) {
      this.drifted = this.own(this.sandMaterial.clone());
      this.drifted.vertexColors = false;
      this.drifted.color.setHSL(0.11, 0.23, 0.52);
    }
    this.draped.push({ mesh, original: mesh.material });
    mesh.material = this.drifted;
  }
  private undrape(): void {
    for (const { mesh, original } of this.draped) mesh.material = original;
    this.draped.length = 0;
  }
  /** Template-local vertex positions of an authored plant template, once loaded. */
  plantTemplatePositions(
    species: Exclude<PlantSpeciesId, 'turtle-grass-meadow'>,
    template: number,
  ): ArrayLike<number> | undefined {
    if (this.state !== 'ready') return undefined;
    const node = this.lease?.model.getObjectByName(
      `${PLANT_TEMPLATE_NODES[species]}_${template}`,
    );
    return node instanceof THREE.Mesh
      ? node.geometry.getAttribute('position').array
      : undefined;
  }
  /**
   * Distance from `origin` along `direction` to the first authored rock surface within
   * `maxDistance`, or undefined (also while loading or after a fallback). One-off; not per frame.
   */
  rockSurfaceDistance(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
  ): number | undefined {
    if (this.state !== 'ready' || !this.rockSurfaces.length) return undefined;
    this.root.updateMatrixWorld(true);
    this.ray.set(origin, direction);
    this.ray.far = maxDistance;
    return this.ray.intersectObjects(this.rockSurfaces, false)[0]?.distance;
  }
  /**
   * V0.8 Pass 082: the composed benchmark section. Its rock, coral and soft-coral meshes go in
   * at full detail near the swimmer and their distance level beyond; its plants use the shared
   * current-driven sway; its convex parts become the section's colliders for the swimmer and
   * the fish alike (the accepted hulls come back with the accepted art).
   */
  private buildBenchmark(): void {
    const model = this.benchLease!.model;
    const node = (name: string): THREE.Mesh => {
      const found = model.getObjectByName(name);
      if (!(found instanceof THREE.Mesh))
        throw Error(`Missing benchmark ${name}`);
      return found;
    };
    const m = this.composedMaterials();
    const meshes = (
      [
        ['Reef_Ridge', m.rock],
        ['Reef_Bommie', m.rock],
        ['Reef_Branching', m.branching],
        ['Reef_Massive', m.massive],
        ['Reef_Soft', m.soft],
        ['Reef_Sponge', m.sponge],
      ] as const
    ).map(([name, material]) => ({
      levels: [node(name), node(`${name}_LOD1`)],
      material,
    }));
    this.addSection(
      'Reef benchmark',
      meshes,
      [0, REEF_BENCHMARK.lodDistance],
      model,
    );
    for (const kind of Object.keys(
      REEF_BENCHMARK.plantMotion,
    ) as BenchmarkPlant[])
      this.addPlants(
        `Reef benchmark ${kind}`,
        node(`Reef_Plant_${kind}`).geometry,
        REEF_BENCHMARK.plantMotion[kind],
        model,
        `Reef_PlantSpot_${kind}_`,
      );
  }
  /** A mesh of the habitat asset, by name. */
  private habitatNode(name: string): THREE.Mesh {
    const found = this.habitatLease?.model.getObjectByName(name);
    if (!(found instanceof THREE.Mesh)) throw Error(`Missing habitat ${name}`);
    return found;
  }
  /**
   * V0.8 Pass 083: the habitat formations. Every formation's rock and its four families of life
   * come in three detail levels; the organic plants use the shared current-driven sway.
   */
  private buildHabitat(): void {
    const model = this.habitatLease!.model;
    const m = this.composedMaterials();
    const families = {
      Rock: m.rock,
      Branching: m.branching,
      Massive: m.massive,
      Soft: m.soft,
      Sponge: m.sponge,
    } as const;
    const meshes: { levels: THREE.Mesh[]; material: THREE.Material }[] = [];
    model.traverse((o) => {
      const match =
        /^Habitat_(Rock|Branching|Massive|Soft|Sponge)_[A-Za-z]+$/.exec(o.name);
      if (!match || !(o instanceof THREE.Mesh)) return;
      meshes.push({
        levels: [
          o,
          this.habitatNode(`${o.name}_LOD1`),
          this.habitatNode(`${o.name}_LOD2`),
        ],
        material: families[match[1] as keyof typeof families],
      });
    });
    if (!meshes.some((x) => x.material === m.rock))
      throw Error('Reef habitat lost its formations');
    this.addSection('Reef habitat', meshes, REEF_HABITAT.lodDistances, model);
    for (const kind of Object.keys(REEF_HABITAT.plantMotion) as HabitatPlant[])
      this.addPlants(
        `Reef habitat ${kind}`,
        this.habitatNode(`Habitat_Plant_${kind}`).geometry,
        REEF_HABITAT.plantMotion[kind],
        model,
        `Habitat_PlantSpot_${kind}_`,
      );
  }
  /**
   * V0.8 Pass 082B: each family its own material identity, shared by every composed section. The
   * rock reads its authored weathering from vertex alpha; the living families take relief maps of
   * their own kind (branching corallites, massive and plating colonies, fleshy soft tissue, porous
   * sponge) and their own roughness, but their colour from their painting.
   */
  private composedMaterials(): NonNullable<AuthoredReef['sectionMaterials']> {
    if (this.sectionMaterials) return this.sectionMaterials;
    const family = (
      source: THREE.MeshStandardMaterial,
      name: string,
      scale: number,
      roughness: number,
      surface = false,
    ): THREE.MeshStandardMaterial => {
      const m = this.own(
        triplanarMaterial(source, { scale, ao: 0.4, surface }),
      );
      m.vertexColors = true;
      m.roughness = roughness;
      m.name = name;
      return m;
    };
    const rock = family(
        this.standard('Rock_0'),
        'Reef benchmark rock',
        REEF_LAYOUT.rockTexelScale,
        0.88,
        true,
      ),
      branching = family(
        this.relief('Coral_Branching_0'),
        'Reef benchmark branching coral',
        REEF_LAYOUT.coralTexelScale * 2.2,
        0.6,
      ),
      massive = family(
        this.relief('Coral_Massive_2'),
        'Reef benchmark massive coral',
        REEF_LAYOUT.coralTexelScale * 1.4,
        0.7,
      ),
      soft = family(
        this.relief('Soft_Coral_0'),
        'Reef benchmark soft coral',
        REEF_LAYOUT.coralTexelScale * 1.6,
        0.5,
      ),
      sponge = family(
        this.relief('Rock_0'),
        'Reef benchmark sponge',
        REEF_LAYOUT.rockTexelScale * 3.2,
        0.92,
      );
    rock.normalScale.setScalar(0.85);
    // The shared rock map is olive; a slightly cooler tint keeps limestone from reading beige.
    rock.color.setRGB(0.94, 0.97, 1.0);
    soft.normalScale.setScalar(0.45);
    // Plating colonies are thin shells: both faces must shade.
    massive.side = THREE.DoubleSide;
    this.sectionMaterials = {
      rock,
      branching,
      massive,
      soft,
      sponge,
      algae: this.plantMaterial(this.standard('Caulerpa_0')),
    };
    return this.sectionMaterials;
  }
  /**
   * Add a composed section's meshes (each at full detail near the swimmer and its lower levels
   * beyond `distances`), and its convex parts as the section's colliders for the swimmer and the
   * fish alike (the accepted hulls come back with the accepted art).
   */
  private addSection(
    label: string,
    meshes: readonly {
      levels: readonly THREE.Mesh[];
      material: THREE.Material;
    }[],
    distances: readonly number[],
    model: THREE.Object3D,
  ): void {
    const rock = this.composedMaterials().rock;
    for (const { levels, material } of meshes) {
      const near = levels[0];
      near.geometry.computeBoundingSphere();
      const centre = near.geometry.boundingSphere!.center.clone();
      const lod = new THREE.LOD();
      lod.name = `${label} ${near.name}`;
      lod.position.copy(centre);
      levels.forEach((mesh, level) => {
        const m = new THREE.Mesh(mesh.geometry, material);
        m.name = mesh.name;
        m.position.copy(centre).negate();
        lod.addLevel(m, distances[level]);
        if (level === 0 && material === rock) this.rockSurfaces.push(m);
      });
      this.root.add(lod);
    }
    const solids = reefColliders(model, new THREE.Matrix4());
    if (!solids.length) throw Error(`${label} lost its structural parts`);
    this.sectionSolids.push(...solids);
  }
  /** Instanced plants of one template at the asset's spots (empties named `<prefix><n>`). */
  private addPlants(
    name: string,
    template: THREE.BufferGeometry,
    motion: { readonly sway: number; readonly frequency: number },
    model: THREE.Object3D,
    prefix: string,
  ): void {
    const geometry = this.own(authoredPlantGeometry(template, motion));
    const spots: THREE.Object3D[] = [];
    model.traverse((o) => {
      if (o.name.startsWith(prefix)) spots.push(o);
    });
    const mesh = new THREE.InstancedMesh(
      geometry,
      this.composedMaterials().algae,
      spots.length,
    );
    mesh.name = name;
    spots.forEach((o, i) => mesh.setMatrixAt(i, o.matrixWorld));
    mesh.computeBoundingSphere();
    if (mesh.boundingSphere) mesh.boundingSphere.radius += 1.5;
    this.instanced.push(mesh);
    this.root.add(mesh);
  }
  /**
   * Once every section is built: one hull swap for all of them, and the accepted instances they
   * cover (plants, understory, rubble inside the new rock; with the habitat, loose pebbles and
   * shells out on open sand, so the small scatter gathers where reef meets sand).
   */
  private withholdCovered(): void {
    if (!this.sectionSolids.length) return;
    this.hulls.push({
      original: this.sectionOriginals.slice(),
      authored: this.sectionSolids.slice(),
    });
    const m = new THREE.Matrix4(),
      p = new THREE.Vector3();
    const composed = new Set(
      this.root.children.filter((c) =>
        /^Reef (benchmark|habitat)/.test(c.name),
      ),
    );
    const reef = [
      ...this.sectionSolids,
      ...this.q.crevice.colliders,
      ...this.q.ornaments.colliders,
    ];
    this.reseatPlants();
    for (const mesh of [
      ...this.instanced.filter((i) => !composed.has(i)),
      ...this.q.plants.batches.map((b) => b.mesh),
      ...this.q.grass.batches,
    ]) {
      const scatter =
        !!this.habitatLease && mesh.name.startsWith('Reef debris');
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, m);
        p.setFromMatrixPosition(m);
        if (
          insideAny(p, this.sectionSolids, REEF_BENCHMARK.clearance) ||
          (scatter && strayScatter(p, reef))
        )
          this.withheld.push({ mesh, index: i, matrix: m.clone() });
      }
    }
  }
  /**
   * V0.8 Pass 083: accepted plants and soft corals that grew on a replaced rock or colony are moved
   * down (or up) onto the composed rock beneath them, so none is left floating where an accepted
   * crown used to be; one with no rock beneath it is withheld. The seahorse's sea fan keeps its
   * place (its grip is computed from that placement).
   */
  private reseatPlants(): void {
    if (!this.sectionOriginals.length || !this.rockSurfaces.length) return;
    this.root.updateMatrixWorld(true);
    const seahorse = this.q.anchoredLife.hidden.seahorse.vegetation.position;
    const m = new THREE.Matrix4(),
      p = new THREE.Vector3(),
      down = new THREE.Vector3(0, -1, 0),
      origin = new THREE.Vector3(),
      zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const { mesh } of this.q.plants.batches)
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, m);
        p.setFromMatrixPosition(m);
        if (
          Math.hypot(p.x - seahorse.x, p.y - seahorse.y, p.z - seahorse.z) <
            0.05 ||
          p.y < substrateHeight(p.x, p.z) + 0.15 ||
          !insideAny(p, this.sectionOriginals, 0.3)
        )
          continue;
        this.ray.set(origin.set(p.x, p.y + 1.2, p.z), down);
        this.ray.far = 4;
        const hit = this.ray.intersectObjects(this.rockSurfaces, false)[0];
        const moved = m.clone();
        if (hit && hit.point.y > substrateHeight(p.x, p.z) + 0.1)
          moved.setPosition(p.x, hit.point.y - 0.02, p.z);
        else moved.copy(zero);
        this.reseated.push({ mesh, index: i, original: m.clone(), moved });
      }
  }
  /**
   * A reef material's relief and roughness maps without its colour map: the benchmark's
   * colonies carry their own painted colour, which a brain coral's colour map would tint.
   */
  private relief(name: string): THREE.MeshStandardMaterial {
    const m = this.standard(name).clone();
    m.map = null;
    this.materials.add(m);
    return m;
  }
  private applySections(value: boolean): void {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const r of this.reseated) {
      r.mesh.setMatrixAt(r.index, value ? r.moved : r.original);
      r.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const w of this.withheld) {
      w.mesh.setMatrixAt(w.index, value ? zero : w.matrix);
      w.mesh.instanceMatrix.needsUpdate = true;
    }
    if (value && this.sectionSolids.length)
      this.q.suspendInterests((p) =>
        insideAny(p, this.sectionSolids, REEF_BENCHMARK.clearance),
      );
    else this.q.restoreInterests();
  }
  setEnabled(value: boolean): void {
    if (
      (value && (this.disposed || this.state !== 'ready')) ||
      value === this.enabled
    )
      return;
    this.enabled = value;
    if (!value) this.undrape();
    this.root.visible = value;
    for (const object of this.hidden) object.visible = !value;
    for (const s of this.swaps) {
      s.mesh.geometry = value ? s.authored : s.original;
      s.mesh.material = value ? s.authoredMaterial : s.originalMaterial;
    }
    if (this.sandMaterial && this.originalSandMaterial)
      this.q.sand.material = value
        ? this.sandMaterial
        : this.originalSandMaterial;
    for (const h of this.hulls)
      this.q.replacePresentationColliders(
        value ? h.original : h.authored,
        value ? h.authored : h.original,
      );
    this.applySections(value);
  }
  private cleanup(): void {
    this.undrape();
    this.drifted = undefined;
    this.root.removeFromParent();
    this.root.clear();
    this.instanced.forEach((m) => m.dispose());
    this.instanced.length = 0;
    this.geometries.forEach((g) => g.dispose());
    this.geometries.clear();
    this.materials.forEach((m) => m.dispose());
    this.materials.clear();
    this.textures.forEach((t) => t.dispose());
    this.textures.length = 0;
    this.swaps.length = 0;
    this.hidden.length = 0;
    this.hulls.length = 0;
    this.sandMaterial = undefined;
    this.originalSandMaterial = undefined;
    this.lease?.release();
    this.lease = undefined;
    this.benchLease?.release();
    this.benchLease = undefined;
    this.habitatLease?.release();
    this.habitatLease = undefined;
    this.sectionMaterials = undefined;
    this.sectionOriginals.length = 0;
    this.sectionSolids.length = 0;
    this.withheld.length = 0;
    this.reseated.length = 0;
    this.loader.dispose();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.setEnabled(false);
    this.cleanup();
  }
}
