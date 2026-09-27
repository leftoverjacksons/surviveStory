import * as THREE from 'three';
import { PIXEL, SOFT, worldUniforms } from './util';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * Final colour grade, in display space: cool shadows and warm highlights
 * (split toning), a touch of saturation and contrast, and a soft vignette.
 * Aimed at the warm-village, teal-shadow look of the art reference.
 */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uNight: { value: 0 }, uSteps: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uNight; uniform float uSteps; varying vec2 vUv;
    void main() {
      vec4 src = texture2D(tDiffuse, vUv);
      vec3 c = src.rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // Split toning: teal in the shadows, warm in the highlights (less at night).
      float sh = 1.0 - smoothstep(0.0, 0.45, l), hi = smoothstep(0.55, 1.0, l);
      float tone = uSteps > 0.0 ? 2.2 : 1.0;
      c += (sh * vec3(-0.012, 0.006, 0.018) + hi * vec3(0.02, 0.008, -0.018) * (1.0 - uNight)) * tone;
      if (uSteps > 0.0) c *= mix(vec3(1.0), vec3(1.05, 1.0, 0.9), (1.0 - uNight) * smoothstep(0.15, 0.7, l));
      // Saturation and a gentle S-curve.
      c = mix(vec3(l), c, 1.08);
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.18);
      // Vignette.
      vec2 d = vUv - 0.5;
      c *= 1.0 - smoothstep(0.35, 0.85, length(d * vec2(1.1, 1.0))) * 0.22;
      // Pixel art: colour in steps (a limited palette, stepped light).
      if (uSteps > 0.0) c = floor(clamp(c, 0.0, 1.0) * uSteps + 0.5) / uSteps;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), src.a);
    }`,
};

/**
 * Pixel-art outlines, from the depth buffer alone. A pixel whose neighbour
 * lies well behind it is on a silhouette: darkened. A pixel on a convex
 * crease (surface normals, rebuilt from depth, turn sharply) is lightened,
 * like a highlight catching an edge. Lines land on the nearer surface only,
 * so they stay one pixel wide.
 */
class OutlinePass extends Pass {
  private quad: FullScreenQuad;
  private mat: THREE.ShaderMaterial;
  constructor(private camera: THREE.OrthographicCamera, private scene?: THREE.Scene) {
    super();
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
        uNear: { value: 0.1 }, uFar: { value: 400 }, uView: { value: new THREE.Vector2(1, 1) }, uDebug: { value: typeof location !== 'undefined' && location.search.includes('pixeldebug') ? 1 : 0 },
        uCam: { value: new THREE.Matrix4() }, uFogTex: worldUniforms.uFogTex, uFogSize: worldUniforms.uFogSize,
        uFogNear: { value: 115 }, uFogFar: { value: 230 },
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform vec2 uRes; uniform float uNear; uniform float uFar; uniform vec2 uView; uniform float uDebug;
        uniform mat4 uCam; uniform sampler2D uFogTex; uniform float uFogSize; uniform float uFogNear; uniform float uFogFar;
        varying vec2 vUv;
        float lin(vec2 uv) { return uNear + texture2D(tDepth, uv).x * (uFar - uNear); }
        vec3 P(vec2 uv) { return vec3((uv - 0.5) * uView, -lin(uv)); }
        vec3 N(vec2 uv, vec2 px) {
          vec3 p = P(uv);
          return normalize(cross(P(uv + vec2(px.x, 0.0)) - p, P(uv + vec2(0.0, px.y)) - p));
        }
        void main() {
          vec2 px = 1.0 / uRes;
          vec4 src = texture2D(tDiffuse, vUv);
          float d = lin(vUv);
          vec2 o[4]; o[0] = vec2(px.x, 0.0); o[1] = vec2(-px.x, 0.0); o[2] = vec2(0.0, px.y); o[3] = vec2(0.0, -px.y);
          // World size of one pixel: the ground's own slope shouldn't count as an edge.
          float wpp = uView.y / uRes.y;
          float thresh = 0.35 + wpp * 3.0;
          float edge = 0.0, crease = 0.0;
          vec3 n = N(vUv, px);
          for (int i = 0; i < 4; i++) {
            float dn = lin(vUv + o[i]);
            if (dn - d > thresh) edge = 1.0;
            else if (abs(dn - d) < thresh) {
              vec3 nn = N(vUv + o[i], px);
              // Convex crease on one side only (keeps the line one pixel wide).
              float turn = 1.0 - dot(n, nn);
              vec3 dp = P(vUv + o[i]) - P(vUv);
              if (turn > 0.35 && dot(dp, n) < 0.0 && dot(nn - n, vec3(1.0, 1.0, 0.0)) > 0.0) crease = max(crease, turn);
            }
          }
          vec3 c = src.rgb;
          if (d > uFar - 1.0) { gl_FragColor = src; return; }   // sky
          // No lines where the land is unexplored or lost in fog: they would give it away.
          vec3 wp = (uCam * vec4(P(vUv), 1.0)).xyz;
          float seen = smoothstep(0.3, 0.8, texture2D(uFogTex, (wp.xz + uFogSize * 0.5) / uFogSize).r);
          float clearAir = 1.0 - smoothstep(uFogNear, uFogFar, d);
          float ink = seen * clearAir;
          edge *= step(0.5, ink); crease *= ink;
          if (uDebug > 0.5) { gl_FragColor = vec4(edge, texture2D(tDepth, vUv).x * 20.0 - floor(texture2D(tDepth, vUv).x * 20.0), crease, 1.0); return; }
          if (edge > 0.0) c = c * 0.38 + vec3(0.025, 0.012, 0.03);          // ink: a deep warm violet-brown
          else if (crease > 0.0) c = c * (1.0 + 0.5 * clamp(crease * 2.0, 0.0, 1.0)) + 0.015;
          gl_FragColor = vec4(c, src.a);
        }`,
    });
    this.quad = new FullScreenQuad(this.mat);
  }
  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    const u = this.mat.uniforms, c = this.camera;
    u.tDiffuse.value = readBuffer.texture;
    u.tDepth.value = readBuffer.depthTexture;
    u.uRes.value.set(readBuffer.width, readBuffer.height);
    u.uNear.value = c.near; u.uFar.value = c.far;
    u.uView.value.set((c.right - c.left) / c.zoom, (c.top - c.bottom) / c.zoom);
    u.uCam.value.copy(c.matrixWorld);
    const fog = this.scene?.fog as THREE.Fog | undefined;
    if (fog) { u.uFogNear.value = fog.near; u.uFogFar.value = fog.far; }
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}

