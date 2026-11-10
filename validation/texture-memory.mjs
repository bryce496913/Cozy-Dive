/* Pass 018: measure resident texture memory for the loaded aquarium (benchmark entry, dev server).
 *
 *   COZY_URL=http://127.0.0.1:5173 node validation/texture-memory.mjs
 *
 * Walks every material in the scene graph (including shader uniforms) and sums texture bytes:
 * compressed textures by their transcoded mip data, plain images as RGBA8 with a 4/3 mip chain.
 * Reports the GPU format the KTX2 loader picked, so a software renderer that lacks compressed
 * formats (RGBA fallback) is visible rather than hidden.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const url = process.env.COZY_URL || 'http://127.0.0.1:5173';
const output = process.env.COZY_OUTPUT || '/tmp/cozy018-texture-memory';
fs.mkdirSync(output, { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.COZY_CHROMIUM || undefined,
  args: process.env.COZY_GPU_ARGS
    ? process.env.COZY_GPU_ARGS.split(' ')
    : [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--enable-unsafe-swiftshader',
        '--use-angle=swiftshader',
      ],
});
try {
  const page = await b.newPage({ viewport: { width: 1100, height: 750 } });
  page.setDefaultTimeout(Number(process.env.COZY_ACTION_TIMEOUT || 240000));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(url + '/benchmark.html');
  await page.waitForFunction(
    () => !!window.__visualBenchmark?.showcase,
    {},
    {
      timeout: 240000,
    },
  );
  await page.evaluate(() => window.__visualBenchmark.world.prepared);
  const report = await page.evaluate(() => {
    const { world } = window.__visualBenchmark;
    const gl = world.renderer.getContext();
    // Clones (e.g. repeat-wrapped sand maps) share a Source, which three.js uploads once.
    const seen = new Set();
    const rows = [];
    const visit = (t) => {
      if (!t || !t.isTexture || seen.has(t.source)) return;
      seen.add(t.source);
      const compressed = !!t.isCompressedTexture;
      let bytes = 0;
      let w = 0;
      let h = 0;
      if (compressed) {
        for (const m of t.mipmaps) bytes += m.data.byteLength;
        w = t.mipmaps[0]?.width ?? 0;
        h = t.mipmaps[0]?.height ?? 0;
      } else if (t.image) {
        w = t.image.width ?? 0;
        h = t.image.height ?? 0;
        const mips =
          t.generateMipmaps && t.minFilter !== 1006 && t.minFilter !== 1003;
        bytes = w * h * 4 * (mips ? 4 / 3 : 1);
      }
      rows.push({
        name: t.name,
        compressed,
        format: t.format,
        width: w,
        height: h,
        mipLevels: compressed ? t.mipmaps.length : null,
        bytes: Math.round(bytes),
      });
    };
    world.scene.traverse((o) => {
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of materials) {
        if (!m) continue;
        for (const v of Object.values(m)) visit(v);
        if (m.uniforms)
          for (const u of Object.values(m.uniforms)) visit(u?.value);
      }
    });
    const total = rows.reduce((s, r) => s + r.bytes, 0);
    return {
      extensions: {
        astc: !!gl.getExtension('WEBGL_compressed_texture_astc'),
        bptc: !!gl.getExtension('EXT_texture_compression_bptc'),
        s3tc: !!gl.getExtension('WEBGL_compressed_texture_s3tc'),
        etc: !!gl.getExtension('WEBGL_compressed_texture_etc'),
      },
      renderer: gl.getParameter(gl.RENDERER),
      textures: rows.length,
      compressedTextures: rows.filter((r) => r.compressed).length,
      formats: [...new Set(rows.map((r) => r.format))],
      totalBytes: total,
      totalMiB: +(total / 1048576).toFixed(2),
      rows,
    };
  });
  report.errors = errors;
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(output, 'texture-memory.json'),
    JSON.stringify(report, null, 2),
  );
  const { rows, ...summary } = report;
  console.log(JSON.stringify(summary, null, 2));
  console.log(
    `rows: ${rows.length} (full list in ${output}/texture-memory.json)`,
  );
} finally {
  await b.close();
}
