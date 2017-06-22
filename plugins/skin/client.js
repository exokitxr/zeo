const mod = require('mod-loop');
const minecraftSkin = require('./lib/minecraft-skin');

const SIDES = ['left', 'right'];

class Skin {
  mount() {
    const {three: {THREE, camera}, elements, pose, render, player} = zeo;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const scaleVector = (() => {
      const scale = 1 / 18;
      return new THREE.Vector3(scale, scale, scale);
    })();

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

    return _requestImage('/archae/skin/img/groot.png')
    // return _requestImage('/archae/skin/img/natsuwithfire.png')
      .then(skinImg => {
        if (live) {
          const _makeMesh = (playerId = null) => {
            const {mesh} = minecraftSkin(THREE, skinImg, {
              scale: scaleVector,
            });
            mesh.playerId = playerId;
            return mesh;
          };

          const skinEntity = {
            attributes: {
              /* position: {
                type: 'matrix',
                value: [
                  0, 0, -2,
                  0, 0, 0, 1,
                  1, 1, 1,
                ],
              }, */
            },
            entityAddedCallback(entityElement) {
              const entityApi = entityElement.getEntityApi();
              const entityObject = entityElement.getObject();

              const localMesh = _makeMesh();
              entityObject.add(localMesh);
              meshes.push(localMesh);

              const _addMesh = playerId => {
                const mesh = _makeMesh(playerId);
                entityObject.add(mesh);
                meshes.push(mesh);
              };
              const _removeMesh = playerId => {
                const meshIndex = meshes.findIndex(mesh => mesh.playerId === playerId);
                const mesh = meshes[meshIndex];
                entityObject.remove(mesh);
                meshes.splice(meshIndex, 1);
              };
              const statuses = player.getRemoteStatuses();
              for (let i = 0; i < statuses.length; i++) {
                const status = statuses[i];
                const {playerId} = status;
                _addMesh(playerId);
              }

              const _updateMesh = mesh => {
                const {head, playerRotation, playerModel, arms} = mesh;
                const {eyes} = head;
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
                const angleDiff = _angleDiff(hmdEuler.y, playerRotation.rotation.y);
                const angleDiffAbs = Math.abs(angleDiff);
                if (angleDiffAbs > Math.PI / 2) {
                  playerRotation.rotation.y += (angleDiffAbs - (Math.PI / 2)) * (angleDiff < 0 ? 1 : -1);
                  playerRotation.updateMatrix();
                  playerRotation.updateMatrixWorld();
                }

                mesh.position.copy(hmdPosition.clone().sub(
                  eyes.getWorldPosition().sub(mesh.getWorldPosition())
                ));
                const playerQuaternionInverse = playerModel.getWorldQuaternion().inverse();
                head.quaternion.copy(
                  hmdRotation.clone()
                  .premultiply(playerQuaternionInverse)
                );

                SIDES.forEach((side, index) => {
                  const controllerStatus = controllersStatus[side];
                  const {position: controllerPosition, rotation: controllerRotation} = controllerStatus;
                  const arm = arms[side];
                  const upVector = new THREE.Vector3(0, index === 0 ? -1 : 1, 0).applyQuaternion(controllerRotation);
                  const rotationMatrix = new THREE.Matrix4().lookAt(controllerPosition, arm.getWorldPosition(), upVector);
                  const armQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1));
                  arm.quaternion
                    .setFromRotationMatrix(rotationMatrix)
                    .multiply(armQuaternion)
                    .premultiply(playerQuaternionInverse);
                });
              };
              const _update = () => {
                for (let i = 0; i < meshes.length; i++) {
                  const mesh = meshes[i];
                  _updateMesh(mesh);
                }
              };
              render.on('update', _update);
              _update();

              const _renderStart = () => {
                 const {head} = localMesh;
                 head.visible = false;
              };
              render.on('renderStart', _renderStart);
              const _renderEnd = () => {
                 const {head} = localMesh;
                 head.visible = true;
              };
              render.on('renderEnd', _renderEnd);

              const _playerEnter = ({id}) => {
                _addMesh(id);
              };
              player.on('playerEnter', _playerEnter);
              const _playerLeave = ({id}) => {
                _removeMesh(id);
              };
              player.on('playerLeave', _playerLeave);

              entityApi._cleanup = () => {
                for (let i = 0; i < meshes.length; i++) {
                  const mesh = meshes[i];
                  entityObject.remove(mesh);
                }
                meshes.length = 0;

                render.removeListener('update', _update);
                render.removeListener('renderStart', _renderStart);
                render.removeListener('renderEnd', _renderEnd);
                player.removeListener('playerEnter', _playerEnter);
                player.removeListener('playerLeave', _playerLeave);
              };
            },
            entityRemovedCallback(entityElement) {
              const entityApi = entityElement.getEntityApi();

              entityApi._cleanup();
            },
            entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
              const entityObject = entityElement.getObject();

              switch (name) {
                /* case 'position': {
                  const position = newValue;

                  if (position) {
                    entityObject.position.set(position[0], position[1], position[2]);
                    entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
                    entityObject.scale.set(position[7], position[8], position[9]);
                  }

                  break;
                } */
              }
            },
          };
          elements.registerEntity(this, skinEntity);

          this._cleanup = () => {
            elements.unregisterEntity(this, skinEntity);
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}
const _angleDiff = (a, b) => {
  let diff = b - a;
  return mod(diff + Math.PI, Math.PI * 2) - Math.PI;
};

module.exports = Skin;
