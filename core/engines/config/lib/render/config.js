const {
  WIDTH,
} = require('../constants/config');

const getConfigPageSrc = ({inputText, inputValue, focus, sliderValue, airlockCheckboxValue, voiceChatCheckboxValue, statsCheckboxValue}) => `\
  <div style="width: ${WIDTH}px; margin: 40px 0; padding-right: 40px;">
    ${getInputSrc(inputText, '', inputValue, focus, 'config:input')}
    ${getSliderSrc(sliderValue)}
    ${getCheckboxSrc('Airlock', airlockCheckboxValue, 'config:airlock')}
    ${getCheckboxSrc('Voice chat', voiceChatCheckboxValue, 'config:voiceChat')}
    ${getCheckboxSrc('Stats', statsCheckboxValue, 'config:stats')}
  </div>
`;

const getInputSrc = (inputText, inputPlaceholder, inputValue, focus, onclick) => `\
  <div style='position: relative; height: 100px; width ${WIDTH}px; font-size: 72px; line-height: 1.4;'>
    <a style='display: block; position: absolute; top: 0; bottom: 0; left: 0; right: 0; background-color: #EEE; border-radius: 10px; text-decoration: none;' onclick="${onclick}">
      ${focus ? `<div style="position: absolute; width: 2px; top: 0; bottom: 20px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
      <div>${inputText}</div>
      ${!inputText ? `<div style="color: #CCC;">${inputPlaceholder}</div>` : ''}
    </a>
  </div>
`;

const getSliderSrc = sliderValue => `\
  <div style="position: relative; width: ${WIDTH - (500 + 40)}px; height: 100px;">
    <a style="display: block; position: absolute; top: 0; bottom: 0; left: 0; right: 0;" onclick="config:resolution">
      <div style="position: absolute; top: 40px; left: 0; right: 0; height: 10px; background-color: #CCC;">
        <div style="position: absolute; top: -40px; bottom: -40px; left: ${sliderValue * (WIDTH - (500 + 40))}px; margin-left: -5px; width: 10px; background-color: #F00;"></div>
      </div>
    </a>
  </div>
`;

const getCheckboxSrc = (label, checkboxValue, onclick) => `\
  <div style="display: flex; width: ${WIDTH - (500 + 40)}px; height: 100px; align-items: center;">
    <h1 style="margin: 0; font-size: 50px; font-weight: 300; flex: 1;">${label}</h1>
    <div style="display: flex; align-items: center;">
      ${checkboxValue ?
        `<a style="display: flex; width: 100px; height: 100px; justify-content: center; align-items: center;" onclick="${onclick}">
          <div style="display: flex; width: ${(50 * 2) - (6 * 2)}px; height: 50px; padding: 2px; border: 6px solid #333; justify-content: flex-end; align-items: center; box-sizing: border-box;">
            <div style="width: ${50 - ((6 * 2) + (2 * 2))}px; height: ${50 - ((6 * 2) + (2 * 2))}px; background-color: #333;"></div>
          </div>
        </a>`
      :
        `<a style="display: flex; width: 100px; height: 100px; justify-content: center; align-items: center;" onclick="${onclick}">
          <div style="display: flex; width: ${(50 * 2) - (6 * 2)}px; height: 50px; padding: 2px; border: 6px solid #CCC; justify-content: flex-start; align-items: center; box-sizing: border-box;">
            <div style="width: ${50 - ((6 * 2) + (2 * 2))}px; height: ${50 - ((6 * 2) + (2 * 2))}px; background-color: #CCC;"></div>
          </div>
        </a>`
      }
    </div>
  </div>
`;

module.exports = {
  getConfigPageSrc,
  getInputSrc,
  getSliderSrc,
  getCheckboxSrc,
};
