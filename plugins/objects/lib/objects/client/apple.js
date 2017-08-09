const sfxr = require('sfxr');

const HEIGHTFIELD_PLUGIN = 'plugins-heightfield';
const HEALTH_PLUGIN = 'plugins-health';
const DEFAULT_MATRIX = [
  0, 0, 0,
  0, 0, 0, 1,
  1, 1, 1,
];

const dataSymbol = Symbol();

const apple = objectApi => {
  const {three, pose, input, render, elements, items} = zeo;
  const {THREE, scene, camera} = three;

  const zeroQuaternion = new THREE.Quaternion();
  const oneVector = new THREE.Vector3(1, 1, 1);
  const upVector = new THREE.Vector3(0, 1, 0);
  const mouthOffsetVector = new THREE.Vector3(0, -0.1, 0);
  const localVector = new THREE.Vector3();
  const localVector2 = new THREE.Vector3();
  const localQuaternion = new THREE.Quaternion();
  const localEuler = new THREE.Euler();

  const apples = [];

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

  return () => Promise.all([
    _requestImage('/archae/objects/img/apple.png'),
    sfxr.requestSfx('archae/objects/sfx/eat.ogg'),
  ])
    .then(([
      appleImg,
      eatSfx,
    ]) => objectApi.registerTexture('apple', appleImg)
      .then(() => Promise.all([
        objectApi.registerGeometry('apple', (args) => {
          const {THREE, getUv} = args;
          const appleUvs = getUv('apple');
          const uvWidth = appleUvs[2] - appleUvs[0];
          const uvHeight = appleUvs[3] - appleUvs[1];

          const geometry = new THREE.BoxBufferGeometry(0.2, 0.2, 0.2)
            .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.2/2, 0));

          const uvs = geometry.getAttribute('uv').array;
          const numUvs = uvs.length / 2;
          for (let i = 0; i < numUvs; i++) {
            uvs[i * 2 + 0] = appleUvs[0] + (uvs[i * 2 + 0] * uvWidth);
            uvs[i * 2 + 1] = (appleUvs[1] + uvHeight) - (uvs[i * 2 + 1] * uvHeight);
          }

          return geometry;
        }),
      ]))
      .then(() => {
        const appleItemApi = {
          asset: 'ITEM.APPLE',
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
                objectApi.addObject('apple', localVector, localQuaternion, oneVector);

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
          objectAddedCallback(object) {
            object.on('grip', side => {
              const id = _makeId();
              const asset = 'ITEM.APPLE';
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
      })
    );
};
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = apple;
