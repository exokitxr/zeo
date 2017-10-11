const SynchronousPromise = require('synchronous-promise').SynchronousPromise;
const mod = require('mod-loop');

class VRFrameDataFake {
  constructor() {
    this.leftProjectionMatrix = new Float32Array(16);
    this.leftViewMatrix = new Float32Array(16);
    this.rightProjectionMatrix = new Float32Array(16);
    this.rightViewMatrix = new Float32Array(16);
    this.pose = new VRPoseFake();
  }
}
class VRPoseFake {
  constructor(position = new Float32Array(3), orientation = new Float32Array(4)) {
    this.position = position;
    this.orientation = orientation;
  }

  set(position, orientation) {
    this.position[0] = position.x;
    this.position[1] = position.y;
    this.position[2] = position.z;

    this.orientation[0] = orientation.x;
    this.orientation[1] = orientation.y;
    this.orientation[2] = orientation.z;
    this.orientation[3] = orientation.w;
  }
}

const DEFAULT_USER_HEIGHT = 1.6;
const DEFAULT_USER_IPD = 62 / 1000;
const DEFAULT_USER_FOV = 110;
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 1080;
const DEFAULT_ASPECT_RATIO = DEFAULT_WIDTH / DEFAULT_HEIGHT;

const CONTROLLER_DEFAULT_OFFSETS = [0.2, -0.1, -0.2];
const DEFAULT_GAMEPAD_POSES = [
  {
    position: [-CONTROLLER_DEFAULT_OFFSETS[0], CONTROLLER_DEFAULT_OFFSETS[1], CONTROLLER_DEFAULT_OFFSETS[2]],
    orientation: [0, 0, 0, 1],
  },
  {
    position: [CONTROLLER_DEFAULT_OFFSETS[0], CONTROLLER_DEFAULT_OFFSETS[1], CONTROLLER_DEFAULT_OFFSETS[2]],
    orientation: [0, 0, 0, 1],
  },
];

