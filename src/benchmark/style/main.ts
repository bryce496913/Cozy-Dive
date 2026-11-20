/**
 * V0.7 Pass 062: style benchmark entry (`style-benchmark.html`). Development-only: built only by
 * `npm run build:benchmark`, never part of the game. Choose the asset treatment, the lighting
 * treatment and the camera view independently; each change reloads the page with the new query so
 * every combination starts from the same clean state.
 *
 *   /style-benchmark.html?assets=crafted&lighting=crafted&view=medium
 *   &ui=0 hides the panel and stops the animation loop; captures call `__styleBench.render(t)`.
 */
import '../../style.css';
import { StyleBench, type BenchStats } from './StyleBench';
import {
  TREATMENTS,
  TREATMENT_LABELS,
  VIEWS,
  parseSelection,
  type Selection,
} from './treatments';

const selection = parseSelection(location.search);
const host = document.createElement('main');
host.style.cssText = 'position:fixed;inset:0;background:#0b2a33';
document.body.append(host);

const panel = document.createElement('form');
panel.setAttribute('aria-label', 'Style benchmark treatment');
panel.style.cssText =
  'position:fixed;top:16px;left:16px;z-index:10;display:grid;gap:8px;max-width:min(360px,calc(100vw - 32px));' +
  'background:#082a33e8;border:1px solid #93b6b655;padding:12px 14px;border-radius:8px;color:#dce9e5;font:13px system-ui';
const status = document.createElement('p');
status.setAttribute('role', 'status');
status.style.margin = '0';
status.textContent = 'Loading benchmark models…';

function select(
  label: string,
  key: keyof Pick<Selection, 'assets' | 'lighting' | 'view'>,
  options: readonly { value: string; text: string }[],
): HTMLLabelElement {
  const wrap = document.createElement('label');
  wrap.style.cssText =
    'display:grid;grid-template-columns:5.5em 1fr;align-items:center;gap:8px';
  wrap.textContent = label;
  const input = document.createElement('select');
  input.name = key;
  for (const o of options) input.add(new Option(o.text, o.value));
  input.value = selection[key];
  input.addEventListener('change', () => {
    const q = new URLSearchParams(location.search);
    q.delete('style');
    q.set(key, input.value);
    location.search = q.toString();
  });
  wrap.append(input);
  return wrap;
}

const treatments = TREATMENTS.map((t) => ({
  value: t,
  text: TREATMENT_LABELS[t],
}));
panel.append(
  Object.assign(document.createElement('strong'), {
    textContent: 'V0.7 Pass 062 · Style benchmark',
  }),
  select('Models', 'assets', treatments),
  select('Lighting', 'lighting', treatments),
  select(
    'View',
    'view',
    VIEWS.map((v) => ({ value: v.id, text: `${v.id} (${v.distance})` })),
  ),
  status,
);
panel.addEventListener('submit', (e) => e.preventDefault());
if (selection.ui) document.body.append(panel);

function describe(stats: BenchStats): string {
  return `${TREATMENT_LABELS[selection.assets]} models · ${TREATMENT_LABELS[selection.lighting]} lighting · ${stats.calls} draws · ${(stats.triangles / 1e6).toFixed(2)} M triangles`;
}

let bench: StyleBench | undefined;
let frame = 0;
let disposed = false;
const resize = () =>
  bench?.resize(
    host.clientWidth || innerWidth,
    host.clientHeight || innerHeight,
  );
const ready = StyleBench.create(host, selection).then(
  (value) => {
    if (disposed) {
      value.dispose();
      return value;
    }
    bench = value;
    resize();
    value.render(0);
    status.textContent = describe(value.stats());
    if (selection.ui) {
      const start = performance.now();
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const loop = (now: number) => {
        value.render(reduced ? 0 : (now - start) / 1000);
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    }
    return value;
  },
  (error: unknown) => {
    status.textContent = `Benchmark failed to load: ${error instanceof Error ? error.message : String(error)}`;
    status.style.color = '#ffb4a8';
    document.body.append(panel);
    throw error;
  },
);
addEventListener('resize', resize);
const dispose = () => {
  if (disposed) return;
  disposed = true;
  cancelAnimationFrame(frame);
  removeEventListener('resize', resize);
  bench?.dispose();
  panel.remove();
  host.remove();
};
addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);
// Benchmark-only inspection hook (this entry never ships with the game).
Object.assign(window, {
  __styleBench: {
    selection,
    ready: ready.then(() => true),
    render(t: number) {
      bench?.render(t);
    },
    view(id: Selection['view']) {
      bench?.setView(id);
    },
    stats() {
      return bench?.stats();
    },
    dispose,
  },
});
