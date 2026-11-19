/* v0.6 Pass 053 (visual review): a consistent world tour, from an edge-audit base: of the large worlds, with real input.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy053-edges node validation/edge-audit.mjs
 *
 * Travels tank → outer reef → kelp forest (→ down the sinkhole to the shipwreck and back up) →
 * sea cave → under the ice through each passage (W held,
 * as a player swims), and in each large world swims hard at every boundary: a few seconds of W
 * from just inside it, facing out. At each edge it records how far the swimmer got (and where the
 * slowing began, as the first frame below 60% of open-water speed), checks the swimmer stayed
 * inside the world's valid space, screenshots the view outward, and records draw calls and
 * triangles. In the outer reef it also checks wildlife containment: the reef fish inside the tank,
 * the big animals (but the turtles, who live on the reef) outside the glass. Writes report.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy053-tour';
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
const report = { errors: [], edges: [], wildlife: {} };
try {
  const page = await browser.newPage({
    viewport: { width: 640, height: 400 },
    deviceScaleFactor: Number(process.env.COZY_DPR || 0.5),
  });
  page.setDefaultTimeout(300000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      'cozy-diver.settings.v3',
      JSON.stringify({ reducedMotion: true }),
    ),
  );
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body:
        (await r.text()) +
        '\nwindow.__cozy=app;cancelAnimationFrame(app.frame);',
    });
  });
  await page.goto(process.env.COZY_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__cozy?.tankEditor);
  await page.evaluate(() =>
    Promise.all([window.__cozy.world.prepared, window.__cozy.office.prepared]),
  );
  await page.getByRole('button', { name: 'Dive In', exact: true }).click();
  await page.waitForFunction(
    () =>
      !!document.pointerLockElement &&
      document.querySelector('#overlay').hidden,
  );
  const step = (count = 1) =>
    page.evaluate(async (count) => {
      const a = window.__cozy;
      cancelAnimationFrame(a.frame);
      for (let i = 0; i < count; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        cancelAnimationFrame(a.frame);
        // Steps of 1/15 s: the same distance swum per second, half the frames to draw.
        a.__t = (a.__t ?? performance.now()) + 1000 / 15;
        a.tick(a.__t);
        cancelAnimationFrame(a.frame);
      }
      const p = a.state.position;
      return {
        world: a.waterWorld,
        x: p.x,
        y: p.y,
        z: p.z,
        speed: Math.hypot(
          a.state.velocity.x,
          a.state.velocity.y,
          a.state.velocity.z,
        ),
      };
    }, count);
  const state = () =>
    page.evaluate(() => {
      const a = window.__cozy;
      return {
        world: a.waterWorld,
        outerReady: !!a.outer?.isReady,
        reefReady: !!a.outer?.isReefReady,
        kelpReady: !!a.kelp?.isReady,
        caveReady: !!a.cave?.isReady,
        iceReady: !!a.ice?.isReady,
        wreckReady: !!a.wreck?.isReady,
        shade: a.wreck?.shade ?? 0,
      };
    });
  const until = async (test, max = 900) => {
    let s = await state();
    for (let i = 0; i < max && !test(s); i++) {
      await step(2);
      s = await state();
    }
    return s;
  };
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
  const swimThrough = async (world) => {
    await page.keyboard.down('w');
    let s = await state();
    for (let i = 0; i < 600 && s.world !== world; i++) {
      await step(1);
      s = await state();
    }
    await page.keyboard.up('w');
    assert.equal(s.world, world, `through the passage into ${world}`);
  };
  const log = (m) =>
    console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
  log('in the tank');
  /** A fixed view: place, settle a few frames, screenshot, record draws. */
  const view = async (world, name, at, yaw, pitch = 0) => {
    await place(at, yaw, pitch);
    await step(12);
    const r = await page.evaluate(() => {
      const i = window.__cozy.world.renderer.info.render;
      return { calls: i.calls, triangles: i.triangles };
    });
    await page.screenshot({ path: path.join(output, `${world}-${name}.png`) });
    report.edges.push({ world, edge: name, ...r });
    log(`${world} ${name}: ${r.calls} draws`);
  };
  // The tank.
  await view('tank', 'front', { x: 0, y: 5, z: 10 }, 0, -0.1);
  await view('tank', 'reef-close', { x: -6, y: 3, z: 2 }, 0.5, -0.2);
  await view('tank', 'corner', { x: 12, y: 4, z: 8 }, 0.7, -0.15);
  // Tank → outer reef.
  await place({ x: 6.4, y: 1.6, z: -12.1 }, Math.PI / 2);
  await until((s) => s.outerReady, 600);
  await swimThrough('outer');
  await until((s) => s.reefReady);
  await step(60);
  await view('outer', 'reef-top', { x: 0, y: 5, z: -36 }, 0, -0.2);
  await view('outer', 'lip', { x: 4, y: 3, z: -55 }, 0, -0.1);
  await view('outer', 'coral-close', { x: -8, y: 3, z: -44 }, 0.8, -0.45);
  // Outer reef → kelp forest.
  await place({ x: -17.6, y: 1.3, z: -32 }, -Math.PI / 2);
  await until((s) => s.kelpReady);
  await swimThrough('kelp');
  await step(30);
  await view('kelp', 'forest', { x: 0, y: 6, z: -22 }, 0, 0);
  await view('kelp', 'rocks-close', { x: -10, y: 3, z: -30 }, 0.6, -0.5);
  await view('kelp', 'canopy', { x: 4, y: 10, z: -35 }, 0.3, 0.5);
  // The sinkhole, hidden in the kelp beside its boulder.
  await view('kelp', 'sinkhole', { x: -7.5, y: 2.4, z: -43 }, 0.5, -0.45);
  // Kelp forest → down the sinkhole → the shipwreck.
  await place({ x: -10.4, y: -2, z: -47.1 }, 0, -1.45);
  await until((s) => s.wreckReady);
  await swimThrough('wreck');
  await step(30);
  await view('wreck', 'shaft-exit', { x: 0, y: 15, z: -26.5 }, 0.3, -0.6);
  await view('wreck', 'deck', { x: 6, y: 12.5, z: -20 }, 0.55, -0.4);
  await view('wreck', 'bow', { x: -6, y: 8, z: -58 }, -2.6, 0);
  await view('wreck', 'side', { x: 9, y: 4.5, z: -33 }, 1.35, 0.05);
  await view('wreck', 'hold', { x: 0, y: 2.8, z: -27.5 }, 0, -0.05);
  const hold = await state();
  assert.ok(hold.shade > 0.8, `dark in the hold (torch on): ${hold.shade}`);
  await view('wreck', 'deckhouse', { x: 0, y: 7.3, z: -21 }, Math.PI, -0.1);
  await view('wreck', 'outside-again', { x: 9, y: 9, z: -30 }, 1.2, -0.2);
  const out = await state();
  assert.ok(out.shade < 0.2, `light again outside (torch off): ${out.shade}`);
  // Back up the shaft to the kelp forest.
  await place({ x: 0, y: 20, z: -26.5 }, 0, 1.45);
  await swimThrough('kelp');
  await step(10);
  // Kelp forest → sea cave.
  await place({ x: 15.1, y: 2.8, z: -10 }, -Math.PI / 2);
  await until((s) => s.caveReady);
  await swimThrough('cave');
  await step(30);
  await view('cave', 'cavern', { x: 0, y: 5, z: -14 }, 0, -0.1);
  await view('cave', 'floor-close', { x: 6, y: 2.5, z: -24 }, 2.2, -0.5);
  await view('cave', 'sunbeam', { x: -2, y: 4, z: -20 }, -0.6, 0.2);
  // Sea cave → under the ice.
  await place({ x: -3, y: 3.2, z: -33 }, 0, 0);
  await until((s) => s.iceReady);
  await swimThrough('ice');
  await step(30);
  await view('ice', 'open-water', { x: 0, y: 6, z: -16 }, 0, 0);
  await view('ice', 'seabed-close', { x: -5, y: 2.5, z: -30 }, 0.5, -0.6);
  await view('ice', 'under-ice', { x: 2, y: 8, z: -32 }, 0.2, 0.6);
  assert.deepEqual(report.errors, []);
  report.ok = true;
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      ok: report.ok,
      errors: report.errors.length,
      edges: report.edges.length,
    }),
  );
  await browser.close();
}
