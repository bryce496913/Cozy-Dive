/* V0.8 Pass 096: the miniature comparison gallery (wild, tank before, tank after, preview).
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/v08-miniatures node validation/v08/miniatures.mjs
 * Env: COZY_PLAYWRIGHT, COZY_IDS (comma list of tank creature ids). Writes <output>/<id>.png and
 * miniatures.json (each view's model bounds).
 */
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const url = process.env.COZY_URL || 'http://127.0.0.1:5173';
const output = process.env.COZY_OUTPUT || '/tmp/v08-miniatures';
const ids = (
  process.env.COZY_IDS ||
  'blacktip-reef-shark,spotted-eagle-ray,green-sea-turtle,manta-ray,humpback-whale,polar-bear,emperor-penguin,sea-otter,octopus,giant-sea-spider,ribbon-worm'
).split(',');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const report = {},
  errors = [];
try {
  for (const id of ids) {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 420 },
    });
    page.setDefaultTimeout(240000);
    page.on('pageerror', (e) => errors.push(`${id}: ${e.message}`));
    await page.goto(`${url}/validation/v08/miniatures.html?id=${id}`);
    await page.evaluate(() => window.ready);
    await page.evaluate(() => window.shot());
    report[id] = await page.evaluate(() => window.sizes);
    await page.screenshot({ path: path.join(output, `${id}.png`) });
    console.log(
      id,
      JSON.stringify(report[id].map((s) => s.map((v) => +v.toFixed(2)))),
    );
    await page.close();
  }
} finally {
  fs.writeFileSync(
    path.join(output, 'miniatures.json'),
    JSON.stringify({ report, errors }, null, 1),
  );
  await browser.close();
}
console.log(JSON.stringify({ ok: errors.length === 0, errors }));
