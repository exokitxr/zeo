import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/wallet';
import walletRender from './lib/render/wallet';
import menuUtils from './lib/utils/menu';
// import vridApi from 'vrid/lib/frontend-api';

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
const ROTATE_SPEED = 0.0004;
const CREDIT_ASSET_NAME = 'CRD';

const ASSET_SHADER = {
  uniforms: {
    theta: {
      type: 'f',
      value: 0,
    },
  },
  vertexShader: [
    "uniform float theta;",
    "attribute vec3 color;",
    "attribute vec2 dy;",
    "varying vec3 vcolor;",
    `float rotateSpeed = ${ROTATE_SPEED.toFixed(8)};`,
    "void main() {",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x - dy.x + (dy.x*cos(theta) - dy.y*sin(theta)), position.y, position.z - dy.y + (dy.y*cos(theta) + dy.x*sin(theta)), 1.0);",
    "  vcolor = color;",
    "}"
  ].join("\n"),
  fragmentShader: [
    "varying vec3 vcolor;",
    "void main() {",
    "  gl_FragColor = vec4(vcolor, 1.0);",
    "}"
  ].join("\n")
};

const SIDES = ['left', 'right'];

class Wallet {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {site: {url: siteUrl}, vrid: {url: vridUrl}}} = archae;

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
      '/core/engines/assets',
      '/core/engines/cyborg',
      '/core/engines/keyboard',
      '/core/engines/hand',
      '/core/engines/rend',
      '/core/engines/tags',
      '/core/engines/multiplayer',
      '/core/engines/stck',
      '/core/engines/notification',
      '/core/utils/js-utils',
      '/core/utils/creature-utils',
      '/core/utils/sprite-utils',
    ]).then(([
      bootstrap,
      three,
      input,
      webvr,
      biolumi,
      assets,
      cyborg,
      keyboard,
      hand,
      rend,
      tags,
      multiplayer,
      stck,
      notification,
      jsUtils,
      creatureUtils,
      spriteUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;
        const {Grabbable} = hand;
        const {sfx} = assets;

        const walletRenderer = walletRender.makeRenderer({creatureUtils});

        const oneVector = new THREE.Vector3(1, 1, 1);
        const forwardVector = new THREE.Vector3(0, 0, -1);
        const zeroQuaternion = new THREE.Quaternion();
        const forwardQuaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, -1),
          new THREE.Vector3(0, -1, 0)
        );
        const assetsMaterial = new THREE.ShaderMaterial({
          uniforms: THREE.UniformsUtils.clone(ASSET_SHADER.uniforms),
          vertexShader: ASSET_SHADER.vertexShader,
          fragmentShader: ASSET_SHADER.fragmentShader,
          // transparent: true,
          // depthTest: false,
        });
        const gridMaterial = new THREE.MeshBasicMaterial({
          vertexColors: THREE.VertexColors,
        });
        const mainFontSpec = {
          fonts: biolumi.getFonts(),
          fontSize: 36,
          lineHeight: 1.4,
          fontWeight: biolumi.getFontWeight(),
          fontStyle: biolumi.getFontStyle(),
        };

        /* const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        }; */
        const _isInBody = p => {
          const {hmd} = webvr.getStatus();
          const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmd;
          const externalMatrix = webvr.getExternalMatrix();
          const bodyPosition = hmdPosition.clone()
            .add(
              new THREE.Vector3(0, -0.4, 0)
                .applyQuaternion(new THREE.Quaternion().setFromRotationMatrix(externalMatrix))
            );
          return p.distanceTo(bodyPosition) < 0.35;
        };
        const _snapDotPosition = p => new THREE.Vector2(
          Math.min(Math.floor(((p.x + 1) / 2) * slotsWidth), slotsWidth - 1),
          Math.min(Math.floor(((-p.y + 1) / 2) * slotsWidth), slotsWidth - 1)
        );
        const _copyIndices = (src, dst, startIndexIndex, startAttributeIndex) => {
          for (let i = 0; i < src.length; i++) {
            dst[startIndexIndex + i] = src[i] + startAttributeIndex;
          }
        };
        const _requestCreateCharge = ({srcAddress, dstAddress, srcAsset, srcQuantity}) => fetch(`${siteUrl}/id/api/charge`, {
          method: 'POST',
          headers: (() => {
            const headers = new Headers();
            headers.append('Content-Type', 'application/json');
            return headers;
          })(),
          body: JSON.stringify({
            srcAddress: srcAddress,
            dstAddress: dstAddress,
            srcAsset: srcAsset,
            srcQuantity: srcQuantity,
            dstAsset: null,
            dstQuantity: 0,
          }),
          credentials: 'include',
        })
          .then(_resJson);

        const _makeHoverState = () => ({
          worldAsset: null,
          worldGrabAsset: null,
          worldGrabNotification: null,
          worldReleaseNotification: null,
          bodyAsset: null,
          bodyNotification: null,
        });
        const hoverStates = {
          left: _makeHoverState(),
          right: _makeHoverState(),
        };

        const _makeAssetsMesh = () => {
          const mesh = (() => {
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(NUM_POSITIONS * 3);
            geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
            const colors = new Float32Array(NUM_POSITIONS * 3);
            geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
            const dys = new Float32Array(NUM_POSITIONS * 2);
            geometry.addAttribute('dy', new THREE.BufferAttribute(dys, 2));
            // geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(NUM_POSITIONS * 3), 1));
            geometry.setDrawRange(0, 0);
            geometry.boundingSphere = new THREE.Sphere(
              new THREE.Vector3(0, 0, 0),
              1
            );

            const material = assetsMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            mesh.frustumCulled = false;
            return mesh;
          })();

          class AssetInstance extends Grabbable {
            constructor(
              id,
              {
                position,
                rotation,
                scale,
                asset,
                quantity,
                owner,
              }
            ) {
              super(id, {position, rotation, scale});

              this.asset = asset;
              this.quantity = quantity;
              this.owner = owner;

              const geometry = (() => {
                const imageData = assets.getSpriteImageData('asset:' + asset);
                const pixelSize = 0.02;
                const geometry = spriteUtils.makeImageDataGeometry(imageData, pixelSize);
                const positions = geometry.getAttribute('position').array;
                const numPositions = positions.length / 3;
                const dys = new Float32Array(numPositions * 2);
                for (let i = 0; i < numPositions; i++) {
                  dys[(i * 2) + 0] = positions[(i * 3) + 0] * scale[0];
                  dys[(i * 2) + 1] = positions[(i * 3) + 2] * scale[2];
                }
                geometry.addAttribute('dy', new THREE.BufferAttribute(dys, 2));
                return geometry;
              })();
              this.geometry = geometry;

              this._visible = true;
            }

            emit(t, e) {
              switch (t) {
                case 'grab': {
                  const {userId, side} = e;
                  const hoverState = hoverStates[side];

                  hoverState.worldGrabAsset = this;

                  super.emit(t, {
                    userId,
                    side,
                    item: this,
                  });

                  assetsMesh.geometryNeedsUpdate = true;

                  break;
                }
                case 'release': {
                  const {userId, side} = e;
                  const hoverState = hoverStates[side];
                  const {id, position, owner} = this;

                  hoverState.worldGrabAsset = null;

                  if (_isInBody(new THREE.Vector3().fromArray(position))) {
                    const localAddress = bootstrap.getAddress();

                    if (owner === localAddress) {
                      walletApi.emit('removeTag', id);
                    } else {
                      this.hide(); // for better UX

                      this.requestChangeOwner(localAddress)
                        .then(() => {
                          walletApi.emit('removeTag', this.id);
                        })
                        .catch(err => {
                          console.warn(err);

                          this.show();
                        });
                    }
                  } else {
                    super.emit(t, {
                      userId,
                      side,
                      item: this,
                    });
                  }

                  assetsMesh.geometryNeedsUpdate = true;

                  break;
                }
                case 'update': {
                  super.emit(t, e);

                  assetsMesh.geometryNeedsUpdate = true;

                  break;
                }
                default: {
                  super.emit(t, e);
                }
              }
            }

            getMatrix() {
              const {position, rotation, scale} = this;
              const positionVector = new THREE.Vector3().fromArray(position);
              const rotationQuaternion = new THREE.Quaternion().fromArray(rotation);
              const scaleVector = new THREE.Vector3().fromArray(scale);
              const grabbed = this.isGrabbed();

              const newQuaternion = !grabbed ? zeroQuaternion : rotationQuaternion.clone().multiply(forwardQuaternion);
              const newPosition = !grabbed ? positionVector : positionVector.clone().add(new THREE.Vector3(0, 0, -0.02 / 2).applyQuaternion(newQuaternion));
              const hovered = SIDES.some(side => hoverStates[side].asset === this);
              const newScale = hovered ? scaleVector.clone().multiplyScalar(1.25) : scaleVector;

              return new THREE.Matrix4().compose(
                newPosition,
                newQuaternion,
                newScale
              );
            }

            isVisible() {
              return this._visible;
            }

            show() {
              this._visible = true;
            }

            hide() {
              this._visible = false;
            }

            setState(position, rotation, scale) {
              super.setState(position, rotation, scale);

              this.updateGeometry();
            }

            setStateLocal(position, rotation, scale) {
              super.setStateLocal(position, rotation, scale);

              this.updateGeometry();
            }

            updateGeometry() {
              const {position, rotation, scale, geometry} = this;

              const positions = geometry.getAttribute('position').array;
              const numPositions = positions.length / 3;
              const dys = geometry.getAttribute('dy').array;
              for (let i = 0; i < numPositions; i++) {
                dys[(i * 2) + 0] = positions[(i * 3) + 0] * scale[0];
                dys[(i * 2) + 1] = positions[(i * 3) + 2] * scale[2];
              }

              mesh.geometryNeedsUpdate = true;
            }

            requestChangeOwner(dstAddress) {
              const {asset: srcAsset, quantity: srcQuantity, owner: srcAddress} = this;

              return _requestCreateCharge({
                srcAddress: srcAddress,
                dstAddress: dstAddress,
                srcAsset: srcAsset,
                srcQuantity: srcQuantity,
              })
                .then(() => {})
                .catch(err => {
                  if (err.status === 402) { // insufficient funds, succeed anyway since there's no way it's valid
                    return Promise.resolve();
                  } else {
                    return Promise.reject(err);
                  }
                });
            }
          }

          const assetInstances = [];
          mesh.getAssetInstance = id => assetInstances.find(assetInstance => assetInstance.id === id);
          mesh.geometryNeedsUpdate = false;
          mesh.addAssetInstance = (id, {position, rotation, scale, asset, quantity, owner}) => {
            const assetInstance = new AssetInstance(id, {position, rotation, scale, asset, quantity, owner});
            hand.addGrabbable(assetInstance);
            assetInstances.push(assetInstance);

            mesh.geometryNeedsUpdate = true;

            return assetInstance;
          };
          mesh.removeAssetInstance = id => {
            const assetInstance = assetInstances.splice(assetInstances.findIndex(assetInstance => assetInstance.id === id), 1)[0];
            hand.destroyGrabbable(assetInstance);

            mesh.geometryNeedsUpdate = true;
          };
          mesh.updateGeometry = () => {
            if (mesh.geometryNeedsUpdate) {
              const {geometry} = mesh;
              const positionsAttribute = geometry.getAttribute('position');
              const {array: positions} = positionsAttribute;
              const colorsAttribute = geometry.getAttribute('color');
              const {array: colors} = colorsAttribute;
              const dysAttribute = geometry.getAttribute('dy');
              const {array: dys} = dysAttribute;

              let attributeIndex = 0;
              for (let i = 0; i < assetInstances.length; i++) {
                const assetInstance = assetInstances[i];

                if (assetInstance.isVisible()) {
                  const {geometry: assetGeometry} = assetInstance;
                  const matrix = assetInstance.getMatrix();

                  const newGeometry = assetGeometry.clone()
                    .applyMatrix(matrix);
                  const newPositions = newGeometry.getAttribute('position').array;
                  positions.set(newPositions, attributeIndex);
                  const newColors = newGeometry.getAttribute('color').array;
                  colors.set(newColors, attributeIndex);
                  const geometryDys = newGeometry.getAttribute('dy').array;
                  const newDys = assetInstance.isGrabbed() ? new Float32Array(geometryDys.length) : geometryDys;
                  dys.set(newDys, attributeIndex / 3 * 2);

                  attributeIndex += newPositions.length;
                }
              }

              positionsAttribute.needsUpdate = true;
              colorsAttribute.needsUpdate = true;
              dysAttribute.needsUpdate = true;

              geometry.setDrawRange(0, attributeIndex / 3);

              mesh.geometryNeedsUpdate = false;
            }
          };
          mesh.updateHovers = () => {
            const {gamepads} = webvr.getStatus();

            SIDES.forEach(side => {
              const gamepad = gamepads[side];
              const {worldPosition: controllerPosition} = gamepad;
              const hoverState = hoverStates[side];

              let closestAsset = null;
              let closestAssetIndex = -1;
              let closestAssetDistance = Infinity;
              for (let i = 0; i < assetInstances.length; i++) {
                const assetInstance = assetInstances[i];
                const distance = controllerPosition.distanceTo(new THREE.Vector3().fromArray(assetInstance.position));

                if (closestAsset === null || distance < closestAssetDistance) {
                  closestAsset = assetInstance;
                  closestAssetIndex = i;
                  closestAssetDistance = distance;
                }
              }

              if (closestAssetDistance < 0.2) {
                hoverState.worldAsset = closestAsset;

                const {worldGrabNotification: oldWorldGrabNotification} = hoverState;
                if (!oldWorldGrabNotification || oldWorldGrabNotification.assetInstance !== closestAsset) {
                  if (oldWorldGrabNotification) {
                    notification.removeNotification(oldWorldGrabNotification);
                  }

                  const {asset, quantity} = closestAsset;
                  const newWorldGrabNotification = notification.addNotification(`This is ${quantity} ${asset}.`);
                  newWorldGrabNotification.assetInstance = closestAsset;

                  hoverState.worldGrabNotification = newWorldGrabNotification;
                }
              } else {
                const {worldAsset} = hoverState;
                if (worldAsset) {
                  hoverState.worldAsset = null;
                }

                const {worldGrabNotification} = hoverState;
                if (worldGrabNotification) {
                  notification.removeNotification(worldGrabNotification);
                  hoverState.worldGrabNotification = null;
                }
              }
            });
          };

          return mesh;
        };
        const assetsMesh = _makeAssetsMesh();
        scene.add(assetsMesh);

        const walletState = {
          loaded: false,
          loading: true,
          error: false,
          inputText: '',
          // address: null,
          asset: null,
          assets: [],
          numTags: 0,
          page: 0,
          bill: null,
        };
        const focusState = {
          keyboardFocusState: null,
        };

        const menuMesh = (() => {
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
                bill,
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
                src: walletRenderer.getWalletPageSrc({loading, error, inputText, inputValue, asset, assets, numTags, page, bill, focus}),
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

            const {page} = mesh;
            rend.addPage(page);

            cleanups.push(() => {
              rend.removePage(page);
            });

            return mesh;
          })();
          object.add(planeMesh);
          object.planeMesh = planeMesh;

          return object;
        })();
        rend.registerMenuMesh('walletMesh', menuMesh);
        menuMesh.updateMatrixWorld();

        rend.reindex();
        rend.updateMatrixWorld(menuMesh);

        const _updatePages = () => {
          const {planeMesh} = menuMesh;
          const {page} = planeMesh;
          page.update();
        };
        _updatePages();

        const _resJson = res => {
          if (res.status >= 200 && res.status < 300) {
            return res.json();
          } else {
            return Promise.reject({
              status: res.status,
              stack: 'API returned invalid status code: ' + res.status,
            });
          }
        };
        const _requestAssets = () => fetch(`${vridUrl}/id/api/assets`, {
          credentials: 'include',
        })
          .then(_resJson);
        const _refreshAssets = () => _requestAssets()
          .then(assets => {
            walletState.page = 0;
            walletState.assets = assets;
            walletState.numTags = assets.length;
            walletState.asset = null;
            walletState.bill = null;

            _updatePages();
          })
          .catch(err => {
            walletState.error = true;

            return Promise.reject(err);
          });
        const _updateWallet = menuUtils.debounce(next => {
          /* const {inputText} = walletState;
          const searchText = inputText.toLowerCase(); */

          _refreshAssets()
            .then(() => {
              walletState.loading = false;

              next();
            })
            .catch(err => {
              console.warn(err);

              walletState.loading = false;

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

              walletState.bill = {
                asset,
                quantity,
              };
              _updatePages();

              /* const status = webvr.getStatus();
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
                }); */

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
          const _clickMenuBackground = () => {
            const hoverState = rend.getHoverState(side);
            const {target} = hoverState;

            if (target && target.mesh && target.mesh.parent === menuMesh) {
              return true;
            } else {
              return false;
            }
          };

          if (_clickMenu()) {
            sfx.digi_select.trigger();

            e.stopImmediatePropagation();
          } else if (_clickMenuBackground()) {
            sfx.digi_plink.trigger();

            e.stopImmediatePropagation();
          }
        };
        input.on('trigger', _trigger, {
          priority: 1,
        });

        const slotsWidth = 4;
        const numSlots = slotsWidth * slotsWidth;
        const slotSize = 0.2;
        const slotPlatformHeight = slotSize / 5;
        const slotSpacing = slotSize / 2;
        const gridWidth = (slotSize * slotsWidth) + (slotSpacing * (slotsWidth - 1));

        const _makeGridAssetsMesh = side => {
          const hoverState = hoverStates[side];

          const mesh = _makeAssetsMesh();

          const assetInstances = [];
          mesh.updateAssets = assets => {
            assetInstances.length = 0;

            for (let i = 0; i < assets.length; i++) {
              const {asset, quantity} = assets[i];
              const x = i % gridWidth;
              const y = Math.floor(i / gridWidth);
              const assetInstance = mesh.addAssetInstance(
                `wallet:${side}:${asset}`,
                {
                  position: [
                    -gridWidth/2 + slotSize/2 + (x * (slotSize + slotSpacing)),
                    gridWidth/2 - slotSize/2 - (y * (slotSize + slotSpacing)),
                    0
                  ],
                  rotation: zeroQuaternion.toArray(),
                  scale: oneVector.clone().multiplyScalar(0.6).toArray(),
                  asset,
                  quantity,
                  owner: null,
                }
              );
              assetInstances.push(assetInstance);
            }

            mesh.updateGeometry();
          };
          mesh.updatePoint = (x, y) => {
            const dotPosition = new THREE.Vector2(x, y);
            const dotPositionSnap = _snapDotPosition(dotPosition);

            const _clearBodyAsset = () => {
              const {bodyAsset} = hoverState;
              if (bodyAsset !== null) {
                bodyAsset.setState(bodyAsset.position, bodyAsset.rotation, oneVector.clone().multiplyScalar(0.6).toArray());
                hoverState.bodyAsset = null;
              }
            };
            const _clearBodyNotification = () => {
              const {bodyNotification} = hoverState;
              if (bodyNotification !== null) {
                notification.removeNotification(bodyNotification);
                hoverState.bodyNotification = null;
              }
            };

            const index = dotPositionSnap.x + (dotPositionSnap.y * slotsWidth);
            if (index < assetInstances.length) {
              const assetInstance = assetInstances[index];
              const {bodyAsset} = hoverState;

              if (bodyAsset !== assetInstance) {
                _clearBodyAsset();
                _clearBodyNotification();

                assetInstance.setState(assetInstance.position, assetInstance.rotation, oneVector.clone().multiplyScalar(0.7).toArray());
                hoverState.bodyAsset = assetInstance;
              }
            } else {
              _clearBodyAsset();
              _clearBodyNotification();
            }

            mesh.updateGeometry();
          };
          return mesh;
        };

        const _bindAssetInstancePhysics = (assetInstance, immediate) => {
          let body = null;
          const _addBody = ({velocity = [0, 0, 0]} = {}) => {
            const size = [0.1, 0.1, 0.1];
            body = stck.makeDynamicBoxBody(assetInstance.position, size, velocity);
            body.on('update', ({position, rotation, scale}) => {
              assetInstance.setStateLocal(position, rotation, scale);
            });
          };
          const _removeBody = () => {
            stck.destroyBody(body);
            body = null;
          };
          assetInstance.on('release', e => {
            const {side} = e;
            const player = cyborg.getPlayer();
            const linearVelocity = player.getControllerLinearVelocity(side);

            _addBody({
              velocity: linearVelocity.toArray(),
            });
          });
          assetInstance.on('grab', () => {
            _removeBody();
          });

          if (immediate) {
            _addBody();
          }
        };

        const _gripdown = e => {
          const {side} = e;
          const {gamepads} = webvr.getStatus();
          const gamepad = gamepads[side];
          const {worldPosition: position} = gamepad;
          const hoverState = hoverStates[side];
          const {worldGrabAsset, bodyAsset} = hoverState;

          if (_isInBody(position) && bodyAsset && !worldGrabAsset) {
            const {asset, quantity} = bodyAsset;
            const {worldRotation: rotation, worldScale: scale} = gamepad;

            const id = _makeId();
            const owner = bootstrap.getAddress();
            const itemSpec = {
              type: 'asset',
              id: id,
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
                owner: {
                  value: owner,
                },
              },
              metadata: {},
            };
            walletApi.emit('addAsset', itemSpec);

            const assetInstance = assetsMesh.getAssetInstance(id);
            assetInstance.grab(side);
            _bindAssetInstancePhysics(assetInstance, false);

            e.stopImmediatePropagation();
          }
        };
        input.on('gripdown', _gripdown, {
          priority: -1,
        });

        const _tabchange = tab => {
          if (tab === 'wallet') {
            _ensureInitialLoaded();
          }
        };
        rend.on('tabchange', _tabchange);

        const _update = () => {
          const _updateHover = () => {
            const {gamepads} = webvr.getStatus();

            SIDES.forEach(side => {
              const gamepad = gamepads[side];
              const {worldPosition: controllerPosition} = gamepad;
              const hoverState = hoverStates[side];
              const {worldGrabAsset, worldReleaseNotification, bodyAsset, bodyNotification} = hoverState;
              const isInBody = _isInBody(controllerPosition);

              if ((isInBody && worldGrabAsset) && !worldReleaseNotification) {
                const {asset, quantity} = worldGrabAsset;
                hoverState.worldReleaseNotification = notification.addNotification(`Release to store ${quantity} ${asset}.`);
              } else if (!(isInBody && worldGrabAsset) && worldReleaseNotification) {
                notification.removeNotification(worldReleaseNotification);
                hoverState.worldReleaseNotification = null;
              }

              if (isInBody && !bodyNotification) {
                if (bodyAsset !== null) {
                  const {asset, quantity} = bodyAsset;
                  hoverState.bodyNotification = notification.addNotification(`Grab to pull ${quantity} ${asset}.`);
                }
              } else if (!isInBody && bodyNotification) {
                notification.removeNotification(bodyNotification);
                hoverState.bodyNotification = null;
              }
            });
          };
          const _updateAssets = () => {
            assetsMesh.updateGeometry();
            assetsMesh.updateHovers();
          };
          const _updateAssetsMaterial = () => {
            assetsMaterial.uniforms.theta.value = (Date.now() * ROTATE_SPEED * (Math.PI * 2) % (Math.PI * 2));
          };

          _updateHover();
          _updateAssets();
          _updateAssetsMaterial();
        };
        rend.on('update', _update);

        cleanups.push(() => {

          input.removeListener('trigger', _trigger);
          input.removeListener('gripdown', _gripdown);

          rend.removeListener('tabchange', _tabchange);
          rend.removeListener('update', _update);
        });

        class WalletApi extends EventEmitter {
          requestAssets() {
            return _ensureLoaded()
              .then(() => walletState.assets);
          }

          getAsset(id) {
            return assetsMesh.getAssetInstance(id);
          }

          addAsset(item) {
            const {id, attributes} = item;
            const {
              position: {value: matrix},
              asset: {value: asset},
              quantity: {value: quantity},
              owner: {value: owner},
            } = attributes;

            const position = new THREE.Vector3(matrix[0], matrix[1], matrix[2]);
            const rotation = new THREE.Quaternion(matrix[3], matrix[4], matrix[5], matrix[6]);
            const scale = new THREE.Vector3(matrix[7], matrix[8], matrix[9]);

            const assetInstance = assetsMesh.addAssetInstance(
              id,
              {
                position: position.toArray(),
                rotation: rotation.toArray(),
                scale: scale.toArray(),
                asset,
                quantity,
                owner
              }
            );
            _bindAssetInstancePhysics(assetInstance, true);
          }

          removeAsset(item) {
            const {id} = item;
            assetsMesh.removeAssetInstance(id);
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
/* const _arrayToBase64 = array => {
  let binary = '';
  for (let i = 0; i < array.byteLength; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary);
}; */

module.exports = Wallet;
