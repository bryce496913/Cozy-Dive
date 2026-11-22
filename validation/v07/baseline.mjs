/* V0.7 Pass 061: the visual baseline benchmark.
 *
 * Captures fixed, repeatable views of one benchmark section of the home aquarium (around the arch,
 * back left: reef rocks, branching and massive corals with a fan and a leather coral, seagrass,
 * the moray at its den, the arch ornament and the chromis school), at close, medium and ordinary
 * swimming distances, from the real game, without changing anything in it. Optionally (COZY_OUTER=1)
 * swims the one passage into the outer reef for three more views. Records draw calls, triangles,
 * geometries, textures and programs per view, and an image hash, so two runs can be compared.
 *
 * Simulation time is fixed: after diving in, the app is ticked in identical 1/15 s steps (its own
 * animation loop is stopped), so fish, plants and lights are in the same state in every run.
 *
 *   npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/v07-baseline node validation/v07/baseline.mjs
 *
 * Env: COZY_PLAYWRIGHT (module path), COZY_CHROMIUM, COZY_DPR (default 1), COZY_OUTER=1, COZY_OFFICE=1, COZY_FISH=1, COZY_SIZE
 * (WxH, default 960x600), COZY_VIEWS (comma list of view names to capture; default all). Writes <output>/*.png and <output>/baseline.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/v07-baseline';
fs.mkdirSync(output, { recursive: true });
const [width, height] = (process.env.COZY_SIZE || '960x600')
  .split('x')
  .map(Number);

/** Fixed views: [name, distance class, eye, look-at]. Positions are aquarium metres (tank units). */
export const TANK_VIEWS = [
  ['tank-section-swim', 'swimming', [1.5, 3.8, 3.0], [-6.5, 1.4, -5.5]],
  ['tank-section-medium', 'medium', [-2.6, 2.6, -2.2], [-6.5, 1.3, -6.0]],
  ['tank-massive-coral-close', 'close', [-4.3, 1.9, -4.2], [-5.6, 1.3, -5.4]],
  ['tank-branching-coral-close', 'close', [-4.0, 3.0, 1.3], [-5.5, 2.6, -0.2]],
  ['tank-seagrass-close', 'close', [-6.0, 0.95, -0.9], [-7.5, 0.25, -2.8]],
  ['tank-arch-moray-close', 'close', [-4.8, 1.9, -5.6], [-7.6, 1.1, -8.0]],
  ['tank-chromis-school', 'medium', [-1.0, 6.4, 0.6], [-1.8, 6.9, -4.0]],
];
/**
 * V0.8 Pass 082: the reef benchmark section (the left channel bank: ridge of rocks 7, 11, 13, 19
 * and 31, the bommie of rock 17) at close, medium and normal swimming distance.
 * `COZY_BENCH=1` captures only these; `COZY_QUERY` appends a query string (e.g. `reef=original`).
 */
export const BENCH_VIEWS = [
  ['bench-swim', 'swimming', [-1.0, 3.0, -7.5], [-6.5, 1.2, 0.8]],
  ['bench-swim-channel', 'swimming', [1.2, 3.4, 5.2], [-6.2, 1.4, 0.2]],
  ['bench-medium', 'medium', [-2.4, 2.6, -2.6], [-6.3, 1.4, 0.6]],
  ['bench-medium-ridge', 'medium', [-3.2, 3.6, 4.6], [-7.6, 1.6, 1.4]],
  ['bench-close-coral', 'close', [-4.2, 2.6, -1.2], [-5.6, 2.0, -0.1]],
  ['bench-close-rock', 'close', [-2.9, 1.3, 1.5], [-4.6, 0.8, 0.4]],
  ['bench-close-bommie', 'close', [-3.8, 1.9, -6.8], [-5.6, 1.0, -5.4]],
  // V0.8 Pass 082B: the ridge top (anemone, massive heads, sponges, table coral).
  ['bench-close-ridge-top', 'close', [-5.9, 3.4, 3.4], [-7.5, 1.9, 1.6]],
];
/**
 * V0.8 Pass 083: the whole personal aquarium (habitat and vegetation overhaul), from fixed views
 * that cover both banks, the back corners, the meadows and a rock/coral attachment close-up.
 * `COZY_AQUA=1` captures only these.
 */
