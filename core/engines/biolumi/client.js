const FontFaceObserver = require('fontfaceobserver');

const WIDTH = 1024;
const HEIGHT = WIDTH * 1.5;

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

    const _push = page => {
      // XXX
      _refresh();
    };
    const _pop = () => {
      // XXX
      _refresh();
    };
    const _clear = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    const _refreshPage = () => {
      _drawInput(ctx, {
        x: 50,
        y: 100,
        width: WIDTH - (50 * 2),
        height: 100,
        value: 'Biolumi',
      });

      _drawButton(ctx, {
        x: 50,
        y: 200,
        width: 200,
        height: 100,
        value: 'Submit',
      });

      _drawSlider(ctx, {
        x: 50,
        y: 300,
        width: WIDTH - (50 * 2),
        height: 100,
        valueWidth: 120,
        value: 100,
      });

      _drawUnitBox(ctx, {
        x: 50,
        y: 400,
        width: 100,
        height: 100,
        valueWidth: 160,
        value: 100,
      });
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

const _drawInput = (ctx, {x, y, width, height, value}) => {
  ctx.fillStyle = '#CCC';
  ctx.fillRect(x, y + height * 0.1, width, height * 0.8);

  ctx.font = (height * 0.6) + 'px \'Titillium Web\'';
  ctx.fillStyle = '#333333';
  ctx.fillText(value, x, y + height * 0.75);
};

const _drawButton = (ctx, {x, y, width, height, value}) => {
  ctx.beginPath()
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 5;
  ctx.rect(x, y + height * 0.1, width, height * 0.8);
  ctx.stroke();

  ctx.font = (height * 0.5) + 'px \'Titillium Web\'';
  ctx.fillStyle = '#333333';
  ctx.fillText(value, x + width * 0.1, y + height * 0.7);
};

const _drawSlider = (ctx, {x, y, width, height, valueWidth, value}) => {
  ctx.beginPath()
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = 5;
  ctx.moveTo(x, y + height / 2);
  ctx.lineTo(x + width - valueWidth, y + height / 2);
  ctx.stroke();

  ctx.beginPath()
  ctx.strokeStyle = '#FF0000';
  ctx.lineWidth = 5;
  ctx.moveTo(x, y + height * 0.25);
  ctx.lineTo(x, y + height * 0.75);
  ctx.stroke();

  ctx.font = (height * 0.6) + 'px \'Titillium Web\'';
  ctx.fillStyle = '#333333';
  ctx.fillText(value, x + width - valueWidth * 0.9, y + height * 0.7);
};

const _drawUnitBox = (ctx, {x, y, width, height, valueWidth, value}) => {
  ctx.font = (height * 0.8) + 'px \'Titillium Web\'';
  ctx.fillStyle = '#333333';
  ctx.fillText(value, x, y + height * 0.75);

  ctx.beginPath()
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 5;
  ctx.moveTo(x + valueWidth + 0, y + height * 0.4);
  ctx.lineTo(x + valueWidth + 20, y + height * 0.2);
  ctx.moveTo(x + valueWidth + 20, y + height * 0.2);
  ctx.lineTo(x + valueWidth + 40, y + height * 0.4);
  ctx.moveTo(x + valueWidth + 0, y + height * 0.6);
  ctx.lineTo(x + valueWidth + 20, y + height * 0.8);
  ctx.moveTo(x + valueWidth + 20, y + height * 0.8);
  ctx.lineTo(x + valueWidth + 40, y + height * 0.6);
  ctx.stroke();
};

const _drawCursor = (ctx, {x, y}) => {
  ctx.fillStyle = '#000000';
  ctx.fillRect((x - 2) * window.devicePixelRatio, (y - 2) * window.devicePixelRatio, 4 * window.devicePixelRatio, 4 * window.devicePixelRatio);
};

module.exports = client;
