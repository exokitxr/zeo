const path = require('path');
const child_process = require('child_process');

const bodyParser = require('body-parser');
const bodyParserJson = bodyParser.json();
const CRI = require('chrome-remote-interface');

class Biolumi {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app, wss} = archae.getCore();

    const workerStatic = express.static(path.join(__dirname));
    function serveWorker(req, res, next) {
      workerStatic(req, res, next);
    }
    app.use('/archae/biolumi', serveWorker);

    let proxyConnection = null;
    const inQueue = [];
    const outQueue = [];
    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      if (url === '/archae/biolumiWs') {
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
      } else if (url === '/archae/biolumiWsProxy') {
        proxyConnection = c;

        c.on('message', m => {
          outQueue.shift()(m);
        });
        c.on('close', () => {
          proxyConnection = null;

          const err = new Error('biolumi lost proxy connection');
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

    const chromiumProcess = child_process.spawn('chromium', [
      '--headless',
      '--remote-debugging-port=9222', // XXX parameterize this
    ]);

    this._cleanup = () => {
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

      chromiumProcess.kill();
    };

    const _requestRasterizer = () => new Promise((accept, reject) => {
      const _recurse = () => {
        CRI({
          port: 9222, // XXX parameterize this
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
              .then(() => Page.navigate({url: `http://127.0.0.1:7778/archae/biolumi/worker.html#127.0.0.1:7778`})); // XXX parameterize this
          })
          .catch(err => {
            console.warn(err);

            setTimeout(_recurse, 100);
          });
      };
      _recurse();
    });

    return _requestRasterizer();
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Biolumi;
