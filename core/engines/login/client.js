import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  DEFAULT_USER_HEIGHT,
} from './lib/constants/menu';
import menuUtils from './lib/utils/menu';
import menuRenderer from './lib/render/menu';

const SIDES = ['left', 'right'];

class Login {
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
      '/core/engines/hub',
      '/core/engines/input',
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/rend',
    ]).then(([
      hub,
      input,
      three,
      webvr,
      biolumi,
      rend,
    ]) => {
      if (live) {
        const {THREE, scene} = three;

        const transparentMaterial = biolumi.getTransparentMaterial();
        const solidMaterial = biolumi.getSolidMaterial();

        const _decomposeObjectMatrixWorld = object => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          object.matrixWorld.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const _requestUis = () => Promise.all([
          biolumi.requestUi({
            width: WIDTH,
            height: HEIGHT,
          }),
        ]).then(([
          menuUi,
        ]) => ({
          menuUi,
        }));

        return _requestUis()
          .then(({
            menuUi,
          }) => {
            if (live) {
              const loginState = {
                username: '',
                password: '',
              };
              const focusState = {
                type: '',
              };

              const menuHoverStates = {
                left: biolumi.makeMenuHoverState(),
                right: biolumi.makeMenuHoverState(),
              };

              menuUi.pushPage(({login}) => [
                {
                  type: 'html',
                  src: menuRenderer.getLoginSrc(login),
                  x: 0,
                  y: 0,
                  w: WIDTH,
                  h: HEIGHT,
                  scroll: true,
                },
              ], {
                type: 'login',
                state: {
                  login: loginState,
                  focus: focusState,
                },
                immediate: true,
              });

              const menuMesh = (() => {
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

              const menuDotMeshes = {
                left: biolumi.makeMenuDotMesh(),
                right: biolumi.makeMenuDotMesh(),
              };
              scene.add(menuDotMeshes.left);
              scene.add(menuDotMeshes.right);

              const menuBoxMeshes = {
                left: biolumi.makeMenuBoxMesh(),
                right: biolumi.makeMenuBoxMesh(),
              };
              scene.add(menuBoxMeshes.left);
              scene.add(menuBoxMeshes.right);

              const _updatePages = menuUtils.debounce(next => {
                const pages = menuUi.getPages();

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

                    if (type === 'status') {
                      page.update({
                        login: loginState,
                        focus: focusState,
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
                // XXX
              };
              input.on('trigger', trigger);

              const _update = () => {
                const _updateTextures = () => {
                  const {
                    planeMesh: {
                      menuMaterial: statusMenuMaterial,
                    },
                  } = menuMesh;
                  const uiTime = rend.getUiTime();

                  biolumi.updateMenuMaterial({
                    ui: menuUi,
                    menuMaterial: statusMenuMaterial,
                    uiTime,
                  });
                };
                const _updateAnchors = () => {
                  const status = webvr.getStatus();
                  const {gamepads} = status;

                  const {planeMesh} = menuMesh;
                  const menuMatrixObject = _decomposeObjectMatrixWorld(planeMesh);

                  SIDES.forEach(side => {
                    const gamepad = gamepads[side];

                    if (gamepad) {
                      const {position: controllerPosition, rotation: controllerRotation} = gamepad;

                      const menuHoverState = menuHoverStates[side];
                      const menuDotMesh = menuDotMeshes[side];
                      const menuBoxMesh = menuBoxMeshes[side];

                      biolumi.updateAnchors({
                        objects: [{
                          matrixObject: menuMatrixObject,
                          ui: menuUi,
                          width: WIDTH,
                          height: HEIGHT,
                          worldWidth: WORLD_WIDTH,
                          worldHeight: WORLD_HEIGHT,
                          worldDepth: WORLD_DEPTH,
                        }],
                        hoverState: menuHoverState,
                        dotMesh: menuDotMesh,
                        boxMesh: menuBoxMesh,
                        controllerPosition,
                        controllerRotation,
                      });
                    }
                  });
                };

                _updateTextures();
                _updateAnchors();
              };
              rend.on('update', _update);

              this._cleanup = () => {
                scene.remove(menuMesh);

                SIDES.forEach(side => {
                  scene.remove(menuDotMeshes[side]);
                  scene.remove(menuBoxMeshes[side]);
                });

                input.removeListener('trigger', trigger);
                rend.removeListener('update', _update);
              };
            }
          });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Login;
