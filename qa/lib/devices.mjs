// Device presets for Playwright browser contexts.
//
// Why this exists: the game's mobile UI (touch buttons, full-screen landscape
// canvas) is gated on the CSS media query `(hover: none) and (pointer: coarse)`,
// which a default Playwright page does NOT match — Chromium reports hover:hover
// and pointer:fine unless the context is created with `hasTouch` + `isMobile`.
//
// Each preset is spread directly into `browser.newContext()`. The keys mirror
// Playwright's own `devices[...]` shape so presets stay swappable with the
// built-in list (e.g. `devices['Pixel 5 landscape']`).
//
// `desktop` is the default and intentionally leaves `hasTouch`/`isMobile` off
// so existing scenarios keep behaving exactly as before.

export const DEVICE_PRESETS = {
  desktop: {
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },

  // Pixel-5-ish portrait: narrow viewport, touch + mobile UA so the game's
  // `(hover: none) and (pointer: coarse)` media query matches.
  'mobile-portrait': {
    viewport: { width: 393, height: 727 },
    deviceScaleFactor: 2.75,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  },

  // Pixel-5-ish landscape: wide viewport so `(orientation: landscape)` matches
  // and the game's landscape touch overlay activates.
  'mobile-landscape': {
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2.75,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  },
};

export const DEFAULT_DEVICE = 'desktop';

export function resolveDevice(name) {
  const key = name || DEFAULT_DEVICE;
  const preset = DEVICE_PRESETS[key];
  if (!preset) {
    const available = Object.keys(DEVICE_PRESETS).join(', ');
    throw new Error(`Unknown device preset "${key}". Available: ${available}`);
  }
  return preset;
}
