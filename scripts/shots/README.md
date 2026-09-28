# Screenshot and smoke-test scripts

All need the built game served: `npx vite build && npx vite preview --port 4173`
(in the background; restart it after each build). Chromium runs on software
WebGL (swiftshader), so expect about 1 fps and 5–10 s loads; the scripts
pause the game (`__game.setSpeed(0)`) and advance time with `__game.tick`.
`BASE` overrides the server URL; `Q` the query string. To restart a server,
don't `pkill -f` a pattern that also matches your own shell command (it
kills the shell); `pkill -f "vite preview"` on its own line is fine.

| Script | Use |
| --- | --- |
| `shot.mjs <out> '<steps>'` | General scripted screenshots (below). |
| `compare.mjs <out> <tag>` | Before/after views at a fixed seed; run once per build with different tags. |
| `layers.mjs <out> [x y w h]` | Hides each top-level scene child in turn to find which one causes an artefact. |
| `smoke.mjs` | Single-file build: start menu shown, Begin works, no errors (exit code 1 otherwise). |
| `perf.mjs <out> [days]` | Render cost of a grown village: draw calls and triangles per pass and per scene group. |
| `pw.mjs` | Shared setup (`open`, `noHud`, `toHour`). |

## `shot.mjs` steps

A JSON array; each step applies its keys in this order, waits, and saves
`<name>.png` if it has a `name`. State carries over between steps.

- Time: `tick` (minutes), `untilHour` (0–23), `weather` (`'clear'`, …).
- Camera: `yaw`, `zoom`, `target: [x, z]`, `lookCamp: [dx, dz]`,
  `lookFolk: [dx, dz]` (reveals the mound too), `reveal: [x, z, r]`.
- World: `paint: [[x, z, r, zone]...]`, `woods` (0 full, 1 Wild thinned,
  2 all thinned), `hide: [names or types]`, `zone` (zone tool).
- UI: `select` (`'first'` or an id), `unselect`, `folkCard`, `inspectHome`,
  `district` (kind), `nohud`, `key`, `clicks: [[x, y]...]`, `hover`.
- Veil: `veilStart` (district kind), `withFolk`, `veilTurns`.
- Anything else: `eval` (a JS string; `__game` is global).
- `wait` (ms, default 2500) before the screenshot.

Example:

```sh
Q='?seed=41&site=farm' node scripts/shots/shot.mjs /tmp/shots \
  '[{"untilHour":10,"weather":"clear","lookFolk":[0,0],"zoom":1.5,"nohud":true,"name":"mound"}]'
```

`__game` hooks worth knowing: `colony`, `scene`, `iso`, `tick`, `setSpeed`,
`refresh`, `select`, `inspect`, `paint`, `reveal`, `field`, `build`, `place`,
`fits`, `plotTry`, `screenOf`, `folkOrder`, `folkWhy`, `save`, `setWoods`,
`veilStart`, `veilTurns`, `stats`.

## Publishing the single-file build

1. `npx vite build --mode single && node scripts/single.mjs <scratch>/survive-story.html`
2. Serve a copy as `index.html` on port 4190 and run
   `BASE=http://localhost:4190/index.html node scripts/shots/smoke.mjs`.
3. Ask the user first if they may be mid-game (the page reloads; the game
   autosaves each morning, so little is lost).
4. Publish the file to the artifact https://claude.ai/artifact/5PAyD8AiMBG9fQDNbCCMPc
   (pass its `url`). If refused as not read in this session, read the
   artifact first, then publish again.
