// TRAIL BLAZER: An Ultralight Backpacking Adventure
// Commander Keen-style platformer

(function () {
'use strict';

// ==================== SETUP ====================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 800, H = 480;
canvas.width = W;
canvas.height = H;
const TS = 32; // tile size in pixels

// Resize canvas to match viewport aspect ratio on mobile landscape
function resizeCanvas() {
  const isTouch = matchMedia('(hover: none) and (pointer: coarse)').matches;
  const isLandscape = window.innerWidth > window.innerHeight;
  if (isTouch && isLandscape) {
    // Use actual viewport height so the canvas doesn't overflow on devices where
    // 100vh > physical screen height (e.g. iOS Safari in landscape). This also
    // makes H < level height (480px), enabling vertical camera scrolling.
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    H = Math.min(480, Math.round(vh));
    W = Math.round(H * (window.innerWidth / vh));
  } else {
    W = 800;
    H = 480;
  }
  canvas.width = W;
  canvas.height = H;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
if (window.visualViewport) window.visualViewport.addEventListener('resize', resizeCanvas);

// ==================== INPUT ====================
const keys = {}, prev = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
const jp = c => keys[c] && !prev[c]; // just-pressed
function syncPrev() { for (let k in keys) prev[k] = keys[k]; }

const isLeft  = () => keys['ArrowLeft']  || keys['KeyA'];
const isRight = () => keys['ArrowRight'] || keys['KeyD'];
const isDown  = () => keys['ArrowDown']  || keys['KeyS'];
const isJump  = () => keys['ArrowUp'] || keys['KeyW'] || keys['Space'] || keys['KeyZ'];
const wasJump = () => (prev['ArrowUp'] || prev['KeyW'] || prev['Space'] || prev['KeyZ']);
const isSpray = () => (keys['KeyX'] || keys['KeyF']) && !(prev['KeyX'] || prev['KeyF']);

// ==================== TILE TYPES ====================
const T_EMPTY    = 0;
const T_SOLID    = 1;
const T_PLATFORM = 2; // one-way
const T_WATER    = 3;

// ==================== UTILITIES ====================
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => Math.random() * (b - a) + a;

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// ==================== LEVEL HELPERS ====================
function makeMap(cols, rows) {
  const map = Array.from({length: rows}, () => new Uint8Array(cols));
  const set = (x, y, t) => { if (x >= 0 && x < cols && y >= 0 && y < rows) map[y][x] = t; };
  const hline = (x1, x2, y, t) => { for (let x = x1; x <= x2; x++) set(x, y, t); };
  const fill  = (x1, y1, x2, y2, t) => { for (let y = y1; y <= y2; y++) hline(x1, x2, y, t); };
  return { map, set, hline, fill };
}

// ==================== LEVEL DEFINITIONS ====================
const LEVELS = [
  // ======== LEVEL 1: MEADOW TRAIL ========
  {
    name: 'Meadow Trail',
    subtitle: 'A gentle start through wildflower meadows',
    goalTile: [117, 2],
    goalFlagY: 4,
    spawnTile: [2, 9],
    build() {
      const COLS = 120, ROWS = 15;
      const { map, set, hline, fill } = makeMap(COLS, ROWS);
      fill(0, 11, COLS - 1, 14, T_SOLID);
      hline(12, 18, 10, T_SOLID); hline(14, 16, 9, T_SOLID);
      hline(5, 10, 8, T_PLATFORM); hline(20, 25, 7, T_PLATFORM);
      hline(28, 34, 9, T_PLATFORM); hline(33, 39, 7, T_PLATFORM);
      hline(42, 48, 8, T_PLATFORM); hline(38, 43, 5, T_PLATFORM);
      hline(45, 50, 6, T_PLATFORM);
      fill(30, 9, 33, 10, T_SOLID); fill(46, 9, 49, 10, T_SOLID);
      fill(56, 11, 67, 11, T_EMPTY); fill(56, 12, 67, 13, T_WATER);
      hline(56, 57, 10, T_SOLID); hline(60, 61, 9, T_SOLID);
      hline(63, 64, 8, T_SOLID); hline(65, 66, 9, T_SOLID); hline(68, 69, 10, T_SOLID);
      fill(70, 9, 74, 10, T_SOLID); fill(75, 8, 79, 10, T_SOLID);
      fill(80, 7, 84, 10, T_SOLID); fill(85, 6, 89, 10, T_SOLID);
      hline(72, 75, 7, T_PLATFORM); hline(79, 83, 6, T_PLATFORM);
      hline(83, 87, 5, T_PLATFORM); hline(88, 93, 7, T_PLATFORM); hline(91, 95, 5, T_PLATFORM);
      hline(97, 103, 8, T_PLATFORM); hline(102, 107, 6, T_PLATFORM);
      hline(107, 112, 4, T_PLATFORM); hline(111, 116, 6, T_PLATFORM);
      fill(116, 4, 119, 14, T_SOLID);
      for (let y = 0; y < ROWS; y++) set(0, y, T_SOLID);
      return { map, COLS, ROWS };
    },
    spawnItems() {
      return [
        makeItem('spork', 7, 7), makeItem('bar', 11, 8), makeItem('spork', 22, 6),
        makeItem('filter', 36, 6), makeItem('tent', 41, 4), makeItem('bar', 47, 5),
        makeItem('spork', 58, 9), makeItem('filter', 63, 7), makeItem('bar', 69, 9),
        makeItem('spork', 73, 6), makeItem('spray', 83, 5), makeItem('tent', 90, 6),
        makeItem('spork', 98, 7), makeItem('filter', 104, 5), makeItem('tent', 110, 3),
        makeItem('spork', 113, 5),
      ];
    },
    spawnEnemies() {
      return [
        makeMarmot(20, 10), makeMarmot(27, 8), makeMarmot(52, 8),
        makeMarmot(72, 8), makeMarmot(95, 10),
        makeMouse(42, 10), makeMouse(85, 5),
        makeMosquito(40, 6), makeMosquito(50, 5), makeMosquito(67, 7),
        makeMosquito(88, 6), makeMosquito(104, 5),
        makeHiker(33, 6), makeHiker(80, 5), makeHiker(109, 3),
      ];
    },
  },

  // ======== LEVEL 2: PINE RIDGE ========
  {
    name: 'Pine Ridge',
    subtitle: 'Dense forest with treacherous ravines',
    goalTile: [147, 2],
    goalFlagY: 4,
    spawnTile: [2, 9],
    build() {
      const COLS = 150, ROWS = 15;
      const { map, set, hline, fill } = makeMap(COLS, ROWS);
      fill(0, 11, COLS - 1, 14, T_SOLID);
      for (let y = 0; y < ROWS; y++) set(0, y, T_SOLID);

      // ---- FOREST ENTRANCE (x: 0-25) ----
      hline(5, 9, 8, T_PLATFORM);
      fill(10, 9, 13, 10, T_SOLID);
      hline(14, 19, 7, T_PLATFORM);
      hline(20, 24, 9, T_PLATFORM);

      // ---- CANOPY CLIMB (x: 25-50) ----
      fill(26, 9, 29, 10, T_SOLID);
      hline(30, 34, 7, T_PLATFORM);
      hline(32, 36, 5, T_PLATFORM);
      fill(37, 8, 40, 10, T_SOLID);
      hline(38, 42, 6, T_PLATFORM);
      hline(41, 46, 4, T_PLATFORM);
      hline(44, 49, 7, T_PLATFORM);
      fill(47, 9, 50, 10, T_SOLID);

      // ---- FIRST RAVINE (x: 50-65) ----
      fill(52, 11, 62, 11, T_EMPTY);
      fill(52, 12, 62, 13, T_WATER);
      hline(52, 53, 9, T_PLATFORM);
      hline(55, 56, 7, T_PLATFORM);
      hline(58, 59, 8, T_PLATFORM);
      hline(61, 62, 6, T_PLATFORM);
      hline(63, 64, 9, T_SOLID);

      // ---- FALLEN TREES (x: 65-90) ----
      hline(66, 72, 9, T_PLATFORM);
      hline(68, 74, 7, T_PLATFORM);
      fill(73, 8, 76, 10, T_SOLID);
      hline(75, 80, 5, T_PLATFORM);
      hline(77, 82, 8, T_PLATFORM);
      fill(81, 9, 84, 10, T_SOLID);
      hline(83, 88, 6, T_PLATFORM);
      hline(85, 90, 4, T_PLATFORM);
      hline(88, 92, 8, T_PLATFORM);

      // ---- SECOND RAVINE (x: 90-105) ----
      fill(93, 11, 103, 11, T_EMPTY);
      fill(93, 12, 103, 13, T_WATER);
      hline(92, 93, 10, T_SOLID);
      hline(95, 96, 8, T_SOLID);
      hline(98, 99, 7, T_SOLID);
      hline(101, 102, 9, T_SOLID);
      hline(104, 105, 10, T_SOLID);

      // ---- RIDGE ASCENT (x: 105-135) ----
      fill(106, 9, 110, 10, T_SOLID);
      fill(111, 8, 115, 10, T_SOLID);
      hline(113, 118, 6, T_PLATFORM);
      fill(116, 7, 120, 10, T_SOLID);
      hline(119, 124, 5, T_PLATFORM);
      fill(122, 6, 126, 10, T_SOLID);
      hline(125, 130, 4, T_PLATFORM);
      hline(128, 133, 7, T_PLATFORM);

      // ---- SUMMIT (x: 135-149) ----
      hline(134, 139, 5, T_PLATFORM);
      hline(138, 143, 7, T_PLATFORM);
      hline(141, 146, 5, T_PLATFORM);
      fill(146, 4, 149, 14, T_SOLID);

      return { map, COLS, ROWS };
    },
    spawnItems() {
      return [
        makeItem('bar', 7, 7), makeItem('spork', 16, 6), makeItem('filter', 23, 8),
        makeItem('bar', 33, 4), makeItem('spray', 40, 5), makeItem('tent', 45, 3),
        makeItem('spork', 54, 8), makeItem('filter', 61, 5), makeItem('bar', 70, 6),
        makeItem('tent', 78, 4), makeItem('spork', 86, 5), makeItem('spray', 96, 7),
        makeItem('filter', 101, 8), makeItem('bar', 114, 5), makeItem('tent', 125, 3),
        makeItem('spork', 132, 6), makeItem('filter', 140, 4), makeItem('tent', 144, 4),
      ];
    },
    spawnEnemies() {
      return [
        makeMarmot(15, 10), makeMarmot(35, 7), makeMarmot(70, 8),
        makeMarmot(90, 10), makeMarmot(108, 8), makeMarmot(130, 6),
        makeMouse(25, 10), makeMouse(60, 8), makeMouse(100, 10),
        makeMosquito(28, 5), makeMosquito(43, 4), makeMosquito(57, 5),
        makeMosquito(75, 4), makeMosquito(99, 5), makeMosquito(120, 4),
        makeMosquito(137, 4),
        makeHiker(48, 6), makeHiker(83, 5), makeHiker(115, 5), makeHiker(142, 4),
      ];
    },
  },

  // ======== LEVEL 3: ALPINE PASS ========
  {
    name: 'Alpine Pass',
    subtitle: 'The final ascent above the treeline',
    goalTile: [177, 1],
    goalFlagY: 3,
    spawnTile: [2, 9],
    build() {
      const COLS = 180, ROWS = 15;
      const { map, set, hline, fill } = makeMap(COLS, ROWS);
      fill(0, 11, COLS - 1, 14, T_SOLID);
      for (let y = 0; y < ROWS; y++) set(0, y, T_SOLID);

      // ---- TRAILHEAD (x: 0-20) ----
      hline(4, 8, 9, T_PLATFORM);
      fill(9, 9, 12, 10, T_SOLID);
      hline(13, 17, 7, T_PLATFORM);
      hline(18, 22, 9, T_PLATFORM);

      // ---- BOULDER FIELD (x: 20-45) ----
      fill(22, 9, 25, 10, T_SOLID);
      fill(27, 8, 30, 10, T_SOLID);
      hline(31, 34, 6, T_PLATFORM);
      fill(33, 7, 36, 10, T_SOLID);
      hline(37, 40, 5, T_PLATFORM);
      fill(39, 8, 42, 10, T_SOLID);
      hline(43, 46, 7, T_PLATFORM);

      // ---- WATERFALL GORGE (x: 45-70) ----
      fill(47, 11, 68, 11, T_EMPTY);
      fill(47, 12, 68, 13, T_WATER);
      hline(47, 70, 10, T_SOLID); // rescue ledge: player can jump from y=14 floor to y=10, then escape up
      hline(50, 51, 8, T_SOLID);
      hline(53, 53, 6, T_PLATFORM);
      hline(55, 56, 9, T_SOLID);
      hline(58, 59, 7, T_PLATFORM);
      hline(61, 61, 5, T_PLATFORM);
      hline(63, 64, 8, T_SOLID);
      hline(66, 67, 6, T_PLATFORM);

      // ---- SWITCHBACK ASCENT (x: 70-105) ----
      fill(70, 9, 75, 10, T_SOLID);
      hline(73, 78, 7, T_PLATFORM);
      fill(76, 8, 80, 10, T_SOLID);
      hline(79, 84, 6, T_PLATFORM);
      fill(82, 7, 86, 10, T_SOLID);
      hline(85, 90, 5, T_PLATFORM);
      fill(88, 6, 91, 10, T_SOLID);   // trimmed right by 1 to widen pit 1
      hline(91, 96, 4, T_PLATFORM);
      fill(95, 5, 97, 10, T_SOLID);   // trimmed both sides: pit 1 left wall at x=95, pit 2 right wall at x=97
      hline(97, 102, 3, T_PLATFORM);
      fill(101, 4, 104, 10, T_SOLID); // trimmed left by 1 to widen pit 2
      // Hazard pits with rescue platforms:
      // Pit 1: x=92-94 (3 tiles wide) — water at bottom, rescue platform at x=93 y=7 (center)
      // Pit 2: x=98-100 (3 tiles wide) — water at bottom, rescue platform at x=99 y=7 (center)
      // Falling off-center = water damage; landing center = bounce out via platform (4 tiles up, within jump range)
      fill(92, 9, 94, 10, T_WATER);
      fill(98, 9, 100, 10, T_WATER);
      set(93, 7, T_PLATFORM);
      set(99, 7, T_PLATFORM);

      // ---- EXPOSED RIDGE (x: 105-140) ----
      fill(105, 11, 138, 11, T_EMPTY);
      fill(105, 12, 138, 13, T_WATER);
      hline(105, 138, 10, T_SOLID); // rescue ledge: player can jump from y=14 floor to y=10, then reach platforms above
      hline(105, 108, 8, T_PLATFORM);
      hline(110, 112, 6, T_PLATFORM);
      hline(114, 116, 8, T_PLATFORM);
      hline(118, 120, 5, T_PLATFORM);
      hline(122, 124, 7, T_PLATFORM);
      hline(126, 128, 4, T_PLATFORM);
      hline(130, 132, 6, T_PLATFORM);
      hline(134, 136, 8, T_PLATFORM);
      hline(138, 140, 5, T_PLATFORM);

      // ---- SCREE FIELD (x: 140-160) ----
      fill(140, 9, 144, 10, T_SOLID);
      fill(143, 7, 146, 10, T_SOLID);
      hline(147, 150, 5, T_PLATFORM);
      fill(149, 8, 152, 10, T_SOLID);
      hline(153, 156, 6, T_PLATFORM);
      fill(155, 7, 158, 10, T_SOLID);
      hline(157, 161, 4, T_PLATFORM);

      // ---- FINAL SUMMIT PUSH (x: 160-179) ----
      fill(160, 9, 164, 10, T_SOLID);
      hline(163, 167, 7, T_PLATFORM);
      hline(166, 170, 5, T_PLATFORM);
      hline(169, 173, 3, T_PLATFORM);
      hline(172, 176, 5, T_PLATFORM);
      fill(176, 3, 179, 14, T_SOLID);

      return { map, COLS, ROWS };
    },
    spawnItems() {
      return [
        makeItem('bar', 6, 8), makeItem('spork', 15, 6), makeItem('filter', 24, 8),
        makeItem('spray', 32, 5), makeItem('tent', 39, 4), makeItem('bar', 49, 7),
        makeItem('spork', 55, 8), makeItem('filter', 61, 4), makeItem('tent', 67, 5),
        makeItem('bar', 75, 6), makeItem('spray', 84, 5), makeItem('spork', 93, 3),
        makeItem('filter', 100, 2), makeItem('bar', 111, 5), makeItem('tent', 119, 4),
        makeItem('spork', 127, 3), makeItem('spray', 135, 7), makeItem('filter', 148, 4),
        makeItem('tent', 156, 5), makeItem('spork', 164, 6), makeItem('tent', 174, 2),
      ];
    },
    spawnEnemies() {
      return [
        makeMarmot(14, 10), makeMarmot(38, 7), makeMarmot(72, 8),
        makeMarmot(105, 10), makeMarmot(142, 8), makeMarmot(162, 8),
        makeMouse(21, 10), makeMouse(55, 8), makeMouse(72, 8), makeMouse(140, 8),
        makeMosquito(20, 6), makeMosquito(45, 5), makeMosquito(58, 4),
        makeMosquito(80, 4), makeMosquito(96, 3), makeMosquito(112, 4),
        makeMosquito(126, 3), makeMosquito(150, 4), makeMosquito(170, 3),
        makeHiker(30, 5), makeHiker(68, 8), makeHiker(90, 4),
        makeHiker(135, 7), makeHiker(155, 5), makeHiker(175, 2),
      ];
    },
  },
];

let level = LEVELS[0].build();

function getTile(tx, ty) {
  if (tx < 0 || tx >= level.COLS || ty < 0 || ty >= level.ROWS) return T_SOLID;
  return level.map[ty][tx];
}

function isSolid(tx, ty) { return getTile(tx, ty) === T_SOLID; }
function isPlatform(tx, ty) { return getTile(tx, ty) === T_PLATFORM; }
function isWater(tx, ty) { return getTile(tx, ty) === T_WATER; }

// ==================== CAMERA ====================
const cam = { x: 0, y: 0 };
function updateCamera(px, py) {
  const targetX = px - W / 2 + 16;
  const targetY = py - H / 2 + 16;
  cam.x += (targetX - cam.x) * 0.12;
  cam.y += (targetY - cam.y) * 0.12;
  cam.x = clamp(cam.x, 0, level.COLS * TS - W);
  cam.y = clamp(cam.y, 0, level.ROWS * TS - H);
}

// ==================== PARTICLES ====================
const particles = [];
function spawnParticles(x, y, color, count, spread) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: rnd(-spread, spread),
      vy: rnd(-spread * 2, -spread * 0.5),
      life: 1.0,
      decay: rnd(0.03, 0.07),
      r: rnd(2, 6),
      color
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.2;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - cam.x, p.y - cam.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ==================== ITEMS ====================
const ITEM_DEFS = {
  spork:  { label: 'Ti Spork',    pts: 100, color: '#C0C0C0', r: 8 },
  bar:    { label: 'Protein Bar', pts: 50,  color: '#D2691E', r: 8 },
  filter: { label: 'Water Filter',pts: 200, color: '#4169E1', r: 9 },
  tent:   { label: 'DCF Tent',    pts: 500, color: '#DAA520', r: 10 },
  spray:  { label: 'Bear Spray',  pts: 150, color: '#FF4500', r: 9 },
};

function makeItem(type, tx, ty) {
  const def = ITEM_DEFS[type];
  return { type, tx, ty, x: tx * TS + 8, y: ty * TS, w: 20, h: 20, pts: def.pts, collected: false, bobOffset: rnd(0, Math.PI * 2) };
}

let items = [];
function spawnItems() {
  items = LEVELS[game.levelNum].spawnItems();
}

// ==================== FLOATING TEXT ====================
const floatTexts = [];
function addFloatText(x, y, str, color) {
  floatTexts.push({ x, y, str, color, life: 1.2, vy: -1.5 });
}
function updateFloatTexts() {
  for (let i = floatTexts.length - 1; i >= 0; i--) {
    const f = floatTexts[i];
    f.y += f.vy;
    f.life -= 0.025;
    if (f.life <= 0) floatTexts.splice(i, 1);
  }
}

// ==================== ENEMIES ====================
function makeMarmot(tx, ty) {
  return {
    type: 'marmot',
    x: tx * TS, y: ty * TS - 4,
    w: 26, h: 22,
    vx: -1, vy: 0,
    onGround: false,
    alive: true,
    stunTimer: 0,
    frame: 0, frameTimer: 0,
    patrolX1: (tx - 4) * TS,
    patrolX2: (tx + 4) * TS,
  };
}

function makeMosquito(tx, ty) {
  return {
    type: 'mosquito',
    x: tx * TS, y: ty * TS,
    w: 20, h: 14,
    baseY: ty * TS,
    phase: rnd(0, Math.PI * 2),
    vx: rnd(-0.5, 0.5) < 0 ? -1.2 : 1.2,
    alive: true,
    stunTimer: 0,
  };
}

function makeHiker(tx, ty) {
  return {
    type: 'hiker',
    x: tx * TS, y: ty * TS - 12,
    w: 24, h: 36,
    vx: -0.8, vy: 0,
    onGround: false,
    alive: true,
    stunTimer: 0,
    frame: 0, frameTimer: 0,
    patrolX1: (tx - 3) * TS,
    patrolX2: (tx + 3) * TS,
  };
}

function makeMouse(tx, ty) {
  return {
    type: 'mouse',
    x: tx * TS, y: ty * TS + 8,
    w: 16, h: 12,
    vx: -1.8, vy: 0,
    onGround: false,
    alive: true,
    stunTimer: 0,
    frame: 0, frameTimer: 0,
    patrolX1: (tx - 5) * TS,
    patrolX2: (tx + 5) * TS,
  };
}

let enemies = [];
function spawnEnemies() {
  enemies = LEVELS[game.levelNum].spawnEnemies();
}

function moveEntityHoriz(e, vx) {
  e.x += vx;
  const left  = Math.floor(e.x / TS);
  const right = Math.floor((e.x + e.w - 1) / TS);
  const top   = Math.floor(e.y / TS);
  const bot   = Math.floor((e.y + e.h - 1) / TS);
  if (vx > 0) {
    for (let ty = top; ty <= bot; ty++) {
      if (isSolid(right, ty)) { e.x = right * TS - e.w; return true; }
    }
  } else if (vx < 0) {
    for (let ty = top; ty <= bot; ty++) {
      if (isSolid(left, ty)) { e.x = (left + 1) * TS; return true; }
    }
  }
  return false;
}

function moveEntityVert(e, vy, checkPlatform) {
  e.y += vy;
  const left  = Math.floor(e.x / TS);
  const right = Math.floor((e.x + e.w - 1) / TS);
  const top   = Math.floor(e.y / TS);
  const bot   = Math.floor((e.y + e.h) / TS);
  e.onGround = false;
  if (vy > 0) {
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(tx, bot)) {
        e.y = bot * TS - e.h;
        e.onGround = true;
        return true;
      }
      if (checkPlatform && isPlatform(tx, bot) && Math.floor((e.y + e.h - vy - 1) / TS) < bot) {
        e.y = bot * TS - e.h;
        e.onGround = true;
        return true;
      }
    }
  } else if (vy < 0) {
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(tx, top)) { e.y = (top + 1) * TS; return true; }
    }
  }
  return false;
}

