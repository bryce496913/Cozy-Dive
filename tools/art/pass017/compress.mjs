/* Pass 017: compress every shipped GLB in place (Draco geometry + WebP textures).
 *
 *   node tools/art/pass017/compress.mjs            # after any authoring script
 *   python3 tools/art/inspect_assets.py
 *
 * Authoring scripts write uncompressed GLBs; this is the last step. Already-compressed files are
 * skipped so a re-run never re-quantizes. Positions use 16-bit quantization per primitive (error
 * below 1/65535 of the primitive's extent - ~3e-5 world units for the largest props), so authored
 * collision point sets, attachment surfaces and the moray's UV centreline stay well inside the
 * existing test tolerances. Primitives with morph targets (fish bodies/fins) stay uncompressed, as
 * KHR_draco_mesh_compression does not cover morphs. Textures become WebP: colour maps at quality
 * 88, normal/ORM data near-lossless. GPU memory is unchanged (images decode to RGBA8).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco, textureCompress } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '../../../public/assets/models');
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });
const files = readdirSync(root, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith('.glb'))
  .sort();
for (const file of files) {
  const full = path.join(root, file);
  const bytes = readFileSync(full);
  const json = JSON.parse(
    bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)),
  );
  if ((json.extensionsUsed ?? []).includes('KHR_draco_mesh_compression')) {
    console.log(`${file}: already compressed (${bytes.length} bytes)`);
    continue;
  }
  const doc = await io.read(full);
  await doc.transform(
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      slots: /^(?!normalTexture|metallicRoughnessTexture|occlusionTexture).*/,
      quality: 88,
    }),
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      slots: /^(normalTexture|metallicRoughnessTexture|occlusionTexture)$/,
      nearLossless: true,
    }),
    draco({
      method: 'edgebreaker',
      quantizePosition: 16,
      quantizeNormal: 10,
      quantizeTexcoord: 14,
      quantizeColor: 8,
      quantizeGeneric: 12,
    }),
  );
  await io.write(full, doc);
  console.log(`${file}: ${bytes.length} -> ${statSync(full).size} bytes`);
}
