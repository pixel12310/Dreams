/*
 * 初见 · FIRST SIGHT — the brush.
 *
 * A stroke is a list of points [x, y, w, corner?] (w = full width). The spine is a
 * Catmull-Rom spline (broken at corners), offset by ±w/2 into a polygon, with round
 * caps. Strokes can be partially drawn (write-on), wobble like a hand, and run dry
 * (飞白) toward their tails. Washes are noisy polygons layered for soft edges; the
 * compositor does the rest of the watercolour.
 */
(function (G) {
  'use strict';
  const FS = G.FS;
  const { clamp, lerp, rng, noise1, noise2, TAU } = FS;

  // ---------------------------------------------------------------- spline
  function crSegment(p0, p1, p2, p3, n, out) {
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      const a = -0.5 * t3 + t2 - 0.5 * t, b = 1.5 * t3 - 2.5 * t2 + 1, c = -1.5 * t3 + 2 * t2 + 0.5 * t, d = 0.5 * t3 - 0.5 * t2;
      out.push([
        a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
        a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
        Math.max(0, a * p0[2] + b * p1[2] + c * p2[2] + d * p3[2]),
      ]);
    }
  }
  function splinePiece(pts, step, out) {
    const n = pts.length;
    if (n === 1) { out.push([pts[0][0], pts[0][1], pts[0][2]]); return; }
    for (let i = 0; i < n - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : [2 * pts[0][0] - pts[1][0], 2 * pts[0][1] - pts[1][1], pts[0][2]];
      const p1 = pts[i], p2 = pts[i + 1];
      const p3 = i + 2 < n ? pts[i + 2] : [2 * p2[0] - p1[0], 2 * p2[1] - p1[1], p2[2]];
      const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      crSegment(p0, p1, p2, p3, Math.max(2, Math.ceil(len / step)), out);
    }
  }
  // dense samples [x,y,w] along the stroke; corners split the spline
  function sample(pts, step = 3) {
    const out = [];
    let piece = [pts[0]];
    const corners = [];
    for (let i = 1; i < pts.length; i++) {
      piece.push(pts[i]);
      if (pts[i][3] && i < pts.length - 1) {
        splinePiece(piece, step, out);
        corners.push(out.length);
        piece = [pts[i]];
      }
    }
    splinePiece(piece, step, out);
    const last = pts[pts.length - 1];
    out.push([last[0], last[1], last[2]]);
    out.corners = corners;
    return out;
  }
  function arcLengths(s) {
    const L = new Float32Array(s.length);
    for (let i = 1; i < s.length; i++) L[i] = L[i - 1] + Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
    return L;
  }
  // cut the sampled stroke at fraction u of its length
  function truncate(s, L, u) {
    if (u >= 1) return s;
    const target = L[L.length - 1] * Math.max(0, u);
    const out = [];
    for (let i = 0; i < s.length; i++) {
      if (L[i] <= target) out.push(s[i]);
      else {
        const k = (target - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
        const a = s[i - 1], b = s[i];
        out.push([lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]);
        break;
      }
    }
    out.corners = (s.corners || []).filter((c) => c < out.length);
    return out;
  }

  // ---------------------------------------------------------------- stroke polygon
  function outline(ctx, s, wob, seed) {
    const n = s.length;
    if (n < 2) {
      const p = s[0];
      ctx.moveTo(p[0] + p[2] / 2, p[1]);
      ctx.arc(p[0], p[1], p[2] / 2, 0, TAU);
      return;
    }
    const left = [], right = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const a = s[Math.max(0, i - 1)], b = s[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const l = Math.hypot(tx, ty) || 1;
      tx /= l; ty /= l;
      const nx = -ty, ny = tx;
      if (i > 0) acc += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
      const w = s[i][2] / 2;
      // hand wobble: the two edges breathe independently, the spine drifts
      const d = wob ? noise1(acc * 0.035 + seed) * wob : 0;
      const el = wob ? 1 + noise1(acc * 0.11 + seed * 3.1) * 0.09 : 1;
      const er = wob ? 1 + noise1(acc * 0.11 + seed * 5.7 + 9) * 0.09 : 1;
      left.push([s[i][0] + nx * (w * el + d), s[i][1] + ny * (w * el + d)]);
      right.push([s[i][0] - nx * (w * er - d), s[i][1] - ny * (w * er - d)]);
    }
    // winding of the outline, so the corner joints can be wound the same way
    let area = 0;
    for (let i = 0; i < n - 1; i++) area += left[i][0] * left[i + 1][1] - left[i + 1][0] * left[i][1];
    area += left[n - 1][0] * right[n - 1][1] - right[n - 1][0] * left[n - 1][1];
    for (let i = n - 1; i > 0; i--) area += right[i][0] * right[i - 1][1] - right[i - 1][0] * right[i][1];
    area += right[0][0] * left[0][1] - left[0][0] * right[0][1];
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]);
    // end cap
    const e = s[n - 1], ew = e[2] / 2;
    if (ew > 0.4) {
      const ang = Math.atan2(left[n - 1][1] - e[1], left[n - 1][0] - e[0]);
      ctx.arc(e[0], e[1], ew, ang, ang - Math.PI, true);
    }
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    const b0 = s[0], bw = b0[2] / 2;
    if (bw > 0.4) {
      const ang = Math.atan2(right[0][1] - b0[1], right[0][0] - b0[0]);
      ctx.arc(b0[0], b0[1], bw, ang, ang - Math.PI, true);
    }
    ctx.closePath();
    // the brush lands at an angle: a slanted press at the head of the stroke
    if (bw > 1.2 && n > 3) {
      const ccw0 = area < 0;
      ctx.moveTo(b0[0] + Math.cos(0.75) * bw * 1.12, b0[1] + Math.sin(0.75) * bw * 1.12);
      ctx.ellipse(b0[0] - bw * 0.06, b0[1] - bw * 0.06, bw * 1.12, bw * 0.86, 0.75, 0, ccw0 ? -TAU : TAU, ccw0);
    }
    // corners get a round joint so the outer side never gaps; wound like the
    // outline so the nonzero rule unions them instead of punching holes
    const ccw = area < 0;
    for (const c of s.corners || []) {
      const p = s[Math.min(c, n - 1)];
      ctx.moveTo(p[0] + p[2] / 2, p[1]);
      ctx.arc(p[0], p[1], p[2] / 2, 0, ccw ? -TAU : TAU, ccw);
    }
  }

  // scratch canvas for dry-brush strokes
  let scratch = null;
  function getScratch(w, h) {
    if (!scratch) { scratch = document.createElement('canvas'); scratch.width = 64; scratch.height = 64; }
    if (scratch.width < w || scratch.height < h) {
      scratch.width = Math.max(scratch.width, Math.ceil(w));
      scratch.height = Math.max(scratch.height, Math.ceil(h));
    }
    return scratch;
  }

  /*
   * stroke(ctx, pts, o)
   *   o.u      0..1 portion drawn (write-on)
   *   o.color  CSS colour          o.alpha
   *   o.wob    wobble in px        o.seed
   *   o.dry    0..1 飞白 toward the tail (needs a scratch pass)
   *   o.step   sample spacing
   */
  function stroke(ctx, pts, o = {}) {
    if (!pts || pts.length === 0) return;
    const u = o.u ?? 1;
    if (u <= 0) return;
    let s = sample(pts, o.step || 2.5);
    if (u < 1) s = truncate(s, arcLengths(s), u);
    if (s.length === 0) return;
    const color = o.color || 'rgb(24,21,19)';
    const alpha = o.alpha ?? 1;
    const seed = o.seed ?? 0;
    const dry = o.dry || 0;
    if (dry <= 0.01) {
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      outline(ctx, s, o.wob ?? 0, seed);
      ctx.fill('nonzero');
      ctx.restore();
      return;
    }
    // dry brush: draw into a scratch canvas in device pixels, scratch out bristle gaps
    const m = ctx.getTransform();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of s) {
      const X = m.a * p[0] + m.c * p[1] + m.e, Y = m.b * p[0] + m.d * p[1] + m.f;
      const r = p[2] * Math.hypot(m.a, m.b);
      x0 = Math.min(x0, X - r); y0 = Math.min(y0, Y - r); x1 = Math.max(x1, X + r); y1 = Math.max(y1, Y + r);
    }
    x0 = Math.floor(x0 - 4); y0 = Math.floor(y0 - 4);
    const w = Math.ceil(x1 - x0 + 8), h = Math.ceil(y1 - y0 + 8);
    if (w <= 0 || h <= 0 || w > 6000 || h > 6000) return;
    const sc = getScratch(w, h);
    const c = sc.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, w + 2, h + 2);
    c.setTransform(m.a, m.b, m.c, m.d, m.e - x0, m.f - y0);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = color;
    c.beginPath();
    outline(c, s, o.wob ?? 0, seed);
    c.fill('nonzero');
    // bristles run out of ink
    c.globalCompositeOperation = 'destination-out';
    c.lineCap = 'round';
    const L = arcLengths(s), total = L[L.length - 1];
    const R = rng(seed * 7 + 3);
    const nb = 8;
    for (let k = 0; k < nb; k++) {
      const off = (k + 0.5) / nb - 0.5 + (R() - 0.5) * 0.1;
      if (R() > 0.2 + dry * 0.5) continue;
      const startU = lerp(1.0, 0.42, dry) * lerp(0.82, 1.08, R());
      const endU = Math.min(1.05, startU + lerp(0.1, 0.5, R()));
      if (startU >= 1) continue;
      c.beginPath();
      let first = true, cnt = 0;
      for (let i = 0; i < s.length; i++) {
        const uu = L[i] / total;
        if (uu < startU || uu > endU) continue;
        const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)];
        let tx = b[0] - a[0], ty = b[1] - a[1];
        const l = Math.hypot(tx, ty) || 1;
        const px = s[i][0] - (ty / l) * off * s[i][2], py = s[i][1] + (tx / l) * off * s[i][2];
        if (first) { c.moveTo(px, py); first = false; } else c.lineTo(px, py);
        cnt++;
      }
      if (cnt < 2) continue;
      c.lineWidth = Math.max(0.5, (s[Math.floor(s.length * 0.8)][2] / nb) * lerp(0.3, 0.95, R()));
      c.stroke();
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha *= alpha;
    ctx.drawImage(sc, 0, 0, w, h, x0, y0, w, h);
    ctx.restore();
  }

  // transform stroke points: [x,y,w] in a unit box → world
  function place(strokes, x, y, size, rot = 0) {
    const cs = Math.cos(rot), sn = Math.sin(rot);
    return strokes.map((st) => st.map((p) => {
      const px = p[0] * size, py = p[1] * size;
      return [x + px * cs - py * sn, y + px * sn + py * cs, p[2] * size, p[3]];
    }));
  }

  // ---------------------------------------------------------------- washes
  // a closed noisy blob as a polygon (array of [x,y]); deterministic per seed
  const blobCache = new Map();
  function blobPoly(rx, ry, seed, irr = 0.18, n = 48, freq = 2.2) {
    const key = `${rx.toFixed(1)}|${ry.toFixed(1)}|${seed}|${irr}|${n}|${freq}`;
    let p = blobCache.get(key);
    if (p) return p;
    p = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const r = 1 + irr * (noise2(Math.cos(a) * freq + seed * 3.7, Math.sin(a) * freq + seed * 1.3) + 0.35 * noise2(Math.cos(a) * freq * 3 + seed, Math.sin(a) * freq * 3 - seed));
      p.push([Math.cos(a) * rx * r, Math.sin(a) * ry * r]);
    }
    if (blobCache.size > 4000) blobCache.clear();
    blobCache.set(key, p);
    return p;
  }
  function polyPath(ctx, poly, x = 0, y = 0, s = 1) {
    ctx.moveTo(x + poly[0][0] * s, y + poly[0][1] * s);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(x + poly[i][0] * s, y + poly[i][1] * s);
    ctx.closePath();
  }
  // soft-edged wash: a few jittered copies of the same noisy blob
  function blob(ctx, x, y, rx, ry, color, alpha, seed, o = {}) {
    const layers = o.layers || 3;
    ctx.save();
    ctx.fillStyle = color;
    for (let k = 0; k < layers; k++) {
      const p = blobPoly(rx * (1 - k * 0.06), ry * (1 - k * 0.06), seed + k * 17, o.irr ?? 0.18, o.n || 40, o.freq || 2.2);
      ctx.globalAlpha = alpha / layers * (k === 0 ? 1.4 : 1);
      ctx.beginPath();
      polyPath(ctx, p, x + (k ? (noise1(seed + k) * rx * 0.05) : 0), y + (k ? noise1(seed - k) * ry * 0.05 : 0));
      ctx.fill();
    }
    ctx.restore();
  }

  // deform a polygon by recursive midpoint displacement (Hobbs-style watercolour edge)
  function deform(poly, depth, amt, R) {
    let p = poly;
    for (let d = 0; d < depth; d++) {
      const q = [];
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        q.push(a);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const g = R.gauss() * amt * len * 0.5;
        const nx = -(b[1] - a[1]) / (len || 1), ny = (b[0] - a[0]) / (len || 1);
        q.push([(a[0] + b[0]) / 2 + nx * g, (a[1] + b[1]) / 2 + ny * g]);
      }
      p = q;
    }
    return p;
  }

  FS.brush = { sample, arcLengths, truncate, stroke, place, blobPoly, polyPath, blob, deform };
})(typeof window !== 'undefined' ? window : globalThis);
