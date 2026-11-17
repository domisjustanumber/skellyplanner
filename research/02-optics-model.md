# Camera model

The geometry behind both modes of the calculator. Code: `optics()` and `sees()` in `src/engine.js`, `geom()` in `src/page.js`.

## Symbols and defaults

| Symbol | Meaning | Default |
|---|---|---|
| f | focal length | mm |
| p | pixel pitch | 0.003 mm (both sensors) |
| pxH, pxV | sensor pixels across, up | AR0234 1920 × 1200, OV9281 1280 × 800 in landscape; swapped in portrait |
| H | person height | 1.8 m |
| cov | vertical coverage needed for a full body, with margin | 2.2 m |
| crop | person height in pixels the pose model needs | 256 or 384 px |

All lenses are treated as ideal rectilinear (pinhole). See [06-open-questions.md](06-open-questions.md) for why that's optimistic for short M12 lenses.

## Near and far limits

A camera is useful for a person at depth z (along the lens axis) when both hold:

- **Full body fits:** the vertical field at z must cover `cov`.
  `near = cov · f / (pxV · p)`
- **Enough pixels:** the person must be at least `crop` px tall.
  `far = H · f / (crop · p)`

The far limit only depends on f and crop, so it is **the same for both sensors** on the same lens (same pixel pitch).

A floor point is seen when `near ≤ z ≤ far` and its sideways offset is at most `z · pxH · p / (2f)` (inside the horizontal field of view).

## The depth band ratio doesn't depend on the lens

```
far / near = H · pxV / (cov · crop)
```

f cancels. The lens only slides the usable band nearer or farther; its depth ratio is fixed by the sensor, orientation and crop.

| Sensor | Orientation | 256 px crop | 384 px crop |
|---|---|---|---|
| AR0234 | landscape | 3.84× | 2.56× |
| AR0234 | portrait | 6.14× | 4.09× |
| OV9281 | landscape | 2.56× | 1.70× |
| OV9281 | portrait | 4.09× | 2.73× |

Consequences:
- The AR0234 at a 384 px crop behaves like the OV9281 at 256 px (both 2.56×). This showed up first in the legacy 4-camera model.
- The best lens depends on room size: it's whichever lens puts the band over the distances the room allows.
- The AR0234's deeper band is why it needs fewer cameras: each camera covers more of the volume's depth.

## Single-camera mode: focal-length window

For one camera with a near distance Dn and far distance Df:

```
f_min = crop · p · Df / H        (enough pixels at the far distance)
f_max = sensor_vertical · Dn / cov   (full body at the near distance; sensor_vertical = pxV · p)
```

Any lens with `f_min ≤ f ≤ f_max` works. If f_min > f_max, no lens works at those distances. Landscape is used when it fits; portrait only when landscape can't.

## Per-lens tables (256 px crop)

Near and far in metres; FOV in degrees (horizontal × vertical, diagonal). Far is the same for both sensors.

**AR0234, landscape**

| f (mm) | near | far | H × V FOV | diag |
|---|---|---|---|---|
| 2.1 | 1.28 | 4.92 | 108 × 81 | 117 |
| 2.5 | 1.53 | 5.86 | 98 × 72 | 107 |
| 2.8 | 1.71 | 6.56 | 92 × 65 | 101 |
| 3.2 | 1.96 | 7.50 | 84 × 59 | 93 |
| 3.6 | 2.20 | 8.44 | 77 × 53 | 87 |
| 4.0 | 2.44 | 9.38 | 72 × 48 | 81 |
| 6.0 | 3.67 | 14.06 | 51 × 33 | 59 |

**OV9281, landscape**

| f (mm) | near | far | H × V FOV | diag |
|---|---|---|---|---|
| 2.1 | 1.93 | 4.92 | 85 × 59 | 94 |
| 2.5 | 2.29 | 5.86 | 75 × 51 | 84 |
| 2.8 | 2.57 | 6.56 | 69 × 46 | 78 |
| 3.2 | 2.93 | 7.50 | 62 × 41 | 71 |
| 3.6 | 3.30 | 8.44 | 56 × 37 | 64 |
| 4.0 | 3.67 | 9.38 | 51 × 33 | 59 |
| 6.0 | 5.50 | 14.06 | 35 × 23 | 41 |

**Portrait** swaps the H and V FOV and lowers the near limit by the sensor aspect ratio (×0.625 for both sensors): e.g. AR0234 2.1 mm portrait has near 0.80 m, OV9281 2.1 mm portrait 1.20 m. Far is unchanged.

**384 px crop** leaves near and FOV unchanged and cuts far by a third: e.g. 2.8 mm far drops from 6.56 m to 4.37 m.

## Fisheye flag

Single-camera mode flags "near fisheye" when the rectilinear diagonal FOV is over 120°. With the stock list it never fires: the widest case (AR0234, 2.1 mm) is 117°. Real 2.1 mm M12 lenses are often true fisheye, so this flag doesn't catch the real problem.

## Regenerating these tables

```
node -e 'const E=require("./src/engine.js");console.log(E.optics("ar0234","landscape",2.8,{cov:2.2,ph:1.8,crop:256}))'
```
