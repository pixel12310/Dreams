#!/usr/bin/env python3
"""
Score and sound design for 初见 · FIRST SIGHT — synthesised from nothing with numpy.

    python3 tools/score_first_sight.py [build/fs_events.json] [out.wav]

The events file comes from `node tools/render.mjs events build/fs_events.json --film first-sight`
so every brush stroke, crayon squeak, door and dawn lands on its frame.

The music is built on one four-note question, A–B–D–E in D pentatonic (宫调).
  0–7     the question, on a bamboo flute (箫), left hanging
  7–12    a drop of colour; guzheng harmonics bloom with the iris
  12–24   the valley: the whole theme on guzheng, the flute answering
  24–30   each thing given its name: a plucked note, a brush stroke
  30–37   the copybook: brush scratches and a schoolroom piano
  37–43   day one: the theme on piano; when he looks up, the flute
  43–54   day after day: the question replayed every morning, each time
          faster and more worn — guzheng, then electric piano, then a
          bit-crushed beep, then only a tick
  54–61   the page of 日: a rain of type, a low drone
  61–72   a grey room: a clock, a pen, a crayon squeaking on glass,
          a child's question in silence, one dead note for 「红」
  72–77   the 日 opens: a guzheng sweep (刮奏), and the colour comes back
          as the full ensemble; the question finally resolves to D
  77–90   his eye; the street; the theme in full; day 1
  90–95   初见: the last chord, a seal pressed into paper
"""
import json, sys, pathlib, wave
import numpy as np
from scipy import signal

SR = 48000
DUR = 95.0
N = int(SR * DUR)
ROOT = pathlib.Path(__file__).resolve().parent.parent
rng = np.random.default_rng(1215)

ev_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'build' / 'fs_events.json'
EV = json.loads(ev_path.read_text()) if ev_path.exists() else []
def evs(kind):
    return [e for e in EV if e['type'] == kind]

# ------------------------------------------------------------------ buses
def stereo():
    return np.zeros((2, N))
zheng_bus, flute_bus, piano_bus, pad_bus, motif_bus, sfx, amb, brush_bus = (stereo() for _ in range(8))

def place(bus, x, t0, pan=0.0, gain=1.0):
    i0 = int(round(t0 * SR))
    if i0 >= N or len(x) == 0:
        return
    if i0 < 0:
        x = x[-i0:]; i0 = 0
    n = min(len(x), N - i0)
    l = np.cos((pan + 1) * np.pi / 4) * gain
    r = np.sin((pan + 1) * np.pi / 4) * gain
    bus[0, i0:i0 + n] += x[:n] * l
    bus[1, i0:i0 + n] += x[:n] * r

def tvec(d):
    return np.arange(int(max(d, 0) * SR)) / SR

def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc / (SR / 2), 0.99), 'low'); return signal.lfilter(b, a, x)
def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'high'); return signal.lfilter(b, a, x)
def bp(x, f1, f2, order=2):
    b, a = signal.butter(order, [f1 / (SR / 2), min(f2 / (SR / 2), 0.99)], 'band'); return signal.lfilter(b, a, x)
def noise(d):
    return rng.standard_normal(int(d * SR))
def pink(d):
    n = int(d * SR)
    X = np.fft.rfft(rng.standard_normal(n)); f = np.arange(len(X)); f[0] = 1
    return np.fft.irfft(X / np.sqrt(f), n) * 30
def brown(d):
    x = np.cumsum(rng.standard_normal(int(d * SR))); x = hp(x, 18)
    return x / (np.abs(x).max() + 1e-9)
def curve(keys, n=N):
    ts = np.array([k[0] for k in keys]); vs = np.array([k[1] for k in keys])
    return np.interp(np.arange(n) / SR, ts, vs)
def env_ar(n, a, r):
    e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    if na > 0: e[:na] = np.linspace(0, 1, na) ** 1.5
    if nr > 0: e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e

NOTE = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
def nm(s):
    return 12 * (int(s[-1]) + 1) + NOTE[s[:-1]]
def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)

# ------------------------------------------------------------------ instruments
def zheng(note, dur=2.5, vel=0.7, slide=0.0, bend=None, vib=0.0, bright=1.0, harm=False, tail=3.5):
    """Guzheng: a steel string plucked near the bridge, with the left hand's
    slides (滑音), bends (按音) and vibrato (揉弦). harm: a harmonic (泛音)."""
    f0 = hz(nm(note)) if isinstance(note, str) else hz(note)
    d = dur + tail
    t = tvec(d)
    semi = np.zeros_like(t)
    if slide:  # slide up into the note from `slide` semitones below
        semi += -slide * np.clip(1 - t / 0.09, 0, 1) ** 2
    if bend:   # [(t, semitones), ...] after the pluck
        semi += np.interp(t, [b[0] for b in bend], [b[1] for b in bend])
    if vib:
        semi += vib * np.sin(2 * np.pi * 5.4 * t + rng.uniform(0, 6)) * np.clip((t - 0.28) / 0.5, 0, 1)
    f = f0 * 2 ** (semi / 12)
    ph = 2 * np.pi * np.cumsum(f) / SR
    out = np.zeros_like(t)
    d0 = 0.42 + f0 / 900
    p = 0.13
    ks = (2, 4, 6, 8) if harm else range(1, 16)
    for k in ks:
        if k * f0 > 15000:
            break
        a = abs(np.sin(np.pi * k * p)) / k ** (0.85 if not harm else 1.6)
        a *= vel ** (0.15 * k / bright)
        dk = d0 * (1 + 0.32 * (k - 1) ** 1.25) * (0.55 if harm else 1)
        e = 0.35 * np.exp(-dk * 5 * t) + 0.65 * np.exp(-dk * t)
        B = 0.00007
        fk = k * np.sqrt(1 + B * k * k)
        det = 1 + rng.uniform(-0.0006, 0.0006)
        out += a * e * (np.sin(fk * ph + rng.uniform(0, 6.3)) + 0.4 * np.sin(fk * det * ph + rng.uniform(0, 6.3)))
    out *= 1 - np.exp(-t / 0.0012)
    # the pick
    nn = int(0.007 * SR)
    out[:nn] += bp(rng.standard_normal(nn), 1800, 9000) * np.linspace(1, 0, nn) ** 2 * 0.25 * vel * (0.3 if harm else 1)
    # body
    out = out + 0.35 * bp(out, 180, 330) + 0.2 * bp(out, 520, 760)
    # damp after dur
    rel = np.ones_like(t); i = int(dur * SR); rn = int(0.6 * SR)
    if i < len(rel):
        rel[i:i + rn] = np.linspace(1, 0, len(rel[i:i + rn])) ** 2; rel[i + rn:] = 0
    return out * rel * 0.12 * vel

