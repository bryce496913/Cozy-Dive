/** Make a Blender-4.3-importable temporary GLB without KTX/Basis texture references.
 * Geometry, skins, morph targets, animations, node hierarchy, and PBR base factors are unchanged.
 * Usage: node strip_unsupported_textures.mjs source.glb destination.glb
 */
import { readFile, writeFile } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw Error('usage: strip_unsupported_textures.mjs in.glb out.glb');
// Decode Draco before Blender sees the temporary file. Blender 4.3's packaged glTF importer is
// missing its `libextern_draco.so`, while glTF Transform ships a compatible decoder.
const decoded = `${destination}.decoded.glb`;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
const document = await io.read(source);
for (const extension of document.getRoot().listExtensionsUsed())
  if (extension.extensionName === 'KHR_draco_mesh_compression') extension.dispose();
await io.write(decoded, document);
const bytes = await readFile(decoded);
if (bytes.readUInt32LE(0) !== 0x46546c67) throw Error('not a GLB');
const jsonLength = bytes.readUInt32LE(12);
const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
for (const material of json.materials ?? []) {
  const pbr = material.pbrMetallicRoughness;
  if (pbr) {
    delete pbr.baseColorTexture;
    delete pbr.metallicRoughnessTexture;
  }
  delete material.normalTexture;
  delete material.occlusionTexture;
  delete material.emissiveTexture;
  delete material.extensions;
}
delete json.images;
delete json.textures;
delete json.samplers;
json.extensionsUsed = (json.extensionsUsed ?? []).filter((name) => name !== 'KHR_texture_basisu');
json.extensionsRequired = (json.extensionsRequired ?? []).filter((name) => name !== 'KHR_texture_basisu');
const text = Buffer.from(JSON.stringify(json));
const padded = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
const tail = bytes.subarray(20 + jsonLength);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(20 + padded.length + tail.length, 8);
header.writeUInt32LE(padded.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
await writeFile(destination, Buffer.concat([header, padded, tail]));
