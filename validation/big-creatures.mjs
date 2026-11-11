/* v0.4 Pass 025: the outer reef's big creatures and the sightings journal, with real input.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy025-creatures node validation/big-creatures.mjs
 *
 * Starts with an empty journal, enters the water with real pointer lock and swims through the
 * hidden crack into the outer reef (recording long tasks and shader programs as it prepares).
 * Then:
 *   - every creature is loaded, moves along its route and strokes; full detail near, light far;
 *   - over two minutes of cruising, no creature's body enters any reef hull or the seabed;
 *   - waiting on a shark's route, the shark gives way and keeps its distance;
 *   - looking at each kind of creature counts it as seen: the "New sighting" note appears, and
 *     the journal is saved; the pause screen's "Seen" list names everything seen, with no counts;
 *   - after a reload the list is still offered;
 *   - returning to the tank and releasing the outer waters twice leaves GPU memory unchanged.
 * The loop is stepped by hand (30 Hz), yielding a real frame each step.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy025-creatures';
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
const report = { base, errors: [], creatures: {}, views: {} };
try {
  const context = await browser.newContext({
    viewport: { width: 1100, height: 700 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(Number(process.env.COZY_ACTION_TIMEOUT || 240000));
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body: (await r.text()) + '\nwindow.__cozy=app;',
    });
  });
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  // An empty journal to start with.
  await page.goto(base);
  await page.evaluate(() => localStorage.removeItem('cozy-diver.journal.v1'));
  await page.reload();
  const boot = async () => {
    await page.waitForFunction(() => window.__cozy?.world);
    await page.evaluate(() => window.__cozy.world.prepared);
  };
  await boot();
  report.seenButtonAtStart = await page.locator('#seen-toggle').isVisible();
  assert.equal(report.seenButtonAtStart, false, 'nothing seen yet: no list');
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
  const enterWater = async () => {
    await page
      .getByRole('button', { name: 'Enter the Water', exact: true })
      .click();
    await locked();
  };
  await enterWater();
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
        ready: !!a.outer?.isReady,
      };
    }, count);
  const memory = () =>
    page.evaluate(() => ({ ...window.__cozy.world.renderer.info.memory }));
  const place = (x, y, z, yaw, pitch) =>
    page.evaluate(
      ([x, y, z, yaw, pitch]) => {
        const a = window.__cozy;
        Object.assign(a.state.position, { x, y, z });
        a.state.velocity.x = a.state.velocity.y = a.state.velocity.z = 0;
        a.state.neutralDepth = y;
        a.controls.yaw = yaw;
        a.controls.pitch = pitch;
        a.controls.targetPitch = pitch;
        a.controls.clear();
      },
      [x, y, z, yaw, pitch],
    );
  await step(2);
  report.memoryTank = await memory();
  report.programsTank = await page.evaluate(
    () => window.__cozy.world.renderer.info.programs.length,
  );

  /** Swim through the crack (real W), recording long tasks while the reef prepares. */
  const visit = async () => {
    await page.evaluate(() => {
      window.__longTasks = [];
      window.__observer?.disconnect();
      try {
        window.__observer = new PerformanceObserver((list) => {
          for (const e of list.getEntries())
            window.__longTasks.push(Math.round(e.duration));
        });
        window.__observer.observe({ type: 'longtask', buffered: false });
      } catch {
        window.__longTasks = null;
      }
    });
    await place(6.4, 1.6, -12.1, Math.PI / 2, 0);
    let s = await step(1);
    for (let i = 0; i < 600 && !s.ready; i++) s = await step(1);
    assert(s.ready, 'the outer reef becomes ready');
    const longTasks = await page.evaluate(() => window.__longTasks);
    await page.keyboard.down('w');
    for (let i = 0; i < 600 && s.world !== 'outer'; i++) s = await step(1);
    await page.keyboard.up('w');
    assert.equal(s.world, 'outer');
    return longTasks;
  };
  const longTasks = await visit();
  report.longTasks = longTasks
    ? { count: longTasks.length, longestMs: Math.max(0, ...longTasks) }
    : 'unsupported';
  report.programsOuter = await page.evaluate(
    () => window.__cozy.world.renderer.info.programs.length,
  );

  // 1. Every creature loaded, and they move and stroke.
  const creatures = () =>
    page.evaluate(() =>
      window.__cozy.outer.creatures.cruisers.map((c) => ({
        id: c.species.id,
        x: c.position.x,
        y: c.position.y,
        z: c.position.z,
        yaw: c.yaw,
        effort: c.effort,
        radius: c.species.radius,
      })),
    );
  const loaded = await page.evaluate(() => {
    const c = window.__cozy.outer.creatures;
    return {
      cruisers: c.cruisers.length,
      models: c.root.children.length,
      sightings: window.__cozy.outer.sightings.length,
    };
  });
  report.loaded = loaded;
  assert.equal(loaded.cruisers, 6);
  assert.equal(loaded.models, 6, 'every creature has its model');
  // Look away from everything (so nothing is seen yet) while they cruise.
  await place(0, 7, -36, Math.PI, 0.6);
  const before = await creatures();
  let effortRange = before.map(() => [Infinity, -Infinity]);
  for (let i = 0; i < 20; i++) {
    (await creatures()).forEach((c, k) => {
      effortRange[k] = [
        Math.min(effortRange[k][0], c.effort),
        Math.max(effortRange[k][1], c.effort),
      ];
    });
    await step(9);
  }
  const after = await creatures();
  after.forEach((c, k) => {
    const moved = Math.hypot(
      c.x - before[k].x,
      c.y - before[k].y,
      c.z - before[k].z,
    );
    report.creatures[`${c.id}-${k}`] = {
      moved: +moved.toFixed(2),
      effort: effortRange[k].map((e) => +e.toFixed(2)),
    };
    assert(moved > 2, `${c.id} cruises`);
    assert(effortRange[k][1] - effortRange[k][0] > 0.3, `${c.id} strokes`);
  });

  // 2. Two minutes of cruising: no creature's body inside a reef hull or below the seabed.
  report.clearance = await page.evaluate(async () => {
    const a = window.__cozy,
      outer = a.outer,
      colliders = outer.reef.colliders,
      world = outer.collision;
    let hits = 0,
      lowest = Infinity,
      samples = 0;
    const probe = {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
    };
    for (let i = 0; i < 120 * 4; i++) {
      for (const c of outer.creatures.cruisers) c.update(0.25);
      for (const c of outer.creatures.cruisers) {
        const p = c.position,
          r = c.species.radius,
          fx = Math.cos(c.yaw),
          fz = -Math.sin(c.yaw);
        // Centre, nose, tail and both sides.
        const points = [
          [p.x, p.y, p.z],
          [p.x + fx * r, p.y, p.z + fz * r],
          [p.x - fx * r, p.y, p.z - fz * r],
          [p.x - fz * r, p.y, p.z + fx * r],
          [p.x + fz * r, p.y, p.z - fx * r],
        ];
        for (const [x, y, z] of points) {
          samples++;
          for (const h of colliders)
            if (world.contains(h, x, y, z)) {
              hits++;
              break;
            }
          Object.assign(probe.position, { x, y: -100, z });
          world.move(probe, x, -100, z);
          lowest = Math.min(lowest, y - probe.position.y);
        }
      }
      if (i % 40 === 0) await new Promise((r) => requestAnimationFrame(r));
    }
    return { samples, hits, lowestAboveFloor: +lowest.toFixed(2) };
  });
  assert.equal(report.clearance.hits, 0, 'no creature inside the reef');
  assert(report.clearance.lowestAboveFloor > 0.3, 'none in the seabed');

  // 3. Views of each kind (also counts each as seen), and the "New sighting" note.
  const notes = [];
  const watch = async (index, name) => {
    // Beside the creature, a little above, looking at it; stepped until it counts as seen.
    for (let i = 0; i < 90; i++) {
      const target = (await creatures())[index];
      const yaw = target.yaw + Math.PI / 2,
        ex = target.x - Math.cos(yaw) * 6.5,
        ez = target.z + Math.sin(yaw) * 6.5,
        ey = target.y + 1.2;
      await place(
        ex,
        ey,
        ez,
        Math.atan2(-(target.x - ex), -(target.z - ez)),
        Math.atan2(target.y - ey, 6.5),
      );
      await step(1);
      const note = await page.evaluate(() => {
        const n = document.querySelector('#sighting-note');
        return n.hidden ? null : n.textContent;
      });
      if (note && !notes.includes(note)) {
        notes.push(note);
        break;
      }
    }
    await step(4);
    report.views[name] = await page.evaluate(() => {
      const r = window.__cozy.world.renderer;
      return {
        calls: r.info.render.calls,
        triangles: r.info.render.triangles,
        near: window.__cozy.outer.creatures.nearCount,
      };
    });
    await page.screenshot({ path: path.join(output, `${name}.png`) });
  };
  const all = await creatures();
  await watch(
    all.findIndex((c) => c.id === 'blacktip-reef-shark'),
    'shark',
  );
  await watch(
    all.findIndex((c) => c.id === 'spotted-eagle-ray'),
    'eagle-rays',
  );
  await watch(
    all.findIndex((c) => c.id === 'green-sea-turtle'),
    'turtle',
  );
  report.notes = notes;
  for (const name of [
    'Blacktip reef shark',
    'Spotted eagle ray',
    'Green sea turtle',
  ])
    assert(
      notes.includes(`New sighting · ${name}`),
      `"${name}" is noted when first seen`,
    );
  report.journal = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('cozy-diver.journal.v1')).seen.map(
      (s) => s.id,
    ),
  );
  for (const id of [
    'species:blacktip-reef-shark',
    'species:spotted-eagle-ray',
    'species:green-sea-turtle',
  ])
    assert(report.journal.includes(id), `${id} saved`);

  // A distant creature uses its light level.
  await place(0, 7, -36, Math.PI, 0);
  await step(2);
  report.farNearCount = await page.evaluate(
    () => window.__cozy.outer.creatures.nearCount,
  );

  // 4. Waiting on a shark's route: it gives way and keeps its distance.
  const sharkIndex = all.findIndex((c) => c.id === 'blacktip-reef-shark');
  const ahead = await page.evaluate((index) => {
    const c = window.__cozy.outer.creatures.cruisers[index],
      p = c.position,
      out = { x: 0, y: 0, z: 0 };
    // Find the route point nearest the shark, then the point 12 s ahead of it.
    let best = 0,
      bestD = Infinity;
    for (let d = 0; d < c.route.length; d += 0.5) {
      c.route.at(d, out);
      const k = Math.hypot(out.x - p.x, out.y - p.y, out.z - p.z);
      if (k < bestD) {
        bestD = k;
        best = d;
      }
    }
    return c.route.at(best + c.species.speed * 12, out);
  }, sharkIndex);
  await place(ahead.x, ahead.y, ahead.z, 0, 0);
  let closest = Infinity;
  for (let i = 0; i < 10 * 22; i++) {
    const s = await step(3),
      c = (await creatures())[sharkIndex];
    closest = Math.min(closest, Math.hypot(c.x - s.x, c.y - s.y, c.z - s.z));
  }
  report.giveWay = { closest: +closest.toFixed(2) };
  assert(closest > 3, 'the shark keeps its distance');

  // 5. The pause screen lists what was seen, by name, with no counts.
  await page.keyboard.press('Escape');
  await paused();
  const toggle = page.locator('#seen-toggle');
  assert(await toggle.isVisible(), 'the Seen list is offered');
  await toggle.click();
  const panel = page.locator('#seen-panel');
  assert(await panel.isVisible());
  report.seenList = await page.$$eval('#seen-list li span', (items) =>
    items.map((i) => i.textContent),
  );
  for (const name of [
    'Blacktip reef shark',
    'Spotted eagle ray',
    'Green sea turtle',
  ])
    assert(report.seenList.includes(name), `${name} listed`);
  const panelText = await panel.innerText();
  assert(!/\b\d+\s*(of|\/)\s*\d+\b/.test(panelText), 'no counts');
  await page.screenshot({ path: path.join(output, 'seen-list.png') });
  await page.keyboard.press('Escape');
  assert(!(await panel.isVisible()), 'Escape closes the list');

  // 6. Return to the tank, release far away; then a second visit and release.
  const release = async () => {
    if (await page.locator('#overlay').isHidden()) {
      await page.keyboard.press('Escape');
      await paused();
    }
    await page.getByRole('button', { name: /Return to the tank/ }).click();
    await locked();
    await place(-8, 6, 8, 0, 0);
    for (let i = 0; i < 300 && (await step(1)).outer; i++);
    await step(3);
    return memory();
  };
  report.memoryAfterFirst = await release();
  await visit();
  report.memoryAfterSecond = await release();
  assert.deepEqual(
    report.memoryAfterSecond,
    report.memoryAfterFirst,
    'no growth across visits',
  );

  // 7. After a reload the list is still offered.
  await page.reload();
  await boot();
  report.seenButtonAfterReload = await toggle.isVisible();
  assert(report.seenButtonAfterReload, 'the journal persists');
  assert.deepEqual(report.errors, []);
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 1));
