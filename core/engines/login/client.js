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
              const mainFontSpec = {
                fonts: biolumi.getFonts(),
                fontSize: 40,
                lineHeight: 1.4,
                fontWeight: biolumi.getFontWeight(),
                fontStyle: biolumi.getFontStyle(),
              };
              const loginState = {
                open: true,
                username: '',
                password: '',
                inputText: '',
                inputIndex: 0,
                inputValue: 0,
                loading: false,
                error: null,
                authentication: null,
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
                      username,
                      password,
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
                          username,
                          password,
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

              const _updatePages = {
                menuUi.update();
              };
              _updatePages();

              const login = () => {
                loginState.open = false;

                _updatePages();

                menuMesh.visible = false;
              };
              rend.on('login', login);
              const logout = () => {
                const token = localStorage.removeItem('token');

                loginState.open = true;
                loginState.authentication = null;

                _updatePages();

                menuMesh.visible = true;
              };
              rend.on('logout', logout);

              const _requestInitialLogin = () => {
                const username = _getQueryVariable('username');
                const password = _getQueryVariable('password');

                if (username !== null && password !== null) {
                  return _requestLogin({
                    username,
                    password,
                  });
                } else {
                  const token = localStorage.getItem('token');

                  if (token) {
                    return _requestLogin({
                      token,
                    });
                  } else {
                    return Promise.resolve();
                  }
                }
              };
              const _requestLogin = ({username, password, token}) => new Promise((accept, reject) => {
                hub.requestLogin({
                  username,
                  password,
                  token,
                })
                  .then(loginSpec => {
                    if (loginSpec) {
                      const {token, authentication} = loginSpec;
                      localStorage.setItem('token', token);

                      loginState.authentication = authentication;

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
                    const trigger = e => {
                      const {side} = e;
                      const menuHoverState = menuHoverStates[side];
                      const {intersectionPoint} = menuHoverState;

                      if (intersectionPoint) {
                        const {anchor} = menuHoverState;
                        const onclick = (anchor && anchor.onclick) || '';

                        focusState.type = '';

                        if (onclick === 'login:focus:username') {
                          const {value} = menuHoverState;
                          const valuePx = value * 640;

                          loginState.inputText = loginState.username;

                          const {index, px} = biolumi.getTextPropertiesFromCoord(loginState.inputText, mainFontSpec, valuePx);

                          loginState.inputIndex = index;
                          loginState.inputValue = px;
                          focusState.type = 'username';

                          _updatePages();
                        } else if (onclick === 'login:focus:password') {
                          const {value} = menuHoverState;
                          const valuePx = value * 640;

                          loginState.inputText = loginState.password;

                          const {index, px} = biolumi.getTextPropertiesFromCoord(loginState.inputText, mainFontSpec, valuePx);

                          loginState.inputIndex = index;
                          loginState.inputValue = px;
                          focusState.type = 'password';

                          _updatePages();
                        } else if (onclick === 'login:submit') {
                          const {username, password} = loginState;

                          if (username && password) {
                            loginState.loading = true;
                            loginState.error = null;

                            _updatePages();

                            _requestLogin({
                              username,
                              password,
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
                        }
                      }
                    };
                    input.on('trigger', trigger);

                    const keydown = e => {
                      const {type} = focusState;

                      if (type === 'username') {
                        const applySpec = biolumi.applyStateKeyEvent(loginState, mainFontSpec, e);

                        if (applySpec) {
                          loginState.username = loginState.inputText;

                          const {commit} = applySpec;
                          if (commit) {
                            focusState.type = '';
                          }

                          _updatePages();

                          e.stopImmediatePropagation();
                        }
                      } else if (type === 'password') {
                        const applySpec = biolumi.applyStateKeyEvent(loginState, mainFontSpec, e);

                        if (applySpec) {
                          loginState.password = loginState.inputText;

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

                    const _update = () => {
                      const {open} = loginState;

                      if (open) {
                        const _updateAnchors = () => {
                          const {gamepads} = webvr.getStatus();

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
                        _updateAnchors();
                      }
                    };
                    rend.on('update', _update);

                    this._cleanup = () => {
                      scene.remove(menuMesh);

                      SIDES.forEach(side => {
                        scene.remove(menuDotMeshes[side]);
                        scene.remove(menuBoxMeshes[side]);
                      });

                      input.removeListener('trigger', trigger);
                      input.removeListener('keydown', keydown);
                      input.removeListener('keyboarddown', keyboarddown);

                      rend.removeListener('update', _update);
                      rend.removeListener('login', login);
                      rend.removeListener('logout', logout);
                    };

                    const _isOpen = () => loginState.open;
                    const _getAuthentication = () => loginState.authentication;

                    return {
                      isOpen: _isOpen,
                      getAuthentication: _getAuthentication,
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
