const SynchronousPromise = require('synchronous-promise').SynchronousPromise;
const mod = require('mod-loop');

const VREffect = require('./lib/three-extra/VREffect');

class VRFrameDataFake {
  constructor() {
    this.leftProjectionMatrix = new Float32Array(16);
    this.leftViewMatrix = new Float32Array(16);
    this.rightProjectionMatrix = new Float32Array(16);
    this.rightViewMatrix = new Float32Array(16);
    this.pose = null;
  }
}
class VRPoseFake {
  constructor(position, orientation) {
    this.position = position;
    this.orientation = orientation;
  }
}

const DEFAULT_USER_HEIGHT = 1.6;
const DEFAULT_USER_IPD = 62 / 1000;
const DEFAULT_USER_FOV = 110;
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 1080;
const DEFAULT_ASPECT_RATIO = DEFAULT_WIDTH / DEFAULT_HEIGHT;

const CONTROLLER_DEFAULT_OFFSETS = [0.2, -0.1, -0.2];

const POSITION_SPEED = 0.05;
const POSITION_SPEED_FAST = POSITION_SPEED * 5;
const ROTATION_SPEED = 0.02 / (Math.PI * 2);

const BUTTONS = {
  PAD: 0,
  TRIGGER: 1,
  GRIP: 2,
  MENU: 3,
};

const SIDES = ['left', 'right'];

class EventSpec {
  constructor(buttonName, rootName, downName, upName, touchName, touchdownName, touchupName) {
    this.buttonName = buttonName;
    this.rootName = rootName;
    this.downName = downName;
    this.upName = upName;
    this.touchName = touchName;
    this.touchdownName = touchdownName;
    this.touchupName = touchupName;
  }
}
class VrEvent {
  constructor(side, axes) {
    this.side = side;
    this.axes = axes;
  }
}

