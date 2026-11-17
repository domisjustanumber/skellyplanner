// The room planner page: inputs, planning (in a pool of workers when the browser has them) and rendering.
import * as ENGINE from "./engine.js";

const { SENSORS, STOCK } = ENGINE;
const $ = (id) => document.getElementById(id);
const fmt = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : "–");
const pc = (x) => Math.floor(x * 100 + 1e-9) + "%";
const KEY = "skellyplanner-v10";
const num = (id, def, lo) => Math.max(lo, Number.isFinite(parseFloat($(id).value)) ? parseFloat($(id).value) : def);

// ---------- inputs ----------
["lensAR", "lensOV"].forEach((id) => {
  $(id).innerHTML = `<option value="auto">Auto</option>` + STOCK.map((f) => `<option value="${f}">${f.toFixed(1)} mm</option>`).join("");
});

function read() {
  return {
    sensor: document.querySelector('input[name="sensor"]:checked').value,
    crop: parseInt(document.querySelector('input[name="crop"]:checked').value, 10),
    ph: num("ph", 1.8, 0.1),
    cov: num("cov", 2.2, 0.1),
    roomW: num("roomW", 6, 1), roomD: num("roomD", 6, 1),
    volW: num("volW", 3, 0.2), volD: num("volD", 3, 0.2), gap: $("gap").value === "" ? null : num("gap", 0, 0),
    minA: num("minA", 30, 0), maxA: num("maxA", 120, 0),
    turn: Math.min(360, Math.round(num("turn", 0, 0) / 90) * 90), need: Math.min(100, num("need", 100, 1)) / 100,
    cams: Math.min(ENGINE.CAP, Math.round(num("cams", 6, 2))),
    lensAR: $("lensAR").value, lensOV: $("lensOV").value
  };
}

// ---------- room planner ----------
const SEN = ["ar0234", "ov9281"];
const planCache = new Map();
const pause = () => new Promise((r) => setTimeout(r, 0));
let runId = 0, typing = null;

// Planning off the main thread: up to (cores - 1) module workers, each running ENGINE.plan() for one job at a time.
// Plans are plain data, so they come back by structured clone. drop() empties the queue when newer input arrives;
// jobs already running finish into planCache (cheaper than restarting a worker, and still correct for their inputs).
// No Worker (jsdom, old browsers): null, and run() plans on this thread in chunks instead.
const pool = typeof Worker === "undefined" ? null : (() => {
  const size = Math.max(1, Math.min((navigator.hardwareConcurrency || 2) - 1, 12));
  const idle = [], queue = [], waiting = new Map();   // waiting: plan key -> resolvers
  let made = 0;
  const done = (pk, P) => { planCache.set(pk, P); (waiting.get(pk) || []).forEach((r) => r()); waiting.delete(pk); };
  const pump = () => {
    while (queue.length && (idle.length || made < size)) {
      const w = idle.pop() || spawn(), j = queue.shift();
      w.job = j;
      w.postMessage({ sk: j.sk, f: j.f, oo: j.oo });
    }
  };
  const spawn = () => {
    made++;
    const w = new Worker(new URL("./plan.worker.js", import.meta.url), { type: "module" });
    w.onmessage = (e) => { done(w.job.pk, e.data); w.job = null; idle.push(w); pump(); };
    // a worker that fails (no module workers, a crash) gives way to this thread for its job and is not reused
    w.onerror = (e) => { e.preventDefault(); const j = w.job; made--; w.terminate(); done(j.pk, ENGINE.plan(j.sk, j.f, j.oo)); pump(); };
    return w;
  };
  return {
    plan: (j) => new Promise((r) => {
      if (planCache.has(j.pk)) return r();
      if (!waiting.has(j.pk)) { waiting.set(j.pk, []); queue.push(j); }
      waiting.get(j.pk).push(r);
      pump();
    }),
    drop: () => queue.splice(0).forEach((j) => waiting.delete(j.pk))
  };
})();

