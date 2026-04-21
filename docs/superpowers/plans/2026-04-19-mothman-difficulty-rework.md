# Mothman Difficulty Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Mothman's difficulty between Thunderbird and Bigfoot, and make the rage-attack windup→strike→recover read as a coherent sequence instead of a teleport.

**Architecture:** Modify only `game.js`. The Mothman boss state machine (lines 1414–1530) gets: a 6-HP / earlier-phase-2 tuning bump; a third attack (eye beam, phase 2 only); a rebuilt charge with a *backward retreat windup* (no diagonal Y-drop); per-attack vulnerability windows. Phase 1 stays orbs-only so the early fight is readable; phase 2 (HP ≤ 3) unlocks both new attacks at once.

**Tech Stack:** Vanilla JS (single-file IIFE in `game.js`), Canvas 2D, no build step. Verification via Playwright scenarios in `qa/scenarios/` plus manual browser playtest.

**Spec:** `docs/superpowers/specs/2026-04-19-mothman-difficulty-rework-design.md`

**Branch:** `issue-98-mothman-difficulty-rework` (already created and contains the spec commit).

**Mothman level index:** 7 (use `game.warpToLevel(7)` in scenarios).

---

## File Map

- **Modify** `game.js`:
  - `makeBossMothman()` at line ~1414 — new fields, HP=6
  - `updateMothman(boss)` at line ~1433 — full state machine rewrite
  - `drawMothman(boss)` at line ~1532 — new draw cases for beam + retreat pose
  - `checkBossPhase(boss)` at line ~2102 — phase-2 threshold change
  - Boss HUD `maxHps` table at line ~4419 — `mothman: 5 → 6`
  - `forceBossAttack()` at line ~5540 — extend to support mothman attacks
- **Create** `qa/scenarios/mothman-attacks.mjs` — verifies new state machine paths

No other files in the repo are touched.

---

### Task 1: Bump HP to 6 and lower phase-2 threshold

**Files:**
- Modify: `game.js:1419` (HP in factory)
- Modify: `game.js:2103` (phase threshold check)
- Modify: `game.js:4419` (HUD maxHps table)

This is a small standalone tuning change. Mothman now takes 6 hits and enters phase 2 at HP ≤ 3 (was ≤ 2).

- [ ] **Step 1: Bump HP in factory**

In `game.js`, find `makeBossMothman()` (around line 1414). Change the `hp:` field:

```javascript
function makeBossMothman() {
  return {
    type: 'mothman',
    x: BOSS_ARENA_W / 2 - 50, y: 410,
    w: 100, h: 120,
    hp: 6,
    phase: 1,
    state: 'hover',
    stateTimer: 90,
    hoverDir: 1,
    hoverSpeed: 1.2,
    orbs: [],
    eyeGlow: 0,
    chargeVx: 0,
    vulnerable: false,
    hitTimer: 0,
  };
}
```

(Only the `hp` value changes; other fields stay as they are. New fields added in later tasks.)

- [ ] **Step 2: Lower the phase-2 threshold**

Find `checkBossPhase(boss)` (around line 2101). Change the mothman branch:

```javascript
function checkBossPhase(boss) {
  if (boss.type === 'mothman') {
    if (boss.hp <= 3 && boss.phase === 1) boss.phase = 2;
  }
  if (boss.type === 'bigfoot') {
    if (boss.hp <= 5 && boss.phase === 1) boss.phase = 2;
    if (boss.hp <= 2 && boss.phase === 2) {
      boss.phase = 3;
      boss.rageTimer = 90;
    }
  }
}
```

- [ ] **Step 3: Update boss HUD max-HP table**

Find the `maxHps` table (around line 4419). Change the mothman value:

```javascript
const maxHps     = { thunderbird: 3,             mothman: 6,                   bigfoot: 8 };
```

- [ ] **Step 4: Verify in browser**

Start a local server: `python -m http.server 3000`. Open `http://localhost:3000?debug=1`. In DevTools console: `trailBlazerDebug.warpToLevel(7)`. Confirm:
- The boss HUD now shows 6 pips (not 5).
- Hitting the boss 4 times keeps it in phase 1 (no charge attack); the 4th hit drops HP to 2 — wait, with 6 HP the phase-2 trigger is at HP ≤ 3, so 3 hits enters phase 2. Confirm the boss HP bar reflects 6 → 5 → 4 → 3 (now phase 2).

