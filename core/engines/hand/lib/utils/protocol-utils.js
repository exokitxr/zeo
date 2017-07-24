const BUFFER_SIZE = (1 * 4) + (4 * 4 * 3) + (2 * 4 * 4);

const parseUpdateN = (buffer, byteOffset = 0) => new Uint32Array(buffer, byteOffset, 1)[0];
const parseUpdate = (position, rotation, scale, localPosition, localRotation, localScale, buffer, byteOffset = 0) => {
  byteOffset += 4;

  const array = new Float32Array(buffer, byteOffset, 20);
  position.fromArray(array, 0);
  rotation.fromArray(array, 3);
  scale.fromArray(array, 7);
  localPosition.fromArray(array, 10);
  localRotation.fromArray(array, 13);
  localScale.fromArray(array, 17);
};
const stringifyUpdate = (n, position, rotation, scale, localPosition, localRotation, localScale, buffer, byteOffset) => {
  if (buffer === undefined || byteOffset === undefined) {
    buffer = new ArrayBuffer(BUFFER_SIZE);
    byteOffset = 0;
  }

  new Uint32Array(buffer, byteOffset, 1)[0] = n;
  byteOffset += 4;

  const array = new Float32Array(buffer, byteOffset, 20);
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

  array[10] = localPosition.x;
  array[11] = localPosition.y;
  array[12] = localPosition.z;

  array[13] = localRotation.x;
  array[14] = localRotation.y;
  array[15] = localRotation.z;
  array[16] = localRotation.w;

  array[17] = localScale.x;
  array[18] = localScale.y;
  array[19] = localScale.z;

  return buffer;
};

module.exports = {
  BUFFER_SIZE,
  parseUpdateN,
  parseUpdate,
  stringifyUpdate,
};
