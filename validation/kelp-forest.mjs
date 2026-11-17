import { browserScale, recordBrowserScale } from './browser-scale.mjs';
/* v0.6 Pass 032: the kelp forest, through both passages, with real input.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy032-kelp node validation/kelp-forest.mjs
 *
 * Starts with an empty journal and enters the water with real pointer lock. Holding W swims
 * through the tank's crevice into the outer waters; once the reef is ready, the swimmer is placed
 * west of the cleft at the cliff's foot, where the kelp forest loads. Holding W again swims
 * through the cleft and, past its threshold, continues in the kelp forest's tunnel without a break
 * (equal darkness either side). It swims out into the forest, where the kelp sways (and is still
 * on pause), garibaldi and bat rays move, and looking at them counts them as seen. "Return to the
 * tank" goes home from the kelp forest; far from the crevice, both outer worlds are released and
 * GPU memory returns to its first counts. The loop is stepped by hand (30 Hz).
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy032-kelp';
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

  // 4. The forest lives: kelp sways on simulation time and is still while paused.
  const sway = () => page.evaluate(() => window.__cozy.kelp.stalks.swayTime);
  const t0 = await sway();
  await step(30);
  const t1 = await sway();
  assert(t1 > t0, 'the kelp sways');
  const life0 = await page.evaluate(() => {
    const k = window.__cozy.kelp;
    return {
      // Garibaldi only (Pass 035 added kelp bass to the same fish system).
      fish: k.schools.fish.simulation.fish
        .filter((f) => f.species.id === 'garibaldi')
        .map((f) => ({ ...f.position })),
      rays: k.creatures.cruisers.map((c) => ({ ...c.position })),
    };
  });
  await step(60);
  const life1 = await page.evaluate(() => {
    const k = window.__cozy.kelp;
    return {
      // Garibaldi only (Pass 035 added kelp bass to the same fish system).
      fish: k.schools.fish.simulation.fish
        .filter((f) => f.species.id === 'garibaldi')
        .map((f) => ({ ...f.position })),
      rays: k.creatures.cruisers.map((c) => ({ ...c.position })),
    };
  });
  const moved = (a, b) =>
    a.filter(
      (p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y, p.z - b[i].z) > 0.05,
    ).length;
  report.life = {
    garibaldi: life0.fish.length,
    garibaldiMoved: moved(life0.fish, life1.fish),
    rays: life0.rays.length,
    raysMoved: moved(life0.rays, life1.rays),
  };
  assert.equal(report.life.garibaldi, 20);
  assert(report.life.garibaldiMoved > 10, 'garibaldi move');
  assert.equal(report.life.raysMoved, report.life.rays, 'every bat ray moves');
  await page.keyboard.press('Escape');
  await paused();
  const t2 = await sway();
  await step(30);
  assert.equal(await sway(), t2, 'the kelp is still while paused');
  await page.getByRole('button', { name: /Return to the Water/ }).click();
  await locked();

  // 5. Seen: a garibaldi, a bat ray and the kelp (looked at from nearby for a moment).
  const lookAt = async (target) => {
    const p = await page.evaluate((target) => {
      const k = window.__cozy.kelp,
        c =
          target === 'ray'
            ? k.creatures.cruisers[0].position
            : target === 'fish'
              ? k.schools.fish.simulation.fish[0].position
              : // A spot where the kelp counts as seen (on a stalk near the tunnel's exit).
                k.sightings.find((s) => s.id === 'plant:giant-kelp').position;
      return { x: c.x, y: c.y, z: c.z };
    }, target);
    const back = target === 'ray' ? 5 : 3;
    await place({ x: p.x, y: p.y + 0.5, z: p.z + back }, 0, -0.1);
    for (let i = 0; i < 90; i++) {
      await page.evaluate(
        (p) => {
          const a = window.__cozy,
            e = a.state.position;
          a.controls.yaw = Math.atan2(-(p.x - e.x), -(p.z - e.z));
          a.controls.pitch = Math.atan2(
            p.y - e.y,
            Math.hypot(p.x - e.x, p.z - e.z),
          );
          a.controls.clear();
        },
        target === 'kelp'
          ? p
          : await page.evaluate((target) => {
              const k = window.__cozy.kelp,
                c =
                  target === 'ray'
                    ? k.creatures.cruisers[0].position
                    : k.schools.fish.simulation.fish[0].position;
              return { x: c.x, y: c.y, z: c.z };
            }, target),
      );
      await step(1);
    }
  };
  for (const t of ['fish', 'ray', 'kelp']) await lookAt(t);
  await page.screenshot({ path: path.join(output, '5-sighting.png') });
  report.journal = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem('cozy-diver.journal.v1') ?? '{"seen":[]}',
    ).seen.map((s) => s.id),
  );
  for (const id of ['species:garibaldi', 'species:bat-ray', 'plant:giant-kelp'])
    assert(report.journal.includes(id), `${id} is seen`);

  // 6. "Return to the tank" from the kelp forest; far from the crevice both outer worlds go.
  await page.keyboard.press('Escape');
  await paused();
  await page.getByRole('button', { name: /Return to the tank/ }).click();
  await locked();
  s = await step(2);
  assert.equal(s.world, 'aquarium', 'back in the tank');
  await place({ x: -8, y: 5, z: 8 }, 0);
  for (let i = 0; i < 400 && (s.outer || s.kelp); i++) s = await step(2);
  report.released = !s.outer && !s.kelp;
  assert(report.released, 'the outer waters and the kelp forest are released');
  await step(4);
  report.after = await snapshot();
  assert.deepEqual(
    report.after,
    report.before,
    'GPU memory returns to its first counts',
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
