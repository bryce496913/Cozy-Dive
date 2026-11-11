/* v0.4 Pass 023: the hidden passage, with real input.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy023-passage node validation/passage.mjs
 *
 * Enter the Water (real pointer lock), place the swimmer outside the hidden crevice facing in, wait
 * for the outer waters to load, then hold W: the swimmer swims through the crack and, past the
 * threshold, continues in the outer waters' tunnel without any break (the frames either side of
 * the swap are captured). Steering along the tunnel reaches open water; swimming back returns to
 * the tank. From the outer waters the pause screen goes to the office and back, and "Return to
 * the tank" works. Far from the crevice the outer waters are released and GPU memory returns to
 * its earlier counts. The loop is stepped by hand (30 Hz), yielding a real frame each step.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy023-passage';
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
const report = { base, errors: [] };
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 640 },
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
  await page.waitForFunction(() => window.__cozy?.office);
  await page.evaluate(() => window.__cozy.world.prepared);
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
  await page
    .getByRole('button', { name: 'Enter the Water', exact: true })
    .click();
  await locked();
  const step = (count = 1) =>
    page.evaluate(async (count) => {
      const a = window.__cozy;
      cancelAnimationFrame(a.frame);
      for (let i = 0; i < count; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        cancelAnimationFrame(a.frame);
        a.__t = (a.__t ?? performance.now()) + 1000 / 30;
        a.tick(a.__t);
        cancelAnimationFrame(a.frame);
      }
      const p = a.state.position;
      return {
        world: a.waterWorld,
        mode: a.mode,
        x: p.x,
        y: p.y,
        z: p.z,
        outer: !!a.outer,
        ready: !!a.outer?.isReady,
        dark: Number(
          getComputedStyle(document.querySelector('.passage-veil')).opacity,
        ),
      };
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
  report.before = before;
  /** Steer the view towards a point (yaw via turn(), pitch via its target). */
  const aim = (x, y, z) =>
    page.evaluate(
      ([x, y, z]) => {
        const a = window.__cozy,
          p = a.state.position,
          dx = x - p.x,
          dy = y - p.y,
          dz = z - p.z,
          yaw = Math.atan2(-dx, -dz),
          pitch = Math.atan2(dy, Math.hypot(dx, dz));
        const turn = Math.atan2(
          Math.sin(yaw - a.controls.yaw),
          Math.cos(yaw - a.controls.yaw),
        );
        a.controls.turn(turn);
        a.controls.pitch = pitch;
        a.controls.targetPitch = pitch;
      },
      [x, y, z],
    );

  // 1. Outside the crack, facing in.
  const crevice = await page.evaluate(() => {
    const a = window.__cozy;
    Object.assign(a.state.position, { x: 6.4, y: 1.6, z: -12.1 });
    a.state.neutralDepth = 1.6;
    a.controls.yaw = Math.PI / 2;
    a.controls.pitch = 0;
    a.controls.clear();
    return { x: 6.4 };
  });
  let s = await step(1);
  report.preloaded = s.outer;
  assert(s.outer, 'the outer waters load near the crevice');
  for (let i = 0; i < 400 && !s.ready; i++) s = await step(1);
  assert(s.ready, 'the outer waters become ready');
  // Main-thread cost of building the outer waters' synchronous part (a second copy, built and
  // disposed at once; Pass 024's reef and fish are prepared in later tasks).
  report.buildMs = await page.evaluate(() => {
    const a = window.__cozy,
      t0 = performance.now(),
      copy = new a.outer.constructor(a.world.renderer, {
        reef: a.world.reefLoader,
        fish: a.world.authored.loader,
        plants: a.world.aquarium.plants.material,
        soundSpots: a.tankSoundSpots.length,
      }),
      ms = performance.now() - t0;
    copy.dispose();
    return Math.round(ms);
  });
  await page.screenshot({ path: path.join(output, '1-crack.png') });
  report.crevice = crevice;

  // 2. Hold W and swim in: capture the frames either side of the swap.
  await page.keyboard.down('w');
  let previous = s;
  for (let i = 0; i < 600 && s.world === 'aquarium'; i++) {
    previous = s;
    if (s.x < 3.4)
      await page.screenshot({ path: path.join(output, '2-before-swap.png') });
    s = await step(1);
  }
  assert.equal(
    s.world,
    'outer',
    'swimming past the threshold continues in the outer waters',
  );
  await page.screenshot({ path: path.join(output, '3-after-swap.png') });
  report.swap = {
    before: {
      x: previous.x,
      y: previous.y,
      z: previous.z,
      dark: previous.dark,
    },
    after: { x: s.x, y: s.y, z: s.z, dark: s.dark },
  };
  // Darkness is continuous across the swap.
  assert(Math.abs(previous.dark - s.dark) < 0.12);
  assert(s.dark > 0.8);

  // 3. Follow the tunnel to open water.
  const tunnel = [
    [0.6, 8.8, -6],
    [2.4, 8.3, -12],
    [1.2, 7.6, -18],
    [-1.4, 7.2, -24],
    [-0.6, 7, -30],
    [0, 7, -36],
  ];
  for (const [x, y, z] of tunnel) {
    for (let i = 0; i < 400; i++) {
      await aim(x, y, z);
      s = await step(3);
      if (Math.hypot(s.x - x, s.y - y, s.z - z) < 1.3) break;
    }
    if (z === -18)
      await page.screenshot({ path: path.join(output, '4-tunnel.png') });
  }
  report.openWater = { x: s.x, y: s.y, z: s.z };
  assert(s.z < -31, 'the tunnel leads out of the cliff into open water');
  await aim(4, 3, -60);
  await step(2);
  await page.screenshot({ path: path.join(output, '5-open-water.png') });
  await page.keyboard.up('w');

  // 4. Pause: to the office and back keeps the outer waters and the swimmer's place.
  const where = await step(1);
  await page.keyboard.press('Escape');
  await paused();
  report.returnButton = await page
    .getByRole('button', { name: /Return to the tank/ })
    .isVisible();
  assert(report.returnButton);
  await page
    .getByRole('button', { name: 'Enter the Office', exact: true })
    .click();
  await locked();
  for (let i = 0; i < 200 && (await step(1)).mode !== 'office'; i++);
  for (let i = 0; i < 60; i++) await step(1);
  await page.keyboard.press('Escape');
  await paused();
  await page.getByRole('button', { name: /the Water/ }).click();
  await locked();
  let back = await step(1);
  for (
    let i = 0;
    i < 200 && (await page.evaluate(() => !!window.__cozy.dive));
    i++
  )
    back = await step(1);
  back = await step(1);
  report.officeRoundTrip = { world: back.world, mode: back.mode };
  assert.equal(back.world, 'outer');
  assert(Math.hypot(back.x - where.x, back.z - where.z) < 0.5);

  // 5. Swim back through the tunnel into the tank (past its start, where the threshold is).
  await page.keyboard.down('w');
  const way = [...tunnel]
    .reverse()
    .slice(1)
    .concat([
      [0, 9, 0],
      [0, 9, 3],
    ]);
  for (const [k, [x, y, z]] of way.entries()) {
    const last = k === way.length - 1;
    for (let i = 0; i < 400; i++) {
      await aim(x, y, z);
      s = await step(last ? 1 : 3);
      if (s.world === 'aquarium') break;
      if (!last && Math.hypot(s.x - x, s.y - y, s.z - z) < 1.3) break;
    }
    if (s.world === 'aquarium') break;
  }
  await page.keyboard.up('w');
  report.backInTank = { world: s.world, x: s.x, y: s.y, z: s.z };
  assert.equal(
    s.world,
    'aquarium',
    'swimming back out of the tunnel returns to the tank',
  );
  assert(
    s.x > 1.5 && s.x < 5.2 && Math.abs(s.z + 12.1) < 1,
    'in the crevice channel',
  );
  await page.screenshot({ path: path.join(output, '6-back-in-crack.png') });

  // 6. Into the tunnel again, then "Return to the tank" from the pause screen.
  await page.keyboard.down('w');
  for (let i = 0; i < 300 && s.world === 'aquarium'; i++) {
    await aim(1.6, 1.6, -12.1);
    s = await step(1);
  }
  await page.keyboard.up('w');
  assert.equal(s.world, 'outer');
  await page.keyboard.press('Escape');
  await paused();
  await page.getByRole('button', { name: /Return to the tank/ }).click();
  await locked();
  s = await step(1);
  report.returned = { world: s.world, x: s.x, y: s.y, z: s.z, dark: s.dark };
  assert.equal(s.world, 'aquarium');
  assert(s.x > 6);
  for (let i = 0; i < 40; i++) s = await step(1);
  assert(s.dark < 0.05, 'the return fades in from darkness');
  await page.screenshot({ path: path.join(output, '7-returned.png') });

  // 7. Far away, the outer waters are released and memory returns.
  await page.evaluate(() => {
    const a = window.__cozy;
    Object.assign(a.state.position, { x: -8, y: 6, z: 8 });
    a.state.neutralDepth = 6;
  });
  for (let i = 0; i < 200 && s.outer; i++) s = await step(1);
  report.released = !s.outer;
  assert(report.released, 'the outer waters are released far from the crevice');
  await step(3);
  report.after = await snapshot();
  assert.equal(report.after.geometries, before.geometries);
  assert.equal(report.after.textures, before.textures);
  assert.deepEqual(report.errors, []);
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 1));
