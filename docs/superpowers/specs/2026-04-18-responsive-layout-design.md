# Responsive Layout Refactor — Design Spec

**Issue:** TBD (file when starting implementation)
**Date:** 2026-04-18
**Author:** Matt Trent (w/ Claude)

## Problem

The game's presentation layer has grown through accretion: every new viewport issue got its own CSS media query or JS special case, and none of them reference a shared model.

- `style.css` has duplicated `@media (hover: none) and (pointer: coarse)` blocks, `!important` overrides on canvas dimensions, and eight hand-tuned `clamp()` font sizes.
- `game.js:16-34` — `resizeCanvas()` — mutates the game's *logical* `W` and `H` based on viewport on mobile landscape. The game world itself resizes, not just its display. This is why mobile landscape feels like a different game.
- Touch controls are positioned against the viewport, not the canvas rect. On phones with odd aspect ratios they drift relative to the playfield.
- Desktop caps canvas width at 800px via `min(800px, 100vw)` — on a 4K monitor the game renders as a tiny 800px box.
- No unified story for HUD, menus, or hit-test scaling.

The underlying cause is architectural, not cosmetic: **no layer owns the viewport-to-game mapping.** That mapping has been reinvented independently in CSS, in `resizeCanvas()`, and in individual `draw*()` functions. Each new device surface becomes another patch.

## Goals

- One rule governs how the game is presented on every device, orientation, and screen size. No device-class branches.
- Delete all media-query-driven special cases and `!important` overrides in `style.css`.
- Delete the logical-size mutation in `resizeCanvas()`.
- Game fills the screen meaningfully on a desktop browser (no more 800px box on a 4K monitor).
- Mobile landscape continues to work, now by the same rule as everything else.
- Phone portrait, tablets (both orientations), and ultrawide monitors all work **automatically** without new code per device.
- Vintage aesthetic preserved — chunky canvas primitives at logical resolution, scaled with `image-rendering: pixelated`.

## Non-Goals

- No change to game logic, physics constants, level definitions, enemy behavior, or the Playwright debug API.
- No framework migration. No build step. No new runtime dependencies.
- No accessibility (screen reader / keyboard nav) rework — the canvas-based core is not changing. DOM-overlay HUD leaves the door open for future accessibility work but does not deliver it.
- No new input modalities (gamepad, etc.).
- No redesign of Menu / GameOver / LevelComplete / Win / EnterInitials screens' content — only their layout must tolerate a variable `H`.

## Design

### 1. The Unified Scaling Rule

One rule, evaluated continuously from viewport dimensions. No device detection, no orientation checks, no `matchMedia` branching.

```
game_aspect      = 800 / 480 = 1.667
viewport_aspect  = viewport_width / viewport_height

if viewport_aspect > game_aspect × PAN_THRESHOLD:
    # Viewport is appreciably wider than game aspect → fit by width, pan vertically
    scale           = viewport_width / 800
    H_logical       = floor(viewport_height / scale)
    display_width   = viewport_width
    display_height  = viewport_height
    overlay_mode    = canvas   # controls overlay the play area
else:
    # Viewport is close to game aspect or taller → fit entire 800×480 game, letterbox
    scale           = min(viewport_width / 800, viewport_height / 480)
    H_logical       = 480
    display_width   = 800 × scale
    display_height  = 480 × scale
    overlay_mode    = margin   # controls live in the letterbox margin
```

**`PAN_THRESHOLD = 1.25`** (tunable). At 1.25×, any viewport up to ~2.08:1 aspect ratio (including every standard 16:9 desktop, 4:3 tablet, and near-square device) renders the full 800×480 game — no vertical panning. Beyond that (21:9 ultrawide, phone landscape ~19.5:9), the rule switches to fit-by-width with vertical panning.

**Example outcomes under this rule:**

