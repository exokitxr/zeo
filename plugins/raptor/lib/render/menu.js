const {
  WIDTH,
  HEIGHT,
} = require('../constants/constants');

const getAvatarSrc = ({avatar: {text, textIndex}}) => {
  const textSlice = text.slice(0, textIndex);
  const notchSize = 50;

  return `
    <div style="display: flex; position: relative; width: ${WIDTH}px; height: ${HEIGHT}px; flex-direction: column;">
      <div style="margin-bottom: ${notchSize}px; padding: 30px; background-color: #FFF; font-size: 30px; font-weight: 400; flex-grow: 1;">${textSlice}</div>
      <div style="position: absolute; left: 50%; bottom: 0; margin-left: ${-notchSize}px; border-width: 0 ${notchSize}px ${notchSize}px 0; border-style: solid; border-color: transparent #FFF transparent transparent;"></div>
    </div>
  `;
};

module.exports = {
  getAvatarSrc,
};
