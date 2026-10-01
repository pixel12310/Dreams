/*
 * The phone: body, lock screen, chat screen, pinyin keyboard and a typing simulator.
 * All screen UI is laid out in points on a 390 × 844 screen and scaled to fit.
 */
(function (G) {
  'use strict';
  const M = G.MY;
  const { clamp, lerp, ss, rr, rgba, easeOut } = M;
  const SW = 390, SH = 844;
  M.PHONE = { SW, SH };

  // ---------------------------------------------------------------- body
  // Draws the phone with its screen at (x, y) (top-left of the screen), width w, rotated by rot
  // around the screen centre. `screen(ctx)` paints the screen in 390×844 points.
  M.phone = function (ctx, x, y, w, rot, screen, opts = {}) {
    const k = w / SW, h = SH * k, b = 11 * k, R = 52 * k;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(rot || 0);
    ctx.translate(-w / 2, -h / 2);
    // body: metal rim + glass
    if (!opts.noShadow) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 40 * k * M.SC; ctx.shadowOffsetY = 14 * k * M.SC;
      rr(ctx, -b, -b, w + 2 * b, h + 2 * b, R + b); ctx.fillStyle = '#16181c'; ctx.fill();
      ctx.restore();
    }
    rr(ctx, -b, -b, w + 2 * b, h + 2 * b, R + b);
    ctx.fillStyle = M.lin(ctx, -b, -b, w + b, h + b, [[0, [70, 74, 82]], [0.5, [28, 30, 34]], [1, [58, 62, 70]]]);
    ctx.fill();
    rr(ctx, -b * 0.55, -b * 0.55, w + b * 1.1, h + b * 1.1, R + b * 0.5); ctx.fillStyle = '#050506'; ctx.fill();
    // screen
    ctx.save();
    rr(ctx, 0, 0, w, h, R); ctx.clip();
    if (opts.off) {
      ctx.fillStyle = M.lin(ctx, 0, 0, w, h, [[0, [14, 15, 18]], [1, [6, 6, 8]]]);
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.save(); ctx.scale(k, k); screen(ctx); ctx.restore();
      if (opts.dim) { ctx.fillStyle = `rgba(0,0,0,${opts.dim})`; ctx.fillRect(0, 0, w, h); }
    }
    // dynamic island
    rr(ctx, w / 2 - 62 * k, 11 * k, 124 * k, 36 * k, 18 * k); ctx.fillStyle = '#000'; ctx.fill();
    // glass reflection
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = M.lin(ctx, 0, 0, w, h * 0.6, [[0, [255, 255, 255], 0.07], [0.45, [255, 255, 255], 0.0], [1, [255, 255, 255], 0]]);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    ctx.restore();
  };

  // ---------------------------------------------------------------- status bar
  function statusBar(ctx, time, light) {
    const c = light ? '#fff' : '#111';
    ctx.fillStyle = c;
    M.font(ctx, 17, 500);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillText(time, 62, 30);
    // signal
    for (let i = 0; i < 4; i++) { rr(ctx, 286 + i * 6, 34 - 4 - i * 2.4, 4, 4 + i * 2.4, 1); ctx.fill(); }
    // wifi
    ctx.strokeStyle = c; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(322, 37, 3 + i * 4, -Math.PI * 0.75, -Math.PI * 0.25); ctx.stroke(); }
    // battery
    ctx.lineWidth = 1.2; ctx.globalAlpha = 0.5;
    rr(ctx, 336, 24.5, 25, 12, 3.5); ctx.stroke(); ctx.globalAlpha = 1;
    rr(ctx, 338, 26.5, 15, 8, 2); ctx.fill();
    rr(ctx, 362.5, 28, 1.6, 5, 1); ctx.fill();
  }

  // ---------------------------------------------------------------- lock screen
  M.lockScreen = function (ctx, o) {
    // wallpaper: a soft dusk photograph-like gradient (sea, moon)
    ctx.fillStyle = M.lin(ctx, 0, 0, 0, SH, [[0, [22, 30, 66]], [0.45, [58, 62, 112]], [0.62, [150, 112, 132]], [0.66, [70, 74, 118]], [1, [16, 20, 44]]]);
    ctx.fillRect(0, 0, SW, SH);
    M.glow(ctx, 280, 470, 160, [255, 220, 200], 0.25);
    ctx.fillStyle = 'rgba(255,245,235,0.9)';
    ctx.beginPath(); ctx.arc(280, 470, 16, 0, M.TAU); ctx.fill();
    for (let i = 0; i < 26; i++) {
      const y = 560 + i * 11, a = 0.2 * (1 - i / 26);
      ctx.fillStyle = `rgba(255,230,220,${a})`;
      ctx.fillRect(270 - (30 + i * 3) * (0.5 + 0.5 * M.hash(i)), y, (60 + i * 6) * (0.5 + 0.5 * M.hash(i + 9)), 2);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, 0, SW, SH);
    statusBar(ctx, '', true);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    M.font(ctx, 21, 500);
    ctx.fillText('10月1日 星期四', SW / 2, 142);
    M.font(ctx, 96, 400);
    ctx.fillText(o.time || '23:47', SW / 2, 236);
    // notification
    const p = o.notify === undefined ? 1 : o.notify;
    if (p > 0) {
      const e = easeOut(p);
      ctx.save();
      ctx.globalAlpha = clamp(p * 3);
      ctx.translate(SW / 2, 330 + (1 - e) * -40);
      ctx.scale(0.9 + 0.1 * e, 0.9 + 0.1 * e);
      rr(ctx, -178, -40, 356, 84, 22);
      ctx.fillStyle = 'rgba(245,246,250,0.82)'; ctx.fill();
      // app icon
      rr(ctx, -162, -24, 46, 46, 11);
      ctx.fillStyle = M.lin(ctx, 0, -24, 0, 22, [[0, [120, 220, 130]], [1, [52, 178, 88]]]); ctx.fill();
      chatGlyph(ctx, -139, -1, 1, '#fff');
      ctx.fillStyle = '#111'; ctx.textAlign = 'left';
      M.font(ctx, 17, 500); ctx.fillText('L', -102, -9);
      M.font(ctx, 17, 400); ctx.fillText('想你了', -102, 18);
      ctx.fillStyle = 'rgba(60,60,67,0.6)'; ctx.textAlign = 'right';
      M.font(ctx, 14, 400); ctx.fillText('现在', 162, -9);
      ctx.restore();
    }
    // bottom: flashlight / camera
    for (const x of [60, SW - 60]) {
      ctx.fillStyle = 'rgba(30,30,40,0.45)';
      ctx.beginPath(); ctx.arc(x, SH - 92, 25, 0, M.TAU); ctx.fill();
    }
    rr(ctx, SW / 2 - 70, SH - 14, 140, 5, 3); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
  };
  function chatGlyph(ctx, x, y, s, c) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(0, -1, 15, 12.5, 0, 0, M.TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-9, 7); ctx.lineTo(-12, 15); ctx.lineTo(-2, 10); ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------- typing simulator
  const PY = { 我: 'wo', 也: 'ye', 对: 'dui', 了: 'le', 你: 'ni', 明: 'ming', 天: 'tian', 几: 'ji', 点: 'dian', 上: 'shang', 班: 'ban' };
  const CAND = { 我: '我窝握沃', 也: '也夜页野', 对: '对队堆兑', 了: '了乐勒肋', 你: '你尼泥拟', 明: '明名命鸣', 天: '天田添甜', 几: '几及记机', 点: '点电店典', 上: '上伤商尚', 班: '班般搬板' };
  // spec: [['type', text, t0, t1], ['del', n, t0, t1], ['send', t]]
  M.typingScript = function (spec) {
    const ev = [];
    for (const s of spec) {
      if (s[0] === 'type') {
        const chars = [...s[1]], n = chars.length, slot = (s[3] - s[2]) / n;
        chars.forEach((ch, i) => {
          const py = PY[ch] || ch, keys = py.length;
          for (let j = 0; j < keys; j++) ev.push({ t: s[2] + slot * i + slot * 0.78 * (j / keys), key: py[j], py: py.slice(0, j + 1), ch });
          ev.push({ t: s[2] + slot * i + slot * 0.86, key: 'cand', commit: ch });
        });
      } else if (s[0] === 'del') {
        for (let i = 0; i < s[1]; i++) ev.push({ t: s[2] + (s[3] - s[2]) * (s[1] > 1 ? i / (s[1] - 1) : 0), key: 'del' });
      } else if (s[0] === 'send') ev.push({ t: s[1], key: 'send' });
    }
    ev.sort((a, b) => a.t - b.t);
    return ev;
  };
  M.typingState = function (ev, t) {
    let input = '', py = '', cands = '', sent = null, last = null;
    for (const e of ev) {
      if (e.t > t) break;
      last = e;
      if (e.py) { py = e.py; cands = CAND[e.ch] || e.ch; }
      if (e.commit) { input += e.commit; py = ''; cands = ''; }
      if (e.key === 'del') input = [...input].slice(0, -1).join('');
      if (e.key === 'send') { sent = { text: input, t: e.t }; input = ''; }
    }
    const press = last && t - last.t < 0.1 ? { key: last.key, a: 1 - (t - last.t) / 0.1 } : null;
    return { input, py, cands, sent, press };
  };

  // ---------------------------------------------------------------- chat screen
  const BG = '#e4e4e4', MINE = [158, 222, 160], THEIRS = [255, 255, 255];
  // o: { time, msgs: [{side:'l'|'r'|'time', text, at, stamp}], t, input, caret, keyboard, typing }
  M.chatScreen = function (ctx, o) {
    const t = o.t;
    ctx.fillStyle = BG; ctx.fillRect(0, 0, SW, SH);
    // keyboard & input bar geometry
    const kbH = o.keyboard ? 300 : 0;
    const barH = 58, barY = SH - kbH - barH - (o.keyboard ? 0 : 26);
    // messages: laid out bottom-up above the input bar
    const items = [];
    M.font(ctx, 17, 400);
    for (const m of o.msgs) {
      if (m.at !== undefined && t < m.at) continue;
      const p = m.at === undefined ? 1 : clamp((t - m.at) / 0.16);
      if (m.side === 'time') { items.push({ m, h: 34, p }); continue; }
      const tw = ctx.measureText(m.text).width;
      items.push({ m, h: 54 + (m.stamp ? 6 : 0), w: Math.min(240, tw + 26), p });
    }
    let y = barY - 14;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 100, SW, barY - 100); ctx.clip();
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      const hh = it.h * easeOut(it.p);
      y -= hh;
      const m = it.m;
      ctx.save();
      ctx.globalAlpha = clamp(it.p * 1.6);
      if (m.side === 'time') {
        ctx.fillStyle = 'rgba(0,0,0,0.38)'; M.font(ctx, 13, 400); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(m.text, SW / 2, y + 17);
      } else {
        const right = m.side === 'r';
        const ax = right ? SW - 14 - 42 : 14, by = y + 6;
        // avatar
        rr(ctx, ax, by, 42, 42, 6);
        if (right) { ctx.fillStyle = M.lin(ctx, ax, by, ax + 42, by + 42, [[0, [236, 186, 150]], [1, [196, 130, 120]]]); ctx.fill(); }
        else {
          ctx.fillStyle = M.lin(ctx, ax, by, ax + 42, by + 42, [[0, [104, 140, 196]], [1, [62, 92, 150]]]); ctx.fill();
          ctx.fillStyle = '#fff'; M.font(ctx, 20, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('L', ax + 21, by + 22);
        }
        // bubble pops in from the avatar side
        const bw = it.w, bh = 42;
        const bx = right ? ax - 10 - bw : ax + 42 + 10;
        const sc = 0.85 + 0.15 * easeOut(it.p);
        ctx.save();
        ctx.translate(right ? bx + bw : bx, by + bh / 2);
        ctx.scale(sc, sc);
        ctx.translate(right ? -(bx + bw) : -bx, -(by + bh / 2));
        rr(ctx, bx, by, bw, bh, 7);
        ctx.fillStyle = rgba(right ? MINE : THEIRS); ctx.fill();
        ctx.beginPath();
        if (right) { ctx.moveTo(bx + bw - 1, by + 15); ctx.lineTo(bx + bw + 6, by + 21); ctx.lineTo(bx + bw - 1, by + 27); }
        else { ctx.moveTo(bx + 1, by + 15); ctx.lineTo(bx - 6, by + 21); ctx.lineTo(bx + 1, by + 27); }
        ctx.fill();
        ctx.fillStyle = '#161616'; M.font(ctx, 17, 400); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(m.text, bx + 13, by + bh / 2 + 1);
        ctx.restore();
        if (m.stamp) {
          ctx.fillStyle = 'rgba(0,0,0,0.36)'; M.font(ctx, 11, 400); ctx.textBaseline = 'middle';
          ctx.textAlign = right ? 'right' : 'left';
          ctx.fillText(m.stamp, right ? bx - 6 : bx + bw + 6, by + bh - 6);
        }
      }
      ctx.restore();
    }
    ctx.restore();
    // header
    ctx.fillStyle = 'rgba(237,237,237,0.96)'; ctx.fillRect(0, 0, SW, 100);
    statusBar(ctx, o.time || '23:47', false);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(30, 64); ctx.lineTo(20, 74); ctx.lineTo(30, 84); ctx.stroke();
    ctx.fillStyle = '#111'; M.font(ctx, 18, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(o.title || 'L', SW / 2, 74);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(350 + i * 8, 74, 2.2, 0, M.TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(0, 100, SW, 1);
    // input bar
    ctx.fillStyle = '#f6f6f6'; ctx.fillRect(0, barY, SW, SH - barY);
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(0, barY, SW, 1);
    // voice icon
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(28, barY + 29, 13, 0, M.TAU); ctx.stroke();
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(22, barY + 29, 4 + i * 4, -0.6, 0.6); ctx.stroke(); }
    const has = (o.input || '').length > 0 || (o.py || '').length > 0;
    const fieldW = has ? 236 : 262;
    rr(ctx, 50, barY + 10, fieldW, 38, 6); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.fillStyle = '#111'; M.font(ctx, 17, 400); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const txt = o.input || '';
    ctx.fillText(txt, 60, barY + 30);
    let cx = 60 + ctx.measureText(txt).width;
    if (o.py) {
      ctx.fillStyle = '#2f7cf6'; ctx.fillText(o.py, cx, barY + 30);
      const pw = ctx.measureText(o.py).width;
      ctx.fillRect(cx, barY + 41, pw, 1.2);
      cx += pw;
    }
    if (o.caret && Math.floor(t * 1.9) % 2 === 0) { ctx.fillStyle = '#2fb35a'; ctx.fillRect(cx + 1, barY + 19, 2, 22); }
    // emoji, plus / send
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1.8;
    const ex = has ? 304 : 330;
    ctx.beginPath(); ctx.arc(ex, barY + 29, 13, 0, M.TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(ex, barY + 31, 6, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(ex - 4.5, barY + 25, 1.6, 0, M.TAU); ctx.arc(ex + 4.5, barY + 25, 1.6, 0, M.TAU); ctx.fill();
    if (has) {
      const pr = o.press && o.press.key === 'send' ? o.press.a : 0;
      rr(ctx, 324, barY + 12, 56, 34, 6);
      ctx.fillStyle = rgba(M.mixc([64, 184, 96], [40, 140, 70], pr)); ctx.fill();
      ctx.fillStyle = '#fff'; M.font(ctx, 16, 500); ctx.textAlign = 'center'; ctx.fillText('发送', 352, barY + 30);
    } else {
      ctx.beginPath(); ctx.arc(362, barY + 29, 13, 0, M.TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(355, barY + 29); ctx.lineTo(369, barY + 29); ctx.moveTo(362, barY + 22); ctx.lineTo(362, barY + 36); ctx.stroke();
    }
    if (o.keyboard) keyboard(ctx, SH - kbH, kbH, o);
    else { rr(ctx, SW / 2 - 70, SH - 14, 140, 5, 3); ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fill(); }
  };

  // ---------------------------------------------------------------- keyboard
  const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  M.keyRect = function (key) {
    // in screen points, relative to the keyboard top; null if not a letter
    const top = 44, kw = 33, kh = 44, gap = 6, rowH = 54;
    for (let r = 0; r < 3; r++) {
      const i = ROWS[r].indexOf(key);
      if (i < 0) continue;
      const n = ROWS[r].length, total = n * kw + (n - 1) * gap;
      const x0 = (SW - total) / 2 + (r === 2 ? 0 : 0);
      return { x: x0 + i * (kw + gap), y: top + 8 + r * rowH, w: kw, h: kh };
    }
    if (key === 'del') return { x: SW - 8 - 46, y: top + 8 + 2 * rowH, w: 46, h: kh };
    if (key === 'cand') return { x: 14, y: 6, w: 40, h: 32 };
    if (key === 'send') return { x: SW - 8 - 88, y: top + 8 + 3 * rowH, w: 88, h: kh };
    return null;
  };
  function keyboard(ctx, y0, h, o) {
    ctx.save();
    ctx.translate(0, y0);
    ctx.fillStyle = '#d3d6dc'; ctx.fillRect(0, 0, SW, h);
    // candidate bar
    ctx.textBaseline = 'middle';
    if (o.cands) {
      ctx.fillStyle = '#5a5e66'; M.font(ctx, 13, 400); ctx.textAlign = 'left';
      ctx.fillText(o.py || '', 12, 10);
      M.font(ctx, 21, 400); ctx.fillStyle = '#111';
      [...o.cands].forEach((c, i) => { ctx.fillStyle = i === 0 ? '#111' : '#3c3f45'; ctx.fillText(c, 18 + i * 52, 29); });
    } else {
      ctx.strokeStyle = '#6a6e76'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(34 + i * 78, 24, 9, 0, M.TAU); ctx.stroke(); }
    }
    const press = o.press;
    const drawKey = (r, label, dark, pressed) => {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowOffsetY = 1.2 * M.SC; ctx.shadowBlur = 0;
      rr(ctx, r.x, r.y, r.w, r.h, 6);
      ctx.fillStyle = pressed ? (dark ? '#e9ebee' : '#b7bcc5') : dark ? '#abb0ba' : '#fff';
      ctx.fill();
      ctx.restore();
      if (label) {
        ctx.fillStyle = '#111'; M.font(ctx, label.length > 1 ? 15 : 22, 400); ctx.textAlign = 'center';
        ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
      }
    };
    for (const row of ROWS) for (const k of row) drawKey(M.keyRect(k), k, false, false);
    const top = 44, rowH = 54;
    drawKey({ x: 8, y: top + 8 + 2 * rowH, w: 46, h: 44 }, '', true, false);
    // shift arrow
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.7; ctx.lineJoin = 'round';
    ctx.beginPath(); const sx = 31, sy = top + 8 + 2 * rowH + 22;
    ctx.moveTo(sx, sy - 10); ctx.lineTo(sx + 9, sy); ctx.lineTo(sx + 4, sy); ctx.lineTo(sx + 4, sy + 8); ctx.lineTo(sx - 4, sy + 8); ctx.lineTo(sx - 4, sy); ctx.lineTo(sx - 9, sy); ctx.closePath(); ctx.stroke();
    const dr = M.keyRect('del');
    drawKey(dr, '', true, press && press.key === 'del');
    const dx = dr.x + dr.w / 2, dy = dr.y + dr.h / 2;
    ctx.beginPath(); ctx.moveTo(dx - 13, dy); ctx.lineTo(dx - 6, dy - 8); ctx.lineTo(dx + 12, dy - 8); ctx.lineTo(dx + 12, dy + 8); ctx.lineTo(dx - 6, dy + 8); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dx - 1, dy - 4); ctx.lineTo(dx + 7, dy + 4); ctx.moveTo(dx + 7, dy - 4); ctx.lineTo(dx - 1, dy + 4); ctx.stroke();
    const by = top + 8 + 3 * rowH;
    drawKey({ x: 8, y: by, w: 46, h: 44 }, '123', true, false);
    drawKey({ x: 60, y: by, w: 40, h: 44 }, '，', false, false);
    drawKey({ x: 106, y: by, w: 140, h: 44 }, '空格', false, false);
    drawKey({ x: 252, y: by, w: 40, h: 44 }, '。', false, false);
    const sr = M.keyRect('send');
    const has = (o.input || '').length > 0;
    ctx.save();
    rr(ctx, sr.x, sr.y, sr.w, sr.h, 6);
    ctx.fillStyle = has ? (press && press.key === 'send' ? '#2b8a4c' : '#3fb565') : '#abb0ba'; ctx.fill();
    ctx.fillStyle = has ? '#fff' : '#111'; M.font(ctx, 15, 500); ctx.textAlign = 'center';
    ctx.fillText('发送', sr.x + sr.w / 2, sr.y + sr.h / 2 + 1);
    ctx.restore();
    // key pop-up
    if (press && press.key.length === 1) {
      const r = M.keyRect(press.key);
      if (r) {
        ctx.save();
        ctx.globalAlpha = clamp(press.a * 2.5);
        ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 6 * M.SC;
        rr(ctx, r.x - 7, r.y - 56, r.w + 14, 60, 9); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.shadowBlur = 0;
        rr(ctx, r.x, r.y - 6, r.w, r.h + 6, 6); ctx.fill();
        ctx.fillStyle = '#111'; M.font(ctx, 32, 400); ctx.textAlign = 'center';
        ctx.fillText(press.key, r.x + r.w / 2, r.y - 26);
        ctx.restore();
      }
    }
    if (press && press.key === 'cand') {
      ctx.fillStyle = `rgba(0,0,0,${0.12 * press.a})`; rr(ctx, 6, 6, 50, 34, 6); ctx.fill();
    }
    ctx.restore();
  }
})(typeof window !== 'undefined' ? window : globalThis);
