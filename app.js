(function () {
  "use strict";
  const W = window.WALL;
  const SVGNS = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);

  /* ---------- Data ---------- */
  const sections = new Map(W.sections.map((s) => [s.key, s]));
  // Only the color family slot labels (like GN4-7) match real positions; side panel labels do not.
  const isCore = (sec) => /^[ROYGBP][PMSN]$/.test(sec);
  // Defense in depth: skip any chip whose data is not the expected shape.
  const HEX = /^[0-9a-f]{6}$/i;
  const chips = W.chips
    .filter((c) => Array.isArray(c) && HEX.test(c[2]) && sections.has(c[3]) && Number.isInteger(c[4]) && Number.isInteger(c[5]) && typeof c[0] === "string" && typeof c[1] === "string")
    .map((c, i) => ({ i, name: c[0], code: c[1], hex: "#" + c[2], sec: c[3], r: c[4], c: c[5], slot: isCore(c[3]) ? String(c[6] || "") : "" }));

  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const compact = (s) => norm(s).replace(/ /g, "");

  // One entry per color (a color can sit in more than one slot).
  const byKey = new Map();
  chips.forEach((ch) => {
    const k = ch.name.toLowerCase() + "|" + ch.code.toLowerCase();
    if (!byKey.has(k)) {
      const n = norm(ch.name);
      byKey.set(k, { name: ch.name, code: ch.code, hex: ch.hex, spots: [], nameN: n, nameC: n.replace(/ /g, ""), words: n.split(" "), codeC: compact(ch.code), slotsC: [] });
    }
    byKey.get(k).spots.push(ch);
    if (ch.slot) byKey.get(k).slotsC.push(compact(ch.slot));
  });
  const colors = [...byKey.values()];
  const byCode = new Map();
  colors.forEach((c) => { if (!byCode.has(c.codeC)) byCode.set(c.codeC, c); });
  $("count").textContent = colors.length.toLocaleString();

  /* ---------- Search with typo tolerance ---------- */
  function dist(a, b, max) {
    // Optimal string alignment distance, stops early once it exceeds max.
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const m = a.length, n = b.length;
    let prev2 = null, prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur.push(v);
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev2 = prev; prev = cur;
    }
    return prev[n];
  }
  const allowed = (len) => (len <= 3 ? 0 : len <= 5 ? 1 : 2);

  function score(c, qn, qc, toks) {
    if (!qc) return 0;
    if (c.codeC === qc) return 1000;
    if (c.nameC === qc) return 950;
    if (qc.length >= 3 && c.slotsC.includes(qc)) return 940;
    if (qc.length >= 2 && c.codeC.startsWith(qc)) return 900 - (c.codeC.length - qc.length);
    if (c.nameN.startsWith(qn)) return 850 - (c.nameN.length - qn.length) / 10;
    if (c.words.some((w) => w.startsWith(qc))) return 800;
    if (c.nameC.includes(qc)) return 700;
    if (qc.length >= 3 && c.codeC.includes(qc)) return 650;
    // Typo tolerant: every typed word must closely match some word in the name.
    let total = 0;
    for (const t of toks) {
      const lim = allowed(t.length);
      let best = lim + 1;
      for (const w of c.words) {
        best = Math.min(best, dist(t, w, lim), dist(t, w.slice(0, t.length), lim));
        if (best === 0) break;
      }
      if (best > lim) { total = -1; break; }
      total += best;
    }
    if (total >= 0) return 500 - total * 40;
    const lim = allowed(qc.length);
    const d = dist(qc, c.nameC, lim);
    if (d <= lim) return 480 - d * 40;
    if (qc.length >= 4) {
      const dc = dist(qc, c.codeC, 1);
      if (dc <= 1) return 450;
    }
    return 0;
  }

  function search(q) {
    const qn = norm(q), qc = qn.replace(/ /g, "");
    if (!qc) return [];
    const toks = qn.split(" ").filter(Boolean);
    const out = [];
    for (const c of colors) {
      const s = score(c, qn, qc, toks);
      if (s > 0) out.push([s, c]);
    }
    out.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name));
    return out.slice(0, 12).map((x) => x[1]);
  }

  /* ---------- Wall layout ---------- */
  const FAMILY = ["R", "O", "Y", "G", "B", "P"];
  const FAMILY_NAME = { R: "Reds", O: "Oranges", Y: "Yellows", G: "Greens", B: "Blues", P: "Purples" };
  const panels = FAMILY.map((h) => ({ title: FAMILY_NAME[h], keys: ["P", "M", "S", "N"].map((b) => h + b), cw: 10, gap: 2 }))
    .concat([
      { title: "Whites & Neutrals", keys: ["white", "warm", "cool"], cw: 10, gap: 2 },
      { title: "One Coat Hide", keys: ["och"], cw: 10, gap: 2 },
      { title: "Designer", keys: ["dc"], cw: 24, gap: 3 },
    ]);
  const PAD = 22, TOP = 16, LBL = 10, PANEL_GAP = 10;
  const coreRows = ["P", "M", "S", "N"].reduce((a, b) => a + sections.get("R" + b).rows, 0);
  const H = TOP + 4 * LBL + coreRows * 9; // core panel height sets the wall height
  const pos = new Map(); // "sec-r-c" -> rect
  const regions = new Map(); // section key -> rect
  const panelOf = new Map(); // section key -> panel index
  let x = PAD;
  const parts = [];
  panels.forEach((p, pi) => {
    const secs = p.keys.map((k) => sections.get(k)).filter(Boolean);
    const cols = Math.max(...secs.map((s) => s.cols));
    const pw = cols * (p.cw + p.gap) - p.gap;
    const totalRows = secs.reduce((a, s) => a + s.rows, 0);
    const showLbl = secs.length > 1;
    const pitch = (H - TOP - (showLbl ? secs.length * LBL : 0)) / totalRows;
    const ch = Math.max(4, pitch - (p.cw > 12 ? 3 : 2));
    parts.push({ t: "title", x: x + pw / 2, y: PAD + 6, text: p.title });
    let y = PAD + TOP;
    secs.forEach((s) => {
      panelOf.set(s.key, pi);
      if (showLbl) { parts.push({ t: "lbl", x, y: y + 7, text: s.title.split(" · ").pop() }); y += LBL; }
      regions.set(s.key, { x: x - 2, y: y - 2, w: s.cols * (p.cw + p.gap) - p.gap + 4, h: (s.rows - 1) * pitch + ch + 4 });
      for (let r = 1; r <= s.rows; r++)
        for (let c = 1; c <= s.cols; c++)
          pos.set(`${s.key}-${r}-${c}`, { x: x + (c - 1) * (p.cw + p.gap), y: y + (r - 1) * pitch, w: p.cw, h: ch });
      y += s.rows * pitch;
    });
    x += pw + PANEL_GAP;
  });
  const WALL_W = x - PANEL_GAP + PAD, WALL_H = H + PAD * 2;

  /* ---------- Draw wall ---------- */
  const svg = $("wall");
  svg.setAttribute("viewBox", `0 0 ${WALL_W} ${WALL_H}`);
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(e);
    return e;
  };
  parts.forEach((p) => {
    const t = el("text", { x: p.x, y: p.y, class: "lbl", "text-anchor": p.t === "title" ? "middle" : "start" });
    if (p.t === "title") t.style.fontSize = "8.5px";
    t.textContent = p.text;
  });
  const chipLayer = el("g", {});
  chips.forEach((ch) => {
    const r = pos.get(`${ch.sec}-${ch.r}-${ch.c}`);
    if (!r) return;
    const rect = el("rect", { x: r.x, y: r.y, width: r.w, height: r.h, rx: 1, fill: ch.hex, class: "chip", "data-i": ch.i }, chipLayer);
    const title = el("title", {}, rect);
    title.textContent = `${ch.name} (${ch.code})`;
  });
  const markLayer = el("g", { "aria-hidden": "true" });

  svg.addEventListener("click", (e) => {
    const i = e.target.getAttribute && e.target.getAttribute("data-i");
    if (i == null) return;
    const ch = chips[+i];
    const color = byKey.get(ch.name.toLowerCase() + "|" + ch.code.toLowerCase());
    show(color, color.spots.indexOf(ch), true);
  });

  /* ---------- Directions ---------- */
  const ordinal = (n) => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
  function where(ch) {
    const s = sections.get(ch.sec);
    const pi = panelOf.get(ch.sec);
    const panel = panels[pi];
    let lead;
    if (pi < 6) {
      const band = s.title.split(" · ").pop();
      lead = [[panel.title, 1], [`, the ${ordinal(pi + 1)} color family from the left, in the `], [band, 1], [" rows. "]];
    } else if (ch.sec === "dc") {
      lead = [["Designer Collection", 1], [", the large chips at the right end. "]];
    } else if (ch.sec === "och") {
      lead = [["One Coat Hide", 1], [" panel, right of the Whites and Neutrals. "]];
    } else {
      lead = [[s.title, 1], [" on the Whites & Neutrals panel, right of the Purples. "]];
    }
    return lead.concat([["Go to "], [`column ${ch.c}`, 1], [" from the left and "], [`row ${ch.r}`, 1], [" from the top of that block."]]);
  }
  function swatch(hex) {
    const sw = document.createElement("span");
    sw.className = "sw";
    sw.style.background = hex;
    return sw;
  }
  function spotLabel(ch) {
    const s = sections.get(ch.sec);
    return s.title;
  }

  /* ---------- My colors (saved on this device only) ---------- */
  const STORE_KEY = "paintPlanogram.myColors.v1";
  const MAX_SAVED = 200;
  const SHOW_FEW = 4;
  let mineOpen = false;
  const keyOf = (c) => c.name.toLowerCase() + "|" + c.code.toLowerCase();
  function loadSaved() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      // Keep only real colors from our own data, so stored values can never inject anything.
      return [...new Set(raw.filter((k) => typeof k === "string" && byKey.has(k)))].slice(0, MAX_SAVED);
    } catch (e) {
      return [];
    }
  }
  let saved = loadSaved();
  let storageOk = true;
  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(saved)); storageOk = true; }
    catch (e) { storageOk = false; }
  }
  const isSaved = (c) => saved.includes(keyOf(c));
  let lastRemoved = null, undoTimer = null;
  function toggleSave(c) {
    const k = keyOf(c);
    if (saved.includes(k)) { removeSaved(c); return; }
    saved = [k, ...saved].slice(0, MAX_SAVED);
    persist();
    renderMine();
    syncSaveButton(true);
  }
  function removeSaved(c) {
    const k = keyOf(c);
    const at = saved.indexOf(k);
    if (at < 0) return;
    saved.splice(at, 1);
    persist();
    lastRemoved = { k, at };
    $("undoText").textContent = `Removed ${c.name}.`;
    $("undo").hidden = false;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => { $("undo").hidden = true; lastRemoved = null; }, 6000);
    renderMine();
    syncSaveButton(false);
  }
  $("undoBtn").addEventListener("click", () => {
    if (!lastRemoved) return;
    if (!saved.includes(lastRemoved.k)) saved.splice(Math.min(lastRemoved.at, saved.length), 0, lastRemoved.k);
    persist();
    lastRemoved = null;
    $("undo").hidden = true;
    renderMine();
    syncSaveButton(false);
  });
  function syncSaveButton(animate) {
    const b = $("fSave");
    if (!current) return;
    const on = isSaved(current.color);
    b.setAttribute("aria-pressed", String(on));
    b.querySelector("span").textContent = on ? "Saved" : "Save";
    b.setAttribute("aria-label", on ? `Remove ${current.color.name} from my colors` : `Save ${current.color.name} to my colors`);
    if (animate && on) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }
  }
  $("fSave").addEventListener("click", () => { if (current) toggleSave(current.color); });
  function renderMine() {
    const list = $("mineList");
    list.replaceChildren();
    saved.forEach((k) => {
      const c = byKey.get(k);
      const li = document.createElement("li");
      const go = document.createElement("button");
      go.type = "button";
      go.className = "go";
      if (current && keyOf(current.color) === k) go.setAttribute("aria-current", "true");
      const txt = document.createElement("span");
      txt.style.minWidth = "0";
      const nm = document.createElement("span");
      nm.className = "rname";
      nm.textContent = c.name;
      const meta = document.createElement("span");
      meta.className = "rmeta";
      meta.textContent = c.code + "  \u2022  " + spotLabel(c.spots[0]);
      txt.append(nm, meta);
      go.append(swatch(c.hex), txt);
      go.setAttribute("aria-label", `Show ${c.name} on the wall`);
      go.addEventListener("click", () => { input.value = c.name; clearBtn.hidden = false; show(c, 0); });
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "rm";
      rm.textContent = "\u00d7";
      rm.setAttribute("aria-label", `Remove ${c.name} from my colors`);
      rm.addEventListener("click", () => removeSaved(c));
      li.append(go, rm);
      list.appendChild(li);
    });
    const n = saved.length;
    const more = $("mineMore");
    more.hidden = n <= SHOW_FEW;
    list.classList.toggle("collapsed", n > SHOW_FEW && !mineOpen);
    more.textContent = mineOpen ? "Show fewer" : `Show all ${n}`;
    more.setAttribute("aria-expanded", String(mineOpen));
    $("mine").hidden = n === 0 && $("undo").hidden;
    $("myBtn").hidden = n === 0;
    $("myCount").textContent = String(n);
    $("myBtn").setAttribute("aria-label", `My colors, ${n} saved`);
    const note = $("mine").querySelector(".minehead p");
    note.textContent = storageOk ? "Saved on this device only" : "This browser is blocking saving. Your list will clear when you close the page.";
  }
  $("mineMore").addEventListener("click", () => { mineOpen = !mineOpen; renderMine(); });
  $("myBtn").addEventListener("click", () => {
    mineOpen = true;
    renderMine();
    $("mine").scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    const first = $("mineList").querySelector(".go");
    if (first) first.focus({ preventScroll: true });
  });

  /* ---------- Show a color ---------- */
  let current = null;
  function show(color, spotIdx, fromWall) {
    spotIdx = Math.max(0, Math.min(spotIdx || 0, color.spots.length - 1));
    current = { color, spotIdx };
    const ch = color.spots[spotIdx];

    $("intro").hidden = true;
    $("quick").hidden = true;
    $("found").hidden = false;
    $("fSw").style.background = color.hex;
    $("fName").textContent = color.name;
    $("fCode").textContent = color.code + (ch.slot && ch.slot !== color.code ? "  •  slot " + ch.slot : "");
    $("fWhere").replaceChildren(...where(ch).map(([text, bold]) => {
      if (!bold) return document.createTextNode(text);
      const b = document.createElement("strong");
      b.textContent = text;
      return b;
    }));

    syncSaveButton(false);
    renderMine();
    // Keep the wall map near the top while a color is showing; saved list moves below the close up.
    const mineEl = $("mine"), detailEl = $("detail");
    if (detailEl.nextElementSibling !== mineEl) detailEl.after(mineEl);

    const spots = $("fSpots");
    spots.replaceChildren();
    if (color.spots.length > 1) {
      color.spots.forEach((sp, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = "Also in " + spotLabel(sp);
        if (i === spotIdx) b.textContent = "Showing " + spotLabel(sp);
        b.setAttribute("aria-pressed", i === spotIdx ? "true" : "false");
        b.addEventListener("click", () => show(color, i));
        spots.appendChild(b);
      });
    }

    // Marker on the wall map
    markLayer.replaceChildren();
    const r = pos.get(`${ch.sec}-${ch.r}-${ch.c}`);
    const reg = regions.get(ch.sec);
    el("rect", { x: reg.x, y: reg.y, width: reg.w, height: reg.h, rx: 3, class: "region" }, markLayer);
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = Math.max(r.w, r.h) + 9;
    const g = el("g", { class: "pulse" }, markLayer);
    el("circle", { cx, cy, r: rad, class: "ring-o" }, g);
    el("circle", { cx, cy, r: rad, class: "ring-i" }, g);
    el("rect", { x: r.x - 1.5, y: r.y - 1.5, width: r.w + 3, height: r.h + 3, rx: 1.5, fill: "none", stroke: "#111", "stroke-width": 1.2 }, markLayer);

    if (zoomed) scrollWallTo(cx);
    drawDetail(ch);

    const url = new URL(location.href);
    url.searchParams.set("c", color.code);
    if (spotIdx) url.searchParams.set("s", spotIdx); else url.searchParams.delete("s");
    history.replaceState(null, "", url);

    if (!fromWall) $("found").scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function drawDetail(ch) {
    const s = sections.get(ch.sec);
    $("detail").hidden = false;
    $("dTitle").textContent = "Close up: " + (panelOf.get(ch.sec) < 6 ? s.title : s.title);
    $("dSub").textContent = `The flashing chip is ${ch.name}. Column ${ch.c} of ${s.cols}, row ${ch.r} of ${s.rows}.`;
    $("dLast").textContent = "Column " + s.cols;
    const grid = $("dGrid");
    grid.replaceChildren();
    grid.style.gridTemplateColumns = `repeat(${s.cols}, minmax(22px, 1fr))`;
    grid.style.maxWidth = (s.big ? s.cols * 110 : s.cols * 58) + 20 + "px";
    $("dLast").parentElement.style.maxWidth = grid.style.maxWidth;
    const lookup = new Map();
    chips.forEach((c) => { if (c.sec === ch.sec) lookup.set(`${c.r}-${c.c}`, c); });
    for (let r = 1; r <= s.rows; r++)
      for (let c = 1; c <= s.cols; c++) {
        const cell = lookup.get(`${r}-${c}`);
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cell" + (cell ? "" : " blank") + (cell && cell.i === ch.i ? " hit" : "");
        if (cell) {
          b.style.background = cell.hex;
          b.setAttribute("aria-label", `${cell.name}, ${cell.code}, column ${c}, row ${r}`);
          b.title = `${cell.name} (${cell.code})`;
          b.addEventListener("click", () => {
            const color = byKey.get(cell.name.toLowerCase() + "|" + cell.code.toLowerCase());
            show(color, color.spots.indexOf(cell), true);
          });
        } else {
          b.disabled = true;
          b.setAttribute("aria-hidden", "true");
        }
        grid.appendChild(b);
      }
  }

  /* ---------- Zoom ---------- */
  let zoomed = false;
  const wrap = $("wallwrap");
  function setZoom(z) {
    zoomed = z;
    wrap.classList.toggle("fit", !z);
    svg.style.width = z ? Math.round(WALL_W * 2.6) + "px" : "";
    $("fitBtn").setAttribute("aria-pressed", String(!z));
    $("zoomBtn").setAttribute("aria-pressed", String(z));
    if (z && current) {
      const ch = current.color.spots[current.spotIdx];
      const r = pos.get(`${ch.sec}-${ch.r}-${ch.c}`);
      scrollWallTo(r.x + r.w / 2);
    }
  }
  function scrollWallTo(cx) {
    requestAnimationFrame(() => {
      const scale = svg.getBoundingClientRect().width / WALL_W;
      wrap.scrollLeft = Math.max(0, cx * scale - wrap.clientWidth / 2);
    });
  }
  $("fitBtn").addEventListener("click", () => setZoom(false));
  $("zoomBtn").addEventListener("click", () => setZoom(true));

  /* ---------- Search box ---------- */
  const input = $("q"), list = $("results"), clearBtn = $("clear");
  let hits = [], active = -1;

  function renderList() {
    list.replaceChildren();
    const q = input.value.trim();
    clearBtn.hidden = !input.value;
    if (!q) { list.hidden = true; input.setAttribute("aria-expanded", "false"); return; }
    if (!hits.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = `No color matches "${q}". Check the spelling, or try the number printed on the chip.`;
      list.appendChild(li);
    }
    hits.forEach((c, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.id = "opt" + i;
      b.setAttribute("role", "option");
      b.setAttribute("aria-selected", i === active ? "true" : "false");
      const wrapEl = document.createElement("span");
      const nm = document.createElement("span");
      nm.className = "rname";
      nm.textContent = c.name;
      const meta = document.createElement("span");
      meta.className = "rmeta";
      meta.textContent = c.code + "  \u2022  " + spotLabel(c.spots[0]);
      wrapEl.append(nm, meta);
      b.append(swatch(c.hex), wrapEl);
      b.addEventListener("click", () => pick(c));
      li.appendChild(b);
      list.appendChild(li);
    });
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }
  function pick(c) {
    input.value = c.name;
    hits = []; active = -1;
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    clearBtn.hidden = false;
    input.blur();
    show(c, 0);
  }
  input.addEventListener("input", () => { hits = search(input.value); active = hits.length ? 0 : -1; renderList(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" && hits.length) { active = (active + 1) % hits.length; renderList(); e.preventDefault(); }
    else if (e.key === "ArrowUp" && hits.length) { active = (active - 1 + hits.length) % hits.length; renderList(); e.preventDefault(); }
    else if (e.key === "Enter") { if (hits[active]) pick(hits[active]); e.preventDefault(); }
    else if (e.key === "Escape") { list.hidden = true; input.setAttribute("aria-expanded", "false"); }
  });
  input.addEventListener("focus", () => { if (input.value && hits.length) { list.hidden = false; } });
  clearBtn.addEventListener("click", () => { input.value = ""; hits = []; renderList(); input.focus(); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".top")) { list.hidden = true; input.setAttribute("aria-expanded", "false"); } });

  /* ---------- Popular colors ---------- */
  const quick = $("quick");
  (W.featured || []).slice(0, 6).forEach((code) => {
    const c = byCode.get(compact(code));
    if (!c) return;
    const b = document.createElement("button");
    b.type = "button";
    b.append(swatch(c.hex));
    b.appendChild(document.createTextNode(c.name));
    b.addEventListener("click", () => { input.value = c.name; clearBtn.hidden = false; show(c, 0); });
    quick.appendChild(b);
  });

  /* ---------- Open a shared link ---------- */
  const params = new URLSearchParams(location.search);
  const startCode = params.get("c");
  if (startCode) {
    const c = byCode.get(compact(startCode)) || search(startCode)[0];
    if (c) {
      let si = +params.get("s") || 0;
      const slotHit = c.spots.findIndex((sp) => compact(sp.slot || "") === compact(startCode));
      if (!params.get("s") && slotHit > 0) si = slotHit;
      input.value = c.name; clearBtn.hidden = false; show(c, si, true);
    }
  }

  renderMine();

  // Read only search hook used by automated tests.
  Object.defineProperty(window, "__planogram", { value: Object.freeze({ search }), writable: false });
})();
