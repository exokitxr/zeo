const {
  HEIGHT,
} = require('../constants/equipment');

const makeRenderer = ({monospaceFonts}) => {
monospaceFonts = monospaceFonts.replace(/"/g, "'");

const getEquipmentPageSrc = equipment => `\
  <div style="padding: 20px">
    <h1 style="margin: 0; margin-bottom: 10px; font-size: 30px; font-weight: 400;">Equipped loadout</h1>
  </div>
`;

const getNpmPageSrc = ({inputText, inputPlaceholder, inputValue, focus, onclick}) => `\
  <div style="min-height: ${HEIGHT}px; padding: 20px; background-color: #000; font-size: 30px; line-height: 1.4;">
    <a style="position: relative; display: block; background-color: #FFF; text-decoration: none;" onclick="${onclick}">
      ${focus ? `<div style="position: absolute; width: 2px; top: 2px; bottom: 2px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
      <div>${inputText}</div>
      ${!inputText ? `<div style="color: #AAA;">${inputPlaceholder}</div>` : ''}
    </a>
  </div>
`;

return {
  getEquipmentPageSrc,
  getNpmPageSrc,
};

};

module.exports = {
  makeRenderer,
};
