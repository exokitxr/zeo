const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const CRAFT_PLUGIN = 'plugins-craft';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const craftingTable = objectApi => {
  const {three, elements, pose, input, render, items} = zeo;
  const {THREE, scene, camera, renderer} = three;

  const zeroQuaternion = new THREE.Quaternion();
  const oneVector = new THREE.Vector3(1, 1, 1);
  const localVector = new THREE.Vector3();
  const localQuaternion = new THREE.Quaternion();
  const localEuler = new THREE.Euler();
  const craftOffsetVector = new THREE.Vector3(0, 1, 0);

  const craftingTables = [];
  const _bindCrafter = (craftingTable, craftElement) => {
    craftingTable.crafter = craftElement.open(localVector.copy(craftingTable.position).add(craftOffsetVector), zeroQuaternion, oneVector);
  };
  const _unbindCrafter = (craftingTable, craftElement) => {
    craftElement.close(craftingTable.crafter);
    craftingTable.crafter = null;
  };

  const elementListener = elements.makeListener(CRAFT_PLUGIN);
  elementListener.on('add', entityElement => {
    for (let i = 0; i < craftingTables.length; i++) {
      const craftingTable = craftingTables[i];
     _bindCrafter(craftingTable, entityElement);
    }
  });
  elementListener.on('remove', () => {
    for (let i = 0; i < craftingTables.length; i++) {
      const craftingTable = craftingTables[i];
      _unbindCrafter(craftingTable, entityElement);
    }
  });

  return () => new Promise((accept, reject) => {
    const craftingTableItemApi = {
      asset: 'ITEM.CRAFTINGTABLE',
      itemAddedCallback(grabbable) {
        const _triggerdown = e => {
          const {side} = e;

          if (grabbable.getGrabberSide() === side) {
            const heightfieldElement = elements.getEntitiesElement().querySelector(HEIGHTFIELD_PLUGIN);
            localVector.set(
              grabbable.position.x,
              heightfieldElement ? heightfieldElement.getBestElevation(grabbable.position.x, grabbable.position.z, grabbable.position.y) : 0,
              grabbable.position.z
            );
            localEuler.setFromQuaternion(grabbable.rotation, camera.rotation.order);
            localEuler.x = 0;
            localEuler.z = 0;
            localQuaternion.setFromEuler(localEuler);
            objectApi.addObject('craftingTable', localVector, localQuaternion);

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
      addedCallback(id, position) {
        const craftingTable = {
          id,
          position: position.clone(),
          crafter: null,
        };

        const craftElement = elements.getEntitiesElement().querySelector(CRAFT_PLUGIN);
        if (craftElement) {
          _bindCrafter(craftingTable, craftElement);
        }

        craftingTables[id] = craftingTable;
      },
      removedCallback(id) {
        const craftingTable = craftingTable;

        const craftElement = elements.getEntitiesElement().querySelector(CRAFT_PLUGIN);
        if (craftElement) {
          _unbindCrafter(craftingTable, craftElement);
        }

        craftingTables[id] = null;
      },
      triggerCallback(id, side) {
        const craftingTable = craftingTables[id];
        if (craftingTable.crafter) {
          craftingTable.crafter.craft();
        }
      },
      gripCallback(id, side) {
        const itemId = _makeId();
        const asset = 'ITEM.CRAFTINGTABLE';
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
    objectApi.registerObject(craftingTableObjectApi);

    accept(() => {
      items.unregisterItem(this, craftingTableItemApi);
      objectApi.unregisterObject(craftingTableObjectApi);

      // XXX unregister texture/geometry
    });
  });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = craftingTable;
