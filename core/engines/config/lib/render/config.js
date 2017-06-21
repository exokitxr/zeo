const {
  WIDTH,
} = require('../constants/config');

const getConfigPageSrc = ({focus, resolutionValue, voiceChatCheckboxValue, statsCheckboxValue, visibilityValue, passwordValue, maxPlayersValue, inputValue, flags}) => `\
  <div style="width: ${WIDTH}px;">
    <div style="display: flex; width: 640px; padding: 0 30px; box-sizing: border-box; flex-direction: column;">
      <h1 style="margin: 15px 0; font-size: 40px; font-weight: 400;">Browser settings</h1>
      ${getSliderSrc('Resolution', resolutionValue, 'config:resolution')}
      ${flags.server ? getCheckboxSrc('Voice chat', voiceChatCheckboxValue, 'config:voiceChat') : ''}
      ${getCheckboxSrc('Stats', statsCheckboxValue, 'config:stats')}
      ${flags.server ? `\
        <h1 style="margin: 15px 0; font-size: 40px; font-weight: 400;">Server settings</h1>
        ${getSelectSrc('Visibility', visibilityValue, ['public', 'private'], focus, 'config:visibility')}
        ${getInputSrc('Password', passwordValue, 'Enter password', inputValue, focus, 'config:password')}
        ${getSliderSrc('Max players', (maxPlayersValue - 1) / (8 - 1), 'config:maxPlayers')}
      ` : ''}
    </div>
  </div>
`;

const getInputSrc = (label, inputText, inputPlaceholder, inputValue, focus, onclick) => `\
  <div style='display: flex; margin-bottom: 5px; font-size: 30px; line-height: 1.4; justify-content: center; align-items: center;'>
    <h1 style="width: 150px; margin: 0; margin-right: 30px; font-size: 30px; font-weight: 300;">${label}</h1>
    <a style='display: block; position: relative; background-color: #EEE; flex-grow: 1; text-decoration: none;' onclick="${onclick}">
      ${focus ? `<div style="position: absolute; width: 2px; top: 0; bottom: 0; left: ${inputValue}px; background-color: #333;"></div>` : ''}
      <div>${inputText}</div>
      ${!inputText ? `<div style="color: #CCC;">${inputPlaceholder}</div>` : ''}
    </a>
  </div>
`;

const getSliderSrc = (label, sliderValue, onclick) => `\
  <div style="display: flex; height: 50px; margin-bottom: 5px; justify-content: center; align-items: center;">
    <h1 style="width: 150px; margin: 0; margin-right: 30px; font-size: 30px; font-weight: 300;">${label}</h1>
    <div style="position: relative; height: 100%; flex-grow: 1;">
      <a style="display: block; position: absolute; top: 0; bottom: 0; left: 0; right: 0;" onclick="${onclick}">
        <div style="position: absolute; top: ${(50 - 6) / 2}px; left: 0; right: 0; height: 6px; background-color: #CCC;">
          <div style="position: absolute; top: -${(50 - 6) / 2}px; bottom: -${(50 - 6) / 2}px; left: ${sliderValue * 100}%; margin-left: -${6 / 2}px; width: 6px; background-color: #F00;"></div>
        </div>
      </a>
    </div>
  </div>
`;

const getCheckboxSrc = (label, checkboxValue, onclick) => `\
  <div style="display: flex; margin-bottom: 5px; align-items: center;">
    <h1 style="margin: 0; font-size: 30px; font-weight: 300; flex: 1;">${label}</h1>
    <div style="display: flex; align-items: center;">
      ${checkboxValue ?
        `<a style="display: flex; justify-content: center; align-items: center;" onclick="${onclick}">
          <div style="display: flex; width: ${(25 * 2) - (3 * 2)}px; height: 25px; padding: 2px; border: 3px solid #333; justify-content: flex-end; align-items: center; box-sizing: border-box;">
            <div style="width: ${25 - ((3 * 2) + (2 * 2))}px; height: ${25 - ((3 * 2) + (2 * 2))}px; background-color: #333;"></div>
          </div>
        </a>`
      :
        `<a style="display: flex; justify-content: center; align-items: center;" onclick="${onclick}">
          <div style="display: flex; width: ${(25 * 2) - (3 * 2)}px; height: 25px; padding: 2px; border: 3px solid #CCC; justify-content: flex-start; align-items: center; box-sizing: border-box;">
            <div style="width: ${25 - ((3 * 2) + (2 * 2))}px; height: ${25 - ((3 * 2) + (2 * 2))}px; background-color: #CCC;"></div>
          </div>
        </a>`
      }
    </div>
  </div>
`;

const getSelectSrc = (label, selectValue, options, focus, onclick) => {
  return `\
    <div style='display: flex; margin-bottom: 5px; font-size: 30px; line-height: 1.4; justify-content: center; align-items: center;'>
      <h1 style="width: 150px; margin: 0; margin-right: 30px; font-size: 30px; font-weight: 300;">${label}</h1>
      ${!focus ?
        `<a style="display: flex; height: 50px; padding: 0 10px; border: 2px solid #333; flex-grow: 1; font-size: 24px; font-weight: 400; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="${onclick}">
          <span style="margin-right: auto;">${selectValue}</span>
          <span style="font-size: 20px;">▼</span>
        </a>`
      :
        `<div style="position: relative; height: 50px; flex-grow: 1; z-index: 1;">
          <div style="display: flex; flex-direction: column; flex-grow: 1; background-color: #FFF;">
            ${options.map((option, i, a) => {
              const style = (() => {
                let result = '';
                if (i !== 0) {
                  result += 'padding-top: 2px; border-top: 0;';
                }
                if (i !== (a.length - 1)) {
                  result += 'padding-bottom: 2px; border-bottom: 0;';
                }
                if (selectValue === option) {
                  result += 'background-color: #EEE;';
                }
                return result;
              })();
              return `<a style="display: flex; height: 50px; padding: 0 10px; border: 2px solid #333; ${style}; font-size: 24px; font-weight: 400; text-decoration: none; align-items: center; text-overflow: ellipsis; overflow: hidden; box-sizing: border-box;" onclick="${onclick}:${option}">
                ${option}
              </a>`;
            }).join('\n')}
          </div>
        </div>`
      }
    </div>
  `;
};

/* const getButtonSrc = (label, onclick) => `\
  <a style="margin-right: auto; padding: 10px 15px; border: 2px solid; font-size: 20px; font-weight: 400; text-decoration: none;" onclick="${onclick}">${label}</a>
`; */

module.exports = {
  getConfigPageSrc,
};
