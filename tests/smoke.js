/* Fruity McLoops — headless smoke tests.
   Loads the pure-logic <script> block out of app/index.html and tests:
   grid encode/decode, project round-trip, WAV encoder bytes,
   sound-registry completeness, and every synth sound against a
   stubbed Web Audio context. Run: node tests/smoke.js */
"use strict";
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (!blocks.length) { console.error("FAIL: no script blocks found"); process.exit(1); }
const mod = { exports: {} };
new Function("module", "exports", blocks[0])(mod, mod.exports);
const FM = mod.exports;

let pass = 0, fail = 0;
function check(name, cond, extra){
  if (cond){ pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (extra ? " -- " + extra : "")); }
}

/* ---------- registry completeness ---------- */
const SPEC_SOUNDS = ["kick","snare","clap","hat","openhat","tom","rim","808",
                     "sub","wobble","stab","pluck","laser","riser","crash"];
SPEC_SOUNDS.forEach(s => check("sound exists: " + s, !!FM.SOUNDS[s] && typeof FM.SOUNDS[s].play === "function"));
check("registry has >= 15 sounds", FM.SOUND_NAMES.length >= 15, "got " + FM.SOUND_NAMES.length);

/* presets only reference real sounds, rows are 64 steps */
Object.keys(FM.PRESETS).forEach(pname => {
  const trs = FM.presetToTracks(pname);
  check("preset " + pname + " builds tracks", Array.isArray(trs) && trs.length >= 8);
  trs.forEach(tr => {
    check("preset " + pname + " sound ok: " + tr.sound, !!FM.SOUNDS[tr.sound]);
    check("preset " + pname + " row is 128 steps (" + tr.sound + ")", tr.steps.length === 128);
    check("preset " + pname + " row has hits (" + tr.sound + ")", tr.steps.some(Boolean));
  });
});
check("default tracks = 10 rows, all valid sounds",
  FM.defaultTracks().length === 10 && FM.defaultTracks().every(t => !!FM.SOUNDS[t.sound]));

/* ---------- grid encode/decode round-trip ---------- */
for (let trial = 0; trial < 25; trial++){
  const steps = Array.from({ length: 64 }, () => Math.random() < 0.4);
  const back = FM.stringToSteps(FM.stepsToString(steps), 64);
  if (JSON.stringify(back) !== JSON.stringify(steps)){
    check("steps round-trip trial " + trial, false); break;
  }
  if (trial === 24) check("steps encode/decode round-trip (25 random grids)", true);
}
const pat = FM.pattern("x...x...x...x...", "................", "....x.......x...", "................");
check("pattern() builds 128 steps (8 bars)", pat.length === 128);
check("pattern() lands hits", pat[0] === true && pat[4] === true && pat[36] === true && pat[1] === false);

/* ---------- project serialize/parse round-trip ---------- */
const stateIn = { bpm: 147, swing: 12,
  fx: Object.assign({}, FM.DEFAULT_FX, { drive: 40, reverb: 25 }),
  tracks: FM.presetToTracks("dubstep") };
stateIn.tracks[0].pan = -0.5; stateIn.tracks[1].mute = true; stateIn.tracks.push(
  { sound: FM.MP3_SOUND, steps: FM.pattern("x...............","................","................","................"),
    volume: 0.7, pan: 0.25, mute: false, solo: false });
const json = FM.serializeProject(stateIn);
const parsed = JSON.parse(json);
check("project JSON stamps app name", parsed.app === "FruityMcLoops");
check("project steps stored as 128-char strings",
  parsed.tracks.every(t => typeof t.steps === "string" && t.steps.length === 128));
const stateOut = FM.parseProject(json);
check("project round-trip bpm", stateOut.bpm === 147);
check("project round-trip swing", stateOut.swing === 12);
check("project round-trip fx", stateOut.fx.drive === 40 && stateOut.fx.reverb === 25);
check("project round-trip track count", stateOut.tracks.length === stateIn.tracks.length);
check("project round-trip grids identical",
  stateOut.tracks.every((t, i) => FM.stepsToString(t.steps) === FM.stepsToString(stateIn.tracks[i].steps)));
check("project round-trip pan/mute/mp3-row",
  stateOut.tracks[0].pan === -0.5 && stateOut.tracks[1].mute === true &&
  stateOut.tracks[stateOut.tracks.length - 1].sound === "mp3");
let threw = false;
try { FM.parseProject('{"hello":1}'); } catch(e){ threw = true; }
check("parseProject rejects junk", threw);

/* ---------- WAV encoder ---------- */
function fakeBuffer(nCh, frames, rate){
  const chans = [];
  for (let c = 0; c < nCh; c++){
    const d = new Float32Array(frames);
    for (let i = 0; i < frames; i++) d[i] = Math.sin(i / 9 + c) * 0.5;
    chans.push(d);
  }
  return { numberOfChannels: nCh, sampleRate: rate, length: frames,
           getChannelData: c => chans[c] };
}
const wav = FM.encodeWAV(fakeBuffer(2, 4410, 44100));
const wv = new DataView(wav);
const strAt = (o, n) => { let s = ""; for (let i = 0; i < n; i++) s += String.fromCharCode(wv.getUint8(o + i)); return s; };
check("WAV starts with RIFF", strAt(0, 4) === "RIFF");
check("WAV has WAVE tag", strAt(8, 4) === "WAVE");
check("WAV has fmt chunk", strAt(12, 4) === "fmt ");
check("WAV is PCM16 stereo 44.1k",
  wv.getUint16(20, true) === 1 && wv.getUint16(22, true) === 2 &&
  wv.getUint32(24, true) === 44100 && wv.getUint16(34, true) === 16);
