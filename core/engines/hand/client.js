const protocolUtils = require('./lib/utils/protocol-utils');

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

        const buffer = new ArrayBuffer(protocolUtils.BUFFER_SIZE);

        const localUserId = multiplayer.getId();

        const grabbables = {};

        const connection = (() => {
          const connection = new AutoWs(_relativeWsUrl('archae/handWs?id=' + localUserId));
          connection.on('message', msg => {
            const {data} = msg;

            if (typeof data === 'string') {
              const m = JSON.parse(data);
              const {type} = m;

              if (type === 'grab') {
                const {args} = m;
                const [n, userId, side] = args;

                const grabbable = grabbables[n];
                grabbable.userId = userId;
                grabbable.side = side;

                const e = {
                  userId,
                  side,
                  grabbable,
                };
                grabbable.emit('grab', e);
                handApi.emit('grab', e);
              } else if (type === 'release') {
                const {args} = m;
                const [n] = args;

                const grabbable = grabbables[n];
                const {userId, side} = grabbable;
                grabbable.userId = null;
                grabbable.side = null;

                const e = {
                  userId,
                  side,
                  grabbable,
                  live: true,
                  stopImmediatePropagation() {
                    e.live = false;
                  },
                };
                grabbable.emit('release', e);
                handApi.emit('release', e);
              } else if (type === 'data') {
                const {args} = m;
                const [n, key, value] = args;

                const grabbable = grabbables[n];
                if (grabbable) {
                  grabbable.setData(key, value);
                }

                const e = {
                  key,
                  value,
                  grabbable,
                };
                grabbable.emit('data', e);
                handApi.emit('data', e);
              } else {
                console.warn('unknown hand message type:', type);
              }
            } else {
              const n = protocolUtils.parseUpdateN(data);
              const grabbable = grabbables[n];
              protocolUtils.parseUpdate(grabbable.position, grabbable.rotation, grabbable.scale, grabbable.localPosition, grabbable.localRotation, grabbable.localScale, data);
              grabbable.emitUpdate();
            }
          });
          return connection;
        })();

        const _broadcastObject = (method, args) => {
          connection.send(JSON.stringify({
            method,
            args,
          }));
        };
        const _broadcastBuffer = buffer => {
          connection.send(buffer);
        };

        const _makeGrabState = () => ({
          grabbedGrabbable: null,
        });
        const grabStates = {
          left: _makeGrabState(),
          right: _makeGrabState(),
        };

        class Grabbable extends EventEmitter {
          constructor(
            n,
            position = new THREE.Vector3(),
            rotation = new THREE.Quaternion(),
            scale = new THREE.Vector3(1, 1, 1),
            localPosition = new THREE.Vector3(),
            localRotation = new THREE.Quaternion(),
            localScale = new THREE.Vector3(1, 1, 1),
          ) {
            super();

            this.n = n;
            this.position = position;
            this.rotation = rotation;
            this.scale = scale;
            this.localPosition = localPosition;
            this.localRotation = localRotation;
            this.localScale = localScale;

            this.userId = null;
            this.side = null;
          }

          isGrabbed() {
            return Boolean(this.userId);
          }

          getGrabberId() {
            return this.userId;
          }

          getGrabberSide() {
            return this.side;
          }

          distanceTo(p) {
            return this.position.distanceTo(p);
          }

          add() {
            const {n, position, rotation, scale, localPosition, localRotation, localScale} = this;

            _broadcastObject('addGrabbable', [n, position, rotation, scale, localPosition, localRotation, localScale]);
          }

          remove() {
            _broadcastObject('removeGrabbable', [this.n]);
          }

          grab(side) {
            const {n} = this;
            const userId = localUserId;

            this.userId = userId;
            this.side = side;

            const grabState = grabStates[side];
            grabState.grabbedGrabbable = this;

            _broadcastObject('grab', [n, side]);

            const e = {
              userId,
              side,
              grabbable: this,
            };
            this.emit('grab', e);
            handApi.emit('grab', e);
          }

          release() {
            const {userId} = this;

            if (userId) {
              const {n, side} = this;

              this.userId = null;
              this.side = null;

              for (let i = 0; i < SIDES.length; i++) {
                const side = SIDES[i];
                const grabState = grabStates[side];
                const {grabbedGrabbable} = grabState;

                if (grabbedGrabbable === this) {
                  grabState.grabbedGrabbable = null;
                }
              }

              _broadcastObject('release', [n]);

              const e = {
                userId,
                side,
                grabbable: this,
                live: true,
                stopImmediatePropagation() {
                  e.live = false;
                },
              };
              this.emit('release', e);
              handApi.emit('release', e);
            }
          }

          setData(key, value) {
            const {n} = this;

            _broadcastObject('data', [n, key, value]);

            const e = {
              key,
              value,
              grabbable: this,
            };
            this.emit('data', e);
            handApi.emit('data', e);
          }

          destroy() {
            const {userId, side} = this;

            for (let i = 0; i < SIDES.length; i++) {
              const side = SIDES[i];
              const grabState = grabStates[side];
              const {grabbedGrabbable} = grabState;

              if (grabbedGrabbable === this) {
                grabState.grabbedGrabbable = null;
              }
            }

            const e = {
              userId,
              side,
              grabbable: this,
            };
            this.emit('destroy', e);
            handApi.emit('destroy', e);
          }

          setState(position, rotation, scale) {
            if (!this.position.equals(position) || !this.rotation.equals(rotation) || !this.scale.equals(scale)) {
              this.position.copy(position);
              this.rotation.copy(rotation);
              this.scale.copy(scale);

              this.emitUpdate();
              this.broadcastUpdate();
            }
          }

          setLocalTransform(localPosition, localRotation, localScale) {
            if (!this.localPosition.equals(localPosition) || !this.localRotation.equals(localRotation) || !this.localScale.equals(localScale)) {
              this.localPosition.copy(localPosition);
              this.localRotation.copy(localRotation);
              this.localScale.copy(localScale);

              this.emitUpdate();
              this.broadcastUpdate();
            }
          }

          setStateLocal(position, rotation, scale) {
            if (!this.position.equals(position) || !this.rotation.equals(rotation) || !this.scale.equals(scale)) {
              this.position.copy(position);
              this.rotation.copy(rotation);
              this.scale.copy(scale);

              this.emitUpdate();
            }
          }

          setFullStateLocal(position, rotation, scale, localPosition, localRotation, localScale) {
            if (!this.position.equals(position) || !this.rotation.equals(rotation) || !this.scale.equals(scale) || !this.localPosition.equals(localPosition) || !this.localRotation.equals(localRotation) || !this.localScale.equals(localScale)) {
              this.position.copy(position);
              this.rotation.copy(rotation);
              this.scale.copy(scale);
              this.localPosition.copy(localPosition);
              this.localRotation.copy(localRotation);
              this.localScale.copy(localScale);

              this.emitUpdate();
            }
          }

          emitUpdate() {
            this.emit('update');
          }

          broadcastUpdate() {
            _broadcastBuffer(protocolUtils.stringifyUpdate(this.n, this.position, this.rotation, this.scale, this.localPosition, this.localRotation, this.localScale, buffer, 0));
          }
        }

        const _getHoveredGrabbable = side => {
          const {gamepads} = webvr.getStatus();
          const gamepad = gamepads[side];
          const {worldPosition: controllerPosition} = gamepad;
          const grabState = grabStates[side];

          let bestDistance = Infinity;
          let bestGrabbable = null;
          for (const n in grabbables) {
            const grabbable = grabbables[n];

            const distance = grabbable.distanceTo(controllerPosition);
            if (distance < GRAB_DISTANCE && distance < bestDistance) {
              bestDistance = distance;
              bestGrabbable = grabbable;
            }
          }
          return bestGrabbable;
        };

        const _gripdown = e => {
          const {side} = e;
          const grabState = grabStates[side];
          const {grabbedGrabbable} = grabState;

          if (!grabbedGrabbable) {
            const hoveredGrabbable = _getHoveredGrabbable(side);

            if (hoveredGrabbable) {
              hoveredGrabbable.grab(side);

              e.stopImmediatePropagation();
            }
          }
        };
        input.on('gripdown', _gripdown, {
          priority: -3,
        });
        const _gripup = e => {
          const {side} = e;
          const grabState = grabStates[side];
          const {grabbedGrabbable} = grabState;

          if (grabbedGrabbable) {
            grabbedGrabbable.release();

            grabState.grabbedGrabbable = null;

            e.stopImmediatePropagation();
          }
        };
        input.on('gripup', _gripup, {
          priority: -3,
        });

        const _update = () => {
          const {gamepads} = webvr.getStatus();

          for (let i = 0; i < SIDES.length; i++) {
            const side = SIDES[i];
            const gamepad = gamepads[side];
            const grabState = grabStates[side];
            const {grabbedGrabbable} = grabState;

            if (grabbedGrabbable) {
              const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;
              grabbedGrabbable.setState(controllerPosition, controllerRotation, controllerScale);
            }
          }
        };
        rend.on('update', _update);

        cleanups.push(() => {
          input.removeListener('gripdown', _gripdown);
          input.removeListener('gripup', _gripup);

          rend.removeListener('update', _update);
        });

        class HandApi extends EventEmitter {
          makeGrabbable(n, position, rotation, scale, localPosition, localRotation, localScale) {
            const grabbable = new Grabbable(n, position, rotation, scale, localPosition, localRotation, localScale);
            this.addGrabbable(grabbable);
            return grabbable;
          }

          getGrabbedGrabbable(side) {
            return grabStates[side].grabbedGrabbable;
          }

          addGrabbable(grabbable) {
            const {n} = grabbable;

            if (!grabbables[n]) {
              grabbable.add();

              grabbables[n] = grabbable;
            }
          }

          destroyGrabbable(grabbable) {
            const {n} = grabbable;

            if (grabbables[n]) {
              grabbable.destroy();
              grabbable.remove();

              delete grabbables[n];
            }
          }
        }
        HandApi.prototype.Grabbable = Grabbable;
        const handApi = new HandApi();

        return handApi;
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _arrayEquals = (a, b) => a.length === b.length && a.every((ai, i) => ai === b[i]);
const _relativeWsUrl = s => {
  const l = window.location;
  return ((l.protocol === 'https:') ? 'wss://' : 'ws://') + l.host + l.pathname + (!/\/$/.test(l.pathname) ? '/' : '') + s;
};

module.exports = Hand;
