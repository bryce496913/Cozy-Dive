import { browserScale, recordBrowserScale } from './browser-scale.mjs';
/* v0.6 Pass 040: the kelp forest's sea lion and the sea cave, with real input.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy040-cave node validation/sea-cave.mjs
 *
 * Starts with an empty journal and enters the water with real pointer lock. Holding W swims
 * through the tank's crevice into the outer reef, then (once placed by the cleft) through the
 * cleft into the kelp forest. Then:
 *   - the sea lion comes over to a waiting swimmer and circles them, never closer than its
 *     personal distance; looking at it counts it as seen; it is still while paused;
 *   - placed west of the grotto, the sea cave loads; holding W swims through the grotto and,
 *     past its threshold, on into the sea cave's tunnel at equal darkness, and out into the cave;
 *   - the resting whitetips, sweepers and lobsters are there; a lobster backs into its crack
 *     when the swimmer comes close; looking round counts the cave as seen;
 *   - "Return to the tank" goes home from the cave; far from the crevice all three outer worlds
 *     are released and GPU memory returns to its first counts.
 * The loop is stepped by hand (30 Hz).
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy040-cave';
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
  /** Turn the swimmer's look towards a point (yaw and pitch). */
  const lookAt = (p) =>
    page.evaluate((p) => {
      const a = window.__cozy,
        e = a.state.position;
      a.controls.yaw = Math.atan2(-(p.x - e.x), -(p.z - e.z));
      a.controls.pitch = Math.atan2(
        p.y - e.y,
        Math.hypot(p.x - e.x, p.z - e.z),
      );
      a.controls.clear();
    }, p);
  const snapshot = () =>
    page.evaluate(() => {
      const r = window.__cozy.world.renderer;
      return {
        geometries: r.info.memory.geometries,
        textures: r.info.memory.textures,
      };
    });
  const journal = () =>
    page.evaluate(() =>
      JSON.parse(
        localStorage.getItem('cozy-diver.journal.v1') ?? '{"seen":[]}',
      ).seen.map((s) => s.id),
    );
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

  // 2. The sea lion: wait a few metres from it, and it comes over to play.
  const lion = () =>
    page.evaluate(() => {
      const l = window.__cozy.kelp.seaLion.swimmer,
        e = window.__cozy.state.position;
      return {
        mood: l.mood,
        x: l.position.x,
        y: l.position.y,
        z: l.position.z,
        d: Math.hypot(
          l.position.x - e.x,
          l.position.y - e.y,
          l.position.z - e.z,
        ),
      };
    });
  let l = await lion();
  await place({ x: l.x + 8, y: Math.max(4, l.y), z: l.z }, Math.PI / 2);
  let closest = Infinity;
  for (let i = 0; i < 30 * 40 && l.mood !== 'play'; i++) {
    await step(1);
    l = await lion();
  }
  report.seaLionCame = l.mood === 'play';
  assert(report.seaLionCame, 'the sea lion comes over to play');
  for (let i = 0; i < 30 * 8; i++) {
    await lookAt(l);
    await step(1);
    l = await lion();
    closest = Math.min(closest, l.d);
  }
  report.seaLionClosest = Number(closest.toFixed(2));
  assert(closest >= 1.79, `it keeps its distance (${closest.toFixed(2)} m)`);
  await page.screenshot({ path: path.join(output, '1-sea-lion.png') });
  await page.keyboard.press('Escape');
  await paused();
  const still = await lion();
  await step(30);
  const after = await lion();
  assert.equal(after.x, still.x, 'the sea lion is still while paused');
  await page.getByRole('button', { name: /Return to the Water/ }).click();
  await locked();

  // 3. The grotto: west of its mouth, the sea cave loads; W through it into the cave.
  await place({ x: 16.5, y: 2.9, z: -10 }, -Math.PI / 2);
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

  // 4. The cave's life: whitetips resting, sweepers schooling, and a lobster that hides.
  report.cave = await page.evaluate(() => {
    const c = window.__cozy.cave;
    return {
      resting: c.resting?.root.children.length ?? 0,
      sweepers: c.schools.fish.simulation.fish.length,
      cruising: c.creatures?.cruisers.length ?? 0,
      lobsters: c.lobsters.sightings.length,
    };
  });
  assert.equal(report.cave.resting, 3, 'three whitetips rest on the sand');
  assert(report.cave.sweepers > 30, 'the sweepers are there');
  const lobsterZ = () =>
    page.evaluate(() => {
      const b = window.__cozy.cave.lobsters.root.children[0];
      return [b.instanceMatrix.array[12], b.instanceMatrix.array[14]];
    });
  const crack = await page.evaluate(() => {
    // The first lobster's crack, and the way it faces out of it.
    const l = window.__cozy.cave.lobsters.lobsters[0].spot;
    return { x: l.x, y: l.y, z: l.z, yaw: l.yaw };
  });
  const out = await lobsterZ();
  // In front of its crack, a metre and a half out and a little above.
  await place(
    {
      x: crack.x + Math.sin(crack.yaw) * 1.5,
      y: crack.y + 0.9,
      z: crack.z + Math.cos(crack.yaw) * 1.5,
    },
    0,
  );
  await lookAt(crack);
  await step(30);
  const hidden = await lobsterZ();
  report.lobsterBackedIn = Number(
    Math.hypot(hidden[0] - out[0], hidden[1] - out[1]).toFixed(2),
  );
  assert(report.lobsterBackedIn > 0.3, 'the lobster backs into its crack');
  await page.screenshot({ path: path.join(output, '3-lobster.png') });
  // Look round the cave for a moment from its middle.
  await place({ x: 0, y: 4, z: -22 }, 0);
  for (let i = 0; i < 4; i++) {
    await page.evaluate((i) => {
      window.__cozy.controls.yaw = (i * Math.PI) / 2;
      window.__cozy.controls.clear();
    }, i);
    await step(45);
  }
  report.journal = await journal();
  for (const id of [
    'species:california-sea-lion',
    'place:sea-cave',
    'species:spiny-lobster',
  ])
    assert(report.journal.includes(id), `${id} is seen`);

  // 5. Home from the cave; far from the crevice, all three outer worlds are released.
  await page.keyboard.press('Escape');
  await paused();
  await page.getByRole('button', { name: /Return to the tank/ }).click();
  await locked();
  s = await step(2);
  assert.equal(s.world, 'aquarium', 'back in the tank');
  await place({ x: -8, y: 5, z: 8 }, 0);
  for (let i = 0; i < 400 && (s.outer || s.kelp || s.cave); i++)
    s = await step(2);
  report.released = !s.outer && !s.kelp && !s.cave;
  assert(report.released, 'the outer reef, kelp forest and cave are released');
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
