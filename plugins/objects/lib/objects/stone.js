const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const stone = objectApi => {
  const {three, pose, input, render, elements, items} = zeo;
  const {THREE, scene} = three;

  const localVector = new THREE.Vector3();
  const zeroQuaternion = new THREE.Quaternion();
  const oneVector = new THREE.Vector3(1, 1, 1);

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

  return () => _requestImage('/archae/objects/img/stone.png')
    .then(stoneImg => objectApi.registerTexture('stone', stoneImg))
    .then(() => objectApi.registerGeometry('stone', (args) => {
      const {THREE, getUv} = args;
      const stoneUvs = getUv('stone');
      const uvWidth = (stoneUvs[2] - stoneUvs[0]) * 0.25;
      const uvHeight = (stoneUvs[3] - stoneUvs[1]) * 0.25;

      const geometry = new THREE.BoxBufferGeometry(0.3, 0.2, 0.2)
        .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.2/2, 0));
      const uvs = geometry.getAttribute('uv').array;
      const numUvs = uvs.length / 2;
      for (let i = 0; i < numUvs; i++) {
        uvs[i * 2 + 0] = stoneUvs[0] + (uvs[i * 2 + 0] * uvWidth);
        uvs[i * 2 + 1] = (stoneUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
      }

      return geometry;
    }))
    .then(() => {
      const stoneItemApi = {
        asset: 'ITEM.STONE',
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
              objectApi.addObject('stone', localVector, zeroQuaternion, oneVector);

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

      const stoneObjectApi = {
        object: 'stone',
        offset: [0, 0.2/2, 0],
        size: 0.3,
        objectAddedCallback(object) {
          object.on('grip', side => {
            const id = _makeId();
            const asset = 'ITEM.STONE';
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
      objectApi.registerObject(stoneObjectApi);

      objectApi.registerGenerator('stone', (chunk, generateApi) => {
        const localVector = new generateApi.THREE.Vector3();
        const zeroQuaternion = new generateApi.THREE.Quaternion();
        const oneVector = new generateApi.THREE.Vector3(1, 1, 1);

        const itemProbability = 0.05;

        for (let dz = 0; dz < generateApi.NUM_CELLS_OVERSCAN; dz++) {
          for (let dx = 0; dx < generateApi.NUM_CELLS_OVERSCAN; dx++) {
            const v = generateApi.getItemsNoise(chunk.x, chunk.z, dx, dz);

            if (v < itemProbability && (generateApi.getHash(String(v)) % 2) === 0) {
              const elevation = generateApi.getElevation(chunk.x, chunk.z, dx, dz);

              const ax = (chunk.x * generateApi.NUM_CELLS) + dx;
              const az = (chunk.z * generateApi.NUM_CELLS) + dz;
              localVector.set(ax, elevation, az);
              generateApi.addObject(chunk, 'stone', localVector, zeroQuaternion, oneVector);
            }
          }
        }
      });

      return () => {
        items.unregisterItem(this, stoneItemApi);
        objectApi.unregisterObject(stoneObjectApi);
      };
    });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = stone;
