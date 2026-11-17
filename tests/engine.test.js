// Engine checks. Camera counts, positions and lens picks were re-pinned on 16 Nov 2026 for the measured
// coverage rule and wall placement, and again for the straight-on camera and corner facing (see HANDOFF.md).
// The blocked-view and camera-count checks were added the same day (fourth change), the back / hands behind the
// back checks with the fifth, and the per-count plans (front pair, rear view third, cameras 0.4 m apart) with
// the sixth. The plans were re-pinned on 17 Nov 2026 for the face-on camera first, the training views and the pair-angle
// band from 30 degrees (seventh change). They are what the engine gave, not hand-checked.
// The lens pick test was re-pinned on 17 Nov 2026 for the three-lens list (2.8 / 3.6 / 6.0 mm). Tests naming 2.1 or 3.2 mm pass the lens to solve()/plan() directly and test the maths, so they stand.
// The page's Auto no longer uses pickLens() (ninth change, see the Auto checks near the end); the lens pick test stays for
// the sweep table and tools/.
// Fit / no fit went on 17 Nov 2026 (tenth change): Auto no longer ranks a plan some count covers ahead of one none does,
// and fitSize() (the size hint) and anyView are gone with the page's "Why" box; their tests went with them.
// Auto since 17 Nov 2026 (eleventh change): a layout with a face-on camera first, then a score, covered + back seen / 2 + hands
// tracked / 4 at the cameras asked. The 4x4 room, 3x2 volume test (a lens covering 72% beat one covering 69%) became the score test
// with the 5x5 room case; a face-on check and a 2-camera check were added. No other engine pin moved.
const assert = require("assert");
const E = require("../src/engine.js");

const base = { crop: 256, ph: 1.8, cov: 2.2, minA: 45, maxA: 120, need: 1 };
const room = (w, L, extra = {}) => Object.assign({}, base, { roomW: w, roomD: w, volW: L, volD: L, orient: "landscape" }, extra);
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("ok -", name); };
const spots = (r) => r.cams.map((c) => `${c.wall} ${+c.along.toFixed(2)}`);

ok("depth band ratio is set by sensor + crop, not focal length", () => {
  for (const f of [2.1, 2.8, 6]) {
    const ar = E.optics("ar0234", "landscape", f, base), ov = E.optics("ov9281", "landscape", f, base);
    assert.ok(Math.abs(ar.far / ar.near - 3.836) < 0.01);
    assert.ok(Math.abs(ov.far / ov.near - 2.557) < 0.01);
    assert.ok(Math.abs(ar.far - ov.far) < 1e-9, "far limit is sensor-independent");
  }
});

// One subject at the volume centre, cameras 3 m away at the given bearings (0 = in front, 90 = their left).
// state: 3 covered, 4 and the back seen, 5 and the back triangulated (hands behind the back tracked).
const ev = (bearings, turn = 0) => {
  const cams = bearings.map((deg) => { const r = deg * Math.PI / 180; return { x: 3 * Math.sin(r), y: -3 * Math.cos(r), ax: -Math.sin(r), ay: Math.cos(r) }; });
  return E.evaluate(cams, { near: 0.5, far: 10, tanHalf: 1 }, { minA: 45, maxA: 120, turn }, [[0, 0]]);
};
const state = (bearings, turn) => ev(bearings, turn).state[0], spare = (bearings, turn) => ev(bearings, turn).spare;
ok("covered = each side seen by two cameras 45-120 degrees apart, and one camera within 45 degrees of the front", () => {
  assert.strictEqual(state([-30, 30]), 3, "front pair");
  assert.strictEqual(state([44, -46]), 3, "a camera at 44 degrees is straight on");
  assert.strictEqual(state([46, -46]), 2, "nothing within 45 degrees: not covered");
  assert.strictEqual(state([150, -150]), 2, "a pair behind the subject alone is not enough");
  assert.strictEqual(state([150, -150, 0]), 5, "it is with a camera in front (and the pair behind triangulates the back)");
  assert.strictEqual(state([-20, 20]), 2, "40 degrees apart is too narrow");
  assert.strictEqual(state([-65, 65]), 2, "130 degrees apart is too wide");
  assert.strictEqual(state([0, 90]), 2, "front + left side-on: the right side has one view");
  assert.strictEqual(state([0, 90, -90]), 4, "front + both sides (side-on cameras see the back, but 180 degrees apart)");
  assert.strictEqual(state([-30, 30], 90), 2, "turned 45 degrees, one camera is side-on");
  assert.strictEqual(state([45, 135, -45, -135], 360), 5, "four cameras all round: every facing has one within 45 degrees, and two behind");
  assert.strictEqual(state([60, 180, -60], 360), 2, "three all round leave facings 60 degrees from any camera");
  assert.deepStrictEqual([state([0]), state([])], [1, 0]);
});

