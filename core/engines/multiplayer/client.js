const protocolUtils = require('./lib/utils/protocol-utils');

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
      '/core/engines/resource',
      '/core/engines/biolumi',
      '/core/engines/rend',
      '/core/utils/js-utils',
      '/core/utils/network-utils',
      '/core/utils/skin-utils',
    ]).then(([
      three,
      webvr,
      resource,
      biolumi,
      rend,
      jsUtils,
      networkUtils,
      skinUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {models: {hmdModelMesh, controllerModelMesh}} = resource;
        const {events} = jsUtils;
        const {EventEmitter} = events;
        const {AutoWs} = networkUtils;

        const zeroVector = new THREE.Vector3();
        const zeroQuaternion = new THREE.Quaternion();
        const oneVector = new THREE.Vector3(1, 1, 1);

        const buffer = new ArrayBuffer(protocolUtils.BUFFER_SIZE);

        let connection = null;
        const _addressChange = ({address, username}) => {
          let pendingMessage = null;

          connection = new AutoWs(_relativeWsUrl('archae/multiplayerWs?id=' + encodeURIComponent(String(multiplayerApi.getId())) + '&address=' + encodeURIComponent(address) + '&username=' + encodeURIComponent(username)));
          connection.on('message', msg => {
            const {data} = msg;

            if (typeof data === 'string') {
              const m = JSON.parse(data);
              const {type} = m;

              if (type === 'playerEnter') {
                const {n, username} = m;
                multiplayerApi.emit('playerEnter', {
                  id: n,
                  username,
                });
              } else if (type === 'playerLeave') {
                const {n} = m;
                multiplayerApi.emit('playerLeave', n);
              } else if (type === 'setSkin') {
                pendingMessage = m;
              } else if (type === 'clearSkin') {
                _handleClearSkinEntry(m);
              } else {
                console.log('unknown message type', JSON.stringify(type));
              }
            } else {
              if (!pendingMessage) { // update
                _handleStatusMessage(data);
              } else { // pending message
                _handleSetSkinEntry(pendingMessage, new Uint8Array(data));
                pendingMessage = null;
              }
            }
          });

          const _handleStatusMessage = buffer => {
            const n = protocolUtils.parseUpdateN(buffer);

            const playerStatus = multiplayerApi.getPlayerStatus(n);
            protocolUtils.parseUpdate(
              playerStatus.hmd.position,
              playerStatus.hmd.rotation,
              playerStatus.hmd.scale,
              playerStatus.gamepads.left.position,
              playerStatus.gamepads.left.rotation,
              playerStatus.gamepads.left.scale,
              playerStatus.gamepads.right.position,
              playerStatus.gamepads.right.rotation,
              playerStatus.gamepads.right.scale,
              playerStatus.metadata.menu,
              playerStatus.metadata.menu.position,
              playerStatus.metadata.menu.rotation,
              playerStatus.metadata.menu.scale,
              buffer,
              0
            );

            multiplayerApi.emit('playerStatusUpdate', n);
          };
          const _handleSetSkinEntry = ({n}, skinImgBuffer) => {
            multiplayerApi.setPlayerSkin(n, skinImgBuffer);
          };
          const _handleClearSkinEntry = ({n}) => {
            multiplayerApi.setPlayerSkin(n, null);
          };

          cleanups.push(() => {
            multiplayerApi.reset();

            connection.destroy();
          });
        };
        rend.once('addressChange', _addressChange);

        class MutiplayerInterface extends EventEmitter {
          constructor(n) {
            super();

            this.n = n;

            this.playerStatuses = new Map();
            this.playerUsernames = new Map();
            this.remotePlayerMeshes = new Map();
            this.remotePlayerSkinMeshes = new Map();
          }

          getId() {
            return this.n;
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

          getPlayerStatus(n) {
            return this.playerStatuses.get(n) || null;
          }


          setPlayerSkin(n, skinImgBuffer) {
            const oldSkinMesh = this.remotePlayerSkinMeshes.get(n);
            if (oldSkinMesh) {
              scene.remove(oldSkinMesh);
              oldSkinMesh.destroy();
              this.remotePlayerSkinMeshes.delete(oldSkinMesh);
            }

            if (skinImgBuffer) {
              const newSkinImg = _makeImg(skinImgBuffer, 64, 64);
              const newSkinMesh = skinUtils.makePlayerMesh(newSkinImg);
              scene.add(newSkinMesh);
              this.remotePlayerSkinMeshes.set(n, newSkinMesh);
            }
          }

          addPlayer(n, username) {
            const status = _makePlayerStatus();
            this.playerStatuses.set(n, status);

            this.playerUsernames.set(n, username);

            const remotePlayerMesh = _makeRemotePlayerMesh(username);
            remotePlayerMesh.update(status);
            scene.add(remotePlayerMesh);
            this.remotePlayerMeshes.set(n, remotePlayerMesh);

            rend.setStatus('users', multiplayerApi.getUsers());
          }

          removePlayer(n) {
            this.playerStatuses.delete(n);

            this.playerUsernames.delete(n);

            const remotePlayerMesh = this.remotePlayerMeshes.get(n);
            scene.remove(remotePlayerMesh);
            remotePlayerMesh.destroy();
            this.remotePlayerMeshes.delete(n);

            const skinMesh = this.remotePlayerSkinMeshes.get(n);
            if (skinMesh) {
              scene.remove(skinMesh);
              skinMesh.destroy();
              this.remotePlayerSkinMeshes.delete(n);
            }

            rend.setStatus('users', multiplayerApi.getUsers());           
          }

          getUsers() {
            const {playerUsernames} = this;
            const result = Array(playerUsernames.size);
            let i = 0;
            playerUsernames.forEach(username => {
              result[i++] = username;
            });
            return result.sort((a, b) => a.localeCompare(b));
          }

          updateSkin(skinImgBuffer) {
            if (skinImgBuffer) {
              connection.send(JSON.stringify({
                type: 'setSkin',
                n: n,
              }));
              connection.send(skinImgBuffer);
            } else {
              connection.send(JSON.stringify({
                type: 'clearSkin',
                n: n,
              }));
            }
          }

          getRemotePlayerMesh(n) {
            return this.remotePlayerMeshes.get(n) || null;
          }

          getRemotePlayerSkinMesh(n) {
            return this.remotePlayerSkinMeshes.get(n) || null;
          }

          getRemoteControllerMeshes(n) {
            const remotePlayerMesh = this.getRemotePlayerMesh(n);
            return remotePlayerMesh ? remotePlayerMesh.controllers : null;
          }

          reset() {
            const {remotePlayerMeshes: oldRemotePlayerMeshes} = this;

            this.playerStatuses = new Map();
            this.playerUsernames = new Map();
            this.remotePlayerMeshes = new Map();

            oldRemotePlayerMeshes.forEach(mesh => {
              scene.remove(mesh);
            });

            rend.setStatus('users', multiplayerApi.getUsers());
          }
        }
        const multiplayerApi = new MutiplayerInterface(_makeN());

        const _makeRemotePlayerMesh = username => {
          const object = new THREE.Object3D();

          const hmd = hmdModelMesh.clone();
          object.add(hmd);
          object.hmd = hmd;

          /* const label = resource.makePlayerLabelMesh({
            username: status.username,
          });
          object.add(label);
          object.label = label; */

          const menu = resource.makePlayerMenuMesh({
            username,
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
              hmd.position.copy(status.hmd.position);
              hmd.quaternion.copy(status.hmd.rotation);
              hmd.scale.copy(status.hmd.scale);
              // hmd.updateMatrixWorld();
            };
            const _updateControllers = () => {
              controllers.left.position.fromArray(status.gamepads.left.position);
              controllers.left.quaternion.fromArray(status.gamepads.left.rotation);
              controllers.left.scale.fromArray(status.gamepads.left.scale);
              // controllers.left.updateMatrixWorld();

              controllers.right.position.fromArray(status.gamepads.right.position);
              controllers.right.quaternion.fromArray(status.gamepads.right.rotation);
              controllers.right.scale.fromArray(status.gamepads.right.scale);
              // rightController.updateMatrixWorld();
            };
            /* const _updateLabel = () => {
              const {hmd: hmdStatus, username} = status;

              label.update({
                hmdStatus,
                username,
              });
            }; */
            const _updateMetadata = () => {
              menu.update(status.metadata.menu);
            };
            const _updateMatrix = () => {
              object.updateMatrixWorld();
            };

            _updateHmd();
            _updateControllers();
            // _updateLabel();
            _updateMetadata();
            _updateMatrix();
          };
          object.destroy = () => {
            // label.destroy();
          };

          return object;
        };

        const playerStatusUpdate = n => {
          const status = multiplayerApi.getPlayerStatus(n);

          const remotePlayerMesh = multiplayerApi.getRemotePlayerMesh(n);
          remotePlayerMesh.update(status);

          const remotePlayerSkinMesh = multiplayerApi.getRemotePlayerSkinMesh(n);
          if (remotePlayerSkinMesh) {
            remotePlayerSkinMesh.update(status);
          }
        };
        const playerEnter = ({id: n, username}) => {
          multiplayerApi.addPlayer(n, username);
        };
        const playerLeave = n => {
          multiplayerApi.removePlayer(n);
        };
        multiplayerApi.on('playerStatusUpdate', playerStatusUpdate);
        multiplayerApi.on('playerEnter', playerEnter);
        multiplayerApi.on('playerLeave', playerLeave);

        const _makePlayerStatus = () => ({
          hmd: {
            position: zeroVector.clone(),
            rotation: zeroQuaternion.clone(),
            scale: oneVector.clone(),
          },
          gamepads: {
            left: {
              position: zeroVector.clone(),
              rotation: zeroQuaternion.clone(),
              scale: oneVector.clone(),
            },
            right: {
              position: zeroVector.clone(),
              rotation: zeroQuaternion.clone(),
              scale: oneVector.clone(),
            },
          },
          metadata: {
            menu: {
              open: false,
              position: zeroVector.clone(),
              rotation: zeroQuaternion.clone(),
              scale: oneVector.clone(),
            },
          },
        });
        const localStatus = _makePlayerStatus();
        const _update = () => {
          const status = webvr.getStatus();
          const menuState = rend.getMenuState();

          let updated = false;
          const _updateHmd = () => {
            const {hmd} = status;
            const {worldPosition: hmdPosition, worldRotation: hmdRotation, worldScale: hmdScale} = hmd;

            if (!localStatus.hmd.position.equals(hmdPosition) || !localStatus.hmd.rotation.equals(hmdRotation)) {
              localStatus.hmd.position.copy(hmdPosition);
              localStatus.hmd.rotation.copy(hmdRotation);
              localStatus.hmd.scale.copy(hmdScale);

              updated = true;
            }
          };
          const _updateControllers = () => {
            const {gamepads} = status;

            for (let i = 0; i < SIDES.length; i++) {
              const side = SIDES[i];
              const gamepad = gamepads[side];

              if (gamepad) {
                const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;

                const lastGamepadStatus = localStatus.gamepads[side];
                if (
                  !lastGamepadStatus ||
                  !lastGamepadStatus.position.equals(controllerPosition) ||
                  !lastGamepadStatus.rotation.equals(controllerRotation) ||
                  !lastGamepadStatus.scale.equals(controllerScale)
                ) {
                  localStatus.gamepads[side].position.copy(controllerPosition);
                  localStatus.gamepads[side].rotation.copy(controllerRotation);
                  localStatus.gamepads[side].scale.copy(controllerScale);

                  updated = true;
                }
              }
            }
          };
          const _updateMetadata = () => {
            if (
              menuState.open !== localStatus.metadata.menu.open ||
              !menuState.position.equals(localStatus.metadata.menu.position) ||
              !menuState.rotation.equals(localStatus.metadata.menu.rotation) ||
              !menuState.scale.equals(localStatus.metadata.menu.scale)
            ) {
              localStatus.metadata.menu.open = menuState.open;
              localStatus.metadata.menu.position.copy(menuState.position);
              localStatus.metadata.menu.rotation.copy(menuState.rotation);
              localStatus.metadata.menu.scale.copy(menuState.scale);

              updated = true;
            }
          };
          const _sendUpdate = () => {
            if (updated) {
              protocolUtils.stringifyUpdate(multiplayerApi.getId(), localStatus, buffer, 0);
              connection.send(buffer);
            }
          };

          _updateHmd();
          _updateControllers();
          _updateMetadata();
          _sendUpdate();
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
const _makeN = () => Math.floor(Math.random() * 0xFFFFFFFF);
const _arrayEquals = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((ae, i) => b[i] === ae);
const _makeImg = (imgBuffer, width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, width, height);
  imageData.data.set(imgBuffer);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

module.exports = Multiplayer;
