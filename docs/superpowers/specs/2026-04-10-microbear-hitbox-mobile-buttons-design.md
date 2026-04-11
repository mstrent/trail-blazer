# Microbear Hitbox & Mobile Action Button Size — Design

**Issues:** #81 (microbear hitbox too small), #80 (mobile landscape action buttons too small)

**Date:** 2026-04-10

---

## Issue #81 — Microbear Hitbox

### Problem

The Micro Bear (`type: 'mouse'`) has a hitbox of `w: 16, h: 12` — the smallest of any enemy. The stomp condition is:

```js
const stomping = prevVy > 0 && player.y + player.h < e.y + e.h * 0.75;
```

This gives a stomp zone of only 9px tall × 16px wide. Because the Micro Bear also moves at `vx: 1.8` (fastest ground enemy), players frequently land next to it rather than on top, triggering unexpected damage instead of a stomp.

### Design

Enlarge the hitbox in `makeMouse`:

| Field | Before | After |
|-------|--------|-------|
| `w`   | 16     | 22    |
| `h`   | 12     | 18    |

**Why this works without changing the drawing:** `drawMouse` anchors from `(sx + e.w/2, sy + e.h)` — the bottom-center of the hitbox. All body/head/ear coordinates are offsets from there, so they remain visually correct at any hitbox size. The visual occupies approximately the bottom 12px of the new 18px hitbox, leaving ~6px of clear "landing zone" at the top that counts as a stomp.

**New stomp zone:** 0.75 × 18 = 13.5px from top — compared to 9px before. Width increases from 16 to 22px. No changes to stomp logic, draw code, or other enemy types.

**Spawn y:** `ty * TS + 8` — unchanged. Physics settles the enemy on the ground regardless of initial offset.

### Files

- `game.js` — `makeMouse` factory only (~line 954)

---

## Issue #80 — Mobile Landscape Action Buttons

### Problem

The right-side touch control panel (`#touch-right`) holds three action buttons: SLIDE, SPRAY (top row), and JUMP (full bottom row). The current landscape override sizes these at `clamp(115px, 21vw, 165px)` wide × `clamp(70px, 13vw, 100px)` tall — noticeably smaller and harder to tap reliably than they should be.

### Design

Increase `#touch-right` dimensions in the landscape `@media` block by ~25%:

| Property | Before | After |
|----------|--------|-------|
| `width`  | `clamp(115px, 21vw, 165px)` | `clamp(140px, 26vw, 200px)` |
| `height` | `clamp(70px, 13vw, 100px)`  | `clamp(90px, 17vw, 130px)`  |

At a 390px-wide landscape viewport (e.g., iPhone 14): new width = min(200, 26% × 390) = 101px → hits 140px min. New height = min(130, 17% × 390) = 66px → hits 90px min. On a wider tablet landscape (1024px): width = min(200, 267) = 200px, height = min(130, 174) = 130px.

The buttons fill the panel via `flex: 1` / `align-items: stretch`, so all three scale together automatically. No per-button CSS changes needed.

**Verification:** After coding, take a QA screenshot and evaluate proportionality against the left-side directional buttons.

### Files

- `style.css` — landscape `@media` block, `#touch-right` override (~line 178)
