const mod = require('mod-loop');
const skinJs = require('skin-js');

const SIDES = ['left', 'right'];

const skinUtils = archae => ({
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/three',
    ]).then(([
      three,
    ]) => {
      if (live) {
        const {THREE, camera} = three;
        const skin = skinJs(THREE);

        const upVector = new THREE.Vector3(0, 1, 0);
        const armQuaternionOffset = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1));

        const hmdEuler = new THREE.Euler();
        const playerEuler = new THREE.Euler();
        const meshWorldPosition = new THREE.Vector3();
        const meshEyeWorldPosition = new THREE.Vector3();
        const playerQuaternionInverse = new THREE.Quaternion();
        const headQuaternion = new THREE.Quaternion();
        const headQuaternionInverse = new THREE.Quaternion();
        const localUpVector = new THREE.Vector3();
        const armWorldPosition = new THREE.Vector3();
        const armQuaternion = new THREE.Quaternion();
        const armQuaternionInverse = new THREE.Quaternion();
        const rotationMatrix = new THREE.Matrix4();

        const makePlayerMesh = (skinImg) => {
          const mesh = skin(skinImg, {
            limbs: true,
          });
          const uniforms = THREE.UniformsUtils.clone(skin.SKIN_SHADER.uniforms);

          const _updateLocalTransformUniforms = (hmdPosition, hmdRotation, gamepadsArray) => {
            hmdEuler.setFromQuaternion(hmdRotation, camera.rotation.order);
              playerEuler.setFromQuaternion(mesh.quaternion, camera.rotation.order);
              const angleDiff = _angleDiff(hmdEuler.y, playerEuler.y);
              const angleDiffAbs = Math.abs(angleDiff);
              if (angleDiffAbs > Math.PI / 2) {
                playerEuler.y += (angleDiffAbs - (Math.PI / 2)) * (angleDiff < 0 ? 1 : -1);
                mesh.quaternion.setFromEuler(playerEuler);
              }

              mesh.getWorldPosition(meshWorldPosition);
              mesh.eye.getWorldPosition(meshEyeWorldPosition);
              mesh.position.copy(hmdPosition)
                .sub(meshEyeWorldPosition)
                .add(meshWorldPosition);

              playerQuaternionInverse.copy(mesh.quaternion).inverse();
              headQuaternion.copy(playerQuaternionInverse).multiply(hmdRotation);
              headQuaternionInverse.copy(headQuaternion).inverse();
              uniforms.headRotation.value.set(headQuaternionInverse.x, headQuaternionInverse.y, headQuaternionInverse.z, headQuaternionInverse.w);
              mesh.head.quaternion.copy(headQuaternion);
              mesh.updateMatrixWorld();

              for (let i = 0; i < SIDES.length; i++) {
                const side = SIDES[i];
                const [controllerPosition, controllerRotation] = gamepadsArray[i];
                localUpVector.copy(upVector).applyQuaternion(controllerRotation);
                mesh.arms[side].getWorldPosition(armWorldPosition);
                rotationMatrix.lookAt(
                  armWorldPosition,
                  controllerPosition,
                  localUpVector
                );
                armQuaternion
                  .setFromRotationMatrix(rotationMatrix)
                  .multiply(armQuaternionOffset)
                  .premultiply(playerQuaternionInverse);
                armQuaternionInverse.copy(armQuaternion).inverse();
                const armRotation = uniforms[side === 'left' ? 'leftArmRotation' : 'rightArmRotation'];
                armRotation.value.set(armQuaternionInverse.x, armQuaternionInverse.y, armQuaternionInverse.z, armQuaternionInverse.w);
              }
          };

          mesh.onBeforeRender = (function(onBeforeRender) {
            return function() {
              mesh.material.uniforms.headRotation.value.copy(uniforms.headRotation.value);
              mesh.material.uniforms.leftArmRotation.value.copy(uniforms.leftArmRotation.value);
              mesh.material.uniforms.rightArmRotation.value.copy(uniforms.rightArmRotation.value);
              mesh.material.uniforms.theta.value = uniforms.theta.value;
              mesh.material.uniforms.headVisible.value = uniforms.headVisible.value;
              mesh.material.uniforms.hit.value = uniforms.hit.value;

              onBeforeRender.apply(this, arguments);
            };
          })(mesh.onBeforeRender);
          mesh.update = status => {
            const {
              hmd: {
                worldPosition: hmdPosition,
                worldRotation: hmdRotation,
              },
              gamepads: {
                left: {
                  worldPosition: controllerLeftPosition,
                  worldRotation: controllerLeftRotation,
                },
                right: {
                  worldPosition: controllerRightPosition,
                  worldRotation: controllerRightRotation,
                },
              },
            } = status;
            _updateLocalTransformUniforms(hmdPosition, hmdRotation, [[controllerLeftPosition, controllerLeftRotation], [controllerRightPosition, controllerRightRotation]]);
          };
          const hmdPosition = new THREE.Vector3();
          const hmdRotation = new THREE.Quaternion();
          const controllerLeftPosition = new THREE.Vector3();
          const controllerLeftRotation = new THREE.Quaternion();
          const controllerRightPosition = new THREE.Vector3();
          const controllerRightRotation = new THREE.Quaternion();
          mesh.updateJson = status => {
            const {
              hmd: {
                position: hmdPositionArray,
                rotation: hmdRotationArray,
              },
              controllers: {
                left: {
                  position: controllerLeftPositionArray,
                  rotation: controllerLeftRotationArray,
                },
                right: {
                  position: controllerRightPositionArray,
                  rotation: controllerRightRotationArray,
                },
              },
            } = status;
            _updateLocalTransformUniforms(
              hmdPosition.fromArray(hmdPositionArray),
              hmdRotation.fromArray(hmdRotationArray), [
                [
                  controllerLeftPosition.fromArray(controllerLeftPositionArray),
                  controllerLeftRotation.fromArray(controllerLeftRotationArray),
                ],
                [
                  controllerRightPosition.fromArray(controllerRightPositionArray),
                  controllerRightRotation.fromArray(controllerRightRotationArray),
                ],
              ]
            );
          };
          mesh.setHeadVisible = headVisible => {
            uniforms.headVisible.value = headVisible ? 1 : 0;
          };

          return mesh;
        };

        return {
          skin,
          makePlayerMesh,
        };
      }
    });
  },
  unmount() {
    this._cleanup();
  },
});
const _angleDiff = (a, b) => mod((b - a) + Math.PI, Math.PI * 2) - Math.PI;

module.exports = skinUtils;
