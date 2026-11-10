/* v0.3 Pass 020: the office, with real input, on a dev server.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy020-office node validation/office.mjs
 *
 * 1. Start screen opens in the office; both world programs/textures are prepared.
 * 2. "Enter the Office" -> pointer lock -> held W and mouse look actually walk the player, who stays
 *    inside the room and outside furniture; the depth readout is hidden.
 * 3. Escape pauses (overlay offers "Return to the Office" and "Enter the Water"); entering the
 *    water switches to swimming; pausing and "Enter the Office" returns.
 * 4. Switching back and forth does not grow GPU geometry/texture counts (no leaks).
 * 5. Fixed-camera views of the room, desk, window, shelf and the live miniature tank, with draw
 *    calls, triangles and CPU submit time for the office frame (miniature included).
 * Software-rendered timings are diagnostics only, not hardware FPS.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy020-office';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.COZY_CHROMIUM || undefined,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const base = process.env.COZY_URL || 'http://127.0.0.1:5173';
const report = { base, errors: [], warnings: [] };
const settle = async (page) =>
  page.waitForFunction(
    () =>
      !!document.pointerLockElement &&
      window.__cozy.entered &&
      document.querySelector('#overlay').hidden,
  );
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 720 },
  });
  page.setDefaultTimeout(Number(process.env.COZY_ACTION_TIMEOUT || 240000));
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body: (await r.text()) + '\nwindow.__cozy=app;',
    });
  });
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
    if (m.type() === 'warning') report.warnings.push(m.text());
  });
  await page.goto(base);
  await page.waitForFunction(() => window.__cozy?.office);
  await page.evaluate(() =>
    Promise.all([window.__cozy.world.prepared, window.__cozy.office.prepared]),
  );
  report.startMode = await page.evaluate(() => window.__cozy.mode);
  assert.equal(report.startMode, 'office');
  await page.screenshot({ path: path.join(output, 'start.png') });

  // Walk the office with real input.
  await page
    .getByRole('button', { name: 'Enter the Office', exact: true })
    .click();
  await settle(page);
  await page.waitForTimeout(1000);
  report.depthHidden = await page.evaluate(
    () =>
      getComputedStyle(document.querySelector('#depth')).visibility ===
      'hidden',
  );
  assert.equal(report.depthHidden, true);
  const start = await page.evaluate(() => ({ ...window.__cozy.walk.position }));
  await page.keyboard.down('w');
  for (let i = 0; i < 16; i++) {
    await page.mouse.move(550 + (i % 2 ? 60 : -60), 360);
    await page.waitForTimeout(220);
  }
  await page.keyboard.up('w');
  const end = await page.evaluate(() => ({ ...window.__cozy.walk.position }));
  report.walked = +Math.hypot(end.x - start.x, end.z - start.z).toFixed(2);
  report.eyeHeight = end.y;
  assert(report.walked > 0.5, 'held W must walk the player');
  assert.equal(end.y, 1.6);
  assert(end.x > -2.7 && end.x < 2.7 && end.z > -2.2 && end.z < 2.2);
  await page.screenshot({ path: path.join(output, 'walking.png') });

  // Pause, enter the water, pause, return to the office.
  const memory = () =>
    page.evaluate(() => ({ ...window.__cozy.world.renderer.info.memory }));
  report.memoryBefore = await memory();
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: 'Return to the Office', exact: true })
    .waitFor();
  await page
    .getByRole('button', { name: 'Enter the Water', exact: true })
    .click();
  await settle(page);
  report.swimMode = await page.evaluate(() => window.__cozy.mode);
  assert.equal(report.swimMode, 'aquarium');
  await page.keyboard.down('w');
  await page.waitForTimeout(1500);
  await page.keyboard.up('w');
  await page.screenshot({ path: path.join(output, 'swimming.png') });
  for (let round = 0; round < 2; round++) {
    await page.keyboard.press('Escape');
    await page
      .getByRole('button', { name: 'Enter the Office', exact: true })
      .click();
    await settle(page);
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page
      .getByRole('button', { name: 'Enter the Water', exact: true })
      .click();
    await settle(page);
    await page.waitForTimeout(500);
  }
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: 'Enter the Office', exact: true })
    .click();
  await settle(page);
  await page.waitForTimeout(800);
  report.memoryAfter = await memory();
  assert.deepEqual(report.memoryAfter, report.memoryBefore);
  report.backInOffice = await page.evaluate(() => window.__cozy.mode);
  assert.equal(report.backInOffice, 'office');

  // Fixed views with frame diagnostics.
  await page.keyboard.press('Escape');
  await page.evaluate(() => cancelAnimationFrame(window.__cozy.frame));
  report.views = [];
  for (const [name, eye, at] of [
    ['room', [1.8, 1.6, 2.1], [-1.5, 1.0, -1.8]],
    ['tank', [0.9, 1.5, 0.2], [2.4, 0.95, 0]],
    ['tank-close', [1.75, 1.05, 0.05], [2.6, 0.92, -0.05]],
    ['desk-window', [-0.2, 1.55, -0.6], [-0.6, 0.95, -2.4]],
    ['shelf', [-1.2, 1.5, 0.9], [-2.8, 1.0, -0.3]],
  ]) {
    const info = await page.evaluate(
      async ([eye, at]) => {
        const THREE = await import('/node_modules/.vite/deps/three.js');
        const o = window.__cozy.office,
          r = window.__cozy.world.renderer;
        document.querySelector('#overlay').hidden = true;
        o.camera.position.set(...eye);
        o.camera.lookAt(new THREE.Vector3(...at));
        const times = [];
        for (let i = 0; i < 3; i++) {
          const t = performance.now();
          o.render(36900, false, 1 / 60);
          times.push(+(performance.now() - t).toFixed(1));
        }
        return {
          calls: r.info.render.calls,
          triangles: r.info.render.triangles,
          cpuSubmitMs: times,
        };
      },
      [eye, at],
    );
    report.views.push({ name, ...info });
    await page.screenshot({ path: path.join(output, `${name}.png`) });
  }
  report.webglErrors = await page.evaluate(() =>
    window.__cozy.world.renderer.getContext().getError(),
  );
  assert.equal(report.webglErrors, 0);
  assert.deepEqual(report.errors, []);
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 1));
