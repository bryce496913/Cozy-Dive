# Hotfix: pop-in entering the outer reef (draw distance)

**Problem (playtest):** coming out of the tunnel, reef pieces visibly appeared. The murk was meant to hide distant changes, but the draw distances had been shortened along with it. Corals, plates and plants stopped being drawn at 14 m and shells at 10 m, which is still inside the murk you can see into (about 4% and 18% of their colour came through). The camera's far plane was 25 m, so large pieces could also be clipped at its edge.

**Fix:** the murk is unchanged (`OUTER.fog` 0.13). The draw distance is longer, so the reef is already being drawn before it can be seen:

|                                            | Before  | After                                                          |
| ------------------------------------------ | ------- | -------------------------------------------------------------- |
| Camera far plane                           | 25 m    | **45 m**                                                       |
| Corals, plates, plants, shells: last drawn | 10–14 m | **20 m** at full detail, then corals as low mounds to **30 m** |
| Rocks: last drawn                          | 24 m    | **30 m** (their 1.3k-triangle level)                           |
| Backdrop silhouettes                       | 32 m    | **36 m**                                                       |

Nothing appears, vanishes or changes shape nearer than 20 m, where the haze lets through only about 0.1% of an object's colour. The near detail switches (a few metres away) are unchanged. `tests/outer-draw-distance.test.ts` ties these distances to the fog density, so they cannot drift apart again.

**Measured** (Chromium on SwiftShader, the same views and script before and after):

| View           | Triangles before | Triangles after | Draw calls before → after | Frame (median, software) before → after |
| -------------- | ---------------: | --------------: | ------------------------- | --------------------------------------- |
| Tunnel mouth   |           0.98 M |          1.73 M | 90 → 115                  | 26 → 27 ms                              |
| Reef top       |           1.20 M |          1.97 M | 113 → 129                 | 16 → 21 ms                              |
| Lip            |           1.63 M |          2.56 M | 115 → 129                 | 22 → 22 ms                              |
| Coral close    |           1.76 M |          2.60 M | 116 → 124                 | 22 → 20 ms                              |
| Along the reef |           1.91 M |          2.57 M | 116 → 133                 | 22 → 18 ms                              |

The longer reach costs 35–77% more triangles. Drawing every coral at full detail out to 30 m measured 2.7–3.5 M; the mounds beyond 20 m saved about a quarter of that. Real-GPU cost is unmeasured. If a laptop struggles, Settings → Graphics detail → Lighter applies, and the mound distance (`OUTER_DETAIL.hidden`) can come in towards 18 m.

Swimming out of the tunnel, before and after: [swim-out-of-tunnel.png](screenshots/hotfix-outer-draw-distance/swim-out-of-tunnel.png).
