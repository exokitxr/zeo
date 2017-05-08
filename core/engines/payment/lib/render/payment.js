const {
  WIDTH,
  HEIGHT,
} = require('../constants/payment');

const closeOutlineImg = require('../img/close-outline');
const closeOutlineImgSrc = 'data:image/svg+xml;base64,' + btoa(closeOutlineImg);
const checkImg = require('../img/check');
const checkImgSrc = 'data:image/svg+xml;base64,' + btoa(checkImg);

const getPayPageSrc = ({id, address, hasAvailableBalance, paying, done}) => {
  return `\
    <div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; padding: 25px 50px; padding-bottom: 10px; flex-direction: column; box-sizing: border-box;">
      <div style="display: flex; position: relative; height: 120px; margin: -25px -50px; margin-bottom: 20px; padding: 0 50px; background-color: #000; color: #FFF; font-size: 60px; font-weight: 400; align-items: center; box-sizing: border-box;">
        <div>Confirm payment</div>
        <a style="display: flex; position: absolute; top: 0; right: 0; width: 120px; height: 120px; justify-content: center; align-items: center;" onclick="payment:pay:cancel:${id}">
          <img src="${closeOutlineImgSrc}" width="50" height="50">
        </a>
      </div>
      ${!done ? `\
        <div style="display: flex; margin-bottom: 50px; font-size: 30px; font-weight: 400; flex-grow: 1; align-items: center;">
          <span>Pay</span>
          <div style="width: 250px;"></div>
          <span>to <b>${address}</b>?</span>
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
          <div style="display: flex; margin-bottom: 20px; margin-right: auto; padding: 5px 10px; background-color: #673AB7; color: #FFF; font-size: 30px; font-weight: 400; box-sizing: border-box;">Whoops! Not enough funds!</div>
        `}
      ` : `\
        <div style="display: flex; margin-bottom: 20px; flex-grow: 1; flex-direction: column; justify-content: center; align-items: center;">
          <img src="${checkImgSrc}" width="120" height="120">
          <div style="font-size: 60px; font-weight: 40px;">Payment successful</div>
        </div>
      `}
    </div>
  `;
};
const getBuyPageSrc = ({id, hasAvailableBalance}) => {
  return `\
    <div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; padding: 25px 50px; padding-bottom: 10px; flex-direction: column; box-sizing: border-box;">
      <div style="display: flex; position: relative; height: 120px; margin: -25px -50px; margin-bottom: 20px; padding: 0 50px; background-color: #000; color: #FFF; font-size: 60px; font-weight: 400; align-items: center; box-sizing: border-box;">
        <div>Confirm purchase</div>
        <a style="display: flex; position: absolute; top: 0; right: 0; width: 120px; height: 120px; justify-content: center; align-items: center;" onclick="payment:buy:cancel:${id}">
          <img src="${closeOutlineImgSrc}" width="50" height="50">
        </a>
      </div>
      ${hasAvailableBalance ? `\
        <div style="display: flex; margin-bottom: 40px; font-size: 60px; flex-grow: 1; align-items: center;">
          <span>Buy</span>
          <div style="width: 200px;"></div>
          <span>for</span>
          <div style="width: 200px;"></div>
          <span>?</span>
        </div>
        <div style="display: flex; margin-bottom: 20px; font-size: 40px; font-weight: 400;">
          <a style="display: flex; margin-right: 40px; padding: 10px 20px; border: 3px solid; color: #4CAF50; justify-content: center; align-items: center; box-sizing: border-box;" onclick="payment:buy:confirm:${id}">Confirm</a>
          <a style="display: flex; margin-right: 40px; padding: 10px 20px; border: 3px solid; color: #F44336; justify-content: center; align-items: center; box-sizing: border-box;" onclick="payment:buy:cancel:${id}">Reject</a>
        </div>
      ` : `\
        <div style="display: flex; margin-bottom: 20px; margin-right: auto; padding: 5px 10px; background-color: #673AB7; color: #FFF; font-size: 40px; font-weight: 400; box-sizing: border-box;">Whoops! Not enough funds!</div>
      `}
    </div>
  `;
};

module.exports = {
  getPayPageSrc,
  getBuyPageSrc,
};
