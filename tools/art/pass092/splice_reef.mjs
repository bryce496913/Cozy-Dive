/* V0.8 Pass 092: replace whole pieces (mesh and collision parts) inside the shipped reef library.
 *
 *   node tools/art/pass092/splice_reef.mjs <raw.glb> <Root> [Root ...]
 *
 * `raw.glb` is an uncompressed export holding root nodes of the same names as shipped roots in
 * reef-environment.glb (e.g. `Coral_Plate_0_Root`). Each named shipped root loses its children
 * (the visible mesh and its `COLLIDER_*` parts) and takes the new root's children instead; the
 * shipped root node itself (its name, transform and extras) and every other piece are untouched
 * (Pass 078's splice_anchored.mjs replaced single meshes; pieces here change their collision
 * too). Materials are matched by name to the shipped (KTX2-textured) ones; geometry is re-written
 * with the pinned Pass 017 Draco settings.
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
  'public/assets/models/reef/reef-environment.glb',
);
const [raw, ...roots] = process.argv.slice(2);
if (!raw || !roots.length)
  throw Error('usage: splice_reef.mjs <raw.glb> <Root> [Root ...]');
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });
const target = await io.read(shipped);
const source = await io.read(raw);
const find = (doc, name) =>
  doc
    .getRoot()
    .listNodes()
    .find((n) => n.getName() === name);
const shippedMaterials = new Map(
  target
    .getRoot()
    .listMaterials()
    .map((m) => [m.getName(), m]),
);
const map = mergeDocuments(target, source);
for (const name of roots) {
  const from = map.get(find(source, name)),
    into = target
      .getRoot()
      .listNodes()
      .find((n) => n.getName() === name && n !== from);
  if (!from || !into) throw Error(`Missing ${name}`);
  for (const old of into.listChildren()) {
    old.getMesh()?.dispose();
    old.dispose();
  }
  for (const part of from.listChildren()) {
    if (part.getTranslation().some((v) => Math.abs(v) > 1e-9))
      throw Error(`${part.getName()} must carry no transform`);
    for (const prim of part.getMesh()?.listPrimitives() ?? []) {
      const m = prim.getMaterial();
      if (!m) continue;
      const existing = shippedMaterials.get(m.getName().replace(/\.\d+$/, ''));
      // Collision parts carry the exporter's proxy material; keep the shipped one of that name.
      if (existing) prim.setMaterial(existing);
      else if (!/^COLLIDER_/.test(part.getName()))
        throw Error(`No shipped material ${m.getName()}`);
    }
    from.removeChild(part);
    into.addChild(part);
  }
  console.log(
    `${name}: ${into
      .listChildren()
      .map((c) => c.getName())
      .join(', ')}`,
  );
}
// Drop what is left of the source document (its scene, roots and unused materials).
for (const scene of target.getRoot().listScenes())
  if (scene !== target.getRoot().getDefaultScene()) scene.dispose();
for (const name of roots) {
  const leftover = target
    .getRoot()
    .listNodes()
    .find((n) => n.getName() === name && !n.listChildren().length);
  leftover?.dispose();
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
