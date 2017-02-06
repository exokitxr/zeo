const {
  WIDTH,
  HEIGHT,
  SLOT_WIDTH,
  SLOT_HEIGHT,
} = require('../constants/viewer');

const getMediaSrc = media => `\
  <div style="width: ${WIDTH}px; height: ${HEIGHT}px; background-color: #000; color: #FFF;">
    <div style="display: flex; width: 100%; height: 100%; justify-content: center; align-items: center; font-size: 100px;">No media</div>
  </div>
`;

const getSlotPlaceholderSrc = () => `\
  <div style="width: ${SLOT_WIDTH}px; height: ${SLOT_HEIGHT}px; background-color: rgba(255, 255, 255, 0.5);">
    <div style="display: flex; width: 100%; height: 100%; justify-content: center; align-items: center; font-size: 40px;">Insert file</div>
  </div>
`;

module.exports = {
  getMediaSrc,
  getSlotPlaceholderSrc,
};