// Plans for these inputs: in the worker pool, or one ENGINE.plan() at a time with a pause between so input events and
// paints get through. A newer run (runId moved on) abandons this one; plans already made stay in planCache for it.
async function run(id) {
  const s = read();
  const o = { crop: s.crop, ph: s.ph, cov: s.cov, roomW: s.roomW, roomD: s.roomD,
    volW: Math.min(s.volW, s.roomW - 0.4), volD: Math.min(s.volD, s.roomD - 0.4), gap: s.gap,
    minA: s.minA, maxA: s.maxA, turn: s.turn, need: s.need };
  // every lens (Auto) or the lens picked, in both orientations; plans hold the layout for every count, so moving the
  // camera slider doesn't search again
  const jobs = SEN.map((sk) => {
    const choice = sk === "ar0234" ? s.lensAR : s.lensOV;
    return (choice === "auto" ? STOCK : [parseFloat(choice)]).flatMap((f) => ["landscape", "portrait"].map((orient) => {
      const oo = Object.assign({}, o, { orient });
      return { sk, f, orient, oo, pk: JSON.stringify([sk, f, oo]) };
    }));
  });
  const todo = jobs.flat().filter((j) => !planCache.has(j.pk));
  // room for all five turning stops of one room (5 x 12 plans); past that, forget the plans these inputs do not use
  if (todo.length && planCache.size + todo.length > 60) {
    const keep = new Set(jobs.flat().map((j) => j.pk));
    for (const k of planCache.keys()) if (!keep.has(k)) planCache.delete(k);
  }
  if (pool) {
    pool.drop();
    await Promise.all(todo.map(pool.plan));
  } else {
    for (const j of todo) {
      if (id !== runId) return;
      planCache.set(j.pk, ENGINE.plan(j.sk, j.f, j.oo));
      await pause();
    }
  }
  if (id !== runId) return;
  // the one that does most with this many cameras, per sensor
  const res = {};
  jobs.forEach((js, i) => {
    const { f, orient, oo, sol } = ENGINE.choose(js.map((j) => ({ f: j.f, orient: j.orient, oo: j.oo, P: planCache.get(j.pk) })), s.cams);
    res[SEN[i]] = { f, orient, oo, sol, op: sol.op };
  });
  render(s, o, res);
  $("results").removeAttribute("aria-busy");
}

