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

  // Cycle the boss through ~50 attacks at phase 2; count ground pounds.
  let pounds = 0;
  let totalAttacks = 0;
  let lastState = null;
  for (let i = 0; i < 60 * 60; i++) { // up to ~60s of simulation
    await game.waitFrames(1);
    if (totalAttacks >= 50) break;
    const s = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (!s) continue;
    const isAttack = ['leap', 'groundpound', 'windup'].includes(s.state);
    const wasAttack = ['leap', 'groundpound', 'windup'].includes(lastState);
    if (isAttack && !wasAttack) {
      totalAttacks++;
      if (s.state === 'groundpound') pounds++;
    }
    lastState = s.state;
  }
  const ratio = pounds / totalAttacks;
  console.log(`Phase 2: ${pounds}/${totalAttacks} pounds (${(ratio * 100).toFixed(0)}%)`);
  // Loose bounds because 50 samples is noisy; target is 0.35.
  assert(ratio > 0.15 && ratio < 0.55, `phase-2 pound ratio ${ratio} outside expected range`);
}
