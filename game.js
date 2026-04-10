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
    // Use visualViewport dimensions which match 100dvh/100dvw — the actual visible
    // area excluding Android/iOS browser chrome (address bar, nav bar). This keeps
    // the canvas logical size in sync with the CSS dvh sizing so content isn't clipped.
    const vp = window.visualViewport;
    const vh = vp ? vp.height : window.innerHeight;
    const vw = vp ? vp.width : window.innerWidth;
    H = Math.min(480, Math.round(vh));
    W = Math.round(vw);
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
  audio.init();
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
  // ======== LEVEL 1: NORTHERN TERMINUS ========
  {
    name: 'Northern Terminus',
    subtitle: 'SOBO day one — Monument 78 into the North Cascades',
    section: 'PCT Washington: Monument 78 \u2192 Harts Pass',
    campName: 'Harts Pass Camp',
    goalTile: [117, 2],
    goalFlagY: 4,
    spawnTile: [2, 9],
    build() {
      const COLS = 120, ROWS = 15;
      const { map, set, hline, fill } = makeMap(COLS, ROWS);
      fill(0, 11, COLS - 1, 14, T_SOLID);
      for (let y = 0; y < ROWS; y++) set(0, y, T_SOLID);
      // TRAILHEAD
      fill(8, 9, 11, 10, T_SOLID);
      fill(14, 8, 16, 10, T_SOLID);
      hline(18, 23, 8, T_PLATFORM);
      // FIRST CREEK
      fill(24, 11, 31, 11, T_EMPTY); fill(24, 12, 31, 13, T_WATER);
      hline(25, 26, 9, T_SOLID); hline(28, 29, 8, T_SOLID); hline(30, 31, 9, T_SOLID);
      // FOREST PLATFORMS
      fill(34, 9, 37, 10, T_SOLID);
      hline(38, 43, 8, T_PLATFORM); hline(43, 48, 6, T_PLATFORM);
      fill(47, 7, 50, 10, T_SOLID);
      hline(51, 56, 8, T_PLATFORM); hline(56, 61, 6, T_PLATFORM);
      // SECOND CREEK
      fill(62, 11, 70, 11, T_EMPTY); fill(62, 12, 70, 13, T_WATER);
      hline(63, 64, 9, T_SOLID); hline(66, 67, 8, T_PLATFORM); hline(69, 70, 9, T_SOLID);
      // ROCKY CLIMB
      fill(72, 9, 75, 10, T_SOLID); fill(77, 8, 80, 10, T_SOLID);
      hline(79, 84, 6, T_PLATFORM);
      fill(83, 7, 86, 10, T_SOLID);
      hline(86, 91, 5, T_PLATFORM); hline(90, 95, 7, T_PLATFORM);
      // FINAL RIDGE
      fill(97, 9, 100, 10, T_SOLID);
      hline(99, 104, 7, T_PLATFORM);
      fill(102, 8, 105, 10, T_SOLID);
      hline(105, 110, 5, T_PLATFORM); hline(109, 114, 7, T_PLATFORM);
      hline(113, 116, 6, T_PLATFORM);
      fill(116, 4, 119, 14, T_SOLID);
      return { map, COLS, ROWS };
    },
    spawnEnemies() {
      return [
        makeMarmot(11,8), makeMarmot(40, 8), makeMarmot(80, 7),
        makeMosquito(26, 7), makeMosquito(56, 5), makeMosquito(90, 5),
        makeHiker(51, 8), makeHiker(106, 5),
      ];
    },
    spawnTPBlooms() {
      return [ makeTPBloom(20, 10), makeTPBloom(95, 10) ];
    },
    spawnItems() {
      return [
        makeItem('bar', 8, 8), makeItem('spork', 43, 7),
        makeItem('water', 55, 7), makeItem('filter', 66, 7),
        makeItem('spray', 84, 5), makeItem('tent', 110, 6),
      ];
    },
  },
  // ======== LEVEL 2: PASAYTEN WILDERNESS ========
  {
    name: 'Pasayten Wilderness',
    subtitle: 'Dry open ridges and river fords of the Methow highlands',
    section: 'PCT Washington: Harts Pass \u2192 Rainy Pass',
    campName: 'Rainy Pass Camp',
    goalTile: [132, 2],
    goalFlagY: 4,
    spawnTile: [2, 9],
    build() {
      const COLS = 135, ROWS = 15;
      const { map, set, hline, fill } = makeMap(COLS, ROWS);
      fill(0, 11, COLS - 1, 14, T_SOLID);
      for (let y = 0; y < ROWS; y++) set(0, y, T_SOLID);
      // OPEN MEADOW
      fill(8, 9, 11, 10, T_SOLID);
      hline(14, 20, 8, T_PLATFORM);
      fill(19, 8, 22, 10, T_SOLID);
      hline(23, 28, 6, T_PLATFORM);
      // RIVER FORD 1
      fill(29, 11, 38, 11, T_EMPTY); fill(29, 12, 38, 13, T_WATER);
      hline(30, 31, 9, T_SOLID); hline(33, 34, 8, T_PLATFORM);
      hline(36, 37, 8, T_PLATFORM); hline(38, 39, 9, T_SOLID);
      // RIDGE TRAVERSE
      fill(42, 9, 45, 10, T_SOLID);
      hline(46, 51, 7, T_PLATFORM); hline(51, 56, 5, T_PLATFORM);
      fill(55, 6, 58, 10, T_SOLID);
      hline(59, 64, 8, T_PLATFORM); hline(63, 68, 6, T_PLATFORM);
      fill(67, 7, 70, 10, T_SOLID);
      hline(70, 75, 8, T_PLATFORM);
      // RIVER FORD 2
      fill(76, 11, 85, 11, T_EMPTY); fill(76, 12, 85, 13, T_WATER);
      hline(77, 78, 9, T_SOLID); hline(80, 81, 7, T_PLATFORM);
      hline(83, 84, 8, T_SOLID); hline(85, 86, 9, T_SOLID);
      // RIDGELINE ASCENT
      fill(87, 9, 90, 10, T_SOLID); fill(92, 8, 95, 10, T_SOLID);
      hline(94, 99, 6, T_PLATFORM);
      fill(97, 7, 100, 10, T_SOLID);
      hline(100, 105, 5, T_PLATFORM);
      fill(103, 6, 106, 10, T_SOLID);
      hline(106, 111, 7, T_PLATFORM); hline(110, 115, 5, T_PLATFORM);
      // CAMP APPROACH
      hline(115, 120, 7, T_PLATFORM); hline(119, 124, 5, T_PLATFORM);
      hline(123, 128, 7, T_PLATFORM); hline(127, 132, 6, T_PLATFORM);
      fill(131, 4, 134, 14, T_SOLID);
      return { map, COLS, ROWS };
    },
    spawnEnemies() {
      return [
        makeMarmot(12, 10), makeMarmot(47, 8), makeMarmot(91, 10),
        makeMosquito(35, 7), makeMosquito(64, 5), makeMosquito(100, 4),
        makeHiker(23, 7), makeHiker(71, 8), makeHiker(111, 5),
        makeRedneck(125, 7),
      ];
    },
    spawnTPBlooms() {
      return [ makeTPBloom(40, 10), makeTPBloom(73, 10), makeTPBloom(88, 10) ];
    },
    spawnItems() {
      return [
        makeItem('bar', 15, 8), makeItem('spork', 52, 5),
        makeItem('water', 68, 6), makeItem('filter', 80, 7),
        makeItem('spray', 103, 4), makeItem('tent', 128, 5),
      ];
    },
  },
  // ======== LEVEL 3: GLACIER PEAK WILDERNESS ========
  {
    name: 'Glacier Peak',
    subtitle: 'Dense forest and roaring creeks below Glacier Peak',
    section: 'PCT Washington: Rainy Pass \u2192 Stevens Pass',
    campName: 'Lake Valhalla',
    goalTile: [147, 2],
    goalFlagY: 4,
    spawnTile: [2, 9],
    build() {
      const COLS = 150, ROWS = 15;
      const { map, set, hline, fill } = makeMap(COLS, ROWS);
      fill(0, 11, COLS - 1, 14, T_SOLID);
      for (let y = 0; y < ROWS; y++) set(0, y, T_SOLID);
      // TRAILHEAD
      hline(5, 10, 9, T_PLATFORM);
      fill(11, 9, 14, 10, T_SOLID);
      hline(15, 20, 7, T_PLATFORM);
      fill(19, 8, 22, 10, T_SOLID);
      // FIRST CREEK
      fill(22, 11, 31, 11, T_EMPTY); fill(22, 12, 31, 13, T_WATER);
      hline(23, 24, 9, T_SOLID); hline(26, 27, 8, T_PLATFORM);
      hline(29, 30, 9, T_SOLID); hline(31, 32, 9, T_SOLID);
      // FOREST CLIMB
      hline(33, 38, 8, T_PLATFORM); hline(38, 43, 6, T_PLATFORM);
      fill(42, 7, 45, 10, T_SOLID);
      hline(46, 51, 7, T_PLATFORM); hline(50, 55, 5, T_PLATFORM);
      fill(54, 6, 57, 10, T_SOLID);
      hline(57, 62, 8, T_PLATFORM); hline(62, 67, 6, T_PLATFORM);
      // SECOND CREEK
      fill(68, 11, 77, 11, T_EMPTY); fill(68, 12, 77, 13, T_WATER);
      hline(69, 70, 9, T_SOLID); hline(72, 73, 7, T_PLATFORM);
      hline(75, 76, 8, T_PLATFORM); hline(77, 78, 9, T_SOLID);
      // FALLEN LOGS
      hline(79, 85, 8, T_PLATFORM);
      fill(84, 8, 87, 10, T_SOLID);
      hline(87, 92, 6, T_PLATFORM); hline(91, 96, 4, T_PLATFORM);
      fill(95, 5, 98, 10, T_SOLID);
      hline(98, 103, 7, T_PLATFORM); hline(102, 107, 5, T_PLATFORM);
      // THIRD CREEK
      fill(108, 11, 117, 11, T_EMPTY); fill(108, 12, 117, 13, T_WATER);
      hline(109, 110, 9, T_SOLID); hline(112, 113, 8, T_PLATFORM);
      hline(115, 116, 9, T_SOLID); hline(117, 118, 9, T_SOLID);
      // FINAL ASCENT
      fill(119, 9, 122, 10, T_SOLID);
      hline(122, 127, 7, T_PLATFORM);
      fill(126, 7, 129, 10, T_SOLID);
      hline(129, 134, 5, T_PLATFORM); hline(133, 138, 7, T_PLATFORM);
      hline(137, 142, 5, T_PLATFORM); hline(141, 146, 6, T_PLATFORM);
      fill(146, 4, 149, 14, T_SOLID);
      return { map, COLS, ROWS };
    },
    spawnEnemies() {
      return [
        makeMarmot(12,8), makeMarmot(35, 8), makeMarmot(82, 8), makeMarmot(123, 10),
        makeMouse(46, 8), makeMouse(79, 8), makeMouse(100, 7),
        makeMosquito(27, 7), makeMosquito(50, 4), makeMosquito(71, 7),
        makeMosquito(90, 4), makeMosquito(130, 4),
        makeHiker(60, 7), makeHiker(94, 6), makeHiker(138, 5),
        makeRedneck(120, 9), makeRedneck(143, 5),
      ];
    },
    spawnTPBlooms() {
      return [ makeTPBloom(45, 10), makeTPBloom(86, 10), makeTPBloom(120, 10) ];
    },
    spawnItems() {
      return [
        makeItem('bar', 10, 8), makeItem('spork', 44, 6),
        makeItem('water', 58, 7), makeItem('filter', 73, 7),
        makeItem('spray', 96, 6), makeItem('tent', 140, 5),
      ];
    },
  },
  // ======== LEVEL 4: ALPINE LAKES WILDERNESS ========
  {
    name: 'Alpine Lakes',
    subtitle: 'Granite slabs and shimmering tarns of Alpine Lakes Wilderness',
    section: 'PCT Washington: Stevens Pass \u2192 Snoqualmie Pass',
    campName: 'Kendall Katwalk Camp',
    goalTile: [162, 2],
    goalFlagY: 4,
    spawnTile: [2, 9],
    build() {
      const COLS = 165, ROWS = 15;
      const { map, set, hline, fill } = makeMap(COLS, ROWS);
      fill(0, 11, COLS - 1, 14, T_SOLID);
      for (let y = 0; y < ROWS; y++) set(0, y, T_SOLID);
      // GRANITE SLABS
      fill(6, 9, 9, 10, T_SOLID); fill(11, 8, 14, 10, T_SOLID);
      hline(15, 20, 6, T_PLATFORM);
      fill(19, 7, 22, 10, T_SOLID);
      hline(23, 28, 9, T_PLATFORM);
      // LAKE 1
      fill(28, 11, 40, 11, T_EMPTY); fill(28, 12, 40, 13, T_WATER);
      hline(29, 30, 9, T_SOLID); hline(32, 33, 8, T_PLATFORM);
      hline(35, 36, 7, T_PLATFORM); hline(38, 39, 8, T_PLATFORM);
      hline(40, 41, 9, T_SOLID);
      // BOULDER FIELD
      fill(43, 9, 46, 10, T_SOLID); fill(48, 8, 51, 10, T_SOLID);
      hline(52, 57, 6, T_PLATFORM);
      fill(56, 7, 59, 10, T_SOLID);
      hline(60, 65, 5, T_PLATFORM); hline(64, 69, 8, T_PLATFORM);
      fill(68, 8, 71, 10, T_SOLID);
      hline(72, 77, 6, T_PLATFORM);
      // LAKE 2
      fill(79, 11, 90, 11, T_EMPTY); fill(79, 12, 90, 13, T_WATER);
      hline(80, 81, 9, T_SOLID); hline(83, 84, 7, T_PLATFORM);
      hline(86, 87, 8, T_PLATFORM); hline(89, 90, 7, T_PLATFORM);
      hline(90, 91, 9, T_SOLID);
      // RIDGELINE
      fill(93, 9, 96, 10, T_SOLID);
      hline(97, 102, 7, T_PLATFORM); hline(101, 106, 5, T_PLATFORM);
      fill(105, 6, 108, 10, T_SOLID);
      hline(108, 113, 8, T_PLATFORM); hline(112, 117, 6, T_PLATFORM);
      fill(116, 7, 119, 10, T_SOLID);
      hline(119, 124, 4, T_PLATFORM); hline(123, 128, 7, T_PLATFORM);
      // LAKE 3
      fill(130, 11, 143, 11, T_EMPTY); fill(130, 12, 143, 13, T_WATER);
      hline(131, 132, 9, T_SOLID); hline(134, 135, 7, T_PLATFORM);
      hline(137, 138, 8, T_PLATFORM); hline(140, 141, 7, T_PLATFORM);
      hline(143, 144, 9, T_SOLID);
      // SUMMIT APPROACH
      fill(146, 9, 149, 10, T_SOLID);
      hline(149, 154, 7, T_PLATFORM); hline(153, 158, 5, T_PLATFORM);
      hline(157, 162, 6, T_PLATFORM);
      fill(161, 4, 164, 14, T_SOLID);
      return { map, COLS, ROWS };
    },
    spawnEnemies() {
      return [
        makeMarmot(10, 10), makeMarmot(46, 8), makeMarmot(97, 10), makeMarmot(145, 10),
        makeMouse(23, 10), makeMouse(70, 7), makeMouse(110, 7), makeMouse(132, 8),
        makeMosquito(33, 7), makeMosquito(52, 5), makeMosquito(83, 6),
        makeMosquito(102, 4), makeMosquito(125, 3), makeMosquito(136, 6),
        makeHiker(58, 6), makeMouse(78, 6), makeHiker(120, 5), makeHiker(155, 5),
        makeRedneck(15, 10), makeRedneck(93, 8), makeRedneck(150, 7),
      ];
    },
    spawnTPBlooms() {
      return [
        makeTPBloom(20, 10), makeTPBloom(55, 10),
        makeTPBloom(94, 10), makeTPBloom(131, 10),
      ];
    },
    spawnItems() {
      return [
        makeItem('bar', 9, 8), makeItem('spork', 60, 5),
        makeItem('water', 72, 6), makeItem('filter', 85, 6),
        makeItem('spray', 109, 5), makeItem('tent', 159, 5),
      ];
    },
  },
  // ======== LEVEL 5: GOAT ROCKS WILDERNESS ========
  {
    name: 'Goat Rocks',
    subtitle: 'The famous knife-edge ridge above Goat Rocks Wilderness',
    section: 'PCT Washington: Snoqualmie Pass \u2192 White Pass',
    campName: 'Snowgrass Flat',
    goalTile: [172, 2],
    goalFlagY: 4,
    spawnTile: [2, 9],
    build() {
      const COLS = 175, ROWS = 15;
      const { map, set, hline, fill } = makeMap(COLS, ROWS);
      fill(0, 11, COLS - 1, 14, T_SOLID);
      for (let y = 0; y < ROWS; y++) set(0, y, T_SOLID);
      // APPROACH
      fill(6, 9, 9, 10, T_SOLID); fill(12, 8, 15, 10, T_SOLID);
      hline(16, 21, 7, T_PLATFORM);
      fill(20, 8, 23, 10, T_SOLID);
      hline(24, 29, 9, T_PLATFORM);
      fill(27, 9, 30, 10, T_SOLID);
      // CISPUS PASS CROSSING
      fill(31, 11, 43, 11, T_EMPTY); fill(31, 12, 43, 13, T_WATER);
      hline(32, 33, 9, T_SOLID); hline(35, 36, 7, T_PLATFORM);
      hline(38, 39, 8, T_PLATFORM); hline(41, 42, 7, T_PLATFORM);
      hline(43, 44, 9, T_SOLID);
      // LOWER GOAT ROCKS
      fill(46, 9, 49, 10, T_SOLID); fill(51, 8, 54, 10, T_SOLID);
      hline(55, 60, 6, T_PLATFORM);
      fill(59, 7, 62, 10, T_SOLID);
      hline(63, 68, 5, T_PLATFORM); hline(67, 72, 7, T_PLATFORM);
      fill(71, 8, 74, 10, T_SOLID);
      hline(75, 80, 9, T_PLATFORM);
      // KNIFE EDGE RIDGE — long exposed section with water gorge below
      fill(80, 11, 122, 11, T_EMPTY); fill(80, 12, 122, 13, T_WATER);
      hline(80, 122, 10, T_SOLID);
      hline(80, 84, 8, T_PLATFORM); hline(86, 90, 6, T_PLATFORM);
      hline(92, 95, 8, T_PLATFORM); hline(97, 100, 5, T_PLATFORM);
      hline(102, 105, 7, T_PLATFORM); hline(107, 110, 4, T_PLATFORM);
      hline(112, 115, 6, T_PLATFORM); hline(117, 120, 8, T_PLATFORM);
      hline(120, 124, 9, T_PLATFORM);
      // UPPER GOAT ROCKS
      fill(123, 9, 126, 10, T_SOLID); fill(128, 8, 131, 10, T_SOLID);
      hline(132, 137, 6, T_PLATFORM);
      fill(136, 7, 139, 10, T_SOLID);
      hline(140, 145, 5, T_PLATFORM); hline(144, 149, 7, T_PLATFORM);
      fill(148, 8, 151, 10, T_SOLID);
      // FINAL APPROACH
      hline(152, 157, 5, T_PLATFORM); hline(156, 161, 7, T_PLATFORM);
      hline(160, 165, 5, T_PLATFORM); hline(164, 170, 6, T_PLATFORM);
      fill(171, 4, 174, 14, T_SOLID);
      return { map, COLS, ROWS };
    },
    spawnEnemies() {
      return [
        makeMarmot(11, 10), makeMarmot(54,7), makeMarmot(127, 10), makeMarmot(153, 8),
        makeMouse(23,7), makeMouse(63, 8), makeMouse(131, 7),
        makeMosquito(37, 7), makeMosquito(65, 5), makeMosquito(85, 7),
        makeMosquito(100, 4), makeMosquito(115, 6), makeMosquito(145, 4), makeMosquito(162, 4),
        makeHiker(50, 8), makeHiker(76, 9), makeHiker(140, 5), makeHiker(165, 5),
        makeRedneck(19, 10), makeRedneck(75, 9), makeRedneck(149, 7),
      ];
    },
    spawnTPBlooms() {
      return [
        makeTPBloom(10, 10), makeTPBloom(45, 10),
        makeTPBloom(125, 10), makeTPBloom(155, 10),
      ];
    },
    spawnItems() {
      return [
        makeItem('bar', 12, 8), makeItem('spork', 65, 5),
        makeItem('water', 78, 7), makeItem('filter', 90, 7),
        makeItem('spray', 142, 5), makeItem('tent', 168, 5),
      ];
    },
  },
  // ======== LEVEL 6: BRIDGE OF THE GODS ========
  {
    name: 'Bridge of the Gods',
    subtitle: 'Through Indian Heaven Wilderness to the Columbia River',
    section: 'PCT Washington/Oregon: White Pass \u2192 Cascade Locks',
    campName: 'Cascade Locks',
    goalTile: [182, 2],
    goalFlagY: 4,
    spawnTile: [2, 9],
    build() {
      const COLS = 185, ROWS = 15;
      const { map, set, hline, fill } = makeMap(COLS, ROWS);
      fill(0, 11, COLS - 1, 14, T_SOLID);
      for (let y = 0; y < ROWS; y++) set(0, y, T_SOLID);
      // FOREST DESCENT
      fill(7, 8, 10, 10, T_SOLID);
      hline(12, 17, 7, T_PLATFORM);
      fill(16, 8, 19, 10, T_SOLID);
      hline(20, 25, 9, T_PLATFORM);
      fill(24, 9, 27, 10, T_SOLID);
      // WIND RIVER CROSSING
      fill(28, 11, 42, 11, T_EMPTY); fill(28, 12, 42, 13, T_WATER);
      hline(29, 30, 9, T_SOLID); hline(32, 33, 8, T_PLATFORM);
      hline(35, 36, 7, T_PLATFORM); hline(38, 39, 8, T_PLATFORM);
      hline(41, 42, 9, T_SOLID);
      // LOWER FOREST
      fill(44, 9, 47, 10, T_SOLID);
      hline(48, 53, 7, T_PLATFORM); hline(53, 58, 5, T_PLATFORM);
      fill(57, 6, 60, 10, T_SOLID);
      hline(61, 66, 8, T_PLATFORM);
      fill(65, 9, 68, 10, T_SOLID);
      hline(69, 74, 6, T_PLATFORM); hline(73, 78, 4, T_PLATFORM);
      fill(77, 5, 80, 10, T_SOLID);
      hline(81, 86, 7, T_PLATFORM);
      // COLUMBIA GORGE GAP
      fill(87, 11, 110, 11, T_EMPTY); fill(87, 12, 110, 13, T_WATER);
      hline(87, 110, 10, T_SOLID);
      hline(88, 92, 8, T_PLATFORM); hline(94, 97, 6, T_PLATFORM);
      hline(99, 102, 8, T_PLATFORM); hline(104, 107, 5, T_PLATFORM);
      hline(108, 111, 7, T_PLATFORM);
      // BRIDGE APPROACH
      fill(112, 9, 115, 10, T_SOLID);
      hline(116, 121, 7, T_PLATFORM);
      fill(120, 8, 123, 10, T_SOLID);
      hline(123, 128, 5, T_PLATFORM); hline(127, 132, 8, T_PLATFORM);
      fill(131, 8, 134, 10, T_SOLID);
      hline(134, 139, 6, T_PLATFORM); hline(138, 143, 4, T_PLATFORM);
      // CASCADE LOCKS APPROACH — long river gorge
      fill(145, 11, 177, 11, T_EMPTY); fill(145, 12, 177, 13, T_WATER);
      hline(145, 177, 10, T_SOLID);
      hline(145, 149, 8, T_PLATFORM); hline(151, 154, 6, T_PLATFORM);
      hline(156, 159, 8, T_PLATFORM); hline(161, 164, 5, T_PLATFORM);
      hline(166, 169, 7, T_PLATFORM); hline(171, 174, 5, T_PLATFORM);
      hline(174, 178, 6, T_PLATFORM);
      fill(181, 4, 184, 14, T_SOLID);
      return { map, COLS, ROWS };
    },
    spawnEnemies() {
      return [
        makeMarmot(13, 10), makeMarmot(52, 8), makeMarmot(116, 10), makeMarmot(147, 9),
        makeMouse(24,8), makeMouse(66, 8), makeMouse(85, 10), makeMouse(135, 8),
        makeMosquito(35, 7), makeMosquito(56, 4), makeMosquito(91, 7),
        makeMosquito(105, 4), makeMosquito(130, 3), makeMosquito(153, 6),
        makeMosquito(168, 4),
        makeHiker(43, 8), makeHiker(77, 4), makeHiker(126, 5),
        makeHiker(162, 5), makeHiker(175, 7),
        makeRedneck(21, 8), makeRedneck(62, 8),
        makeRedneck(122, 7), makeRedneck(169, 7),
      ];
    },
    spawnTPBlooms() {
      return [
        makeTPBloom(30, 10), makeTPBloom(55, 10), makeTPBloom(83, 10),
        makeTPBloom(120, 10), makeTPBloom(150, 10),
      ];
    },
    spawnItems() {
      return [
        makeItem('bar', 15, 8), makeItem('spork', 61, 5),
        makeItem('water', 80, 7), makeItem('filter', 97, 7),
        makeItem('spray', 130, 4), makeItem('tent', 176, 6),
      ];
    },
  },
  // ======== LEVEL 7: OREGON CASCADES ========
  {
    name: 'Oregon Cascades',
    subtitle: 'Volcanic rock and old-growth forest through the Oregon Cascades',
    section: 'PCT Oregon: Cascade Locks \u2192 Timberline Lodge',
    campName: 'Timberline Lodge',
    goalTile: [197, 2],
    goalFlagY: 4,
    spawnTile: [2, 9],
    build() {
      const COLS = 200, ROWS = 15;
      const { map, set, hline, fill } = makeMap(COLS, ROWS);
      fill(0, 11, COLS - 1, 14, T_SOLID);
      for (let y = 0; y < ROWS; y++) set(0, y, T_SOLID);
      // COLUMBIA RIVER EXIT
      fill(7, 9, 10, 10, T_SOLID);
      hline(13, 18, 8, T_PLATFORM);
      fill(17, 8, 20, 10, T_SOLID);
      hline(21, 26, 6, T_PLATFORM);
      fill(25, 7, 28, 10, T_SOLID);
      // LAVA FIELD 1
      fill(29, 11, 41, 11, T_EMPTY); fill(29, 12, 41, 13, T_WATER);
      hline(30, 31, 9, T_SOLID); hline(33, 34, 8, T_PLATFORM);
      hline(36, 37, 7, T_PLATFORM); hline(39, 40, 8, T_PLATFORM);
      hline(41, 42, 9, T_SOLID);
      fill(43, 9, 46, 10, T_SOLID);
      hline(47, 52, 7, T_PLATFORM); hline(51, 56, 5, T_PLATFORM);
      fill(55, 6, 58, 10, T_SOLID);
      // FOREST SECTION
      hline(59, 64, 8, T_PLATFORM);
      fill(63, 9, 66, 10, T_SOLID);
      hline(67, 72, 6, T_PLATFORM); hline(71, 76, 4, T_PLATFORM);
      fill(75, 5, 78, 10, T_SOLID);
      hline(79, 84, 7, T_PLATFORM); hline(83, 88, 5, T_PLATFORM);
      fill(87, 6, 90, 10, T_SOLID);
      // LAVA FIELD 2
      fill(91, 11, 114, 11, T_EMPTY); fill(91, 12, 114, 13, T_WATER);
      hline(91, 114, 10, T_SOLID);
      hline(92, 96, 8, T_PLATFORM); hline(98, 101, 6, T_PLATFORM);
      hline(103, 106, 8, T_PLATFORM); hline(108, 111, 5, T_PLATFORM);
      hline(113, 116, 7, T_PLATFORM);
      // UPPER FOREST
      fill(116, 9, 119, 10, T_SOLID);
      hline(120, 125, 7, T_PLATFORM);
      fill(124, 8, 127, 10, T_SOLID);
      hline(128, 133, 5, T_PLATFORM);
      fill(132, 6, 135, 10, T_SOLID);
      hline(136, 141, 8, T_PLATFORM); hline(140, 145, 6, T_PLATFORM);
      fill(144, 7, 147, 10, T_SOLID);
      hline(148, 153, 4, T_PLATFORM);
      // TIMBERLINE APPROACH — long snow bridge
      fill(154, 11, 190, 11, T_EMPTY); fill(154, 12, 190, 13, T_WATER);
      hline(154, 190, 10, T_SOLID);
      hline(155, 159, 8, T_PLATFORM); hline(161, 164, 6, T_PLATFORM);
      hline(166, 169, 8, T_PLATFORM); hline(171, 174, 5, T_PLATFORM);
      hline(176, 179, 7, T_PLATFORM); hline(181, 184, 4, T_PLATFORM);
      hline(186, 189, 6, T_PLATFORM); hline(188, 193, 6, T_PLATFORM);
      fill(196, 4, 199, 14, T_SOLID);
      return { map, COLS, ROWS };
    },
    spawnEnemies() {
      return [
        makeMarmot(16, 10), makeMarmot(55,5), makeMarmot(92, 9),
        makeMarmot(120, 10), makeMarmot(156, 9),
        makeMouse(24, 10), makeMouse(64, 8), makeMouse(100, 8),
        makeMouse(128, 8), makeMouse(162, 8),
        makeMosquito(34, 7), makeMosquito(52, 4), makeMosquito(70, 4),
        makeMosquito(95, 7), makeMosquito(109, 4), makeMosquito(137, 3),
        makeMosquito(158, 7), makeMosquito(175, 4), makeMosquito(188, 4),
        makeHiker(43, 8), makeHiker(80, 4), makeHiker(116, 7),
        makeHiker(140, 4), makeHiker(172, 5), makeHiker(190, 7),
        makeRedneck(20,7), makeRedneck(70, 8),
        makeRedneck(123, 7), makeRedneck(177, 7),
      ];
    },
    spawnTPBlooms() {
      return [
        makeTPBloom(25, 10), makeTPBloom(57, 10), makeTPBloom(90, 10),
        makeTPBloom(125, 10), makeTPBloom(157, 10),
      ];
    },
    spawnItems() {
      return [
        makeItem('bar', 18, 8), makeItem('spork', 68, 4),
        makeItem('water', 85, 7), makeItem('filter', 103, 7),
        makeItem('spray', 138, 5), makeItem('tent', 186, 4),
      ];
    },
  },
  // ======== LEVEL 8: SKY LAKES WILDERNESS ========
  {
    name: 'Sky Lakes',
    subtitle: 'Through the volcanic Sky Lakes and on to Crater Lake',
    section: 'PCT Oregon: Timberline Lodge \u2192 Mazama Village',
    campName: 'Mazama Village',
    goalTile: [207, 2],
    goalFlagY: 4,
    spawnTile: [2, 9],
    build() {
      const COLS = 210, ROWS = 15;
      const { map, set, hline, fill } = makeMap(COLS, ROWS);
      fill(0, 11, COLS - 1, 14, T_SOLID);
      for (let y = 0; y < ROWS; y++) set(0, y, T_SOLID);
      // UPPER SKY LAKES
      fill(7, 8, 10, 10, T_SOLID); fill(13, 7, 16, 10, T_SOLID);
      hline(17, 22, 5, T_PLATFORM);
      fill(21, 6, 24, 10, T_SOLID);
      hline(25, 30, 8, T_PLATFORM);
      fill(29, 9, 32, 10, T_SOLID);
      // SKY LAKE 1
      fill(33, 11, 45, 11, T_EMPTY); fill(33, 12, 45, 13, T_WATER);
      hline(34, 35, 9, T_SOLID); hline(37, 38, 7, T_PLATFORM);
      hline(40, 41, 8, T_PLATFORM); hline(43, 44, 7, T_PLATFORM);
      hline(45, 46, 9, T_SOLID);
      // VOLCANIC RIDGE
      fill(47, 9, 50, 10, T_SOLID); fill(52, 8, 55, 10, T_SOLID);
      hline(56, 61, 6, T_PLATFORM);
      fill(60, 7, 63, 10, T_SOLID);
      hline(64, 69, 5, T_PLATFORM);
      fill(68, 6, 71, 10, T_SOLID);
      hline(72, 77, 7, T_PLATFORM); hline(76, 81, 4, T_PLATFORM);
      fill(80, 5, 83, 10, T_SOLID);
      // SKY LAKE 2
      fill(85, 11, 98, 11, T_EMPTY); fill(85, 12, 98, 13, T_WATER);
      hline(86, 87, 9, T_SOLID); hline(89, 90, 7, T_PLATFORM);
      hline(92, 93, 8, T_PLATFORM); hline(95, 96, 7, T_PLATFORM);
      hline(98, 99, 9, T_SOLID);
      // CRATER RIM APPROACH
      fill(100, 9, 103, 10, T_SOLID);
      hline(104, 109, 7, T_PLATFORM);
      fill(108, 8, 111, 10, T_SOLID);
      hline(112, 117, 5, T_PLATFORM); hline(116, 121, 7, T_PLATFORM);
      fill(120, 8, 123, 10, T_SOLID);
      hline(124, 129, 5, T_PLATFORM);
      fill(128, 6, 131, 10, T_SOLID);
      hline(132, 137, 4, T_PLATFORM); hline(136, 141, 6, T_PLATFORM);
      // SKY LAKE 3
      fill(142, 11, 154, 11, T_EMPTY); fill(142, 12, 154, 13, T_WATER);
      hline(143, 144, 9, T_SOLID); hline(146, 147, 7, T_PLATFORM);
      hline(149, 150, 8, T_PLATFORM); hline(152, 153, 7, T_PLATFORM);
      hline(154, 155, 9, T_SOLID);
      // MAZAMA APPROACH
      fill(156, 9, 159, 10, T_SOLID); fill(161, 8, 164, 10, T_SOLID);
      hline(165, 170, 6, T_PLATFORM);
      fill(169, 7, 172, 10, T_SOLID);
      hline(173, 178, 4, T_PLATFORM); hline(177, 182, 6, T_PLATFORM);
      fill(181, 7, 184, 10, T_SOLID);
      hline(185, 190, 5, T_PLATFORM); hline(189, 194, 7, T_PLATFORM);
      hline(193, 198, 5, T_PLATFORM); hline(197, 202, 6, T_PLATFORM);
      fill(206, 4, 209, 14, T_SOLID);
      return { map, COLS, ROWS };
    },
    spawnEnemies() {
      return [
        makeMarmot(17, 10), makeMarmot(50, 8), makeMarmot(86, 10),
        makeMarmot(105, 10), makeMarmot(143, 10), makeMarmot(160, 10),
        makeMouse(27, 10), makeMouse(59, 8), makeMouse(73, 8),
        makeMouse(112, 8), makeMouse(150, 8), makeMouse(165, 8),
        makeMosquito(38, 7), makeMosquito(57, 4), makeMosquito(78, 3),
        makeMosquito(92, 6), makeMosquito(115, 4), makeMosquito(133, 3),
        makeMosquito(148, 6), makeMosquito(170, 3), makeMosquito(195, 3),
        makeHiker(45, 8), makeHiker(80, 4), makeHiker(120, 5),
        makeHiker(140, 6), makeHiker(178, 5), makeHiker(204, 5),
        makeRedneck(20, 10), makeRedneck(66, 8),
        makeRedneck(125, 7), makeRedneck(182, 6), makeRedneck(200, 5),
      ];
    },
    spawnTPBlooms() {
      return [
        makeTPBloom(30, 10), makeTPBloom(52, 10), makeTPBloom(88, 10),
        makeTPBloom(125, 10), makeTPBloom(157, 10), makeTPBloom(185, 10),
      ];
    },
    spawnItems() {
      return [
        makeItem('bar', 20, 8), makeItem('spork', 65, 5),
        makeItem('water', 82, 7), makeItem('filter', 100, 7),
        makeItem('spray', 130, 5), makeItem('tent', 200, 5),
      ];
    },
  },
  // ======== LEVEL 9: CASTLE CRAGS ========
  {
    name: 'Castle Crags',
    subtitle: 'The dramatic spires of Castle Crags — the final push south',
    section: 'PCT Oregon/California: Crater Lake \u2192 Castle Crags',
    campName: 'Castle Crags Summit',
    goalTile: [217, 1],
    goalFlagY: 3,
    spawnTile: [2, 9],
    build() {
      const COLS = 220, ROWS = 15;
      const { map, set, hline, fill } = makeMap(COLS, ROWS);
      fill(0, 11, COLS - 1, 14, T_SOLID);
      for (let y = 0; y < ROWS; y++) set(0, y, T_SOLID);
      // CRAGS BASE
      fill(7, 8, 10, 10, T_SOLID); fill(13, 7, 16, 10, T_SOLID);
      hline(17, 22, 6, T_PLATFORM);
      fill(21, 7, 24, 10, T_SOLID);
      hline(25, 30, 8, T_PLATFORM);
      fill(29, 9, 32, 10, T_SOLID);
      // FIRST GORGE
      fill(33, 11, 48, 11, T_EMPTY); fill(33, 12, 48, 13, T_WATER);
      hline(34, 35, 9, T_SOLID); hline(37, 38, 7, T_PLATFORM);
      hline(40, 41, 8, T_PLATFORM); hline(43, 44, 7, T_PLATFORM);
      hline(46, 47, 8, T_PLATFORM); hline(48, 49, 9, T_SOLID);
      // ROCKY SPIRES 1
      fill(50, 9, 53, 10, T_SOLID); fill(55, 7, 58, 10, T_SOLID);
      hline(59, 64, 5, T_PLATFORM);
      fill(63, 6, 66, 10, T_SOLID);
      hline(67, 72, 7, T_PLATFORM);
      fill(71, 8, 74, 10, T_SOLID);
      hline(75, 80, 4, T_PLATFORM);
      fill(79, 5, 82, 10, T_SOLID);
      hline(83, 88, 7, T_PLATFORM);
      // SECOND GORGE
      fill(89, 11, 104, 11, T_EMPTY); fill(89, 12, 104, 13, T_WATER);
      hline(89, 104, 10, T_SOLID);
      hline(90, 94, 8, T_PLATFORM); hline(96, 99, 6, T_PLATFORM);
      hline(101, 104, 8, T_PLATFORM); hline(104, 107, 9, T_PLATFORM);
      // ROCKY SPIRES 2
      fill(108, 9, 111, 10, T_SOLID); fill(113, 7, 116, 10, T_SOLID);
      hline(117, 122, 5, T_PLATFORM);
      fill(121, 6, 124, 10, T_SOLID);
      hline(125, 130, 8, T_PLATFORM);
      fill(129, 9, 132, 10, T_SOLID);
      hline(133, 138, 6, T_PLATFORM);
      fill(137, 7, 140, 10, T_SOLID);
      hline(141, 146, 4, T_PLATFORM);
      // THIRD GORGE
      fill(147, 11, 162, 11, T_EMPTY); fill(147, 12, 162, 13, T_WATER);
      hline(147, 162, 10, T_SOLID);
      hline(148, 152, 8, T_PLATFORM); hline(154, 157, 6, T_PLATFORM);
      hline(159, 162, 8, T_PLATFORM); hline(162, 165, 9, T_PLATFORM);
      // SWITCHBACK SUMMIT
      fill(166, 9, 169, 10, T_SOLID); fill(171, 8, 174, 10, T_SOLID);
      hline(175, 180, 6, T_PLATFORM);
      fill(179, 7, 182, 10, T_SOLID);
      hline(183, 188, 4, T_PLATFORM); hline(187, 192, 6, T_PLATFORM);
      fill(191, 7, 194, 10, T_SOLID);
      hline(195, 200, 4, T_PLATFORM); hline(199, 204, 6, T_PLATFORM);
      hline(203, 208, 4, T_PLATFORM); hline(207, 212, 6, T_PLATFORM);
      fill(216, 3, 219, 14, T_SOLID);
      return { map, COLS, ROWS };
    },
    spawnEnemies() {
      return [
        makeMarmot(10,7), makeMarmot(52, 8), makeMarmot(89, 9),
        makeMarmot(112, 10), makeMarmot(148, 9), makeMarmot(170, 10), makeMarmot(196, 8),
        makeMouse(20, 10), makeMouse(60, 8), makeMouse(75, 8),
        makeMouse(117, 8), makeMouse(135, 8), makeMouse(163, 8), makeMouse(177, 8),
        makeMosquito(38, 7), makeMosquito(55, 4), makeMosquito(70, 4),
        makeMosquito(93, 7), makeMosquito(107, 4), makeMosquito(128, 3),
        makeMosquito(143, 3), makeMosquito(152, 6), makeMosquito(168, 4),
        makeMosquito(184, 3), makeMosquito(200, 2), makeMosquito(212, 2),
        makeHiker(44, 8), makeHiker(78, 5), makeHiker(115, 6),
        makeHiker(140, 4), makeHiker(174, 5), makeHiker(192, 5), makeHiker(213, 4),
        makeRedneck(17, 10), makeRedneck(67, 8), makeRedneck(105, 9),
        makeRedneck(158, 8), makeRedneck(185, 6), makeRedneck(210, 4),
      ];
    },
    spawnTPBlooms() {
      return [
        makeTPBloom(30, 10), makeTPBloom(55, 10), makeTPBloom(88, 10),
        makeTPBloom(115, 10), makeTPBloom(148, 10),
        makeTPBloom(167, 10), makeTPBloom(195, 10),
      ];
    },
    spawnItems() {
      return [
        makeItem('bar', 18, 8), makeItem('spork', 64, 5),
        makeItem('water', 80, 7), makeItem('filter', 97, 7),
        makeItem('spray', 135, 4), makeItem('tent', 210, 4),
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
  water:  { label: 'Water Bottle',pts: 25,  color: '#00BFFF', r: 9, heals: 1 },
};

function makeItem(type, tx, ty) {
  const def = ITEM_DEFS[type];
  let placeTy = ty;
  if (level && level.map) {
    // If starting tile is solid/platform/water, move up until empty
    while (placeTy > 0 && level.map[placeTy][tx] !== T_EMPTY) placeTy--;
    // If floating in air, scan down until we're sitting on a surface
    while (placeTy < level.ROWS - 1 &&
           level.map[placeTy][tx] === T_EMPTY &&
           level.map[placeTy + 1][tx] === T_EMPTY) placeTy++;
  }
  return { type, tx, ty: placeTy, x: tx * TS + 8, y: placeTy * TS, w: 20, h: 20, pts: def.pts, collected: false, bobOffset: rnd(0, Math.PI * 2) };
}

let items = [];
function spawnItems() {
  items = LEVELS[game.levelNum].spawnItems();
}

let tpBlooms = [];
function spawnTPBlooms() {
  tpBlooms = LEVELS[game.levelNum].spawnTPBlooms ? LEVELS[game.levelNum].spawnTPBlooms() : [];
}

let beerCans = [];
let trashPiles = [];

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

function makeRedneck(tx, ty) {
  return {
    type: 'redneck',
    x: tx * TS, y: ty * TS - 12,
    w: 28, h: 40,
    vx: -0.6, vy: 0,
    onGround: false,
    alive: true,
    stunTimer: 0,
    frame: 0, frameTimer: 0,
    patrolX1: (tx - 4) * TS,
    patrolX2: (tx + 4) * TS,
    throwTimer: Math.floor(rnd(120, 240)),
  };
}

function makeTPBloom(tx, ty) {
  let placeTy = ty;
  if (level && level.map) {
    // Walk up out of solid tiles
    while (placeTy > 0 && level.map[placeTy][tx] !== T_EMPTY) placeTy--;
    // Walk down to sit on a surface
    while (placeTy < level.ROWS - 1 &&
           level.map[placeTy][tx] === T_EMPTY &&
           level.map[placeTy + 1][tx] === T_EMPTY) placeTy++;
  }
  return { x: tx * TS + 6, y: placeTy * TS + 16, w: 20, h: 16, active: true };
}

function makeBeerCan(x, y, dir) {
  return { x, y, vx: dir * 5.5, vy: -3.2, w: 8, h: 12, alive: true };
}

function makeTrash(x, y) {
  return { x: x - 6, y, w: 16, h: 8, variant: Math.floor(rnd(0, 3)) };
}

// ==================== FISH ====================
let fish = [];
function spawnFish() {
  fish = [];
  if (!level || !level.map) return;
  const cols = level.COLS, rows = level.ROWS;
  // Scan water tiles and place a fish every ~6 tiles
  let lastFishX = -99;
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      if (level.map[ty][tx] === T_WATER && tx - lastFishX >= 6) {
        fish.push(makeFish(tx, ty));
        lastFishX = tx;
      }
    }
  }
}
function makeFish(tx, ty) {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const variant = Math.floor(rnd(0, 3)); // 0=trout, 1=salmon, 2=bass
  return {
    x: tx * TS + TS / 2,
    y: ty * TS + TS / 2,
    baseY: ty * TS + TS / 2,
    vx: dir * rnd(0.3, 0.7),
    phase: rnd(0, Math.PI * 2),
    variant,
    w: 18, h: 10,
  };
}
function updateFish() {
  fish.forEach(f => {
    // Check if the tile ahead is still water before moving
    const nextX = f.x + f.vx;
    const checkEdge = f.vx > 0 ? nextX + f.w / 2 : nextX - f.w / 2;
    const tileAheadX = Math.floor(checkEdge / TS);
    const tileAheadY = Math.floor(f.y / TS);
    const tileAhead = (tileAheadX >= 0 && tileAheadX < level.COLS &&
                       tileAheadY >= 0 && tileAheadY < level.ROWS)
                      ? level.map[tileAheadY][tileAheadX] : -1;
    if (tileAhead !== T_WATER) {
      f.vx *= -1; // reverse before leaving water
    } else {
      f.x = nextX;
    }
    // Bob vertically around baseY — oscillate, never accumulate
    f.phase += 0.08;
    f.y = f.baseY + Math.sin(f.phase) * 3;
  });
}

