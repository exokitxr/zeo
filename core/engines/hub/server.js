const path = require('path');
const fs = require('fs');

const psNode = require('ps-node');

const _resolvePath = (file, directory) => path.normalize(/^\//.test(file) ? file : path.join(directory, file))
const localIndexFilePath = _resolvePath(process.argv[1], process.cwd());

class Hub {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const hubImgStatic = express.static(path.join(__dirname, 'lib', 'img'));
    function serveHubImg(req, res, next) {
      hubImgStatic(req, res, next);
    }
    app.use('/archae/hub/img', serveHubImg);

    function serveHubLocalServers(req, res, next) {
      psNode.lookup({
        command:'node',
      }, (err, processes) => {
        if (!err) {
          Promise.all(processes.map(process => new Promise((accept, reject) => {
            const {pid} = process;
            
            fs.readlink(path.join('/', 'proc', pid, 'cwd'), (err, cwdPath) => {
              if (!err) {
                const {arguments: args} = process;
                const binPath = args[0];
                const processIndexFilePath = _resolvePath(binPath, cwdPath);

                const _findArg = name => {
                  for (let i = 0; i < args.length; i++) {
                    const arg = args[i];
                    const match = arg.match(/^(.+?)=(.+?)$/);

                    if (match && match[1] === name) {
                      return match[2];
                    }
                  }
                  return null;
                };

                if (processIndexFilePath === localIndexFilePath) {
                  const dataDirectory = _findArg('dataDirectory');

                  if (dataDirectory) { // XXX check that this hub actually owns the data directory
                    const worldname = _findArg('worldname') || null;
                    const url = (() => {
                      const serverHost = _findArg('serverHost');
                      const port = _findArg('port');

                      if (serverHost && port) {
                        return serverHost + ':' + port;
                      } else {
                        return null;
                      }
                    })();
                    const users = []; // XXX report a real users list
                    const serverDataDirectory = _resolvePath(dataDirectory, cwdPath); // XXX no need to report this

                    accept({
                      worldname: worldname,
                      url: url,
                      users: users,
                      dataDirectory: serverDataDirectory,
                    });
                  } else {
                    accept(null);
                  }
                } else {
                  accept(null);
                }
              } else {
                reject(err);
              }
            });
          })))
            .then(servers => servers.filter(server => server !== null))
            .then(servers => {
              res.json({
                servers,
              });
            });
        } else {
          res.status(500);
          res.send(err.stack);
        }
      });
    }
    app.use('/archae/hub/servers/local/servers.json', serveHubLocalServers);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (
          route.handle.name === 'serveHubImg' ||
          route.handle.name === 'serveHubLocalServers'
        ) {
          routes.splice(i, 1);
        }
        if (route.route) {
          route.route.stack.forEach(removeMiddlewares);
        }
      }
      app._router.stack.forEach(removeMiddlewares);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Hub;
