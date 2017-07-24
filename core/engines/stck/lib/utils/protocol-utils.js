const BUFFER_SIZE = (1 * 4) + (4 * 4 * 3) + (2 * 4 * 4);

const parseUpdateN = (buffer, byteOffset = 0) => new Uint32Array(buffer, byteOffset, 1)[0];
const parseUpdate = (position, rotation, scale, velocity, buffer, byteOffset = 0) => {
  // const n = parseUpdateN(buffer, byteOffset);
  byteOffset += 1 * 4;

  position.fromArray(new Float32Array(buffer, byteOffset, 3));
  byteOffset += 3 * 4;

  rotation.fromArray(new Float32Array(buffer, byteOffset, 4));
  byteOffset += 4 * 4;

  scale.fromArray(new Float32Array(buffer, byteOffset, 3));
  byteOffset += 3 * 4;

  velocity.fromArray(new Float32Array(buffer, byteOffset, 3));
  // byteOffset += 3* 4;
};
const stringifyUpdate = (n, position, rotation, scale, velocity, buffer, byteOffset) => {
  if (buffer === undefined || byteOffset === undefined) {
    buffer = new ArrayBuffer(BUFFER_SIZE);
    byteOffset = 0;
  }

  new Uint32Array(buffer, byteOffset, 1)[0] = n;
  byteOffset += 1 * 4;

  const positionBuffer = new Float32Array(buffer, byteOffset, 3);
  positionBuffer[0] = position.x;
  positionBuffer[1] = position.y;
  positionBuffer[2] = position.z;
  byteOffset += 3 * 4;

  const rotationBuffer = new Float32Array(buffer, byteOffset, 4);
  rotationBuffer[0] = rotation.x;
  rotationBuffer[1] = rotation.y;
  rotationBuffer[2] = rotation.z;
  rotationBuffer[3] = rotation.w;
  byteOffset += 4 * 4;

  const scaleBuffer = new Float32Array(buffer, byteOffset, 3);
  scaleBuffer[0] = scale.x;
  scaleBuffer[1] = scale.y;
  scaleBuffer[2] = scale.z;
  byteOffset += 3 * 4;

  const velocityBuffer = new Float32Array(buffer, byteOffset, 3);
  velocityBuffer[0] = velocity.x;
  velocityBuffer[1] = velocity.y;
  velocityBuffer[2] = velocity.z;
  // byteOffset += 3 * 4;

  return buffer;
};

module.exports = {
  BUFFER_SIZE,
  parseUpdateN,
  parseUpdate,
  stringifyUpdate,
};
