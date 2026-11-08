import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ASSET_REGISTRY } from '../src/assets/AssetRegistry';
interface Inventory {
  id: string;
  file: string;
  sha256: string;
  license: string;
  visualTriangles: number;
  images: { width: number; height: number }[];
  animations: string[];
}
const manifest: Inventory[] = JSON.parse(
  readFileSync('public/assets/manifest.json', 'utf8'),
);
it.each(Object.entries(ASSET_REGISTRY))(
  'bundles valid self-contained licensed GLB data for %s',
  (id, spec) => {
    const file = readFileSync(`public/${spec.path}`),
      row = manifest.find((r) => r.file === spec.path)!;
    expect(row.license).toBe('CC0-1.0');
    expect(createHash('sha256').update(file).digest('hex')).toBe(row.sha256);
    expect(file.toString('ascii', 0, 4)).toBe('glTF');
    expect(file.readUInt32LE(4)).toBe(2);
    expect(file.readUInt32LE(8)).toBe(file.length);
    const length = file.readUInt32LE(12),
      doc: {
        nodes: { name: string }[];
        buffers: { uri?: string }[];
        images: { uri?: string; bufferView: number }[];
        meshes: {
          primitives: {
            attributes: Record<string, number>;
            targets?: unknown[];
          }[];
        }[];
      } = JSON.parse(file.toString('utf8', 20, 20 + length));
    for (const name of spec.requiredNodes)
      expect(doc.nodes.some((n) => n.name === name)).toBe(true);
    expect(doc.buffers.every((b) => !b.uri)).toBe(true);
    expect(
      doc.images.every((i) => !i.uri && Number.isInteger(i.bufferView)),
    ).toBe(true);
    expect(row.images.every((i) => i.width === 512 && i.height === 512)).toBe(
      true,
    );
    for (const mesh of doc.meshes)
      for (const p of mesh.primitives)
        for (const attr of ['POSITION', 'NORMAL', 'TEXCOORD_0'])
          expect(p.attributes[attr]).toBeDefined();
    expect(row.visualTriangles).toBeGreaterThan(5000);
    if (id === 'chromis') {
      expect(row.animations).toContain('SwimPreview');
      expect(
        doc.meshes.filter((m) =>
          m.primitives.some((p) => p.targets?.length === 2),
        ).length,
      ).toBeGreaterThanOrEqual(2);
    }
  },
);

import { validateAsset, disposeAsset } from '../src/assets/AssetValidation';
import { assetFixture } from './fixtures/assetFixture';
import * as THREE from 'three';
it.each(['uv', 'normal', 'finite', 'scale', 'morphs', 'textures'])(
  'rejects a broken authored %s contract',
  (kind) => {
    const asset = assetFixture(),
      body = asset.scene.getObjectByName('Body');
    if (!(body instanceof THREE.Mesh)) throw Error('Fixture');
    if (kind === 'uv' || kind === 'normal') body.geometry.deleteAttribute(kind);
    else if (kind === 'finite') body.geometry.attributes.position.setX(0, NaN);
    else if (kind === 'scale') asset.scene.scale.setScalar(100);
    else if (kind === 'textures') {
      if (body.material instanceof THREE.MeshStandardMaterial)
        body.material.map = null;
    } else body.geometry.morphAttributes = {};
    try {
      expect(() => validateAsset('chromis', asset)).toThrow();
    } finally {
      disposeAsset(asset);
    }
  },
);
