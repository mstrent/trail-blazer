// Verifies the unified viewport-to-game mapping produces the expected
// scale, H_logical, and overlayMode for a representative viewport.
// To exercise multiple viewports, run this scenario once per device preset
// (the runner's --device flag takes care of that).

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

// Expected layout values per device viewport (hand-computed from the spec).
const EXPECTATIONS = {
  // desktop 1280x720: aspect 1.78, below threshold 2.167 → margin mode
  'desktop': {
    overlayMode: 'margin',
    H_logical: 480,
    scaleNear: 1.50, // min(1280/800, 720/480) = min(1.6, 1.5) = 1.5
  },
  // mobile-landscape 844x390: aspect 2.164, right at the threshold 2.167.
  // Accept either mode and verify math is self-consistent.
  'mobile-landscape': {
    validate(layout) {
      if (layout.overlayMode === 'canvas') {
        const expectedScale = 844 / 800;
        assert(Math.abs(layout.scale - expectedScale) < 0.01,
          `canvas-mode scale should ~= ${expectedScale}, got ${layout.scale}`);
        assert(layout.H_logical <= 480,
          `canvas-mode H_logical should <= 480, got ${layout.H_logical}`);
      } else {
        const expectedScale = Math.min(844 / 800, 390 / 480);
        assert(Math.abs(layout.scale - expectedScale) < 0.01,
          `margin-mode scale should ~= ${expectedScale}, got ${layout.scale}`);
        assert(layout.H_logical === 480, 'margin-mode H_logical should be 480');
      }
    },
  },
  // mobile-portrait 393x727: aspect 0.54, deep below threshold → margin mode
  'mobile-portrait': {
    overlayMode: 'margin',
    H_logical: 480,
    scaleNear: 393 / 800, // fit by width
  },
  // desktop-fhd 1920x1080: aspect 1.78 → margin mode
  'desktop-fhd': {
    overlayMode: 'margin',
    H_logical: 480,
    scaleNear: 2.25, // min(1920/800, 1080/480) = min(2.4, 2.25) = 2.25
  },
  // desktop-4k 3840x2160: aspect 1.78 → margin mode
  'desktop-4k': {
    overlayMode: 'margin',
    H_logical: 480,
    scaleNear: 4.50, // min(3840/800, 2160/480) = min(4.8, 4.5) = 4.5
  },
  // desktop-ultrawide 3440x1440: aspect 2.39 → canvas mode (above threshold 2.167)
  'desktop-ultrawide': {
    overlayMode: 'canvas',
    // H_logical = floor(1440 / (3440/800)) = floor(1440 / 4.3) = 334
    H_logical: 334,
    scaleNear: 3440 / 800,
  },
  // tablet-landscape 1194x834: aspect 1.43 → margin mode (fit by width)
  'tablet-landscape': {
    overlayMode: 'margin',
    H_logical: 480,
    scaleNear: 1194 / 800, // min(1194/800, 834/480) = min(1.49, 1.74) = 1.49
  },
  // tablet-portrait 768x1024: aspect 0.75 → margin mode (fit by width)
  'tablet-portrait': {
    overlayMode: 'margin',
    H_logical: 480,
    scaleNear: 768 / 800,
  },
};

export default async function scenario(game) {
  const device = process.env.QA_DEVICE || 'desktop';
  const expect = EXPECTATIONS[device] || EXPECTATIONS['desktop'];

  await game.waitFrames(3);
  const layout = await game.page.evaluate(() => window.trailBlazerDebug.getLayout());
  console.log(`[${device}] layout:`, JSON.stringify(layout));

  if (expect.validate) {
    expect.validate(layout);
  } else {
    assert(layout.overlayMode === expect.overlayMode,
      `expected overlayMode=${expect.overlayMode}, got ${layout.overlayMode}`);
    assert(layout.H_logical === expect.H_logical,
      `expected H_logical=${expect.H_logical}, got ${layout.H_logical}`);
    assert(Math.abs(layout.scale - expect.scaleNear) < 0.01,
      `expected scale near ${expect.scaleNear}, got ${layout.scale}`);
  }

  // Verify touch controls visibility during gameplay matches device capability.
  // (Game hides touch controls on menu; warp into a level to test the intended state.)
  await game.warpToLevel(0);
  await game.waitFrames(5);
  const touchVisible = await game.page.evaluate(() => {
    const el = document.getElementById('touch-controls');
    if (!el) return null;
    const style = getComputedStyle(el);
    return style.display !== 'none';
  });
  const TOUCH_DEVICES = new Set([
    'mobile-portrait', 'mobile-landscape', 'tablet-portrait', 'tablet-landscape',
  ]);
  const expectTouch = TOUCH_DEVICES.has(device);
  assert(touchVisible === expectTouch,
    `touch-controls display on '${device}' expected ${expectTouch}, got ${touchVisible}`);

  // Page must not scroll. scrollWidth/scrollHeight should not exceed the
  // viewport client dimensions — a mismatch means something is forcing overflow.
  const overflow = await game.page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    scrollH: document.documentElement.scrollHeight,
    clientW: document.documentElement.clientWidth,
    clientH: document.documentElement.clientHeight,
  }));
  assert(overflow.scrollW <= overflow.clientW,
    `horizontal overflow on '${device}': scrollW=${overflow.scrollW} clientW=${overflow.clientW}`);
  assert(overflow.scrollH <= overflow.clientH,
    `vertical overflow on '${device}': scrollH=${overflow.scrollH} clientH=${overflow.clientH}`);

  // HUD level-name and time must not horizontally overlap.
  const hudRects = await game.page.evaluate(() => {
    const t = document.getElementById('hud-time');
    const l = document.getElementById('hud-level-name');
    if (!t || !l) return null;
    const tr = t.getBoundingClientRect();
    const lr = l.getBoundingClientRect();
    return { timeRight: tr.right, timeLeft: tr.left, levelLeft: lr.left, levelRight: lr.right };
  });
  if (hudRects) {
    // Level-name's visible text is centered in its full-width box; measure by
    // actual text width via range.
    const levelTextBounds = await game.page.evaluate(() => {
      const el = document.getElementById('hud-level-name');
      if (!el || !el.firstChild) return null;
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      return { left: r.left, right: r.right };
    });
    if (levelTextBounds) {
      assert(hudRects.timeRight <= levelTextBounds.left,
        `HUD time overlaps level-name on '${device}': time.right=${hudRects.timeRight} level.left=${levelTextBounds.left}`);
    }
  }

  console.log(`responsive-layout [${device}] PASSED`);
}
