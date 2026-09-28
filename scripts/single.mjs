/**
 * Package the single-file build for the claude.ai artifact:
 *   npx vite build --mode single && node scripts/single.mjs <out.html>
 * The artifact host supplies its own document skeleton, so the charset and
 * viewport metas (and any title) are stripped and one <title> is put first.
 * Smoke-test the result with scripts/shots/smoke.mjs before publishing.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const out = process.argv[2];
if (!out) { console.error('usage: node scripts/single.mjs <out.html>'); process.exit(1); }
let html = readFileSync('dist-single/index.html', 'utf8');
html = html.replace(/<meta charset="[^"]*"\s*\/?>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .replace(/<title>[^<]*<\/title>\s*/i, '');
writeFileSync(out, '<title>Survive Story</title>\n' + html);
console.log(`${out}: ${(html.length / 1e6).toFixed(2)} MB`);
