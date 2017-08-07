const {
  WIDTH,
  HEIGHT,
} = require('../constants/world');

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
const upImg = require('../img/up');
const downImg = require('../img/down');
const chevronLeftImg = require('../img/chevron-left');

const numTagsPerPage = 6;

const makeRenderer = ({creatureUtils}) => {
  const getWorldPageSrc = ({loading, inputText, inputValue, module, tagSpecs, numTags, page, focusType}) => {
    const leftSrc = `\
      <div style="display: flex; padding: 30px; font-size: 36px; line-height: 1.4; flex-grow: 1; flex-direction: column;">
        <a style="position: relative; display: block; margin-bottom: 20px; border-bottom: 2px solid; text-decoration: none;" onclick="npm:focus">
          ${focusType === 'npm:search' ?
            `<div style="position: absolute; width: 2px; top: 2px; bottom: 2px; left: ${inputValue}px; background-color: #000;"></div>`
          : ''}
          <div style="font-family: 'Lucida Console', Monaco, monospace; font-size: 30px; line-height: ${36 * 1.4}px;" measure="npm:search">${inputText.replace(/ /g, '&nbsp;')}</div>
          ${!inputText ? `<div>Search mods</div>` : ''}
        </a>
        ${tagSpecs
          .slice(page * numTagsPerPage, (page + 1) * numTagsPerPage)
          .map(tagSpec => getModuleSrc(tagSpec))
          .join('\n')}
        ${loading ? `<div style="display: flex; margin-bottom: 100px; font-size: 30px; font-weight: 400; align-items: center; justify-content: center; flex-grow: 1;">Loading...</div>` : ''}
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
        ${module !== null ?
          getModuleDetailsSrc(module, page, focusType === 'version')
        :
          `${leftSrc}
          ${rightSrc}`
        }
      </div>
    `;
  };
  const getModuleSrc = item => {
    const {id, name, description, instancing, metadata: {isStatic, exists}} = item;
    const tagName = isStatic ? 'a' : 'div';
    const linkTagName = isStatic ? 'div' : 'a';
    const staticExists = isStatic && exists;
    const imgSrc = (() => {
      if (isStatic) {
        if (exists) {
          return packageVariantSrc;
        } else {
          return packageVariantClosedSrc;
        }
      } else {
        return vectorPolygonImgSrc;
      }
    })();

    return `\
      <${tagName} style="display: block; text-decoration: none;" onclick="module:main:${id}">
        <div style="position: relative; display: flex; text-decoration: none; overflow: hidden; box-sizing: border-box; ${(instancing || staticExists) ? 'filter: brightness(75%);' : ''}">
          <${linkTagName} style="display: flex; padding: 10px 0; border-bottom: 1px solid #EEE; flex-grow: 1; text-decoration: none; box-sizing: border-box;" onclick="module:main:${id}">
            ${creatureUtils.makeSvgCreature('module:' + name, {
              width: 12,
              height: 12,
              viewBox: '0 0 12 12',
              style: 'width: 50px; height: 50px; margin: 10px; image-rendering: -moz-crisp-edges; image-rendering: pixelated;',
            })}
            <div style="margin-right: 10px; flex-grow: 1;">
              <div style="display: flex; flex-direction: column;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 400; line-height: 1.4;">${name}</h1>
                <p style="margin: 0; font-size: 16px; line-height: 1.4; flex-grow: 1;">${description}</p>
              </div>
            </div>
          </${linkTagName}>
          ${!isStatic ? `<div style="display: flex;">
            <a style="display: flex; margin-bottom: auto; padding: 15px; text-decoration: none; justify-content: center; align-items: center;" onclick="tag:remove:${id}">
              <img src="${closeOutlineSrc}" width="30" height="30">
            </a>
          </div>` : ''}
        </div>
      </${tagName}>
    `;
  };

  const getModuleDetailsSrc = (item, page, focus) => {
    const {id, name, version, versions, description, readme, metadata: {exists}} = item;
    const imgSrc = (() => {
      if (exists) {
        return vectorPolygonImgSrc;
      } else {
        return packageVariantClosedSrc;
      }
    })();

    const headerSrc = `\
      <div style="display: flex; height: 100px; padding: 30px; justify-content: center; align-items: center; box-sizing: border-box;">
        <a style="display: flex; width: 80px; height: 80px; justify-content: center; align-items: center;" onclick="module:back">${chevronLeftImg}</a>
        ${creatureUtils.makeSvgCreature('module:' + name, {
          width: 12,
          height: 12,
          viewBox: '0 0 12 12',
          style: 'width: 80px; height: 80px; image-rendering: -moz-crisp-edges; image-rendering: pixelated;',
        })}
        <div style="display: flex; margin-left: 10px; margin-right: auto; flex-direction: column; justify-content: center;">
          <div style="display: flex; margin-bottom: 10px; align-items: flex-end;">
            <div style="margin-right: 15px; font-size: 28px; font-weight: 400;">${name}</div>
            ${!_isAbsolute(name) ?
              (!focus ?
                `<div style="position: relative; width: 120px; height: 34px; margin-right: auto; z-index: 1;">
                   <div style="display: flex; flex-direction: column; background-color: #FFF;">
                     <a style="display: flex; height: 34px; padding: 0 10px; border: 2px solid #333; font-size: 20px; font-weight: 400; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="module:focusVersion">
                      <div style="text-overflow: ellipsis; margin-right: auto; overflow: hidden;">${version}</div>
                      <div style="display: flex; font-size: 16px; justify-content: center;">▼</div>
                     </a>
                   </div>
                 </div>`
              :
                `<div style="position: relative; width: 120px; height: 34px; margin-right: auto; z-index: 1;">
                  <div style="display: flex; flex-direction: column; background-color: #FFF;">
                    ${versions.map((versionOption, i, a) => {
                      const style = (() => {
                        let result = '';
                        if (i !== 0) {
                          result += 'padding-top: 2px; border-top: 0;';
                        }
                        if (i !== (a.length - 1)) {
                          result += 'padding-bottom: 2px; border-bottom: 0;';
                        }
                        if (versionOption !== version) {
                          result += 'background-color: #EEE;';
                        }
                        return result;
                      })();
                      return `<a style="display: flex; height: 34px; padding: 0 10px; border: 2px solid #333; ${style}; font-size: 20px; font-weight: 400; text-decoration: none; align-items: center; text-overflow: ellipsis; overflow: hidden; box-sizing: border-box;" onclick="module:setVersion:${id}:${versionOption}">
                        ${versionOption}
                      </a>`;
                    }).join('\n')}
                  </div>
                </div>`)
              :
                ''
            }
          </div>
          <div style="width: 600px; font-size: 16px; font-weight: 400; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">${description}</div>
        </div>
        <a style="display: flex; padding: 5px 10px; border: 2px solid; font-size: 20px; font-weight: 400; text-decoration: none; white-space: nowrap;" onclick="module:add:${id}">Add entity</a>
      </div>
    `;
    const bodySrc = (() => {
      const leftSrc = `\
        <div style="position: relative; width: ${WIDTH - 250 - (30 * 2)}px; top: ${-page * (HEIGHT - 100)}px; padding: 0 30px; box-sizing: border-box;">
          ${readme ?
            readme
          :
            `<div style="display: flex; width: inherit; height: 100px; font-size: 30px; font-weight: 400; justify-content: center; align-items: center;">No readme</div>`
          }
        </div>
      `;
      const rightSrc = (() => {
        const showUp = page !== 0;
        const showDown = Boolean(readme);

        return `\
          <div style="display: flex; width: 250px; padding-top: 20px; flex-direction: column; box-sizing: border-box;">
            <a style="position: relative; display: flex; margin: 0 30px; margin-bottom: auto; border: 1px solid; border-radius: 5px; text-decoration: none; justify-content: center; align-items: center; ${showUp ? '' : 'visibility: hidden;'}" onclick="module:up">
              ${upImg}
            </a>
            <a style="position: relative; display: flex; margin: 0 30px; margin-bottom: 20px; border: 1px solid; border-radius: 5px; text-decoration: none; justify-content: center; align-items: center; ${showDown ? '' : 'visibility: hidden;'}" onclick="module:down">
              ${downImg}
            </a>
          </div>
        `;
      })();

      return `\
        <div style="display: flex; height: ${HEIGHT - 100}px; overflow: hidden;">
          ${leftSrc}
          ${rightSrc}
        </div>
      `;
    })();

    return `\
      <div style="display: block; width: ${WIDTH}px; height: ${HEIGHT}px; text-decoration: none;">
        ${headerSrc}
        ${bodySrc}
      </div>
    `;
  };
  const _isAbsolute = name => /^\//.test(name);

  return {
    getWorldPageSrc,
    getModuleSrc,
    getModuleDetailsSrc,
  };
};

module.exports = {
  makeRenderer,
};
