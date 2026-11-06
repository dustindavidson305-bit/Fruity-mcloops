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
    check("preset " + pname + " row is 64 steps (" + tr.sound + ")", tr.steps.length === 64);
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
check("pattern() builds 64 steps", pat.length === 64);
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
check("project steps stored as 64-char strings",
  parsed.tracks.every(t => typeof t.steps === "string" && t.steps.length === 64));
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

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