| Viewport | Aspect | Above threshold? | Outcome |
|---|---|---|---|
| Desktop 1920×1080 | 1.78 | no | scale 2.25×, display 1800×1080, side margins 60px each, `H=480`, **no pan** |
| Desktop 1280×720 | 1.78 | no | scale 1.50×, display 1200×720, side margins 40px each, `H=480` |
| Desktop 1000×800 | 1.25 | no | scale 1.25×, display 1000×600, bottom margin 200px, `H=480` |
| 4K 3840×2160 | 1.78 | no | scale 4.5×, display 3600×2160, side margins 120px each, `H=480` — chunky 144px tiles, intentional |
| Ultrawide 3440×1440 | 2.39 | **yes** | scale 4.3×, display 3440×1440, `H≈335`, **pan vertically** |
| Phone landscape 844×390 | 2.16 | **yes** | scale 1.055×, display 844×390, `H≈370`, **pan vertically**, buttons overlay |
| Phone portrait 390×844 | 0.46 | no | scale 0.49×, display 390×234, top/bottom margin ~305px each, `H=480`, buttons in margin |
| Tablet landscape 1194×834 | 1.43 | no | scale 1.49×, display 1194×716, bottom margin 118px, `H=480` |
| Tablet portrait 768×1024 | 0.75 | no | scale 0.96×, display 768×461, bottom margin 563px, `H=480` |
| iPhone SE landscape 667×375 | 1.78 | no | scale 0.78×, display 625×375, side margins 21px each, `H=480` |

**Rationale for the threshold:** most desktop and tablet viewports have aspect ratios close to the game (16:9, 16:10, 3:2, 4:3). Keeping them in the "fit fully" branch preserves the current desktop experience (see the whole level height at once) while letting genuinely wide viewports (phone landscape, ultrawide monitors) pan for horizontal fill. This addresses the concern raised during brainstorming that "vertical pan on desktop is new behavior and probably unwanted."

### 2. Hysteresis on Mode Switch

When a user drags a browser window across the threshold, the display mode should not oscillate. Implement a small deadband:

```
if currently margin mode and viewport_aspect > game_aspect × (PAN_THRESHOLD + 0.05):
    switch to canvas mode
if currently canvas mode and viewport_aspect < game_aspect × (PAN_THRESHOLD - 0.05):
    switch to margin mode
```

`0.05` produces a ~6% deadband — enough to prevent flicker, invisible to anyone not actively testing it. On initial page load (no prior state), evaluate against the bare threshold.

### 3. Layout Module — New `layout.js` Section in `game.js`

Replaces `resizeCanvas()`. Lives in the SETUP section. Exposes a single entry point and writes both JS globals and CSS custom properties.

**API:**

```js
const layout = {
  scale: 1,           // display scale factor
  H_logical: 480,     // canvas internal height (W_logical always = 800)
  display: { w: 0, h: 0, x: 0, y: 0 },  // canvas pixel size and offset in viewport
  margin: { top: 0, bottom: 0, left: 0, right: 0 },
  overlayMode: 'margin',  // 'margin' or 'canvas'
  recompute() { ... },
};
```

**`recompute()` responsibilities (single function, ~80 LOC):**

1. Read `window.visualViewport` dimensions (fall back to `innerWidth`/`innerHeight`).
2. Apply the unified rule + hysteresis to determine `scale`, `H_logical`, `display.*`, `margin.*`, `overlayMode`.
3. Mutate the global `W` (always 800) and `H` (`H_logical`).
4. Set `canvas.width = W; canvas.height = H;` (logical pixel dimensions, triggers Canvas 2D buffer allocation).
5. Set `canvas.style.width` and `canvas.style.height` (display dimensions, CSS scaling).
6. Write CSS custom properties to `document.documentElement.style`:
   - `--game-scale`
   - `--game-display-width`, `--game-display-height`
   - `--game-offset-x`, `--game-offset-y`
   - `--margin-top`, `--margin-bottom`, `--margin-left`, `--margin-right`
   - `--overlay-mode` (value: `margin` or `canvas`)

**Invocation:**
- Once at boot, before the render loop starts.
- On `window.resize` event.
- On `window.visualViewport.resize` event (handles iOS dynamic toolbars).
- On `orientationchange` event (defensive — resize usually fires anyway).

### 4. CSS Rewrite

`style.css` drops from its current ~210 lines to an estimated ~120 lines. All behavior is driven by the custom properties from the layout module; no more `@media` branching on `orientation` or `hover/pointer`.

**Kept:**
- Base reset (`* { margin: 0; padding: 0; box-sizing: border-box; }`)
- `body` and `canvas` base styling (palette, pixelated rendering, border)
- Touch control base styles (size, shape, font)

