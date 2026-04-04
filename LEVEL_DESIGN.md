# Trail Blazer — Level Design Reference

This document captures the physics constraints, tile rules, and hard-won lessons
from building and debugging Levels 1–3. Read it before designing new levels or
adding enemies to avoid repeating known pitfalls.

---

## Physics Constants

| Constant | Value | Notes |
|---|---|---|
| `TS` (tile size) | 32 px | All tile coordinates multiply by this |
| `PLAYER_W` | 20 px | Player hitbox width |
| `PLAYER_H` | 30 px | Player hitbox height |
| `JUMP_FORCE` | −12.5 px/tick | Initial vy on jump |
| `GRAVITY_FORCE` | 0.55 px/tick² | Applied every tick |
| `MAX_FALL` | 15 px/tick | Terminal fall velocity |
| `MOVE_SPEED` | 3.5 px/tick | Horizontal run speed |
| `GLISSADE_SPEED` | 7 px/tick | Slide move speed |

### Jump height

Max jump height = v² / (2g) = 12.5² / (2 × 0.55) ≈ **142 px ≈ 4.4 tiles**

This is the absolute ceiling — assume 4 tiles for conservative platform placement.
Platforms more than 4 tiles above the player's current floor are unreachable by jumping alone.

---

## Tile Types

| Constant | Value | Behavior |
|---|---|---|
| `T_EMPTY` | 0 | Air — no collision |
| `T_SOLID` | 1 | Blocks all movement |
| `T_PLATFORM` | 2 | One-way: player/enemies land from above only; can jump through from below |
| `T_WATER` | 3 | No collision; triggers `hurtPlayer()` every frame the player's feet touch it |

### Water damage check

```js
cy = Math.floor((player.y + player.h - 2) / TS)
damaged if: isWater(cx, cy) || isWater(cx, cy + 1)
```

Water at tile row Y damages the player when their feet reach pixel `Y * TS`.
Place water at **y = floor − 2 rows** (e.g., solid floor at y=11 → water at y=9–10)
to ensure it catches a standing player without requiring them to sink into solid.

### Platform one-way behavior (critical)

`T_PLATFORM` only stops **downward** movement. Enemies and players pass through
from below freely. This means:

- **An enemy that falls below a platform cannot be stomped from above** — the
  platform blocks the player's descent before they reach the enemy.
- Never place an enemy in a position where it can fall below its only platform,
  unless you intend it to be unreachable.

---

## Map Helpers

All helpers use **inclusive** tile ranges.

```js
set(x, y, tile)              // single tile
hline(x1, x2, y, tile)      // horizontal run, x1 to x2 inclusive
fill(x1, y1, x2, y2, tile)  // filled rectangle, inclusive on all sides
```

The base floor is always set first:
```js
fill(0, 11, COLS - 1, 14, T_SOLID); // rows 11–14 are solid ground
```

Floor surface is at **tile row 11** (pixel y = 352). Player standing on floor:
`player.y = 352 − 30 = 322`.

---

## Enemy Spawn Reference

All `make*` functions take tile coordinates `(tx, ty)`. The spawn pixel position
and hitbox differ per enemy — the ty value does **not** always correspond to the
tile the enemy stands on at rest; physics settles them after spawn.

| Enemy | Function | Hitbox (w×h) | Pixel y offset | Patrol radius |
|---|---|---|---|---|
| Marmot | `makeMarmot(tx, ty)` | 26 × 22 | `ty*32 − 4` | ±4 tiles |
| Mouse (Micro Bear) | `makeMouse(tx, ty)` | 16 × 12 | `ty*32 + 8` | ±5 tiles |
| Mosquito | `makeMosquito(tx, ty)` | 20 × 14 | `ty*32` (sine center) | whole level |
| Heavy Hiker | `makeHiker(tx, ty)` | 24 × 36 | `ty*32 − 12` | ±3 tiles |

### Spawn placement rules

