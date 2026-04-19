# Responsive Layout Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current collection of media-query patches and `resizeCanvas()`'s logical-size mutation with a single, unified viewport-to-game mapping. Every device, orientation, and screen size is served by one rule — no device-class branches.

**Architecture:** Introduce a `layout` module in `game.js` that owns the viewport-to-game mapping. It exposes state both via JS globals (`W`, `H`) and via CSS custom properties on `<html>`. CSS and touch controls read those properties instead of branching on `@media (orientation)` or `(hover: none)`. HUD text moves to a DOM overlay so font sizes can clamp against reasonable bounds instead of scaling linearly with the canvas.

**Tech Stack:** Vanilla JS (no framework, no build step), Canvas 2D, CSS custom properties, Playwright for automated verification.

**Spec:** `docs/superpowers/specs/2026-04-18-responsive-layout-design.md`

**Issue:** #94

---

## Testing model for this refactor

This project has no unit-test framework. Primary verification is:

1. **Playwright scenarios** — smoke tests that navigate the game and assert debug-API state. These serve as our TDD tests. New scenarios live in `qa/scenarios/`.
2. **Manual browser QA** — the final arbiter, especially for visual/aesthetic judgments.

Each phase ends with a commit. The subagent-driven development workflow lets an agent review between phases — use that.

---

## File Structure

**Created:**
- `qa/scenarios/responsive-layout.mjs` — new Playwright scenario verifying the unified rule across device presets.

**Modified:**
- `game.js` — add `layout` module in SETUP section (~line 7–38), delete `resizeCanvas()`, expose `layout` state via debug API, add `updateHUD()` DOM function, audit SCREENS section and BOSS ARENA section for `H===480` assumptions, remove canvas HUD text (keep canvas HUD graphics).
- `style.css` — full rewrite: delete all `@media (orientation)` and `(hover: none)` branches, delete `!important` overrides, drive all responsive behavior off CSS custom properties set by the layout module. Add DOM HUD styles.
- `index.html` — add `<div id="hud">` structure with child elements for level name, score, time; add inline `<style>` with default CSS variable values.
- `qa/lib/devices.mjs` — add five new device presets (`desktop-fhd`, `desktop-4k`, `desktop-ultrawide`, `tablet-landscape`, `tablet-portrait`).

---

## Design reference

The unified rule (from spec §1):

```
game_aspect      = 800 / 480 = 1.667
viewport_aspect  = viewport_width / viewport_height
PAN_THRESHOLD    = 1.25
HYST             = 0.05         # hysteresis band

if current mode is "margin":
    switch_to_canvas_threshold = game_aspect × (PAN_THRESHOLD + HYST) ≈ 2.167
else:
    switch_to_margin_threshold = game_aspect × (PAN_THRESHOLD - HYST) ≈ 2.000

canvas_mode when viewport_aspect > switch_to_canvas_threshold
            OR currently canvas_mode and viewport_aspect > switch_to_margin_threshold
margin_mode otherwise

if canvas_mode:
    scale           = viewport_width / 800
    H_logical       = floor(viewport_height / scale)
    display_width   = viewport_width
    display_height  = viewport_height
else:
    scale           = min(viewport_width / 800, viewport_height / 480)
    H_logical       = 480
    display_width   = 800 × scale
    display_height  = 480 × scale

W stays 800 always.
```

---

## Phase 1: Layout Module Scaffold

**Goal:** Introduce a pure, side-effect-free `layout` module that computes mapping values, alongside the existing `resizeCanvas()` which keeps working. Expose layout state via debug API. Add Playwright scenario that verifies computations. No behavior changes yet.

### Task 1.1: Add layout module skeleton

**Files:**
- Modify: `game.js:7-38` (SETUP section)

- [ ] **Step 1: Insert `layout` module definition above the existing `resizeCanvas()`**

Add this block to `game.js` immediately after line 13 (`const TS = 32;`) and before the existing `resizeCanvas()` function:

```js
// ==================== LAYOUT MODULE ====================
// Unified viewport-to-game mapping. See docs/superpowers/specs/2026-04-18-responsive-layout-design.md.
const GAME_ASPECT = 800 / 480;
const PAN_THRESHOLD = 1.25;
const LAYOUT_HYST = 0.05;

const layout = {
  // Public read-only state (populated by recompute())
  scale: 1,
  H_logical: 480,
  display: { w: 800, h: 480, x: 0, y: 0 },
  margin: { top: 0, bottom: 0, left: 0, right: 0 },
  overlayMode: 'margin', // 'margin' or 'canvas'

  _getViewport() {
    const vp = window.visualViewport;
    const vw = Math.max(1, Math.round(vp ? vp.width : window.innerWidth));
    const vh = Math.max(1, Math.round(vp ? vp.height : window.innerHeight));
    return { vw, vh };
  },

  _decideMode(viewportAspect) {
    // Hysteresis: asymmetric thresholds prevent flicker on live resize.
    const enterCanvas = GAME_ASPECT * (PAN_THRESHOLD + LAYOUT_HYST);
    const exitCanvas  = GAME_ASPECT * (PAN_THRESHOLD - LAYOUT_HYST);
    if (this.overlayMode === 'canvas') {
      return viewportAspect > exitCanvas ? 'canvas' : 'margin';
    }
    return viewportAspect > enterCanvas ? 'canvas' : 'margin';
  },

  _compute(vw, vh) {
    const viewportAspect = vw / vh;
    const mode = this._decideMode(viewportAspect);
    let scale, H_logical, displayW, displayH;
    if (mode === 'canvas') {
      // Fit by width; camera pans vertically.
      scale = vw / 800;
      H_logical = Math.floor(vh / scale);
      displayW = vw;
      displayH = vh;
    } else {
      // Fit entire 800x480 game with letterbox.
      scale = Math.min(vw / 800, vh / 480);
      H_logical = 480;
      displayW = Math.round(800 * scale);
      displayH = Math.round(480 * scale);
    }
    const offsetX = Math.floor((vw - displayW) / 2);
    const offsetY = Math.floor((vh - displayH) / 2);
    return {
      scale,
      H_logical,
      overlayMode: mode,
      display: { w: displayW, h: displayH, x: offsetX, y: offsetY },
      margin: {
        top: offsetY,
        bottom: vh - displayH - offsetY,
        left: offsetX,
        right: vw - displayW - offsetX,
      },
    };
  },

  recompute() {
    const { vw, vh } = this._getViewport();
    const next = this._compute(vw, vh);
    Object.assign(this, next);
    // Canvas/CSS mutation added in Phase 2.
  },
};
```

