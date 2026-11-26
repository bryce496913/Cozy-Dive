// PLAYWRIGHT_MODULE may point at an existing external installation; no production dependency.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href
    : 'playwright'
);
const output = process.env.OUTPUT_DIR ?? 'docs/low-poly/pass016-evidence';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const started = Date.now();
  await page.goto(
    `${process.env.BASE_URL ?? 'http://localhost:5180'}/validation/low-poly/`,
  );
  await page.waitForFunction(
    () => window.lowPolyInspection?.snapshot().drawCalls === 5,
  );
  const loadMs = Date.now() - started;
  const snapshot = () =>
    page.evaluate(() => window.lowPolyInspection.snapshot());
  const initial = await snapshot();
  assert.equal(initial.cache.geometries, 5);
  assert.equal(initial.geometries, 5);
  await page.getByRole('button', { name: 'Pause motion', exact: true }).click();
  const paused = await snapshot();
  await page.waitForTimeout(100);
  assert.equal((await snapshot()).time, paused.time);
  for (const view of ['side', 'front', 'top', 'three-quarter']) {
    await page.getByLabel('View').selectOption(view);
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${output}/${view}.png`, fullPage: true });
  }
  await page
    .getByRole('button', { name: 'Resume motion', exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => window.lowPolyInspection.snapshot().reduced);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const cycles = [];
  for (let i = 0; i < 5; i++) {
    await page
      .getByRole('button', { name: 'Release models', exact: true })
      .click();
    await page.waitForFunction(
      () => window.lowPolyInspection.snapshot().drawCalls === 0,
    );
    const released = await snapshot();
    assert.equal(released.geometries, 0);
    assert.equal(released.cache.materials, 0);
    assert.equal(released.cache.geometries, 0);
    // Three r187 retains its shared 16x16 DFG lighting LUT until renderer disposal.
    // All three model-owned morph textures must be gone, without growth on later cycles.
    assert.equal(released.textures, initial.textures - 3);
    assert.equal(released.textures, 1);
    cycles.push(released);
    await page
      .getByRole('button', { name: 'Restore models', exact: true })
      .click();
    await page.waitForFunction(
      () => window.lowPolyInspection.snapshot().drawCalls === 5,
    );
    assert.equal((await snapshot()).geometries, 5);
  }
  // A short software-renderer timing sample, not a laptop/GPU performance claim.
  const timing = await page.evaluate(async () => {
    const values = [];
    let previous = performance.now();
    for (let i = 0; i < 60; i++)
      await new Promise((resolve) =>
        requestAnimationFrame((now) => {
          values.push(now - previous);
          previous = now;
          resolve();
        }),
      );
    values.sort((a, b) => a - b);
    return {
      frames: 60,
      medianMs: values[30],
      p95Ms: values[57],
      maxMs: values[59],
    };
  });
  const final = await snapshot();
  await page.evaluate(() => window.lowPolyInspection.dispose());
  const disposed = await snapshot();
  assert.equal(disposed.geometries, 0);
  assert.equal(disposed.textures, 0);
  assert.deepEqual(errors, []);
  const result = {
    renderer: 'Chromium / SwiftShader (software); not real GPU or MacBook Air',
    loadMs,
    initial,
    cycles,
    final,
    timing,
    disposed,
    errors,
  };
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
