const NUM_CELLS = 16;
const OVERSCAN = 1;
const NUM_CELLS_OVERSCAN = NUM_CELLS + OVERSCAN;

const NUM_CELLS_HEIGHT = 128;
const NUM_CHUNKS_HEIGHT = NUM_CELLS_HEIGHT / NUM_CELLS;

const NUM_RENDER_GROUPS = NUM_CHUNKS_HEIGHT / 2;

const HEIGHTFIELD_DEPTH = 8;

const RANGE = 11;

const TEXTURE_SIZE = 1024;

const DEFAULT_SEED = 'a';

const NUM_POSITIONS_CHUNK = 1 * 1024 * 1024;

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
        const otherEntry = result[j << 3 | i];
        result[i << 3 | j] = otherEntry !== 0xFF ? otherEntry : peekIndex++;
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
  NUM_CHUNKS_HEIGHT,

  NUM_RENDER_GROUPS,

  HEIGHTFIELD_DEPTH,

  RANGE,

  TEXTURE_SIZE,

  DEFAULT_SEED,

  NUM_POSITIONS_CHUNK,

  PEEK_FACES,
  PEEK_FACE_INDICES,
};
