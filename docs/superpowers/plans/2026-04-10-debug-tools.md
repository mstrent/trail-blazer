# Debug & Testing Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add in-game debug mode with level warp + dense overlay, a `window.trailBlazerDebug` API, and a `qa/` Playwright runner for headless automated testing.

**Architecture:** All in-game debug code lives in a new `DEBUG` section inside `game.js`'s existing IIFE, inserted just before `MAIN LOOP`. The `window.trailBlazerDebug` object is exposed just before `BOOT`. Playwright tooling lives in a separate `qa/` directory with its own `package.json` — no build step is added to the root project.

**Tech Stack:** Vanilla JS (game), Canvas 2D, Playwright (Node.js, `qa/` only, ESM)

---

## File Map

| File | Action | Purpose |
|------|---------|---------|
| `game.js` | Modify | Add DEBUG section, FPS tracking, overlay, window API |
| `.gitignore` | Modify | Ignore `qa/node_modules/` and `qa/screenshots/*.png` |
| `qa/package.json` | Create | `"type": "module"`, playwright dep |
| `qa/runner.mjs` | Create | CLI: launch headless browser, run a scenario file |
| `qa/lib/game-client.mjs` | Create | Typed wrapper around `window.trailBlazerDebug` |
| `qa/scenarios/smoke.mjs` | Create | Basic smoke test: warp, walk, screenshot, assert |
| `qa/screenshots/.gitkeep` | Create | Keeps the output directory tracked in git |

---

## Task 1: Add DEBUG section to game.js

**Files:**
- Modify: `game.js` — insert before `// ==================== MAIN LOOP ====================`
- Modify: `game.js` — update `update()` for FPS tracking
- Modify: `game.js` — update `draw()` to call overlay

- [ ] **Step 1: Insert the DEBUG section**

In `game.js`, find this exact line:

```
// ==================== MAIN LOOP ====================
```

Insert the following block immediately before it (preserving the original line):

```js
// ==================== DEBUG ====================
const dbg = {
  url: new URLSearchParams(location.search).has('debug'),
  human: false,
};
const isDebug = () => dbg.url || dbg.human;

let fpsLastTime = 0;
let fpsBuffer = []; // rolling 60-frame window of frame durations (ms)
function getCurrentFps() {
  if (fpsBuffer.length === 0) return 60;
  const avg = fpsBuffer.reduce((a, b) => a + b, 0) / fpsBuffer.length;
  return Math.round(1000 / avg);
}

function warpToLevel(n) {
  initGame();                          // ensures player exists, state = 'playing'
  loadLevel(n);                        // override initGame's level 0 with requested level
  const spawn = LEVELS[n].spawnTile;
  player.x = spawn[0] * TS;
  player.y = spawn[1] * TS;
  game.levelTick = 0;
}

addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
    dbg.human = !dbg.human;
    e.preventDefault();
    return;
  }
  if (isDebug() && e.ctrlKey && !e.shiftKey && !e.altKey) {
    const n = parseInt(e.key) - 1; // Ctrl+1 → level index 0, Ctrl+9 → level index 8
    if (!isNaN(n) && n >= 0 && n < LEVELS.length) {
      audio.init();
      warpToLevel(n);
      e.preventDefault();
    }
  }
});

function drawDebugOverlay() {
  if (!player) return;
  const sx = x => Math.round(x - cam.x);
  const sy = y => Math.round(y - cam.y);

  ctx.save();
  ctx.lineWidth = 1.5;

  // Player hitbox — red
  ctx.strokeStyle = '#ff3333';
  ctx.strokeRect(sx(player.x), sy(player.y), player.w, player.h);

  // Enemy hitboxes — orange
  ctx.strokeStyle = '#ff9900';
  enemies.forEach(e => {
    if (e.alive) ctx.strokeRect(sx(e.x), sy(e.y), e.w, e.h);
  });

  // Item hitboxes — cyan (items use `collected` flag, not `alive`)
  ctx.strokeStyle = '#00ffff';
  items.forEach(it => {
    if (!it.collected) ctx.strokeRect(sx(it.x), sy(it.y), it.w, it.h);
  });

  // TP Bloom hitboxes — magenta (blooms use `active` flag, not `alive`)
  ctx.strokeStyle = '#ff00ff';
  tpBlooms.forEach(b => {
    if (b.active) ctx.strokeRect(sx(b.x), sy(b.y), b.w, b.h);
  });

  ctx.restore();

  // Info readout — fixed top-left corner
  const tx = Math.floor(player.x / TS);
  const ty = Math.floor(player.y / TS);
  const lines = [
    `STATE:${game.state}  LEVEL:${game.levelNum + 1} (${LEVELS[game.levelNum].name})`,
    `PLAYER tile:(${tx},${ty})  world:(${Math.floor(player.x)},${Math.floor(player.y)})`,
    `vx:${player.vx.toFixed(2)}  vy:${player.vy.toFixed(2)}  onGround:${player.onGround}`,
    `ENEMIES alive:${enemies.filter(e => e.alive).length}  ITEMS left:${items.filter(i => !i.collected).length}`,
    `FPS:${getCurrentFps()}`,
  ];
  ctx.save();
  ctx.font = '12px monospace';
  const lh = 16, pad = 6, bw = 360, bh = lines.length * lh + pad * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(4, 4, bw, bh);
  ctx.fillStyle = '#ffffff';
  lines.forEach((l, i) => ctx.fillText(l, 4 + pad, 4 + pad + 12 + i * lh));
  ctx.restore();
}

```

