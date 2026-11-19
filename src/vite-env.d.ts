/// <reference types="vite/client" />

/** v0.8 Pass 060: the app version from package.json, stamped in by Vite (`vite.config.ts`). */
declare const __COZY_VERSION__: string;
interface ImportMetaEnv {
  /** v0.8 Pass 060: optional feedback form URL for the beta (see src/config/release.ts). */
  readonly VITE_FEEDBACK_URL?: string;
}
