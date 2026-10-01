/*
 * The two characters: 她 (you) and 他 (L).
 *
 * Heads come in two rigs:
 *   - profileHead: a hand-shaped side profile (facing right; mirrored with dir = -1),
 *     with blink, gaze, jaw rotation for chewing and a turn-away blend
 *   - faceFront:   a head built from horizontal cross-sections and rotated about the
 *     vertical axis (yaw), so the same face works from front to three-quarter view;
 *     eyes, lids, brows, nose and lips are 3D points projected each frame
 *
 * Lighting is painted, not computed: every shape gets an ambient base, a key-light
 * gradient from the light direction, and a rim on the edge facing the light.
 */
(function (G) {
  'use strict';
  const M = G.MY;
  const { clamp, lerp, rgba, mixc } = M;
  const mul = (a, b, k = 1) => [a[0] * b[0] / 255 * k, a[1] * b[1] / 255 * k, a[2] * b[2] / 255 * k];
  M.mul = mul;

  M.HER = {
    skin: [236, 196, 172], skinShade: [176, 120, 108], lip: [196, 112, 110], hair: [34, 26, 26], hairHi: [120, 92, 80],
    iris: [58, 40, 32], brow: [52, 38, 34],
  };
  M.HIM = {
    skin: [218, 172, 140], skinShade: [150, 102, 82], lip: [170, 106, 92], hair: [26, 23, 22], hairHi: [96, 84, 76],
    iris: [44, 32, 26], brow: [36, 28, 24],
  };

  // ---------------------------------------------------------------- lighting
  // L = { amb:[r,g,b] (multiplier, 255 = 1), key:{c, a, x, y}, rim:{c, a, x, y} } — x,y point toward the light
  M.litFill = function (ctx, path, base, L, cx, cy, R, opts = {}) {
    ctx.save();
    ctx.beginPath(); path(ctx); ctx.clip();
    ctx.fillStyle = rgba(mul(base, L.amb));
    ctx.fillRect(cx - R * 3, cy - R * 3, R * 6, R * 6);
    if (L.key && L.key.a > 0) {
      const k = L.key, sp = opts.spread || 1;
      const g = ctx.createLinearGradient(cx + k.x * R * 1.1, cy + k.y * R * 1.1, cx - k.x * R * 0.6 * sp, cy - k.y * R * 0.6 * sp);
      const lc = mul(base, k.c, 1);
      g.addColorStop(0, rgba(lc, clamp(k.a)));
      g.addColorStop(0.55, rgba(lc, clamp(k.a) * 0.45));
      g.addColorStop(1, rgba(lc, 0));
      ctx.fillStyle = g;
      ctx.fillRect(cx - R * 3, cy - R * 3, R * 6, R * 6);
    }
    if (opts.extra) opts.extra(ctx);
    if (L.rim && L.rim.a > 0) {
      const r = L.rim;
      const g = ctx.createLinearGradient(cx + r.x * R, cy + r.y * R, cx, cy);
      g.addColorStop(0, rgba(r.c, r.a));
      g.addColorStop(0.6, rgba(r.c, r.a * 0.3));
      g.addColorStop(1, rgba(r.c, 0));
      ctx.strokeStyle = g;
      ctx.lineWidth = (opts.rimW || 0.06) * R * 2;
      ctx.beginPath(); path(ctx); ctx.stroke();
    }
    ctx.restore();
  };
  // soft shadow/light blotch inside the current clip
  M.blot = function (ctx, x, y, rx, ry, c, a, op = 'source-over') {
    ctx.save();
    ctx.globalCompositeOperation = op;
    ctx.translate(x, y); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, rgba(c, a)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  };

  // ================================================================ PROFILE HEAD
  // Units: head ≈ 230 tall, origin at the centre of the skull, facing +x.
  // Points from the crown, down the face, to the throat; then back up the nape.
  const PROF = {
    her: {
      face: [[-6, -120], [34, -108], [58, -80], [66, -48], [64, -28], [66, -18], [76, 0], [86, 14], [82, 21], [72, 24], [66, 27],
        [67, 35], [72, 42], [67, 47], [69, 54], [64, 59], [59, 63], [62, 72], [62, 82], [50, 94], [30, 99], [20, 104], [19, 130], [18, 190]],
      back: [[-56, 190], [-54, 120], [-60, 82], [-90, 32], [-100, -24], [-80, -86]],
      jawFrom: 13, eye: [52, -24], brow: [[34, -42], [48, -46], [62, -42]], ear: [-16, 4], nostril: [71, 19], lipC: [62, 46],
    },
    him: {
      face: [[-8, -122], [36, -110], [62, -82], [70, -52], [70, -34], [66, -22], [78, -2], [90, 15], [86, 24], [74, 27], [68, 30],
        [69, 38], [73, 45], [68, 50], [70, 57], [64, 63], [58, 67], [63, 78], [64, 92], [54, 104], [20, 106], [12, 112], [14, 140], [14, 200]],
      back: [[-60, 200], [-58, 128], [-64, 84], [-96, 30], [-104, -28], [-82, -92]],
      jawFrom: 13, eye: [54, -27], brow: [[34, -46], [52, -48], [68, -42]], ear: [-14, 2], nostril: [74, 22], lipC: [64, 50],
    },
  };
  function rot(p, c, a) {
    const s = Math.sin(a), co = Math.cos(a), x = p[0] - c[0], y = p[1] - c[1];
    return [c[0] + x * co - y * s, c[1] + x * s + y * co];
  }
  // o: {x, y, s, dir, who:'her'|'him', L, blink, gaze:[dx,dy], jaw, turn, tilt, smile, cheek}
  M.profileHead = function (ctx, o) {
    const P = PROF[o.who], C = o.who === 'her' ? M.HER : M.HIM;
    const L = o.L, dir = o.dir || 1, s = o.s || 1;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.scale(s * dir, s);
    ctx.rotate(o.tilt || 0);
    const Ll = { amb: L.amb, key: L.key && { ...L.key, x: L.key.x * dir }, rim: L.rim && { ...L.rim, x: L.rim.x * dir } };
    const turn = clamp(o.turn || 0);
    // jaw: rotate the lower face about a pivot below the ear
    const jaw = o.jaw || 0, piv = [-10, 18];
    const face = P.face.map((p, i) => (i >= P.jawFrom && i < P.face.length - 3 ? rot(p, piv, jaw * (i >= P.jawFrom + 2 ? 1 : 0.5)) : p));
    // turning away: the face flattens back into the skull
    const fk = 1 - turn * 0.85;
    const faceT = face.map((p, i) => (i > 0 && i < face.length - 2 ? [p[0] * (p[0] > 0 ? fk : 1) - turn * 18, p[1]] : p));
    const path = (c) => { M.spline(c, faceT.concat(P.back), true, 0.42); };
    // neck/back-of-head shadow side is handled by the light gradient
    M.litFill(ctx, path, C.skin, Ll, 10, 0, 130, {
      rimW: 0.035,
      extra: (c) => {
        // under-chin shadow onto the neck, eye socket, cheek warmth
        M.blot(c, 10, 128, 60, 26, mul(C.skinShade, L.amb), 0.55 * (1 - (L.key && L.key.y > 0.5 ? 0.8 : 0)));
        if (turn < 0.9) {
          // jaw line: separates face from neck
          c.save(); c.filter = `blur(${3 * s * M.SC}px)`;
          c.strokeStyle = rgba(mul(C.skinShade, L.amb), 0.45); c.lineWidth = 7;
          c.beginPath(); c.moveTo(46, 96); c.quadraticCurveTo(6, 100, -22, 40); c.stroke();
          c.restore();
          M.blot(c, 48 * fk, -24, 22, 14, mul(C.skinShade, L.amb), 0.25);
          M.blot(c, 34 * fk, 22, 30, 22, [230, 120, 120], (o.cheek || 0.12) * (1 - turn));
        }
      },
    });
    if (turn < 0.85) {
      const fa = 1 - turn / 0.85;
      ctx.save();
      ctx.globalAlpha = fa;
      // lips: philtrum → upper lip → mouth line → lower lip → under-lip fold
      const lc = mul(C.lip, L.amb, 1.0);
      const q = (i) => faceT[i];
      const p11 = q(11), p12 = q(12), p13 = q(13), p14 = q(14), p15 = q(15);
      const corner = rot(P.lipC, piv, jaw * 0.5);
      ctx.beginPath();
      ctx.moveTo(p11[0] - 1, p11[1] + 2);
      ctx.quadraticCurveTo(p12[0] + 1, p12[1] - 2, p13[0], p13[1]);
      ctx.quadraticCurveTo(p14[0] + 1, p14[1], p15[0] - 2, p15[1]);
      ctx.lineTo(corner[0] - 8, corner[1] + 6);
      ctx.lineTo(corner[0] - 6, corner[1] - 4);
      ctx.closePath();
      ctx.fillStyle = rgba(lc, 0.5); ctx.fill();
      ctx.strokeStyle = rgba(mul(lc, [140, 120, 120]), 0.7); ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(p13[0], p13[1]); ctx.quadraticCurveTo(corner[0] + 2, corner[1] - (o.smile || 0) * 3, corner[0] - 5, corner[1] - (o.smile || 0) * 4); ctx.stroke();
      // nostril
      ctx.strokeStyle = rgba(mul(C.skinShade, L.amb), 0.9); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(P.nostril[0] - 2, P.nostril[1], 5, 0.3, 2.2); ctx.stroke();
      // eye
      const [ex, ey] = P.eye, bl = clamp(o.blink === undefined ? 1 : o.blink);
      const g = o.gaze || [0, 0];
      const open = 6.5 * bl;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ex - 10, ey + 1);
      ctx.quadraticCurveTo(ex + 1, ey - open * 1.15, ex + 10, ey - open * 0.2 + 1);
      ctx.quadraticCurveTo(ex + 2, ey + open * 0.6 + 2, ex - 10, ey + 1);
      ctx.closePath();
      ctx.fillStyle = rgba(mul([236, 230, 226], L.amb, 1.05)); ctx.fill();
      ctx.clip();
      ctx.fillStyle = rgba(C.iris);
      ctx.beginPath(); ctx.ellipse(ex + 5 + g[0] * 3, ey - 0.5 + g[1] * 2, 4.2, 6.5, 0, 0, M.TAU); ctx.fill();
      ctx.fillStyle = '#0a0606'; ctx.beginPath(); ctx.ellipse(ex + 6 + g[0] * 3, ey - 0.5 + g[1] * 2, 2.2, 3.6, 0, 0, M.TAU); ctx.fill();
      if (o.catch) { ctx.fillStyle = rgba(o.catch, 0.95); ctx.fillRect(ex + 6 + g[0] * 3, ey - 4 + g[1] * 2, 2.6, 3.2); }
      ctx.restore();
      // upper lid + lashes
      ctx.strokeStyle = rgba(mul([40, 26, 24], [255, 255, 255])); ctx.lineCap = 'round';
      ctx.lineWidth = o.who === 'her' ? 2.6 : 2.0;
      ctx.beginPath(); ctx.moveTo(ex - 10, ey + 1); ctx.quadraticCurveTo(ex + 1, ey - open * 1.15, ex + 11, ey - open * 0.2 + 1); ctx.stroke();
      if (o.who === 'her') {
        ctx.lineWidth = 1.3;
        for (let i = 0; i < 4; i++) {
          const u = 0.45 + i * 0.17, px = lerp(ex - 10, ex + 11, u), py = ey + 1 - open * 1.15 * 4 * u * (1 - u) * 0.9;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + 4, py - 3, px + 7 + i, py - 3 - bl * 2); ctx.stroke();
        }
      }
      // lid crease
      ctx.strokeStyle = rgba(mul(C.skinShade, L.amb), 0.5); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(ex - 8, ey - 4 - open * 0.5); ctx.quadraticCurveTo(ex + 1, ey - 6 - open * 1.2, ex + 8, ey - 3 - open * 0.4); ctx.stroke();
      // brow
      const b = P.brow, br = o.brow || 0;
      ctx.strokeStyle = rgba(mul(C.brow, [255, 255, 255])); ctx.lineWidth = o.who === 'her' ? 3.4 : 5;
      ctx.beginPath(); ctx.moveTo(b[0][0], b[0][1] + br * 2); ctx.quadraticCurveTo(b[1][0], b[1][1] + br * 3, b[2][0], b[2][1] + br * 5); ctx.stroke();
      ctx.restore();
    }
    // ear
    if (o.who === 'him') {
      const [qx, qy] = P.ear;
      M.litFill(ctx, (c) => { c.ellipse(qx, qy, 13, 24, 0.15, 0, M.TAU); }, C.skin, Ll, qx, qy, 26, { rimW: 0.08 });
      ctx.strokeStyle = rgba(mul(C.skinShade, L.amb), 0.7); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(qx + 2, qy, 8, -1.8, 1.4); ctx.stroke();
    }
    M.hairProfile(ctx, o.who, Ll, turn, o.hairSway || 0);
    ctx.restore();
  };

  M.hairProfile = function (ctx, who, L, turn, sway) {
    const C = who === 'her' ? M.HER : M.HIM;
    let pts;
    if (who === 'her') {
      const sw = sway * 6;
      pts = [[-14, -136], [30, -124], [56, -100], [66, -74], [68, -54], [62, -44], [52, -52], [38, -60], [22, -60], [8, -48], [-2, -24], [-6, 14],
        [-4, 70], [0, 130], [8 + sw, 170], [-30 + sw, 178], [-70 + sw, 172], [-104 + sw, 150], [-112, 80], [-114, 0], [-106, -70], [-70, -122]];
      if (turn > 0) pts = pts.map((p) => [p[0] + (p[0] > -20 ? turn * 30 * (p[1] < 40 ? 1 : 0.5) : 0), p[1]]);
    } else {
      pts = [[52, -88], [64, -70], [54, -82], [40, -94], [20, -96], [0, -88], [-6, -60], [-4, -26], [-12, -14], [-30, -28], [-50, -10], [-66, 40],
        [-78, 54], [-100, 20], [-108, -30], [-92, -98], [-40, -134], [20, -128]];
      if (turn > 0) pts = pts.map((p) => [p[0] + turn * 26 * (p[1] < 0 ? 1 : 0), p[1]]);
    }
    const path = (c) => M.spline(c, pts, true, 0.5);
    M.litFill(ctx, path, C.hair, L, -30, -20, 140, { rimW: 0.025 });
    // strands
    ctx.save();
    ctx.beginPath(); path(ctx); ctx.clip();
    const hi = mul(C.hairHi, L.amb, 1);
    ctx.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const u = i / 25;
      ctx.strokeStyle = rgba(hi, 0.18 + 0.1 * M.hash(i + 3));
      ctx.lineWidth = 1.2 + M.hash(i) * 1.5;
      ctx.beginPath();
      if (who === 'her') {
        const x0 = lerp(30, -100, u);
        ctx.moveTo(x0 + 20, -120 + Math.abs(u - 0.4) * 40);
        ctx.bezierCurveTo(x0 - 30, -60, x0 - 20 + sway * 4, 60, x0 + 10 + sway * 6, 170);
      } else {
        const x0 = lerp(50, -90, u);
        ctx.moveTo(x0, -120 + u * 10);
        ctx.quadraticCurveTo(x0 - 30, -100, x0 - 20, -40 + u * 40);
      }
      ctx.stroke();
    }
    // sheen band where the key light catches the crown
    if (L.key && L.key.a > 0.05) M.blot(ctx, -20 + L.key.x * 60, -90 + L.key.y * 40, 90, 30, mul(C.hairHi, L.key.c, 1.4), 0.35 * L.key.a, 'lighter');
    ctx.restore();
  };

  // ================================================================ FRONT / 3-4 FACE
  // half-width w(y) and forward offset z0(y) of the head's horizontal cross-sections
  const SEC = [[-122, 0, 0], [-110, 44, 0], [-90, 68, 0], [-60, 78, 0], [-30, 80, 0], [0, 78, 2], [30, 72, 6], [55, 62, 12], [78, 46, 18], [96, 26, 22], [106, 8, 22], [109, 0, 22]];
  const DEP = 0.95;
  function facePts(yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const L = [], R = [];
    for (const [y, w, z0] of SEC) {
      const half = Math.sqrt((w * c) ** 2 + (w * DEP * s) ** 2), ctr = z0 * s;
      L.push([ctr - half, y]); R.push([ctr + half, y]);
    }
    return L.concat(R.reverse());
  }
  // project a point on the face: x across, y down, z forward (toward the viewer at yaw 0)
  const pr = (x, y, z, yaw) => [x * Math.cos(yaw) + z * Math.sin(yaw), y];

  // o: {x, y, s, who, yaw, tilt, L, blink, lid (0 open … 1 shut), smileEyes, gaze:[x,y], brow, browIn,
  //     mouth:{open, wide, smile}, hairBack:fn, cheek}
  M.faceFront = function (ctx, o) {
    const C = o.who === 'her' ? M.HER : M.HIM;
    const L = o.L, yaw = o.yaw || 0, s = o.s || 1;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.tilt || 0);
    ctx.scale(s, s);
    if (o.who === 'her') hairBackHer(ctx, L, yaw, o);
    // neck
    const nx = 18 * Math.sin(yaw), nw = o.who === 'her' ? 44 : 54;
    M.litFill(ctx, (c) => { c.moveTo(-nw + nx, 60); c.lineTo(nw + nx, 60); c.lineTo(nw + 4 + nx * 0.6, 200); c.lineTo(-nw - 4 + nx * 0.6, 200); c.closePath(); },
      C.skin, { amb: mul(L.amb, [200, 190, 190]), key: L.key, rim: L.rim }, nx, 130, 80, {
        extra: (c) => M.blot(c, nx + 10 * Math.sin(yaw), 100, 70, 34, mul(C.skinShade, L.amb), 0.7),
      });
    // ears (behind the face contour)
    for (const side of [-1, 1]) {
      const ang = side * Math.PI / 2 + yaw;
      if (Math.cos(ang - Math.PI / 2 * side) < 0) continue;
      const vis = Math.cos(yaw * 1.3 + side * 0.2);
      const ex = Math.sin(ang) * 80 * (side === 1 ? 1 : 1), ey = 6;
      if ((side === 1 && yaw > 0.5) || (side === -1 && yaw < -0.5)) continue;
      M.litFill(ctx, (c) => c.ellipse(ex + side * 4, ey, 12 * Math.max(0.3, Math.abs(Math.cos(ang - side * 0.4))), 24, 0, 0, M.TAU), C.skin, L, ex, ey, 26);
    }
    const fp = facePts(yaw);
    const path = (c) => M.spline(c, fp, true, 0.5);
    const sx = (x, y, z) => pr(x, y, z, yaw);
    const key = L.key || { x: 0, y: -1, a: 0, c: [255, 255, 255] };
    M.litFill(ctx, path, C.skin, L, 0, 0, 120, {
      rimW: 0.03,
      extra: (c) => {
        // modelling: far-side cheek falls off, eye sockets, cheekbone light, nose shadow, under-lip
        const sd = mul(C.skinShade, L.amb);
        const far = yaw >= 0 ? -1 : 1;
        M.blot(c, sx(far * 70, 10, 0)[0], 10, 60, 110, sd, 0.28 + Math.abs(yaw) * 0.3);
        for (const side of [-1, 1]) {
          const e = sx(side * 32, -14, 62);
          M.blot(c, e[0], e[1] - 2, 30, 18, sd, 0.28);
          const ck = sx(side * 44, 28, 54);
          M.blot(c, ck[0], ck[1], 28, 20, [236, 128, 124], o.cheek === undefined ? 0.16 : o.cheek);
        }
        // nose shadow on the side away from the key light
        const ns = sx(-Math.sign(key.x || 0.01) * 12, 30, 76);
        M.blot(c, ns[0], ns[1], 14, 24, sd, 0.45 * key.a + 0.15);
        const un = sx(0, 50, 72);
        M.blot(c, un[0], un[1], 22, 8, sd, 0.4);
        const ul = sx(0, 84, 60);
        M.blot(c, ul[0], ul[1], 20, 9, sd, 0.32);
        // light on forehead / cheekbone toward the key
        const lk = mul(C.skin, key.c, 1.1);
        M.blot(c, key.x * 40 + sx(0, -60, 60)[0], -60, 60, 34, lk, 0.22 * key.a, 'lighter');
      },
    });
    // eyes
    const bl = clamp(o.blink === undefined ? 1 : o.blink);
    const lid = clamp(o.lid || 0), lowLid = clamp(o.lowLid || 0);
    const g = o.gaze || [0, 0];
    for (const side of [-1, 1]) {
      const ec = sx(side * 32, -10, 66);
      const vis = Math.cos(yaw + side * 0.32);   // foreshortening of each eye
      if (vis < 0.15) continue;
      const w = 23 * vis, open = 12 * bl;
      const ex = ec[0], ey = ec[1];
      // eye white shape: inner corner a little lower
      const inner = -side, ix = ex + inner * w, ox = ex - inner * w;
      const topY = ey - open * (1 - lid * 0.85), botY = ey + open * 0.62 * (1 - lowLid * 0.5);
      ctx.save();
      if (o.smileEyes > 0.5) {
        ctx.strokeStyle = rgba([40, 24, 22]); ctx.lineWidth = 3.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ix, ey + 2); ctx.quadraticCurveTo(ex, ey - 9, ox, ey + 3); ctx.stroke();
        ctx.restore();
        continue;
      }
      const eyePath = (c) => {
        c.moveTo(ix, ey + 2);
        c.bezierCurveTo(ix - inner * w * 0.3, topY - 1, ox + inner * w * 0.45, topY - 1, ox, ey - 1);
        c.bezierCurveTo(ox + inner * w * 0.4, botY + 1, ix - inner * w * 0.4, botY + 1, ix, ey + 2);
      };
      ctx.beginPath(); eyePath(ctx); ctx.closePath();
      ctx.fillStyle = rgba(mul([238, 232, 228], L.amb, 1.0)); ctx.fill();
      ctx.clip();
      const irx = ex + g[0] * 8 * vis + Math.sin(yaw) * 4, iry = ey + g[1] * 4 + 1;
      ctx.fillStyle = rgba(C.iris);
      ctx.beginPath(); ctx.ellipse(irx, iry, 10.5 * Math.max(0.55, vis), 11, 0, 0, M.TAU); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.beginPath(); ctx.ellipse(irx, iry, 5 * Math.max(0.55, vis), 5.4, 0, 0, M.TAU); ctx.fill();
      // upper lid shadow over the eyeball
      ctx.fillStyle = M.lin(ctx, 0, topY - 2, 0, topY + 8, [[0, [40, 20, 20], 0.5], [1, [40, 20, 20], 0]]);
      ctx.fillRect(ex - 40, topY - 4, 80, 14);
      if (o.catch !== false) {
        ctx.fillStyle = rgba(o.catch || [255, 255, 255], 0.9);
        ctx.beginPath(); ctx.arc(irx + 4, iry - 4, 2.4, 0, M.TAU); ctx.fill();
      }
      ctx.restore();
      // lash line
      ctx.strokeStyle = 'rgba(28,18,16,0.95)'; ctx.lineCap = 'round';
      ctx.lineWidth = o.who === 'her' ? 3.6 : 2.6;
      ctx.beginPath();
      ctx.moveTo(ix, ey + 2);
      ctx.bezierCurveTo(ix - inner * w * 0.3, topY - 1, ox + inner * w * 0.45, topY - 1, ox, ey - 1);
      if (o.who === 'her') ctx.quadraticCurveTo(ox - inner * 3, ey - 2.5, ox - inner * 5, ey - 4.5);
      ctx.stroke();
      ctx.strokeStyle = rgba(mul(C.skinShade, L.amb), 0.55); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(ix - inner * 2, botY - 1 + 2); ctx.quadraticCurveTo(ex, botY + 4, ox + inner * 3, ey + 1); ctx.stroke();
      // lid crease follows the lid
      ctx.strokeStyle = rgba(mul(C.skinShade, L.amb), 0.6); ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(ix - inner * 3, ey - 4);
      ctx.bezierCurveTo(ix - inner * w * 0.3, topY - 9 + lid * 4, ox + inner * w * 0.4, topY - 8 + lid * 4, ox + inner * 2, ey - 6);
      ctx.stroke();
      // brow
      const br = o.brow || 0, bi = o.browIn || 0;
      const b0 = sx(side * 12 + -side * bi * 4, -40 + br * 6 + bi * 5, 70), b1 = sx(side * 34, -46 + br * 5, 66), b2 = sx(side * 56, -38 + br * 2, 52);
      ctx.strokeStyle = rgba(mul(C.brow, [255, 255, 255]), 0.92);
      ctx.lineWidth = o.who === 'her' ? 5 : 7.5;
      ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.quadraticCurveTo(b1[0], b1[1] - 4, b2[0], b2[1]); ctx.stroke();
    }
    // nose
    const nb = sx(0, -8, 70), nt = sx(0, 34, 92), nl = sx(-13, 44, 74), nr = sx(13, 44, 74), nbase = sx(0, 48, 80);
    const sd = mul(C.skinShade, L.amb);
    ctx.strokeStyle = rgba(sd, 0.55); ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath();
    const side = yaw >= 0 ? -1 : 1;
    const nside = sx(side * 9, 10, 74);
    ctx.moveTo(nside[0] + side * 2, nside[1]); ctx.quadraticCurveTo(nt[0] + side * 10, nt[1] - 8, nt[0] + side * 9, nt[1] + 4);
    ctx.globalAlpha = Math.min(0.8, Math.abs(yaw) * 2.5 + 0.15);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = rgba(sd, 0.85); ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(nl[0], nl[1]); ctx.quadraticCurveTo(nbase[0] - 6, nbase[1] + 4, nbase[0], nbase[1] + 1); ctx.quadraticCurveTo(nbase[0] + 6, nbase[1] + 4, nr[0], nr[1]); ctx.stroke();
    M.blot(ctx, nt[0] + key.x * 4, nt[1] - 6, 7, 5, mul(C.skin, key.c, 0.5), 0.35 * key.a, 'lighter');
    // mouth
    drawMouthFront(ctx, o, C, L, yaw, sx);
    // hair in front
    if (o.after) o.after(ctx, sx);
    if (o.who === 'her') hairFrontHer(ctx, L, yaw, o);
    else hairFrontHim(ctx, L, yaw, o);
    ctx.restore();
  };

  function drawMouthFront(ctx, o, C, L, yaw, sx) {
    const m = o.mouth || {};
    const open = m.open || 0, wide = m.wide || 0, smile = m.smile || 0, press = m.press || 0;
    const hw = 25 + wide * 6 + smile * 4 - press * 2;
    const cy = 72;
    const lcorner = sx(-hw, cy - smile * 4, 56), rcorner = sx(hw, cy - smile * 4, 56);
    const ctr = sx(0, cy, 66);
    const upTop = sx(0, cy - 9 - open * 2, 68), bowL = sx(-7, cy - 11 - open * 2, 67), bowR = sx(7, cy - 11 - open * 2, 67);
    const lowBot = sx(0, cy + 13 + open * 22, 64);
    const lipC = mul(C.lip, L.amb);
    const gap = open * 18;
    // mouth interior
    if (open > 0.02) {
      ctx.beginPath();
      ctx.moveTo(lcorner[0], lcorner[1]);
      ctx.quadraticCurveTo(ctr[0], ctr[1] - 4 - gap * 0.15, rcorner[0], rcorner[1]);
      ctx.quadraticCurveTo(ctr[0], ctr[1] + gap * 1.15, lcorner[0], lcorner[1]);
      ctx.fillStyle = rgba(mul([70, 28, 30], L.amb)); ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = rgba(mul([232, 226, 214], L.amb, 0.95));
      ctx.fillRect(ctr[0] - hw, ctr[1] - 6 - gap * 0.15, hw * 2, 7 + gap * 0.12);
      ctx.fillStyle = rgba(mul([170, 80, 84], L.amb));
      ctx.beginPath(); ctx.ellipse(ctr[0], ctr[1] + gap * 1.0, hw * 0.6, gap * 0.35 + 2, 0, 0, M.TAU); ctx.fill();
      ctx.restore();
    }
    // upper lip
    ctx.beginPath();
    ctx.moveTo(lcorner[0], lcorner[1]);
    ctx.bezierCurveTo(lcorner[0] + hw * 0.4, bowL[1] + 2, bowL[0] - 4, bowL[1], bowL[0], bowL[1]);
    ctx.quadraticCurveTo(upTop[0], upTop[1] + 3, bowR[0], bowR[1]);
    ctx.bezierCurveTo(bowR[0] + 4, bowR[1], rcorner[0] - hw * 0.4, bowR[1] + 2, rcorner[0], rcorner[1]);
    ctx.quadraticCurveTo(ctr[0], ctr[1] - gap * 0.15 - 1, lcorner[0], lcorner[1]);
    ctx.fillStyle = rgba(mul(lipC, [230, 225, 225])); ctx.fill();
    // lower lip
    ctx.beginPath();
    ctx.moveTo(lcorner[0] + 3, lcorner[1] + 1);
    ctx.quadraticCurveTo(ctr[0], ctr[1] + gap * 1.15 + 1, rcorner[0] - 3, rcorner[1] + 1);
    ctx.bezierCurveTo(rcorner[0] - hw * 0.3, lowBot[1] - 2, lcorner[0] + hw * 0.3, lowBot[1] - 2, lcorner[0] + 3, lcorner[1] + 1);
    ctx.fillStyle = rgba(lipC); ctx.fill();
    ctx.save(); ctx.clip();
    const k = L.key || { x: 0, y: -1, a: 0.3, c: [255, 255, 255] };
    M.blot(ctx, ctr[0] + k.x * 6, lowBot[1] - 7, 14, 4, [255, 240, 235], 0.35 * (k.a + 0.2), 'lighter');
    ctx.restore();
    // corner + parting line
    ctx.strokeStyle = rgba(mul([90, 40, 40], L.amb), 0.8); ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(lcorner[0], lcorner[1]);
    ctx.quadraticCurveTo(ctr[0], ctr[1] + (open > 0.02 ? 0 : 1) - gap * 0.15, rcorner[0], rcorner[1]); ctx.stroke();
    if (smile > 0.1) {
      ctx.strokeStyle = rgba(mul(C.skinShade, L.amb), 0.5 * smile); ctx.lineWidth = 1.6;
      for (const c of [lcorner, rcorner]) { ctx.beginPath(); ctx.arc(c[0] + (c === lcorner ? -2 : 2), c[1] - 2, 5, c === lcorner ? 1.6 : -0.6, c === lcorner ? 3.6 : 1.4); ctx.stroke(); }
    }
  }

  function hairBackHer(ctx, L, yaw, o) {
    const C = M.HER, sh = Math.sin(yaw) * -30, sw = (o.hairSway || 0) * 8;
    const path = (c) => M.spline(c, [[0 + sh, -116], [66 + sh * 0.5, -100], [104, -40], [112 + sw, 60], [118 + sw, 170], [96 + sw, 210], [40, 200], [-40, 200], [-96 + sw, 210], [-118 + sw, 170], [-112 + sw, 60], [-104, -40], [-66 + sh * 0.5, -100]], true, 0.5);
    M.litFill(ctx, path, mul(C.hair, [210, 210, 210]), L, 0, 20, 150, { rimW: 0.02 });
  }
  function hairFrontHer(ctx, L, yaw, o) {
    const C = M.HER, sh = Math.sin(yaw) * 46, sw = (o.hairSway || 0) * 8;
    // crown + side-swept fringe + face-framing strands
    const pts = [[-86 + sh * 0.4, -10], [-90 + sh * 0.5, -70], [-62 + sh * 0.7, -112], [-10 + sh, -128], [52 + sh * 0.8, -116], [86 + sh * 0.5, -78],
      [92 + sh * 0.3, -10], [98 + sw, 70], [104 + sw, 148], [86 + sw, 150], [76 + sh * 0.2, 60], [70 + sh * 0.3, -20], [62 + sh * 0.5, -60],
      [40 + sh * 0.9, -54], [10 + sh, -66], [-26 + sh, -56], [-52 + sh * 0.8, -40], [-66 + sh * 0.5, -10], [-74 + sh * 0.2, 60], [-86 + sw, 150],
      [-102 + sw, 146], [-98 + sw, 70]];
    const path = (c) => M.spline(c, pts, true, 0.5);
    M.litFill(ctx, path, C.hair, L, 0, -60, 120, { rimW: 0.025 });
    ctx.save(); ctx.beginPath(); path(ctx); ctx.clip();
    const hi = mul(C.hairHi, L.amb);
    for (let i = 0; i < 30; i++) {
      const u = i / 29, x0 = lerp(-90, 90, u) + sh * 0.8;
      ctx.strokeStyle = rgba(hi, 0.16 + 0.12 * M.hash(i + 1)); ctx.lineWidth = 1 + M.hash(i * 3) * 1.6;
      ctx.beginPath(); ctx.moveTo(sh + 10, -128); ctx.quadraticCurveTo(x0 * 1.1, -90, x0 * 1.05 + (Math.abs(x0) > 60 ? Math.sign(x0) * 10 : 0), Math.abs(x0) > 60 ? 140 : -50);
      ctx.stroke();
    }
    if (L.key && L.key.a > 0.05) M.blot(ctx, sh + L.key.x * 40, -100, 70, 18, mul(C.hairHi, L.key.c, 1.5), 0.4 * L.key.a, 'lighter');
    ctx.restore();
  }
  function hairFrontHim(ctx, L, yaw, o) {
    const C = M.HIM, sh = Math.sin(yaw) * 40;
    const pts = [[-84 + sh * 0.4, -20], [-90 + sh * 0.5, -76], [-60 + sh * 0.7, -124], [0 + sh, -140], [64 + sh * 0.8, -122], [90 + sh * 0.5, -76], [86 + sh * 0.4, -20],
      [76 + sh * 0.4, -40], [60 + sh * 0.6, -66], [30 + sh * 0.9, -76], [0 + sh, -70], [-34 + sh * 0.9, -78], [-62 + sh * 0.6, -64], [-78 + sh * 0.4, -40]];
    const path = (c) => M.spline(c, pts, true, 0.5);
    M.litFill(ctx, path, C.hair, L, 0, -80, 110, { rimW: 0.03 });
    ctx.save(); ctx.beginPath(); path(ctx); ctx.clip();
    for (let i = 0; i < 22; i++) {
      const u = i / 21, x0 = lerp(-80, 80, u) + sh;
      ctx.strokeStyle = rgba(mul(C.hairHi, L.amb), 0.2); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x0 * 0.5 + sh * 0.5, -134); ctx.quadraticCurveTo(x0, -110, x0 * 1.05 + 6, -70); ctx.stroke();
    }
    ctx.restore();
  }

  // ================================================================ BODIES
  // seated, profile, facing +x; origin at the base of the neck. top: sweater colour
  M.torsoProfile = function (ctx, o) {
    const s = o.s || 1, dir = o.dir || 1, L = o.L;
    ctx.save();
    ctx.translate(o.x, o.y); ctx.scale(s * dir, s);
    ctx.rotate(o.lean || 0);
    const Ll = { amb: L.amb, key: L.key && { ...L.key, x: L.key.x * dir }, rim: L.rim && { ...L.rim, x: L.rim.x * dir } };
    const path = (c) => M.spline(c, [[-30, -6], [26, -4], [58, 40], [72, 120], [64, 220], [60, 330], [-74, 330], [-84, 220], [-82, 110], [-68, 30]], true, 0.5);
    M.litFill(ctx, path, o.top, Ll, 0, 140, 170, { rimW: 0.02 });
    // knit ribs / fold shading
    ctx.save(); ctx.beginPath(); path(ctx); ctx.clip();
    ctx.strokeStyle = rgba(mul(o.top, L.amb, 0.75), 0.35); ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-60 + i * 30, 60 + i * 12); ctx.quadraticCurveTo(-30 + i * 30, 140, -40 + i * 26, 260); ctx.stroke(); }
    ctx.restore();
    ctx.restore();
  };
  // arm from shoulder to hand target (local, before mirroring); draws upper arm + forearm + simple hand
  M.armProfile = function (ctx, o) {
    const s = o.s || 1, dir = o.dir || 1, L = o.L;
    ctx.save();
    ctx.translate(o.x, o.y); ctx.scale(s * dir, s);
    const Ll = { amb: L.amb, key: L.key && { ...L.key, x: L.key.x * dir }, rim: L.rim && { ...L.rim, x: L.rim.x * dir } };
    const [sx, sy] = o.sh, [hx, hy] = o.hand;
    const [ex, ey] = M.ik2(sx, sy, hx, hy, 150, 140, o.bend === undefined ? 1 : o.bend);
    const C = o.who === 'her' ? M.HER : M.HIM;
    M.litFill(ctx, (c) => { M.capsule(c, sx, sy, ex, ey, 34, 27); }, o.top, Ll, (sx + ex) / 2, (sy + ey) / 2, 110, { rimW: 0.03 });
    M.litFill(ctx, (c) => { M.capsule(c, ex, ey, hx, hy, 27, 21); }, o.top, Ll, (ex + hx) / 2, (ey + hy) / 2, 100, { rimW: 0.03 });
    // hand: a soft mitten pointing along the forearm
    const a = Math.atan2(hy - ey, hx - ex) + (o.handRot || 0);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(a);
    M.litFill(ctx, (c) => { c.ellipse(34, 2, 40, 18, 0, 0, M.TAU); c.moveTo(29.3, -24.5); c.ellipse(10, -14, 22, 9, -0.5, 0, M.TAU); }, C.skin, Ll, 30, 0, 50, { rimW: 0.04 });
    // cuff
    M.litFill(ctx, (c) => c.ellipse(-2, 0, 10, 23, 0, 0, M.TAU), o.top, Ll, 0, 0, 30);
    ctx.restore();
    ctx.restore();
    return [ex, ey];
  };

  // ================================================================ HANDS (close-up)
  // Back-of-hand view, fingers pointing along +x. o: {x, y, s, rot, curl[5] (0 flat…1 curled), spread, skin, L, sleeve}
  M.handTop = function (ctx, o) {
    const C = o.who === 'her' ? M.HER : M.HIM, L = o.L;
    const s = o.s || 1;
    ctx.save();
    ctx.translate(o.x, o.y); ctx.rotate(o.rot || 0); ctx.scale(s, s * (o.flip ? -1 : 1));
    const kr = (a, rot) => { const c = Math.cos(rot), sn = Math.sin(rot); return { ...a, x: a.x * c + a.y * sn, y: (-a.x * sn + a.y * c) * (o.flip ? -1 : 1) }; };
    const Ll = { amb: L.amb, key: L.key && kr(L.key, o.rot || 0), rim: L.rim && kr(L.rim, o.rot || 0) };
    const thin = o.who === 'her' ? 0.86 : 1;
    const curl = o.curl || [0, 0, 0, 0, 0], spread = o.spread || 0;
    // fingers: base y offsets across the knuckles, lengths
    const F = [[-40, 92, 13], [-14, 104, 13.5], [12, 98, 13], [36, 80, 11.5]];
    const tips = [];
    // palm
    const palm = (c) => M.spline(c, [[-70, -48 * thin], [10, -50 * thin], [60, -42 * thin], [70, 0], [62, 48 * thin], [10, 54 * thin], [-70, 46 * thin], [-90, 0]], true, 0.6);
    // fingers below the palm edge first (shadowed), then palm on top
    for (let i = 0; i < 4; i++) {
      const [by, len, r] = F[i];
      const cu = clamp(curl[i + 1] || 0);
      const ang = (i - 1.5) * 0.07 * (1 + spread * 3);
      const L1 = len * 0.55 * (1 - cu * 0.45), L2 = len * 0.45 * (1 - cu * 0.75);
      const x0 = 58, y0 = by * thin;
      const x1 = x0 + Math.cos(ang) * L1, y1 = y0 + Math.sin(ang) * L1;
      const x2 = x1 + Math.cos(ang) * L2, y2 = y1 + Math.sin(ang) * L2;
      tips.push([x2, y2]);
      const rr0 = r * thin;
      M.litFill(ctx, (c) => { M.capsule(c, x0, y0, x1, y1, rr0, rr0 * 0.92); c.moveTo(x1, y1); M.capsule(c, x1, y1, x2, y2, rr0 * 0.92, rr0 * 0.78); }, C.skin, Ll, (x0 + x2) / 2, y0, 60, { rimW: 0.035,
        extra: (c) => {
          M.blot(c, x1, y1, 10, 8, mul(C.skinShade, L.amb), 0.35);
          // nail
          if (cu < 0.6) {
            c.save(); c.translate(x2 - 9, y2); c.rotate(ang);
            M.rr(c, -9, -rr0 * 0.55, 16, rr0 * 1.1, rr0 * 0.5);
            c.fillStyle = rgba(mul([246, 214, 206], L.amb), 0.8); c.fill();
            c.restore();
          }
        } });
    }
    M.litFill(ctx, palm, C.skin, Ll, 0, 0, 90, {
      rimW: 0.02,
      extra: (c) => {
        // knuckles and tendons
        for (let i = 0; i < 4; i++) {
          M.blot(c, 52, F[i][0] * thin, 12, 10, mul(C.skin, L.amb, 1.06), 0.25, 'source-over');
          c.strokeStyle = rgba(mul(C.skinShade, L.amb), 0.07); c.lineWidth = 3;
          c.beginPath(); c.moveTo(-50, F[i][0] * thin * 0.5); c.lineTo(46, F[i][0] * thin); c.stroke();
        }
      },
    });
    // thumb
    const tc = clamp(curl[0] || 0);
    const ta = 0.95 - tc * 0.8 - spread * 0.3;
    const tx0 = -28, ty0 = 44 * thin, tx1 = tx0 + Math.cos(ta) * 60, ty1 = ty0 + Math.sin(ta) * 44, tx2 = tx1 + Math.cos(ta - 0.5) * 38, ty2 = ty1 + Math.sin(ta - 0.5) * 30;
    M.litFill(ctx, (c) => { M.capsule(c, tx0, ty0, tx1, ty1, 22 * thin, 15 * thin); c.moveTo(tx1, ty1); M.capsule(c, tx1, ty1, tx2, ty2, 15 * thin, 12 * thin); }, C.skin, Ll, tx1, ty1, 60, { rimW: 0.03 });
    // sleeve
    if (o.sleeve) {
      M.litFill(ctx, (c) => M.spline(c, [[-56, -68], [-38, 0], [-56, 70], [-300, 92], [-900, 120], [-900, -120], [-300, -90]], true, 0.4), o.sleeve, Ll, -200, 0, 200, { rimW: 0.012,
        extra: (c) => { c.strokeStyle = rgba(mul(o.sleeve, L.amb, 0.7), 0.5); c.lineWidth = 2; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-70 - i * 9, -62); c.lineTo(-70 - i * 9, 62); c.stroke(); } c.strokeStyle = rgba(mul(o.sleeve, L.amb, 0.75), 0.4); c.lineWidth = 6; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-160 - i * 120, -80); c.quadraticCurveTo(-200 - i * 120, 0, -150 - i * 130, 84); c.stroke(); } } });
    }
    ctx.restore();
    return tips;
  };

  // side view of a hand holding chopsticks, fingers toward +x. o: {x,y,s,rot,L,who,sleeve,pinch (0 open..1 closed), food:fn}
  M.chopHand = function (ctx, o) {
    const C = o.who === 'her' ? M.HER : M.HIM, L = o.L, s = o.s || 1;
    ctx.save();
    ctx.translate(o.x, o.y); ctx.rotate(o.rot || 0); ctx.scale(s, s);
    const kr = (a) => { const c = Math.cos(o.rot || 0), sn = Math.sin(o.rot || 0); return { ...a, x: a.x * c + a.y * sn, y: -a.x * sn + a.y * c }; };
    const Ll = { amb: L.amb, key: L.key && kr(L.key), rim: L.rim && kr(L.rim) };
    const pinch = clamp(o.pinch === undefined ? 1 : o.pinch);
    // chopsticks: pivot near the thumb web, tips at +x
    const tipX = 330, gapT = 16 * (1 - pinch) + 3;
    const stick = (y0, y1, w0, w1) => {
      ctx.beginPath(); ctx.moveTo(-40, y0 - w0); ctx.lineTo(tipX, y1 - w1); ctx.lineTo(tipX, y1 + w1); ctx.lineTo(-40, y0 + w0); ctx.closePath();
      ctx.fillStyle = M.lin(ctx, 0, y0 - w0, 0, y0 + w0, [[0, mul([236, 214, 170], L.amb, 1.15)], [1, mul([170, 138, 96], L.amb)]]);
      ctx.fill();
    };
    // food between the tips
    if (o.food) { ctx.save(); ctx.translate(tipX - 14, 22 - gapT * 0.2); o.food(ctx, Ll); ctx.restore(); }
    stick(30, 22 + gapT, 5.5, 3);
    // hand body (behind the upper stick)
    const hand = (c) => M.spline(c, [[-70, -50], [-10, -64], [40, -52], [72, -30], [96, -14], [104, 2], [80, 6], [52, 0], [30, 34], [-10, 58], [-70, 56], [-96, 0]], true, 0.55);
    M.litFill(ctx, hand, C.skin, Ll, 0, 0, 90, { rimW: 0.03,
      extra: (c) => {
        M.blot(c, 30, 20, 40, 20, mul(C.skinShade, L.amb), 0.35);
        c.strokeStyle = rgba(mul(C.skinShade, L.amb), 0.4); c.lineWidth = 2;
        c.beginPath(); c.moveTo(20, -40); c.quadraticCurveTo(40, -30, 56, -34); c.stroke();
        c.beginPath(); c.moveTo(-10, 30); c.quadraticCurveTo(10, 40, 30, 34); c.stroke();
      } });
    stick(-4, 16 - gapT * 0.2, 5.5, 3);
    // index finger over the top stick, thumb under
    M.litFill(ctx, (c) => { M.capsule(c, 30, -30, 92, -8, 14, 11); c.moveTo(92, -8); M.capsule(c, 92, -8, 128, 4 + pinch * 2, 11, 9); }, C.skin, Ll, 80, -10, 60, { rimW: 0.04 });
    M.litFill(ctx, (c) => { M.capsule(c, 6, 22, 66, 18, 16, 12); }, C.skin, Ll, 40, 20, 50, { rimW: 0.04 });
    if (o.sleeve) {
      M.litFill(ctx, (c) => M.spline(c, [[-66, -70], [-48, 0], [-66, 72], [-320, 96], [-1000, 130], [-1000, -130], [-320, -92]], true, 0.4), o.sleeve, Ll, -220, 0, 220, { rimW: 0.012,
        extra: (c) => { c.strokeStyle = rgba(mul(o.sleeve, L.amb, 0.72), 0.45); c.lineWidth = 7; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-150 - i * 130, -86); c.quadraticCurveTo(-200 - i * 130, 0, -140 - i * 140, 90); c.stroke(); } } });
    }
    ctx.restore();
  };
  // ================================================================ SEATED, FRONT VIEW
  // A figure seated behind a table, facing the camera: torso, head (faceFront), collar, forearms on the table.
  // o: {x, y (base of neck), s, who, top, L, twist (-1…1 body turn), lean (rad), head:{…faceFront opts}, hands:[[x,y],[x,y]] (world)}
  M.seatedFront = function (ctx, o) {
    const s = o.s, L = o.L, tw = o.twist || 0, C = o.who === 'her' ? M.HER : M.HIM;
    const wide = o.who === 'her' ? 0.9 : 1.06;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.lean || 0);
    ctx.scale(s, s);
    const sh = 150 * wide;
    const torso = (c) => M.spline(c, [[-sh * (1 - tw * 0.25), 34], [-sh * 0.4, -4], [sh * 0.4, -4], [sh * (1 + tw * 0.25) * 0.98, 34], [sh * 1.04, 120],
      [sh * 0.86, 340], [-sh * 0.86, 340], [-sh * 1.04, 120]], true, 0.45);
    M.litFill(ctx, torso, o.top, L, 0, 140, 190, { rimW: 0.02,
      extra: (c) => {
        M.blot(c, -tw * 80, 200, 120, 160, mul(o.top, L.amb, 0.75), 0.35);
        c.strokeStyle = rgba(mul(o.top, L.amb, 0.7), 0.4); c.lineWidth = 4;
        for (const k of [-1, 1]) { c.beginPath(); c.moveTo(k * 60 + tw * 30, 40); c.quadraticCurveTo(k * 80, 160, k * 70, 320); c.stroke(); }
      } });
    ctx.restore();
    // head
    const h = o.head || {};
    M.faceFront(ctx, Object.assign({ who: o.who, L, s: s * 0.94 }, h, {
      x: o.x + (h.dx || 0) * s + tw * 18 * s, y: o.y - 150 * s + (h.dy || 0) * s,
    }));
    ctx.save();
    ctx.translate(o.x, o.y); ctx.rotate(o.lean || 0); ctx.scale(s, s);
    // collar
    M.litFill(ctx, (c) => { c.moveTo(-58 + tw * 20, -6); c.quadraticCurveTo(tw * 20, 40, 58 + tw * 20, -6); c.quadraticCurveTo(tw * 20, 18, -58 + tw * 20, -6); },
      mul(o.top, [255, 255, 255], 0.9), L, 0, 10, 60);
    ctx.restore();
    if (o.hands && !o.armsLater) M.seatedArms(ctx, o);
  };
  // forearms resting on the table — drawn after the table top so the hands sit on it
  M.seatedArms = function (ctx, o) {
    const s = o.s, L = o.L, tw = o.twist || 0, C = o.who === 'her' ? M.HER : M.HIM;
    const sh = 150 * (o.who === 'her' ? 0.9 : 1.06);
    {
      for (let k = 0; k < 2; k++) {
        const hand = o.hands[k];
        if (!hand) continue;
        const side = k === 0 ? -1 : 1;
        const sx = o.x + side * sh * 0.9 * s + tw * 16 * s, sy = o.y + 40 * s;
        const [ex, ey] = M.ik2(sx, sy, hand[0], hand[1], 150 * s, 140 * s, side);
        M.litFill(ctx, (c) => { M.capsule(c, sx, sy, ex, ey, 34 * s, 28 * s); }, o.top, L, (sx + ex) / 2, (sy + ey) / 2, 110 * s, { rimW: 0.03 });
        M.litFill(ctx, (c) => { M.capsule(c, ex, ey, hand[0], hand[1], 28 * s, 22 * s); }, o.top, L, (ex + hand[0]) / 2, (ey + hand[1]) / 2, 100 * s, { rimW: 0.03 });
        M.litFill(ctx, (c) => { c.ellipse(hand[0] - side * 4 * s, hand[1] + 2 * s, 30 * s, 17 * s, side * 0.2, 0, M.TAU); }, C.skin, L, hand[0], hand[1], 34 * s, { rimW: 0.05 });
      }
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
