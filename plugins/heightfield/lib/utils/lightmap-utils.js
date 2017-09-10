const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,
  NUM_CELLS_HEIGHT,
} = require('../constants/constants');

const _getStaticHeightfieldIndex = (x, z) => x + (z * NUM_CELLS_OVERSCAN);
const _getLightIndex = (x, y, z) => x + y * NUM_CELLS_OVERSCAN + z * NUM_CELLS_OVERSCAN * (NUM_CELLS_HEIGHT + 1);

const lightmapUtils = {
  renderSkyVoxel: (x, y, z, staticHeightfield) => Math.min(Math.max(
    (y - (staticHeightfield[_getStaticHeightfieldIndex(Math.min(Math.floor(x), NUM_CELLS), Math.min(Math.floor(z), NUM_CELLS))] - 8)) / 8
  , 0), 1) * 255,
  renderTorchVoxel: (x, y, z, lights) => Math.min(Math.max(
    lights[_getLightIndex(Math.min(Math.floor(x), NUM_CELLS), Math.min(Math.floor(y), NUM_CELLS_HEIGHT), Math.min(Math.floor(z), NUM_CELLS))] / 15
  , 0), 1) * 255,
};

module.exports = lightmapUtils;
