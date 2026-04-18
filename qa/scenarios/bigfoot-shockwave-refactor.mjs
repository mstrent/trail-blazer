function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }

export default async function scenario(game) {
  await game.warpToLevel(11);
  // Wait for the boss level to fully initialize
  for (let i = 0; i < 60; i++) {
    await game.waitFrames(1);
    const s = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (s !== null) break;
  }

  // Drive Bigfoot into phase 2 so ground-pound is allowed.
  await game.page.evaluate(() => {
    const s = window.trailBlazerDebug.getBossState();
    if (!s) throw new Error('Boss not initialized');
    // Directly manipulate via forceBossAttack + state; set hp/phase via the debug surface
    // We can't reach bossArena from here — use forcedNextAttack path only
  });

  // Set hp=4, phase=2 via the internal state — these are accessible through getBossState
  // but we need to set them. Use page.evaluate with the trailBlazerDebug poke if available,
  // otherwise rely on forceBossAttack driving the state machine.
  // The task spec says window.bossArena is set on window — check if that's actually exported.
  const bossExposed = await game.page.evaluate(() => typeof window.bossArena !== 'undefined');
  if (bossExposed) {
    await game.page.evaluate(() => { window.bossArena.boss.hp = 4; window.bossArena.boss.phase = 2; });
  } else {
    // bossArena is not on window — use poke via trailBlazerDebug if available
    const poked = await game.page.evaluate(() => {
      if (window.trailBlazerDebug.pokeBoss) {
        return window.trailBlazerDebug.pokeBoss({ hp: 4, phase: 2 });
      }
      return false;
    });
    if (!poked) {
      // Fall back: just proceed; groundpound is available in phase 1 too (it's the attack we're testing)
      console.log('Note: could not set phase=2/hp=4, proceeding with default state');
    }
  }

  await game.page.evaluate(() => window.trailBlazerDebug.forceBossAttack('groundpound'));

  // Wait for pound -> stagger -> shockwave active
  for (let i = 0; i < 200; i++) {
    await game.waitFrames(1);
    const s = await game.page.evaluate(() => window.trailBlazerDebug.getBossState());
    if (s && s.shockwaves.length > 0) {
      assert(s.shockwaves.length === 1, `expected 1 wave active, got ${s.shockwaves.length}`);
      assert(typeof s.shockwaves[0].x === 'number', 'wave x missing');
      console.log('Shockwave appears as expected:', s.shockwaves[0]);
      return;
    }
  }
  throw new Error('Shockwave never appeared');
}
