/* Pass 016: matched reef-fish close-ups, budgets and errors for one build.
 *
 *   COZY_URL=http://127.0.0.1:5174 COZY_OUTPUT=/tmp/cozy016-before node validation/fish-overhaul.mjs
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy016-after  node validation/fish-overhaul.mjs
 * The simulation is frozen, then each view frames the first fish of a species from its own right
 * side at a distance proportional to body length, so captures compare across builds even though
 * fish positions differ. Software-rendered timings are diagnostics only, not hardware FPS.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy016-fish';
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
  ['chromis', 'blue-green-chromis', 2.6],
  ['chromis-school', 'blue-green-chromis', 0],
  ['cardinalfish', 'pajama-cardinalfish', 2.2],
  ['firefish', 'firefish-goby', 2.0],
  ['assessor', 'yellow-assessor', 2.2],
  ['gramma', 'royal-gramma', 2.2],
  ['clownfish', 'ocellaris-clownfish', 2.2],
];
try {
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
    if (m.type() === 'error') report.errors.push(m.text());
  });
  page.on('request', (r) => {
    if (r.url().includes('.glb')) report.requests.push(r.url());
  });
  await page.goto(base);
  await page.waitForFunction(() => window.__cozy?.world);
  await page.evaluate(() =>
    Promise.all([
      window.__cozy.world.authored.ready,
      window.__cozy.world.reef?.ready,
    ]),
  );
  await page
    .getByRole('button', { name: 'Enter the Water', exact: true })
    .click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.evaluate(() => cancelAnimationFrame(window.__cozy.frame));
  for (const [view, species, distance] of VIEWS) {
    await page.evaluate(
      async ({ species, distance }) => {
        const THREE = await import('/node_modules/.vite/deps/three.js'),
          w = window.__cozy.world,
          f = w.aquarium.fish,
          i = f.simulation.fish.findIndex((x) => x.species.id === species),
          fish = f.simulation.fish[i],
          root = f.visuals[i].root;
        w.authored.update?.();
        w.scene.updateMatrixWorld(true);
        const target = root.getWorldPosition(new THREE.Vector3());
        if (distance === 0) {
          // Whole school: centroid of the species, viewed from the open channel side.
          target.set(0, 0, 0);
          const members = f.simulation.fish.filter(
            (x) => x.species.id === species,
          );
          members.forEach((m) => target.add(m.position));
          target.divideScalar(members.length);
          w.camera.position
            .copy(target)
            .add(new THREE.Vector3(-Math.sign(target.x || 1) * 3.5, 0.8, 3));
        } else {
          const side = new THREE.Vector3(0, 0, 1).applyQuaternion(
            root.getWorldQuaternion(new THREE.Quaternion()),
          );
          side.y = 0;
          side.normalize();
          w.camera.position
            .copy(target)
            .addScaledVector(side, fish.species.length * distance)
            .add(new THREE.Vector3(0, fish.species.length * 0.25, 0));
        }
        w.camera.lookAt(target);
        w.camera.updateMatrixWorld(true);
      },
      { species, distance },
    );
    const metrics = await page.evaluate(() => {
      const w = window.__cozy.world;
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
    report.views.push({ view, species, ...metrics });
  }
  // Pause equality: authored rigs must freeze exactly with the simulation.
  report.pause = await page.evaluate(() => {
    const w = window.__cozy.world,
      q = w.aquarium;
    const sample = () =>
      JSON.stringify(
        q.root.children
          .filter(
            (o) => o.name.startsWith('Authored') && o.name.endsWith('school'),
          )
          .map((s) => Array.from(s.children[0]?.instanceMatrix?.array ?? [])),
      );
    q.update(0, false, 1 / 30, true);
    w.authored.update();
    const before = sample();
    q.update(10, false, 1 / 30, false);
    w.authored.update();
    return {
      schools: q.root.children.filter((o) => o.name.endsWith('school')).length,
      frozen: before === sample(),
    };
  });
  report.webglErrors = await page.evaluate(() =>
    window.__cozy.world.renderer.getContext().getError(),
  );
  assert.equal(report.webglErrors, 0);
  assert.deepEqual(report.errors, []);
  assert.equal(report.pause.frozen, true);
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify({ ...report, views: report.views.length }, null, 1));
