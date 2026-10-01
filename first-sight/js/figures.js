/*
 * 初见 · FIRST SIGHT — people.
 *
 * Picture-book figures: a fine ink contour over a watercolour fill that sits a
 * little off the line, the way a hand-coloured print does. One rig drives every
 * person in the film — the child, the mother, the young man who becomes the
 * father, his daughter, the crowd — in side, front or back view.
 *
 * Coordinates: feet at (x, y), y down, height h. Angles for limbs are measured
 * from straight down, positive toward where the figure faces (side view) or
 * toward screen-right (front/back view).
 */
(function (G) {
  'use strict';
  const FS = G.FS;
  const { clamp, lerp, TAU, noise1, rgba, mixc } = FS;

  const INK = [30, 27, 26];

  // body plans (fractions of height)
  const PLAN = {
    adult: { headY: 0.92, hrx: 0.064, hry: 0.074, neck: 0.855, sh: 0.815, shw: 0.115, waist: 0.58, ww: 0.08, hip: 0.5, hw: 0.088, th: 0.245, sn: 0.235, ua: 0.17, fa: 0.15, limb: 0.044, leg: 0.054 },
    woman: { headY: 0.928, hrx: 0.058, hry: 0.068, neck: 0.858, sh: 0.82, shw: 0.1, waist: 0.6, ww: 0.068, hip: 0.5, hw: 0.092, th: 0.245, sn: 0.235, ua: 0.165, fa: 0.145, limb: 0.04, leg: 0.048 },
    child: { headY: 0.885, hrx: 0.1, hry: 0.112, neck: 0.775, sh: 0.745, shw: 0.115, waist: 0.56, ww: 0.1, hip: 0.46, hw: 0.1, th: 0.215, sn: 0.21, ua: 0.15, fa: 0.13, limb: 0.06, leg: 0.07 },
  };

  // polygon around a polyline with widths [[x,y,w],...], with round ends
  function limbPoly(pts) {
    const n = pts.length, L = [], R = [];
    const tang = (i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; return Math.atan2(b[1] - a[1], b[0] - a[0]); };
    for (let i = 0; i < n; i++) {
      const t = tang(i), w = pts[i][2] / 2;
      L.push([pts[i][0] - Math.sin(t) * w, pts[i][1] + Math.cos(t) * w]);
      R.push([pts[i][0] + Math.sin(t) * w, pts[i][1] - Math.cos(t) * w]);
    }
    const out = [...L];
    const e = pts[n - 1], te = tang(n - 1);
    for (let k = 1; k < 6; k++) { const a = te + Math.PI / 2 - (k / 6) * Math.PI; out.push([e[0] + Math.cos(a) * e[2] / 2, e[1] + Math.sin(a) * e[2] / 2]); }
    for (let i = n - 1; i >= 0; i--) out.push(R[i]);
    const s0 = pts[0], ts = tang(0);
    for (let k = 1; k < 6; k++) { const a = ts - Math.PI / 2 - (k / 6) * Math.PI; out.push([s0[0] + Math.cos(a) * s0[2] / 2, s0[1] + Math.sin(a) * s0[2] / 2]); }
    return out;
  }
  // a closed shape through a few control points, smoothed (Chaikin)
  function smoothPoly(pts, iter = 2) {
    let p = pts;
    for (let k = 0; k < iter; k++) {
      const q = [];
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      p = q;
    }
    return p;
  }
  function ellPoly(cx, cy, rx, ry, n = 22, rot = 0) {
    const out = [];
    const c = Math.cos(rot), s = Math.sin(rot);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      out.push([cx + x * c - y * s, cy + x * s + y * c]);
    }
    return out;
  }
  function path(ctx, poly, dx = 0, dy = 0) {
    ctx.moveTo(poly[0][0] + dx, poly[0][1] + dy);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0] + dx, poly[i][1] + dy);
    ctx.closePath();
  }
  // Each figure is painted into two private canvases first, so its parts occlude
  // one another (a front arm hides the body's contour behind it, sleeves don't
  // double up where they overlap the shirt); the whole figure is then glazed onto
  // the page as a single transparent wash.
  const tmp = {};
  function scratch(name, w, h) {
    let c = tmp[name];
    if (!c) { c = tmp[name] = document.createElement('canvas'); c.width = 16; c.height = 16; }
    if (c.width < w || c.height < h) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, h); }
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w + 4, h + 4);
    return { cv: c, ctx };
  }
  function beginFigure(L, f) {
    const M = L.ink.ctx.getTransform();
    const sc = Math.hypot(M.a, M.b);
    const r = f.h * 1.25 * sc;
    const cx = M.a * f.x + M.c * (f.y - f.h * 0.5) + M.e, cy = M.b * f.x + M.d * (f.y - f.h * 0.5) + M.f;
    const W = L.ink.cv.width, H = L.ink.cv.height;
    const x0 = Math.max(0, Math.floor(cx - r)), y0 = Math.max(0, Math.floor(cy - r));
    const x1 = Math.min(W, Math.ceil(cx + r)), y1 = Math.min(H, Math.ceil(cy + r));
    if (x1 <= x0 || y1 <= y0) return null;
    const w = x1 - x0, h = y1 - y0;
    const tw = scratch('w', w, h), ti = scratch('i', w, h);
    for (const t of [tw, ti]) t.ctx.setTransform(M.a, M.b, M.c, M.d, M.e - x0, M.f - y0);
    return { wash: tw, ink: ti, mask: L.mask, light: L.light, crayon: L.crayon, top: L.top, x0, y0, w, h, L };
  }
  function endFigure(T, f) {
    const a = f.alpha ?? 1;
    const L = T.L;
    const w = L.wash.ctx;
    w.save(); w.setTransform(1, 0, 0, 1, 0, 0);
    // a figure stands in front of things: its paint covers what is behind it
    w.globalCompositeOperation = f.glaze ? 'multiply' : 'source-over';
    w.globalAlpha = a * (f.paint ?? 1) * (f.fill ?? (f.glaze ? 0.9 : 0.96));
    w.drawImage(T.wash.cv, 0, 0, T.w, T.h, T.x0, T.y0, T.w, T.h);
    w.restore();
    const c = L.ink.ctx;
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    // and hides the lines behind it
    c.globalCompositeOperation = 'destination-out';
    c.globalAlpha = a * 0.95;
    c.drawImage(T.wash.cv, 0, 0, T.w, T.h, T.x0, T.y0, T.w, T.h);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = a * (f.ink ?? 0.62);
    c.drawImage(T.ink.cv, 0, 0, T.w, T.h, T.x0, T.y0, T.w, T.h);
    c.restore();
  }
  // a shape: watercolour fill a touch off-register, then a fine ink contour
  function part(L, f, poly, col, o = {}) {
    const k = f.h / 300;
    const w = L.wash.ctx;
    w.save();
    w.globalAlpha = o.fill ?? 1;
    w.fillStyle = rgba(col);
    w.beginPath();
    path(w, poly, (f.reg ?? 1.6) * k, (f.reg ?? 1.6) * 0.6 * k);
    w.fill();
    w.restore();
    if (f.mask) {
      const m = L.mask.ctx;
      m.save(); m.fillStyle = '#fff'; m.globalAlpha = f.mask * (f.alpha ?? 1); m.beginPath(); path(m, poly, 0, 0); m.fill();
      m.lineWidth = 6; m.strokeStyle = '#fff'; m.stroke(); m.restore();
    }
    const c = L.ink.ctx;
    c.save();
    c.globalCompositeOperation = 'destination-out';
    c.beginPath(); path(c, poly); c.fill();
    c.globalCompositeOperation = 'source-over';
    const ia = o.ink ?? 1;
    if (ia > 0.003) {
      c.globalAlpha = ia;
      c.strokeStyle = rgba(f.inkCol || INK);
      c.lineWidth = Math.max(0.7, 1.25 * k) * (o.lw ?? 1);
      c.lineJoin = 'round'; c.lineCap = 'round';
      c.beginPath(); path(c, poly); c.stroke();
    }
    c.restore();
  }
  function inkLine(L, f, pts, lw = 1, a = 1) {
    const c = L.ink.ctx, k = f.h / 300;
    c.save();
    c.globalAlpha = a;
    c.strokeStyle = rgba(f.inkCol || INK);
    c.lineWidth = Math.max(0.6, 1.3 * k) * lw;
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.stroke();
    c.restore();
  }
  function dot(L, f, x, y, r, col, layer = 'ink', a = 1) {
    const c = L[layer].ctx;
    c.save();
    c.globalAlpha = a;
    c.fillStyle = rgba(col);
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.restore();
  }

  // two-bone limb from a root, angles from straight down (+ toward s)
  function bone(x, y, a1, l1, a2, l2, s) {
    const kx = x + Math.sin(a1) * l1 * s, ky = y + Math.cos(a1) * l1;
    const ex = kx + Math.sin(a1 + a2) * l2 * s, ey = ky + Math.cos(a1 + a2) * l2;
    return [[x, y], [kx, ky], [ex, ey]];
  }

  // ------------------------------------------------------------------ heads
  function head(L, f, P, hx, hy, view, dir) {
    const h = f.h, rx = P.hrx * h, ry = P.hry * h;
    const tilt = f.pose?.head || 0; // < 0 looks up
    const col = f.col;
    const back = view === 'back';
    // face
    const face = ellPoly(hx, hy, rx, ry, 24, view === 'side' ? tilt * dir : 0);
    // hair under (long hair / back of head)
    const hairCol = col.hair || [40, 34, 32];
    if (f.hair === 'long' || f.hair === 'bun' || back) {
      const hp = ellPoly(hx - (view === 'side' ? dir * rx * 0.25 : 0), hy - ry * 0.12, rx * 1.08, ry * 1.04, 24);
      if (back) {
        for (const sd of [-1, 1]) part(L, f, ellPoly(hx + sd * rx * 1.02, hy + ry * 0.12, rx * 0.2, ry * 0.26, 12), col.skin, { ink: 0.6 });
        part(L, f, hp, hairCol, {});
      }
    }
    if (!back) part(L, f, face, col.skin, {});
    // hair cap
    if (!back) {
      let cap;
      if (view === 'side') {
        const s = dir, tr = tilt * 0.5;
        cap = [];
        // over the top from the brow, round the back, down to the nape
        for (let i = 0; i <= 16; i++) {
          const a = lerp(-0.95 + tr, -Math.PI - 1.0 + tr, i / 16);
          cap.push([hx + s * Math.cos(a) * rx * 1.07, hy + Math.sin(a) * ry * 1.07]);
        }
        cap.push([hx - s * rx * 0.55, hy + ry * 0.62]);
        cap.push([hx - s * rx * 0.05, hy + ry * 0.12]);
        cap.push([hx + s * rx * 0.25, hy - ry * 0.32 + tr * ry * 0.3]);
      } else {
        cap = [];
        for (let i = 0; i <= 16; i++) {
          const a = lerp(Math.PI * 1.04, TAU - 0.04, i / 16);
          cap.push([hx + Math.cos(a) * rx * 1.07, hy + Math.sin(a) * ry * 1.07]);
        }
        const fy = hy - ry * (0.32 - tilt * 0.5);
        cap.push([hx + rx * 0.95, hy - ry * 0.05]);
        cap.push([hx + rx * 0.4, fy]);
        cap.push([hx - rx * 0.3, fy + ry * 0.05]);
        cap.push([hx - rx * 0.95, hy - ry * 0.05]);
      }
      part(L, f, cap, hairCol, {});
    }
    if (f.hair === 'bun') {
      const bx = hx - (view === 'side' ? dir * rx * 0.9 : 0), by = hy - ry * (view === 'side' ? 0.55 : 0.95);
      part(L, f, ellPoly(bx, by, rx * 0.45, ry * 0.4, 16), hairCol, {});
    }
    if (f.hair === 'pigtails') {
      for (const s of [-1, 1]) {
        if (view === 'side' && s === dir) continue;
        const bx = hx + (view === 'side' ? -dir * rx * 1.0 : s * rx * 1.05), by = hy + ry * 0.05;
        part(L, f, ellPoly(bx, by, rx * 0.32, ry * 0.45, 14, 0.3 * s), hairCol, {});
        if (f.col.ribbon) dot(L, f, bx - (view === 'side' ? -dir : s) * rx * 0.05, by - ry * 0.4, rx * 0.16, f.col.ribbon, 'wash', 0.9);
      }
    }
    if (back) return;
    // features
    const k = h / 300;
    const ink = f.inkCol || INK;
    const ey = hy + ry * (0.08 + tilt * 0.55);
    if (view === 'front') {
      const sp = rx * 0.42;
      const eyeOpen = f.pose?.blink ? 0.15 : 1;
      for (const s of [-1, 1]) {
        if (eyeOpen > 0.5) dot(L, f, hx + s * sp, ey, Math.max(0.9, 1.7 * k * (P === PLAN.child ? 1.25 : 1)), ink);
        else inkLine(L, f, [[hx + s * sp - 2 * k, ey], [hx + s * sp + 2 * k, ey]], 0.9);
        // a touch of cheek colour
        dot(L, f, hx + s * sp * 1.25, ey + ry * 0.32, rx * 0.2, [240, 170, 160], 'wash', 0.5);
      }
      const my = ey + ry * (0.36 - tilt * 0.05);
      const sm = f.pose?.smile ?? 0.3;
      inkLine(L, f, [[hx - rx * 0.16, my], [hx, my + ry * 0.08 * sm], [hx + rx * 0.16, my]], 0.8, 0.8);
    } else {
      const s = dir;
      const ex = hx + s * rx * 0.55;
      dot(L, f, ex, ey, Math.max(0.8, 1.5 * k * (P === PLAN.child ? 1.2 : 1)), ink);
      // nose
      inkLine(L, f, [[hx + s * rx * 0.98, ey + ry * 0.05], [hx + s * rx * 1.08, ey + ry * 0.28], [hx + s * rx * 0.94, ey + ry * 0.32]], 0.8, 0.8);
      dot(L, f, hx + s * rx * 0.42, ey + ry * 0.38, rx * 0.2, [240, 170, 160], 'wash', 0.5);
      if (f.pose?.mouth) inkLine(L, f, [[hx + s * rx * 0.75, ey + ry * 0.55], [hx + s * rx * 0.88, ey + ry * 0.52]], 0.8, 0.8);
    }
  }

  // ------------------------------------------------------------------ the figure
  /*
   * f: { x, y, h, plan: 'adult'|'woman'|'child', view: 'side'|'front'|'back', dir,
   *      walk: phase (radians) | undefined, amp, col: {skin, hair, top, bottom, shoes, sleeve},
   *      hair: 'short'|'bun'|'long'|'pigtails', skirt, coat,
   *      pose: { armF: [a1, a2], armB: [a1, a2], head, lean, sit, blink, smile },
   *      alpha, ink, paint, reg, mask, m (0..2: becomes 人), glyph: {...} }
   */
  function draw(L, f) {
    const m = f.m || 0;
    const paint = 1 - FS.ss(0.0, 0.55, m);
    if (paint > 0.004) body(L, Object.assign({}, f, { alpha: (f.alpha ?? 1) * paint }));
    if (m > 0.001) {
      FS.glyphs.draw(L.ink.ctx, 'person', f.x, f.y - f.h * 0.5, f.h * 0.98, m, Object.assign({ seed: f.seed ?? 3, alpha: f.alpha ?? 1, sx: (f.dir || 1) }, f.glyph || {}));
    }
  }

  function body(L0, f) {
    const L = beginFigure(L0, f);
    if (!L) return;
    bodyParts(L, f);
    endFigure(L, f);
  }
  function bodyParts(L, f) {
    const P = PLAN[f.plan || 'adult'];
    const h = f.h, x = f.x, y = f.y;
    const view = f.view || 'side', dir = f.dir || 1;
    const col = f.col;
    const pose = f.pose || {};
    const amp = f.walk !== undefined ? (f.amp ?? 1) : 0;
    const ph = f.walk || 0;
    const bob = amp * h * 0.012 * Math.cos(ph * 2);
    const lean = (pose.lean || 0) + amp * 0.05;
    const hipY = y - P.hip * h + bob + (pose.sit ? P.th * h * 0.85 : 0);
    const lw = P.leg * h;

    if (view === 'side') {
      const s = dir;
      const shX = x + Math.sin(lean) * (P.sh - P.hip) * h * s, shY = hipY - (P.sh - P.hip) * h;
      // legs
      const leg = (i) => {
        const p = ph + i * Math.PI;
        const a1 = pose.sit ? 1.45 : 0.42 * amp * Math.sin(p);
        const b = pose.sit ? -1.5 : -amp * (0.1 + 0.62 * Math.max(0, Math.sin(p + 1.3)));
        const lift = Math.max(0, Math.sin(p + 1.3)) * amp;
        const [hp, kn, an] = bone(x, hipY, a1, P.th * h, b, P.sn * h, s);
        an[1] -= lift * h * 0.012;
        const toe = [an[0] + s * h * 0.055, an[1] + h * 0.006];
        return { hp, kn, an, toe };
      };
      const back = leg(1), front = leg(0);
      const legCol = (sh) => mixc(col.bottom, [20, 20, 30], sh);
      const drawLeg = (g, shd) => {
        part(L, f, limbPoly([[g.hp[0], g.hp[1], lw * 1.15], [g.kn[0], g.kn[1], lw * 0.95], [g.an[0], g.an[1], lw * 0.78]]), legCol(shd));
        part(L, f, limbPoly([[g.an[0] - s * h * 0.008, g.an[1] - h * 0.006, lw * 0.75], [g.toe[0], g.toe[1], lw * 0.55]]), col.shoes || [50, 44, 40]);
      };
      // arms
      const armSwing = (i) => -0.35 * amp * Math.sin(ph + i * Math.PI);
      const arm = (i, ov) => {
        const a1 = ov ? ov[0] : armSwing(i) + lean * 0.5, a2 = ov ? ov[1] : 0.25 + 0.15 * amp;
        return bone(shX - s * h * 0.01, shY + h * 0.012, a1, P.ua * h, a2, P.fa * h, s);
      };
      const drawArm = (b, shd) => {
        const sl = col.sleeve || col.top;
        part(L, f, limbPoly([[b[0][0], b[0][1], P.limb * h * 1.25], [b[1][0], b[1][1], P.limb * h * 1.0]]), mixc(sl, [20, 20, 30], shd));
        const fa = f.shortSleeve ? col.skin : sl;
        part(L, f, limbPoly([[b[1][0], b[1][1], P.limb * h * 0.95], [b[2][0], b[2][1], P.limb * h * 0.75]]), mixc(fa, [20, 20, 30], shd));
        part(L, f, ellPoly(b[2][0], b[2][1] + P.limb * h * 0.18, P.limb * h * 0.4, P.limb * h * 0.48), col.skin, { ink: 0.5 });
      };
      const armB = arm(1, pose.armB), armF = arm(0, pose.armF);
      drawArm(armB, 0.18);
      if (!f.skirt) drawLeg(back, 0.15);
      else { drawLeg(back, 0.15); }
      // torso: a smooth body along the spine, chest forward, back curved
      const hw = P.hw * h * 0.75, tw = P.shw * h * 0.62;
      const dpt = P.hw * h * 0.82;
      const sp = (u, off) => {
        const bx = lerp(x, shX, u), by = lerp(hipY + h * 0.03, shY, u);
        return [bx + s * off, by];
      };
      const torso = smoothPoly([
        sp(0, dpt * 0.95), sp(0.35, dpt * 0.78), sp(0.72, dpt * 1.0), sp(0.95, dpt * 0.72), sp(1.04, dpt * 0.1),
        sp(1.0, -dpt * 0.7), sp(0.75, -dpt * 0.9), sp(0.4, -dpt * 0.78), sp(0, -dpt * 0.95),
      ], 2);
      if (f.skirt) {
        const kneeY = hipY + P.th * h * 0.95;
        const sw = Math.max(Math.abs(front.kn[0] - back.kn[0]) * 0.6, hw * 0.9);
        part(L, f, [[x - s * hw * 0.9, hipY - h * 0.05], [x + s * hw * 0.9, hipY - h * 0.05], [x + s * (sw + hw * 0.4), kneeY], [x - s * (sw + hw * 0.4), kneeY + h * 0.01]], col.skirt || col.bottom);
      }
      drawLeg(front, 0);
      part(L, f, torso, col.top);
      if (f.bag) {
        const bx = x - s * hw * 1.2, by = hipY - h * 0.08;
        inkLine(L, f, [[shX - s * tw * 0.3, shY + h * 0.01], [bx - s * h * 0.02, by - h * 0.05]], 1, 0.8);
        part(L, f, [[bx - h * 0.05, by - h * 0.05], [bx + h * 0.05, by - h * 0.05], [bx + h * 0.055, by + h * 0.05], [bx - h * 0.055, by + h * 0.05]], f.bag);
      }
      // neck + head
      const hx = shX + s * h * (0.012 + Math.sin(lean) * 0.08) + s * (pose.headFwd || 0) * h, hy = y - P.headY * h + bob + (pose.sit ? P.th * h * 0.85 : 0) + Math.sin(lean) * h * 0.01 + (pose.headY || 0) * h;
      part(L, f, limbPoly([[shX + s * h * 0.005, shY + h * 0.01, P.hrx * h * 0.7], [hx - s * h * 0.01, hy + P.hry * h * 0.6, P.hrx * h * 0.6]]), col.skin, {});
      head(L, f, P, hx, hy, 'side', s);
      drawArm(armF, 0);
      if (f.hold) f.hold(L, armF[2], armB[2]);
      return;
    }

    // ---------------- front / back view
    const back = view === 'back';
    const shY = hipY - (P.sh - P.hip) * h;
    const shX = x + Math.sin(lean) * (P.sh - P.hip) * h;
    const sway = amp * Math.sin(ph) * h * 0.006;
    // legs
    const legs = [-1, 1].map((sd) => {
      const p = ph + (sd > 0 ? 0 : Math.PI);
      const lift = Math.max(0, Math.sin(p)) * amp;
      const hx = x + sd * P.hw * h * 0.55 + sway;
      const ay = y - lift * h * 0.03;
      const kx = hx + sd * h * 0.004, ky = lerp(hipY, ay, 0.5) - lift * h * 0.015;
      return { hp: [hx, hipY], kn: [kx, ky], an: [hx + sd * h * 0.006, ay], sd, lift };
    });
    const drawLegs = () => {
      for (const g of legs) {
        part(L, f, limbPoly([[g.hp[0], g.hp[1], lw * 1.2], [g.kn[0], g.kn[1], lw], [g.an[0], g.an[1] - h * 0.02, lw * 0.8]]), col.bottom);
        const fy = g.an[1];
        part(L, f, ellPoly(g.an[0] + g.sd * h * 0.008, fy - h * 0.012, lw * 0.62, h * 0.018, 14), col.shoes || [50, 44, 40]);
      }
    };
    if (!pose.sit) {
      if (f.skirt) {
        drawLegs();
        const kneeY = hipY + P.th * h * 0.95;
        part(L, f, [[x - P.hw * h * 0.85, hipY - h * 0.05], [x + P.hw * h * 0.85, hipY - h * 0.05], [x + P.hw * h * 1.35, kneeY], [x - P.hw * h * 1.35, kneeY + h * 0.01]], col.skirt || col.bottom);
      } else drawLegs();
    }
    // arms (frontal plane: angle + toward screen right)
    const arm = (sd, ov) => {
      const ax = shX + sd * P.shw * h * 0.92, ay = shY + h * 0.02;
      const swing = amp * 0.12 * Math.sin(ph + (sd > 0 ? Math.PI : 0));
      const a1 = ov ? ov[0] : sd * (0.12 + swing * 0.3), a2 = ov ? ov[1] : -sd * 0.08;
      return bone(ax, ay, a1, P.ua * h, a2, P.fa * h, 1);
    };
    const armL = arm(-1, pose.armL), armR = arm(1, pose.armR);
    const drawArm = (b) => {
      const sl = col.sleeve || col.top;
      part(L, f, limbPoly([[b[0][0], b[0][1], P.limb * h * 1.25], [b[1][0], b[1][1], P.limb * h * 1.0]]), sl);
      part(L, f, limbPoly([[b[1][0], b[1][1], P.limb * h * 0.95], [b[2][0], b[2][1], P.limb * h * 0.75]]), f.shortSleeve ? col.skin : sl);
      part(L, f, ellPoly(b[2][0], b[2][1] + P.limb * h * 0.15, P.limb * h * 0.4, P.limb * h * 0.48), col.skin, { ink: 0.5 });
    };
    // raised arms go behind the head only in back view
    const upL = armL[2][1] < shY, upR = armR[2][1] < shY;
    if (!back || (!upL && !upR)) { /* drawn after torso */ }
    // torso
    const sw = P.shw * h, ww = P.ww * h, hw = P.hw * h;
    const torso = smoothPoly([
      [shX - sw * 0.35, shY - h * 0.022], [shX + sw * 0.35, shY - h * 0.022], [shX + sw * 1.02, shY + h * 0.012], [shX + sw * 0.95, shY + h * 0.09],
      [x + ww, lerp(shY, hipY, 0.68)], [x + hw * 1.02, hipY + h * 0.04], [x - hw * 1.02, hipY + h * 0.04], [x - ww, lerp(shY, hipY, 0.68)],
      [shX - sw * 0.95, shY + h * 0.09], [shX - sw * 1.02, shY + h * 0.012],
    ], 2);
    if (back) { drawArm(armL); drawArm(armR); }
    part(L, f, torso, col.top);
    if (f.coat) part(L, f, torso.map((p) => [p[0], p[1]]), col.top, { fill: 0.25 });
    // head
    const hx = shX + (pose.headX || 0) * h, hy = y - P.headY * h + bob + (pose.sit ? P.th * h * 0.85 : 0) + (pose.head || 0) * h * 0.012 * (back ? -1 : 1) + (pose.headY || 0) * h;
    part(L, f, limbPoly([[shX, shY + h * 0.005, P.hrx * h * 0.75], [hx, hy + P.hry * h * 0.6, P.hrx * h * 0.65]]), col.skin, { ink: back ? 0.4 : 1 });
    head(L, f, P, hx, hy, view, dir);
    if (!back) { drawArm(armL); drawArm(armR); }
    if (f.hold) f.hold(L, armL[2], armR[2]);
  }

  // where a side-view figure's arms hang from (for IK)
  function shoulder(f) {
    const P = PLAN[f.plan || 'adult'], h = f.h, s = f.dir || 1, lean = f.pose?.lean || 0;
    const hipY = f.y - P.hip * h + (f.pose?.sit ? P.th * h * 0.85 : 0);
    const shX = f.x + Math.sin(lean) * (P.sh - P.hip) * h * s, shY = hipY - (P.sh - P.hip) * h;
    return { x: shX - s * h * 0.01, y: shY + h * 0.012, l1: P.ua * h, l2: P.fa * h };
  }
  // two-bone IK: angles (in this rig's convention) that put the hand on target
  function ik(sx, sy, tx, ty, l1, l2, s = 1, bend = 1) {
    const dx = (tx - sx) * s, dy = ty - sy;
    const D = Math.min(Math.hypot(dx, dy), (l1 + l2) * 0.999);
    const th = Math.atan2(dx, dy);
    const a = Math.acos(clamp((l1 * l1 + D * D - l2 * l2) / (2 * l1 * D), -1, 1));
    const b = Math.acos(clamp((l1 * l1 + l2 * l2 - D * D) / (2 * l1 * l2), -1, 1));
    return [th - bend * a, bend * (Math.PI - b)];
  }
  // walking phase locked to distance travelled (feet don't skate)
  function phaseFor(dist, h, amp = 1) { return (dist / (h * 0.78 * Math.max(0.35, amp))) * Math.PI; }

  FS.fig = { draw, body, beginFigure, endFigure, ik, shoulder, limbPoly, ellPoly, path, part, inkLine, dot, bone, phaseFor, PLAN, INK };
})(typeof window !== 'undefined' ? window : globalThis);
