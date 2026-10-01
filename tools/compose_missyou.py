#!/usr/bin/env python3
"""
Score and sound design for 想你了 · MISS YOU — synthesised from scratch with numpy.

    node tools/render.mjs events build/missyou_events.json --film missyou
    python3 tools/compose_missyou.py build/missyou_events.json build/missyou.wav

Every sound effect is picture-locked to the cues the film exports (FILM.events()):
the notification, each key tap and delete, the phone landing face down, the glass,
every syllable he speaks, every chew.

Sound arc:
  0–14.5   night: room tone, a fridge hum, a low drone; one piano note per thought.
           S03 pulls the room away until only her breathing and a heartbeat are left.
  14.5–19.9 the flashback: a warm F-major piano figure, a busy little restaurant, laughter
  19.9–31.8 the present: the same figure in D minor, thinner and detuned; fluorescent hum
  S11      his voice is mixed louder than everything around it (her perception, not reality)
  31.8–35.6 everything is pulled out except the chewing, close and dry
  35.6–40.4 the room comes back colder and emptier; the figure stops before it resolves
  40.4–44  title: one unresolved chord
"""
import json, sys, pathlib, wave
import numpy as np
from scipy import signal

SR = 48000
ROOT = pathlib.Path(__file__).resolve().parent.parent
ev_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'build' / 'missyou_events.json'
out_path = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'build' / 'missyou.wav'
EV = json.loads(ev_path.read_text())
DUR = 44.0
N = int(SR * DUR)
rng = np.random.default_rng(11)
cut = {e['shot']: (e['t'], e['end']) for e in EV if e['type'] == 'cut'}

def stereo(): return np.zeros((2, N))
music, amb, sfx, voice = stereo(), stereo(), stereo(), stereo()

def tvec(d): return np.arange(int(d * SR)) / SR
def noise(d): return rng.standard_normal(int(d * SR))
def lp(x, fc, o=2):
    b, a = signal.butter(o, min(fc / (SR / 2), 0.99), 'low'); return signal.lfilter(b, a, x)
def hp(x, fc, o=2):
    b, a = signal.butter(o, fc / (SR / 2), 'high'); return signal.lfilter(b, a, x)
def bp(x, f1, f2, o=2):
    b, a = signal.butter(o, [f1 / (SR / 2), min(f2 / (SR / 2), 0.99)], 'band'); return signal.lfilter(b, a, x)
def pink(d):
    n = int(d * SR); X = np.fft.rfft(rng.standard_normal(n)); f = np.arange(len(X)); f[0] = 1
    return np.fft.irfft(X / np.sqrt(f), n) * 30
def norm(x): return x / (np.abs(x).max() + 1e-9)
def curve(keys):
    ts = np.array([k[0] for k in keys]); vs = np.array([k[1] for k in keys])
    return np.interp(np.arange(N) / SR, ts, vs)
def place(bus, x, t0, pan=0.0, gain=1.0):
    i0 = int(round(t0 * SR))
    if i0 >= N: return
    if i0 < 0: x = x[-i0:]; i0 = 0
    n = min(len(x), N - i0)
    bus[0, i0:i0 + n] += x[:n] * np.cos((pan + 1) * np.pi / 4) * gain
    bus[1, i0:i0 + n] += x[:n] * np.sin((pan + 1) * np.pi / 4) * gain
def env(n, a, r):
    e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e

NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}
def nm(s): return 12 * (int(s[-1]) + 1) + NOTE[s[:-1]]
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)

