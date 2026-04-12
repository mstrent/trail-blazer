# Design: Boss Music, Victory Fanfare, and Alpine Lakes Filter Fix

**Issues:** #88 (bug), #90 (enhancement)
**Date:** 2026-04-11
**Files modified:** `game.js`, `LEVEL_DESIGN.md`

---

## Issue #88 — Alpine Lakes Water Filter Floating Above Water

### Problem

`makeItem('filter', 85, 6)` in Alpine Lakes (Level 4) places the filter over Lake 2 (columns 79–90). `makeItem`'s terrain-snap scans downward from row 6, finds row 11 empty (cleared by `fill(79,11,90,11,T_EMPTY)`), and stops there — one row above the water at rows 12–13. The item ends up floating visually above the lake surface.

Note: `makeTPBloom` already has an explicit guard that rejects placement above water. `makeItem` has no such guard.

### Fix

Move the spawn to `makeItem('filter', 75, 5)`. Column 75 is on `hline(72,77,6,T_PLATFORM)`, the granite slab platform just before Lake 2. The terrain-snap places the filter on top of that platform — thematically appropriate (a hiker would rest their filter near a lake, not in it).

No other code changes required; `makeItem` handles the snap automatically.

### Lesson Documented in LEVEL_DESIGN.md

Add a warning to the items section: **never spawn items at tile columns that fall entirely over a lake or water section.** `makeItem`'s terrain-snap treats the empty gap row above water as valid ground (unlike `makeTPBloom`, which explicitly rejects that position). Always verify that the column has a platform or solid tile somewhere below it before the water begins.

---

## Issue #90 — Boss Battle Music and Longer Victory Fanfare

### Overview

- Add looping, tense/ominous background music during each boss fight — three distinct tracks, one per boss
- Replace the short `sfxCampFanfare()` played at boss defeat with a longer, triumphant `sfxBossVictory()` (~3–4 seconds)

### Audio Loop Architecture

Uses the standard Web Audio look-ahead looping pattern:

1. Each boss has a **phrase** — an array of `[waveType, freq, offset, duration, gain]` tuples with offsets relative to `ctx.currentTime`
2. `playBossMusic(phraseArray, phraseDuration)` schedules all notes in the phrase, then calls `setTimeout` to fire 300ms before the phrase ends and re-enter itself
3. A module-level `bossMusicActive` boolean controls loop continuation — setting it to `false` lets the current phrase finish and stops re-entry cleanly
4. A `bossMusicTimeout` handle allows `clearTimeout` on immediate stop (e.g. player death mid-phrase)

**New module-level state inside the `audio` IIFE:**
```js
let bossMusicActive = false;
let bossMusicTimeout = null;
```

**New exported functions:**
- `startBossMusic(bossType)` — sets `bossMusicActive = true`, selects the correct phrase, calls `playBossMusic`
- `stopBossMusic()` — sets `bossMusicActive = false`, clears `bossMusicTimeout`
- `sfxBossVictory()` — plays the 3–4 second triumph fanfare

### Three Boss Tracks

**Thunderbird (~6s phrase)**
Character: High sustained tones with slow pitch sweeps, occasional sharp transient — aerial, electric, like lightning building overhead. Sparse — long note durations, wide frequency range, low note density.
Instrumentation: `sine` for sustained drones, `oscSweep` for slow descending sweeps, brief `sawtooth` transient bursts for lightning crackle.

**Mothman (~8s phrase)**
Character: Slow hypnotic minor-key bass pulse with a chromatic melodic figure floating on top — gliding, unsettling, almost trance-like. The longer loop length makes it feel non-mechanical.
Instrumentation: `sine` low bass notes at regular intervals, `triangle` for the chromatic melody line above.

**Bigfoot (~5s phrase)**
Character: Deep low rumble with a heavy rhythmic pattern — ground-pound energy, almost percussive. Short loop drives urgency.
Instrumentation: Low-frequency `sawtooth` for the rumble, filtered `noise` bursts for stomping impacts, `sine` sub-bass.

### Victory Fanfare (sfxBossVictory, ~3–4s)

Three-beat structure:
1. **Ascending run (0–0.8s):** 4-note climb, `sawtooth` lead with `triangle` harmony underneath — bright and sharp
2. **Swelling chord (0.8–2.3s):** Major triad held with harmonics — `triangle` lead, `sine` octave below — builds to a peak
3. **Final accent (2.3–3.5s):** High note hit with hard attack, long decay — `sawtooth` with `sine` sub — the punctuation mark

This replaces the normal `sfxCampFanfare()` call in `bossDefeated()`.

### Integration Points

| Location | Line | Change |
|---|---|---|
| `initBossArena(def)` | ~1058 | Add `audio.startBossMusic(def.bossType)` |
| `bossDefeated()` | ~1831 | Replace `audio.sfxCampFanfare()` with `audio.stopBossMusic(); audio.sfxBossVictory();` |
| `hurtPlayer()` — game-over branch | ~2342 | Add `audio.stopBossMusic()` before `game.state = 'gameover'` |

`stopBossMusic()` is a no-op when no boss music is playing, so calling it unconditionally in `hurtPlayer()` is safe for all game-overs including non-boss levels. On respawn with lives remaining (line ~2345), no stop call is made — music continues through the boss fight.

### What Is Not Changing

- No looping music on regular (non-boss) levels
- No per-boss variation in the victory fanfare — one shared triumph tune for all three
- No audio files — all synthesis remains procedural Web Audio API