function updateEnemy(e) {
  if (!e.alive) return;
  if (e.stunTimer > 0) { e.stunTimer--; return; }

  if (e.type === 'mosquito') {
    e.phase += 0.04;
    e.y = e.baseY + Math.sin(e.phase) * 28;
    e.x += e.vx;
    if (e.x < 1 * TS || e.x > (level.COLS - 2) * TS) e.vx *= -1;
    // Reverse at walls
    if (isSolid(Math.floor(e.x / TS), Math.floor(e.y / TS))) e.vx *= -1;
    return;
  }

  // Gravity for ground enemies
  e.vy += 0.55;
  if (e.vy > 14) e.vy = 14;

  e.frameTimer++;
  if (e.frameTimer > 10) { e.frameTimer = 0; e.frame ^= 1; }

  const hitWall = moveEntityHoriz(e, e.vx);
  if (hitWall) e.vx *= -1;

  // Turn at patrol edges
  if (e.x < e.patrolX1) { e.vx = Math.abs(e.vx); }
  if (e.x + e.w > e.patrolX2) { e.vx = -Math.abs(e.vx); }

  moveEntityVert(e, e.vy, true);
  if (e.onGround) e.vy = 0;

  // Turn at ledge edges
  const frontTx = Math.floor((e.x + (e.vx > 0 ? e.w : 0)) / TS);
  const belowTy = Math.floor((e.y + e.h + 1) / TS);
  if (!isSolid(frontTx, belowTy) && !isPlatform(frontTx, belowTy) && e.onGround) {
    e.vx *= -1;
  }
}

