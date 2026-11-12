/* v0.4 Pass 024/026: the outer reef, with real input.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy024-reef node validation/outer-reef.mjs
 *
 * Enters the water with real pointer lock and swims through the hidden crack into the outer reef,
 * recording main-thread long tasks while it is prepared (Pass 026: the reef is prepared while
 * the swimmer is in the tunnel; how long that takes is recorded too). Then, at fixed viewpoints, it
 * records draw calls, triangles, CPU submit time and how many reef pieces are drawn at each detail
 * level. With real keys it checks that the seabed is a floor, that the wall can be swum down a
 * little, and that swimming out over the blue and towards the sides slows to a hover (Pass 026). Fish must move and stay above the sand. Return to
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
    await page.keyboard.down('w');
    for (let i = 0; i < 600 && s.world !== 'outer'; i++) s = await step(1);
    await page.keyboard.up('w');
    assert.equal(s.world, 'outer');
    // Pass 026: the reef prepares while the swimmer is in the tunnel.
    const reefMs = await page.evaluate(async () => {
      const t0 = performance.now();
      await window.__cozy.outer.reefPrepared;
      return Math.round(performance.now() - t0);
    });
    await step(70);
    const longTasks = await page.evaluate(() => window.__longTasks);
    return { longTasks, reefMs };
  };
  const { longTasks, reefMs } = await visit();
  report.reefPreparedAfterCrossingMs = reefMs;
  report.programsOuter = await page.evaluate(
    () => window.__cozy.world.renderer.info.programs.length,
  );
  report.longTasks = longTasks
    ? { count: longTasks.length, longestMs: Math.max(0, ...longTasks) }
    : 'unsupported';

  // Fixed views: draw calls, triangles, CPU submit (mean of 5 renders), reef pieces drawn.
  const head = await page.evaluate(() => window.__cozy.outer.reef.heads[0]);
  const views = {
    // Pass 026: the arrival, among the bommies, at the lip, out over the blue, back at the wall.
    'from-the-cliff': [0, 7, -33, 0, -0.2],
    'coral-head': [head.x + 6, head.y + 4, head.z + 4, Math.atan2(6, 4), -0.35],
    'reef-top': [-7, 4, -40, 0.3, -0.25],
    'at-the-lip': [0, 1.5, -54, 0, -0.35],
    'into-the-blue': [2, -1, -61, 0, -0.05],
    'back-at-the-wall': [10, -3, -66, Math.PI - 0.4, 0.15],
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
  await place(3, 5, -44, 0, -1.45);
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

  // Pass 026: the wall can be swum down a little, then swimming eases to a hover.
  await place(0, 0, -59, 0, -1.4);
  await page.keyboard.down('w');
  s = await step(300);
  await page.keyboard.up('w');
  report.downTheWall = { y: +s.y.toFixed(2), z: +s.z.toFixed(2) };
  assert(s.y < -5, 'some way down the wall');
  assert(s.y > -16, 'but not into the deep');
  await page.screenshot({ path: path.join(output, 'down-the-wall.png') });

  // Out over the blue: holding W past the lip slows to a hover a few metres out.
  await place(2, -1, -50, 0, 0);
  await page.keyboard.down('w');
  let furthestOut = 0;
  for (let i = 0; i < 30; i++) {
    s = await step(10);
    furthestOut = Math.max(furthestOut, -56 - s.z);
  }
  await page.keyboard.up('w');
  report.outOverTheBlue = { pastTheLip: +furthestOut.toFixed(2) };
  assert(furthestOut > 4, 'a little way out over the blue');
  assert(furthestOut < 9.5, 'then hovering');
  await page.screenshot({
    path: path.join(output, 'hovering-in-the-blue.png'),
  });

  // The sides: holding W towards one slows to a hover in the edge band.
  await place(14, 4, -44, -Math.PI / 2, 0);
  await page.keyboard.down('w');
  let furthest = 14;
  for (let i = 0; i < 30; i++) {
    s = await step(10);
    furthest = Math.max(furthest, s.x);
  }
  await page.keyboard.up('w');
  report.edge = { furthestX: +furthest.toFixed(2) };
  assert(furthest < 34, 'eased to a hover well before the outer bounds');
  assert(furthest > 25, 'but free to swim into the edge band');

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
