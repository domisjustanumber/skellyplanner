// Smoke test: run dist/index.html in jsdom, exercise both modes, fail on script errors.
// Texts and numbers re-pinned on 17 Nov 2026 (face-on camera first, pair-angle band from 30 degrees); see HANDOFF.md.
// Re-pinned again on 17 Nov 2026 for the three-lens list (2.8 / 3.6 / 6.0 mm): 2.1 and 3.2 mm picks became 2.8 mm; see HANDOFF.md.
// And again on 17 Nov 2026 (ninth change): Auto plans every lens in both orientations and uses the one that does most with the cameras asked.
// And on 17 Nov 2026 (tenth change): no fit / no-fit flag any more. A step no count up to 20 reaches is not mentioned, the "Why" box is gone,
// and the verdict is green when a sensor covers the volume with the cameras asked, plain otherwise.
// And on 17 Nov 2026 (eleventh change): Auto puts a lens with a face-on camera first, then ranks by a score, covered + back seen / 2 +
// hands tracked / 4. Pins moved: the 8x8 room at 15 cameras (AR0234 now landscape facing the corner) and the 6x6 room, 4x4 volume at
// 180 degrees (AR0234 now landscape with a face-on camera at 6 and 7, was portrait with two offset cameras at 6).
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const dom = new JSDOM(fs.readFileSync(path.join(__dirname, "../dist/index.html"), "utf8"), { runScripts: "dangerously" });
const d = dom.window.document, errs = [];
dom.window.addEventListener("error", (e) => errs.push(e.message));
const fire = () => d.getElementById("calc").dispatchEvent(new dom.window.Event("change"));
const txt = (id) => d.getElementById(id).textContent.replace(/\s+/g, " ").trim();
const rows = () => [...d.querySelectorAll("#camtab tbody tr")].map((r) => [...r.children].map((c) => c.textContent).join("|"));
const marks = (st) => d.querySelectorAll(`#map circle[data-s="${st}"]`).length;   // 3: covered only (ring), 4: and the back seen (small dot), 5: and hands tracked (big dot)
const set = (o) => { for (const k in o) d.getElementById(k).value = o[k]; fire(); };
const FACE = "Camera 1 is face-on to the subject, the view pose models know best; camera 2 is offset to one side to make a pair with it.";