Note: with the unchanged state machine, in phase 2 the boss still has the existing 50% charge chance. Eye beam doesn't exist yet. That comes in Task 4.

- [ ] **Step 5: Commit**

```bash
git add game.js
git commit -m "$(cat <<'EOF'
feat(#98): bump mothman HP to 6, phase 2 at HP ≤ 3

First step of the difficulty rework. Three more hits to defeat,
phase 2 triggers earlier so the new attacks (added in later
commits) become accessible across more of the fight.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Tighten orb-spread vulnerability window and bump orb speed

**Files:**
- Modify: `game.js:1458–1480` (the `fire` and `freeze` state branches in `updateMothman`)

Per spec: orb speed becomes 5 (phase 1) / 6 (phase 2), and the `freeze` window after firing drops to 22 frames (was 30 / 20). Same shape, just sharper — and consistent regardless of phase since vulnerability windows are now attack-specific, not phase-specific.

- [ ] **Step 1: Update fire branch (orb speed)**

In `updateMothman`, find the `fire` branch (the `else if (boss.state === 'fire')` block, around line 1458). Update the orb speed:

```javascript
  } else if (boss.state === 'fire') {
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      const px = player.x + player.w / 2;
      const py = player.y + player.h / 2;
      const bx = boss.x + boss.w / 2;
      const by = boss.y + boss.h / 2;
      for (let i = -1; i <= 1; i++) {
        const spread = i * 80;
        const tx = px + spread;
        const ty = py;
        const dist = Math.hypot(tx - bx, ty - by) || 1;
        const speed = boss.phase === 2 ? 6 : 5;
        boss.orbs.push({
          x: bx, y: by,
          vx: (tx - bx) / dist * speed,
          vy: (ty - by) / dist * speed,
        });
      }
      audio.sfxStun();
      boss.state = 'freeze';
      boss.stateTimer = 22;
    }
  }
```

Two changes: orb `speed` line is now `boss.phase === 2 ? 6 : 5` (was `5 : 4`), and the `freeze` timer is `22` regardless of phase (was `boss.phase === 2 ? 20 : 30`).

- [ ] **Step 2: Verify orbs feel faster but the boss is briefly vulnerable**

Reload `http://localhost:3000?debug=1`, warp to mothman: `trailBlazerDebug.warpToLevel(7)`. Spend a minute observing:
- Orbs move noticeably faster than before.
- After each volley, the boss is open for ~0.36s (22 frames at 60fps) — feels short but landable with a well-timed jump-spray.

- [ ] **Step 3: Commit**

```bash
git add game.js
git commit -m "$(cat <<'EOF'
feat(#98): tighten mothman orb-volley window, bump orb speed

Orb speed: phase 1 4→5, phase 2 5→6. Freeze window after firing
flattens to 22 frames in both phases (was 30/20). Vulnerability
is now attack-specific rather than phase-tuned — keeps the
read consistent and the punish window precise.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Rebuild charge with retreat windup and consistent Y

**Files:**
- Modify: `game.js:1414–1431` (factory — add `chargeDir`, `chargeRetreatPx`, `chargeAnchorY`)
- Modify: `game.js:1495–1521` (the `chargeWind`, `charge`, `stall` branches)

This task fixes the "teleport" feel. During `chargeWind`, the boss now physically retreats backward (opposite the eventual charge direction) over 30 frames. The charge then launches forward from the retreated position at the boss's *windup Y* — no diagonal drop to ground level. The `stall` shrinks to 18 frames.

Important: this task does NOT change *when* the charge becomes available. With the current freeze-branch logic still in place, the charge fires in phase 2 with 50% chance after orbs (Task 5 will rewrite that branching).

- [ ] **Step 1: Add factory fields**

In `makeBossMothman()` (line ~1414), add three new fields:

```javascript
function makeBossMothman() {
  return {
    type: 'mothman',
    x: BOSS_ARENA_W / 2 - 50, y: 410,
    w: 100, h: 120,
    hp: 6,
    phase: 1,
    state: 'hover',
    stateTimer: 90,
    hoverDir: 1,
    hoverSpeed: 1.2,
    orbs: [],
    eyeGlow: 0,
    chargeVx: 0,
    chargeDir: 0,
    chargeRetreatPx: 0,
    chargeAnchorY: 410,
    vulnerable: false,
    hitTimer: 0,
  };
}
```

- [ ] **Step 2: Rewrite chargeWind to retreat backward**

In `updateMothman`, find the `chargeWind` branch (around line 1495). Replace its body. The boss now decides direction at the start of windup, anchors its Y, and physically retreats while the eyes glow:

```javascript
  } else if (boss.state === 'chargeWind') {
    if (boss.stateTimer === 30) {
      boss.chargeDir = player.x + player.w / 2 < boss.x + boss.w / 2 ? -1 : 1;
      boss.chargeAnchorY = boss.y;
      boss.chargeRetreatPx = 0;
    }
    boss.eyeGlow = Math.min(1, boss.eyeGlow + 1 / 30);
    const stepBack = 80 / 30;
    const minX = 60;
    const maxX = BOSS_ARENA_W - boss.w - 60;
    const desiredX = boss.x - boss.chargeDir * stepBack;
    boss.x = Math.max(minX, Math.min(maxX, desiredX));
    boss.chargeRetreatPx += stepBack;
    boss.y = boss.chargeAnchorY;
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      boss.chargeVx = boss.chargeDir * 14;
      boss.state = 'charge';
      boss.stateTimer = 50;
    }
  }
