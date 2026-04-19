# Bigfoot Ground Smash Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Bigfoot boss's ground-pound attack visually readable, add animation, and increase difficulty — while fixing a latent hitbox bug.

**Architecture:** Changes are isolated to the Bigfoot boss code in `game.js` (roughly lines 1454–1697). We refactor `boss.shockwave` (singular) to `boss.shockwaves` (array), add a four-phase windup sub-state machine for the ground pound, replace the flat shockwave visual with a crescent ripple, add camera-shake and a new `sfxSlam` audio synth, and rebalance probabilities/timings. A new `forceBossAttack` debug hook enables deterministic Playwright testing.

**Tech Stack:** Vanilla JavaScript, HTML5 Canvas 2D, Web Audio API, Playwright (for QA scenarios). No build step, no test framework beyond Playwright scenarios.

**Spec:** `docs/superpowers/specs/2026-04-18-bigfoot-ground-smash-design.md`

**Issue:** #92

**Verification model:** This project has no unit test framework. Automated verification uses Playwright scenarios in `qa/` that drive the game via `window.trailBlazerDebug` and inspect `bossArena.boss` state via `page.evaluate`. Visual verification is done by running the dev server and playing the level. Each task lists both kinds of checks.

---

## Files

**Modified:**
- `game.js` — all behavior, draw, and audio changes (Bigfoot-specific sections ~1454–1697; camera at ~847; audio at ~4779–5096; debug API at ~5180–5207; `getState` extension).
- `LEVEL_DESIGN.md` — add Bigfoot ground-pound mechanic documentation.

**Created:**
- `qa/scenarios/bigfoot-ground-pound.mjs` — Playwright scenario verifying animation sub-phases, shockwave behavior (including regression test for leftward-wave hitbox bug), and phase-3 dual-wave.

---

## Task 1: Add debug hooks for deterministic boss testing

**Why first:** All subsequent logic tasks depend on being able to force specific attacks. Without this, Playwright scenarios can only wait and hope.

**Files:**
- Modify: `game.js` — `window.trailBlazerDebug` block around line 5180; `getState` around line 5194; roll logic at line ~1513 (add `forcedNextAttack` check).

- [ ] **Step 1: Add `forcedNextAttack` field to `makeBigfoot`**

In `game.js` at line 1454, inside `makeBigfoot`, add a new field:

```js
function makeBigfoot() {
  return {
    type: 'bigfoot',
    x: BOSS_ARENA_W / 2 - 38, y: BOSS_GROUND_Y - 150,
    w: 75, h: 150,
    hp: 8,
    phase: 1,
    state: 'land',
    stateTimer: 40,
    boulders: [],
    shockwave: null,
    leapStartX: 0, leapStartY: 0,
    leapTargetX: 0,
    leapProgress: 0,
    leapDuration: 75,
    windupProgress: 0,
    rageTimer: 0,
    vulnerable: false,
    hitTimer: 0,
    forcedNextAttack: null,  // 'leap' | 'groundpound' | 'boulders' | null (test hook)
  };
}
```

- [ ] **Step 2: Consume `forcedNextAttack` in the `land` → next-attack roll**

Replace the roll block in `updateBigfoot` (game.js ~1513–1537). Find:

```js
  if (boss.state === 'land') {
    if (boss.stateTimer <= 0) {
      const roll = Math.random();
      const leapChance      = boss.phase === 3 ? 0.55 : boss.phase === 2 ? 0.62 : 0.70;
      const groundPoundChance = boss.phase >= 2 ? 0.22 : 0;

      if (roll < leapChance) {
```

Replace with:

```js
  if (boss.state === 'land') {
    if (boss.stateTimer <= 0) {
      const forced = boss.forcedNextAttack;
      boss.forcedNextAttack = null;
      const roll = Math.random();
      const leapChance      = boss.phase === 3 ? 0.55 : boss.phase === 2 ? 0.62 : 0.70;
      const groundPoundChance = boss.phase >= 2 ? 0.22 : 0;
      const pickLeap      = forced === 'leap'       || (!forced && roll < leapChance);
      const pickGroundPound = forced === 'groundpound' || (!forced && !pickLeap && roll < leapChance + groundPoundChance);

      if (pickLeap) {
```

And update the chained `else if` / `else` below it so `pickGroundPound` selects the ground pound branch and the final `else` selects the windup (boulders) branch. After the change the structure should read:

```js
      if (pickLeap) {
        boss.leapStartX = boss.x;
        boss.leapStartY = boss.y;
        const spread = (Math.random() - 0.5) * 160;
        boss.leapTargetX = Math.max(20, Math.min(BOSS_ARENA_W - boss.w - 20,
          player.x + player.w / 2 - boss.w / 2 + spread));
        boss.leapProgress = 0;
        boss.leapDuration  = boss.phase === 3 ? 55 : boss.phase === 2 ? 65 : 75;
        boss.vulnerable    = true;
        boss.state = 'leap';
      } else if (pickGroundPound) {
        boss.state = 'groundpound';
        boss.stateTimer = 45;
      } else {
        boss.windupProgress = 0;
        boss.state = 'windup';
        boss.stateTimer = 40;
      }
    }
  } else if (boss.state === 'leap') {
```

- [ ] **Step 3: Extend `window.trailBlazerDebug` with `forceBossAttack` and `getBossState`**

At `game.js` line ~5181 inside `window.trailBlazerDebug = { ... }`, add two entries:

```js
  forceBossAttack(attackName) {
    if (!bossArena || !bossArena.boss) return false;
    if (!['leap', 'groundpound', 'boulders'].includes(attackName)) return false;
    bossArena.boss.forcedNextAttack = attackName;
    return true;
  },
  getBossState() {
    if (!bossArena || !bossArena.boss) return null;
    const b = bossArena.boss;
    return {
      type: b.type,
      state: b.state,
      phase: b.phase,
      hp: b.hp,
      x: b.x, y: b.y,
      poundSubPhase: b.poundSubPhase ?? null,
      poundProgress: b.poundProgress ?? null,
      poundIsDual: b.poundIsDual ?? false,
      shockwaves: (b.shockwaves || (b.shockwave ? [b.shockwave] : [])).map(sw => ({
        x: sw.x, dir: sw.dir, speed: sw.speed, active: sw.active,
      })),
    };
  },
```

(Keeping the fallback `b.shockwave ? [b.shockwave] : []` tolerant of either the current or future array form. Task 2 replaces the field; the fallback is removable then but leaving it until Task 2 avoids a broken intermediate state.)

- [ ] **Step 4: Run the existing `boss-warp.mjs` scenario to confirm no regression**

Start the dev server in a separate terminal: `python -m http.server 3000`.

Run:
```bash
cd qa
node runner.mjs scenarios/boss-warp.mjs
```

Expected output includes `Boss warp test PASSED.`

- [ ] **Step 5: Hand-verify the debug hook from DevTools (quick)**

