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
| `←` `→` / `A` `D` | Move |
| `↑` / `W` / `Z` / `Space` | Jump (hold for higher jump) |
| `↓` + Jump | **Trekking Pole Pogo** — super-high bounce |
| `X` | **Bear Spray** — stuns nearby enemies |

**Stomp mechanic:** jump on a stunned enemy to defeat it. Stomping an unstunned enemy stuns it first.

## Objective

Make it from the trailhead to the **summit flag** at the far right. Collect ultralight gear along the way to build your score.

## Enemies

| Enemy | Behavior |
|-------|----------|
| 🐿 Marmot | Patrols platforms, turns at ledges |
| 🦟 Mosquito | Floats in a sine-wave pattern |
| 🧳 Overloaded Hiker | Slow but wide, comically massive pack |

## Collectibles

| Item | Points |
|------|--------|
| Titanium Spork | 100 |
| Protein Bar | 50 |
| Water Filter | 200 |
| Cuben Fiber Tent | 500 |
| Bear Spray Refill | 150 |

## Level Layout

The trail runs through five sections:

1. **Meadow** — gentle hills, easy start
2. **Forest** — log platforms through the tree canopy
3. **Creek Crossing** — stepping stones over a water hazard
4. **Rocky Slope** — ascending ledges
5. **Alpine Approach** — exposed platforms to the summit

## Tech

- Pure HTML5 Canvas 2D — all rendering is canvas primitives, no images
- Single `game.js` file (~700 lines), no build step
- 60 fps game loop via `requestAnimationFrame`
- Tile-based collision with one-way platforms
