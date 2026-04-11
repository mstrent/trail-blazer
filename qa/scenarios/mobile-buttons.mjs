// Visual QA: screenshot the full page to evaluate mobile action button sizing.
// The CSS media query requires `pointer: coarse` which Playwright doesn't set
// by default, so we inject a style override to force the landscape touch layout.
// We use page.screenshot() (not the canvas API) to capture the full page DOM
// including the touch-controls overlay.

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function scenario(game) {
  await game.page.setViewportSize({ width: 844, height: 390 });
  await game.warpToLevel(0);
  await game.waitFrames(10);

  // Force the landscape touch controls visible by overriding display and applying
  // the landscape positioning directly — bypasses the pointer:coarse media query.
  await game.page.evaluate(() => {
    const tc = document.getElementById('touch-controls');
    const tl = document.getElementById('touch-left');
    const tr = document.getElementById('touch-right');

    // Mirror the landscape @media overrides from style.css
    Object.assign(tc.style, {
      display: 'flex', position: 'fixed', bottom: '0', left: '0', right: '0',
      height: 'auto', padding: '0', gap: '0', justifyContent: 'space-between',
      zIndex: '10', background: 'none', pointerEvents: 'none',
    });
    Object.assign(tl.style, {
      position: 'fixed', bottom: '8px', left: '8px',
      width: 'clamp(108px, 21.6vw, 168px)', height: 'clamp(53px, 10.8vw, 78px)', gap: '4px',
    });
    Object.assign(tr.style, {
      position: 'fixed', bottom: '8px', right: '8px', gap: '3px',
      // These are the NEW values — the ones being tested:
      width: 'clamp(140px, 26vw, 200px)', height: 'clamp(90px, 17vw, 130px)',
    });
  });

  // Use Playwright's full-page screenshot to capture DOM elements (canvas + buttons)
  const buf = await game.page.screenshot({ fullPage: false });
  const outPath = resolve(__dirname, '..', 'screenshots', 'mobile-buttons-landscape.png');
  writeFileSync(outPath, buf);
  console.log('Screenshot saved to qa/screenshots/mobile-buttons-landscape.png');
  console.log('Inspect: SLIDE/SPRAY/JUMP buttons bottom-right, arrow buttons bottom-left.');
  console.log('Right panel should be visibly larger than left. No overflow.');
}
