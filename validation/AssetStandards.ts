/* V0.7 Pass 063: lightweight production checks for authored GLB assets.
 *
 * Reads the shared standards (tools/art/v07/standards.json) and inspects an exported glTF
 * document without WebGL: required nodes, naming, transforms, geometry integrity (finite data,
 * normals/UVs, index range, degenerate triangles), PBR map sets and texture sizes, morph-target
 * contracts, animation channels and authored scale. Errors are export mistakes that would break
 * or visibly damage an asset; warnings are standards deviations a reviewer should look at.
 *
 *   node validation/AssetStandards.ts public/assets/models/fish/chromis.glb [--category=fish]
 *   node validation/AssetStandards.ts --all            # every shipped + benchmark GLB
 *
 * Draco geometry is decoded with draco3dgltf; KTX2/PNG sizes are read from headers (no decoding).
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  type Document,
  type Material,
  type Mesh,
  type Node as GltfNode,
  type Primitive,
  type Texture,
  NodeIO,
  getBounds,
} from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

export type CategoryId =
  'fish' | 'creature' | 'reef' | 'plant' | 'prop' | 'library';
type Range = [number, number];
interface CategorySpec {
  dimension: Range;
  requiredNodes: string[];
  morphs: string[];
  morphMeshes: string[];
  lod: string[];
  texture: 'hero' | 'secondary' | 'background';
}
interface MaterialTemplate {
  roughness: Range;
  metallic: number | Range;
  normalStrength: number;
  doubleSided: boolean;
  alpha: 'OPAQUE' | 'BLEND' | 'MASK';
  maps: string[];
  tier: 'hero' | 'secondary' | 'background';
  note: string;
}
export interface Standards {
  version: number;
  naming: Record<
    'root' | 'node' | 'lod' | 'collider' | 'dynamic' | 'texture',
    string
  >;
  textureTiers: Record<
    'hero' | 'secondary' | 'background' | 'closeupMax',
    number
  >;
  categories: Record<CategoryId, CategorySpec>;
  materials: Record<string, MaterialTemplate>;
  untexturedAllowed: string[];
  geometry: { maxDegenerateRatio: number; minTriangleArea: number };
}

const repo = path.resolve(import.meta.dirname, '..');
export const STANDARDS = JSON.parse(
  readFileSync(path.join(repo, 'tools/art/v07/standards.json'), 'utf8'),
) as Standards;

export interface Finding {
  code: string;
  message: string;
}
export interface AssetReport {
  file?: string;
  category: CategoryId;
  errors: Finding[];
  warnings: Finding[];
  stats: {
    meshes: number;
    triangles: number;
    materials: number;
    textures: number;
    maxTexture: number;
    dimension: number;
    morphTargets: string[];
  };
}
export interface ValidateOptions {
  category: CategoryId;
  /** Overrides the category's [min, max] largest dimension (m). */
  dimension?: Range;
  requiredNodes?: string[];
}

const re = (key: keyof Standards['naming']) =>
  new RegExp(STANDARDS.naming[key]);

function isHelper(node: GltfNode): boolean {
  const name = node.getName();
  return re('collider').test(name) || re('dynamic').test(name);
}

/** Width/height from PNG, JPEG-less KTX2 or WebP headers; null if unknown. */
export function imageSize(
  image: Uint8Array | null,
  mime: string,
): [number, number] | null {
  if (!image || image.length < 32) return null;
  const view = new DataView(image.buffer, image.byteOffset, image.byteLength);
  if (mime === 'image/png') return [view.getUint32(16), view.getUint32(20)];
  if (mime === 'image/ktx2')
    return [view.getUint32(20, true), view.getUint32(24, true)];
  return null;
}

function powerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

function finite(array: ArrayLike<number> | null): boolean {
  if (!array) return true;
  for (let i = 0; i < array.length; i++)
    if (!Number.isFinite(array[i])) return false;
  return true;
}

function materialTextures(m: Material): {
  base: Texture | null;
  normal: Texture | null;
  orm: Texture | null;
} {
  return {
    base: m.getBaseColorTexture(),
    normal: m.getNormalTexture(),
    orm: m.getMetallicRoughnessTexture() ?? m.getOcclusionTexture(),
  };
}

