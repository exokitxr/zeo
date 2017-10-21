const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];
const ASSET_POSITIONS = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [-1, -1],
  [0, -1],
  [1, -1],
];

const dataSymbol = Symbol();

const chest = objectApi => {
  const {three, elements, pose, input, render, items} = zeo;
  const {THREE, scene, camera, renderer} = three;

  const zeroQuaternion = new THREE.Quaternion();
  const oneVector = new THREE.Vector3(1, 1, 1);
  const localVector = new THREE.Vector3();
  const localVector2 = new THREE.Vector3();
  const localQuaternion = new THREE.Quaternion();
  const localEuler = new THREE.Euler();

  const chests = [];

  return () => new Promise((accept, reject) => {
    const chestItemApi = {
      asset: 'ITEM.CHEST',
      itemAddedCallback(grabbable) {
        const _triggerdown = e => {
          const {side} = e;

          if (grabbable.getGrabberSide() === side) {
            localVector.copy(grabbable.position);
            localEuler.setFromQuaternion(grabbable.rotation, camera.rotation.order);
            localEuler.x = 0;
            localEuler.z = 0;
            localQuaternion.setFromEuler(localEuler);
            objectApi.addObject('chest', localVector, localQuaternion);

            items.destroyItem(grabbable);

            e.stopImmediatePropagation();
          }
        };
        input.on('triggerdown', _triggerdown);

        grabbable[dataSymbol] = {
          cleanup: () => {
            input.removeListener('triggerdown', _triggerdown);
          },
        };
      },
      itemRemovedCallback(grabbable) {
        const {[dataSymbol]: {cleanup}} = grabbable;
        cleanup();
      },
    };
    items.registerItem(this, chestItemApi);

    const chestObjectApi = {
      object: 'chest',
      addedCallback(id, position, rotation, value, x, z, objectIndex) {
        const chest = {
          x,
          z,
          objectIndex,
          position: position.clone(),
          rotation: rotation.clone(),
          value,
        };

        chests[id] = chest;
      },
      removedCallback(id) {
        /* const chest = chests[id];
        chest.destroy(); */

        chests[id] = null;
      },
      triggerCallback(id, side, x, z, objectIndex) {
        const chest = chests[id];

        objectApi.removeObject(x, z, objectIndex);
        objectApi.addObject('chest-open', chest.position, chest.rotation, chest.value);
      },
      gripBlockCallback(side, x, y, z) {
        const asset = 'ITEM.CHEST';
        const assetInstance = items.makeItem({
          type: 'asset',
          id: _makeId(),
          name: asset,
          displayName: asset,
          attributes: {
            type: {value: 'asset'},
            value: {value: asset},
            position: {value: DEFAULT_MATRIX},
            quantity: {value: 1},
            owner: {value: null},
            bindOwner: {value: null},
            physics: {value: false},
          },
        });
        assetInstance.grab(side);

        objectApi.clearBlock(x, y, z);
      },
    };
    objectApi.registerObject(chestObjectApi);

    const chestOpenObjectApi = {
      object: 'chest-open',
      addedCallback(id, position, rotation, value, x, z, objectIndex) {
        let live = true;
        let assets = [];
        let assetInstances = [];
        const _saveFile = _debounce(next => {
          const file = value !== 0 ? items.getFile(value) : items.getFile();
          file.write(JSON.stringify({
            assets,
          }))
            .then(() => {
              if (value === 0) {
                objectApi.setData(x, z, objectIndex, file.n);
                value = file.n;
              }

              next();
            })
            .catch(err => {
              console.warn(err);

              next();
            });
        });
        const _loadFile = () => {
          if (value !== 0) {
            const file = items.getFile(value);
            file.readAsJson()
              .then(j => {
                if (live) {
                  assets = j.assets;
                  assetInstances = assets.map((assetSpec, i) => {
                    const {id, asset, quantity} = assetSpec;
                    const assetPosition = ASSET_POSITIONS[i];
                    const assetInstance = items.makeItem({
                      type: 'asset',
                      id,
                      name: asset,
                      displayName: asset,
                      attributes: {
                        type: {value: 'asset'},
                        value: {value: asset},
                        position: {value: [position.x + assetPosition[0] * 0.25, position.y + 0.6, position.z + assetPosition[1] * 0.25].concat(rotation.toArray()).concat(oneVector.toArray())},
                        quantity: {value: quantity},
                        owner: {value: null},
                        bindOwner: {value: null},
                        physics: {value: false},
                      },
                    });
                    assetInstance.once('grab', () => {
                      const index = assetInstances.findIndex(assetInstance => assetInstance.id === id);
                      assets.splice(index, 1);
                      assetInstances.splice(index, 1);
                    });
                    return assetInstance;
                  });
                }
              })
              .catch(err => {
                if (live) {
                  console.warn(err);
                }
              });
          }
        };
        _loadFile();

        const chest = {
          x,
          z,
          objectIndex,
          position: position.clone(),
          rotation: rotation.clone(),
          value,
          destroy() {
            live = false;

            _saveFile();

            for (let i = 0; i < assetInstances.length; i++) {
              items.destroyItem(assetInstances[i]);
            }
          },
        };
        chests[id] = chest;
      },
      removedCallback(id) {
        chests[id].destroy();
        chests[id] = null;
      },
      triggerCallback(id, side, x, z, objectIndex) {
        const chest = chests[id];

        objectApi.removeObject(x, z, objectIndex);
        objectApi.addObject('chest', chest.position, chest.rotation, chest.value);
      },
      gripBlockCallback(side, x, y, z) {
        const asset = 'ITEM.CHEST';
        const assetInstance = items.makeItem({
          type: 'asset',
          id: _makeId(),
          name: asset,
          displayName: asset,
          attributes: {
            type: {value: 'asset'},
            value: {value: asset},
            position: {value: DEFAULT_MATRIX},
            quantity: {value: 1},
            owner: {value: null},
            bindOwner: {value: null},
            physics: {value: false},
          },
        });
        assetInstance.grab(side);

        objectApi.clearBlock(x, y, z);
      },
    };
    objectApi.registerObject(chestOpenObjectApi);

    const chestRecipe = {
      output: 'ITEM.CHEST',
      width: 2,
      height: 2,
      input: [
        'ITEM.WOOD', 'ITEM.WOOD',
        'ITEM.WOOD', 'ITEM.WOOD',
      ],
    };
    objectApi.registerRecipe(chestRecipe);

    accept(() => {
      items.unregisterItem(this, chestItemApi);
      objectApi.unregisterObject(chestObjectApi);
      objectApi.unregisterRecipe(chestRecipe);

      // XXX unregister texture/geometry
    });
  });
};
const _makeId = () => Math.random().toString(36).substring(7);
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

module.exports = chest;
