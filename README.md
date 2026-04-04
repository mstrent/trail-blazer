# Trail Blazer 🏔️

A Commander Keen-style side-scrolling platformer with an ultralight backpacking theme. Built with pure HTML5 Canvas — no frameworks, no dependencies.

![Game Screenshot](https://github.com/mstrent/trail-blazer/raw/master/screenshot.png)

## Play

Open `index.html` in any modern browser, or serve locally:

```bash
python -m http.server 3000
```

Then visit `http://localhost:3000`.

## Controls

| Key | Action |
|-----|--------|
| `←` `→` / `A` `D` | Move left/right |
| `↑` / `W` / `Z` / `Space` | Jump (hold for higher jump) |
| `↓` + `←`/`→` | **Glissade** — sit-slide down hills to stun enemies (cooldown: 90 frames) |
| `X` / `F` | **Bear Spray** — stuns nearby enemies (cooldown: 60 frames) |
| `S` | Crouch / Glissade modifier |

**Combat:** Stomp on stunned enemies by jumping on them to defeat and score. On-screen buttons available on mobile devices.

## Objective

Navigate from the **trailhead to the summit flag** at the far right of each level. Progress through all 3 trails to reach the ultimate summit! 

Collect ultralight gear along the way to build your score. Each trail remembers your score and lives as you advance. Two special achievements provide bonus points:

- **Leave No Trace** (+1000 pts) — Collect every item on a trail
- **Trail Angel** (+1500 pts) — Defeat every enemy on a trail

## Enemies

| Enemy | Behavior | Points |
|-------|----------|--------|
| 🐿 Marmot | Patrols platforms, turns at ledges and walls | 100 |
| 🐭 Micro Bear | Fast ground-dweller, speeds past platforms | 75 |
| 🦟 Mosquito | Floats in a sine-wave pattern, reverses at walls | 150 |
| 🧳 Overloaded Hiker | Heavy slow walker with a massive pack, patrols platforms | 300 |

All enemies can be stunned with **Bear Spray** or by landing on them while jumping. Stomp stunned enemies to defeat them and score points.

## Collectibles

| Item | Points | Purpose |
|------|--------|---------|
| Titanium Spork | 100 | Ultralight utensil |
| Protein Bar | 50 | Trail fuel |
| Water Filter | 200 | Essential gear |
| Cuben Fiber Tent | 500 | Shelter |
| Bear Spray Refill | 150 | Combat consumable |

Collect all items on a trail to earn the **Leave No Trace** award and a 1000-point bonus!

## Scoring System

- **Base score:** Collect items and defeat enemies
- **High score tracking:** Persisted to browser `localStorage`
- **Leaderboard:** Top 10 players (cloud-synced to Firebase)
- **Initials entry:** When you break the top 10, enter your 3-letter name for the leaderboard
- **Achievements:** Earn bonuses for exceptional play:
  - **Leave No Trace:** Collect every item on a trail (+1000)
  - **Trail Angel:** Defeat every enemy on a trail (+1500)

## Mobile Support

Trail Blazer is fully responsive and supports:
- **Portrait mode:** On-screen touch buttons at the bottom (move left/right, jump, slide, spray)
- **Landscape mode:** Full-screen canvas with semi-transparent overlay controls in corners
- Optimized touch detection and button sizing for all screen sizes
- Keyboard input on desktop

## Progression

Progress persists across levels:
- Your score carries forward as you complete each trail
- Your remaining lives carry forward (lose a life on any trail = restart that trail)
- Achievements track which trails you've mastered
- Game ends when you run out of lives

## Level Layout

The game spans **3 complete trails**, each with multiple sections and escalating difficulty:

### 1. **Meadow Trail** 
Gentle rolling hills through wildflower meadows. Start your adventure here with platform jumping, basic enemy encounters, and introductory collectible challenges.

### 2. **Pine Ridge**
Dense forest adventure with treacherous ravines. Navigate through canopy platforms, cross water hazards via stepping stones, and face increasingly challenging enemy placements. The first ravine tests your glissade technique.

### 3. **Alpine Pass**
The final ascent above the treeline. Exposed platforms with sheer drops, boulder fields, switchback climbs, and exposed ridges. Culminates in a scree field push to the final summit flag.

Each trail includes:
- Solid terrain blocks and one-way platforms
- Water hazards (instadeath if touched)
- Enemy patrols with varied patterns
- Scattered collectible gear
- A summit flag marking the trail's end

## Tech

- **Pure HTML5 Canvas 2D** — all rendering uses canvas primitives (ellipses, rects, paths, gradients), no sprite sheets or image assets
- **No frameworks, no dependencies** — ~2350 lines of vanilla JavaScript, single `game.js` file, no build step
- **Deterministic procedural generation** — background parallax layers use seeded PRNGs for consistent visuals
- **Tile-based collision system** — 32px tile grid with tile types: solid, one-way platform, water, empty
- **60 fps game loop** — `requestAnimationFrame` with fixed update and render stages
- **Multi-level architecture** — Level definitions contain map builder, item spawns, enemy spawns, goal position
- **Responsive canvas scaling** — Adapts to landscape mobile orientation while maintaining aspect ratio
- **Touch event handling** — Custom touch binding system for mobile buttons, separate from keyboard input
- **Leaderboard integration** — Firebase Firestore for top 10 score persistence and real-time sync
- **Browser storage** — `localStorage` for high score and local leaderboard caching
