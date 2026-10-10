# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

No build step. Open `index.html` directly in a browser, or serve locally:

```bash
python -m http.server 3000
# then visit http://localhost:3000
```

There are no linting tools and no root-level package.json. The primary verification method is playing the game in a browser. For automated QA, see the `qa/` directory below.

## Architecture

The entire game is ~5750 lines of vanilla JavaScript in a single IIFE in `game.js`. There are no modules, no transpilation, no dependencies beyond Firebase (loaded via CDN in `index.html`). All rendering uses Canvas 2D primitives — no sprite sheets or image assets.

### File Structure

- `index.html` — canvas element, touch control buttons, Firebase init, loads `game.js`
- `game.js` — entire game, wrapped in `(function() { 'use strict'; ... })()`
- `style.css` — layout/styling for canvas and touch controls

### Sections in `game.js` (in order)

| Section | Line | Purpose |
|---|---|---|
| SETUP | 7 | Canvas element and context (`canvas`, `ctx`), logical size `W`/`H` (800×480), `TS` tile size |
| LAYOUT MODULE | 15 | `layout` object — maps the browser viewport to the logical canvas (scale, margins, `margin` vs. `canvas` overlay mode for touch). Writes CSS vars that `style.css` consumes. See `docs/superpowers/specs/2026-04-18-responsive-layout-design.md` |
| INPUT | 159 | `keys`/`prev` objects, helper functions (`isLeft`, `isJump`, etc.) |
| TILE TYPES | 208 | Constants: `T_EMPTY=0`, `T_SOLID=1`, `T_PLATFORM=2`, `T_WATER=3` |
| UTILITIES | 214 | Generic helpers shared across sections |
| LEVEL HELPERS | 223 | `makeMap()`, `set/hline/fill` tile-painting helpers |
| LEVEL DEFINITIONS | 232 | `LEVELS[]` array — 9 trail levels plus 3 boss-arena entries (`isBoss: true`). See "Level Structure" below |
| CAMERA | 998 | `cam` object, smooth-follow `updateCamera()` |
| PARTICLES | 1014 | Particle system for effects |
| ITEMS | 1052 | `ITEM_DEFS`, `makeItem()` with terrain-snap, `spawnItems()` |
| FLOATING TEXT | 1088 | Damage/score popup text overlay |
| ENEMIES | 1102 | Factory functions: `makeMarmot`, `makeMosquito`, `makeHiker`, `makeMouse`, `makeRedneck`, `makeTPBloom`, `makeBeerCan`, `makeTrash` |
| BOSS ARENA | 1205 | `initBossArena()`, shared arena constants (`BOSS_GROUND_Y`, `BOSS_SPAWN_X/Y`), and `makeBoss(type)` dispatch to `makeBossThunderbird` (1232), `makeBossMothman` (1414), `makeBigfoot` (1751) |
| FISH | 2283 | Decorative fish auto-spawned from water tiles; tile-boundary patrol |
| TRAIL RUNNERS | 2334 | Background animated hikers |
| PLAYER | 2515 | `makePlayer()`, `updatePlayer()` — physics, movement, bear spray, glissade |
| GAME STATE | 2825 | `game` object, `loadLevel()` (branches to boss arena for `isBoss` entries), `initGame()`, `advanceLevel()` |
| LEADERBOARD | 2842 | Firebase Firestore top-10, `fetchLeaderboard()`, `submitScore()` |
| DRAWING | 2966 | All `draw*()` functions — color palette `C`, background parallax, terrain, enemies, player |
| DOM HUD UPDATE | 2968 | Level name, score, and time HUD live in `index.html` DOM elements; updated from game state (not drawn on the canvas) |
| SCREENS | 4617 | `drawMenu()`, `drawGameOver()`, `drawLevelComplete()`, `drawWin()` |
| DEBUG | 4978 | `dbg` flag, `isDebug()`, `warpToLevel()`, FPS tracking, `drawDebugOverlay()`, keydown shortcuts |
| MAIN LOOP | 5075 | `update()` and `draw()` dispatch by `game.state`; `requestAnimationFrame` loop at ~60fps |
| AUDIO | 5223 | Web Audio API synth — all sound effects generated procedurally, no audio files. `startBossMusic(bossType)` has a track per boss |
| TOUCH CONTROLS | 5569 | Mobile button bindings |
| INITIALS INPUT | 5620 | Player-name entry for leaderboard submission |
| DEBUG API | 5645 | `window.trailBlazerDebug` — Playwright automation surface |
| BOOT | 5744 | `setupTouch()`, `fetchLeaderboard()`, starts `requestAnimationFrame` loop |

