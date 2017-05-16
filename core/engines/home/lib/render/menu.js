const {
  WIDTH,
  HEIGHT,
} = require('../constants/menu');

const chevronLeftImg = require('../img/chevron-left');
const chevronLeftImgSrc = 'data:image/svg+xml;base64,' + btoa(chevronLeftImg);
const playImg = require('../img/play');
const playImgSrc = 'data:image/svg+xml;base64,' + btoa(playImg);

const getHomeSrc = () => `\
  <div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; flex-direction: column;">
    <div style="display: flex; padding: 0 50px; justify-content: center; align-items: center; flex-direction: column; flex-grow: 1;">
      <div style="display: flex; width: 100%; height: 100px; margin-top: auto; justify-content: center; align-items: center;">
        <a style="display: flex; margin-left: auto; padding: 10px 15px; border: 2px solid; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="home:done">Finish tutorial</a>
      </div>
    </div>
  </div>
`;

const getMediaPlaySrc = ({paused}) => {
  const buttonSrc = (() => {
    if (paused) {
      return `\
        <a style="display: flex; width: 100%; height: ${HEIGHT - 200}px; justify-content: center; align-items: center;" onclick="media:play">
          <img src="${playImgSrc}" width="200" height="200">
        </a>
      `;
    } else  {
      return `\
        <a style="display: flex; width: 100%; height: ${HEIGHT - 200}px; justify-content: center; align-items: center;" onclick="media:pause">
          <div></div>
        </a>
      `;
    }
  })();

  return `<div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT - 200}px; flex-direction: column; box-sizing: border-box;">
    ${buttonSrc}
  </div>`;
};

const getMediaBarSrc = ({value}) => {
  const barSrc = `\
    <a style="display: flex; width: 100%; height: 100px;" onclick="media:seek">
      <svg xmlns="http://www.w3.org/2000/svg" width="1" height="16" viewBox="0 0 0.26458333 4.2333333" style="position: absolute; height: 100px; width: ${100 * (1 / 16)}px; margin-left: ${-(100 * (1 / 16) / 2)}px; left: ${value * 100}%;">
        <path d="M0 0v4.233h.265V0H0" fill="#f44336"/>
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 8.4666666 8.4666666" preserveAspectRatio="none" style="width: ${WIDTH}px; height: 100px;">
        <path d="M0 3.97v.528h8.467v-.53H0" fill="#ccc"/>
      </svg>
    </a>
  `;

  return `<div style="display: flex; width: ${WIDTH}px; height: 100px; flex-direction: column; box-sizing: border-box;">
    ${barSrc}
  </div>`;
};

module.exports = {
  getHomeSrc,
  getMediaPlaySrc,
  getMediaBarSrc,
};
