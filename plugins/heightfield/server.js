const workerUtils = require('./lib/utils/worker-utils');
const protocolUtils = require('./lib/utils/protocol-utils');

class Heightfield {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app} = archae.getCore();

    function generate(req, res, next) {
      const {x: xs, y: ys} = req.query;
      const x = parseInt(xs, 10);
      const y = parseInt(ys, 10);

      if (!isNaN(x) && !isNaN(y)) {
        const builtMapChunk = workerUtils.buildMapChunk({
          offset: {
            x,
            y,
          },
        });
        const compiledMapChunk = workerUtils.compileMapChunk(builtMapChunk);
        const mapChunkBuffer = protocolUtils.stringifyMapChunk(compiledMapChunk);

        res.type('application/octet-stream');
        res.send(new Buffer(mapChunkBuffer));
      } else {
        res.status(400);
        res.send();
      }
    }
    app.get('/archae/heightfield/generate', generate);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'generate') {
          routes.splice(i, 1);
        }
        if (route.route) {
          route.route.stack.forEach(removeMiddlewares);
        }
      }
      app._router.stack.forEach(removeMiddlewares);

      for (let i = 0; i < connections.length; i++) {
        const connection = connections[i];
        connection.close();
      }
    };
  }

  unmount() {
    this._cleanup();
  } 
};

module.exports = Heightfield;
