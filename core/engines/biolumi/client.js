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

    class Anchor {
      constructor(left, right, top, bottom, onclick, onmousedown, onmouseup) {
        this.left = left;
        this.right = right;
        this.top = top;
        this.bottom = bottom;
        this.onclick = onclick;
        this.onmousedown = onmousedown;
        this.onmouseup = onmouseup;
      }
    }

    const _requestImg = src => new Promise((accept, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
    });
    const _requestTransparentImg = () => _requestImg(transparentImgUrl);
    const _requestBlackImg = () => _requestImg(blackImgUrl);
    const _requestUiWorker = () => {
      class UiWorker {
        constructor({frameTime = DEFAULT_FRAME_TIME} = {}) {
          this.frameTime = frameTime;

          this.threads = [];
          this.workTime = 0;
          this.clearingWorkTime = false;

          this.work = debounce(this.work.bind(this));
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
    const _requestUiTimer = () => {
      const startTime = Date.now();
      let uiTime = 0;

      class UiTimer {
        getUiTime() {
          return uiTime;
        }

        update() {
          const now = Date.now();
          uiTime = now - startTime;
        }
      }

      return Promise.resolve(new UiTimer());
    };
    const _requestRasterizer = () => new Promise((accept, reject) => {
      const w = window.open('archae/biolumi/worker.html', '_blank', "height=100,width=200,top=10000,left=10000,location=no,menubar=no,status=no,titlebar=no,toolbar=no");
      window.addEventListener('beforeunload', () => {
        w.close();
      });

      const c = new RTCPeerConnection({
        iceServers: [
          {urls:'stun:stun.l.google.com:19302'},
          // {urls:'stun:stun1.l.google.com:19302'},
          // {urls:'stun:stun2.l.google.com:19302'},
          // {urls:'stun:stun3.l.google.com:19302'},
          // {urls:'stun:stun4.l.google.com:19302'},
        ],
      });

      const queue = [];
      const d = c.createDataChannel('sendDataChannel', null);
      d.binaryType = 'arraybuffer';
      d.onopen = e => {
        accept({
          rasterize: (src, width, height) => {
            d.send(JSON.stringify([width, height]) + src);

            return Promise.all([
              new Promise((accept, reject) => {
                queue.push((err, imageArrayBuffer) => {
                  if (!err) {
                    createImageBitmap(new Blob([imageArrayBuffer], {type: 'image/png'}), 0, 0, width, height, {
                      imageOrientation: 'flipY',
                    })
                      .then(accept)
                      .catch(reject);
                  } else {
                    reject(err);
                  }
                });
              }),
              new Promise((accept, reject) => {
                queue.push((err, anchorsJson) => {
                  if (!err) {
                    const anchors = JSON.parse(anchorsJson).map(([left, right, top, bottom, onclick, onmousedown, onmouseup]) =>
                      new Anchor(left, right, top, bottom, onclick, onmousedown, onmouseup)
                    );
                    accept(anchors);
                  } else {
                    reject(err);
                  }
                });
              })
            ])
              .then(([
                imageBitmap,
                anchors,
              ]) => ({
                imageBitmap,
                anchors,
              }));
          },
        });
      };
      d.onmessage = e => {
        queue.shift()(null, e.data);
      };
      d.onerror = err => {
        queue.shift()(err);
      };

      c.createOffer()
        .then(description => new Promise((accept, reject) => {
          c.setLocalDescription(description);

          const iceCandidates = [];
          const _done = () => {
            c.onicecandidate = null;
            c.onicegatheringstatechange = null;

            const jsonHeaders = new Headers();
            jsonHeaders.append('Content-Type', 'application/json');
            fetch('/archae/signal/1', {
              method: 'POST',
              headers: jsonHeaders,
              body: JSON.stringify({
                description,
                iceCandidates,
              }),
            })
              .then(res => res.json())
              .then(accept)
              .catch(reject);
          };
          c.onicecandidate = e => {
            if (e.candidate !== null) {
              iceCandidates.push(e.candidate);
            } else {
              _done();
            }
          };
          c.onicegatheringstatechange = () => {
            if (c.iceGatheringState === 'complete') {
              _done();
            }
          };
        }))
        .then(({description, iceCandidates}) => {
          c.setRemoteDescription(description);
          for (let i = 0; i < iceCandidates.length; i++) {
            const iceCandidate = iceCandidates[i];
            c.addIceCandidate(iceCandidate);
          }
        });
    });

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/three',
        '/core/engines/intersect',
        '/core/utils/geometry-utils',
      ]),
      _requestTransparentImg(),
      _requestBlackImg(),
      _requestUiWorker(),
      _requestUiTimer(),
      _requestRasterizer(),
    ])
      .then(([
        [
          three,
          intersect,
          geometryUtils,
        ],
        transparentImg,
        blackImg,
        uiWorker,
        uiTimer,
        rasterizer,
      ]) => {
        if (live) {
          const {THREE, renderer} = three;

          const zeroQuaternion = new THREE.Quaternion();
          const defaultRayMeshScale = new THREE.Vector3(1, 1, 15);

          /* class MatrixProperties {
            constructor(position, rotation, scale) {
              this.position = position;
              this.rotation = rotation;
              this.scale = scale;
            }
          }

          const _decomposeObjectMatrixWorld = object => {
            const position = new THREE.Vector3();
            const rotation = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            object.matrixWorld.decompose(position, rotation, scale);
            return new MatrixProperties(position, rotation, scale);
          }; */

          const forwardVector = new THREE.Vector3(0, 0, -1);

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
                    .then(({imageBitmap, anchors}) => {
                      cache.img = imageBitmap;
                      cache.anchors = anchors;

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
                  const {anchors} = cache;

                  const layer = new Layer(w, h, anchors);

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
            constructor(width, height, anchors = []) {
              this.width = width;
              this.height = height;
              this.anchors = anchors;
            }
          }
          /* class BoxAnchor {
            constructor(boxTarget, anchor) {
              this.boxTarget = boxTarget;
              this.anchor = anchor;
            }
          } */

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

                const {mesh} = page;
                return mesh;
              } else {
                return null;
              }
            }
          }

          class UiTracker {
            constructor() {
              const intersecter = intersect.makeIntersecter({
                frameRate: 20,
                // debug: true,
              });
              this.intersecter = intersecter;

              this.pages = [];
              this.open = true;

              const _makeHoverState = () => ({
                intersectionPoint: null,
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

            setOpen(open) {
              this.open = open;
            }

            addPage(page) {
              const {mesh} = page;
              this.intersecter.addTarget(mesh);

              this.pages.push(page);
            }

            removePage(page) {
              const {mesh} = page;
              this.intersecter.removeTarget(mesh);

              this.pages.splice(this.pages.indexOf(page), 1);
            }

            addMesh(mesh) {
              this.intersecter.addTarget(mesh);
            }

            removeMesh(mesh) {
              this.intersecter.removeTarget(mesh);
            }

            getHoverState(side) {
              return this.hoverStates[side];
            }

            updateMatrixWorld(object) {
              this.intersecter.updateMatrixWorld(object);
            }

            reindex() {
              this.intersecter.reindex();
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

              const {open} = this;
              if (open) {
                const {intersecter} = this;
                const updated = intersecter.update();

                if (updated) {
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
                      const intersectionHoverState = intersecter.getHoverState(side);
                      const {object} = intersectionHoverState;

                      if (object) {
                        const {position, normal, originalObject} = intersectionHoverState;
                        const {worldPosition: controllerPosition} = gamepad;

                        hoverState.intersectionPoint = position;

                        const mesh = originalObject;
                        const {page} = mesh;

                        if (page) {
                          const {width, height, worldWidth, worldHeight} = page;
                          const worldPosition = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
                          const worldRotation = new THREE.Quaternion().setFromRotationMatrix(mesh.matrixWorld);

                          hoverState.target = page;

                          const yAxis = new THREE.Plane().setFromNormalAndCoplanarPoint(
                            new THREE.Vector3(1, 0, 0).applyQuaternion(worldRotation),
                            worldPosition.clone()
                              .sub(new THREE.Vector3(worldWidth / 2, 0, 0).applyQuaternion(worldRotation))
                          );
                          const x = yAxis.distanceToPoint(position) / worldWidth * width;
                          const xAxis = new THREE.Plane().setFromNormalAndCoplanarPoint(
                            new THREE.Vector3(0, -1, 0).applyQuaternion(worldRotation),
                            worldPosition.clone()
                              .add(new THREE.Vector3(0, worldHeight / 2, 0).applyQuaternion(worldRotation))
                          );
                          const y = xAxis.distanceToPoint(position) / worldHeight * height;

                          let anchor = null;
                          const {layer} = page;
                          const anchors = layer ? layer.anchors : [];
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

                            const anchorMidpoint = new THREE.Vector2(
                              ((anchor.left + anchor.right) / 2) / width * worldWidth,
                              ((anchor.top + anchor.bottom) / 2) / height * worldHeight
                            );
                            const anchorSize = new THREE.Vector2(
                              (anchor.right - anchor.left) / width * worldWidth,
                              (anchor.bottom - anchor.top) / height * worldHeight
                            );
                            boxMesh.position.copy(
                              worldPosition.clone()
                                .add(
                                  new THREE.Vector3((-worldWidth / 2) + anchorMidpoint.x, (worldHeight / 2) - anchorMidpoint.y, 0)
                                    .applyQuaternion(worldRotation)
                                )
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
                        } else {
                          const {anchor = null} = originalObject;

                          hoverState.target = originalObject;
                          hoverState.anchor = anchor;
                          hoverState.value = 0;
                          hoverState.crossValue = 0;

                          const boundingBox = new THREE.Box3().setFromObject(originalObject);
                          boxMesh.position.copy(boundingBox.getCenter());
                          boxMesh.quaternion.copy(zeroQuaternion);
                          boxMesh.scale.copy(boundingBox.getSize());
                          boxMesh.updateMatrixWorld();

                          if (!boxMesh.visible) {
                            boxMesh.visible = true;
                          }
                        }

                        dotMesh.position.copy(position);
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
                        if (!dotMesh.visible) {
                          dotMesh.visible = true;
                        }

                        rayMesh.scale.z = position.distanceTo(controllerPosition);
                        rayMesh.updateMatrixWorld();
                        if (!rayMesh.visible) {
                          rayMesh.visible = true;
                        }
                      } else {
                        _hideSide(side);
                      }
                    } else {
                      _hideSide(side);
                    }
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
          // const _makeBoxAnchor = ({boxTarget, anchor}) => new BoxAnchor(boxTarget, anchor);

          const _updateUiTimer = () => {
            uiTimer.update();
          };
          const _getUiTime = () => uiTimer.getUiTime();

          const _getFonts = () => fonts;
          const _getMonospaceFonts = () => monospaceFonts;
          const _getFontWeight = () => fontWeight;
          const _getFontStyle = () => fontStyle;
          const _getTransparentImg = () => transparentImg;
          const _getBlackImg = () => blackImg;

          const transparentMaterial = new THREE.ShaderMaterial({
            vertexShader: transparentShader.vertexShader,
            fragmentShader: transparentShader.fragmentShader,
            transparent: true,
            depthWrite: false,
          });
          const _getTransparentMaterial = () => transparentMaterial;

          const _measureText = (() => {
            const measureContexts = {};

            const _makeMeasureContext = fontSpec => {
              const {fonts, fontSize, lineHeight, fontWeight, fontStyle} = fontSpec;

              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px/${lineHeight} ${fonts}`;

              return ctx;
            };
            const _getFontSpecKey = fontSpec => {
              const {fonts, fontSize, lineHeight, fontWeight, fontStyle} = fontSpec;
              return [fonts, fontSize, lineHeight, fontWeight, fontStyle].join(':');
            };
            const _getMeasureContext = fontSpec => {
              const key = _getFontSpecKey(fontSpec);
              let entry = measureContexts[key];
              if (!entry) {
                entry = _makeMeasureContext(fontSpec);
                measureContexts[key] = entry;
              }
              return entry;
            };

            return (text, fontSpec) => _getMeasureContext(fontSpec).measureText(text).width;
          })();
          const _getTextPropertiesFromCoord = (text, fontSpec, coordPx) => {
            const slices = (() => {
              const result = [];
              for (let i = 0; i <= text.length; i++) {
                const slice = text.slice(0, i);
                result.push(slice);
              }
              return result;
            })();
            const widths = slices.map(slice => _measureText(slice, fontSpec));
            const distances = widths.map(width => Math.abs(coordPx - width));
            const sortedDistances = distances
              .map((distance, index) => ([distance, index]))
              .sort(([aDistance], [bDistance]) => (aDistance - bDistance));

            const index = sortedDistances[0][1];
            const px = widths[index];

            return {index, px};
          };
          const _getTextPropertiesFromIndex = (text, fontSpec, index) => {
            const slice = text.slice(0, index);
            const px = _measureText(slice, fontSpec);

            return {index, px};
          };

          const _getKeyCode = s => keycode(s);
          const _isPrintableKeycode = keyCode =>
            (keyCode > 47 && keyCode < 58) || // number keys
            (keyCode == 32) || // spacebar & return key(s) (if you want to allow carriage returns)
            (keyCode > 64 && keyCode < 91) || // letter keys
            (keyCode > 95 && keyCode < 112) || // numpad keys
            (keyCode > 185 && keyCode < 193) || // ;=,-./` (in order)
            (keyCode > 218 && keyCode < 223); // [\]' (in order)\
          const _applyStateKeyEvent = (state, e) => {
            const {inputText, inputIndex, fontSpec} = state;

            let change = false;
            let commit = false;

            if (_isPrintableKeycode(e.event.keyCode)) {
              if (!(e.event.ctrlKey && e.event.keyCode === 86)) { // ctrl-v
                state.inputText = inputText.slice(0, inputIndex) + _getKeyCode(e.event.keyCode) + inputText.slice(inputIndex);
                state.inputIndex++;
                state.inputValue = _getTextPropertiesFromIndex(state.inputText, fontSpec, state.inputIndex).px;

                change = true;
              }
            } else if (e.event.keyCode === 13) { // enter
              commit = true;
            } else if (e.event.keyCode === 8) { // backspace
              if (inputIndex > 0) {
                state.inputText = inputText.slice(0, inputIndex - 1) + inputText.slice(inputIndex);
                state.inputIndex--;
                state.inputValue = _getTextPropertiesFromIndex(state.inputText, fontSpec, state.inputIndex).px;

                change = true;
              }
            } else if (e.event.keyCode === 37) { // left
              state.inputIndex = Math.max(state.inputIndex - 1, 0);
              state.inputValue = _getTextPropertiesFromIndex(state.inputText, fontSpec, state.inputIndex).px;

              change = true;
            } else if (e.event.keyCode === 39) { // right
              state.inputIndex = Math.min(state.inputIndex + 1, inputText.length);
              state.inputValue = _getTextPropertiesFromIndex(state.inputText, fontSpec, state.inputIndex).px;

              change = true;
            } else if (e.event.keyCode === 38) { // up
              state.inputIndex = 0;
              state.inputValue = _getTextPropertiesFromIndex(state.inputText, fontSpec, state.inputIndex).px;

              change = true;
            } else if (e.event.keyCode === 40) { // down
              state.inputIndex = inputText.length;
              state.inputValue = _getTextPropertiesFromIndex(state.inputText, fontSpec, state.inputIndex).px;

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
            // makeBoxAnchor: _makeBoxAnchor,

            updateUiTimer: _updateUiTimer,
            getUiTime: _getUiTime,

            getFonts: _getFonts,
            getMonospaceFonts: _getMonospaceFonts,
            getFontWeight: _getFontWeight,
            getFontStyle: _getFontStyle,
            getTransparentImg: _getTransparentImg,
            getBlackImg: _getBlackImg,

            getTransparentMaterial: _getTransparentMaterial,

            getTextPropertiesFromCoord: _getTextPropertiesFromCoord,
            getTextPropertiesFromIndex: _getTextPropertiesFromIndex,
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
const blackImgUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"><path d="M0 0h1v1H0z"/></svg>';

const debounce = fn => {
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