**Removed:**
- `@media (hover: none) and (pointer: coarse) and (orientation: landscape)` block (44 lines) — replaced by `--overlay-mode` CSS var
- Duplicate `#touch-controls` rules across media queries
- `!important` overrides on canvas dimensions
- Manual `padding-bottom` on body for touch-device spacing (layout module handles it)

**Added:**
- A single rule group keyed on `[data-overlay-mode="margin"]` vs `[data-overlay-mode="canvas"]` (set via `document.documentElement.dataset.overlayMode` by the layout module each recompute).
- `#touch-controls` positioned via `top: calc(var(--game-offset-y) + var(--game-display-height))` etc., so controls attach to the canvas rect, not the viewport corners.

### 5. Touch Controls

**Visibility rule:** show on any touch-capable device (per user decision: "display touch controls on any touch capable device so you have options"). Replaces the current `(hover: none) and (pointer: coarse)` check with a simpler `window.matchMedia('(any-pointer: coarse)').matches` detection.

**Positioning:**
- **Margin mode:** controls flow into the bottom letterbox margin. D-pad left, action buttons right, centered in the margin strip. Button size scales to fit `var(--margin-bottom)` with a floor.
- **Canvas mode:** controls overlay the canvas corners, positioned using `--game-offset-x/y` so they anchor to the canvas rect. Left cluster bottom-left of canvas, right cluster bottom-right of canvas.

