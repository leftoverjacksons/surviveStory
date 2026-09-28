/**
 * Shared Playwright setup for the screenshot scripts: software WebGL
 * (swiftshader, about 1 fps) and error capture. Playwright is resolved from
 * the project, else from the container's global install.
 */
let pw;
try { pw = await import('playwright'); } catch { pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs'); }

export const BASE = process.env.BASE ?? 'http://localhost:4173/';

export async function open(query = '', viewport = { width: 1400, height: 860 }) {
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CERT|PCFSoft|Clock/.test(m.text())) errors.push(m.text()); });
  await page.goto(BASE + query, { waitUntil: 'load' });
  await page.waitForTimeout(5000);
  return { browser, page, errors };
}

/** Hide the HUD so only the world is captured. */
export const noHud = (page) => page.addStyleTag({ content: 'body > *:not(#view):not(#vignette){display:none !important}' });

/** Advance paused game time to an hour of day (0–24) in ten-minute ticks. */
export const toHour = (page, hour) => page.evaluate((hour) => {
  const g = window.__game; g.setSpeed(0);
  let n = 0; while (Math.abs(((g.colony.minute % 1440) / 60) - hour) > 0.3 && n++ < 200) g.tick(10);
}, hour);
