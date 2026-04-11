// Visual QA: confirm the mobile-portrait device preset activates the touch UI.
//
// On portrait mobile, style.css shows the `#touch-controls` block via the
// `(hover: none) and (pointer: coarse)` media query (without the landscape
// overrides). This scenario verifies: (1) the runner preset wires that up
// without any per-scenario CSS hacks, (2) the controls are actually visible,
// and (3) the media-query signals the game cares about are all reporting
// the expected values.

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

export const options = { device: 'mobile-portrait' };

export default async function scenario(game) {
  await game.warpToLevel(0);
  await game.waitFrames(10);

  const probe = await game.page.evaluate(() => {
    const tc = document.getElementById('touch-controls');
    return {
      hoverNone: matchMedia('(hover: none)').matches,
      pointerCoarse: matchMedia('(pointer: coarse)').matches,
      portrait: matchMedia('(orientation: portrait)').matches,
      touchDisplay: tc ? getComputedStyle(tc).display : 'missing',
      innerW: window.innerWidth,
      innerH: window.innerHeight,
    };
  });

  assert(probe.hoverNone, `expected (hover: none) to match, got ${probe.hoverNone}`);
  assert(probe.pointerCoarse, `expected (pointer: coarse) to match, got ${probe.pointerCoarse}`);
  assert(probe.portrait, `expected portrait orientation (got ${probe.innerW}x${probe.innerH})`);
  assert(
    probe.touchDisplay === 'flex',
    `expected #touch-controls display:flex, got "${probe.touchDisplay}"`
  );

  const buf = await game.page.screenshot({ fullPage: false });
  const outPath = resolve(__dirname, '..', 'screenshots', 'mobile-buttons-portrait.png');
  writeFileSync(outPath, buf);
  console.log('Screenshot saved to qa/screenshots/mobile-buttons-portrait.png');
  console.log('Inspect: touch controls docked along the bottom, no landscape overlay.');
}