**Transparency (per user decision: "highly see-through"):**
- `background: rgba(10, 25, 10, 0.28)` (today's landscape-only value, now universal)
- `border-color: rgba(58, 180, 58, 0.30)`
- `color: rgba(139, 196, 139, 0.70)`
- `:active` states slightly more opaque for feedback
- Spray button and Jump button keep their distinct accent colors, at the same see-through alpha

**Sizing:** retain `clamp()` pattern, but clamped against canvas display dimensions rather than viewport. Example: `width: clamp(48px, calc(var(--game-display-width) * 0.08), 120px);`

### 6. HUD — DOM Overlay

**Rationale:** Canvas-drawn HUD text scales linearly with the canvas, which on a 4K display renders score text at ~60px physical and on a phone at ~10px physical. DOM overlay lets CSS `clamp()` bound sizes into readable ranges regardless of canvas scale. Also opens a later path to screen-reader accessibility.

**Scope of DOM HUD elements:**
- Score (top-left)
- Lives (top-left, below score)
- Level name / section subtitle (top, center)
- Speed bonus timer (if visible)

**NOT moved to DOM (stay in canvas):**
- Menu screen, GameOver screen, LevelComplete summary, Win screen — these have animated canvas content and are not "HUD" in the overlay sense.
- EnterInitials screen already uses a DOM input field; no change.
- Floating damage/score texts — canvas-native, tied to world coords.

**Implementation:**
- Add a `<div id="hud">` child of `<body>` with absolute-positioned children for each element.
- Position using `top: calc(var(--game-offset-y) + 8px)` etc. so HUD anchors to canvas rect.
- Remove the corresponding HUD `drawScore()` / `drawLives()` / `drawLevelName()` calls from canvas rendering.
- A small `updateHUD(state)` function writes text content each frame.

### 7. Drawing / Game Loop Audits

With `H` variable, most canvas code already works (`updateCamera` at `game.js:854` already clamps using `H`). Audit required in:

- **SCREENS section (`game.js:4311`)** — `drawMenu`, `drawGameOver`, `drawLevelComplete`, `drawWin` use pixel-absolute positions against 800×480. Convert vertically-anchored elements (e.g., "Press Space to Start") from `y = H - 60` (works with variable H) vs. absolute `y = 420` (breaks when H ≠ 480). Audit all `H -` or fixed-y expressions.
- **BOSS ARENA section (`game.js:1054`)** — **requires investigation spike** (see Risks). Boss sub-systems (ground-pound shockwaves, camera shake, phase transitions, hop-slam windup) likely contain pixel-absolute or viewport-relative calculations that assume `H=480`.
- **TRAIL RUNNERS (`game.js:2039`)** — background decoration; likely uses `H`-relative spawn.
- **PARTICLES (`game.js:863`)** — world-space, should be fine.
- **FLOATING TEXT (`game.js:937`)** — world-space, should be fine.

### 8. Input Modality

Per user decision: show touch controls on any touch-capable device (includes hybrids like iPad + Magic Keyboard, Surface Pro, touch-screen laptops). Detection switches from:

```js
matchMedia('(hover: none) and (pointer: coarse)')  // primary-input-is-touch
```

to:

```js
matchMedia('(any-pointer: coarse)')  // device has any touch input
```

The highly-transparent button styling (section 5) means this is low-cost on hybrid devices — the buttons are visible but unobtrusive, and don't visually compete with mouse/keyboard play.

## Data Flow

```
viewport resize
     │
     ▼
window.resize / visualViewport.resize event
     │
     ▼
layout.recompute()
     │
     ├─► mutate global W, H
     ├─► canvas.width, canvas.height (logical)
     ├─► canvas.style.width/height (display)
     ├─► document.documentElement.dataset.overlayMode = "margin" | "canvas"
     └─► document.documentElement.style.setProperty(--game-scale, ...)
            (and siblings)
                  │
                  ▼
    CSS selectors using those vars and attrs re-layout automatically:
      - canvas position
      - touch controls position + size
      - DOM HUD position

game render loop (unchanged rhythm)
     │
     ▼
update() reads W, H (now variable)  ──► camera clamps using H
     │
     ▼
draw() writes to canvas using logical coords (unchanged)
     │
     ▼
updateHUD(state) writes text to DOM HUD elements
```

The layout module is write-only from the render loop's perspective. The render loop never calls into layout; it reads `W`/`H` globals it already reads today.

## Error Handling

Failure modes are bounded:

- **visualViewport unavailable (older browsers):** fall back to `window.innerWidth`/`innerHeight`. Already the current code's fallback pattern.
- **`recompute()` runs before canvas exists:** guarded by one-time boot invocation after DOM ready; resize handler attaches after.
- **Zero or NaN viewport dimensions** (rare, during orientation change on some mobile browsers): clamp to `Math.max(1, vw)` to avoid divide-by-zero in scale calculation; `recompute()` will fire again once real dimensions settle.
- **CSS variables not set yet on first frame:** initial values are declared inline in `<style>` as defaults (`--game-scale: 1; --overlay-mode: margin; ...`) so the page renders sensibly before the first JS recompute.

No new failure modes are introduced.

## Testing

### Playwright Scenarios

Extend `qa/lib/devices.mjs` with new device presets beyond the existing `desktop` / `mobile-portrait` / `mobile-landscape`:

| New preset | Viewport | Purpose |
|---|---|---|
| `desktop-fhd` | 1920×1080 | Common desktop fullscreen |
| `desktop-4k` | 3840×2160 | Extreme scale — verify chunky-tile look intended |
| `desktop-ultrawide` | 3440×1440 | Verify vertical pan branch on wide viewport |
| `tablet-landscape` | 1194×834 | iPad 11" landscape |
| `tablet-portrait` | 768×1024 | iPad mini portrait |
| `mobile-landscape` (existing, unchanged) | 844×390 | Sanity: still plays as today |
| `mobile-portrait` (existing, unchanged) | 393×727 | Sanity: still plays as today |

Add a new scenario `qa/scenarios/responsive-layout.mjs` that:
1. For each device preset, navigate to the game, wait for load.
2. Capture a screenshot.
3. Verify via `getState()` or a new debug helper that expected `overlayMode`, `H_logical`, and `scale` values match the spec table above.
4. Warp to level 1, hold right for 60 frames, verify player advances (smoke-test that gameplay still works).
5. Warp to level 9 (Bigfoot), trigger a ground pound, verify the shockwave hitbox is in the expected place for the altered `H` (regression-catches arena bugs).

### Manual Browser Testing

- Load the game on a 4K desktop display. Verify chunky-tile 4.5× scale, no pan, no controls visible (unless hybrid touch).
- Resize the browser window continuously from 400×300 to fullscreen. Verify no mode-switch flicker, no layout jumps beyond the hysteresis boundary.
- On a phone, play each level once in landscape and check that touch controls remain in the expected overlay position.
- On a phone, rotate portrait ↔ landscape repeatedly. Verify clean transitions.
- Load the game on an iPad with external keyboard. Verify touch controls are visible but unobtrusive; verify keyboard still plays.

### LSP Reference Audit

Use `LSP.findReferences` on `W` and `H` (`game.js:10`) before implementation. Any reference that does not already treat these as potentially variable is a candidate for audit in section 7.

## Migration Plan

Work proceeds in roughly this order. Each phase leaves the game playable.

1. **Phase 1 — Layout module scaffold.** Add `layout.recompute()` alongside the existing `resizeCanvas()`. New module writes CSS vars but existing CSS doesn't yet read them. Verify no regressions (the module is a no-op to the running game).
2. **Phase 2 — Switch CSS over.** Rewrite `style.css` to consume the new CSS vars. Delete all media queries except the touch-capability check. Delete `!important` overrides. Delete `resizeCanvas()`'s logical-size mutation. Verify all existing viewports still work.
3. **Phase 3 — Touch controls re-anchoring.** Reposition touch controls to anchor on canvas rect. Apply universal transparency. Test on mobile landscape + portrait + tablet.
4. **Phase 4 — HUD DOM overlay.** Add HUD divs, move score/lives/level-name drawing from canvas to DOM. Verify no visual regression on desktop; confirm readable at phone scale.
5. **Phase 5 — SCREENS audit.** Make menu/gameover/levelcomplete/win screens tolerant of variable `H`.
6. **Phase 6 — Bigfoot arena spike + fix.** Read BOSS ARENA section, identify pixel-absolute assumptions, fix for variable `H`.
7. **Phase 7 — Playwright coverage.** Add the new device presets and responsive-layout scenario.
8. **Phase 8 — Manual QA + tuning pass.** Playtest every level on desktop, phone landscape, phone portrait. Tune `PAN_THRESHOLD` and hysteresis if any feels off.

## Risks & Open Questions

### Known Risks

1. **Bigfoot arena scope uncertain.** Recent work on the boss (ground-pound shockwaves, hop-slam, camera shake, phase transitions) adds unknown pixel-absolute logic. Phase 6 should start with a code-read spike before committing to its effort estimate. **Worst case: 200–300 LOC changes and requires boss-fight replay QA.**
2. **HUD DOM overlay font rendering differs from canvas.** Players familiar with the current canvas-drawn HUD may notice the font-smoothing or weight changing. Use `font-family: 'Courier New', monospace` and match size visually during Phase 4.
3. **Gameplay difficulty drifts across devices.** On phone landscape (panning view), a player sees less vertical context than on desktop (full view). This already exists in today's broken landscape path; the new model makes it continuous. Flag for playtesting — if it's unacceptable, narrow `PAN_THRESHOLD` so fewer devices pan, at the cost of more letterbox on mobile.
4. **Mode-switch hysteresis during continuous resize on desktop.** Hysteresis prevents flicker but a user dragging their window across the threshold will experience a visible one-shot jump. Acceptable; documented.

### Open Questions

- **Should the EnterInitials screen use the new DOM HUD path, or continue using its current DOM input?** Current impl appears to already be DOM; probably leave alone. Decide during Phase 4.
- **What goes in the desktop letterbox margins — plain black, a decorative border, or HUD?** The HUD is deliberately *not* placed in margins — it anchors to the canvas rect in all modes (see section 6), so a player who resizes their window or rotates their device doesn't see HUD suddenly jump between locations. Margins render as plain background chrome (the existing `#1a1a2e` body color) in this refactor. Decorative borders (wood grain, topo pattern) are a future polish item, not in scope here.
- **4K chunkiness.** The user accepted uncapped scaling ("blocky 8-bit look is intended"). If playtesting reveals this is unpleasant in practice, we can add a `MAX_SCALE` constant cheaply — but ship without it.

## Estimated Cost

- **LOC touched:** 600–900 (stretch to 1000 if Bigfoot arena is worse than expected).
- **Calendar time:** 2–3 focused days.
- **Token spend:** ~500K–800K.
- **Regression risk:** Low on gameplay, moderate on screens/HUD visual details, moderate on Bigfoot arena.

## Out of Scope (for future)

- Decorative border art in desktop letterbox margins.
- Screen-reader accessibility on the DOM HUD.
- Gamepad input.
- `MAX_SCALE` cap on 4K+ monitors.
- Portrait-orientation-specific UI polish (e.g., stacked control layout distinct from landscape).
