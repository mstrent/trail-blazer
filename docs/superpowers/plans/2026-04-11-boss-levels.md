# Boss Levels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three cryptid boss arenas (Thunderbird, Mothman, Bigfoot) to Trail Blazer at levels 4, 8, and 12 — breaking from the side-scroll format into a virtual-world dodge-arena with bear-spray combat.

**Architecture:** Three new `LEVELS[]` entries with `isBoss: true` trigger a new `'boss'` game state. `loadLevel()` branches on `isBoss` to call `initBossArena()` instead of the normal map/spawn pipeline. A new `// BOSS ARENA` section in `game.js` contains all boss logic: a virtual 1600×800 world, player physics without tile collision, a projectile bear spray, and three boss state machines. Camera biases player to 80% down the screen so all boss action is visible above.

**Tech Stack:** Vanilla JS, Canvas 2D, no new dependencies. Single file: `game.js`.

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `game.js` | Modify | LEVEL DEFINITIONS: insert 3 boss stubs; GAME STATE: patch `loadLevel`, `advanceLevel`, `warpToLevel`, `hurtPlayer`; New BOSS ARENA section after ENEMIES; DRAWING: `drawBossArena`, `drawBossHUD`; MAIN LOOP: `boss` state dispatch; SCREENS: `drawLevelComplete` boss variant; WIN: skip LNT/TA for boss levels |
| `qa/scenarios/boss-warp.mjs` | Create | Smoke test: warp to boss levels, assert `state === 'boss'`, screenshot |

---

## Task 1: Write QA smoke test for boss levels

**Files:**
- Create: `qa/scenarios/boss-warp.mjs`

- [ ] **Step 1: Create the scenario file**

```js
// qa/scenarios/boss-warp.mjs
function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

export default async function scenario(game) {
  // Boss 1: Thunderbird (level index 3)
  await game.warpToLevel(3);
  await game.waitFrames(10);
  const s1 = await game.getState();
  assert(s1.state === 'boss', `L4 Thunderbird: expected boss, got ${s1.state}`);
  assert(s1.levelNum === 3, `L4: expected levelNum 3, got ${s1.levelNum}`);
  await game.screenshot('boss-thunderbird-initial');
  console.log('Thunderbird boss state OK');

  // Boss 2: Mothman (level index 7)
  await game.warpToLevel(7);
  await game.waitFrames(10);
  const s2 = await game.getState();
  assert(s2.state === 'boss', `L8 Mothman: expected boss, got ${s2.state}`);
  assert(s2.levelNum === 7, `L8: expected levelNum 7, got ${s2.levelNum}`);
  await game.screenshot('boss-mothman-initial');
  console.log('Mothman boss state OK');

  // Boss 3: Bigfoot (level index 11)
  await game.warpToLevel(11);
  await game.waitFrames(10);
  const s3 = await game.getState();
  assert(s3.state === 'boss', `L12 Bigfoot: expected boss, got ${s3.state}`);
  assert(s3.levelNum === 11, `L12: expected levelNum 11, got ${s3.levelNum}`);
  await game.screenshot('boss-bigfoot-initial');
  console.log('Bigfoot boss state OK');

  // Normal level at index 4 (Alpine Lakes) should still be 'playing'
  await game.warpToLevel(4);
  await game.waitFrames(10);
  const s4 = await game.getState();
  assert(s4.state === 'playing', `L5 Alpine Lakes: expected playing, got ${s4.state}`);
  assert(s4.levelNum === 4, `L5: expected levelNum 4, got ${s4.levelNum}`);
  console.log('Normal level after boss OK');

  console.log('Boss warp test PASSED.');
}
```

- [ ] **Step 2: Run test to confirm it fails (boss levels not yet implemented)**

```bash
# From repo root — ensure server is running first:
python -m http.server 3000 &
cd qa
node runner.mjs scenarios/boss-warp.mjs
```

Expected: FAIL — "warpToLevel: invalid level index 3" or the level loads as 'playing'.

---

## Task 2: Insert boss level stubs into LEVELS[]

**Files:**
- Modify: `game.js` — LEVEL DEFINITIONS section (around line 81)

The current 9-entry `LEVELS[]` array must expand to 12. Boss stubs are inserted at indices 3, 7, and 11. All existing levels shift indices accordingly.

- [ ] **Step 1: Insert the Thunderbird stub after the Glacier Peak entry (index 2)**

Find the closing `},` of the Glacier Peak level object (the one with `name: 'Glacier Peak'`). Insert after it:

```js
  // ==================== BOSS 1: THUNDERBIRD ====================
  {
    isBoss: true,
    bossType: 'thunderbird',
    name: 'Thunderbird Encounter',
    subtitle: 'A storm-bringing spirit descends on the North Cascades',
    section: 'Washington \u2014 Cascade Crest',
    campName: 'Thunderbird Banished',
    spawnTile: null,
    goalTile: null,
    goalFlagY: null,
  },
```

- [ ] **Step 2: Insert the Mothman stub after the Bridge of the Gods entry (now at index 6)**

Find the closing `},` of the Bridge of the Gods level (the one with `name: 'Bridge of the Gods'`). Insert after it:

```js
  // ==================== BOSS 2: MOTHMAN ====================
  {
    isBoss: true,
    bossType: 'mothman',
    name: 'Mothman of Shasta',
    subtitle: 'Red eyes glowing in the ancient Oregon dark',
    section: 'Oregon \u2014 Columbia River corridor',
    campName: 'Mothman Dispersed',
    spawnTile: null,
    goalTile: null,
    goalFlagY: null,
  },
```

- [ ] **Step 3: Insert the Bigfoot stub after the Castle Crags entry (now at index 10)**

Find the closing `},` of the Castle Crags level (the one with `name: 'Castle Crags'`). Insert after it:

```js
  // ==================== BOSS 3: BIGFOOT ====================
  {
    isBoss: true,
    bossType: 'bigfoot',
    name: 'Bigfoot',
    subtitle: 'The legend of the PCT emerges from the California shadows',
    section: 'California \u2014 Castle Crags Wilderness',
    campName: 'Bigfoot Bested',
    spawnTile: null,
    goalTile: null,
    goalFlagY: null,
  },
```

- [ ] **Step 4: Update the levelDistances array to match new level indices**

Find this line (around line 1470):

```js
    const levelDistances = [117*32, 132*32, 147*32, 162*32, 172*32, 182*32, 197*32, 207*32, 217*32];
```

Replace with (boss levels get 0 — they never reach this code):

```js
    const levelDistances = [117*32, 132*32, 147*32, 0, 162*32, 172*32, 182*32, 0, 197*32, 207*32, 217*32, 0];
```

- [ ] **Step 5: Commit**

```bash
git add game.js
git commit -m "feat: insert boss level stubs into LEVELS[] for #78"
```

---

## Task 3: Core plumbing — loadLevel, advanceLevel, warpToLevel, hurtPlayer + state dispatch

