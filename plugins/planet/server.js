const path = require('path');

const LRUCache = require('lru-cache');
const marchingcubes = require('marchingcubes');

const SIZE = 16;
const BUFFER_SLICE_SIZE = 32 * 1024;

const originsRange = 2;
const origins = (() => {
  const result = [];

  for (let x = -originsRange; x <= originsRange; x++) {
    for (let y = -originsRange; y <= originsRange; y++) {
      for (let z = -originsRange; z <= originsRange; z++) {
        result.push([x, y, z]);
      }
    }
  }

  return result;
})();
const holeRange = 3;
const holeDirections = [
  [0, 0, 0],
  [-1, -1, -1],
  [-1, -1, 1],
  [-1, 1, -1],
  [-1, 1, 1],
  [1, -1, -1],
  [1, -1, 1],
  [1, 1, -1],
  [1, 1, 1],
];
const seed = 700;

class Planet {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app, wss} = archae.getCore();
    const {world, fs} = zeo;

    const tagsJson = world.getTags();
    const planetSpecCache = LRUCache({
      max: 256,
    });

    const planetAudioStatic = express.static(path.join(__dirname, 'lib/audio'));
    function servePlanetAudio(req, res, next) {
      planetAudioStatic(req, res, next);
    }
    app.use('/archae/planet/audio', servePlanetAudio);

    const _getInitialPlanetSpec = ({seed, origin}) => marchingcubes.genMarchCubes({
      seed: seed,
      origin: origin,
    });
    const _serializePlanetSpec = planetSpec => {
      const {
        land: {
          positions: landPositions,
          normals: landNormals,
          colors: landColors,
          ether: landEther,
        },
        water: {
          positions: waterPositions,
          normals: waterNormals,
          ether: waterEther,
        },
        metadata: {
          moistureEther: moistureEther,
        },
      } = planetSpec;

      const resultArray = new Uint8Array(
        (5 * 4) +
        landPositions.byteLength +
        landNormals.byteLength +
        landColors.byteLength +
        waterPositions.byteLength +
        waterNormals.byteLength
      );

      let index = 0;
      new Uint32Array(resultArray.buffer, resultArray.byteOffset + index, 1).set(Uint32Array.from([landPositions.length]));
      index += 4;
      new Uint32Array(resultArray.buffer, resultArray.byteOffset + index, 1).set(Uint32Array.from([landNormals.length]));
      index += 4;
      new Uint32Array(resultArray.buffer, resultArray.byteOffset + index, 1).set(Uint32Array.from([landColors.length]));
      index += 4;
      new Uint32Array(resultArray.buffer, resultArray.byteOffset + index, 1).set(Uint32Array.from([waterPositions.length]));
      index += 4;
      new Uint32Array(resultArray.buffer, resultArray.byteOffset + index, 1).set(Uint32Array.from([waterNormals.length]));
      index += 4;

      resultArray.set(new Uint8Array(landPositions.buffer, landPositions.byteOffset, landPositions.byteLength), index);
      index += landPositions.byteLength;
      resultArray.set(new Uint8Array(landNormals.buffer, landNormals.byteOffset, landNormals.byteLength), index);
      index += landNormals.byteLength;
      resultArray.set(new Uint8Array(landColors.buffer, landColors.byteOffet, landColors.byteLength), index);
      index += landColors.byteLength;

      resultArray.set(new Uint8Array(waterPositions.buffer, waterPositions.byteOffset, waterPositions.byteLength), index);
      index += waterPositions.byteLength;
      resultArray.set(new Uint8Array(waterNormals.buffer, waterNormals.byteOffset, waterNormals.byteLength), index);
      index += waterNormals.byteLength;

      return resultArray;
    };
    const _serializePlanetSpecs = (planetSpecs, holes = new Int32Array(0), colors = new Uint8Array(0)) => {
      const planetDatas = planetSpecs.map(planetSpec => {
        const {origin, spec} = planetSpec;
        const data = _serializePlanetSpec(spec);
        return {
          origin,
          data,
        };
      });
      const planetDatasByteLength = (() => {
        let result = 0;
        for (let i = 0; i < planetDatas.length; i++) {
          const planetData = planetDatas[i];
          const {data} = planetData;
          result += data.length;
        }
        return result;
      })();

      const resultArray = new Uint8Array(
        4 + // num frames
        (planetDatas.length * 3 * 4) + // origin headers
        planetDatasByteLength + // payloads
        4 + // num holes
        holes.byteLength + // holes payload
        4 + // num colors
        colors.byteLength // colors payload
      );

      let index = 0;
      new Uint32Array(resultArray.buffer, resultArray.byteOffset + index, 1).set(Uint32Array.from([planetDatas.length]));
      index += 4;

      for (let i = 0; i < planetDatas.length; i++) {
        const planetData = planetDatas[i];
        const {origin, data} = planetData;

        new Int32Array(resultArray.buffer, resultArray.byteOffset + index, 3).set(Int32Array.from([origin[0], origin[1], origin[2]]));
        index += 3 * 4;

        resultArray.set(data, index);
        index += data.length;
      }

      const numHoles = holes.length / 3;
      new Uint32Array(resultArray.buffer, resultArray.byteOffset + index, 1).set(Uint32Array.from([numHoles]));
      index += 4;
      for (let i = 0; i < numHoles; i++) {
        new Int32Array(resultArray.buffer, resultArray.byteOffset + index, 3).set(holes.slice(i * 3, (i + 1) * 3));
        index += 3 * 4;
      }

      const numColors = colors.length / 3;
      new Uint32Array(resultArray.buffer, resultArray.byteOffset + index, 1).set(Uint32Array.from([numColors]));
      index += 4;
      for (let i = 0; i < numColors; i++) {
        new Uint8Array(resultArray.buffer, resultArray.byteOffset + index, 3).set(colors.slice(i * 3, (i + 1) * 3));
        index += 3;
      }

      return resultArray;
    };
    const _requestPlanetMeshFileSpec = ({planetId}) => new Promise((accept, reject) => {
      const planetEntityTag = (() => {
        const tagIds = Object.keys(tagsJson);

        for (let i = 0; i < tagIds.length; i++) {
          const tagId = tagIds[i];
          const tagJson = tagsJson[tagId];
          const {type, name} = tagJson;

          if (type === 'entity' && name === 'planet') {
            const {attributes} = tagJson;
            const {'planet-id': planetIdAttribute} = attributes;

            if (planetIdAttribute) {
              const {value: planetIdValue} = planetIdAttribute;

              if (planetIdValue === planetId) {
                return tagJson;
              }
            }
          }
        }

        return null;
      })();
      if (planetEntityTag) {
        const {attributes} = planetEntityTag;
        const {file: fileAttribute} = attributes;

        if (fileAttribute) {
          const {value} = fileAttribute;
          const match = (value || '').match(/^fs\/([^\/]+)(\/.*)$/)

          if (match) {
            const id = match[1];
            const pathname = match[2];

            accept({
              id,
              pathname,
            });
          } else {
            accept(null); // non-local file
          }
        } else {
          accept(null);
        }
      } else {
        accept(null);
      }
    });
    const _requestPlanetMeshFiles = ({planetId, origins}) => _requestPlanetMeshFileSpec({planetId})
      .then(fileSpec => {
        if (fileSpec) {
          const {id} = fileSpec;

          return Promise.resolve(origins.map(origin => ({
            origin: origin,
            file: fs.makeFile(id, origin.join('.') + '.bin'),
          })));
        } else {
          return Promise.resolve([]);
        }
      });
    const _getKey = ({seed, origin}) => seed + ':' + origin.join(',');
    const _requestPlanetSpecs = ({planetId, origins}) => _requestPlanetMeshFiles({planetId, origins})
      .then(planetMeshFiles =>
        Promise.all(planetMeshFiles.map(({origin, file}) => {
          const key = _getKey({seed, origin});
          const spec = planetSpecCache.get(key);

          if (spec !== undefined) {
            return Promise.resolve({
              origin,
              spec,
            });
          } else {
            return file.read() // XXX figure out this storage
              .then(spec => ({
                origin,
                spec,
              }))
              .catch(err => {
                if (err.code === 'ENOENT') {
                  const spec = _getInitialPlanetSpec({
                    seed: seed,
                    origin: origin,
                  });
                  if (!planetSpecCache.has(key)) {
                    planetSpecCache.set(key, spec);
                  }

                  return Promise.resolve({
                    origin,
                    spec,
                  });
                } else {
                  return Promise.reject(err);
                }
              });
          }
        }))
      );
    const _getPositionOrigin = ([x, y, z]) => ([
      Math.floor((x + (SIZE / 2)) / SIZE),
      Math.floor((y + (SIZE / 2)) / SIZE),
      Math.floor((z + (SIZE / 2)) / SIZE),
    ]);
    const _vectorEquals = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
    const _applyHoles = ({planetId, holes}) => {
      const changedOrigins = (() => {
        const result = [];
        const numHoles = holes.length / 3;
        for (let i = 0; i < numHoles; i++) {
          const baseIndex = i * 3;
          const x = holes[baseIndex + 0];
          const y = holes[baseIndex + 1];
          const z = holes[baseIndex + 2];

          for (let j = 0; j < holeDirections.length; j++) {
            const holeDirection = holeDirections[j];
            const [dx, dy, dz] = holeDirection;
            const p = [
              x + (dx * holeRange),
              y + (dy * holeRange),
              z + (dz * holeRange),
            ];
            const origin = _getPositionOrigin(p);

            if (!result.some(o => _vectorEquals(o, origin))) {
              result.push(origin);
            }
          }
        }
        return result;
      })();

      return _requestPlanetSpecs({
        planetId: planetId,
        origins: changedOrigins,
      })
        .then(planetSpecs => {
          return planetSpecs.map(planetSpec => {
            const {origin, spec: oldSpec} = planetSpec;
            const {land, water, metadata} = oldSpec;

            const newSpec = marchingcubes.holesMarchCubes({
              origin,
              land,
              water,
              metadata,
              holes,
            });

            const key = _getKey({seed, origin});
            planetSpecCache.set(key, newSpec);

            return {
              origin,
              spec: newSpec,
            };
          });
        });
    };

    const connections = [];

    const _broadcastUpdate = ({peerId, planetId, data, thisPeerOnly = false, allPeers = false}) => {
      const slices = (() => { // this slicing is to prevent frontend hitching
        const result = [];
        let index = 0;
        while (index < data.length) {
          const bytesRemaining = data.length - index;
          const numBytesToSend = Math.min(bytesRemaining, BUFFER_SLICE_SIZE);
          const slice = new Uint8Array(data.buffer, data.byteOffset + index, numBytesToSend);
          result.push(slice);
          index += numBytesToSend;
        }
        result.push(new Uint8Array(0));
        return result;
      })();

      for (let i = 0; i < connections.length; i++) {
        const connection = connections[i];

        const _send = () => {
          for (let i = 0; i < slices.length; i++) {
            const slice = slices[i];
            connection.send(slice);
          }
        };

        if (connection.planetId === planetId) {
          if (thisPeerOnly && connection.peerId === peerId) {
             _send();
          } else if (allPeers) {
            _send();
          } else if (connection.peerId !== peerId) {
            _send();
          }
        }
      }
    };

    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      let match;
      if (match = url.match(/^\/archae\/planetWs\?peerId=(.+?)&planetId=(.+?)$/)) {
        const peerId = decodeURIComponent(match[1]);
        const planetId = decodeURIComponent(match[2]);

        c.peerId = peerId;
        c.planetId = planetId;

        const _sendInit = () => {
          _requestPlanetSpecs({planetId, origins})
            .then(planetSpecs => {
              const data = _serializePlanetSpecs(planetSpecs);

              _broadcastUpdate({
                peerId,
                planetId,
                data: data,
                thisPeerOnly: true,
              });
            })
            .catch(err => {
              console.warn(err);
            });
        };
        _sendInit();

        c.on('message', (msg, flags) => {
          if (flags.binary) {
            const data = msg;

            let index = 0;
            const numHoles = new Uint32Array(data.buffer, data.byteOffset + index, 1)[0];
            index += 4;
            const holes = new Int32Array(data.buffer, data.byteOffset + index, numHoles * 3);
            index += numHoles * 3 * 4;

            const numColors = new Uint32Array(data.buffer, data.byteOffset + index, 1)[0];
            index += 4;
            const colors = new Uint8Array(data.buffer, data.byteOffset + index, numColors * 3);
            index += numColors * 3;

            _applyHoles({planetId, holes})
              .then(planetSpecs => {
                const data = _serializePlanetSpecs(planetSpecs, holes, colors);

                _broadcastUpdate({
                  peerId,
                  planetId,
                  data,
                  allPeers: true,
                });
              })
              .catch(err => {
                console.warn(err);
              });
          }
        });
        c.on('close', () => {
          connections.splice(connections.indexOf(c), 1);
        });

        connections.push(c);
      }
    });

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'servePlanetAudio') {
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
}

module.exports = Planet;
