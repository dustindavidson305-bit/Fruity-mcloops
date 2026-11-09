# Fruity McLoops 🍓🎛️

A pocket DJ/remix studio for your phone. Load your own MP3, scratch it
like vinyl, run it through a stack of effects, and build beats on a big
step sequencer full of synthesized sounds. **v2.0** adds a huge sound
library, a Downloads page full of demo songs, and a custom-sound slot
for your own sample libraries.

## What it does

- **MP3 deck** — load any MP3 (file picker or drag-and-drop), waveform
  display with click-to-seek, play/pause/stop, loop.
- **Scratch board** — a big platter: drag it and the track speeds up,
  slows down, and reverses with your finger, vinyl-style.
- **FX rack** (on the MP3 channel) — distortion, bitcrush, lowpass +
  highpass filters, stereo pan, feedback delay, reverb, deck volume,
  master volume, and a big red **KILL SWITCH** that cuts the sound
  instantly.
- **Sound library — 75 synthesized sounds, zero samples**, organized in
  categories with a category filter and tap-to-preview:
  - **Drums (23)** — kicks (deep, hard, electro), snares, clap, hats,
    shaker, tambourine, cowbell, conga, bongo, toms, rimshot, stick,
    woodblock, crash, zap…
  - **Bass (12)** — 808, sub, dubstep wobble, acid 303, FM bass, reese,
    growl, pluck bass, rubber bass, octave bass…
  - **Synths (14)** — stab, pluck, supersaw, square/saw/PWM/trance
    leads, arp synth, chiptune, FM bell, e-piano, organ, hoover…
  - **Pads (6)** — warm, dark, strings, choir, shimmer, space.
  - **Keys (7)** — music box, marimba, kalimba, guitar pluck, harp,
    vibraphone, toy piano.
  - **FX (13)** — laser, riser, downlifter, impact, siren, vinyl
    crackle, sweeps, blips, coin, alarm, reverse cymbal, UFO…
  - …plus **your own custom sounds** (below).
- **Step sequencer** — 64 steps (4 bars × 16), unlimited tracks (add as
  many rows as you like), tick-box grid, per-track sound (grouped by
  category, including your custom sounds)/volume/pan/mute/solo,
  BPM 60–200, swing, techno & dubstep presets, randomize. Any track can
  also be an **MP3 one-shot** that fires your loaded MP3.
- **⬇ Downloads page** — 6 built-in demo songs (Berlin 4AM techno,
  Wobble Town dubstep, Sunset Groove house, Boom Bap Breakfast hip-hop,
  Jungle Juice drum & bass, Weightless ambient). Each one can be
  **loaded into the sequencer** to remix, **downloaded as a WAV**, or
  **downloaded as a .json project** — all generated inside the app, no
  internet needed. Your own songs export exactly the same way.
- **🎧 My Sounds — custom sound slot** — import your own sound
  libraries: pick many files at once (a whole pack) or drag & drop.
  Accepts MP3, WAV, OGG, Opus, FLAC, M4A/AAC, AIFF, WebM, MP4 audio,
  3GP, AMR, CAF, WMA and more — anything your device can decode becomes
  a sound you can preview, rename, delete and assign to sequencer
  tracks just like a built-in. Imported sounds are **stored in the app
  (IndexedDB) and survive restarts**. MIDI files are skipped with a
  note (they're note files, not audio); undecodable files are reported,
  never crash the import.
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
python3 manual-build/build.py   # writes fruity-mcloops.apk (debug-signed)
```

Requires a JDK 17+ (found via `JAVA_HOME`, `~/jdk21`/`~/jdk17`, or a
system `javac`) and the Android SDK (platform android-35, build-tools
35.0.0, found via `ANDROID_HOME`/`ANDROID_SDK_ROOT` or `~/android-sdk`).
The script locates the repo from its own path, so it builds from any
clone location. The app is a plain WebView wrapper
(`com.delukz.fruitymcloops`) around the single self-contained
`app/index.html` — the whole app is Web Audio API, no external assets,
works fully offline.

## Tests

```sh
node tests/smoke.js   # 322 checks: synth registry (75 sounds, all categorized),
                      # demo songs, custom-import surface, grid model, WAV encoder…
```

## License

MIT
