const menuUtils = require('../utils/menu');
const {
  HEIGHT,
  WIDTH,
  OPEN_WIDTH,
  OPEN_HEIGHT,
} = require('../constants/tags');

const barsBlackImg = require('../img/bars-black');
const barsBlackImgSrc = 'data:image/svg+xml;base64,' + btoa(barsBlackImg);
const barsWhiteImg = require('../img/bars-white');
const barsWhiteImgSrc = 'data:image/svg+xml;base64,' + btoa(barsWhiteImg);
const playBlackImg = require('../img/play-black');
const playBlackImgSrc = 'data:image/svg+xml;base64,' + btoa(playBlackImg);
const playWhiteImg = require('../img/play-white');
const playWhiteImgSrc = 'data:image/svg+xml;base64,' + btoa(playWhiteImg);

const makeRenderer = ({creatureUtils}) => {
  const getElementSrc = ({item, inputText, inputValue, positioningId, positioningName, focusAttributeSpec, isStatic}) => {
    const {id, displayName, description, version, instancing, open} = item;
    const tagName = isStatic ? 'a' : 'div';
    const linkTagName = isStatic ? 'div' : 'a';

    const headerSrc = `\
      <div style="position: relative; display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; background-color: #F0F0F0; text-decoration: none; overflow: hidden; ${instancing ? 'filter: brightness(75%);' : ''}">
        <div style="display: flex; position: absolute; top: -15px; right: -58px; width: 155px; padding-top: 30px; padding-bottom: 10px; background-color: #2196F3; color: #FFF; justify-content: center; align-items: center; box-sizing: border-box; transform: rotate(45deg);">Mod</div>
        <img src="${creatureUtils.makeStaticCreature('element:' + displayName)}" width="80" height="80" style="width: 80px; height: 80px; margin: 10px; image-rendering: pixelated;" />
        <div style="width: ${WIDTH - (80 + (10 * 2)) - 10 - 80}px; margin-right: 10px;">
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
      <div style="position: relative; width: ${OPEN_WIDTH}px; height: ${OPEN_HEIGHT}px; padding: 10px 0; background-color: #F0F0F0; overflow: hidden; box-sizing: border-box;">
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
          <div style="display: flex; width: ${OPEN_WIDTH}px; padding-left: 20px; margin-bottom: 4px; font-size: 20px; font-weight: 400; line-height: 1.4; align-items: center; box-sizing: border-box;">
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
        <div style="padding: 0 20px;">No attributes</div>
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

  const getFileSrc = ({item, mode}) => {
    const {id, name, mimeType, instancing, open, paused, value} = item;

    const headerSrc = `\
      <div style="position: relative; display: flex; width: ${WIDTH}px; height: ${HEIGHT}px; background-color: #F0F0F0; text-decoration: none; overflow: hidden; ${instancing ? 'filter: brightness(75%);' : ''}">
        <div style="display: flex; position: absolute; top: -15px; right: -58px; width: 155px; padding-top: 30px; padding-bottom: 10px; background-color: #E91E63; color: #FFF; justify-content: center; align-items: center; box-sizing: border-box; transform: rotate(45deg);">File</div>
        <img src="${creatureUtils.makeStaticCreature('file:' + displayName)}" width="80" height="80" style="mwidth: 80px; height: 80px; margin: 10px; image-rendering: pixelated;" />
        <div style="width: ${WIDTH - (80 + (10 * 2)) - 10 - 80}px; margin-right: 10px;">
          <div style="height: 150px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
            <h1 style="margin: 0; margin-top: 10px; font-size: 28px; font-weight: 400; line-height: 1.4;">${name}</h1>
            <p style="margin: 0; margin-bottom: 10px; font-size: 15px; line-height: 1.4;">${mimeType}</p>
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
    const bodySrc = (() => {
      const _getFramePreviewSrc = (text = '') => `\
        <div style="position: relative; display: flex; width: ${OPEN_WIDTH}px; height: ${OPEN_HEIGHT - HEIGHT}px; padding: 20px; border: 1px solid #000; font-size: 28px; font-weight: 400; justify-content: center; align-items: center; overflow: hidden; box-sizing: border-box;">${text}</div>
      `;

      if (open) {
        if (mode === 'image') {
          return _getFramePreviewSrc();
        } else if (mode === 'audio' || mode === 'video') {
          const mainSrc = (() => {
            if (mode === 'audio') {
              if (paused) {
                return `\
                  <a style="display: flex; background-color: #FFF; flex-grow: 1; justify-content: center; align-items: center;" onclick="media:play:${id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 79.374997 79.374985">
                      <path d="M21.167 79.375l39.687-39.687L21.167 0v79.375"/>
                    </svg>
                  </a>
                `;
              } else {
                return `\
                  <a style="display: flex;  background-color: #FFF; flex-grow: 1; justify-content: center; align-items: center;" onclick="media:pause:${id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 79.374997 79.374985">
                      <path d="M13.23 0v79.375h18.52V0H13.23M47.625 0v79.375h18.52V0z"/>
                    </svg>
                  </a>
                `;
              }
            } else if (mode === 'video') {
              if (paused) {
                return `\
                  <a style="display: flex; flex-grow: 1; justify-content: center; align-items: center;" onclick="media:play:${id}">
                    <div></div>
                  </a>
                `;
              } else  {
                return `\
                  <a style="display: flex; flex-grow: 1; justify-content: center; align-items: center;" onclick="media:pause:${id}">
                    <div></div>
                  </a>
                `;
              }
            } else {
              return '';
            }
          })();
          const barSrc = `\
            <a style="display: flex; width: ${WIDTH}px; height: 100px; background-color: #FFF;" onclick="media:seek:${id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="1" height="16" viewBox="0 0 0.26458333 4.2333333" style="position: absolute; height: 100px; width: ${100 * (1 / 16)}px; margin-left: ${-(100 * (1 / 16) / 2)}px; left: ${value * 100}%;">
                <path d="M0 0v4.233h.265V0H0" fill="#f44336"/>
              </svg>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 8.4666666 8.4666666" preserveAspectRatio="none" style="width: ${OPEN_WIDTH}px; height:100px;">
                <path d="M0 3.97v.528h8.467v-.53H0" fill="#ccc"/>
              </svg>
            </div>
          `;

          return `\
            <div style="display: flex; height: ${OPEN_HEIGHT - HEIGHT}px; flex-direction: column;">
              ${mainSrc}
              ${barSrc}
            </div>
          `;
        } else if (mode === 'model') {
          return _getFramePreviewSrc();
        } else {
          return _getFramePreviewSrc('Unknown file type');
        }
      } else {
        return '';
      }
    })();

    return `\
      <div>
        ${headerSrc}
        ${bodySrc}
      </div>
    `;
  };

  return {
    getElementSrc,
    getAttributesSrc,
    getAttributeInputSrc,
    getFileSrc,
  };
};

module.exports = {
  makeRenderer,
};
