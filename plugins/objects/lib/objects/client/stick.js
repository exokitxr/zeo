const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const stick = objectApi => {
  const {three, pose, input, render, elements, items} = zeo;
  const {THREE, scene, camera} = three;

  const zeroQuaternion = new THREE.Quaternion();
  const oneVector = new THREE.Vector3(1, 1, 1);
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

  return () => _requestImage('/archae/objects/img/wood.png')
    .then(stickImg => objectApi.registerTexture('stick', stickImg))
    .then(() => objectApi.registerGeometry('stick', (args) => {
      const {THREE, getUv} = args;
      const stickUvs = getUv('stick');
      const uvWidth = stickUvs[2] - stickUvs[0];
      const uvHeight = stickUvs[3] - stickUvs[1];

      const width = 0.5;
      const geometry = new THREE.BoxBufferGeometry(width, 0.05, 0.05, 4, 1, 1)
        .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.05/2, 0));
      const positions = geometry.getAttribute('position').array;
      const numPositions = positions.length / 3;
      for (let i = 0; i < numPositions; i++) {
        const x = positions[i * 3 + 0];
        if (x === 0) {
          positions[i * 3 + 2] += 0.05;
        }
      }
      const uvs = geometry.getAttribute('uv').array;
      const numUvs = uvs.length / 2;
      for (let i = 0; i < numUvs; i++) {
        uvs[i * 2 + 0] = stickUvs[0] + (uvs[i * 2 + 0] * uvWidth);
        uvs[i * 2 + 1] = (stickUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
      }

      return geometry;
    }))
    .then(() => {
      const stickItemApi = {
        asset: 'ITEM.STICK',
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

      return () => {
        items.unregisterItem(this, stickItemApi);
        objectApi.unregisterObject(stickObjectApi);
      };
    });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = stick;
