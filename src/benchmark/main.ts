import '../style.css';
import { Application } from '../app/Application';
import { AssetLoader } from '../assets/AssetLoader';
import { ReefShowcase } from './ReefShowcase';
import type { UnderwaterScene } from '../rendering/UnderwaterScene';

const panel = document.createElement('aside');
panel.style.cssText =
  'position:fixed;top:92px;left:24px;pointer-events:none;z-index:10;background:#092f39e8;border:1px solid #93b6b655;padding:12px 16px;border-radius:8px;color:#dce9e5;font:13px system-ui;max-width:330px';
panel.innerHTML =
  '<strong>Pass 012 · Visual benchmark</strong><p role="status" id="asset-state">Loading locally bundled GLB assets…</p><button id="compare" disabled>View original chromis / coral</button> <a href="/" style="color:#b4d4d0">Normal aquarium</a><small style="display:block;margin-top:8px">Development showcase. Enter to swim. Escape to compare. Chromis reference; hero geometry review pending.</small>';
document.body.append(panel);
const status = panel.querySelector<HTMLElement>('#asset-state')!,
  button = panel.querySelector<HTMLButtonElement>('#compare')!;
button.style.pointerEvents = 'auto';
panel.querySelector<HTMLAnchorElement>('a')!.style.pointerEvents = 'auto';
// Created once the world exists: KTX2 textures need the renderer to pick a GPU transcode format.
let loader: AssetLoader | undefined;
let world: UnderwaterScene | undefined;
// The benchmark stays underwater (the office is the v0.3 default for the normal aquarium).
const app = new Application(
  document.querySelector<HTMLDivElement>('#app')!,
  (value, state) => {
    world = value;
    const coral = value.aquarium.hardscape.formations.find(
      (f) => f.kind === 'branching' && f.role === 'stony-coral',
    )!;
    Object.assign(state.position, {
      x: coral.position.x - 1.1,
      y: coral.position.y + 1.7,
      z: coral.position.z + 3.6,
    });
    state.neutralDepth = state.position.y;
  },
  { startMode: 'aquarium' },
);
let showcase: ReefShowcase | undefined,
  upgraded = true,
  disposed = false;
async function load(): Promise<void> {
  if (!world) return;
  loader = new AssetLoader(
    undefined,
    (id, state) => {
      status.textContent = `${id}: ${state} · local asset cache`;
    },
    world.renderer,
  );
  try {
    showcase = await ReefShowcase.create(world, loader);
    if (disposed) {
      showcase.dispose();
      return;
    }
    world.setPresentation(showcase);
    status.textContent = 'GLB assets ready · chromis school + branching coral';
    button.disabled = false;
  } catch (error) {
    status.textContent =
      'Asset load failed. Procedural aquarium remains playable. See console for details.';
    console.error('Visual benchmark uses fallback.', error);
  }
}
button.addEventListener('click', () => {
  upgraded = !upgraded;
  showcase?.setUpgraded(upgraded);
  button.textContent = upgraded
    ? 'View original chromis / coral'
    : 'View benchmark assets';
});
void load();
const dispose = () => {
  if (disposed) return;
  disposed = true;
  app.dispose();
  loader?.dispose();
  panel.remove();
};
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);
// This entry is built only in explicit benchmark mode. No inspection API enters the normal game.
Object.assign(window, {
  __visualBenchmark: {
    app,
    get world() {
      return world;
    },
    get showcase() {
      return showcase;
    },
    get loader() {
      return loader;
    },
    dispose,
  },
});
