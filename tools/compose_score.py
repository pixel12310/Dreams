#!/usr/bin/env python3
"""
Score and sound design for 褪色 · FADING — synthesised from scratch with numpy.

    python3 tools/compose_score.py [build/events.json] [out.wav]

Everything is picture-locked: section boundaries match the film's timeline, and the
footsteps come from the walk-cycle contacts exported by `node tools/render.mjs events`.

Musical arc (D major → B minor → D major):
  0–5     title: a rising four-note question on piano
  5–10.5  childhood: music box "kite theme" over piano arpeggios, D–A–Bm–G
  10.55   the string snaps; the music falls silent, only wind and a broken echo of the theme
  14.6–24 leaving home: slow piano, descending bass G–F#–E–D; warmth filters away with the yellow
  24.6–33 the city: a mechanical B-minor ostinato that thins out as the green leaves
  33–41   rain: sparse low notes, detuned, swallowed by reverb
  41–47   time-lapse: a heartbeat and a rushing noise; two unresolved notes for the question
  47–51   time stops; the kite theme returns one note at a time, a reverse swell
  51.35   colour comes back: full D-major bloom, the theme in full, bells, birds
"""
import json, sys, pathlib
import numpy as np
from scipy import signal

SR = 48000
DUR = 60.0
N = int(SR * DUR)
ROOT = pathlib.Path(__file__).resolve().parent.parent
rng = np.random.default_rng(7)

def stereo():
    return np.zeros((2, N))

music, box_bus, pad_bus, amb, sfx, steps = (stereo() for _ in range(6))

def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)

NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
def nm(s):
    """'F#5' -> midi number"""
    name, octv = (s[:-1], int(s[-1]))
    return 12 * (octv + 1) + NOTE[name]

def place(bus, x, t0, pan=0.0, gain=1.0):
    """Add mono signal x at time t0 (s) with constant-power pan (-1..1)."""
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    if i0 < 0:
        x = x[-i0:]; i0 = 0
    n = min(len(x), N - i0)
    l = np.cos((pan + 1) * np.pi / 4) * gain
    r = np.sin((pan + 1) * np.pi / 4) * gain
    bus[0, i0:i0 + n] += x[:n] * l
    bus[1, i0:i0 + n] += x[:n] * r

def tvec(d):
    return np.arange(int(d * SR)) / SR

def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc / (SR / 2), 0.99), 'low')
    return signal.lfilter(b, a, x)

def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'high')
    return signal.lfilter(b, a, x)

def bp(x, f1, f2, order=2):
    b, a = signal.butter(order, [f1 / (SR / 2), min(f2 / (SR / 2), 0.99)], 'band')
    return signal.lfilter(b, a, x)

def noise(d):
    return rng.standard_normal(int(d * SR))

def pink(d):
    n = int(d * SR)
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.arange(len(X)); f[0] = 1
    return np.fft.irfft(X / np.sqrt(f), n) * 30

def brown(d):
    x = np.cumsum(rng.standard_normal(int(d * SR)))
    x = hp(x, 20)
    return x / (np.abs(x).max() + 1e-9)

def env_ar(n, a, r):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na > 0: e[:na] = np.linspace(0, 1, na) ** 1.5
    if nr > 0: e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e

def curve(keys):
    """piecewise-linear automation over the whole timeline -> array of length N"""
    ts = np.array([k[0] for k in keys]); vs = np.array([k[1] for k in keys])
    return np.interp(np.arange(N) / SR, ts, vs)

