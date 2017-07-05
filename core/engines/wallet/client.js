import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/wallet';
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
      '/core/engines/keyboard',
      '/core/engines/hand',
      '/core/engines/rend',
      '/core/engines/tags',
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
      keyboard,
      hand,
      rend,
      tags,
      notification,
      jsUtils,
      creatureUtils,
      spriteUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;
        const {sfx} = assets;

        const transparentMaterial = biolumi.getTransparentMaterial();

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

          class AssetInstance {
            constructor(
              id,
              position,
              rotation,
              scale,
              asset,
              quantity,
              geometry
            ) {
              this.id = id;
              this.position = position;
              this.rotation = rotation;
              this.scale = scale;
              this.asset = asset;
              this.quantity = quantity;
              this.geometry = geometry;

              this._grabbed = false;
              this._visible = true;
            }

            getMatrix() {
              const {position, rotation, scale, _grabbed: grabbed} = this;
              const newQuaternion = !grabbed ? zeroQuaternion : rotation.clone().multiply(forwardQuaternion);
              const newPosition = !grabbed ? position : position.clone().add(new THREE.Vector3(0, 0, -0.02 / 2).applyQuaternion(newQuaternion));
              const hovered = SIDES.some(side => hoverStates[side].asset === this);
              const newScale = hovered ? scale.clone().multiplyScalar(1.25) : scale;

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

            isGrabbed() {
              return this._grabbed;
            }

            grab() {
              this._grabbed = true;

              geometryNeedsUpdate = true;
            }

            release() {
              this._grabbed = false;

              geometryNeedsUpdate = true;
            }

            setState(position, rotation, scale) {
              this.position.copy(position);
              this.rotation.copy(rotation);
              this.scale.copy(scale);

              const {geometry} = this;
              const positions = geometry.getAttribute('position').array;
              const numPositions = positions.length / 3;
              const dys = geometry.getAttribute('dy').array;
              for (let i = 0; i < numPositions; i++) {
                dys[(i * 2) + 0] = positions[(i * 3) + 0] * scale.x;
                dys[(i * 2) + 1] = positions[(i * 3) + 2] * scale.z;
              }

              geometryNeedsUpdate = true;
            }
          }

          const assetInstances = [];
          mesh.addAsset = (id, position, rotation, scale, asset, quantity) => {
            const geometry = (() => {
              const imageData = assets.getSpriteImageData('asset:' + asset);
              const pixelSize = 0.02;
              const geometry = spriteUtils.makeImageDataGeometry(imageData, pixelSize);
              const positions = geometry.getAttribute('position').array;
              const numPositions = positions.length / 3;
              const dys = new Float32Array(numPositions * 2);
              for (let i = 0; i < numPositions; i++) {
                dys[(i * 2) + 0] = positions[(i * 3) + 0] * scale.x;
                dys[(i * 2) + 1] = positions[(i * 3) + 2] * scale.z;
              }
              geometry.addAttribute('dy', new THREE.BufferAttribute(dys, 2));
              return geometry;
            })();
            const assetInstance = new AssetInstance(id, position, rotation, scale, asset, quantity, geometry);
            assetInstances.push(assetInstance);

            geometryNeedsUpdate = true;

            return assetInstance;
          };
          mesh.removeAsset = id => {
            assetInstances.splice(assetInstances.findIndex(assetInstance => assetInstance.id === id), 1);

            geometryNeedsUpdate = true;
          };

          let geometryNeedsUpdate = false;
          mesh.updateGeometry = () => {
            if (geometryNeedsUpdate) {
              const {geometry} = mesh;
              const positionsAttribute = geometry.getAttribute('position');
              const {array: positions} = positionsAttribute;
              const colorsAttribute = geometry.getAttribute('color');
              const {array: colors} = colorsAttribute;
              const dysAttribute = geometry.getAttribute('dy');
              const {array: dys} = dysAttribute;

              let attributeIndex = 0;
              for (let i = 0; i < assetInstances.length; i++) {
                const asset = assetInstances[i];

                if (asset.isVisible()) {
                  const {geometry: assetGeometry} = asset;
                  const matrix = asset.getMatrix();

                  const newGeometry = assetGeometry.clone()
                    .applyMatrix(matrix);
                  const newPositions = newGeometry.getAttribute('position').array;
                  positions.set(newPositions, attributeIndex);
                  const newColors = newGeometry.getAttribute('color').array;
                  colors.set(newColors, attributeIndex);
                  const geometryDys = newGeometry.getAttribute('dy').array;
                  const newDys = asset.isGrabbed() ? new Float32Array(geometryDys.length) : geometryDys;
                  dys.set(newDys, attributeIndex / 3 * 2);

                  attributeIndex += newPositions.length;
                }
              }

              positionsAttribute.needsUpdate = true;
              colorsAttribute.needsUpdate = true;
              dysAttribute.needsUpdate = true;

              geometry.setDrawRange(0, attributeIndex / 3);

              geometryNeedsUpdate = false;
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
                const asset = assetInstances[i];
                const distance = controllerPosition.distanceTo(asset.position);

                if (closestAsset === null || distance < closestAssetDistance) {
                  closestAsset = asset;
                  closestAssetIndex = i;
                  closestAssetDistance = distance;
                }
              }

              if (closestAssetDistance < 0.2) {
                hoverState.worldAsset = closestAsset;

                const {worldGrabNotification: oldWorldGrabNotification} = hoverState;
                if (!oldWorldGrabNotification || oldWorldGrabNotification.asset !== closestAsset) {
                  if (oldWorldGrabNotification) {
                    notification.removeNotification(oldWorldGrabNotification);
                  }

                  const {asset, quantity} = closestAsset;
                  const newWorldGrabNotification = notification.addNotification(`This is ${quantity} ${asset}.`);
                  newWorldGrabNotification.asset = closestAsset;

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

        /* const menuMesh = (() => {
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

          return object;
        })();
        rend.registerMenuMesh('walletMesh', menuMesh);
        menuMesh.updateMatrixWorld();

        rend.reindex();
        rend.updateMatrixWorld(menuMesh); */

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

            SIDES.forEach(side => {
              const gridMesh = gridMeshes[side];
              const {gridAssetsMesh} = gridMesh;
              gridAssetsMesh.updateAssets(assets);
            });
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
            _refreshAssets()
              .then(() => {
                walletState.loaded = true;
              })
              .catch(err => {
                console.warn(err);
              });
          }
        };
        _ensureLoaded();

        const _trigger = e => {
          /* const {side} = e;

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
          const _clickMenuBackground = () => {
            const hoverState = rend.getHoverState(side);
            const {target} = hoverState;

            if (target && target.mesh && target.mesh.parent === walletMesh) {
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
          } */
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
              const assetInstance = mesh.addAsset(
                'wallet:' + asset,
                new THREE.Vector3(
                  -gridWidth/2 + slotSize/2 + (x * (slotSize + slotSpacing)),
                  gridWidth/2 - slotSize/2 - (y * (slotSize + slotSpacing)),
                  0
                ),
                zeroQuaternion,
                oneVector.clone().multiplyScalar(0.6),
                asset,
                quantity
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
                bodyAsset.setState(bodyAsset.position, bodyAsset.rotation, oneVector.clone().multiplyScalar(0.6));
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

                assetInstance.setState(assetInstance.position, assetInstance.rotation, oneVector.clone().multiplyScalar(0.7));
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

        const slotGeometry = new THREE.BoxBufferGeometry(slotSize, slotPlatformHeight, slotSize);
        const numSlotPositions = slotGeometry.getAttribute('position').array.length / 3;
        const numSlotColors = numSlotPositions;
        const numSlotIndices = slotGeometry.index.array.length / 3;
        const lightSlotColor = new THREE.Color(0x2196F3);
        const darkSlotColor = lightSlotColor.clone().multiplyScalar(0.6);
        const whiteSlotColor = new THREE.Color(0xCCCCCC);
        const blackSlotColor = whiteSlotColor.clone().multiplyScalar(0.6);

        const dotSize = slotSize / 4;
        const dotGeometry = new THREE.BoxBufferGeometry(dotSize, dotSize, dotSize);
        const dotPositions = dotGeometry.getAttribute('position').array;
        const numDotPositions = dotPositions.length / 3;
        const numDotColors = numDotPositions;
        const numDotIndices = slotGeometry.index.array.length / 3;

        const _makeGridMesh = side => {
          const geometry = new THREE.BufferGeometry();
          const positions = new Float32Array(numSlotPositions * 3 * numSlots + numDotPositions * 3);
          const positionAttribute = new THREE.BufferAttribute(positions, 3);
          geometry.addAttribute('position', positionAttribute);
          const colors = new Float32Array(numSlotColors * 3 * numSlots + numDotColors * 3);
          const colorAttribute = new THREE.BufferAttribute(colors, 3);
          geometry.addAttribute('color', colorAttribute);
          const indices = new Uint16Array(numSlotIndices * 3 * numSlots + numDotIndices * 4);
          const indexAttribute = new THREE.BufferAttribute(indices, 1);
          geometry.setIndex(indexAttribute);

          const _render = (x, y) => {
            const dotPosition = new THREE.Vector2(x, y);
            const dotPositionSnap = _snapDotPosition(dotPosition);

            let attributeIndex = 0;
            let indexIndex = 0;

            for (let y = 0; y < slotsWidth; y++) {
              for (let x = 0; x < slotsWidth; x++) {
                const slotGeometryClone = slotGeometry.clone()
                  .applyMatrix(new THREE.Matrix4().makeTranslation(
                    -(gridWidth / 2) + (slotSize / 2) + (x * (slotSize + slotSpacing)),
                    (gridWidth / 2) - slotSize - (slotPlatformHeight / 2) - (y * (slotSize + slotSpacing)),
                    0
                  ));
                const slotClonePositions = slotGeometryClone.getAttribute('position').array;
                const slotCloneIndices = slotGeometryClone.index.array;
                positions.set(slotClonePositions, attributeIndex);
                for (let i = 0; i < numDotColors; i++) {
                  const baseIndex = i * 3;
                  const z = dotPositions[baseIndex + 2];
                  const color = (() => {
                    if (x === dotPositionSnap.x && y === dotPositionSnap.y) {
                      return z > 0 ? lightSlotColor : darkSlotColor;
                    } else {
                      return z > 0 ? whiteSlotColor : blackSlotColor;
                    }
                  })();

                  colors[attributeIndex + baseIndex + 0] = color.r;
                  colors[attributeIndex + baseIndex + 1] = color.g;
                  colors[attributeIndex + baseIndex + 2] = color.b;
                }
                _copyIndices(slotCloneIndices, indices, indexIndex, attributeIndex / 3);

                attributeIndex += slotClonePositions.length;
                indexIndex += slotCloneIndices.length;
              }
            }

            const dotCloneGeometry = dotGeometry.clone()
              .applyMatrix(new THREE.Matrix4().makeTranslation(
                dotPosition.x * gridWidth/2,
                dotPosition.y * gridWidth/2,
                0
              ));
            const dotClonePositions = dotCloneGeometry.getAttribute('position').array;
            positions.set(dotClonePositions, attributeIndex);
            for (let i = 0; i < numDotColors; i++) {
              const baseIndex = i * 3;
              const z = dotPositions[baseIndex + 2];
              const color = z > 0 ? lightSlotColor : darkSlotColor;

              colors[attributeIndex + baseIndex + 0] = color.r;
              colors[attributeIndex + baseIndex + 1] = color.g;
              colors[attributeIndex + baseIndex + 2] = color.b;
            }
            const dotCloneIndices = dotCloneGeometry.index.array;
            _copyIndices(dotCloneIndices, indices, indexIndex, attributeIndex / 3);
            attributeIndex += dotClonePositions.length;
            indexIndex += dotCloneIndices.length;

            positionAttribute.needsUpdate = true;
            colorAttribute.needsUpdate = true;
            // indexAttribute.needsUpdate = true;
          };
          _render(0, 0);

          const material = gridMaterial;

          const mesh = new THREE.Mesh(geometry, material);
          mesh.visible = false;

          const gridAssetsMesh = _makeGridAssetsMesh(side);
          mesh.add(gridAssetsMesh);
          mesh.gridAssetsMesh = gridAssetsMesh;

          mesh.updatePoint = (x, y) => {
            _render(x, y);

            gridAssetsMesh.updatePoint(x, y);
          };

          return mesh;
        };
        const gridMeshes = {
          left: _makeGridMesh('left'),
          right: _makeGridMesh('right'),
        };
        scene.add(gridMeshes.left);
        scene.add(gridMeshes.right);

        const _padtouchdown = e => {
          const {side} = e;
          const gridMesh = gridMeshes[side];
          const {hmd} = webvr.getStatus();
          const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmd;

          gridMesh.position.copy(hmdPosition.clone().add(forwardVector.clone().applyQuaternion(hmdRotation)));
          gridMesh.quaternion.copy(hmdRotation);
          gridMesh.updateMatrixWorld();

          if (!gridMesh.visible) {
            gridMesh.visible = true;
          }
        };
        input.on('padtouchdown', _padtouchdown, {
          priority: 1,
        });
        const _padtouchup = e => {
          const {side} = e;
          const gridMesh = gridMeshes[side];

          if (gridMesh.visible) {
            gridMesh.visible = false;
          }
        };
        input.on('padtouchup', _padtouchup, {
          priority: 1,
        });

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
          const _updateGrid = () => {
            const {gamepads} = webvr.getStatus();

            SIDES.forEach(side => {
              const gamepad = gamepads[side];
              const {axes: [x, y]} = gamepad;
              const gridMesh = gridMeshes[side];
              const {gridAssetsMesh} = gridMesh;

              gridMesh.updatePoint(x, y);
              gridAssetsMesh.updatePoint(x, y);
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
          _updateGrid();
          _updateAssets();
          _updateAssetsMaterial();
        };
        rend.on('update', _update);

        cleanups.push(() => {
          scene.remove(gridMeshes.left);
          scene.remove(gridMeshes.right);

          input.removeListener('trigger', _trigger);
          input.removeListener('padtouchdown', _padtouchdown);
          input.removeListener('padtouchup', _padtouchup);

          rend.removeListener('tabchange', _tabchange);
          rend.removeListener('update', _update);
        });

        class WalletApi extends EventEmitter {
          requestAssets() {
            return _ensureLoaded()
              .then(() => walletState.assets);
          }

          addAsset(item) {
            const {id, attributes} = item;
            const {
              position: {value: matrix},
              asset: {value: asset},
              quantity: {value: quantity},
            } = attributes;

            const position = new THREE.Vector3(matrix[0], matrix[1], matrix[2]);
            const rotation = new THREE.Quaternion(matrix[3], matrix[4], matrix[5], matrix[6]);
            const scale = new THREE.Vector3(matrix[7], matrix[8], matrix[9]);

            const assetInstance = assetsMesh.addAsset(id, position, rotation, scale, asset, quantity);

            const grabbable = hand.makeGrabbable(item.id);
            grabbable.setState(position.toArray(), [0, 0, 0, 1], [1, 1, 1]);
            grabbable.on('grab', e => {
              const {side} = e;
              const hoverState = hoverStates[side];

              assetInstance.grab();

              hoverState.worldGrabAsset = assetInstance;
            });
            grabbable.on('release', e => {
              const {side} = e;
              const hoverState = hoverStates[side];

              assetInstance.release();

              hoverState.worldGrabAsset = null;

              if (_isInBody(assetInstance.position)) {
                const _requestCreateSend = ({asset, quantity, srcAddress, dstAddress, privateKey}) => fetch(`${siteUrl}/id/api/send`, {
                  method: 'POST',
                  headers: (() => {
                    const headers = new Headers();
                    headers.append('Content-Type', 'application/json');
                    return headers;
                  })(),
                  body: JSON.stringify({
                    asset: asset,
                    quantity: quantity,
                    srcAddress: srcAddress,
                    dstAddress: dstAddress,
                    privateKey: privateKey,
                  }),
                  credentials: 'include',
                })
                  .then(_resJson);

                assetInstance.hide(); // for better UX

                const {
                  address: {value: address},
                  privateKey: {value: privateKey},
                } = attributes;
                const dstAddress = bootstrap.getAddress();
                _requestCreateSend({
                  asset: asset,
                  quantity: quantity,
                  srcAddress: address,
                  dstAddress: dstAddress,
                  privateKey: privateKey,
                })
                  .then(() => {
                    hand.destroyGrabbable(grabbable);

                    walletApi.emit('removeTag', item.id);
                  })
                  .catch(err => {
                    console.warn(err);

                    if (err.status === 402) { // insufficient funds, delete the asset since there's no way it's valid
                      hand.destroyGrabbable(grabbable);

                      walletApi.emit('removeTag', item.id);
                    } else { // failed to send, so re-show
                      assetInstance.show();
                    }
                  });
              }
            });
            grabbable.on('update', ({position, rotation, scale}) => {
              assetInstance.setState(
                new THREE.Vector3().fromArray(position),
                new THREE.Quaternion().fromArray(rotation),
                new THREE.Vector3().fromArray(scale)
              );
            });
          }

          removeAsset(item) {
            const {id} = item;
            assetsMesh.removeAsset(id);
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

module.exports = Wallet;
