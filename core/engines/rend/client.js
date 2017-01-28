import Stats from 'stats.js';
import keycode from 'keycode';
import indev from 'indev'; // XXX source these from utils
import Kruskal from 'kruskal';

import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  NAVBAR_WIDTH,
  NAVBAR_HEIGHT,
  NAVBAR_WORLD_WIDTH,
  NAVBAR_WORLD_HEIGHT,
  NAVBAR_WORLD_DEPTH,

  DEFAULT_USER_HEIGHT,
  TRANSITION_TIME,
  STATS_REFRESH_RATE,
} from './lib/constants/menu';
import {
  KEYBOARD_WIDTH,
  KEYBOARD_HEIGHT,
  KEYBOARD_WORLD_WIDTH,
  KEYBOARD_WORLD_HEIGHT,
} from './lib/constants/keyboard';
import menuUtils from './lib/utils/menu';
import keyboardImg from './lib/images/keyboard';
import menuRender from './lib/render/menu';

const keyboardImgSrc = 'data:image/svg+xml,' + keyboardImg;

const STATS_REFRESH_RATE = 1000;

const SIDES = ['left', 'right'];

const ATTRIBUTE_DEFAULTS = {
  MIN: 0,
  MAX: 100,
  STEP: 0,
  OPTIONS: [],
};