def gliss(notes, t0, step=0.028, vel=0.5, pan0=-0.5, pan1=0.6, bus=None):
    for i, n in enumerate(notes):
        u = i / max(1, len(notes) - 1)
        place(bus if bus is not None else zheng_bus, zheng(n, 1.6, vel * (0.7 + 0.5 * np.sin(np.pi * u))), t0 + i * step, pan0 + (pan1 - pan0) * u)

def xiao(note, dur, vel=0.6, slide=0.0, bend=None, vib=0.18, bright=0.5, attack=0.16):
    """箫 / 笛: a breathy bamboo flute; brightness 0 (箫) … 1 (笛)."""
    f0 = hz(nm(note)) if isinstance(note, str) else hz(note)
    d = dur + 0.6
    t = tvec(d)
    semi = np.zeros_like(t)
    if slide:
        semi += -slide * np.clip(1 - t / 0.16, 0, 1) ** 1.5
    if bend:
        semi += np.interp(t, [b[0] for b in bend], [b[1] for b in bend])
    semi += vib * np.sin(2 * np.pi * 5.0 * t + rng.uniform(0, 6)) * np.clip((t - 0.35) / 0.6, 0, 1)
    semi += 0.04 * lp(rng.standard_normal(len(t)), 3) * 20
    f = f0 * 2 ** (semi / 12)
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) + (0.18 + 0.25 * bright) * np.sin(2 * ph) + (0.05 + 0.15 * bright) * np.sin(3 * ph) + 0.03 * bright * np.sin(4 * ph)
    e = env_ar(len(t), attack, 0.3)
    e *= 1 + 0.12 * np.sin(np.pi * np.clip(t / max(dur, 0.1), 0, 1))
    br = bp(rng.standard_normal(len(t)), f0 * 0.9, min(f0 * 4, 12000)) * (0.10 + 0.25 * np.exp(-t / 0.12))
    x = (tone * 0.8 + br * 0.9) * e
    x = lp(x, 2600 + 3500 * bright)
    return x * 0.09 * vel

def piano(note, dur, vel=0.6, bright=1.0, detune=0.0):
    f = (hz(nm(note)) if isinstance(note, str) else hz(note)) * (1 + detune)
    d = dur + 2.4
    t = tvec(d)
    out = np.zeros_like(t)
    B = 0.00012 * (f / 261.6)
    for n in range(1, int(min(14, 9000 / f)) + 1):
        fn = n * f * np.sqrt(1 + B * n * n)
        amp = vel ** (1 + 0.22 * n / bright) / n ** 1.15
        d1 = 2.4 + 0.9 * n + f / 300
        d2 = 0.25 + 0.07 * n + f / 1700
        e = 0.55 * np.exp(-d1 * t) + 0.45 * np.exp(-d2 * t)
        ph = rng.uniform(0, 6.3)
        out += amp * e * (np.sin(2 * np.pi * fn * t + ph) + 0.55 * np.sin(2 * np.pi * fn * (1 + rng.uniform(-8e-4, 8e-4)) * t + ph))
    out *= 1 - np.exp(-t / 0.002)
    hn = int(0.01 * SR)
    out[:hn] += bp(rng.standard_normal(hn), min(f * 2, 4000), min(f * 8, 12000)) * np.linspace(1, 0, hn) * 0.07 * vel
    rel = np.ones_like(t); i = int(dur * SR); rn = int(0.35 * SR)
    rel[i:i + rn] = np.linspace(1, 0, len(rel[i:i + rn])) ** 2; rel[i + rn:] = 0
    return lp(out * rel, 2200 + 4500 * vel * bright) * 0.2

def pad(notes, dur, vel=0.5, cutoff=1500, attack=1.4, release=2.0):
    d = dur + release
    t = tvec(d)
    out = np.zeros_like(t)
    for m in notes:
        f = hz(nm(m)) if isinstance(m, str) else hz(m)
        for k in range(4):
            det = 1 + (k - 1.5) * 0.0035
            vib = 1 + 0.002 * np.sin(2 * np.pi * (4.6 + k * 0.4) * t + k)
            ph = 2 * np.pi * np.cumsum(f * det * vib) / SR
            for n in range(1, int(min(12, 6000 / f)) + 1):
                out += np.sin(n * ph + k) / n
    out = lp(out, cutoff, 2)
    return out * env_ar(len(t), attack, release) * vel * 0.016 / max(1, len(notes) ** 0.5)

