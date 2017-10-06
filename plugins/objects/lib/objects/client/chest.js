const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const chest = objectApi => {
  const {three, elements, pose, input, render, items} = zeo;
  const {THREE, scene, camera, renderer} = three;

  const zeroQuaternion = new THREE.Quaternion();
  const oneVector = new THREE.Vector3(1, 1, 1);
  const localVector = new THREE.Vector3();
  const localQuaternion = new THREE.Quaternion();
  const localEuler = new THREE.Euler();

  const _getFaceUvIndex = (c, d) => c * 6 * 4 + d * 4;

  const chests = [];

  return () => new Promise((accept, reject) => {
    const chestItemApi = {
      asset: 'ITEM.CHEST',
      itemAddedCallback(grabbable) {
        const _triggerdown = e => {
          const {side} = e;

          if (grabbable.getGrabberSide() === side) {
            localVector.copy(grabbable.position);
            localEuler.setFromQuaternion(grabbable.rotation, camera.rotation.order);
            localEuler.x = 0;
            localEuler.z = 0;
            localQuaternion.setFromEuler(localEuler);
            objectApi.addObject('chest', localVector, localQuaternion);

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
      },
    };
    items.registerItem(this, chestItemApi);

    const chestObjectApi = {
      object: 'chest',
      addedCallback(id, position, rotation, value, x, z, objectIndex) {
        /* const lidGeometry = (() => {
          const geometry = new THREE.BoxBufferGeometry(1, 0.2, 1)
            .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(1, 0, 0),
              -Math.PI / 2
            )))
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, 1, -1/2 - 0.2/2));
          const uvs = geometry.getAttribute('uv').array;
          const numUvs = uvs.length / 2;
          const numFaces = numUvs / 4;
          for (let i = 0; i < numFaces; i++) {
            const faceIndex = i >> 2;

            let chestUvs;
            if (faceIndex === 0) { // right
              chestUvs = chestSideUvs;
            } else if (faceIndex === 1) { // left
              chestUvs = chestSideUvs;
            } else if (faceIndex === 2) { // top
              chestUvs = chestTopUvs;
            } else if (faceIndex === 3) { // bottom
              chestUvs = chestInsideUvs;
            } else if (faceIndex === 4) { // front
              chestUvs = chestFrontUvs;
            } else {
              chestUvs = chestSideUvs;
            }
            const uvWidth = chestUvs[2] - chestUvs[0];
            const uvHeight = chestUvs[3] - chestUvs[1];
            uvs[i * 2 + 0] = chestUvs[0] + (uvs[i * 2 + 0] * uvWidth);
            uvs[i * 2 + 1] = (chestUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
          }

          return geometry;
        })();
        const material = objectApi.getMaterial();
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh); */

        const chest = {
          x,
          z,
          objectIndex,
          // id,
          position: position.clone(),
          rotation: rotation.clone(),
          /* destroy: () => {
            scene.remove(mesh);
          }, */
        };

        chests[id] = chest;
      },
      removedCallback(id) {
        /* const chest = chests[id];
        chest.destroy(); */

        chests[id] = null;
      },
      triggerCallback(id, side, x, z, objectIndex) {
        const chest = chests[id];

        objectApi.removeObject(x, z, objectIndex);
        objectApi.addObject('chest-open', chest.position, chest.rotation);
      },
      gripBlockCallback(side, x, y, z) {
        const itemId = _makeId();
        const asset = 'ITEM.CHEST';
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
    objectApi.registerObject(chestObjectApi);

    const chestOpenObjectApi = {
      object: 'chest-open',
      addedCallback(id, position, rotation, value, x, z, objectIndex) {
        /* const lidGeometry = (() => {
          const geometry = new THREE.BoxBufferGeometry(1, 0.2, 1)
            .applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(1, 0, 0),
              -Math.PI / 2
            )))
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, 1, -1/2 - 0.2/2));
          const uvs = geometry.getAttribute('uv').array;
          const numUvs = uvs.length / 2;
          const numFaces = numUvs / 4;
          for (let i = 0; i < numFaces; i++) {
            const faceIndex = i >> 2;

            let chestUvs;
            if (faceIndex === 0) { // right
              chestUvs = chestSideUvs;
            } else if (faceIndex === 1) { // left
              chestUvs = chestSideUvs;
            } else if (faceIndex === 2) { // top
              chestUvs = chestTopUvs;
            } else if (faceIndex === 3) { // bottom
              chestUvs = chestInsideUvs;
            } else if (faceIndex === 4) { // front
              chestUvs = chestFrontUvs;
            } else {
              chestUvs = chestSideUvs;
            }
            const uvWidth = chestUvs[2] - chestUvs[0];
            const uvHeight = chestUvs[3] - chestUvs[1];
            uvs[i * 2 + 0] = chestUvs[0] + (uvs[i * 2 + 0] * uvWidth);
            uvs[i * 2 + 1] = (chestUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
          }

          return geometry;
        })();
        const material = objectApi.getMaterial();
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh); */

        const chest = {
          x,
          z,
          objectIndex,
          // id,
          position: position.clone(),
          rotation: rotation.clone(),
          /* destroy: () => {
            scene.remove(mesh);
          }, */
        };

        chests[id] = chest;
      },
      removedCallback(id) {
        /* const chest = chests[id];
        chest.destroy(); */

        chests[id] = null;
      },
      triggerCallback(id, side, x, z, objectIndex) {
        const chest = chests[id];

        objectApi.removeObject(x, z, objectIndex);
        objectApi.addObject('chest', chest.position, chest.rotation);
      },
      gripBlockCallback(side, x, y, z) {
        const itemId = _makeId();
        const asset = 'ITEM.CHEST';
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
    objectApi.registerObject(chestOpenObjectApi);

    accept(() => {
      items.unregisterItem(this, chestItemApi);
      objectApi.unregisterObject(chestObjectApi);

      // XXX unregister texture/geometry
    });
  });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = chest;
