const {
  WIDTH,
  HEIGHT,
  SLOT_WIDTH,
  SLOT_HEIGHT,
} = require('../constants/viewer');

const getMediaSrc = ({mode, type, data, loading}) => {
  if (!loading) {
    if (mode === 'image') {
      return window.base64 = `\
        <div style="width: ${WIDTH}px; height: ${HEIGHT}px; background-color: #000; color: #FFF;">
          <img src="data:${type};base64,${_arrayBufferToBase64(data)}" width="100%" height="auto" style="max-height: 100%; max-width: 100%;">
        </div>
      `;
    } else {
      return `\
        <div style="width: ${WIDTH}px; height: ${HEIGHT}px; background-color: #000; color: #FFF;">
          <div style="display: flex; width: 100%; height: 100%; justify-content: center; align-items: center; font-size: 100px;">No media</div>
        </div>
      `;
    }
  } else {
    return `\
      <div style="width: ${WIDTH}px; height: ${HEIGHT}px; background-color: #000; color: #FFF;">
        <div style="display: flex; width: 100%; height: 100%; justify-content: center; align-items: center; font-size: 100px;">Loading...</div>
      </div>
    `;
  }
};

const getSlotPlaceholderSrc = () => `\
  <div style="width: ${SLOT_WIDTH}px; height: ${SLOT_HEIGHT}px; background-color: rgba(255, 255, 255, 0.5);">
    <div style="display: flex; width: 100%; height: 100%; justify-content: center; align-items: center; font-size: 40px;">Insert file</div>
  </div>
`;


const _arrayBufferToBase64 = buffer => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

module.exports = {
  getMediaSrc,
  getSlotPlaceholderSrc,
};
