/** Instrumented dev build. Real W/E/Escape input and production movement/collision.
 * Steering changes view only; never sets player positions, readiness or world IDs.
 * Synthetic 100ms simulation steps are NOT hardware frame-rate measurements.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy-wreck-route';
fs.mkdirSync(output, { recursive: true });
const report = {
  errors: [],
  checkpoints: [],
  crossings: [],
  cycles: [],
  method: {
    simulationStepMs: 100,
    renderStride: 100,
    timingSamplesPerSpace: 20,
    renderer: 'Chromium SwiftShader; software rendering, not hardware FPS',
  },
};
let page;
let injecting = false;
report.expectedErrors = [];
const browser = await chromium.launch({
  executablePath: process.env.COZY_CHROMIUM,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
try {
  page = await browser.newPage({
    viewport: { width: 640, height: 600 },
    deviceScaleFactor: Number(process.env.COZY_DPR || 0.25),
  });
  page.setDefaultTimeout(240000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const message = m.text();
    if (
      injecting &&
      (message.includes('Barracuda 1 could not be loaded') ||
        message.includes("wreck's barracuda could not be loaded"))
    )
      report.expectedErrors.push(message);
    else report.errors.push(message);
  });
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body:
        (await r.text()) +
        '\nwindow.__cozy=app;cancelAnimationFrame(app.frame);',
    });
  });
  const start = Date.now();
  console.log('Loading office and tank');
  await page.goto(process.env.COZY_URL || 'http://127.0.0.1:5174');
  await page.waitForFunction(() => window.__cozy?.office);
  await page.evaluate(() =>
    Promise.all([
      window.__cozy.world.prepared,
      window.__cozy.office.prepared,
      window.__cozy.tankEditor.ready,
    ]),
  );
  report.initialLoadMs = Date.now() - start;
  console.log('Prepared', report.initialLoadMs);
  await page.evaluate(async () => {
    const a = window.__cozy;
    const layout = await import('/src/environment/wreck/WreckLayout.ts');
    const { boulderLayout } =
      await import('/src/environment/kelp/KelpEnvironment.ts');
    const { kelpFloor } = await import('/src/environment/kelp/KelpTerrain.ts');
    const rocks = boulderLayout(),
      x = -10.4,
      z = -47.1,
      b = rocks.reduce((a, b) =>
        Math.hypot(a.x - x, a.z - z) < Math.hypot(b.x - x, b.z - z) ? a : b,
      ),
      angle = Math.atan2(z - b.z, x - b.x),
      lip = kelpFloor(x, z);
    window.__hole = {
      outside: {
        x: x + Math.cos(angle) * 4,
        y: lip + 1.2,
        z: z + Math.sin(angle) * 4,
      },
      inside: {
        x: x + Math.cos(angle) * 0.3,
        y: lip - 2,
        z: z + Math.sin(angle) * 0.3,
      },
    };
    window.__ship = (p) => layout.fromShip(p, { x: 0, y: 0, z: 0 });
    window.__toShip = (p) => layout.toShip(p, { x: 0, y: 0, z: 0 });
    window.__samples = [];
    window.__stride = 100;
    window.__renderCount = 0;
    const renderer = a.world.renderer,
      render = renderer.render;
    renderer.render = function (...args) {
      if (!window.__inTick || window.__present) return render.apply(this, args);
    };
    window.__crossings = [];
    window.__read = () => ({
      mode: a.mode,
      world: a.waterWorld,
      p: { ...(a.mode === 'office' ? a.walk.position : a.state.position) },
      v: { ...(a.mode === 'office' ? a.walk.velocity : a.state.velocity) },
      dark: Number(
        getComputedStyle(document.querySelector('.passage-veil')).opacity,
      ),
      outer: a.outer?.isReady,
      reef: a.outer?.isReefReady,
      kelp: a.kelp?.isReady,
      wreck: a.wreck?.isReady,
      preparation: a.wreck?.preparation.state,
      torch: a.wreck?.torch.intensity,
      memory: { ...a.world.renderer.info.memory },
      buffer: [
        a.world.renderer.domElement.width,
        a.world.renderer.domElement.height,
      ],
      programs: a.world.renderer.info.programs.length,
      reefLeases: a.world.reefLoader.leased,
      leases: a.world.authored.loader.leased,
      draw: { ...a.world.renderer.info.render },
      sights: a.wreck?.sightings.length,
      journal: a.sightings.map((s) => s.id),
      buildTimes: a.buildTimes,
    });
    window.__step = async (n, target) => {
      cancelAnimationFrame(a.frame);
      for (let i = 0; i < n; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        cancelAnimationFrame(a.frame);
        if (target) {
          const p = a.mode === 'office' ? a.walk.position : a.state.position,
            dx = target.x - p.x,
            dy = (target.y ?? p.y) - p.y,
            dz = target.z - p.z;
          a.controls.yaw = -Math.atan2(dx, -dz);
          a.controls.pitch = Math.max(
            -1.49,
            Math.min(1.49, Math.atan2(dy, Math.hypot(dx, dz))),
          );
          a.controls.targetYaw = a.controls.yaw;
          a.controls.targetPitch = a.controls.pitch;
        }
        const before = window.__read(),
          t = performance.now();
        a.__t = Math.max(a.__t ?? 0, a.previous ?? 0) + 100;
        window.__present =
          window.__forceRender ||
          window.__renderCount++ % window.__stride === 0;
        window.__inTick = true;
        try {
          a.tick(a.__t);
        } finally {
          window.__inTick = false;
        }
        cancelAnimationFrame(a.frame);
        window.__samples.push({
          ms: performance.now() - t,
          presented: window.__present,
          measured: !!window.__forceRender,
          wallFrameMs:
            window.__lastFrame === undefined
              ? null
              : performance.now() - window.__lastFrame,
          calls: a.world.renderer.info.render.calls,
          triangles: a.world.renderer.info.render.triangles,
          world: a.waterWorld,
        });
        window.__lastFrame = performance.now();
        const after = window.__read();
        if (a.mode === 'aquarium' && before.world === after.world) {
          const p = a.state.position,
            c = a.water().collision;
          if (c.colliders.some((h) => c.contains(h, p.x, p.y, p.z)))
            throw Error(
              'Player overlapped a collider: ' + JSON.stringify(after),
            );
        }
        if (before.world !== after.world)
          window.__crossings.push({ before, after });
      }
      return window.__read();
    };
  });
  const step = (n = 1, target) =>
    page.evaluate(([n, t]) => window.__step(n, t), [n, target]);
  const read = () => page.evaluate(() => window.__read());
  const checkpoint = async (name) => {
    await page.evaluate(() => {
      window.__forceRender = true;
    });
    await step(1);
    await page.evaluate(() => {
      window.__forceRender = false;
    });
    const s = await read();
    report.checkpoints.push({ name, ...s });
    console.log(name, JSON.stringify(s));
    await page.screenshot({ path: `${output}/${name}.png` });
    const captured = await page.evaluate(() => ({
      samples: window.__samples,
      crossings: window.__crossings,
    }));
    Object.assign(report, captured);
    fs.writeFileSync(
      `${output}/progress.json`,
      JSON.stringify(report, null, 2),
    );
    return s;
  };
  const wait = async (key, max = 1500) => {
    const t = Date.now();
    let s;
    for (let i = 0; i < max; i++) {
      s = await step();
      if (s[key]) {
        report.checkpoints.push({
          name: `${key}-load`,
          wallMs: Date.now() - t,
        });
        return s;
      }
    }
    throw Error(`${key} not ready: ${JSON.stringify(s)}`);
  };
  const go = async (target, { world, tolerance = 0.35, max = 900 } = {}) => {
    console.log('Go', JSON.stringify(target), world ?? '');
    await page.keyboard.down('w');
    let s;
    try {
      for (let i = 0; i < max; i++) {
        s = await step(1, target);
        if (world && s.world === world) return s;
        if (
          !world &&
          Math.hypot(
            s.p.x - target.x,
            (target.y ?? s.p.y) - s.p.y,
            s.p.z - target.z,
          ) < tolerance
        ) {
          await page.keyboard.up('w');
          if (s.mode === 'aquarium') {
            const v = s.v;
            await page.keyboard.down('s');
            for (let j = 0; j < 20; j++) {
              const b = await step();
              if (b.v.x * v.x + b.v.y * v.y + b.v.z * v.z <= 0.02) break;
            }
            await page.keyboard.up('s');
          }
          return read();
        }
      }
      throw Error(
        `Route stuck aiming ${JSON.stringify(target)}: ${JSON.stringify(s)}`,
      );
    } finally {
      await page.keyboard.up('w');
      await page.keyboard.up('s');
    }
  };
  const observe = async (id) => {
    for (let i = 0; i < 25; i++) {
      await page.evaluate((id) => {
        const a = window.__cozy,
          s = a.wreck.sightings.find((s) => s.id === id);
        if (!s) throw Error('Missing sight ' + id);
        const p = a.state.position,
          dx = s.position.x - p.x,
          dy = s.position.y - p.y,
          dz = s.position.z - p.z,
          c = a.controls;
        c.yaw = -Math.atan2(dx, -dz);
        c.pitch = Math.atan2(dy, Math.hypot(dx, dz));
        c.clear();
      }, id);
      await step();
    }
    assert((await read()).journal.includes(id), 'journal records ' + id);
  };
  const measure = async () => {
    await page.evaluate(() => {
      window.__forceRender = true;
    });
    await step(20);
    await page.evaluate(() => {
      window.__forceRender = false;
    });
  };
  const hole = await page.evaluate(() => window.__hole);
  const ship = async (x, y, z) =>
    page.evaluate((p) => window.__ship(p), { x, y, z });
  await page.evaluate(() => window.__cozy.tickOffice(0));
  await page
    .getByRole('button', { name: 'Enter the Office', exact: true })
    .click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await step(2);
  await go({ x: 0.2, z: 0.7 }, { tolerance: 0.12 });
  await page.evaluate(() => {
    const c = window.__cozy.controls;
    c.yaw = -Math.PI / 2 + 0.15;
    c.pitch = -0.15;
    c.clear();
  });
  await step(3);
  await page.keyboard.press('e');
  await step(70);
  assert.equal((await read()).mode, 'aquarium');
  report.baseline = await checkpoint('office-dive');
  const tankRoute = [
    { x: 0, y: 7, z: -7 },
    { x: 8, y: 6, z: -8 },
    { x: 7, y: 1.6, z: -12.1 },
    { x: 6.4, y: 1.6, z: -12.1 },
  ];
  for (let cycle = 1; cycle <= 3; cycle++) {
    for (const p of tankRoute) await go(p);
    await wait('outer');
    await go({ x: 1, y: 1.6, z: -12.1 }, { world: 'outer' });
    await wait('reef');
    for (const p of [
      { x: 0.6, y: 8.8, z: -6 },
      { x: 2.4, y: 8.3, z: -12 },
      { x: 1.2, y: 7.6, z: -18 },
      { x: -1.4, y: 7.2, z: -24 },
      { x: -0.6, y: 7, z: -33 },
      { x: -17.6, y: 7, z: -35 },
      { x: -17.6, y: 1.3, z: -32 },
    ])
      await go(p);
    await wait('kelp');
    await go({ x: -10, y: 1.3, z: -32 }, { world: 'kelp' });
    for (const p of [
      { x: 0, y: 5, z: -12 },
      { x: 0, y: 8, z: -35 },
      { ...hole.outside, y: 8 },
      hole.outside,
      hole.inside,
    ])
      await go(p);
    await wait('wreck');
    await go({ x: -10.4, y: -18, z: -47.1 }, { world: 'wreck' });
    await go({ x: 0, y: 12, z: -26.5 });
    await observe('place:shipwreck');
    if (cycle === 1) {
      const animals = () =>
        page.evaluate(() => {
          const l = window.__cozy.wreck.life;
          return {
            schools: l.schools.fish.simulation.fish.length,
            posed: l.posed.length,
            solos: l.solos.length,
            wrasse: { ...l.wrasse.pose.position },
            turtle: { ...l.turtle.pose.position },
            stroke: l.solos[0].near.morphTargetInfluences?.slice(),
          };
        });
      const before = await animals();
      await step(20);
      const after = await animals();
      assert(
        before.schools >= 200 && before.posed === 3 && before.solos === 19,
        'all wreck populations loaded',
      );
      assert.notDeepEqual(before.wrasse, after.wrasse, 'wrasse swims');
      assert.notDeepEqual(before.turtle, after.turtle, 'turtle swims');
      assert.notDeepEqual(
        before.stroke,
        after.stroke,
        'authored creature stroke animates',
      );
      report.marineLife = { before, after };
    }
    if (cycle === 1) await measure();
    await checkpoint(`cycle${cycle}-deck`);
    if (cycle === 1) {
      await go(await ship(0, 8.2, -37));
      await page.keyboard.down('w');
      await step(40, await ship(0, 3, -37));
      await page.keyboard.up('w');
      const blocked = await page.evaluate(() =>
        window.__toShip(window.__cozy.state.position),
      );
      assert(blocked.y >= 7.0, 'solid deck blocks descent outside the hatch');
      report.deckCollision = blocked;
      await go(await ship(0, 8.2, -37));
    }
    await go(await ship(0, 8.2, -31));
    await go(await ship(0, 3.3, -31));
    await step(20);
    assert((await read()).torch > 8, 'torch lights the hold');
    await observe('place:shipwreck-hold');
    await observe('species:queensland-grouper');
    if (cycle === 1) await measure();
    await checkpoint(`cycle${cycle}-hold`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.pointerLockElement);
    const paused = await read();
    const lifePose = await page.evaluate(() =>
      JSON.stringify(window.__cozy.wreck.life.patrol.pose),
    );
    await step(20);
    assert.deepEqual((await read()).p, paused.p);
    assert.equal(
      await page.evaluate(() =>
        JSON.stringify(window.__cozy.wreck.life.patrol.pose),
      ),
      lifePose,
      'wildlife freezes on pause',
    );
    await page.getByRole('button', { name: /Return to the Water/ }).click();
    await page.waitForFunction(() => !!document.pointerLockElement);
    await go(await ship(0, 8.2, -31));
    await go(await ship(0, 7.7, -24));
    await go(await ship(0, 7.7, -21.3));
    await go(await ship(-1.3, 7.7, -21.3));
    await go(await ship(-1.3, 7.7, -19.5));
    await step(20);
    assert((await read()).torch > 7, 'torch lights the bridge');
    await observe('place:shipwreck-bridge');
    if (cycle === 1) await measure();
    await checkpoint(`cycle${cycle}-bridge`);
    await go(await ship(-1.3, 7.7, -21.3));
    await go(await ship(0, 7.7, -21.3));
    await go(await ship(0, 7.7, -24));
    await go({ x: 0, y: 12, z: -26.5 });
    await step(20);
    assert((await read()).torch < 0.1, 'torch fades outside');
    await go({ x: 0, y: 27, z: -26.5 }, { world: 'kelp' });
    for (const p of [
      hole.inside,
      hole.outside,
      { ...hole.outside, y: 8 },
      { x: 0, y: 8, z: -35 },
      { x: 0, y: 5, z: -12 },
    ])
      await go(p);
    await go({ x: 0, y: 5, z: 1 }, { world: 'outer' });
    for (const p of [
      { x: -17.6, y: 1.3, z: -32 },
      { x: -17.6, y: 7, z: -35 },
      { x: -0.6, y: 7, z: -33 },
      { x: -1.4, y: 7.2, z: -24 },
      { x: 1.2, y: 7.6, z: -18 },
      { x: 2.4, y: 8.3, z: -12 },
      { x: 0.6, y: 8.8, z: -6 },
    ])
      await go(p);
    await go({ x: 0, y: 9, z: 2 }, { world: 'aquarium' });
    for (const p of [...tankRoute].reverse().slice(1)) await go(p);
    await go({ x: 0, y: 7, z: 11 });
    await step(100);
    const released = await checkpoint(`cycle${cycle}-released`);
    assert(
      !released.outer && !released.kelp && !released.wreck,
      'all distant scenes released',
    );
    assert.equal(
      released.leases,
      report.baseline.leases,
      'home fish leases return to baseline',
    );
    assert.equal(
      released.reefLeases,
      report.baseline.reefLeases,
      'home reef leases return to baseline',
    );
    report.cycles.push(released);
  }
  await go({ x: 0, y: 12.7, z: 11 });
  await page.evaluate(() => {
    const c = window.__cozy.controls;
    c.pitch = 1.3;
    c.clear();
  });
  await step(2);
  await page.keyboard.press('e');
  await step(70);
  assert.equal((await read()).mode, 'office');
  await checkpoint('returned-office');
  injecting = true;
  report.partialFailure = await page.evaluate(async () => {
    const a = window.__cozy,
      loader = a.world.authored.loader;
    const { WreckLife } = await import('/src/environment/wreck/WreckLife.ts');
    const { SoloCreature } =
      await import('/src/environment/outer/SoloCreature.ts');
    const baseline = loader.leased,
      original = SoloCreature.prototype.dispose;
    let failed = false,
      disposals = 0;
    SoloCreature.prototype.dispose = function () {
      disposals++;
      return original.call(this);
    };
    const proxy = {
      acquire(id) {
        if (id === 'barracuda' && !failed) {
          failed = true;
          return Promise.reject(Error('Injected single wildlife failure'));
        }
        return loader.acquire(id);
      },
      evictUnused: (id) => loader.evictUnused(id),
    };
    const life = new WreckLife(proxy);
    try {
      const ready = await life.ready;
      const beforeRelease = {
        ready,
        failed,
        disposals,
        retained: life.solos.length,
        children: life.root.children.length,
        leased: loader.leased,
      };
      life.dispose();
      return { ...beforeRelease, baseline, afterRelease: loader.leased };
    } finally {
      life.dispose();
      SoloCreature.prototype.dispose = original;
    }
  });
  injecting = false;
  assert.equal(report.expectedErrors.length, 2);
  assert.equal(report.partialFailure.ready, false);
  assert.equal(report.partialFailure.disposals, 1);
  assert.equal(
    report.partialFailure.afterRelease,
    report.partialFailure.baseline,
  );
  assert(
    report.partialFailure.children > 0,
    'healthy life survives a partial failure',
  );
  assert.deepEqual(
    report.cycles[1].memory,
    report.cycles[2].memory,
    'GPU counts stabilize after release',
  );
  assert.equal(
    report.cycles[1].leases,
    report.cycles[2].leases,
    'leases stabilize after release',
  );
  report.crossings = await page.evaluate(() => window.__crossings);
  assert.equal(report.crossings.length, 18);
  for (const c of report.crossings) {
    assert(
      c.before.dark > 0.85 && c.after.dark > 0.85,
      'crossings remain dark',
    );
    assert(
      Math.abs(c.before.dark - c.after.dark) < 0.15,
      'continuous passage darkness',
    );
  }
  report.samples = await page.evaluate(() => window.__samples);
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
  report.success = true;
} catch (e) {
  report.failure = e.stack;
  if (page) {
    report.last = await page
      .evaluate(() => window.__read?.())
      .catch(() => null);
    report.samples = await page
      .evaluate(() => window.__samples)
      .catch(() => []);
    await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  }
  throw e;
} finally {
  fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
