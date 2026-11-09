/* Pass 017: production download and preparation time for one preview build.
 *
 *   npm run build && npx vite preview --port 5175
 *   COZY_URL=http://127.0.0.1:5175 COZY_OUTPUT=/tmp/cozy017-load node validation/load-budget.mjs
 * Measures bytes actually transferred (response bodies) and the time from navigation until every
 * authored library is decoded and its shaders prepared. Localhost and SwiftShader: relative only.
 */
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy017-load';
fs.mkdirSync(output, { recursive: true });
const runs = Number(process.env.COZY_RUNS || 3);
const browser = await chromium.launch({
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const report = {
  url: process.env.COZY_URL || 'http://127.0.0.1:5175',
  runs: [],
};
try {
  for (let run = 0; run < runs; run++) {
    const context = await browser.newContext({
      viewport: { width: 1100, height: 750 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(600000);
    const bytes = { total: 0, models: 0, decoder: 0, scripts: 0 };
    const pending = [];
    page.on('requestfinished', (request) => {
      pending.push(
        request.sizes().then(({ responseBodySize }) => {
          const url = request.url();
          bytes.total += responseBodySize;
          if (url.endsWith('.glb')) bytes.models += responseBodySize;
          else if (url.includes('/draco/')) bytes.decoder += responseBodySize;
          else if (url.endsWith('.js')) bytes.scripts += responseBodySize;
        }),
      );
    });
    const started = Date.now();
    await page.goto(report.url);
    // The production status line disappears once every library is decoded and prepared.
    await page.waitForFunction(() => {
      const s = [...document.querySelectorAll('[role=status]')].map(
        (e) => e.textContent,
      );
      return !s.some((t) => t?.includes('Preparing aquarium details'));
    });
    const preparedMs = Date.now() - started;
    await Promise.all(pending);
    report.runs.push({ preparedMs, bytes });
    await context.close();
  }
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 1));
