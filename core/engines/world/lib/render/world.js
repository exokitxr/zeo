const {
  HEIGHT,
} = require('../constants/world');

const getWorldPageSrc = ({inputText, inputPlaceholder, inputValue, focus, onclick}) => `\
  <div style="padding: 20px 38px; font-size: 36px; line-height: 1.4;">
    <a style="position: relative; display: block; background-color: #EEE; border-radius; 5px; text-decoration: none;" onclick="${onclick}">
      ${focus ? `<div style="position: absolute; width: 2px; top: 2px; bottom: 2px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
      <div>${inputText}</div>
      ${!inputText ? `<div style="color: #AAA;">${inputPlaceholder}</div>` : ''}
    </a>
  </div>
`;

const getEquipmentPageSrc = equipment => `\
  <div style="padding: 20px">
    <h1 style="margin: 0; margin-bottom: 10px; font-size: 30px; font-weight: 400;">Equipped modules</h1>
  </div>
`;

module.exports = {
  getWorldPageSrc,
  getEquipmentPageSrc,
};
