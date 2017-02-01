const menuUtils = require('../utils/menu');

const makeRenderer = ({creatureUtils}) => {

const {
  WIDTH,
  HEIGHT,
} = require('../constants/menu');

const getMainPageSrc = () => `\
${getHeaderSrc('zeo.sh', '', '', false)}
<div style="height: ${HEIGHT - (150 + 2)}px;">
  <div style="display: flex;">
    ${getMainSidebarSrc()}
    <div style="width: ${WIDTH - 500}px;"></div>
  </div>
</div>
`;

const getInputSrc = (inputText, inputPlaceholder, inputValue, focus, onclick) => `\
<div style='position: relative; height: 100px; width ${WIDTH - (500 + 40)}px; font-size: 72px; line-height: 1.4;'>
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

const getWorldsPageSrc = ({worlds, selectedName, inputText, inputValue, focusType}) => {
  const renamingName = (() => {
    const match = focusType.match(/^worlds:rename:(.+)$/);
    return match ? match[1] : '';
  })();

  return `\
${getHeaderSrc('worlds', '', getWorldsButtonsSrc(selectedName), true)}
<div style="height: ${HEIGHT - (150 + 2)}px;">
  <div style="display: flex;">
    ${getWorldsSidebarSrc()}
    <div style="width: ${WIDTH - 500}px; clear: both;">
      <h1 style="border-bottom: 2px solid #333; font-size: 50px;">Local worlds</h1>
      ${getItemsSrc(worlds, selectedName, renamingName, inputText, inputValue, 'Enter new name', 'world')}
      <div style="display: flex; margin: 20px 0; float: left; clear: both; font-size: 32px; align-items: center;">
        ${focusType !== 'worlds:create' ? `\
          <a style="display: flex; height: 60px; padding: 0 10px; border: 2px solid #d9534f; border-radius: 5px; color: #d9534f; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="worlds:create">+ Create World</a>
`
        : `\
          <a style="display: flex; position: relative; width: ${(WIDTH - 500) / 3}px; height: 60px; background-color: #EEE; border-radius: 5px; text-decoration: none; align-items: center; overflow: hidden; box-sizing: border-box;">
            <div style="position: absolute; width: 2px; top: 0; bottom: 12px; left: ${inputValue}px; background-color: #333;"></div>
            <div>${inputText}</div>
            ${!inputText ? `<div style="color: #CCC;">Enter world name</div>` : ''}
          </a>
`
        }
    </div>
    </div>
  </div>
</div>
`;
};

const getModsPageSrc = ({mods, localMods, remoteMods, tab, inputText, inputValue, loadingLocal, loadingRemote, focus}) => {
  const content = (() => {
    if (tab === 'installed') {
      return `\
<h1 style="border-bottom: 2px solid #333; font-size: 50px;">Installed mods</h1>
${getItemsSrc(mods, '', '', '', '', '', 'mod')}
`;
    } else if (tab === 'local') {
      if (loadingLocal) {
        return `<h1 style="font-size: 50px;">Loading...</h1>`;
      } else {
        return `\
<h1 style="border-bottom: 2px solid #333; font-size: 50px;">Local mods</h1>
${getItemsSrc(localMods, '', '', '', '', '', 'mod')}
`;
      }
    } else if (tab === 'remote') {
      if (loadingRemote) {
        return `<h1 style="font-size: 50px;">Loading...</h1>`;
      } else {
        return `\
${getInputSrc(inputText, 'Search npm', inputValue, focus, 'mods:input')}
<h1 style="border-bottom: 2px solid #333; font-size: 50px;">Search results</h1>
${getItemsSrc(remoteMods, '', '', '', '', '', 'mod')}
`;
      }
    } else {
      return null;
    }
  })();

  return `\
${getHeaderSrc('plugins', '', '', true)}
<div style="height: ${HEIGHT - (150 + 2)}px;">
  <div style="display: flex;">
    ${getModsSidebarSrc(tab)}
    <div style="width: ${WIDTH - 500}px; margin: 40px 0; clear: both;">
      ${content}
    </div>
  </div>
</div>
`;
};

const getItemsSrc = (items, selectedName, renamingName, inputText, inputValue, inputPlaceholder, prefix) => {
  return (items.length > 0) ?
    `<div style="width: inherit; float: left; clear: both;">
      ${items.map(item => getItemSrc(item, selectedName, renamingName, inputText, inputValue, inputPlaceholder, prefix)).join('\n')}
    </div>`
    :
      `<h2 style="font-size: 40px; color: #CCC;">Nothing here...</h2>`;
};

const getItemSrc = (item, selectedName, renamingName, inputText, inputValue, inputPlaceholder, prefix) => {
  const {name} = item;
  const displayName = item.displayName || name;
  const selected = name === selectedName;
  const style = selected ? 'background-color: #EEE;' : '';
  const renaming = name === renamingName;

  return `\
<a style="display: inline-flex; width: ${(WIDTH - 500) / 3}px; float: left; ${style}; text-decoration: none; overflow: hidden;" onclick="${prefix}:${name}">
  <img src="${creatureUtils.makeStaticCreature(prefix + ':' + displayName)}" width="100" height="100" style="image-rendering: pixelated;" />
  <div style="width: ${((WIDTH - 500) / 3) - (20 + 100)}px;">
    ${!renaming ? `\
<div style="width: 100%; font-size: 32px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${displayName}</div>
<div style="display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; width: 100%; height: ${20 * 1.4 * 2}px; font-size: 20px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis;">${item.description}</div>
`   :
      `\
<div style="position: relative; width: 100%; background-color: #EEE; border-radius: 5px; font-size: 32px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
  <div>${inputText}</div>
  ${!inputText ? `<div style="color: #CCC;">${inputPlaceholder}</div>` : ''}
  <div style="position: absolute; width: 2px; top: 0; bottom: 10px; left: ${inputValue}px; background-color: #333;"></div>
</div>
`
  }
  </div>
</a>`;
};

const getModPageSrc = ({modName, mod, installed, conflicting}) => {
  const displayName = modName.match(/([^\/]*)$/)[1];

  return `\
${getHeaderSrc(displayName, mod ? ('v' + mod.version) : '', mod ? getGetButtonSrc(mod.name, installed, conflicting) : '', true)}
<div style="height: ${HEIGHT - (150 + 2)}px;">
  <div style="display: flex;">
    ${getModSidebarSrc()}
  </div>
</div>
`;
};

const getModPageReadmeSrc = ({modName, mod, loading}) => {
  const content = (() => {
    if (loading) {
      return `<h1 style="font-size: 50px;">Loading...</h1>`;
    } else {
      const displayName = modName.match(/([^\/]*)$/)[1];
      const readme = mod.readme || ('<h1>No readme for `' + displayName + (mod ? ('@' + mod.version) : '') + '`</h1>');
      return readme;
    }
  })();

  return `\
<div style="position: absolute; top: 0; right: 0; height: 50px; width: 50px; background-color: red;"></div>
<div style="position: absolute; top: 0; right: 50px; height: 100px; width: 50px; background-color: red;"></div>
<div style="position: absolute; top: 0; right: 100px; height: 125px; width: 50px; background-color: red;"></div>
<div style="position: absolute; top: 0; right: 150px; height: 150px; width: 50px; background-color: red;"></div>
${content}
`;
};

const getConfigPageSrc = () => `\
${getHeaderSrc('preferences', '', '', true)}
<div style="height: ${HEIGHT - (150 + 2)}px;">
  <div style="display: flex;">
    ${getConfigSidebarSrc()}
  </div>
</div>
`;

const getConfigPageContentSrc = ({inputText, inputValue, focus, sliderValue, airlockCheckboxValue, voiceChatCheckboxValue, statsCheckboxValue}) => `\
<div style="width: ${WIDTH - (500 + 40)}px; margin: 40px 0; padding-right: 40px;">
  ${getInputSrc(inputText, '', inputValue, focus, 'config:input')}
  ${getSliderSrc(sliderValue)}
  ${getCheckboxSrc('Airlock', airlockCheckboxValue, 'config:airlock')}
  ${getCheckboxSrc('Voice chat', voiceChatCheckboxValue, 'config:voiceChat')}
  ${getCheckboxSrc('Stats', statsCheckboxValue, 'config:stats')}
</div>
`;

const getElementsPageSrc = ({selectedKeyPath}) => `\
${getHeaderSrc('elements', '', getElementsButtonsSrc(selectedKeyPath), true)}
<div style="height: ${HEIGHT - (150 + 2)}px;">
  <div style="display: flex;">
    ${getElementsSidebarSrc()}
    <div style="width: ${WIDTH - 500}px;"></div>
  </div>
</div>
`;

const getElementsPageContentSrc = ({elements, selectedKeyPath, draggingKeyPath}) => `\
<div style="display: flex; flex-direction: column; width: ${WIDTH - (500 + 600)}px; min-height: ${HEIGHT - (150 + 2)}px; padding-left: 30px; border-left: 2px solid #333; border-right: 2px solid #333; overflow-x: hidden; overflow-y: visible; box-sizing: border-box;">
  <h1 style="margin: 10px 0; font-size: 40px;">World</h1>
  ${getElementsSrc(elements, ['elements'], selectedKeyPath, draggingKeyPath)}
  <p style="width: ${WIDTH - (500 + 600 + 30 + 30)}px; padding: 5px; background-color: #EEE; border-radius: 5px; font-family: Menlo; box-sizing: border-box;">These elements are currently active in the world. Click one to adjust its properties. Drag to move. <a href="#">Add new element</a> or drag it in.</p>
</div>
`;

const getElementsPageSubcontentSrc = ({elements, availableElements, clipboardElements, selectedKeyPath, draggingKeyPath, positioningName, inputText, inputValue, focusAttribute}) => {
  const element = menuUtils.getStateKeyPath({elements, availableElements, clipboardElements}, selectedKeyPath);

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

const getElementAttributesSrc = (element, positioningName, inputText, inputValue, focusAttribute) => {
  let result = '';

  const {attributes} = element;
  for (const name in attributes) {
    const attribute = attributes[name];
    const {type, value, min, max, step, options} = attribute;
    const focus = name === focusAttribute;

    result += `\
<div style="display: flex; margin-bottom: 4px; font-size: 28px; line-height: 1.4; align-items: center;">
  <div style="width: ${200 - 30}px; padding-right: 30px; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;">${name}</div>
  ${getElementAttributeInput(name, type, value, min, max, step, options, positioningName, inputText, inputValue, focus)}
</div>
`;
  }

  return result;
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

const getElementsSrc = (elements, keyPath, selectedKeyPath, draggingKeyPath) => {
  const head = (element, keyPath, depth) => {
    const tag = anchorTag(keyPath);

    return `\
${spaces(depth)}\
<${tag} style="color: #a894a6; text-decoration: none;" onmousedown="${anchorOnmousedown(keyPath)}" onmouseup="${anchorOnmouseup(keyPath)}">\
&lt;\
<img src="${creatureUtils.makeStaticCreature('mod:' + element.tag)}" width="32" height="32" style="display: inline-block; position: relative; top: 8px; image-rendering: pixelated;" />\
${element.tag}\
${attributes(element)}\
&gt;\
</${tag}>\
`;
  };
  const tail = (element, keyPath, depth) => {
    const tag = anchorTag(keyPath);

    return `<${tag} style="color: #a894a6; text-decoration: none;" onmousedown="${anchorOnmousedown(keyPath)}" onmouseup="${anchorOnmouseup(keyPath)}">${spaces(depth)}&lt;/${element.tag}&gt;</${tag}>`;
  };
  const anchorTag = keyPath => (draggingKeyPath.length > 0 && menuUtils.isSubKeyPath(keyPath, draggingKeyPath)) ? 'span' : 'a';
  const anchorStyle = keyPath => {
    const style = (() => {
      if (menuUtils.keyPathEquals(keyPath, selectedKeyPath)) {
        const color = (() => {
          if (menuUtils.keyPathEquals(keyPath, draggingKeyPath)) {
            return '#DDD';
          } else {
            return '#EEE';
          }
        })();
        return `background-color: ${color}; border-radius: 5px;`;
      } else {
        return '';
      }
    })();
    return `display: inline-block; ${style};`;
  };
  const anchorOnmousedown = keyPath => `element:select:${keyPath.join(':')}`;
  const anchorOnmouseup = anchorOnmousedown;
  const attributes = element => {
    const {attributes} = element;

    const acc = [];
    for (const k in attributes) {
      const attribute = attributes[k];
      const {value: v} = attribute;
      acc.push(`<span style="color: #994500;">${k}</span>=<span style="color: #1a1aa6;">${JSON.stringify(v)}</span>`);
    }
    return acc.length > 0 ? (' ' + acc.join(' ')) : '';
  };

  const outerElements = (elements, keyPath) => `<div style="display: flex; flex-direction: column;">${innerElements(elements, keyPath)}</div>`;
  const spaces = depth => Array(depth + 1).join('&nbsp;&nbsp;');
  const innerElements = (elements, keyPath) => {
    let result = '';

    const hasDropHelper = keyPath => {
      const parentKeyPath = keyPath.slice(0, -1);

      return draggingKeyPath.length > 0 &&
        !menuUtils.isSubKeyPath(parentKeyPath, draggingKeyPath) &&
        !menuUtils.isAdjacentKeyPath(keyPath, draggingKeyPath);
    };

    result += elements.map((element, i) => {
      const depth = keyPath.length - 1;
      const childKeyPath = keyPath.concat(i);

      let result = '';

      if (hasDropHelper(childKeyPath)) {
        result += getDropHelperSrc(childKeyPath);
      }

      result += `<div style="${anchorStyle(childKeyPath)}">${head(element, childKeyPath, depth)}`;

      const {children} = element;
      if (children.length > 0) {
        result += `<div>${outerElements(children, childKeyPath)}</div>`;
      }

      result += `${tail(element, childKeyPath, (children.length > 0) ? depth : 0)}</div>`;

      return result;
    }).join('\n');

    const appendChildKeyPath = keyPath.concat(elements.length);
    if (hasDropHelper(appendChildKeyPath)) {
      result += getDropHelperSrc(appendChildKeyPath);
    }

    return result;
  };

  return `<div style="font-family: Menlo; font-size: 28px; line-height: 1.4; white-space: pre;">${outerElements(elements, keyPath)}</div>`;
};

const getDropHelperSrc = keyPath => `<a style="display: flex; margin: ${-(32 / 2)}px 0; width: 100%; height: 32px; align-items: center;" onmouseup="element:move:${keyPath.join(':')}"><div></div></a>`;

const getHeaderSrc = (text, subtext, rightText, backButton) => `\
<div style="height: 150px; border-bottom: 2px solid #333; clear: both; font-size: 107px; line-height: 1.4;">
  ${backButton ? `<a style="display: inline-block; width: 150px; float: left; text-align: center; text-decoration: none;" onclick="back">❮</a>` : ''}
  <span style="display: inline-block; width: 150px; height: 150px; margin-right: 30px; float: left;"></span>
  <h1 style="display: inline-block; margin: 0; float: left; font-size: inherit; line-height: inherit;">${text}</h1>
  ${subtext ? `<div style="display: inline-flex; height: 150px; margin-left: 20px; float: left; align-items: flex-end;">
    <h2 style="margin: 0; font-size: 60px; line-height: 110px;">${subtext}</h2>
  </div>` : ''}
  ${rightText ? `<div style="float: right;">
    ${rightText}
  </div>` : ''}
</div>
`;

const getSubcontentSectionSrc = (headingSrc, buttonSrc, contentSrc, paragraphSrc) => `\
<div style="margin: 10px 0;">
  ${headingSrc ? `<div style="display: inline-block; float: left;">
    <h1 style="margin: 0; font-size: 40px;">${headingSrc}</h1>
  </div>` : ''}
  ${buttonSrc ? `<div style="float: right;">
    <div style="display: flex; height: 40px; margin: 6px 0; align-items: center;">
      ${buttonSrc}
    </div>
  </div>` : ''}
</div>
${contentSrc}
${paragraphSrc ? `<p style="width: ${600 - (30 + 30)}px; padding: 5px; background-color: #EEE; border-radius: 5px; font-family: Menlo; box-sizing: border-box;">${paragraphSrc}</p>` : ''}
`;

const getFilesPageSrc = ({cwd, files, inputText, inputValue, selectedName, clipboardPath, loading, uploading, focusType, prefix}) => {
  const content = (() => {
    if (loading) {
      return `<h1 style="font-size: 50px;">Loading...</h1>`;
    } else if (uploading) {
      return `<h1 style="font-size: 50px;">Uploading...</h1>`;
    } else {
      const renamingName = (() => {
        const match = focusType.match(/^(.+?)s:rename:(.+?)$/);

        if (match && match[1] === prefix) {
          return match[2];
        } else {
          return '';
        }
      })();

      return `\
${(cwd !== '/') ?
  `<h1 style="border-bottom: 2px solid #333; font-size: 50px;">Go back</h1>
  ${getItemsSrc([
    {
      name: '..',
      description: '',
    }
  ], selectedName, '', '', '', '', prefix)}`
:
  ''
}
<h1 style="border-bottom: 2px solid #333; font-size: 50px;">Contents of ${cwd}</h1>
${getItemsSrc(files, selectedName, renamingName, inputText, inputValue, 'Enter new name', prefix)}
<div style="display: flex; margin: 20px 0; float: left; clear: both; font-size: 32px; align-items: center;">
  ${(focusType !== (prefix + 's:createdirectory')) ? `\
    <a style="display: flex; height: 60px; padding: 0 10px; border: 2px solid #d9534f; border-radius: 5px; color: #d9534f; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="${prefix}s:createdirectory">+ Directory</a>
`
  : `\
    <a style="display: flex; position: relative; width: ${(WIDTH - 500) / 3}px; height: 60px; background-color: #EEE; border-radius: 5px; text-decoration: none; align-items: center; overflow: hidden; box-sizing: border-box;">
      <div style="position: absolute; width: 2px; top: 0; bottom: 12px; left: ${inputValue}px; background-color: #333;"></div>
      <div>${inputText}</div>
      ${!inputText ? `<div style="color: #CCC;">Enter directory name</div>` : ''}
    </a>
`
  }
</div>
<p style="width: 100%; padding: 5px; float: left; clear: both; background-color: #EEE; border-radius: 5px; box-sizing: border-box;">Click a file to cut, copy, paste, rename, and remove. Click a directory to navigate.<br/>Drag files into the window to upload. Uploaded files will be placed in the current working directory.</p>
`;
    }
  })();

  return `\
${getHeaderSrc('filesystem', '', getFilesButtonsSrc(selectedName, clipboardPath, prefix), true)}
<div style="height: ${HEIGHT - (150 + 2)}px;">
  <div style="display: flex;">
    ${getFilesSidebarSrc()}
    <div style="width: ${WIDTH - 500}px; clear: both;">
      ${content}
    </div>
  </div>
</div>
`;
};

const getMainSidebarSrc = () => `\
<div style="width: 500px; padding: 0 40px; font-size: 36px; box-sizing: border-box;">
  <a style="text-decoration: none;" onclick="worlds"><p>World</p></a>
  <a style="text-decoration: none;" onclick="mods"><p>Plugins</p></a>
  <a style="text-decoration: none;" onclick="elements"><p>Elements</p></a>
  <a style="text-decoration: none;" onclick="files"><p>Filesystem</p></a>
  <a style="text-decoration: none;" onclick="config"><p>Preferences</p></a>
</div>`;

const getWorldsSidebarSrc = () => `\
<div style="width: 500px; padding: 0 40px; font-size: 36px; box-sizing: border-box;">
  <a style="text-decoration: none;" onclick="blank"><p>Create world</p></a>
  <a style="text-decoration: none;" onclick="blank"><p>Modify world</p></a>
  <a style="text-decoration: none;" onclick="blank"><p>Remove world</p></a>
</div>`;

const getModsSidebarSrc = tab => {
  const tabStyle = t => {
    let result = 'padding-left: 30px; border-left: 10px solid transparent;';
    if (t === tab) {
      result += 'border-left-color: #333;';
    }
    return result;
  };
  return `\
<div style="width: 500px; padding: 0 40px; font-size: 36px; box-sizing: border-box;">
  <a style="text-decoration: none;" onclick="mods:installed"><p style="${tabStyle('installed')}">Installed mods</p></a>
  <a style="text-decoration: none;" onclick="mods:local"><p style="${tabStyle('local')}">Local mods</p></a>
  <a style="text-decoration: none;" onclick="mods:remote"><p style="${tabStyle('remote')}">Npm search</p></a>
</div>
`;
};

const getModSidebarSrc = () => `\
<div style="width: 500px; padding: 0 40px; font-size: 36px; box-sizing: border-box;">
  <a style="text-decoration: none;" onclick="blank"><p>Install mod</p></a>
  <a style="text-decoration: none;" onclick="blank"><p>Remove mod</p></a>
  <a style="text-decoration: none;" onclick="blank"><p>Configure mod</p></a>
</div>`;

const getConfigSidebarSrc = () => `\
<div style="width: 500px; padding: 0 40px; font-size: 36px; box-sizing: border-box;">
  <a style="text-decoration: none;" onclick="blank"><p>Preferences</p></a>
  <a style="text-decoration: none;" onclick="blank"><p>About</p></a>
</div>`;

const getElementsSidebarSrc = () => `\
<div style="width: 500px; padding: 0 40px; font-size: 36px; box-sizing: border-box;">
  <a style="text-decoration: none;" onclick="blank"><p>Tree</p></a>
  <a style="text-decoration: none;" onclick="blank"><p>Zoom in</p></a>
  <a style="text-decoration: none;" onclick="blank"><p>Zoom out</p></a>
</div>`;

const getFilesSidebarSrc = () => `\
<div style="width: 500px; padding: 0 40px; font-size: 36px; box-sizing: border-box;">
  <a style="text-decoration: none;" onclick="blank"><p>Installed mod</p></a>
  <a style="text-decoration: none;" onclick="blank"><p>Available mods</p></a>
  <a style="text-decoration: none;"  onclick="blank"><p>Search mods</p></a>
</div>`;

const getWorldsButtonsSrc = selectedName => `\
<div style="display: flex; height: 150px; margin: 0 30px; align-items: center;">
  ${selectedName ? `\
<a style="margin-left: 20px; padding: 5px 20px; border: 3px solid #5cb85c; border-radius: 5px; font-size: 30px; color: #5cb85c; text-decoration: none;" onclick="worlds:rename">Rename</a>
<a style="margin-left: 20px; padding: 5px 20px; border: 3px solid #d9534f; border-radius: 5px; font-size: 30px; color: #d9534f; text-decoration: none;" onclick="worlds:remove">Remove</a>
`
  :
    ''
  }
</div>
`;

const getGetButtonSrc = (name, installed, conflicting) => `\
<div style="display: flex; height: 150px; margin: 0 30px; align-items: center;">
  ${installed ? (
   `<div style="font-size: 50px; margin-right: 30px;">✓ Installed</div>
    <a style="padding: 10px 40px; border: 3px solid #d9534f; border-radius: 5px; font-size: 50px; color: #d9534f; text-decoration: none;" onclick="removemod:${name}">× Remove</a>`
  ) : (
    conflicting ? (
      `<div style="font-size: 50px; color: #d9534f;">>× Cannot install: name conflict</div>`
    ) : (
      `<a style="padding: 10px 40px; background-color: #5cb85c; border-radius: 5px; font-size: 50px; color: #FFF; text-decoration: none;" onclick="getmod:${name}">+ Get</a>`
    )
  )}
</div>`;

const getElementsButtonsSrc = (selectedKeyPath) => `\
<div style="display: flex; height: 150px; margin: 0 30px; align-items: center;">
  ${(selectedKeyPath.length > 0 && (selectedKeyPath[0] === 'elements' || selectedKeyPath[0] === 'clipboardElements')) ?
    `<a style="padding: 5px 20px; border: 3px solid #d9534f; border-radius: 5px; font-size: 30px; color: #d9534f; text-decoration: none;" onclick="elements:remove">× Remove</a>`
  :
    ''
  }
</div>`;

const getFilesButtonsSrc = (selectedName, clipboardPath, prefix) => `\
<div style="display: flex; height: 150px; margin: 0 30px; align-items: center;">
  ${(prefix === 'elementAttributeFile' && selectedName) ? `\
<a style="margin-left: 20px; padding: 5px 20px; border: 3px solid #0275d8; border-radius: 5px; font-size: 30px; color: #0275d8; text-decoration: none;" onclick="${prefix}s:select">Select</a>
`
  :
    ''
  }
  ${selectedName ? `\
<a style="margin-left: 20px; padding: 5px 20px; border: 3px solid #d9534f; border-radius: 5px; font-size: 30px; color: #d9534f; text-decoration: none;" onclick="${prefix}s:cut">Cut</a>
<a style="margin-left: 20px; padding: 5px 20px; border: 3px solid #5cb85c; border-radius: 5px; font-size: 30px; color: #5cb85c; text-decoration: none;" onclick="${prefix}s:copy">Copy</a>
`
  :
    ''
  }
  ${clipboardPath ? `\
<a style="margin-left: 20px; padding: 5px 20px; border: 3px solid #0275d8; border-radius: 5px; font-size: 30px; color: #0275d8; text-decoration: none;" onclick="${prefix}s:paste">Paste</a>
`
  :
    ''
  }
  ${selectedName ? `\
<a style="margin-left: 20px; padding: 5px 20px; border: 3px solid #0275d8; border-radius: 5px; font-size: 30px; color: #0275d8; text-decoration: none;" onclick="${prefix}s:rename">Rename</a>
<a style="margin-left: 20px; padding: 5px 20px; border: 3px solid #d9534f; border-radius: 5px; font-size: 30px; color: #d9534f; text-decoration: none;" onclick="${prefix}s:remove">Remove</a>
`
  :
    ''
  }
</div>
`;

const getNavbarSrc = ({tab}) => {
  const focusedContent = label => `\
    <div style="position: absolute; top: 0; left: 0; border-width: 50px 25px 0 0; border-style: solid; border-color: transparent #000 transparent transparent;"></div>
    <div style="position: absolute; top: 0; left: 1px; border-width: 50px 25px 0 0; border-style: solid; border-color: transparent #FFF transparent transparent;"></div>
    <div style="position: absolute; top: 0; right: 0; border-width: 50px 0 0 25px; border-style: solid; border-color: transparent transparent transparent #000;"></div>
    <div style="position: absolute; top: 0; right: 1px; border-width: 50px 0 0 25px; border-style: solid; border-color: transparent transparent transparent #FFF;"></div>
    <div style="display: flex; position: relative; width: 150px; background-color: #FFF; border-top: 1px solid #000; justify-content: center; align-items: center;">${label}</div>
    <div style="position: absolute; top: 0; left: 25px; right: 25px; border-top: 1px solid #000;"></div>
  `;
  const unfocusedContent = label => `\
    <div style="position: absolute; top: 0; left: 0; border-width: 50px 25px 0 0; border-style: solid; border-color: transparent #000 transparent transparent;"></div>
    <div style="position: absolute; top: 0; left: 1px; border-width: 50px 25px 0 0; border-style: solid; border-color: transparent #EEE transparent transparent;"></div>
    <div style="position: absolute; top: 0; right: 0; border-width: 50px 0 0 25px; border-style: solid; border-color: transparent transparent transparent #000;"></div>
    <div style="position: absolute; top: 0; right: 1px; border-width: 50px 0 0 25px; border-style: solid; border-color: transparent transparent transparent #EEE;"></div>
    <div style="display: flex; position: relative; width: 150px; background-color: #EEE; justify-content: center; align-items: center;">${label}</div>
    <div style="position: absolute; top: 0; left: 25px; right: 25px; border-top: 1px solid #000;"></div>
    <div style="position: absolute; bottom: 0; left: 0; right: 0; border-bottom: 1px solid #000;"></div>
  `;

  return `\
    <div style="display: flex; width: 1024px; height: 50px; background-color: #000;">
      <div style="position: absolute; left: 0; right: 0; bottom: 0; border-bottom: 1px solid #000;"></div>
      <a style="display: flex; position: relative; width: 200px; height: 100%; justify-content: center; align-items: stretch; font-size: 24px; text-decoration: none; ${tab === 'readme' ? 'z-index: 1;' : ''}" onclick="navbar:readme">
        ${tab === 'readme' ? focusedContent('Readme') : unfocusedContent('Readme')}
      </a>
      <a style="display: flex; position: relative; width: 200px; height: 100%; margin-left: -25px; justify-content: center; align-items: stretch; font-size: 24px; text-decoration: none; box-sizing: border-box; ${tab === 'multiverse' ? 'z-index: 1;' : ''}" onclick="navbar:multiverse">
        ${tab === 'multiverse' ? focusedContent('Multiverse') : unfocusedContent('Multiverse')}
      </a>
      <a style="display: flex; position: relative; width: 200px; height: 100%; margin-left: -25px; justify-content: center; align-items: stretch; font-size: 24px; text-decoration: none; box-sizing: border-box; ${tab === 'world' ? 'z-index: 1;' : ''}" onclick="navbar:world">
        ${tab === 'world' ? focusedContent('World') : unfocusedContent('World')}
      </a>
      <a style="display: flex; position: relative; width: 200px; height: 100%; margin-left: -25px; justify-content: center; align-items: stretch; font-size: 24px; text-decoration: none; box-sizing: border-box; ${tab === 'inventory' ? 'z-index: 1;' : ''}" onclick="navbar:inventory">
        ${tab === 'inventory' ? focusedContent('Inventory') : unfocusedContent('Inventory')}
      </a>
      <a style="display: flex; position: relative; width: 200px; height: 100%; margin-left: -25px; justify-content: center; align-items: stretch; font-size: 24px; text-decoration: none; box-sizing: border-box; ${tab === 'options' ? 'z-index: 1;' : ''}" onclick="navbar:options">
        ${tab === 'options' ? focusedContent('Options') : unfocusedContent('Options')}
      </a>
    </div>
  `;
};

return {
  getMainPageSrc,
  getInputSrc,
  getSliderSrc,
  getCheckboxSrc,
  getWorldsPageSrc,
  getModsPageSrc,
  getItemsSrc,
  getItemSrc,
  getModPageSrc,
  getModPageReadmeSrc,
  getConfigPageSrc,
  getConfigPageContentSrc,
  getElementsPageSrc,
  getElementsPageContentSrc,
  getElementsPageSubcontentSrc,
  getElementAttributesSrc,
  getElementAttributeInput,
  getElementsSrc,
  getDropHelperSrc,
  getHeaderSrc,
  getSubcontentSectionSrc,
  getFilesPageSrc,
  getMainSidebarSrc,
  getWorldsSidebarSrc,
  getModsSidebarSrc,
  getModSidebarSrc,
  getConfigSidebarSrc,
  getElementsSidebarSrc,
  getFilesSidebarSrc,
  getWorldsButtonsSrc,
  getGetButtonSrc,
  getFilesButtonsSrc,
  getNavbarSrc,
};

};

module.exports = {
  makeRenderer,
};
