const path = require('path');

const marchingcubes = require('marchingcubes');

class Planet {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const planetAudioStatic = express.static(path.join(__dirname, 'lib/audio'));
    function servePlanetAudio(req, res, next) {
      planetAudioStatic(req, res, next);
    }
    app.use('/archae/planet/audio', servePlanetAudio);

    function servePlanetMarchingCubes(req, res, next) {
      const bs = [];
      req.on('data', d => {
        bs.push(d);
      });
      req.on('end', () => {
        const b = Buffer.concat(bs);
        const seed = new Uint32Array(b.buffer, b.byteOffset + (4 * 0), 1)[0];
        const originArray = new Uint32Array(b.buffer, b.byteOffset + (4 * 1), 3);
        const origin = [originArray[0], originArray[1], originArray[2]];
        const numHoles = new Int32Array(b.buffer, b.byteOffset + (4 * 4), 1)[0];
        const holes = new Int32Array(b.buffer, b.byteOffset + (4 * 5), numHoles * 3);

        const result = marchingcubes.marchCubesPlanet({
          seed: seed,
          origin: origin,
          holes: holes,
        });
        const {
          land: {
            positions: landPositions,
            normals: landNormals,
            colors: landColors,
          },
          water: {
            positions: waterPositions,
            normals: waterNormals,
          },
        } = result;

        const resultArray = new Uint8Array(
          (5 * 4) +
          landPositions.byteLength +
          landNormals.byteLength +
          landColors.byteLength +
          waterPositions.byteLength +
          waterNormals.byteLength
        );

        let index = 0;
        resultArray.set(new Uint8Array(Uint32Array.from([landPositions.length]).buffer), index);
        index += 4;
        resultArray.set(new Uint8Array(Uint32Array.from([landNormals.length]).buffer), index);
        index += 4;
        resultArray.set(new Uint8Array(Uint32Array.from([landColors.length]).buffer), index);
        index += 4;
        resultArray.set(new Uint8Array(Uint32Array.from([waterPositions.length]).buffer), index);
        index += 4;
        resultArray.set(new Uint8Array(Uint32Array.from([waterNormals.length]).buffer), index);
        index += 4;

        resultArray.set(new Uint8Array(landPositions.buffer, 0, landPositions.byteLength), index);
        index += landPositions.byteLength;
        resultArray.set(new Uint8Array(landNormals.buffer, 0, landNormals.byteLength), index);
        index += landNormals.byteLength;
        resultArray.set(new Uint8Array(landColors.buffer, 0, landColors.byteLength), index);
        index += landColors.byteLength;

        resultArray.set(new Uint8Array(waterPositions.buffer, 0, waterPositions.byteLength), index);
        index += waterPositions.byteLength;
        resultArray.set(new Uint8Array(waterNormals.buffer, 0, waterNormals.byteLength), index);
        index += waterNormals.byteLength;

        res.type('application/octet-stream');
        res.send(new Buffer(resultArray.buffer));
      });
    }
    app.post('/archae/planet/marchingcubes', servePlanetMarchingCubes);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'servePlanetAudio' || route.handle.name === 'servePlanetMarchingCubes') {
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
