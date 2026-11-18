/**
 * v0.8 Pass 060 (public beta readiness): what this build is, and where beta testers send
 * feedback. Nothing is sent anywhere automatically.
 */
export const VERSION: string =
  typeof __COZY_VERSION__ === 'string' ? __COZY_VERSION__ : 'development';
/**
 * Where "Send beta feedback" leads. Set `VITE_FEEDBACK_URL` at build time (for example a form
 * that needs no account); without it, the repository's issues page is used.
 */
export const FEEDBACK_URL: string =
  import.meta.env.VITE_FEEDBACK_URL ||
  'https://github.com/bryce496913/Cozy-Dive/issues/new?template=beta-feedback.yml';
/**
 * Model URLs carry the version, so a browser or CDN that cached a model under a long lifetime
 * fetches the new one after an update (the files themselves keep fixed names).
 */
export function versioned(url: string, version = VERSION): string {
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
}
/**
 * A short, private-by-default note for a feedback report: no identifiers, no location, no saved
 * data. The tester sees it before choosing to copy it.
 */
export function diagnostics(info: {
  version: string;
  userAgent: string;
  renderer: string;
  viewport: [number, number];
  pixelRatio: number;
  frame: string | null;
}): string {
  return [
    `Cozy Diver ${info.version}`,
    `Browser: ${info.userAgent}`,
    `Graphics: ${info.renderer}`,
    `Window: ${info.viewport[0]}×${info.viewport[1]} at ${info.pixelRatio}×`,
    info.frame ? `Frame time: ${info.frame}` : null,
  ]
    .filter((l): l is string => l !== null)
    .join('\n');
}
