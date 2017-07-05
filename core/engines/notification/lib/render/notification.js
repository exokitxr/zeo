const {
  WIDTH,
  HEIGHT,
} = require('../constants/notification');

const getHudSrc = text => {
  return `<div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; justify-content: center; align-items: center;">
    <div style="display: flex; margin-top: auto; padding: 10px 20px; font-family: Consolas, 'Liberation Mono', Menlo, Courier, monospace; background-color: #000; color: #FFF; font-size: 30px; font-weight: 600; text-align: center;">${text}</div>
  </div>`;
};

module.exports = {
  getHudSrc,
};