ok("hands behind the back: one camera 90 degrees or more round sees the back, two of them 45-120 apart track the hands", () => {
  assert.strictEqual(state([-30, 30]), 3, "all in front: covered, but hands behind the back are seen by no camera");
  assert.strictEqual(state([-30, 30, 180]), 4, "one rear camera: the back is seen");
  assert.strictEqual(state([-30, 30, 180, 120]), 5, "a second rear camera 60 degrees from it: tracked");
  assert.strictEqual(state([-30, 30, 180, 150]), 4, "30 degrees apart is too narrow a pair");
  assert.deepStrictEqual([state([-30, 30, 89]), state([-30, 30, 90])], [3, 4], "side-on counts from 90 degrees");
  assert.strictEqual(state([-30, 30, 90, 180]), 5, "side-on plus behind");
  assert.strictEqual(state([-30, 30, 100, -100]), 4, "both sides, 160 degrees apart: seen, not tracked");
  assert.strictEqual(state([-30, 30, 135, -135], 90), 5, "turning 45 degrees each way, two corners behind still track the hands");
});

ok("covered with one view blocked = still covered without the cameras in any one 30 degree slice", () => {
  assert.strictEqual(spare([-45, 0, 45]), 1, "any one of three can go: the two left are 45 or 90 degrees apart, one straight on");
  assert.strictEqual(spare([-30, 30]), 0, "two cameras: lose one and there is no pair");
  assert.strictEqual(spare([-30, -25, 25, 30]), 0, "a second camera 5 degrees from each is blocked along with it");
  assert.strictEqual(spare([-55, -20, 20, 55]), 1, "35 degrees apart on each side: one slice takes only one of them");
  assert.strictEqual(spare([-45, 0, 45], 90), 0, "turning 45 degrees each way: still covered, but no camera can go");
  assert.strictEqual(spare([45, 135, -45, -135], 360), 0, "four all round: covered, but every camera is needed");
  assert.strictEqual(spare([0, 45, 90, 135, 180, -135, -90, -45], 360), 1, "eight all round: any one can go");
});

ok("6x6 room, 3x3 volume, subject faces front: 3 cameras facing a corner, 4 facing the wall (AR0234 3.6 mm)", () => {
  const a = E.solve("ar0234", 3.6, room(6, 3));
  assert.deepStrictEqual([a.n, a.ok, a.face, +a.back.toFixed(2), +a.side.toFixed(2)], [3, true, 45, 1.3, -1.3]);
  assert.deepStrictEqual(spots(a), ["front 3.5", "right 4", "front 0.5"]);
  assert.deepStrictEqual([E.solve("ar0234", 3.6, room(6, 3, { face: 0 })).n, E.solve("ov9281", 3.2, room(6, 3)).n], [4, 4]);
});

ok("same room with the volume held in the middle (1.5 m in front): the cover search does not cover it on 3.6 mm, the front wall is too close", () => {
  const a = E.solve("ar0234", 3.6, room(6, 3, { gap: 1.5 }));
  assert.deepStrictEqual([a.ok, a.back], [false, 0]);
});

ok("the turning arc moves cameras from the front to all round (6x6 room, 2x2 volume, AR0234 2.8 mm)", () => {
  const at = (turn) => E.solve("ar0234", 2.8, room(6, 2, { turn }));
  assert.deepStrictEqual(spots(at(0)), ["front 5.5", "front 0.5"]);
  assert.deepStrictEqual([at(45).face, spots(at(45))], [45, ["front 6", "front 2", "right 4"]]);
  assert.deepStrictEqual(spots(at(360)), ["back 6", "back 0", "back 3", "right 2", "left 2", "front 3.5", "front 2.5"]);
  assert.deepStrictEqual([0, 45, 90, 180, 360].map((t) => at(t).n), [2, 3, 4, 5, 7]);
});

