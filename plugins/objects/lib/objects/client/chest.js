const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const chest = objectApi => {
  const {three, elements, pose, input, render, items} = zeo;
  const {THREE, scene, camera, renderer} = three;

  const zeroQuaternion = new THREE.Quaternion();
  const oneVector = new THREE.Vector3(1, 1, 1);
  const localVector = new THREE.Vector3();
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
        objectApi.addObject('chest-open', chest.position, chest.rotation);
      },
      gripBlockCallback(side, x, y, z) {
        const itemId = _makeId();
        const asset = 'ITEM.CHEST';
        const assetInstance = items.makeItem({
          type: 'asset',
          id: itemId,
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
        const chest = {
          x,
          z,
          objectIndex,
          position: position.clone(),
          rotation: rotation.clone(),
        };

        chests[id] = chest;
      },
      removedCallback(id) {
        chests[id] = null;
      },
      triggerCallback(id, side, x, z, objectIndex) {
        const chest = chests[id];

        objectApi.removeObject(x, z, objectIndex);
        objectApi.addObject('chest', chest.position, chest.rotation);
      },
      gripBlockCallback(side, x, y, z) {
        const itemId = _makeId();
        const asset = 'ITEM.CHEST';
        const assetInstance = items.makeItem({
          type: 'asset',
          id: itemId,
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

module.exports = chest;
