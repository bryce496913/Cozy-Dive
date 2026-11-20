import { Document } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import {
  STANDARDS,
  categoryFor,
  shippedAssets,
  validateDocument,
  validateGlbFile,
  type ValidateOptions,
} from '../validation/AssetStandards';

/** A minimal PNG header (signature + IHDR) with the given size: enough for size checks. */
function png(size: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48,
    0x44, 0x52,
  ]);
  const v = new DataView(b.buffer);
  v.setUint32(16, size);
  v.setUint32(20, size);
  b[24] = 8;
  b[25] = 6;
  return b;
}

interface Fixture {
  scale?: number;
  maps?: ('base' | 'normal' | 'orm')[];
  textureSize?: number;
  nanPosition?: boolean;
  badIndex?: boolean;
  morphs?: string[];
  morphNames?: string[];
  nodeName?: string;
  nodeScale?: [number, number, number];
  animationOutputs?: number;
}

/** A small closed tetrahedron asset with PBR maps; options seed one export mistake each. */
function fixture(f: Fixture = {}): Document {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const s = f.scale ?? 0.5;
  const positions = new Float32Array([0, 0, 0, s, 0, 0, 0, s, 0, 0, 0, s]);
  if (f.nanPosition) positions[4] = Number.NaN;
  const prim = doc
    .createPrimitive()
    .setAttribute(
      'POSITION',
      doc
        .createAccessor()
        .setType('VEC3')
        .setArray(positions)
        .setBuffer(buffer),
    )
    .setAttribute(
      'NORMAL',
      doc
        .createAccessor()
        .setType('VEC3')
        .setArray(new Float32Array([0, -1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]))
        .setBuffer(buffer),
    )
    .setAttribute(
      'TEXCOORD_0',
      doc
        .createAccessor()
        .setType('VEC2')
        .setArray(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]))
        .setBuffer(buffer),
    )
    .setIndices(
      doc
        .createAccessor()
        .setType('SCALAR')
        .setArray(
          new Uint16Array([
            0,
            2,
            1,
            0,
            1,
            3,
            0,
            3,
            2,
            f.badIndex ? 9 : 1,
            2,
            3,
          ]),
        )
        .setBuffer(buffer),
    );
  const material = doc
    .createMaterial('Reef_Limestone')
    .setRoughnessFactor(0.86);
  const maps = f.maps ?? ['base', 'normal', 'orm'];
  const tex = (name: string) =>
    doc
      .createTexture(name)
      .setMimeType('image/png')
      .setImage(png(f.textureSize ?? 512));
  if (maps.includes('base')) material.setBaseColorTexture(tex('rock-base'));
  if (maps.includes('normal')) material.setNormalTexture(tex('rock-normal'));
  if (maps.includes('orm'))
    material.setMetallicRoughnessTexture(tex('rock-orm'));
  prim.setMaterial(material);
  const mesh = doc.createMesh('Rock').addPrimitive(prim);
  for (const _ of f.morphs ?? []) {
    void _;
    prim.addTarget(
      doc
        .createPrimitiveTarget()
        .setAttribute(
          'POSITION',
          doc
            .createAccessor()
            .setType('VEC3')
            .setArray(new Float32Array(12).fill(0.01))
            .setBuffer(buffer),
        ),
    );
  }
  if (f.morphs?.length) {
    mesh.setExtras({ targetNames: f.morphNames ?? f.morphs });
    mesh.setWeights(f.morphs.map(() => 0));
  }
  const node = doc
    .createNode(f.nodeName ?? 'Rock')
    .setMesh(mesh)
    .setScale(f.nodeScale ?? [1, 1, 1]);
  const root = doc.createNode('Rock_Root').addChild(node);
  doc.createScene().addChild(root);
  if (f.animationOutputs !== undefined) {
    const sampler = doc
      .createAnimationSampler()
      .setInput(
        doc
          .createAccessor()
          .setType('SCALAR')
          .setArray(new Float32Array([0, 1]))
          .setBuffer(buffer),
      )
      .setOutput(
        doc
          .createAccessor()
          .setType('SCALAR')
          .setArray(new Float32Array(f.animationOutputs))
          .setBuffer(buffer),
      );
    doc
      .createAnimation('SwimPreview')
      .addSampler(sampler)
      .addChannel(
        doc
          .createAnimationChannel()
          .setTargetNode(node)
          .setTargetPath('weights')
          .setSampler(sampler),
      );
  }
  return doc;
}

const reef: ValidateOptions = { category: 'reef' };
const codes = (doc: Document, options: ValidateOptions = reef) =>
  validateDocument(doc, options).errors.map((e) => e.code);

