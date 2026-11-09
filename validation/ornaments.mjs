/* Optional Pass 008 camera/control evidence; use the same Playwright/Chromium setup as browser.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy-ornaments-browser';
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
try {
  const page = await browser.newPage({
      viewport: { width: 1100, height: 750 },
    }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
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
  await page.evaluate(() => cancelAnimationFrame(window.__cozy.frame));
  const inventory = await page.evaluate(() => {
    const a = window.__cozy,
      q = a.world.aquarium;
    const geometries = new Set(),
      materials = new Set();
    q.root.traverse((v) => {
      if (v.geometry) geometries.add(v.geometry);
      if (v.material)
        for (const m of Array.isArray(v.material) ? v.material : [v.material])
          materials.add(m);
    });
    return {
      ownedGeometryCount: geometries.size,
      ownedMaterialCount: materials.size,
      fish: q.fish.simulation.fish.length,
      solids: q.collision.colliders.length,
      grass: q.grass.patches,
      anchors: q.ornaments.anchors,
      models: q.ornaments.models.map((m) => ({
        kind: m.kind,
        position: m.root.position.toArray(),
        rotation: m.root.rotation.toArray(),
      })),
    };
  });
  assert.equal(inventory.models.length, 6);
  assert.equal(inventory.fish, 40);
  const views = [];
  for (const kind of [
    'overview',
    'chest',
    'filter',
    'arch',
    'shipwreck',
    'log',
    'statue',
  ]) {
    const view = await page.evaluate(async (kind) => {
      const THREE = await import('/node_modules/.vite/deps/three.js'),
        a = window.__cozy,
        w = a.world,
        o = w.aquarium.ornaments;
      if (kind === 'overview') {
        w.camera.position.set(0, 13, 25);
        w.camera.lookAt(0, 2, -3);
      } else {
        const m = o.models.find((m) => m.kind === kind),
          target = new THREE.Vector3(
            0,
            kind === 'filter'
              ? 0
              : kind === 'statue'
                ? 1.7
                : kind === 'arch'
                  ? 1.5
                  : 1,
            0,
          ).applyMatrix4(m.root.matrixWorld);
        const offset =
          kind === 'filter'
            ? [-2, 0.5, 4]
            : kind === 'log'
              ? [0.7, 1, 4.6]
              : kind === 'arch'
                ? [3.7, 1.6, 5.2]
                : kind === 'shipwreck'
                  ? [3.3, 2.5, 4.5]
                  : [Math.sign(m.root.position.x) * -2.7, 1.7, 4.2];
        w.camera.position.copy(target).add(new THREE.Vector3(...offset));
        w.camera.lookAt(target);
      }
      w.camera.updateMatrixWorld(true);
      w.authored.update();
      w.renderer.render(w.scene, w.camera);
      return {
        kind,
        calls: w.renderer.info.render.calls,
        triangles: w.renderer.info.render.triangles,
        camera: w.camera.position.toArray(),
      };
    }, kind);
    views.push(view);
    await page.screenshot({ path: path.join(output, kind + '.png') });
  }
  // Opening/current evidence uses bounded active updates, not wall-clock manipulation.
  const animation = await page.evaluate(() => {
    const a = window.__cozy,
      w = a.world,
      o = w.aquarium.ornaments,
      m = o.models.find((m) => m.kind === 'chest');
    o.chest.time = 0;
    for (let i = 0; i < 115; i++) o.update(0.1, true, false);
    const target = m.root.position.clone();
    target.y += 0.8;
    w.camera.position.copy(target).add({ x: 2.8, y: 2.2, z: 4 });
    w.camera.lookAt(target);
    w.camera.updateMatrixWorld(true);
    w.authored.update();
    w.renderer.render(w.scene, w.camera);
    const before = {
      time: o.chest.time,
      angle: o.chest.angle,
      bubbles: o.bubbles.mesh.count,
    };
    o.update(60, false, false);
    return {
      before,
      paused: {
        time: o.chest.time,
        angle: o.chest.angle,
        bubbles: o.bubbles.mesh.count,
      },
      burstCount: o.bubbles.bursts,
    };
  });
  assert.deepEqual(animation.before, animation.paused);
  assert(animation.before.bubbles > 0);
  assert(animation.before.angle > 0.8);
  await page.screenshot({ path: path.join(output, 'chest-open-bubbles.png') });
  const cleanup = await page.evaluate(() => {
    const a = window.__cozy,
      r = a.world.renderer;
    const before = { ...r.info.memory },
      context = a.audio.context;
    a.dispose();
    return {
      before,
      after: { ...r.info.memory },
      audio: context.state,
    };
  });
  assert.equal(cleanup.after.geometries, 0);
  assert.equal(cleanup.after.textures, 0);
  assert.equal(cleanup.audio, 'closed');
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(
      {
        renderer:
          'Chromium SwiftShader software rendering; camera fixtures, not player navigation or hardware FPS measurements',
        inventory,
        views,
        animation,
        cleanup,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ output, animation, cleanup, errors }, null, 2));
} finally {
  await browser.close();
}
