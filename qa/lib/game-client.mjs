import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotsDir = resolve(__dirname, '..', 'screenshots');

export class GameClient {
  constructor(page) {
    this.page = page;
  }

  async warpToLevel(n) {
    await this.page.evaluate(n => window.trailBlazerDebug.warpToLevel(n), n);
  }

  // Saves the canvas as a PNG to qa/screenshots/<name>.png.
  // Returns the absolute path so the caller can read it.
  async screenshot(name) {
    const dataUrl = await this.page.evaluate(() => window.trailBlazerDebug.screenshot());
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const filePath = resolve(screenshotsDir, `${name}.png`);
    writeFileSync(filePath, Buffer.from(base64, 'base64'));
    return filePath;
  }

  async pressKey(code) {
    await this.page.evaluate(code => window.trailBlazerDebug.pressKey(code), code);
  }

  async releaseKey(code) {
    await this.page.evaluate(code => window.trailBlazerDebug.releaseKey(code), code);
  }

  // Hold a key for `frames` game frames (~16ms each), then release.
  async holdKey(code, frames) {
    await this.pressKey(code);
    await this.waitFrames(frames);
    await this.releaseKey(code);
  }

  // Wait approximately n game frames (n * 16ms).
  async waitFrames(n) {
    await new Promise(r => setTimeout(r, n * 16));
  }

  async getState() {
    return this.page.evaluate(() => window.trailBlazerDebug.getState());
  }
}
