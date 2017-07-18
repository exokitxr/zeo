const mod = require('mod-loop');

const SIDES = ['left', 'right'];

class Skin {
  mount() {
    const {three, pose, render, player, utils: {skin: skinUtils}} = zeo;
    const {THREE, scene, camera, renderer} = three;
    const {skin} = skinUtils;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestImage = url => new Promise((accept, reject) => {
      const img = new Image();

      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(img);
      };

      img.crossOrigin = 'Anonymous';
      img.src = url;
    });
    const meshes = [];

    class FakeStatus {
      constructor(hmd, controllers) {
        this.hmd = hmd;
        this.controllers = controllers;
      }
    }
    class FakeStatusProperties {
      constructor(position, rotation, scale) {
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
      }
    }
    class FakeControllersStatus {
      constructor(left, right) {
        this.left = left;
        this.right = right;
      }
    }

    return _requestImage('/archae/skin/img/darkvortexity.png')
    // return _requestImage('/archae/skin/img/groot.png')
    // return _requestImage('/archae/skin/img/natsuwithfire.png')
      .then(skinImg => {
        if (live) {
          const _makeMesh = (playerId = null) => {
            const mesh = skin(skinImg);
            mesh.playerId = playerId;
            return mesh;
          };

          const localMesh = _makeMesh();
          localMesh.onBeforeRender = () => {
            if (renderer.getRecursing()) {
              localMesh.material.uniforms.headVisible.value = 1;
            }
          };
          localMesh.onAfterRender = () => {
            if (renderer.getRecursing()) {
              localMesh.material.uniforms.headVisible.value = 0;
            }
          };
          scene.add(localMesh);
          meshes.push(localMesh);

          const _addMesh = playerId => {
            const mesh = _makeMesh(playerId);
            scene.add(mesh);
            meshes.push(mesh);
          };
          const _removeMesh = playerId => {
            const meshIndex = meshes.findIndex(mesh => mesh.playerId === playerId);
            const mesh = meshes[meshIndex];
            scene.remove(mesh);
            meshes.splice(meshIndex, 1);
          };
          const statuses = player.getRemoteStatuses();
          for (let i = 0; i < statuses.length; i++) {
            const status = statuses[i];
            const {playerId} = status;
            _addMesh(playerId);
          }

          const _updateMesh = mesh => {
            const status = (() => {
              const {playerId} = mesh;

              if (playerId === null) {
                const status = pose.getStatus();
                const {hmd, gamepads} = status;
                return new FakeStatus(
                  new FakeStatusProperties(hmd.worldPosition, hmd.worldRotation, hmd.worldScale),
                  new FakeControllersStatus(
                    new FakeStatusProperties(gamepads.left.worldPosition, gamepads.left.worldRotation, gamepads.left.worldScale),
                    new FakeStatusProperties(gamepads.right.worldPosition, gamepads.right.worldRotation, gamepads.right.worldScale)
                  ),
                );
              } else {
                const status = player.getRemoteStatus(playerId);
                const {hmd, controllers} = status;
                return new FakeStatus(
                  new FakeStatusProperties(
                    new THREE.Vector3().fromArray(hmd.position),
                    new THREE.Quaternion().fromArray(hmd.rotation),
                    new THREE.Vector3().fromArray(hmd.scale)
                  ),
                  new FakeControllersStatus(
                    new FakeStatusProperties(
                      new THREE.Vector3().fromArray(controllers.left.position),
                      new THREE.Quaternion().fromArray(controllers.left.rotation),
                      new THREE.Vector3().fromArray(controllers.left.scale)
                    ),
                    new FakeStatusProperties(
                      new THREE.Vector3().fromArray(controllers.right.position),
                      new THREE.Quaternion().fromArray(controllers.right.rotation),
                      new THREE.Vector3().fromArray(controllers.right.scale)
                    )
                  )
                );
              }
            })();
            const {hmd: hmdStatus, controllers: controllersStatus} = status;
            const {position: hmdPosition, rotation: hmdRotation} = hmdStatus;

            const hmdEuler = new THREE.Euler().setFromQuaternion(hmdRotation, camera.rotation.order);
            const playerEuler = new THREE.Euler().setFromQuaternion(mesh.quaternion, camera.rotation.order);
            const angleDiff = _angleDiff(hmdEuler.y, playerEuler.y);
            const angleDiffAbs = Math.abs(angleDiff);
            if (angleDiffAbs > Math.PI / 2) {
              playerEuler.y += (angleDiffAbs - (Math.PI / 2)) * (angleDiff < 0 ? 1 : -1);
              mesh.quaternion.setFromEuler(playerEuler);
            }

            mesh.position.copy(hmdPosition)
              .sub(mesh.getEyeOffset());
            mesh.updateMatrixWorld();
            const playerQuaternionInverse = mesh.quaternion.clone().inverse();
            const headQuaternion = hmdRotation.clone().inverse()
              .premultiply(mesh.quaternion);
            mesh.material.uniforms.headRotation.value.set(headQuaternion.x, headQuaternion.y, headQuaternion.z, headQuaternion.w);

            /* for (let i = 0; i < SIDES.length; i++) {
              const side = SIDES[i];
              const controllerStatus = controllersStatus[side];
              const {position: controllerPosition, rotation: controllerRotation} = controllerStatus;
              const armOffset = mesh[side === 'left' ? 'getLeftArmOffset' : 'getRightArmOffset']();
              const upVector = new THREE.Vector3(0, side === 'left' ? -1 : 1, 0).applyQuaternion(controllerRotation);
              const rotationMatrix = new THREE.Matrix4().lookAt(
                mesh.position.clone().add(armOffset.applyQuaternion(mesh.quaternion)),
                controllerPosition,
                upVector
              );
              const localArmQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1));
              const armQuaternion = new THREE.Quaternion()
                .setFromRotationMatrix(rotationMatrix)
                .multiply(localArmQuaternion)
                .premultiply(playerQuaternionInverse);
              const armRotation = mesh.material.uniforms[side === 'left' ? 'leftArmRotation' : 'rightArmRotation'];
              armRotation.value.set(armQuaternion.x, armQuaternion.y, armQuaternion.z, armQuaternion.w);
            } */
          };
          const _update = () => {
            for (let i = 0; i < meshes.length; i++) {
              const mesh = meshes[i];
              _updateMesh(mesh);
            }
          };
          render.on('update', _update);
          _update();

          const _updateStart = () => {
            localMesh.material.uniforms.headVisible.value = 0;
          };
          render.on('updateStart', _updateStart);
          const _updateEnd = () => {
            localMesh.material.uniforms.headVisible.value = 1;
          };
          render.on('updateEnd', _updateEnd);

          const _playerEnter = ({id}) => {
            _addMesh(id);
          };
          player.on('playerEnter', _playerEnter);
          const _playerLeave = ({id}) => {
            _removeMesh(id);
          };
          player.on('playerLeave', _playerLeave);

          this._cleanup = () => {
            for (let i = 0; i < meshes.length; i++) {
              const mesh = meshes[i];
              scene.remove(mesh);
            }

            render.removeListener('update', _update);
            render.removeListener('updateStart', _updateStart);
            render.removeListener('updateEnd', _updateEnd);

            player.removeListener('playerEnter', _playerEnter);
            player.removeListener('playerLeave', _playerLeave);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}
const _angleDiff = (a, b) => mod((b - a) + Math.PI, Math.PI * 2) - Math.PI;

module.exports = Skin;
