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
            color: 0x44c2ff,
            wireframe: true,
            // opacity: 0.5,
            // transparent: true,
          });
          /* const pointsHighlightMaterial = new THREE.PointsMaterial({
            color: 0x44c2ff,
            size: 0.01,
          }); */

          class Page {
            constructor(parent, spec, type, state, color, world, height, worldWidth, worldHeight, metadata) {
              this.parent = parent;
              this.spec = spec;
              this.type = type;
              this.state = state;
              this.color = color;
              this.width = width;
              this.height = height;
              this.worldWidth = worldWidth;
              this.worldHeight = worldHeight;
              this.metadata = metadata;

              const mesh = () => {
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
                    transparent: true,
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
              };
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
                    el.innerHTML = src
                      .replace(/(<img\s+(?:(?!src=)[^>])*)(src=(?!['"]?data:)\S+)/g, '$1'); // optimization: do not load non-dataurl images

                    const imgs = el.querySelectorAll('img');

                    // do not load images without an explicit width + height
                    for (let i = 0; i < imgs.length; i++) {
                      const img = imgs[i];
                      if (!img.hasAttribute('width') || !img.hasAttribute('height')) {
                        img.parentNode.removeChild(img);
                      }
                    }

                    // remove empty anchors
                    const as = el.querySelectorAll('a');
                    for (let i = 0; i < as.length; i++) {
                      const a = as[i];
                      if (a.childNodes.length > 0) {
                        if (!a.style.textDecoration) {
                          a.style.textDecoration = 'underline';
                        }
                      } else {
                        a.parentNode.removeChild(a);
                      }
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

                const {material: {uniforms: {texture: {value: texture}}}} = this;
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

                  const _makeAnchors = () => {
                    const divEl = (() => {
                      const el = document.createElement('div');
                      el.style.cssText = 'position: absolute; top: 0; left: 0; width: ' + w + 'px;';
                      const {innerSrc} = cache;
                      el.innerHTML = innerSrc;

                      return el;
                    })();
                    document.body.appendChild(divEl);

                    const anchors = (() => {
                      const as = (() => {
                        const as = divEl.querySelectorAll('a');

                        const result = [];
                        for (let i = 0; i < as.length; i++) {
                          const a = as[i];
                          if (a.style.display !== 'none' && a.style.visibility !== 'hidden') {
                            result.push(a);
                          }
                        }
                        return result;
                      })();
                      const numAs = as.length;

                      const result = Array(numAs);
                      for (let i = 0; i < numAs; i++) {
                        const a = as[i];

                        const rect = a.getBoundingClientRect();
                        const onclick = a.getAttribute('onclick') || null;
                        const onmousedown = a.getAttribute('onmousedown') || null;
                        const onmouseup = a.getAttribute('onmouseup') || null;

                        const anchor = new Anchor(rect, onclick, onmousedown, onmouseup);
                        result[i] = anchor;
                      }

                      return result;
                    })();

                    document.body.removeChild(divEl);

                    return anchors;
                  };

                  const layer = new Layer(this);
                  layer.anchors = null;
                  layer.makeAnchors = _makeAnchors;
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

            addPage(spec, {type = null, state = null, worldWidth, worldHeight, metadata} = {}) {
              const {page} = this;

              if (!page) {
                const {width, height, color} = this;
                const page = new Page(this, spec, type, state, color, width, height, worldWidth, worldHeight, metadata);
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
              this.pages = [];

              const _makeMenuHoverState = () => ({
                intersectionPoint: null,
                metadata: null,
                anchor: null,
                value: 0,
              });
              this.hoverStates = {
                left: _makeMenuHoverState(),
                right: _makeMenuHoverState(),
              };

              const _makeDotMesh = () => {
                const geometry = new THREE.CylinderBufferGeometry(0.0, 0.01, 0.001, 32)
                  .applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
                const material = dotMeshMaterial;

                const mesh = new THREE.Mesh(geometry, material);
                mesh.visible = false;
                return mesh;
              };
              this.dotMeshes = {
                left: _makeDotMesh(),
                right: _makeDotMesh(),
              };

              const _makeBoxMesh = () => {
                const geometry = new THREE.BoxBufferGeometry(1, 1, 1);

                const mesh = new THREE.Mesh(geometry, boxMeshMaterial);
                mesh.visible = false;
                return mesh;
              };
              this.boxMeshes = {
                left: _makeBoxMesh(),
                right: _makeBoxMesh(),
              };
            }

            addPage(page) {
              this.pages.push(page);
            }

            update({pose}) {
              const {gamepads} = pose;
              const {pages, hoverStates, dotMeshes, boxMeshes} = this;

              SIDES.forEach(side => {
                const gamepad = gamepads[side];
                const {position: controllerPosition, rotation: controllerRotation, scale: controllerScale} = gamepad;
                const hoverState = hoverStates[side];
                const dotMesh = dotMeshes[side];
                const boxMesh = boxMeshes[side];

                const objects = pages.map(page => {
                  const {mesh, width, height, worldWidth, worldHeight, metadata} = page;
                  const matrixObject = _decomposeObjectMatrixWorld(mesh);

                  return {
                    matrixObject,
                    page,
                    width,
                    height,
                    worldWidth,
                    worldHeight,
                    worldDepth: worldWidth / 50,
                    metadata,
                  };
                });
                const intersectionSpecs = objects.map(object => {
                  const {matrixObject, worldWidth, worldHeight, worldDepth} = object;
                  const {position, rotation, scale} = matrixObject;
                  const controllerLine = geometryUtils.makeControllerLine(controllerPosition, controllerRotation, controllerScale);

                  const menuBoxTarget = geometryUtils.makeBoxTarget(
                    position,
                    rotation,
                    scale,
                    new THREE.Vector3(worldWidth, worldHeight, 0)
                  );
                  const intersectionPoint = menuBoxTarget.intersectLine(controllerLine);

                  if (intersectionPoint) {
                    const distance = controllerPosition.distanceTo(intersectionPoint);

                    return {
                      object,
                      intersectionPoint,
                      controllerLine,
                      controllerScale,
                      distance,
                    };
                  } else {
                    return null;
                  }
                }).filter(intersectionSpec => intersectionSpec !== null);
                const intersectionSpec = intersectionSpecs.length > 0 ? intersectionSpecs.sort((a, b) => a.distance - b.distance)[0] : null;

                if (intersectionSpec) {
                  const {
                    object: {
                      matrixObject: {
                        position,
                        rotation,
                        scale,
                      },
                      page,
                      width,
                      height,
                      worldWidth,
                      worldHeight,
                      worldDepth,
                      metadata,
                    },
                    intersectionPoint,
                    controllerLine,
                    controllerScale,
                  } = intersectionSpec;

                  hoverState.intersectionPoint = intersectionPoint;
                  hoverState.metadata = metadata || null;

                  const _getMenuMeshPoint = _makeMeshPointGetter({
                    position,
                    rotation,
                    scale,
                    width,
                    height,
                    worldWidth,
                    worldHeight,
                    worldDepth,
                  });

                  const anchorBoxTargets = (() => {
                    const {layer} = page;

                    if (layer) {
                      const anchors = layer.getAnchors();

                      return anchors.map(anchor => {
                        const {rect} = anchor;

                        const anchorBoxTarget = geometryUtils.makeBoxTargetOffset(
                          position,
                          rotation,
                          scale,
                          new THREE.Vector3(
                            -(worldWidth / 2) + (rect.left / width) * worldWidth,
                            (worldHeight / 2) + (-rect.top / height) * worldHeight,
                            -worldDepth
                          ),
                          new THREE.Vector3(
                            -(worldWidth / 2) + (rect.right / width) * worldWidth,
                            (worldHeight / 2) + (-rect.bottom / height) * worldHeight,
                            worldDepth
                          )
                        );
                        anchorBoxTarget.anchor = anchor;

                        return anchorBoxTarget;
                      });
                    } else {
                      return [];
                    }
                  })();
                  const anchorBoxTarget = (() => {
                    const interstectedAnchorBoxTargets = anchorBoxTargets.filter(anchorBoxTarget => anchorBoxTarget.intersectLine(controllerLine));

                    if (interstectedAnchorBoxTargets.length > 0) {
                      return interstectedAnchorBoxTargets[0];
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

                  if (dotMesh) {
                    dotMesh.position.copy(intersectionPoint);
                    dotMesh.quaternion.copy(rotation);
                    // dotMesh.material.size = pointsHighlightMaterial.size / ((controllerScale.x + controllerScale.y + controllerScale.z) / 3);

                    if (!dotMesh.visible) {
                      dotMesh.visible = true;
                    }
                  }
                } else {
                  hoverState.intersectionPoint = null;
                  hoverState.metadata = null;
                  hoverState.anchor = null;
                  hoverState.value = 0;

                  if (boxMesh.visible) {
                    boxMesh.visible = false;
                  }
                  if (dotMesh.visible) {
                    dotMesh.visible = false;
                  }
                }
              };
            });
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
          const solidMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            opacity: 1,
            side: THREE.DoubleSide,
            transparent: true,
            // alphaTest: 0.5,
            // depthWrite: false,
          });
          const _getSolidMaterial = () => solidMaterial;

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

          return {
            makeUi: _makeUi,

            updateUiTimer: _updateUiTimer,

            getFonts: _getFonts,
            getMonospaceFonts: _getMonospaceFonts,
            getFontWeight: _getFontWeight,
            getFontStyle: _getFontStyle,
            getTransparentImg: _getTransparentImg,

            getTransparentMaterial: _getTransparentMaterial,
            getSolidMaterial: _getSolidMaterial,

            getTextPropertiesFromCoord: _getTextPropertiesFromCoord,
            getTextPropertiesFromIndex: _getTextPropertiesFromIndex,
            getKeyCode: _getKeyCode,
            applyStateKeyEvent: _applyStateKeyEvent,

            makeUiTracker: _makeUiTracker,
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
