function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }
async function waitFor(game, predicate, timeout = 180) {
  for (let i = 0; i < timeout; i++) {
    await game.waitFrames(1);
    const s = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (predicate(s)) return s;
  }
  return null;
}

export default async function scenario(game) {
  await game.warpToLevel(11);
  await game.waitFrames(20);

  // Phase 2: screenshot each sub-phase
  await game.page.evaluate(() => window.trailBlazerDebug.pokeBoss({ hp: 4, phase: 2 }));
  await game.page.evaluate(() => window.trailBlazerDebug.forceBossAttack('groundpound'));

  const squat = await waitFor(game, s => s && s.poundSubPhase === 'squat');
  assert(squat, 'never entered squat');
  await game.screenshot('bigfoot-pound-1-squat');

  const rise = await waitFor(game, s => s && s.poundSubPhase === 'rise');
  assert(rise, 'never entered rise');
  await game.screenshot('bigfoot-pound-2-rise');

  const hold = await waitFor(game, s => s && s.poundSubPhase === 'hold');
  assert(hold, 'never entered hold');
  await game.screenshot('bigfoot-pound-3-hold');

  const slam = await waitFor(game, s => s && s.poundSubPhase === 'slam');
  assert(slam, 'never entered slam');
  await game.screenshot('bigfoot-pound-4-slam');

  const wave = await waitFor(game, s => s && s.shockwaves.length > 0, 60);
  assert(wave && wave.shockwaves.length === 1, 'expected single wave after phase-2 pound');
  await game.screenshot('bigfoot-crescent');

  // Phase 3 dual-wave
  await waitFor(game, s => s && s.state === 'land', 180);
  await game.page.evaluate(() => window.trailBlazerDebug.pokeBoss({ hp: 2, phase: 3 }));
  await game.page.evaluate(() => window.trailBlazerDebug.forceBossAttack('groundpound-dual'));

  const dualHold = await waitFor(game, s => s && s.poundSubPhase === 'hold' && s.poundIsDual);
  assert(dualHold, 'dual hold not observed');
  await game.screenshot('bigfoot-dual-hold');

  const dualWave = await waitFor(game, s => s && s.shockwaves.length >= 2, 60);
  assert(dualWave && dualWave.shockwaves.length === 2, 'expected two simultaneous waves');
  await game.screenshot('bigfoot-dual-wave');

  console.log('Full Bigfoot scenario PASSED.');
}
