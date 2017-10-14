const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const torch = objectApi => {
  const {three, pose, input, render, elements, items} = zeo;
  const {THREE, scene, camera} = three;

  const localVector = new THREE.Vector3();
  const localQuaternion = new THREE.Quaternion();
  const localEuler = new THREE.Euler();

  return () => new Promise((accept, reject) => {
    const torchItemApi = {
      asset: 'ITEM.TORCH',
      itemAddedCallback(grabbable) {
        const _triggerdown = e => {
          const {side} = e;

          if (grabbable.getGrabberSide() === side) {
            localVector.copy(grabbable.position);
            localEuler.setFromQuaternion(grabbable.rotation, camera.rotation.order);
            localEuler.x = 0;
            localEuler.z = 0;
            localQuaternion.setFromEuler(localEuler);
            objectApi.addObject('torch', localVector, localQuaternion);

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
    items.registerItem(this, torchItemApi);

    const torchObjectApi = {
      object: 'torch',
      addedCallback(id, position) {
        const torch = {
          position,
        };
      },
      /* removedCallback(id) {
      }, */
      gripCallback(id, side, x, z, objectIndex) {
        const itemId = _makeId();
        const asset = 'ITEM.TORCH';
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
    objectApi.registerObject(torchObjectApi);

    const torchRecipe = {
      output: 'ITEM.TORCH',
      width: 1,
      height: 3,
      input: [
        'ITEM.COAL',
        'ITEM.WOOD',
        'ITEM.WOOD',
      ],
    };
    objectApi.registerRecipe(torchRecipe);

    accept(() => {
      elements.destroyListener(lightmapElementListener);

      items.unregisterItem(this, torchItemApi);
      objectApi.unregisterObject(torchObjectApi);

      objectApi.unregisterRecipe(torchRecipe);
    });
  });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = torch;