```

Notes:
- The `boss.stateTimer === 30` guard runs the init exactly once per windup. The state machine sets `boss.stateTimer = 30` when entering `chargeWind` (we will update the entry site in Task 5; for now Task 5 also fixes the existing entry that uses `35`).
- The retreat is clamped at `60..BOSS_ARENA_W - boss.w - 60` so the boss can never push out of bounds. `chargeRetreatPx` accumulates the *intended* retreat distance for downstream telemetry/draw use, even if the visible retreat was clamped.
- `boss.y = boss.chargeAnchorY` keeps Y locked to where the windup started.

- [ ] **Step 3: Update charge branch — no Y-drop**

Replace the `charge` branch (around line 1504). Y stays at the anchor; only X moves:

```javascript
  } else if (boss.state === 'charge') {
    boss.x += boss.chargeVx;
    boss.y = boss.chargeAnchorY;

    if (player.hurtTimer === 0 && aabb(player, boss)) {
      hurtPlayer();
    }

    boss.stateTimer--;
    if (boss.stateTimer <= 0 || boss.x < -boss.w || boss.x > BOSS_ARENA_W) {
      boss.chargeVx = 0;
      boss.x = Math.max(100, Math.min(BOSS_ARENA_W - boss.w - 100, boss.x));
      boss.eyeGlow = 0;
      boss.vulnerable = true;
      boss.state = 'stall';
      boss.stateTimer = 18;
    }
  }
```

Two changes from the existing branch: the `targetY = BOSS_GROUND_Y - boss.h - 10` block is gone (replaced by `boss.y = boss.chargeAnchorY`), and the `stall` timer is now `18` (was `25`).

- [ ] **Step 4: Update chargeWind entry timer (transitional)**

The existing freeze-branch logic enters `chargeWind` with `stateTimer = 35`. We need to bump that to `30` so our new `chargeWind` init guard fires correctly. Find the `freeze` branch (around line 1481) and change the line `boss.stateTimer = 35;` → `boss.stateTimer = 30;`. The full branch should now read:

```javascript
  } else if (boss.state === 'freeze') {
    boss.vulnerable = true;
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      boss.vulnerable = false;
      if (boss.phase === 2 && Math.random() < 0.5) {
        boss.eyeGlow = 0;
        boss.state = 'chargeWind';
        boss.stateTimer = 30;
      } else {
        boss.state = 'hover';
        boss.stateTimer = 60 + (Math.random() * 30 | 0);
      }
    }
  }