function render(s, o, res) {
  // how far a layout gets: covered, the back seen everywhere, hands behind the back tracked everywhere
  const tier = (sol) => (sol.hands >= o.need - 1e-9 ? 3 : sol.rear >= o.need - 1e-9 ? 2 : sol.ok ? 1 : 0);

  // verdict: what this many cameras do with the sensor picked, the counts up to CAP that would do each step they
  // don't (equal counts merged; a step no count does is left out), then one sentence on the other sensor
  const N = s.cams, CAP = ENGINE.CAP, me = res[s.sensor].sol, oth = s.sensor === "ar0234" ? "ov9281" : "ar0234";
  const GOALS = ["cover it all", "see the back", "track hands behind the back"];
  const list = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1] : xs[0]);
  const more = (sol, from) => {
    const ns = [sol.min, sol.min2, sol.min3], groups = [];
    for (let k = from; k < 3 && ns[k] != null; k++) {
      const g = groups[groups.length - 1];
      if (g && g.n === ns[k]) g.ks.push(k); else groups.push({ n: ns[k], ks: [k] });
    }
    const c = groups.map(({ n, ks }) => `${n} would ${list(ks.map((k) => GOALS[k]))}${ks[ks.length - 1] ? " everywhere" : ""}`).join("; ");
    return c ? ` ${cap1(c)}.` : "";
  };
  const line = (sol) => {
    const n = sol.n, t = tier(sol);
    if (!n) return "No spot on the walls can see a whole person in the capture space.";
    // fewer placed than asked: the walls have no more spots that see the volume and are GAP clear of the others
    const pre = n < N ? `Only ${n} cameras fit on the walls. ` : "";
    if (t === 0) return `${pre}${n} cameras cover ${pc(sol.frac)}${sol.hands ? `, see the back in ${pc(sol.rear)} and track hands behind the back in ${pc(sol.hands)}` : sol.rear ? ` and see the back in ${pc(sol.rear)}` : ""}.${more(sol, 0)}`;
    if (t === 1) return `${pre}${n} cameras cover it all${n === sol.min ? " (no fewer would)" : ""}. ${sol.rear ? `They see the back in ${pc(sol.rear)}` : "No camera sees the back yet"}.${more(sol, 1)}`;
    if (t === 2) return `${pre}${n} cameras cover it all and see the back everywhere. ${sol.hands ? `Hands behind the back are tracked in ${pc(sol.hands)}` : "Hands behind the back are not tracked yet"}.${more(sol, 2)}`;
    if (n === sol.min3) return `${pre}${n} cameras cover it all, see the back and track hands behind the back everywhere. No fewer would.`;
    return `${pre}${n} cameras is more than you need: ${sol.min3} do it all.${sol.full ? ` ${sol.full} keep it all covered when one view is blocked.` : ""}`;
  };
  const other = res[oth].sol, d = ENGINE.ahead(res.ar0234.sol, res.ov9281.sol);   // with the count fixed, which sensor does more with it
  $("r-verdict").className = "verdict" + (me.ok ? " ok" : "");   // green when the sensor picked covers it with these cameras
  $("r-pill").textContent = Math.abs(d) < 1e-9 ? "Level" : d > 0 ? "AR0234 better" : "OV9281 better";
  $("r-text").textContent = `${line(me)} ${other.n ? `The ${SENSORS[oth].name} covers ${pc(other.frac)} with ${other.n} cameras.` : `The ${SENSORS[oth].name} can't see it from the walls.`}`;

  drawMap(s, res[s.sensor].oo, res[s.sensor], s.sensor);

  // count table: every count, the row for the plan marked, the fewest for each step tagged
  let t = `<thead><tr><th>Cameras</th><th>Covered</th><th>Back seen</th><th>Hands behind back</th><th>One view blocked</th></tr></thead><tbody>`;
  for (let n = 2; n <= CAP; n++) {
    const x = me.byN[n - 2].n === n && me.byN[n - 2], tag = (m) => (n === m ? ' <span class="tag ok">fewest</span>' : "");
    t += `<tr${n === N ? ' class="current"' : ""}><td>${n}</td>` + (x ? `<td>${pc(x.frac)}${tag(me.min)}</td><td>${pc(x.rear)}${tag(me.min2)}</td><td>${pc(x.hands)}${tag(me.min3)}</td><td>${pc(x.spare)}</td>` : '<td class="na">·</td>'.repeat(4)) + `</tr>`;
  }
  $("ntab").innerHTML = t + "</tbody>";
}

const cap1 = (t) => t[0].toUpperCase() + t.slice(1);

