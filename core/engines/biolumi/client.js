const FontFaceObserver = require('fontfaceobserver');

const WIDTH = 1024;
const HEIGHT = WIDTH * 1.5;

const MARGIN = 80;
const PADDING = 20;
const HEADER_HEIGHT = 100;
const LABEL_HEIGHT = 50;
const INPUT_HEIGHT = 100;
const LINK_HEIGHT = 150;

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
        const next = _drawHeader(ctx, {img, text});
        let {offset} = next;

        for (let i = 0; i < body.length; i++) {
          const section = body[i];
          const {type, label, value} = section;

          const _maybeDrawInputLabel = () => {
            if (label) {
              const next = _drawInputLabel(ctx, {offset, label});
              offset = next.offset;
            }
          };

          switch (type) {
            case 'input': {
              _maybeDrawInputLabel();

              const next = _drawInput(ctx, {
                offset,
                value,
              });
              offset = next.offset;
              break;
            }
            case 'text': {
              _maybeDrawInputLabel();

              const next = _drawText(ctx, {
                offset,
                value,
              });
              offset = next.offset;
              break;
            }
            case 'button': {
              _maybeDrawInputLabel();

              const next = _drawButton(ctx, {
                offset,
                value,
              });
              offset = next.offset;
              break;
            }
            case 'slider': {
              _maybeDrawInputLabel();

              const next =_drawSlider(ctx, {
                offset,
                value,
              });
              offset = next.offset;
              break;
            }
            case 'unitbox': {
              _maybeDrawInputLabel();

              const next = _drawUnitBox(ctx, {
                offset,
                value,
              });
              offset = next.offset;
              break;
            }
            case 'link': {
              const next = _drawLink(ctx, {
                offset,
                value,
              });
              offset = next.offset;
              break;
            }
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
  ctx.beginPath();
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 5;
  ctx.moveTo((MARGIN / 2) - (PADDING / 2), HEADER_HEIGHT * 0.5);
  ctx.lineTo((MARGIN / 2) + (PADDING / 2), HEADER_HEIGHT * 0.25);
  ctx.moveTo((MARGIN / 2) - (PADDING / 2), HEADER_HEIGHT * 0.5);
  ctx.lineTo((MARGIN / 2) + (PADDING / 2), HEADER_HEIGHT * 0.75);
  ctx.stroke();

  const imageSize = HEADER_HEIGHT;
  const imageData = _scaleImageData(img, {
    width: imageSize,
    height: imageSize,
  });
  ctx.drawImage(imageData, MARGIN, 0, imageSize, imageSize);

  ctx.font = (HEADER_HEIGHT * 0.8) + 'px \'Titillium Web\'';
  ctx.fillStyle = '#333333';
  ctx.fillText(text, MARGIN + imageSize + PADDING, HEADER_HEIGHT * 0.8);

  ctx.beginPath();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.moveTo(0, HEADER_HEIGHT);
  ctx.lineTo(WIDTH, HEADER_HEIGHT);
  ctx.stroke();

  return {
    offset: HEADER_HEIGHT,
  };
};

const _drawInput = (ctx, {offset, label, value}) => {
  const x = MARGIN;
  const y = offset;

  ctx.fillStyle = '#CCC';
  ctx.fillRect(x, y + INPUT_HEIGHT * 0.1, WIDTH - (MARGIN * 2), INPUT_HEIGHT * 0.8);

  ctx.font = (INPUT_HEIGHT * 0.6) + 'px \'Titillium Web\'';
  ctx.fillStyle = '#333333';
  ctx.fillText(value, x + PADDING, y + INPUT_HEIGHT * 0.75);

  offset += INPUT_HEIGHT;

  _drawInputSeparator(ctx, {offset});

  return {
    offset,
  };
};

const _drawText = (ctx, {offset, value}) => {
  const maxWidth = WIDTH - (MARGIN * 2);
  const offsetStep = INPUT_HEIGHT * 0.4;

  ctx.font = (INPUT_HEIGHT * 0.3) + 'px \'Titillium Web\'';
  ctx.fillStyle = '#333333';

  const lines = value.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/\S/.test(line)) {
      const words = line.split(' ');

      let acc = '';
      const _flushLine = () => {
        const {width} = ctx.measureText(value);

        ctx.fillText(acc, MARGIN, offset + INPUT_HEIGHT * 0.4);

        offset += offsetStep;
        acc = '';
      };
      while (words.length > 0) {
        const word = words[0];

        const candidateAcc = acc + (acc ? ' ' : '') + word;
        const {width} = ctx.measureText(candidateAcc);
        if (width < maxWidth || !acc) {
          acc = candidateAcc;

          words.shift();
        } else {
          _flushLine();
        }
      }
      if (acc) {
        _flushLine();
      }
    } else {
      offset += offsetStep;
    }
  }

  offset += offsetStep;

  _drawInputSeparator(ctx, {offset});

  return {
    offset,
  };
};

