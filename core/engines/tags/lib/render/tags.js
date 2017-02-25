const menuUtils = require('../utils/menu');

const barsBlackImg = require('../img/bars-black');
const barsBlackImgSrc = 'data:image/svg+xml;base64,' + btoa(barsBlackImg);
const barsWhiteImg = require('../img/bars-white');
const barsWhiteImgSrc = 'data:image/svg+xml;base64,' + btoa(barsWhiteImg);
const playBlackImg = require('../img/play-black');
const playBlackImgSrc = 'data:image/svg+xml;base64,' + btoa(playBlackImg);
const playWhiteImg = require('../img/play-white');
const playWhiteImgSrc = 'data:image/svg+xml;base64,' + btoa(playWhiteImg);
const downloadBlackImg = require('../img/download-black');
const downloadBlackImgSrc = 'data:image/svg+xml;base64,' + btoa(downloadBlackImg);

const getElementSrc = ({item, inputText, inputValue, positioningId, positioningName, focusAttributeSpec, highlight}) => {
  const {id, displayName, description, version, instancing, open} = item;
  const tagName = highlight ? 'a' : 'div';
  const linkTagName = highlight ? 'div' : 'a';

  const headerSrc = `\
    <div style="position: relative; display: flex; width: 400px; height: 150px; background-color: #F0F0F0; text-decoration: none; overflow: hidden; ${instancing ? 'filter: brightness(75%);' : ''}">
      <div style="display: flex; position: absolute; top: -15px; right: -58px; width: 155px; padding-top: 30px; padding-bottom: 10px; background-color: #2196F3; color: #FFF; justify-content: center; align-items: center; box-sizing: border-box; transform: rotate(45deg);">Mod</div>
      <div style="width: 100px; height: 100px; margin: 0 10px;"></div>
      <div style="width: 190px; margin-right: 10px;">
        <div style="height: 100px;">
          <h1 style="margin: 0; margin-top: 10px; font-size: 28px; font-weight: 400; line-height: 1.4;">${displayName}</h1>
          <p style="margin: 0; font-size: 15px; line-height: 1.4;">${description}</p>
        </div>
      </div>
      ${!open ?
        `<${linkTagName} style="display: flex; width: 80px; justify-content: center; align-items: center;" onclick="tag:open:${id}">
          <img src="${barsBlackImgSrc}" width="50" height="50">
        </${linkTagName}>`
      :
        `<${linkTagName} style="display: flex; width: 80px; background-color: #000; justify-content: center; align-items: center;" onclick="tag:close:${id}">
          <img src="${barsWhiteImgSrc}" width="50" height="50">
        </${linkTagName}>`
      }
    </div>
  `;
  const bodySrc = open ? `\
    <div style="position: relative; width: 400px; height: 450px; padding: 10px 0; background-color: #F0F0F0; overflow: hidden; box-sizing: border-box;">
      ${getAttributesSrc(item, inputText, inputValue, positioningId, positioningName, focusAttributeSpec)}
    </div>
  ` : '';

  return `\
    <${tagName} style="display: block; text-decoration: none;" onclick="tag:${id}">
      ${headerSrc}
      ${bodySrc}
    </${tagName}>
  `;
};

const getAttributesSrc = (item, inputText, inputValue, positioningId, positioningName, focusAttributeSpec) => {
  let acc = '';

  const {attributes} = item;

  if (attributes) {
    const {id} = item;

    for (const name in attributes) {
      const attribute = attributes[name];
      const {type, value, min, max, step, options} = attribute;
      const focus = focusAttributeSpec ? (id === focusAttributeSpec.tagId && name === focusAttributeSpec.attributeName) : false;
      const positioning = id === positioningId && name === positioningName;

      acc += `\
        <div style="display: flex; width: 400px; padding-left: 20px; margin-bottom: 4px; font-size: 20px; font-weight: 400; line-height: 1.4; align-items: center; box-sizing: border-box;">
          <div style="width: 120px; padding-right: 20px; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;">${name}</div>
          ${getAttributeInputSrc(id, name, type, value, min, max, step, options, inputText, inputValue, focus, positioning)}
        </div>
      `;
    }
  }

  if (acc) {
    return `\
      <div>
        ${acc}
      </div>
    `;
  } else {
    return `\
      <div>No attributes</div>
    `;
  }
};