### Game Loop

```
requestAnimationFrame → update() → draw()
```

`update()` dispatches on `game.state`: `menu`, `playing`, `boss`, `levelcomplete`, `gameover`, `win`, `enterInitials`. During `playing`, order is: player → enemies → beer cans → fish → trail runners → particles → float texts → camera → increment `levelTick`. During `boss`, the loop calls `updateBossArena()` instead; `draw()` dispatches to `drawBossArena()`.

### Level Structure

`LEVELS[]` has 12 entries, in play order: trail 1, trail 2, trail 3, **Boss 1 (Thunderbird)**, trail 4, trail 5, trail 6, **Boss 2 (Mothman)**, trail 7, trail 8, trail 9, **Boss 3 (Bigfoot)**. Boss entries are in the same array so `warpToLevel`, `advanceLevel`, and level indexing treat them uniformly.

Trail entries have:
- `build()` — returns `{ map, COLS, ROWS }` using `makeMap()` helper; populates via `set/hline/fill`
- `spawnEnemies()` — returns enemy objects from factory functions
- `spawnItems()` — returns item objects via `makeItem(type, tx, ty)`
- `spawnTPBlooms()` — returns bloom hazard objects via `makeTPBloom(tx, ty)`
- Metadata: `name`, `subtitle`, `section`, `campName`, `goalTile`, `spawnTile`

Boss entries have `isBoss: true`, `bossType` (`'thunderbird'` | `'mothman'` | `'bigfoot'`), and the same display metadata (`name`, `subtitle`, `section`, `campName`), with `spawnTile`/`goalTile`/`goalFlagY` set to `null`. They have no `build()` or spawn functions.

`loadLevel(num)` for a trail calls all four spawn functions plus `spawnFish()` and `spawnTrailRunners()`. For a boss it clears the level state, calls `initBossArena(def)` (which builds the boss and starts its music), and sets `game.state = 'boss'`.

### Tile Grid

- `TS = 32` px — all coordinates multiply by this
- Canvas is 800×480 = 25×15 tiles visible
- Map is stored as `Uint8Array` rows; base floor is always `fill(0, 11, COLS-1, 14, T_SOLID)`
- Floor surface is tile row 11 (pixel y=352)

### Physics Constants (defined near line 2515)

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
- Boss No Hit: +500 pts (boss defeated without taking damage). Boss levels show "No Hit" on the results screen where trail levels show Leave No Trace.

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

5. **After the PR is merged, pull master and clean up:**
   ```bash
   git checkout master && git pull
   git branch -d issue-NNN-short-description
   ```
   Always pull master after a merge so the local branch is up to date before starting new work. Any branches that were deleted on the remote but still exist locally (marked `[gone]`) can be bulk-removed with the `/clean_gone` skill.

**Never commit directly to master.** Always work on a branch, even for small fixes.

## Debug & Testing Tools

### Human Debug Mode

Press `Ctrl+Shift+D` in-game to toggle the debug overlay. It shows:
- Colored hitbox outlines: player (red), enemies (orange), items (cyan), TP blooms (magenta)

Press a level shortcut (while overlay is on) to warp to any of the 12 `LEVELS[]` entries. Lives and score are preserved across warps:

| Keys | Level index |
|---|---|
| `Ctrl+1` … `Ctrl+9` | 0–8 |
| `Ctrl+0` | 9 |
| `Ctrl+Shift+1` / `Ctrl+Shift+2` | 10 / 11 |

> **Note:** `Ctrl+1–9` and `Ctrl+0` conflict with browser tab-switching shortcuts in some browsers. Use `window.trailBlazerDebug.warpToLevel(n)` from DevTools as a reliable alternative.

### Playwright Automated QA

The `qa/` directory contains a headless Playwright runner for scripted testing.

**Setup (once):**
```bash
cd qa
npm install
npx playwright install chromium
```

**Run a scenario:**
```bash
# Requires a local server: python -m http.server 3000
cd qa
node runner.mjs scenarios/smoke.mjs
# Emulate a mobile device (landscape touch UI, etc.):
node runner.mjs --device=mobile-landscape scenarios/mobile-buttons.mjs
# Run on another engine (chromium is the default; also firefox, webkit):
node runner.mjs --browser=firefox scenarios/smoke.mjs
```

