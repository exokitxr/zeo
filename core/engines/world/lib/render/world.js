const getInputSrc = ({inputText, inputPlaceholder, inputValue, focus, onclick}) => `\
  <div style='position: relative; height: 100px; width 1000px; font-size: 72px; line-height: 1.4;'>
    <a style='display: block; position: absolute; top: 0; bottom: 0; left: 0; right: 0; background-color: #EEE; border-radius: 10px; text-decoration: none;' onclick="${onclick}">
      ${focus ? `<div style="position: absolute; width: 2px; top: 0; bottom: 20px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
      <div>${inputText}</div>
      ${!inputText ? `<div style="color: #AAA;">${inputPlaceholder}</div>` : ''}
    </a>
  </div>
`;

const getReadmePageSrc = ({item, loading}) => {
  if (loading) {
    return `<h1 style="font-size: 50px;">Loading...</h1>`;
  } else {
    return item.readme || ('<h1>No readme for `' + item.displayName + '@' + item.version + '`</h1>');
  }
};

const getAttributesPageSrc = ({item, positioningName, inputText, inputValue, focusAttribute}) => {
  if (item) {
    let result = '';

    const {attributes} = item;
    for (const name in attributes) {
      const attribute = attributes[name];
      const {type, value, min, max, step, options} = attribute;
      // const focus = name === focusAttribute; // XXX
      const focus = false;

      result += `\
        <div style="display: flex; margin-bottom: 4px; font-size: 28px; line-height: 1.4; align-items: center;">
          <div style="width: ${200 - 30}px; padding-right: 30px; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;">${name}</div>
          ${getElementAttributeInput(name, type, value, min, max, step, options, positioningName, inputText, inputValue, focus)}
        </div>
      `;
    }

    return result;
  } else {
    return `\
      <div>No tag selected</div>
    `;
  }
};

const getElementAttributeInput = (name, type, value, min, max, step, options, positioningName, inputText, inputValue, focus) => {
  const focusValue = !focus ? value : menuUtils.castValueStringToValue(inputText, type, min, max, step, options);

  switch (type) {
    case 'matrix': {
      return `\
<div style="display: flex; width: 400px; height: 40px; justify-content: flex-end;">
  <a style="display: flex; padding: 5px 10px; border: 2px solid #d9534f; border-radius: 5px; color: #d9534f; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="element:attribute:${name}:position" onmousedown="element:attribute:${name}:position">${!positioningName ? 'Set' : 'Setting...'}</a>
</div>
`;
    }
    case 'text': {
      return `\
