/** Pass 105: short local Antarctic views and canonical model gallery; no journey/stress benchmark. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy-pass105';
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
const errors = [];
const galleryOnly = process.env.COZY_GALLERY_ONLY === '1';
const smokeOnly = process.env.COZY_SMOKE_ONLY === '1';
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 650 } });
  page.setDefaultTimeout(240000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const base = process.env.COZY_URL || 'http://127.0.0.1:5173';
  await page.route(base + '/', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<body style="margin:0"></body>',
    }),
  );
  await page.goto(base);
  const prepared = await page.evaluate(async (galleryOnly) => {
    const T = await import('/node_modules/three/build/three.module.js');
    const { AssetLoader } = await import('/src/assets/AssetLoader.ts');
    const { UnderIceScene } = await import('/src/rendering/UnderIceScene.ts');
    const renderer = new T.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(900, 650);
    renderer.setPixelRatio(0.7);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    document.body.append(renderer.domElement);
    const loader = new AssetLoader(undefined, undefined, renderer);
    const world = galleryOnly
      ? undefined
      : await UnderIceScene.build(renderer, {
          fish: loader,
          soundSpots: 0,
        });
    if (world) await world.prepared;
    window.review = { T, renderer, loader, world };
    if (!world)
      return { state: 'gallery-only', loaded: true, sights: [], homes: {} };
    return {
      state: world.preparation.state,
      loaded: world.minis.loaded,
      sights: world.minis.sightings.map((s) => s.id),
      homes: world.minis.homes,
    };
  }, galleryOnly);
  if (!galleryOnly) {
    assert.equal(prepared.state, 'ready');
    assert.equal(prepared.loaded, true);
    assert.equal(prepared.sights.length, 3);
  }
  const habitat = {};
  for (const kind of smokeOnly ? [] : Object.keys(prepared.homes)) {
    habitat[kind] = await page.evaluate((kind) => {
      const { T, renderer, world } = window.review,
        h = world.minis.homes[kind];
      world.camera.position.copy(h.view);
      world.camera.lookAt(new T.Vector3(h.target.x, h.target.y, h.target.z));
      const player = {
        position: world.camera.position,
        velocity: { x: 0, y: 0, z: 0 },
        active: true,
      };
      // Only localized frames: settle the local pose, then compare the same frozen view.
      for (let i = 0; i < 1; i++)
        world.render(i * 0.1, false, 0.1, true, player);
      world.minis.root.visible = false;
      world.render(0, false, 0, false, player);
      const baseline = { ...renderer.info.render };
      world.minis.root.visible = true;
      world.render(0, false, 0, false, player);
      const visible = { ...renderer.info.render };
      return {
        baseline,
        visible,
        extraCalls: visible.calls - baseline.calls,
        extraTriangles: visible.triangles - baseline.triangles,
        fog: world.scene.fog.density,
      };
    }, kind);
    assert.ok(habitat[kind].extraCalls >= 0 && habitat[kind].extraCalls <= 3);
    await page.screenshot({ path: `${output}/${kind}-habitat.png` });
  }
  const smoke = galleryOnly
    ? null
    : await page.evaluate(async () => {
        const { T, world } = window.review;
        const { SightingTracker } = await import('/src/discovery/journal.ts');
        const { ICE } = await import('/src/config/passage.ts');
        const observed = [];
        for (const [kind, h] of Object.entries(world.minis.homes)) {
          const candidate = world.minis.sightings.find(
            (c) =>
              c.id ===
              {
                angel: 'species:sea-angel',
                slug: 'species:tritoniella-belli',
                isopod: 'species:giant-isopod',
              }[kind],
          );
          const eye = h.view,
            at = new T.Vector3(
              candidate.position.x,
              candidate.position.y,
              candidate.position.z,
            ),
            forward = at.sub(eye).normalize(),
            tracker = new SightingTracker([]);
          for (let i = 0; i < 100; i++) {
            const found = tracker.update([candidate], eye, forward, 1 / 30);
            if (found) {
              observed.push(found.id);
              break;
            }
          }
        }
        world.minis.update(0.1, true, false);
        const shrimp = world.minis.root.getObjectByName(
            'Glyptonotus_Antarcticus',
          ),
          weights = [...shrimp.morphTargetInfluences];
        world.minis.update(0.1, false, false);
        const pause = weights.every(
          (w, i) => w === shrimp.morphTargetInfluences[i],
        );
        world.minis.update(0.1, true, true);
        const reduced = shrimp.morphTargetInfluences.every((w) => w === 0);
        return {
          observed,
          pause,
          reduced,
          wildlifeReady: await world.life.ready,
          iceHoles: ICE.holes.length,
          fog: world.scene.fog.density,
          approvedFog: ICE.fog,
          returnPassages: world.environment.root.children
            .filter((o) => /Ice tunnel/.test(o.name))
            .map((o) => o.name),
        };
      });
  if (smoke) {
    assert.equal(smoke.observed.length, 3);
    assert.equal(smoke.pause, true);
    assert.equal(smoke.reduced, true);
    assert.equal(smoke.wildlifeReady, true);
    assert.equal(smoke.iceHoles, 3);
    assert.equal(smoke.fog, smoke.approvedFog);
  }
  if (smokeOnly) await page.evaluate(() => window.review.world.dispose());
  else {
    const gallery = await page.evaluate(async () => {
      const { T, loader, world } = window.review;
      world?.dispose();
      const { babyDefinition } = await import('/src/config/babies.ts');
      const { acquireCollectionArt } =
        await import('/src/environment/TankCollectionArt.ts');
      const scene = new T.Scene();
      scene.background = new T.Color('#15393d');
      scene.add(new T.HemisphereLight(0xe7f4ef, 0x3c4650, 1.6));
      const light = new T.DirectionalLight(0xffffff, 2);
      light.position.set(1, 2, 3);
      scene.add(light);
      const camera = new T.PerspectiveCamera(40, 900 / 650, 0.01, 10);
      camera.position.set(0.65, 0.55, 1.1);
      camera.lookAt(0, 0.12, 0);
      window.review.gallery = { scene, camera, arts: [] };
      const results = [];
      for (const [i, id] of [
        'sea-angel',
        'tritoniella-belli',
        'giant-isopod',
      ].entries()) {
        const art = await acquireCollectionArt(babyDefinition(id), loader);
        art.model.visible = false;
        scene.add(art.model);
        window.review.gallery.arts.push(art);
        results.push({ id, index: i });
      }
      return results;
    });
    for (const { id, index } of gallery) {
      await page.evaluate(
        ({ index }) => {
          const { renderer, gallery: g } = window.review;
          g.arts.forEach((a, i) => (a.model.visible = i === index));
          const art = g.arts[index];
          art.update(1, 0, index === 0 ? 79 : 45);
          art.model.updateMatrixWorld(true);
          const box = new window.review.T.Box3().setFromObject(art.model);
          const size = box.getSize(new window.review.T.Vector3()).length();
          const center = box.getCenter(new window.review.T.Vector3());
          g.camera.position
            .copy(center)
            .add(
              new window.review.T.Vector3(size * 0.8, size * 0.65, size * 1.8),
            );
          g.camera.lookAt(center);
          renderer.render(g.scene, g.camera);
        },
        { index },
      );
      await page.screenshot({ path: `${output}/${id}-model.png` });
    }
  }
  const released = await page.evaluate(() => {
    const r = window.review;
    r.gallery?.arts.forEach((a) => a.dispose());
    r.gallery?.scene.traverse((o) => {
      if (o.isLight) o.dispose();
    });
    const leases = r.loader.leased;
    r.loader.dispose();
    r.renderer.renderLists.dispose();
    r.renderer.dispose();
    return { ...r.renderer.info.memory, leases };
  });
  assert.equal(released.geometries, 0);
  assert.equal(released.leases, 0);
  assert.equal(errors.length, 0);
  fs.writeFileSync(
    `${output}/report.json`,
    JSON.stringify(
      {
        prepared,
        habitat,
        smoke,
        released,
        errors,
        renderer:
          'Chromium SwiftShader; Antarctic-only localized views, no traversal',
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      prepared: prepared.state,
      sights: prepared.sights,
      released,
      errors,
      output,
    }),
  );
} finally {
  await browser.close();
}