describe('asset production standards (Pass 063)', () => {
  it('accepts a well-formed PBR asset', () => {
    const r = validateDocument(fixture(), reef);
    expect(r.errors).toEqual([]);
    expect(r.stats).toMatchObject({
      meshes: 1,
      triangles: 4,
      materials: 1,
      textures: 3,
      maxTexture: 512,
    });
  });

  it('reports a partial PBR map set', () => {
    expect(codes(fixture({ maps: ['base', 'orm'] }))).toContain('partial-maps');
  });

  it('reports wrong units / unapplied scale', () => {
    expect(codes(fixture({ scale: 50 }))).toContain('scale');
    expect(codes(fixture({ scale: 0.01 }))).toContain('scale');
  });

  it('reports malformed geometry', () => {
    expect(codes(fixture({ nanPosition: true }))).toContain('non-finite');
    expect(codes(fixture({ badIndex: true }))).toContain('bad-index');
  });

  it('reports mirrored transforms and oversized textures', () => {
    expect(codes(fixture({ nodeScale: [-1, 1, 1] }))).toContain(
      'negative-scale',
    );
    expect(codes(fixture({ textureSize: 2048 }))).toContain('texture-size');
    const warn = validateDocument(
      fixture({ textureSize: 1024 }),
      reef,
    ).warnings;
    expect(warn.map((w) => w.code)).toContain('texture-tier');
  });

  it('enforces the fish morph contract and animation exports', () => {
    const fish: ValidateOptions = {
      category: 'fish',
      requiredNodes: ['Body'],
    };
    const ok = fixture({
      nodeName: 'Body',
      morphs: ['Stroke_Left', 'Stroke_Right'],
    });
    expect(codes(ok, fish)).toEqual([]);
    expect(
      codes(fixture({ nodeName: 'Body', morphs: ['Stroke_Left'] }), fish),
    ).toContain('missing-morph');
    expect(
      codes(
        fixture({ nodeName: 'Body', morphs: ['A', 'B'], morphNames: ['A'] }),
        fish,
      ),
    ).toContain('morph-names');
    expect(
      codes(
        fixture({
          nodeName: 'Body',
          morphs: ['Stroke_Left', 'Stroke_Right'],
          animationOutputs: 3,
        }),
        fish,
      ),
    ).toContain('animation');
    expect(
      codes(
        fixture({
          nodeName: 'Body',
          morphs: ['Stroke_Left', 'Stroke_Right'],
          animationOutputs: 4,
        }),
        fish,
      ),
    ).toEqual([]);
  });

  it('defines every requested material template with the PBR contract', () => {
    for (const t of [
      'fish-skin',
      'fin',
      'shell',
      'coral-tissue',
      'limestone',
      'sand',
      'plant',
      'metal',
      'wood',
    ]) {
      const m = STANDARDS.materials[t];
      expect(m, t).toBeDefined();
      expect(m.maps).toContain('base');
      expect(m.roughness[0]).toBeLessThanOrEqual(m.roughness[1]);
      if (t !== 'fin') expect(m.maps).toEqual(['base', 'normal', 'orm']);
    }
    expect(STANDARDS.textureTiers.hero).toBe(512);
  });

  it('maps repository paths to categories', () => {
    expect(categoryFor('public/assets/models/fish/chromis.glb')).toBe('fish');
    expect(
      categoryFor('src/benchmark/style/assets/crafted-clownfish.glb'),
    ).toBe('fish');
    expect(categoryFor('public/assets/models/creatures/manta-ray.glb')).toBe(
      'creature',
    );
    expect(
      categoryFor('public/assets/models/creatures/anchored-life.glb'),
    ).toBe('library');
  });

  it('finds no export errors in any shipped or benchmark model', async () => {
    const files = shippedAssets();
    expect(files.length).toBeGreaterThan(40);
    for (const file of files) {
      const r = await validateGlbFile(file);
      expect(r.errors, file).toEqual([]);
    }
  }, 60000);

  it('the approved benchmark (B) assets meet the production budgets', async () => {
    const lib = await validateGlbFile(
      'src/benchmark/style/assets/style-crafted.glb',
    );
    expect(lib.stats.maxTexture).toBeLessThanOrEqual(
      STANDARDS.textureTiers.hero,
    );
    expect(lib.warnings).toEqual([]);
    for (const fish of ['crafted-chromis', 'crafted-clownfish']) {
      const r = await validateGlbFile(`src/benchmark/style/assets/${fish}.glb`);
      expect(r.stats.morphTargets).toEqual(['Stroke_Left', 'Stroke_Right']);
      // The only open item: candidate fish have no distance level yet.
      expect(new Set(r.warnings.map((w) => w.code))).toEqual(
        new Set(['missing-lod']),
      );
    }
  }, 30000);
});