- [ ] **Step 2: Call `layout.recompute()` once at boot**

Add this line immediately after the `layout` object definition (before `resizeCanvas()`):

```js
layout.recompute();
```

- [ ] **Step 3: Verify the page still loads**

Run: `python -m http.server 3000` (in a separate terminal), then open http://localhost:3000 in a browser. Game should load and play identically to before — the layout module writes nothing that affects rendering yet.

- [ ] **Step 4: Commit**

```bash
git add game.js
git commit -m "feat(#94): add layout module skeleton (no-op)"
```

### Task 1.2: Expose layout state via debug API

**Files:**
- Modify: `game.js` DEBUG API section (starts ~line 5326)

- [ ] **Step 1: Add `getLayout()` to `window.trailBlazerDebug`**

Find the existing `window.trailBlazerDebug = { ... }` block (approximately `game.js:5327`). Add this method alongside `getState()`:

```js
  getLayout() {
    return {
      scale: layout.scale,
      H_logical: layout.H_logical,
      overlayMode: layout.overlayMode,
      display: { ...layout.display },
      margin: { ...layout.margin },
    };
  },
```

- [ ] **Step 2: Verify via browser devtools**

Reload the page. In devtools console:

```js
window.trailBlazerDebug.getLayout()
```

Expected: an object with `scale: 1`, `H_logical: 480`, `overlayMode: 'margin'` (on a typical 1280×720 desktop viewport the computed mode is margin — 1280/720 ≈ 1.78, below threshold 2.167).

- [ ] **Step 3: Commit**

```bash
git add game.js
git commit -m "feat(#94): expose layout state via debug API"
```

### Task 1.3: Wire `recompute()` to resize events

**Files:**
- Modify: `game.js` SETUP section

- [ ] **Step 1: Add resize event handlers immediately after the boot `layout.recompute()` call**

```js
addEventListener('resize', () => layout.recompute());
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => layout.recompute());
}
addEventListener('orientationchange', () => layout.recompute());
```

- [ ] **Step 2: Verify in browser**

Reload. Open devtools, resize the window. After each resize, run `window.trailBlazerDebug.getLayout()` — values should reflect the new viewport.

- [ ] **Step 3: Commit**

```bash
git add game.js
git commit -m "feat(#94): wire layout.recompute() to viewport events"
```

### Task 1.4: Write Playwright scenario verifying the unified rule

**Files:**
- Create: `qa/scenarios/responsive-layout.mjs`

- [ ] **Step 1: Write the scenario**

Create `qa/scenarios/responsive-layout.mjs` with this content:

```js
// Verifies the unified viewport-to-game mapping produces the expected
// scale, H_logical, and overlayMode for a representative viewport.
// To exercise multiple viewports, run this scenario once per device preset
// (the runner's --device flag takes care of that).

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

// Expected layout values per device viewport (hand-computed from the spec).
const EXPECTATIONS = {
  // desktop 1280x720: aspect 1.78, below threshold 2.167 → margin mode
  'desktop': {
    overlayMode: 'margin',
    H_logical: 480,
    scaleNear: 1.50, // min(1280/800, 720/480) = min(1.6, 1.5) = 1.5
  },
  // mobile-landscape 844x390: aspect 2.164, above threshold 2.167? Actually 2.164 < 2.167 at enter,
  // so from initial margin mode, margin is retained. But most phone landscape devices have slightly
  // wider ratios in practice. Accept either mode here; verify the math is self-consistent.
  'mobile-landscape': {
    // Leave flexible — just verify scale*H_logical is coherent.
    validate(layout) {
      if (layout.overlayMode === 'canvas') {
        const expectedScale = 844 / 800;
        assert(Math.abs(layout.scale - expectedScale) < 0.01,
          `canvas-mode scale should ~= ${expectedScale}, got ${layout.scale}`);
        assert(layout.H_logical <= 480,
          `canvas-mode H_logical should <= 480, got ${layout.H_logical}`);
      } else {
        const expectedScale = Math.min(844/800, 390/480);
        assert(Math.abs(layout.scale - expectedScale) < 0.01,
          `margin-mode scale should ~= ${expectedScale}, got ${layout.scale}`);
        assert(layout.H_logical === 480, 'margin-mode H_logical should be 480');
      }
    },
  },
  // mobile-portrait 393x727: aspect 0.54, deep below threshold → margin mode
  'mobile-portrait': {
    overlayMode: 'margin',
    H_logical: 480,
    scaleNear: 393 / 800, // fit by width
  },
};

export default async function scenario(game) {
  // Read the device this scenario was invoked against.
  const device = process.env.QA_DEVICE || 'desktop';
  const expect = EXPECTATIONS[device] || EXPECTATIONS['desktop'];

  await game.waitFrames(3);
  const layout = await game.page.evaluate(() => window.trailBlazerDebug.getLayout());
  console.log(`[${device}] layout:`, JSON.stringify(layout));

  if (expect.validate) {
    expect.validate(layout);
  } else {
    assert(layout.overlayMode === expect.overlayMode,
      `expected overlayMode=${expect.overlayMode}, got ${layout.overlayMode}`);
    assert(layout.H_logical === expect.H_logical,
      `expected H_logical=${expect.H_logical}, got ${layout.H_logical}`);
    assert(Math.abs(layout.scale - expect.scaleNear) < 0.01,
      `expected scale near ${expect.scaleNear}, got ${layout.scale}`);
  }

  console.log(`responsive-layout [${device}] PASSED`);
}
```

- [ ] **Step 2: Run the scenario on the default desktop preset**

With the server already running (`python -m http.server 3000`):

```bash
cd qa
node runner.mjs scenarios/responsive-layout.mjs
```

Expected: `responsive-layout [desktop] PASSED`. If the runner doesn't set `QA_DEVICE` itself, the scenario uses 'desktop'.

- [ ] **Step 3: Check if runner exposes device env var**

Run: `grep -n QA_DEVICE qa/runner.mjs qa/lib/*.mjs`

