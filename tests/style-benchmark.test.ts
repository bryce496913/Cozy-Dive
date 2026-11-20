import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TANK_LIGHTING } from '../src/config/tankLighting';
import {
  FOV,
  LAYOUT,
  LIGHTING,
  SUBJECT_NODES,
  TREATMENTS,
  VIEWS,
  fitScale,
  parseSelection,
  strokeAt,
} from '../src/benchmark/style/treatments';

const ASSETS = 'src/benchmark/style/assets';

interface GlbJson {
  nodes: { name: string; mesh?: number }[];
  meshes: {
    primitives: {
      indices?: number;
      material?: number;
      extensions?: Record<string, unknown>;
    }[];
  }[];
  accessors: { count: number }[];
  materials: {
    name: string;
    normalTexture?: unknown;
    pbrMetallicRoughness?: {
      baseColorTexture?: unknown;
      metallicRoughnessTexture?: unknown;
    };
  }[];
  images?: { mimeType?: string }[];
  extensionsUsed?: string[];
}

function glb(file: string): GlbJson {
  const bytes = readFileSync(`${ASSETS}/${file}`);
  const json: unknown = JSON.parse(
    bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)),
  );
  return json as GlbJson;
}

function triangles(doc: GlbJson, node: string): number {
  const n = doc.nodes.find((x) => x.name === node);
  if (n?.mesh === undefined) throw Error(`missing ${node}`);
  return doc.meshes[n.mesh].primitives.reduce(
    (sum, p) =>
      sum + (p.indices === undefined ? 0 : doc.accessors[p.indices].count / 3),
    0,
  );
}

describe('style benchmark treatments (Pass 062)', () => {
  it('baseline lighting is exactly the shipped tank rig', () => {
    const b = LIGHTING.baseline;
    expect(b.background).toBe(TANK_LIGHTING.background);
    expect(b.fogDensity).toBe(TANK_LIGHTING.fogDensity);
    expect(b.exposure).toBe(TANK_LIGHTING.exposure);
    expect(b.hemisphere).toEqual(TANK_LIGHTING.hemisphere);
    expect(b.sun).toEqual(TANK_LIGHTING.sun);
    expect(b.fill).toEqual(TANK_LIGHTING.fill);
    expect(b.shadows).toBe(false);
  });

  it('selects assets and lighting independently, with safe fallbacks', () => {
    expect(parseSelection('')).toEqual({
      assets: 'baseline',
      lighting: 'baseline',
      view: 'swimming',
      ui: true,
    });
    expect(parseSelection('?assets=crafted')).toMatchObject({
      assets: 'crafted',
      lighting: 'crafted',
    });
    expect(
      parseSelection('?assets=natural&lighting=baseline&view=medium&ui=0'),
    ).toEqual({
      assets: 'natural',
      lighting: 'baseline',
      view: 'medium',
      ui: false,
    });
    expect(parseSelection('?style=crafted')).toMatchObject({
      assets: 'crafted',
      lighting: 'crafted',
    });
    expect(parseSelection('?assets=bogus&view=nowhere')).toMatchObject({
      assets: 'baseline',
      view: 'swimming',
    });
  });

  it('gives every treatment every subject, with three seagrass templates', () => {
    for (const t of TREATMENTS) {
      const nodes = SUBJECT_NODES[t];
      expect(nodes.rock.length).toBeGreaterThan(0);
      expect(nodes.brain.length).toBeGreaterThan(0);
      expect(nodes.branching.length).toBeGreaterThan(0);
      expect(nodes.seagrass).toHaveLength(3);
    }
    for (const clump of LAYOUT.seagrass)
      expect([0, 1, 2]).toContain(clump.template);
  });

  it('scales any model to the same largest dimension', () => {
    for (const source of [0.3, 1.7, 2.1, 12])
      expect(source * fitScale(source, 1.8)).toBeCloseTo(1.8, 10);
    expect(() => fitScale(0, 1)).toThrow();
  });

  it('keeps the layout readable: subjects apart, fish above the sand, cameras in open water', () => {
    const hero = [LAYOUT.rock, LAYOUT.brain, LAYOUT.branching];
    for (let i = 0; i < hero.length; i++)
      for (let j = i + 1; j < hero.length; j++) {
        const a = hero[i],
          b = hero[j],
          d = Math.hypot(
            a.position[0] - b.position[0],
            a.position[2] - b.position[2],
          );
        expect(d).toBeGreaterThan((a.size + b.size) * 0.4);
      }
    for (const f of [...LAYOUT.chromis, ...LAYOUT.clownfish])
      expect(f.position[1]).toBeGreaterThan(0.4);
    for (const v of VIEWS) {
      expect(v.eye[1]).toBeGreaterThan(0.6);
      const r = LAYOUT.rock.position;
      expect(Math.hypot(v.eye[0] - r[0], v.eye[2] - r[2])).toBeGreaterThan(
        LAYOUT.rock.size * 0.6,
      );
    }
    expect(new Set(VIEWS.map((v) => v.distance))).toEqual(
      new Set(['close', 'medium', 'swimming']),
    );
    expect(FOV).toBe(64);
  });

  it('beats the tail deterministically within the morph range', () => {
    for (const t of [0, 0.25, 1.7, 33.3]) {
      expect(strokeAt(t, 1)).toBe(strokeAt(t, 1));
      expect(Math.abs(strokeAt(t, 2))).toBeLessThanOrEqual(0.55);
    }
  });
});

