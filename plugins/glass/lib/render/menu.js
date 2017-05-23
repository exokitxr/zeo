const {
  WIDTH,
  HEIGHT,
} = require('../constants/constants');

const getHudSrc = ({mode, highlights}) => {
  return `<div style="display: flex; position: relative; width: ${WIDTH}px; height: ${HEIGHT}px; color: #FFF; flex-direction: column;">
    <div style="position: absolute; top: 20px; right: 20px; display: flex; font-family: Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 60px; line-height: 1.4; font-weight: 600; flex-direction: column;">
      <div style="display: flex; padding: 0 10px; border: 2px solid transparent; ${(highlights.indexOf('picture') !== -1) ? 'border-color: #FFF' : ''}; justify-content: center; align-items: center;">
        ${mode === 'picture' ? `\
          <div style="width: 40px; height: 40px; margin-right: 30px; background-color: #FF0000; border-radius: 100px;"></div>
        ` : `\
          <div style="width: 40px; height: 40px; margin-right: 30px;"></div>
        `}
        <div style="margin-right: auto;">Picture</div>
      </div>
      <div style="display: flex; padding: 0 10px; border: 2px solid transparent; ${(highlights.indexOf('audio') !== -1) ? 'border-color: #FFF' : ''}; justify-content: center; align-items: center;">
        ${mode === 'audio' ? `\
          <div style="width: 40px; height: 40px; margin-right: 30px; background-color: #FF0000; border-radius: 100px;"></div>
        ` : `\
          <div style="width: 40px; height: 40px; margin-right: 30px;"></div>
        `}
        <div style="margin-right: auto;">Audio</div>
      </div>
      <div style="display: flex; padding: 0 10px; border: 2px solid transparent; ${(highlights.indexOf('video') !== -1) ? 'border-color: #FFF' : ''}; justify-content: center; align-items: center;">
        ${mode === 'video' ? `\
          <div style="width: 40px; height: 40px; margin-right: 30px; background-color: #FF0000; border-radius: 100px;"></div>
        ` : `\
          <div style="width: 40px; height: 40px; margin-right: 30px;"></div>
        `}
        <div style="margin-right: auto;">Video</div>
      </div>
    </div>
    <div style="position: absolute; top: 0; bottom: 0; left: 0; right: 0; border: 2px solid; border-radius: 30px;"></div>
  </div>`;
};

module.exports = {
  getHudSrc,
};
