/* Pass 010 camera and CPU evidence. Uses the optional local Playwright/Chromium setup. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy010-browser';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.COZY_CHROMIUM || undefined,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
// Pass 014: SwiftShader compiles the heavier reef's shader variants lazily on first
// present (tens of seconds in software). Raise Playwright *action* timeouts only;
// no assertion or measured budget changes. Override with COZY_ACTION_TIMEOUT.
const openPage = browser.newPage.bind(browser);
browser.newPage = async (options) => {
  const page = await openPage(options);
  page.setDefaultTimeout(Number(process.env.COZY_ACTION_TIMEOUT || 240000));
  return page;
};
try {
  const page = await browser.newPage({
      viewport: { width: 1100, height: 750 },
    }),
    errors = [],
    warnings = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning') warnings.push(m.text());
  });
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body: (await r.text()) + '\nwindow.__cozy=app;',
    });
  });
  await page.goto(process.env.COZY_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(
    () => window.__cozy?.world?.renderer.info.render.calls > 0,
  );
  const authored = await page.evaluate(
    () => window.__cozy.world.authored.ready,
  );
  assert.equal(authored, true);
  await page
    .getByRole('button', { name: 'Enter the Water', exact: true })
    .click();
  await page.waitForFunction(
    () =>
      !!document.pointerLockElement &&
      document.querySelector('#overlay').hidden,
  );
  await page.evaluate(() => {
    const a = window.__cozy;
    cancelAnimationFrame(a.frame);
    for (let i = 0; i < 600; i++)
      a.world.aquarium.update(i / 30, false, 1 / 30, true);
  });
  const inventory = await page.evaluate(() => {
    const q = window.__cozy.world.aquarium,
      d = q.anchoredLife.hidden,
      geometries = new Set(),
      materials = new Set();
    q.root.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material)
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          materials.add(m);
    });
    return {
      fish: q.fish.simulation.fish.length,
      hulls: q.collision.colliders.length,
      geometries: geometries.size,
      materials: materials.size,
      hiddenCount: d.homes.length,
      nudiDraws: d.nudibranchs.meshes.length,
      homes: d.homes.map((h) => ({
        id: h.id,
        source: h.sourceId,
        position: h.position,
        orientation: h.orientation,
        view: h.view,
        focus: h.focus,
        approach: h.approach,
        channelOccluded: h.channelOccluded,
      })),
      variants: d.nudibranchs.animals.map((a) => ({
        id: a.id,
        variant: a.variant.id,
      })),
    };
  });
  assert.equal(inventory.hiddenCount, 7);
  assert.equal(inventory.fish, 41);
  assert.equal(inventory.hulls, 521); // Pass 014 reef parts; Pass 019 wreck; Pass 023 crevice (+12); Pass 026 playtest (+6)
  const views = [];
  for (const name of [
    'overview',
    ...inventory.homes.flatMap((h) => [h.id + '-wide', h.id + '-close']),
  ]) {
    const r = await page.evaluate((name) => {
      const w = window.__cozy.world,
        d = w.aquarium.anchoredLife.hidden;
      if (name === 'overview') {
        w.camera.position.set(0, 13, 25);
        w.camera.lookAt(0, 2, -3);
      } else {
        const wide = name.endsWith('-wide'),
          id = name.slice(0, wide ? -5 : -6),
          home = d.homes.find((h) => h.id === id),
          p = home.focus;
        if (wide) w.camera.position.set(0, p.y + 0.7, p.z + 2.7);
        else w.camera.position.set(home.view.x, home.view.y, home.view.z);
        w.camera.lookAt(p.x, p.y, p.z);
      }
      w.camera.updateMatrixWorld(true);
      w.authored.update();
      w.renderer.render(w.scene, w.camera);
      return {
        name,
        draws: w.renderer.info.render.calls,
        triangles: w.renderer.info.render.triangles,
        camera: w.camera.position.toArray(),
      };
    }, name);
    views.push(r);
    await page.screenshot({ path: path.join(output, name + '.png') });
  }
  const crawling = await page.evaluate(() => {
    const w = window.__cozy.world,
      d = w.aquarium.anchoredLife.hidden,
      n = d.nudibranchs.animals[0],
      home = n.home,
      before = n.pose.position.toArray();
    for (let i = 0; i < 3600; i++) d.update(1 / 30, true, false);
    w.camera.position.set(home.view.x, home.view.y, home.view.z);
    w.camera.lookAt(home.focus.x, home.focus.y, home.focus.z);
    w.camera.updateMatrixWorld(true);
    w.authored.update();
    w.renderer.render(w.scene, w.camera);
    return {
      seconds: 120,
      before,
      after: n.pose.position.toArray(),
      surface: n.home.sourceId,
    };
  });
  assert(
    Math.hypot(...crawling.after.map((v, i) => v - crawling.before[i])) > 0.05,
  );
  await page.screenshot({
    path: path.join(output, 'nudibranch-1-after-two-minutes.png'),
  });
  const walking = await page.evaluate(() => {
    const w = window.__cozy.world,
      d = w.aquarium.anchoredLife.hidden,
      f = d.frogfish;
    let steps = 0;
    while (
      (d.clock.sample % 112 < 105 || d.clock.sample % 112 > 107) &&
      steps++ < 15000
    )
      d.update(1 / 30, true, false);
    if (steps >= 15000) throw Error('Walking capture budget');
    const home = f.home;
    w.camera.position.set(home.view.x, home.view.y, home.view.z);
    w.camera.lookAt(home.focus.x, home.focus.y, home.focus.z);
    w.camera.updateMatrixWorld(true);
    w.authored.update();
    w.renderer.render(w.scene, w.camera);
    return {
      walking: f.walking,
      time: d.clock.sample,
      position: f.root.position.toArray(),
      leftLift: f.leftFoot.position.y,
      rightLift: f.rightFoot.position.y,
    };
  });
  assert(walking.walking);
  await page.screenshot({ path: path.join(output, 'frogfish-rare-walk.png') });
  const profile = await page.evaluate(() => {
    const w = window.__cozy.world,
      d = w.aquarium.anchoredLife.hidden,
      ms = [];
    for (let i = 0; i < 240; i++) {
      const start = performance.now();
      for (let j = 0; j < 20; j++) d.update(1 / 30, true, false);
      ms.push((performance.now() - start) / 20);
    }
    ms.sort((a, b) => a - b);
    const p = d.homes[0].focus;
    w.camera.position.set(0, 13, 25);
    w.camera.lookAt(0, 2, -3);
    w.camera.updateMatrixWorld(true);
    w.authored.update();
    w.renderer.render(w.scene, w.camera);
    const withHidden = {
      draws: w.renderer.info.render.calls,
      triangles: w.renderer.info.render.triangles,
    };
    d.root.visible = false;
    w.authored.update();
    w.renderer.render(w.scene, w.camera);
    const withoutHidden = {
      draws: w.renderer.info.render.calls,
      triangles: w.renderer.info.render.triangles,
    };
    d.root.visible = true;
    return {
      batches: 240,
      updatesPerBatch: 20,
      updateMs: {
        mean: ms.reduce((a, b) => a + b, 0) / ms.length,
        p95: ms[Math.floor(ms.length * 0.95)],
        p99: ms[Math.floor(ms.length * 0.99)],
      },
      withHidden,
      withoutHidden,
      focus: p,
    };
  });
  const pause = await page.evaluate(() => {
    const d = window.__cozy.world.aquarium.anchoredLife.hidden,
      snapshot = () => ({
        time: d.clock.time,
        motion: d.clock.sample,
        seahorse: d.seahorse.root.position.toArray(),
        frog: d.frogfish.root.position.toArray(),
        nudis: d.nudibranchs.animals.map((a) => a.pose.position.toArray()),
      }),
      before = snapshot();
    d.update(60, false, false);
    return { before, after: snapshot() };
  });
  assert.deepEqual(pause.before, pause.after);
  const reduced = await page.evaluate(() => {
    const d = window.__cozy.world.aquarium.anchoredLife.hidden;
    for (let i = 0; i < 900; i++) d.update(1 / 30, true, true);
    const before = d.clock.sample;
    for (let i = 0; i < 60; i++) d.update(1 / 30, true, true);
    return { before, after: d.clock.sample };
  });
  assert(Math.abs(reduced.after - reduced.before) < 1e-6);
  const cleanup = await page.evaluate(() => {
    const a = window.__cozy,
      r = a.world.renderer,
      c = a.audio.context,
      before = { ...r.info.memory };
    a.dispose();
    return { before, after: { ...r.info.memory }, audio: c.state };
  });
  assert.equal(cleanup.after.geometries, 0);
  assert.equal(cleanup.after.textures, 0);
  assert.equal(cleanup.audio, 'closed');
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(
      {
        backend:
          'Chromium SwiftShader; fixed camera fixtures and diagnostic CPU timings, no hardware FPS claim',
        inventory,
        views,
        crawling,
        walking,
        profile,
        pause,
        reduced,
        cleanup,
        errors,
        warnings,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ output, profile, cleanup, errors, warnings }, null, 2),
  );
} finally {
  await browser.close();
}
