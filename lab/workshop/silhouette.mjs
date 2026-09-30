// Front silhouette of a library figure for comparison with its concept art
// (compare.py): orthographic, straight on, no ground, magenta background, arms
// raised to the concept's pose. With `npm run figures` running:
//   node lab/workshop/silhouette.mjs <library file> <out.png> [arm angle° from the bind pose, default 80 = T-pose]
let pw;
try { pw = await import('playwright'); } catch { pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs'); }

const [file, out, armArg] = process.argv.slice(2);
const arm = Number(armArg ?? 80) * Math.PI / 180;
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
page.on('pageerror', (e) => console.log('pageerror', String(e)));
await page.goto('http://localhost:5181/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__studio?.stage?.clips?.size, null, { timeout: 60000 });
await page.addStyleTag({ content: 'aside{display:none!important} #app{grid-template-columns:1fr!important} #bar{display:none!important}' });
await page.waitForTimeout(4000);
await page.evaluate(async ([file, arm]) => {
  const st = window.__studio.stage;
  await st.show([{ name: file, url: `/api/library/${file}`, child: file.startsWith('child') }]);
  st.scene.background.set('#ff00ff');
  st.ground.visible = false;
  st.pitch = 0; st.yaw = 0; st.opts.pixel = false; st.resize();
  st.opts.zoom = 12; st.look.set(0, 0.85, 0);
  const c = st.chars[0];
  c.mixer.stopAllAction();
  c.mesh.skeleton.pose();
  // Raise the arms about the forward axis (+Z in three.js): left (+x) up by +arm, right by -arm.
  const THREE_Q = c.root.quaternion.constructor;
  const V = c.root.position.constructor;
  for (const [n, s] of [['UpperArm.L', 1], ['UpperArm.R', -1]]) {
    const b = c.bone(n);
    const pq = new THREE_Q(), bq = new THREE_Q();
    b.parent.getWorldQuaternion(pq); b.getWorldQuaternion(bq);
    const r = new THREE_Q().setFromAxisAngle(new V(0, 0, 1), s * arm);
    b.quaternion.copy(pq.invert().multiply(r.multiply(bq)));
  }
}, [file, arm]);
await page.waitForTimeout(3000);
await page.screenshot({ path: out });
console.log('silhouette', out);
await browser.close();
