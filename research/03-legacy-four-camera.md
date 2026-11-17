# Legacy model: four cameras round a square

The first volume model, built before the room planner and since replaced. Its closed form is kept as a regression check in `tests/engine.test.js`.

## Setup

One camera centred on each side of an L × L square volume, each at standoff s from its side, aimed at the centre. Each camera must see the whole volume. The lens is chosen freely for each s, so the question is: what is the largest L for a given standoff?

## Derivation

Two limits, both with the best f for that s:

1. **Depth.** The near side of the volume is at depth s, the far side at s + L. Full body at s needs `f ≤ s · pxV · p / cov`. Enough pixels at s + L needs `s + L ≤ H · f / (crop · p)`. Using the largest allowed f:

   `L ≤ H · pxV · s / (cov · crop) − s`

2. **Width.** At depth s the horizontal field must span L: `L ≤ s · pxH · p / f`. With the smallest f that still gives enough pixels at the far side, `f = crop · p · (s + L) / H`, this becomes `L² + sL − s · pxH · H / crop ≤ 0`:

   `L ≤ (−s + √(s² + 4 · s · pxH · H / crop)) / 2`

Max L is the smaller of the two.

## Results (H = 1.8 m, cov = 2.2 m)

| Standoff s (m) | 1.5 | 2.0 | 2.5 | 3.0 |
|---|---|---|---|---|
| OV9281, 256 px crop: max L (m) | 2.3 | 3.1 | 3.7 | 3.9 |
| AR0234, 256 px crop: max L (m) | 3.8 | 4.3 | 4.7 | 5.0 |

The AR0234 at a 384 px crop gives the same numbers as the OV9281 at 256 px, because its depth-band ratio is the same (2.56×, see [02-optics-model.md](02-optics-model.md)).

## Why it was dropped

- **Bad pair angles.** Neighbouring cameras are 90° apart and opposite ones 180°. Samani 2026 found pairs past about 90° perform poorly (see [01-literature.md](01-literature.md)), so most of the pairs in this layout are weak.
- **Fixed count.** Four cameras regardless of volume size; there's no way to scale by adding cameras.
- **Every camera must see everything**, which caps the volume hard. The room planner allows partial coverage per camera and lets the count grow instead.
- **No room walls.** Standoff was free; real rooms limit it.
