const CRAFT_PLUGIN = 'plugins-craft';

const dataSymbol = Symbol();

const craftingTable = objectApi => {
  const {three, elements, pose, input, render, stage, items} = zeo;
  const {THREE, scene, camera, renderer} = three;

  const zeroQuaternion = new THREE.Quaternion();
  const oneVector = new THREE.Vector3(1, 1, 1);
  const localVector = new THREE.Vector3();
  const craftOffsetVector = new THREE.Vector3(0, 1.1, 0);

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

  return () => _requestImage('/archae/objects/img/crafting-table.png')
    .then(craftingTableImg => objectApi.registerTexture('craftingTable', craftingTableImg))
    .then(craftingTableImg => objectApi.registerGeometry('craftingTable', (args) => {
      const {THREE, getUv} = args;
      const craftingTableUvs = getUv('craftingTable');
      const uvWidth = craftingTableUvs[2] - craftingTableUvs[0];
      const uvHeight = craftingTableUvs[3] - craftingTableUvs[1];

      const geometry = new THREE.BoxBufferGeometry(1, 1, 1)
        .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.5, 0));
      const uvs = geometry.getAttribute('uv').array;
      const numUvs = uvs.length / 2;
      for (let i = 0; i < numUvs; i++) {
        uvs[i * 2 + 0] = craftingTableUvs[0] + (uvs[i * 2 + 0] * uvWidth);
        uvs[i * 2 + 1] = craftingTableUvs[1] + (uvs[i * 2 + 1] * uvHeight);
      }

      return geometry;
    }))
    .then(() => {
      const craftingTableItemApi = {
        asset: 'ITEM.CRAFTINGTABLE',
        itemAddedCallback(grabbable) {
          const _triggerdown = e => {
            const {side} = e;

            if (grabbable.getGrabberSide() === side) {
              objectApi.addObject('craftingTable', grabbable.position);

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
      items.registerItem(this, craftingTableItemApi);

      const craftingTableObjectApi = {
        object: 'craftingTable',
        objectAddedCallback(object) {
console.log('object added', object); // XXX
          object.on('trigger', () => {
console.log('crafting table triggered');
            const craftElement = elements.getEntitiesElement().querySelector(CRAFT_PLUGIN);
            if (craftElement) {
              craftElement.open(localVector.copy(object.position).add(craftOffsetVector), zeroQuaternion, oneVector);
            }
          });
        },
        objectRemovedCallback(object) {
console.log('object removed', object); // XXX
        },
      };
      objectApi.registerObject(craftingTableObjectApi);

      return () => {
        items.unregisterItem(this, craftingTableItemApi);
        objectApi.unregisterObject(craftingTableObjectApi);

        // XXX unregister texture/geometry
      };
    });
}

module.exports = craftingTable;
