const path = require('path');
const http = require('http');

const socketIo = require('socket.io');
const httpProxy = require('http-proxy');
const getPort = require('get-port');

const pty = require('./lib/pty.js');

class Shell {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {server, app} = archae.getCore();

    let cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
      cleanups = [];
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

    return getPort()
      .then(port => {
        if (live) {
          return new Promise((accept, reject) => {
            const io = socketIo({
              path: '/archae/shell/socket.io',
            });
            io.on('connection', function(socket) {
              const term = pty.spawn('/bin/bash', [], {
                name: 'xterm-256color',
                cols: 80,
                rows: 30,
              });

              console.log((new Date()) + ' PID=' + term.pid + ' STARTED');

              term.on('data', function(data) {
                socket.emit('output', data);
              });
              term.on('exit', function(code) {
                console.log((new Date()) + ' PID=' + term.pid + ' ENDED')
              });
              socket.on('resize', function(data) {
                term.resize(data.col, data.row);
              });
              socket.on('input', function(data) {
                term.write(data);
              });
              socket.on('disconnect', function() {
                term.end();
              });
            });
            const ioServer = http.createServer();
            io.attach(ioServer);
            ioServer.listen(port, 'localhost', err => {
              if (live) {
                if (!err) {
                  const shellProxy = httpProxy.createProxyServer({
                    target: 'http://localhost:' + port,
                    ws: true,
                  });

                  const regex = /^\/archae\/shell(?:\/|$)/;
                  function serveShellProxy(req, res, next) {
                    shellProxy.web(req, res);
                  }
                  app.all(regex, serveShellProxy);
                  const upgradeHandler = (req, socket, head) => {
                    if (regex.test(req.url)) {
                      shellProxy.ws(req, socket, head);
                      return false;
                    } else {
                      return true;
                    }
                  };
                  server.addUpgradeHandler(upgradeHandler);

                  cleanups.push(() => {
                    shellProxy.close();

                    function removeMiddlewares(route, i, routes) {
                      if (route.handle.name === 'serveShellProxy') {
                        routes.splice(i, 1);
                      }
                      if (route.route) {
                        route.route.stack.forEach(removeMiddlewares);
                      }
                    }
                    app._router.stack.forEach(removeMiddlewares);

                    server.removeUpgradeHandler(upgradeHandler);
                  });

                  accept();
                } else {
                  reject(err);
                }
              }
            });

            cleanups.push(() => {
              ioServer.close();
            });
          });
        }
      });
  }

  unmount() {
    this._cleanup();
  }
};

module.exports = Shell;