function drawMap(s, o, r, sk) {
  const sol = r.sol, op = r.op;
  const W = 400, pad = 14;
  const k = (W - 2 * pad) / Math.max(s.roomW, s.roomD);
  const Hh = s.roomD * k + 2 * pad + 14; // extra room below the front wall for its labels
  const svg = $("map");
  svg.setAttribute("viewBox", `0 0 ${W} ${Hh.toFixed(1)}`);
  // origin = volume centre; the room centre is sol.back metres in front of it and sol.side to its left
  const side = sol.side || 0, cx = W / 2 + side * k, cy = Hh / 2 - 7 - sol.back * k;
  const X = (x) => cx + x * k, Y = (y) => cy - y * k;
  let g = `<defs><clipPath id="room-clip"><rect x="${X(-s.roomW / 2 - side)}" y="${Y(s.roomD / 2 - sol.back)}" width="${s.roomW * k}" height="${s.roomD * k}"/></clipPath></defs>`;
  g += `<rect x="${X(-s.roomW / 2 - side)}" y="${Y(s.roomD / 2 - sol.back)}" width="${s.roomW * k}" height="${s.roomD * k}" fill="var(--bg)" stroke="var(--muted)" stroke-width="1.5"/>`;
  g += `<g clip-path="url(#room-clip)">`;
  const half = Math.atan(op.tanHalf);
  sol.cams.forEach((c) => {
    const base = Math.atan2(c.ay, c.ax);
    const pts = [];
    for (let i = 0; i <= 16; i++) { const a = base - half + 2 * half * i / 16; pts.push([c.x + op.near * Math.cos(a), c.y + op.near * Math.sin(a)]); }
    for (let i = 16; i >= 0; i--) { const a = base - half + 2 * half * i / 16; pts.push([c.x + op.far * Math.cos(a), c.y + op.far * Math.sin(a)]); }
    g += `<polygon points="${pts.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(" ")}" fill="var(--accent)" fill-opacity="0.07" stroke="var(--accent)" stroke-opacity="0.35" stroke-width="0.8"/>`;
  });
  g += `</g>`;
  g += `<rect x="${X(-o.volW / 2)}" y="${Y(o.volD / 2)}" width="${o.volW * k}" height="${o.volD * k}" fill="none" stroke="var(--fg)" stroke-width="1.5"/>`;
  // covered: an empty ring; and the back seen: a small dot; and hands behind the back tracked: a big dot
  const col = ["var(--bad)", "var(--warn)", "var(--warn)"];
  sol.pts.forEach(([x, y], i) => {
    const st = sol.state[i], at = `data-s="${st}" cx="${X(x).toFixed(1)}" cy="${Y(y).toFixed(1)}"`;
    g += st < 3 ? `<circle ${at} r="2.1" fill="${col[st]}"/>` : st === 3 ? `<circle ${at} r="1.9" fill="none" stroke="var(--ok)" stroke-width="0.8"/>` : `<circle ${at} r="${st === 4 ? 1.1 : 2.4}" fill="var(--ok)"/>`;
  });
  // subject at the volume centre: wedge = turning arc, line = facing at mid-arc (front wall or front-right corner)
  const rr = 0.6 * k, h = s.turn / 2, fa = sol.face || 0;
  const px = (d) => (cx + rr * Math.sin(d * Math.PI / 180)).toFixed(1), py = (d) => (cy + rr * Math.cos(d * Math.PI / 180)).toFixed(1);
  if (s.turn >= 360) g += `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="var(--fg)" fill-opacity="0.25" stroke="var(--fg)" stroke-width="1"/>`;
  else if (s.turn > 0) g += `<path d="M${cx},${cy} L${px(fa - h)},${py(fa - h)} A${rr},${rr} 0 ${s.turn > 180 ? 1 : 0} 0 ${px(fa + h)},${py(fa + h)} Z" fill="var(--fg)" fill-opacity="0.25" stroke="var(--fg)" stroke-width="1"/>`;
  g += `<line x1="${cx}" y1="${cy}" x2="${px(fa)}" y2="${py(fa)}" stroke="var(--fg)" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="3" fill="var(--fg)"/>`;
  sol.cams.forEach((c, i) => {
    const x = X(c.x), y = Y(c.y);
    g += `<line x1="${x}" y1="${y}" x2="${X(c.x + c.ax * 0.45)}" y2="${Y(c.y + c.ay * 0.45)}" stroke="var(--fg)" stroke-width="2"/>`;
    g += `<circle cx="${x}" cy="${y}" r="9" fill="var(--accent)" stroke="var(--panel)" stroke-width="1.5"/>`;
    g += `<text x="${x}" y="${y + 3.6}" text-anchor="middle" font-size="10" font-weight="600" font-family="JetBrains Mono, monospace" fill="var(--panel)">${i + 1}</text>`;
  });
  const label = (x, y, anchor, text) => { g += `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="10" font-family="system-ui, sans-serif" fill="var(--muted)">${text}</text>`; };
  label(W / 2, Hh - 8, "middle", "front wall");
  label(X(-s.roomW / 2) + 14, Hh - 8, "start", "left"); label(X(s.roomW / 2) - 14, Hh - 8, "end", "right"); // below the wall, clear of corner cameras
  svg.innerHTML = g;

  $("map-title").textContent = `Camera layout · ${SENSORS[sk].name}, ${r.f.toFixed(1)} mm lens, ${r.orient}`;
  // where a camera stands, the way you would measure it out: which wall, how far from which corner
  const where = (c) => {
    const side = c.wall === "left" || c.wall === "right", len = side ? s.roomD : s.roomW, far = c.along > len / 2, d = far ? len - c.along : c.along;
    const corner = side ? (far ? "back" : "front") : (far ? "right" : "left");
    return cap1(d < 0.1 ? `${side ? corner + "-" + c.wall : c.wall + "-" + corner} corner` : `${c.wall} wall, ${fmt(d)} m from ${corner} corner`);
  };
  const aim = ([i, j]) => (i ? `${i < 0 ? "Left" : "Right"} edge` : j ? `${j < 0 ? "Front" : "Back"} edge` : "Centre");
  // what a camera is: head-on (dead ahead of the person), front (in front, to one side), back, or a spare added after
  // everything is tracked; only camera 1 is called head-on. The angle round from the way the person faces is in the title
  const role = (c, i) => (c.extra ? "Spare" : !i && sol.head ? "Head-on" : c.behind ? "Back" : "Front");
  let t = `<thead><tr><th>#</th><th>View</th><th>Where</th><th>Aim at</th></tr></thead><tbody>`;
  sol.cams.forEach((c, i) => { t += `<tr><td>${i + 1}</td><td title="${Math.round(c.az)}° from where the person faces">${role(c, i)}</td><td>${where(c)}</td><td>${aim(c.aim)}</td></tr>`; });
  $("camtab").innerHTML = t + "</tbody>";
  const front = (s.roomD - o.volD) / 2 + sol.back, left = (s.roomW - o.volW) / 2 + (sol.side || 0);
  const faces = s.turn >= 360 ? "" : `The person faces the ${sol.face ? "front-right corner" : "front wall"}${s.turn ? " (middle of their turn)" : ""}; `;
  $("map-cap").textContent = cap1(`${faces}the capture space starts ${fmt(front)} m from the front wall, ${sol.side ? `${fmt(left)} m from the left wall` : "centred side to side"}.`)
    + ` Mount cameras on the walls, at least ${ENGINE.GAP} m apart.`;
}

