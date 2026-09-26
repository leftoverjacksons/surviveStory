import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

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
  zoomBy(factor: number) { this.zoomGoal = THREE.MathUtils.clamp(this.zoomGoal * factor, 0.45, 3.2); }

  /** Pan in screen-aligned ground directions. dx/dy in world units at zoom 1. */
  pan(dx: number, dy: number) {
    const s = 1 / this.zoom;
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.target.addScaledVector(right, dx * s).addScaledVector(fwd, dy * s);
    this.target.x = THREE.MathUtils.clamp(this.target.x, -35, 35);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -35, 35);
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
    this.hemi = new THREE.HemisphereLight('#ffffff', '#223311', 1);
    scene.add(this.sun, this.sun.target, this.hemi);
    scene.fog = new THREE.Fog('#000000', 115, 230);
    scene.background = this.background;
  }

  setHour(hour: number) {
    const h = ((hour % 24) + 24) % 24;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = (h - a.h) / (b.h - a.h);

    lerpColor(a.sky, b.sky, t, this.background);
    lerpColor(a.sun, b.sun, t, this.sun.color);
    this.sun.intensity = a.sunI + (b.sunI - a.sunI) * t;
    lerpColor(a.hemiSky, b.hemiSky, t, this.hemi.color);
    lerpColor(a.hemiGround, b.hemiGround, t, this.hemi.groundColor);
    this.hemi.intensity = a.hemiI + (b.hemiI - a.hemiI) * t;
    (this.scene.fog as THREE.Fog).color.copy(this.background);

    // Sun arc: rises east (+x), sets west (-x). At night the "sun" is the moon, opposite.
    const dayAngle = ((h - 6) / 12) * Math.PI;
    let elev = Math.sin(dayAngle);
    let az = Math.cos(dayAngle);
    if (elev < 0.08) {
      // Moonlight from a fixed, high-ish angle so night shadows stay readable.
      elev = 0.6;
      az = -0.4;
    }
    this.sun.position.set(az * 50, Math.max(elev, 0.15) * 55, 22);
    this.sun.target.position.set(0, 0, 0);

    const sunElev = Math.sin(dayAngle);
    this.night = 1 - THREE.MathUtils.smoothstep(sunElev, -0.1, 0.3);
  }
}

// ---------------- renderer ----------------

export function createRenderer(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);
  return renderer;
}

export function createComposer(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, w: number, h: number) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.7, 0.55, 1.05);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return { composer, bloom };
}
