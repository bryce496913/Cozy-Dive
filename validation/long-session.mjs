import { browserScale, recordBrowserScale } from './browser-scale.mjs';
/* v0.6 Pass 046 review: a long session through every passage, with real input.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy047-long node validation/long-session.mjs
 *
 * Twice over: tank → outer reef → kelp forest → sea cave → under the ice, swimming through each
 * passage with W held; back from the ice into the cave; pause and resume; then "Return to the tank"
 * and swim away from the crevice until every outer world is released. Records the GPU's geometry
 * and texture counts in the tank, with each world added, and after each release, and each world's
 * build time (`app.buildTimes`). Checks:
 *   - each world, and all of them together, within its memory budget (`BUDGET`, measured here and
 *     given about a quarter's headroom);
 *   - after each release the counts are back to the tank's (nothing left behind), and the second
 *     time round matches the first (no growth);
 *   - each world's preparation settles (ready or partial) and is disposed when released;
 *   - no page errors.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy047-long';
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
    ...browserScale(),
    viewport: { width: 960, height: 600 },
  });
  page.setDefaultTimeout(Number(process.env.COZY_ACTION_TIMEOUT || 240000));
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body:
        (await r.text()) +
        '\nwindow.__cozy=app;cancelAnimationFrame(app.frame);',
    });
  });
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  await page.goto(base);
  await recordBrowserScale(page);
  await page.evaluate(() => localStorage.removeItem('cozy-diver.journal.v1'));
  await page.reload();
  await page.waitForFunction(() => window.__cozy?.office);
  await page.evaluate(() =>
    Promise.all([
      window.__cozy.world.prepared,
      window.__cozy.office.prepared,
      window.__cozy.tankEditor.ready,
    ]),
  );
  await page.evaluate(() => window.__cozy.tickOffice(0));
  const locked = () =>
    page.waitForFunction(
      () =>
        !!document.pointerLockElement &&
        document.querySelector('#overlay').hidden,
    );
  await page.getByRole('button', { name: 'Dive In', exact: true }).click();
  await locked();
  const step = (count = 1) =>
    page.evaluate(async (count) => {
      const a = window.__cozy;
      cancelAnimationFrame(a.frame);
      for (let i = 0; i < count; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        cancelAnimationFrame(a.frame);
        a.__t = (a.__t ?? performance.now()) + (window.__stepMs ?? 1000 / 30);
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
        outerReady: !!a.outer?.isReady,
        reefReady: !!a.outer?.isReefReady,
        kelp: !!a.kelp,
        kelpReady: !!a.kelp?.isReady,
        cave: !!a.cave,
        caveReady: !!a.cave?.isReady,
        dark: Number(
          getComputedStyle(document.querySelector('.passage-veil')).opacity,
        ),
      };
    }, count);
  const place = (p, yaw, pitch = 0) =>
    page.evaluate(
      ([p, yaw, pitch]) => {
        const a = window.__cozy;
        Object.assign(a.state.position, p);
        a.state.velocity.x = a.state.velocity.y = a.state.velocity.z = 0;
        a.state.neutralDepth = p.y;
        a.controls.yaw = yaw;
        a.controls.pitch = pitch;
        a.controls.clear();
      },
      [p, yaw, pitch],
    );
  /** Each world's own GPU objects, and all five worlds together (geometries, textures). */
  const BUDGET = {
    outer: { geometries: 1400, textures: 140 },
    kelp: { geometries: 260, textures: 40 },
    cave: { geometries: 220, textures: 40 },
    ice: { geometries: 80, textures: 12 },
    all: { geometries: 1900, textures: 220 },
  };
  const memory = () =>
    page.evaluate(() => {
      const m = window.__cozy.world.renderer.info.memory;
      return { geometries: m.geometries, textures: m.textures };
    });
  const state = () =>
    page.evaluate(() => {
      const a = window.__cozy;
      return {
        world: a.waterWorld,
        outer: !!a.outer,
        outerReady: !!a.outer?.isReady,
        reefReady: !!a.outer?.isReefReady,
        kelp: !!a.kelp,
        kelpReady: !!a.kelp?.isReady,
        cave: !!a.cave,
        caveReady: !!a.cave?.isReady,
        ice: !!a.ice,
        iceReady: !!a.ice?.isReady,
        z: a.state.position.z,
      };
    });
  const until = async (test, max = 900, frames = 2) => {
    let s = await state();
    for (let i = 0; i < max && !test(s); i++) {
      await step(frames);
      s = await state();
    }
    return s;
  };
  const swimThrough = async (world) => {
    await page.keyboard.down('w');
    const s = await until((s) => s.world === world, 600, 1);
    await page.keyboard.up('w');
    assert.equal(s.world, world, `through the passage into ${world}`);
  };
  const paused = () =>
    page.waitForFunction(
      () =>
        !document.pointerLockElement &&
        !document.querySelector('#overlay').hidden,
    );
  const diff = (a, b) => ({
    geometries: a.geometries - b.geometries,
    textures: a.textures - b.textures,
  });
  const within = (d, b, what) => {
    assert(
      d.geometries <= b.geometries,
      `${what}: ${d.geometries} geometries (budget ${b.geometries})`,
    );
    assert(
      d.textures <= b.textures,
      `${what}: ${d.textures} textures (budget ${b.textures})`,
    );
  };
  await step(2);
  report.tank = await memory();
  report.loops = [];
  for (let loop = 0; loop < 2; loop++) {
    const r = { added: {} };
    let last = await memory(),
      s;
    // Tank → outer reef.
    await place({ x: 6.4, y: 1.6, z: -12.1 }, Math.PI / 2);
    s = await until((s) => s.outerReady, 600, 1);
    await swimThrough('outer');
    s = await until((s) => s.reefReady);
    assert(s.reefReady, 'the outer reef is prepared');
    let m = await memory();
    r.added.outer = diff(m, last);
    last = m;
    // Outer reef → kelp forest.
    await place({ x: -17.6, y: 1.3, z: -32 }, -Math.PI / 2);
    s = await until((s) => s.kelpReady);
    assert(s.kelpReady, 'the kelp forest is ready');
    await swimThrough('kelp');
    m = await memory();
    r.added.kelp = diff(m, last);
    last = m;
    // Pause and resume in the forest.
    await page.keyboard.press('Escape');
    await paused();
    await step(10);
    await page.getByRole('button', { name: /Return to the Water/ }).click();
    await locked();
    // Kelp forest → sea cave.
    await place({ x: 15.1, y: 2.8, z: -10 }, -Math.PI / 2);
    s = await until((s) => s.caveReady);
    assert(s.caveReady, 'the sea cave is ready');
    await swimThrough('cave');
    m = await memory();
    r.added.cave = diff(m, last);
    last = m;
    // Sea cave → under the ice.
    await place({ x: -3, y: 3.2, z: -33 }, 0, 0);
    s = await until((s) => s.iceReady);
    assert(s.iceReady, 'the waters under the ice are ready');
    await swimThrough('ice');
    m = await memory();
    r.added.ice = diff(m, last);
    r.all = diff(m, report.tank);
    r.preparation = await page.evaluate(() => {
      const a = window.__cozy;
      return {
        outer: a.outer.preparation.state,
        kelp: a.kelp.preparation.state,
        cave: a.cave.preparation.state,
        ice: a.ice.preparation.state,
      };
    });
    r.buildTimes = await page.evaluate(() =>
      JSON.parse(JSON.stringify(window.__cozy.buildTimes)),
    );
    // Back from the ice into the cave.
    await place({ x: 0, y: 4, z: -9 }, Math.PI, 0);
    await swimThrough('cave');
    // Pause, and "Return to the tank"; swim away until every outer world is released.
    await page.keyboard.press('Escape');
    await paused();
    await page.getByRole('button', { name: /Return to the tank/ }).click();
    await locked();
    await page.evaluate(() => {
      const a = window.__cozy;
      window.__preps = [a.outer, a.kelp, a.cave, a.ice].map(
        (w) => w?.preparation,
      );
      return true;
    });
    await place({ x: -8, y: 6, z: 8 }, 0, 0);
    s = await until((s) => !s.outer && !s.kelp && !s.cave && !s.ice, 600, 2);
    await step(3);
    assert(
      !s.outer && !s.kelp && !s.cave && !s.ice,
      'every outer world is released',
    );
    r.released = await page.evaluate(() => window.__preps.map((p) => p?.state));
    r.afterRelease = await memory();
    report.loops.push(r);
  }
  // Budgets, release and steadiness (checked once both loops are measured).
  report.loops.forEach((r, loop) => {
    for (const w of ['outer', 'kelp', 'cave', 'ice'])
      within(r.added[w], BUDGET[w], `${w} (loop ${loop + 1})`);
    within(r.all, BUDGET.all, `all five worlds (loop ${loop + 1})`);
    for (const p of Object.values(r.preparation))
      assert(p === 'ready' || p === 'partial', `prepared (${p})`);
    for (const p of r.released)
      assert.equal(p, 'disposed', 'released worlds are disposed');
    assert.deepEqual(
      r.afterRelease,
      report.tank,
      `back to the tank's GPU memory (loop ${loop + 1})`,
    );
  });
  assert.deepEqual(
    report.loops[1].all,
    report.loops[0].all,
    'the second time round is the same as the first',
  );
  assert.deepEqual(report.errors, [], 'no page errors');
  report.ok = true;
} catch (error) {
  report.failure = String(error?.stack || error);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
