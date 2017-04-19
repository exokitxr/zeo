const {
  HEIGHT,
} = require('../constants/world');

const upWhiteImg = require('../img/up-white');
const downWhiteImg = require('../img/down-white');

const getWorldPageSrc = ({loading, inputText, inputValue, numTags, page, focus}) => {
  const leftSrc = `\
    <div style="display: flex; padding: 20px 30px; font-size: 36px; line-height: 1.4; flex-grow: 1; flex-direction: column;">
      <a style="position: relative; display: block; background-color: #EEE; border-radius; 5px; text-decoration: none;" onclick="npm:focus">
        ${focus ? `<div style="position: absolute; width: 2px; top: 2px; bottom: 2px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
        <div>${inputText}</div>
        ${!inputText ? `<div style="color: #AAA;">Search npm modules</div>` : ''}
      </a>
      ${loading ? `<div style="display: flex; margin-bottom: 100px; font-size: 30px; align-items: center; justify-content: center; flex-grow: 1;">Loading...</div>` : ''}
    </div>
  `;
  const rightSrc = (() => {
    const showUp = page !== 0;
    const showDown = (() => {
      const numPages = Math.ceil(numTags / (4 * 6));
      return page < (numPages - 1);
    })();

    return `\
      <div style="display: flex; width: 250px; min-height: ${HEIGHT}px; padding-top: 20px; background-color: #000; flex-direction: column; box-sizing: border-box;">
        <div style="width: 1px; height: 80px;"></div>
        <a style="position: relative; display: flex; margin: 0 30px; margin-bottom: auto; border: 1px solid #FFF; border-radius: 5px; text-decoration: none; justify-content: center; align-items: center; ${showUp ? '' : 'visibility: hidden;'}" onclick="npm:up">
          ${upWhiteImg}
        </a>
        <a style="position: relative; display: flex; margin: 0 30px; margin-bottom: 20px; border: 1px solid #FFF; border-radius: 5px; text-decoration: none; justify-content: center; align-items: center; ${showDown ? '' : 'visibility: hidden;'}" onclick="npm:down">
          ${downWhiteImg}
        </a>
        <div style="height: 300px; background-color: #333;">
          <div style="display: flex; color: #FFF; font-size: 40px; justify-content: center; align-items: center;">Trash</div>
        </div>
      </div>
    `;
  })();

  return `\
    <div style="display: flex; min-height: ${HEIGHT}px;">
      ${leftSrc}
      ${rightSrc}
    </div>
  `;
};

const getEquipmentPageSrc = equipment => `\
  <div style="padding: 20px">
    <h1 style="margin: 0; margin-bottom: 10px; font-size: 30px; font-weight: 400;">Equipped modules</h1>
  </div>
`;

module.exports = {
  getWorldPageSrc,
  getEquipmentPageSrc,
};
