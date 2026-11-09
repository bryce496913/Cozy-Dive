/* Optional Pass 009 rendered evidence and isolated CPU diagnostics. See validation/README.md. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy009-browser';
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
      l = q.anchoredLife,
      geometries = new Set(),
      materials = new Set();
    q.root.traverse((v) => {
      if (v.geometry) geometries.add(v.geometry);
      if (v.material)
        for (const m of Array.isArray(v.material) ? v.material : [v.material])
          materials.add(m);
    });
    return {
      fish: q.fish.simulation.fish.reduce((r, f) => {
        r[f.species.id] = (r[f.species.id] || 0) + 1;
        return r;
      }, {}),
      hulls: q.collision.colliders.length,
      geometries: geometries.size,
      materials: materials.size,
      host: l.anemone.host,
      moray: l.moray.anchor,
      anemoneVertices: l.anemone.geometry.attributes.position.count,
      morayVertices: l.moray.geometry.attributes.position.count,
    };
  });
  assert.equal(
    Object.values(inventory.fish).reduce((a, b) => a + b, 0),
    40,
  );
  assert.equal(inventory.fish['ocellaris-clownfish'], 2);
  const views = [];
  for (const name of [
    'overview',
    'host-pair',
    'anemone',
    'clownfish',
    'eel-hidden',
    'eel-peeking',
    'eel-resting',
    'eel-emerging',
    'eel-retreating',
    'eel-head',
  ]) {
    const result = await page.evaluate(async (name) => {
      const THREE = await import('/node_modules/.vite/deps/three.js'),
        a = window.__cozy,
        w = a.world,
        q = w.aquarium,
        l = q.anchoredLife,
        m = l.moray;
      if (name.startsWith('eel-')) {
        const desired = name === 'eel-head' ? 'resting' : name.slice(4);
        let steps = 0;
        const settled = () =>
          desired === 'hidden'
            ? m.behavior.extension < 0.02
            : desired === 'peeking'
              ? m.behavior.extension > 0.5
              : desired === 'resting'
                ? m.behavior.extension > 0.76
                : desired === 'emerging'
                  ? m.behavior.extension > 0.96
                  : m.behavior.extension > 0.25 && m.behavior.extension < 0.65;
        while ((m.behavior.state !== desired || !settled()) && steps++ < 15000)
          m.update(1 / 30, true, false);
        if (steps >= 15000) throw Error('Eel state capture timeout');
        const target = new THREE.Vector3(
            0,
            0,
            name === 'eel-head' ? 1.65 : 0.85,
          ).applyMatrix4(m.root.matrixWorld),
          camera = new THREE.Vector3(
            name === 'eel-head' ? 0.55 : 0.8,
            name === 'eel-head' ? 0.15 : 0.3,
            name === 'eel-head' ? 2.9 : 3.7,
          ).applyMatrix4(m.root.matrixWorld);
        w.camera.position.copy(camera);
        w.camera.lookAt(target);
      } else if (name === 'overview') {
        w.camera.position.set(0, 13, 25);
        w.camera.lookAt(0, 2, -3);
      } else if (name === 'clownfish') {
        const f = q.fish.simulation.fish.find((f) => f.host),
          p = f.position;
        w.camera.position.set(
          p.x + Math.sin(f.yaw) * 1.6,
          p.y + 0.12,
          p.z + Math.cos(f.yaw) * 1.6,
        );
        w.camera.lookAt(p.x, p.y, p.z);
      } else {
        const p = l.anemone.root.position,
          center = l.anemone.host.position;
        const target = new THREE.Vector3(p.x, (p.y + center.y) / 2 + 0.15, p.z),
          offset =
            name === 'anemone'
              ? new THREE.Vector3(1.3, 1, 2.2)
              : new THREE.Vector3(2.6, 1.5, 3.7);
        w.camera.position.copy(target).add(offset);
        w.camera.lookAt(target);
      }
      w.camera.updateMatrixWorld(true);
      w.authored.update();
      w.renderer.render(w.scene, w.camera);
      return {
        name,
        camera: w.camera.position.toArray(),
        draws: w.renderer.info.render.calls,
        triangles: w.renderer.info.render.triangles,
        eel: {
          state: m.behavior.state,
          extension: m.behavior.extension,
          time: m.behavior.time,
        },
      };
    }, name);
    views.push(result);
    await page.screenshot({ path: path.join(output, name + '.png') });
    if (name === 'anemone') {
      const times = await page.evaluate(() => {
        const w = window.__cozy.world,
          n = w.aquarium.anchoredLife.anemone,
          before = n.clock.time;
        for (let i = 0; i < 150; i++) n.update(1 / 30, true, false);
        w.authored.update();
        w.renderer.render(w.scene, w.camera);
        return { before, after: n.clock.time };
      });
      assert(times.after - times.before > 4.9);
      views.push({ name: 'anemone-motion', ...times });
      await page.screenshot({ path: path.join(output, 'anemone-motion.png') });
    }
  }
  const response = await page.evaluate(() => {
    const w = window.__cozy.world,
      m = w.aquarium.anchoredLife.moray,
      before = m.behavior.extension,
      retreats = m.behavior.retreats;
    for (let i = 0; i < 30; i++)
      m.update(1 / 30, true, false, {
        position: m.anchor.position,
        velocity: { x: 0, y: 0, z: 0 },
        active: true,
      });
    w.authored.update();
    w.renderer.render(w.scene, w.camera);
    return {
      before,
      after: m.behavior.extension,
      state: m.behavior.state,
      retreats: m.behavior.retreats - retreats,
    };
  });
  assert(response.after < response.before - 0.2);
  assert(response.retreats > 0);
  await page.screenshot({ path: path.join(output, 'eel-diver-retreat.png') });
  const profile = await page.evaluate(async () => {
    const q = window.__cozy.world.aquarium,
      l = q.anchoredLife,
      ms = [];
    for (let i = 0; i < 240; i++) {
      const start = performance.now();
      for (let j = 0; j < 20; j++) l.update(1 / 30, true, false);
      ms.push((performance.now() - start) / 20);
    }
    const { FishSimulation } = await import('/src/fish/FishMovement.ts'),
      { spawnFish } = await import('/src/fish/FishSpawner.ts'),
      { FISH_SPECIES } = await import('/src/fish/FishSpecies.ts');
    const isolated = new FishSimulation(
        spawnFish(q.fish.simulation.habitat, [
          FISH_SPECIES.find((s) => s.id === 'ocellaris-clownfish'),
        ]),
        q.fish.simulation.habitat,
      ),
      pairMs = [];
    for (let i = 0; i < 240; i++) {
      const start = performance.now();
      for (let j = 0; j < 20; j++) isolated.advance(1 / 30, true);
      pairMs.push((performance.now() - start) / 20);
    }
    pairMs.sort((a, b) => a - b);
    ms.sort((a, b) => a - b);
    const pair = q.fish.simulation.fish.filter((f) => f.host),
      h = q.fish.simulation.habitat;
    return {
      samples: ms.length,
      batchSize: 20,
      clownfishStepMs: {
        mean: pairMs.reduce((a, b) => a + b, 0) / pairMs.length,
        p95: pairMs[Math.floor(pairMs.length * 0.95)],
        p99: pairMs[Math.floor(pairMs.length * 0.99)],
      },
      anchoredMs: {
        mean: ms.reduce((a, b) => a + b, 0) / ms.length,
        p95: ms[Math.floor(ms.length * 0.95)],
        p99: ms[Math.floor(ms.length * 0.99)],
      },
      pair: pair.map((f) => ({
        id: f.id,
        size: f.size,
        homeDistance: Math.hypot(
          f.position.x - f.host.position.x,
          f.position.y - f.host.position.y,
          f.position.z - f.host.position.z,
        ),
        corrections: f.corrections,
      })),
      hostCount: h.creatureAnchors.length,
    };
  });
  const pause = await page.evaluate(() => {
    const l = window.__cozy.world.aquarium.anchoredLife,
      before = {
        anemone: l.anemone.clock.time,
        eel: l.moray.behavior.time,
        extension: l.moray.behavior.extension,
      };
    l.update(60, false, false);
    return {
      before,
      after: {
        anemone: l.anemone.clock.time,
        eel: l.moray.behavior.time,
        extension: l.moray.behavior.extension,
      },
    };
  });
  assert.deepEqual(pause.before, pause.after);
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
          'Chromium/SwiftShader; fixed camera fixtures, diagnostic CPU timings, no hardware FPS claim',
        inventory,
        views,
        profile,
        response,
        pause,
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
