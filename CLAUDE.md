# FreeMoCap room planner

A single-page planner for a low-cost markerless motion capture rig. It answers one question: for a room, a capture volume (called "capture space" on the page) and the number of cameras you have, where on the walls do they go, how many would cover the volume, what stays covered when one view is blocked, and which single stock M12 lens (and orientation) per sensor does most with that many cameras in that room? (The single-camera tool was removed on 17 Nov 2026.)

Read `HANDOFF.md` first for the current state, decisions, and open questions.

## Layout

```
index.html         The page: markup (form + results), the ?theme=dark|light switch, fonts and styles.css links.
src/main.js        DOM wiring, the worker pool, planning runs and rendering. Imports src/engine.js.
src/plan.worker.js Module worker: one ENGINE.plan() per message, for the pool in main.js.
src/engine.js      Pure coverage engine (no DOM), an ES module with named exports (page, worker, tests/, tools/).
src/styles.css     All styles. Colour tokens on :root with dark-mode overrides, values taken from docs.freemocap.org.
vite.config.js     Vite: ES-module workers, keep the terminal history.
tests/             engine.test.js (pinned numbers) + page.test.js (jsdom smoke test of main.js against index.html).
tools/             Ad-hoc scripts: lens sweep across rooms, orientation scan.
```

## Commands

```
npm install        # vite + jsdom (dev dependencies only)
npm run dev        # Vite dev server on http://localhost:5173 (?theme=dark or ?theme=light forces a theme)
npm run build      # vite build into dist/ (not committed)
npm run preview    # serve dist/ on http://localhost:4173
npm test           # engine checks + page smoke test (no build needed)
node tools/lens-sweep.js         # cameras needed per lens × volume size for 5/6/8 m rooms
node tools/orientation-scan.js   # where portrait beats landscape
```

## Conventions

- Keep `engine.js` free of DOM so it stays testable in node. Geometry/maths changes go there; rendering goes in `src/main.js`.
- The page asks the engine for `plan(sensor, f, o)` once per input (cached) and `withN(plan, n)` per slider move. Slider readouts update at once; `run()` in `main.js` plans after the next paint, in the worker pool (up to cores - 1 module workers, one `plan()` each; a plan is plain data and crosses by structured clone; newer input empties the queue, running jobs finish into the cache), or without `Worker` (jsdom, old browsers) one `plan()` at a time on the main thread with a pause between; it drops a run when newer input arrives (`runId`) and renders once; `#results` carries `aria-busy` meanwhile (CSS dims it only after 100 ms). The page test waits on that `aria-busy`. The turning slider has five stops (0 / 90 / 180 / 270 / 360°); `read()` snaps to them. With Auto it plans every `STOCK` lens in both orientations and `choose(plans, n)` keeps the one that does most at the slider count (order in `ahead()`: a layout with a face-on camera (`head`) first, then the score covered + back / 2 + hands / 4 at n, in whole percent capped at the target, then the covered / back / hands / blocked-view shares, then fewest to cover, then the score and shares at 20, then longer lens, then landscape; back and hands are parts of covered, so a lens cannot win on the back alone, and the blocked-view share is only a tie-break); a fixed lens uses the same choice between its two orientations, and the sensor pill uses `ahead()` too. `solve()` / `sweep()` are the quick cover search behind tools/lens-sweep.js (the page no longer shows a lens table; `pickLens()` is only used by tools/ and its test). No two cameras stand closer than `GAP` (0.4 m). The page does not judge fit / no fit: it reports the shares at the slider count, and gives the fewest cameras for a step only when some count up to 20 reaches it (a step none reaches is left unsaid).
- Plain ES modules built by Vite: no framework, no TypeScript, no CSS tooling. styles.css is linked from index.html, not imported in main.js, so main.js also loads in node (the page test). The only external resource is Google Fonts (JetBrains Mono; body text uses the system font stack, as docs.freemocap.org does).
- Engine speed: `tests/engine.test.js` pins results, so an optimisation must leave every plan identical (compare plans before and after, not just the tests).
- Colours only via the CSS tokens in `:root`; every token has light and dark values (`prefers-color-scheme` block plus `[data-theme="dark"]`). Don't add literal colours to components or SVG; use `var(--…)`.
- Inputs are saved to `localStorage` under `KEY` in `src/main.js` (currently `skellyplanner-v10`). Bump the key when inputs change meaning or defaults change, so stale saved state doesn't override new defaults.
- Camera 1 is face-on to the subject (within `AHEAD` = 10° of dead ahead, seen from the volume centre): on the front wall, or in the front-right corner with the subject turned 45° when that covers with fewer cameras; two offset cameras only when neither covers with any count (`plan()`'s `mode`: wall, corner, pair). Keep that order when changing placement.
- The rest are spent in steps: covered (each side triangulated + one camera within 45° of the front), then the back seen (a camera ≥ `REAR` = 90° round, and camera 3 is one), then hands behind the back (two such cameras in the pair band), then spares for blocked views. Cameras that do the same for those steps are split by the training views they stand for (`SHARE`, `ERR`, `trained()` in `engine.js`; numbers from ../skellybench/research/human-dataset-coverage). `plan()` builds every count in that order.
- The pair-angle band defaults to 30–120° (page input; the cover-search tests in `tests/engine.test.js` still pin 45–120°).
- Pixel pitch is 3.0 µm for both sensors (`P = 0.003` mm). Lengths in the engine are metres; focal lengths are mm. Camera positions are relative to the volume centre with the front wall at −y; `back` on a solve result is how far the volume centre sits behind the room centre.
- The pinned numbers in `tests/engine.test.js` are what the engine gave on 16 and 17 Nov 2026, not hand-checked (only the legacy 4-camera numbers were). If a model change moves them, that's expected, but update the test deliberately and note it in `HANDOFF.md`.
- Look: the page is meant to sit inside docs.freemocap.org (Docusaurus 3, Infima theme), so tokens, fonts, radii, tables and the admonition-style verdict follow that site's CSS (sources noted in `styles.css`).
- UI copy: written for beginners. Short sentences, common words, no explanation of how the planner decides. Name things the way the user would (cameras, lens, room, capture space, person). Order on the page: room and capture space, how far the person turns, cameras, the sensor, a collapsed "Advanced" block (lens pickers, gap to front wall, person and frame height, pose model crop, coverage angles and target); then the map with the camera table, the result for the sensor picked (one sentence on the other), and the count table for the sensor picked in a collapsed "More or fewer cameras". At 380×800 the top of the map shows on the first screen; keep it so.

## Running and publishing

There is no published copy any more (the claude.ai Artifact is retired). The page runs from the Vite dev server: `npm run dev`, then open http://localhost:5173. It is meant to be merged into docs.freemocap.org, a Docusaurus 3 site; `npm run build` gives the static files for that (dist/), with the plan worker as its own asset.
