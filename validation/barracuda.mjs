import { browserScale, recordBrowserScale } from './browser-scale.mjs';
/* v0.6 Pass 042: the barracuda school circling out in the blue, with real input.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy042-barracuda node validation/barracuda.mjs
 *
 * Enters the outer waters through the crevice with W held. On arrival the school is away (not
 * drawn). Brought in on cue (rather than waiting minutes for its chance), it drifts in from the
 * haze and circles beyond the glass: photographed there from the glass, it counts as seen. Then
 * it leaves and is hidden again. Stepped by hand (30 Hz), yielding a real frame each step.
 */
/* Setup adapted from validation/wall-visitors.mjs (Pass 033):
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy042-barracuda node validation/wall-visitors.mjs
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
const output = process.env.COZY_OUTPUT || '/tmp/cozy042-barracuda';
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
        cuda: a.outer?.barracuda?.visit.state ?? null,
        cudaZ: a.outer?.barracuda?.visit.centre.z ?? null,
        cudaDrawn: !!a.outer?.barracuda?.root.children[0]?.visible,
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
  await step(2);
  let s = await enterOuter();
  assert.equal(s.cuda, 'away', 'the barracuda are away on arrival');
  assert.equal(s.cudaDrawn, false, 'and not drawn');
  const edge = { x: 2, y: 2.4, z: -58.6 };
  await place(edge, 0, -0.02);
  await page.evaluate(() => window.__cozy.outer.barracuda.visit.come());
  let frames = 0;
  while (s.cuda !== 'circling' && frames < 30 * 60) {
    s = await step(10);
    frames += 10;
  }
  report.arrival = { seconds: frames / 30, z: s.cudaZ };
  assert.equal(s.cuda, 'circling', 'they drift in and circle');
  assert(s.cudaDrawn, 'drawn while there');
  // Look straight at the column.
  const c = await page.evaluate(() => ({
    ...window.__cozy.outer.barracuda.visit.centre,
  }));
  report.centre = c;
  // Along the glass to just in front of the column, as a swimmer would.
  edge.x = c.x + 2;
  const yaw = Math.atan2(-(c.x - edge.x), -(c.z - edge.z));
  await place(
    edge,
    yaw,
    Math.atan2(c.y - edge.y, Math.hypot(c.x - edge.x, c.z - edge.z)),
  );
  s = await step(30);
  await page.screenshot({ path: path.join(output, '1-circling.png') });
  s = await step(60);
  await page.screenshot({ path: path.join(output, '2-circling-later.png') });
  const journal = await page.evaluate(() =>
    localStorage.getItem('cozy-diver.journal.v1'),
  );
  report.seen = !!journal && journal.includes('species:great-barracuda');
  assert(report.seen, 'looking at them counts them as seen');
  // Send them away.
  await page.evaluate(() => {
    const v = window.__cozy.outer.barracuda.visit;
    v.state = 'leaving';
  });
  frames = 0;
  while (s.cuda !== 'away' && frames < 30 * 60) {
    s = await step(10);
    frames += 10;
  }
  assert.equal(s.cuda, 'away', 'they drift away again');
  assert.equal(s.cudaDrawn, false, 'and are hidden once away');
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