**Files:**
- Modify: `game.js` — GAME STATE section and MAIN LOOP section

After this task the QA smoke test should pass: warping to a boss level returns `state === 'boss'`.

> **⚠ Ordering note:** Steps 2–5 reference `BOSS_SPAWN_X`, `BOSS_SPAWN_Y`, `bossArena`, and `initBossArena()` which are defined in Task 4. To keep the game runnable between tasks, **complete Task 4 Step 1 before Step 2 of this task** — it inserts the BOSS ARENA constants and stubs that the patches below depend on.

- [ ] **Step 1: Add `boss` state visibility to touch controls and `setTouchControlsVisible`**

Find:

```js
  setTouchControlsVisible(game.state === 'playing');
```

Replace with:

```js
  setTouchControlsVisible(game.state === 'playing' || game.state === 'boss');
```

- [ ] **Step 2: Patch `loadLevel()` to branch on `isBoss`**

Find `function loadLevel(num) {` and replace the entire function:

```js
function loadLevel(num) {
  game.levelNum = num;
  const def = LEVELS[num];
  if (def.isBoss) {
    items = [];
    enemies = [];
    tpBlooms = [];
    fish = [];
    trailRunners = [];
    beerCans = [];
    trashPiles = [];
    particles.length = 0;
    floatTexts.length = 0;
    cam.x = 0;
    cam.y = 0;
    game.levelTimeBonus = 0;
    game.levelCompletionTime = 0;
    game.winScrollY = 0;
    game.levelTick = 0;
    initBossArena(def);  // defined in BOSS ARENA section
    game.state = 'boss';
    return;
  }
  level = def.build();
  spawnItems();
  spawnEnemies();
  spawnTPBlooms();
  spawnFish();
  spawnTrailRunners();
  beerCans = [];
  trashPiles = [];
  particles.length = 0;
  floatTexts.length = 0;
  cam.x = 0;
  cam.y = 0;
  game.levelTimeBonus = 0;
  game.levelCompletionTime = 0;
  game.winScrollY = 0;
}
```

- [ ] **Step 3: Patch `advanceLevel()` to handle boss levels**

Find `function advanceLevel() {` and replace the entire function:

```js
function advanceLevel() {
  const nextNum = game.levelNum + 1;
  if (nextNum >= LEVELS.length) {
    game.state = 'win';
    audio.sfxWinFanfare();
    return;
  }
  const savedScore = player.score;
  const savedLives = player.lives;
  loadLevel(nextNum);          // sets game.state = 'boss' or leaves it for us to set
  player = makePlayer();
  const nextDef = LEVELS[nextNum];
  if (nextDef.isBoss) {
    player.x = BOSS_SPAWN_X;   // defined in BOSS ARENA section
    player.y = BOSS_SPAWN_Y;
  } else {
    const spawn = nextDef.spawnTile;
    player.x = spawn[0] * TS;
    player.y = spawn[1] * TS;
    game.state = 'playing';
    audio.sfxStartJingle();
  }
  player.score = savedScore;
  player.lives = savedLives;
}
```

- [ ] **Step 4: Patch `warpToLevel()` to handle boss levels**

Find `function warpToLevel(n) {` and replace the entire function:

```js
function warpToLevel(n) {
  if (n < 0 || n >= LEVELS.length) {
    console.warn(`warpToLevel: invalid level index ${n} (valid: 0\u2013${LEVELS.length - 1})`);
    return;
  }
  const savedScore = player ? player.score : 0;
  const savedLives = player ? player.lives : 3;
  loadLevel(n);
  player = makePlayer();
  const def = LEVELS[n];
  if (def.isBoss) {
    player.x = BOSS_SPAWN_X;
    player.y = BOSS_SPAWN_Y;
  } else {
    const spawn = def.spawnTile;
    player.x = spawn[0] * TS;
    player.y = spawn[1] * TS;
    game.state = 'playing';
  }
  player.score = savedScore;
  player.lives = savedLives;
  game.levelTick = 0;
}
```

- [ ] **Step 5: Patch `hurtPlayer()` for boss respawn and no-hit tracking**

Find the respawn block inside `hurtPlayer` that reads:

```js
      // Respawn
      const sp = LEVELS[game.levelNum].spawnTile;
      player.x = sp[0] * TS;
      player.y = sp[1] * TS;
      player.vx = 0;
      player.vy = 0;
      player.health = 3;
      player.hurtTimer = 120;
      player.waterDmgTimer = 0;
      cam.x = 0;
```

Replace with:

```js
      // Respawn
      if (LEVELS[game.levelNum].isBoss) {
        player.x = BOSS_SPAWN_X;
        player.y = BOSS_SPAWN_Y;
      } else {
        const sp = LEVELS[game.levelNum].spawnTile;
        player.x = sp[0] * TS;
        player.y = sp[1] * TS;
        cam.x = 0;
      }
      player.vx = 0;
      player.vy = 0;
      player.health = 3;
      player.hurtTimer = 120;
      player.waterDmgTimer = 0;
```

Also, add no-hit tracking at the very top of `hurtPlayer` (after the `if (player.hurtTimer > 0 && !instant) return;` guard):

```js
  if (bossArena) bossArena.noHit = false;
```

- [ ] **Step 6: Add `boss` state dispatch in `update()` and `draw()`**

In `update()`, find the `} else if (game.state === 'levelcomplete') {` block. Insert before it:

```js
  } else if (game.state === 'boss') {
    updateBossArena();  // defined in BOSS ARENA section

```

In `draw()`, find `if (game.state === 'levelcomplete') {` block. Insert before it:

```js
  if (game.state === 'boss') {
    drawBossArena();    // defined in BOSS ARENA section
    return;
  }
```

- [ ] **Step 7: Run QA scenario — it should now pass**

```bash
cd qa
node runner.mjs scenarios/boss-warp.mjs
```

Expected: PASS — all four assertions succeed, 4 screenshots saved to `qa/screenshots/`.

- [ ] **Step 8: Commit**

```bash
git add game.js
git commit -m "feat: wire boss game state, loadLevel/advanceLevel/hurtPlayer branching for #78"
```

---

## Task 4: BOSS ARENA section — infrastructure, player physics, projectile, HUD, draw

Add a new section in `game.js` immediately after `// ==================== ENEMIES ====================` ends (around line 1011, before `// ==================== FISH ====================`).

**Files:**
- Modify: `game.js` — insert new BOSS ARENA section

- [ ] **Step 1: Insert arena constants and `initBossArena`**

