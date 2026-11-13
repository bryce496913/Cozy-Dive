import * as THREE from 'three';
import type { AssetLoader, AssetLease } from '../assets/AssetLoader';
import {
  TANK_ITEMS,
  tankDefinition,
  itemCollider,
  type TankItem,
  type TankKind,
} from '../catalog/catalog';
import { authoredPlantGeometry } from './AuthoredReef';
import { LevelInstances } from './outer/LevelInstances';

interface Piece {
  geometry: THREE.BufferGeometry;
  far?: THREE.BufferGeometry;
  material: THREE.Material;
  preview: THREE.MeshBasicMaterial;
}
interface Template {
  pieces: Piece[];
  size: THREE.Vector3;
  min: THREE.Vector3;
}
/** Shared library lease; owns only plant conversions, preview materials and instance buffers. */
export class TankDecoration {
  readonly root = new THREE.Group();
  readonly ghost = new THREE.Group();
  private lease?: AssetLease;
  private loading?: Promise<boolean>;
  private disposed = false;
  private readonly templates = new Map<TankKind, Template>();
  private readonly ownedGeometry = new Set<THREE.BufferGeometry>();
  private readonly ownedMaterials = new Set<THREE.Material>();
  private readonly sets: LevelInstances[] = [];
  private readonly previews: THREE.InstancedMesh<
    THREE.BufferGeometry,
    THREE.MeshBasicMaterial
  >[] = [];
  private items: readonly TankItem[] = [];
  private previewKind?: TankKind;
  private readonly matrix = new THREE.Matrix4();
  private readonly local = new THREE.Matrix4();
  private readonly rotation = new THREE.Matrix4();
  private readonly scale = new THREE.Matrix4();
  private readonly eye = new THREE.Vector3(Infinity, 0, 0);
  private dirty = true;
  constructor(
    private readonly loader: AssetLoader,
    private readonly plants: THREE.MeshStandardMaterial,
  ) {
    this.root.name = 'Personal tank colonies';
    this.ghost.name = 'Tank placement preview';
    this.ghost.visible = false;
    this.root.add(this.ghost);
  }
  prepare(): Promise<boolean> {
    return (this.loading ??= (async () => {
      try {
        const lease = await this.loader.acquire('reef');
        if (this.disposed) {
          lease.release();
          return false;
        }
        this.lease = lease;
        for (const d of TANK_ITEMS) {
          const pieces: Piece[] = [],
            box = new THREE.Box3();
          for (const suffix of ['', '_Tips']) {
            const node = lease.model.getObjectByName(d.node + suffix);
            if (!(node instanceof THREE.Mesh)) continue;
            let geometry = node.geometry,
              material = Array.isArray(node.material)
                ? node.material[0]
                : node.material;
            if (
              d.kind === 'soft' ||
              d.kind === 'sea-fan' ||
              d.kind === 'seagrass'
            ) {
              geometry = authoredPlantGeometry(geometry, {
                sway: 0.04,
                frequency: 0.6,
              });
              this.ownedGeometry.add(geometry);
              const m = this.plants.clone();
              if (material instanceof THREE.MeshStandardMaterial) {
                m.map = material.map;
                m.normalMap = material.normalMap;
              }
              m.onBeforeCompile = this.plants.onBeforeCompile;
              m.customProgramCacheKey = () => 'cozy-plants-authored-v1';
              this.ownedMaterials.add(m);
              material = m;
            }
            geometry.computeBoundingBox();
            box.union(geometry.boundingBox!);
            const far = lease.model.getObjectByName(d.node + suffix + '_LOD1');
            const preview = new THREE.MeshBasicMaterial({
              color: 0xa9dbcd,
              transparent: true,
              opacity: 0.32,
              depthWrite: false,
              side: THREE.DoubleSide,
            });
            this.ownedMaterials.add(preview);
            pieces.push({
              geometry,
              far: far instanceof THREE.Mesh ? far.geometry : undefined,
              material,
              preview,
            });
          }
          if (!pieces.length) throw Error('Missing tank colony template');
          const size = box.getSize(new THREE.Vector3());
          if (
            ![size.x, size.y, size.z].every(
              (n) => Number.isFinite(n) && n > 1e-6,
            )
          )
            throw Error('Invalid tank colony dimensions');
          this.templates.set(d.kind, {
            pieces,
            size,
            min: box.min.clone(),
          });
        }
        this.rebuild(this.items);
        return true;
      } catch (error) {
        console.warn('Cozy Diver: tank catalog art unavailable.', error);
        this.dispose();
        return false;
      }
    })());
  }
  private transform(item: TankItem, out: THREE.Matrix4) {
    const t = this.templates.get(item.kind)!,
      d = tankDefinition(item.kind);
    this.local.makeTranslation(
      -t.min.x - t.size.x / 2,
      -t.min.y,
      -t.min.z - t.size.z / 2,
    );
    out
      .makeTranslation(item.position.x, item.position.y, item.position.z)
      .multiply(this.rotation.makeRotationY(item.rotation))
      .multiply(
        this.scale.makeScale(
          d.width / t.size.x,
          d.height / t.size.y,
          d.depth / t.size.z,
        ),
      )
      .multiply(this.local);
  }