/** True isometric elevation: atan(1/sqrt(2)) ≈ 35.26°. */
const ISO_PITCH = Math.atan(1 / Math.SQRT2);

/**
 * Orthographic camera on a yaw/zoom/pan rig. Keeps an isometric look while
 * allowing free or snapped rotation.
 */
export class IsoCamera {
  camera: THREE.OrthographicCamera;
  target = new THREE.Vector3(0, 0, 0);
  yaw = Math.PI / 4;
  yawGoal = Math.PI / 4;
  zoom = 1.45;
  zoomGoal = 1.45;
  private viewSize = 30; // world units visible vertically at zoom 1
  private distance = 80;
  bounds = 120;
  /**
   * Pixel art: rows of the low-resolution image (0 = no snapping). The camera
   * is snapped to whole pixels so edges don't crawl as it pans; `residual`
   * is what was snapped away, in pixels, for shifting the canvas to match.
   */
  snapRows = 0;
  residual = new THREE.Vector2();
  private _r = new THREE.Vector3();
  private _u = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    this.resize(aspect);
  }

  resize(aspect: number) {
    const h = this.viewSize / 2;
    this.camera.left = -h * aspect;
    this.camera.right = h * aspect;
    this.camera.top = h;
    this.camera.bottom = -h;
    this.camera.updateProjectionMatrix();
  }

  rotateBy(rad: number) { this.yawGoal += rad; }
  snap(dir: 1 | -1) {
    const step = Math.PI / 4;
    this.yawGoal = Math.round(this.yawGoal / step) * step + dir * step;
  }
  zoomBy(factor: number) { this.zoomGoal = THREE.MathUtils.clamp(this.zoomGoal * factor, 0.6, 3.2); }

  /** Pan in screen-aligned ground directions. dx/dy in world units at zoom 1. */
  pan(dx: number, dy: number) {
    const s = 1 / this.zoom;
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.target.addScaledVector(right, dx * s).addScaledVector(fwd, dy * s);
    this.target.x = THREE.MathUtils.clamp(this.target.x, -this.bounds, this.bounds);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -this.bounds, this.bounds);
  }

  update(dt: number) {
    const k = 1 - Math.exp(-dt * 8);
    this.yaw += (this.yawGoal - this.yaw) * k;
    this.zoom += (this.zoomGoal - this.zoom) * k;
    const c = this.camera;
    const horiz = Math.cos(ISO_PITCH) * this.distance;
    c.position.set(
      this.target.x + Math.sin(this.yaw) * horiz,
      this.target.y + Math.sin(ISO_PITCH) * this.distance,
      this.target.z + Math.cos(this.yaw) * horiz,
    );
    c.lookAt(this.target);
    if (Math.abs(c.zoom - this.zoom) > 1e-4) {
      c.zoom = this.zoom;
      c.updateProjectionMatrix();
    }
    if (this.snapRows > 0) {
      c.updateMatrixWorld();
      const wpp = this.viewSize / c.zoom / this.snapRows;
      this._r.setFromMatrixColumn(c.matrixWorld, 0);
      this._u.setFromMatrixColumn(c.matrixWorld, 1);
      const px = c.position.dot(this._r) / wpp, py = c.position.dot(this._u) / wpp;
      const dx = Math.round(px) - px, dy = Math.round(py) - py;
      c.position.addScaledVector(this._r, dx * wpp).addScaledVector(this._u, dy * wpp);
      c.updateMatrixWorld();
      this.residual.set(dx, dy);
    }
  }

  /** Compass heading for UI, in degrees. */
  get headingDeg() {
    return ((THREE.MathUtils.radToDeg(this.yaw) % 360) + 360) % 360;
  }
}

