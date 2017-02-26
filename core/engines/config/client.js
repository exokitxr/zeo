import Stats from 'stats.js';

import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  STATS_WIDTH,
  STATS_HEIGHT,
  STATS_WORLD_WIDTH,
  STATS_WORLD_HEIGHT,
  STATS_WORLD_DEPTH,

  STATS_REFRESH_RATE,
} from './lib/constants/config';
import configUtils from './lib/utils/config';
import configRenderer from './lib/render/config';

const STATS_REFRESH_RATE = 1000;

const SIDES = ['left', 'right'];

class Config {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/input',
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/plugins/js-utils',
    ]).then(([
      input,
      three,
      webvr,
      biolumi,
      rend,
      jsUtils,
    ]) => {
      if (live) {
        const {THREE, scene} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;

        const _decomposeObjectMatrixWorld = object => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          object.matrixWorld.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const transparentImg = biolumi.getTransparentImg();
        const transparentMaterial = biolumi.getTransparentMaterial();
        const solidMaterial = biolumi.getSolidMaterial();

        const mainFontSpec = {
          fonts: biolumi.getFonts(),
          fontSize: 30,
          lineHeight: 1.4,
          fontWeight: biolumi.getFontWeight(),
          fontStyle: biolumi.getFontStyle(),
        };

        let api = null;

        const configState = {
          inputText: 'Hello, world! This is some text!',
          inputIndex: 0,
          inputValue: 0,
          sliderValue: 0.5,
          airlockCheckboxValue: true,
          voiceChatCheckboxValue: false,
          statsCheckboxValue: false,
          physicsDebugCheckboxValue: false,
        };
        const statsState = {
          frame: 0,
        };
        const focusState = {
          type: '',
        };

        const configHoverStates = {
          left: biolumi.makeMenuHoverState(),
          right: biolumi.makeMenuHoverState(),
        };

        const _requestUis = () =>
          Promise.all([
            biolumi.requestUi({
              width: WIDTH,
              height: HEIGHT,
            }),
            biolumi.requestUi({
              width: STATS_WIDTH,
              height: STATS_HEIGHT,
            }),
          ]).then(([
            configUi,
            statsUi,
          ]) => ({
            configUi,
            statsUi,
          }));
        const _requestGetConfig = world => fetch('/archae/config/config.json')
          .then(res => res.json());
        const _requestSetConfig = config => fetch('/archae/config/config.json', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(config),
        })
          .then(res => res.blob())
          .then(() => {})
        const _getConfig = () => ({
          airlock: configState.airlockCheckboxValue,
          voiceChat: configState.voiceChatCheckboxValue,
          stats: configState.statsCheckboxValue,
          physicsDebug: configState.physicsDebugCheckboxValue,
        });
        const _saveConfig = configUtils.debounce(next => {
          _requestSetConfig(_getConfig())
            .then(() => {
              next();
            })
            .catch(err => {
              console.warn(err);

              next();
            });
        });

        const stats = new Stats();
        stats.render = () => {}; // overridden below
        const statsDom = stats.dom.childNodes[0];

        return Promise.all([
          _requestUis(),
          _requestGetConfig(),
        ])
          .then(([
            {
              configUi,
              statsUi,
            },
            configSpec,
          ]) => {
            if (live) {
              configState.airlockCheckboxValue = configSpec.airlock;
              configState.voiceChatCheckboxValue = configSpec.voiceChat;
              configState.statsCheckboxValue = configSpec.stats;
              configState.physicsDebugCheckboxValue = configSpec.physicsDebug;

              const configMesh = (() => {
                const object = new THREE.Object3D();
                // object.position.y = -0.25;
                object.visible = false;

                const planeMesh = (() => {
                  const mesh = configUi.addPage(({
                    config: {
                      inputText,
                      inputValue,
                      sliderValue,
                      airlockCheckboxValue,
                      voiceChatCheckboxValue,
                      statsCheckboxValue,
                      physicsDebugCheckboxValue,
                    },
                    focus: {
                      type: focusType,
                    }
                  }) => ([
                    {
                      type: 'html',
                      src: configRenderer.getConfigPageSrc({
                        inputText,
                        inputValue,
                        focus: focusType === 'config',
                        sliderValue,
                        airlockCheckboxValue,
                        voiceChatCheckboxValue, 
                        statsCheckboxValue,
                        physicsDebugCheckboxValue,
                      }),
                      x: 0,
                      y: 0,
                      w: WIDTH,
                      h: HEIGHT,
                    }
                  ]), {
                    type: 'config',
                    state: {
                      config: configState,
                      focus: focusState,
                    },
                    worldWidth: WORLD_WIDTH,
                    worldHeight: WORLD_HEIGHT,
                  });
                  // mesh.position.y = 1.5;
                  mesh.position.z = -1.5;
                  mesh.receiveShadow = true;

                  return mesh;
                })();
                object.add(planeMesh);
                object.planeMesh = planeMesh;

                return object;
              })();
              rend.registerMenuMesh('configMesh', configMesh);

              const statsMesh = (() => {
                const object = new THREE.Object3D();
                object.position.x = -(2 / 2) + (STATS_WORLD_WIDTH / 2);
                object.position.y = -((2 / 1.5) / 2) + (STATS_WORLD_HEIGHT / 2);
                object.position.z = -1.5;
                object.visible = configState.statsCheckboxValue;

                const planeMesh = (() => {
                  const mesh = statsUi.addPage(({
                    config: {
                      statsCheckboxValue,
                    },
                    stats: {
                      frame,
                    },
                  }) => {
                    const img = (() => {
                      if (statsCheckboxValue) {
                        const statsImg = statsDom;
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
                        y: 0,
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
                    worldWidth: STATS_WORLD_WIDTH,
                    worldHeight: STATS_WORLD_HEIGHT,
                  });
                  // mesh.position.y = 1.5;
                  mesh.position.z = 0.01;
                  mesh.receiveShadow = true;

                  return mesh;
                })();
                object.add(planeMesh);
                object.planeMesh = planeMesh;

                return object;
              })();
              rend.registerMenuMesh('statsMesh', statsMesh);

              const configBoxMeshes = {
                left: biolumi.makeMenuBoxMesh(),
                right: biolumi.makeMenuBoxMesh(),
              };
              scene.add(configBoxMeshes.left);
              scene.add(configBoxMeshes.right);

              const configDotMeshes = {
                left: biolumi.makeMenuDotMesh(),
                right: biolumi.makeMenuDotMesh(),
              };
              scene.add(configDotMeshes.left);
              scene.add(configDotMeshes.right);

              stats.render = () => {
                const {frame: oldFrame} = statsState;
                const newFrame = Math.floor(Date.now() / STATS_REFRESH_RATE);

                if (newFrame !== oldFrame) {
                  statsState.frame = newFrame;

                  _updatePages();
                }
              };

              const _updatePages = {
                configUi.update();
                statsUi.update();
              };
              _updatePages();

              const trigger = e => {
                const isOpen = rend.isOpen();
                const tab = rend.getTab();

                if (isOpen && tab === 'options') {
                  const {side} = e;
                  const configHoverState = configHoverStates[side];
                  const {intersectionPoint} = configHoverState;

                  if (intersectionPoint) {
                    const {anchor} = configHoverState;
                    const onclick = (anchor && anchor.onclick) || '';

                    focusState.type = '';

                    if (onclick === 'config:input') {
                      const {value} = configHoverState;
                      const valuePx = value * (640 - (30 * 2));

                      const {index, px} = biolumi.getTextPropertiesFromCoord(configState.inputText, mainFontSpec, valuePx);

                      configState.inputIndex = index;
                      configState.inputValue = px;
                      focusState.type = 'config';

                      _updatePages();
                    } else if (onclick === 'config:resolution') {
                      const {value} = configHoverState;

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
                        configState.statsCheckboxValue = true;
                        statsMesh.visible = true;
                      } else {
                        configState.statsCheckboxValue = false;
                        statsMesh.visible = false;
                      }

                      _saveConfig();
                      api.updateConfig();

                      _updatePages();
                    } else if (onclick === 'config:physicsDebug') {
                      const {physicsDebugCheckboxValue} = configState;

                      if (!physicsDebugCheckboxValue) {
                        configState.physicsDebugCheckboxValue = true;
                      } else {
                        configState.physicsDebugCheckboxValue = false;
                      }

                      _saveConfig();
                      api.updateConfig();

                      _updatePages();
                    } else if (onclick === 'config:logOut') {
                      rend.logout();

                      SIDES.forEach(side => {
                        configDotMeshes[side].visible = false;
                        configBoxMeshes[side].visible = false;
                      });
                    } else {
                      _updatePages();
                    }
                  }
                }
              };
              input.on('trigger', trigger);

              const keydown = e => {
                const isOpen = rend.isOpen();
                const tab = rend.getTab();

                if (isOpen && tab === 'config') {
                  const {type} = focusState;

                  if (type === 'config') {
                    const applySpec = biolumi.applyStateKeyEvent(configState, mainFontSpec, e);

                    if (applySpec) {
                      const {commit} = applySpec;
                      if (commit) {
                        focusState.type = '';
                      }

                      _updatePages();

                      e.stopImmediatePropagation();
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

              const _update = () => {
                const _updateAnchors = () => {
                  const isOpen = rend.isOpen();
                  const tab = rend.getTab();

                  if (isOpen && tab === 'options') {
                    const {gamepads} = webvr.getStatus();

                    const {planeMesh} = configMesh;
                    const configMatrixObject = _decomposeObjectMatrixWorld(planeMesh);

                    SIDES.forEach(side => {
                      const gamepad = gamepads[side];

                      if (gamepad) {
                        const {position: controllerPosition, rotation: controllerRotation} = gamepad;

                        const configHoverState = configHoverStates[side];
                        const configDotMesh = configDotMeshes[side];
                        const configBoxMesh = configBoxMeshes[side];

                        biolumi.updateAnchors({
                          objects: [{
                            matrixObject: configMatrixObject,
                            ui: configUi,
                            width: WIDTH,
                            height: HEIGHT,
                            worldWidth: WORLD_WIDTH,
                            worldHeight: WORLD_HEIGHT,
                            worldDepth: WORLD_DEPTH,
                          }],
                          hoverState: configHoverState,
                          dotMesh: configDotMesh,
                          boxMesh: configBoxMesh,
                          controllerPosition,
                          controllerRotation,
                        });
                      }
                    });
                  }
                };
                _updateAnchors();

                stats.render();
              };
              rend.on('update', _update);
              const _updateStart = () => {
                stats.begin();
              };
              rend.on('updateStart', _updateStart);
              const _updateEnd = () => {
                stats.end();
              };
              rend.on('updateEnd', _updateEnd);

              this._cleanup = () => {
                SIDES.forEach(side => {
                  scene.remove(configBoxMeshes[side]);
                  scene.remove(configDotMeshes[side]);
                });

                input.removeListener('trigger', trigger);
                input.removeListener('keydown', keydown);
                input.removeListener('keyboarddown', keyboarddown);
                rend.removeListener('update', _update);
                rend.removeListener('updateStart', _updateStart);
                rend.removeListener('updateEnd', _updateEnd);
              };

              class ConfigApi extends EventEmitter {
                getConfig() {
                  return _getConfig();
                }

                updateConfig() {
                  this.emit('config', _getConfig());
                }
              }

              api = new ConfigApi();
              return api;
            }
          });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Config;
