/* Pass 015: matched coral and creature close-ups, budgets and errors for one build.
 *
 * Run once against the previous candidate and once against this branch with identical cameras:
 *   COZY_URL=http://127.0.0.1:5174 COZY_OUTPUT=/tmp/cozy015-before node validation/creature-overhaul.mjs
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy015-after  node validation/creature-overhaul.mjs
 * Creature poses are fixed explicitly (moray extension, discovery pose time, paused clocks);
 * free-swimming fish are background and may differ between runs. Software-rendered timings are
 * diagnostics only, not hardware FPS.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy015-creatures';
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
// SwiftShader compiles new shader variants lazily on first present; raise action timeouts only.
const openPage = browser.newPage.bind(browser);
browser.newPage = async (options) => {
  const page = await openPage(options);
  page.setDefaultTimeout(Number(process.env.COZY_ACTION_TIMEOUT || 240000));
  return page;
};
const base = process.env.COZY_URL || 'http://127.0.0.1:5173';
const report = { base, views: [], requests: [], errors: [] };
const VIEWS = [
  'branching-coral',
  'brain-coral',
  'boulder-coral',
  'plate-coral',
  'soft-coral',
  'sea-fan',
  'anemone',
  'clownfish',
  'moray',
  'frogfish',
  'seahorse',
  'nudibranch-1',
  'nudibranch-2',
  'nudibranch-3',
  'nudibranch-4',
  'nudibranch-5',
].filter((v) => !only || only.includes(v));
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 750 },
  });
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      // These are staged views, not a live gameplay recording. Stop the preview loop
      // during shader/texture preparation to avoid a queued SwiftShader render backlog.
      body:
        (await r.text()) +
        '\nwindow.__cozy=app;cancelAnimationFrame(app.frame);',
    });
  });
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  page.on('request', (r) => {
    if (r.url().includes('.glb')) report.requests.push(r.url());
  });
  await page.goto(base);
  await page.waitForFunction(() => window.__cozy?.world);
  await page.evaluate(() =>
    Promise.all([window.__cozy.world.prepared, window.__cozy.office.prepared]),
  );
  await page
    .getByRole('button', { name: 'Enter the Water', exact: true })
    .click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.evaluate(() => cancelAnimationFrame(window.__cozy.frame));
  // Body, jaw, lure and mirrored feet use the same authored skin. A nested lure must
  // not be tinted a second time when the controller's body has already been traversed.
  report.frogfishSkin = await page.evaluate(() => {
    const f = window.__cozy.world.aquarium.anchoredLife.hidden.frogfish,
      materials = new Set();
    let meshes = 0;
    f.root.traverse((node) => {
      if (!node.isMesh) return;
      for (const material of Array.isArray(node.material)
        ? node.material
        : [node.material])
        if (material.name === 'FrogSkin15') {
          materials.add(material);
          meshes++;
        }
    });
    return { meshes, skinMaterials: materials.size };
  });
  assert(report.frogfishSkin.meshes >= 5);
  assert.equal(
    report.frogfishSkin.skinMaterials,
    1,
    'frogfish skin is tinted once across all parts',
  );
  for (const view of VIEWS) {
    await page.evaluate(async (view) => {
      const THREE = await import('/node_modules/.vite/deps/three.js'),
        w = window.__cozy.world,
        q = w.aquarium,
        life = q.anchoredLife,
        target = new THREE.Vector3(),
        eye = new THREE.Vector3();
      // Fixed creature poses shared by both builds.
      life.hidden.seahorse.pose?.(41);
      life.hidden.frogfish.pose?.(41);
      life.hidden.nudibranchs.pose?.(12);
      const m = life.moray;
      m.extensionUniform.value = 0.7;
      m.behavior.extension = 0.7;
      m.update(1 / 30, true, false);
      w.authored.update?.();
      q.root.updateMatrixWorld(true);
      const kinds = {
        'branching-coral': ['branching', 0],
        'brain-coral': ['rounded', 0],
        'boulder-coral': ['rounded', 2],
        'plate-coral': ['plate', 0],
      };
      const plant = (species) =>
        q.plants.placements
          .filter((p) => p.species.id === species)
          .sort((a, b) => Math.abs(a.position.x) - Math.abs(b.position.x))[0];
      if (kinds[view]) {
        const [kind, n] = kinds[view];
        const f = q.hardscape.formations.filter((f) => f.kind === kind)[n];
        target.copy(f.position).add(new THREE.Vector3(0, 0.6, 0));
        eye
          .copy(target)
          .add(new THREE.Vector3(-Math.sign(f.position.x) * 1.7, 0.6, 1.2));
      } else if (view === 'soft-coral' || view === 'sea-fan') {
        const p = plant(view);
        target
          .set(p.position.x, p.position.y, p.position.z)
          .addScaledVector(
            new THREE.Vector3(p.normal.x, p.normal.y, p.normal.z),
            p.height * 0.5,
          );
        const d = 0.9 + p.height;
        eye
          .copy(target)
          .add(
            new THREE.Vector3(-Math.sign(p.position.x) * d, d * 0.3, d * 0.5),
          );
      } else if (view === 'anemone' || view === 'clownfish') {
        life.anemone.root.getWorldPosition(target);
        target.y += view === 'anemone' ? 0.35 : 0.8;
        eye
          .copy(target)
          .add(
            view === 'anemone'
              ? new THREE.Vector3(1.0, 0.9, 1.5)
              : new THREE.Vector3(1.2, 0.3, 1.6),
          );
      } else if (view === 'moray') {
        m.head.getWorldPosition(target);
        eye.copy(target).add(new THREE.Vector3(0.9, 0.5, 1.9));
      } else {
        const home = life.hidden.homes.find(
          (h) => h.id === (view === 'seahorse' ? 'seahorse-home' : view),
        );
        target.set(home.focus.x, home.focus.y, home.focus.z);
        eye
          .set(home.view.x, home.view.y, home.view.z)
          .sub(target)
          .multiplyScalar(view.startsWith('nudi') ? 0.55 : 0.75)
          .add(target);
      }
      w.camera.position.copy(eye);
      w.camera.lookAt(target);
      w.camera.updateMatrixWorld(true);
    }, view);
    const metrics = await page.evaluate(() => {
      const w = window.__cozy.world;
      w.scene.updateMatrixWorld(true);
      const times = [];
      for (let i = 0; i < 3; i++) {
        const t = performance.now();
        w.renderer.render(w.scene, w.camera);
        times.push(performance.now() - t);
      }
      return {
        calls: w.renderer.info.render.calls,
        triangles: w.renderer.info.render.triangles,
        memory: { ...w.renderer.info.memory },
        cpuSubmitMs: times,
      };
    });
    await page.screenshot({ path: path.join(output, `${view}.png`) });
    report.views.push({ view, ...metrics });
  }
  if (!only || only.includes('frogfish')) {
    report.frogfishMouth = [];
    for (const [name, time, angle] of [
      ['closed', 0, 0],
      ['yawn', 11.8, 0.42],
    ]) {
      const pose = await page.evaluate(async (time) => {
        const THREE = await import('/node_modules/.vite/deps/three.js'),
          { tropicalSnapshot } = await import('/validation/TropicalAudit.ts'),
          w = window.__cozy.world,
          f = w.aquarium.anchoredLife.hidden.frogfish;
        f.pose(time);
        w.scene.updateMatrixWorld(true);
        w.camera.position.copy(
          f.root.localToWorld(new THREE.Vector3(1.1, 0.7, 1.45)),
        );
        w.camera.lookAt(f.root.localToWorld(new THREE.Vector3(0, 0.3, 0.15)));
        w.renderer.render(w.scene, w.camera);
        return {
          jaw: f.jaw.rotation.x,
          attached: !!f.jaw.getObjectByName('FrogJaw'),
          inventory: tropicalSnapshot(w.aquarium),
        };
      }, time);
      assert(pose.attached, 'the animated pivot carries the authored jaw');
      assert(Math.abs(pose.jaw - angle) < 1e-6);
      await page.screenshot({
        path: path.join(output, `frogfish-${name}.png`),
      });
      report.frogfishMouth.push({ name, time, ...pose });
    }
  }
  report.webglErrors = await page.evaluate(() =>
    window.__cozy.world.renderer.getContext().getError(),
  );
  assert.equal(report.webglErrors, 0);
  assert.deepEqual(report.errors, []);
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify({ ...report, views: report.views.length }, null, 1));