// ==================== TRAIL RUNNERS ====================
let trailRunners = [];
const TRAIL_RUNNER_INTERVAL = 600; // frames between spawn attempts (~10s at 60fps)
let trailRunnerTimer = 0;

function spawnTrailRunners() {
  trailRunners = [];
  trailRunnerTimer = Math.floor(rnd(120, 360)); // initial delay before first runner
}

function makeTrailRunner() {
  // Spawn off-screen, running left-to-right or right-to-left
  // Positions are in parallax-space (screen = x - cam.x * 0.35)
  const dir = Math.random() < 0.5 ? 1 : -1;
  const parallaxCam = cam.x * 0.35;
  const startX = dir > 0 ? parallaxCam - 60 : parallaxCam + W + 60;
  const variant = Math.floor(rnd(0, 3)); // 0=fast, 1=ultra, 2=casual
  const speed = 3.5 + rnd(0, 2.5);
  return {
    x: startX,
    vx: dir * speed,
    phase: rnd(0, Math.PI * 2),
    variant,
    soundPlayed: false,
  };
}

function updateTrailRunners() {
  trailRunnerTimer--;
  if (trailRunnerTimer <= 0) {
    // ~30% chance to spawn a runner each interval
    if (Math.random() < 0.3) {
      trailRunners.push(makeTrailRunner());
    }
    trailRunnerTimer = TRAIL_RUNNER_INTERVAL + Math.floor(rnd(-120, 120));
  }

  trailRunners.forEach(r => {
    r.x += r.vx;
    r.phase += 0.25; // fast stride animation

    // Play sound when runner enters the visible area
    if (!r.soundPlayed) {
      const screenX = r.x - cam.x * 0.35;
      if (screenX > -20 && screenX < W + 20) {
        r.soundPlayed = true;
        audio.sfxTrailRunner();
      }
    }
  });

  // Remove runners that have gone far off-screen
  trailRunners = trailRunners.filter(r => {
    const screenX = r.x - cam.x * 0.35;
    return screenX > -200 && screenX < W + 200;
  });
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

  // Redneck beer-can throw
  if (e.type === 'redneck') {
    e.throwTimer--;
    if (e.throwTimer <= 0) {
      const dir = e.vx > 0 ? 1 : -1;
      beerCans.push(makeBeerCan(e.x + e.w / 2, e.y + 10, dir));
      audio.sfxBeerCan();
      e.throwTimer = Math.floor(rnd(150, 280));
    }
  }
}

