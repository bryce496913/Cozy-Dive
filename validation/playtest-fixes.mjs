/* Pass 019: evidence for the playtest fixes on one build.
 *
 *   COZY_URL=http://127.0.0.1:5174 COZY_OUTPUT=/tmp/cozy019-before node validation/playtest-fixes.mjs  # previous candidate
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy019-after  node validation/playtest-fixes.mjs  # this branch
 *
 * 1. Swims with real input (Enter, pointer lock, held W, mouse look) at the default speed setting
 *    and reports the peak swimming speed from the controller state.
 * 2. Counts GPU textures resident after preparation and again after swimming around. Any growth
 *    is a texture uploaded lazily on first sight (what showed as texture pop-in).
 * 3. Captures fixed-camera views of the seahorse, clownfish family, filter corner and moray den.
 * Software-rendered timings are diagnostics only, not hardware FPS.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy019-playtest';
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
const base = process.env.COZY_URL || 'http://127.0.0.1:5173';
const report = { base, errors: [] };
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 750 },
  });
  page.setDefaultTimeout(Number(process.env.COZY_ACTION_TIMEOUT || 240000));
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body: (await r.text()) + '\nwindow.__cozy=app;',
    });
  });
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  await page.goto(base);
  await page.waitForFunction(() => window.__cozy?.world);
  report.prepared = await page.evaluate(() => window.__cozy.world.prepared);
  report.texturesPrepared = await page.evaluate(
    () => window.__cozy.world.renderer.info.memory.textures,
  );
  await page
    .getByRole('button', { name: 'Enter the Water', exact: true })
    .click();
  // Wait until entry has fully settled (as visual-benchmark does): a late pointer-lock change
  // clears held keys by design, so pressing W earlier can be silently dropped.
  await page.waitForFunction(
    () =>
      !!document.pointerLockElement &&
      window.__cozy.entered &&
      document.querySelector('#overlay').hidden,
  );
  await page.waitForTimeout(1500);
  report.speedSetting = await page.evaluate(() => window.__cozy.settings.speed);
  // Swim forward while turning slowly, so new parts of the aquarium come into view.
  let peak = 0;
  const start = await page.evaluate(() => ({
    ...window.__cozy.state.position,
  }));
  await page.keyboard.down('w');
  for (let i = 0; i < 40; i++) {
    await page.mouse.move(550 + (i % 2 ? 40 : -40), 375);
    await page.waitForTimeout(250);
    const v = await page.evaluate(() => {
      const s = window.__cozy.state.velocity;
      return Math.hypot(s.x, s.y, s.z);
    });
    peak = Math.max(peak, v);
  }
  await page.keyboard.up('w');
  const end = await page.evaluate(() => ({ ...window.__cozy.state.position }));
  report.swimDistance = +Math.hypot(
    end.x - start.x,
    end.y - start.y,
    end.z - start.z,
  ).toFixed(2);
  assert(report.swimDistance > 1, 'held W must actually swim the diver');
  report.peakSwimSpeed = +peak.toFixed(3);
  report.texturesAfterSwim = await page.evaluate(
    () => window.__cozy.world.renderer.info.memory.textures,
  );
  report.lazyTextureUploads =
    report.texturesAfterSwim - report.texturesPrepared;
  await page.evaluate(() => cancelAnimationFrame(window.__cozy.frame));
  report.views = [];
  for (const view of ['seahorse', 'clownfish', 'filter', 'moray']) {
    report.views.push(
      await page.evaluate(async (view) => {
        const THREE = await import('/node_modules/.vite/deps/three.js'),
          w = window.__cozy.world,
          q = w.aquarium,
          life = q.anchoredLife,
          target = new THREE.Vector3(),
          eye = new THREE.Vector3();
        life.hidden.seahorse.pose(41);
        const m = life.moray;
        m.behavior.extension = 1;
        m.update(1 / 30, true, false);
        w.authored.update?.();
        q.root.updateMatrixWorld(true);
        const info = { view };
        if (view === 'seahorse') {
          const s = life.hidden.seahorse;
          s.root.getWorldPosition(target);
          const box = new THREE.Box3().setFromObject(s.root);
          info.height = +(box.max.y - box.min.y).toFixed(3);
          target.y = (box.max.y + box.min.y) / 2;
          const d = Math.max(0.5, info.height * 3.5);
          // From the open front of the tank (+z): the horse and the plant it grips side by side.
          eye.copy(target).add(new THREE.Vector3(0, d * 0.22, d));
        } else if (view === 'clownfish') {
          life.anemone.root.getWorldPosition(target);
          target.y += 0.6;
          eye.copy(target).add(new THREE.Vector3(1.2, 0.35, 1.6));
          info.lengths = q.fish.simulation.fish
            .filter((f) => f.species.id === 'ocellaris-clownfish')
            .map((f) => +(f.species.length * f.size).toFixed(3));
        } else if (view === 'filter') {
          const f = q.ornaments.models.find((m) => m.kind === 'filter').root;
          const box = new THREE.Box3().setFromObject(f);
          info.top = +box.max.y.toFixed(2);
          info.bottom = +box.min.y.toFixed(2);
          target.set(f.position.x, f.position.y + 0.4, f.position.z);
          eye.copy(target).add(new THREE.Vector3(-4.5, -1.6, 5));
        } else {
          // Looking into the log mouth along its axis, as in the playtest screenshot.
          const n = new THREE.Vector3(
            m.anchor.orientation.x,
            m.anchor.orientation.y,
            m.anchor.orientation.z,
          );
          target.copy(m.root.position).addScaledVector(n, 1.2);
          target.y -= 0.45;
          eye
            .copy(m.root.position)
            .addScaledVector(n, 4.2)
            .add(new THREE.Vector3(0.6, 0.15, 0));
          info.headLocal = m.head.position.toArray().map((v) => +v.toFixed(3));
        }
        w.camera.position.copy(eye);
        w.camera.lookAt(target);
        w.camera.updateMatrixWorld(true);
        w.scene.updateMatrixWorld(true);
        w.renderer.render(w.scene, w.camera);
        return info;
      }, view),
    );
    await page.screenshot({ path: path.join(output, `${view}.png`) });
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
console.log(JSON.stringify(report, null, 1));
