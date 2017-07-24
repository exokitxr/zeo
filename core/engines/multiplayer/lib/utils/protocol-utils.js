const BUFFER_SIZE = (1 + (10 * 4) + 1) * 4;

const parseUpdateN = (buffer, byteOffset = 0) => new Uint32Array(buffer, byteOffset, 1)[0];
const parseUpdate = (
  hmdPosition,
  hmdRotation,
  hmdScale,
  gamepadLeftPosition,
  gamepadLeftRotation,
  gamepadLeftScale,
  gamepadRightPosition,
  gamepadRightRotation,
  gamepadRightScale,
  menu,
  menuPosition,
  menuRotation,
  menuScale,
  buffer,
  byteOffset = 0
) => {
  byteOffset += 4;

  const array = new Float32Array(buffer, byteOffset, (10 * 4) + 1);
  hmdPosition.fromArray(array, 0);
  hmdRotation.fromArray(array, 3);
  hmdScale.fromArray(array, 7);

  gamepadLeftPosition.fromArray(array, 10);
  gamepadLeftRotation.fromArray(array, 13);
  gamepadLeftScale.fromArray(array, 17);

  gamepadRightPosition.fromArray(array, 20);
  gamepadRightRotation.fromArray(array, 23);
  gamepadRightScale.fromArray(array, 27);

  menu.open = array[30] > 0;

  menuPosition.fromArray(array, 31);
  menuRotation.fromArray(array, 34);
  menuScale.fromArray(array, 38);
};
const stringifyUpdate = (n, status, buffer, byteOffset) => {
  if (buffer === undefined || byteOffset === undefined) {
    buffer = new ArrayBuffer(BUFFER_SIZE);
    byteOffset = 0;
  }

  new Uint32Array(buffer, 0, 1)[0] = n;

  const array = new Float32Array(buffer, 1 * 4, (10 * 4) + 1);
  array[0] = status.hmd.position.x;
  array[1] = status.hmd.position.y;
  array[2] = status.hmd.position.z;

  array[3] = status.hmd.rotation.x;
  array[4] = status.hmd.rotation.y;
  array[5] = status.hmd.rotation.z;
  array[6] = status.hmd.rotation.w;

  array[7] = status.hmd.scale.x;
  array[8] = status.hmd.scale.y;
  array[9] = status.hmd.scale.z;

  array[10] = status.gamepads.left.position.x;
  array[11] = status.gamepads.left.position.y;
  array[12] = status.gamepads.left.position.z;

  array[13] = status.gamepads.left.rotation.x;
  array[14] = status.gamepads.left.rotation.y;
  array[15] = status.gamepads.left.rotation.z;
  array[16] = status.gamepads.left.rotation.w;

  array[17] = status.gamepads.left.scale.x;
  array[18] = status.gamepads.left.scale.y;
  array[19] = status.gamepads.left.scale.z;

  array[20] = status.gamepads.right.position.x;
  array[21] = status.gamepads.right.position.y;
  array[22] = status.gamepads.right.position.z;

  array[23] = status.gamepads.right.rotation.x;
  array[24] = status.gamepads.right.rotation.y;
  array[25] = status.gamepads.right.rotation.z;
  array[26] = status.gamepads.right.rotation.w;

  array[27] = status.gamepads.right.scale.x;
  array[28] = status.gamepads.right.scale.y;
  array[29] = status.gamepads.right.scale.z;

  array[30] = status.metadata.menu.open ? 1 : 0;

  array[31] = status.metadata.menu.position.x;
  array[32] = status.metadata.menu.position.y;
  array[33] = status.metadata.menu.position.z;

  array[34] = status.metadata.menu.rotation.x;
  array[35] = status.metadata.menu.rotation.y;
  array[36] = status.metadata.menu.rotation.z;
  array[37] = status.metadata.menu.rotation.w;

  array[38] = status.metadata.menu.scale.x;
  array[39] = status.metadata.menu.scale.y;
  array[40] = status.metadata.menu.scale.z;

  return buffer;
};

module.exports = {
  BUFFER_SIZE,
  parseUpdateN,
  parseUpdate,
  stringifyUpdate,
};
