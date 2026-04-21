# Mothman Difficulty Rework — Design

**Issue:** [#98](https://github.com/mstrent/backpacking-game/issues/98) — Second boss, mothman of Shasta, too easy
**Date:** 2026-04-19

## Problem

Mothman currently feels about as easy as Thunderbird, not slotted between
Thunderbird (3 HP, single attack) and Bigfoot (8 HP, three attacks + rage
phase). The rage attack (horizontal charge) also feels disjointed: a
motionless 35-frame eye-glow windup, then an instant 14px/tick horizontal
velocity *plus* a diagonal Y-drop from hover height (~410) to near-ground.
Players read it as a teleport with a glitch.

## Goals

1. Bring Mothman's difficulty between Thunderbird and Bigfoot.
2. Make every attack windup → execute → recovery sequence visually coherent.
3. Add at least one new dodge skill the player must learn at this boss
   (something neither Thunderbird nor existing Mothman demands).

## Non-Goals

- Redesigning the Mothman sprite or arena.
- Adding a third phase (kept at two phases — keeps Bigfoot as the most
  complex fight).
- Changing scoring, HUD, or boss music.

## Boss Spec

### HP and Phases

- **HP: 6** (was 5).
- **Phase 1:** HP 6 → 4.
- **Phase 2:** HP ≤ 3. Boss enters phase 2 the moment HP drops to 3 or below.

`checkBossPhase` updates: `if (boss.hp <= 3 && boss.phase === 1) boss.phase = 2;`.

### Attack Roster

| Attack | Available  | Phase 1 weight | Phase 2 weight | Vulnerability after |
|--------|------------|----------------|----------------|---------------------|
| Orb spread | both | 100% | 40% | 22 frames |
| Eye beam   | phase 2 only | — | 35% | 28 frames |
| Charge     | phase 2 only | — | 25% | 18 frames |

Phase 1 keeps the simple orbs-only loop so the early fight teaches the
spray-up hit and reads cleanly. Phase 2 unlocks both new attacks at the
same time, so the difficulty ramp is sharp at HP ≤ 3.

### Attack 1: Aimed Orb Spread

Largely unchanged from current behavior:

- Boss enters `fire` state for 20 frames (windup), then emits 3 orbs in a
  horizontal spread aimed at the player's current position with `i * 80`
  lateral offset.
- Orb speed: **5** (phase 1, was 4); **6** (phase 2, was 5).
- After firing, boss enters `freeze` state, vulnerable for **22 frames**
  (was 30 / 20).

### Attack 2: Eye Beam (NEW, phase 2 only)

A new attack that adds a positional-dodge skill (step out of the locked
column during the telegraph).

**State sequence:** `beamWind` (30 frames) → `beam` (40 frames) → `beamRecover` (28 frames).

- **`beamWind` (30 frames):** Boss anchors mid-air at hover Y. Eyes glow
  (reuse `eyeGlow` field, ramp 0 → 1 over 30 frames). At windup start,
  the boss locks `beamTargetX` to the player's current center X. A
  pulsing red reticle (concentric rings + crosshair) is drawn on the
  ground at `(beamTargetX, BOSS_GROUND_Y)` for the full 30 frames, with
  faint dashed preview lines from each eye to the reticle. This is the
  player's read: "step out of that column."
- **`beam` (40 frames):** Two solid red beams shoot from each eye
  (`boss.x + 43` and `boss.x + 57` in world coords, both at
  `boss.y + 30` Y) and converge on the locked ground point
  `(beamTargetX, BOSS_GROUND_Y)`. White-hot core lines, red glow, and
  an orange impact disc at the ground.
  Beam hitbox: `{ x: beamTargetX - 16, y: eyeY, w: 32, h: BOSS_GROUND_Y - eyeY }`
  — a 32px-wide vertical column at the locked X, from eye-level to
  ground. Player takes damage if they're in this column. Dodge: move
  laterally out of the column during the windup (or stay out for the
  full beam phase). Damage check every frame; `hurtTimer` ensures at
  most one hit per beam. Boss is NOT vulnerable during `beam` (eyes are
  the weapon).
- **`beamRecover` (28 frames):** Boss is vulnerable. Eyes dim. No beam.
  After 28 frames, return to `hover`.

### Attack 3: Charge (rebuilt windup)

Current behavior keeps the *intent* (horizontal dash that closes the gap
and threatens to pin the player against an arena wall) but fixes the
"teleport" feel.

**State sequence:** `chargeWind` (30 frames, was 35) → `charge` (50 frames,
unchanged) → `stall` (18 frames, was 25).

- **`chargeWind` (30 frames):** Boss decides charge direction (toward
  player, same as today). Wings curl back, eyes glow up. Critically, the
  boss now *physically coils* — retreats in the **opposite** direction of
  the charge AND rises:
  - Retreat distance: **80 px** total over the 30 frames.
  - Per-frame X offset: `boss.x -= chargeDir * (80 / 30)` (using a stored
    `chargeRetreatPx` accumulator so we can clamp at arena edges).
  - Lift: boss Y eases up by **50 px** over the 30 frames
    (`boss.y = chargeAnchorY - 50 * liftT`), reaching peak Y at the end
    of the windup. Reads as the boss perching mid-air before the dive.
  - At `boss.x` near an arena edge, retreat is clamped (don't push
    out-of-bounds; the visible retreat distance shrinks but the windup
    duration is unchanged).
- **`charge` (50 frames):** Boss launches forward at `chargeDir * 14`
  px/tick from the retreated X. **Y follows a smooth sin arc** from the
  raised peak Y down to a low Y of **580** (boss bottom = 700, ~20 px
  above ground), then back up:
  `boss.y = peakY + (bottomY - peakY) * Math.sin(t * π)` where
  `t = 1 - stateTimer / 50`. The dive bottom (frame 25) overlaps the
  player's standing hitbox (player covers y=660–690), making body
  contact a real threat instead of a flyover. Contact damage on AABB
  overlap. Charge ends when the timer expires OR boss exits the arena
  (existing logic preserved). The arc is interpolated every frame, so
  there is no snap.
- **`stall` (18 frames):** Vulnerable. Boss freezes mid-arena where the
  charge ended. Then returns to `hover`.

### Phase 2 Pacing Bumps

- Hover time between attacks reduced: phase-1 hover is 60–90 frames; phase
  2 reduces to 35–55 frames (`50 + (Math.random() * 30 | 0)` becomes
  `35 + (Math.random() * 20 | 0)`).
- Orb speed bumped (covered above).
- Vulnerability windows are already attack-specific (per the table above),
  so no further per-phase tuning is needed.

## State Machine Summary

```
hover ──→ fire ──→ freeze ──┬──→ hover                      (phase 1, always)
                            ├──→ hover                      (phase 2, 40%)
                            ├──→ beamWind ──→ beam ──→ beamRecover ──→ hover  (phase 2, 35%)
                            └──→ chargeWind ──→ charge ──→ stall ──→ hover    (phase 2, 25%)
```

Existing post-freeze branching is replaced with a roll over the three
phase-2 weights (40/35/25). In phase 1, the freeze always returns to hover.

## Animation Notes

The "disjointed teleport" feel of the current charge comes from three
breaks the rework addresses:

1. **Motionless windup → visible motion windup.** The retreat-and-rise
   motion gives the player something to track; the boss visibly coils
   for the strike.
2. **Y-snap → continuous arc.** The dive Y is interpolated every frame
   along a sin arc from peak to dive-bottom and back. No teleport, and
   the body actually swoops through the player's hitbox at mid-arc.
3. **Position snap-back → natural recovery.** The 18-frame stall happens
   wherever the charge ended; the next hover cycle smoothly resumes from
   that position (existing hover code clamps to arena bounds).

For the eye beam, the 30-frame warning line is the telegraph. Color and
thickness ramp over the windup so the imminent threat reads at a glance.

## Implementation Touchpoints

All changes are within `game.js`:

- `makeBossMothman()` (line 1414): bump `hp` to 6; add fields
  `chargeDir`, `chargeRetreatPx`, `beamY`.
- `updateMothman(boss)` (line 1433): rewrite freeze→next-state branching
  for new weights; rewrite `chargeWind` for retreat motion; add
  `beamWind`, `beam`, `beamRecover` cases.
- `drawMothman(boss)` (line 1532): add eye-beam telegraph (dashed line),
  active beam (solid), and active-beam eye glow. Wing curl during
  `chargeWind` (already partially present via `flapAmp`; extend to a
  curled pose).
- `checkBossPhase(boss)` (line 2102): change phase-2 threshold from
  `hp <= 2` to `hp <= 3`.
- `drawBossHud()` / max-HP table (line 4419): bump `mothman: 5` → `6`.
- Per-attack vulnerability and timing constants live inline at the state
  transitions (consistent with how Thunderbird and Bigfoot are written).

## Risks and Open Questions

- **Beam column width vs reaction time.** A 32-px column is narrow
  enough to step out of in 30 frames (player walk speed 3.5 px/tick →
  ~105 px coverage), but wide enough that the player can't hover at the
  edge. *Tuning may be needed* — verify in playtest the dodge feels fair.
- **Beam target locks at windup start.** The player gets the full 30-frame
  windup as their dodge window. If they don't move, they get hit. This is
  the intended skill check.
- **Charge retreat near arena edges.** If the boss is already near the
  edge when it starts a charge windup, the retreat is clamped, so the
  visible windup motion is shorter. The windup *duration* is unchanged,
  so the player still gets their full read time. Acceptable degradation.
- **Phase 2 weight balance.** 40/35/25 is a starting point. If charge
  ends up dominating fights (e.g., player can't punish), shift weights
  toward orbs/beam in tuning.

## Out of Scope

- Adding new sound effects for the eye beam (will reuse `audio.sfxStun()`
  for telegraph and `audio.sfxSpray()` or similar for active beam — final
  pick during implementation).
- Touching the level-6 lead-in level or campfire screen.
- Changing the boss music or arena visuals.

## Acceptance

- Mothman runs feel measurably tougher than Thunderbird but easier than
  Bigfoot in scenario testing (target time of 60s per `bossDefeated`
  remains realistic).
- The charge attack reads as a coherent windup → strike → recover
  sequence in playtest (no "teleport" comments).
- Eye beam can be cleanly dodged by stepping laterally out of the
  reticle column during the 30-frame telegraph.
