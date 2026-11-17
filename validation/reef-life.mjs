import { browserScale, recordBrowserScale } from './browser-scale.mjs';
/* v0.6 Pass 043: the outer reef's newer life, with real input (setup as validation/barracuda.mjs).
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy043-reef-life node validation/reef-life.mjs
 *
 * Enters the outer waters through the crevice with W held, then photographs and checks: parrotfish
 * grazing (sand puffs), the blue tang, the humphead wrasse coming for a look, the octopus out and
 * then hidden in its den when approached, and, brought on cue rather than waited for: the
 * bannerfish gathering (the sign), the sunfish being cleaned, the great white passing close to the
 * glass and the bigeye trevally ball. Looking at each counts it as seen. Stepped by hand at
 * 0.1 s per frame, yielding a real frame each step.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy043-reef-life';
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
        a.__t = (a.__t ?? performance.now()) + 100;
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
  await enterOuter();
  const life = (f) => page.evaluate(f);
  const lookAt = async (from, at) => {
    const yaw = Math.atan2(-(at.x - from.x), -(at.z - from.z)),
      pitch = Math.atan2(
        at.y - from.y,
        Math.hypot(at.x - from.x, at.z - from.z),
      );
    await place(from, yaw, pitch);
  };
  const shot = (name) => page.screenshot({ path: path.join(output, name) });
  const from = (p, dx, dy, dz) => ({ x: p.x + dx, y: p.y + dy, z: p.z + dz });
  report.counts = await life(() => {
    const l = window.__cozy.outer.life;
    return {
      parrots: l.grazers.poses.length,
      tang: window.__cozy.outer.schools.fish.simulation.fish.filter(
        (f) => f.species.id === 'blue-tang',
      ).length,
      pairs: window.__cozy.outer.schools.fish.simulation.fish.filter((f) =>
        /butterfly|idol/.test(f.species.id),
      ).length,
    };
  });
  // 1. Parrotfish grazing.
  let p = await life(() => ({
    ...window.__cozy.outer.life.grazers.poses[0].position,
  }));
  await lookAt(from(p, 0, 1.2, 3), p);
  await step(40);
  p = await life(() => ({
    ...window.__cozy.outer.life.grazers.poses[0].position,
  }));
  await lookAt(from(p, 0, 1.2, 3), p);
  await step(30);
  report.puffs = await life(
    () =>
      window.__cozy.outer.life.puffs.root.children.filter((c) => c.visible)
        .length,
  );
  await shot('1-parrotfish.png');
  // 2. Blue tang.
  p = await life(() => {
    const f = window.__cozy.outer.schools.fish.simulation.fish.filter(
      (f) => f.species.id === 'blue-tang',
    );
    return { ...f[0].position };
  });
  await lookAt(from(p, 0, 0.5, 4), p);
  await step(30);
  await shot('2-blue-tang.png');
  // 3. The wrasse comes for a look.
  const eye = { x: -2, y: 4, z: -44 };
  await place(eye, 0, 0);
  let mood = '';
  for (let i = 0; i < 40 && mood !== 'look'; i++) {
    await step(10);
    mood = await life(() => window.__cozy.outer.life.wrasse.mood);
  }
  report.wrasse = mood;
  p = await life(() => ({ ...window.__cozy.outer.life.wrasse.pose.position }));
  await lookAt(eye, p);
  await step(10);
  await shot('3-wrasse.png');
  // 4. The octopus: out, then hidden when approached.
  const den = await life(() => ({
    ...window.__cozy.outer.life.octopus.mind.den,
  }));
  await lookAt(from(den, 0, 1.4, 3.2), den);
  await step(20);
  await shot('4-octopus.png');
  await lookAt(from(den, 0, 0.6, 1.4), den);
  await step(40);
  report.octopus = await life(() => window.__cozy.outer.life.octopus.mind.mood);
  await shot('5-octopus-hidden.png');
  // 5. The cleaning station: bannerfish gather (the sign), then the sunfish rises and is cleaned.
  const station = await life(() => {
    const c = window.__cozy.outer.life.cleaning;
    c.begin();
    return { ...c.station };
  });
  const glassEye = { x: station.x, y: station.y + 0.5, z: -58.6 };
  await lookAt(glassEye, station);
  await step(100);
  report.gathering = await life(() => window.__cozy.outer.life.cleaning.state);
  await shot('6-bannerfish-gathering.png');
  let state = '';
  for (let i = 0; i < 80 && state !== 'cleaning'; i++) {
    await step(10);
    state = await life(() => window.__cozy.outer.life.cleaning.state);
  }
  report.cleaning = state;
  const sun = await life(() => ({
    ...window.__cozy.outer.life.cleaning.sunfish.pose.position,
  }));
  await lookAt({ x: sun.x, y: sun.y, z: -58.6 }, sun);
  await step(40);
  await shot('7-sunfish-cleaning.png');
  // 6. A great white passes close by the glass.
  await life(() => window.__cozy.outer.life.greatWhite.begin());
  await place({ x: 0, y: 0.5, z: -58.6 }, 0, 0);
  let gx = 99;
  for (let i = 0; i < 120 && Math.abs(gx) > 4; i++) {
    await step(10);
    gx = await life(
      () => window.__cozy.outer.life.greatWhite.swim.pose.position.x,
    );
  }
  const gw = await life(() => ({
    ...window.__cozy.outer.life.greatWhite.swim.pose.position,
  }));
  report.greatWhite = gw;
  await lookAt({ x: 0, y: gw.y + 0.3, z: -58.6 }, gw);
  await step(6);
  await shot('8-great-white.png');
  // 7. The bigeye trevally ball.
  await life(() => window.__cozy.outer.life.trevally.come());
  state = '';
  for (let i = 0; i < 80 && state !== 'circling'; i++) {
    await step(10);
    state = await life(() => window.__cozy.outer.life.trevally.state);
  }
  report.trevally = state;
  const ball = await life(() => ({
    ...window.__cozy.outer.life.trevally.centre,
  }));
  await lookAt({ x: ball.x + 1, y: ball.y, z: -58.6 }, ball);
  await step(40);
  await shot('9-trevally.png');
  const journal =
    (await page.evaluate(() =>
      localStorage.getItem('cozy-diver.journal.v1'),
    )) ?? '';
  report.seen = [
    'parrotfish',
    'blue-tang',
    'humphead-wrasse',
    'octopus',
    'longfin-bannerfish',
    'ocean-sunfish',
    'great-white-shark',
    'bigeye-trevally',
  ].filter((id) => journal.includes(`species:${id}`));
  assert.equal(report.wrasse, 'look', 'the wrasse comes for a look');
  assert.equal(report.octopus, 'hidden', 'the octopus hides when approached');
  assert.equal(report.gathering, 'gathering', 'the bannerfish gather first');
  assert.equal(report.cleaning, 'cleaning', 'the sunfish is cleaned');
  assert.equal(report.trevally, 'circling', 'the trevally circle');
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