check("WAV data chunk size matches frames",
  wv.getUint32(40, true) === 4410 * 2 * 2 && wav.byteLength === 44 + 4410 * 2 * 2);
check("WAV RIFF size field consistent", wv.getUint32(4, true) === wav.byteLength - 8);
const wavMono = FM.encodeWAV(fakeBuffer(1, 100, 22050));
check("WAV mono works", new DataView(wavMono).getUint16(22, true) === 1 && wavMono.byteLength === 44 + 200);

/* ---------- curves ---------- */
const dc = FM.makeDistortionCurve(50);
let mono = true, sat = true;
for (let i = 1; i < dc.length; i++){ if (dc[i] < dc[i-1] - 1e-6) mono = false; }
for (let i = 200; i < dc.length; i++){ if (Math.abs(dc[i] - dc[255]) > 0.05) sat = false; }
check("distortion curve monotonic + saturating (MDN curve)",
  dc.length === 256 && mono && sat && dc[0] < -0.25 && dc[255] > 0.25 && Math.abs(dc[0] + dc[255]) < 0.02);
const dc0 = FM.makeDistortionCurve(0);
check("distortion curve at 0 is identity", Math.abs(dc0[64] - -0.5) < 0.01 && Math.abs(dc0[192] - 0.5) < 0.01);
const cc = FM.makeCrushCurve(2);
check("crush curve quantizes (2-bit grid = 9 points)", new Set(Array.from(cc)).size === 9,
  "levels=" + new Set(Array.from(cc)).size);
const cc6 = FM.makeCrushCurve(6);
check("crush curve 6-bit is finer than 2-bit", new Set(Array.from(cc6)).size > 100,
  "levels=" + new Set(Array.from(cc6)).size);

/* ---------- stub Web Audio context: run every sound ---------- */
class FakeParam {
  constructor(){ this.value = 0; }
  setValueAtTime(){ return this; } linearRampToValueAtTime(){ return this; }
  exponentialRampToValueAtTime(){ return this; } setTargetAtTime(){ return this; }
  cancelScheduledValues(){ return this; }
}
function fakeNode(){
  const base = { connect(){}, disconnect(){}, start(){}, stop(){} };
  return new Proxy(base, {
    get(t, p){
      if (p in t) return t[p];
      t[p] = new FakeParam(); return t[p];
    },
    set(t, p, v){ t[p] = v; return true; }
  });
}
function fakeCtx(){
  return {
    currentTime: 0, sampleRate: 44100, state: "running", destination: fakeNode(),
    createOscillator: fakeNode, createGain: fakeNode, createBiquadFilter: fakeNode,
    createBufferSource: fakeNode, createWaveShaper: fakeNode,
    createStereoPanner: fakeNode, createDelay: fakeNode, createConvolver: fakeNode,
    createDynamicsCompressor: fakeNode,
    createBuffer(ch, len, rate){
      const data = Array.from({ length: ch }, () => new Float32Array(len));
      return { numberOfChannels: ch, length: len, sampleRate: rate,
               duration: len / rate, getChannelData: c => data[c] };
    },
    resume(){ return Promise.resolve(); }
  };
}
{
  const fctx = fakeCtx(), dest = fakeNode();
  FM.SOUND_NAMES.forEach(name => {
    let ok = true;
    try { FM.SOUNDS[name].play(fctx, dest, 0.25, { dur: 0.4, rate: 8, pitch: 1, freq: 520 }); }
    catch(e){ ok = false; }
    check("sound runs on stub ctx: " + name, ok);
  });
  check("triggerSound rejects unknown sound", FM.triggerSound(fctx, dest, 0, "nope", null) === false);
  check("triggerSound mp3 without buffer is a no-op false", FM.triggerSound(fctx, dest, 0, "mp3", null) === false);
  const fakeMp3Buf = fakeCtx().createBuffer(1, 4410, 44100);
  check("triggerSound mp3 with buffer plays", FM.triggerSound(fctx, dest, 0, "mp3", fakeMp3Buf) === true);
  check("triggerSound synth plays", FM.triggerSound(fctx, dest, 0, "kick", null) === true);
}

/* ---------- v2.0: registry size + categories ---------- */
check("v2 registry total >= 65 sounds", FM.SOUND_NAMES.length >= 65, "got " + FM.SOUND_NAMES.length);
check("v2 at least 50 NEW sounds beyond the original 15",
  FM.SOUND_NAMES.filter(n => !SPEC_SOUNDS.includes(n)).length >= 50,
  "new=" + FM.SOUND_NAMES.filter(n => !SPEC_SOUNDS.includes(n)).length);
FM.SOUND_NAMES.forEach(n =>
  check("v2 sound has a valid category: " + n,
    !!FM.SOUNDS[n].cat && FM.SOUND_CATEGORIES.includes(FM.SOUNDS[n].cat) && FM.soundCategory(n) === FM.SOUNDS[n].cat));
["Drums", "Bass", "Synths", "Pads", "Keys", "FX"].forEach(c =>
  check("v2 category has >= 5 sounds: " + c,
    FM.SOUND_NAMES.filter(n => FM.SOUNDS[n].cat === c).length >= 5,
    "count=" + FM.SOUND_NAMES.filter(n => FM.SOUNDS[n].cat === c).length));
