const mod = require('mod-loop');
const skinJs = require('skin-js');

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
        const {THREE} = three;
        const skin = skinJs(THREE);

        const upVector = new THREE.Vector3(0, 1, 0);
        const armQuaternionOffset = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1));

        const hmdEuler = new THREE.Euler();
        const playerEuler = new THREE.Euler();
        const eyeWorldPosition = new THREE.Vector3();
        const meshWorldPosition = new THREE.Vector3();
        const playerQuaternionInverse = new THREE.Quaternion();
        const headQuaternion = new THREE.Quaternion();
        const headQuaternionInverse = new THREE.Quaternion();
        const localUpVector = new THREE.Vector3();
        const armQuaternion = new THREE.Quaternion();
        const armQuaternionInverse = new THREE.Quaternion();
        const rotationMatrix = new THREE.Matrix4();

        const makePlayerMesh = (skinImg, {local = true} = {}) => {
          const mesh = skin(skinImg, {
            limbs: local,
          });
          mesh.material.uniforms.headVisible.value = local ? 0 : 1;
          mesh.visible = !local;

          const _updateMesh = mesh => {
            const {hmd: hmdStatus, controllers: controllersStatus} = status;
            const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmdStatus;

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
            mesh.material.uniforms.headRotation.value.set(headQuaternionInverse.x, headQuaternionInverse.y, headQuaternionInverse.z, headQuaternionInverse.w);
            mesh.head.quaternion.copy(headQuaternion);
            mesh.updateMatrixWorld();

            for (let i = 0; i < SIDES.length; i++) {
              const side = SIDES[i];
              const controllerStatus = controllersStatus[side];
              const {position: controllerPosition, rotation: controllerRotation} = controllerStatus;
              localUpVector.copy(upVector).applyQuaternion(controllerRotation);
              rotationMatrix.lookAt(
                mesh.arms[side].getWorldPosition(),
                controllerPosition,
                upVector
              );
              armQuaternion
                .setFromRotationMatrix(rotationMatrix)
                .multiply(armQuaternionOffset)
                .premultiply(playerQuaternionInverse);
              armQuaternionInverse.copy(armQuaternion).inverse();
              const armRotation = mesh.material.uniforms[side === 'left' ? 'leftArmRotation' : 'rightArmRotation'];
              armRotation.value.set(armQuaternionInverse.x, armQuaternionInverse.y, armQuaternionInverse.z, armQuaternionInverse.w);
            }
          };
          mesh.updateEyeStart = () => {
            localMesh.material.uniforms.headVisible.value = 1;
            localMesh.visible = true;
          };
          mesh.updateEyeEnd = () => {
            localMesh.material.uniforms.headVisible.value = 0;
            localMesh.visible = false;
          };
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