class Rend {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata} = archae;

    let live = true;
    const cleanups = [];
    this._cleanup = () => {
      live = false;

      const oldCleanups = cleanups.slice();
      for (let i = 0; i < oldCleanups.length; i++) {
        const cleanup = oldCleanups[i];
        cleanup();
      }
    };

    return archae.requestPlugins([
      '/core/engines/hub',
      '/core/engines/input',
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/anima',
      '/core/engines/fs',
      '/core/engines/bullet',
      '/core/plugins/js-utils',
      '/core/plugins/geometry-utils',
      '/core/plugins/random-utils',
      '/core/plugins/creature-utils',
      '/core/plugins/sprite-utils',
    ]).then(([
      hub,
      input,
      three,
      webvr,
      biolumi,
      anima,
      fs,
      bullet,
      jsUtils,
      geometryUtils,
      randomUtils,
      creatureUtils,
      spriteUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;
        const {alea} = randomUtils;

        const transparentImg = biolumi.getTransparentImg();
        const maxNumTextures = biolumi.getMaxNumTextures();
        const transparentMaterial = biolumi.getTransparentMaterial();
        const solidMaterial = biolumi.getSolidMaterial();

        const menuRenderer = menuRender.makeRenderer({
          creatureUtils,
        });

        const localUpdates = [];

        // main state
        let api = null;
        let menu = null;
        let menuMesh = null;

        const menuState = {
          open: true,
          animation: null,
        };
        const focusState = {
          type: '',
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
          mods: [],
          localMods: [],
          remoteMods: [],
          tab: 'installed',
          inputText: '',
          inputIndex: 0,
          inputValue: 0,
          loadingLocal: false,
          loadingRemote: false,
          cancelLocalRequest: null,
          cancelRemoteRequest: null,
        };
        const modState = {
          modName: '',
          mod: null,
          loading: false,
          cancelRequest: null,
        };
        const configState = {
          inputText: 'Hello, world! This is some text!',
          inputIndex: 0,
          inputValue: 0,
          sliderValue: 0.5,
          airlockCheckboxValue: true,
          voiceChatCheckboxValue: false,
          statsCheckboxValue: false,
        };
        const statsState = {
          frame: 0,
        };
        const elementsState = {
          elements: [],
          availableElements: [],
          clipboardElements: [],
          elementInstances: [],
          selectedKeyPath: [],
          draggingKeyPath: [],
          positioningName: null,
          positioningSide: null,
          choosingName: null,
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
        const elementAttributeFilesState = {
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
        const _makeUniverseState = () => {
          const generator = indev({
            seed: '',
          });
          const noise = generator.simplex({
            frequency: 0.05,
            octaves: 4,
          });

          const _makeWorlds = () => {
            class Point extends THREE.Vector3 {
              constructor(x, y, z, value) {
                super(x, y, z);

                this.value = value;
              }
            }

            class World {
              constructor(worldName, point, rotation) {
                this.worldName = worldName;
                this.point = point;
                this.rotation = rotation;
              }
            }

            const worlds = (() => {
              const numPoints = 10;
              const size = 0.5;
              const resolution = 16;
              const heightScale = 0.2;
              const heightOffset = (0.005 * 12) / 2;

              const rng = new alea('');

              const result = Array(numPoints);
              for (let i = 0; i < numPoints; i++) {
                const x = rng();
                const y = rng();
                const height = noise.in2D(x * resolution, y * resolution);
                const value = rng();

                const point = new Point(
                  (-0.5 + x) * size,
                  (height * heightScale) + heightOffset,
                  (-0.5 + y) * size,
                  value
                );
                const rotation = value * (Math.PI * 2);
                const world = new World('world' + _pad(i, 2), point, rotation);
                result[i] = world;
              }
              return result;
            })();
            return worlds;
          };

          return {
            worlds: _makeWorlds(),
            noise,
          };
        };
        const universeState = _makeUniverseState();
        const navbarState = {
          tab: 'readme',
        };

        const worlds = new Map();
        let currentWorld = null;
        const modElementApis = {};

        const stats = new Stats();
        stats.render = () => {}; // overridden below

        // element helper functions
        const _cleanElementsState = elementsState => {
          const result = {};
          for (const k in elementsState) {
            if (k === 'elements' || k === 'availableElements' || k === 'clipboardElements') {
              result[k] = menuUtils.elementsToState(elementsState[k]);
            } else if (k !== 'elementInstances') {
              result[k] = elementsState[k];
            }
          }
          return result;
        };
        const _getModSpec = mod => new Promise((accept, reject) => {
          if (modState.cancelRequest) {
            modState.cancelRequest();
            modState.cancelRequest = null;
          }

          let live = true;
          modState.cancelRequest = () => {
            live = false;
          };

          fetch('/archae/rend/mods/spec', {
            method: 'POST',
            headers: (() => {
              const headers = new Headers();
              headers.set('Content-Type', 'application/json');
              return headers;
            })(),
            body: JSON.stringify({
              mod,
            }),
          }).then(res => res.json()
            .then(modSpecs => {
              if (live) {
                accept(modSpecs);

                modState.cancelRequest = null;
              }
            })
            .catch(err => {
              if (live) {
                reject(err);

                modState.cancelRequest = null;
              }
            })
          );
        });
        const _getLocalModSpecs = () => new Promise((accept, reject) => {
          if (modsState.cancelLocalRequest) {
            modsState.cancelLocalRequest();
            modsState.cancelLocalRequest = null;
          }

          let live = true;
          modsState.cancelLocalRequest = () => {
            live = false;
          };

          fetch('/archae/rend/mods/local').then(res => res.json()
            .then(modSpecs => {
              if (live) {
                accept(modSpecs);

                modsState.cancelLocalRequest = null;
              }
            })
            .catch(err => {
              if (live) {
                reject(err);

                modsState.cancelLocalRequest = null;
              }
            })
          );
        });
        const _getRemoteModSpecs = q => new Promise((accept, reject) => {
          if (modsState.cancelRemoteRequest) {
            modsState.cancelRemoteRequest();
            modsState.cancelRemoteRequest = null;
          }

          let live = true;
          modsState.cancelRemoteRequest = () => {
            live = false;
          };

          fetch('/archae/rend/mods/search', {
            method: 'POST',
            headers: (() => {
              const headers = new Headers();
              headers.set('Content-Type', 'application/json');
              return headers;
            })(),
            body: JSON.stringify({
              q,
            }),
          }).then(res => res.json()
            .then(modSpecs => {
              if (live) {
                accept(modSpecs);

                modsState.cancelRemoteRequest = null;
              }
            })
            .catch(err => {
              if (live) {
                reject(err);

                modsState.cancelRemoteRequest = null;
              }
            })
          );
        });

        // mod helper functions
        const _requestMod = mod => archae.requestPlugin(mod)
          .then(modApi => {
            menu.updatePages();

            return modApi;
          });
        const _requestMods = mods => Promise.all(mods.map(mod => _requestMod(mod)));
        const _releaseMod = mod => archae.releasePlugin(mod)
          .then(() => {
            menu.updatePages();
          });
        const _releaseMods = mods => Promise.all(mods.map(mod => _releaseMod(mod)));
        const _addModApiElement = elementApi => {
          const {tag} = elementApi;

          modElementApis[tag] = elementApi;

          const element = menuUtils.elementApiToElement(elementApi);
          elementsState.availableElements.push(element);
        };
        const _removeModApiElement = elementApi => {
          const {tag} = elementApi;

          delete modElementApis[tag];

          elementsState.availableElements = elementsState.availableElements.filter(element => {
            const {tagName} = element;
            const elementTag = tagName.match(/^z-(.+)$/i)[1].toLowerCase();
            return elementTag !== tag;
          });
        };

        // api functions
        const _requestChangeWorld = worldName => new Promise((accept, reject) => {
          const _requestInstalledModSpecs = worldName => fetch('/archae/rend/mods/installed', {
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
            _requestGetConfig(worldName),
            _requestInstalledModSpecs(worldName),
            _requestGetElements(worldName),
            bullet.requestWorld(worldName),
          ])
            .then(([
              configSpec,
              installedModSpecs,
              elementsStatus,
              physics,
            ]) => {
              configState.airlockCheckboxValue = configSpec.airlock;
              configState.voiceChatCheckboxValue = configSpec.voiceChat;
              configState.statsCheckboxValue = configSpec.stats;

              menu.updatePages();

              const startTime = Date.now();
              let worldTime = 0;

              localUpdates.push(() => {
                const now = Date.now();
                worldTime = now - startTime;
              });

              // load world
              const _loadWorld = () => {
                const _loadMods = () => {
                  elementsState.loading = true;

                  return _requestMods(installedModSpecs.map(({name}) => name))
                    .then(() => {
                      console.log('world mods loaded');

                      elementsState.loading = false;

                      menu.updatePages();
                    });
                };
                const _loadElements = () => new Promise((accept, reject) => {
                  const elements = menuUtils.jsonToElements(modElementApis, elementsStatus.elements);
                  const clipboardElements = menuUtils.jsonToElements(modElementApis, elementsStatus.clipboardElements);
                  const elementInstances = menuUtils.constructElements(modElementApis, elements);

                  elementsState.elements = elements;
                  elementsState.clipboardElements = clipboardElements;
                  elementsState.elementInstances = elementInstances;

                  accept();
                });

                return _loadMods()
                  .then(() => _loadElements());
              };
              Promise.resolve()
                .then(() => _loadWorld())
                .catch(err => {
                  console.warn(err);
                });

              class World {
                constructor({name, physics}) {
                  this.name = name;
                  this.physics = physics;
                }

                getWorldTime() {
                  return worldTime;
                }

                requestAddMod(mod) {
                  return fetch('/archae/rend/mods/add', {
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
                  }).then(res => res.json()
                    .then(mod => {
                      ['localMods', 'remoteMods'].forEach(k => {
                        const modsCollection = modsState[k];
                        const index = modsCollection.findIndex(m => m.name === mod.name);
                        if (index !== -1) {
                          modsCollection.splice(index, 1);
                        }
                      });

                      modsState.mods.push(mod);

                      menu.updatePages();
                    })
                    .then(() => _requestMod(mod))
                  );
                }

                requestAddMods(mods) {
                  return Promise.all(mods.map(mod => this.requestAddMod(mod)));
                }

                requestRemoveMod(mod) {
                  return fetch('/archae/rend/mods/remove', {
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
                  }).then(res => res.json()
                    .then(mod => {
                      const index = modsState.mods.findIndex(m => m.name === mod.name);
                      if (index !== -1) {
                        modsState.mods.splice(index, 1);
                      }

                      const {local} = mod;
                      if (local) {
                        modsState.localMods.push(mod);
                      } else {
                        modsState.remoteMods.push(mod);
                      }

                      menu.updatePages();
                    })
                    .then(() => _releaseMod(mod))
                  );
                }

                requestRemoveMods(mods) {
                  return Promise.all(mods.map(mod => this.requestRemoveMod(mod)));
                }

                requestWorker(module, options) {
                  return archae.requestWorker(module, options);
                }
              }

              const world = new World({
                name: worldName,
                physics,
              });

              currentWorld = world;

              modsState.mods = installedModSpecs;

              accept();
            });
        });
        const _requestDeleteWorld = worldName => new Promise((accept, reject) => {
          accept();
          /* bullet.releaseWorld(worldName)
            .then(() => {
              if (currentWorld && currentWorld.name === worldName) {
                currentWorld = null;
              }

              accept();
            })
            .catch(reject); */
        });
        const _requestMainReadme = () => fetch('/archae/rend/readme').then(res => res.text());
        const _requestGetElements = world => fetch('/archae/rend/worlds/' + world + '/elements.json').then(res => res.json());
        const _requestSetElements = ({world, elements, clipboardElements}) => fetch('/archae/rend/worlds/' + world + '/elements.json', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            elements,
            clipboardElements,
          }),
        }).then(res => res.blob().then(() => {}));
        const _requestGetConfig = world => fetch('/archae/rend/worlds/' + world + '/config.json')
          .then(res => res.json());
        const _requestSetConfig = ({world, config}) => fetch('/archae/rend/worlds/' + world + '/config.json', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(config),
        }).then(res => res.blob().then(() => {}));
        const _saveElements = menuUtils.debounce(next => {
          const {name: worldName} = currentWorld;

          _requestSetElements({
            world: worldName,
            elements: menuUtils.elementsToJson(elementsState.elements),
            clipboardElements: menuUtils.elementsToJson(elementsState.clipboardElements),
          })
            .then(() => {
              console.log('saved elements for', JSON.stringify(worldName));

              next();
            })
            .catch(err => {
              console.warn(err);

              next();
            });
        });
        const _getConfig = () => ({
          airlock: configState.airlockCheckboxValue,
          voiceChat: configState.voiceChatCheckboxValue,
          stats: configState.statsCheckboxValue,
        });
        const _saveConfig = menuUtils.debounce(next => {
          const {name: worldName} = currentWorld;

          _requestSetConfig({
            world: worldName,
            config: _getConfig(),
          })
            .then(() => {
              console.log('saved config for', JSON.stringify(worldName));

              next();
            })
            .catch(err => {
              console.warn(err);

              next();
            });
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

            const _requestUis = () => Promise.all([
               biolumi.requestUi({
                 width: WIDTH,
                 height: HEIGHT,
              }),
              biolumi.requestUi({
                width: NAVBAR_WIDTH,
                height: NAVBAR_HEIGHT,
              }),
            ]).then(([
              menuUi,
              navbarUi,
            ]) => ({
              menuUi,
              navbarUi,
            }));

            return Promise.all([
              _requestUis(),
              _requestMainReadme(),
            ]).then(([
              {
                menuUi,
                navbarUi,
              },
              mainReadme,
            ]) => {
              if (live) {
                const uploadStart = () => {
                  const pages = menuUi.getPages();
                  if (pages.length > 0 && pages[pages.length - 1].type === 'files') { // XXX handle multiple uploads and elementAttributeFiles page
                    filesState.uploading = true;
                  }

                  _updatePages();
                }
                fs.addEventListener('uploadStart', uploadStart);
                const uploadEnd = () => {
                  filesState.uploading = false;
                  filesState.loading = true;

                  const {cwd} = filesState;
                  fs.getDirectory(cwd)
                    .then(files => {
                      filesState.files = menuUtils.cleanFiles(files);
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

                const {matrix: matrixArray} = hub.getUserState();
                if (matrixArray) {
                  webvr.setStageMatrix(new THREE.Matrix4().fromArray(matrixArray));
                  webvr.updateStatus();
                }

                const unload = e => {
                  hub.saveUserStateAsync();
                };
                window.addEventListener('unload', unload);
                cleanups.push(() => {
                  window.removeEventListener('unload', unload);
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

                menuUi.pushPage(({config: {statsCheckboxValue}, stats: {frame}}) => {
                  const img = (() => {
                    if (statsCheckboxValue) {
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
                      statsCheckboxValue: configState.statsCheckboxValue,
                    },
                    stats: statsState,
                  },
                  immediate: true,
                });

                menuUi.pushPage([
                  {
                    type: 'html',
                    src: menuRenderer.getMainPageSrc(),
                  },
                  {
                    type: 'html',
                    src: mainReadme,
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
                    pixelated: true,
                  }
                ], {
                  type: 'main',
                  immediate: true,
                });

                navbarUi.pushPage(({navbar: {tab}}) => {
                  return [
                    {
                      type: 'html',
                      src: menuRenderer.getNavbarSrc({tab}),
                      x: 0,
                      y: 0,
                      w: NAVBAR_WIDTH,
                      h: NAVBAR_HEIGHT,
                      scroll: true,
                    },
                  ];
                }, {
                  type: 'navbar',
                  state: {
                    navbar: navbarState,
                  },
                });

                const wireframeMaterial = new THREE.MeshBasicMaterial({
                  color: 0x808080,
                  wireframe: true,
                });
                const wireframeHighlightMaterial = new THREE.MeshBasicMaterial({
                  color: 0x0000FF,
                  wireframe: true,
                  opacity: 0.5,
                  transparent: true,
                });
                const linesMaterial = new THREE.LineBasicMaterial({
                  color: 0xFFFFFF,
                });
                const worldMaterial = new THREE.MeshPhongMaterial({
                  color: 0xFFFFFF,
                  shininess: 10,
                  vertexColors: THREE.FaceColors,
                });
                const cursorMaterial = new THREE.MeshPhongMaterial({
                  color: 0xFF0000,
                  shininess: 10,
                  shading: THREE.FlatShading,
                });

                menuMesh = (() => {
                  const object = new THREE.Object3D();
                  object.position.y = DEFAULT_USER_HEIGHT;

                  const planeMesh = (() => {
                    const width = WORLD_WIDTH;
                    const height = WORLD_HEIGHT;
                    const depth = WORLD_DEPTH;

                    const menuMaterial = biolumi.makeMenuMaterial();

                    const geometry = new THREE.PlaneBufferGeometry(width, height);
                    const materials = [solidMaterial, menuMaterial];

                    const mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, materials);
                    // mesh.position.y = 1.5;
                    mesh.position.z = -1;
                    mesh.receiveShadow = true;
                    mesh.menuMaterial = menuMaterial;

                    const shadowMesh = (() => {
                      const geometry = new THREE.BoxBufferGeometry(width, height, 0.01);
                      const material = transparentMaterial;
                      const mesh = new THREE.Mesh(geometry, material);
                      mesh.castShadow = true;
                      return mesh;
                    })();
                    mesh.add(shadowMesh);

                    return mesh;
                  })();
                  object.add(planeMesh);
                  object.planeMesh = planeMesh;

                  object.worldMesh = null;

                  const navbarMesh = (() => {
                    const width = NAVBAR_WORLD_WIDTH;
                    const height = NAVBAR_WORLD_HEIGHT;
                    const depth = NAVBAR_WORLD_DEPTH;

                    const menuMaterial = biolumi.makeMenuMaterial();

                    const geometry = new THREE.PlaneBufferGeometry(width, height);
                    const materials = [solidMaterial, menuMaterial];

                    const mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, materials);
                    mesh.position.y = -0.25;
                    mesh.position.z = -0.25;
                    mesh.receiveShadow = true;
                    mesh.menuMaterial = menuMaterial;

                    const shadowMesh = (() => {
                      const geometry = new THREE.BoxBufferGeometry(width, height, 0.01);
                      const material = transparentMaterial;
                      const mesh = new THREE.Mesh(geometry, material);
                      mesh.castShadow = true;
                      return mesh;
                    })();
                    mesh.add(shadowMesh);

                    return mesh;
                  })();
                  object.add(navbarMesh);
                  object.navbarMesh = navbarMesh;

                  object.inventoryMesh = null;

                  return object;
                })();
                scene.add(menuMesh);

                const menuBoxMeshes = {
                  left: biolumi.makeMenuBoxMesh(),
                  right: biolumi.makeMenuBoxMesh(),
                };
                scene.add(menuBoxMeshes.left);
                scene.add(menuBoxMeshes.right);

                const navbarBoxMeshes = {
                  left: biolumi.makeMenuBoxMesh(),
                  right: biolumi.makeMenuBoxMesh(),
                };
                scene.add(navbarBoxMeshes.left);
                scene.add(navbarBoxMeshes.right);

                const menuDotMeshes = {
                  left: biolumi.makeMenuDotMesh(),
                  right: biolumi.makeMenuDotMesh(),
                };
                scene.add(menuDotMeshes.left);
                scene.add(menuDotMeshes.right);

                const universeBoxMeshes = {
                  left: biolumi.makeMenuBoxMesh(),
                  right: biolumi.makeMenuBoxMesh(),
                };
                scene.add(universeBoxMeshes.left);
                scene.add(universeBoxMeshes.right);

                const keyboardMesh = (() => {
                  const keySpecs = (() => {
                    const div = document.createElement('div');
                    div.style.cssText = 'position: absolute; top: 0; left: 0; width: ' + KEYBOARD_WIDTH + 'px; height: ' + KEYBOARD_HEIGHT + 'px;';
                    div.innerHTML = keyboardImg;

                    document.body.appendChild(div);

                    const keyEls = div.querySelectorAll(':scope > svg > g[key]');
                    const result = Array(keyEls.length);
                    for (let i = 0; i < keyEls.length; i++) {
                      const keyEl = keyEls[i];
                      const key = keyEl.getAttribute('key');
                      const rect = keyEl.getBoundingClientRect();

                      const keySpec = {key, rect};
                      result[i] = keySpec;
                    }

                    document.body.removeChild(div);

                    return result;
                  })();

                  const object = new THREE.Object3D();
                  object.position.y = DEFAULT_USER_HEIGHT;
                  object.keySpecs = keySpecs;

                  const planeMesh = (() => {
                    const _requestKeyboardImage = () => new Promise((accept, reject) => {
                      const img = new Image();
                      img.src = keyboardImgSrc;
                      img.onload = () => {
                        accept(img);
                      };
                      img.onerror = err => {
                        reject(err);
                      };
                    });

                    const geometry = new THREE.PlaneBufferGeometry(KEYBOARD_WORLD_WIDTH, KEYBOARD_WORLD_HEIGHT);
                    const material = (() => {
                      const texture = new THREE.Texture(
                        transparentImg,
                        THREE.UVMapping,
                        THREE.ClampToEdgeWrapping,
                        THREE.ClampToEdgeWrapping,
                        THREE.LinearFilter,
                        THREE.LinearFilter,
                        THREE.RGBAFormat,
                        THREE.UnsignedByteType,
                        16
                      );

                      _requestKeyboardImage()
                        .then(img => {
                          texture.image = img;
                          texture.needsUpdate = true;
                        })
                        .catch(err => {
                          console.warn(err);
                        });

                      const material = new THREE.MeshBasicMaterial({
                        map: texture,
                        side: THREE.DoubleSide,
                        transparent: true,
                        alphaTest: 0.5,
                      });
                      return material;
                    })();
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.y = 1 - DEFAULT_USER_HEIGHT;
                    mesh.rotation.x = -Math.PI * (3 / 8);

                    const shadowMesh = (() => {
                      const geometry = new THREE.BoxBufferGeometry(KEYBOARD_WORLD_WIDTH, KEYBOARD_WORLD_HEIGHT, 0.01);
                      const material = transparentMaterial;
                      const mesh = new THREE.Mesh(geometry, material);
                      mesh.castShadow = true;
                      return mesh;
                    })();
                    mesh.add(shadowMesh);

                    return mesh;
                  })();
                  object.add(planeMesh);
                  object.planeMesh = planeMesh;

                  return object;
                })();
                scene.add(keyboardMesh);

                const keyboardBoxMeshes = {
                  left: biolumi.makeMenuBoxMesh(),
                  right: biolumi.makeMenuBoxMesh(),
                };
                scene.add(keyboardBoxMeshes.left);
                scene.add(keyboardBoxMeshes.right);

                const universeMesh = (() => {
                  const object = new THREE.Object3D();
                  object.position.set(0, 1.2, -0.5);
                  // object.scale.set(0.5, 0.5, 0.5);
                  object.visible = false;

                  const innerMesh = (() => {
                    const size = 0.5;
                    const resolution = 16;
                    const heightScale = 0.2;

                    const object = new THREE.Object3D();
                    object.size = size;
                    object.resolution = resolution;
                    object.heightScale = heightScale;

                    const {worlds} = universeState;
                    const worldsMesh = (() => {
                      const result = new THREE.Object3D();

                      const _requestWorldMesh = world => new Promise((accept, reject) => {
                        const {worldName, point, rotation} = world;

                        const img = new Image();
                        img.src = creatureUtils.makeStaticCreature('world:' + worldName);
                        img.onload = () => {
                          const geometry = spriteUtils.makeImageGeometry(img, 0.005);
                          geometry.applyMatrix(new THREE.Matrix4().makeRotationY(rotation));
                          const material = worldMaterial;

                          const mesh = new THREE.Mesh(geometry, material);
                          mesh.position.copy(point);

                          accept(mesh);
                        };
                        img.onerror = err => {
                          reject(err);
                        };
                      });

                      for (let i = 0; i < worlds.length; i++) {
                        const world = worlds[i];
                        _requestWorldMesh(world)
                          .then(worldMesh => {
                            result.add(worldMesh);
                          })
                          .catch(err => {
                            console.warn(err);
                          });
                      }

                      return result;
                    })();
                    object.add(worldsMesh);

                    const linesMesh = (() => {
                      const geometry = new THREE.BufferGeometry();
                      const positions = (() => {
                        const result = [];

                        const edges = (() => {
                          const result = Array(worlds.length * worlds.length);
                          for (let i = 0; i < worlds.length; i++) {
                            for (let j = 0; j < worlds.length; j++) {
                              result[(i * worlds.length) + j] = [i, j];
                            }
                          }
                          return result;
                        })();
                        const edgeMST = Kruskal.kruskal(worlds, edges, (a, b) => a.point.distanceTo(b.point));
                        for (let i = 0; i < edgeMST.length; i++) {
                          const u = worlds[edgeMST[i][0]].point;
                          const v = worlds[edgeMST[i][1]].point;
                          result.push(u.x, u.y, u.z, v.x, v.y, v.z);
                        }

                        return Float32Array.from(result);
                      })();
                      geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
                      const material = linesMaterial;

                      const mesh = new THREE.LineSegments(geometry, material);
                      return mesh;
                    })();
                    object.add(linesMesh);

                    const cursorMesh = (() => {
                      const currentWorldName = hub.getWorldName();
                      const selectedWorld = worlds.find(world => world.worldName === currentWorldName) || worlds[0];
                      const {point} = selectedWorld;

                      const geometry = new THREE.TetrahedronBufferGeometry(0.01, 0);
                      geometry.applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI * (1/6 + 1/12)));
                      geometry.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI * (1/3 - 1/64)));
                      geometry.applyMatrix(new THREE.Matrix4().makeRotationY(Math.PI));
                      const material = cursorMaterial;

                      const mesh = new THREE.Mesh(geometry, material);
                      mesh.position.copy(point.clone().add(new THREE.Vector3(0, 0.005 * (12 + 1), 0)));
                      return mesh;
                    })();
                    object.add(cursorMesh);

                    const floorMesh = (() => {
                      const geometry = (() => {
                        const {noise} = universeState;

                        const result = new THREE.PlaneBufferGeometry(size, size, resolution, resolution);
                        result.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI / 2));
                        const positionAttribute = result.getAttribute('position');
                        const positions = positionAttribute.array;
                        const numPositions = positions.length / 3;
                        for (let i = 0; i < numPositions; i++) {
                          const baseIndex = i * 3;
                          const x = (positions[baseIndex + 0] + (size / 2)) / size * resolution;
                          const y = (-positions[baseIndex + 2] + (size / 2)) / size * resolution;

                          const height = noise.in2D(x, y) * heightScale;
                          positions[baseIndex + 1] = height;
                        }
                        // positionAttribute.needsUpdate = true;
                        return result;
                      })();

                      const material = wireframeMaterial;

                      const mesh = new THREE.Mesh(geometry, material);
                      return mesh;
                    })();
                    object.add(floorMesh);
                    object.floorMesh = floorMesh;

                    return object;
                  })();
                  object.add(innerMesh);
                  object.innerMesh = innerMesh;

                  const _makeFloorBoxMesh = () => {
                    const {size} = innerMesh;

                    const geometry = new THREE.BoxBufferGeometry(size, size, size);
                    const material = wireframeHighlightMaterial;

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.visible = false;
                    return mesh;
                  };
                  const floorBoxMeshes = {
                    left: _makeFloorBoxMesh(),
                    right: _makeFloorBoxMesh(),
                  };
                  object.add(floorBoxMeshes.left);
                  object.add(floorBoxMeshes.right);
                  object.floorBoxMeshes = floorBoxMeshes;

                  return object;
                })();
                scene.add(universeMesh);

                const _makePositioningMesh = ({opacity = 1} = {}) => {
                  const geometry = (() => {
                    const result = new THREE.BufferGeometry();
                    const positions = Float32Array.from([
                      0, 0, 0,
                      0.1, 0, 0,
                      0, 0, 0,
                      0, 0.1, 0,
                      0, 0, 0,
                      0, 0, 0.1,
                    ]);
                    result.addAttribute('position', new THREE.BufferAttribute(positions, 3));
                    const colors = Float32Array.from([
                      1, 0, 0,
                      1, 0, 0,
                      0, 1, 0,
                      0, 1, 0,
                      0, 0, 1,
                      0, 0, 1,
                    ]);
                    result.addAttribute('color', new THREE.BufferAttribute(colors, 3));
                    return result;
                  })();
                  const material = new THREE.LineBasicMaterial({
                    // color: 0xFFFFFF,
                    // color: 0x333333,
                    vertexColors: THREE.VertexColors,
                    opacity: opacity,
                  });

                  const mesh = new THREE.LineSegments(geometry, material);
                  mesh.visible = false;
                  return mesh;
                };
                const positioningMesh = _makePositioningMesh();
                scene.add(positioningMesh);
                const oldPositioningMesh = _makePositioningMesh({
                  opacity: 0.5,
                });
                scene.add(oldPositioningMesh);

                stats.render = () => {
                  const {frame: oldFrame} = statsState;
                  const newFrame = Math.floor(Date.now() / STATS_REFRESH_RATE);
                  if (newFrame !== oldFrame) {
                    statsState.frame = newFrame;

                    _updatePages();
                  }
                };

                const _updatePages = menuUtils.debounce(next => {

                  const menuPages = menuUi.getPages();
                  const navbarPages = navbarUi.getPages();
                  const pages = menuPages.concat(navbarPages);

                  if (pages.length > 0) {
                    let pending = pages.length;
                    const pend = () => {
                      if (--pending === 0) {
                        next();
                      }
                    };

                    for (let i = 0; i < pages.length; i++) {
                      const page = pages[i];
                      const {type} = page;

                      let match;
                      if (type === 'stats') {
                        page.update({
                          config: {
                            statsCheckboxValue: configState.statsCheckboxValue,
                          },
                          stats: statsState,
                        }, pend);
                      } else if (type === 'worlds') {
                        page.update({
                          worlds: worldsState,
                          focus: focusState,
                        }, pend);
                      } else if (type === 'mods') {
                        page.update({
                          mods: modsState,
                          focus: focusState,
                        }, pend);
                      } else if (type === 'mod') {
                        page.update({
                          mod: modState,
                          mods: modsState,
                        }, pend);
                      } else if (type === 'elements') {
                        page.update({
                          elements: _cleanElementsState(elementsState),
                          focus: focusState,
                        }, pend);
                      } else if (type === 'files') {
                        page.update({
                          files: filesState,
                          focus: focusState,
                        }, pend);
                      } else if (type === 'elementAttributeFiles') {
                        page.update({
                          elementAttributeFiles: elementAttributeFilesState,
                          focus: focusState,
                        }, pend);
                      } else if (type === 'config') {
                        page.update({
                          config: configState,
                          focus: focusState,
                        }, pend);
                      } else if (type === 'navbar') {
                        page.update({
                          navbar: navbarState,
                        }, pend);
                      } else {
                        pend();
                      }
                    }
                  } else {
                    next();
                  }
                });
                const trigger = e => {
                  const {open} = menuState;

                  if (open) {
                    const oldStates = {
                      worldsState: {
                        selectedName: worldsState.selectedName,
                      },
                      elementsState: {
                        selectedKeyPath: elementsState.selectedKeyPath,
                        draggingKeyPath: elementsState.draggingKeyPath,
                      },
                      filesState: {
                        selectedName: filesState.selectedName,
                      },
                      elementAttributeFilesState: {
                        selectedName: elementAttributeFilesState.selectedName,
                      },
                    };

                    const _doSetPosition = e => {
                      const {side} = e;
                      const {positioningSide} = elementsState;

                      if (positioningSide && side === positioningSide) {
                        const {positioningName} = elementsState;
                        const {elementsState: {selectedKeyPath: oldElementsSelectedKeyPath}} = oldStates;

                        const element = menuUtils.getElementKeyPath({
                          elements: elementsState.elements,
                          availableElements: elementsState.availableElements,
                          clipboardElements: elementsState.clipboardElements,
                        }, oldElementsSelectedKeyPath);
                        const instance = menuUtils.getElementKeyPath({
                          elements: elementsState.elementInstances,
                        }, oldElementsSelectedKeyPath);

                        const {position, quaternion, scale} = positioningMesh;
                        const newValue = position.toArray().concat(quaternion.toArray()).concat(scale.toArray());
                        const newAttributeValue = JSON.stringify(newValue);
                        element.setAttribute(positioningName, newAttributeValue);
                        instance.setAttribute(positioningName, newAttributeValue);

                        elementsState.positioningName = null;
                        elementsState.positioningSide = null;

                        _saveElements();

                        _updatePages();

                        return true;
                      } else {
                        return false;
                      }
                    };
                    const _doClickNavbar = e => {
                      const {side} = e;
                      const navbarHoverState = navbarHoverStates[side];
                      const {anchor} = navbarHoverState;
                      const onclick = (anchor && anchor.onclick) || '';

                      let match;
                      if (match = onclick.match(/^navbar:(readme|multiverse|world|inventory|options)$/)) {
                        const newTab = match[1];

                        const _getTabMesh = tab => {
                          switch (tab) {
                            case 'readme': return menuMesh.planeMesh;
                            case 'multiverse': return universeMesh;
                            case 'world': return menuMesh.worldMesh;
                            case 'inventory': return menuMesh.inventoryMesh;
                            case 'options': return menuMesh.planeMesh;
                            default: return null;
                          }
                        };

                        const {tab: oldTab} = navbarState;
                        const oldMesh = _getTabMesh(oldTab);
                        const newMesh = _getTabMesh(newTab);

                        oldMesh.visible = false;
                        newMesh.visible = true;

                        navbarState.tab = newTab;

                        _updatePages();

                        api.emit('tabchange', newTab);

                        return true;
                      } else {
                        return false;
                      }
                    };
                    const _doClickUniverse = e => {
                      const {tab} = navbarState;

                      if (tab === 'multiverse') {
                        const {side} = e;
                        const universeHoverState = universeHoverStates[side];
                        const {hoverWorld} = universeHoverState;

                        if (hoverWorld) {
                          const {world} = hoverWorld;
                          const {worldName} = world;

                          const {hub: {url: hubUrl}} = metadata;
                          if (worldName !== hub.getWorldName()) {
                            window.location = window.location.protocol + '//' + worldName + '.' + hubUrl + (window.location.port ? (':' + window.location.port) : ''); // XXX actually load points from the backend here
                            return true;
                          } else {
                            return false;
                          }
                        } else {
                          return false;
                        }
                      } else {
                        return false;
                      }
                    };
                    const _doClickMenu = e => {
                      const {tab} = navbarState;

                      if (tab === 'readme') {
                        const {side} = e;
                        const menuHoverState = menuHoverStates[side];
                        const {intersectionPoint} = menuHoverState;

                        if (intersectionPoint) {
                          const {anchor} = menuHoverState;
                          const onclick = (anchor && anchor.onclick) || '';

                          focusState.type = '';
                          worldsState.selectedName = '';
                          filesState.selectedName = '';
                          elementAttributeFilesState.selectedName = '';

                          const _ensureFilesLoaded = targetState => {
                            const {loaded} = targetState;

                            if (!loaded) {
                              targetState.loading = true;

                              const {cwd} = targetState;
                              fs.getDirectory(cwd)
                                .then(files => {
                                  targetState.files = menuUtils.cleanFiles(files);
                                  targetState.loading = false;

                                  _updatePages();
                                })
                                .catch(err => {
                                  console.warn(err);
                                });
                            }
                          };

                          let match;
                          if (onclick === 'back') {
                            menuUi.cancelTransition();

                            if (menuUi.getPages().length > 1) {
                              menuUi.popPage();
                            }
                          } else if (onclick === 'worlds') {
                            menuUi.cancelTransition();

                            menuUi.pushPage(({worlds: {worlds, selectedName, inputText, inputValue}, focus: {type: focusType}}) => ([
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
                                pixelated: true,
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
                            const {worldsState: {selectedName: oldWorldsSelectedName}} = oldStates;
                            if (oldWorldsSelectedName) {
                              worldsState.inputText = '';
                              worldsState.inputIndex = 0;
                              worldsState.inputValue = 0;

                              focusState.type = 'worlds:rename:' + oldWorldsSelectedName;

                              _updatePages();
                            }
                          } else if (onclick === 'worlds:remove') {
                            const {worldsState: {selectedName: oldWorldsSelectedName}} = oldStates;
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
                            menuUi.cancelTransition();

                            menuUi.pushPage(({mods: {mods, localMods, remoteMods, tab, inputText, inputValue, loadingLocal, loadingRemote}, focus: {type: focusType}}) => ([
                              {
                                type: 'html',
                                src: menuRenderer.getModsPageSrc({mods, localMods, remoteMods, tab, inputText, inputValue, loadingLocal, loadingRemote, focus: focusType === 'mods'}),
                              },
                              {
                                type: 'image',
                                img: creatureUtils.makeAnimatedCreature('mods'),
                                x: 150,
                                y: 0,
                                w: 150,
                                h: 150,
                                frameTime: 300,
                                pixelated: true,
                              }
                            ]), {
                              type: 'mods',
                              state: {
                                mods: modsState,
                                focus: focusState,
                              },
                            });
                          } else if (match = onclick.match(/^mods:(installed|local|remote)$/)) {
                            const tab = match[1];

                            if (tab === 'local') {
                              modsState.loadingLocal = true;

                              _getLocalModSpecs()
                                .then(localMods => {
                                  modsState.localMods = localMods;
                                  modsState.loadingLocal = false;

                                  _updatePages();
                                })
                                .catch(err => {
                                  console.warn(err);
                                });
                            } else if (tab === 'remote') {
                              modsState.inputText = '';
                              modsState.inputIndex = 0;
                              modsState.inputValue = 0;
                              modsState.loadingRemote = true;

                              _getRemoteModSpecs(modsState.inputText)
                                .then(remoteMods => {
                                  modsState.remoteMods = remoteMods;
                                  modsState.loadingRemote = false;

                                  _updatePages();
                                })
                                .catch(err => {
                                  console.warn(err);
                                });
                            }

                            modsState.tab = tab;

                            _updatePages();
                          } else if (match = onclick.match(/^mod:(.+)$/)) {
                            const name = match[1];

                            menuUi.cancelTransition();

                            modState.modName = name;
                            modState.mod = null;
                            modState.loading = true;

                            _getModSpec(name)
                              .then(modSpec => {
                                modState.mod = modSpec;
                                modState.loading = false;

                                _updatePages();
                              })
                              .catch(err => {
                                console.warn(err);

                                modState.loading = false;

                                _updatePages();
                              });

                            menuUi.pushPage(({mod: {modName, mod, loading}, mods: {mods}}) => {
                              const displayName = modName.match(/([^\/]*)$/)[1];
                              const installed = mods.some(m => m.name === modName);
                              const conflicting = mods.some(m => m.displayName === displayName);

                              return [
                                {
                                  type: 'html',
                                  src: menuRenderer.getModPageSrc({modName, mod, installed, conflicting}),
                                },
                                {
                                  type: 'html',
                                  src: menuRenderer.getModPageReadmeSrc({modName, mod, loading}),
                                  x: 500,
                                  y: 150 + 2,
                                  w: WIDTH - 500,
                                  h: HEIGHT - (150 + 2),
                                  scroll: true,
                                },
                                {
                                  type: 'image',
                                  img: creatureUtils.makeAnimatedCreature('mod:' + displayName),
                                  x: 150,
                                  y: 0,
                                  w: 150,
                                  h: 150,
                                  frameTime: 300,
                                  pixelated: true,
                                }
                              ];
                            }, {
                              type: 'mod',
                              state: {
                                mod: modState,
                                mods: modsState,
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
                            menuUi.cancelTransition();

                            menuUi.pushPage(({config: {inputText, inputValue, sliderValue, airlockCheckboxValue, voiceChatCheckboxValue, statsCheckboxValue}, focus: {type: focusType}}) => ([
                              {
                                type: 'html',
                                src: menuRenderer.getConfigPageSrc(),
                              },
                              {
                                type: 'html',
                                src: menuRenderer.getConfigPageContentSrc({inputText, inputValue, focus: focusType === 'config', sliderValue, airlockCheckboxValue, voiceChatCheckboxValue, statsCheckboxValue}),
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
                                pixelated: true,
                              }
                            ]), {
                              type: 'config',
                              state: {
                                config: configState,
                                focus: focusState,
                              }
                            });
                          } else if (onclick === 'elements') {
                            menuUi.cancelTransition();

                            menuUi.pushPage(({elements: {elements, availableElements, clipboardElements, selectedKeyPath, draggingKeyPath, positioningName, inputText, inputValue}, focus: {type: focusType}}) => {
                              const match = focusType ? focusType.match(/^element:attribute:(.+)$/) : null;
                              const focusAttribute = match && match[1];

                              return [
                                {
                                  type: 'html',
                                  src: menuRenderer.getElementsPageSrc({selectedKeyPath}),
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
                                  src: menuRenderer.getElementsPageSubcontentSrc({elements, availableElements, clipboardElements, selectedKeyPath, draggingKeyPath, positioningName, inputText, inputValue, focusAttribute}),
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
                                  pixelated: true,
                                }
                              ];
                            }, {
                              type: 'elements',
                              state: {
                                elements: _cleanElementsState(elementsState),
                                focus: focusState,
                              },
                            });
                          } else if (onclick === 'files') {
                            menuUi.cancelTransition();

                            _ensureFilesLoaded(filesState);

                            menuUi.pushPage(({files: {cwd, files, inputText, inputValue, selectedName, clipboardPath, loading, uploading}, focus: {type: focusType}}) => ([
                              {
                                type: 'html',
                                src: menuRenderer.getFilesPageSrc({cwd, files, inputText, inputValue, selectedName, clipboardPath, loading, uploading, focusType, prefix: 'file'}),
                              },
                              {
                                type: 'image',
                                img: creatureUtils.makeAnimatedCreature('files'),
                                x: 150,
                                y: 0,
                                w: 150,
                                h: 150,
                                frameTime: 300,
                                pixelated: true,
                              }
                            ]), {
                              type: 'files',
                              state: {
                                files: filesState,
                                focus: focusState,
                              },
                            });
                          } else if (match = onclick.match(/^(file|elementAttributeFile):(.+)$/)) {
                            menuUi.cancelTransition();

                            const target = match[1];
                            const name = match[2];
                            const targetState = (() => {
                              switch (target) {
                                case 'file': return filesState;
                                case 'elementAttributeFile': return elementAttributeFilesState;
                                default: return null;
                              }
                            })();

                            const _chdir = newCwd => {
                              targetState.loading = true;

                              targetState.cwd = newCwd;
                              fs.setCwd(newCwd);
                              fs.getDirectory(newCwd)
                                .then(files => {
                                  targetState.files = menuUtils.cleanFiles(files);
                                  targetState.loading = false;

                                  _updatePages();
                                })
                                .catch(err => {
                                  console.warn(err);
                                });

                              _updatePages();
                            };

                            if (name !== '..') {
                              const {files} = targetState;
                              const file = files.find(f => f.name === name);
                              const {type} = file;

                              if (type === 'file') {
                                targetState.selectedName = name;

                                _updatePages();
                              } else if (type === 'directory') {
                                const {cwd: oldCwd} = targetState;
                                const newCwd = oldCwd + (!/\/$/.test(oldCwd) ? '/' : '') + name;
                                _chdir(newCwd);
                              }
                            } else {
                              const {cwd: oldCwd} = targetState;
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
                          } else if (onclick === 'elementAttributeFiles:select') {
                            const {
                              elementsState: {selectedKeyPath: oldElementsSelectedKeyPath},
                              elementAttributeFilesState: {selectedName: oldFilesSelectedName},
                            } = oldStates;

                            if (oldFilesSelectedName) {
                              menuUi.cancelTransition();

                              const {choosingName} = elementsState;
                              const element = menuUtils.getElementKeyPath({
                                elements: elementsState.elements,
                                availableElements: elementsState.availableElements,
                                clipboardElements: elementsState.clipboardElements,
                              }, oldElementsSelectedKeyPath);
                              const instance = menuUtils.getElementKeyPath({
                                elements: elementsState.elementInstances,
                              }, oldElementsSelectedKeyPath);

                              const {cwd} = elementAttributeFilesState;
                              const selectPath = menuUtils.pathJoin(cwd, oldFilesSelectedName);
                              const newAttributeValue = JSON.stringify(selectPath);
                              element.setAttribute(choosingName, newAttributeValue);
                              instance.setAttribute(choosingName, newAttributeValue);

                              _saveElements();

                              menuUi.popPage();
                            }
                          } else if (match = onclick.match(/^(file|elementAttributeFile)s:(cut|copy)$/)) {
                            const target = match[1];
                            const type = match[2];

                            const targetState = (() => {
                              switch (target) {
                                case 'file': return filesState;
                                case 'elementAttributeFile': return elementAttributeFilesState;
                                default: return null;
                              }
                            })();
                            const oldTargetState = (() => {
                              switch (target) {
                                case 'file': return oldStates.filesState;
                                case 'elementAttributeFile': return oldStates.elementAttributeFilesState;
                                default: return null;
                              }
                            })();
                            const {selectedName: oldFilesSelectedName} = oldTargetState;

                            if (oldFilesSelectedName) {
                              const {cwd} = targetState;
                              const cutPath = menuUtils.pathJoin(cwd, oldFilesSelectedName);

                              targetState.selectedName = oldFilesSelectedName;
                              targetState.clipboardType = type;
                              targetState.clipboardPath = cutPath;

                              _updatePages();
                            }
                          } else if (match = onclick.match(/^(file|elementAttributeFile)s:paste$/)) {
                            const target = match[1];
                            const targetState = (() => {
                              switch (target) {
                                case 'file': return filesState;
                                case 'elementAttributeFile': return elementAttributeFilesState;
                                default: return null;
                              }
                            })();

                            const {clipboardPath} = targetState;

                            if (clipboardPath) {
                              targetState.uploading = true;

                              const {cwd, clipboardType, clipboardPath} = targetState;

                              const src = clipboardPath;
                              const name = clipboardPath.match(/\/([^\/]*)$/)[1];
                              const dst = menuUtils.pathJoin(cwd, name);
                              fs[(clipboardType === 'cut') ? 'move' : 'copy'](src, dst)
                                .then(() => fs.getDirectory(cwd)
                                  .then(files => {
                                    targetState.files = menuUtils.cleanFiles(files);
                                    targetState.selectedName = name;
                                    targetState.uploading = false;
                                    if (clipboardType === 'cut') {
                                      targetState.clipboardType = 'copy';
                                      targetState.clipboardPath = dst;
                                    }

                                    _updatePages();
                                  })
                                )
                                .catch(err => {
                                  console.warn(err);

                                  targetState.uploading = true;

                                  _updatePages();
                                });

                              _updatePages();
                            }
                          } else if (match = onclick.match(/^(file|elementAttributeFile)s:createdirectory$/)) {
                            const target = match[1];

                            focusState.type = target + 's:createdirectory';

                            _updatePages();
                          } else if (match = onclick.match(/^(file|elementAttributeFile)s:rename$/)) {
                            const target = match[1];
                            const targetState = (() => {
                              switch (target) {
                                case 'file': return filesState;
                                case 'elementAttributeFile': return elementAttributeFilesState;
                                default: return null;
                              }
                            })();
                            const oldTargetState = (() => {
                              switch (target) {
                                case 'file': return oldStates.filesState;
                                case 'elementAttributeFile': return oldStates.elementAttributeFilesState;
                                default: return null;
                              }
                            })();
                            const {selectedName: oldFilesSelectedName} = oldTargetState;

                            if (oldFilesSelectedName) {
                              targetState.inputText = '';
                              targetState.inputIndex = 0;
                              targetState.inputValue = 0;

                              focusState.type = 'files:rename:' + oldFilesSelectedName;

                              _updatePages();
                            }
                          } else if (match = onclick.match(/^(file|elementAttributeFile)s:remove$/)) {
                            const target = match[1];
                            const targetState = (() => {
                              switch (target) {
                                case 'file': return filesState;
                                case 'elementAttributeFile': return elementAttributeFilesState;
                                default: return null;
                              }
                            })();
                            const oldTargetState = (() => {
                              switch (target) {
                                case 'file': return oldStates.filesState;
                                case 'elementAttributeFile': return oldStates.elementAttributeFilesState;
                                default: return null;
                              }
                            })();
                            const {selectedName: oldFilesSelectedName} = oldTargetState;

                            if (oldFilesSelectedName) {
                              targetState.uploading = true;

                              const {cwd} = targetState;
                              const p = menuUtils.pathJoin(cwd, oldFilesSelectedName);
                              fs.remove(p)
                                .then(() => fs.getDirectory(cwd)
                                  .then(files => {
                                    targetState.files = menuUtils.cleanFiles(files);
                                    const {clipboardPath} = targetState;
                                    if (clipboardPath === p) {
                                      targetState.clipboardType = null;
                                      targetState.clipboardPath = '';
                                    }
                                    targetState.uploading = false;

                                    _updatePages();
                                  })
                                )
                                .catch(err => {
                                  console.warn(err);

                                  targetState.uploading = false;

                                  _updatePages();
                                });

                              _updatePages();
                            }
                          } else if (onclick === 'elements:remove') {
                            const {elementsState: {selectedKeyPath: oldElementsSelectedKeyPath}} = oldStates;
                            if (oldElementsSelectedKeyPath.length > 0) {
                              const elementsSpec = {
                                elements: elementsState.elements,
                                availableElements: elementsState.availableElements,
                                clipboardElements: elementsState.clipboardElements,
                              };
                              menuUtils.removeElementKeyPath(elementsSpec, oldElementsSelectedKeyPath);
                              const elementInstancesSpec = {
                                elements: elementsState.elementInstances,
                              };
                              if (oldElementsSelectedKeyPath[0] === 'elements') {
                                const instance = menuUtils.removeElementKeyPath(elementInstancesSpec, oldElementsSelectedKeyPath);
                                menuUtils.destructElement(instance);
                              }

                              elementsState.selectedKeyPath = [];
                              elementsState.draggingKeyPath = [];

                              _saveElements();

                              _updatePages();
                            }
                          } else if (match = onclick.match(/^element:attribute:(.+?):(position|focus|set|tweak|toggle|choose)(?::(.+?))?$/)) {
                            const attributeName = match[1];
                            const action = match[2];
                            const value = match[3];

                            const {elementsState: {selectedKeyPath: oldElementsSelectedKeyPath}} = oldStates;

                            const element = menuUtils.getElementKeyPath({
                              elements: elementsState.elements,
                              availableElements: elementsState.availableElements,
                              clipboardElements: elementsState.clipboardElements,
                            }, oldElementsSelectedKeyPath);
                            const instance = menuUtils.getElementKeyPath({
                              elements: elementsState.elementInstances,
                            }, oldElementsSelectedKeyPath);
                            const {attributeConfigs} = element;
                            const attributeConfig = attributeConfigs[attributeName];

                            if (action === 'position') {
                              const oldValue = JSON.parse(element.getAttribute(attributeName));
                              oldPositioningMesh.position.set(oldValue[0], oldValue[1], oldValue[2]);
                              oldPositioningMesh.quaternion.set(oldValue[3], oldValue[4], oldValue[5], oldValue[6]);
                              oldPositioningMesh.scale.set(oldValue[7], oldValue[8], oldValue[9]);

                              elementsState.positioningName = attributeName;
                              elementsState.positioningSide = side;
                            } else if (action === 'focus') {
                              const {value} = menuHoverState;

                              const {type: attributeType} = attributeConfig;
                              const textProperties = (() => {
                                if (attributeType === 'text') {
                                  const valuePx = value * 400;
                                  return getTextPropertiesFromCoord(menuUtils.castValueValueToString(JSON.parse(element.getAttribute(attributeName)), attributeType), subcontentFontSpec, valuePx);
                                } else if (attributeType === 'number') {
                                  const valuePx = value * 100;
                                  return getTextPropertiesFromCoord(menuUtils.castValueValueToString(JSON.parse(element.getAttribute(attributeName)), attributeType), subcontentFontSpec, valuePx);
                                } else if (attributeType === 'color') {
                                  const valuePx = value * (400 - (40 + 4));
                                  return getTextPropertiesFromCoord(menuUtils.castValueValueToString(JSON.parse(element.getAttribute(attributeName)), attributeType), subcontentFontSpec, valuePx);
                                } else if (attributeType === 'file') {
                                  const valuePx = value * 260;
                                  return getTextPropertiesFromCoord(menuUtils.castValueValueToString(JSON.parse(element.getAttribute(attributeName)), attributeType), subcontentFontSpec, valuePx);
                                } else {
                                  return null;
                                }
                              })();
                              if (textProperties) {
                                elementsState.inputText = menuUtils.castValueValueToString(JSON.parse(element.getAttribute(attributeName)), attributeType);
                                const {index, px} = textProperties;
                                elementsState.inputIndex = index;
                                elementsState.inputValue = px;
                              }

                              focusState.type = 'element:attribute:' + attributeName;
                            } else if (action === 'set') {
                              const newAttributeValue = JSON.stringify(value);
                              element.setAttribute(attributeName, newAttributeValue);
                              instance.setAttribute(attributeName, newAttributeValue);

                              _saveElements();
                            } else if (action === 'tweak') {
                              const {value} = menuHoverState;
                              const {min = ATTRIBUTE_DEFAULTS.MIN, max = ATTRIBUTE_DEFAULTS.MAX, step = ATTRIBUTE_DEFAULTS.STEP} = attributeConfig;

                              const newValue = (() => {
                                let n = min + (value * (max - min));
                                if (step > 0) {
                                  n = Math.floor(n / step) * step;
                                }
                                return n;
                              })();
                              const newAttributeValue = JSON.stringify(newValue);
                              element.setAttribute(attributeName, newAttributeValue);
                              instance.setAttribute(attributeName, newAttributeValue);

                              _saveElements();
                            } else if (action === 'toggle') {
                              const newValue = !JSON.parse(element.getAttribute(attributeName));
                              const newAttributeValue = JSON.stringify(newValue);
                              element.setAttribute(attributeName, newAttributeValue);
                              instance.setAttribute(attributeName, newAttributeValue);

                              _saveElements();
                            } else if (action === 'choose') {
                              menuUi.cancelTransition();

                              elementsState.choosingName = attributeName;

                              _ensureFilesLoaded(elementAttributeFilesState);

                              menuUi.pushPage(({elementAttributeFiles: {cwd, files, inputText, inputValue, selectedName, clipboardPath, loading, uploading}, focus: {type: focusType}}) => ([
                                {
                                  type: 'html',
                                  src: menuRenderer.getFilesPageSrc({cwd, files, inputText, inputValue, selectedName, clipboardPath, loading, uploading, focusType, prefix: 'elementAttributeFile'}),
                                },
                                {
                                  type: 'image',
                                  img: creatureUtils.makeAnimatedCreature('files'),
                                  x: 150,
                                  y: 0,
                                  w: 150,
                                  h: 150,
                                  frameTime: 300,
                                  pixelated: true,
                                }
                              ]), {
                                type: 'elementAttributeFiles',
                                state: {
                                  elementAttributeFiles: elementAttributeFilesState,
                                  focus: focusState,
                                },
                              });
                            }

                            elementsState.selectedKeyPath = oldElementsSelectedKeyPath;

                            _updatePages();
                          } else if (onclick === 'elements:clearclipboard') {
                            const {elementsState: {selectedKeyPath: oldElementsSelectedKeyPath, draggingKeyPath: oldElementsDraggingKeyPath}} = oldStates;

                            elementsState.clipboardElements = [];
                            if (oldElementsSelectedKeyPath.length > 0 && oldElementsSelectedKeyPath[0] === 'clipboardElements') {
                              elementsState.selectedKeyPath = [];
                            }
                            if (oldElementsDraggingKeyPath.length > 0 && oldElementsDraggingKeyPath[0] === 'clipboardElements') {
                              elementsState.draggingKeyPath = [];
                            }

                            _saveElements();

                            _updatePages();
                          } else if (onclick === 'mods:input') {
                            const {value} = menuHoverState;
                            const valuePx = value * (WIDTH - (500 + 40));

                            const {index, px} = getTextPropertiesFromCoord(modsState.inputText, mainFontSpec, valuePx);

                            modsState.inputIndex = index;
                            modsState.inputValue = px;
                            focusState.type = 'mods';

                            _updatePages();
                          } else if (onclick === 'config:input') {
                            const {value} = menuHoverState;
                            const valuePx = value * (WIDTH - (500 + 40));

                            const {index, px} = getTextPropertiesFromCoord(configState.inputText, mainFontSpec, valuePx);

                            configState.inputIndex = index;
                            configState.inputValue = px;
                            focusState.type = 'config';

                            _updatePages();
                          } else if (onclick === 'config:resolution') {
                            const {value} = menuHoverState;

                            configState.sliderValue = value;

                            _updatePages();
                          } else if (onclick === 'config:airlock') {
                            const {airlockCheckboxValue} = configState;

                            configState.airlockCheckboxValue = !airlockCheckboxValue;

                            _saveConfig();
                            api.updateConfig();

                            _updatePages();
                          } else if (onclick === 'config:voiceChat') {
                            const {voiceChatCheckboxValue} = configState;

                            configState.voiceChatCheckboxValue = !voiceChatCheckboxValue;

                            _saveConfig();
                            api.updateConfig();

                            _updatePages();
                          } else if (onclick === 'config:stats') {
                            const {statsCheckboxValue} = configState;

                            if (!statsCheckboxValue) {
                              const width = 0.0005;
                              const height = width * (48 / 80);
                              const depth = -0.001;

                              configState.statsCheckboxValue = true;
                            } else {
                              configState.statsCheckboxValue = false;
                            }

                            _saveConfig();
                            api.updateConfig();

                            _updatePages();
                          } else {
                            _updatePages();
                          }

                          return true;
                        } else {
                          return false;
                        }
                      } else {
                        return false;
                      }
                    };

                    _doSetPosition(e) || _doClickNavbar(e) || _doClickUniverse(e) || _doClickMenu(e);
                  }
                };
                input.on('trigger', trigger);
                const triggerdown = e => {
                  const {open} = menuState;

                  if (open) {
                    const {side} = e;
                    const menuHoverState = menuHoverStates[side];

                    const _doClick = () => {
                      const {tab} = navbarState;

                      if (tab === 'readme') {
                        const {intersectionPoint} = menuHoverState;

                        if (intersectionPoint) {
                          const {anchor} = menuHoverState;
                          const onmousedown = (anchor && anchor.onmousedown) || '';

                          if (/^element:attribute:(.+?):(position|focus|set|tweak|toggle|choose)(?::(.+?))?$/.test(onmousedown)) {
                            return true;
                          } else {
                            return false;
                          }
                        } else {
                          return false;
                        }
                      } else {
                        return false;
                      }
                    };
                    const _doDragElement = () => {
                      const {tab} = navbarState;

                      if (tab === 'readme') {
                        const {intersectionPoint} = menuHoverState;

                        if (intersectionPoint) {
                          const {anchor} = menuHoverState;
                          const onmousedown = (anchor && anchor.onmousedown) || '';

                          let match;
                          if (match = onmousedown.match(/^element:select:((?:elements|availableElements|clipboardElements):(?:[0-9]+:)*[0-9]+)$/)) {
                            const keyPath = menuUtils.parseKeyPath(match[1]);

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
                      } else {
                        return false;
                      }
                    };
                    const _doScroll = () => {
                      const {tab} = navbarState;

                      if (tab === 'readme') {
                        const {scrollLayer} = menuHoverState;

                        if (scrollLayer) {
                          const {intersectionPoint} = menuHoverState;

                          const {planeMesh} = menuMesh;
                          const {position: menuPosition, rotation: menuRotation} = _decomposeObjectMatrixWorld(planeMesh);
                          const _getMenuMeshCoordinate = biolumi.makeMeshCoordinateGetter({
                            position: menuPosition,
                            rotation: menuRotation,
                            width: WIDTH,
                            height: HEIGHT,
                            worldWidth: WORLD_WIDTH,
                            worldHeight: WORLD_HEIGHT,
                          });
                          const mousedownStartCoord = _getMenuMeshCoordinate(intersectionPoint);
                          menuHoverState.mousedownScrollLayer = scrollLayer;
                          menuHoverState.mousedownStartCoord = mousedownStartCoord;
                          menuHoverState.mousedownStartScrollTop = scrollLayer.scrollTop;

                          return true;
                        } else {
                          return false;
                        }
                      } else {
                        return false;
                      }
                    };
                    const _doDragUniverse = () => {
                      const {tab} = navbarState;

                      if (tab === 'multiverse') {
                        const universeHoverState = universeHoverStates[side];
                        const {hovered} = universeHoverState;

                        if (hovered) {
                          const {side} = e;
                          const {gamepads} = webvr.getStatus();
                          const gamepad = gamepads[side];
                          const {position: controllerPosition} = gamepad;
                          universeHoverState.dragStartPoint = controllerPosition.clone();

                          const {innerMesh} = universeMesh;
                          const {position: innerMeshPosition} = innerMesh;
                          universeHoverState.dragStartPosition = innerMeshPosition.clone();

                          return true;
                        } else {
                          return false;
                        }
                      } else {
                        return false;
                      }
                    };

                    _doClick() || _doDragElement() || _doScroll() || _doDragUniverse();
                  }
                };
                input.on('triggerdown', triggerdown);

                const _setLayerScrollTop = menuHoverState => {
                  const {mousedownScrollLayer, mousedownStartCoord, mousedownStartScrollTop, intersectionPoint} = menuHoverState;

                  const {planeMesh} = menuMesh;
                  const {position: menuPosition, rotation: menuRotation} = _decomposeObjectMatrixWorld(planeMesh);
                  const _getMenuMeshCoordinate = biolumi.makeMeshCoordinateGetter({
                    position: menuPosition,
                    rotation: menuRotation,
                    width: WIDTH,
                    height: HEIGHT,
                    worldWidth: WORLD_WIDTH,
                    worldHeight: WORLD_HEIGHT,
                  });
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
                const triggerup = e => {
                  const {side} = e;

                  const _doDrag = () => {
                    const {tab} = navbarState;

                    if (tab === 'readme') {
                      const menuHoverState = menuHoverStates[side];
                      const {mousedownStartCoord} = menuHoverState;

                      if (mousedownStartCoord) {
                        const {anchor} = menuHoverState;
                        const onmouseup = (anchor && anchor.onmouseup) || '';

                        const oldStates = {
                          elementsState: {
                            draggingKeyPath: elementsState.draggingKeyPath,
                          },
                        };
                        const {elementsState: {draggingKeyPath: oldElementsDraggingKeyPath}} = oldStates;

                        if (oldElementsDraggingKeyPath.length > 0) {
                          elementsState.selectedKeyPath = [];
                          elementsState.draggingKeyPath = [];

                          const _getKeyPathDragFn = (oldKeyPath, newKeyPath) => {
                            const oldCollection = oldKeyPath[0];
                            const newCollection = newKeyPath[0];

                            return (elementsSpec, elementInstancesSpec, oldKeyPath, newKeyPath) => {
                              if (oldCollection === 'elements') {
                                if (newCollection === 'elements') {
                                  menuUtils.moveElementKeyPath(elementsSpec, oldKeyPath, newKeyPath);
                                  menuUtils.moveElementKeyPath(elementInstancesSpec, oldKeyPath, newKeyPath);
                                } else if (newCollection === 'clipboardElements') {
                                  menuUtils.moveElementKeyPath(elementsSpec, oldKeyPath, newKeyPath);
                                  const instance = menuUtils.removeElementKeyPath(elementInstancesSpec, oldKeyPath);
                                  menuUtils.destructElement(instance);
                                }
                              } else if (oldCollection === 'availableElements') {
                                if (newCollection !== 'availableElements') {
                                  const element = menuUtils.copyElementKeyPath(elementsSpec, oldKeyPath, newKeyPath);
                                  if (newCollection === 'elements') {
                                    const instance = menuUtils.constructElement(modElementApis, element);
                                    menuUtils.insertElementAtKeyPath(elementInstancesSpec, newKeyPath, instance);
                                  }
                                }
                              } else if (oldCollection === 'clipboardElements') {
                                if (newCollection !== 'availableElements') {
                                  const element = menuUtils.copyElementKeyPath(elementsSpec, oldKeyPath, newKeyPath);
                                  if (newCollection === 'elements') {
                                    const instance = menuUtils.constructElement(modElementApis, element);
                                    menuUtils.insertElementAtKeyPath(elementInstancesSpec, newKeyPath, instance);
                                  }
                                }
                              }
                            };
                          };

                          let match;
                          if (match = onmouseup.match(/^element:select:((?:elements|availableElements|clipboardElements):(?:[0-9]+:)*[0-9]+)$/)) {
                            const parentKeyPath = menuUtils.parseKeyPath(match[1]);

                            const elementsSpec = {
                              elements: elementsState.elements,
                              availableElements: elementsState.availableElements,
                              clipboardElements: elementsState.clipboardElements,
                            };
                            const childKeyPath = parentKeyPath.concat(menuUtils.getElementKeyPath(elementsSpec, parentKeyPath).children.length);

                            if (!menuUtils.isSubKeyPath(childKeyPath, oldElementsDraggingKeyPath) && !menuUtils.isAdjacentKeyPath(childKeyPath, oldElementsDraggingKeyPath)) {
                              const oldKeyPath = oldElementsDraggingKeyPath;
                              const newKeyPath = childKeyPath;
                              const dragFn = _getKeyPathDragFn(oldKeyPath, newKeyPath);
                              const elementInstancesSpec = {
                                elements: elementsState.elementInstances,
                              };
                              dragFn(elementsSpec, elementInstancesSpec, oldKeyPath, newKeyPath);

                              _saveElements();
                            } else {
                              elementsState.selectedKeyPath = oldElementsDraggingKeyPath;
                            }
                          } else if (match = onmouseup.match(/^element:move:((?:elements|availableElements|clipboardElements):(?:[0-9]+:)*[0-9]+)$/)) {
                            const keyPath = menuUtils.parseKeyPath(match[1]);

                            if (!menuUtils.isSubKeyPath(keyPath, oldElementsDraggingKeyPath) && !menuUtils.isAdjacentKeyPath(keyPath, oldElementsDraggingKeyPath)) {
                              const elementsSpec = {
                                elements: elementsState.elements,
                                availableElements: elementsState.availableElements,
                                clipboardElements: elementsState.clipboardElements,
                              };
                              const elementInstancesSpec = {
                                elements: elementsState.elementInstances,
                              };
                              const oldKeyPath = oldElementsDraggingKeyPath;
                              const newKeyPath = keyPath;
                              const dragFn = _getKeyPathDragFn(oldKeyPath, newKeyPath);
                              dragFn(elementsSpec, elementInstancesSpec, oldKeyPath, newKeyPath);

                              _saveElements();
                            } else {
                              elementsState.selectedKeyPath = oldElementsDraggingKeyPath;
                            }
                          } else {
                            elementsState.selectedKeyPath = oldElementsDraggingKeyPath;
                          }

                          _updatePages();
                        }
                      }
                    }

                    return false;
                  };
                  const _doScroll = () => {
                    const {tab} = navbarState;

                    if (tab === 'readme') {
                      const menuHoverState = menuHoverStates[side ];
                      const {mousedownStartCoord} = menuHoverState;

                      if (mousedownStartCoord) {
                        const {intersectionPoint} = menuHoverState;
                        if (intersectionPoint) {
                          _setLayerScrollTop(menuHoverState);
                        }

                        menuHoverState.mousedownScrollLayer = null;
                        menuHoverState.mousedownStartCoord = null;

                        return true;
                      } else {
                        return false;
                      }
                    } else {
                      return false;
                    }
                  };
                  const _doDragUniverse = () => {
                    const {tab} = navbarState;

                    if (tab === 'multiverse') {
                      const universeHoverState = universeHoverStates[side];
                      const {dragStartPoint} = universeHoverState;

                      if (dragStartPoint) {
                        universeHoverState.dragStartPoint = null;
                        universeHoverState.dragStartPosition = null;

                        return true;
                      } else {
                        return false;
                      }
                    } else {
                      return false;
                    }
                  };

                  _doDrag() || _doScroll() || _doDragUniverse();
                };
                input.on('triggerup', triggerup);
                const grip = e => {
                  const {open} = menuState;

                  if (open) {
                    const {side} = e;
                    const {positioningSide} = elementsState;

                    if (positioningSide && side === positioningSide) {
                      const {selectedKeyPath, positioningName} = elementsState;
                      const element = menuUtils.getElementKeyPath({
                        elements: elementsState.elements,
                        availableElements: elementsState.availableElements,
                        clipboardElements: elementsState.clipboardElements,
                      }, selectedKeyPath);
                      const instance = menuUtils.getElementKeyPath({
                        elements: elementsState.elementInstances,
                      }, selectedKeyPath);

                      const oldValue = element.getAttribute(positioningName);
                      instance.setAttribute(positioningName, oldValue);

                      elementsState.positioningName = null;
                      elementsState.positioningSide = null;

                      _updatePages();
                    }
                  }
                };
                input.on('grip', grip);
                const menudown = () => {
                  const {open, animation} = menuState;

                  if (open) {
                    menuState.open = false; // XXX need to cancel other menu states as well
                    menuState.animation = anima.makeAnimation(TRANSITION_TIME);

                    /* menuMesh.visible = false;
                    keyboardMesh.visible = false; */
                    SIDES.forEach(side => {
                      menuBoxMeshes[side].visible = false;
                      menuDotMeshes[side].visible = false;
                    });
                  } else {
                    menuState.open = true;
                    menuState.animation = anima.makeAnimation(TRANSITION_TIME);

                    const newPosition = camera.position;
                    const newRotation = camera.quaternion;

                    menuMesh.position.copy(newPosition);
                    menuMesh.quaternion.copy(newRotation);

                    keyboardMesh.position.copy(newPosition);
                    keyboardMesh.quaternion.copy(newRotation);
                  }
                };
                input.on('menudown', menudown);

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
                    state.inputText = inputText.slice(0, inputIndex) + keycode(e.keyCode) + inputText.slice(inputIndex);
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
                  const {tab} = navbarState;

                  if (tab === 'readme') {
                    const {open} = menuState;

                    if (open) {
                      const {type} = focusState;

                      let match;
                      if (type === 'worlds:create') {
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
                          _getRemoteMods(modsState.inputText)
                            .then(remoteMods => {
                              modsState.remoteMods = remoteMods,

                              _updatePages();
                            })
                            .catch(err => {
                              console.warn(err);
                            });

                          _updatePages();

                          e.stopImmediatePropagation();
                        }
                      } else if (match = type.match(/^element:attribute:(.+)$/)) {
                        const applySpec = _applyStateKeyEvent(elementsState, subcontentFontSpec, e);

                        if (applySpec) {
                          const {commit} = applySpec;

                          if (commit) {
                            const attributeName = match[1];
                            const {selectedKeyPath, inputText} = elementsState;

                            const element = menuUtils.getElementKeyPath({
                              elements: elementsState.elements,
                              availableElements: elementsState.availableElements,
                              clipboardElements: elementsState.clipboardElements,
                            }, selectedKeyPath);
                            const instance = menuUtils.getElementKeyPath({
                              elements: elementsState.elementInstances,
                            }, selectedKeyPath);
                            const {attributeConfigs} = element;
                            const attributeConfig = attributeConfigs[attributeName];
                            const {type, min = ATTRIBUTE_DEFAULTS.MIN, max = ATTRIBUTE_DEFAULTS.MAX, step = ATTRIBUTE_DEFAULTS.STEP, options = ATTRIBUTE_DEFAULTS.OPTIONS} = attributeConfig;
                            const newValue = menuUtils.castValueStringToValue(inputText, type, min, max, step, options);
                            if (newValue !== null) {
                              const newAttributeValue = JSON.stringify(newValue);
                              element.setAttribute(attributeName, newAttributeValue);
                              instance.setAttribute(attributeName, newAttributeValue);

                              _saveElements();
                            }
                          }

                          _updatePages();

                          e.stopImmediatePropagation();
                        }
                      } else if (match = type.match(/^(file|elementAttributeFile)s:createdirectory$/)) {
                        const target = match[1];
                        const targetState = (() => {
                          switch (target) {
                            case 'file': return filesState;
                            case 'elementAttributeFile': return elementAttributeFilesState;
                            default: return null;
                          }
                        })();

                        const applySpec = _applyStateKeyEvent(targetState, itemsFontSpec, e);

                        if (applySpec) {
                          const {commit} = applySpec;

                          if (commit) {
                            targetState.uploading = true;

                            const {files, inputText} = targetState;
                            const name = inputText;
                            if (!files.some(file => file.name === name)) {
                              const {cwd} = targetState;
                              fs.createDirectory(menuUtils.pathJoin(cwd, name))
                                .then(() => fs.getDirectory(cwd)
                                  .then(files => {
                                    targetState.files = menuUtils.cleanFiles(files);
                                    targetState.uploading = false;

                                    _updatePages();
                                  })
                                )
                                .catch(err => {
                                  console.warn(err);

                                  targetState.uploading = false;

                                  _updatePages();
                                });
                            }
                          }

                          _updatePages();

                          e.stopImmediatePropagation();
                        }
                      } else if (match = type.match(/^(file|elementAttributeFile)s:rename:(.+)$/)) {
                        const target = match[1];
                        const name = match[2];
                        const targetState = (() => {
                          switch (target) {
                            case 'file': return filesState;
                            case 'elementAttributeFile': return elementAttributeFilesState;
                            default: return null;
                          }
                        })();

                        const applySpec = _applyStateKeyEvent(targetState, itemsFontSpec, e);

                        if (applySpec) {
                          const {commit} = applySpec;
                          if (commit) {
                            const {files, inputText} = targetState;
                            const oldName = name;
                            const newName = inputText;

                            if (!files.some(file => file.name === newName && file.name !== oldName)) {
                              targetState.uploading = true;

                              const {cwd} = targetState;
                              const src = menuUtils.pathJoin(cwd, oldName);
                              const dst = menuUtils.pathJoin(cwd, newName);
                              fs.move(src, dst)
                                .then(() => fs.getDirectory(cwd)
                                  .then(files => {
                                    targetState.files = menuUtils.cleanFiles(files);
                                    targetState.selectedName = newName;
                                    targetState.uploading = false;

                                    _updatePages();
                                  })
                                )
                                .catch(err => {
                                  console.warn(err);

                                  targetState.uploading = true;

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
                    }
                  }
                };
                input.on('keydown', keydown, {
                  priority: 1,
                });
                const keyboarddown = keydown;
                input.on('keyboarddown', keyboarddown, {
                  priority: 1,
                });

                cleanups.push(() => {
                  scene.remove(menuMesh);
                  scene.remove(keyboardMesh);
                  scene.remove(universeMesh);

                  SIDES.forEach(side => {
                    scene.remove(menuBoxMeshes[side]);
                    scene.remove(menuDotMeshes[side]);

                    scene.remove(universeBoxMeshes[side]);
                    scene.remove(keyboardBoxMeshes[side]);
                  });

                  scene.remove(positioningMesh);
                  scene.remove(oldPositioningMesh);

                  input.removeListener('trigger', trigger);
                  input.removeListener('triggerdown', triggerdown);
                  input.removeListener('triggerup', triggerup);
                  input.removeListener('grip', grip);
                  input.removeListener('menudown', menudown);
                  input.removeListener('keydown', keydown);
                  input.removeListener('keyboarddown', keyboarddown);
                });

                const _decomposeObjectMatrixWorld = object => {
                  const position = new THREE.Vector3();
                  const rotation = new THREE.Quaternion();
                  const scale = new THREE.Vector3();
                  object.matrixWorld.decompose(position, rotation, scale);
                  return {position, rotation, scale};
                };

                const menuHoverStates = {
                  left: biolumi.makeMenuHoverState(),
                  right: biolumi.makeMenuHoverState(),
                };

                const _makeNavbarHoverState = () => ({
                  anchor: null,
                });
                const navbarHoverStates = {
                  left: _makeNavbarHoverState(),
                  right: _makeNavbarHoverState(),
                };

                const _makeKeyboardHoverState = () => ({
                  key: null,
                });
                const keyboardHoverStates = {
                  left: _makeKeyboardHoverState(),
                  right: _makeKeyboardHoverState(),
                };

                const _makeUniverseHoverState = () => ({
                  hovered: null,
                  hoverWorld: null,
                  dragStartPoint: null,
                  dragStartPosition: null,
                });
                const universeHoverStates = {
                  left: _makeUniverseHoverState(),
                  right: _makeUniverseHoverState(),
                };

                localUpdates.push(() => {
                  const _updateMeshes = () => {
                    const {animation} = menuState;

                    if (animation) {
                      const {open} = menuState;

                      const startValue = open ? 0 : 1;
                      const endValue = 1 - startValue;
                      const factor = animation.getValue();
                      const value = ((1 - factor) * startValue) + (factor * endValue);

                      if (factor < 1) {
                        if (value > 0.001) {
                          menuMesh.scale.set(1, value, 1);
                          keyboardMesh.scale.set(value, 1, 1);

                          menuMesh.visible = true;
                          keyboardMesh.visible = true;
                        } else {
                          menuMesh.visible = false;
                          keyboardMesh.visible = false;
                        }
                      } else {
                        menuMesh.scale.set(1, 1, 1);
                        keyboardMesh.scale.set(1, 1, 1);

                        if (open) {
                          menuMesh.visible = true;
                          keyboardMesh.visible = true;
                        } else {
                          menuMesh.visible = false;
                          keyboardMesh.visible = false;
                        }

                        menuState.animation = null;
                      }
                    }
                  };
                  _updateMeshes();

                  const {open} = menuState;

                  if (open) {
                    const _updateTextures = () => {
                      const {tab} = navbarState;
                      const worldTime = currentWorld.getWorldTime();

                      if (tab === 'readme') {
                        const {
                          planeMesh: {
                            menuMaterial: planeMenuMaterial,
                          },
                        } = menuMesh;

                        biolumi.updateMenuMaterial({
                          ui: menuUi,
                          menuMaterial: planeMenuMaterial,
                          worldTime,
                        });
                      }

                      const {
                        navbarMesh: {
                          menuMaterial: navbarMenuMaterial,
                        },
                      } = menuMesh;
                      biolumi.updateMenuMaterial({
                        ui: navbarUi,
                        menuMaterial: navbarMenuMaterial,
                        worldTime,
                      });

                      SIDES.forEach(side => {
                        const menuHoverState = menuHoverStates[side];

                        const {mousedownStartCoord, intersectionPoint} = menuHoverState;
                        if (mousedownStartCoord && intersectionPoint) {
                          _setLayerScrollTop(menuHoverState);
                        }
                      });
                    };
                    const _updateAnchors = () => {
                      const status = webvr.getStatus();
                      const {gamepads} = status;

                      const {planeMesh, navbarMesh} = menuMesh;
                      const menuMatrixObject = _decomposeObjectMatrixWorld(planeMesh);
                      const navbarMatrixObject = _decomposeObjectMatrixWorld(navbarMesh);

                      SIDES.forEach(side => {
                        const gamepad = gamepads[side];

                        if (gamepad) {
                          const {position: controllerPosition, rotation: controllerRotation} = gamepad;

                          const menuHoverState = menuHoverStates[side];
                          const menuDotMesh = menuDotMeshes[side];
                          const menuBoxMesh = menuBoxMeshes[side];

                          const navbarHoverState = navbarHoverStates[side];
                          const navbarBoxMesh = navbarBoxMeshes[side];

                          const keyboardHoverState = keyboardHoverStates[side];
                          const keyboardBoxMesh = keyboardBoxMeshes[side];

                          const _updateMenuAnchors = () => {
                            const {tab} = navbarState;

                            if (tab === 'readme') {
                              biolumi.updateAnchors({
                                matrixObject: menuMatrixObject,
                                ui: menuUi,
                                hoverState: menuHoverState,
                                dotMesh: menuDotMesh,
                                boxMesh: menuBoxMesh,
                                width: WIDTH,
                                height: HEIGHT,
                                worldWidth: WORLD_WIDTH,
                                worldHeight: WORLD_HEIGHT,
                                worldDepth: WORLD_DEPTH,
                                controllerPosition,
                                controllerRotation,
                              });
                            }
                          };
                          const _updateNavbarAnchors = () => {
                            const {position: navbarPosition, rotation: navbarRotation, scale: navbarScale} = navbarMatrixObject;

                            const anchorBoxTargets = (() => {
                              const result = [];
                              const layers = navbarUi.getLayers();
                              for (let i = 0; i < layers.length; i++) {
                                const layer = layers[i];
                                const anchors = layer.getAnchors();

                                for (let j = 0; j < anchors.length; j++) {
                                  const anchor = anchors[j];
                                  const {rect} = anchor;

                                  const anchorBoxTarget = geometryUtils.makeBoxTargetOffset(
                                    navbarPosition,
                                    navbarRotation,
                                    navbarScale,
                                    new THREE.Vector3(
                                      -(NAVBAR_WORLD_WIDTH / 2) + (rect.left / NAVBAR_WIDTH) * NAVBAR_WORLD_WIDTH,
                                      (NAVBAR_WORLD_HEIGHT / 2) + (-rect.top / NAVBAR_HEIGHT) * NAVBAR_WORLD_HEIGHT,
                                      -NAVBAR_WORLD_DEPTH
                                    ),
                                    new THREE.Vector3(
                                      -(NAVBAR_WORLD_WIDTH / 2) + (rect.right / NAVBAR_WIDTH) * NAVBAR_WORLD_WIDTH,
                                      (NAVBAR_WORLD_HEIGHT / 2) + (-rect.bottom / NAVBAR_HEIGHT) * NAVBAR_WORLD_HEIGHT,
                                      NAVBAR_WORLD_DEPTH
                                    )
                                  );
                                  anchorBoxTarget.anchor = anchor;

                                  result.push(anchorBoxTarget);
                                }
                              }
                              return result;
                            })();
                            const anchorBoxTarget = (() => {
                              const nearAnchorBoxTargets = anchorBoxTargets
                                .map(anchorBoxTarget => ({
                                  anchorBoxTarget,
                                  distance: anchorBoxTarget.position.distanceTo(controllerPosition),
                                }))
                                .filter(({distance}) => distance < 0.1)
                                .sort((a, b) => a.distance - b.distance)
                                .map(({anchorBoxTarget}) => anchorBoxTarget);

                              if (nearAnchorBoxTargets.length > 0) {
                                return nearAnchorBoxTargets[0];
                              } else {
                                return null;
                              }
                            })();
                            if (anchorBoxTarget) {
                              const {anchor} = anchorBoxTarget;
                              navbarHoverState.anchor = anchor;

                              navbarBoxMesh.position.copy(anchorBoxTarget.position);
                              navbarBoxMesh.quaternion.copy(anchorBoxTarget.quaternion);
                              navbarBoxMesh.scale.set(Math.max(anchorBoxTarget.size.x, 0.001), Math.max(anchorBoxTarget.size.y, 0.001), Math.max(anchorBoxTarget.size.z, 0.001));

                              if (!navbarBoxMesh.visible) {
                                navbarBoxMesh.visible = true;
                              }
                            } else {
                              navbarHoverState.anchor = null;

                              if (navbarBoxMesh.visible) {
                                navbarBoxMesh.visible = false;
                              }
                            }
                          };
                          const _updateKeyboardAnchors = () => {
                            const {planeMesh} = keyboardMesh;
                            const {position: keyboardPosition, rotation: keyboardRotation, scale: keyboardScale} = _decomposeObjectMatrixWorld(planeMesh);

                            const {keySpecs} = keyboardMesh;
                            const anchorBoxTargets = keySpecs.map(keySpec => {
                              const {key, rect} = keySpec;

                              const anchorBoxTarget = geometryUtils.makeBoxTargetOffset(
                                keyboardPosition,
                                keyboardRotation,
                                keyboardScale,
                                new THREE.Vector3(
                                  -(KEYBOARD_WORLD_WIDTH / 2) + (rect.left / KEYBOARD_WIDTH) * KEYBOARD_WORLD_WIDTH,
                                  (KEYBOARD_WORLD_HEIGHT / 2) + (-rect.top / KEYBOARD_HEIGHT) * KEYBOARD_WORLD_HEIGHT,
                                  -WORLD_DEPTH
                                ),
                                new THREE.Vector3(
                                  -(KEYBOARD_WORLD_WIDTH / 2) + (rect.right / KEYBOARD_WIDTH) * KEYBOARD_WORLD_WIDTH,
                                  (KEYBOARD_WORLD_HEIGHT / 2) + (-rect.bottom / KEYBOARD_HEIGHT) * KEYBOARD_WORLD_HEIGHT,
                                  WORLD_DEPTH
                                )
                              );
                              anchorBoxTarget.key = key;
                              return anchorBoxTarget;
                            });
                            // NOTE: there should be at most one intersecting anchor box since keys do not overlap
                            const anchorBoxTarget = anchorBoxTargets.find(anchorBoxTarget => anchorBoxTarget.containsPoint(controllerPosition));

                            const {key: oldKey} = keyboardHoverState;
                            const newKey = anchorBoxTarget ? anchorBoxTarget.key : null;
                            keyboardHoverState.key = newKey;

                            if (oldKey && newKey !== oldKey) {
                              const key = oldKey;
                              const keyCode = keycode(key);

                              input.triggerEvent('keyboardup', {
                                key,
                                keyCode,
                                side,
                              });
                            }
                            if (newKey && newKey !== oldKey) {
                              const key = newKey;
                              const keyCode = keycode(key);

                              input.triggerEvent('keyboarddown', {
                                key,
                                keyCode,
                                side,
                              });
                              input.triggerEvent('keyboardpress', {
                                key,
                                keyCode,
                                side,
                              });
                            }

                            if (anchorBoxTarget) {
                              keyboardBoxMesh.position.copy(anchorBoxTarget.position);
                              keyboardBoxMesh.quaternion.copy(anchorBoxTarget.quaternion);
                              keyboardBoxMesh.scale.copy(anchorBoxTarget.size);

                              if (!keyboardBoxMesh.visible) {
                                keyboardBoxMesh.visible = true;
                              }
                            } else {
                              if (keyboardBoxMesh.visible) {
                                keyboardBoxMesh.visible = false;
                              }
                            }
                          };
                          const _updateUniverseAnchors = () => {
                            const {tab} = navbarState;

                            if (tab === 'multiverse') {
                              const universeHoverState = universeHoverStates[side];
                              const {innerMesh, floorBoxMeshes} = universeMesh;
                              const {size} = innerMesh;
                              const floorBoxMesh = floorBoxMeshes[side];

                              const {position: universePosition, rotation: universeRotation, scale: universeScale} = _decomposeObjectMatrixWorld(universeMesh);

                              const boxTarget = geometryUtils.makeBoxTarget(
                                universePosition,
                                universeRotation,
                                universeScale,
                                new THREE.Vector3(size, size, size)
                              );
                              if (boxTarget.containsPoint(controllerPosition)) {
                                universeHoverState.hovered = true;

                                if (!floorBoxMesh.visible) {
                                  floorBoxMesh.visible = true;
                                }
                              } else {
                                universeHoverState.hovered = false;

                                if (floorBoxMesh.visible) {
                                  floorBoxMesh.visible = false;
                                }
                              }
                            }
                          };

                          _updateMenuAnchors();
                          _updateNavbarAnchors();
                          _updateKeyboardAnchors();
                          _updateUniverseAnchors();
                        }
                      });
                    };
                    const _updateControllers = () => {
                      const status = webvr.getStatus();
                      const {gamepads} = status;

                      const _updateElements = () => {
                        const {tab} = navbarState;

                        if (tab === 'readme') {
                          const {selectedKeyPath, positioningName, positioningSide} = elementsState;

                          if (selectedKeyPath.length > 0 && positioningName && positioningSide) {
                            const gamepad = gamepads[positioningSide];

                            if (gamepad) {
                              const {position: controllerPosition, rotation: controllerRotation, scale: controllerScale} = gamepad;
                              positioningMesh.position.copy(controllerPosition);
                              positioningMesh.quaternion.copy(controllerRotation);
                              positioningMesh.scale.copy(controllerScale);

                              const {selectedKeyPath, positioningName} = elementsState;
                              const instance = menuUtils.getElementKeyPath({
                                elements: elementsState.elementInstances,
                              }, selectedKeyPath);
                              const newValue = controllerPosition.toArray().concat(controllerRotation.toArray()).concat(controllerScale.toArray());
                              const newAttributeValue = JSON.stringify(newValue);
                              instance.setAttribute(positioningName, newAttributeValue);
                            }

                            if (!positioningMesh.visible) {
                              positioningMesh.visible = true;
                            }
                            if (!oldPositioningMesh.visible) {
                              oldPositioningMesh.visible = true;
                            }
                          } else {
                            if (positioningMesh.visible) {
                              positioningMesh.visible = false;
                            }
                            if (oldPositioningMesh.visible) {
                              oldPositioningMesh.visible = false;
                            }
                          }
                        }
                      };
                      const _updateUniverse = () => {
                        const {tab} = navbarState;

                        if (tab === 'multiverse') {
                          const _updateUniverseHover = () => {
                            const {worlds} = universeState;

                            SIDES.forEach(side => {
                              const gamepad = gamepads[side];
                              const universeHoverState = universeHoverStates[side];
                              const universeBoxMesh = universeBoxMeshes[side];

                              if (gamepad) {
                                const {position: controllerPosition} = gamepad;

                                const worldDistances = worlds
                                  .map(world => {
                                    const position = world.point.clone().applyMatrix4(universeMesh.matrixWorld);
                                    const distance = controllerPosition.distanceTo(position);

                                    return {
                                      world,
                                      position,
                                      distance,
                                    };
                                  })
                                  .filter(({distance}) => distance < 0.1);
                                if (worldDistances.length > 0) {
                                  const closestWorld = worldDistances.sort((a, b) => a.distance - b.distance)[0];
                                  universeHoverState.hoverWorld = closestWorld;
                                } else {
                                  universeHoverState.hoverWorld = null;
                                }
                              } else {
                                universeHoverState.hoverWorld = null;
                              }

                              const {hoverWorld} = universeHoverState;
                              if (hoverWorld !== null) {
                                const {world, position} = hoverWorld;
                                const {rotation} = world;

                                universeBoxMesh.position.copy(position);
                                universeBoxMesh.quaternion.copy(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotation, 0, camera.rotation.order)));
                                universeBoxMesh.scale.set(0.005 * (12 + 2), 0.005 * (12 + 2), 0.005 * (12 + 2));

                                if (!universeBoxMesh.visible) {
                                  universeBoxMesh.visible = true;
                                }
                              } else {
                                if (universeBoxMesh.visible) {
                                  universeBoxMesh.visible = false;
                                }
                              }
                            });
                          };
                          const _updateUniverseDrag = () => {
                            const {innerMesh} = universeMesh;
                            const {position: innerMeshPosition} = _decomposeObjectMatrixWorld(innerMesh);
                            const floorPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), innerMeshPosition);

                            SIDES.some(side => {
                              const gamepad = gamepads[side];
                              const universeHoverState = universeHoverStates[side];
                              const {dragStartPoint} = universeHoverState;

                              if (dragStartPoint) {
                                const {dragStartPoint, dragStartPosition} = universeHoverState;
                                const gamepad = gamepads[side];
                                const {position: controllerPosition} = gamepad;

                                const startPointPlanePoint = floorPlane.projectPoint(dragStartPoint);
                                const currentPointPlanePoint = floorPlane.projectPoint(controllerPosition);

                                const newInnerMeshPosition = dragStartPosition.clone().add(currentPointPlanePoint.clone().sub(startPointPlanePoint));
                                innerMesh.position.copy(newInnerMeshPosition);

                                return true;
                              } else {
                                return false;
                              }
                            });
                          };

                          _updateUniverseHover();
                          _updateUniverseDrag();
                        }
                      };

                      _updateElements();
                      _updateUniverse();
                    };

                    _updateTextures();
                    _updateAnchors();
                    _updateControllers();
                  }
                });

                menu = {
                  updatePages: _updatePages,
                };
              }
            });
          }
        };
        const _initializeWorld = () => {
          const worldName = 'proteus';
          return _requestDeleteWorld(worldName)
            .then(() => {
              if (live) {
                return _requestChangeWorld(worldName);
              }
            });
        };
        const _initialize = () => _initializeMenu()
          .then(() => _initializeWorld());

        return _initialize()
          .then(() => {
            class RendApi extends EventEmitter {
              constructor() {
                super();
              }

              getCurrentWorld() {
                return currentWorld;
              }

              getTab() {
                const {tab} = navbarState;
                return tab;
              }

              addMenuMesh(name, object) {
                menuMesh.add(object);
                menuMesh[name] = object;
              }

              removeMenuMesh(name) {
                const object = menuMesh[name];
                menuMesh.remove(object);
                menuMesh[name] = null;
              }

              getConfig() {
                return _getConfig();
              }

              updateConfig() {
                this.emit('config', _getConfig());
              }

              update() {
                this.emit('update');

                stats.render();
              }

              updateEye(camera) {
                this.emit('updateEye', camera);
              }

              updateStart() {
                stats.begin();
              }

              updateEnd() {
                stats.end();
              }

              registerElement(elementApi) {
                _addModApiElement(elementApi);
              }

              unregisterElement(elementApi) {
                _removeModApiElement(elementApi);
              }
            }
            api = new RendApi();
            api.on('update', () => {
              for (let i = 0; i < localUpdates.length; i++) {
                const localUpdate = localUpdates[i];
                localUpdate();
              }
            });

            return api;
          });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _pad = (n, width) => {
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
};

module.exports = Rend;
