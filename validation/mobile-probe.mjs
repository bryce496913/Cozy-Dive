/* v0.6 Pass 058 (feasibility): what a phone or tablet would meet today, in emulation only.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy058 node validation/mobile-probe.mjs
 *
 * Chromium's device emulation (viewport, device pixel ratio, touch, mobile user agent). This is NOT
 * a real device: it cannot show mobile GPU speed, thermal limits or iOS Safari's behaviour. It does
 * show layout, touch handling, what is downloaded and what is held in memory.
 *   - Per device: the start screen's layout (overflow, buttons visible, tap-target sizes), a
 *     screenshot, and what happens when Dive In is tapped (pointer lock is not offered on mobile).
 *   - Once: bytes transferred for a first visit (to the start screen, and with the tank prepared),
 *     JS heap, GPU geometries and textures, and the render counts of the tank.
 */
import fs from 'node:fs';
import path from 'node:path';
const pw = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const { chromium, devices } = pw;
const url = process.env.COZY_URL || 'http://127.0.0.1:5173';
const output = process.env.COZY_OUTPUT || '/tmp/cozy058';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    '--enable-precise-memory-info',
  ],
});
const report = { devices: {} };
const log = (m) =>
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const DEVICES = [
  'iPhone 13',
  'Pixel 7',
  'iPad (gen 7)',
  'iPad Pro 11 landscape',
];
for (const name of DEVICES) {
  const d = devices[name];
  if (!d) continue;
  const context = await browser.newContext({ ...d });
  const page = await context.newPage();
  page.setDefaultTimeout(300000);
  let bytes = 0;
  page.on('response', async (r) => {
    const len = Number(r.headers()['content-length'] || 0);
    if (len) bytes += len;
    else {
      try {
        bytes += (await r.body()).length;
      } catch {
        /* streamed or aborted */
      }
    }
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body: (await r.text()) + '\nwindow.__cozy=app;',
    });
  });
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForSelector('#office', { state: 'visible' });
  const shownMs = Date.now() - t0,
    shownBytes = bytes;
  const layout = await page.evaluate(() => {
    const vw = innerWidth,
      vh = innerHeight,
      box = (s) => {
        const e = document.querySelector(s);
        if (!e || e.offsetParent === null) return null;
        const r = e.getBoundingClientRect();
        return {
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
          inView:
            r.right <= vw + 1 && r.bottom <= vh + 1 && r.x >= -1 && r.y >= -1,
        };
      };
    const small = [
      ...document.querySelectorAll('button:not([hidden]), a[href]'),
    ]
      .filter((e) => e.offsetParent !== null)
      .map((e) => {
        const r = e.getBoundingClientRect();
        return {
          label: e.id || e.textContent.trim().slice(0, 20),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      })
      .filter((b) => b.w < 44 || b.h < 44);
    return {
      viewport: [vw, vh],
      scroll: [
        document.documentElement.scrollWidth,
        document.documentElement.scrollHeight,
      ],
      overflowX: document.documentElement.scrollWidth > vw + 1,
      office: box('#office'),
      enter: box('#enter'),
      settings: box('.settings-toggle'),
      controlsBar: box('#controls'),
      smallTapTargets: small,
      pointerLockApi:
        typeof HTMLCanvasElement.prototype.requestPointerLock === 'function',
      touch: navigator.maxTouchPoints,
      dpr: devicePixelRatio,
    };
  });
  await page.screenshot({
    path: path.join(output, `${name.replace(/\W+/g, '-')}-start.png`),
  });
  // The world prepared behind the start screen: bytes, memory and the tank's render counts.
  await page.waitForFunction(() => window.__cozy?.world);
  await page.evaluate(() =>
    Promise.all([window.__cozy.world.prepared, window.__cozy.office.prepared]),
  );
  await page.waitForTimeout(1500);
  const prepared = await page.evaluate(() => {
    const r = window.__cozy.world.renderer,
      c = r.domElement;
    return {
      heapMB: performance.memory
        ? Math.round(performance.memory.usedJSHeapSize / 1048576)
        : null,
      geometries: r.info.memory.geometries,
      textures: r.info.memory.textures,
      drawingBuffer: [c.width, c.height],
      pixelRatio: r.getPixelRatio(),
    };
  });
  // Tapping Dive In: what a touch user gets today.
  await page.tap('#enter');
  await page.waitForTimeout(3000);
  const afterTap = await page.evaluate(() => ({
    locked: !!document.pointerLockElement,
    overlayHidden: document.querySelector('#overlay').hidden,
    status: document.querySelector('#status').textContent,
  }));
  await page.screenshot({
    path: path.join(output, `${name.replace(/\W+/g, '-')}-after-tap.png`),
  });
  report.devices[name] = {
    shownMs,
    mbToStart: +(shownBytes / 1048576).toFixed(1),
    mbPrepared: +(bytes / 1048576).toFixed(1),
    layout,
    prepared,
    afterTap,
    errors,
  };
  log(`${name}: ${JSON.stringify(report.devices[name]).slice(0, 600)}`);
  await context.close();
}
fs.writeFileSync(
  path.join(output, 'report.json'),
  JSON.stringify(report, null, 2),
);
await browser.close();