ok("a big volume stops fitting in the cover search now that two cameras cannot share a spot (6x6 room, 5x4 volume, AR0234 3.2 mm)", () => {
  const o = (turn) => Object.assign(room(6, 3, { turn }), { volW: 5, volD: 4 });
  assert.deepStrictEqual([0, 90, 360].map((turn) => E.solve("ar0234", 3.2, o(turn))).map((r) => (r.ok ? r.n : "no")), ["no", "no", "no"], "it was 10 cameras at 0 degrees with two of them on one spot");
});

ok("the cover search stops at 20 cameras: 16 is a fit, and no fit hands back 20 with the coverage they reach", () => {
  const a = E.solve("ov9281", 2.1, room(6, 3, { orient: "portrait", turn: 360 }));
  assert.deepStrictEqual([a.ok, a.n, E.CAP], [true, 16, 20]);
  const r = E.solve("ov9281", 2.8, Object.assign(room(6, 3, { orient: "portrait", turn: 180 }), { volW: 5, volD: 4 }));
  assert.deepStrictEqual([r.ok, r.n, Math.floor(r.frac * 100)], [false, 20, 76]);
  assert.strictEqual(E.solve("ov9281", 2.1, room(6, 3, { orient: "portrait", turn: 360 }), 25, 12).ok, false, "with the old cap of 12 it was no fit");
});

const pct = (x) => Math.floor(x * 100 + 1e-9);
const sum = (h) => [h.n, h.cams.length, h.ok, pct(h.frac), pct(h.rear), pct(h.hands), pct(h.spare)];
// what each camera is, in the order of the camera table: face-on (camera 1 of a plan that has one), offset or rear,
// degrees round from the way the subject faces
const views = (h) => h.cams.map((c, i) => `${!i && h.head ? "face-on" : c.behind ? "rear" : "offset"} ${Math.round(c.az)}${c.extra ? " extra" : ""}`);
const gap = (h) => Math.min(...h.cams.flatMap((a, i) => h.cams.slice(0, i).map((b) => Math.hypot(a.x - b.x, a.y - b.y))));
// The plans below use the page's pair-angle band, which starts at 30 degrees since 17 Nov 2026 (the cover-search
// checks above keep 45, so their numbers did not move).
const page = (w, L, extra = {}) => room(w, L, Object.assign({ minA: 30, orient: "portrait" }, extra));
// the cameras without a mirror image in the layout, left to right (subject facing the front wall): none, or with an
// even count the one camera left over after the face-on camera and the pairs
const lone = (h) => h.cams.filter((c) => !h.cams.some((d) => Math.abs(d.x + c.x) < 1e-6 && Math.abs(d.y - c.y) < 1e-6)).length;

