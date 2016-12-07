const FontFaceObserver = require('fontfaceobserver');
const BezierEasing = require('bezier-easing');

const bezierEasing = BezierEasing(0, 1, 0, 1);

const TRANSITION_TIME = 300;

/* const dotCursorCss = 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4AsGEDMxMbgZlQAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAFUlEQVQI12NkYGD4z4AEmBjQAGEBAEEUAQeL0gY8AAAAAElFTkSuQmCC") 2 2, auto'; */

const transparentImgUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const FONTS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"';

class Biolumi {
  mount() {
    /* const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    canvas.style.width = (WIDTH / window.devicePixelRatio) + 'px';
    canvas.style.height = (HEIGHT / window.devicePixelRatio) + 'px';
    const ctx = canvas.getContext('2d'); */

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
                this.img = null;
                this.anchors = [];
                this.valid = true;
                this.x = 0;
                this.y = 0;
              }
            }

            class Anchor {
              constructor(rect, onclick) {
                this.rect = rect;
                this.onclick = onclick;
              }
            }

            let animation = null;
            const _animate = ({pages, direction}) => {
              if (animation) {
                animation.cancel();
                animation = null;
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

                  _recurse();
                });
              };
              const _cancel = () => {
                const endPagePositions = pageSchedule.map(pageScheduleSpec => {
                  const {end} = pageScheduleSpec;
                  return {
                    x: end,
                    y: 0,
                  };
                });

                _applyPagePositions(pages, endPagePositions);

                clearAnimationFrame(animationFrame);
                animationFrame = null;
              }
              animation = {
                cancel: _cancel,
              };
            };

            const _getPages = () => pages;
            const _pushPage = ({src}) => {
              const rootCss = 'margin: 0px; padding: 0px; height: 100%; width: 100%; font-family: ' + FONTS + '; font-weight: 300; overflow: hidden; user-select: none;';

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
                page.img = img;
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

              const page = new Page();
              page.img = transparentImg;
              page.anchors = anchors;
              pages.push(page);
            };

            accept({
              getPages: _getPages,
              pushPage: _pushPage,
            });
          });
          const _getTransparentImg = () => transparentImg;

          return {
            requestUi: _requestUi,
            getTransparentImg: _getTransparentImg,
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