Open `http://localhost:3000?debug=1` in a browser, warp to Bigfoot (`window.trailBlazerDebug.warpToLevel(11)`), open DevTools console and run:
```js
window.trailBlazerDebug.forceBossAttack('groundpound');
window.trailBlazerDebug.getBossState();
```
Expected: `forceBossAttack` returns `true`. Wait a few seconds and observe Bigfoot performs the ground pound. `getBossState()` returns an object with `type: 'bigfoot'`.

- [ ] **Step 6: Commit**

```bash
git add game.js
git commit -m "feat(#92): add forceBossAttack + getBossState debug hooks"
```

---

## Task 2: Refactor `boss.shockwave` to `boss.shockwaves` array

**Why:** Phase-3 dual-wave needs two simultaneous waves. Isolating this refactor keeps the visual/hitbox changes in a later task from tangling with data-shape changes.

**Files:**
- Modify: `game.js` — `makeBigfoot` (line ~1454), `updateBigfoot` shockwave block (~1490–1499), `drawBigfoot` shockwave block (~1615–1622), `getBossState` helper from Task 1.

- [ ] **Step 1: Write the failing Playwright assertion (regression check)**

Append to a new scratch scenario `qa/scenarios/bigfoot-shockwave-refactor.mjs`:

```js
function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }

export default async function scenario(game) {
  await game.warpToLevel(11);
  await game.waitFrames(10);

  // Drive Bigfoot into phase 2 so ground-pound is allowed.
  await game.page.evaluate(() => { window.bossArena.boss.hp = 4; window.bossArena.boss.phase = 2; });

  await game.page.evaluate(() => window.trailBlazerDebug.forceBossAttack('groundpound'));

  // Wait for pound -> stagger -> shockwave active
  for (let i = 0; i < 200; i++) {
    await game.waitFrames(1);
    const s = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (s.shockwaves.length > 0) {
      assert(s.shockwaves.length === 1, `expected 1 wave active, got ${s.shockwaves.length}`);
      assert(typeof s.shockwaves[0].x === 'number', 'wave x missing');
      console.log('Shockwave appears as expected:', s.shockwaves[0]);
      return;
    }
  }
  throw new Error('Shockwave never appeared');
}
```

Run: `node runner.mjs scenarios/bigfoot-shockwave-refactor.mjs`.

Expected at this point: **PASSES** (because of the fallback in `getBossState` from Task 1). This scenario locks in the contract we're refactoring toward. We'll keep it around to verify no regression.

- [ ] **Step 2: Change `makeBigfoot` field from `shockwave: null` to `shockwaves: []`**

In `game.js` line ~1464:

```js
// Old:
shockwave: null,

// New:
shockwaves: [],
```

- [ ] **Step 3: Rewrite the shockwave update block to iterate the array**

Replace the block at game.js ~1490–1499:

```js
  if (boss.shockwave && boss.shockwave.active) {
    const sw = boss.shockwave;
    sw.x    += sw.dir * sw.speed;
    sw.alpha -= 0.012;
    if (sw.alpha <= 0 || sw.x < 0 || sw.x > BOSS_ARENA_W) sw.active = false;
    if (player.hurtTimer === 0 && player.onGround) {
      const swHit = { x: sw.dir > 0 ? sw.x - 30 : 0, y: BOSS_GROUND_Y - 30, w: 60, h: 30 };
      if (aabb(player, swHit)) hurtPlayer();
    }
  }
```

With:

```js
  boss.shockwaves = boss.shockwaves.filter(sw => {
    if (!sw.active) return false;
    sw.x += sw.dir * sw.speed;
    sw.alpha -= 0.012;
    if (sw.alpha <= 0 || sw.x < 0 || sw.x > BOSS_ARENA_W) sw.active = false;
    if (player.hurtTimer === 0 && player.onGround) {
      const swHit = { x: sw.dir > 0 ? sw.x - 30 : 0, y: BOSS_GROUND_Y - 30, w: 60, h: 30 };
      if (aabb(player, swHit)) hurtPlayer();
    }
    return sw.active;
  });
```

Note: we are preserving the existing (buggy) hitbox formula for leftward waves here. Task 3 fixes it — isolated for TDD.

- [ ] **Step 4: Rewrite the shockwave draw block**

In `drawBigfoot` at game.js ~1615–1622, replace:

```js
  if (boss.shockwave && boss.shockwave.active) {
    const sw  = boss.shockwave;
    const swx = sw.x - cam.x;
    const swy = BOSS_GROUND_Y - cam.y - 22;
    ctx.fillStyle = `rgba(90,58,26,${sw.alpha})`;
    if (sw.dir > 0) ctx.fillRect(swx, swy, BOSS_ARENA_W - sw.x, 22);
    else            ctx.fillRect(0,   swy, swx, 22);
  }
```

With:

```js
  boss.shockwaves.forEach(sw => {
    if (!sw.active) return;
    const swx = sw.x - cam.x;
    const swy = BOSS_GROUND_Y - cam.y - 22;
    ctx.fillStyle = `rgba(90,58,26,${sw.alpha})`;
    if (sw.dir > 0) ctx.fillRect(swx, swy, BOSS_ARENA_W - sw.x, 22);
    else            ctx.fillRect(0,   swy, swx, 22);
  });
```

(Still the flat rectangle — replaced with the crescent in Task 4.)

- [ ] **Step 5: Update the `groundpound` → `stagger` transition to push into the array**

In `updateBigfoot` at game.js ~1579–1588 replace:

```js
  } else if (boss.state === 'groundpound') {
    if (boss.stateTimer <= 0) {
      const dir = player.x + player.w / 2 > boss.x + boss.w / 2 ? 1 : -1;
      boss.shockwave = { x: boss.x + boss.w / 2, dir, speed: 7, alpha: 0.85, active: true };
      spawnParticles(boss.x + boss.w / 2, BOSS_GROUND_Y, '#5a3a1a', 24, 6);
      audio.sfxStun();
      boss.vulnerable = true;
      boss.state = 'stagger';
      boss.stateTimer = 28;
    }
  }
```

With:

```js
  } else if (boss.state === 'groundpound') {
    if (boss.stateTimer <= 0) {
      const dir = player.x + player.w / 2 > boss.x + boss.w / 2 ? 1 : -1;
      boss.shockwaves.push({ x: boss.x + boss.w / 2, dir, speed: 7, alpha: 0.85, active: true });
      spawnParticles(boss.x + boss.w / 2, BOSS_GROUND_Y, '#5a3a1a', 24, 6);
      audio.sfxStun();
      boss.vulnerable = true;
      boss.state = 'stagger';
      boss.stateTimer = 28;
    }
  }
```

- [ ] **Step 6: Remove the fallback in `getBossState`**

Now that `shockwaves` always exists, simplify the expression in `getBossState` (game.js ~5195):

```js
// Old:
shockwaves: (b.shockwaves || (b.shockwave ? [b.shockwave] : [])).map(sw => ({ ... })),

// New:
shockwaves: (b.shockwaves || []).map(sw => ({
  x: sw.x, dir: sw.dir, speed: sw.speed, active: sw.active,
})),
```

- [ ] **Step 7: Run the scratch scenario — should still pass**

