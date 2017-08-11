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

  return () => _requestImage('/archae/objects/img/stone.png')
    .then(stoneImg => objectApi.registerTexture('stone', stoneImg))
    .then(() =>
      Promise.all([
        objectApi.registerGeometry('stone', (args) => {
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
        }),
        objectApi.registerGeometry('stone-wall', (args) => {
          const {THREE, getUv} = args;
          const stoneUvs = getUv('stone');
          const uvWidth = stoneUvs[2] - stoneUvs[0];
          const uvHeight = stoneUvs[3] - stoneUvs[1];

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
            uvs[i * 2 + 0] = stoneUvs[0] + (uvs[i * 2 + 0] * uvWidth);
            uvs[i * 2 + 1] = (stoneUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
          }

          return geometry;
        }),
        objectApi.registerGeometry('stone-wall-2', (args) => {
          const {THREE, getUv} = args;
          const stoneUvs = getUv('stone');
          const uvWidth = stoneUvs[2] - stoneUvs[0];
          const uvHeight = stoneUvs[3] - stoneUvs[1];

          const geometry = new THREE.BoxBufferGeometry(2, 1, 1)
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, 1/2, 0));

          const uvs = geometry.getAttribute('uv').array;
          const numUvs = uvs.length / 2;
          for (let i = 0; i < numUvs; i++) {
            uvs[i * 2 + 0] = stoneUvs[0] + (uvs[i * 2 + 0] * uvWidth);
            uvs[i * 2 + 1] = (stoneUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
          }

          return geometry;
        }),
      ])
    )
    .then(() => {
      const stoneItemApi = {
        asset: 'ITEM.STONE',
        itemAddedCallback(grabbable) {
          const _triggerdown = e => {
            const {side} = e;

            if (grabbable.getGrabberSide() === side) {
              const hoveredObject = objectApi.getHoveredObject(side);

              if (hoveredObject && (hoveredObject.is('stone-wall') || hoveredObject.is('stone-wall-2'))) {
                localVector.copy(hoveredObject.position).add(upVector);

                if (!objectApi.getObjectAt(localVector, hoveredObject.rotation)) {
                  hoveredObject.remove();
                  objectApi.addObject('stone-wall-2', hoveredObject.position, hoveredObject.rotation, oneVector);

                  objectApi.addObject('stone-wall-2', localVector, hoveredObject.rotation, oneVector);

                  items.destroyItem(grabbable);
                }
              } else {
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
                objectApi.addObject('stone-wall', localVector, localQuaternion, oneVector);

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
      items.registerItem(this, stoneItemApi);

      const stoneObjectApi = {
        object: 'stone',
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

            object.remove();
          });
        },
        objectRemovedCallback(object) {
          // XXX
        },
      };
      objectApi.registerObject(stoneObjectApi);

      const stoneWallObjectApi = {
        object: 'stone-wall',
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

            object.remove();
          });
        },
        objectRemovedCallback(object) {
          // XXX
        },
      };
      objectApi.registerObject(stoneWallObjectApi);

      const stoneWall2ObjectApi = {
        object: 'stone-wall-2',
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

            object.remove();
          });
        },
        objectRemovedCallback(object) {
          // XXX
        },
      };
      objectApi.registerObject(stoneWall2ObjectApi);

      return () => {
        items.unregisterItem(this, stoneItemApi);
        objectApi.unregisterObject(stoneObjectApi);
        objectApi.unregisterObject(stoneWallObjectApi);
        objectApi.unregisterObject(stoneWall2ObjectApi);
      };
    });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = stone;