def epiano(note, dur, vel=0.5):
    f = hz(nm(note)); t = tvec(dur + 1.0)
    mod = np.sin(2 * np.pi * f * 2 * t) * 1.6 * np.exp(-t * 6)
    x = np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 2.4) + 0.2 * np.sin(4 * np.pi * f * t) * np.exp(-t * 5)
    return x * (1 - np.exp(-t / 0.002)) * vel * 0.12

def beep(note, dur, vel=0.5, bits=5, hold=6):
    f = hz(nm(note)); t = tvec(dur)
    x = np.zeros_like(t)
    for k in range(1, 12, 2):
        if k * f > 4000: break
        x += np.sin(2 * np.pi * k * f * t) / k
    x *= env_ar(len(t), 0.004, min(0.04, dur * 0.4))
    q = 2 ** bits
    x = np.round(x * q / 2) / (q / 2)
    x = np.repeat(x[::hold], hold)[:len(t)]
    return lp(x, 3200) * vel * 0.05

# ------------------------------------------------------------------ the themes
BPM = 76
BT = 60 / BPM
QUESTION = [('A4', 1), ('B4', 0.5), ('D5', 0.5), ('E5', 1.5)]
THEME = [('A4', 1), ('B4', 0.5), ('D5', 0.5), ('E5', 1.5), ('D5', 0.5),
         ('B4', 1), ('A4', 0.5), ('F#4', 0.5), ('A4', 2),
         ('D5', 1), ('E5', 0.5), ('F#5', 0.5), ('A5', 1.5), ('F#5', 0.5),
         ('E5', 1), ('D5', 0.5), ('B4', 0.5), ('D5', 2)]
# accompaniment: bass, then a broken chord (5 notes up, guzheng style)
PROG = [('D3', ['D4', 'A4', 'D5', 'E5', 'A5']), ('B2', ['F#3', 'B3', 'D4', 'F#4', 'A4']),
        ('G2', ['D3', 'G3', 'B3', 'D4', 'E4']), ('A2', ['E3', 'A3', 'C#4', 'E4', 'A4'])]

def melody(seq, t0, beat, inst, bus, pan=0.15, vel=0.6, **kw):
    t = t0
    for i, (n, b) in enumerate(seq):
        if n is not None:
            if inst is zheng:
                long = b * beat > 0.6
                x = zheng(n, b * beat + 0.4, vel * (0.92 + 0.12 * rng.random()), slide=kw.get('slide', 0) if i % 4 == 3 else 0,
                          vib=(0.22 if long else 0.0) * kw.get('vib', 1), bright=kw.get('bright', 1.0))
            elif inst is xiao:
                x = xiao(n, b * beat * 0.98, vel, slide=1.0 if i % 5 == 0 else 0, vib=0.2, bright=kw.get('bright', 0.4))
            else:
                x = inst(n, b * beat * 1.05, vel)
            place(bus, x, t + rng.uniform(-0.008, 0.008), pan)
        t += b * beat
    return t

def accomp(t0, bars, beat, vel=0.4, bright=1.0, start=0, pan=-0.25):
    for i in range(bars):
        bass, arp = PROG[(i + start) % len(PROG)]
        tb = t0 + i * 4 * beat
        place(zheng_bus, zheng(bass, 4 * beat, vel * 1.1, bright=bright * 0.8), tb, -0.35)
        for j, n in enumerate(arp + arp[-2::-1][:3]):
            place(zheng_bus, zheng(n, beat * 1.6, vel * (0.55 + 0.15 * (j == 0)), bright=bright), tb + beat * 0.5 + j * beat * 0.45, pan + 0.08 * j)

# ---------------------------------------------------------------- 0–7: the question
t = 0.7
for i, (n, b) in enumerate(QUESTION):
    dur = b * 0.95
    if i == 3:
        dur = 2.6
    place(flute_bus, xiao(n, dur, 0.62 + 0.05 * i, slide=1.0 if i == 0 else 0, vib=0.2, bright=0.25,
                          bend=[(0, 0), (2.0, 0), (2.6, -0.35)] if i == 3 else None), t, 0.1)
    t += b * 0.95
place(pad_bus, pad(['D3', 'A3'], 6.0, 0.35, 700, 2.0, 1.5), 0.3)
place(zheng_bus, zheng('D2', 4.0, 0.45, bright=0.5), 0.75, -0.2)
place(zheng_bus, zheng('A4', 1.0, 0.25, harm=True), 3.9, 0.4)

# ---------------------------------------------------------------- 7–12.6: the drop, the iris
for i, n in enumerate(['D5', 'A5', 'E5', 'B5', 'F#5', 'D6']):
    place(zheng_bus, zheng(n, 2.0, 0.6, harm=True), 7.05 + i * 0.32 + rng.uniform(0, 0.04), -0.5 + i * 0.2)
place(pad_bus, pad(['D4', 'E4', 'A4'], 5.0, 0.42, 1200, 1.2, 1.6), 7.1)
place(zheng_bus, zheng('A3', 3.0, 0.35, bright=0.6), 8.6, -0.3)
place(zheng_bus, zheng('E4', 2.0, 0.3, bright=0.6, vib=0.2), 9.6, 0.2)
# the push into the eye: a soft rising swell
place(sfx, lp(hp(noise(2.0), 1500), 9000) * (tvec(2.0) / 2.0) ** 3 * 0.06, 10.6, 0.0)