# ------------------------------------------------------------------ instruments
def piano(m, dur, vel=0.7, bright=1.0, detune=0.0):
    f = midi(m) * (1 + detune)
    d = dur + 2.5
    t = tvec(d)
    out = np.zeros_like(t)
    B = 0.00012 * (f / 261.6)
    nh = int(min(16, 9000 / f))
    for n in range(1, nh + 1):
        fn = n * f * np.sqrt(1 + B * n * n)
        amp = vel ** (1 + 0.22 * n / bright) / n ** 1.15
        d1 = 2.2 + 0.9 * n + f / 300
        d2 = 0.22 + 0.07 * n + f / 1800
        e = 0.55 * np.exp(-d1 * t) + 0.45 * np.exp(-d2 * t)
        ph = rng.uniform(0, 2 * np.pi)
        beat = 1 + rng.uniform(-0.0009, 0.0009)
        out += amp * e * (np.sin(2 * np.pi * fn * t + ph) + 0.6 * np.sin(2 * np.pi * fn * beat * t + ph * 1.3))
    out *= 1 - np.exp(-t / 0.002)
    # hammer
    hn = int(0.012 * SR)
    out[:hn] += bp(rng.standard_normal(hn), min(f * 2, 4000), min(f * 8, 12000)) * np.linspace(1, 0, hn) * 0.08 * vel
    # damper release
    rel = np.ones_like(t); i = int(dur * SR); rn = int(0.35 * SR)
    rel[i:i + rn] = np.linspace(1, 0, len(rel[i:i + rn])) ** 2; rel[i + rn:] = 0
    out = lp(out * rel, 2200 + 4500 * vel * bright)
    return out * 0.22

def musicbox(m, vel=0.6):
    f = midi(m)
    t = tvec(3.0)
    x = (np.sin(2 * np.pi * f * t) * np.exp(-2.2 * t)
         + 0.35 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-4.5 * t)
         + 0.16 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-10 * t)
         + 0.06 * np.sin(2 * np.pi * f * 8.9 * t) * np.exp(-18 * t))
    x *= 1 - np.exp(-t / 0.0015)
    return x * vel * 0.16

def bell(m, vel=0.5):
    f = midi(m)
    t = tvec(4.0)
    ratios = [(1, 1, 1.2), (2.01, 0.5, 2.0), (2.76, 0.35, 2.8), (5.4, 0.18, 6), (8.93, 0.08, 9)]
    x = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-d * t) for r, a, d in ratios)
    x *= 1 - np.exp(-t / 0.001)
    return x * vel * 0.08

def pad(ms, dur, vel=0.5, cutoff=1400, attack=1.2, release=1.8, bright=0.0):
    d = dur + release
    t = tvec(d)
    out = np.zeros_like(t)
    for m in ms:
        f = midi(m)
        for k in range(4):
            det = 1 + (k - 1.5) * 0.0032
            vib = 1 + 0.0025 * np.sin(2 * np.pi * (4.8 + k * 0.3) * t + k)
            ph = 2 * np.pi * np.cumsum(f * det * vib) / SR
            nh = int(min(12, 6000 / f))
            for n in range(1, nh + 1):
                out += np.sin(n * ph + k) / n * (0.7 if n > 1 else 1.0)
    out = lp(out, cutoff + bright * 2500, 2)
    e = env_ar(len(t), attack, release)
    return out * e * vel * 0.02 / max(1, len(ms) ** 0.5)

# ------------------------------------------------------------------ the score
def P(note, t0, dur=1.0, vel=0.6, pan=0.0, bright=1.0, det=0.0, bus=None):
    place(bus if bus is not None else music, piano(nm(note), dur, vel, bright, det), t0, pan)

def box(note, t0, vel=0.6, pan=0.2):
    place(box_bus, musicbox(nm(note), vel), t0, pan)

def chord_arp(notes, t0, step, count, vel=0.42, pan=-0.15, bright=1.0):
    for i in range(count):
        P(notes[i % len(notes)], t0 + i * step, step * 1.6, vel * (0.9 + 0.2 * rng.random()), pan, bright)

# --- 0–5  title: a question
for note, t0, v in [('A4', 0.55, 0.42), ('D5', 1.15, 0.45), ('E5', 1.75, 0.48), ('F#5', 2.35, 0.5), ('E5', 3.25, 0.38)]:
    P(note, t0, 1.6, v, 0.1)
P('D3', 0.55, 4.0, 0.32, -0.2); P('A3', 2.35, 2.5, 0.25, -0.2)
place(pad_bus, pad([nm('D3'), nm('A3'), nm('F#4')], 4.6, 0.35, 900, 2.0, 1.5), 0.6)

