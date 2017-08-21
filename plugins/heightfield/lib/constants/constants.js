const NUM_CELLS = 16;
const OVERSCAN = 1;
const NUM_CELLS_OVERSCAN = NUM_CELLS + OVERSCAN;

const NUM_CELLS_HEIGHT = 128;

const HEIGHTFIELD_DEPTH = 8;

const RANGE = 3;

const DEFAULT_SEED = 'a';

const PEEK_FACES = (() => {
  let faceIndex = 0;
  return {
    FRONT: faceIndex++,
    BACK: faceIndex++,
    LEFT: faceIndex++,
    RIGHT: faceIndex++,
    TOP: faceIndex++,
    BOTTOM: faceIndex++,
    NULL: faceIndex++,
  };
})();
const PEEK_FACE_INDICES = (() => {
  let peekIndex = 0;
  const result = new Uint8Array(8 * 8);
  result.fill(0xFF);
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      if (i !== j) {
        const otherEntry = result[j << 4 | i];
        result[i << 4 | j] = otherEntry !== 0xFF ? otherEntry : peekIndex++;
      }
    }
  }
  return result;
})();

module.exports = {
  NUM_CELLS,
  OVERSCAN,
  NUM_CELLS_OVERSCAN,

  NUM_CELLS_HEIGHT,

  HEIGHTFIELD_DEPTH,

  RANGE,

  DEFAULT_SEED,

  PEEK_FACES,
  PEEK_FACE_INDICES,
};
