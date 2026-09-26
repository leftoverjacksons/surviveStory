# Survive Story

A post-collapse community sim with tactical expeditions. The world after the
Quiet is verdant and strange: vines on the gas pumps, deer on the highway,
wisps in the treeline, and lights in the sky that nobody agrees about.

Browser game: TypeScript + Three.js, rotatable isometric (orthographic) 3D.

## Run

```sh
npm install
npm run dev        # local dev server
npm test           # simulation unit tests
npm run sim        # headless balance probe: npm run sim -- 500 60
npm run build      # production build to dist/
npm run build:single  # one self-contained HTML file in dist-single/
```

## Controls

- Drag: pan · Right-drag / Ctrl-drag / Q,E: rotate · Wheel / pinch: zoom
- WASD / arrows: pan · Space: run time · L: toggle names

## Layout

- `src/sim/` — deterministic simulation (no rendering). Survivors, traits,
  psi, bonds, morale, grief propagation, daily economy. Seeded RNG.
- `src/render/` — Three.js scene: terrain, station, vines, trees, deer,
  wisps, fireflies, the Orb, camp and memorial stones, sky/day cycle.
- `src/ui/` — HUD overlay.
- `tests/` — Vitest suites for the simulation.
- `scripts/simulate.ts` — runs many campaigns headlessly for balancing.
