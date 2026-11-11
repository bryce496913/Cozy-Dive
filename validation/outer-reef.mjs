/* v0.4 Pass 024: the outer reef, with real input.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy024-reef node validation/outer-reef.mjs
 *
 * Enters the water with real pointer lock and swims through the hidden crack into the outer reef,
 * recording main-thread long tasks while the reef is prepared. Then, at fixed viewpoints, it
 * records draw calls, triangles, CPU submit time and how many reef pieces are drawn at each detail
 * level. With real keys it checks that the seabed is a floor, that the drop-off can be swum down,
 * and that the soft edge turns the swimmer back. Fish must move and stay above the sand. Return to
 * the tank, then release far away, twice: GPU memory must not grow from one visit to the next.
 * The loop is stepped by hand (30 Hz), yielding a real frame each step.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy024-reef';
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
const report = { base, errors: [], views: {} };
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 700 },
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
  await page.waitForFunction(() => window.__cozy?.world);
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
        x: p.x,
        y: p.y,
        z: p.z,
        outer: !!a.outer,
        ready: !!a.outer?.isReady,
      };
    }, count);
  const memory = () =>
    page.evaluate(() => ({ ...window.__cozy.world.renderer.info.memory }));
  const place = (x, y, z, yaw, pitch) =>
    page.evaluate(
      ([x, y, z, yaw, pitch]) => {
        const a = window.__cozy;
        Object.assign(a.state.position, { x, y, z });
        a.state.velocity.x = a.state.velocity.y = a.state.velocity.z = 0;
        a.state.neutralDepth = y;
        a.controls.yaw = yaw;
        a.controls.pitch = pitch;
        a.controls.clear();
      },
      [x, y, z, yaw, pitch],
    );
  await step(2);
  report.memoryTank = await memory();
  report.programsTank = await page.evaluate(
    () => window.__cozy.world.renderer.info.programs.length,
  );

  /** Swim through the crack (real W), recording long tasks while the reef prepares. */
  const visit = async () => {
    await page.evaluate(() => {
      window.__longTasks = [];
      window.__observer?.disconnect();
      try {
        window.__observer = new PerformanceObserver((list) => {
          for (const e of list.getEntries())
            window.__longTasks.push(Math.round(e.duration));
        });
        window.__observer.observe({ type: 'longtask', buffered: false });
      } catch {
        window.__longTasks = null;
      }
    });
    await place(6.4, 1.6, -12.1, Math.PI / 2, 0);
    let s = await step(1);
    for (let i = 0; i < 600 && !s.ready; i++) s = await step(1);
    assert(s.ready, 'the outer reef becomes ready');
    const longTasks = await page.evaluate(() => window.__longTasks);
    await page.keyboard.down('w');
    for (let i = 0; i < 600 && s.world !== 'outer'; i++) s = await step(1);
    await page.keyboard.up('w');
    assert.equal(s.world, 'outer');
    return longTasks;
  };
  const longTasks = await visit();
  report.programsOuter = await page.evaluate(
    () => window.__cozy.world.renderer.info.programs.length,
  );
  report.longTasks = longTasks
    ? { count: longTasks.length, longestMs: Math.max(0, ...longTasks) }
    : 'unsupported';

  // Fixed views: draw calls, triangles, CPU submit (mean of 5 renders), reef pieces drawn.
  const head = await page.evaluate(() => window.__cozy.outer.reef.heads[0]);
  const views = {
    'from-the-cliff': [0, 8, -34, 0, -0.25],
    'coral-head': [head.x + 9, head.y + 4, head.z + 6, Math.atan2(9, 6), -0.3],
    channel: [0, 3, -45, 0, -0.12],
    'drop-off': [0, 3, -97, 0, -0.45],
    'reef-edge': [40, 5, -60, -1.2, -0.1],
  };
  for (const [name, [x, y, z, yaw, pitch]] of Object.entries(views)) {
    await place(x, y, z, yaw, pitch);
    await step(6);
    report.views[name] = await page.evaluate(() => {
      const a = window.__cozy,
        r = a.world.renderer,
        times = [];
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        a.outer.render(0, false, 1 / 30, true, a.playerPresence);
        times.push(performance.now() - t0);
      }
      return {
        calls: r.info.render.calls,
        triangles: r.info.render.triangles,
        submitMs: +(times.reduce((s, t) => s + t, 0) / times.length).toFixed(1),
        reef: a.outer.reef.drawnCounts(),
      };
    });
    await page.screenshot({ path: path.join(output, `${name}.png`) });
  }

  // Fish: they move, and stay above the sand.
  const fishAt = () =>
    page.evaluate(() =>
      window.__cozy.outer.schools.fish.simulation.fish.map((f) => ({
        x: f.position.x,
        y: f.position.y,
        z: f.position.z,
      })),
    );
  const before = await fishAt();
  await place(head.x + 9, head.y + 4, head.z + 6, Math.atan2(9, 6), -0.3);
  await step(60);
  const after = await fishAt();
  const moved = after.filter(
    (p, i) =>
      Math.hypot(p.x - before[i].x, p.y - before[i].y, p.z - before[i].z) > 0.2,
  ).length;
  // Below the seabed? (Its height comes from the swimmer's collision floor, minus clearance.)
  const below = await page.evaluate((fish) => {
    const a = window.__cozy,
      clearance = a.outer.bounds.clearance;
    return fish.filter((p) => {
      const probe = {
        position: { x: p.x, y: -100, z: p.z },
        velocity: { x: 0, y: 0, z: 0 },
      };
      a.outer.collision.move(probe, p.x, -100, p.z);
      return p.y < probe.position.y - clearance - 0.02;
    }).length;
  }, after);
  report.fish = { count: after.length, moved, below };
  assert(after.length >= 90);
  assert(moved > after.length * 0.6, 'most fish move');
  assert.equal(below, 0);

  // The seabed is a floor: dive straight down with real W.
  await place(3, 5, -55, 0, -1.45);
  await page.keyboard.down('w');
  let s = await step(180);
  await page.keyboard.up('w');
  const floor = await page.evaluate(
    ([x, z]) => {
      const a = window.__cozy;
      // Seabed height via the swimmer's own collision floor (same function).
      const probe = {
        position: { x, y: -100, z },
        velocity: { x: 0, y: 0, z: 0 },
      };
      a.outer.collision.move(probe, x, -100, z);
      return probe.position.y;
    },
    [s.x, s.z],
  );
  report.floor = { y: +s.y.toFixed(3), floor: +floor.toFixed(3) };
  // On the sand (or on a low piece of reef just above it), never below.
  assert(s.y >= floor - 1e-6 && s.y < floor + 0.35, 'resting on the seabed');

  // The drop-off can be swum down.
  await place(0, 2, -104, 0, -1.1);
  await page.keyboard.down('w');
  s = await step(240);
  await page.keyboard.up('w');
  report.dropOff = { y: +s.y.toFixed(2), z: +s.z.toFixed(2) };
  // Well below the reef flat (around 0 m), over the wall.
  assert(s.y < -5, 'down the drop-off wall');
  await page.screenshot({ path: path.join(output, 'down-the-wall.png') });

  // The soft edge turns the swimmer back (holding W towards it).
  await place(40, 6, -60, -Math.PI / 2, 0);
  await page.keyboard.down('w');
  let furthest = 40;
  for (let i = 0; i < 30; i++) {
    s = await step(10);
    furthest = Math.max(furthest, s.x);
  }
  await page.keyboard.up('w');
  report.edge = { furthestX: +furthest.toFixed(2) };
  assert(furthest < 56, 'held back well before the outer bounds');
  assert(furthest > 46, 'but free to swim into the edge band');

  // Return to the tank, release far away; then a second visit and release.
  const release = async () => {
    await page.keyboard.press('Escape');
    await paused();
    await page.getByRole('button', { name: /Return to the tank/ }).click();
    await locked();
    await place(-8, 6, 8, 0, 0);
    for (let i = 0; i < 300 && (await step(1)).outer; i++);
    await step(3);
    return memory();
  };
  report.memoryAfterFirst = await release();
  await visit();
  report.memoryAfterSecond = await release();
  assert.deepEqual(
    report.memoryAfterSecond,
    report.memoryAfterFirst,
    'no growth across visits',
  );
  assert.deepEqual(report.errors, []);
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 1));
