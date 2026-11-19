/** Actual scene + asset-loader fault injection, independent of application navigation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy-wreck-failure';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.COZY_CHROMIUM,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const errors = [];
const expectedErrors = [];
let failedRequests = 0;
try {
  const page = await browser.newPage({
    viewport: { width: 640, height: 400 },
    deviceScaleFactor: 0.25,
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const t = m.text();
      if (
        t.includes('Barracuda ') ||
        t.includes("wreck's barracuda") ||
        t.includes('503 (Service Unavailable)') ||
        t.includes('failed to load barracuda; keeping procedural fallback')
      )
        expectedErrors.push(t);
      else errors.push(t);
    }
  });
  await page.route('**/assets/models/creatures/barracuda.glb*', (route) => {
    failedRequests++;
    return route.fulfill({
      status: 503,
      contentType: 'text/plain',
      body: 'Injected wildlife asset failure',
    });
  });
  await page.route('**/wreck-failure-fixture', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body><canvas></canvas></body></html>',
    }),
  );
  await page.goto(
    `${process.env.COZY_URL || 'http://127.0.0.1:5174'}/wreck-failure-fixture`,
  );
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { AssetLoader } = await import('/src/assets/AssetLoader.ts');
    const { ShipwreckScene } = await import('/src/rendering/ShipwreckScene.ts');
    const { SoloCreature } =
      await import('/src/environment/outer/SoloCreature.ts');
    const renderer = new THREE.WebGLRenderer({
      canvas: document.querySelector('canvas'),
    });
    renderer.setSize(160, 100);
    const tracked = new Map(),
      getProperty = renderer.properties.get;
    renderer.properties.get = function (o) {
      if (o?.isTexture && !tracked.has(o)) tracked.set(o, { disposed: false });
      if (o?.isTexture && tracked.get(o) && !tracked.get(o).listening) {
        const data = tracked.get(o);
        data.listening = true;
        o.addEventListener('dispose', () => (data.disposed = true));
      }
      return getProperty(o);
    };
    const loader = new AssetLoader(undefined, undefined, renderer),
      baseline = { ...renderer.info.memory };
    const dispose = SoloCreature.prototype.dispose;
    let disposals = 0;
    SoloCreature.prototype.dispose = function () {
      disposals++;
      return dispose.call(this);
    };
    let scene;
    try {
      const start = performance.now();
      scene = await ShipwreckScene.build(renderer, {
        fish: loader,
        soundSpots: 0,
      });
      const prepared = await scene.prepared;
      scene.camera.position.set(0, 12, -26.5);
      scene.render(0, false, 0.1, true, {
        active: true,
        position: { x: 0, y: 12, z: -26.5 },
        velocity: { x: 0, y: 0, z: 0 },
      });
      const result = {
        prepared,
        ready: scene.isReady,
        state: scene.preparation.state,
        summary: scene.preparation.summary,

        immediateDisposals: disposals,
        solos: scene.life.solos.length,
        posed: scene.life.posed.length,
        schools: scene.life.schools.fish.simulation.fish.length,
        leased: loader.leased,
        draw: { ...renderer.info.render },
        loadMs: performance.now() - start,
        baseline,
      };
      await pageFrame();
      scene.dispose();
      result.releasedLeases = loader.leased;
      result.cachedMemoryAfterSceneRelease = { ...renderer.info.memory };
      await loader.dispose();
      renderer.render(new THREE.Scene(), new THREE.PerspectiveCamera());
      result.releasedMemory = { ...renderer.info.memory };
      result.releasedPrograms = renderer.info.programs.length;
      result.outstandingTextures = [...tracked]
        .filter(([t]) => getProperty(t).__webglTexture)
        .map(([t, data]) => ({
          name: t.name,
          type: t.constructor.name,
          image: {
            width: t.image?.width,
            height: t.image?.height,
            depth: t.image?.depth,
          },
          ...data,
        }));
      return result;
    } finally {
      scene?.dispose();
      await loader.dispose();
      renderer.dispose();
      SoloCreature.prototype.dispose = dispose;
    }
    function pageFrame() {
      return new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });
  fs.writeFileSync(
    `${output}/report.json`,
    JSON.stringify({ result, errors, expectedErrors, failedRequests }, null, 2),
  );
  assert.equal(result.prepared, true);
  assert.equal(result.ready, true);
  assert.equal(result.state, 'partial');
  assert.equal(result.summary.wildlife, 'failed');
  assert.equal(result.immediateDisposals, 16);
  assert.equal(result.solos, 3);
  assert.equal(result.posed, 3);
  assert(result.schools >= 200);
  assert(result.draw.calls > 0);
  assert.equal(failedRequests, 1);
  assert.equal(result.releasedLeases, 0);
  assert.equal(result.releasedPrograms, 0);
  // Three.js r187 retains its renderer-wide BRDF lookup independently of scene/assets.
  assert.deepEqual(result.releasedMemory, { geometries: 0, textures: 1 });
  assert.equal(result.outstandingTextures.length, 1);
  assert.equal(result.outstandingTextures[0].name, 'DFG_LUT');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