# ---------------------------------------------------------------- 12.6–24: the valley
VB = 12.6
accomp(VB, 4, BT, vel=0.42)
melody(THEME, VB + 4 * BT * 0.0 + 0.0, BT, zheng, zheng_bus, pan=0.2, vel=0.62, slide=1.2)
# the flute answers the second half an octave up, softly
melody([(n[:-1] + str(int(n[-1]) + 1) if n else None, b) for n, b in THEME[9:]], VB + 8 * BT, BT, xiao, flute_bus, pan=-0.15, vel=0.3, bright=0.3)
place(pad_bus, pad(['D3', 'A3', 'E4'], 12.0, 0.25, 1300, 2.0, 2.0), VB)
# sunshower: a sparkle of harmonics
for i in range(10):
    place(zheng_bus, zheng(['D6', 'E6', 'F#6', 'A6', 'B6'][i % 5], 1.5, 0.25, harm=True), 18.4 + i * 0.37 + rng.uniform(0, 0.1), rng.uniform(-0.8, 0.8))
# 24–30: the names — one note each, rising
accomp(24.6, 2, BT * 1.05, vel=0.3, bright=0.8, start=2)
for e, n in zip(evs('morph'), ['D5', 'E5', 'F#5', 'A5', 'B5']):
    place(zheng_bus, zheng(n, 1.4, 0.75, slide=1.5, vib=0.25), e['t'] + 0.12, 0.25)
    place(zheng_bus, zheng(n[:-1] + str(int(n[-1]) - 1), 1.4, 0.35), e['t'] + 0.12, -0.2)

# ---------------------------------------------------------------- 30–37.6: the copybook
CB = 30.9
pat = ['D4', 'A4', 'F#4', 'A4', 'D4', 'A4', 'E4', 'A4']
for i in range(26):
    tt = CB + i * 0.25
    if tt > 37.3: break
    place(piano_bus, piano(pat[i % 8], 0.3, 0.32 + 0.05 * (i % 2 == 0), 0.8), tt, 0.25)
for tt, n in [(CB, 'D3'), (CB + 2, 'B2'), (CB + 4, 'G2'), (CB + 6, 'A2')]:
    place(piano_bus, piano(n, 2.0, 0.42, 0.7), tt, -0.25)
melody([('A4', 1), ('B4', 0.5), ('D5', 0.5), ('E5', 1), ('D5', 1), ('B4', 1), ('A4', 1)], CB + 2.0, 0.5, piano, piano_bus, pan=0.1, vel=0.4)

# ---------------------------------------------------------------- 37.6–43: day one
D1 = 37.6
for tt, n, ch in [(D1, 'D3', ['A3', 'D4', 'F#4']), (D1 + 2.2, 'B2', ['F#3', 'B3', 'D4']), (D1 + 4.4, 'G2', ['D3', 'G3', 'B3'])]:
    place(piano_bus, piano(n, 2.4, 0.42), tt, -0.25)
    for j, c in enumerate(ch):
        place(piano_bus, piano(c, 2.0, 0.28), tt + 0.12 + j * 0.13, -0.05)
# when he looks up at the sun, the question again — and for once it lifts
t = 38.8
for n, b in QUESTION:
    place(flute_bus, xiao(n, b * 0.5 * 0.98, 0.5, vib=0.2, bright=0.45), t, 0.1)
    t += b * 0.5
place(flute_bus, xiao('F#5', 1.4, 0.45, slide=1.0, vib=0.25, bright=0.45), t, 0.1)
place(pad_bus, pad(['D4', 'F#4', 'A4'], 5.5, 0.28, 1700, 1.2, 1.8), D1 + 0.4)

# ---------------------------------------------------------------- 43–54: day after day
days = [e for e in evs('day') if e['n'] >= 2]
for k, e in enumerate(days):
    t0 = e['t']
    nxt = days[k + 1]['t'] if k + 1 < len(days) else t0 + 0.08
    L = nxt - t0
    q = float(np.clip((L - 0.1) / 1.6, 0, 1))    # fidelity: how much of the morning is left
    step = min(0.22, L / 5.5)
    if L < 0.11:
        place(motif_bus, hp(noise(0.012), 3000) * np.exp(-tvec(0.012) / 0.003) * 0.05, t0, 0.3)
        continue
    det = (1 - q) * -0.25   # the tape runs slow
    for i, (n, b) in enumerate(QUESTION):
        tt = t0 + i * step
        m = nm(n) + det
        if q > 0.55:
            place(motif_bus, zheng(m, step * 2, 0.55, bright=q), tt, 0.15)
        if 0.2 < q < 0.85:
            place(motif_bus, epiano(n, step * 2, 0.6 * (1 - abs(q - 0.5) * 1.6)), tt, 0.15)
        if q < 0.45:
            place(motif_bus, beep(n, step * 0.9, 0.7 * (1 - q * 1.5), bits=int(3 + q * 8), hold=int(8 - q * 8)), tt, 0.15)
    # and a bass that stops bothering
    if q > 0.3:
        place(piano_bus, piano('D2', L, 0.3 * q, 0.6), t0, -0.3)
# the clock: ticks quicken with the days, then stiffen into a metronome
tick_t = 43.0
while tick_t < 61.0:
    rate = np.interp(tick_t, [43, 48, 52, 54.5, 61], [1.6, 3.0, 7.0, 10.0, 12.0])
    x = hp(noise(0.015), 2500) * np.exp(-tvec(0.015) / 0.003)
    g = np.interp(tick_t, [43, 50, 56, 60.6, 61], [0.03, 0.05, 0.04, 0.025, 0.0])
    place(sfx, x * g, tick_t, 0.35 if int(tick_t * rate) % 2 else -0.35)
    tick_t += 1 / rate