# --- 5–10.55  childhood
beat = 0.625
cb = 5.0
prog = [(['D3', 'A3', 'D4', 'F#4'], 'D2'), (['A2', 'E3', 'A3', 'C#4'], 'A1'), (['B2', 'F#3', 'B3', 'D4'], 'B1'), (['G2', 'D3', 'G3', 'B3'], 'G1')]
for i, (arp, bass) in enumerate(prog):
    t0 = cb + i * 4 * beat
    P(bass, t0, 4 * beat, 0.45, -0.3)
    chord_arp(arp + arp[::-1][1:3], t0, beat / 2, 8, 0.36, -0.2)
P('D2', cb + 16 * beat, 0.5, 0.4, -0.3); chord_arp(['D3', 'A3', 'D4'], cb + 16 * beat, beat / 2, 1, 0.34)
theme = [('F#5', 1), ('A5', .5), ('D6', .5), ('C#6', 1), ('A5', 1),
         ('E5', 1), ('A5', .5), ('C#6', .5), ('B5', 1), ('A5', 1),
         ('D5', 1), ('F#5', .5), ('B5', .5), ('A5', 1), ('F#5', 1),
         ('G5', 1), ('B5', .5), ('D6', .5), ('E6', 1.5)]
tt = cb
for note, b in theme:
    box(note, tt, 0.7)
    tt += b * beat
place(pad_bus, pad([nm('D4'), nm('F#4'), nm('A4')], 5.5, 0.22, 1800, 1.5, 0.6), 5.0)

# --- 10.55  the snap; a broken echo of the theme
for note, t0, v in [('F#5', 11.4, 0.5), ('A5', 12.3, 0.4), ('D6', 13.4, 0.22)]:
    place(box_bus, lp(musicbox(nm(note), v), 3000), t0, 0.35)
P('D3', 11.0, 3.5, 0.22, -0.2, 0.6)
place(pad_bus, pad([nm('D3'), nm('A3')], 3.6, 0.25, 700, 1.0, 1.6), 11.0)

# --- 14.6–24.6  leaving home (72 bpm, descending bass)
b2 = 60 / 72
h0 = 14.6
home = [('G2', ['D3', 'G3', 'B3'], [('D5', 1), ('B4', 1)]),
        ('F#2', ['D3', 'F#3', 'A3'], [('A4', 1.5), ('F#4', 0.5)]),
        ('E2', ['B2', 'E3', 'G3'], [('G4', 1), ('B4', 1)]),
        ('D2', ['A2', 'D3', 'F#3'], [('A4', 2)]),
        ('B1', ['F#2', 'B2', 'D3'], [('F#4', 1), ('D4', 0.5), ('E4', 0.5)]),
        ('G1', ['D2', 'G2', 'B2'], [('D4', 2)])]
warm = curve([(0, 1), (20.2, 1), (23.4, 0.35), (60, 0.35)])
for i, (bass, ch, mel) in enumerate(home):
    t0 = h0 + i * 2 * b2
    br = float(warm[int(t0 * SR)])
    P(bass, t0, 2 * b2, 0.4, -0.25, br)
    for j, n in enumerate(ch):
        P(n, t0 + 0.06 * j + b2 * 0.5, 1.5 * b2, 0.24, -0.1, br)
    tt = t0
    for n, bb in mel:
        P(n, tt, bb * b2 * 1.1, 0.42, 0.15, br)
        tt += bb * b2
place(pad_bus, pad([nm('G3'), nm('B3'), nm('D4')], 9.0, 0.16, 1100, 2.5, 2.0), 14.8)

# --- 24.6–33  the city: mechanical ostinato in B minor (112 bpm)
b3 = 60 / 112
c0 = 24.6
city = [('B1', ['B3', 'F#4', 'D4', 'F#4']), ('G1', ['B3', 'G4', 'D4', 'G4']), ('D2', ['A3', 'F#4', 'D4', 'F#4']), ('A1', ['A3', 'E4', 'C#4', 'E4'])]
for i, (bass, pat) in enumerate(city):
    t0 = c0 + i * 4 * b3
    P(bass, t0, 4 * b3, 0.36, -0.25, 0.6)
    for k in range(8):
        tk = t0 + k * b3 / 2
        # the ostinato loses notes as the green drains away
        thin = np.interp(tk, [28.2, 32.4], [0.0, 0.7])
        if rng.random() < thin:
            continue
        P(pat[k % 4], tk, b3 * 0.45, 0.26 + 0.05 * (k % 2 == 0), 0.2, 0.55)
