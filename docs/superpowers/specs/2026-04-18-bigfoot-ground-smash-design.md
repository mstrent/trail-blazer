# Bigfoot Ground Smash Overhaul — Design Spec

**Issue:** #92 — "Bigfoot last boss ground smash effect"
**Date:** 2026-04-18
**Author:** Matt Trent (w/ Claude)

## Problem

The Bigfoot boss's ground-pound attack is unreadable and too weak:

1. **No windup animation.** Bigfoot stands motionless for ~45 ticks before the shockwave appears, giving the player no anticipatory cue.
2. **Misleading shockwave visual.** The current rendering fills a flat brown rectangle from the wave's leading edge to the arena wall, which reads as "this whole strip hurts." In fact only a 60×30 box at the leading edge is a hitbox — and the hitbox for a *leftward* wave is bugged, stuck at `x: 0` regardless of the wave's position.
3. **Low difficulty.** Ground pound is 0% in phase 1 and only 22% in phase 2–3. The player can largely ignore the attack.

## Goals

- Every ground pound has a clear, readable windup the player can time a jump against.
- The shockwave's visual silhouette *is* the hurt zone. No ambiguity.
- Bigfoot feels meaningfully dangerous across all three phases.
- Fix the latent leftward-wave hitbox bug.

## Non-Goals

- No new attack types beyond the existing leap / boulder-throw / ground-pound set.
- No changes to damage amount — all hits remain 1 HP (consistent with rest of game).
- No changes to Bigfoot's HP, phase boundaries, rage behavior, or arena.
- No changes to Thunderbird or Mothman.

## Design

### 1. Windup: Hop-and-Slam Animation

Replaces the static `groundpound` state. The state remains named `groundpound` but now animates through four sub-phases via a new `boss.poundProgress` field (0 → 1 lerp across the full windup).

| Sub-phase | Duration (p1 / p2 / p3) | Animation |
|---|---|---|
| **Squat** | 8 / 7 / 6 ticks | Body y-squashes (~8px compress). Arms drop low. |
| **Rise** | 10 / 8 / 7 ticks | Body leaves ground, rises to ~40px airborne. Arms raise overhead. |
| **Hold** | 10 / 9 / 7 ticks | Held at peak. Arms fully raised. Eyes glow orange (reuses the existing phase-3 eye color across all phases for this one moment). This is the "jump now" beat. |
| **Slam** | 12 / 10 / 8 ticks | Fast descent (ease-in). Arms rotate down. On final tick: body squash, particle burst, shockwave(s) spawn, slam SFX. |

**Totals:** 40 ticks (phase 1) / 34 (phase 2) / 28 (phase 3). Phase 3 is noticeably snappier, cutting reaction time.

**Implementation:** Animation reads `boss.poundProgress` plus a new sub-phase index. The existing `drawBigfoot` function gets new branches keyed on `boss.state === 'groundpound'` that apply:

- y-offset for the hop (quadratic-ease-out on rise, quadratic-ease-in on slam)
- y-scale squash factor (0.92 during squat, 1.0 neutral, 0.85 on slam impact for ~6 ticks)
- arm lerp (reuses the existing `arm` variable)

No new pose geometry. No sprite work.

### 2. Shockwave: Crescent Ripple

Replaces the flat trailing rectangle.

**Data structure.** Rename `boss.shockwave` (singular) to `boss.shockwaves` (array) to support the phase-3 dual-wave. Each wave object:

```js
{ x, y: BOSS_GROUND_Y, dir: +1 | -1, speed, travelled: 0, maxTravel: 500, active: true }
```

Alpha decay is removed in favor of a hard `maxTravel` distance cap. Deterministic and easier to reason about.

