const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const stone = objectApi => {
  const {three, pose, input, render, elements, items} = zeo;
  const {THREE, scene, camera} = three;

  const upVector = new THREE.Vector3(0, 1, 0);
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
    const stoneItemApi = {
      asset: 'ITEM.STONE',
      itemAddedCallback(grabbable) {
        const _triggerdown = e => {
          const {side} = e;

          if (grabbable.getGrabberSide() === side) {
            /* const hoveredObject = objectApi.getHoveredObject(side);

            if (hoveredObject && (hoveredObject.is('stone-wall') || hoveredObject.is('stone-wall-2'))) {
              localVector.copy(hoveredObject.position).add(upVector);

              // if (!objectApi.getObjectAt(localVector, hoveredObject.rotation)) {
                objectApi.removeObject(hoveredObject.x, hoveredObject.z, hoveredObject.objectIndex);
                objectApi.addObject('stone-wall-2', hoveredObject.position, hoveredObject.rotation);

                objectApi.addObject('stone-wall-2', localVector, hoveredObject.rotation);

                items.destroyItem(grabbable);
              // }
            } else {
              const heightfieldElement = elements.getEntitiesElement().querySelector(HEIGHTFIELD_PLUGIN);
              localVector.set(
                grabbable.position.x,
                heightfieldElement ? heightfieldElement.getBestElevation(grabbable.position.x, grabbable.position.z, grabbable.position.y) : 0,
                grabbable.position.z
              );
              localEuler.setFromQuaternion(grabbable.rotation, camera.rotation.order);
              localEuler.x = 0;
              localEuler.z = 0;
              localQuaternion.setFromEuler(localEuler);
              objectApi.addObject('stone-wall', localVector, localQuaternion);

              items.destroyItem(grabbable);
            } */

            objectApi.setBlock(Math.floor(grabbable.position.x), Math.floor(grabbable.position.y), Math.floor(grabbable.position.z), 'house-stone');
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
    items.registerItem(this, stoneItemApi);

    /* const stoneObjectApi = {
      object: 'stone',
      gripCallback(id, side, x, z, objectIndex) {
        const itemId = _makeId();
        const asset = 'ITEM.STONE';
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
    objectApi.registerObject(stoneObjectApi); */

    /* const stoneWallObjectApi = {
      object: 'stone-wall',
      gripCallback(id, side, x, z, objectIndex) {
        const itemId = _makeId();
        const asset = 'ITEM.STONE';
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
    objectApi.registerObject(stoneWallObjectApi);

    const stoneWall2ObjectApi = {
      object: 'stone-wall-2',
      gripCallback(id, side, x, z, objectIndex) {
        const itemId = _makeId();
        const asset = 'ITEM.STONE';
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
    objectApi.registerObject(stoneWall2ObjectApi); */

    accept(() => {
      items.unregisterItem(this, stoneItemApi);
      objectApi.unregisterObject(stoneObjectApi);
      objectApi.unregisterObject(stoneWallObjectApi);
      objectApi.unregisterObject(stoneWall2ObjectApi);
    });
  });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = stone;