# ------------------------------------------------------------------ instruments
def piano(note, dur, vel=0.5, bright=1.0, det=0.0):
    f = hz(nm(note)) * (1 + det); t = tvec(dur + 2.5); out = np.zeros_like(t)
    B = 0.00012 * f / 261.6
    for n in range(1, int(min(14, 8000 / f)) + 1):
        fn = n * f * np.sqrt(1 + B * n * n)
        amp = vel ** (1 + 0.22 * n / bright) / n ** 1.15
        e = 0.55 * np.exp(-(2.2 + 0.9 * n + f / 300) * t) + 0.45 * np.exp(-(0.22 + 0.07 * n + f / 1800) * t)
        ph = rng.uniform(0, 6.28); bt = 1 + rng.uniform(-0.0009, 0.0009)
        out += amp * e * (np.sin(2 * np.pi * fn * t + ph) + 0.6 * np.sin(2 * np.pi * fn * bt * t + ph * 1.3))
    out *= 1 - np.exp(-t / 0.002)
    i = int(dur * SR); rn = int(0.4 * SR); rel = np.ones_like(t)
    rel[i:i + rn] = np.linspace(1, 0, len(rel[i:i + rn])) ** 2; rel[i + rn:] = 0
    return lp(out * rel, 2000 + 4000 * vel * bright) * 0.22

def pad(notes, dur, vel=0.3, cutoff=900, a=1.5, r=2.0):
    t = tvec(dur + r); out = np.zeros_like(t)
    for note in notes:
        f = hz(nm(note))
        for k in range(3):
            ph = 2 * np.pi * np.cumsum(f * (1 + (k - 1) * 0.003) * (1 + 0.002 * np.sin(2 * np.pi * (0.2 + k * 0.07) * t))) / SR
            for n in range(1, int(min(10, 5000 / f)) + 1): out += np.sin(n * ph + k) / n
    return lp(out, cutoff) * env(len(t), a, r) * vel * 0.02 / max(1, len(notes) ** 0.5)

def P(note, t0, dur=1.2, vel=0.45, pan=0.0, bright=1.0, det=0.0):
    place(music, piano(note, dur, vel, bright, det), t0, pan)

# ------------------------------------------------------------------ music
s01 = cut['S01'][0]
# night: a drone under everything, one note per beat of the story
place(music, pad(['A2', 'E3'], 13.4, 0.5, 520, 2.5, 1.5), 0.6)
for note, t, v in [('E5', s01 + 0.5, 0.32), ('C5', cut['S02'][0] + 0.4, 0.28), ('B4', cut['S03'][0] + 0.2, 0.26),
                   ('A4', cut['S04'][0] + 0.3, 0.24), ('F4', cut['S05'][0] + 0.95, 0.22)]:
    P(note, t, 2.4, v, 0.15, 0.7)
    P(note[:-1] + str(int(note[-1]) - 2), t, 2.4, v * 0.6, -0.2, 0.6)

# flashback: warm F major, 84 bpm figure
b = 60 / 84
f0 = cut['S06'][0] + 0.05
prog = [('F2', ['F3', 'A3', 'C4', 'E4']), ('C2', ['E3', 'G3', 'C4', 'G4']), ('D2', ['D3', 'F3', 'A3', 'C4']), ('Bb1', ['Bb2', 'D3', 'F3', 'A3'])]
melody = [('A5', 0.5), ('C6', 0.5), ('G5', 1.0), ('E5', 0.5), ('G5', 0.5), ('F5', 1.0), ('D5', 0.5), ('F5', 0.5), ('E5', 1.0)]
tt = f0
for i, (bass, ch) in enumerate(prog):
    t0 = f0 + i * 2 * b
    if t0 > cut['S08'][0] - 0.2: break
    P(bass, t0, 2 * b, 0.42, -0.3)
    for k in range(4): P(ch[k % 4], t0 + k * b / 2, b, 0.3, -0.1)
for note, bb in melody:
    if tt > cut['S08'][0] - 0.3: break
    P(note, tt, bb * b * 1.2, 0.36, 0.25); tt += bb * b
place(music, pad(['F3', 'A3', 'C4', 'E4'], 5.0, 0.35, 1600, 0.3, 1.0), f0)