If the runner does **not** currently set `QA_DEVICE`, add a one-line modification to `qa/runner.mjs` where `--device=...` is parsed:

```js
process.env.QA_DEVICE = deviceName;  // make the active device visible to scenarios
```

Then re-run:

```bash
node runner.mjs --device=mobile-portrait scenarios/responsive-layout.mjs
node runner.mjs --device=mobile-landscape scenarios/responsive-layout.mjs
```

Both should print `PASSED`.

- [ ] **Step 4: Commit**

```bash
git add qa/scenarios/responsive-layout.mjs qa/runner.mjs
git commit -m "test(#94): Playwright scenario verifying unified layout rule"
```

---

## Phase 2: Canvas & CSS Custom Properties

**Goal:** Make `layout.recompute()` actually mutate the canvas (pixel dimensions and CSS display size) and write CSS custom properties. Remove the old `resizeCanvas()` logic. Update CSS to consume the new variables. After this phase, the presentation uses one code path for every viewport.

### Task 2.1: Mutate canvas in `recompute()`

**Files:**
- Modify: `game.js` layout module (SETUP section) and CSS

- [ ] **Step 1: Extend `layout.recompute()` to mutate canvas and CSS**

Replace the current `recompute()` body (the no-op version from Task 1.1) with:

```js
  recompute() {
    const { vw, vh } = this._getViewport();
    const next = this._compute(vw, vh);
    Object.assign(this, next);

    // Mutate game globals (read by camera clamp, draw code, etc.)
    W = 800;
    H = next.H_logical;

    // Canvas internal buffer is at logical resolution.
    canvas.width = W;
    canvas.height = H;

    // Canvas CSS size drives display rendering (browser upscales).
    canvas.style.width = next.display.w + 'px';
    canvas.style.height = next.display.h + 'px';

    // Write CSS custom properties for stylesheet consumption.
    const root = document.documentElement;
    root.style.setProperty('--game-scale', next.scale.toFixed(4));
    root.style.setProperty('--game-display-width', next.display.w + 'px');
    root.style.setProperty('--game-display-height', next.display.h + 'px');
    root.style.setProperty('--game-offset-x', next.display.x + 'px');
    root.style.setProperty('--game-offset-y', next.display.y + 'px');
    root.style.setProperty('--margin-top', next.margin.top + 'px');
    root.style.setProperty('--margin-bottom', next.margin.bottom + 'px');
    root.style.setProperty('--margin-left', next.margin.left + 'px');
    root.style.setProperty('--margin-right', next.margin.right + 'px');
    root.dataset.overlayMode = next.overlayMode;
  },
```

- [ ] **Step 2: Remove the old `resizeCanvas()` function and its event handlers**

In `game.js`, delete these lines (currently at `game.js:16-37`):

```js
// Resize canvas to match viewport aspect ratio on mobile landscape
function resizeCanvas() {
  // ... (the whole function body)
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
if (window.visualViewport) window.visualViewport.addEventListener('resize', resizeCanvas);
```

The `layout.recompute()` call + event listeners added in Tasks 1.1 and 1.3 replace all of this.

- [ ] **Step 3: Verify the page loads and plays on desktop**

Reload http://localhost:3000. Game should render at 1200×720 (scale 1.5) centered in the 1280×720 window with 40px side margins. Play level 1 to verify controls and gameplay work.

Check devtools console:
```js
getComputedStyle(document.documentElement).getPropertyValue('--game-scale')
// Expected: "1.5000"
document.documentElement.dataset.overlayMode
// Expected: "margin"
```

- [ ] **Step 4: Commit**

```bash
git add game.js
git commit -m "feat(#94): layout module mutates canvas + writes CSS vars; remove resizeCanvas"
```

### Task 2.2: Provide default CSS var values inline

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add an inline style block in `<head>` with default CSS var values**

This ensures the page renders sensibly before the first `layout.recompute()` call (e.g., during the HTML parse before `game.js` runs).

After the `<link rel="stylesheet" href="style.css">` line in `index.html`, add:

```html
<style>
  :root {
    --game-scale: 1;
    --game-display-width: 800px;
    --game-display-height: 480px;
    --game-offset-x: 0px;
    --game-offset-y: 0px;
    --margin-top: 0px;
    --margin-bottom: 0px;
    --margin-left: 0px;
    --margin-right: 0px;
  }
  html[data-overlay-mode="canvas"] { /* styles wait for CSS rewrite */ }
  html[data-overlay-mode="margin"]  { /* styles wait for CSS rewrite */ }
</style>
```

- [ ] **Step 2: Reload and verify no visual regression**

Page should render identically to before. Devtools → Elements → `<html>` should show `data-overlay-mode="margin"` after JS runs.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(#94): inline CSS var defaults for first-frame sanity"
```

### Task 2.3: Rewrite `style.css`

**Files:**
- Modify: `style.css` (full rewrite)

- [ ] **Step 1: Replace the entire file contents with the new responsive CSS**

Full replacement of `style.css`:

```css
/* ==================== RESET ==================== */
* { margin: 0; padding: 0; box-sizing: border-box; }

/* ==================== BODY / LAYOUT ==================== */
html, body {
  min-height: 100vh;
  min-height: 100dvh;
  background: #1a1a2e;
  font-family: 'Courier New', monospace;
  overflow: hidden; /* canvas + HUD are positioned; no page scrolling */
}

body {
  position: relative;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
}

/* ==================== CANVAS ==================== */
canvas#game {
  display: block;
  position: absolute;
  left: var(--game-offset-x);
  top: var(--game-offset-y);
  width: var(--game-display-width);
  height: var(--game-display-height);
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  border: none;
  background: #000;
  z-index: 0;
}

/* Add a subtle frame only when the canvas doesn't fill the viewport */
html[data-overlay-mode="margin"] canvas#game {
  box-shadow: 0 0 30px rgba(58, 180, 58, 0.25);
}

/* ==================== KEYBOARD-CONTROLS HINT (desktop only) ==================== */
#controls {
  position: fixed;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(139, 196, 139, 0.55);
  font-size: 11px;
  text-align: center;
  max-width: 800px;
  pointer-events: none;
  z-index: 5;
}

/* Hide the keyboard hint on touch-capable devices (where it's irrelevant) */
@media (any-pointer: coarse) {
  #controls { display: none; }
}

