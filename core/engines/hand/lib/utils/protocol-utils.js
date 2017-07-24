const BUFFER_SIZE = (1 * 4) + (4 * 4 * 3) + (2 * 4 * 4);

const parseUpdate = buffer => {
  let byteOffset = 0;

  const n = new Uint32Array(buffer, byteOffset, 1)[0];
  byteOffset += 1 * 4;

  const position = Array.from(new Float32Array(buffer, byteOffset, 3));
  byteOffset += 3 * 4;

  const rotation = Array.from(new Float32Array(buffer, byteOffset, 4));
  byteOffset += 4 * 4;

  const scale = Array.from(new Float32Array(buffer, byteOffset, 3));
  byteOffset += 3* 4;

  const localPosition = Array.from(new Float32Array(buffer, byteOffset, 3));
  byteOffset += 3 * 4;

  const localRotation = Array.from(new Float32Array(buffer, byteOffset, 4));
  byteOffset += 4 * 4;

  const localScale = Array.from(new Float32Array(buffer, byteOffset, 3));
  byteOffset += 3* 4;

  return {
    n,
    position,
    rotation,
    scale,
    localPosition,
    localRotation,
    localScale,
  };
};
const stringifyUpdate = (n, position, rotation, scale, localPosition, localRotation, localScale, buffer, byteOffset) => {
  if (buffer === undefined || byteOffset === undefined) {
    buffer = new ArrayBuffer(BUFFER_SIZE);
    byteOffset = 0;
  }

  new Uint32Array(buffer, byteOffset, 1)[0] = n;
  byteOffset += 1 * 4;

  const positionBuffer = new Float32Array(buffer, byteOffset, 3);
  positionBuffer[0] = position[0];
  positionBuffer[1] = position[1];
  positionBuffer[2] = position[2];
  byteOffset += 3 * 4;

  const rotationBuffer = new Float32Array(buffer, byteOffset, 4);
  rotationBuffer[0] = position[0];
  rotationBuffer[1] = position[1];
  rotationBuffer[2] = rotation[2];
  rotationBuffer[3] = rotation[3];
  byteOffset += 4 * 4;

  const scaleBuffer = new Float32Array(buffer, byteOffset, 3);
  scaleBuffer[0] = scale[0];
  scaleBuffer[1] = scale[1];
  scaleBuffer[2] = scale[2];
  byteOffset += 3* 4;

  const localPositionBuffer = new Float32Array(buffer, byteOffset, 3);
  localPositionBuffer[0] = localPosition[0];
  localPositionBuffer[1] = localPosition[1];
  localPositionBuffer[2] = localPosition[2];
  byteOffset += 3 * 4;

  const localRotationBuffer = new Float32Array(buffer, byteOffset, 4);
  localRotationBuffer[0] = localRotation[0];
  localRotationBuffer[1] = localRotation[1];
  localRotationBuffer[2] = localRotation[2];
  localRotationBuffer[3] = localRotation[3];
  byteOffset += 4 * 4;

  const localScaleBuffer = new Float32Array(buffer, byteOffset, 3);
  localScaleBuffer[0] = localScale[0];
  localScaleBuffer[1] = localScale[1];
  localScaleBuffer[2] = localScale[2];
  byteOffset += 3* 4;

  return buffer;
};

module.exports = {
  BUFFER_SIZE,
  parseUpdate,
  stringifyUpdate,
};
