const DEFAULT_GRAB_RADIUS = 0.1;

const SIDES = ['left', 'right'];

class Hands {
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
      '/core/engines/webvr',
      '/core/engines/rend',
      '/core/engines/cyborg',
      '/core/plugins/js-utils',
    ])
      .then(([
        webvr,
        rend,
        cyborg,
        jsUtils,
      ]) => {
        if (live) {
          const player = cyborg.getPlayer();

          const {events} = jsUtils;
          const {EventEmitter} = events;

          const _makeGrabState = () => ({
            grabber: null,
          });
          const grabStates = {
            left: _makeGrabState(),
            right: _makeGrabState(),
          };

          class Grabber extends EventEmitter  {
            constructor(side, object) {
              super();

              this.side = side;
              this.object = object;
            }

            release() {
              const {side, object} = this;

              const linearVelocity = player.getControllerLinearVelocity(side);
              const angularVelocity = player.getControllerAngularVelocity(side);
              const result = {
                side,
                object,
                linearVelocity,
                angularVelocity,
              };

              this.emit('release', result);

              return result;
            }
          }

          const _canGrab = (side, object, options) => {
            options = options || {};
            const {radius = DEFAULT_GRAB_RADIUS} = options;

            const grabState = grabStates[side];
            const {grabber} = grabState;

            if (!grabber) {
              const {gamepads} = webvr.getStatus();
              const gamepad = gamepads[side];

              if (gamepad) {
                const {position: controllerPosition} = gamepad;

                return controllerPosition.distanceTo(object.position) <= radius;
              } else {
                return false;
              }
            } else {
              return false;
            }
          };
          const _grab = (side, object) => {
            const grabState = grabStates[side];
            const {grabber} = grabState;

            if (!grabber) {
              const newGrabber = new Grabber(side, object);
              grabState.grabber = newGrabber;

              return newGrabber;
            } else {
              return null;
            }
          };
          const _release = (side) => {
            const grabState = grabStates[side];
            const {grabber} = grabState;

            if (grabber) {
              const result = grabber.release();

              grabState.grabber = null;

              return result;
            } else {
              return null;
            }
          };

          const _update = () => {
            const {gamepads} = webvr.getStatus();

            for (let i = 0; i < SIDES.length; i++) {
              const side = SIDES[i];
              const grabState = grabStates[side];
              const {grabber} = grabState;

              if (grabber) {
                const gamepad = gamepads[side];

                if (gamepad) {
                  const {object} = grabber;
                  const {position, rotation} = gamepad;

                  object.position.copy(position);
                  object.quaternion.copy(rotation);

                  grabber.emit('update', {
                    position,
                    rotation,
                  });
                }
              }
            }
          };
          rend.on('update', _update);

          this._cleanup = () => {
            rend.removeListener('update', _update);
          };

          return {
            canGrab: _canGrab,
            grab: _grab,
            release: _release,
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Hands;
