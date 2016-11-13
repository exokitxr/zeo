const FontFaceObserver = require('fontfaceobserver');

const WIDTH = 1024;
const HEIGHT = WIDTH * 1.5;

const MARGIN = 80;
const PADDING = 20;
const SLICE_HEIGHT = 100;

const client = () => ({
  mount() {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    canvas.style.width = (WIDTH / window.devicePixelRatio) + 'px';
    canvas.style.height = (HEIGHT / window.devicePixelRatio) + 'px';
    canvas.style.cursor = 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4AsGEDMxMbgZlQAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAFUlEQVQI12NkYGD4z4AEmBjQAGEBAEEUAQeL0gY8AAAAAElFTkSuQmCC") 2 2, auto';
    const ctx = canvas.getContext('2d');
    let loaded = false;
    let queue = [];

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css?family=Titillium+Web:200,200i,300,300i,400,400i,600,600i,700,700i';
    document.head.appendChild(link);

    new FontFaceObserver('Titillium Web', {
      weight: 400,
    }).load()
      .then(() => {
        if (live) {
          loaded = true;
          if (queue.length > 0) {
            for (let i = 0; i < queue.length; i++) {
              const entry = queue[i];
              const {type} = entry;

              if (type === 'push') {
                const {page} = entry;
                _push(page);
              } else if (type === 'pop') {
                _pop();
              }
            }
            queue = [];
          }

          document.body.appendChild(canvas);
          this._cleanup = () => {
            document.body.removeChild(canvas);
          };
        }
      })
      .catch(err => {
        if (live) {
          console.warn(err);
        }
      });

    const pages = [];
    const _push = page => {
      pages.push(page);

      _refresh();
    };
    const _pop = () => {
      pages.pop();

      _refresh();
    };
    const _clear = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    const _refreshPage = () => {
      if (pages.length > 0) {
        const lastPage = pages[pages.length - 1];
        const {header, body} = lastPage;

        const {img, text} = header;
        _drawHeader(ctx, {img, text});

        for (let i = 0; i < body.length; i++) {
          const section = body[i];
          const {type, value} = section;

          switch (type) {
            case 'input':
              _drawInput(ctx, {
                index: i + 1,
                value,
              });
              break;
            case 'button':
              _drawButton(ctx, {
                index: i + 1,
                value,
              });
              break;
            case 'slider':
              _drawSlider(ctx, {
                index: i + 1,
                value,
              });
              break;
            case 'unitbox':
              _drawUnitBox(ctx, {
                index: i + 1,
                value,
              });
              break;
          }
        }
      }
    };
    const _refreshCursors = () => {
      for (let i = 0; i < cursors.length; i++) {
        const cursor = cursors[i];
        const {position: {x, y}} = cursor;
        _drawCursor(ctx, {x, y});
      }
    };
    const _refresh = () => {
      _clear();
      _refreshPage();
      _refreshCursors();
    };

    const cursors = [];
    class Cursor {
      constructor() {
        this.position = {
          x: 0,
          y: 0,
        };
      }

      setPosition(x, y) {
        this.position.x = x;
        this.position.y = y;

        _refresh();
      }

      remove() {
        cursors.splice(cursors.indexOf(this), 1);

        _refresh();
      }
    }

    return {
      push(page) {
        if (loaded) {
          _push(page);
        } else {
          queue.push({
            type: 'push',
            page: page,
          });
        }
      },
      pop() {
        if (loaded) {
          _pop();
        } else {
          queue.push({
            type: 'pop'
          });
        }
      },
      getForm() {
        return canvas;
      },
      addCursor() {
        const cursor = new Cursor();
        cursors.push(cursor);
        return cursor;
      },
    };
  },
  unmount() {
    this._cleanup();
  },
});

const _drawHeader = (ctx, {img, text}) => {
  ctx.beginPath()
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 5;
  ctx.moveTo((MARGIN / 2) - (PADDING / 2), SLICE_HEIGHT * 0.5);
  ctx.lineTo((MARGIN / 2) + (PADDING / 2), SLICE_HEIGHT * 0.25);
  ctx.moveTo((MARGIN / 2) - (PADDING / 2), SLICE_HEIGHT * 0.5);
  ctx.lineTo((MARGIN / 2) + (PADDING / 2), SLICE_HEIGHT * 0.75);
  ctx.stroke();

  const imageSize = SLICE_HEIGHT;
  const imageData = _scaleImageData(img, {
    width: imageSize,
    height: imageSize,
  });
  ctx.drawImage(imageData, MARGIN, 0, imageSize, imageSize);

  ctx.font = (SLICE_HEIGHT * 0.8) + 'px \'Titillium Web\'';
  ctx.fillStyle = '#333333';
  ctx.fillText(text, MARGIN + imageSize + PADDING, SLICE_HEIGHT * 0.8);

  ctx.beginPath()
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.moveTo(0, SLICE_HEIGHT);
  ctx.lineTo(WIDTH, SLICE_HEIGHT);
  ctx.stroke();
};

