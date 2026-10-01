/*
 * 初见 · FIRST SIGHT — the opening: title, the child's eye, the valley, the names.
 */
(function (G) {
  'use strict';
  const FS = G.FS;
  const { clamp, lerp, ss, ss2, lin, win, easeOut, easeIn, easeInOut, backOut, TAU, hash, h2, noise1, noise2, fbm1, rng, rgba, mixc, hex } = FS;
  const B = FS.brush, GL = FS.glyphs, FIG = FS.fig;
  const VW = 1920, VH = 1080;
  const INK = 'rgb(26,23,21)';

  // ------------------------------------------------------------------ cameras
  const LAYERS = ['wash', 'ink', 'light', 'crayon', 'top', 'mask'];
  function base(L, n) {
    if (n === 'mask') { const w = L.mask.cv.width / VW; return [w, L.mask.cv.height / VH]; }
    const k = L.wash.cv.width / VW; return [k, k];
  }
  // cam: world point (x, y) sits at the centre of the frame, magnified z
  function setCam(L, cam, only) {
    for (const n of only || LAYERS) {
      const [kx, ky] = base(L, n);
      const z = cam.z ?? 1, r = cam.r || 0;
      const c = Math.cos(r) * z, s = Math.sin(r) * z;
      const ctx = L[n].ctx;
      ctx.setTransform(kx * c, ky * s, -kx * s, ky * c, 0, 0);
      // translate so (cam.x, cam.y) maps to the frame centre
      const tx = 960 - (c * cam.x - s * cam.y), ty = 540 - (s * cam.x + c * cam.y);
      ctx.setTransform(kx * c, ky * s, -kx * s, ky * c, kx * tx, ky * ty);
    }
  }
  const IDENT = { x: 960, y: 540, z: 1 };
  function each(L, fn, only) { for (const n of only || LAYERS) fn(L[n].ctx, n); }
  // zoom from cam a to a point p with magnification z1, log-interpolated
  function zoomCam(c0, p, z1, u) {
    const z = c0.z * Math.pow(z1 / c0.z, u);
    const s = (1 - c0.z / z) / (1 - c0.z / z1);
    return { x: lerp(c0.x, p[0], s), y: lerp(c0.y, p[1], s), z };
  }

  // ------------------------------------------------------------------ paint helpers
  function vgrad(ctx, x0, y0, x1, y1, stops, op = 'source-over', alpha = 1) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    for (const [o, c, a] of stops) g.addColorStop(o, rgba(c, a ?? 1));
    ctx.save();
    ctx.globalCompositeOperation = op;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
  }
  function radial(ctx, x, y, r0, r1, stops, op = 'source-over', alpha = 1, o = {}) {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    for (const [o, c, a] of stops) g.addColorStop(o, rgba(c, a ?? 1));
    ctx.save();
    ctx.globalCompositeOperation = op;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    if (o.rect) ctx.fillRect(x - o.rect, y - o.rect, o.rect * 2, o.rect * 2);
    else { ctx.beginPath(); ctx.arc(x, y, r1, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // a silhouette along x: y = base - amp * shape(x)
  function ridgePath(ctx, x0, x1, fy, step = 8) {
    ctx.moveTo(x0, VH * 3);
    for (let x = x0; x <= x1 + step; x += step) ctx.lineTo(x, fy(x));
    ctx.lineTo(x1 + step, VH * 3);
    ctx.closePath();
  }
  function poly(ctx, pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  // a wash: fill a polygon a few times with jittered edges
  const deformCache = new Map();
  function washPoly(ctx, key, pts, color, alpha, o = {}) {
    let layers = deformCache.get(key);
    if (!layers) {
      const R = rng(o.seed ?? key.length * 7.1);
      layers = [];
      for (let k = 0; k < (o.layers || 3); k++) layers.push(B.deform(pts, o.depth ?? 2, o.amt ?? 0.35, R));
      deformCache.set(key, layers);
    }
    ctx.save();
    ctx.globalCompositeOperation = o.op || 'multiply';
    ctx.fillStyle = Array.isArray(color) ? rgba(color) : color;
    for (const p of layers) {
      ctx.globalAlpha = alpha / layers.length * 1.25;
      ctx.beginPath(); poly(ctx, p); ctx.fill();
    }
    ctx.restore();
  }
  function inkLine(ctx, pts, w, a = 1, seed = 1, o = {}) {
    B.stroke(ctx, pts.map((p) => [p[0], p[1], p[2] ?? w, p[3]]), Object.assign({ color: INK, alpha: a, wob: 0.6, seed, dry: 0 }, o));
  }

  // ------------------------------------------------------------------ type
  function brushText(ctx, ch, x, y, size, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = `400 ${size}px FSBrush, FSSerif, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(ch, x, y + size * 0.36);
    ctx.restore();
  }
  // subtitles: light serif, one line, with a soft fade
  function subtitle(L, text, t0, t1, t, o = {}) {
    const a = ss(t0, t0 + 0.6, t) * (1 - ss(t1 - 0.6, t1, t));
    if (a <= 0.003) return;
    const ctx = L.top.ctx;
    ctx.save();
    setCam(L, IDENT, ['top']);
    ctx.font = `300 ${o.size || 40}px FSSerif, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const y = o.y || 984;
    const x = o.x || 960;
    const dark = o.dark;
    const spaced = text.split('').join(String.fromCharCode(8202));
    ctx.globalAlpha = a * (dark ? 0.5 : 0.55);
    ctx.fillStyle = dark ? 'rgba(250,246,238,0.9)' : 'rgba(10,8,6,0.8)';
    ctx.shadowColor = dark ? 'rgba(255,250,240,0.9)' : 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 18;
    ctx.fillText(spaced, x, y);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = a;
    ctx.fillStyle = dark ? 'rgba(34,30,27,0.92)' : 'rgba(250,246,238,0.96)';
    ctx.fillText(spaced, x, y);
    ctx.restore();
  }

  // ================================================================== S0 · title
  const TITLE = [['一', '个', '人', '的', '世', '界', '，'], ['是', '从', '什', '么', '时', '候'], ['开', '始', '褪', '色', '的', '？']];
  function title(L, t) {
    setCam(L, IDENT);
    const ctx = L.ink.ctx;
    const size = 84, step = 98;
    const cols = [1104, 960, 816];
    const starts = [0.9, 2.05, 2.95];
    TITLE.forEach((col, ci) => {
      col.forEach((ch, i) => {
        const t0 = starts[ci] + i * (ci ? 0.13 : 0.14);
        const u = clamp((t - t0) / 0.42);
        if (u <= 0) return;
        let x = cols[ci], y = 250 + i * step;
        if (ch === '，') { x += 30; y -= 40; }
        // dissolve: each character lets go of its ink at its own moment
        const td = 5.25 + hash(ci * 31 + i) * 0.9;
        const d = clamp((t - td) / 1.1);
        const a = (1 - d * d) * Math.min(1, u * 1.6);
        if (a <= 0.003) return;
        ctx.save();
        // write-on: the ink arrives from the top-left of the character
        ctx.beginPath();
        ctx.arc(x - size * 0.55, y - size * 0.55, size * 2.2 * easeOut(u, 2), 0, TAU);
        ctx.clip();
        if (d > 0) {
          // diffusing into the water of the paper
          for (let k = 0; k < 4; k++) {
            const r = d * 12 * (k + 1) * 0.6, an = hash(i * 7 + k + ci * 3) * TAU;
            brushText(ctx, ch, x + Math.cos(an) * r, y + Math.sin(an) * r + d * 8, size * (1 + d * 0.05), 'rgb(40,36,34)', a * 0.3);
          }
        }
        brushText(ctx, ch, x, y + d * 5, size, 'rgb(24,21,19)', a * (1 - d * 0.5));
        ctx.restore();
      });
    });
  }

  // ================================================================== S1a · the eye
  // the eye lives in its own coordinates: centred on (960, 540)
  const EYE = { cx: 960, cy: 540, ir: 212, pr: 76, refl: { x: 1018, y: 474, w: 112, h: 63 } };
  const T_DROP = 6.25, T_HIT = 6.85;
  // lid curves (quadratic-ish) parametrised by openness 0..1
  function lids(open, spread = 0) {
    // upper lid
    const ux0 = 500 - spread * 60, ux1 = 1430 + spread * 60;
    const uy = lerp(640, 318 - spread * 140, open);
    const ly = 712 + spread * 140;
    const upper = [], lower = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      const x = lerp(ux0, ux1, u);
      // asymmetric almond: the peak sits a little toward the inner corner
      const k = Math.sin(Math.PI * Math.pow(u, 0.88));
      upper.push([x, lerp(580, 548, u) - (lerp(580, 548, u) - uy) * k]);
      const k2 = Math.sin(Math.PI * Math.pow(u, 1.12));
      lower.push([x, lerp(584, 552, u) + (ly - 640) * k2 + 60 * k2]);
    }
    return { upper, lower };
  }
  function eyeOpening(ctx, lz) {
    ctx.moveTo(lz.upper[0][0], lz.upper[0][1]);
    for (const p of lz.upper) ctx.lineTo(p[0], p[1]);
    for (let i = lz.lower.length - 1; i >= 0; i--) ctx.lineTo(lz.lower[i][0], lz.lower[i][1]);
    ctx.closePath();
  }
  // a painted iris: wet-in-wet bloom from a drop
  function iris(L, cx, cy, R, pupil, o) {
    const w = L.wash.ctx;
    const seed = o.seed ?? 5;
    const palette = o.palette;
    const shape = B.blobPoly(R, R, seed, 0.05, 64, 3);
    w.save();
    w.beginPath(); B.polyPath(w, shape, cx, cy); w.clip();
    // base: honey centre to a deep rim
    radial(w, cx, cy, 0, R * 1.02, [[0, palette[0]], [0.42, palette[1]], [0.78, palette[2]], [1, palette[3]]], 'source-over', o.alpha ?? 1);
    // wet-in-wet blooms
    const r = rng(seed);
    for (let i = 0; i < 9; i++) {
      const a = r() * TAU, d = r.range(0.35, 0.8) * R;
      B.blob(w, cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * r.range(0.18, 0.32), R * r.range(0.15, 0.3), rgba(palette[1 + (i % 3)]), 0.35 * (o.alpha ?? 1), seed + i * 13, { layers: 2, irr: 0.3 });
    }
    // fibres
    w.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 150; i++) {
      const a = (i / 150) * TAU + r() * 0.03;
      const r0 = pupil * r.range(1.0, 1.3), r1 = R * r.range(0.55, 0.98);
      w.strokeStyle = rgba(palette[1 + (i % 3)], 0.22 * (o.alpha ?? 1));
      w.lineWidth = r.range(1.2, 3.2);
      w.beginPath();
      w.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      const m = (r0 + r1) / 2, wig = r.range(-0.05, 0.05);
      w.quadraticCurveTo(cx + Math.cos(a + wig) * m, cy + Math.sin(a + wig) * m, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      w.stroke();
    }
    // limbal ring
    w.globalAlpha = 0.55 * (o.alpha ?? 1);
    w.strokeStyle = rgba(palette[3]);
    w.lineWidth = R * 0.08;
    w.beginPath(); w.arc(cx, cy, R * 0.97, 0, TAU); w.stroke();
    w.restore();
  }

  // draw the eye. reflect(L) paints the world seen in it (in reflection-rect coords)
  function eye(L, t, s) {
    const { cx, cy, ir, pr } = EYE;
    // the drop
    if (t < T_HIT + 0.05) {
      const u = clamp((t - T_DROP) / (T_HIT - T_DROP));
      if (u > 0) {
        const y = lerp(-80, cy, easeIn(u, 2.2));
        const w = L.wash.ctx;
        const st = 1 + u * 0.4;
        w.save();
        w.globalCompositeOperation = 'multiply';
        w.fillStyle = rgba([196, 150, 84], 0.85);
        w.beginPath();
        w.moveTo(cx, y - 34 * st);
        w.bezierCurveTo(cx + 6, y - 18 * st, cx + 15, y - 4, cx + 15, y + 6);
        w.arc(cx, y + 6, 15, 0, Math.PI);
        w.bezierCurveTo(cx - 15, y - 4, cx - 6, y - 18 * st, cx, y - 34 * st);
        w.fill();
        w.restore();
        FS.fig.dot({ light: L.light }, {}, cx - 5, y + 1, 4, [255, 250, 240], 'light', 0.8);
      }
    }
    const bloom = clamp((t - T_HIT) / 1.5);
    if (bloom <= 0) return;
    const R = ir * easeOut(bloom, 3.2);
    // the lids gather around the iris as they are drawn
    const draw = clamp((t - 7.75) / 1.5);
    const settle = easeInOut(clamp((t - 7.6) / 1.8));
    const blink = s.blink || 0;
    const lz = lids(1 - blink, 1 - settle);
    const pal = s.palette || [[226, 176, 92], [168, 136, 70], [104, 112, 74], [58, 62, 66]];
    each(L, (c) => { c.save(); c.beginPath(); eyeOpening(c, lz); c.clip(); }, ['wash', 'light', 'ink', 'crayon']);
    // sclera: a whisper of blue-grey shadow under the upper lid
    if (settle > 0) {
      vgrad(L.wash.ctx, -400, lz.upper[12][1] - 20, 2400, 760, [[0, [190, 190, 210]], [0.3, [232, 230, 234]], [1, [246, 244, 242]]], 'multiply', settle * 0.6);
    }
    iris(L, cx, cy, R, pr, { palette: pal, seed: s.seed ?? 5, alpha: 1 });
    // pupil
    const pu = easeOut(clamp((t - T_HIT - 0.45) / 1.0), 2) * (s.pupil ?? 1);
    if (pu > 0) {
      const w = L.wash.ctx;
      w.save();
      w.fillStyle = 'rgb(20,18,20)';
      w.beginPath(); B.polyPath(w, B.blobPoly(pr * pu, pr * pu, 9, 0.04, 40, 2), cx, cy); w.fill();
      w.restore();
    }
    // reflection: the world, small and bright
    const rf = clamp((t - 8.9) / 0.9) * (s.refl ?? 1);
    if (rf > 0 && s.reflect) {
      const { x, y, w: rw, h: rh } = EYE.refl;
      each(L, (c) => {
        c.save();
        c.beginPath();
        c.moveTo(x - rw / 2 + 10, y - rh / 2);
        c.quadraticCurveTo(x, y - rh / 2 - 6, x + rw / 2 - 10, y - rh / 2);
        c.quadraticCurveTo(x + rw / 2 + 2, y - rh / 2, x + rw / 2, y - rh / 2 + 10);
        c.lineTo(x + rw / 2, y + rh / 2 - 10);
        c.quadraticCurveTo(x + rw / 2, y + rh / 2 + 2, x + rw / 2 - 10, y + rh / 2);
        c.quadraticCurveTo(x, y + rh / 2 + 6, x - rw / 2 + 10, y + rh / 2);
        c.quadraticCurveTo(x - rw / 2 - 2, y + rh / 2, x - rw / 2, y + rh / 2 - 10);
        c.lineTo(x - rw / 2, y - rh / 2 + 10);
        c.quadraticCurveTo(x - rw / 2 - 2, y - rh / 2, x - rw / 2 + 10, y - rh / 2);
        c.closePath();
        c.clip();
        c.translate(x - rw / 2, y - rh / 2);
        c.scale(rw / VW, rh / VH);
      }, ['wash', 'ink', 'light', 'crayon']);
      // white paper first, then the world fades up inside
      const w = L.wash.ctx;
      w.save(); w.globalAlpha = rf; w.fillStyle = '#fbf8f0'; w.fillRect(0, 0, VW, VH); w.restore();
      w.save(); w.globalAlpha = rf; s.reflect(L); w.restore();
      // the curved cornea washes the reflection out, brightest toward its rim
      const glare = (1 - (s.zoomU || 0));
      w.save(); w.globalAlpha = 0.34 * glare * rf; w.fillStyle = '#fffaf2'; w.fillRect(0, 0, VW, VH); w.restore();
      radial(w, VW / 2, VH / 2, VW * 0.3, VW * 0.62, [[0, [255, 252, 244], 0], [1, [255, 252, 244], 0.9]], 'source-over', glare * rf, { rect: VW });
      radial(L.light.ctx, VW * 0.22, VH * 0.18, 0, VW * 0.5, [[0, [255, 255, 255], 0.55], [1, [255, 255, 255], 0]], 'lighter', glare * rf, { rect: VW });
      each(L, (c) => c.restore(), ['wash', 'ink', 'light', 'crayon']);
      radial(L.light.ctx, x, y, 0, rw * 0.9, [[0, [255, 250, 240], 0.35], [1, [255, 250, 240], 0]], 'lighter', glare * rf);
    }
    // a second, tiny catch-light
    if (rf > 0) FS.fig.dot({ light: L.light }, {}, cx - 46, cy + 40, 9, [255, 255, 250], 'light', 0.5 * rf);
    each(L, (c) => c.restore(), ['wash', 'light', 'ink', 'crayon']);

    // skin around the eye
    if (settle > 0) {
      const w = L.wash.ctx;
      w.save();
      w.beginPath(); w.rect(-4000, -4000, 9920, 9080); eyeOpening(w, lz); w.clip('evenodd');
      const sk = s.skin || [246, 214, 194];
      radial(w, cx, cy + 30, 120, 1050, [[0, sk, 0.95], [0.45, sk, 0.7], [0.8, sk, 0.25], [1, sk, 0]], 'multiply', settle, { rect: 2600 });
      // shadow in the crease and under the brow
      w.globalAlpha = settle * 0.22;
      const up = lz.upper;
      w.fillStyle = rgba([196, 140, 132]);
      w.beginPath();
      w.moveTo(up[0][0], up[0][1]);
      for (const p of up) w.lineTo(p[0], p[1] - 4);
      for (let i = up.length - 1; i >= 0; i--) w.lineTo(up[i][0], up[i][1] - 70 * Math.sin((Math.PI * i) / (up.length - 1)) - 6);
      w.closePath(); w.fill();
      w.restore();
    }
    // ink: lids, crease, lashes, written on
    const ink = L.ink.ctx;
    const d1 = clamp(draw / 0.55), d2 = clamp((draw - 0.25) / 0.5), d3 = clamp((draw - 0.55) / 0.45);
    if (d1 > 0) {
      const up = lz.upper.map((p, i, a) => [p[0], p[1], 5 + 9 * Math.sin((Math.PI * i) / (a.length - 1)) ** 0.6]);
      inkLine(ink, up, 8, 0.95, 11, { u: d1, dry: 0.25 });
      // the crease
      const cr = lz.upper.filter((_, i) => i > 3 && i < 21).map((p, i, a) => [p[0], p[1] - 62 * Math.sin((Math.PI * (i + 4)) / 24) - 10 + blink * 40, 3.2 * Math.sin((Math.PI * i) / (a.length - 1)) + 0.8]);
      inkLine(ink, cr, 3, 0.55, 12, { u: d2 });
    }
    if (d2 > 0) {
      const lo = lz.lower.filter((_, i) => i > 1).map((p, i, a) => [p[0], p[1], 1 + 4 * Math.sin((Math.PI * i) / (a.length - 1))]);
      inkLine(ink, lo, 3, 0.7, 13, { u: d2 });
    }
    if (d3 > 0) {
      const up = lz.upper;
      for (let k = 0; k < 13; k++) {
        const i = 5 + Math.round(k * 1.45);
        if (i >= up.length - 1) break;
        const p = up[i], q = up[Math.min(up.length - 1, i + 1)];
        const nx = (q[1] - p[1]), ny = -(q[0] - p[0]);
        const nl = Math.hypot(nx, ny) || 1;
        const out = (k / 12) * 0.9 + 0.1;
        const len = 46 + 30 * Math.sin((Math.PI * k) / 12);
        const dx = nx / nl, dy = ny / nl;
        const ex = p[0] + dx * len * 0.6 + out * len * 0.7, ey = p[1] + dy * len - len * 0.15;
        const u = clamp((d3 - k * 0.04) / 0.3);
        inkLine(ink, [[p[0], p[1], 4.2], [lerp(p[0], ex, 0.55) - 4, lerp(p[1], ey, 0.6), 2.6], [ex, ey, 0.3]], 3, 0.85, 20 + k, { u });
      }
    }
  }

  // ================================================================== S1b · the valley
  const V = {
    sun: { x: 1500, y: 214, s: 122 },
    mountain: { x: 900, y: 470, s: 420 },
    tree: { x: 318, y: 566, s: 560 },
    water: { x: 1250, y: 768, s: 228 },
    rain: { x: 1190, y: 246, s: 190 },
  };
  const C_SKY_T = [62, 128, 184], C_SKY_M = [140, 188, 214], C_SKY_H = [246, 236, 210];
  const AZ = [48, 104, 148], MAL = [84, 152, 122], OCH = [196, 164, 112];

  function sky(L, t, k) {
    const w = L.wash.ctx;
    vgrad(w, -400, -300, 2320, 760, [[0, C_SKY_T], [0.5, C_SKY_M], [1, C_SKY_H]], 'source-over', k.paint);
    // uneven pigment
    for (let i = 0; i < 6; i++) B.blob(w, 200 + i * 330, 120 + (i % 2) * 140, 260, 120, rgba([110, 150, 190]), 0.12 * k.paint, 40 + i, { layers: 2, irr: 0.35 });
    // sun halo: the paper left almost white around the sun
    const sm = clamp(k.sunM / 0.55);
    radial(w, V.sun.x, V.sun.y, 0, 330, [[0, [255, 252, 238]], [0.16, [255, 248, 226]], [0.45, [250, 238, 206], 0.55], [1, [250, 238, 206], 0]], 'source-over', k.paint * (1 - sm));
    // clouds drift
    const clouds = [[300, 170, 1.0], [760, 110, 0.8], [1180, 190, 0.9], [1780, 130, 0.7], [-60, 260, 0.6]];
    clouds.forEach(([x, y, s], i) => {
      const cx = x + t * (6 + i * 2), cy = y;
      cloud(L, cx, cy, s, i, k.paint);
    });
  }
  function cloud(L, x, y, s, seed, a) {
    const w = L.wash.ctx;
    const R = rng(100 + seed);
    for (let i = 0; i < 7; i++) {
      const bx = x + R.range(-150, 150) * s, by = y + R.range(-30, 10) * s - Math.abs(R.range(0, 30)) * s;
      B.blob(w, bx, by, R.range(55, 95) * s, R.range(34, 55) * s, 'rgb(253,251,246)', 0.7 * a, seed * 10 + i, { layers: 3, irr: 0.25 });
    }
    // shadowed underside
    B.blob(w, x, y + 22 * s, 170 * s, 26 * s, 'rgba(176,180,206,1)', 0.22 * a, seed * 10 + 9, { layers: 2, irr: 0.3 });
  }

  function sun(L, t, k) {
    const { x, y, s } = V.sun;
    const pa = (1 - ss(0.05, 0.5, k.sunM)) * k.paint;
    if (pa > 0.003) {
      const w = L.wash.ctx;
      w.save(); w.globalAlpha = pa;
      w.fillStyle = 'rgb(255,251,238)';
      w.beginPath(); B.polyPath(w, B.blobPoly(44, 44, 3, 0.03, 40, 2), x, y); w.fill();
      w.restore();
      const l = L.light.ctx;
      radial(l, x, y, 0, 360, [[0, [255, 236, 190], 0.55], [0.12, [255, 226, 170], 0.32], [0.5, [255, 210, 150], 0.08], [1, [255, 200, 140], 0]], 'lighter', pa);
      // slow rays
      l.save();
      l.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU + t * 0.03 + noise1(i * 3.3) * 0.2;
        const len = 380 + 160 * noise1(i * 1.7 + t * 0.2);
        const g = l.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
        g.addColorStop(0, `rgba(255,236,196,${0.10 * pa})`); g.addColorStop(1, 'rgba(255,236,196,0)');
        l.fillStyle = g;
        l.beginPath();
        l.moveTo(x, y);
        l.lineTo(x + Math.cos(a - 0.035) * len, y + Math.sin(a - 0.035) * len);
        l.lineTo(x + Math.cos(a + 0.035) * len, y + Math.sin(a + 0.035) * len);
        l.closePath(); l.fill();
      }
      l.restore();
    }
    GL.draw(L.ink.ctx, 'sun', x, y, s, k.sunM, { seed: 1, alpha: k.glyphA });
  }

  function mountains(L, t, k) {
    const w = L.wash.ctx;
    // far range
    w.save(); w.beginPath();
    ridgePath(w, -300, 2300, (x) => 560 - 70 * (0.5 + 0.5 * noise1(x * 0.004 + 3)) - 40 * noise1(x * 0.013 + 1));
    w.globalCompositeOperation = 'multiply'; w.globalAlpha = 0.45 * k.paint; w.fillStyle = rgba([176, 198, 216]); w.fill(); w.restore();
    // the mountain: 青绿, azurite tops, malachite flanks, mist at the foot
    const M = V.mountain;
    const pa = (1 - ss(0.05, 0.6, k.mtnM)) * k.paint;
    if (pa > 0.003) {
      const shape = [[-0.8, 0.5], [-0.56, 0.22], [-0.42, 0.04], [-0.31, -0.12], [-0.22, -0.03], [-0.13, 0.05], [-0.07, -0.2], [0, -0.44], [0.08, -0.26], [0.15, 0.02], [0.23, -0.07], [0.3, -0.16], [0.39, -0.01], [0.52, 0.2], [0.84, 0.5]]
        .map(([u, v]) => [M.x + u * M.s, M.y + v * M.s]);
      const g = w.createLinearGradient(0, M.y - 0.45 * M.s, 0, M.y + 0.42 * M.s);
      g.addColorStop(0, rgba(AZ)); g.addColorStop(0.35, rgba(mixc(AZ, MAL, 0.6))); g.addColorStop(0.7, rgba(MAL, 0.9)); g.addColorStop(1, rgba(MAL, 0));
      washPoly(w, 'mtn', shape, g, 0.92 * pa, { seed: 7, layers: 3, amt: 0.25, depth: 3 });
      // ochre warmth at the feet of the ridges
      washPoly(w, 'mtn2', shape.map(([x, y]) => [x, Math.max(y, M.y + 0.05 * M.s)]), rgba(OCH), 0.18 * pa, { seed: 8 });
      // ink: texture strokes (皴) and moss dots (苔点) along the ridges
      const ink = L.ink.ctx;
      const R = rng(31);
      for (let i = 0; i < 26; i++) {
        const u = R.range(-0.55, 0.55);
        const top = ridgeY(shape, M.x + u * M.s);
        const x0 = M.x + u * M.s, y0 = top + R.range(8, 70);
        inkLine(ink, [[x0, y0, 3.2], [x0 + R.range(-14, 14), y0 + R.range(18, 40), 1.6], [x0 + R.range(-20, 20), y0 + R.range(40, 70), 0.3]], 2, 0.32 * pa, 50 + i, { dry: 0.6 });
      }
      for (let i = 0; i < 22; i++) {
        const u = R.range(-0.5, 0.52);
        const x0 = M.x + u * M.s, y0 = ridgeY(shape, x0) + R.range(2, 26);
        ink.save(); ink.globalAlpha = 0.6 * pa; ink.fillStyle = INK;
        ink.beginPath(); ink.ellipse(x0, y0, R.range(2, 4.5), R.range(1.5, 3), R.range(-0.5, 0.5), 0, TAU); ink.fill(); ink.restore();
      }
      // contour of the peaks, in a few broken strokes that thin out as they go
      for (const [a0, a1, sd] of [[2, 5, 61], [5, 8, 62], [7, 10, 63], [10, 13, 64]]) {
        const seg = shape.slice(a0, a1 + 1);
        inkLine(ink, seg.map(([x, y], i) => [x, y, lerp(3.4, 0.8, i / (seg.length - 1))]), 2.4, 0.5 * pa, sd, { dry: 0.45 });
      }
    }
    GL.draw(L.ink.ctx, 'mountain', M.x, M.y, M.s, k.mtnM, { seed: 2, alpha: k.glyphA, sx: 1.08, sy: 1.0 });
    // hills in front of it
    const hillA = k.paint;
    w.save(); w.beginPath();
    ridgePath(w, -300, 2300, (x) => 640 - 46 * (0.5 + 0.5 * noise1(x * 0.0035 + 9)) - 16 * noise1(x * 0.02));
    w.globalCompositeOperation = 'multiply'; w.globalAlpha = 0.55 * hillA;
    const hg = w.createLinearGradient(0, 580, 0, 760); hg.addColorStop(0, rgba([120, 172, 120])); hg.addColorStop(1, rgba([160, 190, 120]));
    w.fillStyle = hg; w.fill(); w.restore();
    // little trees on the hills
    const R = rng(77);
    for (let i = 0; i < 28; i++) {
      const x = R.range(-100, 2000), y = 640 - 46 * (0.5 + 0.5 * noise1(x * 0.0035 + 9)) - 16 * noise1(x * 0.02) + R.range(4, 30);
      if (Math.abs(x - V.tree.x) < 300) continue;
      B.blob(w, x, y - 10, R.range(10, 18), R.range(12, 20), rgba(R.pick([[70, 128, 86], [96, 146, 92], [56, 110, 84]])), 0.55 * hillA, 300 + i, { layers: 2 });
    }
  }
  function ridgeY(shape, x) {
    let best = 1e9;
    for (let i = 0; i < shape.length - 1; i++) {
      const a = shape[i], b = shape[i + 1];
      if ((x - a[0]) * (x - b[0]) <= 0 && a[0] !== b[0]) best = Math.min(best, lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0])));
    }
    return best === 1e9 ? 600 : best;
  }

  function meadow(L, t, k) {
    const w = L.wash.ctx;
    w.save(); w.beginPath();
    ridgePath(w, -300, 2300, (x) => 700 - 22 * noise1(x * 0.004 + 2));
    const g = w.createLinearGradient(0, 680, 0, 1080);
    g.addColorStop(0, rgba([168, 196, 116])); g.addColorStop(0.5, rgba([126, 172, 92])); g.addColorStop(1, rgba([92, 140, 78]));
    w.globalCompositeOperation = 'multiply'; w.globalAlpha = 0.8 * k.paint; w.fillStyle = g; w.fill(); w.restore();
    for (let i = 0; i < 7; i++) B.blob(w, 150 + i * 290, 900 + (i % 3) * 50, 240, 70, rgba([90, 146, 80]), 0.16 * k.paint, 500 + i, { layers: 2, irr: 0.35 });
  }
  function grass(L, t, k, front) {
    const w = L.wash.ctx, ink = L.ink.ctx;
    const R = rng(front ? 91 : 92);
    const n = front ? 150 : 110;
    w.save(); w.globalCompositeOperation = 'multiply';
    for (let i = 0; i < n; i++) {
      const x = R.range(-60, 1980);
      const y = front ? R.range(960, 1110) : R.range(730, 960);
      const hgt = (front ? R.range(50, 120) : R.range(18, 46)) * (0.6 + (y - 700) / 600);
      const sway = (noise1(t * 0.6 + x * 0.004) * 0.5 + 0.2 * Math.sin(t * 1.7 + i)) * hgt * 0.25;
      const c = R.pick([[96, 150, 72], [70, 128, 70], [130, 170, 80], [60, 110, 60]]);
      w.strokeStyle = rgba(c, 0.75 * k.paint);
      w.lineWidth = front ? R.range(2.5, 5) : R.range(1.5, 3);
      w.lineCap = 'round';
      w.beginPath(); w.moveTo(x, y); w.quadraticCurveTo(x + sway * 0.3, y - hgt * 0.6, x + sway, y - hgt); w.stroke();
    }
    w.restore();
    // flowers
    const F = [[222, 72, 58], [246, 200, 70], [252, 250, 244], [154, 112, 196], [240, 140, 150]];
    for (let i = 0; i < (front ? 34 : 60); i++) {
      const x = R.range(-40, 1960), y = front ? R.range(975, 1080) : R.range(740, 960);
      if (!front && x > 1000 && x < 1500 && y < 830) continue;
      const r = (front ? R.range(6, 10) : R.range(2.5, 5)) * (0.7 + (y - 700) / 700);
      const c = R.pick(F);
      B.blob(w, x, y - r * 2, r * 1.3, r, rgba(c), 0.9 * k.paint, 900 + i, { layers: 2, irr: 0.25 });
      if (front) inkLine(ink, [[x, y - r * 2], [x + 2, y + 20]], 1.2, 0.35 * k.paint, i);
    }
  }

  function pond(L, t, k) {
    const P = V.water;
    const pa = (1 - ss(0.05, 0.6, k.waterM)) * k.paint;
    if (pa > 0.003) {
      const w = L.wash.ctx;
      const cx = P.x, cy = P.y + 20, rx = 270, ry = 50;
      w.save();
      w.beginPath(); B.polyPath(w, B.blobPoly(rx, ry, 4, 0.06, 48, 2), cx, cy); w.clip();
      vgrad(w, cx - rx, cy - ry, cx + rx, cy + ry, [[0, [214, 228, 230]], [0.5, [150, 190, 210]], [1, [90, 140, 170]]], 'source-over', pa);
      // reflection of the mountain
      w.globalAlpha = 0.25 * pa;
      w.fillStyle = rgba(MAL);
      w.beginPath(); w.ellipse(cx - 220, cy - 30, 140, 22, 0, 0, TAU); w.fill();
      w.restore();
      const ink = L.ink.ctx;
      // shimmering ripples
      for (let i = 0; i < 9; i++) {
        const y = cy - ry * 0.6 + i * ry * 0.16;
        const x0 = cx - rx * 0.7 + noise1(i * 3 + t * 0.4) * 40, len = 60 + 50 * hash(i);
        inkLine(ink, [[x0, y, 1.6], [x0 + len, y + 1, 0.6]], 1.4, 0.25 * pa, 70 + i);
      }
      // rain rings
      if (k.rain > 0) {
        for (let i = 0; i < 26; i++) {
          const life = 0.9, ph = (t / life + hash(i * 5.1)) % 1, n = Math.floor(t / life + hash(i * 5.1));
          const rx2 = cx + (h2(i, n) - 0.5) * rx * 1.7, ry2 = cy + (h2(n, i) - 0.5) * ry * 1.5;
          if (((rx2 - cx) / rx) ** 2 + ((ry2 - cy) / ry) ** 2 > 0.8) continue;
          ink.save(); ink.globalAlpha = (1 - ph) * 0.45 * k.rain * pa; ink.strokeStyle = 'rgba(40,60,80,1)'; ink.lineWidth = 1.2;
          ink.beginPath(); ink.ellipse(rx2, ry2, 3 + ph * 22, (3 + ph * 22) * 0.28, 0, 0, TAU); ink.stroke(); ink.restore();
        }
      }
      inkLine(ink, B.blobPoly(rx, ry, 4, 0.06, 48, 2).slice(26, 46).map(([x, y]) => [cx + x, cy + y, 2]), 2, 0.3 * pa, 79, { dry: 0.3 });
    }
    GL.draw(L.ink.ctx, 'water', P.x, P.y, P.s, k.waterM, { seed: 4, alpha: k.glyphA, sx: 1.4, sy: 0.7 });
  }

  function tree(L, t, k) {
    const T = V.tree;
    const pa = (1 - ss(0.05, 0.6, k.treeM)) * k.paint;
    if (pa > 0.003) {
      const w = L.wash.ctx, ink = L.ink.ctx;
      const sway = (u) => noise1(t * 0.35 + u) * 6;
      // trunk
      const trunk = [[T.x + 4, 886, 66], [T.x - 2, 846, 52], [T.x - 8, 740, 46], [T.x + 4, 620, 40], [T.x - 2, 520, 32], [T.x + sway(1), 400, 15]];
      w.save(); w.globalCompositeOperation = 'multiply'; w.globalAlpha = 0.85 * pa;
      B.stroke(w, trunk, { color: rgba([120, 92, 70]), wob: 2, seed: 3 });
      B.stroke(w, [[T.x - 6, 600, 30], [T.x - 90, 500, 18], [T.x - 190 + sway(2), 400, 6]], { color: rgba([120, 92, 70]), wob: 1.5, seed: 4 });
      B.stroke(w, [[T.x + 6, 580, 26], [T.x + 110, 480, 16], [T.x + 210 + sway(3), 400, 5]], { color: rgba([120, 92, 70]), wob: 1.5, seed: 5 });
      B.stroke(w, [[T.x + 2, 520, 18], [T.x + 40, 420, 10], [T.x + 30 + sway(4), 330, 4]], { color: rgba([120, 92, 70]), wob: 1.5, seed: 6 });
      w.restore();
      inkLine(ink, trunk.map(([x, y, ww]) => [x - ww / 2 + 4, y, 4]), 3, 0.7 * pa, 81, { dry: 0.5 });
      inkLine(ink, trunk.map(([x, y, ww]) => [x + ww / 2 - 4, y, 2.6]), 2, 0.55 * pa, 82, { dry: 0.5 });
      inkLine(ink, [[T.x - 10, 610, 2.2], [T.x - 90, 505, 1.4], [T.x - 186, 404, 0.4]], 2, 0.38 * pa, 85, { dry: 0.4 });
      inkLine(ink, [[T.x + 14, 590, 2.2], [T.x + 112, 488, 1.4], [T.x + 206, 404, 0.4]], 2, 0.38 * pa, 86, { dry: 0.4 });
      // roots
      inkLine(ink, [[T.x - 10, 870, 3], [T.x - 50, 892, 2], [T.x - 90, 896, 0.5]], 2, 0.6 * pa, 83);
      inkLine(ink, [[T.x + 20, 872, 3], [T.x + 60, 890, 2], [T.x + 104, 894, 0.5]], 2, 0.6 * pa, 84);
      // crown: clusters of leaves, wet into wet
      const R = rng(55);
      const greens = [[92, 150, 82], [124, 172, 92], [64, 124, 76], [160, 192, 102], [76, 136, 96]];
      for (let i = 0; i < 46; i++) {
        const a = R() * TAU, d = Math.sqrt(R());
        const cx = T.x + Math.cos(a) * d * 320 + sway(i * 0.3) * 1.5, cy = 392 + Math.sin(a) * d * 200 - (1 - d) * 30;
        const r = R.range(50, 104);
        B.blob(w, cx, cy, r * 1.15, r * 0.9, rgba(greens[i % 5]), 0.5 * pa, 600 + i, { layers: 2, irr: 0.32 });
      }
      // leaf strokes in ink
      for (let i = 0; i < 70; i++) {
        const a = R() * TAU, d = Math.sqrt(R()) * 0.95;
        const cx = T.x + Math.cos(a) * d * 290 + sway(i * 0.3) * 1.5, cy = 380 + Math.sin(a) * d * 190;
        const ang = R.range(-0.8, 0.8) - Math.PI / 2;
        inkLine(ink, [[cx, cy, 3.5], [cx + Math.cos(ang) * 10, cy + Math.sin(ang) * 10, 0.3]], 2, 0.3 * pa, 700 + i);
      }
      // dappled light
      const l = L.light.ctx;
      l.save(); l.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 18; i++) {
        const x = T.x + 60 + R.range(-150, 260), y = 300 + R.range(-120, 120);
        const fl = 0.5 + 0.5 * Math.sin(t * 2.1 + i * 1.7);
        l.fillStyle = `rgba(255,240,190,${0.18 * fl * pa})`;
        l.beginPath(); l.arc(x, y, R.range(6, 16), 0, TAU); l.fill();
      }
      l.restore();
    }
    GL.draw(L.ink.ctx, 'tree', T.x, T.y, T.s, k.treeM, { seed: 5, alpha: k.glyphA, sx: 1.25, sy: 1.0 });
  }

  // a swallow in ink: two curved wings and a forked tail
  function swallow(ctx, x, y, s, flap, dir, a) {
    const f = Math.sin(flap);
    const wy = -f * 16 * s;
    const pts = (sgn) => [[x, y, 4 * s], [x - dir * 8 * s, y + wy * 0.5 - sgn * 4 * s, 4.5 * s], [x - dir * 26 * s, y + wy + sgn * 6 * s, 1.2 * s]];
    B.stroke(ctx, [[x + dir * 8 * s, y - 1 * s, 2 * s], [x, y, 6 * s], [x - dir * 14 * s, y + 2 * s, 3 * s], [x - dir * 26 * s, y + 6 * s, 0.4]], { color: INK, alpha: a });
    B.stroke(ctx, [[x + dir * 2 * s, y - 2 * s, 4 * s], [x - dir * 4 * s, y - 12 * s - wy * 0.3, 3.5 * s], [x - dir * 18 * s, y - 20 * s - wy, 0.6]], { color: INK, alpha: a });
    B.stroke(ctx, [[x + dir * 2 * s, y + 1 * s, 4 * s], [x + dir * 8 * s, y - 10 * s - wy * 0.4, 3.5 * s], [x + dir * 10 * s, y - 22 * s - wy * 0.9, 0.6]], { color: INK, alpha: a * 0.85 });
    B.stroke(ctx, [[x - dir * 22 * s, y + 5 * s, 1.5 * s], [x - dir * 34 * s, y + 2 * s, 0.3]], { color: INK, alpha: a });
    B.stroke(ctx, [[x - dir * 22 * s, y + 5 * s, 1.5 * s], [x - dir * 34 * s, y + 10 * s, 0.3]], { color: INK, alpha: a });
  }
  function birds(L, t, k) {
    const ink = L.ink.ctx;
    for (let i = 0; i < 6; i++) {
      const t0 = 12.8 + i * 0.35 + hash(i) * 0.4;
      const u = (t - t0) / 6.5;
      if (u < 0 || u > 1) continue;
      const x = lerp(2040, -140, u) + i * 40, y = 300 + i * 26 - Math.sin(u * Math.PI) * 120 + noise1(t + i) * 12;
      swallow(ink, x, y, 0.85 + hash(i + 3) * 0.3, t * 13 + i * 2, -1, 0.85 * k.paint);
    }
  }
  function seeds(L, t, k) {
    const l = L.light.ctx, ink = L.ink.ctx;
    for (let i = 0; i < 22; i++) {
      const life = 9, ph = ((t - 12) / life + hash(i * 3.7)) % 1;
      const x = lerp(-40, 2000, ph) + noise1(t * 0.3 + i) * 80 + hash(i) * 600 - 300, y = 900 - ph * 600 + Math.sin(t * 0.8 + i) * 30 + hash(i * 2) * 200;
      const a = Math.sin(ph * Math.PI) * k.paint * (1 - k.rain);
      if (a <= 0.01) continue;
      l.save(); l.globalCompositeOperation = 'lighter'; l.fillStyle = `rgba(255,252,240,${0.5 * a})`;
      l.beginPath(); l.arc(x, y, 4, 0, TAU); l.fill(); l.restore();
      ink.save(); ink.globalAlpha = 0.35 * a; ink.strokeStyle = INK; ink.lineWidth = 0.8;
      ink.beginPath(); ink.moveTo(x, y + 3); ink.lineTo(x + 1, y + 11); ink.stroke(); ink.restore();
    }
  }
  // two cabbage whites and a swallowtail, never quite landing
  function butterflies(L, t, k) {
    const a0 = k.paint * (1 - k.rain * 0.8);
    if (a0 <= 0.01) return;
    const cols = [[250, 248, 236], [248, 214, 90], [250, 246, 232]];
    for (let i = 0; i < 3; i++) {
      const x = 1000 + i * 210 + noise1(t * 0.45 + i * 7) * 220 + Math.sin(t * 0.7 + i) * 60;
      const y = 860 - i * 30 + noise1(t * 0.6 + i * 3 + 20) * 70 - Math.abs(Math.sin(t * 2.2 + i)) * 18;
      const flap = Math.abs(Math.sin(t * 15 + i * 2));
      const w = L.wash.ctx, ink = L.ink.ctx;
      const s = 1.1;
      w.save(); w.translate(x, y); w.globalAlpha = a0;
      for (const sd of [-1, 1]) {
        w.save(); w.scale(sd * (0.25 + 0.75 * flap), 1);
        w.fillStyle = rgba(cols[i]);
        w.beginPath(); w.ellipse(7 * s, -5 * s, 8 * s, 6 * s, -0.5, 0, TAU); w.fill();
        w.beginPath(); w.ellipse(6 * s, 4 * s, 5.5 * s, 4.5 * s, 0.5, 0, TAU); w.fill();
        w.restore();
      }
      w.restore();
      ink.save(); ink.translate(x, y); ink.globalAlpha = 0.75 * a0; ink.strokeStyle = INK; ink.lineWidth = 1.6;
      ink.beginPath(); ink.moveTo(0, -6 * s); ink.lineTo(0, 7 * s); ink.stroke();
      for (const sd of [-1, 1]) { ink.beginPath(); ink.ellipse(sd * 7 * s * (0.25 + 0.75 * flap), -5 * s, 8 * s * (0.25 + 0.75 * flap), 6 * s, -0.5 * sd, 0, TAU); ink.lineWidth = 0.8; ink.globalAlpha = 0.35 * a0; ink.stroke(); }
      ink.restore();
    }
  }
  function rainbow(L, t, k) {
    const a = k.rainbow * k.paint;
    if (a <= 0.003) return;
    const w = L.wash.ctx;
    const cols = [[226, 92, 84], [240, 160, 80], [244, 214, 92], [120, 186, 110], [90, 150, 210], [130, 110, 190]];
    w.save();
    w.beginPath(); w.rect(-500, -500, 3000, 1120); w.clip();
    w.globalCompositeOperation = 'multiply';
    cols.forEach((c, i) => {
      w.strokeStyle = rgba(c, 0.26 * a);
      w.lineWidth = 15;
      w.beginPath(); w.arc(760, 1060, 760 - i * 13, Math.PI * 1.08, Math.PI * 1.62); w.stroke();
    });
    w.restore();
  }
  // the sunshower: streaks that catch the light
  function rain(L, t, k, area) {
    const a = k.rain;
    if (a <= 0.003) return;
    const w = L.wash.ctx, l = L.light.ctx;
    const n = Math.round(220 * a);
    w.save(); l.save();
    l.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const sp = 1500 + hash(i * 3.3) * 500;
      const x0 = hash(i * 1.7) * (area.x1 - area.x0 + 400) + area.x0 - 200;
      const y = ((t * sp + hash(i * 9.1) * 2000) % (area.y1 - area.y0 + 300)) + area.y0 - 150;
      const x = x0 + (y - area.y0) * 0.12;
      const len = 26 + hash(i) * 30;
      w.strokeStyle = `rgba(120,140,170,${0.35 * a})`;
      w.lineWidth = 1.4;
      w.beginPath(); w.moveTo(x, y); w.lineTo(x + len * 0.12, y + len); w.stroke();
      if (i % 3 === 0) {
        l.strokeStyle = `rgba(255,246,220,${0.35 * a})`;
        l.lineWidth = 1.2;
        l.beginPath(); l.moveTo(x, y); l.lineTo(x + len * 0.12, y + len); l.stroke();
      }
    }
    w.restore(); l.restore();
    GL.draw(L.ink.ctx, 'rain', V.rain.x, V.rain.y, V.rain.s, k.rainM, { seed: 6, alpha: k.glyphA });
  }

  // the red oil-paper umbrella, held at (hx, hy); it opens like a flower
  function umbrella(L, hx, hy, r, open, tilt, a) {
    const w = L.wash.ctx, ink = L.ink.ctx;
    const o = easeOut(clamp(open), 2.4);
    const half = lerp(0.1, 1, o) * r;          // half width of the canopy
    const hgt = lerp(1.05, 0.42, o) * r;        // apex above the rim
    const shaft = 0.82 * r;
    const c = Math.cos(tilt), sn = Math.sin(tilt);
    // local frame: rim centre at (0,0), apex (0,-hgt), hand (0, shaft - hgt*0.0)
    const X = (x, y) => [hx + (x * c - (y - shaft) * sn), hy + (x * sn + (y - shaft) * c)];
    const N = 10;
    const rim = [], arcTop = [];
    for (let i = 0; i <= 24; i++) {
      const th = -Math.PI / 2 + (i / 24) * Math.PI;
      arcTop.push(X(Math.sin(th) * half, -Math.cos(th) * hgt + hgt * 0.06 * (1 - Math.cos(th))));
    }
    const ribX = (i) => -half + (2 * half * i) / N;
    for (let i = 0; i <= N; i++) {
      const x = ribX(i);
      rim.push(X(x, 0.12 * hgt * (1 - (x / half) ** 2)));
    }
    // canopy: the dome, its rim scalloped between the ribs
    w.save(); w.globalCompositeOperation = 'multiply'; w.globalAlpha = a;
    w.fillStyle = 'rgb(206,62,46)';
    w.beginPath();
    w.moveTo(arcTop[0][0], arcTop[0][1]);
    for (const p of arcTop) w.lineTo(p[0], p[1]);
    for (let i = N; i > 0; i--) {
      const p = rim[i], q = rim[i - 1];
      const m = X((ribX(i) + ribX(i - 1)) / 2, -0.05 * hgt);
      w.quadraticCurveTo(m[0], m[1], q[0], q[1]);
    }
    w.closePath(); w.fill();
    // light panels
    w.globalAlpha = a * 0.3; w.fillStyle = 'rgb(246,170,120)';
    for (let i = 1; i < N; i += 2) {
      const apex = X(0, -hgt);
      w.beginPath(); w.moveTo(apex[0], apex[1]); w.lineTo(rim[i][0], rim[i][1]); w.lineTo(rim[i + 1][0], rim[i + 1][1]); w.closePath(); w.fill();
    }
    w.restore();
    const apex = X(0, -hgt);
    for (let i = 1; i < N; i++) {
      const mid = X(ribX(i) * 0.62, -hgt * 0.62);
      inkLine(ink, [[apex[0], apex[1], 1.2], [mid[0], mid[1], 1.0], [rim[i][0], rim[i][1], 0.7]], 1, 0.35 * a, 900 + i);
    }
    inkLine(ink, arcTop.map((p) => [p[0], p[1], 1.8]), 1.8, 0.75 * a, 920, { dry: 0.2 });
    inkLine(ink, rim.map((p) => [p[0], p[1], 1.1]), 1.1, 0.5 * a, 923);
    const top = X(0, -hgt - r * 0.08), hand = X(0, shaft);
    inkLine(ink, [[top[0], top[1], 2.6], [hand[0], hand[1], 2.6]], 2.6, 0.85 * a, 921);
    // tiny tip
    inkLine(ink, [[top[0], top[1], 3], [X(0, -hgt - r * 0.14)[0], X(0, -hgt - r * 0.14)[1], 1]], 2, 0.85 * a, 922);
  }

  // mother and child, seen from behind, looking at the world
  const KID = { skin: [246, 214, 190], hair: [36, 30, 28], top: [244, 192, 60], bottom: [74, 112, 168], shoes: [196, 70, 56] };
  const MOM = { skin: [244, 212, 190], hair: [40, 32, 30], top: [240, 238, 230], sleeve: [240, 238, 230], bottom: [82, 130, 150], skirt: [96, 146, 160] };
  function people(L, t, k) {
    const mx = 742, my = 904;
    const go = easeInOut(clamp((t - 13.8) / 2.0));
    const cx = lerp(868, 912, go), cy = lerp(908, 884, go);
    const kidWalk = t > 13.8 && t < 15.8 ? (t - 13.8) * 7.5 : undefined;
    // poses: pointing at each thing as it gets its name
    const momPoint = win(23.4, 24.2, 25.6, 26.6, t);
    const umb = clamp((t - 18.9) / 0.9);
    const momArmR = momPoint > 0 ? [lerp(0.15, 2.35, momPoint), lerp(-0.1, 0.05, momPoint)] : undefined;
    const holdUmb = umb > 0;
    const armL = holdUmb ? [lerp(-0.12, 2.82, easeOut(umb)), lerp(0.1, 0.05, easeOut(umb))] : undefined;
    // the child turns from thing to thing
    const targets = [[25.4, 26.9, V.mountain.x, V.mountain.y - 60], [26.6, 28.0, V.tree.x, V.tree.y - 140], [27.7, 29.0, V.water.x, V.water.y], [28.6, 30.0, V.rain.x, V.rain.y]];
    let kidArm, kidHead = -0.5 + 0.5 * win(13.0, 14.0, 16.5, 17.5, t);
    let best = 0;
    for (const [a0, a1, tx, ty] of targets) {
      const w2 = win(a0, a0 + 0.35, a1 - 0.3, a1, t);
      if (w2 > best) {
        best = w2;
        const ang = Math.atan2(tx - cx, -(ty - (cy - 140)));
        const target = Math.PI - Math.abs(ang);
        kidArm = [Math.sign(ang) * lerp(0.15, target, w2), 0];
      }
    }
    // in the sunshower the child holds out a hand to catch the rain
    const catchR = win(19.8, 20.4, 22.6, 23.3, t);
    if (!kidArm && catchR > 0) kidArm = [lerp(0.15, 1.25, catchR), lerp(0, -0.4, catchR)];
    const fade = k.figA;
    const momF = { x: mx, y: my, h: 336, plan: 'woman', view: 'back', col: MOM, hair: 'bun', skirt: true, alpha: fade,
      pose: { armR: momArmR, armL, head: -0.4 } };
    const kidF = { x: cx, y: cy, h: lerp(186, 178, go), plan: 'child', view: 'back', col: KID, alpha: fade, walk: kidWalk, amp: 0.8, pose: { armR: kidArm && kidArm[0] > 0 ? kidArm : undefined, armL: kidArm && kidArm[0] < 0 ? kidArm : undefined, head: kidHead } };
    FIG.draw(L, kidF);
    FIG.draw(L, momF);
    if (holdUmb) {
      // her left hand holds the umbrella over the child
      const P = FIG.PLAN.woman;
      const shx = mx - P.shw * 336 * 0.92, shy = my - P.sh * 336 + 336 * 0.02;
      const bones = FIG.bone(shx, shy, armL[0], P.ua * 336, armL[1], P.fa * 336, 1);
      const hand = bones[2];
      umbrella(L, hand[0], hand[1], 156, umb, 0.3 + 0.04 * Math.sin(t * 0.9), fade);
    }
  }

  // ------------------------------------------------------------------ the valley, all of it
  // k: { paint (overall), sunM, mtnM, treeM, waterM, rainM, rain, rainbow, figA, glyphA }
  function valley(L, t, k) {
    sky(L, t, k);
    sun(L, t, k);
    rainbow(L, t, k);
    mountains(L, t, k);
    meadow(L, t, k);
    pond(L, t, k);
    grass(L, t, k, false);
    birds(L, t, k);
    tree(L, t, k);
    butterflies(L, t, k);
    if (k.figA > 0.003) people(L, t, k);
    rain(L, t, k, { x0: -100, x1: 2020, y0: -100, y1: 1080 });
    grass(L, t, k, true);
    seeds(L, t, k);
  }

  FS.world = { setCam, IDENT, each, zoomCam, vgrad, radial, ridgePath, poly, washPoly, inkLine, brushText, subtitle,
    title, eye, EYE, lids, iris, valley, V, swallow, umbrella, cloud, T_HIT, INK };
})(typeof window !== 'undefined' ? window : globalThis);
