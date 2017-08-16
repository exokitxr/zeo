const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const wood = objectApi => {
  const {three, pose, input, render, elements, items} = zeo;
  const {THREE, scene, camera} = three;

  const zeroQuaternion = new THREE.Quaternion();
  const oneVector = new THREE.Vector3(1, 1, 1);
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

  return () => _requestImage('/archae/objects/img/wood.png')
    .then(woodImg => objectApi.registerTexture('wood', woodImg))
    .then(() => Promise.all([
      objectApi.registerGeometry('wood-wall', (args) => {
        const {THREE, getUv} = args;
        const woodUvs = getUv('wood');
        const uvWidth = woodUvs[2] - woodUvs[0];
        const uvHeight = woodUvs[3] - woodUvs[1];

        const geometry = new THREE.BoxBufferGeometry(2, 1, 1);

        const positions = geometry.getAttribute('position').array;
        const numPositions = positions.length / 3;
        for (let i = 0; i < numPositions; i++) {
          if (positions[i * 3 + 1] > 0) {
            positions[i * 3 + 0] *= 0.75;
            positions[i * 3 + 2] *= 0.75;
          }
        }
        geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 1/2, 0));

        const uvs = geometry.getAttribute('uv').array;
        const numUvs = uvs.length / 2;
        for (let i = 0; i < numUvs; i++) {
          uvs[i * 2 + 0] = woodUvs[0] + (uvs[i * 2 + 0] * uvWidth);
          uvs[i * 2 + 1] = (woodUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
        }

        return geometry;
      }),
      objectApi.registerGeometry('wood-wall-2', (args) => {
        const {THREE, getUv} = args;
        const woodUvs = getUv('wood');
        const uvWidth = woodUvs[2] - woodUvs[0];
        const uvHeight = woodUvs[3] - woodUvs[1];

        const geometry = new THREE.BoxBufferGeometry(2, 1, 0.75)
          .applyMatrix(new THREE.Matrix4().makeTranslation(0, 1/2, 0));

        const uvs = geometry.getAttribute('uv').array;
        const numUvs = uvs.length / 2;
        for (let i = 0; i < numUvs; i++) {
          uvs[i * 2 + 0] = woodUvs[0] + (uvs[i * 2 + 0] * uvWidth);
          uvs[i * 2 + 1] = (woodUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
        }

        return geometry;
      }),
    ]))
    .then(() => {
      const woodItemApi = {
        asset: 'ITEM.WOOD',
        itemAddedCallback(grabbable) {
          const _triggerdown = e => {
            const {side} = e;

            if (grabbable.getGrabberSide() === side) {
              const hoveredObject = objectApi.getHoveredObject(side);

              if (hoveredObject && (hoveredObject.is('wood-wall') || hoveredObject.is('wood-wall-2'))) {
                localVector.copy(hoveredObject.position).add(upVector);

                // if (!objectApi.getObjectAt(localVector, hoveredObject.rotation)) {
                  objectApi.removeObject(hoveredObject.x, hoveredObject.z, hoveredObject.objectIndex);
                  objectApi.addObject('wood-wall-2', hoveredObject.position, hoveredObject.rotation);

                  objectApi.addObject('wood-wall-2', localVector, hoveredObject.rotation);

                  items.destroyItem(grabbable);
                // }
              } else {
                localVector.set(
                  grabbable.position.x,
                  heightfieldElement ? heightfieldElement.getBestElevation(grabbable.position.x, grabbable.position.z, grabbable.position.y) : 0,
                  grabbable.position.z
                );
                localEuler.setFromQuaternion(grabbable.rotation, camera.rotation.order);
                localEuler.x = 0;
                localEuler.z = 0;
                localQuaternion.setFromEuler(localEuler);
                objectApi.addObject('wood-wall', localVector, localQuaternion);

                items.destroyItem(grabbable);
              }

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
      items.registerItem(this, woodItemApi);

      const woodWallObjectApi = {
        object: 'wood-wall',
        gripCallback(id, side, x, z, objectIndex) {
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

          objectApi.removeObject(x, z, objectIndex);
        },
      };
      objectApi.registerObject(woodWallObjectApi);
      const woodWall2ObjectApi = {
        object: 'wood-wall-2',
        gripCallback(id, side, x, z, objectIndex) {
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

          objectApi.removeObject(x, z, objectIndex);
        },
      };
      objectApi.registerObject(woodWall2ObjectApi);

      return () => {
        items.unregisterItem(this, woodItemApi);
        objectApi.unregisterObject(woodWallObjectApi);
        objectApi.unregisterObject(woodWall2ObjectApi);
      };
    });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = wood;
