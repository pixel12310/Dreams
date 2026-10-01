/*
 * Night, the living room: S01–S05.
 * The phone is the only real light. Every shot is painted fully lit, then a light map
 * (ambient + phone + a little cold window light) decides what the camera actually sees.
 */
(function (G) {
  'use strict';
  const M = G.MY;
  const { clamp, lerp, ss, rgba, mul, easeOut, easeInOut } = M;

  const SCREEN = [196, 212, 255];      // light from the phone
  const MOON = [92, 110, 160];         // cold city light through the window
  const SWEATER = [168, 170, 176];     // her oversized grey knit
  const BLANKET = [190, 152, 92];      // mustard knit blanket
  const SOFA = [104, 112, 128];

  // ---------------------------------------------------------------- textures
  function weave(ctx) {
    return M.pattern(ctx, 'weave', 12, 12, (c, w, h) => {
      c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 2) { c.fillStyle = y % 4 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.07)'; c.fillRect(0, y, w, 1); }
      for (let x = 0; x < w; x += 3) { c.fillStyle = 'rgba(0,0,0,0.06)'; c.fillRect(x, 0, 1, h); }
    });
  }
  function knit(ctx) {
    // stockinette "V" stitches
    return M.pattern(ctx, 'knit', 22, 26, (c, w, h) => {
      c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
      for (const ox of [0, 11]) {
        c.fillStyle = 'rgba(255,255,255,0.14)';
        c.beginPath(); c.ellipse(ox + 5.5, 13, 4.2, 10, -0.45, 0, M.TAU); c.fill();
        c.beginPath(); c.ellipse(ox + 5.5, 13, 4.2, 10, 0.45, 0, M.TAU); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(ox + 5.5, 2); c.lineTo(ox + 5.5, 24); c.stroke();
      }
    });
  }
  // fill the current path with a base colour and a multiplied texture
  function texFill(ctx, base, pat, scale = 1, alpha = 1) {
    ctx.fillStyle = rgba(base); ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = alpha;
    ctx.scale(scale, scale);
    ctx.fillStyle = pat; ctx.fill();
    ctx.restore();
  }
  M.night = { weave, knit, texFill };

  const S04_CHAT = [
    { side: 'time', text: '21:06' },
    { side: 'l', text: '今天降温了，多穿点' },
    { side: 'r', text: '嗯嗯' },
    { side: 'time', text: '23:47' },
    { side: 'l', text: '想你了' },
  ];

  // ================================================================ BLACK
  M.def('BLACK', { draw() {}, grade: { grain: 0.035, vig: 0 } });

  // ================================================================ S01 — "想你了" arrives
  const S01_ON = 0.32;   // screen wakes
  M.def('S01', {
    draw(ctx, lt) {
      const z = 1.02 + 0.07 * easeInOut(lt / 2.5);
      ctx.save();
      M.camera(ctx, { x: 1180, y: 540, z, shake: M.shake(lt + 3, 0.5, 1) });
      // seat cushion
      ctx.beginPath(); ctx.rect(-200, -200, 2400, 1500);
      texFill(ctx, SOFA, weave(ctx), 1, 0.9);
      // armrest: a padded band with a deep crease along its inner edge
      const arm = (c) => { c.moveTo(860, -200); c.bezierCurveTo(820, 300, 860, 800, 900, 1300); c.lineTo(2300, 1300); c.lineTo(2300, -200); c.closePath(); };
      ctx.save();
      ctx.beginPath(); arm(ctx);
      texFill(ctx, mul(SOFA, [255, 255, 255], 1.12), weave(ctx), 1, 0.9);
      ctx.clip();
      ctx.fillStyle = M.lin(ctx, 860, 0, 1150, 0, [[0, [0, 0, 0], 0.55], [0.4, [0, 0, 0], 0.1], [1, [0, 0, 0], 0]]);
      ctx.fillRect(800, -200, 400, 1500);
      // piping seam
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(1830, -200); ctx.bezierCurveTo(1800, 400, 1830, 800, 1860, 1300); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(1836, -200); ctx.bezierCurveTo(1806, 400, 1836, 800, 1866, 1300); ctx.stroke();
      ctx.restore();
      // crease shadow on the seat side
      ctx.save();
      ctx.filter = `blur(${14 * M.SC}px)`;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 40;
      ctx.beginPath(); ctx.moveTo(840, -200); ctx.bezierCurveTo(800, 300, 840, 800, 880, 1300); ctx.stroke();
      ctx.restore();
      // the knit blanket spilling in from the lower left
      const bl = (c) => M.spline(c, [[-200, 420], [160, 470], [420, 560], [620, 700], [760, 900], [820, 1300], [-200, 1300]], true, 0.5);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 30 * M.SC; ctx.shadowOffsetX = 10 * M.SC; ctx.shadowOffsetY = 10 * M.SC;
      ctx.beginPath(); bl(ctx); ctx.fillStyle = rgba(BLANKET); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.beginPath(); bl(ctx); ctx.clip();
      ctx.beginPath(); ctx.rect(-200, 300, 1100, 1100);
      ctx.save(); ctx.rotate(-0.35); texFill(ctx, BLANKET, knit(ctx), 1.6, 1); ctx.restore();
      // folds
      for (let i = 0; i < 5; i++) {
        const x0 = 40 + i * 150;
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 26; ctx.filter = `blur(${12 * M.SC}px)`;
        ctx.beginPath(); ctx.moveTo(x0, 1200); ctx.quadraticCurveTo(x0 + 80, 800, x0 + 180 + i * 20, 520 + i * 40); ctx.stroke();
      }
      ctx.filter = 'none';
      ctx.restore();
      // fringe of the blanket edge: little yarn tassels
      ctx.strokeStyle = rgba(mul(BLANKET, [255, 255, 255], 0.9)); ctx.lineWidth = 5; ctx.lineCap = 'round';
      for (let i = 0; i < 18; i++) {
        const u = i / 17, x = lerp(-60, 760, u), y = lerp(440, 900, u * u) + Math.sin(u * 9) * 10;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 18, y - 6 + M.hash(i) * 6, x + 30 + M.hash(i + 4) * 14, y + 8); ctx.stroke();
      }
      // light: ambient + phone + faint moon from the top left
      const on = ss(S01_ON, S01_ON + 0.08, lt);
      const px = 1400, py = 520;
      M.lightMap(ctx, [24, 28, 42], [
        { x: -300, y: -300, r: 1700, c: MOON, a: 0.35 },
        { x: px, y: py, r: 1050, c: SCREEN, a: 1.25 * on, fall: [1, 0.7, 0.36, 0.12, 0] },
        { x: px, y: py, r: 360, c: SCREEN, a: 0.5 * on },
      ]);
      // the phone, buzzing when the message lands
      const buzz = lt > S01_ON && lt < S01_ON + 0.5 ? Math.sin(lt * 190) * 2.6 * (1 - (lt - S01_ON) / 0.5) : 0;
      const pw = 290;
      M.phone(ctx, px - pw / 2 + buzz, py - pw * 844 / 390 / 2 + buzz * 0.4, pw, 0.2 + buzz * 0.002,
        (c) => M.lockScreen(c, { notify: clamp((lt - S01_ON - 0.04) / 0.35), time: '23:47' }),
        { off: lt < S01_ON, dim: 0.3 * (1 - on) });
      ctx.restore();
    },
    grade: { expo: 1.0, temp: -0.35, tint: 0.05, sat: 0.92, con: 1.06, lift: [0.0, 0.01, 0.035], bloom: 0.55, thresh: 0.62, vig: 0.6, grain: 0.04, ca: 1.2 },
    events: () => [{ t: S01_ON, type: 'notify' }, { t: S01_ON, type: 'buzz', dur: 0.5 }],
  });

  // ================================================================ S02 — she does not smile
  M.def('S02', {
    draw(ctx, lt, dur) {
      const z = 1.0 + 0.035 * (lt / dur);
      ctx.save();
      M.camera(ctx, { x: 960, y: 540, z, shake: M.shake(lt + 11, 0.6, 2) });
      // deep room, out of focus
      ctx.fillStyle = M.lin(ctx, 0, 0, 0, 1080, [[0, [12, 14, 24]], [1, [20, 24, 38]]]);
      ctx.fillRect(-100, -100, 2120, 1280);
      M.layer(ctx, 26, (c) => {
        const bokeh = [[180, 260, 70, [255, 196, 140], 0.22], [330, 180, 46, [255, 210, 160], 0.16], [1500, 200, 90, [140, 170, 230], 0.12], [1700, 360, 56, [150, 180, 240], 0.1], [90, 520, 40, [255, 190, 130], 0.12]];
        for (const [x, y, r, col, a] of bokeh) {
          c.fillStyle = rgba(col, a); c.beginPath(); c.arc(x, y, r, 0, M.TAU); c.fill();
          c.strokeStyle = rgba(col, a * 0.8); c.lineWidth = 4; c.stroke();
        }
        // the window frame far behind her
        c.fillStyle = 'rgba(70,86,128,0.18)'; c.fillRect(-40, 60, 330, 620);
      });
      const breathe = Math.sin(lt * 2.1) * 3;
      const hx = 820, hy = 450 + breathe;
      const L = {
        amb: [70, 78, 104],
        key: { c: SCREEN, a: 0.95, x: 0.5, y: 0.86 },
        rim: { c: [150, 172, 230], a: 0.28, x: -0.95, y: -0.3 },
      };
      const s = 2.55;
      M.torsoProfile(ctx, { x: hx - 30 * s, y: hy + 138 * s, s, L, top: SWEATER, lean: 0.12 });
      const bt = (lt - 1.45) / 0.16;
      const blink = bt > 0 && bt < 1 ? Math.abs(bt * 2 - 1) : 1;
      M.profileHead(ctx, { x: hx, y: hy, s, who: 'her', L, blink, gaze: [0.3, 0.9], catch: [226, 236, 255], cheek: 0.05, tilt: 0.1 });
      M.lightMap(ctx, [56, 62, 84], [
        { x: 1500, y: 1180, r: 1250, c: SCREEN, a: 1.25, fall: [1, 0.75, 0.42, 0.16, 0] },
        { x: -200, y: 300, r: 900, c: MOON, a: 0.25 },
      ]);
      // the phone itself, out of focus at the bottom right
      M.layer(ctx, 22, (c) => {
        c.save(); c.translate(1640, 1080); c.rotate(-0.55);
        M.rr(c, -110, -10, 220, 480, 34); c.fillStyle = 'rgba(214,226,252,0.75)'; c.fill();
        c.restore();
      });
      ctx.restore();
    },
    grade: { expo: 1.0, temp: -0.4, tint: 0.04, sat: 0.9, con: 1.08, lift: [0, 0.01, 0.04], bloom: 0.5, thresh: 0.6, mist: 0.12, vig: 0.55, grain: 0.04 },
  });

  // ================================================================ S03 — the thumb hesitates
  function thumb(ctx, L, k) {
    // local: base at origin, pointing +x, tip at ~400
    const C = M.HER;
    const path = (c) => M.spline(c, [[-60, -96], [120, -86], [260, -74], [350, -62], [404, -30], [414, 6], [396, 44], [330, 66], [220, 76], [80, 92], [-60, 110]], true, 0.5);
    M.litFill(ctx, path, C.skin, L, 180, 0, 240, {
      rimW: 0.02,
      extra: (c) => {
        M.blot(c, 210, 0, 30, 70, mul(C.skinShade, L.amb), 0.3);           // knuckle crease
        c.strokeStyle = rgba(mul(C.skinShade, L.amb), 0.5); c.lineWidth = 3;
        for (const dy of [-26, -6, 14]) { c.beginPath(); c.moveTo(200, dy * 1.6); c.quadraticCurveTo(214, dy * 1.6 + 6, 222, dy * 1.6 + 16); c.stroke(); }
        M.blot(c, 60, 90, 160, 40, mul(C.skinShade, L.amb), 0.5);
      },
    });
    // nail
    ctx.save();
    M.rr(ctx, 290, -44, 104, 76, 34);
    ctx.fillStyle = rgba(mul([246, 216, 208], L.amb, 1.05)); ctx.fill();
    ctx.clip();
    ctx.fillStyle = M.lin(ctx, 290, 0, 394, 0, [[0, [190, 130, 130], 0.35], [0.25, [0, 0, 0], 0], [0.85, [255, 255, 255], 0.0], [1, [255, 255, 255], 0.35]]);
    ctx.fillRect(280, -50, 130, 90);
    M.blot(ctx, 350, -22, 30, 8, [255, 255, 255], 0.35 * k, 'lighter');
    ctx.restore();
  }
  M.def('S03', {
    draw(ctx, lt, dur) {
      const rack = easeInOut((lt - 1.45) / 0.65);
      const z = 1.0 + 0.04 * (lt / dur);
      ctx.save();
      M.camera(ctx, { x: 960, y: 540, z, shake: M.shake(lt + 21, 0.7, 3) });
      ctx.fillStyle = '#0b0d14'; ctx.fillRect(-200, -200, 2400, 1500);
      const glowP = [1180, 640];
      // ---- background: blanket + her other hand gripping it
      const grip = easeInOut((lt - 1.2) / 1.1);
      M.layer(ctx, lerp(16, 0, rack), (c) => {
        c.save();
        const bpath = (q) => M.spline(q, [[-200, 500], [200, 520], [520, 600], [700, 760], [760, 1300], [-200, 1300]], true, 0.5);
        c.beginPath(); bpath(c); texFill(c, BLANKET, knit(c), 2.2, 1);
        c.clip();
        // bunching folds converge on the fist as it tightens
        for (let i = 0; i < 7; i++) {
          const a = -0.9 + i * 0.32, r0 = 70, r1 = 260 + 80 * grip;
          c.strokeStyle = `rgba(0,0,0,${0.18 + 0.22 * grip})`; c.lineWidth = 22; c.filter = `blur(${9 * M.SC}px)`;
          c.beginPath(); c.moveTo(330 + Math.cos(a) * r0, 820 + Math.sin(a) * r0);
          c.quadraticCurveTo(330 + Math.cos(a + 0.2) * r1 * 0.6, 820 + Math.sin(a + 0.2) * r1 * 0.6, 330 + Math.cos(a) * r1, 820 + Math.sin(a) * r1);
          c.stroke();
        }
        c.filter = 'none';
        c.restore();
        const curl = 0.7 + 0.3 * grip;
        const HL = { amb: [80, 86, 110], key: { c: SCREEN, a: 0.6, x: 0.9, y: -0.2 }, rim: { c: SCREEN, a: 0.35, x: 1, y: -0.3 } };
        M.handTop(c, {
          x: 250 - grip * 6, y: 700 + grip * 10, s: 1.7, rot: 1.05 - grip * 0.08, who: 'her', L: HL,
          curl: [0.6 + 0.3 * grip, curl, curl + 0.03, curl + 0.05, curl + 0.06], spread: -0.15, sleeve: SWEATER,
        });
        // the blanket bunches up over the fingertips
        c.save();
        c.beginPath(); M.spline(c, [[200, 900 - grip * 10], [330, 850 - grip * 26], [470, 860 - grip * 20], [560, 930], [520, 1000], [260, 1010]], true, 0.6);
        c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 20 * M.SC; c.shadowOffsetY = -6 * M.SC;
        texFill(c, mul(BLANKET, [255, 255, 255], 1.05), knit(c), 2.2, 1);
        c.restore();
      });
      // ---- foreground: the phone keyboard and the hovering thumb
      M.layer(ctx, lerp(0, 9, rack), (c) => {
        const st = M.typingState([], lt);
        M.phone(c, 600, -1240, 1100, -0.12, (q) => M.chatScreen(q, { t: lt + 7, msgs: S04_CHAT, input: '', caret: true, keyboard: true, press: st.press }));
        // thumb: hovers, trembles, then pulls back a little
        const back = easeInOut((lt - 1.05) / 0.7);
        const tr = (M.noise1(lt * 22) * 2 + M.noise1(lt * 37 + 4)) * (1 - back * 0.5);
        const tx = 1560 + back * 80 + tr, ty = 990 + back * 70 + tr * 0.6;
        const hover = 1 + back * 0.8;
        // soft shadow on the glass: the gap under the thumb
        c.save();
        c.filter = `blur(${(18 + 16 * hover) * M.SC}px)`;
        c.globalAlpha = 0.55 - 0.18 * back;
        c.translate(tx + 34 * hover, ty + 40 * hover); c.rotate(-2.55); c.scale(1.3, 1.3);
        M.rr(c, -40, -80, 420, 170, 80); c.fillStyle = '#000'; c.fill();
        c.restore();
        c.save();
        c.translate(tx, ty); c.rotate(-2.55); c.scale(1.3, 1.3);
        thumb(c, { amb: [92, 98, 124], key: { c: SCREEN, a: 0.55, x: -0.2, y: 1 }, rim: { c: [214, 226, 255], a: 0.55, x: 0, y: 1 } }, 1);
        c.restore();
      });
      M.lightMap(ctx, [40, 44, 62], [
        { x: glowP[0], y: glowP[1], r: 1400, c: SCREEN, a: 1.2, fall: [1, 0.8, 0.5, 0.2, 0] },
      ]);
      ctx.restore();
    },
    grade: { expo: 1.0, temp: -0.38, tint: 0.04, sat: 0.9, con: 1.07, lift: [0, 0.012, 0.04], bloom: 0.45, thresh: 0.66, mist: 0.1, vig: 0.62, grain: 0.042 },
    events: () => [{ t: 0.4, type: 'breath', dur: 1.2 }, { t: 1.6, type: 'breath', dur: 1.0 }, { t: 1.3, type: 'grip', dur: 1.0 }],
  });

  // ================================================================ S04 — 我也 … deleted
  const S04_TYPE = M.typingScript([
    ['type', '我也', 0.18, 0.64],
    ['del', 2, 1.34, 1.5],
    ['type', '对了你明天几点上班', 1.78, 2.86],
    ['send', 3.0],
  ]);
  M.def('S04', {
    draw(ctx, lt, dur) {
      const st = M.typingState(S04_TYPE, lt);
      const z = 1.0 + 0.06 * easeInOut(lt / dur);
      ctx.save();
      M.camera(ctx, { x: 960, y: 600, z, r: -0.02, shake: M.shake(lt + 31, 0.55, 4) });
      // around the phone: her lap, the blanket, out of focus
      ctx.fillStyle = '#0c0e15'; ctx.fillRect(-200, -200, 2400, 1500);
      M.layer(ctx, 20, (c) => {
        c.beginPath(); c.rect(-200, -200, 2400, 1500); texFill(c, mul(BLANKET, [255, 255, 255], 0.8), knit(c), 2, 1);
        c.fillStyle = rgba(SWEATER); c.beginPath(); c.ellipse(260, 1000, 300, 200, 0.3, 0, M.TAU); c.fill(); c.beginPath(); c.ellipse(1680, 1000, 300, 200, -0.3, 0, M.TAU); c.fill();
      });
      M.lightMap(ctx, [26, 30, 44], [{ x: 960, y: 560, r: 1300, c: SCREEN, a: 1.0 }]);
      const msgs = S04_CHAT.slice();
      if (st.sent) msgs.push({ side: 'r', text: st.sent.text, at: st.sent.t + 7 });
      M.phone(ctx, 530, -700, 860, 0, (q) => M.chatScreen(q, {
        t: lt + 7, msgs, input: st.input, py: st.py, cands: st.cands, press: st.press, caret: true, keyboard: true,
      }));
      // her thumbs, out of focus, at the edges of frame
      const tap = st.press ? st.press.a : 0;
      M.layer(ctx, 14, (c) => {
        const L = { amb: [70, 76, 100], key: { c: SCREEN, a: 0.6, x: 0, y: -1 }, rim: { c: SCREEN, a: 0.3, x: 0, y: -1 } };
        c.save(); c.translate(1500 - tap * 14, 1240 - tap * 10); c.rotate(-2.2); thumb(c, L, 0.6); c.restore();
        c.save(); c.translate(420, 1260); c.scale(-1, 1); c.rotate(-2.3); thumb(c, L, 0.6); c.restore();
      });
      ctx.restore();
    },
    grade: { expo: 1.0, temp: -0.25, tint: 0.03, sat: 0.92, con: 1.04, lift: [0, 0.01, 0.03], bloom: 0.3, thresh: 0.78, vig: 0.5, grain: 0.036 },
    events: () => S04_TYPE.map((e) => ({ t: e.t, type: e.key === 'del' ? 'del' : e.key === 'send' ? 'send' : 'key' }))
      .concat([{ t: 3.02, type: 'sent' }]),
  });

  // ================================================================ S05 — face down
  // Medium shot, camera a little above seat height so the cushion tops read.
  // She sits wrapped in the blanket at the far left; the rest of the sofa is empty and dark.
  M.def('S05', {
    draw(ctx, lt, dur) {
      const flip = easeInOut((lt - 0.42) / 0.5);       // arm brings the phone down
      const land = 0.92;                               // phone hits the cushion
      const on = lt < land ? 1 : Math.max(0, 1 - (lt - land) / 0.07);
      const sink = easeInOut((lt - 1.1) / 1.0);
      ctx.save();
      M.camera(ctx, { x: 960, y: 560, z: 1.0 + 0.015 * lt / dur, shake: M.shake(lt + 41, 0.4, 5) });
      // back wall + window with sheer curtain at the left
      ctx.fillStyle = rgba([70, 74, 88]); ctx.fillRect(-200, -200, 2400, 1500);
      ctx.fillStyle = rgba([150, 168, 210]); ctx.fillRect(60, 30, 300, 520);
      ctx.fillStyle = 'rgba(40,46,60,0.9)'; ctx.fillRect(204, 30, 12, 520); ctx.fillRect(60, 280, 300, 10);
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = `rgba(214,218,234,${0.22 + 0.18 * M.hash(i)})`;
        ctx.fillRect(20 + i * 48, 10, 34, 560);
      }
      // floor
      ctx.fillStyle = rgba([60, 54, 52]); ctx.fillRect(-200, 900, 2400, 400);
      // sofa: backrest, seat tops (seen from a little above), seat fronts, arms
      const back = mul(SOFA, [255, 255, 255], 0.92), top = mul(SOFA, [255, 255, 255], 1.18), front = mul(SOFA, [255, 255, 255], 0.86);
      ctx.fillStyle = rgba(back); M.rr(ctx, 150, 440, 1620, 330, 60); ctx.fill();
      for (const [x0, x1] of [[214, 706], [714, 1206], [1214, 1706]]) {
        ctx.fillStyle = rgba(mul(back, [255, 255, 255], 1.06)); M.rr(ctx, x0, 470, x1 - x0, 240, 40); ctx.fill();
        ctx.fillStyle = rgba(top); M.rr(ctx, x0 - 6, 700, x1 - x0 + 12, 90, 26); ctx.fill();
        ctx.fillStyle = rgba(front); M.rr(ctx, x0 - 6, 770, x1 - x0 + 12, 110, 20); ctx.fill();
      }
      ctx.fillStyle = rgba(mul(SOFA, [255, 255, 255], 1.0));
      M.rr(ctx, 96, 580, 150, 310, 50); ctx.fill(); M.rr(ctx, 1674, 580, 150, 310, 50); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(210, 880, 1500, 26);
      const hx = 450, hy = 452 + sink * 10;
      const L = {
        amb: [100, 108, 136],
        key: { c: SCREEN, a: 0.85 * on, x: 0.15, y: 0.95 },
        rim: { c: [170, 190, 240], a: 0.45, x: -0.9, y: -0.4 },
      };
      // the blanket: over the shoulders, down over tucked-up knees, spilling onto the seat
      const blanket = (c) => M.spline(c, [[hx - 96, 548], [hx - 20, 534], [hx + 96, 546], [hx + 150, 600], [hx + 196, 690], [hx + 250, 760],
        [hx + 236, 840], [hx + 60, 868], [hx - 160, 860], [hx - 196, 790], [hx - 170, 650]], true, 0.5);
      ctx.save();
      ctx.beginPath(); blanket(ctx); texFill(ctx, BLANKET, knit(ctx), 1.7, 0.55);
      ctx.clip();
      ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 18; ctx.filter = `blur(${7 * M.SC}px)`;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(hx - 110 + i * 60, 570); ctx.quadraticCurveTo(hx - 100 + i * 70, 720, hx - 150 + i * 95, 870); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(hx + 30, 700); ctx.quadraticCurveTo(hx + 140, 680, hx + 240, 780); ctx.stroke();
      ctx.filter = 'none';
      ctx.restore();
      // sweater collar showing at the neck
      ctx.fillStyle = rgba(SWEATER);
      ctx.beginPath(); ctx.ellipse(hx + 6, 552, 64, 20, 0, 0, M.TAU); ctx.fill();
      // the arm and phone: chest → cushion beside her, turned face down
      const p0 = [hx + 52, 640], p1 = [hx + 330, 724];
      const hand = [lerp(p0[0], p1[0], flip), lerp(p0[1], p1[1], flip) - Math.sin(flip * Math.PI) * 40];
      if (lt > 1.2) { const r = easeInOut((lt - 1.2) / 0.6); hand[0] = lerp(p1[0], hx + 150, r); hand[1] = lerp(p1[1], 730, r); }
      const sh = [hx + 70, 600];
      const el = M.ik2(sh[0], sh[1], hand[0], hand[1], 120, 120, 1);
      ctx.fillStyle = rgba(mul(BLANKET, [255, 255, 255], 0.9));
      ctx.beginPath(); M.capsule(ctx, sh[0], sh[1], el[0], el[1], 34, 28); M.capsule(ctx, el[0], el[1], hand[0], hand[1], 28, 22); ctx.fill();
      ctx.fillStyle = rgba(SWEATER);
      ctx.beginPath(); ctx.ellipse(hand[0] - 12, hand[1] + 4, 16, 22, 0.4, 0, M.TAU); ctx.fill();
      // the phone: its back toward us while she reads; flat on the seat once it lands
      if (lt < land) {
        ctx.save(); ctx.translate(hand[0] + 4, hand[1] - 30 + flip * 26); ctx.rotate(-0.08 + flip * 1.5); ctx.scale(1, 1 - flip * 0.8);
        M.rr(ctx, -30, -62, 60, 124, 11); ctx.fillStyle = '#25282e'; ctx.fill();
        M.rr(ctx, -21, -53, 22, 26, 6); ctx.fillStyle = '#33373f'; ctx.fill();
        // fingers wrapped round its edges
        ctx.fillStyle = rgba(M.HER.skin);
        for (let i = 0; i < 3; i++) { M.rr(ctx, 22, -6 + i * 15, 16, 12, 6); ctx.fill(); }
        M.rr(ctx, -38, 4, 14, 26, 7); ctx.fill();
        ctx.restore();
      } else {
        ctx.save(); ctx.translate(p1[0] + 4, p1[1] - 2);
        ctx.beginPath(); ctx.moveTo(-70, -6); ctx.lineTo(62, -6); ctx.lineTo(74, 8); ctx.lineTo(-60, 8); ctx.closePath();
        ctx.fillStyle = '#1b1d22'; ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-60, 8, 134, 6);
        ctx.restore();
      }
      // head bowed toward the phone
      M.faceFront(ctx, {
        x: hx, y: hy, s: 0.6, who: 'her', L, yaw: 0.22, tilt: 0.14 + sink * 0.06,
        lid: 0.55 + sink * 0.2, gaze: [0.3, 1], catch: on > 0.5 ? [220, 232, 255] : false, cheek: 0.05,
      });
      const ph = [hx + 52, 600];
      M.lightMap(ctx, [24, 28, 42], [
        { x: 210, y: 290, r: 950, c: MOON, a: 0.85, fall: [1, 0.7, 0.35, 0.12, 0] },
        { x: 420, y: 720, r: 700, c: MOON, a: 0.32 },
        { x: ph[0], y: ph[1], r: 620, c: SCREEN, a: 1.15 * on },
        // the light squeezed out under the phone as it lands
        { x: p1[0], y: p1[1] + 4, r: 180, c: SCREEN, a: lt > land - 0.05 ? 0.9 * Math.max(0, 1 - (lt - land + 0.05) / 0.16) : 0, sy: 0.25 },
      ]);
      ctx.restore();
    },
    grade: (lt) => ({ expo: lt < 0.92 ? 1.0 : 0.92, temp: -0.42, tint: 0.05, sat: 0.85, con: 1.1, lift: [0, 0.012, 0.045], bloom: 0.4, thresh: 0.62, vig: 0.62, grain: 0.045 }),
    events: () => [{ t: 0.92, type: 'thud' }],
  });
})(typeof window !== 'undefined' ? window : globalThis);
