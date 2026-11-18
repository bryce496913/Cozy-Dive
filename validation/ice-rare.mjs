import { browserScale, recordBrowserScale } from './browser-scale.mjs';
/* v0.6 Pass 048: rare encounters under the ice, with real input (entry as validation/ice-life.mjs).
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy048-ice-rare node validation/ice-rare.mjs
 *
 * After swimming in under the ice, checks that no encounter has come at once, then brings each in
 * turn on cue (rather than waiting for its chance) and photographs it at its moment for visual
 * review: the leopard seal looking, the minke's pass, the killer whales, the toothfish hanging,
 * the squid's eyes glowing, the polar bear paddling and diving. Each leaves; each counts as seen.
 * (The Pass 047 description follows.)
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy048-ice-rare node validation/ice-life.mjs
 *
 * After swimming in under the ice, photographs each animal for visual review (see
 * docs/VALIDATION_V06_PASS_047.md's checklist): an emperor penguin's dive (on cue), the Adélie
 * group, the Weddell seal at its hole (and breathing, on cue), icefish, notothens, the krill swarm
 * (and swimming into it, which parts it), sea spiders, a ribbon worm, sea butterflies and comb
 * jellies. Checks that each counts as seen and that there are no page errors.
 * (The Pass 046 description follows.)
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy048-ice-rare node validation/under-ice.mjs
 *
 * Swims tank → outer reef → kelp forest → grotto → sea cave, then to the cave's back tunnel: the
 * waters under the ice load, and holding W swims through the tunnel (equal darkness either side of
 * the swap) and out into the iceberg tank. Photographs it (out of the tunnel, the ice above with a
 * breathing hole's light, the garden, an iceberg wall), checks that the swimmer stops short of an
 * iceberg and the ice, that looking round counts the place and its garden as seen, and swims back
 * into the cave. (The original Pass 045 description follows.)
 *
 * Swims tank → outer reef → kelp forest → grotto → sea cave, then photographs and checks: the
 * moray in its crack in the wall, the flashlight fish's lights blinking in the dark corner, the
 * nurse shark asleep under its ledge, the turtle asleep (then, on cue, rising up the sunbeam to
 * breathe), a soldierfish at the cleaner shrimps (on cue), the octopus hiding in its den, and a
 * lionfish fanning out at the swimmer. Looking at each counts it as seen.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy048-ice-rare';
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

  // 1. Tank → outer reef → kelp forest, with W held through each passage.
  await place({ x: 6.4, y: 1.6, z: -12.1 }, Math.PI / 2);
  let s = await step(1);
  for (let i = 0; i < 600 && !s.outerReady; i++) s = await step(1);
  await page.keyboard.down('w');
  for (let i = 0; i < 400 && s.world !== 'outer'; i++) s = await step(1);
  await page.keyboard.up('w');
  assert.equal(s.world, 'outer', 'through the crevice');
  for (let i = 0; i < 900 && !s.reefReady; i++) s = await step(2);
  assert(s.reefReady, 'the outer reef is prepared');
  await place({ x: -17.6, y: 1.3, z: -32 }, -Math.PI / 2);
  s = await step(2);
  for (let i = 0; i < 900 && !s.kelpReady; i++) s = await step(2);
  assert(s.kelpReady, 'the kelp forest is ready');
  await page.keyboard.down('w');
  for (let i = 0; i < 400 && s.world !== 'kelp'; i++) s = await step(1);
  await page.keyboard.up('w');
  assert.equal(s.world, 'kelp', 'through the cleft');

  // 3. The grotto: west of its mouth, the sea cave loads; W through it into the cave.
  // The tank's crevice approach, turned into the forest by `grottoFromTank`.
  await place({ x: 15.1, y: 2.8, z: -10 }, -Math.PI / 2);
  s = await step(2);
  assert(s.cave, 'the sea cave starts loading near the grotto');
  for (let i = 0; i < 900 && !s.caveReady; i++) s = await step(2);
  assert(s.caveReady, 'the sea cave is ready');
  let last = s;
  await page.keyboard.down('w');
  for (let i = 0; i < 400 && s.world !== 'cave'; i++) {
    last = s;
    s = await step(1);
  }
  report.swap = { before: last.dark, after: s.dark };
  assert.equal(s.world, 'cave', 'through the grotto into the sea cave');
  assert(Math.abs(s.dark - last.dark) < 0.1, 'equal darkness either side');
  for (let i = 0; i < 900 && s.z > -12; i++) s = await step(1);
  await page.keyboard.up('w');
  assert(s.z < -11, 'out of the tunnel into the cave');
  await page.screenshot({ path: path.join(output, '2-cave.png') });

  const shot = (name) => page.screenshot({ path: path.join(output, name) });
  const aim = async (from, at) => {
    const yaw = Math.atan2(-(at.x - from.x), -(at.z - from.z)),
      pitch = Math.atan2(
        at.y - from.y,
        Math.hypot(at.x - from.x, at.z - from.z),
      );
    await place(from, yaw, pitch);
  };
  const where = () =>
    page.evaluate(() => ({
      world: window.__cozy.waterWorld,
      ice: !!window.__cozy.ice,
      iceReady: !!window.__cozy.ice?.isReady,
      ...window.__cozy.state.position,
      dark: Number(
        getComputedStyle(document.querySelector('.passage-veil')).opacity,
      ),
    }));
  // 5. To the back tunnel: the waters under the ice load.
  await place({ x: -3, y: 3.2, z: -33 }, 0, 0);
  await step(4);
  await shot('1-back-tunnel.png');
  let w = await where();
  for (let i = 0; i < 900 && !w.iceReady; i++) {
    await step(2);
    w = await where();
  }
  report.iceLoaded = w.iceReady;
  assert(w.iceReady, 'the waters under the ice load by the back tunnel');
  // 6. W through the tunnel.
  let prev = w;
  await page.keyboard.down('w');
  for (let i = 0; i < 600 && w.world !== 'ice'; i++) {
    prev = w;
    await step(1);
    w = await where();
  }
  report.swap = { before: prev.dark, after: w.dark };
  assert.equal(w.world, 'ice', 'through the back tunnel under the ice');
  assert(Math.abs(w.dark - prev.dark) < 0.1, 'equal darkness either side');
  for (let i = 0; i < 900 && w.z > -12; i++) {
    await step(1);
    w = await where();
  }
  await page.keyboard.up('w');
  assert(w.z < -11, 'out of the tunnel into the ice tank');
  await page.evaluate(() => {
    window.__stepMs = 100;
  });
  await step(10);
  await shot('2-under-the-ice.png');
  const life = (f, arg) => page.evaluate(f, arg);
  await life(() => window.__cozy.ice.prepared);
  report.atArrival = await life(
    () => window.__cozy.ice.rare.director.current?.id ?? null,
  );
  const eye = { x: 0, y: 6, z: -16 };
  report.encounters = {};
  for (const [id, moment] of [
    ['leopard-seal', 'look'],
    ['minke-whale', 'pass'],
    ['killer-whales', 'pass'],
    ['toothfish', 'hang'],
    ['colossal-squid', null],
    ['polar-bear', 'paddle'],
  ]) {
    await place(eye, 0, 0);
    const began = await life(
      ([id, e]) => window.__cozy.ice.rare.director.bring(id, e),
      [id, eye],
    );
    let state = { mood: null, active: began };
    for (
      let i = 0;
      i < 80 && state.active && moment && state.mood !== moment;
      i++
    ) {
      await step(5);
      state = await life(
        (id) => ({
          mood: window.__cozy.ice.rare.director.encounters[id].mood ?? null,
          active: window.__cozy.ice.rare.director.encounters[id].active,
        }),
        id,
      );
    }
    if (id === 'colossal-squid') await step(50);
    const p = await life(
      (id) => ({
        ...window.__cozy.ice.rare.director.encounters[id].poses[0].position,
      }),
      id,
    );
    await aim(eye, p);
    await step(20);
    await shot(`${id}.png`);
    // Then it leaves.
    let gone = false;
    for (let i = 0; i < 400 && !gone; i++) {
      await step(10);
      gone = !(await life(
        (id) => window.__cozy.ice.rare.director.encounters[id].active,
        id,
      ));
    }
    report.encounters[id] = { began, moment: state.mood, left: gone };
  }
  const journal =
    (await page.evaluate(() =>
      localStorage.getItem('cozy-diver.journal.v1'),
    )) ?? '';
  report.seen = [
    'leopard-seal',
    'minke-whale',
    'killer-whale',
    'antarctic-toothfish',
    'colossal-squid',
    'polar-bear',
  ].filter((id) => journal.includes(`species:${id}`));
  assert.equal(report.atArrival, null, 'nothing rare at once on arrival');
  for (const [id, r] of Object.entries(report.encounters)) {
    assert(r.began, `${id} comes`);
    assert(r.left, `${id} leaves`);
  }
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
