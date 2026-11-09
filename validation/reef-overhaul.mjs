/* Pass 014: matched reef before/after renders, budgets, fallback and disposal evidence.
 *
 *   npm run dev -- --host 127.0.0.1 --port 5173
 *   node validation/reef-overhaul.mjs
 *
 * Each view is captured twice in one paused session with an identical camera: the procedural
 * Pass 013 reef (authored reef disabled) and the Pass 014 authored reef. Pass 013 ornaments and
 * creatures stay enabled in both. Timings come from synchronized software rendering and are
 * diagnostic only; they are not hardware FPS.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy014-reef';
const only = process.env.COZY_VIEWS?.split(',');
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
const VIEWS = [
  'wide',
  'channel',
  'rock-close',
  'crevice',
  'branching-coral',
  'rounded-coral',
  'plate-coral',
  'soft-coral',
  'sea-fan',
  'seagrass',
  'macroalgae',
  'sand-rubble',
  'shipwreck-reef',
  'arch-growth',
  'seahorse-habitat',
  'anemone-habitat',
].filter((v) => !only || only.includes(v));
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
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || /THREE\.WebGL|shader/i.test(m.text()))
      report.errors.push(m.text());
  });
  page.on('request', (r) => {
    if (r.url().includes('.glb')) report.requests.push(r.url());
  });
  return page;
}
try {
  const page = await open();
  const started = Date.now();
  await page.goto(base);
  await page.waitForFunction(() => window.__cozy?.world);
  assert.equal(await page.evaluate(() => window.__cozy.world.reef.ready), true);
  assert.equal(
    await page.evaluate(() => window.__cozy.world.authored.ready),
    true,
  );
  report.loadMs = Date.now() - started;
  await page
    .getByRole('button', { name: 'Enter the Water', exact: true })
    .click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.evaluate(() => cancelAnimationFrame(window.__cozy.frame));
  report.inventory = await page.evaluate(
    () => window.__cozy.world.reef.inventory,
  );
  for (const view of VIEWS) {
    await page.evaluate(async (view) => {
      const THREE = await import('/node_modules/.vite/deps/three.js'),
        w = window.__cozy.world,
        q = w.aquarium,
        target = new THREE.Vector3(),
        eye = new THREE.Vector3();
      const rock = (name) => q.rocks.find((r) => r.mesh.name === name).mesh;
      const plant = (species) =>
        q.plants.placements
          .filter((p) => p.species.id === species)
          .sort((a, b) => Math.abs(a.position.x) - Math.abs(b.position.x))[0];
      const plantView = (p, distance) => {
        target
          .set(p.position.x, p.position.y, p.position.z)
          .addScaledVector(
            new THREE.Vector3(p.normal.x, p.normal.y, p.normal.z),
            p.height * 0.5,
          );
        eye
          .copy(target)
          .add(
            new THREE.Vector3(
              -Math.sign(p.position.x) * distance,
              distance * 0.35,
              distance * 0.55,
            ),
          );
      };
      const ornament = (kind, height, offset) => {
        const m = q.ornaments.models.find((m) => m.kind === kind);
        target.set(0, height, 0).applyMatrix4(m.root.matrixWorld);
        eye.copy(target).add(new THREE.Vector3(...offset));
      };
      if (view === 'wide') {
        eye.set(0, 8.2, 13.2);
        target.set(0, 1.8, -4);
      } else if (view === 'channel') {
        eye.set(0, 4.6, 9);
        target.set(0, 3.4, -5);
      } else if (view === 'rock-close') {
        const m = rock('Rock 22');
        target.copy(m.position);
        eye.set(m.position.x - 3.3, m.position.y + 1.3, m.position.z + 2.4);
      } else if (view === 'crevice') {
        // Rock 23 uses the crevice/overhang archetype beside the channel. Face whichever
        // authored opening (two clefts at local 0.8/2.5 rad, undercut at 4.3 rad) faces the channel,
        // then back away until the camera is clear and nothing occludes the rock.
        const m = rock('Rock 23');
        target.copy(m.position).add(new THREE.Vector3(0, -0.25, 0));
        const d = [0.8, 2.5, 4.3]
          .map((a) =>
            new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
              .applyQuaternion(m.quaternion)
              .setY(0)
              .normalize(),
          )
          .sort(
            (a, b) =>
              b.x * -Math.sign(m.position.x) - a.x * -Math.sign(m.position.x),
          )[0];
        const { safeFishPosition } = await import('/src/fish/FishHabitat.ts');
        const ray = new THREE.Raycaster();
        for (let distance = 2; distance < 7; distance += 0.2) {
          eye
            .copy(target)
            .addScaledVector(d, distance)
            .add(new THREE.Vector3(0, 0.3, 0));
          if (!safeFishPosition(eye, 0.35, q.fish.simulation.habitat)) continue;
          ray.set(eye, target.clone().sub(eye).normalize());
          const hit = ray.intersectObjects(
            q.rocks.filter((r) => r.solid).map((r) => r.mesh),
            false,
          )[0];
          if (!hit || hit.object === m) break;
        }
      } else if (
        ['branching-coral', 'rounded-coral', 'plate-coral'].includes(view)
      ) {
        const kind = view.split('-')[0];
        const f = q.hardscape.formations.find((f) => f.kind === kind);
        target.copy(f.position).add(new THREE.Vector3(0, 0.7, 0));
        eye
          .copy(target)
          .add(new THREE.Vector3(-Math.sign(f.position.x) * 2.3, 0.9, 1.6));
      } else if (view === 'soft-coral') plantView(plant('soft-coral'), 1.9);
      else if (view === 'sea-fan') plantView(plant('sea-fan'), 2.2);
      else if (view === 'macroalgae') plantView(plant('caulerpa'), 1.6);
      else if (view === 'seagrass') {
        const p = q.grass.patches
          .slice()
          .sort((a, b) => Math.abs(a.x) - Math.abs(b.x))[0];
        target.set(p.x, 0.25, p.z);
        eye.set(p.x - Math.sign(p.x) * 2.6, 1.2, p.z + 1.6);
      } else if (view === 'sand-rubble') {
        const m = rock('Rock 4');
        target.set(m.position.x - 1.4, 0.05, m.position.z + 0.6);
        eye.set(m.position.x - 3.4, 0.95, m.position.z + 2.3);
      } else if (view === 'shipwreck-reef')
        ornament('shipwreck', 1, [3.3, 2.5, 4.5]);
      else if (view === 'arch-growth') ornament('arch', 1.5, [3.7, 1.6, 5.2]);
      else if (view === 'seahorse-habitat') {
        const s = q.anchoredLife.hidden.seahorse;
        s.root.updateMatrixWorld(true);
        target.set(0, 0.65, 0).applyMatrix4(s.root.matrixWorld);
        eye.copy(target).add(new THREE.Vector3(1.6, 0.5, 2.2));
      } else if (view === 'anemone-habitat') {
        q.anchoredLife.anemone.root.getWorldPosition(target);
        target.y += 0.5;
        eye.copy(target).add(new THREE.Vector3(2, 1.5, 3.4));
      }
      w.camera.position.copy(eye);
      w.camera.lookAt(target);
      w.camera.updateMatrixWorld(true);
    }, view);
    for (const enabled of [false, true]) {
      const metrics = await page.evaluate((enabled) => {
        const w = window.__cozy.world;
        w.reef.setEnabled(enabled);
        w.scene.updateMatrixWorld(true);
        const times = [],
          submit = [];
        for (let i = 0; i < 4; i++) {
          const t = performance.now();
          w.renderer.render(w.scene, w.camera);
          const issued = performance.now();
          w.renderer.getContext().finish();
          times.push(performance.now() - t);
          submit.push(issued - t);
        }
        // Submitted triangles by family (frustum-visible meshes, instanced counts included).
        const families = {};
        const projection = w.camera.projectionMatrix
          .clone()
          .multiply(w.camera.matrixWorldInverse);
        const planes = [];
        const e = projection.elements;
        for (const [a, b, c, d] of [
          [e[3] + e[0], e[7] + e[4], e[11] + e[8], e[15] + e[12]],
          [e[3] - e[0], e[7] - e[4], e[11] - e[8], e[15] - e[12]],
          [e[3] + e[1], e[7] + e[5], e[11] + e[9], e[15] + e[13]],
          [e[3] - e[1], e[7] - e[5], e[11] - e[9], e[15] - e[13]],
          [e[3] + e[2], e[7] + e[6], e[11] + e[10], e[15] + e[14]],
          [e[3] - e[2], e[7] - e[6], e[11] - e[10], e[15] - e[14]],
        ]) {
          const l = Math.hypot(a, b, c);
          planes.push([a / l, b / l, c / l, d / l]);
        }
        w.scene.traverseVisible((o) => {
          if (!o.isMesh) return;
          const g = o.geometry;
          if (!g.boundingSphere) g.computeBoundingSphere();
          const s = g.boundingSphere.clone().applyMatrix4(o.matrixWorld);
          if (
            !o.isInstancedMesh &&
            planes.some(
              ([a, b, c, d]) =>
                a * s.center.x + b * s.center.y + c * s.center.z + d <
                -s.radius,
            )
          )
            return;
          let top = o;
          while (
            top.parent &&
            top.parent !== w.aquarium.root &&
            top.parent.name !== 'Authored reef environment'
          )
            top = top.parent;
          const key = (
            o.parent?.isLOD ? 'Authored rock' : top.name || o.name || 'other'
          ).split(/\s+\d|\(/)[0];
          const tris =
            ((g.index ? g.index.count : g.attributes.position.count) / 3) *
            (o.isInstancedMesh ? o.count : 1);
          families[key] = (families[key] ?? 0) + tris;
        });
        return {
          enabled,
          families,
          calls: w.renderer.info.render.calls,
          triangles: w.renderer.info.render.triangles,
          memory: { ...w.renderer.info.memory },
          softwareSynchronizedFrameMs: times,
          cpuSubmitMs: submit,
        };
      }, enabled);
      const file = `${view}-${enabled ? 'after' : 'before'}.png`;
      await page.screenshot({ path: path.join(output, file) });
      report.views.push({ view, file, ...metrics });
    }
  }
  report.webglErrors = await page.evaluate(() => {
    const gl = window.__cozy.world.renderer.getContext();
    return gl.getError();
  });
  if (!only) {
    // Collider identity: toggling restores the accepted hulls exactly.
    report.colliders = await page.evaluate(() => {
      const w = window.__cozy.world,
        list = w.aquarium.collision.colliders;
      w.reef.setEnabled(false);
      const before = list.slice();
      w.reef.setEnabled(true);
      const authored = list.length;
      w.reef.setEnabled(false);
      const restored =
        list.length === before.length && list.every((c, i) => c === before[i]);
      w.reef.setEnabled(true);
      return { procedural: before.length, authored, restored };
    });
    assert.equal(report.colliders.restored, true);
    report.disposal = await page.evaluate(() => {
      const w = window.__cozy.world;
      w.reef.dispose();
      w.renderer.render(w.scene, w.camera);
      return { ...w.renderer.info.memory };
    });
  }
  assert.equal(report.webglErrors, 0);
  assert.deepEqual(report.errors, []);
  await page.close();
  if (!only) {
    // A missing reef library keeps the Pass 013 world usable and says so.
    const fallback = await open();
    await fallback.route('**/reef-environment.glb', (r) => r.abort());
    await fallback.goto(base);
    await fallback.waitForFunction(() => window.__cozy?.world);
    assert.equal(
      await fallback.evaluate(() => window.__cozy.world.reef.ready),
      false,
    );
    assert.equal(
      await fallback.evaluate(() => window.__cozy.world.authored.ready),
      true,
    );
    await fallback.evaluate(() => window.__cozy.world.prepared);
    await fallback
      .getByRole('button', { name: 'Enter the Water', exact: true })
      .click();
    await fallback.waitForFunction(() => !!document.pointerLockElement);
    report.fallback = await fallback.evaluate(() => ({
      hulls: window.__cozy.world.aquarium.collision.colliders.length,
      status: document.querySelector('[role=status]')?.textContent ?? '',
      rocksVisible: window.__cozy.world.aquarium.rocks.every(
        (r) => r.mesh.visible,
      ),
    }));
    assert.equal(report.fallback.hulls, 216);
    assert.match(report.fallback.status, /could not load/);
    assert.equal(report.fallback.rocksVisible, true);
    await fallback.evaluate(() => window.__cozy.dispose());
    await fallback.close();
  }
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify({ ...report, views: report.views.length }, null, 1));