# clock-like tick
for k in range(int((33.0 - 24.6) / b3)):
    tk = 24.6 + k * b3
    x = hp(noise(0.02), 6000) * np.exp(-tvec(0.02) / 0.004) * 0.05
    place(sfx, x, tk, 0.5)

# --- 33–41  rain: low, sparse, detuned
for note, t0, v, det in [('B2', 33.4, 0.38, 0.0), ('F#3', 35.2, 0.3, -0.004), ('D3', 37.0, 0.28, -0.006), ('B2', 38.8, 0.26, -0.009)]:
    P(note, t0, 2.5, v, -0.1, 0.5, det)
place(pad_bus, pad([nm('B2'), nm('F#3')], 8.0, 0.2, 500, 2.5, 2.5), 33.2)

# --- 41–47  the question
P('A4', 41.05, 2.0, 0.34, 0.1, 0.7); P('F#4', 41.05, 2.0, 0.18, 0.1, 0.7)
P('G4', 43.45, 2.4, 0.32, 0.1, 0.7); P('E4', 43.45, 2.4, 0.18, 0.1, 0.7)
for k in range(6):  # heartbeat
    for dt, a in [(0.0, 1.0), (0.24, 0.6)]:
        t = tvec(0.25)
        x = np.sin(2 * np.pi * (52 - 14 * t) * t) * np.exp(-t / 0.06) * 0.35 * a
        place(sfx, x, 41.0 + k * 0.95 + dt, 0.0)

# --- 47–51.35  the kite returns, one note at a time
for note, t0, v in [('F#5', 47.4, 0.55), ('A5', 48.35, 0.55), ('D6', 49.3, 0.6), ('C#6', 50.25, 0.6)]:
    box(note, t0, v, 0.25)
    P(note[:-1] + str(int(note[-1]) - 1), t0, 1.4, 0.2, 0.1)
place(pad_bus, pad([nm('D3'), nm('A3'), nm('E4')], 4.4, 0.24, 900, 3.5, 0.3), 47.0)

# --- 51.35  colour returns: the theme in full
BL = 51.35
b4 = 0.625
bloom = [('D2', ['D3', 'A3', 'D4', 'F#4'], [('F#5', 1), ('A5', .5), ('D6', .5)]),
         ('C#2', ['A2', 'E3', 'A3', 'C#4'], [('C#6', 1), ('A5', 1)]),
         ('B1', ['B2', 'F#3', 'B3', 'D4'], [('B5', 1), ('F#5', .5), ('B5', .5)]),
         ('G1', ['G2', 'D3', 'G3', 'B3'], [('D6', 1), ('B5', 1)]),
         ('F#2', ['A2', 'D3', 'F#3', 'A3'], [('A5', 1), ('F#5', .5), ('A5', .5)]),
         ('E2', ['G2', 'B2', 'E3', 'G3'], [('G5', 1), ('E5', .5), ('G5', .5)]),
         ('A1', ['A2', 'E3', 'G3', 'C#4'], [('E5', 1), ('C#6', 1)])]
for i, (bass, ch, mel) in enumerate(bloom):
    t0 = BL + i * 2 * b4
    P(bass, t0, 2 * b4, 0.5, -0.3)
    P(bass[:-1] + str(int(bass[-1]) + 1), t0, 2 * b4, 0.3, -0.3)
    chord_arp(ch, t0, b4 / 2, 4, 0.34, -0.15)
    tt = t0
    for n, bb in mel:
        box(n, tt, 0.75, 0.2)
        P(n, tt, bb * b4 * 1.2, 0.36, 0.2)
        tt += bb * b4
END = BL + 7 * 2 * b4  # = 60.1 -> final chord lands just before the cut
FIN = 58.9
for n, v in [('D2', 0.5), ('A2', 0.36), ('D3', 0.34), ('F#3', 0.3), ('A3', 0.28), ('D4', 0.26)]:
    P(n, FIN, 2.0, v, -0.1)
