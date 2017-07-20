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
        const {THREE} = three;
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

        const makePlayerMesh = (skinImg, {local = true} = {}) => {
          const mesh = skin(skinImg, {
            limbs: local,
          });
          mesh.material.uniforms.headVisible.value = local ? 0 : 1;
          mesh.visible = !local;

          mesh.update = status => {
            const {hmd, gamepads} = status;
            const {worldPosition: hmdPosition, worldRotation: hmdRotation} = hmd;

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
              const gamepad = gamepads[side];
              const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;
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
              const armRotation = mesh.material.uniforms[side === 'left' ? 'leftArmRotation' : 'rightArmRotation'];
              armRotation.value.set(armQuaternionInverse.x, armQuaternionInverse.y, armQuaternionInverse.z, armQuaternionInverse.w);
            }
          };
          mesh.updateEyeStart = () => {
            mesh.material.uniforms.headVisible.value = 1;
            mesh.visible = true;
          };
          mesh.updateEyeEnd = () => {
            mesh.material.uniforms.headVisible.value = 0;
            mesh.visible = false;
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