/* ==================== HUD (DOM OVERLAY) ==================== */
#hud {
  position: absolute;
  left: var(--game-offset-x);
  top: var(--game-offset-y);
  width: var(--game-display-width);
  pointer-events: none;
  font-family: 'Courier New', monospace;
  z-index: 2;
}

#hud .hud-level-name {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  text-align: center;
  color: #AADDFF;
  font-size: clamp(10px, 1.4vw, 18px);
  padding: 4px 0;
  text-shadow: 1px 1px 0 #000;
}

#hud .hud-score {
  position: absolute;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  color: #FFD700;
  font-size: clamp(12px, 1.6vw, 22px);
  font-weight: bold;
  text-shadow: 1px 1px 0 #000;
  white-space: nowrap;
}

#hud .hud-time {
  position: absolute;
  top: 8px;
  left: clamp(260px, 32vw, 360px);
  color: #88DDFF;
  font-size: clamp(11px, 1.3vw, 16px);
  font-weight: bold;
  text-shadow: 1px 1px 0 #000;
}

/* ==================== TOUCH CONTROLS ==================== */
#touch-controls {
  display: none; /* shown below when touch pointer is available */
  pointer-events: none;
  z-index: 10;
  font-family: 'Courier New', monospace;
}

@media (any-pointer: coarse) {
  #touch-controls { display: block; }
}

/* Base button look. Highly see-through per design. */
.touch-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  border-radius: 14px;
  border: 2px solid rgba(58, 180, 58, 0.30);
  background: rgba(10, 25, 10, 0.28);
  color: rgba(139, 196, 139, 0.70);
  font-weight: bold;
  font-family: inherit;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
  font-size: clamp(14px, 2.5vw, 28px);
}
.touch-btn:active {
  background: rgba(58, 180, 58, 0.35);
  border-color: rgba(58, 180, 58, 0.70);
}

#btn-spray {
  font-size: clamp(10px, 1.6vw, 16px);
  letter-spacing: 1px;
  color: rgba(255, 136, 0, 0.75);
  border-color: rgba(255, 136, 0, 0.30);
}
#btn-spray:active {
  background: rgba(255, 136, 0, 0.35);
  border-color: rgba(255, 136, 0, 0.70);
}

#btn-down {
  font-size: clamp(10px, 1.6vw, 16px);
  letter-spacing: 1px;
}

.touch-btn-jump {
  font-size: clamp(11px, 1.8vw, 20px);
  letter-spacing: 2px;
  color: rgba(255, 215, 0, 0.80);
  border-color: rgba(255, 215, 0, 0.40);
  border-width: 3px;
}
.touch-btn-jump:active {
  background: rgba(255, 215, 0, 0.35);
  border-color: rgba(255, 215, 0, 0.90);
}

/* ===== Mode-aware touch-control positioning ===== */

/* Overlay mode: buttons sit on top of the canvas in its bottom corners */
html[data-overlay-mode="canvas"] #touch-left {
  position: fixed;
  left: calc(var(--game-offset-x) + 8px);
  bottom: calc(var(--margin-bottom) + 8px);
  width: clamp(140px, 22vw, 220px);
  height: clamp(60px, 10vw, 90px);
  display: flex;
  flex-direction: row;
  gap: 6px;
}
html[data-overlay-mode="canvas"] #touch-right {
  position: fixed;
  right: calc(var(--margin-right) + 8px);
  bottom: calc(var(--margin-bottom) + 8px);
  width: clamp(160px, 26vw, 240px);
  height: clamp(90px, 16vw, 140px);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
html[data-overlay-mode="canvas"] #touch-right .touch-row {
  flex: 1;
  display: flex;
  gap: 4px;
}
html[data-overlay-mode="canvas"] .touch-btn { flex: 1; }

/* Margin mode: buttons sit in the bottom letterbox strip */
html[data-overlay-mode="margin"] #touch-controls {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--margin-bottom);
  padding: 6px 10px;
  display: flex;
  flex-direction: row;
  gap: 12px;
  justify-content: space-between;
  align-items: stretch;
}
html[data-overlay-mode="margin"] #touch-left {
  flex: 1;
  display: flex;
  flex-direction: row;
  gap: 8px;
  max-width: 45%;
}
html[data-overlay-mode="margin"] #touch-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 45%;
}
html[data-overlay-mode="margin"] #touch-right .touch-row {
  flex: 1;
  display: flex;
  gap: 6px;
}
html[data-overlay-mode="margin"] .touch-btn { flex: 1; }
```

**Note on edge case:** If a viewport happens to have an aspect ratio right at the game aspect (≈1.67) with the hysteresis band keeping it in margin mode AND the resulting bottom margin is <60px, touch buttons will be cramped. This is rare (requires a phone or monitor with aspect very close to 5:3). If it comes up during manual QA, extend the layout module to detect `margin.bottom < 60` and force canvas-mode controls regardless of game presentation mode. Address in Phase 8 tuning if observed.

- [ ] **Step 2: Move keyboard hint markup out of the body or accept its removal**

The current `index.html` has a visible `<div id="controls">` with keyboard instructions. In the new CSS, it's fixed-positioned at the very bottom center and hidden on touch devices. Verify by reloading the page — the hint should be visible on desktop, hidden on mobile emulation.

- [ ] **Step 3: Manual QA — exercise every device preset**

In one browser tab, reload http://localhost:3000. Use Chromium devtools → device toolbar to emulate:

1. **Desktop 1920×1080** — game centered, ~60px side margins, `data-overlay-mode="margin"`, full 800×480 gameplay visible. Keyboard hint visible at bottom.
2. **Pixel 5 portrait** — game fits width (~393×236), large bottom margin. Touch controls visible in bottom margin. Keyboard hint hidden.
3. **Pixel 5 landscape** (force 844×390) — either margin or canvas mode depending on exact aspect. Touch controls present.
4. **iPad portrait** — game fits width, bottom margin, touch controls there.
5. **iPad landscape** — game fits either way, touch controls positioned sanely.

The goal is just: **nothing is broken visually.** The HUD text still draws (from canvas) because we haven't moved HUD to DOM yet — that's Phase 4.

- [ ] **Step 4: Commit**

```bash
git add style.css
git commit -m "refactor(#94): rewrite style.css to consume layout CSS vars; delete media queries"
```

---

## Phase 3: Touch Controls Anchoring & Input Modality

**Goal:** Reposition touch controls via the new CSS rules from Phase 2. Update the game's internal touch detection to `(any-pointer: coarse)` so touch buttons respond on hybrid devices. Verify button responsiveness across emulated devices.

### Task 3.1: Update game.js touch detection

**Files:**
- Modify: `game.js` TOUCH CONTROLS section (starts ~line 5244)

- [ ] **Step 1: Find and read the current touch detection**

Run: `grep -n "hover: none\|pointer: coarse\|any-pointer" game.js`

Current code (approx. `game.js:5244`) likely checks `(hover: none) and (pointer: coarse)` to decide whether to wire up touch handlers, OR unconditionally wires them (let the CSS do the hiding). Confirm by reading the TOUCH CONTROLS section.

- [ ] **Step 2: Ensure handlers are wired unconditionally**

If the touch handler setup (`setupTouch()` or similar) is gated behind a matchMedia check, remove the gate. Touch handlers should always be attached — the CSS hides the buttons when the device has no touch pointer, so no events fire. This is simpler and correct for hybrid devices.

Example edit if a gate exists:

```js
// Before:
if (matchMedia('(hover: none) and (pointer: coarse)').matches) {
  setupTouchHandlers();
}

