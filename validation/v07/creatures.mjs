/* V0.7 Pass 078: render the creature studio (validation/v07/creatures.html): for each animal,
 * side, three-quarter, close-up and animation-pose views, with in-game materials.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/v07-creatures node validation/v07/creatures.mjs
 * Env: COZY_PLAYWRIGHT, COZY_ANIMALS (comma list; default all).
 */
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const url = process.env.COZY_URL || 'http://127.0.0.1:5173';
const output = process.env.COZY_OUTPUT || '/tmp/v07-creatures';
const ANIMALS = (
  process.env.COZY_ANIMALS ||
  'seahorse,frogfish,moray,lobster,comb-jelly,salp,jellyfish,sea-squirts'
).split(',');
const VIEWS = ['side', 'three-quarter', 'close-up', 'pose'];
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const errors = [],
  report = {};
try {
  for (const animal of ANIMALS) {
    const page = await browser.newPage({
      viewport: { width: 900, height: 900 },
    });
    page.on('pageerror', (e) => errors.push(`${animal}: ${e.message}`));
    page.setDefaultTimeout(300000);
    await page.goto(`${url}/validation/v07/creatures.html?animal=${animal}`);
    await page.waitForFunction(() => window.ready);
    await page.evaluate(() => window.ready);
    for (const view of VIEWS) {
      const stats = await page.evaluate((v) => window.shot(v), view);
      await page.screenshot({
        path: path.join(output, `${animal}-${view}.png`),
      });
      (report[animal] ??= {})[view] = stats;
    }
    console.log(animal, JSON.stringify(report[animal].side));
    await page.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(
    path.join(output, 'creatures.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify({ ok: errors.length === 0, errors }));
}
