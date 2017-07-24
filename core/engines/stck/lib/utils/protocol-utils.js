const BUFFER_SIZE = (1 * 4) + (4 * 4 * 3) + (2 * 4 * 4);

const parseUpdateN = (buffer, byteOffset = 0) => new Uint32Array(buffer, byteOffset, 1)[0];
const parseUpdate = (position, rotation, scale, velocity, buffer, byteOffset = 0) => {
  byteOffset += 4;

  const array = new Float32Array(buffer, byteOffset, 10 + 3);
  position.fromArray(array, 0);
  rotation.fromArray(array, 3);
  scale.fromArray(array, 7);
  velocity.fromArray(array, 10);
};
const stringifyUpdate = (n, position, rotation, scale, velocity, buffer, byteOffset) => {
  if (buffer === undefined || byteOffset === undefined) {
    buffer = new ArrayBuffer(BUFFER_SIZE);
    byteOffset = 0;
  }

  new Uint32Array(buffer, byteOffset, 1)[0] = n;
  byteOffset += 4;

  const array = new Float32Array(buffer, byteOffset, 10 + 3);
  array[0] = position.x;
  array[1] = position.y;
  array[2] = position.z;

  array[3] = rotation.x;
  array[4] = rotation.y;
  array[5] = rotation.z;
  array[6] = rotation.w;

  array[7] = scale.x;
  array[8] = scale.y;
  array[9] = scale.z;

  array[10] = velocity.x;
  array[11] = velocity.y;
  array[12] = velocity.z;

  return buffer;
};

module.exports = {
  BUFFER_SIZE,
  parseUpdateN,
  parseUpdate,
  stringifyUpdate,
};