describe('style benchmark exported models (Pass 062)', () => {
  const styles = ['natural', 'crafted'] as const;
  it.each(styles)('%s reef subjects are compressed PBR models', (style) => {
    const doc = glb(`style-${style}.glb`);
    expect(doc.extensionsUsed).toContain('KHR_draco_mesh_compression');
    expect(doc.extensionsUsed).toContain('KHR_texture_basisu');
    for (const name of [
      'Rock',
      'Coral_Brain',
      'Coral_Branching',
      'Seagrass_0',
      'Seagrass_1',
      'Seagrass_2',
    ])
      expect(triangles(doc, name)).toBeGreaterThan(100);
    for (const m of doc.materials) {
      expect(m.pbrMetallicRoughness?.baseColorTexture).toBeDefined();
      expect(m.pbrMetallicRoughness?.metallicRoughnessTexture).toBeDefined();
      expect(m.normalTexture).toBeDefined();
    }
  });

  it('budgets: B (crafted) stays at or under the shipped hero budgets, A spends more', () => {
    const a = glb('style-natural.glb'),
      b = glb('style-crafted.glb');
    // Shipped: Rock_0 20,480; Coral_Massive_0 81,920; Coral_Branching_0 + tips 48,002.
    expect(triangles(b, 'Rock')).toBeLessThanOrEqual(20480);
    expect(triangles(b, 'Coral_Brain')).toBeLessThanOrEqual(20480);
    expect(triangles(b, 'Coral_Branching')).toBeLessThan(48002);
    expect(triangles(a, 'Rock')).toBeGreaterThan(triangles(b, 'Rock'));
    expect(statSync(`${ASSETS}/style-crafted.glb`).size).toBeLessThan(
      statSync(`${ASSETS}/style-natural.glb`).size,
    );
  });

  it.each(styles.flatMap((s) => [`${s}-chromis.glb`, `${s}-clownfish.glb`]))(
    '%s keeps the accepted fish rig and stroke morphs',
    (file) => {
      const doc = glb(file);
      const names = doc.nodes.map((n) => n.name);
      for (const part of [
        'Body',
        'Median_Fins',
        'Eyes_Gills_Mouth',
        'Pectoral_Left',
        'Pectoral_Right',
      ])
        expect(names).toContain(part);
      expect(names.some((n) => n.endsWith('_Root'))).toBe(true);
      expect(triangles(doc, 'Body')).toBe(5196);
    },
  );
});
