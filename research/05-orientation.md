# Landscape vs portrait

Turning the camera on its side changes the trade-off between fitting a full body close up and covering width.

## What portrait changes

| | Landscape | Portrait |
|---|---|---|
| Near limit | `cov · f / (pxV · p)` | 0.625× landscape (more vertical pixels, so a full body fits closer) |
| Far limit | `H · f / (crop · p)` | same |
| Depth band far/near | AR 3.84×, OV 2.56× (256 px) | AR 6.14×, OV 4.09× |
| Horizontal FOV | wide | narrow (the old vertical FOV) |

So portrait gets a deeper band and lets cameras stand closer, but each camera covers a much narrower slice of the volume.

## How the calculator chooses

- **Room planner:** every lens is tried in both orientations; the sweep pick decides. With a fixed lens, the orientation needing fewer cameras for the volume is used (ties go to the one with more coverage).
- **Single camera:** landscape if it works at the given near and far distances; portrait only if landscape can't fit the full body.

## Where portrait wins

Output of `node tools/orientation-scan.js`. Best lens per room and crop across both orientations. The list in brackets is cameras needed for square volumes from 1.5 m in 0.5 m steps (· = not solvable with 12).

**256 px crop**

| Room | AR0234 | OV9281 |
|---|---|---|
| 3.5 m | 2.1 mm **portrait** [4 5 5] | 2.1 mm **portrait** [5 8 8] |
| 4 m | 2.1 mm landscape [4 4 4 5] | 2.1 mm landscape [5 5 5 6] |
| 5 m | 2.5 mm landscape [2 4 4 4 4 5] | 2.1 mm landscape [4 5 5 6 6 6] |
| 6 m | 2.8 mm landscape [2 2 4 4 4 4 5 5] | 2.5 mm landscape [4 5 4 5 6 6 6 10] |
| 8 m | 3.6 mm landscape [2 2 2 4 4 4 5 5 6 6 7 8] | 3.6 mm landscape [5 5 5 5 5 5 8 8 8 8 8 ·] |

**384 px crop**

| Room | AR0234 | OV9281 |
|---|---|---|
| 3.5 m | 2.5 mm landscape [5 5 5] | 2.1 mm **portrait** [5 8 8] |
| 4 m | 2.8 mm landscape [5 5 5 5] | 2.8 mm landscape [8 8 8 8] |
| 5 m | 3.6 mm landscape [5 5 5 5 5 7] | 3.2 mm landscape [8 8 8 8 8 12] |
| 6 m | 3.6 mm landscape [2 4 5 5 6 6 6 10] | 4.0 mm landscape [8 8 8 8 8 8 · ·] |
| 8 m | 6.0 mm landscape [5 5 5 5 5 7 8 8 8 11 · ·] | 4.0 mm landscape [5 6 7 7 7 11 · · · · · ·] |

## Findings

- **Portrait only wins in about 3.5 m rooms**, where there isn't enough distance for a landscape camera to fit a full body. From 4 m up, landscape wins everywhere for both sensors.
- **A bigger crop pushes the lens longer.** At 384 px the far limit drops by a third, so the best lens moves up one or two steps (6 m room AR0234: 2.8 → 3.6 mm) and the camera count rises, sharply for the OV9281 (mostly 8 cameras even for small volumes).
- **The OV9281 at 384 px is a poor fit** in every room size: its depth band is only 1.7× in landscape.
