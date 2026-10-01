/*
 * 初见 · FIRST SIGHT — characters, and the things they used to be.
 *
 * Every pictographic character in the film is written stroke by stroke in a unit
 * box ([-0.5, 0.5]², y down) in a regular-script hand: [x, y, width, corner?].
 * Each one has a matching SKETCH of the thing it names, with the same number of
 * strokes, so a sun can be drawn, then simplified into ⊙, then straightened into 日.
 *
 *   m = 0      the thing (painted by the scene; the sketch is not shown)
 *   0 → 0.3    the sketch is drawn over it, the painting drains away
 *   0.3 → 1    the sketch straightens into the brush-written character
 *   1 → 2      the handwriting becomes cold print
 */
(function (G) {
  'use strict';
  const FS = G.FS;
  const { clamp, lerp, ss, easeInOut } = FS;
  const B = () => FS.brush;

  // ------------------------------------------------------------- the characters
  const C = 1; // corner flag
  const GLYPH = {
    日: [
      [[-0.26, -0.37, 0.09], [-0.265, -0.3, 0.075], [-0.265, 0.05, 0.07], [-0.26, 0.39, 0.075]],
      [[-0.25, -0.375, 0.065], [0, -0.39, 0.055], [0.22, -0.405, 0.06], [0.275, -0.405, 0.088, C], [0.265, -0.3, 0.075], [0.26, 0.05, 0.07], [0.255, 0.39, 0.075]],
      [[-0.25, 0.0, 0.06], [0, -0.008, 0.05], [0.24, -0.015, 0.06]],
      [[-0.25, 0.375, 0.06], [0, 0.37, 0.05], [0.245, 0.365, 0.065]],
    ],
    山: [
      [[0.0, -0.44, 0.09], [0.0, -0.36, 0.075], [0.0, 0.0, 0.07], [0.0, 0.33, 0.07]],
      [[-0.33, -0.14, 0.085], [-0.335, -0.06, 0.07], [-0.335, 0.22, 0.07], [-0.33, 0.34, 0.078, C], [-0.1, 0.335, 0.055], [0.15, 0.33, 0.055], [0.34, 0.325, 0.062]],
      [[0.33, -0.18, 0.085], [0.335, -0.1, 0.07], [0.335, 0.2, 0.07], [0.33, 0.34, 0.07]],
    ],
    木: [
      [[-0.41, -0.19, 0.06], [-0.1, -0.205, 0.05], [0.2, -0.22, 0.05], [0.42, -0.235, 0.066]],
      [[0.0, -0.47, 0.09], [0.0, -0.4, 0.075], [0.0, 0.1, 0.07], [0.0, 0.47, 0.07]],
      [[-0.01, -0.17, 0.075], [-0.08, -0.03, 0.065], [-0.2, 0.14, 0.05], [-0.32, 0.26, 0.03], [-0.45, 0.34, 0.006]],
      [[0.04, -0.15, 0.025], [0.12, -0.04, 0.05], [0.24, 0.1, 0.07], [0.34, 0.21, 0.085], [0.4, 0.27, 0.06]],
    ],
    水: [
      [[0.02, -0.46, 0.09], [0.02, -0.38, 0.075], [0.02, 0.1, 0.07], [0.015, 0.38, 0.07], [0.0, 0.44, 0.082, C], [-0.12, 0.36, 0.02]],
      [[-0.36, -0.15, 0.06], [-0.24, -0.16, 0.055], [-0.12, -0.17, 0.06], [-0.1, -0.15, 0.076, C], [-0.18, 0.02, 0.055], [-0.3, 0.18, 0.03], [-0.42, 0.28, 0.005]],
      [[0.32, -0.26, 0.07], [0.24, -0.16, 0.055], [0.14, -0.08, 0.03], [0.07, -0.04, 0.008]],
      [[0.06, -0.08, 0.02], [0.14, 0.04, 0.045], [0.24, 0.18, 0.07], [0.34, 0.28, 0.09], [0.4, 0.32, 0.07], [0.46, 0.33, 0.01]],
    ],
    雨: [
      [[-0.36, -0.4, 0.06], [0.0, -0.415, 0.05], [0.37, -0.43, 0.065]],
      [[-0.32, -0.22, 0.075], [-0.325, -0.15, 0.065], [-0.325, 0.2, 0.065], [-0.32, 0.42, 0.065]],
      [[-0.31, -0.225, 0.06], [0.0, -0.235, 0.05], [0.28, -0.245, 0.055], [0.32, -0.24, 0.08, C], [0.315, -0.15, 0.07], [0.31, 0.25, 0.065], [0.3, 0.4, 0.065], [0.28, 0.45, 0.075, C], [0.19, 0.38, 0.02]],
      [[0.0, -0.41, 0.07], [0.0, -0.33, 0.06], [0.0, 0.0, 0.06], [0.0, 0.3, 0.06]],
      [[-0.21, -0.1, 0.03], [-0.18, -0.07, 0.06], [-0.14, -0.03, 0.065]],
      [[-0.21, 0.1, 0.03], [-0.18, 0.13, 0.06], [-0.14, 0.17, 0.065]],
      [[0.12, -0.1, 0.03], [0.15, -0.07, 0.06], [0.19, -0.03, 0.065]],
      [[0.12, 0.1, 0.03], [0.15, 0.13, 0.06], [0.19, 0.17, 0.065]],
    ],
    人: [
      [[0.03, -0.45, 0.085], [0.02, -0.36, 0.075], [-0.02, -0.15, 0.068], [-0.12, 0.08, 0.055], [-0.26, 0.26, 0.035], [-0.44, 0.4, 0.006]],
      [[-0.03, -0.08, 0.03], [0.04, 0.03, 0.045], [0.14, 0.17, 0.065], [0.26, 0.3, 0.085], [0.36, 0.37, 0.095], [0.42, 0.39, 0.07], [0.48, 0.4, 0.01]],
    ],
    高: [
      [[-0.01, -0.49, 0.03], [0.02, -0.45, 0.06], [0.05, -0.41, 0.065]],
      [[-0.42, -0.335, 0.055], [0.0, -0.345, 0.045], [0.43, -0.355, 0.06]],
      [[-0.19, -0.255, 0.06], [-0.19, -0.2, 0.055], [-0.185, -0.09, 0.055]],
      [[-0.185, -0.255, 0.045], [0.1, -0.262, 0.04], [0.18, -0.265, 0.045], [0.2, -0.255, 0.065, C], [0.195, -0.17, 0.055], [0.19, -0.09, 0.055]],
      [[-0.18, -0.11, 0.04], [0.0, -0.115, 0.035], [0.185, -0.12, 0.045]],
      [[-0.37, 0.0, 0.065], [-0.375, 0.06, 0.058], [-0.375, 0.3, 0.058], [-0.37, 0.48, 0.06]],
      [[-0.36, -0.005, 0.05], [0.0, -0.012, 0.042], [0.33, -0.02, 0.05], [0.38, -0.015, 0.075, C], [0.375, 0.06, 0.062], [0.37, 0.36, 0.06], [0.36, 0.44, 0.06], [0.34, 0.49, 0.068, C], [0.25, 0.43, 0.018]],
      [[-0.17, 0.11, 0.055], [-0.17, 0.16, 0.05], [-0.165, 0.33, 0.05]],
      [[-0.165, 0.11, 0.042], [0.1, 0.105, 0.038], [0.155, 0.1, 0.042], [0.17, 0.11, 0.06, C], [0.168, 0.2, 0.05], [0.165, 0.33, 0.05]],
      [[-0.16, 0.31, 0.04], [0.0, 0.307, 0.035], [0.165, 0.303, 0.042]],
    ],
    车: [
      [[-0.34, -0.29, 0.055], [0.0, -0.3, 0.045], [0.35, -0.31, 0.06]],
      [[0.02, -0.45, 0.065], [-0.04, -0.32, 0.06], [-0.14, -0.12, 0.05], [-0.24, 0.04, 0.055, C], [0.0, 0.03, 0.045], [0.3, 0.01, 0.055]],
      [[-0.42, 0.27, 0.055], [0.0, 0.26, 0.045], [0.43, 0.25, 0.06]],
      [[0.06, -0.15, 0.08], [0.06, -0.08, 0.07], [0.06, 0.2, 0.07], [0.06, 0.48, 0.07]],
    ],
    门: [
      [[-0.33, -0.47, 0.03], [-0.29, -0.43, 0.06], [-0.255, -0.39, 0.065]],
      [[-0.33, -0.27, 0.075], [-0.335, -0.2, 0.065], [-0.335, 0.15, 0.065], [-0.33, 0.47, 0.065]],
      [[-0.17, -0.37, 0.05], [0.1, -0.38, 0.045], [0.3, -0.39, 0.05], [0.35, -0.385, 0.08, C], [0.345, -0.3, 0.068], [0.34, 0.3, 0.065], [0.33, 0.42, 0.065], [0.31, 0.48, 0.075, C], [0.21, 0.41, 0.02]],
    ],
    云: [
      [[-0.24, -0.3, 0.055], [0.0, -0.31, 0.045], [0.25, -0.32, 0.06]],
      [[-0.42, -0.07, 0.055], [0.0, -0.08, 0.045], [0.43, -0.09, 0.06]],
      [[-0.02, -0.06, 0.065], [-0.1, 0.08, 0.055], [-0.22, 0.26, 0.05], [-0.28, 0.34, 0.055, C], [0.0, 0.32, 0.045], [0.28, 0.28, 0.05]],
      [[0.17, 0.12, 0.03], [0.24, 0.2, 0.065], [0.3, 0.28, 0.07]],
    ],
  };

  // ------------------------------------------------------------- the things
  const arc = (r, cx, cy, degs) => degs.map((d) => [cx + r * Math.cos((d * Math.PI) / 180), cy + r * Math.sin((d * Math.PI) / 180)]);
  const drop = (x, y) => [[x - 0.012, y - 0.05], [x + 0.012, y + 0.04]];
  const SKETCH = {
    sun: [
      arc(0.4, 0, 0, [-120, -150, -180, -210, -240]),
      arc(0.4, 0, 0, [-120, -90, -60, -30, 0, 30, 60]),
      [[-0.03, 0, 0.09], [0.03, 0, 0.09]],
      arc(0.4, 0, 0, [120, 90, 60]),
    ],
    mountain: [
      [[0.0, -0.44], [0.04, -0.2], [-0.02, 0.05], [0.03, 0.33]],
      [[-0.3, -0.12], [-0.4, 0.1], [-0.46, 0.34, 0, C], [-0.1, 0.34], [0.2, 0.34], [0.46, 0.34]],
      [[0.3, -0.16], [0.38, 0.05], [0.46, 0.34]],
    ],
    tree: [
      [[-0.42, 0.0], [-0.25, -0.22], [0, -0.3], [0.25, -0.22], [0.42, 0.0]],
      [[0.02, -0.36], [-0.02, 0.0], [0.02, 0.46]],
      [[0.0, 0.3], [-0.2, 0.38], [-0.42, 0.44]],
      [[0.0, 0.3], [0.2, 0.38], [0.42, 0.44]],
    ],
    water: [
      [[0.02, -0.4], [0.06, -0.15], [-0.03, 0.1], [0.04, 0.32], [0.0, 0.44]],
      [[-0.42, 0.0], [-0.32, -0.08], [-0.2, -0.06], [-0.16, 0.06], [-0.24, 0.18], [-0.38, 0.22]],
      [[0.36, -0.2], [0.26, -0.14], [0.14, -0.06]],
      [[0.08, 0.0], [0.2, 0.12], [0.34, 0.2], [0.44, 0.24]],
    ],
    rain: [
      [[-0.44, -0.38], [-0.2, -0.46], [0.0, -0.4], [0.2, -0.47], [0.44, -0.4]],
      [[-0.34, -0.25], [-0.36, 0.0], [-0.38, 0.4]],
      [[-0.25, -0.3], [0.05, -0.33], [0.33, -0.3, 0, C], [0.35, 0.05], [0.37, 0.44]],
      [[0.0, -0.38], [0.01, -0.05], [0.02, 0.3]],
      drop(-0.18, -0.06), drop(-0.17, 0.16), drop(0.16, -0.04), drop(0.17, 0.18),
    ],
    person: [
      [[0.0, -0.44], [0.0, -0.3], [0.0, -0.05], [-0.06, 0.15], [-0.14, 0.44]],
      [[0.0, -0.02], [0.06, 0.15], [0.14, 0.44]],
    ],
    building: [
      [[0.0, -0.5], [0.0, -0.43]],
      [[-0.32, -0.4], [0.0, -0.4], [0.32, -0.4]],
      [[-0.12, -0.3], [-0.12, -0.14]],
      [[-0.12, -0.3], [0.12, -0.3, 0, C], [0.12, -0.14]],
      [[-0.12, -0.14], [0.12, -0.14]],
      [[-0.3, -0.4], [-0.3, 0.1], [-0.3, 0.5]],
      [[-0.3, -0.02], [0.3, -0.02, 0, C], [0.3, 0.25], [0.3, 0.5]],
      [[-0.08, 0.22], [-0.08, 0.5]],
      [[-0.08, 0.22], [0.08, 0.22, 0, C], [0.08, 0.5]],
      [[-0.08, 0.5], [0.08, 0.5]],
    ],
    car: [
      [[-0.25, -0.12], [0.0, -0.16], [0.2, -0.12]],
      [[-0.25, -0.12], [-0.35, 0.0, 0, C], [0.0, 0.0], [0.45, 0.02]],
      [[-0.48, 0.2], [0.0, 0.21], [0.48, 0.2]],
      [[0.0, -0.14], [0.0, 0.05], [0.0, 0.2]],
    ],
    door: [
      [[-0.33, -0.48], [-0.28, -0.42]],
      [[-0.3, -0.4], [-0.3, 0.0], [-0.3, 0.48]],
      [[-0.3, -0.4], [0.3, -0.4, 0, C], [0.3, 0.0], [0.3, 0.48]],
    ],
    cloud: [
      [[-0.2, -0.18], [-0.1, -0.32], [0.08, -0.34], [0.22, -0.2]],
      [[-0.45, 0.02], [-0.32, -0.12], [0.0, -0.14], [0.32, -0.1], [0.46, 0.04]],
      [[0.0, 0.0], [-0.12, 0.12], [-0.25, 0.2, 0, C], [0.0, 0.24], [0.3, 0.2]],
      [[0.18, 0.08], [0.24, 0.14], [0.28, 0.18]],
    ],
  };
  for (const ch in GLYPH) {
    for (const st of GLYPH[ch]) {
      const n = st.length;
      st.forEach((p, i) => {
        if (i === 0) { if (p[2] >= 0.05) p[2] *= 1.16; }
        else if (i === n - 1) { if (p[2] >= 0.05) p[2] *= 1.08; }
        else if (!p[3]) p[2] *= 0.9;
      });
    }
  }
  const PAIR = { sun: '日', mountain: '山', tree: '木', water: '水', rain: '雨', person: '人', building: '高', car: '车', door: '门', cloud: '云' };
  const SKW = 0.032;

  // ------------------------------------------------------------- resampling
  // dense spline samples of a stroke in unit space, corners preserved
  function dense(st) {
    const pts = st.map((p) => [p[0], p[1], p[2] ?? SKW, p[3]]);
    return B().sample(pts, 0.008);
  }
  // pick ~n samples along a dense stroke, landing exactly on its corners
  function fractionsOf(d, n) {
    const L = B().arcLengths(d), tot = L[L.length - 1] || 1;
    const cs = (d.corners || []).map((i) => L[Math.min(i, L.length - 1)] / tot);
    const marks = [0, ...cs, 1];
    const fr = [], corner = [];
    for (let k = 0; k < marks.length - 1; k++) {
      const a = marks[k], b = marks[k + 1];
      const m = Math.max(2, Math.round((b - a) * n));
      for (let j = 0; j < m; j++) { fr.push(a + ((b - a) * j) / m); corner.push(j === 0 && k > 0); }
    }
    fr.push(1); corner.push(false);
    return { fr, corner };
  }
  function at(d, L, f) {
    const tot = L[L.length - 1];
    const target = f * tot;
    let lo = 0, hi = L.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (L[mid] < target) lo = mid; else hi = mid; }
    const k = (target - L[lo]) / Math.max(1e-9, L[hi] - L[lo]);
    const a = d[lo], b = d[hi];
    return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  }
  const pairCache = new Map();
  function pair(kind) {
    let P = pairCache.get(kind);
    if (P) return P;
    const ch = PAIR[kind], gs = GLYPH[ch], ks = SKETCH[kind];
    P = gs.map((g, i) => {
      const dg = dense(g), dk = dense(ks[i]);
      const { fr, corner } = fractionsOf(dg, 30);
      const Lg = B().arcLengths(dg), Lk = B().arcLengths(dk);
      return { g: fr.map((f) => at(dg, Lg, f)), k: fr.map((f) => at(dk, Lk, f)), corner, len: Lg[Lg.length - 1] };
    });
    P.ch = ch;
    pairCache.set(kind, P);
    return P;
  }

  // stroke i's local progress inside an overall progress k (strokes overlap)
  function stagger(k, i, n, spread = 0.45) {
    if (n <= 1) return clamp(k);
    const d = (spread * i) / (n - 1);
    return clamp((k - d) / (1 - spread));
  }

  /*
   * draw(ctx, kind, x, y, size, m, o)
   *   o.color   ink colour (string)       o.alpha
   *   o.print   print colour              o.seed
   *   o.rot     rotation                  o.sx, o.sy  (non-uniform scale of the sketch)
   *   o.wob     hand wobble (px)          o.dry       dry brush on the glyph
   */
  function draw(ctx, kind, x, y, size, m, o = {}) {
    if (m <= 0.001) return;
    const P = pair(kind);
    const n = P.length;
    const alpha = o.alpha ?? 1;
    const seed = o.seed ?? 1;
    const sx = o.sx ?? 1, sy = o.sy ?? 1;
    const brushA = alpha * (1 - ss(1.15, 1.65, m));
    if (brushA > 0.003) {
      const write = clamp(m / 0.3);           // the sketch being drawn
      const shape = easeInOut(clamp((m - 0.3) / 0.7)); // sketch → character
      ctx.save();
      ctx.translate(x, y);
      if (o.rot) ctx.rotate(o.rot);
      for (let i = 0; i < n; i++) {
        const S = P[i];
        const ki = easeInOut(stagger(shape, i, n, 0.5));
        const pts = S.g.map((g, j) => {
          const k = S.k[j];
          const w = lerp(k[2] * 0.9, g[2], ki);
          return [lerp(k[0] * sx, g[0], ki) * size, lerp(k[1] * sy, g[1], ki) * size, w * size, ki > 0.6 && S.corner[j] ? 1 : 0];
        });
        B().stroke(ctx, pts, {
          u: stagger(write, i, n, 0.55),
          color: o.color || 'rgb(26,23,21)',
          alpha: brushA,
          wob: (o.wob ?? 0.8) * (1 - ki * 0.5),
          seed: seed * 13 + i,
          dry: (o.dry ?? 0.35) * ki,
          step: Math.max(1.5, size / 90),
        });
      }
      ctx.restore();
    }
    const printA = alpha * ss(1.2, 1.75, m);
    if (printA > 0.003) print(ctx, P.ch, x, y, size, o.print || 'rgb(98,98,96)', printA, o.rot);
  }

  // the cold printed character; the font is scaled so its body matches the brush box
  function print(ctx, ch, x, y, size, color, alpha = 1, rot = 0) {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = color;
    ctx.font = `600 ${size * 0.94}px FSSerif, "Noto Serif SC", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    // CJK faces centre their ideographs 0.38 em above the baseline
    ctx.fillText(ch, size * 0.012, size * 0.94 * 0.38);
    ctx.restore();
  }

  // a character written with the brush, stroke by stroke (u: 0..1 of the whole)
  function write(ctx, ch, x, y, size, u, o = {}) {
    const gs = GLYPH[ch];
    if (!gs) return;
    const n = gs.length;
    const lens = gs.map((g) => { const d = dense(g); const L = B().arcLengths(d); return L[L.length - 1] + 0.25; });
    const tot = lens.reduce((a, b) => a + b, 0);
    let acc = 0;
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    for (let i = 0; i < n; i++) {
      const a = acc / tot, b = (acc + lens[i]) / tot;
      acc += lens[i];
      const ui = clamp((u - a) / (b - a));
      if (ui <= 0) break;
      B().stroke(ctx, B().place([gs[i]], 0, 0, size)[0], {
        u: ui, color: o.color || 'rgb(26,23,21)', alpha: o.alpha ?? 1, wob: o.wob ?? 0.6,
        seed: (o.seed ?? 3) * 11 + i, dry: o.dry ?? 0.3, step: Math.max(1.5, size / 90),
      });
    }
    ctx.restore();
  }

  FS.glyphs = { GLYPH, SKETCH, PAIR, draw, print, write, pair };
})(typeof window !== 'undefined' ? window : globalThis);
