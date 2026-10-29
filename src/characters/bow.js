import * as THREE from 'three';
import { heldItem } from './models.js';

// The hunting bow as it is held (art/blockbench/models.js › weapons › bow): the limbs bend with the
// draw, the string runs from nock to nock through the drawing hand, and a nocked arrow lies on the
// rest. Shared by the third-person body and the first-person view; string and arrow live in `scene`
// world space so they can meet a hand that belongs to another hierarchy.
const NOCK = 13.93 / 16, BRACE = 3.56 / 16, REST = 2.9 / 16;
// Draw length at full draw, in the bow's own units (an arrow is 20.6 px long).
export const BOW_DRAW = 1.1;
const Y = new THREE.Vector3(0, 1, 0), FORWARD = new THREE.Vector3(0, 0, -1);
let stringMaterial = null;

export function createHeldBow(scene, { thickness = .028, arrowScale = 1 } = {}) {
  const bow = heldItem('bow');
  if (!bow) return null;
  // Lit like the bow, so it does not glow at night.
  stringMaterial ??= new THREE.MeshLambertMaterial({ color: 0xcfc6ae, emissive: 0x161410 });
  const upper = bow.getObjectByName('bow_upper'), lower = bow.getObjectByName('bow_lower');
  const strands = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), stringMaterial); m.name = 'Bow string'; m.frustumCulled = false; scene.add(m); return m; });
  const arrow = heldItem('arrow');
  if (arrow) { arrow.name = 'Nocked arrow'; arrow.scale.multiplyScalar(arrowScale); scene.add(arrow); arrow.visible = false; }
  const top = new THREE.Vector3(), bottom = new THREE.Vector3(), pull = new THREE.Vector3(), rest = new THREE.Vector3(), dir = new THREE.Vector3();
  const span = (mesh, a, b) => {
    dir.subVectors(b, a); const length = dir.length();
    mesh.position.addVectors(a, b).multiplyScalar(.5);
    mesh.scale.set(thickness, Math.max(1e-3, length), thickness);
    if (length > 1e-6) mesh.quaternion.setFromUnitVectors(Y, dir.divideScalar(length));
  };
  return {
    bow,
    /** draw 0..1 bends the limbs; `hand` (world point or null) is where the string is held; `nocked` shows the arrow. */
    update(draw, hand, nocked) {
      upper.rotation.x = draw * .24; lower.rotation.x = -draw * .24;
      bow.updateMatrixWorld(true);
      upper.localToWorld(top.set(0, NOCK, BRACE)); lower.localToWorld(bottom.set(0, -NOCK, BRACE));
      bow.localToWorld(rest.set(-.1, REST, -.05));
      if (hand) pull.copy(hand); else pull.addVectors(top, bottom).multiplyScalar(.5);
      const visible = bow.visible && !!bow.parent;
      span(strands[0], top, pull); span(strands[1], pull, bottom);
      strands.forEach(s => { s.visible = visible; });
      if (arrow) {
        arrow.visible = visible && nocked;
        if (arrow.visible) { arrow.position.copy(pull); arrow.quaternion.setFromUnitVectors(FORWARD, dir.subVectors(rest, pull).normalize()); }
      }
    },
    /** Where the string sits at a draw (0 = braced, 1 = full) for a bow aimed along `aim`. */
    pullPoint(out, draw, aim) {
      bow.updateMatrixWorld(true);
      const scale = bow.getWorldScale(dir).x;
      return bow.localToWorld(out.set(0, REST, BRACE)).addScaledVector(aim, -draw * BOW_DRAW * scale);
    },
    setVisible(on) { bow.visible = on; if (!on) { strands.forEach(s => { s.visible = false; }); if (arrow) arrow.visible = false; } },
    dispose() { bow.removeFromParent(); strands.forEach(s => { s.removeFromParent(); s.geometry.dispose(); }); arrow?.removeFromParent(); },
  };
}

const _basis = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _q = new THREE.Quaternion(), _p = new THREE.Quaternion();
/** Turns `object` (front −Z, up +Y) so its front points along `aim`, its top canted by `cant` radians. */
export function aimObject(object, aim, cant = 0) {
  _z.copy(aim).negate().normalize();
  _y.set(0, 1, 0).addScaledVector(_z, -_z.y).normalize();
  if (cant) _y.applyAxisAngle(_z, cant);
  _x.crossVectors(_y, _z).normalize();
  _basis.makeBasis(_x, _y, _z);
  _q.setFromRotationMatrix(_basis);
  object.parent.getWorldQuaternion(_p).invert();
  object.quaternion.copy(_p.multiply(_q));
}
