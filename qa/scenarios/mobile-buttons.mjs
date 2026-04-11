// Visual QA: screenshot the full page to evaluate mobile action button sizing
// in landscape orientation.
//
// This scenario opts into the runner's `mobile-landscape` device preset via
// the `options` export below. That gives the page context `hasTouch: true`
// and `isMobile: true`, so the game's `(hover: none) and (pointer: coarse)`
// media query matches naturally — no CSS injection needed. The viewport
// dimensions make `(orientation: landscape)` match, activating the landscape
// touch overlay from style.css.

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const options = { device: 'mobile-landscape' };

export default async function scenario(game) {
  await game.warpToLevel(0);
  await game.waitFrames(10);

  // Use Playwright's full-page screenshot to capture DOM elements (canvas + buttons)
  const buf = await game.page.screenshot({ fullPage: false });
  const outPath = resolve(__dirname, '..', 'screenshots', 'mobile-buttons-landscape.png');
  writeFileSync(outPath, buf);
  console.log('Screenshot saved to qa/screenshots/mobile-buttons-landscape.png');
  console.log('Inspect: SLIDE/SPRAY/JUMP buttons bottom-right, arrow buttons bottom-left.');
  console.log('Right panel should be visibly larger than left. No overflow.');
}