function updateBeerCans() {
  beerCans = beerCans.filter(b => {
    b.vy += 0.55;
    if (b.vy > 14) b.vy = 14;
    b.x += b.vx;
    b.y += b.vy;
    const tx = Math.floor((b.x + b.w / 2) / TS);
    const ty = Math.floor((b.y + b.h / 2) / TS);
    if (isSolid(tx, ty)) return false;
    if (b.y > level.ROWS * TS + 32) return false;
    if (b.x < -32 || b.x > level.COLS * TS + 32) return false;
    if (player.hurtTimer === 0 && aabb(player, b)) {
      hurtPlayer();
      audio.sfxBeerCanHit();
      return false;
    }
    return true;
  });
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
    audio.sfxGlissade();
    spawnParticles(player.x + player.w / 2, player.y + player.h, '#aa8855', 6, 3);
  }

  // Jump
  if (isJump() && !wasJump()) player.jumpBuffer = 8;
  if (player.jumpBuffer > 0) player.jumpBuffer--;

  if (player.jumpBuffer > 0 && player.onGround && player.glissading === 0) {
    player.jumpBuffer = 0;
    player.vy = JUMP_FORCE;
    player.jumpHeld = true;
    audio.sfxJump();
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
        audio.sfxStun();
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
    audio.sfxWater();
    hurtPlayer();
  }

  // Enemy collisions
  // Issue #16: Allow defeating enemies even during invincibility frames.
  // Players can stomp, glissade, and spray during hurtTimer, but can't take additional damage.
  // This maintains challenge and allows defeating water-spawned enemies.
  enemies.forEach(e => {
    if (!e.alive) return;
    if (!aabb(player, e)) return;

    // Glissade: kill already-stunned enemies, stun others
    if (player.glissading > 0) {
      if (e.stunTimer > 0 && !e.stunnedByGlissade) {
        scoreEnemy(e);
      } else if (e.stunTimer === 0) {
        e.stunTimer = 120;
        e.stunnedByGlissade = true;
        audio.sfxStun();
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
        audio.sfxStun();
        player.vy = -8;
      }
    } else if (e.stunTimer === 0 && player.hurtTimer === 0) {
      // Only take damage if not currently invincible
      hurtPlayer();
    }
  });

  // Item collection
  items.forEach(item => {
    if (item.collected) return;
    if (aabb(player, { x: item.x, y: item.y, w: item.w, h: item.h })) {
      item.collected = true;
      player.score += item.pts;
      const def = ITEM_DEFS[item.type];
      spawnParticles(item.x + 10, item.y + 10, def.color, 8, 3);
      if (def.heals && player.health < 3) {
        player.health = Math.min(3, player.health + def.heals);
        audio.sfxHeal();
        addFloatText(item.x + 10, item.y - 8, `${def.label} +1 H2O`, '#00BFFF');
      } else {
        audio.sfxCollect();
        addFloatText(item.x + 10, item.y - 8, `${def.label} +${item.pts}`, '#ffff44');
      }

      // Leave No Trace award — all items collected
      if (items.every(i => i.collected)) {
        const bonus = 1000;
        player.score += bonus;
        addFloatText(player.x + player.w / 2, player.y - 30, 'LEAVE NO TRACE! +' + bonus, '#44ffaa');
        spawnParticles(player.x + player.w / 2, player.y, '#44ffaa', 20, 5);
        audio.sfxBonus();
      }
    }
  });

  // TP Bloom contact
  tpBlooms.forEach(b => {
    if (player.hurtTimer === 0 && aabb(player, b)) {
      hurtPlayer();
      audio.sfxTPBloom();
      spawnParticles(b.x + b.w / 2, b.y + b.h / 2, '#F5F0E8', 6, 2);
    }
  });

  // Goal check (summit flag)
  const gDef = LEVELS[game.levelNum].goalTile;
  const goalX = gDef[0] * TS, goalY = gDef[1] * TS;
  if (player.x + player.w > goalX && player.y < goalY + 48) {
    game.leaveNoTrace[game.levelNum] = items.every(i => i.collected);
    game.trailAngel[game.levelNum] = enemies.every(en => !en.alive);
    game.levelCompletionTime = game.levelTick; // Store completion time for bonus calculation
    const timeSeconds = Math.floor(game.levelTick / 60);
    // Target = 4× theoretical minimum sprint time (goalTile * 32px / 3.5px/tick / 60fps)
    // L1: ~71s, L2: ~90s, L3: ~108s
    const levelDistances = [117*32, 132*32, 147*32, 162*32, 172*32, 182*32, 197*32, 207*32, 217*32];
    const targetTime = Math.ceil(levelDistances[game.levelNum] / 3.5 / 60 * 4);
    const timeDiff = targetTime - timeSeconds;
    game.levelTimeBonus = timeDiff >= 0
      ? Math.min(500, Math.floor(50 * Math.pow(1.04, timeDiff)))  // speed bonus, capped at 500
      : Math.floor(timeDiff * 2);                                  // 2pts/sec penalty (was 5)
    player.score += game.levelTimeBonus;
    game.levelTick = 0;
    game.state = 'levelcomplete';
    audio.sfxCampFanfare();
  }

  // Fallen off bottom
  if (player.y > level.ROWS * TS + 64) {
    hurtPlayer(true);
  }
}

