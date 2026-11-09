import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { AssetLoader, type AssetLease } from '../assets/AssetLoader';
import { isCollisionNode } from '../assets/AssetValidation';
import { triplanarMaterial } from '../rendering/Triplanar';
import type { ConvexCollider } from '../player/collision';
import type { Aquarium } from './Aquarium';
import type { PlantSpecies, PlantSpeciesId } from './PlantSpecies';
import { rockCollider } from './rockCollider';
import {
  backdropRocks,
  meadowUnderstory,
  REEF_LAYOUT,
  scatterDebris,
} from './ReefLayout';

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
/** Subtle per-rock mineral tints multiplied over the authored limestone maps. */
const ROCK_TINTS = [0xeee9e2, 0xdfdfdc, 0xe4e6dc, 0xeee2de] as const;

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
  private originalSandMaterial?: THREE.Material | THREE.Material[];
  private enabled = false;
  private disposed = false;
  constructor(
    private readonly q: Aquarium,
    private readonly loader = new AssetLoader(),
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
      this.buildRocks();
      this.buildCorals();
      this.buildVegetation();
      this.buildSubstrate();
      this.buildBackdrop();
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
    const majors = this.q.rocks.filter((r) => r.solid);
    majors.forEach((rock, i) => {
      const lod = new THREE.LOD();
      lod.name = `Authored rock ${i} (${rock.mesh.name})`;
      const material = materials[(i * 7 + rock.template) % materials.length];
      for (const [level, suffix] of (
        ['', '_LOD1', '_LOD2'] as const
      ).entries()) {
        const distance = REEF_LAYOUT.rockLodDistances[level];
        const mesh = new THREE.Mesh(
          this.part(`Rock_${rock.template}${suffix}`).geometry,
          material,
        );
        mesh.name = `Rock_${rock.template}${suffix}`;
        lod.addLevel(mesh, distance);
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
    m.customProgramCacheKey = () => 'cozy-plants-authored-v1';
    return m;
  }
  private buildVegetation(): void {
    const algae = this.plantMaterial(this.standard('Caulerpa_0')),
      tissue = this.plantMaterial(this.standard('Sea_Fan_0'));
    const templates = new Map<string, THREE.BufferGeometry>();
    for (const batch of this.q.plants.batches) {
      if (batch.species.id === 'turtle-grass-meadow') continue;
      const node = `${PLANT_TEMPLATE_NODES[batch.species.id]}_${batch.template}`;
      let geometry = templates.get(node);
      if (!geometry) {
        geometry = this.own(
          authoredPlantGeometry(this.part(node).geometry, batch.species),
        );
        templates.set(node, geometry);
      }
      this.swap(
        batch.mesh,
        geometry,
        batch.species.category === 'coral' ? tissue : algae,
      );
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
  setEnabled(value: boolean): void {
    if (
      (value && (this.disposed || this.state !== 'ready')) ||
      value === this.enabled
    )
      return;
    this.enabled = value;
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
  }
  private cleanup(): void {
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
    this.loader.dispose();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.setEnabled(false);
    this.cleanup();
  }
}
