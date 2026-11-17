# Open questions, gaps and next steps

What the model doesn't capture yet, roughly in order of how much it could change the answer.

## 1. Fisheye and distortion (waiting on owner choice)

Every lens is treated as rectilinear. Cheap short M12 lenses are often strongly barrel-distorted or true fisheye: real coverage is wider than modelled and there are fewer pixels on a person near the image edge. Many 2.1 mm lenses are made for 1/4"–1/3" sensors and won't cover the AR0234's 6.8 mm diagonal, so the image corners go black.

This matters most for the small-room picks (2.1 and 2.5 mm), which are exactly the lenses most likely to be distorted.

Options offered:
1. A maximum diagonal FOV or minimum lens per sensor.
2. An editable lens list with each lens's stated FOV and image circle, used instead of the rectilinear FOV. **Recommended** once real candidate lenses are known.
3. A barrel-distortion factor.

The single-camera "near fisheye" flag (diagonal over 120°) never fires with the stock list; the widest rectilinear case is 117°.

## 2. The 30° lower bound

The pair-angle band is 30–90°. Samani 2026 supports about 45° being good and past about 90° being poor, but nothing below 45° was tested horizontally. 30° is a judgement call. Their vertically stacked pair (near 0° horizontal) did well, which suggests narrow pairs may be fine, but depth accuracy from a narrow baseline is untested here.

## 3. No subject facing

A point counts as covered with one good pair, from any direction. That's why small volumes solve with 2 cameras: both on one side. A person facing away is then seen only from behind. Workaround: set the minimum cameras input (`minN`), for example to 4, for all-round views. A proper fix would require good pairs from several directions.

## 4. Floor plan only

No camera height, no vertical FOV check beyond the full-body near limit, no occlusion, one subject. Walker 2026 lost the trunk at the top of a jump; the model can't see that failure. Corners are only checked through grid points.

## 5. Greedy placement and layout jumps

Each camera's distance is optimised alone, and the angle layout is fixed for each n. Adding a camera moves the others, so counts jump unevenly and aren't always monotonic (see [04-room-planner-results.md](04-room-planner-results.md)). A joint optimiser, or letting the whole layout rotate, might cut counts.

## 6. Sweep assumptions

The sweep assumes a lens that fails at one size fails at all larger sizes, and only tests square volumes. Given the non-monotonic counts in point 5, the first assumption could occasionally hide a solvable larger size. Sweeps use a 13 × 13 grid; final solves use 25 × 25.

## 7. Performance

A first sweep in an 8 m room takes about 1 s (measured in jsdom). Results are cached per room and coverage rule, so changing the volume or lens is instant after that.

## Next steps

- Add lens guard option 1 or 2 from point 1.
- Export a setup sheet for the chosen sensor: camera angles, distances from centre and from the volume edge, aim point. The camera table on the map already has the numbers.
- Optional unit prices so "cheapest" can mean cost, not count.
- Camera height and a vertical FOV check for jumps and raised arms.
