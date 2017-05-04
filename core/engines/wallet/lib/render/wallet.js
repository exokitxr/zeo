const {
  HEIGHT,
} = require('../constants/wallet');

const upImg = require('../img/up');
const downImg = require('../img/down');

const getWalletPageSrc = ({loading, loggedIn, inputText, inputValue, numTags, page, focus}) => {
  const leftSrc = `\
    <div style="display: flex; padding: 30px; font-size: 36px; line-height: 1.4; flex-grow: 1; flex-direction: column;">
      ${loggedIn ? `\
        <a style="position: relative; display: block; border-bottom: 2px solid; text-decoration: none;" onclick="npm:focus">
          ${focus ? `<div style="position: absolute; width: 2px; top: 2px; bottom: 2px; left: ${inputValue}px; background-color: #000;"></div>` : ''}
          <div>${inputText}</div>
          ${!inputText ? `<div>Search my assets</div>` : ''}
        </a>
        ${loading ? `<div style="display: flex; margin-bottom: 100px; font-size: 30px; align-items: center; justify-content: center; flex-grow: 1;">Loading...</div>` : ''}
      ` : `\
        ${loading ? `\
          <div style="display: flex; margin-bottom: 100px; font-size: 30px; align-items: center; justify-content: center; flex-grow: 1;">Loading...</div>
        ` : `\
          <div style="margin-bottom: 20px; font-size: 30px; font-weight: 400;">Not logged in</div>
          <a style="margin-right: auto; padding: 10px 15px; border: 2px solid; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="wallet:login">Log in</a>
        `}
      `}
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
        <a style="position: relative; display: flex; margin: 0 30px; margin-bottom: auto; border: 2px solid; border-radius: 5px; text-decoration: none; justify-content: center; align-items: center; ${showUp ? '' : 'visibility: hidden;'}" onclick="npm:up">
          ${upImg}
        </a>
        <a style="position: relative; display: flex; margin: 0 30px; border: 2px solid; border-radius: 5px; text-decoration: none; justify-content: center; align-items: center; ${showDown ? '' : 'visibility: hidden;'}" onclick="npm:down">
          ${downImg}
        </a>
        <div style="width: 1px; height: 50px;"></div>
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

module.exports = {
  getWalletPageSrc,
};