```

(This whole branch is rewritten in Task 5; this is a transitional fix to keep the game playable in the meantime.)

- [ ] **Step 5: Verify the charge feels coherent**

Reload, `trailBlazerDebug.warpToLevel(7)`. Damage Mothman to phase 2 (3 hits), then watch for a charge. Confirm:
- During the windup: boss visibly drifts *backward* (away from where it will charge to) with eyes glowing.
- During the charge: boss flies horizontally at the same height it had during the windup — no sudden drop to ground level.
- After the charge: boss freezes mid-arena for ~0.3s (18 frames), vulnerable.
- Boss then resumes hover from the post-charge position naturally (no snap).

- [ ] **Step 6: Commit**

```bash
git add game.js
git commit -m "$(cat <<'EOF'
feat(#98): rebuild mothman charge windup with retreat anticipation

Replaces the motionless 35-frame eye-glow windup with a 30-frame
retreat: the boss physically pulls back ~80px in the direction
opposite the eventual charge, creating a coiled-spring telegraph.
Charge launches from the retreated position at the boss's anchored
Y — no diagonal drop to ground level. Stall after charge tightens
to 18 frames.

Eliminates the "teleport with a glitch" read.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Add eye-beam attack (states, fields, update logic)

**Files:**
- Modify: `game.js:1414–1431` (factory — add `beamY`, `beamProgress`)
- Modify: `game.js:1433–1530` (`updateMothman` — three new state branches)
- Modify: `game.js:1532–1608` (`drawMothman` — telegraph line + beam ribbon)

The eye beam is a phase-2 attack with three sub-states: `beamWind` (30 frames, telegraph) → `beam` (40 frames, active hitbox) → `beamRecover` (28 frames, vulnerable). This task adds the *machinery* — Task 5 wires it into the attack-selection logic.

- [ ] **Step 1: Add factory fields for beam tracking**

Update `makeBossMothman()` (the version from Task 3) to include `beamY` and `beamProgress`:

```javascript
function makeBossMothman() {
  return {
    type: 'mothman',
    x: BOSS_ARENA_W / 2 - 50, y: 410,
    w: 100, h: 120,
    hp: 6,
    phase: 1,
    state: 'hover',
    stateTimer: 90,
    hoverDir: 1,
    hoverSpeed: 1.2,
    orbs: [],
    eyeGlow: 0,
    chargeVx: 0,
    chargeDir: 0,
    chargeRetreatPx: 0,
    chargeAnchorY: 410,
    beamY: BOSS_GROUND_Y - 16,
    beamProgress: 0,
    vulnerable: false,
    hitTimer: 0,
  };
}
```

`beamY` is the *visual center* of the beam (warning line and beam ribbon both render here). The hitbox extends 8 px above and 8 px below this center.

- [ ] **Step 2: Update the comment listing valid states**

Find the comment in the factory area or at the top of `updateMothman` listing valid states. Update it to reflect the new states:

```javascript
    state: 'hover',  // hover | fire | freeze | chargeWind | charge | stall | beamWind | beam | beamRecover
```

- [ ] **Step 3: Add beamWind / beam / beamRecover branches**

In `updateMothman`, append three new state branches at the end of the existing if/else chain, after the `stall` branch:

```javascript
  } else if (boss.state === 'beamWind') {
    boss.eyeGlow = Math.min(1, boss.eyeGlow + 1 / 30);
    boss.y = 410 + Math.sin(game.tick * 0.03) * 25;
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      boss.state = 'beam';
      boss.stateTimer = 40;
      boss.beamProgress = 0;
      audio.sfxSpray();
    }
  } else if (boss.state === 'beam') {
    boss.beamProgress = Math.min(1, boss.beamProgress + 1 / 40);
    boss.y = 410 + Math.sin(game.tick * 0.03) * 25;
    if (player.hurtTimer === 0) {
      const beamHit = { x: 0, y: boss.beamY - 8, w: BOSS_ARENA_W, h: 16 };
      if (aabb(player, beamHit)) hurtPlayer();
    }
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      boss.state = 'beamRecover';
      boss.stateTimer = 28;
      boss.vulnerable = true;
      boss.eyeGlow = 0;
    }
  } else if (boss.state === 'beamRecover') {
    boss.y = 410 + Math.sin(game.tick * 0.03) * 25;
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      boss.vulnerable = false;
      boss.state = 'hover';
      boss.stateTimer = 50;
    }
  }
```

Notes:
- Boss continues its hover bob during the beam (fixed Y would feel rigid; bobbing 25 px doesn't shift the beam meaningfully because `beamY` is anchored to ground, not to the boss).
- The beam hitbox spans the *entire* arena width — there's no escape by running to the side.
- `audio.sfxSpray()` is reused for the beam-fire moment; if it sounds wrong in playtest, swap to `sfxStun()` or add a dedicated SFX in a follow-up.

- [ ] **Step 4: Add telegraph + beam visuals to drawMothman**

In `drawMothman` (around line 1532), insert beam visuals **before** the `ctx.save(); ctx.translate(bx, by);` block (so they render in arena-space, not boss-local-space). Specifically, add this block right after the orb-drawing loop and `ctx.shadowBlur = 0;`:

```javascript
  if (boss.state === 'beamWind' || boss.state === 'beam') {
    const beamScreenY = boss.beamY - cam.y;
    if (boss.state === 'beamWind') {
      ctx.strokeStyle = `rgba(255,40,40,${0.3 + boss.eyeGlow * 0.5})`;
      ctx.lineWidth = 1 + boss.eyeGlow * 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(-cam.x, beamScreenY);
      ctx.lineTo(BOSS_ARENA_W - cam.x, beamScreenY);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = 'rgba(255,40,40,0.85)';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 16;
      ctx.fillRect(-cam.x, beamScreenY - 8, BOSS_ARENA_W, 16);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(-cam.x, beamScreenY - 2, BOSS_ARENA_W, 4);
    }
  }
```

The telegraph dashes ramp brightness/thickness with `eyeGlow`. The active beam is a glowing red strip with a hot white core.

- [ ] **Step 5: Verify state machine works in isolation**

Reload, warp to mothman (`trailBlazerDebug.warpToLevel(7)`). The beam isn't selected by the AI yet (Task 5), but you can force it from the console:

```javascript
trailBlazerDebug.pokeBoss({ state: 'beamWind', stateTimer: 30 });
```

Watch for: dashed warning line at low height → solid red beam for ~0.66s → boss visibly recovering for ~0.47s. Walk into the beam to confirm it damages you. Stand still and try to stomp the boss — confirm it's vulnerable in `beamRecover` only.

- [ ] **Step 6: Commit**

```bash
git add game.js
git commit -m "$(cat <<'EOF'
feat(#98): add mothman eye-beam attack (states + visuals)

New three-state attack: beamWind (30f telegraph with brightening
warning line) → beam (40f horizontal strip across full arena at
ankle height, jumpable) → beamRecover (28f vulnerable). Visual
center anchored to BOSS_GROUND_Y-16 so the beam reads at the
player's feet height.

Wiring into the attack-selection roll lands in the next commit.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Wire phase-2 attack roster (orbs/beam/charge weighted roll) and reduce hover

**Files:**
- Modify: `game.js` `freeze` branch in `updateMothman` (around line 1481, the version from Task 3)
- Modify: `game.js` `hover` branch in `updateMothman` (around line 1448, hover-time tuning)

This task replaces the binary 50/50 freeze→(hover|chargeWind) roll with a three-way 40/35/25 weighted roll over orbs/beam/charge in phase 2. Phase 1 keeps the simple freeze→hover loop. Phase 2 also reduces the hover-between-attacks duration.

- [ ] **Step 1: Replace the freeze branch with weighted phase-2 routing**

Replace the entire `freeze` branch you edited in Task 3 with the new routing:

```javascript
  } else if (boss.state === 'freeze') {
    boss.vulnerable = true;
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      boss.vulnerable = false;
      if (boss.phase === 2) {
        const roll = Math.random();
        if (roll < 0.35) {
          boss.eyeGlow = 0;
          boss.state = 'beamWind';
          boss.stateTimer = 30;
        } else if (roll < 0.60) {
          boss.eyeGlow = 0;
          boss.state = 'chargeWind';
          boss.stateTimer = 30;
        } else {
          boss.state = 'hover';
          boss.stateTimer = 35 + (Math.random() * 20 | 0);
        }
      } else {
        boss.state = 'hover';
        boss.stateTimer = 60 + (Math.random() * 30 | 0);
      }
    }
  }
