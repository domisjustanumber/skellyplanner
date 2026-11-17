# Room planner: method and results

The current default mode. Code: `layout()`, `placeCameras()`, `evaluate()`, `solve()`, `sweep()`, `pickLens()` in `src/engine.js`.

## Decisions (made with the owner)

- First two cameras at 0° (front) and 45°. The rest are spread evenly over the remaining 315°.
- Partial coverage per camera is fine. Cameras don't each need to see the whole volume, so the count grows with volume size.
- Room size is an input. Cameras stand between the volume edge and the wall.
- Cheapest means fewest cameras. No prices.

## Method

**Layout.** For n cameras the angles round the volume centre are 0°, 45°, then 45° + k · 315/(n−1) for k = 1…n−2. For example n = 4 gives 0°, 45°, 150°, 255°; n = 5 gives 0°, 45°, 123.75°, 202.5°, 281.25°.

**Placement.** Each camera sits on the ray from the volume centre at its angle, aimed at the centre. Its distance is picked on its own, in 0.1 m steps from just outside the volume to 5 cm from the wall, to see as many grid points as possible. Ties go to the farther position. This is greedy: pairs aren't optimised jointly.

**Coverage.** A grid point is covered when at least two cameras see it and some pair of them is 30–90° apart, measured at the point. Coverage is the covered share of a 25 × 25 grid (13 × 13 in sweeps, for speed). Default target is 100%.

**Camera count.** `solve()` tries n = 2…12 and returns the first n that hits the target. The layout changes with n, so more cameras doesn't always mean more coverage.

**Lens pick.** `sweep()` solves square volumes from 1.5 m to (shorter room side − 1 m) in 0.5 m steps, for every lens, in both orientations. `pickLens()` ranks by most sizes solved, then fewest total cameras, then the longer lens (more pixels), then landscape. A lens that fails at one size is assumed to fail at all larger sizes.

## Pinned results

256 px crop, 30–90° band, 100% coverage, 25 × 25 grid. These are in `tests/engine.test.js` and were checked by hand with the owner.

| Room | Volume | AR0234 | OV9281 |
|---|---|---|---|
| 6 × 6 m | 3 × 3 m | 4 cameras, 2.8 mm landscape | 5 cameras, 2.5 mm landscape |
| 6 × 6 m | 5 × 4 m | 5 cameras, 2.8 mm | 9 cameras, 2.5 mm |

## Best single lens per room (256 px crop)

| Room | AR0234 | OV9281 |
|---|---|---|
| 3.5 m | 2.1 mm portrait | 2.1 mm portrait |
| 4 m | 2.1 mm | 2.1 mm |
| 5 m | 2.5 mm | 2.1 mm |
| 6 m | 2.8 mm | 2.5 mm |
| 8 m | 3.6 mm | 3.6 mm |

Landscape unless marked. Bigger rooms favour longer lenses because cameras can stand farther back, where a longer lens's band sits.

## Full sweeps (landscape, 256 px crop)

Output of `node tools/lens-sweep.js`. Cameras needed for a square volume of each side (m). A dot means 12 cameras aren't enough (or a smaller size already failed). 13 × 13 grid, so individual cells can differ by one from a 25 × 25 solve. Bold row is the pick.

### 5 × 5 m room

AR0234

| f \ L | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 |
|---|---|---|---|---|---|---|
| 2.1 | 2 | 4 | 4 | 6 | 6 | 6 |
| **2.5** | 2 | 4 | 4 | 4 | 4 | 5 |
| 2.8 | 4 | 4 | 4 | 4 | 5 | 5 |
| 3.2 | 5 | 5 | 4 | 5 | 5 | 5 |
| 3.6 | 5 | 5 | 5 | 5 | 5 | 7 |
| 4.0 | 5 | 5 | 5 | 5 | 6 | 8 |
| 6.0 | · | · | · | · | · | · |

OV9281

| f \ L | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 |
|---|---|---|---|---|---|---|
| **2.1** | 4 | 5 | 5 | 6 | 6 | 6 |
| 2.5 | 5 | 5 | 5 | 5 | 5 | 8 |
| 2.8 | 5 | 5 | 5 | 6 | 6 | 8 |
| 3.2 | 8 | 8 | 8 | 8 | 8 | 8 |
| 3.6 | 8 | 8 | 8 | 8 | 8 | · |
| 4.0 | · | · | · | · | · | · |
| 6.0 | · | · | · | · | · | · |

### 6 × 6 m room

AR0234

