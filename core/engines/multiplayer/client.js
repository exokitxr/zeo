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
      '/core/engines/hub',
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/rend',
      '/core/plugins/js-utils',
    ]).then(([
      hub,
      three,
      webvr,
      rend,
      jsUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;

        const zeroVector = new THREE.Vector3();
        const zeroQuaternion = new THREE.Quaternion();

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
          _requestHmdMesh(),
          _requestControllerMesh(),
        ]).then(([
          hmdMesh,
          controllerMesh,
        ]) => {
          if (live) {
            class MutiplayerInterface extends EventEmitter {
              constructor(id) {
                super();

                this.id = id;

                this.playerStatuses = new Map();
                this.remotePlayerMeshes = new Map();
              }

              getId() {
                return this.id;
              }

              getPlayerStatuses() {
                return this.playerStatuses;
              }

              updateStatus(status) {
                this.emit('status', status);
              }

              getRemotePlayerMesh(id) {
                const {remotePlayerMeshes} = this;
                return remotePlayerMeshes.get(id);
              }

              addRemotePlayerMesh(id, mesh) {
                const {remotePlayerMeshes} = this;
                remotePlayerMeshes.set(id, mesh);
              }

              removeRemotePlayerMesh(id) {
                const {remotePlayerMeshes} = this;
                remotePlayerMeshes.delete(id);
              }

              reset() {
                const {remotePlayerMeshes: oldRemotePlayerMeshes} = this;

                this.playerStatuses = new Map();
                this.remotePlayerMeshes = new Map();

                oldRemotePlayerMeshes.forEach(mesh => {
                  scene.remove(mesh);
                });
              }
            }
            const multiplayerInterface = new MutiplayerInterface(_makeId());

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

            const playerStatuses = multiplayerInterface.getPlayerStatuses();
            playerStatuses.forEach((status, id) => {
              const remotePlayerMesh = _makeRemotePlayerMesh(status);
              scene.add(remotePlayerMesh);
              multiplayerInterface.addRemotePlayerMesh(id, remotePlayerMesh);
            });

            const playerStatusUpdate = update => {
              const {id, status} = update;
              const remotePlayerMesh = multiplayerInterface.getRemotePlayerMesh(id);
              _updateRemotePlayerMesh(remotePlayerMesh, status);
            };
            const playerEnter = update => {
              const {id, status} = update;
              const remotePlayerMesh = _makeRemotePlayerMesh(status);
              scene.add(remotePlayerMesh);
              multiplayerInterface.addRemotePlayerMesh(id, remotePlayerMesh);
            };
            const playerLeave = update => {
              const {id} = update;
              const remotePlayerMesh = multiplayerInterface.getRemotePlayerMesh(id);
              scene.remove(remotePlayerMesh);
              multiplayerInterface.removeRemotePlayerMesh(id);
            };
            multiplayerInterface.on('playerStatusUpdate', playerStatusUpdate);
            multiplayerInterface.on('playerEnter', playerEnter);
            multiplayerInterface.on('playerLeave', playerLeave);

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

                  multiplayerInterface.updateStatus(localStatus);
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

                      multiplayerInterface.updateStatus(localStatus);
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

            const cleanups = [];
            const cleanup = () => {
              for (let i = 0; i < cleanups.length; i++) {
                const cleanup = cleanups[i];
                cleanup();
              }
              cleanups.length = 0;
            };

            let enabled = false;
            const _enable = () => { // XXX handle race conditions here
              enabled = true;
              cleanups.push(() => {
                enabled = false;
              });

              const connection = new WebSocket('wss://' + hub.getCurrentServer().url + '/archae/multiplayer?id=' + multiplayerInterface.getId());
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

                if (type === 'init') {
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

                const playerStatuses = multiplayerInterface.getPlayerStatuses();
                if (status) {
                  if (!playerStatuses.has(id)) {
                    multiplayerInterface.emit('playerEnter', {id, status});
                  } else {
                    multiplayerInterface.emit('playerStatusUpdate', {id, status});
                  }

                  playerStatuses.set(id, status);
                } else {
                  multiplayerInterface.emit('playerLeave', {id});

                  playerStatuses.delete(id);
                }
              };
              const _status = status => {
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
              };
              multiplayerInterface.on('status', _status);
              connection.onclose = () => {
                multiplayerInterface.removeListener('status', _status);
              };

              cleanups.push(() => {
                multiplayerInterface.reset();

                connection.close();
              });
            };
            const _disable = () => {
              cleanup();
            };

            const _updateEnabled = () => {
              const connected = hub.getCurrentServer().type === 'server';

              if (connected && !enabled) {
                _enable();
              } else if (!connected && enabled) {
                _disable();
              };
            };
            const _connectServer = _updateEnabled;
            rend.on('connectServer', _connectServer);
            const _disconnectServer = _updateEnabled;
            rend.on('disconnectServer', _disconnectServer);

            this._cleanup = () => {
              cleanup();

              multiplayerInterface.removeListener('playerStatusUpdate', playerStatusUpdate);
              multiplayerInterface.removeListener('playerEnter', playerEnter);
              multiplayerInterface.removeListener('playerLeave', playerLeave);

              rend.removeListener('update', _update);
              rend.on('connectServer', _connectServer);
              rend.on('disconnectServer', _disconnectServer);
            };

            return multiplayerInterface;
          }
        });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _makeId = () => Math.random().toString(36).substring(7);

module.exports = Multiplayer;