check("v2 library UI category filter exists",
  html.includes('id="libCatFilter"') && html.includes('id="libGrid"') && html.includes("renderLibrary"));

/* ---------- v2.0: demo songs (Downloads tab) ---------- */
check("v2 demo songs >= 6", Array.isArray(FM.DEMO_SONGS) && FM.DEMO_SONGS.length >= 6,
  "got " + (FM.DEMO_SONGS || []).length);
check("v2 demo genres >= 5 distinct",
  new Set(FM.DEMO_SONGS.map(d => d.genre)).size >= 5);
FM.DEMO_SONGS.forEach(d => {
  check("v2 demo has name/genre/bpm: " + d.id, !!d.name && !!d.genre && d.bpm >= 60 && d.bpm <= 200);
  check("v2 demo references only existing sounds: " + d.id,
    d.tracks.every(row => !!FM.SOUNDS[row[0]]));
  const st = FM.demoToState(d);
  check("v2 demo builds a full project: " + d.id,
    !!st && st.tracks.length >= 5 && st.tracks.every(t => t.steps.length === 128));
  check("v2 demo every row has hits: " + d.id,
    st.tracks.every(t => t.steps.some(Boolean)));
  const back = FM.parseProject(FM.serializeProject(st));
  check("v2 demo survives project round-trip: " + d.id, back.tracks.length === st.tracks.length);
});
check("v2 Downloads panel + demo buttons exist",
  html.includes('id="demoList"') && html.includes("renderDownloads") &&
  html.includes("downloadDemoWav") && html.includes('id="ownSaveBtn"') && html.includes('id="ownWavBtn"'));

/* ---------- v2.0: custom sound import / extension slot ---------- */
const customTag = (html.match(/<input[^>]*id="customFile"[^>]*>/) || [""])[0];
const acceptExts = (customTag.match(/\.[a-z0-9]+/g) || []).map(x => x.slice(1));
["mp3","wav","ogg","opus","flac","m4a","aac","aif","aiff","webm","mp4","amr","caf","mid","midi","wma"]
  .forEach(ext => check("v2 custom accept includes ." + ext, acceptExts.includes(ext)));
check("v2 custom input allows multiple files", /id="customFile"[^>]*multiple/.test(customTag));
check("v2 CUSTOM_ACCEPT export is broad (>= 15 extensions)",
  typeof FM.CUSTOM_ACCEPT === "string" && (FM.CUSTOM_ACCEPT.match(/\./g) || []).length >= 15);
check("v2 IndexedDB persistence functions exist",
  typeof FM.openCustomDB === "function" && typeof FM.saveCustomSoundRecord === "function" &&
  typeof FM.loadCustomSoundRecords === "function" && typeof FM.deleteCustomSoundRecord === "function");
check("v2 app uses IndexedDB + decodeAudioData for imports",
  html.includes("indexedDB") && html.includes("loadCustomSoundRecords") &&
  html.includes("decodeAudioData") && html.includes("handleCustomFiles"));
check("v2 triggerSound resolves custom: ids via buffer registry",
  html.includes('indexOf("custom:")') && html.includes("CUSTOM_BUFFERS"));
{
  const fctx = fakeCtx(), dest = fakeNode();
  check("v2 triggerSound custom id without buffer is a safe no-op",
    FM.triggerSound(fctx, dest, 0, "custom:missing", null) === false);
  const stc = FM.parseProject(JSON.stringify({ tracks: [
    { sound: "custom:abc123", steps: "x" + ".".repeat(63), volume: 0.8, pan: 0, mute: false, solo: false }] }));
  check("v2 parseProject keeps custom: track sounds", stc.tracks[0].sound === "custom:abc123");
}
check("v2 version text present", html.includes("v2.0") || html.includes("v2.1"));

/* ---------- v2.1: scales & pitch ---------- */
["chromatic","major","naturalMinor","harmonicMinor","majorPent","minorPent","blues","dorian","mixolydian"]
  .forEach(k => check("v2.1 scale exists: " + k,
    !!FM.SCALES[k] && Array.isArray(FM.SCALES[k].intervals) && FM.SCALE_NAMES.includes(k)));
check("v2.1 major intervals exact",
  JSON.stringify(FM.SCALES.major.intervals) === JSON.stringify([0,2,4,5,7,9,11]));
check("v2.1 blues has the flat-5", FM.SCALES.blues.intervals.includes(6) && FM.SCALES.blues.intervals.length === 6);
check("v2.1 pentatonics have 5 notes",
  FM.SCALES.majorPent.intervals.length === 5 && FM.SCALES.minorPent.intervals.length === 5);
check("v2.1 chromatic has all 12", FM.SCALES.chromatic.intervals.length === 12);
check("v2.1 noteToFreq A4 = 440", Math.abs(FM.noteToFreq(69) - 440) < 0.01);
check("v2.1 noteToFreq C4 ≈ 261.63", Math.abs(FM.noteToFreq(60) - 261.63) < 0.05);
check("v2.1 noteToFreq octave doubles", Math.abs(FM.noteToFreq(72) / FM.noteToFreq(60) - 2) < 1e-9);
check("v2.1 noteName", FM.noteName(60) === "C4" && FM.noteName(69) === "A4" && FM.noteName(48) === "C3");
check("v2.1 scale degree 0 = root",
  Math.abs(FM.scaleDegreeFreq(60, "major", 0) - FM.noteToFreq(60)) < 1e-9);
check("v2.1 scale degree wraps to octave",
  Math.abs(FM.scaleDegreeFreq(60, "major", 7) - FM.noteToFreq(72)) < 1e-9);