function hurtPlayer(instant) {
  if (player.hurtTimer > 0 && !instant) return;
  player.health--;
  audio.sfxHurt();
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
  marmot:   { label: 'Marmot',        pts: 100 },  // medium difficulty
  mouse:    { label: 'Micro Bear',    pts: 200 },  // fairly hard — fast and small
  mosquito: { label: 'Mosquito',      pts: 300 },  // hardest — airborne, tricky to stomp
  hiker:    { label: 'Heavy Packer',  pts: 75  },  // easiest — slow and large
  redneck:  { label: 'Redneck',       pts: 150 },  // medium — beer cans make him dangerous
};

function killEnemy(e) {
  e.alive = false;
  audio.sfxStomp();
  spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#aaff44', 12, 4);
  if (e.type === 'redneck') {
    trashPiles.push(makeTrash(e.x + e.w / 2, e.y + e.h - 8));
  }
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
    audio.sfxBonus();
  }
}

// ==================== GAME STATE ====================
const game = {
  state: 'menu', // menu, playing, gameover, levelcomplete, win, enterInitials
  tick: 0,
  hiScore: parseInt(localStorage.getItem('trailBlazerHiScore')) || 0,
  levelNum: 0,
  levelTick: 0,
  levelCompletionTime: 0, // Time taken to complete current level (in frames)
  levelTimeBonus: 0, // Time bonus or penalty applied on level completion
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
  audio.sfxStartJingle();
}

