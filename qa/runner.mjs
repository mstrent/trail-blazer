import { chromium, firefox, webkit } from 'playwright';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { GameClient } from './lib/game-client.mjs';
import { DEFAULT_DEVICE, resolveDevice } from './lib/devices.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse CLI args: first positional is the scenario path; `--device=<name>`
// picks a device preset from qa/lib/devices.mjs. The device flag overrides
// whatever the scenario exports via `options.device`.
let scenarioArg;
let deviceOverride;
let browserName = 'chromium';
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--device=')) {
    deviceOverride = arg.slice('--device='.length);
  } else if (arg.startsWith('--browser=')) {
    browserName = arg.slice('--browser='.length);
  } else if (!scenarioArg) {
    scenarioArg = arg;
  }
}
const BROWSERS = { chromium, firefox, webkit };
const browserLauncher = BROWSERS[browserName];
if (!browserLauncher) {
  console.error(`Unknown browser "${browserName}". Options: chromium, firefox, webkit`);
  process.exit(1);
}

if (!scenarioArg) {
  console.error('Usage: node runner.mjs [--device=<name>] scenarios/<name>.mjs');
  console.error('Devices: desktop (default), mobile-portrait, mobile-landscape');
  process.exit(1);
}

const scenarioPath = resolve(__dirname, scenarioArg);
const { default: scenario, options: scenarioOptions } = await import(
  pathToFileURL(scenarioPath).href
);

const deviceName = deviceOverride || scenarioOptions?.device || DEFAULT_DEVICE;
const devicePreset = resolveDevice(deviceName);
process.env.QA_DEVICE = deviceName; // expose active device to scenarios
process.env.QA_BROWSER = browserName;

let browser;
let exitCode = 0;
try {
  browser = await browserLauncher.launch({ headless: true });
  // Firefox doesn't accept isMobile/hasTouch in newContext — strip them.
  const contextOptions = browserName === 'firefox'
    ? Object.fromEntries(Object.entries(devicePreset).filter(([k]) => !['isMobile', 'hasTouch'].includes(k)))
    : devicePreset;
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  const port = process.env.GAME_PORT || process.env.PORT || 3000;
  await page.goto(`http://localhost:${port}?debug=1`);
  await page.waitForFunction(
    () => typeof window.trailBlazerDebug !== 'undefined',
    { timeout: 10000 }
  );

  const client = new GameClient(page);
  console.log(`Running scenario with device preset: ${deviceName}`);

  await scenario(client);
  console.log('Scenario completed successfully.');
} catch (err) {
  console.error('Scenario failed:', err.stack ?? err.message);
  exitCode = 1;
} finally {
  if (browser) await browser.close();
}
process.exit(exitCode);
