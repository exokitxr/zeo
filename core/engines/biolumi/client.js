import keycode from 'keycode';

import menuShader from './lib/shaders/menu';

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

          return () => {
            const index = threads.indexOf(thread);
            if (index !== -1) {
              threads.splice(index, 1);
            }
          };
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

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/three',
        '/core/engines/anima',
        '/core/utils/geometry-utils',
      ]),
      _requestTransparentImg(),
      _requestUiWorker(),
      _requestUiTimer(),
    ])
      .then(([
        [
          three,
          anima,
          geometryUtils,
        ],
        transparentImg,
        uiWorker,
        uiTimer,
      ]) => {
        if (live) {
          const {THREE, renderer} = three;

          const _decomposeObjectMatrixWorld = object => {
            const position = new THREE.Vector3();
            const rotation = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            object.matrixWorld.decompose(position, rotation, scale);
            return {position, rotation, scale};
          };

          const dotMeshMaterial = new THREE.MeshBasicMaterial({
            color: 0x44c2ff,
          });
          const boxMeshMaterial = new THREE.MeshBasicMaterial({
            // color: new THREE.Color(0x44c2ff).multiplyScalar(0.75).getHex(),
            color: 0x44c2ff,
            // wireframe: true,
            transparent: true,
            opacity: 0.5,
            // depthTest: false,
            // depthWrite: false,
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

          class Page {
            constructor(parent, spec, type, state, color, width, height, worldWidth, worldHeight) {
              this.parent = parent;
              this.spec = spec;
              this.type = type;
              this.state = state;
              this.color = color;
              this.width = width;
              this.height = height;
              this.worldWidth = worldWidth;
              this.worldHeight = worldHeight;

              const mesh = (() => {
                const geometry = new THREE.PlaneBufferGeometry(worldWidth, worldHeight);
                const material = (() => {
                  const shaderUniforms = THREE.UniformsUtils.clone(menuShader.uniforms);
                  shaderUniforms.texture.value = new THREE.Texture(
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
              this.layer = null;
              this.rendered = false;
            }

            update() {
              let cache = {
                layerSpec: null,
                htmlSrc: null,
                innerSrc: null,
                img: null,
              };

              const _requestLayerSpec = () => {
                const {spec, state} = this;
                cache.layerSpec = typeof spec === 'function' ? spec(state) : spec;

                return Promise.resolve();
              };
              const _requestHtmlSrc = () => {
                const {layerSpec} = cache;
                const {type = 'html'} = layerSpec;
                if (type === 'html') {
                  const {parent: {width, height}} = this;
                  const {src, x = 0, y = 0, w = width, h = height, pixelated = false} = layerSpec;

                  cache.htmlSrc = (() => {
                    const el = document.createElement('div');
                    el.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
                    el.setAttribute('style', rootCss);
                    el.innerHTML = src;

                    const videos = el.querySelectorAll('video');
                    for (let i = 0; i < videos.length; i++) {
                      const video = videos[i];
                      const a = document.createElement('a');
                      a.style = video.style;
                      a.setAttribute('media', 'video:' + video.src);
                      video.parentNode.replaceChild(a, video);
                    }

                    return new XMLSerializer().serializeToString(el);
                  })();
                }

                return Promise.resolve();
              };
              const _requestInnerSrc = () => {
                const {htmlSrc} = cache;
                if (htmlSrc !== null) {
                  cache.innerSrc = htmlSrc.replace(/([^\x00-\x7F])/g, (all, c) => ('&#' + c.charCodeAt(0) + ';'));
                }

                return Promise.resolve();
              };
              const _requestImage = () => new Promise((accept, reject) => {
                const {layerSpec} = cache;
                const {type = 'html'} = layerSpec;
                if (type === 'html') {
                  const {parent: {width, height}} = this;
                  const {w = width, h = height} = layerSpec;

                  const img = new Image();
                  const {innerSrc} = cache;
                  img.src = 'data:image/svg+xml;base64,' + btoa('<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'' + w + '\' height=\'' + h + '\'>' +
                    '<foreignObject width=\'100%\' height=\'100%\' x=\'0\' y=\'0\'>' +
                      innerSrc +
                    '</foreignObject>' +
                  '</svg>');
                  img.onload = () => {
                    cache.img = img;

                    accept();
                  };
                  img.onerror = err => {
                    console.warn('biolumi image load error', {src: img.src}, err);

                    accept();
                  };
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
                const {pixelated = false} = layerSpec;

                const {mesh: {material: {uniforms: {texture: {value: texture}}}}} = this;
                texture.image = img;
                if (!pixelated) {
                  texture.minFilter = THREE.LinearFilter;
                  texture.magFilter = THREE.LinearFilter;
                  texture.anisotropy = 16;
                } else {
                  texture.minFilter = THREE.NearestFilter;
                  texture.magFilter = THREE.NearestFilter;
                  texture.anisotropy = 1;
                }
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
                  const {parent: {width, height}} = this;
                  const {src, x = 0, y = 0, w = width, h = height} = layerSpec;

                  let divEl = null;
                  const _renderTempElement = fn => {
                    if (!divEl) {
                      divEl = (() => {
                        const el = document.createElement('div');
                        el.style.cssText = 'position: absolute; top: 0; left: 0; width: ' + w + 'px;';
                        const {innerSrc} = cache;
                        el.innerHTML = innerSrc;

                        return el;
                      })();
                    }
                    document.body.appendChild(divEl);

                    const result = fn(divEl);

                    document.body.removeChild(divEl);

                    return result;
                  };
                  const _makeAnchors = () => _renderTempElement(divEl => Array.from(divEl.querySelectorAll('a')).map(a => {
                    const rect = a.getBoundingClientRect();
                    const onclick = a.getAttribute('onclick') || null;
                    const onmousedown = a.getAttribute('onmousedown') || null;
                    const onmouseup = a.getAttribute('onmouseup') || null;

                    return new Anchor(rect, onclick, onmousedown, onmouseup);
                  }));

                  const layer = new Layer(this);
                  layer.anchors = null;
                  layer.makeAnchors = _makeAnchors;
                  layer.medias = _renderTempElement(divEl => Array.from(divEl.querySelectorAll('a[media]')).map(a => {
                    const rect = a.getBoundingClientRect();
                    const media = a.getAttribute('media') || null;

                    return new Media(rect, media);
                  }));
                  layer.x = x;
                  layer.y = y;
                  layer.w = w;
                  layer.h = h;

                  this.layer = layer;
                } else if (type === 'image') {
                  const {parent: {width, height}} = this;
                  const {x = 0, y = 0, w = width, h = height} = layerSpec;

                  const layer = new Layer(this);
                  layer.x = x;
                  layer.y = y;
                  layer.w = w;
                  layer.h = h;

                  this.layer = layer;
                } else {
                  console.warn('illegal layer spec type:' + JSON.stringify(type));

                  this.layer = null;
                }

                return Promise.resolve();
              };
              const cancels = [
                _requestLayerSpec,
                _requestHtmlSrc,
                _requestInnerSrc,
                _requestImage,
                _requestTexture,
                _requestLayer,
              ].map(work => uiWorker.add(work));

              return () => { // return a cancel function
                for (let i = 0; i < cancels.length; i++) {
                  const cancel = cancels[i];
                  cancel();
                }
              };
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
            constructor(parent) {
              this.parent = parent;

              this.img = null;
              this.anchors = [];
              this.makeAnchors = null;
              this.medias = null;

              const {parent: {width, height}} = parent;
              this.x = 0;
              this.y = 0;
              this.w = width;
              this.h = height;
            }

            getPosition() {
              const {parent: {parent: {width, height}}} = this;

              return new Position(
                this.x / width,
                this.y / height,
                this.w / width,
                this.h / height
              );
            }

            getRect() {
              const position = this.getPosition();
              const {x: px, y: py, w: pw, h: ph} = position;
              const {parent: {parent: {width, height}}} = this;

              return new Rect(
                clamp(py * height, 0, height),
                clamp((py + ph) * height, 0, height),
                clamp(px * width, 0, width),
                clamp((px + pw) * width, 0, width)
              );
            }

            getAnchors() {
              let {anchors} = this;
              const {makeAnchors} = this;
              if (!anchors && makeAnchors) {
                anchors = makeAnchors();
                this.anchors = anchors;
                this.makeAnchors = null;
              }

              const position = this.getPosition();
              const {x: px, y: py, w: pw, h: ph} = position;
              const {parent: {parent: {width, height}}} = this;

              return anchors.map(anchor => {
                const {rect, onclick, onmousedown, onmouseup} = anchor;
                const {top, bottom, left, right} = rect;

                return new Anchor(
                  new Rect(
                    clamp((py * height) + top, 0, (py + ph) * height),
                    clamp((py * height) + bottom, 0, (py + ph) * height),
                    clamp((px * width) + left, 0, (px + pw) * width),
                    clamp((px * width) + right, 0, (px + pw) * width)
                  ),
                  onclick,
                  onmousedown,
                  onmouseup
                );
              });
            }
          }

          class Anchor {
            constructor(rect, onclick, onmousedown, onmouseup) {
              this.rect = rect;
              this.onclick = onclick;
              this.onmousedown = onmousedown;
              this.onmouseup = onmouseup;
            }
          }

          class Media {
            constructor(rect, media) {
              this.rect = rect;
              this.media = media;
            }
          }

          class Position {
            constructor(x, y, w, h) {
              this.x = x; // x position
              this.y = y; // y position
              this.w = w; // texture width
              this.h = h; // texture height
            }
          }

          class Rect {
            constructor(top, bottom, left, right) {
              this.top = top;
              this.bottom = bottom;
              this.left = left;
              this.right = right;
            }
          }

          class Ui {
            constructor(width, height, color) {
              this.width = width;
              this.height = height;
              this.color = color;

              this.page = null;
            }

            makePage(spec, {type = null, state = null, worldWidth, worldHeight} = {}) {
              const {page} = this;

              if (!page) {
                const {width, height, color} = this;
                const page = new Page(this, spec, type, state, color, width, height, worldWidth, worldHeight);
                this.page = page;

                const {mesh} = page;
                return mesh;
              } else {
                return null;
              }
            }
          }

          class IntersectionSpec {
            constructor(
              position,
              rotation,
              scale,
              page,
              width,
              height,
              worldWidth,
              worldHeight,
              intersectionPoint
            ) {
              this.position = position;
              this.rotation = rotation;
              this.scale = scale;
              this.page = page;
              this.width = width;
              this.height = height;
              this.worldWidth = worldWidth;
              this.worldHeight = worldHeight;
              this.intersectionPoint = intersectionPoint;
            }
          }

          class UiTracker {
            constructor() {
              this.pages = [];

              const _makeHoverState = () => ({
                intersectionPoint: null,
                page: null,
                anchor: null,
                value: 0,
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

            addPage(page) {
              this.pages.push(page);
            }

            removePage(page) {
              this.pages.splice(this.pages.indexOf(page), 1);
            }

            getHoverState(side) {
              return this.hoverStates[side];
            }

            update({pose, enabled, sides, controllerMeshes}) {
              const {gamepads} = pose;
              const {pages, hoverStates, dotMeshes, boxMeshes} = this;

              SIDES.forEach(side => {
                const dotMesh = dotMeshes[side];
                const boxMesh = boxMeshes[side];
                const controllerMesh = controllerMeshes[side];
                const {rayMesh} = controllerMesh;
                const gamepad = gamepads[side];

                if (enabled && sides.indexOf(side) !== -1 && gamepad) {
                  const {position: controllerPosition, rotation: controllerRotation, scale: controllerScale} = gamepad;
                  const hoverState = hoverStates[side];
                  const controllerLine = geometryUtils.makeControllerLine(controllerPosition, controllerRotation, controllerScale);

                  const intersectionSpec = (() => {
                    let closestIntersectionSpec = null;
                    let closestIntersectionSpecDistance = Infinity;

                    for (let i = 0; i < pages.length; i++) {
                      const page = pages[i];
                      const {mesh} = page;

                      if (_isWorldVisible(mesh)) {
                        const {width, height, worldWidth, worldHeight} = page;
                        const {position, rotation, scale} = _decomposeObjectMatrixWorld(mesh);

                        const menuBoxTarget = geometryUtils.makeBoxTarget(
                          position,
                          rotation,
                          scale,
                          new THREE.Vector3(worldWidth, worldHeight, 0)
                        );
                        const intersectionPoint = menuBoxTarget.intersectLine(controllerLine);

                        if (intersectionPoint) {
                          const distance = controllerPosition.distanceTo(intersectionPoint);

                          if (distance < closestIntersectionSpecDistance) {
                            closestIntersectionSpec = new IntersectionSpec(
                              position,
                              rotation,
                              scale,
                              page,
                              width,
                              height,
                              worldWidth,
                              worldHeight,
                              intersectionPoint
                            );
                            closestIntersectionSpecDistance = distance;
                          }
                        }
                      }
                    }

                    return closestIntersectionSpec;
                  })();

                  if (intersectionSpec) {
                    const {
                      position,
                      rotation,
                      scale,
                      page,
                      width,
                      height,
                      worldWidth,
                      worldHeight,
                      intersectionPoint,
                    } = intersectionSpec;

                    hoverState.intersectionPoint = intersectionPoint;
                    hoverState.page = page;

                    const _getMenuMeshPoint = _makeMeshPointGetter({
                      position,
                      rotation,
                      scale,
                      width,
                      height,
                      worldWidth,
                      worldHeight,
                    });

                    const anchorBoxTarget = (() => {
                      const {layer} = page;

                      if (layer) {
                        const anchors = layer.getAnchors();

                        for (let i = 0; i < anchors.length; i++) {
                          const anchor = anchors[i];
                          const {rect} = anchor;

                          const anchorBoxTarget = geometryUtils.makeBoxTargetOffset(
                            position,
                            rotation,
                            scale,
                            new THREE.Vector3(
                              -(worldWidth / 2) + (rect.left / width) * worldWidth,
                              (worldHeight / 2) + (-rect.top / height) * worldHeight,
                              -(0.02 / 2)
                            ),
                            new THREE.Vector3(
                              -(worldWidth / 2) + (rect.right / width) * worldWidth,
                              (worldHeight / 2) + (-rect.bottom / height) * worldHeight,
                              0.02 / 2
                            )
                          );

                          if (anchorBoxTarget.intersectLine(controllerLine)) {
                            anchorBoxTarget.anchor = anchor;

                            return anchorBoxTarget;
                          }
                        }

                        return null;
                      } else {
                        return null;
                      }
                    })();
                    if (anchorBoxTarget) {
                      const {anchor} = anchorBoxTarget;
                      hoverState.anchor = anchor;
                      hoverState.value = (() => {
                        const {rect} = anchor;
                        const horizontalLine = new THREE.Line3(
                          _getMenuMeshPoint(rect.left, (rect.top + rect.bottom) / 2, 0),
                          _getMenuMeshPoint(rect.right, (rect.top + rect.bottom) / 2, 0)
                        );
                        const closestHorizontalPoint = horizontalLine.closestPointToPoint(intersectionPoint, true);
                        return new THREE.Line3(horizontalLine.start.clone(), closestHorizontalPoint.clone()).distance() / horizontalLine.distance();
                      })();

                      boxMesh.position.copy(anchorBoxTarget.position);
                      boxMesh.quaternion.copy(anchorBoxTarget.quaternion);
                      boxMesh.scale.set(
                        Math.max(anchorBoxTarget.size.x * anchorBoxTarget.scale.x, 0.001),
                        Math.max(anchorBoxTarget.size.y * anchorBoxTarget.scale.y, 0.001),
                        Math.max(anchorBoxTarget.size.z * anchorBoxTarget.scale.z, 0.001)
                      );
                      if (!boxMesh.visible) {
                        boxMesh.visible = true;
                      }
                    } else {
                      hoverState.anchor = null;
                      hoverState.value = 0;

                      if (boxMesh.visible) {
                        boxMesh.visible = false;
                      }
                    }

                    dotMesh.position.copy(intersectionPoint);
                    dotMesh.quaternion.copy(rotation);
                    if (!dotMesh.visible) {
                      dotMesh.visible = true;
                    }

                    rayMesh.scale.z = intersectionPoint.distanceTo(controllerLine.start);
                    if (!rayMesh.visible) {
                      rayMesh.visible = true;
                    }
                  } else {
                    hoverState.intersectionPoint = null;
                    hoverState.page = null;
                    hoverState.anchor = null;
                    hoverState.value = 0;

                    if (boxMesh.visible) {
                      boxMesh.visible = false;
                    }
                    if (dotMesh.visible) {
                      dotMesh.visible = false;
                    }

                    rayMesh.scale.z = controllerLine.distance();
                    if (!rayMesh.visible) {
                      rayMesh.visible = true;
                    }
                  }
                } else {
                  if (boxMesh.visible) {
                    boxMesh.visible = false;
                  }
                  if (dotMesh.visible) {
                    dotMesh.visible = false;
                  }

                  if (rayMesh.visible) {
                    rayMesh.visible = false;
                  }
                }
              });
            }
          }

          const _makeUi = ({width, height, color = [1, 1, 1, 1]}) => new Ui(width, height, color);

          const _updateUiTimer = () => {
            uiTimer.update();
          };

          const _getFonts = () => fonts;
          const _getMonospaceFonts = () => monospaceFonts;
          const _getFontWeight = () => fontWeight;
          const _getFontStyle = () => fontStyle;
          const _getTransparentImg = () => transparentImg;

          const transparentMaterial = new THREE.MeshBasicMaterial({
            opacity: 0,
            transparent: true,
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

            if ('keyCode' in e) {
              if (_isPrintableKeycode(e.keyCode)) {
                if (!(e.ctrlKey && e.keyCode === 86)) { // ctrl-v
                  state.inputText = inputText.slice(0, inputIndex) + _getKeyCode(e.keyCode) + inputText.slice(inputIndex);
                  state.inputIndex++;
                  state.inputValue = _getTextPropertiesFromIndex(state.inputText, fontSpec, state.inputIndex).px;

                  change = true;
                }
              } else if (e.keyCode === 13) { // enter
                commit = true;
              } else if (e.keyCode === 8) { // backspace
                if (inputIndex > 0) {
                  state.inputText = inputText.slice(0, inputIndex - 1) + inputText.slice(inputIndex);
                  state.inputIndex--;
                  state.inputValue = _getTextPropertiesFromIndex(state.inputText, fontSpec, state.inputIndex).px;

                  change = true;
                }
              } else if (e.keyCode === 37) { // left
                state.inputIndex = Math.max(state.inputIndex - 1, 0);
                state.inputValue = _getTextPropertiesFromIndex(state.inputText, fontSpec, state.inputIndex).px;

                change = true;
              } else if (e.keyCode === 39) { // right
                state.inputIndex = Math.min(state.inputIndex + 1, inputText.length);
                state.inputValue = _getTextPropertiesFromIndex(state.inputText, fontSpec, state.inputIndex).px;

                change = true;
              } else if (e.keyCode === 38) { // up
                state.inputIndex = 0;
                state.inputValue = _getTextPropertiesFromIndex(state.inputText, fontSpec, state.inputIndex).px;

                change = true;
              } else if (e.keyCode === 40) { // down
                state.inputIndex = inputText.length;
                state.inputValue = _getTextPropertiesFromIndex(state.inputText, fontSpec, state.inputIndex).px;

                change = true;
              }
            } else if ('clipboardData' in e) {
              const text = e.clipboardData.getData('text');

              state.inputText = inputText.slice(0, inputIndex) + text + inputText.slice(inputIndex);
              state.inputIndex += text.length;
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
            const geometry = new THREE.CylinderBufferGeometry(0.0, 0.01, 0.001, 32)
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

            updateUiTimer: _updateUiTimer,

            getFonts: _getFonts,
            getMonospaceFonts: _getMonospaceFonts,
            getFontWeight: _getFontWeight,
            getFontStyle: _getFontStyle,
            getTransparentImg: _getTransparentImg,

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
const rootCss = `margin: 0px; padding: 0px; height: 100%; width: 100%; font-family: ${fonts}; font-weight: ${fontWeight}; overflow: visible; user-select: none;`;

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
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
const nop = () => {};

module.exports = Biolumi;
