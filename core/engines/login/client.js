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
      '/core/engines/fs',
    ]).then(([
      hub,
      input,
      three,
      webvr,
      biolumi,
      rend,
      fs,
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
              const mainFontSpec = {
                fonts: biolumi.getFonts(),
                fontSize: 40,
                lineHeight: 1.4,
                fontWeight: biolumi.getFontWeight(),
                fontStyle: biolumi.getFontStyle(),
              };
              const loginState = {
                open: true,
                token: '',
                inputText: '',
                inputIndex: 0,
                inputValue: 0,
                loading: false,
                error: null,
              };
              const focusState = {
                type: '',
              };

              const menuHoverStates = {
                left: biolumi.makeMenuHoverState(),
                right: biolumi.makeMenuHoverState(),
              };

              const menuMesh = (() => {
                const object = new THREE.Object3D();
                object.position.y = DEFAULT_USER_HEIGHT;

                const planeMesh = (() => {
                  const mesh = menuUi.addPage(({
                    login: {
                      token,
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
                        src: menuRenderer.getLoginSrc({
                          token,
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
                    type: 'login',
                    state: {
                      login: loginState,
                      focus: focusState,
                    },
                    worldWidth: WORLD_WIDTH,
                    worldHeight: WORLD_HEIGHT,
                  });
                  // mesh.position.y = 1.5;
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

              const _updatePages = () => {
                menuUi.update();
              };
              _updatePages();

              const _login = () => {
                loginState.open = false;

                _updatePages();

                menuMesh.visible = false;
              };
              rend.on('login', _login, {
                priority: 1,
              });
              const _logout = () => {
                loginState.open = true;

                menuMesh.visible = true;
              };
              rend.on('logout', _logout, {
                priority: 1,
              });

              const _requestInitialLogin = () => {
                const token = _getQueryVariable('t');

                if (token !== null) {
                  return _requestLogin({
                    token,
                  });
                } else {
                  return _requestLogin();
                }
              };
              const _requestLogin = ({token = null} = {}) => new Promise((accept, reject) => {
                hub.requestLogin({
                  token,
                })
                  .then(loginSpec => {
                    if (loginSpec) {
                      rend.login();

                      accept();
                    } else {
                      accept({
                        error: 'EAUTH',
                      });
                    }
                  })
                  .catch(err => {
                    console.warn(err);

                    accept();
                  });
              });

              return _requestInitialLogin()
                .then(() => {
                  if (live) {
                    const _submit = () => {
                      const {token} = loginState;

                      if (token) {
                        loginState.loading = true;
                        loginState.error = null;

                        _updatePages();

                        _requestLogin({
                          token,
                        })
                          .then(({error = null} = {}) => {
                            loginState.loading = false;
                            loginState.error = error;

                            _updatePages();
                          });
                      } else {
                        loginState.error = 'EINPUT';

                        _updatePages();
                      }
                    };

                    const trigger = e => {
                      const {side} = e;
                      const menuHoverState = menuHoverStates[side];
                      const {intersectionPoint} = menuHoverState;

                      if (intersectionPoint) {
                        const {anchor} = menuHoverState;
                        const onclick = (anchor && anchor.onclick) || '';

                        focusState.type = '';

                        if (onclick === 'login:focus:token') {
                          const {value} = menuHoverState;
                          const valuePx = value * 640;

                          loginState.inputText = loginState.token;

                          const {index, px} = biolumi.getTextPropertiesFromCoord(loginState.inputText, mainFontSpec, valuePx);

                          loginState.inputIndex = index;
                          loginState.inputValue = px;
                          focusState.type = 'token';

                          _updatePages();
                        } else if (onclick === 'login:submit') {
                          _submit();
                        } else if (onclick === 'error:close') {
                          loginState.error = null;
                          _updatePages();
                        }
                      }
                    };
                    input.on('trigger', trigger);

                    const keydown = e => {
                      const {type} = focusState;

                      if (type === 'token') {
                        const applySpec = biolumi.applyStateKeyEvent(loginState, mainFontSpec, e);

                        if (applySpec) {
                          loginState.token = loginState.inputText;

                          const {commit} = applySpec;
                          if (commit) {
                            focusState.type = '';
                          }

                          _updatePages();

                          e.stopImmediatePropagation();
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
                    const paste = keydown;
                    input.on('paste', paste, {
                      priority: 1,
                    });

                    const _update = () => {
                      const {open} = loginState;

                      if (open) {
                        const _updateAnchors = () => {
                          const {gamepads} = webvr.getStatus();

                          const {planeMesh} = menuMesh;
                          const {page} = planeMesh;
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
                                  page: page,
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
                        _updateAnchors();
                      }
                    };
                    rend.on('update', _update);

                    const _upload = file => {
                      if (_isOpen()) {
                        const reader = new FileReader();
                        reader.onload = e => {
                          loginState.token = e.target.result;

                          _submit();
                        };
                        reader.readAsText(file);
                      }
                    };
                    fs.on('upload', _upload);

                    this._cleanup = () => {
                      scene.remove(menuMesh);

                      SIDES.forEach(side => {
                        scene.remove(menuDotMeshes[side]);
                        scene.remove(menuBoxMeshes[side]);
                      });

                      input.removeListener('trigger', trigger);
                      input.removeListener('keydown', keydown);
                      input.removeListener('keyboarddown', keyboarddown);
                      input.removeListener('paste', paste);

                      rend.removeListener('update', _update);
                      rend.removeListener('login', _login);
                      rend.removeListener('logout', _logout);

                      fs.removeListener('upload', _upload);
                    };

                    const _isOpen = () => loginState.open;

                    return {
                      isOpen: _isOpen,
                    };
                  }
                });
            }
          });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _getQueryVariable = variable => {
  const query = window.location.search.substring(1);
  const vars = query.split('&');

  for (let i = 0; i < vars.length; i++) {
    const pair = vars[i].split('=');

    if (decodeURIComponent(pair[0]) === variable) {
      return decodeURIComponent(pair[1]);
    }
  }
  return null;
}

module.exports = Login;
