const {
  WIDTH,
  HEIGHT,
} = require('../constants/constants');

const hmdImgBlack = require('../img/hmd-black');
const hmdImgBlackSrc = 'data:image/svg+xml;base64,' + btoa(hmdImgBlack);
const controllerImgBlack = require('../img/controller-black');
const controllerImgBlackSrc = 'data:image/svg+xml;base64,' + btoa(controllerImgBlack);
const hmdImgWhite = require('../img/hmd-white');
const hmdImgWhiteSrc = 'data:image/svg+xml;base64,' + btoa(hmdImgWhite);
const controllerImgWhite = require('../img/controller-white');
const controllerImgWhiteSrc = 'data:image/svg+xml;base64,' + btoa(controllerImgWhite);

const getToolMenuSrc = ({tool: {mode}}) => {
  return `
    <div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT}px;">
      <div style="display: flex; flex: 1; ${mode === 'hmd' ? 'background-color: #2196F3;' : ''} justify-content: center; align-items: center;">
        <img src="${mode === 'hmd' ? hmdImgWhiteSrc : hmdImgBlackSrc}" width="${HEIGHT * 0.75}" height="${HEIGHT * 0.75}" />
      </div>
      <div style="display: flex; flex: 1; ${mode === 'controller' ? 'background-color: #2196F3;' : ''} justify-content: center; align-items: center;">
        <img src="${mode === 'controller' ? controllerImgWhiteSrc : controllerImgBlackSrc}" width="${HEIGHT * 0.75}" height="${HEIGHT * 0.75}" />
      </div>
    </div>
  `;
};

module.exports = {
  getToolMenuSrc,
};