# the world becoming its names: brush swishes 46–51, then type 50.6–54
def swish(d=0.16, f1=900, f2=5000, a=0.05):
    t = tvec(d); x = bp(noise(d), f1, f2) * np.sin(np.pi * t / d) ** 1.5
    return x * a
for i in range(40):
    place(brush_bus, swish(rng.uniform(0.1, 0.22), 700, 4500, 0.035), rng.uniform(46.2, 51.2), rng.uniform(-0.8, 0.8))
for i in range(60):
    tt = rng.uniform(50.6, 54.4)
    x = bp(noise(0.02), 1500, 7000) * np.exp(-tvec(0.02) / 0.004) * 0.06 + np.sin(2 * np.pi * 180 * tvec(0.02)) * np.exp(-tvec(0.02) / 0.006) * 0.03
    place(sfx, x, tt, rng.uniform(-0.7, 0.7))
# 54–61: the grid; a rain of type thickening, a drone underneath
for i in range(420):
    u = rng.random() ** 0.6
    tt = 54.4 + u * 5.2
    x = bp(noise(0.012), 2500, 9000) * np.exp(-tvec(0.012) / 0.0025) * 0.03
    place(sfx, x, tt, rng.uniform(-0.9, 0.9))
place(pad_bus, pad(['D2', 'A2'], 8.0, 0.25, 420, 2.5, 1.5), 53.5)
place(motif_bus, beep('E5', 0.5, 0.35, bits=3, hold=10), 58.8, 0.0)

# ---------------------------------------------------------------- 61–72.4: the grey room
# the fall into the window
place(sfx, lp(hp(noise(1.8), 600), 6000) * np.sin(np.pi * tvec(1.8) / 1.8) ** 2 * 0.05, 59.3, 0.0)
for k in range(12):
    tt = 61.2 + k * 1.0
    if tt > 72.3: break
    x = hp(noise(0.02), 2000) * np.exp(-tvec(0.02) / 0.004) * (0.05 if k % 2 == 0 else 0.035)
    x += np.sin(2 * np.pi * (1800 if k % 2 == 0 else 1500) * tvec(0.02)) * np.exp(-tvec(0.02) / 0.004) * 0.02
    place(sfx, x, tt, 0.5)
# his pen
for i in range(16):
    tt = 61.5 + i * 0.13 + rng.uniform(0, 0.05)
    if tt > 63.5: break
    place(sfx, bp(noise(0.08), 3000, 9000) * np.sin(np.pi * tvec(0.08) / 0.08) * 0.018, tt, -0.1)
# her feet, the hop up onto the desk
for i in range(5):
    place(sfx, lp(noise(0.05), 600) * np.exp(-tvec(0.05) / 0.012) * 0.06, 63.1 + i * 0.22, 0.5 - i * 0.08)
hop = [e['t'] for e in evs('hop')]
if hop:
    place(sfx, lp(noise(0.12), 300) * np.exp(-tvec(0.12) / 0.03) * 0.14 + np.sin(2 * np.pi * 90 * tvec(0.12)) * np.exp(-tvec(0.12) / 0.04) * 0.08, hop[0] + 0.55, 0.3)
# the crayon on the glass: waxy stick-slip squeaks
def squeak(d):
    t = tvec(d)
    f = 1100 + 500 * lp(rng.standard_normal(len(t)), 6) * 30
    ph = 2 * np.pi * np.cumsum(np.clip(f, 500, 2600)) / SR
    stick = np.clip(lp(rng.standard_normal(len(t)), 40) * 60, 0, 1)
    x = (np.sin(ph) * 0.6 + 0.4 * signal.sawtooth(ph * 0.5)) * stick + bp(rng.standard_normal(len(t)), 2000, 8000) * 0.35
    return x * env_ar(len(t), 0.01, 0.04) * 0.035
for e in evs('crayon'):
    place(sfx, squeak(max(0.05, e['dur'])), e['t'], 0.25)
# when the sun is drawn, one harmonic, like a held breath
place(zheng_bus, zheng('A5', 2.5, 0.45, harm=True), 67.75, 0.3)
# 「红」: one dead note
red = [e['t'] for e in evs('red')]
if red:
    x = piano('E3', 0.4, 0.35, 0.3, detune=-0.012)
    place(piano_bus, lp(x, 700) * 1.4, red[0] + 0.05, -0.1)
# he looks: a breath drawn in
place(sfx, lp(hp(noise(1.4), 1200), 8000) * (tvec(1.4) / 1.4) ** 3.5 * 0.09, 71.0, 0.0)
place(pad_bus, pad(['A3', 'D4', 'E4'], 2.2, 0.22, 900, 1.6, 0.6), 70.6)

