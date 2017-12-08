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
const NUM_SERVERS = 5;
const SIDES = ['left', 'right'];

class Config {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {
      metadata: {
        server: {
          url: serverUrl,
        },
      },
    } = archae;

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
    const _requestGetServerConfig = () => fetch('archae/config/config.json', {
      credentials: 'include',
    })
      .then(res => res.json());
    const _requestSetServerConfig = config => fetch('archae/config/config.json', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
      credentials: 'include',
    })
      .then(res => res.blob())
      .then(() => {})

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/input',
        '/core/engines/three',
        '/core/engines/webvr',
        '/core/engines/keyboard',
        '/core/engines/biolumi',
        '/core/engines/resource',
        '/core/engines/rend',
        '/core/utils/js-utils',
        '/core/utils/vrid-utils',
      ]),
      _requestGetBrowserConfig(),
      // _requestGetServerConfig(),
    ]).then(([
      [
        input,
        three,
        webvr,
        keyboard,
        biolumi,
        resource,
        rend,
        jsUtils,
        vridUtils,
      ],
      browserConfigSpec,
      // serverConfigSpec,
    ]) => {
      if (live) {
        const {THREE, scene} = three;
        const {sfx} = resource;
        const {events} = jsUtils;
        const {EventEmitter} = events;
        const {vridApi} = vridUtils;

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
          /* visibilityValue: serverConfigSpec.visibility,
          nameValue: serverConfigSpec.name,
          passwordValue: serverConfigSpec.password,
          maxPlayersValue: serverConfigSpec.maxPlayers, */
          keyboardFocusState: null,
        };
        const statsState = {
          frame: 0,
        };

        const _resJson = res => {
          if (res.status >= 200 && res.status < 300) {
            return res.json();
          } else {
            return Promise.reject({
              status: res.status,
              stack: 'API returned invalid status code: ' + res.status,
            });
          }
        };
        const _resBlob = res => {
          if (res.status >= 200 && res.status < 300) {
            return res.blob();
          } else {
            return Promise.reject({
              status: res.status,
              stack: 'API returned invalid status code: ' + res.status,
            });
          }
        };
        /* const _requestRegisterRecentServer = name => vridApi.get('servers')
          .then(servers => {
            if (!Array.isArray(servers)) {
              servers = [];
            }
            let server = servers.find(server => server.url === serverUrl);
            if (!server) {
              server = {
                url: serverUrl,
                name: null,
                timestamp: 0,
              };
              servers.push(server);
            }
            server.name = name;
            server.timestamp = Date.now();
            servers.sort((a, b) => b.timestamp - a.timestamp);
            servers.length = Math.min(servers.length, NUM_SERVERS);

            return vridApi.set('servers', servers);
          })
          .catch(err => {
            console.warn(err);
          }); */
        const _applyName = name => {
          rend.setStatus('name', name);

          /* _requestRegisterRecentServer(name)
            .catch(err => {
              console.warn(err);
            }); */
        };
        // _applyName(serverConfigSpec.name);

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

        /* const _trigger = e => {
          const {side} = e;

          const _clickMenu = () => {
            const hoverState = rend.getHoverState(side);
            const {anchor} = hoverState;
            const onclick = (anchor && anchor.onclick) || '';

            let match;
            if (onclick === 'config:resolution') {
              const {value} = hoverState;

              configState.resolutionValue = value;

              _saveBrowserConfig();
              configApi.updateBrowserConfig();

              _updatePages();

              return true;
            } else if (onclick === 'config:voiceChat') {
              const {voiceChatCheckboxValue} = configState;

              configState.voiceChatCheckboxValue = !voiceChatCheckboxValue;

              _saveBrowserConfig();
              configApi.updateBrowserConfig();

              _updatePages();

              return true;
            } else if (onclick === 'config:stats') {
              const {statsCheckboxValue: oldStatsCheckboxValue} = configState;

              const newStatsCheckboxValue = !oldStatsCheckboxValue;
              configState.statsCheckboxValue = newStatsCheckboxValue;
              statsMesh.visible = newStatsCheckboxValue;

              _saveBrowserConfig();
              configApi.updateBrowserConfig();

              _updatePages();

              return true;
            } else if (match = onclick.match(/^config:visibility(?::(public|private))?$/)) {
              const visibilityValue = match[1] || null;

              if (visibilityValue === null) {
                const keyboardFocusState =  keyboard.fakeFocus({
                  type: 'config:visibility',
                });
                configState.keyboardFocusState = keyboardFocusState;

                keyboardFocusState.on('blur', () => {
                  configState.keyboardFocusState = null;

                  _updatePages();
                });
              } else {
                configState.visibilityValue = visibilityValue;

                _saveServerConfig();
                configApi.updateBrowserConfig();

                keyboard.tryBlur();
              }

              _updatePages();

              return true;
            } else if (onclick === 'config:name') {
              const {nameValue: inputText} = configState;
              const {value, target: page} = hoverState;
              const {layer: {measures}} = page;
              const valuePx = value * (640 - (150 + (30 * 2) + 30));
              const {index, px} = biolumi.getTextPropertiesFromCoord(measures['config:name'], inputText, valuePx);
              const {hmd: hmdStatus} = webvr.getStatus();
              const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmdStatus;
              const keyboardFocusState = keyboard.focus({
                type: 'config:name',
                position: hmdPosition,
                rotation: hmdRotation,
                inputText: inputText,
                inputIndex: index,
                inputValue: px,
                page: page,
              });
              keyboardFocusState.on('update', () => {
                const {inputText: keyboardInputText} = keyboardFocusState;
                const {nameValue: nameInputText} = configState;

                if (keyboardInputText !== nameInputText) {
                  const newName = keyboardInputText;
                  configState.nameValue = newName;

                  _saveServerConfig();
                  configApi.updateBrowserConfig();

                  _applyName(newName);
                }

                _updatePages();
              });
              keyboardFocusState.on('blur', () => {
                configState.keyboardFocusState = null;

                _updatePages();
              });
 
              configState.keyboardFocusState = keyboardFocusState;

              _updatePages();

              return true;
            } else if (onclick === 'config:password') {
              const {passwordValue: inputText} = configState;
              const {value, target: page} = hoverState;
              const {layer: {measures}} = page;
              const valuePx = value * (640 - (150 + (30 * 2) + 30));
              const {index, px} = biolumi.getTextPropertiesFromCoord(measures['config:password'], inputText, valuePx);
              const {hmd: hmdStatus} = webvr.getStatus();
              const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmdStatus;
              const keyboardFocusState = keyboard.focus({
                type: 'config:password',
                position: hmdPosition,
                rotation: hmdRotation,
                inputText: inputText,
                inputIndex: index,
                inputValue: px,
                page: page,
              });
              keyboardFocusState.on('update', () => {
                const {inputText: keyboardInputText} = keyboardFocusState;
                const {passwordValue: passwordInputText} = configState;

                if (keyboardInputText !== passwordInputText) {
                  configState.passwordValue = keyboardInputText;

                  _saveServerConfig();
                  configApi.updateBrowserConfig();
                }

                _updatePages();
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
              configApi.updateBrowserConfig();

              _updatePages();

              return true;
            } else {
              return false;
            }
          };
          const _clickMenuBackground = () => {
            const hoverState = rend.getHoverState(side);
            const {target} = hoverState;

            if (target && target.mesh && target.mesh.parent === configMesh) {
              return true;
            } else {
              return false;
            }
          };

          if (_clickMenu()) {
            sfx.digi_select.trigger();

            e.stopImmediatePropagation();
          } else if (_clickMenuBackground()) {
            sfx.digi_plink.trigger();

            e.stopImmediatePropagation();
          }
        };
        input.on('trigger', _trigger, {
          priority: 1,
        }); */

        const _update = () => {
          if (configState.statsCheckboxValue) {
            stats.render();
          }
        };
        rend.on('update', _update);
        const _updateStart = () => {
          if (configState.statsCheckboxValue) {
            stats.begin();
          }
        };
        rend.on('updateStart', _updateStart);
        const _updateEnd = () => {
          if (configState.statsCheckboxValue) {
            stats.end();
          }
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
          getBrowserConfig() {
            return {
              resolution: configState.resolutionValue,
              voiceChat: configState.voiceChatCheckboxValue,
              stats: configState.statsCheckboxValue,
            };
          }

          setBrowserConfig(newConfig) {
            ('resolution' in newConfig) && (configState.resolutionValue = newConfig.resolution);
            ('voiceChat' in newConfig) && (configState.voiceChatCheckboxValue = newConfig.voiceChat);
            ('stats' in newConfig) && (configState.statsCheckboxValue = newConfig.stats);

            _saveBrowserConfig();
            configApi.updateBrowserConfig();

            _updatePages();
          }

          getServerConfig() {
            return {
              visibility: configState.visibilityValue,
              name: configState.nameValue,
              password: configState.passwordValue,
              maxPlayers: configState.maxPlayersValue,
            };
          }

          setServerConfig(newConfig) {
            ('name' in newConfig) && (configState.nameValue = newConfig.name);
            ('password' in newConfig) && (configState.passwordValue = newConfig.password);
            ('maxPlayers' in newConfig) && (configState.maxPlayersValue = newConfig.maxPlayers);

            _saveServerConfig();
            configApi.updateServerConfig();

            _updatePages();
          }

          updateBrowserConfig() {
            const browserConfig = this.getBrowserConfig();
            this.emit('browserConfig', browserConfig);
          }

          updateServerConfig() {
            const serverConfig = this.getServerConfig();
            this.emit('serverConfig', serverConfig);
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
