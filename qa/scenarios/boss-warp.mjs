function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

export default async function scenario(game) {
  // Boss 1: Thunderbird (level index 3)
  await game.warpToLevel(3);
  await game.waitFrames(10);
  const s1 = await game.getState();
  assert(s1.state === 'boss', `L4 Thunderbird: expected boss, got ${s1.state}`);
  assert(s1.levelNum === 3, `L4: expected levelNum 3, got ${s1.levelNum}`);
  await game.screenshot('boss-thunderbird-initial');
  console.log('Thunderbird boss state OK');

  // Boss 2: Mothman (level index 7)
  await game.warpToLevel(7);
  await game.waitFrames(10);
  const s2 = await game.getState();
  assert(s2.state === 'boss', `L8 Mothman: expected boss, got ${s2.state}`);
  assert(s2.levelNum === 7, `L8: expected levelNum 7, got ${s2.levelNum}`);
  await game.screenshot('boss-mothman-initial');
  console.log('Mothman boss state OK');

  // Boss 3: Bigfoot (level index 11)
  await game.warpToLevel(11);
  await game.waitFrames(10);
  const s3 = await game.getState();
  assert(s3.state === 'boss', `L12 Bigfoot: expected boss, got ${s3.state}`);
  assert(s3.levelNum === 11, `L12: expected levelNum 11, got ${s3.levelNum}`);
  await game.screenshot('boss-bigfoot-initial');
  console.log('Bigfoot boss state OK');

  // Normal level at index 4 (Alpine Lakes) should still be 'playing'
  await game.warpToLevel(4);
  await game.waitFrames(10);
  const s4 = await game.getState();
  assert(s4.state === 'playing', `L5 Alpine Lakes: expected playing, got ${s4.state}`);
  assert(s4.levelNum === 4, `L5: expected levelNum 4, got ${s4.levelNum}`);
  console.log('Normal level after boss OK');

  console.log('Boss warp test PASSED.');
}
