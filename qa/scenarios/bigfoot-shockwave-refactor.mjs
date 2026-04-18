function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }

export default async function scenario(game) {
  await game.warpToLevel(11);

  // Wait for the boss to initialize.
  let boss = null;
  for (let i = 0; i < 60; i++) {
    await game.waitFrames(1);
    boss = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (boss !== null) break;
  }
  if (!boss) throw new Error('Boss never initialized');

  await game.page.evaluate(() => window.trailBlazerDebug.forceBossAttack('groundpound'));

  for (let i = 0; i < 200; i++) {
    await game.waitFrames(1);
    const s = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (s && s.shockwaves.length > 0) {
      assert(s.shockwaves.length === 1, `expected 1 wave active, got ${s.shockwaves.length}`);
      assert(typeof s.shockwaves[0].x === 'number', 'wave x missing');
      return;
    }
  }
  throw new Error('Shockwave never appeared');
}
