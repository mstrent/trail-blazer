import { chromium } from 'playwright';
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
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--device=')) {
    deviceOverride = arg.slice('--device='.length);
  } else if (!scenarioArg) {
    scenarioArg = arg;
  }
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

let browser;
let exitCode = 0;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(devicePreset);
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
