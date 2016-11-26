window.WebVRConfig = {
  CARDBOARD_UI_DISABLED: true,
  // FORCE_ENABLE_VR: false,
  ROTATE_INSTRUCTIONS_DISABLED: true,
  // PREDICTION_TIME_S: 0.040,
  TOUCH_PANNER_DISABLED: true,
  // YAW_ONLY: false,
  // MOUSE_KEYBOARD_CONTROLS_DISABLED: false,
  // DEFER_INITIALIZATION: false,
  // ENABLE_DEPRECATED_API: false,
  // BUFFER_SCALE: 0.5,
  // DIRTY_SUBMIT_FRAME_BINDINGS: false,
};
require('webvr-polyfill');

const DEFAULT_USER_HEIGHT = 1.6;

const webvrIconSrc = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" viewBox="0 0 90 90" enable-background="new 0 0 90 90" xml:space="preserve"><path d="M81.671,21.323c-2.085-2.084-72.503-1.553-74.054,0c-1.678,1.678-1.684,46.033,0,47.713  c0.558,0.559,12.151,0.896,26.007,1.012l3.068-8.486c0,0,1.987-8.04,7.92-8.04c6.257,0,8.99,9.675,8.99,9.675l2.555,6.848  c13.633-0.116,24.957-0.453,25.514-1.008C83.224,67.483,83.672,23.324,81.671,21.323z M24.572,54.582  c-6.063,0-10.978-4.914-10.978-10.979c0-6.063,4.915-10.978,10.978-10.978s10.979,4.915,10.979,10.978  C35.551,49.668,30.635,54.582,24.572,54.582z M64.334,54.582c-6.063,0-10.979-4.914-10.979-10.979  c0-6.063,4.916-10.978,10.979-10.978c6.062,0,10.978,4.915,10.978,10.978C75.312,49.668,70.396,54.582,64.334,54.582z"/></svg>`;

class WebVR {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestEngines([
      '/core/engines/three',
    ]).then(([
      three,
    ]) => {
      if (live) {
        const {THREE, scene, camera, renderer} = three;
        const {domElement} = renderer;

        return navigator.getVRDisplays()
          .then(displays => {
            const sortedDisplays = displays.sort((a, b) => {
              const diff = +_isPolyfillDisplay(a) - _isPolyfillDisplay(b);
              if (diff !== 0) {
                return diff;
              } else {
                return +_canPresent(b) - +_canPresent(a);
              }
            });
            let display = sortedDisplays[0];
            if (!_canPresent(display)) {
              display = new FakeVRDisplay();
            }

            return new Promise((accept, reject) => {
              const img = new Image();
              img.src = webvrIconSrc;
              img.onload = () => {
                const a = document.createElement('a');
                a.style.cssText = `\
position: absolute;
bottom: 0;
right: 0;
width: 100px;
height: 100px;
background-color: rgba(255, 255, 255, 0.5);
cursor: pointer;
`;
                a.addEventListener('click', e => {
                  display.requestPresent([
                    {
                      source: domElement,
                    }
                  ])
                    .then(() => {
                      console.log('success!');
                    })
                    .catch(err => {
                      console.log('failuer', err);
                    });
                });
                a.appendChild(img);
                document.body.appendChild(a);

                accept();
              };
              img.onerror = err => {
                reject(err);
              };
            }).then(() => {
              const _getStandingMatrix = () => {
                const result = new THREE.Matrix4();
                if (vrDisplay.stageParameters) {
                  result.fromArray(vrDisplay.stageParameters.sittingToStandingTransform);
                } else {
                  result.multiply(new THREE.Matrix4().makeTranslation(0, DEFAULT_USER_HEIGHT, 0));
                }
                return result;
              };
              const _getMatrixFromPose = (pose, standingMatrix) => {
                const position = pose.position !== null ? new THREE.Vector3().fromArray(pose.position) : new THREE.Vector3(0, 0, 0);
                const rotation = pose.orientation !== null ? new THREE.Quaternion().fromArray(pose.orientation) : new THREE.Quaternion(0, 0, 0, 1);
                const scale = new THREE.Vector3(1, 1, 1);
                const matrix = standingMatrix.clone().multiply(new THREE.Matrix4().compose(position, orientation, scale));
                return matrix;
              };
              const _getHmdStatus = ({standingMatrix}) => {
                const pose = display.getPose();

                const matrix = _getMatrixFromPose(pose, standingMatrix);

                return {
                  pose,
                  matrix,
                };
              };
              const _getControllerStatus = ({standingMatrix}) => {
                const gamepads = navigator.getGamepads();
                const leftGamepad = gamepads[0];
                const rightGamepad = gamepads[1];

                const _isGamepadAvailable = gamepad => gamepad !== undefined && gamepad.pose !== null && pose.position !== null && pose.orientation !== null;
                const _getGamepadPose = gamepad => {
                  const {pose, buttons: [padButton, triggerButton, gripButton, menuButton]} = gamepad;

                  const _getGamepadButtonStatus = button => {
                    if (button) {
                      const {touched, pressed, axes: [x, y], value} = button;
                      return {
                        touched,
                        pressed,
                        x,
                        y,
                        value,
                      };
                    } else {
                      return null;
                    }
                  };

                  const matrix = _getMatrixFromPose(pose, standingMatrix);
                  const buttons = {
                    pad: _getGamepadButtonStatus(padButton),
                    trigger: _getGamepadButtonStatus(triggerButton),
                    grip: _getGamepadButtonStatus(gripButton),
                    menu: _getGamepadButtonStatus(menuButton),
                  };

                  return {
                    pose,
                    matrix,
                    buttons,
                  };
                };

                return {
                  left: _isGamepadAvailable(leftGamepad) ? _getGamepadPose(leftGamepad) : null,
                  right: _isGamepadAvailable(]\rightGamepad) ? _getGamepadPose(rightGamepad) : null,
                };
              };

              const _requestAnimationFrame = fn => display.isPresenting ? display.requestAnimationFrame(fn) : requestAnimationFrame(fn);
              const _submitFrame = pose => {
                if (display.isPresenting) {
                  display.submitFrame(pose);
                }
              };
              const _update = fn => {
                const standingMatrix = _getStandingMatrix();
                const status = {
                  hmd: _getHmdStatus({standingMatrix}),
                  controller: _getControllerStatus({standingMatrix}),
                };

                fn(status);

                _submitFrame(status.hmd.pose);
              };

              return {
                requestAnimationFrame: _requestAnimationFrame,
                update: _update,
              };
            });
          });
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _isPolyfillDisplay = vrDisplay => /polyfill/i.test(vrDisplay.displayName);
const _canPresent = vrDisplay => vrDisplay.canPresecnt;

class FakeVRDisplay {
  constructor() {
    this.canPresent = true;
  }

  requestPresent([{source}]) {
    source.webkitRequestFullscreen();

    return Promise.resolve();
  }
}

module.exports = WebVR;
