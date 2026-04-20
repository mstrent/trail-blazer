function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }

export default async function scenario(game) {
  await game.warpToLevel(7);

  let boss = null;
  for (let i = 0; i < 60; i++) {
    await game.waitFrames(1);
    boss = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (boss !== null) break;
  }
  if (!boss) throw new Error('Mothman never initialized');
  assert(boss.type === 'mothman', `expected mothman, got ${boss.type}`);
  assert(boss.hp === 6, `expected 6 HP, got ${boss.hp}`);

  await game.page.evaluate(() => window.trailBlazerDebug.pokeBoss({ phase: 2, hp: 3 }));

  await game.page.evaluate(() => window.trailBlazerDebug.forceBossAttack('charge'));
  let beforeX = null;
  let sawRetreat = false;
  for (let i = 0; i < 35; i++) {
    await game.waitFrames(1);
    const s = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (!s) continue;
    if (s.state !== 'chargeWind') break;
    if (beforeX === null) beforeX = s.x;
    if (Math.abs(s.x - beforeX) > 20) sawRetreat = true;
  }
  assert(sawRetreat, 'boss did not retreat during chargeWind');

  let chargeY = null;
  for (let i = 0; i < 60; i++) {
    await game.waitFrames(1);
    const s = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (!s) continue;
    if (s.state === 'charge') {
      if (chargeY === null) chargeY = s.y;
      else assert(Math.abs(s.y - chargeY) < 5, `charge Y drifted: ${chargeY} → ${s.y}`);
    }
    if (s.state === 'stall') break;
  }
  assert(chargeY !== null, 'boss never entered charge state');

  for (let i = 0; i < 60; i++) {
    await game.waitFrames(1);
    const s = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (s && s.state === 'hover') break;
  }

  await game.page.evaluate(() => window.trailBlazerDebug.forceBossAttack('beam'));
  let sawBeamWind = false, sawBeam = false, sawBeamRecover = false;
  for (let i = 0; i < 110; i++) {
    await game.waitFrames(1);
    const s = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (!s) continue;
    if (s.state === 'beamWind') sawBeamWind = true;
    if (s.state === 'beam') sawBeam = true;
    if (s.state === 'beamRecover') sawBeamRecover = true;
    if (s.state === 'hover' && sawBeamRecover) break;
  }
  assert(sawBeamWind, 'beamWind never observed');
  assert(sawBeam, 'beam never observed');
  assert(sawBeamRecover, 'beamRecover never observed');
}
