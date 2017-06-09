const {
  WIDTH,
  HEIGHT,
} = require('../constants/wallet');

const upImg = require('../img/up');
const downImg = require('../img/down');
const chevronLeftImg = require('../img/chevron-left');

const CREDIT_ASSET_NAME = 'CRD';
const numTagsPerPage = 6;

const makeRenderer = ({creatureUtils}) => {

const getWalletPageSrc = ({loading, error, inputText, inputValue, asset, assets, numTags, page, focus}) => {
  return `\
    <div style="display: flex; min-height: ${HEIGHT}px;">
      ${loading ?
        `<div style="display: flex; margin-bottom: 100px; font-size: 30px; font-weight: 400; flex-grow: 1; align-items: center; justify-content: center;">Loading...</div>`
      :
        !error ?
          (asset === null ?
            getAssetsPageSrc({inputText, inputValue, assets, numTags, page, focus})
          :
            getAssetPageSrc(asset)
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
const getAssetsPageSrc = ({inputText, inputValue, assets, numTags, page, focus}) => {
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
      <div style="display: flex; flex-grow: 1; flex-direction: column;">
        ${assets
          .slice(page * numTagsPerPage, (page + 1) * numTagsPerPage)
          .map(assetSpec => getAssetSrc(assetSpec))
          .join('\n')}
      </div>
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
  const normalizedAssetName = _normalizeAssetName(asset);
  const quantityString = _commaizeAssetQuantity(asset, quantity);
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
          <img src="${creatureUtils.makeStaticCreature('asset:' + asset)}" width="50" height="50" style="margin: 10px; image-rendering: -moz-crisp-edges; image-rendering: pixelated;" />
          <div style="display: flex; flex-grow: 1; flex-direction: column; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
            <h1 style="margin: 0; margin-top: 10px; margin-bottom: 5px; font-size: 24px; font-weight: 400; line-height: 1.4; text-overflow: ellipsis; overflow: hidden;">${normalizedAssetName}</h1>
            <div style="display: flex; flex-grow: 1; align-items: center;">
              <div style="padding: 0 5px; border: 2px solid; font-size: 20px; font-weight: 400;">&#164; ${quantityString}</div>
            </div>
          </div>
        </div>
      </div>
    </${tagName}>
  `;
};
const getAssetPageSrc = ({asset, quantity}) => {
  const normalizedAssetName = _normalizeAssetName(asset);
  const quantityString = _commaizeAssetQuantity(asset, quantity);

  return `\
    <div style="display: flex; width: ${WIDTH}; min-height: ${HEIGHT}px;">
      <div style="display: flex; padding: 30px; flex-grow: 1; flex-direction: column;">
        <div style="display: flex; margin-bottom: 20px; align-items: center;">
          <a style="display: flex; width: 80px; height: 80px; justify-content: center; align-items: center;" onclick="wallet:back">${chevronLeftImg}</a>
          <img src="${creatureUtils.makeStaticCreature('asset:' + asset)}" width="50" height="50" style="margin: 10px; image-rendering: -moz-crisp-edges; image-rendering: pixelated;" />
          <div style="margin-right: auto; font-size: 36px; line-height: 1.4; font-weight: 400;">${normalizedAssetName}</div>
          <div style="padding: 0 10px; border: 2px solid; font-size: 30px; font-weight: 400;">&#164; ${quantityString}</div>
        </div>
        <div style="display: flex; padding-left: 20px; flex-wrap: wrap; box-sizing: border-box;">
          ${
            [
              1, 5, 10, 25,
              100, 200, 500, 1000,
              2000, 5000, 10000, 20000,
              50000, 100000, 200000, 500000,
              1000000, 2000000, 5000000, 10000000,
            ]
            .map(asset === 'BTC' ? (billQuantity => billQuantity / 1e2) : (billQuantity => billQuantity))
            .map(billQuantity => {
              const id = asset; // XXX
              const billQuantityString = _commaizeAssetQuantity(asset, billQuantity);

              return `<a style="display: flex; width: ${(WIDTH - (30 * 2) - 20) / 3}px; padding: 10px; font-size: 30px; font-weight: 400; box-sizing: border-box;" onclick="asset:bill:${id}:${billQuantity}">&#164; ${billQuantityString}</a>`;
            })
            .join('\n')
          }
        </div>
      </div>
    </div>
  `;
};
const _normalizeAssetName = name => name === 'BTC' ? CREDIT_ASSET_NAME : name;
const _commaize = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const _commaizeAssetQuantity = (asset, quantity) => {
  if (asset === 'BTC') {
    return quantity.toFixed(8).replace(/(\..*?)0+$/, '$1').replace(/\.$/, '');
  } else {
    return _commaize(quantity);
  }
};

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
