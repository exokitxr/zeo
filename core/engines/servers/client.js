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
    const {metadata: {hub: {url: hubUrl}, server: {enabled: serverEnabled}}} = archae;

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

    if (serverEnabled) {
      return archae.requestPlugins([
        '/core/engines/bootstrap',
        '/core/engines/input',
        '/core/engines/three',
        '/core/engines/webvr',
        '/core/engines/biolumi',
        '/core/engines/rend',
        '/core/utils/js-utils',
        '/core/utils/creature-utils',
      ]).then(([
        bootstrap,
        input,
        three,
        webvr,
        biolumi,
        rend,
        jsUtils,
        creatureUtils,
      ]) => {
        if (live) {
          const {THREE, scene} = three;
          const {events} = jsUtils;
          const {EventEmitter} = events;

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

          const mainFontSpec = {
            fonts: biolumi.getFonts(),
            fontSize: 30,
            lineHeight: 1.4,
            fontWeight: biolumi.getFontWeight(),
            fontStyle: biolumi.getFontStyle(),
          };

          const serversState = {
            remoteServers: [],
            page: 0,
            loaded: false,
            loading: false,
          };

          const _requestRemoteServers = () => fetch(hubUrl + '/servers/servers.json')
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

          const tabchange = tab => {
            if (tab === 'servers') {
              const {loaded} = serversState;

              if (!loaded) {
                serversState.loading = true;
                serversState.loaded = true;

                _updatePages();

                _requestRemoteServers()
                  .then(remoteServers => {
                    serversState.remoteServers = remoteServers;
                    serversState.loading = false;

                    _updatePages();
                  })
                  .catch(err => {
                    console.warn(err);
                  });
              }
            }
          };
          rend.on('tabchange', tabchange);

          cleanups.push(() => {
            rend.removeListener('tabchange', tabchange);
          });
        }
      });
    }
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Servers;
