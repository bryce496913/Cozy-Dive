/* V0.8 Pass 084: render the large creature studio (validation/v08/creatures.html): for each animal,
 * side, three-quarter, head close-up, top and mid-stroke views, tiled into one image per animal.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/v08-creatures node validation/v08/creatures.mjs
 * Env: COZY_PLAYWRIGHT, COZY_ANIMALS (comma list of registry ids; default the large animals).
 */
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const url = process.env.COZY_URL || 'http://127.0.0.1:5173';
const output = process.env.COZY_OUTPUT || '/tmp/v08-creatures';
const ANIMALS = (
  process.env.COZY_ANIMALS ||
  'hammerhead,reefShark,whitetipShark,greatWhite,leopardShark,nurseShark,whaleShark,eagleRay,mantaRay,seaTurtle,sunfish,humpbackWhale,killerWhale,minkeWhale,harbourSeal,leopardSeal,weddellSeal,seaLion,polarBear,seaOtter'
).split(',');
// V0.8 Pass 090: COZY_VIEWS overrides (e.g. side,front,three-quarter,top,eye,flank,tail,stroke).
const VIEWS = process.env.COZY_VIEWS
  ? process.env.COZY_VIEWS.split(',')
  : ['side', 'three-quarter', 'head', 'top', 'stroke'];
// COZY_WATER=outer|kelp|ice renders in that world's water and light.
const water = process.env.COZY_WATER || 'tank';
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
      viewport: { width: 800, height: 520 },
    });
    page.on('pageerror', (e) => errors.push(`${animal}: ${e.message}`));
    page.setDefaultTimeout(300000);
    await page.goto(
      `${url}/validation/v08/creatures.html?animal=${animal}&water=${water}`,
    );
    await page.waitForFunction(() => window.ready);
    try {
      await page.evaluate(() => window.ready);
    } catch (e) {
      errors.push(`${animal}: ${e.message}`);
      await page.close();
      continue;
    }
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
