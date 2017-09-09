const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

// const dataSymbol = Symbol();

const house = objectApi => {
  const {three, pose, input, render, elements, items} = zeo;
  const {THREE, scene} = three;

  const localVector = new THREE.Vector3();

  return () => new Promise((accept, reject) => {
    const houseWoodObjectApi = {
      object: 'house-wood',
      gripBlockCallback(side, x, y, z) {
        /* const itemId = _makeId();
        const asset = 'ITEM.WOOD';
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
        assetInstance.grab(side); */

        objectApi.clearBlock(x, y, z);
      },
    };
    objectApi.registerObject(houseWoodObjectApi);

    accept(() => {
      objectApi.unregisterObject(houseWoodObjectApi);
    });
  });
};
// const _makeId = () => Math.random().toString(36).substring(7);

module.exports = house;
