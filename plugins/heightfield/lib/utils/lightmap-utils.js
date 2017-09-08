const {
  NUM_CELLS,
  NUM_CELLS_OVERSCAN,
  NUM_CELLS_HEIGHT,
} = require('../constants/constants');

const _getStaticHeightfieldIndex = (x, z) => x + (z * NUM_CELLS_OVERSCAN);
const _getLightIndex = (x, y, z) => x + y * NUM_CELLS + z * NUM_CELLS * NUM_CELLS_HEIGHT;

const lightmapUtils = {
  renderSkyVoxel: (x, y, z, staticHeightfield) => Math.min(Math.max(
    (y - (staticHeightfield[_getStaticHeightfieldIndex(Math.floor(x), Math.floor(z))] - 8)) / 8
  , 0), 1) * 255,
  renderTorchVoxel: (x, y, z, lights) => Math.min(Math.max(
    lights[_getLightIndex(Math.floor(x), Math.floor(y), Math.floor(z))] / 16
  , 0), 1) * 255,
};

module.exports = lightmapUtils;
