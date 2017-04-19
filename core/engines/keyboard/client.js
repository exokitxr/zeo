import {
  KEYBOARD_WIDTH,
  KEYBOARD_HEIGHT,
  KEYBOARD_WORLD_WIDTH,
  KEYBOARD_WORLD_HEIGHT,
  KEYBOARD_WORLD_DEPTH,

  KEYBOARD_HEADER_WIDTH,
  KEYBOARD_HEADER_HEIGHT,
  KEYBOARD_HEADER_WORLD_WIDTH,
  KEYBOARD_HEADER_WORLD_HEIGHT,

  DEFAULT_USER_HEIGHT,
} from './lib/constants/keyboard';
import keyboardImgString from './lib/img/keyboard';
import keyboardHighlightImgString from './lib/img/keyboard-highlight';
import dotsImgString from './lib/img/dots';
import dotsHighlightImgString from './lib/img/dots-highlight';

const keyboardImgSrc = 'data:image/svg+xml;base64,' + btoa(keyboardImgString);
const keyboardHighlightImgSrc = 'data:image/svg+xml;base64,' + btoa(keyboardHighlightImgString);
const dotsImgSrc = 'data:image/svg+xml;base64,' + btoa(dotsImgString);
const dotsHighlightImgSrc = 'data:image/svg+xml;base64,' + btoa(dotsHighlightImgString);

const SIDES = ['left', 'right'];

