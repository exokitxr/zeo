import {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_DEPTH,
} from './lib/constants/wallet';

const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];
const NUM_POSITIONS = 100 * 1024;
const ROTATE_SPEED = 0.0004;
const SIDES = ['left', 'right'];

class Wallet {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {site: {url: siteUrl}}} = archae;

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
      '/core/engines/world',
      '/core/engines/multiplayer',
      '/core/engines/stck',
      '/core/engines/notification',
      '/core/utils/js-utils',
      '/core/utils/hash-utils',
      '/core/utils/network-utils',
      '/core/utils/creature-utils',
      '/core/utils/sprite-utils',
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
      world,
      multiplayer,
      stck,
      notification,
      jsUtils,
      hashUtils,
      networkUtils,
      creatureUtils,
      spriteUtils,
      vridUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;
        const {murmur} = hashUtils;
        const {AutoWs} = networkUtils;
        const {Grabbable} = hand;
        const {materials: {assets: assetsMaterial}, sfx} = resource;
        const {vridApi} = vridUtils;

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

        const walletState = {
          loading: true,
          error: false,
          inputText: '',
          selectedAsset: {
            left: null,
            right: null,
          },
          assets: [],
          equipments: _arrayify(null, 4),
          numTags: 0,
          page: 0,
        };

        const _requestAssets = () => vridApi.get('assets')
          .then(assets => assets || []);
        const _requestEquipments = () => vridApi.get('equipment')
          .then(equipments => _arrayify(equipments, 4));
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
            walletState.selectedAsset.left = null;
            walletState.selectedAsset.right = null;
            walletState.assets = assets;
            const newEquipments = equipments.filter(equipmentSpec =>
              !equipmentSpec || walletState.assets.some(assetSpec => assetSpec.id === equipmentSpec.id)
            );
            walletState.equipments = newEquipments;
            walletState.numTags = assets.length;

            // _rebindEquipments(oldEquipments, newEquipments);

            // _updatePages();
          })
          .catch(err => {
            console.warn(err);

            walletState.error = true;
          });

        return _refreshAssets()
          .then(() => {
            if (live) {
              const imageDataCanvas = document.createElement('canvas');
              const imageDataCtx = imageDataCanvas.getContext('2d');
              const _requestAssetImageData = assetSpec => (() => {
                if (assetSpec.ext === 'itm') {
                  if (assetSpec.icon) {
                    return new Promise((accept, reject) => {
                      const img = new Image();
                      img.crossOrigin = 'Anonymous';
                      img.onload = () => {
                        imageDataCanvas.width = img.naturalWidth;
                        imageDataCanvas.height = img.naturalHeight;
                        imageDataCtx.drawImage(img, 0, 0);
                        const imageData = imageDataCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
                        accept(imageData.data.buffer);
                      };
                      img.onerror = err => {
                        reject(err);
                      };
                      img.src = 'data:application/octet-stream;base64,' + assetSpec.icon;
                    });
                  } else {
                    return resource.getItemImageData(assetSpec.name);
                  }
                } else /* if (asset.ext === 'files') */ {
                  return resource.getFileImageData(assetSpec.name);
                }
                /* } else if (type === 'mod') {
                  return resource.getModImageData(name);
                } else if (type === 'skin') {
                  return resource.getSkinImageData(name);
                } else {
                  return Promise.resolve(null);
                } */
              })().then(arrayBuffer => ({
                width: 16,
                height: 16,
                data: new Uint8Array(arrayBuffer),
              }));
              const _addStrgAsset = (id, name, ext, path, attributes, icon) => vridApi.get('assets')
                .then(assets => {
                  assets = assets || [];
                  let assetSpec = assets.find(assetSpec => assetSpec.id === id);
                  if (!assetSpec) {
                    assetSpec = {
                      id,
                      name,
                      ext,
                      json: {
                        data: {
                          path,
                          attributes,
                          icon,
                        },
                      },
                    };
                    assets.push(assetSpec);
                  }

                  return vridApi.set('assets', assets);
                });
              const _removeStrgAsset = asset => vridApi.get('assets')
                .then(assets => {
                  assets = assets || [];
                  const assetSpecIndex = assets.findIndex(assetSpec => assetSpec.asset === asset);
                  if (assetSpecIndex !== -1) {
                    assets.splice(assetSpecIndex, 1);
                  }
                  return vridApi.set('assets', assets);
                });

              const _addAsset = (id, type, assetId, name, ext, path, attributes, icon, n, physics, matrix, visible, open) => {
                const position = new THREE.Vector3(matrix[0], matrix[1], matrix[2]);
                const rotation = new THREE.Quaternion(matrix[3], matrix[4], matrix[5], matrix[6]);
                const scale = new THREE.Vector3(matrix[7], matrix[8], matrix[9]);

                const assetInstance = assetsMesh.addAssetInstance(
                  id,
                  type,
                  assetId,
                  name,
                  ext,
                  path,
                  attributes,
                  icon,
                  n,
                  physics,
                  visible,
                  open,
                  position,
                  rotation,
                  scale,
                  zeroVector.clone(),
                  zeroQuaternion.clone(),
                  oneVector.clone()
                );
                _bindAssetInstance(assetInstance);
                _bindAssetInstancePhysics(assetInstance);
                _bindAssetInstanceMenu(assetInstance);
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
                      assetId,
                      name,
                      ext,
                      path,
                      attributes,
                      icon,
                      n,
                      physics,
                      matrix,
                      visible,
                      open,
                    } = assetSpec;

                    _addAsset(id, type, assetId, name, ext, path, attributes, icon, n, physics, matrix, visible, open);
                  }
                } else if (type === 'addAsset') {
                  const {
                    id,
                    type,
                    assetId,
                    name,
                    ext,
                    path,
                    attributes,
                    icon,
                    n,
                    physics,
                    matrix,
                    visible,
                    open,
                  } = args;

                  _addAsset(id, type, assetId, name, ext, path, attributes, icon, n, physics, matrix, visible, open);
                } else if (type === 'removeAsset') {
                  const {
                    id,
                  } = args;

                  const assetInstance = assetsMesh.getAssetInstance(id);
                  _unbindAssetInstance(assetInstance);

                  assetsMesh.removeAssetInstance(id);
                } else if (type === 'setVisible') {
                  const {
                    id,
                    visible,
                  } = args;

                  const assetInstance = assetsMesh.getAssetInstance(id);
                  assetInstance.updateVisible(visible);
                } else if (type === 'setPhysics') {
                  const {
                    id,
                    physics,
                  } = args;

                  const assetInstance = assetsMesh.getAssetInstance(id);
                  assetInstance.updatePhysics(physics);
                } else if (type === 'setOpen') {
                  const {
                    id,
                    open,
                  } = args;

                  const assetInstance = assetsMesh.getAssetInstance(id);
                  assetInstance.updateOpen(open);
                } else {
                  console.warn('wallet got unknown message type:', JSON.stringify(type));
                }
              });

              /* const _isInBody = p => {
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
              }; */

              const _makeHoverState = () => ({
                worldAsset: null,
                worldGrabAsset: null,
              });
              const hoverStates = {
                left: _makeHoverState(),
                right: _makeHoverState(),
              };
              const focusState = {
                keyboardFocusState: null,
              };

              const _saveEquipments = _debounce(next => {
                vridApi.set('equipment', walletState.equipments)
                  .then(() => {
                    next();
                  })
                  .catch(err => {
                    console.warn(err);

                    next();
                  });
              });

              const equipmentApis = {};
              const _rebindEquipments = (oldEquipments, newEquipments) => {
                const removedEquipments = oldEquipments.filter(oldEquipment =>
                  oldEquipment && !newEquipments.some(newEquipment => newEquipment && newEquipment.asset === oldEquipment.asset)
                );
                for (let i = 0; i < removedEquipments.length; i++) {
                  const removedEquipment = removedEquipments[i];
                  _unbindEquipment(removedEquipment);
                }
                const addedEquipments = newEquipments.filter(newEquipment => 
                  newEquipment && !oldEquipments.some(oldEquipment => oldEquipment && oldEquipment.asset === newEquipment.asset)
                );
                for (let i = 0; i < addedEquipments.length; i++) {
                  const addedEquipment = addedEquipments[i];
                  _bindEquipment(addedEquipment);
                }
              };
              const _bindEquipment = assetSpec => {
                const {asset} = assetSpec;
                const equipmentEntry = equipmentApis[asset];

                if (equipmentEntry) {
                  for (let i = 0; i < equipmentEntry.length; i++) {
                    const equipmentApi = equipmentEntry[i];

                    if (typeof equipmentApi.equipmentAddedCallback === 'function') {
                      equipmentApi.equipmentAddedCallback(assetSpec);
                    }
                  }
                }
              };
              const _unbindEquipment = assetSpec => {
                const {asset} = assetSpec;
                const equipmentEntry = equipmentApis[asset];

                if (equipmentEntry) {
                  for (let i = 0; i < equipmentEntry.length; i++) {
                    const equipmentApi = equipmentEntry[i];

                    if (typeof equipmentApi.equipmentRemovedCallback === 'function') {
                      equipmentApi.equipmentRemovedCallback(assetSpec);
                    }
                  }
                }
              };
              const _bindEquipmentApi = equipmentApi => {
                if (typeof equipmentApi.asset === 'string' && typeof equipmentApi.equipmentAddedCallback === 'function') {
                  const {id} = equipmentApi;

                  const assetSpec = walletState.equipments.find(equipmentSpec => equipmentSpec && equipmentSpec.id === id);
                  if (assetSpec) {
                    equipmentApi.equipmentAddedCallback(assetSpec);
                  }
                }
              };
              const _unbindEquipmentApi = equipmentApi => {
                if (typeof equipmentApi.asset === 'string' && typeof equipmentApi.equipmentRemovedCallback === 'function') {
                  const {id} = equipmentApi;

                  const assetSpec = walletState.equipments.find(equipmentSpec => equipmentSpec && equipmentSpec.id === id);
                  if (assetSpec) {
                    equipmentApi.equipmentRemovedCallback(assetSpec);
                  }
                }
              };

              const _makeAssetsMesh = () => {
                const mesh = new THREE.Object3D();

                class AssetInstance extends Grabbable {
                  constructor(
                    id,
                    type,
                    assetId,
                    name,
                    ext,
                    path,
                    attributes,
                    icon,
                    n,
                    physics,
                    visible,
                    open,
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
                    this.assetId = assetId;
                    this.name = name;
                    this.ext = ext;
                    this.path = path;
                    this.attributes = attributes;
                    this.icon = icon;
                    this.physics = physics;
                    this.visible = visible;
                    this.open = open;
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

                        /* if (e2.live) {
                          _checkGripup(e2);
                        } */

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
                    this.visible = true;
                    this.emit('setVisible', true);

                    connection.send(JSON.stringify({
                      method: 'setVisible',
                      args: {
                        id: this.id,
                        visible: true,
                      },
                    }));
                  }

                  hide() {
                    this.visible = false;
                    this.emit('setVisible', false);

                    connection.send(JSON.stringify({
                      method: 'setVisible',
                      args: {
                        id: this.id,
                        visible: false,
                      },
                    }));
                  }

                  setOpen(open) {
                    this.open = open;
                    this.emit('setOpen', open);

                    connection.send(JSON.stringify({
                      method: 'setOpen',
                      args: {
                        id: this.id,
                        open,
                      },
                    }));
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

                  updateVisible(visible) {
                    this.visible = visible;
                    this.emit('setVisible', visible);
                  }

                  updatePhysics(physics) {
                    this.physics = physics;
                    this.emit('physics', physics);
                  }

                  updateOpen(open) {
                    this.open = open;
                    this.emit('setOpen', open);
                  }

                  collide() {
                    this.emit('collide');
                  }
                }

                const assetInstances = [];
                mesh.getAssetInstances = () => assetInstances;
                mesh.getAssetInstance = id => assetInstances.find(assetInstance => assetInstance.id === id);
                mesh.addAssetInstance = (id, type, assetId, name, ext, path, attributes, icon, n, physics, visible, open, position, rotation, scale, localPosition, localRotation, localScale) => {
                  const assetInstance = new AssetInstance(id, type, assetId, name, ext, path, attributes, icon, n, physics, visible, open, position, rotation, scale, localPosition, localRotation, localScale);

                  hand.addGrabbable(assetInstance);
                  assetInstances.push(assetInstance);

                  const mesh = (() => {
                    let live = true;

                    const geometry = (() => {
                      _requestAssetImageData({name, ext, path, attributes, icon})
                        .then(imageData => spriteUtils.requestSpriteGeometry(imageData, pixelSize))
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
                    mesh.visible = assetInstance.visible;
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
                  assetInstance.on('setVisible', visible => {
                    mesh.visible = visible;
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

              const itemApis = {};
              const _bindAssetInstance = assetInstance => {
                const {path} = assetInstance;
                const itemEntry = itemApis[path];

                if (itemEntry) {
                  for (let i = 0; i < itemEntry.length; i++) {
                    const itemApi = itemEntry[i];

                    if (typeof itemApi.itemAddedCallback === 'function') {
                      itemApi.itemAddedCallback(assetInstance);
                    }

                    if (typeof itemApi.itemAttributeValueChangedCallback === 'function') {
                      const {attributes} = assetInstance;

                      for (const name in attributes) {
                        const {value} = attributes[name];
                        itemApi.itemAttributeValueChangedCallback(assetInstance, name, null, value);
                      }
                    }
                  }
                }
              };
              const _unbindAssetInstance = assetInstance => {
                const {path} = assetInstance;
                const itemEntry = itemApis[path];

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
                if (typeof itemApi.path === 'string') {
                  const {path} = itemApi;
                  const boundAssetInstances = assetsMesh.getAssetInstances()
                    .filter(assetInstance => assetInstance.path === path);

                  if (typeof itemApi.itemAddedCallback === 'function') {
                    for (let i = 0; i < boundAssetInstances.length; i++) {
                      itemApi.itemAddedCallback(boundAssetInstances[i]);
                    }
                  }

                  if (typeof itemApi.itemAttributeValueChangedCallback === 'function') {
                    for (let i = 0; i < boundAssetInstances.length; i++) {
                      const assetInstance = boundAssetInstances[i];
                      const {attributes} = assetInstance;

                      for (const name in attributes) {
                        const {value} = attributes[name];
                        itemApi.itemAttributeValueChangedCallback(assetInstance, name, null, value);
                      }
                    }
                  }
                }
              };
              const _unbindItemApi = itemApi => {
                if (typeof itemApi.path === 'string' && typeof itemApi.itemRemovedCallback === 'function') {
                  const {path} = itemApi;
                  const boundAssetInstances = assetsMesh.getAssetInstances()
                    .filter(assetInstance => assetInstance.path === path);

                  for (let i = 0; i < boundAssetInstances.length; i++) {
                    const assetInstance = boundAssetInstances[i];
                    itemApi.itemRemovedCallback(assetInstance);
                  }
                }
              };

              const _bindAssetInstancePhysics = assetInstance => {
                assetInstance.once('update', () => {
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
                  } else {
                    assetInstance.emit('update');
                  }
                });
              };
              const _bindAssetInstanceMenu = assetInstance => {
                assetInstance.once('update', () => {
                  if (assetInstance.open) {
                    walletApi.emit('menuopen', assetInstance);
                  }

                  assetInstance.on('setOpen', open => {
                    walletApi.emit(open ? 'menuopen' : 'menuclose', assetInstance);
                  });
                });
              };

              const _pullItem = (assetSpec, side) => {
                const {id, name, ext, path, attributes, icon = null} = assetSpec;
                const itemSpec = {
                  type: 'asset',
                  id: _makeId(),
                  name: name + '.' + ext,
                  displayName: name + '.' + ext,
                  attributes: {
                    type: {value: 'asset'},
                    id: {value: id},
                    name: {value: name},
                    ext: {value: ext},
                    path: {value: path},
                    attributes: {value: attributes},
                    icon: {value: icon},
                    position: {value: DEFAULT_MATRIX},
                    physics: {value: false},
                    visible: {value: true},
                    open: {value: false},
                  },
                  metadata: {},
                };
                const assetInstance = walletApi.makeItem(itemSpec);
                assetInstance.grab(side);

                /* const {assets: oldAssets} = walletState;
                _removeStrgAsset(asset)
                  .then(() => { */
                    const {assets: newAssets} = walletState;

                    /* if (oldAssets === newAssets) { */
                      const index = newAssets.findIndex(assetSpec => assetSpec.path === path);
                      if (index !== -1) {
                        newAssets.splice(index, 1);

                        const {equipments} = walletState;
                        let removed = false;
                        for (let i = 0; i < equipments.length; i++) {
                          const equipmentSpec = equipments[i];
                          if (equipmentSpec && equipmentSpec.path === path) {
                            equipments[i] = null;
                            removed = true;
                          }
                        }
                        if (removed) {
                          _saveEquipments();
                        }

                        // _updatePages();
                      }
                    /* }
                  })
                  .catch(err => {
                    console.warn(err);
                  }); */

                /* const match = asset.match(/^MOD\.(.+)$/);
                if (match) {
                  const modName = match[1];
                  world.addMod(modName);
                } */

                sfx.drop.trigger();
                const newNotification = notification.addNotification(`Pulled out ${name}.${ext}.`);
                setTimeout(() => {
                  notification.removeNotification(newNotification);
                }, 3000);
              };
              const _storeItem = assetInstance => {
                walletApi.destroyItem(assetInstance);

                const {type} = assetInstance;
                if (type === 'asset') {
                  const {assetId, name, ext, path, attributes, icon} = assetInstance;
                  const {assets: oldAssets} = walletState;
                  _addStrgAsset(assetId, name, ext, path, attributes, icon)
                    .then(() => {
                      const {assets: newAssets} = walletState;

                      if (oldAssets === newAssets) {
                        let newAsset = newAssets.find(assetSpec => assetSpec.id === assetId);
                        if (!newAsset) {
                          newAsset = {
                            id: assetId,
                            name,
                            ext,
                            json: {
                              data: {
                                path,
                                icon,
                                attributes,
                              },
                            },
                          };
                          newAssets.push(newAsset);
                        }

                        // _updatePages();
                      }
                    })
                    .then(() => {
                      walletApi.emit('assets', walletState.assets);
                    })
                    .catch(err => {
                      console.warn(err);
                    });

                  sfx.drop.trigger();
                  const newNotification = notification.addNotification(`Stored ${name}.${ext}.`);
                  setTimeout(() => {
                    notification.removeNotification(newNotification);
                  }, 3000);
                } /* else if (type === 'file') {
                  const {id, value} = assetInstance;
                  const {id: n, name} = value;
                  const file = fs.makeRemoteFile(n);
                  const url = file.getUrl();
                  file.readAsArrayBuffer()
                    .then(arrayBuffer => {
                      const _makeNotificationText = n => {
                        let s = 'Uploading ' + (n * 100).toFixed(1) + '% [';
                        let i;
                        const roundN = Math.round(n * 20);
                        for (i = 0; i < roundN; i++) {
                          s += '|';
                        }
                        for (; i < 20; i++) {
                          s += '.';
                        }
                        s += ']';
                        return s;
                      };
                      const newNotification = notification.addNotification(_makeNotificationText(0));

                      vridApi.upload(n, arrayBuffer, progress => {
                        newNotification.set(_makeNotificationText(progress));
                      })
                        .then(() => {
                          notification.removeNotification(newNotification);
                        })
                        .catch(err => {
                          notification.removeNotification(newNotification);

                          return Promise.reject(err);
                        });
                    })
                    .then(() => vridApi.get('assets'))
                    .then(assets => {
                      assets = assets || [];

                      const assetSpec = {
                        id,
                        asset: 'ITEM.FILE',
                        file: {
                          id: n,
                          name,
                        },
                        timestamp: Date.now(),
                      };
                      assets.push(assetSpec);

                      return vridApi.set('assets', assets);
                    })
                    .then(() => {
                       walletApi.emit('assets', assets);
                    })
                    .catch(err => {
                      console.warn(err);
                    });

                  sfx.drop.trigger();
                  const newNotification = notification.addNotification(`Stored ${name}.`);
                  setTimeout(() => {
                    notification.removeNotification(newNotification);
                  }, 3000);
                } */
              };

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

              cleanups.push(() => {
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
                      id: {value: assetId},
                      name: {value: name},
                      ext: {value: ext},
                      path: {value: path},
                      attributes: {value: attributes},
                      icon: {value: icon},
                      position: {value: matrix},
                      physics: {value: physics},
                      visible: {value: visible},
                      open: {value: open},
                    },
                  } = itemSpec;
                  const n = murmur(id);
                  const position = new THREE.Vector3(matrix[0], matrix[1], matrix[2]);
                  const rotation = new THREE.Quaternion(matrix[3], matrix[4], matrix[5], matrix[6]);
                  const scale = new THREE.Vector3(matrix[7], matrix[8], matrix[9]);

                  const assetInstance = assetsMesh.addAssetInstance(
                    id,
                    type,
                    assetId,
                    name,
                    ext,
                    path,
                    attributes,
                    icon,
                    n,
                    physics,
                    visible,
                    open,
                    position,
                    rotation,
                    scale,
                    zeroVector.clone(),
                    zeroQuaternion.clone(),
                    oneVector.clone()
                  );
                  _bindAssetInstance(assetInstance);
                  _bindAssetInstancePhysics(assetInstance);
                  _bindAssetInstanceMenu(assetInstance);

                  connection.send(JSON.stringify({
                    method: 'addAsset',
                    args: {
                      id,
                      type,
                      assetId,
                      name,
                      ext,
                      path,
                      attributes,
                      icon,
                      n,
                      physics,
                      matrix,
                      visible,
                      open,
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
                  const {name, data, matrix} = fileSpec;
                  const file = fs.makeRemoteFile();
                  return file.write(data).then(() => this.reifyFile({name, file, matrix}));
                }

                reifyFile(fileSpec) {
                  const {name, file, matrix} = fileSpec;
                  const {n} = file;
                  const id = String(n);
                  const itemSpec = {
                    type: 'file',
                    id,
                    name,
                    attributes: {
                      type: {value: 'file'},
                      value: {
                        value: {
                          id: n,
                          name,
                        },
                      },
                      position: {value: matrix},
                      physics: {value: true},
                    },
                    metadata: {},
                  };
                  return walletApi.makeItem(itemSpec);
                }

                getAssetInstances() {
                  return assetsMesh.getAssetInstances();
                }

                getAssets() {
                  return walletState.assets;
                }

                selectAsset(side, asset) {
                  walletState.selectedAsset[side] = asset;
                }

                /* getEquipments() {
                  return walletState.equipments;
                } */

                setEquipment(index, equipment) {
                  walletState.equipments[index] = equipment;

                  const {equipments: oldEquipments} = walletState;
                  const newEquipments = _clone(oldEquipments);
                  newEquipments[index] = _clone(equipment);

                  _rebindEquipments(oldEquipments, newEquipments);

                  walletState.equipments = newEquipments;
                  _saveEquipments();
                }

                pullItem(assetSpec, side) {
                  _pullItem(assetSpec, side);
                }

                storeItem(asset, side) {
                  _storeItem(asset, side);
                }

                registerItem(pluginInstance, itemApi) {
                  const {path} = itemApi;

                  let entry = itemApis[path];
                  if (!entry) {
                    entry = [];
                    itemApis[path] = entry;
                  }
                  entry.push(itemApi);

                  _bindItemApi(itemApi);
                }

                unregisterItem(pluginInstance, itemApi) {
                  const {path} = itemApi;

                  const entry = itemApis[path];
                  entry.splice(entry.indexOf(itemApi), 1);
                  if (entry.length === 0) {
                    delete itemApis[path];
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
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _makeId = () => Math.random().toString(36).substring(7);
const _arrayify = (array, numElements) => {
  array = array || [];

  const result = Array(numElements);
  for (let i = 0; i < numElements; i++) {
    result[i] = array[i] || null;
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

module.exports = Wallet;