```

Weight breakdown (after the freeze):
- `roll < 0.35` → eye beam (35%)
- `0.35 ≤ roll < 0.60` → charge (25%)
- `roll ≥ 0.60` → return to hover, then loop back to orbs (40%)

Phase 1: always returns to hover (orbs every cycle).

Hover-time after the no-attack branch: phase 1 keeps 60–89 frames; phase 2 uses 35–54 frames (faster pacing).

- [ ] **Step 2: Reduce post-attack hover for phase 2 in the other return points**

Two other places in `updateMothman` set `boss.stateTimer` when returning to hover from a different state:
- The `stall` branch (after a charge)
- The `beamRecover` branch (after a beam)

Both currently use a fixed `50` frames. Make them phase-aware to maintain the faster phase-2 pacing:

In the `stall` branch (around the version from Task 3):

```javascript
  } else if (boss.state === 'stall') {
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      boss.vulnerable = false;
      boss.state = 'hover';
      boss.stateTimer = boss.phase === 2 ? 35 : 50;
    }
  }
```

In the `beamRecover` branch (added in Task 4):

```javascript
  } else if (boss.state === 'beamRecover') {
    boss.y = 410 + Math.sin(game.tick * 0.03) * 25;
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      boss.vulnerable = false;
      boss.state = 'hover';
      boss.stateTimer = boss.phase === 2 ? 35 : 50;
    }
  }
