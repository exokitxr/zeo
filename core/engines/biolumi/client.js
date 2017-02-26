import keycode from 'keycode';

import menuShaders from './lib/shaders/menu';

const MAX_NUM_TEXTURES = 16;
const TRANSITION_TIME = 1000;

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

    const _requestTransparentImg = () => new Promise((accept, reject) => {
      const img = new Image();
      img.src = transparentImgUrl;
      img.onload = () => {
        accept(img);
      };
      img.onerror = err => {
        reject(err);
      };
    });

    return Promise.all([
      archae.requestPlugins([
        '/core/engines/three',
        '/core/engines/anima',
        '/core/plugins/geometry-utils',
      ]),
      _requestTransparentImg(),
    ])
      .then(([
        [
          three,
          anima,
          geometryUtils,
        ],
        transparentImg,
      ]) => {
        if (live) {
          const {THREE} = three;

          const _requestUi = ({width, height}) => new Promise((accept, reject) => {
            const pages = [];

            class Page {
              constructor(parent, spec, type) {
                this.parent = parent;
                this.spec = spec;
                this.type = type;

                this.layers = [];

                this.x = 0;
                this.y = 0;

                this._lastStateJson = '';
              }

              update(state = null, cb = () => {}) {
                const stateJson = JSON.stringify(state);
                const {_lastStateJson: lastStateJson} = this;

                if (stateJson !== lastStateJson) {
                  this._lastStateJson = stateJson;

                  const {spec} = this;

                  const layers = [];
                  const layersSpec = typeof spec === 'function' ? spec(state) : spec;
                  if (layersSpec.length > 0) {
                    let pending = layersSpec.length;
                    const pend = () => {
                      if (--pending === 0) {
                        this.layers = layers;

                        cb();
                      }
                    };

                    for (let i = 0; i < layersSpec.length; i++) {
                      const layerSpec = layersSpec[i];
                      const {type = 'html'} = layerSpec;

                      if (type === 'html') {
                        const {src, x = 0, y = 0, w = width, h = height, scroll = false, pixelated = false} = layerSpec;

                        const innerSrc = (() => {
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
                        const divEl = (() => {
                          const el = document.createElement('div');
                          el.style.cssText = 'position: absolute; top: 0; left: 0; width: ' + w + 'px;';
                          el.innerHTML = innerSrc;

                          return el;
                        })();
                        document.body.appendChild(divEl);

                        const {scrollHeight, scrollWidth} = divEl;

                        const anchors = (() => {
                          const as = divEl.querySelectorAll('a');
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

                        const img = new Image();
                        img.src = 'data:image/svg+xml;base64,' + btoa('<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'' + scrollWidth + '\' height=\'' + scrollHeight + '\'>' +
                          '<foreignObject width=\'100%\' height=\'100%\' x=\'0\' y=\'0\'>' +
                            innerSrc +
                          '</foreignObject>' +
                        '</svg>');
                        img.onload = () => {
                          layer.img = img;

                          pend();
                        };
                        img.onerror = err => {
                          console.warn('biolumi image load error', {src: img.src}, err);
                        };

                        const layer = new Layer(this);
                        layer.anchors = anchors;
                        layer.x = x;
                        layer.y = y;
                        layer.w = w;
                        layer.h = h;
                        layer.scrollHeight = scrollHeight;
                        layer.scrollWidth = scrollWidth;
                        layer.scroll = scroll;
                        layer.pixelated = pixelated;
                        layers.push(layer);
                      } else if (type === 'image') {
                        let {img: imgs} = layerSpec;
                        if (!Array.isArray(imgs)) {
                          imgs = [imgs];
                        }
                        const {x = 0, y = 0, w = width, h = height, frameTime = 300, pixelated = false} = layerSpec;

                        setTimeout(pend);

                        for (let j = 0; j < imgs.length; j++) {
                          const img = imgs[j];

                          const layer = new Layer(this);
                          layer.img = img;
                          layer.x = x;
                          layer.y = y;
                          layer.w = w;
                          layer.h = h;
                          layer.scrollHeight = h;
                          layer.scrollWidth = w;
                          layer.numFrames = imgs.length;
                          layer.frameIndex = j;
                          layer.frameTime = frameTime;
                          layer.pixelated = pixelated;
                          layers.push(layer);
                        }
                      } else {
                        throw new Error('unknown layer type: ' + type);
                      }
                    }
                  } else {
                    cb();
                  }
                } else {
                  cb();
                }
              }
            }

            class Layer {
              constructor(parent) {
                this.parent = parent;

                this.img = null;
                this.anchors = [];
                const {parent: {width, height}} = parent;

                this.x = 0;
                this.y = 0;
                this.w = width;
                this.h = height;
                this.scrollHeight = height;
                this.scrollWidth = width;
                this.scroll = false;
                this.scrollTop = 0;
                this.scrollLeft = 0;
                this.numFrames = 1;
                this.frameIndex = 0;
                this.frameTime = 0;
                this.pixelated = false;
              }

              getValid({uiTime}) {
                const {numFrames} = this;

                if (numFrames > 1) {
                  const {parent, frameIndex, frameTime} = this;
                  const currentFrameIndex = Math.floor(uiTime / frameTime) % numFrames;
                  return currentFrameIndex === frameIndex;
                } else {
                  return true; // XXX optimize this
                }
              }

              getPosition() {
                const {parent} = this;
                const {parent: {width, height}} = parent;

                return new Position(
                  parent.x + (this.x / width),
                  parent.y + (this.y / height),
                  this.w / width,
                  this.h / height,
                  this.scrollTop / height,
                  this.scrollHeight / height,
                  this.scrollLeft / width,
                  this.scrollWidth / width
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
                const position = this.getPosition();
                const {x: px, y: py, w: pw, h: ph} = position;
                const {parent: {parent: {width, height}}} = this;

                return this.anchors.map(anchor => {
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

              scrollTo(scrollLeft = 0, scrollTop = 0) {
                this.scrollLeft = scrollLeft;
                this.scrollTop = scrollTop;
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
              constructor(x, y, w, h, st, sh, sl, sw) {
                this.x = x; // x position
                this.y = y; // y position
                this.w = w; // texture data width
                this.h = h; // texture data height
                this.st = st; // scroll top
                this.sh = sh; // scroll height
                this.sl = sl; // scroll left
                this.sw = sw; // scroll width
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

            const _applyPagePositions = (pages, pagePositions) => {
              for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const {x, y} = pagePositions[i];
                page.x = x;
                page.y = y;
              }
            };
            const _validatePages = pages => {
              for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                page.valid = true;
              }
            };
            const _invalidatePages = pages => {
              for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                page.valid = false;
              }
            };

            class Ui {
              constructor(width, height) {
                this.width = width;
                this.height = height;
              }

              getPages() {
                return pages;
              }

              getLayers() {
                const result = [];
                for (let i = 0; i < pages.length; i++) {
                  const page = pages[i];
                  const {layers} = page;
                  result.push.apply(result, layers);
                }
                return result;
              }

              setDimensions(width, height) {
                this.width = width;
                this.height = height;
              }

              pushPage(spec, {type = null, state = null, immediate = false} = {}, {preCb = () => {}, postCb = () => {}} = {}) {
                const page = new Page(this, spec, type);
                page.update(state, () => {
                  preCb();

                  pages.push(page);

                  postCb();
                });
              }

              popPage({immediate = false} = {}, {preCb = () => {}, postCb = () => {}} = {}) {
                preCb();

                pages.pop();

                postCb();
              }

              replacePage(layersSpec) {
                this.pushPage(layersSpec, {
                  immediate: true,
                }, {
                  preCb: () => {
                    this.popPage({
                      immediate: true,
                    });
                  }
                });
              }
            }

            const ui = new Ui(width, height);
            accept(ui);
          });
          const _getFonts = () => fonts;
          const _getMonospaceFonts = () => monospaceFonts;
          const _getFontWeight = () => fontWeight;
          const _getFontStyle = () => fontStyle;
          const _getTransparentImg = () => transparentImg;
          const _getMaxNumTextures = () => MAX_NUM_TEXTURES;

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
            depthWrite: false,
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
          const _applyStateKeyEvent = (state, fontSpec, e) => {
            const {inputText, inputIndex} = state;

            let change = false;
            let commit = false;

            if (_isPrintableKeycode(e.keyCode)) {
              state.inputText = inputText.slice(0, inputIndex) + _getKeyCode(e.keyCode) + inputText.slice(inputIndex);
              state.inputIndex++;
              state.inputValue = _getTextPropertiesFromIndex(state.inputText, fontSpec, state.inputIndex).px;

              change = true;
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

            if (change || commit) {
              return {
                change,
                commit,
              };
            } else {
              return null;
            }
          };

          const _makeMenuHoverState = () => ({
            intersectionPoint: null,
            scrollLayer: null,
            anchor: null,
            value: 0,
            mousedownScrollLayer: null,
            mousedownStartCoord: null,
            mousedownStartScrollTop: null,
          });
          const menuShader = menuShaders.getShader({maxNumTextures: MAX_NUM_TEXTURES});
          const _makeMenuMaterial = ({color = [1, 1, 1, 1]} = {}) => {
            const shaderUniforms = THREE.UniformsUtils.clone(menuShader.uniforms);
            shaderUniforms.textures.value = (() => {
              const result = Array(MAX_NUM_TEXTURES);
              for (let i = 0; i < MAX_NUM_TEXTURES; i++) {
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

                result[i] = texture;
              }
              return result;
            })();
            shaderUniforms.validTextures.value = (() => {
              const result = Array(MAX_NUM_TEXTURES);
              for (let i = 0; i < MAX_NUM_TEXTURES; i++) {
                result[i] = 0;
              }
              return result;
            })();
            shaderUniforms.texturePositions.value = (() => {
              const result = Array(2 * MAX_NUM_TEXTURES);
              for (let i = 0; i < MAX_NUM_TEXTURES; i++) {
                result[(i * 2) + 0] = 0;
                result[(i * 2) + 1] = 0;
              }
              return result;
            })();
            shaderUniforms.textureLimits.value = (() => {
              const result = Array(2 * MAX_NUM_TEXTURES);
              for (let i = 0; i < MAX_NUM_TEXTURES; i++) {
                result[(i * 2) + 0] = 0;
                result[(i * 2) + 1] = 0;
              }
              return result;
            })();
            shaderUniforms.textureOffsets.value = (() => {
              const result = Array(MAX_NUM_TEXTURES);
              for (let i = 0; i < MAX_NUM_TEXTURES; i++) {
                result[i] = 0;
              }
              return result;
            })();
            shaderUniforms.textureDimensions.value = (() => {
              const result = Array(MAX_NUM_TEXTURES);
              for (let i = 0; i < MAX_NUM_TEXTURES; i++) {
                result[i] = 0;
              }
              return result;
            })();
            const shaderMaterial = new THREE.ShaderMaterial({
              uniforms: shaderUniforms,
              vertexShader: menuShader.vertexShader,
              fragmentShader: menuShader.fragmentShader,
              side: THREE.DoubleSide,
              transparent: true,
            });
            shaderUniforms.backgroundColor.value = Float32Array.from(color);
            // shaderMaterial.polygonOffset = true;
            // shaderMaterial.polygonOffsetFactor = 1;
            return shaderMaterial;
          };

          const pointsHighlightMaterial = new THREE.PointsMaterial({
            color: 0xFF0000,
            size: 0.01,
          });
          const _makeMenuDotMesh = ({color = pointsHighlightMaterial.color, size = pointsHighlightMaterial.size} = {}) => {
            const geometry = new THREE.BufferGeometry();
            geometry.addAttribute('position', new THREE.BufferAttribute(Float32Array.from([0, 0, 0]), 3));
            geometry.addAttribute('color', new THREE.BufferAttribute(Float32Array.from([0, 0, 0]), 3));
            const material = (color === pointsHighlightMaterial.color && size === pointsHighlightMaterial.size) ? pointsHighlightMaterial : new THREE.PointsMaterial({
              color: color,
              size: size,
            });

            return new THREE.Points(geometry, material);
          };

          const wireframeHighlightMaterial = new THREE.MeshBasicMaterial({
            color: 0x0000FF,
            wireframe: true,
            opacity: 0.5,
            transparent: true,
          });
          const _makeMenuBoxMesh = () => {
            const geometry = new THREE.BoxBufferGeometry(1, 1, 1);

            const mesh = new THREE.Mesh(geometry, wireframeHighlightMaterial);
            mesh.visible = false;
            return mesh;
          };
          const _makeMeshPointGetter = ({position, rotation, width, height, worldWidth, worldHeight}) => (x, y, z) => position.clone()
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
              ).applyQuaternion(rotation)
            );
          const _makeMeshCoordinateGetter = ({position, rotation, width, height, worldWidth, worldHeight}) => {
            const _getMenuMeshPoint = _makeMeshPointGetter({position, rotation, width, height, worldWidth, worldHeight});

            return intersectionPoint => {
              const x = (() => {
                const horizontalLine = new THREE.Line3(
                  _getMenuMeshPoint(0, 0, 0),
                  _getMenuMeshPoint(width, 0, 0)
                );
                const closestHorizontalPoint = horizontalLine.closestPointToPoint(intersectionPoint, true);
                return horizontalLine.start.distanceTo(closestHorizontalPoint);
              })();
              const y = (() => {
                const verticalLine = new THREE.Line3(
                  _getMenuMeshPoint(0, 0, 0),
                  _getMenuMeshPoint(0, height, 0)
                );
                const closestVerticalPoint = verticalLine.closestPointToPoint(intersectionPoint, true);
                return verticalLine.start.distanceTo(closestVerticalPoint);
              })();
              return new THREE.Vector2(x, y);
            };
          };
          const _updateAnchors = ({
            objects,
            hoverState,
            dotMesh,
            boxMesh,
            controllerPosition,
            controllerRotation,
          }) => {
            const intersectionSpecs = objects.map(object => {
              const {matrixObject, worldWidth, worldHeight, worldDepth} = object;
              const {position, rotation, scale} = matrixObject;
              const controllerLine = (() => {
                if (controllerRotation) {
                  return new THREE.Line3(
                    controllerPosition.clone(),
                    controllerPosition.clone().add(new THREE.Vector3(0, 0, -1).applyQuaternion(controllerRotation).multiplyScalar(15))
                  );
                } else {
                  return new THREE.Line3(
                    controllerPosition.clone().add(new THREE.Vector3(0, 0, 1).applyQuaternion(rotation).multiplyScalar(worldDepth / 2)),
                    controllerPosition.clone().add(new THREE.Vector3(0, 0, -1).applyQuaternion(rotation).multiplyScalar(worldDepth / 2))
                  );
                }
              })();

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
                  distance,
                };
              } else {
                return null;
              }
            }).filter(intersectionSpec => intersectionSpec !== null);
            const intersectionSpec = intersectionSpecs.length > 0 ? intersectionSpecs.sort((a, b) => a.disance - b.distance)[0] : null;

            if (intersectionSpec) {
              const {object: {matrixObject: {position, rotation, scale}, ui, width, height, worldWidth, worldHeight, worldDepth}, intersectionPoint, controllerLine} = intersectionSpec;

              if (hoverState) {
                hoverState.intersectionPoint = intersectionPoint;
              }

              const _getMenuMeshPoint = _makeMeshPointGetter({
                position,
                rotation,
                width,
                height,
                worldWidth,
                worldHeight,
                worldDepth,
              });

              const scrollLayerBoxTargets = ui.getLayers()
                .filter(layer => layer.scroll)
                .map(layer => {
                  const rect = layer.getRect();
                  const scrollLayerBoxTarget = geometryUtils.makeBoxTargetOffset(
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
                  scrollLayerBoxTarget.layer = layer;
                  return scrollLayerBoxTarget;
                });
              const scrollLayerBoxTarget = (() => {
                for (let i = 0; i < scrollLayerBoxTargets.length; i++) {
                  const layerBoxTarget = scrollLayerBoxTargets[i];
                  if (layerBoxTarget.intersectLine(controllerLine)) {
                    return layerBoxTarget;
                  }
                }
                return null;
              })();
              if (hoverState) {
                hoverState.scrollLayer = scrollLayerBoxTarget ? scrollLayerBoxTarget.layer : null;
              }

              const anchorBoxTargets = (() => {
                const result = [];
                const layers = ui.getLayers();
                for (let i = 0; i < layers.length; i++) {
                  const layer = layers[i];
                  const anchors = layer.getAnchors();

                  for (let j = 0; j < anchors.length; j++) {
                    const anchor = anchors[j];
                    const {rect} = anchor;

                    const anchorBoxTarget = geometryUtils.makeBoxTargetOffset(
                      position,
                      rotation,
                      scale,
                      new THREE.Vector3(
                        -(worldWidth / 2) + ((rect.left + layer.scrollLeft) / width) * worldWidth,
                        (worldHeight / 2) + ((-rect.top + layer.scrollTop) / height) * worldHeight,
                        -worldDepth
                      ),
                      new THREE.Vector3(
                        -(worldWidth / 2) + ((rect.right + layer.scrollLeft) / width) * worldWidth,
                        (worldHeight / 2) + ((-rect.bottom + layer.scrollTop) / height) * worldHeight,
                        worldDepth
                      )
                    );
                    anchorBoxTarget.anchor = anchor;

                    result.push(anchorBoxTarget);
                  }
                }
                return result;
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
                if (hoverState) {
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
                }

                if (boxMesh) {
                  boxMesh.position.copy(anchorBoxTarget.position);
                  boxMesh.quaternion.copy(anchorBoxTarget.quaternion);
                  boxMesh.scale.set(Math.max(anchorBoxTarget.size.x, 0.001), Math.max(anchorBoxTarget.size.y, 0.001), Math.max(anchorBoxTarget.size.z, 0.001));
                  if (!boxMesh.visible) {
                    boxMesh.visible = true;
                  }
                }
              } else {
                if (hoverState) {
                  hoverState.anchor = null;
                  hoverState.value = 0;
                }

                if (boxMesh) {
                  if (boxMesh.visible) {
                    boxMesh.visible = false;
                  }
                }
              }

              if (dotMesh) {
                dotMesh.position.copy(intersectionPoint);

                if (!dotMesh.visible) {
                  dotMesh.visible = true;
                }
              }
            } else {
              if (hoverState) {
                hoverState.intersectionPoint = null;
                hoverState.scrollLayer = null;
                hoverState.anchor = null;
                hoverState.value = 0;
              }

              if (boxMesh) {
                if (boxMesh.visible) {
                  boxMesh.visible = false;
                }
              }
              if (dotMesh) {
                if (dotMesh.visible) {
                  dotMesh.visible = false;
                }
              }
            }
          };
          const _updateMenuMaterial = ({ui, menuMaterial, uiTime}) => {
            const {uniforms: {texture, textures, validTextures, texturePositions, textureLimits, textureOffsets, textureDimensions}} = menuMaterial;

            const layers = ui.getLayers();
            for (let i = 0; i < MAX_NUM_TEXTURES; i++) {
              const layer = i < layers.length ? layers[i] : null;

              if (layer && layer.getValid({uiTime})) {
                validTextures.value[i] = 1;

                const texture = textures.value[i];
                if (texture.image !== layer.img || layer.img.needsUpdate) {
                  texture.image = layer.img;
                  if (!layer.pixelated) {
                    texture.minFilter = THREE.LinearFilter;
                    texture.magFilter = THREE.LinearFilter;
                    texture.anisotropy = 16;
                  } else {
                    texture.minFilter = THREE.NearestFilter;
                    texture.magFilter = THREE.NearestFilter;
                    texture.anisotropy = 1;
                  }
                  texture.needsUpdate = true;

                  layer.img.needsUpdate = false;
                }

                const position = layer.getPosition();
                texturePositions.value[(i * 2) + 0] = position.x;
                texturePositions.value[(i * 2) + 1] = position.y;
                textureLimits.value[(i * 2) + 0] = position.w;
                textureLimits.value[(i * 2) + 1] = position.h;
                textureOffsets.value[i] = position.st;
                textureDimensions.value[i] = position.sh;
              } else {
                validTextures.value[i] = 0;
              }
            }
          };

          return {
            requestUi: _requestUi,
            getFonts: _getFonts,
            getMonospaceFonts: _getMonospaceFonts,
            getFontWeight: _getFontWeight,
            getFontStyle: _getFontStyle,
            getTransparentImg: _getTransparentImg,
            getMaxNumTextures: _getMaxNumTextures,

            getTransparentMaterial: _getTransparentMaterial,
            getSolidMaterial: _getSolidMaterial,

            getTextPropertiesFromCoord: _getTextPropertiesFromCoord,
            getTextPropertiesFromIndex: _getTextPropertiesFromIndex,
            getKeyCode: _getKeyCode,
            applyStateKeyEvent: _applyStateKeyEvent,

            makeMenuHoverState: _makeMenuHoverState,
            makeMenuMaterial: _makeMenuMaterial,
            makeMenuDotMesh: _makeMenuDotMesh,
            makeMenuBoxMesh: _makeMenuBoxMesh,
            makeMeshPointGetter: _makeMeshPointGetter,
            makeMeshCoordinateGetter: _makeMeshCoordinateGetter,

            updateAnchors: _updateAnchors,
            updateMenuMaterial: _updateMenuMaterial,
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

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

module.exports = Biolumi;