# present: the same figure, D minor, thinner, slightly out of tune
p0 = cut['S08'][0] + 0.1
b2 = 60 / 72
for i, (bass, ch) in enumerate([('D2', ['D3', 'F3', 'A3']), ('Bb1', ['D3', 'F3', 'Bb3']), ('G1', ['D3', 'G3', 'Bb3']), ('A1', ['C#3', 'E3', 'A3']), ('D2', ['D3', 'F3', 'A3'])]):
    t0 = p0 + i * 2 * b2
    if t0 > cut['S13'][0] - 0.3: break
    P(bass, t0, 2 * b2, 0.3, -0.3, 0.6, -0.002 * i)
    P(ch[i % 3], t0 + b2, b2, 0.2, -0.1, 0.6, -0.003 * i)
for note, t, v in [('A4', p0 + 0.0, 0.26), ('C5', p0 + 0.9, 0.24), ('F4', p0 + 1.8, 0.24), ('E4', cut['S10'][0] + 0.3, 0.24), ('D4', cut['S10'][0] + 1.5, 0.22),
                   ('A4', cut['S12'][0] + 0.2, 0.2)]:
    if t < cut['S13'][0] - 0.3: P(note, t, 1.6, v, 0.2, 0.65, -0.004)
place(music, pad(['D3', 'A3'], cut['S13'][0] - p0, 0.24, 700, 1.0, 0.25), p0)

# the end: the first notes of the warm figure, no answer
e0 = cut['S15'][0] + 0.6
for note, t, v in [('A5', e0, 0.26), ('C6', e0 + 0.7, 0.24), ('G5', e0 + 1.4, 0.22)]:
    P(note, t, 1.8, v, 0.25, 0.6, -0.003)
P('D2', e0, 4.0, 0.26, -0.3, 0.5)
place(music, pad(['D3', 'F3', 'C4'], 4.0, 0.22, 600, 1.5, 1.5), cut['S15'][0])
ti = cut['TITLE'][0] + 0.35
for n, v in [('Bb1', 0.3), ('F2', 0.24), ('C4', 0.2), ('D4', 0.18), ('E4', 0.18), ('A4', 0.16)]:
    P(n, ti, 2.6, v, 0.0, 0.6)

# ------------------------------------------------------------------ ambience
def bed(bus, gen, keys, lo=None, hi=None, decor=331):
    g = curve(keys); x = gen(DUR)
    if lo: x = hp(x, lo)
    if hi: x = lp(x, hi)
    x = norm(x)[:N] * g
    bus[0] += x; bus[1] += np.roll(x, decor)

s06, s08, s13, s15 = cut['S06'][0], cut['S08'][0], cut['S13'][0], cut['S15'][0]
# night room tone + fridge hum (ducked in S03, gone in the diner)
s03a, s03b = cut['S03']
bed(amb, pink, [(0, 0), (0.6, 0.03), (s03a, 0.03), (s03a + 0.4, 0.008), (s03b - 0.2, 0.008), (s03b, 0.03), (s06 - 0.01, 0.03), (s06, 0), (cut['S12'][0], 0), (cut['S12'][0] + 0.01, 0.025), (s13 - 0.01, 0.025), (s13, 0)], 80, 1200)
tt = np.arange(N) / SR
hum = (np.sin(2 * np.pi * 59 * tt) + 0.4 * np.sin(2 * np.pi * 118 * tt) + 0.15 * np.sin(2 * np.pi * 177 * tt)) * curve([(0, 0), (0.6, 0.012), (s03a, 0.012), (s03a + 0.4, 0.003), (s03b, 0.012), (s06, 0.012), (s06 + 0.001, 0)])
amb[0] += hum; amb[1] += hum

# the restaurant: a babble of voices, louder and warmer in the past, sparse in the present
def babble(d):
    x = np.zeros(int(d * SR))
    for k in range(14):
        car = pink(d)
        fm = 300 + 900 * rng.random()
        v = bp(car, fm * 0.6, fm * 2.2)
        sy = np.clip(lp(rng.standard_normal(len(x)), 5) * 40, 0, None)
        x += v * sy
    return x
