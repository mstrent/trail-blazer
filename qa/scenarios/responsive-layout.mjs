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

  console.log(`responsive-layout [${device}] PASSED`);
}