- [ ] **Step 2: Add FPS tracking at the top of update()**

In `game.js`, find:

```js
function update() {
  game.tick++;
```

Replace with:

```js
function update() {
  if (isDebug()) {
    const now = performance.now();
    if (fpsLastTime > 0) {
      fpsBuffer.push(now - fpsLastTime);
      if (fpsBuffer.length > 60) fpsBuffer.shift();
    }
    fpsLastTime = now;
  }
  game.tick++;
```

- [ ] **Step 3: Call drawDebugOverlay at end of draw()**

In `game.js`, find these exact lines (the closing of the `playing` state draw block):

```js
  drawBeerCans();
  drawPlayer();
  drawParticles();
  drawFloatTexts();
  drawHUD();
}
```

Replace with:

```js
  drawBeerCans();
  drawPlayer();
  drawParticles();
  drawFloatTexts();
  drawHUD();
  if (isDebug()) drawDebugOverlay();
}
```

- [ ] **Step 4: Verify in browser**

Start the server (`python -m http.server 3000`) and open `http://localhost:3000`.

Test human toggle: press `Ctrl+Shift+D` — a dark overlay should appear at top-left showing STATE/LEVEL/PLAYER/FPS, and a red rectangle should outline the player. Press `Ctrl+Shift+D` again to hide.

Test level warp: while overlay is visible, press `Ctrl+3` — game should jump to level 3 (index 2). The level name in the overlay should update. Press `Ctrl+1` to return to level 1.

- [ ] **Step 5: Commit**

```bash
git add game.js
git commit -m "feat: add DEBUG section with overlay, FPS counter, and level warp (closes #61, partial)"
```

---

## Task 2: Add window.trailBlazerDebug API

**Files:**
- Modify: `game.js` — insert before `// ==================== BOOT ====================`

- [ ] **Step 1: Insert the DEBUG API section**

In `game.js`, find these exact lines:

```js
// ==================== BOOT ====================
setupTouch();
```

Insert immediately before them:

