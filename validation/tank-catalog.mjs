/* Real catalog buttons, lock/input and persistence; staged swimmer poses at valid sites. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy029-catalog';
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
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.setDefaultTimeout(240000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      'cozy-diver.settings.v3',
      JSON.stringify({ reducedMotion: true }),
    );
    if (!localStorage.getItem('catalog-harness-seeded')) {
      localStorage.setItem(
        'cozy-diver.journal.v1',
        JSON.stringify({
          version: 1,
          seen: [
            'coral:boulder',
            'coral:branching',
            'coral:plate',
            'coral:soft',
            'coral:sea-fan',
            'plant:seagrass',
          ].map((id) => ({ id, first: '2026-11-13T00:00:00Z' })),
        }),
      );
      localStorage.setItem('catalog-harness-seeded', 'yes');
    }
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
  const ready = async () => {
    await page.waitForFunction(() => window.__cozy?.tankEditor);
    await page.evaluate(() =>
      Promise.all([
        window.__cozy.world.prepared,
        window.__cozy.office.prepared,
        window.__cozy.tankEditor.ready,
      ]),
    );
  };
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
  const place = async () => {
    for (let attempt = 0; attempt < 120; attempt++) {
      const state = await page.evaluate(() => ({
        valid: window.__cozy.tankEditor.model.valid,
        clear: window.__cozy.tankEditor.canPlace(),
        preview: window.__cozy.tankEditor.model.preview,
      }));
      assert(
        state.valid,
        `Fixture aim must be a valid spot: ${JSON.stringify(state.preview)}`,
      );
      if (state.clear) {
        await page.keyboard.press('f');
        await step();
        return;
      }
      await step();
    }
    assert.fail(
      'Passing fish did not clear the placement within 120 simulation frames',
    );
  };
  const shot = async (name) => {
    await page.screenshot({ path: path.join(output, name + '.png') });
    report.views.push(
      await page.evaluate(
        (name) => ({
          name,
          calls: window.__cozy.world.renderer.info.render.calls,
          triangles: window.__cozy.world.renderer.info.render.triangles,
        }),
        name,
      ),
    );
  };
  const pose = async (p, preview = true) => {
    await page.evaluate(
      ([p, preview]) => {
        const a = window.__cozy;
        Object.assign(a.state.position, {
          x: p.x,
          y: p.y + (preview ? 2 : 0.7),
          z: p.z + 2,
        });
        a.state.neutralDepth = a.state.position.y;
        a.controls.yaw = 0;
        a.controls.pitch = preview ? -Math.PI / 4 : 0;
        a.controls.clear();
      },
      [p, preview],
    );
    await step();
  };
  const enter = async () => {
    await page
      .getByRole('button', { name: /^(Enter|Return to) the Water$/ })
      .click();
    await page.waitForFunction(() => !!document.pointerLockElement);
    await step();
  };
  const pause = async () => {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.pointerLockElement);
    await step();
  };
  const choose = async (label) => {
    await page
      .getByRole('button', { name: 'For your tank', exact: true })
      .click();
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForFunction(() => !!document.pointerLockElement);
  };
  await page.goto(process.env.COZY_URL || 'http://127.0.0.1:5196');
  await ready();
  report.templates = await page.evaluate(() =>
    [...window.__cozy.tankEditor.decoration.templates].map(([kind, t]) => ({
      kind,
      size: t.size.toArray(),
      parts: t.pieces.length,
    })),
  );
  assert.equal(report.templates.length, 6);
  assert(
    report.templates.every((t) =>
      t.size.every((v) => Number.isFinite(v) && v > 0),
    ),
  );
  await enter();
  await pause();
  await page
    .getByRole('button', { name: 'For your tank', exact: true })
    .click();
  assert.equal(await page.locator('.tank-catalog button').count(), 7);
  await shot('catalog');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  const spots = await page.evaluate(async () => {
    const { validPlacement } = await import('/src/catalog/catalog.ts');
    const { safeFishPosition, clearFishRoute } =
      await import('/src/fish/FishHabitat.ts');
    const m = window.__cozy.tankEditor.model,
      list = [];
    const h = window.__cozy.world.aquarium.fish.simulation.habitat;
    const clearView = (p) => {
      if (!safeFishPosition({ x: p.x, y: p.y + 0.7, z: p.z + 2 }, 0.65, h))
        return false;
      if (
        !clearFishRoute(
          { x: p.x, y: p.y + 0.7, z: p.z + 2 },
          { x: p.x, y: p.y + 0.7, z: p.z },
          0.05,
          h,
        )
      )
        return false;
      for (let t = 0.1; t < 0.95; t += 0.1)
        if (
          m.context.surface(p.x, p.z + 2 * (1 - t)) >
          p.y + 2 * (1 - t) - 0.05
        )
          return false;
      return true;
    };
    for (let z = -12; z < 11.3 && list.length < 20; z += 1.2)
      for (let x = -16.2; x <= 16.3 && list.length < 20; x += 1.6) {
        const i = {
          id: `tank-probe-${list.length}`,
          kind: [
            'boulder',
            'seagrass',
            'branching',
            'plate',
            'soft',
            'sea-fan',
          ][list.length % 6],
          position: { x, y: m.context.surface(x, z), z },
          rotation: 0,
        };
        if (
          clearView(i.position) &&
          [
            ...new Set([
              i.kind,
              ...(list.length === 0 || list.length === 2 ? ['boulder'] : []),
            ]),
          ].every((kind) =>
            [0, Math.PI / 6].every((rotation) =>
              [-0.15, 0, 0.15].every((dz) =>
                validPlacement(
                  {
                    ...i,
                    kind,
                    rotation,
                    position: { x, y: m.context.surface(x, z + dz), z: z + dz },
                  },
                  list,
                  m.context,
                ),
              ),
            ),
          ) &&
          safeFishPosition(
            { x, y: i.position.y + 2, z: z + 2 },
            0.65,
            window.__cozy.world.aquarium.fish.simulation.habitat,
          )
        )
          list.push(i);
      }
    return list;
  });
  assert.equal(spots.length, 20);
  await choose('Boulder coral');
  await pose(spots[0].position);
  await shot('preview');
  await page.keyboard.press('r');
  await step();
  assert(
    await page.evaluate(
      () => window.__cozy.tankEditor.model.preview.rotation > 0,
    ),
  );
  await place();
  assert.equal(
    await page.evaluate(() => window.__cozy.tankEditor.model.items.length),
    1,
  );
  await shot('placed-coral');
  // Pick up and cancel: the original item remains persisted.
  let first = await page.evaluate(
    () => window.__cozy.tankEditor.model.items[0],
  );
  await pose(first.position, false);
  await page.keyboard.press('g');
  await step();
  assert(await page.evaluate(() => !!window.__cozy.tankEditor.model.preview));
  await pause();
  assert.equal(
    await page.evaluate(() => window.__cozy.tankEditor.model.items.length),
    1,
  );
  // Move the colony using the same targeting and placement controls, then remove it.
  await enter();
  await pose(first.position, false);
  await page.keyboard.press('g');
  await pose(spots[2].position);
  await place();
  first = await page.evaluate(() => window.__cozy.tankEditor.model.items[0]);
  assert(
    Math.hypot(
      first.position.x - spots[0].position.x,
      first.position.z - spots[0].position.z,
    ) > 0.5,
  );
  await pose(first.position, false);
  await page.keyboard.press('x');
  await step();
  assert.equal(
    await page.evaluate(() => window.__cozy.tankEditor.model.items.length),
    0,
  );
  await pause();
  console.log('native move/remove passed');
  const fixedView = async () => {
    await page.evaluate(() => {
      const a = window.__cozy;
      Object.assign(a.state.position, { x: 0, y: 4.6, z: 9 });
      a.state.neutralDepth = 4.6;
      a.controls.yaw = 0;
      a.controls.pitch = -0.06;
      a.controls.clear();
    });
    await step();
    return page.evaluate(() => ({
      calls: window.__cozy.world.renderer.info.render.calls,
      triangles: window.__cozy.world.renderer.info.render.triangles,
    }));
  };
  report.emptyTankView = await fixedView();
  // Place all 20 via the actual UI and keys. Staging chooses safe aim poses, never bypasses validation.
  for (let i = 0; i < spots.length; i++) {
    await choose(
      [
        'Boulder coral',
        'Seagrass patch',
        'Branching coral',
        'Plate coral',
        'Soft coral',
        'Sea fan',
      ][i % 6],
    );
    await pose(spots[i].position);
    await place();
    const count = await page.evaluate(
      () => window.__cozy.tankEditor.model.items.length,
    );
    assert.equal(
      count,
      i + 1,
      `placement ${i}: ${JSON.stringify(await page.evaluate(() => ({ preview: window.__cozy.tankEditor.model.preview, valid: window.__cozy.tankEditor.model.valid })))}`,
    );
    console.log('placed', i + 1);
    if (i === 1) await shot('coral-and-seagrass');
    await pause();
  }
  await page
    .getByRole('button', { name: 'For your tank', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Boulder coral', exact: true })
    .click();
  assert(
    await page
      .getByText('The tank feels full here', { exact: true })
      .isVisible(),
  );
  await shot('tank-full');
  report.fullTankView = await fixedView();
  await shot('coral-garden');
  report.saved = await page.evaluate(() => ({
    items: window.__cozy.tankEditor.model.items,
    memory: { ...window.__cozy.world.renderer.info.memory },
  }));
  await page.reload();
  await ready();
  assert.equal(
    await page.evaluate(() => window.__cozy.tankEditor.model.items.length),
    20,
  );
  await enter();
  await step();
  report.reloaded = await page.evaluate(
    () => window.__cozy.tankEditor.model.items,
  );
  assert.deepEqual(report.reloaded, report.saved.items);
  await pause();
  await page
    .getByRole('button', { name: 'Enter the Office', exact: true })
    .click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await step(20);
  assert.equal(await page.evaluate(() => window.__cozy.mode), 'office');
  assert(
    await page
      .getByRole('button', { name: 'For your tank', exact: true })
      .isHidden(),
  );
  await shot('office-miniature');
  report.miniature = await page.evaluate(() => ({
    items: window.__cozy.tankEditor.model.items.length,
    drawnByBatch: window.__cozy.tankEditor.decoration.root.children
      .filter((c) => c.isInstancedMesh)
      .map((c) => ({ name: c.name, count: c.visible ? c.count : 0 })),
  }));
  assert(report.miniature.drawnByBatch.some((b) => b.count > 0));
  const memory = () =>
    page.evaluate(() => ({ ...window.__cozy.world.renderer.info.memory }));
  const warm = await memory();
  for (let i = 0; i < 2; i++) {
    await pause();
    await enter();
    await step(20);
    await pause();
    await page
      .getByRole('button', { name: 'Enter the Office', exact: true })
      .click();
    await page.waitForFunction(() => !!document.pointerLockElement);
    await step(20);
  }
  report.memoryBefore = warm;
  report.memoryAfter = await memory();
  assert.deepEqual(report.memoryAfter, warm);
  await pause();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page
    .getByRole('button', { name: 'Restore the original tank', exact: true })
    .click();
  assert.equal(
    await page.evaluate(() => window.__cozy.tankEditor.model.items.length),
    20,
  );
  await page.getByRole('button', { name: 'Keep my tank', exact: true }).click();
  await page
    .getByRole('button', { name: 'Restore the original tank', exact: true })
    .click();
  await page.getByRole('button', { name: 'Restore tank', exact: true }).click();
  assert.equal(
    await page.evaluate(() => window.__cozy.tankEditor.model.items.length),
    0,
  );
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('cozy-diver.journal.v1')).seen.length,
    ),
    6,
  );
  assert.deepEqual(report.errors, []);
  await page.evaluate(() => {
    window.__cozy.dispose();
    window.__cozy.dispose();
  });
  console.log(JSON.stringify(report, null, 2));
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
