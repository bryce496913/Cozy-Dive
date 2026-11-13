/* Outer reef enrichment: staged rendered views, scaled body clearance, fish load and ownership.
 * COZY_URL=http://127.0.0.1:5173 node validation/reef-life.mjs
 * Native entry/pause/resume and W are real; world and camera positions are staged.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy-reef-life';
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
const report = { errors: [], views: [] };
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  page.setDefaultTimeout(240000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
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
  await page.waitForFunction(() => window.__cozy?.office);
  await page.evaluate(() =>
    Promise.all([window.__cozy.world.prepared, window.__cozy.office.prepared]),
  );
  const step = (n = 1) =>
    page.evaluate(async (n) => {
      const a = window.__cozy;
      for (let i = 0; i < n; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        cancelAnimationFrame(a.frame);
        a.__t = (a.__t ?? performance.now()) + 100;
        a.tick(a.__t);
        cancelAnimationFrame(a.frame);
      }
    }, n);
  await page
    .getByRole('button', { name: 'Enter the Water', exact: true })
    .click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await step(2);
  const memory = () =>
    page.evaluate(() => ({ ...window.__cozy.world.renderer.info.memory }));
  report.before = await memory();
  await page.evaluate(() => {
    const a = window.__cozy;
    Object.assign(a.state.position, { x: 6.4, y: 1.6, z: -12.1 });
    a.state.neutralDepth = 1.6;
    a.controls.clear();
  });
  await step();
  await page.evaluate(() => window.__cozy.outer.prepared);
  await page.evaluate(() => window.__cozy.setWaterWorld('outer'));
  await page.evaluate(() => window.__cozy.outer.reefPrepared);
  console.log('reef prepared');
  report.population = await page.evaluate(() => {
    const o = window.__cozy.outer;
    return {
      fish: o.schools.fish.simulation.fish.length,
      creatures: o.creatures.cruisers.length,
      scales: o.creatures.root.children.map((r) => r.scale.x),
      species: o.creatures.cruisers.map((c) => ({
        id: c.species.id,
        scale: c.species.scale,
        radius: c.species.radius,
      })),
    };
  });
  assert.equal(report.population.fish, 235);
  assert.equal(report.population.creatures, 9);
  assert.deepEqual(
    report.population.scales,
    report.population.species.map((s) => s.scale),
  );
  // Actual morphing model vertices, including the rendered scale, yaw, pitch and bank.
  report.clearance = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js'),
      { ColliderGrid } = await import('/src/player/terrainCollision.ts'),
      { seabedHeight } = await import('/src/environment/outer/OuterTerrain.ts'),
      o = window.__cozy.outer,
      grid = new ColliderGrid(o.reef.colliders),
      nearby = [],
      point = new THREE.Vector3(),
      inactive = {
        active: false,
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
      };
    let samples = 0,
      hits = 0,
      lowest = Infinity;
    for (let second = 0; second < 180; second++) {
      for (let k = 0; k < 10; k++)
        o.creatures.update(0.1, true, false, inactive, o.camera);
      o.creatures.root.updateMatrixWorld(true);
      o.creatures.root.children.forEach((root, index) => {
        const c = o.creatures.cruisers[index],
          body = root.getObjectByName('Body');
        grid.query(
          c.position.x,
          c.position.z,
          c.species.radius * 3 + 3,
          nearby,
        );
        for (let i = 0; i < body.geometry.attributes.position.count; i += 31) {
          body.getVertexPosition(i, point).applyMatrix4(body.matrixWorld);
          samples++;
          lowest = Math.min(lowest, point.y - seabedHeight(point.x, point.z));
          if (
            nearby.some((h) =>
              o.collision.contains(h, point.x, point.y, point.z),
            )
          )
            hits++;
        }
      });
    }
    return { samples, hits, lowest };
  });
  assert.equal(report.clearance.hits, 0);
  assert(report.clearance.lowest > 0);
  console.log('scaled body clearance checked');
  report.fish = await page.evaluate(async () => {
    const { safeFishPosition } = await import('/src/fish/FishHabitat.ts'),
      { seabedHeight } = await import('/src/environment/outer/OuterTerrain.ts'),
      sim = window.__cozy.outer.schools.fish.simulation;
    let unsafe = 0,
      lowest = Infinity;
    for (let second = 0; second < 90; second++) {
      for (let k = 0; k < 30; k++) sim.advance(1 / 30, true);
      for (const f of sim.fish) {
        if (!safeFishPosition(f.position, f.radius, sim.habitat)) unsafe++;
        lowest = Math.min(
          lowest,
          f.position.y - seabedHeight(f.position.x, f.position.z) - f.radius,
        );
      }
    }
    return { unsafe, lowest, steps: sim.steps };
  });
  assert.equal(report.fish.unsafe, 0);
  assert(report.fish.lowest >= -1e-6);
  report.cpu = await page.evaluate(async () => {
    const { FishSimulation } = await import('/src/fish/FishMovement.ts'),
      { spawnFish } = await import('/src/fish/FishSpawner.ts'),
      { outerSpecies } = await import('/src/environment/outer/OuterSchools.ts'),
      { reefObstacles } =
        await import('/src/environment/outer/OuterCreatures.ts'),
      o = window.__cozy.outer,
      habitat = o.schools.fish.simulation.habitat,
      species = outerSpecies(reefObstacles(o.reef.drawnPlacements));
    const make = (old) => {
      const h = old ? { ...habitat, floorHeight: undefined } : habitat;
      return new FishSimulation(
        spawnFish(h, old ? species.slice(0, 6) : species, 24024),
        h,
      );
    };
    const old = make(true),
      current = make(false),
      measure = (sim) => {
        const t = performance.now();
        for (let k = 0; k < 120; k++) sim.advance(1 / 30, true);
        return (performance.now() - t) / 120;
      };
    for (let k = 0; k < 30; k++) {
      old.advance(1 / 30, true);
      current.advance(1 / 30, true);
    }
    const baseline = [],
      enriched = [];
    for (let run = 0; run < 3; run++) {
      baseline.push(measure(old));
      enriched.push(measure(current));
    }
    return {
      baselineFish: old.fish.length,
      currentFish: current.fish.length,
      baselineMsPerStep: baseline,
      enrichedMsPerStep: enriched,
      limit: 'CPU simulation diagnostics on this machine, not hardware FPS',
    };
  });
  const view = async (name, eye, target) => {
    const info = await page.evaluate(
      ([eye, target]) => {
        const a = window.__cozy,
          o = a.outer,
          p = a.state.position;
        Object.assign(p, { x: eye[0], y: eye[1], z: eye[2] });
        a.state.neutralDepth = p.y;
        a.controls.yaw = Math.atan2(-(target[0] - p.x), -(target[2] - p.z));
        a.controls.pitch = Math.atan2(
          target[1] - p.y,
          Math.hypot(target[0] - p.x, target[2] - p.z),
        );
        a.controls.clear();
        o.reveal = 1;
        o.camera.position.set(...eye);
        o.camera.lookAt(...target);
        o.render(a.elapsed, false, 0, false, a.playerPresence);
        return {
          calls: a.world.renderer.info.render.calls,
          triangles: a.world.renderer.info.render.triangles,
          nearAnimals: o.creatures.nearCount,
        };
      },
      [eye, target],
    );
    await page.screenshot({ path: path.join(output, `${name}.png`) });
    report.views.push({ name, ...info });
  };
  await view('entrance', [0, 8, -34], [-7, 5, -43]);
  await view('reef-top', [0, 8, -47], [-12, 4, -53]);
  await view('wall-shoal', [-10, -1, -61], [-16, -3, -65]);
  for (const [name, id, minimum] of [
    ['adult-shark', 'blacktip-reef-shark', 1.2],
    ['ray-flight', 'spotted-eagle-ray', 1],
    ['turtle', 'green-sea-turtle', 1.2],
  ]) {
    const p = await page.evaluate(
      ([id, minimum]) => {
        const c = window.__cozy.outer.creatures.cruisers.find(
          (c) => c.species.id === id && c.species.scale >= minimum,
        );
        return { ...c.position };
      },
      [id, minimum],
    );
    await view(name, [p.x + 3.5, p.y + 1.4, p.z + 6.5], [p.x, p.y, p.z]);
  }
  // Native pause/re-entry freezes and resumes both simulations.
  const snapshot = () =>
    page.evaluate(() => ({
      steps: window.__cozy.outer.schools.fish.simulation.steps,
      animals: window.__cozy.outer.creatures.cruisers.map((c) => ({
        ...c.position,
      })),
    }));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.pointerLockElement);
  const paused = await snapshot();
  await step(3);
  assert.deepEqual(await snapshot(), paused);
  await page.getByRole('button', { name: /the Water/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await step(2);
  assert((await snapshot()).steps > paused.steps);
  report.pauseResume = true;
  const beforeSwim = await page.evaluate(() => ({
    ...window.__cozy.state.position,
  }));
  await page.keyboard.down('w');
  await step(4);
  await page.keyboard.up('w');
  const afterSwim = await page.evaluate(() => ({
    ...window.__cozy.state.position,
  }));
  report.swam = Math.hypot(
    afterSwim.x - beforeSwim.x,
    afterSwim.y - beforeSwim.y,
    afterSwim.z - beforeSwim.z,
  );
  assert(report.swam > 0.01);
  await page.evaluate(() => {
    const a = window.__cozy;
    a.setWaterWorld('aquarium');
    a.outer.dispose();
    a.outer = undefined;
    Object.assign(a.state.position, { x: 0, y: 4.6, z: 9 });
    a.state.neutralDepth = 4.6;
    a.controls.clear();
  });
  await step();
  report.after = await memory();
  assert.deepEqual(report.after, report.before);
  assert.deepEqual(report.errors, []);
  await page.evaluate(() => window.__cozy.dispose());
  console.log(JSON.stringify(report, null, 2));
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
