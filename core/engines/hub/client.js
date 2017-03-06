import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  SERVER_WIDTH,
  SERVER_HEIGHT,
  SERVER_WORLD_WIDTH,
  SERVER_WORLD_HEIGHT,
  SERVER_WORLD_DEPTH,

  DEFAULT_USER_HEIGHT,
} from './lib/constants/menu';
import menuRenderer from './lib/render/menu';

const DEFAULT_MATRIX = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const NUM_INVENTORY_ITEMS = 4;

class Hub {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {hub: {enabled: hubEnabled}}} = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/bootstrap',
        '/core/engines/three',
        '/core/engines/webvr',
        '/core/engines/biolumi',
        '/core/engines/rend',
        '/core/plugins/creature-utils',
      ]),
    ])
      .then(([
        [
          bootstrap,
          three,
          webvr,
          biolumi,
          rend,
          creatureUtils,
        ],
      ]) => {
        if (live) {
          const {THREE, scene, camera} = three;

          const transparentMaterial = biolumi.getTransparentMaterial();
          const transparentImg = biolumi.getTransparentImg();

          const menuUi = biolumi.makeUi({
            width: WIDTH,
            height: HEIGHT,
          });

          const mainFontSpec = {
            fonts: biolumi.getFonts(),
            fontSize: 40,
            lineHeight: 1.4,
            fontWeight: biolumi.getFontWeight(),
            fontStyle: biolumi.getFontStyle(),
          };
          const hubState = {
            open: hubEnabled,
            searchText: '',
            username: '',
            inputText: '',
            inputIndex: 0,
            inputValue: 0,
            loading: false,
            error: null,
          };
          const focusState = {
            type: '',
          };

          const menuMesh = (() => {
            const object = new THREE.Object3D();
            object.position.y = DEFAULT_USER_HEIGHT;

            const planeMesh = (() => {
              const mesh = menuUi.addPage(({
                login: {
                  searchText,
                  inputIndex,
                  inputValue,
                  loading,
                  error,
                },
                focus: {
                  type: focusType,
                }
              }) => {
                return [
                  {
                    type: 'html',
                    src: menuRenderer.getHubSrc({
                      searchText,
                      inputIndex,
                      inputValue,
                      loading,
                      error,
                      focusType,
                    }),
                    x: 0,
                    y: 0,
                    w: WIDTH,
                    h: HEIGHT,
                  },
                ];
              }, {
                type: 'hub',
                state: {
                  login: hubState,
                  focus: focusState,
                },
                worldWidth: WORLD_WIDTH,
                worldHeight: WORLD_HEIGHT,
              });
              mesh.visible = hubState.open;
              mesh.position.z = -1;
              mesh.receiveShadow = true;

              return mesh;
            })();
            object.add(planeMesh);
            object.planeMesh = planeMesh;

            const shadowMesh = (() => {
              const geometry = new THREE.BoxBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT, 0.01);
              const material = transparentMaterial.clone();
              material.depthWrite = false;

              const mesh = new THREE.Mesh(geometry, material);
              mesh.castShadow = true;
              return mesh;
            })();
            object.add(shadowMesh);

            return object;
          })();
          scene.add(menuMesh);

          const _getServerMeshes = servers => {
            const result = Array(servers.length);

            const _makeServerEnvMesh = server => {
              const geometry = new THREE.SphereBufferGeometry(0.25, 32, 32);
              const material = (() => {
                const texture = new THREE.CubeTexture(
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

                const img = new Image();
                img.src = creatureUtils.makeStaticCreature('server:' + server.worldname);
                img.onload = () => {
                  const images = (() => {
                    const result = [];
                    for (let i = 0; i < 6; i++) {
                      result[i] = img;
                    }
                    return result;
                  })();
                  texture.images = images;
                  texture.needsUpdate = true;
                };
                img.onerror = err => {
                  console.warn(err);
                };

                const material = new THREE.MeshPhongMaterial({
                  color: 0xffffff,
                  envMap: texture,
                });
                return material;
              })();

              const mesh = new THREE.Mesh(geometry, material);
              return mesh;
            };
            const _makeServerMenuMesh = server => {
              const object = new THREE.Object3D();

              const planeMesh = (() => {
                const serverUi = biolumi.makeUi({
                  width: SERVER_WIDTH,
                  height: SERVER_HEIGHT,
                });

                const mesh = serverUi.addPage(({
                  server: {
                    worldname,
                    description,
                  },
                }) => {
                  return [
                    {
                      type: 'html',
                      src: menuRenderer.getServerSrc({
                        worldname,
                        description,
                      }),
                      x: 0,
                      y: 0,
                      w: SERVER_WIDTH,
                      h: SERVER_HEIGHT,
                    },
                  ];
                }, {
                  type: 'hub',
                  state: {
                    server: {
                      worldname: server.worldname,
                      description: server.url,
                    },
                  },
                  worldWidth: SERVER_WORLD_WIDTH,
                  worldHeight: SERVER_WORLD_HEIGHT,
                });
                mesh.position.y = 0.5;
                mesh.receiveShadow = true;
                mesh.ui = serverUi;

                serverUi.update();

                return mesh;
              })();
              object.add(planeMesh);
              object.planeMesh = planeMesh;

              const shadowMesh = (() => {
                const geometry = new THREE.BoxBufferGeometry(SERVER_WORLD_WIDTH, SERVER_WORLD_HEIGHT, 0.01);
                const material = transparentMaterial.clone();
                material.depthWrite = false;

                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                return mesh;
              })();
              object.add(shadowMesh);

              return object;
            };

            for (let i = 0; i < servers.length; i++) {
              const server = servers[i];

              const mesh = (() => {
                const object = new THREE.Object3D();
                object.position.x = -2 + (i * 1);
                object.position.y = 1;

                const envMesh = _makeServerEnvMesh(server);
                object.add(envMesh);
                object.envMesh = envMesh;

                const menuMesh = _makeServerMenuMesh(server);
                object.add(menuMesh);
                object.menuMesh = menuMesh;

                return object;
              })();
              result[i] = mesh;
            }

            return result;
          };
          const serverMeshes = _getServerMeshes(bootstrap.getServers());
          for (let i = 0; i < serverMeshes.length; i++) {
            const serverMesh = serverMeshes[i];
            scene.add(serverMesh);
          }

          const _updatePages = () => {
            menuUi.update();
          };
          _updatePages();

          const _update = () => {
            const {hmd} = webvr.getStatus();

            for (let i = 0; i < serverMeshes.length; i++) {
              const serverMesh = serverMeshes[i];
              serverMesh.rotation.y = new THREE.Euler().setFromQuaternion(hmd.rotation, camera.rotation.order).y;
            }
          };
          rend.on('update', _update);

          this._cleanup = () => {
            scene.remove(menuMesh);
            serverMeshes.forEach(serverMesh => {
              scene.remove(serverMesh);
            });

            rend.removeListener('update', _update);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

const _padNumber = (n, width) => {
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
};

module.exports = Hub;