# ---------------------------------------------------------------- 72.4–77: the sun opens, colour returns
OP = [e['t'] for e in evs('open')] or [72.4]
WV = [e['t'] for e in evs('wave')] or [73.1]
scale = ['D3', 'E3', 'F#3', 'A3', 'B3', 'D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'E6', 'F#6', 'A6']
gliss(scale, OP[0] + 0.25, step=0.032, vel=0.55)
gliss(scale[5:], OP[0] + 0.95, step=0.026, vel=0.4, pan0=0.6, pan1=-0.5)
W = WV[0]
# the question answers itself: A B D E — D
t = W + 0.15
for n, b in QUESTION:
    place(flute_bus, xiao(n[:-1] + str(int(n[-1]) + 1) if n != 'A4' else 'A5', b * 0.62, 0.62, vib=0.22, bright=0.6), t, -0.05)
    place(zheng_bus, zheng(n[:-1] + str(int(n[-1]) + 1) if n != 'A4' else 'A5', b * 0.62 + 0.5, 0.55, vib=0.2), t, 0.2)
    t += b * 0.62
place(flute_bus, xiao('D6', 2.4, 0.66, slide=1.0, vib=0.25, bright=0.6), t, -0.05)
place(zheng_bus, zheng('D5', 3.0, 0.65, vib=0.25), t, 0.2)
place(piano_bus, piano('D2', 4.0, 0.55), W, -0.3); place(piano_bus, piano('D3', 4.0, 0.45), W, -0.3)
for j, c in enumerate(['A3', 'D4', 'F#4', 'A4', 'E5']):
    place(piano_bus, piano(c, 3.5, 0.34), W + 0.05 + j * 0.06, 0.0)
place(pad_bus, pad(['D3', 'A3', 'D4', 'F#4', 'A4', 'E5'], 6.0, 0.55, 2400, 0.25, 2.5), W)
# reverse swell into the bloom, and a low thump
place(sfx, lp(hp(noise(1.4), 2500), 10000) * (tvec(1.4) / 1.4) ** 3 * 0.08, OP[0] - 1.15, 0.0)
place(sfx, np.sin(2 * np.pi * (52 - 12 * tvec(2.0)) * tvec(2.0)) * np.exp(-tvec(2.0) / 0.6) * 0.32, W, 0.0)
# a shimmer as the wave passes over things
for i in range(28):
    tt = W + 0.1 + (i / 28) ** 1.4 * 3.2 + rng.uniform(0, 0.08)
    place(zheng_bus, zheng(['D6', 'E6', 'F#6', 'A6', 'B6', 'D7'][rng.integers(6)], 1.2, 0.3 * (1 - i / 36), harm=True), tt, rng.uniform(-0.9, 0.9))

# ---------------------------------------------------------------- 77–90: his eye; the street; day one again
EY = [e['t'] for e in evs('eye')] or [76.6]
place(pad_bus, pad(['D3', 'A3', 'F#4', 'B4'], 4.6, 0.35, 1500, 0.8, 1.8), EY[0])
place(zheng_bus, zheng('F#5', 2.0, 0.35, harm=True), EY[0] + 0.6, 0.3)
place(zheng_bus, zheng('A4', 3.0, 0.4, vib=0.2), EY[0] + 1.8, -0.2)
place(zheng_bus, zheng('E5', 2.0, 0.36, vib=0.2, slide=1.0), EY[0] + 3.0, 0.1)
place(sfx, lp(hp(noise(1.8), 1500), 9000) * (tvec(1.8) / 1.8) ** 3 * 0.05, 79.2, 0.0)
SB = 81.0
FB = 60 / 72
accomp(SB, 2, FB, vel=0.4)
accomp(SB + 8 * FB, 1, FB, vel=0.36, start=2)
melody(THEME[:9], SB + 0.0, FB, zheng, zheng_bus, pan=0.2, vel=0.6, slide=1.2)
melody([(n[:-1] + str(int(n[-1]) + 1) if n else None, b) for n, b in THEME[9:]], SB + 8 * FB, FB, xiao, flute_bus, pan=-0.1, vel=0.5, bright=0.6)
melody(THEME[9:], SB + 8 * FB, FB, zheng, zheng_bus, pan=0.25, vel=0.42)
place(pad_bus, pad(['D3', 'A3', 'D4', 'F#4'], 9.0, 0.32, 2000, 2.0, 2.5), SB)
for i, (tt, n) in enumerate([(SB + 0.0, 'D2'), (SB + 4 * FB, 'B1'), (SB + 8 * FB, 'G1'), (SB + 12 * FB, 'A1')]):
    place(piano_bus, piano(n, 4 * FB, 0.4, 0.8), tt, -0.3)
# the counter rolls back to 1: a few clicks and a bell
CT = [e['t'] for e in evs('count')] or [85.6]
for i in range(6):
    place(sfx, hp(noise(0.01), 3000) * np.exp(-tvec(0.01) / 0.002) * 0.04, CT[0] + i * 0.11, 0.6)
place(zheng_bus, zheng('D6', 2.5, 0.5, harm=True), CT[0] + 0.75, 0.5)
# the end: the question resolved, a last chord with an open sixth
FIN = 89.6
for n, v in [('D2', 0.5), ('A2', 0.36), ('D3', 0.32), ('F#3', 0.28), ('B3', 0.24), ('E4', 0.22)]:
    place(piano_bus, piano(n, 5.0, v), FIN, -0.1)
place(zheng_bus, zheng('D5', 4.5, 0.55, vib=0.2), FIN + 0.05, 0.2)
place(zheng_bus, zheng('A5', 4.0, 0.4, harm=True), FIN + 1.2, -0.3)
place(pad_bus, pad(['D3', 'A3', 'D4', 'F#4', 'B4'], 4.5, 0.4, 1600, 0.5, 2.5), FIN)
SE = [e['t'] for e in evs('seal')] or [91.5]
place(sfx, lp(noise(0.1), 500) * np.exp(-tvec(0.1) / 0.015) * 0.2 + np.sin(2 * np.pi * 120 * tvec(0.1)) * np.exp(-tvec(0.1) / 0.025) * 0.12, SE[0], 0.15)

# ------------------------------------------------------------------ brush & picture-locked sfx
def brush_stroke(d=0.3, a=0.05):
    t = tvec(d)
    x = bp(noise(d), 600, 3800) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.2
    x += bp(noise(d), 3000, 9000) * np.exp(-t / 0.05) * 0.4
    return x * a
for e in evs('brush'):
    place(brush_bus, brush_stroke(0.34, 0.06), e['t'], 0.1 - e['col'] * 0.15)
# the drop
for e in evs('drop'):
    t = tvec(0.25)
    x = np.sin(2 * np.pi * (500 + 1400 * (1 - np.exp(-t / 0.02))) * t) * np.exp(-t / 0.05) * 0.12
    x[:200] += rng.standard_normal(200) * np.linspace(0.08, 0, 200)
    place(sfx, x, e['t'], 0.0)
    place(sfx, lp(noise(1.6), 900) * np.exp(-tvec(1.6) / 0.6) * 0.03, e['t'], 0.0)
for e in evs('blink'):
    place(sfx, bp(noise(0.25), 400, 2500) * np.sin(np.pi * tvec(0.25) / 0.25) ** 2 * 0.03, e['t'], 0.0)
for e in evs('morph'):
    place(brush_bus, brush_stroke(0.6, 0.05), e['t'] + 0.2, 0.2)
for e in evs('copy'):
    place(brush_bus, brush_stroke(0.12, 0.035), e['t'], rng.uniform(-0.4, 0.4))
for e in evs('write'):
    place(brush_bus, brush_stroke(0.35, 0.06), e['t'], 0.0)
    place(brush_bus, brush_stroke(0.35, 0.06), e['t'] + 0.35, 0.05)
# red circles: a quick pen squeak each
for i in range(8):
    place(brush_bus, bp(noise(0.2), 2500, 7000) * np.sin(np.pi * tvec(0.2) / 0.2) * 0.02, 34.7 + i * 0.07, rng.uniform(-0.4, 0.4))
for e in evs('door'):
    t = tvec(0.9)
    creak = signal.sawtooth(2 * np.pi * np.cumsum(180 + 60 * np.sin(2 * np.pi * 3 * t)) / SR) * np.clip(lp(rng.standard_normal(len(t)), 20) * 40, 0, 1)
    place(sfx, bp(creak, 400, 2500) * np.sin(np.pi * t / 0.9) * 0.02, e['t'], -0.1)
    place(sfx, lp(noise(0.05), 2000) * np.exp(-tvec(0.05) / 0.01) * 0.08, e['t'] - 0.05, -0.1)
# Day 1: the door, his steps
place(sfx, lp(noise(0.05), 2000) * np.exp(-tvec(0.05) / 0.01) * 0.07, 37.8, 0.0)
for i in range(16):
    tt = 38.0 + i * 0.36
    if 38.9 < tt < 40.6: continue
    place(sfx, (bp(noise(0.06), 800, 4000) * np.exp(-tvec(0.06) / 0.012)) * 0.05, tt, 0.1 + i * 0.03)

# ------------------------------------------------------------------ ambience
def bed(gen, keys, lowcut=None, highcut=None, gain=1.0):
    g = curve(keys)
    for ch in range(2):
        x = gen(DUR)
        if lowcut: x = hp(x, lowcut)
        if highcut: x = lp(x, highcut)
        x = x / (np.abs(x).max() + 1e-9)
        amb[ch] += x[:N] * g * gain
# paper/room tone
bed(lambda d: brown(d), [(0, 0.02), (7, 0.02), (12, 0.0), (61, 0.0), (61.5, 0.03), (72.4, 0.03), (74, 0.0), (89.8, 0), (90.5, 0.015), (95, 0.0)], lowcut=40, highcut=300)
# valley wind
def wind(d):
    x = lp(pink(d), 900)
    m = 0.6 + 0.4 * lp(rng.standard_normal(int(d * SR)), 0.4) * 40
    return x * np.clip(m, 0.2, 1.4)
bed(wind, [(0, 0), (11.5, 0), (13.5, 0.05), (29, 0.05), (31, 0.0), (95, 0)], lowcut=150)
# summer insects
tt = np.arange(N) / SR
cg = curve([(0, 0), (13, 0), (15, 0.025), (18, 0.025), (19.5, 0.01), (28, 0.01), (30, 0), (95, 0)])
cic = bp(rng.standard_normal(N), 4200, 7600) * (0.5 + 0.5 * np.sin(2 * np.pi * 34 * tt)) ** 4 * cg
amb[0] += cic; amb[1] += np.roll(cic, 900) * 0.8
# the sunshower
rg = curve([(0, 0), (18.0, 0), (19.5, 0.06), (28.6, 0.06), (29.9, 0.0), (95, 0)])
rn = lp(hp(pink(DUR), 900), 9000)
rn = rn / np.abs(rn).max() * rg
amb[0] += rn; amb[1] += np.roll(rn, 411)
for k in range(140):
    t0 = rng.uniform(18.6, 29.6)
    f = rng.uniform(1600, 3800)
    x = np.sin(2 * np.pi * f * tvec(0.04) * (1 + 3 * tvec(0.04))) * np.exp(-tvec(0.04) / 0.007) * 0.05
    place(amb, x, t0, rng.uniform(-0.9, 0.9))
# birdsong
def chirp(f0, f1, d, a):
    t = tvec(d); f = np.linspace(f0, f1, len(t))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 2 * a
def birds(t0, t1, n, a=0.035):
    for k in range(n):
        s = rng.uniform(t0, t1)
        f0 = rng.uniform(2600, 4600)
        for j in range(rng.integers(2, 6)):
            place(amb, chirp(f0, f0 * rng.uniform(1.15, 1.6), rng.uniform(0.04, 0.09), a), s + j * rng.uniform(0.06, 0.12), rng.uniform(-0.8, 0.8))
birds(12.8, 24, 26)
birds(37.4, 43.5, 10, 0.025)
birds(73.8, 76.4, 8, 0.03)
birds(81.0, 89.6, 26, 0.035)
# swallows: quick twitters
for t0 in [13.2, 14.0, 84.4, 85.0]:
    for j in range(5):
        place(amb, chirp(5200, 6400, 0.03, 0.025), t0 + j * 0.07, rng.uniform(-0.6, 0.6))
# the city: hum and traffic, swelling with the days, then smothered
bed(lambda d: brown(d), [(0, 0), (35.5, 0), (37.6, 0.05), (43, 0.06), (50, 0.09), (54, 0.04), (58, 0.0), (61, 0.0), (61.5, 0.012), (72.4, 0.012), (74, 0.03), (76.6, 0.0), (81, 0.04), (89.6, 0.04), (90.4, 0.0), (95, 0)], lowcut=45, highcut=500)
def car_pass(d):
    x = bp(brown(d) + 0.3 * rng.standard_normal(int(d * SR)) * 0.02, 110, 1600)
    return x / (np.abs(x).max() + 1e-9) * np.sin(np.pi * tvec(d) / d) ** 2
for k in range(34):
    t0 = rng.uniform(37.6, 54) if k < 26 else rng.uniform(81, 89)
    d = float(np.interp(t0, [37, 43, 52, 81, 90], [2.4, 2.2, 0.7, 2.4, 2.4]))
    g = 0.05 if t0 > 80 else float(np.interp(t0, [37, 48, 54], [0.05, 0.07, 0.03]))
    x = car_pass(d) * g
    sgn = 1 if rng.random() > 0.5 else -1
    for i in range(6):
        seg = slice(int(i * len(x) / 6), int((i + 1) * len(x) / 6))
        place(amb, x[seg], t0 + i * d / 6, sgn * (-0.9 + i * 0.36))

# ------------------------------------------------------------------ mix
def reverb_ir(d, decay, seed, bright=6000):
    r = np.random.default_rng(seed); t = tvec(d)
    ir = r.standard_normal(len(t)) * np.exp(-t * 6.9 / decay)
    ir = lp(ir, bright)
    ir[:int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))
    return ir / np.sqrt(np.sum(ir ** 2))
