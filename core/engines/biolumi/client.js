import keycode from 'keycode';

import menuShader from './lib/shaders/menu';
import transparentShader from './lib/shaders/transparent';

const DEFAULT_FRAME_TIME = 1000 / (60 * 2)

const SIDES = ['left', 'right'];

class Biolumi {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    const cleanups = [];
    this._cleanup = () => {
      live = false;

      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    const _requestImage = src => new Promise((accept, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
    });
    const _requestImageBitmap = src => _requestImage(src)
      .then(img => createImageBitmap(img, 0, 0, img.width, img.height));
    const _requestTransparentImg = () => _requestImageBitmap(transparentImgUrl);
    const _requestUiWorker = () => {
      class UiWorker {
        constructor({frameTime = DEFAULT_FRAME_TIME} = {}) {
          this.frameTime = frameTime;

          this.threads = [];
          this.workTime = 0;
          this.clearingWorkTime = false;

          this.work = _debounce(this.work.bind(this));
        }

        add(thread) {
          const {threads} = this;
          threads.push(thread);

          this.work();

          /* return () => {
            const index = threads.indexOf(thread);
            if (index !== -1) {
              threads.splice(index, 1);
            }
          }; */
        }

        work(next) {
          const {frameTime, threads} = this;

          const _recurseFrame = () => {
            const _recurseThread = () => {
              if (threads.length > 0) {
                const {workTime} = this;

                if (workTime < frameTime) {
                  const workStartTime = Date.now();

                  const _updateWorkTime = () => {
                    this.workTime += Date.now() - workStartTime;

                    if (!this.clearingWorkTime) {
                      this.clearingWorkTime = true;

                      requestAnimationFrame(() => {
                        this.workTime = 0;
                        this.clearingWorkTime = false;
                      });
                    }
                  };

                  const thread = threads.shift();
                  thread()
                    .then(() => {
                      _updateWorkTime();

                      _recurseThread();
                    })
                    .catch(err => {
                      console.warn(err);

                      _updateWorkTime();

                      _recurseThread();
                    });
                } else {
                  requestAnimationFrame(_recurseFrame);
                }
              } else {
                next();
              }
            };
            _recurseThread();
          };
          _recurseFrame();
        }
      }

      return Promise.resolve(new UiWorker());
    };

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/three',
        '/core/utils/geometry-utils',
      ]),
      _requestTransparentImg(),
      _requestUiWorker(),
    ])
      .then(([
        [
          three,
          geometryUtils,
        ],
        transparentImg,
        uiWorker,
      ]) => {
        if (live) {
          const {THREE, renderer} = three;

          const zeroQuaternion = new THREE.Quaternion();
          const defaultRayMeshScale = new THREE.Vector3(1, 1, 15);

          const forwardVector = new THREE.Vector3(0, 0, -1);
          const backwardVector = new THREE.Vector3(0, 0, 1);
          const rightVector = new THREE.Vector3(1, 0, 0);
          const downVector = new THREE.Vector3(0, -1, 0);

          const RAY_COLOR = 0x44c2ff;
          const RAY_HIGHLIGHT_COLOR = new THREE.Color(RAY_COLOR).multiplyScalar(0.5).getHex();

          const dotMeshMaterial = new THREE.MeshBasicMaterial({
            color: RAY_COLOR,
          });
          const boxMeshMaterial = new THREE.MeshBasicMaterial({
            color: RAY_COLOR,
            transparent: true,
            opacity: 0.5,
            // depthTest: false,
            depthWrite: false,
            // alphaTest: 0.1,
            // renderOrder: 1,
          });

          const _isWorldVisible = mesh => {
            for (; mesh; mesh = mesh.parent) {
              if (!mesh.visible) {
                return false;
              }
            }
            return true;
          };
          const _makeMenuShaderUniforms = () => {
            const uniforms = THREE.UniformsUtils.clone(menuShader.uniforms);
            const texture = new THREE.Texture(
              transparentImg,
              THREE.UVMapping,
              THREE.ClampToEdgeWrapping,
              THREE.ClampToEdgeWrapping,
              THREE.NearestFilter,
              THREE.NearestFilter,
              THREE.RGBAFormat,
              THREE.UnsignedByteType,
              1
            );
            texture.onUpload = () => {
              texture.image = null;
            };
            uniforms.texture.value = texture;
            return uniforms;
          };

          class Page {
            constructor(spec, type, state, color, width, height, worldWidth, worldHeight, layer) {
              this.spec = spec;
              this.type = type;
              this.state = state;
              this.color = color;
              this.width = width;
              this.height = height;
              this.worldWidth = worldWidth;
              this.worldHeight = worldHeight;
              this.layer = layer;

              const mesh = (() => {
                const geometry = geometryUtils.unindexBufferGeometry(new THREE.PlaneBufferGeometry(worldWidth, worldHeight));
                const material = (() => {
                  const shaderUniforms = _makeMenuShaderUniforms();
                  shaderUniforms.backgroundColor.value = Float32Array.from(color);
                  const shaderMaterial = new THREE.ShaderMaterial({
                    uniforms: shaderUniforms,
                    vertexShader: menuShader.vertexShader,
                    fragmentShader: menuShader.fragmentShader,
                    side: THREE.DoubleSide,
                    transparent: color[3] === 0,
                    // depthWrite: false,
                  });
                  // shaderMaterial.polygonOffset = true;
                  // shaderMaterial.polygonOffsetFactor = 1;
                  return shaderMaterial;
                })();

                const mesh = new THREE.Mesh(geometry, material);
                mesh.page = this;
                mesh.destroy = () => {
                  geometry.dispose();

                  material.uniforms.texture.value.dispose();
                  material.dispose();
                };

                return mesh;
              })();
              this.mesh = mesh;
              this.rendered = false;
              this.boxTarget = null;
            }

            update() {
              const cache = {
                layerSpec: null,
                img: null,
                anchors: null,
                measures: null,
              };

              const _requestLayerSpec = () => {
                const {spec, state} = this;
                cache.layerSpec = typeof spec === 'function' ? spec(state) : spec;
                return Promise.resolve();
              };
              const _requestImage = () => new Promise((accept, reject) => {
                const {layerSpec} = cache;
                const {type = 'html'} = layerSpec;

                if (type === 'html') {
                  const {width, height} = this;
                  const {src, w = width, h = height} = layerSpec;
                  rasterizer.rasterize(src, w, h)
                    .then(({imageBitmap, anchors, measures}) => {
                      cache.img = imageBitmap;
                      cache.anchors = anchors;
                      cache.measures = measures;

                      accept();
                    })
                    .catch(err => {
                      console.warn('biolumi image load error', {src}, err);

                      accept();
                    });
                } else if (type === 'image') {
                  const {img} = layerSpec;

                  cache.img = img;

                  accept();
                } else {
                  accept();
                }
              });
              const _requestTexture = () => {
                const {layerSpec, img} = cache;
                // const {pixelated = false} = layerSpec;

                const {mesh: {material: {uniforms: {texture: {value: texture}}}}} = this;
                texture.image = img;
                /* if (!pixelated) {
                  texture.minFilter = THREE.LinearFilter;
                  texture.magFilter = THREE.LinearFilter;
                  texture.anisotropy = 16;
                } else { */
                  texture.minFilter = THREE.NearestFilter;
                  texture.magFilter = THREE.NearestFilter;
                  texture.anisotropy = 1;
                // }
                texture.needsUpdate = true;

                // This forces THREE.js to submit the texture to the GPU
                // This is a relatively slow operation
                renderer.setTexture2D(texture, 0);

                return Promise.resolve();
              };
              const _requestLayer = () => {
                const {layerSpec} = cache;
                const {type = 'html'} = layerSpec;

                if (type === 'html') {
                  const {width, height} = this;
                  const {w = width, h = height} = layerSpec;
                  const {anchors, measures} = cache;

                  const layer = new Layer(w, h, anchors, measures);

                  this.layer = layer;
                } else if (type === 'image') {
                  const {width, height} = this;
                  const {x = 0, y = 0, w = width, h = height} = layerSpec;

                  const layer = new Layer(w, h);

                  this.layer = layer;
                } else {
                  console.warn('illegal layer spec type:' + JSON.stringify(type));

                  this.layer = null;
                }

                return Promise.resolve();
              };
              const _requestCallback = () => {
                accept();

                return Promise.resolve();
              };
              /* const cancels = [
                _requestLayerSpec,
                _requestImage,
                _requestTexture,
                _requestLayer,
                _requestCallback,
              ].map(work => uiWorker.add(work)); */
              uiWorker.add(_requestLayerSpec);
              uiWorker.add(_requestImage);
              uiWorker.add(_requestTexture);
              uiWorker.add(_requestLayer);
              uiWorker.add(_requestCallback);

              let accept = null;
              let reject = null;
              const result = new Promise((a, r) => {
                accept = a;
                reject = r;
              });
              /* result.cancel = () => { // return a cancel function
                for (let i = 0; i < cancels.length; i++) {
                  const cancel = cancels[i];
                  cancel();
                }
              }; */
              return result;
            }

            initialUpdate() {
              if (!this.rendered) {
                this.rendered = true;

                return this.update();
              } else {
                return nop;
              }
            }
          }

          class Layer {
            constructor(width, height, anchors = [], measures = {}) {
              this.width = width;
              this.height = height;
              this.anchors = anchors;
              this.measures = measures;
            }
          }

          class Ui {
            constructor(width, height, color) {
              this.width = width;
              this.height = height;
              this.color = color;

              this.page = null;
            }

            makePage(spec, {type = null, state = null, worldWidth, worldHeight, layer = null} = {}) {
              const {page} = this;

              if (!page) {
                const {width, height, color} = this;
                const page = new Page(spec, type, state, color, width, height, worldWidth, worldHeight, layer);
                this.page = page;

                return page.mesh;
              } else {
                return null;
              }
            }
          }

          const localVector = new THREE.Vector3();
          const localVector2 = new THREE.Vector3();
          const localVector3 = new THREE.Vector3();
          const localVector4 = new THREE.Vector3();
          const localVector5 = new THREE.Vector3();
          const localVector6 = new THREE.Vector3();
          const localVector7 = new THREE.Vector3();
          const localCoord = new THREE.Vector2();
          const localCoord2 = new THREE.Vector2();
          const localQuaternion = new THREE.Quaternion();
          const localPlane = new THREE.Plane();
          const localPlane2 = new THREE.Plane();
          const localPlane3 = new THREE.Plane();
          const localLine = new THREE.Line3();

          class UiTracker {
            constructor() {
              this.planes = [];

              const _makeHoverState = () => ({
                intersectionPoint: null,
                x: 0,
                y: 0,
                target: null,
                anchor: null,
                value: 0,
                crossValue: 0,
              });
              this.hoverStates = {
                left: _makeHoverState(),
                right: _makeHoverState(),
              };

              this.dotMeshes = {
                left: _makeDotMesh(),
                right: _makeDotMesh(),
              };
              this.boxMeshes = {
                left: _makeBoxMesh(),
                right: _makeBoxMesh(),
              };
            }

            addPlane(plane) {
              this.planes.push(plane);
            }

            removePlane(plane) {
              this.planes.splice(this.planes.indexOf(plane), 1);
            }

            getHoverState(side) {
              return this.hoverStates[side];
            }

            update({pose, sides, controllerMeshes}) {
              const _hideSide = side => {
                const {hoverStates, dotMeshes, boxMeshes} = this;

                const hoverState = hoverStates[side];
                const dotMesh = dotMeshes[side];
                const boxMesh = boxMeshes[side];
                const controllerMesh = controllerMeshes[side];
                const {rayMesh} = controllerMesh;

                hoverState.intersectionPoint = null;
                hoverState.target = null;
                hoverState.anchor = null;
                hoverState.value = 0;
                hoverState.crossValue = 0;

                if (dotMesh.visible) {
                  dotMesh.visible = false;
                }
                if (boxMesh.visible) {
                  boxMesh.visible = false;
                }
                if (!open || !sides.includes(side)) {
                  if (rayMesh.visible) {
                    rayMesh.visible = false;
                  }
                } else {
                  if (!rayMesh.scale.equals(defaultRayMeshScale)) {
                    rayMesh.scale.copy(defaultRayMeshScale);
                    rayMesh.updateMatrixWorld();
                  }

                  if (!rayMesh.visible) {
                    rayMesh.visible = true;
                  }
                }
              };

              const {planes} = this;
              const open = planes.some(plane => plane.open);
              if (open) {
                const {gamepads} = pose;
                const {hoverStates, dotMeshes, boxMeshes} = this;

                for (let s = 0; s < SIDES.length; s++) {
                  const side = SIDES[s];
                  const gamepad = gamepads[side];
                  const dotMesh = dotMeshes[side];
                  const boxMesh = boxMeshes[side];
                  const hoverState = hoverStates[side];
                  const controllerMesh = controllerMeshes[side];
                  const {rayMesh} = controllerMesh;

                  if (sides.includes(side)) {
                    const controllerLine = localLine.set(
                      gamepad.worldPosition,
                      localVector.copy(gamepad.worldPosition)
                        .add(
                          localVector2.copy(forwardVector)
                            .applyQuaternion(gamepad.worldRotation)
                            .multiplyScalar(3)
                        )
                    );

                    let found = false;
                    let minDistance = Infinity;
                    for (let i = 0; i < planes.length; i++) {
                      const plane = planes[i];

                      if (plane.open) {
                        const normal = localVector2.copy(backwardVector)
                          .applyQuaternion(localQuaternion.setFromRotationMatrix(plane.matrixWorld));
                        const uiPlane = localPlane.setFromNormalAndCoplanarPoint(
                          normal,
                          localVector3.setFromMatrixPosition(plane.matrixWorld)
                        );
                        const intersectionPoint = uiPlane.intersectLine(controllerLine, localVector3);

                        if (intersectionPoint) {
                          const distance = intersectionPoint.distanceTo(localLine.start);

                          if (distance < minDistance) {
                            hoverState.intersectionPoint = intersectionPoint;

                            const {width, height, worldWidth, worldHeight} = plane;
                            const worldPosition = localVector4.setFromMatrixPosition(plane.matrixWorld);
                            const worldRotation = localQuaternion.setFromRotationMatrix(plane.matrixWorld);

                            hoverState.target = plane;

                            const yAxis = localPlane2.setFromNormalAndCoplanarPoint(
                              localVector5.copy(rightVector)
                                .applyQuaternion(worldRotation),
                              localVector6.copy(worldPosition)
                                .sub(localVector7.set(worldWidth / 2, 0, 0).applyQuaternion(worldRotation))
                            );
                            const x = yAxis.distanceToPoint(intersectionPoint) / worldWidth * width;
                            const xAxis = localPlane3.setFromNormalAndCoplanarPoint(
                              localVector5.copy(downVector)
                                .applyQuaternion(worldRotation),
                              localVector6.copy(worldPosition)
                                .add(localVector7.set(0, worldHeight / 2, 0).applyQuaternion(worldRotation))
                            );
                            const y = xAxis.distanceToPoint(intersectionPoint) / worldHeight * height;

                            hoverState.x = x;
                            hoverState.y = y;

                            if (x >= 0 && x < width && y > 0 && y <= height) {
                              let anchor = null;
                              const {anchors} = plane;
                              for (let i = 0; i < anchors.length; i++) {
                                const a = anchors[i];
                                if (x >= a.left && x <= a.right && y >= a.top && y <= a.bottom) {
                                  anchor = a;
                                  break;
                                }
                              }

                              if (anchor) {
                                hoverState.anchor = anchor;
                                hoverState.value = (x - anchor.left) / (anchor.right - anchor.left);
                                hoverState.crossValue = (y - anchor.top) / (anchor.bottom - anchor.top);

                                const anchorMidpoint = localCoord.set(
                                  ((anchor.left + anchor.right) / 2) / width * worldWidth,
                                  ((anchor.top + anchor.bottom) / 2) / height * worldHeight
                                );
                                const anchorSize = localCoord2.set(
                                  (anchor.right - anchor.left) / width * worldWidth,
                                  (anchor.bottom - anchor.top) / height * worldHeight
                                );
                                boxMesh.position.copy(worldPosition)
                                  .add(
                                    localVector7.set((-worldWidth / 2) + anchorMidpoint.x, (worldHeight / 2) - anchorMidpoint.y, 0)
                                      .applyQuaternion(worldRotation)
                                  );
                                boxMesh.quaternion.copy(worldRotation);
                                boxMesh.scale.set(anchorSize.x, anchorSize.y, 0.01);
                                boxMesh.updateMatrixWorld();

                                if (!boxMesh.visible) {
                                  boxMesh.visible = true;
                                }
                              } else {
                                hoverState.anchor = null;
                                hoverState.value = 0;
                                hoverState.crossValue = 0;

                                if (boxMesh.visible) {
                                  boxMesh.visible = false;
                                }
                              }

                              dotMesh.position.copy(intersectionPoint);
                              dotMesh.quaternion.setFromUnitVectors(
                                forwardVector,
                                normal
                              );
                              dotMesh.updateMatrixWorld();
                              if (!gamepad.buttons.trigger.pressed && dotMesh.material.color.getHex() !== RAY_COLOR) {
                                dotMesh.material.color.setHex(RAY_COLOR);
                              } else if (gamepad.buttons.trigger.pressed && dotMesh.material.color.getHex() !== RAY_HIGHLIGHT_COLOR) {
                                dotMesh.material.color.setHex(RAY_HIGHLIGHT_COLOR);
                              }
                              dotMesh.visible = true;

                              rayMesh.scale.z = Math.max(distance, 0.001);
                              rayMesh.updateMatrixWorld();
                              rayMesh.visible = true;

                              found = true;
                              minDistance = distance;
                            }
                          }
                        }
                      }
                    }

                    if (!found) {
                      hoverState.target = null;
                      hoverState.anchor = null;
                      hoverState.value = 0;
                      hoverState.crossValue = 0;

                      _hideSide(side);
                    }
                  } else {
                    _hideSide(side);
                  }
                }
              } else {
                for (let s = 0; s < SIDES.length; s++) {
                  const side = SIDES[s];
                  _hideSide(side);
                }
              }
            }
          }

          const _makeUi = ({width, height, color = [1, 1, 1, 1]}) => new Ui(width, height, color);
          const _makePage = (spec, {type = null, state = null, color = [1, 1, 1, 1], width, height, worldWidth, worldHeight, layer = null}) =>
            new Page(spec, type, state, color, width, height, worldWidth, worldHeight, layer);

          const _getFonts = () => fonts;
          const _getMonospaceFonts = () => monospaceFonts;
          const _getFontWeight = () => fontWeight;
          const _getFontStyle = () => fontStyle;
          const _getTransparentImg = () => transparentImg;

          const transparentMaterial = new THREE.ShaderMaterial({
            vertexShader: transparentShader.vertexShader,
            fragmentShader: transparentShader.fragmentShader,
            transparent: true,
            depthWrite: false,
          });
          const _getTransparentMaterial = () => transparentMaterial;

          const _getTextPropertiesFromCoord = (width, inputText, coordPx) => {
            const index = Math.min(Math.floor(coordPx / width), inputText.length);
            const px = index * width;
            return {index, px};
          };

          const _getKeyCode = s => keycode(s);
          const _getKeyEventCharacter = e => {
            let s = keycode(e.keyCode);
            if (s === 'space') {
              s = ' ';
            }
            if (e.shiftKey) {
              s = s.toUpperCase();
            }
            return s;
          };
          const _isPrintableKeycode = keyCode =>
            (keyCode > 47 && keyCode < 58) || // number keys
            (keyCode == 32) || // spacebar & return key(s) (if you want to allow carriage returns)
            (keyCode > 64 && keyCode < 91) || // letter keys
            (keyCode > 95 && keyCode < 112) || // numpad keys
            (keyCode > 185 && keyCode < 193) || // ;=,-./` (in order)
            (keyCode > 218 && keyCode < 223); // [\]' (in order)\
          const _applyStateKeyEvent = (state, e) => {
            const {inputText, inputIndex, width} = state;

            let change = false;
            let commit = false;

            if (_isPrintableKeycode(e.event.keyCode)) {
              // if (!(e.event.ctrlKey && e.event.keyCode === 86)) { // ctrl-v
                state.inputText = inputText.slice(0, inputIndex) + _getKeyEventCharacter(e.event) + inputText.slice(inputIndex);
                state.inputIndex++;
                state.inputValue = width * state.inputIndex;

                change = true;
              // }
            } else if (e.event.keyCode === 13) { // enter
              commit = true;
            } else if (e.event.keyCode === 8) { // backspace
              if (inputIndex > 0) {
                state.inputText = inputText.slice(0, inputIndex - 1) + inputText.slice(inputIndex);
                state.inputIndex--;
                state.inputValue = width * state.inputIndex;

                change = true;
              }
            } else if (e.event.keyCode === 37) { // left
              state.inputIndex = Math.max(state.inputIndex - 1, 0);
              state.inputValue = width * state.inputIndex;

              change = true;
            } else if (e.event.keyCode === 39) { // right
              state.inputIndex = Math.min(state.inputIndex + 1, inputText.length);
              state.inputValue = width * state.inputIndex;

              change = true;
            } else if (e.event.keyCode === 38) { // up
              state.inputIndex = 0;
              state.inputValue = width * state.inputIndex;

              change = true;
            } else if (e.event.keyCode === 40) { // down
              state.inputIndex = inputText.length;
              state.inputValue = width * state.inputIndex;

              change = true;
            }

            if (change || commit) {
              return {
                change,
                commit,
              };
            } else {
              return null;
            }
          };

          const _makeMeshPointGetter = ({position, rotation, scale, width, height, worldWidth, worldHeight}) => (x, y, z) => position.clone()
            .add(
              new THREE.Vector3(
                -worldWidth / 2,
                worldHeight / 2,
                0
              )
              .add(
                new THREE.Vector3(
                  (x / width) * worldWidth,
                  (-y / height) * worldHeight,
                  z
                )
              )
              .multiply(scale)
              .applyQuaternion(rotation)
            );

          const _makeUiTracker = () => new UiTracker();

          const _makeDotMesh = () => {
            const geometry = new THREE.CylinderBufferGeometry(0.01, 0.01, 0.001, 32)
              .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
            const material = dotMeshMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            mesh.visible = false;
            return mesh;
          };
          const _makeBoxMesh = () => {
            const geometry = new THREE.BoxBufferGeometry(1, 1, 1);

            const mesh = new THREE.Mesh(geometry, boxMeshMaterial);
            mesh.visible = false;
            return mesh;
          };

          return {
            makeUi: _makeUi,
            makePage: _makePage,

            getFonts: _getFonts,
            getMonospaceFonts: _getMonospaceFonts,
            getFontWeight: _getFontWeight,
            getFontStyle: _getFontStyle,
            getTransparentImg: _getTransparentImg,

            getTransparentMaterial: _getTransparentMaterial,

            getTextPropertiesFromCoord: _getTextPropertiesFromCoord,
            getKeyCode: _getKeyCode,
            applyStateKeyEvent: _applyStateKeyEvent,

            makeUiTracker: _makeUiTracker,
            makeDotMesh: _makeDotMesh,
            makeBoxMesh: _makeBoxMesh,
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

const fonts = `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`;
const monospaceFonts = `Consolas, "Liberation Mono", Menlo, Courier, monospace`;
const fontWeight = 300;
const fontStyle = 'normal';
const transparentImgUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const _debounce = fn => {
  let running = false;
  let queued = false;

  const _go = () => {
    if (!running) {
      running = true;

      fn(() => {
        running = false;

        if (queued) {
          queued = false;

          _go();
        }
      });
    } else {
      queued = true;
    }
  };
  return _go;
};
const nop = () => {};

module.exports = Biolumi;
