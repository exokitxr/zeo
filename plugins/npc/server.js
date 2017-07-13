const events = require('events');
const {EventEmitter} = events;
const path = require('path');
const fs = require('fs');

const NUM_CELLS = 32;

class Npc {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app, wss} = archae.getCore();
    const {utils: {hash: hashUtils}} = zeo;
    const {murmur} = hashUtils;

    const _readdir = p => new Promise((accept, reject) => {
      fs.readdir(p, (err, files) => {
        if (!err) {
          accept(files);
        } else {
          reject(err);
        }
      });
    });

    return _readdir(path.join(__dirname, 'lib', 'img'))
      .then(files => {
        const npcImgStatic = express.static(path.join(__dirname, 'lib', 'img'));
        function serveNpcImg(req, res, next) {
          // const file = files[Math.floor((murmur(req.url) / 0xFFFFFFFF) * files.length)];
          const file = 'ertsefwe-skin_20170713132536186718.png';
          req.url = path.join('/', file);

          npcImgStatic(req, res, next);
        }
        app.use('/archae/npc/img', serveNpcImg);

        const trackedChunks = {};
        
        class Npc {
          constructor(id, position) {
            this.id = id;
            this.position = position;
          }
        }
        class TrackedChunk extends EventEmitter {
          constructor(ox, oz) {
            super();

            this.ox = ox;
            this.oz = oz;

            const npcs = (() => {
              const numNpcs = Math.floor(1 + Math.random() * (2 + 1));
              const result = Array(numNpcs);
              for (let i = 0; i < numNpcs; i++) {
                const id = _makeId();

                const dx = Math.random() * NUM_CELLS;
                const dz = Math.random() * NUM_CELLS;

                const ax = (ox * NUM_CELLS) + dx;
                const az = (oz * NUM_CELLS) + dz;
                const position = [ax, az];

                const npc = new Npc(id, position);
                result[i] = npc;
              }
              return result;
            })();
            this.npcs = npcs;

            this.refCount = 0;
          }

          addRef() {
            this.refCount++;
          }

          removeRef() {
            if (--this.refCount === 0) {
              this.destroy();
            }
          }

          destroy() {
            this.emit('destroy');
          }
        }

        const connections = [];

        const _connection = c => {
          const {url} = c.upgradeReq;

          if (url === '/archae/npcWs') {
            const localTrackedChunks = {};
            c.localTrackedChunks = localTrackedChunks;

            const localCleanupSymbol = Symbol();

            c.on('message', msg => {
              const m = JSON.parse(msg);

              if (typeof m === 'object' && m !== null && m.method && m.args) {
                const {method, args} = m;

                if (method === 'addChunk') {
                  const [ox, oz] = args;
                  const index = ox + ':' + oz;
                  let trackedChunk = trackedChunks[index];
                  if (!trackedChunk) {
                    trackedChunk = new TrackedChunk(ox, oz);
                    trackedChunks[index] = trackedChunk;
                    trackedChunk.on('destroy', () => {
                      delete trackedChunks[index];
                    });
                  }

                  const {npcs} = trackedChunk;
                  for (let i = 0; i < npcs.length; i++) {
                    const npc = npcs[i];
                    const {id, position} = npc;

                    const e = {
                      type: 'npcStatus',
                      id,
                      status: {
                        position,
                      },
                    };
                    const es = JSON.stringify(e);
                    c.send(es);
                  }

                  trackedChunk[localCleanupSymbol] = () => {
                    const {npcs} = trackedChunk;

                    for (let i = 0; i < npcs.length; i++) {
                      const npc = npcs[i];
                      const {id} = npc;
                      const e = {
                        type: 'npcStatus',
                        id,
                        status: null,
                      };
                      const es = JSON.stringify(e);
                      c.send(es);
                    }
                  };

                  localTrackedChunks[index] = trackedChunk;
                  trackedChunk.addRef();
                } else if (method === 'removeChunk') {
                  const [ox, oz] = args;

                  const index = ox + ':' + oz;
                  const trackedChunk = localTrackedChunks[index];
                  trackedChunk[localCleanupSymbol]();

                  delete localTrackedChunks[index];
                  trackedChunk.removeRef();
                } else {
                  console.warn('npc invalid message type', {type});
                }
              } else {
                console.warn('npc invalid message', {msg});
              }
            });
            c.on('close', () => {
              for (const index in localTrackedChunks) {
                const trackedChunk = localTrackedChunks[index];
                trackedChunk.removeRef();
              }

              connections.splice(connections.indexOf(c), 1);
            });

            connections.push(c);
          }
        };
        wss.on('connection', _connection);

        this._cleanup = () => {
          function removeMiddlewares(route, i, routes) {
            if (route.handle.name === 'serveNpcImg') {
              routes.splice(i, 1);
            }
            if (route.route) {
              route.route.stack.forEach(removeMiddlewares);
            }
          }
          app._router.stack.forEach(removeMiddlewares);

          wss.removeListener('connection', _connection);
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = Npc;