ok("a plan per camera count: a face-on camera, an offset camera, a rear view, then the rest (6x6 room, 3x3 volume, AR0234 3.2 mm portrait)", () => {
  const P = E.plan("ar0234", 3.2, page(6, 3)), at = (n) => E.withN(P, n);
  assert.deepStrictEqual([P.mode, P.tried], ["wall", { wall: 4, corner: 4 }], "facing the wall or a corner covers with 4: the wall");
  const two = at(2), [a, b] = two.cams;
  assert.deepStrictEqual([a.az, a.wall, a.along, a.aim, two.head], [0, "front", 3, [0, 0], true], "camera 1 is dead ahead of the subject, in the middle of the front wall, aimed at the volume centre");
  assert.ok(b.az >= 30 && b.az <= 45, `camera 2 is offset by ${b.az} degrees: enough to pair with camera 1, and inside the 45 degrees that hold 70% of training views`);
  assert.deepStrictEqual([sum(two), spots(two), views(two)], [[2, 2, false, 91, 0, 0, 0], ["front 3", "right 1"], ["face-on 0", "offset 42"]], "they cover 91% (the two-camera layout that covers it all has no face-on camera)");
  assert.deepStrictEqual([sum(at(3)), spots(at(3)), views(at(3))], [[3, 3, false, 96, 93, 0, 0], ["front 3", "right 1", "back 6"], ["face-on 0", "offset 42", "rear 119"]], "the third camera is a rear view");
  assert.deepStrictEqual([sum(at(4)), views(at(4)), lone(at(5)), views(at(5))], [[4, 4, true, 100, 97, 0, 7], ["face-on 0", "offset 25", "rear 119", "offset 25"], 0, ["face-on 0", "offset 25", "rear 119", "offset 25", "rear 119"]], "four cover it: the fourth is the mirror image of the second, the fifth of the third");
  assert.deepStrictEqual([sum(at(6)), views(at(6)), lone(at(6)), at(6).back], [[6, 6, true, 100, 100, 59, 49], ["face-on 0", "offset 25", "rear 138", "offset 25", "rear 119", "rear 119"], 1, 1.3], "six: three in front, three behind (the sixth has no mirror image)");
  assert.deepStrictEqual([sum(at(7)), sum(at(8)), at(7).back, views(at(8))], [[7, 7, true, 100, 100, 93, 64], [8, 8, true, 100, 100, 100, 72], 0, ["face-on 0", "offset 19", "rear 146", "offset 19", "offset 34", "offset 34", "rear 135", "rear 135"]], "from seven the volume sits in the middle: each count is planned from scratch");
  assert.deepStrictEqual([spots(at(12)).slice(0, 8), views(at(12)).slice(8)], [spots(at(8)), ["rear 161 extra", "offset 10 extra", "offset 10 extra", "rear 153 extra"]], "past the count that tracks everything a layout only gains spares, listed last");
  assert.deepStrictEqual([sum(at(20)), sum(at(99)), sum(at(0))], [[20, 20, true, 100, 100, 100, 100], [20, 20, true, 100, 100, 100, 100], [2, 2, false, 91, 0, 0, 0]], "2 to 20 cameras, all of them placed");
  const h = at(6);
  assert.deepStrictEqual([h.min, h.min2, h.min3, h.full], [4, 5, 8, 12], "4 cover; 5 see the back; 8 track hands behind it; 12 stay covered with any one view blocked");
  assert.deepStrictEqual(h.byN.slice(0, 7).map((x) => [x.n, pct(x.frac), pct(x.rear), pct(x.hands), pct(x.spare)]), [[2, 91, 0, 0, 0], [3, 96, 93, 0, 0], [4, 100, 97, 0, 7], [5, 100, 100, 46, 32], [6, 100, 100, 59, 49], [7, 100, 100, 93, 64], [8, 100, 100, 100, 72]]);
  assert.deepStrictEqual([h.byN.length, h.byN[4].spare === h.spare, h.byN[4].hands === h.hands], [19, true, true], "one row per count; the table and the plan agree");
  assert.strictEqual(h.state.filter((x) => x === 5).length, Math.round(h.hands * h.pts.length));
  // the stricter band the page had before: the same face-on camera, a wider offset, and less of the volume covered
  const old = E.withN(E.plan("ar0234", 3.2, page(6, 3, { minA: 45 })), 2);
  assert.deepStrictEqual([sum(old), views(old)], [[2, 2, false, 35, 0, 0, 0], ["face-on 0", "offset 59"]]);
});

ok("the owner's case: 4x4 room, 2x2 volume, 6 cameras: one dead centre in front, one either side of it within 45 degrees, three behind (both sensors on the page's 2.1 mm portrait)", () => {
  for (const [sk, shares, list] of [["ar0234", [6, 6, true, 100, 100, 87, 84], ["face-on 0", "offset 23", "rear 162", "offset 23", "rear 128", "rear 128"]], ["ov9281", [6, 6, true, 100, 100, 57, 43], ["face-on 0", "offset 29", "rear 139", "offset 29", "rear 121", "rear 121"]]]) {
    const P = E.plan(sk, 2.1, page(4, 2)), h = E.withN(P, 6), front = h.cams.filter((c) => !c.behind);
    assert.deepStrictEqual([P.mode, h.head, h.face, h.cams[0].az, spots(h)[0], h.cams[0].aim], ["wall", true, 0, 0, "front 2", [0, 0]], `${sk}: camera 1 is face-on, in the middle of the front wall`);
    // the rule, not the exact spots: the front cameras stay inside the 45 degrees that hold 70% of training views and
    // read as well as dead ahead, the layout is a mirror image left to right but for the sixth camera, and a rear view stands within 45
    // degrees of straight behind (the best-read views from behind)
    assert.ok(front.every((c) => c.az <= 45), `${sk}: front cameras at ${front.map((c) => Math.round(c.az))}`);
    assert.ok(lone(h) <= 1 && h.cams.some((c) => c.az >= 135), `${sk}: ${views(h)}`);
    assert.ok(gap(h) >= E.GAP - 1e-6);
    assert.deepStrictEqual([sum(h), views(h), [h.min, h.min2, h.min3]], [shares, list, sk === "ar0234" ? [4, 4, 7] : [4, 5, null]], sk);   // what the engine gave
  }
});

