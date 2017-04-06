const {
  WIDTH,
  HEIGHT,
} = require('../constants/constants');

const checkImg = require('../img/check');
const checkImgsrc = 'data:image/svg+xml;base64,' + btoa(checkImg);

const getAvatarSrc = ({avatar: {text, textIndex}}) => {
  const textSlice = text.slice(0, textIndex);
  const done = textIndex >= text.length;
  const notchSize = 50;

  return `
    <div style="display: flex; position: relative; width: ${WIDTH}px; height: ${HEIGHT}px; flex-direction: column;">
      <div style="position: relative; margin-bottom: ${notchSize}px; padding: 30px; background-color: #FFF; font-size: 30px; font-weight: 400; flex-grow: 1;">
        <div>${textSlice}</div>
        ${done ?
          `<a style="display: flex; position: absolute; bottom: 0; right: 0; width: 100px; height: 100px; justify-content: center; align-items: center;" onclick="avatar:next">
            <img src="${checkImgsrc}" width="50" height="50" />
          </a>`
        :
          ''
        }
      </div>
      <div style="position: absolute; left: 50%; bottom: 0; margin-left: ${-notchSize}px; border-width: 0 ${notchSize}px ${notchSize}px 0; border-style: solid; border-color: transparent #FFF transparent transparent;"></div>
    </div>
  `;
};

module.exports = {
  getAvatarSrc,
};
