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
import entityRender from './lib/render/entity';
import menuUtilser from './lib/utils/menu';
import colorImg from './lib/img/color';

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

    const _requestColorImgData = () => new Promise((accept, reject) => {
      const img = new Image();
      img.onload = () => {
        const {width, height} = img;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, width, height);
        const {data: imageDataData} = imageData;
        imageData.getColorArray = (x, y) => {
          const xPx = Math.floor(x * width);
          const yPx = Math.floor(y * height);
          const baseIndex = (xPx + (yPx * width)) * 4;
          const colorArray = [
            imageDataData[baseIndex + 0] / 255,
            imageDataData[baseIndex + 1] / 255,
            imageDataData[baseIndex + 2] / 255,
          ];
          return colorArray;
        };

        accept(imageData);
      };
      img.onerror = err => {
        reject(err);
      };
      img.src = 'data:image/svg+xml;utf8,' + colorImg;
    });

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/three',
        '/core/engines/input',
        '/core/engines/webvr',
        '/core/engines/biolumi',
        '/core/engines/rend',
        '/core/engines/tags',
        '/core/engines/world',
        '/core/engines/fs',
        '/core/engines/keyboard',
        '/core/utils/creature-utils',
      ]),
      _requestColorImgData(),
    ])
    .then(([
      [
        three,
        input,
        webvr,
        biolumi,
        rend,
        tags,
        world,
        fs,
        keyboard,
        creatureUtils,
      ],
      colorImgData,
    ]) => {
      if (live) {
        const {THREE, scene} = three;

        const menuUtils = menuUtilser.makeUtils({fs});
        const entityRenderer = entityRender.makeRenderer({menuUtils, creatureUtils});

        const transparentMaterial = biolumi.getTransparentMaterial();

        const mainFontSpec = {
          fonts: biolumi.getFonts(),
          fontSize: 36,
          lineHeight: 1.4,
          fontWeight: biolumi.getFontWeight(),
          fontStyle: biolumi.getFontStyle(),
        };
        const subcontentFontSpec = {
          fonts: biolumi.getFonts(),
          fontSize: 24,
          lineHeight: 1.4,
          fontWeight: biolumi.getFontWeight(),
          fontStyle: biolumi.getFontStyle(),
        };

        /* const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        }; */

        const _decorateEntity = entity => {
          const {id, name, displayName, module, attributes, instancing, metadata} = entity;

          const attributeSpecs = _clone(tags.getAttributeSpecs(module));
          for (const attributeName in attributes) {
            const attribute = attributes[attributeName];
            const {value} = attribute;

            const attributeSpec = attributeSpecs.find(attributeSpec => attributeSpec.name === attributeName);
            attributeSpec.value = value;
          }

          return {id, name, displayName, attributes: attributeSpecs, instancing, metadata};
        };
        const _updateNpm = () => {
          const {inputText} = npmState;

          const itemSpecs = tags.getTagMeshes()
            .filter(({item}) =>
              item.type === 'entity' &&
              !(item.metadata && item.metadata.isStatic) &&
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

        const entityMesh = (() => {
          const object = new THREE.Object3D();
          object.visible = false;

          const planeMesh = (() => {
            const worldUi = biolumi.makeUi({
              width: WIDTH,
              height: HEIGHT,
            });
            const mesh = worldUi.makePage(({
              npm: {
                loading,
                inputText: npmInputText,
                inputValue: npmInputValue,
                entity,
                tagSpecs,
                numTags,
                page,
              },
              focus: {
                keyboardFocusState,
              },
            }) => {
              const {type = '', inputText: attributeInputText = '', inputValue: attributeInputValue = 0} = keyboardFocusState || {};
              const focusSpec = (() => {
                let match;
                if (type === 'entity') {
                  return {
                    type: 'entity',
                  };
                } else if (match = type.match(/^entityAttribute:(.+?):(.+?)$/)) {
                  const tagId = match[1];
                  const attributeName = match[2];

                  return {
                    type: 'entityAttribute',
                    tagId: tagId,
                    attributeName: attributeName,
                  };
                } else if (match = type.match(/^entityAttributeColor:(.+?):(.+?)$/)) {
                  const tagId = match[1];
                  const attributeName = match[2];

                  return {
                    type: 'entityAttributeColor',
                    tagId: tagId,
                    attributeName: attributeName,
                  };
                } else {
                  return null;
                }
              })();

              return {
                type: 'html',
                src: entityRenderer.getEntityPageSrc({
                  loading,
                  npmInputText,
                  npmInputValue,
                  attributeInputText,
                  attributeInputValue,
                  entity: entity && _decorateEntity(entity),
                  tagSpecs,
                  numTags,
                  page,
                  focusSpec,
                }),
                x: 0,
                y: 0,
                w: WIDTH,
                h: HEIGHT,
              };
            }, {
              type: 'entity',
              state: {
                npm: npmState,
                focus: focusState,
              },
              worldWidth: WORLD_WIDTH,
              worldHeight: WORLD_HEIGHT,
              isEnabled: () => rend.isOpen(),
            });
            mesh.receiveShadow = true;

            const {page} = mesh;
            rend.addPage(page);

            cleanups.push(() => {
              rend.removePage(page);
            });

            return mesh;
          })();
          object.add(planeMesh);
          object.planeMesh = planeMesh;

          const shadowMesh = (() => {
            const geometry = new THREE.BoxBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT, 0.01);
            const material = transparentMaterial;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            return mesh;
          })();
          object.add(shadowMesh);

          return object;
        })();
        rend.registerMenuMesh('entityMesh', entityMesh);
        entityMesh.updateMatrixWorld();

        rend.reindex();
        rend.updateMatrixWorld(entityMesh);

        const _updatePages = () => {
          const {planeMesh} = entityMesh;
          const {page} = planeMesh;
          page.update();
        };
        _updatePages();

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

        const _trigger = e => {
          const {side} = e;

          const _clickMenu = () => {
            const hoverState = rend.getHoverState(side);
            const {anchor} = hoverState;
            const onclick = (anchor && anchor.onclick) || '';

            let match;
            if (onclick === 'entity:focus') {
              const {inputText} = npmState;
              const {value} = hoverState;
              const valuePx = value * (WIDTH - (250 + (30 * 2)));
              const {index, px} = biolumi.getTextPropertiesFromCoord(inputText, mainFontSpec, valuePx); // XXX this can be folded into the keyboard engine
              const {hmd: hmdStatus} = webvr.getStatus();
              const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmdStatus;
              const keyboardFocusState = keyboard.focus({
                type: 'entity',
                position: hmdPosition,
                rotation: hmdRotation,
                inputText: inputText,
                inputIndex: index,
                inputValue: px,
                fontSpec: mainFontSpec,
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

              npmState.tagSpecs = npmState.tagSpecs.filter(item => item.id !== tagId);
              _setEntity(null);

              return true;
            } else {
              return false;
            }
          };
          const _doClickAttribute = () => {
            const hoverState = rend.getHoverState(side);
            const {anchor} = hoverState;
            const onclick = (anchor && anchor.onclick) || '';

            let match;
            if (match = onclick.match(/^entityAttribute:([^:]+):([^:]+)(?::([^:]+))?:(focus|set|tweak|pick|color|toggle|choose)(?::([^:]+))?$/)) {
              const tagId = match[1];
              const attributeName = match[2];
              const key = match[3];
              const action = match[4];
              const value = match[5];

              const tagMesh = tags.getTagMeshes().find(tagMesh => tagMesh.item.id === tagId);
              const {item} = tagMesh;
              const {module, attributes} = item;
              const attribute = attributes[attributeName];
              const {value: attributeValue} = attribute;

              if (action === 'focus') {
                const {value: hoverValue} = hoverState;
                const {type} = tags.getAttributeSpec(module, attributeName);

                const textProperties = (() => {
                  if (type === 'text') {
                    const hoverValuePx = hoverValue * 400;
                    return biolumi.getTextPropertiesFromCoord(menuUtils.castValueValueToString(attributeValue, type), subcontentFontSpec, hoverValuePx);
                  } else if (type === 'number') {
                    const hoverValuePx = hoverValue * 100;
                    return biolumi.getTextPropertiesFromCoord(menuUtils.castValueValueToString(attributeValue, type), subcontentFontSpec, hoverValuePx);
                  } else if (type === 'color') {
                    const hoverValuePx = hoverValue * (400 - (40 + 4));
                    return biolumi.getTextPropertiesFromCoord(menuUtils.castValueValueToString(attributeValue, type), subcontentFontSpec, hoverValuePx);
                  } else {
                    return null;
                  }
                })();
                const keyboardFocusState = (() => {
                  if (textProperties) {
                    const {hmd: hmdStatus} = webvr.getStatus();
                    const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmdStatus;
                    const inputText = menuUtils.castValueValueToString(attributeValue, type);
                    const {index, px} = textProperties;
                    return keyboard.focus({
                      type: 'entityAttribute:' + tagId + ':' + attributeName,
                      position: hmdPosition,
                      rotation: hmdRotation,
                      inputText: inputText,
                      inputIndex: index,
                      inputValue: px,
                      fontSpec: subcontentFontSpec,
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
              }

              return true;
            } else {
              return false;
            }
          };

          if (_clickMenu() || _doClickAttribute()) {
            e.stopImmediatePropagation();
          }
        };
        input.on('trigger', _trigger);

        cleanups.push(() => {
          rend.removeListener('tabchange', _tabchange);
          rend.removeListener('entitychange', _entitychange);
          input.removeListener('trigger', _trigger);
        });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _clone = o => JSON.parse(JSON.stringify(o));
const _roundToDecimals = (value, decimals) => Number(Math.round(value+'e'+decimals)+'e-'+decimals);

module.exports = Entity;
