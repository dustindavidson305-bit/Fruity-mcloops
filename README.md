# Fruity McLoops 🍓🎛️

A pocket DJ/remix studio for your phone. Load your own MP3, scratch it
like vinyl, run it through a stack of effects, and build beats on a big
step sequencer full of synthesized techno & dubstep sounds.

## What it does

- **MP3 deck** — load any MP3 (file picker or drag-and-drop), waveform
  display with click-to-seek, play/pause/stop, loop.
- **Scratch board** — a big platter: drag it and the track speeds up,
  slows down, and reverses with your finger, vinyl-style.
- **FX rack** (on the MP3 channel) — distortion, bitcrush, lowpass +
  highpass filters, stereo pan, feedback delay, reverb, deck volume,
  master volume, and a big red **KILL SWITCH** that cuts the sound
  instantly.
- **Sound library** — 15 synthesized sounds, zero samples: kick, snare,
  clap, closed/open hats, tom, rimshot, 808, sub bass, dubstep wobble
  bass, synth stab, pluck, laser, riser, crash.
- **Step sequencer** — 64 steps (4 bars × 16), unlimited tracks (add as
  many rows as you like), tick-box grid, per-track sound/volume/pan/
  mute/solo, BPM 60–200, swing, techno & dubstep presets, randomize.
  Any track can also be an **MP3 one-shot** that fires your loaded MP3.
- **Save & export** — save/load projects as JSON (autosaves locally
  too), and export your loop as a **WAV** file (1–8 bars). The MP3 file
  itself is not stored inside a project file.

## Get it

- **Android:** download `fruity-mcloops.apk` (build it yourself with the
  pipeline below, or grab a built copy) and sideload it.
- **Any browser / iPhone:** open `app/index.html` — on iOS, open it in
  Safari and choose **Add to Home Screen** to install it like an app.

## Build the APK

No Gradle needed — a manual aapt2/javac/d8 pipeline lives in
`manual-build/`:

```sh
cd manual-build
python3 build.py   # writes fruity-mcloops.apk (debug-signed)
```

Requires a JDK 17+ and the Android SDK (platform android-35,
build-tools 35.0.0). The app is a plain WebView wrapper
(`com.delukz.fruitymcloops`) around the single self-contained
`app/index.html` — the whole app is Web Audio API, no external assets,
works fully offline.

## Tests

```sh
node tests/smoke.js   # 121 checks: synth registry, grid model, WAV encoder…
```

## License

MIT
