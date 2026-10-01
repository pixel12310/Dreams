/*
 * 初见 · FIRST SIGHT — layered canvases and the watercolour compositor.
 *
 * Each frame is painted into six 2D canvases:
 *   wash    opaque, starts as white: transparent pigment (sky, washes, colour)
 *   ink     transparent: brush lines and calligraphy
 *   light   transparent, additive: sun glow, sparkle, rays
 *   crayon  transparent: wax crayon (catches only the tooth of the paper)
 *   top     transparent: typography, crisp and untouched by the grade
 *   mask    quarter-res: where the world is "alive" regardless of the global fade
 *
 * A WebGL2 pass lays them onto rice paper: watercolour edge darkening, pigment
 * granulation and turbulence, ink feathering into the fibres, a slow line "boil",
 * glow, grain and vignette. Two global dials drive the film's theme:
 *   sat  colour saturation        (1 painted → 0 ink)
 *   tex  hand-made texture/life   (1 paper, boil, bleed → 0 flat print)
 * and a noisy circular wavefront (or the mask) can bring both back locally.
 */
(function (G) {
  'use strict';
  const FS = G.FS;
  const { VW, VH } = FS;

  const VS = `#version 300 es
  in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;

  const NOISE = `
  float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
    return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
  float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }`;

  // static paper: R grain, G fibres, B turbulence (large), A mid-frequency
  const FS_PAPER = `#version 300 es
  precision highp float;
  uniform float uScale; out vec4 o;
  ${NOISE}
  void main(){
    vec2 px = gl_FragCoord.xy * uScale;
    float grain = vn(px*.85)*.45 + vn(px*.42+3.1)*.35 + h21(floor(px*1.2))*.2;
    float fib = 0.;
    for (int k=0;k<5;k++){
      float a = float(k)*1.37+.4; mat2 R = mat2(cos(a),-sin(a),sin(a),cos(a));
      vec2 q = R*px + float(k)*31.7;
      float f = vn(q*vec2(.022,.55));
      fib = max(fib, smoothstep(.72,.95,f) * (.5 + .5*vn(q*.01)));
    }
    float turb = fbm(px*.0035);
    float mid = fbm(px*.028 + 11.);
    o = vec4(grain, fib, turb, mid);
  }`;

  const FS_MAIN = `#version 300 es
  precision highp float;
  uniform sampler2D uWash, uInk, uLight, uCrayon, uTop, uMask, uPaper;
  uniform vec2 uRes; uniform float uLod, uTime;
  uniform float uSat, uTex, uBleed, uBoilAmt, uGlow, uVig, uGrain, uFade, uEdge;
  uniform vec2 uBoil;
  uniform vec3 uPaperA, uPaperD, uFadeCol;
  uniform vec4 uWave; uniform float uWaveSoft, uWaveRing;
  out vec4 o;
  ${NOISE}
  float lum(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
  void main(){
    vec2 px = gl_FragCoord.xy;
    vec2 uv = vec2(px.x/uRes.x, 1. - px.y/uRes.y);
    float asp = uRes.x/uRes.y;
    vec4 P = texture(uPaper, uv);

    // where is the world alive?
    float alive = textureLod(uMask, uv, 1.).r;
    float ring = 0.;
    if (uWave.w > 0.) {
      vec2 d = (uv - uWave.xy) * vec2(asp, 1.);
      float n = texture(uPaper, fract(uv*.61 + .23)).b - .5;
      float n2 = texture(uPaper, fract(uv*2.3 + .71)).a - .5;
      float dist = length(d) + n*.30*min(uWave.z, .9) + n2*.05;
      float w = smoothstep(uWave.z + uWaveSoft, uWave.z - uWaveSoft, dist);
      alive = max(alive, w * uWave.w);
      ring = exp(-pow((dist - uWave.z)/max(uWaveSoft*.9, .004), 2.)) * uWave.w * uWaveRing;
    }
    alive = clamp(alive, 0., 1.);
    float tex = mix(uTex, 1., alive);
    float sat = mix(uSat, 1., alive);

    // line boil: displacement field that jumps a few times a second
    vec2 bd = vec2(texture(uPaper, fract(uv*.5 + uBoil)).a - .5, texture(uPaper, fract(uv*.5 + uBoil.yx + .37)).a - .5);
    bd *= uBoilAmt * tex / uRes * (uRes.y/1080.) * 2.;

    // ---- pigment
    vec2 uw = uv + bd;
    vec3 W = texture(uWash, uw).rgb;
    vec3 Wb = textureLod(uWash, uw, 2.6 + uLod).rgb;
    vec3 Wb2 = textureLod(uWash, uw, 4.2 + uLod).rgb;
    float e = clamp((lum(Wb) - lum(W)) * 3.2, 0., 1.) + clamp((lum(Wb2) - lum(W)) * 1.2, 0., .6);
    float pig = 1. - lum(W);
    float dens = 1. + tex * uEdge * (e*.85 + (P.r - .5)*.55*pig + (P.b - .5)*.42 + (P.a - .5)*.22 + ring*.9);
    W = W - (W - W*W) * (dens - 1.);
    W = clamp(W, 0., 1.);
    float L = lum(W);
    vec3 gray = vec3(L) * vec3(1.01, 1.0, .975);
    W = mix(gray, W, sat);
    // the dead world: flat, low-contrast, no hand in it
    vec3 flt = vec3(mix(.80, L, .62)) * vec3(.985, .99, 1.);
    W = mix(flt, W, tex);

    vec3 paper = uPaperA * (1. - .018*(P.g) - .035*(P.r - .5) - .05*(P.b - .5));
    paper = mix(uPaperD, paper, tex);
    paper = mix(vec3(lum(paper)), paper, mix(.0, 1., sat*.6 + .4));
    vec3 col = paper * W;

    // ---- ink
    vec2 ui = uv + bd*.8;
    vec4 I = texture(uInk, ui);
    vec4 Ib = textureLod(uInk, ui, 2.0 + uLod);
    float halo = smoothstep(.05 + .35*P.a, .8, Ib.a) * .34 * uBleed * tex;
    float A = max(I.a, halo);
    vec3 C = I.a > .02 ? I.rgb / I.a : Ib.rgb / max(Ib.a, .002);
    A *= mix(1., .84 + .26*P.r - .06*P.g, tex);
    C = mix(vec3(lum(C)), C, sat);
    C = mix(vec3(mix(.45, lum(C), .5)), C, tex);
    col = mix(col, C, clamp(A, 0., 1.));

    // ---- crayon: wax sits on the tooth of the paper
    vec4 Cr = texture(uCrayon, uv);
    if (Cr.a > .001) {
      float tooth = P.r*.7 + vn(px*vec2(.9,.25))*.3;
      float ca = Cr.a * smoothstep(.18, .5, tooth*.55 + Cr.a*.6);
      col = mix(col, Cr.rgb / Cr.a, clamp(ca, 0., 1.));
    }

    // ---- light (screen), with a soft bloom from the mips
    vec3 Lt = texture(uLight, uv).rgb + textureLod(uLight, uv, 3. + uLod).rgb*.7
            + textureLod(uLight, uv, 5. + uLod).rgb*.55 + textureLod(uLight, uv, 6.5 + uLod).rgb*.45;
    Lt = mix(vec3(lum(Lt)), Lt, sat) * uGlow;
    col = 1. - (1. - col) * (1. - clamp(Lt, 0., 1.));

    // ---- finishing
    vec2 cc = uv - .5;
    float v = smoothstep(1.25, .32, length(cc*vec2(asp*.78, 1.)));
    col *= mix(1., mix(.80, 1., v), uVig*tex);
    float gr = h21(floor(px/1.4) + fract(uTime*13.17)*vec2(97.,57.)) - .5;
    col += gr * uGrain * tex;

    vec4 T = texture(uTop, uv);
    col = col*(1. - T.a) + T.rgb;

    col = mix(uFadeCol, col, uFade);
    o = vec4(clamp(col, 0., 1.), 1.);
  }`;

  let gl, prog, W, H, K, glCv;
  const L = {};
  const tex = {};
  const uni = {};

  function mkCanvas(w, h, opaque) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { alpha: !opaque });
    return { cv, ctx };
  }

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  function mkTex(mip) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function buildPaper() {
    const p = program(FS_PAPER);
    gl.useProgram(p);
    tex.paper = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex.paper);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex.paper, 0);
    gl.viewport(0, 0, W, H);
    gl.uniform1f(gl.getUniformLocation(p, 'uScale'), 1080 / H);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
  }

  function initGL() {
    gl = glCv.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 not available');
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    buildPaper();
    prog = program(FS_MAIN);
    gl.useProgram(prog);
    for (const n of ['wash', 'ink', 'light', 'crayon', 'top', 'mask']) tex[n] = mkTex(n !== 'top' && n !== 'crayon');
    const names = ['uWash', 'uInk', 'uLight', 'uCrayon', 'uTop', 'uMask', 'uPaper', 'uRes', 'uLod', 'uTime', 'uSat', 'uTex', 'uBleed',
      'uBoilAmt', 'uGlow', 'uVig', 'uGrain', 'uFade', 'uEdge', 'uBoil', 'uPaperA', 'uPaperD', 'uFadeCol', 'uWave', 'uWaveSoft', 'uWaveRing'];
    for (const n of names) uni[n] = gl.getUniformLocation(prog, n);
    ['uWash', 'uInk', 'uLight', 'uCrayon', 'uTop', 'uMask', 'uPaper'].forEach((n, i) => gl.uniform1i(uni[n], i));
  }

  function makeLayers() {
    L.wash = mkCanvas(W, H, true);
    L.ink = mkCanvas(W, H);
    L.light = mkCanvas(W, H);
    L.crayon = mkCanvas(W, H);
    L.top = mkCanvas(W, H);
    L.mask = mkCanvas(Math.ceil(W / 4), Math.ceil(H / 4), true);
  }

  function init(canvas, w, h) {
    W = w; H = h; K = W / VW;
    glCv = canvas; glCv.width = W; glCv.height = H;
    makeLayers();
    initGL();
  }
  function resize(w, h) {
    W = w; H = h; K = W / VW;
    glCv.width = W; glCv.height = H;
    makeLayers();
    gl.deleteTexture(tex.paper);
    buildPaper();
    gl.useProgram(prog);
  }

  // reset every layer for a new frame; all contexts get the design-space transform
  function begin() {
    for (const n of ['wash', 'ink', 'light', 'crayon', 'top']) {
      const c = L[n].ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      c.filter = 'none';
      if (n === 'wash') { c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); }
      else c.clearRect(0, 0, W, H);
      c.setTransform(K, 0, 0, K, 0, 0);
    }
    const m = L.mask.ctx;
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.globalCompositeOperation = 'source-over';
    m.globalAlpha = 1;
    m.fillStyle = '#000'; m.fillRect(0, 0, L.mask.cv.width, L.mask.cv.height);
    m.setTransform(L.mask.cv.width / VW, 0, 0, L.mask.cv.height / VH, 0, 0);
  }

  function upload(unit, t, cv, premult, mip) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premult);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
  }

  // E: the grade for this frame (see film.js gradeAt)
  function composite(E, t) {
    gl.useProgram(prog);
    gl.viewport(0, 0, W, H);
    upload(0, tex.wash, L.wash.cv, false, true);
    upload(1, tex.ink, L.ink.cv, true, true);
    upload(2, tex.light, L.light.cv, true, true);
    upload(3, tex.crayon, L.crayon.cv, true, false);
    upload(4, tex.top, L.top.cv, true, false);
    upload(5, tex.mask, L.mask.cv, false, true);
    gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, tex.paper);
    gl.uniform2f(uni.uRes, W, H);
    gl.uniform1f(uni.uLod, Math.log2(H / 1080));
    gl.uniform1f(uni.uTime, t);
    gl.uniform1f(uni.uSat, E.sat);
    gl.uniform1f(uni.uTex, E.tex);
    gl.uniform1f(uni.uBleed, E.bleed);
    gl.uniform1f(uni.uBoilAmt, E.boil);
    gl.uniform1f(uni.uGlow, E.glow);
    gl.uniform1f(uni.uVig, E.vig);
    gl.uniform1f(uni.uGrain, E.grain);
    gl.uniform1f(uni.uFade, E.fade);
    gl.uniform1f(uni.uEdge, E.edge);
    // the boil changes on twos-and-a-half: 12 poses a second
    const bi = Math.floor(t * 12 + 1e-6);
    gl.uniform2f(uni.uBoil, FS.hash(bi * 1.7), FS.hash(bi * 3.1 + 7));
    gl.uniform3f(uni.uPaperA, E.paperA[0] / 255, E.paperA[1] / 255, E.paperA[2] / 255);
    gl.uniform3f(uni.uPaperD, E.paperD[0] / 255, E.paperD[1] / 255, E.paperD[2] / 255);
    const fc = E.fadeCol || [0, 0, 0];
    gl.uniform3f(uni.uFadeCol, fc[0] / 255, fc[1] / 255, fc[2] / 255);
    const wv = E.wave;
    if (wv && wv.on > 0) gl.uniform4f(uni.uWave, wv.x / VW, wv.y / VH, wv.r / VH, wv.on);
    else gl.uniform4f(uni.uWave, 0, 0, 0, 0);
    gl.uniform1f(uni.uWaveSoft, wv ? wv.soft / VH : 0.05);
    gl.uniform1f(uni.uWaveRing, wv ? (wv.ring ?? 1) : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  FS.gfx = { init, resize, begin, composite, L, get K() { return K; }, get W() { return W; }, get H() { return H; } };
})(typeof window !== 'undefined' ? window : globalThis);