bed(amb, babble, [(0, 0), (s06, 0), (s06 + 0.01, 0.07), (s08 - 0.01, 0.07), (s08, 0.02), (cut['S11'][0], 0.02), (cut['S11'][0] + 0.01, 0.008), (cut['S12'][0], 0.008), (cut['S12'][0] + 0.01, 0), (s15, 0), (s15 + 0.6, 0.012), (DUR - 3.4, 0.008), (DUR - 3.6, 0)], 200, 3500, 911)
# fluorescent tube in the present
tube = (np.sin(2 * np.pi * 100 * tt) * 0.5 + 0.3 * np.sin(2 * np.pi * 200 * tt) + 0.2 * np.sin(2 * np.pi * 300 * tt) + 0.05 * hp(rng.standard_normal(N), 4000)) \
    * curve([(0, 0), (s08 - 0.01, 0), (s08, 0.01), (cut['S12'][0] - 0.01, 0.01), (cut['S12'][0], 0), (s13, 0), (s13 + 0.01, 0.006), (cut['S14'][1], 0.006), (s15, 0.014), (DUR - 3.6, 0.01), (DUR - 3.4, 0)])
amb[0] += tube; amb[1] += tube * 0.9
# street traffic through the window (past: lively; present: one distant car)
bed(amb, lambda d: lp(pink(d), 500), [(0, 0), (s06, 0), (s06 + 0.01, 0.03), (s08, 0.03), (s08 + 0.01, 0.0), (s15, 0), (s15 + 0.5, 0.015), (DUR - 3.6, 0.01), (DUR - 3.4, 0)], 60)
# dish clatter in the flashback
for k in range(9):
    t0 = s06 + rng.uniform(0.2, 5.0)
    x = bp(noise(0.12), 2500, 9000) * np.exp(-tvec(0.12) / 0.02) * 0.05
    x += np.sin(2 * np.pi * rng.uniform(2200, 3600) * tvec(0.12)) * np.exp(-tvec(0.12) / 0.04) * 0.03
    place(amb, x, t0, rng.uniform(-0.8, 0.8))

# ------------------------------------------------------------------ picture-locked effects
def S(*xs):
    """sum signals of different lengths"""
    out = np.zeros(max(len(x) for x in xs))
    for x in xs: out[:len(x)] += x
    return out

def click(f1=2500, f2=9000, d=0.025, a=0.06, tau=0.004):
    return bp(noise(d), f1, f2) * np.exp(-tvec(d) / tau) * a
def tone(f, d, a, tau, f_end=None):
    t = tvec(d); fr = f if f_end is None else np.linspace(f, f_end, len(t))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / tau) * (1 - np.exp(-t / 0.002)) * a

