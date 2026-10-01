/*
 * 初见 · FIRST SIGHT — the names, the city, day after day.
 *
 *   31 – 37   the characters fly into a child's copybook (田字格) and are copied
 *             row after row; the copybook pulls back and becomes the face of a
 *             building, its squares the windows.
 *   37 – 61   the street outside that building. Day 1 he looks up at the sun.
 *             Then the days shorten and repeat; colour drains to ink, every
 *             thing becomes its character, the handwriting becomes print, and
 *             the print falls into a grid that fills with 日: 日复一日.
 */
(function (G) {
  'use strict';
  const FS = G.FS;
  const { clamp, lerp, ss, ss2, lin, win, easeOut, easeIn, easeInOut, TAU, hash, h2, noise1, rng, rgba, mixc, track } = FS;
  const B = FS.brush, GL = FS.glyphs, FIG = FS.fig;
  const VW = 1920, VH = 1080;
  const W = () => FS.world;
  const INK = 'rgb(26,23,21)';

  // ------------------------------------------------------------------ layout
  const GRID = { x0: 720, y0: 300, cell: 60, cols: 8, rows: 6 };
  const FACADE = { x0: 690, x1: 1230, y0: 262, y1: 822 };
  const DOOR = { x: 960, y: 822, w: 86, h: 150 };
  const WALK_Y = 846;
  const cellC = (c, r) => [GRID.x0 + (c + 0.5) * GRID.cell, GRID.y0 + (r + 0.5) * GRID.cell];
  const PAGE_CAM = { x: 960, y: 486, z: 2.36 };
  const CHARS = ['日', '山', '木', '水', '雨', '人'];
  const KINDS = ['sun', 'mountain', 'tree', 'water', 'rain', 'person'];

  // ------------------------------------------------------------------ the copybook
  const T_FLY0 = 30.9, T_FLY1 = 32.5, T_REN = 32.5, T_COPY0 = 33.2, T_COPY1 = 35.0, T_BACK0 = 35.2, T_BACK1 = 37.6;
  function toScreen(cam, p) { return [(p[0] - cam.x) * cam.z + 960, (p[1] - cam.y) * cam.z + 540]; }
  function toWorld(cam, p) { return [(p[0] - 960) / cam.z + cam.x, (p[1] - 540) / cam.z + cam.y]; }
  function valleyCamAt(t) { const u = easeInOut(clamp((t - 12.6) / 12)); return { x: 960, y: lerp(540, 560, u), z: lerp(1, 1.055, u) }; }

  function pageCam(t) {
    const u = easeInOut(clamp((t - T_BACK0) / (T_BACK1 - T_BACK0)));
    // log-zoom back to the street, keeping the facade centred until the end
    const z = PAGE_CAM.z * Math.pow(1 / PAGE_CAM.z, u);
    const s = (PAGE_CAM.z / z - 1) / (PAGE_CAM.z - 1);
    return { x: 960, y: lerp(PAGE_CAM.y, 540, s), z };
  }

  // the copybook page, drawn in street coordinates (the page is the facade)
  function copybook(L, t) {
    const cam = pageCam(t);
    W().setCam(L, cam);
    const back = clamp((t - T_BACK0) / (T_BACK1 - T_BACK0));
    const toWin = ss(0.25, 0.85, back);         // squares become windows
    const ink = L.ink.ctx, wash = L.wash.ctx;
    const lineA = ss(T_FLY0 + 0.2, T_FLY0 + 1.0, t);
    const { x0, y0, cell, cols, rows } = GRID;
    // grid of 田字格: red outer lines, dashed cross
    if (lineA > 0) {
      const red = mixc([206, 86, 66], [120, 112, 104], toWin);
      ink.save();
      ink.globalAlpha = lineA * (1 - toWin * 0.7);
      ink.strokeStyle = rgba(red, 0.85);
      ink.lineWidth = lerp(1.1, 0.7, toWin);
      for (let c = 0; c <= cols; c++) {
        const u = clamp((lineA - c / cols * 0.4) / 0.6);
        ink.beginPath(); ink.moveTo(x0 + c * cell, y0); ink.lineTo(x0 + c * cell, y0 + rows * cell * u); ink.stroke();
      }
      for (let r = 0; r <= rows; r++) {
        const u = clamp((lineA - r / rows * 0.4) / 0.6);
        ink.beginPath(); ink.moveTo(x0, y0 + r * cell); ink.lineTo(x0 + cols * cell * u, y0 + r * cell); ink.stroke();
      }
      ink.setLineDash([3, 3]);
      ink.lineWidth = 0.6;
      ink.globalAlpha = lineA * 0.7 * (1 - toWin);
      for (let c = 0; c < cols; c++) { ink.beginPath(); ink.moveTo(x0 + (c + 0.5) * cell, y0); ink.lineTo(x0 + (c + 0.5) * cell, y0 + rows * cell); ink.stroke(); }
      for (let r = 0; r < rows; r++) { ink.beginPath(); ink.moveTo(x0, y0 + (r + 0.5) * cell); ink.lineTo(x0 + cols * cell, y0 + (r + 0.5) * cell); ink.stroke(); }
      ink.restore();
    }
    // the five names fly in from the valley; the sixth, 人, is written here
    const V = W().V;
    const glyphA = 1 - ss(0.2, 0.7, back);
    KINDS.forEach((k, i) => {
      const [cx, cy] = cellC(0, i);
      const size = cell * 0.78;
      if (k === 'person') {
        const u = clamp((t - T_REN) / 0.7);
        if (u > 0) GL.write(ink, '人', cx, cy, size, u, { seed: 61, alpha: glyphA });
        return;
      }
      const src = V[k];
      const vcam = valleyCamAt(30.9);
      const sp = toScreen(vcam, [src.x, src.y]);
      const sw = toWorld(cam, sp);
      const f = easeInOut(clamp((t - T_FLY0 - i * 0.12) / (T_FLY1 - T_FLY0 - 0.5)));
      const x = lerp(sw[0], cx, f), y = lerp(sw[1], cy, f);
      const s = lerp(src.s * vcam.z / cam.z, size, f);
      GL.draw(ink, k, x, y, s, 1, { seed: [1, 2, 5, 4, 6][i], alpha: glyphA, sx: 1, sy: 1 });
    });
    // practice: each row copied across, quickly, in a child's lighter hand
    for (let r = 0; r < rows; r++) {
      for (let c = 1; c < cols; c++) {
        const tc = T_COPY0 + (r * (cols - 1) + (c - 1)) * ((T_COPY1 - T_COPY0) / (rows * (cols - 1))) * 0.85 + hash(r * 9 + c) * 0.08;
        const u = clamp((t - tc) / 0.22);
        if (u <= 0) continue;
        const [cx, cy] = cellC(c, r);
        const jit = (hash(r * 31 + c) - 0.5) * 2;
        GL.write(ink, CHARS[r], cx + jit, cy + jit * 0.6, cell * (0.72 + 0.05 * hash(c + r)), u, { seed: r * 10 + c, alpha: glyphA * (0.62 + 0.25 * hash(r + c * 7)), wob: 1.2, dry: 0.45, rot: jit * 0.03 });
      }
    }
    // the teacher's red circles: well written
    const circ = [[0, 0], [3, 0], [6, 1], [2, 2], [5, 3], [1, 4], [4, 5], [7, 5]];
    circ.forEach(([c, r], i) => {
      const u = clamp((t - 34.7 - i * 0.07) / 0.25);
      if (u <= 0) return;
      const [cx, cy] = cellC(c, r);
      const R = rng(i + 40);
      const pts = [];
      for (let k = 0; k <= 22; k++) {
        const a = -2.0 + (k / 22) * TAU * 1.08;
        const rr = cell * 0.43 * (1 + 0.06 * Math.sin(k * 0.9 + i));
        pts.push([cx + Math.cos(a) * rr * 1.05, cy + Math.sin(a) * rr * 0.95, 2.3 * (k < 3 ? k / 3 : 1) * (k > 19 ? (22 - k) / 3 + 0.2 : 1)]);
      }
      B.stroke(ink, pts, { u, color: 'rgb(208,52,40)', alpha: 0.85 * glyphA, wob: 0.3, seed: 70 + i });
    });
    return { cam, back, toWin };
  }

  // ================================================================== the street
  // --- days: the first is long; each one after is shorter than the last
  const DAYS = (() => {
    const d = [];
    let t = 36.6;
    d.push([t, t + 6.6]); t += 6.6;
    let len = 1.9;
    while (t < 70) { d.push([t, t + len]); t += len; len = Math.max(0.08, len * 0.75); }
    return d;
  })();
  function dayAt(t) {
    for (let i = 0; i < DAYS.length; i++) {
      const [a, b] = DAYS[i];
      if (t < b) return { i, ph: clamp((t - a) / (b - a)), len: b - a };
    }
    return { i: DAYS.length - 1, ph: 1, len: 0.1 };
  }
  // the day/night swing fades as the days blur together
  const SWING = track([[0, 1], [45.6, 1], [49.2, 0, 'io']]);
  // frozen time for the grid at the end
  const T_FREEZE = 54.2;

  // counter: 第 N 天
  const T_COUNT_FAST = 47.6, T_COUNT_END = 58.2, N_END = 4380;
  function dayNumber(t) {
    if (t < DAYS[0][1]) return 1;
    if (t < T_COUNT_FAST) return dayAt(t).i + 1;
    const n0 = dayAt(T_COUNT_FAST).i + 1;
    const u = clamp((t - T_COUNT_FAST) / (T_COUNT_END - T_COUNT_FAST));
    return Math.round(n0 * Math.pow(N_END / n0, easeIn(u, 1.6)));
  }

  // per-object abstraction: 0 thing → 1 character → 2 print
  function mOf(seed, t, early = 0) {
    const g0 = 46.4 + 3.4 * hash(seed * 1.31) - early;
    const g = easeInOut(clamp((t - g0) / 1.3));
    const p0 = 50.6 + 2.6 * hash(seed * 2.17 + 3);
    const p = clamp((t - p0) / 1.1);
    return g + p;
  }

  // --- sky and light by phase of the day
  const SKY = {
    dawn: [[126, 140, 196], [214, 180, 196], [252, 206, 168]],
    day: [[86, 146, 204], [150, 196, 222], [226, 236, 236]],
    dusk: [[70, 80, 146], [196, 140, 150], [250, 168, 112]],
    night: [[18, 26, 52], [36, 44, 78], [66, 66, 98]],
  };
  function skyAt(ph, swing) {
    // ph: 0 dawn .25 day .5 day .75 dusk .9 night
    const keys = [[0, 'dawn'], [0.14, 'day'], [0.6, 'day'], [0.76, 'dusk'], [0.86, 'night'], [1.0, 'night']];
    let a = keys[0], b = keys[1];
    for (let i = 1; i < keys.length; i++) if (ph <= keys[i][0]) { a = keys[i - 1]; b = keys[i]; break; }
    const u = FS.smooth(clamp((ph - a[0]) / (b[0] - a[0] || 1)));
    const c = [0, 1, 2].map((j) => mixc(SKY[a[1]][j], SKY[b[1]][j], u));
    const neutral = [[150, 160, 176], [176, 184, 192], [200, 204, 206]];
    return c.map((col, j) => mixc(neutral[j], col, swing));
  }
  function nightness(ph, swing) { return (ss(0.74, 0.86, ph) * (1 - ss(0.985, 1.0, ph)) + (ph < 0.04 ? 1 - ss(0, 0.04, ph) : 0) * 0.8) * swing; }

  // --- the skyline
  const BLD = (() => {
    const R = rng(808);
    const cols = [[176, 160, 150], [150, 162, 176], [196, 178, 150], [168, 140, 128], [140, 150, 160], [206, 196, 180], [130, 138, 156]];
    const out = [];
    let x = -60;
    while (x < 1980) {
      const w = R.range(110, 210);
      const h = R.range(260, 560);
      if (!(x + w > FACADE.x0 + 40 && x < FACADE.x1 - 40) || h > 600) out.push({ x, w, h, col: R.pick(cols), win: R.int(3, 5), seed: out.length + 1, depth: 1 });
      x += w + R.range(-30, 30);
    }
    // a few tall ones behind the facade
    out.push({ x: 760, w: 150, h: 700, col: [150, 160, 178], win: 4, seed: 91, depth: 1 });
    out.push({ x: 1050, w: 170, h: 640, col: [176, 166, 158], win: 4, seed: 92, depth: 1 });
    return out;
  })();
  const GROUND = 822;

  function building(L, b, t, m, k) {
    const x0 = b.x, x1 = b.x + b.w, y1 = GROUND, y0 = GROUND - b.h;
    const pa = (1 - ss(0.05, 0.55, m)) * k.paint;
    if (pa > 0.004) {
      const w = L.wash.ctx;
      W().washPoly(w, 'b' + b.seed, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], b.col, 0.8 * pa, { seed: b.seed, amt: 0.05, depth: 2 });
      // windows
      const night = k.night;
      const nx = b.win, ny = Math.floor(b.h / 46);
      const ww = (b.w - 20) / nx;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const lit = hash(b.seed * 13 + i * 7 + j * 3 + Math.floor(k.day) * 0.37) < 0.45;
        const wx = x0 + 10 + i * ww + ww * 0.2, wy = y0 + 16 + j * 46;
        w.save();
        w.globalCompositeOperation = 'multiply';
        w.globalAlpha = pa * 0.5;
        w.fillStyle = rgba([110, 120, 140]);
        w.fillRect(wx, wy, ww * 0.6, 26);
        w.restore();
        if (lit && night > 0.02) {
          const l = L.light.ctx;
          l.save(); l.globalCompositeOperation = 'lighter'; l.fillStyle = `rgba(255,200,120,${0.75 * night * pa})`; l.fillRect(wx, wy, ww * 0.6, 26); l.restore();
        }
      }
      W().inkLine(L.ink.ctx, [[x0, y1, 1.6], [x0, y0, 1.6, 1], [x1, y0, 1.6, 1], [x1, y1, 1.6]], 1.6, 0.35 * pa, b.seed);
    }
    const g = bGlyph(b);
    GL.draw(L.ink.ctx, 'building', g.x, g.y, g.s, m, { seed: b.seed, alpha: k.glyphA, sx: Math.min(1.6, b.w / (0.64 * g.s)), sy: 1.0, print: k.print });
  }
  // a building's character sits under its roofline, as wide as the building allows
  function bGlyph(b) {
    const s = Math.min(b.w * 0.92, b.h * 0.5, 170);
    return { x: b.x + b.w / 2, y: GROUND - b.h + s * 0.62, s };
  }

  function facade(L, t, k, mF, mD) {
    const { x0, x1, y0, y1 } = FACADE;
    const pa = (1 - ss(0.05, 0.55, mF)) * k.paint;
    const w = L.wash.ctx, ink = L.ink.ctx;
    if (pa > 0.004) {
      // the wall stands in front of the skyline: hide the lines behind it
      ink.save(); ink.globalCompositeOperation = 'destination-out'; ink.globalAlpha = Math.min(1, pa * Math.max(k.facadeA, 0.6) * 1.2);
      ink.fillRect(x0, y0, x1 - x0, y1 - y0); ink.restore();
      // the copybook page *is* this wall: opaque paper that takes on the wall's colour
      w.save(); w.globalAlpha = Math.min(1, w.globalAlpha * (k.pageA || 1)) * pa; w.fillStyle = '#fff'; w.fillRect(x0, y0, x1 - x0, y1 - y0); w.restore();
      W().washPoly(w, 'facade', [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], [222, 198, 160], 0.9 * pa * k.facadeA, { seed: 3, amt: 0.04, depth: 2 });
      // cornice and ground-floor band
      w.save(); w.globalCompositeOperation = 'multiply'; w.globalAlpha = 0.5 * pa * k.facadeA;
      w.fillStyle = rgba([170, 130, 100]); w.fillRect(x0 - 8, y0 - 10, x1 - x0 + 16, 16);
      w.fillStyle = rgba([196, 170, 140]); w.fillRect(x0, GRID.y0 + GRID.rows * GRID.cell + 14, x1 - x0, 14);
      w.restore();
      // windows: the copybook squares
      const { cell, cols, rows } = GRID;
      const night = k.night;
      for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
        const gx = GRID.x0 + c * cell, gy = GRID.y0 + r * cell;
        const inset = 9;
        const sky = k.skyCols;
        w.save();
        w.globalAlpha = pa * k.glassA;
        const g = w.createLinearGradient(0, gy + inset, 0, gy + cell - inset);
        g.addColorStop(0, rgba(mixc(sky[0], [255, 255, 255], 0.35))); g.addColorStop(1, rgba(mixc(sky[2], [255, 255, 255], 0.2)));
        w.fillStyle = g;
        w.fillRect(gx + inset, gy + inset, cell - inset * 2, cell - inset * 2);
        w.restore();
        const lit = hash(c * 7 + r * 13 + Math.floor(k.day) * 0.71) < 0.5;
        if (lit && night > 0.02) {
          const l = L.light.ctx;
          l.save(); l.globalCompositeOperation = 'lighter'; l.fillStyle = `rgba(255,196,110,${0.8 * night * pa})`;
          l.fillRect(gx + inset, gy + inset, cell - inset * 2, cell - inset * 2); l.restore();
        }
        ink.save(); ink.globalAlpha = 0.55 * pa * k.glassA; ink.strokeStyle = 'rgb(60,52,46)'; ink.lineWidth = 1.4;
        ink.strokeRect(gx + inset, gy + inset, cell - inset * 2, cell - inset * 2);
        ink.globalAlpha = 0.35 * pa * k.glassA; ink.lineWidth = 1;
        ink.beginPath(); ink.moveTo(gx + cell / 2, gy + inset); ink.lineTo(gx + cell / 2, gy + cell - inset); ink.moveTo(gx + inset, gy + cell / 2); ink.lineTo(gx + cell - inset, gy + cell / 2); ink.stroke();
        ink.restore();
      }
      W().inkLine(ink, [[x0, y1, 2], [x0, y0, 2, 1], [x1, y0, 2, 1], [x1, y1, 2]], 2, 0.45 * pa * k.facadeA, 5);
      // ground floor shop windows
      for (const sx of [x0 + 40, x1 - 170]) {
        w.save(); w.globalAlpha = pa * k.facadeA * 0.8; w.fillStyle = rgba(mixc(k.skyCols[1], [90, 100, 110], 0.5)); w.fillRect(sx, 700, 130, 92); w.restore();
        ink.save(); ink.globalAlpha = 0.5 * pa * k.facadeA; ink.strokeStyle = 'rgb(60,52,46)'; ink.lineWidth = 1.5; ink.strokeRect(sx, 700, 130, 92); ink.restore();
      }
    }
    // the door
    const pd = (1 - ss(0.05, 0.55, mD)) * k.paint * k.facadeA;
    if (pd > 0.004) {
      const { x, y, w: dw, h: dh } = DOOR;
      w.save(); w.globalAlpha = pd; w.fillStyle = 'rgb(66,120,112)'; w.fillRect(x - dw / 2, y - dh, dw, dh);
      w.globalAlpha = pd * (k.doorOpen || 0); w.fillStyle = 'rgb(40,34,32)'; w.fillRect(x - dw / 2 + 4, y - dh + 4, (dw - 8) * (k.doorOpen || 0), dh - 4);
      w.restore();
      ink.save(); ink.globalAlpha = 0.7 * pd; ink.strokeStyle = 'rgb(40,34,32)'; ink.lineWidth = 2;
      ink.strokeRect(x - dw / 2, y - dh, dw, dh);
      ink.fillStyle = 'rgb(220,190,90)'; ink.beginPath(); ink.arc(x + dw / 2 - 12, y - dh / 2, 3.5, 0, TAU); ink.fill();
      ink.restore();
      // a lamp over the door
      if (k.night > 0.02) W().radial(L.light.ctx, x, y - dh - 14, 0, 70, [[0, [255, 210, 140], 0.6], [1, [255, 200, 120], 0]], 'lighter', k.night * pd);
    }
    GL.draw(ink, 'door', DOOR.x, DOOR.y - DOOR.h / 2, 120, mD, { seed: 17, alpha: k.glyphA, sx: DOOR.w / (0.6 * 120), sy: DOOR.h / 120 / 0.96, print: k.print });
    GL.draw(ink, 'building', (x0 + x1) / 2, 480, 300, mF, { seed: 18, alpha: k.glyphA, sx: (x1 - x0) / (0.64 * 300), sy: (y1 - y0) / 300, print: k.print });
  }

  // --- street furniture
  const TREES = [{ x: 420, s: 1 }, { x: 1500, s: 1.08 }, { x: 1800, s: 0.94 }, { x: 150, s: 0.9 }];
  function season(t) { return (t < 43 ? 0 : (t - 43) / 1.9); } // year counter, in seasons
  function treeCols(t) { return t < 43 ? treeColsAt(0) : treeColsAt(season(t)); }
  function treeColsAt(sv) {
    const t = 99;
    const s = sv % 4; // 0 summer 1 autumn 2 winter 3 spring
    const pal = [[[90, 150, 82], [124, 172, 92]], [[214, 150, 60], [190, 90, 50]], [[150, 140, 130], [170, 160, 150]], [[240, 180, 190], [150, 196, 110]]];
    const a = Math.floor(s), u = FS.smooth(s - a);
    const A = pal[a % 4], Bq = pal[(a + 1) % 4];
    const leaves = a % 4 === 1 ? lerp(1, 0.15, u) : a % 4 === 2 ? lerp(0.15, 0.5, u) : 1;
    return { c1: mixc(A[0], Bq[0], u), c2: mixc(A[1], Bq[1], u), leaves };
  }
  function streetTree(L, tr, t, m, k) {
    const x = tr.x, y = GROUND + 18, s = tr.s;
    const pa = (1 - ss(0.05, 0.55, m)) * k.paint;
    if (pa > 0.004) {
      const w = L.wash.ctx, ink = L.ink.ctx;
      w.save(); w.globalCompositeOperation = 'multiply'; w.globalAlpha = 0.85 * pa;
      B.stroke(w, [[x, y, 16 * s], [x - 2, y - 90 * s, 11 * s], [x + 2, y - 150 * s, 6 * s]], { color: rgba([110, 86, 70]), seed: x });
      w.restore();
      W().inkLine(ink, [[x - 6 * s, y, 2], [x - 6 * s, y - 120 * s, 1.5]], 2, 0.5 * pa, x);
      const tc = k.season != null ? treeColsAt(k.season) : treeCols(t);
      const R = rng(x);
      for (let i = 0; i < 14; i++) {
        const a = R() * TAU, d = Math.sqrt(R());
        if (R() > tc.leaves) continue;
        B.blob(w, x + Math.cos(a) * d * 70 * s + noise1(t * 0.5 + i) * 3, y - 175 * s + Math.sin(a) * d * 55 * s, R.range(26, 40) * s, R.range(22, 34) * s, rgba(i % 2 ? tc.c1 : tc.c2), 0.55 * pa, x + i * 7, { layers: 2, irr: 0.3 });
      }
      for (let i = 0; i < 5; i++) W().inkLine(ink, [[x, y - 110 * s], [x + (i - 2) * 22 * s, y - (160 + (i % 2) * 30) * s, 0.5]].map((p) => [p[0], p[1], p[2] ?? 2]), 1.5, 0.4 * pa, x + i);
    }
    GL.draw(L.ink.ctx, 'tree', x, y - 118 * s, 170 * s, m, { seed: 30 + x, alpha: k.glyphA, sx: 1, sy: 1.1, print: k.print });
  }
  function lamp(L, x, t, k) {
    const pa = k.paint * (1 - k.flat);
    if (pa <= 0.004) return;
    const ink = L.ink.ctx;
    W().inkLine(ink, [[x, GROUND + 22, 4], [x, GROUND - 200, 3], [x + 6, GROUND - 216, 3], [x + 30, GROUND - 220, 2.5]], 3, 0.8 * pa, x);
    ink.save(); ink.globalAlpha = 0.8 * pa; ink.fillStyle = 'rgb(40,36,34)'; ink.beginPath(); ink.ellipse(x + 34, GROUND - 214, 14, 7, 0, 0, TAU); ink.fill(); ink.restore();
    if (k.night > 0.02) {
      W().radial(L.light.ctx, x + 34, GROUND - 205, 0, 160, [[0, [255, 214, 150], 0.7], [0.3, [255, 200, 130], 0.2], [1, [255, 200, 120], 0]], 'lighter', k.night * pa);
    }
  }

  // --- traffic: deterministic walkers and cars
  const WALKERS = (() => {
    const R = rng(4242);
    const tops = [[196, 90, 80], [90, 130, 180], [230, 200, 120], [120, 150, 110], [180, 160, 200], [80, 80, 90], [210, 140, 90], [150, 170, 190]];
    const out = [];
    for (let i = 0; i < 12; i++) {
      out.push({ id: i, dir: R() < 0.5 ? 1 : -1, v: R.range(70, 110), off: R.range(0, 2400), h: R.range(118, 136), y: WALK_Y + R.range(-8, 10),
        col: { skin: [240, 208, 186], hair: R.pick([[36, 30, 28], [60, 46, 40], [30, 28, 30]]), top: R.pick(tops), bottom: R.pick([[60, 64, 80], [90, 80, 70], [70, 90, 120]]), shoes: [50, 44, 40] },
        plan: R() < 0.45 ? 'woman' : 'adult', skirt: R() < 0.3, hair: R.pick(['short', 'bun', 'short']) });
    }
    return out;
  })();
  const CARS = (() => {
    const R = rng(5151);
    const cols = [[200, 70, 60], [70, 110, 170], [230, 200, 90], [90, 150, 120], [220, 220, 216], [60, 62, 70], [230, 140, 70]];
    const out = [];
    for (let i = 0; i < 8; i++) out.push({ id: i, lane: i % 2, v: R.range(260, 420) * (i % 2 ? -1 : 1), off: R.range(0, 3000), col: R.pick(cols), len: R.range(150, 180) });
    return out;
  })();
  // "busy-ness" of the street over time: traffic speeds up with the days
  const RUSH = (() => {
    const N = 4000, dt = 0.025, tab = new Float32Array(N);
    let acc = 0;
    for (let i = 0; i < N; i++) {
      const t = i * dt;
      tab[i] = acc;
      const sp = t < 43 ? 1 : t < T_FREEZE ? 1 + 5 * ss(43, 52, t) : 0;
      acc += sp * dt;
    }
    return (t) => { const x = clamp(t / dt, 0, N - 2), i = Math.floor(x); return lerp(tab[i], tab[i + 1], x - i); };
  })();

  function car(L, c, x, y, m, k) {
    const pa = (1 - ss(0.05, 0.55, m)) * k.paint;
    const len = c.len, dir = Math.sign(c.v);
    if (pa > 0.004) {
      const w = L.wash.ctx, ink = L.ink.ctx;
      const body = [[x - len / 2, y - 12], [x - len / 2 + 6, y - 34], [x + len / 2 - 4, y - 36], [x + len / 2, y - 14], [x + len / 2, y], [x - len / 2, y]];
      const cab = [[x - len * 0.28 * dir, y - 34], [x - len * 0.16 * dir, y - 62], [x + len * 0.16 * dir, y - 62], [x + len * 0.3 * dir, y - 35]];
      w.save(); w.globalCompositeOperation = 'multiply'; w.globalAlpha = 0.9 * pa;
      w.fillStyle = rgba(c.col); w.beginPath(); W().poly(w, body); w.fill(); W().poly(w, cab); w.fill();
      w.fillStyle = rgba([200, 220, 236]); w.beginPath();
      W().poly(w, cab.map(([px, py], i) => [lerp(px, x, 0.12), py + (i === 1 || i === 2 ? 6 : -2)])); w.fill();
      w.restore();
      ink.save(); ink.globalAlpha = 0.6 * pa; ink.strokeStyle = INK; ink.lineWidth = 1.4;
      ink.beginPath(); W().poly(ink, body); ink.stroke();
      ink.fillStyle = 'rgb(34,32,32)';
      for (const wx of [x - len * 0.3, x + len * 0.3]) { ink.beginPath(); ink.arc(wx, y, 14, 0, TAU); ink.fill(); }
      ink.restore();
      if (k.night > 0.02) {
        W().radial(L.light.ctx, x + dir * len / 2, y - 18, 0, 90, [[0, [255, 236, 190], 0.7], [1, [255, 230, 180], 0]], 'lighter', k.night * pa);
      }
    }
    GL.draw(L.ink.ctx, 'car', x, y - 30, 104, m, { seed: 50 + c.id, alpha: k.glyphA, sx: len / 104, sy: 0.9, print: k.print });
  }

  // --- the protagonist: Day 1 he steps out and looks up at the sun
  const HIM = { skin: [240, 208, 186], hair: [32, 28, 28], top: [236, 232, 220], sleeve: [236, 232, 220], bottom: [70, 84, 112], shoes: [50, 44, 40] };
  function protagonist(L, t, k) {
    const d = dayAt(Math.min(t, T_FREEZE));
    const ph = d.ph;
    const m = mOf(777, t, 0.6);
    let f = null;
    let doorOpen = 0;
    if (d.i === 0) {
      // Day 1, choreographed
      const tt = t - DAYS[0][0];
      doorOpen = win(1.2, 1.5, 2.2, 2.6, tt) + win(5.6, 5.8, 6.25, 6.5, tt);
      if (tt > 1.4 && tt < 4.9) {
        const out = easeOut(clamp((tt - 1.4) / 0.7));
        const look = win(2.15, 2.6, 3.4, 3.8, tt);
        const turn = tt > 3.95;
        if (!turn) {
          f = { x: DOOR.x, y: lerp(DOOR.y - 4, WALK_Y + 4, out), h: 132, plan: 'adult', view: 'front', col: HIM, walk: out < 1 ? tt * 9 : undefined, amp: 0.5,
            pose: { head: -1.6 * look, smile: 0.4 + look * 0.8 }, alpha: ss(1.4, 1.6, tt) };
          // a hand up to the brow against the light
          const shade = win(2.0, 2.45, 3.45, 3.85, tt);
          if (shade > 0) {
            const P = FIG.PLAN.adult, h = 132;
            const sx = f.x + P.shw * h * 0.92, sy = f.y - P.sh * h + h * 0.02;
            const a = FIG.ik(sx, sy, f.x + h * 0.035, f.y - P.headY * h - h * 0.045, P.ua * h, P.fa * h, 1, 1);
            f.pose.armR = [lerp(0.12, a[0], shade), lerp(-0.08, a[1], shade)];
          }
        } else {
          const dist = (tt - 3.95) * 150;
          f = { x: DOOR.x + dist, y: WALK_Y + 4, h: 132, plan: 'adult', view: 'side', dir: 1, col: HIM, walk: FIG.phaseFor(dist, 132), bag: [140, 100, 76] };
        }
      } else if (tt > 5.3 && tt < 6.3) {
        const u = (6.3 - tt);
        const dist = u * 160;
        f = { x: DOOR.x + dist, y: WALK_Y + 4 - (1 - clamp(u * 4)) * 20, h: 132, plan: 'adult', view: 'side', dir: -1, col: HIM, walk: FIG.phaseFor(dist, 132), bag: [140, 100, 76], alpha: ss(6.3, 6.05, tt) };
      }
    } else if (t < T_FREEZE + 0.01) {
      // every other day: out the door, head down, to the right; back at night
      const L2 = d.len;
      if (ph > 0.16 && ph < 0.42) {
        const u = (ph - 0.16) / 0.26;
        const dist = u * 1100;
        f = { x: DOOR.x + dist, y: WALK_Y + 4, h: 132, plan: 'adult', view: 'side', dir: 1, col: HIM, walk: FIG.phaseFor(dist, 132), bag: [140, 100, 76],
          pose: { head: 0.5, headFwd: 0.01, lean: 0.06 }, alpha: ss(0.16, 0.18, ph) };
      }
      if (ph > 0.74 && ph < 0.95) {
        const u = (ph - 0.74) / 0.21;
        const dist = (1 - u) * 1100;
        f = { x: DOOR.x + dist, y: WALK_Y + 4, h: 132, plan: 'adult', view: 'side', dir: -1, col: HIM, walk: FIG.phaseFor(dist, 132), bag: [140, 100, 76],
          pose: { head: 0.6, lean: 0.08 }, alpha: 1 - ss(0.92, 0.95, ph) };
      }
      doorOpen = win(0.12, 0.15, 0.18, 0.22, ph) + win(0.9, 0.92, 0.95, 0.97, ph);
    } else {
      f = { x: 1560, y: WALK_Y + 4, h: 132, plan: 'adult', view: 'side', dir: 1, col: HIM, walk: 0.3, bag: [140, 100, 76], pose: { head: 0.5 } };
    }
    if (f) { f.m = m; f.glyph = { print: k.print, alpha: k.glyphA }; }
    return { f, doorOpen };
  }

  // ------------------------------------------------------------------ the grid of days
  const GCELL = 60, GC = 32, GR = 18;
  let gridPlan = null;
  // where each thing lands when the world falls into a grid
  function planGrid(items) {
    const taken = new Set();
    const out = [];
    const sorted = items.map((it, i) => ({ it, i })).sort((a, b) => b.it.s - a.it.s);
    for (const { it, i } of sorted) {
      let cx = clamp(Math.round(it.x / GCELL - 0.5), 0, GC - 1), cy = clamp(Math.round(it.y / GCELL - 0.5), 0, GR - 1);
      let best = null;
      for (let r = 0; r < 12 && !best; r++) {
        for (let dx = -r; dx <= r && !best; dx++) for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx, y = cy + dy;
          if (x < 0 || y < 0 || x >= GC || y >= GR || taken.has(x + y * GC)) continue;
          best = [x, y]; break;
        }
      }
      if (!best) best = [cx, cy];
      taken.add(best[0] + best[1] * GC);
      out[i] = best;
    }
    return { cells: out, taken };
  }

  // ------------------------------------------------------------------ the street, assembled
  const T_GRID0 = 54.4, T_GRID1 = 56.2, T_FILL0 = 56.0, T_FILL1 = 59.4;
  function street(L, t, opt = {}) {
    const tf = opt.tf ?? Math.min(t, T_FREEZE);
    const d = dayAt(tf);
    const swing = opt.swing ?? SWING(t);
    const ph = opt.ph ?? (d.i === 0 ? lerp(0.0, 0.62, clamp((tf - DAYS[0][0]) / 4.6)) + ss(41.4, 43.2, tf) * 0.36 : d.ph);
    const M = (seed, x, y, early = 0) => (opt.mFn ? opt.mFn(seed, x, y) : mOf(seed, t, early));
    const win_ = opt.view === 'window';
    const skyCols = opt.skyCols || skyAt(ph, swing);
    const night = nightness(ph, swing);
    const glyphA = 1;
    const k = {
      paint: opt.paint ?? 1, night, skyCols, day: d.i, glyphA, print: 'rgb(104,104,100)',
      facadeA: opt.facadeA ?? 1, glassA: opt.glassA ?? 1, flat: opt.flat ?? ss(50.5, 53.5, t), pageA: opt.pageA || 1, season: opt.season,
    };
    const w = L.wash.ctx;
    const gridU = easeInOut(clamp((t - T_GRID0) / (T_GRID1 - T_GRID0)));
    const items = [];
    const collect = !!opt.collect;

    // sky
    W().vgrad(w, -800, -600, 2720, GROUND, [[0, skyCols[0]], [0.62, skyCols[1]], [1, skyCols[2]]], 'source-over', k.paint * (1 - k.flat * 0.6));
    // the sun crosses the sky each day
    const sunU = opt.sun ? 0.5 : ph < 0.8 ? ph / 0.8 : 1.2;
    const sx = opt.sun ? opt.sun[0] : lerp(-60, 1980, clamp(sunU)), sy = opt.sun ? opt.sun[1] : 760 - Math.sin(Math.PI * clamp(sunU)) * 600;
    const mSun = M(1, sx, sy, 1.2);
    if (sunU <= 1) {
      const pa = (1 - ss(0.05, 0.55, mSun)) * k.paint;
      if (pa > 0.004) {
        const big = opt.sunGlow || 1;
        W().radial(w, sx, sy, 0, 46 * big, [[0, [255, 250, 236]], [0.7, [255, 244, 220]], [1, [255, 240, 210], 0]], 'source-over', pa * 0.95);
        W().radial(L.light.ctx, sx, sy, 0, 300 * big, [[0, [255, 230, 180], 0.55], [0.2, [255, 220, 160], 0.2], [1, [255, 210, 150], 0]], 'lighter', pa * (1 - night));
      }
      if (!opt.noSunGlyph) GL.draw(L.ink.ctx, 'sun', sx, sy, 92 * (opt.sunGlyphS || 1), mSun, { seed: 1, print: k.print, alpha: glyphA });
      items.push({ kind: 'sun', ch: '日', x: sx, y: sy, s: 92, m: mSun });
    }
    // clouds
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 520 + (opt.rush ?? RUSH(tf)) * 22 + 200) % 2400) - 240, cy = 150 + (i % 2) * 90;
      const m = M(10 + i, cx, cy);
      const pa = (1 - ss(0.05, 0.55, m)) * k.paint;
      if (pa > 0.004) W().cloud(L, cx, cy, 0.7, 20 + i, pa * (1 - night * 0.6));
      GL.draw(L.ink.ctx, 'cloud', cx, cy, 110, m, { seed: 10 + i, print: k.print, alpha: glyphA, sx: 1.5, sy: 0.7 });
      items.push({ kind: 'cloud', ch: '云', x: cx, y: cy, s: 110, m });
    }
    // far mountains
    {
      const m = M(5, 560, 470, 0.4);
      const pa = (1 - ss(0.05, 0.55, m)) * k.paint;
      if (pa > 0.004) {
        w.save(); w.beginPath();
        W().ridgePath(w, -300, 2300, (x) => 560 - 120 * Math.exp(-(((x - 520) / 240) ** 2)) - 80 * Math.exp(-(((x - 760) / 160) ** 2)) - 40 * (0.5 + 0.5 * noise1(x * 0.006)));
        w.globalCompositeOperation = 'multiply'; w.globalAlpha = 0.45 * pa; w.fillStyle = rgba([150, 176, 190]); w.fill(); w.restore();
      }
      GL.draw(L.ink.ctx, 'mountain', 560, 470, 170, m, { seed: 5, print: k.print, alpha: glyphA, sx: 1.6, sy: 0.8 });
      items.push({ kind: 'mountain', ch: '山', x: 560, y: 470, s: 170, m });
    }
    // skyline
    for (const b of BLD) {
      const gb = bGlyph(b);
      const m = M(100 + b.seed, gb.x, gb.y);
      building(L, b, t, m, k);
      const g = bGlyph(b);
      items.push({ kind: 'building', ch: '高', x: g.x, y: g.y, s: g.s, m, skip: true });
    }
    if (win_) return { items, k };
    // ground: sidewalk, road, kerb
    W().vgrad(w, -800, GROUND, 2720, 1700, [[0, [196, 190, 180]], [0.06, [176, 172, 166]], [0.08, [110, 112, 120]], [0.42, [96, 98, 106]], [0.44, [170, 166, 160]], [1, [160, 156, 150]]], 'multiply', 0.8 * k.paint);
    if (k.paint * (1 - k.flat) > 0.01) {
      const ink = L.ink.ctx;
      ink.save(); ink.globalAlpha = 0.5 * k.paint * (1 - k.flat); ink.fillStyle = 'rgb(236,232,220)';
      for (let x = -((RUSH(tf) * 0) % 120); x < 1960; x += 120) ink.fillRect(x, 924, 60, 4);
      ink.restore();
    }
    // the protagonist's building and its door
    const mF = M(200, 960, 480), mD = M(201, DOOR.x, DOOR.y - 75, 0.8);
    const P = opt.noHim ? { f: null, doorOpen: opt.doorOpen || 0 } : protagonist(L, t, k);
    k.doorOpen = P.doorOpen;
    facade(L, t, k, mF, mD);
    items.push({ kind: 'door', ch: '门', x: DOOR.x, y: DOOR.y - DOOR.h / 2, s: 120, m: mD, skip: true });
    items.push({ kind: 'building', ch: '高', x: 960, y: 480, s: 300, m: mF, skip: true });
    // trees and lamps
    for (const tr of TREES) {
      const m = M(300 + tr.x, tr.x, GROUND - 100);
      streetTree(L, tr, t, m, k);
      items.push({ kind: 'tree', ch: '木', x: tr.x, y: GROUND + 18 - 118 * tr.s, s: 170 * tr.s, m, skip: true });
    }
    lamp(L, 600, t, k); lamp(L, 1330, t, k);
    // walkers
    const rush = opt.rush ?? RUSH(tf);
    for (const wk of WALKERS) {
      const span = 2300;
      const x = ((wk.off + rush * wk.v * wk.dir) % span + span) % span - 190;
      const m = M(400 + wk.id, x, wk.y - 60);
      const f = { x, y: wk.y, h: wk.h, plan: wk.plan, view: 'side', dir: wk.dir, col: wk.col, walk: FIG.phaseFor(rush * wk.v, wk.h), skirt: wk.skirt, hair: wk.hair,
        pose: { head: 0.35 + 0.2 * ss(43, 47, t), lean: 0.04 }, m, glyph: { print: k.print, alpha: 1 }, alpha: k.paint };
      if (x > -100 && x < 2020) { FIG.draw(L, f); items.push({ kind: 'person', ch: '人', x, y: wk.y - wk.h * 0.5, s: wk.h, m, skip: true }); }
    }
    if (P.f) { P.f.alpha = (P.f.alpha ?? 1) * k.paint; FIG.draw(L, P.f); items.push({ kind: 'person', ch: '人', x: P.f.x, y: P.f.y - P.f.h * 0.5, s: P.f.h, m: P.f.m, skip: true }); }
    // cars
    for (const c of CARS) {
      const span = 2600;
      const x = ((c.off + rush * c.v) % span + span) % span - 340;
      const y = c.lane ? 980 : 940;
      const m = M(500 + c.id, x, y - 30);
      if (x > -200 && x < 2120) { car(L, c, x, y, m, k); items.push({ kind: 'car', ch: '车', x, y: y - 30, s: 104, m, skip: true }); }
    }
    return { items, k };
  }

  // the dead world: every character in print, then a grid, then only days
  function grid(L, t, items) {
    if (!gridPlan) gridPlan = planGrid(items.filter((it) => it.y < 1100 && it.x > -60 && it.x < 1980));
    const plan = gridPlan;
    const g = easeInOut(clamp((t - T_GRID0) / (T_GRID1 - T_GRID0)));
    const ctx = L.ink.ctx;
    const vis = items.filter((it) => it.y < 1100 && it.x > -60 && it.x < 1980);
    // filling: from the sun outward, every square becomes a day
    const sunIt = vis.findIndex((it) => it.kind === 'sun');
    const sc = sunIt >= 0 ? plan.cells[sunIt] : [16, 3];
    const fillR = lerp(-1, 40, easeIn(clamp((t - T_FILL0) / (T_FILL1 - T_FILL0)), 1.6));
    const print = 'rgb(104,104,100)';
    const cellOf = new Map();
    vis.forEach((it, i) => {
      const [cx, cy] = plan.cells[i];
      cellOf.set(cx + cy * GC, true);
      const x = lerp(it.x, (cx + 0.5) * GCELL, g), y = lerp(it.y, (cy + 0.5) * GCELL, g);
      const s = lerp(it.s, GCELL * 0.78, g);
      const dd = Math.hypot(cx - sc[0], cy - sc[1]);
      const flip = clamp((fillR - dd) / 2.5);
      if (flip < 1) GL.print(ctx, it.ch, x, y, s, print, 1 - flip);
      if (flip > 0) GL.print(ctx, '日', x, y, s, print, flip);
    });
    for (let cy = 0; cy < GR; cy++) for (let cx = 0; cx < GC; cx++) {
      if (cellOf.has(cx + cy * GC)) continue;
      const dd = Math.hypot(cx - sc[0], cy - sc[1]) + hash(cx * 3 + cy * 7) * 1.5;
      const a = clamp((fillR - dd) / 1.2);
      if (a > 0) GL.print(ctx, '日', (cx + 0.5) * GCELL, (cy + 0.5) * GCELL, GCELL * 0.78, print, a);
    }
  }

  // at the end we fall into one day of the grid: it will be the window of a room
  const T_PUSH0 = 59.3, T_PUSH1 = 61.0, PCELL = [(16 + 0.5) * 60, (8 + 0.5) * 60];
  function pushCam(t) {
    const u = easeInOut(clamp((t - T_PUSH0) / (T_PUSH1 - T_PUSH0)));
    return W().zoomCam({ x: 960, y: 540, z: 1 }, PCELL, (680 * 1.32) / (60 * 0.78), u);
  }

  // Day 1: the camera leans in to watch him look up, then lets him go
  function day1Cam(t) {
    const i = easeInOut(clamp((t - 37.7) / 1.3)), o = easeInOut(clamp((t - 40.7) / 1.6));
    const u = i * (1 - o);
    return { x: lerp(960, 968, u), y: lerp(540, 610, u), z: lerp(1, 1.75, u) };
  }

  // ------------------------------------------------------------------ public
  function render(L, t) {
    if (t >= T_FLY0 && t < T_BACK1) {
      if (t >= T_BACK0) {
        // the street fades up around the page as we pull back; the page is its wall
        const back = clamp((t - T_BACK0) / (T_BACK1 - T_BACK0));
        const toWin = ss(0.25, 0.85, back);
        W().setCam(L, pageCam(t));
        const a = ss(0.15, 0.85, back);
        L.wash.ctx.save(); L.ink.ctx.save(); L.light.ctx.save();
        L.wash.ctx.globalAlpha = a; L.ink.ctx.globalAlpha = a; L.light.ctx.globalAlpha = a;
        street(L, t, { facadeA: toWin, glassA: toWin, pageA: 1 / Math.max(a, 1e-3) });
        L.wash.ctx.restore(); L.ink.ctx.restore(); L.light.ctx.restore();
      }
      copybook(L, t);
    }
    if (t >= T_BACK1 && t < T_PUSH1) {
      W().setCam(L, day1Cam(t));
      // the last of the painted street fades out before the grid takes over
      const { items } = street(L, Math.min(t, T_GRID0 + 0.001), { paint: 1 - ss(T_GRID0 - 0.8, T_GRID0, t) });
      if (t >= T_GRID0) {
        // the painted street is long gone; redraw only the type
        FS.gfx.begin();
        W().setCam(L, pushCam(t));
        const ink = L.ink.ctx;
        ink.save();
        ink.globalAlpha = 1 - ss(T_PUSH1 - 0.3, T_PUSH1, t);
        grid(L, t, items);
        ink.restore();
      }
    }
    // the counter
    if (t >= 37.6 && t < 60.4) counter(L, t, dayNumber(t), ss(37.6, 38.6, t) * (1 - ss(59.4, 60.4, t)));
    W().subtitle(L, '再后来，我认得每一样东西，', 50.6, 54.6, t, { dark: true });
    W().subtitle(L, '却很久，没有真正看见过它们。', 54.9, 58.9, t, { dark: true });
  }

  function counter(L, t, n, a, o = {}) {
    if (a <= 0.003) return;
    const ctx = L.top.ctx;
    W().setCam(L, W().IDENT, ['top']);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `300 ${o.size || 36}px FSSerif, serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    const s = typeof n === 'string' ? n : n.toLocaleString('en-US');
    const txt = `第 ${s} 天`;
    ctx.fillStyle = o.color || 'rgba(250,246,238,0.9)';
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10;
    ctx.fillText(txt, o.x || 1836, o.y || 96);
    ctx.restore();
  }

  function grade(t, E) {
    // nothing extra yet
  }

  function events() {
    const ev = [];
    DAYS.forEach(([a], i) => { if (a < T_FREEZE) ev.push({ t: +a.toFixed(3), type: 'day', n: i + 1 }); });
    for (let r = 0; r < GRID.rows; r++) for (let c = 1; c < GRID.cols; c++) {
      const tc = T_COPY0 + (r * (GRID.cols - 1) + (c - 1)) * ((T_COPY1 - T_COPY0) / (GRID.rows * (GRID.cols - 1))) * 0.85 + hash(r * 9 + c) * 0.08;
      ev.push({ t: +tc.toFixed(3), type: 'copy' });
    }
    ev.push({ t: T_REN, type: 'write', ch: '人' });
    return ev;
  }

  FS.city = { render, grade, events, street, counter, dayAt, dayNumber, DAYS, GRID, DOOR, FACADE, WALK_Y, GROUND, HIM, skyAt, T_FREEZE };
})(typeof window !== 'undefined' ? window : globalThis);
