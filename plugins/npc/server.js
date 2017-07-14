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
    const {three, utils: {hash: hashUtils}} = zeo;
    const {THREE} = three;
    const {murmur} = hashUtils;

    const upVector = new THREE.Vector3(0, 1, 0);
    const forwardVector = new THREE.Vector3(0, 0, -1);
    const backVector = new THREE.Vector3(0, 0, 1);

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

        const npcSfxStatic = express.static(path.join(__dirname, 'lib', 'sfx'));
        function serveNpcSfx(req, res, next) {
          npcSfxStatic(req, res, next);
        }
        app.use('/archae/npc/sfx', serveNpcSfx);

        const trackedChunks = {};
        const trackedNpcs = {};
        
        class Npc extends EventEmitter {
          constructor(id, position, rotation, health) {
            super();

            this.id = id;
            this.position = position;
            this.rotation = rotation;
            this.health = health;

            this.timeout = null;

            this.wait();
          }

          wait() {
            this.timeout = setTimeout(() => {
              this.timeout = null;

              this.walk();
            }, 1000 + Math.random() * 4000);
          }

          walk() {
            const {position, rotation} = this;

            const distance = 2 + Math.random() * 10;
            const positionEnd = position.clone()
              .add(
                new THREE.Vector3(
                  -0.5 + Math.random(),
                  0,
                  -0.5 + Math.random(),
                ).normalize().multiplyScalar(distance)
              );
            const rotationEnd = new THREE.Quaternion().setFromUnitVectors(
              forwardVector,
              positionEnd.clone().sub(position).normalize()
            );
            const speed = (0.5 + Math.random() * 1.5) / 1000;
            const duration = distance / speed;

            const animation = {
              mode: 'walk',
              positionStart: position,
              positionEnd: positionEnd,
              rotationStart: rotation,
              rotationEnd: rotationEnd,
              duration: duration,
            };
            this.emit('animation', animation);

            this.position = positionEnd;
            this.rotation = rotationEnd;

            this.timeout = setTimeout(() => {
              this.wait();
            }, duration);
          }

          hit(position, direction, damage) {
            clearTimeout(this.timeout);

            const health = Math.max(this.health - damage, 0);
            if (health > 0) {
              const positionEnd = position.clone().add(direction.clone().multiplyScalar(2));
              const rotation = new THREE.Quaternion().setFromUnitVectors(
                backVector,
                direction
              );
              const rotationEnd = rotation;
              const duration = 500;

              const animation = {
                mode: 'hit',
                positionStart: position,
                positionEnd: positionEnd,
                rotationStart: rotation,
                rotationEnd: rotationEnd,
                duration: duration,
              };
              this.emit('animation', animation);

              this.position = positionEnd;
              this.rotation = rotationEnd;
              this.health = health;

              this.timeout = setTimeout(() => {
                this.wait();
              }, duration);
            } else {
              const positionEnd = position.clone().add(direction.clone().multiplyScalar(2));
              const rotation = new THREE.Quaternion().setFromUnitVectors(
                backVector,
                direction
              );
              const rotationEnd = rotation.clone()
                .multiply(new THREE.Quaternion().setFromAxisAngle(
                  backVector,
                  ((Math.random() < 0.5) ? 1 : -1) * (Math.PI / 2)
                ));
              const duration = 1000;

              const animation = {
                mode: 'die',
                positionStart: position,
                positionEnd: positionEnd,
                rotationStart: rotation,
                rotationEnd: rotationEnd,
                duration: duration,
              };
              this.emit('animation', animation);

              this.emit('die');
            }
          }

          destroy() {
            clearTimeout(this.timeout);
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
                const position = new THREE.Vector3(ax, 0, az);
                const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0, 'YXZ'));

                const npc = new Npc(id, position, rotation, 100);
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
            const {npcs} = this;
            for (let i = 0; i < npcs.length; i++) {
              const npc = npcs[i];
              npc.destroy();
            }

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

                      const {npcs} = trackedChunk;
                      for (let i = 0; i < npcs.length; i++) {
                        const npc = npcs[i];
                        const {id} = npc;
                        delete trackedNpcs[id];
                      }
                    });

                    const {npcs} = trackedChunk;
                    for (let i = 0; i < npcs.length; i++) {
                      const npc = npcs[i];
                      const {id} = npc;
                      trackedNpcs[id] = npc;

                      npc.on('die', () => {
                        npcs.splice(npcs.indexOf(npc), 1);
                        delete trackedNpcs[id];
                      });
                    }
                  }

                  const {npcs} = trackedChunk;
                  const  npcCleanups = Array(npcs.length);
                  for (let i = 0; i < npcs.length; i++) {
                    const npc = npcs[i];
                    const {id, position, rotation} = npc;

                    const e = {
                      type: 'npcStatus',
                      id,
                      status: {
                        position: position.toArray(),
                        rotation: rotation.toArray(),
                      },
                    };
                    const es = JSON.stringify(e);
                    c.send(es);

                    const _animation = animation => {
                      const {mode, positionStart, positionEnd, rotationStart, rotationEnd, duration} = animation;
                      const e = {
                        type: 'npcAnimation',
                        id,
                        animation: {
                          mode,
                          positionStart: positionStart.toArray(),
                          positionEnd: positionEnd.toArray(),
                          rotationStart: rotationStart.toArray(),
                          rotationEnd: rotationEnd.toArray(),
                          duration,
                        },
                      };
                      const es = JSON.stringify(e);
                      c.send(es);
                    };
                    npc.on('animation', _animation);
                    const _die = () => {
                      live = false;
                    };
                    npc.on('die', _die);

                    let live = true;
                    const npcCleanup = () => {
                      if (live) {
                        const e = {
                          type: 'npcStatus',
                          id,
                          status: null,
                        };
                        const es = JSON.stringify(e);
                        c.send(es);

                        npc.removeListener('animation', _animation);
                        npc.removeListener('die', _die);

                        live = false;
                      }
                    };
                    npcCleanups[i] = npcCleanup;
                  }

                  trackedChunk[localCleanupSymbol] = () => {
                    for (let i = 0; i < npcCleanups.length; i++) {
                      const npcCleanup = npcCleanups[i];
                      npcCleanup();
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
                } else if (method === 'attackNpc') {
                  const [id, position, direction, damage] = args;

                  const npc = trackedNpcs[id];
                  if (npc) {
                    npc.hit(
                      new THREE.Vector3().fromArray(position),
                      new THREE.Vector3().fromArray(direction),
                      damage
                    );
                  }
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
            if (route.handle.name === 'serveNpcImg' || route.handle.name === 'serveNpcSfx') {
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