const getAttributeInputSrc = (id, name, type, value, min, max, step, options, inputText, inputValue, focus, positioning) => {
  const focusValue = !focus ? value : menuUtils.castValueStringToValue(inputText, type, min, max, step, options);

  const width = 400 - (20 + 120 + 20);
  switch (type) {
    case 'matrix': {
      return `\
<div style="display: flex; width: ${width}px; height: 40px; justify-content: flex-end;">
  <a style="display: flex; padding: 5px 10px; border: 2px solid #d9534f; border-radius: 5px; color: #d9534f; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="attribute:${id}:${name}:position" onmousedown="attribute:${name}:position">${!positioning ? 'Set' : 'Setting...'}</a>
</div>
`;
    }
    case 'text': {
      return `\
<a style="position: relative; width: ${width}px; height: 40px; border: 2px solid #333; text-decoration: none; overflow: hidden; box-sizing: border-box;" onclick="attribute:${id}:${name}:focus" onmousedown="attribute:${id}:${name}:focus">
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

      const factor = focusValue !== null ? ((focusValue - min) / (max - min)) : min;
      const string = focusValue !== null ? String(focusValue) : inputText;

      return `\
<a style="position: relative; width: ${width - (100 + 20)}px; height: 40px; margin-right: 20px;" onclick="attribute:${id}:${name}:tweak" onmousedown="attribute:${id}:${name}:tweak">
  <div style="position: absolute; top: 19px; left: 0; right: 0; height: 2px; background-color: #CCC;">
    <div style="position: absolute; top: -14px; bottom: -14px; left: ${factor * 100}%; margin-left: -1px; width: 2px; background-color: #F00;"></div>
  </div>
</a>
<a style="position: relative; width: 100px; height: 40px; background-color: #EEE; border-radius: 5px; text-decoration: none; overflow: hidden;" onclick="attribute:${id}:${name}:focus" onmousedown="attribute:${id}:${name}:focus">
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
<a style="display: flex; width: ${width}px; height: 40px; border: 2px solid #333; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="attribute:${id}:${name}:focus" onmousedown="attribute:${id}:${name}:focus">
  <div style="width: ${400 - 30}px; text-overflow: ellipsis; overflow: hidden;">${focusValue}</div>
  <div style="display: flex; width: 30px; font-size: 16px; justify-content: center;">${unescape(encodeURIComponent('▼'))}</div>
</a>
`;
      } else {
        return `\
<div style="position: relative; width: ${width}px; height: 40px; z-index: 1;">
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
      return `<a style="display: flex; width: ${width}px; height: 40px; border: 2px solid #333; ${style}; text-decoration: none; align-items: center; text-overflow: ellipsis; overflow: hidden; box-sizing: border-box;" onclick="attribute:${id}:${name}:set:${option}" onmousedown="attribute:${id}:${name}:set:${option}">
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
<div style="display: flex; width: ${width}px; height: 40px; align-items: center;">
  <div style="width: 40px; height: 40px; margin-right: 4px; background-color: ${color};"></div>
  <a style="position: relative; width: ${400 - (40 + 4)}px; height: 40px; border: 2px solid #333; text-decoration: none; overflow: hidden; box-sizing: border-box;" onclick="attribute:${id}:${name}:focus" onmousedown="attribute:${id}:${name}:focus">
    ${focus ? `<div style="position: absolute; width: 2px; top: 0; bottom: 10px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
    <div>${string}</div>
  </a>
</div>
`;
    }
    case 'checkbox': {
      return `\
<div style="display: flex; width: ${width}px; height: 40px; justify-content: flex-end; align-items: center;">
  ${focusValue ?
    `<a style="display: flex; width: 40px; height: 40px; justify-content: center; align-items: center;" onclick="attribute:${id}:${name}:toggle" onmousedown="attribute:${id}:${name}:toggle">
      <div style="display: flex; width: ${(20 * 2) - (3 * 2)}px; height: 20px; padding: 1px; border: 3px solid #333; justify-content: flex-end; align-items: center; box-sizing: border-box;">
        <div style="width: ${20 - ((3 * 2) + (1 * 2))}px; height: ${20 - ((3 * 2) + (1 * 2))}px; background-color: #333;"></div>
      </div>
    </a>`
  :
    `<a style="display: flex; width: 40px; height: 40px; justify-content: center; align-items: center;" onclick="attribute:${id}:${name}:toggle" onmousedown="attribute:${id}:${name}:toggle">
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
<div style="display: flex; width: ${width}px; height: 40px;">
  <a style="display: flex; position: relative; width: ${width - 100}px; height: 40px; margin-right: 20px; border: 2px solid #333; align-items: center; text-decoration: none; box-sizing: border-box;" onclick="attribute:${id}:${name}:focus" onmousedown="attribute:${id}:${name}:focus">
    ${focus ? `<div style="position: absolute; width: 2px; top: 0; bottom: 10px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
    <div style="overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">${focusValue}</div>
  </a>
  <a style="display: flex; width: 100px; border: 2px solid #d9534f; border-radius: 5px; color: #d9534f; text-decoration: none; justify-content: center; align-items: center; box-sizing: border-box;" onclick="attribute:${id}:${name}:choose" onmousedown="attribute:${id}:${name}:choose">Choose</a>
</div>
`;
    }
    default: {
      return '';
    }
  }
};

const getFileSrc = ({item}) => {
  const {id, name, instancing, open} = item;

  const headerSrc = `\
    <div style="position: relative; display: flex; width: 400px; height: 150px; background-color: #F0F0F0; text-decoration: none; overflow: hidden; ${instancing ? 'filter: brightness(75%);' : ''}">
      <div style="display: flex; position: absolute; top: -15px; right: -58px; width: 155px; padding-top: 30px; padding-bottom: 10px; background-color: #E91E63; color: #FFF; justify-content: center; align-items: center; box-sizing: border-box; transform: rotate(45deg);">File</div>
      <div style="width: 100px; height: 100px; margin: 0 10px;"></div>
      <div style="width: 190px; margin-right: 10px;">
        <div style="height: 100px;">
          <h1 style="margin: 0; margin-top: 10px; font-size: 28px; font-weight: 400; line-height: 1.4;">${name}</h1>
          <p style="margin: 0; margin-bottom: 10px; font-size: 15px; line-height: 1.4;">File in /</p>
          <a style="display: inline-flex; padding: 4px 20px; border: 1px solid #333; border-radius: 100px; font-size: 28px; text-decoration: none; justify-content: center; align-items: center;" onclick="tag:download:${id}">Download</a>
        </div>
      </div>
      ${!open ?
        `<a style="display: flex; width: 80px; justify-content: center; align-items: center;" onclick="tag:open:${id}">
          <img src="${playBlackImgSrc}" width="50" height="50">
        </a>`
      :
        `<a style="display: flex; width: 80px; background-color: #000; justify-content: center; align-items: center;" onclick="tag:close:${id}">
          <img src="${playWhiteImgSrc}" width="50" height="50">
        </a>`
      }
    </div>
  `;
  const bodySrc = open ? `\
    <div style="position: relative; width: 400px; height: 400px; background-color: #000; overflow: hidden;"></div>
  ` : '';

  return `\
    <div>
      ${headerSrc}
      ${bodySrc}
    </div>
  `;
};

module.exports = {
  getElementSrc,
  getAttributesSrc,
  getAttributeInputSrc,
  getFileSrc,
};
