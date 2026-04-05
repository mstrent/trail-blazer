# Trail Blazer — Scoring Design Reference

## Time-Based Scoring

### Theoretical Minimum Sprint Time

The baseline for time scoring is derived from first principles:

```
min_time = (goalTile * 32px) / MOVE_SPEED / 60fps
```

| Level | Goal Tile | Distance | Theoretical Min |
|---|---|---|---|
| Meadow Trail | x=117 | 3,744 px | ~17.8s |
| Pine Ridge | x=147 | 4,704 px | ~22.4s |
| Alpine Pass | x=177 | 5,664 px | ~27.0s |

`MOVE_SPEED = 3.5 px/tick`, `FPS = 60`

This is the absolute floor — a straight sprint with no vertical movement, no enemies, no platforming at all. No real playthrough can approach it.

### Target Time Multiplier: 3×

The target time used for scoring = **3× the theoretical minimum**:

| Level | Target Time |
|---|---|
| Meadow Trail | ~53s |
| Pine Ridge | ~67s |
| Alpine Pass | ~81s |

**Why 3×?**

- 1× (theoretical min) is physically impossible in a real playthrough.
- 2× (≈37s/47s/56s) — the original formula — was also nearly impossible. A skilled player who skips all enemies and gear still couldn't beat it consistently. This caused large negative bonuses on almost every run.
- 4× (≈71s/90s/108s) was considered but felt too forgiving — little pressure to move quickly.
- 3× is the sweet spot: a fast, focused run that skips most enemies and some gear can beat the target; a casual exploratory run ends up slightly under.

### Speed Bonus Formula

```js
bonus = min(500, floor(50 * 1.04^timeDiff))
```

Where `timeDiff = targetTime - actualSeconds` (positive = beat the target).

- Growth rate: 1.04× per second ahead of target — meaningful but not explosive.
- Cap: 500 points — prevents the bonus from dominating the score at high skill levels.
- At 30s ahead: ~162 pts. At 60s ahead: ~500 pts (capped).

**Why capped?** The original formula (`100 * 1.1^timeDiff`) had no cap. A 60s lead gave 30,000+ points, completely eclipsing all other scoring. The cap keeps time skill a meaningful but not dominant factor.

### Time Penalty Formula

```js
penalty = floor(timeDiff * 2)   // timeDiff is negative when over target
```

2 points per second over the target time.

- Finishing Level 1 in 90s (37s over): −74 pts — noticeable but not crushing.
- Finishing Level 1 in 3 min (127s over): −254 pts — significant, but recoverable through gear collection and enemy bonuses.

**Why 2pts/sec?** The original was 5pts/sec, which made long casual runs feel heavily punished. 2pts/sec keeps the incentive to move but doesn't feel hostile to players who want to explore.

---

## Other Scoring Elements

| Source | Points | Rationale |
|---|---|---|
| Mosquito kill | 300 | Hardest — airborne, tricky to time stomp |
| Micro Bear kill | 200 | Fairly hard — fast and small hitbox |
| Marmot kill | 100 | Medium — standard ground enemy |
| Heavy Packer kill | 75 | Easiest — slow and large, straightforward stomp |
| Leave No Trace bonus (all gear collected) | +1,000 | |
| Trail Angel bonus (all enemies killed) | +1,500 | |
| Speed bonus | up to +500 | |

### Kill Score Design Notes

Points reflect kill difficulty, not enemy threat. The Heavy Packer does the most
damage and is the scariest enemy, but it's the easiest to stomp — slow, big
hitbox, predictable patrol. Mosquitoes are the opposite: low threat but genuinely
hard to stomp consistently due to their sine-wave flight path.

Previous values (Hiker 300, Mosquito 150, Marmot 100, Mouse 75) rewarded killing
the easiest enemy most heavily, which was backwards. Range kept at 75–300.
| Time penalty | −2pts/sec over target |

### Tuning Notes

- The time multiplier (currently 3×) is the primary lever for difficulty. Raise it to make casual play penalty-free; lower it to pressure experienced players.
- The penalty rate (2pts/sec) could be raised to 3–4 if time pressure needs to feel more significant.
- The speed bonus cap (500) could be raised or removed if speed-running should be more heavily rewarded relative to combat/collection scores.
- Leave No Trace + Trail Angel together (+2,500) currently outweigh the max speed bonus (+500) by 5×, which intentionally rewards completionist play over pure speed.
