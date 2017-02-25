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

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/hub',
      '/core/engines/three',
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/cyborg',
      '/core/engines/multiplayer',
      '/core/engines/login',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/engines/tags',
      '/core/engines/fs',
      '/core/engines/mail',
      '/core/engines/bag',
      '/core/engines/backpack',
      '/core/plugins/geometry-utils',
    ]).then(([
      hub,
      three,
      input,
      webvr,
      cyborg,
      multiplayer,
      login,
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
        const solidMaterial = biolumi.getSolidMaterial();

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

        const _requestUis = () => Promise.all([
          biolumi.requestUi({
            width: WIDTH,
            height: HEIGHT,
          }),
          biolumi.requestUi({
            width: WIDTH,
            height: HEIGHT,
          }),
        ])
          .then(([
            worldUi,
            inventoryUi,
          ]) => ({
            worldUi,
            inventoryUi,
          }));

        return _requestUis()
          .then(({
            worldUi,
            inventoryUi,
          }) => {
            if (live) {
              const localUserId = multiplayer.getId();
              const _makeGrabState = () => ({
                mesh: null,
              });
              const grabStates = {
                left: _makeGrabState(),
                right: _makeGrabState(),
              };
              const _makeGrabbableState = () => ({
                mesh: null,
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

              let connection = null;
              const _requestConnection = () => new Promise((accept, reject) => {
                connection = new WebSocket('wss://' + hub.getCurrentServer().url + '/archae/worldWs?id=' + localUserId + '&authentication=' + login.getAuthentication());
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
                connection.onclose = () => {
                  connection = null;

                  console.warn('world connection close');
                };
              });
              const _requestStartTime = () => fetch('https://' + hub.getCurrentServer().url + '/archae/world/start-time.json')
                .then(res => res.json()
                  .then(({startTime}) => startTime)
                );
              const _getInFrontOfCameraMatrix = () => {
                const {hmd} = webvr.getStatus();
                const {position, rotation} = hmd;
                const menuMesh = rend.getMenuMesh();
                const menuMeshMatrixInverse = new THREE.Matrix4().getInverse(menuMesh.matrix);

                const newMatrix = new THREE.Matrix4().compose(
                  position.clone()
                    .add(new THREE.Vector3(0, 0, -0.5).applyQuaternion(rotation)),
                  rotation,
                  new THREE.Vector3(1, 1, 1)
                ).multiply(menuMeshMatrixInverse);
                const {position: newPosition, rotation: newRotation, scale: newScale} = _decomposeMatrix(newMatrix);

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

                  scene.remove(tagMesh);

                  const {type} = item;
                  if (type === 'element') {
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
                          const {attributes} = item;
                          const baseClass = elementApi;

                          const element = menuUtils.makeZeoElement({
                            tag,
                            attributes,
                            baseClass,
                          });
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
              const _moveTag = (src, dst) => {
                _handleMoveTag(localUserId, src, dst);

                _request('moveTag', [localUserId, src, dst], _warnError);
              };
              const _setTagAttribute = (src, attribute, value) => {
                _handleSetTagAttribute(localUserId, src, attribute, value);

                _request('setTagAttribute', [localUserId, src, attribute, value], _warnError);
              };

              const _handleAddTag = (userId, itemSpec, dst) => {
                if (userId === localUserId) {
                  let match;
                  if (dst === 'world') {
                    const tagMesh = tags.makeTag(itemSpec);

                    elementManager.add(tagMesh);
                  } else if (match = dst.match(/^hand:(left|right)$/)) {
                    const side = match[1];

                    const tagMesh = tags.makeTag(itemSpec);

                    const grabState = grabStates[side];
                    grabState.mesh = tagMesh;

                    const controllers = cyborg.getControllers();
                    const controller = controllers[side];
                    const {mesh: controllerMesh} = controller;
                    tagMesh.position.copy(controllerMeshOffset);
                    tagMesh.quaternion.copy(controllerMeshQuaternion);
                    tagMesh.scale.copy(oneVector);
                    controllerMesh.add(tagMesh);
                  } else if (match = dst.match(/^equipment:([0-9]+)$/)) {
                    const equipmentIndex = parseInt(match[1], 10);

                    const tagMesh = tags.makeTag(itemSpec);

                    const bagMesh = bag.getBagMesh();
                    const {equipmentBoxMeshes} = bagMesh;
                    const equipmentBoxMesh = equipmentBoxMeshes[equipmentIndex];
                    equipmentBoxMesh.add(tagMesh);

                    equipmentManager.set(equipmentIndex, tagMesh);
                  } else if (match = dst.match(/^inventory:([0-9]+)$/)) {
                    const inventoryIndex = parseInt(match[1], 10);

                    const tagMesh = tags.makeTag(itemSpec);

                    const backpackMesh = backpack.getBackpackMesh();
                    const {itemBoxMeshes} = backpackMesh;
                    const itemBoxMesh = itemBoxMeshes[inventoryIndex];
                    itemBoxMesh.add(tagMesh);

                    inventoryManager.set(inventoryIndex, tagMesh);
                  } else {
                    console.warn('invalid add tag arguments', {userId, itemSpec, dst});
                  }
                } else {
                  // XXX add tag to remote user's controller mesh
                }
              };
              const _handleMoveTag = (userId, src, dst) => {
                if (userId === localUserId) {
                  let match;
                  if (match = src.match(/^world:(.+)$/)) {
                    const id = match[1];

                    if (match = dst.match(/^hand:(left|right)$/)) {
                      const side = match[1];

                      const tagMesh = elementManager.getTagMesh(id);

                      const grabState = grabStates[side];
                      grabState.mesh = tagMesh;

                      const controllers = cyborg.getControllers();
                      const controller = controllers[side];
                      const {mesh: controllerMesh} = controller;
                      controllerMesh.add(tagMesh);
                      tagMesh.position.copy(controllerMeshOffset);
                      tagMesh.quaternion.copy(controllerMeshQuaternion);
                      tagMesh.scale.copy(oneVector);

                      _unreifyTag(tagMesh);
                    } else {
                      console.warn('invalid move tag arguments', {itemSpec, src, dst});
                    }
                  } else if (match = src.match(/^hand:(left|right)$/)) {
                    const side = match[1];

                    if (match = dst.match(/^world:(.+)$/)) {
                      const matrixArrayString = match[1];
                      const matrixArray = JSON.parse(matrixArrayString);

                      const grabState = grabStates[side];
                      const {mesh} = grabState;
                      mesh.position.set(matrixArray[0], matrixArray[1], matrixArray[2]);
                      mesh.quaternion.set(matrixArray[3], matrixArray[4], matrixArray[5], matrixArray[6]);
                      mesh.scale.set(matrixArray[7], matrixArray[8], matrixArray[9]);

                      elementManager.add(mesh);
                      grabState.mesh = null;
                    } else if (match = dst.match(/^equipment:([0-9]+)$/)) {
                      const equipmentIndex = parseInt(match[1], 10);

                      const grabState = grabStates[side];
                      const {mesh: tagMesh} = grabState;

                      const bagMesh = bag.getBagMesh();
                      const {equipmentBoxMeshes} = bagMesh;
                      const equipmentBoxMesh = equipmentBoxMeshes[equipmentIndex];
                      equipmentBoxMesh.add(tagMesh);
                      tagMesh.position.copy(zeroVector);
                      tagMesh.quaternion.copy(zeroQuaternion);
                      tagMesh.scale.copy(oneVector);

                      equipmentManager.set(equipmentIndex, tagMesh);
                      grabState.mesh = null;
                    } else if (match = dst.match(/^inventory:([0-9]+)$/)) {
                      const inventoryIndex = parseInt(match[1], 10);

                      const grabState = grabStates[side];
                      const {mesh: tagMesh} = grabState;

                      const backpackMesh = backpack.getBackpackMesh();
                      const {itemBoxMeshes} = backpackMesh;
                      const itemBoxMesh = itemBoxMeshes[inventoryIndex];
                      itemBoxMesh.add(tagMesh);
                      tagMesh.position.copy(zeroVector);
                      tagMesh.quaternion.copy(zeroQuaternion);
                      tagMesh.scale.copy(oneVector);

                      inventoryManager.set(inventoryIndex, tagMesh);
                      grabState.mesh = null;
                    } else {
                      console.warn('invalid move tag arguments', {itemSpec, src, dst});
                    }
                  } else if (match = src.match(/^equipment:([0-9]+)$/)) {
                    const srcEquipmentIndex = parseInt(match[1], 10);

                    if (match = dst.match(/^hand:(left|right)$/)) {
                      const side = match[1];

                      const equipmentTagMeshes = equipmentManager.getTagMeshes();
                      const tagMesh = equipmentTagMeshes[srcEquipmentIndex];

                      const grabState = grabStates[side];
                      grabState.mesh = tagMesh;

                      const controllers = cyborg.getControllers();
                      const controller = controllers[side];
                      const {mesh: controllerMesh} = controller;
                      controllerMesh.add(tagMesh);
                      tagMesh.position.copy(controllerMeshOffset);
                      tagMesh.quaternion.copy(controllerMeshQuaternion);
                      tagMesh.scale.copy(oneVector);

                      equipmentManager.unset(srcEquipmentIndex);
                    } else if (match = dst.match(/^equipment:([0-9]+)$/)) {
                      const dstEquipmentIndex = parseInt(match[1], 10);

                      const equipmentTagMeshes = equipmentManager.getTagMeshes();
                      const tagMesh = equipmentTagMeshes[srcEquipmentIndex];

                      const bagMesh = bag.getBagMesh();
                      const {equipmentBoxMeshes} = bagMesh;
                      const equipmentBoxMesh = equipmentBoxMeshes[dstEquipmentIndex];
                      equipmentBoxMesh.add(tagMesh);
                      tagMesh.position.copy(zeroVector);
                      tagMesh.quaternion.copy(zeroQuaternion);
                      tagMesh.scale.copy(oneVector);

                      equipmentManager.move(srcEquipmentIndex, dstEquipmentIndex);
                    } else {
                      console.warn('invalid move tag arguments', {itemSpec, src, dst});
                    }
                  } else if (match = src.match(/^inventory:([0-9]+)$/)) {
                    const inventoryIndex = parseInt(match[1], 10);

                    if (match = dst.match(/^hand:(left|right)$/)) {
                      const side = match[1];

                      const inventoryTagMeshes = inventoryManager.getTagMeshes();
                      const tagMesh = inventoryTagMeshes[inventoryIndex];

                      const grabState = grabStates[side];
                      grabState.mesh = tagMesh;

                      const controllers = cyborg.getControllers();
                      const controller = controllers[side];
                      const {mesh: controllerMesh} = controller;
                      controllerMesh.add(tagMesh);
                      tagMesh.position.copy(controllerMeshOffset);
                      tagMesh.quaternion.copy(controllerMeshQuaternion);
                      tagMesh.scale.copy(oneVector);

                      inventoryManager.unset(inventoryIndex);
                    } else {
                      console.warn('invalid move tag arguments', {itemSpec, src, dst});
                    }
                  } else {
                    console.warn('invalid move tag arguments', {itemSpec, src, dst});
                  }
                } else {
                  // XXX add tag to remote user's controller mesh
                }
              };
              const _handleSetTagAttribute = (userId, src, attribute, value) => {
                if (userId === localUserId) {
                  let match;
                  if (match = src.match(/^world:(.+)$/)) {
                    const id = match[1];

                    const tagMesh = elementManager.getTagMesh(id);
                    const {item} = tagMesh;
                    item.setAttribute(attribute, value);
                  } else {
                    console.warn('invalid set tag attribute arguments', {src, attributeName, attributeValue});
                  }
                } else {
                  // XXX set property on remote user's mesh
                }
              };

              const _requestLocalModSpecs = () => new Promise((accept, reject) => {
                if (npmState.cancelLocalRequest) {
                  npmState.cancelLocalRequest();
                  npmState.cancelLocalRequest = null;
                }

                let live = true;
                npmState.cancelLocalRequest = () => {
                  live = false;
                };

                fetch('https://' + hub.getCurrentServer().url + '/archae/rend/mods/local')
                  .then(res => res.json()
                    .then(modSpecs => {
                      if (live) {
                        accept(modSpecs);

                        npmState.cancelLocalRequest = null;
                      }
                    })
                  )
                  .catch(err => {
                    if (live) {
                      reject(err);

                      npmState.cancelLocalRequest = null;
                    }
                  });
              });

              const npmState = {
                inputText: '',
                inputPlaceholder: 'Search npm modules',
                inputIndex: 0,
                inputValue: 0,
                cancelLocalRequest: null,
                cancelRemoteRequest: null,
                cancelModRequest: null,
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

              worldUi.pushPage(({npm: {inputText, inputPlaceholder, inputValue}, focus: {type}}) => {
                const focus = type === 'npm';

                return [
                  {
                    type: 'html',
                    src: worldRenderer.getWorldPageSrc({inputText, inputPlaceholder, inputValue, focus, onclick: 'npm:focus'}),
                    x: 0,
                    y: 0,
                    w: WIDTH,
                    h: HEIGHT,
                    scroll: true,
                  },
                ];
              }, {
                type: 'world',
                state: {
                  npm: npmState,
                  focus: focusState,
                },
                immediate: true,
              });

              const worldMesh = (() => {
                const result = new THREE.Object3D();
                result.visible = false;

                const menuMesh = (() => {
                  const width = WORLD_WIDTH;
                  const height = WORLD_HEIGHT;
                  const depth = WORLD_DEPTH;

                  const menuMaterial = biolumi.makeMenuMaterial();

                  const geometry = new THREE.PlaneBufferGeometry(width, height);
                  const materials = [solidMaterial, menuMaterial];

                  const mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, materials);
                  mesh.position.z = -1;
                  mesh.receiveShadow = true;
                  mesh.menuMaterial = menuMaterial;

                  const shadowMesh = (() => {
                    const geometry = new THREE.BoxBufferGeometry(width, height, 0.01);
                    const material = transparentMaterial;
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.castShadow = true;
                    return mesh;
                  })();
                  mesh.add(shadowMesh);

                  return mesh;
                })();
                result.add(menuMesh);
                result.menuMesh = menuMesh;

                const npmMesh = (() => {
                  const object = new THREE.Object3D();
                  object.position.z = -1 + 0.01;

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

              const _updatePages = menuUtils.debounce(next => {
                const pages = (() => {
                  const tab = rend.getTab();
                  switch (tab) {
                    case 'world': return worldUi.getPages();
                    default: return [];
                  }
                })();

                if (pages.length > 0) {
                  let pending = pages.length;
                  const pend = () => {
                    if (--pending === 0) {
                      next();
                    }
                  };

                  for (let i = 0; i < pages.length; i++) {
                    const page = pages[i];
                    const {type} = page;

                    if (type === 'world') {
                      page.update({
                        npm: npmState,
                        focus: focusState,
                      }, pend);
                    } else {
                      pend();
                    }
                  }
                } else {
                  next();
                }
              });

              const _update = e => {
                const _updateTextures = () => {
                  const tab = rend.getTab();

                  if (tab === 'world') {
                    const {
                      menuMesh: {
                        menuMaterial,
                      },
                    } = worldMesh;
                    const uiTime = rend.getUiTime();

                    biolumi.updateMenuMaterial({
                      ui: worldUi,
                      menuMaterial,
                      uiTime,
                    });
                  }
                };
                const _updateMenuAnchors = () => {
                  const tab = rend.getTab();

                  if (tab === 'world') {
                    const {menuMesh} = worldMesh;
                    const menuMatrixObject = _decomposeObjectMatrixWorld(menuMesh);
                    const {gamepads} = webvr.getStatus();

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
                            ui: worldUi,
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
                    const _getBestGrabbable = (side, objects) => {
                      const grabState = grabStates[side];
                      const {mesh: grabMesh} = grabState;

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

                    const tagMeshes = elementManager.getTagMeshes().concat(npmManager.getTagMeshes());
                    SIDES.forEach(side => {
                      const grabbableState = grabbableStates[side];
                      const grabBoxMesh = grabBoxMeshes[side];

                      const bestGrabbableTagMesh = _getBestGrabbable(side, tagMeshes);
                      if (bestGrabbableTagMesh) {
                        grabbableState.mesh = bestGrabbableTagMesh;

                        const {position: tagMeshPosition, rotation: tagMeshRotation, scale: tagMeshScale} = _decomposeObjectMatrixWorld(bestGrabbableTagMesh);
                        grabBoxMesh.position.copy(tagMeshPosition);
                        grabBoxMesh.quaternion.copy(tagMeshRotation);
                        grabBoxMesh.scale.copy(tagMeshScale);

                        if (!grabBoxMesh.visible) {
                          grabBoxMesh.visible = true;
                        }
                      } else {
                        grabbableState.mesh = null;

                        if (grabBoxMesh.visible) {
                          grabBoxMesh.visible = false;
                        }
                      }
                    });
                  } else {
                    SIDES.forEach(side => {
                      const grabbableState = grabbableStates[side];
                      const grabBoxMesh = grabBoxMeshes[side];

                      grabbableState.mesh = null;

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
                            if (tagMesh) {
                              const {ui, planeMesh, initialScale = oneVector} = tagMesh;

                              if (ui && planeMesh) {
                                const matrixObject = _decomposeObjectMatrixWorld(planeMesh);

                                return {
                                  matrixObject: matrixObject,
                                  ui: ui,
                                  width: TAGS_WIDTH,
                                  height: TAGS_HEIGHT,
                                  worldWidth: TAGS_WORLD_WIDTH * initialScale.x,
                                  worldHeight: TAGS_WORLD_HEIGHT * initialScale.y,
                                  worldDepth: TAGS_WORLD_DEPTH * initialScale.z,
                                };
                              } else {
                                return null;
                              }
                            } else {
                              return null;
                            }
                          }).filter(object => object !== null),
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
                const _updateEquipmentPositions = () => {
                  const equipmentTagMeshes = equipmentManager.getTagMeshes();

                  const {hmd, gamepads} = webvr.getStatus();

                  const bagMesh = bag.getBagMesh();
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

                _updateTextures();
                _updateMenuAnchors();
                _updateGrabbers();
                _updateNpmAnchors();
                _updateEquipmentPositions();
                _updateHighlight();
              };
              rend.on('update', _update);

              const _tabchange = tab => {
                if (tab === 'world') {
                  npmState.inputText = '';
                  npmState.inputIndex = 0;
                  npmState.inputValue = 0;

                  _requestLocalModSpecs()
                    .then(tagSpecs => tagSpecs.map(tagSpec => {
                      tagSpec.highlight = true;

                      return tags.makeTag(tagSpec);
                    }))
                    .then(tagMeshes => {
                      // remove old
                      const oldTagMeshes = npmManager.getTagMeshes();
                      for (let i = 0; i < oldTagMeshes.length; i++) {
                        const oldTagMesh = oldTagMeshes[i];
                        oldTagMesh.parent.remove(oldTagMesh);

                        tags.destroyTag(oldTagMesh);
                      }

                      // add new
                      const {npmMesh} = worldMesh;
                      const aspectRatio = 400 / 150;
                      const scale = 2;
                      const width = 0.2 * scale;
                      const height = width / aspectRatio;
                      const padding = (WORLD_WIDTH - (TAGS_PER_ROW * width)) / (TAGS_PER_ROW + 1);
                      const newTagMeshes = [];
                      for (let i = 0; i < tagMeshes.length; i++) {
                        const newTagMesh = tagMeshes[i];

                        const x = i % TAGS_PER_ROW;
                        const y = Math.floor(i / TAGS_PER_ROW);
                        newTagMesh.position.set(
                          -(WORLD_WIDTH / 2) + (padding + (width / 2)) + (x * (width + padding)),
                          (WORLD_HEIGHT / 2) - (padding + height) - (padding / 2) - (y * (height + padding)),
                          0
                        );
                        newTagMesh.scale.set(scale, scale, 1);
                        newTagMesh.initialScale = newTagMesh.scale.clone();

                        npmMesh.add(newTagMesh);

                        newTagMeshes.push(newTagMesh);
                      }
                      npmManager.setTagMeshes(newTagMeshes);
                    })
                    .catch(err => {
                      console.warn(err);
                    });
                }
              };
              rend.on('tabchange', _tabchange);

              const _trigger = e => {
                const {side} = e;

                const _clickNpm = () => {
                  const {gamepads} = webvr.getStatus();
                  const gamepad = gamepads[side];

                  if (gamepad) {
                    const {buttons: {grip: {pressed: gripPressed}}} = gamepad;

                    if (gripPressed) {
                      const npmHoverState = npmHoverStates[side];
                      const {intersectionPoint} = npmHoverState;
                      const grabState = grabStates[side];
                      const {mesh: grabMesh} = grabState;

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
                const _clickMenu = () => {
                  const tab = rend.getTab();

                  if (tab === 'world') {
                    const menuHoverState = menuHoverStates[side];
                    const {intersectionPoint} = menuHoverState;

                    if (intersectionPoint) {
                      const {anchor} = menuHoverState;
                      const onclick = (anchor && anchor.onclick) || '';

                      if (onclick === 'npm:focus') {
                        const {value} = menuHoverState;
                        const valuePx = value * (WIDTH - (500 + 40));

                        const {index, px} = biolumi.getTextPropertiesFromCoord(npmState.inputText, mainFontSpec, valuePx);

                        npmState.inputIndex = index;
                        npmState.inputValue = px;
                        focusState.type = 'npm';

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

                _clickNpm() || _clickMenu();
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
                      const grabState = grabStates[side];
                      const {mesh: grabMesh} = grabState;

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
                      const grabState = grabStates[side];
                      const {mesh: grabMesh} = grabState;

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
                    const {mesh: grabMesh} = grabbableState;

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
              input.on('gripdown', _gripdown, {
                priority: 1,
              });
              const _gripup = e => {
                const {side} = e;

                const isOpen = rend.isOpen();

                if (isOpen) {
                  const grabState = grabStates[side];
                  const {mesh: grabMesh} = grabState;

                  if (grabMesh) {
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

                    _releaseInventoryTag() || _releaseEquipmentTag() || _releaseWorldTag();
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

                const _endHighlight = () => {
                  const highlightState = highlightStates[side];
                  highlightState.startPoint = null;

                  const highlightBoxMesh = highlightBoxMeshes[side];
                  highlightBoxMesh.visible = false;
                };
                _endHighlight();
              };
              input.on('gripup', _gripup, {
                priority: 1,
              });

              const _keydown = e => {
                const tab = rend.getTab();

                if (tab === 'world') {
                  const {type} = focusState;

                  if (type === 'npm') {
                    const applySpec = biolum<F2>i.applyStateKeyEvent(npmState, mainFontSpec, e);

                    if (applySpec) {
                      const {commit} = applySpec;

                      if (commit) {
                        const {inputText} = npmState;

                        focusState.type = '';

                        console.log('commit', {inputText}); // XXX actually search here
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
                      const grabState = grabStates[side];
                      const {mesh: grabMesh} = grabState;

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

              const _uploadStart = ({id, name, mimeType}) => {
                const matrix = (() => {
                  const {hmd} = webvr.getStatus();
                  const {position, rotation} = hmd;
                  const menuMesh = rend.getMenuMesh();
                  const menuMeshMatrixInverse = new THREE.Matrix4().getInverse(menuMesh.matrix);

                  const newMatrix = new THREE.Matrix4().compose(
                    position.clone()
                      .add(new THREE.Vector3(0, 0, -0.5).applyQuaternion(rotation)),
                    rotation,
                    new THREE.Vector3(1, 1, 1)
                  ).multiply(menuMeshMatrixInverse);
                  const {position: newPosition, rotation: newRotation, scale: newScale} = _decomposeMatrix(newMatrix);

                  return newPosition.toArray().concat(newRotation.toArray()).concat(newScale.toArray());
                })();
                const file = {
                  id,
                  name,
                  mimeType,
                  matrix,
                };

                const fileMesh = fs.makeFile(file);
                fileMesh.instancing = true;

                scene.add(fileMesh);

                fs.updatePages();
              };
              fs.on('uploadStart', _uploadStart);
              const _uploadEnd = ({id}) => {
                const fileMesh = fs.getFile(id);

                if (fileMesh) {
                  const {file} = fileMesh;
                  file.instancing = false;

                  fs.updatePages();

                  // XXX make file -> world; figure out how to do this in the face of uploads
                  _saveFiles();
                }
              };
              fs.on('uploadEnd', _uploadEnd);

              const _connectServer = () => {
                worldApi.connect();
              };
              rend.on('connectServer', _connectServer);
              const _disconnectServer = () => {
                worldApi.disconnect();
              };
              rend.on('disconnectServer', _disconnectServer);

              this._cleanup = () => {
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

                tags.removeListener('setAttribute', _setAttribute);

                fs.removeListener('uploadStart', _uploadStart);
                fs.removeListener('uploadEnd', _uploadEnd);

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
                  const {name = _makeId(), type: mimeType} = blob;
                  const matrix = _getInFrontOfCameraMatrix();
                  const itemSpec = {
                    type: 'file',
                    id,
                    name,
                    mimeType,
                    matrix,
                  };
                  const tagMesh = tags.makeTag(itemSpec);
                  const {item} = tagMesh;
                  item.instancing = true;

                  elementManager.add(tagMesh);

                  return new Promise((accept, reject) => {
                    fs.writeFile(id, blob)
                      .then(() => {
                        item.instancing = false;

                        tags.updatePages();

                        accept(tagMesh);
                      })
                      .catch(err => {
                        item.instancing = false;

                        tags.updatePages();

                        reject(err);
                      });
                  });

                  // XXX perform an actual tags save via _addTag here
                }

                connect() { // XXX handle race conditions here
                  Promise.all([
                    _requestConnection(),
                    _requestStartTime(),
                  ])
                    .then(([
                      connection,
                      startTime,
                    ]) => {
                      /* const _initializeMails = () => {
                        const mailMesh = mail.makeMail({
                          id: _makeId(),
                          name: 'Explore with me.',
                          author: 'avaer',
                          created: Date.now() - (2 * 60 * 1000),
                          matrix: [
                            0, 1.5, -0.5,
                            0, 0, 0, 1,
                            1, 1, 1,
                          ],
                        });

                        scene.add(mailMesh);
                      }; */

                      // _initializeMails();

                      worldTimer.setStartTime(startTime);
                    })
                    .catch(err => {
                      console.warn(err);
                    });
                }

                disconnect() {
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

                  worldTimer.setStartTime(0);
                }
              }

              const worldApi = new WorldApi();
              return worldApi;
            }
          });
      }
    });
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
