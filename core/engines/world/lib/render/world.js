const {
  HEIGHT,
} = require('../constants/world');

const makeRenderer = ({monospaceFonts}) => {
monospaceFonts = monospaceFonts.replace(/"/g, "'");

const getElementsPageSrc = () => `\
  <div style="padding: 20px">
    <h1 style="margin: 0; margin-bottom: 10px; font-size: 30px; font-weight: 400;">World modules</h1>
    <div style="font-size: 20px; color: #CCC; justify-content: center; align-items: center;">&lt;None&gt;</div>
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
  getElementsPageSrc,
  getNpmPageSrc,
};

};

module.exports = {
  makeRenderer,
};
