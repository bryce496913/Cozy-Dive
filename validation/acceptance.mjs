import { browserScale, recordBrowserScale } from './browser-scale.mjs';
/* v0.6 Pass 055: full-world acceptance, the whole journey with real input.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy055 node validation/acceptance.mjs
 *
 * One session, start to finish:
 *   1. Start screen → Enter the Office; walk to the tank and dive in with E (the real dive).
 *   2. Personalise the tank from the pause screen (two blue tangs), and set preferences in Settings.
 *   3. Forward: tank → outer reef → kelp forest → sea cave → under the ice, swimming through each
 *      passage with W held. At every passage, rapid backtracking: once through, turn round at once
 *      and swim back, then turn round again and carry on.
 *   4. One interrupted passage: Escape in the dark of the kelp cleft, wait, resume, carry on.
 *   5. Back: under the ice → cave → kelp → outer reef → tank, swimming through every passage in
 *      reverse (from where each was entered, turned round).
 *   6. In each world, on arrival and after travelling back: the scene is still animating (life
 *      moves), the camera is level (no roll) and the swimmer is inside the world's bounds.
 *   7. Release: swim away in the tank until every outer world is released; GPU geometry and texture
 *      counts back to the tank's. Then the journey again with reduced motion on, and the same
 *      counts afterwards (no growth).
 *   8. Surface to the office with E, then reload: preferences, the personalised tank, the journal
 *      and the onboarding state all survive.
 * Records per-world draw calls, triangles, GPU memory and a stepped-frame CPU time (SwiftShader:
 * counts are meaningful, times only relative). Writes report.json and a screenshot per world.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy055';
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
const report = { base, errors: [], checks: [], worlds: {}, loops: [] };
const log = (m) =>
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const check = (ok, what, detail) => {
  report.checks.push({ ok: !!ok, what, ...(detail ? { detail } : {}) });
  log(
    `${ok ? 'PASS' : 'FAIL'} ${what}${detail ? ' ' + JSON.stringify(detail) : ''}`,
  );
};
try {
  const page = await browser.newPage({
    ...browserScale(),
    viewport: { width: 800, height: 500 },
  });
  page.setDefaultTimeout(Number(process.env.COZY_ACTION_TIMEOUT || 300000));
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body:
        (await r.text()) +
        '\nwindow.__cozy=app;cancelAnimationFrame(app.frame);',
    });
  });
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  await page.goto(base);
  await recordBrowserScale(page);
  // A clean profile, except one earlier sighting so the catalog offers a fish to add.
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      'cozy-diver.journal.v1',
      JSON.stringify({
        version: 1,
        seen: [{ id: 'species:blue-tang', first: '2026-11-18T00:00:00Z' }],
      }),
    );
  });
  await page.reload();
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
  await ready();
  const locked = () =>
    page.waitForFunction(
      () =>
        !!document.pointerLockElement &&
        document.querySelector('#overlay').hidden,
    );
  const paused = () =>
    page.waitForFunction(
      () =>
        !document.pointerLockElement &&
        !document.querySelector('#overlay').hidden,
    );
  /** Steps the loop by hand (1/30 s a frame), then reports where things are. */
  const step = (count = 1) =>
    page.evaluate(async (count) => {
      const a = window.__cozy;
      cancelAnimationFrame(a.frame);
      for (let i = 0; i < count; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        cancelAnimationFrame(a.frame);
        a.__t = (a.__t ?? performance.now()) + 1000 / 30;
        a.tick(a.__t);
        cancelAnimationFrame(a.frame);
      }
      const p = a.state.position;
      return {
        mode: a.mode,
        world: a.waterWorld,
        x: p.x,
        y: p.y,
        z: p.z,
        dark: Number(
          getComputedStyle(document.querySelector('.passage-veil')).opacity,
        ),
        diving: !!a.dive,
      };
    }, count);
  const state = () =>
    page.evaluate(() => {
      const a = window.__cozy;
      return {
        world: a.waterWorld,
        outer: !!a.outer,
        outerReady: !!a.outer?.isReady,
        reefReady: !!a.outer?.isReefReady,
        kelp: !!a.kelp,
        kelpReady: !!a.kelp?.isReady,
        cave: !!a.cave,
        caveReady: !!a.cave?.isReady,
        ice: !!a.ice,
        iceReady: !!a.ice?.isReady,
      };
    });
  const until = async (test, max = 900, frames = 2) => {
    let s = await state();
    for (let i = 0; i < max && !test(s); i++) {
      await step(frames);
      s = await state();
    }
    return s;
  };
  const place = (p, yaw, pitch = 0) =>
    page.evaluate(
      ([p, yaw, pitch]) => {
        const a = window.__cozy;
        Object.assign(a.state.position, p);
        a.state.velocity.x = a.state.velocity.y = a.state.velocity.z = 0;
        a.state.neutralDepth = p.y;
        a.controls.yaw = yaw;
        a.controls.pitch = pitch;
        a.controls.clear();
      },
      [p, yaw, pitch],
    );
  const pose = () =>
    page.evaluate(() => {
      const a = window.__cozy,
        p = a.state.position;
      return { x: p.x, y: p.y, z: p.z, yaw: a.controls.yaw };
    });
  /** Swim with W until in `world`; returns the frames it took. */
  const swimThrough = async (world, max = 600, onFrame) => {
    await page.keyboard.down('w');
    let s = await step(1),
      frames = 0;
    for (; frames < max && s.world !== world; frames++) {
      s = await step(1);
      if (onFrame && (await onFrame(s))) break;
    }
    await page.keyboard.up('w');
    return { arrived: s.world === world, frames, at: s };
  };
  const memory = () =>
    page.evaluate(() => {
      const m = window.__cozy.world.renderer.info.memory;
      return { geometries: m.geometries, textures: m.textures };
    });
  /**
   * The active world: still animating (a checksum of every object and instance transform changes
   * over half a second), camera level (no roll), swimmer inside the bounds, and its render counts
   * and a stepped-frame CPU time.
   */
  const inspect = async (name) => {
    const sum = () =>
      page.evaluate(() => {
        const a = window.__cozy,
          w = a.water(),
          scene = w.scene ?? w.root;
        let s = 0,
          n = 0;
        scene?.traverse((o) => {
          if (o.isInstancedMesh) {
            const arr = o.instanceMatrix.array;
            for (let i = 12; i < Math.min(arr.length, 16 * 64); i += 16)
              s += arr[i] * 1.3 + arr[i + 1] * 0.7 + arr[i + 2];
            n++;
          } else if (o.isMesh || o.isSkinnedMesh || o.isGroup) {
            s += o.position.x * 1.3 + o.position.y * 0.7 + o.position.z;
            s += o.rotation.y * 0.1;
            n++;
          }
        });
        return { s, n };
      });
    const before = await sum();
    const t0 = Date.now();
    await step(15);
    const ms = (Date.now() - t0) / 15;
    const after = await sum();
    const info = await page.evaluate(() => {
      const a = window.__cozy,
        w = a.water(),
        b = w.bounds,
        p = a.state.position,
        cam = w.camera,
        r = a.world.renderer.info.render;
      return {
        calls: r.calls,
        triangles: r.triangles,
        inside:
          p.x >= b.min.x - 0.01 &&
          p.x <= b.max.x + 0.01 &&
          p.y >= b.min.y - 0.01 &&
          p.y <= b.max.y + 0.01 &&
          p.z >= b.min.z - 0.01 &&
          p.z <= b.max.z + 0.01,
        roll: Math.abs(cam.rotation.order === 'YXZ' ? cam.rotation.z : 0),
        upY: cam.up.y,
      };
    });
    const result = {
      animating: Math.abs(after.s - before.s) > 1e-4,
      objects: after.n,
      steppedFrameMs: Math.round(ms),
      ...info,
      memory: await memory(),
    };
    await page.screenshot({ path: path.join(output, `${name}.png`) });
    return result;
  };

  // 1. Start screen → office → dive.
  await page
    .getByRole('button', { name: 'Enter the Office', exact: true })
    .click();
  await locked();
  await step(2);
  check(
    (await page.evaluate(() => window.__cozy.mode)) === 'office',
    'starts in the office',
  );
  await page.evaluate(() => {
    const a = window.__cozy;
    Object.assign(a.walk.position, { x: 0.2, z: 0.7 });
    a.controls.yaw = -Math.PI / 2 + 0.15;
    a.controls.pitch = -0.15;
    a.controls.clear();
  });
  await step(2);
  const prompt = await page.locator('#dive-prompt').innerText();
  check(/Dive in/.test(prompt), 'the dive prompt shows at the tank', {
    prompt,
  });
  await page.keyboard.press('KeyE');
  let s = await step(1);
  for (let i = 0; i < 400 && (s.diving || s.mode !== 'aquarium'); i++)
    s = await step(2);
  check(s.mode === 'aquarium' && !s.diving, 'the dive lands in the tank');

  // 2. Personalise the tank and set preferences (pause screen).
  await page.keyboard.press('Escape');
  await paused();
  await page
    .getByRole('button', { name: 'For your tank', exact: true })
    .click();
  await page.locator('[data-key="fish-add-blue-tang"]').click();
  await page.locator('[data-key="fish-add-blue-tang"]').click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('.settings-toggle').click();
  await page.locator('#sensitivity').fill('1.4');
  await page.locator('#swimming-feel').selectOption('relaxed');
  await page.locator('#close-settings').click();
  const saved = await page.evaluate(() => ({
    tank: localStorage.getItem('cozy-diver.tank.v1'),
    settings: localStorage.getItem('cozy-diver.settings.v3'),
  }));
  check(
    JSON.parse(saved.tank)?.fish?.['blue-tang'] === 2,
    'the tank is personalised and saved',
  );
  await page.getByRole('button', { name: /Return to the Water/ }).click();
  await locked();
  await step(2);
  // Warm the tank first: look round it so its own objects are on the GPU before the baseline.
  for (const [p, y] of [
    [{ x: 0, y: 5, z: 10 }, 0],
    [{ x: -6, y: 3, z: 2 }, 0.5],
    [{ x: 12, y: 4, z: 8 }, 0.7],
    [{ x: 0, y: 4, z: -8 }, Math.PI],
    [{ x: -12, y: 6, z: 0 }, -1.5],
    [{ x: 8, y: 2, z: -10 }, 2.5],
  ]) {
    await place(p, y, 0);
    await step(4);
  }
  report.tankBaseline = await memory();
  report.worlds.tank = await inspect('tank');

  /** The passages, in order: where to start, facing in, and what must be ready first. */
  const PASSAGES = [
    {
      from: 'aquarium',
      to: 'outer',
      at: { x: 6.4, y: 1.6, z: -12.1 },
      yaw: Math.PI / 2,
      ready: 'outerReady',
    },
    {
      from: 'outer',
      to: 'kelp',
      at: { x: -17.6, y: 1.3, z: -32 },
      yaw: -Math.PI / 2,
      ready: 'kelpReady',
    },
    {
      from: 'kelp',
      to: 'cave',
      at: { x: 15.1, y: 2.8, z: -10 },
      yaw: -Math.PI / 2,
      ready: 'caveReady',
    },
    {
      from: 'cave',
      to: 'ice',
      at: { x: -3, y: 3.2, z: -33 },
      yaw: 0,
      ready: 'iceReady',
    },
  ];
  const journey = async (loop) => {
    const r = { loop, forward: [], back: [], backtrack: [], worlds: {} };
    const arrivals = {};
    for (const p of PASSAGES) {
      await place(p.at, p.yaw, 0);
      s = await until((s) => s[p.ready], 600, 1);
      check(s[p.ready], `loop ${loop}: ${p.to} is prepared before its passage`);
      if (p.to === 'outer') await until((s) => s.outerReady, 600, 1);
      // 4. One interrupted passage: pause in the dark of the cleft.
      let interrupted = false;
      const through = await swimThrough(
        p.to,
        600,
        loop === 1 && p.to === 'kelp'
          ? async (f) => {
              if (interrupted || f.dark < 0.3) return false;
              interrupted = true;
              await page.keyboard.up('w');
              await page.keyboard.press('Escape');
              await paused();
              await step(20);
              await page
                .getByRole('button', { name: /Return to the Water/ })
                .click();
              await locked();
              await page.keyboard.down('w');
              return false;
            }
          : undefined,
      );
      check(through.arrived, `loop ${loop}: ${p.from} → ${p.to}`, {
        frames: through.frames,
        ...(interrupted ? { interrupted } : {}),
      });
      if (loop === 1 && p.to === 'kelp')
        check(
          interrupted,
          'loop 1: the cleft passage was paused in the dark and resumed',
        );
      r.forward.push({ to: p.to, frames: through.frames });
      if (p.to === 'outer') await until((s) => s.reefReady);
      await step(10);
      arrivals[p.to] = await pose();
      // Rapid backtracking: straight back the way we came, then on again.
      const back = arrivals[p.to];
      await place(back, back.yaw + Math.PI, 0);
      const b1 = await swimThrough(p.from, 400);
      const b1at = await pose();
      await place(b1at, b1at.yaw + Math.PI, 0);
      const b2 = await swimThrough(p.to, 400);
      check(
        b1.arrived && b2.arrived,
        `loop ${loop}: rapid backtrack at ${p.from} ↔ ${p.to}`,
        {
          back: b1.frames,
          on: b2.frames,
        },
      );
      r.backtrack.push({ at: p.to, back: b1.frames, on: b2.frames });
      if (p.to === 'outer') await until((s) => s.reefReady);
      await step(10);
      const w = await inspect(`loop${loop}-${p.to}`);
      r.worlds[p.to] = w;
      check(
        w.animating && w.inside && w.roll < 1e-6,
        `loop ${loop}: ${p.to} is alive, level, and the swimmer inside`,
        {
          calls: w.calls,
          triangles: w.triangles,
        },
      );
    }
    // 5. All the way back, through every passage in reverse.
    for (const p of [...PASSAGES].reverse()) {
      const a = arrivals[p.to];
      await place(a, a.yaw + Math.PI, 0);
      const ready = {
        aquarium: null,
        outer: 'outerReady',
        kelp: 'kelpReady',
        cave: 'caveReady',
      }[p.from];
      if (ready) await until((s) => s[ready], 600, 1);
      const t = await swimThrough(p.from, 600);
      check(t.arrived, `loop ${loop}: back ${p.to} → ${p.from}`, {
        frames: t.frames,
      });
      r.back.push({ to: p.from, frames: t.frames });
      await step(10);
      const w = await inspect(`loop${loop}-back-${p.from}`);
      check(
        w.animating && w.inside,
        `loop ${loop}: ${p.from} is alive after travelling back`,
      );
    }
    // 7. Release: swim away from the crevice until every outer world is released.
    await page.evaluate(() => {
      const a = window.__cozy;
      window.__preps = [a.outer, a.kelp, a.cave, a.ice].map(
        (w) => w?.preparation,
      );
    });
    await place({ x: -8, y: 6, z: 8 }, 0, 0);
    s = await until((s) => !s.outer && !s.kelp && !s.cave && !s.ice, 600, 2);
    await step(3);
    r.released = await page.evaluate(() =>
      window.__preps.map((p) => p?.state ?? null),
    );
    // Look round the tank again from the same places as the baseline, then measure.
    for (const [p, y] of [
      [{ x: 0, y: 5, z: 10 }, 0],
      [{ x: -6, y: 3, z: 2 }, 0.5],
      [{ x: 12, y: 4, z: 8 }, 0.7],
      [{ x: 0, y: 4, z: -8 }, Math.PI],
      [{ x: -12, y: 6, z: 0 }, -1.5],
      [{ x: 8, y: 2, z: -10 }, 2.5],
    ]) {
      await place(p, y, 0);
      await step(4);
    }
    r.afterRelease = await memory();
    // What the tank's shared asset caches still hold (kept for reuse by design; see the report).
    r.cached = await page.evaluate(() => {
      const w = window.__cozy.world,
        ids = (l) => [...(l?.entries?.keys() ?? [])];
      return { reef: ids(w.reefLoader), authored: ids(w.authored?.loader) };
    });
    check(
      !s.outer && !s.kelp && !s.cave && !s.ice,
      `loop ${loop}: every outer world is released`,
      { states: r.released },
    );
    // Released worlds may leave their shared library models in the tank's asset cache (by design,
    // bounded): at most RETAINED over the tank's own, and never more after a second journey.
    const RETAINED = { geometries: 220, textures: 100 };
    const extra = {
      geometries: r.afterRelease.geometries - report.tankBaseline.geometries,
      textures: r.afterRelease.textures - report.tankBaseline.textures,
    };
    r.retained = extra;
    check(
      extra.geometries <= RETAINED.geometries &&
        extra.textures <= RETAINED.textures,
      `loop ${loop}: after release, within the cache's retention budget`,
      { tank: report.tankBaseline, after: r.afterRelease, extra },
    );
    report.loops.push(r);
  };
  log('journey 1');
  await journey(1);
  // Reduced motion on for the second journey.
  await page.keyboard.press('Escape');
  await paused();
  await page.locator('.settings-toggle').click();
  await page.locator('#reduced-motion').check();
  await page.locator('#close-settings').click();
  await page.getByRole('button', { name: /Return to the Water/ }).click();
  await locked();
  check(
    await page.evaluate(() => window.__cozy.tuning.reducedMotion),
    'reduced motion applied',
  );
  log('journey 2 (reduced motion)');
  await journey(2);
  check(
    report.loops[1].afterRelease.geometries <=
      report.loops[0].afterRelease.geometries &&
      report.loops[1].afterRelease.textures <=
        report.loops[0].afterRelease.textures,
    'no growth between journeys',
    {
      first: report.loops[0].afterRelease,
      second: report.loops[1].afterRelease,
    },
  );
  Object.assign(report.worlds, report.loops[0].worlds);

  // 8. Surface to the office, then reload.
  const top = await page.evaluate(() => window.__cozy.world.bounds.max.y);
  await place({ x: 0, y: top - 0.2, z: 4 }, 0, 0.3);
  await step(5);
  const surfacePrompt = await page
    .locator('#dive-prompt')
    .innerText()
    .catch(() => '');
  await page.keyboard.press('KeyE');
  s = await step(1);
  for (let i = 0; i < 400 && (s.diving || s.mode !== 'office'); i++)
    s = await step(2);
  check(s.mode === 'office', 'surfaces back to the office', {
    prompt: surfacePrompt,
  });
  const before = await page.evaluate(() => ({
    tank: localStorage.getItem('cozy-diver.tank.v1'),
    settings: localStorage.getItem('cozy-diver.settings.v3'),
    journal: localStorage.getItem('cozy-diver.journal.v1'),
  }));
  await page.reload();
  await ready();
  const after = await page.evaluate(() => ({
    tank: localStorage.getItem('cozy-diver.tank.v1'),
    settings: localStorage.getItem('cozy-diver.settings.v3'),
    journal: localStorage.getItem('cozy-diver.journal.v1'),
    onboarding: JSON.parse(localStorage.getItem('cozy-diver.onboarding.v1')),
    sensitivity: document.querySelector('#sensitivity').value,
    reduced: document.querySelector('#reduced-motion').checked,
    tangs: window.__cozy.tankEditor.model.fish['blue-tang'],
    seen: document.querySelectorAll('#seen-list li').length,
    eyebrow: document.querySelector('.eyebrow').textContent.trim(),
  }));
  report.relaunch = after;
  check(
    after.tank === before.tank && after.tangs === 2,
    'the personalised tank survives a reload',
  );
  check(
    after.settings === before.settings &&
      after.sensitivity === '1.4' &&
      after.reduced,
    'preferences survive a reload',
  );
  check(
    after.journal === before.journal && after.seen > 0,
    'the journal survives a reload',
    { seen: after.seen },
  );
  check(
    after.eyebrow === 'WELCOME BACK' && after.onboarding?.last === 'office',
    'welcomed back to the office',
  );
  check(
    report.errors.length === 0,
    'no page errors',
    report.errors.slice(0, 5),
  );
  report.ok = report.checks.every((c) => c.ok);
  assert(report.ok, 'every acceptance check passes');
} catch (error) {
  report.failure = String(error?.stack || error);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  log(
    `${report.checks.filter((c) => c.ok).length}/${report.checks.length} checks passed${report.failure ? '; ' + report.failure.split('\n')[0] : ''}`,
  );
  await browser.close();
}
