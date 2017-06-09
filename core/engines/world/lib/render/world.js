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
const autorenewImg = require('../img/autorenew');
const autorenewImgSrc = 'data:image/svg+xml;base64,' + btoa(autorenewImg);
const closeBoxImg = require('../img/close-box');
const closeBoxImgSrc = 'data:image/svg+xml;base64,' + btoa(closeBoxImg);
const linkImg = require('../img/link');
const linkImgSrc = 'data:image/svg+xml;base64,' + btoa(linkImg);
const upImg = require('../img/up');
const downImg = require('../img/down');

const numTagsPerPage = 6;

const makeRenderer = ({creatureUtils}) => {
  const getWorldPageSrc = ({loading, inputText, inputValue, tagSpecs, numTags, page, focus}) => {
    const leftSrc = `\
      <div style="display: flex; padding: 30px; font-size: 36px; line-height: 1.4; flex-grow: 1; flex-direction: column;">
        <a style="position: relative; display: block; margin-bottom: 20px; border-bottom: 2px solid; text-decoration: none;" onclick="npm:focus">
          ${focus ? `<div style="position: absolute; width: 2px; top: 2px; bottom: 2px; left: ${inputValue}px; background-color: #000;"></div>` : ''}
          <div>${inputText}</div>
          ${!inputText ? `<div>Search mods</div>` : ''}
        </a>
        ${tagSpecs
          .slice(page * numTagsPerPage, (page + 1) * numTagsPerPage)
          .map(tagSpec => getModuleSrc(tagSpec))
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
        ${leftSrc}
        ${rightSrc}
      </div>
    `;
  };
  const getModuleSrc = item => {
    const {id, name, displayName, description, instancing, metadata: {isStatic, exists}} = item;
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
          <${linkTagName} style="display: flex; padding: 10px 0; border-bottom: 1px solid #EEE; flex-grow: 1; text-decoration: none; box-sizing: border-box;" onclick="module:main:${id}" onmousedown="module:main:${id}">
            <img src="${creatureUtils.makeStaticCreature('module:' + name)}" width="50" height="50" style="width: 50px; height: 50px; margin: 10px; image-rendering: -moz-crisp-edges; image-rendering: pixelated;" />
            <div style="margin-right: 10px; flex-grow: 1;">
              <div style="display: flex; flex-direction: column;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 400; line-height: 1.4;">${displayName}</h1>
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

  return {
    getWorldPageSrc,
    getModuleSrc,
  };
};

module.exports = {
  makeRenderer,
};
