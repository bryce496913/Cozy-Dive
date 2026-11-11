/* v0.3 Pass 021: interrupted, hidden, repeated and reduced-motion dives, with real input.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy021-interrupt node validation/dive-interrupt.mjs
 *
 * 1. Interruptions: for the dive and for surfacing, Escape before and after the space switch, then
 *    choose the destination (the transition resumes from where it paused and finishes) or the
 *    origin (it is cancelled: the player is back exactly where E was pressed, and the camera shows
 *    that pose with no jump). While paused, nothing advances.
 * 2. A hidden tab mid-surfacing: the transition, the aquarium clock and the office's reverse view
 *    all stop rendering/advancing; it resumes when the tab returns.
 * 3. Consecutive cycles (COZY_CYCLES, default 5) of dive, swim, surface and a pause-screen
 *    fade there and back, then reduced-motion surfacing.
 * 4. GPU geometry/texture counts and compiled shader programs return to their starting values; no
 *    console errors.
 * The animation loop is stepped by hand (10 Hz, within the 0.1 s frame cap) to keep SwiftShader
 * runs short and deterministic.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy021-interrupt';
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
const report = {
  base,
  errors: [],
  interruptions: [],
  hidden: {},
  cycles: 0,
  reducedSurface: {},
};
const near = (a, b, eps = 1e-6) =>
  Math.abs(a.x - b.x) < eps &&
  Math.abs(a.y - b.y) < eps &&
  Math.abs(a.z - b.z) < eps;
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
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
  await page.waitForFunction(() => window.__cozy?.office);
  await page.evaluate(() =>
    Promise.all([window.__cozy.world.prepared, window.__cozy.office.prepared]),
  );
  const locked = () =>
    page.waitForFunction(
      () =>
        !!document.pointerLockElement &&
        document.querySelector('#overlay').hidden,
    );
  const paused = () =>
    page.waitForFunction(
      () =>
        !document.pointerLockElement &&
        !document.querySelector('#overlay').hidden,
    );
  /** Click the pause/start button for `space` ("Enter/Return to the Office/Water"). */
  const choose = async (space) => {
    await page
      .getByRole('button', {
        name: space === 'office' ? /the Office/ : /the Water/,
      })
      .click();
    await locked();
  };
  await choose('office');
  await page.waitForTimeout(500);
  // From here the loop is stepped by hand only.
  const step = (count = 1) =>
    page.evaluate(async (count) => {
      const a = window.__cozy;
      cancelAnimationFrame(a.frame);
      for (let i = 0; i < count; i++) {
        // Yield a real frame first: frames rendered back to back in one task are never
        // presented, and SwiftShader's buffers then grow without bound until the tab crashes.
        await new Promise((resolve) => requestAnimationFrame(resolve));
        cancelAnimationFrame(a.frame);
        a.__t = (a.__t ?? performance.now()) + 100;
        a.tick(a.__t);
        cancelAnimationFrame(a.frame);
      }
      return { mode: a.mode, elapsed: a.dive?.elapsed ?? null };
    }, count);
  await step(2);
  const snapshot = () =>
    page.evaluate(() => {
      const r = window.__cozy.world.renderer;
      return {
        geometries: r.info.memory.geometries,
        textures: r.info.memory.textures,
        programs: r.info.programs.length,
      };
    });
  const before = await snapshot();
  /** Player and camera state in the current space. */
  const state = () =>
    page.evaluate(() => {
      const a = window.__cozy,
        office = a.mode === 'office',
        p = office ? a.walk.position : a.state.position,
        c = office ? a.office.camera : a.world.camera;
      return {
        mode: a.mode,
        dive: a.dive
          ? {
              elapsed: a.dive.elapsed,
              kind: a.dive.path.kind,
              start: a.dive.path.start,
              end: a.dive.path.end,
            }
          : null,
        player: { ...p },
        camera: { x: c.position.x, y: c.position.y, z: c.position.z },
        yaw: a.controls.yaw,
        aquariumTime: a.elapsed,
      };
    });
  /** Get into `space` (by the pause screen's fade, Pass 022) and start its transition with E. */
  const begin = async (kind) => {
    const space = kind === 'dive' ? 'office' : 'aquarium';
    if ((await state()).mode !== space) {
      await page.keyboard.press('Escape');
      await paused();
      await choose(space);
      let s = await step(1);
      while (s.elapsed !== null) s = await step(1);
    }
    await page.evaluate((kind) => {
      const a = window.__cozy;
      if (kind === 'dive') {
        Object.assign(a.walk.position, { x: 1.3, z: -0.15 });
        a.controls.yaw = -Math.PI / 2 - 0.1;
        a.controls.pitch = -0.12;
      } else {
        Object.assign(a.state.position, { x: 4, y: 12.6, z: -2 });
        a.state.neutralDepth = 12.6;
        a.controls.yaw = 0.7;
        a.controls.pitch = 0.05;
      }
      a.controls.clear();
    }, kind);
    await step(1);
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => !!window.__cozy.dive);
    return page.evaluate(() => {
      const p = window.__cozy.dive.path,
        f = {
          space: '',
          x: 0,
          y: 0,
          z: 0,
          yaw: 0,
          pitch: 0,
          veil: 0,
          fog: 0,
          bubbles: 0,
        },
        first = p.sample(0, f).space;
      for (let t = 0; t <= p.duration; t += 1 / 600)
        if (p.sample(t, f).space !== first) return t;
      return p.duration;
    });
  };
  const finish = async () => {
    let s = await step(1);
    for (let i = 0; s.elapsed !== null; i++) {
      assert(i < 200, 'the transition must finish');
      s = await step(5);
    }
  };

  // 1. Interruptions.
  for (const kind of ['dive', 'surface'])
    for (const when of ['before', 'after'])
      for (const choice of ['resume', 'cancel']) {
        const switchAt = await begin(kind);
        const target = when === 'before' ? switchAt * 0.5 : switchAt + 0.4;
        let s = await step(1);
        while (s.elapsed < target) s = await step(1);
        await page.keyboard.press('Escape');
        await paused();
        const atPause = await state();
        // Paused: nothing advances and nothing moves.
        await step(5);
        const stillPaused = await state();
        assert.equal(stillPaused.dive.elapsed, atPause.dive.elapsed);
        assert.equal(stillPaused.aquariumTime, atPause.aquariumTime);
        assert(near(stillPaused.camera, atPause.camera));
        const { start, end } = atPause.dive;
        const pick = choice === 'resume' ? end.space : start.space;
        await choose(pick);
        await step(1);
        const after = await state();
        const entry = {
          kind,
          when,
          choice,
          pausedIn: atPause.mode,
          pausedAt: +atPause.dive.elapsed.toFixed(2),
          switchAt: +switchAt.toFixed(2),
        };
        if (choice === 'resume') {
          assert(after.dive, 'choosing the destination resumes the transition');
          assert(after.dive.elapsed >= atPause.dive.elapsed);
          await finish();
          const done = await state();
          assert.equal(done.mode, end.space);
          // Idle swimming may bob a few millimetres in the frames after it ends.
          assert(near(done.player, end.pose, 0.02));
          assert(near(done.camera, done.player, 1e-6));
          entry.ended = done.mode;
        } else {
          assert.equal(after.dive, null, 'choosing the origin cancels');
          assert.equal(after.mode, start.space);
          // Exactly where E was pressed, and the camera shows it (no snap to an older pose).
          assert(near(after.player, start.pose, 0.02));
          assert(near(after.camera, after.player, 1e-6));
          assert(Math.abs(after.yaw - start.pose.yaw) < 1e-6);
          entry.ended = after.mode;
        }
        report.interruptions.push(entry);
      }
  await page.screenshot({ path: path.join(output, 'after-interruptions.png') });

  // 2. Hidden tab mid-surfacing (while the office is shown through the front glass).
  {
    const switchAt = await begin('surface');
    let s = await step(1);
    while (s.elapsed < switchAt - 0.4) s = await step(1);
    await page.evaluate(() => {
      const a = window.__cozy;
      a.__outsideRenders = 0;
      const original = a.office.renderOutside.bind(a.office);
      a.office.renderOutside = (camera) => {
        a.__outsideRenders++;
        return original(camera);
      };
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const hiddenAt = await state();
    await step(10);
    const whileHidden = await state();
    report.hidden.outsideRendersWhileHidden = await page.evaluate(
      () => window.__cozy.__outsideRenders,
    );
    assert.equal(report.hidden.outsideRendersWhileHidden, 0);
    assert.equal(whileHidden.dive.elapsed, hiddenAt.dive.elapsed);
    assert.equal(whileHidden.aquariumTime, hiddenAt.aquariumTime);
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    // Hiding released pointer lock: resume from the pause screen.
    await paused();
    await choose('office');
    await step(1);
    report.hidden.outsideRendersAfterReturn = await page.evaluate(
      () => window.__cozy.__outsideRenders,
    );
    assert(report.hidden.outsideRendersAfterReturn > 0);
    await finish();
    report.hidden.ended = (await state()).mode;
    assert.equal(report.hidden.ended, 'office');
    await page.evaluate(() => {
      const a = window.__cozy;
      delete a.office.renderOutside;
    });
  }

  // 3. Five full dive/surface cycles.
  // COZY_CYCLES (default 5) full cycles; a long run doubles as a soak (Pass 022). Each cycle also
  // swims a few seconds and switches spaces once from the pause screen.
  report.perCycle = [];
  for (let i = 0; i < Number(process.env.COZY_CYCLES || 5); i++) {
    await begin('dive');
    await finish();
    assert.equal((await state()).mode, 'aquarium');
    await page.keyboard.down('w');
    await step(20);
    await page.keyboard.up('w');
    await begin('surface');
    await finish();
    assert.equal((await state()).mode, 'office');
    // Pause-screen fade there and back.
    for (const space of ['aquarium', 'office']) {
      await page.keyboard.press('Escape');
      await paused();
      await choose(space);
      let s = await step(1);
      while (s.elapsed !== null) s = await step(1);
      assert.equal((await state()).mode, space);
    }
    report.cycles++;
    console.log(`cycle ${report.cycles}`, JSON.stringify(await snapshot()));
    report.perCycle.push({
      ...(await snapshot()),
      heapMB: await page.evaluate(() =>
        Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1e6),
      ),
    });
  }
  report.afterCycles = await snapshot();
  assert.deepEqual(
    { ...report.afterCycles },
    { ...before },
    'GPU resources unchanged after the cycles',
  );

  // Reduced-motion surfacing: a short fade, no reverse view.
  await page.evaluate(() => {
    const a = window.__cozy;
    a.settings = { ...a.settings, reducedMotion: true };
  });
  await begin('surface');
  report.reducedSurface.duration = await page.evaluate(
    () => window.__cozy.dive.path.duration,
  );
  assert(report.reducedSurface.duration < 1.2);
  let outsideShown = false;
  for (let s = await step(1); s.elapsed !== null; s = await step(1))
    outsideShown ||= await page.evaluate(() =>
      window.__cozy.world.scene.children.some(
        (c) => c.name === 'Office through the front glass',
      ),
    );
  report.reducedSurface.outsideShown = outsideShown;
  assert.equal(outsideShown, false);
  const ended = await state();
  report.reducedSurface.ended = ended.mode;
  assert.equal(ended.mode, 'office');
  assert(near(ended.player, ended.camera, 1e-6));

  report.memory = { before, after: await snapshot() };
  assert.deepEqual(report.memory.after, report.memory.before);
  assert.deepEqual(report.errors, []);
  await page.screenshot({ path: path.join(output, 'end.png') });
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 1));