```

(Beam can only fire in phase 2, so the `: 50` branch is currently dead code — kept defensively in case future tuning unlocks beam earlier.)

- [ ] **Step 3: Verify the full attack roster fires in phase 2**

Reload, warp to mothman, deal 3 hits to enter phase 2. Watch for ~30 seconds and confirm all three attacks fire across the rotation:
- Orb spread (currently the most frequent at 40%).
- Eye beam (warning line → red strip → recover, ~35% of the time).
- Charge (retreat windup → horizontal dash → stall, ~25%).

Hover phases between attacks should feel noticeably tighter than phase 1 — the boss should rarely sit still for more than ~1 second.

- [ ] **Step 4: Commit**

```bash
git add game.js
git commit -m "$(cat <<'EOF'
feat(#98): wire mothman phase-2 attack roster (orbs/beam/charge)

Replaces the binary 50/50 freeze→(hover|charge) branch with a
weighted three-way roll: 40% return-to-orbs / 35% eye beam /
25% charge. Phase 1 stays orbs-only for readability. Phase 2
also tightens hover between attacks to 35–54 frames (was 60–89)
across all return-to-hover paths.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Add `forceBossAttack` mothman support and write a verification scenario

**Files:**
- Modify: `game.js:5540` (`forceBossAttack` debug API)
- Create: `qa/scenarios/mothman-attacks.mjs`

This task adds two things: a debug hook that lets scenarios force a specific Mothman attack, and a Playwright scenario that exercises every new state path. We need the debug hook because Mothman's attack selection is RNG-driven; without forcing, scenarios are flaky.

- [ ] **Step 1: Extend forceBossAttack to accept mothman attacks**

Find `forceBossAttack(attackName)` around line 5540. Replace its body to support mothman:

```javascript
  forceBossAttack(attackName) {
    if (!bossArena || !bossArena.boss) return false;
    const boss = bossArena.boss;
    if (boss.type === 'bigfoot') {
      const valid = ['leap', 'groundpound', 'groundpound-dual', 'boulders'];
      if (!valid.includes(attackName)) return false;
      boss.forcedNextAttack = attackName;
      return true;
    }
    if (boss.type === 'mothman') {
      if (attackName === 'beam') {
        boss.eyeGlow = 0;
        boss.state = 'beamWind';
        boss.stateTimer = 30;
        return true;
      }
      if (attackName === 'charge') {
        boss.eyeGlow = 0;
        boss.state = 'chargeWind';
        boss.stateTimer = 30;
        return true;
      }
      if (attackName === 'orbs') {
        boss.state = 'fire';
        boss.stateTimer = 20;
        return true;
      }
    }
    return false;
  },
```

For mothman, the hook directly sets the state (no `forcedNextAttack` field needed since attack selection happens at branch points, not at the start of a fresh "land" cycle like Bigfoot). This makes scenarios deterministic.

- [ ] **Step 2: Extend getBossState to surface mothman fields**

Find `getBossState()` around line 5547. Add mothman-specific fields to the return object:

```javascript
  getBossState() {
    if (!bossArena || !bossArena.boss) return null;
    const b = bossArena.boss;
    return {
      type: b.type,
      state: b.state,
      phase: b.phase,
      hp: b.hp,
      x: b.x, y: b.y,
      poundSubPhase: b.poundSubPhase ?? null,
      poundProgress: b.poundProgress ?? null,
      poundIsDual: b.poundIsDual ?? false,
      shockwaves: (b.shockwaves || []).map(sw => ({
        x: sw.x, dir: sw.dir, speed: sw.speed, active: sw.active,
      })),
      chargeDir: b.chargeDir ?? 0,
      chargeRetreatPx: b.chargeRetreatPx ?? 0,
      beamProgress: b.beamProgress ?? 0,
    };
  },
```

- [ ] **Step 3: Write the scenario**

Create `qa/scenarios/mothman-attacks.mjs`:

```javascript
function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }

export default async function scenario(game) {
  await game.warpToLevel(7);

  let boss = null;
  for (let i = 0; i < 60; i++) {
    await game.waitFrames(1);
    boss = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (boss !== null) break;
  }
  if (!boss) throw new Error('Mothman never initialized');
  assert(boss.type === 'mothman', `expected mothman, got ${boss.type}`);
  assert(boss.hp === 6, `expected 6 HP, got ${boss.hp}`);

  await game.page.evaluate(() => window.trailBlazerDebug.pokeBoss({ phase: 2, hp: 3 }));

  await game.page.evaluate(() => window.trailBlazerDebug.forceBossAttack('charge'));
  let beforeX = null;
  let sawRetreat = false;
  for (let i = 0; i < 35; i++) {
    await game.waitFrames(1);
    const s = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (!s) continue;
    if (s.state !== 'chargeWind') break;
    if (beforeX === null) beforeX = s.x;
    if (Math.abs(s.x - beforeX) > 20) sawRetreat = true;
  }
  assert(sawRetreat, 'boss did not retreat during chargeWind');

  let chargeY = null;
  for (let i = 0; i < 60; i++) {
    await game.waitFrames(1);
    const s = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (!s) continue;
    if (s.state === 'charge') {
      if (chargeY === null) chargeY = s.y;
      else assert(Math.abs(s.y - chargeY) < 5, `charge Y drifted: ${chargeY} → ${s.y}`);
    }
    if (s.state === 'stall') break;
  }
  assert(chargeY !== null, 'boss never entered charge state');

  for (let i = 0; i < 60; i++) {
    await game.waitFrames(1);
    const s = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (s && s.state === 'hover') break;
  }

  await game.page.evaluate(() => window.trailBlazerDebug.forceBossAttack('beam'));
  let sawBeamWind = false, sawBeam = false, sawBeamRecover = false;
  for (let i = 0; i < 110; i++) {
    await game.waitFrames(1);
    const s = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (!s) continue;
    if (s.state === 'beamWind') sawBeamWind = true;
    if (s.state === 'beam') sawBeam = true;
    if (s.state === 'beamRecover') sawBeamRecover = true;
    if (s.state === 'hover' && sawBeamRecover) break;
  }
  assert(sawBeamWind, 'beamWind never observed');
  assert(sawBeam, 'beam never observed');
  assert(sawBeamRecover, 'beamRecover never observed');
}
```

- [ ] **Step 4: Run the scenario**

Server must be running: `python -m http.server 3000`. In another shell:

```bash
cd qa
node runner.mjs scenarios/mothman-attacks.mjs
```

Expected output: scenario runs to completion with no assertion errors. Each assertion verifies a distinct property (HP=6, retreat motion happened, charge Y stayed flat, all three beam sub-states observed).

If the runner reports `boss did not retreat during chargeWind`, double-check Task 3 step 2 — the retreat clamp may be eating the motion if Mothman starts mid-arena (debug: log `s.x` each frame).

- [ ] **Step 5: Commit**

```bash
git add game.js qa/scenarios/mothman-attacks.mjs
git commit -m "$(cat <<'EOF'
test(#98): playwright scenario for mothman new attacks

Adds forceBossAttack support for mothman ('orbs', 'charge', 'beam')
and getBossState extensions for chargeDir / chargeRetreatPx /
beamProgress. New scenario verifies HP=6, retreat motion during
chargeWind, charge Y stays flat (no diagonal drop), and all three
beam sub-states fire.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Manual playtest pass and PR

**Files:** none modified. This task is verification + handoff.

- [ ] **Step 1: Full-fight playtest, phase 1 only**

Server up, open `http://localhost:3000?debug=1`. `trailBlazerDebug.warpToLevel(7)`. Play a real fight, no debug intervention.

Phase 1 checks (HP 6 → 4):
- Only orbs fire — no beam, no charge.
- Orbs feel quicker than the old build but still readable.
- 22-frame open after each volley feels short but landable.
- After 3 hits, HUD shows 3 pips, phase 2 begins.

- [ ] **Step 2: Full-fight playtest, phase 2 only**

Continue the same fight (or warp back if you died) into phase 2.

Phase 2 checks (HP 3 → 0):
- All three attacks fire over the next ~30 seconds.
- Orb speed bump is noticeable (faster, harder to walk-dodge).
- Eye beam: warning line is unmistakable; jumping over it works.
- Charge: retreat windup reads as a coiled-spring motion; no Y-snap; the dash is faster than you can outrun on foot.
- Hover between attacks is short — boss feels relentless.
- After 3 more hits, boss defeated; victory fanfare plays normally.

- [ ] **Step 3: Compare difficulty against neighbors**

Sanity-check the difficulty curve by playing each boss once back-to-back:

```
trailBlazerDebug.warpToLevel(3)   // Thunderbird
trailBlazerDebug.warpToLevel(7)   // Mothman
trailBlazerDebug.warpToLevel(11)  // Bigfoot
```

Expected feel: Mothman should be noticeably harder than Thunderbird (more HP, more attack types, less generous windows) and noticeably easier than Bigfoot (one fewer attack, one fewer phase, smaller HP pool). If Mothman feels harder than Bigfoot, the phase-2 weights or vulnerability windows need a tuning pass.

- [ ] **Step 4: Run the regression scenarios**

Make sure existing boss scenarios still pass:

```bash
cd qa
node runner.mjs scenarios/bigfoot-dual-wave.mjs
node runner.mjs scenarios/bigfoot-frequency.mjs
node runner.mjs scenarios/bigfoot-ground-pound.mjs
node runner.mjs scenarios/bigfoot-pound-substates.mjs
node runner.mjs scenarios/bigfoot-shockwave-left.mjs
node runner.mjs scenarios/bigfoot-shockwave-refactor.mjs
node runner.mjs scenarios/boss-warp.mjs
node runner.mjs scenarios/mothman-attacks.mjs
```

Expected: every scenario completes without throwing.

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin issue-98-mothman-difficulty-rework
gh pr create --title "Mothman difficulty rework + coherent rage attack (closes #98)" --body "$(cat <<'EOF'
## Summary

- Bumps Mothman to 6 HP with phase 2 starting at HP ≤ 3.
- Adds a third attack: **eye beam** (phase 2 only) — a horizontal beam at ankle height across the full arena, jumpable, with a 30-frame telegraph.
- Rebuilds the **charge** windup as a backward-retreat motion with the boss anchored at its windup Y. Eliminates the "teleport with diagonal drop" feel.
- Per-attack vulnerability windows: orbs 22f / beam 28f / charge 18f.
- Phase 2 hover between attacks reduced to 35–54 frames (was 60–89).

Spec: `docs/superpowers/specs/2026-04-19-mothman-difficulty-rework-design.md`
Plan: `docs/superpowers/plans/2026-04-19-mothman-difficulty-rework.md`

closes #98

## Test plan

- [ ] Phase 1: only orbs fire, 22-frame open after each volley
- [ ] Phase 2: all three attacks fire across ~30s of observation
- [ ] Charge: retreat windup is visible; no Y-drop during dash
- [ ] Eye beam: warning line precedes beam; jumping over clears it
- [ ] Boss HUD shows 6 pips
- [ ] `qa/scenarios/mothman-attacks.mjs` passes
- [ ] All `qa/scenarios/bigfoot-*.mjs` and `boss-warp.mjs` still pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Notes

Spec coverage check (every spec section maps to a task):

| Spec section | Task |
|---|---|
| HP and Phases (6 HP, phase 2 at ≤ 3) | Task 1 |
| Aimed Orb Spread (speed bump, 22f freeze) | Task 2 |
| Eye Beam (3 sub-states, telegraph, hitbox) | Task 4, wired in Task 5 |
| Charge (retreat windup, no Y-snap, 18f stall) | Task 3 |
| Phase 2 pacing bumps (orb speed, hover reduction) | Task 2 (orbs) + Task 5 (hover) |
| State machine summary (40/35/25 routing) | Task 5 |
| Animation cohesion (retreat, consistent Y, natural recovery) | Task 3 + Task 4 visuals |
| HUD `maxHps` table update | Task 1 step 3 |
| Debug `forceBossAttack` for testing | Task 6 |

Type/identifier consistency check:
- `chargeDir`, `chargeRetreatPx`, `chargeAnchorY`, `beamY`, `beamProgress` — defined once in Task 3/4 factory; used by name in update + draw + getBossState in Tasks 3, 4, 5, 6.
- Beam visual center `BOSS_GROUND_Y - 16` and beam hitbox `{ y: beamY - 8, h: 16 }` — consistent (hitbox top at -24, bottom at -8, center at -16).
- State name strings used consistently: `beamWind`, `beam`, `beamRecover`, `chargeWind`, `charge`, `stall`, `hover`, `fire`, `freeze`.
- `boss.stateTimer === 30` guard in `chargeWind` matches the `boss.stateTimer = 30;` set at the entry sites (Tasks 3 step 4 and Task 5 step 1) and in `forceBossAttack` (Task 6 step 1).

No placeholders, no TBDs, no "implement later" steps. Every code-modifying step shows the actual code.
