import { browserScale, recordBrowserScale } from './browser-scale.mjs';
/* v0.6 Pass 033: visitors along the outer reef's wall, with real input.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy033-visitors node validation/wall-visitors.mjs
 *
 * Starts with an empty journal and no stored visits, enters the water with real pointer lock and
 * holds W through the tank's crevice into the outer waters. Then:
 *   - on arrival nobody is passing the wall, and the visit is stored (the next will be visit 1);
 *   - waiting at the edge, the first visitor of this visit's order comes after `VISITING.first`
 *     seconds of real stepping, appearing out of sight in the haze and swimming into view;
 *   - time at the edge does not count while paused, nor away from the edge;
 *   - the others follow (the wait between them is skipped by advancing the edge time, so the run
 *     stays short); each is followed until it passes closest and photographed there, and looking
 *     at it counts it as seen;
 *   - "Return to the tank", then swimming back through the crevice, is a new visit: nobody is
 *     passing, and a different animal is due first;
 *   - far from the crevice the outer waters are released and GPU memory returns to its first
 *     counts. The loop is stepped by hand (30 Hz), yielding a real frame each step.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy033-visitors';
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
const report = { base, errors: [], visitors: {} };
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
  await page.evaluate(() => {
    localStorage.removeItem('cozy-diver.journal.v1');
    localStorage.removeItem('cozy-diver.visits.v1');
  });
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
  const paused = () =>
    page.waitForFunction(
      () =>
        !document.pointerLockElement &&
        !document.querySelector('#overlay').hidden,
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
        a.__t = (a.__t ?? performance.now()) + 1000 / 30;
        a.tick(a.__t);
        cancelAnimationFrame(a.frame);
      }
      const p = a.state.position,
        w = a.outer?.visitors;
      return {
        world: a.waterWorld,
        x: p.x,
        y: p.y,
        z: p.z,
        outer: !!a.outer,
        outerReady: !!a.outer?.isReady,
        reefReady: !!a.outer?.isReefReady,
        edgeTime: w?.edgeTime ?? 0,
        arrived: w?.arrived ?? 0,
        order: w ? [...w.order] : [],
        shown: w
          ? w.creatures.root.children.filter((c) => c.visible).length
          : 0,
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
  const snapshot = () =>
    page.evaluate(() => {
      const r = window.__cozy.world.renderer;
      return {
        geometries: r.info.memory.geometries,
        textures: r.info.memory.textures,
      };
    });
  /** Through the crevice with W held, until the reef beyond the tunnel is ready. */
  const enterOuter = async () => {
    await place({ x: 6.4, y: 1.6, z: -12.1 }, Math.PI / 2);
    let s = await step(1);
    for (let i = 0; i < 600 && !s.outerReady; i++) s = await step(1);
    assert(s.outerReady, 'the outer waters load near the crevice');
    await page.keyboard.down('w');
    for (let i = 0; i < 400 && s.world !== 'outer'; i++) s = await step(1);
    await page.keyboard.up('w');
    assert.equal(s.world, 'outer', 'swimming through the crevice');
    for (let i = 0; i < 900 && !s.reefReady; i++) s = await step(2);
    assert(s.reefReady, 'the outer reef is prepared');
    return step(1);
  };
  const visits = () =>
    page.evaluate(() => localStorage.getItem('cozy-diver.visits.v1'));
  await step(2);
  report.before = await snapshot();

  // 1. The first visit: nobody passing yet, and the visit is stored.
  let s = await enterOuter();
  report.firstVisit = { order: s.order, stored: await visits() };
  assert.equal(s.arrived, 0, 'nobody is passing on arrival');
  assert.equal(s.shown, 0, 'no visitor is drawn on arrival');
  assert.equal(report.firstVisit.stored, '1', 'the visit is counted');
  assert.equal(s.order[0], 'manta-ray', 'visit 0 opens with the manta');

  // 2. Away from the edge, time there does not count.
  await place({ x: 0, y: 3, z: -40 }, 0);
  s = await step(90);
  assert.equal(s.edgeTime, 0, 'away from the edge, nothing counts');

  // 3. At the edge, looking out: the first visitor comes after `first` seconds, out of sight.
  const edge = { x: -4, y: 1.2, z: -59.4 };
  await place(edge, 0, -0.08);
  let frames = 0;
  while (s.arrived === 0 && frames < 30 * 20) {
    s = await step(1);
    frames++;
  }
  report.firstArrival = { seconds: frames / 30, edgeTime: s.edgeTime };
  assert.equal(s.arrived, 1, 'the first visitor comes at the edge');
  assert(
    Math.abs(report.firstArrival.seconds - 8) < 0.2,
    `the first visitor comes after 8 s (${report.firstArrival.seconds})`,
  );
  await page.screenshot({ path: path.join(output, '1-edge-waiting.png') });

  // 4. Pause: time at the edge does not count.
  await page.keyboard.press('Escape');
  await paused();
  const t0 = (await step(30)).edgeTime;
  s = await step(30);
  assert.equal(s.edgeTime, t0, 'paused, the edge time does not count');
  await page.getByRole('button', { name: /Return to the Water/ }).click();
  await locked();

  /** Follow a visitor (by group) until it passes closest, keeping it in view; photograph it. */
  const watch = async (id, n) => {
    const reveal = await page.evaluate((id) => {
      const w = window.__cozy.outer.visitors,
        e = window.__cozy.state.position;
      return w.creatures.cruisers
        .filter((c) => c.species.id === id)
        .map((c) =>
          Math.hypot(
            c.position.x - e.x,
            c.position.y - e.y,
            c.position.z - e.z,
          ),
        );
    }, id);
    let nearest = Infinity,
      when = 0,
      shot = false;
    for (let f = 0; f < 10 * 120; f++) {
      const d = await page.evaluate((id) => {
        const a = window.__cozy,
          w = a.outer.visitors,
          c = w.creatures.cruisers.find((x) => x.species.id === id),
          e = a.state.position,
          dx = c.position.x - e.x,
          dy = c.position.y - e.y,
          dz = c.position.z - e.z;
        a.controls.yaw = Math.atan2(-dx, -dz);
        a.controls.pitch = Math.atan2(dy, Math.hypot(dx, dz));
        a.controls.clear();
        return Math.hypot(dx, dy, dz);
      }, id);
      // Three frames per look keep the follow quick; the look is re-aimed after each.
      s = await step(3);
      if (d < nearest) {
        nearest = d;
        when = f;
      } else if (!shot && nearest < 14) {
        // Just past its closest: photograph it.
        shot = true;
        await page.screenshot({ path: path.join(output, `${n}-${id}.png`) });
      }
      if (shot && f - when > 10) break;
    }
    if (!shot)
      await page.screenshot({ path: path.join(output, `${n}-${id}.png`) });
    report.visitors[id] = {
      revealDistances: reveal.map((d) => Number(d.toFixed(1))),
      nearest: Number(nearest.toFixed(1)),
    };
    for (const d of reveal)
      assert(d > 16, `${id} appears out of sight (${d.toFixed(1)} m)`);
    assert(nearest < 14, `${id} passes within sight (${nearest.toFixed(1)} m)`);
  };

  // 5. Each in turn: the first that came, then the rest (skipping most of each wait).
  const order = s.order;
  await watch(order[0], 2);
  for (let k = 1; k < order.length; k++) {
    // The school and the great hammerhead pass deeper: wait at the edge a little lower down.
    const deep = order[k] === 'scalloped-hammerhead';
    await place({ ...edge, y: deep ? -7 : 1.2, z: deep ? -59.1 : edge.z }, 0);
    await page.evaluate(
      ([k]) => {
        const w = window.__cozy.outer.visitors;
        // Just before the next is due (8 s, then every 45 s).
        w.edgeTime = Math.max(w.edgeTime, 8 + 45 * k - 0.5);
      },
      [k],
    );
    s = await step(30);
    assert.equal(s.arrived, k + 1, `${order[k]} comes next`);
    await watch(order[k], k + 2);
  }
  report.journal = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem('cozy-diver.journal.v1') ?? '{"seen":[]}',
    ).seen.map((x) => x.id),
  );
  for (const id of order)
    assert(report.journal.includes(`species:${id}`), `${id} is seen`);

  // 6. Back to the tank and in again: a new visit, nobody passing, a different first animal.
  await page.keyboard.press('Escape');
  await paused();
  await page.getByRole('button', { name: /Return to the tank/ }).click();
  await locked();
  s = await step(2);
  assert.equal(s.world, 'aquarium');
  s = await enterOuter();
  report.secondVisit = { order: s.order, stored: await visits() };
  assert.equal(report.secondVisit.stored, '2');
  assert.equal(s.arrived, 0, 'nobody passing on the next visit');
  assert.equal(s.shown, 0);
  assert.notEqual(s.order[0], order[0], 'a different animal comes first');

  // 7. Away from the crevice the outer waters go, and GPU memory returns to its first counts.
  await page.keyboard.press('Escape');
  await paused();
  await page.getByRole('button', { name: /Return to the tank/ }).click();
  await locked();
  await place({ x: -8, y: 5, z: 8 }, 0);
  for (let i = 0; i < 400 && s.outer; i++) s = await step(2);
  assert(!s.outer, 'the outer waters are released');
  await step(4);
  report.after = await snapshot();
  assert.deepEqual(report.after, report.before, 'GPU memory returns');
  assert.deepEqual(report.errors, []);
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 1));
