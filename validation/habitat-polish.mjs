/* Render the actual water-world scenes independently for a focused visual/lifecycle review.
 * This does not substitute for a full player journey or performance measurements on real hardware.
 * COZY_PLAYWRIGHT=/path/to/playwright/index.mjs COZY_CHROMIUM=/usr/bin/chromium node validation/habitat-polish.mjs
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy-habitat-polish';
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
const report = { errors: [], worlds: {} };
try {
  const page = await browser.newPage({
    viewport: { width: 800, height: 500 },
    deviceScaleFactor: 1,
  });
  page.setDefaultTimeout(240000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  const base = process.env.COZY_URL || 'http://127.0.0.1:5173';
  await page.route(base + '/', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body style="margin:0"></body></html>',
    }),
  );
  await page.goto(base);
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { AssetLoader } = await import('/src/assets/AssetLoader.ts');
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(800, 500);
    renderer.setPixelRatio(0.7);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    document.body.append(renderer.domElement);
    const fish = new AssetLoader(undefined, undefined, renderer);
    window.review = { THREE, renderer, fish };
  });
  for (const id of (process.env.COZY_WORLDS || 'cave,ice,outer').split(',')) {
    console.log('Preparing', id);
    report.worlds[id] = await page.evaluate(async (id) => {
      const r = window.review;
      if (id === 'cave') {
        const { SeaCaveScene } = await import('/src/rendering/SeaCaveScene.ts');
        r.world = await SeaCaveScene.build(r.renderer, {
          fish: r.fish,
          soundSpots: 0,
        });
      } else if (id === 'ice') {
        const { UnderIceScene } =
          await import('/src/rendering/UnderIceScene.ts');
        r.world = await UnderIceScene.build(r.renderer, {
          fish: r.fish,
          soundSpots: 0,
        });
      } else {
        const { OuterWatersScene } =
          await import('/src/rendering/OuterWatersScene.ts');
        r.plants = new r.THREE.MeshStandardMaterial({ vertexColors: true });
        r.world = new OuterWatersScene(r.renderer, {
          fish: r.fish,
          reef: r.fish,
          plants: r.plants,
          soundSpots: 0,
        });
        r.world.begin();
      }
      await r.world.prepared;
      if (id === 'outer') await r.world.reefPrepared;
      r.player = {
        position: { x: 0, y: 6, z: -14 },
        velocity: { x: 0, y: 0, z: 0 },
        active: true,
      };
      return {
        state: r.world.preparation.state,
        parts: r.world.preparation.summary,
        sights: [...new Set(r.world.sightings.map((s) => s.id))],
      };
    }, id);
    assert.equal(report.worlds[id].state, 'ready');
    const expected = {
      cave: [
        'species:encrusting-sponge',
        'species:tube-sponge',
        'species:sea-squirt',
        'species:mysid',
      ],
      ice: ['plant:ice-algae', 'species:sea-angel'],
      outer: ['species:christmas-tree-worm'],
    }[id];
    for (const sight of expected)
      assert.ok(
        report.worlds[id].sights.includes(sight),
        `${id} exposes ${sight}`,
      );
    const views =
      id === 'cave'
        ? [
            ['cave-room', [0, 5, -15], [1, 3, -28]],
            ['cave-tunnel', [0, 3, -12], [0, 3, -6]],
            ['cave-nurse', [-7, 2, -28], [-6, 0.7, -33]],
          ]
        : id === 'ice'
          ? [
              ['ice-room', [0, 5, -12], [0, 9, -27]],
              ['ice-hole', [3, 7, -21], [0, 15, -25]],
            ]
          : [
              ['reef-edge', [0, 7, -58.8], [0, -1, -67]],
              ['reef-floor', [0, -8, -58.8], [0, -24, -78]],
            ];
    for (const [name, position, target] of views) {
      await page.evaluate(
        ({ position, target }) => {
          const r = window.review,
            w = r.world;
          w.camera.position.set(...position);
          w.camera.lookAt(...target);
          Object.assign(r.player.position, {
            x: position[0],
            y: position[1],
            z: position[2],
          });
          w.render(0, false, 2, false, r.player);
        },
        { position, target },
      );
      await page.screenshot({ path: `${output}/${name}.png` });
    }
    if (id === 'ice') {
      report.whales = {};
      for (const species of ['minke-whale', 'killer-whales']) {
        report.whales[species] = await page.evaluate((species) => {
          const r = window.review,
            w = r.world;
          const eye = { x: 0, y: 6, z: -14 };
          Object.assign(r.player.position, eye);
          w.rare.director.arrive();
          const started = w.rare.director.bring(species, eye);
          for (let i = 0; i < 720; i++)
            w.rare.update(1 / 60, true, false, r.player, w.camera);
          const pose = w.rare.director.encounters[species].poses[0];
          w.camera.position.set(
            pose.position.x + 7,
            pose.position.y - 1,
            pose.position.z + 5,
          );
          w.camera.lookAt(pose.position.x, pose.position.y, pose.position.z);
          w.render(0, false, 2, false, r.player);
          return {
            started,
            count: w.rare.director.encounters[species].poses.length,
            position: { ...pose.position },
          };
        }, species);
        assert.equal(report.whales[species].started, true);
        assert.equal(report.whales[species].count, 1);
        await page.screenshot({ path: `${output}/${species}.png` });
      }
    }
    await page.evaluate(() => {
      const r = window.review;
      r.world.dispose();
      r.world = undefined;
      r.plants?.dispose();
      r.renderer.renderLists.dispose();
    });
  }
  assert.deepEqual(report.errors, []);
} finally {
  fs.writeFileSync(
    `${output}/report.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