check("v2.1 major degree 2 from C is E",
  Math.abs(FM.scaleDegreeFreq(60, "major", 2) - FM.noteToFreq(64)) < 1e-9);
check("v2.1 minor degree 2 from A is C (flattened 3rd)",
  Math.abs(FM.scaleDegreeFreq(57, "naturalMinor", 2) - FM.noteToFreq(60)) < 1e-9);
check("v2.1 scaleContains: E in C major, Eb not",
  FM.scaleContains(0, "major", 64) === true && FM.scaleContains(0, "major", 63) === false);
check("v2.1 scaleContains: Eb in C minor",
  FM.scaleContains(0, "naturalMinor", 63) === true);
{
  const tr = FM.mkTrack("sub");
  check("v2.1 mkTrack pitch defaults (C major, root C3, no shift)",
    tr.key === 0 && tr.scale === "major" && tr.rootNote === 48 && tr.octave === 0 && tr.transpose === 0);
  check("v2.1 default pitch factor is exactly 1", FM.trackPitchFactor(tr) === 1);
  check("v2.1 default root freq is C3", Math.abs(FM.trackRootFreq(tr) - FM.noteToFreq(48)) < 1e-9);
  tr.transpose = 12;
  check("v2.1 transpose +12 doubles the factor", Math.abs(FM.trackPitchFactor(tr) - 2) < 1e-9);
  tr.transpose = 0; tr.octave = -1;
  check("v2.1 octave -1 halves the factor", Math.abs(FM.trackPitchFactor(tr) - 0.5) < 1e-9);
  tr.octave = 0; tr.rootNote = 60;
  check("v2.1 root C4 doubles the factor", Math.abs(FM.trackPitchFactor(tr) - 2) < 1e-9);
  const dirty = FM.sanitizeTrackPitch({ key: 99, scale: "nope", rootNote: 500, octave: -9, transpose: 40 });
  check("v2.1 sanitizeTrackPitch clamps junk",
    dirty.key === 11 && dirty.scale === "major" && dirty.rootNote === 96 && dirty.octave === -2 && dirty.transpose === 12);
}

/* ---------- v2.1: morph & tone defaults + persistence ---------- */
{
  const tr = FM.mkTrack("kick");
  check("v2.1 mkTrack morph defaults", tr.morph === 0 && tr.morphTarget === "");
  check("v2.1 mkTrack tone defaults are neutral",
    tr.tone.cutoff === 18000 && tr.tone.drive === 0 && tr.tone.attack === 1 && tr.tone.decay === 1);
  check("v2.1 sanitizeTone clamps",
    FM.sanitizeTone({ cutoff: 50 }).cutoff === 100 && FM.sanitizeTone({ attack: 99 }).attack === 4 &&
    FM.sanitizeTone(null).cutoff === 18000);
  tr.key = 7; tr.scale = "dorian"; tr.rootNote = 55; tr.octave = 1; tr.transpose = -3;
  tr.morph = 65; tr.morphTarget = "wobble";
  tr.tone = { cutoff: 1200, resonance: 8, drive: 40, attack: 2, decay: 0.5 };
  const st = { bpm: 128, swing: 4, fx: Object.assign({}, FM.DEFAULT_FX), tracks: [tr] };
  const out = FM.parseProject(FM.serializeProject(st));
  const o = out.tracks[0];
  check("v2.1 project round-trip pitch fields",
    o.key === 7 && o.scale === "dorian" && o.rootNote === 55 && o.octave === 1 && o.transpose === -3);
  check("v2.1 project round-trip morph fields", o.morph === 65 && o.morphTarget === "wobble");
  check("v2.1 project round-trip tone fields",
    o.tone.cutoff === 1200 && o.tone.resonance === 8 && o.tone.drive === 40 && o.tone.attack === 2 && o.tone.decay === 0.5);
  check("v2.1 serialize stamps format version 3", JSON.parse(FM.serializeProject(st)).version === 4);
  /* backward compatibility: a v2-format file (no new fields) parses to defaults */
  const v2file = JSON.stringify({ app: "FruityMcLoops", version: 2, bpm: 130, swing: 0,
    fx: FM.DEFAULT_FX, tracks: [{ sound: "kick", steps: "x".repeat(64), volume: 0.9, pan: 0, mute: false, solo: false }] });
  const back = FM.parseProject(v2file).tracks[0];
  check("v2.1 v2-format projects load with pitch/morph/tone defaults",
    back.key === 0 && back.scale === "major" && back.rootNote === 48 && back.morph === 0 &&
    back.morphTarget === "" && back.tone.cutoff === 18000 && back.tone.attack === 1);
  const badTarget = FM.parseProject(JSON.stringify({ tracks: [
    { sound: "kick", steps: "x".repeat(64), morphTarget: "not-a-sound" }] }));
  check("v2.1 parseProject drops an invalid morph target", badTarget.tracks[0].morphTarget === "");
}
/* morph/tone execution on the stub ctx */
{
  const fctx = fakeCtx(), dest = fakeNode();
  const chain = FM.buildToneChain(fctx, FM.mkTrack("kick"), dest);
  check("v2.1 buildToneChain returns input/filter/gain",
    !!chain.input && !!chain.filter && !!chain.gain);
  const plain = FM.mkTrack("kick");
  check("v2.1 playTrackSound morph=0 plays", FM.playTrackSound(fctx, dest, 0, plain, null, {}) === true);
  const morphed = FM.mkTrack("kick");
  morphed.morph = 50; morphed.morphTarget = "snare";
  check("v2.1 playTrackSound morph>0 blends both sounds",
    FM.playTrackSound(fctx, dest, 0, morphed, null, {}) === true);
  const toned = FM.mkTrack("kick");
  toned.tone.attack = 3; toned.tone.decay = 0.3;
  check("v2.1 playTrackSound with attack/decay shaping plays",
    FM.playTrackSound(fctx, dest, 0, toned, null, {}) === true);
  const pf = FM.mkTrack("sub");
  check("v2.1 triggerSound accepts pitchFactor opts",
    FM.triggerSound(fctx, dest, 0, "sub", null, { pitchFactor: 2 }) === true);
}

