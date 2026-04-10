# Debug & Testing Tools — Design Spec

**Issue:** #61
**Date:** 2026-04-10
**Status:** Approved

## Overview

Add debugging and automated QA tools to Trail Blazer. Two audiences:

1. **Playwright automation** (`?debug=1` URL param) — headless browser scripts that drive the game, take screenshots, and assert on state. Used by Claude during QA and bug validation.
2. **Human QA** (`Ctrl+Shift+D` toggle) — dense in-game overlay showing hitboxes, physics values, and entity counts. Used when manually testing level design or bug reproduction.

No build step is introduced. All in-game code stays inside the existing IIFE in `game.js`.

---

## 1. In-Game Debug Section (`game.js`)

### Debug Flag

A new `DEBUG` section added near the end of `game.js`, before the MAIN LOOP section:

```js
const dbg = {
  url: new URLSearchParams(location.search).has('debug'),
  human: false,  // toggled by Ctrl+Shift+D
};
const isDebug = () => dbg.url || dbg.human;
```

### Human Toggle

In the existing `keydown` listener: when `e.ctrlKey && e.shiftKey && e.code === 'KeyD'`, flip `dbg.human`.

### Level Warp

Also in the `keydown` listener, gated on `isDebug()`:
- `Ctrl+1` through `Ctrl+9` warp to level index 0–8 respectively.
- Warp logic: call `initGame()` to ensure a clean player exists, then immediately call `loadLevel(n)` to override the level, reposition player at `LEVELS[n].spawnTile`, and reset `game.levelTick = 0`. Score resets to 0 (simplest behavior for a testing tool — no edge cases around warping from menu state).
- Works from any game state (menu, playing, gameover, etc.).

### FPS Counter

A `fpsBuffer` array (rolling 60-frame window) tracks `performance.now()` deltas. Updated each frame at the top of `update()`. Current FPS = `1000 / avgDelta`.

---

## 2. Debug Overlay (`drawDebugOverlay()`)

Called at the very end of `draw()` when `isDebug()` is true.

### Hitboxes

Drawn over all entities using their `x/y/w/h` fields, offset by `cam.x`/`cam.y` to convert world → screen coords:

| Entity | Outline color |
|--------|--------------|
| Player | Red |
| Enemies (alive) | Orange |
| Items (alive) | Cyan |
| TP Blooms (alive) | Magenta |

Outlines are 1–2px strokes with no fill. Only drawn for entities on-screen (within viewport bounds).

### Physics / State Readout

Fixed position, top-left corner of the canvas. Semi-transparent dark background for legibility. Contents:

```
STATE: playing   LEVEL: 3 (Bridge of the Gods)
PLAYER tile: (12, 9)   world: (384, 288)
vx: 3.50   vy: -2.10   onGround: false
ENEMIES alive: 4   ITEMS left: 2
FPS: 60
```

Player tile coords = `Math.floor(player.x / TS)`, `Math.floor(player.y / TS)`.

---

## 3. `window.trailBlazerDebug` API

Exposed unconditionally at the bottom of the IIFE (before the closing `})()`), so Playwright can always reach it when loading with `?debug=1`:

```js
window.trailBlazerDebug = {
  // Warp to level index n (0–8). Resets levelTick and score to 0.
  warpToLevel(n),

  // Returns canvas.toDataURL('image/png') — a base64 PNG of the current frame.
  screenshot(),

  // Simulate a keypress (sets keys[code] = true).
  pressKey(code),

  // Release a simulated keypress (sets keys[code] = false).
  releaseKey(code),

  // Returns a plain-object snapshot of current game state:
  // { state, levelNum, levelTick, playerX, playerY,
  //   playerLives, playerScore, enemyCount, itemCount }
  getState(),
};
```

`pressKey`/`releaseKey` write directly into the `keys` object the game already reads — no special-casing in the game loop.

---

## 4. `qa/` Directory

```
qa/
  package.json          — { "type": "module" }, dep: playwright
  runner.mjs            — CLI entry point
  lib/
    game-client.mjs     — typed wrapper around window.trailBlazerDebug
  scenarios/            — one .mjs file per QA scenario
  screenshots/          — ephemeral output PNGs (.gitignored)
```

`qa/package.json` is scoped to the `qa/` subdirectory. It has no effect on the root project, which intentionally has no `package.json`.

### `runner.mjs`

Usage:
```bash
cd qa && npm install   # once
node runner.mjs scenarios/level-3-smoke.mjs
```

Behavior:
1. Launch headless Chromium via Playwright.
2. Navigate to `http://localhost:3000?debug=1`.
3. Wait for `window.trailBlazerDebug` to be defined.
4. Dynamically import the scenario file; call `scenario(client)`.
5. Close the browser and exit.

### `game-client.mjs`

Wraps every `window.trailBlazerDebug` call so scenario code reads cleanly:

```js
class GameClient {
  async warpToLevel(n)         // calls window.trailBlazerDebug.warpToLevel(n)
  async screenshot(name)       // saves PNG to qa/screenshots/<name>.png; returns path
  async pressKey(code)         // calls pressKey(code)
  async releaseKey(code)       // calls releaseKey(code)
  async holdKey(code, frames)  // press, wait frames*16ms, release
  async waitFrames(n)          // waits n * 16ms
  async getState()             // returns getState() snapshot
}
```

`screenshot(name)` saves the PNG to `qa/screenshots/<name>.png` for Claude to read with the `Read` tool. Screenshots are ephemeral QA artifacts — not committed to the repo.

### Scenarios

Each scenario is a plain async function:

```js
// scenarios/level-3-smoke.mjs
export default async function scenario(game) {
  await game.warpToLevel(2);
  await game.waitFrames(60);
  await game.screenshot('level-3-initial');
  await game.holdKey('ArrowRight', 120);
  await game.screenshot('level-3-after-walk');
  const s = await game.getState();
  console.assert(s.playerLives > 0, 'player should be alive after walking right');
}
```

---

## Out of Scope

- Tile grid overlay (explicitly excluded per design discussion)
- Any changes to the touch control layer
- Leaderboard bypass or score manipulation
- Automated CI integration (scenarios run manually by Claude on demand)
