/* CPU access to exported authored GLBs for tests (no WebGL, no image decoding). */
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import type { Aquarium } from '../src/environment/Aquarium';
import { rockCollider } from '../src/environment/rockCollider';
import type { ConvexCollider } from '../src/player/collision';

interface GltfNode {
  name: string;
  mesh?: number;
  children?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
  extras?: Record<string, unknown>;
}
interface Accessor {
  bufferView: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
}
interface GltfDocument {
  nodes: GltfNode[];
  meshes: {
    primitives: {
      attributes: Record<string, number>;
      indices: number;
      material?: number;
      targets?: Record<string, number>[];
    }[];
  }[];
  accessors: Accessor[];
  bufferViews: {
    byteOffset?: number;
    byteLength: number;
    byteStride?: number;
  }[];
  materials: { name: string; doubleSided?: boolean }[];
}
const SIZE: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

export interface ReefPrimitive {
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly attributes: readonly string[];
  /** TEXCOORD_0 when present. */
  readonly uvs?: Float32Array;
  readonly material: string;
  readonly doubleSided: boolean;
}

export class ReefAsset {
  readonly doc: GltfDocument;
  private readonly bin: Buffer;
  readonly bytes: number;
  constructor(path = 'public/assets/models/reef/reef-environment.glb') {
    const file = readFileSync(path);
    this.bytes = file.length;
    const json = file.readUInt32LE(12);
    this.doc = JSON.parse(file.toString('utf8', 20, 20 + json)) as GltfDocument;
    const offset = 20 + json;
    this.bin = file.subarray(
      offset + 8,
      offset + 8 + file.readUInt32LE(offset),
    );
  }
  private read(index: number): Float32Array | Uint32Array {
    const a = this.doc.accessors[index],
      view = this.doc.bufferViews[a.bufferView],
      start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0),
      n = a.count * SIZE[a.type];
    const slice = this.bin.subarray(start, start + view.byteLength);
    const buffer = slice.buffer.slice(
      slice.byteOffset,
      slice.byteOffset + slice.byteLength,
    );
    if (a.componentType === 5126) return new Float32Array(buffer, 0, n);
    if (a.componentType === 5125) return new Uint32Array(buffer, 0, n);
    if (a.componentType === 5123)
      return Uint32Array.from(new Uint16Array(buffer, 0, n));
    return Uint32Array.from(new Uint8Array(buffer, 0, n));
  }
  node(name: string): GltfNode {
    const node = this.doc.nodes.find((n) => n.name === name);
    if (!node) throw Error(`Missing reef node ${name}`);
    return node;
  }
  has(name: string): boolean {
    return this.doc.nodes.some((n) => n.name === name);
  }
  primitive(name: string): ReefPrimitive {
    const node = this.node(name);
    if (node.mesh === undefined) throw Error(`${name} has no mesh`);
    const p = this.doc.meshes[node.mesh].primitives[0],
      material = this.doc.materials[p.material ?? 0];
    return {
      positions: this.read(p.attributes.POSITION) as Float32Array,
      indices: this.read(p.indices) as Uint32Array,
      attributes: Object.keys(p.attributes),
      uvs:
        p.attributes.TEXCOORD_0 === undefined
          ? undefined
          : (this.read(p.attributes.TEXCOORD_0) as Float32Array),
      material: material?.name ?? '',
      doubleSided: material?.doubleSided ?? false,
    };
  }
  /** Children of an asset root, local to that root (exported children carry no transforms). */
  children(root: string): GltfNode[] {
    return (this.node(root).children ?? []).map((i) => this.doc.nodes[i]);
  }
  /** Authored structural convex parts of an asset under `transform`. */
  colliders(root: string, transform: THREE.Matrix4): ConvexCollider[] {
    return this.children(root)
      .filter((n) => n.name.startsWith('COLLIDER_'))
      .map((n) => {
        const p = this.primitive(n.name).positions,
          points: THREE.Vector3[] = [];
        for (let i = 0; i < p.length; i += 3)
          points.push(new THREE.Vector3(p[i], p[i + 1], p[i + 2]));
        const hull = new ConvexGeometry(points);
        try {
          return rockCollider(hull, transform);
        } finally {
          hull.dispose();
        }
      });
  }
}

/** Mirror `AuthoredReef.setEnabled(true)` collider replacement on a CPU aquarium. */
export function installReefHulls(q: Aquarium, asset = new ReefAsset()): void {
  for (const rock of q.rocks)
    if (rock.solid && rock.collider)
      q.replacePresentationColliders(
        [rock.collider],
        asset.colliders(`Rock_${rock.template}_Root`, rock.mesh.matrix),
      );
}
