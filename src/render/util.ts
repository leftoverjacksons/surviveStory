import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/** Deterministic render-side random (visual scatter only, not simulation). */
export function makeRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth 2D value noise in [0,1]. */
export function noise2(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number, octaves = 4) {
  let amp = 0.5, freq = 1, sum = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x * freq, y * freq) * amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum;
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Radial-gradient sprite texture used for glows (wisps, orbs, fire). */
export function glowTexture(size = 128): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * The soft look (the default): anti-aliasing, soft shadows and smooth
 * shading on organic shapes. `?hard` brings back the faceted look for
 * comparison.
 */
/**
 * Pixel-art rendering (the default; `?pixel=4` for chunkier pixels, `?smooth`
 * for the soft look): the scene is drawn at 1/PIXEL
 * of the screen's resolution and enlarged with hard pixels, outlined from
 * depth, with colour in steps. 0 = off.
 */
export const PIXEL = (() => {
  if (typeof location === 'undefined') return 0;
  const q = new URLSearchParams(location.search);
  if (q.has('smooth')) return 0;
  return Math.max(2, Math.min(6, Number(q.get('pixel')) || 3));
})();

export const SOFT = typeof location === 'undefined' || !new URLSearchParams(location.search).has('hard');

/** Weld a (possibly faceted) geometry and give it smooth normals, if the soft look is on. */
export function soften<T extends THREE.BufferGeometry>(g: T): THREE.BufferGeometry {
  if (!SOFT) return g;
  const keep = ['position'];
  const h = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(h.attributes)) if (!keep.includes(k)) h.deleteAttribute(k);
  const m = mergeVertices(h, 1e-4);
  m.computeVertexNormals();
  return m;
}

export function lambert(color: THREE.ColorRepresentation, extra: THREE.MeshLambertMaterialParameters = {}) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
}

export function shadowed<T extends THREE.Object3D>(o: T, cast = true, receive = true): T {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = cast;
      c.receiveShadow = receive;
    }
  });
  return o;
}

/**
 * A calm flicker for firelight and candles (DESIGN §23.7): slow, small, and
 * stepped at 8 updates a second, the cadence pixel art animates at. Fast,
 * deep flicker made the lit ground and roofs glitter at pixel resolution
 * (every change of light shifts the grade's brightness bands). ~1 ± `depth`.
 */
export function calmFlicker(t: number, seed = 0, depth = 0.06): number {
  const s = Math.floor(t * 8) / 8 + seed * 7.13;
  return 1 + depth * (Math.sin(s * 1.3) * 0.6 + Math.sin(s * 2.9 + 1.7) * 0.4);
}

/** Shared uniforms injected into world materials. */
export const worldUniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  uFogTex: { value: null as THREE.Texture | null },
  uWearTex: { value: null as THREE.Texture | null },
  uFogSize: { value: 256 },
  /** Zones: crisp per-tile colours; uZone is 0 normally (outlines only), 1 while painting (shaded). */
  uZoneTex: { value: null as THREE.Texture | null },
  uZone: { value: 0 },
  /** Season look, 0..1 each. */
  uSnow: { value: 0 },
  /** Snow on roofs and other tops (DESIGN §35): catches and holds a little more than the ground. */
  uRoofSnow: { value: 0 },
  /** Footprints pressed into the snow (render/footprints.ts), 4 texels a tile. */
  uFootTex: { value: null as THREE.Texture | null },
  uAutumn: { value: 0 },
  uBare: { value: 0 },
  uBlossom: { value: 0 },
  /** The Veil: resonance texture and how strongly to show it (0 = hidden). */
  uResTex: { value: null as THREE.Texture | null },
  uVeil: { value: 0 },
  /** See-through woods: 0 full, 1 canopies stippled on the Folk's Wild, 2 stippled everywhere. */
  uThin: { value: 1 },
  /** Graphics panel (ui/gfx.ts): strength of the pixel-scale surface patterns, 0..1. */
  uSurface: { value: 1 },
  /** Graphics panel: grass painted into the turf (0 off .. 1), an alternative to tufts of geometry. */
  uGrassPaint: { value: 0 },
};
/** Back-compat alias used by older call sites. */
export const windUniforms = worldUniforms;

