import * as THREE from 'three';

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
  /** Zone overlay strength: faint normally, strong while painting. */
  uZone: { value: 0.18 },
  /** Season look, 0..1 each. */
  uSnow: { value: 0 },
  uAutumn: { value: 0 },
  uBare: { value: 0 },
  uBlossom: { value: 0 },
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
      if (vHash > 0.62) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.98, 0.8, 0.86), uBlossom * 0.8);
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
  const wind = opts.wind ?? 0;
  const fog = opts.fog ?? true;
  const zone = opts.zone ?? false;
  const season = opts.season ?? 'solid';
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, worldUniforms);
    let vs = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uTime; uniform float uWind; uniform float uBare; uniform float uFogSize;
      uniform sampler2D uWearTex;
      varying vec2 vFowXZ; varying float vUp; varying float vHash;`,
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
      uniform sampler2D uFogTex; uniform sampler2D uWearTex; uniform float uFogSize; uniform float uTime; uniform float uZone;
      uniform float uSnow; uniform float uAutumn; uniform float uBare; uniform float uBlossom;
      varying vec2 vFowXZ; varying float vUp; varying float vHash;`,
    );
    if (season !== 'none') {
      fs = fs.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float snowK = uSnow * smoothstep(0.35, 0.8, vUp) * (0.85 + 0.15 * vHash);
          ${SEASON_GLSL[season]}
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.94, 0.98), snowK);
        }`,
      );
    }
    if (fog) {
      fs = fs.replace(
        '#include <fog_fragment>',
        `{
          vec2 fuv = (vFowXZ + uFogSize * 0.5) / uFogSize;
          vec4 fz = texture2D(uFogTex, fuv);
          float seen = fz.r;
          ${zone ? `
          // G = home, B = woodlot, A = sacred ground.
          vec3 zc = vec3(0.0); float zk = 0.0; float edge = 0.0;
          zc += vec3(1.0, 0.86, 0.55) * fz.g; zk += fz.g; edge = max(edge, 1.0 - smoothstep(0.0, 0.22, abs(fz.g - 0.5)));
          zc += vec3(0.55, 0.85, 0.45) * fz.b; zk += fz.b; edge = max(edge, 1.0 - smoothstep(0.0, 0.22, abs(fz.b - 0.5)));
          zc += vec3(0.78, 0.6, 1.0) * fz.a; zk += fz.a; edge = max(edge, 1.0 - smoothstep(0.0, 0.22, abs(fz.a - 0.5)));
          vec3 zoneCol = zk > 0.001 ? zc / zk : vec3(1.0);
          // Scale the tint by scene brightness so zone lines never glow in the dark.
          float zl = dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * 1.06 + zoneCol * 0.035 * zl, min(zk, 1.0) * uZone);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, zoneCol * (zl * 1.7 + 0.02), edge * 0.6 * uZone);` : ''}
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
  mat.customProgramCacheKey = () => `enh-${wind}-${fog}-${zone}-${season}`;
  return mat;
}

/** Wind-only helper kept for call sites that want the old behaviour. */
export function addWind(mat: THREE.Material, strength = 0.12) {
  return enhance(mat, { wind: strength });
}
