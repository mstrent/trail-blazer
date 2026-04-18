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

  await game.page.evaluate(() => window.trailBlazerDebug.pokeBoss({ hp: 4, phase: 2 }));
  await game.page.evaluate(() => window.trailBlazerDebug.forceBossAttack('groundpound'));

  const observed = new Set();
  for (let i = 0; i < 120; i++) {
    await game.waitFrames(1);
    const s = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (s && s.state === 'groundpound' && s.poundSubPhase) observed.add(s.poundSubPhase);
    if (s && s.state === 'stagger') break;
  }
  for (const phase of ['squat', 'rise', 'hold', 'slam']) {
    assert(observed.has(phase), `missing sub-phase: ${phase}`);
  }
  console.log('All four pound sub-phases observed.');
}
