/** Finish only Pass 104's library with the existing 16-bit Draco convention and inventory. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { ktx2 } from 'ktx2-encoder/gltf-transform';
import sharp from 'sharp';
const file = 'public/assets/models/creatures/cave-minis.glb';
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });
const doc = await io.read(file);
const common = {
  generateMipmap: true,
  isKTX2File: true,
  imageDecoder: async (buffer) => {
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return {
      data: new Uint8Array(data),
      width: info.width,
      height: info.height,
    };
  },
};
if (
  doc
    .getRoot()
    .listTextures()
    .some((t) => t.getMimeType() !== 'image/ktx2')
)
  await doc.transform(
    ktx2({
      ...common,
      slots: /^normalTexture$/,
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
      slots: /^(metallicRoughnessTexture|occlusionTexture)$/,
      isUASTC: false,
      qualityLevel: 230,
      compressionLevel: 4,
      isPerceptual: false,
      isSetKTX2SRGBTransferFunc: false,
    }),
    ktx2({
      ...common,
      slots:
        /^(?!normalTexture$|metallicRoughnessTexture$|occlusionTexture$).*/,
      isUASTC: false,
      qualityLevel: 230,
      compressionLevel: 4,
      isPerceptual: true,
      isSetKTX2SRGBTransferFunc: true,
    }),
  );
await doc.transform(
  draco({
    method: 'edgebreaker',
    quantizePosition: 16,
    quantizeNormal: 10,
    quantizeTexcoord: 14,
    quantizeColor: 8,
    quantizeGeneric: 12,
  }),
);
await io.write(file, doc);
const bytes = fs.readFileSync(file),
  json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
const manifest = 'public/assets/manifest.json',
  rows = JSON.parse(fs.readFileSync(manifest, 'utf8')),
  row = rows.find((r) => r.id === 'cave-minis') ?? {
    ...rows[rows.length - 1],
    id: 'cave-minis',
    file: 'assets/models/creatures/cave-minis.glb',
    usage:
      'Four rare sea cave miniature discoveries; shared album and aquarium art (Pass 104)',
  };
if (!rows.includes(row)) rows.push(row);
row.visualTriangles = json.meshes.reduce(
  (n, m) =>
    n +
    m.primitives.reduce((n, p) => n + json.accessors[p.indices].count / 3, 0),
  0,
);
row.visualPrimitives = 4;
row.images = (json.images ?? []).map((i) => ({
  name: i.name,
  width: 512,
  height: 512,
  mode: i.name?.includes('normal') ? 'KTX2-UASTC+zstd' : 'KTX2-ETC1S',
  mipLevels: 10,
  encodedBytes: json.bufferViews[i.bufferView].byteLength,
}));
row.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
row.bytes = bytes.length;
row.geometryAccessorBytes = json.bufferViews.reduce(
  (n, v) => n + v.byteLength,
  0,
);
fs.writeFileSync(manifest, JSON.stringify(rows, null, 2) + '\n');
console.log(JSON.stringify({ file, bytes: bytes.length, sha256: row.sha256 }));
