# Boss Levels Design — Trail Blazer
**Issue:** #78  
**Date:** 2026-04-11  
**Status:** Approved

---

## Overview

Add three cryptid boss encounters to Trail Blazer, one after every three normal levels, with escalating difficulty. Boss levels break from the side-scrolling format into fixed-arena dodge fights. The final boss — Bigfoot — is the climax of the entire run.

---

## Level Structure

The game expands from 9 to 12 levels. Boss levels are inserted as standalone entries in `LEVELS[]` at indices 3, 7, and 11 (1-indexed: levels 4, 8, 12):

| # | Name | Type |
|---|------|------|
| 1 | Northern Terminus | Normal |
| 2 | Pasayten Wilderness | Normal |
| 3 | Glacier Peak | Normal |
| **4** | **Thunderbird Encounter** | **Boss 1** |
| 5 | Alpine Lakes | Normal |
| 6 | Goat Rocks | Normal |
| 7 | Bridge of the Gods | Normal |
| **8** | **Mothman of Shasta** | **Boss 2** |
| 9 | Oregon Cascades | Normal |
| 10 | Sky Lakes | Normal |
| 11 | Castle Crags | Normal |
| **12** | **Bigfoot** | **Boss 3 (Final)** |

---

## Arena Model

### Virtual World Coordinates

Each boss arena is a virtual world of **1600×800 units**, independent of actual canvas dimensions. The viewport is a window into this world — no scaling, just pan. This handles all screen sizes (desktop 800×480, mobile landscape ~844×390, mobile portrait CSS-scaled) without cramping.

- **Ground:** `worldY = 720`, full 1600-unit width
- **Player spawn:** `(800, 690)`
- **Boss start:** `(800, 200)`, moves in upper half of world

### Camera

The camera biases so the player sits near the bottom of the viewport, maximizing visible arena above:

```js
cam.x = player.x - W * 0.50;
cam.y = player.y - H * 0.80;  // player at 80% down — action visible above
// clamped to arena world bounds
```

On a 390px-tall mobile landscape viewport, ~312px of screen shows arena above the player.

### HUD

Health bar, lives, and timer are drawn in **screen-space** (proportional to `W`/`H`), not world coordinates — they stay fixed on screen regardless of camera position.

---

## Arena Mechanics

### Player Movement
Full left/right movement and jump on the ground platform. Same physics constants as normal levels (`JUMP_FORCE`, `GRAVITY_FORCE`, `MOVE_SPEED`). No new input bindings needed.

### Bear Spray
- Fires a projectile toward the boss's current world position (auto-aimed)
- Unlimited ammo — the challenge is earning vulnerability windows
- Same input: `X` / `F` keys, or the spray touch button on mobile

### Taking Damage
- A boss hit costs one player life (same as normal levels)
- Brief invincibility window after being hit prevents multi-hit from a single attack

### Victory / Defeat
- **Defeat:** normal game over screen
- **Victory:** brief boss-defeated splash, then standard `levelcomplete` screen flowing into the next normal level

---

## Game State Integration

Boss levels add one new game state: **`boss`**.

`loadLevel(n)` checks `LEVELS[n].isBoss`. If true, `game.state = 'boss'` instead of `'playing'`. The existing `update()` and `draw()` dispatch branches add `boss` alongside `playing`, `levelcomplete`, etc.

Boss level entries in `LEVELS[]` use `isBoss: true` and boss-specific config fields (type, bossHealth, phases) instead of `build()` / `spawnEnemies()`.

On boss victory: `game.state = 'levelcomplete'` — no new screens required.

---

## Boss Designs

### Boss 1 — Thunderbird *(after Glacier Peak)*

**Theme:** Giant Pacific Northwest raptor with electric-blue wing highlights. Drawn with canvas arcs and triangles.

**Phases:** None (single escalating pattern — intro boss)

**Attack — Diving Swoop:**
- Thunderbird patrols the upper third of the arena horizontally
- Telegraphs with a lightning-flash along the swoop path (~0.5s window)
- Dives in a diagonal arc toward the player's current X, then retreats
- As HP drops, telegraph shortens and swoop speed increases

**Vulnerability window:** Apex at the bottom of the swoop

**Health:** 3 hits

---

### Boss 2 — Mothman of Shasta *(after Bridge of the Gods)*

**Theme:** Dark moth silhouette with glowing red eyes. Drawn with canvas primitives.

**Phases:** 2

**Phase 1 (5–3 HP):**
- Hovers and fires spreads of 3 light orbs aimed at the player's position
- Brief freeze after each volley = vulnerability window
- Player dodges the spread, then sprays during the freeze

**Phase 2 (≤ 2 HP):**
- Adds a horizontal ground-level charge between volleys
- Telegraphed by eyes brightening
- Player jumps to dodge; Mothman is vulnerable in the post-charge stall

**Health:** 5 hits

---

### Boss 3 — Bigfoot *(after Castle Crags — final boss)*

**Theme:** Massive sasquatch silhouette in dark brown, taller than the arena's upper third. Drawn with canvas primitives.

**Phases:** 3

**Phase 1 (8–6 HP):**
- Throws boulders in arcing trajectories from a fixed position
- Throw wind-up (arms raised) = vulnerability window
- Player dodges boulders, sprays during wind-up

**Phase 2 (5–3 HP):**
- Adds ground-pound: Bigfoot leaps and crashes down, sending a ground shockwave
- Player jumps the shockwave; Bigfoot is vulnerable in the landing stagger

**Phase 3 (2–1 HP):**
- Both attacks active simultaneously at faster tempo
- Telegraphed by a roar animation ("rage" moment) giving the player a moment to prepare

**Health:** 8 hits

---

## Scoring

| Bonus | Value | Condition |
|-------|-------|-----------|
| Speed bonus | `min(500, floor(50 * 1.04^timeDiff))` | Same formula as normal levels |
| Speed penalty | `floor(timeDiff * 2)` pts/sec | Over target time |
| No-hit bonus | +500 pts | Zero damage taken during the boss fight |

**Target times** (tuned during implementation via playtesting):
- Thunderbird: 30s
- Mothman: 60s
- Bigfoot: 90s

No Leave No Trace or Trail Angel bonuses on boss levels (no items or stompable enemies).

---

## Visual Style

All boss visuals are drawn with Canvas 2D primitives (arcs, beziers, fillRect) — no sprites or images, consistent with the rest of the game. Color palette uses the existing `C` object where possible, with boss-specific accent colors (Thunderbird: electric blue; Mothman: red glow; Bigfoot: dark brown/shadow).
