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
 *
 * Pines (the 'cone' tiers) get the same treatment with needle sprigs set over
 * each tier's cone; grass tufts become upright cards of a few blades, which
 * turn only about the vertical so the blades stay rooted and sway in the wind.
 */
import * as THREE from 'three';
import { THIN_VERT, enhance, makeRand, worldUniforms, type EnhanceOptions } from './util';

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

/**
 * One pine tier: a slightly slimmer solid cone (so the tier keeps its shape)
 * with drooping bough cards hung round its skirt and a few over its slope,
 * all one geometry for one material. The cone samples a solid patch in the
 * texture's corner and has no card offset, so it draws like the plain cone.
 */
export function needleCardGeometry(cone: THREE.BufferGeometry): THREE.BufferGeometry {
  const rand = makeRand(5813);
  const pos: number[] = [], nor: number[] = [], corner: number[] = [], size: number[] = [], rot: number[] = [], uv: number[] = [], index: number[] = [];
  // The cone, drawn in a little so the boughs make the outer edge.
  const cp = cone.attributes.position, cn = cone.attributes.normal;
  for (let i = 0; i < cp.count; i++) {
    const y = cp.getY(i);
    pos.push(cp.getX(i) * 0.84, y, cp.getZ(i) * 0.84);
    nor.push(cn.getX(i), cn.getY(i), cn.getZ(i));
    corner.push(0, 0); size.push(0); rot.push(0); uv.push(SOLID_UV, 1 - SOLID_UV);
  }
  if (cone.index) for (let i = 0; i < cone.index.count; i++) index.push(cone.index.getX(i));
  else for (let i = 0; i < cp.count; i++) index.push(i);
  const add = (x: number, y: number, z: number, n: THREE.Vector3, s: number, r: number) => {
    const base = pos.length / 3;
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      pos.push(x, y, z); nor.push(n.x, n.y, n.z); corner.push(cx, cy); size.push(s); rot.push(r); uv.push((cx + 1) / 2, (cy + 1) / 2);
    }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const n = new THREE.Vector3();
  // The skirt: boughs all the way round, hanging just below the rim.
  const RIM = 16;
  for (let i = 0; i < RIM; i++) {
    const a = (i / RIM) * Math.PI * 2 + rand() * 0.25;
    const rad = 0.78 + rand() * 0.14;
    n.set(Math.cos(a), 0.45, Math.sin(a)).normalize();
    add(Math.cos(a) * rad, -0.42 + rand() * 0.08, Math.sin(a) * rad, n, 0.2 + rand() * 0.06, (rand() - 0.5) * 0.35);
  }
  // A few up the slope, so the tier's face is broken too.
  for (let i = 0; i < 7; i++) {
    const t = 0.25 + rand() * 0.5;
    const y = -0.5 + t;
    const a = rand() * Math.PI * 2;
    const rad = (0.5 - y) * 0.84;
    n.set(Math.cos(a), 0.6, Math.sin(a)).normalize();
    add(Math.cos(a) * rad, y, Math.sin(a) * rad, n, 0.14 + 0.08 * (1 - t), (rand() - 0.5) * 0.35);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aCorner', new THREE.Float32BufferAttribute(corner, 2));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  g.setAttribute('aRot', new THREE.Float32BufferAttribute(rot, 1));
  g.setIndex(index);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.5);
  g.boundingBox = new THREE.Box3(new THREE.Vector3(-1.5, -1.5, -1.5), new THREE.Vector3(1.5, 1.5, 1.5));
  return g;
}
/** Where in the needle texture the solid patch is (for the cone body). */
const SOLID_UV = 2 / 48;

/**
 * One grass card: an upright quad rooted at the origin, one unit tall in the
 * instance's own space (so the tuft's height, the wind and the wear on paths
 * all work as they did on the blade), its width added facing the camera.
 */
export function grassCardGeometry(height: number, halfWidth: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const pos: number[] = [], corner: number[] = [], uv: number[] = [];
  for (const [cx, cy] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) {
    pos.push(0, cy * height, 0); corner.push(cx, cy); uv.push((cx + 1) / 2, cy);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // Lit like the turf it grows from.
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aCorner', new THREE.Float32BufferAttribute(corner, 2));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute([halfWidth, halfWidth, halfWidth, halfWidth], 1));
  g.setAttribute('aRot', new THREE.Float32BufferAttribute([0, 0, 0, 0], 1));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, height / 2, 0), height + halfWidth);
  return g;
}

