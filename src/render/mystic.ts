import * as THREE from 'three';
import { heightAt, type World } from '../sim/world';
import { glowTexture, makeRand, calmFlicker } from './util';

const GLOW = () => glowTexture();

interface Wisp {
  core: THREE.Mesh;
  halo: THREE.Sprite;
  light?: THREE.PointLight;
  anchor: THREE.Vector3;
  next: THREE.Vector3;
  travel: number; // 0..1 progress to next anchor
  speed: number;
  freq: THREE.Vector3;
  phase: number;
  color: THREE.Color;
  trail: THREE.Vector3[];
}

const TRAIL = 22;

/**
 * Wisps: small drifting lights. They wander between anchor points (treeline,
 * the fairy ring, the station) and brighten at night.
 */
export class Wisps {
  group = new THREE.Group();
  private wisps: Wisp[] = [];
  private trailGeo: THREE.BufferGeometry;
  private trailMat: THREE.ShaderMaterial;
  private rand = makeRand(77);
  private anchors: THREE.Vector3[];

  constructor(private world: World, anchors: THREE.Vector3[], count = 9) {
    this.anchors = anchors;
    const tex = GLOW();
    const palette = ['#9ff7e4', '#bfe8ff', '#f4e7a1', '#c9b8ff', '#a8ffb8'];
    for (let i = 0; i < count; i++) {
      const color = new THREE.Color(palette[i % palette.length]);
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 6),
        new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(4), toneMapped: false }),
      );
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8,
      }));
      halo.scale.setScalar(1.1);
      const anchor = this.pick().clone();
      const w: Wisp = {
        core, halo, anchor, next: this.pick().clone(), travel: this.rand(),
        speed: 0.03 + this.rand() * 0.04,
        freq: new THREE.Vector3(0.6 + this.rand(), 0.8 + this.rand(), 0.5 + this.rand()),
        phase: this.rand() * 10, color,
        trail: Array.from({ length: TRAIL }, () => anchor.clone()),
      };
      if (i < 4) {
        w.light = new THREE.PointLight(color, 0, 7, 1.6);
        this.group.add(w.light);
      }
      this.group.add(core, halo);
      this.wisps.push(w);
    }

    // One shared particle buffer draws every wisp's fading trail.
    const n = count * TRAIL;
    this.trailGeo = new THREE.BufferGeometry();
    this.trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.trailGeo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.trailGeo.setAttribute('aFade', new THREE.BufferAttribute(new Float32Array(n), 1));
    this.trailMat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 1 }, uGlow: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute vec3 aColor; attribute float aFade;
        uniform float uScale; varying vec3 vColor; varying float vFade;
        void main() {
          vColor = aColor; vFade = aFade;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (2.0 + 7.0 * aFade) * uScale;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uGlow; varying vec3 vColor; varying float vFade;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vFade * uGlow;
          gl_FragColor = vec4(vColor * 1.6 * a, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(this.trailGeo, this.trailMat);
    pts.frustumCulled = false;
    this.group.add(pts);
  }

  private pick() {
    return this.anchors[Math.floor(this.rand() * this.anchors.length)];
  }

  update(t: number, dt: number, night: number, pointScale: number) {
    const glow = 0.35 + night * 0.65;
    this.trailMat.uniforms.uGlow.value = glow;
    this.trailMat.uniforms.uScale.value = pointScale;
    const pos = this.trailGeo.attributes.position as THREE.BufferAttribute;
    const colA = this.trailGeo.attributes.aColor as THREE.BufferAttribute;
    const fade = this.trailGeo.attributes.aFade as THREE.BufferAttribute;
    const base = new THREE.Vector3();

    this.wisps.forEach((w, wi) => {
      w.travel += w.speed * dt;
      if (w.travel >= 1) {
        w.travel = 0;
        w.anchor.copy(w.next);
        w.next.copy(this.pick());
      }
      const e = w.travel * w.travel * (3 - 2 * w.travel);
      base.lerpVectors(w.anchor, w.next, e);
      const ph = t + w.phase;
      const p = w.core.position;
      p.set(
        base.x + Math.sin(ph * w.freq.x) * 1.6 + Math.sin(ph * 2.3) * 0.3,
        0,
        base.z + Math.cos(ph * w.freq.z) * 1.6,
      );
      p.y = heightAt(this.world, p.x, p.z) + 1.3 + Math.sin(ph * w.freq.y) * 0.6 + base.y;
      const flicker = 0.85 * calmFlicker(ph, 0, 0.06);
      w.halo.position.copy(p);
      w.halo.scale.setScalar((0.55 + night * 0.5) * flicker);
      (w.halo.material as THREE.SpriteMaterial).opacity = glow * 0.9;
      if (w.light) {
        w.light.position.copy(p);
        w.light.intensity = night * 6 * flicker;
      }

      // Trail: shift history, newest first.
      w.trail.pop();
      w.trail.unshift(p.clone());
      for (let k = 0; k < TRAIL; k++) {
        const i = wi * TRAIL + k;
        const tp = w.trail[k];
        pos.setXYZ(i, tp.x, tp.y, tp.z);
        colA.setXYZ(i, w.color.r, w.color.g, w.color.b);
        fade.setX(i, 1 - k / TRAIL);
      }
    });
    pos.needsUpdate = colA.needsUpdate = fade.needsUpdate = true;
  }
}

