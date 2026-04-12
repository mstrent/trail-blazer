# Boss Music, Victory Fanfare, and Alpine Lakes Filter Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the floating water filter in Alpine Lakes (#88), add tense looping boss-battle music for each of the three cryptid bosses, and replace the short boss-defeat fanfare with a longer triumphant one (#90).

**Architecture:** All changes are isolated to `game.js` and `LEVEL_DESIGN.md`. The filter fix is a one-line spawn relocate. The boss music uses the Web Audio look-ahead loop pattern: each boss has a phrase function that schedules notes relative to a `t0`, a `setTimeout` fires 300ms before the phrase ends to reschedule, and a `bossMusicActive` flag stops re-entry. `oscSweep` gets a `startTime` parameter (matching `osc`'s existing API) and a new `scheduleNoise` helper is added for Bigfoot's rhythmic stomps.

**Tech Stack:** Vanilla JS, Web Audio API, Canvas 2D. No build step. Verify in browser at `http://localhost:3000` or via Playwright QA (`cd qa && node runner.mjs scenarios/<name>.mjs`).

---

## Files Modified

- `game.js` — all code changes
- `LEVEL_DESIGN.md` — add item-above-water warning

---

### Task 1: Create branch and fix Alpine Lakes filter position (#88)

**Files:**
- Modify: `game.js:369` (spawnItems for Level 4)
- Modify: `LEVEL_DESIGN.md` (Object Placement Rules section, after line ~234)

**Context:** `makeItem('filter', 85, 6)` in Alpine Lakes is over Lake 2 (cols 79–90). `makeItem`'s terrain-snap scans down from row 6, finds row 11 empty (cleared by `fill(79,11,90,11,T_EMPTY)`), and stops there — one row above the water tiles at rows 12–13. The filter hovers above the lake. Moving to column 75 puts it on `hline(72,77,6,T_PLATFORM)`, the granite slab before the lake.

- [ ] **Step 1: Create branch**

```bash
git checkout master && git pull
git checkout -b issue-88-90-boss-music-filter-fix
```

- [ ] **Step 2: Move the filter spawn**

In `game.js`, find Level 4's `spawnItems()` (around line 366). The current code:

```js
    spawnItems() {
      return [
        makeItem('bar', 9, 8), makeItem('spork', 60, 5),
        makeItem('filter', 85, 6),
        makeItem('spray', 109, 5), makeItem('tent', 159, 5),
      ];
    },
```

Change to:

```js
    spawnItems() {
      return [
        makeItem('bar', 9, 8), makeItem('spork', 60, 5),
        makeItem('filter', 75, 5),
        makeItem('spray', 109, 5), makeItem('tent', 159, 5),
      ];
    },
```

- [ ] **Step 3: Update LEVEL_DESIGN.md**

In `LEVEL_DESIGN.md`, find the **Object Placement Rules** section (around line 214). After the paragraph that ends with `"Without it, objects will float in mid-air, render inside boulders, or appear below the visible ground."` and before the `---` separator, add:

```markdown
### Item spawns above water (pit-style lakes)

`makeItem`'s terrain-snap treats the empty gap row directly above water as a
valid surface — it stops scanning down when `level.map[placeTy + 1][tx]` is
`T_WATER`. This means an item spawned at any column that falls entirely over a
**pit-style lake** (no solid bridge floor, e.g. Alpine Lakes) will appear
floating in mid-air above the water surface.

**Rule:** Never call `makeItem` at a tile column that lies inside a pit-style
water zone (see "Gorge-style vs. pit-style water zones" above). Always use a
column with a platform or solid tile above the water line. `makeTPBloom`
already rejects this placement explicitly — `makeItem` does not.

**Known instance fixed:** Alpine Lakes Level 4 — `makeItem('filter', 85, 6)`
moved to `makeItem('filter', 75, 5)` (column 75 sits on the granite slab
platform `hline(72,77,6,T_PLATFORM)` just before Lake 2).
```

- [ ] **Step 4: Verify in browser**

Start server (`python -m http.server 3000`), open `http://localhost:3000`. In DevTools console:

```js
window.trailBlazerDebug.warpToLevel(4); // Alpine Lakes is LEVELS index 4
```

Scroll to ~50% of the level (around the second lake). The water filter should now appear on the granite slab before Lake 2, not hovering above the water. Pick it up to confirm it's collectible and awards points.

- [ ] **Step 5: Commit**

```bash
git add game.js LEVEL_DESIGN.md
git commit -m "fix: move Alpine Lakes filter off lake to granite slab (#88)

Filter was terrain-snapping to the empty row above Lake 2 water tiles,
causing it to float visually above the lake. Moved to column 75 which
sits on the solid platform before the lake.

Adds item-above-water warning to LEVEL_DESIGN.md.

closes #88"
```

---

### Task 2: Add `oscSweep` time parameter and `scheduleNoise` helper

**Files:**
- Modify: `game.js:4811` (`oscSweep` definition)
- Modify: `game.js:4824` (after `noise` function, add `scheduleNoise`)

**Context:** `oscSweep` currently uses `ctx.currentTime` and ignores any passed time, making it unusable for scheduled sequences. `osc` already has a `startTime` parameter — we're bringing `oscSweep` into parity. `scheduleNoise` is a scheduled variant of `noise` needed for Bigfoot's stomp hits.

- [ ] **Step 1: Add `startTime` parameter to `oscSweep`**

Find `oscSweep` at line ~4811:

```js
  function oscSweep(type, freqFrom, freqTo, dur, gainVal, dest) {
    const t = ctx.currentTime;
```

Change to:

```js
  function oscSweep(type, freqFrom, freqTo, dur, gainVal, dest, startTime) {
    const t = startTime !== undefined ? startTime : ctx.currentTime;
```

No other changes to `oscSweep` — the rest of the function already uses `t`.

- [ ] **Step 2: Add `scheduleNoise` after the `noise` function**

Find the `noise` function (line ~4824) and its closing `}`. Immediately after it, insert:

```js
  function scheduleNoise(dur, gainVal, filterFreq, startTime) {
    const t = startTime !== undefined ? startTime : ctx.currentTime;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = filterFreq || 1000; f.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(masterGain);
    src.start(t); src.stop(t + dur);
  }
```

- [ ] **Step 3: Verify existing SFX still work**

Open the game in a browser. Play through level 1 briefly — confirm jump, stomp, collect, hurt, water, bear spray, glissade sounds all fire normally. No console errors.

---

### Task 3: Add boss music loop infrastructure

**Files:**
- Modify: `game.js` — audio IIFE (after the `sfx()` wrapper function, around line 4842)

**Context:** The loop uses a `bossMusicActive` flag and a `bossMusicTimeout` handle. `playBossMusic(phraseFn, phraseDur)` schedules notes and re-queues itself 300ms before the phrase ends. `startBossMusic(bossType)` and `stopBossMusic()` are the public API.

- [ ] **Step 1: Add state variables to the audio IIFE**

Find the `sfx` wrapper function (around line 4842):

```js
  function sfx(fn) {
    ensureRunning().then(fn).catch(() => {});
  }
```

Immediately before it, add:

```js
  let bossMusicActive = false;
  let bossMusicTimeout = null;
```

- [ ] **Step 2: Add the loop engine and public functions**

After all the `sfx*` functions (after `sfxTrailRunner`, around line 4924) and before the `return {` statement, insert:

```js
  // ---- boss music loop engine ----

  function playBossMusic(phraseFn, phraseDur) {
    if (!bossMusicActive) return;
    phraseFn(ctx.currentTime);
    bossMusicTimeout = setTimeout(
      () => playBossMusic(phraseFn, phraseDur),
      (phraseDur - 0.3) * 1000
    );
  }

  function startBossMusic(bossType) {
    stopBossMusic();
    bossMusicActive = true;
    const tracks = {
      thunderbird: { fn: thunderbirdPhrase, dur: 6.0 },
      mothman:     { fn: mothmanPhrase,     dur: 8.0 },
      bigfoot:     { fn: bigfootPhrase,     dur: 5.0 },
    };
    const track = tracks[bossType];
    if (!track) return;
    sfx(() => playBossMusic(track.fn, track.dur));
  }

  function stopBossMusic() {
    bossMusicActive = false;
    if (bossMusicTimeout !== null) {
      clearTimeout(bossMusicTimeout);
      bossMusicTimeout = null;
    }
  }
```

- [ ] **Step 3: Export the new functions**

Find the `return {` at line ~4950:

```js
  return {
    init,
    sfxJump, sfxStomp, sfxCollect, sfxHurt, sfxWater, sfxSpray, sfxBonus,
    sfxGlissade, sfxStun, sfxHeal, sfxStartJingle, sfxCampFanfare, sfxWinFanfare,
    sfxBeerCan, sfxBeerCanHit, sfxTPBloom, sfxTrailRunner,
  };
```

Change to:

```js
  return {
    init,
    sfxJump, sfxStomp, sfxCollect, sfxHurt, sfxWater, sfxSpray, sfxBonus,
    sfxGlissade, sfxStun, sfxHeal, sfxStartJingle, sfxCampFanfare, sfxWinFanfare,
    sfxBeerCan, sfxBeerCanHit, sfxTPBloom, sfxTrailRunner,
    startBossMusic, stopBossMusic,
  };
```

Note: `sfxBossVictory` will be added to this list in Task 6.

- [ ] **Step 4: Verify no console errors**

Reload the game. Open DevTools console. No errors. The new exports are accessible: `typeof audio.startBossMusic === 'function'` should log `true` in the console.

---

### Task 4: Add Thunderbird phrase

**Files:**
- Modify: `game.js` — audio IIFE (add phrase function before `playBossMusic`)

**Context:** Thunderbird feel — high sustained tones, slow descending sweeps like a bird circling, sharp sawtooth crackles for lightning. Sparse note density. Key: open E (no third, ambiguous/ominous).

- [ ] **Step 1: Insert `thunderbirdPhrase` before `playBossMusic`**

Find the `// ---- boss music loop engine ----` comment added in Task 3. Immediately before it, insert:

```js
  // ---- boss music phrases ----

  function thunderbirdPhrase(t0) {
    // Low E drone throughout
    osc('sine', 82.4,  6.0, 0.07, masterGain, t0);         // E2 bass drone
    osc('sine', 164.8, 6.0, 0.04, masterGain, t0);         // E3 octave, faint
    // High descending sweep — bird circling down
    oscSweep('sine', 990, 440, 2.5, 0.06, masterGain, t0 + 0.2);
    // Eerie mid tone
    osc('triangle', 330, 0.8, 0.06, masterGain, t0 + 1.5); // E4
    // Lightning crackle — sharp transient
    osc('sawtooth', 1320, 0.08, 0.04, masterGain, t0 + 2.0);
    // Second sweep — another pass
    oscSweep('sine', 880, 330, 2.0, 0.05, masterGain, t0 + 2.8);
    // Mid tone
    osc('triangle', 220, 0.6, 0.06, masterGain, t0 + 3.5); // A3
    // Second crackle
    osc('sawtooth', 1100, 0.10, 0.04, masterGain, t0 + 4.2);
    // Final sweep — leads back into loop
    oscSweep('sine', 660, 165, 1.4, 0.05, masterGain, t0 + 4.5);
  }
```

- [ ] **Step 2: Verify Thunderbird music in browser**

In DevTools console:
```js
audio.startBossMusic('thunderbird');
```
You should hear a looping tense ambient piece: low drone, slow high-to-low sweeps, occasional sharp crackle. Let it run for ~15 seconds to confirm it loops seamlessly (no gap, no re-trigger pop). Then:
```js
audio.stopBossMusic();
```
Confirm sound stops cleanly.

---

### Task 5: Add Mothman phrase

**Files:**
- Modify: `game.js` — audio IIFE (add phrase function after `thunderbirdPhrase`)

**Context:** Mothman feel — slow hypnotic minor-key bass pulse (D minor, i–v–bVI–iv), chromatic floating melody above. 8-second phrase makes it feel non-mechanical.

- [ ] **Step 1: Insert `mothmanPhrase` after `thunderbirdPhrase`**

```js
  function mothmanPhrase(t0) {
    // Bass pulse: i – v – bVI – iv in D minor
    osc('sine', 73.4,  1.3, 0.11, masterGain, t0 + 0.0); // D2 (i)
    osc('sine', 110.0, 1.3, 0.10, masterGain, t0 + 2.0); // A2 (v)
    osc('sine', 116.5, 1.3, 0.10, masterGain, t0 + 4.0); // Bb2 (bVI)
    osc('sine', 98.0,  1.3, 0.09, masterGain, t0 + 6.0); // G2 (iv)
    // Chromatic melodic figure — floats and descends
    osc('triangle', 293.7, 0.7, 0.06, masterGain, t0 + 0.5); // D4
    osc('triangle', 311.1, 0.5, 0.05, masterGain, t0 + 1.2); // Eb4 (chromatic)
    osc('triangle', 293.7, 0.6, 0.06, masterGain, t0 + 2.5); // D4
    osc('triangle', 329.6, 0.7, 0.06, masterGain, t0 + 3.2); // E4
    osc('triangle', 311.1, 0.5, 0.05, masterGain, t0 + 4.2); // Eb4 (return)
    osc('triangle', 293.7, 0.6, 0.06, masterGain, t0 + 5.0); // D4
    osc('triangle', 261.6, 0.8, 0.06, masterGain, t0 + 5.8); // C4 (descend)
    osc('triangle', 246.9, 0.9, 0.06, masterGain, t0 + 6.8); // B3 (deeper)
  }
```

- [ ] **Step 2: Verify Mothman music in browser**

```js
audio.startBossMusic('mothman');
```
You should hear slow bass pulses on a minor chord progression with a chromatic melody weaving above. 8-second loop. Confirm seamless loop. Then `audio.stopBossMusic()`.

---

### Task 6: Add Bigfoot phrase and `sfxBossVictory`

**Files:**
- Modify: `game.js` — audio IIFE (add `bigfootPhrase` and `sfxBossVictory`, export `sfxBossVictory`)

**Context:** Bigfoot feel — deep sub-bass + percussive stomp pattern using `scheduleNoise`. 5-second loop drives urgency. Victory fanfare is 3 parts: ascending sawtooth run → swelling triangle chord → sharp final accent.

- [ ] **Step 1: Insert `bigfootPhrase` after `mothmanPhrase`**

```js
  function bigfootPhrase(t0) {
    // Continuous sub-bass rumble
    osc('sawtooth', 41.2, 5.0, 0.08, masterGain, t0);    // E1

    // Rhythmic stomp pattern
    scheduleNoise(0.08, 0.16, 180, t0 + 0.0);
    osc('sawtooth', 41.2, 0.2, 0.10, masterGain, t0 + 0.0);  // beat 1 — E1
    scheduleNoise(0.06, 0.10, 180, t0 + 0.6);
    osc('sawtooth', 55.0, 0.2, 0.09, masterGain, t0 + 0.6);  // beat 2 — A1
    scheduleNoise(0.10, 0.18, 160, t0 + 1.0);
    osc('sawtooth', 41.2, 0.2, 0.12, masterGain, t0 + 1.0);  // beat 3 (heavy)
    scheduleNoise(0.06, 0.10, 180, t0 + 1.5);
    osc('sawtooth', 36.7, 0.2, 0.08, masterGain, t0 + 1.5);  // beat 4 — D1
    scheduleNoise(0.10, 0.18, 160, t0 + 2.0);
    osc('sawtooth', 41.2, 0.3, 0.14, masterGain, t0 + 2.0);  // beat 5 (loudest)
    scheduleNoise(0.06, 0.08, 200, t0 + 2.6);
    scheduleNoise(0.10, 0.18, 160, t0 + 3.0);
    osc('sawtooth', 41.2, 0.2, 0.12, masterGain, t0 + 3.0);  // beat 7
    scheduleNoise(0.06, 0.10, 180, t0 + 3.5);
    osc('sawtooth', 49.0, 0.2, 0.09, masterGain, t0 + 3.5);  // beat 8 — G1
    scheduleNoise(0.12, 0.20, 150, t0 + 4.0);
    osc('sawtooth', 41.2, 0.4, 0.14, masterGain, t0 + 4.0);  // final beat before loop
  }
```

- [ ] **Step 2: Insert `sfxBossVictory` after `sfxWinFanfare`**

Find `sfxWinFanfare` (line ~4888) and its closing `}`. After it, insert:

```js
  // ---- boss victory fanfare: 3-part triumph, plays on boss defeat ----
  function sfxBossVictory() {
    sfx(() => {
      const t0 = ctx.currentTime;
      // Part 1: ascending run — sawtooth for bite (0–0.75s)
      osc('sawtooth', 261.6, 0.15, 0.20, masterGain, t0 + 0.00); // C4
      osc('sawtooth', 329.6, 0.15, 0.20, masterGain, t0 + 0.18); // E4
      osc('sawtooth', 392.0, 0.15, 0.20, masterGain, t0 + 0.36); // G4
      osc('sawtooth', 523.3, 0.18, 0.22, masterGain, t0 + 0.54); // C5
      osc('triangle', 130.8, 0.70, 0.08, masterGain, t0 + 0.00); // C3 undertone
      // Part 2: swelling chord (0.8–2.2s)
      osc('triangle', 523.3, 1.35, 0.22, masterGain, t0 + 0.80); // C5
      osc('triangle', 659.3, 1.35, 0.19, masterGain, t0 + 0.80); // E5
      osc('triangle', 784.0, 1.35, 0.16, masterGain, t0 + 0.80); // G5
      osc('sine',     261.6, 1.35, 0.10, masterGain, t0 + 0.80); // C4
      osc('sine',     130.8, 1.35, 0.07, masterGain, t0 + 0.80); // C3 bass
      // Part 3: final accent (2.3–3.4s)
      osc('sawtooth', 659.3,  0.9, 0.25, masterGain, t0 + 2.30); // E5 sharp hit
      osc('triangle', 659.3,  1.0, 0.16, masterGain, t0 + 2.30); // E5 sustained
      osc('sine',     329.6,  1.0, 0.10, masterGain, t0 + 2.30); // E4 below
      osc('sawtooth', 1318.5, 0.12, 0.10, masterGain, t0 + 2.48); // E6 sparkle
    });
  }
```

- [ ] **Step 3: Export `sfxBossVictory`**

Find the `return {` export block (updated in Task 3):

```js
    startBossMusic, stopBossMusic,
  };
```

Change to:

```js
    startBossMusic, stopBossMusic, sfxBossVictory,
  };
```

- [ ] **Step 4: Verify Bigfoot music and victory fanfare in browser**

```js
audio.startBossMusic('bigfoot');
```
You should hear a heavy rhythmic stomp pattern with deep bass — like a large creature walking. Confirm loop. Then `audio.stopBossMusic()`.

```js
audio.sfxBossVictory();
```
You should hear a rising 4-note run, a swelling major chord, then a sharp high accent. Total duration ~3.4 seconds. More triumphant and sustained than the normal camp fanfare.

---

### Task 7: Wire integration points

**Files:**
- Modify: `game.js:1058` (`initBossArena`)
- Modify: `game.js:1831` (`bossDefeated`)
- Modify: `game.js:2342` (`hurtPlayer` gameover branch)

- [ ] **Step 1: Start boss music when entering a boss arena**

Find `initBossArena` (line ~1058):

```js
function initBossArena(def) {
  bossArena = {
    boss:        makeBoss(def.bossType),
    spray:       null,
    noHit:       true,
    phase:       'fighting',
    defeatTimer: 0,
  };
}
```

Change to:

```js
function initBossArena(def) {
  bossArena = {
    boss:        makeBoss(def.bossType),
    spray:       null,
    noHit:       true,
    phase:       'fighting',
    defeatTimer: 0,
  };
  audio.startBossMusic(def.bossType);
}
```

- [ ] **Step 2: Stop music and play victory fanfare on boss defeat**

Find `bossDefeated` (line ~1831). The current line near the bottom:

```js
  audio.sfxCampFanfare();
```

Change to:

```js
  audio.stopBossMusic();
  audio.sfxBossVictory();
```

- [ ] **Step 3: Stop music on game over**

Find `hurtPlayer` around line 2339. The current gameover block:

```js
    if (player.lives <= 0) {
      game.state = 'gameover';
    } else {
```

Change to:

```js
    if (player.lives <= 0) {
      audio.stopBossMusic();
      game.state = 'gameover';
    } else {
```

- [ ] **Step 4: Verify integration in browser**

Start the server and open the game. Run in DevTools:

```js
window.trailBlazerDebug.warpToLevel(3); // Boss 1 — Thunderbird (LEVELS index 3)
```

The LEVELS array layout with bosses every 3 regular levels: `[L1, L2, L3, Boss1, L4, L5, L6, Boss2, L7, L8, L9, Boss3]` — indices 0–11. So Thunderbird=3, Mothman=7, Bigfoot=11.

Confirm:
1. Boss music starts immediately when the arena loads — you hear the Thunderbird phrase looping
2. Fight the boss. Stomp it 3 times. On defeat: music stops, victory fanfare plays (rising run → chord → accent)
3. `window.trailBlazerDebug.warpToLevel(7)` — Boss 2 Mothman: hypnotic bass pulse + melody plays
4. `window.trailBlazerDebug.warpToLevel(11)` — Boss 3 Bigfoot: stomping rhythm plays

To test the game-over music stop: warp to a boss level, let yourself die 3 times. Confirm the boss music stops before the game-over screen appears (no music bleeding onto the game-over screen).

---

### Task 8: Final verification and PR

- [ ] **Step 1: Run the Playwright smoke test**

```bash
cd qa
node runner.mjs scenarios/smoke.mjs
```

Expected: all checks pass. No console errors.

- [ ] **Step 2: Screenshot boss arena in browser**

```js
window.trailBlazerDebug.warpToLevel(3); // Thunderbird boss
await new Promise(r => setTimeout(r, 500));
window.trailBlazerDebug.screenshot(); // copy data URL, paste into browser to view
```

Confirm the arena renders cleanly with no visual regressions.

- [ ] **Step 3: Commit audio changes**

```bash
git add game.js
git commit -m "feat: add looping boss music and triumphant boss victory fanfare (#90)

Three distinct tense/ominous tracks for Thunderbird (6s aerial sweep),
Mothman (8s hypnotic chromatic), and Bigfoot (5s rhythmic stomp).
Uses Web Audio look-ahead loop pattern. sfxBossVictory replaces the
short sfxCampFanfare on boss defeat.

closes #90"
```

- [ ] **Step 4: Open PR**

```bash
gh pr create \
  --title "Boss music, victory fanfare, Alpine Lakes filter fix" \
  --body "$(cat <<'EOF'
## Summary
- Fixes floating water filter in Alpine Lakes (#88) — moved from col 85 (above Lake 2) to col 75 (granite slab platform before the lake)
- Adds looping tense boss-battle music for all three cryptid bosses (#90): Thunderbird (aerial/electric), Mothman (hypnotic chromatic), Bigfoot (heavy stomp)
- Replaces the short post-boss fanfare with a 3-part triumphant victory tune (~3.4s)
- Documents item-above-water spawning pitfall in LEVEL_DESIGN.md

## Test plan
- [ ] Warp to Alpine Lakes (level 3 in-game) — filter visible on granite slab before Lake 2, not floating above water
- [ ] Warp to Thunderbird boss (level index 2) — looping aerial music plays immediately, stops cleanly on defeat, victory fanfare plays
- [ ] Warp to Mothman boss (level index 5) — hypnotic chromatic music loops
- [ ] Warp to Bigfoot boss (level index 8) — stomping rhythm loops
- [ ] Die 3 times in a boss fight — music stops before game-over screen
- [ ] Playwright smoke test passes

closes #88, closes #90

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