// After:
setupTouchHandlers();
```

Or if there's no gate, this task is a no-op — skip to Step 3.

- [ ] **Step 3: Manually verify on desktop (no touch)**

Reload desktop viewport. Buttons should NOT be visible (hidden via `@media (any-pointer: coarse)` non-match).

- [ ] **Step 4: Manually verify on mobile emulation**

Chromium devtools → iPhone emulation. Buttons should be visible. Tap "JUMP" — player should jump. Tap "SPRAY" — bear spray animation should play (in a level where spray is needed). Tap left/right → player should move.

- [ ] **Step 5: Commit**

```bash
git add game.js
git commit -m "refactor(#94): simplify touch handler setup (any-pointer: coarse handled in CSS)"
```

### Task 3.2: Playwright verification of touch controls across devices

**Files:**
- Create/append: `qa/scenarios/responsive-layout.mjs` (extend existing scenario from Task 1.4)

- [ ] **Step 1: Extend the responsive-layout scenario to also check touch control visibility**

At the end of the scenario body (before `console.log('...PASSED')`), append:

```js
  // Verify touch controls visibility matches device capability.
  const touchVisible = await game.page.evaluate(() => {
    const el = document.getElementById('touch-controls');
    if (!el) return null;
    const style = getComputedStyle(el);
    return style.display !== 'none';
  });
  const expectTouch = (device === 'mobile-portrait' || device === 'mobile-landscape');
  assert(touchVisible === expectTouch,
    `touch-controls display on '${device}' expected ${expectTouch}, got ${touchVisible}`);
```

- [ ] **Step 2: Run the scenario on each preset**

```bash
cd qa
node runner.mjs --device=desktop scenarios/responsive-layout.mjs
node runner.mjs --device=mobile-portrait scenarios/responsive-layout.mjs
node runner.mjs --device=mobile-landscape scenarios/responsive-layout.mjs
```

All three should print `PASSED`.

- [ ] **Step 3: Commit**

```bash
git add qa/scenarios/responsive-layout.mjs
git commit -m "test(#94): verify touch-control visibility per device preset"
```

---

## Phase 4: HUD DOM Overlay

**Goal:** Move the HUD's text elements (level name, score, time) from canvas drawing to a DOM overlay. Canvas keeps drawing the HUD strip background, life/health icons, trail progress bar, and spray/glissade cooldown bars — those are graphical and size well with the canvas. Text gets `clamp()`-based sizing so it's readable at every scale.

### Task 4.1: Add HUD DOM structure to index.html

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Insert the HUD DOM block immediately after `<canvas id="game">`**

```html
<div id="hud" aria-hidden="true">
  <div class="hud-level-name" id="hud-level-name"></div>
  <div class="hud-score" id="hud-score">SCORE: 0</div>
  <div class="hud-time" id="hud-time">TIME: 0:00</div>
</div>
```

- [ ] **Step 2: Reload and verify**

Page should still render; HUD divs are empty or placeholder text. Their CSS (from Phase 2) already positions them at the top of the canvas rect.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(#94): add HUD DOM structure"
```

### Task 4.2: Add `updateHUD()` function and wire into the game loop

**Files:**
- Modify: `game.js` — add function near DRAWING section; call from MAIN LOOP

- [ ] **Step 1: Add `updateHUD()` near the top of the DRAWING section (around `game.js:2666`)**

```js
// ==================== DOM HUD UPDATE ====================
const _hudEls = {
  levelName: document.getElementById('hud-level-name'),
  score: document.getElementById('hud-score'),
  time: document.getElementById('hud-time'),
};
function updateHUD() {
  // Hide HUD outside of gameplay states.
  const visible = game.state === 'playing';
  document.getElementById('hud').style.display = visible ? 'block' : 'none';
  if (!visible) return;

  if (LEVELS[game.levelNum]) {
    _hudEls.levelName.textContent = LEVELS[game.levelNum].name.toUpperCase();
  }
  if (player) {
    _hudEls.score.textContent = `SCORE: ${player.score}`;
  }
  const timeSeconds = Math.floor(game.levelTick / 60);
  const mm = Math.floor(timeSeconds / 60);
  const ss = (timeSeconds % 60).toString().padStart(2, '0');
  _hudEls.time.textContent = `TIME: ${mm}:${ss}`;
}
```

- [ ] **Step 2: Call `updateHUD()` in the main loop**

Find the `draw()` or main render dispatch (around `game.js:4769` based on the section map). Add `updateHUD();` right at the end of each frame's draw path, or once at the end of the `update()` function. The simplest spot is at the very end of `draw()`:

```js
function draw() {
  // ... existing draw dispatch ...
  updateHUD();
}
```

- [ ] **Step 3: Reload and verify**

Desktop: level name, score, and time should appear as DOM text overlaying the top of the canvas. They should update during gameplay.

- [ ] **Step 4: Commit**

```bash
git add game.js
git commit -m "feat(#94): DOM HUD text updates from game state"
```

### Task 4.3: Remove duplicate text from canvas `drawHUD()`

**Files:**
- Modify: `game.js:3973` `drawHUD()` function

