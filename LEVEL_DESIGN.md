# Trail Blazer — Level Design Reference

This document captures the physics constraints, tile rules, and hard-won lessons
from building and debugging all 9 levels. Read it before designing new levels or
adding enemies/objects to avoid repeating known pitfalls.

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

| Enemy | Function | Hitbox (w×h) | Pixel y offset | Patrol radius | Points |
|---|---|---|---|---|---|
| Marmot | `makeMarmot(tx, ty)` | 26 × 22 | `ty*32 − 4` | ±4 tiles | 100 |
| Mouse (Micro Bear) | `makeMouse(tx, ty)` | 16 × 12 | `ty*32 + 8` | ±5 tiles | 200 |
| Mosquito | `makeMosquito(tx, ty)` | 20 × 14 | `ty*32` (sine center) | whole level | 300 |
| Heavy Hiker | `makeHiker(tx, ty)` | 24 × 36 | `ty*32 − 12` | ±3 tiles | 75 |
| Redneck | `makeRedneck(tx, ty)` | 28 × 40 | `ty*32 − 12` | ±4 tiles | 150 |

### Spawn placement rules

1. **Verify the spawn tile is not solid.** Check every `fill(x1, y1, x2, y2, T_SOLID)`
   that covers the intended `(tx, ty)`. Enemies spawning inside solid tiles will be
   trapped and visually stuck in the ground.

2. **Verify the spawn tile is not water.** Enemies at water tiles don't walk —
   they are effectively removed from play and won't count toward Trail Angel.
   Use the fish system for water decoration instead.

3. **Verify the enemy won't fall into water.** A spawn tile of T_EMPTY is not
   sufficient — the enemy settles under gravity and may land inside a water zone
   if no solid tile interrupts the column above the water rows. See
   "Gorge-style vs. pit-style water zones" below.

3. **Verify the enemy can reach the player.** The player must be able to jump
   onto the enemy from above. If the enemy is below a `T_PLATFORM`, the player
   lands on the platform and cannot stomp. This makes the enemy unkillable,
   blocking the Trail Angel bonus.

4. **For surface placement:** if the surface tile is at row S, use `ty = S − 1`
   as a starting point and verify: `ty * 32 + h_offset + height < S * 32`.
   Physics will settle the enemy onto the surface. Example — mouse on surface
   at row 9: `makeMouse(tx, 8)` → pixel y = 264, bottom = 276; lands on solid
   at pixel 288 (row 9). ✓

5. **Patrol edges vs. ledge detection:** Ground enemies auto-reverse at their
   `patrolX1`/`patrolX2` bounds **and** at ledge edges (no solid/platform tile
   directly below their leading foot). Narrow platforms are safe — enemies
   won't walk off. You can place enemies on 2-tile-wide ledges without worrying
   about them falling.

### Gorge-style vs. pit-style water zones

The game has two distinct water-crossing structures. Knowing which style a zone
uses is critical for safe enemy placement.

**Gorge-style** (Knife Edge, Columbia Gorge, Lava Fields, etc.)

```
hline(x1, x2, 10, T_SOLID)   ← solid "bridge floor" at row 10 spans entire zone
fill(x1, 12, x2, 13, T_WATER) ← water below the bridge floor
```

Enemies spawned anywhere above row 10 in a gorge zone fall to the solid row 10.
They are safe and reachable.

**Pit-style** (Sky Lakes, Castle Crags First Gorge)

```
fill(x1, 11, x2, 11, T_EMPTY)  ← row 11 cleared (no bridge floor)
fill(x1, 12, x2, 13, T_WATER)  ← water at rows 12–13
                                   row 14 stays solid (base floor)
```

Enemies in pit-style zones fall all the way to row 14 — inside the water —
because there is no solid row 10 or 11 to stop them. The stepping stones
within pit-style zones are T_SOLID or T_PLATFORM at row 7–9, but enemies
spawned in-column anywhere between row 5 and row 11 will sail right past them
if the spawn column doesn't happen to be one of those stepping-stone tiles.

**Rule:** Never spawn a ground enemy (marmot, mouse, hiker, redneck) at a
column that lies inside a pit-style water zone unless the exact spawn column
has a T_SOLID tile at row ≤ 10 to catch the fall. Spawn outside the pit bounds
(before or after x1/x2) instead.

