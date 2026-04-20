// Verifies bear spray plays a sound effect in both normal and boss levels.
// Instruments AudioContext prototypes to count audio-node creations, then
// asserts the counter advances after each spray press.
//
// Note: audio.init() fires on real keydown events, not the debug API, so
// we dispatch a real keypress through Playwright once to bootstrap the
// AudioContext before patching.

function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

async function instrumentAudio(page) {
  await page.evaluate(() => {
    window.__sfxNodeCount = 0;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const origOsc = Ctx.prototype.createOscillator;
    const origBuf = Ctx.prototype.createBufferSource;
    Ctx.prototype.createOscillator = function () {
      window.__sfxNodeCount++;
      return origOsc.call(this);
    };
    Ctx.prototype.createBufferSource = function () {
      window.__sfxNodeCount++;
      return origBuf.call(this);
    };
  });
}

async function getNodeCount(page) {
  return page.evaluate(() => window.__sfxNodeCount);
}

export default async function scenario(game) {
  await instrumentAudio(game.page);

  // Trigger a real keydown to initialise AudioContext (debug pressKey bypasses listeners).
  await game.page.keyboard.press('KeyZ');

  // --- Normal level: Level 1 ---
  await game.warpToLevel(0);
  await game.waitFrames(30);

  const beforeNormal = await getNodeCount(game.page);
  await game.pressKey('KeyX');
  await game.waitFrames(4);
  await game.releaseKey('KeyX');
  await game.waitFrames(10);
  const afterNormal = await getNodeCount(game.page);
  const normalDelta = afterNormal - beforeNormal;
  // sfxSpray creates: 2 buffer sources (noise burst + hiss) + 1 oscillator (sweep) = 3.
  assert(normalDelta >= 3, `Normal-level spray created ${normalDelta} audio nodes, expected >=3`);
  console.log(`Normal-level spray created ${normalDelta} audio nodes OK`);

  // --- Boss arena: Bigfoot (level 11) ---
  await game.warpToLevel(11);
  await game.waitFrames(90);
  const state = await game.getState();
  assert(state.state === 'boss', `Expected boss state, got '${state.state}'`);

  const beforeBoss = await getNodeCount(game.page);
  await game.pressKey('KeyX');
  await game.waitFrames(4);
  await game.releaseKey('KeyX');
  await game.waitFrames(10);
  const afterBoss = await getNodeCount(game.page);
  const bossDelta = afterBoss - beforeBoss;
  assert(bossDelta >= 3, `Boss-arena spray created ${bossDelta} audio nodes, expected >=3`);
  console.log(`Boss-arena spray created ${bossDelta} audio nodes OK`);

  console.log('Bear spray SFX scenario passed.');
}