**Device presets** live in `qa/lib/devices.mjs`:

| Preset | Viewport | `hasTouch` / `isMobile` | Notes |
|---|---|---|---|
| `desktop` (default) | 1280x720 | false | Default for all existing scenarios. |
| `desktop-fhd` | 1920x1080 | false | Full-HD desktop. |
| `desktop-4k` | 3840x2160 | false | 4K desktop. |
| `desktop-ultrawide` | 3440x1440 | false | Ultrawide desktop. |
| `mobile-portrait` | 393x727 | true | Pixel-5-ish portrait; `(orientation: portrait)` matches. |
| `mobile-landscape` | 844x390 | true | Pixel-5-ish landscape; activates the touch overlay. |
| `tablet-portrait` | 768x1024 | true | iPad-ish portrait. |
| `tablet-landscape` | 1194x834 | true | iPad-ish landscape. |

The mobile presets set `hasTouch` + `isMobile` so the game's `(hover: none) and (pointer: coarse)` media query matches naturally — no CSS injection needed to see the touch controls.

**Write a new scenario** in `qa/scenarios/<name>.mjs`:
```js
// Optional: pick a device preset. The CLI `--device=<name>` flag overrides this.
export const options = { device: 'mobile-landscape' };

export default async function scenario(game) {
  await game.warpToLevel(2);        // warp to level 3 (0-indexed)
  await game.waitFrames(30);        // wait ~30 frames
  await game.holdKey('ArrowRight', 60); // hold right for 60 frames
  await game.screenshot('my-shot'); // saves to qa/screenshots/my-shot.png
  const s = await game.getState();  // { state, levelNum, levelTick, playerX, playerY,
                                    //   playerLives, playerScore, enemyCount, itemCount }
}
```

Screenshots are saved to `qa/screenshots/` (gitignored) and can be read with the `Read` tool for visual QA.

### LSP Tool

The `LSP` tool (typescript-language-server) is available for code intelligence. Prefer it over `Grep` in these situations:

- **Before modifying a widely-called function** — use `findReferences` to confirm every call site (e.g., before changing `makeItem`, `loadLevel`, `hurtPlayer`)
- **When adding a new enemy type** — use `findReferences` on an existing enemy factory (e.g., `makeMarmot`) to find all dispatch points that need to be mirrored
- **When tracing unexpected behavior** — use `incomingCalls`/`outgoingCalls` to map what triggers a function in the game loop

`findReferences` requires a file path, line number, and character offset — look up the symbol's location first with `Grep`, then call `LSP`.

### `window.trailBlazerDebug` API

Available at `http://localhost:3000?debug=1` (or any time in the page):

| Method | Description |
|--------|-------------|
| `warpToLevel(n)` | Warp to `LEVELS[]` index `n` (0–11, boss levels included); preserves lives/score |
| `screenshot()` | Returns canvas as base64 PNG data URL |
| `pressKey(code)` | Simulate keydown (e.g. `'ArrowRight'`) |
| `releaseKey(code)` | Release simulated key |
| `getState()` | Returns `{ state, levelNum, levelTick, playerX, playerY, playerLives, playerScore, enemyCount, itemCount }` |
| `getLayout()` | Returns `{ scale, H_logical, overlayMode, display, margin }` from the layout module |
| `forceBossAttack(name)` | Queues a boss attack on the active boss. Bigfoot: `'leap'`, `'groundpound'`, `'groundpound-dual'`, `'boulders'`. Mothman: `'beam'`, `'charge'`, `'orbs'`. Returns `false` if not in a boss fight or the name is invalid |
| `getBossState()` | Returns `{ type, state, phase, hp, x, y, ... }` for the active boss arena. Returns `null` once a trail level loads (and before any boss has loaded). The arena is kept through the post-fight results screen and a game over in the arena |
| `pokeBoss(patch)` | `Object.assign`s `patch` onto the active boss (for setting up test states) |
| `pokePlayer(patch)` | `Object.assign`s `patch` onto the player |

## Firebase / Leaderboard

Firebase config is in `index.html`. `window.db` is the Firestore instance. The leaderboard collection is `leaderboard` with fields `name`, `score`, `date`. Scores are fetched at boot and re-fetched after each submission.