<a style="position: relative; width: 400px; height: 40px; background-color: #EEE; border-radius: 5px; text-decoration: none; overflow: hidden;" onclick="element:attribute:${name}:focus" onmousedown="element:attribute:${name}:focus">
  ${focus ? `<div style="position: absolute; width: 2px; top: 0; bottom: 10px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
  <div>${focusValue}</div>
</a>
`;
    }
    case 'number': {
      if (min === undefined) {
        min = 0;
      }
      if (max === undefined) {
        max = 10;
      }

      const factor = focusValue !== null ? ((focusValue - min) / max) : min;
      const string = focusValue !== null ? String(focusValue) : inputText;

      return `\
<a style="position: relative; width: ${400 - (100 + 20)}px; height: 40px; margin-right: 20px;" onclick="element:attribute:${name}:tweak" onmousedown="element:attribute:${name}:tweak">
  <div style="position: absolute; top: 19px; left: 0; right: 0; height: 2px; background-color: #CCC;">
    <div style="position: absolute; top: -14px; bottom: -14px; left: ${factor * 100}%; margin-left: -1px; width: 2px; background-color: #F00;"></div>
  </div>
</a>
<a style="position: relative; width: 100px; height: 40px; background-color: #EEE; border-radius: 5px; text-decoration: none; overflow: hidden;" onclick="element:attribute:${name}:focus" onmousedown="element:attribute:${name}:focus">
  ${focus ? `<div style="position: absolute; width: 2px; top: 0; bottom: 10px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
  <div>${string}</div>
</a>
`;
    }
    case 'select': {
      if (options === undefined) {
        options = [''];
      }

      if (!focus) {
        return `\
<a style="display: flex; width: 400px; height: 40px; border: 2px solid #333; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="element:attribute:${name}:focus" onmousedown="element:attribute:${name}:focus">
  <div style="width: ${400 - 30}px; text-overflow: ellipsis; overflow: hidden;">${focusValue}</div>
  <div style="display: flex; width: 30px; font-size: 16px; justify-content: center;">▼</div>
</a>
`;
      } else {
        return `\
<div style="position: relative; width: 400px; height: 40px; z-index: 1;">
  <div style="display: flex; flex-direction: column; background-color: #FFF;">
    ${options.map((option, i, a) => {
      const style = (() => {
        let result = '';
        if (i !== 0) {
          result += 'padding-top: 2px; border-top: 0;';
        }
        if (i !== (a.length - 1)) {
          result += 'padding-bottom: 2px; border-bottom: 0;';
        }
        if (option === focusValue) {
          result += 'background-color: #EEE;';
        }
        return result;
      })();
      return `<a style="display: flex; width: 400px; height: 40px; border: 2px solid #333; ${style}; text-decoration: none; align-items: center; text-overflow: ellipsis; overflow: hidden; box-sizing: border-box;" onclick="element:attribute:${name}:set:${option}" onmousedown="element:attribute:${name}:set:${option}">
        ${option}
      </a>`;
    }).join('\n')}
  </div>
</div>
`;
      }
    }
    case 'color': {
      const color = focusValue !== null ? focusValue : '#CCC';
      const string = focusValue !== null ? focusValue : inputText;

      return `\
<div style="display: flex; width: 400px; height: 40px; align-items: center;">
  <div style="width: 40px; height: 40px; margin-right: 4px; background-color: ${color};"></div>
  <a style="position: relative; width: ${400 - (40 + 4)}px; height: 40px; background-color: #EEE; border-radius: 5px; text-decoration: none; overflow: hidden;" onclick="element:attribute:${name}:focus" onmousedown="element:attribute:${name}:focus">
    ${focus ? `<div style="position: absolute; width: 2px; top: 0; bottom: 10px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
    <div>${string}</div>
  </a>
</div>
`;
    }
    case 'checkbox': {
      return `\
<div style="display: flex; width: 400px; height: 40px; justify-content: flex-end; align-items: center;">
  ${focusValue ?
    `<a style="display: flex; width: 40px; height: 40px; justify-content: center; align-items: center;" onclick="element:attribute:${name}:toggle" onmousedown="element:attribute:${name}:toggle">
      <div style="display: flex; width: ${(20 * 2) - (3 * 2)}px; height: 20px; padding: 1px; border: 3px solid #333; justify-content: flex-end; align-items: center; box-sizing: border-box;">
        <div style="width: ${20 - ((3 * 2) + (1 * 2))}px; height: ${20 - ((3 * 2) + (1 * 2))}px; background-color: #333;"></div>
      </div>
    </a>`
  :
    `<a style="display: flex; width: 40px; height: 40px; justify-content: center; align-items: center;" onclick="element:attribute:${name}:toggle" onmousedown="element:attribute:${name}:toggle">
      <div style="display: flex; width: ${(20 * 2) - (3 * 2)}px; height: 20px; padding: 1px; border: 3px solid #CCC; justify-content: flex-start; align-items: center; box-sizing: border-box;">
        <div style="width: ${20 - ((3 * 2) + (1 * 2))}px; height: ${20 - ((3 * 2) + (1 * 2))}px; background-color: #CCC;"></div>
      </div>
    </a>`
  }
</div>
`;
    }
    case 'file': {
      return `\
<div style="display: flex; width: 400px; height: 40px;">
  <a style="position: relative; width: 260px; height: 40px; margin-right: 20px; background-color: #EEE; border-radius: 5px; text-decoration: none; overflow: hidden;" onclick="element:attribute:${name}:focus" onmousedown="element:attribute:${name}:focus">
    ${focus ? `<div style="position: absolute; width: 2px; top: 0; bottom: 10px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
    <div>${focusValue}</div>
  </a>
  <a style="display: flex; width: 120px; border: 2px solid #d9534f; border-radius: 5px; color: #d9534f; text-decoration: none; justify-content: center; align-items: center; box-sizing: border-box;" onclick="element:attribute:${name}:choose" onmousedown="element:attribute:${name}:choose">Choose</a>
</div>
`;
    }
    default: {
      return '';
    }
  }
};

module.exports = {
  getInputSrc,
  getReadmePageSrc,
  getAttributesPageSrc,
};
