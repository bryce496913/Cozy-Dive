/* Pass 030: native catalog/input, staged cameras, saved residents, miniature and travel ownership.
 * Run alone, after CPU checks. COZY_URL, COZY_OUTPUT, COZY_PLAYWRIGHT, COZY_CHROMIUM, COZY_DPR.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { browserScale, recordBrowserScale } from './browser-scale.mjs';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy030-babies';
fs.mkdirSync(output, { recursive: true });
const items = JSON.parse(
  fs.readFileSync('docs/screenshots/v0.5-pass029/catalog-report.json', 'utf8'),
).saved.items;
const ids = ['blacktip-reef-shark', 'spotted-eagle-ray', 'green-sea-turtle'];
const labels = ['Blacktip pup', 'Baby eagle ray', 'Turtle hatchling'];
const browser = await chromium.launch({
  executablePath: process.env.COZY_CHROMIUM || undefined,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const report = {
  errors: [],
  views: [],
  limits: [
    'SwiftShader only; staged camera/swimmer poses; catalog buttons, pointer lock and travel keys are native.',
    'Fixed-frame hidden-body comparison retains loaded assets; a separate cold check proves no baby downloads before adding.',
  ],
};
try {
  const page = await browser.newPage({
    ...browserScale(),
    viewport: { width: 1000, height: 700 },
  });
  page.setDefaultTimeout(240000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  await page.addInitScript(
    ({ items, travelOnly, ids }) => {
      localStorage.setItem(
        'cozy-diver.settings.v3',
        JSON.stringify({ reducedMotion: true }),
      );
      if (!localStorage.getItem('babies-harness-seeded')) {
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
              'species:blacktip-reef-shark',
              'species:spotted-eagle-ray',
              'species:green-sea-turtle',
            ].map((id) => ({ id, first: '2026-11-13T00:00:00Z' })),
          }),
        );
        localStorage.setItem(
          'cozy-diver.tank.v1',
          JSON.stringify({
            version: travelOnly ? 2 : 1,
            items,
            babies: travelOnly ? ids : [],
          }),
        );
        localStorage.setItem('babies-harness-seeded', 'yes');
      }
    },
    { items, travelOnly: process.env.COZY_TRAVEL_ONLY === '1', ids },
  );
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
    await page.evaluate(async () => {
      const a = window.__cozy;
      await Promise.all([
        a.world.prepared,
        a.office.prepared,
        a.tankEditor.ready,
      ]);
      await a.world.babies?.ready;
      cancelAnimationFrame(a.frame);
    });
  };
  const step = (n = 1) =>
    page.evaluate(async (n) => {
      const a = window.__cozy;
      cancelAnimationFrame(a.frame);
      for (let i = 0; i < n; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        cancelAnimationFrame(a.frame);
        a.__t = (a.__t ?? performance.now()) + 100;
        a.tick(a.__t);
        cancelAnimationFrame(a.frame);
        for (const b of a.world.babies?.animals ?? [])
          if (
            !b.navigation.safe(
              b.position.x,
              b.position.y,
              b.position.z,
              b.halfHeight,
            )
          )
            throw Error('Baby contact: ' + b.definition.id);
        for (const b of a.world.babies?.animals ?? [])
          for (const fish of a.world.aquarium.fish.simulation.fish) {
            const gap =
              Math.hypot(
                b.position.x - fish.position.x,
                b.position.y - fish.position.y,
                b.position.z - fish.position.z,
              ) -
              b.radius -
              fish.radius;
            a.__babyFishGap = Math.min(a.__babyFishGap ?? Infinity, gap);
            if (gap < -0.01)
              throw Error(
                'Fish entered visitor body enclosure: ' + b.definition.id,
              );
          }
      }
      return {
        world: a.waterWorld,
        mode: a.mode,
        outer: !!a.outer,
        ready: !!a.outer?.isReady,
        transition: !!a.dive,
      };
    }, n);
  const paused = () =>
    page.waitForFunction(
      () =>
        !document.pointerLockElement &&
        !document.querySelector('#overlay').hidden,
    );
  const locked = () =>
    page.waitForFunction(
      () =>
        !!document.pointerLockElement &&
        document.querySelector('#overlay').hidden,
    );
  const pause = async () => {
    await page.keyboard.press('Escape');
    await paused();
    await step();
  };
  const enter = async () => {
    await page
      .getByRole('button', { name: /^(Enter|Return to) the Water$/ })
      .click();
    await locked();
    await step(20);
  };
  const office = async () => {
    await page
      .getByRole('button', { name: 'Enter the Office', exact: true })
      .click();
    await locked();
    await step(20);
    assert.equal(await page.evaluate(() => window.__cozy.mode), 'office');
  };
  const choose = async (index, returning = false) => {
    await page
      .getByRole('button', { name: 'For your tank', exact: true })
      .click();
    await page
      .getByRole('region', { name: labels[index], exact: true })
      .getByRole('button', {
        name: returning ? 'Return it to the sea' : 'Add to the tank',
        exact: true,
      })
      .click();
    await locked();
    await page.evaluate(() => window.__cozy.world.babies?.ready);
    await step(15);
  };
  const memory = () =>
    page.evaluate(() => ({
      geometries: window.__cozy.world.renderer.info.memory.geometries,
      textures: window.__cozy.world.renderer.info.memory.textures,
      programs: window.__cozy.world.renderer.info.programs.length,
    }));
  const snapshot = () =>
    page.evaluate(
      () =>
        window.__cozy.world.babies?.animals.map((b) => ({
          id: b.definition.id,
          p: { ...b.position },
          opacity: b.opacity,
          time: b.time,
          resting: b.resting,
        })) ?? [],
    );
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
  const pose = async (p, target) => {
    await page.evaluate(
      ([p, t]) => {
        const a = window.__cozy;
        Object.assign(a.state.position, p);
        a.state.velocity.x = a.state.velocity.y = a.state.velocity.z = 0;
        a.state.neutralDepth = p.y;
        a.controls.yaw = Math.atan2(-(t.x - p.x), -(t.z - p.z));
        a.controls.pitch = Math.atan2(
          t.y - p.y,
          Math.hypot(t.x - p.x, t.z - p.z),
        );
        a.controls.targetPitch = a.controls.pitch;
        a.controls.clear();
      },
      [p, target],
    );
    await step();
  };
  const viewingEye = (target, distance = 2.4) =>
    page.evaluate(
      async ([t, d]) => {
        const { safeFishPosition } = await import('/src/fish/FishHabitat.ts');
        const h = window.__cozy.world.aquarium.fish.simulation.habitat;
        for (const [x, z] of [
          [0, 1],
          [1, 1],
          [-1, 1],
          [1, 0],
          [-1, 0],
          [0, -1],
        ]) {
          const p = { x: t.x + x * d, y: t.y + 0.6, z: t.z + z * d };
          if (safeFishPosition(p, 0.65, h)) return p;
        }
        throw Error('No clear staged viewing position');
      },
      [target, distance],
    );
  const finishTravel = async () => {
    // Reload gives a fresh GPU view set. A far miniature does not upload an off-screen
    // near mesh or its morph texture. Warm both levels before strict cycle equality.
    for (const b of await snapshot()) {
      const eye = await viewingEye(b.p, 1.4);
      await page.evaluate(
        ([p, t]) => {
          const a = window.__cozy,
            w = a.world;
          w.camera.position.set(p.x, p.y, p.z);
          w.camera.lookAt(t.x, t.y, t.z);
          w.render(a.elapsed, true, 0, false, {
            ...a.playerPresence,
            active: false,
          });
        },
        [eye, b.p],
      );
      await shot(b.id);
    }
    report.warmedResidentLevels = 3;
    // Surface, inspect cheap levels in the live miniature, and repeat full office/tank cycles.
    await pause();
    await office();
    await shot('office-miniature');
    report.miniature = await page.evaluate(() => ({
      animals: window.__cozy.world.babies.animals.length,
      near: window.__cozy.world.babies.nearCount,
      decorations: window.__cozy.tankEditor.model.items.length,
    }));
    assert.deepEqual(report.miniature, {
      animals: 3,
      near: 0,
      decorations: 20,
    });
    report.threeBefore = await memory();
    for (let i = 0; i < 2; i++) {
      await pause();
      await enter();
      await pause();
      await office();
    }
    report.threeAfter = await memory();
    assert.deepEqual(report.threeAfter, report.threeBefore);
    await pause();
    await enter();
    const passage = async () => {
      await pose({ x: 6.4, y: 1.6, z: -12.1 }, { x: 1.5, y: 1.6, z: -12.1 });
      let state = await step();
      for (let i = 0; i < 200 && !state.ready; i++) state = await step();
      assert(state.ready, 'outer reef prepared');
      await page.keyboard.down('w');
      for (let i = 0; i < 200 && state.world === 'aquarium'; i++)
        state = await step();
      await page.keyboard.up('w');
      assert.equal(state.world, 'outer');
      await pause();
      await page.getByRole('button', { name: /Return to the tank/ }).click();
      await locked();
      await step(20);
      await pose({ x: -8, y: 6, z: 8 }, { x: 0, y: 5, z: 0 });
      state = await step();
      for (let i = 0; i < 200 && state.outer; i++) state = await step();
      assert.equal(state.outer, false, 'outer released');
      await step(2);
      return memory();
    };
    report.passageFirst = await passage();
    report.passageSecond = await passage();
    assert.deepEqual(report.passageSecond, report.passageFirst);
    assert.equal((await snapshot()).length, 3);
    assert.equal(
      await page.evaluate(() => window.__cozy.tankEditor.model.items.length),
      20,
    );
    // Both reset choices use the actual confirmation UI; sightings survive the confirmed reset.
    await pause();
    await page
      .getByRole('button', { name: 'For your tank', exact: true })
      .click();
    await page
      .getByRole('region', { name: labels[2], exact: true })
      .scrollIntoViewIfNeeded();
    await shot('catalog-animals');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page
      .getByRole('button', { name: 'Restore the original tank', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Keep my tank', exact: true })
      .click();
    assert.equal((await snapshot()).length, 3);
    await page
      .getByRole('button', { name: 'Restore the original tank', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Restore tank', exact: true })
      .click();
    report.reset = await page.evaluate(() => ({
      items: window.__cozy.tankEditor.model.items.length,
      animals: window.__cozy.tankEditor.model.babies.length,
      owner: !!window.__cozy.world.babies,
      seen: JSON.parse(localStorage.getItem('cozy-diver.journal.v1')).seen
        .length,
    }));
    assert.deepEqual(report.reset, {
      items: 0,
      animals: 0,
      owner: false,
      seen: 9,
    });
    assert.deepEqual(report.errors, []);
  };
  await page.goto(process.env.COZY_URL || 'http://127.0.0.1:5200');
  await recordBrowserScale(page);
  await ready();
  if (process.env.COZY_TRAVEL_ONLY === '1') {
    report.travelOnly = true;
    await enter();
    await finishTravel();
  } else {
    report.cold = await page.evaluate(() => ({
      babies: !!window.__cozy.world.babies,
      decorations: window.__cozy.tankEditor.model.items.length,
      creatureDownloads: performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .filter((n) => /\/(reef-shark|eagle-ray|sea-turtle)\.glb/.test(n)),
    }));
    assert.equal(report.cold.babies, false);
    assert.equal(report.cold.decorations, 20);
    assert.deepEqual(report.cold.creatureDownloads, []);
    await enter();
    await pose({ x: 0, y: 4.6, z: 9 }, { x: 0, y: 4.3, z: 0 });
    await shot('cold-twenty-additions');
    // Two no-baby office cycles establish zero-resident ownership at the same warmed view set.
    await pause();
    await office();
    report.zeroBefore = await memory();
    for (let i = 0; i < 2; i++) {
      await pause();
      await enter();
      await pause();
      await office();
    }
    report.zeroAfter = await memory();
    assert.deepEqual(report.zeroAfter, report.zeroBefore);
    await pause();
    await enter();
    await pause();
    for (let i = 0; i < 3; i++) {
      await choose(i);
      assert.equal((await snapshot()).length, i + 1);
      await pause();
    }
    await page
      .getByRole('button', { name: 'For your tank', exact: true })
      .click();
    const text = await page
      .getByRole('complementary', { name: 'For your tank', exact: true })
      .innerText();
    for (const label of labels) assert(text.includes(label));
    assert(!/\b\d+\s*(of|\/)\s*\d+\b/.test(text));
    await page
      .getByRole('region', { name: labels[0], exact: true })
      .scrollIntoViewIfNeeded();
    await shot('catalog-animals');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await enter();
    const before = await snapshot();
    await step(40);
    const after = await snapshot();
    report.minimumFishGap = await page.evaluate(
      () => window.__cozy.__babyFishGap,
    );
    report.movement = after.map((b, i) => ({
      id: b.id,
      distance: Math.hypot(
        b.p.x - before[i].p.x,
        b.p.y - before[i].p.y,
        b.p.z - before[i].p.z,
      ),
    }));
    assert(report.movement.every((b) => b.distance > 0.05));
    for (let i = 0; i < 3; i++) {
      const b = (await snapshot()).find((b) => b.id === ids[i]);
      await pose(await viewingEye(b.p), b.p);
      await shot(ids[i]);
    }
    await pose({ x: 0, y: 4.6, z: 9 }, { x: 0, y: 4.3, z: 0 });
    await shot('three-with-corals');
    const group = await snapshot();
    const center = { x: 0, y: 0, z: 0 };
    for (const b of group) {
      center.x += b.p.x / group.length;
      center.y += b.p.y / group.length;
      center.z += b.p.z / group.length;
    }
    await pose(await viewingEye(center, 3.5), center);
    // Same paused simulation and camera, with only baby visibility changed, isolates draw cost.
    await pause();
    const freeze = await snapshot();
    await step(5);
    assert.deepEqual(await snapshot(), freeze);
    report.fixedFrame = await page.evaluate(() => {
      const a = window.__cozy,
        w = a.world;
      const render = () => {
        w.render(
          a.elapsed,
          a.settings.reducedMotion,
          0,
          false,
          a.playerPresence,
        );
        return {
          calls: w.renderer.info.render.calls,
          triangles: w.renderer.info.render.triangles,
        };
      };
      w.babies.root.visible = false;
      const zero = render();
      w.babies.root.visible = true;
      const three = render();
      return { zero, three, decorations: a.tankEditor.model.items.length };
    });
    assert.equal(report.fixedFrame.decorations, 20);
    assert(report.fixedFrame.three.calls > report.fixedFrame.zero.calls);
    // Remove one through its native row, let the fade finish, then reload the remaining two.
    await choose(1, true);
    assert.equal((await snapshot()).length, 2);
    await pause();
    report.saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('cozy-diver.tank.v1')),
    );
    assert.equal(report.saved.version, 2);
    assert.deepEqual(report.saved.babies, [ids[0], ids[2]]);
    assert.equal(report.saved.items.length, 20);
    await page.reload();
    await ready();
    assert.equal((await snapshot()).length, 2);
    await enter();
    await pause();
    await choose(1);
    assert.equal((await snapshot()).length, 3);
    await finishTravel();
  }
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 1));
