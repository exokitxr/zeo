const {
  WIDTH,
  HEIGHT,
} = require('../constants/wallet');

const upImg = require('../img/up');
const downImg = require('../img/down');
const chevronLeftImg = require('../img/chevron-left');

const numTagsPerPage = 6 * 4;

const makeRenderer = ({creatureUtils}) => {

const getWalletPageSrc = ({loading, error, inputText, inputValue, asset, assets, equipments, numTags, page, focus}) => {
  return `\
    <div style="display: flex; min-height: ${HEIGHT}px;">
      ${!error ?
        getAssetsPageSrc({loading, inputText, inputValue, asset, assets, equipments, numTags, page, focus})
      :
        `<div style="display: flex; margin-bottom: 100px; font-size: 30px; align-items: center; justify-content: center; flex-grow: 1; flex-direction: column;">
          <div style="margin-bottom: 20px; font-size: 30px; font-weight: 400;">Connection problem :/</div>
          <a style="padding: 10px 15px; border: 2px solid; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="wallet:refresh">Refresh</a>
        </div>`
      }
    </div>
  `;
};
const getAssetsPageSrc = ({loading, inputText, inputValue, asset, assets, equipments, numTags, page, focus}) => {
  const leftSrc = `\
    <div style="display: flex; padding: 30px; flex-grow: 1; flex-direction: column;">
      <div style="display: flex; font-size: 36px; line-height: 1.4; align-items: center;">
        <a style="position: relative; display: block; margin-right: 20px; margin-bottom: 20px; border-bottom: 2px solid; flex-grow: 1; text-decoration: none;" onclick="wallet:focus">
          ${focus ? `<div style="position: absolute; width: 2px; top: 2px; bottom: 2px; left: ${inputValue}px; background-color: #000;"></div>` : ''}
          <div style="font-family: 'Lucida Console', Monaco, monospace; font-size: 30px; line-height: ${36 * 1.4}px;" measure="wallet:search">${inputText.replace(/ /g, '&nbsp;')}</div>
          ${!inputText ? `<div>Search my assets</div>` : ''}
        </a>
      </div>
      ${loading ?
        `<div style="display: flex; margin-bottom: 100px; font-size: 30px; font-weight: 400; flex-grow: 1; align-items: center; justify-content: center;">Loading...</div>`
      :
        `<div style="display: flex;">
          <div style="display: flex; width: ${(100 + 10) * 6}px; flex-wrap: wrap;">
            ${assets
              .slice(page * numTagsPerPage, (page + 1) * numTagsPerPage)
              .map(assetSpec => {
                const focused = assetSpec.asset === asset;
                const equippable = focused && !equipments.some(equipmentSpec => equipmentSpec.asset === asset);
                return getAssetSrc(assetSpec, {focused, clickable: true, equippable, equipPlaceholder: true});
              })
              .join('\n')}
          </div>
          <div style="display: flex; flex-direction: column">
            ${equipments
              .map(equipmentSpec => getAssetSrc(equipmentSpec, {unequippable: equipmentSpec.asset !== null}))
              .join('\n')}
          </div>
        </div>`
      }
    </div>
  `;
  const rightSrc = (() => {
    const showUp = page !== 0;
    const showDown = (() => {
      const numPages = Math.ceil(numTags / (4 * 6));
      return page < (numPages - 1);
    })();

    return `\
      <div style="display: flex; width: 250px; min-height: ${HEIGHT}px; padding-top: 20px; flex-direction: column; box-sizing: border-box;">
        <div style="width: 1px; height: 100px;"></div>
        <a style="position: relative; display: flex; margin: 0 30px; margin-bottom: auto; border: 2px solid; border-radius: 5px; text-decoration: none; justify-content: center; align-items: center; ${showUp ? '' : 'visibility: hidden;'}" onclick="wallet:up">
          ${upImg}
        </a>
        <a style="position: relative; display: flex; margin: 0 30px; border: 2px solid; border-radius: 5px; text-decoration: none; justify-content: center; align-items: center; ${showDown ? '' : 'visibility: hidden;'}" onclick="wallet:down">
          ${downImg}
        </a>
        <div style="width: 1px; height: 50px;"></div>
      </div>
    `;
  })();

  return `\
    <div style="display: flex; flex-grow: 1;">
      ${leftSrc}
      ${rightSrc}
    </div>
  `;
};
const getAssetSrc = (assetSpec, {focused = false, clickable = false, equippable = false, unequippable = false, equipPlaceholder = false} = {}) => {
  const {id, asset, quantity} = assetSpec;

  const equipButtonSrc = (() => {
    if (equippable) {
       return `<a style="display: flex; width: 100px; height: 30px; margin-top: 10px; border: 2px solid; font-weight: 600; justify-content: center; align-items: center; box-sizing: border-box;" onclick="asset:equip:${id}">Equip</a>`;
    } else if (unequippable) {
      return `<a style="position: absolute; top: 36px; right: -40px; display: flex; width: 100px; height: 30px; border: 2px solid; font-weight: 600; justify-content: center; align-items: center; transform: rotateZ(90deg); box-sizing: border-box;" onclick="asset:unequip:${id}">Un-equip</a>`;
    } else if (equipPlaceholder) {
      return `<div style="width: 100%; height: 30px; margin-top: 10px;"></div>`;
    } else {
      return '';
    }
  })();

  if (asset !== null) {
    const linkTagName = clickable ? 'a' : 'div';

    return `\
      <div style="position: relative; display: flex; margin-right: 10px; margin-bottom: 10px; flex-direction: column;">
        <${linkTagName} style="display: flex; width: 100px; height: 100px; padding: 10px; ${focused ? 'background-color: #000; color: #FFF;' : 'background-color: #EEE;'} font-size 10px; font-weight: 600; flex-direction: column; box-sizing: border-box;" onclick="asset:main:${id}">
          <div style="display: flex; flex-grow: 1; justify-content: center; align-items: center;">
            ${creatureUtils.makeSvgCreature('asset:' + asset, {
              width: 12,
              height: 12,
              viewBox: '0 0 12 12',
              style: 'width: 50px; height: 50px; image-rendering: -moz-crisp-edges; image-rendering: pixelated;',
            })}
          </div>
          <div style="display: flex; width: 100%; align-items: center; font-size: 10px; font-weight: 600;">
            <div style="margin-right: auto; word-break: break-all;">${asset}</div>
            ${quantity > 0 ? `<div>${quantity}</div>` : ''}
          </div>
        </${linkTagName}>
        ${equipButtonSrc}
      </div>
    `;
  } else {
    return `\
      <div style="position: relative; display: flex; margin-bottom: 10px; padding-right: 40px; flex-direction: column;">
        <div style="display: flex; width: 100px; height: 100px; border: 2px solid; color: #AAA; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box;">
          <div style="font-size: 14px; font-weight: 600;">Empty</div>
        </div>
        ${equipButtonSrc}
      </div>
    `;
  }
};

return {
  getWalletPageSrc,
  getAssetsPageSrc,
  getAssetSrc,
};

};

module.exports = {
  makeRenderer,
};
