/* Pass 011 physical route witnesses and explicit failure regression. No debug code ships. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy011-integration';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.COZY_CHROMIUM || undefined,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const url = process.env.COZY_URL || 'http://127.0.0.1:5173';
async function instrument(page) {
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body: (await r.text()) + '\nwindow.__cozy=app;',
    });
  });
}
try {
  const page = await browser.newPage({
      viewport: { width: 1100, height: 750 },
    }),
    errors = [],
    warnings = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning') warnings.push(m.text());
  });
  await instrument(page);
  await page.goto(url);
  await page.waitForFunction(
    () => window.__cozy?.world?.renderer.info.render.calls > 0,
  );
  await page
    .getByRole('button', { name: 'Enter the Water', exact: true })
    .click();
  await page.waitForFunction(
    () =>
      !!document.pointerLockElement &&
      document.querySelector('#overlay').hidden,
  );
  await page.evaluate(() => cancelAnimationFrame(window.__cozy.frame));
  const routeIds = await page.evaluate(async () => {
    const { integrationRoutes } = await import('/validation/SwimRoutes.ts');
    return integrationRoutes(window.__cozy.world.aquarium).map((r) => r.id);
  });
  const routes = [];
  for (const id of routeIds) {
    const result = await page.evaluate(async (id) => {
      const { integrationRoutes, swimRoute } =
          await import('/validation/SwimRoutes.ts'),
        a = window.__cozy,
        q = a.world.aquarium,
        route = integrationRoutes(q).find((r) => r.id === id),
        result = swimRoute(q, route.points);
      Object.assign(a.state.position, result.state.position);
      a.world.camera.position.set(
        result.state.position.x,
        result.state.position.y,
        result.state.position.z,
      );
      a.world.camera.lookAt(route.focus.x, route.focus.y, route.focus.z);
      a.world.render(0, false);
      a.world.renderer.getContext().finish();
      return {
        id,
        points: route.points,
        destination: result.state.position,
        frames: result.frames,
        maximumError: result.maximumError,
      };
    }, id);
    routes.push(result);
    await page.screenshot({ path: path.join(output, id + '.png') });
  }
  // Actual key events feed the production controls, then bounded steps advance the real integrator.
  await page.evaluate(async () => {
    const { SPAWN } = await import('/src/config/world.ts'),
      { createSwimState } = await import('/src/player/swimming.ts');
    Object.assign(window.__cozy.state, createSwimState(SPAWN));
  });
  const keys = [];
  for (const [key, axis, sign] of [
    ['w', 'z', -1],
    ['s', 'z', 1],
    ['a', 'x', -1],
    ['d', 'x', 1],
  ]) {
    const start = await page.evaluate((axis) => {
      const a = window.__cozy;
      a.controls.clear();
      a.controls.yaw = a.controls.targetYaw = 0;
      a.controls.pitch = a.controls.targetPitch = 0;
      return a.state.position[axis];
    }, axis);
    await page.keyboard.down(key);
    const moved = await page.evaluate(
      async ({ axis, start }) => {
        const { movementDirection, integrateSwimming, resetSwimming } =
            await import('/src/player/swimming.ts'),
          { AQUARIUM } = await import('/src/config/world.ts'),
          a = window.__cozy,
          direction = { x: 0, y: 0, z: 0 };
        a.controls.yaw = 0;
        a.controls.pitch = 0;
        for (let i = 0; i < 60; i++) {
          a.controls.update(1 / 30);
          movementDirection(
            a.controls.input,
            a.controls.yaw,
            a.controls.pitch,
            direction,
          );
          integrateSwimming(
            a.state,
            direction,
            1 / 30,
            a.tuning,
            AQUARIUM,
            a.world.aquarium.collision,
          );
        }
        const delta = a.state.position[axis] - start;
        resetSwimming(a.state);
        return delta;
      },
      { axis, start },
    );
    await page.keyboard.up(key);
    assert(moved * sign > 0.2, `${key} must move in its expected direction`);
    keys.push({ key, axis, delta: moved });
  }
  assert.deepEqual(errors, []);
  await page.evaluate(() => window.__cozy.dispose());
  await page.close();

  const failureChecks = [];
  const makeFailurePage = async () => {
    const p = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await instrument(p);
    return p;
  };
  const noWebGL = await makeFailurePage();
  await noWebGL.addInitScript(() => {
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return kind.startsWith('webgl') ? null : native.call(this, kind, ...args);
    };
  });
  await noWebGL.goto(url);
  await noWebGL.waitForFunction(() =>
    document.body.textContent.includes('This aquarium needs WebGL'),
  );
  await noWebGL.screenshot({
    path: path.join(output, 'webgl-unavailable.png'),
  });
  failureChecks.push('unavailable WebGL presents a clear error');
  await noWebGL.close();

  const noLock = await makeFailurePage();
  await noLock.goto(url);
  await noLock.waitForFunction(() => window.__cozy?.world);
  await noLock.evaluate(() => {
    window.__cozy.world.renderer.domElement.requestPointerLock = undefined;
  });
  await noLock.getByRole('button', { name: 'Enter the Water' }).click();
  await noLock.waitForFunction(() =>
    document.body.textContent.includes('Mouse capture is unavailable'),
  );
  assert.equal(
    await noLock.evaluate(() => !!document.pointerLockElement),
    false,
  );
  failureChecks.push('unavailable pointer lock presents a clear error');
  await noLock.close();

  const rejectedLock = await makeFailurePage();
  await rejectedLock.goto(url);
  await rejectedLock.waitForFunction(() => window.__cozy?.world);
  await rejectedLock.evaluate(() => {
    window.__cozy.world.renderer.domElement.requestPointerLock = () =>
      Promise.reject(new Error('Controlled denial'));
  });
  await rejectedLock.getByRole('button', { name: 'Enter the Water' }).click();
  await rejectedLock.waitForFunction(() =>
    document.body.textContent.includes('Mouse capture was not granted'),
  );
  failureChecks.push('rejected pointer lock presents a retryable error');
  await rejectedLock.close();

  const lost = await makeFailurePage();
  await lost.goto(url);
  await lost.waitForFunction(() => window.__cozy?.world);
  await lost.getByRole('button', { name: 'Enter the Water' }).click();
  await lost.waitForFunction(
    () =>
      !!document.pointerLockElement &&
      window.__cozy.audio.context?.state === 'running',
  );
  await lost.evaluate(() => {
    const ext = window.__cozy.world.renderer
      .getContext()
      .getExtension('WEBGL_lose_context');
    if (!ext) throw Error('Context loss extension unavailable');
    ext.loseContext();
  });
  await lost.waitForFunction(
    () =>
      document.body.textContent.includes(
        'graphics connection was interrupted',
      ) &&
      !document.pointerLockElement &&
      window.__cozy.audio.context.state === 'suspended',
  );
  const steps = await lost.evaluate(
    () => window.__cozy.world.aquarium.fish.simulation.steps,
  );
  await lost.waitForTimeout(250);
  assert.equal(
    await lost.evaluate(
      () => window.__cozy.world.aquarium.fish.simulation.steps,
    ),
    steps,
  );
  await lost.screenshot({
    path: path.join(output, 'graphics-context-lost.png'),
  });
  failureChecks.push(
    'real WebGL context loss stops simulation, releases pointer lock and suspends audio',
  );
  await lost.evaluate(() => window.__cozy.dispose());
  await lost.close();
  const report = {
    result: 'PASS',
    routes,
    keys,
    failureChecks,
    errors,
    warnings,
    limitations: [
      'Routes use autonomous direction steering and real swimming/collision; endpoints are rendered. These are not human navigation recordings.',
      'Failure scenarios intentionally inject unavailable/denied APIs; context loss uses the real WebGL extension.',
      'Software-rendered Chromium; no macOS hardware or subjective comfort claim.',
    ],
  };
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
