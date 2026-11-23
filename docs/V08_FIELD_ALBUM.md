# V0.8 Pass 099 — Field Album

One page-turning trading-card album replaces the separate "Seen" list and the tank's creature/fish lists.

## Interaction guide

- **Opening it:** "Field album" on the pause screen, or "For your tank" → "Open the field album" while you are in the aquarium.
- **Moving around:**
  - The album opens on a contents spread.
  - Habitat tabs show how many you have found, for example "Kelp Forest 4/14".
  - Turn pages with ‹ ›, the Left/Right arrows, Page Up/Down, or a horizontal swipe of more than 60 px.
  - The album remembers your last page for the rest of the session.
- **Cards:**
  - A discovered card shows a live 3D model, the name, habitat and rarity (with silver or gold foil), a one-line note, and an "In your aquarium" badge when placed.
  - A mystery card shows only "?" and "Not yet found": no name, no model and no action.
- **Detail view:**
  - Select a card to open a large model. Drag it, or use ⟲/⟳, to turn it.
  - It shows when you first saw the creature.
  - In the aquarium it offers "Add to Aquarium" / "Return it to the sea". Fish add or return one at a time, with a count.
  - Elsewhere it suggests "Visit your aquarium…", and decorations point to the tank's own decoration list.
- **Closing:**
  - Escape closes the detail view, then the album.
  - Focus returns to the card you opened, then to the button that opened the album.
  - Tab stays inside the dialog.
- **Reduced motion:** turns off the page-turn animation and the spinning models.

## Architecture

| Module                            | Role                                                                                                                                                                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/collection/albumPages.ts`    | Pure page layout: 6 cards per page, 12 per spread, habitats never mixed, 13 spreads; clamped turning; session memory of the last page.                                                                                                               |
| `src/collection/descriptions.ts`  | The one-line note for each of the 96 entries.                                                                                                                                                                                                        |
| `src/collection/AlbumPreviews.ts` | Builds previews from each entry's canonical model (`acquireCollectionArt`, the fish rig, or the reef library node), using the same loaders and leases as the aquarium. One offscreen `WebGLRenderer` draws each card and copies it into a 2D canvas. |
| `src/ui/album/Album.ts`           | DOM, focus, keys, swipe, detail view and tank actions. It reads the journal and never writes to it.                                                                                                                                                  |
| `TankEditor.albumTank()`          | The tank actions, using the existing `addBaby`/`addFish` placement and capacity rules and the existing persistence.                                                                                                                                  |

## Performance observations (headless Chromium, SwiftShader only)

- **One WebGL context** for the whole album, whatever the number of cards.
- **Bounded previews:**
  - previews exist only for the visible spread and the detail view (at most 12 + 1);
  - at most 2 load at once, and at most 4 spinning cards are redrawn per frame.
- **Browsing:** browsing all 13 spreads three times gave renderer memory samples of 9, 31 and 29 geometries (textures 15/36/28). Memory did not grow.
- **Closing:** after closing, `album.previews` is null; the renderer is disposed and its context lost.
- **Not measured:** real-GPU and MacBook performance.

## Regression results

- `npm run typecheck`, `lint` and `build` are clean.
- `npm run test`: 115 files, 1149 tests, all passing. This includes the new `tests/album-pages.test.ts`.
- `validation/v08/album.mjs` (in the real game) passed. It:
  - opens the album from both entry points;
  - checks the tab counts and that mystery cards give nothing away;
  - turns pages by button, keys and swipe;
  - tests the detail view's drag, Escape and returning focus;
  - checks preview bounds and disposal;
  - adds and returns a blacktip and a royal gramma, checking the saved tank (version 3) each time;
  - confirms the journal is unchanged and there are no console errors.

Screenshots are in `docs/screenshots/v08-pass099/`. `page-turn-frames.png` shows six frames, 70 ms apart, from one page turn.

## Known limitations

- Rendering was checked only on SwiftShader.
- There is no jsdom, so the album's UI is covered only by the Playwright harness, not by unit tests.
- Decorations stay in the tank's own panel, as agreed.
- The old "Seen" panel markup is kept as a fallback for when the album is unavailable.
