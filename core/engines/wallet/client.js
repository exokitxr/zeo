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
import walletRenderer from './lib/render/wallet';
import menuUtils from './lib/utils/menu';

const TAGS_PER_ROW = 4;
const TAGS_ROWS_PER_PAGE = 6;
const TAGS_PER_PAGE = TAGS_PER_ROW * TAGS_ROWS_PER_PAGE;
const ASSET_TAG_MESH_SCALE = 1.5;
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const SIDES = ['left', 'right'];

class Wallet {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {site: {url: siteUrl}, home: {enabled: homeEnabled}, server: {enabled: serverEnabled}}} = archae;

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
      '/core/engines/three',
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/keyboard',
      '/core/engines/rend',
      '/core/engines/tags',
      '/core/utils/geometry-utils',
    ]).then(([
      three,
      input,
      webvr,
      biolumi,
      keyboard,
      rend,
      tags,
      geometryUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;

        const transparentMaterial = biolumi.getTransparentMaterial();

        const oneVector = new THREE.Vector3(1, 1, 1);

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
          loading: true,
          loggedIn: false,
          inputText: '',
          numTags: 0,
          page: 0,
        };
        const focusState = {
          keyboardFocusState: null,
        };
        const walletCacheState = {
          tagMeshes: [],
          loaded: false,
        };

        const walletMesh = (() => {
          const result = new THREE.Object3D();
          result.visible = false;

          const menuMesh = (() => {
            const object = new THREE.Object3D();

            const planeMesh = (() => {
              const worldUi = biolumi.makeUi({
                width: WIDTH,
                height: HEIGHT,
              });
              const mesh = worldUi.makePage(({
                wallet: {
                  loading,
                  loggedIn,
                  inputText,
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
                  src: walletRenderer.getWalletPageSrc({loading, loggedIn, inputText, inputValue, numTags, page, focus}),
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
          result.add(menuMesh);
          result.menuMesh = menuMesh;

          const assetsMesh = (() => {
            const object = new THREE.Object3D();
            object.position.z = 0.001;
            return object;
          })();
          result.add(assetsMesh);
          result.assetsMesh = assetsMesh;

          return result;
        })();
        rend.registerMenuMesh('walletMesh', walletMesh);
        walletMesh.updateMatrixWorld();

        const _updatePages = () => {
          const {menuMesh} = walletMesh;
          const {planeMesh} = menuMesh;
          const {page} = planeMesh;
          page.update();
        };
        _updatePages();

        const _openWalletWindow = req => {
          const width = 800;
          const height = 600;

          return window.open(
            `${siteUrl}/id/iframe?${_formatQueryString(req)}`,
            'wallet',
            `left=${(screen.width - width) / 2},top=${(screen.height - height) / 2},width=${width},height=${height}`
          );
        }

        const _requestWallet = (req, cb) => {
          const walletWindow = _openWalletWindow(req);

          const _cleanup = () => {
            window.removeEventListener('message', _onmessage);

            walletWindow.close();
          };

          const _onmessage = e => {
            _cleanup();

            const {data} = e;
            const {error} = data;

            if (!error) {
              const {result} = data;

              cb(null, result);
            } else {
              cb(error);
            }
          };
          window.addEventListener('message', _onmessage);
        };

        let visibleAssetTagMeshes = [];
        const walletCancels = [];
        const _alignAssetTagMeshes = () => {
          // hide old
          const oldTagMeshes = visibleAssetTagMeshes;
          for (let i = 0; i < oldTagMeshes.length; i++) {
            const oldTagMesh = oldTagMeshes[i];
            oldTagMesh.visible = false;
            oldTagMesh.initialVisible = false;
          }

          // cancel old rendering
          for (let i = 0; i < walletCancels.length; i++) {
            const walletCancel = walletCancels[i];
            walletCancel();
          }
          walletCancels.length = 0;

          // show new
          const {assetsMesh} = walletMesh;
          const {page} = walletState;
          const {tagMeshes} = walletCacheState;
          const aspectRatio = 400 / 150;
          const width = TAGS_WORLD_WIDTH * ASSET_TAG_MESH_SCALE;
          const height = width / aspectRatio;
          const leftClip = ((30 / WIDTH) * WORLD_WIDTH);
          const rightClip = (((250 + 30) / WIDTH) * WORLD_WIDTH);
          const padding = (WORLD_WIDTH - (leftClip + rightClip) - (TAGS_PER_ROW * width)) / (TAGS_PER_ROW - 1);
          const newTagMeshes = [];
          const startIndex = page * TAGS_PER_PAGE;
          const endIndex = (page + 1) * TAGS_PER_PAGE;
          for (let i = startIndex; i < endIndex && i < tagMeshes.length; i++) {
            const newTagMesh = tagMeshes[i];

            const baseI = i - startIndex;
            const x = baseI % TAGS_PER_ROW;
            const y = Math.floor(baseI / TAGS_PER_ROW);
            newTagMesh.position.set(
              -(WORLD_WIDTH / 2) + (leftClip + (width / 2)) + (x * (width + padding)),
              (WORLD_HEIGHT / 2) - (height / 2) - (y * (height + padding)) - 0.23,
              0
            );
            newTagMesh.planeDetailsMesh.position.copy(
              newTagMesh.planeDetailsMesh.initialOffset.clone().sub(newTagMesh.position)
            );
            newTagMesh.visible = true;
            newTagMesh.initialVisible = true;

            const {planeMesh: newTagMeshPlaneMesh} = newTagMesh;
            const {page: newTagMeshPage} = newTagMeshPlaneMesh;
            const walletCancel = newTagMeshPage.initialUpdate();

            newTagMeshes.push(newTagMesh);
            walletCancels.push(walletCancel);
          }
          visibleAssetTagMeshes = newTagMeshes;
        };

        const _requestStatus = () => fetch(`${siteUrl}/id/api/status`, {
          credentials: 'include',
        })
          .then(res => res.json());
        const _updateWallet = menuUtils.debounce(next => {
          const {inputText} = walletState;
          const searchText = inputText.toLowerCase();

          _requestStatus()
            .then(status => ({
              address: status.address,
              assets: status.assets
                .concat(status.balance > 0 ? [
                  {
                    asset: 'BTC',
                    quantity: status.balance,
                  }
                ] : [])
                .filter(itemSpec => !searchText || itemSpec.asset.toLowerCase().indexOf(searchText) !== -1)
            }))
            .then(status => {
              _updateStatus(status);

              next();
            })
            .catch(err => {
              console.warn(err);

              next();
            });

          const {numTags} = walletState;
          walletState.loading = numTags === 0;

          _updatePages();
        });
        const _updateStatus = status => {
          const {address, assets: assetSpecs} = status;
          const tagMeshes = assetSpecs
            .map(assetSpec => {
              const {asset, quantity} = assetSpec;

              const assetTagMesh = tags.makeTag({
                type: 'asset',
                id: asset,
                name: asset,
                displayName: asset,
                quantity: quantity,
                matrix: DEFAULT_MATRIX,
                metadata: {
                  isStatic: true,
                },
              }, {
                initialUpdate: false,
              });
              assetTagMesh.planeMesh.scale.set(ASSET_TAG_MESH_SCALE, ASSET_TAG_MESH_SCALE, 1);

              return assetTagMesh;
            });
          const {tagMeshes: oldTagMeshes} = walletCacheState;

          const {assetsMesh} = walletMesh;
          for (let i = 0; i < oldTagMeshes.length; i++) {
            const oldTagMesh = oldTagMeshes[i];
            assetsMesh.remove(oldTagMesh);
            tags.destroyTag(oldTagMesh);
          }
          for (let i = 0; i < tagMeshes.length; i++) {
            const tagMesh = tagMeshes[i];
            tagMesh.visible = false;
            tagMesh.initialVisible = false;
            assetsMesh.add(tagMesh);
          }

          walletState.loading = false;
          walletState.loggedIn = address !== null;
          walletState.page = 0;
          walletState.numTags = tagMeshes.length;
          walletCacheState.tagMeshes = tagMeshes;

          _alignAssetTagMeshes();
          _updatePages();
        };

        const grabStates = {
          left: false,
          right: false,
        };
        const _tabchange = tab => {
          if (tab === 'wallet') {
            keyboard.tryBlur();

            const {loaded} = walletCacheState;
            if (!loaded) {
              _updateWallet();

              walletCacheState.loaded = true;
            }
          }
        };
        rend.on('tabchange', _tabchange);

        const _trigger = e => {
          const {side} = e;
          const hoverState = rend.getHoverState(side);
          const {intersectionPoint} = hoverState;

          if (intersectionPoint) {
            const {anchor} = hoverState;
            const onclick = (anchor && anchor.onclick) || '';

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

                  _updatePages();
                }
              });
              keyboardFocusState.on('blur', () => {
                focusState.keyboardFocusState = null;

                _updatePages();
              });

              _updatePages();
            } else if (onclick === 'wallet:login') {
              _requestWallet({
                x: 'login',
              }, (err, result) => {
                if (!err) {
                  if (result) {
                    _updateWallet();
                  } else {
                    console.warn('login cancelled');
                  }
                } else {
                  console.warn(err);
                }
              });
            } else if (onclick === 'wallet:logout') {
              _requestWallet({
                x: 'logout',
              }, (err, result) => {
                if (!err) {
                  if (result) {
                    _updateStatus({
                      address: null,
                      tagMeshes: [],
                    });
                  } else {
                    console.warn('logout cancelled');
                  }
                } else {
                  console.warn(err);
                }
              });
            }
          }
        };
        input.on('trigger', _trigger, {
          priority: 1,
        });

        cleanups.push(() => {
          document.body.removeChild(walletIframe);

          rend.removeListener('tabchange', _tabchange);
          input.removeListener('trigger', _trigger);

          _removeBoxAnchor();
        });

        const _getAssetTagMeshes = () => walletCacheState.tagMeshes;

        return {
          getAssetTagMeshes: _getAssetTagMeshes,
        };
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _formatQueryString = o => {
  const result = [];
  for (const k in o) {
    result.push(encodeURIComponent(k) + '=' + encodeURIComponent(o[k]));
  }
  return result.join('&');
};

module.exports = Wallet;
