const playImg = require('../img/play');
const playImgSrc = 'data:image/svg+xml;base64,' + btoa(playImg);

const getFileSrc = ({name, instancing}) => `\
  <div style="display: flex; width: 400px; height: 150px; background-color: #F0F0F0; text-decoration: none; ${instancing ? 'filter: brightness(75%);' : ''}">
    <div style="display: flex; position: absolute; top: -15px; right: -58px; width: 155px; padding-top: 30px; padding-bottom: 10px; background-color: #E91E63; color: #FFF; justify-content: center; align-items: center; box-sizing: border-box; transform: rotate(45deg);">File</div>
    <div style="width: 100px; height: 100px; margin: 0 10px;"></div>
    <div style="width: 190px; margin-right: 10px;">
      <div style="height: 100px;">
        <h1 style="margin: 0; margin-top: 10px; font-size: 28px; line-height: 1.4;">${name}</h1>
        <p style="margin: 0; font-size: 15px; line-height: 1.4;">File in /</p>
      </div>
    </div>
    <div style="display: flex; width: 80px; justify-content: center; align-items: center;">
      <img src="${playImgSrc}" width="50" height="50">
    </div>
  </div>
`;

module.exports = {
  getFileSrc,
};