| f \ L | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5 |
|---|---|---|---|---|---|---|---|---|
| 2.1 | 2 | 2 | 4 | 5 | 7 | 7 | 10 | 9 |
| 2.5 | 2 | 2 | 4 | 4 | 6 | 6 | 6 | 6 |
| **2.8** | 2 | 2 | 4 | 4 | 4 | 4 | 5 | 5 |
| 3.2 | 2 | 4 | 4 | 4 | 4 | 5 | 5 | 6 |
| 3.6 | 2 | 4 | 4 | 4 | 5 | 5 | 5 | 7 |
| 4.0 | 5 | 5 | 5 | 5 | 5 | 5 | 8 | 8 |
| 6.0 | 8 | 8 | 8 | 8 | 8 | 8 | · | · |

OV9281

| f \ L | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5 |
|---|---|---|---|---|---|---|---|---|
| 2.1 | 2 | 4 | 6 | 6 | 8 | 8 | 10 | 10 |
| **2.5** | 4 | 5 | 4 | 5 | 6 | 6 | 6 | 10 |
| 2.8 | 5 | 5 | 5 | 5 | 5 | 6 | 8 | 8 |
| 3.2 | 5 | 5 | 5 | 5 | 6 | 8 | 8 | 8 |
| 3.6 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 10 |
| 4.0 | 8 | 8 | 8 | 8 | 8 | 8 | · | · |
| 6.0 | · | · | · | · | · | · | · | · |

### 8 × 8 m room

AR0234

| f \ L | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5 | 5.5 | 6 | 6.5 | 7 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2.1 | 2 | 2 | 4 | 5 | 6 | 8 | 12 | · | · | · | · | · |
| 2.5 | 2 | 2 | 2 | 4 | 5 | 6 | 7 | 10 | 10 | · | · | · |
| 2.8 | 2 | 2 | 2 | 4 | 4 | 6 | 6 | 8 | 8 | 8 | 10 | 10 |
| 3.2 | 2 | 2 | 2 | 4 | 4 | 5 | 6 | 6 | 6 | 6 | 7 | 8 |
| **3.6** | 2 | 2 | 2 | 4 | 4 | 4 | 5 | 5 | 6 | 6 | 7 | 8 |
| 4.0 | 2 | 2 | 2 | 4 | 4 | 5 | 5 | 5 | 5 | 6 | 8 | 8 |
| 6.0 | 5 | 5 | 5 | 5 | 5 | 7 | 8 | 8 | 8 | 11 | · | · |

OV9281

| f \ L | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5 | 5.5 | 6 | 6.5 | 7 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2.1 | 2 | 2 | 5 | 7 | 8 | · | · | · | · | · | · | · |
| 2.5 | 2 | 2 | 2 | 5 | 8 | 8 | · | · | · | · | · | · |
| 2.8 | 2 | 2 | 2 | 6 | 6 | 6 | 6 | 8 | 10 | · | · | · |
| 3.2 | 2 | 4 | 4 | 4 | 5 | 5 | 6 | 8 | 8 | · | · | · |
| **3.6** | 5 | 5 | 5 | 5 | 5 | 5 | 8 | 8 | 8 | 8 | 8 | · |
| 4.0 | 5 | 5 | 5 | 5 | 5 | 7 | 8 | 8 | 8 | 11 | · | · |
| 6.0 | 8 | 8 | 8 | · | · | · | · | · | · | · | · | · |

## What the sweeps show

- **AR0234 beats OV9281 at every room size**, and the gap widens with the volume. In the 8 m room the AR0234 on 3.6 mm reaches a 7 m volume with 8 cameras; the OV9281 tops out at 6.5 m. In the 6 m room at a 5 m volume it's 5 vs 10.
- **Short lenses are cheap for small volumes, but run out of reach.** 2.1 mm often solves small volumes with 2 cameras, then fails early as the volume grows, because its far limit is only 4.9 m.
- **Long lenses can't get close enough.** 6 mm fails outright in 5 m rooms: its near limit (3.7 m AR0234, 5.5 m OV9281) doesn't fit between volume and wall.
- **Two cameras are enough for small volumes** because only one good pair per point is needed. There's no requirement to see the subject from all sides (see [06-open-questions.md](06-open-questions.md)).
- **Counts aren't always monotonic** (e.g. OV9281 2.5 mm in the 6 m room: 4, 5, 4, 5; AR0234 2.1 mm: 10 then 9). Adding a camera moves all the others, and greedy placement can land on a better or worse arrangement by chance.
- **Camera counts jump in steps** (2 → 4 → 5 → 8 is common). This is the layout: some n values happen to give better pair angles than their neighbours.