// default 6x6 room, 3x3 volume, 6 cameras: a face-on camera, one either side of it and three behind; the verdict says how many would do the rest
assert.deepStrictEqual([d.getElementById("turn").value, d.getElementById("cams").value, txt("cams-out"), d.getElementById("minA").value], ["0", "6", "6", "30"]);
assert.strictEqual(txt("r-pill"), "AR0234 better");
assert.strictEqual(txt("r-text"), "6 cameras for a 3.0 × 3.0 m volume in a 6.0 × 6.0 m room. AR0234, 2.8 mm lens in portrait: 6 cameras cover the volume and see the subject's back everywhere. Hands behind the back are tracked in 90% of it. 7 would track hands behind the back everywhere. OV9281, 2.8 mm lens in landscape: 6 cameras cover the volume and see the subject's back everywhere. Hands behind the back are tracked in 44% of it.");
assert.strictEqual(rows().length, 6, "all six cameras are in the table");
assert.strictEqual(d.querySelectorAll("#map text[font-weight]").length, 6, "and on the map");
assert.match(txt("cards"), /4cameras would cover it Lens2\.8 mm \(auto, best for 6 cameras\) Orientationportrait.*Back seen everywhere with4 cameras Hands behind back tracked with7 cameras Covered with 6 cameras100% Back seen100% Hands behind back tracked90% With one view blocked77% Subject facesfront wall.*4cameras would cover it Lens2\.8 mm \(auto, best for 6 cameras\) Orientationlandscape.*Back seen everywhere with5 cameras Covered with 6 cameras100%.*Subject facesfront wall/);
// the lens table is a general comparison; its highlighted row is the lens the cards use
assert.deepStrictEqual([...d.querySelectorAll("#sweeps h3")].map((h) => h.textContent), ["AR0234 · cards use 2.8 mm portrait", "OV9281 · cards use 2.8 mm landscape"]);
assert.deepStrictEqual([...d.querySelectorAll("#sweeps tr.pick")].map((r) => r.children[0].textContent + " " + r.children[1].textContent), ["2.8 mm port.", "2.8 mm land."]);
// and the caption says how Auto picks: one score, in one sentence (eleventh change)
assert.match(txt("sweep-cap"), /the one that does most with them is used: first a lens whose layout has a camera face-on to the subject, then the highest score: the share covered, plus half the share with the subject's back seen, plus a quarter of the share with hands behind the back tracked, so 1 point more covered is worth 2 points more back seen\./);
assert.strictEqual(txt("map-cap"), `6 cameras cover 100% of the volume, see the subject's back in 100% and track hands behind the back in 90%; 77% stays covered with one view blocked. The subject faces the front wall. The volume sits 2.1 m from the front wall and 0.9 m from the back wall, centred side to side. ${FACE} Camera 3 is a rear view. "For" says what each camera is and its angle round from the way the subject faces. Cameras stand 5 cm off the wall and at least 0.4 m apart; left and right are as drawn. Shaded wedges show where each camera fits a full body and still gets 256 px on a person.`);
assert.deepStrictEqual(rows().map((r) => r.split("|")[1]), ["face-on 0°", "offset 23°", "rear 168°", "offset 23°", "rear 133°", "rear 133°"], "what each camera is: face-on, an offset camera, a rear view, then the rest");
assert.strictEqual(rows()[0], "1|face-on 0°|front wall, 3.00 m from the left corner|centre of the volume");
assert.strictEqual(new Set(rows().map((r) => r.split("|")[2])).size, 6, "six different spots");
assert.deepStrictEqual([marks(3), marks(4), marks(5)], [0, 58, 567], "the back is seen everywhere; 254 spots lack the second rear view");
assert.strictEqual(d.querySelectorAll("#ntab tbody tr").length, 19, "a row for every count from 2 to 20");
assert.strictEqual(d.querySelector("#ntab tr.current").textContent, "6100%100%90%77%100%100%44%37%");
// more than enough: says so, names each count, and says the extra cameras add little
set({ cams: 12 });
assert.match(txt("r-text"), /AR0234, 2\.8 mm lens in portrait: 12 cameras is more than this volume needs\. 4 would cover it and see the subject's back everywhere; 7 would track hands behind the back everywhere; 11 would keep it covered with any one view blocked\. The 5 cameras past 7 are extra views and add little: with 12, 100% stays covered with one view blocked\. OV9281, 2\.8 mm lens in portrait: 12 cameras cover the volume, see the subject's back and track hands behind the back everywhere, and no fewer would\. 54% stays covered with one view blocked\.$/);
assert.match(txt("map-cap"), /"For" says what each camera is and its angle round from the way the subject faces; extra marks the cameras added after everything is tracked\./);
assert.deepStrictEqual([rows().length, rows().filter((r) => / · extra\|/.test(r)).length, rows()[8].split("|")[1], rows()[9].split("|")[1]], [12, 5, "offset 10° · extra", "offset 10° · extra"], "the five spares come last; only camera 1 is called face-on");
set({ cams: 8 });
assert.match(txt("r-text"), /The camera past 7 is an extra view and adds little: with 8, \d+% stays covered with one view blocked\./);
// exactly enough for the AR0234: all three steps, no fewer would
set({ cams: 7 });
assert.match(txt("r-text"), /AR0234, 2\.8 mm lens in portrait: 7 cameras cover the volume, see the subject's back and track hands behind the back everywhere, and no fewer would\. 88% stays covered with one view blocked\. OV9281/);
// five: the face-on camera, a mirrored pair in front and a mirrored pair behind, on five different spots
set({ cams: 5 });
assert.deepStrictEqual(rows(), ["1|face-on 0°|front wall, 3.00 m from the left corner|centre of the volume", "2|offset 23°|front wall, 1.50 m from the right corner|centre of the volume", "3|rear 133°|back wall, 0.50 m from the left corner|centre of the volume", "4|offset 23°|front wall, 1.50 m from the left corner|centre of the volume", "5|rear 133°|back wall, 0.50 m from the right corner|centre of the volume"]);
// three: face-on, offset and a rear view
set({ cams: 3 });
assert.strictEqual(txt("r-text"), "3 cameras for a 3.0 × 3.0 m volume in a 6.0 × 6.0 m room. AR0234, 2.8 mm lens in portrait: 3 cameras cover 96% of the volume and see the subject's back in 95% of it. 4 would cover it and see the subject's back everywhere; 7 would track hands behind the back everywhere. OV9281, 2.8 mm lens in landscape: 3 cameras cover 95% of the volume and see the subject's back in 74% of it. 4 would cover it; 5 would see the subject's back everywhere.");
assert.deepStrictEqual(rows(), ["1|face-on 0°|front wall, 3.00 m from the left corner|centre of the volume", "2|offset 42°|right wall, 1.00 m from the front corner|centre of the volume", "3|rear 119°|back-right corner|centre of the volume"]);
assert.deepStrictEqual([marks(3), marks(4), marks(5)], [6, 598, 0], "the back is seen in all but 17 of the covered spots");
// two: face-on and offset; too few to cover it all, with the counts that would do each step
set({ cams: 2 });
assert.strictEqual(txt("r-text"), "2 cameras for a 3.0 × 3.0 m volume in a 6.0 × 6.0 m room. AR0234, 2.8 mm lens in portrait: 2 cameras cover 91% of the volume. 4 would cover it and see the subject's back everywhere; 7 would track hands behind the back everywhere. OV9281, 2.8 mm lens in landscape: 2 cameras cover 89% of the volume. 4 would cover it; 5 would see the subject's back everywhere.");
assert.deepStrictEqual([rows().length, d.getElementById("r-verdict").className, marks(3)], [2, "verdict", 569], "too few to cover it: a plain verdict, not a warning");
assert.match(txt("map-cap"), /^2 cameras cover 91% of the volume, see the subject's back in 0% and track hands behind the back in 0%; 0% stays covered with one view blocked\. The subject faces the front wall\. The volume sits 2\.8 m from the front wall and 0\.2 m from the back wall, centred side to side\. Camera 1 is face-on to the subject, the view pose models know best; camera 2 is offset to one side to make a pair with it\. "For" says/);
set({ cams: 3 });
assert.match(txt("cards"), /Person height\s*256–1571 px Fills frame\s*13–82% In a 640 px YOLO input\s*85–524 px/); // AR0234 portrait
set({ gap: 1.5 });
assert.match(txt("map-cap"), /The volume sits 1\.5 m from the front wall and 1\.5 m from the back wall, centred side to side/);
set({ gap: "" });
set({ volW: 2, volD: 2 });
const n0 = +txt("cards").match(/AR0234.*?(\d+)cameras would cover it/)[1];
set({ turn: 90 });
assert.strictEqual(txt("turn-out"), "90°");
assert.ok(+txt("cards").match(/AR0234.*?(\d+)cameras would cover it/)[1] > n0, "turning arc raises the camera count");
// 3x3 room, 2x2 volume: the front wall is too close for a face-on camera there (no corner facing any more at 2.8 mm), and no count up to 20
// covers it all. The page says what the cameras do, with no warning, no "Why" box and nothing about the steps no count reaches
assert.strictEqual(d.getElementById("r-why"), null, "the Why box is gone");
set({ roomW: 3, roomD: 3, turn: 0 });
assert.strictEqual(txt("r-text"), "3 cameras for a 2.0 × 2.0 m volume in a 3.0 × 3.0 m room. AR0234, 2.8 mm lens in portrait: 3 cameras cover 69% of the volume and see the subject's back in 57% of it. OV9281, 2.8 mm lens in portrait: 3 cameras cover 43% of the volume and see the subject's back in 24% of it.");
for (const turn of [0, 180, 360]) for (const cams of [4, 6]) {
  set({ turn, cams });
  const at = `arc ${turn}, ${cams} cameras`;
  assert.deepStrictEqual([errs, d.getElementById("r-verdict").className, rows().length], [[], "verdict", cams], at);
  assert.ok(/^(Level|AR0234 better|OV9281 better)$/.test(txt("r-pill")), `${at}: ${txt("r-pill")}`);
  assert.match(txt("r-text"), new RegExp(`AR0234, 2\\.8 mm lens in \\w+: ${cams} cameras cover \\d+% of the volume.* OV9281, 2\\.8 mm lens in \\w+: ${cams} cameras cover \\d+% of the volume`), at);
  assert.ok(!/no number|would cover it|fit/i.test(txt("r-text")), `${at}: ${txt("r-text")}`);
  assert.match(txt("cards"), new RegExp(`^AR0234.*?\\d+%covered with ${cams} cameras.*OV9281.*?\\d+%covered with ${cams} cameras`), at);
  assert.ok(!/over 20|no fit|with up to/i.test(txt("cards")), at);
}
set({ turn: 0, cams: 4 });
assert.strictEqual(txt("r-text"), "4 cameras for a 2.0 × 2.0 m volume in a 3.0 × 3.0 m room. AR0234, 2.8 mm lens in portrait: 4 cameras cover 80% of the volume and see the subject's back in 39% of it. OV9281, 2.8 mm lens in portrait: 4 cameras cover 54% of the volume and see the subject's back in 13% of it.");
set({ cams: 6 });
assert.strictEqual(txt("r-text"), "6 cameras for a 2.0 × 2.0 m volume in a 3.0 × 3.0 m room. AR0234, 2.8 mm lens in portrait: 6 cameras cover 89% of the volume, see the subject's back in 50% of it and track hands behind the back in 47%. OV9281, 2.8 mm lens in portrait: 6 cameras cover 60% of the volume, see the subject's back in 14% of it and track hands behind the back in 12%.");
// four cameras on that room: partial cover, still face-on, offset and rear views
set({ cams: 4 });
assert.match(txt("map-cap"), /^4 cameras cover 80% of the volume, see the subject's back in 39% and track hands behind the back in 0%; 30% stays covered with one view blocked\. The subject faces the front wall\. .* Camera 1 is face-on to the subject, the view pose models know best; camera 2 is offset to one side to make a pair with it\. Camera 3 is a rear view\./);
assert.deepStrictEqual(rows().map((r) => r.split("|").slice(1, 3).join("|")), ["face-on 0°|front wall, 1.50 m from the left corner", "offset 40°|front-left corner", "rear 139°|back wall, 0.50 m from the right corner", "offset 40°|front-right corner"]);
// the subject turning half way or all the way round in that room used to stop the page (the longest lens was picked and saw nothing)
set({ turn: 180, cams: 6 });
assert.match(txt("r-text"), /^6 cameras for a 2\.0 × 2\.0 m volume in a 3\.0 × 3\.0 m room\. AR0234, 2\.8 mm lens in portrait: 6 cameras cover \d+% of the volume/);
assert.deepStrictEqual([rows().length, rows()[0].split("|")[1]], [6, "face-on 0°"]);
set({ turn: 360 });
assert.strictEqual(rows().length, 6);
// the owner's case: 4x4 room, 2x2 volume, 6 cameras: one dead centre in front, one either side of it, three behind
set({ turn: 0, roomW: 4, roomD: 4, cams: 6 });
assert.match(txt("r-text"), /^6 cameras for a 2\.0 × 2\.0 m volume in a 4\.0 × 4\.0 m room\. AR0234, 2\.8 mm lens in portrait: 6 cameras cover the volume and see the subject's back everywhere\. Hands behind the back are tracked in 61% of it\. 11 would track hands behind the back everywhere\./);
assert.deepStrictEqual(rows(), ["1|face-on 0°|front wall, 2.00 m from the left corner|centre of the volume", "2|offset 29°|front wall, 0.50 m from the right corner|centre of the volume", "3|rear 139°|back wall, 1.00 m from the right corner|centre of the volume", "4|offset 29°|front wall, 0.50 m from the left corner|centre of the volume", "5|rear 121°|back-right corner|centre of the volume", "6|rear 121°|back-left corner|centre of the volume"]);
// a big volume in a big room with the subject turning half way round: 15 cameras on 2.8 mm cover it. Since the score (eleventh
// change) the AR0234 uses landscape facing the corner, 100 / 98 / 64%, over portrait facing the wall, 100 / 99 / 57%
set({ roomW: 8, roomD: 8, volW: 5, volD: 5, turn: 180, cams: 15 });
assert.match(txt("r-text"), /AR0234, 2\.8 mm lens in landscape: 15 cameras cover the volume\. A camera at the subject's side or behind them sees their back in 98% of it\. OV9281/);
assert.match(txt("map-cap"), /^15 cameras cover 100% of the volume, see the subject's back in 98% and track hands behind the back in 64%; 22% stays covered with one view blocked\. Turn the subject 45° to face the front-right corner in the middle of their arc\./);
assert.deepStrictEqual(rows().slice(0, 3).map((r) => r.split("|")[1]), ["face-on 0°", "offset 25°", "rear 180°"]);
// a face-on camera first: 6x6 room, 4x4 volume, turning half way round, AR0234. 2.8 mm portrait has no face-on camera at 5 to 11
// cameras (two cameras either side of straight ahead) and covers more and sees the back in more than 2.8 mm landscape, which faces
// the corner with a face-on camera; the face-on lens is used all the same (at 7: 91 / 43% over 89 / 86%). Before the face-on rule
// the AR0234 used portrait at 5 to 11 cameras; with it, no case the tests or the 360-case evaluation try puts two offset cameras
// first on the page (the engine test still covers that front view)
set({ roomW: 6, roomD: 6, volW: 4, volD: 4, turn: 180, cams: 6 });
assert.match(txt("r-text"), /^6 cameras for a 4\.0 × 4\.0 m volume in a 6\.0 × 6\.0 m room\. AR0234, 2\.8 mm lens in landscape: 6 cameras cover 72% of the volume, see the subject's back in 38% of it and track hands behind the back in 10%./);
assert.ok(!/No camera face-on/.test(txt("map-cap")), txt("map-cap"));
set({ cams: 7 });
assert.match(txt("r-text"), /AR0234, 2\.8 mm lens in landscape: 7 cameras cover 91% of the volume, see the subject's back in 43% of it/);
assert.match(txt("map-cap"), / Turn the subject 45° to face the front-right corner in the middle of their arc\./);
assert.strictEqual(rows()[0].split("|")[1], "face-on 0°");
// a room too small for the cameras asked: as many as find a spot, and the verdict says so; none at all for the OV9281
set({ turn: 0, roomW: 2, roomD: 2, volW: 1, volD: 1, cams: 20 });
assert.match(txt("r-text"), /^20 cameras for a 1\.0 × 1\.0 m volume in a 2\.0 × 2\.0 m room\. AR0234, 2\.8 mm lens in portrait: only 16 cameras find a wall spot that sees the volume, 0\.4 m or more from the others\. 16 cameras cover 88% of the volume.* OV9281, 2\.8 mm lens in portrait: only 12 cameras find a wall spot that sees the volume, 0\.4 m or more from the others\. 12 cameras cover 26% of the volume/);
assert.strictEqual(rows().length, 16);
d.getElementById("m-one").checked = true; set({ dnear: 2.5, dfar: 4 });
assert.match(txt("v-text"), /^In landscape, a full body fits from 1\.71 m/);
assert.deepStrictEqual(errs, []);
console.log("page smoke test passed");
