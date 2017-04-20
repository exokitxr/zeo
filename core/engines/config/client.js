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

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const configState = {
      resolutionValue: 0.5,
      voiceChatCheckboxValue: false,
      statsCheckboxValue: false,
      lockedCheckboxValue: false,
    };
    const _makeConfigApi = ({EventEmitter}) => {
      class ConfigApi extends EventEmitter {
        getConfig() {
          return {
            voiceChat: configState.voiceChatCheckboxValue,
            stats: configState.statsCheckboxValue,
            locked: configState.lockedCheckboxValue,
          };
        }

        getBrowserConfig() {
          return {
            resolution: configState.resolutionValue,
            voiceChat: configState.voiceChatCheckboxValue,
            stats: configState.statsCheckboxValue,
          };
        }

        getServerConfig() {
          return {
            locked: configState.lockedCheckboxValue,
          };
        }

        updateConfig() {
          const config = this.getConfig();
          this.emit('config', config);
        }
      }
      return new ConfigApi();
    };

    if (serverEnabled) {
      return archae.requestPlugins([
        '/core/engines/bootstrap',
        '/core/engines/input',
        '/core/engines/three',
        '/core/engines/webvr',
        '/core/engines/biolumi',
        '/core/engines/rend',
        '/core/utils/js-utils',
      ]).then(([
        bootstrap,
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

          const configApi = _makeConfigApi({EventEmitter});

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

          const statsState = {
            frame: 0,
          };

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
          const _saveBrowserConfig = () => {
            const config = configApi.getBrowserConfig();
            _requestSetBrowserConfig(config);
          };
          const _requestGetServerConfig = world => fetch('archae/config/config.json')
            .then(res => res.json());
          const _requestSetServerConfig = config => fetch('archae/config/config.json', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(config),
          })
            .then(res => res.blob())
            .then(() => {})
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

          return Promise.all([
            _requestGetBrowserConfig(),
            _requestGetServerConfig(),
          ])
            .then(([
              browserConfigSpec,
              serverConfigSpec,
            ]) => {
              if (live) {
                configState.resolutionValue = browserConfigSpec.resolution;
                configState.voiceChatCheckboxValue = browserConfigSpec.voiceChat;
                configState.statsCheckboxValue = browserConfigSpec.stats;
                configState.lockedCheckboxValue = serverConfigSpec.locked;

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
                        lockedCheckboxValue,
                      },
                    }) => ({
                      type: 'html',
                      src: configRenderer.getConfigPageSrc({
                        resolutionValue,
                        voiceChatCheckboxValue,
                        statsCheckboxValue,
                        lockedCheckboxValue,
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
                    });
                    mesh.receiveShadow = true;

                    const {page} = mesh;
                    rend.addPage(page);
                    page.initialUpdate();

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
                    });
                    mesh.position.z = 0.03;
                    mesh.receiveShadow = true;

                    const {page} = mesh;
                    rend.addPage(page);

                    return mesh;
                  })();
                  object.add(planeMesh);
                  object.planeMesh = planeMesh;

                  return object;
                })();
                rend.registerMenuMesh('statsMesh', statsMesh);

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

                const trigger = e => {
                  const isOpen = rend.isOpen();
                  const tab = rend.getTab();

                  if (isOpen && tab === 'options') {
                    const {side} = e;
                    const hoverState = rend.getHoverState(side);
                    const {intersectionPoint} = hoverState;

                    if (intersectionPoint) {
                      const {anchor} = hoverState;
                      const onclick = (anchor && anchor.onclick) || '';

                      if (onclick === 'config:resolution') {
                        const {value} = hoverState;

                        configState.resolutionValue = value;

                        _saveBrowserConfig();
                        configApi.updateConfig();

                        _updatePages();
                      } else if (onclick === 'config:voiceChat') {
                        const {voiceChatCheckboxValue} = configState;

                        configState.voiceChatCheckboxValue = !voiceChatCheckboxValue;

                        _saveBrowserConfig();
                        configApi.updateConfig();

                        _updatePages();
                      } else if (onclick === 'config:stats') {
                        const {statsCheckboxValue: oldStatsCheckboxValue} = configState;

                        const newStatsCheckboxValue = !oldStatsCheckboxValue;
                        configState.statsCheckboxValue = newStatsCheckboxValue;
                        statsMesh.visible = newStatsCheckboxValue;

                        _saveBrowserConfig();
                        configApi.updateConfig();

                        _updatePages();
                      } else if (onclick === 'config:lock') {
                        const {lockedCheckboxValue} = configState;

                        configState.lockedCheckboxValue = !lockedCheckboxValue;

                        _saveServerConfig();
                        configApi.updateConfig();

                        _updatePages();
                      } else {
                        _updatePages();
                      }
                    }
                  }
                };
                input.on('trigger', trigger);

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

                this._cleanup = () => {
                  input.removeListener('trigger', trigger);
                  input.removeListener('keydown', keydown);
                  input.removeListener('keyboarddown', keyboarddown);

                  rend.removeListener('update', _update);
                  rend.removeListener('updateStart', _updateStart);
                  rend.removeListener('updateEnd', _updateEnd);
                };

                return configApi;
              }
            });
        }
      });
    } else {
      return archae.requestPlugins([
        '/core/utils/js-utils',
      ]).then(([
        jsUtils,
      ]) => {
        const {events} = jsUtils;
        const {EventEmitter} = events;

        const configApi = _makeConfigApi({EventEmitter});
        return configApi;
      });
    }
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Config;