def verb(bus, decay, seed=1, bright=6000):
    out = np.zeros_like(bus)
    for ch in range(2):
        out[ch] = signal.fftconvolve(bus[ch], reverb_ir(decay * 1.1, decay, seed + ch, bright))[:N]
    return out

# the motif wears out: low-passed harder the more days pass
mot = motif_bus
tone = curve([(0, 9000), (45, 9000), (50, 3500), (54, 1800), (61, 1800)])
bands = [1800, 3500, 9000]
filt = [np.stack([lp(mot[c], fc) for c in range(2)]) for fc in bands]
idx = np.interp(tone, bands, np.arange(len(bands)))
mot2 = np.zeros_like(mot)
for i in range(len(bands)):
    mot2 += filt[i] * np.clip(1 - np.abs(idx - i), 0, 1)

music = zheng_bus * 1.35 + flute_bus * 1.2 + piano_bus * 0.68 + pad_bus * 1.0 + mot2 * 0.9
# music gets drier and smaller as the world flattens, and opens wide when it returns
wet_c = curve([(0, 0.32), (42, 0.32), (50, 0.18), (61, 0.12), (72.4, 0.12), (73.2, 0.38), (95, 0.42)])
music_wet = verb(music, 3.4, 11, 7000)
music_out = music * (1 - wet_c * 0.4) + music_wet * wet_c
mix = music_out * 1.35 + verb(amb, 1.2, 21) * 0.25 + amb * 0.85 + sfx * 1.0 + verb(sfx, 0.9, 31) * 0.25 + brush_bus + verb(brush_bus, 0.7, 41) * 0.2
# a whole-world low-pass while the world is print: everything sounds far away
dull = curve([(0, 16000), (49, 16000), (54, 3200), (61, 3200), (61.2, 9000), (72.4, 9000), (73.1, 16000), (95, 16000)])
bands = [3200, 9000, 16000]
filt = [np.stack([lp(mix[c], fc) for c in range(2)]) for fc in bands]
idx = np.interp(dull, bands, np.arange(len(bands)))
mix2 = np.zeros_like(mix)
for i in range(len(bands)):
    mix2 += filt[i] * np.clip(1 - np.abs(idx - i), 0, 1)
mix = np.stack([hp(mix2[c], 28) for c in range(2)])
fade = curve([(0, 0), (0.3, 1), (93.6, 1), (95, 0)])
mix *= fade
peak = np.abs(mix).max()
mix = mix / peak * 0.97
mix = np.tanh(mix * 1.3) / np.tanh(1.3)
mix *= 10 ** (-1.0 / 20)

out = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'build' / 'fs_score.wav'
out.parent.mkdir(parents=True, exist_ok=True)
pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
with wave.open(str(out), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
rms = np.sqrt(np.mean(mix ** 2))
print(f'{len(EV)} events · rms {20 * np.log10(rms):.1f} dBFS · → {out}')