const MOVE_FACTOR = 0.001;
const POSITION_SPEED = 4 / 1000;
const POSITION_SPEED_FAST = POSITION_SPEED * 2;
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
  constructor(side) {
    this.side = side;
  }
}
const VR_EVENTS = {
  left: new VrEvent('left'),
  right: new VrEvent('right'),
};

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

    const _getVRDisplays = () => {
      if (navigator.getVRDisplays) {
        return navigator.getVRDisplays();
      } else {
        return Promise.resolve([]);
      }
    };

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/bootstrap',
        '/core/engines/input',
        '/core/engines/three',
        '/core/utils/js-utils',
      ]),
      _getVRDisplays(),
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
        const oneVector = new THREE.Vector3(1, 1, 1);
        const localVector = new THREE.Vector3();
        const localVector2 = new THREE.Vector3();
        const localQuaternion = new THREE.Quaternion();
        const localEuler = new THREE.Euler();
        const localMatrix = new THREE.Matrix4();
        const localMatrix2 = new THREE.Matrix4();

        const bestDisplay = displays.sort((a, b) => {
          const diff = +_isPolyfillDisplay(a) - _isPolyfillDisplay(b);
          if (diff !== 0) {
            return diff;
          } else {
            return +_canPresent(b) - +_canPresent(a);
          }
        })[0];

        const _getPropertiesFromPose = pose => {
          const position = (pose && pose.position !== null) ? new THREE.Vector3().fromArray(pose.position) : zeroVector;
          const rotation = (pose && pose.orientation !== null) ? new THREE.Quaternion().fromArray(pose.orientation) : zeroQuaternion;
          const scale = oneVector;
          return {position, rotation, scale};
        };
        const _getPropertiesFromPoseTo = (pose, position, rotation, scale) => {
          if (pose && pose.position !== null) {
            position.fromArray(pose.position);
          } else {
            position.copy(zeroVector);
          }
          if (pose && pose.orientation !== null) {
            rotation.fromArray(pose.orientation);
          } else {
            rotation.copy(zeroQuaternion);
          }
          scale.copy(oneVector);
        };

        class Status {
          constructor(hmd, gamepads) {
            this.hmd = hmd;
            this.gamepads = gamepads;
          }
        }

        class HmdStatus {
          constructor(position, rotation, scale, worldPosition, worldRotation, worldScale) {
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
          constructor(position, rotation, scale, worldPosition, worldRotation, worldScale, buttons, axes) {
            this.position = position;
            this.rotation = rotation;
            this.scale = scale;
            this.worldPosition = worldPosition;
            this.worldRotation = worldRotation;
            this.worldScale = worldScale;
            this.buttons = buttons;
            this.axes = axes;
          }

          reset(index) {
            _getPropertiesFromPoseTo(
              DEFAULT_GAMEPAD_POSES[index],
              this.position,
              this.rotation,
              this.scale
            );
            this.worldPosition.copy(this.position);
            this.worldRotation.copy(this.rotation);
            this.worldScale.copy(this.scale);
            this.buttons.reset();
            this.axes[0] = 0;
            this.axes[1] = 0;
          }
        }
        class GamepadButtons {
          constructor(pad, trigger, grip, menu) {
            this.pad = pad;
            this.trigger = trigger;
            this.grip = grip;
            this.menu = menu;
          }

          reset() {
            this.pad.reset();
            this.trigger.reset();
            this.grip.reset();
            this.menu.reset();
          }
        }
        class GamepadButton {
          constructor(touched, pressed, value) {
            this.touched = touched;
            this.pressed = pressed;
            this.value = value;
          }

          reset() {
            this.touched = false;
            this.pressed = false;
            this.value = 0;
          }
        }

        const _makeDefaultHmdStatus = () => (() => {
          const {position: worldPosition, rotation: worldRotation, scale: worldScale} = _decomposeObjectMatrixWorld(camera);

          return new HmdStatus(
            camera.position.clone(),
            camera.quaternion.clone(),
            camera.scale.clone(),
            worldPosition,
            worldRotation,
            worldScale
          );
        })();
        const _makeDefaultGamepadStatus = index => {
          const {position, rotation, scale} = _getPropertiesFromPose(DEFAULT_GAMEPAD_POSES[index]);
          const worldPosition = position.clone();
          const worldRotation = rotation.clone();
          const worldScale = scale.clone();

          const _makeDefaultButtonStatus = () => new GamepadButton(false, false, 0);
          const buttons = new GamepadButtons(
            _makeDefaultButtonStatus(),
            _makeDefaultButtonStatus(),
            _makeDefaultButtonStatus(),
            _makeDefaultButtonStatus()
          );
          const axes = [0, 0];

          return new GamepadStatus(
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

            const spawnMatrix = new THREE.Matrix4();
            this.spawnMatrix = spawnMatrix;

            const lookMatrix = new THREE.Matrix4();
            this.lookMatrix = lookMatrix;

            this.status = new Status(
              _makeDefaultHmdStatus(),
              new GamepadsStatus(
                _makeDefaultGamepadStatus(0),
                _makeDefaultGamepadStatus(1)
              )
            );

            this.colliders = [];

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
            // updateEye = () => {},
            updateStart = () => {},
            updateEnd = () => {},
            // renderStart = () => {},
            // renderEnd = () => {},
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
                // let effect = null;

                const _initialize = () => {
                  this.display = display;
                  this.stereoscopic = stereoscopic;
                  this.isOpen = true;
                  cleanups.push(() => {
                    this.isOpen = false;
                  });

                  const frameData = (!display || (display instanceof FakeVRDisplay)) ? new VRFrameDataFake() : new VRFrameData();
                  this._frameData = frameData;

                  if (display && stereoscopic) {
                    renderer.vr.enabled = true;
                    renderer.vr.setDevice(display);

                    cleanups.push(() => {
                      this.display = null;
                      this.stereoscopic = false;

                      renderer.vr.enabled = false;
                      renderer.vr.setDevice(null);
                      renderer.setSize(window.innerWidth, window.innerHeight);
                      renderer.setPixelRatio(window.devicePixelRatio);
                    });
                  }

                  const displayStageMatrix = new THREE.Matrix4();
                  if (display && display.stageParameters) {
                    displayStageMatrix.fromArray(display.stageParameters.sittingToStandingTransform);
                  }
                  this.setStageMatrix(displayStageMatrix.premultiply(this.getSpawnMatrix()));
                  this.updateStatus();

                  cleanups.push(() => {
                    this.setStageMatrix(this.getSpawnMatrix());
                    this.updateStatus();

                    this._frameData = null;
                  });

                  if (!display) {
                    // const originalStageMatrix = stageMatrix.clone();
                    const {lookMatrix} = this;
                    const {position, rotation, scale} = _decomposeMatrix(lookMatrix);
                    const euler = new THREE.Euler().setFromQuaternion(rotation, camera.rotation.order);

                    const mousemove = e => {
                      const xFactor = -0.5 + (e.event.clientX / window.innerWidth);
                      const yFactor = -0.5 + (e.event.clientY / window.innerHeight);

                      localEuler.copy(euler);
                      localEuler.y -= xFactor * (Math.PI * 0.1);
                      localEuler.x -= yFactor * (Math.PI * 0.1);

                      lookMatrix.compose(position, localQuaternion.setFromEuler(localEuler), scale);
                    };
                    input.on('mousemove', mousemove);

                    cleanups.push(() => {
                      lookMatrix.identity();

                      input.removeListener('mousemove', mousemove);
                    });
                  }

                  const _renderLoop = () => {
                    const cancelAnimate = renderer.animate(() => {
                      this.updateStatus();

                      updateStart(); // notify frame start

                      update(); // update plugins

                      if (renderer.vr.enabled) {
                        /* const scale = (() => {
                          const vector = new THREE.Vector3();
                          const {elements} = camera.parent.matrix;
                          const sx = vector.set(elements[0], elements[1], elements[2]).length();
                          const sy = vector.set(elements[4], elements[5], elements[6]).length();
                          const sz = vector.set(elements[8], elements[9], elements[10]).length();
                          return vector.set(sx, sy, sz);
                        })();
                        effect.scale = (scale.x + scale.y + scale.z) / 3; */
                        renderer.render(scene, camera); // perform binocular render
                      } else {
                        // manual events since the effect won't call them
                        // updateEye(camera);
                        renderer.render(scene, camera); // perform monocular eye render
                      }

                      updateEnd(); // notify frame end
                    });

                    cleanups.push(() => {
                      cancelAnimate();
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
            // updateEye = () => {},
            updateStart = () => {},
            updateEnd = () => {},
            // renderStart = () => {},
            // renderEnd = () => {},
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
                        // updateEye,
                        updateStart,
                        updateEnd,
                        // renderStart,
                        // renderEnd,
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
            const _setHmdStatus = () => {
              const {display} = this;
              if (display && display.updatePose) {
                display.updatePose();
              }

              const {_frameData: frameData} = this;
              if (display) {
                display.getFrameData(frameData);
              }
              _getPropertiesFromPoseTo(
                frameData.pose,
                this.status.hmd.position,
                this.status.hmd.rotation,
                this.status.hmd.scale
              );
              localMatrix.compose(this.status.hmd.position, this.status.hmd.rotation, this.status.hmd.scale)
                .premultiply(this.stageMatrix)
                .decompose(
                  this.status.hmd.worldPosition,
                  this.status.hmd.worldRotation,
                  this.status.hmd.worldScale
                );
            };
            const _setGamepadsStatus = () => {
              if (this.display) {
                if (this.display.getGamepads) {
                  const gamepads = this.display.getGamepads();

                  _setGamepadStatus('left', gamepads[0]);
                  _setGamepadStatus('right', gamepads[1]);
                } else {
                  const gamepads = navigator.getGamepads();

                  for (let i = 0; i < gamepads.length; i++) {
                    const gamepad = gamepads[i];

                    if (gamepad) {
                      if (gamepad.hand === 'left') {
                        _setGamepadStatus('left', gamepad);
                      } else if (gamepad.hand === 'right') {
                        _setGamepadStatus('right', gamepad);
                      }
                    }
                  }
                }
              }
            };
            const _setGamepadStatus = (side, gamepad) => {
              if (gamepad.updatePose) {
                gamepad.updatePose();
              }
              if (gamepad.updateButtons) {
                gamepad.updateButtons();
              }

              const {pose, buttons: [pad, trigger, grip, menu], axes: [x, y]} = gamepad;
              const gamepadStatus = this.status.gamepads[side];

              _getPropertiesFromPoseTo(
                pose,
                gamepadStatus.position,
                gamepadStatus.rotation,
                gamepadStatus.scale
              );
              localMatrix.compose(gamepadStatus.position, gamepadStatus.rotation, gamepadStatus.scale)
                .premultiply(this.stageMatrix)
                .decompose(
                  gamepadStatus.worldPosition,
                  gamepadStatus.worldRotation,
                  gamepadStatus.worldScale
                );

              const buttons = {pad, trigger, grip, menu};
              const axes = [x, y];
              for (let e = 0; e < EVENT_SPECS.length; e++) {
                const eventSpec = EVENT_SPECS[e];
                const {buttonName, rootName, downName, upName, touchName, touchdownName, touchupName} = eventSpec;

                const oldPressed = gamepadStatus.buttons[buttonName].pressed;
                const newPressed = buttons[buttonName].pressed;
                if (!oldPressed && newPressed) {
                  input.triggerEvent(downName, VR_EVENTS[side]);
                } else if (oldPressed && !newPressed) {
                  input.triggerEvent(upName, VR_EVENTS[side]);
                  input.triggerEvent(rootName, VR_EVENTS[side]);
                }

                const oldTouched = gamepadStatus.buttons[buttonName].touched;
                const newTouched = buttons[buttonName].touched;
                if (!oldTouched && newTouched) {
                  input.triggerEvent(touchdownName, VR_EVENTS[side]);
                } else if (oldTouched && !newTouched) {
                  input.triggerEvent(touchupName, VR_EVENTS[side]);
                  input.triggerEvent(touchName, VR_EVENTS[side]);
                }
              }

              _setGamepadButtonStatus(pad, gamepadStatus.buttons.pad);
              _setGamepadButtonStatus(trigger, gamepadStatus.buttons.trigger);
              _setGamepadButtonStatus(grip, gamepadStatus.buttons.grip);
              _setGamepadButtonStatus(menu, gamepadStatus.buttons.menu);
              _setGamepadAxes(axes, gamepadStatus.axes);
            };
            const _setGamepadButtonStatus = (src, dst) => {
              dst.touched = src.touched;
              dst.pressed = src.pressed;
              dst.value = src.value;
            };
            const _setGamepadAxes = (src, dst) => {
              dst[0] = src[0];
              dst[1] = src[1];
            }
            function _isGamepadAvailable(gamepad) {
              return Boolean(gamepad) && Boolean(gamepad.pose) && gamepad.pose.position !== null && gamepad.pose.orientation !== null;
            }

            _setHmdStatus();
            _setGamepadsStatus();
          }

          getStatus() {
            return this.status;
          }

          getStageMatrix() {
            return this.stageMatrix;
          }

          setStageMatrix(stageMatrix) {
            this.stageMatrix.copy(stageMatrix);
          }

          getSpawnMatrix() {
            return this.spawnMatrix.clone();
          }

          setSpawnMatrix(spawnMatrix) {
            this.spawnMatrix.copy(spawnMatrix);

            if (!this.display) {
              this.setStageMatrix(spawnMatrix);
            }
          }

          getSpawnTransform() {
            return new THREE.Matrix4().fromArray(this.display.stageParameters.sittingToStandingTransform)
              .premultiply(this.spawnMatrix);
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

          normalizePosition() {
            if (this.display instanceof FakeVRDisplay) {
              this.stageMatrix.decompose(localVector, localQuaternion, localVector2);
              localVector.add(this.display.position);
              this.stageMatrix.compose(localVector, localQuaternion, localVector2);
              this.display.position.set(0, 0, 0);
            }
          }

          collide(position, velocity) {
            if (this.colliders.length > 0) {
              const worldPosition = localVector.copy(position).applyMatrix4(this.stageMatrix);

              let collided = false;
              for (let i = 0; i < this.colliders.length; i++) {
                if (this.colliders[i].fn(position, velocity, worldPosition)) {
                  collided = true;
                }
              }
              return collided;
            } else {
              if (position.y <= 0) {
                position.y = 0;
                return true;
              } else {
                return false;
              }
            }
          }

          addCollider(fn, {priority = 0} = {}) {
            this.colliders.push({
              fn,
              priority,
            });
            this.colliders.sort((a, b) => b.priority - a.priority);
          }

          getMode() {
            if (this.display instanceof FakeVRDisplay) {
              return this.display.getMode();
            } else {
              return null;
            }
          }

          getKeys() {
            if (this.display instanceof FakeVRDisplay) {
              return this.display.getKeys();
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

            this.rotationOffset = new THREE.Euler(0, 0, 0, camera.rotation.order);
            this.poseNeedsUpdate = false;

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
              space: false,
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
              keys.space = false;
              keys.axis = false;
            };

            this.velocity = new THREE.Vector3(0, 0, 0);
            this.lastPoseUpdateTime = Date.now();
            this.lastCollideTime = 0;

            const gamepads = [new FakeVRGamepad(this, 0), new FakeVRGamepad(this, 1)];
            this.gamepads = gamepads;

            this.mode = 'right';

            const keydown = e => {
              if (this.isPresenting) {
                switch (e.event.keyCode) {
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
                    break;
                  case 69: // E
                    keys.menu = true;
                    break;
                  case 70: // F
                    keys.grip = true;
                    break;
                  case 82: // R
                    keys.touch = true;
                    break;
                  case 16: // Shift
                    keys.shift = true;
                    break;
                  case 32: // Space
                    keys.space = true;
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
              }
            };
            const keyup = e => {
              if (this.isPresenting) {
                switch (e.event.keyCode) {
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
                    break;
                  case 69: // E
                    keys.menu = false;
                    break;
                  case 70: // F
                    keys.grip = false;
                    break;
                  case 82: // R
                    keys.touch = false;
                    break;
                  case 86: // V
                    keys.axis = false;
                    break;
                  case 16: // Shift
                    keys.shift = false;
                    break;
                  case 32: // Space
                    keys.space = false;
                    break;
                }
              }
            };
            const mousedown = e => {
              if (this.isPresenting) {
                this.keys.trigger = true;
              }
            };
            const mouseup = e => {
              if (this.isPresenting) {
                this.keys.trigger = false;
              }
            };
            const mousemove = e => {
              if (this.isPresenting) {
                const _handleGamepad = () => e.event.ctrlKey || e.event.altKey || this.keys.axis; // handled by the fake gamepad
                const _handleDisplay = () => {
                  if (Math.abs(e.event.movementX) < 300 && Math.abs(e.event.movementY) < 300) { // work around fast movement glitching
                    this.rotationOffset.x = Math.max(Math.min(this.rotationOffset.x - e.event.movementY * ROTATION_SPEED, Math.PI / 2), -Math.PI / 2);
                    this.rotationOffset.y = mod(this.rotationOffset.y - e.event.movementX * ROTATION_SPEED, Math.PI * 2);

                    this.poseNeedsUpdate = true;
                    this.gamepads[0].poseNeedsUpdate = true;
                    this.gamepads[1].poseNeedsUpdate = true;

                    return true;
                  } else {
                    return false;
                  }
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

          resetPose() {
            this.position.set(0, 0, 0);
            this.rotationOffset.set(0, 0, 0, camera.rotation.order);

            this.poseNeedsUpdate = true;
          }

          getFrameData(frameData) {
            frameData.pose.set(this.position, this.rotation);
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

          submitFrame(/*pose*/) {
            // nothing
          }

          updatePose() {
            let matrixNeedsUpdate = false;

            const now = Date.now();
            const timeDiff = now - this.lastPoseUpdateTime;

            localVector.copy(this.velocity).multiplyScalar(timeDiff);
            const speed = (this.keys.shift ? POSITION_SPEED_FAST : POSITION_SPEED) * timeDiff;
            if (this.keys.up) {
              localVector.z -= speed;
            }
            if (this.keys.down) {
              localVector.z += speed;
            }
            if (this.keys.left) {
              localVector.x -= speed;
            }
            if (this.keys.right) {
              localVector.x += speed;
            }

            if (!localVector.equals(zeroVector)) {
              localEuler.setFromQuaternion(this.rotation, camera.rotation.order);
              localEuler.x = 0;
              localEuler.z = 0;
              localQuaternion.setFromEuler(localEuler);
              this.position.add(localVector.applyQuaternion(localQuaternion));
              matrixNeedsUpdate = true;
            }

            if (this.poseNeedsUpdate) {
              this.rotation.setFromEuler(this.rotationOffset);

              this.poseNeedsUpdate = false;
              matrixNeedsUpdate = true;
            }

            if (webvrInstance.collide(this.position, this.velocity)) {
              matrixNeedsUpdate = true;

              this.lastCollideTime = now;
            } else {
              this.velocity.y += (-9.8 / 1000 / 1000 * 2) * timeDiff;
            }
            if (this.keys.space && (now - this.lastCollideTime) < 200) {
              this.velocity.y = 7 / 1000;
              this.lastCollideTime = 0;
            }
            this.lastPoseUpdateTime = now;

            if (matrixNeedsUpdate) {
              this.matrix.compose(this.position, this.rotation, this.scale);

              this.gamepads[0].poseNeedsUpdate = true;
              this.gamepads[1].poseNeedsUpdate = true;
            }
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
              position: new Float32Array(3),
              orientation: new Float32Array(4),
            };
            this.poseNeedsUpdate = false;

            // this.updatePose();

            const mousemove = e => {
              if (this.displayIsInControllerMode()) {
                const _isReversed = () => {
                  const {_parent: parent, _index: index} = this;
                  const mode = parent.getMode();
                  return mode === 'center' && index === 1;
                };

                if (e.event.ctrlKey) {
                  this.move(-e.event.movementX, -e.event.movementY, 0, _isReversed());
                } else if (e.event.altKey) {
                  this.move(-e.event.movementX, 0, -e.event.movementY, _isReversed());
                } else if (this._parent.keys.axis) {
                  this.axis(-e.event.movementX, -e.event.movementY, _isReversed());
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
            const reverseFactor = !reverse ? 1 : -1;
            this.positionOffset.x += -x * MOVE_FACTOR * reverseFactor;
            this.positionOffset.y += y * MOVE_FACTOR * reverseFactor;
            this.positionOffset.z += -z * MOVE_FACTOR * reverseFactor;

            this.poseNeedsUpdate = true;
          }

          axis(x, y, reverse) {
            const {axes} = this;

            const reverseFactor = !reverse ? 1 : -1;
            axes[0] = _clampAxis(axes[0] - (x * MOVE_FACTOR * reverseFactor));
            axes[1] = _clampAxis(axes[1] + (y * MOVE_FACTOR * reverseFactor));

            this.poseNeedsUpdate = true;
          }

          /* rotate(x, y) {
            const {rotationOffset} = this;

            const moveFactor = MOVE_FACTOR * (Math.PI * 2);
            rotationOffset.y = Math.max(Math.min(rotationOffset.y + (x * moveFactor), Math.PI / 2), -Math.PI / 2);
            rotationOffset.x = Math.max(Math.min(rotationOffset.x + (y * moveFactor), Math.PI / 2), -Math.PI / 2);

            this.updatePose();
          } */

          updatePose() {
            if (this.poseNeedsUpdate) {
              localMatrix.compose(this.positionOffset, localQuaternion.setFromEuler(this.rotationOffset), oneVector)
                .premultiply(this._parent.matrix);

              localMatrix.decompose(this.position, this.rotation, this.scale);
              this.pose.position[0] = this.position.x;
              this.pose.position[1] = this.position.y;
              this.pose.position[2] = this.position.z;
              this.pose.orientation[0] = this.rotation.x;
              this.pose.orientation[1] = this.rotation.y;
              this.pose.orientation[2] = this.rotation.z;
              this.pose.orientation[3] = this.rotation.w;

              this.poseNeedsUpdate = false;
            }
          }

          updateButtons() {
            if (this.displayIsInControllerMode()) {
              this.buttons[BUTTONS.PAD].touched = this._parent.keys.touch;
              this.buttons[BUTTONS.PAD].pressed = this._parent.keys.pad;
              this.buttons[BUTTONS.TRIGGER].pressed = this._parent.keys.trigger;
              this.buttons[BUTTONS.GRIP].pressed = this._parent.keys.grip;
              this.buttons[BUTTONS.MENU].pressed = this._parent.keys.menu;
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
const _clampAxis = v => Math.min(Math.max(v, -1), 1);

module.exports = WebVR;
