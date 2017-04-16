import {
  WIDTH,
  HEIGHT,

  WORLD_WIDTH,
  WORLD_HEIGHT,
} from './lib/constants/menu';
import menuRender from './lib/render/menu';

const SIDES = ['left', 'right'];

class Multiplayer {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {server: {enabled: serverEnabled}}} = archae;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    if (serverEnabled) {
      return archae.requestPlugins([
        '/core/engines/three',
        '/core/engines/webvr',
        '/core/engines/login',
        '/core/engines/assets',
        '/core/engines/biolumi',
        '/core/engines/rend',
        '/core/utils/js-utils',
        '/core/utils/network-utils',
        '/core/utils/creature-utils',
      ]).then(([
        three,
        webvr,
        login,
        assets,
        biolumi,
        rend,
        jsUtils,
        networkUtils,
        creatureUtils,
      ]) => {
        if (live) {
          const {THREE, scene, camera} = three;
          const {hmdModelMesh, controllerModelMesh} = assets;
          const {events} = jsUtils;
          const {EventEmitter} = events;
          const {AutoWs} = networkUtils;

          const menuRenderer = menuRender.makeRenderer({
            creatureUtils,
          });

          const zeroVector = new THREE.Vector3();
          const zeroQuaternion = new THREE.Quaternion();

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

            addRemotePlayerMesh(id, mesh) {
              const {remotePlayerMeshes} = this;
              remotePlayerMeshes.set(id, mesh);
            }

            removeRemotePlayerMesh(id) {
              const {remotePlayerMeshes} = this;
              remotePlayerMeshes.delete(id);
            }

            makePlayerLabelMesh({username}) {
              const labelState = {
                username: username,
              };

              const menuUi = biolumi.makeUi({
                width: WIDTH,
                height: HEIGHT,
                color: [1, 1, 1, 0],
              });
              const mesh = menuUi.addPage(({
                label: labelState,
              }) => ({
                type: 'html',
                src: menuRenderer.getLabelSrc({
                  label: labelState,
                }),
                x: 0,
                y: 0,
                w: WIDTH,
                h: HEIGHT,
              }), {
                type: 'label',
                state: {
                  label: labelState,
                },
                worldWidth: WORLD_WIDTH,
                worldHeight: WORLD_HEIGHT,
              });
              mesh.rotation.order = camera.rotation.order;

              mesh.update = ({hmdStatus, username}) => {
                const labelPosition = hmdStatus.position.clone().add(new THREE.Vector3(0, WORLD_HEIGHT, 0));
                mesh.position.copy(labelPosition);
                const labelRotation = new THREE.Euler().setFromQuaternion(hmdStatus.rotation, camera.rotation.order);
                labelRotation.x = 0;
                labelRotation.z = 0;
                const labelQuaternion = new THREE.Quaternion().setFromEuler(labelRotation);
                mesh.quaternion.copy(labelQuaternion);
                // mesh.scale.copy(gamepadStatus.scale);

                if (username !== labelState.username) {
                  labelState.username = username;

                  menuUi.update();
                }
              };

              return mesh;
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

          const _makeRemotePlayerMesh = status => {
            const object = new THREE.Object3D();

            const hmd = hmdModelMesh.clone();
            object.add(hmd);
            // object.hmd = hmd;

            const hmdLabel = multiplayerApi.makePlayerLabelMesh({
              username: status.username,
            });
            object.add(hmdLabel);
            // object.hmdLabel = hmdLabel;

            const _makeControllerMesh = () => controllerModelMesh.clone();
            const controllers = {
              left: _makeControllerMesh(),
              right: _makeControllerMesh(),
            };
            object.add(controllers.left);
            object.add(controllers.right);
            // object.controllers = controllers;

            object.update = status => {
              const _updateHmd = () => {
                const {hmd: hmdStatus} = status;

                hmd.position.fromArray(hmdStatus.position);
                hmd.quaternion.fromArray(hmdStatus.rotation);
              };
              const _updateControllers = () => {
                const {left: leftController, right: rightController} = controllers;

                const {controllers: controllersStatus} = status;
                const {left: leftControllerStatus, right: rightControllerStatus} = controllersStatus;

                leftController.position.fromArray(leftControllerStatus.position);
                leftController.quaternion.fromArray(leftControllerStatus.rotation);

                rightController.position.fromArray(rightControllerStatus.position);
                rightController.quaternion.fromArray(rightControllerStatus.rotation);
              };
              const _updateLabel = () => {
                const {hdm: hmdStatus, username} = status;

                hmdLabel.update({
                  hmdStatus: hmdStatus,
                  username: username,
                });
              };

              _updateHmd();
              _updateControllers();
              _updateLabel();
            };
            object.destroy = () => {
              hmdLabel.destroy();
            };

            _updateRemotePlayerMesh(object, status);

            return object;
          };

          const playerStatuses = multiplayerApi.getPlayerStatuses();
          playerStatuses.forEach((status, id) => {
            const remotePlayerMesh = _makeRemotePlayerMesh(status);

            scene.add(remotePlayerMesh);

            multiplayerApi.addRemotePlayerMesh(id, remotePlayerMesh);
          });

          const playerStatusUpdate = update => {
            const {id, status} = update;
            const remotePlayerMesh = multiplayerApi.getRemotePlayerMesh(id);

            remotePlayerMesh.update(status);
          };
          const playerEnter = update => {
            const {id, status} = update;
            const remotePlayerMesh = _makeRemotePlayerMesh(status);

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

                multiplayerApi.updateStatus(localStatus);
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

                    multiplayerApi.updateStatus(localStatus);
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
          const _enable = () => {
            enabled = true;
            cleanups.push(() => {
              enabled = false;
            });

            const connection = new AutoWs(_relativeWsUrl('archae/multiplayerWs?id=' + encodeURIComponent(multiplayerApi.getId()) + '&username=' + encodeURIComponent(login.getUsername())));
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

              const playerStatuses = multiplayerApi.getPlayerStatuses();
              if (status) {
                const playerStatus = playerStatuses.get(id);

                if (!playerStatus) {
                  multiplayerApi.emit('playerEnter', {id, status});

                  playerStatuses.set(id, status);
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
                multiplayerApi.emit('playerLeave', {id});

                playerStatuses.delete(id);
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
          const _disable = () => {
            cleanup();
          };

          const _updateEnabled = () => {
            const loggedIn = !login.isOpen();
            const shouldBeEnabled = loggedIn;

            if (loggedIn && !enabled) {
              _enable();
            } else if (!loggedIn && enabled) {
              _disable();
            };
          };
          const _login = _updateEnabled;
          rend.on('login', _login);
          const _logout = _updateEnabled;
          rend.on('logout', _logout);

          _updateEnabled();

          this._cleanup = () => {
            cleanup();

            multiplayerApi.removeListener('playerStatusUpdate', playerStatusUpdate);
            multiplayerApi.removeListener('playerEnter', playerEnter);
            multiplayerApi.removeListener('playerLeave', playerLeave);

            rend.removeListener('update', _update);
            rend.removeListener('login', _login);
            rend.removeListener('logout', _logout);
          };

          return multiplayerApi;
        }
      });
    }
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

export default Multiplayer;
