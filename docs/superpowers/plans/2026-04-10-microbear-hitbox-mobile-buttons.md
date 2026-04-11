# Microbear Hitbox & Mobile Action Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Micro Bear hitbox so stomping is reliable (#81) and enlarge the mobile landscape action buttons for better playability (#80).

**Architecture:** Two independent single-file edits. Task 1 changes one factory function in `game.js`. Task 2 changes two CSS values in `style.css`. Neither depends on the other — they can be committed separately.

**Tech Stack:** Vanilla JS, Canvas 2D, CSS. No build step. Verify via browser at `http://localhost:3000` (requires `python -m http.server 3000`) and Playwright QA runner (`cd qa && node runner.mjs scenarios/<name>.mjs`).

---

## Files Modified

- `game.js` — `makeMouse` factory (~line 954)
- `style.css` — landscape `@media` block, `#touch-right` override (~line 178)

---

### Task 1: Enlarge Micro Bear hitbox (issue #81)

**Files:**
- Modify: `game.js:954-967` (`makeMouse`)

**Context:** `makeMouse` at ~line 954 returns `w: 16, h: 12`. The stomp check is `player.y + player.h < e.y + e.h * 0.75`, giving a 9px-tall stomp zone on a 12px hitbox. Increasing to `w: 22, h: 18` widens the stomp zone to 13.5px and gives a 22px-wide landing surface. `drawMouse` draws from `(sx + e.w/2, sy + e.h)` (bottom-center) so the visual stays correct at any hitbox size — no draw changes needed. The debug overlay (`Ctrl+Shift+D`) shows hitboxes in orange for visual confirmation.

- [ ] **Step 1: Update `makeMouse` in `game.js`**

Find the `makeMouse` function (~line 954). Change `w` and `h`:

**Before:**
```js
function makeMouse(tx, ty) {
  return {
    type: 'mouse',
    x: tx * TS, y: ty * TS + 8,
    w: 16, h: 12,
```

**After:**
```js
function makeMouse(tx, ty) {
  return {
    type: 'mouse',
    x: tx * TS, y: ty * TS + 8,
    w: 22, h: 18,
```

- [ ] **Step 2: Write a Playwright QA scenario**

Create `qa/scenarios/microbear-hitbox.mjs`:

```js
// Visual QA: confirm Micro Bear hitbox is larger than before.
// The runner loads /?debug=1 so dbg.url=true and the debug overlay
// (orange hitbox outlines) is already active — no extra setup needed.
// Warps to level 3 (first level with Micro Bears) and screenshots.

export default async function scenario(game) {
  await game.warpToLevel(2);
  await game.waitFrames(20);

  // Walk right so Micro Bears are visible on screen
  await game.holdKey('ArrowRight', 40);
  await game.waitFrames(10);
  await game.screenshot('microbear-hitbox-debug');
  console.log('Screenshot saved to qa/screenshots/microbear-hitbox-debug.png');
  console.log('Inspect: orange enemy hitboxes should show ~22x18 for Micro Bears');
}
```

- [ ] **Step 3: Start the local server (if not already running)**

```bash
python -m http.server 3000
```

Keep this running in a separate terminal for all verification steps.

- [ ] **Step 4: Run the QA scenario**

```bash
cd qa
node runner.mjs scenarios/microbear-hitbox.mjs
```

Expected output:
```
Screenshot saved to qa/screenshots/microbear-hitbox-debug.png
Inspect: orange enemy hitboxes should show ~22x18 for Micro Bears
```

- [ ] **Step 5: Inspect the screenshot**

Read `qa/screenshots/microbear-hitbox-debug.png`. Confirm:
- Orange hitbox outline on Micro Bears is visibly wider/taller than the marmot (26×22) is taller but similar in width — the mouse box should be clearly larger than before (was 16×12)
- No visual gap between the hitbox outline and the drawn mouse body
- Mouse body still looks correct (body/head/ears aligned to bottom-center of box)

- [ ] **Step 6: Commit**

```bash
git add game.js qa/scenarios/microbear-hitbox.mjs
git commit -m "fix: enlarge Micro Bear hitbox to 22x18 for easier stomping (#81)

Stomp zone increases from 9px to 13.5px tall and width from 16px
to 22px. drawMouse anchors from bottom-center so visual is unchanged.

closes #81"
```

---

### Task 2: Increase mobile landscape action button size (issue #80)

**Files:**
- Modify: `style.css:178-185` (`#touch-right` in landscape `@media` block)