export type SeasonStyle = 'ground' | 'grass' | 'broadleaf' | 'conifer' | 'solid' | 'none';

export interface EnhanceOptions {
  /** Sway amplitude for foliage; sway scales with local height so bases stay planted. */
  wind?: number;
  /** Darken unexplored parts of the map (fog of war). Default true. */
  fog?: boolean;
  /** Tint painted zones and outline their edges (ground materials only). */
  zone?: boolean;
  /** How the material responds to the seasons. Default 'solid' (snow settles on top). */
  season?: SeasonStyle;
  /**
   * Foliage self-shading: darken the underside of each clump, brighten its
   * crown. The value is 1 / the geometry's half-height (1 for a unit sphere).
   */
  shade?: number;
  /** Light the surface as if it faced straight up (grass blades lit like the ground they grow from). */
  upLit?: boolean;
  /**
   * Pixel-scale surface detail (pixel-art mode only): 'auto' reads walls,
   * slopes and tops from the normal and wood from masonry by saturation;
   * 'soil' and 'paving' are for the ground. Default: 'auto' for solid
   * materials, 'soil' for ground, otherwise none.
   */
  surface?: 'auto' | 'soil' | 'paving' | 'leaf' | 'brick' | 'corrugated' | 'none';
  /**
   * Trees that can turn to ghosts where `uThin` asks (the Folk's Wild, or
   * everywhere). 'solid': the normal material, cut away where ghosted.
   * 'ghost': the translucent twin, drawn only where ghosted (see ghostTwin).
   */
  thin?: 'solid' | 'ghost';
}

/** Wild's zone colour as the shader reads it from uZoneTex. */
const WILD_RGB = '0.314, 0.784, 0.667';
/** Vertex-shader test: is this instance ghosted? One decision per instance, from where it stands. */
const THIN_VERT = `
  float thinAt(vec3 ip) {
    vec4 zc = texture2D(uZoneTex, (ip.xz + uFogSize * 0.5) / uFogSize);
    float wild = step(0.5, zc.a) * step(distance(zc.rgb, vec3(${WILD_RGB})), 0.03);
    return uThin > 1.5 ? 1.0 : uThin > 0.5 ? wild : 0.0;
  }`;
/** Ghost look: a pale body, nearly clear, a little stronger at the rim. */
const GHOST_TINT = '0.8, 0.93, 0.92';
const GHOST_BODY = 0.05;
const GHOST_RIM = 0.21;

/**
 * A ghost twin for an instanced tree mesh: same geometry and (shared)
 * instance data, drawn alpha-blended only where the solid mesh is cut away.
 * Keep `boundingSphere` in step when the instances move (see TreeField).
 */
export function ghostTwin(mesh: THREE.InstancedMesh, opts: EnhanceOptions): THREE.InstancedMesh {
  const mat = enhance(new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false, flatShading: !SOFT }), { ...opts, thin: 'ghost' });
  const g = new THREE.InstancedMesh(mesh.geometry, mat, 0);
  g.instanceMatrix = mesh.instanceMatrix;
  g.instanceColor = mesh.instanceColor;
  g.count = mesh.count;
  g.boundingSphere = mesh.boundingSphere;
  g.castShadow = false;
  g.receiveShadow = false;
  g.renderOrder = 2;
  mesh.customDepthMaterial = thinDepth();
  mesh.userData.ghost = g;
  return g;
}

let thinDepthMat: THREE.MeshDepthMaterial | null = null;
/** Shadow-map material for ghostable trees: ghosts cast no shadow. */
function thinDepth(): THREE.MeshDepthMaterial {
  if (thinDepthMat) return thinDepthMat;
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uZoneTex: worldUniforms.uZoneTex, uThin: worldUniforms.uThin, uFogSize: worldUniforms.uFogSize });
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      uniform sampler2D uZoneTex; uniform float uThin; uniform float uFogSize; varying float vThin;
      ${THIN_VERT}`).replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vThin = thinAt(vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]));
      #else
        vThin = 0.0;
      #endif`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying float vThin;`).replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      if (vThin > 0.5) discard;`);
  };
  m.customProgramCacheKey = () => 'thin-depth';
  return (thinDepthMat = m);
}