// ---------------- sky & lighting ----------------

interface Key { h: number; sky: string; sun: string; sunI: number; hemiSky: string; hemiGround: string; hemiI: number }

// Keyframes over a 24h day. Colors picked for a humid, overgrown world.
const KEYS: Key[] = [
  { h: 0,    sky: '#0d1828', sun: '#8fa8ff', sunI: 0.75, hemiSky: '#3d5480', hemiGround: '#141d16', hemiI: 1.0 },
  { h: 4.8,  sky: '#17223c', sun: '#8aa0ff', sunI: 0.7,  hemiSky: '#43577e', hemiGround: '#151d15', hemiI: 1.0 },
  { h: 6.2,  sky: '#e39a7a', sun: '#ffb27a', sunI: 1.2,  hemiSky: '#c9a2a0', hemiGround: '#2b2a1a', hemiI: 0.8 },
  { h: 8.5,  sky: '#a9cfd6', sun: '#ffe7c4', sunI: 2.3,  hemiSky: '#cfe6ea', hemiGround: '#3a4424', hemiI: 1.0 },
  { h: 13,   sky: '#9fcbd9', sun: '#fff6e6', sunI: 2.6,  hemiSky: '#d8eef2', hemiGround: '#3e4a26', hemiI: 1.05 },
  { h: 17,   sky: '#b9c9b8', sun: '#ffd9a0', sunI: 2.2,  hemiSky: '#d8d8c0', hemiGround: '#3a3a20', hemiI: 0.95 },
  { h: 18.9, sky: '#c98468', sun: '#ffa468', sunI: 1.5,  hemiSky: '#a9a0b0', hemiGround: '#26301a', hemiI: 0.85 },
  { h: 20.2, sky: '#2c2a4e', sun: '#9a8cff', sunI: 0.75, hemiSky: '#524c80', hemiGround: '#161a14', hemiI: 0.95 },
  { h: 24,   sky: '#0d1828', sun: '#8fa8ff', sunI: 0.75, hemiSky: '#3d5480', hemiGround: '#141d16', hemiI: 1.0 },
];

const cA = new THREE.Color(), cB = new THREE.Color();
function lerpColor(a: string, b: string, t: number, out: THREE.Color) {
  cA.set(a); cB.set(b);
  return out.copy(cA).lerp(cB, t);
}

export class Sky {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  background = new THREE.Color();
  /** 0 during full day, 1 during full night. */
  night = 0;