```js
// ==================== BOSS ARENA ====================
const BOSS_ARENA_W  = 1600;
const BOSS_ARENA_H  = 800;
const BOSS_GROUND_Y = 720;
const BOSS_SPAWN_X  = BOSS_ARENA_W / 2 - PLAYER_W / 2;
const BOSS_SPAWN_Y  = BOSS_GROUND_Y - PLAYER_H;

let bossArena = null;

function initBossArena(def) {
  bossArena = {
    boss:        makeBoss(def.bossType),
    spray:       null,   // { x, y, vx, vy, active }
    noHit:       true,   // set false by hurtPlayer when bossArena != null
    phase:       'fighting', // 'fighting' | 'defeated'
    defeatTimer: 0,
  };
}

function makeBoss(type) {
  if (type === 'thunderbird') return makeBossThunderbird();
  if (type === 'mothman')     return makeBossMothman();
  if (type === 'bigfoot')     return makeBigfoot();
  throw new Error('Unknown boss type: ' + type);
}
```

- [ ] **Step 2: Insert `updateBossArena` (main update orchestrator)**

```js
function updateBossArena() {
  if (!bossArena) return;
  game.levelTick++;

  if (bossArena.phase === 'fighting') {
    updateBossPlayer();
    updateBossProjectile();
    const type = bossArena.boss.type;
    if (type === 'thunderbird') updateThunderbird(bossArena.boss);
    else if (type === 'mothman') updateMothman(bossArena.boss);
    else if (type === 'bigfoot') updateBigfoot(bossArena.boss);
  } else if (bossArena.phase === 'defeated') {
    bossArena.defeatTimer++;
    if (bossArena.defeatTimer > 120) {
      game.state = 'levelcomplete';
    }
  }

  // Camera: player biased to 80% down viewport for maximum upward visibility
  cam.x = Math.max(0, Math.min(BOSS_ARENA_W - W, player.x + player.w / 2 - W * 0.5));
  cam.y = Math.max(0, Math.min(BOSS_ARENA_H - H, player.y - H * 0.80));

  updateParticles();
  updateFloatTexts();
}
```

- [ ] **Step 3: Insert `updateBossPlayer` (physics without tile collision)**

```js
function updateBossPlayer() {
  if (player.dead) return;
  if (player.hurtTimer > 0) player.hurtTimer--;
  if (player.sprayCooldown > 0) player.sprayCooldown--;
  if (player.sprayTimer > 0) player.sprayTimer--;

  // Horizontal movement
  let dx = 0;
  if (isLeft())  { dx = -MOVE_SPEED; player.facing = -1; }
  if (isRight()) { dx =  MOVE_SPEED; player.facing =  1; }
  player.vx = dx;

  // Walk animation
  if (dx !== 0 && player.onGround) {
    player.frameTimer++;
    if (player.frameTimer > 8) { player.frameTimer = 0; player.frame ^= 1; }
  } else if (player.onGround) {
    player.frame = 0; player.frameTimer = 0;
  }

  // Jump
  if (isJump() && !wasJump()) player.jumpBuffer = 8;
  if (player.jumpBuffer > 0) player.jumpBuffer--;
  if (player.jumpBuffer > 0 && player.onGround) {
    player.jumpBuffer = 0;
    player.vy = JUMP_FORCE;
    player.jumpHeld = true;
    audio.sfxJump();
  }
  if (player.jumpHeld && !isJump()) {
    player.jumpHeld = false;
    if (player.vy < -5) player.vy = -5;
  }

  // Bear spray: fire projectile toward boss
  if (isSpray() && player.sprayCooldown === 0 && bossArena.boss) {
    player.sprayCooldown = 30;
    player.sprayTimer = 20;
    const boss = bossArena.boss;
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    const bx = boss.x + boss.w / 2;
    const by = boss.y + boss.h / 2;
    const dist = Math.hypot(bx - px, by - py) || 1;
    const speed = 14;
    bossArena.spray = {
      x: px, y: py,
      vx: (bx - px) / dist * speed,
      vy: (by - py) / dist * speed,
      active: true,
    };
    spawnParticles(px, player.y + 8, '#ff8800', 12, 4);
  }

  // Gravity
  player.vy = Math.min(player.vy + GRAVITY_FORCE, MAX_FALL);
  player.x += player.vx;
  player.y += player.vy;

  // Ground collision (no tile map — just world floor)
  if (player.y + player.h >= BOSS_GROUND_Y) {
    player.y = BOSS_GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }

  // Arena wall bounds
  player.x = Math.max(0, Math.min(BOSS_ARENA_W - player.w, player.x));
}
```

- [ ] **Step 4: Insert `updateBossProjectile` and `bossDefeated`**

```js
function updateBossProjectile() {
  const spray = bossArena.spray;
  if (!spray || !spray.active) return;

  spray.x += spray.vx;
  spray.y += spray.vy;

  // Expire if out of arena
  if (spray.x < 0 || spray.x > BOSS_ARENA_W ||
      spray.y < 0 || spray.y > BOSS_ARENA_H) {
    spray.active = false;
    return;
  }

  // Hit boss only during vulnerability window
  const boss = bossArena.boss;
  if (boss.vulnerable && boss.hitTimer === 0 &&
      aabb({ x: spray.x - 6, y: spray.y - 6, w: 12, h: 12 }, boss)) {
    spray.active = false;
    boss.hp--;
    boss.hitTimer = 60;
    boss.vulnerable = false;
    spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, '#ff8800', 20, 6);
    audio.sfxStomp();
    if (boss.hp <= 0) {
      bossDefeated();
    } else {
      checkBossPhase(boss);
    }
  }
}

function checkBossPhase(boss) {
  if (boss.type === 'mothman') {
    if (boss.hp <= 2 && boss.phase === 1) boss.phase = 2;
  }
  if (boss.type === 'bigfoot') {
    if (boss.hp <= 5 && boss.phase === 1) boss.phase = 2;
    if (boss.hp <= 2 && boss.phase === 2) {
      boss.phase = 3;
      boss.rageTimer = 90; // freeze boss for roar
    }
  }
}

function bossDefeated() {
  bossArena.phase = 'defeated';
  bossArena.defeatTimer = 0;

  const timeSeconds = Math.floor(game.levelTick / 60);
  const targets = { thunderbird: 30, mothman: 60, bigfoot: 90 };
  const targetTime = targets[bossArena.boss.type] || 60;
  const timeDiff = targetTime - timeSeconds;
  game.levelCompletionTime = game.levelTick;
  game.levelTimeBonus = timeDiff >= 0
    ? Math.min(500, Math.floor(50 * Math.pow(1.04, timeDiff)))
    : Math.floor(timeDiff * 2);
  player.score += game.levelTimeBonus;

  if (bossArena.noHit) {
    player.score += 500;
    game.leaveNoTrace[game.levelNum] = true; // repurposed: no-hit bonus flag
  }

  audio.sfxCampFanfare();
  spawnParticles(
    bossArena.boss.x + bossArena.boss.w / 2,
    bossArena.boss.y + bossArena.boss.h / 2,
    '#FFD700', 40, 8
  );
}
```

- [ ] **Step 5: Insert `drawBossArena` and `drawBossHUD`**

