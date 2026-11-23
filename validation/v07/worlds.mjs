/* V0.7 Pass 061: isolated world views and the model inventory (dev server only).
 *
 * Builds the kelp forest, sea cave, waters under the ice and the shipwreck one at a time on
 * validation/v07/worlds.html (no passages or tour), renders fixed views on a fixed 1/15 s clock and
 * records renderer statistics and an image hash per view; then decodes (or builds) every registered
 * model and records its geometry, materials, textures and file size.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/v07-worlds node validation/v07/worlds.mjs
 * Env: COZY_PLAYWRIGHT, COZY_CHROMIUM, COZY_WORLDS (comma list, default all), COZY_INVENTORY=0 to skip,
 * COZY_VIEWS (comma list of view names; default all).
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
    // V0.8 Pass 085: blades and stalks close up, their holdfasts on the rock, the forest wide.
    ['kelp-blades-close', 'close', [2, 7, -30], [4, 8, -33]],
    ['kelp-holdfast-close', 'close', [-3, 1.8, -28], [-4.5, 0.4, -31]],
    ['kelp-forest-wide', 'swimming', [10, 4, -18], [-6, 6, -40]],
    // V0.8 Pass 095: looking back north at the wall the arrival tunnel opens through.
    ['kelp-north-wall', 'medium', [8, 5, -15], [5, 5, -8]],
  ],
  cave: [
    ['cave-cavern', 'swimming', [0, 5, -14], [0, 3, -26]],
    ['cave-wall-close', 'close', [9, 3, -26], [13, 3.4, -28]],
    ['cave-sunbeam', 'medium', [-2, 4, -20], [3.5, 3, -27]],
    // V0.7 Pass 079: distant boulder silhouettes, and the floor under the sunbeam.
    ['cave-boulders-far', 'swimming', [10, 6, -14], [-12, 2, -30]],
    ['cave-sunbeam-floor', 'medium', [0.5, 5, -21.5], [3.5, 0, -27.5]],
    ['cave-back-tunnel', 'medium', [-3, 3.4, -29], [-3, 3.2, -42]],
    ['cave-back-tunnel-inside', 'close', [-3, 3.2, -37.5], [-3, 3.1, -44]],
    ['cave-pillar', 'swimming', [-4, 5, -17], [-15, 5, -24]],
    // V0.8 Pass 089: from mid-cavern back toward the entrance tunnel (the way home).
    ['cave-return-tunnel', 'swimming', [0, 4, -22], [0, 3, -9]],
    // V0.8 Pass 095: the lionfish on its boulder, from the side and head-on.
    ['cave-lionfish-side', 'close', [7.13, 1.65, -34.15], [6.5, 1.55, -33.5]],
    ['cave-lionfish-front', 'close', [7.15, 1.62, -32.87], [6.5, 1.55, -33.5]],
  ],
  ice: [
    ['ice-open-water', 'swimming', [0, 6, -16], [0, 4, -30]],
    ['ice-seabed-close', 'close', [-5, 2.5, -30], [-6, 0.6, -33]],
    ['ice-underside', 'medium', [2, 8, -32], [2, 15, -37]],
    // V0.7 Pass 079: the seabed's composition at swimming distance.
    ['ice-seabed-wide', 'swimming', [3, 4, -20], [-5, 0.5, -33]],
    ['ice-tunnel-mouth', 'medium', [1, 4.5, -15], [0, 4, -7]],
    ['ice-tunnel-inside', 'close', [0, 4, 0.8], [0, 3.9, -8]],
    ['ice-tunnel-looking-back', 'close', [0, 4, -6], [0, 4.1, 1.5]],
    ['ice-far-end', 'swimming', [0, 7, -24], [0, 5, -50]],
    // V0.8 Pass 091: from mid-field back toward the tunnel home.
    ['ice-return-tunnel', 'swimming', [0, 5, -24], [0, 4, -8]],
    // V0.8 Pass 093: up into the largest breathing hole (its rim and chimney), and the platelet
    // ice and dropstones beside it.
    ['ice-breathing-hole', 'medium', [-1.5, 9.5, -22.5], [-6, 15, -28]],
    ['ice-dropstones-close', 'close', [6.5, 2.6, -26.5], [6.5, 0.8, -32]],
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
    // V0.8 Pass 089: from beside the deckhouse up toward the shaft in the roof (the way home).
    ['wreck-return-shaft', 'medium', [8, 10, -16], [0, 22, -26.5]],
    // V0.8 Pass 095: under the counter, from astern and from the quarter (the playtest found a hole
    // there, and the screw and a fish caught in the rudder).
    ['wreck-stern-close', 'close', [0.4, 2.2, -10.5], [0, 2, -16]],
    ['wreck-stern-quarter', 'close', [3.2, 1.6, -12], [0, 2, -15.6]],
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
const report = { views: [], inventory: [], materials: {}, errors: [] };
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
    // V0.8 Pass 087: COZY_VIEWS=<name,...> captures only the named views.
    const only = process.env.COZY_VIEWS?.split(',');
    for (const [name, distance, eye, target] of WORLD_VIEWS[world]) {
      if (only && !only.includes(name)) continue;
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
    // V0.7 Pass 080: the world's materials, for the cross-world consistency audit.
    report.materials[world] = await page.evaluate(() => window.materials());
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
