const {
  WIDTH,
  HEIGHT,
} = require('../constants/wallet');

const upImg = require('../img/up');
const downImg = require('../img/down');
const chevronLeftImg = require('../img/chevron-left');

const numTagsPerPage = 6;

const makeRenderer = ({creatureUtils}) => {

const getWalletPageSrc = ({loading, charging, error, inputText, inputValue, asset, assets, numTags, page, focus}) => {
  return `\
    <div style="display: flex; min-height: ${HEIGHT}px;">
      ${!error ?
        (asset === null ?
          getAssetsPageSrc({loading, inputText, inputValue, assets, numTags, page, focus})
        :
          getAssetPageSrc({asset, charging})
        )
      :
        `<div style="display: flex; margin-bottom: 100px; font-size: 30px; align-items: center; justify-content: center; flex-grow: 1; flex-direction: column;">
          <div style="margin-bottom: 20px; font-size: 30px; font-weight: 400;">Connection problem :/</div>
          <a style="padding: 10px 15px; border: 2px solid; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="wallet:refresh">Refresh</a>
        </div>`
      }
    </div>
  `;
};
const getAssetsPageSrc = ({loading, inputText, inputValue, assets, numTags, page, focus}) => {
  const leftSrc = `\
    <div style="display: flex; padding: 30px; flex-grow: 1; flex-direction: column;">
      <div style="display: flex; font-size: 36px; line-height: 1.4; align-items: center;">
        <a style="position: relative; display: block; margin-right: 20px; margin-bottom: 20px; border-bottom: 2px solid; flex-grow: 1; text-decoration: none;" onclick="wallet:focus">
          ${focus ? `<div style="position: absolute; width: 2px; top: 2px; bottom: 2px; left: ${inputValue}px; background-color: #000;"></div>` : ''}
          <div>${inputText}</div>
          ${!inputText ? `<div>Search my assets</div>` : ''}
        </a>
        <a style="padding: 10px 15px; border: 2px solid; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="wallet:manage">Manage account</a>
      </div>
      ${loading ?
        `<div style="display: flex; margin-bottom: 100px; font-size: 30px; font-weight: 400; flex-grow: 1; align-items: center; justify-content: center;">Loading...</div>`
      :
        ((assets.length > 0) ?
          `<div style="display: flex; flex-grow: 1; flex-direction: column;">
            ${assets
              .slice(page * numTagsPerPage, (page + 1) * numTagsPerPage)
              .map(assetSpec => getAssetSrc(assetSpec))
              .join('\n')}
          </div>`
        : `\
          <div style="display: flex; margin-bottom: 100px; font-size: 30px; font-weight: 400; flex-grow: 1; align-items: center; justify-content: center;">No assets :/</div>
        `)
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
const getAssetSrc = assetSpec => {
  const {asset, quantity} = assetSpec;
  const quantityString = _commaizeQuantity(quantity);
  const id = asset; // XXX
  const isStatic = true;
  const isSub = false;
  const tagName = isStatic ? 'a' : 'div';
  const linkTagName = isStatic ? 'div' : 'a';
  const onclick = (() => {
    if (!isSub) {
      return `asset:main:${id}`;
    } else {
      return `asset:bill:${id}:${quantity}`;
    }
  })();

  return `\
    <${tagName} style="position: relative; display: flex; padding-bottom: 20px; border-bottom: 1px solid #EEE; text-decoration: none; overflow: hidden; box-sizing: border-box;" onclick="${onclick}">
      <div style="display: flex; margin-left: -30px; margin-right: -80px; padding-left: 30px; padding-right: 80px; flex-grow: 1; flex-direction: column; box-sizing: border-box;">
        <div style="display: flex; flex-grow: 1;">
          ${creatureUtils.makeSvgCreature('asset:' + asset, {
            width: 12,
            height: 12,
            viewBox: '0 0 12 12',
            style: 'width: 50px; height: 50px; margin: 10px; image-rendering: -moz-crisp-edges; image-rendering: pixelated;',
          })}
          <div style="display: flex; margin-left: 10px; flex-grow: 1; flex-direction: column; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
            <h1 style="margin: 0; margin-top: 10px; margin-bottom: 5px; font-size: 24px; font-weight: 400; line-height: 1.4; text-overflow: ellipsis; overflow: hidden;">${asset}</h1>
            <div style="display: flex; flex-grow: 1; align-items: center;">
              <div style="padding: 0 5px; border: 2px solid; font-size: 20px; font-weight: 400;">¤ ${quantityString}</div>
            </div>
          </div>
        </div>
      </div>
    </${tagName}>
  `;
};
const getAssetPageSrc = ({asset: {asset, quantity}, charging}) => {
  const quantityString = _commaizeQuantity(quantity);
  const linkTagName = !charging ? 'a': 'span';

  return `\
    <div style="display: flex; position: relative; width: ${WIDTH}; height: ${HEIGHT}px;">
      <div style="display: flex; padding: 30px; flex-grow: 1; flex-direction: column;">
        <div style="display: flex; margin-bottom: 20px; align-items: center;">
          <a style="display: flex; width: 80px; height: 80px; justify-content: center; align-items: center;" onclick="wallet:back">${chevronLeftImg}</a>
          ${creatureUtils.makeSvgCreature('asset:' + asset, {
            width: 12,
            height: 12,
            viewBox: '0 0 12 12',
            style: 'width: 50px; height: 50px; margin: 10px; image-rendering: -moz-crisp-edges; image-rendering: pixelated;',
          })}
          <div style="margin-left: 20px; margin-right: auto; font-size: 36px; line-height: 1.4; font-weight: 400;">${asset}</div>
          <div style="padding: 0 10px; border: 2px solid; font-size: 30px; font-weight: 400;">¤ ${quantityString}</div>
        </div>
        ${charging ? `<div style="display: flex; position: absolute; top: 0; bottom: 0; left: 0; right: 0; justify-content: center; align-items: center;">
          <div style="padding: 10px 30px; background-color: #000; color: #FFF; font-size: 30px; font-weight: 400;">Processing...</div>
        </div> ` : ''}
        <div style="display: flex; padding-left: 20px; flex-wrap: wrap; box-sizing: border-box;">
          ${
            [
              1, 2, 5, 10,
              20, 50, 100, 500,
              1000, 5000, 10000, 50000,
              100000, 200000, 500000, 1000000,
            ]
            .filter(billQuantity => billQuantity <= quantity)
            .map(billQuantity => {
              const id = asset; // XXX
              const billQuantityString = _commaizeQuantity(billQuantity);

              return `<${linkTagName} style="display: flex; width: ${(WIDTH - (30 * 2) - 20) / 3}px; padding: 10px; font-size: 30px; font-weight: 400; box-sizing: border-box;" onclick="asset:bill:${id}:${billQuantity}">¤ ${billQuantityString}</${linkTagName}>`;
            })
            .join('\n')
          }
        </div>
      </div>
    </div>
  `;
};
const _commaize = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const _commaizeQuantity = quantity =>
  quantity.toFixed(2)
  .replace(/^([^.]*)(\.?.*)$/, (all, wholes, decimals) => _commaize(wholes) + decimals)
  .replace(/(\..*?)0+$/, '$1')
  .replace(/\.$/, '');

return {
  getWalletPageSrc,
  getAssetsPageSrc,
  getAssetSrc,
  getAssetPageSrc,
};

};

module.exports = {
  makeRenderer,
};