class Keyboard {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestImage = src => new Promise((accept, reject) => {
      const img = new Image();
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
      img.src = src;
    });
    const _requestImageCanvas = src => _requestImage(src)
      .then(img => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.ctx = ctx;

        return Promise.resolve(canvas);
      });

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/input',
        '/core/engines/three',
        '/core/engines/webvr',
        '/core/engines/biolumi',
        '/core/engines/rend',
        '/core/utils/js-utils',
        '/core/utils/geometry-utils',
      ]),
      _requestImage(keyboardImgSrc),
      _requestImageCanvas(keyboardHighlightImgSrc),
      _requestImage(dotsImgSrc),
      _requestImage(dotsHighlightImgSrc),
    ]).then(([
      [
        input,
        three,
        webvr,
        biolumi,
        rend,
        jsUtils,
        geometryUtils,
      ],
      keyboardImg,
      keyboardHighlightCanvas,
      dotImg,
      dotHighlightImg,
    ]) => {
      if (live) {
        const {THREE, scene, camera} = three;
        const {events} = jsUtils;
        const {EventEmitter} = events;

        const transparentImg = biolumi.getTransparentImg();
        const transparentMaterial = biolumi.getTransparentMaterial();

        const oneVector = new THREE.Vector3(1, 1, 1);

        const _decomposeObjectMatrixWorld = object => {
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          object.matrixWorld.decompose(position, rotation, scale);
          return {position, rotation, scale};
        };

        const nop = () => {};

        const keyboardState = {
          focusSpec: null,
        };

        const keyboardMesh = (() => {
          const object = new THREE.Object3D();
          object.rotation.order = camera.rotation.order;
          object.visible = false;

          const planeMesh = (() => {
            const geometry = new THREE.PlaneBufferGeometry(KEYBOARD_WORLD_WIDTH, KEYBOARD_WORLD_HEIGHT);
            const material = (() => {
              const texture = new THREE.Texture(
                keyboardImg,
                THREE.UVMapping,
                THREE.ClampToEdgeWrapping,
                THREE.ClampToEdgeWrapping,
                THREE.LinearFilter,
                THREE.LinearFilter,
                THREE.RGBAFormat,
                THREE.UnsignedByteType,
                16
              );
              texture.needsUpdate = true;

              const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
                alphaTest: 0.5,
              });
              return material;
            })();
            const mesh = new THREE.Mesh(geometry, material);

            const headerMesh = (() => {
              const geometry = new THREE.PlaneBufferGeometry(KEYBOARD_HEADER_WORLD_WIDTH, KEYBOARD_HEADER_WORLD_HEIGHT);
              const material = (() => {
                const texture = new THREE.Texture(
                  dotImg,
                  THREE.UVMapping,
                  THREE.ClampToEdgeWrapping,
                  THREE.ClampToEdgeWrapping,
                  THREE.LinearFilter,
                  THREE.LinearFilter,
                  THREE.RGBAFormat,
                  THREE.UnsignedByteType,
                  16
                );
                texture.needsUpdate = true;

                const material = new THREE.MeshBasicMaterial({
                  map: texture,
                  side: THREE.DoubleSide,
                  transparent: true,
                  alphaTest: 0.5,
                });
                return material;
              })();

              const mesh = new THREE.Mesh(geometry, material);
              mesh.position.y = (KEYBOARD_WORLD_HEIGHT / 2) + (KEYBOARD_HEADER_WORLD_HEIGHT / 2);
              return mesh;
            })();
            mesh.add(headerMesh);
            mesh.headerMesh = headerMesh;

            const shadowMesh = (() => {
              const geometry = new THREE.BoxBufferGeometry(KEYBOARD_WORLD_WIDTH, KEYBOARD_WORLD_HEIGHT, 0.01);
              const material = transparentMaterial;
              const mesh = new THREE.Mesh(geometry, material);
              mesh.castShadow = true;
              return mesh;
            })();
            mesh.add(shadowMesh);

            return mesh;
          })();
          object.add(planeMesh);
          object.planeMesh = planeMesh;

          const keySpecs = (() => {
            class KeySpec {
              constructor(key, rect, imageData, width, height, worldWidth, worldHeight, highlightOffset, highlightScale, onmouseover, onmouseout) {
                this.key = key;
                this.rect = rect;
                this.imageData = imageData;
                this.width = width;
                this.height = height;
                this.worldWidth = worldWidth;
                this.worldHeight = worldHeight;
                this.highlightOffset = highlightOffset;
                this.highlightScale = highlightScale;
                this.onmouseover = onmouseover;
                this.onmouseout = onmouseout;
              }
            }

            const div = document.createElement('div');
            div.style.cssText = 'position: absolute; top: 0; left: 0; width: ' + KEYBOARD_WIDTH + 'px; height: ' + KEYBOARD_HEIGHT + 'px;';
            div.innerHTML = keyboardImgString;

            document.body.appendChild(div);

            const keyEls = div.querySelectorAll(':scope > svg > g[key]');
            const result = Array(keyEls.length + 1);
            for (let i = 0; i < keyEls.length; i++) {
              const keyEl = keyEls[i];
              const key = keyEl.getAttribute('key');
              const rect = keyEl.getBoundingClientRect();
              const imageData = (() => {
                const {top, bottom, left, right} = rect;
                const width = right - left;
                const height = bottom - top;
                let imageData = keyboardHighlightCanvas.ctx.getImageData(left, top, width, height);
                if (key === 'enter') { // special case the enter key; it has a non-rectangular shape
                  const canvas = document.createElement('canvas');
                  canvas.width = imageData.width;
                  canvas.height = imageData.height;

                  const ctx = canvas.getContext('2d');
                  ctx.putImageData(imageData, 0, 0);
                  ctx.clearRect(0, 0, 80, 140);

                  imageData = ctx.getImageData(0, 0, imageData.width, imageData.height);
                }
                return imageData;
              })();

              const keySpec = new KeySpec(
                key,
                rect,
                imageData,
                KEYBOARD_WIDTH,
                KEYBOARD_HEIGHT,
                KEYBOARD_WORLD_WIDTH,
                KEYBOARD_WORLD_HEIGHT,
                0.01,
                1.5,
                nop,
                nop
              );
              result[i] = keySpec;
            }
            document.body.removeChild(div);

            let numHeaderHovers = 0;
            result[keyEls.length] = new KeySpec(
              'header',
              {
                top: -KEYBOARD_HEADER_HEIGHT,
                bottom: 0,
                left: 0,
                right: KEYBOARD_HEADER_WIDTH,
                width: KEYBOARD_HEADER_WIDTH,
                height: KEYBOARD_HEADER_HEIGHT,
              },
              dotHighlightImg,
              KEYBOARD_HEADER_WIDTH,
              KEYBOARD_HEADER_HEIGHT,
              KEYBOARD_HEADER_WORLD_WIDTH,
              KEYBOARD_HEADER_WORLD_HEIGHT,
              0,
              1,
              () => { // mouseover
                numHeaderHovers++;

                if (numHeaderHovers === 1) {
                  const {headerMesh} = planeMesh;
                  headerMesh.visible = false;
                }
              },
              () => { // mouseout
                numHeaderHovers--;

                if (numHeaderHovers === 0) {
                  const {headerMesh} = planeMesh;
                  headerMesh.visible = true;
                }
              }
            );

            return result;
          })();
          object.keySpecs = keySpecs;

          const _makeKeyMesh = () => {
            const object = new THREE.Object3D();

            const subMesh = (() => {
              const geometry = new THREE.PlaneBufferGeometry(1, 1);
              const material = (() => {
                const texture = new THREE.Texture(
                  transparentImg,
                  THREE.UVMapping,
                  THREE.ClampToEdgeWrapping,
                  THREE.ClampToEdgeWrapping,
                  THREE.LinearFilter,
                  THREE.LinearFilter,
                  THREE.RGBAFormat,
                  THREE.UnsignedByteType,
                  16
                );
                texture.needsUpdate = true;

                const material = new THREE.MeshBasicMaterial({
                  map: texture,
                  side: THREE.DoubleSide,
                  transparent: true,
                  alphaTest: 0.5,
                });
                return material;
              })();

              const mesh = new THREE.Mesh(geometry, material);
              return mesh;
            })();
            object.add(subMesh);
            object.subMesh = subMesh;

            object.visible = false;
            object.key = null;
            object.keydown = null;

            return object;
          };
          const keyMeshes = {
            left: _makeKeyMesh(),
            right: _makeKeyMesh(),
          };
          object.add(keyMeshes.left);
          object.add(keyMeshes.right);
          object.keyMeshes = keyMeshes;

          return object;
        })();
        scene.add(keyboardMesh);

        const dotMeshes = {
          left: biolumi.makeMenuDotMesh(),
          right: biolumi.makeMenuDotMesh(),
        };
        scene.add(dotMeshes.left);
        scene.add(dotMeshes.right);

        const _makeKeyboardHoverState = () => ({
          key: null,
        });
        const keyboardHoverStates = {
          left: _makeKeyboardHoverState(),
          right: _makeKeyboardHoverState(),
        };

        const _triggerdown = e => {
          const {side} = e;
          const {keyMeshes} = keyboardMesh;
          const keyMesh = keyMeshes[side];
          const {key} = keyMesh;

          if (key) {
            if (key !== 'header') {
              const keyCode = biolumi.getKeyCode(key);

              const {subMesh} = keyMesh;
              subMesh.position.z = -0.01 / 2;

              input.triggerEvent('keyboarddown', {
                key,
                keyCode,
                side,
              });
              input.triggerEvent('keyboardpress', {
                key,
                keyCode,
                side,
              });
            }

            keyMesh.keydown = key;

            e.stopImmediatePropagation();
          }
        };
        input.on('triggerdown', _triggerdown);
        const _triggerup = e => {
          const {side} = e;
          const {keyMeshes} = keyboardMesh;
          const keyMesh = keyMeshes[side];
          const {keydown} = keyMesh;

          if (keydown) {
            if (keydown !== 'header') {
              const key = keydown;
              const keyCode = biolumi.getKeyCode(key);

              const {subMesh} = keyMesh;
              subMesh.position.z = 0;

              input.triggerEvent('keyboardup', {
                key,
                keyCode,
                side,
              });
            }

            keyMesh.keydown = null;

            e.stopImmediatePropagation();
          }
        };
        input.on('triggerup', _triggerup);

        const _keydown = e => {
          const {focusState} = keyboardState;

          if (focusState) {
            focusState.handleEvent(e);
          }
        };
        input.on('keydown', _keydown, {
          priority: 1,
        });
        const _keyboarddown = _keydown;
        input.on('keyboarddown', _keyboarddown, {
          priority: 1,
        });

        const _update = () => {
          const {focusState} = keyboardState;

          if (focusState) {
            const _updateDrag = () => {
              const {gamepads} = webvr.getStatus();

              SIDES.forEach(side => {
                const {keyMeshes} = keyboardMesh;
                const keyMesh = keyMeshes[side];
                const {keydown} = keyMesh;

                if (keydown === 'header') {
                  const gamepad = gamepads[side];
                  const {position: controllerPosition, rotation: controllerRotation} = gamepad;
                  const controllerEnd = controllerPosition.clone()
                    .add(
                      new THREE.Vector3(0, -(KEYBOARD_WORLD_HEIGHT + KEYBOARD_HEADER_WORLD_HEIGHT) / 2, -1).applyQuaternion(controllerRotation)
                    );
                  keyboardMesh.position.copy(controllerEnd);
                  keyboardMesh.quaternion.copy(controllerRotation);
                }
              });
            };
            const _updateHover = () => {
              const {gamepads} = webvr.getStatus();

              SIDES.forEach(side => {
                const gamepad = gamepads[side];

                if (gamepad) {
                  const {position: controllerPosition, rotation: controllerRotation, scale: controllerScale} = gamepad;

                  const controllerLine = geometryUtils.makeControllerLine(controllerPosition, controllerRotation, controllerScale);
                  const {planeMesh} = keyboardMesh;
                  const {position: keyboardPosition, rotation: keyboardRotation} = _decomposeObjectMatrixWorld(planeMesh);
                  const xAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(keyboardRotation);
                  const negativeYAxis = new THREE.Vector3(0, -1, 0).applyQuaternion(keyboardRotation);
                  const keyboardTopLeftPoint = keyboardPosition.clone()
                    .add(xAxis.clone().multiplyScalar(-KEYBOARD_WORLD_WIDTH / 2))
                    .add(negativeYAxis.clone().multiplyScalar(-KEYBOARD_WORLD_HEIGHT / 2));
                  const keyboardPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                    new THREE.Vector3(0, 0, -1).applyQuaternion(keyboardRotation),
                    keyboardTopLeftPoint
                  );
                  const intersectionPoint = keyboardPlane.intersectLine(controllerLine);

                  if (intersectionPoint) {
                    const matchingKeySpec = (() => {
                      const intersectionRay = intersectionPoint.clone().sub(keyboardTopLeftPoint);
                      const ax = intersectionRay.clone().projectOnVector(xAxis).dot(xAxis);
                      const ay = intersectionRay.clone().projectOnVector(negativeYAxis).dot(negativeYAxis);
                      const {keySpecs} = keyboardMesh;
                      const matchingKeySpecs = keySpecs.filter(keySpec => {
                        const {rect: {top, bottom, left, right}, width, height, worldWidth, worldHeight} = keySpec;
                        const x = ax / worldWidth * width;
                        const y = ay / worldHeight * height;
                        return x >= left && x < right && y >= top && y < bottom;
                      });

                      if (matchingKeySpecs.length > 0) {
                        return matchingKeySpecs[0];
                      } else {
                        const x = ax / KEYBOARD_WORLD_WIDTH * KEYBOARD_WIDTH;
                        const y = ay / KEYBOARD_WORLD_HEIGHT * KEYBOARD_HEIGHT;
                        if (x >= 0 && x < KEYBOARD_WIDTH && y >= 0 && y < KEYBOARD_HEIGHT) {
                          const intersectionPointVector = new THREE.Vector2(x, y);
                          const keySpecDistanceSpecs = keySpecs.map(keySpec => {
                            const {rect: {top, bottom, left, right, width, height}} = keySpec;
                            const center = new THREE.Vector2(left + (width / 2), top + (height / 2));
                            const distance = center.distanceTo(intersectionPointVector);

                            return {
                              keySpec,
                              distance,
                            };
                          });
                          return keySpecDistanceSpecs.sort((a, b) => a.distance - b.distance)[0].keySpec;
                        } else {
                          return null;
                        }
                      }
                    })();

                    const dotMesh = dotMeshes[side];
                    const {keyMeshes} = keyboardMesh;
                    const keyMesh = keyMeshes[side];
                    if (matchingKeySpec) {
                      dotMesh.position.copy(intersectionPoint);

                      const {key} = matchingKeySpec;
                      if (key !== keyMesh.key) {
                        const {
                          rect: {
                            top,
                            bottom,
                            left,
                            right,
                            width,
                            height,
                          },
                          imageData,
                          width: fullWidth,
                          height: fullHeight,
                          worldWidth,
                          worldHeight,
                          highlightOffset,
                          highlightScale,
                          onmouseover,
                          onmouseout,
                        } = matchingKeySpec;
                        const {subMesh: {material: {map: texture}}} = keyMesh;
                        texture.image = imageData;
                        texture.needsUpdate = true;

                        keyMesh.position.copy(
                          // keyboardTopLeftPoint.clone()
                          new THREE.Vector3(-KEYBOARD_WORLD_WIDTH / 2, KEYBOARD_WORLD_HEIGHT / 2, 0)
                            .add(new THREE.Vector3(1, 0, 0).multiplyScalar((left + (width / 2)) / fullWidth * worldWidth))
                            .add(new THREE.Vector3(0, -1, 0).multiplyScalar((top + (height / 2)) / fullHeight * worldHeight))
                            .add(new THREE.Vector3(0, 0, highlightOffset)/*.applyQuaternion(keyboardRotation)*/)
                        );
                        // keyMesh.quaternion.copy(keyboardRotation);
                        keyMesh.scale.set(
                          width / fullWidth * worldWidth * highlightScale,
                          height / fullHeight * worldHeight * highlightScale,
                          1
                        );

                        const {key: oldKey} = keyMesh;
                        if (oldKey) {
                          const {keySpecs} = keyboardMesh;
                          const oldKeySpec = keySpecs.find(keySpec => keySpec.key === oldKey);
                          const {onmouseout} = oldKeySpec;
                          onmouseout();
                        }

                        keyMesh.key = key;

                        onmouseover();
                      }

                      if (!dotMesh.visible) {
                        dotMesh.visible = true;
                      }
                      if (!keyMesh.visible) {
                        keyMesh.visible = true;
                      }
                    } else {
                      const {key: oldKey} = keyMesh;
                      if (oldKey) {
                        const {keySpecs} = keyboardMesh;
                        const oldKeySpec = keySpecs.find(keySpec => keySpec.key === oldKey);
                        const {onmouseout} = oldKeySpec;
                        onmouseout();
                      }

                      keyMesh.key = null;

                      if (dotMesh.visible) {
                        dotMesh.visible = false;
                      }
                      if (keyMesh.visible) {
                        keyMesh.visible = false;
                      }
                    }
                  }
                }
              });
            };

            _updateDrag();
            _updateHover();
          }
        };
        rend.on('update', _update);

        this._cleanup = () => {
          scene.remove(keyboardMesh);

          SIDES.forEach(side => {
            scene.remove(dotMeshes[side]);
          });

          SIDES.forEach(side => {
            scene.remove(keyboardBoxMeshes[side]);
          });

          rend.removeListener('update', _update);
        };

        class KeyboardFocusState extends EventEmitter {
          constructor({type, inputText, inputIndex, inputValue, fontSpec}) {
            super();

            this.type = type;
            this.inputText = inputText;
            this.inputIndex = inputIndex;
            this.inputValue = inputValue;
            this.fontSpec = fontSpec;
          }

          handleEvent(e) {
            const applySpec = biolumi.applyStateKeyEvent(this, e);

            if (applySpec) {
              const {commit} = applySpec;
              if (commit) {
                this.blur();
              }

              this.update();

              e.stopImmediatePropagation();
            }
          }

          update() {
            this.emit('update');
          }

          blur() {
            this.emit('blur');
          }
        }

        class KeyboardApi {
          getFocusState() {
            return keyboardState.focusState;
          }

          tryFocus({type, position, rotation, inputText, inputIndex, inputValue, fontSpec}) {
            const {focusState: oldFocusState} = keyboardState;

            if (!oldFocusState) {
              const newFocusState = new KeyboardFocusState({type, inputText, inputIndex, inputValue, fontSpec});

              keyboardState.focusState = newFocusState;

              keyboardMesh.position.copy(
                position.clone().add(new THREE.Vector3(0, -0.6, -0.4).applyQuaternion(rotation)),
              );
              keyboardMesh.rotation.x = rotation.clone().premultiply(new THREE.Quaternion().setFromEuler(-Math.PI * (3 / 8), 0, 0, camera.rotation.order));
              keyboardMesh.visible = true;

              newFocusState.once('blur', () => {
                keyboardState.focusState = null;

                keyboardMesh.visible = false;
              });

              return newFocusState;
            } else {
              return null;
            }
          }

          tryBlur() {
            const {focusState} = keyboardState;

            if (focusState) {
              focusState.blur();
            }
          }
        }
        const keyboardApi = new KeyboardApi();
        return keyboardApi;
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Keyboard;