const SURFACE_GLSL = `
  float sh21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // Pixel-scale surface detail in world space: planks and masonry on walls,
  // shingles on slopes, slabs and grit on flat tops, loam or paving on the
  // ground. Each pattern fades out on its own as it gets smaller than a
  // screen pixel (sub-pixel detail is what turns into grain when zoomed out).
  float gFw = 1.0;
  // 1 while a pattern of this frequency (cycles per world unit) spans a few pixels, 0 once it is sub-pixel.
  float lodk(float f) { return 1.0 - smoothstep(0.35, 0.75, gFw * f); }
  vec3 surfaceTex(vec3 col, vec3 wp, vec3 wn, int kind) {
    float fw = max(length(fwidth(wp)), 1e-4);
    gFw = fw;
    float fade = 1.0 - smoothstep(0.14, 0.3, fw);
    if (fade <= 0.0) return col;
    float T = 7.0;
    float mx = max(col.r, max(col.g, col.b)), mn = min(col.r, min(col.g, col.b));
    float sat = (mx - mn) / max(mx, 1e-3);
    float k = 1.0;
    vec3 tint = vec3(0.0);
    if (kind == 5 || kind == 6) {
      vec2 t2 = normalize(vec2(-wn.z, wn.x) + 1e-5);
      float u = abs(wn.y) > 0.6 ? wp.x : dot(wp.xz, t2), v = abs(wn.y) > 0.6 ? wp.z : wp.y;
      if (kind == 5) {          // brick: small courses, lighter mortar
        float row = floor(v / 0.09);
        float uu = u + mod(row, 2.0) * 0.12;
        float c = floor(uu / 0.24);
        k = 0.86 + 0.26 * sh21(vec2(row, c));
        if (fract(v / 0.09) < 0.22 || fract(uu / 0.24) < 0.1) { k = 1.18; }
        k = mix(1.02, k, lodk(11.0));
      } else {                  // corrugated steel: ribs, streaks of rust
        k = mix(0.97, fract(u / 0.14) < 0.5 ? 1.08 : 0.86, lodk(7.0));
        float rust = smoothstep(0.55, 0.85, sh21(floor(vec2(u * 1.2, v * 0.6))) * 0.6 + sh21(floor(vec2(u * 5.0, v * 2.0))) * 0.4);
        tint = (vec3(0.42, 0.22, 0.1) - col) * rust * 0.45;
      }
    } else if (kind == 4) {            // foliage: leaf clumps, lit on their upper sides, dark gaps between
      vec3 q = wp * 4.5;
      vec3 c = floor(q);
      float h = sh21(c.xz + c.y * 17.3);
      float up = dot(normalize(fract(q) - 0.5 + 1e-4), normalize(vec3(0.3, 1.0, 0.2)));
      k = 1.0 + (0.34 * h + 0.14 * up - 0.2) * lodk(4.5);
      k *= 1.0 + (0.2 * sh21(floor(wp.xz * T * 1.4) + floor(wp.y * T * 1.4)) - 0.1) * lodk(T * 1.4);
    } else if (kind == 2) {            // soil and turf: loam blotches, grit
      k = (1.0 + (0.16 * sh21(floor(wp.xz * 1.3)) - 0.08) * lodk(1.3)) * (1.0 + (0.14 * sh21(floor(wp.xz * T)) - 0.07) * lodk(T));
    } else if (kind == 3) {     // paving: broken slabs, dark seams, moss in the cracks
      vec2 g = wp.xz / 0.9;
      float row = floor(g.y);
      g.x += row * 0.5 + sh21(vec2(row, 7.0)) * 0.3;
      vec2 cell = floor(g), f = fract(g);
      k = (1.0 + (0.28 * sh21(cell) - 0.14) * lodk(1.1)) * (1.0 + (0.12 * sh21(floor(wp.xz * T)) - 0.06) * lodk(T));
      float seam = (step(f.x, 0.07) + step(f.y, 0.07)) * lodk(6.0);
      if (seam > 0.0) { k *= mix(1.0, 0.62, min(1.0, seam)); tint = sh21(cell + 3.1) < 0.4 ? vec3(-0.02, 0.03, -0.02) : vec3(0.0); }
    } else {
      vec3 an = abs(wn);
      if (an.y < 0.35) {
        vec2 t2 = normalize(vec2(-wn.z, wn.x) + 1e-5);
        float u = dot(wp.xz, t2), v = wp.y;
        if (sat < 0.14) {       // grey: masonry or block
          float row = floor(v / 0.26);
          float uu = u + row * 0.27;
          float c = floor(uu / 0.52);
          k = 0.9 + 0.2 * sh21(vec2(row, c));
          if (fract(v / 0.26) < 0.15 || fract(uu / 0.52) < 0.07) k *= 0.74;
          k = mix(0.95, k, lodk(3.8));
        } else {                // wood: planks with seams, grain
          float row = floor(v / 0.2);
          float len = 0.9 + 0.8 * sh21(vec2(row, 2.0));
          float seg = floor((u + sh21(vec2(row, 1.0)) * 3.0) / len);
          k = 0.88 + 0.24 * sh21(vec2(row, seg));
          if (fract(v / 0.2) < 0.16) k *= 0.7;
          k = mix(0.97, k, lodk(5.0));
          k *= 1.0 + (0.1 * sh21(floor(vec2(u * T * 2.0, v * T))) - 0.05) * lodk(T * 2.0);
        }
      } else if (an.y < 0.93) { // roof slope: staggered shingles
        vec2 d = normalize(wn.xz + 1e-5);
        float row = floor(wp.y / 0.11);
        float u = dot(wp.xz, vec2(-d.y, d.x)) + row * 0.17;
        float c = floor(u / 0.3);
        k = 0.84 + 0.3 * sh21(vec2(row, c));
        if (fract(wp.y / 0.11) < 0.3) k *= 0.72;
        else if (fract(u / 0.3) < 0.08) k *= 0.85;
        k = mix(0.92, k, lodk(9.0));
      } else {                  // flat tops: grit
        k = 1.0 + (0.14 * sh21(floor(wp.xz * T)) - 0.07) * lodk(T);
      }
    }
    return mix(col, col * k + tint, fade);
  }

  // Grass painted into the turf (graphics panel): each small cell may hold a clump, a lit tip above a
  // shaded foot, fading as it goes sub-pixel. Only on green, near-level ground.
  vec3 grassPaint(vec3 col, vec3 wp, vec3 wn) {
    if (uGrassPaint <= 0.0 || wn.y < 0.8) return col;
    if (!(col.g > col.r * 1.05 && col.g > col.b * 1.1)) return col;
    // Clumps on an irregular grid (jittered, thinned by a slow patchiness), three blades each: lit tips
    // over a shaded foot, each clump its own shade of green. "Up" on screen is -z in world.
    float S = 1.25;
    float patchy = sh21(floor(wp.xz * 0.18)) * 0.5 + sh21(floor(wp.xz * 0.45) + 9.0) * 0.5;
    float lod = lodk(S * 1.6);
    float light = 0.0, shade = 0.0, hueK = 0.0;
    for (int oy = -1; oy <= 0; oy++) for (int ox = -1; ox <= 0; ox++) {
      vec2 c = floor(wp.xz * S) + vec2(float(ox), float(oy));
      if (sh21(c) > 0.25 + 0.5 * patchy) continue;
      vec2 o = c + vec2(0.15 + 0.7 * sh21(c + 1.7), 0.15 + 0.7 * sh21(c + 3.1));
      vec2 d = wp.xz * S - o;
      for (int b = 0; b < 3; b++) {
        float fb = float(b) - 1.0;
        float bx = d.x - fb * 0.11 - d.y * fb * 0.35;
        float hgt = 0.3 + 0.14 * sh21(c + fb * 5.3);
        float blade = step(abs(bx), 0.045 * (1.0 + d.y * 1.5)) * step(-hgt, d.y) * step(d.y, 0.0);
        if (blade > 0.0) { light = max(light, 0.5 - d.y / hgt * 0.5); hueK = sh21(c + 7.7); }
      }
      shade = max(shade, step(abs(d.x), 0.2) * step(0.0, d.y) * step(d.y, 0.08));
    }
    vec3 tipCol = col * (1.12 + 0.22 * light) + vec3(0.02, 0.03, -0.01) * (hueK - 0.5);
    col = mix(col, tipCol, step(0.001, light) * uGrassPaint * lod);
    return col * (1.0 - 0.2 * shade * uGrassPaint * lod);
  }
`;


