import { browserScale, recordBrowserScale } from './browser-scale.mjs';
/* v0.6 Pass 044: the kelp forest's newer life, with real input (entry as validation/kelp-forest.mjs).
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy044-kelp-life node validation/kelp-life.mjs
 *
 * Swims through the tank's crevice, the outer reef's cleft and the tunnel into the kelp forest,
 * then photographs and checks: the sea otter floating at the surface (seen from below), leopard
 * sharks low over the sand, the sheephead at the urchins, a Spanish shawl and a kelp crab, the
 * harbour seal watching from a distance, and, brought on cue: the giant sea bass cruising past and
 * a gull diving in to peck at the sand. Looking at each counts it as seen.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy044-kelp-life';
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
  const snapshot = () =>
    page.evaluate(() => {
      const r = window.__cozy.world.renderer;
      return {
        geometries: r.info.memory.geometries,
        textures: r.info.memory.textures,
      };
    });
  await step(2);
  report.before = await snapshot();

  // 1. Through the tank's crevice into the outer waters, with W held.
  await place({ x: 6.4, y: 1.6, z: -12.1 }, Math.PI / 2);
  let s = await step(1);
  for (let i = 0; i < 600 && !s.outerReady; i++) s = await step(1);
  assert(s.outerReady, 'the outer waters load near the crevice');
  await page.keyboard.down('w');
  for (let i = 0; i < 400 && s.world !== 'outer'; i++) s = await step(1);
  await page.keyboard.up('w');
  assert.equal(
    s.world,
    'outer',
    'swimming through the crevice reaches the outer waters',
  );
  for (let i = 0; i < 900 && !s.reefReady; i++) s = await step(2);
  assert(s.reefReady, 'the outer reef is prepared');

  // 2. West of the cleft at the cliff's foot, facing its mouth: the kelp forest loads.
  await place({ x: -17.6, y: 1.3, z: -32 }, -Math.PI / 2);
  s = await step(2);
  report.kelpPreloaded = s.kelp;
  assert(s.kelp, 'the kelp forest starts loading near the cleft');
  await page.screenshot({ path: path.join(output, '1-cleft.png') });
  const loadStart = Date.now();
  for (let i = 0; i < 900 && !s.kelpReady; i++) s = await step(2);
  report.kelpReadyMs = Date.now() - loadStart;
  assert(s.kelpReady, 'the kelp forest is ready');

  // 3. W through the cleft: the swap happens at the darkest point, with nothing jumping.
  let last = s;
  await page.keyboard.down('w');
  for (let i = 0; i < 400 && s.world !== 'kelp'; i++) {
    last = s;
    s = await step(1);
    if (s.world !== 'kelp' && s.dark > 0.85)
      await page.screenshot({ path: path.join(output, '2-before-swap.png') });
  }
  await page.screenshot({ path: path.join(output, '3-after-swap.png') });
  report.swap = { before: last, after: s };
  assert.equal(
    s.world,
    'kelp',
    'swimming through the cleft reaches the kelp forest',
  );
  assert(
    Math.abs(s.dark - last.dark) < 0.1,
    'equal darkness either side of the swap',
  );
  // On through the tunnel and out into the forest.
  for (let i = 0; i < 900 && s.z > -12; i++) s = await step(1);
  await page.keyboard.up('w');
  assert(s.z < -11, 'the tunnel opens into the forest');
  report.inForest = { x: s.x, y: s.y, z: s.z };
  await page.screenshot({ path: path.join(output, '4-forest.png') });

  // In the forest, step 0.1 s a frame so the slow animals arrive within the run.
  await page.evaluate(() => {
    window.__stepMs = 100;
  });
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
  const at = (expr) => life(new Function(`return {...(${expr})}`));
  // 1. The otter at the surface, seen from below.
  let p = await at('window.__cozy.kelp.visitors.otter.pose.position');
  await lookAt(from(p, 0, -10, 5), p);
  await step(20);
  await shot('1-otter.png');
  // 2. A leopard shark.
  p = await life(() => {
    const c = window.__cozy.kelp.creatures.cruisers.find(
      (c) => c.species.id === 'leopard-shark',
    );
    return { ...c.position };
  });
  await lookAt(from(p, 0, 1.4, 3.5), p);
  await step(4);
  await shot('2-leopard-shark.png');
  // 3. A sheephead at the urchins.
  p = await at('window.__cozy.kelp.visitors.sheephead.poses[0].position');
  await lookAt(from(p, 0, 1, 2.5), p);
  await step(30);
  p = await at('window.__cozy.kelp.visitors.sheephead.poses[0].position');
  await lookAt(from(p, 0, 1, 2.5), p);
  await step(20);
  await shot('3-sheephead.png');
  // 4. A Spanish shawl and a kelp crab.
  p = await at('window.__cozy.kelp.visitors.critters.sightings[0].position');
  await lookAt(from(p, 0, 0.5, 0.9), p);
  await step(20);
  await shot('4-nudibranch.png');
  p = await life(() => {
    const s = window.__cozy.kelp.visitors.critters.sightings.find(
      (s) => s.id === 'species:kelp-crab',
    );
    return { ...s.position };
  });
  await lookAt(from(p, 0, 0.3, 1.1), p);
  await step(20);
  await shot('5-kelp-crab.png');
  // 5. The seal watches from a distance.
  await life(() => {
    window.__cozy.kelp.visitors.seal.rest = 0;
  });
  p = await at('window.__cozy.kelp.visitors.seal.pose.position');
  await lookAt({ x: p.x, y: p.y, z: p.z + 11 }, p);
  let mood = '';
  for (let i = 0; i < 40 && mood !== 'watch'; i++) {
    await step(5);
    mood = await life(() => window.__cozy.kelp.visitors.seal.mood);
  }
  report.seal = mood;
  await step(60);
  const e2 = await life(() => ({ ...window.__cozy.state.position }));
  p = await at('window.__cozy.kelp.visitors.seal.pose.position');
  report.sealDistance = Math.hypot(p.x - e2.x, p.y - e2.y, p.z - e2.z);
  await lookAt(e2, p);
  await step(4);
  await shot('6-seal.png');
  // 6. The giant sea bass cruises past.
  await place({ x: 0, y: 6, z: -32 }, 0, 0);
  await life(() =>
    window.__cozy.kelp.visitors.seaBass.begin({
      position: window.__cozy.state.position,
      velocity: { x: 0, y: 0, z: 0 },
      active: true,
    }),
  );
  let closest = Infinity;
  for (let i = 0; i < 60; i++) {
    await step(10);
    const b = await at(
      'window.__cozy.kelp.visitors.seaBass.swim.pose.position',
    );
    const d = Math.hypot(b.x, b.y - 6, b.z + 32);
    if (d < closest) closest = d;
    if (d < 7) {
      await lookAt({ x: 0, y: 6, z: -32 }, b);
      await step(2);
      await shot('7-giant-sea-bass.png');
      break;
    }
  }
  report.seaBassClosest = closest;
  // 7. A gull dives in to peck at the sand.
  await place({ x: 0, y: 4, z: -30 }, 0, -0.3);
  await life(() =>
    window.__cozy.kelp.visitors.gull.begin(window.__cozy.state.position),
  );
  mood = '';
  for (let i = 0; i < 60 && mood !== 'peck'; i++) {
    await step(5);
    mood = await life(() => window.__cozy.kelp.visitors.gull.mood);
  }
  report.gull = mood;
  p = await at('window.__cozy.kelp.visitors.gull.swim.pose.position');
  await lookAt({ x: 0, y: 4, z: -30 }, p);
  await step(8);
  await shot('8-gull.png');
  const journal =
    (await page.evaluate(() =>
      localStorage.getItem('cozy-diver.journal.v1'),
    )) ?? '';
  report.seen = [
    'sea-otter',
    'leopard-shark',
    'california-sheephead',
    'spanish-shawl',
    'kelp-crab',
    'harbour-seal',
    'giant-sea-bass',
    'western-gull',
  ].filter((id) => journal.includes(`species:${id}`));
  assert.equal(report.seal, 'watch', 'the seal watches');
  assert(report.sealDistance > 5, 'from a distance');
  assert(report.seaBassClosest < 7, 'the sea bass passes close');
  assert.equal(report.gull, 'peck', 'the gull pecks at the sand');
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
