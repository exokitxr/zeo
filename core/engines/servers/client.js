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
      '/core/engines/assets',
      '/core/engines/rend',
      '/core/utils/js-utils',
      '/core/utils/creature-utils',
    ]).then(([
      bootstrap,
      input,
      three,
      webvr,
      biolumi,
      assets,
      rend,
      jsUtils,
      creatureUtils,
    ]) => {
      if (live) {
        const {THREE, scene} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;
        const {sfx} = assets;

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

        const _requestRemoteServers = () => fetch(siteUrl + '/prsnt/servers.json')
          .then(res => res.json()
            .then(j => {
              const {servers} = j;

              for (let i = 0; i < servers.length; i++) {
                const server = servers[i];
                server.local = false;
              }

              return servers;
            })
          );
        const _updatePages = () => {
          const {planeMesh} = serversMesh;
          const {page} = planeMesh;
          page.update();
        };

        const serversMesh = (() => {
          const object = new THREE.Object3D();
          object.visible = false;

          const planeMesh = (() => {
            const serversUi = biolumi.makeUi({
              width: WIDTH,
              height: HEIGHT,
            });
            const mesh = serversUi.makePage(({
              servers: {
                remoteServers,
                page,
                loading,
              },
            }) => ({
              type: 'html',
              src: menuRenderer.getServersPageSrc({
                remoteServers,
                page,
                loading,
              }),
              x: 0,
              y: 0,
              w: WIDTH,
              h: HEIGHT,
            }), {
              type: 'servers',
              state: {
                servers: serversState,
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
        rend.registerMenuMesh('serversMesh', serversMesh);
        serversMesh.updateMatrixWorld();

        rend.reindex();
        rend.updateMatrixWorld(serversMesh);

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