const SEASON_GLSL: Record<SeasonStyle, string> = {
  none: '',
  solid: '',
  conifer: '',
  ground: `
    {
      vec2 wuv = (vFowXZ + uFogSize * 0.5) / uFogSize;
      float wv = texture2D(uWearTex, wuv).r;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.0, 0.72), uAutumn * 0.3);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.34, 0.31, 0.24), uBare * 0.45);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.37, 0.30, 0.22), smoothstep(0.1, 0.55, wv) * 0.85);
      snowK *= 1.0 - smoothstep(0.3, 1.0, wv) * 0.5;
    }`,
  // Tufts take the season only lightly in the pixel look, where a pale tuft on dark turf reads as a speck.
  grass: `
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.6, 0.25), uAutumn * ${PIXEL ? 0.22 : 0.5});
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.6, 0.54, 0.38), uBare * ${PIXEL ? 0.3 : 0.65});`,
  broadleaf: `
    {
      vec3 aut = vHash < 0.2 ? vec3(0.62, 0.16, 0.08) : mix(vec3(0.85, 0.38, 0.1), vec3(0.95, 0.72, 0.18), vHash);
      diffuseColor.rgb = mix(diffuseColor.rgb, aut, uAutumn * 0.85);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.4, 0.34, 0.29), uBare * 0.85);
      if (vHash > 0.74) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.7, 0.8), uBlossom * 0.6);
    }`,
};

