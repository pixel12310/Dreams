/*
 * 初见 · FIRST SIGHT
 * 《一个人的世界，是从什么时候开始褪色的？》
 *
 * The film is a pure function of time: FILM.renderAt(t) paints the exact frame for
 * second t. This file is the director: it decides, for every moment, which scenes
 * are on screen, where the cameras are, and how alive the world still is.
 */
(function (G) {
  'use strict';
  const FS = G.FS;
  const { clamp, lerp, ss, win, easeOut, easeIn, easeInOut, track } = FS;
  const W = () => FS.world, C = () => FS.city;

  const DUR = 95;

  // ------------------------------------------------------------------ the grade
  const PAPER = [244, 237, 222];
  const DEAD = [196, 196, 192];
  // sat: colour; tex: the hand in it (paper, boil, bleed). Both drain in the city.
  const SAT = track([[0, 1.06], [42.6, 1.06], [47.4, 0.0, 'io'], [76.58, 0], [76.6, 1.08], [81, 1.12], [89, 1.18], [95, 1.18]]);
  const TEX = track([[0, 1], [49.5, 1], [54.5, 0.0, 'io'], [76.58, 0], [76.6, 1], [95, 1]]);
  function gradeAt(t) {
    const E = {
      sat: SAT(t), tex: TEX(t), bleed: 1, boil: 1.1, glow: 1, vig: 0.9, grain: 0.035, edge: 1,
      fade: 1, paperA: PAPER, paperD: DEAD, wave: null,
    };
    E.fade = ss(0.0, 0.9, t) * (1 - ss(94.2, 95, t));
    if (C() && C().grade) C().grade(t, E);
    if (FS.final) FS.final.grade(t, E);
    return E;
  }

  // ------------------------------------------------------------------ the opening
  // valley parameters over time: the names arrive one by one
  const VK = {
    sunM: track([[0, 0], [24.5, 0], [25.9, 1, 'io']]),
    mtnM: track([[0, 0], [25.9, 0], [27.2, 1, 'io']]),
    treeM: track([[0, 0], [27.0, 0], [28.3, 1, 'io']]),
    waterM: track([[0, 0], [28.0, 0], [29.2, 1, 'io']]),
    rainM: track([[0, 0], [28.9, 0], [30.0, 1, 'io']]),
    rain: track([[0, 0], [18.0, 0], [19.4, 1], [28.6, 1], [29.8, 0]]),
    rainbow: track([[0, 0], [20.6, 0], [23.0, 0.9], [28.4, 0.9], [29.6, 0]]),
    paint: track([[0, 1], [29.4, 1], [31.0, 0, 'io']]),
    figA: track([[0, 1], [29.2, 1], [30.6, 0]]),
  };
  function valleyK(t) {
    const k = {};
    for (const n in VK) k[n] = VK[n](t);
    // at 30.9 the copybook takes the characters over
    k.glyphA = t < 30.9 ? 1 : 0;
    return k;
  }
  // the valley camera: a slow breath in
  function valleyCam(t) {
    const u = easeInOut(clamp((t - 12.6) / 12));
    return { x: 960, y: lerp(540, 560, u), z: lerp(1, 1.055, u) };
  }

  const T_ZOOM0 = 10.7, T_ZOOM1 = 12.6;
  function opening(L, t) {
    const w = W();
    if (t < 7.6) { w.setCam(L, w.IDENT); w.title(L, t); }
    if (t >= 6.2 && t < T_ZOOM1) {
      const E = w.EYE;
      const zu = easeInOut(clamp((t - T_ZOOM0) / (T_ZOOM1 - T_ZOOM0)));
      const c0 = { x: 960, y: 540, z: lerp(1, 1.035, clamp((t - 7) / 3.7)) };
      const cam = w.zoomCam(c0, [E.refl.x, E.refl.y], 1920 / E.refl.w, zu);
      w.setCam(L, cam);
      const blink = win(9.95, 10.08, 10.12, 10.3, t);
      const vt = Math.max(t, 12.6);
      w.eye(L, t, { blink, reflect: (LL) => w.valley(LL, vt, valleyK(vt)), zoomU: zu });
    }
    if (t >= T_ZOOM1 && t < 31.2) {
      w.setCam(L, valleyCam(t));
      w.valley(L, t, valleyK(t));
    }
    w.subtitle(L, '小时候，每一样东西，我都是第一次见。', 13.4, 18.2, t);
    w.subtitle(L, '后来，我知道了它们的名字。', 24.8, 29.6, t, { dark: false });
  }

  // ------------------------------------------------------------------ render
  let ready = false;
  function renderAt(t) {
    t = clamp(t, 0, DUR);
    FS.gfx.begin();
    const L = FS.gfx.L;
    if (t < 31.4) opening(L, t);
    if (C()) C().render(L, t);
    if (FS.final) FS.final.render(L, t);
    FS.gfx.composite(gradeAt(t), t);
  }
  function init(o = {}) {
    const w = o.width || 1920, h = o.height || Math.round(w * 9 / 16);
    FS.gfx.init(o.canvas || document.createElement('canvas'), w, h);
    ready = true;
  }
  function resize(w, h) { FS.gfx.resize(w, h); }
  function events() {
    const ev = [];
    // morphs in the valley
    [['日', 24.5], ['山', 25.9], ['木', 27.0], ['水', 28.0], ['雨', 28.9]].forEach(([ch, t]) => ev.push({ t, type: 'morph', ch, scene: 'valley' }));
    ev.push({ t: 6.85, type: 'drop' });
    // the title, written character by character
    [[7, 0.9, 0.14], [6, 2.05, 0.13], [6, 2.95, 0.13]].forEach(([n, t0, dt], c) => {
      for (let i = 0; i < n; i++) ev.push({ t: +(t0 + i * dt).toFixed(3), type: 'brush', col: c });
    });
    ev.push({ t: 10.0, type: 'blink' });
    if (C() && C().events) ev.push(...C().events());
    if (FS.final) ev.push(...FS.final.events());
    return ev.sort((a, b) => a.t - b.t);
  }

  G.FILM = { init, resize, renderAt, events, DUR, gradeAt };
})(typeof window !== 'undefined' ? window : globalThis);
