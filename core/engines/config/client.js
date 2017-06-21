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

const DEFAULT_BROWSER_CONFIG = {
  resolution: 0.5,
  voiceChat: false,
  stats: false,
};

const STATS_REFRESH_RATE = 1000;

const SIDES = ['left', 'right'];

class Config {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {server: {enabled: serverEnabled}}} = archae;

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

    const _requestGetBrowserConfig = () => new Promise((accept, reject) => {
      const configString = localStorage.getItem('config');
      const config = configString ? JSON.parse(configString) : DEFAULT_BROWSER_CONFIG;

      accept(config);
    });
    const _requestSetBrowserConfig = config => new Promise((accept, reject) => {
      const configString = JSON.stringify(config);
      localStorage.setItem('config', configString);

      accept();
    });
    const _requestGetServerConfig = () => {
      if (serverEnabled) {
        return fetch('archae/config/config.json')
          .then(res => res.json());
      } else {
        return Promise.resolve({});
      }
    };
    const _requestSetServerConfig = config => fetch('archae/config/config.json', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    })
      .then(res => res.blob())
      .then(() => {})

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/bootstrap',
        '/core/engines/input',
        '/core/engines/three',
        '/core/engines/webvr',
        '/core/engines/keyboard',
        '/core/engines/biolumi',
        '/core/engines/rend',
        '/core/utils/js-utils',
      ]),
      _requestGetBrowserConfig(),
      _requestGetServerConfig(),
    ]).then(([
      [
        bootstrap,
        input,
        three,
        webvr,
        keyboard,
        biolumi,
        rend,
        jsUtils,
      ],
      browserConfigSpec,
      serverConfigSpec,
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

        const mainFontSpec = {
          fonts: biolumi.getFonts(),
          fontSize: 30,
          lineHeight: 1.4,
          fontWeight: biolumi.getFontWeight(),
          fontStyle: biolumi.getFontStyle(),
        };

        const configState = {
          resolutionValue: browserConfigSpec.resolution,
          voiceChatCheckboxValue: browserConfigSpec.voiceChat,
          statsCheckboxValue: browserConfigSpec.stats,
          passwordValue: serverConfigSpec.password,
          maxPlayersValue: serverConfigSpec.maxPlayers,
          keyboardFocusState: null,
          flags: {
            server: serverEnabled,
          },
        };
        const statsState = {
          frame: 0,
        };

        const _saveBrowserConfig = () => {
          const config = configApi.getBrowserConfig();
          _requestSetBrowserConfig(config);
        };
        const _saveServerConfig = configUtils.debounce(next => {
          const config = configApi.getServerConfig();
          _requestSetServerConfig(config)
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

        const configMesh = (() => {
          const object = new THREE.Object3D();
          object.visible = false;

          const planeMesh = (() => {
            const configUi = biolumi.makeUi({
              width: WIDTH,
              height: HEIGHT,
            });
            const mesh = configUi.makePage(({
              config: {
                resolutionValue,
                voiceChatCheckboxValue,
                statsCheckboxValue,
                passwordValue,
                maxPlayersValue,
                keyboardFocusState,
                flags,
              },
            }) => ({
              type: 'html',
              src: configRenderer.getConfigPageSrc({
                focus: keyboardFocusState !== null,
                resolutionValue,
                voiceChatCheckboxValue,
                statsCheckboxValue,
                passwordValue,
                maxPlayersValue,
                inputValue: keyboardFocusState ? keyboardFocusState.inputValue : 0,
                flags,
              }),
              x: 0,
              y: 0,
              w: WIDTH,
              h: HEIGHT,
            }), {
              type: 'config',
              state: {
                config: configState,
              },
              worldWidth: WORLD_WIDTH,
              worldHeight: WORLD_HEIGHT,
              isEnabled: () => rend.isOpen(),
            });
            mesh.receiveShadow = true;

            const {page} = mesh;
            rend.addPage(page);
            page.initialUpdate();

            cleanups.push(() => {
              rend.removePage(page);
            });

            return mesh;
          })();
          object.add(planeMesh);
          object.planeMesh = planeMesh;

          return object;
        })();
        rend.registerMenuMesh('configMesh', configMesh);
        configMesh.updateMatrixWorld();

        const statsMesh = (() => {
          const object = new THREE.Object3D();
          object.position.x = -(2 / 2) + (STATS_WORLD_WIDTH / 2);
          object.position.y = -((2 / 1.5) / 2) + (STATS_WORLD_HEIGHT / 2);
          object.visible = configState.statsCheckboxValue;

          const planeMesh = (() => {
            const statsUi = biolumi.makeUi({
              width: STATS_WIDTH,
              height: STATS_HEIGHT,
            });
            const mesh = statsUi.makePage(({
              config: {
                statsCheckboxValue,
              },
              stats: {
                frame,
              },
            }) => ({
              type: 'image',
              img: statsDom,
              x: 0,
              y: 0,
              w: 500,
              h: 500 * (48 / 80),
            }), {
              type: 'stats',
              state: {
                config: {
                  statsCheckboxValue: configState.statsCheckboxValue,
                },
                stats: statsState,
              },
              worldWidth: STATS_WORLD_WIDTH,
              worldHeight: STATS_WORLD_HEIGHT,
              isEnabled: () => rend.isOpen(),
            });
            mesh.position.z = 0.002;
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

          return object;
        })();
        rend.registerMenuMesh('statsMesh', statsMesh);
        statsMesh.updateMatrixWorld();

        rend.reindex();
        rend.updateMatrixWorld(configMesh);

        stats.render = () => {
          const {frame: oldFrame} = statsState;
          const newFrame = Math.floor(Date.now() / STATS_REFRESH_RATE);

          if (newFrame !== oldFrame) {
            statsState.frame = newFrame;

            const {planeMesh} = statsMesh;
            const {page} = planeMesh;
            page.update();
          }
        };

        const _updatePages = () => {
          const {planeMesh} = configMesh;
          const {page} = planeMesh;
          page.update();
        };

        const _requestLogout = () => new Promise((accept, reject) => {
          bootstrap.requestLogout()
            .then(() => {
              accept();
            })
            .catch(err => {
              console.warn(err);

              accept();
            });
        });

        const _trigger = e => {
          const _clickMenu = () => {
            const isOpen = rend.isOpen();
            const tab = rend.getTab();

            if (isOpen && tab === 'options') {
              const {side} = e;
              const hoverState = rend.getHoverState(side);
              const {anchor} = hoverState;
              const onclick = (anchor && anchor.onclick) || '';

              if (onclick === 'config:resolution') {
                const {value} = hoverState;

                configState.resolutionValue = value;

                _saveBrowserConfig();
                configApi.updateConfig();

                _updatePages();

                return true;
              } else if (onclick === 'config:voiceChat') {
                const {voiceChatCheckboxValue} = configState;

                configState.voiceChatCheckboxValue = !voiceChatCheckboxValue;

                _saveBrowserConfig();
                configApi.updateConfig();

                _updatePages();

                return true;
              } else if (onclick === 'config:stats') {
                const {statsCheckboxValue: oldStatsCheckboxValue} = configState;

                const newStatsCheckboxValue = !oldStatsCheckboxValue;
                configState.statsCheckboxValue = newStatsCheckboxValue;
                statsMesh.visible = newStatsCheckboxValue;

                rend.updateMatrixWorld(statsMesh);

                _saveBrowserConfig();
                configApi.updateConfig();

                _updatePages();

                return true;
              } else if (onclick === 'config:password') {
                const {passwordValue: inputText} = configState;
                const {value} = hoverState;
                const valuePx = value * (640 - (150 + (30 * 2) + 30));
                const {index, px} = biolumi.getTextPropertiesFromCoord(inputText, mainFontSpec, valuePx);
                const {hmd: hmdStatus} = webvr.getStatus();
                const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmdStatus;
                const keyboardFocusState = keyboard.focus({
                  type: 'npm',
                  position: hmdPosition,
                  rotation: hmdRotation,
                  inputText: inputText,
                  inputIndex: index,
                  inputValue: px,
                  fontSpec: mainFontSpec,
                });
                keyboardFocusState.on('update', () => {
                  const {inputText: keyboardInputText} = keyboardFocusState;
                  const {passwordValue: passwordInputText} = configState;

                  if (keyboardInputText !== passwordInputText) {
                    configState.passwordValue = keyboardInputText;

                    _saveServerConfig();
                    configApi.updateConfig();

                    _updatePages();
                  }
                });
                keyboardFocusState.on('blur', () => {
                  configState.keyboardFocusState = null;

                  _updatePages();
                });

                configState.keyboardFocusState = keyboardFocusState;

                _updatePages();

                return true;
              } else if (onclick === 'config:maxPlayers') {
                const {value} = hoverState;

                configState.maxPlayersValue = 1 + Math.round(value * (8 - 1));

                _saveServerConfig();
                configApi.updateConfig();

                _updatePages();

                return true;
              /* } else if (onclick === 'config:tutorial') {
                rend.setTab('tutorial');

                return true; */
              } else {
                return false;
              }
            } else {
              return false;
            }
          };

          if (_clickMenu()) {
            e.stopImmediatePropagation();
          }
        };
        input.on('trigger', _trigger, {
          priority: 1,
        });

        const _update = () => {
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

        cleanups.push(() => {
          input.removeListener('trigger', trigger);
          input.removeListener('keydown', keydown);
          input.removeListener('keyboarddown', keyboarddown);

          rend.removeListener('update', _update);
          rend.removeListener('updateStart', _updateStart);
          rend.removeListener('updateEnd', _updateEnd);
        });

        class ConfigApi extends EventEmitter {
          getConfig() {
            return {
              voiceChat: configState.voiceChatCheckboxValue,
              stats: configState.statsCheckboxValue,
              maxPlayers: configState.maxPlayersValue,
            };
          }

          getBrowserConfig() {
            return {
              resolution: configState.resolutionValue,
              voiceChat: configState.voiceChatCheckboxValue,
              stats: configState.statsCheckboxValue,
              maxPlayers: configState.maxPlayersValue,
            };
          }

          getServerConfig() {
            return {
              password: configState.passwordValue,
              maxPlayers: configState.maxPlayersValue,
            };
          }

          updateConfig() {
            const config = this.getConfig();
            this.emit('config', config);
          }
        }
        const configApi = new ConfigApi();

        return configApi;
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Config;
