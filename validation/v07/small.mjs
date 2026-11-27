/* V0.7 Pass 068 (small life): render the close-up small-life gallery (validation/v07/small.html)
 * from two fixed angles.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/v07-small node validation/v07/small.mjs
 * Env: COZY_PLAYWRIGHT, COZY_ONLY (label filter).
 */
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const url = process.env.COZY_URL || 'http://127.0.0.1:5173';
const output = process.env.COZY_OUTPUT || '/tmp/v07-small';
const params = new URLSearchParams();
if (process.env.COZY_ONLY) params.set('only', process.env.COZY_ONLY);
// COZY_SET=coral renders the corals and reef growth (Pass 069).
if (process.env.COZY_SET) params.set('set', process.env.COZY_SET);
const only = params.size ? `?${params}` : '';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.COZY_CHROMIUM,
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1800, height: 1000 },
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.setDefaultTimeout(300000);
  await page.goto(`${url}/validation/v07/small.html${only}`);
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => window.ready);
  console.log(JSON.stringify(await page.evaluate(() => window.labels)));
  for (const [name, yaw, pitch] of [
    ['three-quarter', 0.6, 0.45],
    ['side', 0, 0.1],
  ]) {
    const stats = await page.evaluate(
      ([y, p]) => window.view(y, p),
      [yaw, pitch],
    );
    await page.screenshot({ path: path.join(output, `small-${name}.png`) });
    console.log(name, JSON.stringify(stats));
  }
} finally {
  await browser.close();
  console.log(JSON.stringify({ ok: errors.length === 0, errors }));
}