Add these to the DRAWING section (after `drawFloatTexts`, before `// SCREENS`):

```js
function drawBossArena() {
  if (!bossArena) return;
  const boss = bossArena.boss;

  // Arena background — darkening sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0d0d2a');
  grad.addColorStop(1, '#1a0d00');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Ground platform
  const gsy = BOSS_GROUND_Y - cam.y;
  ctx.fillStyle = '#2a1a0a';
  ctx.fillRect(0, gsy, W, H - gsy);
  ctx.fillStyle = '#4a2a10';
  ctx.fillRect(0, gsy, W, 4);

  // Bear spray projectile
  const spray = bossArena.spray;
  if (spray && spray.active) {
    ctx.fillStyle = '#ff8800';
    ctx.shadowColor = '#ff4400';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(spray.x - cam.x, spray.y - cam.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Boss
  if (boss.type === 'thunderbird') drawThunderbird(boss);
  else if (boss.type === 'mothman') drawMothman(boss);
  else if (boss.type === 'bigfoot') drawBigfoot(boss);

  drawPlayer();
  drawParticles();
  drawFloatTexts();
  drawBossHUD();

  // Boss-defeated overlay
  if (bossArena.phase === 'defeated') {
    const alpha = Math.min(0.7, bossArena.defeatTimer / 40);
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, 0, W, H);
    if (bossArena.defeatTimer > 20) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFD700';
      ctx.shadowColor = '#aa6600';
      ctx.shadowBlur = 12;
      ctx.font = 'bold 48px Courier New';
      ctx.fillText('BOSS DEFEATED!', W / 2, H / 2 - 20);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px Courier New';
      ctx.fillText(`Score: ${player.score}`, W / 2, H / 2 + 30);
    }
  }
}

function drawBossHUD() {
  const boss = bossArena.boss;
  const bossNames  = { thunderbird: 'THUNDERBIRD', mothman: 'MOTHMAN OF SHASTA', bigfoot: 'BIGFOOT' };
  const bossColors = { thunderbird: '#4488ff',     mothman: '#ff4444',           bigfoot: '#885533' };
  const maxHps     = { thunderbird: 3,             mothman: 5,                   bigfoot: 8 };

  const color  = bossColors[boss.type];
  const maxHp  = maxHps[boss.type];
  const barW   = W * 0.5;
  const barX   = (W - barW) / 2;
  const barY   = 26;

  // Boss name
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 13px Courier New';
  ctx.fillText(bossNames[boss.type], W / 2, 18);

  // HP bar background
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(barX - 2, barY - 2, barW + 4, 16);

  // HP bar fill
  const hpFrac = Math.max(0, boss.hp / maxHp);
  ctx.fillStyle = '#222';
  ctx.fillRect(barX, barY, barW, 12);
  ctx.fillStyle = hpFrac > 0.5 ? color : hpFrac > 0.25 ? '#ffaa00' : '#ff4444';
  ctx.fillRect(barX, barY, barW * hpFrac, 12);

  // HP segment dividers
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  for (let i = 1; i < maxHp; i++) {
    const segX = barX + (barW / maxHp) * i;
    ctx.beginPath();
    ctx.moveTo(segX, barY);
    ctx.lineTo(segX, barY + 12);
    ctx.stroke();
  }

  // Player lives
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ff4444';
  ctx.font = '16px Courier New';
  ctx.fillText('\u2665'.repeat(Math.max(0, player.lives)), 8, 18);

  // Score
  ctx.textAlign = 'right';
  ctx.fillStyle = '#FFD700';
  ctx.font = '13px Courier New';
  ctx.fillText(player.score.toString(), W - 8, 18);

  // Phase indicator
  if (boss.phase && boss.phase > 1) {
    ctx.fillStyle = '#ff8800';
    ctx.font = 'bold 11px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('PHASE ' + boss.phase, W / 2, 50);
  }

  // No-hit tracking indicator
  if (bossArena.noHit) {
    ctx.fillStyle = 'rgba(255,215,0,0.65)';
    ctx.font = '10px Courier New';
    ctx.textAlign = 'right';
    ctx.fillText('NO HIT +500', W - 8, 32);
  }
}
```

- [ ] **Step 6: Start the server and visually verify the boss arena loads**

```bash
python -m http.server 3000
```

Open `http://localhost:3000?debug=1` in a browser. In DevTools console:
```js
window.trailBlazerDebug.warpToLevel(3)
```

Expected: dark arena background with ground line, player standing at center-bottom, boss HUD visible at top with "THUNDERBIRD" label and HP bar. No boss drawn yet (factory not implemented) — that's OK. Player should be able to move left/right and jump.

- [ ] **Step 7: Commit**

```bash
git add game.js
git commit -m "feat: boss arena infrastructure — state, player physics, camera, HUD for #78"
```

---

## Task 5: Thunderbird boss

**Files:**
- Modify: `game.js` — BOSS ARENA section

- [ ] **Step 1: Insert `makeBossThunderbird`**

In the BOSS ARENA section, after `makeBoss()`:

```js
function makeBossThunderbird() {
  return {
    type: 'thunderbird',
    x: BOSS_ARENA_W / 2 - 60, y: 160,
    w: 120, h: 80,
    hp: 3,
    phase: 1,
    state: 'patrol',  // patrol | telegraph | swoop | retreat
    stateTimer: 90,
    patrolDir: 1,
    patrolSpeed: 1.8,
    swoopStartX: 0, swoopStartY: 0,
    swoopTargetX: 0,
    swoopProgress: 0,
    swoopDuration: 45,
    telegraphTimer: 0,
    retreatTimer: 0,
    retreatStartX: 0, retreatStartY: 0,
    vulnerable: false,
    hitTimer: 0,
  };
}
```

- [ ] **Step 2: Insert `updateThunderbird`**

