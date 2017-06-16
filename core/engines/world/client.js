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
} from './lib/constants/world';
import worldRender from './lib/render/world';
import menuUtils from './lib/utils/menu';

const SIDES = ['left', 'right'];
const NUM_POSITIONS = 100 * 1024;

class World {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {site: {url: siteUrl}, server: {url: serverUrl, enabled: serverEnabled}}} = archae;

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
      '/core/engines/cyborg',
      '/core/engines/multiplayer',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/engines/wallet',
      '/core/engines/keyboard',
      '/core/engines/transform',
      '/core/engines/hand',
      '/core/engines/loader',
      '/core/engines/tags',
      '/core/engines/fs',
      '/core/engines/notification',
      '/core/utils/network-utils',
      '/core/utils/geometry-utils',
      '/core/utils/sprite-utils',
      '/core/utils/creature-utils',
    ]).then(([
      bootstrap,
      three,
      input,
      webvr,
      cyborg,
      multiplayer,
      biolumi,
      rend,
      wallet,
      keyboard,
      transform,
      hand,
      loader,
      tags,
      fs,
      notification,
      networkUtils,
      geometryUtils,
      spriteUtils,
      creatureUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {AutoWs} = networkUtils;

        const worldRenderer = worldRender.makeRenderer({creatureUtils});

        const assetMaterial = new THREE.MeshBasicMaterial({
          color: 0xFFFFFF,
          shading: THREE.FlatShading,
          vertexColors: THREE.VertexColors,
        });
        const transparentMaterial = biolumi.getTransparentMaterial();

        const mainFontSpec = {
          fonts: biolumi.getFonts(),
          fontSize: 36,
          lineHeight: 1.4,
          fontWeight: biolumi.getFontWeight(),
          fontStyle: biolumi.getFontStyle(),
        };

        const oneVector = new THREE.Vector3(1, 1, 1);
        const forwardVector = new THREE.Vector3(0, 0, -1);
        const forwardQuaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, -1),
          new THREE.Vector3(0, -1, 0)
        );
        const matrixAttributeSizeVector = oneVector.clone().multiplyScalar(2 * 1.1);

        const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const localUserId = multiplayer.getId();

        const boundingBoxGeometry = new THREE.BoxBufferGeometry(1, 1, 1);
        const boundingBoxMaterial = new THREE.MeshPhongMaterial({
          color: 0xFFFF00,
          shading: THREE.FlatShading,
          transparent: true,
          opacity: 0.5,
        });
        class MatrixAttribute {
          constructor(entityId, attributeName) {
            this.entityId = entityId;
            this.attributeName = attributeName;

            const boundingBox = new THREE.Box3();
            this._boundingBox = boundingBox;
            const transformGizmo = transform.makeTransformGizmo({
              onpreview: (position, rotation, scale) => {
                this.updateBoundingBox(position, rotation, scale);
              },
              onupdate: (position, rotation, scale) => {
                tags.emit('setAttribute', {
                  id: entityId,
                  name: attributeName,
                  value: position.toArray().concat(rotation.toArray()).concat(scale.toArray()),
                });
              },
              menu: true,
              isEnabled: () => this.isEnabled(),
            });
            // scene.add(transformGizmo);
            this._transformGizmo = transformGizmo;

            this._hovered = false;
          }

          isEnabled() {
            return rend.isOpen() && this._hovered;
          }

          updateBoundingBox(position, rotation, scale) {
            this._boundingBox.setFromCenterAndSize(position, matrixAttributeSizeVector);
          }

          updateTransformGizmo(position, rotation, scale) {
            this._transformGizmo.update(position, rotation, scale);
          }

          updateMatrix(newValue) {
            const position = new THREE.Vector3(newValue[0], newValue[1], newValue[2]);
            const rotation = new THREE.Quaternion(newValue[3], newValue[4], newValue[5], newValue[6]);
            const scale = new THREE.Vector3(newValue[7], newValue[8], newValue[9]);

            this.updateBoundingBox(position, rotation, scale);
            this.updateTransformGizmo(position, rotation, scale);
          }

          getIntersectionDistance(controllerLine) {
            if (controllerLine.intersectsBox(this._boundingBox)) {
              const boundingBoxCenter = this._boundingBox.getCenter();
              const closestPoint = controllerLine.closestPointToPoint(boundingBoxCenter);

              if (controllerLine.origin.distanceTo(closestPoint) < 15) {
                return closestPoint.distanceTo(boundingBoxCenter);
              } else {
                return NaN;
              }
            } else {
              return NaN;
            }
          }

          setHovered(hovered) {
            this._hovered = hovered;

            if (hovered && !this._transformGizmo.visible) {
              this._transformGizmo.visible = true;
            } else if (!hovered && this._transformGizmo.visible) {
              this._transformGizmo.visible = false;
            }
          }

          destroy() {
            scene.remove(this._transformGizmo);
            transform.destroyTransformGizmo(this._transformGizmo);
          }
        }
        const matrixAttributes = [];

        const _makeTriggerState = () => ({
          triggered: false,
        });
        const triggerStates = {
          left: _makeTriggerState(),
          right: _makeTriggerState(),
        };

        const _getInFrontOfCameraMatrix = () => {
          const {hmd: hmdStatus} = webvr.getStatus();
          const {worldPosition: hmdPosition, worldRotation: hmdRotation, worldScale: hmdScale} = hmdStatus;

          const newPosition = hmdPosition.clone().add(new THREE.Vector3(0, 0, -0.5).applyQuaternion(hmdRotation));
          const newRotation = hmdRotation;
          const newScale = hmdScale;

          return newPosition.toArray().concat(newRotation.toArray()).concat(newScale.toArray());
        };

        class ElementManager {
          constructor() {
            this.tagMeshes = {};
          }

          getTagMeshes() {
            const {tagMeshes} = this;

            const result = [];
            for (const k in tagMeshes) {
              const tagMesh = tagMeshes[k];
              result.push(tagMesh);
            }
            return result;
          }

          getTagMesh(id) {
            return this.tagMeshes[id];
          }

          add(tagMesh) {
            const {tagMeshes} = this;
            const {item} = tagMesh;
            const {id} = item;
            tagMeshes[id] = tagMesh;

            if (!rend.isOpen()) {
              tagMesh.visible = false;
            }

            // scene.add(tagMesh);
            // tagMesh.updateMatrixWorld();
          }

          remove(tagMesh) {
            const {tagMeshes} = this;
            const {item} = tagMesh;
            const {id} = item;
            delete tagMeshes[id];

            // tagMesh.parent.remove(tagMesh);
          }
        }
        const elementManager = new ElementManager();

        const assetsMesh = (() => {
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

          const assets = [];
          const _makeHoverState = () => ({
            asset: null,
            notification: null,
          });
          const hoverStates = {
            left: _makeHoverState(),
            right: _makeHoverState(),
          };

          class Asset {
            constructor(
              position,
              rotation,
              scale,
              asset,
              quantity,
              geometry,
              startTime
            ) {
              this.position = position;
              this.rotation = rotation;
              this.scale = scale;
              this.asset = asset;
              this.quantity = quantity;
              this.geometry = geometry;
              this.startTime = startTime;

              this._grabbed = false;
              this._visible = true;
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

          object.addAsset = (position, rotation, scale, asset, quantity) => {
            const geometry = (() => {
              const canvas = creatureUtils.makeCanvasCreature('asset:' + asset);
              const pixelSize = 0.02;
              const geometry = spriteUtils.makeImageGeometry(canvas, pixelSize);
              return geometry;
            })();
            const startTime = Date.now();
            const assetInstance = new Asset(position, rotation, scale, asset, quantity, geometry, startTime);
            assets.push(assetInstance);

            return assetInstance;
          };
          object.removeAsset = assetInstance => {
            assets.splice(assets.indexOf(assetInstance), 1);
          };

          let lastUpdateTime = Date.now();
          object.update = () => {
            const {gamepads} = webvr.getStatus();
            const now = Date.now();

            const _updateAssets = () => {
              SIDES.forEach(side => {
                const gamepad = gamepads[side];
                const {worldPosition: controllerPosition} = gamepad;
                const hoverState = hoverStates[side];

                let closestAsset = null;
                let closestAssetIndex = -1;
                let closestAssetDistance = Infinity;
                for (let i = 0; i < assets.length; i++) {
                  const asset = assets[i];
                  const distance = controllerPosition.distanceTo(asset.position);

                  if (closestAsset === null || distance < closestAssetDistance) {
                    closestAsset = asset;
                    closestAssetIndex = i;
                    closestAssetDistance = distance;
                  }
                }

                if (closestAssetDistance < 0.2) {
                  hoverState.asset = closestAsset;

                  const {notification: oldNotification} = hoverState;
                  if (!oldNotification || oldNotification.asset !== closestAsset) {
                    if (oldNotification) {
                      notification.removeNotification(oldNotification);
                    }

                    const {asset, quantity} = closestAsset;
                    const newNotification = notification.addNotification(`This is ${quantity} ${asset}.`);
                    newNotification.asset = closestAsset;

                    hoverState.notification = newNotification;
                  }
                } else {
                  const {asset} = hoverState;

                  if (asset) {
                    const {notification: oldNotification} = hoverState;
                    notification.removeNotification(oldNotification);

                    hoverState.asset = null;
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
              for (let i = 0; i < assets.length; i++) {
                const asset = assets[i];

                if (asset.isVisible()) {
                  const {geometry: assetGeometry} = asset;
                  const matrix = asset.getMatrix(now);

                  const newGeometry = assetGeometry.clone()
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
              }

              positionsAttribute.needsUpdate = true;
              normalsAttribute.needsUpdate = true;
              colorsAttribute.needsUpdate = true;

              geometry.setDrawRange(0, index / 3);
            };

            _updateAssets();
            _updateCore();

            lastUpdateTime = now;
          };

          return object;
        })();
        scene.add(assetsMesh);
        assetsMesh.updateMatrixWorld();

        cleanups.push(() => {
          scene.remove(assetsMesh);
        });

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

        const requestHandlers = new Map();
        const _request = (method, args, cb) => {
          if (connection) {
            const id = _makeId();

            const e = {
              method,
              args,
              id,
            };
            const es = JSON.stringify(e);
            connection.send(es);

            const requestHandler = (err, result) => {
              if (!err) {
                cb(null, result);
              } else {
                cb(err);
              }

              requestHandlers.delete(id);
            };
            requestHandlers.set(id, requestHandler);
          } else {
            setTimeout(() => {
              cb(null);
            });
          }
        };
        const _addTag = (itemSpec, {element = null} = {}) => {
          const entityElement = _handleAddTag(localUserId, itemSpec, {element});
          _request('addTag', [localUserId, itemSpec], _warnError);
          return entityElement;
        };
        const _removeTag = id => {
          const entityElement = _handleRemoveTag(localUserId, id);
          _request('removeTag', [localUserId, id], _warnError);
          return entityElement;
        };

        const _handleAddTag = (userId, itemSpec, {element = null} = {}) => {
          const tagMesh = tags.makeTag(itemSpec);
          const {item} = tagMesh;

          if (element) {
            element.item = item;
            item.instance = element;
          }

          let result = null;
          if (item.type === 'entity' && !item.instance) {
            result = tags.mutateAddEntity(tagMesh);
          }
          if (item.type === 'asset' && !item.instance) {
            const {attributes} = item;
            const {
              position: {value: matrix},
              asset: {value: asset},
              quantity: {value: quantity},
            } = attributes;

            const position = new THREE.Vector3(matrix[0], matrix[1], matrix[2]);
            const rotation = new THREE.Quaternion(matrix[3], matrix[4], matrix[5], matrix[6]);
            const scale = new THREE.Vector3(matrix[7], matrix[8], matrix[9]);

            const assetInstance = assetsMesh.addAsset(position, rotation, scale, asset, quantity);
            item.instance = assetInstance;

            const grabbable = (() => {
              const grabbable = hand.makeGrabbable(item.id);
              grabbable.setPosition(position);
              grabbable.on('grab', () => {
                assetInstance.grab();
              });
              grabbable.on('release', () => {
                assetInstance.release();

                const {hmd} = webvr.getStatus();
                const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmd;
                const externalMatrix = webvr.getExternalMatrix();
                const bodyPosition = hmdPosition.clone()
                  .add(
                    new THREE.Vector3(0, -0.4, 0)
                      .applyQuaternion(new THREE.Quaternion().setFromRotationMatrix(externalMatrix))
                  );
                if (assetInstance.position.distanceTo(bodyPosition) < 0.35) {
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

                      _removeTag(item.id);
                    })
                    .catch(err => {
                      console.warn(err);

                      if (err.status === 402) { // insufficient funds, delete the asset since there's no way it's valid
                        hand.destroyGrabbable(grabbable);

                        _removeTag(item.id);
                      } else { // failed to send, so re-show
                        assetInstance.show();
                      }
                    });
                }
              });
              grabbable.on('update', ({position, rotation, scale}) => {
                assetInstance.update(position, rotation, scale);
              });
              return grabbable;
            })();
          }

          elementManager.add(tagMesh);

          return result;
        };
        const _handleRemoveTag = (userId, id) => {
          const tagMesh = elementManager.getTagMesh(id);
          const {item} = tagMesh;

          let result = null;
          if (item.type === 'entity' && item.instance) {
            result = tags.mutateRemoveEntity(tagMesh);
          }
          if (item.type === 'asset' && item.instance) {
            const {instance: assetInstance} = item;
            assetsMesh.removeAsset(assetInstance);
          }

          tags.destroyTag(tagMesh);

          return result;
        };
        const _handleSetTagAttribute = (userId, src, {name, value}) => {
          // same for local and remote user ids
          let match;
          if (match = src.match(/^world:(.+)$/)) {
            const id = match[1];

            const tagMesh = elementManager.getTagMesh(id);
            tagMesh.setAttribute(name, value);

            return tagMesh;
          } else {
            console.warn('invalid set tag attribute arguments', {src, name, value});

            return null;
          }
        };
        const _handleTagOpen = (userId, src) => {
          // same for local and remote user ids
          let match;
          if (match = src.match(/^world:(.+)$/)) {
            const id = match[1];

            const tagMesh = elementManager.getTagMesh(id);
            tagMesh.open();
          } else {
            console.warn('invalid tag open arguments', {src});
          }
        };
        const _handleTagClose = (userId, src) => {
          // same for local and remote user ids
          let match;
          if (match = src.match(/^world:(.+)$/)) {
            const id = match[1];

            const tagMesh = elementManager.getTagMesh(id);
            tagMesh.close();
          } else {
            console.warn('invalid tag open arguments', {src});
          }
        };
        const _handleTagOpenDetails = (userId, src) => {
          // same for local and remote user ids
          let match;
          if (match = src.match(/^(world|npm|asset):(.+)$/)) {
            const type = match[1];
            const id = match[2];

            const tagMesh = (() => {
              if (type === 'world') {
                return elementManager.getTagMesh(id);
              } else if (type === 'npm') {
                return npmTagMeshes.find(tagMesh => tagMesh.item.id === id);
              } else if (type === 'asset') {
                return wallet.getAssetTagMeshes().find(tagMesh => tagMesh.item.id === id);
              } else {
                return null;
              }
            })();
            tagMesh.openDetails();
          } else {
            console.warn('invalid tag open details arguments', {src});
          }
        };
        const _handleTagCloseDetails = (userId, src) => {
          // same for local and remote user ids
          let match;
          if (match = src.match(/^(world|npm|asset):(.+)$/)) {
            const type = match[1];
            const id = match[2];

            const tagMesh = (() => {
              if (type === 'world') {
                return elementManager.getTagMesh(id);
              } else if (type === 'npm') {
                return npmTagMeshes.find(tagMesh => tagMesh.item.id === id);
              } else if (type === 'asset') {
                return wallet.getAssetTagMeshes().find(tagMesh => tagMesh.item.id === id);
              } else {
                return null;
              }
            })();
            tagMesh.closeDetails();
          } else {
            console.warn('invalid tag close details arguments', {src});
          }
        };
        const _handleTagPlay = (userId, src) => {
          // same for local and remote user ids
          let match;
          if (match = src.match(/^world:(.+)$/)) {
            const id = match[1];

            const tagMesh = elementManager.getTagMesh(id);
            tagMesh.play();
          } else {
            console.warn('invalid tag play arguments', {src});
          }
        };
        const _handleTagPause = (userId, src) => {
          // same for local and remote user ids
          let match;
          if (match = src.match(/^world:(.+)$/)) {
            const id = match[1];

            const tagMesh = elementManager.getTagMesh(id);
            tagMesh.pause();
          } else {
            console.warn('invalid tag pause arguments', {src});
          }
        };
        const _handleTagSeek = (userId, src, value) => {
          // same for local and remote user ids
          let match;
          if (match = src.match(/^world:(.+)$/)) {
            const id = match[1];

            const tagMesh = elementManager.getTagMesh(id);
            tagMesh.seek(value);
          } else {
            console.warn('invalid tag seek arguments', {src, value});
          }
        };
        const _handleLoadModule = (userId, plugin) => {
          loader.requestPlugin(plugin)
            .catch(err => {
              console.warn(err);
            });
        };
        const _handleUnloadModule = (userId, pluginName) => {
          loader.releasePlugin(pluginName)
            .catch(err => {
              console.warn(err);
            });
        };
        const _handleMessage = detail => {
          tags.message(detail);
        };

        const _searchNpm = (q = '') => fetch(`archae/rend/search?q=${encodeURIComponent(q)}`)
          .then(res => res.json());
        const _updateNpm = menuUtils.debounce(next => {
          const {inputText} = npmState;

          _searchNpm(inputText)
            .then(itemSpecs =>
              Promise.all(itemSpecs.map(itemSpec => {
                itemSpec.metadata.isStatic = true; // XXX can probably be hardcoded in the render
                itemSpec.metadata.exists = elementManager.getTagMeshes()
                  .some(tagMesh =>
                    tagMesh.item.type === itemSpec.type &&
                    tagMesh.item.name === itemSpec.name
                  );

                return tags.makeTag(itemSpec, {
                  initialUpdate: false,
                });
              }))
                .then(tagMeshes => {
                  const {tagMeshes: oldTagMeshes} = npmCacheState;

                  npmState.loading = false;
                  npmState.page = 0;
                  npmState.tagSpecs = itemSpecs;
                  npmState.numTags = itemSpecs.length;
                  npmCacheState.tagMeshes = tagMeshes;

                  _updatePages();

                  next();
                })
            )
            .catch(err => {
              console.warn(err);

              next();
            });

          const {numTags} = npmState;
          npmState.loading = numTags === 0;
        });

        const npmState = {
          loading: true,
          inputText: '',
          module: null,
          tagSpecs: [],
          numTags: 0,
          page: 0,
        };
        const focusState = {
          keyboardFocusState: null,
        };
        const npmCacheState = {
          tagMeshes: [],
          loaded: false,
        };

        const worldMesh = (() => {
          const object = new THREE.Object3D();
          object.visible = false;

          const planeMesh = (() => {
            const worldUi = biolumi.makeUi({
              width: WIDTH,
              height: HEIGHT,
            });
            const mesh = worldUi.makePage(({
              npm: {
                loading,
                inputText,
                module,
                tagSpecs,
                numTags,
                page,
              },
              focus: {
                keyboardFocusState,
              },
            }) => {
              const {type: focusType = '', inputValue = 0} = keyboardFocusState || {};

              return {
                type: 'html',
                src: worldRenderer.getWorldPageSrc({loading, inputText, inputValue, module, tagSpecs, numTags, page, focusType}),
                x: 0,
                y: 0,
                w: WIDTH,
                h: HEIGHT,
              };
            }, {
              type: 'world',
              state: {
                npm: npmState,
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
        rend.registerMenuMesh('worldMesh', worldMesh);
        worldMesh.updateMatrixWorld();

        rend.reindex();
        rend.updateMatrixWorld(worldMesh);

        const _updatePages = () => {
          const {planeMesh} = worldMesh;
          const {page} = planeMesh;
          page.update();
        };
        _updatePages();

        const _update = e => {
          const _updateAssetsMesh = () => {
            assetsMesh.update();
          };
          const _updateMatrixAttributes = () => {
            return;

            if (rend.isOpen() && matrixAttributes.length > 0) {
              const {gamepads} = webvr.getStatus();
              const _getControllerLine = gamepad => {
                const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;
                const controllerLine = new THREE.Ray(controllerPosition, forwardVector.clone().applyQuaternion(controllerRotation));
                return controllerLine;
              };
              const controllerLines = {
                left: _getControllerLine(gamepads.left),
                right: _getControllerLine(gamepads.right),
              };

              const intersectedMatrixAttributes = SIDES.map(side => {
                const controllerLine = controllerLines[side];

                let closestIntersectionSpec = null;
                for (let i = 0; i < matrixAttributes.length; i++) {
                  const matrixAttribute = matrixAttributes[i];
                  const distance = matrixAttribute.getIntersectionDistance(controllerLine);

                  if (!isNaN(distance) && (!closestIntersectionSpec || (distance < closestIntersectionSpec.distance))) {
                    closestIntersectionSpec = {
                      matrixAttribute,
                      distance,
                    };
                  }
                }
                const closestIntersectedMatrixAttribute = closestIntersectionSpec && closestIntersectionSpec.matrixAttribute;
                return closestIntersectedMatrixAttribute;
              });
              for (let i = 0; i < matrixAttributes.length; i++) {
                const matrixAttribute = matrixAttributes[i];
                matrixAttribute.setHovered(intersectedMatrixAttributes.includes(matrixAttribute));
              }
            }
          };

          _updateAssetsMesh();
          _updateMatrixAttributes();
        };
        rend.on('update', _update);

        const _tabchange = tab => {
          if (tab === 'world') {
            keyboard.tryBlur();

            const {loaded} = npmCacheState;
            if (!loaded) {
              _updateNpm();
              _updatePages();

              npmCacheState.loaded = true;
            }
          }
        };
        rend.on('tabchange', _tabchange);

        const _trigger = e => {
          const {side} = e;

          const _clickMenu = () => {
            const tab = rend.getTab();

            if (tab === 'world') {
              const hoverState = rend.getHoverState(side);
              const {intersectionPoint} = hoverState;

              if (intersectionPoint) {
                const {anchor} = hoverState;
                const onclick = (anchor && anchor.onclick) || '';

                let match;
                if (onclick === 'npm:focus') {
                  const {inputText} = npmState;
                  const {value} = hoverState;
                  const valuePx = value * (WIDTH - (250 + (30 * 2)));
                  const {index, px} = biolumi.getTextPropertiesFromCoord(inputText, mainFontSpec, valuePx); // XXX this can be folded into the keyboard engine
                  const {hmd: hmdStatus} = webvr.getStatus();
                  const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmdStatus;
                  const keyboardFocusState = keyboard.focus({
                    type: 'world',
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
                    const {inputText: npmInputText} = npmState;

                    if (keyboardInputText !== npmInputText) {
                      npmState.inputText = keyboardInputText;

                      // XXX the backend should cache responses to prevent local re-requests from hitting external APIs
                      _updateNpm();
                    }

                    _updatePages();
                  });
                  keyboardFocusState.on('blur', () => {
                    focusState.keyboardFocusState = null;

                    _updatePages();
                  });

                  _updatePages();

                  return true;
                } else if (match = onclick.match(/^npm:(up|down)$/)) {
                  const direction = match[1];

                  npmState.page += (direction === 'up' ? -1 : 1);

                  _updatePages();

                  return true;
                } else if (match = onclick.match(/^module:main:(.+)$/)) {
                  const id = match[1];

                  const tagMesh = tags.getTagMeshes().find(tagMesh => tagMesh.item.id === id);
                  const {item} = tagMesh;
                  npmState.module = item;
                  npmState.page = 0;

                  _updatePages();

                  return true;
                } else if (onclick === 'module:back') {
                  // const id = match[1];

                  npmState.module = null;

                  _updatePages();

                  return true;
                } else if (match = onclick.match(/^module:add:(.+)$/)) {
                  const id = match[1];
                  const moduleTagMesh = tags.getTagMeshes().find(tagMesh => tagMesh.item.type === 'module' && tagMesh.item.id === id);
                  const {item: moduleItem} = moduleTagMesh;
                  const {name: module, displayName: moduleName, tagName} = moduleItem;
                  const attributes = tags.getAttributeSpecs(module);

                  const itemSpec = {
                    type: 'entity',
                    id: _makeId(),
                    name: moduleName,
                    displayName: moduleName,
                    version: '0.0.1',
                    module: module,
                    tagName: tagName,
                    attributes: attributes,
                    metadata: {},
                  };
                  const entityElement = _addTag(itemSpec);
                  const {instance: item} = entityElement;

                  rend.setTab('entity');
                  rend.setEntity(item);

                  return true;
                } else {
                  return false;
                }
              } else {
                return false;
              }
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

        const _getTagIdSrc = id => {
          const _getWorldSrc = () => {
            if (elementManager.getTagMeshes().some(tagMesh => tagMesh.item.id === id)) {
              return 'world:' + id;
            } else if (npmTagMeshes.some(tagMesh => tagMesh.item.id === id)) {
              return 'npm:' + id;
            } else if (wallet.getAssetTagMeshes().some(tagMesh => tagMesh.item.id === id)) {
              return 'asset:' + id;
            } else {
              return null;
            }
          };
          const _getHandSrc = () => {
            const controllers = cyborg.getControllers();

            for (let i = 0; i < SIDES.length; i++) {
              const side = SIDES[i];
              const grabMesh = grabManager.getMesh(side);

              if (grabMesh && grabMesh.item.id === id) {
                return 'hand:' + side;
              }
            }
            return null;
          };

          return _getWorldSrc() || _getHandSrc() || null;
        };

        const authorizedState = {
          loading: false,
          loaded: false,
          loadCbs: [],
          authorized: false,
        };
        const _openWalletWindow = req => {
          const width = 800;
          const height = 600;

          return window.open(
            `${siteUrl}/id/iframe?${_formatQueryString(req)}`,
            'wallet',
            `left=${(screen.width - width) / 2},top=${(screen.height - height) / 2},width=${width},height=${height}`
          );
        }
        const _requestWallet = req => new Promise((accept, reject) => {
          const walletWindow = _openWalletWindow(req);

          const _cleanup = () => {
            window.removeEventListener('message', _onmessage);

            if (walletWindow) {
              walletWindow.close();
            }
          };

          const _onmessage = e => {
            _cleanup();

            const {data} = e;
            const {error} = data;

            if (!error) {
              const {result} = data;
              accept(result);
            } else {
              reject(error);
            }
          };
          window.addEventListener('message', _onmessage);
        });

        /* const _grabAssetBill = ({side, tagMesh, quantity}) => {
          const grabMesh = grabManager.getMesh(side);

          if (!grabMesh) {
            // add tag mesh
            const itemSpec = _clone(tagMesh.item);
            itemSpec.id = _makeId();
            itemSpec.matrix = DEFAULT_MATRIX;
            itemSpec.quantity = quantity;
            itemSpec.words = assetwalletStatic.makeWords();
            itemSpec.metadata.isStatic = false;
            _addTag(itemSpec, 'hand:' + side);
            const billTagMesh = grabManager.getMesh(side);
            const {item: billItem} = billTagMesh;
            billItem.instancing = true;

            // perform the pack
            return fetch(`${siteUrl}/id/api/pack`, {
              method: 'POST',
              headers: (() => {
                const headers = new Headers();
                headers.append('Content-Type', 'application/json');
                return headers;
              })(),
              body: JSON.stringify((() => {
                if (itemSpec.name === 'BTC') {
                  return {
                    words: itemSpec.words,
                    value: itemSpec.quantity,
                  };
                } else {
                  return {
                    words: itemSpec.words,
                    asset: itemSpec.name,
                    quantity: itemSpec.quantity,
                  };
                }
              })()),
              credentials: 'include',
            })
              .then(_resJson)
              .then(({words, asset, quantity, txid}) => {
                console.log('packed', {words, asset, quantity, txid});

                const assetName = itemSpec.name || 'BTC';
                const assetTagMesh = wallet.getAssetTagMeshes()
                  .find(tagMesh =>
                    tagMesh.item.type === 'asset' &&
                    tagMesh.item.name === assetName &&
                    (tagMesh.item.metadata && tagMesh.item.metadata.isStatic && !tagMesh.item.metadata.isSub)
                  );
                if (assetTagMesh) {
                  // XXX update the quantity here
                  assetTagMesh.update();
                }
              });
          }
        };
        tags.on('grabAssetBill', _grabAssetBill); */
        const _mutateAddEntity = ({element, tagName, attributes}) => {
          const itemSpec = {
            type: 'entity',
            id: _makeId(),
            name: 'Manual entity',
            displayName: 'Manual entity',
            version: '0.0.1',
            tagName: tagName,
            attributes: attributes,
            metadata: {},
          };
          _addTag(itemSpec, {element});
        };
        tags.on('mutateAddEntity', _mutateAddEntity);
        const _mutateRemoveEntity = ({id}) => {
          _removeTag(id);
        };
        tags.on('mutateRemoveEntity', _mutateRemoveEntity);
        const _mutateSetAttribute = ({id, name, value}) => {
          const src = _getTagIdSrc(id);

          _request('setTagAttribute', [localUserId, src, {name, value}], _warnError);
        };
        tags.on('mutateSetAttribute', _mutateSetAttribute);
        const _tagsSetAttribute = ({id, name, value}) => {
          const src = _getTagIdSrc(id);

          _handleSetTagAttribute(localUserId, src, {name, value});
        };
        tags.on('setAttribute', _tagsSetAttribute);
        const _tagsAttributeValueChanged = attributeSpec => {
          const {type} = attributeSpec;

          if (type === 'matrix') {
            const {entityId, attributeName, oldValue, newValue} = attributeSpec;

            if (oldValue === null && newValue !== null) {
              const matrixAttribute = new MatrixAttribute(entityId, attributeName);
              matrixAttribute.updateMatrix(newValue);
              matrixAttributes.push(matrixAttribute);
            } else if (oldValue !== null && newValue === null) {
              const index = matrixAttributes.findIndex(matrixAttribute => matrixAttribute.entityId === entityId && matrixAttribute.attributeName === attributeName);
              const matrixAttribute = matrixAttributes[index];
              matrixAttribute.destroy();
              matrixAttributes.splice(index, 1);
            } else if (oldValue !== null && newValue !== null) {
              const matrixAttribute = matrixAttributes.find(matrixAttribute => matrixAttribute.entityId === entityId && matrixAttribute.attributeName === attributeName);
              matrixAttribute.updateMatrix(newValue);
            }
          }
        };
        tags.on('attributeValueChanged', _tagsAttributeValueChanged);
        const _tagsOpen = ({id}) => {
          const src = _getTagIdSrc(id);

          _request('tagOpen', [localUserId, src], _warnError);

          _handleTagOpen(localUserId, src);
        };
        tags.on('open', _tagsOpen);
        const _tagsClose = ({id}) => {
          const src = _getTagIdSrc(id);

          _request('tagClose', [localUserId, src], _warnError);

          _handleTagClose(localUserId, src);
        };
        tags.on('close', _tagsClose);
        const _tagsOpenDetails = ({id, isStatic}) => {
          const src = _getTagIdSrc(id);

          if (!isStatic) {
            _request('tagOpenDetails', [localUserId, src], _warnError);
          }

          _handleTagOpenDetails(localUserId, src);
        };
        tags.on('openDetails', _tagsOpenDetails);
        const _tagsCloseDetails = ({id, isStatic}) => {
          const src = _getTagIdSrc(id);

          if (!isStatic) {
            _request('tagCloseDetails', [localUserId, src], _warnError);
          }

          _handleTagCloseDetails(localUserId, src);
        };
        tags.on('closeDetails', _tagsCloseDetails);
        const _tagsPlay = ({id}) => {
          const src = _getTagIdSrc(id);

          _request('tagPlay', [localUserId, src], _warnError);

          _handleTagPlay(localUserId, src);
        };
        tags.on('play', _tagsPlay);
        const _tagsPause = ({id}) => {
          const src = _getTagIdSrc(id);

          _request('tagPause', [localUserId, src], _warnError);

          _handleTagPause(localUserId, src);
        };
        tags.on('pause', _tagsPause);
        const _tagsSeek = ({id, value}) => {
          const src = _getTagIdSrc(id);

          _request('tagSeek', [localUserId, src, value], _warnError);

          _handleTagSeek(localUserId, src, value);
        };
        tags.on('seek', _tagsSeek);
        const _tagsSeekUpdate = ({id, value}) => {
          const src = _getTagIdSrc(id);

          _request('tagSeekUpdate', [localUserId, src, value], _warnError);
        };
        tags.on('seekUpdate', _tagsSeekUpdate);
        const _reinstallModule = ({id}) => {
          const tagMesh = elementManager.getTagMesh(id);
          const {item} = tagMesh;
          const {name, displayName} = item;

          _request('unloadModule', [localUserId, displayName], _warnError);
          _handleUnloadModule(localUserId, displayName);

          loader.removePlugin(name)
            .then(() => {
              _request('loadModule', [localUserId, name], _warnError);
              _handleLoadModule(localUserId, name);
            })
            .catch(err => {
              console.warn(err);
            });
        };
        tags.on('reinstallModule', _reinstallModule);
        const _loadTags = ({itemSpecs}) => {
          for (let i = 0; i < itemSpecs.length; i++) {
            const itemSpec = itemSpecs[i];

            _handleAddTag(localUserId, itemSpec);
          }
        };
        tags.on('loadTags', _loadTags);
        const _broadcast = detail => {
          _request('broadcast', [detail], _warnError);
        };
        tags.on('broadcast', _broadcast);

        const _addAsset = itemSpec => {
          _addTag(itemSpec);
        };
        wallet.on('addAsset', _addAsset);

        const _download = ({id}) => {
          const a = document.createElement('a');
          a.href = fs.getFileUrl(id);
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        };
        tags.on('download', _download);

        const _makeFileTagFromSpec = fileSpec => {
          const {
            id,
            name,
            mimeType,
            files,
          } = fileSpec;
          const itemSpec = {
            type: 'file',
            id,
            name,
            mimeType,
            matrix: _getInFrontOfCameraMatrix(),
          };
          _handleAddTag(localUserId, itemSpec);

          const elementTagMeshes = elementManager.getTagMeshes();
          const tempTagMesh = elementTagMeshes.find(tagMesh => tagMesh.item.id === id);
          if (!rend.isOpen()) {
            tempTagMesh.visible = false;
          }
          const {item: tempItem} = tempTagMesh;
          tempItem.instancing = true;
          tempItem.temp = true;

          const _cleanupTempTagMesh = () => {
            elementManager.remove(tempTagMesh);

            tags.destroyTag(tempTagMesh);
          };

          return fs.writeFiles(id, files)
            .then(() => {
              _cleanupTempTagMesh();

              _addTag(itemSpec);

              const tagMesh = elementTagMeshes.find(tagMesh => tagMesh.item.id === id);
              if (!rend.isOpen()) {
                tagMesh.visible = false;
              }

              return Promise.resolve(tagMesh);
            })
            .catch(err => {
              _cleanupTempTagMesh();

              return Promise.reject(err);
            });
        };
        const _upload = files => {
          const _makeFileTagFromFiles = files => {
            const id = _makeFileId();
            const mainFile = (() => {
              const _isRoot = f => /^\/[^\/]+/.test(f.path);
              const _getFileMode = f => {
                const {type: autoMimeType} = f;

                if (autoMimeType) {
                  return fs.getFileMode(autoMimeType);
                } else {
                  const match = f.path.match(/\.([^\/]+)$/);

                  if (match) {
                    const ext = match[1];
                    const fakeMimeType = 'mime/' + ext.toLowerCase();

                    return fs.getFileMode(fakeMimeType);
                  } else {
                    return null;
                  }
                }
              };
              const _isRecognizedMimeType = f => _getFileMode(f) !== null;
              const _isModelMimeType = f => _getFileMode(f) === 'model';

              return files.sort((a, b) => a.path.localeCompare(b.path))
                .sort((a, b) => {
                  const isRootDiff = +_isRoot(b) - +_isRoot(a);

                  if (isRootDiff !== 0) {
                    return isRootDiff;
                  } else {
                    const isRecognizedMimeTypeDiff = +_isRecognizedMimeType(b) - +_isRecognizedMimeType(a);

                    if (isRecognizedMimeTypeDiff !== 0) {
                      return isRecognizedMimeTypeDiff;
                    } else {
                      return _isModelMimeType(b) - +_isModelMimeType(a);
                    }
                  }
                })[0];
              })();
            const {path: name} = mainFile;
            const mimeType = (() => {
              const {type: mimeType} = mainFile;

              if (mimeType) {
                return mimeType;
              } else {
                const match = name.match(/\.([^.]+)$/);

                if (match) {
                  const ext = match[1];

                  return 'mime/' + ext.toLowerCase();
                } else {
                  return 'mime/blank';
                }
              }
            })();

            return _makeFileTagFromSpec({
              id,
              name,
              mimeType,
              files,
            });
          };
          _makeFileTagFromFiles(files)
            .then(tagMesh => {
              console.log('upoaded file', tagMesh);
            })
            .catch(err => {
              console.warn(err);
            });
        };
        fs.on('upload', _upload);

        const initPromise = (() => {
          let _accept = null;
          let _reject = null;
          const result = new Promise((accept, reject) => {
            _accept = accept;
            _reject = reject;
          });
          result.resolve = _accept;
          result.reject = _reject;
          return result;
        })();

        const connection = (() => {
          if (serverEnabled) {
            const connection = new AutoWs(_relativeWsUrl('archae/worldWs?id=' + localUserId));
            let initialized = false;
            connection.on('message', msg => {
              const m = JSON.parse(msg.data);
              const {type} = m;

              if (type === 'init') {
                if (!initialized) { // XXX temporary hack until we correctly unload tags on disconnect
                  initPromise // wait for core to be loaded before initializing user plugins
                    .then(() => {
                      const {args: [itemSpecs]} = m;

                      tags.loadTags(itemSpecs);

                      initialized = true;
                    });
                }
              } else if (type === 'addTag') {
                const {args: [userId, itemSpec]} = m;

                _handleAddTag(userId, itemSpec);
              } else if (type === 'removeTag') {
                const {args: [userId, id]} = m;

                _handleRemoveTag(userId, id);
              } else if (type === 'setTagAttribute') {
                const {args: [userId, src, {name, value}]} = m;

                const tagMesh = _handleSetTagAttribute(userId, src, {name, value});

                // this prevents this mutation from triggering an infinite recursion multiplayer update
                // we simply ignore this mutation during the next entity mutation tick
                if (tagMesh) {
                  const {item} = tagMesh;
                  const {id} = item;

                  tags.ignoreEntityMutation({
                    type: 'setAttribute',
                    args: [id, name, value],
                  });
                }
              } else if (type === 'tagOpen') {
                const {args: [userId, src]} = m;

                _handleTagOpen(userId, src);
              } else if (type === 'tagClose') {
                const {args: [userId, src]} = m;

                _handleTagClose(userId, src);
              } else if (type === 'tagOpenDetails') {
                const {args: [userId, src]} = m;

                _handleTagOpenDetails(userId, src);
              } else if (type === 'tagCloseDetails') {
                const {args: [userId, src]} = m;

                _handleTagCloseDetails(userId, src);
              } else if (type === 'tagPlay') {
                const {args: [userId, src]} = m;

                _handleTagPlay(userId, src);
              } else if (type === 'tagPause') {
                const {args: [userId, src]} = m;

                _handleTagPause(userId, src);
              } else if (type === 'tagSeek') {
                const {args: [userId, src, value]} = m;

                _handleTagSeek(userId, src, value);
              } else if (type === 'loadModule') {
                const {args: [userId, plugin]} = m;

                _handleLoadModule(userId, plugin);
              } else if (type === 'unloadModule') {
                const {args: [userId, pluginName]} = m;

                _handleUnloadModule(userId, pluginName);
              } else if (type === 'message') {
                const {args: [detail]} = m;

                _handleMessage(detail);
              } else if (type === 'response') {
                const {id} = m;

                const requestHandler = requestHandlers.get(id);
                if (requestHandler) {
                  const {error, result} = m;
                  requestHandler(error, result);
                } else {
                  console.warn('unregistered handler:', JSON.stringify(id));
                }
              } else {
                console.log('unknown message', m);
              }
            });
            return connection;
          } else {
            return null;
          }
        })();

        cleanups.push(() => {
          rend.removeListener('update', _update);
          rend.removeListener('tabchange', _tabchange);

          input.removeListener('trigger', _trigger);

          tags.removeListener('download', _download);
          // tags.removeListener('grabAssetBill', _grabAssetBill);
          tags.removeListener('mutateAddEntity', _mutateAddEntity);
          tags.removeListener('mutateRemoveEntity', _mutateRemoveEntity);
          tags.removeListener('mutateSetAttribute', _mutateSetAttribute);
          tags.removeListener('setAttribute', _tagsSetAttribute);
          tags.removeListener('attributeValueChanged', _tagsAttributeValueChanged);
          tags.removeListener('open', _tagsOpen);
          tags.removeListener('close', _tagsClose);
          tags.removeListener('openDetails', _tagsOpenDetails);
          tags.removeListener('closeDetails', _tagsCloseDetails);
          tags.removeListener('play', _tagsPlay);
          tags.removeListener('pause', _tagsPause);
          tags.removeListener('seek', _tagsSeek);
          tags.removeListener('seekUpdate', _tagsSeekUpdate);
          tags.removeListener('loadTags', _loadTags);
          tags.removeListener('broadcast', _broadcast);

          wallet.removeListener('addAsset', _addAsset);

          fs.removeListener('upload', _upload);

          connection.destroy();
        });

        class WorldApi {
          init() {
            initPromise.resolve();
          }

          addTag(itemSpec) {
            _addTag(itemSpec);
          }

          removeTag(id) {
            _removeTag(id);
          }

          makeFile({ext = 'txt'} = {}) {
            const id = _makeId();
            const name = id + '.' + ext;
            const mimeType = 'mime/' + ext.toLowerCase();
            const path = '/' + name;
            const file = new Blob([], {
              type: mimeType,
            });
            file.path = path;
            const files = [file];

            return _makeFileTagFromSpec({
              id,
              name,
              mimeType,
              files,
            }).then(tagMesh => {
              const {item} = tagMesh;
              const {id, name} = item;

              return fs.makeFile('fs/' + id + '/' + name);
            });
          }
        }
        const worldApi = new WorldApi();

        return worldApi;
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _clone = o => JSON.parse(JSON.stringify(o));
const _relativeWsUrl = s => {
  const l = window.location;
  return ((l.protocol === 'https:') ? 'wss://' : 'ws://') + l.host + l.pathname + (!/\/$/.test(l.pathname) ? '/' : '') + s;
};
const _makeId = () => Math.random().toString(36).substring(7);
const _padNumber = (n, width) => {
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
};
const _makeFileId = () => {
  const array = new Uint8Array(128 / 8);
  crypto.getRandomValues(array);
  return array.reduce((acc, i) => {
    return acc + _padNumber(i.toString(16), 2);
  }, '');
};
const _warnError = err => {
  if (err) {
    console.warn(err);
  }
};
const _formatQueryString = o => {
  const result = [];
  for (const k in o) {
    result.push(encodeURIComponent(k) + '=' + encodeURIComponent(o[k]));
  }
  return result.join('&');
};

module.exports = World;
