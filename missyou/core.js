/*
 * 想你了 · MISS YOU
 * A 44-second procedurally animated short, shot for shot from the shot list
 * (镜头表：想你了, S01–S15).
 *
 * Every frame is drawn in code:
 *   - a 2D canvas paints the shot (characters, phone UI, the diner, light)
 *     with depth-of-field done as blurred layers
 *   - a second 2D canvas paints the subtitles and the title card
 *   - a WebGL pass grades the picture per shot: exposure, white balance,
 *     split-toning, bloom, halation, diffusion, vignette, grain, flashes and fades
 *
 * The film is a pure function of time: FILM.renderAt(t) draws the exact frame
 * for second t, which is what the offline renderer uses to export the video.
 *
 * File layout: core.js (this file: engine, timeline, post) → people.js (character
 * drawing) → phone.js (the phone and its UI) → shots-night.js (S01–S05) →
 * shots-diner.js (S06–S15) → film.js (wires it all together).
 */
(function (G) {
  'use strict';
  const M = (G.MY = G.MY || {});

  // ---------------------------------------------------------------- constants
  const VW = 1920, VH = 1080;
  M.VW = VW; M.VH = VH;

  // ---------------------------------------------------------------- math
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const ss = (a, b, x) => smooth(clamp((x - a) / (b - a)));
  const fract = (x) => x - Math.floor(x);
  const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453123);
  const TAU = Math.PI * 2;
  function noise1(x) {
    const i = Math.floor(x), f = x - i;
    return lerp(hash(i), hash(i + 1), smooth(f)) * 2 - 1;
  }
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const easeIn = (t) => Math.pow(clamp(t), 3);
  const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  // keyframe track, ease-in-out between keys; values may be numbers or arrays
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
  Object.assign(M, { clamp, lerp, smooth, ss, fract, hash, TAU, noise1, easeOut, easeIn, easeInOut, mixc, rgba, track });

  // ---------------------------------------------------------------- drawing helpers
  M.rr = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  // soft radial light: stops are [offset, colour, alpha]
  M.glow = function (ctx, x, y, r, c, a = 1, op = 'lighter') {
    if (r <= 0 || a <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = op;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(c, a));
    g.addColorStop(0.35, rgba(c, a * 0.45));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  };
  M.lin = function (ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [o, c, a] of stops) g.addColorStop(o, rgba(c, a === undefined ? 1 : a));
    return g;
  };
  M.rad = function (ctx, x, y, r0, r1, stops, x1, y1) {
    const g = ctx.createRadialGradient(x, y, r0, x1 === undefined ? x : x1, y1 === undefined ? y : y1, r1);
    for (const [o, c, a] of stops) g.addColorStop(o, rgba(c, a === undefined ? 1 : a));
    return g;
  };
  // smooth closed/open path through points (Catmull-Rom → Bézier)
  M.spline = function (ctx, pts, closed = false, tension = 0.5) {
    const n = pts.length;
    const P = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    ctx.moveTo(pts[0][0], pts[0][1]);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const k = tension / 3;
      ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k,
        p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]);
    }
    if (closed) ctx.closePath();
  };
  // a tapered stroke (capsule with different end radii); adds a sub-path, caller begins the path
  M.capsule = function (ctx, ax, ay, bx, by, ra, rb) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-6;
    const a = Math.atan2(dy, dx);
    const s = Math.asin(clamp((ra - rb) / L, -1, 1));
    ctx.moveTo(ax + Math.cos(a + Math.PI / 2 + s) * ra, ay + Math.sin(a + Math.PI / 2 + s) * ra);
    ctx.arc(ax, ay, ra, a + Math.PI / 2 + s, a - Math.PI / 2 - s);
    ctx.arc(bx, by, rb, a - Math.PI / 2 - s, a + Math.PI / 2 + s);
    ctx.closePath();
  };
  // two-bone IK: returns the joint position
  M.ik2 = function (ax, ay, bx, by, l1, l2, bend) {
    let dx = bx - ax, dy = by - ay;
    let d = Math.hypot(dx, dy);
    const maxd = (l1 + l2) * 0.999;
    if (d > maxd) { dx *= maxd / d; dy *= maxd / d; d = maxd; }
    const a = Math.atan2(dy, dx);
    const c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
    const th = a + bend * Math.acos(c);
    return [ax + Math.cos(th) * l1, ay + Math.sin(th) * l1];
  };
  // handheld camera: smooth, slightly irregular drift
  M.shake = function (t, amp = 1, seed = 0) {
    const n = (o, f) => noise1(t * f + seed * 13.1 + o) * 0.6 + noise1(t * f * 2.3 + seed * 7.7 + o * 3) * 0.4;
    return { x: n(0, 0.55) * 7 * amp, y: n(50, 0.5) * 5 * amp, r: n(90, 0.4) * 0.0025 * amp };
  };
  // camera: look at (x, y) with zoom z and roll r; plus handheld offset
  M.camera = function (ctx, c) {
    const z = c.z || 1, x = c.x === undefined ? VW / 2 : c.x, y = c.y === undefined ? VH / 2 : c.y;
    const h = c.shake || { x: 0, y: 0, r: 0 };
    ctx.translate(VW / 2 + h.x, VH / 2 + h.y);
    ctx.rotate((c.r || 0) + h.r);
    ctx.scale(z, z);
    ctx.translate(-x, -y);
  };

  // ---------------------------------------------------------------- layers (depth of field)
  // Draw into an offscreen layer with the same transform, then composite it blurred.
  const pool = [];
  let poolI = 0;
  let W = 1920, H = 1080, SC = 1;
  function getLayer() {
    let c = pool[poolI];
    if (!c) { c = document.createElement('canvas'); pool[poolI] = c; }
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    poolI++;
    return c;
  }
  M.layer = function (ctx, blur, fn, opts = {}) {
    if (blur < 0.35 && !opts.alpha && !opts.op) { ctx.save(); fn(ctx); ctx.restore(); return; }
    const c = getLayer();
    const x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, W, H);
    x.setTransform(ctx.getTransform());
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none';
    fn(x);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (blur >= 0.35) ctx.filter = `blur(${(blur * SC).toFixed(2)}px)`;
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    if (opts.op) ctx.globalCompositeOperation = opts.op;
    ctx.drawImage(c, 0, 0);
    ctx.restore();
    poolI--;
  };

  // ---------------------------------------------------------------- light maps
  // Multiply everything drawn so far by (ambient + Σ lights). Scenes are painted as if fully lit,
  // then this decides where the light actually falls. lights: [{x, y, r, c, a, sx?, sy?}]
  M.lightMap = function (ctx, amb, lights) {
    M.layer(ctx, 0, (x) => {
      x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = rgba(amb); x.fillRect(0, 0, 1e5, 1e5); x.restore();
      x.globalCompositeOperation = 'lighter';
      for (const l of lights) {
        if (!l || l.a <= 0) continue;
        x.save();
        x.translate(l.x, l.y);
        if (l.rot) x.rotate(l.rot);
        x.scale(l.sx || 1, l.sy || 1);
        const g = x.createRadialGradient(0, 0, 0, 0, 0, l.r);
        const f = l.fall || [1, 0.62, 0.3, 0.1, 0];
        f.forEach((v, i) => g.addColorStop(i / (f.length - 1), rgba(l.c, l.a * v)));
        x.fillStyle = g;
        x.fillRect(-l.r, -l.r, l.r * 2, l.r * 2);
        x.restore();
      }
    }, { op: 'multiply' });
  };
  // cached procedural pattern tiles (drawn once, in virtual pixels)
  const pats = {};
  M.pattern = function (ctx, name, w, h, fn) {
    if (!pats[name]) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      fn(c.getContext('2d'), w, h);
      pats[name] = c;
    }
    return ctx.createPattern(pats[name], 'repeat');
  };

  // ---------------------------------------------------------------- fonts
  M.SERIF = '"MYSerif", "Noto Serif SC", "Songti SC", serif';
  M.SANS = '"MYSans", "Noto Sans SC", "PingFang SC", sans-serif';
  M.font = (ctx, size, weight = 400, fam = M.SANS) => { ctx.font = `${weight} ${size}px ${fam}`; };

  // ---------------------------------------------------------------- timeline
  // [id, start, end, subtitle] — the subtitles are the voice-over of the shot list
  const SHOTS = [
    ['BLACK', 0.0, 0.8, null],
    ['S01', 0.8, 3.3, '对方说一句想你了'],
    ['S02', 3.3, 6.0, '可你第一反应不是开心'],
    ['S03', 6.0, 8.8, '而是心里一阵说不上来的慌'],
    ['S04', 8.8, 12.3, '只想赶紧把话题岔开'],
    ['S05', 12.3, 14.5, null],
    ['S06', 14.5, 17.7, '刚开始相处的时候'],
    ['S07', 17.7, 19.9, '你明明觉得很自在'],
    ['S08', 19.9, 23.0, '可对方越认真'],
    ['S09', 23.0, 25.0, null],
    ['S10', 25.0, 27.6, '你就越容易挑出他的毛病'],
    ['S11', 27.6, 29.6, '他说话的语气'],
    ['S12', 29.6, 31.8, '回消息的速度'],
    ['S13', 31.8, 34.0, '甚至吃饭的声音'],
    ['S14', 34.0, 35.6, null],
    ['S15', 35.6, 40.4, '都开始让你觉得不舒服'],
    ['TITLE', 40.4, 44.0, null],
  ];
  const DUR = 44.0;
  M.SHOTS = SHOTS; M.DUR = DUR;
  M.shotTime = (id) => { const s = SHOTS.find((r) => r[0] === id); return [s[1], s[2]]; };
  M.defs = {};
  M.def = (id, d) => { M.defs[id] = d; };

  // subtitle timing: in a little after the cut, out just before the next one;
  // S15's line stays up through the start of the fade
  function subtitle(t) {
    for (const [id, t0, t1, text] of SHOTS) {
      if (!text || t < t0 || t >= t1 + 0.0001) continue;
      const a = t0 + 0.12, b = id === 'S15' ? t0 + 3.5 : t1 - 0.06;
      const al = ss(a, a + 0.16, t) * (1 - ss(b - 0.18, b, t));
      return al > 0 ? { text, a: al } : null;
    }
    return null;
  }

  // ---------------------------------------------------------------- grade
  // default grade; each shot overrides what it needs (may be a function of local time)
  const GRADE0 = {
    expo: 1, temp: 0, tint: 0, sat: 1, con: 1, lift: [0, 0, 0], gain: [1, 1, 1],
    bloom: 0.35, thresh: 0.72, mist: 0.0, hal: 0.0, vig: 0.4, grain: 0.03, ca: 1, flash: 0, fade: 0,
  };

  // ---------------------------------------------------------------- GL composite
  const VS = `#version 300 es
  in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
  const FS = `#version 300 es
  precision highp float;
  uniform sampler2D uScene, uBlur, uOver;
  uniform vec2 uRes; uniform float uTime;
  uniform float uExpo, uTemp, uTint, uSat, uCon, uBloom, uThresh, uMist, uHal, uVig, uGrain, uCA, uFlash, uFade;
  uniform vec3 uLift, uGain;
  out vec4 outColor;
  float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
  vec3 toLin(vec3 c){ return pow(c, vec3(2.2)); }
  vec3 toSrgb(vec3 c){ return pow(max(c,0.), vec3(1./2.2)); }
  // filmic shoulder that keeps mid-tones put
  vec3 tone(vec3 x){ return x/(1.+x*.22) * 1.22; }
  void main(){
    vec2 uv = vec2(gl_FragCoord.x/uRes.x, 1.-gl_FragCoord.y/uRes.y);
    float asp = uRes.x/uRes.y;
    vec2 cc = uv-.5;
    // lateral chromatic aberration, stronger toward the edges
    float ca = .0022*uCA*dot(cc,cc)*4.;
    vec3 col = vec3(texture(uScene, uv+cc*ca).r, texture(uScene, uv).g, texture(uScene, uv-cc*ca).b);
    vec3 bl = texture(uBlur, uv).rgb;
    vec3 lc = toLin(col), lb = toLin(bl);
    // diffusion (Pro-Mist): highlights bleed into the blurred image
    float lumb = dot(lb, vec3(.2126,.7152,.0722));
    lc = mix(lc, lb, uMist*smoothstep(.05,.6,lumb));
    // bloom + red-orange halation around bright edges
    vec3 bright = max(lb-uThresh*uThresh, 0.);
    lc += bright*uBloom*1.6;
    lc += vec3(1.,.38,.16)*dot(bright,vec3(.33))*uHal*2.2;
    // exposure and white balance (in linear light)
    lc *= uExpo;
    lc *= vec3(1.+.18*uTemp+.02*uTint, 1.-.05*uTint, 1.-.2*uTemp+.02*uTint);
    lc = tone(lc);
    col = toSrgb(lc);
    // split-tone: lift shadows, gain highlights
    float l = dot(col, vec3(.2126,.7152,.0722));
    col = col*uGain + uLift*(1.-l)*(1.-l);
    col = (col-.5)*uCon+.5;
    l = dot(col, vec3(.2126,.7152,.0722));
    col = mix(vec3(l), col, uSat);
    // vignette
    float v = smoothstep(1.25, .25, length(cc*vec2(asp*.8,1.)));
    col *= mix(1.-uVig, 1., v);
    col += uFlash;
    // grain, finer in the highlights
    float gr = h21(floor(gl_FragCoord.xy/1.5) + fract(uTime*24.)*vec2(97.,57.)) - .5;
    col += gr*uGrain*(1.2-l*.6);
    col *= 1.-uFade;
    // subtitles and title sit on top, ungraded
    vec4 ov = texture(uOver, uv);
    col = col*(1.-ov.a) + ov.rgb;
    outColor = vec4(clamp(col,0.,1.), 1.);
  }`;

  let gl, prog, glCv, sceneCv, overCv, blurCv, sctx, octx, bctx, texScene, texBlur, texOver;
  const uni = {};
  function initGL() {
    gl = glCv.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 not available');
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const mk = () => {
      const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tx;
    };
    texScene = mk(); texBlur = mk(); texOver = mk();
    for (const n of ['uScene', 'uBlur', 'uOver', 'uRes', 'uTime', 'uExpo', 'uTemp', 'uTint', 'uSat', 'uCon', 'uBloom', 'uThresh',
      'uMist', 'uHal', 'uVig', 'uGrain', 'uCA', 'uFlash', 'uFade', 'uLift', 'uGain']) uni[n] = gl.getUniformLocation(prog, n);
    gl.uniform1i(uni.uScene, 0); gl.uniform1i(uni.uBlur, 1); gl.uniform1i(uni.uOver, 2);
  }
  function upload(unit, tex, src, premul) {
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premul);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  }
  function composite(g, t) {
    // a soft, wide blur of the frame for bloom and diffusion
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.filter = `blur(${(blurCv.width / 90).toFixed(2)}px)`;
    bctx.drawImage(sceneCv, 0, 0, blurCv.width, blurCv.height);
    bctx.filter = 'none';
    gl.viewport(0, 0, W, H);
    upload(0, texScene, sceneCv, false);
    upload(1, texBlur, blurCv, false);
    upload(2, texOver, overCv, true);
    gl.uniform2f(uni.uRes, W, H);
    gl.uniform1f(uni.uTime, t);
    for (const k of ['expo', 'temp', 'tint', 'sat', 'con', 'bloom', 'thresh', 'mist', 'hal', 'vig', 'grain', 'ca', 'flash', 'fade'])
      gl.uniform1f(uni['u' + k[0].toUpperCase() + k.slice(1)], g[k]);
    gl.uniform3f(uni.uLift, ...g.lift);
    gl.uniform3f(uni.uGain, ...g.gain);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---------------------------------------------------------------- overlay
  function drawOverlay(ctx, t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(SC, 0, 0, SC, 0, 0);
    const s = subtitle(t);
    if (s) {
      ctx.save();
      // a soft dark band keeps the line readable over a bright phone screen
      ctx.globalAlpha = s.a;
      ctx.fillStyle = M.lin(ctx, 0, 880, 0, 1080, [[0, [0, 0, 0], 0], [0.6, [0, 0, 0], 0.32], [1, [0, 0, 0], 0.4]]);
      ctx.fillRect(0, 880, VW, 200);
      M.font(ctx, 44, 500, M.SERIF);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
      ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 22 * SC; ctx.shadowOffsetY = 2 * SC;
      ctx.fillStyle = 'rgba(246,242,234,0.97)';
      ctx.fillText(s.text, VW / 2, 990);
      ctx.shadowBlur = 6 * SC;
      ctx.fillText(s.text, VW / 2, 990);
      ctx.restore();
    }
    const d = M.defs.TITLE;
    if (d && d.overlay) d.overlay(ctx, t);
  }

  // ---------------------------------------------------------------- render
  function shotAt(t) {
    for (const s of SHOTS) if (t >= s[1] && t < s[2]) return s;
    return SHOTS[SHOTS.length - 1];
  }
  function renderAt(t) {
    t = clamp(t, 0, DUR - 1e-4);
    const [id, t0, t1] = shotAt(t);
    const lt = t - t0, dur = t1 - t0;
    const def = M.defs[id];
    poolI = 0;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalAlpha = 1; sctx.globalCompositeOperation = 'source-over'; sctx.filter = 'none';
    sctx.fillStyle = '#000';
    sctx.fillRect(0, 0, W, H);
    sctx.setTransform(SC, 0, 0, SC, 0, 0);
    if (def && def.draw) { sctx.save(); def.draw(sctx, lt, dur, t); sctx.restore(); }
    drawOverlay(octx, t);
    const g = Object.assign({}, GRADE0);
    if (def && def.grade) Object.assign(g, typeof def.grade === 'function' ? def.grade(lt, dur) : def.grade);
    composite(g, t);
  }

  function init(opts = {}) {
    W = opts.width || 1920; H = opts.height || Math.round(W * 9 / 16);
    SC = W / VW; M.SC = SC;
    glCv = opts.canvas || document.createElement('canvas');
    glCv.width = W; glCv.height = H;
    sceneCv = document.createElement('canvas'); sceneCv.width = W; sceneCv.height = H;
    overCv = document.createElement('canvas'); overCv.width = W; overCv.height = H;
    blurCv = document.createElement('canvas'); blurCv.width = Math.max(64, Math.round(W / 6)); blurCv.height = Math.max(36, Math.round(H / 6));
    sctx = sceneCv.getContext('2d', { alpha: false });
    octx = overCv.getContext('2d');
    bctx = blurCv.getContext('2d');
    initGL();
    return glCv;
  }
  function resize(w, h) {
    W = w; H = h; SC = W / VW; M.SC = SC;
    glCv.width = W; glCv.height = H; sceneCv.width = W; sceneCv.height = H; overCv.width = W; overCv.height = H;
    blurCv.width = Math.max(64, Math.round(W / 6)); blurCv.height = Math.max(36, Math.round(H / 6));
  }

  // picture-locked sound cues: each shot may report its own events (absolute times)
  function events() {
    const ev = [];
    for (const [id, t0, t1] of SHOTS) {
      ev.push({ t: t0, type: 'cut', shot: id, end: t1 });
      const d = M.defs[id];
      if (d && d.events) for (const e of d.events()) ev.push(Object.assign({}, e, { t: +(t0 + e.t).toFixed(4), shot: id }));
    }
    ev.sort((a, b) => a.t - b.t);
    return ev;
  }

  M.engine = { init, resize, renderAt, events, DUR, VW, VH };
})(typeof window !== 'undefined' ? window : globalThis);
