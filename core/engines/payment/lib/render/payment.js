const {
  WIDTH,
  HEIGHT,
} = require('../constants/payment');

const getPaymentSrc = () => {
  return `\
    <div style="display: flex; width: ${width}px; height: ${HEIGHT}px; padding: 30px; flex-direction: column; box-sizing: border-box;">
      <div style="margin-bottom: 20px; font-size: 36px; line-height: 1.4;">Confirm payment</div>
      <div style="display: flex; font-size: 36px; line-height: 1.4;">
        <span>Pay</span>
        <div style="width: 100px;"></div>
        <span>to</span>
        <div style="width: 100px;"></div>
        <span>?</span>
      </div>
      <div style="display: flex; margin-bottom: 20px; font-size: 26px;">
        <a style="display: flex; margin-right: 20px; padding: 10px; border: 2px solid; font-size: 20px; justify-content: center; align-items: center; box-sizing: border-box;" onclick="payment:confirm">Confirm</a>
        <a style="display: flex; margin-right: 20px; padding: 10px; border: 2px solid; font-size: 20px; justify-content: center; align-items: center; box-sizing: border-box;" onclick="payment:cancel">Reject</a>
      </div>
    </div>
  `;
};

module.exports = {
  getPaymentSrc,
};
