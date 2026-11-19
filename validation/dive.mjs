import { browserScale, recordBrowserScale } from './browser-scale.mjs';
/* v0.3 Pass 021: the dive from the office into the tank and back, with real input.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy021-dive node validation/dive.mjs
 *
 * Enter the Office (pointer lock); stand in front of the tank (placed directly, as other harnesses
 * place cameras); the "Dive in" prompt appears; press E. The animation loop is then stepped frame
 * by frame at 60 Hz so the frames just before and just after the switch into the aquarium are
 * captured: they should be nearly identical (the switch is seamless). After the dive, W swims.
 * Surfacing compiles no new shader programs (its shader is warmed during loading).
 * Near the surface "Return to the office" appears; E surfaces, again across a seamless switch,
 * ending standing in the room. Reduced motion uses a short fade instead. No console errors; GPU
 * geometry/texture counts return to their earlier values.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy021-dive';
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
const report = { base, errors: [], dive: {}, surface: {}, reduced: {} };
try {
  const page = await browser.newPage({
    ...browserScale(),
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
  });
  await page.goto(base);
  await recordBrowserScale(page);
  await page.waitForFunction(() => window.__cozy?.office);
  await page.evaluate(() =>
    Promise.all([window.__cozy.world.prepared, window.__cozy.office.prepared]),
  );
  const settle = () =>
    page.waitForFunction(
      () =>
        !!document.pointerLockElement &&
        document.querySelector('#overlay').hidden,
    );
  await page
    .getByRole('button', { name: 'Enter the Office', exact: true })
    .click();
  await settle();
  await page.waitForTimeout(800);
  const memoryBefore = await page.evaluate(() => ({
    ...window.__cozy.world.renderer.info.memory,
  }));
  // Stand in front of the tank, looking at it.
  await page.evaluate(() => {
    const a = window.__cozy;
    Object.assign(a.walk.position, { x: 0.2, z: 0.7 });
    a.controls.yaw = -Math.PI / 2 + 0.15;
    a.controls.pitch = -0.15;
    a.controls.clear();
  });
  await page.waitForFunction(
    () => !document.querySelector('#dive-prompt').hidden,
  );
  report.dive.prompt = await page.locator('#dive-prompt').innerText();
  await page.screenshot({ path: path.join(output, 'dive-0-prompt.png') });
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !!window.__cozy.dive);
  // Step the loop by hand at 60 Hz across the switch.
  const step = (count) =>
    page.evaluate(async (count) => {
      const a = window.__cozy;
      cancelAnimationFrame(a.frame);
      a.__t = Math.max(a.__t ?? 0, a.previous || 0);
      for (let i = 0; i < count; i++) {
        // Yield a real frame first: frames rendered back to back in one task are never
        // presented, and SwiftShader's buffers then grow without bound until the tab crashes.
        await new Promise((resolve) => requestAnimationFrame(resolve));
        cancelAnimationFrame(a.frame);
        a.__t = (a.__t ?? performance.now()) + 1000 / 60;
        a.tick(a.__t);
        cancelAnimationFrame(a.frame);
      }
      return {
        mode: a.mode,
        elapsed: a.dive?.elapsed ?? null,
        outlook: a.world.outlook.mesh.material.uniforms.reveal.value,
      };
    }, count);
  /** Step (without screenshots) to the last frame before the space switch, capture it and the next. */
  const captureSwitch = async (name, target) => {
    const switchAt = await page.evaluate((target) => {
      const path = window.__cozy.dive.path;
      // First time the sampled space becomes the target.
      const f = {
        space: '',
        x: 0,
        y: 0,
        z: 0,
        yaw: 0,
        pitch: 0,
        veil: 0,
        fog: 0,
        bubbles: 0,
      };
      for (let t = 0; t <= path.duration; t += 1 / 600)
        if (path.sample(t, f).space === target) return t;
      return path.duration;
    }, target);
    let s = await step(0);
    while (s.elapsed !== null && s.elapsed + 2 / 60 < switchAt)
      s = await step(1);
    while (s.mode !== target) {
      if (name === 'dive-switch') assert.equal(s.outlook, 0);
      await page.screenshot({ path: path.join(output, `${name}-before.png`) });
      s = await step(1);
    }
    if (name === 'dive-switch')
      assert(
        s.outlook < 0.01,
        'entry starts blue, without popping in the captured room',
      );
    await page.screenshot({ path: path.join(output, `${name}-after.png`) });
    return s;
  };
  await step(30);
  await page.screenshot({ path: path.join(output, 'dive-1-approach.png') });
  const crossed = await captureSwitch('dive-switch', 'aquarium');
  report.dive.switchedAt = crossed.elapsed;
  // COZY_DIVE_ONLY=1: stop after the dive's switch (quick seam check).
  if (process.env.COZY_DIVE_ONLY) {
    fs.writeFileSync(
      path.join(output, 'report.json'),
      JSON.stringify(report, null, 2),
    );
    await browser.close();
    process.exit(0);
  }
  await step(20);
  await page.screenshot({ path: path.join(output, 'dive-2-splash.png') });
  while ((await step(10)).elapsed !== null);
  report.dive.end = await page.evaluate(() => ({
    mode: window.__cozy.mode,
    position: { ...window.__cozy.state.position },
  }));
  assert.equal(report.dive.end.mode, 'aquarium');
  assert.equal(
    await page.evaluate(
      () => window.__cozy.world.outlook.mesh.material.uniforms.reveal.value,
    ),
    1,
  );
  await page.screenshot({ path: path.join(output, 'dive-3-arrived.png') });
  // Real W input with a bounded number of rendered frames: SwiftShader may draw
  // too few frames in a short wall-clock timeout to finish the swim-speed ramp.
  const before = await page.evaluate(() => ({
    ...window.__cozy.state.position,
  }));
  await page.keyboard.down('w');
  for (let frame = 0; frame < 120; frame++) {
    await step(1);
    const distance = await page.evaluate((b) => {
      const p = window.__cozy.state.position;
      return Math.hypot(p.x - b.x, p.y - b.y, p.z - b.z);
    }, before);
    if (distance > 0.4) break;
  }
  await page.keyboard.up('w');
  const after = await page.evaluate(() => ({
    ...window.__cozy.state.position,
  }));
  report.dive.swamAfter = +Math.hypot(
    after.x - before.x,
    after.y - before.y,
    after.z - before.z,
  ).toFixed(2);
  assert(report.dive.swamAfter > 0.3, 'swimming must work after the dive');
  // Resume native rendering for the surfacing prompt. The manual helper resynchronizes
  // its synthetic clock before taking over again.
  await page.evaluate(() => {
    const a = window.__cozy;
    a.previous = 0;
    a.frame = requestAnimationFrame(a.tick);
  });

  // Surface: rise near the surface and press E.
  await page.evaluate(() => {
    const a = window.__cozy;
    Object.assign(a.state.position, { x: -3, y: 12.6, z: 4 });
    a.state.neutralDepth = 12.6;
  });
  await page.waitForFunction(
    () => !document.querySelector('#dive-prompt').hidden,
  );
  report.surface.prompt = await page.locator('#dive-prompt').innerText();
  const programs = () =>
    page.evaluate(() => window.__cozy.world.renderer.info.programs.length);
  const programsBefore = await programs();
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !!window.__cozy.dive);
  await step(20);
  const out = await captureSwitch('surface-switch', 'office');
  report.surface.switchedAt = out.elapsed;
  // The surfacing view's shader was compiled during loading: nothing new compiles now.
  report.surface.newPrograms = (await programs()) - programsBefore;
  assert.equal(report.surface.newPrograms, 0);
  while ((await step(10)).elapsed !== null);
  report.surface.end = await page.evaluate(() => ({
    mode: window.__cozy.mode,
    position: { ...window.__cozy.walk.position },
  }));
  assert.equal(report.surface.end.mode, 'office');
  assert.equal(report.surface.end.position.y, 1.28);
  await page.screenshot({ path: path.join(output, 'surface-3-standing.png') });

  // Reduced motion: a short fade instead of the glide.
  await page.evaluate(() => {
    const a = window.__cozy;
    a.settings = { ...a.settings, reducedMotion: true };
    Object.assign(a.walk.position, { x: 0.2, z: 0.7 });
    a.controls.yaw = -Math.PI / 2;
    a.controls.pitch = -0.1;
    a.controls.clear();
    a.previous = 0;
    a.frame = requestAnimationFrame(a.tick);
  });
  await page.waitForFunction(
    () => !document.querySelector('#dive-prompt').hidden,
  );
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !!window.__cozy.dive);
  report.reduced.duration = await page.evaluate(
    () => window.__cozy.dive.path.duration,
  );
  assert(report.reduced.duration < 1.2);
  await page.waitForFunction(() => !window.__cozy.dive);
  report.reduced.mode = await page.evaluate(() => window.__cozy.mode);
  assert.equal(report.reduced.mode, 'aquarium');
  assert.equal(
    await page.evaluate(
      () => window.__cozy.world.outlook.mesh.material.uniforms.reveal.value,
    ),
    1,
  );

  // Back to the office from the pause screen; GPU memory returns to its earlier counts.
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: 'Enter the Office', exact: true })
    .click();
  await settle();
  // Pass 022: the pause-screen switch fades; wait until it has finished.
  await page.waitForFunction(
    () => !window.__cozy.dive && window.__cozy.mode === 'office',
  );
  await page.waitForTimeout(800);
  report.memory = {
    before: memoryBefore,
    after: await page.evaluate(() => ({
      ...window.__cozy.world.renderer.info.memory,
    })),
  };
  assert.deepEqual(report.memory.after, report.memory.before);
  assert.deepEqual(report.errors, []);
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 1));
