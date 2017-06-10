const {
  WIDTH,
  HEIGHT,
} = require('../constants/payment');

const closeOutlineImg = require('../img/close-outline');
const closeOutlineImgSrc = 'data:image/svg+xml;base64,' + btoa(closeOutlineImg);
const checkImg = require('../img/check');
const checkImgSrc = 'data:image/svg+xml;base64,' + btoa(checkImg);

const CREDIT_ASSET_NAME = 'CRD';

const makeRenderer = ({creatureUtils}) => {

const getPayPageSrc = ({id, address, asset, quantity, loading, hasAvailableBalance, paying, done}) => {
  const normalizedAssetName = _normalizeAssetName(asset);
  const quantityString = _commaizeAssetQuantity(asset, quantity);

  return `\
    <div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; padding: 25px 0; padding-bottom: 10px; flex-direction: column; box-sizing: border-box;">
      <div style="display: flex; position: relative; height: 120px; margin-top: -25px; margin-bottom: 20px; padding-left: 50px; background-color: #000; color: #FFF; font-size: 60px; font-weight: 400; align-items: center; box-sizing: border-box;">
        <div>Confirm payment</div>
        <a style="display: flex; position: absolute; top: 0; right: 0; width: 120px; height: 120px; justify-content: center; align-items: center;" onclick="payment:pay:cancel:${id}">
          <img src="${closeOutlineImgSrc}" width="50" height="50">
        </a>
      </div>
      ${!loading ? `\
        ${!done ? `\
          <div style="display: flex; padding-left: 50px; flex-direction: column; flex-grow: 1; box-sizing: border-box;">
            <div style="display: flex; margin-bottom: 50px; font-size: 30px; font-weight: 400; flex-grow: 1; align-items: center;">
              <span>Pay</span>
              ${_getAssetSrc(asset, quantity)}
              <span>to <span style="font-family: Consolas, 'Liberation Mono', Menlo, Courier, monospace;">${address}</span>?</span>
            </div>
            ${hasAvailableBalance ? `\
              <div style="display: flex; margin-bottom: 20px; font-size: 30px; font-weight: 400;">
                ${!paying ? `\
                    <a style="display: flex; margin-right: 30px; padding: 10px 20px; border: 3px solid; color: #4CAF50; justify-content: center; align-items: center; box-sizing: border-box;" onclick="payment:pay:confirm:${id}">Confirm</a>
                    <a style="display: flex; margin-right: 30px; padding: 10px 20px; border: 3px solid; color: #F44336; justify-content: center; align-items: center; box-sizing: border-box;" onclick="payment:pay:cancel:${id}">Reject</a>
                ` : `\
                  <div style="display: flex; margin-right: 30px; padding: 10px 20px; border: 3px solid; color: #4CAF50; justify-content: center; align-items: center; box-sizing: border-box;">Paying...</div>
                `}
              </div>
            ` : `\
              <div style="display: flex; margin-bottom: 20px; margin-right: auto; padding: 5px 20px; background-color: #673AB7; color: #FFF; font-size: 30px; font-weight: 400; box-sizing: border-box;">Whoops! Not enough funds!</div>
            `}
          </div>
        ` : `\
          <div style="display: flex; margin-bottom: 20px; flex-grow: 1; flex-direction: column; justify-content: center; align-items: center;">
            <img src="${checkImgSrc}" width="120" height="120">
            <div style="font-size: 60px; font-weight: 40px;">Payment successful</div>
          </div>
        `}
      ` : `\
        <div style="display: flex; margin-bottom: 20px; flex-grow: 1; flex-direction: column; justify-content: center; align-items: center;">
          <div style="font-size: 60px; font-weight: 40px;">Loading...</div>
        </div>
      `}
    </div>
  `;
};
const getBuyPageSrc = ({id, srcAsset, srcQuantity, dstAsset, dstQuantity, loading, hasAvailableBalance, paying, done}) => {
  return `\
    <div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; padding: 25px 0; padding-bottom: 10px; flex-direction: column; box-sizing: border-box;">
      <div style="display: flex; position: relative; height: 120px; margin-top: -25px; margin-bottom: 20px; padding-left: 50px; background-color: #000; color: #FFF; font-size: 60px; font-weight: 400; align-items: center; box-sizing: border-box;">
        <div>Confirm purchase</div>
        <a style="display: flex; position: absolute; top: 0; right: 0; width: 120px; height: 120px; justify-content: center; align-items: center;" onclick="payment:buy:cancel:${id}">
          <img src="${closeOutlineImgSrc}" width="50" height="50">
        </a>
      </div>
      ${!loading ? `\
        ${!done ? `\
          <div style="display: flex; padding-left: 50px; flex-direction: column; flex-grow: 1; box-sizing: border-box;">
            <div style="display: flex; margin-bottom: 50px; font-size: 30px; font-weight: 400; flex-grow: 1; align-items: center;">
              <span>Buy</span>
              ${_getAssetSrc(dstAsset, dstQuantity)}
              <span>for</span>
              ${_getAssetSrc(srcAsset, srcQuantity)}
              <span>?</span>
            </div>
            ${hasAvailableBalance ? `\
              <div style="display: flex; margin-bottom: 20px; font-size: 30px; font-weight: 400;">
                ${!paying ? `\
                  <a style="display: flex; margin-right: 30px; padding: 10px 20px; border: 3px solid; color: #4CAF50; justify-content: center; align-items: center; box-sizing: border-box;" onclick="payment:buy:confirm:${id}">Confirm</a>
                  <a style="display: flex; margin-right: 30px; padding: 10px 20px; border: 3px solid; color: #F44336; justify-content: center; align-items: center; box-sizing: border-box;" onclick="payment:buy:cancel:${id}">Reject</a>
                ` : `\
                  <div style="display: flex; margin-right: 30px; padding: 10px 20px; border: 3px solid; color: #4CAF50; justify-content: center; align-items: center; box-sizing: border-box;">Paying...</div>
                `}
              </div>
            ` : `\
              <div style="display: flex; margin-bottom: 20px; margin-right: auto; padding: 5px 20px; background-color: #673AB7; color: #FFF; font-size: 40px; font-weight: 400; box-sizing: border-box;">Whoops! Not enough funds!</div>
            `}
          </div>
        ` : `\
          <div style="display: flex; margin-bottom: 20px; flex-grow: 1; flex-direction: column; justify-content: center; align-items: center;">
            <img src="${checkImgSrc}" width="120" height="120">
            <div style="font-size: 60px; font-weight: 40px;">Purchase successful</div>
          </div>
        `}
      ` : `\
        <div style="display: flex; margin-bottom: 20px; flex-grow: 1; flex-direction: column; justify-content: center; align-items: center;">
          <div style="font-size: 60px; font-weight: 40px;">Loading...</div>
        </div>
      `}
    </div>
  `;
};
const _getAssetSrc = (asset, quantity) => {
  const normalizedAssetName = _normalizeAssetName(asset);
  const quantityString = _commaizeAssetQuantity(asset, quantity);

  return `\
    <div style="display: flex; margin: 0 10px;">
      ${creatureUtils.makeSvgCreature('asset:' + asset, {
        width: 12,
        height: 12,
        viewBox: '0 0 12 12',
        style: 'width: 50px; height: 50px; margin: 10px; image-rendering: -moz-crisp-edges; image-rendering: pixelated;',
      })}
      <div style="display: flex; flex-grow: 1; flex-direction: column; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
        <h1 style="margin: 0; margin-top: 10px; margin-bottom: 5px; font-size: 24px; font-weight: 400; line-height: 1.4; text-overflow: ellipsis; overflow: hidden;">${normalizedAssetName}</h1>
        <div style="display: flex; flex-grow: 1; align-items: center;">
          <div style="padding: 0 5px; border: 2px solid; font-size: 20px; font-weight: 400;">&#164; ${quantityString}</div>
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
  getPayPageSrc,
  getBuyPageSrc,
};

};

module.exports = {
  makeRenderer,
};
