// Smoke test: warp to levels 1 and 3, verify player state, screenshot initial frames.
export default async function scenario(game) {
  // --- Level 1 ---
  await game.warpToLevel(0);
  await game.waitFrames(10);

  const s1 = await game.getState();
  console.assert(s1.state === 'playing', `L1: expected playing, got ${s1.state}`);
  console.assert(s1.levelNum === 0, `L1: expected levelNum 0, got ${s1.levelNum}`);
  console.assert(s1.playerLives === 3, `L1: expected 3 lives, got ${s1.playerLives}`);
  await game.screenshot('smoke-level-1-initial');
  console.log('Level 1 initial state OK');

  // Walk right for 2 seconds; player should survive
  await game.holdKey('ArrowRight', 120);
  await game.waitFrames(10);
  const s1w = await game.getState();
  console.assert(s1w.playerLives > 0, `L1: player died walking right`);
  await game.screenshot('smoke-level-1-after-walk');
  console.log('Level 1 walk OK');

  // --- Level 3 ---
  await game.warpToLevel(2);
  await game.waitFrames(10);

  const s3 = await game.getState();
  console.assert(s3.state === 'playing', `L3: expected playing, got ${s3.state}`);
  console.assert(s3.levelNum === 2, `L3: expected levelNum 2, got ${s3.levelNum}`);
  await game.screenshot('smoke-level-3-initial');
  console.log('Level 3 initial state OK');

  console.log('Smoke test passed.');
}
