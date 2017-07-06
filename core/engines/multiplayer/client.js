const SIDES = ['left', 'right'];

class Multiplayer {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

    return archae.requestPlugins([
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/assets',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/utils/js-utils',
      '/core/utils/network-utils',
    ]).then(([
      three,
      webvr,
      assets,
      biolumi,
      rend,
      jsUtils,
      networkUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {models: {hmdModelMesh, controllerModelMesh}} = assets;
        const {events} = jsUtils;
        const {EventEmitter} = events;
        const {AutoWs} = networkUtils;

        const zeroVector = new THREE.Vector3();
        const zeroQuaternion = new THREE.Quaternion();
        const oneVector = new THREE.Vector3(1, 1, 1);

        let connection = null;
        const _addressChange = ({address, username}) => {
          connection = new AutoWs(_relativeWsUrl('archae/multiplayerWs?id=' + encodeURIComponent(multiplayerApi.getId()) + '&address=' + encodeURIComponent(address) + '&username=' + encodeURIComponent(username)));
          connection.on('message', msg => {
            const m = JSON.parse(msg.data);
            const {type} = m;

            if (type === 'init') {
              const {statuses} = m;

              for (let i = 0; i < statuses.length; i++) {
                const statusEntry = statuses[i];
                _handleStatusEntry(statusEntry);
              }

              rend.setStatus('users', multiplayerApi.getUsers());
            } else if (type === 'status') {
              const statusEntry = m;
              _handleStatusEntry(statusEntry);

              rend.setStatus('users', multiplayerApi.getUsers());
            } else {
              console.log('unknown message type', JSON.stringify(type));
            }
          });

          const _handleStatusEntry = statusEntry => {
            const {id, status} = statusEntry;

            const playerStatus = multiplayerApi.getPlayerStatus(id);
            if (status) {
              if (!playerStatus) {
                multiplayerApi.emit('playerEnter', {id, status});

                multiplayerApi.setPlayerStatus(id, status);
              } else {
                multiplayerApi.emit('playerStatusUpdate', {id, status});

                if ('username' in status) {
                  playerStatus.username = status.username;
                }
                if ('hmd' in status) {
                  playerStatus.hmd = status.hmd;
                }
                if ('controllers' in status) {
                  playerStatus.controllers = status.controllers;
                }
              }
            } else {
              if (playerStatus) {
                multiplayerApi.emit('playerLeave', {id});

                multiplayerApi.deletePlayerStatus(id);
              } else {
                console.warn('Ignoring duplicate player leave message', {id});
              }
            }
          };
          const _status = status => {
            const e = {
              type: 'status',
              status,
            };
            const es = JSON.stringify(e);

            connection.send(es);
          };
          multiplayerApi.on('status', _status);

          cleanups.push(() => {
            multiplayerApi.reset();

            connection.destroy();

            multiplayerApi.removeListener('status', _status);
          });
        };
        rend.once('addressChange', _addressChange);

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
            const result = [];

            this.playerStatuses.forEach((status, playerId) => {
              result.push({
                playerId,
                status,
              });
            });

            return result;
          }

          getPlayerStatus(playerId) {
            return this.playerStatuses.get(playerId) || null;
          }

          setPlayerStatus(playerId, status) {
            this.playerStatuses.set(playerId, status);
          }

          deletePlayerStatus(playerId) {
            this.playerStatuses.delete(playerId);
          }

          getUsers() {
            const {playerStatuses} = this;

            const result = Array(playerStatuses.size);
            let i = 0;
            playerStatuses.forEach(playerStatus => {
              result[i++] = playerStatus.username;
            });
            return result.sort((a, b) => a.localeCompare(b));
          }

          updateStatus(status) {
            this.emit('status', status);
          }

          getRemotePlayerMesh(id) {
            const {remotePlayerMeshes} = this;
            return remotePlayerMeshes.get(id) || null;
          }

          getRemoteControllerMeshes(id) {
            const remotePlayerMesh = this.getRemotePlayerMesh(id);

            if (remotePlayerMesh) {
              const {controllers: controllerMeshes} = remotePlayerMesh;
              return controllerMeshes;
            } else {
              return null;
            }
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

            rend.setStatus('users', multiplayerApi.getUsers());
          }
        }
        const multiplayerApi = new MutiplayerInterface(_makeId());

        const _makeRemotePlayerMesh = () => {
          const object = new THREE.Object3D();

          const hmd = hmdModelMesh.clone();
          object.add(hmd);
          object.hmd = hmd;

          const label = assets.makePlayerLabelMesh({
            username: status.username,
          });
          object.add(label);
          object.label = label;

          const menu = assets.makePlayerMenuMesh({
            username: status.username,
          });
          object.add(menu);
          object.menu = menu;

          const _makeControllerMesh = () => controllerModelMesh.clone();
          const controllers = {
            left: _makeControllerMesh(),
            right: _makeControllerMesh(),
          };
          object.add(controllers.left);
          object.add(controllers.right);
          object.controllers = controllers;

          object.update = status => {
            const _updateHmd = () => {
              const {hmd: hmdStatus} = status;

              hmd.position.fromArray(hmdStatus.position);
              hmd.quaternion.fromArray(hmdStatus.rotation);
              hmd.scale.fromArray(hmdStatus.scale);
              hmd.updateMatrixWorld();
            };
            const _updateControllers = () => {
              const {left: leftController, right: rightController} = controllers;

              const {controllers: controllersStatus} = status;
              const {left: leftControllerStatus, right: rightControllerStatus} = controllersStatus;

              leftController.position.fromArray(leftControllerStatus.position);
              leftController.quaternion.fromArray(leftControllerStatus.rotation);
              leftController.scale.fromArray(leftControllerStatus.scale);
              leftController.updateMatrixWorld();

              rightController.position.fromArray(rightControllerStatus.position);
              rightController.quaternion.fromArray(rightControllerStatus.rotation);
              rightController.scale.fromArray(rightControllerStatus.scale);
              rightController.updateMatrixWorld();
            };
            const _updateLabel = () => {
              const {hmd: hmdStatus, username} = status;

              label.update({
                hmdStatus,
                username,
              });
            };
            const _updateMetadata = () => {
              const {metadata: {menu: menuStatus}, username} = status;

              menu.update({
                menuStatus,
                username,
              });
            };

            _updateHmd();
            _updateControllers();
            _updateLabel();
            _updateMetadata();
          };
          object.destroy = () => {
            label.destroy();
          };

          return object;
        };

        const playerStatuses = multiplayerApi.getPlayerStatuses();
        for (let i = 0; i < playerStatuses.length; i++) {
          const playerStatus = playerStatuses[i];
          const {playerId, status} = playerStatus;
          const remotePlayerMesh = _makeRemotePlayerMesh();
          remotePlayerMesh.update(status);

          scene.add(remotePlayerMesh);

          multiplayerApi.addRemotePlayerMesh(playerId, remotePlayerMesh);
        }

        const playerStatusUpdate = update => {
          const {id, status} = update;
          const remotePlayerMesh = multiplayerApi.getRemotePlayerMesh(id);

          remotePlayerMesh.update(status);
        };
        const playerEnter = update => {
          const {id, status} = update;

          const remotePlayerMesh = _makeRemotePlayerMesh();
          remotePlayerMesh.update(status);

          scene.add(remotePlayerMesh);

          multiplayerApi.addRemotePlayerMesh(id, remotePlayerMesh);
        };
        const playerLeave = update => {
          const {id} = update;
          const remotePlayerMesh = multiplayerApi.getRemotePlayerMesh(id);

          scene.remove(remotePlayerMesh);
          remotePlayerMesh.destroy();

          multiplayerApi.removeRemotePlayerMesh(id);
        };
        multiplayerApi.on('playerStatusUpdate', playerStatusUpdate);
        multiplayerApi.on('playerEnter', playerEnter);
        multiplayerApi.on('playerLeave', playerLeave);

        const localStatus = {
          hmd: {
            position: zeroVector.toArray(),
            rotation: zeroQuaternion.toArray(),
            scale: oneVector.toArray(),
          },
          controllers: {
            left: {
              position: zeroVector.toArray(),
              rotation: zeroQuaternion.toArray(),
              scale: oneVector.toArray(),
            },
            right: {
              position: zeroVector.toArray(),
              rotation: zeroQuaternion.toArray(),
              scale: oneVector.toArray(),
            },
          },
          metadata: {
            menu: {
              open: false,
              position: null,
              rotation: null,
              scale: null,
            },
          },
        };

        let lastStatus = null;
        let lastMenuState = null;
        const _update = () => {
          const status = webvr.getStatus();
          const menuState = rend.getMenuState();

          let updated = false;
          const _updateHmd = () => {
            const {hmd} = status;
            const {worldPosition: hmdPosition, worldRotation: hmdRotation, worldScale: hmdScale} = hmd;

            if (!lastStatus || !lastStatus.hmd.position.equals(hmdPosition) || !lastStatus.hmd.rotation.equals(hmdRotation)) {
              localStatus.hmd.position = hmdPosition.toArray();
              localStatus.hmd.rotation = hmdRotation.toArray();
              localStatus.hmd.scale = hmdScale.toArray();

              updated = true;
            }
          };
          const _updateControllers = () => {
            const {gamepads} = status;

            SIDES.forEach(side => {
              const gamepad = gamepads[side];

              if (gamepad) {
                const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;

                const _updateGamepad = () => {
                  localStatus.controllers[side].position = controllerPosition.toArray();
                  localStatus.controllers[side].rotation = controllerRotation.toArray();
                  localStatus.controllers[side].scale = controllerScale.toArray();

                  updated = true;
                };

                if (!lastStatus) {
                  _updateGamepad();
                } else {
                  const lastGamepadStatus = lastStatus.gamepads[side];

                  if (
                    !lastGamepadStatus ||
                    !lastGamepadStatus.position.equals(controllerPosition) ||
                    !lastGamepadStatus.rotation.equals(controllerRotation) ||
                    !lastGamepadStatus.scale.equals(controllerScale)
                  ) {
                    _updateGamepad();
                  }
                }
              }
            });
          };
          const _updateMetadata = () => {
            const _updateMetadata = () => {
              localStatus.metadata.menu = menuState;

              updated = true;
            };

            if (!lastMenuState) {
              _updateMetadata();
            } else {
              if (
                menuState.open !== lastMenuState.open ||
                !_arrayEquals(menuState.position, lastMenuState.position) ||
                !_arrayEquals(menuState.rotation, lastMenuState.rotation) ||
                !_arrayEquals(menuState.scale, lastMenuState.scale)
              ) {
                _updateMetadata();
              }
            }
          };
          const _emitUpdate = () => {
            if (updated) {
              multiplayerApi.updateStatus(localStatus);
            }
          };

          _updateHmd();
          _updateControllers();
          _updateMetadata();
          _emitUpdate();

          lastStatus = status;
          lastMenuState = menuState;
        };
        rend.on('update', _update);

        cleanups.push(() => {
          rend.removeListener('addressChange', _addressChange);

          multiplayerApi.removeListener('playerStatusUpdate', playerStatusUpdate);
          multiplayerApi.removeListener('playerEnter', playerEnter);
          multiplayerApi.removeListener('playerLeave', playerLeave);

          rend.removeListener('update', _update);
        });

        return multiplayerApi;
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _relativeWsUrl = s => {
  const l = window.location;
  return ((l.protocol === 'https:') ? 'wss://' : 'ws://') + l.host + l.pathname + (!/\/$/.test(l.pathname) ? '/' : '') + s;
};
const _makeId = () => Math.random().toString(36).substring(7);
const _arrayEquals = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((ae, i) => b[i] === ae);

module.exports = Multiplayer;
