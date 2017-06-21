import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,

  TAGS_WIDTH,
  TAGS_HEIGHT,
  TAGS_WORLD_WIDTH,
  TAGS_WORLD_HEIGHT,
  TAGS_WORLD_DEPTH,
} from './lib/constants/wallet';
import walletRender from './lib/render/wallet';
import menuUtils from './lib/utils/menu';
import vridApi from 'vrid/lib/frontend-api';

const TAGS_PER_ROW = 4;
const TAGS_ROWS_PER_PAGE = 6;
const TAGS_PER_PAGE = TAGS_PER_ROW * TAGS_ROWS_PER_PAGE;
const ASSET_TAG_MESH_SCALE = 1.5;
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];
const NUM_POSITIONS = 100 * 1024;
const CREDIT_ASSET_NAME = 'CRD';

const SIDES = ['left', 'right'];

class Wallet {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {vrid: {url: vridUrl}, server: {enabled: serverEnabled}}} = archae;

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
      '/core/engines/three',
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/keyboard',
      '/core/engines/hand',
      '/core/engines/rend',
      '/core/engines/tags',
      '/core/utils/js-utils',
      '/core/utils/creature-utils',
    ]).then(([
      bootstrap,
      three,
      input,
      webvr,
      biolumi,
      keyboard,
      hand,
      rend,
      tags,
      jsUtils,
      creatureUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;

        const walletRenderer = walletRender.makeRenderer({creatureUtils});

        const assetMaterial = new THREE.MeshBasicMaterial({
          color: 0xFFFFFF,
          shading: THREE.FlatShading,
          vertexColors: THREE.VertexColors,
        });
        const transparentMaterial = biolumi.getTransparentMaterial();

        const forwardVector = new THREE.Vector3(0, 0, -1);

        const mainFontSpec = {
          fonts: biolumi.getFonts(),
          fontSize: 36,
          lineHeight: 1.4,
          fontWeight: biolumi.getFontWeight(),
          fontStyle: biolumi.getFontStyle(),
        };

        const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const walletState = {
          loaded: false,
          loading: true,
          charging: false,
          error: false,
          inputText: '',
          address: null,
          asset: null,
          assets: [],
          numTags: 0,
          page: 0,
        };
        const focusState = {
          keyboardFocusState: null,
        };

        const walletMesh = (() => {
          const object = new THREE.Object3D();
          object.visible = false;

          const planeMesh = (() => {
            const worldUi = biolumi.makeUi({
              width: WIDTH,
              height: HEIGHT,
            });
            const mesh = worldUi.makePage(({
              wallet: {
                loading,
                charging,
                error,
                inputText,
                asset,
                assets,
                numTags,
                page,
              },
              focus: {
                keyboardFocusState,
              },
            }) => {
              const {type = '', inputValue = 0} = keyboardFocusState || {};
              const focus = type === 'wallet';

              return {
                type: 'html',
                src: walletRenderer.getWalletPageSrc({loading, charging, error, inputText, inputValue, asset, assets, numTags, page, focus}),
                x: 0,
                y: 0,
                w: WIDTH,
                h: HEIGHT,
              };
            }, {
              type: 'wallet',
              state: {
                wallet: walletState,
                focus: focusState,
              },
              worldWidth: WORLD_WIDTH,
              worldHeight: WORLD_HEIGHT,
              isEnabled: () => rend.isOpen(),
            });
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
            const material = transparentMaterial;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            return mesh;
          })();
          object.add(shadowMesh);

          return object;
        })();
        rend.registerMenuMesh('walletMesh', walletMesh);
        walletMesh.updateMatrixWorld();

        rend.reindex();
        rend.updateMatrixWorld(walletMesh);

        const _updatePages = () => {
          const {planeMesh} = walletMesh;
          const {page} = planeMesh;
          page.update();
        };
        _updatePages();

        const _resJson = res => {
          if (res.status >= 200 && res.status < 300) {
            return res.json();
          } else {
            return Promise.reject(new Error('invalid status code: ' + res.status));
          }
        };
        const _requestAssets = () => fetch(`${vridUrl}/id/api/assets`, {
          credentials: 'include',
        })
          .then(_resJson);
        const _updateAssets = assets => {
          if (assets !== null) {
            walletState.page = 0;
            walletState.assets = assets;
            walletState.numTags = assets.length;
          } else {
            walletState.error = true;
          }
        };
        const _refreshAssets = () => _requestAssets()
          .then(assets => {
            _updateAssets(assets);
          })
          .catch(err => {
            _updateAssets(null);

            return Promise.reject(err);
          });
        const _updateWallet = menuUtils.debounce(next => {
          /* const {inputText} = walletState;
          const searchText = inputText.toLowerCase(); */

          _refreshAssets()
            .then(() => {
              walletState.loading = false;
              _updatePages();

              next();
            })
            .catch(err => {
              console.warn(err);

              walletState.loading = false;
              _updatePages();

              next();
            });

          const {numTags} = walletState;
          walletState.loading = numTags === 0;
        });
        const _ensureLoaded = () => {
          const {loaded} = walletState;

          if (!loaded) {
            return _refreshAssets()
              .then(() => {
                walletState.loaded = true;
              });
          } else {
            return Promise.resolve();
          }
        };
        const _ensureInitialLoaded = () => {
          const {loaded} = walletState;

          if (!loaded) {
            walletState.loading = true;
            _updatePages();

            return _refreshAssets()
              .then(() => {
                walletState.loaded = true;
                walletState.loading = false;

                _updatePages();
              });
          } else {
            return Promise.resolve();
          }
        };

        const _trigger = e => {
          const {side} = e;

          const _clickMenu = () => {
            const hoverState = rend.getHoverState(side);
            const {anchor} = hoverState;
            const onclick = (anchor && anchor.onclick) || '';

            let match;
            if (onclick === 'wallet:focus') {
              const {inputText} = walletState;
              const {value} = hoverState;
              const valuePx = value * (WIDTH - (250 + (30 * 2)));
              const {index, px} = biolumi.getTextPropertiesFromCoord(inputText, mainFontSpec, valuePx);
              const {hmd: hmdStatus} = webvr.getStatus();
              const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmdStatus;
              const keyboardFocusState = keyboard.focus({
                type: 'wallet',
                position: hmdPosition,
                rotation: hmdRotation,
                inputText: inputText,
                inputIndex: index,
                inputValue: px,
                fontSpec: mainFontSpec,
              });
              focusState.keyboardFocusState = keyboardFocusState;

              keyboardFocusState.on('update', () => {
                const {inputText: keyboardInputText} = keyboardFocusState;
                const {inputText: walletInputText} = walletState;

                if (keyboardInputText !== walletInputText) {
                  walletState.inputText = keyboardInputText;

                  _updateWallet();
                }

                _updatePages();
              });
              keyboardFocusState.on('blur', () => {
                focusState.keyboardFocusState = null;

                _updatePages();
              });

              _updatePages();

              return true;
            } else if (match = onclick.match(/^asset:main:(.+)$/)) {
              const assetName = match[1];

              const {assets} = walletState;
              const asset = assets.find(asset => asset.asset === assetName);
              walletState.asset = asset;

              _updatePages();

              return true;
            } else if (onclick === 'wallet:back') {
              walletState.asset = null;

              _updatePages();

              return true;
            } else if (match = onclick.match(/^asset:bill:(.+):([0-9.]+)$/)) {
              const asset = match[1];
              const quantity = parseFloat(match[2]);

              const status = webvr.getStatus();
              const {hmd} = status;
              const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmd;

              const position = hmdPosition.clone()
                .add(forwardVector.clone().applyQuaternion(hmdRotation));
              const rotation = new THREE.Quaternion();
              const scale = new THREE.Vector3(1, 1, 1);

              const _requestCreatePack = ({asset, quantity}) => {
                const srcAddress = bootstrap.getAddress();
                const privateKeyBuffer = (() => {
                  const result = new Uint8Array(32);
                  crypto.getRandomValues(result);
                  return result;
                })();
                const privateKey = _arrayToBase64(privateKeyBuffer);
                const dstAddress = vridApi.getAddress(privateKeyBuffer);

                return fetch(`${vridUrl}/id/api/pack`, {
                  method: 'POST',
                  headers: (() => {
                    const headers = new Headers();
                    headers.append('Content-Type', 'application/json');
                    return headers;
                  })(),
                  body: JSON.stringify({
                    srcAddress: srcAddress,
                    dstAddress: dstAddress,
                    asset: asset,
                    quantity: quantity,
                    privateKey: privateKey,
                  }),
                  credentials: 'include',
                })
                  .then(_resJson)
                  .then(() => ({dstAddress, privateKey}));
              };
              const _requestAddAsset = ({asset, quantity, dstAddress, privateKey}) => {
                const itemSpec = {
                  type: 'asset',
                  id: _makeId(),
                  name: asset,
                  displayName: asset,
                  attributes: {
                    position: {
                      value: position.toArray().concat(rotation.toArray()).concat(scale.toArray()),
                    },
                    asset: {
                      value: asset,
                    },
                    quantity: {
                      value: quantity,
                    },
                    address: {
                      value: dstAddress,
                    },
                    privateKey: {
                      value: privateKey,
                    },
                  },
                  metadata: {},
                };
                walletApi.emit('addAsset', itemSpec);

                return Promise.resolve();
              };

              _requestCreatePack({asset, quantity})
                .then(({dstAddress, privateKey}) => _requestAddAsset({asset, quantity, dstAddress, privateKey}))
                .then(() => {
                  _cleanupCharging();
                })
                .catch(err => {
                  console.warn(err);

                  _cleanupCharging();
                });

              walletState.charging = true;
              _updatePages();

              const _cleanupCharging = () => {
                walletState.charging = false;
                _updatePages();
              };

              return true;
            } else if (onclick === 'wallet:manage') {
              console.log('manage account'); // XXX make this link to the vrid page

              return true;
            } else if (onclick === 'wallet:refresh') {
              _updateWallet();
              _updatePages();

              return true;
            } else {
              return false;
            }
          };

          if (_clickMenu()) {
            e.stopImmediatePropagation();
          }
        };
        input.on('trigger', _trigger, {
          priority: 1,
        });

        const _tabchange = tab => {
          if (tab === 'wallet') {
            keyboard.tryBlur();

            _ensureInitialLoaded()
              .catch(err => {
                console.warn(err);
              });
          }
        };
        rend.on('tabchange', _tabchange);

        const _update = () => {
          // XXX
        };
        rend.on('update', _update);

        cleanups.push(() => {
          input.removeListener('trigger', _trigger);
          rend.removeListener('tabchange', _tabchange);
          rend.removeListener('update', _update);
        });

        class WalletApi extends EventEmitter {
          requestAssets() {
            return _ensureLoaded()
              .then(() => walletState.assets);
          }
        }
        const walletApi = new WalletApi();

        return walletApi;
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _makeId = () => Math.random().toString(36).substring(7);
const _arrayToBase64 = array => {
  let binary = '';
  for (let i = 0; i < array.byteLength; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary);
};
const _formatQueryString = o => {
  const result = [];
  for (const k in o) {
    result.push(encodeURIComponent(k) + '=' + encodeURIComponent(o[k]));
  }
  return result.join('&');
};
const _normalizeAssetName = name => name === 'BTC' ? CREDIT_ASSET_NAME : name;

module.exports = Wallet;
