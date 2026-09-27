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
  uAutumn: { value: 0 },
  uBare: { value: 0 },
  uBlossom: { value: 0 },
  /** The Veil: resonance texture and how strongly to show it (0 = hidden). */
  uResTex: { value: null as THREE.Texture | null },
  uVeil: { value: 0 },
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
}

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
  grass: `
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.6, 0.25), uAutumn * 0.5);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.6, 0.54, 0.38), uBare * 0.65);`,
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
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, worldUniforms);
    let vs = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uTime; uniform float uWind; uniform float uBare; uniform float uFogSize;
      uniform sampler2D uWearTex;
      varying vec2 vFowXZ; varying float vUp; varying float vHash; varying float vShade;`,
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
      vUp = normalize(mat3(modelMatrix) * upN).y;`,
    );
    shader.vertexShader = vs;

    let fs = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      uniform sampler2D uFogTex; uniform sampler2D uWearTex; uniform sampler2D uResTex; uniform sampler2D uZoneTex; uniform float uVeil;
      uniform float uFogSize; uniform float uTime; uniform float uZone;
      uniform float uSnow; uniform float uAutumn; uniform float uBare; uniform float uBlossom;
      varying vec2 vFowXZ; varying float vUp; varying float vHash; varying float vShade;`,
    );
    if (season !== 'none') {
      fs = fs.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float snowK = uSnow * smoothstep(0.35, 0.8, vUp) * (0.85 + 0.15 * vHash);
          ${SEASON_GLSL[season]}
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.94, 0.98), snowK);
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
          vec3 mist = vec3(0.045, 0.06, 0.07) + lum * 0.08;
          gl_FragColor.rgb = mix(mist, gl_FragColor.rgb, k);
        }
        #include <fog_fragment>`,
      );
    }
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => `enh-${wind}-${fog}-${zone}-${season}-${shade}-${upLit}`;
  return mat;
}

/** Wind-only helper kept for call sites that want the old behaviour. */
export function addWind(mat: THREE.Material, strength = 0.12) {
  return enhance(mat, { wind: strength });
}