for e in EV:
    t, ty = e['t'], e['type']
    if ty == 'notify':
        x = S(tone(1318.5, 0.6, 0.12, 0.18), tone(1975.5, 0.6, 0.06, 0.12))
        place(sfx, x, t, 0.25); place(sfx, tone(1975.5, 0.5, 0.08, 0.15), t + 0.11, 0.25)
    elif ty == 'buzz':
        d = e['dur']; tt_ = tvec(d)
        x = (signal.sawtooth(2 * np.pi * 172 * tt_) * 0.5 + bp(noise(d), 150, 900) * 0.4) * env(len(tt_), 0.01, 0.08)
        place(sfx, lp(x, 1400) * 0.05, t, 0.3)
    elif ty == 'breath':
        d = e['dur']; tt_ = tvec(d)
        x = bp(pink(d), 400, 2400) * np.sin(np.pi * tt_ / d) ** 2
        place(sfx, norm(x) * 0.035, t, 0.0)
    elif ty == 'grip':
        d = e['dur']; x = bp(noise(d), 600, 5000) * np.abs(lp(rng.standard_normal(int(d * SR)), 20)) * 8
        place(sfx, norm(x) * 0.02 * env(int(d * SR), 0.2, 0.3), t, -0.4)
    elif ty == 'key':
        place(sfx, S(click(1800, 7000, 0.03, 0.05, 0.005), tone(160, 0.03, 0.03, 0.006)), t, 0.1)
    elif ty == 'del':
        place(sfx, S(click(1200, 5000, 0.04, 0.06, 0.007), tone(120, 0.04, 0.04, 0.01)), t, 0.1)
    elif ty == 'send':
        place(sfx, click(1500, 6000, 0.03, 0.05, 0.006), t, 0.1)
    elif ty == 'sent':
        place(sfx, tone(880, 0.25, 0.05, 0.05, 1320), t, 0.1)
    elif ty == 'thud':
        x = S(lp(noise(0.25), 260) * np.exp(-tvec(0.25) / 0.04) * 0.6, tone(70, 0.3, 0.25, 0.06))
        place(sfx, x, t, 0.15)
    elif ty == 'laugh':
        # her laugh: breathy syllables "ha-ha-ha", falling, decaying
        for k in range(7):
            tk = t + 0.12 + k * 0.17 + rng.uniform(-0.01, 0.01); d = 0.13; tt_ = tvec(d)
            f0_ = 330 - k * 12
            src = signal.sawtooth(2 * np.pi * np.cumsum(f0_ * (1 - 0.15 * tt_ / d) * np.ones_like(tt_)) / SR) * 0.4 + rng.standard_normal(len(tt_)) * 0.6
            v = bp(src, 700, 1300) + 0.6 * bp(src, 1600, 2600)
            place(voice, norm(v) * np.sin(np.pi * tt_ / d) ** 1.5 * 0.05 * (1 - k / 9), tk, -0.15)
    elif ty == 'pick':
        place(sfx, click(3000, 9000, 0.02, 0.03, 0.003), t, -0.2)
    elif ty in ('bowl', 'slide'):
        d = e['dur']; x = bp(noise(d), 300, 3000) * env(int(d * SR), 0.1, 0.2)
        place(sfx, norm(x) * (0.03 if ty == 'bowl' else 0.022), t, 0.2 if ty == 'bowl' else -0.2)
    elif ty == 'chopsticks':
        place(sfx, click(2000, 8000, 0.04, 0.05, 0.006), t, 0.3); place(sfx, click(2000, 8000, 0.04, 0.035, 0.006), t + 0.05, 0.3)
    elif ty == 'cloth':
        x = bp(noise(0.5), 500, 4000) * env(int(0.5 * SR), 0.15, 0.25)
        place(sfx, norm(x) * 0.02, t - 0.5, 0.0)
    elif ty == 'clink':
        x = S(tone(2350, 0.8, 0.07, 0.25), tone(3790, 0.6, 0.04, 0.12), tone(5900, 0.3, 0.02, 0.05), click(3000, 10000, 0.01, 0.06, 0.002))
        place(sfx, x, t, -0.3)
    elif ty == 'syl':
        # his voice: a pitched, formant-filtered syllable — no words, just the tone of it, too close
        d = e['dur'] + 0.04; tt_ = tvec(d)
        f0_ = 118 * (1 + 0.12 * np.sin(np.pi * tt_ / d) * (1 if rng.random() > 0.5 else -0.6))
        src = signal.sawtooth(2 * np.pi * np.cumsum(f0_) / SR) + 0.08 * rng.standard_normal(len(tt_))
        F1, F2 = rng.choice([(700, 1200), (400, 2000), (500, 900), (300, 2300), (600, 1700)])
        v = bp(src, F1 * 0.8, F1 * 1.25) + 0.5 * bp(src, F2 * 0.85, F2 * 1.15) + 0.15 * bp(src, 2600, 3400)
        place(voice, norm(v) * np.sin(np.pi * tt_ / d) ** 0.8 * 0.11 * (0.6 + 0.4 * e['a']), t, 0.0)
    elif ty == 'ping':
        place(sfx, S(tone(1568, 0.4, 0.09, 0.12), tone(2349, 0.3, 0.04, 0.08)), t, 0.15)
    elif ty == 'chew':
        # wet, crunchy, close: a squelch then a little crunch, mixed dry and loud
        d = 0.22; tt_ = tvec(d)
        sq = bp(noise(d), 300, 1500) * np.exp(-tt_ / 0.05) * np.abs(np.sin(2 * np.pi * 34 * tt_)) * 0.5
        cr = bp(noise(d), 2000, 7000) * (rng.random(len(tt_)) > 0.985) * 1.6
        th = tone(85, d, 0.25, 0.05)
        place(sfx, S(sq + cr * np.exp(-tt_ / 0.1), th) * 1.5, t, -0.05)
        place(sfx, bp(noise(0.08), 900, 3000) * np.exp(-tvec(0.08) / 0.02) * 0.3, t + 0.2, -0.05)