ok("how a plan gets its front view: face-on from the wall; from a corner when that covers with fewer cameras; two offset cameras only when neither covers", () => {
  // the wall: 6x6 room (above). Turning the subject to the corner covers with no fewer cameras, so they face the wall
  assert.strictEqual(E.withN(E.plan("ar0234", 3.2, page(6, 3, { face: 45 })), 6).min, 4);
  // the corner: in a 3x3 room the front wall is too close for a face-on camera there to cover the volume with fewer than 8
  const o = page(3, 2), P = E.plan("ar0234", 2.1, o), four = E.withN(P, 4), wall = E.plan("ar0234", 2.1, Object.assign({}, o, { face: 0 }));
  assert.deepStrictEqual([P.mode, P.tried, wall.mode, E.withN(wall, 4).ok, E.withN(wall, 4).head], ["corner", { wall: 8, corner: 4 }, "wall", false, true]);
  assert.deepStrictEqual([sum(four), four.head, four.face, four.back, four.side, spots(four), views(four)], [[4, 4, true, 100, 95, 36, 0], true, 45, 0.15, -0.15, ["front 3", "front 0", "back 0", "back 3"], ["face-on 0", "offset 84", "rear 180", "offset 84"]], "four cameras, one in each corner, the first face-on");
  assert.ok([2, 3, 6, 8, 20].every((n) => E.withN(P, n).head && E.withN(P, n).face === 45), "at every count");
  assert.deepStrictEqual([four.min, four.min2, four.min3, E.withN(P, 20).cams.length], [4, null, null, 20]);
  // two offset cameras: 8x8 room, 5x5 volume, subject turning half way round. No count up to 20 covers it with a
  // face-on camera, facing the wall or the corner; 15 do without one
  const big = E.plan("ar0234", 3.2, page(8, 5, { turn: 180 })), h = E.withN(big, 15);
  assert.deepStrictEqual([big.mode, big.tried, h.head, h.ok, h.min], ["pair", { wall: null, corner: null }, false, true, 15]);
  assert.ok(h.cams[0].az > E.AHEAD && h.cams[1].az <= 60, "cameras 1 and 2 stand either side of straight ahead");
  // nothing covers: the first front view that has a layout, with as much covered as it reaches
  const none = E.plan("ov9281", 2.1, o);
  assert.deepStrictEqual([none.mode, none.tried, E.withN(none, 6).min, E.withN(none, 6).head, sum(E.withN(none, 6))], ["wall", { wall: null, corner: null }, null, true, [6, 6, false, 84, 39, 36, 32]]);
  // a face-on camera has to see a full body at the volume centre: the OV9281 on 2.1 mm in landscape needs 1.93 m and the wall is 1.45 m away
  assert.strictEqual(E.plan("ov9281", 2.1, room(3, 2, { minA: 30, turn: 360 })).mode, "pair");
});

ok("at every count from 2 to 20: a face-on camera first, no two cameras within 0.4 m, camera 3 a rear view, more cameras never cover less, the table is what evaluate() gives", () => {
  assert.deepStrictEqual([E.GAP, E.AHEAD], [0.4, 10]);
  const big = { volW: 5, volD: 4 };
  const cases = [["ar0234", 3.2, page(6, 3)], ["ov9281", 2.8, page(6, 3)], ["ar0234", 2.1, page(3, 2)], ["ar0234", 2.1, page(4, 2)],
    ["ar0234", 3.2, page(6, 3, { turn: 90 })], ["ar0234", 2.1, page(6, 3, { orient: "landscape", turn: 360 })], ["ov9281", 2.8, Object.assign(page(6, 3, { turn: 180 }), big)],
    ["ov9281", 3.6, page(8, 4)], ["ar0234", 2.8, Object.assign(page(6, 3, { turn: 45 }), { roomD: 4, volD: 2 })]];
  for (const [sk, f, o] of cases) {
    const P = E.plan(sk, f, o), name = `${sk} ${o.roomW}x${o.roomD} m room, arc ${o.turn || 0}`;
    assert.notStrictEqual(P.mode, "pair", name);
    let last = 0;
    for (let n = 2; n <= 20; n++) {
      const h = E.withN(P, n), ev = E.evaluate(h.cams, h.op, Object.assign({}, o, { back: h.back, side: h.side, face: h.face }), h.pts);
      assert.strictEqual(h.cams.length, n, `${name}: ${n} cameras placed`);
      assert.ok(h.head && h.cams[0].az <= E.AHEAD + 1e-6 && E.evaluate([h.cams[0]], h.op, o, [[0, 0]]).state[0] === 1, `${name}, ${n} cameras: camera 1 is ${h.cams[0].az} degrees round, or does not see the volume centre`);
      assert.ok(gap(h) >= E.GAP - 1e-6, `${name}, ${n} cameras: two are ${gap(h).toFixed(2)} m apart`);
      if (n > 2) assert.ok(h.cams[2].behind && h.cams[2].az >= E.REAR, `${name}, ${n} cameras: camera 3 is ${h.cams[2].az} degrees round`);
      assert.ok(h.frac >= last - 1e-9, `${name}: ${n} cameras cover less than ${n - 1}`);
      assert.deepStrictEqual([ev.frac, ev.rear, ev.hands, ev.spare].map((x) => +x.toFixed(9)), [h.frac, h.rear, h.hands, h.spare].map((x) => +x.toFixed(9)), `${name}, ${n} cameras`);
      last = h.frac;
    }
  }
});

