/* Pass 019: replace only the Shipwreck in the shipped ornament library.
 *
 *   python tools/art/pass013/author.py          # Blender module: writes an uncompressed full library
 *   python3 tools/art/pass013/collision_inventory.py   # read its Shipwreck collision points
 *   node tools/art/pass019/splice_wreck.mjs <raw reef-props.glb>
 *
 * The other five props in the shipped reef-props.glb were refined after Pass 013's author.py
 * (re-running it no longer reproduces them), so this splices just the redesigned Shipwreck subtree
 * from a fresh author.py export into the shipped, already compressed library. Materials are
 * matched by name (Wood, Cut_Wood, Dark, Growth reuse the shipped KTX2 textures; Sand is new and
 * untextured). Geometry is written with the same Draco settings as compress.mjs.
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
  'public/assets/models/ornaments/reef-props.glb',
);
const raw = process.argv[2];
if (!raw)
  throw Error(
    'usage: splice_wreck.mjs <uncompressed author.py reef-props.glb>',
  );
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
// Keep only the Shipwreck subtree in the source before merging.
const keep = named(source, 'Shipwreck');
for (const node of source.getRoot().listScenes()[0].listChildren())
  if (node !== keep) node.dispose();
await source.transform(prune({ keepAttributes: true }));
const oldWreck = named(target, 'Shipwreck');
const shippedMaterials = new Map(
  target
    .getRoot()
    .listMaterials()
    .map((m) => [m.getName(), m]),
);
const scene = target.getRoot().listScenes()[0];
const map = mergeDocuments(target, source);
const newWreck = map.get(keep);
const copiedScene = map.get(source.getRoot().listScenes()[0]);
// Same scene slot and transform as the shipped wreck root.
newWreck.setTranslation(oldWreck.getTranslation());
newWreck.setRotation(oldWreck.getRotation());
newWreck.setScale(oldWreck.getScale());
scene.addChild(newWreck);
copiedScene?.dispose();
oldWreck.traverse((n) => n.getMesh()?.dispose());
oldWreck.traverse((n) => n !== oldWreck && n.dispose());
oldWreck.dispose();
// Reuse shipped materials by name; new Sand stays as authored.
newWreck.traverse((node) => {
  for (const prim of node.getMesh()?.listPrimitives() ?? []) {
    const m = prim.getMaterial();
    const existing =
      m && shippedMaterials.get(m.getName().replace(/\.\d+$/, ''));
    if (existing) prim.setMaterial(existing);
  }
});
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
  'Shipwreck spliced:',
  newWreck.listChildren().length,
  'children;',
  target
    .getRoot()
    .listMaterials()
    .map((m) => m.getName())
    .join(', '),
);