```bash
cd qa && node runner.mjs scenarios/bigfoot-shockwave-refactor.mjs
```

Expected: `Shockwave appears as expected: ...`

- [ ] **Step 8: Run `boss-warp.mjs` as a second-tier regression check**

```bash
node runner.mjs scenarios/boss-warp.mjs
```

Expected: `Boss warp test PASSED.`

- [ ] **Step 9: Commit**

```bash
git add game.js
git commit -m "refactor(#92): boss.shockwave (singular) -> boss.shockwaves (array)"
```

---

## Task 3: Fix leftward-wave hitbox bug (TDD)

**Why separate:** It's a real bug, easy to isolate, and a failing test first proves the bug exists.

**Files:**
- Create: `qa/scenarios/bigfoot-shockwave-left.mjs` (keep it in the repo as a regression test).
- Modify: `game.js` — the `swHit` formula at game.js ~1496 (now inside the filter from Task 2).

- [ ] **Step 1: Write a failing regression test**

Create `qa/scenarios/bigfoot-shockwave-left.mjs`:

```js
function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }

export default async function scenario(game) {
  await game.warpToLevel(11);
  await game.waitFrames(10);

  // Drive boss into phase 2 and teleport it to the right side so the wave fires leftward.
  await game.page.evaluate(() => {
    const b = window.bossArena.boss;
    b.hp = 4; b.phase = 2;
    b.x = 650; // right side of arena
  });

  // Put the player on the LEFT side, standing, out of range of any existing hit.
  await game.page.evaluate(() => {
    window.player.x = 100; window.player.y = window.BOSS_GROUND_Y ? window.BOSS_GROUND_Y - 30 : 690;
    window.player.vx = 0; window.player.vy = 0; window.player.hurtTimer = 0;
  });

  const livesBefore = (await game.getState()).playerLives;

  await game.page.evaluate(() => window.trailBlazerDebug.forceBossAttack('groundpound'));

  // Let the pound fire and the wave travel the full arena.
  for (let i = 0; i < 200; i++) {
    await game.waitFrames(1);
    const s = await game.getState();
    if (s.playerLives < livesBefore) {
      console.log('Player was hit by leftward wave as expected.');
      return;
    }
    // Safety: keep player pinned on the ground on the left
    await game.page.evaluate(() => {
      window.player.x = 100;
      window.player.vx = 0;
    });
  }
  throw new Error('Leftward shockwave never damaged the player (hitbox bug still present).');
}
```

- [ ] **Step 2: Run it — expect FAIL**

```bash
node runner.mjs scenarios/bigfoot-shockwave-left.mjs
```

Expected: `Error: Leftward shockwave never damaged the player (hitbox bug still present).`

If the scenario happens to pass (e.g. because the player was hit by boss body instead), re-position the player further left and re-run. The goal is to observe the leftward-wave specifically miss.

- [ ] **Step 3: Fix the hitbox formula**

In `game.js` inside the shockwave filter (Task 2 Step 3), change:

```js
const swHit = { x: sw.dir > 0 ? sw.x - 30 : 0, y: BOSS_GROUND_Y - 30, w: 60, h: 30 };
```

To:

```js
const swHit = { x: sw.x - 30, y: BOSS_GROUND_Y - 30, w: 60, h: 30 };
```

- [ ] **Step 4: Re-run the scenario — expect PASS**

```bash
node runner.mjs scenarios/bigfoot-shockwave-left.mjs
```

Expected: `Player was hit by leftward wave as expected.`

- [ ] **Step 5: Also re-run `bigfoot-shockwave-refactor.mjs` and `boss-warp.mjs` to confirm no regression**

```bash
node runner.mjs scenarios/bigfoot-shockwave-refactor.mjs
node runner.mjs scenarios/boss-warp.mjs
```

Both should pass.

- [ ] **Step 6: Commit**

```bash
git add game.js qa/scenarios/bigfoot-shockwave-left.mjs
git commit -m "fix(#92): leftward shockwave hitbox was pinned at x=0 instead of tracking wave position"
```

---

## Task 4: Replace shockwave visual with crescent ripple

**Why before state-machine work:** The crescent is a self-contained visual change that the player already sees. Shipping it first gives immediate feedback even while the windup animation is still in-flight.

**Files:**
- Modify: `game.js` — shockwave filter in `updateBigfoot` (speed/maxTravel/alpha logic), shockwave draw forEach in `drawBigfoot`, `swHit` height, shockwave push call.

- [ ] **Step 1: Update shockwave data shape — replace `alpha` with `travelled`/`maxTravel`**

In `updateBigfoot`, replace the filter from Task 3 with:

```js
  boss.shockwaves = boss.shockwaves.filter(sw => {
    if (!sw.active) return false;
    sw.x        += sw.dir * sw.speed;
    sw.travelled = (sw.travelled || 0) + sw.speed;
    if (sw.travelled >= sw.maxTravel || sw.x < 0 || sw.x > BOSS_ARENA_W) sw.active = false;

    // Dust-puff trail: 2 particles per tick behind the wave
    spawnParticles(sw.x - sw.dir * 15, BOSS_GROUND_Y - 6, '#a88655', 2, 2);

    if (player.hurtTimer === 0 && player.onGround) {
      const swHit = { x: sw.x - 30, y: BOSS_GROUND_Y - 40, w: 60, h: 40 };
      if (aabb(player, swHit)) hurtPlayer();
    }
    return sw.active;
  });
```

Note: hitbox height grows from 30 to 40 to match the crescent's visible peak.

- [ ] **Step 2: Update the shockwave push in the `groundpound` → `stagger` branch**

Replace the push call at game.js ~1582:

```js
boss.shockwaves.push({ x: boss.x + boss.w / 2, dir, speed: 7, alpha: 0.85, active: true });
```

With:

```js
boss.shockwaves.push({
  x: boss.x + boss.w / 2,
  dir,
  speed: 7,
  travelled: 0,
  maxTravel: 500,
  active: true,
});
```

- [ ] **Step 3: Replace the flat-rectangle draw with the crescent**

In `drawBigfoot` replace the `boss.shockwaves.forEach` block from Task 2:

```js
  boss.shockwaves.forEach(sw => {
    if (!sw.active) return;
    const swx = sw.x - cam.x;
    const swy = BOSS_GROUND_Y - cam.y;
    // Base fill — brown crescent
    ctx.fillStyle = '#5a3a1a';
    ctx.beginPath();
    ctx.moveTo(swx - 30, swy);
    ctx.quadraticCurveTo(swx, swy - 40, swx + 30, swy);
    ctx.quadraticCurveTo(swx, swy - 28, swx - 30, swy);
    ctx.closePath();
    ctx.fill();
    // Highlight edge — light brown
    ctx.strokeStyle = '#8a5a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(swx - 30, swy);
    ctx.quadraticCurveTo(swx, swy - 40, swx + 30, swy);
    ctx.stroke();
  });
```

- [ ] **Step 4: Start the dev server and playtest**

```bash
python -m http.server 3000
```