export const AQUA_VIEWS = [
  ['aqua-overview', 'swimming', [0, 6.5, 12.5], [0, 1.2, -4]],
  ['aqua-high', 'swimming', [0, 12.6, 12.8], [0, 0, -3]],
  ['aqua-left-bank', 'swimming', [1.5, 4.5, 6.5], [-11, 1.2, -5]],
  ['aqua-right-bank', 'swimming', [-1.5, 4.5, 6.5], [10.5, 1.2, -5]],
  ['aqua-back-left', 'medium', [-5.5, 3.6, -1.5], [-13, 1.2, -9.5]],
  ['aqua-back-right', 'medium', [3.2, 4.2, 0.5], [11, 1.5, -8.5]],
  ['aqua-front-left', 'medium', [-3.5, 3.0, 1.5], [-13.5, 0.8, 6.5]],
  ['aqua-front-right', 'medium', [1.5, 3.0, -1.0], [11, 0.9, 4.5]],
  ['aqua-meadow-close', 'close', [8.4, 1.3, 7.0], [11, 0.3, 9.8]],
  ['aqua-attach-close', 'close', [5.4, 2.6, -1.8], [7.6, 1.9, -4.4]],
  ['aqua-attach-table', 'close', [6.5, 3.1, -3.0], [7.9, 2.4, -4.5]],
  ['aqua-attach-brain', 'close', [-13.0, 2.9, -6.0], [-14.9, 1.9, -7.6]],
  ['aqua-moray-den', 'close', [-5.6, 1.7, -7.4], [-7.9, 1.1, -8.3]],
  ['aqua-frogfish', 'close', [3.9, 2.6, 2.5], [5.4, 1.6, 1.0]],
];
export const OUTER_VIEWS = [
  ['outer-reef-top', 'swimming', [0, 5, -36], [0, 3.5, -46]],
  ['outer-coral-close', 'close', [-0.2, 2.6, -38.6], [1.4, 1.2, -41.2]],
  ['outer-wall-lip', 'medium', [4, 3, -55], [4, 0, -62]],
  // V0.8 Pass 085: the reef's composition at swimming distance, a close look at rock and coral,
  // and the lip over the blue.
  ['outer-reef-wide', 'swimming', [12, 6, -34], [-6, 1.5, -47]],
  ['outer-reef-west', 'swimming', [-4, 5, -40], [-20, 1.5, -48]],
  ['outer-rock-close', 'close', [3, 2.2, -43], [5.5, 0.9, -45.5]],
  ['outer-lip-blue', 'medium', [-2, 4, -51], [-2, -3, -68]],
];

