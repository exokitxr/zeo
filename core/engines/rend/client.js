import Stats from 'stats.js';
import whatkey from 'whatkey';
import prettyBytes from 'pretty-bytes';

import {
  WIDTH,
  HEIGHT,
  ASPECT_RATIO,
  MENU_SIZE,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
  STATS_REFRESH_RATE,
} from './lib/constants/menu';
import keyboard from './lib/images/keyboard';
import menuShaders from './lib/shaders/menu';
import menuRender from './lib/render/menu';

const keyboardImgSrc = 'data:image/svg+xml;' + keyboard;

const WIDTH = 2 * 1024;
const HEIGHT = WIDTH / 1.5;
const ASPECT_RATIO = WIDTH / HEIGHT;

const MENU_SIZE = 2;
const WORLD_WIDTH = MENU_SIZE;
const WORLD_HEIGHT = WORLD_WIDTH / ASPECT_RATIO;
const WORLD_DEPTH = MENU_SIZE / 50;

const STATS_REFRESH_RATE = 1000;

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

        const menuRenderer = menuRender.makeRenderer({
          creatureUtils,
        });

        // main state
        const worlds = new Map();
        let currentWorld = null;
        const worldMods = new Map();
        let currentWorldMods = null;
        let currentMainReadme = null;

        cleanups.push(() => {
          worlds.forEach(world => {
            world.destroy();
          });
        });

        const stats = new Stats();
        stats.render = () => {}; // overridden below

        const _getCurrentWorld = () => currentWorld;
        const _requestChangeWorld = worldName => new Promise((accept, reject) => {
          const world = worlds.get(worldName);

          if (world) {
            currentWorld = world;
            currentWorldMods = worldMods.get(worldName);

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

                // mods management
                const modApis = new Map();

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

                  // update mods
                  modApis.forEach(modApi => {
                    if (typeof modApi.update === 'function') {
                      modApi.update();
                    }
                  });
                });
                _addUpdateEye(camera => {
                  // update mods per eye
                  modApis.forEach(modApi => {
                    if (typeof modApi.updateEye === 'function') {
                      modApi.updateEye(camera);
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
                  .then(mod => {
                    const modName = archae.getName(mod);
                    modApis.set(modName, mod);

                    return mod;
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
                  .then(mod => {
                    const modName = archae.getName(mod);
                    modApis.delete(modName);

                    return mod;
                  });
                const _requestReleaseMods = mods => Promise.all(mods.map(_requestReleaseMod));
                const _requestWorker = (module, options) => archae.requestWorker(module, options);
                const _destroy = () => {
                  if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                  }
                };

                // load world mods
                // XXX make menu initialization return a first-class api, break this out into a separate world mods initialization step, and use the menu api to render the load
                // elementsState.loading = true;
                Promise.resolve()
                  .then(() => _requestMods(modsStatus.filter(mod => mod.installed).map(mod => '/extra/plugins/zeo/' + mod.name)))
                  .then(() => {
                    console.log('world mods loaded');

                    /* const availableElements = (() => { // XXX
                      const result = [];
                      modApis.forEach((modApi, modName) => {
                        const {templates} = modApi;
                        result.push.apply(result, _clone(templates));
                      });
                      return result;
                    })();
                    elementsState.availableElements = availableElements;
                    elementsState.loading = false;

                    _updatePages(); */
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

                worldMods.set(worldName, modsStatus);
                currentWorldMods = modsStatus;

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
              worldMods.delete(worldName);

              if (currentWorld && currentWorld.name === worldName) {
                currentWorld = null;
                currentWorldMods = null;
              }

              accept();
            })
            .catch(reject); */
        });
        const _requestGetElements = worldName => fetch('/archae/rend/worlds/' + worldName + '/elements.json').then(res => res.json().then(j => j.elements));
        const _requestSetElements = (worldName, elements) => fetch('/archae/rend/worlds/' + worldName + '/elements.json', {
          method: 'PUT',
          body: JSON.stringify({
            elements,
          }, null, 2),
        }).then(res => res.blob().then(() => {}));

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
            const itemsFontSpec = {
              fonts: biolumi.getFonts(),
              fontSize: 32,
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

            const _pathJoin = (a, b) => a + (!/\/$/.test(a) ? '/' : '') + b;
            const _clone = o => JSON.parse(JSON.stringify(o));
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

            const menuImageShader = menuShaders.getMenuImageShader({maxNumTextures});

            return biolumi.requestUi({
              width: WIDTH,
              height: HEIGHT,
            }).then(ui => {
              if (live) {
                const focusState = {
                  type: null,
                };
                const worldsState = {
                  worlds: [
                    {
                      name: 'Proteus',
                      description: 'The default zeo.sh world',
                    },
                    {
                      name: 'Midgar',
                      description: 'Alternate zeo.sh world',
                    },
                    {
                      name: 'Mako Reactor',
                      description: 'Taken from Final Fantasy VII. Straight copy.',
                    },
                  ],
                  selectedName: 'Proteus',
                  inputText: '',
                  inputIndex: 0,
                  inputValue: 0,
                };
                const modsState = {
                  mods: _cleanMods(currentWorldMods),
                  inputText: '',
                  inputIndex: 0,
                  inputValue: 0,
                };
                const configState = {
                  inputText: 'Hello, world! This is some text!',
                  inputIndex: 0,
                  inputValue: 0,
                  sliderValue: 0.5,
                  checkboxValue: false,
                };
                const statsState = {
                  frame: 0,
                };
                const elementsState = {
                  elements: [
                    {
                      tag: 'archae',
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
                          tag: 'sub',
                          attributes: {
                            rotation: {
                              type: 'position',
                              value: [0, Math.PI, 0].join(' '),
                            },
                          },
                          children: [],
                        },
                        {
                          tag: 'subsub',
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
                      tag: 'text',
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
                    /* {
                      tag: 'model',
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
                      tag: 'model',
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
                    }, */
                  ],
                  clipboardElements: [
                    {
                      tag: 'model',
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
                          tag: 'submodel',
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
                  loading: false,
                };
                const filesState = {
                  cwd: fs.getCwd(),
                  files: [],
                  inputText: '',
                  inputIndex: 0,
                  inputValue: 0,
                  selectedName: '',
                  clipboardType: null,
                  clipboardPath: '',
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

                ui.pushPage(({config: {checkboxValue}, stats: {frame}}) => {
                  const img = (() => {
                    if (checkboxValue) {
                      const statsImg = stats.dom.childNodes[0];
                      statsImg.needsUpdate = true;
                      return statsImg;
                    } else {
                      return transparentImg;
                    }
                  })();

                  return [
                    {
                      type: 'image',
                      img,
                      x: 0,
                      y: HEIGHT - (500 * (48 / 80)),
                      w: 500,
                      h: 500 * (48 / 80),
                    },
                  ];
                }, {
                  type: 'stats',
                  state: {
                    config: {
                      checkboxValue: configState.checkboxValue,
                    },
                    stats: statsState,
                  },
                  immediate: true,
                });

                ui.pushPage([
                  {
                    type: 'html',
                    src: menuRenderer.getMainPageSrc(),
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
                  immediate: true,
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
                    const shaderUniforms = THREE.UniformsUtils.clone(menuImageShader.uniforms);
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
                      vertexShader: menuImageShader.vertexShader,
                      fragmentShader: menuImageShader.fragmentShader,
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

                stats.render = (() => {
                  return () => {
                    const {frame: oldFrame} = statsState;
                    const newFrame = Math.floor(Date.now() / STATS_REFRESH_RATE);
                    if (newFrame !== oldFrame) {
                      statsState.frame = newFrame;

                      _updatePages();
                    }
                  };
                })();

                const _updatePages = () => {
                  const pages = ui.getPages();
                  for (let i = 0; i < pages.length; i++) {
                    const page = pages[i];
                    const {type} = page;

                    let match;
                    if (type === 'stats') {
                      page.update({
                        config: {
                          checkboxValue: configState.checkboxValue,
                        },
                        stats: statsState,
                      });
                    } else if (type === 'worlds') {
                      page.update({
                        worlds: worldsState,
                        focus: focusState,
                      });
                    } else if (type === 'mods') {
                      page.update({
                        mods: modsState,
                        focus: focusState,
                      });
                    } else if (match = type.match(/^mod:(.+)$/)) {
                      const name = match[1];
                      const mods = currentWorldMods;
                      const mod = mods.find(m => m.name === name);

                      page.update({mod});
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
                    const {selectedName: oldWorldsSelectedName} = worldsState;
                    const {selectedKeyPath: oldElementsSelectedKeyPath} = elementsState;
                    const {selectedName: oldFilesSelectedName} = filesState;

                    focusState.type = '';
                    worldsState.selectedName = '';
                    filesState.selectedName = '';

                    let match;
                    if (onclick === 'back') {
                      ui.cancelTransition();

                      if (ui.getPages().length > 1) {
                        ui.popPage();
                      }
                    } else if (onclick === 'worlds') {
                      ui.cancelTransition();

                      ui.pushPage(({worlds: {worlds, selectedName, inputText, inputValue}, focus: {type: focusType}}) => ([
                        {
                          type: 'html',
                          src: menuRenderer.getWorldsPageSrc({worlds, selectedName, inputText, inputValue, focusType}),
                        },
                        {
                          type: 'image',
                          img: creatureUtils.makeAnimatedCreature('worlds'),
                          x: 150,
                          y: 0,
                          w: 150,
                          h: 150,
                          frameTime: 300,
                        }
                      ]), {
                        type: 'worlds',
                        state: {
                          worlds: worldsState,
                          focus: focusState,
                        },
                      });
                    } else if (match = onclick.match(/^world:(.+)$/)) {
                      const name = match[1];

                      worldsState.selectedName = name;

                      _updatePages();
                    } else if (onclick === 'worlds:rename') {
                      if (oldWorldsSelectedName) {
                        worldsState.inputText = '';
                        worldsState.inputIndex = 0;
                        worldsState.inputValue = 0;

                        focusState.type = 'worlds:rename:' + oldWorldsSelectedName;

                        _updatePages();
                      }
                    } else if (onclick === 'worlds:remove') {
                      if (oldWorldsSelectedName) {
                        const {worlds} = worldsState;
                        worldsState.worlds = worlds.filter(world => world.name !== oldWorldsSelectedName);

                        _updatePages();
                      }
                    } else if (onclick === 'worlds:create') {
                      worldsState.inputText = '';
                      worldsState.inputIndex = 0;
                      worldsState.inputValue = 0;
                      
                      focusState.type = 'worlds:create';

                      _updatePages();
                    } else if (onclick === 'mods') {
                      ui.cancelTransition();

                      const mods = currentWorldMods;

                      ui.pushPage(({mods: {inputText, inputValue, mods}, focus: {type: focusType}}) => ([
                        {
                          type: 'html',
                          src: menuRenderer.getModsPageSrc({mods, inputText, inputValue, focus: focusType === 'mods'}),
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
                    } else if (match = onclick.match(/^mod:(.+)$/)) {
                      const name = match[1];
                      const mods = currentWorldMods;
                      const mod = mods.find(m => m.name === name);

                      ui.cancelTransition();

                      ui.pushPage(({mod: {name, version, installed, readme}}) => ([
                        {
                          type: 'html',
                          src: menuRenderer.getModPageSrc({name, version, installed}),
                        },
                        {
                          type: 'html',
                          src: menuRenderer.getModPageReadmeSrc({readme: readme || '<h1>No readme for `' + name + '@' + version + '`</h1>'}),
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

                      ui.pushPage(({config: {inputText, inputValue, sliderValue, checkboxValue}, focus: {type: focusType}}) => ([
                        {
                          type: 'html',
                          src: menuRenderer.getConfigPageSrc(),
                        },
                        {
                          type: 'html',
                          src: menuRenderer.getConfigPageContentSrc({inputText, inputValue, focus: focusType === 'config', sliderValue, checkboxValue}),
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
                            src: menuRenderer.getElementsPageSrc(),
                          },
                          {
                            type: 'html',
                            src: menuRenderer.getElementsPageContentSrc({elements, selectedKeyPath, draggingKeyPath}),
                            x: 500,
                            y: 150 + 2,
                            w: WIDTH - (500 + 600),
                            h: HEIGHT - (150 + 2),
                            scroll: true,
                          },
                          {
                            type: 'html',
                            src: menuRenderer.getElementsPageSubcontentSrc({elements, availableElements, clipboardElements, selectedKeyPath, draggingKeyPath, inputText, inputValue, focusAttribute}),
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

                      ui.pushPage(({files: {cwd, files, inputText, inputValue, selectedName, clipboardPath, loading, uploading}, focus: {type: focusType}}) => ([
                        {
                          type: 'html',
                          src: menuRenderer.getFilesPageSrc({cwd, files, inputText, inputValue, selectedName, clipboardPath, loading, uploading, focusType}),
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
                    } else if (match = onclick.match(/^files:(cut|copy)$/)) {
                      if (oldFilesSelectedName) {
                        const type = match[1];
                        const {cwd} = filesState;
                        const cutPath = _pathJoin(cwd, oldFilesSelectedName);

                        filesState.selectedName = oldFilesSelectedName;
                        filesState.clipboardType = type;
                        filesState.clipboardPath = cutPath;

                        _updatePages();
                      }
                    } else if (onclick === 'files:paste') {
                      const {clipboardPath} = filesState;

                      if (clipboardPath) {
                        filesState.uploading = true;

                        const {cwd, clipboardType, clipboardPath} = filesState;

                        const src = clipboardPath;
                        const name = clipboardPath.match(/\/([^\/]*)$/)[1];
                        const dst = _pathJoin(cwd, name);
                        fs[(clipboardType === 'cut') ? 'move' : 'copy'](src, dst)
                          .then(() => fs.getDirectory(cwd)
                            .then(files => {
                              filesState.files = _getFilesSpecs(files);
                              filesState.selectedName = name;
                              filesState.uploading = false;
                              if (clipboardType === 'cut') {
                                filesState.clipboardType = 'copy';
                                filesState.clipboardPath = dst;
                              }

                              _updatePages();
                            })
                          )
                          .catch(err => {
                            console.warn(err);

                            filesState.uploading = true;

                            _updatePages();
                          });

                        _updatePages();
                      }
                    } else if (onclick === 'files:createdirectory') {
                      focusState.type = 'files:createdirectory';

                      _updatePages();
                    } else if (onclick === 'files:rename') {
                      if (oldFilesSelectedName) {
                        filesState.inputText = '';
                        filesState.inputIndex = 0;
                        filesState.inputValue = 0;

                        focusState.type = 'files:rename:' + oldFilesSelectedName;

                        _updatePages();
                      }
                    } else if (onclick === 'files:remove') {
                      if (oldFilesSelectedName) {
                        filesState.uploading = true;

                        const {cwd} = filesState;
                        const p = _pathJoin(cwd, oldFilesSelectedName);
                        fs.remove(p)
                          .then(() => fs.getDirectory(cwd)
                            .then(files => {
                              filesState.files = _getFilesSpecs(files);
                              const {clipboardPath} = filesState;
                              if (clipboardPath === p) {
                                filesState.clipboardType = null;
                                filesState.clipboardPath = '';
                              }
                              filesState.uploading = false;

                              _updatePages();
                            })
                          )
                          .catch(err => {
                            console.warn(err);

                            filesState.uploading = false;

                            _updatePages();
                          });

                        _updatePages();
                      }
                    } else if (onclick === 'element:add') {
                      _insertElementAtKeyPath({
                        elements: elementsState.elements,
                        availableElements: elementsState.availableElements,
                        clipboardElements: elementsState.clipboardElements,
                      }, oldElementsSelectedKeyPath.length > 0 ? oldElementsSelectedKeyPath : ['elements']);

                      _updatePages();
                    } else if (match = onclick.match(/^element:attribute:(.+?):(focus|set|tweak|toggle)(?::(.+?))?$/)) {
                      const name = match[1];
                      const action = match[2];
                      const value = match[3];

                      const element = _getElementKeyPath({
                        elements: elementsState.elements,
                        availableElements: elementsState.availableElements,
                        clipboardElements: elementsState.clipboardElements,
                      }, oldElementsSelectedKeyPath);
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

                      elementsState.selectedKeyPath = oldElementsSelectedKeyPath;

                      _updatePages();
                    } else if (onclick === 'mods:input') {
                      const {value} = hoverState;
                      const valuePx = value * (WIDTH - (500 + 40));

                      const {index, px} = getTextPropertiesFromCoord(modsState.inputText, mainFontSpec, valuePx);

                      modsState.inputIndex = index;
                      modsState.inputValue = px;
                      focusState.type = 'mods';

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
                    } else if (onclick === 'config:stats') {
                      const {checkboxValue} = configState;

                      if (!checkboxValue) {
                        const width = 0.0005;
                        const height = width * (48 / 80);
                        const depth = -0.001;

                        configState.checkboxValue = true;
                      } else {
                        configState.checkboxValue = false;
                      }

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
                      const {selectedKeyPath: oldElementsSelectedKeyPath, draggingKeyPath: oldDraggingKeyPath} = elementsState;

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
                    focusState.type = '';

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
                  const {type} = focusState;

                  let match;
                  if (type === 'worlds') {
                    const applySpec = _applyStateKeyEvent(worldsState, itemsFontSpec, e);

                    if (applySpec) {
                      const {commit} = applySpec;
                      if (commit) {
                        const {worlds, inputText} = worldsState;
                        const name = inputText;

                        if (!worlds.some(world => world.name === name)) {
                          worldsState.worlds.push({
                            name,
                            description: '',
                          });
                        }
                      }

                      _updatePages();

                      e.stopImmediatePropagation();
                    }
                  } else if (match = type.match(/^worlds:rename:(.+)$/)) {
                    const applySpec = _applyStateKeyEvent(worldsState, itemsFontSpec, e);

                    if (applySpec) {
                      const {commit} = applySpec;
                      if (commit) {
                        const {worlds, inputText} = worldsState;
                        const oldName = match[1];
                        const newName = inputText;

                        if (!worlds.some(world => world.name === newName && world.name !== oldName)) {
                          const world = worlds.find(world => world.name === oldName);
                          world.name = newName;

                          worldsState.selectedName = newName;
                        }
                      }

                      _updatePages();

                      e.stopImmediatePropagation();
                    }
                  } else if (type === 'mods') {
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
                        modsState.mods = _cleanMods(currentWorldMods);
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
                  } else if (type === 'files:createdirectory') {
                    const applySpec = _applyStateKeyEvent(filesState, itemsFontSpec, e);

                    if (applySpec) {
                      const {commit} = applySpec;

                      if (commit) {
                        filesState.uploading = true;

                        const {files, inputText} = filesState;
                        const name = inputText;
                        if (!files.some(file => file.name === name)) {
                          const {cwd} = filesState;
                          fs.createDirectory(_pathJoin(cwd, name))
                            .then(() => fs.getDirectory(cwd)
                              .then(files => {
                                filesState.files = _getFilesSpecs(files);
                                filesState.uploading = false;

                                _updatePages();
                              })
                            )
                            .catch(err => {
                              console.warn(err);

                              filesState.uploading = false;

                              _updatePages();
                            });
                        }
                      }

                      _updatePages();

                      e.stopImmediatePropagation();
                    }
                  } else if (match = type.match(/^files:rename:(.+)$/)) {
                    const applySpec = _applyStateKeyEvent(filesState, itemsFontSpec, e);

                    if (applySpec) {
                      const {commit} = applySpec;
                      if (commit) {
                        const {files, inputText} = filesState;
                        const oldName = match[1];
                        const newName = inputText;

                        if (!files.some(file => file.name === newName && file.name !== oldName)) {
                          filesState.uploading = true;

                          const {cwd} = filesState;
                          const src = _pathJoin(cwd, oldName);
                          const dst = _pathJoin(cwd, newName);
                          fs.move(src, dst)
                            .then(() => fs.getDirectory(cwd)
                              .then(files => {
                                filesState.files = _getFilesSpecs(files);
                                filesState.selectedName = newName;
                                filesState.uploading = false;

                                _updatePages();
                              })
                            )
                            .catch(err => {
                              console.warn(err);

                              filesState.uploading = true;

                              _updatePages();
                            });
                        }
                      }

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

                          layer.img.needsUpdate = false;
                        } else if (layer.img.needsUpdate) {
                          textures.value[i].needsUpdate = true;

                          layer.img.needsUpdate = false;
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

              stats.render();
            };
            const _updateEye = camera => {
              for (let i = 0; i < updateEyes.length; i++) {
                const updateEye = updateEyes[i];
                updateEye(camera);
              }
            };
            const _updateStart = () => {
              stats.begin();
            };
            const _updateEnd = () => {
              stats.end();
            };

            return {
              getCurrentWorld: _getCurrentWorld,
              update: _update,
              updateEye: _updateEye,
              updateStart: _updateStart,
              updateEnd: _updateEnd,
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