```js
function updateThunderbird(boss) {
  if (boss.hitTimer > 0) boss.hitTimer--;

  // Difficulty: shorter telegraph and faster swoop at lower HP
  const swoopDur   = boss.hp === 3 ? 45 : boss.hp === 2 ? 33 : 22;
  const tlegraphDur = boss.hp === 3 ? 30 : boss.hp === 2 ? 20 : 12;

  if (boss.state === 'patrol') {
    boss.x += boss.patrolDir * boss.patrolSpeed;
    if (boss.x < 80)                       { boss.x = 80;                    boss.patrolDir =  1; }
    if (boss.x > BOSS_ARENA_W - boss.w - 80) { boss.x = BOSS_ARENA_W - boss.w - 80; boss.patrolDir = -1; }
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      boss.telegraphTimer = tlegraphDur;
      boss.swoopTargetX = Math.max(50, Math.min(BOSS_ARENA_W - boss.w - 50,
        player.x + player.w / 2 - boss.w / 2));
      boss.state = 'telegraph';
    }
  } else if (boss.state === 'telegraph') {
    boss.telegraphTimer--;
    if (boss.telegraphTimer <= 0) {
      boss.swoopStartX  = boss.x;
      boss.swoopStartY  = boss.y;
      boss.swoopProgress = 0;
      boss.swoopDuration = swoopDur;
      boss.state = 'swoop';
    }
  } else if (boss.state === 'swoop') {
    boss.swoopProgress = Math.min(1, boss.swoopProgress + 1 / boss.swoopDuration);
    const t = boss.swoopProgress;
    const ctrlX = (boss.swoopStartX + boss.swoopTargetX) / 2;
    const ctrlY = BOSS_GROUND_Y - 60;
    const endY  = BOSS_GROUND_Y - 110;
    // Quadratic bezier
    boss.x = (1-t)*(1-t)*boss.swoopStartX + 2*(1-t)*t*ctrlX + t*t*boss.swoopTargetX;
    boss.y = (1-t)*(1-t)*boss.swoopStartY + 2*(1-t)*t*ctrlY + t*t*endY;

    // Vulnerable at swoop bottom (t 0.65–0.90)
    boss.vulnerable = t > 0.65 && t < 0.90;

    // Player hurt if inside boss hitbox and not in vulnerability window
    if (!boss.vulnerable && player.hurtTimer === 0 && aabb(player, boss)) {
      hurtPlayer();
    }

    if (boss.swoopProgress >= 1) {
      boss.vulnerable = false;
      boss.retreatTimer   = 30;
      boss.retreatStartX  = boss.x;
      boss.retreatStartY  = boss.y;
      boss.state = 'retreat';
    }
  } else if (boss.state === 'retreat') {
    boss.retreatTimer--;
    const t = 1 - boss.retreatTimer / 30;
    boss.x = boss.retreatStartX + (boss.swoopStartX - boss.retreatStartX) * t;
    boss.y = boss.retreatStartY + (boss.swoopStartY - boss.retreatStartY) * t;
    if (boss.retreatTimer <= 0) {
      boss.x = boss.swoopStartX;
      boss.y = boss.swoopStartY;
      boss.stateTimer = 60 + Math.random() * 30 | 0;
      boss.state = 'patrol';
    }
  }
}
```

- [ ] **Step 3: Insert `drawThunderbird`**

```js
function drawThunderbird(boss) {
  const t  = game.tick;
  const bx = boss.x - cam.x + boss.w / 2;
  const by = boss.y - cam.y + boss.h / 2;
  const wing = Math.sin(t * 0.1) * 18;

  ctx.save();
  ctx.translate(bx, by);

  // Wings
  ctx.fillStyle = '#1a1a4a';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 10, 0);
    ctx.quadraticCurveTo(s * 75, -wing - 20, s * boss.w * 0.9, wing * 0.8);
    ctx.quadraticCurveTo(s * 55, 12, s * 10, 12);
    ctx.fill();
  }

  // Electric blue wing highlights
  ctx.strokeStyle = '#4488ff';
  ctx.lineWidth = 2;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 10, 0);
    ctx.quadraticCurveTo(s * 65, -wing - 15, s * boss.w * 0.85, wing * 0.7);
    ctx.stroke();
  }

  // Body
  ctx.fillStyle = '#2a2a6a';
  ctx.beginPath();
  ctx.ellipse(0, 6, 18, 26, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = '#2a2a6a';
  ctx.beginPath();
  ctx.ellipse(2, -24, 11, 9, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.fillStyle = '#ffaa00';
  ctx.beginPath();
  ctx.moveTo(9, -26);
  ctx.lineTo(22, -22);
  ctx.lineTo(9, -19);
  ctx.fill();

  // Eye
  ctx.fillStyle = '#88ccff';
  ctx.beginPath();
  ctx.arc(5, -26, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(6, -27, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Lightning bolts during telegraph/swoop
  if (boss.state === 'telegraph' || boss.state === 'swoop') {
    ctx.strokeStyle = `rgba(120,200,255,${0.6 + Math.sin(t * 0.4) * 0.4})`;
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      const lx = i * 22;
      ctx.beginPath();
      ctx.moveTo(lx, 28);
      ctx.lineTo(lx - 6, 50);
      ctx.lineTo(lx + 6, 72);
      ctx.lineTo(lx, 95);
      ctx.stroke();
    }
  }

  ctx.restore();

  // Hit flash
  if (boss.hitTimer > 0 && Math.floor(boss.hitTimer / 6) % 2 === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(boss.x - cam.x, boss.y - cam.y, boss.w, boss.h);
  }

  // Telegraph indicator: flash on swoop path
  if (boss.state === 'telegraph' && Math.floor(game.tick / 4) % 2 === 0) {
    ctx.strokeStyle = 'rgba(100,180,255,0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(boss.x - cam.x + boss.w / 2, boss.y - cam.y + boss.h);
    ctx.lineTo(boss.swoopTargetX - cam.x + boss.w / 2, BOSS_GROUND_Y - 110 - cam.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
```

- [ ] **Step 4: Playtest Thunderbird in browser**

```bash
python -m http.server 3000
```

Open DevTools console:
```js
window.trailBlazerDebug.warpToLevel(3)
```

Verify: Thunderbird patrols, telegraphs with dashed line, swoops toward player, player can hit it with bear spray (X key) during swoop bottom, 3 hits defeat it, boss-defeated overlay shows.

- [ ] **Step 5: Commit**

```bash
git add game.js
git commit -m "feat: Thunderbird boss — patrol, swoop, bear spray combat for #78"
```

---

## Task 6: Mothman boss

**Files:**
- Modify: `game.js` — BOSS ARENA section

- [ ] **Step 1: Insert `makeBossMothman`**

```js
function makeBossMothman() {
  return {
    type: 'mothman',
    x: BOSS_ARENA_W / 2 - 50, y: 200,
    w: 100, h: 120,
    hp: 5,
    phase: 1,
    state: 'hover',  // hover | fire | freeze | charge
    stateTimer: 90,
    hoverDir: 1,
    hoverSpeed: 1.2,
    orbs: [],        // [ { x, y, vx, vy } ]
    eyeGlow: 0,      // 0..1, ramps up before charge
    chargeVx: 0,
    vulnerable: false,
    hitTimer: 0,
  };
}
```

- [ ] **Step 2: Insert `updateMothman`**

