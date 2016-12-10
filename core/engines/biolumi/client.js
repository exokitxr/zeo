const FontFaceObserver = require('fontfaceobserver');
const BezierEasing = require('bezier-easing');

const bezierEasing = BezierEasing(0, 1, 0, 1);

const MAX_NUM_TEXTURES = 16;
const TRANSITION_TIME = 1000;

const transparentImgUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const fonts = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"';

class Biolumi {
  mount() {
    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const _requestFont = () => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css?family=Open+Sans:300,400,600,700,800';
      document.head.appendChild(link);

      return new FontFaceObserver('Open Sans', {
        weight: 400,
      }).load();
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
      _requestFont(),
      _requestTransparentImg(),
    ])
      .then(([
        font,
        transparentImg,
      ]) => {
        if (live) {
          const _requestUi = ({width, height}) => new Promise((accept, reject) => {
            const pages = [];

            class Page {
              constructor() {
                this.layers = [];

                this.x = 0;
                this.y = 0;
              }
            }

            class Layer {
              constructor(parent) {
                this.parent = parent;

                this.img = null;
                this.anchors = [];

                this.x = 0;
                this.y = 0;
                this.w = width;
                this.h = height;
                this.numFrames = 1;
                this.frameIndex = 0;
                this.frameTime = 0;
              }

              getValid({worldTime}) {
                const {numFrames} = this;

                if (numFrames > 1) {
                  const {parent, frameIndex, frameTime} = this;
                  const currentFrameIndex = Math.floor(worldTime / frameTime) % numFrames;
                  return currentFrameIndex === frameIndex;
                } else {
                  return true; // XXX optimize this
                }
              }

              getPosition() {
                const {parent} = this;

                return new Position(
                  parent.x + (this.x / width),
                  parent.y + (this.y / height),
                  this.w / width,
                  this.h / height
                );
              }

              getAnchors() {
                const position = this.getPosition();
                const px = position.x * width;
                const py = position.y * height;

                const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

                return this.anchors.map(anchor => {
                  const {rect, onclick} = anchor;
                  const {top, bottom, left, right} = rect;

                  return new Anchor(
                    new Rect(
                      clamp(py + top, 0, height),
                      clamp(py + bottom, 0, height),
                      clamp(px + left, 0, width),
                      clamp(px + right, 0, width)
                    ),
                    onclick
                  );
                });
              }
            }

            class Anchor {
              constructor(rect, onclick) {
                this.rect = rect;
                this.onclick = onclick;
              }
            }

            class Position {
              constructor(x, y, w, h) {
                this.x = x;
                this.y = y;
                this.w = w;
                this.h = h;
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

            let transition = null;
            const _transition = ({pages, direction}, cb = () => {}) => {
              if (transition) {
                transition.cancel();
                transition = null;
              }

              let animationFrame = null;
              const startTime = Date.now();
              const endTime = startTime + TRANSITION_TIME;
              const pageSchedule = (() => {
                if (direction === 'right') {
                  return [
                    {
                      start: 0,
                      end: -1,
                    },
                    {
                      start: 1,
                      end: 0,
                    },
                  ];
                } else if (direction === 'left') {
                  return [
                    {
                      start: -1,
                      end: 0,
                    },
                    {
                      start: 0,
                      end: 1,
                    },
                  ];
                } else {
                  return null;
                }
              })();
              const _applyPagePositions = (pages, pagePositions) => {
                for (let i = 0; i < pages.length; i++) {
                  const page = pages[i];
                  const {x, y} = pagePositions[i];
                  page.x = x;
                  page.y = y;
                }
              };
              const _recurse = () => {
                animationFrame = requestAnimationFrame(() => {
                  animationFrame = null;

                  const now = Date.now();
                  const timeFactor = bezierEasing(Math.max(Math.min((now - startTime) / (endTime - startTime), 1), 0));
                  const pagePositions = pageSchedule.map(pageScheduleSpec => {
                    const {start, end} = pageScheduleSpec;

                    return {
                      x: start + (timeFactor * (end - start)),
                      y: 0,
                    };
                  });

                  _applyPagePositions(pages, pagePositions);

                  if (timeFactor < 1) {
                    _recurse();
                  } else {
                    cb();
                  }
                });
              };
              _recurse();

              const _cancel = () => {
                if (animationFrame) {
                  const endPagePositions = pageSchedule.map(pageScheduleSpec => {
                    const {end} = pageScheduleSpec;
                    return {
                      x: end,
                      y: 0,
                    };
                  });

                  _applyPagePositions(pages, endPagePositions);

                  cancelAnimationFrame(animationFrame);
                  animationFrame = null;

                  cb();
                }
              };
              transition = {
                cancel: _cancel,
              };
            };

            const _getPages = () => pages;
            const _getLayers = () => {
              const result = [];
              for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const {layers} = page;
                result.push.apply(result, layers);
              }
              return result;
            };
            const _pushPage = layersSpec => {
              const page = new Page();
              const {layers} = page;

              const done = () => {
                pages.push(page);

                if (pages.length > 1) {
                  _transition({
                    pages: pages.slice(-2),
                    direction: 'right',
                  });
                }
              };

              if (layersSpec.length > 0) {
                let pending = layersSpec.length;
                const pend = () => {
                  if (--pending === 0) {
                    done();
                  }
                };

                for (let i = 0; i < layersSpec.length; i++) {
                  const layerSpec = layersSpec[i];
                  const {type} = layerSpec;
                    
                  if (type === 'html') {
                    const {src} = layerSpec;

                    const rootCss = 'margin: 0px; padding: 0px; height: 100%; width: 100%; font-family: ' + fonts + '; font-weight: 300; overflow: hidden; user-select: none;';
                    const img = new Image();
                    img.src = 'data:image/svg+xml;charset=utf-8,' +
                    '<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'' + width + '\' height=\'' + height + '\'>' +
                      '<foreignObject width=\'100%\' height=\'100%\' x=\'0\' y=\'0\'>' +
                        '<div xmlns="http://www.w3.org/1999/xhtml" style=\'' + rootCss + '\'>' +
                          src +
                        '</div>' +
                      '</foreignObject>' +
                    '</svg>';
                    img.onload = () => {
                      layer.img = img;

                      pend();
                    };
                    img.onerror = err => {
                      console.warn('biolumi image load error', err);
                    };

                    const anchors = (() => {
                      const el = document.createElement('div');
                      el.style.cssText = 'position: absolute; top: 0; left: 0; width: ' + width + 'px; height: ' + height + 'px;';
                      el.innerHTML = '<div style=\'' + rootCss + '\'>' + src + '</div>';

                      const as = el.querySelectorAll('a');
                      const numAs = as.length;
                      const result = Array(numAs);
                      if (numAs > 0) {
                        document.body.appendChild(el);

                        for (let i = 0; i < numAs; i++) {
                          const a = as[i];

                          const rect = a.getBoundingClientRect();
                          const onclick = a.getAttribute('onclick');

                          const anchor = new Anchor(rect, onclick);
                          result[i] = anchor;
                        }

                        document.body.removeChild(el);
                      }

                      return result;
                    })();

                    const layer = new Layer(page);
                    layer.anchors = anchors;
                    layers.push(layer);
                  } else if (type === 'image') {
                    let {img: imgs} = layerSpec;
                    if (!Array.isArray(imgs)) {
                      imgs = [imgs];
                    }
                    const {x = 0, y = 0, w = width, h = height, frameTime = 300} = layerSpec;

                    setTimeout(pend);

                    for (let j = 0; j < imgs.length; j++) {
                      const img = imgs[j];

                      const layer = new Layer(page);
                      layer.img = img;
                      layer.x = x;
                      layer.y = y;
                      layer.w = w;
                      layer.h = h;
                      layer.numFrames = imgs.length;
                      layer.frameIndex = j;
                      layer.frameTime = frameTime;
                      layers.push(layer);
                    }
                  } else {
                    throw new Error('unknown layer type: ' + type);
                  }
                }
              }
            };
            const _popPage = () => {
              if (pages.length > 1) {
                _transition({
                  pages: pages.slice(-2),
                  direction: 'left',
                }, () => {
                  pages.pop();
                });
              } else {
                pages.pop();
              }
            };
            const _cancelTransition = () => {
              if (transition) {
                transition.cancel();
                transition = null;
              }
            };

            accept({
              getPages: _getPages,
              getLayers: _getLayers,
              pushPage: _pushPage,
              popPage: _popPage,
              cancelTransition: _cancelTransition,
            });
          });
          const _getTransparentImg = () => transparentImg;
          const _getMaxNumTextures = () => MAX_NUM_TEXTURES;

          return {
            requestUi: _requestUi,
            getTransparentImg: _getTransparentImg,
            getMaxNumTextures: _getMaxNumTextures,
          };
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

/* const _isMultiFrameImage = img => Array.isArray(img);
const _getCurrentImageFrameIndex = img => Math.floor(((Date.now() % ANIMATION_TIME) / ANIMATION_TIME) * img.length);

const _scaleImageData = (imageData, {width, height}) => {
  const sideCanvas = document.createElement('canvas');
  sideCanvas.width = imageData.width;
  sideCanvas.height = imageData.height;
  const sideCtx = sideCanvas.getContext('2d');
  sideCtx.imageSmoothingEnabled = false;
  sideCtx.putImageData(imageData, 0, 0);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sideCanvas, 0, 0, width, height);

  return canvas;
}; */

module.exports = Biolumi;