function checkPrimitive(
  name: string,
  prim: Primitive,
  helper: boolean,
  err: (code: string, message: string) => void,
  warn: (code: string, message: string) => void,
): number {
  const position = prim.getAttribute('POSITION');
  if (!position) {
    err('missing-attribute', `${name}: primitive without POSITION`);
    return 0;
  }
  if (!finite(position.getArray()))
    err('non-finite', `${name}: non-finite positions`);
  if (!helper) {
    const normal = prim.getAttribute('NORMAL'),
      uv = prim.getAttribute('TEXCOORD_0');
    if (!normal || normal.getCount() !== position.getCount())
      err('missing-attribute', `${name}: missing or short NORMAL`);
    else if (!finite(normal.getArray()))
      err('non-finite', `${name}: non-finite normals`);
    if (!uv || uv.getCount() !== position.getCount())
      err('missing-attribute', `${name}: missing or short TEXCOORD_0`);
    else if (!finite(uv.getArray()))
      err('non-finite', `${name}: non-finite UVs`);
  }
  if (prim.getMode() !== 4) {
    warn(
      'primitive-mode',
      `${name}: primitive mode ${prim.getMode()} is not TRIANGLES`,
    );
    return 0;
  }
  const count = position.getCount();
  const indices = prim.getIndices()?.getArray() ?? null;
  const n = indices ? indices.length : count;
  if (n % 3)
    err('malformed-index', `${name}: index count ${n} is not a multiple of 3`);
  const idx = (i: number) => (indices ? indices[i] : i);
  const p = position.getArray()!;
  let degenerate = 0;
  const minArea = STANDARDS.geometry.minTriangleArea;
  for (let t = 0; t + 2 < n; t += 3) {
    const a = idx(t),
      b = idx(t + 1),
      c = idx(t + 2);
    if (a >= count || b >= count || c >= count) {
      err(
        'bad-index',
        `${name}: index ${Math.max(a, b, c)} beyond ${count} vertices`,
      );
      return n / 3;
    }
    const ux = p[b * 3] - p[a * 3],
      uy = p[b * 3 + 1] - p[a * 3 + 1],
      uz = p[b * 3 + 2] - p[a * 3 + 2],
      vx = p[c * 3] - p[a * 3],
      vy = p[c * 3 + 1] - p[a * 3 + 1],
      vz = p[c * 3 + 2] - p[a * 3 + 2];
    const cx = uy * vz - uz * vy,
      cy = uz * vx - ux * vz,
      cz = ux * vy - uy * vx;
    if (Math.hypot(cx, cy, cz) * 0.5 <= minArea) degenerate++;
  }
  const triangles = Math.floor(n / 3);
  if (!helper && degenerate) {
    const message = `${name}: ${degenerate} of ${triangles} triangles are degenerate`;
    if (degenerate / triangles > STANDARDS.geometry.maxDegenerateRatio)
      err('degenerate', message);
    else warn('degenerate', message);
  }
  return triangles;
}

function checkMorphs(
  node: GltfNode,
  mesh: Mesh,
  err: (code: string, message: string) => void,
): string[] {
  const prims = mesh.listPrimitives();
  const counts = prims.map((p) => p.listTargets().length);
  if (new Set(counts).size > 1)
    err(
      'morph-mismatch',
      `${node.getName()}: primitives carry different morph target counts (${counts.join(', ')})`,
    );
  const targets = counts[0] ?? 0;
  if (!targets) return [];
  const extras = mesh.getExtras() as { targetNames?: unknown };
  const names = Array.isArray(extras.targetNames)
    ? extras.targetNames.map(String)
    : [];
  if (names.length !== targets)
    err(
      'morph-names',
      `${node.getName()}: ${targets} morph targets but ${names.length} target names`,
    );
  if (mesh.getWeights().length && mesh.getWeights().length !== targets)
    err('morph-weights', `${node.getName()}: weights do not match targets`);
  for (const prim of prims) {
    const base = prim.getAttribute('POSITION')?.getCount() ?? 0;
    for (const target of prim.listTargets()) {
      const delta = target.getAttribute('POSITION');
      if (!delta || delta.getCount() !== base)
        err(
          'morph-shape',
          `${node.getName()}: morph target without matching POSITION deltas`,
        );
      else if (!finite(delta.getArray()))
        err('non-finite', `${node.getName()}: non-finite morph deltas`);
    }
  }
  return names;
}

