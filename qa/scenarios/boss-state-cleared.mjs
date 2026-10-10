// Regression for #102: getBossState() must return null once a trail level loads.
function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }
const bossState = game => game.page.evaluate(() => window.trailBlazerDebug.getBossState());

export default async function scenario(game) {
  await game.warpToLevel(11);
  await game.waitFrames(10);
  const inArena = await bossState(game);
  assert(inArena && inArena.type === 'bigfoot', `expected bigfoot in arena, got ${JSON.stringify(inArena)}`);

  await game.warpToLevel(0);
  await game.waitFrames(10);
  const s = await game.getState();
  assert(s.state === 'playing', `expected playing after warp to 0, got ${s.state}`);
  assert(await bossState(game) === null, 'getBossState() should be null on a trail level');

  // Boss -> boss still swaps to the new boss
  await game.warpToLevel(3);
  await game.waitFrames(5);
  await game.warpToLevel(7);
  await game.waitFrames(5);
  const mothman = await bossState(game);
  assert(mothman && mothman.type === 'mothman', `expected mothman, got ${JSON.stringify(mothman)}`);

  console.log('boss-state-cleared PASSED');
}
