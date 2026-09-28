/**
 * Placing things from the build menu: a ghost of the footprint that follows
 * the cursor (green where it fits, red where it doesn't, with a marker at the
 * door), and a highlight on a ruin that could be restored.
 */
import * as THREE from 'three';
import { footCenter, doorOf, type Footprint } from '../sim/buildings';
import type { Ruin } from '../sim/oldworld';
import { heightAt, type World } from '../sim/world';

const OK = new THREE.Color('#7ee0a8'), BAD = new THREE.Color('#ff7a6a');

export class PlacementView {
  group = new THREE.Group();
  private box: THREE.Mesh;
  private edge: THREE.LineSegments;
  private door: THREE.Mesh;
  private ruinBox: THREE.Mesh;
  private ruinEdge: THREE.LineSegments;

  constructor(private world: World) {
    this.group.name = 'placement';
    const mat = new THREE.MeshBasicMaterial({ color: OK, transparent: true, opacity: 0.28, depthWrite: false });
    this.box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    this.edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: OK }));
    this.door = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 4), new THREE.MeshBasicMaterial({ color: '#ffe08a' }));
    this.ruinBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: OK, transparent: true, opacity: 0.18, depthWrite: false }));
    this.ruinEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: OK }));
    for (const o of [this.box, this.edge, this.door, this.ruinBox, this.ruinEdge]) { o.renderOrder = 8; o.visible = false; this.group.add(o); }
  }

  hide() { for (const o of this.group.children) o.visible = false; }

  /** A building's footprint at a place, fitting or not. */
  showFoot(foot: Footprint, facing: number, height: number, ok: boolean) {
    const w = this.world;
    const c = footCenter(w, foot);
    const y = heightAt(w, c.x, c.z);
    for (const o of [this.box, this.edge]) {
      o.visible = true;
      o.scale.set(foot.w, height, foot.d);
      o.position.set(c.x, y + height / 2, c.z);
    }
    (this.box.material as THREE.MeshBasicMaterial).color.copy(ok ? OK : BAD);
    (this.edge.material as THREE.LineBasicMaterial).color.copy(ok ? OK : BAD);
    const d = doorOf(w, foot, facing);
    this.door.visible = true;
    this.door.position.set(d.x, heightAt(w, d.x, d.z) + 0.35, d.z);
    // Point the arrow out of the door.
    this.door.rotation.order = 'YXZ';
    this.door.rotation.set(Math.PI / 2, Math.atan2(d.x - c.x, d.z - c.z), 0);
  }

  hideFoot() { this.box.visible = this.edge.visible = this.door.visible = false; }

  /** A ruin under the cursor: green if it can be restored. */
  showRuin(r: Ruin | null, ok: boolean) {
    if (!r) { this.ruinBox.visible = this.ruinEdge.visible = false; return; }
    const y = heightAt(this.world, r.x, r.z);
    for (const o of [this.ruinBox, this.ruinEdge]) {
      o.visible = true;
      o.scale.set(r.w + 0.4, r.h + 0.6, r.d + 0.4);
      o.position.set(r.x, y + (r.h + 0.6) / 2, r.z);
      o.rotation.y = r.yaw;
    }
    (this.ruinBox.material as THREE.MeshBasicMaterial).color.copy(ok ? OK : BAD);
    (this.ruinEdge.material as THREE.LineBasicMaterial).color.copy(ok ? OK : BAD);
  }
}
