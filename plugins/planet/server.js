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
        const numHoles = new Int32Array(b.buffer, b.byteOffset + (4 * 0), 1)[0];
        const holes = new Int32Array(b.buffer, b.byteOffset + (4 * 1), numHoles * 3);

        const result = marchingcubes.marchCubesPlanet({
          holes: holes,
        });
        const {positions, normals, colors} = result;
        const resultArray = new Uint8Array((3 * 4) + positions.byteLength + normals.byteLength + colors.byteLength);
        resultArray.set(new Uint8Array(Uint32Array.from([positions.length]).buffer), 4 * 0);
        resultArray.set(new Uint8Array(Uint32Array.from([normals.length]).buffer), 4 * 1);
        resultArray.set(new Uint8Array(Uint32Array.from([colors.length]).buffer), 4 * 2);
        resultArray.set(new Uint8Array(positions.buffer), 4 * 3);
        resultArray.set(new Uint8Array(normals.buffer), (4 * 3) + positions.byteLength);
        resultArray.set(new Uint8Array(colors.buffer), (4 * 3) + positions.byteLength + normals.byteLength);
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