/**
 * Patch a built-in material with wind sway, fog of war, zone tints, footfall
 * wear and the seasons (snow, autumn colour, bare branches, blossom).
 */
/** Materials already patched by enhance(). */
export const enhanced = new WeakSet<THREE.Material>();

export function enhance<T extends THREE.Material>(mat: T, opts: EnhanceOptions = {}): T {
  enhanced.add(mat);
  mat.userData.enhance = { ...opts };
  const wind = opts.wind ?? 0;
  const fog = opts.fog ?? true;
  const zone = opts.zone ?? false;
  const season = opts.season ?? 'solid';
  const shade = opts.shade ?? 0;
  const upLit = opts.upLit ?? false;
  const thin = opts.thin ?? null;
  const surface = !PIXEL ? 'none' : opts.surface ?? (season === 'solid' ? 'auto' : season === 'ground' ? 'soil' : season === 'broadleaf' || season === 'conifer' ? 'leaf' : 'none');
  const surfaceKind = { none: 0, auto: 1, soil: 2, paving: 3, leaf: 4, brick: 5, corrugated: 6 }[surface];
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, worldUniforms);
    let vs = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uTime; uniform float uWind; uniform float uBare; uniform float uFogSize;
      uniform sampler2D uWearTex;
      varying vec2 vFowXZ; varying float vUp; varying float vHash; varying float vShade; varying vec3 vWP; varying vec3 vWN;
      ${thin ? `uniform sampler2D uZoneTex; uniform float uThin; varying float vThin; ${THIN_VERT}` : ''}`,
    );
    vs = vs.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 ip = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
      #endif
      vHash = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453);
      vShade = clamp(position.y * ${shade.toFixed(3)} * 0.5 + 0.5, 0.0, 1.0);
      ${thin ? 'vThin = thinAt(ip);' : ''}
      ${season === 'broadleaf' ? 'transformed *= mix(1.0, 0.42, uBare);' : ''}
      ${season === 'grass' ? `{
        float wr = texture2D(uWearTex, (ip.xz + uFogSize * 0.5) / uFogSize).r;
        transformed.y *= (1.0 - smoothstep(0.12, 0.5, wr)) * mix(1.0, 0.55, uBare);
      }` : ''}
      ${wind > 0 ? `{
        float h = max(position.y, 0.0);
        float ph = ip.x * 0.37 + ip.z * 0.23;
        float sway = sin(uTime * 1.7 + ph) * 0.6 + sin(uTime * 3.1 + ph * 1.9) * 0.4;
        transformed.x += sway * ${wind.toFixed(3)} * h * uWind;
        transformed.z += cos(uTime * 1.3 + ph) * ${(wind * 0.6).toFixed(3)} * h * uWind;
      }` : ''}`,
    );
    vs = vs.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec4 fowWP = vec4(transformed, 1.0);
      vec3 upN = objectNormal;
      #ifdef USE_INSTANCING
        fowWP = instanceMatrix * fowWP;
        upN = mat3(instanceMatrix) * upN;
      #endif
      fowWP = modelMatrix * fowWP;
      vFowXZ = fowWP.xz;
      vWN = normalize(mat3(modelMatrix) * upN);
      vUp = vWN.y;
      vWP = fowWP.xyz;`,
    );
    shader.vertexShader = vs;

    let fs = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      uniform sampler2D uFogTex; uniform sampler2D uWearTex; uniform sampler2D uResTex; uniform sampler2D uZoneTex; uniform float uVeil;
      uniform float uFogSize; uniform float uTime; uniform float uZone;
      uniform float uSnow; uniform float uRoofSnow; uniform sampler2D uFootTex; uniform float uAutumn; uniform float uBare; uniform float uBlossom;
      varying vec2 vFowXZ; varying float vUp; varying float vHash; varying float vShade; varying vec3 vWP; varying vec3 vWN;
      ${thin ? 'varying float vThin;' : ''}
      ${surfaceKind ? `uniform float uSurface; uniform float uGrassPaint;
