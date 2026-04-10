import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GameClient } from './lib/game-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const scenarioArg = process.argv[2];
if (!scenarioArg) {
  console.error('Usage: node runner.mjs scenarios/<name>.mjs');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto('http://localhost:3000?debug=1');
  await page.waitForFunction(
    () => typeof window.trailBlazerDebug !== 'undefined',
    { timeout: 10000 }
  );

  const scenarioPath = resolve(__dirname, scenarioArg);
  const { default: scenario } = await import(scenarioPath);
  const client = new GameClient(page);

  await scenario(client);
  console.log('Scenario completed successfully.');
} catch (err) {
  console.error('Scenario failed:', err.message);
  process.exit(1);
} finally {
  await browser.close();
}
