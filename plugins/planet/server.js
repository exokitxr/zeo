const marchingcubes = require('marchingcubes');

class Planet {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    function servePlanetMarchingCubes(req, res, next) {
      const bs = [];
      req.on('data', d => {
        bs.push(d);
      });
      req.on('end', () => {
        const b = Buffer.concat(bs);
        const width = new Uint32Array(b.buffer, 4 * 0, 1)[0];
        const height = new Uint32Array(b.buffer, 4 * 1, 1)[0];
        const depth = new Uint32Array(b.buffer, 4 * 2, 1)[0];
        const data = new Float32Array(b.buffer, 4 * 3);

        const result = marchingcubes.march({
          width,
          height,
          depth,
          data,
        });
        const {positions, normals} = result;
        const resultArray = new Uint8Array((2 * 4) + positions.byteLength + normals.byteLength);
console.log('result buffer length', resultArray.length);
        resultArray.set(new Uint8Array(Uint32Array.from([positions.length]).buffer), 4 * 0);
        resultArray.set(new Uint8Array(Uint32Array.from([normals.length]).buffer), 4 * 1);
        resultArray.set(new Uint8Array(positions.buffer), 4 * 2);
        // resultArray.set(new Uint8Array(normals.buffer), (4 * 2) + positions.byteLength);
        res.type('application/octet-stream');
        res.send(new Buffer(resultArray.buffer));
      });
    }
    app.post('/archae/planet/marchingcubes', servePlanetMarchingCubes);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'servePlanetMarchingCubes') {
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

module.exports = Planet;
