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
      '/core/engines/input',
      '/core/engines/three',
      '/core/engines/webvr',
      '/core/engines/cyborg',
      '/core/plugins/js-utils',
    ])
      .then(([
        input,
        three,
        webvr,
        cyborg,
        jsUtils,
      ]) => {
        if (live) {
          const {THREE} = three;
          const player = cyborg.getPlayer();

          const {events} = jsUtils;
          const {EventEmitter} = events;

          const _decomposeObjectMatrixWorld = object => {
            const {matrixWorld} = object;
            const position = new THREE.Vector3();
            const rotation = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            matrixWorld.decompose(position, rotation, scale);
            return {position, rotation, scale};
          };

          const _makeGrabState = () => ({
            grabObject: null,
          });
          const grabStates = {
            left: _makeGrabState(),
            right: _makeGrabState(),
          };

          const _gripup = e => {
            const {side} = e;
            const grabState = grabStates[side];
            const {grabObject} = grabState;

            if (grabObject) {
              handsApi.release(side);

              e.stopImmediatePropagation();
            }
          };
          input.on('gripup', _gripup);

          this._cleanup = () => {
            input.removeListener('gripup', _gripup);
          };

          class HandsApi extends EventEmitter {
            canGrab(side, object, options) {
              options = options || {};
              const {radius = DEFAULT_GRAB_RADIUS} = options;

              const grabState = grabStates[side];
              const {grabObject} = grabState;

              if (!grabObject) {
                const {gamepads} = webvr.getStatus();
                const gamepad = gamepads[side];

                if (gamepad) {
                  const {position: controllerPosition} = gamepad;
                  const {position: objectPosition} = _decomposeObjectMatrixWorld(object);

                  return controllerPosition.distanceTo(objectPosition) <= radius;
                } else {
                  return false;
                }
              } else {
                return false;
              }
            }

            getBestGrabbable(side, objects, options) {
              options = options || {};
              const {radius = DEFAULT_GRAB_RADIUS} = options;

              const grabState = grabStates[side];
              const {grabObject} = grabState;

              if (!grabObject) {
                const {gamepads} = webvr.getStatus();
                const gamepad = gamepads[side];

                if (gamepad) {
                  const {position: controllerPosition} = gamepad;

                  const objectDistanceSpecs = objects.map(object => {
                    const {position: objectPosition} = _decomposeObjectMatrixWorld(object);
                    const distance = controllerPosition.distanceTo(objectPosition);
                    return {
                      object,
                      distance,
                    };
                  }).filter(({distance}) => distance <= radius);

                  if (objectDistanceSpecs.length > 0) {
                    return objectDistanceSpecs.sort((a, b) => a.distance - b.distance)[0].object;
                  } else {
                    return null;
                  }
                } else {
                  return null;
                }
              } else {
                return null;
              }
            }

            grab(side, object) {
              const grabState = grabStates[side];
              const {grabObject} = grabState;

              if (!grabObject) {
                const controllers = cyborg.getControllers();
                const controller = controllers[side];
                const {mesh: controllerMesh} = controller;
                controllerMesh.add(object);

                grabState.grabObject = object;

                return true;
              } else {
                return false;
              }
            }

            release(side, object) {
              const grabState = grabStates[side];
              const {grabObject} = grabState;

              if (grabObject && (object === undefined || object === grabObject)) {
                const {position, rotation, scale} = _decomposeObjectMatrixWorld(grabObject);
                const linearVelocity = player.getControllerLinearVelocity(side);
                const angularVelocity = player.getControllerAngularVelocity(side);
                const result = {
                  side,
                  object: grabObject,
                  position,
                  rotation,
                  scale,
                  linearVelocity,
                  angularVelocity,
                };

                const controllers = cyborg.getControllers();
                const controller = controllers[side];
                const {mesh: controllerMesh} = controller;
                controllerMesh.remove(grabObject);

                grabState.grabObject = null;

                this.emit('release', result);

                return result;
              } else {
                return null;
              }
            }

            peek(side) {
              const grabState = grabStates[side];
              const {grabObject} = grabState;

              return grabObject || null;
            }
          }
          const handsApi = new HandsApi();

          return handsApi;
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Hands;