### Validating spawn positions with Python simulation

When building levels with many boulder fills, the only reliable way to confirm
enemy placement is to simulate the tile map in Python and check each spawn.
The diagnostic pattern:

```python
# Build the grid the same way the JS does
grid = [[T_EMPTY]*COLS for _ in range(ROWS)]
fill(0, 11, COLS-1, 14, T_SOLID)        # base floor
fill(8, 9, 11, 10, T_SOLID)             # boulder
# ... all other fills ...

def settle_row(grid, tx, ty, height_tiles):
    """Simulate gravity: return the row the enemy bottom lands on."""
    for row in range(ty, len(grid)):
        if grid[row][tx] == T_SOLID:
            return row  # lands on top of this row
    return None  # fell off bottom (shouldn't happen)

# Check each enemy spawn
for etype, tx, ty in spawns:
    if grid[ty][tx] == T_SOLID:
        print(f"BAD: {etype} at ({tx},{ty}) is inside solid")
    elif grid[ty][tx] == T_WATER:
        print(f"BAD: {etype} at ({tx},{ty}) is in water")
    else:
        # Simulate gravity: find the first solid tile below spawn
        land_row = settle_row(grid, tx, ty, 1)
        if land_row is not None:
            # Check if the column the enemy falls through contains water
            for row in range(ty, land_row):
                if grid[row][tx] == T_WATER:
                    print(f"BAD: {etype} at ({tx},{ty}) falls into water at row {row}")
                    break
```

The gravity-settling check catches the pit-style lake bug: spawn tile is T_EMPTY
(passes the naive check) but the enemy falls through water on its way to row 14.

**Fix strategy:** when a spawn is inside a solid block, walk `ty` upward (ty−1,
ty−2, ...) until `grid[ty][tx] == T_EMPTY`. If the column is fully solid, try
`tx ± 1` sideways. Never place an enemy at a position that isn't `T_EMPTY`.

**Important:** JS `for` loop conversion to Python loses the semicolon separator.
Split multi-statement JS lines (`fill(...); fill(...)`) before exec-ing.
Remove `return { map, COLS, ROWS }` — Python `exec` doesn't allow `return`
outside a function.

---

## Object Placement Rules (Items, TP Blooms)

All static game objects must be **terrain-snapped** at spawn time, because the
level's tile map is the ground truth and hand-coded `ty` values will often
conflict with terrain fills.

The canonical two-pass snap used in `makeItem` and `makeTPBloom`:

```js
// Pass 1: walk up out of solid/platform/water
while (placeTy > 0 && level.map[placeTy][tx] !== T_EMPTY) placeTy--;

// Pass 2: settle down to the nearest surface
while (placeTy < level.ROWS - 1 &&
       level.map[placeTy][tx] === T_EMPTY &&
       level.map[placeTy + 1][tx] === T_EMPTY) placeTy++;
```

Apply this pattern to **any new static object** placed at a tile coordinate.
Without it, objects will float in mid-air, render inside boulders, or appear
below the visible ground.

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

---

## Decorative Fish

Fish are auto-generated at level load from water tiles — no per-level spawn list needed.
`spawnFish()` scans every water tile and places a fish every 6 tiles.

### Containment rules

Fish use tile-based boundary detection, not a distance limit:

```js
// Before moving, check if the tile at the fish's leading edge is still T_WATER
const tileAhead = level.map[tileAheadY][tileAheadX];
if (tileAhead !== T_WATER) {
  f.vx *= -1; // reverse, don't move
} else {
  f.x = nextX;
}
```

**Do not use a fixed `swimRange` distance** — water pools are irregular shapes,
and a distance-based range will let fish swim through ground tiles at pool edges.
Tile-type checking guarantees fish stay inside their pool regardless of shape.

### Vertical bobbing

Use `f.y = f.baseY + Math.sin(f.phase) * amplitude` — **never** accumulate the
sine offset into `f.y` each tick. Accumulation causes vertical drift that moves
fish out of the water zone over time.

### Fish and Trail Angel

Fish are not in the `enemies` array and are never counted toward the Trail Angel
bonus. Keep it that way — fish are purely decorative.

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

## New Mechanics Reference

### TP Blooms (Trail Flowers)

Static ground hazard: shredded/soiled toilet paper left on the trail.

