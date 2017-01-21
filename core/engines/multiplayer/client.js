const hmdModelPath = '/archae/models/hmd/hmd.json';
const controllerModelPath = '/archae/models/controller/controller.json';

const SIDES = ['left', 'right'];

class Multiplayer {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/rend',
      '/core/plugins/js-utils',
    ]).then(([
      three,
      webvr,
      rend,
      jsUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const world = rend.getCurrentWorld();
        const {player} = world;
        const {events} = jsUtils;
        const {EventEmitter} = events;

        const _requestPlayerInterface = () => new Promise((accept, reject) => {
          const playerStatuses = new Map();

          const connection = new WebSocket('wss://' + location.host + '/archae/multiplayer');
          const queue = [];
          connection.onopen = () => {
            if (queue.length > 0) {
              for (let i = 0; i < queue.length; i++) {
                const e = queue[i];
                const es = JSON.stringify(e);
                connection.send(es);
              }
              queue.length = 0;
            }
          };
          connection.onerror = err => {
            console.warn(err);
          };
          connection.onmessage = msg => {
            const m = JSON.parse(msg.data);
            const {type} = m;

            if (type === 'statuses') {
              const {statuses} = m;
              for (let i = 0; i < statuses.length; i++) {
                const statusEntry = statuses[i];
                _handleStatusEntry(statusEntry);
              }
            } else if (type === 'status') {
              const statusEntry = m;
              _handleStatusEntry(statusEntry);
            } else {
              console.log('unknown message type', JSON.stringify(type));
            }
          };

          const _handleStatusEntry = statusEntry => {
            const {id, status} = statusEntry;

            if (status) {
              if (!playerStatuses.has(id)) {
                playerInterface.emit('playerEnter', {id, status});
              } else {
                playerInterface.emit('playerStatusUpdate', {id, status});
              }

              playerStatuses.set(id, status);
            } else {
              playerInterface.emit('playerLeave', {id});

              playerStatuses.delete(id);
            }
          };

          class PlayerInterface extends EventEmitter {
            getPlayerStatuses() {
              return playerStatuses;
            }

            updateStatus(status) {
              const e = {
                type: 'status',
                status,
              };

              if (connection.readyState === WebSocket.OPEN) {
                const es = JSON.stringify(e);
                connection.send(es);
              } else {
                queue.push(e);
              }
            }

            destroy() {
              connection.close();
            }
          }

          const playerInterface = new PlayerInterface();
          accept(playerInterface);
        });

        const _requestMesh = modelPath => new Promise((accept, reject) => {
          fetch(modelPath)
            .then(res =>
              res.json()
                .then(modelJson => new Promise((accept, reject) => {
                  const loader = new THREE.ObjectLoader();
                  loader.parse(modelJson, accept);
                }))
            )
            .then(accept)
            .catch(reject);
        });
        const _requestHmdMesh = () => _requestMesh(hmdModelPath)
          .then(mesh => {
            const object = new THREE.Object3D();

            mesh.scale.set(0.045, 0.045, 0.045);
            mesh.rotation.order = camera.rotation.order;
            mesh.rotation.y = Math.PI;

            object.add(mesh);

            return object;
          });
        const _requestControllerMesh = () => _requestMesh(controllerModelPath);

        return Promise.all([
          _requestPlayerInterface(),
          _requestHmdMesh(),
          _requestControllerMesh(),
        ]).then(([
          playerInterface,
          hmdMesh,
          controllerMesh,
        ]) => {
          const zeroVector = new THREE.Vector3();
          const zeroQuaternion = new THREE.Quaternion();

          const remotePlayerMeshes = new Map();

          const _makeRemotePlayerMesh = status => {
            const object = new THREE.Object3D();

            const hmd = hmdMesh.clone();
            object.add(hmd);
            object.hmd = hmd;

            const controllers = (() => {
              const result = [controllerMesh.clone(), controllerMesh.clone()];
              result.left = result[0];
              result.right = result[1];
              return result;
            })();
            controllers.forEach(controller => {
              object.add(controller);
            });
            object.controllers = controllers;

            _updateRemotePlayerMesh(object, status);

            return object;
          };
          const _updateRemotePlayerMesh = (remotePlayerMesh, status) => {
            const {hmd, controllers} = remotePlayerMesh;
            const {left: leftController, right: rightController} = controllers;

            const {hmd: hmdStatus, controllers: controllersStatus} = status;
            const {left: leftControllerStatus, right: rightControllerStatus} = controllersStatus;

            hmd.position.fromArray(hmdStatus.position);
            hmd.quaternion.fromArray(hmdStatus.rotation);

            leftController.position.fromArray(leftControllerStatus.position);
            leftController.quaternion.fromArray(leftControllerStatus.rotation);

            rightController.position.fromArray(rightControllerStatus.position);
            rightController.quaternion.fromArray(rightControllerStatus.rotation);
          };

          const playerStatuses = playerInterface.getPlayerStatuses();
          playerStatuses.forEach((status, id) => {
            const remotePlayerMesh = _makeRemotePlayerMesh(status);
            scene.add(remotePlayerMesh);
            remotePlayerMeshes.set(id, remotePlayerMesh);
          });

          const playerStatusUpdate = update => {
            const {id, status} = update;
            const remotePlayerMesh = remotePlayerMeshes.get(id);
            _updateRemotePlayerMesh(remotePlayerMesh, status);
          };
          const playerEnter = update => {
            const {id, status} = update;
            const remotePlayerMesh = _makeRemotePlayerMesh(status);
            scene.add(remotePlayerMesh);
            remotePlayerMeshes.set(id, remotePlayerMesh);
          };
          const playerLeave = update => {
            const {id} = update;
            const remotePlayerMesh = remotePlayerMeshes.get(id);
            scene.remove(remotePlayerMesh);
            remotePlayerMeshes.delete(id);
          };
          playerInterface.on('playerStatusUpdate', playerStatusUpdate);
          playerInterface.on('playerEnter', playerEnter);
          playerInterface.on('playerLeave', playerLeave);

          const localStatus = {
            hmd: {
              position: zeroVector.toArray(),
              rotation: zeroQuaternion.toArray(),
            },
            controllers: {
              left: {
                position: zeroVector.toArray(),
                rotation: zeroQuaternion.toArray(),
              },
              right: {
                position: zeroVector.toArray(),
                rotation: zeroQuaternion.toArray(),
              },
            },
          };

          const _update = () => {
            const status = webvr.getStatus();

            let lastStatus = null;
            const _updateHmd = () => {
              const {hmd} = status;
              const {position, rotation} = hmd;

              if (!lastStatus || !lastStatus.hmd.position.equals(position) || !lastStatus.hmd.rotation.equals(rotation)) {
                localStatus.hmd.position = position.toArray();
                localStatus.hmd.rotation = rotation.toArray();

                playerInterface.updateStatus(localStatus);
              }
            };
            const _updateControllers = () => {
              const {gamepads} = status;

              SIDES.forEach(side => {
                const gamepad = gamepads[side];

                if (gamepad) {
                  const {position, rotation} = gamepad;

                  const _update = () => {
                    localStatus.controllers[side].position = position.toArray();
                    localStatus.controllers[side].rotation = rotation.toArray();

                    playerInterface.updateStatus(localStatus);
                  };

                  if (!lastStatus) {
                    _update();
                  } else {
                    const lastGamepadStatus = lastStatus.controllers[side];

                    if (!lastGamepadStatus || !lastGamepadStatus.position.equals(position) || !lastGamepadStatus.rotation.equals(rotation)) {
                      _update();
                    }
                  }
                }
              });
            };

            _updateHmd();
            _updateControllers();

            lastStatus = status;
          };
          rend.on('update', _update);

          this._cleanup = () => {
            playerInterface.close();

            remotePlayerMeshes.forEach(remotePlayerMesh => {
              scene.remove(remotePlayerMesh);
            });

            playerInterface.removeListener('playerStatusUpdate', playerStatusUpdate);
            playerInterface.removeListener('playerEnter', playerEnter);
            playerInterface.removeListener('playerLeave', playerLeave);

            rend.removeListener('update', _update);
          };
        });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Multiplayer;
