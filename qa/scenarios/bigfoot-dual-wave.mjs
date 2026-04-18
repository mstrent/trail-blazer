function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }

export default async function scenario(game) {
  await game.warpToLevel(11);

  // Wait for boss init
  let boss = null;
  for (let i = 0; i < 60; i++) {
    await game.waitFrames(1);
    boss = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (boss !== null) break;
  }
  if (!boss) throw new Error('Boss never initialized');

  await game.page.evaluate(() => window.trailBlazerDebug.pokeBoss({ hp: 2, phase: 3 }));
  await game.page.evaluate(() => window.trailBlazerDebug.forceBossAttack('groundpound-dual'));

  let maxWaves = 0;
  for (let i = 0; i < 120; i++) {
    await game.waitFrames(1);
    const s = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (s && s.shockwaves.length > maxWaves) maxWaves = s.shockwaves.length;
  }
  assert(maxWaves === 2, `expected 2 simultaneous waves, max seen was ${maxWaves}`);
}
