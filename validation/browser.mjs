/* Optional desktop benchmark: install Playwright locally; see validation/README.md. */
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const output = process.env.COZY_OUTPUT || '/tmp/cozy-pass006-browser';
const samples = Number(process.env.COZY_SAMPLES || 12);
const stats = (values) => {
  const s = [...values].sort((a, b) => a - b);
  return {
    mean: s.reduce((a, b) => a + b, 0) / s.length,
    median: s[Math.floor(s.length * 0.5)],
    p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))],
    p99: s[Math.min(s.length - 1, Math.floor(s.length * 0.99))],
    samples: s.length,
  };
};
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    headless: process.env.COZY_HEADFUL !== '1',
    ...(process.env.COZY_CHROMIUM
      ? { executablePath: process.env.COZY_CHROMIUM }
      : {}),
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      ...(process.env.COZY_HARDWARE
        ? []
        : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']),
    ],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 960, height: 640 },
    });
    const errors = [],
      warnings = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
      else if (m.type() === 'warning') warnings.push(m.text());
    });
    await page.route('**/src/main.ts*', async (route) => {
      const r = await route.fetch();
      await route.fulfill({
        response: r,
        body: (await r.text()) + '\nwindow.__cozy = app;',
      });
    });
    await page.goto(process.env.COZY_URL || 'http://127.0.0.1:5173');
    await page.waitForFunction(
      () => window.__cozy?.world?.renderer.info.render.calls > 0,
    );
    await page.screenshot({ path: path.join(output, 'preview.png') });
    await page.evaluate(() => cancelAnimationFrame(window.__cozy.frame));
    await page.getByRole('button', { name: 'Enter the Water' }).click();
    await page.waitForFunction(
      () =>
        !!document.pointerLockElement &&
        document.querySelector('#overlay').hidden,
    );
    await page.evaluate(() => {
      const a = window.__cozy;
      for (let i = 0; i < 600; i++) {
        a.world.aquarium.update(i / 30, false, 1 / 30, true);
        a.audio.update(1 / 30, a.state, a.tuning, 0);
      }
    });
    const backend = await page.evaluate(() => {
      const gl = window.__cozy.world.renderer.getContext(),
        info = gl.getExtension('WEBGL_debug_renderer_info');
      return info
        ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER);
    });
    const inventory = await page.evaluate(() => {
      const a = window.__cozy,
        q = a.world.aquarium,
        geometries = new Set(),
        materials = new Set();
      q.root.traverse((o) => {
        if (o.geometry) geometries.add(o.geometry);
        if (o.material)
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            materials.add(m),
          );
      });
      return {
        population: q.fish.simulation.fish.reduce(
          (n, f) => ((n[f.species.id] = (n[f.species.id] || 0) + 1), n),
          {},
        ),
        solids: q.collision.colliders.length,
        geometries: geometries.size,
        materials: materials.size,
        audio: {
          nodes: a.audio.graph.nodes.length,
          buffers: a.audio.graph.buffers.length,
          bytes: a.audio.graph.buffers.reduce((n, b) => n + b.length * 4, 0),
          loops: a.audio.graph.loops.length,
        },
      };
    });
    const views = await page.evaluate(async () => {
      const { safeFishPosition, clearFishRoute } =
        await import('/src/fish/FishHabitat.ts');
      const q = window.__cozy.world.aquarium,
        fish = q.fish.simulation.fish;
      const centroid = (id) => {
        const group = fish.filter((f) => f.species.id === id);
        return group.reduce(
          (p, f) =>
            p.map(
              (v, i) =>
                v +
                [f.position.x, f.position.y, f.position.z][i] / group.length,
            ),
          [0, 0, 0],
        );
      };
      const close = (name, p, offset) => ({
        name,
        position: p.map((v, i) => v + offset[i]),
        target: p,
      });
      const grass = q.grass.patches[0],
        ornament = q.hardscape.formations[0].position;
      const portraits = fish
        .filter((f) =>
          [
            'pajama-cardinalfish',
            'firefish-goby',
            'yellow-assessor',
            'royal-gramma',
          ].includes(f.species.id),
        )
        .filter(
          (f, i, all) =>
            all.findIndex((g) => g.species.id === f.species.id) === i,
        )
        .map((f) => {
          const p = [f.position.x, f.position.y, f.position.z],
            h = q.fish.simulation.habitat;
          for (const distance of [1.8, 1.2, 2.5])
            for (const angle of [0, Math.PI, Math.PI / 3, -Math.PI / 3]) {
              const v = {
                x: p[0] + Math.sin(f.yaw + angle) * distance,
                y: p[1] + 0.15,
                z: p[2] + Math.cos(f.yaw + angle) * distance,
              };
              if (
                safeFishPosition(v, 0.08, h) &&
                clearFishRoute(v, f.position, 0.02, h)
              )
                return {
                  name: f.species.id,
                  position: [v.x, v.y, v.z],
                  target: p,
                };
            }
          return close(f.species.id, p, [0, 1.5, 2]);
        });
      const coral = q.plants.placements.find(
        (p) => p.species.id === 'soft-coral',
      );
      return [
        { name: 'overview', position: [0, 8, 12], target: [0, 3, -3] },
        close('chromis-school', centroid('blue-green-chromis'), [1, 0.8, 4]),
        ...portraits,
        close('seagrass', [grass.x, 0.6, grass.z], [1.8, 1, 2]),
        close('reef', [ornament.x, ornament.y + 1, ornament.z], [3, 2, 4]),
        close(
          'soft-coral',
          [coral.position.x, coral.position.y + 0.5, coral.position.z],
          [1.2, 0.6, 1.8],
        ),
        { name: 'floor', position: [0, 0.8, 3], target: [0, 1, -4] },
      ];
    });
    assert(
      views.every((v) => [...v.position, ...v.target].every(Number.isFinite)),
      'Camera fixtures must be finite',
    );
    const renders = [];
    for (const view of process.env.COZY_DETAILS_ONLY ? [] : views) {
      await page.evaluate((v) => {
        const w = window.__cozy.world;
        w.camera.position.set(...v.position);
        w.camera.lookAt(...v.target);
        w.render(20, false);
        w.renderer.getContext().finish();
      }, view);
      const times = [],
        intervals = [];
      let previous;
      for (let i = 0; i < samples; i++) {
        const r = await page.evaluate(async () => {
          const raf = await new Promise((resolve) =>
            requestAnimationFrame(resolve),
          );
          const w = window.__cozy.world,
            start = performance.now();
          w.render(20, false);
          w.renderer.getContext().finish();
          return {
            raf,
            ms: performance.now() - start,
            calls: w.renderer.info.render.calls,
            triangles: w.renderer.info.render.triangles,
          };
        });
        times.push(r.ms);
        if (previous !== undefined) intervals.push(r.raf - previous);
        previous = r.raf;
        if (i === samples - 1)
          renders.push({
            view: view.name,
            position: view.position,
            target: view.target,
            calls: r.calls,
            triangles: r.triangles,
            renderAndFinishMs: stats(times),
            rafMs: stats(intervals),
          });
      }
      await page.screenshot({ path: path.join(output, view.name + '.png') });
      if (view.name === 'soft-coral') {
        await page.evaluate(() => {
          const w = window.__cozy.world;
          for (let i = 0; i < 50; i++)
            w.aquarium.plants.update(0.1, true, false);
          w.render(25, false);
        });
        await page.screenshot({
          path: path.join(output, 'soft-coral-motion.png'),
        });
      }
    }
    const cpu = await page.evaluate(async () => {
      const { FishSystem } = await import('/src/fish/FishSystem.ts');
      const { fishPopulation } = await import('/src/fish/FishSpecies.ts');
      const q = window.__cozy.world.aquarium,
        h = q.fish.simulation.habitat,
        results = [];
      for (const count of [40, 60]) {
        const f = new FishSystem(h, fishPopulation(count));
        const steps = [],
          poses = [],
          schooling = [];
        for (let i = 0; i < 600; i++) {
          const start = performance.now();
          f.simulation.advance(1 / 30, true);
          steps.push(performance.now() - start);
          const p = performance.now();
          f.update(0, false, false);
          poses.push(performance.now() - p);
          const s = performance.now();
          f.simulation.schooling.calculate();
          schooling.push(performance.now() - s);
        }
        results.push({
          count,
          steps,
          poses,
          schooling,
          corrections: f.simulation.fish.reduce((n, f) => n + f.corrections, 0),
        });
        f.dispose();
      }
      return results;
    });
    const cpuStats = cpu.map((r) => ({
      count: r.count,
      fixedStepMs: stats(r.steps),
      poseMs: stats(r.poses),
      schoolingMs: stats(r.schooling),
      corrections: r.corrections,
    }));
    const dense = await page.evaluate(async () => {
      const { FishSystem } = await import('/src/fish/FishSystem.ts');
      const { fishPopulation } = await import('/src/fish/FishSpecies.ts');
      const q = window.__cozy.world.aquarium,
        results = [];
      for (const count of [40, 60]) {
        const f = new FishSystem(
            q.fish.simulation.habitat,
            fishPopulation(count),
          ),
          times = [];
        let scatter = 0;
        for (let i = 0; i < 600; i++) {
          const target = f.simulation.fish.find(
            (f) => f.species.id === 'blue-green-chromis',
          );
          const player = {
            position: {
              x: target.position.x - 1.2,
              y: target.position.y,
              z: target.position.z,
            },
            velocity: { x: i < 300 ? 0.2 : 3, y: 0, z: 0 },
            active: i % 180 < 90,
          };
          const start = performance.now();
          f.simulation.advance(1 / 30, true, player);
          times.push(performance.now() - start);
          scatter = Math.max(
            scatter,
            ...f.simulation.fish.map((f) => f.reaction.scatter),
          );
        }
        results.push({
          count,
          times,
          scatter,
          corrections: f.simulation.fish.reduce((n, f) => n + f.corrections, 0),
        });
        f.dispose();
      }
      return results;
    });
    const denseStats = dense.map((r) => ({
      count: r.count,
      fixedStepMs: stats(r.times),
      maximumScatter: r.scatter,
      corrections: r.corrections,
    }));
    const stressRendering = await page.evaluate(async () => {
      const { FishSystem } = await import('/src/fish/FishSystem.ts'),
        { fishPopulation } = await import('/src/fish/FishSpecies.ts');
      const w = window.__cozy.world,
        q = w.aquarium,
        original = q.fish,
        stress = new FishSystem(
          original.simulation.habitat,
          fishPopulation(60),
        );
      for (let i = 0; i < 600; i++) stress.update(1 / 30, true, false);
      q.root.remove(original.root);
      q.fish = stress;
      q.root.add(stress.root);
      const result = [];
      w.camera.position.set(0, 9, 12);
      w.camera.lookAt(0, 3, -3);
      for (const culling of [false, true]) {
        for (const batch of stress.batches)
          for (const mesh of batch.meshes) mesh.frustumCulled = culling;
        w.render(20, false);
        w.renderer.getContext().finish();
        result.push({
          culling,
          population: stress.simulation.fish.length,
          calls: w.renderer.info.render.calls,
          triangles: w.renderer.info.render.triangles,
        });
      }
      stress.dispose();
      q.fish = original;
      q.root.add(original.root);
      return result;
    });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.pointerLockElement);
    await page.screenshot({ path: path.join(output, 'pause.png') });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.screenshot({ path: path.join(output, 'settings.png') });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage');
    const resources = await page.evaluate(() => {
      const w = window.__cozy.world,
        ctx = window.__cozy.audio.context,
        before = { ...w.renderer.info.memory };
      window.__cozy.dispose();
      window.__cozy = undefined;
      return {
        before,
        after: { ...w.renderer.info.memory },
        audioState: ctx.state,
      };
    });
    await cdp.send('HeapProfiler.collectGarbage');
    const disposedHeap = await cdp.send('Runtime.getHeapUsage');
    const recreation = [];
    for (let cycle = 0; cycle < 2; cycle++) {
      await page.evaluate(async () => {
        const { Application } = await import('/src/app/Application.ts');
        window.__cozy = new Application(document.querySelector('#app'));
      });
      await page.waitForFunction(
        () => window.__cozy?.world?.renderer.info.render.calls > 0,
      );
      await page.getByRole('button', { name: 'Enter the Water' }).click();
      await page.waitForFunction(
        () =>
          !!document.pointerLockElement &&
          document.querySelector('#overlay').hidden &&
          window.__cozy.audio.context.state === 'running',
      );
      const snapshot = await page.evaluate(() => {
        const a = window.__cozy,
          w = a.world,
          ctx = a.audio.context,
          before = { ...w.renderer.info.memory };
        a.dispose();
        window.__cozy = undefined;
        return {
          before,
          after: { ...w.renderer.info.memory },
          audioState: ctx.state,
        };
      });
      assert.equal(snapshot.after.geometries, 0);
      assert.equal(snapshot.after.textures, 0);
      assert.equal(snapshot.audioState, 'closed');
      recreation.push(snapshot);
    }
    assert.deepEqual(errors, []);
    assert.equal(
      Object.values(inventory.population).reduce((a, b) => a + b, 0),
      40,
    );
    assert.equal(resources.audioState, 'closed');
    const report = {
      renderer:
        'Chromium, 960x640, pixel ratio 1; CPU render/finish submission and rAF measured separately; no hardware performance claim',
      backend,
      inventory,
      renders,
      cpu: cpuStats,
      dense: denseStats,
      stressRendering,
      recreation,
      heap: { before: heap.usedSize, disposed: disposedHeap.usedSize },
      resources,
      errors,
      warnings,
    };
    fs.writeFileSync(
      path.join(output, 'report.json'),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
