/** Pass 106: one local aquarium placement walkthrough and album navigation/resource check.
 * Seeds representative older saves and 21 rare discoveries; observes leaf sheep in the actual tank.
 * Repositions locally for close inspection; no passage or full-game traversal.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy-pass106';
fs.mkdirSync(output, { recursive: true });
const rare = [
  'pikachu-nudibranch',
  'leaf-sheep',
  'candy-crab',
  'harlequin-shrimp',
  'ornate-ghost-pipefish',
  'hairy-frogfish',
  'mimic-octopus',
  'weedy-seadragon',
  'spanish-shawl',
  'sarcastic-fringehead',
  'east-pacific-red-octopus',
  'skeleton-shrimp',
  'juvenile-wolf-eel',
  'decorator-crab',
  'painted-greenling',
  'stargazer',
  'psychedelic-frogfish',
  'banded-coral-shrimp',
  'wonderpus',
  'sea-angel',
  'tritoniella-belli',
  'giant-isopod',
];
const browser = await chromium.launch({
  executablePath: process.env.COZY_CHROMIUM || undefined,
  args: [
    '--no-sandbox',
    ...(process.env.COZY_DEBUG_PORT
      ? [`--remote-debugging-port=${process.env.COZY_DEBUG_PORT}`]
      : []),
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const report = {
  errors: [],
  requests: [],
  acceptance: process.env.COZY_ACCEPTANCE === '1',
  cleanup: process.env.COZY_CLEANUP === '1',
};
const started = Date.now();
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 960 },
  });
  page.setDefaultTimeout(90000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  page.on('request', (r) => {
    if (/minis\.glb/.test(r.url())) report.requests.push(r.url().split('?')[0]);
  });
  await page.addInitScript((rare) => {
    if (localStorage.getItem('pass106-seeded')) return;
    const ids = [
      ...rare.filter((id) => id !== 'leaf-sheep'),
      'blacktip-reef-shark',
      'humpback-whale',
      'green-sea-turtle',
      'bat-ray',
      'royal-gramma',
    ];
    localStorage.setItem(
      'cozy-diver.journal.v1',
      JSON.stringify({
        version: 1,
        seen: ids.map((id) => ({
          id: 'species:' + id,
          first: '2026-11-20T12:00:00.000Z',
        })),
      }),
    );
    localStorage.setItem(
      'cozy-diver.tank.v1',
      JSON.stringify({
        version: 3,
        items: [
          {
            id: 'tank-106',
            kind: 'stone',
            position: { x: 10, y: 0, z: 8 },
            rotation: 0,
          },
        ],
        babies: ['blacktip-reef-shark'],
        fish: { 'royal-gramma': 2 },
      }),
    );
    localStorage.setItem('pass106-seeded', 'yes');
  }, rare);
  await page.route('**/src/main.ts*', async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    body = body.replace(
      /new Application\(([^;]+)\);/,
      'new Application($1, undefined, {startMode: "aquarium"});',
    );
    await route.fulfill({ response, body: body + '\nwindow.__cozy=app;' });
  });
  const ready = async () => {
    await page.waitForFunction(
      () => window.__cozy?.tankEditor && window.__cozy.album,
    );
    console.log('Application owners ready');
    await page.evaluate(async () => {
      const a = window.__cozy;
      await Promise.all([a.world.prepared, a.tankEditor.ready]);
      await a.world.babies?.ready;
    });
  };
  const tank = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('cozy-diver.tank.v1')));
  const journal = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem('cozy-diver.journal.v1')).seen,
    );
  const shot = (name) => page.screenshot({ path: `${output}/${name}.png` });
  page.on('pageerror', (e) => console.error('Browser error:', e.message));
  await page.goto(process.env.COZY_URL || 'http://127.0.0.1:5177');
  await ready();
  console.log('Aquarium and saved residents ready');
  report.loadingMs = Date.now() - started;
  report.startupRareLibraries = [...new Set(report.requests)];
  assert.ok(
    report.startupRareLibraries.every((u) => u.endsWith('/rare-minis.glb')),
  );
  report.originalTank = await tank();
  assert.equal(report.originalTank.items.length, 1);
  await page
    .getByRole('button', { name: /^(Dive In|Return to the Water)$/ })
    .click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  // The actual discovery view and application's normal dwell/save path.
  await page.evaluate(() => {
    const hold = () => {
      const a = window.__cozy;
      if (a.sightings.some((s) => s.id === 'species:leaf-sheep')) {
        clearInterval(window.__holdView);
        return;
      }
      const r = a.world.aquarium.anchoredLife.hidden.rare,
        t = r.positionOf('leafSheep'),
        v = r.homes.leafSheep.view,
        k = 0.8;
      const eye = {
        x: t.x + (v.x - t.x) * k,
        y: t.y + (v.y - t.y) * k,
        z: t.z + (v.z - t.z) * k,
      };
      Object.assign(a.state.position, eye);
      Object.assign(a.state.velocity, { x: 0, y: 0, z: 0 });
      const dx = t.x - eye.x,
        dy = t.y - eye.y,
        dz = t.z - eye.z,
        d = Math.hypot(dx, dy, dz);
      a.controls.yaw = a.controls.targetYaw = Math.atan2(-dx, -dz);
      a.controls.pitch = a.controls.targetPitch = Math.asin(dy / d);
    };
    hold();
    window.__holdView = setInterval(hold, 100);
  });
  await page.waitForFunction(
    () => window.__cozy.sightings.some((s) => s.id === 'species:leaf-sheep'),
    null,
    { timeout: 180000 },
  );
  report.observed = (await journal()).find(
    (s) => s.id === 'species:leaf-sheep',
  );
  assert.ok(report.observed.first);
  await shot('01-observed-leaf-sheep');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.pointerLockElement);
  await page.getByRole('button', { name: 'Field album', exact: true }).click();
  const album = page.getByRole('dialog', { name: 'Field Album' });
  await album.waitFor();
  report.tabs = await album.locator('.album-tab').allTextContents();
  await album.locator('.album-tab', { hasText: 'Aquarium' }).click();
  if (report.acceptance) {
    const initial = await page.evaluate(() => window.__cozy.album.page);
    await page.keyboard.press('PageDown');
    assert.equal(
      await page.evaluate(() => window.__cozy.album.page),
      initial + 1,
    );
    await page.keyboard.press('PageUp');
    assert.equal(await page.evaluate(() => window.__cozy.album.page), initial);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(() => window.__cozy.album.page), initial);
    report.keyboardNavigation = true;
  }
  await album.locator('[data-id="species:leaf-sheep"]').click();
  await page.waitForFunction(() => window.__cozy.album.previews?.loaded === 1);
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.album-detail-model');
    const pixels = canvas
      .getContext('2d')
      .getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) return true;
    return false;
  });
  const frozenFrame = await page.evaluate(
    () => window.__cozy.world.renderer.info.render.frame,
  );
  await page.waitForTimeout(500);
  report.backgroundFrozen = await page.evaluate(
    (frame) => window.__cozy.world.renderer.info.render.frame === frame,
    frozenFrame,
  );
  assert.equal(report.backgroundFrozen, true);
  await shot('02-leaf-sheep-card');
  console.log('Observed animal card ready');
  if (report.acceptance) {
    const pose = () =>
      page.evaluate(() => {
        const p = window.__cozy.album.previews;
        const out = [];
        p.slots[0].preview.object.traverse((o) => {
          if (o.morphTargetInfluences) out.push(...o.morphTargetInfluences);
        });
        return out;
      });
    const before = await pose();
    await page.waitForTimeout(450);
    const after = await pose();
    report.idleAnimation = after.some((w, i) => Math.abs(w - before[i]) > 1e-6);
    assert.equal(report.idleAnimation, true);
    const yaw = await page.evaluate(
      () => window.__cozy.album.previews.slots[0].yaw,
    );
    await album
      .getByRole('button', { name: 'Turn right', exact: true })
      .click();
    report.modelRotation = await page.evaluate(
      (yaw) => window.__cozy.album.previews.slots[0].yaw > yaw,
      yaw,
    );
    assert.equal(report.modelRotation, true);
    await page.keyboard.press('Escape');
    assert.equal(await album.locator('.album-detail').isHidden(), true);
    assert.equal(
      await page.evaluate(() => document.activeElement?.dataset.id),
      'species:leaf-sheep',
    );
    await album.locator('[data-id="species:leaf-sheep"]').click();
    await album.getByRole('button', { name: 'Close the album' }).click();
    await page.getByRole('button', { name: /^Settings/ }).click();
    await page.locator('#reduced-motion').check();
    await page
      .getByRole('button', { name: 'Close settings', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Field album', exact: true })
      .click();
    await page.waitForFunction(
      () => window.__cozy.album.previews?.loaded === 1,
    );
    await page.waitForFunction(() => {
      const p = window.__cozy.album.previews;
      let still = true;
      p.slots[0].preview.object.traverse((o) => {
        if (o.morphTargetInfluences)
          still &&= o.morphTargetInfluences.every((w) => w === 0);
      });
      return still && window.__cozy.settings.reducedMotion;
    });
    report.reducedMotion = true;
    await shot('06-reduced-motion');
    await album.getByRole('button', { name: 'Close the album' }).click();
    await page.getByRole('button', { name: /^Settings/ }).click();
    await page.locator('#reduced-motion').uncheck();
    await page
      .getByRole('button', { name: 'Close settings', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Field album', exact: true })
      .click();
    report.activePreviewRenderers = await page.evaluate(() =>
      window.__cozy.album.previews ? 1 : 0,
    );
    assert.equal(report.activePreviewRenderers, 1);
    console.log('Keyboard, rotation, idle and reduced-motion checks passed');
  }

  await album
    .getByRole('button', { name: 'Add to Aquarium', exact: true })
    .click();
  await page.evaluate(async () => {
    await window.__cozy.world.babies.ready;
  });
  console.log('Leaf sheep added');
  report.afterLeafSheep = await tank();
  assert.ok(report.afterLeafSheep.babies.includes('leaf-sheep'));
  assert.equal(report.afterLeafSheep.fish['royal-gramma'], 2);
  assert.deepEqual(report.afterLeafSheep.items, report.originalTank.items);
  if (report.acceptance) {
    await album.getByRole('button', { name: 'Back to the page' }).click();
    await album.locator('[data-id="species:royal-gramma"]').click();
    await album.getByRole('button', { name: 'Return one to the sea' }).click();
    assert.equal((await tank()).fish['royal-gramma'], 1);
    await album
      .getByRole('button', { name: 'Add one to the aquarium' })
      .click();
    assert.equal((await tank()).fish['royal-gramma'], 2);
    report.ordinaryFishActions = true;
    await album.getByRole('button', { name: 'Back to the page' }).click();
    await album.locator('.album-tab', { hasText: 'Outer Reef' }).click();
    for (
      let i = 0;
      !(await album.locator('[data-id="species:humpback-whale"]').count()) &&
      i < 3;
      i++
    )
      await album.getByRole('button', { name: 'Next page' }).click();
    await album.locator('[data-id="species:humpback-whale"]').click();
    await album
      .getByRole('button', { name: 'Add to Aquarium', exact: true })
      .click();
    await page.evaluate(async () => {
      await window.__cozy.world.babies.ready;
    });
    report.largeMiniature = await page.evaluate(async () => {
      const a = window.__cozy,
        T = await import('/node_modules/three/build/three.module.js'),
        { MINIATURES_BEFORE_096 } = await import('/src/config/babies.ts');
      const b = a.world.babies.animals.find(
          (b) => b.definition.id === 'humpback-whale',
        ),
        d = b.definition,
        old = MINIATURES_BEFORE_096.find((d) => d.id === 'humpback-whale'),
        root = a.world.babies.root.children.find((r) => r.name === d.label),
        size = new T.Box3().setFromObject(root, true).getSize(new T.Vector3());
      return {
        status: a.world.babies.status(d.id),
        displayScale: (d.size ?? d.scale) / (old.size ?? old.scale),
        radius: d.radius / old.radius,
        halfHeight: d.halfHeight / old.halfHeight,
        modelLength: Math.max(size.x, size.y, size.z),
      };
    });
    assert.equal(report.largeMiniature.status, 'placed');
    assert.equal(report.largeMiniature.displayScale, 2);
    assert.equal(report.largeMiniature.radius, 2);
    assert.equal(report.largeMiniature.halfHeight, 2);
    await shot('07-large-miniature');
    await album.getByRole('button', { name: 'Return it to the sea' }).click();
    assert.ok(!(await tank()).babies.includes('humpback-whale'));
    await album.getByRole('button', { name: 'Back to the page' }).click();
    await album.locator('.album-tab', { hasText: 'Aquarium' }).click();
    await album.locator('[data-id="species:leaf-sheep"]').click();
    console.log(
      'Ordinary fish and double-sized large-miniature actions passed',
    );
  }
  await album.getByRole('button', { name: 'Close the album' }).click();
  // The editor still provides decorations; its creature link opens the same selected card.
  await page
    .getByRole('button', { name: 'For your tank', exact: true })
    .click();
  report.editorSections = await page
    .locator('.tank-catalog-group h3')
    .allTextContents();
  await page.getByRole('button', { name: 'Open the field album' }).click();
  assert.match(
    await album.locator('.album-detail-name').innerText(),
    /Leaf sheep/i,
  );
  await album.getByRole('button', { name: 'Close the album' }).click();
  report.editorReturnFocus = await page.evaluate(
    () => document.activeElement?.textContent,
  );
  assert.equal(report.editorReturnFocus, 'For your tank');
  await page.getByRole('button', { name: 'Field album', exact: true }).click();
  assert.match(
    await album.locator('.album-detail-name').innerText(),
    /Leaf sheep/i,
  );
  console.log('Selected card/context/focus preserved');
  // Bounded browsing, including all six rare libraries without eager startup loading.
  await album.getByRole('button', { name: 'Back to the page' }).click();
  report.browse = [];
  for (let round = 0; round < 2; round++)
    for (const name of [
      'Aquarium',
      'Outer Reef',
      'Kelp Forest',
      'Shipwreck',
      'Sea Cave',
      'Antarctic',
    ]) {
      await album.locator('.album-tab', { hasText: name }).click();
      await page.waitForFunction(() => {
        const p = window.__cozy.album.previews;
        return p.loading === 0 && p.queue.length === 0;
      });
      console.log('Browsed', round, name);
      report.browse.push(
        await page.evaluate(() => {
          const a = window.__cozy,
            p = a.album.previews;
          return {
            page: a.album.page,
            loaded: p.loaded,
            visible: p.slots.filter((s) => s.visible).length,
            leases: a.world.authored.loader.leased,
            ...p.rendererInfo,
            previewDraw: { ...p.renderer.info.render },
            activePreviewRenderers: p ? 1 : 0,
          };
        }),
      );
      const mysteries = await album
        .locator('.album-card-mystery')
        .evaluateAll((cards) =>
          cards.map((c) => ({
            id: c.dataset.id,
            canvas: c.querySelector('canvas'),
            text: c.textContent,
          })),
        );
      assert.ok(
        mysteries.every(
          (m) => !m.id && !m.canvas && /Not yet found/.test(m.text),
        ),
      );
    }
  await shot('03-album-antarctic');
  await album.getByRole('button', { name: 'Close the album' }).click();
  report.afterBrowse = await page.evaluate(() => ({
    closed: !window.__cozy.album.previews,
    leases: window.__cozy.world.authored.loader.leased,
  }));
  assert.equal(report.afterBrowse.closed, true);
  if (report.cleanup) {
    report.rapidReopens = [];
    for (let round = 0; round < 3; round++) {
      await page
        .getByRole('button', { name: 'Field album', exact: true })
        .click();
      for (const name of ['Kelp Forest', 'Outer Reef', 'Shipwreck'])
        await album.locator('.album-tab', { hasText: name }).click();
      // Close without waiting for the last page's model queue: late results must release.
      await album.getByRole('button', { name: 'Close the album' }).click();
      await page.waitForFunction(
        (baseline) =>
          !window.__cozy.album.previews &&
          window.__cozy.world.authored.loader.leased === baseline,
        report.afterBrowse.leases,
      );
      report.rapidReopens.push({
        round: round + 1,
        closed: true,
        leases: report.afterBrowse.leases,
      });
    }
  }
  // A returned animal can be re-added; journal and older saved decorations/fish survive reload.
  await page.getByRole('button', { name: 'Field album', exact: true }).click();
  await album.locator('.album-tab', { hasText: 'Aquarium' }).click();
  await album.locator('[data-id="species:leaf-sheep"]').click();
  const journalBefore = await journal();
  await album.getByRole('button', { name: 'Return it to the sea' }).click();
  assert.ok(!(await tank()).babies.includes('leaf-sheep'));
  assert.deepEqual(await journal(), journalBefore);
  await album
    .getByRole('button', { name: 'Add to Aquarium', exact: true })
    .click();
  await page.evaluate(async () => {
    await window.__cozy.world.babies.ready;
  });
  // Place representatives of bottom, shelter, hover and pelagic modes from their actual cards.
  for (const [name, id] of [
    ['Outer Reef', 'ornate-ghost-pipefish'],
    ['Sea Cave', 'banded-coral-shrimp'],
    ['Antarctic', 'sea-angel'],
  ]) {
    await album.getByRole('button', { name: 'Back to the page' }).click();
    await album.locator('.album-tab', { hasText: name }).click();
    for (
      let turn = 0;
      !(await album.locator(`[data-id="species:${id}"]`).count()) && turn < 3;
      turn++
    )
      await album.getByRole('button', { name: 'Next page' }).click();
    await album.locator(`[data-id="species:${id}"]`).click();
    if (id === 'banded-coral-shrimp')
      await page.evaluate(() => {
        const h = window.__cozy.world.babies.habitat;
        window.__floor = h.floor;
        h.floor = () => 100;
      });
    await album
      .getByRole('button', { name: 'Add to Aquarium', exact: true })
      .click();
    await page.evaluate(async () => {
      await window.__cozy.world.babies.ready;
    });
    if (id === 'banded-coral-shrimp') {
      report.failedArrival = await page.evaluate(() =>
        window.__cozy.world.babies.status('banded-coral-shrimp'),
      );
      assert.equal(report.failedArrival, 'failed');
      await page.evaluate(() => {
        window.__cozy.world.babies.habitat.floor = window.__floor;
      });
      await album.getByRole('button', { name: 'Try adding again' }).click();
      await page.evaluate(async () => {
        await window.__cozy.world.babies.ready;
      });
      report.retriedArrival = await page.evaluate(() =>
        window.__cozy.world.babies.status('banded-coral-shrimp'),
      );
      assert.equal(report.retriedArrival, 'placed');
    }
    console.log('Placed', id);
  }
  await shot('04-added-sea-angel');
  report.saved = await tank();
  assert.equal(report.saved.babies.length, 5);
  await album.getByRole('button', { name: 'Close the album' }).click();
  report.placed = await page.evaluate(() => {
    const a = window.__cozy;
    return a.world.babies.rigs.map((r) => ({
      id: r.baby.definition.id,
      status: a.world.babies.status(r.baby.definition.id),
      scale: r.root.scale.x,
      position: { ...r.baby.position },
      mode: r.baby.smallMode,
    }));
  });
  assert.ok(report.placed.every((r) => r.status === 'placed'));
  await page.reload();
  await ready();
  report.reloaded = await tank();
  assert.deepEqual(report.reloaded, report.saved);
  assert.deepEqual(await journal(), journalBefore);
  // A clear local rendering of the reloaded animal; normal owner updates complete its arrival fade.
  // No view or pose modifications are persisted, and the roaming world is not traversed.
  const inspection = await page.evaluate(() => {
    const a = window.__cozy,
      w = a.world,
      b = w.babies,
      leaf = b.animals.find((x) => x.definition.id === 'leaf-sheep');
    cancelAnimationFrame(a.frame);
    const p = leaf.position;
    let angle = 0;
    for (let i = 0; i < 16; i++) {
      const t = (i * Math.PI) / 8,
        eye = {
          x: p.x + Math.sin(t) * 0.9,
          y: p.y + 0.85,
          z: p.z + Math.cos(t) * 0.9,
        };
      if (
        !w.collision.colliders.some((c) =>
          w.collision.contains(c, eye.x, eye.y, eye.z),
        )
      ) {
        angle = t;
        break;
      }
    }
    w.camera.position.set(
      p.x + Math.sin(angle) * 0.9,
      p.y + 0.85,
      p.z + Math.cos(angle) * 0.9,
    );
    w.camera.lookAt(p.x, p.y - leaf.definition.halfHeight + 0.04, p.z);
    for (let i = 0; i < 60; i++)
      b.update(1 / 30, true, false, undefined, w.camera);
    w.render(0, false, 0, false, {
      position: w.camera.position,
      velocity: { x: 0, y: 0, z: 0 },
      active: false,
    });
    return {
      image: w.renderer.domElement.toDataURL('image/png'),
      stats: {
        fish: w.tankFish?.bodies.length,
        position: { ...leaf.position },
        opacity: leaf.opacity,
        render: { ...w.renderer.info.render },
        residents: b.animals.map((x) => ({
          id: x.definition.id,
          status: b.status(x.definition.id),
        })),
      },
    };
  });
  assert.equal(inspection.stats.opacity, 1);
  assert.equal(inspection.stats.fish, 2);
  assert.equal(inspection.stats.residents.length, 5);
  assert.ok(inspection.stats.residents.every((r) => r.status === 'placed'));
  fs.writeFileSync(
    `${output}/05-placed-leaf-sheep.png`,
    Buffer.from(inspection.image.split(',')[1], 'base64'),
  );
  fs.writeFileSync(
    `${output}/inspection.json`,
    JSON.stringify(inspection.stats, null, 2),
  );
  await page.evaluate(() => window.__cozy.dispose());
  report.released = await page.evaluate(() => {
    const a = window.__cozy;
    return {
      leases: a.world.authored.loader.leased,
      reefLeases: a.world.reefLoader.leased,
      ...a.world.renderer.info.memory,
    };
  });
  report.downloads = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((r) => r.name.includes('.glb'))
      .map((r) => ({
        file: new URL(r.name).pathname,
        encodedBytes: r.encodedBodySize,
        transferBytes: r.transferSize,
        durationMs: r.duration,
      })),
  );
  assert.equal(report.released.leases, 0);
  assert.equal(report.released.reefLeases, 0);
  assert.equal(report.released.geometries, 0);
  assert.equal(report.errors.length, 0);
  report.ok = true;
} catch (error) {
  report.failure = String(error);
  throw error;
} finally {
  fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(
  JSON.stringify({ ok: report.ok, released: report.released, output }),
);
