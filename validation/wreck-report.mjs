/** Condense the route's raw, reproducible observations without treating synthetic time as FPS. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const input = process.argv[2] || '/tmp/cozy-wreck-complete/report.json';
const report = JSON.parse(fs.readFileSync(input, 'utf8'));
assert.equal(report.success, true, report.failure);
const stats = (values) => {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  const pick = (p) =>
    v[Math.min(v.length - 1, Math.floor((v.length - 1) * p))] ?? null;
  return {
    count: v.length,
    min: v[0] ?? null,
    p50: pick(0.5),
    p95: pick(0.95),
    max: v.at(-1) ?? null,
  };
};
const bursts = [];
let burst = [];
for (const s of report.samples) {
  if (s.measured && s.world === 'wreck') burst.push(s);
  else if (burst.length) {
    if (burst.length >= 20) bursts.push(burst);
    burst = [];
  }
}
if (burst.length >= 20) bursts.push(burst);
assert.equal(bursts.length, 3, 'three first-cycle consecutive timing bursts');
const profile = bursts.map((samples, i) => ({
  space: ['deck', 'hold', 'bridge'][i],
  // Discard the first interval, which spans a preceding automated navigation/observation step.
  consecutiveWallFrameMs: stats(samples.slice(1, 20).map((s) => s.wallFrameMs)),
  tickSubmitMs: stats(samples.slice(0, 20).map((s) => s.ms)),
  drawCalls: stats(samples.slice(0, 20).map((s) => s.calls)),
  triangles: stats(samples.slice(0, 20).map((s) => s.triangles)),
  largestIntervals: samples
    .slice(1, 20)
    .map((s) => s.wallFrameMs)
    .sort((a, b) => b - a)
    .slice(0, 3),
}));
const summary = {
  base: 'bca42b912af7a35e4adcac79705eca79dee5a872',
  method: report.method,
  initialLoadMs: report.initialLoadMs,
  success: report.success,
  errors: report.errors,
  expectedErrors: report.expectedErrors.length,
  baseline: report.baseline,
  released: report.cycles,
  loadingWaits: report.checkpoints.filter((c) => 'wallMs' in c),
  profile,
  presentedByWorld: Object.fromEntries(
    ['aquarium', 'outer', 'kelp', 'wreck'].map((world) => {
      const samples = report.samples.filter(
        (s) => s.world === world && s.presented,
      );
      return [
        world,
        {
          samples: samples.length,
          drawCalls: stats(samples.map((s) => s.calls)),
          triangles: stats(samples.map((s) => s.triangles)),
          tickSubmitMs: stats(samples.map((s) => s.ms)),
        },
      ];
    }),
  ),
  maxObservedSchedulerGapMs: Math.max(
    ...report.samples.map((s) => s.wallFrameMs ?? 0),
  ),
  crossings: report.crossings.map((c) => ({
    from: c.before.world,
    to: c.after.world,
    beforeDark: c.before.dark,
    afterDark: c.after.dark,
  })),
  deckCollision: report.deckCollision,
  marineLife: report.marineLife,
  partialFailure: report.partialFailure,
  returnedOffice: report.checkpoints.find((c) => c.name === 'returned-office'),
};
console.log(JSON.stringify(summary, null, 2));
