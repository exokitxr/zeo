const {
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,

  PORT,
} = require('./lib/constants/constants');
const novnc = require('retroarch/client.js');

const SIDES = ['left', 'right'];
const DIRECTIONS = [
  {
    direction: 'left',
    x: -1,
    y: 0,
  },
  {
    direction: 'right',
    x: 1,
    y: 0,
  },
  {
    direction: 'up',
    x: 0,
    y: 1,
  },
  {
    direction: 'down',
    x: 0,
    y: -1,
  },
];

class Retroarch {
  mount() {
    const {three: {THREE, scene}, elements, render, pose, input, world, ui, sound, utils: {geometry: geometryUtils}} = zeo;

    const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
    const _decomposeMatrix = matrix => {
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, rotation, scale);
      return {position, rotation, scale};
    };

    const consoleMaterial = new THREE.MeshPhongMaterial({
      color: 0x333333,
      // shading: THREE.FlatShading,
    });
    const cartridgeMaterial = new THREE.MeshPhongMaterial({
      color: 0x808080,
      // shading: THREE.FlatShading,
    });

    const retroarchEntity = {
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 1.5, -0.5,
            0, 0, 0, 1,
            1, 1, 1,
          ],
        },
      },
      entityAddedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();
        const entityObject = entityElement.getObject();

        const _makeGamepadState = () => ({
          grabSide: null,
          grabbing: false,
          menuPressed: false,
          triggerKey: null,
          padTouchKey: null,
          padKey: null,
        });
        const gamepadStates = {
          left: _makeGamepadState(),
          right: _makeGamepadState(),
        };

        const screenMesh = (() => {
          const canvas = document.createElement('canvas');
          canvas.width = WIDTH;
          canvas.height = HEIGHT;
          const c = novnc.connect({
            canvas: canvas,
            host: document.location.hostname,
            port: PORT,
            path: '/',
            ondisconnect: () => {
              console.warn('disconnected');
            },
          });

          /* document.body.addEventListener('keydown', e => {
            c.handleKeydown(e);
          });
          document.body.addEventListener('keypress', e => {
            c.handleKeypress(e);
          });
          document.body.addEventListener('keyup', e => {
            c.handleKeyup(e);
          }); */

          const geometry = new THREE.PlaneBufferGeometry(WORLD_WIDTH, WORLD_HEIGHT);
          const texture = new THREE.Texture(
            canvas,
            THREE.UVMapping,
            THREE.ClampToEdgeWrapping,
            THREE.ClampToEdgeWrapping,
            THREE.NearestFilter,
            THREE.NearestFilter,
            THREE.RGBFormat,
            THREE.UnsignedByteType,
            16
          );
          texture.needsUpdate = true;
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
          });

          const mesh = new THREE.Mesh(geometry, material);

          mesh.connection = c;
          mesh.destroy = () => {
            c.disconnect();
          };

          return mesh;
        })();
        entityObject.add(screenMesh);

        const consoleMesh = (() => {
          const object = new THREE.Object3D();
          object.position.set(0, 1.5, 0.5);

          const coreMesh = (() => {
            const geometry = geometryUtils.concatBufferGeometry([
              new THREE.BoxBufferGeometry(0.2, 0.05, 0.2),
              new THREE.BoxBufferGeometry(0.05, 0.02, 0.05)
                .applyMatrix(new THREE.Matrix4().makeTranslation(-(0.2 / 2) + (0.05 / 4), -0.05 / 2, -(0.2 / 2) + (0.05 / 4))),
              new THREE.BoxBufferGeometry(0.05, 0.02, 0.05)
                .applyMatrix(new THREE.Matrix4().makeTranslation(-(0.2 / 2) + (0.05 / 4), -0.05 / 2, (0.2 / 2) - (0.05 / 4))),
              new THREE.BoxBufferGeometry(0.05, 0.02, 0.05)
                .applyMatrix(new THREE.Matrix4().makeTranslation((0.2 / 2) - (0.05 / 4), -0.05 / 2, -(0.2 / 2) + (0.05 / 4))),
              new THREE.BoxBufferGeometry(0.05, 0.02, 0.05)
                .applyMatrix(new THREE.Matrix4().makeTranslation((0.2 / 2) - (0.05 / 4), -0.05 / 2, (0.2 / 2) - (0.05 / 4))),
            ]);
            const material = consoleMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
          })();
          object.add(coreMesh);

          const cartridgeMesh = (() => {
            const geometry = new THREE.BoxBufferGeometry(0.08, 0.05, 0.015)
              .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.05 / 2, 0));
            const material = cartridgeMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
          })();
          object.add(cartridgeMesh);

          return object;
        })();
        scene.add(consoleMesh);

        const gamepadMeshes = (() => {
          const leftGamepadMesh = (() => {
            const object = new THREE.Object3D();
            object.position.set(-0.5, 1.5, 0.5);

            const coreMesh = (() => {
              const geometry = new THREE.BoxBufferGeometry(0.05, 0.02, 0.1);
              const material = consoleMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              return mesh;
            })();
            object.add(coreMesh);

            const buttonsMesh = (() => {
              const geometry = geometryUtils.concatBufferGeometry([
                new THREE.BoxBufferGeometry(0.005, 0.005, 0.0075)
                  .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.02 / 2, -0.0075)),
                new THREE.BoxBufferGeometry(0.0075, 0.005, 0.005)
                  .applyMatrix(new THREE.Matrix4().makeTranslation(-0.0075, 0.02 / 2, 0)),
                new THREE.BoxBufferGeometry(0.005, 0.005, 0.0075)
                  .applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.02 / 2, 0.0075)),
                new THREE.BoxBufferGeometry(0.0075, 0.005, 0.005)
                  .applyMatrix(new THREE.Matrix4().makeTranslation(0.0075, 0.02 / 2, 0)),
                new THREE.BoxBufferGeometry(0.04, 0.02 / 2, 0.02)
                  .applyMatrix(new THREE.Matrix4().makeTranslation(-(0.05 / 2) + (0.04 / 2) - 0.005, 0, -(0.1 / 2) + (0.02 / 4))),
              ]);
              const material = cartridgeMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              return mesh;
            })();
            object.add(buttonsMesh);

            return object;
          })();

          const rightGamepadMesh = (() => {
            const object = new THREE.Object3D();
            object.position.set(0.5, 1.5, 0.5);

            const coreMesh = (() => {
              const geometry = new THREE.BoxBufferGeometry(0.05, 0.02, 0.1);
              const material = consoleMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              return mesh;
            })();
            object.add(coreMesh);

            const buttonsMesh = (() => {
              const geometry = geometryUtils.concatBufferGeometry([
                new THREE.BoxBufferGeometry(0.01, 0.005, 0.01)
                  .applyMatrix(new THREE.Matrix4().makeTranslation(0.01 * 3 / 4, 0.02 / 2, -0.01 * 3 / 4)),
                new THREE.BoxBufferGeometry(0.01, 0.005, 0.01)
                  .applyMatrix(new THREE.Matrix4().makeTranslation(-0.01 * 3 / 4, 0.02 / 2, 0.01 * 3 / 4)),
                new THREE.BoxBufferGeometry(0.04, 0.02 / 2, 0.02)
                  .applyMatrix(new THREE.Matrix4().makeTranslation((0.05 / 2) - (0.04 / 2) + 0.005, 0, -(0.1 / 2) + (0.02 / 4))),
              ]);
              const material = cartridgeMaterial;

              const mesh = new THREE.Mesh(geometry, material);
              return mesh;
            })();
            object.add(buttonsMesh);

            return object;
          })();

          return {
            left: leftGamepadMesh,
            right: rightGamepadMesh,
          };
        })();
        SIDES.forEach(side => {
          const gamepadMesh = gamepadMeshes[side];
          scene.add(gamepadMesh);
        });

        const _gripdown = e => {
          const {side} = e;
          const {gamepads} = pose.getStatus();
          const gamepad = gamepads[side];
          const gamepadState = gamepadStates[side];

          if (gamepad) {
            const {grabSide} = gamepadState;

            if (!grabSide) {
              const {worldPosition: controllerPosition} = gamepad;

              const gamepadDistanceSpecs = SIDES.map(gamepadSide => {
                const gamepadMesh = gamepadMeshes[gamepadSide];
                const gamepadMeshPosition = gamepadMesh.getWorldPosition();
                const distance = gamepadMeshPosition.distanceTo(controllerPosition);
                return {
                  gamepadSide,
                  distance,
                };
              }).filter(({distance}) => distance < 0.1).sort((a, b) => a.distance - b.distance);

              if (gamepadDistanceSpecs.length > 0) {
                const gamepadDistanceSpec = gamepadDistanceSpecs[0];
                const {gamepadSide} = gamepadDistanceSpec;
                gamepadState.grabSide = gamepadSide;
                gamepadState.grabbing = true;

                e.stopImmediatePropagation();
              }
            } else {
              e.stopImmediatePropagation();
            }
          }
        };
        input.on('gripdown', _gripdown, {
          priority: 1,
        });
        const _gripup = e => {
          const {side} = e;
          const gamepadState = gamepadStates[side];
          const {grabSide} = gamepadState;

          if (grabSide) {
            const {grabbing} = gamepadState;

            if (!grabbing) {
              gamepadState.grabSide = null;
              gamepadState.padTouchKey = null;
              gamepadState.padKey = null;
            } else {
              gamepadState.grabbing = null;
            }

            e.stopImmediatePropagation();
          }
        };
        input.on('gripup', _gripup, {
          priority: 1,
        });

        const _getGamepadEventKeyboardEventType = eventName => {
          switch (eventName) {
            case 'paddown':
            case 'padtouchdown':
              return 'keydown';
            case 'pad':
            case 'padtouch':
              return 'keypress';
            case 'padup':
            case 'padtouchup':
              return 'keyup';
            default:
              return null;
          }
        };
        const _getGamepadDirection = side => {
          const {gamepads} = pose.getStatus();
          const gamepad = gamepads[side];
          const {axes} = gamepad;
          const [x, y] = axes;

          return DIRECTIONS.map(directionSpec => {
            const {direction, x: ax, y: ay} = directionSpec;
            const dx = x - ax;
            const dy = y - ay;
            const distance = Math.sqrt((dx * dx) + (dy * dy));
            return {
              direction,
              distance,
            };
          }).sort((a, b) => a.distance - b.distance)[0].direction;
        };
        const _getGamepadKey = (eventName, side, grabSide) => {
          const direction = _getGamepadDirection(side);
          if (eventName === 'triggerdown' || eventName === 'trigger' || eventName === 'triggerup') {
            if (grabSide === 'left') {
              return 'q';
            } else if (grabside === 'right') {
              return 'e';
            } else {
              return null;
            }
          } else if (eventName === 'padtouchdown' || eventName === 'padtouch' || eventName === 'padtouchup') {
            if (grabSide === 'left') {
              switch (direction) {
                case 'left': return 'ArrowLeft';
                case 'right': return 'ArrowRight';
                case 'up': return 'ArrowUp';
                case 'down': return 'ArrowDown';
                default: return null;
              }
            } else {
              return null;
            }
          } else if (eventName === 'paddown' || eventName === 'pad' || eventName === 'padup') {
            if (grabSide === 'left') {
              switch (direction) {
                case 'left': return 'a';
                case 'right': return 'd';
                case 'up': return 'w';
                case 'down': return 's';
                default: return null;
              }
            } else if (grabSide === 'right') {
              const leftGamepadMenuPressed = SIDES.some(side => {
                const gamepadState = gamepadStates[side];
                const {grabSide, menuPressed} = gamepadState;

                return grabSide === 'left' && menuPressed;
              });

              if (!leftGamepadMenuPressed) {
                switch (direction) {
                  case 'down': return 'x';
                  case 'left': return 'z';
                  case 'up': return 'c';
                  case 'right': return 'v';
                  default: return null;
                }
              } else {
                switch (direction) {
                  case 'left': return 'f';
                  case 'right': return 'h';
                  case 'up': return 't';
                  case 'down': return 's';
                  default: return null;
                }
              }
            } else {
              return null;
            }
          } else {
            return null;
          }
        };
        const _getCode = key => {
          if (/^[a-z]$/i.test(key)) {
            return 'Key' + key.toUpperCase();
          } else {
            return key;
          }
        }
        const _emitGamepadKeyboardEvent = (eventName, e) => {
          const {side} = e;
          const gamepadState = gamepadStates[side];
          const {grabSide} = gamepadState;

          if (grabSide) {
            if (eventName === 'triggerdown' || eventName === 'padtouchdown' || eventName === 'paddown') {
              const key = _getGamepadKey(eventName, side, grabSide);

              if (key) {
                const type = _getGamepadEventKeyboardEventType(eventName);
                const code = _getCode(key);

                const keyboardEvent = new KeyboardEvent({
                  type: type,
                }, {
                  key: key,
                  code: code,
                });
                screenMesh.connection.handleKeydown(keyboardEvent);

                if (eventName === 'triggerdown') {
                  gamepadState.triggerKey = key;
                } else if (eventName === 'padtouchdown') {
                  gamepadState.padTouchKey = key;
                } else if (eventName === 'paddown') {
                  gamepadState.padKey = key;
                }

                e.stopImmediatePropagation();
              }
            } else {
              if (eventName === 'trigger' || eventName === 'triggerup') {
                const {triggerKey: key} = gamepadState;
                const type = _getGamepadEventKeyboardEventType(eventName);
                const code = _getCode(key);

                const keyboardEvent = new KeyboardEvent({
                  type: type,
                }, {
                  key: key,
                  code: code,
                });
                if (eventName === 'trigger') {
                  screenMesh.connection.handleKeypress(keyboardEvent);

                  gamepadState.triggerKey = null;
                } else if (eventName === 'triggerup') {
                  screenMesh.connection.handleKeyup(keyboardEvent);
                }
              } else if (eventName === 'padtouch' || eventName === 'padtouchup') {
                const {padTouchKey: key} = gamepadState;
                const type = _getGamepadEventKeyboardEventType(eventName);
                const code = _getCode(key);

                const keyboardEvent = new KeyboardEvent({
                  type: type,
                }, {
                  key: key,
                  code: code,
                });
                if (eventName === 'padtouch') {
                  screenMesh.connection.handleKeypress(keyboardEvent);

                  gamepadState.padTouchKey = null;
                } else if (eventName === 'padtouchup') {
                  screenMesh.connection.handleKeyup(keyboardEvent);
                }
              } else if (eventName === 'pad' || eventName === 'padup') {
                const {padKey: key} = gamepadState;
                const type = _getGamepadEventKeyboardEventType(eventName);
                const code = _getCode(key);

                const keyboardEvent = new KeyboardEvent({
                  type: type,
                }, {
                  key: key,
                  code: code,
                });
                if (eventName === 'pad') {
                  screenMesh.connection.handleKeypress(keyboardEvent);

                  gamepadState.padKey = null;
                } else if (eventName === 'padup') {
                  screenMesh.connection.handleKeyup(keyboardEvent);
                }
              }
            }
          }
        };

        const _triggerdown = e => {
          _emitGamepadKeyboardEvent('triggerdown', e);
        };
        input.on('triggerdown', _triggerdown, {
          priority: 1,
        });
        const _trigger = e => {
          _emitGamepadKeyboardEvent('trigger', e);
        };
        input.on('trigger', _trigger, {
          priority: 1,
        });
        const _triggerup = e => {
          _emitGamepadKeyboardEvent('triggerup', e);
        };
        input.on('triggerup', _triggerup, {
          priority: 1,
        });
        const _padtouchdown = e => {
          _emitGamepadKeyboardEvent('padtouchdown', e);
        };
        input.on('padtouchdown', _padtouchdown, {
          priority: 1,
        });
        const _padtouch = e => {
          _emitGamepadKeyboardEvent('padtouch', e);
        };
        input.on('padtouch', _padtouch, {
          priority: 1,
        });
        const _padtouchup = e => {
          _emitGamepadKeyboardEvent('padtouchup', e);
        };
        input.on('padtouchup', _padtouchup, {
          priority: 1,
        });
        const _paddown = e => {
          _emitGamepadKeyboardEvent('paddown', e);
        };
        input.on('paddown', _paddown, {
          priority: 1,
        });
        const _pad = e => {
          _emitGamepadKeyboardEvent('pad', e);
        };
        input.on('pad', _pad, {
          priority: 1,
        });
        const _padup = e => {
          _emitGamepadKeyboardEvent('padup', e);
        };
        input.on('padup', _padup, {
          priority: 1,
        });
        const _menudown = e => {
          const {side} = e;
          const gamepadState = gamepadStates[side];
          const {grabSide} = gamepadState;

          if (grabSide) {
            const keyboardEvent = new KeyboardEvent({
              type: 'keydown',
            }, {
              code: 'Enter',
              key: 'Enter',
            });
            connection.handleKeydown(keyboardEvent);

            gamepadState.menuPressed = true;

            e.stopImmediatePropagation();
          }
        };
        input.on('menudown', _menudown, {
          priority: 1,
        });
        const _menu = e => {
          const {side} = e;
          const gamepadState = gamepadStates[side];
          const {grabSide} = gamepadState;

          if (grabSide) {
            const keyboardEvent = new KeyboardEvent({
              type: 'keypress',
            }, {
              code: 'Enter',
              key: 'Enter',
            });
            const {connection} = screenMesh;
            connection.handleKeypress(keyboardEvent);

            e.stopImmediatePropagation();
          }
        };
        input.on('menu', _menu, {
          priority: 1,
        });
        const _menuup = e => {
          const {side} = e;
          const gamepadState = gamepadStates[side];
          const {grabSide} = gamepadState;

          if (grabSide) {
            const keyboardEvent = new KeyboardEvent({
              type: 'keyup',
            }, {
              code: 'Enter',
              key: 'Enter',
            });
            const {connection} = screenMesh;
            connection.handleKeyup(keyboardEvent);

            gamepadState.menuPressed = false;

            e.stopImmediatePropagation();
          }
        };
        input.on('menuup', _menuup, {
          priority: 1,
        });

        const _update = () => {
          const _updateScreen = () => {
            const {
              material: {
                map: texture,
              },
            } = screenMesh;
            texture.needsUpdate = true;
          };
          const _updateGamepads = () => {
            const {gamepads} = pose.getStatus();

            SIDES.forEach(side => {
              const gamepadState = gamepadStates[side];
              const {grabSide} = gamepadState;

              if (grabSide) {
                const gamepad = gamepads[side];
                const {worldPosition: controllerPosition, worldRotation: controllerRotation, worldScale: controllerScale} = gamepad;

                const gamepadMesh = gamepadMeshes[grabSide];
                gamepadMesh.position.copy(controllerPosition);
                gamepadMesh.quaternion.copy(controllerRotation);
                gamepadMesh.scale.copy(controllerScale);
              }
            });
          };

          _updateScreen();
          _updateGamepads();
        };
        render.on('update', _update);

        entityApi._cleanup = () => {
          entityObject.remove(screenMesh);
          screenMesh.destroy();

          scene.remove(consoleMesh);
          SIDES.forEach(side => {
            const gamepadMesh = gamepadMeshes[side];
            scene.remove(gamepadMesh);
          });

          input.removeListener('gripdown', _gripdown);
          input.removeListener('gripup', _gripup);
          input.removeListener('triggerdown', _triggerdown);
          input.removeListener('trigger', _trigger);
          input.removeListener('triggerup', _triggerup);
          input.removeListener('padtouchdown', _padtouchdown);
          input.removeListener('padtouch', _padtouch);
          input.removeListener('padtouchup', _padtouchup);
          input.removeListener('paddown', _paddown);
          input.removeListener('pad', _pad);
          input.removeListener('padup', _padup);
          input.removeListener('menudown', _menudown);
          input.removeListener('menu', _menu);
          input.removeListener('menuup', _menuup);
          render.removeListener('update', _update);
        };
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        const entityApi = entityElement.getEntityApi();
        const entityObject = entityElement.getObject();

        switch (name) {
          case 'position': {
            const position = newValue;

            if (position) {
              entityObject.position.set(position[0], position[1], position[2]);
              entityObject.quaternion.set(position[3], position[4], position[5], position[6]);
              entityObject.scale.set(position[7], position[8], position[9]);
            }

            break;
          }
        }
      },
      entityRemovedCallback(entityElement) {
        const entityApi = entityElement.getEntityApi();

        entityApi._cleanup();
      },
    };
    elements.registerEntity(this, retroarchEntity);

    this._cleanup = () => {
      elements.unregisterEntity(this, retroarchEntity);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Retroarch;