ok("a turning arc: face-on means face-on to the middle of the arc, and the cameras spread round as it grows (6x6 room, 3x3 volume, AR0234 3.2 mm portrait)", () => {
  const at = (turn) => { const P = E.plan("ar0234", 3.2, page(6, 3, { turn })), h = E.withN(P, 6); return [P.mode, h.head, h.cams[0].az, h.min, h.min2, h.min3]; };
  assert.deepStrictEqual([0, 90, 180, 360].map(at), [["wall", true, 0, 4, 5, 8], ["corner", true, 0, 6, 8, 13], ["corner", true, 0, 8, 9, 13], ["wall", true, 0, 15, 15, 15]], "at 360 covering already sees the back and tracks the hands");
});

ok("the OV9281 in the same room faces the corner, which covers with one camera fewer (2.8 mm portrait, 6x6 room, 3x3 volume)", () => {
  const P = E.plan("ov9281", 2.8, page(6, 3)), h = E.withN(P, 4);
  assert.deepStrictEqual([P.mode, P.tried, sum(E.withN(P, 2)), sum(E.withN(P, 3))], ["corner", { wall: 6, corner: 5 }, [2, 2, false, 74, 0, 0, 0], [3, 3, false, 74, 64, 0, 0]]);
  assert.deepStrictEqual([sum(h), views(h), spots(h)], [[4, 4, false, 97, 50, 0, 53], ["face-on 0", "offset 41", "rear 180", "offset 41"], ["front 6", "front 2", "back 0", "right 4"]], "four: the corner ahead, one either side, the corner behind");
  assert.deepStrictEqual([h.min, h.min2, h.min3, h.full, sum(E.withN(P, 6))], [5, 10, 12, null, [6, 6, true, 100, 80, 0, 55]]);
});

ok("a big volume (6x6 room, 5x4 volume): the AR0234 covers it with 6 from the wall; the OV9281 turning half way round never does, and gets exactly the cameras asked", () => {
  const o = (turn) => Object.assign(page(6, 3, { turn }), { volW: 5, volD: 4 });
  const a = E.plan("ar0234", 3.2, o(0)), h = E.withN(a, 6);
  assert.deepStrictEqual([a.mode, h.min, h.min2, h.min3, sum(h)], ["wall", 6, 8, null, [6, 6, true, 100, 70, 0, 14]]);
  const P = E.plan("ov9281", 2.8, o(180)), e = E.withN(P, 8);
  assert.deepStrictEqual([P.mode, e.n, e.cams.length, e.ok, e.head, e.min, e.min2, e.min3, e.full], ["wall", 8, 8, false, true, null, null, null, null]);
  assert.deepStrictEqual([pct(e.frac), pct(E.withN(P, 20).frac)], [37, 57]);
});

ok("3x3 room, 2x2 volume with the subject turning half way or all the way round: no count covers it, and every count still gets a layout (it used to stop the page)", () => {
  for (const sk of ["ar0234", "ov9281"]) for (const turn of [180, 360]) for (const orient of ["landscape", "portrait"]) {
    const P = E.plan(sk, 2.1, page(3, 2, { turn, orient }));
    for (let n = 2; n <= 20; n++) { const h = E.withN(P, n); assert.ok(!h.ok && h.cams.length <= n && h.state.length === 625 && (h.cams.length < 2 || gap(h) >= E.GAP - 1e-6), `${sk} ${turn} ${orient} ${n}`); }
    assert.strictEqual(E.withN(P, 6).min, null);
  }
});