```js
// ==================== DEBUG API ====================
window.trailBlazerDebug = {
  warpToLevel(n) {
    warpToLevel(n);
  },
  screenshot() {
    return canvas.toDataURL('image/png');
  },
  pressKey(code) {
    keys[code] = true;
  },
  releaseKey(code) {
    keys[code] = false;
  },
  getState() {
    return {
      state: game.state,
      levelNum: game.levelNum,
      levelTick: game.levelTick,
      playerX: player ? player.x : null,
      playerY: player ? player.y : null,
      playerLives: player ? player.lives : null,
      playerScore: player ? player.score : null,
      enemyCount: enemies.filter(e => e.alive).length,
      itemCount: items.filter(i => !i.collected).length,
    };
  },
};

```

- [ ] **Step 2: Verify in DevTools**

Open `http://localhost:3000?debug=1`, open the browser DevTools console, and run:

```js
window.trailBlazerDebug.warpToLevel(2)
// game should jump to level 3

window.trailBlazerDebug.getState()
// should return an object: { state: 'playing', levelNum: 2, playerLives: 3, ... }

typeof window.trailBlazerDebug.screenshot()
// should return 'string' (a base64 data URL)
```

- [ ] **Step 3: Commit**

```bash
git add game.js
git commit -m "feat: expose window.trailBlazerDebug API for Playwright automation"
```

---

## Task 3: Set up qa/ directory scaffold

**Files:**
- Create: `qa/package.json`
- Create: `qa/screenshots/.gitkeep`
- Modify: `.gitignore`

- [ ] **Step 1: Create qa/package.json**

```json
{
  "name": "trail-blazer-qa",
  "type": "module",
  "private": true,
  "scripts": {
    "install-browsers": "npx playwright install chromium"
  },
  "dependencies": {
    "playwright": "^1.44.0"
  }
}
```

- [ ] **Step 2: Create qa/screenshots/.gitkeep**

Create an empty file at `qa/screenshots/.gitkeep` so the output directory exists in the repo without committing any PNG files.

- [ ] **Step 3: Update .gitignore**

The current `.gitignore` contains only `.claude/`. Add two more lines:

```
qa/node_modules/
qa/screenshots/*.png
```

- [ ] **Step 4: Commit**

```bash
git add qa/package.json qa/screenshots/.gitkeep .gitignore
git commit -m "chore: scaffold qa/ directory for Playwright automation"
```

---

## Task 4: Create qa/lib/game-client.mjs

**Files:**
- Create: `qa/lib/game-client.mjs`

- [ ] **Step 1: Create the file**

```js
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotsDir = resolve(__dirname, '..', 'screenshots');

export class GameClient {
  constructor(page) {
    this.page = page;
  }

  async warpToLevel(n) {
    await this.page.evaluate(n => window.trailBlazerDebug.warpToLevel(n), n);
  }

  // Saves the canvas as a PNG to qa/screenshots/<name>.png.
  // Returns the absolute path so the caller can read it.
  async screenshot(name) {
    const dataUrl = await this.page.evaluate(() => window.trailBlazerDebug.screenshot());
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const filePath = resolve(screenshotsDir, `${name}.png`);
    writeFileSync(filePath, Buffer.from(base64, 'base64'));
    return filePath;
  }

  async pressKey(code) {
    await this.page.evaluate(code => window.trailBlazerDebug.pressKey(code), code);
  }

  async releaseKey(code) {
    await this.page.evaluate(code => window.trailBlazerDebug.releaseKey(code), code);
  }

  // Hold a key for `frames` game frames (~16ms each), then release.
  async holdKey(code, frames) {
    await this.pressKey(code);
    await this.waitFrames(frames);
    await this.releaseKey(code);
  }

  // Wait approximately n game frames (n * 16ms).
  async waitFrames(n) {
    await new Promise(r => setTimeout(r, n * 16));
  }

  async getState() {
    return this.page.evaluate(() => window.trailBlazerDebug.getState());
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add qa/lib/game-client.mjs
git commit -m "feat: add GameClient typed wrapper for Playwright scenarios"
```

---

## Task 5: Create qa/runner.mjs

**Files:**
- Create: `qa/runner.mjs`

- [ ] **Step 1: Create the file**