${SURFACE_GLSL}` : ''}`,
    );
    if (thin === 'solid') {
      fs = fs.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (vThin > 0.5) discard;`);
    } else if (thin === 'ghost') {
      // Drawn only where the solid tree is cut away: pale and nearly clear,
      // a little denser where the surface turns from the camera.
      fs = fs.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (vThin < 0.5) discard;`);
      fs = fs.replace('#include <opaque_fragment>', `#include <opaque_fragment>
        {
          vec3 toCam = normalize(vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]));
          float rim = 1.0 - abs(dot(normalize(vWN), toCam));
          float lum = dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(${GHOST_TINT}) * (0.15 + lum * 1.3), 0.6);   // lit like the scene: faint at night
          gl_FragColor.a = ${GHOST_BODY.toFixed(3)} + ${GHOST_RIM.toFixed(3)} * rim * rim;
        }`);
    }
    if (surfaceKind) {
      fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, surfaceTex(diffuseColor.rgb, vWP, vWN, ${surfaceKind}), uSurface);
        ${surfaceKind === 2 ? 'diffuseColor.rgb = grassPaint(diffuseColor.rgb, vWP, vWN);' : ''}`);
    }
    if (season !== 'none') {
      fs = fs.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float snowK = ${season === 'ground' || season === 'grass' ? 'uSnow' : 'uRoofSnow'} * smoothstep(0.35, 0.8, vUp) * (0.85 + 0.15 * vHash);
          ${season === 'ground' ? '// Paths people keep are kept clear of snow (DESIGN §23.7).\n          snowK *= 1.0 - 0.8 * smoothstep(0.2, 0.6, texture2D(uWearTex, (vWP.xz + uFogSize * 0.5) / uFogSize).r);' : ''}
          ${SEASON_GLSL[season]}
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.94, 0.98), snowK);
          ${season === 'ground' ? `// Footprints (DESIGN §35): pressed-in snow, shaded blue-grey, fading as the print fills in.
          { float fp = texture2D(uFootTex, (vWP.xz + uFogSize * 0.5) / uFogSize).r * smoothstep(0.12, 0.4, snowK);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.57, 0.7), fp * 0.85); }` : ''}
          ${shade > 0 ? 'diffuseColor.rgb *= mix(0.7, 1.1, vShade * vShade * (3.0 - 2.0 * vShade));' : ''}
        }`,
      );
    }
    if (upLit) {
      fs = fs.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        normal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);`);
    }
    if (fog) {
      fs = fs.replace(
        '#include <fog_fragment>',
        `{
          vec2 fuv = (vFowXZ + uFogSize * 0.5) / uFogSize;
          vec4 fz = texture2D(uFogTex, fuv);
          float seen = fz.r;
          ${zone ? `
          // Zones: tile-aligned colours. Outlines always; shaded while painting.
          vec4 zc = texture2D(uZoneTex, fuv);
          float px = 1.0 / uFogSize;
          float edge = 0.0;
          for (int k = 0; k < 4; k++) {
            vec2 o = k == 0 ? vec2(0.13, 0.0) : k == 1 ? vec2(-0.13, 0.0) : k == 2 ? vec2(0.0, 0.13) : vec2(0.0, -0.13);
            vec4 zn = texture2D(uZoneTex, fuv + o * px);
            if (distance(zn, zc) > 0.02 && max(zn.a, zc.a) > 0.5) edge = 1.0;
          }
          float zl = dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11));
          vec3 lineCol = (zc.a > 0.5 ? zc.rgb : vec3(1.0)) * (zl * 1.8 + 0.03);
          float hatch = step(0.5, fract((vFowXZ.x + vFowXZ.y) * 0.35));
          vec3 tinted = gl_FragColor.rgb * (0.45 + zc.rgb * 1.1) + zc.rgb * 0.07;
          gl_FragColor.rgb = mix(gl_FragColor.rgb, tinted, zc.a * uZone * (0.55 + hatch * 0.3));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, lineCol, edge * (0.35 + uZone * 0.5));` : ''}
          ${zone ? `
          if (uVeil > 0.001) {
            // The Veil view: where it is thin, the land glows violet; where it is worn, grey.
            float rv = texture2D(uResTex, fuv).r;
            float vl = dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11));
            vec3 thin = vec3(0.62, 0.45, 1.0) * (0.35 + vl * 1.2) + vec3(0.1, 0.25, 0.3) * sin(uTime * 0.6 + vFowXZ.x * 0.15) * 0.15;
            vec3 worn = vec3(vl * 0.9, vl * 0.85, vl * 0.8);
            vec3 veilCol = mix(worn, thin, smoothstep(0.25, 0.8, rv));
            gl_FragColor.rgb = mix(gl_FragColor.rgb, veilCol, uVeil * 0.6);
          }` : ''}
          float drift = sin(vFowXZ.x * 0.21 + uTime * 0.15) * sin(vFowXZ.y * 0.17 - uTime * 0.11) * 0.08;
          float k = smoothstep(0.25, 0.75, seen + drift);
          float lum = dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11));
          vec3 mist = vec3(0.045, 0.06, 0.07) + lum * ${PIXEL ? '0.0' : '0.08'};
          gl_FragColor.rgb = mix(mist, gl_FragColor.rgb, k);
        }
        #include <fog_fragment>`,
      );
    }
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => `enh-${wind}-${fog}-${zone}-${season}-${shade}-${upLit}-${surfaceKind}-${thin}`;
  return mat;
}

/** Wind-only helper kept for call sites that want the old behaviour. */
export function addWind(mat: THREE.Material, strength = 0.12) {
  return enhance(mat, { wind: strength, surface: 'none' });
}
