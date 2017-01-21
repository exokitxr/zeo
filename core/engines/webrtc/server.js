const path = require('path');
const child_process = require('child_process');

const getPort = require('get-port');
const httpProxy = require('http-proxy');

const peerPath = path.join(path.dirname(require.resolve('peer')), '..', 'bin', 'peerjs');

class WebRtc {
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

    const _requestPeerServer = () => getPort()
      .then(port => new Promise((accept, reject) => {
        const peerServer = child_process.spawn(peerPath, ['--port', port, '--path', '/archae/webrtc']);
        peerServer.stdout.pipe(process.stdout);
        peerServer.stderr.pipe(process.stderr);
        peerServer.on('error', err => {
          console.warn(err);
        });
        peerServer.port = port;

        accept(peerServer);
      }));
      
    return _requestPeerServer()
      .then(peerServer => {
        if (live) {
          const {port} = peerServer;

          const peerProxy = httpProxy.createProxyServer({
            target: 'http://localhost:' + port,
            ws: true,
          });

          const regexp = /^\/archae\/webrtc(?:\/|$)/;
          function servePeerProxy(req, res, next) {
            peerProxy.web(req, res);
          }
          app.all(regexp, servePeerProxy);
          const upgradeHandler = (req, socket, head) => {
            if (regexp.test(req.url)) {
              peerProxy.ws(req, socket, head);
              return false;
            } else {
              return true;
            }
          };
          server.addUpgradeHandler(upgradeHandler);

          this._cleanup = () => {
            peerProxy.close();

            function removeMiddlewares(route, i, routes) {
              if (route.handle.name === 'servePeerProxy') {
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

  unmount() {
    this._cleanup();
  }
}

module.exports = WebRtc;
