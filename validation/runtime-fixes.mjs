/* Pause the office miniature and suspend its real AudioContext, then ensure E cannot surface
 * from outer waters. Positions are staged; pointer lock, Escape/E and rendering are real.
 * COZY_URL=http://127.0.0.1:5173 node validation/runtime-fixes.mjs
 */
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.COZY_CHROMIUM || undefined,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const report = { errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 480, height: 320 } });
  page.setDefaultTimeout(240000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  await page.route('**/src/main.ts*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()) + '\nwindow.__cozy=app;',
    });
  });
  const load = async () => {
    await page.goto(process.env.COZY_URL || 'http://127.0.0.1:5173');
    await page.waitForFunction(() => window.__cozy?.office);
    await page.evaluate(() => cancelAnimationFrame(window.__cozy.frame));
    await page.evaluate(() =>
      Promise.all([
        window.__cozy.world.prepared,
        window.__cozy.office.prepared,
      ]),
    );
  };
  const step = (count = 1) =>
    page.evaluate(async (count) => {
      const a = window.__cozy;
      cancelAnimationFrame(a.frame);
      for (let i = 0; i < count; i++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        cancelAnimationFrame(a.frame);
        a.__t = (a.__t ?? performance.now()) + 100;
        a.tick(a.__t);
        cancelAnimationFrame(a.frame);
      }
    }, count);
  const clocks = () =>
    page.evaluate(() => {
      const a = window.__cozy,
        q = a.world.aquarium;
      return {
        elapsed: a.elapsed,
        office: a.officeTime,
        fish: q.fish.simulation.steps,
        plants: q.plants.clock.time,
        anemone: q.anchoredLife.anemone.clock.time,
        moray: q.anchoredLife.moray.clock.time,
        discoveries: q.anchoredLife.hidden.clock.time,
      };
    });
  const enter = async (name) => {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForFunction(() => !!document.pointerLockElement);
    // Lock changes reset the frame timestamp; the first resumed frame has zero delta.
    await step(2);
  };
  const audioState = () =>
    page.evaluate(() => window.__cozy.officeAudio.context?.state);
  await load();
  console.log('Office ready');
  await enter('Enter the Office');
  assert.equal(await audioState(), 'running');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.pointerLockElement);
  const before = await clocks();
  await step(5);
  assert.deepEqual(await clocks(), before);
  await page.waitForFunction(
    () => window.__cozy.officeAudio.context.state === 'suspended',
  );
  report.officePause = { clocks: before, audio: await audioState() };
  await enter('Return to the Office');
  assert.equal(await audioState(), 'running');
  const resumed = await clocks();
  assert(resumed.fish > before.fish);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(
    () => window.__cozy.officeAudio.context.state === 'suspended',
  );
  const hidden = await clocks();
  await step(3);
  assert.deepEqual(await clocks(), hidden);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => !document.pointerLockElement);
  assert.equal(await audioState(), 'suspended');
  await enter('Return to the Office');
  assert.equal(await audioState(), 'running');
  report.hiddenOfficeAudio =
    'suspended; visible paused office stays silent; explicit entry resumes';
  await page.evaluate(() => window.__cozy.dispose());

  // Fresh first entry avoids a transition unrelated to the outer-water action guard.
  await load();
  console.log('Office pause/audio passed; water ready');
  await enter('Enter the Water');
  await page.evaluate(() => {
    const a = window.__cozy;
    Object.assign(a.state.position, { x: 6.4, y: 1.6, z: -12.1 });
    a.state.neutralDepth = 1.6;
  });
  await step();
  await page.evaluate(() => window.__cozy.outer.prepared);
  await page.evaluate(() => {
    const a = window.__cozy;
    a.setWaterWorld('outer');
    Object.assign(a.state.position, { x: 0, y: 14, z: -65 });
    a.state.neutralDepth = 14;
    a.controls.clear();
  });
  await step();
  await page.keyboard.press('e');
  await step();
  report.outerAction = await page.evaluate(() => ({
    world: window.__cozy.waterWorld,
    mode: window.__cozy.mode,
    transition: !!window.__cozy.dive,
    promptHidden: document.querySelector('#dive-prompt').hidden,
  }));
  assert.deepEqual(report.outerAction, {
    world: 'outer',
    mode: 'aquarium',
    transition: false,
    promptHidden: true,
  });
  assert.deepEqual(report.errors, []);
  await page.evaluate(() => window.__cozy.dispose());
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
