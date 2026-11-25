/** Pass 107: Pass 097's existing cave-only harness, four departures/resettles per shark type.
 * Step simulation without rendering thousands of frames; render only localized checkpoints.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy-pass107-sharks';
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
const report = {
  errors: [],
  renderer:
    'Chromium SwiftShader; cave-only simulation and sparse renders, no traversal',
};
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 700 },
  });
  page.setDefaultTimeout(240000);
  page.on('response', (r) => {
    if (r.status() >= 400) console.log('HTTP failure', r.status(), r.url());
  });
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  const start = Date.now();
  await page.goto(
    (process.env.COZY_URL || 'http://127.0.0.1:5177') +
      '/validation/v08/shark-bolt.html',
  );
  await page.evaluate(() => window.ready);
  report.loadingMs = Date.now() - start;
  console.log('Cave shark harness ready');
  for (const type of ['whitetip', 'nurse']) {
    report[type] = await page.evaluate((type) => {
      const scene = window.cave,
        owner = type === 'whitetip' ? scene.resting : scene.visitors,
        rig = type === 'whitetip' ? owner.rigs[0] : owner.nurse,
        bolt = type === 'whitetip' ? rig.bolt : owner.nurseBolt,
        mesh = type === 'whitetip' ? rig.near : rig.near;
      if (!mesh || !bolt) throw Error('Missing actual shark rig: ' + type);
      const weight = () =>
        mesh.morphTargetInfluences[mesh.morphTargetDictionary.Stroke_Left] -
        mesh.morphTargetInfluences[mesh.morphTargetDictionary.Stroke_Right];
      const update = (dt, active, reduced, player) =>
        owner.update(dt, active, reduced, player);
      const player = {
          active: true,
          position: { x: 0, y: 0, z: 0 },
          velocity: { x: 0, y: 0, z: 0 },
        },
        rounds = [];
      const positions = mesh.geometry.attributes.position,
        morph =
          mesh.geometry.morphAttributes.position[
            mesh.morphTargetDictionary.Stroke_Left
          ];
      let tip = 0,
        best = -Infinity;
      for (let i = 0; i < positions.count; i++) {
        const z = mesh.geometry.morphTargetsRelative
          ? morph.getZ(i)
          : morph.getZ(i) - positions.getZ(i);
        if (positions.getX(i) < 0 && Math.abs(z) > best) {
          best = Math.abs(z);
          tip = i;
        }
      }
      // Use the native BufferGeometry's vertex evaluator (includes the live morph influences).
      const point = scene.camera.position.clone();
      for (let round = 0; round < 4; round++) {
        let frames = 0,
          min = Infinity,
          max = -Infinity,
          peak = 0,
          tail = 0,
          settled = false,
          matched = true,
          finite = true;
        const began = { ...bolt.position };
        for (let i = 0; i < 2400; i++) {
          player.position.x = bolt.position.x + 1.2;
          player.position.y = bolt.position.y + 0.4;
          player.position.z = bolt.position.z;
          update(1 / 30, true, false, player);
          const w = weight();
          finite &&= Number.isFinite(
            w + bolt.position.x + bolt.position.y + bolt.position.z,
          );
          if (bolt.mood !== 'rest')
            matched &&= Math.abs(w - bolt.effort) < 1e-7;
          if (bolt.mood === 'flee') {
            frames++;
            min = Math.min(min, w);
            max = Math.max(max, w);
            peak = Math.max(peak, Math.abs(w));
            mesh.getVertexPosition(tip, point);
            tail = Math.max(
              tail,
              Math.abs(point.z - positions.getZ(tip)) * rig.root.scale.x,
            );
          }
          if (frames && bolt.resting) {
            settled = true;
            break;
          }
        }
        rounds.push({
          round: round + 1,
          fleeFrames: frames,
          peak,
          range: max - min,
          tailWorldDisplacement: tail,
          matched,
          finite,
          settled,
          travel: Math.hypot(
            bolt.position.x - began.x,
            bolt.position.z - began.z,
          ),
          finalPitch: bolt.pitch,
          finalBank: bolt.bank,
          finalSway: bolt.sway,
        });
      }
      const snapshot = {
        position: { ...bolt.position },
        weight: weight(),
        mood: bolt.mood,
      };
      update(0.1, false, false, player);
      const pause =
        JSON.stringify(snapshot) ===
        JSON.stringify({
          position: { ...bolt.position },
          weight: weight(),
          mood: bolt.mood,
        });
      let reducedPeak = 0,
        noSway = true;
      for (let i = 0; i < 1200; i++) {
        player.position.x = bolt.position.x + 1.2;
        player.position.y = bolt.position.y + 0.4;
        player.position.z = bolt.position.z;
        update(1 / 30, true, true, player);
        reducedPeak = Math.max(reducedPeak, Math.abs(weight()));
        noSway &&= bolt.sway === 0;
      }
      return {
        rounds,
        pause,
        reducedPeak,
        noSway,
        vertexCount: positions.count,
        morphNames: Object.keys(mesh.morphTargetDictionary),
      };
    }, type);
    for (const r of report[type].rounds) {
      assert.ok(r.settled && r.matched && r.finite, JSON.stringify(r));
      assert.ok(r.fleeFrames > 30);
      assert.ok(r.range > 2.5);
      assert.ok(r.peak > 1.5);
      assert.ok(r.tailWorldDisplacement > 0.1);
      assert.equal(r.finalPitch, 0);
      assert.equal(r.finalBank, 0);
      assert.equal(r.finalSway, 0);
    }
    assert.equal(report[type].pause, true);
    assert.equal(report[type].noSway, true);
    assert.ok(report[type].reducedPeak < 1.7);
    // Find one strong departure and render that exact native model once from above.
    await page.evaluate((type) => {
      const s = window.cave,
        o = type === 'whitetip' ? s.resting : s.visitors,
        b = type === 'whitetip' ? o.rigs[0].bolt : o.nurseBolt;
      for (let i = 0; i < 1500; i++) {
        const p = {
          active: true,
          position: {
            x: b.position.x + 1.2,
            y: b.position.y + 0.4,
            z: b.position.z,
          },
          velocity: { x: 0, y: 0, z: 0 },
        };
        o.update(1 / 30, true, false, p);
        if (b.mood === 'flee' && Math.abs(b.effort) > 1.8) break;
      }
      const c = s.camera;
      c.position.set(b.position.x, b.position.y + 2.5, b.position.z);
      c.up.set(0, 0, -1);
      c.lookAt(b.position.x, b.position.y, b.position.z);
      s.render(0, false, 0, false, {
        active: false,
        position: c.position,
        velocity: { x: 0, y: 0, z: 0 },
      });
    }, type);
    await page.screenshot({ path: `${output}/${type}-departure.png` });
    console.log(type, 'four native-model cycles passed');
  }
  report.released = await page.evaluate(() => window.finish());
  assert.equal(report.released.leases, 0);
  assert.equal(report.released.geometries, 0);
  assert.equal(report.released.textures, 0);
  assert.deepEqual(report.errors, []);
  report.ok = true;
} finally {
  fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ ok: report.ok, output }));
