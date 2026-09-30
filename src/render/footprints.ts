/**
 * Footprints in the snow (DESIGN §35). People and deer leave prints as they
 * walk, alternating left and right, pressed into a texture over the ground
 * (4 texels a tile). Each texel remembers when it was last trodden; its
 * depth fades with game time, over about a day and a half, faster while
 * fresh snow is falling (it fills them in). The ground's shader lightens the
 * snow in a print and shades it blue-grey (util.ts, the `ground` season).
 *
 * Only the region that has prints in it is recomputed and uploaded.
 */
import * as THREE from 'three';
import type { World } from '../sim/world';

/** Texels per world tile. */
const RES = 4;
/** Distance between one footfall and the next (world units); deer step shorter. */
const STRIDE = 0.42;
/** Game minutes for a print to fade away (clear weather), and while snow is falling. */
const FADE = 1440 * 1.5, FADE_SNOWING = 1440 * 0.35;

interface Walker { x: number; z: number; side: number }

export class Footprints {
  texture: THREE.DataTexture;
  private data: Uint8Array;
  /** Game minute each texel was last trodden (-1: never). */
  private at: Float32Array;
  /** Fade already applied, as elapsed "fade minutes" (so a snowfall speeds the fading of old prints too). */
  private fadeClock = 0;
  private fadeAt: Float32Array;
  private walkers = new Map<string, Walker>();
  private box = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
  private lastMinute = -1;
  private lastUpload = 0;
  private W: number;
  private H: number;

  constructor(private world: World) {
    this.W = world.w * RES; this.H = world.h * RES;
    this.data = new Uint8Array(this.W * this.H);
    this.at = new Float32Array(this.W * this.H).fill(-1);
    this.fadeAt = new Float32Array(this.W * this.H);
    this.texture = new THREE.DataTexture(this.data, this.W, this.H, THREE.RedFormat, THREE.UnsignedByteType);
    this.texture.magFilter = THREE.NearestFilter; // crisp prints, a pixel or two each
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;
  }

  private texel(x: number, z: number): number {
    const u = Math.floor((x + this.world.w / 2) * RES), v = Math.floor((z + this.world.h / 2) * RES);
    if (u < 0 || v < 0 || u >= this.W || v >= this.H) return -1;
    return v * this.W + u;
  }

  private press(x: number, z: number) {
    const i = this.texel(x, z);
    if (i < 0) return;
    this.at[i] = this.lastMinute;
    this.fadeAt[i] = this.fadeClock;
    const u = i % this.W, v = Math.floor(i / this.W);
    const b = this.box;
    b.x0 = Math.min(b.x0, u); b.x1 = Math.max(b.x1, u); b.z0 = Math.min(b.z0, v); b.z1 = Math.max(b.z1, v);
  }

  /**
   * Called every frame. `snow` is the cover (0..1): no prints without snow. `walkers` are everyone on foot
   * outdoors this frame (id, position); `hoofed` steps shorter and in pairs.
   */
  update(minute: number, snow: number, snowing: boolean, walkers: { id: string; x: number; z: number; hoofed?: boolean }[], realNow: number) {
    const dm = this.lastMinute < 0 ? 0 : Math.max(0, minute - this.lastMinute);
    this.lastMinute = minute;
    this.fadeClock += dm * (snowing ? FADE / FADE_SNOWING : 1);
    if (snow > 0.25) {
      for (const w of walkers) {
        const prev = this.walkers.get(w.id);
        if (!prev) { this.walkers.set(w.id, { x: w.x, z: w.z, side: 1 }); continue; }
        const dx = w.x - prev.x, dz = w.z - prev.z, d = Math.hypot(dx, dz);
        const stride = w.hoofed ? STRIDE * 0.8 : STRIDE;
        if (d > 3) { prev.x = w.x; prev.z = w.z; continue; } // teleported (moved, or went indoors)
        if (d < stride) continue;
        const nx = -dz / d, nz = dx / d;
        const off = w.hoofed ? 0.14 : 0.1, fx = dx / d, fz = dz / d;
        const px = w.x + nx * off * prev.side, pz = w.z + nz * off * prev.side;
        // A foot presses heel and toe (two texels along the way it's going); a deer's hoof, one, fore and hind.
        this.press(px, pz);
        if (w.hoofed) this.press(px - fx * 0.5, pz - fz * 0.5);
        else this.press(px + fx * 0.22, pz + fz * 0.22);
        prev.side = -prev.side;
        prev.x = w.x; prev.z = w.z;
      }
    } else {
      for (const w of walkers) this.walkers.set(w.id, { x: w.x, z: w.z, side: 1 });
    }
    // Recompute and upload the trodden region a few times a second.
    if (realNow - this.lastUpload < 0.25 || this.box.x0 === Infinity) return;
    this.lastUpload = realNow;
    const b = this.box;
    let any = false;
    for (let v = b.z0; v <= b.z1; v++) for (let u = b.x0; u <= b.x1; u++) {
      const i = v * this.W + u;
      if (this.at[i] < 0) continue;
      const age = this.fadeClock - this.fadeAt[i];
      const k = 1 - age / FADE;
      if (k <= 0) { this.at[i] = -1; this.data[i] = 0; continue; }
      this.data[i] = Math.round(255 * Math.min(1, k * 1.15));
      any = true;
    }
    if (!any) { b.x0 = Infinity; b.z0 = Infinity; b.x1 = -Infinity; b.z1 = -Infinity; }
    this.texture.needsUpdate = true;
  }
}
