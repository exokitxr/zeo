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

const getHubSrc = ({page, searchText, inputIndex, inputValue, loading, error, focusType, logoImg}) => {
  return `\
    <div style="display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; flex-direction: column;">
      <div style="display: flex; height: 100px; padding: 20px; background-color: #000; font-size: 40px; color: #FFF; box-sizing: border-box; align-items: center;">
        <img src="${logoImg}" width="${100 / 2}" height="${158 / 2}" style="margin-right: 30px;" />
        <div>zeo vr</div>
      </div>
      ${getPageSrc(page, searchText, inputIndex, inputValue, loading, error, focusType, logoImg)}
    </div>
  `;
};

const getPageSrc = (page, searchText, inputIndex, inputValue, loading, error, focusType, logoImg) => {
  switch (page) {
    case 0: return `\
      <div style="display: flex; padding: 20px; justify-content: center; align-items: center; flex-direction: column; flex-grow: 1">
        <div style="font-size: 30px; font-weight: 400;">Welcome to Zeo!</div>
        <img src="${logoImg}" width="${100 * 0.75}" height="{158 * 0.75}" style="margin: 10px 0;" />
        <div style="width: 540px; margin-bottom: auto; font-size: 16px; font-weight: 400; flex-grow: 1">
          <p>Zeo lets you build multiplayer virtual worlds in your browser!</p>
          <p>Looks like you're using a keyboard and mouse, but you can still do everything you could with a headset! Here are the controls:</p>
          <p>
            <b>WASD</b>: Move around<br/>
            <b>Z or C</b>: Focus left or right controller (<i>required</i> to use the buttons below)<br/>
            <b>Click, E, F, Q</b>: Trigger, menu, grip, touchpad buttons<br/>
            <b>Mousewheel</b> Move controller x/y axis</br>
            <b>Ctrl + Mousewheel</b> Move controller x/z axis</br>
            <b>Shift + mousewheel</b> Rotate controller</br>
            The <b>red dots</b> show where your controllers are pointing
          </p>
          <p style="font-size: 20px;">
            <i>To continue, click the <b>NEXT BUTTON</b> with your <b>TRIGGER</b>.</i>
          </p>
        </div>
        <div style="display: flex; width: 100%; justify-content: flex-end;">
          <a style="padding: 10px 15px; border: 1px solid; border-radius: 5px; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="hub:next">Next: modules &gt;</a>
        </div>
      </div>
    `;
    case 1: return `\
    `;
    case 2: return `\
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
    `;
    default: return '';
  }
};

const getServerSrc = ({worldname, description, serverIcon}) => {
  return `\
    <div style="display: flex; width: ${SERVER_WIDTH}px; height: ${SERVER_HEIGHT}px; padding: 50px; background-color: #EEE; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box;">
      <div style="display: flex; width: 100%;">
        <img src="${serverIcon}" width="${SERVER_HEIGHT}" height="${SERVER_HEIGHT}" style="margin: -50px; margin-right: 50px; image-rendering: pixelated;" />
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