// ==================== PLAYER ====================
const PLAYER_W = 20, PLAYER_H = 30;
const GRAVITY_FORCE = 0.55;
const JUMP_FORCE = -12.5;
const MOVE_SPEED = 3.5;
const MAX_FALL = 15;
const GLISSADE_SPEED = 7;
const GLISSADE_DURATION = 24;
const GLISSADE_COOLDOWN = 90;

function makePlayer() {
  return {
    x: 2 * TS, y: 9 * TS,
    w: PLAYER_W, h: PLAYER_H,
    vx: 0, vy: 0,
    onGround: false,
    facing: 1,
    glissading: 0,
    glissadeCooldown: 0,
    jumpHeld: false,
    jumpBuffer: 0,
    lives: 3,
    score: 0,
    health: 3,
    sprayCooldown: 0,
    sprayTimer: 0,
    hurtTimer: 0,
    frame: 0, frameTimer: 0,
    dead: false,
  };
}

let player;

function updatePlayer() {
  if (player.dead) return;
  if (player.hurtTimer > 0) player.hurtTimer--;
  if (player.sprayCooldown > 0) player.sprayCooldown--;
  if (player.sprayTimer > 0) player.sprayTimer--;
  if (player.glissadeCooldown > 0) player.glissadeCooldown--;

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

  // Glissade (down while moving on ground)
  if (player.glissading > 0) {
    player.glissading--;
    player.vx = player.facing * GLISSADE_SPEED;
    // Spawn dust trail
    if (player.glissading % 3 === 0) {
      spawnParticles(player.x + player.w / 2 - player.facing * 8, player.y + player.h, '#aa8855', 2, 1.5);
    }
    // Clear glissade stun tracking when slide ends
    if (player.glissading === 0) {
      enemies.forEach(e => { e.stunnedByGlissade = false; });
      player.glissadeCooldown = GLISSADE_COOLDOWN;
    }
  } else if (isDown() && player.onGround && (isLeft() || isRight()) && player.hurtTimer === 0 && player.glissadeCooldown === 0) {
    player.glissading = GLISSADE_DURATION;
    spawnParticles(player.x + player.w / 2, player.y + player.h, '#aa8855', 6, 3);
  }

  // Jump
  if (isJump() && !wasJump()) player.jumpBuffer = 8;
  if (player.jumpBuffer > 0) player.jumpBuffer--;

  if (player.jumpBuffer > 0 && player.onGround && player.glissading === 0) {
    player.jumpBuffer = 0;
    player.vy = JUMP_FORCE;
    player.jumpHeld = true;
  }

  // Variable jump height: cut upward speed when button released early
  if (player.jumpHeld) {
    if (!isJump()) {
      player.jumpHeld = false;
      if (player.vy < -5) player.vy = -5;
    }
  }

  // Bear spray
  if (isSpray() && player.sprayCooldown === 0) {
    player.sprayCooldown = 60;
    player.sprayTimer = 20;
    const sprayX = player.x + (player.facing > 0 ? player.w : -120);
    const sprayY = player.y - 10;
    const sprayRect = { x: sprayX, y: sprayY, w: 120, h: 50 };
    spawnParticles(player.x + player.w / 2, player.y + 8, '#ff8800', 12, 4);
    enemies.forEach(e => {
      if (e.alive && e.stunTimer === 0 && aabb(e, sprayRect)) {
        e.stunTimer = 120;
        spawnParticles(e.x + e.w / 2, e.y, '#ff6600', 8, 3);
      }
    });
  }

  // Gravity
  player.vy += GRAVITY_FORCE;
  if (player.vy > MAX_FALL) player.vy = MAX_FALL;

  // Move horizontally
  moveEntityHoriz(player, player.vx);

  // Move vertically, check platform stomp vs ceiling
  const prevVy = player.vy;
  const hitVert = moveEntityVert(player, player.vy, true);
  if (hitVert && player.vy >= 0) {
    player.vy = 0;
  } else if (hitVert) {
    player.vy = 0;
  }

  // Water damage
  const cx = Math.floor((player.x + player.w / 2) / TS);
  const cy = Math.floor((player.y + player.h - 2) / TS);
  if (isWater(cx, cy) || isWater(cx, cy + 1)) {
    hurtPlayer();
  }

  // Enemy collisions
  enemies.forEach(e => {
    if (!e.alive || player.hurtTimer > 0) return;
    if (!aabb(player, e)) return;

    // Glissade: kill already-stunned enemies, stun others
    if (player.glissading > 0) {
      if (e.stunTimer > 0 && !e.stunnedByGlissade) {
        scoreEnemy(e);
      } else if (e.stunTimer === 0) {
        e.stunTimer = 120;
        e.stunnedByGlissade = true;
        spawnParticles(e.x + e.w / 2, e.y, '#ff6600', 8, 3);
      }
      return;
    }

    // Stomp if falling onto enemy
    const stomping = prevVy > 0 && player.y + player.h < e.y + e.h * 0.75;
    if (stomping) {
      if (e.stunTimer > 0) {
        scoreEnemy(e);
      } else {
        // Bounce off (stuns enemy briefly)
        e.stunTimer = 60;
        player.vy = -8;
      }
    } else if (e.stunTimer === 0) {
      hurtPlayer();
    }
  });

  // Item collection
  items.forEach(item => {
    if (item.collected) return;
    if (aabb(player, { x: item.x, y: item.y, w: item.w, h: item.h })) {
      item.collected = true;
      player.score += item.pts;
      spawnParticles(item.x + 10, item.y + 10, ITEM_DEFS[item.type].color, 8, 3);
      addFloatText(item.x + 10, item.y - 8, `${ITEM_DEFS[item.type].label} +${item.pts}`, '#ffff44');

      // Leave No Trace award — all items collected
      if (items.every(i => i.collected)) {
        const bonus = 1000;
        player.score += bonus;
        addFloatText(player.x + player.w / 2, player.y - 30, 'LEAVE NO TRACE! +' + bonus, '#44ffaa');
        spawnParticles(player.x + player.w / 2, player.y, '#44ffaa', 20, 5);
      }
    }
  });

  // Goal check (summit flag)
  const gDef = LEVELS[game.levelNum].goalTile;
  const goalX = gDef[0] * TS, goalY = gDef[1] * TS;
  if (player.x + player.w > goalX && player.y < goalY + 48) {
    game.leaveNoTrace[game.levelNum] = items.every(i => i.collected);
    game.trailAngel[game.levelNum] = enemies.every(en => !en.alive);
    game.levelTick = 0;
    game.state = 'levelcomplete';
  }

  // Fallen off bottom
  if (player.y > level.ROWS * TS + 64) {
    hurtPlayer(true);
  }
}

