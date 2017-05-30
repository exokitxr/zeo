const {
  WIDTH,
  HEIGHT,
} = require('../constants/constants');

const closeImg = require('../img/close');
const closeImgSrc = 'data:image/svg+xml;base64,' + btoa(closeImg);

const getShapeCloseSrc = ({meshId}) => `\
  <a style="display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; background-color: #FFF; justify-content: center; align-items: center;" onclick="buildShape:close:${meshId}">
    <img src="${closeImgSrc}" width="50" height="50" />
  </div>
`;

module.exports = {
  getShapeCloseSrc,
};
