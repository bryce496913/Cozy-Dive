/* Compress every shipped GLB in place: Draco geometry (Pass 017) + KTX2/Basis textures (Pass 018).
 *
 *   node tools/art/pass017/compress.mjs            # after any authoring script
 *   python3 tools/art/inspect_assets.py
 *
 * Geometry: authoring scripts write uncompressed GLBs. Files already using
 * KHR_draco_mesh_compression keep their geometry (never re-quantized). Positions use 16-bit
 * quantization per primitive (~3e-5 world units for the largest props), so collision point sets,
 * attachment surfaces and the moray's UV centreline stay inside the existing test tolerances.
 * Primitives with morph targets (fish bodies/fins) stay uncompressed, as Draco does not cover them.
 *
 * Textures (Pass 018): every image becomes KTX2 (KHR_texture_basisu) with a full mip chain, so it
 * stays compressed in GPU memory (the browser transcodes to ASTC/BC/ETC as the device supports).
 * Each image is re-encoded from its original authoring PNG in tools/art/textures (matched by image
 * name) rather than from an earlier lossy copy:
 *   - normal maps: UASTC with RDO and Zstandard supercompression (keeps fine surface detail);
 *   - colour maps: ETC1S, sRGB / perceptual;
 *   - ORM data maps: ETC1S, linear.
 * Files whose images are already KTX2 are left untouched.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import {
  ALL_EXTENSIONS,
  KHRDracoMeshCompression,
} from '@gltf-transform/extensions';
import { draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { ktx2 } from 'ktx2-encoder/gltf-transform';
import sharp from 'sharp';

const repo = path.resolve(import.meta.dirname, '../../..');
const root = path.join(repo, 'public/assets/models');
const sources = new Map(
  readdirSync(path.join(repo, 'tools/art/textures'), { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.png'))
    .map((f) => [
      path.basename(f, '.png'),
      path.join(repo, 'tools/art/textures', f),
    ]),
);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });
const imageDecoder = async (buffer) => {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};
const common = { generateMipmap: true, isKTX2File: true, imageDecoder };
const DRACO = {
  method: 'edgebreaker',
  quantizePosition: 16,
  quantizeNormal: 10,
  quantizeTexcoord: 14,
  quantizeColor: 8,
  quantizeGeneric: 12,
};
const NORMAL = /^normalTexture$/;
const DATA = /^(metallicRoughnessTexture|occlusionTexture)$/;
const COLOUR =
  /^(?!normalTexture$|metallicRoughnessTexture$|occlusionTexture$).*/;

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
  const used = json.extensionsUsed ?? [];
  const hasDraco = used.includes('KHR_draco_mesh_compression');
  const hasKtx2 = (json.images ?? []).every((i) => i.mimeType === 'image/ktx2');
  if (hasDraco && hasKtx2) {
    console.log(`${file}: already compressed (${bytes.length} bytes)`);
    continue;
  }
  const doc = await io.read(full);
  if (hasDraco)
    // Writing always re-encodes Draco primitives: pin the original 16-bit settings so decoded
    // geometry re-quantizes onto the same grid instead of gltf-transform's 14-bit defaults.
    doc
      .createExtension(KHRDracoMeshCompression)
      .setRequired(true)
      .setEncoderOptions({
        method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
        quantizationBits: {
          POSITION: DRACO.quantizePosition,
          NORMAL: DRACO.quantizeNormal,
          TEX_COORD: DRACO.quantizeTexcoord,
          COLOR: DRACO.quantizeColor,
          GENERIC: DRACO.quantizeGeneric,
        },
      });
  if (!hasKtx2) {
    // Restore each image from its lossless authoring source before the single Basis encode.
    let restored = 0;
    for (const texture of doc.getRoot().listTextures()) {
      const source = sources.get(texture.getName());
      if (!source) continue;
      texture.setImage(new Uint8Array(readFileSync(source)));
      texture.setMimeType('image/png');
      restored++;
    }
    await doc.transform(
      ktx2({
        ...common,
        slots: NORMAL,
        isUASTC: true,
        isNormalMap: true,
        enableRDO: true,
        rdoQualityLevel: 1,
        needSupercompression: true,
        isPerceptual: false,
        isSetKTX2SRGBTransferFunc: false,
      }),
      ktx2({
        ...common,
        slots: DATA,
        isUASTC: false,
        qualityLevel: 230,
        compressionLevel: 4,
        isPerceptual: false,
        isSetKTX2SRGBTransferFunc: false,
      }),
      ktx2({
        ...common,
        slots: COLOUR,
        isUASTC: false,
        qualityLevel: 230,
        compressionLevel: 4,
        isPerceptual: true,
        isSetKTX2SRGBTransferFunc: true,
      }),
    );
    const left = doc
      .getRoot()
      .listTextures()
      .filter((t) => t.getMimeType() !== 'image/ktx2');
    if (left.length)
      throw Error(`${file}: ${left.length} texture(s) not converted to KTX2`);
    doc
      .getRoot()
      .listExtensionsUsed()
      .filter((e) => e.extensionName === 'EXT_texture_webp')
      .forEach((e) => e.dispose());
    console.log(`${file}: ${restored} image(s) re-encoded from authoring PNGs`);
  }
  if (!hasDraco) await doc.transform(draco(DRACO));
  await io.write(full, doc);
  console.log(`${file}: ${bytes.length} -> ${statSync(full).size} bytes`);
}