export function validateDocument(
  doc: Document,
  options: ValidateOptions,
): AssetReport {
  const spec = STANDARDS.categories[options.category];
  const errors: Finding[] = [],
    warnings: Finding[] = [];
  const err = (code: string, message: string) => errors.push({ code, message });
  const warn = (code: string, message: string) =>
    warnings.push({ code, message });
  const root = doc.getRoot();
  const nodes = root.listNodes();
  const names = new Set(nodes.map((n) => n.getName()));
  const stats: AssetReport['stats'] = {
    meshes: 0,
    triangles: 0,
    materials: 0,
    textures: 0,
    maxTexture: 0,
    dimension: 0,
    morphTargets: [],
  };

  // Naming and transforms.
  for (const name of options.requiredNodes ?? spec.requiredNodes)
    if (!names.has(name)) err('missing-node', `missing required node ${name}`);
  if (
    !nodes.some((n) => re('root').test(n.getName())) &&
    options.category !== 'library'
  )
    warn('naming', 'no node named <Asset>_Root');
  for (const node of nodes) {
    const name = node.getName();
    const t = [
      ...node.getTranslation(),
      ...node.getRotation(),
      ...node.getScale(),
    ];
    if (!finite(t)) err('non-finite', `${name}: non-finite transform`);
    const s = node.getScale();
    if (s.some((v) => v < 0))
      err(
        'negative-scale',
        `${name}: negative scale mirrors the winding (apply transforms)`,
      );
    else if (
      node.getMesh() &&
      (Math.abs(s[0] - s[1]) > 1e-4 || Math.abs(s[1] - s[2]) > 1e-4)
    )
      warn(
        'non-uniform-scale',
        `${name}: non-uniform node scale (apply scale before export)`,
      );
    if (node.getMesh() && !isHelper(node) && name && !re('node').test(name))
      warn(
        'naming',
        `${name}: mesh node name is not PascalCase_With_Underscores`,
      );
  }

  // Geometry, materials, morphs.
  const materials = new Set<Material>();
  const morphByNode = new Map<string, string[]>();
  for (const node of nodes) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const helper = isHelper(node),
      name = node.getName();
    let tris = 0;
    for (const prim of mesh.listPrimitives()) {
      tris += checkPrimitive(name, prim, helper, err, warn);
      const m = prim.getMaterial();
      if (m && !helper) materials.add(m);
    }
    morphByNode.set(name, checkMorphs(node, mesh, err));
    if (!helper && !re('lod').test(name)) {
      stats.meshes++;
      stats.triangles += tris;
    }
  }
  const morphNodes = spec.morphMeshes;
  for (const meshName of morphNodes) {
    const got = morphByNode.get(meshName);
    if (!got) continue;
    for (const morph of spec.morphs)
      if (!got.includes(morph))
        err('missing-morph', `${meshName}: missing morph target ${morph}`);
  }
  for (const [name, targets] of morphByNode) {
    if (!re('lod').test(name)) continue;
    const base = morphByNode.get(name.replace(re('lod'), ''));
    if (base && base.join() !== targets.join())
      err(
        'lod-morphs',
        `${name}: morph targets differ from its full-detail mesh`,
      );
  }
  stats.morphTargets = [...new Set([...morphByNode.values()].flat())];
  for (const lod of spec.lod)
    if (!names.has(lod)) warn('missing-lod', `no distance level ${lod}`);

  const tier = STANDARDS.textureTiers[spec.texture];
  const textures = new Set<Texture>();
  for (const m of materials) {
    const label = m.getName() || '(unnamed material)';
    if (
      STANDARDS.untexturedAllowed.some(
        (p) => label.startsWith(p) || label.includes(`_${p}`),
      )
    )
      continue;
    const { base, normal, orm } = materialTextures(m);
    const present = [base, normal, orm].filter(Boolean).length;
    if (!present) warn('untextured', `${label}: no PBR maps`);
    else if (present < 3) {
      // The fin template is a blended membrane whose ray detail and edge alpha live in the base map.
      if (!(m.getAlphaMode() === 'BLEND' && base))
        err(
          'partial-maps',
          `${label}: needs base, normal and ORM maps (has ${present} of 3)`,
        );
    }
    if (m.getMetallicFactor() > 0 && !orm)
      warn('metal', `${label}: metallic without an ORM map`);
    for (const t of [base, normal, orm]) if (t) textures.add(t);
  }
  for (const t of textures) {
    const size = t.getSize() ?? imageSize(t.getImage(), t.getMimeType());
    if (!size) continue;
    const edge = Math.max(size[0], size[1]);
    stats.maxTexture = Math.max(stats.maxTexture, edge);
    const label = t.getName() || t.getURI() || '(texture)';
    if (!powerOfTwo(size[0]) || !powerOfTwo(size[1]))
      warn(
        'texture-size',
        `${label}: ${size[0]}x${size[1]} is not a power of two`,
      );
    if (edge > STANDARDS.textureTiers.closeupMax)
      err(
        'texture-size',
        `${label}: ${edge} px exceeds the ${STANDARDS.textureTiers.closeupMax} px maximum`,
      );
    else if (edge > tier)
      warn(
        'texture-tier',
        `${label}: ${edge} px above the ${spec.texture} tier (${tier} px)`,
      );
  }
  stats.materials = materials.size;
  stats.textures = textures.size;

  // Animation channels.
  for (const anim of root.listAnimations()) {
    for (const channel of anim.listChannels()) {
      const target = channel.getTargetNode(),
        sampler = channel.getSampler(),
        input = sampler?.getInput(),
        output = sampler?.getOutput();
      if (!target || !sampler || !input || !output) {
        err(
          'animation',
          `${anim.getName()}: channel without target or sampler data`,
        );
        continue;
      }
      const pathName = channel.getTargetPath();
      const width =
        pathName === 'weights'
          ? (target.getMesh()?.listPrimitives()[0]?.listTargets().length ?? 0)
          : 1;
      if (pathName === 'weights' && !width)
        err(
          'animation',
          `${anim.getName()}: weights channel on ${target.getName()} without morph targets`,
        );
      const keys = input.getCount(),
        cubic = sampler.getInterpolation() === 'CUBICSPLINE' ? 3 : 1;
      if (width && output.getCount() !== keys * width * cubic)
        err(
          'animation',
          `${anim.getName()}: ${target.getName()} ${pathName} sampler has ${output.getCount()} outputs for ${keys} keys`,
        );
      if (!finite(input.getArray()) || !finite(output.getArray()))
        err('non-finite', `${anim.getName()}: non-finite keyframes`);
    }
  }

  // Authored scale: the largest dimension of the visible model.
  let lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  for (const scene of root.listScenes()) {
    const b = getBounds(scene);
    lo = lo.map((v, i) => Math.min(v, b.min[i]));
    hi = hi.map((v, i) => Math.max(v, b.max[i]));
  }
  const dimension = Math.max(...hi.map((v, i) => v - lo[i]));
  stats.dimension = Number.isFinite(dimension) ? dimension : 0;
  const [min, max] = options.dimension ?? spec.dimension;
  if (!Number.isFinite(dimension) || dimension < min || dimension > max)
    err(
      'scale',
      `largest dimension ${Number.isFinite(dimension) ? dimension.toFixed(3) : 'n/a'} m outside ${min}-${max} m (wrong units or unapplied scale?)`,
    );
  return { category: options.category, errors, warnings, stats };
}

