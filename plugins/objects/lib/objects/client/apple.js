const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const HEALTH_PLUGIN = 'plugins-health';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const apple = objectApi => {
  const {three, pose, input, render, elements, items, sound} = zeo;
  const {THREE, scene, camera} = three;

  const mouthOffsetVector = new THREE.Vector3(0, -0.1, 0);
  const localVector = new THREE.Vector3();
  const localVector2 = new THREE.Vector3();
  const localQuaternion = new THREE.Quaternion();
  const localEuler = new THREE.Euler();

  const apples = [];

  return () => sound.requestSfx('archae/objects/sfx/eat.ogg')
    .then(eatSfx => {
      const appleItemApi = {
        asset: 'ITEM.APPLE',
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
              objectApi.addObject('apple', localVector, localQuaternion);

              items.destroyItem(grabbable);

              e.stopImmediatePropagation();
            }
          };
          input.on('triggerdown', _triggerdown);

          apples.push(grabbable);

          grabbable[dataSymbol] = {
            cleanup: () => {
              input.removeListener('triggerdown', _triggerdown);

              apples.splice(apples.indexOf(grabbable), 1);
            },
          };
        },
        itemRemovedCallback(grabbable) {
          const {[dataSymbol]: {cleanup}} = grabbable;
          cleanup();

          delete grabbable[dataSymbol];
        },
      };
      items.registerItem(this, appleItemApi);

      const appleObjectApi = {
        object: 'apple',
        gripCallback(id, side, x, z, objectIndex) {
          const itemId = _makeId();
          const asset = 'ITEM.APPLE';
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
      objectApi.registerObject(appleObjectApi);

      const _update = () => {
        if (apples.length > 0) {
          const healthElement = elements.getEntitiesElement().querySelector(HEALTH_PLUGIN);

          if (healthElement) {
            const {hmd} = pose.getStatus();
            const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmd;

            for (let i = 0; i < apples.length; i++) {
              const apple = apples[i];

              if (apple.isGrabbed()) {
                const mouthPosition = localVector.copy(hmdPosition)
                  .add(
                    localVector2.copy(mouthOffsetVector)
                      .applyQuaternion(hmdRotation)
                  );
                if (apple.position.distanceTo(mouthPosition) < 0.21) {
                  healthElement.heal(30);

                  items.destroyItem(apple);

                  eatSfx.trigger();
                }
              }
            }
          }
        }
      };
      render.on('update', _update);

      return () => {
        items.unregisterItem(this, appleItemApi);
        objectApi.unregisterObject(appleObjectApi);

        render.removeListener('update', _update);
      };
    });
};

module.exports = apple;