```js
function updateMothman(boss) {
  if (boss.hitTimer > 0) boss.hitTimer--;

  // Update orbs
  boss.orbs = boss.orbs.filter(orb => {
    orb.x += orb.vx;
    orb.y += orb.vy;
    if (player.hurtTimer === 0 &&
        aabb(player, { x: orb.x - 8, y: orb.y - 8, w: 16, h: 16 })) {
      hurtPlayer();
      return false;
    }
    return orb.x > -50 && orb.x < BOSS_ARENA_W + 50 &&
           orb.y > -50 && orb.y < BOSS_ARENA_H + 50;
  });

  if (boss.state === 'hover') {
    // Slow horizontal patrol
    boss.x += boss.hoverDir * boss.hoverSpeed;
    if (boss.x < 100)                         { boss.x = 100;                    boss.hoverDir =  1; }
    if (boss.x > BOSS_ARENA_W - boss.w - 100) { boss.x = BOSS_ARENA_W - boss.w - 100; boss.hoverDir = -1; }
    // Gentle vertical bob
    boss.y = 200 + Math.sin(game.tick * 0.03) * 25;
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      boss.state = 'fire';
      boss.stateTimer = 20;  // brief wind-up
    }
  } else if (boss.state === 'fire') {
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      // Fire 3 orbs spread at player
      const px = player.x + player.w / 2;
      const py = player.y + player.h / 2;
      const bx = boss.x + boss.w / 2;
      const by = boss.y + boss.h / 2;
      for (let i = -1; i <= 1; i++) {
        const spread = i * 80;
        const tx = px + spread;
        const ty = py;
        const dist = Math.hypot(tx - bx, ty - by) || 1;
        const speed = boss.phase === 2 ? 5 : 4;
        boss.orbs.push({
          x: bx, y: by,
          vx: (tx - bx) / dist * speed,
          vy: (ty - by) / dist * speed,
        });
      }
      audio.sfxStun();
      boss.state = 'freeze';
      boss.stateTimer = boss.phase === 2 ? 20 : 30;  // shorter freeze in phase 2
    }
  } else if (boss.state === 'freeze') {
    boss.vulnerable = true;  // open to bear spray during freeze
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      boss.vulnerable = false;
      // Phase 2: add charge attack
      if (boss.phase === 2 && Math.random() < 0.5) {
        boss.eyeGlow = 0;
        boss.state = 'chargeWind';
        boss.stateTimer = 35;
      } else {
        boss.state = 'hover';
        boss.stateTimer = 60 + Math.random() * 30 | 0;
      }
    }
  } else if (boss.state === 'chargeWind') {
    // Ramp up eye glow as telegraph
    boss.eyeGlow = Math.min(1, boss.eyeGlow + 1 / 35);
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      const dir = player.x < boss.x ? -1 : 1;
      boss.chargeVx = dir * 14;
      boss.chargeStartY = boss.y;
      boss.state = 'charge';
      boss.stateTimer = 50;
    }
  } else if (boss.state === 'charge') {
    boss.x += boss.chargeVx;
    // Charge at ground level
    const targetY = BOSS_GROUND_Y - boss.h - 10;
    boss.y += (targetY - boss.y) * 0.15;

    if (player.hurtTimer === 0 && aabb(player, boss)) {
      hurtPlayer();
    }

    boss.stateTimer--;
    if (boss.stateTimer <= 0 ||
        boss.x < -boss.w || boss.x > BOSS_ARENA_W) {
      // Stall after charge — vulnerable
      boss.chargeVx = 0;
      boss.x = Math.max(100, Math.min(BOSS_ARENA_W - boss.w - 100, boss.x));
      boss.eyeGlow = 0;
      boss.vulnerable = true;
      boss.state = 'stall';
      boss.stateTimer = 25;
    }
  } else if (boss.state === 'stall') {
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      boss.vulnerable = false;
      boss.state = 'hover';
      boss.stateTimer = 50;
    }
  }
}
```

- [ ] **Step 3: Insert `drawMothman`**

```js
function drawMothman(boss) {
  const t  = game.tick;
  const bx = boss.x - cam.x + boss.w / 2;
  const by = boss.y - cam.y + boss.h / 2;

  // Orbs (draw behind boss)
  boss.orbs.forEach(orb => {
    ctx.fillStyle = 'rgba(255,50,50,0.85)';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(orb.x - cam.x, orb.y - cam.y, 8, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;

  ctx.save();
  ctx.translate(bx, by);

  const flapAmp  = boss.state === 'charge' ? 25 : 12;
  const wingFlap = Math.sin(t * 0.15) * flapAmp;

  // Upper wings
  ctx.fillStyle = '#1a0a2a';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 8, -20);
    ctx.quadraticCurveTo(s * 72, -55 - wingFlap, s * 88, -8);
    ctx.quadraticCurveTo(s * 58, 12, s * 8, -8);
    ctx.fill();
  }

  // Lower wings (smaller)
  ctx.fillStyle = '#15082a';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 8, 8);
    ctx.quadraticCurveTo(s * 48, 42, s * 52, 52);
    ctx.quadraticCurveTo(s * 28, 58, s * 8, 42);
    ctx.fill();
  }

  // Body
  ctx.fillStyle = '#2a1040';
  ctx.beginPath();
  ctx.ellipse(0, 14, 11, 33, 0, 0, Math.PI * 2);
  ctx.fill();

  // Glowing red eyes (intensify on charge wind-up)
  const eyeAlpha = boss.state === 'chargeWind' || boss.state === 'charge'
    ? 0.7 + boss.eyeGlow * 0.3
    : 0.6 + Math.sin(t * 0.05) * 0.3;
  ctx.fillStyle = `rgba(255,0,0,${eyeAlpha})`;
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 8 + boss.eyeGlow * 18;
  ctx.beginPath(); ctx.arc(-7, -30, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 7, -30, 5, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // Wing pattern veins
  ctx.strokeStyle = 'rgba(100,40,150,0.35)';
  ctx.lineWidth = 1;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 8, -15);
    ctx.quadraticCurveTo(s * 50, -42 - wingFlap * 0.8, s * 72, -4);
    ctx.stroke();
  }

  ctx.restore();

  // Hit flash
  if (boss.hitTimer > 0 && Math.floor(boss.hitTimer / 6) % 2 === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(boss.x - cam.x, boss.y - cam.y, boss.w, boss.h);
  }
}
```

- [ ] **Step 4: Playtest Mothman in browser**

```js
window.trailBlazerDebug.warpToLevel(7)
```

Verify: Mothman hovers, fires 3-orb spreads, freezes (vulnerability window — spray hits should register), phase 2 charge triggers after enough hits, 5 hits total defeat it.

- [ ] **Step 5: Commit**

```bash
git add game.js
git commit -m "feat: Mothman boss — orb spread, phase 2 charge, vulnerability windows for #78"
```

---

## Task 7: Bigfoot boss

**Files:**
- Modify: `game.js` — BOSS ARENA section

- [ ] **Step 1: Insert `makeBigfoot`**

```js
function makeBigfoot() {
  return {
    type: 'bigfoot',
    x: 150, y: BOSS_GROUND_Y - 200,
    w: 100, h: 200,
    hp: 8,
    phase: 1,
    state: 'idle',  // idle | windup | throw | groundpound | stagger | rage
    stateTimer: 80,
    boulders: [],   // [ { x, y, vx, vy, r } ]
    shockwave: null, // { x, dir, speed, alpha, active }
    windupProgress: 0,
    rageTimer: 0,
    vulnerable: false,
    hitTimer: 0,
  };
}
```