function hurtPlayer(instant) {
  if (player.hurtTimer > 0 && !instant) return;
  player.health--;
  spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ff4444', 10, 4);
  if (player.health <= 0) {
    player.lives--;
    if (player.lives <= 0) {
      game.state = 'gameover';
    } else {
      // Respawn
      const sp = LEVELS[game.levelNum].spawnTile;
      player.x = sp[0] * TS;
      player.y = sp[1] * TS;
      player.vx = 0;
      player.vy = 0;
      player.health = 3;
      player.hurtTimer = 120;
      cam.x = 0;
    }
  } else {
    player.hurtTimer = 90;
  }
}

const ENEMY_DEFS = {
  marmot:   { label: 'Marmot', pts: 100 },
  mouse:    { label: 'Micro Bear', pts: 75 },
  mosquito: { label: 'Mosquito', pts: 150 },
  hiker:    { label: 'Heavy Packer', pts: 300 },
};

function killEnemy(e) {
  e.alive = false;
  spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#aaff44', 12, 4);
}

function scoreEnemy(e) {
  const def = ENEMY_DEFS[e.type];
  killEnemy(e);
  player.score += def.pts;
  addFloatText(e.x + e.w / 2, e.y - 10, `${def.label} +${def.pts}`, '#ffff44');

  // Trail Angel award — all enemies defeated
  if (enemies.every(en => !en.alive)) {
    const bonus = 1500;
    player.score += bonus;
    addFloatText(player.x + player.w / 2, player.y - 30, 'TRAIL ANGEL! +' + bonus, '#ff88ff');
    spawnParticles(player.x + player.w / 2, player.y, '#ff88ff', 20, 5);
  }
}

// ==================== GAME STATE ====================
const game = {
  state: 'menu', // menu, playing, gameover, levelcomplete, win, enterInitials
  tick: 0,
  hiScore: parseInt(localStorage.getItem('trailBlazerHiScore')) || 0,
  levelNum: 0,
  levelTick: 0,
  leaveNoTrace: [],  // per-level: true if all items collected
  trailAngel: [],    // per-level: true if all enemies defeated
};

function saveHiScore() {
  localStorage.setItem('trailBlazerHiScore', game.hiScore);
}

// ==================== LEADERBOARD ====================
let leaderboard = [];
let leaderboardLoaded = false;
let initialsInput = '';
let initialsSubmitted = false;
let pendingScore = 0;

function fetchLeaderboard() {
  if (!window.db) return;
  window.db.collection('leaderboard')
    .orderBy('score', 'desc')
    .limit(10)
    .get()
    .then(snapshot => {
      leaderboard = [];
      snapshot.forEach(doc => leaderboard.push(doc.data()));
      leaderboardLoaded = true;
    })
    .catch(err => console.warn('Leaderboard fetch failed:', err));
}

function submitScore(name, score) {
  if (!window.db) return;
  window.db.collection('leaderboard').add({
    name: name.toUpperCase(),
    score: score,
    date: new Date().toISOString(),
  })
  .then(() => fetchLeaderboard())
  .catch(err => console.warn('Score submit failed:', err));
}

function qualifiesForLeaderboard(score) {
  if (score <= 0) return false;
  if (!leaderboardLoaded || leaderboard.length < 10) return true;
  return score > leaderboard[leaderboard.length - 1].score;
}

function loadLevel(num) {
  game.levelNum = num;
  const def = LEVELS[num];
  level = def.build();
  spawnItems();
  spawnEnemies();
  particles.length = 0;
  floatTexts.length = 0;
  cam.x = 0;
  cam.y = 0;
}

function initGame() {
  game.levelNum = 0;
  game.leaveNoTrace = [];
  game.trailAngel = [];
  loadLevel(0);
  player = makePlayer();
  const spawn = LEVELS[0].spawnTile;
  player.x = spawn[0] * TS;
  player.y = spawn[1] * TS;
  game.tick = 0;
  game.state = 'playing';
}

function advanceLevel() {
  const nextNum = game.levelNum + 1;
  if (nextNum >= LEVELS.length) {
    game.state = 'win';
    return;
  }
  const savedScore = player.score;
  const savedLives = player.lives;
  loadLevel(nextNum);
  player = makePlayer();
  const spawn = LEVELS[nextNum].spawnTile;
  player.x = spawn[0] * TS;
  player.y = spawn[1] * TS;
  player.score = savedScore;
  player.lives = savedLives;
  game.state = 'playing';
}

// ==================== DRAWING ====================

// Color palette
const C = {
  skyTop:    '#5B9BD5',
  skyBot:    '#A8D8F0',
  mountain:  '#7A9E7E',
  ground:    '#6B4F2A',
  groundTop: '#4E7D3A',
  rock:      '#7A7A7A',
  rockLight: '#999',
  platform:  '#8B6914',
  water:     '#1E90FF',
  waterFoam: '#87CEFA',
  leaf:      '#2E8B2E',
  leafLight: '#3CB343',
};

