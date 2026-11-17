# v0.6 Pass 042 — Barracuda in the blue (`0.6.0-rc.3`)

Date: November 17, 2026. By user request. No merge or release is authorized by this note.

## Changes

- **Great barracuda (new model):** authored in Blender (`tools/art/pass042/barracuda.py`, using Pass 025 and 033 helpers). It is about 1.5 m long and slender, with a jutting lower jaw, two small dorsal fins far apart and a forked tail. It is silver, darker above, with dusky bars, dark spots towards the tail and a dark tail. The model has 10k triangles; `Body_LOD1` has 1.6k. Compressed to 523 KB and added to the manifest.
- **A circling school (`BarracudaVisit`, `BarracudaSchool`):**
  - **Where:** 40 barracuda in a slowly turning column, 3–5.4 m across its rings and about 4.5 m tall, centred 10.5 m beyond the glass at one of four spots along it.
  - **When:** it isn't there when you arrive. After a first wait (25–90 s), then every 2–3.5 minutes, there is a 30 % chance it comes.
  - **How it comes and goes:** it drifts in from 36 m out (always in the haze), circles for about 2–3 minutes, then drifts back out. While away it isn't drawn.
  - **Drawing:** one instanced draw of the light model, each fish with its own tail stroke.
  - **Sighting:** a new sighting, "Great barracuda", counted when you look at the column from near the glass.
- **Closer far passes:** the far lane for every large creature in the blue (reef cruisers and wall visitors) now keeps the animal's near side 6.5 m beyond the glass, down from 9 m.

## Checks

- `npm run typecheck`, `npm run lint`, `npm run build`: pass.
- `npm run test`: 569 passing, including new tests. The school comes now and then over an hour of simulated time, every fish stays beyond the glass, it is away and hidden in the haze on arrival, and the far lane is closer than before.
- **Browser check** (`validation/barracuda.mjs`, SwiftShader in headless Chromium at DPR 0.5) passes with no page errors:
  - the school is away and not drawn on arrival;
  - brought in on cue, it drifts in from the haze and is circling about 28 s later;
  - looked at from the glass in front of it, it counts as seen;
  - sent away, it drifts out and is hidden again.
- **Screenshot:** `docs/screenshots/pass042/barracuda-circling.png`.
- **Not measured:** real-GPU frame time with the school present.

## Known limitations

- The column overlaps the depth band of the big animals' far lanes, so a far-passing animal can swim through it.
- The column's chance and timing are tuned by eye, not measured against how long you usually stay at the glass.