box('D6', FIN, 0.7); box('A5', FIN + 0.02, 0.45)
place(pad_bus, pad([nm('D3'), nm('A3'), nm('D4'), nm('F#4'), nm('A4')], 8.7, 0.42, 1500, 0.08, 2.0, bright=0.6), BL)
# shimmer bells across the bloom
pent = ['D6', 'E6', 'F#6', 'A6', 'B6', 'D7', 'A5', 'F#5']
for k in range(34):
    t0 = BL + 0.05 + (k / 34) ** 1.6 * 3.6 + rng.random() * 0.12
    place(box_bus, bell(nm(pent[rng.integers(len(pent))]), 0.5 * (1 - k / 40)), t0, rng.uniform(-0.8, 0.8))

# reverse swell into the bloom + sub
t = tvec(2.6)
sw = lp(hp(noise(2.6), 2500), 9000) * (t / 2.6) ** 3.2 * 0.07
place(sfx, sw, BL - 2.6, 0.0)
t = tvec(2.5)
place(sfx, np.sin(2 * np.pi * (46 - 10 * t) * t) * np.exp(-t / 0.7) * 0.5, BL, 0.0)

# ------------------------------------------------------------------ ambience
def bed(gen, keys, lowcut=None, highcut=None, pan_width=0.6):
    """stereo ambience bed shaped by a gain curve"""
    g = curve(keys)
    for ch, s in ((0, 1), (1, 2)):
        x = gen(DUR)
        if lowcut: x = hp(x, lowcut)
        if highcut: x = lp(x, highcut)
        x = x / (np.abs(x).max() + 1e-9)
        amb[ch] += x[:N] * g

# wind: meadow and dusk
def wind(d):
    x = lp(pink(d), 900)
    m = 0.6 + 0.4 * lp(rng.standard_normal(int(d * SR)), 0.4) * 40
    return x * np.clip(m, 0.2, 1.4)
bed(wind, [(0, 0), (4.5, 0), (6, 0.07), (14.5, 0.06), (18, 0.045), (24, 0.03), (30, 0.015), (33, 0.0), (52, 0.0), (55, 0.04), (60, 0.03)], lowcut=160)
# city hum
bed(lambda d: brown(d), [(0, 0), (20, 0), (25, 0.09), (33, 0.09), (40, 0.075), (47, 0.035), (51, 0.035), (54, 0.07), (60, 0.06)], lowcut=55, highcut=420)
# rain
def rain_noise(d):
    return lp(hp(pink(d), 700), 7500) + 0.25 * bp(rng.standard_normal(int(d * SR)), 2500, 7000)
rain_g = curve([(0, 0), (32.8, 0), (36, 0.09), (38.4, 0.14), (46.8, 0.14), (48.4, 0.06), (51.2, 0.05), (52, 0.09), (54.8, 0.0), (60, 0)])
rn = rain_noise(DUR)
rn = rn / np.abs(rn).max()
# time stops: the rain sinks under a low-pass between 47 and 51
rn_lp = lp(rn, 700)
mixw = curve([(0, 0), (47, 0), (48.5, 1), (51.2, 1), (52.2, 0), (60, 0)])
r_final = (rn * (1 - mixw) + rn_lp * 2.0 * mixw) * rain_g
amb[0] += r_final; amb[1] += np.roll(r_final, 331)
# drips
for k in range(260):
    t0 = rng.uniform(33.5, 54.5)
    g = float(rain_g[int(t0 * SR)])
    if g < 0.05: continue
    f = rng.uniform(1800, 4200)
    tt = tvec(0.05)
    x = np.sin(2 * np.pi * f * tt * (1 + 2 * tt)) * np.exp(-tt / 0.008) * 0.12 * g * 3
    place(amb, x, t0, rng.uniform(-0.9, 0.9))
# distant thunder
for t0, a in [(34.4, 0.5), (38.3, 0.35)]:
    x = bp(brown(4.0), 38, 170) * np.exp(-tvec(4.0) / 1.2) * (1 - np.exp(-tvec(4.0) / 0.25)) * a * 3
    place(amb, x, t0, -0.3)
# birdsong (meadow, and again when the colour returns)
def chirp(f0, f1, d, a):
    t = tvec(d)
    f = np.linspace(f0, f1, len(t))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 2 * a
