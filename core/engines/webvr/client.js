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

const events = require('events');
const EventEmitter = events.EventEmitter;
const mod = require('mod-loop');

const VREffect = require('./lib/three-extra/VREffect');

const DEFAULT_USER_HEIGHT = 1.6;
const DEFAULT_USER_IPD = 62 / 1000;
const DEFAULT_USER_FOV = 110;
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 1080;
const DEFAULT_ASPECT_RATIO = DEFAULT_WIDTH / DEFAULT_HEIGHT;

const POSITION_SPEED = 0.05;
const POSITION_SPEED_FAST = POSITION_SPEED * 5;
const ROTATION_SPEED = 0.02 / (Math.PI * 2);

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

        VREffect(THREE);

        class WebvrInstance extends EventEmitter {
          constructor() {
            super();

            this.display = null;
            this.stereoscopic = false;
            this.isOpen = false;
            this.isOpening = false;

            this.stageMatrix = new THREE.Matrix4();

            const _makeDefaultHmdStatus = () => {
              return {
                pose: null,
                position: camera.position.clone(),
                rotation: camera.quaternion.clone(),
                scale: camera.scale.clone(),
                matrix: camera.matrix.clone(),
              };
            };
            this.status = {
              hmd: _makeDefaultHmdStatus(),
              gamepads: {
                left: null,
                right: null,
              },
            };
          }

          requestRenderLoop({display = null, stereoscopic = false, update = () => {}, updateEye = () => {}}) {
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

                  if (display && stereoscopic) {
                    const {getVRDisplays} = navigator; // HACK to prevent VREffect from initializing VR displays
                    navigator.getVRDisplays = null;
                    effect = new THREE.VREffect(renderer);
                    navigator.getVRDisplays = getVRDisplays;

                    effect.setVRDisplay(display);
                    effect.onEye = camera => {
                      updateEye(camera);
                    };
                    effect.isPresenting = true;
                    effect.autoSubmitFrame = false;

                    const resize = () => {
                      effect.setSize(window.innerWidth, window.innerHeight);
                    };
                    window.addEventListener('resize', resize);

                    cleanups.push(() => {
                      this.display = null;
                      this.stereoscopic = false;

                      effect = null;

                      renderer.setSize(window.innerWidth, window.innerHeight);
                      renderer.setPixelRatio(window.devicePixelRatio);

                      window.removeEventListener('resize', resize);
                    });
                  }

                  const stageMatrix = (() => {
                    if (display && display.stageParameters) {
                      return new THREE.Matrix4().fromArray(display.stageParameters.sittingToStandingTransform);
                    } else {
                      return new THREE.Matrix4().makeTranslation(0, DEFAULT_USER_HEIGHT, 0);
                    }
                  })();
                  this.setStageMatrix(stageMatrix);

                  const _renderLoop = () => {
                    const _render = () => {
                      update(); // update plugins

                      if (effect) {
                        effect.render(scene, camera); // perform binocular render
                      } else {
                        updateEye(camera); // perform monocular eye render
                        renderer.render(scene, camera); // perform final render
                      }
                    };

                    const _requestAnimationFrame = fn => (display && display.isPresenting) ?
                      display.requestAnimationFrame(fn)
                    :
                      requestAnimationFrame(fn);
                    const _cancelAnimationFrame = animationFrame => (display && display.isPresenting) ?
                      display.cancelAnimationFrame(animationFrame)
                    :
                      cancelAnimationFrame(animationFrame);
                    const _submitFrame = pose => {
                      if (display && display.isPresenting) {
                        display.submitFrame(pose);
                      }
                    };

                    let animationFrame = null;
                    const _recurse = () => {
                      animationFrame = _requestAnimationFrame(() => {
                        animationFrame = null;

                        const status = this.updateStatus();
                        _render();
                        _submitFrame(status.hmd.pose);

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

          requestEnterVR({stereoscopic = true, update = () => {}, updateEye = () => {}, onExit = () => {}}) {
            const _startOpening = () => {
              this.isOpening = true;

              return Promise.resolve();
            };
            const _stopOpening = () => {
              this.isOpening = false;

              return Promise.resolve();
            };
            const _checkNotOpening = () => new Promise((accept, reject) => {
              const {isOpening} = this;

              if (!isOpening) {
                accept();
              } else {
                const err = new Error('webvr engine is already entering vr.');
                reject(err);
              }
            });
            const _getVRDisplays = () => navigator.getVRDisplays();

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
              .then(_getVRDisplays)
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

                return display.requestPresent([
                  {
                    source: domElement,
                  }
                ])
                  .then(() => new Promise((accept, reject) => {
                    const _listen = () => {
                      if (display instanceof FakeVRDisplay) {
                        const fullscreenchange = () => {
                          const {isPresenting} = display;
                          if (!isPresenting) {
                            _destroy();

                            onExit();
                          }
                        };
                        // document.addEventListener('fullscreenchange', fullscreenchange);
                        document.addEventListener('webkitfullscreenchange', fullscreenchange);

                        cleanups.push(() => {
                          display.destroy();

                          // document.removeEventListener('fullscreenchange', fullscreenchange);
                          document.removeEventListener('webkitfullscreenchange', fullscreenchange);
                        });
                      } else {
                        const vrdisplaypresentchange = () => {
                          const {isPresenting} = display;
                          if (!isPresenting) {
                            _destroy();

                            onExit();
                          }
                        };
                        document.addEventListener('vrdisplaypresentchange', vrdisplaypresentchange);

                        cleanups.push(() => {
                          document.removeEventListener('vrdisplaypresentchange', vrdisplaypresentchange);
                        });
                      }
                    };
                    const _requestRenderLoop = () => {
                      const renderLoopPromise = this.requestRenderLoop({
                        display,
                        stereoscopic,
                        update,
                        updateEye,
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
                        const api = {
                          destroy: _destroy,
                        };
                        return api;
                      })
                  }));
              })
              .catch(err => {
                _stopOpening();
                _destroy();

                return Promise.reject(err);
              });
            result.destroy = _destroy;

            return result;
          }

          updateStatus() {
            const {display} = this;

            if (display) {
              const _getMatrixFromPose = (pose, stageMatrix) => {
                const position = pose.position !== null ? new THREE.Vector3().fromArray(pose.position) : new THREE.Vector3(0, 0, 0);
                const rotation = pose.orientation !== null ? new THREE.Quaternion().fromArray(pose.orientation) : new THREE.Quaternion(0, 0, 0, 1);
                const scale = new THREE.Vector3(1, 1, 1);
                const matrix = stageMatrix.clone().multiply(new THREE.Matrix4().compose(position, rotation, scale));
                return matrix;
              };
              const _getPropertiesFromMatrix = matrix => {
                const position = new THREE.Vector3();
                const rotation = new THREE.Quaternion();
                const scale = new THREE.Vector3();
                matrix.decompose(position, rotation, scale);

                return {
                  position,
                  rotation,
                  scale,
                };
              };
              const _getHmdStatus = ({stageMatrix}) => {
                const pose = display.getPose();

                const matrix = _getMatrixFromPose(pose, stageMatrix);
                const {position, rotation, scale} = _getPropertiesFromMatrix(matrix);

                return {
                  pose,
                  matrix,
                  position,
                  rotation,
                  scale,
                };
              };
              const _getGamepadsStatus = ({stageMatrix}) => {
                const gamepads = (() => {
                  if (display.getGamepads) {
                    return display.getGamepads();
                  } else {
                    return navigator.getGamepads();
                  }
                })();
                const leftGamepad = gamepads[0];
                const rightGamepad = gamepads[1];

                const _isGamepadAvailable = gamepad => gamepad !== undefined && gamepad.pose !== null && gamepad.pose.position !== null && gamepad.pose.orientation !== null;
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

                  const matrix = _getMatrixFromPose(pose, stageMatrix);
                  const {position, rotation, scale} = _getPropertiesFromMatrix(matrix);
                  const buttons = {
                    pad: _getGamepadButtonStatus(padButton),
                    trigger: _getGamepadButtonStatus(triggerButton),
                    grip: _getGamepadButtonStatus(gripButton),
                    menu: _getGamepadButtonStatus(menuButton),
                  };

                  return {
                    pose,
                    matrix,
                    position,
                    rotation,
                    scale,
                    buttons,
                  };
                };

                return {
                  left: _isGamepadAvailable(leftGamepad) ? _getGamepadPose(leftGamepad) : null,
                  right: _isGamepadAvailable(rightGamepad) ? _getGamepadPose(rightGamepad) : null,
                };
              };

              const stageMatrix = this.getStageMatrix();
              const status = {
                hmd: _getHmdStatus({stageMatrix}),
                gamepads: _getGamepadsStatus({stageMatrix}),
              };
              this.setStatus(status);

              return status;
            } else {
              return this.getStatus();
            }
          }

          getDisplay() {
            return this.display;
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

          multiplyStageMatrix(matrix) {
            this.stageMatrix.multiply(matrix);
          }
        }

        class FakeVRDisplay extends EventEmitter {
          constructor() {
            super();

            this.canPresent = true;
            this.isPresenting = false;

            const sittingToStandingTransform = new THREE.Matrix4().makeTranslation(0, DEFAULT_USER_HEIGHT, 0);
            const standingToSittingTransform = new THREE.Matrix4().getInverse(sittingToStandingTransform);
            const position = camera.position.clone().applyMatrix4(standingToSittingTransform);
            this.position = position;
            const rotation = camera.quaternion.clone();
            this.rotation = rotation;
            const scale = camera.scale.clone();
            this.scale = scale;
            this.matrix = new THREE.Matrix4().compose(position, rotation, scale);

            this.stageParameters = {
              sittingToStandingTransform: sittingToStandingTransform.toArray(),
            };

            const gamepads = [new FakeVRGamepad(this, 0), new FakeVRGamepad(this, 1)];
            this.gamepads = gamepads;

            const fullscreenchange = e => {
              const {isPresenting: wasPresenting} = this;

              const isPresenting = !!(document.fullscreenElement || document.webkitFullscreenElement);
              this.isPresenting = isPresenting;

              if (!wasPresenting && isPresenting) {
                this.emit('open');
              } else if (wasPresenting && !isPresenting) {
                this.emit('close');
              }
            };
            // document.addEventListener('fullscreenchange', fullscreenchange);
            document.addEventListener('webkitfullscreenchange', fullscreenchange);

            const keys = {
              up: false,
              down: false,
              left: false,
              right: false,
              shift: false,
            };
            this.keys = keys;

            const _resetKeys = () => {
              keys.up = false;
              keys.down = false;
              keys.left = false;
              keys.right = false;
              keys.shift = false;
            };

            this.mode = 'move';

            const keydown = e => {
              if (this.isPresenting) {
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
                  case 16: // shift
                    keys.shift = true;
                    break;
                  case 90: // Z
                    this.mode = 'left';
                    break;
                  case 88: // X
                    this.mode = 'move';
                    break;
                  case 67: // C
                    this.mode = 'right';
                    break;
                }
              }
            };
            const keyup = e => {
              if (this.isPresenting) {
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
                  case 16: // shift
                    keys.shift = false;
                    break;
                }
              }
            };
            const mousemove = e => {
              if (this.isPresenting) {
                const {rotation: quaternion} = this;

                const rotation = new THREE.Euler().setFromQuaternion(quaternion, camera.rotation.order);
                rotation.x = Math.max(Math.min(rotation.x - e.movementY * ROTATION_SPEED, Math.PI / 2), -Math.PI / 2);
                rotation.y = mod(rotation.y - e.movementX * ROTATION_SPEED, Math.PI * 2);
                quaternion.setFromEuler(rotation);

                this.updateMatrix();
                this.updateGamepads();
              }
            };
            const pointerlockchange = e => {
              if (!document.pointerLockElement) {
                _resetKeys();
              }
            };
            const pointerlockerror = err => {
              _resetKeys();

              console.warn('pointer lock error', err);
            };
            zeo.addEventListener('keydown', keydown);
            zeo.addEventListener('keyup', keyup);
            zeo.addEventListener('mousemove', mousemove);
            zeo.addEventListener('pointerlockchange', pointerlockchange);
            zeo.addEventListener('pointerlockerror', pointerlockerror);

            this._cleanup = () => {
              for (let i = 0; i < gamepads.length; i++) {
                const gamepad = gamepads[i];
                gamepad.destroy();
              }

              // document.removeEventListener('fullscreenchange', fullscreenchange);
              document.removeEventListener('webkitfullscreenchange', fullscreenchange);

              zeo.removeEventListener('keydown', keydown);
              zeo.removeEventListener('keyup', keyup);
              zeo.removeEventListener('mousemove', mousemove);
              zeo.removeEventListener('pointerlockchange', pointerlockchange);
              zeo.removeEventListener('pointerlockerror', pointerlockerror);
            };
          }

          requestPresent([{source}]) {
            source.webkitRequestFullscreen();
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

          getPose() {
            const {position, rotation} = this;

            return {
              position: position.toArray(),
              orientation: rotation.toArray(),
            };
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

          getFrameData(frameData) {
            const eyeCamera = camera.clone();
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
                  axes: [0, 0],
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

            const positionOffset = new THREE.Vector3(
              0.2 * (index === 0 ? -1 : 1),
              -0.1,
              -0.2
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

            const mousewheel = e => {
              const {_parent: parent, _index: index} = this;
              const mode = parent.getMode();

              if (parent.isPresenting && ((mode === 'left' && index === 0) || (mode === 'right' && index === 1))) {
                e.preventDefault();

                if (!e.shiftKey) {
                  this.move(e.deltaX, e.deltaY);
                } else {
                  this.rotate(e.deltaX, e.deltaY);
                }
              }
            };
            zeo.addEventListener('mousewheel', mousewheel);

            this._cleanup = () => {
              zeo.removeEventListener('mousewheel', mousewheel);
            };
          }

          move(x, y) {
            const {positionOffset} = this;

            const moveFactor = 0.001;
            positionOffset.x += -x * moveFactor;
            positionOffset.y += y * moveFactor;

            this.updateProperties();
          }

          rotate(x, y) {
            const {rotationOffset} = this;

            const moveFactor = 0.001 * (Math.PI * 2);
            rotationOffset.y = Math.max(Math.min(rotationOffset.y + (x * moveFactor), Math.PI / 2), -Math.PI / 2);
            rotationOffset.x = Math.max(Math.min(rotationOffset.x + (y * moveFactor), Math.PI / 2), -Math.PI / 2);

            this.updateProperties();
          }

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
            const position = new THREE.Vector3();
            const rotation = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            worldMatrix.decompose(position, rotation, scale);

            this.position.copy(position);
            this.rotation.copy(rotation);
            this.scale.copy(scale);

            this.pose.position = position.toArray();
            this.pose.orientation = rotation.toArray();
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
const _canPresent = vrDisplay => vrDisplay.canPresecnt;

module.exports = WebVR;
