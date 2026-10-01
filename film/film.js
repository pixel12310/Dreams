/*
 * 褪色 · FADING
 * A 60-second procedurally animated short film.
 * 《一个人的世界，是从什么时候开始褪色的？》
 *
 * Everything on screen is drawn in code, every frame:
 *   - a 2D canvas paints the world (parallax layers, the character rig, particles)
 *   - a second 2D canvas paints the overlay (typography, the returning kite)
 *   - a WebGL pass grades the world: hue-selective colour drain (red → yellow →
 *     green → blue), wet-street reflections, glow, vignette, grain, and the final
 *     colour-restoring wave.
 *
 * The film is a pure function of time: FILM.renderAt(t) draws the exact frame
 * for second t, which is what the offline renderer uses to export the video.
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------- constants
  const VW = 1920, VH = 1080, DUR = 60;
  const AX = 730;     // protagonist's screen x
  const FY = 880;     // feet line (depth p = 1)
  const HZ = 620;     // horizon line: baseY(p) = HZ + (FY - HZ) * p
  const PIVY = 700;   // camera zoom pivot (y)
  const TB = 10.55;   // the moment the kite string snaps

  // ---------------------------------------------------------------- math
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const ss = (a, b, x) => smooth(clamp((x - a) / (b - a)));
  const fract = (x) => x - Math.floor(x);
  const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453123);
  const h2 = (a, b) => hash(a * 17.13 + b * 101.7);
  const TAU = Math.PI * 2;
  const mod = (a, n) => ((a % n) + n) % n;
  function noise1(x) {
    const i = Math.floor(x), f = x - i;
    return lerp(hash(i), hash(i + 1), smooth(f)) * 2 - 1;
  }
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const mulc = (a, m) => [a[0] * m[0], a[1] * m[1], a[2] * m[2]];
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);

  // keyframe track with smooth (ease-in-out) interpolation between keys
  function track(keys) {
    return (t) => {
      if (t <= keys[0][0]) return keys[0][1];
      for (let i = 1; i < keys.length; i++) {
        if (t <= keys[i][0]) {
          const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
          const u = smooth((t - t0) / (t1 - t0));
          return Array.isArray(v0) ? mixc(v0, v1, u) : lerp(v0, v1, u);
        }
      }
      return keys[keys.length - 1][1];
    };
  }

  // ---------------------------------------------------------------- palette
  const C = {
    ink: [26, 28, 36],
    red: [222, 52, 50], red2: [244, 104, 88],
    yellow: [252, 204, 64], white: [250, 248, 240], purple: [158, 108, 214],
    orange: [246, 140, 52], pink: [240, 118, 160],
    leaf1: [56, 138, 70], leaf2: [86, 166, 84], leaf3: [134, 198, 108],
    trunk: [92, 64, 48],
    warm: [255, 206, 112],
  };
  const FLOWER = [C.red, C.yellow, C.white, C.purple, C.orange, C.pink, C.red, C.yellow];
  const BUILD = [[198, 182, 160], [170, 98, 82], [114, 130, 150], [96, 150, 162], [216, 208, 192], [140, 132, 150], [182, 120, 96]];
  const CARS = [[204, 56, 50], [242, 190, 44], [62, 112, 192], [64, 150, 100], [226, 226, 230], [44, 46, 54], [150, 156, 164], [230, 120, 40]];
  const UMB = [[214, 62, 62], [244, 182, 40], [72, 162, 112], [236, 122, 50], [192, 82, 152], [46, 46, 54], [226, 70, 90], [250, 210, 70]];

  // ---------------------------------------------------------------- timeline
  const T = {
    v: track([[0, 0], [4.4, 0], [5.3, 420], [10.45, 420], [11.6, 0], [13.2, 0], [14.7, 240], [21.6, 240], [23.6, 285], [30.6, 285], [34.2, 195], [38, 85], [40.2, 0], [60, 0]]),
    age: track([[0, 7], [13.3, 7], [17.6, 18], [21.6, 18], [25.6, 26], [30.6, 26], [34.6, 35], [60, 35]]),
    run: track([[0, 1], [10.3, 1], [11.3, 0], [60, 0]]),
    hunch: track([[0, 0], [30.8, 0], [34.8, 1], [48.9, 1], [51.0, 0.08], [60, 0]]),
    pitch: track([[0, -0.32], [10.4, -0.32], [11.2, -0.8], [12.9, -0.72], [14.1, 0.16], [16.2, 0.03], [30.8, 0.03], [34.8, 0.62], [48.7, 0.62], [50.5, -0.85], [54, -0.72], [60, -0.62]]),
    keepR: track([[0, 1], [11.6, 1], [14.4, 0]]),
    keepY: track([[0, 1], [20.2, 1], [23.4, 0]]),
    keepG: track([[0, 1], [28.2, 1], [31.6, 0]]),
    keepB: track([[0, 1], [36.0, 1], [39.6, 0]]),
    rain: track([[0, 0], [33.0, 0], [35.8, 0.55], [38.4, 1], [51.6, 1], [54.8, 0]]),
    wet: track([[0, 0], [33.6, 0], [37.2, 1], [52, 1], [57, 0.8]]),
    zoom: track([[0, 1], [39.6, 1], [47, 1.2], [51.4, 1.22], [59.4, 0.8], [60, 0.8]]),
    tilt: track([[0, 0], [10.9, 0], [12.3, 150], [13.2, 150], [14.8, 0], [53.4, 0], [59.4, 235], [60, 235]]),
    warp: track([[0, 1], [40.6, 1], [42.4, 6], [45.8, 6], [47.6, 0.3], [51.4, 0.3], [54.5, 1], [60, 1]]),
    rainWarp: track([[0, 1], [47.0, 1], [48.6, 0.1], [51.3, 0.1], [53.4, 0.6], [56, 1]]),
    skyTop: track([[0, [70, 148, 224]], [13, [70, 148, 224]], [17, [74, 118, 196]], [22, [56, 86, 164]], [25.5, [122, 148, 178]], [31, [110, 126, 148]], [34.5, [58, 66, 78]], [51.4, [58, 66, 78]], [55, [40, 120, 216]], [60, [36, 112, 210]]]),
    skyHor: track([[0, [204, 236, 248]], [13, [204, 236, 248]], [17, [252, 214, 150]], [22, [248, 166, 110]], [25.5, [208, 216, 222]], [31, [186, 194, 200]], [34.5, [110, 118, 126]], [51.4, [110, 118, 126]], [55, [180, 222, 246]], [60, [190, 226, 246]]]),
    ambient: track([[0, [1, 1, 1]], [13, [1, 1, 1]], [17.5, [1.02, 0.9, 0.78]], [22, [0.9, 0.74, 0.66]], [25.5, [0.92, 0.94, 0.98]], [31, [0.84, 0.86, 0.9]], [34.5, [0.62, 0.66, 0.72]], [51.4, [0.62, 0.66, 0.72]], [55, [1.04, 1.03, 1.0]]]),
    sunX: track([[0, 1480], [13, 1500], [18, 1560], [22, 1620], [51, 1620], [55, 1560]]),
    sunY: track([[0, 200], [13, 230], [18, 470], [22, 600], [25, 540], [51, 540], [55, 190]]),
    sunA: track([[0, 1], [22, 1], [25, 0.3], [31, 0.15], [34, 0], [51.4, 0], [55, 1]]),
    sunC: track([[0, [255, 248, 220]], [13, [255, 246, 214]], [18, [255, 214, 140]], [22, [255, 160, 96]], [25, [244, 244, 244]], [51.4, [244, 244, 244]], [55, [255, 250, 228]]]),
    storm: track([[0, 0], [31.5, 0], [35.5, 1], [51.4, 1], [54.8, 0]]),
    cloudCover: track([[0, 0.25], [22, 0.35], [25, 0.62], [33, 1], [51.4, 1], [55, 0.18]]),
    lit: track([[0, 0], [15, 0], [19, 0.55], [23, 0.4], [26, 0.25], [33, 0.7], [51.4, 0.7], [55, 0.35]]),
    rainbow: track([[0, 0], [54.2, 0], [57.4, 0.62], [60, 0.62]]),
    crownFull: track([[0, 1], [28.0, 1], [31.6, 0.42], [51.4, 0.42], [53.6, 1]]),
    lightsOn: track([[0, 0], [15.5, 0], [18.5, 1], [24, 1], [26, 0.2], [32, 0.3], [35, 1], [51.4, 1], [56, 0.4]]),
  };

  // accessory / pose weights for the protagonist
  const P = {
    string: track([[0, 1], [12.4, 1], [13.6, 0]]),
    suitcase: track([[0, 0], [15.6, 0], [16.6, 1], [23.2, 1], [24.2, 0]]),
    brief: track([[0, 0], [24.0, 0], [25.0, 1], [31.2, 1], [32.2, 0]]),
    phone: track([[0, 0], [32.0, 0], [33.4, 1], [49.3, 1], [50.2, 0]]),
    reach: track([[0, 0], [50.0, 0], [51.0, 1], [60, 1]]),
    coat: track([[0, 0], [21.8, 0], [25.0, 1]]),
  };

  // integrate the walk: camera x (= protagonist world x) and gait phase
  const STEP = 1 / 240, NT = Math.ceil(DUR / STEP) + 4;
  const camTab = new Float64Array(NT), phiTab = new Float64Array(NT), crowdTab = new Float64Array(NT), rainTab = new Float64Array(NT);
  function heightOf(age) {
    return age <= 18 ? lerp(186, 318, smooth(clamp((age - 7) / 11))) : lerp(318, 332, clamp((age - 18) / 8));
  }
  function strideOf(v, h, run) {
    return 2 * h * lerp(0.2 + 0.19 * clamp(v / 260), 0.62, run);
  }
  for (let i = 0; i < NT - 1; i++) {
    const t = i * STEP, v = T.v(t), h = heightOf(T.age(t)), run = T.run(t);
    camTab[i + 1] = camTab[i] + v * STEP;
    phiTab[i + 1] = phiTab[i] + (v / strideOf(v, h, run)) * STEP;
    crowdTab[i + 1] = crowdTab[i] + T.warp(t) * STEP;
    rainTab[i + 1] = rainTab[i] + T.rainWarp(t) * STEP;
  }
  function tab(arr, t) {
    const x = clamp(t, 0, DUR) / STEP, i = Math.floor(x);
    return lerp(arr[i], arr[i + 1], x - i);
  }
  const camAt = (t) => tab(camTab, t);

  // world layout ------------------------------------------------------------
  // w = the protagonist-plane x that sits at screen centre when an element is centred.
  const wOf = (u, p) => (u - 230) / p + 230;
  const uOf = (w, p) => (w - 230) * p + 230;
  const baseY = (p) => HZ + (FY - HZ) * p;
  const eTown = (w) => ss(3350, 3800, w);
  const eCity = (w) => ss(5350, 5950, w);
  // far layers move so slowly that their edges would show the 'future'; let them follow time instead
  function weff(u, p) {
    const sx = AX + (u - cam.x * p) * cam.z;
    return lerp(cam.x + 230 + (sx - 960) * 0.9, wOf(u, p), ss(0.6, 0.95, p));
  }
  const HOUSE_P = 0.7;
  const HOUSE_U = camAt(18.6) * HOUSE_P;          // the door passes the protagonist at 18.6s
  const STOP_X = camAt(45);
  const CITY_W0 = 5150, CITY_SPAN = 4600;

  // ---------------------------------------------------------------- state
  let W = VW, H = VH, SC = 1;
  let sceneCv, sctx, overCv, octx, glCv, gl, prog, texScene, texOver, uni = {};
  let cam = { x: 0, z: 1, tilt: 0 };
  let ENV = null;
  const handOut = { x: 0, y: 0 };

  // camera transform for a parallax layer (p: horizontal parallax, py: vertical tilt factor)
  function L(ctx, p, py = p) {
    const z = cam.z;
    ctx.setTransform(SC * z, 0, 0, SC * z, SC * (AX - cam.x * p * z), SC * (PIVY + (cam.tilt * py - PIVY) * z));
  }
  function screenSpace(ctx) { ctx.setTransform(SC, 0, 0, SC, 0, 0); }
  function visU(p) {
    return [cam.x * p + (0 - AX) / cam.z, cam.x * p + (VW - AX) / cam.z];
  }
  // place a depth-p object: origin at its base on the ground, scaled by p
  function at(ctx, p, u, py) {
    L(ctx, p, py === undefined ? 0.3 + 0.7 * p : py);
    ctx.translate(u, baseY(p));
    ctx.scale(p, p);
  }
  // near-plane world → screen
  function toScreen(u, v) {
    return [AX + (u - cam.x) * cam.z, PIVY + (v + cam.tilt - PIVY) * cam.z];
  }

  // ---------------------------------------------------------------- environment
  function envAt(t) {
    const E = {};
    E.t = t;
    E.camX = camAt(t);
    E.phi = tab(phiTab, t);
    E.ct = tab(crowdTab, t);
    E.rt = tab(rainTab, t);
    for (const k in T) E[k] = T[k](t);
    E.h = heightOf(E.age);
    E.q = clamp((E.age - 7) / 13);
    E.D = strideOf(E.v, E.h, E.run);
    E.gw = clamp(E.v / 70);
    E.keep = [E.keepR, E.keepY, E.keepG, E.keepB];
    E.amb = E.ambient;
    E.wind = 0.6 + 0.4 * Math.sin(t * 0.7);
    return E;
  }
  const lit = (c) => mulc(c, ENV.amb);
  const haze = (c, k) => mixc(lit(c), ENV.skyHor, k);

  // ================================================================ CHARACTER RIG
  // tapered capsule (round ends of radius ra at a and rb at b)
  function capsule(ctx, ax, ay, bx, by, ra, rb) {
    const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1e-3;
    const nx = -dy / d, ny = dx / d;
    const an = Math.atan2(ny, nx), am = Math.atan2(-ny, -nx);
    ctx.beginPath();
    ctx.moveTo(ax + nx * ra, ay + ny * ra);
    ctx.lineTo(bx + nx * rb, by + ny * rb);
    ctx.arc(bx, by, rb, an, am, true);
    ctx.lineTo(ax - nx * ra, ay - ny * ra);
    ctx.arc(ax, ay, ra, am, an, true);
    ctx.closePath(); ctx.fill();
  }
  function ik2(ax, ay, bx, by, l1, l2, bend) {
    let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
    const maxd = (l1 + l2) * 0.9995;
    if (d > maxd) { bx = ax + (dx / d) * maxd; by = ay + (dy / d) * maxd; dx = bx - ax; dy = by - ay; d = maxd; }
    d = Math.max(d, 1e-3);
    const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const ang = Math.atan2(dy, dx) + bend * a;
    return [ax + Math.cos(ang) * l1, ay + Math.sin(ang) * l1, bx, by];
  }

  /*
   * o: { h, q (0 child → 1 adult), phi, gw (gait weight), run, D (stride),
   *      hunch, pitch, armF:{tx,ty,w}, armB:{tx,ty,w}, coat, dress, hair, col, colB }
   * Draws facing +x with the feet at (0,0). Returns joint positions.
   */
  function drawPerson(ctx, o) {
    const h = o.h, q = o.q;
    const headR = h * lerp(0.1, 0.066, q);
    const legL = h * lerp(0.43, 0.48, q);
    const neck = h * 0.03;
    const torso = h - legL - neck - headR * 2 - h * 0.012;
    const gw = o.gw, run = o.run || 0, D = o.D;
    const beta = lerp(0.6, 0.38, run);
    const lift = h * lerp(0.07, 0.15, run) * gw;
    const hunch = o.hunch || 0, pitch = o.pitch || 0;
    const legs = [];
    let walkH = legL * 0.99;
    for (let i = 0; i < 2; i++) {
      const p = fract(o.phi + i * 0.5);
      let fx, fy = 0, toe = 0, stance;
      if (p < beta) { const s = p / beta; fx = D * beta * (0.5 - s); stance = true; toe = -0.25 * ss(0.75, 1, s); }
      else {
        const s = (p - beta) / (1 - beta);
        fx = D * beta * (-0.5 + smooth(s)); fy = -lift * Math.sin(Math.PI * s); stance = false;
        toe = -0.7 * Math.sin(Math.PI * clamp(s * 1.5)) + 0.3 * ss(0.65, 1, s);
      }
      fx *= gw;
      const nf = fx / (D * beta * 0.5 + 1e-6);
      if (stance) walkH = Math.min(walkH, legL * 0.985 - 0.4 * fx * fx / (2 * legL));
      legs.push({ fx, fy, toe: toe * gw, nf });
    }
    const runH = legL * 0.9 - h * 0.03 * Math.cos(4 * Math.PI * (o.phi - beta / 2));
    let hipH = lerp(walkH, runH, run * gw) - hunch * h * 0.012;
    hipH += (1 - gw) * h * 0.004 * Math.sin((o.breath || 0) * 1.6);
    const hip = [0, -hipH];
    const lean = 0.035 + 0.2 * run * gw + hunch * 0.26 + (o.lean || 0);
    const sh = [hip[0] + Math.sin(lean) * torso, hip[1] - Math.cos(lean) * torso];
    sh[0] += hunch * h * 0.015;
    const neckAng = lean + hunch * 0.3 + pitch * 0.45;
    const hc = [sh[0] + Math.sin(neckAng) * (neck + headR * 0.92), sh[1] - Math.cos(neckAng) * (neck + headR * 0.92)];
    const headAng = pitch * 0.8 + hunch * 0.12;
    const ux = Math.sin(lean), uy = -Math.cos(lean);   // spine direction (up)
    const nx = -uy, ny = ux;                           // facing normal (front)

    const col = rgba(o.col), colB = rgba(o.colB || o.col);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const thW = h * lerp(0.07, 0.058, q), shW = h * lerp(0.058, 0.044, q), armW = h * lerp(0.05, 0.04, q);
    const ua = h * lerp(0.16, 0.18, q), la = h * lerp(0.17, 0.2, q);
    const A = lerp(0.42, 0.95, run) * gw * (1 - 0.65 * hunch);

    const kidT = 1 + (1 - q) * 0.18;
    function leg(i, c) {
      const L0 = legs[i];
      const ank = [hip[0] + L0.fx, L0.fy - h * 0.035];
      const k = ik2(hip[0], hip[1], ank[0], ank[1], legL * 0.5, legL * 0.5, -1);
      ctx.fillStyle = c;
      capsule(ctx, hip[0], hip[1], k[0], k[1], h * 0.04 * kidT, h * 0.028 * kidT);
      capsule(ctx, k[0], k[1], k[2], k[3], h * 0.027 * kidT, h * 0.019 * kidT);
      // shoe
      const fl = h * lerp(0.085, 0.072, q);
      capsule(ctx, k[2] - fl * 0.12, k[3] + h * 0.01, k[2] + Math.cos(L0.toe) * fl, k[3] + h * 0.014 - Math.sin(L0.toe) * fl, h * 0.024 * kidT, h * 0.017 * kidT);
      return k;
    }
    function arm(i, c, spec) {
      const sx = sh[0] + (i === 0 ? 0.008 : -0.008) * h - nx * h * 0.006, sy = sh[1] + h * 0.016;
      const theta = -A * legs[i].nf + (i === 1 ? -0.04 : 0.02);
      const bend = lerp(0.22, 1.5, run) + 0.3 * Math.max(0, theta) / (A + 1e-3) * gw + hunch * 0.15;
      const ex = sx + Math.sin(theta) * ua, ey = sy + Math.cos(theta) * ua;
      let hx = ex + Math.sin(theta + bend) * la, hy = ey + Math.cos(theta + bend) * la;
      if (spec && spec.w > 0) {
        hx = lerp(hx, sx + spec.tx * h, spec.w); hy = lerp(hy, sy + spec.ty * h, spec.w);
      }
      const e = ik2(sx, sy, hx, hy, ua, la, 1);
      ctx.fillStyle = c;
      capsule(ctx, sx, sy, e[0], e[1], h * 0.028 * kidT, h * 0.021 * kidT);
      capsule(ctx, e[0], e[1], e[2], e[3], h * 0.021 * kidT, h * 0.016 * kidT);
      ctx.beginPath(); ctx.ellipse(e[2], e[3], h * 0.022 * kidT, h * 0.026 * kidT, 0, 0, TAU); ctx.fill();
      return [e[2], e[3], e[0], e[1]];
    }

    // back limbs (slightly lighter so the gait reads)
    const handB = arm(1, colB, o.armB);
    if (o.preBack) o.preBack(handB);
    const kB = leg(1, colB);
    const kF = leg(0, col);
    // torso: a soft profile built along the spine (hip → shoulder)
    const kid = 1 - q;
    const prof = [ // [fraction along spine, front, back] in units of h
      [-0.06, 0.03, 0.045],
      [0.0, 0.058 + kid * 0.01, 0.07],
      [0.32, 0.05 + kid * 0.022, 0.05],
      [0.68, 0.068, 0.056 + hunch * 0.012],
      [0.9, 0.056, 0.06 + hunch * 0.02],
      [1.04, 0.02, 0.04 + hunch * 0.01],
    ];
    const pf = [], pb = [];
    for (const [f, fr, bk] of prof) {
      const cx = hip[0] + ux * torso * f, cy = hip[1] + uy * torso * f;
      pf.push([cx + nx * fr * h, cy + ny * fr * h]); pb.push([cx - nx * bk * h, cy - ny * bk * h]);
    }
    const ring = pf.concat(pb.reverse());
    ctx.fillStyle = col;
    ctx.beginPath();
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let m0 = mid(ring[ring.length - 1], ring[0]);
    ctx.moveTo(m0[0], m0[1]);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], m = mid(a, b);
      ctx.quadraticCurveTo(a[0], a[1], m[0], m[1]);
    }
    ctx.closePath(); ctx.fill();
    // coat / dress
    const coat = o.coat || 0, dress = o.dress || 0;
    if (coat > 0.01 || dress > 0.01) {
      const frontK = Math.max(kF[0], kB[0]);
      const hemY = hip[1] + h * (dress ? 0.28 : 0.22) * Math.max(coat, dress);
      const sway = gw * h * 0.018 * Math.sin(TAU * o.phi * 2);
      const flare = dress ? h * 0.1 : h * 0.06;
      ctx.beginPath();
      const c0 = pf[3], c1 = pb[pb.length - 3];
      ctx.moveTo(c0[0], c0[1]);
      ctx.quadraticCurveTo(hip[0] + h * 0.07, hip[1] - h * 0.05, Math.max(hip[0] + flare, lerp(hip[0], frontK, 0.7)) + h * 0.015, hemY);
      ctx.lineTo(hip[0] - flare - h * 0.025 - sway - gw * h * 0.015, hemY - h * 0.008);
      ctx.quadraticCurveTo(hip[0] - h * 0.085, hip[1] - h * 0.04, c1[0], c1[1]);
      ctx.closePath(); ctx.fill();
    }
    // neck & head
    capsule(ctx, sh[0] + nx * h * 0.005, sh[1] + ny * h * 0.005, hc[0], hc[1], h * 0.03, h * 0.026);
    ctx.save();
    ctx.translate(hc[0], hc[1]); ctx.rotate(headAng);
    ctx.beginPath(); ctx.ellipse(0, 0, headR * 1.02, headR, 0, 0, TAU); ctx.fill();
    // nose & chin
    ctx.beginPath(); ctx.moveTo(headR * 0.86, -headR * 0.15); ctx.lineTo(headR * 1.16, headR * 0.12); ctx.lineTo(headR * 0.8, headR * 0.3); ctx.closePath(); ctx.fill();
    // hair
    const hair = o.hair || 'adult';
    if (hair === 'child') {
      ctx.lineWidth = headR * 0.16; ctx.strokeStyle = col;
      ctx.beginPath(); ctx.moveTo(-headR * 0.1, -headR * 0.92); ctx.quadraticCurveTo(headR * 0.1, -headR * 1.45, headR * 0.42, -headR * 1.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-headR * 0.4, -headR * 0.85); ctx.quadraticCurveTo(-headR * 0.4, -headR * 1.3, -headR * 0.05, -headR * 1.32); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-headR * 0.12, -headR * 0.2, headR * 1.06, headR * 0.95, -0.2, Math.PI * 0.9, Math.PI * 2.05); ctx.fill();
    } else if (hair === 'bun') {
      ctx.beginPath(); ctx.arc(-headR * 0.95, -headR * 0.45, headR * 0.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-headR * 0.2, -headR * 0.15, headR * 1.08, headR * 1.0, -0.2, Math.PI * 0.85, Math.PI * 2.0); ctx.fill();
    } else {
      ctx.beginPath(); ctx.ellipse(-headR * 0.12, -headR * 0.18, headR * 1.08, headR * 0.98, -0.25, Math.PI * 0.8, Math.PI * 2.08); ctx.fill();
      ctx.beginPath(); ctx.moveTo(headR * 0.2, -headR * 1.02); ctx.quadraticCurveTo(headR * 0.95, -headR * 1.05, headR * 0.98, -headR * 0.45); ctx.lineTo(headR * 0.5, -headR * 0.7); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    const handF = arm(0, col, o.armF);
    return { hip, sh, hc, headR, handF, handB, kF, kB, h };
  }

  // ================================================================ PROPS
  function drawKite(ctx, x, y, s, rot, t, alpha = 1) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.globalAlpha *= alpha;
    // tail
    ctx.strokeStyle = 'rgba(250,244,230,0.9)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 92);
    const pts = [];
    for (let i = 1; i <= 26; i++) {
      const k = i / 26, px = Math.sin(t * 5.2 - k * 6.5) * 26 * k, py = 92 + k * 210;
      ctx.lineTo(px, py); if (i % 6 === 0) pts.push([px, py]);
    }
    ctx.stroke();
    for (let i = 0; i < pts.length; i++) {
      const [px, py] = pts[i];
      ctx.fillStyle = rgba(i % 2 ? C.yellow : C.red2);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 13, py - 8); ctx.lineTo(px - 13, py + 8); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 13, py - 8); ctx.lineTo(px + 13, py + 8); ctx.closePath(); ctx.fill();
    }
    // sail
    ctx.fillStyle = rgba(C.red);
    ctx.beginPath(); ctx.moveTo(0, -78); ctx.lineTo(56, -8); ctx.lineTo(0, 92); ctx.lineTo(-56, -8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(C.red2);
    ctx.beginPath(); ctx.moveTo(0, -78); ctx.lineTo(56, -8); ctx.lineTo(0, -8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-56, -8); ctx.lineTo(0, 92); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(60,24,20,0.75)'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(0, -78); ctx.lineTo(0, 92); ctx.moveTo(-56, -8); ctx.lineTo(56, -8); ctx.stroke();
    ctx.restore();
  }

  function cloud(ctx, x, y, s, seed, top, bot, a) {
    const n = 5 + Math.floor(hash(seed) * 3);
    ctx.save();
    ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(0, y - 150 * s, 0, y);
    g.addColorStop(0, rgba(top)); g.addColorStop(1, rgba(bot));
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const cx = x + (k - 0.5) * 300 * s, r = (45 + 50 * Math.sin(Math.PI * k) + hash(seed + i) * 25) * s;
      const cy = y - r * 0.55 - hash(seed + i * 3) * 18 * s;
      ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, TAU);
    }
    ctx.rect(x - 160 * s, y - 40 * s, 320 * s, 40 * s);
    ctx.fill();
    // cut a flat base by painting nothing below y (clouds sit on y)
    ctx.restore();
  }

  function tree(ctx, seed, s, full, sway, cols) {
    // origin at base; size scale s
    const tw = 16 * s, th = 120 * s;
    ctx.fillStyle = rgba(cols.trunk);
    ctx.beginPath(); ctx.moveTo(-tw / 2, 0); ctx.lineTo(-tw * 0.3, -th); ctx.lineTo(tw * 0.3, -th); ctx.lineTo(tw / 2, 0); ctx.closePath(); ctx.fill();
    const n = 9;
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = rgba(cols.leaf[layer]);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (layer > 0 && hash(seed + i * 7 + layer) > 0.75) continue;
        if (hash(seed + i * 13 + layer * 3) > full + 0.08) continue;
        const a = (i / n) * TAU + hash(seed + i) * 0.6;
        const rr = (layer === 0 ? 62 : layer === 1 ? 46 : 26) * s * (0.7 + 0.3 * hash(seed + i * 5));
        const cx = Math.cos(a) * 50 * s * (1 - layer * 0.25) + sway * s * (1 + layer) - layer * 10 * s;
        const cy = -th - 55 * s + Math.sin(a) * 42 * s * (1 - layer * 0.25) - layer * 18 * s;
        ctx.moveTo(cx + rr, cy); ctx.arc(cx, cy, rr, 0, TAU);
      }
      ctx.fill();
    }
  }

  function flower(ctx, x, y, s, c, sway, kind) {
    const stem = (28 + kind * 14) * s;
    const tx = x + sway * stem * 0.5, ty = y - stem;
    ctx.strokeStyle = 'rgb(70,128,58)'; ctx.lineWidth = 2.2 * s;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x, y - stem * 0.6, tx, ty); ctx.stroke();
    const r = (5 + kind * 2.2) * s;
    ctx.fillStyle = rgba(c);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + sway;
      const px = tx + Math.cos(a) * r, py = ty + Math.sin(a) * r * 0.8;
      ctx.moveTo(px + r * 0.75, py); ctx.arc(px, py, r * 0.75, 0, TAU);
    }
    ctx.fill();
    ctx.fillStyle = 'rgb(250,214,90)';
    ctx.beginPath(); ctx.arc(tx, ty, r * 0.5, 0, TAU); ctx.fill();
  }

  function building(ctx, x, w, hgt, c, seed, litAmt, ambient) {
    ctx.fillStyle = rgba(c);
    ctx.fillRect(x, -hgt, w, hgt);
    // roof furniture
    if (hash(seed + 2) > 0.5) { ctx.fillRect(x + w * 0.2, -hgt - 18, w * 0.25, 18); }
    if (hash(seed + 3) > 0.7) { ctx.fillRect(x + w * 0.7, -hgt - 46, 4, 46); }
    // cornice
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x, -hgt, w, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x, -hgt, w * 0.08, hgt);
    const cols = Math.max(1, Math.floor((w - 26) / 34)), rows = Math.max(1, Math.floor((hgt - 50) / 46));
    const gx = (w - cols * 34) / 2 + 8;
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        const hv = h2(seed + r * 3.1, k * 1.7 + seed);
        const on = hv < litAmt;
        ctx.fillStyle = on ? `rgba(255,${206 + (hv * 30) | 0},120,${0.9})` : rgba(mulc([70, 82, 100], ambient), 0.55);
        ctx.fillRect(x + gx + k * 34, -hgt + 34 + r * 46, 18, 26);
      }
    }
  }

  function car(ctx, len, c, lights, dir) {
    // side view, origin at road contact, facing +x (scale -1 for left)
    const hgt = len * 0.27;
    ctx.fillStyle = rgba(c);
    ctx.beginPath();
    ctx.moveTo(-len / 2 + 12, -14); ctx.lineTo(-len / 2, -hgt * 0.45);
    ctx.quadraticCurveTo(-len / 2, -hgt * 0.62, -len * 0.4, -hgt * 0.64);
    ctx.lineTo(-len * 0.28, -hgt * 0.66); ctx.lineTo(-len * 0.18, -hgt); ctx.lineTo(len * 0.14, -hgt);
    ctx.lineTo(len * 0.27, -hgt * 0.64); ctx.lineTo(len * 0.44, -hgt * 0.56);
    ctx.quadraticCurveTo(len / 2, -hgt * 0.5, len / 2, -hgt * 0.3); ctx.lineTo(len / 2 - 8, -14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(40,52,66,0.85)';
    ctx.beginPath(); ctx.moveTo(-len * 0.24, -hgt * 0.67); ctx.lineTo(-len * 0.16, -hgt * 0.93); ctx.lineTo(len * 0.12, -hgt * 0.93); ctx.lineTo(len * 0.23, -hgt * 0.66); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(c); ctx.fillRect(-len * 0.03, -hgt * 0.95, len * 0.03, hgt * 0.3);
    ctx.fillStyle = '#16171b';
    for (const wx of [-len * 0.3, len * 0.3]) { ctx.beginPath(); ctx.arc(wx, -16, hgt * 0.24, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#9a9ea6';
    for (const wx of [-len * 0.3, len * 0.3]) { ctx.beginPath(); ctx.arc(wx, -16, hgt * 0.1, 0, TAU); ctx.fill(); }
    if (lights > 0) {
      ctx.fillStyle = `rgba(255,250,230,${lights})`; ctx.fillRect(len / 2 - 10, -hgt * 0.48, 10, 8);
      ctx.fillStyle = `rgba(255,60,50,${lights})`; ctx.fillRect(-len / 2, -hgt * 0.5, 8, 9);
    }
  }

  function umbrella(ctx, x, y, r, c, open) {
    if (open <= 0.01) return;
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * 0.9); ctx.stroke();
    const w = r * open;
    ctx.fillStyle = rgba(c);
    ctx.beginPath(); ctx.moveTo(-w, -r * 0.75);
    ctx.quadraticCurveTo(-w * 0.9, -r * 1.45, 0, -r * 1.48); ctx.quadraticCurveTo(w * 0.9, -r * 1.45, w, -r * 0.75);
    for (let i = 4; i >= 0; i--) { const xx = lerp(-w, w, i / 4); ctx.quadraticCurveTo(xx + w / 8, -r * 0.88, xx, -r * 0.75); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.moveTo(-w * 0.6, -r * 0.82); ctx.quadraticCurveTo(-w * 0.5, -r * 1.36, 0, -r * 1.46); ctx.quadraticCurveTo(-w * 0.2, -r * 1.2, -w * 0.25, -r * 0.8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function glow(ctx, x, y, r, c, a) {
    if (a <= 0.003) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(c, a)); g.addColorStop(0.35, rgba(c, a * 0.35)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ================================================================ SCENE
  function drawSky(ctx, E) {
    screenSpace(ctx);
    const off = E.tilt * 0.25 * E.zoom;
    const g = ctx.createLinearGradient(0, -200 + off, 0, 820 + off);
    g.addColorStop(0, rgba(E.skyTop)); g.addColorStop(0.6, rgba(mixc(E.skyTop, E.skyHor, 0.62))); g.addColorStop(1, rgba(E.skyHor));
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    // sun
    if (E.sunA > 0.01) {
      L(ctx, 0.02, 0.3);
      const sx = E.sunX - AX + cam.x * 0.02, sy = E.sunY;
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, sx, sy, 420, E.sunC, 0.2 * E.sunA);
      glow(ctx, sx, sy, 130, E.sunC, 0.32 * E.sunA);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = rgba(mixc(E.sunC, [255, 255, 255], 0.5), E.sunA);
      ctx.beginPath(); ctx.arc(sx, sy, 58, 0, TAU); ctx.fill();
    }
    // rainbow
    if (E.rainbow > 0.01) {
      L(ctx, 0.02, 0.35);
      const cx = 1250 - AX + cam.x * 0.02, cy = 960, R0 = 860;
      const bands = [[230, 60, 60], [244, 140, 50], [250, 214, 70], [90, 190, 100], [70, 150, 230], [90, 90, 200], [150, 90, 200]];
      ctx.globalCompositeOperation = 'screen';
      ctx.lineWidth = 20;
      for (let i = 0; i < bands.length; i++) {
        ctx.strokeStyle = rgba(bands[i], E.rainbow * (0.75 - i * 0.03));
        ctx.beginPath(); ctx.arc(cx, cy, R0 - i * 19, Math.PI * 1.06, Math.PI * 1.94); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function drawClouds(ctx, E, t) {
    const p = 0.05;
    L(ctx, p, 0.28);
    const [u0, u1] = visU(p);
    const drift = t * 9;
    const sp = 430;
    const top = mixc([255, 255, 255], E.skyHor, 0.12);
    const topL = mixc(lit(top), [90, 98, 108], E.storm);
    const botL = mixc(mixc(lit([214, 224, 236]), E.skyHor, 0.3), [70, 78, 88], E.storm);
    for (let k = Math.floor((u0 - 400 + drift) / sp); k <= Math.ceil((u1 + 400 + drift) / sp); k++) {
      if (hash(k * 3.3) > E.cloudCover + 0.15) continue;
      const x = k * sp + hash(k) * 200 - drift;
      const y = 170 + hash(k + 9) * 260;
      const s = 0.55 + hash(k + 4) * 0.75 + E.storm * 0.5;
      cloud(ctx, x, y, s, k * 11, topL, botL, 0.92);
    }
    if (E.storm > 0.01) {
      screenSpace(ctx);
      for (let i = 0; i < 9; i++) {
        const x = mod(i * 260 - t * 14 + hash(i) * 180, 2300) - 200, y = 40 + hash(i + 3) * 160;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 420);
        g.addColorStop(0, `rgba(66,72,80,${0.75 * E.storm})`); g.addColorStop(1, 'rgba(66,72,80,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 420, y - 420, 840, 840);
      }
    }
  }

  function hills(ctx, E, p, amp, freq, seed, col, hz, withTrees) {
    const py = 0.3 + 0.7 * p;
    L(ctx, p, py);
    const [u0, u1] = visU(p);
    const base = baseY(p);
    const c = haze(col, hz);
    ctx.fillStyle = rgba(c);
    ctx.beginPath(); ctx.moveTo(u0 - 20, 1400);
    const step = 24 / cam.z;
    for (let u = u0 - 20; u <= u1 + 20; u += step) {
      const y = base - amp * (0.55 + 0.3 * noise1(u * freq + seed) + 0.15 * noise1(u * freq * 3.1 + seed * 2));
      ctx.lineTo(u, y);
    }
    ctx.lineTo(u1 + 20, 1400); ctx.closePath(); ctx.fill();
    if (withTrees) {
      const sp = 70;
      for (let k = Math.floor(u0 / sp) - 1; k <= Math.ceil(u1 / sp) + 1; k++) {
        if (hash(k * 1.3 + seed) > 0.42) continue;
        const u = k * sp + hash(k + seed) * 40;
        const w = weff(u, p);
        if (eCity(w) > 0.8) continue;
        const y = base - amp * (0.55 + 0.3 * noise1(u * freq + seed) + 0.15 * noise1(u * freq * 3.1 + seed * 2));
        ctx.save(); ctx.translate(u, y + 6); const s = p * (0.55 + hash(k) * 0.4);
        const tc = { trunk: haze(C.trunk, hz), leaf: [haze(C.leaf1, hz * 0.9), haze(C.leaf2, hz * 0.9), haze(C.leaf3, hz * 0.9)] };
        tree(ctx, k * 7 + seed, s, 1, Math.sin(E.t * 1.3 + k) * 2, tc);
        ctx.restore();
      }
    }
  }

  function skyline(ctx, E, p, seed, hz, hMin, hMax) {
    L(ctx, p, 0.3 + 0.7 * p);
    const [u0, u1] = visU(p);
    const base = baseY(p) + 4;
    const sp = 120;
    for (let k = Math.floor(u0 / sp) - 2; k <= Math.ceil(u1 / sp) + 1; k++) {
      const u = k * sp + hash(k + seed) * 40;
      const a = eCity(weff(u, p));
      if (a < 0.02) continue;
      const w = 90 + hash(k * 2 + seed) * 120;
      const hgt = lerp(hMin, hMax, hash(k * 3 + seed)) * a;
      const c = haze(BUILD[Math.floor(hash(k * 5 + seed) * BUILD.length)], hz);
      ctx.save(); ctx.translate(u, base);
      building(ctx, 0, w, hgt, c, k * 13 + seed, E.lit * 0.8, E.amb);
      ctx.fillStyle = rgba(E.skyHor, hz * 0.6); ctx.fillRect(0, -hgt - 50, w, hgt + 50);
      ctx.restore();
    }
  }

  function townHouses(ctx, E, p, hz) {
    L(ctx, p, 0.3 + 0.7 * p);
    const [u0, u1] = visU(p);
    const sp = 230;
    for (let k = Math.floor(u0 / sp) - 2; k <= Math.ceil(u1 / sp) + 1; k++) {
      const u = k * sp + hash(k * 1.9) * 70;
      const w = weff(u, p);
      const a = eTown(w) * (1 - eCity(w));
      if (a < 0.02 || hash(k * 4.1) > 0.8) continue;
      ctx.save(); ctx.translate(u, baseY(p)); ctx.scale(p, p);
      const hw = 150 + hash(k) * 90, hh = 120 + hash(k + 1) * 70;
      ctx.globalAlpha = a;
      ctx.fillStyle = rgba(haze(mixc([236, 222, 196], [206, 190, 170], hash(k + 2)), hz));
      ctx.fillRect(-hw / 2, -hh, hw, hh);
      ctx.fillStyle = rgba(haze(hash(k + 3) > 0.5 ? [186, 80, 64] : [120, 92, 86], hz));
      ctx.beginPath(); ctx.moveTo(-hw / 2 - 16, -hh); ctx.lineTo(0, -hh - 80 - hash(k) * 30); ctx.lineTo(hw / 2 + 16, -hh); ctx.closePath(); ctx.fill();
      const lit2 = E.lightsOn;
      for (let j = 0; j < 2; j++) {
        const on = hash(k * 7 + j) < 0.75;
        ctx.fillStyle = on && lit2 > 0.05 ? rgba(C.warm, 0.35 + 0.6 * lit2) : rgba(haze([90, 100, 116], hz));
        ctx.fillRect(-hw / 2 + 28 + j * (hw - 86), -hh + 40, 30, 36);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function cityBlock(ctx, E, p, hz) {
    L(ctx, p, 0.3 + 0.7 * p);
    const [u0, u1] = visU(p);
    let k = Math.floor((u0 - 400) / 260);
    for (; k <= Math.ceil(u1 / 260) + 1; k++) {
      const u = k * 260 + hash(k * 2.7) * 40;
      const a = eCity(weff(u, p));
      if (a < 0.02) continue;
      const wd = 200 + hash(k * 1.1) * 140, hgt = (360 + hash(k * 3.7) * 520) * a;
      const c = haze(BUILD[Math.floor(hash(k * 5.3) * BUILD.length)], hz);
      ctx.save(); ctx.translate(u, baseY(p)); ctx.scale(p, p);
      building(ctx, -wd / 2, wd, hgt, c, k * 29, E.lit, E.amb);
      // awning / shop front
      ctx.fillStyle = rgba(haze(UMB[Math.floor(hash(k * 8.1) * UMB.length)], hz));
      ctx.fillRect(-wd / 2 + 10, -92, wd - 20, 16);
      ctx.fillStyle = E.lightsOn > 0.1 ? rgba(C.warm, 0.25 + 0.5 * E.lightsOn) : rgba(haze([80, 90, 104], hz));
      ctx.fillRect(-wd / 2 + 20, -74, wd - 40, 60);
      ctx.restore();
    }
  }

  // ground bands per era, blended along x
  function groundBands(ctx, E) {
    L(ctx, 1, 1);
    const [u0, u1] = visU(1);
    const x0 = u0 - 50, x1 = u1 + 50;
    // meadow field
    const yTop = baseY(0.58);
    let g = ctx.createLinearGradient(0, yTop, 0, 1300);
    g.addColorStop(0, rgba(lit([150, 200, 96]))); g.addColorStop(0.35, rgba(lit([110, 176, 74]))); g.addColorStop(1, rgba(lit([72, 132, 54])));
    ctx.fillStyle = g; ctx.fillRect(x0, yTop, x1 - x0, 1300 - yTop);
    // town path (stone)
    const tA = 3350, tB = 3800, cA = 5200, cB = 5900;
    if (x1 > tA && x0 < cB) {
      const gx = ctx.createLinearGradient(tA - 100, 0, tB, 0);
      const pc = lit([204, 184, 152]);
      gx.addColorStop(0, rgba(pc, 0)); gx.addColorStop(1, rgba(pc, 1));
      ctx.fillStyle = gx;
      const y0 = baseY(0.95), y1 = baseY(1.06);
      ctx.fillRect(Math.max(x0, tA - 100), y0, Math.min(x1, cB) - Math.max(x0, tA - 100), y1 - y0);
      ctx.fillStyle = rgba(lit([150, 132, 110]), 0.5);
      for (let k = Math.floor(Math.max(x0, tA) / 46); k < Math.min(x1, cA) / 46; k++) {
        const xx = k * 46 + hash(k) * 10; ctx.fillRect(xx, y0 + 2 + hash(k + 1) * 10, 18 + hash(k + 2) * 10, 2);
      }
    }
    // city: far sidewalk, road, curb, near sidewalk
    if (x1 > cA) {
      const xs = Math.max(x0, cA);
      const fade = (c) => { const gg = ctx.createLinearGradient(cA, 0, cB, 0); gg.addColorStop(0, rgba(c, 0)); gg.addColorStop(1, rgba(c, 1)); return gg; };
      ctx.fillStyle = fade(lit([150, 148, 144])); ctx.fillRect(xs, baseY(0.68), x1 - xs, baseY(0.78) - baseY(0.68));
      ctx.fillStyle = fade(lit([72, 74, 80])); ctx.fillRect(xs, baseY(0.78), x1 - xs, baseY(0.94) - baseY(0.78));
      ctx.fillStyle = fade(lit([196, 194, 188])); ctx.fillRect(xs, baseY(0.94), x1 - xs, 8);
      const gs = ctx.createLinearGradient(0, baseY(0.94) + 8, 0, 1300);
      gs.addColorStop(0, rgba(lit([168, 166, 160]))); gs.addColorStop(1, rgba(lit([120, 118, 116])));
      ctx.save(); ctx.globalAlpha = 1;
      ctx.fillStyle = fade(lit([162, 160, 154])); ctx.fillRect(xs, baseY(0.94) + 8, x1 - xs, 1300);
      ctx.restore();
      // lane dashes (depth 0.86)
      L(ctx, 0.86, 0.3 + 0.7 * 0.86);
      const [a0, a1] = visU(0.86);
      ctx.fillStyle = rgba(lit([210, 206, 190]), 0.7);
      for (let k = Math.floor(a0 / 140); k <= a1 / 140; k++) {
        const xx = k * 140; if (eCity(wOf(xx, 0.86)) < 0.5) continue;
        ctx.fillRect(xx, baseY(0.86) - 2, 70, 4);
      }
      // sidewalk seams (depth 1..1.6)
      L(ctx, 1, 1);
      ctx.strokeStyle = rgba(lit([120, 118, 114]), 0.45); ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = Math.floor(u0 / 150); k <= u1 / 150 + 1; k++) {
        const xx = k * 150; if (eCity(xx) < 0.5) continue;
        ctx.moveTo(xx, baseY(0.95) + 8); ctx.lineTo(xx + (xx - cam.x) * 0.5, 1300);
      }
      ctx.moveTo(Math.max(x0, cB), baseY(1.25)); ctx.lineTo(x1, baseY(1.25));
      ctx.stroke();
    }
    // global ground shading toward the bottom
    screenSpace(ctx);
    g = ctx.createLinearGradient(0, 860, 0, VH);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.16)');
    ctx.fillStyle = g; ctx.fillRect(0, 860, VW, VH - 860);
  }

  function grassRow(ctx, E, p, t) {
    L(ctx, p, 0.3 + 0.7 * p);
    const [u0, u1] = visU(p);
    const y = baseY(p);
    const sp = 18;
    ctx.fillStyle = rgba(lit(mixc([62, 128, 52], [96, 160, 70], hash(p * 10))));
    ctx.beginPath();
    for (let k = Math.floor(u0 / sp); k <= u1 / sp; k++) {
      const u = k * sp + hash(k + p * 100) * sp;
      if (eTown(wOf(u, p)) > 0.98 && Math.abs(p - 1) < 0.07) continue;
      if (hash(k * 5.1 + p) < eCity(wOf(u, p)) * 1.3 - 0.1) continue;
      const hh = (10 + hash(k * 3 + p) * 16) * p;
      const sw = Math.sin(t * 2.2 + u * 0.02) * 4 * p;
      ctx.moveTo(u - 3 * p, y); ctx.lineTo(u + sw, y - hh); ctx.lineTo(u + 3 * p, y);
      ctx.moveTo(u + 2 * p, y); ctx.lineTo(u + 7 * p + sw, y - hh * 0.7); ctx.lineTo(u + 6 * p, y);
    }
    ctx.fill();
  }

  function flowerRow(ctx, E, p, t, ri) {
    L(ctx, p, 0.3 + 0.7 * p);
    const [u0, u1] = visU(p);
    const y = baseY(p);
    const sp = 54;
    for (let k = Math.floor(u0 / sp) - 1; k <= u1 / sp + 1; k++) {
      if (h2(k, ri) > 0.62) continue;
      const u = k * sp + h2(k + 3, ri) * sp;
      const w = wOf(u, p);
      const town = eTown(w);
      if (h2(k, ri + 4) < eCity(w) * 1.4 - 0.05) continue;
      if (town > 0.5 && h2(k, ri + 9) > 0.25) continue;
      // flowers grow in drifts, with breathing room between them
      if (h2(k, ri + 6) > 0.3 + 0.7 * clamp(noise1(u * 0.0045 / p + ri * 3.1) * 1.1 + 0.25)) continue;
      const c = lit(FLOWER[Math.floor(h2(k + 7, ri) * FLOWER.length)]);
      const sway = Math.sin(t * 2.0 + u * 0.013 + ri) * 0.22 * E.wind;
      flower(ctx, u, y + h2(k, ri + 1) * 6, p, c, sway, Math.floor(h2(k + 1, ri) * 3));
    }
  }

  // the cottage at the meadow's edge, mother in the doorway
  function drawHome(ctx, E, t) {
    const p = HOUSE_P, S = 1.5;
    const [u0, u1] = visU(p);
    if (HOUSE_U + 700 * p < u0 || HOUSE_U - 700 * p > u1) return;
    at(ctx, p, HOUSE_U);
    const wall = lit([238, 224, 198]), roof = lit([196, 74, 56]), wood = lit([112, 74, 54]);
    const lamp = E.lightsOn;
    ctx.save(); ctx.scale(S, S);
    // house body, set back from the fence
    ctx.save(); ctx.translate(0, -60);
    ctx.fillStyle = rgba(wall); ctx.fillRect(-250, -250, 500, 250);
    ctx.fillStyle = rgba(mulc(wall, [0.86, 0.84, 0.82])); ctx.fillRect(-250, -250, 500, 16); ctx.fillRect(-250, -10, 500, 10);
    ctx.fillStyle = rgba(lit([160, 92, 74])); ctx.fillRect(130, -410, 44, 110);
    ctx.fillStyle = rgba(roof);
    ctx.beginPath(); ctx.moveTo(-292, -242); ctx.lineTo(0, -420); ctx.lineTo(292, -242); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(mulc(roof, [0.78, 0.78, 0.78])); ctx.fillRect(-292, -248, 584, 12);
    // round attic window
    ctx.fillStyle = rgba(wood); ctx.beginPath(); ctx.arc(0, -320, 24, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba(mixc(lit([120, 150, 176]), C.warm, 0.2 + 0.8 * lamp)); ctx.beginPath(); ctx.arc(0, -320, 18, 0, TAU); ctx.fill();
    for (const wx of [-200, 124]) {
      ctx.fillStyle = rgba(wood); ctx.fillRect(wx - 6, -206, 82, 100);
      ctx.fillStyle = rgba(mixc(lit([120, 150, 176]), C.warm, 0.2 + 0.8 * lamp)); ctx.fillRect(wx, -200, 70, 88);
      ctx.fillStyle = rgba(wood); ctx.fillRect(wx + 32, -200, 6, 88); ctx.fillRect(wx, -160, 70, 6);
      ctx.fillStyle = rgba(lit([120, 80, 56])); ctx.fillRect(wx - 8, -106, 86, 14);
      for (let j = 0; j < 6; j++) { ctx.fillStyle = rgba(lit(j % 2 ? C.red : C.pink)); ctx.beginPath(); ctx.arc(wx + 3 + j * 14, -110, 7.5, 0, TAU); ctx.fill(); }
    }
    // the open door and the light inside
    ctx.fillStyle = rgba(wood); ctx.fillRect(-56, -190, 112, 190);
    ctx.fillStyle = rgba(mixc(lit([84, 66, 58]), [255, 212, 140], 0.15 + 0.85 * lamp)); ctx.fillRect(-46, -182, 92, 182);
    ctx.fillStyle = rgba(mulc(wood, [0.8, 0.8, 0.8])); ctx.fillRect(-46, -182, 14, 182);
    ctx.restore();
    // garden path and steps
    ctx.fillStyle = rgba(lit([210, 190, 156]));
    ctx.beginPath(); ctx.moveTo(-50, -60); ctx.lineTo(50, -60); ctx.lineTo(70, 0); ctx.lineTo(-70, 0); ctx.closePath(); ctx.fill();
    // little tree
    ctx.save(); ctx.translate(-370, -50);
    tree(ctx, 77, 1.3, 1, Math.sin(t * 1.2) * 3, { trunk: lit(C.trunk), leaf: [lit(C.leaf1), lit(C.leaf2), lit(C.leaf3)] });
    ctx.restore();
    ctx.restore();
    // mother at the door: she watches him come home, waves, then turns to watch him go
    const wave = ss(16.2, 16.9, t) * (1 - ss(23.2, 24.0, t));
    const turn = lerp(-1, 1, ss(18.3, 18.9, t));
    ctx.save(); ctx.translate(-4, -60 * S);
    ctx.scale(turn, 1);
    drawPerson(ctx, {
      h: 250, q: 1, phi: 0, gw: 0, run: 0, D: 1, hunch: 0.06, pitch: 0.05 + 0.04 * Math.sin(t), breath: t,
      armF: { tx: 0.06 + 0.05 * Math.sin(t * 6.5), ty: -0.34, w: wave },
      armB: { tx: 0.07, ty: 0.3, w: 0.6 * (1 - wave) },
      dress: 1, hair: 'bun', col: mulc(C.ink, [1.25, 1.2, 1.15]), colB: mulc(C.ink, [1.6, 1.55, 1.5]),
    });
    ctx.restore();
    ctx.save(); ctx.scale(S, S);
    // picket fence in front
    ctx.fillStyle = rgba(lit([238, 234, 224]));
    for (let i = -15; i <= 16; i++) {
      if (i >= -2 && i <= 2) continue;
      const x = i * 24; ctx.fillRect(x - 5, -52, 10, 52);
      ctx.beginPath(); ctx.moveTo(x - 5, -52); ctx.lineTo(x, -60); ctx.lineTo(x + 5, -52); ctx.fill();
    }
    ctx.fillRect(-370, -40, 316, 6); ctx.fillRect(54, -40, 346, 6);
    ctx.fillRect(-370, -20, 316, 6); ctx.fillRect(54, -20, 346, 6);
    // lamp post by the gate
    ctx.save(); ctx.translate(-92, 0);
    ctx.fillStyle = rgba(lit([44, 44, 50])); ctx.fillRect(-4, -300, 8, 300); ctx.fillRect(-12, -12, 24, 12);
    ctx.fillRect(-16, -326, 32, 7);
    ctx.fillStyle = rgba(mixc(lit([200, 200, 200]), [255, 228, 160], lamp)); ctx.fillRect(-12, -319, 24, 22);
    ctx.fillStyle = rgba(lit([44, 44, 50])); ctx.beginPath(); ctx.moveTo(-18, -326); ctx.lineTo(0, -342); ctx.lineTo(18, -326); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, -308, 240, [255, 196, 96], 0.5 * lamp);
    glow(ctx, 0, -308, 50, [255, 236, 190], 0.75 * lamp);
    ctx.restore();
    glow(ctx, 0, -140, 300, [255, 190, 100], 0.22 * lamp);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  function streetProps(ctx, E, t, front) {
    const p = 0.96;
    const [u0, u1] = visU(p);
    // street trees
    const sp = 470;
    for (let k = Math.floor((u0 - 200) / sp); k <= (u1 + 200) / sp; k++) {
      const u = k * sp + 120;
      const w = wOf(u, p);
      if (eCity(w) < 0.6) continue;
      at(ctx, p, u);
      ctx.fillStyle = rgba(lit([110, 104, 98])); ctx.fillRect(-34, -18, 68, 18);
      const full = T.crownFull(t);
      tree(ctx, k * 31, 1.55, full, Math.sin(t * 1.6 + k) * 3 * E.wind, { trunk: lit([74, 60, 52]), leaf: [lit([52, 120, 64]), lit([74, 150, 76]), lit([118, 182, 98])] });
    }
    // street lamps
    const sl = 640;
    for (let k = Math.floor((u0 - 200) / sl); k <= (u1 + 200) / sl; k++) {
      const u = k * sl + 400;
      if (eCity(wOf(u, p)) < 0.6 || Math.abs(u - (STOP_X * p - 150)) < 330) continue;
      at(ctx, p, u);
      lampPost(ctx, E);
    }
    // traffic light (green) seen around 27–30s
    const tlU = uOf(6950, p);
    if (tlU > u0 - 100 && tlU < u1 + 100) {
      at(ctx, p, tlU);
      ctx.fillStyle = rgba(lit([40, 42, 48])); ctx.fillRect(-6, -420, 12, 420); ctx.fillRect(-22, -520, 44, 110);
      ctx.fillStyle = 'rgb(60,40,40)'; ctx.beginPath(); ctx.arc(0, -498, 13, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgb(60,56,40)'; ctx.beginPath(); ctx.arc(0, -466, 13, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgb(70,230,120)'; ctx.beginPath(); ctx.arc(0, -434, 13, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, -434, 90, [70, 230, 120], 0.6); ctx.globalCompositeOperation = 'source-over';
    }
    // the lamp he stops under
    const sU = STOP_X * p - 150;
    if (sU > u0 - 200 && sU < u1 + 200) { at(ctx, p, sU); lampPost(ctx, E); }
  }
  function lampPost(ctx, E) {
    ctx.fillStyle = rgba(lit([46, 48, 54]));
    ctx.fillRect(-6, -520, 12, 520); ctx.fillRect(-14, -16, 28, 16);
    ctx.beginPath(); ctx.moveTo(-6, -520); ctx.quadraticCurveTo(0, -560, 60, -556); ctx.lineTo(60, -548); ctx.quadraticCurveTo(6, -552, 6, -520); ctx.fill();
    ctx.fillRect(40, -556, 46, 10);
    const on = E.lightsOn;
    ctx.fillStyle = rgba(mixc([180, 180, 180], [255, 240, 210], on)); ctx.fillRect(44, -546, 38, 6);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 63, -540, 230, [255, 226, 170], 0.35 * on);
    ctx.globalCompositeOperation = 'source-over';
  }

  // vehicles on the road behind the walker
  function traffic(ctx, E) {
    const lanes = [{ p: 0.86, dir: 1, n: 7 }, { p: 0.8, dir: -1, n: 7 }];
    for (const ln of lanes) {
      const [u0, u1] = visU(ln.p);
      const warp = E.warp;
      for (let i = 0; i < ln.n; i++) {
        const seed = i * 7.7 + ln.p * 31;
        const speed = 420 + hash(seed) * 260;
        const isBus = hash(seed + 5) > 0.82;
        const len = isBus ? 560 : 250 + hash(seed + 1) * 80;
        const wx = CITY_W0 + 500 + mod(hash(seed + 2) * CITY_SPAN + ln.dir * speed * E.ct, CITY_SPAN);
        const u = uOf(wx, ln.p);
        if (u < u0 - len || u > u1 + len) continue;
        const ea = ss(0.45, 0.85, eCity(wx));
        if (ea < 0.01) continue;
        const c = isBus ? [72, 150, 104] : CARS[Math.floor(hash(seed + 3) * CARS.length)];
        const streak = clamp((warp - 1.2) / 4);
        const ghosts = streak > 0.05 ? 8 : 1;
        const dpf = ln.dir * speed * 0.1 * warp * ln.p;
        for (let g = 0; g < ghosts; g++) {
          at(ctx, ln.p, u - dpf * (g / Math.max(1, ghosts - 1)));
          ctx.globalAlpha = ea * (ghosts > 1 ? 0.14 : 1);
          ctx.scale(ln.dir, 1);
          if (isBus) bus(ctx, len, lit(c), E.lightsOn);
          else car(ctx, len, lit(c), E.lightsOn, ln.dir);
        }
        ctx.globalAlpha = 1;
        if (E.lightsOn > 0.2 || streak > 0) {
          at(ctx, ln.p, u);
          ctx.scale(ln.dir, 1);
          const hgt = (isBus ? 170 : len * 0.27);
          ctx.globalCompositeOperation = 'lighter';
          glow(ctx, len / 2, -hgt * 0.44, 90, [255, 240, 200], 0.4 * E.lightsOn);
          glow(ctx, -len / 2, -hgt * 0.46, 60, [255, 70, 60], 0.45 * E.lightsOn);
          if (streak > 0.02) {
            const L2 = speed * warp * 0.28;
            let g = ctx.createLinearGradient(-len / 2 - L2, 0, -len / 2, 0);
            g.addColorStop(0, 'rgba(255,60,50,0)'); g.addColorStop(1, `rgba(255,70,60,${0.7 * streak})`);
            ctx.fillStyle = g; ctx.fillRect(-len / 2 - L2, -hgt * 0.5, L2, 6);
            g = ctx.createLinearGradient(len / 2 - L2, 0, len / 2, 0);
            g.addColorStop(0, 'rgba(255,240,210,0)'); g.addColorStop(1, `rgba(255,244,220,${0.7 * streak})`);
            ctx.fillStyle = g; ctx.fillRect(len / 2 - L2, -hgt * 0.47, L2, 6);
          }
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }
  }
  function bus(ctx, len, c, lights) {
    const hgt = 170;
    ctx.fillStyle = rgba(c);
    ctx.beginPath(); ctx.moveTo(-len / 2, -16); ctx.lineTo(-len / 2, -hgt + 14); ctx.quadraticCurveTo(-len / 2, -hgt, -len / 2 + 14, -hgt);
    ctx.lineTo(len / 2 - 20, -hgt); ctx.quadraticCurveTo(len / 2, -hgt, len / 2, -hgt + 24); ctx.lineTo(len / 2, -16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(40,52,66,0.85)';
    for (let i = 0; i < 6; i++) ctx.fillRect(-len / 2 + 24 + i * 84, -hgt + 22, 70, 56);
    ctx.fillRect(len / 2 - 50, -hgt + 22, 40, 70);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(-len / 2, -70, len, 6);
    ctx.fillStyle = '#16171b';
    for (const wx of [-len * 0.32, len * 0.3]) { ctx.beginPath(); ctx.arc(wx, -16, 24, 0, TAU); ctx.fill(); }
  }

  // pedestrians: far sidewalk, behind him on his sidewalk, and (only as time-lapse streaks) in front
  const CROWD = [];
  for (let i = 0; i < 60; i++) {
    const r = hash(i * 3.1);
    const lane = r < 0.34 ? 0 : r < 0.8 ? 1 : 2;
    CROWD.push({
      lane, p: [0.735, 0.9, 1.12][lane], dir: hash(i * 1.7) > 0.5 ? 1 : -1,
      speed: 105 + hash(i * 2.3) * 75, h: 296 + hash(i * 4.1) * 46,
      x0: hash(i * 5.9) * CITY_SPAN, ph: hash(i * 6.7), th: hash(i * 12.7),
      umb: UMB[Math.floor(hash(i * 7.3) * UMB.length)], uth: 0.2 + hash(i * 8.9) * 0.5,
      bag: hash(i * 9.7) > 0.6, coat: hash(i * 10.3) > 0.3 ? 0.45 + hash(i * 10.9) * 0.55 : 0, hair: hash(i * 11.1) > 0.7 ? 'bun' : 'adult',
    });
  }
  const crowdDensity = track([[0, 0.3], [27, 0.35], [34, 0.6], [39, 0.85], [46.2, 0.85], [49.2, 0.42], [60, 0.42]]);
  function crowd(ctx, E, lane) {
    const dens = crowdDensity(E.t);
    const streak = clamp((E.warp - 1.3) / 3);
    for (const c of CROWD) {
      if (c.lane !== lane) continue;
      let alpha = ss(c.th, c.th + 0.06, dens + (lane === 2 ? -0.15 : 0));
      if (lane === 2) alpha *= streak;
      if (alpha <= 0.01) continue;
      const [u0, u1] = visU(c.p);
      const wx = CITY_W0 + mod(c.x0 + c.dir * c.speed * E.ct, CITY_SPAN);
      alpha *= ss(0.55, 0.9, eCity(wx));
      if (alpha <= 0.01) continue;
      const u = uOf(wx, c.p);
      if (u < u0 - 300 || u > u1 + 300) continue;
      const D = strideOf(c.speed, c.h, 0);
      const col = lane === 0 ? mixc(C.ink, haze([150, 156, 168], 0.25), 0.5) : lane === 1 ? mixc(C.ink, haze([118, 124, 138], 0.1), 0.34) : mulc(C.ink, [1.1, 1.1, 1.1]);
      const colB = mixc(col, [160, 166, 176], 0.16);
      const open = ss(c.uth, c.uth + 0.15, E.rain) * (1 - ss(51.6, 53.5, E.t));
      // long-exposure smear while time runs fast
      const ghosts = streak > 0.02 ? 9 : 1;
      const shutter = 0.12 * E.warp;
      for (let g = 0; g < ghosts; g++) {
        const ct = E.ct - (ghosts > 1 ? shutter * g / (ghosts - 1) : 0);
        const wg = CITY_W0 + mod(c.x0 + c.dir * c.speed * ct, CITY_SPAN);
        at(ctx, c.p, uOf(wg, c.p), 0.3 + 0.7 * c.p);
        ctx.globalAlpha = alpha * (ghosts > 1 ? lerp(1, 0.16, streak) : 1);
        ctx.scale(c.dir, 1);
        const umbArm = open > 0.05 ? { tx: 0.08, ty: -0.12, w: 1 } : null;
        const r = drawPerson(ctx, {
          h: c.h, q: 1, phi: c.ph + c.speed * ct / D, gw: 1, run: 0, D, hunch: 0.12, pitch: lerp(0.1, -0.55, ss(53 + c.th * 2, 54.5 + c.th * 2, E.t) * (c.th > 0.45 ? 1 : 0)), coat: c.coat, hair: c.hair,
          armF: umbArm, armB: c.bag ? { tx: -0.02, ty: 0.36, w: 0.7 } : null, col, colB,
        });
        if (c.bag) { ctx.fillStyle = rgba(col); ctx.beginPath(); ctx.roundRect(r.handB[0] - 14, r.handB[1] + 2, 30, 34, 4); ctx.fill(); }
        if (open > 0.05) umbrella(ctx, r.handF[0], r.handF[1], 118, lit(c.umb), open);
      }
      ctx.globalAlpha = 1;
    }
  }

  function protagonist(ctx, E, t) {
    const p = 1;
    at(ctx, p, cam.x, 1);
    const h = E.h;
    const colF = C.ink, colB = mixc(C.ink, [120, 126, 140], 0.25);
    const armF = { tx: 0, ty: 0, w: 0 };
    const blend = (w, tx, ty) => { if (w <= 0) return; const tw = armF.w + w; armF.tx = (armF.tx * armF.w + tx * w) / tw; armF.ty = (armF.ty * armF.w + ty * w) / tw; armF.w = Math.min(1, tw); };
    // kite string held up (child); after the snap he reaches after it
    const reachKid = ss(TB, TB + 0.5, t) * (1 - ss(12.4, 13.6, t));
    blend(P.string(t) * (1 - reachKid), 0.15 + 0.02 * Math.sin(t * 4), -0.3 + 0.02 * Math.sin(t * 3));
    blend(reachKid, 0.2, -0.46);
    blend(P.brief(t) * 0.6, 0.02, 0.36);
    blend(P.phone(t), 0.15, 0.1);
    blend(P.reach(t), 0.11 + 0.01 * Math.sin(t * 2), -0.45 + 0.01 * Math.sin(t * 1.7));
    const armB = P.suitcase(t) > 0 ? { tx: -0.22, ty: 0.36, w: P.suitcase(t) } : null;
    // suitcase is pulled behind on the far side
    const sc = P.suitcase(t);
    const r = drawPerson(ctx, {
      h, q: E.q, phi: E.phi, gw: E.gw, run: E.run, D: E.D, hunch: E.hunch, pitch: E.pitch, breath: t,
      armF, armB, coat: P.coat(t), hair: E.age < 14 ? 'child' : 'adult', col: colF, colB,
      preBack: sc > 0.01 ? (hb) => {
        ctx.save(); ctx.globalAlpha = sc;
        const wx = hb[0] - 0.62 * h, wy = -12;
        const ang = Math.atan2(hb[1] - wy, hb[0] - wx), len = Math.hypot(hb[0] - wx, hb[1] - wy);
        ctx.translate(wx, wy); ctx.rotate(ang);
        ctx.fillStyle = rgba(lit([58, 120, 150])); ctx.beginPath(); ctx.roundRect(0, -0.11 * h, len * 0.6, 0.22 * h, 10); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(len * 0.12, -0.11 * h, 6, 0.22 * h); ctx.fillRect(len * 0.42, -0.11 * h, 6, 0.22 * h);
        ctx.strokeStyle = rgba(C.ink); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(len * 0.6, 0); ctx.lineTo(len, 0); ctx.stroke();
        ctx.fillStyle = rgba(C.ink); ctx.beginPath(); ctx.arc(0, 0.1 * h, 10, 0, TAU); ctx.fill();
        ctx.restore();
      } : null,
    });
    const hf = r.handF;
    // briefcase
    const bw = P.brief(t);
    if (bw > 0.01) {
      ctx.save(); ctx.globalAlpha = bw; ctx.fillStyle = rgba(mulc(C.ink, [1.5, 1.4, 1.3]));
      ctx.beginPath(); ctx.roundRect(hf[0] - 0.09 * h, hf[1] + 0.03 * h, 0.2 * h, 0.13 * h, 6); ctx.fill();
      ctx.strokeStyle = rgba(C.ink); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(hf[0] - 0.03 * h, hf[1] + 0.035 * h); ctx.lineTo(hf[0] - 0.03 * h, hf[1]); ctx.lineTo(hf[0] + 0.04 * h, hf[1]); ctx.lineTo(hf[0] + 0.04 * h, hf[1] + 0.035 * h); ctx.stroke();
      ctx.restore();
    }
    // phone + its cold light on the face
    const pw = P.phone(t);
    if (pw > 0.01) {
      ctx.save(); ctx.globalAlpha = pw;
      ctx.translate(hf[0], hf[1]); ctx.rotate(-0.9);
      ctx.fillStyle = '#121318'; ctx.fillRect(-0.016 * h, -0.05 * h, 0.032 * h, 0.06 * h);
      ctx.fillStyle = 'rgb(150,206,255)'; ctx.fillRect(-0.012 * h, -0.045 * h, 0.024 * h, 0.05 * h);
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, lerp(hf[0], r.hc[0], 0.45), lerp(hf[1], r.hc[1], 0.45), 0.25 * h, [120, 190, 255], 0.35 * pw);
      ctx.globalCompositeOperation = 'source-over';
    }
    // world-space hand (for strings drawn later)
    const m = ctx.getTransform();
    handOut.x = (m.a * hf[0] + m.c * hf[1] + m.e) / SC; handOut.y = (m.b * hf[0] + m.d * hf[1] + m.f) / SC;
    handOut.hx = cam.x + hf[0]; handOut.hy = FY + hf[1];
    // childhood kite
    if (t < 16) childKite(ctx, E, t, r);
    // soft contact shadow
    L(ctx, 1, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath(); ctx.ellipse(cam.x, FY + 2, h * 0.2, h * 0.025, 0, 0, TAU); ctx.fill();
  }

  function kidKitePos(t) {
    const x = cam.x + 330 + 40 * Math.sin(t * 1.3) + 20 * Math.sin(t * 2.9);
    const y = 230 + 26 * Math.sin(t * 0.9 + 1) + 10 * Math.sin(t * 3.7);
    if (t <= TB) return { x, y, s: 0.9, rot: 0.12 * Math.sin(t * 2.1) + 0.15, a: 1 };
    const d = t - TB;
    const bx = camAt(TB) + 330 + 40 * Math.sin(TB * 1.3) + 20 * Math.sin(TB * 2.9);
    const by = 230 + 26 * Math.sin(TB * 0.9 + 1) + 10 * Math.sin(TB * 3.7);
    const e = easeOut(d / 6.5);
    return {
      x: bx + d * 95 + 50 * Math.sin(d * 1.5), y: by - e * 300 - d * 10 + 22 * Math.sin(d * 2.1),
      s: 0.9 * lerp(1, 0.3, e), rot: 0.15 + d * 0.55 + 0.35 * Math.sin(d * 2.4), a: 1 - ss(4.8, 6.2, d),
    };
  }
  function childKite(ctx, E, t, r) {
    const k = kidKitePos(t);
    L(ctx, 1, 1);
    const hx = handOut.hx, hy = handOut.hy;
    ctx.strokeStyle = 'rgba(250,250,245,0.85)'; ctx.lineWidth = 1.6;
    if (t <= TB) {
      ctx.beginPath(); ctx.moveTo(hx, hy);
      ctx.quadraticCurveTo(lerp(hx, k.x, 0.6), lerp(hy, k.y, 0.5) + 70, k.x, k.y + 10); ctx.stroke();
    } else {
      const d = t - TB;
      // the broken piece trailing from the kite
      ctx.globalAlpha = k.a;
      ctx.beginPath(); ctx.moveTo(k.x, k.y + 10);
      for (let i = 1; i <= 12; i++) { const s = i / 12; ctx.lineTo(k.x - s * 120 * k.s + Math.sin(t * 7 - s * 5) * 14 * s, k.y + 10 + s * 140 * k.s); }
      ctx.stroke();
      ctx.globalAlpha = 1 - ss(0.4, 1.2, d);
      // the piece left in the hand falls
      ctx.beginPath(); ctx.moveTo(hx, hy);
      const fall = Math.min(1, d * 1.6);
      ctx.quadraticCurveTo(hx + 80 * (1 - fall), hy - 90 * (1 - fall) + 40 * fall, hx + 150 * (1 - fall) + 20, hy - 160 * (1 - fall) + 150 * fall);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    drawKite(ctx, k.x, k.y, k.s, k.rot, t, k.a);
  }

  // ---- particles
  function butterflies(ctx, E, t) {
    if (t > 16) return;
    for (let i = 0; i < 6; i++) {
      const p = 0.92 + hash(i) * 0.3;
      const wx = 700 + i * 420 + 160 * noise1(t * 0.35 + i * 3) + 50 * Math.sin(t * 1.1 + i);
      const u = uOf(wx, p);
      const y = baseY(p) - 70 - 110 * (0.5 + 0.5 * noise1(t * 0.5 + i * 7)) - 14 * Math.sin(t * 2.6 + i);
      L(ctx, p, 0.3 + 0.7 * p);
      const flap = 0.15 + 0.85 * Math.abs(Math.sin(t * 15 + i * 2));
      const c = lit([[252, 204, 64], [246, 140, 52], [255, 252, 244], [110, 160, 240]][i % 4]);
      ctx.save(); ctx.translate(u, y); ctx.scale(p * 0.85, p * 0.85); ctx.rotate(0.25 * Math.sin(t * 2 + i));
      ctx.fillStyle = rgba(c);
      ctx.save(); ctx.scale(1, flap);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-4, -16, -16, -14, -11, -2); ctx.bezierCurveTo(-10, 4, -4, 6, 0, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(4, -18, 18, -15, 12, -2); ctx.bezierCurveTo(10, 5, 4, 6, 0, 0); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(40,36,34,0.9)'; ctx.fillRect(-1, -5, 2, 9);
      ctx.restore();
    }
  }
  function birds(ctx, E, t, t0, t1, late) {
    if (t < t0 || t > t1) return;
    screenSpace(ctx);
    ctx.strokeStyle = rgba(mixc(C.ink, E.skyTop, 0.35)); ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    const d = t - t0;
    for (let i = 0; i < 7; i++) {
      const x = late ? 1300 + d * 110 + i * 40 - (i % 2) * 16 : -80 + d * 150 + i * 46 - (i % 2) * 20;
      const y = late ? 470 - d * 40 + Math.abs(i - 3) * 18 + Math.sin(d * 2 + i) * 5 : 300 + E.tilt * 0.4 - d * 18 + Math.abs(i - 3) * 22 + Math.sin(d * 2 + i) * 6;
      const f = Math.sin(t * 9 + i * 1.3) * 9;
      ctx.beginPath(); ctx.moveTo(x - 12, y - f); ctx.quadraticCurveTo(x - 4, y - 4, x, y); ctx.quadraticCurveTo(x + 4, y - 4, x + 12, y - f); ctx.stroke();
    }
  }
  function fireflies(ctx, E, t) {
    const a = ss(15.5, 17.5, t) * (1 - ss(23.5, 25, t));
    if (a <= 0) return;
    const p = 0.85;
    L(ctx, p, 0.3 + 0.7 * p);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const u = HOUSE_U * (p / HOUSE_P) - 600 + hash(i) * 1500 + 40 * noise1(t * 0.5 + i);
      const y = baseY(p) - 30 - hash(i + 5) * 260 + 30 * noise1(t * 0.4 + i * 3);
      const b = a * (0.5 + 0.5 * Math.sin(t * (2 + hash(i) * 3) + i * 7));
      glow(ctx, u, y, 18, [255, 226, 120], 0.9 * b);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function leaves(ctx, E, t) {
    if (t < 27.5 || t > 38) return;
    screenSpace(ctx);
    for (let i = 0; i < 80; i++) {
      const ts = 27.8 + hash(i) * 3.8, d = t - ts;
      if (d < 0 || d > 7) continue;
      const x = 80 + hash(i + 1) * 1900 - d * (40 + hash(i + 3) * 40) + 50 * Math.sin(d * 2.2 + i);
      const y = 150 + hash(i + 2) * 330 + d * (70 + hash(i + 4) * 60);
      const rot = d * (2 + hash(i + 5) * 3) + i;
      const c = lit(mixc(C.leaf2, [176, 196, 74], hash(i + 6)));
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, 0.45 + 0.55 * Math.abs(Math.sin(d * 3 + i)));
      ctx.fillStyle = rgba(c, 1 - ss(5.5, 7, d));
      ctx.beginPath(); ctx.ellipse(0, 0, 11, 5.5, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  function rain(ctx, E, t) {
    const amt = E.rain;
    const after = ss(51.4, 52.2, t);
    if (amt <= 0.01 && after <= 0) return;
    screenSpace(ctx);
    // haze curtain
    ctx.fillStyle = `rgba(150,160,170,${0.1 * amt})`; ctx.fillRect(0, 0, VW, VH);
    const rt = E.rt, slow = E.rainWarp;
    const layers = [[900, 16, 1.0, 0.22, 300], [1300, 28, 1.4, 0.32, 260], [1900, 52, 2.2, 0.38, 140]];
    const bloomR = ENV.restoreR * VH;
    for (let l = 0; l < 3; l++) {
      const [spd, len0, wid, alp, n] = layers[l];
      const len = Math.max(len0 * Math.min(1, slow * 1.4), wid * 1.6);
      ctx.lineWidth = wid; ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(214,222,232,${alp})`;
      ctx.beginPath();
      const colored = [];
      for (let i = 0; i < n; i++) {
        const sd = i * 13.1 + l * 1000;
        if (hash(sd + 7) > amt + after * 0.0) continue;
        const x = hash(sd) * 2200 - 140;
        const y = mod(hash(sd + 1) * 1400 + spd * rt, 1400) - 160;
        const xx = x - y * 0.12;
        if (after > 0) {
          const dx = xx - ENV.restoreXY[0], dy = y - ENV.restoreXY[1];
          if (Math.hypot(dx, dy) < bloomR) { if (hash(sd + 11) < 0.32) colored.push([xx, y, sd]); continue; }
        }
        ctx.moveTo(xx, y); ctx.lineTo(xx + len * 0.12, y + len);
      }
      ctx.stroke();
      // drops caught by the returning colour: glinting motes
      for (const [xx, y, sd] of colored) {
        const fade = 1 - ss(52.5, 55.5, t + hash(sd) * 1.5);
        if (fade <= 0) continue;
        const hue = hash(sd + 3);
        const c = [[255, 110, 100], [255, 200, 90], [140, 230, 140], [120, 190, 255], [200, 150, 255]][Math.floor(hue * 5)];
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, xx, y, 7 + wid * 3, c, 0.75 * fade);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    // splashes
    if (amt > 0.2) {
      ctx.strokeStyle = 'rgba(220,226,234,0.35)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 70; i++) {
        const rate = 1.4 + hash(i) * 1.2;
        const a = fract(rt * rate + hash(i + 1));
        const slot = Math.floor(rt * rate + hash(i + 1));
        if (hash(i * 3 + slot) > amt) continue;
        const x = hash(i * 7 + slot * 3.3) * VW, y = 900 + hash(i * 11 + slot * 1.7) * 180;
        const r = 2 + a * 16 * (y / 1000);
        ctx.moveTo(x + r, y); ctx.ellipse(x, y, r, r * 0.28, 0, 0, TAU);
      }
      ctx.stroke();
    }
  }
  function foreground(ctx, E, t) {
    // near, out-of-focus shapes passing the lens: grass (meadow), posts (town), bollards (city)
    const p = 1.7;
    L(ctx, p, 1.4);
    const [u0, u1] = visU(p);
    const sp = 520;
    ctx.filter = `blur(${(9 * SC * cam.z).toFixed(1)}px)`;
    for (let k = Math.floor(u0 / sp) - 1; k <= u1 / sp + 1; k++) {
      const u = k * sp + hash(k * 2.1) * 260;
      const w = wOf(u, p);
      const town = eTown(w), city = eCity(w);
      ctx.save(); ctx.translate(u, 1150);
      if (city > 0.5) {
        if (hash(k) > 0.7) { ctx.fillStyle = rgba(mulc(lit([70, 72, 78]), [0.7, 0.7, 0.7])); ctx.beginPath(); ctx.roundRect(-26, -210, 52, 220, 22); ctx.fill(); }
      } else if (town > 0.5) {
        if (hash(k) > 0.5) { ctx.fillStyle = rgba(mulc(lit([70, 120, 56]), [0.6, 0.65, 0.6])); ctx.beginPath(); for (let b = 0; b < 6; b++) { const bx = (b - 3) * 26, bh = 120 + hash(k * 7 + b) * 140, sw = Math.sin(t * 2 + b + k) * 14; ctx.moveTo(bx - 12, 0); ctx.quadraticCurveTo(bx + sw * 0.5, -bh * 0.6, bx + sw, -bh); ctx.quadraticCurveTo(bx + 4, -bh * 0.5, bx + 12, 0); } ctx.fill(); }
      } else {
        ctx.fillStyle = rgba(mulc(lit([60, 120, 50]), [0.55, 0.6, 0.55]));
        ctx.beginPath();
        for (let b = 0; b < 9; b++) {
          const bx = (b - 4) * 22, bh = 160 + hash(k * 9 + b) * 200, sw = Math.sin(t * 2 + b + k) * 18;
          ctx.moveTo(bx - 12, 0); ctx.quadraticCurveTo(bx + sw * 0.5, -bh * 0.6, bx + sw, -bh); ctx.quadraticCurveTo(bx + 4, -bh * 0.5, bx + 12, 0);
        }
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.filter = 'none';
  }

  function drawScene(ctx, E, t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawSky(ctx, E);
    birds(ctx, E, t, 5.5, 13);
    birds(ctx, E, t, 55.4, 61, true);
    drawClouds(ctx, E, t);
    // distant land
    hills(ctx, E, 0.12, 120, 0.004, 1.3, [126, 176, 150], 0.55, false);
    skyline(ctx, E, 0.18, 11, 0.55, 140, 380);
    hills(ctx, E, 0.3, 150, 0.0035, 7.1, [100, 168, 104], 0.36, true);
    skyline(ctx, E, 0.42, 23, 0.32, 260, 620);
    hills(ctx, E, 0.5, 110, 0.003, 3.7, [92, 160, 84], 0.18, true);
    townHouses(ctx, E, 0.52, 0.2);
    cityBlock(ctx, E, 0.68, 0.08);
    // ground
    groundBands(ctx, E);
    for (let i = 0; i < 5; i++) grassRow(ctx, E, 0.6 + i * 0.08, t);
    crowd(ctx, E, 0);
    traffic(ctx, E);
    drawHome(ctx, E, t);
    fireflies(ctx, E, t);
    for (let i = 0; i < 5; i++) flowerRow(ctx, E, 0.62 + i * 0.075, t, i);
    streetProps(ctx, E, t);
    crowd(ctx, E, 1);
    protagonist(ctx, E, t);
    crowd(ctx, E, 2);
    for (let i = 0; i < 6; i++) { grassRow(ctx, E, 1.04 + i * 0.12, t); flowerRow(ctx, E, 1.06 + i * 0.12, t, i + 10); }
    butterflies(ctx, E, t);
    foreground(ctx, E, t);
    leaves(ctx, E, t);
    rain(ctx, E, t);
  }

  // ================================================================ OVERLAY
  const FONT = '"FadeSerif", "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", serif';
  const CAPTIONS = [
    { t0: 6.0, t1: 10.3, age: '七岁', text: '风筝飞得很高，天空是我的。' },
    { t0: 11.0, t1: 14.3, text: '后来，线断了。' },
    { t0: 16.4, t1: 22.6, age: '十八岁', text: '离家那天，门口那盏灯亮了很久。' },
    { t0: 24.8, t1: 31.0, age: '二十六岁', text: '城市很大，我把梦想折好，收进口袋。' },
    { t0: 33.6, t1: 39.8, age: '三十五岁', text: '我已经很久，没有抬头看过天空。' },
  ];
  const LINES = [
    { t0: 41.0, t1: 46.5, text: '世界不是一下子褪色的。', x: 960, y: 250, size: 54 },
    { t0: 43.4, t1: 46.5, text: '是我们一点一点，忘了抬头。', x: 960, y: 336, size: 54 },
    { t0: 52.4, t1: 55.7, text: '可颜色，一直都在。', x: 520, y: 250, size: 56 },
    { t0: 56.0, t1: 59.5, text: '抬头看看吧，', x: 540, y: 200, size: 58 },
    { t0: 56.9, t1: 59.5, text: '今天的天空很蓝。', x: 540, y: 290, size: 58 },
  ];
  const TITLE = ['一个人的世界，', '是从什么时候开始褪色的？'];

  function charRow(ctx, text, x, y, size, spacing, t, t0, t1, colorFn, weight = 300) {
    const chars = [...text];
    ctx.font = `${weight} ${size}px ${FONT}`;
    const ws = chars.map((c) => ctx.measureText(c).width);
    const total = ws.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
    let cx = x - total / 2;
    const out = 1 - ss(t1 - 0.7, t1, t);
    for (let i = 0; i < chars.length; i++) {
      const ta = t0 + i * 0.06;
      const a = ss(ta, ta + 0.55, t) * out;
      if (a > 0.003) {
        const dy = (1 - ss(ta, ta + 0.7, t)) * 14 - (1 - out) * 8;
        const col = colorFn ? colorFn(i, chars.length) : [246, 242, 234];
        ctx.fillStyle = rgba(col, a);
        ctx.fillText(chars[i], cx, y + dy);
      }
      cx += ws[i] + spacing;
    }
  }

  function drawOverlay(ctx, E, t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overCv.width, overCv.height);
    screenSpace(ctx);
    ctx.textBaseline = 'alphabetic';
    // the returning kite (always in full colour)
    if (t > 46.5) endKite(ctx, E, t);
    // title
    if (t < 5.2) {
      const N = TITLE[0].length + TITLE[1].length;
      const drain = ss(2.9, 4.4, t);
      const colorFn = (off) => (i) => {
        const k = (i + off) / (N - 1);
        const hue = k * 290;
        const sat = 0.86 * (1 - ss(0.45, 0.95, k)) * (1 - drain);
        return hsl(hue, sat, 0.7 - 0.08 * sat);
      };
      ctx.shadowColor = 'rgba(0,0,0,0)';
      charRow(ctx, TITLE[0], 960, 488, 66, 10, t, 0.5, 5.0, colorFn(0));
      charRow(ctx, TITLE[1], 960, 600, 66, 10, t, 1.1, 5.0, colorFn(TITLE[0].length));
    }
    // lower-third captions
    for (const c of CAPTIONS) {
      if (t < c.t0 - 0.1 || t > c.t1 + 0.1) continue;
      const band = ss(c.t0 - 0.3, c.t0 + 0.4, t) * (1 - ss(c.t1 - 0.5, c.t1 + 0.1, t));
      const g = ctx.createLinearGradient(0, 820, 0, VH);
      g.addColorStop(0, 'rgba(10,10,14,0)'); g.addColorStop(1, `rgba(10,10,14,${0.42 * band})`);
      ctx.fillStyle = g; ctx.fillRect(0, 820, VW, VH - 820);
      ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 14;
      if (c.age) charRow(ctx, c.age, 960, 944, 30, 14, t, c.t0, c.t1, () => [236, 230, 218], 500);
      charRow(ctx, c.text, 960, c.age ? 1004 : 990, 44, 6, t, c.t0 + (c.age ? 0.25 : 0), c.t1, null, 300);
      ctx.shadowBlur = 0;
    }
    for (const l of LINES) {
      if (t < l.t0 - 0.1 || t > l.t1 + 0.1) continue;
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 18;
      charRow(ctx, l.text, l.x, l.y, l.size, 8, t, l.t0, l.t1, null, 300);
      ctx.shadowBlur = 0;
    }
  }
  function hsl(h, s, l) {
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  }

  // the kite comes back
  const EK = {
    x: track([[46.4, 640], [47.3, 540], [48.2, 450], [49.4, 370], [50.4, 310], [51.0, 280], [53.5, 300], [56, 380], [60, 560]]),
    y: track([[46.4, -80], [47.3, 60], [48.2, 170], [49.4, 240], [50.4, 285], [51.0, 300], [53.5, 230], [56, 60], [60, -250]]),
  };
  function endKitePos(t) {
    const fall = 1 - ss(50.2, 51.2, t);
    const x = STOP_X + EK.x(t) + fall * 70 * Math.sin(t * 2.3) + 18 * Math.sin(t * 1.4);
    const y = EK.y(t) + 10 * Math.sin(t * 1.9);
    const rot = fall * 0.5 * Math.sin(t * 2.3 + 0.6) + 0.12 + 0.08 * Math.sin(t * 1.6);
    return { x, y, rot };
  }
  function endKite(ctx, E, t) {
    const k = endKitePos(t);
    const [sx, sy] = toScreen(k.x, k.y);
    const s = 0.95 * cam.z;
    ctx.save();
    // string
    ctx.strokeStyle = 'rgba(250,248,240,0.9)'; ctx.lineWidth = 1.8 * cam.z; ctx.lineCap = 'round';
    const caught = ss(50.7, 51.2, t);
    const [hx, hy] = [handOut.x, handOut.y];
    const freeX = sx - 30 * s + Math.sin(t * 3) * 30 * s, freeY = sy + 230 * s;
    const ex = lerp(freeX, hx, caught), ey = lerp(freeY, hy, caught);
    ctx.beginPath(); ctx.moveTo(sx, sy + 10 * s);
    ctx.quadraticCurveTo(lerp(sx, ex, 0.5) + 30 * s * (1 - caught), lerp(sy, ey, 0.5) + 40 * s, ex, ey);
    ctx.stroke();
    // a faint halo so it reads as the one warm thing in the grey
    const halo = ss(47, 49, t) * (1 - ss(52, 54, t));
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, sx, sy, 220 * s, [255, 90, 70], 0.18 * halo);
    ctx.globalCompositeOperation = 'source-over';
    drawKite(ctx, sx, sy, s, k.rot, t, ss(46.5, 47.2, t));
    ctx.restore();
  }

  // ================================================================ GL COMPOSITE
  const VS = `#version 300 es
  in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
  const FS = `#version 300 es
  precision highp float;
  uniform sampler2D uScene, uOver;
  uniform vec2 uRes; uniform float uTime;
  uniform vec4 uKeep; uniform vec4 uRestore;
  uniform float uWet, uGroundY, uCurtain, uEnd, uGrain, uGrade;
  out vec4 outColor;
  float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
  float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
    return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
  float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+17.1; a*=.5; } return s/.9375; }
  vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.,-1./3.,2./3.,-1.); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
    vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1e-10;
    return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)), d/(q.x+e), q.x); }
  float bandKeep(float hd, vec4 k){ float w=11.; float r=k.x;
    r=mix(r,k.y,smoothstep(22.-w,22.+w,hd)); r=mix(r,k.z,smoothstep(85.-w,85.+w,hd));
    r=mix(r,k.w,smoothstep(172.-w,172.+w,hd)); r=mix(r,k.x,smoothstep(266.-w,266.+w,hd)); return r; }
  void main(){
    vec2 uv = vec2(gl_FragCoord.x/uRes.x, 1.-gl_FragCoord.y/uRes.y);
    float asp = uRes.x/uRes.y;
    vec2 cc = uv-.5;
    float ca = .0016*dot(cc,cc)*4.;
    vec3 col = vec3(texture(uScene, uv+cc*ca).r, texture(uScene, uv).g, texture(uScene, uv-cc*ca).b);
    if(uWet>.001 && uv.y>uGroundY){
      float d = uv.y-uGroundY;
      float rip = vn(vec2(uv.x*60., uv.y*420.-uTime*5.))-.5;
      vec2 ruv = vec2(uv.x + rip*.006*(.3+d*10.), uGroundY - d - .003);
      vec3 r = texture(uScene, clamp(ruv,0.,1.)).rgb;
      float k = uWet*.55*exp(-d*6.);
      col = mix(col, col*.5 + r*.62, k);
    }
    vec3 gsum = vec3(0.); float R = .011;
    for(int i=0;i<12;i++){ float a = float(i)*.5236+.26; vec2 o = vec2(cos(a)/asp, sin(a))*R;
      gsum += max(texture(uScene, uv+o).rgb-.84, 0.); gsum += max(texture(uScene, uv+o*2.8).rgb-.84, 0.)*.7; }
    col += gsum*.075;
    vec3 hsv = rgb2hsv(clamp(col,0.,1.));
    float n = fbm(uv*vec2(asp,1.)*2.4 + vec2(uTime*.02, 0.));
    float e = .2;
    vec4 dr = (1.-uKeep)*(1.+2.*e)-e;
    vec4 lk = 1.-smoothstep(vec4(n-e), vec4(n+e), dr);
    float keep = bandKeep(hsv.x*360., lk);
    float m = 0., ring = 0.;
    if(uRestore.w > 0.){
      vec2 pp = (uv-uRestore.xy)*vec2(asp,1.);
      float dist = length(pp) + (fbm(uv*vec2(asp,1.)*4.+5.)-.5)*.16;
      m = smoothstep(uRestore.z+.05, uRestore.z-.08, dist);
      ring = exp(-pow((dist-uRestore.z)/.04,2.)) * uRestore.w;
    }
    keep = max(keep, m);
    float lum = dot(col, vec3(.2126,.7152,.0722));
    vec3 gray = vec3(lum)*vec3(.965,.99,1.05);
    col = mix(gray, col, keep);
    float g = uGrade*(1.-m);
    col = mix(col, (col-.5)*.84+.5+.015, g);
    col += ring*vec3(1.,.88,.7)*.18;
    if(uCurtain>0.){
      float cn = .55*(1.-length(cc*vec2(asp,1.))/.95) + .45*fbm(uv*vec2(asp,1.)*2.2+3.);
      float ee=.12; float a = smoothstep(cn-ee, cn+ee, uCurtain*(1.+2.*ee)-ee);
      vec3 bg = vec3(.052,.048,.046) + .03*vec3(1.,.9,.8)*(1.-length(cc)*1.4);
      col = mix(col, bg, a);
    }
    vec4 ov = texture(uOver, uv);
    col = col*(1.-ov.a) + ov.rgb;
    float v = smoothstep(1.2, .3, length(cc*vec2(asp*.78,1.)));
    col *= mix(.7, 1., v);
    float gr = h21(floor(gl_FragCoord.xy/1.5) + fract(uTime*13.17)*vec2(97.,57.)) - .5;
    col += gr*uGrain;
    col *= uEnd;
    outColor = vec4(clamp(col,0.,1.), 1.);
  }`;

  function initGL() {
    gl = glCv.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 not available');
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const mk = () => { const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return tx; };
    texScene = mk(); texOver = mk();
    for (const n of ['uScene', 'uOver', 'uRes', 'uTime', 'uKeep', 'uRestore', 'uWet', 'uGroundY', 'uCurtain', 'uEnd', 'uGrain', 'uGrade']) uni[n] = gl.getUniformLocation(prog, n);
    gl.uniform1i(uni.uScene, 0); gl.uniform1i(uni.uOver, 1);
  }

  function composite(E, t) {
    gl.viewport(0, 0, W, H);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texScene);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sceneCv);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texOver);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, overCv);
    gl.uniform2f(uni.uRes, W, H);
    gl.uniform1f(uni.uTime, t);
    gl.uniform4f(uni.uKeep, E.keepR, E.keepY, E.keepG, E.keepB);
    gl.uniform4f(uni.uRestore, E.restoreXY[0] / VW, E.restoreXY[1] / VH, E.restoreR, E.restoreOn);
    gl.uniform1f(uni.uWet, E.wet);
    const gy = (PIVY + (FY + 4 + cam.tilt - PIVY) * cam.z) / VH;
    gl.uniform1f(uni.uGroundY, gy);
    gl.uniform1f(uni.uCurtain, 1 - ss(4.3, 5.9, t));
    gl.uniform1f(uni.uEnd, 1 - ss(59.25, 60, t));
    gl.uniform1f(uni.uGrain, 0.03 + 0.02 * (1 - (E.keepR + E.keepY + E.keepG + E.keepB) / 4));
    gl.uniform1f(uni.uGrade, 1 - (E.keepR + E.keepY + E.keepG + E.keepB) / 4);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ================================================================ PUBLIC
  const RESTORE_T0 = 51.35;
  let RESTORE_XY = null;
  function renderAt(t) {
    t = clamp(t, 0, DUR);
    const E = envAt(t);
    ENV = E;
    cam = { x: E.camX, z: E.zoom, tilt: E.tilt };
    // the colour wave starts from where the kite is when it is caught
    if (!RESTORE_XY) {
      const kc = endKitePos(RESTORE_T0), ce = envAt(RESTORE_T0);
      cam = { x: ce.camX, z: ce.zoom, tilt: ce.tilt };
      RESTORE_XY = toScreen(kc.x, kc.y);
      cam = { x: E.camX, z: E.zoom, tilt: E.tilt };
    }
    E.restoreXY = RESTORE_XY;
    const rp = clamp((t - RESTORE_T0) / 3.6);
    E.restoreR = rp <= 0 ? 0 : 0.02 + 2.3 * (1 - Math.pow(1 - rp, 2.2));
    E.restoreOn = rp > 0 ? 1 : 0;
    const t0 = performance.now();
    drawScene(sctx, E, t);
    drawOverlay(octx, E, t);
    const t1 = performance.now();
    composite(E, t);
    if (global.__FILM_PROF) { gl.finish(); global.__FILM_PROF.push([t1 - t0, performance.now() - t1]); }
  }

  function init(opts = {}) {
    W = opts.width || 1920; H = opts.height || Math.round(W * 9 / 16);
    SC = W / VW;
    glCv = opts.canvas || document.createElement('canvas');
    glCv.width = W; glCv.height = H;
    sceneCv = document.createElement('canvas'); sceneCv.width = W; sceneCv.height = H;
    overCv = document.createElement('canvas'); overCv.width = W; overCv.height = H;
    sctx = sceneCv.getContext('2d', { alpha: false });
    octx = overCv.getContext('2d');
    initGL();
    return glCv;
  }
  function resize(w, h) {
    W = w; H = h; SC = W / VW;
    glCv.width = W; glCv.height = H; sceneCv.width = W; sceneCv.height = H; overCv.width = W; overCv.height = H;
  }

  // picture-locked sound cues for the score: footsteps and story beats
  function events() {
    const ev = [];
    let prev = phiTab[0];
    for (let i = 1; i < NT - 2; i++) {
      const t = i * STEP; const ph = phiTab[i];
      for (let leg = 0; leg < 2; leg++) {
        const a = Math.floor(prev + leg * 0.5), b = Math.floor(ph + leg * 0.5);
        if (b > a) {
          const v = T.v(t); if (v < 30) continue;
          const w = camTab[i] + 230;
          const surface = eCity(w) > 0.5 ? 'street' : eTown(w) > 0.5 ? 'stone' : 'grass';
          ev.push({ t: +t.toFixed(4), type: 'step', surface, wet: T.wet(t) > 0.3, age: +T.age(t).toFixed(1), run: +T.run(t).toFixed(2), gain: +clamp(v / 200).toFixed(2) });
        }
      }
      prev = ph;
    }
    ev.push({ t: TB, type: 'snap' });
    ev.push({ t: RESTORE_T0, type: 'bloom' });
    return ev;
  }

  global.FILM = { init, resize, renderAt, events, DUR, VW, VH };
})(typeof window !== 'undefined' ? window : globalThis);
