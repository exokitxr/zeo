const {
  WIDTH,
  HEIGHT,

  NUM_CELLS,
} = require('../constants/universe');

const getMapImageSrc = mapImage => {
  const {mapChunks} = mapImage;
  const mapChunk = mapChunks[0];

  return `\
    <div style="position: relative; width: ${WIDTH}px; height: ${HEIGHT}px; background-color: #000;">
      <img src="${mapChunk}" width="${NUM_CELLS}" height="${NUM_CELLS}" style="position: absolute; top: 0; left: ${(WIDTH - NUM_CELLS) / 2}px; width: ${NUM_CELLS}px; height: ${NUM_CELLS}px;">
    </div>
  `;
};

module.exports = {
  getMapImageSrc,
};
