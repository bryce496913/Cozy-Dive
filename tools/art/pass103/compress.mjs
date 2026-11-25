/** Finish only Pass 103's library with the existing 16-bit Draco convention and inventory. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
const file = 'public/assets/models/creatures/wreck-minis.glb';
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });
const doc = await io.read(file);
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
  row = rows.find((r) => r.id === 'wreck-minis') ?? {
    ...rows[rows.length - 1],
    id: 'wreck-minis',
    file: 'assets/models/creatures/wreck-minis.glb',
    usage:
      'Four rare shipwreck miniature discoveries; shared album and aquarium art (Pass 103)',
  };
if (!rows.includes(row)) rows.push(row);
row.visualTriangles = json.meshes.reduce(
  (n, m) =>
    n +
    m.primitives.reduce((n, p) => n + json.accessors[p.indices].count / 3, 0),
  0,
);
row.visualPrimitives = 4;
row.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
row.bytes = bytes.length;
row.geometryAccessorBytes = json.bufferViews.reduce(
  (n, v) => n + v.byteLength,
  0,
);
fs.writeFileSync(manifest, JSON.stringify(rows, null, 2) + '\n');
console.log(JSON.stringify({ file, bytes: bytes.length, sha256: row.sha256 }));
