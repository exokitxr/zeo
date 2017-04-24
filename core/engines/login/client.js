import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  DEFAULT_USER_HEIGHT,
} from './lib/constants/menu';
import menuRenderer from './lib/render/menu';

const SIDES = ['left', 'right'];

class Login {
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

    const hubSpec = (() => {
      const match = hubUrl.match(/^(.+\..+?)(?::([0-9]*?))?$/);
      return match && {
        host: match[1],
        port: match[2] ? parseInt(match[2], 10) : 443,
      };
    })();

    const loginState = {
      open: true,
      hasHub: Boolean(hubSpec),
      token: '',
      username: '',
      loading: false,
      error: null,
    };

    const _isOpen = () => loginState.open;
    const _getUsername = () => loginState.username;

    const loginApi = {
      isOpen: _isOpen,
      getUsername: _getUsername,
    };

    if (serverEnabled) {
      return archae.requestPlugins([
        '/core/engines/bootstrap',
        '/core/engines/input',
        '/core/engines/three',
        '/core/engines/webvr',
        '/core/engines/biolumi',
        '/core/engines/keyboard',
        '/core/engines/rend',
        '/core/engines/fs',
      ]).then(([
        bootstrap,
        input,
        three,
        webvr,
        biolumi,
        keyboard,
        rend,
        fs,
      ]) => {
        if (live) {
          const {THREE, scene} = three;

          const transparentMaterial = biolumi.getTransparentMaterial();

          const _decomposeObjectMatrixWorld = object => {
            const position = new THREE.Vector3();
            const rotation = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            object.matrixWorld.decompose(position, rotation, scale);
            return {position, rotation, scale};
          };

          const mainFontSpec = {
            fonts: biolumi.getFonts(),
            fontSize: 40,
            lineHeight: 1.4,
            fontWeight: biolumi.getFontWeight(),
            fontStyle: biolumi.getFontStyle(),
          };
          const focusState = {
            keyboardFocusState: null,
          };

          const menuMesh = (() => {
            const object = new THREE.Object3D();
            object.position.y = DEFAULT_USER_HEIGHT;

            const planeMesh = (() => {
              const menuUi = biolumi.makeUi({
                width: WIDTH,
                height: HEIGHT,
              });
              const mesh = menuUi.makePage(({
                login: {
                  hasHub,
                  token,
                  loading,
                  error,
                },
                focus: {
                  keyboardFocusState,
                }
              }) => {
                const {type: focusType = '', inputIndex = 0, inputValue = 0} = keyboardFocusState || {};

                return {
                  type: 'html',
                  src: menuRenderer.getLoginSrc({
                    hasHub,
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
                };
              }, {
                type: 'login',
                state: {
                  login: loginState,
                  focus: focusState,
                },
                worldWidth: WORLD_WIDTH,
                worldHeight: WORLD_HEIGHT,
              });
              mesh.visible = loginState.open;
              mesh.position.z = -1;
              mesh.receiveShadow = true;

              const {page} = mesh;
              rend.addPage(page);

              cleanups.push(() => {
                rend.removePage(page);
              });

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
            const {planeMesh} = menuMesh;
            const {page} = planeMesh;
            page.update();
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
            if (serverEnabled) {
              const token = _getQueryVariable(bootstrap.getInitialUrl(), 't');

              if (token !== null) {
                return _requestLogin({
                  token,
                });
              } else {
                return _requestLogin();
              }
            } else {
              return Promise.resolve();
            }
          };
          const _fetchAuthenticatedJson = (url, token) => fetch('server/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({token}),
            credentials: 'same-origin',
          })
            .then(res => {
              if (res.status >= 200 && res.status < 300) {
                return res.json();
              } else {
                return null;
              }
            });
          const _requestLogin = ({token = null} = {}) => Promise.all([
            _requestUsername({token}),
            _requestToken({token}),
          ]);
          const _requestUsername = ({token}) => _fetchAuthenticatedJson('server/login', token)
            .then(loginSpec => {
              const {token, username} = loginSpec;
              history.replaceState(null, '', '?t=' + encodeURIComponent(token));

              loginState.username = username;

              rend.login();
              rend.setStatus('username', username);

              return Promise.resolve();
            })
            .catch(err => {
              console.warn(err);

              return Promise.resolve({
                error: err,
              });
            });
          const _requestToken = ({token}) => _fetchAuthenticatedJson('server/proxyLogin', token)
            .then(({token}) => {
              rend.setStatus('token', token);

              return Promise.resolve();
            })
            .catch(err => {
              console.warn(err);

              return Promise.resolve({
                error: err,
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
                      .then(() => {
                        loginState.loading = false;
                        loginState.error = null;

                        _updatePages();
                      })
                      .catch(err => {
                        loginState.loading = false;
                        loginState.error = error;

                        _updatePages();
                      });
                  } else {
                    loginState.error = 'EINPUT';

                    _updatePages();
                  }
                };

                const _trigger = e => {
                  const {side} = e;
                  const hoverState = rend.getHoverState(side);
                  const {intersectionPoint} = hoverState;

                  if (intersectionPoint) {
                    const {anchor} = hoverState;
                    const onclick = (anchor && anchor.onclick) || '';

                    if (onclick === 'login:back') {
                      bootstrap.navigate('https://' + hubUrl);
                    } else if (onclick === 'login:focus:token') {
                      const {token: inputText} = loginState;
                      const {value} = hoverState;
                      const valuePx = value * 640;
                      const {index, px} = biolumi.getTextPropertiesFromCoord(loginState.inputText, mainFontSpec, valuePx); // XXX this can be folded into the keyboard engine
                      const {hmd: {position: hmdPosition, rotation: hmdRotation}} = webvr.getStatus();
                      const keyboardFocusState = keyboard.focus({
                        type: 'token',
                        position: hmdPosition,
                        rotation: hmdRotation,
                        inputText: inputText,
                        inputIndex: index,
                        inputValue: px,
                        fontSpec: mainFontSpec,
                      });
                      focusState.keyboardFocusState = keyboardFocusState;

                      keyboardFocusState.on('update', () => {
                        const {inputText} = keyboardFocusState;
                        loginState.token = inputText;

                        _updatePages();
                      });
                      keyboardFocusState.on('blur', () => {
                        focusState.keyboardFocusState = null;

                        _updatePages();
                      });

                      _updatePages();
                    } else if (onclick === 'login:submit') {
                      _submit();
                    } else if (onclick === 'error:close') {
                      loginState.error = null;
                      _updatePages();
                    }
                  }
                };
                input.on('trigger', _trigger);

                const _upload = file => {
                  if (loginApi.isOpen()) {
                    const reader = new FileReader();
                    reader.onload = e => {
                      loginState.token = e.target.result;

                      _submit();
                    };
                    reader.readAsText(file);
                  }
                };
                fs.on('upload', _upload);

                cleanups.push(() => {
                  scene.remove(menuMesh);

                  input.removeListener('trigger', _trigger);

                  rend.removeListener('login', _login);
                  rend.removeListener('logout', _logout);

                  fs.removeListener('upload', _upload);
                });

                return loginApi;
              }
            });
        }
      });
    } else {
      return loginApi;
    }
  }

  unmount() {
    this._cleanup();
  }
}

const _getQueryVariable = (url, variable) => {
  const match = url.match(/\?(.+)$/);
  const query = match ? match[1] : '';
  const vars = query.split('&');

  for (let i = 0; i < vars.length; i++) {
    const pair = vars[i].split('=');

    if (decodeURIComponent(pair[0]) === variable) {
      return decodeURIComponent(pair[1]);
    }
  }
  return null;
};

module.exports = Login;