**Context:** The landscape `@media (hover: none) and (pointer: coarse) and (orientation: landscape)` block at ~line 157 overrides `#touch-right` dimensions. The current values are `width: clamp(115px, 21vw, 165px)` and `height: clamp(70px, 13vw, 100px)`. These need to increase ~25% to `clamp(140px, 26vw, 200px)` and `clamp(90px, 17vw, 130px)` respectively. The buttons (SLIDE, SPRAY, JUMP) fill the panel via `flex: 1` / `align-items: stretch`, so both rows scale automatically.

- [ ] **Step 1: Update `#touch-right` in `style.css`**

Find the `#touch-right` block inside the landscape `@media` query (~line 178):

**Before:**
```css
  #touch-right {
    position: fixed;
    bottom: 8px;
    right: 8px;
    width: clamp(115px, 21vw, 165px);
    height: clamp(70px, 13vw, 100px);
    gap: 3px;
  }
```

**After:**
```css
  #touch-right {
    position: fixed;
    bottom: 8px;
    right: 8px;
    width: clamp(140px, 26vw, 200px);
    height: clamp(90px, 17vw, 130px);
    gap: 3px;
  }
```

- [ ] **Step 2: Write a Playwright QA scenario**

Create `qa/scenarios/mobile-buttons.mjs`:

```js
// Visual QA: screenshot the full page to evaluate mobile action button sizing.
// The CSS media query requires `pointer: coarse` which Playwright doesn't set
// by default, so we inject a style override to force the landscape touch layout.
// We use page.screenshot() (not the canvas API) to capture the full page DOM
// including the touch-controls overlay.

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function scenario(game) {
  await game.page.setViewportSize({ width: 844, height: 390 });
  await game.warpToLevel(0);
  await game.waitFrames(10);

  // Force the landscape touch controls visible by overriding display and applying
  // the landscape positioning directly — bypasses the pointer:coarse media query.
  await game.page.evaluate(() => {
    const tc = document.getElementById('touch-controls');
    const tl = document.getElementById('touch-left');
    const tr = document.getElementById('touch-right');

    // Mirror the landscape @media overrides from style.css
    Object.assign(tc.style, {
      display: 'flex', position: 'fixed', bottom: '0', left: '0', right: '0',
      height: 'auto', padding: '0', gap: '0', justifyContent: 'space-between',
      zIndex: '10', background: 'none', pointerEvents: 'none',
    });
    Object.assign(tl.style, {
      position: 'fixed', bottom: '8px', left: '8px',
      width: 'clamp(108px, 21.6vw, 168px)', height: 'clamp(53px, 10.8vw, 78px)', gap: '4px',
    });
    Object.assign(tr.style, {
      position: 'fixed', bottom: '8px', right: '8px', gap: '3px',
      // These are the NEW values — the ones being tested:
      width: 'clamp(140px, 26vw, 200px)', height: 'clamp(90px, 17vw, 130px)',
    });
  });

  // Use Playwright's full-page screenshot to capture DOM elements (canvas + buttons)
  const buf = await game.page.screenshot({ fullPage: false });
  const outPath = resolve(__dirname, '..', 'screenshots', 'mobile-buttons-landscape.png');
  writeFileSync(outPath, buf);
  console.log('Screenshot saved to qa/screenshots/mobile-buttons-landscape.png');
  console.log('Inspect: SLIDE/SPRAY/JUMP buttons bottom-right, arrow buttons bottom-left.');
  console.log('Right panel should be visibly larger than left. No overflow.');
}
```

- [ ] **Step 3: Run the QA scenario**

```bash
cd qa
node runner.mjs scenarios/mobile-buttons.mjs
```

Expected output:
```
Screenshot saved to qa/screenshots/mobile-buttons-landscape.png
Inspect: right-side buttons (SLIDE/SPRAY/JUMP) should be clearly tappable,
proportional to the left-side arrow buttons.
```

- [ ] **Step 4: Inspect the screenshot**

Read `qa/screenshots/mobile-buttons-landscape.png`. Confirm:
- SLIDE, SPRAY, and JUMP buttons are visible in the bottom-right corner
- The right-side panel is visibly larger than the left-side directional buttons (by design — more actions need more real estate)
- Buttons do not overflow off the right or bottom edge of the screen
- The panel looks proportional — not so large it obscures gameplay area

If the buttons look too small or too large, adjust the clamp values in `style.css` and re-run the scenario.

- [ ] **Step 5: Commit**

```bash
git add style.css qa/scenarios/mobile-buttons.mjs
git commit -m "feat: increase mobile landscape action button size (#80)

#touch-right panel width clamp(115→140px, 21→26vw, 165→200px),
height clamp(70→90px, 13→17vw, 100→130px). SLIDE/SPRAY/JUMP
buttons scale via flex stretch — no per-button changes needed.

closes #80"
```
