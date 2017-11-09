import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  TAGS_WIDTH,
  TAGS_HEIGHT,
  TAGS_WORLD_WIDTH,
  TAGS_WORLD_HEIGHT,
  TAGS_WORLD_DEPTH,
} from './lib/constants/entity';
// import colorImg from './lib/img/color';

class Entity {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {site: {url: siteUrl}, server: {url: serverUrl, enabled: serverEnabled}}} = archae;

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

    return archae.requestPlugins([
        '/core/engines/three',
        '/core/engines/input',
        '/core/engines/webvr',
        '/core/engines/biolumi',
        '/core/engines/resource',
        '/core/engines/rend',
        '/core/engines/tags',
        '/core/engines/fs',
        '/core/engines/world',
        '/core/engines/file',
        '/core/engines/keyboard',
        '/core/utils/type-utils',
        '/core/utils/creature-utils',
    ])
    .then(([
      three,
      input,
      webvr,
      biolumi,
      resource,
      rend,
      tags,
      fs,
      world,
      file,
      keyboard,
      typeUtils,
      creatureUtils,
    ]) => {
      if (live) {
        const {THREE, scene} = three;
        const {sfx} = resource;

        const _decorateEntity = entity => {
          const {id, name, version, displayName, module, attributes, instancing} = entity;
          const attributeSpecs = tags.getAttributeSpecs(module);
          for (const attributeName in attributes) {
            const attributeSpec = attributeSpecs.find(attributeSpec => attributeSpec.name === attributeName);
            const {value: attributeValue} = attributes[attributeName];
            attributeSpec.value = attributeValue;
          }
          return {id, name, version, displayName, attributes: attributeSpecs, instancing};
        };
        const _updateNpm = () => {
          const {inputText} = npmState;

          const itemSpecs = tags.getTagMeshes()
            .filter(({item}) =>
              item.type === 'entity' &&
              item.displayName.indexOf(inputText) !== -1
            )
            .map(({item}) => item);

          npmState.loading = false;
          npmState.page = 0;
          npmState.tagSpecs = itemSpecs;
          npmState.numTags = itemSpecs.length;

          npmState.loading = false;
        };

        const npmState = {
          loading: true,
          inputText: '',
          inputValue: 0,
          entity: null,
          tagSpecs: [],
          numTags: 0,
          page: 0,
        };
        const focusState = {
          keyboardFocusState: null,
        };
        const npmCacheState = {
          loaded: false,
        };

        const _tabchange = tab => {
          if (tab === 'entity') {
            keyboard.tryBlur();

            const {loaded} = npmCacheState;
            if (!loaded) {
              _updateNpm();
              _updatePages();

              npmCacheState.loaded = true;
            }
          }
        };
        rend.on('tabchange', _tabchange);

        const _setEntity = item => {
          npmState.entity = item;
          npmState.page = 0;

          _updatePages();
        };
        const _entitychange = item => {
          _setEntity(item);
        };
        rend.on('entitychange', _entitychange);

        const _saveEntities = entitySpecs => {
          /* const id = _makeId();
          const date = new Date();
          const fileSpec = {
            type: 'file',
            id: id,
            name: '/world-' + [
               date.getFullYear(),
               date.getMonth() + 1,
               date.getDate(),
               date.getHours(),
               date.getMinutes(),
            ].join('-') + '.jsw',
            mimeType: 'application/json-world',
          };
          const data = JSON.stringify({
            entities: entitySpecs,
          });

          fs.writeData(fileSpec.id, fileSpec.name, data)
            .then(() => {
              world.addTag(fileSpec);
              const fileTagMesh = tags.getTagMeshes().find(tagMesh => tagMesh.item.id === id);
              const {item: fileItem} = fileTagMesh;

              file.addFile(fileItem);

              rend.setTab('file');
            })
            .catch(err => {
              console.warn(err);
            }); */
        };

        const _saveAllEntities = () => {
          const entitySpecs = tags.getTagMeshes()
            .filter(({item}) => item.type === 'entity')
            .map(({item}) => item);
          _saveEntities(entitySpecs);
        };
        rend.on('saveAllEntities', _saveAllEntities);

        /* const _trigger = e => {
          const {side} = e;

          const _clickMenu = () => {
            const hoverState = rend.getHoverState(side);
            const {anchor} = hoverState;
            const onclick = (anchor && anchor.onclick) || '';

            let match;
            if (onclick === 'entity:focus') {
              const {inputText} = npmState;
              const {value, target: page} = hoverState;
              const {layer: {measures}} = page;
              const valuePx = value * (WIDTH - (250 + (30 * 2)));
              const {index, px} = biolumi.getTextPropertiesFromCoord(measures['entity:search'], inputText, valuePx);
              const {hmd: hmdStatus} = webvr.getStatus();
              const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmdStatus;
              const keyboardFocusState = keyboard.focus({
                type: 'entity:search',
                position: hmdPosition,
                rotation: hmdRotation,
                inputText: inputText,
                inputIndex: index,
                inputValue: px,
                page: page,
              });
              focusState.keyboardFocusState = keyboardFocusState;

              keyboardFocusState.on('update', () => {
                const {inputText: keyboardInputText, inputValue: keyboardInputValue} = keyboardFocusState;
                const {inputText: npmInputText, inputValue: npmInputValue} = npmState;

                if (keyboardInputText !== npmInputText || npmInputValue !== keyboardInputValue) {
                  npmState.inputText = keyboardInputText;
                  npmState.inputValue = keyboardInputValue;

                  _updateNpm();
                }

                _updatePages();
              });
              keyboardFocusState.on('blur', () => {
                focusState.keyboardFocusState = null;

                _updatePages();
              });

              _updatePages();

              return true;
            } else if (match = onclick.match(/^entity:(up|down)$/)) {
              const direction = match[1];

              npmState.page += (direction === 'up' ? -1 : 1);

              _updatePages();

              return true;
            } else if (match = onclick.match(/^entity:entity:(.+)$/)) {
              const tagId = match[1];

              const tagMesh = tags.getTagMeshes().find(tagMesh => tagMesh.item.id === tagId);
              const {item} = tagMesh;
              _setEntity(item);

              return true;
            } else if (onclick === 'entity:back') {
              _setEntity(null);

              return true;
            } else if (match = onclick.match(/^entity:remove:(.+)$/)) {
              const tagId = match[1];

              world.removeTag(tagId);

              npmState.tagSpecs.splice(npmState.tagSpecs.findIndex(item => item.id === tagId), 1);
              _setEntity(null);

              return true;
            } else if (match = onclick.match(/^entity:select:(.+)$/)) {
              const tagId = match[1];

              const entitySpec = npmState.tagSpecs.find(item => item.id === tagId);
              entitySpec.selected = !entitySpec.selected;

              _updatePages();

              return true;
            } else if (onclick === 'entity:selectAll') {
              for (let i = 0; i < npmState.tagSpecs.length; i++) {
                const entitySpec = npmState.tagSpecs[i];
                entitySpec.selected = true;
              }

              _updatePages();

              return true;
            } else if (onclick === 'entity:clearAll') {
              for (let i = 0; i < npmState.tagSpecs.length; i++) {
                const entitySpec = npmState.tagSpecs[i];
                entitySpec.selected = false;
              }

              _updatePages();

              return true;
            } else if (onclick === 'entity:saveEntities') {
              const entitySpecs = npmState.tagSpecs.filter(entitySpec => entitySpec.selected);
              _saveEntities(entitySpecs);

              return true;
            } else {
              return false;
            }
          };
          const _clickAttribute = () => {
            const hoverState = rend.getHoverState(side);
            const {anchor} = hoverState;
            const onclick = (anchor && anchor.onclick) || '';

            let match;
            if (match = onclick.match(/^entityAttribute:([^:]+):([^:]+)(?::([^:]+))?:(focus|set|tweak|pick|color|toggle|link|matrix)(?::([^:]+))?$/)) {
              const tagId = match[1];
              const attributeName = match[2];
              const key = match[3];
              const action = match[4];
              const value = match[5];

              const tagMesh = tags.getTagMeshes().find(tagMesh => tagMesh.item.id === tagId);
              const {item} = tagMesh;
              const {module, attributes} = item;
              const attribute = attributes[attributeName] || tags.getAttributeSpec(module, attributeName);
              const {value: attributeValue} = attribute;

              if (action === 'focus') {
                const {value: hoverValue, target: page} = hoverState;
                const {layer: {measures}} = page;
                const {type} = tags.getAttributeSpec(module, attributeName);

                const inputText = typeUtils.castValueValueToString(attributeValue, type);
                const textProperties = (() => {
                  if (type === 'text') {
                    const hoverValuePx = hoverValue * 400;
                    return biolumi.getTextPropertiesFromCoord(measures[`entityAttribute:${tagId}:${attributeName}`], inputText, hoverValuePx);
                  } else if (type === 'number') {
                    const hoverValuePx = hoverValue * 100;
                    return biolumi.getTextPropertiesFromCoord(measures[`entityAttribute:${tagId}:${attributeName}`], inputText, hoverValuePx);
                  } else if (type === 'color') {
                    const hoverValuePx = hoverValue * 300;
                    return biolumi.getTextPropertiesFromCoord(measures[`entityAttribute:${tagId}:${attributeName}`], inputText, hoverValuePx);
                  } else {
                    return null;
                  }
                })();
                const keyboardFocusState = (() => {
                  if (textProperties) {
                    const {hmd: hmdStatus} = webvr.getStatus();
                    const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmdStatus;
                    const {index, px} = textProperties;
                    return keyboard.focus({
                      type: 'entityAttribute:' + tagId + ':' + attributeName,
                      position: hmdPosition,
                      rotation: hmdRotation,
                      inputText: inputText,
                      inputIndex: index,
                      inputValue: px,
                      page: page,
                    });
                  } else {
                    return keyboard.fakeFocus({
                      type: 'entityAttribute:' + tagId + ':' + attributeName,
                    });
                  }
                })();
                focusState.keyboardFocusState = keyboardFocusState;

                keyboardFocusState.on('update', () => {
                  const {inputText} = keyboardFocusState;
                  tagMesh.setAttribute(attributeName, inputText);

                  _updatePages();
                });
                keyboardFocusState.on('blur', () => {
                  focusState.keyboardFocusState = null;

                  _updateNpm();
                  _updatePages();
                });

                _updatePages();
              } else if (action === 'set') {
                tags.emit('setAttribute', {
                  id: tagId,
                  name: attributeName,
                  value: value,
                });

                keyboard.tryBlur();

                setTimeout(() => {
                  _updateNpm();
                  _updatePages();
                });
              } else if (action === 'tweak') {
                const attributeSpec = tags.getAttributeSpec(module, attributeName);
                const {type} = attributeSpec;

                if (type === 'number') {
                  const newValue = (() => {
                    const {value} = hoverState;
                    const {min, max, step} = attributeSpec;

                    let n = min + (value * (max - min));
                    if (step > 0) {
                      n = _roundToDecimals(Math.round(n / step) * step, 8);
                    }
                    return n;
                  })();

                  tags.emit('setAttribute', {
                    id: tagId,
                    name: attributeName,
                    value: newValue,
                  });

                  keyboard.tryBlur();

                  setTimeout(() => {
                    _updateNpm();
                    _updatePages();
                  });
                } else if (type ==='vector') {
                  const newKeyValue = (() => {
                    const {value} = hoverState;
                    const {min, max, step} = attributeSpec;

                    let n = min + (value * (max - min));
                    if (step > 0) {
                      n = _roundToDecimals(Math.round(n / step) * step, 8);
                    }
                    return n;
                  })();
                  const newValue = attributeValue.slice();
                  newValue[AXES.indexOf(key)] = newKeyValue;

                  tags.emit('setAttribute', {
                    id: tagId,
                    name: attributeName,
                    value: newValue,
                  });

                  keyboard.tryBlur();

                  setTimeout(() => {
                    _updateNpm();
                    _updatePages();
                  });
                }
              } else if (action === 'pick') {
                const keyboardFocusState =  keyboard.fakeFocus({
                  type: 'entityAttributeColor:' + tagId + ':' + attributeName,
                });
                focusState.keyboardFocusState = keyboardFocusState;

                keyboardFocusState.on('blur', () => {
                  focusState.keyboardFocusState = null;

                  _updateNpm();
                  _updatePages();
                });

                _updatePages();
              } else if (action === 'color') {
                const {value: x, crossValue: y} = hoverState;

                const c = new THREE.Color().fromArray(colorImgData.getColorArray(x, y));
                const newValue = '#' + c.getHexString();

                tags.emit('setAttribute', {
                  id: tagId,
                  name: attributeName,
                  value: newValue,
                });

                keyboard.tryBlur();

                _updatePages();
              } else if (action === 'toggle') {
                const newValue = !attributeValue;

                tags.emit('setAttribute', {
                  id: tagId,
                  name: attributeName,
                  value: newValue,
                });

                setTimeout(() => {
                  _updateNpm();
                  _updatePages();
                });
              } else if (action === 'link') {
                console.log('link', { // XXX
                  tagId,
                  attributeName,
                  attributeValue,
                });
              } else if (action === 'matrix') {
                const {keyboardFocusState: oldKeyboardFocusState} = focusState;

                if (oldKeyboardFocusState && /^entityAttributeMatrix:/.test(oldKeyboardFocusState.type)) {
                  keyboard.tryBlur();
                } else {
                  const keyboardFocusState =  keyboard.fakeFocus({
                    type: 'entityAttributeMatrix:' + tagId + ':' + attributeName,
                  });
                  focusState.keyboardFocusState = keyboardFocusState;

                  const position = new THREE.Vector3(attributeValue[0], attributeValue[1], attributeValue[2]);
                  const rotation = new THREE.Quaternion(attributeValue[3], attributeValue[4], attributeValue[5], attributeValue[6]);
                  const scale = new THREE.Vector3(attributeValue[7], attributeValue[8], attributeValue[9]);

                  keyboardFocusState.on('blur', () => {
                    focusState.keyboardFocusState = null;


                    _updatePages();
                  });

                  _updatePages();
                }
              }

              return true;
            } else {
              return false;
            }
          };
          const _clickMenuBackground = () => {
            const hoverState = rend.getHoverState(side);
            const {target} = hoverState;

            if (target && target.mesh && target.mesh.parent === entityMesh) {
              return true;
            } else {
              return false;
            }
          };

          if (_clickMenu() || _clickAttribute()) {
            sfx.digi_select.trigger();

            e.stopImmediatePropagation();
          } else if (_clickMenuBackground()) {
            sfx.digi_plink.trigger();

            e.stopImmediatePropagation();
          }
        };
        input.on('trigger', _trigger); */

        cleanups.push(() => {
          rend.removeListener('tabchange', _tabchange);
          rend.removeListener('entitychange', _entitychange);
          rend.removeListener('saveAllEntities', _saveAllEntities);
          // input.removeListener('trigger', _trigger);
        });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _makeId = () => Math.random().toString(36).substring(7);
const _roundToDecimals = (value, decimals) => Number(Math.round(value+'e'+decimals)+'e-'+decimals);

module.exports = Entity;