/* ---------- v2.1: stem math ---------- */
check("v2.1 stem full mix is identity",
  JSON.stringify(FM.stemSample(0.8, -0.3, "full")) === JSON.stringify([0.8, -0.3]));
{
  const [l, r] = FM.stemSample(0.8, 0.2, "instrumental");
  check("v2.1 instrumental = (L-R)/2 duplicated", Math.abs(l - 0.3) < 1e-9 && Math.abs(r - 0.3) < 1e-9);
  const [l2, r2] = FM.stemSample(0.8, 0.2, "vocals");
  check("v2.1 vocals = (L+R)/2 duplicated", Math.abs(l2 - 0.5) < 1e-9 && Math.abs(r2 - 0.5) < 1e-9);
  const [l3] = FM.stemSample(0.6, 0.6, "instrumental");
  check("v2.1 centered signal cancels in instrumental mode", Math.abs(l3) < 1e-9);
  const [l4] = FM.stemSample(0.6, 0.6, "vocals");
  check("v2.1 centered signal survives in vocals mode", Math.abs(l4 - 0.6) < 1e-9);
  check("v2.1 stem gains: karaoke inverts the right channel",
    FM.stemGains("instrumental").lr === -0.5 && FM.stemGains("vocals").ll === 0.5);
  /* graph builds on a stub ctx with channel split/merge */
  const fctx2 = Object.assign(fakeCtx(), {
    createChannelSplitter: fakeNode, createChannelMerger: fakeNode });
  const chain = FM.buildStemChain(fctx2, "vocals");
  check("v2.1 buildStemChain returns input/output + setMode",
    !!chain.input && !!chain.output && typeof chain.setMode === "function");
  chain.setMode("instrumental");
  check("v2.1 stem chain exposes all four mixing gains + survives setMode",
    !!chain.gains.ll && !!chain.gains.lr && !!chain.gains.rl && !!chain.gains.rr &&
    typeof chain.gains.lr.gain.setTargetAtTime === "function");
}

/* ---------- v2.1: decks & crossfader ---------- */
check("v2.1 four decks A-D", JSON.stringify(FM.DECK_LETTERS) === JSON.stringify(["A","B","C","D"]));
check("v2.1 crossfader smooth: hard left = L full, R silent",
  Math.abs(FM.crossfaderGain("L", -1) - 1) < 1e-9 && Math.abs(FM.crossfaderGain("R", -1)) < 1e-9);
check("v2.1 crossfader smooth: center is equal power ~0.707",
  Math.abs(FM.crossfaderGain("L", 0) - Math.SQRT1_2) < 1e-3 &&
  Math.abs(FM.crossfaderGain("R", 0) - Math.SQRT1_2) < 1e-3);
check("v2.1 crossfader cut: center keeps both, far side kills",
  FM.crossfaderGain("L", 0, "cut") > 0.49 && FM.crossfaderGain("R", 1, "cut") === 1 &&
  FM.crossfaderGain("L", 1, "cut") === 0);
check("v2.1 crossfader sharp: stays hot past center",
  FM.crossfaderGain("L", 0.5, "sharp") > 0.7 && FM.crossfaderGain("L", -0.5, "sharp") === 1);
check("v2.1 syncRate matches BPM ratio", FM.syncRate(128, 64) === 2 && FM.syncRate(120, 120) === 1);
check("v2.1 syncRate needs both BPMs", FM.syncRate(0, 120) === null && FM.syncRate(120, 0) === null);
check("v2.1 syncRate clamps", FM.syncRate(200, 50) === 2 && FM.syncRate(50, 200) === 0.5);
check("v2.1 deck UI is generated (4 decks, crossfader, play all)",
  html.includes('id="decksWrap"') && html.includes("buildDeckUI") &&
  html.includes('id="xfader"') && html.includes('id="playAllBtn"') && html.includes('id="stopAllBtn"'));
check("v2.1 pitch & scale panel + piano exist",
  html.includes('id="labTrackSel"') && html.includes('id="pianoWrap"') &&
  html.includes('id="labKey"') && html.includes('id="labScale"') && html.includes("pianoTap"));
check("v2.1 morph & tone controls exist",
  html.includes('id="labMorph"') && html.includes('id="labMorphTarget"') &&
  html.includes('id="labCutoff"') && html.includes('id="labAttack"') && html.includes('id="labDecay"'));
check("v2.1 stem UI + honest help text",
  html.includes("Vocals Only") && html.includes("karaoke") &&
  html.includes("not AI separation") && html.includes("Download stem") === false &&
  html.includes("downloadDeckStem"));

