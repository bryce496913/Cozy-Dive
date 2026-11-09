/* Pass 012: real glTF decoding, matched cameras, authored morph animation, budgets and ownership. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy012-visual';
fs.mkdirSync(output, { recursive: true });
const url = process.env.COZY_URL || 'http://127.0.0.1:5176';
const stats = (values) => {
  const a = [...values].sort((x, y) => x - y);
  return {
    mean: a.reduce((n, x) => n + x, 0) / a.length,
    median: a[Math.floor(a.length / 2)],
    p95: a[Math.min(a.length - 1, Math.floor(a.length * 0.95))],
    p99: a[Math.min(a.length - 1, Math.floor(a.length * 0.99))],
    samples: a.length,
  };
};
const browser = await chromium.launch({
  executablePath: process.env.COZY_CHROMIUM || undefined,
  headless: true,
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
    warnings = [],
    requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning') warnings.push(m.text());
  });
  page.on('request', (r) => {
    if (r.url().includes('.glb')) requests.push(r.url());
  });
  const loadStart = Date.now();
  await page.goto(url + '/benchmark.html');
  await page.waitForFunction(
    () => !!window.__visualBenchmark?.showcase,
    {},
    { timeout: 60000 },
  );
  assert.equal(
    await page.evaluate(() => window.__visualBenchmark.world.authored.ready),
    true,
  );
  const loadMs = Date.now() - loadStart;
  await page.evaluate(() =>
    cancelAnimationFrame(window.__visualBenchmark.app.frame),
  );
  await page.getByRole('button', { name: 'Enter the Water' }).click();
  await page.waitForFunction(
    () =>
      !!document.pointerLockElement &&
      window.__visualBenchmark.app.entered &&
      document.querySelector('#overlay').hidden &&
      window.__visualBenchmark.app.audio.context.state === 'running',
  );
  const nativeStart = await page.evaluate(() => ({
    ...window.__visualBenchmark.app.state.position,
  }));
  await page.keyboard.down('w');
  await page.evaluate(() => {
    const a = window.__visualBenchmark.app;
    a.previous = 0;
    for (let i = 0; i < 24; i++) {
      a.tick(1000 + (i * 1000) / 30);
      cancelAnimationFrame(a.frame);
    }
  });
  await page.keyboard.up('w');
  const nativeSwim = await page.evaluate(() => {
    const { app, world } = window.__visualBenchmark,
      p = app.state.position;
    return {
      position: { ...p },
      inside: world.aquarium.collision.colliders.some((c) =>
        world.aquarium.collision.contains(c, p.x, p.y, p.z),
      ),
    };
  });
  assert(!nativeSwim.inside);
  assert(
    Math.hypot(
      ...Object.keys(nativeStart).map(
        (k) => nativeSwim.position[k] - nativeStart[k],
      ),
    ) > 0.2,
  );
  await page.evaluate(() => {
    const { app, world } = window.__visualBenchmark;
    cancelAnimationFrame(app.frame);
    for (let i = 0; i < 600; i++)
      world.aquarium.update(i / 30, false, 1 / 30, true);
    document.querySelector('aside').hidden = true;
  });
  const inventory = await page.evaluate(() => {
    const { world, showcase } = window.__visualBenchmark,
      resources = (root) => {
        const geometries = new Set(),
          materials = new Set(),
          textures = new Set();
        root.traverse((o) => {
          if (o.geometry) geometries.add(o.geometry);
          if (o.material)
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material]) {
              materials.add(m);
              for (const value of Object.values(m))
                if (value?.isTexture) textures.add(value);
            }
        });
        let geometryBytes = 0,
          textureBytes = 0;
        for (const g of geometries) {
          for (const a of Object.values(g.attributes))
            geometryBytes += a.array.byteLength;
          for (const a of Object.values(g.morphAttributes).flat())
            geometryBytes += a.array.byteLength;
          if (g.index) geometryBytes += g.index.array.byteLength;
        }
        for (const t of textures) {
          const i = t.image;
          textureBytes += ((i?.width || 0) * (i?.height || 0) * 4 * 4) / 3;
        }
        return {
          geometries: geometries.size,
          materials: materials.size,
          textures: textures.size,
          geometryTypedArrayBytes: geometryBytes,
          estimatedRGBA8TextureBytesWithMips: textureBytes,
        };
      };
    let maxCollisionPlaneViolation = 0,
      component = 0;
    const point = world.camera.position.clone();
    showcase.coral.traverse((object) => {
      if (!object.name.startsWith('COLLIDER_') || !object.geometry) return;
      const collider = showcase.colliders[component++],
        p = object.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        point.fromBufferAttribute(p, i).applyMatrix4(object.matrixWorld);
        for (const plane of collider.planes)
          maxCollisionPlaneViolation = Math.max(
            maxCollisionPlaneViolation,
            plane.x * point.x +
              plane.y * point.y +
              plane.z * point.z -
              plane.offset,
          );
      }
    });
    if (maxCollisionPlaneViolation > 1e-5)
      throw Error('Non-convex authored collision component');
    return {
      maxCollisionPlaneViolation,
      fish: world.aquarium.fish.simulation.fish.length,
      chromis: showcase.school.rigs.length,
      school: resources(showcase.school.root),
      coral: resources(showcase.coral),
      coralColliders: showcase.colliders.length,
      hulls: world.aquarium.collision.colliders.length,
      animations: showcase.coralLease?.animations?.length,
      geometryNote:
        'Typed-array bytes exclude driver copies; RGBA8 texture estimate excludes compression, morph textures and shadow maps. Shared image maps counted once per resource set.',
    };
  });
  assert.equal(inventory.fish, 40);
  assert.equal(inventory.chromis, 20);
  assert.equal(requests.length, 7); // includes the Pass 014 reef and Pass 015 nudibranchs
  const views = await page.evaluate(() => {
    const { world, showcase } = window.__visualBenchmark,
      q = world.aquarium,
      f = q.fish.simulation.fish.find(
        (f) => f.species.id === 'blue-green-chromis',
      ),
      c = showcase.formation.position;
    window.__portraitSaved = {
      position: { ...f.position },
      previousPosition: { ...f.previousPosition },
      yaw: f.yaw,
      previousYaw: f.previousYaw,
      pitch: f.pitch,
      previousPitch: f.previousPitch,
      bank: f.bank,
      previousBank: f.previousBank,
    };
    Object.assign(f.position, { x: c.x - 0.3, y: c.y + 3, z: c.z + 0.5 });
    Object.assign(f.previousPosition, f.position);
    f.yaw =
      f.previousYaw =
      f.pitch =
      f.previousPitch =
      f.bank =
      f.previousBank =
        0;
    const p = [f.position.x, f.position.y, f.position.z];
    return [
      {
        id: 'chromis-close',
        position: [p[0] + 0.16, p[1] + 0.03, p[2] + 0.65],
        target: p,
      },
      { id: 'chromis-side', position: [p[0], p[1], p[2] + 0.8], target: p },
      {
        id: 'coral-close',
        position: [c.x + 0.8, c.y + 1.25, c.z + 0.85],
        target: [c.x, c.y + 0.95, c.z],
      },
      {
        id: 'reef-composition',
        position: [c.x - 2.3, c.y + 3.2, c.z + 4.7],
        target: [c.x - 0.4, c.y + 1.8, c.z],
      },
      {
        id: 'swimming-distance',
        position: [c.x - 1.4, c.y + 1.9, c.z + 3.4],
        target: [c.x, c.y + 1.1, c.z],
      },
      { id: 'full-aquarium', position: [0, 9, 12], target: [0, 3, -3] },
    ];
  });
  const renders = [];
  for (const view of views)
    for (const mode of ['before', 'assets-only', 'after']) {
      const sample = await page.evaluate(
        ({ view, mode }) => {
          const { world: w, showcase: s, app } = window.__visualBenchmark;
          s.setUpgraded(mode !== 'before', mode === 'after');
          w.camera.position.set(...view.position);
          w.camera.lookAt(...view.target);
          if (
            w.aquarium.collision.colliders.some((c) =>
              w.aquarium.collision.contains(c, ...view.position),
            )
          )
            throw Error(`Unsafe first-person camera: ${view.id}`);
          Object.assign(app.state.position, {
            x: view.position[0],
            y: view.position[1],
            z: view.position[2],
          });
          app.ui.setDepth(14 - view.position[1]);
          w.render(20, false);
          w.renderer.getContext().finish();
          return {
            draws: w.renderer.info.render.calls,
            triangles: w.renderer.info.render.triangles,
            memory: { ...w.renderer.info.memory },
          };
        },
        { view, mode },
      );
      await page.screenshot({
        path: path.join(output, `${view.id}-${mode}.png`),
      });
      renders.push({ view: view.id, mode, ...view, ...sample });
    }
  const profile = await page.evaluate(() => {
    const { showcase } = window.__visualBenchmark,
      values = [];
    showcase.setUpgraded(true, true);
    for (let batch = 0; batch < 160; batch++) {
      const start = performance.now();
      for (let i = 0; i < 20; i++) showcase.school.update();
      values.push((performance.now() - start) / 20);
    }
    return values;
  });
  // Isolate the old/new school and old/new colony without changing geometry, fish count or camera.
  const isolated = await page.evaluate(() => {
    const { world: w, showcase: s } = window.__visualBenchmark,
      q = w.aquarium,
      result = [],
      saved = q.root.children.map((o) => o.visible),
      batches = q.fish.batches.map((b) => b.root.visible);
    for (const asset of ['school', 'coral'])
      for (const upgraded of [false, true]) {
        s.setUpgraded(upgraded, false);
        q.root.children.forEach((o) => (o.visible = false));
        if (asset === 'school') {
          q.fish.root.visible = !upgraded;
          s.school.root.visible = upgraded;
          q.fish.batches.forEach(
            (b) =>
              (b.root.visible =
                !upgraded &&
                b.visuals[0].root.name.startsWith('Blue-green chromis')),
          );
          const f = q.fish.simulation.fish[0];
          w.camera.position.set(f.position.x, f.position.y, f.position.z + 1.5);
          w.camera.lookAt(f.position.x, f.position.y, f.position.z);
        } else {
          q.hardscape.root.visible = !upgraded;
          s.formation.mesh.visible = !upgraded;
          s.coral.visible = upgraded;
          for (const f of q.hardscape.formations)
            f.mesh.visible = !upgraded && f === s.formation;
          const c = s.formation.position;
          w.camera.position.set(c.x, c.y + 1, c.z + 2);
          w.camera.lookAt(c.x, c.y + 0.9, c.z);
        }
        w.render(20, false);
        w.renderer.getContext().finish();
        result.push({
          asset,
          upgraded,
          draws: w.renderer.info.render.calls,
          triangles: w.renderer.info.render.triangles,
        });
      }
    q.root.children.forEach((o, i) => (o.visible = saved[i]));
    q.fish.batches.forEach((b, i) => (b.root.visible = batches[i]));
    q.hardscape.formations.forEach((f) => (f.mesh.visible = true));
    s.setUpgraded(true, true);
    return result;
  });
  const frameTimes = [],
    rafIntervals = [];
  let previous;
  for (let i = 0; i < 12; i++) {
    const r = await page.evaluate(async () => {
      const raf = await new Promise(requestAnimationFrame),
        { world: w } = window.__visualBenchmark,
        start = performance.now();
      w.render(20, false);
      w.renderer.getContext().finish();
      return { raf, ms: performance.now() - start };
    });
    frameTimes.push(r.ms);
    if (previous !== undefined) rafIntervals.push(r.raf - previous);
    previous = r.raf;
  }
  const animation = await page.evaluate(() => {
    const { world, showcase } = window.__visualBenchmark,
      q = world.aquarium,
      f = q.fish.simulation.fish[0];
    Object.assign(f.position, window.__portraitSaved.position);
    Object.assign(f.previousPosition, window.__portraitSaved.previousPosition);
    for (const key of [
      'yaw',
      'previousYaw',
      'pitch',
      'previousPitch',
      'bank',
      'previousBank',
    ])
      f[key] = window.__portraitSaved[key];
    q.update(20, false, 0, false);
    showcase.update();
    const before = showcase.school.meshes.map((m) =>
        Array.from(m.instanceMatrix.array),
      ),
      morph = showcase.school.meshes.find((m) => m.morphTexture),
      phase = Array.from(morph.morphTexture.source.data.data);
    world.render(20, false, 300, false);
    const paused =
      JSON.stringify(before) ===
        JSON.stringify(
          showcase.school.meshes.map((m) => Array.from(m.instanceMatrix.array)),
        ) &&
      JSON.stringify(phase) ===
        JSON.stringify(Array.from(morph.morphTexture.source.data.data));
    for (let i = 0; i < 120; i++) q.update(i / 30, true, 1 / 30, true);
    showcase.update();
    const finite = showcase.school.meshes.every((m) =>
      m.instanceMatrix.array.every(Number.isFinite),
    );
    return { paused, finite };
  });
  assert(animation.paused);
  assert(animation.finite);
  const frames = path.join(output, 'frames');
  fs.mkdirSync(frames, { recursive: true });
  for (let i = 0; i < 80; i++) {
    await page.evaluate(() => {
      const { world: w, app } = window.__visualBenchmark;
      const f = w.aquarium.fish.simulation.fish[0];
      w.aquarium.update(30, false, 1 / 30, true);
      const c = Math.cos(f.yaw),
        s = Math.sin(f.yaw);
      w.camera.position.set(
        f.position.x + 0.22 * c + 0.75 * s,
        f.position.y + 0.04,
        f.position.z - 0.22 * s + 0.75 * c,
      );
      w.camera.lookAt(f.position.x, f.position.y, f.position.z);
      Object.assign(app.state.position, {
        x: w.camera.position.x,
        y: w.camera.position.y,
        z: w.camera.position.z,
      });
      app.ui.setDepth(14 - w.camera.position.y);
      w.render(30, false);
    });
    await page.screenshot({
      path: path.join(frames, `${String(i).padStart(3, '0')}.png`),
    });
  }
  const safety = await page.evaluate(() => {
    const q = window.__visualBenchmark.world.aquarium;
    for (let i = 0; i < 900; i++) q.update(i / 30, false, 1 / 30, true);
    return {
      fish: q.fish.simulation.fish.length,
      corrections: q.fish.simulation.fish.reduce(
        (n, f) => n + f.corrections,
        0,
      ),
      finite: q.fish.simulation.fish.every((f) =>
        Object.values(f.position).every(Number.isFinite),
      ),
    };
  });
  assert.equal(safety.fish, 40);
  assert(safety.finite);
  assert.equal(safety.corrections, 0);
  const cleanup = await page.evaluate(() => {
    const { app, world: w, dispose } = window.__visualBenchmark,
      ctx = app.audio.context,
      before = { ...w.renderer.info.memory };
    dispose();
    return { before, after: { ...w.renderer.info.memory }, audio: ctx.state };
  });
  assert.equal(cleanup.after.geometries, 0);
  assert.equal(cleanup.after.textures, 0);
  assert.equal(cleanup.audio, 'closed');
  const fallback = await browser.newPage();
  await fallback.route('**/assets/models/fish/chromis.glb', (r) => r.abort());
  await fallback.goto(url + '/benchmark.html');
  await fallback.waitForFunction(
    () =>
      document
        .querySelector('#asset-state')
        ?.textContent.includes('Asset load failed'),
    {},
    { timeout: 60000 },
  );
  const fallbackResult = await fallback.evaluate(() => ({
    visibleOriginalChromis:
      window.__visualBenchmark.world.aquarium.fish.batches.some(
        (b) =>
          b.root.visible &&
          b.visuals[0].root.name.startsWith('Blue-green chromis'),
      ),
    population:
      window.__visualBenchmark.world.aquarium.fish.simulation.fish.length,
  }));
  assert(fallbackResult.visibleOriginalChromis);
  assert.equal(fallbackResult.population, 40);
  await fallback.close();
  const recreation = [];
  for (let i = 0; i < 2; i++) {
    await page.reload();
    await page.waitForFunction(
      () => !!window.__visualBenchmark?.showcase,
      {},
      { timeout: 60000 },
    );
    const result = await page.evaluate(() => {
      const w = window.__visualBenchmark.world;
      window.__visualBenchmark.dispose();
      return { ...w.renderer.info.memory };
    });
    assert.equal(result.geometries, 0);
    assert.equal(result.textures, 0);
    recreation.push(result);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  const report = {
    result: 'PASS',
    nativeSwim,
    backend: 'Chromium / SwiftShader software renderer',
    loadMs,
    initialModelRequests: requests.slice(0, 7),
    inventory,
    renders,
    isolated,
    schoolUpdateMs: stats(profile),
    frameSubmissionMs: stats(frameTimes),
    rafIntervalMs: stats(rafIntervals),
    animation,
    safety,
    cleanup,
    fallback: fallbackResult,
    recreation,
    errors,
    warnings,
    limitations: [
      'Portrait fish position is a controlled presentation fixture, identical in A/B captures; locomotion sequence follows an actual simulated fish.',
      'Before/assets-only/after share camera transforms and simulation pose. Assets-only retains original lighting.',
      'Video frames advance the real fixed-step ecosystem by 1/30 s; encoding at 30 FPS is not measured hardware FPS.',
      'Texture memory is an RGBA8+mips estimate, not driver VRAM. Software timing cannot establish MacBook Air performance.',
      'Visual quality gates remain subject to user acceptance; surrounding rocks and other assets remain Pass 011.',
    ],
  };
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
