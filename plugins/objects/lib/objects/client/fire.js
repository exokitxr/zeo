const HEIGHTFIELD_PLUGIN = 'heightfield';
const LIGHTMAP_PLUGIN = 'lightmap';
const HEALTH_PLUGIN = 'health';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const fire = objectApi => {
  const {three, pose, input, render, elements, items} = zeo;
  const {THREE, scene} = three;

  const localVector = new THREE.Vector3();
  const zeroQuaternion = new THREE.Quaternion();

  return () => new Promise((accept, reject) => {
    const fireItemApi = {
      asset: 'ITEM.FIRE',
      itemAddedCallback(grabbable) {
        const _triggerdown = e => {
          const {side} = e;

          if (grabbable.getGrabberSide() === side) {
            const heightfieldElement = elements.getEntitiesElement().querySelector(HEIGHTFIELD_PLUGIN);
            localVector.copy(grabbable.position);
            objectApi.addObject('fire', localVector, zeroQuaternion);

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
    items.registerItem(this, fireItemApi);

    const fires = {};
    let Lightmapper = null;
    let lightmapper = null;
    const _bindLightmap = fire => {
      const shape = new Lightmapper.Sphere(fire.position.x, fire.position.y, fire.position.z, 8, 2, Lightmapper.MaxBlend);
      lightmapper.add(shape);
      fire.shape = shape;
    };
    const _unbindLightmap = fire => {
      lightmapper.remove(fire.shape);
      fire.shape = null;
    };
    const lightmapElementListener = elements.makeListener(LIGHTMAP_PLUGIN);
    lightmapElementListener.on('add', entityElement => {
      Lightmapper = entityElement.Lightmapper;
      lightmapper = entityElement.lightmapper;

      for (let i = 0; i < fires.length; i++) {
        _bindLightmap(fires[i]);
      }
    });
    lightmapElementListener.on('remove', () => {
      Lightmapper = null;
      lightmapper = null;

      for (const id in fires) {
        fires[id].shape = null;
      }
    });

    const fireObjectApi = {
      object: 'fire',
      addedCallback(id, position) {
        const fire = {
          position: position.clone(),
          shape: null,
        };

        if (lightmapper) {
          _bindLightmap(fire);
        }

        fires[id] = fire;
      },
      removedCallback(id) {
        const fire = fires[id];

        if (lightmapper) {
          _unbindLightmap(fire);
        }

        fires[id] = null;
      },
      gripCallback(id, side, x, z, objectIndex) {
        const itemId = _makeId();
        const asset = 'ITEM.FIRE';
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
      collideCallback() {
        const healthElement = elements.getEntitiesElement().querySelector(HEALTH_PLUGIN);
        if (healthElement) {
          healthElement.hurt(10);
        }
      },
    };
    objectApi.registerObject(fireObjectApi);

    accept(() => {
      elements.destroyListener(lightmapElementListener);

      items.unregisterItem(this, fireItemApi);
      objectApi.unregisterObject(fireObjectApi);
    });
  });
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = fire;
