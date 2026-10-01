/*
 * 初见 · FIRST SIGHT — the question, and the first day.
 *
 *   59 – 61   we fall into one 日 of the grid; it is the window of a room
 *   61 – 76   a grey room at dawn. A father bent over his desk. His daughter, the
 *             only thing in colour, climbs onto the desk and draws a red sun on
 *             the glass around the grey 日 outside. "Dad, what colour is the sun?"
 *             He knows the word — 红 — and the word is grey. He looks.
 *             The 日 opens back into a sun, and colour floods out from it.
 *   76 – 81   his eye, with the morning in it
 *   81 – 90   the street from the first day. The door opens; the two of them
 *             come out and look up. Day 4,381 becomes day 1.
 *   90 – 95   初见
 */
(function (G) {
  'use strict';
  const FS = G.FS;
  const { clamp, lerp, ss, win, easeOut, easeIn, easeInOut, backOut, TAU, hash, noise1, rng, rgba, mixc, track } = FS;
  const B = FS.brush, GL = FS.glyphs, FIG = FS.fig;
  const VW = 1920, VH = 1080;
  const W = () => FS.world, CT = () => FS.city;

  // ------------------------------------------------------------------ timing
  const T = {
    room: 60.75, girlIn: 63.0, hop: 64.15, draw0: 65.0, draw1: 67.7,
    ask0: 67.9, ask1: 71.3, lift: 68.5, red0: 69.3, red1: 71.3, look: 71.2,
    open0: 72.4, open1: 73.7, wave0: 73.1, wave1: 76.6,
    eye0: 76.6, eyeZ0: 79.2, eyeZ1: 81.0,
    out0: 81.0, door0: 81.6, step0: 81.95, step1: 83.2, up: 83.9, count0: 85.6,
    white0: 89.1, white1: 89.9, card0: 89.9,
  };

  // ------------------------------------------------------------------ the room
  const WIN = { x: 960, y: 380, s: 680 };
  const FR = (() => {
    const s = WIN.s;
    // measured from the printed 日 (Noto Serif SC 600), so the glyph becomes the frame
    const x0 = WIN.x - 0.278 * s, x1 = WIN.x + 0.312 * s, y0 = WIN.y - 0.372 * s, y1 = WIN.y + 0.362 * s;
    const bw = 0.095 * s, bh = 0.058 * s, ym = WIN.y - 0.005 * s, mh = 0.034 * s;
    return { x0, x1, y0, y1, bw, bh, ym, mh, panes: [[x0 + bw, y0 + bh, x1 - bw, ym - mh / 2], [x0 + bw, ym + mh / 2, x1 - bw, y1 - bh]] };
  })();
  const SUN_R = [1062, 486];
  const DESK_Y = 662;
  // the view through the window: the street's skyline, small
  const VIEW = { s: 0.6, ox: FR.x0 + (FR.x1 - FR.x0) / 2 - 20, oy: FR.panes[1][3] + 30 };
  const toRoom = (x, y) => [VIEW.ox + (x - 960) * VIEW.s, VIEW.oy + (y - CT().GROUND) * VIEW.s];

  function roomCam(t) {
    const k = track([
      [60.75, { x: 960, y: 380, z: 1.32 }], [63.2, { x: 990, y: 520, z: 1.06 }, 'io'], [67.6, { x: 1010, y: 510, z: 1.12 }], [71.2, { x: 1015, y: 500, z: 1.16 }],
      [72.9, { x: 1058, y: 488, z: 1.78 }, 'io'], [74.4, { x: 1048, y: 492, z: 1.62 }], [76.6, { x: 1005, y: 510, z: 1.22 }, 'io'],
    ].map(([tt, v, e]) => [tt, [v.x, v.y, v.z], e]));
    const v = k(t);
    return { x: v[0], y: v[1], z: v[2] };
  }
  const camScreen = (cam, p) => [(p[0] - cam.x) * cam.z + 960, (p[1] - cam.y) * cam.z + 540];

  // the wave of colour, centred on the sun, in screen space
  function waveAt(t, cam) {
    const u = clamp((t - T.wave0) / (T.wave1 - T.wave0));
    if (u <= 0) return null;
    const c = camScreen(cam, SUN_R);
    return { x: c[0], y: c[1], r: (0.02 + 2.7 * easeIn(u, 1.7)) * VH, soft: 46 + 60 * u, on: 1, ring: 1 - u };
  }
  // how far a point (room coords) is from having its colour back
  function mAt(t, cam, p, jit = 0) {
    const sunM = 2 - 2 * easeInOut(clamp((t - T.open0) / (T.open1 - T.open0)));
    const wv = waveAt(t, cam);
    if (!wv) return 2;
    const sp = camScreen(cam, p);
    const d = Math.hypot(sp[0] - wv.x, sp[1] - wv.y) / VH;
    const ahead = wv.r / VH - d - jit * 0.08;
    return Math.max(0, 2 - 2 * clamp(ahead / 0.32));
  }

  const DAD = { skin: [238, 204, 182], hair: [30, 28, 28], top: [118, 140, 168], sleeve: [118, 140, 168], bottom: [70, 72, 82], shoes: [40, 36, 34] };
  const GIRL = { skin: [248, 216, 196], hair: [34, 28, 28], top: [252, 206, 72], sleeve: [252, 206, 72], bottom: [252, 196, 80], shoes: [236, 120, 110], ribbon: [222, 58, 46] };

  // the crayon's path on the glass: a circle, the rays, a scribble to fill it in
  const CRAYON = (() => {
    const pts = [];
    const [cx, cy] = SUN_R, r = 36;
    // circle, a little more than once round
    for (let i = 0; i <= 64; i++) {
      const a = -Math.PI / 2 - (i / 64) * TAU * 1.12;
      const rr = r * (1 + 0.06 * Math.sin(i * 0.4)) + i * 0.05;
      pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, d: 1, w: 7 });
    }
    // rays, one after another, lifting the crayon in between
    for (let k = 0; k < 8; k++) {
      const a = -Math.PI / 2 + (k / 8) * TAU + 0.12;
      pts.push({ x: cx + Math.cos(a) * 49, y: cy + Math.sin(a) * 49, d: 0, w: 6 });
      for (let j = 0; j <= 5; j++) {
        const rr = 49 + j * 5;
        pts.push({ x: cx + Math.cos(a + j * 0.01) * rr, y: cy + Math.sin(a + j * 0.01) * rr, d: 1, w: 6 });
      }
    }
    // scribble fill
    const R = rng(12);
    pts.push({ x: cx - 22, y: cy - 22, d: 0, w: 5 });
    for (let i = 0; i < 18; i++) {
      const y = cy - 26 + i * 3.1;
      const half = Math.sqrt(Math.max(0, r * r * 0.82 - (y - cy) ** 2));
      pts.push({ x: cx + (i % 2 ? half : -half) + R.range(-3, 3), y: y + R.range(-2, 2), d: 1, w: 5 });
    }
    // cumulative "time" along the path: drawn segments take time by length, lifts are quick
    let acc = 0;
    pts[0].u = 0;
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      acc += pts[i].d ? l : l * 0.35 + 6;
      pts[i].u = acc;
    }
    for (const p of pts) p.u /= acc;
    return pts;
  })();
  function crayonAt(u) {
    const P = CRAYON;
    if (u <= 0) return P[0];
    for (let i = 1; i < P.length; i++) {
      if (P[i].u >= u) {
        const k = (u - P[i - 1].u) / Math.max(1e-6, P[i].u - P[i - 1].u);
        return { x: lerp(P[i - 1].x, P[i].x, k), y: lerp(P[i - 1].y, P[i].y, k), d: P[i].d, i };
      }
    }
    return P[P.length - 1];
  }
  function drawCrayon(L, u) {
    if (u <= 0) return;
    const ctx = L.crayon.ctx;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgb(226,60,40)';
    const P = CRAYON;
    const end = crayonAt(Math.min(1, u));
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = pass ? 0.5 : 0.95;
      ctx.beginPath();
      let pen = false;
      for (let i = 1; i < P.length && P[i].u <= u; i++) {
        if (!P[i].d) { pen = false; continue; }
        const a = P[i - 1], b = P[i];
        const j = pass ? 1.6 : 0;
        if (!pen) { ctx.moveTo(a.x + j, a.y - j); pen = true; }
        ctx.lineTo(b.x + j * Math.sin(i), b.y - j * Math.cos(i));
        ctx.lineWidth = b.w * (pass ? 0.7 : 1);
      }
      if (end.d && end.i) ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function room(L, t) {
    const cam = roomCam(t);
    W().setCam(L, cam);
    const w = L.wash.ctx, ink = L.ink.ctx, lt = L.light.ctx;
    const light = ss(T.wave0 + 0.3, T.wave1, t);
    // the wall
    w.save(); w.fillStyle = rgba([232, 222, 204]); w.fillRect(-600, -600, 3200, 2400); w.restore();
    W().radial(w, WIN.x, WIN.y + 100, 200, 1300, [[0, [255, 255, 255], 0], [1, [196, 186, 176], 0.8]], 'multiply', 1, { rect: 2400 });
    // the view outside, through the two panes
    const view = CT();
    each2(L, (c) => { c.save(); c.beginPath(); for (const p of FR.panes) c.rect(p[0], p[1], p[2] - p[0], p[3] - p[1]); c.clip(); });
    each2(L, (c) => { c.translate(VIEW.ox, VIEW.oy); c.scale(VIEW.s, VIEW.s); c.translate(-960, -view.GROUND); });
    view.street(L, t, {
      view: 'window', ph: lerp(0.05, 0.08, light), swing: 1, tf: 37, noSunGlyph: true, sun: [-2000, -2000],
      skyCols: [[92, 120, 198], [238, 156, 170], [255, 204, 132]],
      mFn: (seed, x, y) => mAt(t, cam, toRoom(x, y), hash(seed * 1.3)),
    });
    each2(L, (c) => c.restore());
    // the sun, low over the roofs
    const mSun = 2 - 2 * easeInOut(clamp((t - T.open0) / (T.open1 - T.open0)));
    {
      const [sx, sy] = SUN_R;
      const pa = 1 - ss(0.05, 0.55, mSun);
      if (pa > 0.004) {
        W().radial(w, sx, sy, 0, 30, [[0, [255, 252, 240]], [0.7, [255, 246, 222]], [1, [255, 240, 210], 0]], 'source-over', pa);
        W().radial(lt, sx, sy, 0, 220 + 280 * light, [[0, [255, 222, 168], 0.42], [0.15, [255, 206, 150], 0.16], [1, [255, 200, 140], 0]], 'lighter', pa * ss(1.2, 0.3, mSun));
        // the burst as it opens
        const burst = win(T.open0 + 0.6, T.open1, T.open1 + 0.2, T.wave0 + 1.6, t);
        if (burst > 0) W().radial(lt, sx, sy, 0, 130, [[0, [255, 240, 210], 0.3], [1, [255, 230, 190], 0]], 'lighter', burst);
      }
      GL.draw(ink, 'sun', sx, sy, 62, mSun, { seed: 1, print: 'rgb(96,96,92)' });
    }
    // the red sun she draws on the glass
    drawCrayon(L, clamp((t - T.draw0) / (T.draw1 - T.draw0)));
    {
    }
    // glass: a cool sheen and a diagonal reflection
    for (const p of FR.panes) {
      w.save(); w.globalCompositeOperation = 'multiply'; w.globalAlpha = 0.18; w.fillStyle = rgba([196, 208, 216]);
      w.fillRect(p[0], p[1], p[2] - p[0], p[3] - p[1]); w.restore();
      lt.save(); lt.globalCompositeOperation = 'lighter'; lt.globalAlpha = 0.07;
      lt.fillStyle = '#fff'; lt.beginPath(); lt.moveTo(p[0] + 40, p[1]); lt.lineTo(p[0] + 110, p[1]); lt.lineTo(p[0] + 20, p[3]); lt.lineTo(p[0] - 50, p[3]); lt.closePath();
      lt.save(); lt.clip(); lt.fill(); lt.restore(); lt.restore();
    }
    // the frame — the strokes of 日
    const frameA = ss(T.room, T.room + 0.35, t);
    const fr = (x0, y0, x1, y1) => { w.fillRect(x0, y0, x1 - x0, y1 - y0); ink.strokeRect(x0, y0, x1 - x0, y1 - y0); };
    w.save(); ink.save();
    w.globalAlpha = frameA; ink.globalAlpha = frameA * 0.6;
    w.fillStyle = rgba([246, 242, 232]); ink.strokeStyle = 'rgb(70,62,56)'; ink.lineWidth = 2;
    fr(FR.x0, FR.y0, FR.x0 + FR.bw, FR.y1); fr(FR.x1 - FR.bw, FR.y0, FR.x1, FR.y1);
    fr(FR.x0, FR.y0, FR.x1, FR.y0 + FR.bh); fr(FR.x0, FR.ym - FR.mh / 2, FR.x1, FR.ym + FR.mh / 2); fr(FR.x0, FR.y1 - FR.bh, FR.x1, FR.y1);
    w.fillStyle = rgba([228, 222, 210]); fr(FR.x0 - 24, FR.y1 - 4, FR.x1 + 24, FR.y1 + 14);
    w.restore(); ink.restore();
    // the grey print 日 we fell into dissolves into the frame
    const pa = 1 - frameA;
    if (pa > 0.004) GL.print(ink, '日', WIN.x, WIN.y, WIN.s, 'rgb(104,104,100)', pa);

    // sunlight through the window, on the wall and the desk
    if (light > 0) {
      lt.save(); lt.globalCompositeOperation = 'lighter';
      for (const p of FR.panes) {
        const g = lt.createLinearGradient(p[0], p[1], p[0] - 400, p[3] + 520);
        g.addColorStop(0, `rgba(255,214,150,${0.16 * light})`); g.addColorStop(1, 'rgba(255,200,140,0)');
        lt.fillStyle = g;
        lt.beginPath(); lt.moveTo(p[0], p[1]); lt.lineTo(p[2], p[1]); lt.lineTo(p[2] - 420, p[3] + 560); lt.lineTo(p[0] - 520, p[3] + 560); lt.closePath(); lt.fill();
      }
      lt.restore();
    }

    // the floor, the desk on its legs
    const FLOOR = 960;
    w.save(); w.fillStyle = rgba([200, 186, 168]); w.fillRect(-600, FLOOR, 3200, 600); w.restore();
    W().inkLine(ink, [[-600, FLOOR, 1.6], [2600, FLOOR, 1.6]], 1.6, 0.35, 2);
    w.save();
    w.fillStyle = rgba([184, 138, 96]); w.fillRect(440, DESK_Y, 1040, 24);
    w.fillStyle = rgba([164, 120, 84]);
    w.fillRect(470, DESK_Y + 24, 26, FLOOR - DESK_Y - 24); w.fillRect(1424, DESK_Y + 24, 26, FLOOR - DESK_Y - 24);
    w.fillRect(1180, DESK_Y + 24, 244, 92);
    w.restore();
    W().inkLine(ink, [[440, DESK_Y, 2], [1480, DESK_Y, 2]], 2, 0.6, 3);
    W().inkLine(ink, [[440, DESK_Y + 24, 1.6], [1480, DESK_Y + 24, 1.6]], 1.6, 0.5, 4);
    ink.save(); ink.globalAlpha = 0.5; ink.strokeStyle = 'rgb(60,50,44)'; ink.lineWidth = 1.5;
    ink.strokeRect(470, DESK_Y + 24, 26, FLOOR - DESK_Y - 24); ink.strokeRect(1424, DESK_Y + 24, 26, FLOOR - DESK_Y - 24); ink.strokeRect(1180, DESK_Y + 24, 244, 92);
    ink.beginPath(); ink.arc(1302, DESK_Y + 70, 5, 0, TAU); ink.stroke(); ink.restore();
    // papers, a mug, a lamp
    w.save(); w.fillStyle = 'rgb(250,248,242)';
    w.translate(800, DESK_Y + 2); w.rotate(-0.04); w.fillRect(-120, -14, 240, 14); w.restore();
    w.save(); w.fillStyle = rgba([200, 90, 70]); w.fillRect(560, DESK_Y - 46, 40, 46); w.restore();
    W().inkLine(ink, [[560, DESK_Y - 46, 1.4], [560, DESK_Y, 1.4], [600, DESK_Y, 1.4], [600, DESK_Y - 46, 1.4]], 1.4, 0.6, 5);
    W().inkLine(ink, [[520, DESK_Y, 3], [520, DESK_Y - 150, 3, 1], [470, DESK_Y - 200, 3]], 3, 0.8, 6);
    w.save(); w.fillStyle = rgba([80, 110, 104]); w.beginPath(); w.moveTo(430, DESK_Y - 228); w.lineTo(500, DESK_Y - 206); w.lineTo(480, DESK_Y - 178); w.lineTo(420, DESK_Y - 196); w.closePath(); w.fill(); w.restore();

    // the father, at his desk, his back to us
    const lift = easeInOut(clamp((t - T.lift) / 0.7)), turn = easeInOut(clamp((t - T.look) / 0.9));
    const writing = t > 61.4 && t < 63.6 ? Math.sin(t * 13) * 0.1 : 0;
    const dad = {
      x: 880, y: 846, h: 440, plan: 'adult', view: 'back', col: DAD,
      pose: { sit: 1, headY: lerp(0.03, -0.004, lift) - turn * 0.008, headX: turn * 0.012, armL: [-0.55, 1.1], armR: [0.5 + writing, -1.0 - writing] },
    };
    FIG.draw(L, dad);
    // the stool he sits on
    w.save(); w.fillStyle = rgba([150, 108, 76]); w.fillRect(810, 850, 140, 18); w.fillRect(822, 868, 14, FLOOR - 868); w.fillRect(924, 868, 14, FLOOR - 868); w.restore();
    ink.save(); ink.globalAlpha = 0.5; ink.strokeStyle = 'rgb(60,50,44)'; ink.lineWidth = 1.4; ink.strokeRect(810, 850, 140, 18); ink.restore();
    // 红: he knows the word, and the word is grey
    const ra = win(T.red0, T.red0 + 0.35, T.red1 - 0.7, T.red1, t);
    if (ra > 0.003) {
      const jit = ss(T.red1 - 1.0, T.red1, t);
      const dx = (noise1(t * 30) * 2) * jit, dy = -jit * 10;
      GL.print(ink, '红', 770 + dx, 432 + dy, 92, 'rgb(96,96,92)', ra);
    }

    // the daughter
    girl(L, t);
    return cam;
  }
  function each2(L, fn) { for (const n of ['wash', 'ink', 'light', 'mask']) fn(L[n].ctx); }

  function girl(L, t) {
    if (t < T.girlIn) return;
    const h = 300;
    let x, y, walk, amp = 1, pose = { lean: 0 }, dir = -1;
    const floorY = 960, deskX = 1146;
    if (t < T.hop) {
      const u = (t - T.girlIn) / (T.hop - T.girlIn);
      x = lerp(1640, 1300, u); y = floorY;
      walk = FIG.phaseFor(1640 - x, h);
    } else if (t < T.hop + 0.6) {
      const u = easeInOut((t - T.hop) / 0.6);
      x = lerp(1300, deskX, u); y = lerp(floorY, DESK_Y, u) - Math.sin(u * Math.PI) * 120;
      walk = 1.2; amp = 0.6 * Math.sin(u * Math.PI);
    } else {
      x = deskX; y = DESK_Y;
    }
    const f = { x, y, h, plan: 'child', view: 'side', dir, col: GIRL, hair: 'pigtails', walk, amp, pose, mask: 1, shortSleeve: false };
    // drawing: the hand rides the crayon
    const du = clamp((t - T.draw0) / (T.draw1 - T.draw0));
    const reach = t > T.hop + 0.55 && t < T.draw1 + 0.45;
    let hand = null;
    if (reach) {
      const raise = ss(T.hop + 0.55, T.draw0, t) * (1 - ss(T.draw1, T.draw1 + 0.45, t));
      const c = crayonAt(du);
      // lift slightly between strokes
      const target = [c.x + 4, c.y + 6 - (c.d ? 0 : 6)];
      pose.lean = 0.12 + 0.2 * raise;
      let sh = FIG.shoulder(f);
      const dist = Math.hypot(target[0] - sh.x, target[1] - sh.y);
      const over = dist - (sh.l1 + sh.l2) * 0.93;
      if (over > 0) { f.x -= over * 0.8; sh = FIG.shoulder(f); }
      const rest = [0.25, 0.35];
      const a = FIG.ik(sh.x, sh.y, target[0], target[1], sh.l1, sh.l2, dir, -1);
      pose.armF = [lerp(rest[0], a[0], raise), lerp(rest[1], a[1], raise)];
      hand = target;
      pose.head = lerp(0, -0.4, raise);
    }
    // she turns to her father to ask; then looks at the window with him
    const ask = win(T.draw1 + 0.2, T.draw1 + 0.6, T.look, T.look + 0.6, t);
    pose.head = (pose.head || 0) + ask * 0.55 - ss(T.look, T.look + 0.6, t) * 0.25;
    pose.mouth = win(T.ask0, T.ask0 + 0.1, T.ask0 + 1.6, T.ask0 + 1.8, t) > 0.5 && Math.sin(t * 22) > 0;
    f.hold = (LL, hf) => {
      // the red crayon in her hand
      const c = LL.crayon.ctx;
      c.save(); c.translate(hf[0], hf[1]); c.rotate(-0.9); c.fillStyle = 'rgb(226,60,40)';
      c.fillRect(-3, -16, 7, 22); c.fillStyle = 'rgb(240,232,214)'; c.fillRect(-3.5, -6, 8, 9); c.restore();
    };
    FIG.draw(L, f);
  }

  // ------------------------------------------------------------------ the eye, again
  const ADULT_IRIS = [[206, 150, 92], [150, 104, 64], [100, 76, 54], [52, 40, 36]];
  function finalStreet(L, t) {
    const tt = Math.max(t, T.out0);
    const door = ss(T.door0, T.door0 + 0.5, tt) * (1 - ss(T.step1 + 0.3, T.step1 + 1.0, tt));
    const SUN = [420, 300];
    CT().street(L, tt, { noHim: true, ph: 0.075, swing: 1, tf: 37, sun: SUN, sunGlow: 1.7, mFn: () => 0, doorOpen: door, rush: 30 + (tt - T.out0),
      skyCols: [[104, 150, 214], [246, 190, 176], [255, 214, 150]], season: 3.55, flat: 0 });
    // morning light: warm haze from the low sun, gold caught in the windows
    W().radial(L.light.ctx, SUN[0], SUN[1], 0, 1700, [[0, [255, 214, 150], 0.34], [0.35, [255, 200, 140], 0.12], [1, [255, 190, 130], 0]], 'lighter', 1, { rect: 2600 });
    const G = CT().GRID;
    for (let c = 0; c < G.cols; c++) for (let r = 0; r < G.rows; r++) {
      const gl = 0.5 + 0.5 * Math.sin(tt * 1.3 + c * 0.9 - r * 0.6);
      if (hash(c * 5 + r * 11) > 0.35) continue;
      const x = G.x0 + c * G.cell + 9, y = G.y0 + r * G.cell + 9;
      L.light.ctx.save(); L.light.ctx.globalCompositeOperation = 'lighter'; L.light.ctx.fillStyle = `rgba(255,214,150,${0.28 * gl})`;
      L.light.ctx.fillRect(x, y, G.cell - 18, G.cell - 18); L.light.ctx.restore();
    }
    // father and daughter, hand in hand
    const D = CT().DOOR;
    const out = easeOut(clamp((tt - T.step0) / (T.step1 - T.step0)), 2);
    const yy = lerp(D.y - 8, CT().WALK_Y + 10, out);
    const a = ss(T.step0, T.step0 + 0.25, tt);
    const up = easeInOut(clamp((tt - T.up) / 1.1));
    const point = easeInOut(clamp((tt - T.up - 0.5) / 0.8)) * (1 - ss(88.0, 88.8, tt));
    const walking = out < 0.999;
    const dad = { x: D.x + 22, y: yy, h: 136, plan: 'adult', view: 'front', col: DAD, walk: walking ? tt * 8 : undefined, amp: 0.5, alpha: a,
      pose: { head: -1.7 * up, smile: 0.4 + up * 0.7, armL: [-0.5, -0.2] } };
    const girlF = { x: D.x - 34, y: yy + 2, h: 84, plan: 'child', view: 'front', col: GIRL, hair: 'pigtails', walk: walking ? tt * 9 + 1 : undefined, amp: 0.6, alpha: a,
      pose: { head: -1.6 * up, smile: 1, armR: [0.62, 0.1], armL: point > 0 ? [lerp(-0.2, -2.5, point), 0] : undefined } };
    FIG.draw(L, girlF);
    FIG.draw(L, dad);
    // swallows, like the first morning
    const ink = L.ink.ctx;
    for (let i = 0; i < 5; i++) {
      const u = (tt - 84.2 - i * 0.3) / 4.5;
      if (u < 0 || u > 1) continue;
      W().swallow(ink, lerp(-120, 2000, u), 330 + i * 30 - Math.sin(u * Math.PI) * 140, 0.8, tt * 13 + i, 1, 0.85);
    }
  }
  // close on the door as they come out; then up and out to the whole morning
  function finalCam(t) {
    const u = easeInOut(clamp((t - 84.4) / 4.6));
    return { x: lerp(948, 940, u), y: lerp(716, 540, u), z: lerp(2.15, 1.0, u) };
  }

  // ------------------------------------------------------------------ the card
  function card(L, t) {
    W().setCam(L, W().IDENT);
    const ink = L.ink.ctx;
    const chars = ['初', '见'];
    chars.forEach((ch, i) => {
      const u = clamp((t - T.card0 - 0.35 - i * 0.35) / 0.6);
      if (u <= 0) return;
      const x = 880 + i * 172, y = 480;
      ink.save();
      ink.beginPath(); ink.arc(x - 90, y - 90, 380 * easeOut(u, 2), 0, TAU); ink.clip();
      W().brushText(ink, ch, x, y, 160, 'rgb(24,21,19)', Math.min(1, u * 1.5));
      ink.restore();
    });
    // the seal
    const su = ss(T.card0 + 1.6, T.card0 + 1.75, t);
    if (su > 0) {
      const c = L.wash.ctx;
      const sx = 1086, sy = 640, s = 64 * lerp(1.25, 1, su);
      c.save();
      c.translate(sx, sy); c.rotate(0.03);
      c.globalAlpha = su;
      c.fillStyle = 'rgb(184,48,36)';
      c.beginPath(); W().poly(c, B.blobPoly(s / 2, s / 2, 7, 0.04, 28, 3).map(([x, y]) => [Math.sign(x) * Math.min(Math.abs(x) * 1.25, s / 2), Math.sign(y) * Math.min(Math.abs(y) * 1.25, s / 2)])); c.fill();
      c.fillStyle = 'rgb(250,240,226)';
      c.font = `400 ${s * 0.44}px FSBrush, serif`;
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.fillText('初', s * 0.0, -s * 0.06);
      c.fillText('见', s * 0.0, s * 0.38);
      c.restore();
    }
    const ea = ss(T.card0 + 2.0, T.card0 + 2.8, t);
    if (ea > 0) {
      const c = L.top.ctx;
      W().setCam(L, W().IDENT, ['top']);
      c.save(); c.globalAlpha = ea * 0.8; c.fillStyle = 'rgb(60,54,50)';
      c.font = '300 26px FSSerif, serif'; c.textAlign = 'center';
      c.fillText('F I R S T   S I G H T', 960, 700);
      c.restore();
    }
  }

  // ------------------------------------------------------------------ dispatch
  let waveNow = null;
  function render(L, t) {
    waveNow = null;
    if (t >= T.room && t < T.eye0) {
      const cam = room(L, t);
      waveNow = waveAt(t, cam);
      W().subtitle(L, '爸爸，太阳是什么颜色的？', T.ask0, T.ask1, t, { dark: true });
    }
    if (t >= T.eye0 && t < T.eyeZ1) {
      const E = W().EYE;
      const zu = easeInOut(clamp((t - T.eyeZ0) / (T.eyeZ1 - T.eyeZ0)));
      const c0 = { x: 960, y: 540, z: lerp(1.02, 1.08, clamp((t - T.eye0) / 2.6)) };
      W().setCam(L, W().zoomCam(c0, [E.refl.x, E.refl.y], 1920 / E.refl.w, zu));
      const blink = win(77.9, 78.02, 78.08, 78.3, t);
      W().eye(L, 9.7 + (t - T.eye0), {
        blink, palette: ADULT_IRIS, skin: [240, 206, 186], seed: 9, pupil: lerp(1.05, 0.82, clamp((t - T.eye0) / 2.2)),
        // the reflection is the very frame we land in
        reflect: (LL) => {
          const c = finalCam(T.out0);
          for (const n of ['wash', 'ink', 'light', 'crayon']) { const x = LL[n].ctx; x.save(); x.translate(960, 540); x.scale(c.z, c.z); x.translate(-c.x, -c.y); }
          finalStreet(LL, T.out0);
          for (const n of ['wash', 'ink', 'light', 'crayon']) LL[n].ctx.restore();
        }, zoomU: zu,
      });
    }
    if (t >= T.eyeZ1 && t < T.white1) {
      W().setCam(L, finalCam(t));
      finalStreet(L, t);
      // the counter: day 4,381 … day 1
      const ca = ss(82.4, 83.0, t) * (1 - ss(88.8, 89.3, t));
      const roll = easeInOut(clamp((t - T.count0) / 0.8));
      if (roll < 1) CT().counter(L, t, '4,381', ca * (1 - roll), { y: 96 - roll * 30, color: 'rgba(60,50,44,0.85)' });
      if (roll > 0) CT().counter(L, t, '1', ca * roll, { y: 126 - roll * 30, color: 'rgba(60,50,44,0.85)' });
      W().subtitle(L, '今天的太阳，也是第一次升起。', 84.5, 88.9, t);
      // back to blank paper
      const wa = ss(T.white0, T.white1, t);
      if (wa > 0) {
        for (const n of ['ink', 'light', 'crayon', 'top']) {
          const c = L[n].ctx; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'destination-out'; c.globalAlpha = wa; c.fillRect(0, 0, L[n].cv.width, L[n].cv.height); c.restore();
        }
        const c = L.wash.ctx; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = wa; c.fillStyle = '#fff'; c.fillRect(0, 0, L.wash.cv.width, L.wash.cv.height); c.restore();
      }
    }
    if (t >= T.card0) card(L, t);
  }

  function grade(t, E) {
    if (t >= T.room - 0.5 && t < T.eye0) {
      if (waveNow) { E.wave = waveNow; }
    }
  }

  function events() {
    const ev = [];
    ev.push({ t: T.room, type: 'window' });
    ev.push({ t: T.hop, type: 'hop' });
    // crayon strokes: when the crayon is on the glass
    let on = false, t0 = 0;
    for (let i = 0; i <= 400; i++) {
      const u = i / 400, tt = T.draw0 + u * (T.draw1 - T.draw0);
      const c = crayonAt(u);
      if (c.d && !on) { on = true; t0 = tt; }
      if ((!c.d || i === 400) && on) { on = false; ev.push({ t: +t0.toFixed(3), type: 'crayon', dur: +(tt - t0).toFixed(3) }); }
    }
    ev.push({ t: T.ask0, type: 'ask' });
    ev.push({ t: T.red0, type: 'red' });
    ev.push({ t: T.open0, type: 'open' });
    ev.push({ t: T.wave0, type: 'wave' });
    ev.push({ t: T.eye0, type: 'eye' });
    ev.push({ t: T.door0, type: 'door' });
    ev.push({ t: T.count0, type: 'count' });
    ev.push({ t: T.card0 + 1.6, type: 'seal' });
    return ev;
  }

  FS.final = { render, grade, events, T };
})(typeof window !== 'undefined' ? window : globalThis);
