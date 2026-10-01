/**
 * Leaf cards (DESIGN §41): a broadleaf canopy clump drawn as a cloud of small
 * camera-facing cut-out cards instead of a solid lumpy ball, so crowns have
 * soft, broken edges.
 *
 * One clump is a single geometry of N cards. Every corner of a card sits at
 * the card's centre; the vertex shader pushes the corners out in view space,
 * so each card always faces the camera. Normals point out from the clump's
 * middle, so the cards light as one round mass rather than as flat paper.
 * The leaf texture is drawn in code (a clump of small leaves, grey, so the
 * per-tree colour and the seasons tint it) and cut out with alpha testing,
 * so cards write depth like solid geometry: outlines, fog and the Veil's dark
 * all work unchanged. Shadows use a matching depth material.
 *
 * It drops in for the 'blob' geometry of trees.ts: the same instance matrices
 * and colours, so it costs no extra draw calls.
 */
import * as THREE from 'three';
import { enhance, makeRand, worldUniforms, type EnhanceOptions } from './util';

/** Cards per clump. */
const N = 32;

/** One clump's cards, in the blob's unit space (radius about 1). */
export function leafCardGeometry(): THREE.BufferGeometry {
  const rand = makeRand(4271);
  const pos: number[] = [], nor: number[] = [], corner: number[] = [], size: number[] = [], rot: number[] = [], uv: number[] = [], index: number[] = [];
  const c = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    // Mostly near the surface, a few inside to fill it; flatter underneath, as the blobs are.
    c.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
    if (c.lengthSq() < 1e-4) c.set(0, 1, 0);
    c.normalize().multiplyScalar(0.42 + 0.48 * Math.sqrt(rand()));
    if (c.y < 0) c.y *= 0.78;
    const n = c.clone().add(new THREE.Vector3(0, 0.18, 0)).normalize();
    const s = 0.52 + rand() * 0.28;
    const r = rand() * Math.PI * 2;
    const base = i * 4;
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      pos.push(c.x, c.y, c.z);
      nor.push(n.x, n.y, n.z);
      corner.push(cx, cy);
      size.push(s);
      rot.push(r);
      uv.push((cx + 1) / 2, (cy + 1) / 2);
    }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aCorner', new THREE.Float32BufferAttribute(corner, 2));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  g.setAttribute('aRot', new THREE.Float32BufferAttribute(rot, 1));
  g.setIndex(index);
  // Corners reach past the centres: say so, or clumps get culled at the screen's edge.
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.8);
  g.boundingBox = new THREE.Box3(new THREE.Vector3(-1.8, -1.8, -1.8), new THREE.Vector3(1.8, 1.8, 1.8));
  return g;
}

let leafTex: THREE.Texture | null = null;
/** A clump of small leaves, light grey on transparent, drawn once in code. */
export function leafTexture(): THREE.Texture {
  if (leafTex) return leafTex;
  const S = 48;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const x = cv.getContext('2d')!;
  const rand = makeRand(913);
  // Leaves from the back of the clump to the front: darker behind, lighter in front.
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * S * 0.33;
    const px = S / 2 + Math.cos(a) * d, py = S / 2 + Math.sin(a) * d * 0.9;
    // Near white, so the tree's own colour comes through (it multiplies); a little darker behind.
    const k = Math.min(255, Math.round(212 + (i / 26) * 40 + (rand() - 0.5) * 16));
    x.fillStyle = `rgb(${k},${k},${k})`;
    x.save();
    x.translate(px, py);
    x.rotate(rand() * Math.PI);
    x.beginPath();
    x.ellipse(0, 0, 4.5 + rand() * 2.5, 2.4 + rand() * 1.3, 0, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }
  const t = new THREE.CanvasTexture(cv);
  // Hard texels and no mipmaps: the cut-out edge stays crisp, as the pixel look wants.
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return (leafTex = t);
}

/** The vertex code that turns each card to face the camera (replaces three's project_vertex). */
const BILLBOARD = `
  vec4 mvPosition = vec4(transformed, 1.0);
  float cardScale = 1.0;
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
    cardScale = (length(instanceMatrix[0].xyz) + length(instanceMatrix[1].xyz) + length(instanceMatrix[2].xyz)) / 3.0;
  #endif
  mvPosition = modelViewMatrix * mvPosition;
  {
    float cs = cos(aRot), sn = sin(aRot);
    vec2 rc = vec2(aCorner.x * cs - aCorner.y * sn, aCorner.x * sn + aCorner.y * cs);
    // Leaves fall in winter (uBare): the cards shrink with the crown.
    mvPosition.xy += rc * aSize * cardScale * mix(1.0, 0.25, uBare);
  }
  gl_Position = projectionMatrix * mvPosition;
`;
const ATTRS = 'attribute vec2 aCorner; attribute float aSize; attribute float aRot;';

/** The canopy material for cards: the same look as the blobs (via enhance), cut out by the leaf texture. */
export function leafCardMaterial(opts: EnhanceOptions): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ map: leafTexture(), alphaTest: 0.5 });
  enhance(m, { ...opts, surface: 'none', thin: undefined });
  const inner = m.onBeforeCompile;
  m.onBeforeCompile = (shader, r) => {
    inner.call(m, shader, r); // enhance declares uBare among the world uniforms
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${ATTRS}`)
      .replace('#include <project_vertex>', BILLBOARD);
  };
  const key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `cards-${key()}`;
  return m;
}

let depthMat: THREE.MeshDepthMaterial | null = null;
/** Shadows from the cards, cut out the same way. */
export function leafCardDepth(): THREE.MeshDepthMaterial {
  if (depthMat) return depthMat;
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leafTexture(), alphaTest: 0.5 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uBare = worldUniforms.uBare;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${ATTRS} uniform float uBare;`)
      .replace('#include <project_vertex>', BILLBOARD);
  };
  m.customProgramCacheKey = () => 'leaf-card-depth';
  return (depthMat = m);
}
