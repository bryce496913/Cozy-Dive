import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.COZY_PLAYWRIGHT ||
    '/tmp/cozy-browser/node_modules/playwright/index.mjs'
);
const out = process.env.COZY_OUTPUT || 'docs/low-poly/pass017-evidence';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1400 },
    }),
    errors = [],
    requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('request', (r) => {
    if (r.url().includes('.glb')) requests.push(r.url());
  });
  const start = Date.now();
  await page.goto('http://localhost:5181/validation/core-fish/');
  await page.waitForFunction(
    () => window.fishInspection?.snapshot().models === 31,
  );
  const snapshot = () => page.evaluate(() => window.fishInspection.snapshot());
  const loadMs = Date.now() - start;
  await page.locator('#pause').click();
  const paused = await snapshot();
  await page.waitForTimeout(120);
  assert.equal((await snapshot()).time, paused.time);
  for (const view of ['side', 'front', 'top', 'three-quarter']) {
    await page.locator('#view').selectOption(view);
    await page.waitForTimeout(100);
    await page.locator('#stage').screenshot({ path: `${out}/${view}.png` });
  }
  await page.locator('#pause').click();
  const speeds = [];
  for (const value of ['.35', '1', '1.8']) {
    await page.locator('#speed').selectOption(value);
    await page.waitForTimeout(300);
    speeds.push(await snapshot());
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => window.fishInspection.snapshot().reduced);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const cycles = [];
  for (let i = 0; i < 3; i++) {
    await page.locator('#release').click();
    await page.waitForFunction(
      () => window.fishInspection.snapshot().geometries === 0,
    );
    cycles.push(await snapshot());
    assert.equal(cycles[i].textures, 1);
    await page.locator('#restore').click();
    await page.waitForFunction(
      () =>
        window.fishInspection.snapshot().models === 31 &&
        window.fishInspection.snapshot().drawCalls > 0,
    );
  }
  const timing = await page.evaluate(async () => {
    const values = [];
    let last = performance.now();
    for (let i = 0; i < 40; i++)
      await new Promise((resolve) =>
        requestAnimationFrame((now) => {
          values.push(now - last);
          last = now;
          resolve();
        }),
      );
    values.sort((a, b) => a - b);
    return { medianMs: values[20], p95Ms: values[38], maxMs: values[39] };
  });
  const final = await snapshot();
  await page.evaluate(() => window.fishInspection.dispose());
  const disposed = await snapshot();
  assert.equal(disposed.textures, 0);
  assert.equal(disposed.geometries, 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  const report = {
    renderer: 'Chromium SwiftShader software; not real GPU',
    loadMs,
    speeds,
    cycles,
    timing,
    final,
    disposed,
    errors,
    requests,
  };
  await writeFile(
    `${out}/results.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      loadMs,
      timing,
      triangles: final.triangles,
      drawCalls: final.drawCalls,
      errors,
    }),
  );
} finally {
  await browser.close();
}