export type CardKind = 'leaf' | 'needle' | 'grass' | 'shoot' | 'stalk' | 'ear';
/** Upright kinds: rooted at the ground, turning only about the vertical (grass and crops). */
const UPRIGHT_KINDS = new Set<CardKind>(['grass', 'shoot', 'stalk', 'ear']);

const texCache = new Map<CardKind, THREE.Texture>();
/** The card's picture, light grey on transparent, drawn once in code (the instance colour tints it). */
export function cardTexture(kind: CardKind): THREE.Texture {
  const hit = texCache.get(kind);
  if (hit) return hit;
  const S = kind === 'leaf' || kind === 'needle' ? 48 : 32;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const x = cv.getContext('2d')!;
  const grey = (k: number) => { const v = Math.max(0, Math.min(255, Math.round(k))); return `rgb(${v},${v},${v})`; };
  if (kind === 'leaf') {
    const rand = makeRand(913);
    // Leaves from the back of the clump to the front: darker behind, lighter in front.
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * S * 0.33;
      const px = S / 2 + Math.cos(a) * d, py = S / 2 + Math.sin(a) * d * 0.9;
      // Near white, so the tree's own colour comes through (it multiplies); a little darker behind.
      x.fillStyle = grey(212 + (i / 26) * 40 + (rand() - 0.5) * 16);
      x.save();
      x.translate(px, py);
      x.rotate(rand() * Math.PI);
      x.beginPath();
      x.ellipse(0, 0, 4.5 + rand() * 2.5, 2.4 + rand() * 1.3, 0, 0, Math.PI * 2);
      x.fill();
      x.restore();
    }
  } else if (kind === 'needle') {
    const rand = makeRand(377);
    // A solid patch in the corner for the cone body (SOLID_UV).
    x.fillStyle = grey(222);
    x.fillRect(0, 0, 4, 4);
    // A drooping bough seen side-on: narrow where it leaves the tier, spreading
    // and sagging outward, with a toothed lower edge (canvas y runs down).
    // Chunky on purpose: thin needles turn to noise at pixel size.
    const g = x.createLinearGradient(0, S * 0.2, 0, S * 0.9);
    g.addColorStop(0, grey(250));
    g.addColorStop(1, grey(200));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(S * 0.5, S * 0.18);
    x.quadraticCurveTo(S * 0.86, S * 0.3, S * 0.95, S * 0.62);
    const teeth = 6;
    for (let i = 0; i <= teeth * 2; i++) {
      const t = i / (teeth * 2);
      const px = S * (0.95 - t * 0.9);
      // Deep points at the ends (the bough sags), shallower in the middle.
      const sag = 0.1 * Math.cos((t - 0.5) * Math.PI) ;
      const py = i % 2 === 0 ? S * (0.86 - sag + (rand() - 0.5) * 0.04) : S * (0.66 - sag * 0.5);
      x.lineTo(px, py);
    }
    x.quadraticCurveTo(S * 0.14, S * 0.3, S * 0.5, S * 0.18);
    x.fill();
  } else if (kind === 'shoot' || kind === 'stalk' || kind === 'ear') {
    // Crops (DESIGN §42.3), canvas bottom = the ground, drawn chunky for the pixel look.
    const rand = makeRand(kind === 'shoot' ? 61 : kind === 'stalk' ? 62 : 63);
    const blade = (rootX: number, tipX: number, tipY: number, w: number, lo: number, hi: number) => {
      const gr = x.createLinearGradient(0, S, 0, tipY);
      gr.addColorStop(0, grey(lo));
      gr.addColorStop(1, grey(hi));
      x.fillStyle = gr;
      x.beginPath();
      x.moveTo(rootX - w, S);
      x.quadraticCurveTo(rootX - w * 0.4, (S + tipY) / 2, tipX, tipY);
      x.quadraticCurveTo(rootX + w * 0.4, (S + tipY) / 2, rootX + w, S);
      x.closePath();
      x.fill();
    };
    if (kind === 'shoot') {
      // Two or three little plants: short leaves splayed from a point.
      for (const cx of [S * 0.25, S * 0.55, S * 0.82]) for (let k = 0; k < 4; k++) {
        const a = (k / 3 - 0.5) * 1.6 + (rand() - 0.5) * 0.3;
        blade(cx, cx + Math.sin(a) * S * 0.2, S * (0.45 + rand() * 0.2) + Math.abs(Math.sin(a)) * S * 0.15, 1.8, 180, 245);
      }
    } else {
      // Stalks with long arching leaves; ripe ones carry an ear at the top.
      const stalks = 5;
      for (let b = 0; b < stalks; b++) {
        const rx = S * (0.14 + (b / (stalks - 1)) * 0.72) + (rand() - 0.5) * 2;
        const top = S * (0.12 + rand() * 0.14);
        const lean = (rand() - 0.5) * 4;
        x.strokeStyle = grey(kind === 'ear' ? 225 : 222);
        x.lineWidth = 2.2;
        x.beginPath(); x.moveTo(rx, S); x.lineTo(rx + lean, top); x.stroke();
        // Leaves off the stalk, alternating sides.
        for (let l = 0; l < 2; l++) {
          const ly = S * (0.55 + l * 0.18), side = (b + l) % 2 ? 1 : -1;
          x.fillStyle = grey(kind === 'ear' ? 212 : 232 + l * 10);
          x.beginPath();
          x.moveTo(rx + lean * (1 - ly / S), ly);
          x.quadraticCurveTo(rx + side * S * 0.16, ly - S * 0.12, rx + side * S * 0.2, ly + S * 0.02);
          x.quadraticCurveTo(rx + side * S * 0.08, ly - S * 0.02, rx + lean * (1 - ly / S), ly + 2);
          x.fill();
        }
        if (kind === 'ear') {
          // The ear: a fat grain head, nodding a little.
          x.fillStyle = grey(250);
          x.save();
          x.translate(rx + lean, top + 3);
          x.rotate(lean * 0.06 + (rand() - 0.5) * 0.3);
          x.beginPath();
          x.ellipse(0, 0, 2.2, 5, 0, 0, Math.PI * 2);
          x.fill();
          x.restore();
        }
      }
    }
  } else {
    const rand = makeRand(4242);
    // A few blades fanning up from the root (canvas bottom), darker at the root.
    const blades = 5;
    for (let b = 0; b < blades; b++) {
      const rootX = S / 2 + (b - (blades - 1) / 2) * 2.2;
      const tipX = S / 2 + (b - (blades - 1) / 2) * (4 + rand() * 3) + (rand() - 0.5) * 4;
      const tipY = S * (0.05 + rand() * 0.35);
      const w = 1.6 + rand() * 1.2;
      const gr = x.createLinearGradient(0, S, 0, tipY);
      gr.addColorStop(0, grey(190));
      gr.addColorStop(1, grey(250));
      x.fillStyle = gr;
      x.beginPath();
      x.moveTo(rootX - w, S);
      x.quadraticCurveTo(rootX - w * 0.5, (S + tipY) / 2, tipX, tipY);
      x.quadraticCurveTo(rootX + w * 0.5, (S + tipY) / 2, rootX + w, S);
      x.closePath();
      x.fill();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  // Hard texels and no mipmaps: the cut-out edge stays crisp, as the pixel look wants.
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(kind, t);
  return t;
}
/** The leaf picture (kept for callers of the first prototype). */
export const leafTexture = () => cardTexture('leaf');

/** The vertex code that turns each card to face the camera (replaces three's project_vertex). */
const BILLBOARD = `
  vec4 mvPosition = vec4(transformed, 1.0);
  float cardScale = 1.0;
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
    cardScale = CARD_SCALE;
  #endif
  mvPosition = modelViewMatrix * mvPosition;
  {
    float cs = cos(aRot), sn = sin(aRot);
    vec2 rc = vec2(aCorner.x * cs - aCorner.y * sn, aCorner.x * sn + aCorner.y * cs);
    // Leaves fall in winter (uBare): the cards shrink with the crown.
    mvPosition.xy += rc * aSize * cardScale * CARD_BARE;
  }
  gl_Position = projectionMatrix * mvPosition;
`;
/** Upright cards (grass): the height is already in the geometry; only the width faces the camera. */
const UPRIGHT = `
  vec4 mvPosition = vec4(transformed, 1.0);
  float cardScale = 1.0;
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
    cardScale = length(instanceMatrix[0].xyz);
  #endif
  mvPosition = modelViewMatrix * mvPosition;
  mvPosition.x += aCorner.x * aSize * cardScale;
  gl_Position = projectionMatrix * mvPosition;
`;
const ATTRS = 'attribute vec2 aCorner; attribute float aSize; attribute float aRot;';
const BARE: Record<CardKind, string> = { leaf: 'mix(1.0, 0.25, uBare)', needle: '1.0', grass: '1.0', shoot: '1.0', stalk: '1.0', ear: '1.0' };
/** Card size follows the clump's mean scale; a pine tier's follows its radius (its height is stretched separately). */
const SCALE: Record<CardKind, string> = {
  leaf: '(length(instanceMatrix[0].xyz) + length(instanceMatrix[1].xyz) + length(instanceMatrix[2].xyz)) / 3.0',
  needle: '(length(instanceMatrix[0].xyz) + length(instanceMatrix[2].xyz)) * 0.5',
  grass: '1.0', shoot: '1.0', stalk: '1.0', ear: '1.0',
};
const vertexFor = (kind: CardKind) => (UPRIGHT_KINDS.has(kind) ? UPRIGHT : BILLBOARD).replace('CARD_BARE', BARE[kind]).replace('CARD_SCALE', SCALE[kind]);

/** The material for one kind of card: the same look as the solid shape (via enhance), cut out by the picture. */
export function cardMaterial(opts: EnhanceOptions, kind: CardKind): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ map: cardTexture(kind), alphaTest: 0.5 });
  // three.js draws shadows from back faces unless told otherwise, and a card has
  // only a front (it faces whatever is looking: here, the sun), so without this
  // the cards cast no shadow at all.
  m.shadowSide = THREE.DoubleSide;
  // Keeps opts.thin: on the Folk's Wild (see-through woods) the cards are cut away
  // like the solid shapes were, and the tree's ghost twin shows instead.
  enhance(m, { ...opts, surface: 'none' });
  const inner = m.onBeforeCompile;
  m.onBeforeCompile = (shader, r) => {
    inner.call(m, shader, r); // enhance declares uBare among the world uniforms
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${ATTRS}`)
      .replace('#include <project_vertex>', vertexFor(kind));
  };
  const key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `cards-${kind}-${key()}`;
  return m;
}
export const leafCardMaterial = (opts: EnhanceOptions) => cardMaterial(opts, 'leaf');

/**
 * In the shadow pass, cards are pushed this far (in clump radii) away from the
 * sun: the clump still shades the ground and what is below it, but its outer
 * cards don't blacken its inner ones (which made crowns mottled and dark).
 */
const PUSH: Record<CardKind, number> = { leaf: 0.55, needle: 0.3, grass: 0, shoot: 0, stalk: 0, ear: 0 };
const depthCache = new Map<CardKind, THREE.MeshDepthMaterial>();
/** Shadows from the cards, cut out the same way. */
export function cardDepth(kind: CardKind): THREE.MeshDepthMaterial {
  const hit = depthCache.get(kind);
  if (hit) return hit;
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: cardTexture(kind), alphaTest: 0.5 });
  // Trees ghosted on the Wild cast no shadow (as with thinDepth in util.ts); grass and crops are never ghosted.
  const ghostable = kind === 'leaf' || kind === 'needle';
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uBare: worldUniforms.uBare, uZoneTex: worldUniforms.uZoneTex, uThin: worldUniforms.uThin, uFogSize: worldUniforms.uFogSize });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${ATTRS} uniform float uBare;${ghostable ? `\nuniform sampler2D uZoneTex; uniform float uThin; uniform float uFogSize; varying float vThin;\n${THIN_VERT}` : ''}`)
      .replace('#include <project_vertex>', vertexFor(kind).replace('gl_Position', `mvPosition.z -= ${PUSH[kind].toFixed(2)} * cardScale;\n  gl_Position`)
        + (ghostable ? `
  #ifdef USE_INSTANCING
    vThin = thinAt(vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]));
  #else
    vThin = 0.0;
  #endif` : ''));
    if (ghostable) shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vThin;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  if (vThin > 0.5) discard;');
  };
  m.customProgramCacheKey = () => `card-depth-${kind}`;
  depthCache.set(kind, m);
  return m;
}
export const leafCardDepth = () => cardDepth('leaf');
