const path = require('path');

const MultiMutex = require('multimutex');

class ZPaint {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app, wss} = archae.getCore();
    const {world, fs} = zeo;

    const tagsJson = world.getTags();

    const filesMutex = new MultiMutex();

    const zPaintBrushesStatic = express.static(path.join(__dirname, 'brushes'));
    function serveZPaintBrushes(req, res, next) {
      zPaintBrushesStatic(req, res, next);
    }
    app.use('/archae/z-paint/brushes', serveZPaintBrushes);

    const _requestPaintMeshFileSpec = ({paintId}) => new Promise((accept, reject) => {
      const paintbrushEntityTag = (() => {
        const tagIds = Object.keys(tagsJson);

        for (let i = 0; i < tagIds.length; i++) {
          const tagId = tagIds[i];
          const tagJson = tagsJson[tagId];
          const {type, name} = tagJson;

          if (type === 'entity' && name === 'paintbrush') {
            const {attributes} = tagJson;
            const {'paint-id': paintId} = attributes;

            if (paintId) {
              const {value: paintIdValue} = paintId;

              if (paintIdValue === paintId) {
                return tagJson;
              }
            }
          }
        }

        return null;
      })();
      if (paintbrushEntityTag) {
        const {attributes} = paintbrushEntityTag;
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
    const _requestPaintMeshFiles = ({paintId}) => _requestPaintMeshFileSpec({paintId})
      .then(({id, pathname}) => {
        const indexFile = fs.makeFile(id, pathname);

        return indexFile.read('utf8')
          .then(s => {
            let j = _jsonParse(s);
            if (!Array.isArray(j)) {
              j = [];
            }

            return Promise.resolve(j.map(meshId => {
              const file = fs.makeFile(id, path.join(pathname, meshId + '.bin'));
              file.meshId = meshId;
              return file;
            }));
          });
      );
    const _requestPaintIndexAndMeshFile = ({paintId, meshId}) => _requestPaintMeshFileSpec({paintId})
      .then(({id, pathname}) => {
        const indexFile = fs.makeFile(id, pathname);
        const meshFile = fs.makeFile(id, path.join(pathname, meshId + '.bin'));

        return Promise.resolve({
          indexFile,
          meshFile,
        });
      });

    const connections = [];

    const _broadcastUpdate = ({peerId, paintId, meshId, data, thisPeerOnly = false}) => {
      const e = {
        type: 'paintSpec',
        paintId: paintId,
        meshId: meshId,
      };
      const es = JSON.stringify(e);

      for (let i = 0; i < connections.length; i++) {
        const connection = connections[i];
        if ((!thisPeerOnly ? (connection.peerId !== peerId) : (connection.peerId === peerId)) && connection.paintId === paintId) {
          connection.send(es);
          connection.send(data);
        }
      }
    };
    const _ensureFileArray = ({file, entry}) => file.read('utf8')
      .then(s => {
        let j = _jsonParse(s);
        if (!Array.isArray(j)) {
          j = [];
        }

        j.push(entry);

        return file.write(JSON.stringify(j, null, 2));
      });
    const _appendFileChunk = ({file, data}) => new Promise((accept, reject) => {
      const ws = file.createWriteStream({
        flags: 'a',
      });
      ws.end(data);
      ws.on('finish', () => {
        accept();
      });
      ws.on('error', err => {
        reject(err);
      });
    });
    const _saveUpdate = ({paintId, meshId, data}) => {
      filesMutex.lock(paintId)
        .then(unlock => {
          _requestPaintIndexAndMeshFile({paintId, meshId})
            .then(files => {
              if (files) {
                const {indexFile, meshFile} = files;

                return Promise.all([
                  _ensureFileArray({
                    file: indexFile,
                    entry: meshId,
                  }),
                  _appendFileChunk({
                    file: meshFile,
                    data: data,
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
      if (match = url.match(/^\/archae\/paintWs\?peerId=(.+?)&paintId=(.+?)$/)) {
        const peerId = decodeURIComponent(match[1]);
        const paintId = decodeURIComponent(match[2]);

        c.peerId = peerId;
        c.paintId = paintId;

        const _sendInit = () => {
          _requestPaintMeshFiles({paintId})
            .then(meshFiles => {
              const _recurse = i => {
                if (i < meshFiles.length) {
                  const meshFile = meshFiles[i];

                  meshFile.read()
                    .then(data => {
                      const {meshId} = meshFile;

                      _broadcastUpdate({
                        peerId,
                        paintId,
                        meshId,
                        data,
                        thisPeerOnly: true,
                      });

                      _recurse(i + 1);
                    });
                }
              };
              _recurse(0);
            })
            .catch(err => {
              console.warn(err);
            });
        };
        _sendInit();

        let currentPaintSpec = null;
        c.on('message', (msg, flags) => {
          if (flags.binary) {
            if (currentPaintSpec !== null) {
              const {meshId} = currentPaintSpec;
              const data = msg;

              _broadcastUpdate({
                peerId,
                paintId,
                meshId,
                data,
              });

              _saveUpdate({
                paintId,
                meshId,
                data,
              });
            } else {
              console.warn('paint received data before paint spec');
            }
          } else {
            const m = JSON.parse(msg);

            if (m && typeof m === 'object' && ('type' in m)) {
              const {type} = m;

              if (type === 'paintSpec') {
                const {meshId} = m;

                currentPaintSpec = {
                  meshId,
                };
              } else {
                console.warn('paint invalid message type', {type});
              }
            } else {
              console.warn('paint invalid message', {msg});
            }
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
        if (route.handle.name === 'serveZPaintBrushes') {
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

module.exports = ZPaint;