- [ ] **Step 2: Insert `updateBigfoot`**

```js
function updateBigfoot(boss) {
  if (boss.hitTimer > 0) boss.hitTimer--;

  // Update boulders
  boss.boulders = boss.boulders.filter(b => {
    b.x += b.vx;
    b.y += b.vy;
    b.vy += GRAVITY_FORCE * 0.6;
    // Player collision
    if (player.hurtTimer === 0 &&
        aabb(player, { x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 })) {
      hurtPlayer();
    }
    return b.y < BOSS_GROUND_Y + 60;
  });

  // Update shockwave
  if (boss.shockwave && boss.shockwave.active) {
    const sw = boss.shockwave;
    sw.x    += sw.dir * sw.speed;
    sw.alpha -= 0.012;
    if (sw.alpha <= 0 || sw.x < 0 || sw.x > BOSS_ARENA_W) sw.active = false;
    // Shockwave hitbox runs along the floor
    if (player.hurtTimer === 0 && player.onGround) {
      const swHit = { x: sw.dir > 0 ? sw.x - 30 : 0, y: BOSS_GROUND_Y - 30, w: 60, h: 30 };
      if (aabb(player, swHit)) hurtPlayer();
    }
  }

  // Rage intro freeze
  if (boss.rageTimer > 0) {
    boss.rageTimer--;
    return;
  }

  boss.stateTimer--;

  if (boss.state === 'idle') {
    if (boss.stateTimer <= 0) {
      boss.windupProgress = 0;
      boss.state = 'windup';
      boss.stateTimer = 40;
    }
  } else if (boss.state === 'windup') {
    boss.windupProgress = Math.min(1, boss.windupProgress + 1 / 40);
    boss.vulnerable = boss.windupProgress > 0.55; // arms-raised window
    if (boss.stateTimer <= 0) {
      boss.vulnerable = false;
      // Throw boulders
      const count = boss.phase === 3 ? 3 : 2;
      for (let i = 0; i < count; i++) {
        const spread = count === 2 ? (i - 0.5) * 200 : (i - 1) * 160;
        const tx = Math.max(50, Math.min(BOSS_ARENA_W - 50, player.x + player.w / 2 + spread));
        const ty = BOSS_GROUND_Y;
        const sx = boss.x + boss.w / 2;
        const sy = boss.y + boss.h * 0.3;
        const dist = Math.hypot(tx - sx, ty - sy) || 1;
        const spd  = 7 + boss.phase;
        boss.boulders.push({
          x: sx, y: sy,
          vx: (tx - sx) / dist * spd,
          vy: (ty - sy) / dist * spd - 6,
          r: 16,
        });
      }
      boss.windupProgress = 0;
      boss.state = 'throw';
      boss.stateTimer = 30;
    }
  } else if (boss.state === 'throw') {
    if (boss.stateTimer <= 0) {
      const nextIdleTime = boss.phase === 3 ? 25 : boss.phase === 2 ? 45 : 65;
      // Phase 2+: occasionally ground-pound
      if (boss.phase >= 2 && Math.random() < 0.45) {
        boss.state = 'groundpound';
        boss.stateTimer = 45;
      } else {
        boss.state = 'idle';
        boss.stateTimer = nextIdleTime;
      }
    }
  } else if (boss.state === 'groundpound') {
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      // Slam — shockwave toward player
      const dir = player.x + player.w / 2 > boss.x + boss.w / 2 ? 1 : -1;
      boss.shockwave = { x: boss.x + boss.w / 2, dir, speed: 7, alpha: 0.85, active: true };
      spawnParticles(boss.x + boss.w / 2, BOSS_GROUND_Y, '#5a3a1a', 24, 6);
      audio.sfxStun();
      boss.vulnerable = true;  // briefly vulnerable in landing stagger
      boss.state = 'stagger';
      boss.stateTimer = 28;
    }
  } else if (boss.state === 'stagger') {
    boss.stateTimer--;
    if (boss.stateTimer <= 0) {
      boss.vulnerable = false;
      const nextIdleTime = boss.phase === 3 ? 20 : 40;
      boss.state = 'idle';
      boss.stateTimer = nextIdleTime;
    }
  }
}
```

- [ ] **Step 3: Insert `drawBigfoot`**