// Seeded pseudo-random for deterministic background elements
function seededRand(seed) {
  let s = seed | 0;
  return function() {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Pre-generate background elements once so they stay consistent
const bgFarMountains = (function() {
  const r = seededRand(42);
  const peaks = [];
  for (let i = 0; i < 20; i++) {
    peaks.push({
      offset: i * 160 + r() * 60 - 30,
      height: 70 + r() * 90,
      width: 140 + r() * 120,
      skew: r() * 0.3 - 0.15,
    });
  }
  return peaks;
})();

const bgNearMountains = (function() {
  const r = seededRand(99);
  const peaks = [];
  for (let i = 0; i < 16; i++) {
    peaks.push({
      offset: i * 200 + r() * 80 - 40,
      height: 50 + r() * 60,
      width: 120 + r() * 100,
      skew: r() * 0.2 - 0.1,
    });
  }
  return peaks;
})();

const bgTrees = (function() {
  const r = seededRand(137);
  const trees = [];
  for (let i = 0; i < 40; i++) {
    trees.push({
      offset: i * 80 + r() * 40 - 20,
      height: 40 + r() * 35,
      width: 16 + r() * 14,
    });
  }
  return trees;
})();

const bgClouds = (function() {
  const r = seededRand(77);
  const clouds = [];
  for (let i = 0; i < 12; i++) {
    clouds.push({
      offset: i * 280 + r() * 120,
      y: 20 + r() * 80,
      w: 60 + r() * 80,
      h: 18 + r() * 14,
    });
  }
  return clouds;
})();

function drawBackground() {
  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, C.skyTop);
  grad.addColorStop(0.7, C.skyBot);
  grad.addColorStop(1, '#C8E6C8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Clouds (very slow parallax)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  const cx = -cam.x * 0.05;
  for (const c of bgClouds) {
    const x = c.offset + cx;
    // Wrap across the full scrollable range
    const wrapW = bgClouds.length * 280;
    const wx = ((x % wrapW) + wrapW) % wrapW - 140;
    if (wx > W + 100 || wx + c.w < -100) continue;
    ctx.beginPath();
    ctx.ellipse(wx + c.w / 2, c.y, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(wx + c.w * 0.3, c.y + 4, c.w * 0.35, c.h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(wx + c.w * 0.7, c.y + 2, c.w * 0.3, c.h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Far mountains (slow parallax)
  const farX = -cam.x * 0.1;
  const baseY = H * 0.55;
  ctx.fillStyle = '#9BB5A8';
  const farWrap = bgFarMountains.length * 160;
  for (const m of bgFarMountains) {
    const raw = m.offset + farX;
    const x = ((raw % farWrap) + farWrap) % farWrap - m.width;
    if (x > W + 50 || x + m.width < -50) continue;
    const peak = m.width * (0.5 + m.skew);
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x + peak, baseY - m.height);
    ctx.lineTo(x + m.width, baseY);
    ctx.fill();
    // Snow cap
    ctx.fillStyle = '#E8F4F8';
    ctx.beginPath();
    ctx.moveTo(x + peak, baseY - m.height);
    ctx.lineTo(x + peak - 18, baseY - m.height + 18);
    ctx.lineTo(x + peak + 18, baseY - m.height + 18);
    ctx.fill();
    ctx.fillStyle = '#9BB5A8';
  }

  // Near mountains (medium parallax)
  const nearX = -cam.x * 0.2;
  ctx.fillStyle = '#7A9E7E';
  const nearWrap = bgNearMountains.length * 200;
  for (const m of bgNearMountains) {
    const raw = m.offset + nearX;
    const x = ((raw % nearWrap) + nearWrap) % nearWrap - m.width;
    if (x > W + 50 || x + m.width < -50) continue;
    const peak = m.width * (0.5 + m.skew);
    ctx.beginPath();
    ctx.moveTo(x, baseY + 10);
    ctx.lineTo(x + peak, baseY + 10 - m.height);
    ctx.lineTo(x + m.width, baseY + 10);
    ctx.fill();
  }

  // Pine trees (closer parallax)
  const treeX = -cam.x * 0.3;
  const treeBase = H * 0.53;
  const treeWrap = bgTrees.length * 80;
  for (const t of bgTrees) {
    const raw = t.offset + treeX;
    const x = ((raw % treeWrap) + treeWrap) % treeWrap - 30;
    if (x > W + 30 || x < -30) continue;
    // Trunk
    ctx.fillStyle = '#3D2B1F';
    ctx.fillRect(x - 2, treeBase - t.height * 0.3, 4, t.height * 0.3 + 10);
    // Layered canopy
    ctx.fillStyle = '#1A5E1A';
    for (let layer = 0; layer < 3; layer++) {
      const ly = treeBase - t.height * (0.3 + layer * 0.25);
      const lw = t.width * (1 - layer * 0.2);
      ctx.beginPath();
      ctx.moveTo(x, ly);
      ctx.lineTo(x - lw, ly + t.height * 0.3);
      ctx.lineTo(x + lw, ly + t.height * 0.3);
      ctx.fill();
    }
    // Highlight on one side
    ctx.fillStyle = '#2B7A2B';
    const hy = treeBase - t.height * 0.55;
    ctx.beginPath();
    ctx.moveTo(x, hy);
    ctx.lineTo(x + t.width * 0.7, hy + t.height * 0.25);
    ctx.lineTo(x, hy + t.height * 0.25);
    ctx.fill();
  }
}

function drawTile(tx, ty) {
  const tile = getTile(tx, ty);
  if (tile === T_EMPTY) return;

  const sx = tx * TS - cam.x;
  const sy = ty * TS - cam.y;

  if (tile === T_SOLID) {
    // Check if top face (tile above is empty)
    const topEmpty = getTile(tx, ty - 1) !== T_SOLID;
    ctx.fillStyle = C.ground;
    ctx.fillRect(sx, sy, TS, TS);
    // Grassy top
    if (topEmpty) {
      ctx.fillStyle = C.groundTop;
      ctx.fillRect(sx, sy, TS, 6);
      // Grass blades
      ctx.fillStyle = '#5E9A40';
      for (let i = 2; i < TS - 2; i += 5) {
        ctx.fillRect(sx + i, sy - 2, 2, 4);
      }
    }
    // Rock texture dots
    ctx.fillStyle = '#5A3D1A';
    ctx.fillRect(sx + 6, sy + 10, 4, 3);
    ctx.fillRect(sx + 18, sy + 18, 3, 4);

  } else if (tile === T_PLATFORM) {
    // Wooden log platform
    ctx.fillStyle = C.platform;
    ctx.fillRect(sx, sy + 4, TS, 10);
    ctx.fillStyle = '#6B4E1A';
    ctx.fillRect(sx, sy + 4, TS, 3);
    ctx.fillStyle = '#A0784A';
    ctx.fillRect(sx + 4, sy + 6, 3, 6);
    ctx.fillRect(sx + 14, sy + 6, 3, 6);
    ctx.fillRect(sx + 24, sy + 6, 3, 6);

  } else if (tile === T_WATER) {
    const wave = Math.sin(game.tick * 0.05 + tx * 0.5) * 2;
    ctx.fillStyle = C.water;
    ctx.fillRect(sx, sy, TS, TS);
    ctx.fillStyle = C.waterFoam;
    ctx.fillRect(sx, sy + wave, TS, 4);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx + 4, sy + 8 + wave, TS - 8, 2);
    ctx.globalAlpha = 1;
  }
}

function drawLevel() {
  const startX = Math.max(0, Math.floor(cam.x / TS));
  const endX   = Math.min(level.COLS - 1, Math.ceil((cam.x + W) / TS));
  const startY = Math.max(0, Math.floor(cam.y / TS));
  const endY   = Math.min(level.ROWS - 1, Math.ceil((cam.y + H) / TS));
  for (let ty = startY; ty <= endY; ty++)
    for (let tx = startX; tx <= endX; tx++)
      drawTile(tx, ty);
}

function drawPlayer() {
  if (player.dead) return;
  const sx = Math.round(player.x - cam.x);
  const sy = Math.round(player.y - cam.y);
  const f  = player.facing;

  // Hurt flash
  if (player.hurtTimer > 0 && Math.floor(player.hurtTimer / 6) % 2 === 0) return;

  ctx.save();
  ctx.translate(sx + player.w / 2, sy + player.h);

  const sliding = player.glissading > 0;

  if (sliding) {
    // Lean BACK — classic sit-glissade posture
    ctx.rotate(-f * 0.55);

    // Legs extended forward (in direction of travel)
    ctx.fillStyle = '#5B8C5A';
    ctx.fillRect(f * 4, -10, 7, 12);    // front leg
    ctx.fillRect(f * 4, -10, 7, 12);    // (mirrored close together)
    ctx.fillRect(-2, -10, 7, 12);       // rear leg slightly tucked
    ctx.fillStyle = '#3B2A1A';
    ctx.fillRect(f * 6, -2, 9, 5);      // front boot
    ctx.fillRect(-4, -2, 9, 5);         // rear boot

    // Body / shirt (reclined)
    ctx.fillStyle = '#4A8C6A';
    ctx.fillRect(-9, -24, 18, 14);

    // Backpack (now behind/below due to lean)
    ctx.fillStyle = '#2E5A8E';
    ctx.fillRect(-9 * f - 2 * f, -24, 7, 12);
    ctx.fillStyle = '#1A3A6E';
    ctx.fillRect(-9 * f - 2 * f, -12, 7, 3);

    // Head tilted back
    ctx.fillStyle = '#FDBCB4';
    ctx.beginPath();
    ctx.arc(-f * 3, -32, 9, 0, Math.PI * 2);
    ctx.fill();

    // Sunhat brim
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(-14 - f * 3, -40, 24, 4);
    ctx.fillStyle = '#A07828';
    ctx.fillRect(-9 - f * 3, -50, 14, 11);

    // Eyes
    ctx.fillStyle = '#333';
    ctx.fillRect(-f * 3 + f * 2, -37, 3, 3);

    // Pole digging in behind as brake
    ctx.strokeStyle = '#AAA';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-f * 4, -18);
    ctx.lineTo(-f * 24, 4);
    ctx.stroke();
  } else {
    // Legs – alternate both feet while walking
    const legY = player.onGround ? 0 : -2;
    const isWalking = player.onGround && player.vx !== 0;
    const leftSwing  = isWalking && player.frame === 1 ? 4 : 0;
    const rightSwing = isWalking && player.frame === 0 ? 4 : 0;
    ctx.fillStyle = '#5B8C5A'; // pant color
    ctx.fillRect(-8, legY - 14 + leftSwing, 6, 14);    // left leg
    ctx.fillRect(2,  legY - 14 + rightSwing, 6, 14);    // right leg
    // Boots
    ctx.fillStyle = '#3B2A1A';
    ctx.fillRect(-10, legY - 4 + leftSwing, 8, 5);
    ctx.fillRect(0, legY - 4 + rightSwing, 8, 5);

    // Body / shirt
    ctx.fillStyle = '#4A8C6A';
    ctx.fillRect(-9, -28, 18, 16);

    // Backpack (tiny ultralight pack!)
    ctx.fillStyle = '#2E5A8E';
    ctx.fillRect(-9 * f - 2 * f, -28, 7, 14);
    // Pack hip belt
    ctx.fillStyle = '#1A3A6E';
    ctx.fillRect(-9 * f - 2 * f, -14, 7, 3);

    // Head
    ctx.fillStyle = '#FDBCB4';
    ctx.beginPath();
    ctx.arc(0, -36, 9, 0, Math.PI * 2);
    ctx.fill();

    // Sunhat brim
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(-12, -44, 24, 4);
    // Hat top
    ctx.fillStyle = '#A07828';
    ctx.fillRect(-7, -54, 14, 11);

    // Eyes
    ctx.fillStyle = '#333';
    ctx.fillRect(2 * f, -39, 3, 3);
  }

  // Trekking poles (airborne or walking) — only when not sliding
  if (!sliding && !player.onGround) {
    // Pole pointing down in air
    ctx.strokeStyle = '#AAA';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(f * 8, -10);
    ctx.lineTo(f * 12, 6);
    ctx.stroke();
  } else if (!sliding) {
    // Poles held to side while walking/standing
    ctx.strokeStyle = '#AAA';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(f * 8, -22);
    ctx.lineTo(f * 18, 0);
    ctx.stroke();
  }

  // Bear spray effect
  if (player.sprayTimer > 0) {
    ctx.globalAlpha = 0.6;
    const spx = (player.facing > 0 ? 12 : -120);
    const grad = ctx.createLinearGradient(spx, 0, spx + 110 * player.facing, 0);
    grad.addColorStop(0, '#ff8800');
    grad.addColorStop(1, 'rgba(255,136,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(spx, -8, 110 * player.facing, 18);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawMarmot(e) {
  const sx = Math.round(e.x - cam.x);
  const sy = Math.round(e.y - cam.y);
  const stunned = e.stunTimer > 0;
  ctx.save();
  ctx.translate(sx + e.w / 2, sy + e.h);

  if (stunned) {
    ctx.globalAlpha = 0.6 + Math.sin(game.tick * 0.3) * 0.3;
  }

  // Body
  ctx.fillStyle = stunned ? '#FFD700' : '#8B6914';
  ctx.beginPath();
  ctx.ellipse(0, -10, 13, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = stunned ? '#FFD700' : '#A07828';
  ctx.beginPath();
  ctx.arc(0, -22, 8, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.fillStyle = '#7A5810';
  ctx.beginPath();
  ctx.arc(-6, -28, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(6, -28, 4, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#111';
  ctx.fillRect(-3, -25, 3, 3);
  ctx.fillRect(1, -25, 3, 3);
  if (stunned) {
    // Dizzy X eyes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-4, -26); ctx.lineTo(-1, -23); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-1, -26); ctx.lineTo(-4, -23); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1, -26); ctx.lineTo(4, -23); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, -26); ctx.lineTo(1, -23); ctx.stroke();
  }

  // Feet
  ctx.fillStyle = '#6A4810';
  ctx.fillRect(-10, -2, 8, 4);
  ctx.fillRect(2,   -2 + (e.frame ? 2 : 0), 8, 4);

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawMouse(e) {
  const sx = Math.round(e.x - cam.x);
  const sy = Math.round(e.y - cam.y);
  const stunned = e.stunTimer > 0;
  ctx.save();
  ctx.translate(sx + e.w / 2, sy + e.h);

  if (stunned) {
    ctx.globalAlpha = 0.6 + Math.sin(game.tick * 0.3) * 0.3;
  }

  // Body (small oval)
  ctx.fillStyle = stunned ? '#FFD700' : '#888';
  ctx.beginPath();
  ctx.ellipse(0, -6, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = stunned ? '#FFD700' : '#999';
  ctx.beginPath();
  ctx.arc(e.vx > 0 ? 6 : -6, -8, 4, 0, Math.PI * 2);
  ctx.fill();

  // Ears (round)
  ctx.fillStyle = '#C8A';
  const headX = e.vx > 0 ? 6 : -6;
  ctx.beginPath();
  ctx.arc(headX - 2, -12, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(headX + 2, -12, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#111';
  ctx.fillRect(headX + (e.vx > 0 ? 1 : -3), -9, 2, 2);
  if (stunned) {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(headX - 1, -10); ctx.lineTo(headX + 1, -8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(headX + 1, -10); ctx.lineTo(headX - 1, -8); ctx.stroke();
  }

  // Tail (thin curve)
  ctx.strokeStyle = stunned ? '#FFD700' : '#777';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const tailDir = e.vx > 0 ? -1 : 1;
  ctx.moveTo(tailDir * 7, -5);
  ctx.quadraticCurveTo(tailDir * 12, -10, tailDir * 10, -14);
  ctx.stroke();

  // Feet
  ctx.fillStyle = '#C8A';
  ctx.fillRect(-5, -2, 3, 2);
  ctx.fillRect(2, -2 + (e.frame ? 1 : 0), 3, 2);

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawMosquito(e) {
  const sx = Math.round(e.x - cam.x);
  const sy = Math.round(e.y - cam.y);
  const stunned = e.stunTimer > 0;
  ctx.save();
  ctx.translate(sx + e.w / 2, sy + e.h / 2);

  ctx.globalAlpha = stunned ? 0.5 : 1;

  // Wings (animated)
  const wingFlap = Math.sin(game.tick * 0.4) * 4;
  ctx.fillStyle = 'rgba(180,220,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(-10, -6 + wingFlap, 9, 5, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(10, -6 + wingFlap, 9, 5, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = stunned ? '#FFD700' : '#555';
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = '#444';
  ctx.beginPath();
  ctx.arc(0, -10, 5, 0, Math.PI * 2);
  ctx.fill();

  // Proboscis
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(0, -22);
  ctx.stroke();

  // Eyes (red)
  ctx.fillStyle = '#CC0000';
  ctx.fillRect(-4, -12, 3, 3);
  ctx.fillRect(2, -12, 3, 3);

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawHiker(e) {
  const sx = Math.round(e.x - cam.x);
  const sy = Math.round(e.y - cam.y);
  const stunned = e.stunTimer > 0;
  const f = e.vx > 0 ? 1 : -1;
  ctx.save();
  ctx.translate(sx + e.w / 2, sy + e.h);

  ctx.globalAlpha = stunned ? 0.6 : 1;

  // Legs
  const legSwing = e.frame ? 5 : 0;
  ctx.fillStyle = '#4A3A2A';
  ctx.fillRect(-7, -16, 6, 16);
  ctx.fillRect(1, -16 + legSwing, 6, 16);

  // Body
  ctx.fillStyle = stunned ? '#FFD700' : '#8B3A3A';
  ctx.fillRect(-8, -32, 16, 18);

  // GIANT pack (the joke - very heavy pack)
  ctx.fillStyle = '#5A3A7A';
  ctx.fillRect(-8 * f - 3 * f, -34, 10, 24);
  // Multiple gear attachments on pack
  ctx.fillStyle = '#888';
  ctx.fillRect(-8 * f - 2 * f, -30, 4, 4); // pot
  ctx.fillStyle = '#C84';
  ctx.fillRect(-8 * f - 2 * f, -22, 4, 4); // stuff sack
  ctx.fillStyle = '#4C8';
  ctx.fillRect(-8 * f - 2 * f, -14, 4, 4); // another pouch

  // Head (red, tired)
  ctx.fillStyle = '#CC8866';
  ctx.beginPath();
  ctx.arc(0, -40, 9, 0, Math.PI * 2);
  ctx.fill();

  // Hat (big floppy sun hat)
  ctx.fillStyle = '#8B8B00';
  ctx.fillRect(-14, -47, 28, 4);
  ctx.fillRect(-9, -56, 18, 10);

  // Eyes (annoyed)
  ctx.fillStyle = '#333';
  ctx.fillRect(-4, -43, 3, 2);
  ctx.fillRect(2, -43, 3, 2);
  // Sweat drops
  if (!stunned) {
    ctx.fillStyle = '#88CCFF';
    ctx.fillRect(f * 10, -44, 3, 4);
    ctx.fillRect(f * 13, -40, 2, 3);
  }

  // Trekking poles (lots of them!)
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(f * 9, -30);
  ctx.lineTo(f * 14, 0);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawItemIcon(type, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1.44, 1.44);

  if (type === 'spork') {
    // Spork: spoon bowl with tines at the top edge
    // Handle
    ctx.fillStyle = '#D0D0D0';
    ctx.fillRect(-1.5, 2, 3, 10);
    ctx.fillStyle = '#E8E8E8';
    ctx.fillRect(-0.5, 3, 1.5, 8);
    // Spoon bowl
    ctx.fillStyle = '#E0E0E0';
    ctx.beginPath();
    ctx.ellipse(0, -2, 7, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Inner bowl shading
    ctx.fillStyle = '#CCC';
    ctx.beginPath();
    ctx.ellipse(1, -1, 4.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tines (3 short notches at the top of the bowl)
    ctx.fillStyle = '#E0E0E0';
    ctx.fillRect(-5, -9, 2, 4);
    ctx.fillRect(-1, -10, 2, 4);
    ctx.fillRect(3, -9, 2, 4);
    // Notch gaps between tines
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(-3, -8, 1.5, 3);
    ctx.fillRect(1.5, -8, 1.5, 3);
    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(-4, -5, 1.5, 5);

  } else if (type === 'bar') {
    // Protein bar with torn wrapper
    // Outer wrapper
    ctx.fillStyle = '#7A4A1B';
    roundRect(-10, -6, 20, 13, 2);
    // Inner wrapper
    ctx.fillStyle = '#8B5A2B';
    roundRect(-9, -5, 18, 11, 1);
    // Gold stripe
    ctx.fillStyle = '#D4A045';
    ctx.fillRect(-9, -2, 18, 4);
    // "TRAIL" text dots
    ctx.fillStyle = '#FFF';
    ctx.fillRect(-7, -1, 1, 2);
    ctx.fillRect(-4, -1, 1, 2);
    ctx.fillRect(-1, -1, 2, 2);
    ctx.fillRect(3, -1, 1, 2);
    ctx.fillRect(6, -1, 1, 2);
    // Wrapper edges
    ctx.fillStyle = '#6B3A1B';
    ctx.fillRect(-10, -6, 2, 13);
    ctx.fillRect(8, -6, 2, 13);
    // Torn foil peek
    ctx.fillStyle = '#C0B090';
    ctx.fillRect(-10, -3, 2, 4);

  } else if (type === 'filter') {
    // Water filter bottle with squeeze pump
    // Bottle body
    ctx.fillStyle = '#2255CC';
    roundRect(-5, -1, 10, 14, 3);
    // Highlight
    ctx.fillStyle = '#3377EE';
    roundRect(-4, 0, 6, 11, 2);
    // Base ring
    ctx.fillStyle = '#1144AA';
    roundRect(-5, 10, 10, 3, 1);
    // Neck
    ctx.fillStyle = '#2255CC';
    ctx.fillRect(-3, -5, 6, 5);
    // Cap
    ctx.fillStyle = '#44AA44';
    roundRect(-4, -7, 8, 3, 1);
    // Pump tube
    ctx.fillStyle = '#88BBFF';
    ctx.fillRect(-1, -12, 2, 6);
    // Pump handle
    ctx.fillStyle = '#DDD';
    roundRect(-4, -14, 8, 3, 1);
    // Water drops
    ctx.fillStyle = 'rgba(150,200,255,0.8)';
    ctx.beginPath();
    ctx.arc(-2, 5, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(1, 8, 1, 0, Math.PI * 2);
    ctx.fill();

  } else if (type === 'tent') {
    // Ultralight tent with guy lines and vestibule
    // Main body
    ctx.fillStyle = '#C8960F';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(-12, 8);
    ctx.lineTo(12, 8);
    ctx.fill();
    // Shadow side
    ctx.fillStyle = '#A07808';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(0, 8);
    ctx.lineTo(12, 8);
    ctx.fill();
    // Ridge line highlight
    ctx.strokeStyle = '#E8C840';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(0, 8);
    ctx.stroke();
    // Door
    ctx.fillStyle = '#E8B830';
    ctx.beginPath();
    ctx.moveTo(-3, 8);
    ctx.quadraticCurveTo(0, -1, 3, 8);
    ctx.fill();
    // Door mesh
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-1, 8); ctx.lineTo(0, 1); ctx.moveTo(1, 8); ctx.lineTo(0, 1);
    ctx.stroke();
    // Guy lines and stakes
    ctx.strokeStyle = '#AAA';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-12, 8); ctx.lineTo(-15, 11);
    ctx.moveTo(12, 8); ctx.lineTo(15, 11);
    ctx.moveTo(0, -12); ctx.lineTo(-4, -15);
    ctx.moveTo(0, -12); ctx.lineTo(4, -15);
    ctx.stroke();

  } else if (type === 'spray') {
    // Bear spray canister with safety clip
    // Main canister
    ctx.fillStyle = '#DD3300';
    roundRect(-5, -4, 10, 16, 3);
    // Highlight
    ctx.fillStyle = '#FF5500';
    roundRect(-4, -3, 6, 13, 2);
    // Bear silhouette label area
    ctx.fillStyle = '#FFF';
    roundRect(-4, 2, 8, 5, 1);
    // Bear icon on label
    ctx.fillStyle = '#DD3300';
    ctx.beginPath();
    ctx.arc(0, 4, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-1, 5, 2, 1.5);
    // Top cap
    ctx.fillStyle = '#333';
    roundRect(-4, -8, 8, 5, 2);
    // Nozzle
    ctx.fillStyle = '#555';
    ctx.fillRect(-2, -12, 4, 5);
    // Safety trigger
    ctx.fillStyle = '#FF8800';
    roundRect(-3, -13, 6, 2, 1);
    // Safety clip
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(4, -10);
    ctx.lineTo(6, -12);
    ctx.lineTo(6, -8);
    ctx.stroke();
  }

  ctx.restore();
}

// Helper for rounded rectangles in item icons
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.fill();
}

function drawItems() {
  const t = game.tick * 0.05;
  items.forEach(item => {
    if (item.collected) return;
    const sx = item.x - cam.x;
    const sy = item.y - cam.y + Math.sin(t + item.bobOffset) * 4;
    const def = ITEM_DEFS[item.type];

    // Glow around the icon itself
    ctx.save();
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 12;
    drawItemIcon(item.type, sx + 10, sy + 10);
    ctx.restore();
  });
}

function drawGoalFlag() {
  const def = LEVELS[game.levelNum];
  const fx = def.goalTile[0] * TS - cam.x;
  const fy = def.goalFlagY * TS - cam.y;

  // Pole
  ctx.fillStyle = '#CCC';
  ctx.fillRect(fx, fy, 4, 48);

  // Flag (waving)
  const wave = Math.sin(game.tick * 0.08);
  ctx.fillStyle = '#FF4444';
  ctx.beginPath();
  ctx.moveTo(fx + 4, fy);
  ctx.lineTo(fx + 4 + 24 + wave * 4, fy + 8);
  ctx.lineTo(fx + 4, fy + 18);
  ctx.fill();

  // Goal marker text
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 10px Courier New';
  ctx.textAlign = 'center';
  const isLastLevel = game.levelNum === LEVELS.length - 1;
  ctx.fillText(isLastLevel ? 'SUMMIT' : 'GOAL', fx + 14, fy - 8);
}

function drawHUD() {
  // HUD background
  ctx.fillStyle = 'rgba(20,40,20,0.75)';
  ctx.fillRect(0, 0, W, 36);

  // Lives (boot icons)
  ctx.fillStyle = '#AAF';
  ctx.font = 'bold 13px Courier New';
  ctx.textAlign = 'left';
  ctx.fillText('LIVES:', 8, 22);
  for (let i = 0; i < player.lives; i++) {
    ctx.fillStyle = i < player.lives ? '#88FF88' : '#444';
    ctx.fillRect(64 + i * 18, 8, 14, 20);
  }

  // Health (water drops)
  ctx.fillStyle = '#AAF';
  ctx.fillText('H2O:', 160, 22);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < player.health ? '#4169E1' : '#333';
    ctx.beginPath();
    ctx.arc(210 + i * 20, 18, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Level name
  ctx.fillStyle = '#AADDFF';
  ctx.font = '10px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText(LEVELS[game.levelNum].name.toUpperCase(), W / 2, 13);

  // Score
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 14px Courier New';
  ctx.fillText(`SCORE: ${player.score}`, W / 2, 28);

  // Trail progress bar
  const progress = clamp(player.x / (level.COLS * TS), 0, 1);
  ctx.fillStyle = '#333';
  ctx.fillRect(W - 180, 8, 170, 12);
  ctx.fillStyle = '#4E7D3A';
  ctx.fillRect(W - 180, 8, 170 * progress, 12);
  ctx.fillStyle = '#88FF88';
  ctx.font = '10px Courier New';
  ctx.textAlign = 'right';
  ctx.fillText(`TRAIL ${Math.floor(progress * 100)}%`, W - 8, 24);

  // Bear spray indicator
  if (player.sprayCooldown > 0) {
    ctx.fillStyle = 'rgba(20,40,20,0.75)';
    ctx.fillRect(8, 40, 80, 16);
    ctx.fillStyle = '#FF8800';
    ctx.fillRect(10, 42, 76 * (1 - player.sprayCooldown / 60), 12);
    ctx.fillStyle = '#FFF';
    ctx.font = '9px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('SPRAY', 12, 52);
  }

  // Glissade cooldown indicator
  if (player.glissadeCooldown > 0) {
    const gx = player.sprayCooldown > 0 ? 96 : 8;
    ctx.fillStyle = 'rgba(20,40,20,0.75)';
    ctx.fillRect(gx, 40, 86, 16);
    ctx.fillStyle = '#88AAEE';
    ctx.fillRect(gx + 2, 42, 82 * (1 - player.glissadeCooldown / GLISSADE_COOLDOWN), 12);
    ctx.fillStyle = '#FFF';
    ctx.font = '9px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('GLISSADE', gx + 4, 52);
  }
}

function drawFloatTexts() {
  floatTexts.forEach(f => {
    ctx.globalAlpha = f.life;
    ctx.fillStyle = f.color;
    ctx.font = 'bold 14px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(f.str, f.x - cam.x, f.y - cam.y);
  });
  ctx.globalAlpha = 1;
}

// ==================== SCREENS ====================
function drawEnterInitials() {
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 36px Courier New';
  ctx.fillText('NEW HIGH SCORE!', W / 2, H / 2 - 90);

  ctx.fillStyle = '#88DDFF';
  ctx.font = 'bold 28px Courier New';
  ctx.fillText(pendingScore.toString(), W / 2, H / 2 - 50);

  ctx.fillStyle = '#FFF';
  ctx.font = '18px Courier New';
  ctx.fillText('ENTER YOUR INITIALS', W / 2, H / 2 - 10);

  // Draw 3 boxes for initials
  const boxW = 50, boxH = 60, gap = 15;
  const startX = W / 2 - (boxW * 3 + gap * 2) / 2;
  for (let i = 0; i < 3; i++) {
    const bx = startX + i * (boxW + gap);
    const by = H / 2 + 10;

    ctx.strokeStyle = i === initialsInput.length ? '#FFD700' : '#555';
    ctx.lineWidth = i === initialsInput.length ? 3 : 2;
    ctx.strokeRect(bx, by, boxW, boxH);

    if (initialsInput[i]) {
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 40px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(initialsInput[i], bx + boxW / 2, by + boxH - 12);
    } else if (i === initialsInput.length && Math.floor(game.tick / 20) % 2 === 0) {
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(bx + 15, by + boxH - 15, 20, 3);
    }
  }

  ctx.textAlign = 'center';
  if (initialsSubmitted) {
    ctx.fillStyle = '#88FF88';
    ctx.font = 'bold 20px Courier New';
    ctx.fillText('SCORE SUBMITTED!', W / 2, H / 2 + 110);
  } else if (initialsInput.length === 3 && Math.floor(game.tick / 30) % 2 === 0) {
    ctx.fillStyle = '#88FF88';
    ctx.font = 'bold 16px Courier New';
    ctx.fillText('PRESS ENTER TO SUBMIT', W / 2, H / 2 + 110);
  }
}

function drawMenu() {
  // Scale the title screen into a fixed 800×480 logical space so all content fits
  // any viewport. Black letterbox bars fill gaps when aspect ratio differs.
  const LOGI_W = 800, LOGI_H = 480;
  const scale = Math.min(W / LOGI_W, H / LOGI_H);
  const ox = (W - LOGI_W * scale) / 2;
  const oy = (H - LOGI_H * scale) / 2;

  // Letterbox fill
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, LOGI_H);
  grad.addColorStop(0, '#2B4F6A');
  grad.addColorStop(1, '#1A2E3A');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, LOGI_W, LOGI_H);

  // Mountains
  ctx.fillStyle = '#3A6A5A';
  for (let i = 0; i * 200 - 50 < LOGI_W + 200; i++) {
    const bx = i * 200 - 50;
    const bh = 120 + i * 20;
    ctx.beginPath();
    ctx.moveTo(bx, LOGI_H * 0.7);
    ctx.lineTo(bx + 100, LOGI_H * 0.7 - bh);
    ctx.lineTo(bx + 200, LOGI_H * 0.7);
    ctx.fill();
    ctx.fillStyle = '#D0E8F0';
    ctx.beginPath();
    ctx.moveTo(bx + 100, LOGI_H * 0.7 - bh);
    ctx.lineTo(bx + 82, LOGI_H * 0.7 - bh + 28);
    ctx.lineTo(bx + 118, LOGI_H * 0.7 - bh + 28);
    ctx.fill();
    ctx.fillStyle = '#3A6A5A';
  }

  // Title
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 52px Courier New';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#AA8800';
  ctx.shadowBlur = 10;
  ctx.fillText('TRAIL BLAZER', LOGI_W / 2, 120);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#88DDFF';
  ctx.font = 'bold 20px Courier New';
  ctx.fillText('An Ultralight Backpacking Adventure', LOGI_W / 2, 160);

  ctx.fillStyle = '#4E7D3A';
  ctx.font = '13px Courier New';
  ctx.fillText(LEVELS.length + ' trails to conquer \u2014 reach the summit!', LOGI_W / 2, 195);

  // Blinking start
  if (Math.floor(game.tick / 30) % 2 === 0) {
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 22px Courier New';
    ctx.fillText('TAP  OR  PRESS  SPACE  TO  START', LOGI_W / 2, 240);
  }

  // Arcade attract: flip between controls and leaderboard every 5 seconds (300 ticks)
  const ATTRACT_FLIP = 300;
  const hasLeaderboard = leaderboardLoaded && leaderboard.length > 0;
  const showLeaderboard = hasLeaderboard && Math.floor(game.tick / ATTRACT_FLIP) % 2 === 1;

  // Panel header with indicator dots
  const panelY = 256;
  if (hasLeaderboard) {
    const dotY = panelY - 4;
    [0, 1].forEach(idx => {
      const active = (showLeaderboard ? 1 : 0) === idx;
      ctx.beginPath();
      ctx.arc(LOGI_W / 2 - 8 + idx * 16, dotY, active ? 4 : 3, 0, Math.PI * 2);
      ctx.fillStyle = active ? '#FFD700' : '#445566';
      ctx.fill();
    });
  }

  if (showLeaderboard) {
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 14px Courier New';
    ctx.fillText('TOP  TRAIL  BLAZERS', LOGI_W / 2, panelY + 18);

    ctx.font = '12px Courier New';
    const rowHeight = 16;
    const firstRowY = panelY + 44;

    leaderboard.forEach((entry, i) => {
      const rank = (i + 1).toString().padStart(2, ' ');
      const name = (entry.name || '???').toUpperCase().slice(0, 8).padEnd(8, ' ');
      const score = entry.score.toString().padStart(7, ' ');
      ctx.fillStyle = i === 0 ? '#FFD700' : (i < 3 ? '#C0C0C0' : '#8BC48B');
      ctx.fillText(`${rank}. ${name} ${score}`, LOGI_W / 2, firstRowY + i * rowHeight);
    });
  } else {
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 14px Courier New';
    ctx.fillText('HOW  TO  PLAY', LOGI_W / 2, panelY + 18);

    ctx.fillStyle = '#8BC48B';
    ctx.font = '13px Courier New';
    const controls = [
      '\u2190 \u2192 / A D   :  Move',
      '\u2191 / W / Z / SPACE  :  Jump',
      '\u2193 + Move  :  Glissade (slide & stun)',
      'X  :  Bear Spray (stun enemies)',
      'Stomp stunned enemies to score!',
    ];
    controls.forEach((line, i) => {
      ctx.fillText(line, LOGI_W / 2, panelY + 44 + i * 22);
    });
  }

  // High score
  if (game.hiScore > 0) {
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 14px Courier New';
    ctx.fillText(`HI SCORE: ${game.hiScore}`, LOGI_W / 2, LOGI_H - 20);
  }

  ctx.restore();
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#FF4444';
  ctx.font = 'bold 56px Courier New';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#880000';
  ctx.shadowBlur = 12;
  ctx.fillText('TRAIL FAILED', W / 2, H / 2 - 40);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 22px Courier New';
  ctx.fillText(`Final Score: ${player.score}`, W / 2, H / 2 + 20);

  ctx.fillStyle = '#88FF88';
  ctx.font = '16px Courier New';
  ctx.fillText('Your pack was too heavy and your will too light...', W / 2, H / 2 + 60);

  if (Math.floor(game.tick / 30) % 2 === 0) {
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 18px Courier New';
    ctx.fillText('TAP  OR  PRESS  SPACE  TO  TRY  AGAIN', W / 2, H / 2 + 110);
  }
}

function drawLevelComplete() {
  ctx.fillStyle = 'rgba(0,20,0,0.75)';
  ctx.fillRect(0, 0, W, H);

  const def = LEVELS[game.levelNum];
  const nextDef = LEVELS[game.levelNum + 1];

  ctx.fillStyle = '#88FF88';
  ctx.font = 'bold 48px Courier New';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#44AA44';
  ctx.shadowBlur = 12;
  ctx.fillText('TRAIL CLEARED!', W / 2, H / 2 - 70);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 22px Courier New';
  ctx.fillText(def.name, W / 2, H / 2 - 25);

  ctx.fillStyle = '#88DDFF';
  ctx.font = '16px Courier New';
  ctx.fillText(`Score: ${player.score}`, W / 2, H / 2 + 15);
  ctx.fillText('Gear: ' + items.filter(i => i.collected).length + ' / ' + items.length, W / 2, H / 2 + 40);

  let awardY = H / 2 + 62;
  if (game.leaveNoTrace[game.levelNum]) {
    ctx.fillStyle = '#44ffaa';
    ctx.font = 'bold 16px Courier New';
    ctx.fillText('LEAVE NO TRACE +1000', W / 2, awardY);
    awardY += 22;
  }
  if (game.trailAngel[game.levelNum]) {
    ctx.fillStyle = '#ff88ff';
    ctx.font = 'bold 16px Courier New';
    ctx.fillText('TRAIL ANGEL +1500', W / 2, awardY);
    awardY += 22;
  }

  if (nextDef) {
    ctx.fillStyle = '#AAAAFF';
    ctx.font = '14px Courier New';
    ctx.fillText('Next: ' + nextDef.name + ' \u2014 ' + nextDef.subtitle, W / 2, awardY + 4);
  }

  if (Math.floor(game.tick / 30) % 2 === 0) {
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 18px Courier New';
    ctx.fillText('TAP  OR  PRESS  SPACE  TO  CONTINUE', W / 2, H / 2 + 125);
  }
}

function drawWin() {
  ctx.fillStyle = 'rgba(0,20,0,0.7)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 52px Courier New';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#AA8800';
  ctx.shadowBlur = 12;
  ctx.fillText('SUMMIT!', W / 2, H / 2 - 80);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#88FF88';
  ctx.font = 'bold 22px Courier New';
  ctx.fillText('You conquered all ' + LEVELS.length + ' trails!', W / 2, H / 2 - 30);

  ctx.fillStyle = '#88DDFF';
  ctx.font = '16px Courier New';
  ctx.fillText(`Final Score: ${player.score}`, W / 2, H / 2 + 10);

  ctx.font = '14px Courier New';
  LEVELS.forEach((l, i) => {
    const lnt = game.leaveNoTrace[i];
    const ta = game.trailAngel[i];
    const awards = [];
    if (lnt) awards.push('Leave No Trace');
    if (ta) awards.push('Trail Angel');
    const suffix = awards.length ? '  -  ' + awards.join(', ') + '!' : '';
    ctx.fillStyle = (lnt || ta) ? '#44ffaa' : '#AAAAFF';
    ctx.fillText((i + 1) + '. ' + l.name + suffix, W / 2, H / 2 + 40 + i * 20);
  });

  // Stars
  for (let i = 0; i < 30; i++) {
    const sx = (Math.sin(i * 137.5) * 0.5 + 0.5) * W;
    const sy = (Math.cos(i * 137.5) * 0.5 + 0.5) * H * 0.8;
    const r = 2 + Math.sin(game.tick * 0.1 + i) * 2;
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (Math.floor(game.tick / 30) % 2 === 0) {
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 18px Courier New';
    ctx.fillText('TAP  OR  PRESS  SPACE  FOR  NEW  ADVENTURE', W / 2, H / 2 + 130);
  }
}

// ==================== MAIN LOOP ====================
function update() {
  game.tick++;

  if (game.state === 'menu') {
    if (jp('Space') || jp('KeyZ') || jp('ArrowUp') || jp('KeyW')) {
      initGame();
    }

  } else if (game.state === 'playing') {
    updatePlayer();
    enemies.forEach(updateEnemy);
    updateParticles();
    updateFloatTexts();
    updateCamera(player.x, player.y);

  } else if (game.state === 'gameover') {
    if (game.hiScore < player.score) { game.hiScore = player.score; saveHiScore(); }
    if (jp('Space') || jp('KeyZ')) {
      if (qualifiesForLeaderboard(player.score)) {
        pendingScore = player.score;
        initialsInput = '';
        initialsSubmitted = false;
        game.state = 'enterInitials';
      } else {
        game.state = 'menu';
      }
    }

  } else if (game.state === 'levelcomplete') {
    game.levelTick++;
    if (game.hiScore < player.score) { game.hiScore = player.score; saveHiScore(); }
    if (jp('Space') || jp('KeyZ')) {
      advanceLevel();
    }

  } else if (game.state === 'win') {
    if (game.hiScore < player.score) { game.hiScore = player.score; saveHiScore(); }
    if (jp('Space') || jp('KeyZ')) {
      if (qualifiesForLeaderboard(player.score)) {
        pendingScore = player.score;
        initialsInput = '';
        initialsSubmitted = false;
        game.state = 'enterInitials';
      } else {
        game.state = 'menu';
      }
    }

  } else if (game.state === 'enterInitials') {
    // handled by keydown listener
  }

  syncPrev();
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  if (game.state === 'menu') {
    drawMenu();
    return;
  }
  if (game.state === 'enterInitials') {
    drawEnterInitials();
    return;
  }
  if (game.state === 'gameover') {
    // Draw game behind
    drawBackground();
    drawLevel();
    drawItems();
    drawGoalFlag();
    enemies.forEach(e => {
      if (!e.alive) return;
      if (e.type === 'marmot') drawMarmot(e);
      else if (e.type === 'mouse') drawMouse(e);
      else if (e.type === 'mosquito') drawMosquito(e);
      else if (e.type === 'hiker') drawHiker(e);
    });
    drawPlayer();
    drawParticles();
    drawFloatTexts();
    drawHUD();
    drawGameOver();
    return;
  }
  if (game.state === 'levelcomplete') {
    drawBackground();
    drawLevel();
    drawGoalFlag();
    drawLevelComplete();
    return;
  }
  if (game.state === 'win') {
    drawBackground();
    drawLevel();
    drawGoalFlag();
    drawWin();
    return;
  }

  // Playing
  drawBackground();
  drawLevel();
  drawItems();
  drawGoalFlag();
  enemies.forEach(e => {
    if (!e.alive) return;
    if (e.type === 'marmot') drawMarmot(e);
    else if (e.type === 'mouse') drawMouse(e);
    else if (e.type === 'mosquito') drawMosquito(e);
    else if (e.type === 'hiker') drawHiker(e);
  });
  drawPlayer();
  drawParticles();
  drawFloatTexts();
  drawHUD();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// ==================== TOUCH CONTROLS ====================
function setupTouch() {
  // Tap the canvas itself to advance menu / gameover / win screens
  canvas.addEventListener('touchstart', e => {
    if (game.state !== 'playing' && game.state !== 'enterInitials') {
      e.preventDefault();
      keys['Space'] = true;
      setTimeout(() => { keys['Space'] = false; }, 100);
    } else if (game.state === 'enterInitials' && !initialsSubmitted) {
      // On mobile, use prompt for initials
      e.preventDefault();
      const name = prompt('Enter 3-letter initials:');
      if (name && name.trim().length > 0) {
        initialsInput = name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'A');
        initialsSubmitted = true;
        submitScore(initialsInput, pendingScore);
        setTimeout(() => { game.state = 'menu'; }, 1500);
      } else {
        game.state = 'menu';
      }
    }
  }, { passive: false });

  const bindings = {
    'btn-left':  'ArrowLeft',
    'btn-right': 'ArrowRight',
    'btn-down':  'ArrowDown',
    'btn-jump':  'Space',
    'btn-spray': 'KeyX',
  };

  Object.entries(bindings).forEach(([id, code]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const press   = e => { e.preventDefault(); keys[code] = true; };
    const release = e => { e.preventDefault(); keys[code] = false; };
    el.addEventListener('touchstart',  press,   { passive: false });
    el.addEventListener('touchend',    release, { passive: false });
    el.addEventListener('touchcancel', release, { passive: false });
  });

  // Glissade button — hold down while pressing a direction to slide
  const slideEl = document.getElementById('btn-down');
  if (slideEl) {
    slideEl.addEventListener('touchstart',  e => { e.preventDefault(); keys['ArrowDown'] = true; },  { passive: false });
    slideEl.addEventListener('touchend',    e => { e.preventDefault(); keys['ArrowDown'] = false; }, { passive: false });
    slideEl.addEventListener('touchcancel', e => { e.preventDefault(); keys['ArrowDown'] = false; }, { passive: false });
  }
}

// ==================== INITIALS INPUT ====================
addEventListener('keydown', e => {
  if (game.state !== 'enterInitials' || initialsSubmitted) return;

  if (e.code === 'Backspace') {
    initialsInput = initialsInput.slice(0, -1);
    e.preventDefault();
    return;
  }

  if ((e.code === 'Enter' || e.code === 'Space') && initialsInput.length === 3) {
    initialsSubmitted = true;
    submitScore(initialsInput, pendingScore);
    setTimeout(() => { game.state = 'menu'; }, 1500);
    e.preventDefault();
    return;
  }

  const match = e.code.match(/^Key([A-Z])$/);
  if (match && initialsInput.length < 3) {
    initialsInput += match[1];
    e.preventDefault();
  }
});

// ==================== BOOT ====================
setupTouch();
fetchLeaderboard();
requestAnimationFrame(loop);

})();