  constructor(private scene: THREE.Scene) {
    this.sun = new THREE.DirectionalLight('#ffffff', 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 1; sc.far = 160;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    // Soft-edged shadows (the light filtered through leaves and haze).
    this.sun.shadow.radius = PIXEL ? 0 : SOFT ? 3.5 : 1; // pixel art wants crisp shadows
    this.sun.shadow.blurSamples = 12;
    this.hemi = new THREE.HemisphereLight('#ffffff', '#223311', 1);
    scene.add(this.sun, this.sun.target, this.hemi);
    scene.fog = new THREE.Fog('#000000', 115, 230);
    scene.background = this.background;
  }

  private center = new THREE.Vector3();

  /** Keep the sun's shadow frustum centred on what the camera is looking at. */
  follow(p: THREE.Vector3) { this.center.copy(p); }

  /**
   * Set the sky for a clock hour. `daylight` stretches the day (long summer,
   * short winter); `gloom` 0..1 dims and flattens light for rain and overcast;
   * `fogginess` 0..1 pulls the distance fog in; `snow` cools the palette.
   */
  setHour(hour: number, daylight = 12, gloom = 0, fogginess = 0, snow = 0) {
    const raw = ((hour % 24) + 24) % 24;
    // Map the real clock onto the 12h-day keyframes.
    const rise = 12 - daylight / 2, set = 12 + daylight / 2;
    let h: number;
    if (raw >= rise && raw <= set) h = 6 + ((raw - rise) / daylight) * 12;
    else {
      const night = 24 - daylight;
      const since = raw > set ? raw - set : raw + 24 - set;
      h = (18 + (since / night) * 12) % 24;
    }
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = (h - a.h) / (b.h - a.h);

    lerpColor(a.sky, b.sky, t, this.background);
    lerpColor(a.sun, b.sun, t, this.sun.color);
    // Pixel art: golden-hour warmth all day, and a warm bounce from the ground.
    if (PIXEL) this.sun.color.lerp(cB.set('#ffc98a'), 0.28 * (1 - this.nightFor(h)));
    this.sun.intensity = (a.sunI + (b.sunI - a.sunI) * t) * (1 - gloom * 0.55);
    lerpColor(a.hemiSky, b.hemiSky, t, this.hemi.color);
    lerpColor(a.hemiGround, b.hemiGround, t, this.hemi.groundColor);
    if (PIXEL) this.hemi.groundColor.lerp(cB.set('#6a5030'), 0.35);
    this.hemi.intensity = (a.hemiI + (b.hemiI - a.hemiI) * t) * (1 - gloom * 0.15) * (1 + snow * 0.12);
    // Grey skies and cold light.
    const grey = cA.setRGB(0.55, 0.58, 0.6).multiplyScalar(0.4 + (1 - this.nightFor(h)) * 0.6);
    this.background.lerp(grey, gloom * 0.6);
    if (snow > 0) this.background.lerp(cB.setRGB(0.78, 0.82, 0.88).multiplyScalar(0.3 + (1 - this.nightFor(h)) * 0.7), snow * 0.35);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(this.background);
    // Fog softens the distance; it shouldn't hide the village you're looking at.
    fog.near = 115 - fogginess * 25;
    fog.far = 230 - fogginess * 60;

    // Sun arc: rises east (+x), sets west (-x). At night the "sun" is the moon, opposite.
    const dayAngle = ((h - 6) / 12) * Math.PI;
    let elev = Math.sin(dayAngle);
    let az = Math.cos(dayAngle);
    if (elev < 0.08) {
      // Moonlight from a fixed, high-ish angle so night shadows stay readable.
      elev = 0.6;
      az = -0.4;
    }
    const c = this.center;
    // Snap to a coarse grid so the shadow map doesn't shimmer while panning.
    const sx = Math.round(c.x / 2) * 2, sz = Math.round(c.z / 2) * 2;
    // Pixel art: a lower sun, for long raking shadows and warm side light.
    this.sun.position.set(sx + az * 50, Math.max(elev, 0.15) * (PIXEL ? 38 : 55), sz + 22);
    this.sun.target.position.set(sx, 0, sz);
    this.night = this.nightFor(h);
    if (PIXEL) {
      // Pixel art compresses the darks: lift the night so the village still reads (a bright moon, blue sky-glow).
      this.hemi.intensity *= 1 + 0.7 * this.night;
      this.sun.intensity *= 1 + 0.45 * this.night;
      this.hemi.color.lerp(cB.set('#8a9ad0'), 0.35 * this.night);
    }
  }

  private nightFor(h: number) {
    return 1 - THREE.MathUtils.smoothstep(Math.sin(((h - 6) / 12) * Math.PI), -0.1, 0.3);
  }
}

// ---------------- renderer ----------------

export function createRenderer(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: !PIXEL, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  // Pixel art: draw at a fraction of the screen and let the browser enlarge it with hard edges.
  renderer.setPixelRatio(PIXEL ? 1 / PIXEL : Math.min(window.devicePixelRatio, 2));
  if (PIXEL) renderer.domElement.style.imageRendering = 'pixelated';
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.info.autoReset = false; // reset once per frame, so the counts cover every pass
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft is gone from three; the sun's radius softens instead
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = PIXEL ? 1.22 : 1.0; // pixel art: brighter, golden
  container.appendChild(renderer.domElement);
  return renderer;
}

/**
 * A render pass that draws over the previous one. A colour background makes
 * three.js clear the frame on every render, so it is lifted for this pass.
 */
class OverlayPass extends RenderPass {
  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget, deltaTime: number, maskActive: boolean) {
    const bg = this.scene.background;
    this.scene.background = null;
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    this.scene.background = bg;
  }
}

