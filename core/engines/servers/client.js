import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/servers';
import menuRender from './lib/render/servers';

const SIDES = ['left', 'right'];

class Servers {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {
      metadata: {
        site: {
          url: siteUrl,
        },
        server: {
          enabled: serverEnabled,
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

    return archae.requestPlugins([
      '/core/engines/bootstrap',
      '/core/engines/input',
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/resource',
      '/core/engines/rend',
      '/core/utils/js-utils',
      '/core/utils/creature-utils',
    ]).then(([
      bootstrap,
      input,
      three,
      webvr,
      biolumi,
      resource,
      rend,
      jsUtils,
      creatureUtils,
    ]) => {
      if (live) {
        const {THREE, scene} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;
        const {sfx} = resource;

        const menuRenderer = menuRender.makeRenderer({
          creatureUtils,
        });

        const _decomposeObjectMatrixWorld = object => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          object.matrixWorld.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const transparentImg = biolumi.getTransparentImg();
        const transparentMaterial = biolumi.getTransparentMaterial();

        const serversState = {
          remoteServers: [],
          page: 0,
          loaded: false,
          loading: true,
        };

        const _requestRemoteServers = () => fetch(siteUrl + '/servers/servers.json')
          .then(res => res.json()
            .then(servers => {
              for (let i = 0; i < servers.length; i++) {
                const server = servers[i];
                server.local = false;
              }

              return servers;
            })
          );

        const _connectServer = serverUrl => {
          window.parent.location = serverUrl;
        };

        const _trigger = e => {
          const {side} = e;
          const hoverState = rend.getHoverState(side);
          const {anchor} = hoverState;
          const onclick = (anchor && anchor.onclick) || '';

          const _clickMenu = () => {
            let match;
            if (match = onclick.match(/^servers:go:([0-9]+)$/)) {
              const index = parseInt(match[1], 10);

              const {remoteServers} = serversState;
              const remoteServer = remoteServers[index];
              const {url: remoteServerUrl} = remoteServer;
              _connectServer(remoteServerUrl);

              return true;
            } else if (match = onclick.match(/^servers:(up|down)$/)) {
              const direction = match[1];

              serversState.page += (direction === 'up' ? -1 : 1);

              _updatePages();

              return true;
            } else {
              return false;
            }
          };
          const _clickMenuBackground = () => {
            const hoverState = rend.getHoverState(side);
            const {target} = hoverState;

            if (target && target.mesh && target.mesh.parent === serversMesh) {
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
        });

        cleanups.push(() => {
          rend.removeListener('tabchange', _tabchange);
          input.removeListener('trigger', _trigger);
        });

        const _tabchange = tab => {
          if (tab === 'servers') {
            const {loaded} = serversState;

            if (!loaded) {
              serversState.loading = true;
              serversState.loaded = true;

              _updatePages();

              _requestRemoteServers()
                .then(remoteServers => {
                  serversState.remoteServers = remoteServers;
                  serversState.page = 0;
                  serversState.loading = false;

                  _updatePages();
                })
                .catch(err => {
                  console.warn(err);
                });
            }
          }
        };
        rend.on('tabchange', _tabchange);

        cleanups.push(() => {
          input.removeListener('trigger', _trigger);

          rend.removeListener('tabchange', _tabchange);
        });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Servers;
