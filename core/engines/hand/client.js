const SIDES = ['left', 'right'];

class Hand {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {site: {url: siteUrl}, server: {enabled: serverEnabled}}} = archae;

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
      '/core/engines/input',
      '/core/engines/webvr',
      '/core/engines/rend',
      '/core/engines/multiplayer',
      '/core/utils/js-utils',
      '/core/utils/network-utils',
    ]).then(([
      three,
      input,
      webvr,
      rend,
      multiplayer,
      jsUtils,
      networkUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;
        const {AutoWs} = networkUtils;

        const localUserId = multiplayer.getId();

        const connection = (() => {
          const connection = new AutoWs(_relativeWsUrl('archae/handWs?id=' + localUserId));
          connection.on('message', msg => {
            const m = JSON.parse(msg.data);
            const {type} = m;

            if (type === 'init') {
              const {args} = m;
              const [userSpecs] = args;

              for (let i = 0; i < userSpecs.length; i++) {
                const userSpec = userSpecs[i];
                const {id: userId, hands: {left: leftId, right: rightId}} = userSpec;

                if (leftId !== null) {
                  const leftGrabbable = grabbables.find(grabbable => grabbable.id === leftId);
                  leftGrabbable.grab(userId, 'left');
                }
                if (rightId !== null) {
                  const rightGrabbable = grabbables.find(grabbable => grabbable.id === rightId);
                  rightGrabbable.grab(userId, 'right');
                }
              }
            } else if (type === 'grab') {
              const {args} = m;
              const [userId, side, id] = args;

              const grabbable = grabbables.find(grabbable => grabbable.id === id);
              grabbable.grab(userId, side);
            } else if (type === 'release') {
              const {args} = m;
              const [userId, side] = args;

              const remoteGrabState = remoteGrabStates.get(userId);
              const remoteGrabStateSide = remoteGrabState[side];
              const {grabbedGrabbable} = remoteGrabStateSide;
              grabbedGrabbable.release(userId, side);
            } else {
              console.warn('unknown hand message type:', type);
            }
          });
          return connection;
        })();

        const _broadcast = (method, args) => {
          const e = {
            method,
            args,
          };
          const es = JSON.stringify(e);
          connection.send(es);
        };

        const grabbables = [];

        const _makeGrabState = () => ({
          grabbedGrabbable: null,
        });
        const grabStates = {
          left: _makeGrabState(),
          right: _makeGrabState(),
        };

        const remoteGrabStates = new Map();
        const _makeRemoteGrabState = () => ({
          grabbedGrabbable: null,
        });
        const _makeRemoteGrabStates = () => ({
          left: _makeRemoteGrabState(),
          right: _makeRemoteGrabState(),
        });
        const _addRemoteUser = userId => {
          remoteGrabStates.set(userId, _makeRemoteGrabStates());
        };
        multiplayer.getPlayerStatuses().forEach((status, userId) => {
          _addRemoteUser(userId);
        });
        const _playerEnter = ({id: userId}) => {
          remoteGrabStates.set(userId, _makeRemoteGrabStates());
        };
        multiplayer.on('playerEnter', _playerEnter);
        const _playerLeave = ({id: userId}) => {
          remoteGrabStates.delete(userId);
        };
        multiplayer.on('playerLeave', _playerLeave);

        class Grabbable extends EventEmitter {
          constructor(id) {
            super();

            this.id = id;

            this.position = new THREE.Vector3();
            this.rotation = new THREE.Quaternion();
            this.scale = new THREE.Vector3(1, 1, 1);
          }

          setPosition(position) {
            this.position.copy(position);
          }

          distanceTo(position) {
            return this.position.distanceTo(position);
          }

          grab(userId, side) {
            const me = userId === localUserId;
            const e = {
              grabbable: this,
              side: side,
              me: me,
            };

            this.emit('grab', e);

            if (me) {
              const grabState = grabStates[side];
              grabState.grabbedGrabbable = this;

              _broadcast('grab', [side, this.id]);
            } else {
              const remoteGrabState = remoteGrabStates.get(userId);
              const remoteGrabStateSide = remoteGrabState[side];
              remoteGrabStateSide.grabbedGrabbable = this;
            }
          }

          release(userId, side) {
            const me = userId === localUserId;
            const e = {
              grabbable: this,
              side: side,
              me: me,
            };

            this.emit('release', e);

            if (me) {
              const grabState = grabStates[side];
              grabState.grabbedGrabbable = null;

              _broadcast('release', [side]);
            } else {
              const remoteGrabState = remoteGrabStates.get(userId);
              const remoteGrabStateSide = remoteGrabState[side];
              remoteGrabStateSide.grabbedGrabbable = null;
            }
          }

          update(position, rotation, scale) {
            this.position.copy(position);
            this.rotation.copy(rotation);
            this.scale.copy(scale);

            const e = {
              position,
              rotation,
              scale,
            };
            this.emit('update', e);
          }
        }

        const _getHoveredGrabbable = side => {
          const gamepad = gamepads[side];
          const {worldPosition: controllerPosition} = gamepad;
          const grabState = grabStates[side];

          let closestGrabbable = null;
          let closestGrabbableDistance = Infinity;
          for (let i = 0; i < grabbables.length; i++) {
            const grabbable = grabbables[i];
            const distance = grabbable.distanceTo(controllerPosition);

            if (distance < 0.2) {
              if (!closestGrabbable || (distance < closestGrabbableDistance)) {
                closestGrabbable = grabbable;
                closestGrabbableDistance = distance;
              }
            }
          }

          return closestGrabbable;
        };

        const _gripdown = e => {
          const {side} = e;
          const grabState = grabStates[side];
          const {grabbedGrabbable} = grabState;

          if (!grabbedGrabbable) {
            hoveredGrabbable = _getHoveredGrabbable(side);

            if (hoveredGrabbable) {
              hoveredGrabbable.grab(localUserId, side);
            }
          }
        };
        input.on('gripdown', _gripdown);
        const _gripup = e => {
          const {side} = e;
          const grabState = grabStates[side];
          const {grabbedGrabbable} = grabState;

          if (grabbedGrabbable) {
            grabbedGrabbable.release(localUserId, side);

            grabState.grabbedGrabbable = null;
          }
        };
        input.on('gripup', _gripup);

        const _update = () => {
          const {gamepads} = webvr.getStatus();

          const _updateLocalPositions = () => {
            SIDES.forEach(side => {
              const gamepad = gamepads[side];
              const grabState = grabStates[side];
              const {grabbedGrabbable} = grabState;

              if (grabbedGrabbable) {
                const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;
                grabbedGrabbable.update(controllerPosition, controllerRotation, controllerScale);
              }
            });
          };
          const _updateRemotePositions = () => {
            remoteGrabStates.forEach((remoteGrabState, userId) => {
              SIDES.forEach(side => {
                const remoteGrabStateSide = remoteGrabState[side];
                const {grabbedGrabbable} = remoteGrabStateSide;

                if (grabbedGrabbable) {
                  const remoteControllerMeshes = multiplayer.getRemoteControllerMeshes(userId);
                  const remoteControllerMesh = remoteControllerMeshes[side];
                  const {position, quaternion: rotation, scale} = remoteControllerMesh;

                  grabbedGrabbable.update(position, rotation, scale);
                }
              });
            });
          };

          _updateLocalPositions();
          _updateRemotePositions();
        };
        rend.on('update', _update);

        cleanups.push(() => {
          multiplayer.removeListener('playerEnter', _playerEnter);
          multiplayer.removeListener('playerLeave', _playerLeave);

          input.removeListener('gripdown', _gripdown);
          input.removeListener('gripup', _gripup);

          rend.removeListener('update', _update);
        });

        class HandApi {
          makeGrabbable(id) {
            const grabbable = new Grabbable(id);
            grabbables.push(grabbable);
            return grabbable;
          }

          destroyGrabbable(grabbable) {
            grabbables.splice(grabbables.indexOf(grabbable), 1);
          }
        }
        const handApi = new HandApi();

        return handApi;
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

module.exports = Hand;
