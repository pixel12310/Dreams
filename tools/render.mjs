#!/usr/bin/env node
/*
 * Offline renderer for the film.
 *
 *   node tools/render.mjs stills 5,12.5,30 [outDir]   → PNG stills
 *   node tools/render.mjs events [out.json]           → picture-locked sound cues
 *   node tools/render.mjs video [out.mp4] [--fps 30] [--w 1920] [--from 0] [--to 60] [--audio score.wav]
 *                                                     → frames piped straight into ffmpeg
 *
 * Each frame is produced by FILM.renderAt(t) in headless Chromium (WebGL via SwiftShader),
 * so the export is frame-exact and independent of real-time performance.
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(execRoot(), 'playwright'))); }
function execRoot() { return path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules'); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const mode = args[0] || 'stills';
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };

async function openFilm(w, h) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files', '--disable-accelerated-2d-canvas', '--disable-gpu-rasterization'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  const url = pathToFileURL(path.join(ROOT, 'film', 'index.html')).href + `?capture=1&w=${w}&h=${h}`;
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  return { browser, page };
}

async function grab(page, t) {
  const b64 = await page.evaluate((tt) => {
    window.FILM.renderAt(tt);
    return document.getElementById('film').toDataURL('image/png').split(',')[1];
  }, t);
  return Buffer.from(b64, 'base64');
}

async function stills() {
  const times = (args[1] || '5,12,20,30,44,52,58').split(',').map(Number);
  const out = args[2] || path.join(ROOT, 'stills');
  fs.mkdirSync(out, { recursive: true });
  const { browser, page } = await openFilm(+opt('w', 1920), +opt('h', 1080));
  for (const t of times) {
    const buf = await grab(page, t);
    const f = path.join(out, `t${t.toFixed(2).padStart(5, '0')}.png`);
    fs.writeFileSync(f, buf);
    console.log(f);
  }
  await browser.close();
}

async function events() {
  const out = args[1] || path.join(ROOT, 'build', 'events.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const { browser, page } = await openFilm(320, 180);
  const ev = await page.evaluate(() => window.FILM.events());
  fs.writeFileSync(out, JSON.stringify(ev, null, 1));
  console.log(`${ev.length} events → ${out}`);
  await browser.close();
}

async function video() {
  const out = args[1] && !args[1].startsWith('--') ? args[1] : path.join(ROOT, 'build', 'video.mp4');
  const fps = +opt('fps', 30), w = +opt('w', 1920), h = Math.round(w * 9 / 16);
  const from = +opt('from', 0), to = +opt('to', 60);
  const workers = +opt('workers', Math.max(1, Math.min(4, os.cpus().length)));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const n0 = Math.round(from * fps), n1 = Math.round(to * fps);
  const total = n1 - n0;
  const audio = opt('audio', null);
  const ffArgs = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-'];
  if (audio) ffArgs.push('-ss', String(from), '-t', String(to - from), '-i', audio);
  ffArgs.push('-c:v', 'libx264', '-preset', 'slow', '-crf', opt('crf', '18'), '-tune', 'grain', '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709');
  if (audio) ffArgs.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  ffArgs.push('-movflags', '+faststart', out);
  const ff = spawn('ffmpeg', ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
  // render in parallel workers, write in order
  const pages = await Promise.all(Array.from({ length: workers }, () => openFilm(w, h)));
  const pending = new Map();
  let next = n0, written = n0;
  const started = Date.now();
  async function worker(i) {
    const { page } = pages[i];
    while (true) {
      const n = next++;
      if (n >= n1) return;
      // render at the centre of the frame interval for stable sampling
      const buf = await grab(page, n / fps);
      pending.set(n, buf);
      while (pending.has(written)) {
        const b = pending.get(written); pending.delete(written);
        if (!ff.stdin.write(b)) await new Promise((r) => ff.stdin.once('drain', r));
        written++;
        if (written % fps === 0) {
          const el = (Date.now() - started) / 1000, done = written - n0;
          process.stdout.write(`\r${done}/${total} frames  ${(done / el).toFixed(2)} fps  eta ${Math.round((total - done) / (done / el))}s   `);
        }
      }
      // keep memory bounded if one worker races ahead
      while (pending.size > workers * 6) await new Promise((r) => setTimeout(r, 20));
    }
  }
  await Promise.all(pages.map((_, i) => worker(i)));
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await Promise.all(pages.map((p) => p.browser.close()));
  console.log(`\n→ ${out}`);
}

({ stills, events, video })[mode]().catch((e) => { console.error(e); process.exit(1); });
