# Fruity McLoops — Feature Backlog

Ideas queue for the weekly expansion runs. Ship 1–3 per week, cross them
off here, and add at least one new idea each week.

## To do

- [ ] Preset morph pairs — curated preset pairs designed to morph into each
  other (e.g. House → Dubstep) with one morph slider move.
- [ ] Beat-matched transitions — deck-to-deck transitions that auto-match BPM
  and phase (builds on the existing `syncRate` helper).
- [ ] More demo songs — keep growing the Downloads page (8 in v2.3).
- [ ] More sounds / instruments — keep growing the synthesized library
  (117 sounds in v2.4, zero samples).
- [ ] Melody seed in project files — save each track's re-rolled melody seed
  so a 🎲 re-roll survives save/load instead of falling back to the
  deterministic seed (v2.4 keeps the seed in memory only).
- [ ] Echo-out length control — let the echo-out tail time (currently a
  fixed 2.6 s) follow the delay-time slider or a dedicated knob.
- [ ] Step velocity — per-step loudness (tap a lit step twice to cycle
  soft → normal → accent) for more human grooves.

## Shipped

- [x] v2.1 — pitch & scale per track, morph & tone, stem decks, DJ
  workstation, sampling.
- [x] v2.2 — variable 1–8 bar loops + bar tools, per-track mixer channel
  strips (EQ / tone / morph / delay+reverb sends), 30 new sounds
  (105 total), new FX (master trance gate + phaser, deck phaser/gate/
  ringmod/chorus), folder UI + jump nav + sticky status, restored deckVol
  slider.
- [x] iOS/Android PWA packaging — manifest, offline service worker, icons
  (GitHub Pages).
- [x] v2.4 — echo-out on pause (delay feedback opens to 0.62 for 2.6 s on
  STOP, toggleable, persisted in DJ settings), melody re-roll 🎲 button
  per track (fresh seed; Random/Walk keep their pattern, anything else
  switches to Random; seed kept in memory), per-step note editor (tap a
  lit melodic step to cycle its scale degree up the scale and wrap from
  the octave to the root; Shift-click/right-click clears; hand edits
  stick until the pattern is re-applied), PWA cache bump.