const _drawButton = (ctx, {offset, value}) => {
  const x = MARGIN;
  const y = offset;

  ctx.font = (INPUT_HEIGHT * 0.4) + 'px \'Titillium Web\'';
  ctx.fillStyle = '#333333';
  const metrics = ctx.measureText(value);

  ctx.beginPath();
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 5;
  ctx.rect(x, y + INPUT_HEIGHT * 0.1, (PADDING * 2) + metrics.width, INPUT_HEIGHT * 0.7);
  ctx.stroke();

  ctx.fillText(value, x + PADDING, y + INPUT_HEIGHT * 0.6);

  offset += INPUT_HEIGHT;

  _drawInputSeparator(ctx, {offset});

  return {
    offset,
  };
};

const _drawSlider = (ctx, {offset, value}) => {
  const x = MARGIN;
  const y = offset;

  ctx.font = (INPUT_HEIGHT * 0.6) + 'px \'Titillium Web\'';
  ctx.fillStyle = '#333333';
  const metrics = ctx.measureText(value);

  ctx.beginPath();
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = 5;
  ctx.moveTo(x, y + INPUT_HEIGHT / 2);
  ctx.lineTo(WIDTH - (MARGIN + PADDING + metrics.width), y + INPUT_HEIGHT / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = '#FF0000';
  ctx.lineWidth = 5;
  ctx.moveTo(x, y + INPUT_HEIGHT * 0.25);
  ctx.lineTo(x, y + INPUT_HEIGHT * 0.75);
  ctx.stroke();

  ctx.fillText(value, WIDTH - (MARGIN + metrics.width), y + INPUT_HEIGHT * 0.7);

  offset += INPUT_HEIGHT;

  _drawInputSeparator(ctx, {offset});

  return {
    offset,
  };
};

const _drawUnitBox = (ctx, {offset, value}) => {
  const x = MARGIN;
  const y = offset;

  ctx.font = (INPUT_HEIGHT * 0.8) + 'px \'Titillium Web\'';
  ctx.fillStyle = '#333333';
  const metrics = ctx.measureText(value);

  ctx.fillText(value, x, y + INPUT_HEIGHT * 0.75);

  ctx.beginPath();
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 5;
  ctx.moveTo(x + metrics.width + PADDING + 0, y + INPUT_HEIGHT * 0.4);
  ctx.lineTo(x + metrics.width + PADDING + 20, y + INPUT_HEIGHT * 0.2);
  ctx.moveTo(x + metrics.width + PADDING + 20, y + INPUT_HEIGHT * 0.2);
  ctx.lineTo(x + metrics.width + PADDING + 40, y + INPUT_HEIGHT * 0.4);
  ctx.moveTo(x + metrics.width + PADDING + 0, y + INPUT_HEIGHT * 0.6);
  ctx.lineTo(x + metrics.width + PADDING + 20, y + INPUT_HEIGHT * 0.8);
  ctx.moveTo(x + metrics.width + PADDING + 20, y + INPUT_HEIGHT * 0.8);
  ctx.lineTo(x + metrics.width + PADDING + 40, y + INPUT_HEIGHT * 0.6);
  ctx.stroke();

  offset += INPUT_HEIGHT;

  _drawInputSeparator(ctx, {offset});

  return {
    offset,
  };
};

const _drawLink = (ctx, {offset, value}) => {
  const x = MARGIN;
  const y = offset;

  ctx.font = (INPUT_HEIGHT * 0.8) + 'px \'Titillium Web\'';
  ctx.fillStyle = '#333333';
  ctx.fillText(value, MARGIN, y + LINK_HEIGHT * 0.675);

  ctx.beginPath();
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 5;
  ctx.moveTo(WIDTH - MARGIN - PADDING, y + LINK_HEIGHT * 0.3);
  ctx.lineTo(WIDTH - MARGIN, y + LINK_HEIGHT * 0.5);
  ctx.moveTo(WIDTH - MARGIN, y + LINK_HEIGHT * 0.5);
  ctx.lineTo(WIDTH - MARGIN - PADDING, y + LINK_HEIGHT * 0.7);
  ctx.stroke();

  offset += LINK_HEIGHT;

  _drawInputSeparator(ctx, {offset});

  return {
    offset,
  };
};

const _drawInputLabel = (ctx, {offset, label}) => {
  const x = MARGIN / 2;
  const y = offset;

  ctx.font = (LABEL_HEIGHT * 0.6) + 'px \'Titillium Web\'';
  ctx.fillStyle = '#333333';
  ctx.fillText(label, x, y + LABEL_HEIGHT * 0.9);

  return {
    offset: offset + LABEL_HEIGHT,
  };
};

const _drawInputSeparator = (ctx, {offset}) => {
  const y = offset;

  ctx.beginPath();
  ctx.strokeStyle = '#808080';
  ctx.lineWidth = 1;
  ctx.moveTo(0, y);
  ctx.lineTo(WIDTH, y);
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
