const getAttributesPageSrc = ({element}) => { // XXX
  return '<div>lol</div>';
  return `\
<div style="display: flex; flex-direction: column; width: 600px; min-height: ${HEIGHT - (150 + 2)}px; padding-left: 30px; box-sizing: border-box;">
  ${(selectedKeyPath.length > 0 && selectedKeyPath[0] === 'elements') ?
    `${getSubcontentSectionSrc(
      `\
<span style="color: #a894a6;">\
&lt;\
<img src="${creatureUtils.makeStaticCreature('mod:' + element.tag)}" width="40" height="40" style="display: inline-block; position: relative; top: 8px; image-rendering: pixelated;" />\
${element.tag}&gt; properties\
</span>\
`,
      null,
      getElementAttributesSrc(element, positioningName, inputText, inputValue, focusAttribute),
      ''
    )}
    <div style="margin-top: 30px; margin-left: -30px; border-bottom: 2px solid #333;"></div>`
  :
    ''
  }
  ${getSubcontentSectionSrc(
    'Installed',
    `<a style="padding: 5px 10px; background-color: #5cb85c; border-radius: 5px; font-size: 24px; color: #FFF; text-decoration: none;">More</a>`,
    getElementsSrc(availableElements, ['availableElements'], selectedKeyPath, draggingKeyPath),
    `Installed and ready to add. Drag to the left.<br/><a href="#">Install more elements</a>`
  )}
  <div style="margin-top: 10px; margin-left: -30px; border-bottom: 2px solid #333;"></div>
  ${getSubcontentSectionSrc(
    'Clipboard',
    `<a style="padding: 5px 10px; background-color: #0275d8; border-radius: 5px; font-size: 24px; color: #FFF; text-decoration: none;" onclick="elements:clearclipboard">Clear</a>`,
    getElementsSrc(clipboardElements, ['clipboardElements'], selectedKeyPath, draggingKeyPath),
    `Drag-and-drop elements to the clipboad to save them. Drag inside the clipboard to copy.`
  )}
</div>
`;
};

module.exports = {
  getAttributesPageSrc,
};
