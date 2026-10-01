/*
 * The diner: S06–S15, plus S12 (the phone again) and the title card.
 *
 * One set, two lights:
 *   PAST — midday, sun pouring through the window behind them, warm bounce off the table
 *   NOW  — evening, a cold fluorescent pendant overhead, blue dusk in the window
 * The table, the bowls (the blue-rimmed bowl with little fish is his) and the camera
 * positions are shared, so S06 and S15 are the same frame with different distances in it.
 */
(function (G) {
  'use strict';
  const M = G.MY;
  const { clamp, lerp, ss, rgba, mul, easeOut, easeInOut, hash } = M;

  const SUN = [255, 224, 176];
  const TUBE = [222, 238, 240];          // fluorescent, slightly green
  const DUSK = [96, 124, 178];
  const WOOD = [184, 132, 88];
  const WALL = [236, 226, 204];
  const TILE = [150, 190, 172];          // mint-green wainscot tiles
  const HER_PAST = [218, 168, 74];       // mustard sweater
  const HIM_PAST = [92, 118, 150];       // denim shirt
  const HER_NOW = [96, 108, 104];        // grey-green coat
  const HIM_NOW = [150, 154, 160];       // grey sweater
  const BOWL_BLUE = [52, 92, 168];

  // ================================================================ PROPS
  // a bowl seen from above at an angle: r = rim radius, k = vertical squash
  M.bowl = function (ctx, x, y, r, o = {}) {
    const k = o.k || 0.42, L = o.L;
    const amb = L ? L.amb : [255, 255, 255];
    const glaze = mul([246, 244, 238], amb);
    ctx.save();
    ctx.translate(x, y);
    // contact shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(r * 0.08, r * k + r * 0.5, r * 0.85, r * k * 0.7, 0, 0, M.TAU); ctx.fill();
    // body
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.bezierCurveTo(-r * 0.98, r * 0.55, -r * 0.55, r * 0.78, -r * 0.34, r * 0.8);
    ctx.lineTo(r * 0.34, r * 0.8);
    ctx.bezierCurveTo(r * 0.55, r * 0.78, r * 0.98, r * 0.55, r, 0);
    ctx.ellipse(0, 0, r, r * k, 0, 0, Math.PI, false);
    ctx.closePath();
    ctx.fillStyle = M.lin(ctx, -r, 0, r, 0, [[0, mul(glaze, [255, 255, 255], 0.78)], [0.35, glaze], [0.7, mul(glaze, [255, 255, 255], 0.95)], [1, mul(glaze, [255, 255, 255], 0.7)]]);
    ctx.fill();
    // the blue band with fish, just under the rim
    if (o.fish) {
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = rgba(mul(BOWL_BLUE, amb)); ctx.lineWidth = r * 0.07;
      ctx.beginPath(); ctx.ellipse(0, r * 0.1, r * 0.99, r * k * 0.98 + r * 0.02, 0, 0.05, Math.PI - 0.05); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, r * 0.64, r * 0.62, r * 0.12, 0, 0.1, Math.PI - 0.1); ctx.stroke();
      ctx.fillStyle = rgba(mul(BOWL_BLUE, amb));
      for (let i = 0; i < 5; i++) {
        const a = 0.35 + i * 0.6, fx = Math.cos(a) * r * 0.82, fy = Math.sin(a) * r * k * 0.8 + r * 0.33;
        const dir = i % 2 ? 1 : -1;
        ctx.save(); ctx.translate(fx, fy); ctx.scale(dir * r / 90, r / 90);
        ctx.beginPath(); ctx.ellipse(0, 0, 9, 4.5, 0, 0, M.TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(14, -5); ctx.lineTo(14, 5); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
    // inside + contents
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * k, 0, 0, M.TAU); ctx.clip();
    ctx.fillStyle = mul(glaze, [255, 255, 255], 0.86) && rgba(mul(glaze, [255, 255, 255], 0.86));
    ctx.fill();
    ctx.fillStyle = M.lin(ctx, 0, -r * k, 0, r * k, [[0, [0, 0, 0], 0.25], [0.5, [0, 0, 0], 0.0]]);
    ctx.fillRect(-r, -r * k, r * 2, r * k * 2);
    if (o.fill) o.fill(ctx, r, k, amb);
    ctx.restore();
    // rim
    ctx.strokeStyle = rgba(mul([255, 255, 255], amb), 0.8); ctx.lineWidth = Math.max(1.2, r * 0.03);
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * k, 0, 0, M.TAU); ctx.stroke();
    if (o.fish) {
      ctx.strokeStyle = rgba(mul(BOWL_BLUE, amb), 0.9); ctx.lineWidth = Math.max(1, r * 0.025);
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.97, r * k * 0.95, 0, 0, M.TAU); ctx.stroke();
    }
    if (o.shine !== false) M.blot(ctx, -r * 0.55, r * 0.35, r * 0.18, r * 0.3, [255, 255, 255], 0.35, 'lighter');
    ctx.restore();
  };
  // rice with braised pork and greens on top
  M.riceFill = function (pork = 3, greens = true) {
    return (ctx, r, k, amb) => {
      ctx.fillStyle = rgba(mul([246, 242, 232], amb));
      ctx.beginPath(); ctx.ellipse(0, r * k * 0.25, r * 0.95, r * k * 0.9, 0, 0, M.TAU); ctx.fill();
      ctx.fillStyle = rgba(mul([220, 214, 200], amb), 0.7);
      for (let i = 0; i < 60; i++) {
        const a = hash(i) * M.TAU, d = Math.sqrt(hash(i + 7)) * 0.85;
        ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * d, Math.sin(a) * r * k * d + r * k * 0.2, r * 0.035, r * 0.018, a, 0, M.TAU); ctx.fill();
      }
      if (greens) M.greens(ctx, r * 0.35, r * k * 0.05, r * 0.42, amb, 0.6);
      for (let i = 0; i < pork; i++) M.pork(ctx, -r * 0.3 + i * r * 0.22, r * k * (0.1 + 0.25 * (i % 2)), r * 0.2, amb, i);
    };
  };
  M.pork = function (ctx, x, y, s, amb, seed = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate((hash(seed + 3) - 0.5) * 0.8);
    M.rr(ctx, -s, -s * 0.62, s * 2, s * 1.24, s * 0.35);
    ctx.fillStyle = rgba(mul([150, 64, 36], amb)); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = rgba(mul([226, 170, 120], amb), 0.85); ctx.fillRect(-s, -s * 0.62, s * 2, s * 0.3);
    ctx.fillStyle = rgba(mul([120, 48, 26], amb)); ctx.fillRect(-s, s * 0.05, s * 2, s * 0.25);
    M.blot(ctx, -s * 0.3, -s * 0.3, s * 0.6, s * 0.25, [255, 220, 180], 0.55, 'lighter');
    ctx.restore();
    ctx.restore();
  };
  M.greens = function (ctx, x, y, s, amb, a = 1) {
    ctx.save(); ctx.translate(x, y);
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.rotate(-0.6 + i * 0.4);
      ctx.fillStyle = rgba(mul(i % 2 ? [74, 136, 58] : [96, 160, 70], amb), a);
      ctx.beginPath(); ctx.ellipse(s * 0.4, 0, s * 0.55, s * 0.22, 0, 0, M.TAU); ctx.fill();
      ctx.strokeStyle = rgba(mul([190, 220, 150], amb), 0.6 * a); ctx.lineWidth = s * 0.04;
      ctx.beginPath(); ctx.moveTo(-s * 0.1, 0); ctx.lineTo(s * 0.9, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  };
  M.plate = function (ctx, x, y, r, o = {}) {
    const k = o.k || 0.4, amb = o.L ? o.L.amb : [255, 255, 255];
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(r * 0.05, r * k * 0.25, r * 1.0, r * k * 1.0, 0, 0, M.TAU); ctx.fill();
    ctx.fillStyle = rgba(mul([236, 234, 228], amb));
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * k, 0, 0, M.TAU); ctx.fill();
    ctx.fillStyle = rgba(mul([250, 250, 246], amb));
    ctx.beginPath(); ctx.ellipse(0, -r * k * 0.06, r * 0.72, r * k * 0.7, 0, 0, M.TAU); ctx.fill();
    if (o.fill) o.fill(ctx, r, k, amb);
    ctx.restore();
  };
  M.glass = function (ctx, x, y, r, h, o = {}) {
    const k = o.k || 0.38, amb = o.L ? o.L.amb : [255, 255, 255];
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(r * 0.3, h + r * k * 0.4, r * 1.1, r * k, 0, 0, M.TAU); ctx.fill();
    // body
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(-r * 0.86, h); ctx.ellipse(0, h, r * 0.86, r * k * 0.86, 0, Math.PI, 0, true); ctx.lineTo(r, 0); ctx.closePath();
    ctx.fillStyle = rgba(mul([210, 226, 230], amb), 0.22); ctx.fill();
    // water
    const wy = h * 0.35;
    ctx.beginPath(); ctx.moveTo(-r * 0.95, wy); ctx.lineTo(-r * 0.86, h); ctx.ellipse(0, h, r * 0.86, r * k * 0.86, 0, Math.PI, 0, true); ctx.lineTo(r * 0.95, wy); ctx.closePath();
    ctx.fillStyle = rgba(mul(o.tea ? [214, 170, 90] : [200, 220, 226], amb), o.tea ? 0.55 : 0.28); ctx.fill();
    ctx.strokeStyle = rgba(mul([255, 255, 255], amb), 0.5); ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.beginPath(); ctx.ellipse(0, wy, r * 0.95, r * k * 0.95, 0, 0, M.TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * k, 0, 0, M.TAU); ctx.stroke();
    // highlights
    ctx.strokeStyle = rgba([255, 255, 255], 0.55); ctx.lineWidth = r * 0.12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r * 0.62, h * 0.12); ctx.lineTo(-r * 0.55, h * 0.85); ctx.stroke();
    ctx.lineWidth = r * 0.05;
    ctx.beginPath(); ctx.moveTo(r * 0.62, h * 0.2); ctx.lineTo(r * 0.58, h * 0.7); ctx.stroke();
    ctx.restore();
  };
  M.chopsticks = function (ctx, x0, y0, x1, y1, w, amb, gap = 10) {
    for (const d of [0, gap]) {
      ctx.save();
      const a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0);
      ctx.translate(x0, y0 + d); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0, -w); ctx.lineTo(L, -w * 0.55); ctx.lineTo(L, w * 0.55); ctx.lineTo(0, w); ctx.closePath();
      ctx.fillStyle = M.lin(ctx, 0, -w, 0, w, [[0, mul([240, 220, 180], amb)], [1, mul([176, 142, 100], amb)]]);
      ctx.fill();
      ctx.restore();
    }
  };

  // ================================================================ THE WIDE FRAME (S06 / S15)
  function wideSet(ctx, now, t) {
    const amb = now ? [168, 176, 186] : [255, 246, 232];
    // ceiling band + upper wall
    ctx.fillStyle = rgba(mul(WALL, amb, now ? 0.9 : 1)); ctx.fillRect(-200, -200, 2400, 1600);
    // window: outside world, out of focus
    const wx0 = 150, wx1 = 1770, wy0 = 110, wy1 = 600;
    ctx.save();
    ctx.beginPath(); ctx.rect(wx0, wy0, wx1 - wx0, wy1 - wy0); ctx.clip();
    M.layer(ctx, 12, (c) => {
      if (!now) {
        c.fillStyle = M.lin(c, 0, wy0, 0, wy1, [[0, [255, 250, 236]], [0.5, [255, 238, 206]], [1, [236, 214, 176]]]);
        c.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
        // opposite building, awning, a tree in full sun
        c.fillStyle = 'rgb(244,226,196)'; c.fillRect(wx0, wy0 + 120, wx1 - wx0, 380);
        for (let i = 0; i < 9; i++) { c.fillStyle = 'rgba(160,140,120,0.5)'; c.fillRect(wx0 + 60 + i * 180, wy0 + 170, 90, 120); }
        c.fillStyle = 'rgb(96,150,110)'; c.fillRect(wx0 + 200, wy0 + 330, 520, 50);
        c.fillStyle = 'rgb(212,92,72)'; c.fillRect(wx0 + 1000, wy0 + 320, 380, 50);
        for (let i = 0; i < 40; i++) {
          const x = wx0 + 700 + hash(i) * 400 + Math.sin(t * 1.3 + i) * 4, y = wy0 + 20 + hash(i + 50) * 260;
          c.fillStyle = `rgba(${150 + hash(i + 2) * 80},${190 + hash(i + 3) * 50},${80 + hash(i + 4) * 40},0.85)`;
          c.beginPath(); c.arc(x, y, 40 + hash(i + 9) * 50, 0, M.TAU); c.fill();
        }
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
      } else {
        c.fillStyle = M.lin(c, 0, wy0, 0, wy1, [[0, [40, 58, 104]], [0.6, [66, 86, 132]], [1, [44, 54, 84]]]);
        c.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
        c.fillStyle = 'rgb(28,34,54)'; c.fillRect(wx0, wy0 + 120, wx1 - wx0, 380);
        for (let i = 0; i < 9; i++) { c.fillStyle = i % 3 === 1 ? 'rgba(255,214,150,0.55)' : 'rgba(80,96,130,0.5)'; c.fillRect(wx0 + 60 + i * 180, wy0 + 170, 90, 120); }
        for (let i = 0; i < 6; i++) {
          c.fillStyle = 'rgba(255,190,120,0.55)';
          c.beginPath(); c.arc(wx0 + 140 + i * 290, wy0 + 360 + (i % 2) * 30, 30, 0, M.TAU); c.fill();
        }
      }
    });
    ctx.restore();
    // window frame + mullions
    ctx.fillStyle = rgba(mul([226, 222, 212], amb, now ? 0.85 : 0.95));
    ctx.fillRect(wx0 - 22, wy0 - 22, wx1 - wx0 + 44, 22); ctx.fillRect(wx0 - 22, wy1, wx1 - wx0 + 44, 26);
    for (const x of [wx0 - 22, 690, 1220, wx1]) ctx.fillRect(x, wy0, 22, wy1 - wy0);
    ctx.fillRect(wx0, 240, wx1 - wx0, 12);
    // tiled wainscot under the sill
    ctx.fillStyle = rgba(mul(TILE, amb)); ctx.fillRect(-200, wy1 + 26, 2400, 600);
    ctx.strokeStyle = rgba(mul(TILE, amb, 0.8), 0.6); ctx.lineWidth = 2;
    for (let x = -200; x < 2200; x += 60) { ctx.beginPath(); ctx.moveTo(x, wy1 + 26); ctx.lineTo(x, 1300); ctx.stroke(); }
    for (let y = wy1 + 86; y < 1300; y += 60) { ctx.beginPath(); ctx.moveTo(-200, y); ctx.lineTo(2200, y); ctx.stroke(); }
    // bench back along the window
    ctx.fillStyle = rgba(mul([150, 84, 62], amb)); M.rr(ctx, 180, 610, 1560, 90, 18); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(180, 680, 1560, 20);
    // pendant lamp
    ctx.strokeStyle = rgba(mul([40, 40, 40], amb)); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(960, -100); ctx.lineTo(960, 40); ctx.stroke();
    ctx.fillStyle = rgba(mul(now ? [70, 80, 84] : [60, 90, 80], amb));
    ctx.beginPath(); ctx.moveTo(900, 86); ctx.lineTo(930, 40); ctx.lineTo(990, 40); ctx.lineTo(1020, 86); ctx.closePath(); ctx.fill();
    if (now) {
      ctx.fillStyle = 'rgb(240,252,250)';
      ctx.beginPath(); ctx.ellipse(960, 86, 60, 9, 0, 0, M.TAU); ctx.fill();
    }
  }
  function wideTable(ctx, now, t, extra) {
    const amb = now ? [176, 184, 192] : [255, 244, 226];
    // table: top surface from y 770 (back edge) to 880 (front edge), front apron below
    ctx.fillStyle = rgba(mul(WOOD, amb, 0.6)); ctx.fillRect(250, 878, 1420, 40);
    ctx.fillStyle = rgba(mul(WOOD, amb, 0.5));
    for (const x of [290, 1600]) ctx.fillRect(x, 900, 34, 300);
    ctx.beginPath(); ctx.moveTo(270, 770); ctx.lineTo(1650, 770); ctx.lineTo(1690, 880); ctx.lineTo(230, 880); ctx.closePath();
    ctx.fillStyle = M.lin(ctx, 0, 770, 0, 880, [[0, mul(WOOD, amb, 0.9)], [1, mul(WOOD, amb, 1.05)]]);
    ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = rgba(mul(WOOD, amb, 0.75), 0.35); ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) { const y = 776 + i * 9; ctx.beginPath(); ctx.moveTo(200, y); ctx.bezierCurveTo(700, y + 3 * Math.sin(i), 1200, y - 3, 1700, y + 2); ctx.stroke(); }
    if (!now) {
      // sun patches, cut by the mullions
      ctx.globalCompositeOperation = 'lighter';
      for (const [a, b] of [[380, 650], [760, 1180], [1290, 1640]]) {
        ctx.fillStyle = 'rgba(255,214,150,0.32)';
        ctx.beginPath(); ctx.moveTo(a, 770); ctx.lineTo(b, 770); ctx.lineTo(b + 60, 880); ctx.lineTo(a + 60, 880); ctx.closePath(); ctx.fill();
      }
    } else {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = M.rad(ctx, 960, 800, 0, 520, [[0, [200, 220, 220], 0.18], [1, [200, 220, 220], 0]]);
      ctx.fillRect(200, 760, 1500, 130);
    }
    ctx.restore();
    ctx.fillStyle = rgba(mul([255, 255, 255], amb), 0.18); ctx.fillRect(232, 876, 1456, 3);
    extra && extra(amb);
  }

  const L_PAST = (k = 1) => ({ amb: [214, 186, 164], key: { c: [255, 236, 210], a: 0.35 * k, x: 0.25, y: 0.6 }, rim: { c: [255, 232, 186], a: 0.95, x: 0, y: -1 } });
  const L_NOW = { amb: [160, 166, 176], key: { c: TUBE, a: 0.5, x: 0.05, y: -1 }, rim: { c: [150, 176, 226], a: 0.32, x: 0, y: -1 } };

  // ================================================================ S06 — they used to sit side by side
  M.def('S06', {
    draw(ctx, lt, dur) {
      const z = 1.0 + 0.03 * easeInOut(lt / dur);
      ctx.save();
      M.camera(ctx, { x: 960, y: 560, z, shake: M.shake(lt + 51, 0.35, 6) });
      wideSet(ctx, false, lt);
      // god rays + dust
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const [x, w] of [[300, 300], [820, 340], [1350, 300]]) {
        ctx.fillStyle = M.lin(ctx, 0, 120, 0, 900, [[0, [255, 230, 180], 0.16], [1, [255, 230, 180], 0]]);
        ctx.beginPath(); ctx.moveTo(x, 120); ctx.lineTo(x + w, 120); ctx.lineTo(x + w + 260, 900); ctx.lineTo(x + 260, 900); ctx.closePath(); ctx.fill();
      }
      for (let i = 0; i < 70; i++) {
        const x = (hash(i) * 1900 + lt * (6 + hash(i + 1) * 10) + Math.sin(lt * 0.8 + i) * 14) % 1920, y = 140 + hash(i + 2) * 700 + Math.sin(lt * 0.6 + i * 2) * 12;
        ctx.fillStyle = `rgba(255,236,200,${0.25 + 0.4 * hash(i + 3)})`;
        ctx.beginPath(); ctx.arc(x, y, 1.2 + hash(i + 4) * 2.4, 0, M.TAU); ctx.fill();
      }
      ctx.restore();
      // the two of them, shoulder to shoulder; she laughs, leaning in
      const laugh = Math.max(0, 1 - lt / 2.6), bob = Math.sin(lt * 15) * 4 * laugh;
      const L = L_PAST();
      const him = {
        x: 1080, y: 520, s: 0.86, who: 'him', top: HIM_PAST, L, twist: -0.3,
        head: { yaw: -0.4, tilt: -0.05, gaze: [-0.9, 0.1], mouth: { smile: 0.8, open: 0.1 }, cheek: 0.12 },
        hands: [[1004, 820], [1160, 834]], armsLater: true,
      };
      const her = {
        x: 850, y: 528 + bob * 0.5, s: 0.84, who: 'her', top: HER_PAST, L, twist: 0.45, lean: 0.06,
        head: { yaw: 0.55, tilt: 0.16 + bob * 0.004, smileEyes: 1, mouth: { smile: 1, open: 0.35 + 0.15 * Math.abs(Math.sin(lt * 15)) * laugh }, dy: bob, cheek: 0.28 },
        hands: [[770, 836], [936, 822]], armsLater: true,
      };
      M.seatedFront(ctx, him);
      M.seatedFront(ctx, her);
      wideTable(ctx, false, lt, (amb) => {
        M.plate(ctx, 680, 806, 64, { L: { amb }, fill: (c, r, k, a) => { M.greens(c, -20, -4, 34, a); M.greens(c, 16, 2, 30, a); } });
        M.plate(ctx, 960, 798, 70, { L: { amb }, fill: (c, r, k, a) => { for (let i = 0; i < 6; i++) M.pork(c, -36 + (i % 3) * 30, -6 + Math.floor(i / 3) * 12, 14, a, i); } });
        M.bowl(ctx, 820, 838, 48, { L: { amb }, fill: M.riceFill(1, false) });
        M.bowl(ctx, 1110, 840, 50, { L: { amb }, fish: true, fill: M.riceFill(2, true) });
        M.glass(ctx, 560, 800, 22, 50, { L: { amb }, tea: true });
        M.glass(ctx, 1290, 806, 22, 50, { L: { amb }, tea: true });
        M.chopsticks(ctx, 1150, 846, 1290, 860, 3.2, amb, 7);
        M.chopsticks(ctx, 860, 850, 760, 872, 3.2, amb, 7);
        M.seatedArms(ctx, him);
        M.seatedArms(ctx, her);
      });
      ctx.restore();
    },
    grade: (lt) => ({
      expo: 1.0 + 0.55 * Math.exp(-lt * 5.5), temp: 0.42, tint: 0.02, sat: 1.06, con: 0.98, lift: [0.035, 0.022, 0.0], gain: [1.02, 1.0, 0.96],
      bloom: 0.55, thresh: 0.66, mist: 0.32, hal: 0.4, vig: 0.38, grain: 0.03, flash: 0.22 * Math.exp(-lt * 9),
    }),
    events: () => [{ t: 0.05, type: 'laugh', dur: 2.2 }],
  });

  // ================================================================ S07 — from his bowl, without asking
  M.def('S07', {
    draw(ctx, lt, dur) {
      ctx.save();
      M.camera(ctx, { x: 960, y: 540, z: 1.0 + 0.02 * lt / dur, shake: M.shake(lt + 61, 0.4, 7) });
      const amb = [255, 244, 228];
      // table top, close; sun stripes across it
      ctx.fillStyle = M.lin(ctx, 0, 0, 0, 1080, [[0, mul(WOOD, amb, 0.85)], [1, mul(WOOD, amb, 1.08)]]);
      ctx.fillRect(-200, -200, 2400, 1500);
      ctx.strokeStyle = rgba(mul(WOOD, amb, 0.72), 0.35); ctx.lineWidth = 4;
      for (let i = 0; i < 22; i++) { const y = -100 + i * 60; ctx.beginPath(); ctx.moveTo(-200, y); ctx.bezierCurveTo(500, y + 14 * Math.sin(i), 1300, y - 10, 2200, y + 8); ctx.stroke(); }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const [a, b] of [[-200, 520], [700, 1500]]) {
        ctx.fillStyle = 'rgba(255,210,140,0.22)';
        ctx.beginPath(); ctx.moveTo(a, -200); ctx.lineTo(b, -200); ctx.lineTo(b + 500, 1300); ctx.lineTo(a + 500, 1300); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      // his hand nudges the bowl toward her (without looking)
      const push = easeInOut((lt - 0.95) / 0.7);
      const bx = 1130 - push * 150, by = 560 + push * 10;
      // their sleeves at the top of frame, out of focus: mustard and denim, touching
      M.layer(ctx, 18, (c) => {
        c.fillStyle = rgba(mul(HER_PAST, amb)); c.beginPath(); c.ellipse(560, -60, 520, 200, 0.1, 0, M.TAU); c.fill();
        c.fillStyle = rgba(mul(HIM_PAST, amb)); c.beginPath(); c.ellipse(1400, -70, 520, 200, -0.1, 0, M.TAU); c.fill();
      });
      // her bowl (left)
      M.bowl(ctx, 520, 620, 150, { k: 0.5, L: { amb }, fill: M.riceFill(0, false) });
      // steam
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const ph = (lt * 0.35 + i / 5) % 1;
        ctx.strokeStyle = `rgba(255,250,240,${0.12 * Math.sin(ph * Math.PI)})`; ctx.lineWidth = 26; ctx.lineCap = 'round';
        ctx.filter = `blur(${10 * M.SC}px)`;
        const x = bx - 60 + i * 30;
        ctx.beginPath(); ctx.moveTo(x, by - 40 - ph * 200); ctx.bezierCurveTo(x + 30, by - 90 - ph * 260, x - 30, by - 140 - ph * 300, x + 10, by - 200 - ph * 340); ctx.stroke();
      }
      ctx.restore();
      // his bowl with the fish rim
      const taken = lt > 1.0;
      M.bowl(ctx, bx, by, 160, { k: 0.5, L: { amb }, fish: true, fill: M.riceFill(taken ? 2 : 3, true) });
      // his hand on the bowl's far side
      M.handTop(ctx, {
        x: bx + 220, y: by - 10, s: 1.15, rot: Math.PI + 0.25, flip: true, who: 'him',
        L: { amb: [236, 214, 196], key: { c: SUN, a: 0.5, x: -0.3, y: -0.9 }, rim: { c: [255, 236, 200], a: 0.5, x: 0, y: -1 } },
        curl: [0.3, 0.35, 0.4, 0.45, 0.5], sleeve: HIM_PAST,
      });
      // her chopsticks: in, pinch a piece of pork, back out to the left
      const reach = lt < 0.75 ? easeInOut(lt / 0.75) : 1 - easeInOut((lt - 0.9) / 0.6);
      const pinch = clamp((lt - 0.6) / 0.12);
      const hx = lerp(80, 640 - push * 30, reach), hy = lerp(760, 610, reach) - Math.sin(reach * Math.PI) * 40;
      M.chopHand(ctx, {
        x: hx, y: hy, s: 1.25, rot: -0.12, who: 'her', pinch: lt < 0.6 ? 0 : 1,
        L: { amb: [240, 216, 196], key: { c: SUN, a: 0.6, x: 0.2, y: -1 }, rim: { c: [255, 236, 200], a: 0.6, x: 0.3, y: -1 } },
        sleeve: HER_PAST,
        food: lt > 0.66 ? (c, L2) => M.pork(c, 0, 0, 20, L2.amb, 2) : null,
      });
      ctx.restore();
    },
    grade: { expo: 1.05, temp: 0.4, tint: 0.02, sat: 1.06, con: 0.98, lift: [0.035, 0.022, 0.0], gain: [1.02, 1.0, 0.96], bloom: 0.5, thresh: 0.68, mist: 0.3, hal: 0.38, vig: 0.38, grain: 0.03 },
    events: () => [{ t: 0.66, type: 'pick' }, { t: 1.0, type: 'bowl', dur: 0.6 }],
  });

  // ================================================================ S08 — he gets serious
  // Camera at the short end of the table: she screen-left facing right, he screen-right facing left.
  function sideSet(ctx, amb) {
    // the far wall at the end of the table, out of focus
    M.layer(ctx, 9, (c) => {
      c.fillStyle = rgba(mul(WALL, amb, 0.86)); c.fillRect(-200, -200, 2400, 1500);
      c.fillStyle = rgba(mul(TILE, amb, 0.9)); c.fillRect(-200, 560, 2400, 700);
      // window on her side (left), dusk
      c.fillStyle = M.lin(c, 0, 80, 0, 560, [[0, [42, 60, 106]], [1, [70, 90, 136]]]); c.fillRect(-200, 60, 470, 500);
      c.fillStyle = 'rgba(255,190,120,0.5)'; c.beginPath(); c.arc(80, 380, 24, 0, M.TAU); c.fill();
      c.fillStyle = rgba(mul([220, 216, 206], amb, 0.8)); c.fillRect(260, 60, 20, 500);
      // menu board and counter at the back
      c.fillStyle = rgba(mul([46, 52, 50], amb)); c.fillRect(760, 120, 420, 220);
      c.fillStyle = rgba(mul([220, 230, 220], amb), 0.5);
      for (let i = 0; i < 6; i++) c.fillRect(800, 150 + i * 30, 120 + hash(i) * 200, 8);
      c.fillStyle = rgba(mul([140, 96, 70], amb)); c.fillRect(1240, 380, 700, 260);
      c.fillStyle = rgba(mul([200, 200, 196], amb)); c.fillRect(1240, 370, 700, 16);
      // an empty table further back
      c.fillStyle = rgba(mul(WOOD, amb, 0.8)); c.fillRect(1500, 600, 300, 30);
    });
    // pendant lamp over the table
    ctx.strokeStyle = 'rgba(30,30,30,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(960, -100); ctx.lineTo(960, 120); ctx.stroke();
    ctx.fillStyle = rgba(mul([70, 80, 84], amb));
    ctx.beginPath(); ctx.moveTo(880, 190); ctx.lineTo(920, 120); ctx.lineTo(1000, 120); ctx.lineTo(1040, 190); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgb(240,252,250)'; ctx.beginPath(); ctx.ellipse(960, 190, 80, 12, 0, 0, M.TAU); ctx.fill();
  }
  function sideTable(ctx, amb) {
    ctx.beginPath(); ctx.moveTo(700, 620); ctx.lineTo(1220, 620); ctx.lineTo(2100, 1180); ctx.lineTo(-180, 1180); ctx.closePath();
    ctx.fillStyle = M.lin(ctx, 0, 620, 0, 1180, [[0, mul(WOOD, amb, 0.78)], [1, mul(WOOD, amb, 1.0)]]);
    ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = rgba(mul(WOOD, amb, 0.7), 0.35); ctx.lineWidth = 3;
    for (let i = 0; i < 14; i++) { const u = i / 13; ctx.beginPath(); ctx.moveTo(lerp(720, 1200, u), 620); ctx.lineTo(lerp(-160, 2080, u), 1180); ctx.stroke(); }
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = M.rad(ctx, 960, 760, 0, 600, [[0, [200, 224, 224], 0.2], [1, [200, 224, 224], 0]]);
    ctx.fillRect(0, 600, 1920, 600);
    ctx.restore();
  }
  M.def('S08', {
    draw(ctx, lt, dur) {
      ctx.save();
      M.camera(ctx, { x: 960, y: 540, z: 1.0 + 0.04 * easeInOut(lt / dur), shake: M.shake(lt + 71, 0.35, 8) });
      const amb = [176, 184, 192];
      sideSet(ctx, amb);
      const Lher = { amb: [150, 158, 170], key: { c: TUBE, a: 0.5, x: 0.2, y: -1 }, rim: { c: [150, 180, 230], a: 0.45, x: -1, y: -0.2 } };
      const Lhim = { amb: [150, 158, 170], key: { c: TUBE, a: 0.55, x: -0.6, y: -0.8 }, rim: { c: [150, 180, 230], a: 0.3, x: -1, y: -0.2 } };
      // her: profile, facing right
      M.torsoProfile(ctx, { x: 540, y: 500, s: 1.0, L: Lher, top: HER_NOW, lean: 0.04 });
      M.profileHead(ctx, { x: 552, y: 362, s: 1.0, who: 'her', L: Lher, gaze: [0.4, 0.2], blink: lt > 2.2 && lt < 2.32 ? 0.1 : 1 });
      // him: profile, facing left; leans in as he reaches
      const put = easeInOut((lt - 0.15) / 0.5), reach = easeInOut((lt - 0.8) / 1.0);
      const lean = 0.16 * reach;
      M.torsoProfile(ctx, { x: 1390, y: 492, s: 1.04, dir: -1, L: Lhim, top: HIM_NOW, lean });
      M.profileHead(ctx, { x: 1380 - reach * 44, y: 350 + reach * 10, s: 1.04, dir: -1, who: 'him', L: Lhim, gaze: [0.3, 0.1], tilt: reach * 0.04 });
      sideTable(ctx, amb);
      // dishes in perspective
      M.plate(ctx, 960, 700, 70, { k: 0.3, L: { amb } , fill: (c, r, k, a) => { for (let i = 0; i < 4; i++) M.pork(c, -24 + i * 16, -4 + (i % 2) * 6, 10, a, i); } });
      M.bowl(ctx, 700, 800, 66, { k: 0.34, L: { amb }, fill: M.riceFill(0, false) });
      M.bowl(ctx, 1190, 790, 70, { k: 0.34, L: { amb }, fish: true, fill: M.riceFill(1, true) });
      M.glass(ctx, 610, 760, 22, 56, { L: { amb } });
      // his chopsticks: from his hand onto the table by his bowl
      const ch0 = [lerp(1170, 1150, put), lerp(850, 860, put)];
      M.chopsticks(ctx, ch0[0], ch0[1], ch0[0] + 170, ch0[1] + 30 - put * 20, 4, amb, 9);
      // her hand resting on the table; his hand comes across and covers it
      const herHand = [850, 896];
      M.armProfile(ctx, { x: 540, y: 500, s: 1.0, L: Lher, top: HER_NOW, who: 'her', sh: [10, 40], hand: [herHand[0] - 540, herHand[1] - 500], bend: 1 });
      const hand0 = [1210, 900], hand1 = [herHand[0] + 40, herHand[1] - 12];
      const hand = [lerp(hand0[0], hand1[0], reach), lerp(hand0[1], hand1[1], reach) - Math.sin(reach * Math.PI) * 34];
      const shx = 1390 - 60 * reach, shy = 492 + 14 * reach;
      M.armProfile(ctx, { x: shx, y: shy, s: 1.04, dir: -1, L: Lhim, top: HIM_NOW, who: 'him', sh: [10, 40], hand: [(shx - hand[0]) / 1.04, (hand[1] - shy) / 1.04], bend: 1 });
      ctx.restore();
    },
    grade: { expo: 1.0, temp: -0.3, tint: -0.1, sat: 0.82, con: 1.08, lift: [0.0, 0.015, 0.03], bloom: 0.32, thresh: 0.74, vig: 0.45, grain: 0.034 },
    events: () => [{ t: 0.55, type: 'chopsticks' }, { t: 1.6, type: 'cloth' }],
  });

  // ================================================================ S09 — she slides her hand out
  M.def('S09', {
    draw(ctx, lt, dur) {
      ctx.save();
      M.camera(ctx, { x: 960, y: 540, z: 1.0 + 0.02 * lt / dur, shake: M.shake(lt + 81, 0.35, 9) });
      const amb = [178, 186, 194];
      ctx.fillStyle = M.lin(ctx, 0, 0, 1920, 1080, [[0, mul(WOOD, amb, 0.85)], [1, mul(WOOD, amb, 1.0)]]);
      ctx.fillRect(-200, -200, 2400, 1500);
      ctx.strokeStyle = rgba(mul(WOOD, amb, 0.7), 0.3); ctx.lineWidth = 4;
      for (let i = 0; i < 22; i++) { const y = -100 + i * 60; ctx.beginPath(); ctx.moveTo(-200, y + 20); ctx.bezierCurveTo(500, y + 10 * Math.sin(i), 1300, y - 10, 2200, y + 30); ctx.stroke(); }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = M.rad(ctx, 1000, 400, 0, 900, [[0, [210, 230, 230], 0.18], [1, [210, 230, 230], 0]]); ctx.fillRect(-200, -200, 2400, 1500);
      ctx.restore();
      const L = { amb: [176, 182, 192], key: { c: TUBE, a: 0.55, x: 0.1, y: -1 }, rim: { c: [220, 236, 240], a: 0.4, x: 0, y: -1 } };
      // her hand slides out from under his and goes for the glass
      const slide = easeInOut((lt - 0.2) / 1.0), grab = easeInOut((lt - 1.15) / 0.35), lift = easeInOut((lt - 1.5) / 0.4);
      const gx = 470 + grab * 30, gy = 330 - lift * 18;
      M.glass(ctx, gx, gy - 70, 64, 150, { L, k: 0.4 });
      const hx = lerp(760, 300, slide), hy = lerp(600, 470, slide) + Math.sin(slide * Math.PI) * 30;
      M.handTop(ctx, { x: hx, y: hy, s: 1.7, rot: lerp(0.05, -0.55, slide), who: 'her', L,
        curl: [0.1 + grab * 0.4, 0.1 + grab * 0.55, 0.12 + grab * 0.6, 0.15 + grab * 0.62, 0.2 + grab * 0.65], spread: 0.05, sleeve: HER_NOW });
      // his hand: stays where it was, then the fingers close a little on nothing
      const close = easeInOut((lt - 1.0) / 0.9);
      const sink = slide * 14;
      M.handTop(ctx, { x: 1120, y: 560 + sink, s: 1.9, rot: Math.PI - 0.08, flip: true, who: 'him', L,
        curl: [0.15, 0.1 + close * 0.3, 0.12 + close * 0.32, 0.14 + close * 0.34, 0.16 + close * 0.36], sleeve: HIM_NOW });
      ctx.restore();
    },
    grade: { expo: 1.0, temp: -0.3, tint: -0.1, sat: 0.8, con: 1.08, lift: [0.0, 0.015, 0.03], bloom: 0.3, thresh: 0.74, vig: 0.5, grain: 0.034 },
    events: () => [{ t: 0.25, type: 'slide', dur: 0.9 }, { t: 1.48, type: 'clink' }],
  });

  // ================================================================ S10 — she starts finding fault
  M.def('S10', {
    draw(ctx, lt, dur) {
      ctx.save();
      M.camera(ctx, { x: 960, y: 540, z: 1.0 + 0.05 * easeInOut(lt / dur), shake: M.shake(lt + 91, 0.4, 10) });
      const amb = [176, 184, 192];
      M.layer(ctx, 16, (c) => {
        c.fillStyle = rgba(mul(WALL, amb, 0.8)); c.fillRect(-200, -200, 2400, 1500);
        c.fillStyle = M.lin(c, 0, 0, 0, 700, [[0, [42, 60, 106]], [1, [70, 90, 136]]]); c.fillRect(-200, 0, 560, 700);
        c.fillStyle = rgba(mul(TILE, amb, 0.85)); c.fillRect(-200, 760, 2400, 600);
        c.fillStyle = 'rgba(255,190,120,0.5)'; c.beginPath(); c.arc(140, 300, 40, 0, M.TAU); c.fill();
      });
      const narrow = easeInOut((lt - 0.55) / 1.1);
      const L = { amb: [158, 166, 178], key: { c: TUBE, a: 0.55, x: 0.35, y: -0.95 }, rim: { c: [150, 180, 232], a: 0.5, x: -1, y: -0.3 } };
      M.seatedFront(ctx, {
        x: 760, y: 900, s: 2.15, who: 'her', top: HER_NOW, L, twist: 0.4,
        head: { yaw: 0.48, tilt: 0.02, gaze: [0.85, 0.05], lid: 0.12 + narrow * 0.42, lowLid: narrow * 0.5, brow: narrow * 0.35, browIn: narrow * 0.8,
          mouth: { press: narrow * 0.6 }, cheek: 0.06, blink: lt > 0.25 && lt < 0.37 ? 0.15 : 1 },
      });
      // his shoulder and the back of his head, very close and soft
      M.layer(ctx, 34, (c) => {
        c.fillStyle = rgba(mul(HIM_NOW, [120, 124, 132])); c.beginPath(); c.ellipse(1700, 1000, 460, 380, -0.2, 0, M.TAU); c.fill();
        c.fillStyle = rgba(mul(M.HIM.hair, [255, 255, 255], 1.2)); c.beginPath(); c.ellipse(1880, 360, 260, 330, 0, 0, M.TAU); c.fill();
      });
      ctx.restore();
    },
    grade: { expo: 1.0, temp: -0.3, tint: -0.1, sat: 0.82, con: 1.08, lift: [0.0, 0.015, 0.03], bloom: 0.3, thresh: 0.74, vig: 0.48, grain: 0.034 },
  });

  // ================================================================ S11 — the way he talks
  // syllables: [start, length, openness]
  const SYL = [];
  { let t = 0.08; let i = 0; while (t < 1.95) { const len = 0.09 + hash(i + 1) * 0.1; SYL.push([t, len, 0.35 + hash(i + 5) * 0.65]); t += len + (hash(i + 9) < 0.18 ? 0.14 : 0.025); i++; } }
  function mouthOpen(lt) {
    let v = 0;
    for (const [t0, len, a] of SYL) { const u = (lt - t0) / len; if (u > 0 && u < 1) v = Math.max(v, a * Math.sin(u * Math.PI)); }
    return v;
  }
  M.def('S11', {
    draw(ctx, lt, dur) {
      ctx.save();
      M.camera(ctx, { x: 960, y: 560, z: 1.0 + 0.06 * easeInOut(lt / dur), shake: M.shake(lt + 101, 0.45, 11) });
      const amb = [170, 178, 186];
      M.layer(ctx, 22, (c) => {
        c.fillStyle = rgba(mul(WALL, amb, 0.8)); c.fillRect(-200, -200, 2400, 1500);
        c.fillStyle = rgba(mul([140, 96, 70], amb)); c.fillRect(1300, 500, 900, 700);
      });
      const op = mouthOpen(lt);
      const L = { amb: [162, 168, 178], key: { c: TUBE, a: 0.65, x: 0.1, y: -1 }, rim: { c: [160, 186, 230], a: 0.3, x: 1, y: -0.3 } };
      const S = 6.2;
      // sweater collar at the bottom of frame
      M.litFill(ctx, (c) => M.spline(c, [[200, 1300], [420, 1010], [960, 960], [1500, 1010], [1720, 1300]], true, 0.5), HIM_NOW, L, 960, 1100, 600);
      M.faceFront(ctx, {
        x: 960, y: 560 - 72 * S, s: S, who: 'him', L, yaw: -0.1, tilt: -0.015, mouth: { open: op * 0.75, wide: op * 0.3 }, cheek: 0.04,
        after: (c, sx) => {
          // stubble on the upper lip, chin and jaw
          c.fillStyle = 'rgba(46,34,30,0.2)';
          for (let i = 0; i < 900; i++) {
            const y = 52 + hash(i) * 58, w = 70 - (y - 52) * 0.6;
            const x = (hash(i + 3) * 2 - 1) * w;
            if (Math.abs(x) < 34 && y > 58 && y < 88 + op * 20) continue;
            const p = sx(x, y + (y > 75 ? op * 16 : 0), 60);
            c.fillRect(p[0], p[1], 0.6, 0.6);
          }
        },
      });
      ctx.restore();
    },
    grade: { expo: 1.0, temp: -0.28, tint: -0.1, sat: 0.84, con: 1.12, lift: [0.0, 0.015, 0.03], bloom: 0.28, thresh: 0.76, vig: 0.5, grain: 0.036 },
    events: () => SYL.map(([t, len, a]) => ({ t, type: 'syl', dur: len, a })),
  });

  // ================================================================ S12 — he replies too fast
  const S12_MSGS = [
    { side: 'time', text: '22:31' },
    { side: 'r', text: '到家了', at: 0.12, stamp: '22:31' },
    { side: 'l', text: '好', at: 0.56, stamp: '22:31' },
    { side: 'l', text: '早点睡', at: 0.74, stamp: '22:31' },
    { side: 'l', text: '想你', at: 0.92, stamp: '22:31' },
  ];
  M.def('S12', {
    draw(ctx, lt, dur) {
      ctx.save();
      M.camera(ctx, { x: 960, y: 540, z: 1.0 + 0.05 * easeInOut(lt / dur), r: 0.02, shake: M.shake(lt + 111, 0.45, 12) });
      ctx.fillStyle = '#0d0f16'; ctx.fillRect(-200, -200, 2400, 1500);
      M.layer(ctx, 22, (c) => {
        c.fillStyle = 'rgb(46,40,44)'; c.fillRect(-200, -200, 2400, 1500);
        c.fillStyle = 'rgba(255,190,130,0.35)'; c.beginPath(); c.arc(260, 200, 120, 0, M.TAU); c.fill();
        c.fillStyle = 'rgb(120,116,120)'; c.beginPath(); c.ellipse(1600, 1000, 400, 260, -0.4, 0, M.TAU); c.fill();
      });
      M.lightMap(ctx, [40, 40, 52], [{ x: 960, y: 560, r: 1200, c: [196, 212, 255], a: 1.0 }, { x: 260, y: 200, r: 700, c: [255, 200, 150], a: 0.5 }]);
      M.phone(ctx, 580, -620, 760, 0, (q) => M.chatScreen(q, { t: lt, msgs: S12_MSGS, time: '22:31', keyboard: false }));
      ctx.restore();
    },
    grade: { expo: 0.9, temp: -0.18, tint: 0.0, sat: 0.92, con: 1.05, lift: [0.0, 0.01, 0.03], bloom: 0.25, thresh: 0.82, vig: 0.52, grain: 0.036 },
    events: () => [{ t: 0.12, type: 'sent' }, { t: 0.56, type: 'ping' }, { t: 0.74, type: 'ping' }, { t: 0.92, type: 'ping' }],
  });

  // ================================================================ S13 — the sound of him eating
  const CHEW = 2.45;   // chews per second
  M.def('S13', {
    draw(ctx, lt, dur) {
      ctx.save();
      M.camera(ctx, { x: 960, y: 540, z: 1.0 + 0.09 * easeInOut(lt / dur), shake: M.shake(lt + 121, 0.5, 13) });
      const amb = [170, 178, 186];
      M.layer(ctx, 20, (c) => {
        c.fillStyle = rgba(mul(WALL, amb, 0.78)); c.fillRect(-200, -200, 2400, 1500);
        c.fillStyle = M.lin(c, 0, 0, 0, 700, [[0, [42, 60, 106]], [1, [70, 90, 136]]]); c.fillRect(-200, 0, 460, 640);
        c.fillStyle = rgba(mul(TILE, amb, 0.85)); c.fillRect(-200, 700, 2400, 600);
      });
      const ph = lt * CHEW * M.TAU;
      const jaw = 0.035 + 0.035 * Math.sin(ph);
      const L = { amb: [160, 166, 176], key: { c: TUBE, a: 0.6, x: -0.3, y: -0.95 }, rim: { c: [150, 180, 232], a: 0.5, x: -1, y: -0.1 } };
      M.torsoProfile(ctx, { x: 1240, y: 1040, s: 3.4, dir: -1, L, top: HIM_NOW, lean: 0.06 });
      M.profileHead(ctx, { x: 1180, y: 430, s: 3.4, dir: -1, who: 'him', L, jaw, gaze: [0.2, 0.6], blink: 1, tilt: 0.06 });
      // the masseter working under the cheek
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      M.blot(ctx, 1180 - 6 * 3.4, 430 + 40 * 3.4 + Math.sin(ph) * 8, 70, 50, [120, 110, 100], 0.12 + 0.1 * Math.max(0, Math.sin(ph)));
      ctx.restore();
      // the same bowl as S07, at the bottom of frame
      M.layer(ctx, 6, (c) => {
        M.bowl(c, 640, 1020, 300, { k: 0.36, L: { amb }, fish: true, fill: M.riceFill(1, true) });
      });
      ctx.restore();
    },
    grade: { expo: 1.0, temp: -0.3, tint: -0.1, sat: 0.8, con: 1.14, lift: [0.0, 0.015, 0.03], bloom: 0.28, thresh: 0.76, vig: 0.56, grain: 0.038 },
    events: () => { const ev = []; for (let t = 0.05; t < 2.2; t += 1 / CHEW) ev.push({ t: t + 0.25 / CHEW, type: 'chew' }); return ev; },
  });

  // ================================================================ S14 — her chopsticks stop in mid-air
  M.def('S14', {
    draw(ctx, lt, dur) {
      ctx.save();
      M.camera(ctx, { x: 960, y: 540, z: 1.0 + 0.02 * lt / dur, shake: M.shake(lt + 131, 0.3, 14) });
      const amb = [170, 178, 186];
      M.layer(ctx, 24, (c) => {
        c.fillStyle = rgba(mul(WALL, amb, 0.78)); c.fillRect(-200, -200, 2400, 1500);
        c.fillStyle = rgba(mul(WOOD, amb, 0.8)); c.fillRect(-200, 760, 2400, 600);
        c.fillStyle = rgba(mul(HIM_NOW, [150, 156, 166])); c.beginPath(); c.ellipse(1560, 640, 260, 420, 0, 0, M.TAU); c.fill();
        c.fillStyle = rgba(mul(M.HIM.skin, [150, 156, 166])); c.beginPath(); c.ellipse(1540, 200, 120, 150, 0, 0, M.TAU); c.fill();
        c.fillStyle = rgba(M.HIM.hair); c.beginPath(); c.ellipse(1550, 120, 130, 100, 0, 0, M.TAU); c.fill();
      });
      const tremble = M.noise1(lt * 18) * 1.5;
      const L = { amb: [164, 170, 180], key: { c: TUBE, a: 0.6, x: 0.1, y: -1 }, rim: { c: [150, 180, 232], a: 0.45, x: -1, y: -0.2 } };
      const drip = (lt - 0.55) / 0.5;
      M.chopHand(ctx, {
        x: 420, y: 520 + tremble, s: 1.65, rot: -0.1, who: 'her', pinch: 1, L, sleeve: HER_NOW,
        food: (c, L2) => {
          c.save(); c.rotate(0.25);
          M.greens(c, -10, 34, 70, L2.amb);
          if (drip > 0 && drip < 1) { c.fillStyle = 'rgba(140,110,60,0.8)'; c.beginPath(); c.arc(20, 96 + easeInOut(drip) * 380, 5, 0, M.TAU); c.fill(); }
          else if (drip <= 0) { c.fillStyle = 'rgba(140,110,60,0.8)'; c.beginPath(); c.ellipse(20, 96, 5, 5 + clamp(lt / 0.55) * 4, 0, 0, M.TAU); c.fill(); }
          c.restore();
        },
      });
      ctx.restore();
    },
    grade: { expo: 1.0, temp: -0.3, tint: -0.1, sat: 0.8, con: 1.1, lift: [0.0, 0.015, 0.03], bloom: 0.28, thresh: 0.76, vig: 0.55, grain: 0.038 },
    events: () => { const ev = []; for (let t = 0.05; t < 1.6; t += 1 / CHEW) ev.push({ t: t + 0.25 / CHEW, type: 'chew' }); return ev; },
  });

  // ================================================================ S15 — the whole table between them
  M.def('S15', {
    draw(ctx, lt, dur) {
      ctx.save();
      M.camera(ctx, { x: 960, y: 560, z: 1.0 - 0.01 * lt / dur, shake: M.shake(lt + 141, 0.2, 15) });
      wideSet(ctx, true, lt);
      const turn = easeInOut((lt - 1.3) / 1.1);
      const L = L_NOW;
      const him = {
        x: 1590, y: 520, s: 0.86, who: 'him', top: HIM_NOW, L, twist: -0.15,
        head: { yaw: -0.3 + easeInOut((lt - 2.4) / 0.8) * 0.15, tilt: 0.05 + easeInOut((lt - 2.4) / 0.8) * 0.12, gaze: [-0.8, 0.2 + easeInOut((lt - 2.4) / 0.8) * 0.7], lid: 0.2, cheek: 0.05 },
        hands: [[1500, 826], [1660, 834]], armsLater: true,
      };
      const her = {
        x: 340, y: 528, s: 0.84, who: 'her', top: HER_NOW, L, twist: 0.2 - turn * 0.35,
        head: { yaw: 0.3 - turn * 1.15, tilt: 0.04 - turn * 0.08, gaze: [0.6 - turn * 1.4, 0.1 - turn * 0.3], lid: 0.2, cheek: 0.04, hairSway: turn * (1 - turn) * 2 },
        hands: [[280, 834], [436, 826]], armsLater: true,
      };
      M.seatedFront(ctx, him);
      M.seatedFront(ctx, her);
      wideTable(ctx, true, lt, (amb) => {
        const smear = (c, r, k, a) => { c.fillStyle = rgba(mul([150, 90, 60], a), 0.35); c.beginPath(); c.ellipse(-10, 0, r * 0.4, r * k * 0.25, 0.2, 0, M.TAU); c.fill(); };
        M.plate(ctx, 960, 800, 70, { L: { amb }, fill: smear });
        M.plate(ctx, 760, 808, 60, { L: { amb }, fill: smear });
        M.bowl(ctx, 520, 846, 44, { L: { amb } });
        M.bowl(ctx, 1400, 846, 48, { L: { amb }, fish: true });
        M.glass(ctx, 600, 796, 22, 50, { L: { amb } });
        M.glass(ctx, 1300, 796, 22, 50, { L: { amb } });
        M.chopsticks(ctx, 1436, 852, 1540, 866, 3.2, amb, 7);
        M.seatedArms(ctx, him);
        M.seatedArms(ctx, her);
      });
      ctx.restore();
    },
    grade: (lt, dur) => ({
      expo: 1.0, temp: -0.34, tint: -0.1, sat: 0.78, con: 1.06, lift: [0.0, 0.015, 0.035], bloom: 0.3, thresh: 0.76, vig: 0.48, grain: 0.034,
      fade: ss(dur - 1.5, dur - 0.05, lt),
    }),
  });

  // ================================================================ TITLE
  M.def('TITLE', {
    draw() {},
    overlay(ctx, t) {
      const [t0, t1] = M.shotTime('TITLE');
      const lt = t - t0;
      if (lt < 0) return;
      const a1 = ss(0.35, 1.25, lt) * (1 - ss(t1 - t0 - 0.7, t1 - t0 - 0.05, lt));
      const a2 = ss(1.2, 2.0, lt) * (1 - ss(t1 - t0 - 0.7, t1 - t0 - 0.05, lt));
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if ('letterSpacing' in ctx) ctx.letterSpacing = '28px';
      M.font(ctx, 92, 300, M.SERIF);
      ctx.fillStyle = `rgba(240,236,228,${a1})`;
      ctx.fillText('想你了', M.VW / 2 + 14, 500);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '8px';
      M.font(ctx, 30, 300, M.SERIF);
      ctx.fillStyle = `rgba(200,196,190,${a2 * 0.85})`;
      ctx.fillText('越被认真对待，越想后退', M.VW / 2 + 4, 610);
      ctx.restore();
    },
    grade: { grain: 0.03, vig: 0 },
  });
})(typeof window !== 'undefined' ? window : globalThis);