for k in range(46):
    t0 = rng.uniform(5.0, 14.0) if k < 26 else rng.uniform(53.0, 59.5)
    f0 = rng.uniform(2600, 4200)
    n = rng.integers(2, 5)
    for j in range(n):
        place(amb, chirp(f0, f0 * rng.uniform(1.2, 1.6), rng.uniform(0.04, 0.09), 0.05), t0 + j * rng.uniform(0.07, 0.12), rng.uniform(-0.8, 0.8))
# crickets at dusk (they go quiet when the yellow drains)
cg = curve([(0, 0), (15.5, 0), (17.5, 0.05), (20.5, 0.05), (23.4, 0.0), (60, 0)])
tt = np.arange(N) / SR
cr = np.sin(2 * np.pi * 4700 * tt) * np.clip(np.sin(2 * np.pi * 30 * tt), 0, 1) ** 3 * (0.5 + 0.5 * np.sin(2 * np.pi * 1.6 * tt)) * cg * 0.5
amb[0] += cr * 0.6; amb[1] += np.roll(cr, 2000) * 0.5
# car passes
for k in range(12):
    t0 = rng.uniform(22.5, 38.0)
    d = rng.uniform(1.8, 2.6)
    x = bp(brown(d) + 0.4 * rng.standard_normal(int(d * SR)) * 0.02, 120, 1400)
    x = x / (np.abs(x).max() + 1e-9) * np.sin(np.pi * tvec(d) / d) ** 2 * 0.09
    for i, pan in enumerate(np.linspace(-0.9, 0.9, 6) * (1 if rng.random() > 0.5 else -1)):
        seg = slice(int(i * len(x) / 6), int((i + 1) * len(x) / 6))
        place(amb, x[seg], t0 + i * d / 6, pan)
# a distant horn
t = tvec(0.5)
horn = (signal.square(2 * np.pi * 392 * t) + signal.square(2 * np.pi * 494 * t)) * env_ar(len(t), 0.02, 0.15)
place(amb, lp(horn, 1200) * 0.012, 27.7, 0.6)
# time-lapse rush
d = 6.0
x = pink(d)
f, tt_, Z = signal.stft(x, SR, nperseg=2048)
ctr = np.interp(tt_, [0, 2.2, 4.8, 6.0], [300, 1800, 2600, 600])
mask = np.exp(-((np.log(f[:, None] + 1) - np.log(ctr[None, :])) ** 2) / 0.6)
_, y = signal.istft(Z * mask, SR, nperseg=2048)
y = y[:int(d * SR)] / (np.abs(y).max() + 1e-9) * np.interp(tvec(d), [0, 1.0, 4.6, 6.0], [0, 0.11, 0.1, 0])
place(sfx, y, 40.6, 0.0)
place(sfx, np.roll(y, 900), 40.6, 0.3, 0.6)

# kite flutter (childhood, and again at the end)
def flutter(d, rate):
    t = tvec(d)
    x = bp(rng.standard_normal(len(t)), 250, 1400)
    am = 0.55 + 0.45 * np.sin(2 * np.pi * rate * t + 2 * np.sin(2 * np.pi * 0.7 * t))
    return x / (np.abs(x).max() + 1e-9) * am
x = flutter(5.6, 19) * env_ar(int(5.6 * SR), 0.8, 0.05) * 0.035
place(sfx, x, 5.0, 0.4)
x = flutter(3.0, 21) * np.exp(-tvec(3.0) / 0.9) * 0.03
place(sfx, x, 10.55, 0.6)
x = flutter(8.6, 17) * env_ar(int(8.6 * SR), 1.5, 1.2) * 0.03
place(sfx, x, 51.4, 0.3)

# the string snaps
t = tvec(0.6)
ping = (np.sin(2 * np.pi * 1760 * t * (1 - 0.4 * t)) * np.exp(-t / 0.08) + 0.5 * np.sin(2 * np.pi * 2640 * t) * np.exp(-t / 0.05)) * 0.12
ping[:200] += rng.standard_normal(200) * np.linspace(0.3, 0, 200)
place(sfx, ping, 10.55, 0.3)

