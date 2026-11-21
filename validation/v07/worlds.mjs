/* V0.7 Pass 061: isolated world views and the model inventory (dev server only).
 *
 * Builds the kelp forest, sea cave, waters under the ice and the shipwreck one at a time on
 * validation/v07/worlds.html (no passages or tour), renders fixed views on a fixed 1/15 s clock and
 * records renderer statistics and an image hash per view; then decodes (or builds) every registered
 * model and records its geometry, materials, textures and file size.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/v07-worlds node validation/v07/worlds.mjs
 * Env: COZY_PLAYWRIGHT, COZY_CHROMIUM, COZY_WORLDS (comma list, default all), COZY_INVENTORY=0 to skip.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/v07-worlds';
fs.mkdirSync(output, { recursive: true });
const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../..',
);

/** Fixed views per world: [name, distance class, eye, look-at] in each world's metres. */
export const WORLD_VIEWS = {
  kelp: [
    ['kelp-forest', 'swimming', [0, 6, -22], [0, 5, -36]],
    ['kelp-rocks-close', 'close', [-10, 2.5, -30], [-12, 0.8, -32.5]],
    ['kelp-canopy', 'medium', [4, 10, -35], [4, 18, -42]],
  ],
  cave: [
    ['cave-cavern', 'swimming', [0, 5, -14], [0, 3, -26]],
    ['cave-wall-close', 'close', [9, 3, -26], [13, 3.4, -28]],
    ['cave-sunbeam', 'medium', [-2, 4, -20], [3.5, 3, -27]],
    // V0.7 Pass 079: distant boulder silhouettes, and the floor under the sunbeam.
    ['cave-boulders-far', 'swimming', [10, 6, -14], [-12, 2, -30]],
    ['cave-sunbeam-floor', 'medium', [0.5, 5, -21.5], [3.5, 0, -27.5]],
  ],
  ice: [
    ['ice-open-water', 'swimming', [0, 6, -16], [0, 4, -30]],
    ['ice-seabed-close', 'close', [-5, 2.5, -30], [-6, 0.6, -33]],
    ['ice-underside', 'medium', [2, 8, -32], [2, 15, -37]],
    // V0.7 Pass 079: the seabed's composition at swimming distance.
    ['ice-seabed-wide', 'swimming', [3, 4, -20], [-5, 0.5, -33]],
  ],
  wreck: [
    ['wreck-overview', 'swimming', [14, 9, -14], [0, 5, -30]],
    ['wreck-deck', 'medium', [6, 12.5, -20], [0, 7, -30]],
    ['wreck-hull-close', 'close', [7.5, 4.8, -33], [3.5, 4.4, -33.4]],
    // V0.7 Pass 076: matched views of the bow, stern, broadside, cargo hold and bridge.
    ['wreck-bow', 'medium', [9, 5, -56], [0, 4, -46]],
    ['wreck-stern', 'medium', [8, 4, -7.5], [0, 3, -16]],
    ['wreck-broadside', 'swimming', [17, 4.2, -31], [0, 3.6, -31]],
    ['wreck-hold', 'close', [0.6, 3, -26.5], [0, 1.6, -38]],
    ['wreck-bridge', 'medium', [6, 11, -12.5], [0, 8.6, -19.5]],
  ],
};
const browser = await chromium.launch({
  executablePath: process.env.COZY_CHROMIUM || undefined,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const report = { views: [], inventory: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.setDefaultTimeout(900000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on(
    'console',
    (m) => m.type() === 'error' && report.errors.push(m.text()),
  );
  await page.goto(
    (process.env.COZY_URL || 'http://127.0.0.1:5173') +
      '/validation/v07/worlds.html',
  );
  await page.waitForFunction(() => window.ready);
  const worlds = (process.env.COZY_WORLDS || 'kelp,cave,ice,wreck').split(',');
  for (const world of worlds) {
    const begun = Date.now();
    await page.evaluate((w) => window.openWorld(w), world);
    const buildMs = Date.now() - begun;
    for (const [name, distance, eye, target] of WORLD_VIEWS[world]) {
      const info = await page.evaluate(
        ([e, t]) => window.view(e, t),
        [eye, target],
      );
      const png = await page.screenshot({
        path: path.join(output, `${name}.png`),
      });
      const hash = crypto
        .createHash('sha256')
        .update(png)
        .digest('hex')
        .slice(0, 16);
      report.views.push({
        world,
        name,
        distance,
        eye,
        target,
        buildMs,
        ...info,
        hash,
      });
      console.log(
        `${name}: ${info.calls} draws, ${(info.triangles / 1e6).toFixed(2)} M tris, ${hash}`,
      );
    }
  }
  if (process.env.COZY_INVENTORY !== '0') {
    const rows = await page.evaluate(() => window.inventory());
    const registry = fs.readFileSync(
      path.join(root, 'src/assets/AssetRegistry.ts'),
      'utf8',
    );
    for (const r of rows) {
      const m = registry.match(
        new RegExp(`\\b${r.id}: \\{\\s*path: '([^']+)'`),
      );
      const file = m ? path.join(root, 'public', m[1]) : null;
      r.path = m?.[1] ?? null;
      r.bytes = file && fs.existsSync(file) ? fs.statSync(file).size : null;
    }
    report.inventory = rows;
    console.log(
      `inventory: ${rows.length} models, ${rows.filter((r) => r.error).length} errors`,
    );
  }
  report.ok = report.errors.length === 0;
} finally {
  fs.writeFileSync(
    path.join(output, 'worlds.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      ok: report.ok ?? false,
      views: report.views.length,
      errors: report.errors.length,
    }),
  );
  await browser.close();
}
