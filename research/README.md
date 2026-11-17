# Research

Everything learned while planning the low-cost markerless mocap rig and building the Mocap Lens Calculator, as of 16 Nov 2026. The code in `src/engine.js` is the model. These notes explain why it is built that way and what it found.

| File | What's in it |
|---|---|
| [01-literature.md](01-literature.md) | The two camera-placement papers (Samani 2026, Walker 2026) and what we took from them |
| [02-optics-model.md](02-optics-model.md) | The camera model: near/far limits, field of view, the depth-band ratio, per-lens tables |
| [03-legacy-four-camera.md](03-legacy-four-camera.md) | The first volume model (one camera per side of a square) and why it was dropped |
| [04-room-planner-results.md](04-room-planner-results.md) | The room planner: how it places cameras, full lens sweeps for 5, 6 and 8 m rooms |
| [05-orientation.md](05-orientation.md) | Landscape vs portrait: where portrait wins and why |
| [06-open-questions.md](06-open-questions.md) | Known gaps, assumptions to check, and next steps |

## Rig being planned

- **Cameras:** free-running USB 2.0 UVC, cheap webcam bridge chips, M12 lenses, fixed IR-cut filters, 38 mm boards.
- **Sensors:** AR0234 (global shutter, 1920×1200, 3.0 µm, colour or mono) and OV9281 (global shutter, mono, 1280×800, 3.0 µm).
- **Pose models:** YOLO26, RTMW, MediaPipe. Person crop heights of 256 px (RTMPose, MediaPipe) and 384 px (larger RTMW).
- **Stock M12 lenses:** 2.1, 2.5, 2.8, 3.2, 3.6, 4.0, 6.0 mm.
- **Goal:** the fewest cameras for any volume size, with enough pixels on the person for the pose model. One lens per sensor, so growing the volume means adding cameras, not changing lenses.

## Main findings

1. **A good camera pair is about 45° apart.** Pairs wider than about 90° do much worse, because pose models trained on front views miss keypoints from the side. The planner requires at least one pair at 30–90° at every point. (Samani 2026.)
2. **Coverage matters more than camera count.** Tracking failed where coverage was thin (volume edges, top of a jump), not because there were too few cameras overall. (Walker 2026.)
3. **The lens doesn't change how deep the usable band is, only where it sits.** For a given sensor and crop, far/near is fixed: 3.8× for the AR0234 and 2.6× for the OV9281 (landscape, 256 px crop). A longer lens pushes the whole band farther out. That's why the best lens depends on room size.
4. **The AR0234 needs fewer cameras than the OV9281**, and the gap grows with volume size. In a 6×6 m room: 3×3 m volume takes 4 vs 5 cameras, 5×4 m takes 5 vs 9.
5. **Best single lens per room (256 px crop):** 5 m room → AR0234 2.5 mm, OV9281 2.1 mm; 6 m → 2.8 / 2.5 mm; 8 m → 3.6 mm for both. All landscape.
6. **Portrait only wins in very small rooms** (about 3.5 m), where landscape can't fit a full body at the short distances available.

## Reproducing the numbers

```
node tools/lens-sweep.js         # tables in 04
node tools/orientation-scan.js   # tables in 05
npm test                         # pinned results, checked by hand with the owner
```