const _drawInput = (ctx, {index, value}) => {
  const x = MARGIN;
  const y = SLICE_HEIGHT * index;

  ctx.fillStyle = '#CCC';
  ctx.fillRect(x, y + SLICE_HEIGHT * 0.1, WIDTH - (MARGIN * 2), SLICE_HEIGHT * 0.8);

  ctx.font = (SLICE_HEIGHT * 0.6) + 'px \'Titillium Web\'';
  ctx.fillStyle = '#333333';
  ctx.fillText(value, x + PADDING, y + SLICE_HEIGHT * 0.75);
};

const _drawButton = (ctx, {index, value}) => {
  const x = MARGIN;
  const y = SLICE_HEIGHT * index;

  ctx.font = (SLICE_HEIGHT * 0.5) + 'px \'Titillium Web\'';
  ctx.fillStyle = '#333333';
  const metrics = ctx.measureText(value);

  ctx.beginPath()
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 5;
  ctx.rect(x, y + SLICE_HEIGHT * 0.1, /*(5 * 2) + */(PADDING * 2) + metrics.width, SLICE_HEIGHT * 0.8);
  ctx.stroke();

  ctx.fillText(value, x + PADDING, y + SLICE_HEIGHT * 0.7);
};

const _drawSlider = (ctx, {index, value}) => {
  const x = MARGIN;
  const y = SLICE_HEIGHT * index;

  ctx.font = (SLICE_HEIGHT * 0.6) + 'px \'Titillium Web\'';
  ctx.fillStyle = '#333333';
  const metrics = ctx.measureText(value);

  ctx.beginPath()
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = 5;
  ctx.moveTo(x, y + SLICE_HEIGHT / 2);
  ctx.lineTo(WIDTH - (MARGIN + PADDING + metrics.width), y + SLICE_HEIGHT / 2);
  ctx.stroke();

  ctx.beginPath()
  ctx.strokeStyle = '#FF0000';
  ctx.lineWidth = 5;
  ctx.moveTo(x, y + SLICE_HEIGHT * 0.25);
  ctx.lineTo(x, y + SLICE_HEIGHT * 0.75);
  ctx.stroke();

  ctx.fillText(value, WIDTH - (MARGIN + metrics.width), y + SLICE_HEIGHT * 0.7);
};

const _drawUnitBox = (ctx, {index, value}) => {
  const x = MARGIN;
  const y = SLICE_HEIGHT * index;

  ctx.font = (SLICE_HEIGHT * 0.8) + 'px \'Titillium Web\'';
  ctx.fillStyle = '#333333';
  const metrics = ctx.measureText(value);

  ctx.fillText(value, x, y + SLICE_HEIGHT * 0.75);

  ctx.beginPath()
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 5;
  ctx.moveTo(x + metrics.width + PADDING + 0, y + SLICE_HEIGHT * 0.4);
  ctx.lineTo(x + metrics.width + PADDING + 20, y + SLICE_HEIGHT * 0.2);
  ctx.moveTo(x + metrics.width + PADDING + 20, y + SLICE_HEIGHT * 0.2);
  ctx.lineTo(x + metrics.width + PADDING + 40, y + SLICE_HEIGHT * 0.4);
  ctx.moveTo(x + metrics.width + PADDING + 0, y + SLICE_HEIGHT * 0.6);
  ctx.lineTo(x + metrics.width + PADDING + 20, y + SLICE_HEIGHT * 0.8);
  ctx.moveTo(x + metrics.width + PADDING + 20, y + SLICE_HEIGHT * 0.8);
  ctx.lineTo(x + metrics.width + PADDING + 40, y + SLICE_HEIGHT * 0.6);
  ctx.stroke();
};

const _drawCursor = (ctx, {x, y}) => {
  ctx.fillStyle = '#000000';
  ctx.fillRect((x - 2) * window.devicePixelRatio, (y - 2) * window.devicePixelRatio, 4 * window.devicePixelRatio, 4 * window.devicePixelRatio);
};

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
};

module.exports = client;
