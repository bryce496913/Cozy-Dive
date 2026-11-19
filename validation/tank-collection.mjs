/* Focused catalog/save and real-art review. Constructs an isolated tank-sized habitat, not a full player journey.
 * COZY_URL=http://127.0.0.1:5174 COZY_PLAYWRIGHT=/path/to/playwright/index.mjs node validation/tank-collection.mjs
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const base = process.env.COZY_URL || 'http://127.0.0.1:5174';
const output = process.env.COZY_OUTPUT || '/tmp/cozy-tank-collection';
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
const report = { errors: [] };
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 650 },
  });
  page.setDefaultTimeout(240000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  await page.route(base + '/', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body style="margin:0;display:flex;background:#142f3a"><aside id="catalog" style="width:300px;height:650px;overflow:auto;background:#e3eade;padding:12px;font:14px sans-serif"></aside></body></html>',
    }),
  );
  await page.goto(base);
  report.collection = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { AssetLoader } = await import('/src/assets/AssetLoader.ts');
    const { TANK_BABIES } = await import('/src/config/babies.ts');
    const { TANK_FISH } = await import('/src/config/tankFish.ts');
    const { AQUARIUM } = await import('/src/config/world.ts');
    const { SIGHTS } = await import('/src/discovery/sights.ts');
    const { TankCatalog, saveTank, loadTankState, loadTankFish } =
      await import('/src/catalog/catalog.ts');
    const { renderCatalog } = await import('/src/catalog/TankCatalogPanel.ts');
    const { TankBabies } = await import('/src/environment/TankBabies.ts');
    const { TankFish } = await import('/src/environment/TankFish.ts');
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(800, 650);
    renderer.setPixelRatio(0.7);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    document.body.append(renderer.domElement);
    const loader = new AssetLoader(undefined, undefined, renderer),
      habitat = { bounds: AQUARIUM, rocks: [] };
    const seen = SIGHTS.map((s) => ({ ...s, first: '' })),
      context = { keepOut: [], routes: [], surface: () => 0 },
      model = new TankCatalog([], context),
      panel = document.querySelector('#catalog');
    const actions = {
      choose() {},
      baby(id) {
        if (model.babies.includes(id)) model.removeBaby(id);
        else model.addBaby(id, seen);
        refresh();
      },
      fish(id, add) {
        if (add) model.addFish(id, seen);
        else model.removeFish(id);
        refresh();
      },
      undo() {
        model.undo();
        refresh();
      },
      close() {},
    };
    function refresh() {
      renderCatalog(panel, model, seen, true, actions);
    }
    refresh();
    // Use the actual catalog controls to collect one of every kind.
    for (const d of TANK_FISH) {
      const button = panel.querySelector(`[data-key="fish-add-${d.species}"]`);
      if (!button || button.disabled)
        throw Error(`Fish not offered: ${d.label}`);
      button.click();
    }
    for (const d of TANK_BABIES) {
      const button = panel.querySelector(`[data-key="baby-${d.id}"]`);
      if (!button || button.disabled)
        throw Error(`Creature not offered: ${d.label}`);
      button.click();
    }
    saveTank(localStorage, [], model.babies, undefined, model.fish);
    const saved = loadTankState(localStorage, seen, context),
      savedFish = loadTankFish(localStorage, seen);
    const fish = new TankFish(loader, habitat, []);
    if (!fish.set(model.fish))
      throw Error('Full fish collection could not be seated');
    await fish.ready;
    const babies = new TankBabies(
      loader,
      { solids: [], floor: () => 0 },
      habitat,
      (message) => {
        throw Error(message);
      },
      fish.bodies,
    );
    babies.set(model.babies, { x: 0, y: 4.6, z: 9 });
    await babies.ready;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x28566b);
    scene.add(new THREE.HemisphereLight(0xcdeaf2, 0x9e9477, 2));
    const sun = new THREE.DirectionalLight(0xffefda, 2);
    sun.position.set(-5, 20, 10);
    scene.add(sun);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 26),
      new THREE.MeshStandardMaterial({ color: 0xbdbbaa, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor, fish.root, babies.root);
    const camera = new THREE.PerspectiveCamera(55, 800 / 650, 0.05, 100);
    camera.position.set(0, 9, 18);
    camera.lookAt(0, 2, 4);
    for (let i = 0; i < 60; i++) {
      fish.update(1 / 30, true, true, undefined, camera);
      babies.update(1 / 30, true, true, undefined, camera);
    }
    renderer.render(scene, camera);
    const result = {
      fish: TANK_FISH.length,
      creatures: TANK_BABIES.length,
      loadedFish: fish.bodies.length,
      loadedCreatures: babies.animals.length,
      savedCreatures: saved.babies.length,
      savedFish: Object.keys(savedFish).length,
      excludedSection: panel.textContent.includes('Not for this tank'),
      ecologicalReasons:
        /Grows too big|Needs the dark|cool kelp-forest|already hosts|freezing polar/.test(
          panel.textContent,
        ),
    };
    window.collectionReview = {
      THREE,
      renderer,
      loader,
      fish,
      babies,
      scene,
      camera,
      floor,
    };
    return result;
  });
  assert.equal(report.collection.creatures, report.collection.loadedCreatures);
  assert.equal(report.collection.fish, report.collection.loadedFish);
  assert.equal(report.collection.creatures, report.collection.savedCreatures);
  assert.equal(report.collection.fish, report.collection.savedFish);
  assert.equal(report.collection.excludedSection, false);
  assert.equal(report.collection.ecologicalReasons, false);
  await page.screenshot({ path: `${output}/collection.png` });
  for (const id of ['killer-whale', 'moray-eel', 'lionfish', 'spiny-lobster']) {
    await page.evaluate((id) => {
      const r = window.collectionReview,
        b = r.babies.animals.find((b) => b.definition.id === id),
        p = b.position;
      r.camera.position.set(p.x + 1, p.y + 0.55, p.z + 1.3);
      r.camera.lookAt(p.x, p.y, p.z);
      r.babies.update(0, false, true, undefined, r.camera);
      r.fish.update(0, false, true, undefined, r.camera);
      r.renderer.render(r.scene, r.camera);
    }, id);
    await page.screenshot({ path: `${output}/${id}.png` });
  }
  report.disposal = await page.evaluate(() => {
    const r = window.collectionReview;
    r.babies.dispose();
    r.fish.dispose();
    r.loader.dispose();
    r.floor.geometry.dispose();
    r.floor.material.dispose();
    r.renderer.renderLists.dispose();
    return { creatures: r.babies.animals.length, leases: r.loader.leased };
  });
  assert.equal(report.disposal.creatures, 0);
  assert.equal(report.disposal.leases, 0);
  assert.deepEqual(report.errors, []);
} finally {
  fs.writeFileSync(
    `${output}/report.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
