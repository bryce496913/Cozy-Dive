import { browserScale, recordBrowserScale } from './browser-scale.mjs';
/* v0.6 Pass 045: the sea cave's newer life, with real input (entry as validation/sea-cave.mjs).
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy045-cave-life node validation/cave-life.mjs
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
const output = process.env.COZY_OUTPUT || '/tmp/cozy045-cave-life';
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

  await page.evaluate(() => {
    window.__stepMs = 100;
  });
  const life = (f) => page.evaluate(f);
  const aim = async (from, at) => {
    const yaw = Math.atan2(-(at.x - from.x), -(at.z - from.z)),
      pitch = Math.atan2(
        at.y - from.y,
        Math.hypot(at.x - from.x, at.z - from.z),
      );
    await place(from, yaw, pitch);
  };
  const shot = (name) => page.screenshot({ path: path.join(output, name) });
  const out = (p, d, dir, dy = 0) => ({
    x: p.x + dir.x * d,
    y: p.y + dy,
    z: p.z + dir.z * d,
  });
  const nooks = await life(() =>
    JSON.parse(JSON.stringify(window.__cozy.cave.nooks)),
  );
  // 1. The moray in its crack.
  const mo = nooks.moray;
  await aim(out(mo.mouth, 3, mo.axis, 0.4), mo.mouth);
  await step(60);
  await shot('1-moray.png');
  // 2. Flashlight fish in the dark corner.
  let p = await life(() => {
    const f = window.__cozy.cave.schools.fish.simulation.fish.find(
      (f) => f.species.id === 'flashlight-fish',
    );
    return { ...f.position };
  });
  await aim({ x: p.x + 3, y: p.y + 0.4, z: p.z + 2.5 }, p);
  await step(20);
  report.glows = await life(
    () => window.__cozy.cave.visitors.glowMesh?.count ?? 0,
  );
  await shot('2-flashlight-fish.png');
  // 3. The nurse shark under its ledge.
  const ns = nooks.nurse.at,
    inward = { x: -Math.sin(nooks.ledge.yaw), z: -Math.cos(nooks.ledge.yaw) };
  // In front of the ledge, low, looking under it.
  const front = {
    x: ns.x + (0 - ns.x) * 0.25,
    y: ns.y + 0.6,
    z: ns.z + (-23 - ns.z) * 0.25,
  };
  await aim(front, ns);
  await step(10);
  await shot('3-nurse-shark.png');
  report.inward = inward;
  // 4. The sleeping turtle, then up to breathe.
  const bed = nooks.turtle.bed;
  await aim({ x: bed.x + 2.5, y: bed.y + 1.2, z: bed.z + 2 }, bed);
  await step(10);
  await shot('4-turtle-asleep.png');
  await life(() => window.__cozy.cave.visitors.turtle.wake());
  let mood = '';
  for (let i = 0; i < 50 && mood !== 'breathing'; i++) {
    await step(10);
    mood = await life(() => window.__cozy.cave.visitors.turtle.mood);
  }
  report.turtle = mood;
  p = await life(() => ({
    ...window.__cozy.cave.visitors.turtle.pose.position,
  }));
  await aim({ x: p.x + 3, y: p.y - 3, z: p.z + 3 }, p);
  await step(4);
  await shot('5-turtle-breathing.png');
  // 5. A soldierfish at the cleaners.
  const st = nooks.station;
  await life(() => window.__cozy.cave.visitors.cleaning.call());
  mood = '';
  for (let i = 0; i < 40 && mood !== 'cleaning'; i++) {
    await step(10);
    mood = await life(() => window.__cozy.cave.visitors.cleaning.mood);
  }
  report.cleaning = mood;
  await aim(out(st.patch, 1.6, st.out, 0.3), st.patch);
  await step(30);
  await shot('6-cleaner-shrimps.png');
  // 6. The octopus: out, then hidden when approached.
  const octo = () =>
    life(() => ({ ...window.__cozy.cave.visitors.octopus.mind.position }));
  let o = await octo();
  await aim({ x: o.x + 2.5, y: o.y + 1.4, z: o.z + 1.5 }, o);
  await step(10);
  await shot('7-octopus.png');
  for (let i = 0; i < 6; i++) {
    o = await octo();
    await aim({ x: o.x + 1, y: o.y + 0.6, z: o.z + 0.8 }, o);
    await step(8);
  }
  await step(30);
  report.octopus = await life(
    () => window.__cozy.cave.visitors.octopus.mind.mood,
  );
  // 7. A lionfish fans out.
  const lf = nooks.lionfish[0].at;
  await aim({ x: lf.x + 1.4, y: lf.y + 0.6, z: lf.z + 1.2 }, lf);
  await step(20);
  report.lionfish = await life(
    () => window.__cozy.cave.visitors.lionfish[0].spread,
  );
  await shot('8-lionfish.png');
  const seenJournal =
    (await page.evaluate(() =>
      localStorage.getItem('cozy-diver.journal.v1'),
    )) ?? '';
  report.seen = [
    'moray-eel',
    'flashlight-fish',
    'nurse-shark',
    'green-sea-turtle',
    'cleaner-shrimp',
    'octopus',
    'lionfish',
  ].filter((id) => seenJournal.includes(`species:${id}`));
  assert(report.glows > 0, 'the flashlight fish have lights');
  assert.equal(report.turtle, 'breathing', 'the turtle rises to breathe');
  assert.equal(report.cleaning, 'cleaning', 'a fish is cleaned');
  assert.equal(report.octopus, 'hidden', 'the octopus hides');
  assert(report.lionfish > 0.8, 'the lionfish fans out');
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