/** Fireflies: hundreds of blinking points over the meadow, only at dusk and night. */
export class Fireflies {
  points: THREE.Points;
  private mat: THREE.ShaderMaterial;
  constructor(world: World, count = 420) {
    const rand = makeRand(55);
    const pos = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2, r = 6 + rand() * 34;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      pos.set([x, heightAt(world, x, z) + 0.3 + rand() * 1.6, z], i * 3);
      phase[i] = rand() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uNight: { value: 0 }, uScale: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aPhase; uniform float uTime; uniform float uScale; varying float vBlink;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.3 + aPhase) * 0.8;
          p.z += cos(uTime * 0.25 + aPhase * 1.3) * 0.8;
          p.y += sin(uTime * 0.5 + aPhase * 0.7) * 0.3;
          vBlink = pow(max(0.0, sin(uTime * 1.3 + aPhase * 3.0)), 6.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = 5.0 * uScale;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uNight; varying float vBlink;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.05, d) * vBlink * uNight;
          gl_FragColor = vec4(vec3(1.0, 0.92, 0.45) * 2.5 * a, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
  }
  update(t: number, night: number, pointScale: number) {
    this.mat.uniforms.uTime.value = t;
    this.mat.uniforms.uNight.value = night;
    this.mat.uniforms.uScale.value = pointScale;
  }
}

/**
 * The Orb: a large, silent light that hangs over the treeline, then is
 * somewhere else. Nobody at the station agrees on what it is.
 */
export class Orb {
  group = new THREE.Group();
  private core: THREE.Mesh;
  private halo: THREE.Sprite;
  /** Where it shows itself: over the Ring and the Folk's hill, never at random over the village. */
  private spots: THREE.Vector3[];
  private idx = 0;
  private clock = 0;
  private presence = 1;
  constructor(spots: THREE.Vector3[]) {
    this.spots = spots;
    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 16, 12),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4e0').multiplyScalar(3), toneMapped: false, transparent: true }),
    );
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: GLOW(), color: '#ffe9c9', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.halo.scale.setScalar(4.5);
    this.group.add(this.core, this.halo);
    this.group.position.copy(this.spots[0]);
  }
  update(t: number, dt: number, night: number) {
    this.clock += dt;
    // Every ~25s: fade out, jump, fade in. No travel between.
    const cycle = 25;
    const local = this.clock % cycle;
    if (local < dt) {
      this.idx = (this.idx + 1) % this.spots.length;
    }
    this.presence = local < 1.2 ? local / 1.2 : local > cycle - 1.2 ? (cycle - local) / 1.2 : 1;
    // It only comes one visit in three, and only after dark.
    if (Math.floor(this.clock / cycle) % 3 !== 0 || night < 0.4) this.presence = 0;
    const target = this.spots[this.idx];
    this.group.position.set(target.x + Math.sin(t * 0.2) * 1.5, target.y + Math.sin(t * 0.7) * 0.5, target.z);
    const vis = this.presence * (0.25 + night * 0.75);
    (this.core.material as THREE.MeshBasicMaterial).opacity = vis;
    const hm = this.halo.material as THREE.SpriteMaterial;
    hm.opacity = vis * (0.6 + Math.sin(t * 2.3) * 0.1);
  }
}
