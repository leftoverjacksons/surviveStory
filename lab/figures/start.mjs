// Start the figure studio: the Python backend (server.py) and its page (Vite).
//   npm run figures      → http://localhost:5181/
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// The backend needs only the standard library; prefer the studio's own environment.
const venv = ['.venv-gen/Scripts/python.exe', '.venv-gen/bin/python'].map((p) => path.join(here, p)).find((p) => fs.existsSync(p));
const python = process.env.PYTHON ?? venv ?? (process.platform === 'win32' ? 'python' : 'python3');
const kids = [
  spawn(python, [path.join(here, 'server.py')], { stdio: 'inherit', env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' } }),
  spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--config', path.join(here, 'vite.config.ts')], { stdio: 'inherit', shell: process.platform === 'win32' }),
];
const stop = () => { for (const k of kids) k.kill(); process.exit(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const k of kids) k.on('exit', (code) => { if (code) { console.error('studio: a process exited with', code); stop(); } });
console.log('\nFigure studio: http://localhost:5181/\n');
