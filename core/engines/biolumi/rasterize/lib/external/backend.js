const path = require('path');
const child_process = require('child_process');

const getport = require('getport');
const CRI = require('chrome-remote-interface');

const rasterize = ({
  express,
  app,
  wss,
  port,
}) => {
  const cleanups = [];

  const workerStatic = express.static(path.join(__dirname, '..', 'worker'));
  function serveWorker(req, res, next) {
    workerStatic(req, res, next);
  }
  app.use('/rasterize', serveWorker);

  let proxyConnection = null;
  const inQueue = [];
  const outQueue = [];
  wss.on('connection', c => {
    const {url} = c.upgradeReq;

    if (url === '/rasterizeWs') {
      c.on('message', m => {
        const _proxy = () => {
          proxyConnection.send(m);

          outQueue.push(m => {
            c.send(m);
          });
          outQueue.push(m => {
            c.send(m);
          });
        };

        if (proxyConnection) {
          _proxy();
        } else {
          inQueue.push(_proxy);
        }
      });
    } else if (url === '/rasterizeWsProxy') {
      proxyConnection = c;

      c.on('message', m => {
        outQueue.shift()(m);
      });
      c.on('close', () => {
        proxyConnection = null;

        const err = new Error('rasterize lost proxy connection');
        for (let i = 0; i < outQueue.length; i++) {
          outQueue[i](err);
        }
        outQueue.length = 0;
      });

      for (let i = 0; i < inQueue.length; i++) {
        inQueue[i]();
      }
      inQueue.length = 0;
    }
  });    

  cleanups.push(() => {
    function removeMiddlewares(route, i, routes) {
      if (
        route.handle.name === 'serveWorker'
      ) {
        routes.splice(i, 1);
      }
      if (route.route) {
        route.route.stack.forEach(removeMiddlewares);
      }
    }
    app._router.stack.forEach(removeMiddlewares);
  });

  const _getPort = () => new Promise((accept, reject) => {
    getport((port + 9222) % 65535, (err, port) => {
      if (!err) {
        accept(port);
      } else {
        reject(err);
      }
    });
  });
  const _requestRasterizer = rasterizerPort => new Promise((accept, reject) => {
    const chromiumProcess = child_process.spawn('chromium', [
      '--headless',
      `--remote-debugging-port=${rasterizerPort}`,
      '--no-sandbox',
      '--no-zygote',
    ]);

    cleanups.push(() => {
      chromiumProcess.kill();
    });

    const startTime = Date.now();
    const _recurse = () => {
      CRI({
        port: rasterizerPort,
      })
        .then(client => {
          const {Page, Console} = client;
          Promise.all([
            Page.enable(),
            Console.enable(),
          ])
            .then(() => {
              Console.messageAdded(({message}) => {
                if (message.level === 'warning' || message.level === 'error') {
                  console.warn('chromium:' + message.url + ':' + message.line + ':' + message.column + ': ' + message.text);
                }
              });
              Page.loadEventFired(() => {
                accept();
              });
            })
            .then(() => Page.navigate({url: `http://127.0.0.1:${port}/rasterize/worker.html#127.0.0.1:${port}`}));
        })
        .catch(err => {
          const now = Date.now();

          if (now - startTime > 2000) {
            console.warn(err);

            setTimeout(_recurse, 2000);
          } else {
            setTimeout(_recurse, 50);
          }
        });
    };
    _recurse();
  });

  return _getPort()
    .then(rasterizerPort => _requestRasterizer(rasterizerPort))
    .then(() => {
      return () => {
        for (let i = 0; i < cleanups.length; i++) {
          const cleanup = cleanups[i];
          cleanup();
        }
      };
    });
};

module.exports = rasterize;
