const BUFFER_SIZE = (1 * 4) + (4 * 4 * 3) + (2 * 4 * 4);
let type = 0;
const TYPE_UPDATE = type++;
const TYPE_COLLIDE = type++;
const TYPE_RESPONSE = type++;

const parseType = (buffer, byteOffset = 0) => new Uint32Array(buffer, byteOffset, 1)[0];
const parseN = (buffer, byteOffset = 0) => new Int32Array(buffer, byteOffset + 4, 1)[0];
const parseUpdate = (position, rotation, scale, velocity, buffer, byteOffset = 0) => {
  byteOffset += 4 * 2;

  const array = new Float32Array(buffer, byteOffset, 10 + 3);
  position.fromArray(array, 0);
  rotation.fromArray(array, 3);
  scale.fromArray(array, 7);
  velocity.fromArray(array, 10);
};
const parseResponse = (teleportPosition, buffer, byteOffset) => new Float32Array(buffer, byteOffset + 4 * 2, 1)[0] ?
  teleportPosition.fromArray(new Float32Array(buffer, byteOffset + 4 * 3, 3))
:
  null;


const stringifyUpdate = (n, position, rotation, scale, velocity, buffer, byteOffset) => {
  if (buffer === undefined || byteOffset === undefined) {
    buffer = new ArrayBuffer(BUFFER_SIZE);
    byteOffset = 0;
  }

  new Uint32Array(buffer, byteOffset, 1)[0] = TYPE_UPDATE;
  byteOffset += 4;
  new Int32Array(buffer, byteOffset, 1)[0] = n;
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
const stringifyCollide = (n, buffer, byteOffset) => {
  if (buffer === undefined || byteOffset === undefined) {
    buffer = new ArrayBuffer(BUFFER_SIZE);
    byteOffset = 0;
  }

  new Uint32Array(buffer, byteOffset, 1)[0] = TYPE_COLLIDE;
  byteOffset += 4;
  new Int32Array(buffer, byteOffset, 1)[0] = n;
  byteOffset += 4;

  return buffer;
};
const stringifyResponse = (id, targetPosition, buffer, byteOffset) => {
  if (buffer === undefined || byteOffset === undefined) {
    buffer = new ArrayBuffer(BUFFER_SIZE);
    byteOffset = 0;
  }

  new Uint32Array(buffer, byteOffset, 1)[0] = TYPE_RESPONSE;
  byteOffset += 4;
  new Int32Array(buffer, byteOffset, 1)[0] = id;
  byteOffset += 4;
  if (targetPosition) {
    new Uint32Array(buffer, byteOffset, 1)[0] = 1;
    byteOffset += 4;
    const targetPositionArray = new Float32Array(buffer, byteOffset, 3);
    targetPositionArray[0] = targetPosition.x;
    targetPositionArray[1] = targetPosition.y;
    targetPositionArray[2] = targetPosition.z;
    byteOffset += 4 * 3;
  } else {
    new Uint32Array(buffer, byteOffset, 1)[0] = 0;
    byteOffset += 4;
  }

  return buffer;
};

module.exports = {
  BUFFER_SIZE,
  TYPE_UPDATE,
  TYPE_COLLIDE,
  TYPE_RESPONSE,
  parseN,
  parseType,
  parseUpdate,
  parseResponse,
  stringifyUpdate,
  stringifyCollide,
  stringifyResponse,
};
