/* Pass 021 development-only inspection gallery for every shared rare-miniature model.
 * This reads the existing validation page and never touches discovery or save state.
 *
 * COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/pass021 \
 * COZY_CHROMIUM=/path/to/chromium node validation/v08/rare-creatures.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const playwrightModule = await import(
  process.env.COZY_PLAYWRIGHT || 'playwright'
);
const { chromium } = playwrightModule.chromium
  ? playwrightModule
  : playwrightModule.default;
const url = process.env.COZY_URL || 'http://127.0.0.1:5173';
const output = process.env.COZY_OUTPUT || '/tmp/pass021-rare-creatures';
const ids = [
  'pikachu-nudibranch',
  'leaf-sheep',
  'candy-crab',
  'harlequin-shrimp',
  'ornate-ghost-pipefish',
  'hairy-frogfish',
  'mimic-octopus',
  'spanish-shawl',
  'weedy-seadragon',
  'sarcastic-fringehead',
  'east-pacific-red-octopus',
  'skeleton-shrimp',
  'juvenile-wolf-eel',
  'decorator-crab',
  'painted-greenling',
  'stargazer',
  'psychedelic-frogfish',
  'banded-coral-shrimp',
  'wonderpus',
  'sea-angel',
  'tritoniella-belli',
  'giant-isopod',
];

fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.COZY_CHROMIUM,
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const report = {};
const errors = [];
try {
  for (const id of ids) {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 420 },
    });
    page.setDefaultTimeout(240000);
    page.on('pageerror', (error) => errors.push(`${id}: ${error.message}`));
    await page.goto(`${url}/validation/v08/miniatures.html?id=${id}`);
    await page.evaluate(() => window.ready);
    await page.evaluate(() => window.shot());
    report[id] = await page.evaluate(() => window.sizes);
    await page.screenshot({ path: path.join(output, `${id}.png`) });
    await page.close();
  }
} finally {
  fs.writeFileSync(
    path.join(output, 'rare-creatures.json'),
    JSON.stringify({ report, errors }, null, 2),
  );
  await browser.close();
}
console.log(
  JSON.stringify({ ok: errors.length === 0, creatures: ids.length, errors }),
);
if (errors.length) process.exitCode = 1;