- [ ] **Step 1: Read the current function**

Read `game.js:3973-4055` (the `drawHUD()` body).

- [ ] **Step 2: Delete the text rendering lines that are now in DOM**

From `drawHUD()`, remove these specific `ctx.fillText()` calls and their associated font/fillStyle setup:

1. The level name block (approximately `game.js:3998-4002`):
   ```js
   ctx.fillStyle = '#AADDFF';
   ctx.font = '10px Courier New';
   ctx.textAlign = 'center';
   ctx.fillText(LEVELS[game.levelNum].name.toUpperCase(), W / 2, 13);
   ```

2. The score text block (approximately `game.js:4004-4007`):
   ```js
   ctx.fillStyle = '#FFD700';
   ctx.font = 'bold 14px Courier New';
   ctx.fillText(`SCORE: ${player.score}`, W / 2, 28);
   ```

3. The time text block (approximately `game.js:4009-4016`):
   ```js
   const timeSeconds = Math.floor(game.levelTick / 60);
   const timeStr = `${Math.floor(timeSeconds / 60)}:${(timeSeconds % 60).toString().padStart(2, '0')}`;
   ctx.fillStyle = '#88DDFF';
   ctx.font = 'bold 12px Courier New';
   ctx.textAlign = 'left';
   ctx.fillText(`TIME: ${timeStr}`, 260, 22);
   ctx.textAlign = 'right';
   ```

**Leave intact:**
- HUD background strip (`ctx.fillRect(0, 0, W, 36)`)
- Lives label `ctx.fillText('LIVES:', 8, 22)` and life icon rects (these are labels adjacent to icons; keep together for simplicity)
- H2O label and water drop circles
- Trail progress bar (label and fill)
- Spray / Glissade cooldown indicators

- [ ] **Step 3: Reload and verify no duplicate text**

Desktop: DOM HUD shows level name, score, time. Canvas no longer draws them. Lives icons, H2O drops, trail bar, and cooldowns still render on canvas as before.

- [ ] **Step 4: Commit**

```bash
git add game.js
git commit -m "refactor(#94): remove duplicate HUD text from canvas (now DOM)"
```

---

## Phase 5: SCREENS Audit — Make Menu/GameOver/LevelComplete/Win Tolerant of Variable H

**Goal:** Audit the four screen-drawing functions and fix any code that assumes `H === 480`. With `canvas_mode` viewports, `H` is variable; screens that anchor elements against absolute pixel Y coordinates will appear broken (content clipped or floating).

### Task 5.1: Audit each screen function

**Files:**
- Read-only audit of `game.js:4369` (drawMenu), `game.js:4504` (drawGameOver), `game.js:4531` (drawLevelComplete), `game.js:4603` (drawWin), `game.js:4318` (drawEnterInitials)

- [ ] **Step 1: For each function, grep for hardcoded y-coordinates**

Run:

```bash
grep -n "fillText\|fillRect\|ctx\." game.js | sed -n '/^43[1-9][0-9]\|^4[4-5][0-9][0-9]\|^46[0-9][0-9]/p' | head -200
```

Or use Read to load each function's body (e.g., `game.js:4369-4504` for drawMenu).

- [ ] **Step 2: For each function, categorize each y-coordinate usage**

Within the function body, classify each y-coord as:

- **Top-anchored** (small y, like `y = 40`): these work unchanged at variable H.
- **Bottom-anchored** (like `y = 420` or `y = 450`): must be rewritten to `H - offset` so they scale with H.
- **Center-anchored** (like `y = 240`): must be rewritten to `H / 2` or `H/2 + offset`.
- **Absolute mid-screen** (like `y = 200` for a title): may or may not need `H / 2` form depending on intent.

- [ ] **Step 3: Document the audit in a temporary note**

Create a file `audit-screens.md` (gitignored) or use TodoWrite to list each needed edit as a task with file:line reference. Don't commit this file; it's scratch space.

- [ ] **Step 4: No commit for this task — audit only**

### Task 5.2: Apply the screen fixes

**Files:**
- Modify: `game.js:4369-4670` (the five screen functions)

- [ ] **Step 1: Rewrite each identified absolute-y reference**

Canonical transforms:
- `y = 420` → `H - 60` (bottom-anchor 60px above the bottom edge)
- `y = 450` → `H - 30`
- `y = 240` → `H / 2`
- `y = 200` → `H / 2 - 40`

For each, read surrounding context to confirm the intent (title vs. button vs. footer), then apply the appropriate transform.

**Apply similarly to `drawEnterInitials()`, `drawMenu()`, `drawGameOver()`, `drawLevelComplete()`, `drawWin()`.**

- [ ] **Step 2: Verify on desktop at several canvas heights**

In browser devtools, shrink the viewport height to ~500px then 400px then 340px while on the game-over / level-complete / win screens. Text should stay anchored correctly (no text disappearing off the bottom, no huge blank strips).

Force a game-over state via console:
```js
window.trailBlazerDebug.pokePlayer({ lives: 0, health: 0 });
```

Or trigger level complete by warping to the final column of a level and walking to the goal.

- [ ] **Step 3: Commit**

```bash
git add game.js
git commit -m "fix(#94): screens (menu/gameover/etc.) anchor correctly when H != 480"
```

---

## Phase 6: BOSS ARENA Audit & Fix

**Goal:** Read the BOSS ARENA section and fix any assumptions that `H === 480` or that viewport shape is static. The recent ground-pound and shockwave work is active code — assume pixel-absolute calculations exist and must be generalized.

This phase is a **spike followed by fixes**. If the spike reveals the work is larger than estimated, flag it before proceeding.

### Task 6.1: Read BOSS ARENA section and produce a fix list

**Files:**
- Read-only: `game.js:1054-1988` (BOSS ARENA section)

- [ ] **Step 1: Read the section in chunks**

Use Read tool:
- `game.js:1054-1200` (boss state machine core)
- `game.js:1200-1400` (attack dispatch, shockwaves)
- `game.js:1400-1600` (per-boss logic)
- `game.js:1600-1988` (remaining boss logic)

Also read `drawBossArena` at `game.js:4066` and `drawBossHUD` at `game.js:4256`.

- [ ] **Step 2: Identify `H === 480` or `viewport_height` assumptions**

For each finding, record file:line + description. Typical red flags:

- Shockwave spawn Y / ground Y computed as `480 - someOffset` instead of `H - someOffset` or (better) tile-row-based
- Boss hop apex or ground-pound trajectory with absolute pixel bounds
- Arena bounds drawn at absolute y coordinates instead of via `H`
- Camera clamp override for the boss scene using `480`
- Screen-shake calculations in pixels (these likely scale fine as they're offsets, but verify)
- Particle y bounds for ground impact

- [ ] **Step 3: Estimate fix scope**

If the list is <8 items and each is a small find-and-replace: proceed to Task 6.2.

If the list is large (>15 items) or involves substantial state-machine rewiring: **STOP**. Report back to the user with the findings. Possible mitigations:
- Constrain the boss arena camera to `H = 480` explicitly (force margin-mode view of the arena regardless of viewport) — simplest fallback if the arena is heavily pixel-coupled.
- Defer some boss fixes to a follow-up issue.

- [ ] **Step 4: Do not commit for this task — audit only**

### Task 6.2: Apply boss arena fixes

**Files:**
- Modify: `game.js` within `game.js:1054-1988`, `game.js:4066`, `game.js:4256`

- [ ] **Step 1: For each identified finding, apply the fix**

Canonical transforms are the same as Task 5.2. Additionally for boss-specific code:

- **Ground-pound shockwave Y:** if the shockwave is tied to the arena floor, compute from floor tile row × `TS` (e.g., `floorTileRow * TS + someOffset`) rather than `H - offset` or `480 - offset`.
- **Boss hop apex:** if the apex is absolute (e.g., `y = 100`), express as "N tiles above floor" or `arenaFloorY - 10 * TS` so it scales with the arena, not the viewport.
- **Arena bounds rendering (`drawBossArena`):** audit any `H` usage; bounds derived from tile coordinates should be fine.

- [ ] **Step 2: Test the boss fight at several canvas heights**

Use the existing Bigfoot Playwright scenarios to smoke-test:

```bash
cd qa
node runner.mjs scenarios/bigfoot-ground-pound.mjs
node runner.mjs scenarios/bigfoot-dual-wave.mjs
node runner.mjs --device=mobile-landscape scenarios/bigfoot-ground-pound.mjs
```

All three should still pass. If any fails, diagnose using the screenshots they produce (`qa/screenshots/`).

- [ ] **Step 3: Manual playtest of the full boss fight on desktop AND mobile emulation**

- Warp to level 11 (`Ctrl+Shift+D`, `Ctrl+1+1` or `warpToLevel(11)`).
- Fight Bigfoot through all three phases.
- Verify: shockwaves align with the ground, ground-pound windup animates correctly, hop apex doesn't clip off-screen.
- Repeat on Thunderbird (level 5) and Mothman (level 8).

- [ ] **Step 4: Commit**

```bash
git add game.js
git commit -m "fix(#94): boss arenas (shockwaves, hops, bounds) tolerant of variable H"
```

---

## Phase 7: Playwright Device Preset Coverage

**Goal:** Add the five new device presets and a matrix scenario that runs the smoke path on each.

### Task 7.1: Add new device presets

**Files:**
- Modify: `qa/lib/devices.mjs`

- [ ] **Step 1: Insert new presets into `DEVICE_PRESETS`**

Add inside the existing `DEVICE_PRESETS` object, before the closing brace:

```js
  'desktop-fhd': {
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },

  'desktop-4k': {
    viewport: { width: 3840, height: 2160 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },

  'desktop-ultrawide': {
    viewport: { width: 3440, height: 1440 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },

  'tablet-landscape': {
    viewport: { width: 1194, height: 834 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
      '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },

  'tablet-portrait': {
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
      '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
```

- [ ] **Step 2: Verify runner accepts the new names**

```bash
cd qa
node runner.mjs --device=desktop-fhd scenarios/smoke.mjs
```

Expected: scenario runs without "Unknown device preset" error.

- [ ] **Step 3: Commit**

```bash
git add qa/lib/devices.mjs
git commit -m "test(#94): add 5 new Playwright device presets for layout coverage"
```

### Task 7.2: Extend responsive-layout scenario to cover new presets

**Files:**
- Modify: `qa/scenarios/responsive-layout.mjs`

- [ ] **Step 1: Add expectation entries for each new device**

In the `EXPECTATIONS` map at the top of the scenario, add:

```js
  // desktop-fhd 1920x1080: aspect 1.78 → margin mode
  'desktop-fhd': {
    overlayMode: 'margin',
    H_logical: 480,
    scaleNear: 2.25, // min(1920/800, 1080/480) = min(2.4, 2.25) = 2.25
  },
  // desktop-4k 3840x2160: aspect 1.78 → margin mode, big scale
  'desktop-4k': {
    overlayMode: 'margin',
    H_logical: 480,
    scaleNear: 4.50, // min(3840/800, 2160/480) = min(4.8, 4.5) = 4.5
  },
  // desktop-ultrawide 3440x1440: aspect 2.39 → canvas mode (above threshold 2.167)
  'desktop-ultrawide': {
    overlayMode: 'canvas',
    // H_logical = floor(1440 / (3440/800)) = floor(1440 / 4.3) = 334
    H_logical: 334,
    scaleNear: 4.30,
  },
  // tablet-landscape 1194x834: aspect 1.43 → margin mode (fit by height)
  'tablet-landscape': {
    overlayMode: 'margin',
    H_logical: 480,
    scaleNear: 1194/800, // min(1194/800, 834/480) = min(1.49, 1.74) = 1.49
  },
  // tablet-portrait 768x1024: aspect 0.75 → margin mode (fit by width)
  'tablet-portrait': {
    overlayMode: 'margin',
    H_logical: 480,
    scaleNear: 768 / 800,
  },
```

- [ ] **Step 2: Run the scenario on every preset**

```bash
cd qa
for dev in desktop mobile-portrait mobile-landscape desktop-fhd desktop-4k desktop-ultrawide tablet-landscape tablet-portrait; do
  echo "=== $dev ==="
  node runner.mjs --device=$dev scenarios/responsive-layout.mjs
done
```

Expected: every row prints `PASSED`.

- [ ] **Step 3: If any preset fails, diagnose and correct the expectation**

If the failure is in the expectation (e.g., an aspect ratio I computed wrong): update the `EXPECTATIONS` entry.

If the failure is in the layout module: diagnose and fix the module, not the expectation.

- [ ] **Step 4: Commit**

```bash
git add qa/scenarios/responsive-layout.mjs
git commit -m "test(#94): verify unified layout rule across 8 device presets"
```

### Task 7.3: Regression sweep — run existing scenarios on new presets

**Files:**
- None modified. Execution-only verification.

- [ ] **Step 1: Run a critical-path scenario on each desktop preset**

```bash
cd qa
for dev in desktop-fhd desktop-4k desktop-ultrawide; do
  echo "=== $dev / smoke ==="
  node runner.mjs --device=$dev scenarios/smoke.mjs
done
```

Expected: each passes. If `smoke.mjs` doesn't exist, substitute any basic play-level scenario.

- [ ] **Step 2: Run Bigfoot scenarios on ultrawide and tablet**

```bash
cd qa
node runner.mjs --device=desktop-ultrawide scenarios/bigfoot-ground-pound.mjs
node runner.mjs --device=tablet-landscape scenarios/bigfoot-ground-pound.mjs
```

Both should pass. These are the highest-risk regressions since boss arena changes were in Phase 6.

- [ ] **Step 3: No commit — verification only**

---

## Phase 8: Final Manual QA, Tuning, and PR

**Goal:** Human playtest across representative devices. Tune `PAN_THRESHOLD` or `LAYOUT_HYST` if anything feels off. Open the PR.

### Task 8.1: Manual playtest matrix

- [ ] **Step 1: Desktop fullscreen 1920×1080**
  - Warp to level 1, play to the goal
  - Warp to level 5 (Thunderbird), fight and win
  - Warp to level 11 (Bigfoot), fight and survive at least phase 1
  - Verify: HUD readable, touch controls hidden, no vertical panning, camera follows player smoothly

- [ ] **Step 2: Desktop windowed ~800×600**
  - Verify: game fits, bottom margin visible, no layout glitches on resize

- [ ] **Step 3: Chrome mobile emulation — Pixel 5 landscape**
  - Play level 1 to goal using on-screen buttons
  - Verify: buttons responsive, HUD readable, no layout jumps during play

- [ ] **Step 4: Chrome mobile emulation — Pixel 5 portrait**
  - Play level 1 briefly
  - Verify: small-but-playable canvas, buttons in bottom margin, HUD readable

- [ ] **Step 5: Chrome mobile emulation — iPad landscape & portrait**
  - Verify: sensible layout in both orientations, touch controls present

- [ ] **Step 6: Live resize test**
  - On desktop, drag browser window from narrow to wide to narrow continuously
  - Verify: no flicker between margin and canvas modes (hysteresis works); HUD, touch controls, canvas all track viewport

### Task 8.2: Tune parameters if needed

If manual QA reveals a threshold feels wrong (e.g., a specific tablet viewport in an awkward mode), adjust `PAN_THRESHOLD` or `LAYOUT_HYST` in the layout module. Re-run the responsive-layout Playwright scenario to ensure expectations still hold (or update them).

- [ ] **Step 1: If tuning applied, commit**

```bash
git add game.js qa/scenarios/responsive-layout.mjs
git commit -m "tune(#94): adjust PAN_THRESHOLD based on playtest feedback"
```

### Task 8.3: Open the PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin issue-94-responsive-layout
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "Responsive layout refactor: unified viewport model (#94)" --body "$(cat <<'EOF'
## Summary

Replaces the accretion of media-query patches and `resizeCanvas()`'s logical-size mutation with a single, unified viewport-to-game mapping. Every device, orientation, and aspect ratio is served by one rule.

- **Unified rule:** always show 25 tiles horizontally. Viewport aspect vs. game aspect (`PAN_THRESHOLD = 1.25`) picks between fit-fully (letterbox, controls in margin) and fit-by-width (vertical pan, controls overlay). Hysteresis prevents flicker on live resize.
- **New layout module** in `game.js` SETUP owns the mapping, writes globals + CSS custom properties.
- **Full CSS rewrite:** all `@media (orientation)` and `(hover: none)` branches deleted; behavior driven by `--game-*` variables and `[data-overlay-mode]`.
- **Touch controls** universally see-through, anchored to canvas rect, shown on any touch-capable device via `(any-pointer: coarse)`.
- **HUD text** (level name, score, time) moved to DOM overlay with `clamp()`-based sizing; HUD graphics (lives icons, water drops, trail bar, cooldowns) stay on canvas.
- **Boss arenas** audited for `H === 480` assumptions and generalized.
- **Playwright coverage** expanded with 5 new device presets and a unified-layout scenario matrix.

Closes #94.

## Test plan

- [x] `qa/scenarios/responsive-layout.mjs` passes on 8 device presets (desktop, mobile-portrait, mobile-landscape, desktop-fhd, desktop-4k, desktop-ultrawide, tablet-landscape, tablet-portrait)
- [x] `qa/scenarios/bigfoot-ground-pound.mjs` passes on desktop-ultrawide and tablet-landscape
- [x] Manual playtest: full level 1 on desktop 1920×1080, Pixel 5 landscape & portrait, iPad both orientations
- [x] Manual playtest: Bigfoot boss fight on desktop and mobile-landscape emulation
- [x] Live-resize sweep on desktop reveals no flicker; hysteresis holds

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Paste the PR URL back to the user for review**

---

## Post-merge cleanup (recurring checklist)

After the PR merges:

```bash
git checkout master && git pull
git branch -d issue-94-responsive-layout
```

If the spec's "Open Questions" section identifies follow-up work (decorative margin art, screen-reader HUD, etc.), file those as separate issues.

---

## Risks Carried From Spec

- **Bigfoot arena may be bigger than estimated.** Phase 6 is gated on a read-first spike. If the spike reveals >300 LOC of coupling, report back before charging through. Fallback: force margin-mode view of the boss arena regardless of viewport.
- **HUD DOM rendering may differ visually.** DOM text uses the system font stack more faithfully than canvas text. Match `font-family`, weight, and sizes during manual QA.
- **Difficulty drift on panning viewports.** Player sees less vertical context on ultrawide / phone landscape than on desktop. Today's leaderboard already has this drift (broken landscape path). The new model makes it continuous. Flag for playtest; narrow `PAN_THRESHOLD` if unacceptable.