/* ---------- v2.1 DJ: settings, EQ, FX registry, loop/tap math ---------- */
check("v2.1 DJ settings defaults",
  FM.DEFAULT_DJ_SETTINGS.xfCurve === "smooth" && FM.DEFAULT_DJ_SETTINGS.pitchRange === 16 &&
  FM.DEFAULT_DJ_SETTINGS.quantize === true && FM.DEFAULT_DJ_SETTINGS.limiter === true);
check("v2.1 sanitizeDJSettings keeps valid + repairs junk",
  FM.sanitizeDJSettings({ xfCurve: "cut", pitchRange: 50, quantize: false, limiter: false }).xfCurve === "cut" &&
  FM.sanitizeDJSettings({ xfCurve: "wild", pitchRange: 33 }).xfCurve === "smooth" &&
  FM.sanitizeDJSettings({ xfCurve: "wild", pitchRange: 33 }).pitchRange === 16 &&
  FM.sanitizeDJSettings(null).quantize === true);
check("v2.1 settings storage key is stable", FM.DJ_SETTINGS_KEY === "fm_dj_settings_v1");
check("v2.1 settings persist via localStorage in app code",
  html.includes("localStorage.setItem(DJ_SETTINGS_KEY") && html.includes('id="djXfCurve"') &&
  html.includes('id="djQuantize"') && html.includes('id="djLimiter"'));
check("v2.1 EQ: center is 0 dB, boost is +24 max",
  FM.eqDbFromSlider(0) === 0 && Math.abs(FM.eqDbFromSlider(50) - 24) < 1e-9);
check("v2.1 EQ: bottom of travel is a full kill",
  FM.eqDbFromSlider(-50) <= -40 && FM.isEqKill(-50) === true && FM.isEqKill(-49) === false);
check("v2.1 deck FX registry has the dubstep core set",
  ["filter","echo","reverb","wobble","crush","flanger"].every(id => FM.DECK_FX_IDS.includes(id)));
check("v2.1 wobble divisions include dotted + triplet",
  FM.divisionBeats("1/8d") === 0.75 && Math.abs(FM.divisionBeats("1/8t") - 1/3) < 1e-9 &&
  FM.divisionBeats("1/4") === 1 && FM.divisionBeats("1/2") === 2);
check("v2.1 wobbleHz: 140 BPM quarter-note cycle = 2.33 Hz",
  Math.abs(FM.wobbleHz(140, "1/4") - 140 / 60) < 1e-9);
check("v2.1 wobbleHz: 140 BPM 1/8 = double rate",
  Math.abs(FM.wobbleHz(140, "1/8") - 2 * 140 / 60) < 1e-9);
check("v2.1 echoSeconds: dotted quarter at 120 = 0.75s",
  Math.abs(FM.echoSeconds(120, "1/4d") - 0.75) < 1e-9);
check("v2.1 beatSeconds", Math.abs(FM.beatSeconds(120) - 0.5) < 1e-9);
check("v2.1 autoLoopEnd: 4 beats at 120 from 1.0 = 3.0",
  Math.abs(FM.autoLoopEnd(1.0, 4, 120, 100) - 3.0) < 1e-9);
check("v2.1 autoLoopEnd clamps to song end", FM.autoLoopEnd(9.0, 8, 120, 10) === 10);
check("v2.1 clampLoopRegion keeps a sane region",
  FM.clampLoopRegion(-5, 999, 10).start === 0 && FM.clampLoopRegion(-5, 999, 10).end === 10 &&
  FM.clampLoopRegion(5, 5, 10).end > FM.clampLoopRegion(5, 5, 10).start);
check("v2.1 quantizeTime snaps to the beat grid",
  Math.abs(FM.quantizeTime(1.24, 120, 0) - 1.0) < 1e-9 &&
  Math.abs(FM.quantizeTime(1.26, 120, 0) - 1.5) < 1e-9 &&
  FM.quantizeTime(1.24, 0, 0) === 1.24);
check("v2.1 calcTapBpm from 500ms taps = 120",
  FM.calcTapBpm([0, 500, 1000, 1500]) === 120 && FM.calcTapBpm([0]) === null);
check("v2.1 pitchFaderRate maps slider through range",
  FM.pitchFaderRate(0, 16) === 1 && Math.abs(FM.pitchFaderRate(100, 16) - 1.16) < 1e-9 &&
  Math.abs(FM.pitchFaderRate(-100, 50) - 0.5) < 1e-9);
check("v2.1 deck UI includes EQ, hot cues, loops, tap, brake",
  html.includes("cuePad") && html.includes("hotCuePress") && html.includes("setAutoLoop") &&
  html.includes("calcTapBpm") && html.includes("BRAKE") && html.includes("SPINBACK") &&
  html.includes("eqLow") && html.includes("buildDeckFx"));
check("v2.1 master recording wired to Downloads",
  html.includes('id="recMixBtn"') && html.includes("createMediaStreamDestination") &&
  html.includes("MediaRecorder") && html.includes("toggleMixRec"));
check("v2.1 hot cue storage shape: 4 slots, null or seconds",
  JSON.stringify(FM.defaultHotCues()) === "[null,null,null,null]" &&
  JSON.stringify(FM.sanitizeHotCues([1.5, -2, "x", 30], 10)) === "[1.5,null,null,null]" &&
  FM.sanitizeHotCues([2, 3], 10)[1] === 3);

/* ---------- v2.1 sampling: URL validation, slice math, naming ---------- */
check("v2.1 validateSampleUrl accepts a direct audio file",
  FM.validateSampleUrl("https://example.com/loops/kick.mp3").ok === true &&
  FM.validateSampleUrl("https://example.com/a/break.wav?dl=1").ok === true);
