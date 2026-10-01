// Head close-ups: each head part (front, 3/4, side), composed from the parts
// library like the game does, for judging faces. With `npm run figures` running:
//   node lab/workshop/heads.mjs <out dir> [build] [head part,hair part ...]
// e.g. node lab/workshop/heads.mjs lab/workshop/shots/heads hero head.face,hair.curly head.soft,hair.bun
// GAME=1: the game's per-survivor colours instead of the authored ones.
// Writes <out>/<head>-<view>.png; lab/workshop/sheet.py-style stitching is in heads_sheet.py.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
let pw;
try { pw = await import('playwright'); } catch { pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs'); }

const [out, build = 'hero', ...sets] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const looks = sets.length ? sets.map((s) => s.split(',')) : [['head.face', 'hair.curly']];
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
page.on('pageerror', (e) => console.log('pageerror', String(e)));
await page.goto('http://localhost:5181/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__studio?.stage?.clips?.size, null, { timeout: 60000 });
await page.addStyleTag({ content: 'aside{display:none!important} #app{grid-template-columns:1fr!important} #bar{display:none!important}' });
await page.waitForTimeout(4000);
// The first look is drawn twice: the studio's own start-up display can replace the first one.
for (const [li, parts] of [looks[0], ...looks].entries()) {
  const all = ['body.base', 'top.shirt_rolled', ...parts];
  await page.evaluate(async ({ all, build, raw, li }) => {
    const st = window.__studio.stage;
    st.opts.raw = raw; st.opts.pixel = false; st.opts.zoom = 17; st.opts.clip = 'Idle';
    await st.show([{ name: 'h', seed: li * 3 + 1, url: `/api/library/parts_${build}.glb`, compose: { parts: all } }]);
    st.play(); st.resize();
    for (const c of st.chars) { c.mixer.setTime(0.2); c.mixer.timeScale = 0; }
    st.pitch = 0.12;
    st.look.set(0, 1.62, 0);
  }, { all, build, raw: !process.env.GAME, li });
  for (const [view, yaw] of [['front', 0], ['three-quarter', Math.PI / 5], ['side', Math.PI / 2]]) {
    await page.evaluate((yaw) => { window.__studio.stage.yaw = yaw; }, yaw);
    await page.waitForTimeout(2000);
    const name = `${parts.join('+')}-${view}.png`;
    await page.screenshot({ path: path.join(out, name), clip: { x: 260, y: 220, width: 380, height: 380 } });
    console.log('shot', name);
  }
}
await browser.close();
