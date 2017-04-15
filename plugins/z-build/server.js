const path = require('path');

const MultiMutex = require('multimutex');

class ZBuild {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app, wss} = archae.getCore();
    const {world, fs} = zeo;

    const tagsJson = world.getTags();

    const filesMutex = new MultiMutex();

    const zBuildIconsStatic = express.static(path.join(__dirname, 'icons'));
    function serveZBuildIcons(req, res, next) {
      zBuildIconsStatic(req, res, next);
    }
    app.use('/archae/z-build/icons', serveZBuildIcons);

    const _requestBuildMeshFileSpec = ({buildId}) => new Promise((accept, reject) => {
      const buildEntityTag = (() => {
        const tagIds = Object.keys(tagsJson);

        for (let i = 0; i < tagIds.length; i++) {
          const tagId = tagIds[i];
          const tagJson = tagsJson[tagId];
          const {type, name} = tagJson;

          if (type === 'entity' && name === 'buildbrush') {
            const {attributes} = tagJson;
            const {'build-id': buildIdAttribute} = attributes;

            if (buildIdAttribute) {
              const {value: buildIdValue} = buildIdAttribute;

              if (buildIdValue === buildId) {
                return tagJson;
              }
            }
          }
        }

        return null;
      })();
      if (buildEntityTag) {
        const {attributes} = buildEntityTag;
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
    const _ensureFileArrayIncludesEntry = ({file, entry}) => file.read('utf8')
      .then(s => {
        let j = _jsonParse(s);
        if (!Array.isArray(j)) {
          j = [];
        }

        if (!j.includes(entry)) {
          j.push(entry);
        }

        return file.write(JSON.stringify(j, null, 2));
      });
    const _writeFile = ({file, data}) => new Promise((accept, reject) => {
      const ws = file.createWriteStream();
      ws.end(data);
      ws.on('finish', () => {
        accept();
      });
      ws.on('error', err => {
        reject(err);
      });
    });
    const _requestBuildMeshFiles = ({buildId}) => _requestBuildMeshFileSpec({buildId})
      .then(fileSpec => {
        if (fileSpec) {
          const {id, pathname} = fileSpec;
          const indexFile = fs.makeFile(id, pathname);

          return indexFile.read('utf8')
            .then(s => {
              let j = _jsonParse(s);
              if (!Array.isArray(j)) {
                j = [];
              }

              return Promise.resolve(j.map(meshId => {
                const file = fs.makeFile(id, meshId + '.mesh.json');
                file.meshId = meshId;
                return file;
              }));
            });
        } else {
          return Promise.resolve([]);
        }
      });
    const _requestBuildIndexAndMeshFile = ({paintId, meshId}) => _requestBuildMeshFileSpec({paintId})
      .then(fileSpec => {
        if (fileSpec) {
          const {id, pathname} = fileSpec;
          const indexFile = fs.makeFile(id, pathname);
          const meshFile = fs.makeFile(id, meshId + '.mesh.json');
          meshFile.meshId = meshId;

          return Promise.resolve({
            indexFile: indexFile,
            meshFile: meshFile,
          });
        } else {
          return Promise.resolve(null);
        }
      });

    const connection = [];

    const _broadcastUpdate = ({peerId, buildId, meshId, data, thisPeerOnly = false}) => {
      const e = {
        type: 'buildSpec',
        buildId: buildId,
        meshId: meshId,
      };
      const es = JSON.stringify(e);

      for (let i = 0; i < connections.length; i++) {
        const connection = connections[i];
        // if ((!thisPeerOnly ? (connection.peerId !== peerId) : (connection.peerId === peerId)) && connection.buildId === buildId) { // XXX unlock this
          connection.send(es);
          connection.send(data);
        // }
      }
    };
    const _saveUpdate = ({paintId, meshId, data}) => {
      filesMutex.lock(paintId)
        .then(unlock => {
          _requestBuildIndexAndMeshFile({paintId, meshId})
            .then(files => {
              if (files) {
                const {indexFile, meshFile} = files;

                return Promise.all([
                  _ensureFileArrayIncludesEntry({
                    file: indexFile,
                    entry: meshId,
                  }),
                  _writeFile({
                    file: meshFile,
                    data: JSON.stringify(data, null, 2),
                  }),
                ]);
              } else {
                console.warn('paint server could not find file for saving for draw id', {paintId});

                return Promise.resolve();
              }
            })
            .then(() => {
              unlock();
            })
            .catch(err => {
              console.warn(err);

              unlock();
            });
        });
    };

    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      let match;
      if (match = url.match(/^\/archae\/buildWs\?peerId=(.+?)&buildId=(.+?)$/)) {
        const peerId = decodeURIComponent(match[1]);
        const buildId = decodeURIComponent(match[2]);

        c.peerId = peerId;
        c.buildId = buildId;

        const _sendInit = () => {
          _requestBuildMeshFiles({buildId})
            .then(meshFiles => {
              for (let i = 0; i < meshFiles.length; i++) {
                (() => {
                  const meshFile = meshFiles[i];
                  const {meshId} = meshFile;

                  meshFile.read()
                    .then(data => {
                      _broadcastUpdate({
                        peerId,
                        buildId,
                        meshId,
                        data,
                        thisPeerOnly: true,
                      });
                    })
                })();
              }
            })
            .catch(err => {
              console.warn(err);
            });
        };
        _sendInit();

        c.on('message', (msg, flags) => {
          if (!flags.binary) {
            const m = JSON.parse(msg);

            if (m && typeof m === 'object' && ('type' in m)) {
              const {type} = m;

              if (type === 'buildSpec') {
                const {meshId, data} = m;

                _broadcastUpdate({
                  peerId,
                  buildId,
                  meshId,
                  data,
                });

                _saveUpdate({
                  buildId,
                  meshId,
                  data,
                });
              } else {
                console.warn('build invalid message type', {type});
              }
            } else {
              console.warn('build invalid message', {msg});
            }
          } else {
            console.warn('build got binary data', {msg});
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
        if (route.handle.name === 'serveZBuildIcons') {
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

const _jsonParse = s => {
  let error = null;
  let result;
  try {
    result = JSON.parse(s);
  } catch (err) {
    error = err;
  }
  if (!error) {
    return result;
  } else {
    return null;
  }
};

module.exports = ZBuild;
