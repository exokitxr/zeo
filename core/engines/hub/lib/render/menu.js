const {
  WIDTH,
  HEIGHT,

  SERVER_WIDTH,
  SERVER_HEIGHT,
} = require('../constants/menu');

const leftWhiteImg = require('../img/left-white');
const leftWhiteImgSrc = 'data:image/svg+xml;base64,' + btoa(leftWhiteImg);
const rightWhiteImg = require('../img/right-white');
const rightWhiteImgSrc = 'data:image/svg+xml;base64,' + btoa(rightWhiteImg);

const getHubSrc = ({searchText, inputIndex, inputValue, loading, error, focusType}) => {
  return `\
    <div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; flex-direction: column;">
      <div style="display: flex; height: 100px; padding: 20px; background-color: #000; font-size: 40px; color: #FFF; box-sizing: border-box; align-items: center;">Zeo VR</div>
      <div style="display: flex; height: 200px; background-color: #673AB7; color: #FFF; font-size: 16px; justify-content: center; align-items: center;">
        <div style="display: flex; flex-grow: 1; justify-content: center; align-items: center;">
          <img src="${leftWhiteImgSrc}" width="80" height="80" />
        </div>
        <div style="width: 640px;">
          <div style="font-size: 50px;">Choose a server</div>
        </div>
        <div style="display: flex; flex-grow: 1; justify-content: center; align-items: center;">
          <img src="${rightWhiteImgSrc}" width="80" height="80" />
        </div>
      </div>
      <div style="position: relative; display: flex; padding-top: 50px; justify-content: center; align-items: center; flex-direction: column;">
        <div style="width: 640px;">
          ${!loading ? `\
            ${error ? `\
              <div style="display: flex; position: absolute; left: 0; right: 0; margin-top: ${-50 - 80}px; height: 80px; background-color: #F44336; color: #FFF; font-size: 30px; font-weight: 400; justify-content: center; align-items: center;">
                <div style="display: flex; width: 640px;">
                  <div style="flex: 1;">
                    ${error === 'EINPUT' ? 'Enter a token.' : ''}
                    ${error === 'EAUTH' ? 'Invalid token.' : ''}
                  </div>
                  <a style="display: flex; width: 80px; border: 1px solid; border-radius: 5px; text-decoration: none; justify-content: center; align-items: center;" onclick="error:close">X</a>
                </div>
              </div>
            ` : ''}
            <a style="position: relative; display: block; margin-bottom: 30px; background-color: #EEE; font-size: 40px; text-decoration: none; overflow: hidden;" onclick="hub:focus:search">
              ${focusType === 'search' ? `<div style="position: absolute; width: 2px; top: 2px; bottom: 2px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
              <div>${searchText}</div>
              ${!searchText ? `<div style="color: #AAA;">Search servers</div>` : ''}
            </a>
          ` : `\
            <div style="font-size: 40px;">Loading...</div>
          `}
        </div>
      </div>
    </div>
  `;
};

const getServerSrc = ({worldname, description}) => {
  return `\
    <div style="display: flex; width: ${SERVER_WIDTH}px; height: ${SERVER_HEIGHT}px; padding: 50px; background-color: #EEE; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box;">
      <div style="display: flex; width: 100%;">
        <div style="width: ${SERVER_HEIGHT}px; height: ${SERVER_HEIGHT}px; margin: -50px; margin-right: 50px; background-color: #FFF;"></div>
        <div style="flex-grow: 1;">
          <div style="font-size: 60px; font-weight: 400;">${worldname}</div>
          <div style="min-height: 150px; font-size: 40px;">${description}</div>
        </div>
      </div>
    </div>
  `;
};

module.exports = {
  getHubSrc,
  getServerSrc,
};
