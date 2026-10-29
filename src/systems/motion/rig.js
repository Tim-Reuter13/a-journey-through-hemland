import * as THREE from 'three';

// HUMANITY MOTION · rig adapter. Every humanoid in Hemland is a Blockbench box rig: rigid parts on
// bones (no SkinnedMesh, no fingers, no toes, no twist bones; the face is three UV-swapped quads).
// The motion layers never use those bone names directly: they ask for logical bones through this
// map, so another rig only needs another map. Missing bones are reported, never faked.
export const HUMANOID = {
  Root: 'root', Hips: 'hips', Spine: 'torso', Chest: 'chest', Neck: 'neck', Head: 'head',
  LeftShoulder: null, RightShoulder: null,
  LeftUpperArm: 'arm_upper_left', RightUpperArm: 'arm_upper_right',
  LeftForeArm: 'arm_lower_left', RightForeArm: 'arm_lower_right',
  LeftHand: 'hand_left', RightHand: 'hand_right', LeftGrip: 'grip_left', RightGrip: 'grip_right',
  LeftUpperLeg: 'leg_upper_left', RightUpperLeg: 'leg_upper_right',
  LeftLowerLeg: 'leg_lower_left', RightLowerLeg: 'leg_lower_right',
  LeftFoot: 'foot_left', RightFoot: 'foot_right',
  LeftToes: null, RightToes: null,
};
export const REQUIRED = ['Root', 'Hips', 'Spine', 'Chest', 'Neck', 'Head', 'LeftUpperArm', 'RightUpperArm', 'LeftForeArm', 'RightForeArm',
  'LeftHand', 'RightHand', 'LeftUpperLeg', 'RightUpperLeg', 'LeftLowerLeg', 'RightLowerLeg', 'LeftFoot', 'RightFoot'];
// Height of the ankle pivot above the sole, in rig units (16 px = 1): the foot pivot sits 2 px up.
export const ANKLE = 2 / 16;

const _v = new THREE.Vector3();

/** What a character's rig offers. Reads `character.userData.rig` live: restyling rebuilds the rig. */
export function rigAdapter(character, map = HUMANOID) {
  const bone = name => (map[name] && character.userData.rig?.[map[name]]) || null;
  const missing = () => REQUIRED.filter(name => !bone(name));
  // Segment lengths from the rest pose (child pivot offset), in the rig's own units.
  const rest = name => bone(name)?.userData.rest?.position.length() ?? 0;
  const lengths = () => ({ thigh: rest('LeftLowerLeg'), shin: rest('LeftFoot'), upperArm: rest('LeftForeArm'), foreArm: rest('LeftHand'), ankle: ANKLE });
  return {
    bone, missing, lengths,
    get ok() { return missing().length === 0; },
    capabilities: { skinned: false, fingers: false, toes: false, twist: false, shoulders: false, face: 'uv-frames', clips: false, rootMotion: false },
    /** World scale along Y of a bone's frame (root scale × body build). */
    scale(name = 'Hips') { const b = bone(name); return b ? b.parent.getWorldScale(_v).y : 1; },
  };
}
