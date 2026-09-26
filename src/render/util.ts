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
  uFogSize: { value: 256 },
  /** Home-zone overlay strength: faint normally, strong while painting. */
  uZone: { value: 0.18 },
};
/** Back-compat alias used by older call sites. */
export const windUniforms = worldUniforms;

export interface EnhanceOptions {
  /** Sway amplitude for foliage; sway scales with local height so bases stay planted. */
  wind?: number;
  /** Darken unexplored parts of the map (fog of war). Default true. */
  fog?: boolean;
  /** Tint the home zone and outline its edge (ground materials only). */
  zone?: boolean;
}

/**
 * Patch a built-in material with wind sway and/or fog of war. The fog samples
 * a map-sized texture of explored tiles using world-space XZ.
 */
export function enhance<T extends THREE.Material>(mat: T, opts: EnhanceOptions = {}): T {
  const wind = opts.wind ?? 0;
  const fog = opts.fog ?? true;
  const zone = opts.zone ?? false;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, worldUniforms);
    let vs = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uTime; uniform float uWind;
      varying vec2 vFowXZ;`,
    );
    if (wind > 0) {
      vs = vs.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(modelMatrix[3][0], 0.0, modelMatrix[3][2]);
        #endif
        float h = max(position.y, 0.0);
        float ph = ip.x * 0.37 + ip.z * 0.23;
        float sway = sin(uTime * 1.7 + ph) * 0.6 + sin(uTime * 3.1 + ph * 1.9) * 0.4;
        transformed.x += sway * ${wind.toFixed(3)} * h * uWind;
        transformed.z += cos(uTime * 1.3 + ph) * ${(wind * 0.6).toFixed(3)} * h * uWind;`,
      );
    }
    vs = vs.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec4 fowWP = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        fowWP = instanceMatrix * fowWP;
      #endif
      fowWP = modelMatrix * fowWP;
      vFowXZ = fowWP.xz;`,
    );
    shader.vertexShader = vs;
    if (fog) {
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform sampler2D uFogTex; uniform float uFogSize; uniform float uTime; uniform float uZone;
          varying vec2 vFowXZ;`,
        )
        .replace(
          '#include <fog_fragment>',
          `{
            vec2 fuv = (vFowXZ + uFogSize * 0.5) / uFogSize;
            vec2 fz = texture2D(uFogTex, fuv).rg;
            float seen = fz.r;
            ${zone ? `
            float zn = fz.g;
            float edge = 1.0 - smoothstep(0.0, 0.22, abs(zn - 0.5));
            vec3 zoneCol = vec3(1.0, 0.86, 0.55);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * 1.08 + zoneCol * 0.03, zn * uZone);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, zoneCol, edge * 0.55 * uZone);` : ''}
            float drift = sin(vFowXZ.x * 0.21 + uTime * 0.15) * sin(vFowXZ.y * 0.17 - uTime * 0.11) * 0.08;
            float k = smoothstep(0.25, 0.75, seen + drift);
            float lum = dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11));
            vec3 mist = vec3(0.045, 0.06, 0.07) + lum * 0.08;
            gl_FragColor.rgb = mix(mist, gl_FragColor.rgb, k);
          }
          #include <fog_fragment>`,
        );
    }
  };
  mat.customProgramCacheKey = () => `enh-${wind}-${fog}-${zone}`;
  return mat;
}

/** Wind-only helper kept for call sites that want the old behaviour. */
export function addWind(mat: THREE.Material, strength = 0.12) {
  return enhance(mat, { wind: strength });
}
