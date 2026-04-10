# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

No build step. Open `index.html` directly in a browser, or serve locally:

```bash
python -m http.server 3000
# then visit http://localhost:3000
```

There are no tests, no linting tools, and no package.json. All verification is done by playing the game in a browser.

## Architecture

The entire game is ~3785 lines of vanilla JavaScript in a single IIFE in `game.js`. There are no modules, no transpilation, no dependencies beyond Firebase (loaded via CDN in `index.html`). All rendering uses Canvas 2D primitives — no sprite sheets or image assets.

### File Structure

- `index.html` — canvas element, touch control buttons, Firebase init, loads `game.js`
- `game.js` — entire game, wrapped in `(function() { 'use strict'; ... })()`
- `style.css` — layout/styling for canvas and touch controls

### Sections in `game.js` (in order)

| Section | Line | Purpose |
|---|---|---|
| SETUP | 7 | Canvas init, responsive resize for mobile landscape |
| INPUT | 39 | `keys`/`prev` objects, helper functions (`isLeft`, `isJump`, etc.) |
| TILE TYPES | 57 | Constants: `T_EMPTY=0`, `T_SOLID=1`, `T_PLATFORM=2`, `T_WATER=3` |
| LEVEL DEFINITIONS | 81 | `LEVELS[]` array — 9 level objects, each with `build()`, `spawnEnemies()`, `spawnTPBlooms()`, `spawnItems()` |
| CAMERA | 811 | `cam` object, smooth-follow `updateCamera()` |
| PARTICLES | 822 | Particle system for effects |
| ITEMS | 860 | `ITEM_DEFS`, `makeItem()` with terrain-snap, `spawnItems()` |
| ENEMIES | 911 | Factory functions: `makeMarmot`, `makeMosquito`, `makeHiker`, `makeMouse`, `makeRedneck`, `makeTPBloom`, `makeBeerCan`, `makeTrash` |
| FISH | 1012 | Decorative fish auto-spawned from water tiles; tile-boundary patrol |
| TRAIL RUNNERS | 1063 | Background animated hikers |
| PLAYER | 1237 | `makePlayer()`, `updatePlayer()` — physics, movement, bear spray, glissade |
| GAME STATE | 1532 | `game` object, `loadLevel()`, `initGame()`, `advanceLevel()` |
| LEADERBOARD | 1549 | Firebase Firestore top-10, `fetchLeaderboard()`, `submitScore()` |
| DRAWING | 1641 | All `draw*()` functions — color palette `C`, background parallax, terrain, HUD, enemies, player |
| SCREENS | 3024 | `drawMenu()`, `drawGameOver()`, `drawLevelComplete()`, `drawWin()` |
| MAIN LOOP | 3374 | `update()` and `draw()` dispatch by `game.state`; `requestAnimationFrame` loop at ~60fps |
| AUDIO | 3514 | Web Audio API synth — all sound effects generated procedurally, no audio files |
| TOUCH CONTROLS | 3704 | Mobile button bindings |
| BOOT | 3780 | `fetchLeaderboard()`, starts `requestAnimationFrame` loop |

### Game Loop

```
requestAnimationFrame → update() → draw()
```

`update()` dispatches on `game.state`: `menu`, `playing`, `levelcomplete`, `gameover`, `win`, `enterInitials`. During `playing`, order is: player → enemies → beer cans → fish → trail runners → particles → float texts → camera → increment `levelTick`.

### Level Structure

Each entry in `LEVELS[]` has:
- `build()` — returns `{ map, COLS, ROWS }` using `makeMap()` helper; populates via `set/hline/fill`
- `spawnEnemies()` — returns enemy objects from factory functions
- `spawnItems()` — returns item objects via `makeItem(type, tx, ty)`
- `spawnTPBlooms()` — returns bloom hazard objects via `makeTPBloom(tx, ty)`
- Metadata: `name`, `subtitle`, `section`, `campName`, `goalTile`, `spawnTile`

