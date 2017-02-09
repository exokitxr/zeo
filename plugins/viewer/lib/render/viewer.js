const {
  WIDTH,
  HEIGHT,
  SLOT_WIDTH,
  SLOT_HEIGHT,
} = require('../constants/viewer');

const getMediaSrc = ({mode, type, data, loading, paused}) => {
  if (!loading) {
    if (mode === 'image') {
      return window.base64 = `\
        <div style="width: ${WIDTH}px; height: ${HEIGHT}px; background-color: #000; color: #FFF;">
          <img src="data:${type};base64,${_arrayBufferToBase64(data)}" width="100%" height="auto" style="max-height: 100%; max-width: 100%;">
        </div>
      `;
    } else if (mode === 'audio') {
      const mainSrc = (() => {
        if (!paused) {
          return `\
            <a onclick="media:pause">
              <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 79.374997 79.374985">
                <path d="M13.23 0v79.375h18.52V0H13.23M47.625 0v79.375h18.52V0z"/>
              </svg>
            </a>
          `;
        } else {
          return `\
            <a onclick="media:play">
              <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 79.374997 79.374985">
                <path d="M21.167 79.375l39.687-39.687L21.167 0v79.375"/>
              </svg>
            </a>
          `;
        }
      })();
      const barSrc = `\
        <div>
          <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 79.374999 79.374999" style="${WIDTH}px;">
            <path d="M34.396 79.375H44.98V0H34.395z" fill="#f44336"/>
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg" width="1000" height="300" viewBox="0 0 264.58333 79.374999" style="position: absolute;">
            <path d="M0 44.98h264.583V34.395H0z" fill="#ccc"/>
          </svg>
        </div>
      `;

      return mainSrc + barSrc;
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
