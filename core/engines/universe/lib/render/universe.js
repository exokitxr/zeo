const {
  WIDTH,
  HEIGHT,
  NUM_CELLS,

  FOREGROUND_WIDTH,
  FOREGROUND_HEIGHT,
  FOREGROUND_CHUNK_SIZE,
} = require('../constants/universe');

const getBackgroundImageSrc = backgroundImage => {
  const {mapChunks} = backgroundImage;
  const mapChunk = mapChunks[0];

  return `\
    <div style="position: relative; width: ${WIDTH}px; height: ${HEIGHT}px; background-color: #000;">
      <img src="${mapChunk}" width="${NUM_CELLS}" height="${NUM_CELLS}" style="position: absolute; top: 0; left: ${(WIDTH - NUM_CELLS) / 2}px; width: ${NUM_CELLS}px; height: ${NUM_CELLS}px;">
    </div>
  `;
};

const getForegroundImageSrc = foregroundImage => {
  const {mapChunks} = foregroundImage;
  const mapChunk = mapChunks[0];

  return `\
    <div style="position: relative; width: ${FOREGROUND_WIDTH}px; height: ${FOREGROUND_HEIGHT}px;">
      <img src="${mapChunk}" width="${FOREGROUND_CHUNK_SIZE}" height="${FOREGROUND_CHUNK_SIZE}" style="position: absolute; top: 0; left: ${(FOREGROUND_WIDTH - FOREGROUND_CHUNK_SIZE) / 2}px; width: ${FOREGROUND_CHUNK_SIZE}px; height: ${FOREGROUND_CHUNK_SIZE}px;">
    </div>
  `;
};

module.exports = {
  getBackgroundImageSrc,
  getForegroundImageSrc,
};