```js
import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GameClient } from './lib/game-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const scenarioArg = process.argv[2];
if (!scenarioArg) {
  console.error('Usage: node runner.mjs scenarios/<name>.mjs');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto('http://localhost:3000?debug=1');
  await page.waitForFunction(
    () => typeof window.trailBlazerDebug !== 'undefined',
    { timeout: 10000 }
  );

  const scenarioPath = resolve(__dirname, scenarioArg);
  const { default: scenario } = await import(scenarioPath);
  const client = new GameClient(page);

  await scenario(client);
  console.log('Scenario completed successfully.');
} catch (err) {
  console.error('Scenario failed:', err.message);
  process.exit(1);
} finally {
  await browser.close();
}
```

- [ ] **Step 2: Commit**

```bash
git add qa/runner.mjs
git commit -m "feat: add Playwright runner for QA scenarios"
```

---

## Task 6: Create smoke scenario and verify end-to-end

**Files:**
- Create: `qa/scenarios/smoke.mjs`

- [ ] **Step 1: Create the scenario**

```js
// Smoke test: warp to levels 1 and 3, verify player state, screenshot initial frames.
export default async function scenario(game) {
  // --- Level 1 ---
  await game.warpToLevel(0);
  await game.waitFrames(10);

  const s1 = await game.getState();
  console.assert(s1.state === 'playing', `L1: expected playing, got ${s1.state}`);
  console.assert(s1.levelNum === 0, `L1: expected levelNum 0, got ${s1.levelNum}`);
  console.assert(s1.playerLives === 3, `L1: expected 3 lives, got ${s1.playerLives}`);
  await game.screenshot('smoke-level-1-initial');
  console.log('Level 1 initial state OK');

  // Walk right for 2 seconds; player should survive
  await game.holdKey('ArrowRight', 120);
  await game.waitFrames(10);
  const s1w = await game.getState();
  console.assert(s1w.playerLives > 0, `L1: player died walking right`);
  await game.screenshot('smoke-level-1-after-walk');
  console.log('Level 1 walk OK');

  // --- Level 3 ---
  await game.warpToLevel(2);
  await game.waitFrames(10);

  const s3 = await game.getState();
  console.assert(s3.state === 'playing', `L3: expected playing, got ${s3.state}`);
  console.assert(s3.levelNum === 2, `L3: expected levelNum 2, got ${s3.levelNum}`);
  await game.screenshot('smoke-level-3-initial');
  console.log('Level 3 initial state OK');

  console.log('Smoke test passed.');
}
```

- [ ] **Step 2: Install Playwright and run the smoke test**

Make sure a local server is running in the game root (open a separate terminal: `python -m http.server 3000`). Then:

```bash
cd qa
npm install
node runner.mjs scenarios/smoke.mjs
```

Expected output:
```
Level 1 initial state OK
Level 1 walk OK
Level 3 initial state OK
Smoke test passed.
Scenario completed successfully.
```

- [ ] **Step 3: Verify screenshots were written**

Check that `qa/screenshots/` contains three PNG files. Read one of them to confirm the canvas rendered a real game frame (not a blank canvas).

- [ ] **Step 4: Commit**

```bash
git add qa/scenarios/smoke.mjs
git commit -m "feat: add smoke QA scenario covering level warp and basic navigation"
```

---

## Final: Open PR

```bash
git push -u origin issue-61-debug-tools
gh pr create \
  --title "Add debug tools and Playwright QA runner" \
  --body "$(cat <<'EOF'
## Summary
- Adds `Ctrl+Shift+D` in-game debug toggle: hitbox outlines, physics readout, FPS counter
- Adds `Ctrl+1–9` level warp shortcut (active in debug mode)
- Exposes `window.trailBlazerDebug` API (`warpToLevel`, `screenshot`, `pressKey`, `releaseKey`, `getState`) for automated testing
- Adds `qa/` directory with Playwright runner and smoke scenario

closes #61
EOF
)"
```