check("v2.1 validateSampleUrl rejects streaming pages",
  FM.validateSampleUrl("https://www.youtube.com/watch?v=abc").ok === false &&
  FM.validateSampleUrl("https://soundcloud.com/x/y").ok === false);
check("v2.1 validateSampleUrl rejects non-http + non-audio",
  FM.validateSampleUrl("ftp://x.com/a.mp3").ok === false &&
  FM.validateSampleUrl("https://x.com/page.html").ok === false &&
  FM.validateSampleUrl("").ok === false);
check("v2.1 validateSampleUrl explains itself",
  /direct audio/.test(FM.validateSampleUrl("https://youtu.be/abc").reason));
check("v2.1 sliceRange clamps to the buffer",
  FM.sliceRange(-5, 999, 30).start === 0 && FM.sliceRange(-5, 999, 30).end === 30 &&
  FM.sliceRange(12.5, 16.25, 30).start === 12.5 && FM.sliceRange(12.5, 16.25, 30).end === 16.25);
check("v2.1 sliceRange enforces a minimum slice",
  FM.sliceRange(10, 10, 30).end - FM.sliceRange(10, 10, 30).start >= 0.05);
check("v2.1 deckSampleName format",
  FM.deckSampleName("A", 12, 16.4) === "Deck A sample 0:12–0:16" &&
  FM.deckSampleName("C", 65, 69).startsWith("Deck C sample 1:05"));
check("v2.1 sampling UI exists (mic, URL, deck chop)",
  html.includes('id="micRecBtn"') && html.includes('id="sampleUrl"') &&
  html.includes("grabSampleUrl") && html.includes("getUserMedia") &&
  html.includes("chopDeckSample") && html.includes("addCustomSound"));
check("v2.1 Android wrapper grants mic to the page",
  fs.readFileSync(path.join(__dirname, "..", "manual-build", "android", "app", "src", "main", "AndroidManifest.xml"), "utf8")
    .includes("RECORD_AUDIO") &&
  fs.readFileSync(path.join(__dirname, "..", "manual-build", "android", "app", "src", "main", "java", "com", "delukz", "fruitymcloops", "MainActivity.java"), "utf8")
    .includes("onPermissionRequest"));
check("v2.2 version text present", html.includes("v2.2"));

/* ---------- v2.2: loop bars, bar tools, channel strips, new sounds & FX ---------- */
check("v2.2 loop bar options are 1/2/3/4/6/8",
  JSON.stringify(FM.LOOP_BARS_OPTIONS) === JSON.stringify([1, 2, 3, 4, 6, 8]));
check("v2.2 grid is 8 bars / 128 steps",
  FM.MAX_BARS === 8 && FM.MAX_STEPS === 128 && FM.STEPS_PER_BAR === 16);
check("v2.2 sanitizeLoopBars keeps valid, defaults junk to 4",
  FM.sanitizeLoopBars(1) === 1 && FM.sanitizeLoopBars(8) === 8 &&
  FM.sanitizeLoopBars(5) === 4 && FM.sanitizeLoopBars(0) === 4 && FM.sanitizeLoopBars("x") === 4);
