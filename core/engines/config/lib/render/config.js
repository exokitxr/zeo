const {
  WIDTH,
} = require('../constants/config');

const getConfigPageSrc = ({inputText, inputValue, focus, sliderValue, airlockCheckboxValue, voiceChatCheckboxValue, statsCheckboxValue, physicsDebugCheckboxValue}) => `\
  <div style="width: ${WIDTH}px;">
    <div style="width: 640px; padding: 30px; box-sizing: border-box;">
      ${getInputSrc(inputText, '', inputValue, focus, 'config:input')}
      ${getSliderSrc(sliderValue)}
      ${getCheckboxSrc('Airlock', airlockCheckboxValue, 'config:airlock')}
      ${getCheckboxSrc('Voice chat', voiceChatCheckboxValue, 'config:voiceChat')}
      ${getCheckboxSrc('Stats', statsCheckboxValue, 'config:stats')}
      ${getCheckboxSrc('Physics debug', physicsDebugCheckboxValue, 'config:physicsDebug')}
      ${getButtonSrc('Log out', 'config:logOut')}
    </div>
  </div>
`;

const getInputSrc = (inputText, inputPlaceholder, inputValue, focus, onclick) => `\
  <div style='position: relative; margin-bottom: 5px; font-size: 30px; line-height: 1.4;'>
    <a style='display: block; background-color: #EEE; border-radius: 5px; text-decoration: none;' onclick="${onclick}">
      ${focus ? `<div style="position: absolute; width: 2px; top: 0; bottom: 20px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
      <div>${inputText}</div>
      ${!inputText ? `<div style="color: #CCC;">${inputPlaceholder}</div>` : ''}
    </a>
  </div>
`;

const getSliderSrc = sliderValue => `\
  <div style="position: relative; height: 50px; margin-bottom: 5px;">
    <a style="display: block; position: absolute; top: 0; bottom: 0; left: 0; right: 0;" onclick="config:resolution">
      <div style="position: absolute; top: ${(50 - 6) / 2}px; left: 0; right: 0; height: 6px; background-color: #CCC;">
        <div style="position: absolute; top: -${(50 - 6) / 2}px; bottom: -${(50 - 6) / 2}px; left: ${sliderValue * (640 - (30 * 2))}px; margin-left: -${6 / 2}px; width: 6px; background-color: #F00;"></div>
      </div>
    </a>
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

const getButtonSrc = (label, onclick) => `\
  <a style="display: inline-block; margin-top: 10px; padding: 5px 20px; border: 1px solid #333; border-radius: 100px; color: #333; font-size: 24px; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="${onclick}">${label}</a>
`;

module.exports = {
  getConfigPageSrc,
  getInputSrc,
  getSliderSrc,
  getCheckboxSrc,
  getButtonSrc,
};
