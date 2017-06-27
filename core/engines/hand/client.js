const GRAB_DISTANCE = 0.2;

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

        const grabbables = {};

        const connection = (() => {
          const connection = new AutoWs(_relativeWsUrl('archae/handWs?id=' + localUserId));
          connection.on('message', msg => {
            const m = JSON.parse(msg.data);
            const {type} = m;

            if (type === 'grab') {
              const {args} = m;
              const [id, userId, side] = args;

              const grabbable = grabbables[id];
              grabbable.userId = userId;
              grabbable.side = side;

              grabbable.emit('grab', {
                userId,
                side,
              });
            } else if (type === 'release') {
              const {args} = m;
              const [id] = args;

              const grabbable = grabbables[id];
              const {userId, side} = grabbable;
              grabbable.userId = null;
              grabbable.side = null;

              grabbable.emit('release', {
                userId,
                side,
              });
            } else if (type === 'update') {
              const {args} = m;
              const [id, position, rotation, scale] = args;

              const grabbable = grabbables[id];
              grabbable.position = position;
              grabbable.rotation = rotation;
              grabbable.scale = scale;

              grabbable.emit('update', {
                position,
                rotation,
                scale,
              });
            } else if (type === 'destroy') {
              const {args} = m;
              const [id] = args;

              const grabbable = grabbables[id];
              delete grabbables[id];

              grabbable.emit('destroy');
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

        const _makeGrabState = () => ({
          grabbedGrabbable: null,
        });
        const grabStates = {
          left: _makeGrabState(),
          right: _makeGrabState(),
        };

        class Grabbable extends EventEmitter {
          constructor(id, {position = [0, 0, 0], rotation = [0, 0, 0, 1], scale = [1, 1, 1]} = {}) {
            super();

            this.id = id;
            this.position = position;
            this.rotation = rotation;
            this.scale = scale;

            this.userId = null;
            this.side = null;
          }

          distanceTo(point) {
            return new THREE.Vector3().fromArray(this.position).distanceTo(point);
          }

          add() {
            const {id, position, rotation, scale} = this;

            _broadcast('addGrabbable', [id, position, rotation, scale]);
          }

          remove() {
            const {id} = this;

            _broadcast('removeGrabbable', [id]);

            this.emit('destroy');
          }

          grab(side) {
            const {id} = this;
            const userId = localUserId;

            this.userId = userId;
            this.side = side;

            const grabState = grabStates[side];
            grabState.grabbedGrabbable = this;

            _broadcast('grab', [id, userId, side]);

            this.emit('grab', {
              userId,
              side,
            });
          }

          release() {
            const {userId} = this;

            if (userId) {
              const {id, side} = this;

              this.userId = null;
              this.side = null;

              SIDES.forEach(side => {
                const grabState = grabStates[side];
                const {grabbedGrabbable} = grabState;

                if (grabbedGrabbable === this) {
                  grabState.grabbedGrabbable = null;
                }
              });

              _broadcast('release', [id]);

              this.emit('release', {
                userId,
                side,
              });
            }
          }

          setState(position, rotation, scale) {
            const {id} = this;

            this.position = position;
            this.rotation = rotation;
            this.scale = scale;

            _broadcast('setState', [id, position, rotation, scale]);

            this.emit('update', {
              position,
              rotation,
              scale,
            });
          }

          update(position, rotation, scale) {
            const {id} = this;

            this.position = position;
            this.rotation = rotation;
            this.scale = scale;

            _broadcast('update', [id, position, rotation, scale]);

            this.emit('update', {
              position,
              rotation,
              scale,
            });
          }
        }

        const _getHoveredGrabbable = side => {
          const {gamepads} = webvr.getStatus();
          const gamepad = gamepads[side];
          const {worldPosition: controllerPosition} = gamepad;
          const grabState = grabStates[side];

          let closestGrabbable = null;
          let closestGrabbableDistance = Infinity;
          for (const id in grabbables) {
            const grabbable = grabbables[id];
            const distance = grabbable.distanceTo(controllerPosition);

            if (distance < GRAB_DISTANCE) {
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
            const hoveredGrabbable = _getHoveredGrabbable(side);

            if (hoveredGrabbable) {
              hoveredGrabbable.grab(side);
            }
          }
        };
        input.on('gripdown', _gripdown);
        const _gripup = e => {
          const {side} = e;
          const grabState = grabStates[side];
          const {grabbedGrabbable} = grabState;

          if (grabbedGrabbable) {
            grabbedGrabbable.release();

            grabState.grabbedGrabbable = null;
          }
        };
        input.on('gripup', _gripup);

        const _update = () => {
          const {gamepads} = webvr.getStatus();

          SIDES.forEach(side => {
            const gamepad = gamepads[side];
            const grabState = grabStates[side];
            const {grabbedGrabbable} = grabState;

            if (grabbedGrabbable) {
              const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;
              grabbedGrabbable.update(controllerPosition.toArray(), controllerRotation.toArray(), controllerScale.toArray());
            }
          });
        };
        rend.on('update', _update);

        cleanups.push(() => {
          input.removeListener('gripdown', _gripdown);
          input.removeListener('gripup', _gripup);

          rend.removeListener('update', _update);
        });

        class HandApi {
          makeGrabbable(id) {
            const grabbable = new Grabbable(id);
            grabbable.add();
            grabbables[id] = grabbable;
            return grabbable;
          }

          destroyGrabbable(grabbable) {
            const {id} = grabbable;
            grabbable.remove();
            delete grabbables[id];
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
