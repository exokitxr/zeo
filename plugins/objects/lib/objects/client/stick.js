const HEIGHTFIELD_PLUGIN = 'heightfield';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const stick = objectApi => {
  const {three, pose, input, render, elements, items} = zeo;
  const {THREE, scene, camera} = three;

  const localVector = new THREE.Vector3();
  const localQuaternion = new THREE.Quaternion();
  const localEuler = new THREE.Euler();

  const _requestImage = src => new Promise((accept, reject) => {
    const img = new Image();
    img.onload = () => {
      accept(img);
    };
    img.onerror = err => {
      reject(img);
    };
    img.src = src;
  });

  return () => new Promise((accept, reject) => {
    const stickItemApi = {
      asset: 'ITEM.STICK',
      itemAddedCallback(grabbable) {
        const _triggerdown = e => {
          const {side} = e;

          if (grabbable.getGrabberSide() === side) {
            const heightfieldElement = elements.getEntitiesElement().querySelector(HEIGHTFIELD_PLUGIN);
            localVector.copy(grabbable.position);
            localEuler.setFromQuaternion(grabbable.rotation, camera.rotation.order);
            localEuler.x = 0;
            localEuler.z = 0;
            localQuaternion.setFromEuler(localEuler);
            objectApi.addObject('stick', localVector, localQuaternion);

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

        delete grabbable[dataSymbol];
      },
    };
    items.registerItem(this, stickItemApi);

    const stickObjectApi = {
      object: 'stick',
      gripCallback(id, side, x, z, objectIndex) {
        const itemId = _makeId();
        const asset = 'ITEM.STICK';
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

        objectApi.removeObject(x, z, objectIndex);
      },
    };
    objectApi.registerObject(stickObjectApi);

    accept(() => {
      items.unregisterItem(this, stickItemApi);
      objectApi.unregisterObject(stickObjectApi);
    });
  });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = stick;
