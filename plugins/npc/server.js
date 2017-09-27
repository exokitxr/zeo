const events = require('events');
const {EventEmitter} = events;
const path = require('path');
const fs = require('fs');

const animalLib = require('animal-js');

const NUM_CELLS = 16;
const GENERATOR_PLUGIN = 'plugins-generator';

class Mobs {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app, ws, wss} = archae.getCore();
    const {three, elements, multiplayer, utils: {js: {mod}}} = zeo;
    const {THREE} = three;

    const animal = animalLib(THREE);

    const upVector = new THREE.Vector3(0, 1, 0);
    const backVector = new THREE.Vector3(0, 0, 1);
    const zeroQuaternion = new THREE.Quaternion();
    const localVector = new THREE.Vector3();

    const _readdir = p => new Promise((accept, reject) => {
      fs.readdir(p, (err, files) => {
        if (!err) {
          accept(files);
        } else {
          reject(err);
        }
      });
    });
    const _getTrackedChunkIndex = (x, z) => (mod(x, 0xFFFF) << 16) | mod(z, 0xFFFF);

    return Promise.all([
      elements.requestElement(GENERATOR_PLUGIN),
      _readdir(path.join(__dirname, 'lib', 'npc', 'img'))
        .then(npcImgFiles => npcImgFiles.map(npcImgFile => npcImgFile.replace(/\.png$/, '')))
    ])
      .then(([
        generatorElement,
        npcs,
      ]) => {
        const mobNpcImgStatic = express.static(path.join(__dirname, 'lib', 'npc', 'img'));
        function serveMobNpcImg(req, res, next) {
          // const file = files[Math.floor((murmur(req.url) / 0xFFFFFFFF) * files.length)];
          // const file = 'ertsefwe-skin_20170713132536186718.png';
          // req.url = path.join('/', file);

          mobNpcImgStatic(req, res, next);
        }
        app.use('/archae/mobs/npc/img', serveMobNpcImg);

        const mobAnimalImgStatic = express.static(path.join(animal.DATA_PATH, 'lib', 'img'));
        function serveMobAnimalImg(req, res, next) {
          mobAnimalImgStatic(req, res, next);
        }
        app.use('/archae/mobs/animal/img', serveMobAnimalImg);
        const mobAnimalModelsStatic = express.static(path.join(animal.DATA_PATH, 'lib', 'models'));
        function serveMobAnimalModels(req, res, next) {
          mobAnimalModelsStatic(req, res, next);
        }
        app.use('/archae/mobs/animal/models', serveMobAnimalModels);

        const mobSfxStatic = express.static(path.join(__dirname, 'lib', 'sfx'));
        function serveMobSfx(req, res, next) {
          mobSfxStatic(req, res, next);
        }
        app.use('/archae/mobs/sfx', serveMobSfx);

        const trackedChunks = {};
        const trackedMobs = {};
        const _forEachMobInChunk = (trackedChunk, fn) => {
          for (const id in trackedMobs) {
            const mob = trackedMobs[id];
            if (Math.floor(mob.position.x / NUM_CELLS) === trackedChunk.ox && Math.floor(mob.position.z / NUM_CELLS) === trackedChunk.oz) {
              fn(mob);
            }
          }
        };
        
        class Mob extends EventEmitter {
          constructor(id, type, skinName, position, rotation, headRotation, health) {
            super();

            this.id = id;
            this.type = type;
            this.skinName = skinName;
            this.position = position;
            this.rotation = rotation;
            this.headRotation = headRotation;
            this.health = health;

            this.timeout = null;
            this.animation = null;
            this.animationStartTime = 0;

            this.wait();
          }

          wait() {
            this.timeout = setTimeout(() => {
              this.timeout = null;

              this.walk();
            }, 1000 + Math.random() * 4000);
          }

          walk() {
            const {position, rotation, headRotation} = this;

            const distance = 2 + Math.random() * 10;
            const positionEnd = position.clone()
              .add(
                localVector.set(
                  -0.5 + Math.random(),
                  0,
                  -0.5 + Math.random(),
                ).normalize().multiplyScalar(distance)
              );
            positionEnd.y = generatorElement.getElevation(positionEnd.x, positionEnd.z);

            _forEachConnectionTransplant(position, positionEnd, c => { // transplant connection views
              const {id, type, skinName, position, rotation, headRotation} = this;
              c.send(JSON.stringify({
                type: 'mobAdd',
                id,
                spec: {
                  type: type,
                  skinName: skinName,
                  position: position.toArray(),
                  rotation: rotation.toArray(),
                  headRotation: headRotation.toArray(),
                },
              }));
            }, c => {
              const {id} = this;
              c.send(JSON.stringify({
                type: 'mobRemove',
                id,
              }));
            });

            if (trackedChunks[_getTrackedChunkIndex(Math.floor(positionEnd.x / NUM_CELLS), Math.floor(positionEnd.z / NUM_CELLS))]) { // if mob is still viewed
              const rotationEnd = new THREE.Quaternion().setFromRotationMatrix(
                new THREE.Matrix4().lookAt(position, positionEnd, upVector)
              );
              const headRotationEnd = new THREE.Quaternion().setFromEuler(new THREE.Euler(
                (-0.5 + Math.random()) * 2 * Math.PI/4,
                (-0.5 + Math.random()) * 2 * Math.PI/4,
                0,
                'YXZ'
              ));
              const speed = (0.5 + Math.random() * 1.5) / 1000;
              const duration = distance / speed;

              const animation = {
                mode: 'walk',
                positionStart: position,
                positionEnd: positionEnd,
                rotationStart: rotation,
                rotationEnd: rotationEnd,
                headRotationStart: headRotation,
                headRotationEnd: headRotationEnd,
                duration: duration,
              };
              this.animation = animation;
              this.animationStartTime = Date.now();
              this.emit('animation', animation);

              this.position = positionEnd;
              this.rotation = rotationEnd;
              this.headRotation = headRotationEnd;

              this.timeout = setTimeout(() => {
                this.animation = null;

                this.wait();
              }, duration);
            } else {
              this.position = positionEnd;

              this.destroy();
            }
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
              const headRotation = zeroQuaternion;
              const headRotationEnd = zeroQuaternion;
              const duration = 500;

              const animation = {
                mode: 'hit',
                positionStart: position,
                positionEnd: positionEnd,
                rotationStart: rotation,
                rotationEnd: rotationEnd,
                headRotationStart: headRotation,
                headRotationEnd: headRotationEnd,
                duration: duration,
              };
              this.animation = animation;
              this.animationStartTime = Date.now();
              this.emit('animation', animation);

              this.position = positionEnd;
              this.rotation = rotationEnd;
              this.headRotation = headRotationEnd;
              this.health = health;

              this.timeout = setTimeout(() => {
                this.animation = null;

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
              const headRotation = zeroQuaternion;
              const headRotationEnd = zeroQuaternion;
              const duration = 1000;

              const animation = {
                mode: 'die',
                positionStart: position,
                positionEnd: positionEnd,
                rotationStart: rotation,
                rotationEnd: rotationEnd,
                headRotationStart: headRotation,
                headRotationEnd: headRotationEnd,
                duration: duration,
              };
              this.animation = animation;
              this.emit('animation', animation);

              this.emit('die');
            }
          }

          destroy() {
            this.emit('destroy');

            clearTimeout(this.timeout);
          }
        }
        class TrackedChunk extends EventEmitter {
          constructor(ox, oz) {
            super();

            this.ox = ox;
            this.oz = oz;

            this.refCount = 0;
          }

          generateMobs() {
            const hasNpcs = Math.random() < 0.2;
            if (hasNpcs) {
              const numNpcs = Math.floor(1 + Math.random() * (2 + 1));
              for (let i = 0; i < numNpcs; i++) {
                const id = _makeId();

                const type = Math.random() < 0.25 ? 'npc' : 'animal';
                const skinName = type === 'npc' ?
                  npcs[Math.floor(Math.random() * npcs.length)]
                :
                  animal.ANIMALS[Math.floor(Math.random() * animal.ANIMALS.length)];

                const dx = Math.random() * NUM_CELLS;
                const dz = Math.random() * NUM_CELLS;

                const ax = (this.ox * NUM_CELLS) + dx;
                const az = (this.oz * NUM_CELLS) + dz;
                const position = new THREE.Vector3(ax, generatorElement.getElevation(ax, az), az);
                const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0, 'YXZ'));
                const headRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
                  (-0.5 + Math.random()) * 2 * Math.PI/4,
                  (-0.5 + Math.random()) * 2 * Math.PI/2,
                  0,
                  'YXZ'
                ));

                const mob = new Mob(id, type, skinName, position, rotation, headRotation, 100);
                mob.on('animation', animation => {
                  _forEachBoundConnection(mob, c => {
                    if (c.readyState === ws.OPEN) {
                      const {mode, positionStart, positionEnd, rotationStart, rotationEnd, headRotationStart, headRotationEnd, duration} = animation;
                      c.send(JSON.stringify({
                        type: 'mobAnimation',
                        id,
                        animation: {
                          mode,
                          positionStart: positionStart.toArray(),
                          positionEnd: positionEnd.toArray(),
                          rotationStart: rotationStart.toArray(),
                          rotationEnd: rotationEnd.toArray(),
                          headRotationStart: headRotationStart.toArray(),
                          headRotationEnd: headRotationEnd.toArray(),
                          duration,
                        },
                      }));
                    }
                  });
                });
                mob.on('destroy', () => {
                  _forEachBoundConnection(mob, c => {
                    if (c.readyState === ws.OPEN) {
                      c.send(JSON.stringify({
                        type: 'mobRemove',
                        id,
                      }));
                    }
                  });

                  delete trackedMobs[id];
                });
                mob.on('die', () => {
                  delete trackedMobs[id];
                });
                trackedMobs[id] = mob;

                let found1 = false;
                let found2 = false;
                _forEachBoundConnection(mob, c => {
                  found1 = true;
                  if (c.readyState === ws.OPEN) {
                    found2 = true;
                    const {id, type, skinName, position, rotation, headRotation} = mob;
                    c.send(JSON.stringify({
                      type: 'mobAdd',
                      id,
                      spec: {
                        type: type,
                        skinName: skinName,
                        position: position.toArray(),
                        rotation: rotation.toArray(),
                        headRotation: headRotation.toArray(),
                      },
                    }));
                  }
                });
                if (!found2) {
                  throw new Error('add new mob with no target');
                }
              }
            }
          }

          addRef() {
            if (++this.refCount === 1) {
              this.generateMobs();
            }
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
        const _forEachBoundConnection = (mob, fn) => {
          const position = mob.animation ? mob.animation.positionEnd : mob.position;
          const index = _getTrackedChunkIndex(Math.floor(position.x / NUM_CELLS), Math.floor(position.z / NUM_CELLS));
          for (let i = 0; i < connections.length; i++) {
            const connection = connections[i];
            if (connection.localTrackedChunks[index]) {
              fn(connection);
            }
          }
        };
        const _forEachConnectionTransplant = (startPosition, endPosition, addFn, removeFn) => {
          const sox = Math.floor(startPosition.x / NUM_CELLS);
          const soz = Math.floor(startPosition.z / NUM_CELLS);
          const startIndex = _getTrackedChunkIndex(sox, soz);

          const eox = Math.floor(endPosition.x / NUM_CELLS);
          const eoz = Math.floor(endPosition.z / NUM_CELLS);
          const endIndex = _getTrackedChunkIndex(eox, eoz);

          if (startIndex !== endIndex) {
            for (let i = 0; i < connections.length; i++) {
              const connection = connections[i];
              const hadStart = Boolean(connection.localTrackedChunks[startIndex]);
              const hadEnd = Boolean(connection.localTrackedChunks[endIndex]);
              if (!hadStart && hadEnd) {
                addFn(connection);
              } else if (hadStart && !hadEnd) {
                removeFn(connection);
              }
            }
          }
        };

        const _connection = c => {
          const {url} = c.upgradeReq;

          if (url === '/archae/mobsWs') {
            const localTrackedChunks = {};
            c.localTrackedChunks = localTrackedChunks;

            const localCleanupSymbol = Symbol();

            c.on('message', msg => {
              const m = JSON.parse(msg);

              if (typeof m === 'object' && m !== null && m.method && m.args) {
                const {method, args} = m;

                if (method === 'addChunk') {
                  const [ox, oz] = args;
                  const index = _getTrackedChunkIndex(ox, oz);
                  let trackedChunk = trackedChunks[index];
                  if (!trackedChunk) {
                    trackedChunk = new TrackedChunk(ox, oz);
                    trackedChunks[index] = trackedChunk;
                    trackedChunk.on('destroy', () => {
                      for (const index in trackedMobs) {
                        const mob = trackedMobs[index];
                        if (Math.floor(mob.position.x / NUM_CELLS) === trackedChunk.ox && Math.floor(mob.position.z / NUM_CELLS) === trackedChunk.oz) {
                          mob.destroy();
                        }
                      }

                      delete trackedChunks[index];
                    });
                  }

                  localTrackedChunks[index] = trackedChunk;
                  trackedChunk.addRef();
                } else if (method === 'removeChunk') {
                  const [ox, oz] = args;

                  const index = _getTrackedChunkIndex(ox, oz);
                  const trackedChunk = localTrackedChunks[index];
                  if (trackedChunk) {
                    delete localTrackedChunks[index];

                    _forEachMobInChunk(trackedChunk, mob => {
                      const {id} = mob;
                      c.send(JSON.stringify({
                        type: 'mobRemove',
                        id,
                      }));
                    });

                    trackedChunk.removeRef();
                  }
                } else if (method === 'attackMob') {
                  const [id, position, direction, damage] = args;

                  const mob = trackedMobs[id];
                  if (mob) {
                    mob.hit(
                      new THREE.Vector3().fromArray(position),
                      new THREE.Vector3().fromArray(direction),
                      damage
                    );
                  }
                } else {
                  console.warn('mob invalid message type', {type});
                }
              } else {
                console.warn('mob invalid message', {msg});
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

        const _updateAi = mob => {
          for (const status of multiplayer.getPlayerStatuses().values()) {
            const {hmd} = status;
            const {position: hmdPosition} = hmd;

            const position = mob.animation ?
              mob.animation.positionStart.clone().lerp(mob.animation.positionEnd, Math.min(Math.max((Date.now() - mob.animationStartTime) / mob.animation.duration, 0), 1))
            :
              mob.position.clone();
            if (position.distanceTo(hmdPosition) < 5) {
              const rotation = mob.animation ?
                mob.animation.rotationStart.clone().slerp(mob.animation.rotationEnd, Math.min((Date.now() - mob.animationStartTime) / mob.animation.duration, 1))
              :
                mob.rotation.clone();
              const hmdPositionXZ = new THREE.Vector3(hmdPosition.x, 0, hmdPosition.z);
              const positionEnd = hmdPositionXZ.clone().add(
                new THREE.Vector3(position.x, 0, position.z).sub(hmdPositionXZ).normalize()
              );
              positionEnd.y = generatorElement.getElevation(positionEnd.x, positionEnd.z);
              const rotationEnd = new THREE.Quaternion().setFromRotationMatrix(
                new THREE.Matrix4().lookAt(
                  new THREE.Vector3(positionEnd.x, 0, positionEnd.z),
                  new THREE.Vector3(hmdPosition.x, 0, hmdPosition.z),
                  upVector
                )
              );
              const headRotation = mob.animation ?
                mob.animation.headRotationStart.clone().slerp(mob.animation.headRotationEnd, Math.min((Date.now() - mob.animationStartTime) / mob.animation.duration, 1))
              :
                mob.headRotation.clone();
              const headRotationEnd = new THREE.Quaternion().setFromRotationMatrix(
                new THREE.Matrix4().lookAt(
                  new THREE.Vector3(positionEnd.x, positionEnd.y + 1, positionEnd.z), // XXX use the model bounding box to estimate the head offset
                  hmdPosition,
                  upVector
                )
              ).premultiply(rotationEnd.clone().inverse()).inverse();
              const distance = position.distanceTo(positionEnd);
              const speed = (0.5 + Math.random() * 1.5) / 1000;
              const duration = (distance / speed) + 100;

              const animation = {
                mode: 'walk',
                positionStart: position,
                positionEnd: positionEnd,
                rotationStart: rotation,
                rotationEnd: rotationEnd,
                headRotationStart: headRotation,
                headRotationEnd: headRotationEnd,
                duration: duration,
              };
              mob.animation = animation;
              mob.animationStartTime = Date.now();
              mob.emit('animation', animation);

              mob.position = positionEnd;
              mob.rotation = rotationEnd;
              mob.headRotation = headRotationEnd;

              if (mob.timeout) {
                clearTimeout(mob.timeout);
              }
              mob.timeout = setTimeout(() => {
                mob.timeout = null;

                if (!_updateAi(mob)) {
                  mob.wait();
                }
              }, duration);

              return true;
            }
          }
          return false;
        };
        const aiInterval = setInterval(() => {
          for (const id in trackedMobs) {
            _updateAi(trackedMobs[id]);
          }
        }, 1000);

        this._cleanup = () => {
          function removeMiddlewares(route, i, routes) {
            if (route.handle.name === 'serveMobNpcImg' || route.handle.name === 'serveMobAnimalImg' || route.handle.name === 'serveMobSfx') {
              routes.splice(i, 1);
            }
            if (route.route) {
              route.route.stack.forEach(removeMiddlewares);
            }
          }
          app._router.stack.forEach(removeMiddlewares);

          wss.removeListener('connection', _connection);

          clearInterval(aiInterval);
        };
      });
  }

  unmount() {
    this._cleanup();
  }
}
const _makeId = () => Math.random().toString(36).substring(7);

module.exports = Mobs;