**Visual (per wave, drawn in `drawBigfoot`'s wave-draw loop):**

- A crescent arc, ~60px wide × 40px tall, centered on `(sw.x, BOSS_GROUND_Y)`.
  - Outer curve: quadratic from `(x - 30, ground)` over `(x, ground - 40)` to `(x + 30, ground)`.
  - Inner curve: quadratic with peak at `ground - 28`.
  - Fill: `#5a3a1a` (existing brown). Highlight edge: `#8a5a2a`, 2px.
- 2–3 dust-puff particles trail behind each tick via `spawnParticles(sw.x - sw.dir * 15, BOSS_GROUND_Y, '#a88655', 2, 2)`. Fade in ~20 ticks.
- A faint 1px ground crack (`rgba(42,26,10,0.3)`) can be drawn along the wave's traversed path and fades with the wave's death. Optional polish — cut if it adds complexity.

**Hitbox (per wave, per frame):**

```js
{ x: sw.x - 30, y: BOSS_GROUND_Y - 40, w: 60, h: 40 }
```

Same formula regardless of `dir`. This fixes the current bug where a leftward wave's hitbox was stuck at `x: 0`.

**Motion:**

- Speed: 7 px/tick (phases 1–2), **8 px/tick (phase 3)**.
- Each tick: `sw.x += sw.dir * sw.speed; sw.travelled += sw.speed;`
- Die when `sw.travelled >= sw.maxTravel` OR `sw.x < 0 || sw.x > BOSS_ARENA_W`.

**Dual wave (phase 3 only):**

- On each phase-3 ground-pound roll, ~33% chance the pound becomes a dual wave.
- On the slam impact frame, two wave objects are pushed into `boss.shockwaves` with `dir: +1` and `dir: -1`, both starting at `boss.x + boss.w / 2`.
- Player must jump; running to the arena edge is no longer a safe dodge.
- Visual telegraph during the `hold` sub-phase: if `poundIsDual` is true, add a second orange glow aura around Bigfoot's torso (layered over the normal hold pose). The single-wave version keeps the default hold pose unchanged. Small cue, rewards attentive players without making single-wave ambiguous.

### 3. Difficulty Rebalance

**Ground-pound probability per `land` → next-attack roll:**

| Phase | Current | New |
|---|---|---|
| 1 | 0% | **20%** |
| 2 | 22% | **35%** |
| 3 | 22% | **40%** (of which ~33% dual-wave) |

Remaining probability splits between leap and boulder-throw, approximately preserving the current ~70/30 ratio in favor of leap. Concrete target splits:

| Phase | Ground-pound | Leap | Boulder |
|---|---|---|---|
| 1 | 0.20 | 0.56 | 0.24 |
| 2 | 0.35 | 0.52 | 0.13 |
| 3 | 0.40 | 0.42 | 0.18 |

In phase 3, ~33% of the 0.40 ground-pound share becomes a dual-wave.

**Recovery (`stagger` state after a pound — vulnerability window):**

| Phase | Current | New |
|---|---|---|
| 1 | 28 ticks | 28 (unchanged — fair intro) |
| 2 | 28 | **22** |
| 3 | 28 | **18** |

**Post-pound pause (time in `land` before next attack):**

| Phase | Current | New |
|---|---|---|
| 1 | 30 | **24** |
| 2 | 20 | **16** |
| 3 | 15 | **12** |

**Damage:** unchanged. 1 HP per hit.

### 4. Impact Feedback (Polish)

**Camera shake on slam.** Add a `cam.shakeTimer` field and `cam.shakeMag`. Each frame during draw, if `shakeTimer > 0`, offset `cam.x` by `±shakeMag` on alternating frames (`game.tick % 2`), decrement timer, decay magnitude. Triggered on the slam impact frame with `shakeTimer = 6, shakeMag = 3`.

Wired only for the Bigfoot slam. Other events (Thunderbird swoop, Mothman hit) do not use it. This is the minimum-footprint implementation: one new state field, ~6 lines in the draw loop, one trigger call site.

**Audio.** Reuse existing `audio.sfxStomp` but add a variant `audio.sfxSlam()` with a lower pitch and longer decay (procedural synth — matches file's existing pattern). Triggered on slam impact.

### 5. Documentation Updates

**`LEVEL_DESIGN.md` — Bigfoot section:**

- Add: Windup phase names and tick counts (squat/rise/hold/slam).
- Add: Shockwave hitbox formula (`x = sw.x - 30, w = 60, y = BOSS_GROUND_Y - 40, h = 40`).
- Add: Dual-wave rule (phase 3 only, ~33% of phase-3 pounds).

**`CLAUDE.md` — Sections in `game.js` table:** update the ENEMIES / boss section line numbers if they shift substantially. No structural changes.

### 6. QA Scenario

New `qa/scenarios/bigfoot-ground-pound.mjs`:

1. Warp to Bigfoot (level 8).
2. Drain Bigfoot to phase 1 entry and force a ground-pound roll (via a debug hook if one already exists, otherwise wait and screenshot whenever it fires).
3. Screenshot each sub-phase: squat / rise / hold / slam.
4. **Regression test:** position the player to the *left* of Bigfoot, trigger a leftward wave, and verify `player.hurtTimer > 0` on the frame the wave reaches them (not the frame the wave spawns).
5. **Phase 3 dual-wave:** warp state, trigger several phase-3 pounds until a dual-wave fires, screenshot, verify `boss.shockwaves.length === 2` on the slam frame.

For deterministic firing: consider adding a `window.trailBlazerDebug.forceBossAttack('groundpound' | 'groundpound-dual')` hook. Small, testing-only, scoped to the debug API.

## Data / State Changes Summary

**New fields on `boss` (Bigfoot):**
- `poundProgress: number` — 0..1 across full windup
- `poundSubPhase: 'squat' | 'rise' | 'hold' | 'slam'`
- `poundSubTimer: number`
- `poundIsDual: boolean` — set when rolling a phase-3 pound

**Renamed/changed:**
- `boss.shockwave` (object | null) → `boss.shockwaves` (array). Initialize to `[]`.

**New fields on `cam`:**
- `shakeTimer: number` (default 0)
- `shakeMag: number` (default 0)

**New audio function:**
- `audio.sfxSlam()`

**Removed:**
- `boss.shockwave.alpha` — replaced by `travelled`/`maxTravel` logic.

## Risks & Mitigations

- **Animation timing feels off in practice.** The tick counts above are a starting point; the implementation plan should include a playtest pass with a debug overlay showing sub-phase + timer.
- **Dual-wave is too punishing.** If it overshadows leap, reduce phase-3 ground-pound share from 40% → 30%, or reduce dual-wave share from 33% → 20%. This is a one-number tune, no structural rework.
- **Camera shake is distracting.** Kept deliberately small (3px, 6 ticks). If the playtest says it's too much, drop to 2px/4 ticks or remove entirely — isolated behind one field.
- **Regression for the leftward-wave fix.** Existing players may have gotten used to the bug (running left is always safe). This is an unintended "free dodge" and fixing it is part of the goal, not a regression.

## Out of Scope

- Any rework of leap or boulder-throw.
- Any change to the boss arena, camera rules, or HP.
- Porting the shake/slam framework to other bosses.
