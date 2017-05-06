const {
  WIDTH,
  HEIGHT,
} = require('../constants/payment');

const getPaymentSrc = () => {
  return `\
    <div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; padding: 25px 50px; padding-bottom: 10px; flex-direction: column; box-sizing: border-box;">
      <div style="margin: -25px -50px; margin-bottom: 20px; padding: 25px 50px;background-color: #000; color: #FFF; font-size: 60px; font-weight: 400; box-sizing: border-box;">Confirm payment</div>
      <div style="display: flex; margin-bottom: 40px; font-size: 60px; flex-grow: 1; align-items: center;">
        <span>Buy</span>
        <div style="width: 200px;"></div>
        <span>for</span>
        <div style="width: 200px;"></div>
        <span>?</span>
      </div>
      <div style="display: flex; margin-bottom: 20px; font-size: 40px; font-weight: 400;">
        <a style="display: flex; margin-right: 50px; padding: 10px; border: 3px solid; color: #4CAF50; justify-content: center; align-items: center; box-sizing: border-box;" onclick="payment:confirm">Confirm</a>
        <a style="display: flex; margin-right: 50px; padding: 10px; border: 3px solid; color: #F44336; justify-content: center; align-items: center; box-sizing: border-box;" onclick="payment:cancel">Reject</a>
      </div>
    </div>
  `;
};

module.exports = {
  getPaymentSrc,
};