ok("a lens that sees none of the volume gives an empty plan, not an error; a room too small for 20 cameras gets as many as fit", () => {
  const h = E.withN(E.plan("ar0234", 6, room(2, 1)), 6);
  assert.deepStrictEqual([h.n, h.cams, h.frac, h.min, h.head, h.mode, h.byN.length], [0, [], 0, null, false, "pair", 19]);
  const small = E.withN(E.plan("ar0234", 2.1, page(2, 1)), 20);
  assert.deepStrictEqual([small.n, small.cams.length, small.head, gap(small) >= E.GAP - 1e-6], [16, 16, true, true]);
});

const best = (sk, w, turn = 0) => {
  const sizes = []; for (let L = 1.5; L <= w - 1 + 1e-9; L += 0.5) sizes.push(L);
  return E.pickLens(["landscape", "portrait"].flatMap((orient) => E.sweep(sk, Object.assign({}, base, { roomW: w, roomD: w, turn, orient }), sizes)));
};
ok("lens pick per room (256 crop)", () => {
  const b3a = best("ar0234", 3), b3o = best("ov9281", 3), b6a = best("ar0234", 6), b6o = best("ov9281", 6), b8a = best("ar0234", 8), b8o = best("ov9281", 8);
  assert.deepStrictEqual([b3a.f, b3a.orient, b3a.ns, b3o.f, b3o.orient, b3o.ns], [2.8, "portrait", [3, null], 2.8, "landscape", [null, null]]);
  assert.deepStrictEqual([b6a.f, b6a.orient, b6a.ns], [2.8, "portrait", [2, 2, 3, 4, 4, 6, 7, null]]);
  assert.deepStrictEqual([b6o.f, b6o.orient, b6o.ns], [2.8, "portrait", [2, 2, 3, 4, 4, 6, null, null]]);
  assert.deepStrictEqual([b8a.f, b8a.orient, b8o.f, b8o.orient], [3.6, "portrait", 3.6, "portrait"]);
  const r = best("ar0234", 6, 360);
  assert.deepStrictEqual([r.f, r.orient, r.ns], [2.8, "portrait", [6, 7, 8, null, null, null, null, null]]);
  const none = best("ar0234", 3, 180);
  assert.deepStrictEqual([none.f, none.orient, none.ns], [2.8, "landscape", [null, null]], "when no lens covers any size, the shortest (it was the longest, which sees nothing in a 3 m room)");
});

// Auto (17 Nov 2026, ninth change): every lens planned in both orientations, and the plan that does most with the
// cameras asked is used. Pinned cases are what the engine gave.
const six = (sk, o) => E.STOCK.flatMap((f) => ["landscape", "portrait"].map((orient) => ({ f, orient, P: E.plan(sk, f, Object.assign({}, o, { orient })) })));
const lens = (c) => `${c.f} ${c.orient}`;
ok("Auto picks the lens and orientation whose plan does most with the cameras asked, and the pick can change with the count (4x4 room, 2x2 volume, arc 90, OV9281)", () => {
  const plans = six("ov9281", page(4, 2, { turn: 90 }));
  for (let n = 2; n <= 20; n++) {
    const c = E.choose(plans, n);
    assert.ok(plans.every((p) => E.ahead(c.sol, E.withN(p.P, n)) >= 0), `${n} cameras: ${lens(c)} is behind another plan`);
    assert.strictEqual(c.sol.n, E.withN(c.P, n).n);
  }
  const at = (n) => { const c = E.choose(plans, n); return [lens(c), c.P.mode, pct(c.sol.frac), pct(c.sol.rear), c.sol.min]; };
  assert.deepStrictEqual([3, 4, 7, 8].map(at), [["2.8 portrait", "corner", 39, 3, 8], ["3.6 portrait", "pair", 68, 0, 16], ["3.6 portrait", "pair", 80, 4, 16], ["2.8 portrait", "corner", 100, 41, 8]],
    "4 to 7 cameras cover the most on 3.6 mm with two offset cameras (it takes 16 to cover it all); fewer or more do most on 2.8 mm facing the corner, which covers it with 8");
});

