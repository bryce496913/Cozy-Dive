/* Explicit benchmark production-build check; normal production is checked by production.mjs. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy012-production-benchmark';
fs.mkdirSync(output, { recursive: true });
const b = await chromium.launch({
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
const openPage = b.newPage.bind(b);
b.newPage = async (options) => {
  const page = await openPage(options);
  page.setDefaultTimeout(Number(process.env.COZY_ACTION_TIMEOUT || 240000));
  return page;
};
try {
  const p = await b.newPage({ viewport: { width: 1100, height: 750 } }),
    errors = [],
    warnings = [],
    models = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning') warnings.push(m.text());
  });
  p.on('request', (r) => {
    if (r.url().endsWith('.glb')) models.push(r.url());
  });
  await p.goto(
    (process.env.COZY_URL || 'http://127.0.0.1:5177') + '/benchmark.html',
  );
  await p.waitForFunction(
    () => !!window.__visualBenchmark?.showcase,
    {},
    { timeout: 60000 },
  );
  assert.equal(
    await p.evaluate(() => window.__visualBenchmark.world.authored.ready),
    true,
  );
  assert.equal(models.length, 12); // 10 normal-scene libraries + showcase chromis and Acropora
  assert.equal(await p.locator('#compare').isEnabled(), true);
  await p.getByRole('button', { name: 'Enter the Water' }).click();
  await p.waitForFunction(
    () =>
      !!document.pointerLockElement &&
      document.querySelector('#overlay').hidden &&
      window.__visualBenchmark.app.entered,
  );
  const start = await p.evaluate(
    () => window.__visualBenchmark.app.state.position.z,
  );
  await p.keyboard.down('w');
  await p.waitForFunction(
    (z) => Math.abs(window.__visualBenchmark.app.state.position.z - z) > 0.2,
    start,
    { timeout: 60000 },
  );
  await p.keyboard.up('w');
  await p.evaluate(() => (document.querySelector('aside').hidden = true));
  await p.screenshot({ path: path.join(output, 'benchmark-production.png') });
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.pointerLockElement);
  await p.evaluate(() => (document.querySelector('aside').hidden = false));
  await p.locator('#compare').click();
  assert.match(await p.locator('#compare').textContent(), /View benchmark/);
  await p.locator('#compare').click();
  assert.match(await p.locator('#compare').textContent(), /View original/);
  const resources = await p.evaluate(() => {
    const { world, app, dispose } = window.__visualBenchmark,
      ctx = app.audio.context,
      fish = world.aquarium.fish.simulation.fish.length,
      originalClownVisible = world.aquarium.fish.batches
        .filter((b) => b.visuals[0].root.name.startsWith('Ocellaris'))
        .map((b) => b.root.visible);
    dispose();
    return {
      fish,
      originalClownVisible,
      after: { ...world.renderer.info.memory },
      audio: ctx.state,
    };
  });
  assert.equal(resources.fish, 40);
  assert.deepEqual(resources.originalClownVisible, [false]);
  assert.equal(resources.after.geometries, 0);
  assert.equal(resources.after.textures, 0);
  assert.equal(resources.audio, 'closed');
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  const report = {
    result: 'PASS',
    models,
    resources,
    errors,
    warnings,
    checks: [
      'bundled production GLB and embedded PBR images decode',
      'one request per model',
      'real Enter/W swimming/Escape',
      'comparison toggles without reloading',
      '40 fish preserved',
      'graphics/audio/cache cleanup',
    ],
    limitations: [
      'Explicit benchmark build only; software renderer, no hardware FPS or subjective art acceptance.',
    ],
  };
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await b.close();
}
