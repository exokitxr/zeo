const NPC_PLUGIN = 'plugins-npc';
const SWORD_LENGTH = 0.5;
const dataSymbol = Symbol();

const SWING_TIME = 300;

const sword = ({recipes}) => {
  const {three, pose, input, render, elements, items, teleport} = zeo;
  const {THREE, scene} = three;

  const localPositionVector = new THREE.Vector3(0.015/2 * 3, 0.015 * 6 * 3, 0.015 * 3);
  const localRotationQuaterion = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    Math.PI / 4
  ).premultiply(new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(1, 0, 0)
  ));
  const localScaleVector = new THREE.Vector3(3, 3, 3);
  const zeroVector = new THREE.Vector3();
  const oneVector = new THREE.Vector3(1, 1, 1);
  const zeroQuaternion = new THREE.Quaternion();
  const upQuaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, -1)
  );
  const localQuaternion = new THREE.Quaternion();
  const localQuaternion2 = new THREE.Quaternion();

  let npcElement = null;
  const elementListener = elements.makeListener(NPC_PLUGIN);
  elementListener.on('add', entityElement => {
    npcElement = entityElement;
  });
  elementListener.on('remove', () => {
    npcElement = null;
  });

  return () => {
    const swordApi = {
      asset: 'ITEM.SWORD',
      itemAddedCallback(grabbable) {
        let grabbed = false;
        let swingStartTime = null;
        const _grab = e => {
          grabbable.setLocalTransform(localPositionVector, localRotationQuaterion, localScaleVector);

          grabbed = true;
        };
        grabbable.on('grab', _grab);
        const _release = e => {
          grabbable.setLocalTransform(zeroVector, zeroQuaternion, oneVector);

          grabbed = false;
          swingStartTime = null;
        };
        grabbable.on('release', _release);

        const _triggerdown = e => {
          const {side} = e;
          if (grabbable.getGrabberSide() === side) {
            swingStartTime = Date.now();
          }
        };
        input.on('triggerdown', _triggerdown);

        const ray = new THREE.Ray();
        const direction = new THREE.Vector3();
        const _update = () => {
          const _updateSwingSword = () => {
            if (grabbed && swingStartTime !== null) {
              const now = Date.now();
              const timeDiff = now - swingStartTime;

              if (timeDiff <= SWING_TIME) {
                grabbable.setLocalTransform(
                  localPositionVector,
                  localQuaternion.copy(localRotationQuaterion)
                    .premultiply(
                      localQuaternion2.copy(upQuaternion)
                        .slerp(zeroQuaternion, timeDiff / SWING_TIME)
                    ),
                  localScaleVector
                );

                const {gamepads} = pose.getStatus();
                const side = grabbable.getGrabberSide();
                const gamepad = gamepads[side];
                const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;
              } else {
                swingStartTime = null;
              }
            }
          };
          const _updateHitNpc = () => {
            if (grabbed && npcElement) {
              const {gamepads} = pose.getStatus();
              const side = grabbable.getGrabberSide();
              const gamepad = gamepads[side];
              const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;
              direction.set(0, 0, -1).applyQuaternion(controllerRotation);
              ray.set(controllerPosition, direction);
              const hitNpc = npcElement.getHitNpc(ray, SWORD_LENGTH);

              if (hitNpc) {
                hitNpc.attack();
              }
            }
          };
          _updateSwingSword();
          _updateHitNpc();
        };
        render.on('update', _update);

        grabbable[dataSymbol] = {
          cleanup: () => {
            grabbable.removeListener('grab', _grab);
            grabbable.removeListener('release', _release);

            input.removeListener('triggerdown', _triggerdown);

            render.removeListener('update', _update);
          },
        };
      },
      itemRemovedCallback(grabbable) {
        const {[dataSymbol]: {cleanup}} = grabbable;
        cleanup();

        delete grabbable[dataSymbol];
      },
    };
    items.registerItem(this, swordApi);

    const swordRecipe = {
      output: 'ITEM.SWORD',
      width: 1,
      height: 3,
      input: [
        'ITEM.STONE',
        'ITEM.STONE',
        'ITEM.WOOD',
      ],
    };
    recipes.register(swordRecipe);

    return () => {
      elements.destroyListener(elementListener);

      items.unregisterItem(this, swordApi);
      recipes.unregister(swordRecipe);
    };
  };
};

module.exports = sword;
