const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
import assert from 'node:assert/strict';
import fs from 'node:fs';
(async () => {
  const browser = await chromium.launch({
    ...(process.env.COZY_CHROMIUM
      ? { executablePath: process.env.COZY_CHROMIUM }
      : {}),
    headless: process.env.COZY_HEADFUL !== '1',
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      ...(process.env.COZY_HARDWARE
        ? []
        : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']),
      '--autoplay-policy=user-gesture-required',
    ],
  });
  // Pass 014: SwiftShader compiles the heavier reef's shader variants lazily on first
  // present (tens of seconds in software). Raise Playwright *action* timeouts only;
  // no assertion or measured budget changes. Override with COZY_ACTION_TIMEOUT.
  const openPage = browser.newPage.bind(browser);
  browser.newPage = async (options) => {
    const page = await openPage(options);
    page.setDefaultTimeout(Number(process.env.COZY_ACTION_TIMEOUT || 240000));
    return page;
  };
  try {
    const page = await browser.newPage({
        viewport: { width: 1100, height: 800 },
      }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.addInitScript(() => {
      const Native = window.AudioContext;
      window.__contexts = [];
      if (Native)
        window.AudioContext = class extends Native {
          constructor(...args) {
            super(...args);
            window.__contexts.push(this);
          }
        };
      if (!localStorage.getItem('cozy-diver.settings.v1'))
        localStorage.setItem(
          'cozy-diver.settings.v1',
          JSON.stringify({
            swimmingFeel: 'relaxed',
            speed: 1.8,
            sensitivity: 1.4,
            reducedMotion: true,
          }),
        );
    });
    await page.route('**/src/main.ts*', async (route) => {
      const r = await route.fetch();
      await route.fulfill({
        response: r,
        body: (await r.text()) + '\nwindow.__cozy=app;',
      });
    });
    await page.goto(process.env.COZY_URL || 'http://127.0.0.1:5173');
    await page.waitForFunction(
      () => window.__cozy?.world?.renderer.info.render.calls > 0,
    );
    assert.equal(
      await page.evaluate(() => window.__cozy.world.authored.ready),
      true,
    );
    assert.equal(await page.evaluate(() => window.__contexts.length), 0);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    assert.equal(await page.locator('#master-volume').inputValue(), '30');
    assert.equal(await page.locator('#audio-enabled').isChecked(), true);
    // Pass 019: the seeded v1 save migrates onto the 60% scale (1.8 -> 1.08 m/s).
    assert.equal(await page.locator('#speed').inputValue(), '1.08');
    assert.equal(await page.locator('#swimming-feel').inputValue(), 'relaxed');
    await page.screenshot({ path: '/tmp/cozy-audio-settings.png' });
    await page.getByRole('button', { name: 'Close settings' }).click();
    await page.getByRole('button', { name: 'Enter the Water' }).click();
    await page
      .waitForFunction(
        () =>
          !!document.pointerLockElement &&
          document.querySelector('#overlay').hidden &&
          window.__cozy.audio?.context?.state === 'running',
      )
      .catch(async (error) => {
        console.error(
          'COZY_ENTRY_DIAGNOSTIC',
          await page.evaluate(() => ({
            locked: !!document.pointerLockElement,
            overlayHidden: document.querySelector('#overlay')?.hidden,
            audioState: window.__cozy?.audio?.context?.state,
            contexts: window.__contexts?.length,
            status: document.querySelector('#status')?.textContent,
            audioStatus: document.querySelector('#audio-status')?.textContent,
          })),
        );
        throw error;
      });
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.__contexts.length), 1);
    await page.keyboard.press('Control+m');
    assert.equal(
      await page.evaluate(() => window.__cozy.settings.audioEnabled),
      true,
    );
    await page.evaluate(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'KeyM', metaKey: true }),
      ),
    );
    assert.equal(
      await page.evaluate(() => window.__cozy.settings.audioEnabled),
      true,
    );
    const start = await page.evaluate(() => ({
      ...window.__cozy.state.position,
    }));
    await page.keyboard.down('w');
    await page.waitForFunction(
      (z) => window.__cozy.state.position.z < z - 0.4,
      start.z,
      { timeout: 60000 },
    );
    await page.keyboard.up('w');
    // Camera-relative depth controls and removed legacy depth keys, using real input.
    await page.evaluate(() =>
      document.dispatchEvent(new MouseEvent('mousemove', { movementY: -550 })),
    );
    const baseY = await page.evaluate(() => window.__cozy.state.position.y);
    await page.keyboard.down('w');
    await page.waitForFunction(
      (y) => window.__cozy.state.position.y > y + 0.2,
      baseY,
      { timeout: 60000 },
    );
    await page.keyboard.up('w');
    const upperY = await page.evaluate(() => window.__cozy.state.position.y);
    await page.evaluate(() =>
      document.dispatchEvent(new MouseEvent('mousemove', { movementY: 1100 })),
    );
    await page.keyboard.down('w');
    await page.waitForFunction(
      (y) => window.__cozy.state.position.y < y - 0.2,
      upperY,
      { timeout: 60000 },
    );
    await page.keyboard.up('w');
    const swim = await page.evaluate(() => ({
      gain: window.__cozy.audio.graph.swim.gain.gain.value,
      speed: Math.hypot(...Object.values(window.__cozy.state.velocity)),
    }));
    assert(swim.gain > 0);
    await page.keyboard.press('m');
    await page.waitForFunction(
      () => window.__cozy.audio.context.state === 'suspended',
    );
    assert.equal(
      await page.evaluate(() => window.__cozy.settings.audioEnabled),
      false,
    );
    await page.keyboard.press('m');
    await page.waitForFunction(
      () => window.__cozy.audio.context.state === 'running',
    );
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.pointerLockElement);
    await page.getByRole('button', { name: 'Return to the Water' }).click();
    await page.waitForFunction(
      () =>
        !!document.pointerLockElement &&
        document.querySelector('#overlay').hidden,
    );
    const restingY = await page.evaluate(() => window.__cozy.state.position.y);
    await page.keyboard.down('Space');
    await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(500);
    await page.keyboard.up('Space');
    await page.keyboard.up('ShiftLeft');
    assert(
      Math.abs(
        (await page.evaluate(() => window.__cozy.state.position.y)) - restingY,
      ) < 1e-5,
    );
    await page.keyboard.down('w');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(() => !document.pointerLockElement);
    await page.keyboard.up('w');
    assert.deepEqual(
      await page.evaluate(() => ({ ...window.__cozy.controls.input })),
      { forward: 0, right: 0 },
    );
    await page.getByRole('button', { name: 'Return to the Water' }).click();
    await page.waitForFunction(
      () =>
        !!document.pointerLockElement &&
        document.querySelector('#overlay').hidden &&
        window.__cozy.audio.context.state === 'running',
    );
    // Reach a scheduled event using bounded active updates; no application/physics clocks are modified.
    const event = await page.evaluate(() => {
      const a = window.__cozy;
      for (let i = 0; i < 500; i++)
        a.audio.update(0.1, a.state, a.tuning, a.controls.yaw);
      return {
        voices: a.audio.graph.voices,
        time: a.audio.time,
        nodes: a.audio.graph.nodes.length,
        loops: a.audio.graph.loops.length,
      };
    });
    assert.equal(event.voices, 1);
    await page.waitForFunction(
      () => window.__cozy.audio.graph.voices === 0,
      {},
      { timeout: 10000 },
    );
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () =>
        !document.pointerLockElement &&
        window.__cozy.audio.context.state === 'suspended',
    );
    const paused = await page.evaluate(() => ({
      time: window.__cozy.audio.time,
      remaining: window.__cozy.audio.events.remaining,
    }));
    await page.waitForTimeout(500);
    assert.deepEqual(
      await page.evaluate(() => ({
        time: window.__cozy.audio.time,
        remaining: window.__cozy.audio.events.remaining,
      })),
      paused,
    );
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.locator('#master-volume').fill('47');
    await page.locator('#master-volume').dispatchEvent('input');
    await page.locator('#audio-enabled').uncheck();
    await page.getByRole('button', { name: 'Close settings' }).click();
    await page.reload();
    await page.waitForFunction(() => window.__cozy?.world);
    assert.equal(
      await page.evaluate(() => window.__cozy.world.authored.ready),
      true,
    );
    assert.equal(await page.evaluate(() => window.__contexts.length), 0);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    assert.equal(await page.locator('#master-volume').inputValue(), '47');
    assert.equal(await page.locator('#audio-enabled').isChecked(), false);
    await page.locator('#audio-enabled').check();
    assert.equal(await page.evaluate(() => window.__contexts.length), 0); // Preview still silent.
    await page.getByRole('button', { name: 'Close settings' }).click();
    for (let i = 0; i < 4; i++) {
      await page
        .getByRole('button', {
          name: i ? 'Return to the Water' : 'Enter the Water',
        })
        .click();
      await page.waitForFunction(
        () =>
          !!document.pointerLockElement &&
          document.querySelector('#overlay').hidden &&
          window.__cozy.audio.context.state === 'running',
      );
      await page.keyboard.press('Escape');
      await page.waitForFunction(
        () =>
          !document.pointerLockElement &&
          window.__cozy.audio.context.state === 'suspended',
      );
    }
    assert.equal(await page.evaluate(() => window.__contexts.length), 1);
    await page.getByRole('button', { name: 'Return to the Water' }).click();
    await page.waitForFunction(
      () =>
        !!document.pointerLockElement &&
        document.querySelector('#overlay').hidden,
    );
    // Exercise the browser visibility handler with controlled hidden state (headless tabs do not reliably hide).
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(
      () => window.__cozy.audio.context.state === 'suspended',
    );
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => !document.pointerLockElement);
    // Accelerate thirty minutes of active ecosystem time, keeping native Web Audio ownership.
    await page.getByRole('button', { name: 'Return to the Water' }).click();
    await page.waitForFunction(
      () =>
        !!document.pointerLockElement &&
        document.querySelector('#overlay').hidden &&
        window.__cozy.audio.context.state === 'running',
    );
    await page.evaluate(() => {
      cancelAnimationFrame(window.__cozy.frame);
      window.__stressTime = 0;
      window.__voiceEnds = new WeakMap();
    });
    const cdp = await page.context().newCDPSession(page),
      longSession = [];
    for (let minute = 0; minute <= 30; minute++) {
      if (minute) {
        await page.evaluate(async () => {
          const { integrateSwimming } = await import('/src/player/swimming.ts'),
            { safeFishPosition } = await import('/src/fish/FishHabitat.ts'),
            { AQUARIUM } = await import('/src/config/world.ts');
          const a = window.__cozy,
            q = a.world.aquarium,
            direction = { x: 0, y: 0, z: 0 };
          for (let i = 0; i < 1800; i++) {
            const t = window.__stressTime;
            const moving = t % 60 >= 30;
            direction.x = moving ? Math.sin(t * 0.11) : 0;
            direction.y = 0;
            direction.z = moving ? -Math.cos(t * 0.11) : 0;
            integrateSwimming(
              a.state,
              direction,
              1 / 30,
              a.tuning,
              AQUARIUM,
              q.collision,
            );
            q.update(t, a.settings.reducedMotion, 1 / 30, true, {
              position: a.state.position,
              velocity: a.state.velocity,
              active: moving,
            });
            a.audio.update(1 / 30, a.state, a.tuning, 0);
            const voice = a.audio.graph.voice;
            if (voice) {
              if (!window.__voiceEnds.has(voice))
                window.__voiceEnds.set(voice, t + 2.8);
              if (t >= window.__voiceEnds.get(voice)) voice.stop();
            }
            if (i % 30 === 0) {
              if (
                q.fish.simulation.fish.some(
                  (f) =>
                    !safeFishPosition(
                      f.position,
                      f.radius,
                      q.fish.simulation.habitat,
                    ),
                )
              )
                throw Error('Long browser fish safety');
              await new Promise((r) => setTimeout(r, 0));
            }
            window.__stressTime += 1 / 30;
          }
        });
      }
      if ([0, 5, 15, 30].includes(minute)) {
        await cdp.send('HeapProfiler.collectGarbage');
        const heap = await cdp.send('Runtime.getHeapUsage');
        const snapshot = await page.evaluate(async () => {
          const { tropicalSnapshot } =
            await import('/validation/TropicalAudit.ts');
          const a = window.__cozy,
            g = a.audio.graph;
          return {
            tropical: tropicalSnapshot(a.world.aquarium),
            uploaded: { ...a.world.renderer.info.memory },
            contexts: window.__contexts.length,
            nodes: g.nodes.length,
            buffers: g.buffers.length,
            loops: g.loops.length,
            voices: g.voices,
            fish: a.world.aquarium.fish.simulation.fish.length,
            steps: a.world.aquarium.fish.simulation.steps,
            corrections: a.world.aquarium.fish.simulation.fish.reduce(
              (n, f) => n + f.corrections,
              0,
            ),
          };
        });
        assert.equal(snapshot.contexts, 1);
        assert.equal(snapshot.tropical.hiddenAnimals, 7);
        assert.equal(snapshot.tropical.finite, true);
        assert.equal(snapshot.tropical.bubblesInside, true);
        // Pass 014 adds the authored reef layer and Pass 015 the nudibranch library / creature
        // skins: 422 resident geometries, 81 materials and
        // 503 hulls (Pass 019 wreck; each reef rock's accepted hull replaced by its authored convex parts).
        // Pass 016 authored fish schools (462) + Pass 017 fish distance levels (36 parts).
        // Pass 019 warm-up uploads every distance level up front, Pass 019 round 2 adds the carved
        // den rock and the new moray head, and v0.3 Pass 020 the office (26 geometries).
        // Pass 023: +8 for the hidden crevice (7 boulder geometries and its dark liner). Pass 026
        // playtest: +7 (6 rocks around its mouth, and darkness veils; the rock tube replaces the liner).
        // PR #47 adds the procedural fallback jaw alongside the re-authored frogfish.
        assert.equal(snapshot.tropical.geometries, 583);
        // Pass 019 round 2: moray head skin, frogfish camouflage, wreck sand. Pass 023: +2 for the
        // hidden crevice (its fallback rock material, kept for the procedural reef, and its liner;
        // Pass 026 playtest: the darkness veils' material replaces the liner's).
        // The re-authored frogfish prunes the old skin palette; its lure shares the
        // body's tinted skin instead of receiving another clone/tint pass.
        assert.equal(snapshot.tropical.materials, 108);
        // Pass 023: +12 for the hidden crevice (7 rocks, 5 channel seals); Pass 026 playtest: +6 rocks.
        assert.equal(snapshot.tropical.hulls, 521);
        assert.equal(snapshot.corrections, 0);
        if (longSession.length) {
          assert.deepEqual(
            snapshot.tropical.population,
            longSession[0].tropical.population,
          );
          assert.deepEqual(snapshot.uploaded, longSession[0].uploaded);
        }
        assert.equal(snapshot.nodes, 19);
        assert.equal(snapshot.buffers, 3);
        assert(snapshot.voices <= 1);
        assert.equal(snapshot.fish, 41);
        longSession.push({ minute, heapBytes: heap.usedSize, ...snapshot });
        console.log('COZY_BROWSER_MINUTE', minute, heap.usedSize);
      }
      if (minute && minute % 5 === 0) {
        await page.evaluate(() => window.__cozy.audio.setActive(false));
        await page.waitForFunction(
          () => window.__cozy.audio.context.state === 'suspended',
        );
        await page.evaluate(() => {
          window.__cozy.audio.setVisible(false);
          window.__cozy.audio.setVisible(true);
          window.__cozy.audio.setActive(true);
        });
        await page.waitForFunction(
          () => window.__cozy.audio.context.state === 'running',
        );
      }
    }
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.pointerLockElement);
    const metrics = await page.evaluate(() => {
      const a = window.__cozy,
        g = a.audio.graph;
      return {
        contexts: window.__contexts.length,
        nodes: g.nodes.length,
        loops: g.loops.length,
        buffers: g.buffers.length,
        bufferBytes: g.buffers.reduce(
          (n, b) => n + b.length * b.numberOfChannels * 4,
          0,
        ),
        voices: g.voices,
        fish: a.world.aquarium.fish.simulation.fish.length,
      };
    });
    assert.equal(metrics.fish, 41);
    assert.equal(metrics.contexts, 1);
    assert.equal(metrics.buffers, 3);
    // Rendering/audio initialization failure remains independent of entering the game.
    await page.evaluate(() => {
      window.__audioContext = window.__cozy.audio.context;
      window.__cozy.dispose();
    });
    await page.waitForFunction(() => window.__audioContext.state === 'closed');
    assert.deepEqual(errors, []);
    const failure = await browser.newPage({
      viewport: { width: 800, height: 600 },
    });
    await failure.addInitScript(() => {
      window.AudioContext = undefined;
    });
    await failure.route('**/src/main.ts*', async (route) => {
      const r = await route.fetch();
      await route.fulfill({
        response: r,
        body: (await r.text()) + '\nwindow.__cozy=app;',
      });
    });
    await failure.goto(process.env.COZY_URL || 'http://127.0.0.1:5173');
    await failure.waitForFunction(() => window.__cozy?.world);
    await failure.getByRole('button', { name: 'Enter the Water' }).click();
    await failure.waitForFunction(
      () =>
        !!document.pointerLockElement &&
        document.querySelector('#overlay').hidden,
    );
    assert.match(
      await failure.locator('#audio-status').textContent(),
      /unavailable/,
    );
    const before = await failure.evaluate(() => window.__cozy.state.position.z);
    await failure.keyboard.down('w');
    await failure.waitForFunction(
      (z) => window.__cozy.state.position.z < z - 0.2,
      before,
      { timeout: 60000 },
    );
    await failure.keyboard.up('w');
    await failure.close();
    const result = {
      result: 'PASS',
      swim,
      event,
      metrics,
      longSession,
      checks: [
        'camera-directed ascent/descent',
        'Space/Shift ignored',
        'blur clears held input',
        'modified M shortcuts ignored',
        'silent preview',
        'old settings migrate',
        'gesture-started context',
        'swimming audio',
        'M mute/unmute',
        'sparse voice rendered and released',
        'Escape freeze',
        'settings persistence',
        'four pause/resume cycles',
        'visibility handler',
        'context closes on disposal',
        'unsupported audio still permits swimming',
        'no console errors',
      ],
      limitations: [
        'Headless software renderer; visibility handler used controlled hidden state',
        'Functional Web Audio checks, not perceptual listening',
      ],
    };
    fs.writeFileSync(
      process.env.COZY_LIFECYCLE_OUTPUT || '/tmp/cozy-marine-lifecycle.json',
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
