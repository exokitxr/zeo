const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const torch = objectApi => {
  const {three, pose, input, render, elements, items} = zeo;
  const {THREE, scene} = three;

  const localVector = new THREE.Vector3();

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

  return () => _requestImage('/archae/objects/img/torch.png')
    .then(torchImg => objectApi.registerTexture('torch', torchImg))
    .then(() => objectApi.registerGeometry('torch', (args) => {
      const {THREE, getUv} = args;
      const torchUvs = getUv('torch');
      const subUvs = [6/16, 0/16, 10/16, 16/16];
      const torchSubUvs = _getSubUvs(torchUvs, subUvs);
      const uvWidth = torchSubUvs[2] - torchSubUvs[0];
      const uvHeight = torchSubUvs[3] - torchSubUvs[1];

      const geometry = new THREE.BoxBufferGeometry(0.05, 0.3, 0.05)
        .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.1, 0));
      const uvs = geometry.getAttribute('uv').array;
      const numUvs = uvs.length / 2;
      for (let i = 0; i < numUvs; i++) {
        uvs[i * 2 + 0] = torchSubUvs[0] + (uvs[i * 2 + 0] * uvWidth);
        uvs[i * 2 + 1] = (torchSubUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
      }

      function _getSubUvs(a, b) {
        const uvWidthA = a[2] - a[0];
        const uvHeightA = a[3] - a[1];
        return [
          a[0] + (b[0] * uvWidthA),
          a[1] + (b[1] * uvHeightA),
          a[0] + (b[2] * uvWidthA),
          a[1] + (b[3] * uvHeightA),
        ];
      }

      return geometry;
    }))
    .then(() => {
      const torchItemApi = {
        asset: 'ITEM.TORCH',
        itemAddedCallback(grabbable) {
          const _triggerdown = e => {
            const {side} = e;

            if (grabbable.getGrabberSide() === side) {
              const heightfieldElement = elements.getEntitiesElement().querySelector(HEIGHTFIELD_PLUGIN);
              localVector.set(
                grabbable.position.x,
                heightfieldElement ? heightfieldElement.getElevation(grabbable.position.x, grabbable.position.z) : 0,
                grabbable.position.z
              );
              objectApi.addObject('torch', localVector);

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
        offset: [0, 0.3/2, 0],
        size: 0.3,
        objectAddedCallback(object) {
          object.on('grip', side => {
            const id = _makeId();
            const asset = 'ITEM.TORCH';
            const assetInstance = items.makeItem({
              type: 'asset',
              id: id,
              name: asset,
              displayName: asset,
              attributes: {
                position: {value: DEFAULT_MATRIX},
                asset: {value: asset},
                quantity: {value: 1},
                owner: {value: null},
                bindOwner: {value: null},
                physics: {value: false},
              },
            });
            assetInstance.grab(side);

            object.remove();
          });
        },
        objectRemovedCallback(object) {
          // XXX
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
      objectApi.registerRecipe(this, torchRecipe);

      return () => {
        items.unregisterItem(this, torchItemApi);
        objectApi.unregisterObject(torchObjectApi);

        objectApi.unregisterRecipe(this, torchRecipe);
      };
    });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = torch;
