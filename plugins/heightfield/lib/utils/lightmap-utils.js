const {
  NUM_CELLS_OVERSCAN,
} = require('../constants/constants');

const _getStaticHeightfieldIndex = (x, z) => x + (z * NUM_CELLS_OVERSCAN);

const lightmapUtils = {
  render: (x, y, z, staticHeightfield) => Math.min(Math.max(
    (y - (staticHeightfield[_getStaticHeightfieldIndex(Math.floor(x), Math.floor(z))] - 8)) / 8
  , 0), 1) * 255,
};

module.exports = lightmapUtils;
