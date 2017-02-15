const playBlackImg = require('../img/play-black');
const playBlackImgSrc = 'data:image/svg+xml;base64,' + btoa(playBlackImg);
const playWhiteImg = require('../img/play-white');
const playWhiteImgSrc = 'data:image/svg+xml;base64,' + btoa(playWhiteImg);

const getFileSrc = ({id, name, instancing, open}) => {
  const headerSrc = `\
    <div style="position: relative; display: flex; width: 400px; height: 150px; background-color: #F0F0F0; text-decoration: none; overflow: hidden; ${instancing ? 'filter: brightness(75%);' : ''}">
      <div style="display: flex; position: absolute; top: -15px; right: -58px; width: 155px; padding-top: 30px; padding-bottom: 10px; background-color: #E91E63; color: #FFF; justify-content: center; align-items: center; box-sizing: border-box; transform: rotate(45deg);">File</div>
      <div style="width: 100px; height: 100px; margin: 0 10px;"></div>
      <div style="width: 190px; margin-right: 10px;">
        <div style="height: 100px;">
          <h1 style="margin: 0; margin-top: 10px; font-size: 28px; font-weight: 400; line-height: 1.4;">${name}</h1>
          <p style="margin: 0; font-size: 15px; line-height: 1.4;">File in /</p>
        </div>
      </div>
      ${!open ?
        `<a style="display: flex; width: 80px; justify-content: center; align-items: center;" onclick="file:open:${id}">
          <img src="${playBlackImgSrc}" width="50" height="50">
        </a>`
      :
        `<a style="display: flex; width: 80px; background-color: #000; justify-content: center; align-items: center;" onclick="file:close:${id}">
          <img src="${playWhiteImgSrc}" width="50" height="50">
        </a>`
      }
    </div>
  `;
  const bodySrc = open ? `\
    <div style="position: relative; width: 400px; height: 400px; background-color: #000; overflow: hidden;"></div>
  ` : '';
  
  return `\
    <div>
      ${headerSrc}
      ${bodySrc}
    </div>
  `;
};

module.exports = {
  getFileSrc,
};
