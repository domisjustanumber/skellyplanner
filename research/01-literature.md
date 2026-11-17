# Literature: camera placement for markerless mocap

Two 2026 papers shaped the room planner. Neither gives a full curve of accuracy against camera angle, so the 30–90° pair band in the planner is a judgement call built on them.

## Samani et al. (2026)

"Optimizing camera placement in multi-view markerless motion capture…", *BMC Research Notes* 19:303. doi:10.1186/s13104-026-07886-4

**Setup**
- 10 male participants.
- 8 consumer cameras at 15 fps, about 3 m from the subject, mostly about 1 m high.
- 6 two-camera stereo pairs compared.
- MediaPipe Pose (model complexity 1), compared against a Qualisys marker system.

**Results**

| Pair | Separation | Static MAE | Static ICC | Dynamic (lifting) MAE | Dynamic ICC |
|---|---|---|---|---|---|
| Cameras 1–3 (best) | about 45° | 9.28° | 0.851 | 12.92° | 0.823 |
| Cameras 1–2 (second) | stacked vertically, 1.0 m and 1.6 m, almost no horizontal angle | — | 0.80 | — | — |
| Cameras 3–7 (worst) | about 135° | about 2.5–3× the best pair's error | about 0.3 | — | — |

**The authors' explanation: the "detection constraint".** Pose models are trained mostly on front-facing images, so they miss or misplace keypoints when the person is side-on to a camera. A wide stereo baseline only helps if both cameras detect the keypoints reliably. The vertically stacked pair doing well with almost no baseline backs this up: consistent detection matters more than baseline width.

**Limits**
- Only two separations are stated explicitly (45° and 135°), so there's no accuracy-vs-angle curve.
- Opposite pairs (180°) weren't tested, because the two cameras couldn't share a calibration view.
- Their "neck" landmark isn't C7, so neck agreement with the marker system was poor.

**What we took from it**
- A good pair is about 45° apart; past about 90° is poor.
- The first two cameras in every layout sit at 0° (front) and 45°.
- A point counts as covered only if some pair seeing it is 30–90° apart, measured at the point.
- The fixed 4-camera square (90° neighbours, 180° opposites) was dropped. See [03-legacy-four-camera.md](03-legacy-four-camera.md).

## Walker et al. (2026)

"The effect of camera configuration on multi-camera markerless motion capture for biomechanical analysis", *Journal of Biomechanics* 206:113522. doi:10.1016/j.jbiomech.2026.113522

**Setup**
- 18 Sony RX0 II cameras, 1920×1080 at 120 Hz, 1.6 m high, every 20° round an ellipse.
- Two volumes: 10 × 8 m and 6 × 4 m.
- Subsets of 18, 12 and 6 cameras.
- Theia3D for pose.

**Results**
- Joint kinematics changed by less than 2–4° between configurations.
- In the 6 × 4 m volume, 6 cameras failed to track every segment. The trunk was lost at the top of a jump.
- Tracking also failed near the volume edges, where few cameras overlapped.
- The authors conclude that geometry and coverage matter more than camera count.

**Limits**
- No marker-based reference, so it measures consistency between configurations, not accuracy.
- The camera subsets reused the 18-camera calibration, which flatters the smaller setups.
- The authors have funding ties to Theia.

**What we took from it**
- Optimise coverage across the whole volume, edges included, rather than a camera count. The planner checks every point on a grid and the default target is 100%.
- Vertical coverage matters for jumps and raised arms. The planner doesn't model camera height yet (see [06-open-questions.md](06-open-questions.md)).

## How the two fit together

Samani says *which pairs* are useful (about 45°, not wide). Walker says *where* systems fail (thin coverage at the edges and in the vertical). The planner combines them: every point in the volume must be seen by at least one pair in the useful angle band, and the camera count is whatever it takes to get there.
