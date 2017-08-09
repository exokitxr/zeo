const {
  WIDTH,
  HEIGHT,
} = require('../constants/constants');

const getHudSrc = ({hp, totalHp}) => {
  return `<div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; color: #FFF; flex-direction: column;">
    <div style="display: flex; font-family: Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 60px; line-height: 1.4; font-weight: 600;">
      <div style="margin-right: auto;">HP</div>
      <div>${hp}/${totalHp}</div>
    </div>
    <div style="position: relative; display: flex; height: 30px; width: 100%; background-color: #FFF;">
      <div style="position: absolute; left: 0; height: 100%; width: ${(hp / totalHp) * 100}%; background-color: #4CAF50;"></div>
    </div>
  </div>`;
};

module.exports = {
  getHudSrc,
};
