/*
 * 初见 · FIRST SIGHT — core utilities
 * Math, deterministic noise and keyframe tracks. Everything in the film is a pure
 * function of time, so nothing here keeps state between frames.
 */
(function (G) {
  'use strict';
  const FS = (G.FS = G.FS || {});

  const VW = 1920, VH = 1080, TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const ss = (a, b, x) => smooth(clamp((x - a) / (b - a)));
  const ss2 = (a, b, x) => smoother(clamp((x - a) / (b - a)));
  const lin = (a, b, x) => clamp((x - a) / (b - a));
  const fract = (x) => x - Math.floor(x);
  const mod = (a, n) => ((a % n) + n) % n;
  const easeOut = (t, p = 3) => 1 - Math.pow(1 - clamp(t), p);
  const easeIn = (t, p = 3) => Math.pow(clamp(t), p);
  const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const backOut = (t, s = 1.4) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
  // a bump that rises over [a,b] and falls over [c,d]
  const win = (a, b, c, d, x) => ss(a, b, x) * (1 - ss(c, d, x));

  // ------------------------------------------------------------- hashing / noise
  function hash(n) {
    n = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }
  const h2 = (a, b) => hash(a * 17.13 + b * 101.7);
  const h3 = (a, b, c) => hash(a * 17.13 + b * 101.7 + c * 57.31);

  function noise1(x) {
    const i = Math.floor(x), f = x - i;
    return lerp(hash(i), hash(i + 1), smooth(f)) * 2 - 1;
  }
  function noise2(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = smooth(fx), uy = smooth(fy);
    const a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1);
    return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
  }
  function fbm1(x, oct = 3) {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { s += a * noise1(x * f + i * 13.7); f *= 2.03; a *= 0.5; }
    return s;
  }
  function fbm2(x, y, oct = 3) {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { s += a * noise2(x * f + i * 7.3, y * f - i * 3.1); f *= 2.03; a *= 0.5; }
    return s;
  }

  // seeded PRNG (mulberry32)
  function rng(seed) {
    let s = (seed * 2654435761) >>> 0;
    const r = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (a, b) => a + (b - a) * r();
    r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += r(); return (u - 2) / 0.577; };
    return r;
  }

  // ------------------------------------------------------------- colour
  function hex(h) {
    const n = parseInt(h.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const rgba = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
  const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const desat = (c, k) => { const l = lum(c); return mixc([l, l, l], c, k); };
  const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

  // ------------------------------------------------------------- keyframe tracks
  // keys: [[t, value, ease?], ...] — value may be a number or an [r,g,b] array.
  // The ease of key i shapes the segment that ends at key i.
  function track(keys) {
    const n = keys.length;
    return (t) => {
      if (t <= keys[0][0]) return keys[0][1];
      for (let i = 1; i < n; i++) {
        if (t <= keys[i][0]) {
          const [t0, v0] = keys[i - 1], [t1, v1, e] = keys[i];
          let u = (t - t0) / (t1 - t0);
          u = e === 'lin' ? u : e === 'out' ? easeOut(u) : e === 'in' ? easeIn(u) : e === 'io' ? easeInOut(u) : smooth(u);
          return Array.isArray(v0) ? mixc(v0, v1, u) : lerp(v0, v1, u);
        }
      }
      return keys[n - 1][1];
    };
  }

  Object.assign(FS, {
    VW, VH, TAU, clamp, lerp, smooth, smoother, ss, ss2, lin, fract, mod, easeOut, easeIn, easeInOut, backOut, win,
    hash, h2, h3, noise1, noise2, fbm1, fbm2, rng, hex, mixc, rgba, lum, desat, shade, track,
  });
})(typeof window !== 'undefined' ? window : globalThis);
