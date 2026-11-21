/* V0.7 Pass 078: replace named creature parts inside the shipped anchored-life library.
 *
 *   node tools/art/pass078/splice_anchored.mjs <raw.glb> <Root> [Node ...]
 *
 * `raw.glb` is an uncompressed export with a root node <Root> whose children are the new parts
 * (for example `Seahorse` with HorseBody, HorseTail, HorseDorsal, HorseLeftFin, HorseRightFin).
 * Each named child (default: all of them) replaces the mesh of the same-named node under the
 * shipped <Root>, so every other creature, node, pivot and transform is untouched (generalising
 * tools/art/frogfish/splice_frogfish.mjs to part-level replacement). Materials are matched by name
 * to the shipped (KTX2-textured) ones. Geometry is re-written with the pinned Pass 017 Draco
 * settings.
 */
import path from 'node:path';
import draco3d from 'draco3dgltf';
import { NodeIO } from '@gltf-transform/core';
import {
  ALL_EXTENSIONS,
  KHRDracoMeshCompression,
} from '@gltf-transform/extensions';
import { mergeDocuments, prune, unpartition } from '@gltf-transform/functions';

const repo = path.resolve(import.meta.dirname, '../../..');
const shipped = path.join(
  repo,
  'public/assets/models/creatures/anchored-life.glb',
);
const [raw, rootName, ...only] = process.argv.slice(2);
if (!raw || !rootName)
  throw Error('usage: splice_anchored.mjs <raw.glb> <Root> [Node ...]');
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });
const target = await io.read(shipped);
const source = await io.read(raw);
const rootOf = (doc, name) => {
  const node = doc
    .getRoot()
    .listNodes()
    .find((n) => n.getName() === name && !n.getParentNode());
  if (!node) throw Error(`Missing root node ${name}`);
  return node;
};
const sourceRoot = rootOf(source, rootName);
for (const node of source.getRoot().listScenes()[0].listChildren())
  if (node !== sourceRoot) node.dispose();
await source.transform(prune({ keepAttributes: true }));
const targetRoot = rootOf(target, rootName);
const shippedMaterials = new Map(
  target
    .getRoot()
    .listMaterials()
    .map((m) => [m.getName(), m]),
);
const map = mergeDocuments(target, source);
const copied = map.get(sourceRoot);
const replaced = [];
for (const part of copied.listChildren()) {
  const name = part.getName();
  if (only.length && !only.includes(name)) continue;
  if (part.getTranslation().some((v) => Math.abs(v) > 1e-9))
    throw Error(`${name} must carry no transform`);
  const old = targetRoot.listChildren().find((n) => n.getName() === name);
  if (!old) throw Error(`Shipped ${rootName} has no ${name}`);
  const mesh = part.getMesh();
  for (const prim of mesh.listPrimitives()) {
    const m = prim.getMaterial();
    const existing =
      m && shippedMaterials.get(m.getName().replace(/\.\d+$/, ''));
    if (!existing) throw Error(`No shipped material ${m?.getName()}`);
    prim.setMaterial(existing);
  }
  const previous = old.getMesh();
  old.setMesh(mesh);
  previous?.dispose();
  replaced.push(name);
}
// Drop the copied scene and root (their meshes now live on the shipped nodes).
for (const part of copied.listChildren()) part.setMesh(null);
map.get(source.getRoot().listScenes()[0])?.dispose();
copied.traverse((n) => n !== copied && n.dispose());
copied.dispose();
await target.transform(prune({ keepAttributes: true }), unpartition());
const left = target
  .getRoot()
  .listTextures()
  .filter((t) => t.getMimeType() !== 'image/ktx2');
if (left.length)
  throw Error(
    `${left.length} non-KTX2 texture(s) after splicing: ${left.map((t) => t.getName())}`,
  );
target
  .createExtension(KHRDracoMeshCompression)
  .setRequired(true)
  .setEncoderOptions({
    method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
    quantizationBits: {
      POSITION: 16,
      NORMAL: 10,
      TEX_COORD: 14,
      COLOR: 8,
      GENERIC: 12,
    },
  });
await io.write(shipped, target);
console.log(`${rootName}: replaced ${replaced.join(', ')}`);