const EVENT_SPECS = [
  new EventSpec('trigger', 'trigger', 'triggerdown', 'triggerup', 'triggertouch', 'triggertouchdown', 'triggertouchup'),
  new EventSpec('pad', 'pad', 'paddown', 'padup', 'padtouch', 'padtouchdown', 'padtouchup'),
  new EventSpec('grip', 'grip', 'gripdown', 'gripup', 'griptouch', 'griptouchdown', 'griptouchup'),
  new EventSpec('menu', 'menu', 'menudown', 'menuup', 'menutouch', 'menutouchdown', 'menutouchup'),
];

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

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/bootstrap',
        '/core/engines/input',
        '/core/engines/three',
        '/core/utils/js-utils',
      ]),
      navigator.getVRDisplays(),
    ]).then(([
      [
        bootstrap,
        input,
        three,
        jsUtils,
      ],
      displays,
    ]) => {
      if (live) {
        const {THREE, scene, camera, renderer} = three;
        const {domElement} = renderer;
        const {events} = jsUtils;
        const EventEmitter = events;

        const _decomposeMatrix = matrix => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };
        const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);

        const zeroVector = new THREE.Vector3();
        const zeroQuaternion = new THREE.Quaternion();

        const THREEVREffect = VREffect(THREE);

        const bestDisplay = displays.sort((a, b) => {
          const diff = +_isPolyfillDisplay(a) - _isPolyfillDisplay(b);
          if (diff !== 0) {
            return diff;
          } else {
            return +_canPresent(b) - +_canPresent(a);
          }
        })[0];

        const _getPropertiesFromPose = pose => {
          const position = (pose && pose.position !== null) ? new THREE.Vector3().fromArray(pose.position) : new THREE.Vector3(0, 0, 0);
          const rotation = (pose && pose.orientation !== null) ? new THREE.Quaternion().fromArray(pose.orientation) : new THREE.Quaternion(0, 0, 0, 1);
          const scale = new THREE.Vector3(1, 1, 1);
          return {position, rotation, scale};
        };

        class HmdStatus {
          constructor(pose, position, rotation, scale, worldPosition, worldRotation, worldScale) {
            this.pose = pose;
            this.position = position;
            this.rotation = rotation;
            this.scale = scale;
            this.worldPosition = worldPosition;
            this.worldRotation = worldRotation;
            this.worldScale = worldScale;
          }
        }
        class GamepadsStatus {
          constructor(left, right) {
            this.left = left;
            this.right = right;
          }
        }
        class GamepadStatus {
          constructor(pose, position, rotation, scale, worldPosition, worldRotation, worldScale, buttons, axes) {
            this.pose = pose;
            this.position = position;
            this.rotation = rotation;
            this.scale = scale;
            this.worldPosition = worldPosition;
            this.worldRotation = worldRotation;
            this.worldScale = worldScale;
            this.buttons = buttons;
            this.axes = axes;
          }
        }
        class GamepadButtons {
          constructor(pad, trigger, grip, menu) {
            this.pad = pad;
            this.trigger = trigger;
            this.grip = grip;
            this.menu = menu;
          }
        }
        class GamepadButton {
          constructor(touched, pressed, value) {
            this.touched = touched;
            this.pressed = pressed;
            this.value = value;
          }
        }

        const _makeDefaultHmdStatus = () => (() => {
          const {position: worldPosition, rotation: worldRotation, scale: worldScale} = _decomposeObjectMatrixWorld(camera);

          return new HmdStatus(
            null,
            camera.position.clone(),
            camera.quaternion.clone(),
            camera.scale.clone(),
            worldPosition,
            worldRotation,
            worldScale
          );
        })();
        const _makeDefaultGamepadStatus = (index, stageMatrix) => {
          const pose = {
            position: [CONTROLLER_DEFAULT_OFFSETS[0] * ((index === 0) ? -1 : 1), CONTROLLER_DEFAULT_OFFSETS[1], CONTROLLER_DEFAULT_OFFSETS[2]],
            orientation: [0, 0, 0, 1],
          };
          const {position, rotation, scale} = _getPropertiesFromPose(pose);
          const {position: worldPosition, rotation: worldRotation, scale: worldScale} =
            _decomposeMatrix(new THREE.Matrix4().compose(position, rotation, scale).premultiply(stageMatrix));

          const _makeDefaultButtonStatus = () => new GamepadButton(false, false, 0);
          const buttons = new GamepadButtons(
            _makeDefaultButtonStatus(),
            _makeDefaultButtonStatus(),
            _makeDefaultButtonStatus(),
            _makeDefaultButtonStatus()
          );
          const axes = [0, 0];

          return new GamepadStatus(
            pose,
            position,
            rotation,
            scale,
            worldPosition,
            worldRotation,
            worldScale,
            buttons,
            axes
          );
        };

        class WebvrInstance extends EventEmitter {
          constructor() {
            super();

            this.display = null;
            this.stereoscopic = false;
            this.isOpen = false;
            this.isOpening = false;

            const stageMatrix = new THREE.Matrix4();
            this.stageMatrix = stageMatrix;

            const lookMatrix = new THREE.Matrix4();
            this.lookMatrix = lookMatrix;

            this.status = {
              hmd: _makeDefaultHmdStatus(),
              gamepads: new GamepadsStatus(
                _makeDefaultGamepadStatus(0, stageMatrix),
                _makeDefaultGamepadStatus(1, stageMatrix)
              ),
            };

            this._frameData = null;
          }

          isPresenting() {
            return Boolean(this.display);
          }

          displayIsPresenting() {
            return bestDisplay.isPresenting;
          }

          supportsWebVR() {
            return _canPresent(bestDisplay);
          }

          requestRenderLoop({
            display = null,
            stereoscopic = false,
            update = () => {},
            updateEye = () => {},
            updateStart = () => {},
            updateEnd = () => {},
            renderStart = () => {},
            renderEnd = () => {},
          }) {
            let cleanups = [];
            const _destroy = () => {
              for (let i = 0; i < cleanups.length; i++) {
                const cleanup = cleanups[i];
                cleanup();
              }
              cleanups = [];
            };

            const result = new Promise((accept, reject) => {
              if (!this.isOpen) {
                let effect = null;

                const _initialize = () => {
                  this.display = display;
                  this.stereoscopic = stereoscopic;
                  this.isOpen = true;
                  cleanups.push(() => {
                    this.isOpen = false;
                  });

                  const frameData = (display instanceof FakeVRDisplay) ? new VRFrameDataFake() : new VRFrameData();
                  this._frameData = frameData;

                  if (display && stereoscopic) {
                    const {getVRDisplays} = navigator; // HACK to prevent VREffect from initializing VR displays
                    navigator.getVRDisplays = null;
                    effect = new THREEVREffect(renderer);
                    navigator.getVRDisplays = getVRDisplays;

                    effect.setVRDisplay(display);
                    effect.onEye = camera => {
                      updateEye(camera);
                    };
                    effect.onRenderStart = () => {
                      renderStart();
                    };
                    effect.onRenderEnd = () => {
                      renderEnd();
                    };
                    effect.isPresenting = true;
                    effect.autoSubmitFrame = false;

                    const resize = () => {
                      effect.setSize(window.innerWidth, window.innerHeight);
                    };
                    window.addEventListener('resize', resize);
                    window.addEventListener('vrdisplaypresentchange', resize);

                    cleanups.push(() => {
                      this.display = null;
                      this.stereoscopic = false;

                      effect = null;

                      renderer.setSize(window.innerWidth, window.innerHeight);
                      renderer.setPixelRatio(window.devicePixelRatio);

                      window.removeEventListener('resize', resize);
                      window.removeEventListener('vrdisplaypresentchange', resize);
                    });
                  }

                  const displayStageMatrix = new THREE.Matrix4();
                  if (display && display.stageParameters) {
                    displayStageMatrix.fromArray(display.stageParameters.sittingToStandingTransform);
                  }
                  this.setStageMatrix(displayStageMatrix);
                  this.updateStatus();

                  cleanups.push(() => {
                    this.setStageMatrix(new THREE.Matrix4());
                    this.updateStatus();

                    this._frameData = null;
                  });

                  if (!display) {
                    // const originalStageMatrix = stageMatrix.clone();
                    const {lookMatrix} = this;
                    const {position, rotation, scale} = _decomposeMatrix(lookMatrix);
                    const euler = new THREE.Euler().setFromQuaternion(rotation, camera.rotation.order);

                    const mousemove = e => {
                      const xFactor = -0.5 + (e.clientX / window.innerWidth);
                      const yFactor = -0.5 + (e.clientY / window.innerHeight);

                      const newRotation = euler.clone();
                      newRotation.y -= xFactor * (Math.PI * 0.1);
                      newRotation.x -= yFactor * (Math.PI * 0.1);

                      lookMatrix.compose(position, new THREE.Quaternion().setFromEuler(newRotation), scale);
                    };
                    input.on('mousemove', mousemove);

                    cleanups.push(() => {
                      lookMatrix.identity();

                      input.removeListener('mousemove', mousemove);
                    });
                  }

                  const _renderLoop = () => {
                    const _render = () => {
                      updateStart(); // notify frame start

                      update(); // update plugins

                      if (effect) {
                        const scale = (() => {
                          const vector = new THREE.Vector3();
                          const {elements} = camera.parent.matrix;
                          const sx = vector.set(elements[0], elements[1], elements[2]).length();
                          const sy = vector.set(elements[4], elements[5], elements[6]).length();
                          const sz = vector.set(elements[8], elements[9], elements[10]).length();
                          return vector.set(sx, sy, sz);
                        })();
                        effect.scale = (scale.x + scale.y + scale.z) / 3;
                        effect.render(scene, camera); // perform binocular render
                      } else {
                        // manual events since the effect won't call them
                        updateEye(camera);
                        renderStart();
                        renderer.render(scene, camera); // perform monocular eye render
                        renderEnd();
                      }

                      updateEnd(); // notify frame end
                    };

                    const _requestAnimationFrame = fn => (display && display.isPresenting) ?
                      display.requestAnimationFrame(fn)
                    :
                      requestAnimationFrame(fn);
                    const _cancelAnimationFrame = animationFrame => (display && display.isPresenting) ?
                      display.cancelAnimationFrame(animationFrame)
                    :
                      cancelAnimationFrame(animationFrame);
                    const _submitFrame = () => {
                      if (display && display.isPresenting) {
                        display.getFrameData(frameData); // prevent timeshifting
                        display.submitFrame();
                      }
                    };

                    let animationFrame = null;
                    const _recurse = () => {
                      animationFrame = _requestAnimationFrame(() => {
                        animationFrame = null;

                        this.updateStatus();
                        _render();
                        _submitFrame();

                        _recurse();
                      });
                    };
                    _recurse();

                    cleanups.push(() => {
                      if (animationFrame) {
                        _cancelAnimationFrame(animationFrame);
                        animationFrame = null;
                      }
                    });
                  };
                  _renderLoop();
                };

                _initialize();

                const api = {
                  destroy: _destroy,
                };
                accept(api);
              } else {
                const err = new Error('webvr engine is already render looping. destroy() the old render first.');
                reject(err);
              }
            });
            result.destroy = _destroy;

            return result;
          };

          requestEnterVR({
            stereoscopic = true,
            update = () => {},
            updateEye = () => {},
            updateStart = () => {},
            updateEnd = () => {},
            renderStart = () => {},
            renderEnd = () => {},
            onExit = () => {},
          }) {
            // NOTE: these promises *need* to be synchronous because the WebVR api can only be triggered in the same tick as a user action
            const _checkNotOpening = () => new SynchronousPromise((accept, reject) => {
              const {isOpening} = this;

              if (!isOpening) {
                accept();
              } else {
                const err = new Error('webvr engine is already entering vr');
                reject(err);
              }
            });
            const _startOpening = () => {
              this.isOpening = true;

              return SynchronousPromise.resolve();
            };
            const _stopOpening = () => {
              this.isOpening = false;

              return SynchronousPromise.resolve();
            };
            const _handleError = err => {
              _stopOpening();
              _destroy();

              return Promise.reject(err);
            };

            let cleanups = [];
            const _destroy = () => {
              for (let i = 0; i < cleanups.length; i++) {
                const cleanup = cleanups[i];
                cleanup();
              }
              cleanups = [];
            };

            const result = _checkNotOpening()
              .then(_startOpening)
              .then(() => {
                const display = (() => {
                  if (stereoscopic && _canPresent(bestDisplay)) {
                    return bestDisplay;
                  } else {
                    return new FakeVRDisplay();
                  }
                })();

                const _requestPresent = () => {
                  if (!display.isPresenting) {
                    return display.requestPresent([
                      {
                        source: domElement,
                      }
                    ]);
                  } else {
                    return Promise.resolve();
                  }
                };

                return _requestPresent()
                  .then(() => new Promise((accept, reject) => {
                    const _listen = () => {
                      if (display instanceof FakeVRDisplay) {
                        const pointerlockchange = () => {
                          const {isPresenting} = display;
                          if (!isPresenting) {
                            _destroy();

                            onExit();
                          }
                        };
                        document.addEventListener('pointerlockchange', pointerlockchange);

                        cleanups.push(() => {
                          display.destroy();

                          document.removeEventListener('pointerlockchange', pointerlockchange);
                        });
                      } else {
                        const vrdisplaypresentchange = () => {
                          const {isPresenting} = display;
                          if (!isPresenting) {
                            _destroy();

                            onExit();
                          }
                        };
                        window.addEventListener('vrdisplaypresentchange', vrdisplaypresentchange);
                        const keydown = e => {
                          if (e.keyCode === 27) { // esc
                            display.exitPresent();
                          }
                        };
                        document.addEventListener('keydown', keydown);

                        cleanups.push(() => {
                          window.removeEventListener('vrdisplaypresentchange', vrdisplaypresentchange);
                          document.removeEventListener('keydown', keydown);
                        });
                      }
                    };
                    const _requestRenderLoop = () => {
                      const renderLoopPromise = this.requestRenderLoop({
                        display,
                        stereoscopic,
                        update,
                        updateEye,
                        updateStart,
                        updateEnd,
                        renderStart,
                        renderEnd,
                      });

                      cleanups.push(() => {
                        renderLoopPromise.destroy();
                      });

                      return renderLoopPromise;
                    };

                    _listen();

                    return _requestRenderLoop()
                      .then(_stopOpening)
                      .then(() => {
                        return {
                          destroy: _destroy,
                        };
                      })
                      .catch(_handleError);
                  }));
              })
              .catch(_handleError);
            result.destroy = _destroy;

            return result;
          }

          updateStatus() {
            const _getHmdStatus = () => {
              const {display, stageMatrix, _frameData: frameData} = this;
              if (display && frameData) {
                display.getFrameData(frameData);
              }
              const pose = frameData && frameData.pose;
              const {position, rotation, scale} = _getPropertiesFromPose(pose);
              const {position: worldPosition, rotation: worldRotation, scale: worldScale} =
                _decomposeMatrix(new THREE.Matrix4().compose(position, rotation, scale).premultiply(stageMatrix));

              return new HmdStatus(
                pose,
                position,
                rotation,
                scale,
                worldPosition,
                worldRotation,
                worldScale
              );
            };
            const _getGamepadsStatus = () => {
              const {display, stageMatrix} = this;
              const gamepads = (() => {
                if (display) {
                  if (display.getGamepads) {
                    const gamepads = display.getGamepads();
                    const [left, right] = gamepads;

                    return new GamepadsStatus(left, right);
                  } else {
                    let left = null;
                    let right = null;

                    const gamepads = navigator.getGamepads();
                    for (let i = 0; i < gamepads.length; i++) {
                      const gamepad = gamepads[i];

                      if (gamepad) {
                        const {hand} = gamepad;

                        if (hand === 'left') {
                          left = gamepad;
                        } else if (hand === 'right') {
                          right = gamepad;
                        }
                      }
                    }

                    return new GamepadsStatus(left, right);
                  }
                } else {
                  return new GamepadsStatus(null, null);
                }
              })();

              const _isGamepadAvailable = gamepad => Boolean(gamepad) && Boolean(gamepad.pose) && gamepad.pose.position !== null && gamepad.pose.orientation !== null;
              const _getGamepadPose = gamepad => {
                const {pose, buttons: [padButton, triggerButton, gripButton, menuButton], axes: [x, y]} = gamepad;

                const _getGamepadButtonStatus = button => {
                  if (button) {
                    const {touched, pressed, value} = button;
                    return new GamepadButton(touched, pressed, value);
                  } else {
                    return null;
                  }
                };

                const {position, rotation, scale} = _getPropertiesFromPose(pose);
                const {position: worldPosition, rotation: worldRotation, scale: worldScale} =
                  _decomposeMatrix(new THREE.Matrix4().compose(position, rotation, scale).premultiply(stageMatrix));
                const buttons = new GamepadButtons(
                  _getGamepadButtonStatus(padButton),
                  _getGamepadButtonStatus(triggerButton),
                  _getGamepadButtonStatus(gripButton),
                  _getGamepadButtonStatus(menuButton)
                );
                const axes = [x, y];

                return new GamepadStatus(
                  pose,
                  position,
                  rotation,
                  scale,
                  worldPosition,
                  worldRotation,
                  worldScale,
                  buttons,
                  axes
                );
              };

              return new GamepadsStatus(
                _isGamepadAvailable(gamepads.left) ? _getGamepadPose(gamepads.left) : _makeDefaultGamepadStatus(0, stageMatrix),
                _isGamepadAvailable(gamepads.right) ? _getGamepadPose(gamepads.right) : _makeDefaultGamepadStatus(1, stageMatrix)
              );
            };

            const {status: oldStatus} = this;
            const stageMatrix = this.getStageMatrix();
            const newStatus = {
              hmd: _getHmdStatus(),
              gamepads: _getGamepadsStatus(),
            };
            this.setStatus(newStatus);

            const _makeEvent = (side, rootName, gamepadStatus) => new VrEvent(
              side,
              (rootName === 'pad') ? (gamepadStatus ? [gamepadStatus.axes[0], gamepadStatus.axes[1]] : [0, 0]) : null
            );

            for (let s = 0; s < SIDES.length; s++) {
              const side = SIDES[s];
              const {gamepads: oldGamepadsStatus} = oldStatus;
              const oldGamepadStatus = oldGamepadsStatus[side];
              const {gamepads: newGamepadsStatus} = newStatus;
              const newGamepadStatus = newGamepadsStatus[side];

              for (let e = 0; e < EVENT_SPECS.length; e++) {
                const eventSpec = EVENT_SPECS[e];
                const {buttonName, rootName, downName, upName, touchName, touchdownName, touchupName} = eventSpec;

                const oldPressed = Boolean(oldGamepadStatus) && oldGamepadStatus.buttons[buttonName].pressed;
                const newPressed = Boolean(newGamepadStatus) && newGamepadStatus.buttons[buttonName].pressed;
                if (!oldPressed && newPressed) {
                  input.triggerEvent(downName, _makeEvent(side, rootName, newGamepadStatus));
                } else if (oldPressed && !newPressed) {
                  input.triggerEvent(upName, _makeEvent(side, rootName, newGamepadStatus));
                  input.triggerEvent(rootName, _makeEvent(side, rootName, newGamepadStatus));
                }

                const oldTouched = Boolean(oldGamepadStatus) && oldGamepadStatus.buttons[buttonName].touched;
                const newTouched = Boolean(newGamepadStatus) && newGamepadStatus.buttons[buttonName].touched;
                if (!oldTouched && newTouched) {
                  input.triggerEvent(touchdownName, _makeEvent(side, rootName, newGamepadStatus));
                } else if (oldTouched && !newTouched) {
                  input.triggerEvent(touchupName, _makeEvent(side, rootName, newGamepadStatus));
                  input.triggerEvent(touchName, _makeEvent(side, rootName, newGamepadStatus));
                }
              }
            }
          }

          getStatus() {
            return this.status;
          }

          setStatus(status) {
            this.status = status;
          }

          getStageMatrix() {
            return this.stageMatrix.clone();
          }

          setStageMatrix(stageMatrix) {
            this.stageMatrix.copy(stageMatrix);
          }

          getSittingToStandingTransform() {
            if (this.display) {
              return new THREE.Matrix4().fromArray(this.display.stageParameters.sittingToStandingTransform);
            } else {
              return new THREE.Matrix4();
            }
          }

          getExternalMatrix() {
            if (this.display) {
              return this.stageMatrix;
            } else {
              return this.stageMatrix.clone().multiply(this.lookMatrix);
            }
          }

          resetPose() {
            this.display.resetPose();
          }

          getMode() {
            const {display} = this;
            if (display instanceof FakeVRDisplay) {
              return display.getMode();
            } else {
              return null;
            }
          }

          getKeys() {
            const {display} = this;
            if (display instanceof FakeVRDisplay) {
              return display.getKeys();
            } else {
              return null;
            }
          }

          getSittingToStandingTransform() {
            const {display} = this;

            const result = new THREE.Matrix4();
            if (display) {
              result.fromArray(display.stageParameters.sittingToStandingTransform);
            }
            return result;
          }

          vibrate(side, value, time) {
            let left = null;
            let right = null;

            const {display} = this;
            if (display.getGamepads) {
              const gamepads = display.getGamepads();

              left = gamepads[0];
              right = gamepads[1];
            } else {
              const gamepads = navigator.getGamepads();

              for (let i = 0; i < gamepads.length; i++) {
                const gamepad = gamepads[i];

                if (gamepad) {
                  const {hand} = gamepad;

                  if (hand === 'left') {
                    left = gamepad;
                  } else if (hand === 'right') {
                    right = gamepad;
                  }
                }
              }
            }

            const _vibrate = gamepad => {
              const {hapticActuators} = gamepad;

              if (hapticActuators.length > 0) {
                hapticActuators[0].pulse(value, time);
              }
            };

            if (side === 'left' && left !== null) {
              _vibrate(left);
            } else if (side === 'right' && right !== null) {
              _vibrate(right);
            }
          }
        }

        class FakeVRDisplay extends EventEmitter {
          constructor() {
            super();

            this.canPresent = true;
            this.isPresenting = false;

            this.position = new THREE.Vector3();
            this.rotation = new THREE.Quaternion();
            this.scale = new THREE.Vector3(1, 1, 1);
            this.matrix = new THREE.Matrix4();

            this.stageParameters = {
              sittingToStandingTransform: new THREE.Matrix4()
                .compose(
                  new THREE.Vector3(0, DEFAULT_USER_HEIGHT, 0),
                  new THREE.Quaternion(),
                  new THREE.Vector3(1, 1, 1)
                ).toArray(),
            };

            const keys = {
              up: false,
              down: false,
              left: false,
              right: false,
              pad: false,
              touch: false,
              trigger: false,
              grip: false,
              menu: false,
              shift: false,
              axis: false,
            };
            this.keys = keys;

            const _resetKeys = () => {
              keys.up = false;
              keys.down = false;
              keys.left = false;
              keys.right = false;
              keys.pad = false;
              keys.touch = false;
              keys.trigger = false;
              keys.grip = false;
              keys.menu = false;
              keys.shift = false;
              keys.axis = false;
            };

            const gamepads = [new FakeVRGamepad(this, 0), new FakeVRGamepad(this, 1)];
            this.gamepads = gamepads;

            this.mode = 'center';

            const keydown = e => {
              if (this.isPresenting) {
                let needsGamepadUpdate = false;

                switch (e.keyCode) {
                  case 87: // W
                    keys.up = true;
                    break;
                  case 65: // A
                    keys.left = true;
                    break;
                  case 83: // S
                    keys.down = true;
                    break;
                  case 68: // D
                    keys.right = true;
                    break;
                  case 81: // Q
                    keys.pad = true;
                    needsGamepadUpdate = true;
                    break;
                  case 69: // E
                    keys.menu = true;
                    needsGamepadUpdate = true;
                    break;
                  case 70: // F
                    keys.grip = true;
                    needsGamepadUpdate = true;
                    break;
                  case 82: // R
                    keys.touch = true;
                    needsGamepadUpdate = true;
                    break;
                  case 16: // Shift
                    keys.shift = true;
                    break;
                  case 18: // Alt
                    keys.alt = true;
                    needsGamepadUpdate = true;
                    break;
                  case 86: // V
                    keys.axis = true;
                    break;
                  case 90: // Z
                    this.mode = 'left';
                    break;
                  case 67: // C
                    this.mode = 'right';
                    break;
                  case 88: // X
                    this.mode = 'center';
                    break;
                }

                if (needsGamepadUpdate) {
                  this.updateGamepads();
                }

                // prevent some key combinations from hijacking input
                if (
                  (e.keyCode === 18) || // Alt
                  (e.ctrlKey && e.keyCode === 70) || // Ctrl-F
                  (e.ctrlKey && e.keyCode === 87) || // Ctrl-W
                  (e.ctrlKey && e.keyCode === 83) // Ctrl-S
                ) {
                  e.preventDefault();
                }
              }
            };
            const keyup = e => {
              if (this.isPresenting) {
                let needsGamepadUpdate = false;

                switch (e.keyCode) {
                  case 87: // W
                    keys.up = false;
                    break;
                  case 65: // A
                    keys.left = false;
                    break;
                  case 83: // S
                    keys.down = false;
                    break;
                  case 68: // D
                    keys.right = false;
                    break;
                  case 81: // Q
                    keys.pad = false;
                    needsGamepadUpdate = true;
                    break;
                  case 69: // E
                    keys.menu = false;
                    needsGamepadUpdate = true;
                    break;
                  case 70: // F
                    keys.grip = false;
                    needsGamepadUpdate = true;
                    break;
                  case 82: // R
                    keys.touch = false;
                    needsGamepadUpdate = true;
                    break;
                  case 86: // V
                    keys.axis = false;
                    break;
                  case 16: // Shift
                    keys.shift = false;
                    break;
                }

                if (needsGamepadUpdate) {
                  this.updateGamepads();
                }
              }
            };
            const mousedown = e => {
              if (this.isPresenting) {
                const {keys} = this;
                keys.trigger = true;

                this.updateGamepads();
              }
            };
            const mouseup = e => {
              if (this.isPresenting) {
                const {keys} = this;
                keys.trigger = false;

                this.updateGamepads();
              }
            };
            const mousemove = e => {
              if (this.isPresenting) {
                const _handleGamepad = () => this.isPresenting && (e.ctrlKey || e.altKey || keys.axis); // handled by the fake gamepad
                const _handleDisplay = () => {
                  const {rotation: quaternion} = this;

                  const rotation = new THREE.Euler().setFromQuaternion(quaternion, camera.rotation.order);
                  rotation.x = Math.max(Math.min(rotation.x - e.movementY * ROTATION_SPEED, Math.PI / 2), -Math.PI / 2);
                  rotation.y = mod(rotation.y - e.movementX * ROTATION_SPEED, Math.PI * 2);
                  quaternion.setFromEuler(rotation);

                  this.updateMatrix();
                  this.updateGamepads();

                  return true;
                };

                _handleGamepad() || _handleDisplay();
              }
            };
            const pointerlockchange = e => {
              const {isPresenting: wasPresenting} = this;

              const isPresenting = document.pointerLockElement !== null;
              this.isPresenting = isPresenting;

              if (!isPresenting) {
                _resetKeys();
              }
            };
            const pointerlockerror = err => {
              _resetKeys();

              console.warn('pointer lock error', err);
            };

            input.on('keydown', keydown);
            input.on('keyup', keyup);
            input.on('mousedown', mousedown);
            input.on('mouseup', mouseup);
            input.on('mousemove', mousemove);
            document.addEventListener('pointerlockchange', pointerlockchange);
            document.addEventListener('pointerlockerror', pointerlockerror);

            this._cleanup = () => {
              for (let i = 0; i < gamepads.length; i++) {
                const gamepad = gamepads[i];
                gamepad.destroy();
              }

              input.removeListener('keydown', keydown);
              input.removeListener('keyup', keyup);
              input.removeListener('mousedown', mousedown);
              input.removeListener('mouseup', mouseup);
              input.removeListener('mousemove', mousemove);
              document.removeEventListener('pointerlockchange', pointerlockchange);
              document.removeEventListener('pointerlockerror', pointerlockerror);
            };
          }

          requestPresent(/*[{source}]*/) {
            domElement.requestPointerLock();

            return Promise.resolve();
          }

          requestAnimationFrame(fn) {
            return requestAnimationFrame(() => {
              const _updateDisplay = () => {
                const {position, rotation, keys} = this;

                const moveVector = new THREE.Vector3();
                const speed = keys.shift ? POSITION_SPEED_FAST : POSITION_SPEED;
                let moved = false;
                if (keys.up) {
                  moveVector.z -= speed;
                  moved = true;
                }
                if (keys.down) {
                  moveVector.z += speed;
                  moved = true;
                }
                if (keys.left) {
                  moveVector.x -= speed;
                  moved = true;
                }
                if (keys.right) {
                  moveVector.x += speed;
                  moved = true;
                }

                if (moved) {
                  moveVector.applyQuaternion(rotation);
                  position.add(moveVector);

                  this.updateMatrix();
                  this.updateGamepads();
                }
              };

              _updateDisplay();
              fn();
            });
          }

          cancelAnimationFrame(animationFrame) {
            cancelAnimationFrame(animationFrame);
          }

          resetPose() {
            this.position.set(0, 0, 0);
            const euler = new THREE.Euler().setFromQuaternion(this.rotation, camera.rotation.order);
            this.rotation.setFromEuler(new THREE.Euler(
              euler.x, // destinationRotation.x,
              0,
              euler.z, // destinationRotation.z,
              camera.rotation.order
            ));

            this.updateMatrix();
            this.updateGamepads();
          }

          /* resetPoseHard() {
            this.position.copy(new THREE.Vector3());
            this.rotation.copy(new THREE.Quaternion());

            this.updateMatrix();
            this.updateGamepads();
          } */

          getFrameData(frameData) {
            const eyeCamera = new THREE.PerspectiveCamera(camera.fov, camera.aspect, camera.near, camera.far);
            eyeCamera.fov = DEFAULT_USER_FOV;
            eyeCamera.aspect = DEFAULT_ASPECT_RATIO;
            eyeCamera.updateProjectionMatrix();
            const eyeCameraProjectionMatrixArray = eyeCamera.projectionMatrix.toArray();

            frameData.leftViewMatrix.set(new THREE.Matrix4().compose(
              camera.position.clone().add(new THREE.Vector3(-(DEFAULT_USER_IPD / 2), 0, 0).applyQuaternion(camera.quaternion)),
              camera.quaternion,
              camera.scale
            ).toArray());
            frameData.leftProjectionMatrix.set(eyeCameraProjectionMatrixArray);

            frameData.rightViewMatrix.set(new THREE.Matrix4().compose(
              camera.position.clone().add(new THREE.Vector3(DEFAULT_USER_IPD / 2, 0, 0).applyQuaternion(camera.quaternion)),
              camera.quaternion,
              camera.scale
            ).toArray());
            frameData.rightProjectionMatrix.set(eyeCameraProjectionMatrixArray);

            const {position, rotation} = this;
            frameData.pose = new VRPoseFake(position.toArray(), rotation.toArray());
          }

          getEyeParameters(side) {
            return {
              offset: [(DEFAULT_USER_IPD / 2) * (side === 'left' ? -1 : 1), 0, 0],
              fieldOfView: {
                upDegrees: DEFAULT_USER_FOV / 2,
                rightDegrees: DEFAULT_USER_FOV / 2,
                downDegrees: DEFAULT_USER_FOV / 2,
                leftDegrees: DEFAULT_USER_FOV / 2,
              },
              renderWidth: DEFAULT_WIDTH,
              renderHeight: DEFAULT_HEIGHT,
            };
          }

          getLayers() {
            return [
              {
                leftBounds: [0.0, 0.0, 0.5, 1.0],
                rightBounds: [0.5, 0.0, 0.5, 1.0],
                source: null,
              },
            ];
          }

          submitFrame(pose) {
            // nothing
          }

          getGamepads() {
            return this.gamepads;
          }

          getMode() {
            return this.mode;
          }

          getKeys() {
            return this.keys;
          }

          updateMatrix() {
            const {position, rotation, scale, matrix} = this;

            matrix.compose(position, rotation, scale);
          }

          updateGamepads() {
            const {gamepads} = this;

            for (let i = 0; i < gamepads.length; i++) {
              const gamepad = gamepads[i];
              gamepad.updateProperties();
            }
          }

          destroy() {
            this._cleanup();
          }
        }

        class FakeVRGamepad {
          constructor(parent, index) {
            this._parent = parent;
            this._index = index;

            const position = new THREE.Vector3(0, 0, 0);
            this.position = position;
            const rotation = new THREE.Quaternion(0, 0, 0, 1);
            this.rotation = rotation;
            const scale = new THREE.Vector3(1, 1, 1);
            this.scale = scale;

            const buttons = (() => {
              const _makeButton = () => {
                return {
                  touched: false,
                  pressed: false,
                  value: 0,
                };
              };

              const numButtons = 4;
              const result = Array(numButtons);
              for (let i = 0; i < numButtons; i++) {
                result[i] = _makeButton();
              }
              return result;
            })();
            this.buttons = buttons;
            this.axes = [0, 0];
            this.hapticActuators = [];

            const positionOffset = new THREE.Vector3(
              CONTROLLER_DEFAULT_OFFSETS[0] * (index === 0 ? -1 : 1),
              CONTROLLER_DEFAULT_OFFSETS[1],
              CONTROLLER_DEFAULT_OFFSETS[2]
            );
            this.positionOffset = positionOffset;

            const rotationOffset = new THREE.Euler();
            rotationOffset.order = camera.rotation.order;
            this.rotationOffset = rotationOffset;

            this.pose = {
              position: null,
              orientation: null,
            };

            this.updateProperties();

            const mousemove = e => {
              if (this.displayIsInControllerMode()) {
                const _isReversed = () => {
                  const {_parent: parent, _index: index} = this;
                  const mode = parent.getMode();
                  return mode === 'center' && index === 1;
                };

                if (e.ctrlKey) {
                  this.move(-e.movementX, -e.movementY, 0, _isReversed());
                } else if (e.altKey) {
                  this.move(-e.movementX, 0, -e.movementY, _isReversed());
                } else if (this._parent.keys.axis) {
                  this.axis(-e.movementX, -e.movementY, _isReversed());
                }
              }
            };
            input.on('mousemove', mousemove);

            this._cleanup = () => {
              input.removeListener('mousemove', mousemove);
            };
          }

          displayIsInControllerMode() {
            const {_parent: parent, _index: index} = this;
            const mode = parent.getMode();
            return parent.isPresenting && ((mode === 'center') || (mode === 'left' && index === 0) || (mode === 'right' && index === 1));
          }

          move(x, y, z, reverse) {
            const {positionOffset} = this;

            const moveFactor = 0.001;
            const reverseFactor = !reverse ? 1 : -1;
            positionOffset.x += -x * moveFactor * reverseFactor;
            positionOffset.y += y * moveFactor * reverseFactor;
            positionOffset.z += -z * moveFactor * reverseFactor;

            this.updateProperties();
          }

          axis(x, y, reverse) {
            const {axes} = this;

            const _clampAxis = v => Math.min(Math.max(v, -1), 1);

            const moveFactor = 0.01;
            const reverseFactor = !reverse ? 1 : -1;
            axes[0] = _clampAxis(axes[0] - (x * moveFactor * reverseFactor));
            axes[1] = _clampAxis(axes[1] + (y * moveFactor * reverseFactor));

            this.updateProperties();
          }

          /* rotate(x, y) {
            const {rotationOffset} = this;

            const moveFactor = 0.001 * (Math.PI * 2);
            rotationOffset.y = Math.max(Math.min(rotationOffset.y + (x * moveFactor), Math.PI / 2), -Math.PI / 2);
            rotationOffset.x = Math.max(Math.min(rotationOffset.x + (y * moveFactor), Math.PI / 2), -Math.PI / 2);

            this.updateProperties();
          } */

          updateProperties() {
            const {_parent: parent, positionOffset, rotationOffset} = this;

            const {matrix: outerMatrix} = parent;
            const innerMatrix = (() => {
              const result = new THREE.Matrix4();

              const position = positionOffset;
              const rotation = new THREE.Quaternion().setFromEuler(rotationOffset);
              const scale = new THREE.Vector3(1, 1, 1);
              result.compose(position, rotation, scale);

              return result;
            })();

            const worldMatrix = outerMatrix.clone().multiply(innerMatrix);
            const {position, rotation, scale} = _decomposeMatrix(worldMatrix);

            this.position.copy(position);
            this.rotation.copy(rotation);
            this.scale.copy(scale);

            this.pose.position = position.toArray();
            this.pose.orientation = rotation.toArray();

            if (this.displayIsInControllerMode()) {
              const {keys} = parent;
              this.buttons[BUTTONS.PAD].touched = keys.touch;
              this.buttons[BUTTONS.PAD].pressed = keys.pad;
              this.buttons[BUTTONS.TRIGGER].pressed = keys.trigger;
              this.buttons[BUTTONS.GRIP].pressed = keys.grip;
              this.buttons[BUTTONS.MENU].pressed = keys.menu;
            }
          }

          destroy() {
            this._cleanup();
          }
        }

        const webvrInstance = new WebvrInstance();
        return webvrInstance;
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

const _isPolyfillDisplay = vrDisplay => /polyfill/i.test(vrDisplay.displayName);
const _canPresent = vrDisplay => vrDisplay ? vrDisplay.capabilities.canPresent : false;

module.exports = WebVR;