1. **Verify the spawn column is not inside a solid fill.** Check every
   `fill(x1, y1, x2, y2)` that covers the intended tx column at the ty row.
   Enemies spawning inside solid tiles may clip through or become trapped.

2. **Verify the enemy can reach the player.** The player must be able to jump
   onto the enemy from above. If the enemy is below a `T_PLATFORM`, the player
   lands on the platform and cannot stomp. This makes the enemy unkillable,
   blocking the Trail Angel bonus.

3. **For surface placement:** if the surface tile is at row S, use `ty = S − 1`
   as a starting point and verify: `ty * 32 + h_offset + height < S * 32`.
   Physics will settle the enemy onto the surface. Example — mouse on surface
   at row 9: `makeMouse(tx, 8)` → pixel y = 264, bottom = 276; lands on solid
   at pixel 288 (row 9). ✓

4. **Patrol edges vs. ledge detection:** Ground enemies auto-reverse at their
   `patrolX1`/`patrolX2` bounds **and** at ledge edges (no solid/platform tile
   directly below their leading foot). Narrow platforms are safe — enemies
   won't walk off. You can place enemies on 2-tile-wide ledges without worrying
   about them falling.

---

## Pit and Gap Design

### The 1-tile gap problem

A 1-tile-wide gap with a rescue platform spanning its full width is not a hazard
— the player just lands on the platform as if it were solid ground. The gap is
invisible in practice.

### Recommended hazard pit pattern

Use **3-tile-wide gaps** with a **1-tile rescue platform centered** in the
middle column, and **water at the bottom** (2 tile rows above the solid floor):

```
←  wall  → ← gap: 3 tiles wide → ←  wall  →
           [col A][col B][col C]
                  [ PLAT ]          ← y=floor−4  (rescue platform, center only)
           [WATER][WATER][WATER]    ← y=floor−2
           [WATER][WATER][WATER]    ← y=floor−1
           [SOLID][SOLID][SOLID]    ← y=floor (base ground)
```

- Fall into col B → land on rescue platform → jump out (4 tiles up, within range)
- Fall into col A or C → land in water → take damage → navigate to col B to escape
- Two distinct outcomes from one gap; real risk without being a death trap

### Escape verification checklist

Before shipping any pit, confirm:

1. **Rescue platform is reachable from the pit floor.** Distance from floor to
   platform ≤ 4 tiles (128 px). Formula: `(floor_row − platform_row) * 32 ≤ 128`.
2. **Player can exit the platform upward.** The nearest solid/platform above the
   rescue platform must be ≤ 4 tiles away (or the player can jump sideways to
   a wall edge).
3. **No enemy is trapped below the rescue platform.** Any enemy that falls into
   the pit settles on the floor below the platform and becomes unkillable.
   Either keep enemies out of pit columns, or accept they won't count for Trail Angel.

---

## Inescapable Gaps: History

These were shipped in Level 3 and fixed across PRs #27–#31:

| Location | Root Cause | Fix |
|---|---|---|
| Waterfall gorge (x=47–68) | No floor — player fell into water with no ledge | Added solid rescue ledge at y=10 (PR #26) |
| Exposed ridge (x=105–138) | Same — open water with no escape surface | Same fix (PR #26) |
| Switchback pit x=93 | 1-tile gap, boxed by fills; nearest platform 7 tiles up | Widened to 3 tiles, added water, centered rescue platform at y=7 (PR #31) |
| Switchback pit x=99 | Same; mouse spawned inside gap, below rescue platform | Same widening fix; mouse relocated to stair surface (PR #31) |

---

## Trail Angel Bonus

The Trail Angel bonus requires killing **all enemies** in the level. This means
every enemy must be reachable and stompable by the player. Before shipping a
level:

- Confirm no enemy is trapped in a pit below a one-way platform.
- Confirm no enemy spawns inside a solid fill (it may clip to an unreachable position).
- Confirm every enemy's surface is accessible from the normal player path.
