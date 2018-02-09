const NUM_CELLS_HEIGHT = 128;
const GENERATOR_PLUGIN = 'generator';

const dataSymbol = Symbol();

const hammer = ({recipes, data}) => {
  const {three, pose, input, render, elements, items, player, teleport, utils: {geometry: geometryUtils, sprite: spriteUtils}} = zeo;
  const {THREE, scene, camera} = three;

  const zeroVector = new THREE.Vector3();
  const oneVector = new THREE.Vector3(1, 1, 1);
  const forwardVector = new THREE.Vector3(0, 0, -1);
  const upVector = new THREE.Vector3(0, 1, 0);
  const zeroQuaternion = new THREE.Quaternion();
  const forwardQuaternion = new THREE.Quaternion().setFromUnitVectors(upVector, forwardVector);
  const grabbableQuaternion = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    Math.PI / 4
  ).premultiply(new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(1, 0, 0)
  ));
  const localVector = new THREE.Vector3();

  const dotMeshMaterial = new THREE.MeshBasicMaterial({
    color: 0x2196F3,
    flatShading: true,
  });

  return () => elements.requestElement(GENERATOR_PLUGIN)
    .then(generatorElement => {
      const hammerApi = {
        asset: 'ITEM.HAMMER',
        itemAddedCallback(grabbable) {
          const dotMesh = (() => {
            const geometry = new THREE.ConeBufferGeometry(0.5, 0.5, 3, 1);
            const material = dotMeshMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            mesh.visible = false;
            mesh.destroy = () => {
              geometry.dispose();
            };

            return mesh;
          })();
          scene.add(dotMesh);

          const _grab = e => {
            grabbable.setLocalTransform(zeroVector, grabbableQuaternion, oneVector);
            dotMesh.visible = true;
          };
          grabbable.on('grab', _grab);
          const _release = e => {
            grabbable.setLocalTransform(zeroVector, zeroQuaternion, oneVector);
            dotMesh.visible = false;
          };
          grabbable.on('release', _release);

          const _triggerdown = e => {
            if (dotMesh.visible) {
              const ax = Math.round(dotMesh.position.x);
              const ay = Math.min(Math.max(Math.round(dotMesh.position.y), 0), NUM_CELLS_HEIGHT - 1);
              const az = Math.round(dotMesh.position.z);

              generatorElement.mutateVoxel(ax, ay, az, -2);

              e.stopImmediatePropagation();
            }
          };
          input.on('triggerdown', _triggerdown, {
            priority: -1,
          });

          const _update = () => {
            const {gamepads} = pose.getStatus();

            if (grabbable.isGrabbed()) {
              const side = grabbable.getGrabberSide();
              const gamepad = gamepads[side];
              const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;

              dotMesh.position.copy(controllerPosition)
                .add(
                  localVector.copy(forwardVector)
                    .multiplyScalar(5)
                    .applyQuaternion(controllerRotation)
                );
              dotMesh.quaternion.copy(controllerRotation);
              dotMesh.updateMatrixWorld();
            }
          };
          render.on('update', _update);

          grabbable[dataSymbol] = {
            cleanup: () => {
              scene.remove(dotMesh);
              dotMesh.destroy();

              grabbable.removeListener('grab', _grab);
              grabbable.removeListener('release', _release);

              input.removeListener(_triggerdown, 'triggerdown');

              render.removeListener('update', _update);
            },
          };
        },
        itemRemovedCallback(grabbable) {
          grabbable[dataSymbol].cleanup();

          delete grabbable[dataSymbol];
        },
      };
      items.registerItem(this, hammerApi);

      const hammerRecipe = {
        output: 'ITEM.HAMMER',
        width: 2,
        height: 3,
        input: [
          'ITEM.STONE', 'ITEM.STONE',
          null, 'ITEM.WOOD',
          null, 'ITEM.WOOD',
        ],
      };
      recipes.register(hammerRecipe);

      return () => {
        dotMeshMaterial.dispose();

        elements.destroyListener(elementListener);

        items.unregisterItem(this, hammerApi);
        recipes.unregister(hammerRecipe);
      };
    });
};

module.exports = hammer;
