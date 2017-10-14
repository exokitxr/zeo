const NUM_CELLS_HEIGHT = 128;
const GENERATOR_PLUGIN = 'plugins-generator';

const dataSymbol = Symbol();

const pickaxe = ({recipes, data}) => {
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
  const localTransformScaleVector = new THREE.Vector3(3, 3, 3);
  const localVector = new THREE.Vector3();
  const localVector2 = new THREE.Vector3();
  const localQuaternion = new THREE.Quaternion();
  const localMatrix = new THREE.Matrix4();
  const localRay = new THREE.Ray();

  const dotMeshMaterial = new THREE.MeshBasicMaterial({
    color: 0x2196F3,
    // shininess: 0,
    // shading: THREE.FlatShading,
  });

  return () => elements.requestElement(GENERATOR_PLUGIN)
    .then(generatorElement => {
      const pickaxeApi = {
        asset: 'ITEM.PICKAXE',
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

              generatorElement.mutateVoxel(ax, ay, az, 1);

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
          const {[dataSymbol]: {cleanup}} = grabbable;
          cleanup();

          delete grabbable[dataSymbol];
        },
      };
      items.registerItem(this, pickaxeApi);

      const pickaxeRecipe = {
        output: 'ITEM.PICKAXE',
        width: 3,
        height: 3,
        input: [
          'ITEM.STONE', 'ITEM.STONE', 'ITEM.STONE',
          null, 'ITEM.WOOD', null,
          null, 'ITEM.WOOD', null,
        ],
      };
      recipes.register(pickaxeRecipe);

      return () => {
        dotMeshMaterial.dispose();

        elements.destroyListener(elementListener);

        items.unregisterItem(this, pickaxeApi);
        recipes.unregister(pickaxeRecipe);
      };
    });
};

module.exports = pickaxe;
