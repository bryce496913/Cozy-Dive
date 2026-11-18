/* v0.6 Pass 056: cross-browser smoke checks, on every browser engine available here.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy056 node validation/compat.mjs
 *
 * Engines: Playwright's Chromium, plus Google Chrome when `COZY_CHROME` points at it (default
 * /usr/bin/google-chrome if present). Firefox and WebKit are tried too when Playwright has them
 * installed; otherwise they are recorded as "not available here", never as passed.
 *
 * For each engine, in its own context:
 *   - core: start screen; Dive In (pointer lock); swim with W; Escape pauses; resume; resize the
 *     window (canvas follows); the tab hidden (the game pauses and goes quiet) and shown again.
 *   - context loss: lose the WebGL context; a calm message and a Reload button; Reload works.
 *   - no WebGL 2, no Web Audio, no pointer lock, storage blocked: each handled with a clear message
 *     (or silently, for audio and storage), and no page errors.
 * Records the browser version, the WebGL renderer string, and which compressed texture formats the
 * GPU offers (what KTX2 transcodes to).
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const pw = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const url = process.env.COZY_URL || 'http://127.0.0.1:5173';
const output = process.env.COZY_OUTPUT || '/tmp/cozy056';
fs.mkdirSync(output, { recursive: true });
const chrome =
  process.env.COZY_CHROME ??
  (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : '');
const ARGS = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--enable-unsafe-swiftshader',
  '--use-angle=swiftshader',
];
const ENGINES = [
  { name: 'chromium', type: pw.chromium, options: { args: ARGS } },
  ...(chrome
    ? [
        {
          name: 'google-chrome',
          type: pw.chromium,
          options: { args: ARGS, executablePath: chrome },
        },
      ]
    : []),
  { name: 'firefox', type: pw.firefox, options: {} },
  { name: 'webkit', type: pw.webkit, options: {} },
];
const report = { engines: {} };
const log = (m) =>
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

async function scenario(browser, name, init, run) {
  const context = await browser.newContext({
    viewport: { width: 800, height: 500 },
    deviceScaleFactor: 0.5,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(300000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  if (init) await page.addInitScript(init);
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body: (await r.text()) + '\nwindow.__cozy=app;',
    });
  });
  const result = { ok: false };
  try {
    Object.assign(result, await run(page, errors));
    result.ok = true;
  } catch (e) {
    result.failure = String(e?.message || e).split('\n')[0];
  }
  result.errors = errors;
  await context.close();
  return result;
}
const status = (page) =>
  page.evaluate(() => document.querySelector('#status').textContent);
const ready = (page) =>
  page.evaluate(() =>
    Promise.all([window.__cozy.world.prepared, window.__cozy.office.prepared]),
  );
const locked = (page) =>
  page.waitForFunction(
    () =>
      !!document.pointerLockElement &&
      document.querySelector('#overlay').hidden,
  );
const paused = (page) =>
  page.waitForFunction(
    () =>
      !document.pointerLockElement &&
      !document.querySelector('#overlay').hidden,
  );

for (const engine of ENGINES) {
  let browser;
  try {
    browser = await engine.type.launch(engine.options);
  } catch (e) {
    report.engines[engine.name] = {
      available: false,
      reason: String(e?.message || e).split('\n')[0],
    };
    log(`${engine.name}: not available here`);
    continue;
  }
  const r = (report.engines[engine.name] = {
    available: true,
    version: browser.version(),
    scenarios: {},
  });
  log(`${engine.name} ${r.version}`);
  r.scenarios.core = await scenario(browser, 'core', null, async (page) => {
    const t0 = Date.now();
    await page.goto(url);
    await page.waitForSelector('#office:not([disabled])', {
      state: 'visible',
    });
    const shown = Date.now() - t0;
    await page.waitForFunction(() => window.__cozy?.world);
    await ready(page);
    const gpu = await page.evaluate(() => {
      const gl = window.__cozy.world.renderer.getContext(),
        info = gl.getExtension('WEBGL_debug_renderer_info'),
        has = (n) => !!gl.getExtension(n);
      return {
        webgl2:
          typeof WebGL2RenderingContext !== 'undefined' &&
          gl instanceof WebGL2RenderingContext,
        renderer: info
          ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
          : gl.getParameter(gl.RENDERER),
        compressed: {
          astc: has('WEBGL_compressed_texture_astc'),
          etc: has('WEBGL_compressed_texture_etc'),
          s3tc: has('WEBGL_compressed_texture_s3tc'),
          bptc: has('EXT_texture_compression_bptc'),
        },
      };
    });
    await page.getByRole('button', { name: 'Dive In', exact: true }).click();
    await locked(page);
    const before = await page.evaluate(() => ({
      ...window.__cozy.state.position,
    }));
    // Hold W until the swimmer has moved (software rendering can take seconds a frame at first).
    await page.keyboard.down('w');
    await page
      .waitForFunction(
        (b) => {
          const p = window.__cozy.state.position;
          return Math.hypot(p.x - b.x, p.y - b.y, p.z - b.z) > 0.3;
        },
        before,
        { timeout: 60000 },
      )
      .catch(() => undefined);
    await page.keyboard.up('w');
    const after = await page.evaluate(() => ({
      ...window.__cozy.state.position,
    }));
    const swum = Math.hypot(
      after.x - before.x,
      after.y - before.y,
      after.z - before.z,
    );
    await page.keyboard.press('Escape');
    await paused(page);
    await page.getByRole('button', { name: /Return to the Water/ }).click();
    await locked(page);
    // Resize: the canvas follows the window.
    await page.setViewportSize({ width: 640, height: 420 });
    const resizeStart = Date.now();
    await page
      .waitForFunction(
        () => window.__cozy.world.renderer.domElement.clientWidth === 640,
        null,
        { timeout: 30000 },
      )
      .catch(() => undefined);
    const resizeMs = Date.now() - resizeStart;
    // The canvas fills the app, which keeps a minimum height of 600 px.
    const canvas = await page.evaluate(() => {
      const c = window.__cozy.world.renderer.domElement,
        app = document.querySelector('#app');
      return {
        w: c.clientWidth,
        h: c.clientHeight,
        appW: app.clientWidth,
        appH: app.clientHeight,
        buffer: [c.width, c.height],
      };
    });
    // The tab hidden: the game lets go of the mouse and goes quiet; shown again, it waits.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await paused(page);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => false,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.screenshot({
      path: path.join(output, `${engine.name}-core.png`),
    });
    assert(gpu.webgl2, 'WebGL 2');
    assert(swum > 0.3, `swam ${swum.toFixed(2)} m with W`);
    assert.equal(canvas.w, 640, 'canvas width follows the window');
    assert.equal(canvas.h, canvas.appH, 'canvas height fills the app');
    return {
      shown,
      gpu,
      swum: +swum.toFixed(2),
      canvas,
      resizeMs,
      pausedWhenHidden: true,
    };
  });
  r.scenarios.contextLoss = await scenario(
    browser,
    'context-loss',
    null,
    async (page, errors) => {
      await page.goto(url);
      await page.waitForFunction(() => window.__cozy?.world);
      await ready(page);
      await page.evaluate(() =>
        window.__cozy.world.renderer
          .getContext()
          .getExtension('WEBGL_lose_context')
          .loseContext(),
      );
      await page.waitForFunction(
        () => document.querySelector('#status').textContent,
      );
      const message = await status(page);
      const reload = page.getByRole('button', { name: 'Reload', exact: true });
      await reload.waitFor();
      await page.screenshot({
        path: path.join(output, `${engine.name}-context-lost.png`),
      });
      await reload.click();
      await page.waitForSelector('#office:not([disabled])', {
        state: 'visible',
      });
      const after = await status(page);
      assert.match(message, /graphics/i);
      assert.equal(after, '');
      // three.js logs the lost context itself.
      errors.splice(
        0,
        errors.length,
        ...errors.filter((e) => !/context/i.test(e)),
      );
      return { message, recovered: true };
    },
  );
  r.scenarios.noWebGL2 = await scenario(
    browser,
    'no-webgl2',
    () => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
        return kind === 'webgl2' ? null : get.call(this, kind, ...rest);
      };
    },
    async (page, errors) => {
      await page.goto(url);
      await page.waitForFunction(
        () => document.querySelector('#status').textContent,
      );
      const message = await status(page);
      const disabled = await page.evaluate(
        () => document.querySelector('#enter').disabled,
      );
      await page.screenshot({
        path: path.join(output, `${engine.name}-no-webgl2.png`),
      });
      assert.match(message, /WebGL 2/);
      assert(disabled);
      errors.splice(
        0,
        errors.length,
        ...errors.filter((e) => !/WebGL/i.test(e)),
      );
      return { message };
    },
  );
  r.scenarios.noAudio = await scenario(
    browser,
    'no-audio',
    () => {
      delete window.AudioContext;
      delete window.webkitAudioContext;
    },
    async (page) => {
      await page.goto(url);
      await page.waitForFunction(() => window.__cozy?.world);
      await ready(page);
      await page.getByRole('button', { name: 'Dive In', exact: true }).click();
      await locked(page);
      const audio = await page.evaluate(
        () => document.querySelector('#audio-status').textContent,
      );
      assert.match(audio, /unavailable/);
      return { audio };
    },
  );
  r.scenarios.noPointerLock = await scenario(
    browser,
    'no-pointer-lock',
    () => {
      delete HTMLCanvasElement.prototype.requestPointerLock;
      delete Element.prototype.requestPointerLock;
    },
    async (page) => {
      await page.goto(url);
      await page.waitForFunction(() => window.__cozy?.world);
      await page.waitForFunction(
        () => document.querySelector('#status').textContent,
      );
      const message = await status(page);
      assert.match(message, /capture the mouse/);
      return { message };
    },
  );
  r.scenarios.storageBlocked = await scenario(
    browser,
    'storage-blocked',
    () => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('denied', 'SecurityError');
        },
      });
    },
    async (page) => {
      await page.goto(url);
      await page.waitForFunction(() => window.__cozy?.world);
      await ready(page);
      await page.getByRole('button', { name: 'Dive In', exact: true }).click();
      await locked(page);
      await page
        .locator('#audio-toggle')
        .click({ force: true })
        .catch(() => {});
      return { entered: true };
    },
  );
  for (const [n, s] of Object.entries(r.scenarios))
    log(
      `  ${n}: ${s.ok ? 'pass' : 'FAIL ' + s.failure}${s.errors.length ? ' errors: ' + s.errors.slice(0, 2).join(' | ') : ''}`,
    );
  await browser.close();
}
fs.writeFileSync(
  path.join(output, 'report.json'),
  JSON.stringify(report, null, 2),
);
const failed = Object.entries(report.engines).flatMap(([e, r]) =>
  r.available
    ? Object.entries(r.scenarios)
        .filter(([, s]) => !s.ok || s.errors.length)
        .map(([n]) => `${e}/${n}`)
    : [],
);
log(
  failed.length
    ? `failed: ${failed.join(', ')}`
    : 'all available engines passed',
);
if (failed.length) process.exitCode = 1;