const browser = await chromium.launch({
  executablePath: process.env.COZY_CHROMIUM || undefined,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const report = {
  url: process.env.COZY_URL || 'http://127.0.0.1:5173',
  size: [width, height],
  views: [],
  errors: [],
};
const started = Date.now();
try {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: Number(process.env.COZY_DPR || 1),
  });
  page.setDefaultTimeout(600000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  // A clean profile: default settings (full graphics, motion on), first visit.
  await page.addInitScript(() => localStorage.clear());
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body:
        (await r.text()) +
        '\nwindow.__cozy=app;cancelAnimationFrame(app.frame);',
    });
  });
  await page.goto(
    report.url + (process.env.COZY_QUERY ? `?${process.env.COZY_QUERY}` : ''),
  );
  await page.waitForFunction(() => window.__cozy?.tankEditor);
  await page.evaluate(() =>
    Promise.all([window.__cozy.world.prepared, window.__cozy.office.prepared]),
  );
  report.loadMs = Date.now() - started;
  if (process.env.COZY_OFFICE === '1') {
    // V0.7 Pass 064: the office view of the miniature tank (its portal renders the underwater
    // scene), before diving, on the same fixed clock.
    const hide = await page.addStyleTag({
      content:
        'body * { visibility: hidden !important; } canvas { visibility: visible !important; }',
    });
    await page.evaluate(async () => {
      const a = window.__cozy;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        cancelAnimationFrame(a.frame);
        a.__t = (a.__t ?? 1000) + 1000 / 15;
        a.tick(a.__t);
        cancelAnimationFrame(a.frame);
      }
    });
    const file = path.join(output, 'office-tank.png');
    const png = await page.screenshot({ path: file });
    report.views.push({
      name: 'office-tank',
      distance: 'office',
      image: 'office-tank.png',
      hash: crypto.createHash('sha256').update(png).digest('hex').slice(0, 16),
    });
    await hide.evaluate((el) => el.remove());
  }
  await page.getByRole('button', { name: 'Dive In', exact: true }).click();
  await page.waitForFunction(
    () =>
      !!document.pointerLockElement &&
      document.querySelector('#overlay').hidden,
  );
  // The 3D view only: the HUD, hints and buttons are hidden for the captures (not changed).
  await page.addStyleTag({
    content:
      'body * { visibility: hidden !important; } canvas { visibility: visible !important; }',
  });
  /** Tick the app in fixed 1/15 s steps (its own loop stays stopped). */
  const step = (count) =>
    page.evaluate(async (count) => {
      const a = window.__cozy;
      for (let i = 0; i < count; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        cancelAnimationFrame(a.frame);
        a.__t = (a.__t ?? 1000) + 1000 / 15;
        a.tick(a.__t);
        cancelAnimationFrame(a.frame);
      }
    }, count);
  const place = (eye, target) =>
    page.evaluate(
      ([eye, target]) => {
        const a = window.__cozy,
          dx = target[0] - eye[0],
          dy = target[1] - eye[1],
          dz = target[2] - eye[2];
        Object.assign(a.state.position, { x: eye[0], y: eye[1], z: eye[2] });
        a.state.velocity.x = a.state.velocity.y = a.state.velocity.z = 0;
        a.state.neutralDepth = eye[1];
        a.controls.yaw = Math.atan2(-dx, -dz);
        a.controls.pitch = Math.atan2(dy, Math.hypot(dx, dz));
        a.controls.clear();
      },
      [eye, target],
    );
  // V0.8 Pass 087: COZY_VIEWS=<name,...> captures only the named views.
  const only = process.env.COZY_VIEWS?.split(',');
  const capture = async (world, name, distance, eye, target) => {
    if (only && !only.includes(name)) return;
    await place(eye, target);
    await step(15);
    const info = await page.evaluate(() => {
      const r = window.__cozy.world.renderer,
        i = r.info;
      return {
        world: window.__cozy.waterWorld,
        calls: i.render.calls,
        triangles: i.render.triangles,
        geometries: i.memory.geometries,
        textures: i.memory.textures,
        programs: i.programs?.length ?? null,
        eye: { ...window.__cozy.state.position },
      };
    });
    const file = path.join(output, `${name}.png`);
    const png = await page.screenshot({ path: file });
    const hash = crypto
      .createHash('sha256')
      .update(png)
      .digest('hex')
      .slice(0, 16);
    report.views.push({
      name,
      distance,
      target,
      ...info,
      image: path.basename(file),
      hash,
    });
    console.log(
      `${name}: ${info.calls} draws, ${(info.triangles / 1e6).toFixed(2)} M tris, ${hash}`,
    );
  };
  // Settle after the dive, the same number of steps every run.
  await step(30);
  if (process.env.COZY_FISH === '1') {
    // V0.7 Pass 065: side views of real simulated fish (close and medium), on the fixed clock.
    for (const [species, tag] of [
      ['blue-green-chromis', 'chromis'],
      ['ocellaris-clownfish', 'clownfish'],
      ['royal-gramma', 'gramma'],
    ])
      for (const [distance, range] of [
        ['close', 0.9],
        ['medium', 2.4],
      ]) {
        const at = await page.evaluate(
          ([species, range]) => {
            const fish = window.__cozy.world.aquarium.fish.simulation.fish.find(
              (f) => f.species.id === species,
            );
            if (!fish) return null;
            const p = fish.position,
              side = [Math.sin(fish.yaw), 0, Math.cos(fish.yaw)];
            return {
              eye: [
                p.x + side[0] * range,
                p.y + range * 0.18,
                p.z + side[2] * range,
              ],
              target: [p.x, p.y, p.z],
            };
          },
          [species, range],
        );
        if (!at) continue;
        await place(at.eye, at.target);
        // One frame only: the fish has barely moved, the camera holds still.
        await step(1);
        const file = path.join(output, `fish-${tag}-${distance}.png`);
        const png = await page.screenshot({ path: file });
        report.views.push({
          name: `fish-${tag}-${distance}`,
          distance,
          image: path.basename(file),
          hash: crypto
            .createHash('sha256')
            .update(png)
            .digest('hex')
            .slice(0, 16),
        });
        console.log(`fish-${tag}-${distance}`);
      }
  }
  // V0.8 Pass 085: COZY_OUTER_ONLY=1 skips the tank views (the outer views still swim there).
  for (const [name, distance, eye, target] of process.env.COZY_OUTER_ONLY ===
  '1'
    ? []
    : process.env.COZY_AQUA === '1'
      ? AQUA_VIEWS
      : process.env.COZY_BENCH === '1'
        ? BENCH_VIEWS
        : TANK_VIEWS)
    await capture('aquarium', name, distance, eye, target);
  if (process.env.COZY_OUTER === '1') {
    await place([6.4, 1.6, -12.1], [3, 1.6, -12.1]);
    const until = async (test, max = 900) => {
      for (let i = 0; i < max; i++) {
        if (await page.evaluate(test)) return;
        await step(2);
      }
      throw Error('timed out');
    };
    await until(() => !!window.__cozy.outer?.isReady);
    await page.keyboard.down('w');
    await until(() => window.__cozy.waterWorld === 'outer', 600);
    await page.keyboard.up('w');
    await until(() => !!window.__cozy.outer?.isReefReady);
    await step(60);
    for (const [name, distance, eye, target] of OUTER_VIEWS)
      await capture('outer', name, distance, eye, target);
  }
  assert.deepEqual(report.errors, []);
  report.ok = true;
} finally {
  report.elapsedMs = Date.now() - started;
  fs.writeFileSync(
    path.join(output, 'baseline.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      ok: report.ok ?? false,
      views: report.views.length,
      errors: report.errors.length,
      loadMs: report.loadMs,
    }),
  );
  await browser.close();
}