In a browser open `http://localhost:3000?debug=1`, run `window.trailBlazerDebug.warpToLevel(11)`, lower HP to phase 2 (`bossArena.boss.hp = 4; bossArena.boss.phase = 2`), then `window.trailBlazerDebug.forceBossAttack('groundpound')`.

**Expected visual:**
- A visible brown crescent arc (~60px wide, ~40px tall) moves along the ground.
- Small dust puffs trail behind it.
- The flat brown "fill-to-edge" rectangle is gone.
- The crescent fades into thin air ~500px from Bigfoot, not when it hits the wall.

Screenshot for the commit message: run `await game.screenshot('bigfoot-crescent')` or take a browser screenshot.

- [ ] **Step 5: Re-run `bigfoot-shockwave-left.mjs` — player should still take damage**

```bash
cd qa && node runner.mjs scenarios/bigfoot-shockwave-left.mjs
```

Expected: still passes. (The 40px hitbox still covers the player's feet.)

- [ ] **Step 6: Commit**

```bash
git add game.js
git commit -m "feat(#92): replace flat shockwave trail with crescent ripple + dust puffs"
```

---

## Task 5: Add hop-and-slam windup state machine

**Why:** The core animation work. This adds the `poundProgress`/`poundSubPhase` sub-state without yet drawing anything different — Task 6 handles the visuals. Splitting this way means we can assert on state-machine behavior here and visuals in the next task.

**Files:**
- Modify: `game.js` — `makeBigfoot` (new fields), `updateBigfoot` `groundpound` branch.

- [ ] **Step 1: Add sub-phase fields to `makeBigfoot`**

In `makeBigfoot` at ~1454, add after `windupProgress: 0,`:

```js
poundProgress: 0,
poundSubPhase: 'squat',   // 'squat' | 'rise' | 'hold' | 'slam'
poundSubTimer: 0,
poundIsDual: false,
```

- [ ] **Step 2: Define a local helper for sub-phase durations**

Just above `updateBigfoot` (game.js ~1476), add:

```js
const BIGFOOT_POUND_TICKS = {
  // [squat, rise, hold, slam] per phase
  1: [8, 10, 10, 12],
  2: [7,  8,  9, 10],
  3: [6,  7,  7,  8],
};
```

- [ ] **Step 3: Write a failing Playwright scenario for sub-phase transitions**

Create `qa/scenarios/bigfoot-pound-substates.mjs`:

```js
function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }

export default async function scenario(game) {
  await game.warpToLevel(11);
  await game.waitFrames(10);
  await game.page.evaluate(() => { window.bossArena.boss.hp = 4; window.bossArena.boss.phase = 2; });
  await game.page.evaluate(() => window.trailBlazerDebug.forceBossAttack('groundpound'));

  const observed = new Set();
  for (let i = 0; i < 120; i++) {
    await game.waitFrames(1);
    const s = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (s.state === 'groundpound' && s.poundSubPhase) observed.add(s.poundSubPhase);
    if (s.state === 'stagger') break;
  }
  for (const phase of ['squat', 'rise', 'hold', 'slam']) {
    assert(observed.has(phase), `missing sub-phase: ${phase}`);
  }
  console.log('All four pound sub-phases observed.');
}
```

Run — expected FAIL (`poundSubPhase` is currently null).

```bash
node runner.mjs scenarios/bigfoot-pound-substates.mjs
```

- [ ] **Step 4: Replace the `groundpound` branch with the sub-phase state machine**

In `updateBigfoot` at game.js ~1529 — after Task 1 the block reads:

```js
      } else if (pickGroundPound) {
        boss.state = 'groundpound';
        boss.stateTimer = 45;
      }
```

Replace it with sub-phase initialization:

```js
      } else if (pickGroundPound) {
        boss.state = 'groundpound';
        const [squat] = BIGFOOT_POUND_TICKS[boss.phase] || BIGFOOT_POUND_TICKS[1];
        boss.poundSubPhase = 'squat';
        boss.poundSubTimer = squat;
        boss.poundProgress = 0;
        boss.poundIsDual = false;  // Task 7 may set true for phase 3
      }
```

Then replace the old `groundpound` branch body at game.js ~1579–1588:

```js
  } else if (boss.state === 'groundpound') {
    const durs = BIGFOOT_POUND_TICKS[boss.phase] || BIGFOOT_POUND_TICKS[1];
    const total = durs[0] + durs[1] + durs[2] + durs[3];
    const elapsedInPhase = {
      squat: 0,
      rise:  durs[0],
      hold:  durs[0] + durs[1],
      slam:  durs[0] + durs[1] + durs[2],
    };
    boss.poundSubTimer--;
    if (boss.poundSubTimer <= 0) {
      if (boss.poundSubPhase === 'squat') {
        boss.poundSubPhase = 'rise';
        boss.poundSubTimer = durs[1];
      } else if (boss.poundSubPhase === 'rise') {
        boss.poundSubPhase = 'hold';
        boss.poundSubTimer = durs[2];
      } else if (boss.poundSubPhase === 'hold') {
        boss.poundSubPhase = 'slam';
        boss.poundSubTimer = durs[3];
      } else if (boss.poundSubPhase === 'slam') {
        // Impact frame — spawn shockwave(s), particles, sfx, enter stagger
        const dir = player.x + player.w / 2 > boss.x + boss.w / 2 ? 1 : -1;
        boss.shockwaves.push({
          x: boss.x + boss.w / 2,
          dir,
          speed: boss.phase === 3 ? 8 : 7,
          travelled: 0,
          maxTravel: 500,
          active: true,
        });
        spawnParticles(boss.x + boss.w / 2, BOSS_GROUND_Y, '#5a3a1a', 24, 6);
        audio.sfxStun();  // Task 8 will switch this to sfxSlam

        boss.vulnerable = true;
        boss.state = 'stagger';
        boss.stateTimer = boss.phase === 3 ? 18 : boss.phase === 2 ? 22 : 28;
      }
    }
    // Update progress 0..1 for the draw function to read.
    const startFor = elapsedInPhase[boss.poundSubPhase];
    const subLen   = durs[['squat','rise','hold','slam'].indexOf(boss.poundSubPhase)];
    const ticksIntoPhase = subLen - boss.poundSubTimer;
    boss.poundProgress = Math.min(1, (startFor + ticksIntoPhase) / total);
  } else if (boss.state === 'stagger') {
```

Leave the `stagger` branch as-is — the stagger duration above has been phased.

- [ ] **Step 5: Re-run the sub-phase scenario — expect PASS**

```bash
node runner.mjs scenarios/bigfoot-pound-substates.mjs
```

Expected: `All four pound sub-phases observed.`

- [ ] **Step 6: Re-run earlier scenarios to confirm no regression**

```bash
node runner.mjs scenarios/bigfoot-shockwave-refactor.mjs
node runner.mjs scenarios/bigfoot-shockwave-left.mjs
node runner.mjs scenarios/boss-warp.mjs
```

All should pass.

- [ ] **Step 7: Commit**

```bash
git add game.js qa/scenarios/bigfoot-pound-substates.mjs
git commit -m "feat(#92): hop-and-slam sub-phase state machine for Bigfoot ground pound"
```

---

## Task 6: Draw the hop-and-slam animation

**Why:** Visual layer for Task 5's state machine. This is largely playtest-verified; automated tests can only assert that boss coords change.

**Files:**
- Modify: `game.js` — `drawBigfoot`, specifically the `ctx.save/translate/scale` section around lines 1624–1690.

- [ ] **Step 1: Compute hop y-offset and squash scale in `drawBigfoot`**

At the top of `drawBigfoot` (game.js ~1599), just after:

```js
function drawBigfoot(boss) {
  const t  = game.tick;
  const bx = boss.x - cam.x + boss.w / 2;
  const by = boss.y - cam.y + boss.h;  // translate to feet
```

Add:

```js
  // Hop-and-slam pose offsets (zero outside groundpound)
  let hopY = 0;           // positive = lifted off ground
  let squashY = 1.0;      // y scale
  let squashX = 1.0;      // x scale
  if (boss.state === 'groundpound') {
    const sub = boss.poundSubPhase;
    const durs = BIGFOOT_POUND_TICKS[boss.phase] || BIGFOOT_POUND_TICKS[1];
    const subIdx = ['squat','rise','hold','slam'].indexOf(sub);
    const subLen = durs[subIdx] || 1;
    const t01    = 1 - (boss.poundSubTimer / subLen);  // 0..1 through current sub-phase
    if (sub === 'squat')      { squashY = 1 - 0.08 * t01; squashX = 1 + 0.04 * t01; }
    else if (sub === 'rise')  { hopY = 40 * t01 * (2 - t01); squashY = 0.92 + 0.08 * t01; squashX = 1.04 - 0.04 * t01; }
    else if (sub === 'hold')  { hopY = 40; }
    else if (sub === 'slam')  {
      // Ease-in descent from 40 -> 0
      hopY = 40 * (1 - t01 * t01);
      // Final impact frame squash
      if (t01 > 0.85) { squashY = 0.85; squashX = 1.10; }
    }
  }
```

- [ ] **Step 2: Apply the offsets to the main body translate/scale**

Find the existing block (game.js ~1624):

```js
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(0.75, 0.75);  // 25% smaller; arc height unchanged so jump clearance is preserved
```

Replace with:

```js
  ctx.save();
  ctx.translate(bx, by - hopY);
  ctx.scale(0.75 * squashX, 0.75 * squashY);
```

- [ ] **Step 3: Make the `arm` lerp react to the pound sub-phase**

Find (game.js ~1629):

```js
  // Arms raised during leap (flying pose) or windup (throw telegraph)
  const arm = boss.state === 'leap' ? 0.8 : Math.min(1, boss.windupProgress);
```

Replace with:

```js
  // Arm raise amount: leap, boulder windup, or ground-pound sub-phase
  let poundArm = 0;
  if (boss.state === 'groundpound') {
    const sub = boss.poundSubPhase;
    if (sub === 'rise' || sub === 'hold') poundArm = 1;
    else if (sub === 'slam') {
      const durs = BIGFOOT_POUND_TICKS[boss.phase] || BIGFOOT_POUND_TICKS[1];
      const subLen = durs[3] || 1;
      const t01 = 1 - (boss.poundSubTimer / subLen);
      poundArm = 1 - t01;  // snap from 1 -> 0 during slam
    }
  }
  const arm = boss.state === 'leap' ? 0.8 : Math.max(Math.min(1, boss.windupProgress), poundArm);
```

- [ ] **Step 4: Add eye glow during the `hold` sub-phase**

Find the eye-fill block at game.js ~1661:

```js
  ctx.fillStyle = boss.phase === 3 ? '#ff6600' : '#cc3300';
  ctx.beginPath(); ctx.arc(-10, -193, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 10, -193, 4, 0, Math.PI * 2); ctx.fill();
```

Replace with:

```js
  const eyeGlow = (boss.state === 'groundpound' && boss.poundSubPhase === 'hold');
  ctx.fillStyle = eyeGlow ? '#ffaa00' : (boss.phase === 3 ? '#ff6600' : '#cc3300');
  ctx.beginPath(); ctx.arc(-10, -193, eyeGlow ? 5 : 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 10, -193, eyeGlow ? 5 : 4, 0, Math.PI * 2); ctx.fill();
```

- [ ] **Step 5: Playtest**

Dev server running, visit `?debug=1`, warp to bigfoot, drop to phase 2, force ground-pound several times.

**Expected:**
- Bigfoot visibly squats (~8 ticks).
- Rises off the ground ~40px (arms up overhead).
- Hangs at peak with glowing orange eyes (~10 ticks).
- Slams back down fast.
- Shockwave spawns on landing.

No X drift during the hop — Bigfoot lands exactly where he started.

- [ ] **Step 6: Re-run the earlier scenarios**

```bash
cd qa && node runner.mjs scenarios/bigfoot-pound-substates.mjs
node runner.mjs scenarios/bigfoot-shockwave-left.mjs
node runner.mjs scenarios/boss-warp.mjs
```

All pass.

- [ ] **Step 7: Commit**

```bash
git add game.js
git commit -m "feat(#92): hop-and-slam animation — squat, rise, hold, slam poses"
```

---

## Task 7: Phase-3 dual-wave

**Files:**
- Modify: `game.js` — `groundpound` branch entry (set `poundIsDual`), slam impact block (emit two waves), `drawBigfoot` (dual-glow aura).
- Create: `qa/scenarios/bigfoot-dual-wave.mjs`.

- [ ] **Step 1: Add a debug hook variant that forces dual-wave**

In `window.trailBlazerDebug` update `forceBossAttack`:

```js
  forceBossAttack(attackName) {
    if (!bossArena || !bossArena.boss) return false;
    const valid = ['leap', 'groundpound', 'groundpound-dual', 'boulders'];
    if (!valid.includes(attackName)) return false;
    bossArena.boss.forcedNextAttack = attackName;
    return true;
  },
```

- [ ] **Step 2: Branch on `'groundpound-dual'` when entering the pound**

In `updateBigfoot`'s land-roll (game.js ~1529, inside the `pickGroundPound` block from Task 1), add `poundIsDual` detection. Update the block to:

```js
      const pickDual = forced === 'groundpound-dual';
      const pickGroundPound = forced === 'groundpound' || pickDual ||
        (!forced && !pickLeap && roll < leapChance + groundPoundChance);
      // ...
      } else if (pickGroundPound) {
        boss.state = 'groundpound';
        const [squat] = BIGFOOT_POUND_TICKS[boss.phase] || BIGFOOT_POUND_TICKS[1];
        boss.poundSubPhase = 'squat';
        boss.poundSubTimer = squat;
        boss.poundProgress = 0;
        // Phase-3 only: ~33% of pounds become dual-wave. The forced-dual hook overrides.
        boss.poundIsDual = pickDual || (boss.phase === 3 && Math.random() < 0.33);
      }
```

- [ ] **Step 3: Emit two waves at slam impact when `poundIsDual`**

In the slam-impact block from Task 5 Step 4, replace the single `boss.shockwaves.push(...)` call with:

```js
        const pushWave = (dir) => boss.shockwaves.push({
          x: boss.x + boss.w / 2,
          dir,
          speed: boss.phase === 3 ? 8 : 7,
          travelled: 0,
          maxTravel: 500,
          active: true,
        });
        if (boss.poundIsDual) {
          pushWave(+1);
          pushWave(-1);
        } else {
          const dir = player.x + player.w / 2 > boss.x + boss.w / 2 ? 1 : -1;
          pushWave(dir);
        }
```

- [ ] **Step 4: Add the dual-wave telegraph glow during `hold`**

In `drawBigfoot`, after the existing eye-glow block from Task 6 Step 4, add:

```js
  if (boss.state === 'groundpound' && boss.poundSubPhase === 'hold' && boss.poundIsDual) {
    ctx.strokeStyle = 'rgba(255,150,0,0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, -130, 70, 105, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
```

- [ ] **Step 5: Write the dual-wave test**

Create `qa/scenarios/bigfoot-dual-wave.mjs`:

```js
function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }

export default async function scenario(game) {
  await game.warpToLevel(11);
  await game.waitFrames(10);
  await game.page.evaluate(() => { window.bossArena.boss.hp = 2; window.bossArena.boss.phase = 3; });
  await game.page.evaluate(() => window.trailBlazerDebug.forceBossAttack('groundpound-dual'));

  let maxWaves = 0;
  for (let i = 0; i < 120; i++) {
    await game.waitFrames(1);
    const s = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (s.shockwaves.length > maxWaves) maxWaves = s.shockwaves.length;
  }
  assert(maxWaves === 2, `expected 2 simultaneous waves, max seen was ${maxWaves}`);
  console.log('Dual-wave emitted 2 shockwaves as expected.');
}
```

Run — expected FAIL before Step 3, PASS after.

```bash
node runner.mjs scenarios/bigfoot-dual-wave.mjs
```

- [ ] **Step 6: Playtest dual-wave visual**

Dev server, warp to bigfoot, set phase 3 (`bossArena.boss.hp = 2; bossArena.boss.phase = 3`), force `groundpound-dual`.

Expected:
- Second orange aura ring around Bigfoot's torso during the hold frame.
- Two crescents fly out in opposite directions from Bigfoot's center.
- Running to a corner is no longer safe — must jump.

- [ ] **Step 7: Re-run all previous Bigfoot scenarios**

```bash
node runner.mjs scenarios/bigfoot-shockwave-refactor.mjs
node runner.mjs scenarios/bigfoot-shockwave-left.mjs
node runner.mjs scenarios/bigfoot-pound-substates.mjs
node runner.mjs scenarios/bigfoot-dual-wave.mjs
node runner.mjs scenarios/boss-warp.mjs
```

All pass.

- [ ] **Step 8: Commit**

```bash
git add game.js qa/scenarios/bigfoot-dual-wave.mjs
git commit -m "feat(#92): phase-3 dual-wave ground pound (33% chance)"
```

---

## Task 8: Add `sfxSlam` audio and camera shake, wire to slam impact

**Files:**
- Modify: `game.js` — audio module (`sfxSlam` function + export), camera declaration (`shakeTimer`, `shakeMag`), draw loop (apply shake offset), slam-impact block in `updateBigfoot` (trigger shake + swap sfx).

- [ ] **Step 1: Add `sfxSlam` to the audio synth**

In the audio module (game.js ~4870), add after the existing `sfxStomp` line:

```js
  function sfxSlam()      { sfx(() => { oscSweep('sine', 120, 40, 0.28, 0.32); noise(0.20, 0.18, 400); oscSweep('sawtooth', 80, 30, 0.18, 0.18); }); }
```

And add `sfxSlam` to the returned object (~line 5091):

```js
    sfxJump, sfxStomp, sfxSlam, sfxCollect, sfxHurt, sfxWater, sfxSpray, sfxBonus,
```

- [ ] **Step 2: Add camera shake fields**

At game.js ~848, change:

```js
const cam = { x: 0, y: 0 };
```

To:

```js
const cam = { x: 0, y: 0, shakeTimer: 0, shakeMag: 0 };

function triggerCamShake(magnitude, ticks) {
  cam.shakeTimer = ticks;
  cam.shakeMag = magnitude;
}
```

- [ ] **Step 3: Apply shake offset inside `drawBossArena`**

The shake only needs to apply during the boss fight. Rather than threading an offset through every inner draw call, wrap `drawBossArena` by offsetting `cam.x` on entry and restoring on exit.

Open `drawBossArena` at `game.js:3932`. Replace the first two lines:

```js
function drawBossArena() {
  if (!bossArena) return;
  const boss = bossArena.boss;
```

With:

```js
function drawBossArena() {
  if (!bossArena) return;
  const boss = bossArena.boss;

  // Camera shake: decay + alternating ±offset applied for this frame only.
  let shakeOffset = 0;
  if (cam.shakeTimer > 0) {
    cam.shakeTimer--;
    shakeOffset = cam.shakeMag * ((game.tick % 2) ? 1 : -1);
    cam.shakeMag *= 0.9;
    cam.x += shakeOffset;
  }
```

Now scroll to the end of `drawBossArena` (the `}` that closes it). Before the closing brace, add:

```js
  if (shakeOffset !== 0) cam.x -= shakeOffset;
}
```

(If `drawBossArena` has early-return paths inside, also restore the offset before each. As of this plan, it does not, so the single restore above is sufficient. Verify by grep:

```bash
grep -n "return" game.js | head
```

Confirm no `return` inside `drawBossArena`'s body.)

This keeps the shake visual-only; `cam.x` is unchanged for the next update pass.

- [ ] **Step 4: Trigger shake and swap audio on slam impact**

In `updateBigfoot`'s slam-impact block (Task 5 Step 4), replace:

```js
        audio.sfxStun();
```

With:

```js
        audio.sfxSlam();
        triggerCamShake(3, 6);
```

- [ ] **Step 5: Playtest**

Dev server, warp to bigfoot, force ground pound a few times.

Expected:
- On impact, the view shakes horizontally for ~6 ticks, ±3px, decaying.
- Slam sfx is lower and heavier than before.
- No shake when Bigfoot isn't slamming.
- Mothman and Thunderbird are unaffected.

- [ ] **Step 6: Run all Bigfoot scenarios again — they should still pass (shake is purely visual)**

```bash
cd qa
node runner.mjs scenarios/bigfoot-pound-substates.mjs
node runner.mjs scenarios/bigfoot-dual-wave.mjs
node runner.mjs scenarios/bigfoot-shockwave-left.mjs
node runner.mjs scenarios/boss-warp.mjs
```

- [ ] **Step 7: Commit**

```bash
git add game.js
git commit -m "feat(#92): sfxSlam audio + camera shake on ground-pound impact"
```

---

## Task 9: Difficulty rebalance

**Files:**
- Modify: `game.js` — roll-probability table in `updateBigfoot`'s `land` branch, `stateTimer` values in `stagger` and `land` transitions.

- [ ] **Step 1: Bump `groundPoundChance` and `leapChance` per the design table**

In `updateBigfoot`'s `land` branch (game.js ~1515) replace:

```js
      const leapChance      = boss.phase === 3 ? 0.55 : boss.phase === 2 ? 0.62 : 0.70;
      const groundPoundChance = boss.phase >= 2 ? 0.22 : 0;
```

With:

```js
      const leapChance        = boss.phase === 3 ? 0.42 : boss.phase === 2 ? 0.52 : 0.56;
      const groundPoundChance = boss.phase === 3 ? 0.40 : boss.phase === 2 ? 0.35 : 0.20;
```

The remainder (boulders) works out to phase-1 0.24, phase-2 0.13, phase-3 0.18.

- [ ] **Step 2: Update the stagger-state duration (post-slam vulnerability window)**

In the slam-impact block from Task 5 Step 4 / Task 8 Step 4, the stagger duration already uses:

```js
boss.stateTimer = boss.phase === 3 ? 18 : boss.phase === 2 ? 22 : 28;
```

Confirm this line exists from Task 5. If not (e.g. the stagger still uses the old `28`), update it here.

- [ ] **Step 3: Update the post-pound pause (time in `land` before next attack)**

In the `stagger` branch (game.js ~1589) replace:

```js
  } else if (boss.state === 'stagger') {
    if (boss.stateTimer <= 0) {
      boss.vulnerable = false;
      const pauseTime = boss.phase === 3 ? 15 : 30;
      boss.state = 'land';
      boss.stateTimer = pauseTime;
    }
  }
```

With:

```js
  } else if (boss.state === 'stagger') {
    if (boss.stateTimer <= 0) {
      boss.vulnerable = false;
      const pauseTime = boss.phase === 3 ? 12 : boss.phase === 2 ? 16 : 24;
      boss.state = 'land';
      boss.stateTimer = pauseTime;
    }
  }
```

- [ ] **Step 4: Write a quick probability-smoke test**

Create `qa/scenarios/bigfoot-frequency.mjs`:

```js
function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }

export default async function scenario(game) {
  await game.warpToLevel(11);
  await game.waitFrames(10);
  await game.page.evaluate(() => { window.bossArena.boss.hp = 4; window.bossArena.boss.phase = 2; });

  // Let the boss cycle through ~50 attacks at phase 2; count ground pounds.
  let pounds = 0;
  let totalAttacks = 0;
  let lastState = null;
  for (let i = 0; i < 60 * 60; i++) { // up to 1 minute of simulation
    await game.waitFrames(1);
    if (totalAttacks >= 50) break;
    const s = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (s.state !== lastState && ['leap', 'groundpound', 'windup'].includes(s.state) && lastState !== 'groundpound' && lastState !== 'leap' && lastState !== 'windup') {
      totalAttacks++;
      if (s.state === 'groundpound') pounds++;
    }
    lastState = s.state;
  }
  const ratio = pounds / totalAttacks;
  console.log(`Phase 2: ${pounds}/${totalAttacks} pounds (${(ratio * 100).toFixed(0)}%)`);
  // Loose bounds because 50 samples is noisy; target is 0.35.
  assert(ratio > 0.15 && ratio < 0.55, `phase-2 pound ratio ${ratio} outside expected range`);
}
```

Run:

```bash
node runner.mjs scenarios/bigfoot-frequency.mjs
```

Expected: pound ratio in 15%–55% band. If it's wildly off (e.g. 0%), the chance adjustment didn't land.

- [ ] **Step 5: Playtest — feel check**

Dev server, full boss fight, no HP-hack. Verify:
- Phase 1 now has ground pounds appearing (previously 0).
- Phase 3 feels notably more aggressive — dual-wave forces jumps, shorter recovery windows mean less free hit time.
- Not *impossibly* hard. If playtests feel unfair, reduce phase-3 `groundPoundChance` from 0.40 to 0.32 and re-run.

- [ ] **Step 6: Commit**

```bash
git add game.js qa/scenarios/bigfoot-frequency.mjs
git commit -m "feat(#92): rebalance Bigfoot attack probabilities + timings"
```

---

## Task 10: Documentation updates

**Files:**
- Modify: `LEVEL_DESIGN.md` — new subsection under the Bigfoot section.
- Modify: `CLAUDE.md` — update the Section map if line numbers shifted substantially (check, update only if off by >50 lines).

- [ ] **Step 1: Update `LEVEL_DESIGN.md`**

Append a new subsection in the Bigfoot section documenting the ground-pound mechanic:

```markdown
### Bigfoot ground-pound (hop-and-slam)

The ground pound is a four-sub-phase animation tracked by `boss.poundSubPhase`:

| Sub-phase | Duration (p1 / p2 / p3) | Behavior |
|---|---|---|
| squat | 8 / 7 / 6 ticks | Body squashes, anticipation |
| rise  | 10 / 8 / 7 ticks | Bigfoot hops ~40 px off ground, arms raise |
| hold  | 10 / 9 / 7 ticks | Held airborne, eyes glow orange — "jump now" |
| slam  | 12 / 10 / 8 ticks | Fast descent. Impact = shockwave(s) spawn. |

Each shockwave is a crescent ripple with a `60 × 40 px` hitbox centered on `sw.x` at `BOSS_GROUND_Y`. Waves travel until `maxTravel = 500 px` or a wall.

**Phase 3 dual-wave:** ~33% of phase-3 pounds fire two crescents in opposite directions simultaneously (`boss.poundIsDual === true`). A second orange aura around Bigfoot during the `hold` sub-phase telegraphs the dual-wave.

**Speeds:** 7 px/tick (phases 1–2), 8 px/tick (phase 3).

**Vulnerability:** `stagger` state after impact — 28 / 22 / 18 ticks per phase. Bear spray connects only during stagger or in the air.
```

- [ ] **Step 2: Verify line-number accuracy in CLAUDE.md Section map**

Re-read the Section map table in `CLAUDE.md` (the "Sections in `game.js`" table). After all code changes, check each section header's line number is within ~50 of the current. If any is off by more, update the table.

```bash
grep -n "==================== " game.js | head -30
```

Compare that output to the section map in `CLAUDE.md`. Update if drift > 50 lines.

- [ ] **Step 3: Commit**

```bash
git add LEVEL_DESIGN.md CLAUDE.md
git commit -m "docs(#92): document Bigfoot hop-and-slam ground pound + phase-3 dual-wave"
```

---

## Task 11: Final QA scenario bundle

**Files:**
- Create: `qa/scenarios/bigfoot-ground-pound.mjs` — consolidated Bigfoot scenario that screenshots each sub-phase and verifies all behaviors.

- [ ] **Step 1: Write the consolidated scenario**

```js
function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }
async function waitFor(game, predicate, timeout = 180) {
  for (let i = 0; i < timeout; i++) {
    await game.waitFrames(1);
    const s = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (predicate(s)) return s;
  }
  return null;
}

export default async function scenario(game) {
  await game.warpToLevel(11);
  await game.waitFrames(20);

  // Phase 2: screenshot each sub-phase
  await game.page.evaluate(() => { window.bossArena.boss.hp = 4; window.bossArena.boss.phase = 2; });
  await game.page.evaluate(() => window.trailBlazerDebug.forceBossAttack('groundpound'));

  const squat = await waitFor(game, s => s.poundSubPhase === 'squat');
  assert(squat, 'never entered squat');
  await game.screenshot('bigfoot-pound-1-squat');

  const rise = await waitFor(game, s => s.poundSubPhase === 'rise');
  assert(rise, 'never entered rise');
  await game.screenshot('bigfoot-pound-2-rise');

  const hold = await waitFor(game, s => s.poundSubPhase === 'hold');
  assert(hold, 'never entered hold');
  await game.screenshot('bigfoot-pound-3-hold');

  const slam = await waitFor(game, s => s.poundSubPhase === 'slam');
  assert(slam, 'never entered slam');
  await game.screenshot('bigfoot-pound-4-slam');

  const wave = await waitFor(game, s => s.shockwaves.length > 0, 60);
  assert(wave && wave.shockwaves.length === 1, 'expected single wave after phase-2 pound');
  await game.screenshot('bigfoot-crescent');

  // Phase 3 dual-wave
  await waitFor(game, s => s.state === 'land', 180);
  await game.page.evaluate(() => { window.bossArena.boss.hp = 2; window.bossArena.boss.phase = 3; });
  await game.page.evaluate(() => window.trailBlazerDebug.forceBossAttack('groundpound-dual'));

  const dualHold = await waitFor(game, s => s.poundSubPhase === 'hold' && s.poundIsDual);
  assert(dualHold, 'dual hold not observed');
  await game.screenshot('bigfoot-dual-hold');

  const dualWave = await waitFor(game, s => s.shockwaves.length >= 2, 60);
  assert(dualWave && dualWave.shockwaves.length === 2, 'expected two simultaneous waves');
  await game.screenshot('bigfoot-dual-wave');

  console.log('Full Bigfoot scenario PASSED.');
}
```

- [ ] **Step 2: Run it**

```bash
node runner.mjs scenarios/bigfoot-ground-pound.mjs
```

Expected: `Full Bigfoot scenario PASSED.` Screenshots populated in `qa/screenshots/`.

- [ ] **Step 3: Eyeball the screenshots**

```bash
ls qa/screenshots/bigfoot-*
```

Open each PNG. Verify:
- squat: Bigfoot compressed, grounded.
- rise: mid-hop, arms going up.
- hold: airborne, arms up, orange eyes.
- slam: descending / just-landed, body squashed.
- crescent: one brown arc visible beside Bigfoot.
- dual-hold: orange aura around torso, arms up.
- dual-wave: two arcs, one on each side.

- [ ] **Step 4: Run the full scenario suite**

```bash
node runner.mjs scenarios/boss-warp.mjs
node runner.mjs scenarios/bigfoot-shockwave-refactor.mjs
node runner.mjs scenarios/bigfoot-shockwave-left.mjs
node runner.mjs scenarios/bigfoot-pound-substates.mjs
node runner.mjs scenarios/bigfoot-dual-wave.mjs
node runner.mjs scenarios/bigfoot-frequency.mjs
node runner.mjs scenarios/bigfoot-ground-pound.mjs
```

All pass.

- [ ] **Step 5: Commit**

```bash
git add qa/scenarios/bigfoot-ground-pound.mjs
git commit -m "test(#92): consolidated Bigfoot ground-pound Playwright scenario"
```

---

## Task 12: Final manual playtest and PR

- [ ] **Step 1: Play the full Bigfoot fight end-to-end**

From menu → warp to level 11 (no HP hacks) → fight Bigfoot from 8 HP to 0.

Checklist:
- [ ] Phase 1: ground pounds appear and are readable (you can see the hop and jump over the wave).
- [ ] Phase 2: more frequent pounds, wave animation consistent.
- [ ] Phase 3: dual-wave occasionally fires, forcing a jump; telegraphed by the dual aura; leftward waves now actually hurt you (try running left of Bigfoot).
- [ ] Camera shake fires on each slam, is not nauseating.
- [ ] Slam sound is heavier than the Thunderbird stun.
- [ ] Victory music fires on kill as before (regression check).

If anything feels off, address it before moving on. Tuning targets: phase-3 `groundPoundChance`, dual-wave share (0.33), shake magnitude (3).

- [ ] **Step 2: Verify the git log is clean**

```bash
git log --oneline master..HEAD
```

You should see roughly 10 commits, each scoped to one task. Squash only if a commit was for a broken intermediate state that's now a distraction to reviewers.

- [ ] **Step 3: Push and open PR**

```bash
git push -u origin issue-92-bigfoot-ground-smash
gh pr create --title "Bigfoot ground smash overhaul (#92)" --body "$(cat <<'EOF'
## Summary
- Hop-and-slam windup animation for Bigfoot's ground pound (squat → rise → hold → slam, clear player-readable telegraph).
- Crescent-ripple shockwave replaces the misleading flat trail; hitbox matches visible silhouette.
- Phase-3 dual-wave (~33% chance) fires waves in both directions — forces a jump, no more free dodge to the wall.
- Fixed latent hitbox bug where leftward waves never moved off `x: 0` — players running left were invulnerable to the attack.
- Rebalanced attack probabilities: ground pound now appears in phase 1 (0% → 20%); phase 3 jumps to 40%.
- Added `sfxSlam` audio and a 6-tick camera shake on impact for feel.
- New Playwright scenarios cover all sub-phase transitions, dual-wave emission, leftward-wave hitbox regression, and frequency smoke-check.

closes #92

## Test plan
- [ ] `cd qa && node runner.mjs scenarios/bigfoot-ground-pound.mjs` passes
- [ ] All other `qa/scenarios/bigfoot-*.mjs` pass
- [ ] Manual playthrough of level 11 from full HP to 0
EOF
)"
```

---

## Self-Review Summary

This section documents checks run against the spec — no action items for the executor.

**Spec coverage:**
- §1 Windup hop-and-slam → Tasks 5, 6
- §2 Shockwave crescent + hitbox fix → Tasks 3, 4
- §3 Difficulty rebalance → Task 9
- §4 Impact feedback (shake + slam sfx) → Task 8
- §5 Docs updates → Task 10
- §6 QA scenario → Tasks 2–11 each contribute; consolidated in Task 11
- Latent leftward-wave bug → Task 3

**Data/state changes from spec:**
- `boss.shockwaves` array → Task 2
- `poundProgress`, `poundSubPhase`, `poundSubTimer`, `poundIsDual` → Tasks 5, 7
- `cam.shakeTimer`, `cam.shakeMag` → Task 8
- `audio.sfxSlam` → Task 8

No placeholders. No undefined references across tasks (every symbol used in a later task is introduced in an earlier one: `BIGFOOT_POUND_TICKS` in T5, `forcedNextAttack` in T1, `poundIsDual` in T5 referenced in T7, `triggerCamShake` in T8).