# ------------------------------------------------------------------ mix
def reverb(bus, decay, seed, bright=6000):
    out = np.zeros_like(bus)
    for ch in range(2):
        r = np.random.default_rng(seed + ch); t = tvec(decay * 1.1)
        ir = lp(r.standard_normal(len(t)) * np.exp(-t * 6.9 / decay), bright); ir /= np.sqrt(np.sum(ir ** 2))
        out[ch] = signal.fftconvolve(bus[ch], ir)[:N]
    return out

# music is warm and open in the flashback, filtered and wetter in the present
mus_dry = music
mus_lp = np.stack([lp(music[c], 1800) for c in range(2)])
openk = curve([(0, 0.3), (s06 - 0.01, 0.3), (s06, 1), (s08 - 0.01, 1), (s08, 0.15), (DUR, 0.15)])
mm = mus_dry * openk + mus_lp * (1 - openk)
mwet = reverb(mm, 3.0, 5, 6500)
wet = curve([(0, 0.45), (s06, 0.3), (s08, 0.5), (DUR, 0.55)])
music_out = mm * (1 - wet * 0.5) + mwet * wet

# S13–S14: everything ducks except the chewing (her perception narrows to one sound)
duck = curve([(0, 1), (s13 - 0.01, 1), (s13, 0.0), (cut['S14'][1] - 0.01, 0.0), (cut['S14'][1], 1), (DUR, 1)])
# S03: the room recedes
duck_room = curve([(0, 1), (s03a, 1), (s03a + 0.3, 0.35), (s03b - 0.1, 0.35), (s03b, 1), (DUR, 1)])
sfx_wet = reverb(sfx, 0.7, 21)
amb_out = (amb + reverb(amb, 1.2, 31) * 0.3) * duck * duck_room
voice_out = voice + reverb(voice, 0.6, 41) * 0.15
mix = music_out * 1.4 * (0.25 + 0.75 * duck) + amb_out * 1.0 + (sfx + sfx_wet * 0.15) * 1.0 + voice_out * 1.8
# heartbeat under S03
for k in range(4):
    for dt, a in [(0.0, 1.0), (0.22, 0.6)]:
        t = tvec(0.25); x = np.sin(2 * np.pi * (55 - 14 * t) * t) * np.exp(-t / 0.06) * 0.3 * a
        place(mix, x, s03a + 0.3 + k * 0.72 + dt, 0.0)

mix = np.stack([hp(mix[c], 28) for c in range(2)])
mix *= curve([(0, 0), (0.3, 1), (DUR - 0.4, 1), (DUR, 0)])
# loudness: bring the programme to about -21 dBFS RMS, then a soft limiter catches the transients
mix = mix * (10 ** (-21 / 20) / np.sqrt(np.mean(mix ** 2)))
mix = np.tanh(mix / 0.85) * 0.85 * 10 ** (-0.5 / 20)

out_path.parent.mkdir(parents=True, exist_ok=True)
pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
with wave.open(str(out_path), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(f'{len(EV)} cues → {out_path}')
