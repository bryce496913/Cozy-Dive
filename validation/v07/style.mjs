/* V0.7 Pass 062: capture the style benchmark (style-benchmark.html) for every combination.
 *
 * Renders the full matrix of model treatment x lighting treatment (baseline, natural = A,
 * crafted = B) at the four fixed views, each at the same simulation time, so lighting changes can
 * be judged apart from geometry/material changes. Records draw calls, triangles, textures,
 * programs and per-subject triangle / material / texture costs, then composes side-by-side sheets.
 *
 *   npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/v07-style node validation/v07/style.mjs
 *
 * Env: COZY_PLAYWRIGHT, COZY_CHROMIUM, COZY_SIZE (default 960x600), COZY_TIME (default 1.2 s),
 * COZY_SHEETS (output dir for the composed sheets, default <output>/sheets).
 * Writes <output>/<assets>-<lighting>-<view>.png, <output>/style.json and the sheets.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');

const url = process.env.COZY_URL || 'http://127.0.0.1:5173';
const output = process.env.COZY_OUTPUT || '/tmp/v07-style';
const sheets = process.env.COZY_SHEETS || path.join(output, 'sheets');
const [width, height] = (process.env.COZY_SIZE || '960x600')
  .split('x')
  .map(Number);
const time = Number(process.env.COZY_TIME || 1.2);
const TREATMENTS = ['baseline', 'natural', 'crafted'];
const LABEL = {
  baseline: 'Baseline (shipped)',
  natural: 'A · Natural Realism',
  crafted: 'B · Crafted Stylized Realism',
};
const VIEWS = ['swimming', 'medium', 'close-brain', 'close-staghorn'];
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(sheets, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.COZY_CHROMIUM || undefined,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const report = { url, size: [width, height], time, captures: [], errors: [] };
try {
  for (const assets of TREATMENTS)
    for (const lighting of TREATMENTS) {
      const page = await browser.newPage({
        viewport: { width, height },
        deviceScaleFactor: 1,
      });
      page.setDefaultTimeout(300000);
      page.on('pageerror', (e) =>
        report.errors.push(`${assets}/${lighting}: ${e.message}`),
      );
      page.on('console', (m) => {
        if (m.type() === 'error')
          report.errors.push(`${assets}/${lighting}: ${m.text()}`);
      });
      const started = Date.now();
      await page.goto(
        `${url}/style-benchmark.html?assets=${assets}&lighting=${lighting}&ui=0`,
      );
      await page.waitForFunction(() => window.__styleBench);
      await page.evaluate(() => window.__styleBench.ready);
      const loadMs = Date.now() - started;
      for (const view of VIEWS) {
        const stats = await page.evaluate(
          ([view, time]) => {
            const b = window.__styleBench;
            b.view(view);
            b.render(time);
            b.render(time);
            return b.stats();
          },
          [view, time],
        );
        const file = path.join(output, `${assets}-${lighting}-${view}.png`);
        const png = await page.screenshot({ path: file });
        const hash = crypto
          .createHash('sha256')
          .update(png)
          .digest('hex')
          .slice(0, 16);
        report.captures.push({
          assets,
          lighting,
          view,
          loadMs,
          ...stats,
          image: path.basename(file),
          hash,
        });
        console.log(
          `${assets}/${lighting}/${view}: ${stats.calls} draws, ${(stats.triangles / 1e6).toFixed(2)} M tris`,
        );
      }
      await page.close();
    }
} finally {
  await browser.close();
}

/** A labelled grid: rows x cols of capture files. */
async function grid(name, rows, cols, file, title) {
  const w = 480,
    h = 300,
    head = 36,
    side = 190;
  const parts = [];
  const text = (s, x, y, size = 15, weight = 600) =>
    `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${size}" font-weight="${weight}" fill="#e8f1ee">${s}</text>`;
  let svg = `<svg width="${side + w * cols.length}" height="${head + 26 + h * rows.length}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#16252b"/>${text(title, 12, 24, 17, 700)}`;
  cols.forEach(
    (c, i) => (svg += text(c.label, side + i * w + 10, head + 18, 13, 600)),
  );
  rows.forEach(
    (r, j) => (svg += text(r.label, 10, head + 26 + j * h + 24, 13, 600)),
  );
  svg += '</svg>';
  for (const [j, r] of rows.entries())
    for (const [i, c] of cols.entries())
      parts.push({
        input: await sharp(path.join(output, file(r, c)))
          .resize(w, h)
          .toBuffer(),
        left: side + i * w,
        top: head + 26 + j * h,
      });
  await sharp(Buffer.from(svg))
    .composite(parts)
    .jpeg({ quality: 86 })
    .toFile(path.join(sheets, name));
}

// Side by side: the three complete treatments at every view (rows = views).
await grid(
  'side-by-side.jpg',
  VIEWS.map((v) => ({ id: v, label: v })),
  TREATMENTS.map((t) => ({ id: t, label: LABEL[t] })),
  (r, c) => `${c.id}-${c.id}-${r.id}.png`,
  'Pass 062 style benchmark: complete treatments (models + lighting)',
);
// Separation matrix per view: rows = models, columns = lighting.
for (const view of VIEWS)
  await grid(
    `matrix-${view}.jpg`,
    TREATMENTS.map((t) => ({ id: t, label: `Models: ${LABEL[t]}` })),
    TREATMENTS.map((t) => ({ id: t, label: `Lighting: ${LABEL[t]}` })),
    (r, c) => `${r.id}-${c.id}-${view}.png`,
    `Pass 062 · ${view}: models (rows) x lighting (columns)`,
  );
fs.writeFileSync(
  path.join(output, 'style.json'),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    ok: report.errors.length === 0,
    captures: report.captures.length,
    errors: report.errors,
  }),
);
if (report.errors.length) process.exitCode = 1;