// ---------- wiring ----------
// Readouts now; the results are marked stale (CSS dims them only if they take over 100 ms) and planned after the next
// paint. Typing in a number box waits 150 ms for the next key.
const later = window.requestAnimationFrame ? (fn) => requestAnimationFrame(() => setTimeout(fn, 0)) : (fn) => setTimeout(fn, 0);
function update(evt) {
  const s = read();
  if (String(s.turn) !== $("turn").value) $("turn").value = s.turn;   // a saved turn between stops snaps to the one read() uses
  $("turn-out").textContent = s.turn + "°";
  $("cams-out").textContent = s.cams;
  $("results").setAttribute("aria-busy", "true");
  const id = ++runId;
  clearTimeout(typing);
  if (evt && evt.type === "input" && evt.target.type === "number") typing = setTimeout(() => later(() => run(id)), 150);
  else later(() => run(id));
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
}

try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "null");
  if (saved) {
    const set = (name, val) => { const el = document.querySelector(`input[name="${name}"][value="${val}"]`); if (el) el.checked = true; };
    set("sensor", saved.sensor); set("crop", String(saved.crop));
    const put = (id, v) => { if (v != null && v !== "") $(id).value = v; };
    put("ph", saved.ph); put("cov", saved.cov); put("roomW", saved.roomW); put("roomD", saved.roomD);
    put("volW", saved.volW); put("volD", saved.volD); put("gap", saved.gap); put("minA", saved.minA); put("maxA", saved.maxA);
    put("turn", saved.turn); put("cams", saved.cams); if (saved.need) put("need", Math.round(saved.need * 100));
    put("lensAR", saved.lensAR); put("lensOV", saved.lensOV);
    ["lensAR", "lensOV"].forEach((id) => { if ($(id).value === "") $(id).value = "auto"; });  // a saved lens no longer in the list
  }
} catch (e) {}

$("calc").addEventListener("input", update);
$("calc").addEventListener("change", update);
update();
