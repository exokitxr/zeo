const SIDES = ['left', 'right'];

class Hand {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {metadata: {site: {url: siteUrl}, home: {enabled: homeEnabled}, server: {enabled: serverEnabled}}} = archae;

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
      '/core/utils/js-utils',
    ]).then(([
      three,
      input,
      webvr,
      rend,
      jsUtils,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;

        const grabbables = [];

        const _makeGrabState = () => ({
          hoveredGrabbable: null,
          grabbedGrabbable: null,
        });
        const grabStates = {
          left: _makeGrabState(),
          right: _makeGrabState(),
        };

        class Grabbable extends EventEmitter {
          constructor() {
            super();

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

          grab(side) {
            const e = {
              grabbable: this,
              side: side,
            };

            this.emit('grab', e);
            handApi.emit('grab', e);
          }

          release(side) {
            const e = {
              grabbable: this,
              side: side,
            };

            this.emit('release', e);
            handApi.emit('release', e);
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
            handApi.emit('update', e);
          }
        }

        const _gripdown = e => {
          const {side} = e;
          const grabState = grabStates[side];
          const {grabbedGrabbable} = grabState;

          if (!grabbedGrabbable) {
            const {hoveredGrabbable} = grabState;

            if (hoveredGrabbable) {
              const grabbedGrabbable = hoveredGrabbable;
              grabState.grabbedGrabbable = grabbedGrabbable;

              grabbedGrabbable.grab(side);
            }
          }
        };
        input.on('gripdown', _gripdown);
        const _gripup = e => {
          const {side} = e;
          const grabState = grabStates[side];
          const {grabbedGrabbable} = grabState;

          if (grabbedGrabbable) {
            grabbedGrabbable.release(side);

            grabState.grabbedGrabbable = null;
          }
        };
        input.on('gripup', _gripup);

        const _update = () => {
          const {gamepads} = webvr.getStatus();

          const _updateStates = () => {
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
          const _updateHovers = () => {
            SIDES.forEach(side => {
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

              grabState.hoveredGrabbable = closestGrabbable;
            });
          };

          _updateStates();
          _updateHovers();
        };
        rend.on('update', _update);

        cleanups.push(() => {
          input.removeListener('gripdown', _gripdown);
          input.removeListener('gripup', _gripup);
          rend.removeListener('update', _update);
        });

        class HandApi extends EventEmitter {
          makeGrabbable() {
            const grabbable = new Grabbable();
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

module.exports = Hand;