# ------------------------------------------------------------------ footsteps (picture-locked)
ev_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'build' / 'events.json'
events = json.loads(ev_path.read_text()) if ev_path.exists() else []
for e in events:
    if e.get('type') != 'step':
        continue
    t0, g = e['t'], 0.4 + 0.6 * e.get('gain', 1)
    kid = e.get('age', 30) < 12
    if e['surface'] == 'grass':
        d = 0.09; x = bp(noise(d), 1500, 6000) * np.exp(-tvec(d) / 0.025) * 0.035
    elif e['surface'] == 'stone':
        d = 0.08; x = (bp(noise(d), 1800, 6000) * np.exp(-tvec(d) / 0.012) * 0.05
                      + np.sin(2 * np.pi * 140 * tvec(d)) * np.exp(-tvec(d) / 0.02) * 0.05)
    else:
        d = 0.12
        x = (bp(noise(d), 2200, 7000) * np.exp(-tvec(d) / 0.008) * 0.05
             + np.sin(2 * np.pi * 110 * tvec(d)) * np.exp(-tvec(d) / 0.025) * 0.07)
        if e.get('wet'):
            x += bp(noise(d), 500, 3500) * np.exp(-tvec(d) / 0.05) * np.abs(np.sin(2 * np.pi * 40 * tvec(d))) * 0.05
    if kid:
        x = x * 0.7
    place(steps, x, t0 + rng.uniform(-0.004, 0.004), -0.05, g)

# ------------------------------------------------------------------ mix
def reverb_ir(d, decay, seed, bright=6000):
    r = np.random.default_rng(seed)
    t = tvec(d)
    ir = r.standard_normal(len(t)) * np.exp(-t * 6.9 / decay)
    ir = lp(ir, bright)
    ir[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    return ir / np.sqrt(np.sum(ir ** 2))

def verb(bus, decay, wet, seed=1, bright=6000):
    out = np.zeros_like(bus)
    for ch in range(2):
        ir = reverb_ir(decay * 1.1, decay, seed + ch, bright)
        out[ch] = signal.fftconvolve(bus[ch], ir)[:N]
    return bus * (1 - wet * 0.5) + out * wet

# music: dry piano is warm; it gets darker and wetter as the colour drains, then opens up at the bloom
music_mix = music + 0.9 * box_bus + pad_bus
tone = curve([(0, 9000), (20, 9000), (23.4, 3800), (31.6, 2600), (39.6, 1600), (47, 1600), (51.2, 1600), (51.6, 12000), (60, 12000)])
# time-varying low-pass by crossfading filtered versions
bands = [1600, 2600, 3800, 6000, 12000]
filt = [np.stack([lp(music_mix[c], fc, 2) for c in range(2)]) for fc in bands]
idx = np.interp(tone, bands, np.arange(len(bands)))
mm = np.zeros_like(music_mix)
for i in range(len(bands)):
    w = np.clip(1 - np.abs(idx - i), 0, 1)
    mm += filt[i] * w
wetc = curve([(0, 0.35), (20, 0.35), (33, 0.55), (46, 0.6), (51.2, 0.6), (51.6, 0.45), (60, 0.45)])
mv_dry = mm; mv_wet = verb(mm, 3.2, 1.0, 11, 7000)
music_out = mv_dry * (1 - wetc) + mv_wet * wetc

mix = music_out * 1.5 + verb(amb, 1.4, 0.25, 21) * 0.8 + verb(sfx, 1.8, 0.3, 31) + verb(steps, 0.9, 0.18, 41) * 1.0
# keep the sub-sonic rumble out of the mix
mix = np.stack([hp(mix[c], 32, 2) for c in range(2)])
# fades
fade = curve([(0, 0), (0.25, 1), (59.2, 1), (60, 0)])
mix *= fade
peak = np.abs(mix).max()
mix = mix / peak * 0.98
mix = np.tanh(mix * 1.25) / np.tanh(1.25)
mix *= 10 ** (-1.0 / 20)

out = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'build' / 'soundtrack.wav'
out.parent.mkdir(parents=True, exist_ok=True)
pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
import wave
with wave.open(str(out), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f'{len([e for e in events if e.get("type") == "step"])} footsteps · peak normalised · → {out}')
