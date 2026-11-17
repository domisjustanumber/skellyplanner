# Mocap Lens Calculator

A single-page planner for a low-cost markerless motion capture rig. It answers two questions:

1. **Room planner:** for a room, a capture volume and the number of cameras you have, where on the walls do they go, how many would cover the volume, what stays covered when one view is blocked, and which single stock M12 lens (and orientation) per sensor does most with that many cameras in that room?
2. **Single camera:** for one camera at given near/far distances, which focal lengths fit a full body and still give the pose model enough pixels?

Read `HANDOFF.md` first for the current state, decisions, and open questions.

## Layout

```
src/engine.js     Pure coverage engine (no DOM). Exported for node via module.exports.
src/page.js       DOM wiring, rendering, both modes. Uses the ENGINE global.
src/body.html     Page markup (form + results).
src/styles.css    All styles. Colour tokens on :root with dark-mode overrides.
src/head.html     <title>, viewport-fit meta, Google Fonts link.
build.js          Concatenates src/ into dist/index.html.
dev.js            Local dev server (no deps): watches src/, rebuilds, live-reloads.
dist/index.html   Built page; this is what gets published.
tests/            engine.test.js (pinned numbers) + page.test.js (jsdom smoke test).
tools/            Ad-hoc scripts: lens sweep across rooms, orientation scan.
```

## Commands

```
npm install        # jsdom, for the page test only
npm run build      # writes dist/index.html
npm run dev        # local server on http://localhost:5173, rebuilds + live-reloads on src/ changes (?theme=dark|light)
npm test           # build + engine checks + page smoke test
node tools/lens-sweep.js         # cameras needed per lens × volume size for 5/6/8 m rooms
node tools/orientation-scan.js   # where portrait beats landscape
```

## Conventions

- Keep `engine.js` free of DOM so it stays testable in node. Geometry/maths changes go there; rendering goes in `page.js`.
- The page asks the engine for `plan(sensor, f, o)` once per input (cached) and `withN(plan, n)` per slider move. With Auto it plans every `STOCK` lens in both orientations and `choose(plans, n)` keeps the one that does most at the slider count (order in `ahead()`: a layout with a face-on camera (`head`) first, then the score covered + back / 2 + hands / 4 at n, in whole percent capped at the target, then the covered / back / hands / blocked-view shares, then fewest to cover, then the score and shares at 20, then longer lens, then landscape; back and hands are parts of covered, so a lens cannot win on the back alone, and the blocked-view share is only a tie-break); a fixed lens uses the same choice between its two orientations, and the sensor pill uses `ahead()` too. `solve()` is the quick cover search behind the lens sweep table (a general comparison; `pickLens()` is only used by tools/ and its test). No two cameras stand closer than `GAP` (0.4 m). The page does not judge fit / no fit: it reports the shares at the slider count, and gives the fewest cameras for a step only when some count up to 20 reaches it (a step none reaches is left unsaid).
- `dist/index.html` must stay one self-contained file: no build-time bundler, no external scripts. The only external resource is Google Fonts (IBM Plex Sans, Sans Condensed, Mono). It's published as a claude.ai Artifact, which wraps it in `<html>/<head>/<body>`, so the source has none of those tags.
- Colours only via the CSS tokens in `:root`; every token has light and dark values (`prefers-color-scheme` block plus `[data-theme="dark"]`). Don't add literal colours to components or SVG; use `var(--…)`.
- Inputs are saved to `localStorage` under `KEY` in `page.js` (currently `mocap-lens-calc-v8`). Bump the key when inputs change meaning or defaults change, so stale saved state doesn't override new defaults.
- Camera 1 is face-on to the subject (within `AHEAD` = 10° of dead ahead, seen from the volume centre): on the front wall, or in the front-right corner with the subject turned 45° when that covers with fewer cameras; two offset cameras only when neither covers with any count (`plan()`'s `mode`: wall, corner, pair). Keep that order when changing placement.
- The rest are spent in steps: covered (each side triangulated + one camera within 45° of the front), then the back seen (a camera ≥ `REAR` = 90° round, and camera 3 is one), then hands behind the back (two such cameras in the pair band), then spares for blocked views. Cameras that do the same for those steps are split by the training views they stand for (`SHARE`, `ERR`, `trained()` in `engine.js`; numbers from ../skellybench/research/human-dataset-coverage). `plan()` builds every count in that order.
- The pair-angle band defaults to 30–120° (page input; the cover-search tests in `tests/engine.test.js` still pin 45–120°).
- Pixel pitch is 3.0 µm for both sensors (`P = 0.003` mm). Lengths in the engine are metres; focal lengths are mm. Camera positions are relative to the volume centre with the front wall at −y; `back` on a solve result is how far the volume centre sits behind the room centre.
- The pinned numbers in `tests/engine.test.js` are what the engine gave on 16 and 17 Nov 2026, not hand-checked (only the legacy 4-camera numbers were). If a model change moves them, that's expected, but update the test deliberately and note it in `HANDOFF.md`.
- UI copy: plain, direct sentences; name things the way the user would (cameras, lens, volume, room).

## Publishing

The live page is the claude.ai Artifact "Mocap Lens Calculator" (https://claude.ai/artifact/2wTAdDdKcxD1nUX9dA2qmr, version 4 at handoff). After `npm run build`, republish `dist/index.html` to that same artifact so the link stays the same. If you can't publish from here, the owner can paste `dist/index.html` into a claude.ai chat and ask for that artifact to be updated.
