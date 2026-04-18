function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }

// Regression test for the leftward-shockwave hitbox bug.
//
// The original buggy code in updateBigfoot pinned the leftward wave's hitbox at
// x=0 (instead of tracking sw.x), so a leftward-moving wave could only ever
// damage a player standing in the leftmost 60px of the arena.
//
// We inject a leftward wave directly via pokeBoss, place the player squarely in
// its path on the ground, and assert the player takes damage as the wave passes.
// We give the player health=1 so a single hit decrements lives, which we can
// observe via getState().
export default async function scenario(game) {
  await game.warpToLevel(11);
  await game.waitFrames(10);

  // Wait for the boss to initialize.
  let boss = null;
  for (let i = 0; i < 60; i++) {
    await game.waitFrames(1);
    boss = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (boss !== null) break;
  }
  if (!boss) throw new Error('Boss never initialized');

  // Park the boss far away in a benign state so it doesn't interfere.
  assert(await game.page.evaluate(() => window.trailBlazerDebug.pokeBoss({
    hp: 8, phase: 1, x: 700, state: 'land', stateTimer: 9999,
    boulders: [], shockwaves: [],
  })), 'pokeBoss failed');

  // Player on the ground in the middle of the arena, in the path of the wave.
  // health=1 + lives=2 ensures the next hit drops lives by 1 (observable via
  // getState) without ending the game.
  assert(await game.page.evaluate(() => window.trailBlazerDebug.pokePlayer({
    x: 400, y: 690, vx: 0, vy: 0, hurtTimer: 0, health: 1, lives: 2,
  })), 'pokePlayer failed');

  // One physics tick so player.onGround = true (wave check requires it).
  await game.waitFrames(1);

  // Inject a leftward-moving wave east of the player. With the bug present,
  // this wave's hitbox is pinned at x=0..60 and will never touch the player
  // at x=400..420. With the fix, the hitbox tracks sw.x and damages the player
  // as the wave passes.
  assert(await game.page.evaluate(() => window.trailBlazerDebug.pokeBoss({
    shockwaves: [{ x: 600, dir: -1, speed: 7, alpha: 0.85, active: true }],
  })), 'pokeBoss(inject wave) failed');

  const livesBefore = (await game.getState()).playerLives;

  for (let i = 0; i < 100; i++) {
    await game.waitFrames(1);

    // Re-park boss + re-pin player every frame to keep the test isolated.
    await game.page.evaluate(() => window.trailBlazerDebug.pokeBoss({
      x: 700, state: 'land', stateTimer: 9999,
    }));
    await game.page.evaluate(() => window.trailBlazerDebug.pokePlayer({
      x: 400, y: 690, vx: 0, vy: 0,
    }));

    const s = await game.getState();
    if (s.playerLives < livesBefore) {
      console.log(`Player was hit by leftward wave at frame ${i} as expected.`);
      return;
    }

    const bs = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    const leftWave = bs && bs.shockwaves.find(sw => sw.dir < 0 && sw.active);
    if (!leftWave) {
      throw new Error(`Leftward shockwave deactivated without damaging the player (hitbox bug still present). Frame ${i}.`);
    }
    if (leftWave.x + 30 < s.playerX) {
      throw new Error(`Leftward shockwave passed the player without damage (hitbox bug still present). Wave at x=${leftWave.x}, player at x=${s.playerX}, frame ${i}.`);
    }
  }

  throw new Error('Leftward shockwave never damaged the player within 100 frames (hitbox bug still present).');
}