  rebuild(items: readonly TankItem[]) {
    this.items = items;
    this.dirty = true;
    for (const s of this.sets) s.dispose();
    this.sets.length = 0;
    if (!this.templates.size) return;
    for (const d of TANK_ITEMS) {
      const copies = items.filter((i) => i.kind === d.kind);
      if (!copies.length) continue;
      const matrices = copies.map((i) => {
        const m = new THREE.Matrix4();
        this.transform(i, m);
        return m;
      });
      for (const p of this.templates.get(d.kind)!.pieces) {
        const set = new LevelInstances(
          `Tank ${d.kind}`,
          p.far
            ? [
                { geometry: p.geometry, until: 5 },
                { geometry: p.far, until: Infinity },
              ]
            : [{ geometry: p.geometry, until: Infinity }],
          p.material,
          matrices,
        );
        this.sets.push(set);
        this.root.add(...set.drawn);
      }
    }
  }
  showPreview(item: TankItem | null, valid: boolean) {
    this.ghost.visible = !!item && this.templates.has(item.kind);
    if (!item || !this.ghost.visible) return;
    if (this.previewKind !== item.kind) {
      for (const m of this.previews) {
        m.removeFromParent();
        m.dispose();
      }
      this.previews.length = 0;
      for (const p of this.templates.get(item.kind)!.pieces) {
        const m = new THREE.InstancedMesh(p.geometry, p.preview, 1);
        m.frustumCulled = false;
        this.previews.push(m);
        this.ghost.add(m);
      }
      this.previewKind = item.kind;
    }
    this.transform(item, this.matrix);
    for (const m of this.previews) {
      m.setMatrixAt(0, this.matrix);
      m.instanceMatrix.needsUpdate = true;
      m.material.opacity = valid ? 0.32 : 0.08;
    }
  }
  update(camera: THREE.Camera) {
    if (!this.dirty && this.eye.distanceToSquared(camera.position) < 0.25)
      return;
    this.dirty = false;
    this.eye.copy(camera.position);
    for (const s of this.sets)
      s.update(camera.position.x, camera.position.y, camera.position.z);
  }
  get colliders() {
    return this.items.map(itemCollider);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    for (const s of this.sets) s.dispose();
    for (const m of this.previews) m.dispose();
    this.ownedGeometry.forEach((g) => g.dispose());
    this.ownedMaterials.forEach((m) => m.dispose());
    this.root.clear();
    this.ghost.clear();
    this.sets.length = 0;
    this.previews.length = 0;
    this.items = [];
    this.ownedGeometry.clear();
    this.ownedMaterials.clear();
    this.templates.clear();
    this.lease?.release();
    this.lease = undefined;
  }
}