check("v2.2 loopStepsFor", FM.loopStepsFor(1) === 16 && FM.loopStepsFor(4) === 64 && FM.loopStepsFor(8) === 128);
check("v2.2 stepInLoop / barOfStep",
  FM.stepInLoop(15, 1) === true && FM.stepInLoop(16, 1) === false &&
  FM.stepInLoop(127, 8) === true && FM.barOfStep(0) === 0 && FM.barOfStep(127) === 7);
{
  const base = FM.pattern("x...x...x...x...", "................", "................", "................");
  const copied = FM.copyBarSteps(base, 0, 3);
  check("v2.2 copyBarSteps copies bar 1 into bar 4",
    copied[48] === true && copied[52] === true && copied[49] === false);
  check("v2.2 copyBarSteps does not mutate the input",
    base[48] === false && base[0] === true);
  const cleared = FM.clearBarSteps(copied, 0);
  check("v2.2 clearBarSteps clears only that bar",
    cleared[0] === false && cleared[48] === true);
  const filled = FM.fillLoopFromBar(base, 0, 8);
  check("v2.2 fillLoopFromBar fills all 8 bars from bar 1",
    filled[16] === true && filled[112] === true && filled[127] === false);
  const filled2 = FM.fillLoopFromBar(base, 0, 2);
  check("v2.2 fillLoopFromBar respects the loop length",
    filled2[16] === true && filled2[32] === false);
}
/* channel strip model */
{
  const tr = FM.mkTrack("kick");
  check("v2.2 mkTrack steps are 128", tr.steps.length === 128);
  check("v2.2 mkTrack channel defaults are neutral",
    tr.chan.eqLow === 0 && tr.chan.eqMid === 0 && tr.chan.eqHigh === 0 &&
    tr.chan.delaySend === 0 && tr.chan.reverbSend === 0);
  check("v2.2 sanitizeChannel clamps junk",
    FM.sanitizeChannel({ eqLow: -99 }).eqLow === -50 &&
    FM.sanitizeChannel({ delaySend: 250 }).delaySend === 100 &&
    FM.sanitizeChannel(null).reverbSend === 0);
  tr.chan = { eqLow: -30, eqMid: 12, eqHigh: 40, delaySend: 35, reverbSend: 65 };
  tr.transpose = 5;
  const st = { bpm: 140, swing: 0, loopBars: 8, fx: Object.assign({}, FM.DEFAULT_FX), tracks: [tr] };
  const out = FM.parseProject(FM.serializeProject(st));
  check("v2.2 project round-trip loopBars", out.loopBars === 8);
  check("v2.2 project round-trip channel strip",
    out.tracks[0].chan.eqLow === -30 && out.tracks[0].chan.eqMid === 12 &&
    out.tracks[0].chan.eqHigh === 40 && out.tracks[0].chan.delaySend === 35 &&
    out.tracks[0].chan.reverbSend === 65);
  check("v2.2 serialize stamps format version 4",
    JSON.parse(FM.serializeProject(st)).version === 4);
  /* backward compatibility: a v3 file (64-char steps, no loopBars/chan) */
  const v3file = JSON.stringify({ app: "FruityMcLoops", version: 3, bpm: 130, swing: 0,
    fx: FM.DEFAULT_FX, tracks: [{ sound: "kick", steps: "x".repeat(64), volume: 0.9, pan: 0, mute: false, solo: false }] });
  const back = FM.parseProject(v3file);
  check("v2.2 v3 projects load with loop/channel defaults + padded steps",
    back.loopBars === 4 && back.tracks[0].steps.length === 128 &&
    back.tracks[0].steps[0] === true && back.tracks[0].steps[100] === false &&
    back.tracks[0].chan.delaySend === 0 && back.tracks[0].chan.eqMid === 0);
}
/* channel chain: EQ + sends build and update on the stub ctx */
{
  const fctx = fakeCtx(), dest = fakeNode();
  const buses = FM.buildSeqFxBuses(fctx, dest);
  check("v2.2 buildSeqFxBuses returns delay + reverb inputs",
    !!buses.delay && !!buses.reverb && !!buses.delayNode && !!buses.conv);
  const tr = FM.mkTrack("snare");
  tr.chan.delaySend = 50; tr.chan.reverbSend = 25; tr.chan.eqLow = -50;
  const chain = FM.buildToneChain(fctx, tr, dest, { delay: buses.delay, reverb: buses.reverb });
  check("v2.2 buildToneChain exposes EQ + send nodes",
    !!chain.eqLow && !!chain.eqMid && !!chain.eqHigh && !!chain.delaySend && !!chain.reverbSend);
  check("v2.2 channel EQ kill reaches the chain",
    chain.eqLow.gain.value === FM.eqDbFromSlider(-50));
  tr.chan.delaySend = 80;
  FM.applyChannelToChain(chain, tr);
  check("v2.2 applyChannelToChain updates sends live",
    Math.abs(chain.delaySend.gain.value - 0.8) < 1e-9);
  check("v2.2 playTrackSound through a channel chain plays",
    FM.playTrackSound(fctx, chain.input, 0, tr, null, {}) === true);
  const noSends = FM.buildToneChain(fctx, FM.mkTrack("kick"), dest);
  check("v2.2 buildToneChain without sends still works",
    !!noSends.input && noSends.delaySend === null);
}
/* new sounds */
check("v2.2 exactly 30 new sounds in NEW_SOUNDS_V22",
  Object.keys(FM.NEW_SOUNDS_V22).length === 30,
  "got " + Object.keys(FM.NEW_SOUNDS_V22).length);
check("v2.2 total registry >= 105 sounds", FM.SOUND_NAMES.length >= 105, "got " + FM.SOUND_NAMES.length);
Object.keys(FM.NEW_SOUNDS_V22).forEach(n =>
  check("v2.2 new sound registered + categorized: " + n,
    !!FM.SOUNDS[n] && FM.SOUND_CATEGORIES.includes(FM.SOUNDS[n].cat)));
["Drums", "Bass", "Synths", "Pads", "Keys", "FX"].forEach(c =>
  check("v2.2 category grew or held (>= 6): " + c,
    FM.SOUND_NAMES.filter(n => FM.SOUNDS[n].cat === c).length >= 6,
    "count=" + FM.SOUND_NAMES.filter(n => FM.SOUNDS[n].cat === c).length));
/* new effects */
check("v2.2 deck FX registry adds phaser/gate/ringmod/chorus",
  ["phaser", "gate", "ringmod", "chorus"].every(id => FM.DECK_FX_IDS.includes(id)));
check("v2.2 master FX defaults include gate + phaser at 0",
  FM.DEFAULT_FX.gate === 0 && FM.DEFAULT_FX.phaser === 0);
check("v2.2 master FX UI has gate, phaser + restored deck volume",
  html.includes('id="fxGate"') && html.includes('id="fxPhaser"') &&
  html.includes('id="deckVol"') && html.includes('id="deckVolVal"'));
check("v2.2 loop UI exists (selector, info, bar tools)",
  html.includes('id="loopBarsSel"') && html.includes('id="loopInfo"') &&
  html.includes('id="copyBarBtn"') && html.includes('id="fillLoopBtn"') && html.includes('id="clearBarBtn"'));
check("v2.2 mixer UI exists (strips, returns, folders)",
  html.includes('id="mixerStrips"') && html.includes("renderMixer") &&
  html.includes('id="mixDelayRet"') && html.includes('id="mixReverbRet"') &&
  html.includes("setupFolders") && html.includes('data-fold="closed"') &&
  html.includes("openChannelStrip") && html.includes('id="jumpNav"') &&
  html.includes('id="statusBar"'));
check("v2.2 sequencer schedules against the variable loop",
  html.includes("loopStepsFor(loopBars)") && html.includes("outLoop"));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
