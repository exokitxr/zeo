const {
  WIDTH,
  HEIGHT,
} = require('../constants/notification');

const getHudSrc = text => {
  return `<div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; color: #FFF; justify-content: center; align-items: center;">
    <div style="display: flex; margin-top: auto; font-family: Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 30px; font-weight: 600; text-align: right;">${text}</div>
  </div>`;
};

module.exports = {
  getHudSrc,
};
