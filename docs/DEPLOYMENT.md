# Deploying Cozy Diver (Pass 060)

Cozy Diver is a **static site**: one HTML page, a bundled script and stylesheet, and local model and decoder files. It needs no server code, database, accounts or third-party services at runtime. Any static host works, such as GitHub Pages, Netlify, Cloudflare Pages, S3 with CloudFront, or nginx.

**Nothing has been deployed.** Publishing, tagging and merging all wait for explicit approval.

## Build

Requirements: Node 22.12 or newer, and npm.

```bash
npm ci
```

```bash
npm run build
```

The build writes `dist/`, about 36 MB (as of this pass):

| Path                                         | What                                                 | Changes per release?                     |
| -------------------------------------------- | ---------------------------------------------------- | ---------------------------------------- |
| `index.html`                                 | The page                                             | Yes                                      |
| `assets/index-<hash>.js`, `.css`             | The app (three.js bundled in), named by content hash | New name whenever content changes        |
| `assets/models/**.glb`                       | 46 original models (about 32 MB), fixed names        | Sometimes; requests carry `?v=<version>` |
| `assets/draco/`, `assets/basis/`             | Geometry and texture decoders (WASM)                 | Rarely (with three.js upgrades)          |
| `assets/LICENSE.txt`, `assets/manifest.json` | Art licence and inventory                            | With art changes                         |
| `third-party-notices.txt`                    | Licences for three.js, Draco and Basis               | With dependency changes                  |

**Build-time options:**

- `COZY_VERSION=0.8.0-beta.1 npm run build` sets the version shown in Settings and stamped on model requests. It defaults to `package.json`'s version. Give staging builds their own, for example `0.8.0-beta.1+staging.2`.
- `VITE_FEEDBACK_URL=https://… npm run build` sets where "Open the feedback form" leads. Without it, the link goes to the repository's issue form, which needs a GitHub account. **For a public beta, set this to a form that needs no account** (a decision for the owner).
- `npx vite build --base /cozy-diver/` deploys under a sub-path, such as GitHub Pages project sites. All asset and decoder URLs follow `import.meta.env.BASE_URL`.

## Caching

Model files keep fixed names, but every request carries the build's version (`chromis.glb?v=0.8.0-beta.1`). An update therefore always fetches fresh models, even from a long-lived cache, provided the host or CDN includes the query string in its cache key (most do by default).

| Path                                  | Cache-Control                            | Why                                                                                                        |
| ------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/`, `/index.html`                    | `no-cache`                               | Always revalidate, so a new release is picked up at once                                                   |
| `/assets/index-*.js`, `/assets/*.css` | `public, max-age=31536000, immutable`    | Content-hashed names                                                                                       |
| `/assets/models/*`                    | `public, max-age=31536000, immutable`    | Versioned by query. If the CDN ignores query strings, use `public, max-age=86400, must-revalidate` instead |
| `/assets/draco/*`, `/assets/basis/*`  | `public, max-age=86400, must-revalidate` | Fixed names, rarely change                                                                                 |
| Everything else                       | `public, max-age=3600`                   | Small text files                                                                                           |

Serve `.wasm` as `application/wasm` and `.glb` as `model/gltf-binary`. Most hosts do this already.

Example for Netlify or Cloudflare Pages (a `_headers` file published alongside `index.html`):

```
/
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/assets/index-*
  Cache-Control: public, max-age=31536000, immutable
/assets/models/*
  Cache-Control: public, max-age=31536000, immutable
/assets/draco/*
  Cache-Control: public, max-age=86400, must-revalidate
/assets/basis/*
  Cache-Control: public, max-age=86400, must-revalidate
```

Example for nginx:

```nginx
location = /index.html { add_header Cache-Control "no-cache"; }
location ~ ^/assets/(index-|models/) { add_header Cache-Control "public, max-age=31536000, immutable"; }
location ~ ^/assets/(draco|basis)/ { add_header Cache-Control "public, max-age=86400, must-revalidate"; }
types { application/wasm wasm; model/gltf-binary glb; }
```

There is no service worker, so nothing is held offline beyond the browser's ordinary HTTP cache. A visitor always gets the current release on their next visit.

## Saved data across updates

Everything a player keeps lives in their own browser's `localStorage`, under versioned keys (`cozy-diver.settings.v3`, `cozy-diver.tank.v1`, `cozy-diver.journal.v1`, `cozy-diver.visits.v1`, `cozy-diver.dived.v1`, `cozy-diver.onboarding.v1`).

- Each key is read on its own and validated.
- Older formats are migrated: settings v1 and v2, tank formats 1 and 2.
- Unknown fields from a newer build are ignored, never deleted.
- A damaged key costs only itself.

`tests/save-compatibility.test.ts` loads whole v0.5 and v0.6 profiles through the current code, and `validation/beta-smoke.mjs` checks a real update in a browser (below).

**Rule for future releases:** never rename or remove a storage key. Add a new versioned key and migrate from the old one. Saves are per site origin, so moving to a new domain starts players afresh. Avoid it during the beta.

## Staged deployment

1. **Candidate:** on the release branch, run the checks:

   ```bash
   npm ci
   ```

   ```bash
   npm run lint && npm run typecheck && npm run test && npm run build
   ```

2. **Local production check:** serve the build and run the smoke test in two phases. Phase two uses a second build with another version, to rehearse an update:

   ```bash
   COZY_VERSION=0.8.0-beta.1 npm run build && npx vite preview --port 4173 --strictPort
   ```

   ```bash
   COZY_URL=http://127.0.0.1:4173 COZY_PHASE=before COZY_PROFILE=/tmp/cozy-profile node validation/beta-smoke.mjs
   ```

   Then rebuild with `COZY_VERSION=0.8.0-beta.1+check`, restart the preview, and run again with `COZY_PHASE=after`.

3. **Staging:** deploy `dist/` to a private or unlisted URL, for example a preview deployment or a `staging.` subdomain. Play the [checklist](BETA_READINESS.md#release-blocker-checklist) on a Mac in Chrome and Safari.
4. **Beta:** with approval, deploy the **same** `dist/` (do not rebuild) to the beta URL. Keep the artifact: `tar czf cozy-diver-<version>.tgz dist`.
5. **Watch:** read feedback for the first days. Any blocker in the checklist means rollback.

## Rollback

Releases are immutable artifacts, so rolling back means redeploying the previous one:

1. Redeploy the previous `cozy-diver-<version>.tgz`, or re-run the previous deployment in the host's dashboard. Netlify, Cloudflare Pages and GitHub Pages all keep previous deployments.
2. `index.html` is `no-cache`, so visitors get the previous release on their next load. Models are re-requested under the previous version's `?v=`.
3. **Saves stay compatible both ways.** An older build ignores fields it does not know, and keeps them in place. One exception to check before rolling back: if a release added a new storage _format_ (not just fields), the older build cannot read it. Its data is then kept, not destroyed, and comes back when the newer release returns. The tank save already works this way for a "newer version" save.
4. Note the rollback in the beta notes, and re-run the smoke test against the restored URL.
