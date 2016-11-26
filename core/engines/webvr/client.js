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

const DEFAULT_USER_HEIGHT = 1.6;
const POSITION_SPEED = 0.05;
const POSITION_SPEED_FAST = POSITION_SPEED * 5;
const ROTATION_SPEED = 0.02 / (Math.PI * 2);

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

        class WebvrInstance extends EventEmitter {
          constructor() {
            super();

            this.display = null;
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

          open(display) {
            this.display = display;
            this.isOpen = true;

            const stageMatrix = (() => {
              if (display.stageParameters) {
                return new THREE.Matrix4().fromArray(display.stageParameters.sittingToStandingTransform);
              } else {
                return new THREE.Matrix4().makeTranslation(0, DEFAULT_USER_HEIGHT, 0);
              }
            })();
            this.setStageMatrix(stageMatrix);

            this.emit('open');
          }

          close() {
            this.display = null;
            this.isOpen = false;

            this.emit('close');
          }

          updateStatus() {
            const {display, stageMatrix} = this;

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

            const status = {
              hmd: _getHmdStatus({stageMatrix}),
              gamepads: _getGamepadsStatus({stageMatrix}),
            };
            this.setStatus(status);

            return status;
          }

          tick() {
            this.emit('tick');
          }

          startOpening() {
            this.isOpening = true;
          }

          endOpening() {
            this.isOpening = false;
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
        }

        const webvrInstance = new WebvrInstance();

        const _enterVr = () => {
          webvrInstance.startOpening();

          return navigator.getVRDisplays()
            .then(displays => {
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
                      rotation.x += (-e.movementY * ROTATION_SPEED);
                      rotation.y += (-e.movementX * ROTATION_SPEED);
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
                  document.addEventListener('keydown', keydown);
                  document.addEventListener('keyup', keyup);
                  document.addEventListener('mousemove', mousemove);
                  document.addEventListener('pointerlockchange', pointerlockchange);
                  document.addEventListener('pointerlockerror', pointerlockerror);

                  this._cleanup = () => {
                    for (let i = 0; i < gamepads.length; i++) {
                      const gamepad = gamepads[i];
                      gamepad.destroy();
                    }

                    // document.removeEventListener('fullscreenchange', fullscreenchange);
                    document.removeEventListener('webkitfullscreenchange', fullscreenchange);
                    document.removeEventListener('keydown', keydown);
                    document.removeEventListener('keyup', keyup);
                    document.removeEventListener('mousemove', mousemove);
                    document.removeEventListener('pointerlockchange', pointerlockchange);
                    document.removeEventListener('pointerlockerror', pointerlockerror);
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
                  document.addEventListener('mousewheel', mousewheel);

                  this._cleanup = () => {
                    document.removeEventListener('mousewheel', mousewheel);
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
              ]).then(() => {
                const _requestAnimationFrame = fn => display.isPresenting ? display.requestAnimationFrame(fn) : requestAnimationFrame(fn);
                const _cancelAnimationFrame = animationFrame => display.isPresenting ? display.cancelAnimationFrame(animationFrame) : cancelAnimationFrame(animationFrame);
                const _submitFrame = pose => {
                  if (display.isPresenting) {
                    display.submitFrame(pose);
                  }
                };

                const _open = () => {
                  webvrInstance.open(display);

                  let animationFrame = null;
                  const _recurse = () => {
                    animationFrame = _requestAnimationFrame(() => {
                      animationFrame = null;

                      const status = webvrInstance.updateStatus();
                      webvrInstance.tick();

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

                let cleanups = [];
                const _close = () => {
                  for (let i = 0; i < cleanups.length; i++) {
                    const cleanup = cleanups[i];
                    cleanup();
                  }

                  cleanups = [];

                  webvrInstance.close();
                };
                if (display instanceof FakeVRDisplay) {
                  const fullscreenchange = () => {
                    const {isPresenting} = display;
                    if (!isPresenting) {
                      display.destroy();

                      _close();
                    }
                  };
                  // document.addEventListener('fullscreenchange', fullscreenchange);
                  document.addEventListener('webkitfullscreenchange', fullscreenchange);

                  cleanups.push(() => {
                    // document.removeEventListener('fullscreenchange', fullscreenchange);
                    document.removeEventListener('webkitfullscreenchange', fullscreenchange);
                  });
                } else {
                  const vrdisplaypresentchange = () => {
                    const {isPresenting} = display;
                    if (!isPresenting) {
                      _close();
                    }
                  };
                  document.addEventListener('vrdisplaypresentchange', vrdisplaypresentchange);

                  cleanups.push(() => {
                    document.removeEventListener('vrdisplaypresentchange', vrdisplaypresentchange);
                  });
                }

                _open();
              });
            })
            .then(() => {
              webvrInstance.endOpening();
            })
            .catch(err => {
              webvrInstance.endOpening();

              return Promise.reject(err);
            });
        };

        const _requestAnchor = () => new Promise((accept, reject) => {
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
            a.appendChild(img);
            document.body.appendChild(a);

            const click = e => {
              if (!webvrInstance.isOpen && !webvrInstance.isOpening) {
                _enterVr()
                  .then(() => {
                    console.log('success!');
                  })
                  .catch(err => {
                    console.log('failure', err);
                  });
              }
            };
            domElement.addEventListener('click', click);

            const _destroy = () => {
              document.body.removeChild(a);

              domElement.removeEventListener('click', click);
            };

            accept({
              destroy: _destroy,
            });
          };
          img.onerror = err => {
            reject(err);
          };
        });

        return _requestAnchor()
          .then(({destroy: destroyAnchor}) => {
            if (live) {
              this._cleanup = () => {
                destroyAnchor();
              };

              return webvrInstance;
            }
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

module.exports = WebVR;
