const path = require('path');

const socketIo = require('socket.io');
const pty = require('pty.js');
const httpProxy = require('http-proxy');
const getRandomPort = require('get-random-port');

class Shell {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {server, app} = archae.getCore();

    let live = true;
    this._cleanup = () => {
      live = false;
    };

    return getRandomPort()
      .then(port => {
        if (live) {
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
          io.listen(port, '127.0.0.1');

          const shellProxy = httpProxy.createProxyServer({
            target: 'http://localhost:' + config.shellPort,
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

          this._cleanup = () => {
            io.close();
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
          };
        }
      });
    }
  }

  unmount() {
    this._cleanup();
  }
};

module.exports = Shell;
