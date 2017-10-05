import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/wallet';
import walletRender from './lib/render/wallet';
import menuUtils from './lib/utils/menu';

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
      '/core/engines/fs',
      '/core/engines/webvr',
      '/core/engines/biolumi',
      '/core/engines/resource',
      '/core/engines/cyborg',
      '/core/engines/keyboard',
      '/core/engines/hand',
      '/core/engines/rend',
      '/core/engines/tags',
      '/core/engines/multiplayer',
      '/core/engines/stck',
      '/core/engines/notification',
      '/core/utils/js-utils',
      '/core/utils/hash-utils',
      '/core/utils/network-utils',
      '/core/utils/creature-utils',
      '/core/utils/sprite-utils',
      '/core/utils/strg-utils',
      '/core/utils/vrid-utils',
    ]).then(([
      bootstrap,
      three,
      input,
      fs,
      webvr,
      biolumi,
      resource,
      cyborg,
      keyboard,
      hand,
      rend,
      tags,
      multiplayer,
      stck,
      notification,
      jsUtils,
      hashUtils,
      networkUtils,
      creatureUtils,
      spriteUtils,
      strgUtils,
      vridUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;
        const {murmur} = hashUtils;
        const {AutoWs} = networkUtils;
        const {Grabbable} = hand;
        const {sfx} = resource;
        const {strgApi} = strgUtils;

        const walletRenderer = walletRender.makeRenderer({creatureUtils});
        const localUserId = multiplayer.getId();

        const pixelSize = 0.015;
        const numPixels = 12;
        const assetSize = pixelSize * numPixels;
        const assetSizeVector = new THREE.Vector3(assetSize, assetSize, assetSize);

        const zeroArray = new Float32Array(0);
        const zeroArray2 = new Float32Array(0);
        const zeroVector = new THREE.Vector3();
        const oneVector = new THREE.Vector3(1, 1, 1);
        const assetOffsetVector = new THREE.Vector3(0, 0, -pixelSize/2);
        const zeroQuaternion = new THREE.Quaternion();
        const forwardQuaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, 0, -1)
        );
        const assetsMaterial = new THREE.ShaderMaterial({
          uniforms: THREE.UniformsUtils.clone(ASSET_SHADER.uniforms),
          vertexShader: ASSET_SHADER.vertexShader,
          fragmentShader: ASSET_SHADER.fragmentShader,
          // transparent: true,
          // depthTest: false,
        });

        const _addStrgAsset = (asset, quantity) => strgApi.get('assets')
          .then(assets => {
            assets = assets || [];
            let assetSpec = assets.find(assetSpec => assetSpec.asset === asset);
            if (!assetSpec) {
              assetSpec = {
                id: asset,
                asset,
                quantity: 0,
              };
              assets.push(assetSpec);
            }
            assetSpec.quantity += quantity;

            return strgApi.set('assets', assets);
          });
        const _removeStrgAsset = (asset, quantity) => strgApi.get('assets')
          .then(assets => {
            assets = assets || [];
            const assetSpecIndex = assets.findIndex(assetSpec => assetSpec.asset === asset);
            if (assetSpecIndex !== -1) {
              const assetSpec = assets[assetSpecIndex];
              assetSpec.quantity--;
              if (assetSpec.quantity === 0) {
                assets.splice(assetSpecIndex, 1);
              }
            }
            return strgApi.set('assets', assets);
          });

        const _addAsset = (id, type, value, n, physics, matrix) => {
          const position = new THREE.Vector3(matrix[0], matrix[1], matrix[2]);
          const rotation = new THREE.Quaternion(matrix[3], matrix[4], matrix[5], matrix[6]);
          const scale = new THREE.Vector3(matrix[7], matrix[8], matrix[9]);

          const assetInstance = assetsMesh.addAssetInstance(
            id,
            type,
            value,
            n,
            physics,
            position,
            rotation,
            scale,
            zeroVector,
            zeroQuaternion,
            oneVector
          );
          _bindAssetInstance(assetInstance);
          _bindAssetInstancePhysics(assetInstance);
        };

        const connection = new AutoWs(_relativeWsUrl('archae/walletWs'));
        connection.on('message', e => {
          const {data} = e;
          const m = JSON.parse(data);
          const {type, args} = m;

          if (type === 'init') {
            const {assets} = args;
            for (let i = 0; i < assets.length; i++) {
              const assetSpec = assets[i];
              const {
                id,
                type,
                value,
                n,
                physics,
                matrix,
              } = assetSpec;

              _addAsset(id, type, value, n, physics, matrix);
            }
          } else if (type === 'addAsset') {
            const {
              id,
              type,
              value,
              n,
              physics,
              matrix,
            } = args;

            _addAsset(id, type, value, n, physics, matrix);
          } else if (type === 'removeAsset') {
            const {
              id,
            } = args;

            const assetInstance = assetsMesh.getAssetInstance(id);
            _unbindAssetInstance(assetInstance);

            assetsMesh.removeAssetInstance(id);
          } else if (type === 'setPhysics') {
            const {
              id,
              physics,
            } = args;

            const assetInstance = assetsMesh.getAssetInstance(id);
            assetInstance.updatePhysics(physics);
          } else {
            console.warn('wallet got unknown message type:', JSON.stringify(type));
          }
        });

        const _isInBody = p => {
          const vrMode = bootstrap.getVrMode();

          if (vrMode === 'hmd') {
            const {hmd} = webvr.getStatus();
            const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmd;
            const hmdEuler = new THREE.Euler().setFromQuaternion(hmdRotation, camera.rotation.order);
            hmdEuler.z = 0;
            const hmdQuaternion = new THREE.Quaternion().setFromEuler(hmdEuler);
            const bodyPosition = hmdPosition.clone()
              .add(
                new THREE.Vector3(0, -0.5, 0)
                  .applyQuaternion(hmdQuaternion)
              );
            return p.distanceTo(bodyPosition) < 0.35;
          } else if (vrMode === 'keyboard') {
            const {hmd: {worldPosition, worldRotation}} = webvr.getStatus();
            const hmdEuler = new THREE.Euler().setFromQuaternion(worldRotation, camera.rotation.order);
            hmdEuler.x = 0;
            hmdEuler.z = 0;
            const hmdQuaternion = new THREE.Quaternion().setFromEuler(hmdEuler);
            const bodyPosition = worldPosition.clone()
              .add(
                new THREE.Vector3(0, -0.4, 0.2)
                  .applyQuaternion(hmdQuaternion)
              );
            return p.distanceTo(bodyPosition) < 0.35;
          }
        };

        const _makeHoverState = () => ({
          worldAsset: null,
          worldGrabAsset: null,
        });
        const hoverStates = {
          left: _makeHoverState(),
          right: _makeHoverState(),
        };

        const _makeAssetsMesh = () => {
          const mesh = new THREE.Object3D();

          class AssetInstance extends Grabbable {
            constructor(
              id,
              type,
              value,
              n,
              physics,
              position,
              rotation,
              scale,
              localPosition,
              localRotation,
              localScale
            ) {
              super(n, position, rotation, scale, localPosition, localRotation, localScale);

              this.id = id;
              this.type = type;
              this.value = value;
              this.physics = physics;
            }

            emit(t, e) {
              switch (t) {
                case 'grab': {
                  const {userId, side} = e;

                  hoverStates[side].worldGrabAsset = this;

                  super.emit(t, {
                    userId,
                    side,
                    item: this,
                  });

                  assetsMesh.geometryNeedsUpdate = true;

                  break;
                }
                case 'release': {
                  const {userId, side, live, stopImmediatePropagation} = e;

                  hoverStates[side].worldGrabAsset = null;

                  const e2 = {
                    userId,
                    side,
                    item: this,
                    live,
                    stopImmediatePropagation,
                  };
                  super.emit(t, e2);

                  if (e2.live) {
                    _checkGripup(e2);
                  }

                  break;
                }
                case 'update': {
                  super.emit(t, e);

                  break;
                }
                case 'destroy': {
                  const {userId, side} = e;
                  if (userId) {
                    hoverStates[side].worldGrabAsset = null;
                  }

                  super.emit(t, {
                    userId,
                    side,
                    item: this,
                  });

                  break;
                }
                default: {
                  super.emit(t, e);

                  break;
                }
              }
            }

            show() {
              this.emit('show');
            }

            hide() {
              this.emit('hide');
            }

            enablePhysics() {
              this.physics = true;
              this.emit('physics', true);

              connection.send(JSON.stringify({
                method: 'setPhysics',
                args: {
                  id: this.id,
                  physics: true,
                },
              }));
            }

            disablePhysics() {
              this.physics = false;
              this.emit('physics', false);

              connection.send(JSON.stringify({
                method: 'setPhysics',
                args: {
                  id: this.id,
                  physics: false,
                },
              }));
            }

            updatePhysics(physics) {
              this.physics = physics;
              this.emit('physics', physics);
            }

            collide() {
              this.emit('collide');
            }
          }

          const assetInstances = [];
          mesh.getAssetInstances = id => assetInstances;
          mesh.getAssetInstance = id => assetInstances.find(assetInstance => assetInstance.id === id);
          mesh.addAssetInstance = (id, type, value, n, physics, position, rotation, scale, localPosition, localRotation, localScale) => {
            const assetInstance = new AssetInstance(id, type, value, n, physics, position, rotation, scale, localPosition, localRotation, localScale);
            hand.addGrabbable(assetInstance);
            assetInstances.push(assetInstance);

            const mesh = (() => {
              let live = true;

              const geometry = (() => {
                const spriteName = type === 'asset' ? value : 'FIL';
                const imageData = resource.getSpriteImageData(spriteName);

                spriteUtils.requestSpriteGeometry(imageData, pixelSize)
                  .then(geometrySpec => {
                    if (live) {
                      const {positions, normals, colors, dys, zeroDys} = geometrySpec;

                      geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
                      // geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
                      geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
                      geometry.addAttribute('dy', new THREE.BufferAttribute(geometry.getAttribute('dy').array === geometry.dys ? dys : zeroDys, 2));

                      geometry.dys = dys;
                      geometry.zeroDys = zeroDys;

                      geometry.destroy = function() {
                        this.dispose();
                        spriteUtils.releaseSpriteGeometry(geometrySpec);
                      };
                    }
                  })
                  .catch(err => {
                    if (live) {
                      console.warn(err);
                    }
                  });

                const geometry = new THREE.BufferGeometry();
                const dys = zeroArray; // two of these so we can tell which is active
                const zeroDys = zeroArray2;
                geometry.addAttribute('dy', new THREE.BufferAttribute(dys, 2));
                geometry.dys = dys;
                geometry.zeroDys = zeroDys;
                geometry.boundingSphere = new THREE.Sphere(
                  zeroVector,
                  1
                );
                geometry.destroy = function() {
                  this.dispose();
                };
                return geometry;
              })();
              const material = assetsMaterial;
              const mesh = new THREE.Mesh(geometry, material);

              mesh.destroy = () => {
                geometry.destroy();

                live = false;
              };

              return mesh;
            })();
            scene.add(mesh);
            assetInstance.mesh = mesh;

            assetInstance.on('grab', () => {
              const {geometry} = mesh;
              const dyAttribute = geometry.getAttribute('dy');
              dyAttribute.array = geometry.zeroDys;
              dyAttribute.needsUpdate = true;
            });
            assetInstance.on('release', () => {
              const {geometry} = mesh;
              const dyAttribute = geometry.getAttribute('dy');
              dyAttribute.array = geometry.dys;
              dyAttribute.needsUpdate = true;
            });
            const localVector = new THREE.Vector3();
            const localQuaternion = new THREE.Quaternion();
            assetInstance.on('update', () => {
              const {position, rotation, scale, localPosition, localRotation, localScale} = assetInstance;

              mesh.position.copy(position);

              localQuaternion.copy(rotation);
              if (assetInstance.isGrabbed()) {
                localQuaternion.multiply(forwardQuaternion);
              }
              mesh.quaternion.copy(localQuaternion)
                .multiply(localRotation);

              mesh.scale.copy(scale)
                .multiply(localScale);

              if (assetInstance.isGrabbed()) {
                mesh.position
                  .add(
                    localVector.copy(localPosition)
                      .add(assetOffsetVector)
                      .applyQuaternion(localQuaternion)
                  );
                // mesh.scale.multiplyScalar(0.5);
              }

              mesh.updateMatrixWorld();
            });
            assetInstance.on('show', () => {
              mesh.visible = true;
            });
            assetInstance.on('hide', () => {
              mesh.visible = false;
            });

            return assetInstance;
          };
          mesh.removeAssetInstance = id => {
            const assetInstance = assetInstances.splice(assetInstances.findIndex(assetInstance => assetInstance.id === id), 1)[0];
            hand.destroyGrabbable(assetInstance);

            const {mesh} = assetInstance;
            scene.remove(mesh);
            mesh.destroy();
          };

          return mesh;
        };
        const assetsMesh = _makeAssetsMesh();
        scene.add(assetsMesh);

        const walletState = {
          loading: true,
          error: false,
          inputText: '',
          // address: null,
          asset: null,
          assets: [],
          equipments: (() => {
            const numEquipments = 4;
            const result = _makeArray(numEquipments);
            for (let i = 0; i < numEquipments; i++) {
              result[i] = {
                id: `equipment:${i}`,
                asset: null,
              };
            }
            return result;
          })(),
          numTags: 0,
          page: 0,
        };
        const focusState = {
          keyboardFocusState: null,
        };

        const menuMesh = (() => {
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
              equipments,
              numTags,
              page,
            },
            focus: {
              keyboardFocusState,
            },
          }) => {
            const {type = '', inputValue = 0} = keyboardFocusState || {};
            const focus = type === 'wallet:search';

            return {
              type: 'html',
              src: walletRenderer.getWalletPageSrc({loading, error, inputText, inputValue, asset, assets, equipments, numTags, page, focus}),
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
          mesh.visible = false;

          const {page} = mesh;
          rend.addPage(page);

          cleanups.push(() => {
            rend.removePage(page);
          });

          return mesh;
        })();
        rend.registerMenuMesh('walletMesh', menuMesh);
        menuMesh.updateMatrixWorld();

        const _updatePages = () => {
          const {page} = menuMesh;
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
        const _resBlob = res => {
          if (res.status >= 200 && res.status < 300) {
            return res.blob();
          } else {
            return Promise.reject({
              status: res.status,
              stack: 'API returned invalid status code: ' + res.status,
            });
          }
        };
        /* const _requestAssets = () => fetch(`${vridUrl}/id/api/assets`, {
          credentials: 'include',
        })
          .then(_resJson);
        const _requestEquipments = () => fetch(`${vridUrl}/id/api/cookie/equipment`, {
          credentials: 'include',
        })
          .then(_resJson)
          .then(equipments => equipments !== null ? equipments : _makeArray(4)); */
        const _requestAssets = () => strgApi.get('assets')
          .then(assets => assets || []);
        const _requestEquipments = () => strgApi.get('equipments')
          .then(equipments => equipments || _makeArray(4))
          .then(equipments => equipments.map((asset, i) => ({id: `equipment:${i}`, asset: asset})));
        const _refreshAssets = () => Promise.all([
          _requestAssets(),
          _requestEquipments(),
        ])
          .then(([
            assets,
            equipments,
          ]) => {
            const {equipments: oldEquipments} = walletState;

            walletState.page = 0;
            walletState.asset = null;
            walletState.assets = assets.map(({asset, quantity}) => ({
              id: asset,
              asset: asset,
              quantity: quantity,
            }));
            const newEquipments = equipments.filter(equipmentSpec =>
              equipmentSpec.asset === null || walletState.assets.some(assetSpec => assetSpec.asset === equipmentSpec.asset)
            );
            walletState.equipments = newEquipments;
            walletState.numTags = assets.length;

            _rebindEquipments(oldEquipments, newEquipments);

            _updatePages();
          })
          .catch(err => {
            console.warn(err);

            walletState.error = true;
          });
        const _updateWallet = menuUtils.debounce(next => {
          /* const {inputText} = walletState;
          const searchText = inputText.toLowerCase(); */

          _refreshAssets()
            .then(() => {
              walletState.loading = false;

              next();
            });

          const {numTags} = walletState;
          walletState.loading = numTags === 0;
        });
        const _ensureInitialLoaded = () => {
          walletState.loading = true;
          _updatePages();

          return _refreshAssets()
            .then(() => {
              walletState.loading = false;

              _updatePages();
            });
        };
        _ensureInitialLoaded();

        const _saveEquipments = _debounce(next => {
          const equipments = walletState.equipments.map(({asset}) => asset);

          /* fetch(`${vridUrl}/id/api/cookie/equipment`, {
            method: 'POST',
            headers: (() => {
              const headers = new Headers();
              headers.set('Content-Type', 'application/json');
              return headers;
            })(),
            body: JSON.stringify(equipments),
            credentials: 'include',
          })
            .then(_resBlob); */

          strgApi.set('equipments', equipments)
            .then(() => {
              next();
            })
            .catch(err => {
              console.warn(err);

              next();
            });
        });
        const _trigger = e => {
          const {side} = e;

          const _downloadFile = () => {
            return false;
            const grabbedGrabbable = hand.getGrabbedGrabbable(side);

            if (grabbedGrabbable && grabbedGrabbable.type === 'file') {
              fs.makeRemoteFile(grabbedGrabbable.value).download();
              return  true;
            } else {
              return false;
            }
          };
          const _clickMenu = () => {
            const hoverState = rend.getHoverState(side);
            const {anchor} = hoverState;
            const onclick = (anchor && anchor.onclick) || '';

            let match;
            if (onclick === 'wallet:focus') {
              const {inputText} = walletState;
              const {value, target: page} = hoverState;
              const {layer: {measures}} = page;
              const valuePx = value * (WIDTH - 250);
              const {index, px} = biolumi.getTextPropertiesFromCoord(measures['wallet:search'], inputText, valuePx);
              const {hmd: hmdStatus} = webvr.getStatus();
              const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmdStatus;
              const keyboardFocusState = keyboard.focus({
                type: 'wallet:search',
                position: hmdPosition,
                rotation: hmdRotation,
                inputText: inputText,
                inputIndex: index,
                inputValue: px,
                page: page,
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
              const asset = match[1];

              walletState.asset = walletState.asset !== asset ? asset : null;

              _updatePages();

              return true;
            } else if (match = onclick.match(/^asset:equip:(.+)$/)) {
              const asset = match[1];

              const {equipments: oldEquipments} = walletState;
              const index = (() => {
                for (let i = 0; i < oldEquipments.length; i++) {
                  const oldEquipment = oldEquipments[i];
                  if (oldEquipment.asset === null) {
                    return i;
                  }
                }
                return oldEquipments.length - 1;
              })();
              const newEquipments = _clone(oldEquipments);
              newEquipments[index].asset = asset;

              _rebindEquipments(oldEquipments, newEquipments);

              walletState.equipments = newEquipments;
              _saveEquipments();
              _updatePages();

              return true;
            } else if (match = onclick.match(/^asset:unequip:equipment:([0-9]+)$/)) {
              const index = parseInt(match[1], 10);

              const {equipments: oldEquipments} = walletState;
              const newEquipments = _clone(oldEquipments);
              newEquipments[index].asset = null;

              _rebindEquipments(oldEquipments, newEquipments);

              walletState.equipments = newEquipments;
              _saveEquipments();
              _updatePages();

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

          if (_downloadFile()) {
            // nothing
          } else {
            if (_clickMenu()) {
              sfx.digi_select.trigger();

              e.stopImmediatePropagation();
            } else if (_clickMenuBackground()) {
              sfx.digi_plink.trigger();

              e.stopImmediatePropagation();
            }
          }
        };
        input.on('trigger', _trigger, {
          priority: 1,
        });

        const _bindAssetInstancePhysics = assetInstance => {
          let body = null;
          const _addBody = ({velocity = new THREE.Vector3()} = {}) => {
            body = stck.makeDynamicBoxBody(assetInstance.position, assetSizeVector, velocity);
            body.on('update', () => {
              assetInstance.setStateLocal(body.position, body.rotation, body.scale);
            });
            body.on('collide', () => {
              assetInstance.collide();
            });
          };
          const _removeBody = () => {
            stck.destroyBody(body);
            body = null;
          };

          assetInstance.on('release', e => {
            const {userId} = e;

            if (userId === localUserId) {
              const {side} = e;
              const player = cyborg.getPlayer();
              const linearVelocity = player.getControllerLinearVelocity(side);

              _addBody({
                velocity: linearVelocity,
              });

              assetInstance.enablePhysics();
            }
          });
          assetInstance.on('grab', e => {
            const {userId} = e;
            if (userId === localUserId) {
              assetInstance.disablePhysics();
            }
          });
          assetInstance.on('physics', enabled => {
            if (enabled && !body) {
              _addBody();
            } else if (!enabled && body) {
              _removeBody();
            }
          });
          assetInstance.on('destroy', () => {
            if (body) {
              _removeBody();
            }
          });

          if (assetInstance.physics) {
            _addBody();
          }
        };

        const _pullItem = (asset, side) => {
          const id = _makeId();
          // const owner = bootstrap.getAddress();
          const itemSpec = {
            type: 'asset',
            id: id,
            name: asset,
            displayName: asset,
            attributes: {
              type: {value: 'asset'},
              value: {value: asset},
              position: {value: DEFAULT_MATRIX},
              // owner: {value: owner},
              owner: {value: null},
              bindOwner: {value: null},
              physics: {value: false},
            },
            metadata: {},
          };
          const assetInstance = walletApi.makeItem(itemSpec);
          assetInstance.grab(side);

          const address = bootstrap.getAddress();
          const quantity = 1;
          const {assets: oldAssets} = walletState;
          _removeStrgAsset(asset, quantity)
            .then(() => {
              const {assets: newAssets} = walletState;

              if (oldAssets === newAssets) {
                const newAsset = newAssets.find(assetSpec => assetSpec.asset === asset);
                if (newAsset) {
                  if (--newAsset.quantity === 0) {
                    newAssets.splice(newAssets.indexOf(newAsset), 1);

                    const {equipments} = walletState;
                    const removedEquipments = equipments.filter(equipmentSpec => equipmentSpec.asset === asset);
                    if (removedEquipments.length > 0) {
                      for (let i = 0; i < equipments.length; i++) {
                        const equipment = equipments[i];
                        if (removedEquipments.includes(equipment)) {
                          equipment.asset = null;
                        }
                      }

                      _saveEquipments();
                    }
                  }

                  _updatePages();
                }
              }
            })
            .catch(err => {
              console.warn(err);
            });

          sfx.drop.trigger();
          const newNotification = notification.addNotification(`Pulled out ${asset}.`);
          setTimeout(() => {
            notification.removeNotification(newNotification);
          }, 3000);
        };
        const _storeItem = assetInstance => {
          walletApi.destroyItem(assetInstance);

          const {type} = assetInstance;
          if (type === 'asset') {
            const {value} = assetInstance;
            const address = bootstrap.getAddress();
            const quantity = 1;
            const {assets: oldAssets} = walletState;
            _addStrgAsset(value, quantity)
              .then(() => {
                const {assets: newAssets} = walletState;

                if (oldAssets === newAssets) {
                  let newAsset = newAssets.find(assetSpec => assetSpec.asset === value);
                  if (!newAsset) {
                    newAsset = {
                      id: value,
                      asset: value,
                      quantity: 0,
                    };
                    newAssets.push(newAsset);
                  }
                  newAsset.quantity++;

                  _updatePages();
                }
              })
              .catch(err => {
                console.warn(err);
              });

            sfx.drop.trigger();
            const newNotification = notification.addNotification(`Stored ${value}.`);
            setTimeout(() => {
              notification.removeNotification(newNotification);
            }, 3000);
          }
        };
        const _checkGripdown = side => {
          const hoverState = hoverStates[side];
          const {worldGrabAsset} = hoverState;
          const {asset} = walletState;
          const {gamepads} = webvr.getStatus();
          const gamepad = gamepads[side];
          const {worldPosition: position} = gamepad;

          if (!worldGrabAsset && asset && _isInBody(position)) {
            _pullItem(asset, side);

            return true;
          } else {
            return false;
          }
        };
        const _checkGripup = e => {
          const {item} = e;
          const {position} = item;

          if (_isInBody(position)) {
            _storeItem(item);

            e.stopImmediatePropagation();
          }
        };
        const _gripdown = e => {
          const {side} = e;
          if (_checkGripdown(side)) {
            e.stopImmediatePropagation();
          }
        };
        input.on('gripdown', _gripdown, {
          priority: -2,
        });

        const _upload = ({file, dropMatrix}) => {
          const id = String(file.n);
          const itemSpec = {
            type: 'file',
            id: id,
            name: id,
            displayName: id,
            attributes: {
              type: {value: 'file'},
              value: {value: id},
              position: {value: dropMatrix},
              owner: {value: null},
              bindOwner: {value: null},
              physics: {value: true},
            },
            metadata: {},
          };
          walletApi.makeItem(itemSpec);
        };
        fs.on('upload', _upload);

        const _update = () => {
          assetsMaterial.uniforms.theta.value = (Date.now() * ROTATE_SPEED * (Math.PI * 2) % (Math.PI * 2));
        };
        rend.on('update', _update);

        const itemApis = {};
        const equipmentApis = {};
        const _bindAssetInstance = assetInstance => {
          const {value} = assetInstance;
          const itemEntry = itemApis[value];

          if (itemEntry) {
            for (let i = 0; i < itemEntry.length; i++) {
              const itemApi = itemEntry[i];

              if (typeof itemApi.itemAddedCallback === 'function') {
                itemApi.itemAddedCallback(assetInstance);
              }
            }
          }
        };
        const _unbindAssetInstance = assetInstance => {
          const {value} = assetInstance;
          const itemEntry = itemApis[value];

          if (itemEntry) {
            for (let i = 0; i < itemEntry.length; i++) {
              const itemApi = itemEntry[i];

              if (typeof itemApi.itemRemovedCallback === 'function') {
                itemApi.itemRemovedCallback(assetInstance);
              }
            }
          }
        };
        const _bindItemApi = itemApi => {
          if (typeof itemApi.asset === 'string' && typeof itemApi.itemAddedCallback === 'function') {
            const {asset} = itemApi;
            const boundAssetInstances = assetsMesh.getAssetInstances()
              .filter(assetInstance => assetInstance.value === asset);

            for (let i = 0; i < boundAssetInstances.length; i++) {
              const assetInstance = boundAssetInstances[i];
              itemApi.itemAddedCallback(assetInstance);
            }
          }
        };
        const _unbindItemApi = itemApi => {
          if (typeof itemApi.asset === 'string' && typeof itemApi.itemRemovedCallback === 'function') {
            const {asset} = itemApi;
            const boundAssetInstances = assetsMesh.getAssetInstances()
              .filter(assetInstance => assetInstance.value === asset);

            for (let i = 0; i < boundAssetInstances.length; i++) {
              const assetInstance = boundAssetInstances[i];
              itemApi.itemRemovedCallback(assetInstance);
            }
          }
        };

        const _rebindEquipments = (oldEquipments, newEquipments) => {
          const removedEquipments = oldEquipments.filter(oldEquipment =>
            oldEquipment.asset !== null && !newEquipments.some(newEquipment => newEquipment.asset === oldEquipment.asset)
          );
          for (let i = 0; i < removedEquipments.length; i++) {
            const removedEquipment = removedEquipments[i];
            const {asset} = removedEquipment;
            _unbindEquipment(asset);
          }
          const addedEquipments = newEquipments.filter(newEquipment => 
            newEquipment.asset !== null && !oldEquipments.some(oldEquipment => oldEquipment.asset === newEquipment.asset)
          );
          for (let i = 0; i < addedEquipments.length; i++) {
            const addedEquipment = addedEquipments[i];
            const {asset} = addedEquipment;
            _bindEquipment(asset);
          }
        };
        const _bindEquipment = asset => {
          const equipmentEntry = equipmentApis[asset];

          if (equipmentEntry) {
            for (let i = 0; i < equipmentEntry.length; i++) {
              const equipmentApi = equipmentEntry[i];

              if (typeof equipmentApi.equipmentAddedCallback === 'function') {
                equipmentApi.equipmentAddedCallback();
              }
            }
          }
        };
        const _unbindEquipment = asset => {
          const equipmentEntry = equipmentApis[asset];

          if (equipmentEntry) {
            for (let i = 0; i < equipmentEntry.length; i++) {
              const equipmentApi = equipmentEntry[i];

              if (typeof equipmentApi.equipmentRemovedCallback === 'function') {
                equipmentApi.equipmentRemovedCallback();
              }
            }
          }
        };
        const _bindEquipmentApi = equipmentApi => {
          if (typeof equipmentApi.asset === 'string' && typeof equipmentApi.equipmentAddedCallback === 'function') {
            const {asset} = equipmentApi;

            if (walletState.equipments.some(equipmentSpec => equipmentSpec.asset === asset)) {
              equipmentApi.equipmentAddedCallback();
            }
          }
        };
        const _unbindEquipmentApi = equipmentApi => {
          if (typeof equipmentApi.asset === 'string' && typeof equipmentApi.equipmentRemovedCallback === 'function') {
            const {asset} = equipmentApi;

            if (walletState.equipments.some(equipmentSpec => equipmentSpec.asset === asset)) {
              equipmentApi.equipmentRemovedCallback();
            }
          }
        };

        cleanups.push(() => {
          input.removeListener('trigger', _trigger);
          input.removeListener('gripdown', _gripdown);

          fs.removeListener('upload', _upload);

          rend.removeListener('update', _update);
        });

        class WalletApi extends EventEmitter {
          getAssetsMaterial() {
            return assetsMaterial;
          }

          getAsset(id) {
            return assetsMesh.getAssetInstance(id);
          }

          makeItem(itemSpec) {
            const {
              id,
              attributes: {
                type: {value: type},
                value: {value: value},
                position: {value: matrix},
                physics: {value: physics},
              },
            } = itemSpec;
            const n = murmur(id);
            const position = new THREE.Vector3(matrix[0], matrix[1], matrix[2]);
            const rotation = new THREE.Quaternion(matrix[3], matrix[4], matrix[5], matrix[6]);
            const scale = new THREE.Vector3(matrix[7], matrix[8], matrix[9]);

            const assetInstance = assetsMesh.addAssetInstance(
              id,
              type,
              value,
              n,
              physics,
              position,
              rotation,
              scale,
              zeroVector,
              zeroQuaternion,
              oneVector
            );
            _bindAssetInstance(assetInstance);
            _bindAssetInstancePhysics(assetInstance);

            connection.send(JSON.stringify({
              method: 'addAsset',
              args: {
                id,
                type,
                value,
                n,
                physics,
                matrix,
              },
            }));

            return assetInstance;
          }

          destroyItem(itemSpec) {
            const {id} = itemSpec;
            const assetInstance = assetsMesh.getAssetInstance(id);
            _unbindAssetInstance(assetInstance);

            assetsMesh.removeAssetInstance(id);

            connection.send(JSON.stringify({
              method: 'removeAsset',
              args: {
                id,
              },
            }));
          }

          makeFile(fileSpec) {
            const {data, matrix} = fileSpec;
            const file = fs.makeRemoteFile();
            return file.write(data)
              .then(() => {
                return this.reifyFile({file, matrix});
              });
          }

          reifyFile(fileSpec) {
            const {file, matrix} = fileSpec;
            const {n} = file;
            const id = String(n);
            const itemSpec = {
              type: 'file',
              id: id,
              name: id,
              displayName: id,
              attributes: {
                type: {value: 'file'},
                value: {value: n},
                position: {value: matrix},
                owner: {value: null},
                bindOwner: {value: null},
                physics: {value: true},
              },
              metadata: {},
            };
            return walletApi.makeItem(itemSpec);
          }

          registerItem(pluginInstance, itemApi) {
            const {asset} = itemApi;

            let entry = itemApis[asset];
            if (!entry) {
              entry = [];
              itemApis[asset] = entry;
            }
            entry.push(itemApi);

            _bindItemApi(itemApi);
          }

          unregisterItem(pluginInstance, itemApi) {
            const {asset} = itemApi;

            const entry = itemApis[asset];
            entry.splice(entry.indexOf(itemApi), 1);
            if (entry.length === 0) {
              delete itemApis[asset];
            }

            _unbindItemApi(itemApi);
          }

          registerEquipment(pluginInstance, equipmentApi) {
            const {asset} = equipmentApi;

            let entry = equipmentApis[asset];
            if (!entry) {
              entry = [];
              equipmentApis[asset] = entry;
            }
            entry.push(equipmentApi);

            _bindEquipmentApi(equipmentApi);
          }

          unregisterEquipment(pluginInstance, equipmentApi) {
            const {asset} = equipmentApi;

            const entry = equipmentApis[asset];
            entry.splice(entry.indexOf(equipmentApi), 1);
            if (entry.length === 0) {
              delete equipmentApis[asset];
            }

            _unbindEquipmentApi(equipmentApi);
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
const _makeArray = n => {
  const result = Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = null;
  }
  return result;
};
const _relativeWsUrl = s => {
  const l = window.location;
  return ((l.protocol === 'https:') ? 'wss://' : 'ws://') + l.host + l.pathname + (!/\/$/.test(l.pathname) ? '/' : '') + s;
};
const _clone = o => JSON.parse(JSON.stringify(o));
const _debounce = fn => {
  let running = false;
  let queued = false;

  const _go = () => {
    if (!running) {
      running = true;

      fn(() => {
        running = false;

        if (queued) {
          queued = false;

          _go();
        }
      });
    } else {
      queued = true;
    }
  };
  return _go;
};
/* const _arrayToBase64 = array => {
  let binary = '';
  for (let i = 0; i < array.byteLength; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary);
}; */

module.exports = Wallet;