- Defined per-level in `spawnTPBlooms()`, returning an array of bloom objects
- Contact with player triggers `hurtPlayer()` + brief invincibility (same as enemy contact)
- **Not** destroyed on contact — player is just pushed through with invincibility frames
- Jump over them to avoid damage
- Visually: crumpled off-white tissue wad with brown-yellow stain puddle; intentionally gross
- **Terrain-snapped at spawn** — see Object Placement Rules above

```js
function makeTPBloom(tx, ty) {
  // terrain snap, then:
  return { x: tx*TS+6, y: placeTy*TS+16, w: 20, h: 16, active: true };
}
```

### Redneck Enemy

Patrols like a Hiker but throws beer can projectiles periodically.

- `throwTimer` counts down from a random value (120–240 ticks); on zero, fires a beer can
  in the direction the Redneck is currently facing, then resets (150–280 ticks)
- On stomp: drops a cosmetic `trashPile` object (not a hazard, player ignores it)
- Beer cans follow a gravity arc (`vy += 0.55`), collide with `T_SOLID` tiles and disappear,
  and call `hurtPlayer()` on contact
- Worth 150 points

### Beer Cans

Physics projectile spawned by Rednecks.

```js
function makeBeerCan(x, y, dir) {
  return { x, y, vx: dir * 4.5, vy: -2.5, w: 8, h: 12, alive: true };
}
```

- Gravity applied each tick (`vy += 0.55`, max 14)
- Removed when it hits a solid tile, goes off-screen, or hits the player
- Audio: `sfxBeerCan()` on throw **only when the redneck is on screen** (gated on `e.x - cam.x`); `sfxBeerCanHit()` on player contact. Without the gate, levels with multiple off-screen rednecks produce a constant cacophony of throw sounds.

---

## Trail Angel Bonus

The Trail Angel bonus requires killing **all enemies** in the level. This means
every enemy must be reachable and stompable by the player. Before shipping a level:

- Confirm no enemy is trapped in a pit below a one-way platform.
- Confirm no enemy spawns inside a solid fill (stuck in ground = unkillable).
- Confirm no enemy spawns in a water tile (will stand in water indefinitely).
- Confirm every enemy's surface is accessible from the normal player path.
- Fish are **not** enemies — they do not affect this bonus.

---

## History of Placement Bugs Fixed

| Issue | Root Cause | Fix Applied |
|---|---|---|
| 8 enemies stuck in ground (levels 1,3,5,6,7,9) | `ty` coordinate landed inside boulder `fill()` blocks | Python simulation identified each; `ty` shifted up to nearest clear tile |
| Items rendering in mid-air or inside ground | `makeItem` used raw `ty` with no terrain check | Two-pass terrain snap added to `makeItem` |
| TP Blooms inside ground (Pasayten level) | `makeTPBloom` used raw `ty` with no terrain check | Two-pass terrain snap added to `makeTPBloom` |
| Fish swimming through ground tiles at pool edges | Used distance-based `swimRange` for patrol limits | Replaced with tile-type check at leading edge |
| Fish drifting out of water vertically | Bob offset accumulated into `f.y` each tick | Changed to `f.y = f.baseY + sin(phase) * amplitude` |
| Inescapable gaps (original levels 1–3) | No floor / rescue platform too high to reach | Widened gaps, added water, centered rescue platform at ≤4 tiles |
| 2 marmots in Sky Lakes water, 1 hiker in Castle Crags gorge | Spawned inside pit-style lake zones; no solid row 10, so enemies fell to row 14 (inside water) — spawn tile was T_EMPTY, fooling the naive check | Moved spawns to columns outside pit bounds; added gravity-settling check to Python validator |
| Beer can sfx playing off-screen | `sfxBeerCan()` fired whenever throwTimer hit 0, regardless of redneck position relative to camera | Gated sound on screen X: `if (e.x - cam.x > -e.w && e.x - cam.x < W + e.w)` |
| TP Blooms at waterline (Bridge of the Gods and others) | `makeTPBloom` terrain-snap stops at the T_EMPTY row above T_WATER, placing the bloom exactly at the waterline | Added post-snap water guard: return `null` if tile below is T_WATER; all `spawnTPBlooms()` now call `.filter(Boolean)` |