```js
function drawBigfoot(boss) {
  const t  = game.tick;
  const bx = boss.x - cam.x + boss.w / 2;
  const by = boss.y - cam.y + boss.h;  // translate to feet

  // Draw boulders
  boss.boulders.forEach(b => {
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.arc(b.x - cam.x, b.y - cam.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#999';
    ctx.beginPath();
    ctx.arc(b.x - cam.x - b.r * 0.3, b.y - cam.y - b.r * 0.3, b.r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw shockwave
  if (boss.shockwave && boss.shockwave.active) {
    const sw  = boss.shockwave;
    const swx = sw.x - cam.x;
    const swy = BOSS_GROUND_Y - cam.y - 22;
    ctx.fillStyle = `rgba(90,58,26,${sw.alpha})`;
    if (sw.dir > 0) ctx.fillRect(swx, swy, BOSS_ARENA_W - sw.x, 22);
    else            ctx.fillRect(0,   swy, swx, 22);
  }

  ctx.save();
  ctx.translate(bx, by);

  const arm = Math.min(1, boss.windupProgress);

  ctx.fillStyle = '#2a1a0a';

  // Feet
  ctx.beginPath(); ctx.ellipse(-22, 0,  22, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( 22, 0,  22, 8, 0, 0, Math.PI * 2); ctx.fill();

  // Legs
  ctx.fillRect(-32, -75, 26, 75);
  ctx.fillRect(  6, -75, 26, 75);

  // Body
  ctx.beginPath();
  ctx.ellipse(0, -120, 46, 62, 0, 0, Math.PI * 2);
  ctx.fill();

  // Left arm (raises during windup)
  ctx.save();
  ctx.translate(-50, -150 - arm * 30);
  ctx.rotate(-arm * 0.9 - 0.25);
  ctx.fillRect(-10, 0, 20, 70);
  ctx.beginPath(); ctx.ellipse(0, 76, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Right arm
  ctx.save();
  ctx.translate(50, -150 - arm * 30);
  ctx.rotate(arm * 0.9 + 0.25);
  ctx.fillRect(-10, 0, 20, 70);
  ctx.beginPath(); ctx.ellipse(0, 76, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Head
  ctx.beginPath();
  ctx.ellipse(0, -188, 28, 28, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = boss.phase === 3 ? '#ff6600' : '#cc3300';
  ctx.beginPath(); ctx.arc(-10, -193, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 10, -193, 4, 0, Math.PI * 2); ctx.fill();

  // Fur detail
  ctx.strokeStyle = 'rgba(80,50,20,0.5)';
  ctx.lineWidth = 1.5;
  for (let i = -36; i <= 36; i += 12) {
    const yy = -90 + Math.sin(i * 0.45) * 14;
    ctx.beginPath();
    ctx.moveTo(i, yy);
    ctx.lineTo(i + 4, yy - 14);
    ctx.stroke();
  }

  // Phase 3 rage aura
  if (boss.phase === 3) {
    ctx.strokeStyle = `rgba(255,100,0,${0.4 + Math.sin(t * 0.2) * 0.4})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, -130, 60, 95, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Rage intro roar mouth
  if (boss.rageTimer > 60) {
    ctx.fillStyle = '#ff2200';
    ctx.beginPath();
    ctx.ellipse(0, -178, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Hit flash
  if (boss.hitTimer > 0 && Math.floor(boss.hitTimer / 6) % 2 === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(boss.x - cam.x, boss.y - cam.y, boss.w, boss.h);
  }
}
```

- [ ] **Step 4: Playtest Bigfoot in browser**

```js
window.trailBlazerDebug.warpToLevel(11)
```

Verify: Bigfoot throws boulders (arms raise = vulnerability window), phase 2 adds ground-pound with shockwave (jump to dodge, then spray during stagger), phase 3 activates at 2 HP with rage aura and roar. 8 hits defeat it.

- [ ] **Step 5: Commit**

```bash
git add game.js
git commit -m "feat: Bigfoot boss — boulder throw, ground-pound shockwave, 3-phase escalation for #78"
```

---

## Task 8: Screen fixes — levelcomplete, win screen, final QA

**Files:**
- Modify: `game.js` — SCREENS section

- [ ] **Step 1: Update `drawLevelComplete` to show boss-specific content**

In `drawLevelComplete`, find the header text:

```js
  ctx.fillText('CAMP REACHED!', W / 2, H / 2 - 120);
```

Replace the whole header block (the 4 lines around it):

```js
  const def = LEVELS[game.levelNum];
  const nextDef = LEVELS[game.levelNum + 1];

  ctx.fillStyle = def.isBoss ? '#FFD700' : '#88FF88';
  ctx.font = 'bold 48px Courier New';
  ctx.textAlign = 'center';
  ctx.shadowColor = def.isBoss ? '#aa6600' : '#44AA44';
  ctx.shadowBlur = 12;
  ctx.fillText(def.isBoss ? 'BOSS DEFEATED!' : 'CAMP REACHED!', W / 2, H / 2 - 120);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 20px Courier New';
  ctx.fillText(def.campName, W / 2, H / 2 - 82);
```

Then find the gear display:

```js
  ctx.fillText('Gear: ' + items.filter(i => i.collected).length + ' / ' + items.length, W / 2, infoY);
```

Replace that single line with:

```js
  if (!def.isBoss) {
    ctx.fillText('Gear: ' + items.filter(i => i.collected).length + ' / ' + items.length, W / 2, infoY);
  } else {
    ctx.fillText('Bear spray hits landed!', W / 2, infoY);
  }
```

Find the Leave No Trace display block:

```js
  if (game.leaveNoTrace[game.levelNum]) {
    ctx.fillStyle = '#44ffaa';
    ctx.font = 'bold 16px Courier New';
    ctx.fillText('LEAVE NO TRACE +1000', W / 2, infoY);
    infoY += lineHeight;
  }
```

Replace with:

```js
  if (game.leaveNoTrace[game.levelNum]) {
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 16px Courier New';
    ctx.fillText(def.isBoss ? 'NO HIT BONUS +500' : 'LEAVE NO TRACE +1000', W / 2, infoY);
    infoY += lineHeight;
  }
```

- [ ] **Step 2: Update `drawWin` to label boss levels correctly**

In `drawWin`, find the line that renders level awards:

```js
    const awards = (lnt && ta) ? ' \u2605 LNT+Angel!' : lnt ? ' \u2605 LNT' : ta ? ' \u2605 Angel' : '';
    ctx.fillStyle = (lnt && ta) ? '#FFD700' : (lnt || ta) ? '#44ffaa' : '#AAAAFF';
    ctx.fillText((i + 1) + '. ' + l.campName + awards, W / 2, itemY);
```

Replace with:

```js
    let awards, fillColor;
    if (l.isBoss) {
      awards    = lnt ? ' \u2605 NO HIT' : '';
      fillColor = lnt ? '#FFD700' : '#cc8833';
    } else {
      awards    = (lnt && ta) ? ' \u2605 LNT+Angel!' : lnt ? ' \u2605 LNT' : ta ? ' \u2605 Angel' : '';
      fillColor = (lnt && ta) ? '#FFD700' : (lnt || ta) ? '#44ffaa' : '#AAAAFF';
    }
    ctx.fillStyle = fillColor;
    ctx.fillText((i + 1) + '. ' + l.campName + awards, W / 2, itemY);
```

- [ ] **Step 3: Run full QA suite**

```bash
cd qa
node runner.mjs scenarios/boss-warp.mjs
node runner.mjs scenarios/smoke.mjs
node runner.mjs scenarios/mobile-buttons.mjs
```

All three should pass. Review screenshots in `qa/screenshots/` for boss-thunderbird-initial, boss-mothman-initial, boss-bigfoot-initial.

- [ ] **Step 4: Full playthrough smoke test in browser**

```bash
python -m http.server 3000
```

- Start a new game from the menu
- Play through level 1 to confirm it still reaches level complete normally
- Use `window.trailBlazerDebug.warpToLevel(11)` to test Bigfoot (final boss)
- Defeat Bigfoot and confirm the win screen appears with all 12 levels listed

- [ ] **Step 5: Final commit and push to branch**

```bash
git add game.js qa/scenarios/boss-warp.mjs
git commit -m "feat: boss level screens, win screen awards, full QA for #78"
```

Then open a PR:

```bash
gh pr create \
  --title "feat: add cryptid boss arenas every 3 levels (#78)" \
  --body "$(cat <<'EOF'
## Summary
- Adds 3 cryptid boss levels (Thunderbird, Mothman, Bigfoot) at levels 4, 8, and 12
- Boss arenas use a virtual 1600×800 world with player-biased camera (player at 80% down)
- Bear spray fires as an auto-aimed projectile; hit boss during vulnerability windows
- Escalating phases: Thunderbird (0), Mothman (2), Bigfoot (3)
- Scoring: speed bonus (30/60/90s targets) + no-hit +500

## Test plan
- [ ] Run `node runner.mjs scenarios/boss-warp.mjs` — all assertions pass
- [ ] Run `node runner.mjs scenarios/smoke.mjs` — normal levels still work
- [ ] Playtest all 3 bosses manually; verify phase transitions and defeat
- [ ] Verify win screen shows all 12 levels with correct award labels

closes #78
EOF
)"
```
