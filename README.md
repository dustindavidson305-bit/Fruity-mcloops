# Fruity McLoops 🍓🎛️

A pocket DJ/remix studio for your phone. Load your own MP3, scratch it
like vinyl, run it through a stack of effects, and build beats on a big
step sequencer full of synthesized sounds. **v2.0** adds a huge sound
library, a Downloads page full of demo songs, and a custom-sound slot
for your own sample libraries. **v2.1** turns it into a 4-deck DJ
workstation with stem splitting, per-track pitch & scale, morphing,
and sampling. **v2.2** is the tidy-up-and-go-deeper release: variable
**1–8 bar loops** with bar-editing tools, a **mixer with a full
channel strip for every sound** (EQ, tone, morph, delay/reverb
sends), **30 new sounds** (105 total), **new effects** (master trance
gate + phaser, plus phaser/gate/ring-mod/chorus per deck), and the
whole app reorganized into collapsible folders with a jump nav and a
sticky status bar. It also restores the deck-bus volume slider that
v2.1's FX wiring expected but never rendered.

## What it does

- **4 DJ decks (A–D)** — each loads its own song (picker or
  drag-and-drop), waveform with click-to-seek, play/pause/stop, loop,
  elapsed/remaining time, scratch platter, pitch fader (±8/16/50%),
  trim, 3-band EQ with full kill, BPM field + tap tempo + sync-to-A,
  4 hot cues (quantize-aware, long-press clears), loop in/out +
  1/2/4/8-beat auto-loops, vinyl brake + spinback, and a per-deck FX
  slot (sweep filter, BPM echo, reverb, dubstep wobble with dotted /
  triplet divisions, bitcrusher, flanger, and — new in v2.2 —
  phaser, BPM trance gate, ring modulator, chorus). Deck cards fold
  away (Deck A starts open). Crossfader with per-deck L/R assignment
  and smooth/sharp/cut curves, Play All / Stop All.
- **Stem modes per deck** — Full / Instrumental (karaoke) / Vocals
  Only, using the classic center-channel trick (side = L−R, center =
  (L+R)/2) live during playback and scratching, plus a Download Stem
  WAV render. Best on stereo mixes with centered vocals; not AI
  separation. Deck A instrumental + Deck B vocals = instant mashup.
- **Track Lab (sequencer)** — per track: key + scale (9 scales) with a
  2-octave piano that previews and sets the root note, octave shift,
  transpose; morph any sound into any other (0–100% blend); tone
  shaping (cutoff, resonance, drive, attack/decay scale) on every hit.
  All of it saves into project files (v2 projects still load).
- **Sampling** — record mic samples straight into My Sounds (Android
  mic permission is bridged in the wrapper), grab samples from direct
  audio URLs, or ✂ chop the loop region / any start–end slice out of
  a loaded deck into My Sounds.
- **Record your mix** — capture the master output from the Downloads
  page and download the take.
- **FX rack** (on the MP3/deck channel) — distortion, bitcrush,
  lowpass + highpass filters, stereo pan, feedback delay, reverb,
  deck volume, master volume, plus v2.2's **trance gate** (1/8-note
  chops at the sequencer BPM) and **4-stage phaser**, and a big red
  **KILL SWITCH** that cuts the sound instantly.
- **Mixer — channel strips (v2.2)** — one collapsible strip per
  sequencer track: volume, pan, transpose, 3-band EQ (with kill),
  tone cutoff + drive, attack/decay, morph amount + target, mute /
  solo, preview, reset, and per-channel **delay & reverb sends**
  feeding shared return buses (with their own return levels in the
  Mixer panel). The CH button on any track row jumps to its strip.
  All of it is live while playing and saves into project files.
- **Sound library — 105 synthesized sounds, zero samples**, organized in
  categories with a category filter and tap-to-preview:
  - **Drums (29)** — kicks (deep, hard, electro, trap, lo-fi), snares,
    brush snare, clap + clap stack, hats, shaker, tambourine, cowbell,
    conga, bongo, toms, rimshot, china crash, zap…
  - **Bass (17)** — 808, sub, dubstep wobble, acid 303, FM bass, reese,
    growl, neuro, donk, bounce, vintage, hoover bass…
  - **Synths (20)** — stab, pluck, supersaw, rave/formant/glide leads,
    theremin, glass arp, super pluck, trance leads, chiptune, organ…
  - **Pads (10)** — warm, dark, strings, choir, shimmer, space, aurora,
    cassette, void, stargazer.
  - **Keys (11)** — music box, marimba, kalimba, guitar pluck, harp,
    vibraphone, toy piano, felt piano, glass keys, celesta, dulcimer.
  - **FX (18)** — laser, riser, downlifter, impact, siren, vinyl
    crackle, sweeps, sub drop, reverse hit, glitch burst, wind…
  - …plus **your own custom sounds** (below).
- **Step sequencer** — a 128-step grid (8 bars × 16) with a **loop
  length selector (1, 2, 3, 4, 6 or 8 bars)**: steps past the loop end
  stay saved, just dimmed, so you can stretch the loop any time. **Bar
  tools** copy a bar to another bar, fill the whole loop from bar 1,
  or clear a bar — across all tracks at once. Unlimited tracks,
  tick-box grid, per-track sound (grouped by category, including your
  custom sounds)/volume/pan/mute/solo + a CH button into the mixer,
  BPM 60–200, swing, techno & dubstep presets, randomize. Any track
  can also be an **MP3 one-shot** that fires your loaded MP3.
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
  too; the v4 format adds loop length + channel strips, and v2/v3
  project files still load, with their 4-bar patterns intact), and
  export your loop as a **WAV** file (1–8 bars). The MP3 file itself
  is not stored inside a project file.
- **Layout (v2.2)** — every section is a collapsible folder (tap its
  title), there's a jump nav under the header, and status messages
  live in a sticky bar at the top so they're never buried.

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
node tests/smoke.js   # 544 checks: synth registry (105 sounds, all categorized),
                      # demo songs, custom-import surface, grid + loop model,
                      # channel strips, WAV encoder…
```

## License

MIT
