// Smoke test: load src/main.js against index.html in jsdom, exercise the room planner, fail on script errors.
// Texts and numbers re-pinned on 17 Nov 2026 (face-on camera first, pair-angle band from 30 degrees); see HANDOFF.md.
// Re-pinned again on 17 Nov 2026 for the three-lens list (2.8 / 3.6 / 6.0 mm): 2.1 and 3.2 mm picks became 2.8 mm; see HANDOFF.md.
// And again on 17 Nov 2026 (ninth change): Auto plans every lens in both orientations and uses the one that does most with the cameras asked.
// And on 17 Nov 2026 (tenth change): no fit / no-fit flag any more. A step no count up to 20 reaches is not mentioned, the "Why" box is gone,
// and the verdict is green when a sensor covers the volume with the cameras asked, plain otherwise.
// And on 17 Nov 2026 (eleventh change): Auto puts a lens with a face-on camera first, then ranks by a score, covered + back seen / 2 +
// hands tracked / 4. Pins moved: the 8x8 room at 15 cameras (AR0234 now landscape facing the corner) and the 6x6 room, 4x4 volume at
// 180 degrees (AR0234 now landscape with a face-on camera at 6 and 7, was portrait with two offset cameras at 6).
// And on 17 Nov 2026 (twelfth change): plain-English copy, docs.freemocap.org styling, room planner only. Only the wording and layout
// moved: the cards, the lens table, the long notes and the single-camera tool are gone; the verdict and count table speak for the
// sensor picked (the other gets one sentence); the camera table's angles moved to a title (rows() reads them back); the map caption
// is two sentences, so the shares it used to repeat are checked on the count table's highlighted row. Every number is the same as before.
import assert from "node:assert";
import fs from "node:fs";
import { JSDOM } from "jsdom";
// index.html's markup in jsdom (its scripts not run), then the page module itself on node's side with jsdom's window and
// document as globals. jsdom has no Worker, so the page plans on this thread (its fallback).
const dom = new JSDOM(fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"));
const d = dom.window.document, errs = [];
process.on("unhandledRejection", (e) => errs.push(String(e && e.stack || e)));
Object.assign(globalThis, { window: dom.window, document: d });
await import("../src/main.js");
const fire = () => d.getElementById("calc").dispatchEvent(new dom.window.Event("change"));
const txt = (id) => d.getElementById(id).textContent.replace(/\s+/g, " ").trim();
// camera table rows, with the View cell's angle (in its title) put back after the word: "1|Head-on 0°|Front wall, ...|Centre"
const rows = () => [...d.querySelectorAll("#camtab tbody tr")].map((r) => [...r.children].map((c) => c.textContent + (c.title ? " " + c.title.split(" ")[0] : "")).join("|"));
const marks = (st) => d.querySelectorAll(`#map circle[data-s="${st}"]`).length;   // 3: covered only (ring), 4: and the back seen (small dot), 5: and hands tracked (big dot)
// the page plans after the next paint and in chunks, and marks the results aria-busy until it has rendered
const busy = () => d.getElementById("results").getAttribute("aria-busy") === "true";
const settle = async () => { for (let i = 0; busy(); i++) { assert.ok(i < 6000, "results never settled"); await new Promise((r) => setTimeout(r, 5)); } };
const set = async (o) => { for (const k in o) d.getElementById(k).value = o[k]; fire(); await settle(); };
const sensor = async (id) => { d.getElementById(id).checked = true; fire(); await settle(); };
const cur = () => d.querySelector("#ntab tr.current").textContent;   // the count table's row for the cameras asked
const fewest = () => [...d.querySelectorAll("#ntab tbody tr")].find((r) => /fewest/.test(r.children[1].textContent)).children[0].textContent;   // fewest that cover it

(async () => {
await settle();
// room planner only: no tool toggle, no single-camera sections; no cards, lens table or planner notes
assert.deepStrictEqual(["m-room", "m-one", "focal", "fnum", "dnear", "dfar", "win", "cmp", "metrics", "cards", "sweeps", "sweep-cap", "r-why"].map((id) => d.getElementById(id)), Array(13).fill(null));
assert.ok(!/One lens per sensor|How the room planner decides|score|Check one camera|Lens Calculator/i.test(d.querySelector(".wrap").textContent));
assert.strictEqual(d.querySelector("h1").textContent, "FreeMoCap room planner");
assert.strictEqual(d.querySelector("details.more summary").textContent, "More or fewer cameras");
// default 6x6 room, 3x3 volume, 6 cameras: a head-on camera, one either side of it and three behind; the verdict says how many would do the rest
assert.deepStrictEqual([d.getElementById("turn").value, d.getElementById("cams").value, txt("cams-out"), d.getElementById("minA").value], ["0", "6", "6", "30"]);
assert.strictEqual(txt("r-pill"), "AR0234 better");
assert.strictEqual(txt("r-text"), "6 cameras cover it all and see the back everywhere. Hands behind the back are tracked in 90%. 7 would track hands behind the back everywhere. The OV9281 covers 100% with 6 cameras.");
assert.strictEqual(rows().length, 6, "all six cameras are in the table");
assert.strictEqual(d.querySelectorAll("#map text[font-weight]").length, 6, "and on the map");
assert.strictEqual(txt("map-title"), "Camera layout · AR0234, 2.8 mm lens, portrait");
assert.strictEqual(txt("map-cap"), "The person faces the front wall; the capture space starts 2.1 m from the front wall, centred side to side. Mount cameras on the walls, at least 0.4 m apart.");
assert.deepStrictEqual(rows().map((r) => r.split("|")[1]), ["Head-on 0°", "Front 23°", "Back 168°", "Front 23°", "Back 133°", "Back 133°"], "what each camera is: head-on, a front camera, a back view, then the rest");
assert.strictEqual(rows()[0], "1|Head-on 0°|Front wall, 3.0 m from left corner|Centre");
assert.strictEqual(new Set(rows().map((r) => r.split("|")[2])).size, 6, "six different spots");
assert.deepStrictEqual([marks(3), marks(4), marks(5)], [0, 58, 567], "the back is seen everywhere; 254 spots lack the second rear view");
assert.strictEqual(d.querySelectorAll("#ntab tbody tr").length, 19, "a row for every count from 2 to 20");
assert.strictEqual(d.querySelectorAll("#ntab thead th").length, 5, "the sensor picked only");
assert.strictEqual(cur(), "6100%100%90%77%");
// the OV9281 picked: the map, verdict and count table follow it
await sensor("s-ov");
assert.strictEqual(txt("map-title"), "Camera layout · OV9281, 2.8 mm lens, landscape");
assert.strictEqual(txt("r-text"), "6 cameras cover it all and see the back everywhere. Hands behind the back are tracked in 44%. The AR0234 covers 100% with 6 cameras.");
assert.strictEqual(cur(), "6100%100%44%37%");
await sensor("s-ar");
// latest input wins: a run still planning for 180 degrees is dropped when the turn goes back to 0
d.getElementById("turn").value = 180; fire();
await set({ turn: 0 });
assert.strictEqual(txt("r-text"), "6 cameras cover it all and see the back everywhere. Hands behind the back are tracked in 90%. 7 would track hands behind the back everywhere. The OV9281 covers 100% with 6 cameras.");
// a slider move updates its readout at once and marks the results stale until the new plan is drawn
d.getElementById("cams").value = 12; d.getElementById("cams").dispatchEvent(new dom.window.Event("input", { bubbles: true }));
assert.deepStrictEqual([txt("cams-out"), busy(), txt("r-text").startsWith("6 cameras")], ["12", true, true]);
await settle();
// more than enough: says so and names the counts
await set({ cams: 12 });
assert.strictEqual(txt("r-text"), "12 cameras is more than you need: 7 do it all. 11 keep it all covered when one view is blocked. The OV9281 covers 100% with 12 cameras.");
assert.strictEqual(cur(), "12100%100%100%100%");
assert.deepStrictEqual([rows().length, rows().filter((r) => /^\d+\|Spare/.test(r)).length, rows()[8].split("|")[1], rows()[9].split("|")[1]], [12, 5, "Spare 10°", "Spare 10°"], "the five spares come last");
await set({ cams: 8 });
assert.match(txt("r-text"), /^8 cameras is more than you need: 7 do it all\./);
// exactly enough for the AR0234: all three steps, no fewer would
await set({ cams: 7 });
assert.match(txt("r-text"), /^7 cameras cover it all, see the back and track hands behind the back everywhere\. No fewer would\. The OV9281/);
assert.match(cur(), /^7100%100%100% fewest88%$/);
// five: the head-on camera, a mirrored pair in front and a mirrored pair behind, on five different spots
await set({ cams: 5 });
assert.deepStrictEqual(rows(), ["1|Head-on 0°|Front wall, 3.0 m from left corner|Centre", "2|Front 23°|Front wall, 1.5 m from right corner|Centre", "3|Back 133°|Back wall, 0.5 m from left corner|Centre", "4|Front 23°|Front wall, 1.5 m from left corner|Centre", "5|Back 133°|Back wall, 0.5 m from right corner|Centre"]);
// three: head-on, front and a back view
await set({ cams: 3 });
assert.strictEqual(txt("r-text"), "3 cameras cover 96% and see the back in 95%. 4 would cover it all and see the back everywhere; 7 would track hands behind the back everywhere. The OV9281 covers 95% with 3 cameras.");
assert.deepStrictEqual(rows(), ["1|Head-on 0°|Front wall, 3.0 m from left corner|Centre", "2|Front 42°|Right wall, 1.0 m from front corner|Centre", "3|Back 119°|Back-right corner|Centre"]);
assert.deepStrictEqual([marks(3), marks(4), marks(5)], [6, 598, 0], "the back is seen in all but 17 of the covered spots");
// two: head-on and front; too few to cover it all, with the counts that would do each step
await set({ cams: 2 });
assert.strictEqual(txt("r-text"), "2 cameras cover 91%. 4 would cover it all and see the back everywhere; 7 would track hands behind the back everywhere. The OV9281 covers 89% with 2 cameras.");
assert.deepStrictEqual([rows().length, d.getElementById("r-verdict").className, marks(3)], [2, "verdict", 569], "too few to cover it: a plain verdict, not a warning");
assert.match(txt("map-cap"), /^The person faces the front wall; the capture space starts 2\.8 m from the front wall, centred side to side\./);
assert.match(cur(), /^291%0%0%0%/);
await set({ cams: 3 });
await set({ gap: 1.5 });
assert.match(txt("map-cap"), /the capture space starts 1\.5 m from the front wall, centred side to side/);
await set({ gap: "" });
await set({ volW: 2, volD: 2 });
const n0 = +fewest();
await set({ turn: 45 });   // between stops: snaps to 90, and the slider shows what read() uses
assert.deepStrictEqual([txt("turn-out"), d.getElementById("turn").value], ["90°", "90"]);
assert.ok(+fewest() > n0, "turning arc raises the camera count");
// 3x3 room, 2x2 volume: the front wall is too close for a face-on camera there (no corner facing any more at 2.8 mm), and no count up to 20
// covers it all. The page says what the cameras do, with no warning and nothing about the steps no count reaches
await set({ roomW: 3, roomD: 3, turn: 0 });
assert.strictEqual(txt("r-text"), "3 cameras cover 69% and see the back in 57%. The OV9281 covers 43% with 3 cameras.");
for (const turn of [0, 180, 360]) for (const cams of [4, 6]) {
  await set({ turn, cams });
  const at = `arc ${turn}, ${cams} cameras`;
  assert.deepStrictEqual([errs, d.getElementById("r-verdict").className, rows().length], [[], "verdict", cams], at);
  assert.ok(/^(Level|AR0234 better|OV9281 better)$/.test(txt("r-pill")), `${at}: ${txt("r-pill")}`);
  assert.match(txt("r-text"), new RegExp(`^${cams} cameras cover \\d+%.* The OV9281 covers \\d+% with ${cams} cameras\\.$`), at);
  assert.ok(!/no number|would cover it|fit/i.test(txt("r-text")), `${at}: ${txt("r-text")}`);
}
await set({ turn: 0, cams: 4 });
assert.strictEqual(txt("r-text"), "4 cameras cover 80% and see the back in 39%. The OV9281 covers 54% with 4 cameras.");
await set({ cams: 6 });
assert.strictEqual(txt("r-text"), "6 cameras cover 89%, see the back in 50% and track hands behind the back in 47%. The OV9281 covers 60% with 6 cameras.");
// four cameras on that room: partial cover, still head-on, front and back views
await set({ cams: 4 });
assert.match(txt("map-cap"), /^The person faces the front wall; /);
assert.match(cur(), /^480%39%0%30%/);
assert.deepStrictEqual(rows().map((r) => r.split("|").slice(1, 3).join("|")), ["Head-on 0°|Front wall, 1.5 m from left corner", "Front 40°|Front-left corner", "Back 139°|Back wall, 0.5 m from right corner", "Front 40°|Front-right corner"]);
// the subject turning half way or all the way round in that room used to stop the page (the longest lens was picked and saw nothing)
await set({ turn: 180, cams: 6 });
assert.match(txt("r-text"), /^6 cameras cover \d+%/);
assert.strictEqual(txt("map-title"), "Camera layout · AR0234, 2.8 mm lens, portrait");
assert.deepStrictEqual([rows().length, rows()[0].split("|")[1]], [6, "Head-on 0°"]);
await set({ turn: 360 });
assert.strictEqual(rows().length, 6);
// the owner's case: 4x4 room, 2x2 volume, 6 cameras: one dead centre in front, one either side of it, three behind
await set({ turn: 0, roomW: 4, roomD: 4, cams: 6 });
assert.match(txt("r-text"), /^6 cameras cover it all and see the back everywhere\. Hands behind the back are tracked in 61%\. 11 would track hands behind the back everywhere\./);
assert.deepStrictEqual(rows(), ["1|Head-on 0°|Front wall, 2.0 m from left corner|Centre", "2|Front 29°|Front wall, 0.5 m from right corner|Centre", "3|Back 139°|Back wall, 1.0 m from right corner|Centre", "4|Front 29°|Front wall, 0.5 m from left corner|Centre", "5|Back 121°|Back-right corner|Centre", "6|Back 121°|Back-left corner|Centre"]);
// a big volume in a big room with the subject turning half way round: 15 cameras on 2.8 mm cover it. Since the score (eleventh
// change) the AR0234 uses landscape facing the corner, 100 / 98 / 64%, over portrait facing the wall, 100 / 99 / 57%
await set({ roomW: 8, roomD: 8, volW: 5, volD: 5, turn: 180, cams: 15 });
assert.match(txt("r-text"), /^15 cameras cover it all\. They see the back in 98%\. /);
assert.strictEqual(txt("map-title"), "Camera layout · AR0234, 2.8 mm lens, landscape");
assert.match(txt("map-cap"), /^The person faces the front-right corner \(middle of their turn\); /);
assert.match(cur(), /^15100%( fewest)?98%64%22%/);
assert.deepStrictEqual(rows().slice(0, 3).map((r) => r.split("|")[1]), ["Head-on 0°", "Front 25°", "Back 180°"]);
// a face-on camera first: 6x6 room, 4x4 volume, turning half way round, AR0234. 2.8 mm portrait has no face-on camera at 5 to 11
// cameras (two cameras either side of straight ahead) and covers more and sees the back in more than 2.8 mm landscape, which faces
// the corner with a face-on camera; the face-on lens is used all the same (at 7: 91 / 43% over 89 / 86%). Before the face-on rule
// the AR0234 used portrait at 5 to 11 cameras; with it, no case the tests or the 360-case evaluation try puts two offset cameras
// first on the page (the engine test still covers that front view)
await set({ roomW: 6, roomD: 6, volW: 4, volD: 4, turn: 180, cams: 6 });
assert.match(txt("r-text"), /^6 cameras cover 72%, see the back in 38% and track hands behind the back in 10%\./);
assert.strictEqual(txt("map-title"), "Camera layout · AR0234, 2.8 mm lens, landscape");
assert.strictEqual(rows()[0].split("|")[1], "Head-on 0°");
await set({ cams: 7 });
assert.match(txt("r-text"), /^7 cameras cover 91%, see the back in 43%/);
assert.match(txt("map-cap"), /^The person faces the front-right corner \(middle of their turn\); /);
assert.strictEqual(rows()[0].split("|")[1], "Head-on 0°");
// a room too small for the cameras asked: as many as find a spot, and the verdict says so
await set({ turn: 0, roomW: 2, roomD: 2, volW: 1, volD: 1, cams: 20 });
assert.match(txt("r-text"), /^Only 16 cameras fit on the walls\. 16 cameras cover 88%.* The OV9281 covers 26% with 12 cameras\.$/);
assert.strictEqual(rows().length, 16);
assert.deepStrictEqual(errs, []);
console.log("page smoke test passed");
})().catch((e) => { console.error(e); process.exit(1); });
