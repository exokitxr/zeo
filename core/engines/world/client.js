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
import worldRenderer from './lib/render/world';
import menuUtils from './lib/utils/menu';

const TAGS_PER_ROW = 4;
const TAGS_ROWS_PER_PAGE = 6;
const TAGS_PER_PAGE = TAGS_PER_ROW * TAGS_ROWS_PER_PAGE;
const DEFAULT_USER_HEIGHT = 1.6;
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const SIDES = ['left', 'right'];

class World {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {server: {enabled: serverEnabled}}} = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    if (serverEnabled) {
      return archae.requestPlugins([
        '/core/engines/bootstrap',
        '/core/engines/three',
        '/core/engines/input',
        '/core/engines/webvr',
        '/core/engines/cyborg',
        '/core/engines/multiplayer',
        '/core/engines/login',
        '/core/engines/servers',
        '/core/engines/biolumi',
        '/core/engines/rend',
        '/core/engines/tags',
        '/core/engines/fs',
        '/core/engines/mail',
        '/core/engines/bag',
        '/core/engines/backpack',
        '/core/plugins/geometry-utils',
      ]).then(([
        bootstrap,
        three,
        input,
        webvr,
        cyborg,
        multiplayer,
        login,
        servers,
        biolumi,
        rend,
        tags,
        fs,
        mail,
        bag,
        backpack,
        geometryUtils,
      ]) => {
        if (live) {
          const {THREE, scene, camera} = three;

          // constants
          const transparentMaterial = biolumi.getTransparentMaterial();
          const trashGeometry = (() => {
            const size = 0.2;
            const geometry = geometryUtils.unindexBufferGeometry(new THREE.BoxBufferGeometry(size, size * 2, size));

            const positionsAttrbiute = geometry.getAttribute('position');
            const positions = positionsAttrbiute.array;
            const numFaces = positions.length / 3 / 3;
            for (let i = 0; i < numFaces; i++) {
              const baseIndex = i * 3 * 3;
              const points = [
                positions.slice(baseIndex, baseIndex + 3),
                positions.slice(baseIndex + 3, baseIndex + 6),
                positions.slice(baseIndex + 6, baseIndex + 9),
              ];
              if (points[0][1] >= size && points[1][1] >= size && points[0][1] >= size) {
                for (let j = 0; j < 9; j++) {
                  positions[baseIndex + j] = 0;
                }
              }
            }

            return geometry;
          })();
          const solidMaterial = new THREE.MeshPhongMaterial({
            color: 0x808080,
            side: THREE.DoubleSide,
          });

          const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x808080,
            wireframe: true,
          });
          const wireframeHighlightMaterial = new THREE.MeshBasicMaterial({
            color: 0x0000FF,
            wireframe: true,
            opacity: 0.5,
            transparent: true,
          });

          const mainFontSpec = {
            fonts: biolumi.getFonts(),
            fontSize: 36,
            lineHeight: 1.4,
            fontWeight: biolumi.getFontWeight(),
            fontStyle: biolumi.getFontStyle(),
          };

          const oneVector = new THREE.Vector3(1, 1, 1);
          const zeroVector = new THREE.Vector3(0, 0, 0);
          const zeroQuaternion = new THREE.Quaternion();
          const controllerMeshOffset = new THREE.Vector3(0, 0, -0.02);
          const controllerMeshQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1));

          // helper functions
          const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
          const _decomposeMatrix = matrix => {
            const position = new THREE.Vector3();
            const rotation = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            matrix.decompose(position, rotation, scale);
            return {position, rotation, scale};
          };

          const localUserId = multiplayer.getId();
          const _makeGrabbableState = () => ({
            hoverMesh: null,
            pointMesh: null,
          });
          const grabbableStates = {
            left: _makeGrabbableState(),
            right: _makeGrabbableState(),
          };

          const _makeGrabBoxMesh = () => {
            const width = TAGS_WORLD_WIDTH;
            const height = TAGS_WORLD_HEIGHT;
            const depth = TAGS_WORLD_DEPTH;

            const geometry = new THREE.BoxBufferGeometry(width, height, depth);
            const material = wireframeHighlightMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = 1.2;
            mesh.rotation.order = camera.rotation.order;
            mesh.rotation.y = Math.PI / 2;
            mesh.depthWrite = false;
            mesh.visible = false;
            return mesh;
          };
          const grabBoxMeshes = {
            left: _makeGrabBoxMesh(),
            right: _makeGrabBoxMesh(),
          };
          scene.add(grabBoxMeshes.left);
          scene.add(grabBoxMeshes.right);

          const _makeTrashState = () => ({
            hovered: false,
            pointed: false,
          });
          const trashStates = {
            left: _makeTrashState(),
            right: _makeTrashState(),
          };

          const _requestConnection = () => new Promise((accept, reject) => {
            const connection = new WebSocket('wss://' + bootstrap.getCurrentServer().url + '/archae/worldWs?id=' + localUserId);
            connection.onmessage = msg => {
              const m = JSON.parse(msg.data);
              const {type} = m;

              if (type === 'init') {
                const {args: [itemSpecs, equipmentSpecs, inventorySpecs]} = m;

                for (let i = 0; i < itemSpecs.length; i++) {
                  const itemSpec = itemSpecs[i];

                  _handleAddTag(localUserId, itemSpec, 'world');
                }

                for (let i = 0; i < equipmentSpecs.length; i++) {
                  const itemSpec = equipmentSpecs[i];

                  if (itemSpec) {
                    _handleAddTag(localUserId, itemSpec, 'equipment:' + i);
                  }
                }

                for (let i = 0; i < inventorySpecs.length; i++) {
                  const itemSpec = inventorySpecs[i];

                  if (itemSpec) {
                    _handleAddTag(localUserId, itemSpec, 'inventory:' + i);
                  }
                }
              } else if (type === 'addTag') {
                const {args: [userId, itemSpec, dst]} = m;

                _handleAddTag(userId, itemSpec, dst);
              } else if (type === 'removeTag') {
                const {args: [userId, src]} = m;

                _handleRemoveTag(userId, src);
              } else if (type === 'moveTag') {
                const {args: [userId, src, dst]} = m;

                _handleMoveTag(userId, src, dst);
              } else if (type === 'setTagAttribute') {
                const {args: [userId, src, attribute, value]} = m;

                _handleSetTagAttribute(userId, src, attribute, value);
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
            };
            connection.onopen = () => {
              accept(connection);
            };
            connection.onerror = err => {
              reject(err);
            };
          });
          const _requestStartTime = () => fetch('https://' + bootstrap.getCurrentServer().url + '/archae/world/start-time.json')
            .then(res => res.json()
              .then(({startTime}) => startTime)
            );
          const _getInFrontOfCameraMatrix = () => {
            const {hmd} = webvr.getStatus();
            const {position, rotation} = hmd;

            const newPosition = position.clone().add(new THREE.Vector3(0, 0, -0.5).applyQuaternion(rotation));
            const newRotation = rotation;
            const newScale = oneVector;

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

              scene.add(tagMesh);

              const {type} = item;
              if (type === 'element') {
                _reifyTag(tagMesh);
              }
            }

            remove(tagMesh) {
              const {tagMeshes} = this;
              const {item} = tagMesh;
              const {id} = item;
              delete tagMeshes[id];

              tagMesh.parent.remove(tagMesh);

              const {instance} = item;
              if (instance) {
                _unreifyTag(tagMesh);
              }
            }
          }
          const elementManager = new ElementManager();

          class NpmManager {
            constructor() {
              this.tagMeshes = [];
            }

            getTagMeshes() {
              return this.tagMeshes;
            }

            setTagMeshes(tagMeshes) {
              this.tagMeshes = tagMeshes;
            }
          }
          const npmManager = new NpmManager();

          class GrabManager {
            constructor() {
              this.left = null;
              this.right = null;
            }

            getMesh(side) {
              return this[side];
            }

            setMesh(side, mesh) {
              this[side] = mesh;
            }
          }
          const grabManager = new GrabManager();

          class RemoteGrabManager {
            constructor() {
              this.managers = {};

              multiplayer.getPlayerStatuses().forEach((status, userId) => {
                this.addManager(userId);
              });

              const _playerEnter = update => {
                const {id: userId} = update;

                this.addManager(userId);
              };
              multiplayer.on('playerEnter', _playerEnter);
              const _playerLeave = update => {
                const {id: userId} = update;

                this.removeManager(userId);
              };
              multiplayer.on('playerLeave', _playerLeave);

              this._cleanup = () => {
                multiplayer.removeListener('playerEnter', _playerEnter);
                multiplayer.removeListener('playerLeave', _playerLeave);
              };
            }

            getManager(userId) {
              return this.managers[userId];
            }

            addManager(userId) {
              const manager = new GrabManager();
              manager.userId = userId;

              this.managers[userId] = manager;
            }

            removeManager(userId) {
              delete this.managers[userId];
            }

            destroy() {
              this._cleanup();
            }
          }
          const remoteGrabManager = new RemoteGrabManager();

          class EquipmentManager {
            constructor() {
              const tagMeshes = (() => {
                const numEquipments = (1 + 1 + 2 + 8);

                const result = Array(numEquipments);
                for (let i = 0; i < numEquipments; i++) {
                  result[i] = null;
                }
                return result;
              })();
              this.tagMeshes = tagMeshes;
            }

            getTagMeshes() {
              return this.tagMeshes;
            }

            set(index, tagMesh) {
              this.tagMeshes[index] = tagMesh;

              const {item} = tagMesh;
              const {type} = item;
              if (type === 'element') {
                _reifyTag(tagMesh);
              }
            }

            unset(index) {
              const tagMesh = this.tagMeshes[index];
              this.tagMeshes[index] = null;

              const {item} = tagMesh;
              const {type} = item;
              if (type === 'element') {
                _unreifyTag(tagMesh);
              }
            }

            move(oldIndex, newIndex) {
              this.tagMeshes[newIndex] = this.tagMeshes[oldIndex];
              this.tagMeshes[oldIndex] = null;
            }
          }
          const equipmentManager = new EquipmentManager();

          class RemoteEquipmentManager {
            constructor() {
              this.managers = {};

              multiplayer.getPlayerStatuses().forEach((status, userId) => {
                this.addManager(userId);
              });

              const _playerEnter = update => {
                const {id: userId} = update;

                this.addManager(userId);
              };
              multiplayer.on('playerEnter', _playerEnter);
              const _playerLeave = update => {
                const {id: userId} = update;

                this.removeManager(userId);
              };
              multiplayer.on('playerLeave', _playerLeave);

              this._cleanup = () => {
                multiplayer.removeListener('playerEnter', _playerEnter);
                multiplayer.removeListener('playerLeave', _playerLeave);
              };
            }

            getManagers() {
              const result = [];

              const {managers} = this;
              for (const userId in managers) {
                const manager = managers[userId];
                result.push(manager);
              }

              return result;
            }

            getManager(userId) {
              return this.managers[userId];
            }

            addManager(userId) {
              const manager = new EquipmentManager();
              manager.userId = userId;

              this.managers[userId] = manager;
            }

            removeManager(userId) {
              delete this.managers[userId];
            }
          }
          const remoteEquipmentManager = new RemoteEquipmentManager();

          class InventoryManager {
            constructor() {
              const tagMeshes = (() => {
                const numItems = 9;

                const result = Array(numItems);
                for (let i = 0; i < numItems; i++) {
                  result[i] = null;
                }
                return result;
              })();
              this.tagMeshes = tagMeshes;
            }

            getTagMeshes() {
              return this.tagMeshes;
            }

            set(index, tagMesh) {
              this.tagMeshes[index] = tagMesh;
            }

            unset(index) {
              this.tagMeshes[index] = null;
            }
          }
          const inventoryManager = new InventoryManager();

          class RemoteInventoryManager {
            constructor() {
              this.managers = {};

              multiplayer.getPlayerStatuses().forEach((status, userId) => {
                this.addManager(userId);
              });

              const _playerEnter = update => {
                const {id: userId} = update;

                this.addManager(userId);
              };
              multiplayer.on('playerEnter', _playerEnter);
              const _playerLeave = update => {
                const {id: userId} = update;

                this.removeManager(userId);
              };
              multiplayer.on('playerLeave', _playerLeave);

              this._cleanup = () => {
                multiplayer.removeListener('playerEnter', _playerEnter);
                multiplayer.removeListener('playerLeave', _playerLeave);
              };
            }

            getManager(userId) {
              return this.managers[userId];
            }

            addManager(userId) {
              const manager = new InventoryManager();
              manager.userId = userId;

              this.managers[userId] = manager;
            }

            removeManager(userId) {
              delete this.managers[userId];
            }

            destroy() {
              this._cleanup();
            }
          }
          const remoteInventoryManager = new RemoteInventoryManager();

          class WorldTimer {
            constructor(startTime = 0) {
              this.startTime = startTime;
            }

            getWorldTime() {
              const {startTime} = this;
              const now = Date.now();
              const worldTime = now - startTime;
              return worldTime;
            }

            setStartTime(startTime) {
              this.startTime = startTime;
            }
          }
          const worldTimer = new WorldTimer();

          const _reifyTag = tagMesh => {
            const {item} = tagMesh;
            const {instance, instancing} = item;

            if (!instance && !instancing) {
              const {name} = item;

              item.lock()
                .then(unlock => {
                  archae.requestPlugin(name)
                    .then(pluginInstance => {
                      const name = archae.getName(pluginInstance);

                      const tag = name;
                      let elementApi = modElementApis[tag];
                      if (!HTMLElement.isPrototypeOf(elementApi)) {
                        elementApi = HTMLElement;
                      }
                      const {id, attributes} = item;
                      const baseClass = elementApi;

                      const element = menuUtils.makeZeoElement({
                        tag,
                        attributes,
                        baseClass,
                      });
                      element.onsetattribute = (attribute, value) => {
                        _setAttribute({id, attribute, value});
                      };
                      item.instance = element;
                      item.instancing = false;
                      item.attributes = _clone(attributes);

                      _updatePages();
                      tags.updatePages();

                      unlock();
                    })
                    .catch(err => {
                      console.warn(err);

                      unlock();
                    });
                });

              item.instancing = true;

              _updatePages();
              tags.updatePages();
            }
          };
          const _unreifyTag = tagMesh => {
            const {item} = tagMesh;

            item.lock()
              .then(unlock => {
                const {instance} = item;

                if (instance) {
                  if (typeof instance.destructor === 'function') {
                    instance.destructor();
                  }
                  item.instance = null;

                  _updatePages();
                }

                unlock();
              });
          };

          const requestHandlers = new Map();
          const _request = (method, args, cb) => {
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
          };
          const _addTag = (itemSpec, dst) => {
            _handleAddTag(localUserId, itemSpec, dst);

            _request('addTag', [localUserId, itemSpec, dst], _warnError);
          };
          const _removeTag = src => {
            _handleRemoveTag(localUserId, src);

            _request('removeTag', [localUserId, src], _warnError);
          };
          const _moveTag = (src, dst) => {
            _handleMoveTag(localUserId, src, dst);

            _request('moveTag', [localUserId, src, dst], _warnError);
          };
          const _setTagAttribute = (src, attribute, value) => {
            _handleSetTagAttribute(localUserId, src, attribute, value);

            _request('setTagAttribute', [localUserId, src, attribute, value], _warnError);
          };

          const _handleAddTag = (userId, itemSpec, dst) => {
            const isMe = userId === localUserId;

            let match;
            if (dst === 'world') {
              const tagMesh = tags.makeTag(itemSpec);

              elementManager.add(tagMesh);
            } else if (match = dst.match(/^hand:(left|right)$/)) {
              const side = match[1];

              const tagMesh = tags.makeTag(itemSpec);
              const userGrabManager = isMe ? grabManager : remoteGrabManager.getManager(userId);
              const userControllerMeshes = (() => {
                if (isMe) {
                  const controllers = cyborg.getControllers();
                  return {
                    left: controllers.left.mesh,
                    right: controllers.right.mesh,
                  };
                } else {
                  const remotePlayerMesh = multiplayer.getRemotePlayerMesh(userId);
                  const {controllers: controllerMeshes} = remotePlayerMesh;
                  return controllerMeshes;
                }
              })();

              userGrabManager.setMesh(side, tagMesh);

              const controllerMesh = userControllerMeshes[side];
              tagMesh.position.copy(controllerMeshOffset);
              tagMesh.quaternion.copy(controllerMeshQuaternion);
              tagMesh.scale.copy(oneVector);
              controllerMesh.add(tagMesh);
            } else if (match = dst.match(/^equipment:([0-9]+)$/)) {
              const equipmentIndex = parseInt(match[1], 10);

              const tagMesh = tags.makeTag(itemSpec);
              
              const userBagMesh = (() => {
                if (isMe) {
                  return bag.getBagMesh();
                } else {
                  const remotePlayerMesh = multiplayer.getRemotePlayerMesh(userId);
                  const {bagMesh} = remotePlayerMesh;
                  return bagMesh;
                }
              })();
              const userEquipmentManager = isMe ? equipmentManager : remoteEquipmentManager.getManager(userId);

              const {equipmentBoxMeshes} = bagMesh;
              const equipmentBoxMesh = equipmentBoxMeshes[equipmentIndex];
              equipmentBoxMesh.add(tagMesh);

              userEquipmentManager.set(equipmentIndex, tagMesh);
            } else if (match = dst.match(/^inventory:([0-9]+)$/)) {
              const inventoryIndex = parseInt(match[1], 10);

              const tagMesh = tags.makeTag(itemSpec);

              const userBackpackMesh = (() => {
                if (isMe) {
                  return backpack.getBackpackMesh();
                } else {
                  const remotePlayerMesh = multiplayer.getRemotePlayerMesh(userId);
                  const {backpackMesh} = remotePlayerMesh;
                  return backpackMesh;
                }
              })();
              const userInventoryManager = isMe ? inventoryManager : remoteInventoryManager.getManager(userId);

              const {itemBoxMeshes} = userBackpackMesh;
              const itemBoxMesh = itemBoxMeshes[inventoryIndex];
              itemBoxMesh.add(tagMesh);

              userInventoryManager.set(inventoryIndex, tagMesh)
            } else {
              console.warn('invalid add tag arguments', {userId, itemSpec, dst});
            }
          };
          const _handleRemoveTag = (userId, src) => {
            const isMe = userId === localUserId;

            let match;
            if (match = src.match(/^hand:(left|right)$/)) {
              const side = match[1];

              const userGrabManager = isMe ? grabManager : remoteGrabManager.getManager(userId);

              const tagMesh = userGrabManager.getMesh(side);

              elementManager.remove(tagMesh);
              tags.destroyTag(tagMesh);

              userGrabManager.setMesh(side, null);
            } else {
              console.warn('invalid remove tag arguments', {userId, itemSpec, src});
            }
          };
          const _handleMoveTag = (userId, src, dst) => {
            const isMe = userId === localUserId;

            let match;
            if (match = src.match(/^world:(.+)$/)) {
              const id = match[1];

              if (match = dst.match(/^hand:(left|right)$/)) {
                const side = match[1];

                const userGrabManager = isMe ? grabManager : remoteGrabManager.getManager(userId);
                const userControllerMeshes = (() => {
                  if (isMe) {
                    const controllers = cyborg.getControllers();
                    return {
                      left: controllers.left.mesh,
                      right: controllers.right.mesh,
                    };
                  } else {
                    const remotePlayerMesh = multiplayer.getRemotePlayerMesh(userId);
                    const {controllers: controllerMeshes} = remotePlayerMesh;
                    return controllerMeshes;
                  }
                })();

                const tagMesh = elementManager.getTagMesh(id);

                userGrabManager.setMesh(side, tagMesh);

                const controllerMesh = userControllerMeshes[side];
                controllerMesh.add(tagMesh);
                tagMesh.position.copy(controllerMeshOffset);
                tagMesh.quaternion.copy(controllerMeshQuaternion);
                tagMesh.scale.copy(oneVector)

                _unreifyTag(tagMesh);
              } else {
                console.warn('invalid move tag arguments', {src, dst});
              }
            } else if (match = src.match(/^hand:(left|right)$/)) {
              const side = match[1];

              const userGrabManager = isMe ? grabManager : remoteGrabManager.getManager(userId);
              const tagMesh = userGrabManager.getMesh(side);

              if (match = dst.match(/^world:(.+)$/)) {
                const matrixArrayString = match[1];
                const matrixArray = JSON.parse(matrixArrayString);

                tagMesh.position.set(matrixArray[0], matrixArray[1], matrixArray[2]);
                tagMesh.quaternion.set(matrixArray[3], matrixArray[4], matrixArray[5], matrixArray[6]);
                tagMesh.scale.set(matrixArray[7], matrixArray[8], matrixArray[9]);

                elementManager.add(tagMesh);

                userGrabManager.setMesh(side, null);
              } else if (match = dst.match(/^equipment:([0-9]+)$/)) {
                const equipmentIndex = parseInt(match[1], 10);

                const userBagMesh = (() => {
                  if (isMe) {
                    return bag.getBagMesh();
                  } else {
                    const remotePlayerMesh = multiplayer.getRemotePlayerMesh(userId);
                    const {bagMesh} = remotePlayerMesh;
                    return bagMesh;
                  }
                })();
                const userEquipmentManager = isMe ? equipmentManager : remoteEquipmentManager.getManager(userId);

                const {equipmentBoxMeshes} = userBagMesh;
                const equipmentBoxMesh = equipmentBoxMeshes[equipmentIndex];
                equipmentBoxMesh.add(tagMesh);
                tagMesh.position.copy(zeroVector);
                tagMesh.quaternion.copy(zeroQuaternion);
                tagMesh.scale.copy(oneVector);

                userEquipmentManager.set(equipmentIndex, tagMesh);

                userGrabManager.setMesh(side, null);
              } else if (match = dst.match(/^inventory:([0-9]+)$/)) {
                const inventoryIndex = parseInt(match[1], 10);

                const userBackpackMesh = (() => {
                  if (isMe) {
                    return backpack.getBackpackMesh();
                  } else {
                    const remotePlayerMesh = multiplayer.getRemotePlayerMesh(userId);
                    const {backpackMesh} = remotePlayerMesh;
                    return backpackMesh;
                  }
                })();
                const userInventoryManager = isMe ? inventoryManager : remoteInventoryManager.getManager(userId);

                const {itemBoxMeshes} = userBackpackMesh;
                const itemBoxMesh = itemBoxMeshes[inventoryIndex];
                itemBoxMesh.add(tagMesh);
                tagMesh.position.copy(zeroVector);
                tagMesh.quaternion.copy(zeroQuaternion);
                tagMesh.scale.copy(oneVector);

                userInventoryManager.set(inventoryIndex, tagMesh);

                userGrabManager.setMesh(side, null);
              } else {
                console.warn('invalid move tag arguments', {src, dst});
              }
            } else if (match = src.match(/^equipment:([0-9]+)$/)) {
              const srcEquipmentIndex = parseInt(match[1], 10);

              const userEquipmentManager = isMe ? equipmentManager : remoteEquipmentManager.getManager(userId);
              const equipmentTagMeshes = userEquipmentManager.getTagMeshes();
              const tagMesh = equipmentTagMeshes[srcEquipmentIndex];

              if (match = dst.match(/^hand:(left|right)$/)) {
                const side = match[1];

                const userGrabManager = isMe ? grabManager : remoteGrabManager.getManager(userId);
                const userControllerMeshes = (() => {
                  if (isMe) {
                    const controllers = cyborg.getControllers();
                    return {
                      left: controllers.left.mesh,
                      right: controllers.right.mesh,
                    };
                  } else {
                    const remotePlayerMesh = multiplayer.getRemotePlayerMesh(userId);
                    const {controllers: controllerMeshes} = remotePlayerMesh;
                    return controllerMeshes;
                  }
                })();

                userGrabManager.setMesh(side, tagMesh);

                const controllerMesh = userControllerMeshes[side];
                controllerMesh.add(tagMesh);
                tagMesh.position.copy(controllerMeshOffset);
                tagMesh.quaternion.copy(controllerMeshQuaternion);
                tagMesh.scale.copy(oneVector);

                userEquipmentManager.unset(srcEquipmentIndex)
              } else if (match = dst.match(/^equipment:([0-9]+)$/)) {
                const dstEquipmentIndex = parseInt(match[1], 10);

                const userBagMesh = (() => {
                  if (isMe) {
                    return bag.getBagMesh();
                  } else {
                    const remotePlayerMesh = multiplayer.getRemotePlayerMesh(userId);
                    const {bagMesh} = remotePlayerMesh;
                    return bagMesh;
                  }
                })();
                const userEquipmentManager = isMe ? equipmentManager : remoteEquipmentManager.getManager(userId);

                const {equipmentBoxMeshes} = userBagMesh;
                const equipmentBoxMesh = equipmentBoxMeshes[dstEquipmentIndex];
                equipmentBoxMesh.add(tagMesh);
                tagMesh.position.copy(zeroVector);
                tagMesh.quaternion.copy(zeroQuaternion);
                tagMesh.scale.copy(oneVector);

                userEquipmentManager.move(srcEquipmentIndex, dstEquipmentIndex);
              } else {
                console.warn('invalid move tag arguments', {src, dst});
              }
            } else if (match = src.match(/^inventory:([0-9]+)$/)) {
              const inventoryIndex = parseInt(match[1], 10);

              const userInventoryManager = isMe ? inventoryManager : remoteInventoryManager.getManager(userId);
              const inventoryTagMeshes = userInventoryManager.getTagMeshes();
              const tagMesh = inventoryTagMeshes[inventoryIndex];

              if (match = dst.match(/^hand:(left|right)$/)) {
                const side = match[1];

                const userGrabManager = isMe ? grabManager : remoteGrabManager.getManager(userId);
                const userControllerMeshes = (() => {
                  if (isMe) {
                    const controllers = cyborg.getControllers();
                    return {
                      left: controllers.left.mesh,
                      right: controllers.right.mesh,
                    };
                  } else {
                    const remotePlayerMesh = multiplayer.getRemotePlayerMesh(userId);
                    const {controllers: controllerMeshes} = remotePlayerMesh;
                    return controllerMeshes;
                  }
                })();
                const userInventoryManager = isMe ? inventoryManager : remoteInventoryManager.getManager(userId);

                userGrabManager.setMesh(side, tagMesh);

                const controllerMesh = userControllerMeshes[side];
                controllerMesh.add(tagMesh);
                tagMesh.position.copy(controllerMeshOffset);
                tagMesh.quaternion.copy(controllerMeshQuaternion);
                tagMesh.scale.copy(oneVector);

                userInventoryManager.unset(inventoryIndex);
              } else {
                console.warn('invalid move tag arguments', {src, dst});
              }
            } else {
              console.warn('invalid move tag arguments', {src, dst});
            }
          };
          const _handleSetTagAttribute = (userId, src, attribute, value) => {
            // same for local and remote user ids
            let match;
            if (match = src.match(/^world:(.+)$/)) {
              const id = match[1];

              const tagMesh = elementManager.getTagMesh(id);
              const {item} = tagMesh;
              item.setAttribute(attribute, value);
            } else {
              console.warn('invalid set tag attribute arguments', {src, attributeName, attributeValue});
            }
          };

          const _searchNpm = (q = '') => fetch('https://' + bootstrap.getCurrentServer().url + '/archae/rend/mods/search?q=' + encodeURIComponent(q))
            .then(res => res.json());
          const _updateNpm = menuUtils.debounce(next => {
            const {inputText} = npmState;

            _searchNpm(inputText)
              .then(tagSpecs => tagSpecs.map(tagSpec => {
                tagSpec.isStatic = true;

                return tags.makeTag(tagSpec);
              }))
              .then(tagMeshes => {
                npmState.loading = false;
                npmState.page = 0;
                npmState.numTags = tagMeshes.length;
                npmCacheState.tagMeshes = tagMeshes;

                _updateNpmTagMeshContainer();
                _updatePages();

                next();
              })
              .catch(err => {
                console.warn(err);

                next();
              });

            const {numTags} = npmState;
            npmState.loading = numTags === 0;

            _updatePages();
          });

          const npmState = {
            loading: false,
            inputText: '',
            inputPlaceholder: 'Search npm modules',
            inputIndex: 0,
            inputValue: 0,
            numTags: 0,
            page: 0,
          };
          const npmCacheState = {
            tagMeshes: [],
            loaded: false,
          };
          const _makeHighlightState = () => ({
            startPoint: null,
          });
          const highlightStates = {
            left: _makeHighlightState(),
            right: _makeHighlightState(),
          };
          const focusState = {
            type: '',
          };

          const menuHoverStates = {
            left: biolumi.makeMenuHoverState(),
            right: biolumi.makeMenuHoverState(),
          };

          const npmHoverStates = {
            left: biolumi.makeMenuHoverState(),
            right: biolumi.makeMenuHoverState(),
          };
          const npmDotMeshes = {
            left: biolumi.makeMenuDotMesh(),
            right: biolumi.makeMenuDotMesh(),
          };
          scene.add(npmDotMeshes.left);
          scene.add(npmDotMeshes.right);
          const npmBoxMeshes = {
            left: biolumi.makeMenuBoxMesh(),
            right: biolumi.makeMenuBoxMesh(),
          };
          scene.add(npmBoxMeshes.left);
          scene.add(npmBoxMeshes.right);

          const worldUi = biolumi.makeUi({
            width: WIDTH,
            height: HEIGHT,
          });

          const worldMesh = (() => {
            const result = new THREE.Object3D();
            result.visible = false;

            const menuMesh = (() => {
              const object = new THREE.Object3D();
              object.position.z = -1.5;

              const planeMesh = (() => {
                const mesh = worldUi.addPage(({
                  npm: {
                    loading,
                    inputText,
                    inputPlaceholder,
                    inputValue,
                    numTags,
                    page,
                  },
                  focus: {
                    type,
                  }
                }) => {
                  const focus = type === 'npm';

                  return [
                    {
                      type: 'html',
                      src: worldRenderer.getWorldPageSrc({loading, inputText, inputPlaceholder, inputValue, numTags, page, focus, onclick: 'npm:focus'}),
                      x: 0,
                      y: 0,
                      w: WIDTH,
                      h: HEIGHT,
                    },
                  ];
                }, {
                  type: 'world',
                  state: {
                    npm: npmState,
                    focus: focusState,
                  },
                  worldWidth: WORLD_WIDTH,
                  worldHeight: WORLD_HEIGHT,
                });
                mesh.receiveShadow = true;

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

            const npmMesh = (() => {
              const object = new THREE.Object3D();
              object.position.z = -1.5 + 0.01;

              return object;
            })();
            result.add(npmMesh);
            result.npmMesh = npmMesh;

            return result;
          })();
          rend.registerMenuMesh('worldMesh', worldMesh);

          const _makeHighlightBoxMesh = () => {
            const geometry = new THREE.BoxBufferGeometry(1, 1, 1);
            const material = wireframeMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.order = camera.rotation.order;
            mesh.visible = false;
            return mesh;
          };
          const highlightBoxMeshes = {
            left: _makeHighlightBoxMesh(),
            right: _makeHighlightBoxMesh(),
          };
          scene.add(highlightBoxMeshes.left);
          scene.add(highlightBoxMeshes.right);

          const trashMesh = (() => {
            const geometry = trashGeometry;
            const material = solidMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.x = (WORLD_WIDTH / 2) - (((250 / WIDTH) * WORLD_WIDTH) / 2);
            mesh.position.y = -DEFAULT_USER_HEIGHT + 1.2;
            mesh.position.z = -1.5 + (0.2 / 2) + 0.02;
            mesh.visible = false;

            const highlightMesh = (() => {
              const geometry = new THREE.BoxBufferGeometry(0.2, 0.4, 0.2);
              const material = wireframeHighlightMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              mesh.rotation.order = camera.rotation.order;
              mesh.visible = false;
              return mesh;
            })();
            mesh.add(highlightMesh);
            mesh.highlightMesh = highlightMesh;

            return mesh;
          })();
          rend.registerMenuMesh('trashMesh', trashMesh);

          const _makePositioningMesh = ({opacity = 1} = {}) => {
            const geometry = (() => {
              const result = new THREE.BufferGeometry();
              const positions = Float32Array.from([
                0, 0, 0,
                0.1, 0, 0,
                0, 0, 0,
                0, 0.1, 0,
                0, 0, 0,
                0, 0, 0.1,
              ]);
              result.addAttribute('position', new THREE.BufferAttribute(positions, 3));
              const colors = Float32Array.from([
                1, 0, 0,
                1, 0, 0,
                0, 1, 0,
                0, 1, 0,
                0, 0, 1,
                0, 0, 1,
              ]);
              result.addAttribute('color', new THREE.BufferAttribute(colors, 3));
              return result;
            })();
            const material = new THREE.LineBasicMaterial({
              // color: 0xFFFFFF,
              // color: 0x333333,
              vertexColors: THREE.VertexColors,
              opacity: opacity,
            });

            const mesh = new THREE.LineSegments(geometry, material);
            mesh.visible = false;
            return mesh;
          };
          const positioningMesh = _makePositioningMesh();
          scene.add(positioningMesh);
          const oldPositioningMesh = _makePositioningMesh({
            opacity: 0.5,
          });
          scene.add(oldPositioningMesh);

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
            worldUi.update();
          };
          _updatePages();

          const _update = e => {
            const _updateMenuAnchors = () => {
              const tab = rend.getTab();

              if (tab === 'world') {
                const {gamepads} = webvr.getStatus();
                const {menuMesh} = worldMesh;
                const {planeMesh} = menuMesh;
                const menuMatrixObject = _decomposeObjectMatrixWorld(planeMesh);
                const {page} = planeMesh;

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
                    })
                  }
                });
              }
            };
            const _updateGrabbers = () => {
              const isOpen = rend.isOpen();

              if (isOpen) {
                const _getBestHoverGrabbable = (side, objects) => {
                  const grabMesh = grabManager.getMesh(side);

                  if (!grabMesh) {
                    const {gamepads} = webvr.getStatus();
                    const gamepad = gamepads[side];

                    if (gamepad) {
                      const {position: controllerPosition} = gamepad;

                      const objectDistanceSpecs = objects.map(object => {
                        const {position: objectPosition} = _decomposeObjectMatrixWorld(object);
                        const distance = controllerPosition.distanceTo(objectPosition);
                        return {
                          object,
                          distance,
                        };
                      }).filter(({distance}) => distance <= 0.2);

                      if (objectDistanceSpecs.length > 0) {
                        return objectDistanceSpecs.sort((a, b) => a.distance - b.distance)[0].object;
                      } else {
                        return null;
                      }
                    } else {
                      return null;
                    }
                  } else {
                    return null;
                  }
                };
                const _getPointerGrabbable = side => {
                  const grabMesh = grabManager.getMesh(side);

                  if (!grabMesh) {
                    return tags.getPointedTagMesh(side);
                  } else {
                    return null;
                  }
                };

                const tagMeshes = elementManager.getTagMeshes().concat(npmManager.getTagMeshes());
                SIDES.forEach(side => {
                  const grabbableState = grabbableStates[side];
                  const grabBoxMesh = grabBoxMeshes[side];

                  const hoverMesh = _getBestHoverGrabbable(side, tagMeshes);
                  const pointerMesh = _getPointerGrabbable(side);

                  grabbableState.hoverMesh = hoverMesh;
                  grabbableState.pointerMesh = pointerMesh;

                  if (hoverMesh) {
                    const {position: tagMeshPosition, rotation: tagMeshRotation, scale: tagMeshScale} = _decomposeObjectMatrixWorld(hoverMesh);
                    grabBoxMesh.position.copy(tagMeshPosition);
                    grabBoxMesh.quaternion.copy(tagMeshRotation);
                    grabBoxMesh.scale.copy(tagMeshScale);

                    if (!grabBoxMesh.visible) {
                      grabBoxMesh.visible = true;
                    }
                  } else {
                    grabbableState.hoverMesh = null;

                    if (grabBoxMesh.visible) {
                      grabBoxMesh.visible = false;
                    }
                  }
                });
              } else {
                SIDES.forEach(side => {
                  const grabbableState = grabbableStates[side];
                  const grabBoxMesh = grabBoxMeshes[side];

                  grabbableState.hoverMesh = null;
                  grabbableState.pointMesh = null;

                  if (grabBoxMesh.visible) {
                    grabBoxMesh.visible = false;
                  }
                });
              }
            };
            const _updateNpmAnchors = () => {
              const isOpen = rend.isOpen();
              const tab = rend.getTab();

              if (isOpen && tab === 'world') {
                const {gamepads} = webvr.getStatus();

                SIDES.forEach(side => {
                  const gamepad = gamepads[side];

                  if (gamepad) {
                    const {position: controllerPosition, rotation: controllerRotation} = gamepad;
                    const npmHoverState = npmHoverStates[side];
                    const npmDotMesh = npmDotMeshes[side];
                    const npmBoxMesh = npmBoxMeshes[side];

                    biolumi.updateAnchors({
                      objects: npmManager.getTagMeshes().map(tagMesh => {
                        const {planeMesh, initialScale = oneVector} = tagMesh;
                        const matrixObject = _decomposeObjectMatrixWorld(planeMesh);
                        const {page} = planeMesh;

                        return {
                          matrixObject: matrixObject,
                          page: page,
                          width: TAGS_WIDTH,
                          height: TAGS_HEIGHT,
                          worldWidth: TAGS_WORLD_WIDTH * initialScale.x,
                          worldHeight: TAGS_WORLD_HEIGHT * initialScale.y,
                          worldDepth: TAGS_WORLD_DEPTH * initialScale.z,
                        };
                      }),
                      hoverState: npmHoverState,
                      dotMesh: npmDotMesh,
                      boxMesh: npmBoxMesh,
                      controllerPosition,
                      controllerRotation,
                    });
                  }
                });
              }
            };
            const _updateTrashAnchor = () => {
              const {gamepads} = webvr.getStatus();
              const {position: trashPosition, rotation: trashRotation, scale: trashScale} = _decomposeObjectMatrixWorld(trashMesh);
              const trashBoxTarget = geometryUtils.makeBoxTarget(trashPosition, trashRotation, trashScale, new THREE.Vector3(0.2, 0.4, 0.2));

              SIDES.forEach(side => {
                const trashState = trashStates[side];
                const gamepad = gamepads[side];

                const hovered = (() => {
                  if (gamepad) {
                    const {position: controllerPosition} = gamepad;

                    return trashBoxTarget.containsPoint(controllerPosition);
                  } else {
                    return false;
                  }
                })();
                trashState.hovered = hovered;

                const pointed = (() => {
                  if (gamepad) {
                    const {position: controllerPosition, rotation: controllerRotation} = gamepad;
                    const controllerLine = geometryUtils.makeControllerLine(controllerPosition, controllerRotation);

                    return trashBoxTarget.intersectLine(controllerLine);
                  } else {
                    return false;
                  }
                })();
                trashState.pointed = pointed;
              });

              const {highlightMesh} = trashMesh;
              highlightMesh.visible = SIDES.some(side => {
                const trashState = trashStates[side];
                const {hovered, pointed} = trashState;
                return hovered || pointed;
              });
            };
            const _updateEquipmentPositions = () => {
              const _updateUserEquipmentPositions = ({
                equipmentTagMeshes,
                hmd,
                gamepads,
                bagMesh,
              }) => {
                bagMesh.updateMatrixWorld();
                const {equipmentBoxMeshes} = bagMesh;

                // hmd
                for (let i = 0; i < 1 && i < equipmentTagMeshes.length; i++) {
                  const equipmentTagMesh = equipmentTagMeshes[i];

                  if (equipmentTagMesh) {
                    const {item} = equipmentTagMesh;
                    const {attributes} = item;

                    if (attributes.position) {
                      const {position, rotation, scale} = hmd;
                      item.setAttribute('position', position.toArray().concat(rotation.toArray()).concat(scale.toArray()));
                    }
                  }
                }

                // body
                for (let i = 1; i < 2 && i < equipmentTagMeshes.length; i++) {
                  const equipmentTagMesh = equipmentTagMeshes[i];

                  if (equipmentTagMesh) {
                    const {item} = equipmentTagMesh;
                    const {attributes} = item;

                    if (attributes.position) {
                      const equipmentBoxMesh = equipmentBoxMeshes[i];
                      const {position, rotation, scale} = _decomposeObjectMatrixWorld(equipmentBoxMesh);
                      item.setAttribute('position', position.toArray().concat(rotation.toArray()).concat(scale.toArray()));
                    }
                  }
                }

                // right gamepad
                for (let i = 2; i < 3 && i < equipmentTagMeshes.length; i++) {
                  const equipmentTagMesh = equipmentTagMeshes[i];

                  if (equipmentTagMesh) {
                    const {item} = equipmentTagMesh;
                    const {attributes} = item;

                    if (attributes.position) {
                      const gamepad = gamepads.right;

                      if (gamepad) {
                        const {position, rotation, scale} = gamepad;
                        const newQuaternion = rotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0, camera.rotation.order)));
                        item.setAttribute('position', position.toArray().concat(newQuaternion.toArray()).concat(scale.toArray()));
                      }
                    }
                  }
                }

                // left gamepad
                for (let i = 3; i < 4 && i < equipmentTagMeshes.length; i++) {
                  const equipmentTagMesh = equipmentTagMeshes[i];

                  if (equipmentTagMesh) {
                    const {item} = equipmentTagMesh;
                    const {attributes} = item;

                    if (attributes.position) {
                      const gamepad = gamepads.left;

                      if (gamepad) {
                        const {position, rotation, scale} = gamepad;
                        const newQuaternion = rotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0, camera.rotation.order)));
                        item.setAttribute('position', position.toArray().concat(newQuaternion.toArray()).concat(scale.toArray()));
                      }
                    }
                  }
                }

                // right, left pockets
                for (let i = 4; i < 12 && i < equipmentTagMeshes.length; i++) {
                  const equipmentTagMesh = equipmentTagMeshes[i];

                  if (equipmentTagMesh) {
                    const {item} = equipmentTagMesh;
                    const {attributes} = item;

                    if (attributes.position) {
                      const equipmentBoxMesh = equipmentBoxMeshes[i];
                      const {position, rotation, scale} = _decomposeObjectMatrixWorld(equipmentBoxMesh);
                      item.setAttribute('position', position.toArray().concat(rotation.toArray()).concat(scale.toArray()));
                    }
                  }
                }
              };
              const _updateLocalEquipmentPositions = () => {
                const equipmentTagMeshes = equipmentManager.getTagMeshes();
                const {hmd, gamepads} = webvr.getStatus();
                const bagMesh = bag.getBagMesh();

                _updateUserEquipmentPositions({
                  equipmentTagMeshes,
                  hmd,
                  gamepads,
                  bagMesh,
                });
              };
              const _updateRemoteEquipmentPositions = () => {
                const managers = remoteEquipmentManager.getManagers();
                const equipmentTagMeshSpecs = (() => {
                  const result = [];
                  for (let i = 0; i < managers.length; i++) {
                    const manager = managers[i];
                    const {userId} = manager;

                    const userEquipmentManager = remoteEquipmentManager.getManager(userId);
                    const equipmentTagMeshes = userEquipmentManager.getTagMeshes();

                    const remotePlayerStatus = multiplayer.getPlayerStatuses();
                    const {hmd, controllers} = remotePlayerStatus;

                    const remotePlayerMesh = multiplayer.getRemotePlayerMesh(userId);
                    const {bagMesh} = remotePlayerMesh;

                    result.push({
                      equipmentTagMeshes,
                      hmd,
                      gamepads: controllers,
                      bagMesh,
                    });
                  }
                  return result;
                })();

                for (let i = 0; i < equipmentTagMeshSpecs.length; i++) {
                  const equipmentTagMeshSpec = equipmentTagMeshSpecs[i];
                  const {equipmentTagMeshes, hmd, gamepads, bagMesh} = equipmentTagMeshSpec;

                  _updateUserEquipmentPositions({
                    equipmentTagMeshes,
                    hmd,
                    gamepads,
                    bagMesh,
                  });
                }
              };

              _updateLocalEquipmentPositions();
              _updateRemoteEquipmentPositions();
            };
            const _updateHighlight = () => {
              const {gamepads} = webvr.getStatus();

              SIDES.forEach(side => {
                const gamepad = gamepads[side];

                if (gamepad) {
                  const highlightState = highlightStates[side];
                  const {startPoint} = highlightState;

                  const highlightBoxMesh = highlightBoxMeshes[side];
                  if (startPoint) {
                    const {position: currentPoint} = gamepad;

                    const size = currentPoint.clone()
                      .sub(startPoint);
                    size.x = Math.abs(size.x);
                    size.y = Math.abs(size.y);
                    size.z = Math.abs(size.z);

                    if (size.x > 0.001 && size.y > 0.001 && size.z > 0.001) {
                      const midPoint = startPoint.clone()
                        .add(currentPoint)
                        .divideScalar(2);

                      highlightBoxMesh.position.copy(midPoint);
                      highlightBoxMesh.scale.copy(size);
                      if (!highlightBoxMesh.visible) {
                        highlightBoxMesh.visible = true;
                      }
                    } else {
                      if (highlightBoxMesh.visible) {
                        highlightBoxMesh.visible = false;
                      }
                    }
                  } else {
                    if (highlightBoxMesh.visible) {
                      highlightBoxMesh.visible = false;
                    }
                  }
                }
              });
            };

            _updateMenuAnchors();
            _updateGrabbers();
            _updateNpmAnchors();
            _updateTrashAnchor();
            _updateEquipmentPositions();
            _updateHighlight();
          };
          rend.on('update', _update);

          const _updateNpmTagMeshContainer = () => {
            // remove old
            const oldTagMeshes = npmManager.getTagMeshes();
            for (let i = 0; i < oldTagMeshes.length; i++) {
              const oldTagMesh = oldTagMeshes[i];
              oldTagMesh.parent.remove(oldTagMesh);

              tags.destroyTag(oldTagMesh);
            }

            // add new
            const {npmMesh} = worldMesh;
            const {page} = npmState;
            const {tagMeshes} = npmCacheState;
            const aspectRatio = 400 / 150;
            const scale = 1.5;
            const width = 0.2 * scale;
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
                (WORLD_HEIGHT / 2) - (height / 2) - (y * (height + padding)) - 0.2,
                0
              );
              newTagMesh.scale.set(scale, scale, 1);
              newTagMesh.initialScale = newTagMesh.scale.clone();

              npmMesh.add(newTagMesh);

              newTagMeshes.push(newTagMesh);
            }
            npmManager.setTagMeshes(newTagMeshes);
          };

          const _tabchange = tab => {
            if (tab === 'world') {
              npmState.inputText = '';
              npmState.inputIndex = 0;
              npmState.inputValue = 0;

              const {loaded} = npmCacheState;
              if (!loaded) {
                _updateNpm();

                npmCacheState.loaded = true;
              }

              trashMesh.visible = true;
            } else {
              trashMesh.visible = false;
            }
          };
          rend.on('tabchange', _tabchange);

          const _trigger = e => {
            const {side} = e;

            const _clickTrash = () => {
              const grabMesh = grabManager.getMesh(side);
              const trashState = trashStates[side];
              const {pointed} = trashState;

              if (grabMesh && pointed) {
                _removeTag('hand:' + side);

                return true;
              } else {
                return false;
              }
            };
            const _clickGrabNpmTag = () => {
              const {gamepads} = webvr.getStatus();
              const gamepad = gamepads[side];

              if (gamepad) {
                const {buttons: {grip: {pressed: gripPressed}}} = gamepad;

                if (gripPressed) {
                  const npmHoverState = npmHoverStates[side];
                  const {intersectionPoint} = npmHoverState;
                  const grabMesh = grabManager.getMesh(side);

                  if (intersectionPoint && !grabMesh) {
                    const {anchor} = npmHoverState;
                    const onclick = (anchor && anchor.onclick) || '';

                    let match;
                    if (match = onclick.match(/^tag:(.+?)$/)) {
                      const id = match[1];
                      const npmTagMeshes = npmManager.getTagMeshes();
                      const tagMesh = npmTagMeshes.find(tagMesh => tagMesh.item.id === id);

                      const item = _clone(tagMesh.item);
                      item.id = _makeId();
                      _addTag(item, 'hand:' + side);

                      const highlightState = highlightStates[side];
                      highlightState.startPoint = null;

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
              } else {
                return false;
              }
            };
            const _clickGrabWorldTag = () => {
              const {gamepads} = webvr.getStatus();
              const gamepad = gamepads[side];

              if (gamepad) {
                const {buttons: {grip: {pressed: gripPressed}}} = gamepad;

                if (gripPressed) {
                  const grabMesh = grabManager.getMesh(side);
                  const grabbableState = grabbableStates[side];
                  const {pointerMesh: pointerGrabMesh} = grabbableState;

                  if (!grabMesh && pointerGrabMesh) {
                    const tagMesh = pointerGrabMesh;
                    const {item} = tagMesh;
                    const {id} = item;

                    _moveTag('world:' + id, 'hand:' + side);

                    _endHighlight(side);

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
            const _clickMenu = () => {
              const tab = rend.getTab();

              if (tab === 'world') {
                const menuHoverState = menuHoverStates[side];
                const {intersectionPoint} = menuHoverState;

                if (intersectionPoint) {
                  const {anchor} = menuHoverState;
                  const onclick = (anchor && anchor.onclick) || '';

                  let match;
                  if (onclick === 'npm:focus') {
                    const {value} = menuHoverState;
                    const valuePx = value * (WIDTH - (500 + 40));

                    const {index, px} = biolumi.getTextPropertiesFromCoord(npmState.inputText, mainFontSpec, valuePx);

                    npmState.inputIndex = index;
                    npmState.inputValue = px;
                    focusState.type = 'npm';

                    _updatePages();

                    return true;

                  } else if (match = onclick.match(/^npm:(up|down)$/)) {
                    const direction = match[1];

                    npmState.page += (direction === 'up' ? -1 : 1);

                    _updateNpmTagMeshContainer();
                    _updatePages();

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

            _clickTrash() || _clickGrabNpmTag() ||  _clickGrabWorldTag() || _clickMenu();
          };
          input.on('trigger', _trigger, {
            priority: 1,
          });
          const _gripdown = e => {
            const {side} = e;

            const _grabInventoryTagMesh = () => {
              const isOpen = rend.isOpen();

              if (isOpen) {
                const hoveredItemIndex = backpack.getHoveredItemIndex(side);

                if (hoveredItemIndex !== -1) {
                  const inventoryTagMeshes = inventoryManager.getTagMeshes();
                  const hoveredItemTagMesh = inventoryTagMeshes[hoveredItemIndex];
                  const grabMesh = grabManager.getMesh(side);

                  if (hoveredItemTagMesh && !grabMesh) {
                    _moveTag('inventory:' + hoveredItemIndex, 'hand:' + side);

                    e.stopImmediatePropagation();

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
            const _grabEquipmentTagMesh = () => {
              const isOpen = rend.isOpen();

              if (isOpen) {
                const hoveredEquipmentIndex = bag.getHoveredEquipmentIndex(side);

                if (hoveredEquipmentIndex !== -1) {
                  const equipmentTagMeshes = equipmentManager.getTagMeshes();
                  const hoveredEquipmentTagMesh = equipmentTagMeshes[hoveredEquipmentIndex];
                  const grabMesh = grabManager.getMesh(side);

                  if (hoveredEquipmentTagMesh && !grabMesh) {
                    _moveTag('equipment:' + hoveredEquipmentIndex, 'hand:' + side);

                    e.stopImmediatePropagation();

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
            const _grabEquipmentMesh = () => {
              const isOpen = rend.isOpen();

              if (!isOpen) {
                const hoveredEquipmentIndex = bag.getHoveredEquipmentIndex(side);

                if (hoveredEquipmentIndex !== -1) {
                  const equipmentTagMeshes = equipmentManager.getTagMeshes();
                  const hoveredEquipmentTagMesh = equipmentTagMeshes[hoveredEquipmentIndex];
                  const controllerEquipmentIndex = side === 'right' ? 2 : 3;
                  const controllerEquipmentTagMesh = equipmentTagMeshes[controllerEquipmentIndex];

                  if (hoveredEquipmentTagMesh && !controllerEquipmentTagMesh) {
                    _moveTag('equipment:' + hoveredEquipmentIndex, 'equipment:' + controllerEquipmentIndex);

                    e.stopImmediatePropagation();

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
            const _grabWorldTagMesh = () => {
              const isOpen = rend.isOpen();

              if (isOpen) {
                const grabbableState = grabbableStates[side];
                const {hoverMesh: hoverGrabMesh, pointMesh: pointGrabMesh} = grabbableState;
                const grabMesh = hoverGrabMesh || pointGrabMesh;

                if (grabMesh) {
                  const equipmentTagMeshes = equipmentManager.getTagMeshes();

                  if (!equipmentTagMeshes.includes(grabMesh)) {
                    const elementsTagMeshes = elementManager.getTagMeshes();
                    const npmTagMeshes = npmManager.getTagMeshes();

                    if (elementsTagMeshes.includes(grabMesh)) {
                      const tagMesh = grabMesh;
                      const {item} = tagMesh;
                      const {id} = item;
                      _moveTag('world:' + id, 'hand:' + side);

                      e.stopImmediatePropagation();

                      return true;
                    } else if (npmTagMeshes.includes(grabMesh)) {
                      const tagMesh = grabMesh;
                      const item = _clone(tagMesh.item);
                      item.id = _makeId();
                      _addTag(item, 'hand:' + side);

                      e.stopImmediatePropagation();

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
              } else {
                return false;
              }
            };
            const _startHighlight = () => {
              const {gamepads} = webvr.getStatus();
              const gamepad = gamepads[side];

              if (gamepad) {
                const {position: controllerPosition} = gamepad;

                const highlightState = highlightStates[side];
                highlightState.startPoint = controllerPosition.clone();

                return true;
              } else {
                return false;
              }
            };

            _grabInventoryTagMesh() || _grabEquipmentTagMesh() || _grabEquipmentMesh() || _grabWorldTagMesh() || _startHighlight();
          };
          input.on('gripdown', _gripdown);

          const _endHighlight = side => {
            const highlightState = highlightStates[side];
            highlightState.startPoint = null;

            const highlightBoxMesh = highlightBoxMeshes[side];
            highlightBoxMesh.visible = false;
          };

          const _gripup = e => {
            const {side} = e;

            const isOpen = rend.isOpen();

            if (isOpen) {
              const grabMesh = grabManager.getMesh(side);

              if (grabMesh) {
                const _releaseTrashTag = () => {
                  const hovered = SIDES.some(side => trashStates[side].hovered);

                  if (hovered) {
                    _removeTag('hand:' + side);

                    return true;
                  } else {
                    return false;
                  }
                };
                const _releaseInventoryTag = () => {
                  const hoveredItemIndex = backpack.getHoveredItemIndex(side);

                  if (hoveredItemIndex !== -1) {
                    const inventoryTagMeshes = inventoryManager.getTagMeshes();
                    const hoveredItemTagMesh = inventoryTagMeshes[hoveredItemIndex];

                    if (!hoveredItemTagMesh) {
                      _moveTag('hand:' + side, 'inventory:' + hoveredItemIndex);

                      e.stopImmediatePropagation(); // so tags engine doesn't pick it up

                      return true;
                    } else {
                      return false;
                    }
                  } else {
                    return false;
                  }
                };
                const _releaseEquipmentTag = () => {
                  const hoveredEquipmentIndex = bag.getHoveredEquipmentIndex(side);

                  if (hoveredEquipmentIndex !== -1) {
                    const equipmentTagMeshes = equipmentManager.getTagMeshes();
                    const hoveredEquipmentTagMesh = equipmentTagMeshes[hoveredEquipmentIndex];

                    if (!hoveredEquipmentTagMesh) {
                      _moveTag('hand:' + side, 'equipment:' + hoveredEquipmentIndex);

                      return true;
                    } else {
                      return false;
                    }
                  } else {
                    return false;
                  }
                };
                const _releaseWorldTag = () => {
                  const tagMesh = grabMesh;
                  const {position, rotation, scale} = _decomposeObjectMatrixWorld(tagMesh);

                  const matrixArray = position.toArray().concat(rotation.toArray()).concat(scale.toArray());
                  _moveTag('hand:' + side, 'world:' + JSON.stringify(matrixArray));

                  const {item} = tagMesh;
                  const {attributes} = item;
                  if (attributes.position) {
                    const {id} = item;
                    const newValue = position.toArray().concat(rotation.toArray()).concat(scale.toArray());
                    _setTagAttribute('world:' + id, 'position', newValue);
                  }

                  e.stopImmediatePropagation(); // so tags engine doesn't pick it up

                  return true;
                };

                _releaseTrashTag() || _releaseInventoryTag() || _releaseEquipmentTag() || _releaseWorldTag();
              }
            } else {
              const _releaseEquipmentMesh = () => {
                const hoveredEquipmentIndex = bag.getHoveredEquipmentIndex(side);

                if (hoveredEquipmentIndex !== -1) {
                  const equipmentTagMeshes = equipmentManager.getTagMeshes();
                  const hoveredEquipmentTagMesh = equipmentTagMeshes[hoveredEquipmentIndex];
                  const controllerEquipmentIndex = side === 'right' ? 2 : 3;
                  const controllerEquipmentTagMesh = equipmentTagMeshes[controllerEquipmentIndex];

                  if (!hoveredEquipmentTagMesh && controllerEquipmentTagMesh) {
                    _moveTag('equipment:' + controllerEquipmentIndex, 'equipment:' + hoveredEquipmentIndex);

                    e.stopImmediatePropagation();

                    return true;
                  } else {
                    return false;
                  }
                } else {
                  return false;
                }
              };

              _releaseEquipmentMesh();
            }

            _endHighlight(side);
          };
          input.on('gripup', _gripup);

          const _keydown = e => {
            const tab = rend.getTab();

            if (tab === 'world') {
              const {type} = focusState;

              if (type === 'npm') {
                const applySpec = biolumi.applyStateKeyEvent(npmState, mainFontSpec, e);

                if (applySpec) {
                  _updateNpm();

                  const {commit} = applySpec;
                  if (commit) {
                    focusState.type = '';
                  }

                  _updatePages();

                  e.stopImmediatePropagation();
                }
              }
            }
          };
          input.on('keydown', _keydown, {
            priority: 1,
          });
          const _keyboarddown = _keydown;
          input.on('keyboarddown', _keyboarddown, {
            priority: 1,
          });

          const _setAttribute = ({id, attribute, value}) => {
            const src = (() => {
              const _getWorldSrc = () => {
                if (elementManager.getTagMeshes().some(tagMesh => tagMesh.item.id === id)) {
                  return 'world:' + id;
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

              return _getWorldSrc() || _getHandSrc();
            })();

            _setTagAttribute(src, attribute, value);
          };
          tags.on('setAttribute', _setAttribute);

          const _download = ({id, name}) => {
            const a = document.createElement('a');
            a.href = fs.getFileUrl(id);
            a.download = name;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          };
          tags.on('download', _download);

          const _upload = file => {
            if (!login.isOpen()) {
              worldApi.createFile(file)
                .then(tagMesh => {
                  console.log('upoaded file', tagMesh);
                });
            }
          };
          fs.on('upload', _upload);

          let connection = null;
          let connecting = false;
          const _connect = () => {
            if (!connecting) {
              connecting = true;

              Promise.all([
                _requestConnection(),
                _requestStartTime(),
              ])
                .then(([
                  newConnection,
                  startTime,
                ]) => {
                  const shouldBeEnabled = servers.isConnected();

                  if (shouldBeEnabled) {
                    connection = newConnection;
                    connection.onclose = () => {
                      connection = null;
                    };

                    worldTimer.setStartTime(startTime);
                  } else {
                    connection.close();
                  }

                  connecting = false;
                })
                .catch(err => {
                  console.warn(err);

                  connecting = false;
                });
            }
          };
          const _disconnect = () => {
            const _unintializeConnection = () => {
              if (connection) {
                connection.close();
              }
            };
            const _uninitializeTags = () => {
              const _uninitializeElements = () => {
                const elementTagMeshes = elementManager.getTagMeshes().slice();

                for (let i = 0; i < elementTagMeshes.length; i++) {
                  const tagMesh = elementTagMeshes[i];

                  elementManager.remove(tagMesh);

                  tags.destroyTag(tagMesh);
                }
              };
              const _uninitializeEquipment = () => {
                const equipmentTagMeshes = equipmentManager.getTagMeshes().slice();
                const bagMesh = bag.getBagMesh();
                const {equipmentBoxMeshes} = bagMesh;

                for (let i = 0; i < equipmentTagMeshes.length; i++) {
                  const tagMesh = equipmentTagMeshes[i];

                  if (tagMesh) {
                    const equipmentBoxMesh = equipmentBoxMeshes[i];
                    equipmentBoxMesh.remove(tagMesh);

                    equipmentManager.unset(i);

                    tags.destroyTag(tagMesh);
                  }
                }
              };
              const _uninitializeInventory = () => {
                const inventoryTagMeshes = inventoryManager.getTagMeshes().slice();
                const backpackMesh = backpack.getBackpackMesh();
                const {itemBoxMeshes} = backpackMesh

                for (let i = 0; i < inventoryTagMeshes.length; i++) {
                  const tagMesh = inventoryTagMeshes[i];

                  if (tagMesh) {
                    const itemBoxMesh = itemBoxMeshes[i];
                    itemBoxMesh.remove(tagMesh);

                    inventoryManager.unset(i);

                    tags.destroyTag(tagMesh);
                  }
                }
              };

              _uninitializeElements();
              _uninitializeEquipment();
              // _uninitializeFiles();
              _uninitializeInventory();
            };
            const _uninitializeTimer = () => {
              worldTimer.setStartTime(0);
            };

            _unintializeConnection();
            _uninitializeTags();
            _uninitializeTimer();
          };

          const _updateEnabled = () => {
            const enabled = Boolean(connection);
            const shouldBeEnabled = servers.isConnected();

            if (shouldBeEnabled && !enabled) {
              _connect();
            } else if (!shouldBeEnabled && enabled) {
              _disconnect();
            }
          };
          const _connectServer = _updateEnabled;
          rend.on('connectServer', _connectServer);
          const _disconnectServer = _updateEnabled;
          rend.on('disconnectServer', _disconnectServer);

          _updateEnabled();

          this._cleanup = () => {
            remoteGrabManager.destroy();
            remoteEquipmentManager.destroy();

            SIDES.forEach(side => {
              scene.remove(menuDotMeshes[side]);
              scene.remove(menuBoxMeshes[side]);

              scene.remove(npmDotMeshes[side]);
              scene.remove(npmBoxMeshes[side]);

              scene.remove(grabBoxMeshes[side]);
            });

            scene.remove(positioningMesh);
            scene.remove(oldPositioningMesh);

            rend.removeListener('update', _update);
            rend.removeListener('tabchange', _tabchange);

            input.removeListener('trigger', _trigger);
            input.removeListener('gripdown', _gripdown);
            input.removeListener('gripup', _gripup);
            input.removeListener('keydown', _keydown);
            input.removeListener('keyboarddown', _keyboarddown);

            tags.removeListener('download', _download);
            tags.removeListener('setAttribute', _setAttribute);

            fs.removeListener('upload', _upload);

            rend.removeListener('connectServer', _connectServer);
            rend.removeListener('disconnectServer', _disconnectServer);
          };

          const modElementApis = {};
          class WorldApi {
            getWorldTime() {
              return worldTimer.getWorldTime();
            }

            registerElement(pluginInstance, elementApi) {
              const tag = archae.getName(pluginInstance);

              modElementApis[tag] = elementApi;
            }

            unregisterElement(pluginInstance) {
              const tag = archae.getName(pluginInstance);

              delete modElementApis[tag];
            }

            getGrabElement(side) {
              const equipmentTagMeshes = equipmentManager.getTagMeshes();
              const tagMesh = equipmentTagMeshes[side === 'right' ? 2 : 3];

              if (tagMesh) {
                const {item} = tagMesh;
                const {instance} = item;

                return instance;
              } else {
                return null;
              }
            }

            createFile(blob) {
              const id = _makeFileId();
              const {name = _makeId()} = blob;
              const mimeType = (() => {
                const {type: mimeType} = blob;

                if (mimeType) {
                  return mimeType;
                } else {
                  const match = name.match(/\.([^.]+)$/);
                  const suffix = match ? match[1] : 'blank';

                  return 'mime/' + suffix;
                }
              })();
              const matrix = _getInFrontOfCameraMatrix();
              const itemSpec = {
                type: 'file',
                id,
                name,
                mimeType,
                matrix,
              };
              _handleAddTag(localUserId, itemSpec, 'world');

              const elementTagMeshes = elementManager.getTagMeshes();
              const tempTagMesh = elementTagMeshes.find(tagMesh => tagMesh.item.id === id);
              if (!rend.isOpen()) {
                tempTagMesh.visible = false;
              }

              const {item} = tempTagMesh;
              item.instancing = true;

              tags.updatePages();

              const _cleanupTempTagMesh = () => {
                elementManager.remove(tempTagMesh);

                tags.destroyTag(tempTagMesh);
              };

              return new Promise((accept, reject) => {
                fs.writeFile(id, blob)
                  .then(() => {
                    _cleanupTempTagMesh();

                    _addTag(itemSpec, 'world');

                    const elementTagMeshes = elementManager.getTagMeshes();
                    const tagMesh = elementTagMeshes.find(tagMesh => tagMesh.item.id === id);
                    if (!rend.isOpen()) {
                      tagMesh.visible = false;
                    }

                    accept(tagMesh);
                  })
                  .catch(err => {
                    _cleanupTempTagMesh();

                    reject(err);
                  });
              });
            }
          }
          const worldApi = new WorldApi();

          return worldApi;
        }
      });
    }
  }

  unmount() {
    this._cleanup();
  }
}

const _clone = o => JSON.parse(JSON.stringify(o));
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

module.exports = World;
