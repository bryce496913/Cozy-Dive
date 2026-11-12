/* CPU access to exported authored GLBs for tests (no WebGL, no image decoding).
 * Since Pass 017 shipped GLBs are Draco-compressed: primitives carrying
 * KHR_draco_mesh_compression are decoded with the reference draco3dgltf decoder. */
import { readFileSync } from 'node:fs';
import draco3d from 'draco3dgltf';
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
      extensions?: { KHR_draco_mesh_compression?: DracoPrimitiveExtension };
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
interface DracoPrimitiveExtension {
  bufferView: number;
  attributes: Record<string, number>;
}
type DracoModule = Awaited<ReturnType<typeof draco3d.createDecoderModule>>;
const draco: DracoModule = await draco3d.createDecoderModule();

/** Decode one Draco-compressed primitive into float attributes and triangle indices. */
function decodeDraco(
  data: Uint8Array,
  attributes: Record<string, number>,
  sizes: Record<string, number>,
): { attributes: Record<string, Float32Array>; indices: Uint32Array } {
  const decoder = new draco.Decoder(),
    buffer = new draco.DecoderBuffer(),
    mesh = new draco.Mesh();
  try {
    buffer.Init(
      new Int8Array(data.buffer, data.byteOffset, data.byteLength),
      data.byteLength,
    );
    const status = decoder.DecodeBufferToMesh(buffer, mesh);
    if (!status.ok()) throw Error(`Draco decode failed: ${status.error_msg()}`);
    const points = mesh.num_points(),
      out: Record<string, Float32Array> = {};
    for (const [semantic, id] of Object.entries(attributes)) {
      const attribute = decoder.GetAttributeByUniqueId(mesh, id),
        n = points * sizes[semantic],
        ptr = draco._malloc(n * 4);
      decoder.GetAttributeDataArrayForAllPoints(
        mesh,
        attribute,
        draco.DT_FLOAT32,
        n * 4,
        ptr,
      );
      out[semantic] = new Float32Array(draco.HEAPF32.buffer, ptr, n).slice();
      draco._free(ptr);
    }
    const faces = mesh.num_faces(),
      ptr = draco._malloc(faces * 12);
    decoder.GetTrianglesUInt32Array(mesh, faces * 12, ptr);
    const indices = new Uint32Array(
      draco.HEAPU32.buffer,
      ptr,
      faces * 3,
    ).slice();
    draco._free(ptr);
    return { attributes: out, indices };
  } finally {
    draco.destroy(mesh);
    draco.destroy(buffer);
    draco.destroy(decoder);
  }
}

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
  /** Every primitive of a node's mesh (one per material). */
  primitives(name: string): ReefPrimitive[] {
    const node = this.node(name);
    if (node.mesh === undefined) throw Error(`${name} has no mesh`);
    return this.doc.meshes[node.mesh].primitives.map((_, i) =>
      this.primitive(name, i),
    );
  }
  primitive(name: string, index = 0): ReefPrimitive {
    const node = this.node(name);
    if (node.mesh === undefined) throw Error(`${name} has no mesh`);
    const p = this.doc.meshes[node.mesh].primitives[index],
      material = this.doc.materials[p.material ?? 0],
      compressed = p.extensions?.KHR_draco_mesh_compression;
    if (compressed) {
      const view = this.doc.bufferViews[compressed.bufferView],
        start = view.byteOffset ?? 0,
        sizes = Object.fromEntries(
          Object.entries(p.attributes).map(([k, i]) => [
            k,
            SIZE[this.doc.accessors[i].type],
          ]),
        ),
        decoded = decodeDraco(
          this.bin.subarray(start, start + view.byteLength),
          compressed.attributes,
          sizes,
        );
      return {
        positions: decoded.attributes.POSITION,
        indices: decoded.indices,
        attributes: Object.keys(p.attributes),
        uvs: decoded.attributes.TEXCOORD_0,
        material: material?.name ?? '',
        doubleSided: material?.doubleSided ?? false,
      };
    }
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
export function installReefHulls(
  q: Aquarium,
  asset: ReefAsset = new ReefAsset(),
): void {
  for (const rock of q.rocks)
    if (rock.solid && rock.collider)
      q.replacePresentationColliders(
        [rock.collider],
        asset.colliders(`Rock_${rock.template}_Root`, rock.mesh.matrix),
      );
}
