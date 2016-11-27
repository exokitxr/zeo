const htermAll = require('./lib/wetty/hterm_all');
const {hterm, lib} = htermAll;
const io = require('./node_modules/socket.io-client/dist/socket.io.js');

hterm.defaultStorage = new lib.Storage.Local();
lib.ensureRuntimeDependencies_ = () => {}; // HACK: elide the check, because it just checks for globals exposure

class Shell {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return archae.requestEngines([
      '/core/engines/zeo',
    ]).then(([
      zeo,
    ]) => {
      if (live) {
        const canvas = _connect();

        window.document.body.appendChild(canvas);
      }
    });
  }
}

const _connect = () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;

  let lastSrc = '';
  let lastDimensions = [window.innerWidth, window.innerHeight];
  const _render = (src, dimensions, cb) => {
    if (src !== lastSrc || dimensions[0] !== lastDimensions[0] || dimensions[1] !== lastDimensions[1]) {
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' +
      '<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'' + (window.innerWidth) + '\' height=\'' + (window.innerHeight) + '\'>' +
        '<foreignObject width=\'100%\' height=\'100%\' x=\'0\' y=\'0\'>' +
          '<style>' +
            'x-row { display: block; }' +
            'x-row:empty::before { content: \' \'; }' +
          '</style>' +
          src.replace(/^<body/, '<div').replace(/<\/body>$/, '</div>') +
        '</foreignObject>' +
      '</svg>';
      img.onload = () => {
        ctx.drawImage(img, 0, 0, window.innerWidth * window.devicePixelRatio, window.innerHeight * window.devicePixelRatio);

        cb && cb();
      };
      img.onerror = err => {
        console.warn(err);
      };

      prevSrc = src;
      prevDimensions = dimensions;
    } else {
      cb && cb();
    }
  };

  const _updateCanvasDimensions = () => {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  };
  _updateCanvasDimensions();
  window.addEventListener('resize', () => {
    _updateCanvasDimensions();
    _render(lastSrc, [window.innerWidth, window.innerHeight]);
  });

  const terminalBuffer = (() => {
    const result = document.createElement('div');
    result.style = 'position: absolute; top: 0; bottom: 0; left: 0; right: 0; overflow: hidden; visibility: hidden;';
    return result;
  })();
  window.document.body.appendChild(terminalBuffer);

  const term = (() => {
    const result = new hterm.Terminal();
    result.prefs_.set('audible-bell-sound', '');
    result.prefs_.set('font-size', 14);
    result.prefs_.set('cursor-color', '#FFFFFF');
    result.decorate(terminalBuffer);

    result.setCursorPosition(0, 0);
    result.setCursorVisible(true);
    result.prefs_.set('ctrl-c-copy', true);
    result.prefs_.set('ctrl-v-paste', true);
    result.prefs_.set('use-default-window-copy', true);

    return result;
  })();

  const _focus = () => {
    term.focus();
  };
  canvas.addEventListener('click', _focus);
  setTimeout(_focus);

  const socket = io(window.location.origin, {
    path: '/archae/shell/socket.io',
  })
  let buf = '';

  function Wetty(argv) {
      this.argv_ = argv;
      this.io = null;
      this.pid_ = -1;
  }
  Wetty.prototype.run = function() {
      this.io = this.argv_.io.push();

      this.io.onVTKeystroke = this.sendString_.bind(this);
      this.io.sendString = this.sendString_.bind(this);
      this.io.onTerminalResize = this.onTerminalResize.bind(this);
  }
  Wetty.prototype.sendString_ = function(str) {
      socket.emit('input', str);
  };
  Wetty.prototype.onTerminalResize = function(col, row) {
      socket.emit('resize', { col: col, row: row });
  };

  socket.on('connect', function() {
      lib.init(function() {
          term.runCommandClass(Wetty/*, window.document.location.hash.substr(1)*/);
          socket.emit('resize', {
              col: term.screenSize.width,
              row: term.screenSize.height
          });

          if (buf && buf != '')
          {
              term.io.writeUTF16(buf);
              buf = '';
          }

          const html = terminalBuffer.childNodes[0].contentWindow.document.childNodes[0];
          const body = html.childNodes[1];

          const _animate = () => {
            requestAnimationFrame(() => {
              _render(
                new XMLSerializer().serializeToString(body),
                [window.innerWidth, window.innerHeight],
                _animate
              );
            });
          };

          _animate();
      });
  });

  socket.on('output', function(data) {
      if (!term) {
          buf += data;
          return;
      }
      term.io.writeUTF16(data);
  });

  socket.on('disconnect', function() {
      console.log("Socket.io connection closed");
  });

  return canvas;
};

module.exports = Shell;
