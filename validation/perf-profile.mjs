/* v0.6 Pass 059: where the time and the triangles go, world by world, with real input.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy059 node validation/perf-profile.mjs
 *
 * Travels tank → outer reef → kelp forest → sea cave → under the ice (as the visual tour), and in
 * each world, from a fixed open view:
 *   - steps 60 frames by hand at 1/30 s, timing the whole tick and the renderer's draw submission
 *     separately (simulation = tick − render). SwiftShader rasterises on the CPU inside the render
 *     call, so render times are not GPU times; simulation times are real JavaScript cost on this
 *     machine (relative between worlds and before/after).
 *   - the meshes contributing most triangles in view (triangles × instances, frustum-tested);
 *   - draw calls, triangles, GPU memory, JS heap;
 *   - a 3-second CPU profile (Chrome DevTools protocol), reduced to the top functions by self time.
 * Also records each world's build time on entry (`app.buildTimes`) and the longest single frame
 * crossing each passage. Writes report.json.
 */
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy059';
fs.mkdirSync(output, { recursive: true });
// COZY_HARDWARE=1 uses the machine's GPU (on a real laptop) instead of SwiftShader;
// COZY_CHROMIUM points at a particular browser build.
const browser = await chromium.launch({
  executablePath: process.env.COZY_CHROMIUM || undefined,
  headless: process.env.COZY_HEADFUL !== '1',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-precise-memory-info',
    ...(process.env.COZY_HARDWARE
      ? []
      : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']),
  ],
});
const report = { errors: [], worlds: {} };
const log = (m) =>
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
try {
  const page = await browser.newPage({
    viewport: { width: 640, height: 400 },
    deviceScaleFactor: Number(process.env.COZY_DPR || 0.75),
  });
  page.setDefaultTimeout(600000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      'cozy-diver.settings.v3',
      JSON.stringify({ reducedMotion: false }),
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
  await page.waitForFunction(() => !!document.pointerLockElement);
  // Time the renderer's draw submission inside each tick.
  await page.evaluate(() => {
    const r = window.__cozy.world.renderer,
      render = r.render.bind(r);
    window.__renderMs = 0;
    r.render = (s, c) => {
      const t = performance.now();
      render(s, c);
      window.__renderMs += performance.now() - t;
    };
  });
  const step = (count = 1, measure = false) =>
    page.evaluate(
      async ([count, measure]) => {
        const a = window.__cozy,
          ticks = [],
          renders = [];
        for (let i = 0; i < count; i++) {
          await new Promise((r) => requestAnimationFrame(r));
          cancelAnimationFrame(a.frame);
          a.__t = (a.__t ?? performance.now()) + 1000 / 30;
          window.__renderMs = 0;
          const t = performance.now();
          a.tick(a.__t);
          const ms = performance.now() - t;
          cancelAnimationFrame(a.frame);
          if (measure) {
            ticks.push(ms);
            renders.push(window.__renderMs);
          }
        }
        return { world: a.waterWorld, ticks, renders };
      },
      [count, measure],
    );
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
  /** Swim through with W, recording the longest single tick on the way (entry spikes). */
  const swimThrough = async (world) => {
    await page.keyboard.down('w');
    let worst = 0,
      s;
    for (let i = 0; i < 600; i++) {
      s = await step(1, true);
      worst = Math.max(worst, ...s.ticks);
      if (s.world === world) break;
    }
    await page.keyboard.up('w');
    if (s.world !== world) throw Error(`could not reach ${world}`);
    return worst;
  };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  const profile = async () => {
    await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
    await cdp.send('Profiler.start');
    // Ticks back to back (no waiting for frames), so the samples are of real work.
    await page.evaluate(() => {
      const a = window.__cozy;
      for (let i = 0; i < 45; i++) {
        a.__t += 1000 / 30;
        a.tick(a.__t);
        cancelAnimationFrame(a.frame);
      }
    });
    const { profile: p } = await cdp.send('Profiler.stop');
    const self = new Map(),
      dt = new Map();
    // Sample counts per node → self time per function (url:name).
    const counts = new Map();
    for (const id of p.samples) counts.set(id, (counts.get(id) ?? 0) + 1);
    const total = p.samples.length;
    for (const n of p.nodes) {
      const f = n.callFrame,
        key = `${f.functionName || '(anon)'} ${f.url.split('/').slice(-2).join('/').split('?')[0]}:${f.lineNumber + 1}`;
      self.set(key, (self.get(key) ?? 0) + (counts.get(n.id) ?? 0));
    }
    void dt;
    return [...self.entries()]
      .filter(([k]) => !/^\((idle|program|garbage collector)\)/.test(k))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([k, v]) => ({ fn: k, share: +((v / total) * 100).toFixed(1) }));
  };
  const measure = async (name, at, yaw, pitch) => {
    await place(at, yaw, pitch);
    await step(20);
    const s = await step(60, true),
      sorted = (a) => [...a].sort((x, y) => x - y),
      median = (a) => sorted(a)[Math.floor(a.length / 2)],
      sim = s.ticks.map((t, i) => t - s.renders[i]);
    const scene = await page.evaluate(() => {
      const a = window.__cozy,
        w = a.water(),
        cam = w.camera,
        r = a.world.renderer,
        frustum = new cam.constructor().projectionMatrix.constructor,
        THREE_F = cam.matrixWorldInverse.constructor;
      void frustum;
      void THREE_F;
      cam.updateMatrixWorld();
      const m = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse),
        planes = [];
      const e = m.elements;
      // Six frustum planes from the view-projection matrix.
      const rows = [
        [e[3] + e[0], e[7] + e[4], e[11] + e[8], e[15] + e[12]],
        [e[3] - e[0], e[7] - e[4], e[11] - e[8], e[15] - e[12]],
        [e[3] + e[1], e[7] + e[5], e[11] + e[9], e[15] + e[13]],
        [e[3] - e[1], e[7] - e[5], e[11] - e[9], e[15] - e[13]],
        [e[3] + e[2], e[7] + e[6], e[11] + e[10], e[15] + e[14]],
        [e[3] - e[2], e[7] - e[6], e[11] - e[10], e[15] - e[14]],
      ];
      for (const [a, b, c, d] of rows) {
        const l = Math.hypot(a, b, c);
        planes.push([a / l, b / l, c / l, d / l]);
      }
      const inView = (o) => {
        if (!o.geometry) return false;
        if (o.frustumCulled === false) return true;
        const g = o.geometry;
        if (o.isInstancedMesh) {
          if (!o.boundingSphere) o.computeBoundingSphere();
        } else if (!g.boundingSphere) g.computeBoundingSphere();
        const sphere = (
          o.isInstancedMesh ? o.boundingSphere : g.boundingSphere
        ).clone();
        sphere.applyMatrix4(o.matrixWorld);
        return planes.every(
          ([a, b, c, d]) =>
            a * sphere.center.x +
              b * sphere.center.y +
              c * sphere.center.z +
              d >
            -sphere.radius,
        );
      };
      const rows2 = [];
      (w.scene ?? a.world.scene).traverseVisible((o) => {
        if (!(o.isMesh || o.isSkinnedMesh) || !inView(o)) return;
        const g = o.geometry,
          tris = (g.index ? g.index.count : g.attributes.position.count) / 3,
          inst = o.isInstancedMesh ? o.count : 1;
        rows2.push({
          name: o.name || o.parent?.name || g.type,
          tris,
          inst,
          total: tris * inst,
        });
      });
      const merged = new Map();
      for (const r2 of rows2) {
        const k = r2.name;
        const m2 = merged.get(k) ?? { name: k, total: 0, meshes: 0, inst: 0 };
        m2.total += r2.total;
        m2.meshes++;
        m2.inst += r2.inst;
        merged.set(k, m2);
      }
      const top = [...merged.values()]
        .sort((x, y) => y.total - x.total)
        .slice(0, 12);
      const i = r.info.render;
      return {
        calls: i.calls,
        triangles: i.triangles,
        memory: { ...r.info.memory },
        heapMB: performance.memory
          ? Math.round(performance.memory.usedJSHeapSize / 1048576)
          : null,
        top,
      };
    });
    const cpu = await profile();
    report.worlds[name] = {
      tickMedianMs: +median(s.ticks).toFixed(1),
      tickMaxMs: +Math.max(...s.ticks).toFixed(1),
      simMedianMs: +median(sim).toFixed(2),
      simMaxMs: +Math.max(...sim).toFixed(2),
      renderMedianMs: +median(s.renders).toFixed(1),
      ...scene,
      cpu,
    };
    await page.screenshot({ path: path.join(output, `${name}.png`) });
    log(
      `${name}: sim ${report.worlds[name].simMedianMs} ms (max ${report.worlds[name].simMaxMs}), ${scene.calls} calls, ${(scene.triangles / 1e6).toFixed(2)} M tris; top: ${scene.top
        .slice(0, 4)
        .map((t) => `${t.name} ${(t.total / 1e3).toFixed(0)}k`)
        .join(', ')}`,
    );
  };
  report.entrySpikes = {};
  await measure('tank', { x: 0, y: 5, z: 10 }, 0, -0.1);
  await place({ x: 6.4, y: 1.6, z: -12.1 }, Math.PI / 2);
  await until((s) => s.outerReady, 600);
  report.entrySpikes.outer = await swimThrough('outer');
  await until((s) => s.reefReady);
  await step(30);
  await measure('outer', { x: 0, y: 5, z: -36 }, 0, -0.2);
  await place({ x: -17.6, y: 1.3, z: -32 }, -Math.PI / 2);
  await until((s) => s.kelpReady);
  report.entrySpikes.kelp = await swimThrough('kelp');
  await step(30);
  await measure('kelp', { x: 0, y: 6, z: -22 }, 0, 0);
  await place({ x: 15.1, y: 2.8, z: -10 }, -Math.PI / 2);
  await until((s) => s.caveReady);
  report.entrySpikes.cave = await swimThrough('cave');
  await step(30);
  await measure('cave', { x: 0, y: 5, z: -14 }, 0, -0.1);
  await place({ x: -3, y: 3.2, z: -33 }, 0, 0);
  await until((s) => s.iceReady);
  report.entrySpikes.ice = await swimThrough('ice');
  await step(30);
  await measure('ice', { x: 0, y: 6, z: -16 }, 0, 0);
  report.buildTimes = await page.evaluate(() =>
    JSON.parse(JSON.stringify(window.__cozy.buildTimes)),
  );
  report.ok = report.errors.length === 0;
} catch (e) {
  report.failure = String(e?.stack || e);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  log(
    report.ok
      ? 'profile complete'
      : `FAILED ${report.failure?.split('\n')[0] ?? report.errors[0]}`,
  );
  await browser.close();
}
