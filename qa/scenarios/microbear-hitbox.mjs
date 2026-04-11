// Visual QA: confirm Micro Bear hitbox is larger than before.
// The runner loads /?debug=1 so dbg.url=true and the debug overlay
// (orange hitbox outlines) is already active — no extra setup needed.
// Warps to level 3 (first level with Micro Bears) and screenshots.

export default async function scenario(game) {
  await game.warpToLevel(2);
  await game.waitFrames(20);

  // Walk right so Micro Bears are visible on screen
  await game.holdKey('ArrowRight', 40);
  await game.waitFrames(10);
  await game.screenshot('microbear-hitbox-debug');
  console.log('Screenshot saved to qa/screenshots/microbear-hitbox-debug.png');
  console.log('Inspect: orange enemy hitboxes should show ~22x18 for Micro Bears');
}
