const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const trees = objectApi => {
  const {three, pose, input, render, elements, items} = zeo;
  const {THREE, scene} = three;

  return () => new Promise((accept, reject) => {
    const treeBlocks = [
      'tree',
      'tree-acacia',
      'tree-aspen',
      'tree-jungle',
      'tree-pine',
    ];
    const treeObjectApis = treeBlocks.map(blockType => {
      const treeObjectApi = {
        object: blockType,
        gripBlockCallback(side, x, y, z) {
          const asset = 'ITEM.WOOD';
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
      objectApi.registerObject(treeObjectApi);

      return treeObjectApi;
    });

    const leafBlocks = [
      'leaf',
      'leaf-acacia',
      'leaf-aspen',
      'leaf-jungle',
      'vine',
    ];
    const leafObjectApis = leafBlocks.map(blockType => {
      const leafObjectApi = {
        object: blockType,
        gripBlockCallback(side, x, y, z) {
          const asset = 'ITEM.STICK';
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
      objectApi.registerObject(leafObjectApi);

      return leafObjectApi;
    });

    accept(() => {
      for (let i = 0; i < treeObjectApis.length; i++) {
        objectApi.unregisterObject(treeObjectApis[i]);
      }
      for (let i = 0; i < leafObjectApis.length; i++) {
        objectApi.unregisterObject(leafObjectApis[i]);
      }
    });
  });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = trees;
