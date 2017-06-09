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
      '/core/engines/hand',
      '/core/engines/rend',
      '/core/engines/tags',
      '/core/engines/notification',
      '/core/utils/geometry-utils',
      '/core/utils/sprite-utils',
      '/core/utils/creature-utils',
    ]).then(([
      three,
      input,
      webvr,
      biolumi,
      keyboard,
      hand,
      rend,
      tags,
      notification,
      geometryUtils,
      spriteUtils,
      creatureUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;

        const walletRenderer = walletRender.makeRenderer({creatureUtils});

        const assetMaterial = new THREE.MeshBasicMaterial({
          color: 0xFFFFFF,
          shading: THREE.FlatShading,
          vertexColors: THREE.VertexColors,
        });
        const transparentMaterial = biolumi.getTransparentMaterial();

        const forwardVector = new THREE.Vector3(0, 0, -1);
        const forwardQuaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, -1),
          new THREE.Vector3(0, -1, 0)
        );

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
          error: false,
          inputText: '',
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
                src: walletRenderer.getWalletPageSrc({loading, error, inputText, inputValue, asset, assets, numTags, page, focus}),
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

        const itemsMesh = (() => {
          const object = new THREE.Object3D();

          const coreGeometry = geometryUtils.unindexBufferGeometry(
            new THREE.TetrahedronBufferGeometry(0.1, 1)
              .applyMatrix(new THREE.Matrix4().makeRotationZ(Math.PI * 3 / 12))
          );
          const numCoreGeometryVertices = coreGeometry.getAttribute('position').count;
          const coreMesh = (() => {
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(NUM_POSITIONS * 3); // XXX need to handle overflows
            const positionsAttribute = new THREE.BufferAttribute(positions, 3);
            geometry.addAttribute('position', positionsAttribute);
            const normals = new Float32Array(NUM_POSITIONS * 3);
            const normalsAttribute = new THREE.BufferAttribute(normals, 3);
            geometry.addAttribute('normal', normalsAttribute);
            const colors = new Float32Array(NUM_POSITIONS * 3);
            const colorsAttribute = new THREE.BufferAttribute(colors, 3);
            geometry.addAttribute('color', colorsAttribute);
            geometry.setDrawRange(0, 0);
            geometry.boundingSphere = new THREE.Sphere(
              new THREE.Vector3(0, 0, 0),
              1
            );

            const material = assetMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            mesh.frustumCulled = false;
            return mesh;
          })();
          object.add(coreMesh);

          const items = [];
          const _makeHoverState = () => ({
            item: null,
            notification: null,
          });
          const hoverStates = {
            left: _makeHoverState(),
            right: _makeHoverState(),
          };

          class Item {
            constructor(
              position,
              rotation,
              scale,
              asset,
              quantity,
              geometry,
              grabbable,
              startTime
            ) {
              this.position = position;
              this.rotation = rotation;
              this.scale = scale;
              this.asset = asset;
              this.quantity = quantity;
              this.geometry = geometry;
              this.grabbable = grabbable;
              this.startTime = startTime;

              this._grabbed = false;
            }

            getMatrix(now) {
              const {position, rotation, scale, startTime, _grabbed: grabbed} = this;
              const timeDiff = now - startTime;
              const newQuaternion = !grabbed ?
                new THREE.Quaternion().setFromEuler(new THREE.Euler(
                  0,
                  (rotation.y + (timeDiff / (Math.PI * 2) * 0.01)) % (Math.PI * 2),
                  0,
                  camera.rotation.order
                ))
              :
                rotation.clone().multiply(forwardQuaternion);
              const newPosition = !grabbed ? position : position.clone().add(new THREE.Vector3(0, 0, -0.02 / 2).applyQuaternion(newQuaternion));
              const hovered = SIDES.some(side => hoverStates[side].item === this);
              const newScale = hovered ? scale.clone().multiplyScalar(1.25) : scale;

              return new THREE.Matrix4().compose(
                newPosition,
                newQuaternion,
                newScale
              );
            }

            grab() {
              this._grabbed = true;
            }

            release() {
              this._grabbed = false;
            }

            update(position, rotation, scale) {
              this.position.copy(position);
              this.rotation.copy(rotation);
              this.scale.copy(scale);
            }
          }

          object.addItem = (position, rotation, scale, asset, quantity) => {
            const geometry = (() => {
              const canvas = creatureUtils.makeCanvasCreature(asset);
              const pixelSize = 0.02;
              const geometry = spriteUtils.makeImageGeometry(canvas, pixelSize);
              return geometry;
            })();
            const grabbable = (() => {
              const grabbable = hand.makeGrabbable();
              grabbable.setPosition(position);
              grabbable.on('grab', () => {
                item.grab();
              });
              grabbable.on('release', () => {
                item.release();

                const {hmd} = webvr.getStatus();
                const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmd;
                const externalMatrix = webvr.getExternalMatrix();
                const bodyPosition = hmdPosition.clone()
                  .add(
                    new THREE.Vector3(0, -0.4, 0)
                      .applyQuaternion(new THREE.Quaternion().setFromRotationMatrix(externalMatrix))
                  );
                if (item.position.distanceTo(bodyPosition) < 0.35) {
                  hand.destroyGrabbable(grabbable);
                  items.splice(items.indexOf(item), 1);
                }
              });
              grabbable.on('update', ({position, rotation, scale}) => {
                item.update(position, rotation, scale);
              });
              return grabbable;
            })();
            const startTime = Date.now();
            const item = new Item(position, rotation, scale, asset, quantity, geometry, grabbable, startTime);
            items.push(item);
          };
          let lastUpdateTime = Date.now();
          object.update = () => {
            const {gamepads} = webvr.getStatus();
            const now = Date.now();

            const _updateItems = () => {
              SIDES.forEach(side => {
                const gamepad = gamepads[side];
                const {worldPosition: controllerPosition} = gamepad;
                const hoverState = hoverStates[side];

                let closestItem = null;
                let closestItemIndex = -1;
                let closestItemDistance = Infinity;
                for (let i = 0; i < items.length; i++) {
                  const item = items[i];
                  const distance = controllerPosition.distanceTo(item.position);

                  if (closestItem === null || distance < closestItemDistance) {
                    closestItem = item;
                    closestItemIndex = i;
                    closestItemDistance = distance;
                  }
                }

                if (closestItemDistance < 0.2) {
                  hoverState.item = closestItem;

                  const {notification: oldNotification} = hoverState;
                  if (!oldNotification || oldNotification.item !== closestItem) {
                    if (oldNotification) {
                      notification.removeNotification(oldNotification);
                    }

                    const {asset, quantity} = closestItem;
                    const normalizedAssetName = _normalizeAssetName(asset);
                    const newNotification = notification.addNotification(`This is ${quantity} ${normalizedAssetName}.`);
                    newNotification.item = closestItem;

                    hoverState.notification = newNotification;
                  }
                } else {
                  const {item} = hoverState;

                  if (item) {
                    const {notification: oldNotification} = hoverState;
                    notification.removeNotification(oldNotification);

                    hoverState.item = null;
                    hoverState.notification = null;
                  }
                }
              });
            };
            const _updateCore = () => {
              const now = Date.now();

              const {geometry} = coreMesh;
              const positionsAttribute = geometry.getAttribute('position');
              const {array: positions} = positionsAttribute;
              const normalsAttribute = geometry.getAttribute('normal');
              const {array: normals} = normalsAttribute;
              const colorsAttribute = geometry.getAttribute('color');
              const {array: colors} = colorsAttribute;

              let index = 0;
              for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const {geometry: itemGeometry} = item;
                const matrix = item.getMatrix(now);

                const newGeometry = itemGeometry.clone()
                  .applyMatrix(matrix);
                const newPositions = newGeometry.getAttribute('position').array;
                const newNormals = newGeometry.getAttribute('normal').array;
                const newColors = newGeometry.getAttribute('color').array;
                const numVertices = newPositions.length / 3;

                positions.set(newPositions, index);
                normals.set(newNormals, index);
                colors.set(newColors, index);

                index += numVertices * 3;
              }

              positionsAttribute.needsUpdate = true;
              normalsAttribute.needsUpdate = true;
              colorsAttribute.needsUpdate = true;

              geometry.setDrawRange(0, index / 3);
            };

            _updateItems();
            _updateCore();

            lastUpdateTime = now;
          };

          return object;
        })();
        scene.add(itemsMesh);
        itemsMesh.updateMatrixWorld();

        const _updatePages = () => {
          const {planeMesh} = walletMesh;
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

        const _requestStatus = () => fetch(`${siteUrl}/id/api/status`, {
          credentials: 'include',
        })
          .then(res => {
            if (res.status >= 200 && res.status < 300) {
              return res.json();
            } else {
              return Promise.reject(new Error('invalid status code: ' + res.status));
            }
          });
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

              _updateStatus(null);

              next();
            });

          const {numTags} = walletState;
          walletState.loading = numTags === 0;

          _updatePages();
        });
        const _updateStatus = status => {
          if (status !== null) {
            const {address, assets: assetSpecs} = status;

            walletState.loading = false;
            walletState.page = 0;
            walletState.assets = assetSpecs;
            walletState.numTags = assetSpecs.length;

            _updatePages();
          } else {
            walletState.loading = false;
            walletState.error = true;

            _updatePages();
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

                  _updatePages();
                }
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

              itemsMesh.addItem(position, rotation, scale, asset, quantity);

              return true;
            } else if (onclick === 'wallet:manage') {
              console.log('manage account'); // XXX make this link to the vrid page

              return true;
            } else if (onclick === 'wallet:refresh') {
              _updateWallet();

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

            const {loaded} = walletState;
            if (!loaded) {
              _updateWallet();

              walletState.loaded = true;
            }
          }
        };
        rend.on('tabchange', _tabchange);

        const _update = () => {
          const _updateItems = () => {
            itemsMesh.update();
          };

          _updateItems();
        };
        rend.on('update', _update);

        cleanups.push(() => {
          scene.remove(itemsMesh);

          input.removeListener('trigger', _trigger);
          rend.removeListener('tabchange', _tabchange);
          rend.removeListener('update', _update);

          _removeBoxAnchor();
        });
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
const _normalizeAssetName = name => name === 'BTC' ? CREDIT_ASSET_NAME : name;

module.exports = Wallet;
