import { browserScale, recordBrowserScale } from './browser-scale.mjs';
/* Production-build smoke check. Uses public DOM/input only; no source injection. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy011-production';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.COZY_CHROMIUM || undefined,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
// Pass 014: SwiftShader compiles the heavier reef's shader variants lazily on first
// present (tens of seconds in software). Raise Playwright *action* timeouts only;
// no assertion or measured budget changes. Override with COZY_ACTION_TIMEOUT.
const openPage = browser.newPage.bind(browser);
browser.newPage = async (options) => {
  const page = await openPage({ ...browserScale(), ...options });
  page.setDefaultTimeout(Number(process.env.COZY_ACTION_TIMEOUT || 240000));
  return page;
};
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } }),
    errors = [],
    warnings = [],
    modelResponses = new Map();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning') warnings.push(m.text());
  });
  page.on('response', (r) => {
    if (r.url().includes('.glb')) modelResponses.set(r.url(), r.status());
  });
  await page.goto(process.env.COZY_URL || 'http://127.0.0.1:5175');
  await recordBrowserScale(page);
  await page.waitForFunction(() => !!document.querySelector('canvas'));
  await page.screenshot({ path: path.join(output, 'preview.png') });
  await page.waitForFunction(
    () =>
      !Array.from(document.querySelectorAll('[role=status]')).some((n) =>
        n.textContent.includes('Preparing aquarium'),
      ),
  );
  // Pass 013 libraries + Pass 014 reef + Pass 015 nudibranchs + Pass 016 fish (chromis and four species)
  assert.equal(modelResponses.size, 10);
  assert.deepEqual([...modelResponses.values()], Array(10).fill(200));
  assert.equal(
    await page
      .getByText('Some aquarium details could not load.', { exact: false })
      .count(),
    0,
  );
  assert.equal(await page.evaluate(() => !!document.pointerLockElement), false);
  await page.getByRole('button', { name: 'Enter the Water' }).click();
  await page.waitForFunction(
    () =>
      !!document.pointerLockElement &&
      document.querySelector('#overlay').hidden,
  );
  const depth = await page.locator('#depth').textContent();
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent('mousemove', { movementY: -500 })),
  );
  await page.keyboard.down('w');
  await page.waitForFunction(
    (before) =>
      Number(document.querySelector('#depth').textContent.match(/[\d.]+/)[0]) <
      Number(before.match(/[\d.]+/)[0]) - 0.2,
    depth,
    { timeout: 60000 },
  );
  await page.keyboard.up('w');
  const swimmingDepth = await page.locator('#depth').textContent();
  await page.screenshot({ path: path.join(output, 'swimming.png') });
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () =>
      !document.pointerLockElement &&
      !document.querySelector('#overlay').hidden,
  );
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('#master-volume').fill('41');
  await page.locator('#master-volume').dispatchEvent('input');
  await page.screenshot({ path: path.join(output, 'settings.png') });
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  assert.equal(await page.locator('#master-volume').inputValue(), '41');
  const assets = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .filter((s) => s.includes('/assets/')),
  );
  assert(
    assets.some((s) => /\.js$/.test(s)),
    'Built JS asset must load',
  );
  assert.deepEqual(errors, []);
  const report = {
    result: 'PASS',
    assets,
    depth,
    swimmingDepth,
    errors,
    warnings,
    checks: [
      'built assets load',
      'preview does not capture mouse',
      'Enter and pointer lock',
      'camera-directed W ascent changes public depth readout',
      'Escape pauses',
      'volume persists after reload',
    ],
    limitations: [
      'Software-rendered Chromium; functional smoke check, not hardware performance or subjective audio acceptance.',
    ],
  };
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
