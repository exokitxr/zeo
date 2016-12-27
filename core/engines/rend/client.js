import whatkey from 'whatkey';
import prettyBytes from 'pretty-bytes';

const WIDTH = 2 * 1024;
const HEIGHT = WIDTH / 1.5;
const ASPECT_RATIO = WIDTH / HEIGHT;

const MENU_SIZE = 2;
const WORLD_WIDTH = MENU_SIZE;
const WORLD_HEIGHT = WORLD_WIDTH / ASPECT_RATIO;
const WORLD_DEPTH = MENU_SIZE / 50;

class Rend {
  constructor(archae) {
    this._archae = archae;

    this.updates = [];
    this.updateEyes = [];
  }

  mount() {
    const {_archae: archae, updates, updateEyes} = this;

    let live = true;
    const cleanups = [];
    this._cleanup = () => {
      live = false;

      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    return Promise.all([
      archae.requestEngines([
        '/core/engines/input',
        '/core/engines/three',
        '/core/engines/biolumi',
        '/core/engines/npm',
        '/core/engines/fs',
        '/core/engines/bullet',
        '/core/engines/heartlink',
      ]),
      archae.requestPlugins([
        '/core/plugins/creature-utils',
      ]),
    ]).then(([
      [
        input,
        three,
        biolumi,
        npm,
        fs,
        bullet,
        heartlink,
      ],
      [creatureUtils],
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;

        const transparentImg = biolumi.getTransparentImg();
        const maxNumTextures = biolumi.getMaxNumTextures();

        const worlds = new Map();
        let currentWorld = null;
        const mods = new Map();
        let currentMods = null;
        let currentMainReadme = null;

        cleanups.push(() => {
          worlds.forEach(world => {
            world.destroy();
          });
        });

        const _getCurrentWorld = () => currentWorld;
        const _requestChangeWorld = worldName => new Promise((accept, reject) => {
          const world = worlds.get(worldName);

          if (world) {
            currentWorld = world;
            currentMods = mods.get(worldName);

            accept();
          } else {
            const _requestMainReadme = worldName => fetch('/archae/rend/readme').then(res => res.text());
            const _requestModsStatus = worldName => fetch('/archae/rend/mods/status', {
              method: 'POST',
              headers: (() => {
                const headers = new Headers();
                headers.set('Content-Type', 'application/json');
                return headers;
              })(),
              body: JSON.stringify({
                world: worldName,
              }),
            }).then(res => res.json());

            Promise.all([
              _requestMainReadme(),
              _requestModsStatus(worldName),
              bullet.requestWorld(worldName),
            ])
              .then(([
                mainReadme,
                modsStatus,
                physics,
              ]) => {
                const player = heartlink.getPlayer(); // XXX make this per-world

                // plugin managemnent
                const plugins = new Map();

                const startTime = Date.now();
                let worldTime = 0;
                const _addUpdate = update => {
                  updates.push(update);
                };
                const _addUpdateEye = updateEye => {
                  updateEyes.push(updateEye);
                };

                _addUpdate(() => {
                  // update state
                  const now = Date.now();
                  worldTime = now - startTime;

                  // update plugins
                  plugins.forEach(plugin => {
                    if (typeof plugin.update === 'function') {
                      plugin.update();
                    }
                  });
                });
                _addUpdateEye(camera => {
                  // update plugins per eye
                  plugins.forEach(plugin => {
                    if (typeof plugin.updateEye === 'function') {
                      plugin.updateEye(camera);
                    }
                  });
                });

                const _getWorldTime = () => worldTime;
                const _requestAddMod = mod => fetch('/archae/rend/mods/add', {
                  method: 'POST',
                  headers: (() => {
                    const headers = new Headers();
                    headers.set('Content-Type', 'application/json');
                    return headers;
                  })(),
                  body: JSON.stringify({
                    world: worldName,
                    mod: mod,
                  }),
                }).then(res => res.text()
                  .then(() => {
                    const m = modsStatus.find(m => m.name === mod);
                    m.installed = true;
                  })
                  .then(() => _requestMod('/extra/plugins/zeo/' + mod))
                );
                const _requestAddMods = mods => Promise.all(mods.map(_requestAddMod));
                const _requestMod = mod => archae.requestPlugin(mod)
                  .then(plugin => {
                    const pluginName = archae.getName(plugin);
                    plugins.set(pluginName, plugin);

                    return plugin;
                  });
                const _requestMods = mods => Promise.all(mods.map(_requestMod));
                const _requestRemoveMod = mod => fetch('/archae/rend/mods/remove', {
                  method: 'POST',
                  headers: (() => {
                    const headers = new Headers();
                    headers.set('Content-Type', 'application/json');
                    return headers;
                  })(),
                  body: JSON.stringify({
                    world: worldName,
                    mod: mod,
                  }),
                }).then(res => res.text()
                  .then(() => {
                    const m = modsStatus.find(m => m.name === mod);
                    m.installed = false;
                  })
                  .then(() => _requestReleaseMod('/extra/plugins/zeo/' + mod))
                );
                const _requestRemoveMods = mods => Promise.all(mods.map(_requestRemoveMod));
                const _requestReleaseMod = mod => archae.releasePlugin(mod)
                  .then(plugin => {
                    const pluginName = archae.getName(plugin);
                    plugins.delete(pluginName);

                    return plugin;
                  });
                const _requestReleaseMods = mods => Promise.all(mods.map(_requestReleaseMod));
                const _requestWorker = (module, options) => archae.requestWorker(module, options);
                const _destroy = () => {
                  if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                  }
                };

                Promise.resolve()
                  .then(() => _requestMods(modsStatus.filter(mod => mod.installed).map(mod => '/extra/plugins/zeo/' + mod.name)))
                  .then(() => {
                    console.log('initial mods loaded');
                  })
                  .catch(err => {
                    console.warn(err);
                  });

                const world = {
                  name: worldName,
                  getWorldTime: _getWorldTime,
                  requestAddMod: _requestAddMod,
                  requestAddMods: _requestAddMods,
                  requestMod: _requestMod,
                  requestMods: _requestMods,
                  requestRemoveMod: _requestRemoveMod,
                  requestRemoveMods: _requestRemoveMods,
                  requestReleaseMod: _requestReleaseMod,
                  requestReleaseMods: _requestReleaseMods,
                  requestWorker: _requestWorker,
                  addUpdate: _addUpdate,
                  addUpdateEye: _addUpdateEye,
                  physics,
                  player,
                  destroy: _destroy,
                };

                worlds.set(worldName, world);
                currentWorld = world;

                mods.set(worldName, modsStatus);
                currentMods = modsStatus;

                currentMainReadme = mainReadme;

                accept();
              });
          }
        });
        const _requestDeleteWorld = worldName => new Promise((accept, reject) => {
          accept();
          /* bullet.releaseWorld(worldName)
            .then(() => {
              worlds.delete(worldName);
              mods.delete(worldName);

              if (currentWorld && currentWorld.name === worldName) {
                currentWorld = null;
                currentMods = null;
              }

              accept();
            })
            .catch(reject); */
        });

        const worldName = 'proteus';
        const _initializeWorld = () => _requestDeleteWorld(worldName)
          .then(() => {
            if (live) {
              return _requestChangeWorld(worldName);
            }
          });
        const _initializeMenu = () => {
          if (live) {
            const mainFontSpec = {
              fonts: biolumi.getFonts(),
              fontSize: 72,
              lineHeight: 1.4,
              fontWeight: biolumi.getFontWeight(),
              fontStyle: biolumi.getFontStyle(),
            };
            const subcontentFontSpec = {
              fonts: biolumi.getFonts(),
              fontSize: 28,
              lineHeight: 1.4,
              fontWeight: biolumi.getFontWeight(),
              fontStyle: biolumi.getFontStyle(),
            };

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
<div style='position: relative; height: 100px; width ${WIDTH - (500 + 40)}px; font-size: ${mainFontSpec.fontSize}px; line-height: ${mainFontSpec.lineHeight};'>
  <a style='display: block; position: absolute; top: 0; bottom: 0; left: 0; right: 0; background-color: #F0F0F0; border-radius: 10px; text-decoration: none;' onclick="${onclick}">
    ${focus ? `<div style="position: absolute; width: 2px; top: 0; bottom: 20px; left: ${inputValue}px; background-color: #333;"></div>` : ''}
    <div>${inputText}</div>
    ${!inputText ? `<div style="color: #CCC;">${inputPlaceholder}</div>` : ''}
  </a>
</div>
`;
            const getSliderSrc = sliderValue => `\
<div style="position: relative; width ${WIDTH - (500 + 40)}px; height: 100px;">
  <a style="display: block; position: absolute; top: 0; bottom: 0; left: 0; right: 0;" onclick="config:resolution">
    <div style="position: absolute; top: 40px; left: 0; right: 0; height: 10px; background-color: #CCC;">
      <div style="position: absolute; top: -40px; bottom: -40px; left: ${sliderValue * (WIDTH - (500 + 40))}px; margin-left: -5px; width: 10px; background-color: #F00;"></div>
    </div>
  </a>
</div>
`;
            const getModsPageSrc = ({inputText, inputPlaceholder, inputValue, focus, mods}) => {
              const installedMods = mods.filter(mod => mod.installed);
              const availableMods = mods.filter(mod => !mod.installed);

              return `\
${getHeaderSrc('mods', '', '', true)}
<div style="height: ${HEIGHT - (150 + 2)}px;">
  <div style="display: flex;">
    ${getModsSidebarSrc()}
    <div style="width: ${WIDTH - 500}px; margin: 40px 0; clear: both;">
      ${getInputSrc(inputText, inputPlaceholder, inputValue, focus, 'mods:input')}
      <h1 style="border-bottom: 2px solid #333; font-size: 50px;">Installed mods</h1>
      ${getItemsSrc(installedMods, '', 'mod')}
      <h1 style="border-bottom: 2px solid #333; font-size: 50px;">Available mods</h1>
      ${getItemsSrc(availableMods, '', 'mod')}
    </div>
  </div>
</div>
`;
            };
            const getItemsSrc = (items, selectedName, prefix) =>
              (items.length > 0) ? `\
<div style="width: inherit; float: left; clear: both;">
  ${items.map(item => getItemSrc(item, selectedName, prefix)).join('\n')}
</div>
`
              :
                `<h2 style="font-size: 40px; color: #CCC;">Nothing here...</h2>`;
            const getItemSrc = (item, selectedName, prefix) => {
              const {name} = item;
              const selected = name === selectedName;
              const style = selected ? 'background-color: #EEE;' : '';

              return `\
<a style="display: inline-flex; width: ${(WIDTH - 500) / 3}px; float: left; ${style}; text-decoration: none; overflow: hidden;" onclick="${prefix}:${name}">
  <img src="${creatureUtils.makeStaticCreature('${prefix}:' + name)}" width="100" height="100" style="image-rendering: pixelated;" />
  <div style="width: ${((WIDTH - 500) / 3) - (20 + 100)}px;">
    <div style="font-size: 32px; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
    <div style="display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; width: 100%; height: ${20 * 1.4 * 2}px; font-size: 20px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis;">${item.description}</div>
  </div>
</a>`;
            };
            const getModPageSrc = ({name, version, installed}) => `\
${getHeaderSrc(name, 'v' + version, getGetButtonSrc(name, installed), true)}
<div style="height: ${HEIGHT - (150 + 2)}px;">
  <div style="display: flex;">
    ${getModSidebarSrc()}
  </div>
</div>
`;
            const getModPageReadmeSrc = ({readme}) => `\
<div style="position: absolute; top: 0; right: 0; height: 50px; width: 50px; background-color: red;"></div>
<div style="position: absolute; top: 0; right: 50px; height: 100px; width: 50px; background-color: red;"></div>
<div style="position: absolute; top: 0; right: 100px; height: 125px; width: 50px; background-color: red;"></div>
<div style="position: absolute; top: 0; right: 150px; height: 150px; width: 50px; background-color: red;"></div>
${readme}
`;
            const getConfigPageSrc = () => `\
${getHeaderSrc('preferences', '', '', true)}
<div style="height: ${HEIGHT - (150 + 2)}px;">
  <div style="display: flex;">
    ${getConfigSidebarSrc()}
  </div>
</div>
`;
            const getConfigPageContentSrc = ({inputText, inputPlaceholder, inputValue, focus, sliderValue}) => `\
<div style="width: ${WIDTH - (500 + 40)}px; margin: 40px 0; padding-right: 40px;">
  ${getInputSrc(inputText, inputPlaceholder, inputValue, focus, 'config:input')}
  ${getSliderSrc(sliderValue)}
</div>
`;
            const getElementsPageSrc = () => `\
${getHeaderSrc('elements', '', '', true)}
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
  <div style="display: flex; height: 40px; margin: 20px 0; align-items: center;">
    <a style="padding: 5px 10px; border: 2px solid #d9534f; border-radius: 5px; font-size: 24px; color: #d9534f; text-decoration: none;" onclick="element:add">+ Add</a>
  </div>
  <p style="width: ${WIDTH - (500 + 600 + 30 + 30)}px; padding: 5px; background-color: #EEE; border-radius: 5px; font-family: Menlo; box-sizing: border-box;">These elements are currently active in the world. Click one to adjust its properties. Drag to move. <a href="#">Add new element</a> or drag it in.</p>
</div>
`;
            const getElementsPageSubcontentSrc = ({elements, availableElements, clipboardElements, selectedKeyPath, draggingKeyPath, inputText, inputValue, focusAttribute}) => {
              const element = _getElementKeyPath({elements, availableElements, clipboardElements}, selectedKeyPath);

              return `\
<div style="display: flex; flex-direction: column; width: 600px; min-height: ${HEIGHT - (150 + 2)}px; padding-left: 30px; box-sizing: border-box;">
  ${selectedKeyPath.length > 0 ?
    `${getSubcontentSectionSrc(
      `\
<span style="color: #a894a6;">\
&lt;\
<img src="${creatureUtils.makeStaticCreature('mod:' + element.element)}" width="40" height="40" style="display: inline-block; position: relative; top: 8px; image-rendering: pixelated;" />\
${element.element}&gt; properties\
</span>\
`,
      null,
      getElementAttributesSrc(element, inputText, inputValue, focusAttribute),
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
    `<a style="padding: 5px 10px; background-color: #0275d8; border-radius: 5px; font-size: 24px; color: #FFF; text-decoration: none;">Clear</a>`,
    getElementsSrc(clipboardElements, ['clipboardElements'], selectedKeyPath, draggingKeyPath),
    `Drag-and-drop elements to the clipboad to save them. Drag inside the clipboard to copy.`
  )}
</div>
`;
            };
            const getElementAttributesSrc = (element, inputText, inputValue, focusAttribute) => {
              let result = '';

              const {attributes} = element;
              for (const name in attributes) {
                const attribute = attributes[name];
                const {type, value, min, max, options} = attribute;
                const focus = name === focusAttribute;

                result += `\
<div style="display: flex; margin-bottom: 4px; font-size: 28px; line-height: 1.4; align-items: center;">
  <div style="width: ${200 - 30}px; padding-right: 30px; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box;">${name}</div>
  ${getElementAttributeInput(name, type, value, min, max, options, inputText, inputValue, focus)}
</div>
`;
              }

              return result;
            };
            const getElementAttributeInput = (name, type, value, min, max, options, inputText, inputValue, focus) => {
              const focusValue = !focus ? value : _castValueStringToValue(inputText, type, min, max, options);

              switch (type) {
                case 'position': {
                  return `<div style="display: flex; width: 400px; height: 40px; justify-content: flex-end;">
                    <a style="display: flex; padding: 5px 10px; border: 2px solid #d9534f; border-radius: 5px; color: #d9534f; text-decoration: none; align-items: center; box-sizing: border-box;">Set</a>
                  </div>`;
                }
                case 'text': {
                  return `\
<a style="position: relative; width: 400px; height: 40px; background-color: #EEE; border-radius: 5px; text-decoration: none; overflow: hidden;" onclick="element:attribute:${name}:focus">
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
<a style="position: relative; width: ${400 - (100 + 20)}px; height: 40px; margin-right: 20px;" onclick="element:attribute:${name}:tweak">
  <div style="position: absolute; top: 19px; left: 0; right: 0; height: 2px; background-color: #CCC;">
    <div style="position: absolute; top: -14px; bottom: -14px; left: ${factor * 100}%; margin-left: -1px; width: 2px; background-color: #F00;"></div>
  </div>
</a>
<a style="position: relative; width: 100px; height: 40px; background-color: #EEE; border-radius: 5px; text-decoration: none; overflow: hidden;" onclick="element:attribute:${name}:focus">
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
<a style="display: flex; width: 400px; height: 40px; border: 2px solid #333; text-decoration: none; align-items: center; box-sizing: border-box;" onclick="element:attribute:${name}:focus">
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
      return `<a style="display: flex; width: 400px; height: 40px; border: 2px solid #333; ${style}; text-decoration: none; align-items: center; text-overflow: ellipsis; overflow: hidden; box-sizing: border-box;" onclick="element:attribute:${name}:set:${option}">
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
  <a style="position: relative; width: ${400 - (40 + 4)}px; height: 40px; background-color: #EEE; border-radius: 5px; text-decoration: none; overflow: hidden;" onclick="element:attribute:${name}:focus">
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
    `<a style="display: flex; width: 40px; height: 40px; justify-content: center; align-items: center;" onclick="element:attribute:${name}:toggle">
      <div style="display: flex; width: ${(20 * 2) - (3 * 2)}px; height: 20px; padding: 1px; border: 3px solid #333; justify-content: flex-end; align-items: center; box-sizing: border-box;">
        <div style="width: ${20 - ((3 * 2) + (1 * 2))}px; height: ${20 - ((3 * 2) + (1 * 2))}px; background-color: #333;"></div>
      </div>
    </a>`
  :
    `<a style="display: flex; width: 40px; height: 40px; justify-content: center; align-items: center;" onclick="element:attribute:${name}:toggle">
      <div style="display: flex; width: ${(20 * 2) - (3 * 2)}px; height: 20px; padding: 1px; border: 3px solid #CCC; justify-content: flex-start; align-items: center; box-sizing: border-box;">
        <div style="width: ${20 - ((3 * 2) + (1 * 2))}px; height: ${20 - ((3 * 2) + (1 * 2))}px; background-color: #CCC;"></div>
      </div>
    </a>`
  }
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
<img src="${creatureUtils.makeStaticCreature('mod:' + element.element)}" width="32" height="32" style="display: inline-block; position: relative; top: 8px; image-rendering: pixelated;" />\
${element.element}\
${attributes(element)}\
&gt;\
</${tag}>\
`;
              };
              const tail = (element, keyPath, depth) => {
                const tag = anchorTag(keyPath);

                return `<${tag} style="color: #a894a6; text-decoration: none;" onmousedown="${anchorOnmousedown(keyPath)}" onmouseup="${anchorOnmouseup(keyPath)}">${spaces(depth)}&lt;/${element.element}&gt;</${tag}>`;
              };
              const anchorTag = keyPath => (draggingKeyPath.length > 0 && _isSubKeyPath(keyPath, draggingKeyPath)) ? 'span' : 'a';
              const anchorStyle = keyPath => {
                const style = (() => {
                  if (_keyPathEquals(keyPath, selectedKeyPath)) {
                    const color = (() => {
                      if (_keyPathEquals(keyPath, draggingKeyPath)) {
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

                const hasDropHelper = draggingKeyPath.length > 0 && !_isSubKeyPath(keyPath, draggingKeyPath);

                result += elements.map((element, i) => {
                  const depth = keyPath.length - 1;
                  const childKeyPath = keyPath.concat(i);

                  let result = '';

                  if (hasDropHelper) {
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

                if (hasDropHelper) {
                  result += getDropHelperSrc(keyPath.concat(elements.length));
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
</div>`;
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
            const getFilesPageSrc = ({cwd, files, inputText, inputValue, selectedName, copiedName, loading, uploading, focus}) => {
              const content = (() => {
                if (loading) {
                  return `<h1 style="font-size: 50px;">Loading...</h1>`;
                } else if (uploading) {
                  return `<h1 style="font-size: 50px;">Uploading...</h1>`;
                } else {
                  return `\
${(cwd !== '/') ?
  `<h1 style="border-bottom: 2px solid #333; font-size: 50px;">Go back</h1>
  ${getItemsSrc([
    {
      name: '..',
      description: '',
    }
  ], selectedName, 'file')}`
:
  ''
}
<h1 style="border-bottom: 2px solid #333; font-size: 50px;">Contents of ${cwd}</h1>
${getItemsSrc(files, selectedName, 'file')}
<div style="display: flex; height: 50px; margin: 20px 0; float: left; clear: both; align-items: center;">
  <a style="padding: 5px 10px; border: 2px solid #d9534f; border-radius: 5px; font-size: 32px; color: #d9534f; text-decoration: none;" onclick="files:createdirectory">+ Directory</a>
</div>
<p style="width: 100%; padding: 5px; float: left; clear: both; background-color: #EEE; border-radius: 5px; box-sizing: border-box;">Click a file to cut, copy, paste, rename, and remove. Click a directory to navigate.<br/>Drag files into the window to upload. Uploaded files will be placed in the current working directory.</p>
`;
                }
              })();
              return `\
${getHeaderSrc('files', '', getCreateDirectoryButtonsSrc(selectedName, copiedName), true)}
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
            const getCreateDirectoryButtonsSrc = (selectedName, copiedName) => `\
<div style="display: flex; height: 150px; margin: 0 30px; align-items: center;">
  ${selectedName ? `\
<a style="margin-left: 30px; padding: 10px 40px; border: 3px solid #5cb85c; border-radius: 5px; font-size: 50px; color: #5cb85c; text-decoration: none;" onclick="files:cut:${selectedName}">Cut</a>
<a style="margin-left: 30px; padding: 10px 40px; border: 3px solid #5cb85c; border-radius: 5px; font-size: 50px; color: #5cb85c; text-decoration: none;" onclick="files:copy:${selectedName}">Copy</a>
`
  :
    ''
  }
  ${copiedName ? `\
<a style="margin-left: 30px; padding: 10px 40px; border: 3px solid #0275d8; border-radius: 5px; font-size: 50px; color: #0275d8; text-decoration: none;" onclick="files:paste:${selectedName}">Paste</a>
`
  :
    ''
  }
  ${selectedName ? `\
<a style="margin-left: 30px; padding: 10px 40px; border: 3px solid #0275d8; border-radius: 5px; font-size: 50px; color: #0275d8; text-decoration: none;" onclick="files:rename:${selectedName}">Rename</a>
<a style="margin-left: 30px; padding: 10px 40px; border: 3px solid #d9534f; border-radius: 5px; font-size: 50px; color: #d9534f; text-decoration: none;" onclick="files:remove:${selectedName}">Remove</a>
`
  :
    ''
  }
</div>
`;
            const getMainSidebarSrc = () => `\
<div style="width: 500px; padding: 0 40px; font-size: 36px; box-sizing: border-box;">
  <a style="text-decoration: none;" onclick="blank"><p>World</p></a>
  <a style="text-decoration: none;" onclick="mods"><p>Mods</p></a>
  <a style="text-decoration: none;" onclick="elements"><p>Elements</p></a>
  <a style="text-decoration: none;" onclick="files"><p>Filesystem</p></a>
  <a style="text-decoration: none;" onclick="config"><p>Preferences</p></a>
</div>`;
            const getModsSidebarSrc = () => `\
<div style="width: 500px; padding: 0 40px; font-size: 36px; box-sizing: border-box;">
  <a style="text-decoration: none;" onclick="blank"><p>Installed mod</p></a>
  <a style="text-decoration: none;" onclick="blank"><p>Available mods</p></a>
  <a style="text-decoration: none;"  onclick="blank"><p>Search mods</p></a>
</div>`;
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
            const getGetButtonSrc = (name, installed) => `\
<div style="display: flex; height: 150px; margin: 0 30px; align-items: center;">
  ${installed ?
   `<div style="font-size: 50px; margin-right: 30px;">✓ Installed</div>
    <a style="padding: 10px 40px; border: 3px solid #d9534f; border-radius: 5px; font-size: 50px; color: #d9534f; text-decoration: none;" onclick="removemod:${name}">× Remove</a>`
  :
    `<a style="padding: 10px 40px; background-color: #5cb85c; border-radius: 5px; font-size: 50px; color: #FFF; text-decoration: none;" onclick="getmod:${name}">+ Get</a>`
  }
</div>`;

            const _cleanMods = mods => mods.map(({name, description, installed}) => ({name, description, installed}));
            const _getKeyPath = (root, keyPath) => {
              const _recurse = (root, i) => {
                if (i === keyPath.length) {
                  return root;
                } else {
                  return _recurse(root.children[keyPath[i]], i + 1);
                }
              };
              return _recurse(root, 0);
            };
            const _getElementKeyPath = (spec, keyPath) => {
              const children = (() => {
                const result = {};
                for (const k in spec) {
                  result[k] = {
                    children: spec[k],
                  };
                }
                return result;
              })();
              return _getKeyPath({children}, keyPath);
            };
            const _moveElementKeyPath = (spec, oldKeyPath, newKeyPath) => {
              const oldKeyPathHead = oldKeyPath.slice(0, -1);
              const oldKeyPathTail = oldKeyPath[oldKeyPath.length - 1];
              const oldParentElement = _getElementKeyPath(spec, oldKeyPathHead);
              const element = oldParentElement.children[oldKeyPathTail];

              const newKeyPathHead = newKeyPath.slice(0, -1);
              const newKeyPathTail = newKeyPath[newKeyPath.length - 1];
              const newParentElement = _getElementKeyPath(spec, newKeyPathHead);
              newParentElement.children.splice(newKeyPathTail, 0, element);

              oldParentElement.children.splice(oldKeyPathTail + ((_keyPathEquals(newKeyPathHead, oldKeyPathHead) && newKeyPathTail <= oldKeyPathTail) ? 1 : 0), 1);
            };
            const _keyPathEquals = (a, b) => a.length === b.length && a.every((ai, i) => {
              const bi = b[i];
              return ai === bi;
            });
            const _isSubKeyPath = (a, b) => {
              return a.length >= b.length && b.every((bi, i) => {
                const ai = a[i];
                return bi === ai;
              });
            };
            const _parseKeyPath = s => s.split(':').map(p => {
              if (/^[0-9]+$/.test(p)) {
                return parseInt(p, 10);
              } else {
                return p;
              }
            });
            const _insertElementAtKeyPath = (root, keyPath) => {
              const element = {
                element: 'element',
                attributes: {
                  position: {
                    type: 'position',
                    value: [1, 2, 3].join(' '),
                  },
                },
                children: [],
              };

              const targetElement = _getElementKeyPath(root, keyPath);
              targetElement.children.push(element);
            };
            const _castValueStringToValue = (s, type, min, max, options) => {
              switch (type) {
                case 'position':
                case 'text': {
                  return s;
                }
                case 'color': {
                  const match = s.match(/^#?([a-f0-9]{3}(?:[a-f0-9]{3})?)$/i);
                  if (match) {
                    return '#' + match[1];
                  } else {
                    return null;
                  }
                }
                case 'select': {
                  if (options.includes(s)) {
                    return s;
                  } else {
                    return null;
                  }
                }
                case 'number': {
                  const n = parseFloat(s);
                  if (!isNaN(n) && n >= min && n <= max) {
                    return n;
                  } else {
                    return null;
                  }
                }
                case 'checkbox': {
                  if (s === 'true') {
                    return true;
                  } else if (s === 'false') {
                    return false;
                  } else {
                    return null;
                  }
                }
                default: {
                  return s;
                }
              }
            };
            const _castValueValueToString = (s, type) => String(s);
            const _getFilesSpecs = files => files.map(file => {
              const {name, type, size} = file;
              const description = (() => {
                if (type === 'file') {
                  if (size !== null) {
                    return prettyBytes(size);
                  } else {
                    return '';
                  }
                } else {
                  return 'Directory';
                }
              })();

              return {
                name,
                type,
                description,
              };
            });

            const imageShader = {
              uniforms: {
                textures: {
                  type: 'tv',
                  value: null,
                },
                validTextures: {
                  type: 'iv1',
                  value: null,
                },
                texturePositions: {
                  type: 'v2v',
                  value: null,
                },
                textureLimits: {
                  type: 'v2v',
                  value: null,
                },
                textureOffsets: {
                  type: 'fv1',
                  value: null,
                },
                textureDimensions: {
                  type: 'fv1',
                  value: null,
                },
              },
              vertexShader: [
                "varying vec2 vUv;",
                "void main() {",
                "  vUv = uv;",
                "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
                "}"
              ].join("\n"),
              fragmentShader: [
                "uniform sampler2D textures[" + maxNumTextures + "];",
                "uniform int validTextures[" + maxNumTextures + "];",
                "uniform vec2 texturePositions[" + maxNumTextures + "];",
                "uniform vec2 textureLimits[" + maxNumTextures + "];",
                "uniform float textureOffsets[" + maxNumTextures + "];",
                "uniform float textureDimensions[" + maxNumTextures + "];",
                "varying vec2 vUv;",
                "void main() {",
                "  vec3 diffuse = vec3(0.0, 0.0, 0.0);",
                "  float alpha = 0.0;",
                "  int numValid = 0;",
                "  for (int i = 0; i < " + maxNumTextures + "; i++) {",
                "    if (validTextures[i] != 0) {",
                "      vec2 uv = vec2(",
                "        (vUv.x - texturePositions[i].x) / textureLimits[i].x,",
                "        1.0 - ((1.0 - vUv.y - texturePositions[i].y) / textureLimits[i].y)",
                "      );",
                "      if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {",
                "        uv.y = 1.0 - ((1.0 - vUv.y - texturePositions[i].y + textureOffsets[i]) / textureDimensions[i]);",
                "        if (uv.y > 0.0 && uv.y < 1.0) {",
                "          vec4 sample = texture2D(textures[i], uv);",
                "          diffuse += sample.rgb;",
                "",
                "          if (sample.a > 0.0) {",
                "            alpha += sample.a;",
                "            numValid++;",
                "          }",
                "        }",
                "      }",
                "    }",
                "  }",
                "  gl_FragColor = vec4(diffuse / float(numValid), alpha / float(numValid));",
                "}"
              ].join("\n")
            };

            return biolumi.requestUi({
              width: WIDTH,
              height: HEIGHT,
            }).then(ui => {
              if (live) {
                const focusState = {
                  type: null,
                };
                const modsState = {
                  inputText: '',
                  inputPlaceholder: 'Search npm',
                  inputIndex: 0,
                  inputValue: 0,
                  mods: _cleanMods(currentMods),
                };
                const configState = {
                  inputText: 'Hello, world! This is some text!',
                  inputPlaceholder: '',
                  inputIndex: 0,
                  inputValue: 0,
                  sliderValue: 0.5,
                };
                const elementsState = {
                  elements: [
                    {
                      element: 'archae',
                      attributes: {
                        position: {
                          type: 'position',
                          value: [1, 2, 3].join(' '),
                        },
                        text: {
                          type: 'text',
                          value: 'Hello, world!',
                        },
                        number: {
                          type: 'number',
                          value: 2,
                          min: 0,
                          max: 10,
                        },
                        select: {
                          type: 'select',
                          value: 'basic',
                          options: [
                            'basic',
                            'advanced',
                            'core',
                            'extra',
                          ],
                        },
                        color: {
                          type: 'color',
                          value: '#563d7c',
                        },
                        enabled: {
                          type: 'checkbox',
                          value: true,
                        },
                        disabled: {
                          type: 'checkbox',
                          value: false,
                        },
                      },
                      children: [
                        {
                          element: 'sub',
                          attributes: {
                            rotation: {
                              type: 'position',
                              value: [0, Math.PI, 0].join(' '),
                            },
                          },
                          children: [],
                        },
                        {
                          element: 'subsub',
                          attributes: {
                            rotation: {
                              type: 'position',
                              value: [0, Math.PI, 0].join(' '),
                            },
                          },
                          children: [],
                        },
                      ],
                    },
                    {
                      element: 'text',
                      attributes: {
                        lol: {
                          type: 'text',
                          value: 'zol',
                        },
                      },
                      children: [],
                    },
                  ],
                  availableElements: [
                    {
                      element: 'model',
                      attributes: {
                        position: {
                          type: 'position',
                          value: [1, 2, 3].join(' '),
                        },
                        rotation: {
                          type: 'position',
                          value: [0, Math.PI, 0].join(' '),
                        },
                        url: {
                          type: 'text',
                          value: 'cloud.mdl',
                        },
                      },
                      children: [],
                    },
                    {
                      element: 'model',
                      attributes: {
                        position: {
                          type: 'position',
                          value: [1, 2, 3].join(' '),
                        },
                        rotation: {
                          type: 'position',
                          value: [0, Math.PI, 0].join(' '),
                        },
                        url: {
                          type: 'text',
                          value: 'cloud.mdl',
                        },
                      },
                      children: [],
                    },
                  ],
                  clipboardElements: [
                    {
                      element: 'model',
                      attributes: {
                        position: {
                          type: 'position',
                          value: [1, 2, 3].join(' '),
                        },
                        rotation: {
                          type: 'position',
                          value: [0, Math.PI, 0].join(' '),
                        },
                      },
                      children: [
                        {
                          element: 'submodel',
                          attributes: {
                            url: {
                              type: 'text',
                              value: 'cloud.mdl',
                            },
                          },
                          children: [],
                        },
                      ],
                    },
                  ],
                  selectedKeyPath: [],
                  draggingKeyPath: [],
                  inputText: '',
                  inputIndex: 0,
                  inputValue: 0,
                };
                const filesState = {
                  cwd: fs.getCwd(),
                  files: [],
                  inputText: '',
                  inputValue: 0,
                  selectedName: '',
                  loaded: false,
                  loading: false,
                  uploading: fs.getUploading(),
                };

                const uploadStart = () => {
                  filesState.uploading = true;

                  _updatePages();
                }
                fs.addEventListener('uploadStart', uploadStart);
                const uploadEnd = () => {
                  filesState.uploading = false;
                  filesState.loading = true;

                  const {cwd} = filesState;
                  fs.getDirectory(cwd)
                    .then(files => {
                      filesState.files = _getFilesSpecs(files);
                      filesState.loading = false;

                      _updatePages();
                    })
                    .catch(err => {
                      console.warn(err);
                    });

                  _updatePages();
                }
                fs.addEventListener('uploadEnd', uploadEnd);
                cleanups.push(() => {
                  fs.removeEventListener('uploadStart', uploadStart);
                  fs.removeEventListener('uploadEnd', uploadEnd);
                });

                const measureText = (() => {
                  const measureContexts = {};

                  const _makeMeasureContext = fontSpec => {
                    const {fonts, fontSize, lineHeight, fontWeight, fontStyle} = fontSpec;

                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px/${lineHeight} ${fonts}`;

                    return ctx;
                  };
                  const _getFontSpecKey = fontSpec => {
                    const {fonts, fontSize, lineHeight, fontWeight, fontStyle} = fontSpec;
                    return [fonts, fontSize, lineHeight, fontWeight, fontStyle].join(':');
                  };
                  const _getMeasureContext = fontSpec => {
                    const key = _getFontSpecKey(fontSpec);
                    let entry = measureContexts[key];
                    if (!entry) {
                      entry = _makeMeasureContext(fontSpec);
                      measureContexts[key] = entry;
                    }
                    return entry;
                  };

                  return (text, fontSpec) => _getMeasureContext(fontSpec).measureText(text).width;
                })();
                const getTextPropertiesFromCoord = (text, fontSpec, coordPx) => {
                  const slices = (() => {
                    const result = [];
                    for (let i = 0; i <= text.length; i++) {
                      const slice = text.slice(0, i);
                      result.push(slice);
                    }
                    return result;
                  })();
                  const widths = slices.map(slice => measureText(slice, fontSpec));
                  const distances = widths.map(width => Math.abs(coordPx - width));
                  const sortedDistances = distances
                    .map((distance, index) => ([distance, index]))
                    .sort(([aDistance], [bDistance]) => (aDistance - bDistance));

                  const index = sortedDistances[0][1];
                  const px = widths[index];

                  return {index, px};
                };
                const getTextPropertiesFromIndex = (text, fontSpec, index) => {
                  const slice = text.slice(0, index);
                  const px = measureText(slice, fontSpec);
                  return {index, px};
                };

                ui.pushPage([
                  {
                    type: 'html',
                    src: getMainPageSrc(),
                  },
                  {
                    type: 'html',
                    src: currentMainReadme,
                    x: 500,
                    y: 150 + 2,
                    w: WIDTH - 500,
                    h: HEIGHT - (150 + 2),
                    scroll: true,
                  },
                  {
                    type: 'image',
                    img: creatureUtils.makeAnimatedCreature('zeo.sh'),
                    x: 0,
                    y: 0,
                    w: 150,
                    h: 150,
                    frameTime: 300,
                  }
                ], {
                  type: 'main',
                });

                const solidMaterial = new THREE.MeshBasicMaterial({
                  color: 0xFFFFFF,
                  opacity: 0.5,
                  transparent: true,
                  // alphaTest: 0.5,
                  depthWrite: false,
                });
                const wireframeMaterial = new THREE.MeshBasicMaterial({
                  color: 0x0000FF,
                  wireframe: true,
                  opacity: 0.5,
                  transparent: true,
                });
                const pointsMaterial = new THREE.PointsMaterial({
                  color: 0x000000,
                  size: 0.01,
                });

                const menuMesh = (() => {
                  const result = new THREE.Object3D();
                  result.position.y = 1.5;
                  result.position.z = -0.5;

                  const imageMaterial = (() => {
                    const shaderUniforms = THREE.UniformsUtils.clone(imageShader.uniforms);
                    shaderUniforms.textures.value = (() => {
                      const result = Array(maxNumTextures);
                      for (let i = 0; i < maxNumTextures; i++) {
                        const texture = new THREE.Texture(
                          transparentImg,
                          THREE.UVMapping,
                          THREE.ClampToEdgeWrapping,
                          THREE.ClampToEdgeWrapping,
                          THREE.NearestFilter,
                          THREE.NearestFilter,
                          THREE.RGBAFormat,
                          THREE.UnsignedByteType,
                          16
                        );
                        // texture.needsUpdate = true;

                        result[i] = texture;
                      }
                      return result;
                    })();
                    shaderUniforms.validTextures.value = (() => {
                      const result = Array(maxNumTextures);
                      for (let i = 0; i < maxNumTextures; i++) {
                        result[i] = 0;
                      }
                      return result;
                    })();
                    shaderUniforms.texturePositions.value = (() => {
                      const result = Array(2 * maxNumTextures);
                      for (let i = 0; i < maxNumTextures; i++) {
                        result[(i * 2) + 0] = 0;
                        result[(i * 2) + 1] = 0;
                      }
                      return result;
                    })();
                    shaderUniforms.textureLimits.value = (() => {
                      const result = Array(2 * maxNumTextures);
                      for (let i = 0; i < maxNumTextures; i++) {
                        result[(i * 2) + 0] = 0;
                        result[(i * 2) + 1] = 0;
                      }
                      return result;
                    })();
                    shaderUniforms.textureOffsets.value = (() => {
                      const result = Array(maxNumTextures);
                      for (let i = 0; i < maxNumTextures; i++) {
                        result[i] = 0;
                      }
                      return result;
                    })();
                    shaderUniforms.textureDimensions.value = (() => {
                      const result = Array(maxNumTextures);
                      for (let i = 0; i < maxNumTextures; i++) {
                        result[i] = 0;
                      }
                      return result;
                    })();
                    const shaderMaterial = new THREE.ShaderMaterial({
                      uniforms: shaderUniforms,
                      vertexShader: imageShader.vertexShader,
                      fragmentShader: imageShader.fragmentShader,
                      transparent: true,
                    });
                    // shaderMaterial.polygonOffset = true;
                    // shaderMaterial.polygonOffsetFactor = 1;
                    return shaderMaterial;
                  })();

                  const planeMesh = (() => {
                    const width = WORLD_WIDTH;
                    const height = WORLD_HEIGHT;
                    const depth = WORLD_DEPTH;

                    const geometry = new THREE.PlaneBufferGeometry(width, height, depth);
                    const materials = [solidMaterial, imageMaterial];

                    const mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, materials);
                    mesh.imageMaterial = imageMaterial;
                    return mesh;
                  })();
                  result.add(planeMesh);
                  result.planeMesh = planeMesh;

                  return result;
                })();
                scene.add(menuMesh);

                const boxMesh = (() => {
                  const geometry = new THREE.BoxBufferGeometry(1, 1, 1);

                  const mesh = new THREE.Mesh(geometry, wireframeMaterial);
                  mesh.visible = false;
                  // mesh.renderOrder = -1;
                  return mesh;
                })();
                scene.add(boxMesh);

                const dotMesh = (() => {
                  const geometry = new THREE.BufferGeometry();
                  geometry.addAttribute('position', new THREE.BufferAttribute(Float32Array.from([0, 0, 0]), 3));

                  const mesh = new THREE.Points(geometry, pointsMaterial);
                  return mesh;
                })();
                scene.add(dotMesh);

                const _updatePages = () => {
                  const pages = ui.getPages();
                  for (let i = 0; i < pages.length; i++) {
                    const page = pages[i];
                    const {type} = page;

                    let match;
                    if (match = type.match(/^mod:(.+)$/)) {
                      const name = match[1];
                      const mods = currentMods;
                      const mod = mods.find(m => m.name === name);

                      page.update({mod});
                    } else if (type === 'mods') {
                      page.update({
                        mods: modsState,
                        focus: focusState,
                      });
                    } else if (type === 'elements') {
                      page.update({
                        elements: elementsState,
                        focus: focusState,
                      });
                    } else if (type === 'files') {
                      page.update({
                        files: filesState,
                        focus: focusState,
                      });
                    } else if (type === 'config') {
                      page.update({
                        config: configState,
                        focus: focusState,
                      });
                    }
                  }
                };
                const click = () => {
                  const {intersectionPoint} = hoverState;

                  if (intersectionPoint) {
                    const {anchor} = hoverState;
                    const onclick = (anchor && anchor.onclick) || '';
                    const {selectedKeyPath: oldSelectedKeyPath} = elementsState;

                    focusState.type = null;
                    filesState.selectedName = '';

                    let match;
                    if (onclick === 'back') {
                      ui.cancelTransition();

                      if (ui.getPages().length > 1) {
                        ui.popPage();
                      }
                    } else if (onclick === 'mods') {
                      ui.cancelTransition();

                      if (ui.getPages().length < 3) {
                        const mods = currentMods;

                        ui.pushPage(({mods: {inputText, inputPlaceholder, inputValue, mods}, focus: {type: focusType}}) => ([
                          {
                            type: 'html',
                            src: getModsPageSrc({inputText, inputPlaceholder, inputValue, focus: focusType === 'mods', mods}),
                          },
                          {
                            type: 'image',
                            img: creatureUtils.makeAnimatedCreature('mods'),
                            x: 150,
                            y: 0,
                            w: 150,
                            h: 150,
                            frameTime: 300,
                          }
                        ]), {
                          type: 'mods',
                          state: {
                            mods: modsState,
                            focus: focusState,
                          },
                        });
                      } else {
                        ui.popPage();
                      }
                    } else if (match = onclick.match(/^mod:(.+)$/)) {
                      const name = match[1];
                      const mods = currentMods;
                      const mod = mods.find(m => m.name === name);

                      ui.cancelTransition();

                      if (ui.getPages().length < 3) {
                        ui.pushPage(({mod: {name, version, installed, readme}}) => ([
                          {
                            type: 'html',
                            src: getModPageSrc({name, version, installed}),
                          },
                          {
                            type: 'html',
                            src: getModPageReadmeSrc({readme: readme || '<h1>No readme for `' + name + '@' + version + '`</h1>'}),
                            x: 500,
                            y: 150 + 2,
                            w: WIDTH - 500,
                            h: HEIGHT - (150 + 2),
                            scroll: true,
                          },
                          {
                            type: 'image',
                            img: creatureUtils.makeAnimatedCreature('mod:' + name),
                            x: 150,
                            y: 0,
                            w: 150,
                            h: 150,
                            frameTime: 300,
                          }
                        ]), {
                          type: 'mod:' + name,
                          state: {
                            mod,
                          },
                        });
                      } else {
                        ui.popPage();
                      }
                    } else if (match = onclick.match(/^getmod:(.+)$/)) {
                      const name = match[1];

                      currentWorld.requestAddMod(name)
                        .then(() => {
                          _updatePages();
                        })
                        .catch(err => {
                          console.warn(err);
                        });
                    } else if (match = onclick.match(/^removemod:(.+)$/)) {
                      const name = match[1];

                      currentWorld.requestRemoveMod(name)
                        .then(() => {
                          _updatePages();
                        })
                        .catch(err => {
                          console.warn(err);
                        });
                    } else if (onclick === 'config') {
                      ui.cancelTransition();

                      ui.pushPage(({config: {inputText, inputPlaceholder, inputValue, sliderValue}, focus: {type: focusType}}) => ([
                        {
                          type: 'html',
                          src: getConfigPageSrc(),
                        },
                        {
                          type: 'html',
                          src: getConfigPageContentSrc({inputText, inputPlaceholder, inputValue, focus: focusType === 'config', sliderValue}),
                          x: 500,
                          y: 150 + 2,
                          w: WIDTH - 500,
                          h: HEIGHT - (150 + 2),
                          scroll: true,
                        },
                        {
                          type: 'image',
                          img: creatureUtils.makeAnimatedCreature('preferences'),
                          x: 150,
                          y: 0,
                          w: 150,
                          h: 150,
                          frameTime: 300,
                        }
                      ]), {
                        type: 'config',
                        state: {
                          config: configState,
                          focus: focusState,
                        }
                      });
                    } else if (onclick === 'elements') {
                      ui.cancelTransition();

                      ui.pushPage(({elements: {elements, availableElements, clipboardElements, selectedKeyPath, draggingKeyPath, inputText, inputValue}, focus: {type: focusType}}) => {
                        const match = focusType ? focusType.match(/^element:attribute:(.+)$/) : null;
                        const focusAttribute = match && match[1];

                        return [
                          {
                            type: 'html',
                            src: getElementsPageSrc(),
                          },
                          {
                            type: 'html',
                            src: getElementsPageContentSrc({elements, selectedKeyPath, draggingKeyPath}),
                            x: 500,
                            y: 150 + 2,
                            w: WIDTH - (500 + 600),
                            h: HEIGHT - (150 + 2),
                            scroll: true,
                          },
                          {
                            type: 'html',
                            src: getElementsPageSubcontentSrc({elements, availableElements, clipboardElements, selectedKeyPath, draggingKeyPath, inputText, inputValue, focusAttribute}),
                            x: 500 + (WIDTH - (500 + 600)),
                            y: 150 + 2,
                            w: 600,
                            h: HEIGHT - (150 + 2),
                            scroll: true,
                          },
                          {
                            type: 'image',
                            img: creatureUtils.makeAnimatedCreature('preferences'),
                            x: 150,
                            y: 0,
                            w: 150,
                            h: 150,
                            frameTime: 300,
                          }
                        ];
                      }, {
                        type: 'elements',
                        state: {
                          elements: elementsState,
                          focus: focusState,
                        },
                      });
                    } else if (onclick === 'files') {
                      ui.cancelTransition();

                      const {loaded} = filesState;
                      if (!loaded) {
                        filesState.loading = true;

                        const {cwd} = filesState;
                        fs.getDirectory(cwd)
                          .then(files => {
                            filesState.files = _getFilesSpecs(files);
                            filesState.loading = false;

                            _updatePages();
                          })
                          .catch(err => {
                            console.warn(err);
                          });
                      }

                      ui.pushPage(({files: {cwd, files, inputText, inputValue, selectedName, copiedName, loading, uploading}, focus: {type: focusType}}) => ([
                        {
                          type: 'html',
                          src: getFilesPageSrc({cwd, files, inputText, inputValue, selectedName, copiedName, loading, uploading, focus: focusType === 'files'}),
                        },
                        {
                          type: 'image',
                          img: creatureUtils.makeAnimatedCreature('files'),
                          x: 150,
                          y: 0,
                          w: 150,
                          h: 150,
                          frameTime: 300,
                        }
                      ]), {
                        type: 'files',
                        state: {
                          files: filesState,
                          focus: focusState,
                        },
                      });
                    } else if (match = onclick.match(/^file:(.+)$/)) {
                      ui.cancelTransition();

                      const _chdir = newCwd => {
                        filesState.loading = true;

                        filesState.cwd = newCwd;
                        fs.setCwd(newCwd);
                        fs.getDirectory(newCwd)
                          .then(files => {
                            filesState.files = _getFilesSpecs(files);
                            filesState.loading = false;

                            _updatePages();
                          })
                          .catch(err => {
                            console.warn(err);
                          });

                        _updatePages();
                      };

                      const name = match[1];
                      if (name !== '..') {
                        const {files} = filesState;
                        const file = files.find(f => f.name === name);
                        const {type} = file;

                        if (type === 'file') {
                          filesState.selectedName = name;

                          _updatePages();
                        } else if (type === 'directory') {
                          const {cwd: oldCwd} = filesState;
                          const newCwd = oldCwd + (!/\/$/.test(oldCwd) ? '/' : '') + name;
                          _chdir(newCwd);
                        }
                      } else {
                        const {cwd: oldCwd} = filesState;
                        const newCwd = (() => {
                          const replacedCwd = oldCwd.replace(/\/[^\/]*$/, '');
                          if (replacedCwd !== '') {
                            return replacedCwd;
                          } else {
                            return '/';
                          }
                        })();
                        _chdir(newCwd);
                      }
                    } else if (onclick === 'files:createdirectory') {
                      filesState.loading = true;

                      _updatePages();

                      const {cwd} = filesState;
                      const name = 'New Directory';
                      fs.createDirectory(cwd + '/' + name)
                        .then(() => fs.getDirectory(cwd)
                          .then(files => {
                            filesState.files = _getFilesSpecs(files);
                            filesState.loading = false;

                            _updatePages();
                          })
                        )
                        .catch(err => {
                          console.warn(err);
                        });
                    } else if (match = onclick.match(/^files:remove:(.+)$/)) {
                      filesState.loading = true;

                      _updatePages();

                      const {cwd} = filesState;
                      const name = match[1];
                      fs.remove(cwd + '/' + name)
                        .then(() => fs.getDirectory(cwd)
                          .then(files => {
                            filesState.files = _getFilesSpecs(files);
                            filesState.loading = false;

                            _updatePages();
                          })
                        )
                        .catch(err => {
                          console.warn(err);
                        });
                    } else if (onclick === 'element:add') {
                      _insertElementAtKeyPath({
                        elements: elementsState.elements,
                        availableElements: elementsState.availableElements,
                        clipboardElements: elementsState.clipboardElements,
                      }, oldSelectedKeyPath.length > 0 ? oldSelectedKeyPath : ['elements']);

                      _updatePages();
                    } else if (match = onclick.match(/^element:attribute:(.+?):(focus|set|tweak|toggle)(?::(.+?))?$/)) {
                      const name = match[1];
                      const action = match[2];
                      const value = match[3];

                      const element = _getElementKeyPath({
                        elements: elementsState.elements,
                        availableElements: elementsState.availableElements,
                        clipboardElements: elementsState.clipboardElements,
                      }, oldSelectedKeyPath);
                      const {attributes} = element;
                      const attribute = attributes[name];

                      if (action === 'focus') {
                        const {value} = hoverState;

                        const textProperties = (() => {
                          const {type} = attribute;
                          if (type === 'text') {
                            const valuePx = value * 400;
                            return getTextPropertiesFromCoord(_castValueValueToString(attribute.value, attribute.type), subcontentFontSpec, valuePx);
                          } else if (type === 'number') {
                            const valuePx = value * 100;
                            return getTextPropertiesFromCoord(_castValueValueToString(attribute.value, attribute.type), subcontentFontSpec, valuePx);
                          } else if (type === 'color') {
                            const valuePx = value * (400 - (40 + 4));
                            return getTextPropertiesFromCoord(_castValueValueToString(attribute.value, attribute.type), subcontentFontSpec, valuePx);
                          } else {
                            return null;
                          }
                        })();
                        if (textProperties) {
                          elementsState.inputText = _castValueValueToString(attribute.value, attribute.type);
                          const {index, px} = textProperties;
                          elementsState.inputIndex = index;
                          elementsState.inputValue = px;
                        }

                        focusState.type = 'element:attribute:' + name;
                      } else if (action === 'set') {
                        attribute.value = value;
                      } else if (action === 'tweak') {
                        const {value} = hoverState;
                        const {min, max} = attribute;

                        attribute.value = min + (value * (max - min));
                      } else if (action === 'toggle') {
                        attribute.value = !attribute.value;
                      }

                      elementsState.selectedKeyPath = oldSelectedKeyPath;

                      _updatePages();
                    } else if (onclick === 'mods:input') {
                      const {value} = hoverState;
                      const valuePx = value * (WIDTH - (500 + 40));

                      const {index, px} = getTextPropertiesFromCoord(modsState.inputText, mainFontSpec, valuePx);

                      modsState.inputIndex = index;
                      modsState.inputValue = px;
                      focusState.type = 'mods';

                      _updatePages();
                    } else if (onclick === 'files:input') {
                      const {value} = hoverState;
                      const valuePx = value * (WIDTH - (500 + 40));

                      const {index, px} = getTextPropertiesFromCoord(filesState.inputText, mainFontSpec, valuePx);

                      filesState.inputIndex = index;
                      filesState.inputValue = px;
                      focusState.type = 'files';

                      _updatePages();
                    } else if (onclick === 'config:input') {
                      const {value} = hoverState;
                      const valuePx = value * (WIDTH - (500 + 40));

                      const {index, px} = getTextPropertiesFromCoord(configState.inputText, mainFontSpec, valuePx);

                      configState.inputIndex = index;
                      configState.inputValue = px;
                      focusState.type = 'config';

                      _updatePages();
                    } else if (onclick === 'config:resolution') {
                      const {value} = hoverState;

                      configState.sliderValue = value;

                      _updatePages();
                    } else {
                      _updatePages();
                    }
                  }
                };
                input.addEventListener('click', click);
                const mousedown = () => {
                  const _doDrag = () => {
                    const {intersectionPoint} = hoverState;

                    if (intersectionPoint) {
                      const {anchor} = hoverState;
                      const onmousedown = (anchor && anchor.onmousedown) || '';
                      const {selectedKeyPath: oldSelectedKeyPath, draggingKeyPath: oldDraggingKeyPath} = elementsState;

                      let match;
                      if (match = onmousedown.match(/^element:select:((?:elements|availableElements|clipboardElements):(?:[0-9]+:)*[0-9]+)$/)) {
                        const keyPath = _parseKeyPath(match[1]);

                        elementsState.selectedKeyPath = keyPath;
                        elementsState.draggingKeyPath = keyPath;

                        _updatePages();

                        return true;
                      } else {
                        return false;
                      }
                    } else {
                      return false;
                    }
                  };
                  const _doScroll = () => {
                    const {scrollLayer} = hoverState;

                    if (scrollLayer) {
                      const {intersectionPoint} = hoverState;

                      const {position: menuPosition, rotation: menuRotation} = _decomposeMenuMesh();
                      const _getMenuMeshCoordinate = _makeMenuMeshCoordinateGetter({menuPosition, menuRotation});
                      const mousedownStartCoord = _getMenuMeshCoordinate(intersectionPoint);
                      hoverState.mousedownScrollLayer = scrollLayer;
                      hoverState.mousedownStartCoord = mousedownStartCoord;
                      hoverState.mousedownStartScrollTop = scrollLayer.scrollTop;

                      return true;
                    } else {
                      return false;
                    }
                  };

                  _doDrag() || _doScroll();
                };
                input.addEventListener('mousedown', mousedown);

                const _setLayerScrollTop = () => {
                  const {mousedownScrollLayer, mousedownStartCoord, mousedownStartScrollTop, intersectionPoint} = hoverState;

                  const {position: menuPosition, rotation: menuRotation} = _decomposeMenuMesh();
                  const _getMenuMeshCoordinate = _makeMenuMeshCoordinateGetter({menuPosition, menuRotation});
                  const mousedownCurCoord = _getMenuMeshCoordinate(intersectionPoint);
                  const mousedownCoordDiff = mousedownCurCoord.clone()
                    .sub(mousedownStartCoord)
                    .multiply(new THREE.Vector2(WIDTH / WORLD_WIDTH, HEIGHT / WORLD_HEIGHT));
                  const scrollTop = Math.max(
                    Math.min(
                      mousedownStartScrollTop - mousedownCoordDiff.y,
                      (mousedownScrollLayer.scrollHeight > mousedownScrollLayer.h) ?
                        (mousedownScrollLayer.scrollHeight - mousedownScrollLayer.h)
                      :
                        0
                    ),
                    0
                  );

                  mousedownScrollLayer.scrollTo(scrollTop);
                };
                const mousemove = () => {
                  const {mousedownStartCoord} = hoverState;
                  if (mousedownStartCoord) {
                    _setLayerScrollTop();
                  }
                };
                input.addEventListener('mousemove', mousemove);
                const mouseup = e => {
                  const _doDrag = () => {
                    const {intersectionPoint} = hoverState;

                    if (intersectionPoint) {
                      const {anchor} = hoverState;
                      const onmouseup = (anchor && anchor.onmouseup) || '';
                      const {draggingKeyPath: oldDraggingKeyPath} = elementsState;

                      if (oldDraggingKeyPath.length > 0) {
                        elementsState.selectedKeyPath = [];
                        elementsState.draggingKeyPath = [];

                        let match;
                        if (match = onmouseup.match(/^element:select:((?:elements|availableElements|clipboardElements):(?:[0-9]+:)*[0-9]+)$/)) {
                          const keyPath = _parseKeyPath(match[1]);

                          if (!_isSubKeyPath(keyPath, oldDraggingKeyPath)) {
                            const spec = {
                              elements: elementsState.elements,
                              availableElements: elementsState.availableElements,
                              clipboardElements: elementsState.clipboardElements,
                            };
                            const oldKeyPath = oldDraggingKeyPath;
                            const newKeyPath = keyPath.concat(_getElementKeyPath(spec, keyPath).children.length);
                            _moveElementKeyPath(spec, oldKeyPath, newKeyPath);
                          } else {
                            elementsState.selectedKeyPath = oldDraggingKeyPath;
                          }
                        } else if (match = onmouseup.match(/^element:move:((?:elements|availableElements|clipboardElements):(?:[0-9]+:)*[0-9]+)$/)) {
                          const keyPath = _parseKeyPath(match[1]);

                          if (!_isSubKeyPath(keyPath, oldDraggingKeyPath)) {
                            const spec = {
                              elements: elementsState.elements,
                              availableElements: elementsState.availableElements,
                              clipboardElements: elementsState.clipboardElements,
                            };
                            const oldKeyPath = oldDraggingKeyPath;
                            const newKeyPath = keyPath;
                            _moveElementKeyPath(spec, oldKeyPath, newKeyPath);
                          } else {
                            elementsState.selectedKeyPath = oldDraggingKeyPath;
                          }
                        } else {
                          elementsState.selectedKeyPath = oldDraggingKeyPath;
                        }

                        _updatePages();
                      }
                    }

                    return false;
                  };
                  const _doScroll = () => {
                    const {mousedownStartCoord} = hoverState;

                    if (mousedownStartCoord) {
                      _setLayerScrollTop();

                      hoverState.mousedownScrollLayer = null;
                      hoverState.mousedownStartCoord = null;

                      return true;
                    } else {
                      return false;
                    }
                  };

                  _doDrag() || _doScroll();
                };
                input.addEventListener('mouseup', mouseup);

                const _isPrintableKeycode = keyCode =>
                  (keyCode > 47 && keyCode < 58) || // number keys
                  (keyCode == 32) || // spacebar & return key(s) (if you want to allow carriage returns)
                  (keyCode > 64 && keyCode < 91) || // letter keys
                  (keyCode > 95 && keyCode < 112) || // numpad keys
                  (keyCode > 185 && keyCode < 193) || // ;=,-./` (in order)
                  (keyCode > 218 && keyCode < 223); // [\]' (in order)\
                const _applyStateKeyEvent = (state, fontSpec, e) => {
                  const {inputText, inputIndex} = state;

                  let change = false;
                  let commit = false;

                  if (_isPrintableKeycode(e.keyCode)) {
                    state.inputText = inputText.slice(0, inputIndex) + whatkey(e).key + inputText.slice(inputIndex);
                    state.inputIndex++;
                    state.inputValue = getTextPropertiesFromIndex(state.inputText, fontSpec, state.inputIndex).px;

                    change = true;
                  } else if (e.keyCode === 13) { // enter
                    focusState.type = null;

                    commit = true;
                  } else if (e.keyCode === 8) { // backspace
                    if (inputIndex > 0) {
                      state.inputText = inputText.slice(0, inputIndex - 1) + inputText.slice(inputIndex);
                      state.inputIndex--;
                      state.inputValue = getTextPropertiesFromIndex(state.inputText, fontSpec, state.inputIndex).px;

                      change = true;
                    }
                  } else if (e.keyCode === 37) { // left
                    state.inputIndex = Math.max(state.inputIndex - 1, 0);
                    state.inputValue = getTextPropertiesFromIndex(state.inputText, fontSpec, state.inputIndex).px;

                    change = true;
                  } else if (e.keyCode === 39) { // right
                    state.inputIndex = Math.min(state.inputIndex + 1, inputText.length);
                    state.inputValue = getTextPropertiesFromIndex(state.inputText, fontSpec, state.inputIndex).px;

                    change = true;
                  } else if (e.keyCode === 38) { // up
                    state.inputIndex = 0;
                    state.inputValue = getTextPropertiesFromIndex(state.inputText, fontSpec, state.inputIndex).px;

                    change = true;
                  } else if (e.keyCode === 40) { // down
                    state.inputIndex = inputText.length;
                    state.inputValue = getTextPropertiesFromIndex(state.inputText, fontSpec, state.inputIndex).px;

                    change = true;
                  }

                  if (change || commit) {
                    return {
                      change,
                      commit,
                    };
                  } else {
                    return null;
                  }
                };
                const keydown = e => {
                  const type = focusState.type || '';

                  let match;
                  if (type === 'mods') {
                    if (_applyStateKeyEvent(modsState, mainFontSpec, e)) {
                      if (modsState.inputText.length > 0) {
                        // XXX cancel duplicate searches
                        npm.requestSearch(modsState.inputText)
                          .then(mods => {
                            modsState.mods = _cleanMods(mods),

                            _updatePages();
                          })
                          .catch(err => {
                            console.warn(err);
                          });
                      } else {
                        modsState.mods = _cleanMods(currentMods);
                      }

                      _updatePages();

                      e.stopImmediatePropagation();
                    }
                  } else if (match = type.match(/^element:attribute:(.+)$/)) {
                    const applySpec = _applyStateKeyEvent(elementsState, subcontentFontSpec, e);

                    if (applySpec) {
                      const {commit} = applySpec;

                      if (commit) {
                        const name = match[1];
                        const {selectedKeyPath, inputText} = elementsState;

                        const element = _getElementKeyPath({
                          elements: elementsState.elements,
                          availableElements: elementsState.availableElements,
                          clipboardElements: elementsState.clipboardElements,
                        }, selectedKeyPath);
                        const {attributes} = element;
                        const attribute = attributes[name];
                        const {type, min, max, options} = attribute;
                        const newValue = _castValueStringToValue(inputText, type, min, max, options);
                        if (newValue !== null) {
                          attribute.value = newValue;
                        }
                      }

                      _updatePages();

                      e.stopImmediatePropagation();
                    }
                  } else if (type === 'files') {
                    if (_applyStateKeyEvent(filesState, mainFontSpec, e)) {
                      _updatePages();

                      e.stopImmediatePropagation();
                    }
                  } else if (type === 'config') {
                    if (_applyStateKeyEvent(configState, mainFontSpec, e)) {
                      _updatePages();

                      e.stopImmediatePropagation();
                    }
                  }
                };
                input.addEventListener('keydown', keydown, {
                  priority: 1,
                });

                cleanups.push(() => {
                  scene.remove(menuMesh);
                  scene.remove(boxMesh);
                  scene.remove(dotMesh);

                  input.removeEventListener('click', click);
                  input.removeEventListener('mousedown', mousedown);
                  input.removeEventListener('mousemove', mousemove);
                  input.removeEventListener('mouseup', mouseup);
                  input.addEventListener('keydown', keydown);
                });

                const _decomposeMenuMesh = () => {
                  const position = new THREE.Vector3();
                  const rotation = new THREE.Quaternion();
                  const scale = new THREE.Vector3();
                  menuMesh.matrixWorld.decompose(position, rotation, scale);
                  return {position, rotation, scale};
                };
                const _makeMenuMeshPointGetter = ({menuPosition, menuRotation}) => (x, y, z) => menuPosition.clone()
                  .add(
                    new THREE.Vector3(
                      -WORLD_WIDTH / 2,
                      WORLD_HEIGHT / 2,
                      0
                    )
                    .add(
                      new THREE.Vector3(
                        (x / WIDTH) * WORLD_WIDTH,
                        (-y / HEIGHT) * WORLD_HEIGHT,
                        z
                      )
                    ).applyQuaternion(menuRotation)
                  );
                const _makeMenuMeshCoordinateGetter = ({menuPosition, menuRotation}) => {
                  const _getMenuMeshPoint = _makeMenuMeshPointGetter({menuPosition, menuRotation});

                  return intersectionPoint => {
                    const x = (() => {
                      const horizontalLine = new THREE.Line3(
                        _getMenuMeshPoint(0, 0, 0),
                        _getMenuMeshPoint(WIDTH, 0, 0)
                      );
                      const closestHorizontalPoint = horizontalLine.closestPointToPoint(intersectionPoint, true);
                      return horizontalLine.start.distanceTo(closestHorizontalPoint);
                    })();
                    const y = (() => {
                      const verticalLine = new THREE.Line3(
                        _getMenuMeshPoint(0, 0, 0),
                        _getMenuMeshPoint(0, HEIGHT, 0)
                      );
                      const closestVerticalPoint = verticalLine.closestPointToPoint(intersectionPoint, true);
                      return verticalLine.start.distanceTo(closestVerticalPoint);
                    })();
                    return new THREE.Vector2(x, y);
                  };
                };

                const hoverState = {
                  intersectionPoint: null,
                  scrollLayer: null,
                  anchor: null,
                  value: 0,
                  mousedownScrollLayer: null,
                  mousedownStartCoord: null,
                  mousedownStartScrollTop: null,
                };
                updates.push(() => {
                  const _updateMenuMesh = () => {
                    const {planeMesh: {imageMaterial}} = menuMesh;
                    const {uniforms: {texture, textures, validTextures, texturePositions, textureLimits, textureOffsets, textureDimensions}} = imageMaterial;

                    const layers = ui.getLayers();
                    const worldTime = currentWorld.getWorldTime();
                    for (let i = 0; i < maxNumTextures; i++) {
                      const layer = i < layers.length ? layers[i] : null;

                      if (layer && layer.getValid({worldTime})) {
                        validTextures.value[i] = 1;

                        if (textures.value[i].image !== layer.img) {
                          textures.value[i].image = layer.img;
                          textures.value[i].needsUpdate = true;
                        }

                        const position = layer.getPosition();
                        texturePositions.value[(i * 2) + 0] = position.x;
                        texturePositions.value[(i * 2) + 1] = position.y;
                        textureLimits.value[(i * 2) + 0] = position.w;
                        textureLimits.value[(i * 2) + 1] = position.h;
                        textureOffsets.value[i] = position.st;
                        textureDimensions.value[i] = position.sh;
                      } else {
                        validTextures.value[i] = 0;
                      }
                    }
                  };
                  const _updateAnchors = () => {
                    const cameraPosition = new THREE.Vector3();
                    const cameraRotation = new THREE.Quaternion();
                    const cameraScale = new THREE.Vector3();
                    camera.matrixWorld.decompose(cameraPosition, cameraRotation, cameraScale);

                    const ray = new THREE.Vector3(0, 0, -1)
                      .applyQuaternion(cameraRotation);
                    const cameraLine = new THREE.Line3(
                      cameraPosition.clone(),
                      cameraPosition.clone().add(ray.clone().multiplyScalar(15))
                    );

                    const {position: menuPosition, rotation: menuRotation} = _decomposeMenuMesh();
                    const menuNormalZ = new THREE.Vector3(0, 0, 1).applyQuaternion(menuRotation);

                    const menuPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(menuNormalZ, menuPosition);
                    const intersectionPoint = menuPlane.intersectLine(cameraLine);
                    if (intersectionPoint) {
                      hoverState.intersectionPoint = intersectionPoint;

                      const _getMenuMeshPoint = _makeMenuMeshPointGetter({menuPosition, menuRotation});

                      const scrollLayerBoxes = ui.getLayers()
                        .filter(layer => layer.scroll)
                        .map(layer => {
                          const rect = layer.getRect();
                          const layerBox = new THREE.Box3().setFromPoints([
                            _getMenuMeshPoint(rect.left, rect.top, -WORLD_DEPTH),
                            _getMenuMeshPoint(rect.right, rect.bottom, WORLD_DEPTH),
                          ]);
                          layerBox.layer = layer;
                          return layerBox;
                        });
                      const scrollLayerBox = (() => {
                        for (let i = 0; i < scrollLayerBoxes.length; i++) {
                          const layerBox = scrollLayerBoxes[i];
                          if (layerBox.containsPoint(intersectionPoint)) {
                            return layerBox;
                          }
                        }
                        return null;
                      })();
                      if (scrollLayerBox) {
                        hoverState.scrollLayer = scrollLayerBox.layer;
                      } else {
                        hoverState.scrollLayer = null;
                      }

                      const anchorBoxes = (() => {
                        const result = [];
                        const layers = ui.getLayers();
                        for (let i = 0; i < layers.length; i++) {
                          const layer = layers[i];
                          const anchors = layer.getAnchors();

                          for (let j = 0; j < anchors.length; j++) {
                            const anchor = anchors[j];
                            const {rect} = anchor;

                            const anchorBox = new THREE.Box3().setFromPoints([
                              _getMenuMeshPoint(rect.left, rect.top - layer.scrollTop, -WORLD_DEPTH),
                              _getMenuMeshPoint(rect.right, rect.bottom - layer.scrollTop, WORLD_DEPTH),
                            ]);
                            anchorBox.anchor = anchor;

                            result.push(anchorBox);
                          }
                        }
                        return result;
                      })();
                      const anchorBox = (() => {
                        const interstectedAnchorBoxes = anchorBoxes.filter(anchorBox => anchorBox.containsPoint(intersectionPoint));

                        if (interstectedAnchorBoxes.length > 0) {
                          return interstectedAnchorBoxes.map(anchorBox => ({
                            anchorBox,
                            distance: anchorBox.getCenter().distanceTo(intersectionPoint),
                          })).sort((a, b) => a.distance - b.distance)[0].anchorBox;
                        } else {
                          return null;
                        }
                      })();
                      if (anchorBox) {
                        boxMesh.position.copy(anchorBox.min.clone().add(anchorBox.max).divideScalar(2));
                        boxMesh.scale.copy(anchorBox.max.clone().sub(anchorBox.min));

                        const {anchor} = anchorBox;
                        hoverState.anchor = anchor;
                        hoverState.value = (() => {
                          const {rect} = anchor;
                          const horizontalLine = new THREE.Line3(
                            _getMenuMeshPoint(rect.left, (rect.top + rect.bottom) / 2, 0),
                            _getMenuMeshPoint(rect.right, (rect.top + rect.bottom) / 2, 0)
                          );
                          const closestHorizontalPoint = horizontalLine.closestPointToPoint(intersectionPoint, true);
                          return new THREE.Line3(horizontalLine.start.clone(), closestHorizontalPoint.clone()).distance() / horizontalLine.distance();
                        })();

                        if (!boxMesh.visible) {
                          boxMesh.visible = true;
                        }
                      } else {
                        hoverState.anchor = null;
                        hoverState.value = 0;

                        if (boxMesh.visible) {
                          boxMesh.visible = false;
                        }
                      }

                      dotMesh.position.copy(intersectionPoint);
                    } else {
                      hoverState.intersectionPoint = null;
                      hoverState.scrollLayer = null;
                      hoverState.anchor = null;
                      hoverState.value = 0;

                      if (boxMesh.visible) {
                        boxMesh.visible = false;
                      }
                    }
                  };

                  _updateMenuMesh();
                  _updateAnchors();
                });
              }
            });
          }
        };
        const _initialize = () => _initializeWorld()
          .then(() => _initializeMenu());

        return _initialize()
          .then(() => {
            const _update = () => {
              for (let i = 0; i < updates.length; i++) {
                const update = updates[i];
                update();
              }
            };
            const _updateEye = camera => {
              for (let i = 0; i < updateEyes.length; i++) {
                const updateEye = updateEyes[i];
                updateEye(camera);
              }
            }

            return {
              getCurrentWorld: _getCurrentWorld,
              update: _update,
              updateEye: _updateEye,
            };
          });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Rend;
