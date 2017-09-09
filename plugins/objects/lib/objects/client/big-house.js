const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const bigHouse = objectApi => {
  const {three, pose, input, render, elements, items} = zeo;
  const {THREE, scene} = three;

  const localVector = new THREE.Vector3();

  return () => new Promise((accept, reject) => {
    const bigHouseWoodObjectApi = {
      object: 'big-house-wood',
      gripBlockCallback(side, x, y, z) {
        const itemId = _makeId();
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
        assetInstance.grab(side);

        objectApi.clearBlock(x, y, z);
      },
    };
    objectApi.registerObject(bigHouseWoodObjectApi);

    const bigHouseStoneObjectApi = {
      object: 'big-house-stone',
      gripBlockCallback(side, x, y, z) {
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

        objectApi.clearBlock(x, y, z);
      },
    };
    objectApi.registerObject(bigHouseStoneObjectApi);

    const bigHousePlankObjectApi = {
      object: 'big-house-plank',
      gripBlockCallback(side, x, y, z) {
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

        objectApi.clearBlock(x, y, z);
      },
    };
    objectApi.registerObject(bigHousePlankObjectApi);

    accept(() => {
      objectApi.unregisterObject(bigHouseWoodObjectApi);
      objectApi.unregisterObject(bigHouseStoneObjectApi);
      objectApi.unregisterObject(bigHousePlankObjectApi);
    });
  });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = bigHouse;
