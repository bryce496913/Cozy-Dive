/* V0.7 Pass 066: render the fish gallery (validation/v07/gallery.html): side and three-quarter
 * views of every registered fish in the tank's water and light, from the shipped GLBs.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/v07-gallery node validation/v07/gallery.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const url = process.env.COZY_URL || 'http://127.0.0.1:5173';
const output = process.env.COZY_OUTPUT || '/tmp/v07-gallery';
// COZY_SET=creatures renders the large animals; their third view is mid-stroke.
const set = process.env.COZY_SET || 'fish';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1800, height: 900 },
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.setDefaultTimeout(300000);
  await page.goto(`${url}/validation/v07/gallery.html?set=${set}`);
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => window.ready);
  for (const [name, yaw, pitch] of [
    ['side', 0],
    ['three-quarter', 0.7],
    ...(set === 'creatures' ? [['top', 0.35, -1.0]] : []),
  ]) {
    const stats = await page.evaluate(
      ([y, p]) => window.view(y, p ?? 0),
      [yaw, pitch],
    );
    await page.screenshot({ path: path.join(output, `gallery-${name}.png`) });
    console.log(name, JSON.stringify(stats));
  }
  if (set === 'creatures') {
    await page.goto(`${url}/validation/v07/gallery.html?set=${set}&stroke=1`);
    await page.waitForFunction(() => window.ready);
    await page.evaluate(() => window.ready);
    const stats = await page.evaluate(() => window.view(1.2));
    await page.screenshot({ path: path.join(output, 'gallery-stroke.png') });
    console.log('stroke', JSON.stringify(stats));
  }
} finally {
  await browser.close();
  console.log(JSON.stringify({ ok: errors.length === 0, errors }));
}
