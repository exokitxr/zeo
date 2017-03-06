import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

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
        '/core/engines/three',
        '/core/engines/biolumi',
        '/core/engines/rend',
      ]),
    ])
      .then(([
        [
          three,
          biolumi,
          rend,
        ],
      ]) => {
        if (live) {
          const {THREE, scene} = three;

          const transparentMaterial = biolumi.getTransparentMaterial();

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

          const _updatePages = () => {
            menuUi.update();
          };
          _updatePages();

          const _update = () => {
            // XXX
          };
          rend.on('update', _update);

          this._cleanup = () => {
            scene.remove(menuMesh);

            rend.removeListener('update', _update);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Hub;
