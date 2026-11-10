/* Pass 013: paired render evidence, local asset ownership and fallback. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy013-geometry';
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
// Pass 014: SwiftShader compiles the heavier reef's shader variants lazily on first
// present (tens of seconds in software). Raise Playwright *action* timeouts only;
// no assertion or measured budget changes. Override with COZY_ACTION_TIMEOUT.
const openPage = browser.newPage.bind(browser);
browser.newPage = async (options) => {
  const page = await openPage(options);
  page.setDefaultTimeout(Number(process.env.COZY_ACTION_TIMEOUT || 240000));
  return page;
};
const base = process.env.COZY_URL || 'http://127.0.0.1:5173';
const report = { views: [], requests: [], errors: [] };
async function open() {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 750 },
  });
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body: (await r.text()) + '\nwindow.__cozy=app;',
    });
  });
  return page;
}
try {
  const page = await open();
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  page.on('request', (r) => {
    if (r.url().includes('.glb')) report.requests.push(r.url());
  });
  await page.goto(base);
  await page.waitForFunction(() => window.__cozy?.world);
  assert.equal(
    await page.evaluate(() => window.__cozy.world.authored.ready),
    true,
  );
  await page
    .getByRole('button', { name: 'Enter the Water', exact: true })
    .click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.evaluate(() => cancelAnimationFrame(window.__cozy.frame));
  for (const kind of process.env.COZY_GEOMETRY_PROBE
    ? []
    : [
        'log',
        'shipwreck',
        'arch',
        'filter',
        'chest',
        'statue',
        'seahorse',
        'frogfish',
        'moray',
        'host-pair',
      ]) {
    await page.evaluate(async (kind) => {
      const THREE = await import('/node_modules/.vite/deps/three.js'),
        w = window.__cozy.world,
        q = w.aquarium;
      let target = new THREE.Vector3(),
        offset;
      const model = q.ornaments.models.find((m) => m.kind === kind);
      if (model) {
        target
          .set(
            0,
            kind === 'filter'
              ? 0
              : kind === 'statue'
                ? 1.7
                : kind === 'arch'
                  ? 1.5
                  : 1,
            0,
          )
          .applyMatrix4(model.root.matrixWorld);
        offset =
          kind === 'filter'
            ? [-2, 0.5, 4]
            : kind === 'log'
              ? [0.7, 1, 4.6]
              : kind === 'arch'
                ? [3.7, 1.6, 5.2]
                : kind === 'shipwreck'
                  ? [3.3, 2.5, 4.5]
                  : [Math.sign(model.root.position.x) * -2.7, 1.7, 4.2];
      } else if (kind === 'moray') {
        const m = q.anchoredLife.moray;
        m.extensionUniform.value = 0.7;
        m.behavior.extension = 0.7;
        m.update(1 / 30, true, false);
        m.head.getWorldPosition(target);
        offset = [1, 0.65, 2.4];
      } else if (kind === 'host-pair') {
        q.anchoredLife.anemone.root.getWorldPosition(target);
        target.y += 0.5;
        offset = [2, 1.5, 3.4];
      } else {
        const animal = q.anchoredLife.hidden[kind];
        animal.root.updateMatrixWorld(true);
        target
          .set(0, kind === 'seahorse' ? 0.65 : 0.3, 0)
          .applyMatrix4(animal.root.matrixWorld);
        offset = kind === 'seahorse' ? [0.8, 0.2, 1.35] : [1, 0.45, 1.4];
      }
      w.camera.position.copy(target).add(new THREE.Vector3(...offset));
      w.camera.lookAt(target);
      w.camera.updateMatrixWorld(true);
    }, kind);
    for (const enabled of [false, true]) {
      const metrics = await page.evaluate((enabled) => {
        const w = window.__cozy.world;
        w.authored.setEnabled(enabled);
        w.authored.update();
        const times = [];
        for (let i = 0; i < 2; i++) {
          const t = performance.now();
          w.renderer.render(w.scene, w.camera);
          w.renderer.getContext().finish();
          times.push(performance.now() - t);
        }
        return {
          enabled,
          calls: w.renderer.info.render.calls,
          triangles: w.renderer.info.render.triangles,
          memory: { ...w.renderer.info.memory },
          softwareSynchronizedFrameMs: times,
        };
      }, enabled);
      const file = `${kind}-${enabled ? 'after' : 'before'}.png`;
      await page.screenshot({ path: path.join(output, file) });
      report.views.push({ kind, file, ...metrics });
    }
  }
  report.animation = await page.evaluate(() => {
    const w = window.__cozy.world,
      q = w.aquarium,
      school = w.authored.school('ocellaris-clownfish');
    const morph = school.meshes.find((m) => m.morphTexture);
    const sample = () => ({
      matrix: Array.from(school.meshes[0].instanceMatrix.array),
      morph: Array.from(morph.morphTexture.image.data),
      current: q.anchoredLife.anemone.timeUniform.value,
    });
    w.authored.update();
    const before = sample();
    for (let i = 0; i < 90; i++) {
      q.update(i / 30, false, 1 / 30, true);
      w.authored.update();
    }
    const active = sample();
    q.update(1000, false, 1000, false);
    w.authored.update();
    const paused = sample();
    return {
      rigs: school.rigs.length,
      finite: [...active.matrix, ...active.morph].every(Number.isFinite),
      moved: active.matrix.some(
        (v, i) => Math.abs(v - before.matrix[i]) > 1e-4,
      ),
      morphed: active.morph.some(
        (v, i) => Math.abs(v - before.morph[i]) > 1e-4,
      ),
      paused: JSON.stringify(active) === JSON.stringify(paused),
    };
  });
  assert.deepEqual(report.animation, {
    rigs: 2,
    finite: true,
    moved: true,
    morphed: true,
    paused: true,
  });
  report.anatomy = await page.evaluate(async () => {
    const { safeFishPosition } = await import('/src/fish/FishHabitat.ts'),
      THREE = await import('/node_modules/.vite/deps/three.js'),
      q = window.__cozy.world.aquarium,
      d = q.anchoredLife.hidden,
      p = new THREE.Vector3();
    let samples = 0;
    const intrusions = [];
    for (const time of [0, 41, 108, 220]) {
      d.seahorse.pose(time);
      d.frogfish.pose(time);
      q.root.updateMatrixWorld(true);
      for (const animal of [d.seahorse, d.frogfish]) {
        const near = q.collision.colliders.filter(
          (c) =>
            c.max.x > animal.root.position.x - 1.5 &&
            c.min.x < animal.root.position.x + 1.5 &&
            c.max.z > animal.root.position.z - 1.5 &&
            c.min.z < animal.root.position.z + 1.5,
        );
        animal.root.traverse((o) => {
          if (!o.isMesh) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          if (!mats.some((m) => m.visible)) return;
          const a = o.geometry.attributes.position;
          for (let i = 0; i < a.count; i += 3) {
            p.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld);
            samples++;
            if (
              !safeFishPosition(p, 0.001, {
                bounds: q.fish.simulation.habitat.bounds,
                rocks: near,
              }) &&
              intrusions.length < 8
            )
              intrusions.push({
                name: o.name,
                time,
                point: p.toArray(),
                local: [a.getX(i), a.getY(i), a.getZ(i)],
                root: animal.root.position.toArray(),
                hulls: near
                  .filter(
                    (c) =>
                      !safeFishPosition(p, 0.001, {
                        bounds: q.fish.simulation.habitat.bounds,
                        rocks: [c],
                      }),
                  )
                  .map((c) => ({ min: c.min, max: c.max })),
              });
          }
        });
      }
    }
    return { samples, intrusions };
  });
  assert.deepEqual(report.anatomy.intrusions, []);
  report.inventory = await page.evaluate(() => {
    const q = window.__cozy.world.aquarium;
    return {
      fish: q.fish.simulation.fish.length,
      hidden: q.anchoredLife.hidden.homes.length,
      hulls: q.collision.colliders.length,
    };
  });
  // Pass 014: the reef library is the fourth local request; reef parts replace rock hulls.
  assert.deepEqual(report.inventory, { fish: 41, hidden: 7, hulls: 435 });
  assert.equal(report.requests.length, 10); // + Pass 015 nudibranchs + Pass 016 five fish libraries
  assert.deepEqual(report.errors, []);
  report.cleanup = await page.evaluate(() => {
    const w = window.__cozy.world;
    window.__cozy.dispose();
    return { ...w.renderer.info.memory };
  });
  assert.deepEqual(report.cleanup, { geometries: 0, textures: 0 });
  await page.close();
  // A missing library must leave a usable procedural world and no unhandled rejection.
  const fallback = await open(),
    failures = [];
  fallback.on('pageerror', (e) => failures.push(e.message));
  await fallback.route('**/reef-props.glb', (r) => r.abort());
  await fallback.goto(base);
  await fallback.waitForFunction(() => window.__cozy?.world);
  assert.equal(
    await fallback.evaluate(() => window.__cozy.world.authored.ready),
    false,
  );
  await fallback
    .getByRole('button', { name: 'Enter the Water', exact: true })
    .click();
  await fallback.waitForFunction(() => !!document.pointerLockElement);
  assert.equal(
    await fallback.evaluate(
      () => window.__cozy.world.aquarium.collision.colliders.length,
    ),
    // Procedural ornament hulls remain; the independent Pass 014 reef library still loads and
    // replaces the 34 rock hulls with its 253 authored parts (139 - 34 + 253).
    358,
  );
  assert.match(
    await fallback.getByRole('status').textContent(),
    /could not load/,
  );
  await fallback.evaluate(() => window.__cozy.dispose());
  assert.deepEqual(failures, []);
  report.fallback = 'passed';
  await fallback.close();
  // Dispose while requests are held: late decode must not reattach or upload resources.
  let releaseRequests;
  const gate = new Promise((resolve) => {
    releaseRequests = resolve;
  });
  const pending = await open(),
    pendingErrors = [];
  pending.on('pageerror', (e) => pendingErrors.push(e.message));
  await pending.route('**/*.glb', async (route) => {
    await gate;
    await route.continue();
  });
  await pending.goto(base);
  await pending.waitForFunction(() => window.__cozy?.world);
  await pending.evaluate(() => window.__cozy.dispose());
  releaseRequests();
  assert.equal(
    await pending.evaluate(() => window.__cozy.world.authored.ready),
    false,
  );
  report.pendingCleanup = await pending.evaluate(() => ({
    ...window.__cozy.world.renderer.info.memory,
  }));
  assert.deepEqual(report.pendingCleanup, { geometries: 0, textures: 0 });
  assert.deepEqual(pendingErrors, []);
  await pending.close();
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
