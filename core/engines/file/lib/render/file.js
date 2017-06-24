const {
  WIDTH,
  HEIGHT,
} = require('../constants/file');

const AXES = ['x', 'y', 'z'];

const vectorPolygonImg = require('../img/vector-polygon');
const vectorPolygonImgSrc = 'data:image/svg+xml;base64,' + btoa(vectorPolygonImg);
const closeBoxOutline = require('../img/close-box-outline');
const closeBoxOutlineSrc = 'data:image/svg+xml;base64,' + btoa(closeBoxOutline);
const closeOutline = require('../img/close-outline');
const closeOutlineSrc = 'data:image/svg+xml;base64,' + btoa(closeOutline);
const packageVariant = require('../img/package-variant');
const packageVariantSrc = 'data:image/svg+xml;base64,' + btoa(packageVariant);
const packageVariantClosed = require('../img/package-variant-closed');
const packageVariantClosedSrc = 'data:image/svg+xml;base64,' + btoa(packageVariantClosed);
const autorenewImg = require('../img/autorenew');
const autorenewImgSrc = 'data:image/svg+xml;base64,' + btoa(autorenewImg);
const closeBoxImg = require('../img/close-box');
const closeBoxImgSrc = 'data:image/svg+xml;base64,' + btoa(closeBoxImg);
const linkImg = require('../img/link');
const linkImgSrc = 'data:image/svg+xml;base64,' + btoa(linkImg);
const upImg = require('../img/up');
const downImg = require('../img/down');
const chevronLeftImg = require('../img/chevron-left');

const numTagsPerPage = 4;

const makeRenderer = ({creatureUtils}) => {
  const getFilePageSrc = ({loading, inputText, inputValue, tagSpecs, numTags, file, page, focus}) => {
    if (!file) {
      return getFilesSrc({loading, inputText, inputValue, tagSpecs, numTags, page, focus});
    } else {
      return getFileDetailsSrc(file);
    }
  };
  const getFilesSrc = ({loading, inputText, inputValue, tagSpecs, numTags, page, focus}) => {
    const leftSrc = `\
      <div style="display: flex; padding: 30px; font-size: 36px; line-height: 1.4; flex-grow: 1; flex-direction: column;">
        <a style="position: relative; display: block; margin-bottom: 20px; border-bottom: 2px solid; text-decoration: none;" onclick="file:focus">
          ${focus ?
            `<div style="position: absolute; width: 2px; top: 2px; bottom: 2px; left: ${inputValue}px; background-color: #000;"></div>`
          : ''}
          <div>${inputText}</div>
          ${!inputText ? `<div>Search files</div>` : ''}
        </a>
        ${tagSpecs
          .slice(page * numTagsPerPage, (page + 1) * numTagsPerPage)
          .map(tagSpec => getFileSrc(tagSpec))
          .join('\n')}
        ${loading ? `<div style="display: flex; margin-bottom: 100px; font-size: 30px; align-items: center; justify-content: center; flex-grow: 1;">Loading...</div>` : ''}
      </div>
    `;
    const rightSrc = (() => {
      const showUp = page !== 0;
      const showDown = (() => {
        const numPages = Math.ceil(numTags / numTagsPerPage);
        return page < (numPages - 1);
      })();

      return `\
        <div style="display: flex; width: 250px; min-height: ${HEIGHT}px; padding-top: 20px; flex-direction: column; box-sizing: border-box;">
          <div style="width: 1px; height: 100px;"></div>
          <a style="position: relative; display: flex; margin: 0 30px; margin-bottom: auto; border: 2px solid; border-radius: 5px; text-decoration: none; justify-content: center; align-items: center; ${showUp ? '' : 'visibility: hidden;'}" onclick="file:up">
            ${upImg}
          </a>
          <a style="position: relative; display: flex; margin: 0 30px; border: 2px solid; border-radius: 5px; text-decoration: none; justify-content: center; align-items: center; ${showDown ? '' : 'visibility: hidden;'}" onclick="file:down">
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
  const getFileSrc = item => {
    const {id, name, mimeType, instancing, paused, value, mode, preview} = item;
    const open = false;

    const previewSrc = (() => {
      switch (mode) {
        case 'image': {
          if (preview) {
            return preview;
          } else {
            return `<div style="width: 50px; height: 50px; margin: 10px; background-color: #EEE;"></div>`;
          }
        }
        default: {
          return creatureUtils.makeSvgCreature('file:' + name, {
            width: 12,
            height: 12,
            viewBox: '0 0 12 12',
            style: 'width: 50px; height: 50px; margin: 10px; image-rendering: -moz-crisp-edges; image-rendering: pixelated;',
          });
        }
      }
    })();
    const headerSrc = `\
      <div style="position: relative; display: flex;">
        <div style="display: flex; flex-grow: 1; flex-direction: column;">
          <div style="display: flex; flex-grow: 1;">
            ${previewSrc}
            <div style="display: flex; max-width: ${WIDTH - (30) - (50 + (10 * 2)) - (30 + (15 * 2))}px; margin-top: 10px; flex-grow: 1; flex-direction: column; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 400; line-height: 1.4;">${name}</h1>
              <p style="margin: 0; margin-bottom: 10px; font-size: 15px; line-height: 1.4;">${mimeType}</p>
            </div>
          </div>
        </div>
        <!-- <div style="display: flex;">
          <a style="display: flex; margin-bottom: auto; padding: 15px; text-decoration: none; justify-content: center; align-items: center;" onclick="tag:remove:${id}">
            <img src="${closeOutlineSrc}" width="30" height="30" />
          </a>
        </div> -->
      </div>
    `;
    const bodySrc = (() => {
      return '';

      const _getFramePreviewSrc = (text = '') => `\
        <div style="position: relative; display: flex; width: ${OPEN_WIDTH}px; height: ${OPEN_HEIGHT - HEIGHT}px; background-color: #EEE; font-size: 28px; font-weight: 400; justify-content: center; align-items: center; overflow: hidden; box-sizing: border-box;">${text}</div>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 8.4666666 8.4666666" preserveAspectRatio="none" style="width: ${OPEN_WIDTH}px; height: 100px;">
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
      <a style="display: flex; border-bottom: 1px solid #EEE; text-decoration: none;" onclick="file:file:${id}">
        ${headerSrc}
        ${bodySrc}
      </a>
    `;
  };
  const getFileDetailsSrc = ({id, name, mimeType}) => {
    return `<div style="display: flex; min-height: ${HEIGHT}px; padding: 30px; flex-direction: column; box-sizing: border-box;">
      <div style="display: flex; height: 80px; margin-bottom: 20px;">
        <a style="display: flex; width: 80px; height: 80px; margin-right: 20px; justify-content: center; align-items: center;" onclick="file:back">${chevronLeftImg}</a>
        <div style="display: flex; flex-direction: column;">
          <h1 style="margin: 0; font-size: 30px; font-weight: 400; line-height: 1.4;">${name}</h1>
          <p style="margin: 0; font-size: 20px; font-weight: 400; line-height: 1.4;">${mimeType}</p>
        </div>
      </div>
      <div style="width: 480px; height: 480px;"></div>
    </div>`;
  };

  return {
    getFilePageSrc,
    getFileSrc,
    getFileDetailsSrc,
  };
};

module.exports = {
  makeRenderer,
};
