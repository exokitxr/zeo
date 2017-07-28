const dataSymbol = Symbol();

const craftingTable = objectApi => {
  const {three, elements, pose, input, render, stage, items} = zeo;
  const {THREE, scene, camera, renderer} = three;

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

      const geometry = new THREE.BoxBufferGeometry(1, 1, 1);
      const uvs = geometry.getAttribute('uv').array;
      const numUvs = uvs.length / 2;
      for (let i = 0; i < numUvs; i++) {
        uvs[i * 2 + 0] = craftingTableUvs[0] + (uvs[i * 2 + 0] * uvWidth);
        uvs[i * 2 + 1] = craftingTableUvs[1] + (uvs[i * 2 + 1] * uvHeight);
      }

      return geometry;
    }))
    .then(() => {
      const craftingTableApi = {
        asset: 'ITEM.CRAFTINGTABLE',
        itemAddedCallback(grabbable) {
          const _triggerdown = e => {
            const {side} = e;

            if (grabbable.getGrabberSide() === side) {
              objectApi.addObject('craftingTable', grabbable.position);

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
      items.registerItem(this, craftingTableApi);

      return () => {
        items.unregisterItem(this, craftingTableApi);
        // XXX unregister texture/geometry
      };
    });
}

module.exports = craftingTable;
