/**
 * Smoke test for the single-file build: load it, click Begin on the start
 * menu, check the game runs and nothing threw. Serve the file first, e.g.
 *   mkdir -p /tmp/single && cp survive-story.html /tmp/single/index.html
 *   (cd /tmp/single && nohup python3 -m http.server 4190 > /dev/null 2>&1 &)
 *   BASE=http://localhost:4190/index.html node scripts/shots/smoke.mjs
 */
import { open } from './pw.mjs';

const { browser, page, errors } = await open('', { width: 900, height: 600 });
console.log('start menu shown:', await page.isVisible('#start'));
await page.click('#start-new-go');
await page.waitForTimeout(8000);
const day = await page.evaluate(() => window.__game?.colony.community.day);
console.log('game running, day', day, 'errors', JSON.stringify(errors));
await browser.close();
if (!day || errors.length) process.exit(1);