`loadLevel(num)` calls all four spawn functions plus `spawnFish()` and `spawnTrailRunners()`.

### Tile Grid

- `TS = 32` px — all coordinates multiply by this
- Canvas is 800×480 = 25×15 tiles visible
- Map is stored as `Uint8Array` rows; base floor is always `fill(0, 11, COLS-1, 14, T_SOLID)`
- Floor surface is tile row 11 (pixel y=352)

### Physics Constants (defined near line 1237)

| Constant | Value |
|---|---|
| `PLAYER_W` / `PLAYER_H` | 20 / 30 px |
| `JUMP_FORCE` | −12.5 px/tick |
| `GRAVITY_FORCE` | 0.55 px/tick² |
| `MAX_FALL` | 15 px/tick |
| `MOVE_SPEED` | 3.5 px/tick |
| `GLISSADE_SPEED` | 7 px/tick |

Max jump height ≈ 142 px ≈ **4 tiles**. Platforms more than 4 tiles above a standing player are unreachable.

## Level Design Rules

See `LEVEL_DESIGN.md` for the full reference. Critical constraints:

- **Enemy spawns must be `T_EMPTY`.** Enemies inside solid fills get stuck and are unkillable. Use a Python simulation to validate spawn positions when tile maps are complex.
- **Items and TP Blooms use two-pass terrain snap** — already built into `makeItem` and `makeTPBloom`. Do not hand-code pixel positions.
- **`T_PLATFORM` is one-way** (downward stops only). An enemy below a platform cannot be stomped; if it's the only access, it blocks the Trail Angel bonus.
- **Water placement:** put water at `y = floor − 2` rows so it catches a standing player.
- **Hazard pits:** use 3-tile-wide gaps with a 1-tile rescue platform at `floor − 4` (reachable by jumping), water in the outer columns.
- **Fish** are auto-spawned from water tiles — never add them manually to a level.

## Scoring

See `SCORING.md` for full rationale. Key values:
- Speed bonus: `min(500, floor(50 * 1.04^timeDiff))` — target time is 4× theoretical minimum
- Speed penalty: `floor(timeDiff * 2)` pts/sec over target
- Leave No Trace: +1000 pts (all items collected)
- Trail Angel: +1500 pts (all enemies defeated)

## Adding a New Enemy Type

1. Write a `makeXxx(tx, ty)` factory in the ENEMIES section returning the enemy object with `type`, position/size, `alive: true`, `stunTimer: 0`.
2. Add an `updateXxx(e)` function and call it from `enemies.forEach(updateEnemy)` in the main loop (add dispatch by `e.type`).
3. Add a `drawXxx(e)` function and dispatch it in both the `playing` and `gameover` draw paths.
4. Document hitbox, pixel y-offset, and patrol radius in `LEVEL_DESIGN.md`.

## Git Workflow

All work should follow this branch-based workflow:

1. **Start from an issue.** Every feature or fix should correspond to a GitHub issue. If one doesn't exist, create it first (`gh issue create`).

2. **Create a branch from master** named after the issue:
   ```bash
   git checkout master && git pull
   git checkout -b issue-NNN-short-description
   ```

3. **Reference the issue in commits and the PR.** Use `closes #NNN` in the PR body so GitHub auto-closes the issue on merge.

4. **Open a PR when the work is ready** using `gh pr create`. The PR description should include `closes #NNN`.

5. **After the PR is merged, clean up:**
   ```bash
   git checkout master && git pull
   git branch -d issue-NNN-short-description
   ```
   Any branches that were deleted on the remote but still exist locally (marked `[gone]`) can be bulk-removed with the `/clean_gone` skill.

**Never commit directly to master.** Always work on a branch, even for small fixes.

## Firebase / Leaderboard

Firebase config is in `index.html`. `window.db` is the Firestore instance. The leaderboard collection is `leaderboard` with fields `name`, `score`, `date`. Scores are fetched at boot and re-fetched after each submission.