function advanceLevel() {
  const nextNum = game.levelNum + 1;
  if (nextNum >= LEVELS.length) {
    game.state = 'win';
    audio.sfxWinFanfare();
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
  audio.sfxStartJingle();
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

  // Trail runners (between background trees and foreground)
  drawTrailRunners();
}

function drawTrailRunners() {
  const runnerBase = H * 0.53 + 2; // just at the tree line base
  trailRunners.forEach(r => {
    const sx = r.x - cam.x * 0.35; // parallax slightly in front of trees (0.30)
    if (sx < -30 || sx > W + 30) return;

    ctx.save();
    ctx.translate(sx, runnerBase);
    // Flip based on direction
    if (r.vx < 0) ctx.scale(-1, 1);

    // Stride phase drives all limb animation
    const stride = Math.sin(r.phase);
    const armSwing = Math.cos(r.phase);

    // Runner colors by variant
    const shirts = ['#E04040', '#2266DD', '#FF8C00'];
    const shorts = ['#222', '#333', '#1A1A4A'];
    const skin = '#D4A574';
    const shirtColor = shirts[r.variant];
    const shortColor = shorts[r.variant];

    // --- Legs ---
    ctx.strokeStyle = skin;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    // Back leg
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(-stride * 5, -2);
    ctx.lineTo(-stride * 3, 4);
    ctx.stroke();
    // Front leg
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(stride * 5, -2);
    ctx.lineTo(stride * 3, 4);
    ctx.stroke();

    // Shoes
    ctx.fillStyle = '#444';
    ctx.fillRect(stride * 3 - 2, 3, 4, 2);
    ctx.fillRect(-stride * 3 - 2, 3, 4, 2);

    // --- Shorts ---
    ctx.fillStyle = shortColor;
    ctx.fillRect(-3, -10, 6, 4);

    // --- Torso (shirt) ---
    ctx.fillStyle = shirtColor;
    ctx.fillRect(-3.5, -18, 7, 10);

    // --- Arms ---
    ctx.strokeStyle = skin;
    ctx.lineWidth = 2;
    // Back arm
    ctx.beginPath();
    ctx.moveTo(-2, -16);
    ctx.lineTo(-2 - armSwing * 4, -11);
    ctx.stroke();
    // Front arm
    ctx.beginPath();
    ctx.moveTo(2, -16);
    ctx.lineTo(2 + armSwing * 4, -11);
    ctx.stroke();

    // --- Head ---
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, -21, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Headband / visor by variant
    const bandColors = ['#FFF', '#FFD700', '#00CC66'];
    ctx.fillStyle = bandColors[r.variant];
    ctx.fillRect(-3.5, -23, 7, 2);

    // Hair behind headband
    ctx.fillStyle = '#3A2010';
    ctx.fillRect(-3, -25, 6, 2.5);

    ctx.restore();
  });
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

function drawRedneck(e) {
  const sx = Math.round(e.x - cam.x);
  const sy = Math.round(e.y - cam.y);
  const stunned = e.stunTimer > 0;
  const f = e.vx > 0 ? 1 : -1;
  ctx.save();
  ctx.translate(sx + e.w / 2, sy + e.h);
  ctx.globalAlpha = stunned ? 0.6 : 1;

  // Jeans — dark blue
  const leftSwing  = e.frame ? 6 : 0;
  const rightSwing = e.frame ? 0 : 6;
  ctx.fillStyle = stunned ? '#FFD700' : '#1A3A8A';
  ctx.fillRect(-9, -18 + leftSwing, 8, 18);
  ctx.fillRect(1, -18 + rightSwing, 8, 18);
  // Boots
  ctx.fillStyle = '#4A2A10';
  ctx.fillRect(-10, -3 + leftSwing, 9, 4);
  ctx.fillRect(0, -3 + rightSwing, 9, 4);

  // Flannel body — red plaid
  ctx.fillStyle = stunned ? '#FFD700' : '#CC3333';
  ctx.fillRect(-10, -36, 20, 20);
  if (!stunned) {
    ctx.fillStyle = '#881111';
    ctx.fillRect(-10, -32, 20, 2); ctx.fillRect(-10, -26, 20, 2);
    ctx.fillRect(-4, -36, 2, 20); ctx.fillRect(2, -36, 2, 20);
  }

  // Belly (gut — redneck is wider)
  ctx.fillStyle = stunned ? '#FFD700' : '#CC6622';
  ctx.beginPath();
  ctx.ellipse(0, -22, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head — ruddy complexion
  ctx.fillStyle = stunned ? '#FFD700' : '#CC7755';
  ctx.beginPath();
  ctx.arc(0, -44, 9, 0, Math.PI * 2);
  ctx.fill();
  // Beard
  if (!stunned) {
    ctx.fillStyle = '#886644';
    ctx.fillRect(-7, -40, 14, 7);
  }

  // Camo hat
  ctx.fillStyle = '#5A7A4A';
  ctx.fillRect(-11, -52, 22, 5); // brim
  ctx.fillRect(-8, -60, 16, 10); // crown
  if (!stunned) {
    ctx.fillStyle = '#3A5A2A';
    ctx.fillRect(-6, -58, 4, 4); ctx.fillRect(2, -55, 5, 4);
    ctx.fillStyle = '#8A7A5A';
    ctx.fillRect(-2, -60, 3, 3); ctx.fillRect(4, -57, 4, 4);
  }

  // Eyes
  ctx.fillStyle = '#222';
  ctx.fillRect(-3, -47, 3, 2); ctx.fillRect(1, -47, 3, 2);
  if (stunned) {
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-4, -48); ctx.lineTo(-1, -45); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-1, -48); ctx.lineTo(-4, -45); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1, -48); ctx.lineTo(4, -45); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, -48); ctx.lineTo(1, -45); ctx.stroke();
  }

  // Beer can in hand (when not about to throw)
  if (!stunned && e.throwTimer > 40) {
    const hx = f * 13;
    ctx.fillStyle = '#C8960A'; ctx.fillRect(hx - 3, -33, 6, 10);
    ctx.fillStyle = '#E0A010'; ctx.fillRect(hx - 3, -29, 6, 4);
    ctx.fillStyle = '#A07808'; ctx.fillRect(hx - 3, -34, 6, 2);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawTPBlooms() {
  tpBlooms.forEach(b => {
    const sx = Math.round(b.x - cam.x);
    const sy = Math.round(b.y - cam.y);
    if (sx < -20 || sx > W + 20) return;
    ctx.save();
    ctx.translate(sx + b.w / 2, sy + b.h);
    // Soiled TP wad sitting on the ground
    // Brown/yellow stain puddle underneath
    ctx.fillStyle = 'rgba(160,120,30,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, -1, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Main crumpled wad — off-white base
    ctx.fillStyle = '#E8E2D0';
    ctx.beginPath();
    ctx.moveTo(-9, -3);
    ctx.lineTo(-6, -11);
    ctx.lineTo(-1, -9);
    ctx.lineTo(3, -13);
    ctx.lineTo(7, -8);
    ctx.lineTo(9, -4);
    ctx.lineTo(5, -2);
    ctx.lineTo(-4, -2);
    ctx.closePath();
    ctx.fill();
    // Second crumpled layer, slightly darker
    ctx.fillStyle = '#D8D0B8';
    ctx.beginPath();
    ctx.moveTo(-6, -3);
    ctx.lineTo(-3, -9);
    ctx.lineTo(1, -12);
    ctx.lineTo(5, -7);
    ctx.lineTo(3, -3);
    ctx.closePath();
    ctx.fill();
    // Stain patches — yellowish-brown blobs
    ctx.fillStyle = 'rgba(150,110,20,0.5)';
    ctx.beginPath();
    ctx.ellipse(-2, -7, 3, 2, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(3, -5, 2, 1.5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Ragged edge highlight
    ctx.strokeStyle = 'rgba(200,190,165,0.6)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-7, -8);
    ctx.lineTo(-4, -10);
    ctx.lineTo(-1, -8);
    ctx.moveTo(2, -11);
    ctx.lineTo(5, -9);
    ctx.stroke();
    ctx.restore();
  });
}

function drawBeerCans() {
  beerCans.forEach(b => {
    const sx = Math.round(b.x - cam.x);
    const sy = Math.round(b.y - cam.y);
    if (sx < -20 || sx > W + 20) return;
    ctx.save();
    ctx.translate(sx + b.w / 2, sy + b.h / 2);
    ctx.rotate(game.tick * 0.25);
    // Can body
    ctx.fillStyle = '#C8960A';
    ctx.fillRect(-3, -5, 7, 10);
    // Top/bottom strips
    ctx.fillStyle = '#A07808';
    ctx.fillRect(-3, -6, 7, 2);
    ctx.fillRect(-3, 4, 7, 2);
    // Label band
    ctx.fillStyle = '#E0A820';
    ctx.fillRect(-3, -2, 7, 4);
    ctx.restore();
  });
}

function drawTrashPiles() {
  trashPiles.forEach(t => {
    const sx = Math.round(t.x - cam.x);
    const sy = Math.round(t.y - cam.y);
    if (sx < -20 || sx > W + 20) return;
    ctx.save();
    ctx.translate(sx, sy);
    if (t.variant === 0) {
      // Crushed beer can
      ctx.fillStyle = '#A07808';
      ctx.fillRect(2, 2, 10, 5);
      ctx.fillStyle = '#C8960A';
      ctx.fillRect(3, 3, 7, 3);
    } else if (t.variant === 1) {
      // Plastic wrapper
      ctx.fillStyle = 'rgba(230,230,200,0.7)';
      ctx.beginPath();
      ctx.ellipse(8, 5, 7, 3, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(180,180,160,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      // Candy wrapper
      ctx.fillStyle = '#CC2222';
      ctx.fillRect(1, 2, 13, 5);
      ctx.fillStyle = '#FFCC00';
      ctx.fillRect(4, 2, 6, 5);
    }
    ctx.restore();
  });
}

function drawFish() {
  // Fish colors: trout=brown/gold, salmon=pink/orange, bass=green/silver
  const FISH_COLORS = [
    { body: '#8B6914', belly: '#C8A040', spot: '#5A4410' },   // trout
    { body: '#D05840', belly: '#F0A080', spot: '#A03020' },   // salmon
    { body: '#4A7040', belly: '#90B080', spot: '#2A5020' },   // bass
  ];
  fish.forEach(f => {
    const sx = Math.round(f.x - cam.x);
    const sy = Math.round(f.y - cam.y);
    if (sx < -30 || sx > W + 30) return;
    const fc = FISH_COLORS[f.variant];
    const dir = f.vx >= 0 ? 1 : -1; // 1=right, -1=left
    ctx.save();
    ctx.translate(sx, sy);
    if (dir < 0) ctx.scale(-1, 1);
    // Tail
    ctx.fillStyle = fc.body;
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(-14, -5);
    ctx.lineTo(-14, 5);
    ctx.closePath();
    ctx.fill();
    // Body ellipse
    ctx.fillStyle = fc.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Belly lighter
    ctx.fillStyle = fc.belly;
    ctx.beginPath();
    ctx.ellipse(1, 1, 6, 3, 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Dorsal fin
    ctx.fillStyle = fc.spot;
    ctx.beginPath();
    ctx.moveTo(-2, -5);
    ctx.lineTo(2, -8);
    ctx.lineTo(6, -5);
    ctx.closePath();
    ctx.fill();
    // Eye
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(6, -1, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(6.5, -1.5, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
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

  } else if (type === 'water') {
    // Water bottle — clear plastic bottle with blue water
    // Bottle body
    ctx.fillStyle = 'rgba(180,220,255,0.6)';
    roundRect(-5, -2, 10, 16, 3);
    // Water fill inside
    ctx.fillStyle = '#00AAEE';
    roundRect(-4, 4, 8, 9, 2);
    // Water highlight
    ctx.fillStyle = '#44CCFF';
    roundRect(-3, 5, 4, 7, 1);
    // Bottle neck
    ctx.fillStyle = 'rgba(180,220,255,0.6)';
    ctx.fillRect(-3, -6, 6, 5);
    // Cap
    ctx.fillStyle = '#0088CC';
    roundRect(-4, -9, 8, 4, 1);
    // Cap highlight
    ctx.fillStyle = '#00AAEE';
    roundRect(-3, -8, 4, 2, 1);
    // Shine on bottle
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(-4, -1, 2, 14);
    // Water drops (condensation)
    ctx.fillStyle = 'rgba(100,200,255,0.7)';
    ctx.beginPath();
    ctx.arc(4, 2, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3, 8, 0.8, 0, Math.PI * 2);
    ctx.fill();
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

function drawCampsite() {
  const def = LEVELS[game.levelNum];
  const fx = def.goalTile[0] * TS - cam.x;
  const gy = def.goalFlagY * TS - cam.y;  // ground surface (top of end block)
  const t = game.tick;

  // === TENT (A-frame, centered on the end block) ===
  const tx = fx + 12;
  const tw = 44, th = 34;

  // Tent body (shadow side)
  ctx.fillStyle = '#3A6A7A';
  ctx.beginPath();
  ctx.moveTo(tx - tw / 2, gy);
  ctx.lineTo(tx, gy - th);
  ctx.lineTo(tx + tw / 2, gy);
  ctx.closePath();
  ctx.fill();

  // Tent highlight (sun side)
  ctx.fillStyle = '#5A9AAD';
  ctx.beginPath();
  ctx.moveTo(tx, gy - th);
  ctx.lineTo(tx + tw / 2, gy);
  ctx.lineTo(tx, gy - th * 0.28);
  ctx.closePath();
  ctx.fill();

  // Tent door (dark opening)
  ctx.fillStyle = '#162030';
  ctx.beginPath();
  ctx.moveTo(tx - 8, gy);
  ctx.lineTo(tx, gy - th * 0.58);
  ctx.lineTo(tx + 8, gy);
  ctx.closePath();
  ctx.fill();

  // Guy lines
  ctx.strokeStyle = 'rgba(190,225,240,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tx, gy - th);
  ctx.lineTo(tx - tw / 2 - 7, gy + 3);
  ctx.moveTo(tx, gy - th);
  ctx.lineTo(tx + tw / 2 + 7, gy + 3);
  ctx.stroke();

  // === CAMPFIRE (to the left, player passes it on approach) ===
  const cfx = fx - 18;
  const cfy = gy;
  const f1 = Math.sin(t * 0.22) * 1.8;
  const f2 = Math.cos(t * 0.17) * 1.4;

  // Log pile (crossed logs)
  ctx.fillStyle = '#5C3317';
  ctx.save();
  ctx.translate(cfx, cfy - 3);
  ctx.rotate(0.5);  ctx.fillRect(-9, -1.5, 18, 3);
  ctx.restore();
  ctx.save();
  ctx.translate(cfx, cfy - 3);
  ctx.rotate(-0.5);
  ctx.fillRect(-9, -1.5, 18, 3);
  ctx.restore();
  ctx.fillStyle = '#3A1E0A';
  ctx.beginPath();
  ctx.ellipse(cfx, cfy - 1, 8, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Outer flame
  ctx.fillStyle = '#FF5500';
  ctx.beginPath();
  ctx.moveTo(cfx - 7, cfy - 3);
  ctx.quadraticCurveTo(cfx - 2 + f1, cfy - 14, cfx + f2, cfy - 19 + f1);
  ctx.quadraticCurveTo(cfx + 3 + f1, cfy - 13, cfx + 7, cfy - 3);
  ctx.fill();

  // Inner flame
  ctx.fillStyle = '#FFD000';
  ctx.beginPath();
  ctx.moveTo(cfx - 3, cfy - 3);
  ctx.quadraticCurveTo(cfx + f2, cfy - 9, cfx, cfy - 13 + f1 * 0.5);
  ctx.quadraticCurveTo(cfx + 3, cfy - 9, cfx + 3, cfy - 3);
  ctx.fill();

  // Smoke wisp
  ctx.strokeStyle = `rgba(200,200,200,${0.3 + Math.sin(t * 0.07) * 0.12})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cfx, cfy - 20);
  ctx.quadraticCurveTo(cfx + 4, cfy - 30, cfx + 2, cfy - 40);
  ctx.stroke();

  // === CAMP NAME LABEL ===
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 10px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText(def.campName, tx, gy - th - 6);
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
  ctx.fillText('H2O:', 140, 22);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < player.health ? '#4169E1' : '#333';
    ctx.beginPath();
    ctx.arc(190 + i * 20, 18, 7, 0, Math.PI * 2);
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

  // Time
  const timeSeconds = Math.floor(game.levelTick / 60);
  const timeStr = `${Math.floor(timeSeconds / 60)}:${(timeSeconds % 60).toString().padStart(2, '0')}`;
  ctx.fillStyle = '#88DDFF';
  ctx.font = 'bold 12px Courier New';
  ctx.textAlign = 'left';
  ctx.fillText(`TIME: ${timeStr}`, 260, 22);
  ctx.textAlign = 'right';

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
  // Clip so mountains and other elements don't bleed into letterbox bars
  ctx.beginPath();
  ctx.rect(0, 0, LOGI_W, LOGI_H);
  ctx.clip();

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
    // Issue #30: Clarify that this is the global cloud leaderboard, not local
    ctx.fillText('GLOBAL  TOP  TRAIL  BLAZERS', LOGI_W / 2, panelY + 18);

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
  // Issue #30: Clarify that this is device-local score stored in localStorage
  if (game.hiScore > 0) {
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 14px Courier New';
    ctx.fillText(`DEVICE HI SCORE: ${game.hiScore}`, LOGI_W / 2, LOGI_H - 20);
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
  ctx.fillText('CAMP REACHED!', W / 2, H / 2 - 120);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 20px Courier New';
  ctx.fillText(def.campName, W / 2, H / 2 - 82);
  ctx.fillStyle = '#AADDFF';
  ctx.font = '12px Courier New';
  ctx.fillText(def.section, W / 2, H / 2 - 62);

  // Time and time bonus
  const timeSeconds = Math.floor(game.levelCompletionTime / 60);
  const timeStr = `${Math.floor(timeSeconds / 60)}:${(timeSeconds % 60).toString().padStart(2, '0')}`;
  const timeBonus = game.levelTimeBonus;
  const lineHeight = 26;
  let infoY = H / 2 - 30;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px Courier New';
  ctx.fillText(`Score: ${player.score}`, W / 2, infoY);
  infoY += lineHeight + 4;
  ctx.fillStyle = '#AADDFF';
  ctx.font = '14px Courier New';
  ctx.fillText('Gear: ' + items.filter(i => i.collected).length + ' / ' + items.length, W / 2, infoY);
  infoY += lineHeight;
  ctx.fillText(`Time: ${timeStr}`, W / 2, infoY);
  infoY += lineHeight;
  ctx.fillStyle = timeBonus >= 0 ? '#FFFF88' : '#FF8888';
  ctx.fillText(`${timeBonus >= 0 ? 'SPEED BONUS' : 'TIME PENALTY'} ${timeBonus >= 0 ? '+' : ''}${timeBonus}`, W / 2, infoY);
  infoY += lineHeight + 8; // extra gap before awards
  if (game.leaveNoTrace[game.levelNum]) {
    ctx.fillStyle = '#44ffaa';
    ctx.font = 'bold 16px Courier New';
    ctx.fillText('LEAVE NO TRACE +1000', W / 2, infoY);
    infoY += lineHeight;
  }
  if (game.trailAngel[game.levelNum]) {
    ctx.fillStyle = '#ff88ff';
    ctx.font = 'bold 16px Courier New';
    ctx.fillText('TRAIL ANGEL +1500', W / 2, infoY);
    infoY += lineHeight;
  }

  if (nextDef) {
    ctx.fillStyle = '#AAAAFF';
    ctx.font = '14px Courier New';
    ctx.fillText('Next: ' + nextDef.name + ' \u2014 ' + nextDef.subtitle, W / 2, infoY);
    infoY += lineHeight;
  }

  if (Math.floor(game.tick / 30) % 2 === 0) {
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 18px Courier New';
    ctx.fillText('TAP  OR  PRESS  SPACE  TO  CONTINUE', W / 2, infoY + 10);
  }
}

function drawWin() {
  ctx.fillStyle = 'rgba(0,20,0,0.85)';
  ctx.fillRect(0, 0, W, H);

  // Twinkling stars in the header area
  for (let i = 0; i < 20; i++) {
    const sx = (Math.sin(i * 137.5) * 0.5 + 0.5) * W;
    const sy = (Math.cos(i * 137.5) * 0.5 + 0.5) * 70;
    const r = 1 + Math.sin(game.tick * 0.12 + i) * 1;
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
  }

  // Fixed header
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 36px Courier New';
  ctx.shadowColor = '#AA8800'; ctx.shadowBlur = 12;
  ctx.fillText('THRU-HIKE COMPLETE!', W / 2, 42);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#88FF88';
  ctx.font = 'bold 14px Courier New';
  ctx.fillText('All ' + LEVELS.length + ' PCT sections done!', W / 2, 62);
  ctx.fillStyle = '#88DDFF';
  ctx.font = '13px Courier New';
  ctx.fillText('Final Score: ' + player.score, W / 2, 78);

  // Scrolling credits zone
  const scrollTop = 90;
  const scrollBot = H - 32;
  const scrollAreaH = scrollBot - scrollTop;
  const itemH = 22;
  const totalH = LEVELS.length * itemH + 60;

  // Advance scroll
  if (!game.winScrollY) game.winScrollY = 0;
  game.winScrollY += 0.6;
  if (game.winScrollY > totalH + scrollAreaH) game.winScrollY = 0;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, scrollTop, W, scrollAreaH);
  ctx.clip();

  ctx.font = '13px Courier New';
  LEVELS.forEach((l, i) => {
    const itemY = scrollTop + scrollAreaH - game.winScrollY + i * itemH + itemH;
    if (itemY < scrollTop - itemH || itemY > scrollBot + itemH) return;
    const lnt = game.leaveNoTrace[i];
    const ta = game.trailAngel[i];
    const awards = (lnt && ta) ? ' \u2605 LNT+Angel!' : lnt ? ' \u2605 LNT' : ta ? ' \u2605 Angel' : '';
    ctx.fillStyle = (lnt && ta) ? '#FFD700' : (lnt || ta) ? '#44ffaa' : '#AAAAFF';
    ctx.fillText((i + 1) + '. ' + l.campName + awards, W / 2, itemY);
    ctx.fillStyle = 'rgba(170,170,255,0.5)';
    ctx.font = '10px Courier New';
    ctx.fillText(l.section, W / 2, itemY + 11);
    ctx.font = '13px Courier New';
  });
  ctx.restore();

  // Fixed footer
  if (Math.floor(game.tick / 30) % 2 === 0) {
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 14px Courier New';
    ctx.fillText('TAP  OR  PRESS  SPACE  FOR  NEW  ADVENTURE', W / 2, H - 12);
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
    updateBeerCans();
    updateFish();
    updateTrailRunners();
    updateParticles();
    updateFloatTexts();
    updateCamera(player.x, player.y);
    game.levelTick++; // Start the level timer while playing

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

const touchControlsEl = document.getElementById('touch-controls');
function setTouchControlsVisible(visible) {
  if (touchControlsEl) touchControlsEl.style.display = visible ? '' : 'none';
}

function draw() {
  // Hide touch controls on non-gameplay screens so they don't cover title/UI content
  setTouchControlsVisible(game.state === 'playing');
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
    drawFish();
    drawItems();
    drawCampsite();
    enemies.forEach(e => {
      if (!e.alive) return;
      if (e.type === 'marmot') drawMarmot(e);
      else if (e.type === 'mouse') drawMouse(e);
      else if (e.type === 'mosquito') drawMosquito(e);
      else if (e.type === 'hiker') drawHiker(e);
      else if (e.type === 'redneck') drawRedneck(e);
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
    drawFish();
    drawCampsite();
    drawLevelComplete();
    return;
  }
  if (game.state === 'win') {
    drawBackground();
    drawLevel();
    drawFish();
    drawCampsite();
    drawWin();
    return;
  }

  // Playing
  drawBackground();
  drawLevel();
  drawFish();
  drawTrashPiles();
  drawTPBlooms();
  drawItems();
  drawCampsite();
  enemies.forEach(e => {
    if (!e.alive) return;
    if (e.type === 'marmot') drawMarmot(e);
    else if (e.type === 'mouse') drawMouse(e);
    else if (e.type === 'mosquito') drawMosquito(e);
    else if (e.type === 'hiker') drawHiker(e);
    else if (e.type === 'redneck') drawRedneck(e);
  });
  drawBeerCans();
  drawPlayer();
  drawParticles();
  drawFloatTexts();
  drawHUD();
}

// ==================== AUDIO ====================
const audio = (() => {
  let ctx = null;
  let masterGain = null;

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
    if (ctx.state === 'suspended') ctx.resume();
  }

  // Resume and return a Promise that resolves when ctx is running
  function ensureRunning() {
    if (!ctx) return Promise.reject();
    return ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
  }

  // ---- low-level utilities ----

  function osc(type, freq, dur, gainVal, dest, startTime) {
    const t = startTime !== undefined ? startTime : ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    g.connect(dest || masterGain);
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    o.connect(g); o.start(t); o.stop(t + dur + 0.05);
    return { osc: o, gain: g };
  }

  function oscSweep(type, freqFrom, freqTo, dur, gainVal, dest) {
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    g.connect(dest || masterGain);
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freqFrom, t);
    o.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    o.connect(g); o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, gainVal, filterFreq, dest) {
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = filterFreq || 1000; f.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || masterGain);
    src.start(t); src.stop(t + dur);
  }

  // ---- sound effects (all guard with ensureRunning) ----

  function sfx(fn) {
    ensureRunning().then(fn).catch(() => {});
  }

  function sfxJump()      { sfx(() => { oscSweep('sine', 200, 420, 0.12, 0.18); }); }
  function sfxStomp()     { sfx(() => { oscSweep('sine', 180, 60, 0.15, 0.22); noise(0.1, 0.14, 800); }); }
  function sfxCollect()   { sfx(() => { osc('sine', 880, 0.12, 0.15); osc('sine', 1320, 0.18, 0.12, masterGain, ctx.currentTime + 0.07); }); }
  function sfxHurt()      { sfx(() => { oscSweep('sawtooth', 320, 100, 0.25, 0.2); noise(0.15, 0.1, 600); }); }
  function sfxWater()     { sfx(() => { oscSweep('sine', 600, 300, 0.08, 0.08); oscSweep('sine', 500, 250, 0.08, 0.06); }); }
  function sfxSpray()     { sfx(() => { noise(0.35, 0.18, 2000); oscSweep('sawtooth', 80, 60, 0.35, 0.08); }); }
  function sfxBonus()     { sfx(() => { [523, 659, 784, 1047].forEach((f, i) => osc('sine', f, 0.2, 0.14, masterGain, ctx.currentTime + i * 0.08)); }); }
  function sfxGlissade()  { sfx(() => { noise(0.4, 0.16, 500); oscSweep('sawtooth', 260, 130, 0.4, 0.06); }); }
  function sfxStun()      { sfx(() => { oscSweep('sine', 400, 200, 0.18, 0.12); oscSweep('sine', 380, 190, 0.22, 0.08); }); }
  function sfxHeal()       { sfx(() => { osc('sine', 523, 0.15, 0.16); osc('sine', 784, 0.20, 0.14, masterGain, ctx.currentTime + 0.08); osc('sine', 1047, 0.25, 0.12, masterGain, ctx.currentTime + 0.16); }); }

  // ---- startup jingle: cheerful C-E-G run, plays at the start of every level ----
  function sfxStartJingle() {
    sfx(() => {
      const t0 = ctx.currentTime;
      const notes = [
        [261.6, 0.00], [329.6, 0.10], [392.0, 0.20], [329.6, 0.30],
        [523.3, 0.40], [392.0, 0.55], [329.6, 0.65], [523.3, 0.75],
      ];
      notes.forEach(([freq, dt]) => {
        osc('triangle', freq,     0.12, 0.18, masterGain, t0 + dt);
        osc('sine',     freq * 2, 0.08, 0.06, masterGain, t0 + dt);
      });
    });
  }

  // ---- camp fanfare: triumphant ascending run, plays on level complete ----
  function sfxCampFanfare() {
    sfx(() => {
      const t0 = ctx.currentTime;
      // C-E-G-C ascending, then held high C with harmony
      const notes = [
        [261.6, 0.00, 0.18], [329.6, 0.12, 0.18], [392.0, 0.24, 0.18],
        [523.3, 0.36, 0.50], [659.3, 0.38, 0.48],  // harmony on the high note
      ];
      notes.forEach(([freq, dt, dur]) => {
        osc('triangle', freq,     dur, 0.20, masterGain, t0 + dt);
        osc('sine',     freq / 2, dur, 0.07, masterGain, t0 + dt);
      });
    });
  }

  // ---- win fanfare: big 3-chord victory finish, plays on game complete ----
  function sfxWinFanfare() {
    sfx(() => {
      const t0 = ctx.currentTime;
      // Quick ascending run then a full chord swell
      const run = [261.6, 329.6, 392.0, 523.3, 659.3, 784.0];
      run.forEach((freq, i) => {
        osc('triangle', freq,     0.14, 0.18, masterGain, t0 + i * 0.09);
        osc('sine',     freq * 2, 0.10, 0.07, masterGain, t0 + i * 0.09);
      });
      // Final sustained chord: C major triad two octaves up
      const chordT = t0 + run.length * 0.09 + 0.05;
      [[523.3, 0.22], [659.3, 0.20], [784.0, 0.18]].forEach(([freq, gainVal]) => {
        osc('triangle', freq,     0.9, gainVal, masterGain, chordT);
        osc('sine',     freq / 2, 0.9, 0.06,   masterGain, chordT);
      });
    });
  }

  // ---- trail runner: quick footsteps whoosh past ----
  function sfxTrailRunner() {
    sfx(() => {
      // Quick pattering footsteps — short bursts of noise
      for (let i = 0; i < 5; i++) {
        noise(0.04, 0.06, 3500 + i * 200, undefined);
        // Stagger each step
        const stepG = ctx.createGain();
        const t = ctx.currentTime + i * 0.06;
        stepG.gain.setValueAtTime(0.05, t);
        stepG.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        stepG.connect(masterGain);
      }
      // Breathy whoosh as they pass
      noise(0.3, 0.07, 1800);
      oscSweep('sine', 300, 180, 0.25, 0.04);
    });
  }

  // ---- beer can throw: whoosh toss ----
  function sfxBeerCan() {
    sfx(() => {
      oscSweep('sawtooth', 350, 200, 0.12, 0.08);
      noise(0.08, 0.06, 1200);
    });
  }

  // ---- beer can hit player: metallic bonk ----
  function sfxBeerCanHit() {
    sfx(() => {
      oscSweep('square', 280, 160, 0.15, 0.1);
      noise(0.12, 0.05, 800);
    });
  }

  // ---- TP bloom: gross splat ----
  function sfxTPBloom() {
    sfx(() => {
      noise(0.35, 0.12, 350);
      oscSweep('sine', 180, 60, 0.18, 0.1);
    });
  }

  return {
    init,
    sfxJump, sfxStomp, sfxCollect, sfxHurt, sfxWater, sfxSpray, sfxBonus,
    sfxGlissade, sfxStun, sfxHeal, sfxStartJingle, sfxCampFanfare, sfxWinFanfare,
    sfxBeerCan, sfxBeerCanHit, sfxTPBloom, sfxTrailRunner,
  };
})();

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// ==================== TOUCH CONTROLS ====================
function setupTouch() {
  // Tap the canvas itself to advance menu / gameover / win screens
  canvas.addEventListener('touchstart', e => {
    audio.init();
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