// The score (17 Nov 2026, eleventh change): covered + back seen / 2 + hands tracked / 4, in whole percent.
const shown = (s) => [pct(s.frac), pct(s.rear), pct(s.hands)];
ok("Auto ranks by a score of what the cameras asked do, covered + half the back seen + a quarter of hands tracked, so a few points of cover no longer buy away the back (OV9281, 4 cameras)", () => {
  for (const [name, o, was, now] of [["5x5 room, 3x3 volume", page(5, 3), [84, 5, 0], [79, 63, 0]], ["4x4 room, 3x2 volume", Object.assign(page(4, 2), { volW: 3 }), [72, 2, 0], [69, 49, 0]]]) {
    const plans = six("ov9281", o), c = E.choose(plans, 4), land = E.withN(plans.find((p) => lens(p) === "2.8 landscape").P, 4);
    assert.deepStrictEqual([lens(c), shown(c.sol), shown(land)], ["2.8 portrait", now, was], `${name}: 2.8 mm landscape, picked when covered came first, sees the back in far less`);
    assert.ok(E.ahead(c.sol, land) > 0 && E.ahead(land, c.sol) < 0, name);
  }
});

ok("a lens whose layout has a camera face-on to the subject beats one without, before the score (6x6 room, 4x4 volume, arc 180, AR0234, 7 cameras)", () => {
  const plans = six("ar0234", page(6, 4, { turn: 180 })), c = E.choose(plans, 7), pair = E.withN(plans.find((p) => lens(p) === "2.8 portrait").P, 7);
  assert.deepStrictEqual([lens(c), c.P.mode, c.sol.head, shown(c.sol)], ["2.8 landscape", "corner", true, [91, 43, 12]]);
  assert.deepStrictEqual([pair.head, shown(pair)], [false, [89, 86, 21]], "two offset cameras: more covered and the back seen in twice as much, but no face-on camera");
  assert.ok(E.ahead(c.sol, pair) > 0, "the same comparison drives the sensor pill");
});

ok("with 2 cameras no layout sees the back, so the score is the share covered and the lens that covers most wins (5x5 room, 3x3 volume, both sensors)", () => {
  for (const sk of ["ar0234", "ov9281"]) {
    const plans = six(sk, page(5, 3)), c = E.choose(plans, 2), at2 = plans.map((p) => E.withN(p.P, 2));
    assert.ok(at2.every((s) => s.rear === 0 && s.hands === 0), sk);
    assert.strictEqual(pct(c.sol.frac), Math.max(...at2.map((s) => pct(s.frac))), `${sk}: ${lens(c)}`);
  }
});

ok("Auto in a room nothing covers (3x3 room, 2x2 volume, turning half way and all the way round): every count gets a plan, and when no layout of that many sees anything, the lens that gets furthest with more", () => {
  for (const sk of ["ar0234", "ov9281"]) for (const turn of [180, 360]) {
    const plans = six(sk, page(3, 2, { turn }));
    for (let n = 2; n <= 20; n++) { const c = E.choose(plans, n); assert.ok(c.sol.min == null && c.sol.cams.length <= n && c.sol.state.length === 625, `${sk} ${turn} ${n}`); }
  }
  const plans = six("ar0234", page(3, 2, { turn: 360 })), two = E.choose(plans, 2), most = E.choose(plans, 20);
  assert.ok(plans.every((p) => pct(E.withN(p.P, 2).frac) === 0) && lens(two) === lens(most), `2 cameras on ${lens(two)}, 20 on ${lens(most)}`);
});

// Old fixed-4-camera "volume mode" closed form (replaced by the room planner, kept as a regression check).
ok("legacy 4-camera max-volume closed form", () => {
  const maxL = (pxH, pxV, crop, s) => Math.min(1.8 * pxV * s / (2.2 * crop) - s, (-s + Math.sqrt(s * s + 4 * pxH * s * 1.8 / crop)) / 2);
  const got = [1.5, 2, 2.5, 3].map((s) => +maxL(1280, 800, 256, s).toFixed(1));
  assert.deepStrictEqual(got, [2.3, 3.1, 3.7, 3.9]);
  assert.deepStrictEqual([1.5, 2, 2.5, 3].map((s) => +maxL(1920, 1200, 256, s).toFixed(1)), [3.8, 4.3, 4.7, 5.0]);
});
console.log(`${n} engine checks passed`);