/**
 * People live on layer 1 only. The world (layer 0) is drawn first; then
 * people's silhouettes are drawn wherever the *world* hides them; then the
 * people themselves on top with a normal depth test. Because the silhouette
 * pass only sees the world's depth, a person never ghosts through their own
 * arm or torso.
 */
export function createComposer(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, w: number, h: number) {
  // The composer draws into its own buffers, which get no anti-aliasing
  // unless they are multisampled: the renderer's own `antialias` doesn't reach them.
  const pr = renderer.getPixelRatio();
  const target = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: SOFT && !PIXEL ? 4 : 0 });
  // The outline pass reads depth: give both of the composer's buffers a depth texture.
  if (PIXEL) target.depthTexture = new THREE.DepthTexture(w * pr, h * pr);
  const composer = new EffectComposer(renderer, target);
  if (PIXEL && !composer.renderTarget2.depthTexture) composer.renderTarget2.depthTexture = new THREE.DepthTexture(w * pr, h * pr);
  composer.addPass(new RenderPass(scene, camera));
  const xrayCam = (camera as THREE.OrthographicCamera).clone();
  const peopleCam = (camera as THREE.OrthographicCamera).clone();
  const xrayMat = new THREE.MeshBasicMaterial({ color: '#5f9f98', depthWrite: false, depthFunc: THREE.GreaterDepth, fog: false });
  const xray = new OverlayPass(scene, xrayCam, xrayMat);
  xray.clear = false;
  xray.clearDepth = false;
  const peoplePass = new OverlayPass(scene, peopleCam);
  peoplePass.clear = false;
  peoplePass.clearDepth = false;
  composer.addPass(xray);
  composer.addPass(peoplePass);
  const outline = PIXEL ? new OutlinePass(camera as THREE.OrthographicCamera, scene) : null;
  if (outline) composer.addPass(outline);
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.7, 0.55, 1.05);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  grade.uniforms.uSteps.value = PIXEL ? 14 : 0;
  grade.enabled = !new URLSearchParams(location.search).has('nograde');
  composer.addPass(grade);
  const syncXray = () => {
    for (const c of [xrayCam, peopleCam]) {
      c.copy(camera as THREE.OrthographicCamera);
      c.layers.set(1);
    }
  };
  return { composer, bloom, grade, syncXray };
}

/** Lights must also shine (and cast shadows) on layer 1, where people are. */
export function lightPeopleLayer(scene: THREE.Scene) {
  scene.traverse((o) => {
    const l = o as THREE.Light;
    if (!l.isLight) return;
    l.layers.enable(1);
    const sh = (l as THREE.DirectionalLight).shadow;
    if (sh?.camera) sh.camera.layers.enable(1);
  });
}
