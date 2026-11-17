(function () {
  const { P, SENSORS, STOCK } = ENGINE;
  const $ = (id) => document.getElementById(id);
  const deg = (r) => r * 180 / Math.PI;
  const fov = (size, f) => deg(2 * Math.atan(size / (2 * f)));
  const fmt = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : "–");
  const pc = (x) => Math.floor(x * 100 + 1e-9) + "%";
  const KEY = "mocap-lens-calc-v8";
  const num = (id, def, lo) => Math.max(lo, Number.isFinite(parseFloat($(id).value)) ? parseFloat($(id).value) : def);

  // ---------- shared inputs ----------
  const chips = $("stock");
  STOCK.forEach((v) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = v.toFixed(1); b.dataset.f = v;
    b.addEventListener("click", () => { $("focal").value = v; update(); });
    chips.appendChild(b);
  });
  ["lensAR", "lensOV"].forEach((id) => {
    $(id).innerHTML = `<option value="auto">Auto</option>` + STOCK.map((f) => `<option value="${f}">${f.toFixed(1)} mm</option>`).join("");
  });

  function read() {
    return {
      mode: document.querySelector('input[name="mode"]:checked').value,
      sensor: document.querySelector('input[name="sensor"]:checked').value,
      crop: parseInt(document.querySelector('input[name="crop"]:checked').value, 10),
      f: parseFloat($("focal").value),
      N: num("fnum", 1.6, 0.5),
      dn: num("dnear", 2, 0.1),
      df: num("dfar", 5, 0.1),
      ph: num("ph", 1.8, 0.1),
      cov: num("cov", 2.2, 0.1),
      roomW: num("roomW", 6, 1), roomD: num("roomD", 6, 1),
      volW: num("volW", 3, 0.2), volD: num("volD", 3, 0.2), gap: $("gap").value === "" ? null : num("gap", 0, 0),
      minA: num("minA", 30, 0), maxA: num("maxA", 120, 0),
      turn: Math.min(360, num("turn", 0, 0)), need: Math.min(100, num("need", 100, 1)) / 100,
      cams: Math.min(ENGINE.CAP, Math.round(num("cams", 6, 2))),
      lensAR: $("lensAR").value, lensOV: $("lensOV").value
    };
  }

  // ---------- room planner ----------
  const SEN = ["ar0234", "ov9281"];
  let roomTimer = null;
  const sweepCache = new Map(), planCache = new Map();

  function sweepSizes(s) {
    const top = Math.min(s.roomW, s.roomD) - 1;
    const out = [];
    for (let L = 1.5; L <= top + 1e-9 && out.length < 12; L += 0.5) out.push(+L.toFixed(1));
    return out;
  }

  function updateRoom(s) {
    const o = { crop: s.crop, ph: s.ph, cov: s.cov, roomW: s.roomW, roomD: s.roomD,
      volW: Math.min(s.volW, s.roomW - 0.4), volD: Math.min(s.volD, s.roomD - 0.4), gap: s.gap,
      minA: s.minA, maxA: s.maxA, turn: s.turn, need: s.need };
    $("turn-out").textContent = s.turn + "°";
    $("cams-out").textContent = s.cams;
    const sizes = sweepSizes(s);
    const res = {};
    // how far a layout gets: covered, the back seen everywhere, hands behind the back tracked everywhere
    const tier = (sol) => (sol.hands >= o.need - 1e-9 ? 3 : sol.rear >= o.need - 1e-9 ? 2 : sol.ok ? 1 : 0);
    if (planCache.size > 48) planCache.clear();   // before planning, so both sensors' plans for these inputs stay (up to 12)
    SEN.forEach((sk) => {
      const ORS = ["landscape", "portrait"];
      // The sweep doesn't depend on the volume or lens pickers, so cache it per room and rule.
      const ck = JSON.stringify([sk, o.crop, o.ph, o.cov, o.roomW, o.roomD, o.gap, o.minA, o.maxA, o.turn, o.need]);
      if (!sweepCache.has(ck)) sweepCache.set(ck, sizes.length ? ORS.flatMap((or) => ENGINE.sweep(sk, Object.assign({}, o, { orient: or }), sizes)) : []);
      const rows = sweepCache.get(ck);
      const choice = sk === "ar0234" ? s.lensAR : s.lensOV;
      const isAuto = choice === "auto";
      // every lens (Auto) or the lens picked, in both orientations, and the one that does most with this many cameras;
      // plans hold the layout for every count and are kept, so moving the camera slider doesn't search again
      const plans = (isAuto ? STOCK : [parseFloat(choice)]).flatMap((f) => ORS.map((orient) => {
        const oo = Object.assign({}, o, { orient }), pk = JSON.stringify([sk, f, oo]);
        if (!planCache.has(pk)) planCache.set(pk, ENGINE.plan(sk, f, oo));
        return { f, orient, oo, P: planCache.get(pk) };
      }));
      const { f, orient, oo, sol } = ENGINE.choose(plans, s.cams);
      res[sk] = { rows, f, orient, oo, isAuto, sol, op: sol.op };
    });

    // verdict
    const a = res.ar0234, b = res.ov9281;
    const N = s.cams, CAP = ENGINE.CAP;
    // per sensor: what this many cameras do, and the counts up to CAP that would do each step they don't (equal counts
    // merged; a step no count does is left out)
    const GOALS = ["cover it", "see the subject's back", "track hands behind the back"];
    const list = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1] : xs[0]);
    const counts = (sk, from) => {
      const sol = res[sk].sol, ns = [sol.min, sol.min2, sol.min3], groups = [];
      for (let k = from; k < 3 && ns[k] != null; k++) {
        const g = groups[groups.length - 1];
        if (g && g.n === ns[k]) g.ks.push(k); else groups.push({ n: ns[k], ks: [k] });
      }
      return groups.map(({ n, ks }) => `${n} would ${list(ks.map((k) => GOALS[k]))}${ks[ks.length - 1] ? " everywhere" : ""}`).join("; ");
    };
    const more = (sk, from) => { const c = counts(sk, from); return c ? ` ${cap1(c)}.` : ""; };
    const line = (sk) => {
      const r = res[sk], sol = r.sol, n = sol.n, t = tier(sol), lens = `${SENSORS[sk].name}, ${r.f.toFixed(1)} mm lens in ${r.orient}:`, keep = `${pc(sol.spare)} stays covered with one view blocked`;
      if (!n) return `${lens} no camera on the walls can see a full body in the volume.`;
      // fewer placed than asked: the walls have no more spots that see the volume and are GAP clear of the others
      const name = lens + (n < N ? ` only ${n} cameras find a wall spot that sees the volume, ${ENGINE.GAP} m or more from the others.` : "");
      if (t === 0) return `${name} ${n} cameras cover ${pc(sol.frac)} of the volume${sol.hands ? `, see the subject's back in ${pc(sol.rear)} of it and track hands behind the back in ${pc(sol.hands)}` : sol.rear ? ` and see the subject's back in ${pc(sol.rear)} of it` : ""}.${more(sk, 0)}`;
      if (t === 1) return `${name} ${n} cameras cover the volume${n === sol.min ? ", and no fewer would" : ""}. ${sol.rear ? `A camera at the subject's side or behind them sees their back in ${pc(sol.rear)} of it` : "No camera sees the subject's back yet"}.${more(sk, 1)}`;
      if (t === 2) return `${name} ${n} cameras cover the volume and see the subject's back everywhere. ${sol.hands ? `Hands behind the back are tracked in ${pc(sol.hands)} of it` : "Hands behind the back are not tracked anywhere yet"}.${more(sk, 2)}`;
      if (n === sol.min3) return `${name} ${n} cameras cover the volume, see the subject's back and track hands behind the back everywhere, and no fewer would. ${cap1(keep)}.`;
      const extra = n - sol.min3;
      return `${name} ${n} cameras is more than this volume needs. ${cap1(counts(sk, 0))}${sol.full ? `; ${sol.full} would keep it covered with any one view blocked` : ""}. The ${extra > 1 ? extra + " cameras past " + sol.min3 + " are extra views and add" : "camera past " + sol.min3 + " is an extra view and adds"} little: with ${n}, ${keep}.`;
    };
    const cap1 = (t) => t[0].toUpperCase() + t.slice(1);
    const v = $("r-verdict");
    const vol = `${fmt(o.volW)} × ${fmt(o.volD)} m volume in a ${fmt(s.roomW)} × ${fmt(s.roomD)} m room`;
    const d = ENGINE.ahead(a.sol, b.sol);   // with the count fixed, which sensor does more with it
    v.className = "verdict" + (a.sol.ok || b.sol.ok ? " ok" : "");   // green when a sensor covers it with these cameras
    $("r-pill").textContent = Math.abs(d) < 1e-9 ? "Level" : d > 0 ? "AR0234 better" : "OV9281 better";
    $("r-text").textContent = `${N} cameras for a ${vol}. ${line("ar0234")} ${line("ov9281")}`;

    // cards
    $("cards").innerHTML = SEN.map((sk) => {
      const r = res[sk], sol = r.sol;
      const hf = fov(r.op.tanHalf * 2 * r.f, r.f);
      // person height in source pixels at the far and near ends of the usable depth
      const sn = SENSORS[sk], pxV = r.orient === "portrait" ? sn.w : sn.h;
      const hFar = o.ph * r.f / (P * r.op.far), hNear = o.ph * r.f / (P * r.op.near), y = 640 / sn.w;
      return `<button type="button" class="card" data-s="${sk}" aria-pressed="${sk === s.sensor}">
        <span class="name"><span>${SENSORS[sk].name}</span><span>${sk === s.sensor ? "on map" : "show on map"}</span></span>
        <span class="big">${sol.min ? `${sol.min}<small>cameras would cover it</small>` : `${pc(sol.frac)}<small>covered with ${sol.n} cameras</small>`}</span>
        <dl>
          <dt>Lens</dt><dd>${r.f.toFixed(1)} mm${r.isAuto ? ` (auto, best for ${N} cameras)` : ""}</dd>
          <dt>Orientation</dt><dd>${r.orient}</dd>
          <dt>Usable depth</dt><dd>${fmt(r.op.near, 2)}–${fmt(r.op.far, 2)} m</dd>
          <dt>Horizontal FOV</dt><dd>${fmt(hf, 0)}°</dd>
          <dt>Person height</dt><dd>${Math.round(hFar)}–${Math.round(hNear)} px</dd>
          <dt>Fills frame</dt><dd>${Math.round(100 * hFar / pxV)}–${Math.round(100 * hNear / pxV)}%</dd>
          <dt>In a 640 px YOLO input</dt><dd>${Math.round(hFar * y)}–${Math.round(hNear * y)} px</dd>
          ${sol.min2 ? `<dt>Back seen everywhere with</dt><dd>${sol.min2} cameras</dd>` : ""}
          ${sol.min3 ? `<dt>Hands behind back tracked with</dt><dd>${sol.min3} cameras</dd>` : ""}
          <dt>Covered with ${sol.n} cameras</dt><dd>${pc(sol.frac)}</dd>
          <dt>Back seen</dt><dd>${pc(sol.rear)}</dd>
          <dt>Hands behind back tracked</dt><dd>${pc(sol.hands)}</dd>
          <dt>With one view blocked</dt><dd>${pc(sol.spare)}</dd>
          ${s.turn < 360 ? `<dt>Subject faces</dt><dd>${sol.face ? "front-right corner" : "front wall"}</dd>` : ""}
        </dl>
      </button>`;
    }).join("");
    $("cards").querySelectorAll(".card").forEach((c) => c.addEventListener("click", () => {
      const el = document.querySelector(`input[name="sensor"][value="${c.dataset.s}"]`); el.checked = true; update();
    }));

    drawMap(s, res[s.sensor].oo, res[s.sensor], s.sensor);

    // count table: every count, the row for the plan marked, the fewest for each step tagged
    let t = `<thead><tr><th>Cameras</th>${SEN.map((sk) => `<th>${SENSORS[sk].name} covered</th><th>back seen</th><th>hands behind back</th><th>one view blocked</th>`).join("")}</tr></thead><tbody>`;
    for (let n = 2; n <= CAP; n++) {
      t += `<tr${n === N ? ' class="current"' : ""}><td>${n}</td>` + SEN.map((sk) => {
        const sol = res[sk].sol, x = sol.byN[n - 2].n === n && sol.byN[n - 2], tag = (m) => (n === m ? ' <span class="tag ok">fewest</span>' : "");
        return x ? `<td>${pc(x.frac)}${tag(sol.min)}</td><td>${pc(x.rear)}${tag(sol.min2)}</td><td>${pc(x.hands)}${tag(sol.min3)}</td><td>${pc(x.spare)}</td>` : '<td class="na">·</td>'.repeat(4);
      }).join("") + `</tr>`;
    }
    $("ntab").innerHTML = t + "</tbody>";

    // lens sweep
    $("sweeps").innerHTML = SEN.map((sk) => {
      const r = res[sk];
      if (!r.rows.length) return `<div><h3>${SENSORS[sk].name}</h3><p class="caption">Room too small for the sweep.</p></div>`;
      let h = `<div class="small-table"><h3>${SENSORS[sk].name} · cards use ${r.f.toFixed(1)} mm ${r.orient}</h3><div class="table-wrap"><table><thead><tr><th>Lens</th><th>Orient.</th>${sizes.map((L) => `<th>${fmt(L)}</th>`).join("")}</tr></thead><tbody>`;
      r.rows.forEach((row) => {
        h += `<tr${row.f === r.f && row.orient === r.orient ? ' class="pick"' : ""}><td>${row.f.toFixed(1)} mm</td><td class="na">${row.orient === "portrait" ? "port." : "land."}</td>` + row.ns.map((n) => n == null ? `<td class="na">·</td>` : `<td>${n}</td>`).join("") + `</tr>`;
      });
      return h + `</tbody></table></div></div>`;
    }).join("");
    $("sweep-cap").textContent = `Cameras needed for square volumes of each side length (m) in this ${fmt(s.roomW)} × ${fmt(s.roomD)} m room. Each lens is tried in landscape and portrait. A dot means 12 cameras do not cover that size. This is a general comparison from a quicker, coarser search: the subject always faces the front wall, and there is no face-on camera, rear view or hands behind the back, so the counts can be a camera or two off the cards above. The cards do not pick their lens from it. With Auto, every lens is planned in both orientations for your volume and the cameras you have, and the one that does most with them is used: first a lens whose layout has a camera face-on to the subject, then the highest score: the share covered, plus half the share with the subject's back seen, plus a quarter of the share with hands behind the back tracked, so 1 point more covered is worth 2 points more back seen. Ties go to the most covered, then back seen, hands and covered with one view blocked, then the fewest cameras that cover it, then the longer lens for more pixels, then landscape. With a fixed lens, the same choice is made between its two orientations. The highlighted row is the lens the cards use.`;
  }

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
      g += `<text x="${x}" y="${y + 3.6}" text-anchor="middle" font-size="10" font-weight="600" font-family="IBM Plex Mono, monospace" fill="var(--panel)">${i + 1}</text>`;
    });
    const label = (x, y, anchor, text) => { g += `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="10" font-family="IBM Plex Sans, sans-serif" fill="var(--muted)">${text}</text>`; };
    label(W / 2, Hh - 8, "middle", "front wall");
    label(X(-s.roomW / 2) + 14, Hh - 8, "start", "left"); label(X(s.roomW / 2) - 14, Hh - 8, "end", "right"); // below the wall, clear of corner cameras
    svg.innerHTML = g;

    $("map-title").textContent = `Coverage map · ${SENSORS[sk].name}, ${r.f.toFixed(1)} mm ${r.orient}, ${sol.cams.length} cameras`;
    // where a camera stands, the way you would measure it out: which wall, how far from which corner
    const where = (c) => {
      const side = c.wall === "left" || c.wall === "right", len = side ? s.roomD : s.roomW, far = c.along > len / 2, d = far ? len - c.along : c.along;
      const corner = side ? (far ? "back" : "front") : (far ? "right" : "left");
      return d < 0.1 ? `${side ? corner + "-" + c.wall : c.wall + "-" + corner} corner` : `${c.wall} wall, ${fmt(d, 2)} m from the ${corner} corner`;
    };
    const aim = ([i, j]) => (i ? `middle of the volume's ${i < 0 ? "left" : "right"} edge` : j ? `middle of the volume's ${j < 0 ? "front" : "back"} edge` : "centre of the volume");
    // what a camera is: face-on (dead ahead of the subject), offset (in front, to one side) or rear, with its angle
    // round from the way the subject faces (mid-arc); a spare is marked extra. Only camera 1 is called face-on
    const role = (c, i) => `${!i && sol.head ? "face-on" : c.behind ? "rear" : "offset"} ${Math.round(c.az)}°${c.extra ? " · extra" : ""}`;
    let t = `<thead><tr><th>#</th><th>For</th><th>Where</th><th>Aim at</th></tr></thead><tbody>`;
    sol.cams.forEach((c, i) => { t += `<tr><td>${i + 1}</td><td>${role(c, i)}</td><td>${where(c)}</td><td>${aim(c.aim)}</td></tr>`; });
    $("camtab").innerHTML = t + "</tbody>";
    const front = (s.roomD - o.volD) / 2 + sol.back, left = (s.roomW - o.volW) / 2 + (sol.side || 0);
    $("map-cap").textContent = `${sol.n} cameras cover ${pc(sol.frac)} of the volume, see the subject's back in ${pc(sol.rear)} and track hands behind the back in ${pc(sol.hands)}; ${pc(sol.spare)} stays covered with one view blocked.`
      + (s.turn >= 360 ? "" : sol.face ? ` Turn the subject 45° to face the front-right corner${s.turn ? " in the middle of their arc" : ""}.` : ` The subject faces the front wall${s.turn ? " in the middle of their arc" : ""}.`)
      + ` The volume sits ${fmt(front)} m from the front wall and ${fmt(s.roomD - o.volD - front)} m from the back wall, ${sol.side ? `${fmt(left)} m from the left wall and ${fmt(s.roomW - o.volW - left)} m from the right wall` : "centred side to side"}.`
      + (sol.head ? ` Camera 1 is face-on to the subject, the view pose models know best${sol.n > 1 && !sol.cams[1].behind ? "; camera 2 is offset to one side to make a pair with it" : ""}.` : sol.n > 1 ? " No camera face-on to the subject covers this volume, facing the wall or a corner, so cameras 1 and 2 stand either side of straight ahead instead." : "")
      + (sol.n > 2 && sol.cams[2].behind ? " Camera 3 is a rear view." : "") + ` "For" says what each camera is and its angle round from the way the subject faces${sol.cams.some((c) => c.extra) ? "; extra marks the cameras added after everything is tracked" : ""}.`
      + ` Cameras stand 5 cm off the wall and at least ${ENGINE.GAP} m apart; left and right are as drawn. Shaded wedges show where each camera fits a full body and still gets ${s.crop} px on a person.`;
  }

  // ---------- single camera (unchanged maths) ----------
  function geom(sensorKey, orient, f, s) {
    const sn = SENSORS[sensorKey];
    const pxV = orient === "portrait" ? sn.w : sn.h;
    const pxH = orient === "portrait" ? sn.h : sn.w;
    const Sv = pxV * P, Sh = pxH * P;
    return {
      pxV, pxH, Sv, Sh,
      vfov: fov(Sv, f), hfov: fov(Sh, f), dfov: fov(Math.hypot(Sv, Sh), f),
      personFar: (s.ph * 1000) * f / (P * s.df * 1000),
      personNear: (s.ph * 1000) * f / (P * s.dn * 1000),
      mmpxFar: P * s.df * 1000 / f,
      minFull: s.cov * f / Sv,
      widthNear: s.dn * Sh / f,
      fMin: s.crop * P * s.df * 1000 / (s.ph * 1000),
      fMax: Sv * s.dn / s.cov
    };
  }

  // Landscape when it works (more width to move in); portrait only when landscape can't fit the person.
  function autoOrient(sensorKey, f, s) {
    const works = (g) => g.personFar >= s.crop && g.minFull <= s.dn + 1e-9;
    const gl = geom(sensorKey, "landscape", f, s), gp = geom(sensorKey, "portrait", f, s);
    if (works(gl)) return { orient: "landscape", other: works(gp) };
    if (works(gp)) return { orient: "portrait", other: false };
    return { orient: (gp.fMax - gp.fMin) > (gl.fMax - gl.fMin) ? "portrait" : "landscape", other: false, none: true };
  }

  function drawWindow(g, f) {
    const svg = $("win");
    const lo = 1.5, hi = 8, x0 = 20, x1 = 620;
    const X = (v) => x0 + (Math.min(Math.max(v, lo), hi) - lo) / (hi - lo) * (x1 - x0);
    const ok = g.fMin <= g.fMax;
    let s = `<rect x="${x0}" y="30" width="${x1 - x0}" height="18" rx="4" fill="var(--line)"/>`;
    if (ok) s += `<rect x="${X(g.fMin)}" y="30" width="${Math.max(2, X(g.fMax) - X(g.fMin))}" height="18" rx="4" fill="var(--ok)" opacity="0.85"/>`;
    for (let v = 2; v <= 8; v++) {
      s += `<line x1="${X(v)}" x2="${X(v)}" y1="52" y2="58" stroke="var(--muted)"/>`;
      s += `<text x="${X(v)}" y="72" text-anchor="middle" font-size="11" font-family="IBM Plex Mono, monospace" fill="var(--muted)">${v} mm</text>`;
    }
    STOCK.forEach((v) => { s += `<circle cx="${X(v)}" cy="39" r="2.5" fill="var(--panel)" stroke="var(--fg)" stroke-width="1"/>`; });
    s += `<line x1="${X(f)}" x2="${X(f)}" y1="20" y2="56" stroke="var(--accent)" stroke-width="3"/>`;
    s += `<text x="${Math.min(Math.max(X(f), 46), 594)}" y="14" text-anchor="middle" font-size="12" font-weight="600" font-family="IBM Plex Mono, monospace" fill="var(--accent)">${f.toFixed(1)} mm</text>`;
    if (ok) {
      s += `<text x="${X(g.fMin)}" y="90" text-anchor="middle" font-size="10.5" font-family="IBM Plex Sans, sans-serif" fill="var(--ok)">min ${fmt(g.fMin, 2)}</text>`;
      s += `<text x="${X(g.fMax)}" y="90" text-anchor="middle" font-size="10.5" font-family="IBM Plex Sans, sans-serif" fill="var(--ok)">max ${fmt(g.fMax, 2)}</text>`;
    }
    svg.innerHTML = s;
    $("win-cap").textContent = ok
      ? `Green: focal lengths from ${fmt(g.fMin, 2)} mm (enough pixels at the far distance) to ${fmt(g.fMax, 2)} mm (full body fits at the near distance). Dots mark common cheap M12 focal lengths.`
      : `No focal length works: the far distance needs at least ${fmt(g.fMin, 2)} mm for enough pixels, but the near distance needs ${fmt(g.fMax, 2)} mm or shorter to fit the full body. Move the near point back, the far point in, or use the other sensor or orientation.`;
  }

  const metric = (k, v, s, cls) => `<div class="metric"><span class="k">${k}</span><span class="v ${cls || ""}">${v}</span><span class="s">${s}</span></div>`;
  const hyper = (f, N) => (f * f / (N * 2 * P) + f) / 1000;

  function updateSingle(s) {
    $("f-out").textContent = s.f.toFixed(1) + " mm";
    chips.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", Math.abs(parseFloat(b.dataset.f) - s.f) < 0.05 ? "true" : "false"));
    const ao = autoOrient(s.sensor, s.f, s);
    s.orient = ao.orient;
    const g = geom(s.sensor, s.orient, s.f, s);
    const pxOk = g.personFar >= s.crop, fitOk = g.minFull <= s.dn + 1e-9;
    const v = $("verdict");
    const pre = ao.none ? `Neither orientation works; closest is ${s.orient}. ` : "";
    if (pxOk && fitOk) {
      v.className = "verdict ok"; $("v-pill").textContent = "Works";
      $("v-text").textContent = `In ${s.orient}, a full body fits from ${fmt(g.minFull, 2)} m, and a person at ${fmt(s.df)} m is ${Math.round(g.personFar)} px tall, above the ${s.crop} px model crop.${s.orient === "landscape" ? (ao.other ? " Portrait would also work; landscape gives more width." : "") : " Landscape can't fit this, so portrait is used."}`;
    } else if (!fitOk && !pxOk) {
      v.className = "verdict bad"; $("v-pill").textContent = "Fails both";
      $("v-text").textContent = pre + `Too narrow to fit a full body at ${fmt(s.dn)} m (needs ${fmt(g.minFull, 2)} m), and too few pixels at ${fmt(s.df)} m (${Math.round(g.personFar)} px vs ${s.crop}).`;
    } else if (!fitOk) {
      v.className = "verdict bad"; $("v-pill").textContent = "Too narrow";
      $("v-text").textContent = pre + `A full body only fits from ${fmt(g.minFull, 2)} m, but subjects come as close as ${fmt(s.dn)} m. Use a shorter focal length.`;
    } else {
      v.className = "verdict warn"; $("v-pill").textContent = "Too few pixels";
      $("v-text").textContent = pre + `A person at ${fmt(s.df)} m is ${Math.round(g.personFar)} px tall, below the ${s.crop} px crop. Use a longer focal length, a closer far point, or the AR0234.`;
    }
    drawWindow(g, s.f);
    const H = hyper(s.f, s.N);
    $("metrics").innerHTML = [
      metric("Horizontal × vertical FOV", `${fmt(g.hfov, 0)}° × ${fmt(g.vfov, 0)}°`, `Diagonal ${fmt(g.dfov, 0)}°${g.dfov > 120 ? " · near fisheye" : ""}`, g.dfov > 120 ? "warn" : ""),
      metric(`Person at ${fmt(s.df)} m`, `${Math.round(g.personFar)} px`, `Model crop ${s.crop} px`, pxOk ? "good" : "warn"),
      metric(`Person at ${fmt(s.dn)} m`, `${Math.round(g.personNear)} px`, `of ${g.pxV} px frame height`, ""),
      metric("Full body fits from", `${fmt(g.minFull, 2)} m`, `Nearest subject ${fmt(s.dn)} m`, fitOk ? "good" : "bad"),
      metric(`Width covered at ${fmt(s.dn)} m`, `${fmt(g.widthNear, 2)} m`, `Room for sideways movement`, ""),
      metric(`Resolution at ${fmt(s.df)} m`, `${fmt(g.mmpxFar, 1)} mm/px`, `Pixel pitch 3.0 µm`, ""),
      metric("Hyperfocal distance", `${fmt(H, 2)} m`, `Focus here: sharp from ${fmt(H / 2, 2)} m to ∞ at f/${fmt(s.N)}`, ""),
      metric("Frame", `${g.pxH} × ${g.pxV}`, `${SENSORS[s.sensor].name}, ${s.orient} (auto)`, ""),
      metric("Sensor area used", `${fmt(g.Sh, 2)} × ${fmt(g.Sv, 2)} mm`, `Lens image circle ≥ ${fmt(Math.hypot(g.Sh, g.Sv), 1)} mm`, "")
    ].join("");
    let t = `<thead><tr><th>Focal length</th><th>Person at ${fmt(s.df)} m</th><th>AR0234 H × V</th><th>AR0234 full body from</th><th>OV9281 H × V</th><th>OV9281 full body from</th></tr></thead><tbody>`;
    STOCK.forEach((f) => {
      const ra = autoOrient("ar0234", f, s).orient, ro = autoOrient("ov9281", f, s).orient;
      const a = geom("ar0234", ra, f, s), o = geom("ov9281", ro, f, s);
      const ol = (x) => `<span class="tag" style="color:var(--muted)">${x === "portrait" ? "port." : "land."}</span>`;
      const tag = (gg) => {
        const okp = gg.personFar >= s.crop, okf = gg.minFull <= s.dn + 1e-9;
        return okp && okf ? `<span class="tag ok">fits</span>` : !okf ? `<span class="tag bad">narrow</span>` : `<span class="tag warn">few px</span>`;
      };
      const cur = Math.abs(f - s.f) < 0.05 ? ' class="current"' : "";
      t += `<tr${cur}><td>${f.toFixed(1)} mm</td><td>${Math.round(a.personFar)} px</td>` +
        `<td>${fmt(a.hfov, 0)}° × ${fmt(a.vfov, 0)}°${ol(ra)}</td><td>${fmt(a.minFull, 2)} m${tag(a)}</td>` +
        `<td>${fmt(o.hfov, 0)}° × ${fmt(o.vfov, 0)}°${ol(ro)}</td><td>${fmt(o.minFull, 2)} m${tag(o)}</td></tr>`;
    });
    $("cmp").innerHTML = t + "</tbody>";
  }

  // ---------- wiring ----------
  function update(evt) {
    const s = read();
    document.querySelector(".wrap").dataset.mode = s.mode;
    if (s.mode === "room") {
      // the room sweep is heavier; let typing settle first
      clearTimeout(roomTimer);
      if (evt && evt.type === "input") roomTimer = setTimeout(() => updateRoom(read()), 150);
      else updateRoom(s);
    } else {
      updateSingle(s);
    }
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }

  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved) {
      const set = (name, val) => { const el = document.querySelector(`input[name="${name}"][value="${val}"]`); if (el) el.checked = true; };
      set("mode", saved.mode); set("sensor", saved.sensor); set("crop", String(saved.crop));
      const put = (id, v) => { if (v != null && v !== "") $(id).value = v; };
      put("focal", saved.f); put("fnum", saved.N); put("dnear", saved.dn); put("dfar", saved.df);
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
})();
