# Trail Blazer — Scoring Design Reference

## Time-Based Scoring

### Theoretical Minimum Sprint Time

The baseline for time scoring is derived from first principles:

```
min_time = (levelDistance / MOVE_SPEED) / 60fps
```

`levelDistance` is stored in the `levelDistances` array (in pixels, roughly
`(COLS - 3) * 32` per level). `MOVE_SPEED = 3.5 px/tick`, `FPS = 60`.

| Level | Name | COLS | Distance (px) | Theoretical Min |
|---|---|---|---|---|
| 1 | Northern Terminus | 120 | 3,744 | ~17.8s |
| 2 | Pasayten Wilderness | 135 | 4,224 | ~20.1s |
| 3 | Glacier Peak | 150 | 4,704 | ~22.4s |
| 4 | Alpine Lakes | 165 | 5,184 | ~24.7s |
| 5 | Goat Rocks | 175 | 5,504 | ~26.2s |
| 6 | Bridge of the Gods | 185 | 5,824 | ~27.7s |
| 7 | Oregon Cascades | 200 | 6,304 | ~30.0s |
| 8 | Sky Lakes | 210 | 6,624 | ~31.5s |
| 9 | Castle Crags | 220 | 6,944 | ~33.1s |

This is the absolute floor — a straight sprint with no vertical movement, no enemies,
no platforming at all. No real playthrough can approach it.

### Target Time Multiplier: 4×

The target time used for scoring = **4× the theoretical minimum**.

**Why 4×?**

- 1× (theoretical min) is physically impossible in a real playthrough.
- 2× was nearly impossible — skilled players who skipped everything still couldn't beat it.
  This caused large negative bonuses on almost every run.
- 3× was the previous setting — good challenge but still difficult for casual players.
- 4× is the current setting: most players earn positive bonuses with reasonable effort,
  while still rewarding skilled fast playthroughs.

### Speed Bonus Formula

```js
bonus = min(500, floor(50 * 1.04^timeDiff))
```

Where `timeDiff = targetTime - actualSeconds` (positive = beat the target).

- Growth rate: 1.04× per second ahead of target — meaningful but not explosive.
- Cap: 500 points — prevents the bonus from dominating the score at high skill levels.
- At 30s ahead: ~162 pts. At 60s ahead: ~500 pts (capped).

**Why capped?** The original formula (`100 * 1.1^timeDiff`) had no cap. A 60s lead
gave 30,000+ points, completely eclipsing all other scoring. The cap keeps time skill
a meaningful but not dominant factor.

### Time Penalty Formula

```js
penalty = floor(timeDiff * 2)   // timeDiff is negative when over target
```

2 points per second over the target time.

- Finishing Level 1 in 90s (37s over): −74 pts — noticeable but not crushing.
- Finishing Level 1 in 3 min (127s over): −254 pts — significant, but recoverable.

**Why 2pts/sec?** The original was 5pts/sec, which made long casual runs feel heavily
punished. 2pts/sec keeps the incentive to move but doesn't feel hostile to explorers.

---

## Enemy Kill Scores

| Enemy | Points | Rationale |
|---|---|---|
| Mosquito | 300 | Hardest — airborne, tricky to time stomp |
| Mouse (Micro Bear) | 200 | Fairly hard — fast and small hitbox |
| Redneck | 150 | Medium — throws beer cans, requires approach caution |
| Marmot | 100 | Medium — standard ground enemy |
| Heavy Hiker | 75 | Easiest — slow and large, straightforward stomp |

Points reflect **kill difficulty**, not enemy threat. The Heavy Packer does the most
damage and is the scariest enemy, but it's the easiest to stomp — slow, big hitbox,
predictable patrol. Mosquitoes are the opposite: low threat but genuinely hard to stomp
consistently due to their sine-wave flight path.

**Fish are not enemies and award no points.** They are decorative only.

---

## Achievement Bonuses

| Achievement | Condition | Bonus |
|---|---|---|
| Leave No Trace | Collect every item on a level | +1,000 pts |
| Trail Angel | Defeat every enemy on a level | +1,500 pts |

Together these total +2,500, which intentionally outweighs the max speed bonus (+500)
by 5×, rewarding completionist play over pure speed.

---

## Tuning Notes

- **Time multiplier (4×)** is the primary lever for difficulty. Raise it to make casual
  play penalty-free; lower it to pressure experienced players.
- **Penalty rate (2pts/sec)** could be raised to 3–4 if time pressure needs to feel
  more significant.
- **Speed bonus cap (500)** could be raised or removed if speed-running should be more
  heavily rewarded relative to combat/collection scores.
- **Leave No Trace + Trail Angel together (+2,500)** currently outweigh the max speed
  bonus (+500) by 5×, intentionally rewarding completionist play over pure speed.