let io: Promise<NodeIO> | undefined;
export function gltfIO(): Promise<NodeIO> {
  io ??= draco3d
    .createDecoderModule()
    .then((decoder) =>
      new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({ 'draco3d.decoder': decoder }),
    );
  return io;
}

/** Category for a repository GLB path (documented in docs/V07_ART_PRODUCTION.md). */
export function categoryFor(file: string): CategoryId {
  const f = file.replaceAll('\\', '/');
  if (/\/fish\/|-(chromis|clownfish)\.glb$/.test(f)) return 'fish';
  if (
    /(anchored-life|nudibranchs|rare-minis|reef-minis|kelp-minis)\.glb$/.test(f)
  )
    return 'library';
  if (/\/creatures\//.test(f)) return 'creature';
  if (/\/coral\//.test(f)) return 'reef';
  return 'library';
}

export async function validateGlbFile(
  file: string,
  options?: Partial<ValidateOptions>,
): Promise<AssetReport> {
  const doc = await (await gltfIO()).read(file);
  return {
    ...validateDocument(doc, {
      category: options?.category ?? categoryFor(file),
      ...options,
    }),
    file,
  };
}

export function shippedAssets(): string[] {
  const out: string[] = [];
  for (const dir of ['public/assets/models', 'src/benchmark/style/assets']) {
    const abs = path.join(repo, dir);
    for (const f of readdirSync(abs, { recursive: true }).map(String))
      if (f.endsWith('.glb')) out.push(path.join(abs, f));
  }
  return out.sort();
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
  const args = process.argv.slice(2);
  const category = args
    .find((a) => a.startsWith('--category='))
    ?.split('=')[1] as CategoryId | undefined;
  const files = args.includes('--all')
    ? shippedAssets()
    : args.filter((a) => !a.startsWith('--'));
  let failed = 0;
  for (const file of files) {
    const r = await validateGlbFile(file, category ? { category } : undefined);
    const rel = path.relative(repo, file);
    console.log(
      `${r.errors.length ? 'FAIL' : 'ok  '} ${rel} [${r.category}] ${r.stats.triangles} tris, ${r.stats.materials} materials, ${r.stats.maxTexture}px max, ${r.stats.dimension.toFixed(2)} m, ${r.warnings.length} warnings`,
    );
    for (const e of r.errors) console.log(`  error ${e.code}: ${e.message}`);
    if (args.includes('--warnings'))
      for (const w of r.warnings)
        console.log(`  warn  ${w.code}: ${w.message}`);
    if (r.errors.length) failed++;
  }
  if (failed) process.exitCode = 1;
}
