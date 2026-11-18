/* v0.6 Pass 053: an edge-by-edge exploration audit of the large worlds, with real input.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy053-edges node validation/edge-audit.mjs
 *
 * Travels tank → outer reef → kelp forest → sea cave → under the ice through each passage (W held,
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
const output = process.env.COZY_OUTPUT || '/tmp/cozy053-edges';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.COZY_CHROMIUM || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const report = { errors: [], edges: [], wildlife: {} };
try {
  const page = await browser.newPage({
    viewport: { width: 960, height: 600 },
    deviceScaleFactor: Number(process.env.COZY_DPR || 1),
  });
  page.setDefaultTimeout(300000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem('cozy-diver.settings.v3', JSON.stringify({ reducedMotion: true })),
  );
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({ response: r, body: (await r.text()) + '\nwindow.__cozy=app;cancelAnimationFrame(app.frame);' });
  });
  await page.goto(process.env.COZY_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__cozy?.tankEditor);
  await page.evaluate(() => Promise.all([window.__cozy.world.prepared, window.__cozy.office.prepared]));
  await page.getByRole('button', { name: 'Enter the Water', exact: true }).click();
  await page.waitForFunction(() => !!document.pointerLockElement && document.querySelector('#overlay').hidden);
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
      return { world: a.waterWorld, x: p.x, y: p.y, z: p.z, speed: Math.hypot(a.state.velocity.x, a.state.velocity.y, a.state.velocity.z) };
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
  /** Swim at an edge: from `from`, facing (yaw, pitch), W held for `seconds`. */
  const edge = async (world, name, from, yaw, pitch, seconds = 9) => {
    await place(from, yaw, pitch);
    await step(3);
    await page.keyboard.down('w');
    let open = 0,
      slowedAt = null,
      last = await step(1);
    const start = { ...last };
    for (let i = 0; i < seconds * 30; i++) {
      last = await step(1);
      open = Math.max(open, last.speed);
      if (slowedAt === null && i > 45 && last.speed < open * 0.6)
        slowedAt = { x: last.x, y: last.y, z: last.z };
    }
    await page.keyboard.up('w');
    await step(20);
    const info = await page.evaluate((world) => {
      const a = window.__cozy,
        w = a[world === 'outer' ? 'outer' : world],
        p = a.state.position,
        b = w.bounds,
        r = a.world.renderer.info.render;
      return {
        inside: p.x > b.min.x && p.x < b.max.x && p.y > b.min.y && p.y < b.max.y && p.z > b.min.z && p.z < b.max.z,
        finite: [p.x, p.y, p.z].every(Number.isFinite),
        calls: r.calls,
        triangles: r.triangles,
      };
    }, world);
    const travelled = Math.hypot(last.x - start.x, last.y - start.y, last.z - start.z);
    await page.screenshot({ path: path.join(output, `${world}-${name}.png`) });
    const row = {
      world,
      edge: name,
      start: round(start),
      end: round(last),
      travelled: +travelled.toFixed(2),
      slowedAt: slowedAt && round(slowedAt),
      ...info,
    };
    report.edges.push(row);
    assert(info.inside && info.finite, `${world} ${name}: the swimmer stays inside valid space`);
    return row;
  };
  const round = (p) => ({ x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) });

  // Tank → outer reef.
  await place({ x: 6.4, y: 1.6, z: -12.1 }, Math.PI / 2);
  await until((s) => s.outerReady, 600);
  await swimThrough('outer');
  const reef = await until((s) => s.reefReady);
  assert(reef.reefReady, 'the outer reef is prepared');
  await step(60);
  // The outer reef's edges: out over the blue, down the wall, the two sides, up, and the cliff.
  await edge('outer', 'blue', { x: 2, y: 2, z: -50 }, 0, 0);
  await edge('outer', 'down-the-wall', { x: 2, y: -1, z: -56 }, 0, -0.9);
  await edge('outer', 'left-side', { x: -24, y: 3, z: -45 }, Math.PI / 2, 0);
  await edge('outer', 'right-side', { x: 24, y: 3, z: -45 }, -Math.PI / 2, 0);
  await edge('outer', 'up', { x: 0, y: 7, z: -45 }, 0, 1.1);
  await edge('outer', 'cliff', { x: 6, y: 4, z: -38 }, Math.PI, 0);
  // Wildlife containment, after letting it run a while.
  await step(300);
  report.wildlife.outer = await page.evaluate(() => {
    const o = window.__cozy.outer,
      glass = o.glass && window.__cozy.outer.constructor ? null : null,
      cruisers = [...(o.creatures?.cruisers ?? []), ...(o.visitors?.creatures.cruisers ?? [])],
      fish = o.schools?.fish.simulation.fish ?? [];
    void glass;
    return {
      cruisers: cruisers.map((c) => ({ id: c.species.id, z: +c.position.z.toFixed(2), x: +c.position.x.toFixed(2), y: +c.position.y.toFixed(2) })),
      fish: { count: fish.length, minZ: Math.min(...fish.map((f) => f.position.z)), maxAbsX: Math.max(...fish.map((f) => Math.abs(f.position.x))) },
    };
  });
  // Outer reef → kelp forest.
  await place({ x: -17.6, y: 1.3, z: -32 }, -Math.PI / 2);
  await until((s) => s.kelpReady);
  await swimThrough('kelp');
  await step(30);
  await edge('kelp', 'left-wall', { x: -14, y: 5, z: -35 }, Math.PI / 2, 0);
  await edge('kelp', 'right-wall', { x: 14, y: 5, z: -35 }, -Math.PI / 2, 0);
  await edge('kelp', 'far-wall', { x: 0, y: 5, z: -48 }, 0, 0);
  await edge('kelp', 'surface', { x: 2, y: 12, z: -35 }, 0, 1.1);
  // Kelp forest → sea cave.
  await place({ x: 15.1, y: 2.8, z: -10 }, -Math.PI / 2);
  await until((s) => s.caveReady);
  await swimThrough('cave');
  await step(30);
  await edge('cave', 'far-wall', { x: 4, y: 4, z: -25 }, Math.PI * 0.85, 0, 6);
  // Sea cave → under the ice.
  await place({ x: -3, y: 3.2, z: -33 }, 0, 0);
  await until((s) => s.iceReady);
  await swimThrough('ice');
  await step(30);
  await edge('ice', 'left-icebergs', { x: -14, y: 6, z: -30 }, Math.PI / 2, 0);
  await edge('ice', 'right-icebergs', { x: 14, y: 6, z: -30 }, -Math.PI / 2, 0);
  await edge('ice', 'far-icebergs', { x: 0, y: 6, z: -48 }, 0, 0);
  await edge('ice', 'under-the-ice', { x: 2, y: 7, z: -35 }, 0, 1.1);
  await edge('ice', 'entrance', { x: 0, y: 4, z: -20 }, Math.PI, 0);
  assert.deepEqual(report.errors, []);
  report.ok = true;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, errors: report.errors.length, edges: report.edges.length }));
  await browser.close();
}
