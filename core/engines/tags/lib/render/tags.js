const barsImg = require('../img/bars');
const barsImgSrc = 'data:image/svg+xml;base64,' + btoa(barsImg);

const getTagSrc = ({id, displayName, description, version, instancing, open}) => {
  const headerSrc = `\
    <div style="display: flex; width: 400px; height: 150px; background-color: #F0F0F0; text-decoration: none; ${instancing ? 'filter: brightness(75%);' : ''}">
      <div style="display: flex; position: absolute; top: -15px; right: -58px; width: 155px; padding-top: 30px; padding-bottom: 10px; background-color: #2196F3; color: #FFF; justify-content: center; align-items: center; box-sizing: border-box; transform: rotate(45deg);">Mod</div>
      <div style="width: 100px; height: 100px; margin: 0 10px;"></div>
      <div style="width: 190px; margin-right: 10px;">
        <div style="height: 100px;">
          <h1 style="margin: 0; margin-top: 10px; font-size: 28px; font-weight: 400; line-height: 1.4;">${displayName}</h1>
          <p style="margin: 0; font-size: 15px; line-height: 1.4;">${description}</p>
        </div>
      </div>
      ${!open ?
        `<a style="display: flex; width: 80px; justify-content: center; align-items: center;" onclick="tag:open:${id}">
          <img src="${barsImgSrc}" width="50" height="50">
        </a>`
      :
        `<a style="display: flex; width: 80px; background-color: #E8E8E8; justify-content: center; align-items: center;" onclick="tag:close:${id}">
          <img src="${barsImgSrc}" width="50" height="50">
        </a>`
      }
    </div>
  `;
  const bodySrc = open ? `\
    <div style="width: 400px; height: 450px;">lol</div>
  ` : '';
  
  return `\
    <div>
      ${headerSrc}
      ${bodySrc}
    </div>
  `;
};

module.exports = {
  getTagSrc,
};
