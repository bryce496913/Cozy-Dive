/* Replace only the Frogfish subtree in the shipped anchored-life library.
 *
 *   python3 tools/art/frogfish/frogfish.py <raw.glb>     # Blender 5.1 module: uncompressed Frogfish root
 *   node tools/art/frogfish/splice_frogfish.mjs <raw.glb>
 *   python3 tools/art/inspect_assets.py
 *
 * The seahorse, moray and anemone in the shipped anchored-life.glb were re-authored by Pass 015 from a
 * pinned input; re-running that chain is unnecessary for a frogfish-only change, so (as Pass 019 did
 * for the shipwreck) this merges the new Frogfish root into the shipped, compressed library and
 * removes the old one. FrogSkin15 and Eye are matched by name to the shipped KTX2-textured
 * materials; the untextured FrogMouth and FrogIris are new. Geometry is written with the pinned
 * Pass 017 Draco settings, so the other creatures re-quantize onto their existing 16-bit grid.
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
const raw = process.argv[2];
if (!raw) throw Error('usage: splice_frogfish.mjs <uncompressed frogfish.glb>');
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });
const target = await io.read(shipped);
const source = await io.read(raw);
const named = (doc, name) => {
  const node = doc
    .getRoot()
    .listNodes()
    .find((n) => n.getName() === name && !n.getParentNode());
  if (!node) throw Error(`Missing root node ${name}`);
  return node;
};
const keep = named(source, 'Frogfish');
for (const node of source.getRoot().listScenes()[0].listChildren())
  if (node !== keep) node.dispose();
await source.transform(prune({ keepAttributes: true }));
const old = named(target, 'Frogfish');
const scene = target.getRoot().listScenes()[0];
// Keep the library's root order: the new frogfish takes the old one's slot.
const order = scene.listChildren();
const shippedMaterials = new Map(
  target
    .getRoot()
    .listMaterials()
    .map((m) => [m.getName(), m]),
);
const map = mergeDocuments(target, source);
const frog = map.get(keep);
const copiedScene = map.get(source.getRoot().listScenes()[0]);
frog.setTranslation(old.getTranslation());
frog.setRotation(old.getRotation());
frog.setScale(old.getScale());
copiedScene?.dispose();
for (const child of order) scene.removeChild(child);
for (const child of order) scene.addChild(child === old ? frog : child);
old.traverse((n) => n.getMesh()?.dispose());
old.traverse((n) => n !== old && n.dispose());
old.dispose();
for (const child of frog.listChildren()) {
  const t = child.getTranslation();
  if (t.some((v) => Math.abs(v) > 1e-9))
    throw Error(`${child.getName()} must carry no transform`);
  for (const prim of child.getMesh()?.listPrimitives() ?? []) {
    const m = prim.getMaterial();
    const existing =
      m && shippedMaterials.get(m.getName().replace(/\.\d+$/, ''));
    if (existing) prim.setMaterial(existing);
  }
}
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
console.log(
  'Frogfish spliced:',
  frog
    .listChildren()
    .map((n) => n.getName())
    .join(', '),
  '| materials:',
  target
    .getRoot()
    .listMaterials()
    .map((m) => m.getName())
    .join(', '),
);
