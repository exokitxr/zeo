const events = require('events');
const {EventEmitter} = events;
const path = require('path');
const fs = require('fs');

const NUM_CELLS = 32;

class Mobs {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app, ws, wss} = archae.getCore();
    const {three, utils: {hash: hashUtils}} = zeo;
    const {THREE} = three;
    const {murmur} = hashUtils;

    const upVector = new THREE.Vector3(0, 1, 0);
    const forwardVector = new THREE.Vector3(0, 0, -1);
    const backVector = new THREE.Vector3(0, 0, 1);
    const zeroQuaternion = new THREE.Quaternion();

    const _readdir = p => new Promise((accept, reject) => {
      fs.readdir(p, (err, files) => {
        if (!err) {
          accept(files);
        } else {
          reject(err);
        }
      });
    });

    const ANIMALS = [
      /* 'ammonite', */
      'badger',
      'bear',
      'beetle',
      /* 'bigfish', */
      'boar',
      'bunny',
      'chick',
      'chicken',
      'cow',
      /* 'cubelet', */
      'deer',
      /* 'dungeon_master', */
      'elephant',
      /* 'fish',
      'ghost', */
      'giraffe',
      /* 'gull', */
      'horse',
      'mammoth',
      /* 'oerrki',
      'penguin',
      'piranha',
      'pterodactyl', */
      'rat',
      'sheep',
      'skunk',
      'smallbird',
      'spider',
      /* 'swamplurker', */
      'turtle',
      /* 'trilobite', */
      'velociraptor',
      /* 'villager',
      'walker',
      'warthog',
      'wasp',
      'whale',
      'witch', */
      'wolf',
      /* 'zombie',
      'zombie_brute', */
    ];

    return _readdir(path.join(__dirname, 'lib', 'npc', 'img'))
      .then(npcImgFiles => npcImgFiles.map(npcImgFile => npcImgFile.replace(/\.png$/, '')))
      .then(npcs => {
        const mobNpcImgStatic = express.static(path.join(__dirname, 'lib', 'npc', 'img'));
        function serveMobNpcImg(req, res, next) {
          // const file = files[Math.floor((murmur(req.url) / 0xFFFFFFFF) * files.length)];
          // const file = 'ertsefwe-skin_20170713132536186718.png';
          // req.url = path.join('/', file);

          mobNpcImgStatic(req, res, next);
        }
        app.use('/archae/mobs/npc/img', serveMobNpcImg);

        const mobAnimalImgStatic = express.static(path.join(__dirname, 'lib', 'animal', 'img'));
        function serveMobAnimalImg(req, res, next) {
          mobAnimalImgStatic(req, res, next);
        }
        app.use('/archae/mobs/animal/img', serveMobAnimalImg);
        const mobAnimalModelsStatic = express.static(path.join(__dirname, 'lib', 'animal', 'models'));
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
            const headRotationEnd = new THREE.Quaternion().setFromEuler(new THREE.Euler(
              (-0.5 + Math.random()) * 2 * Math.PI/4,
              (-0.5 + Math.random()) * 2 * Math.PI/2,
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
            this.emit('animation', animation);

            this.position = positionEnd;
            this.rotation = rotationEnd;
            this.headRotation = headRotationEnd;

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
              this.emit('animation', animation);

              this.position = positionEnd;
              this.rotation = rotationEnd;
              this.headRotation = headRotationEnd;
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

            const mobs = (() => {
              const numNpcs = Math.floor(1 + Math.random() * (2 + 1));
              const result = Array(numNpcs);
              for (let i = 0; i < numNpcs; i++) {
                const id = _makeId();

                const type = Math.floor() < 0.25 ? 'npc' : 'animal';
                const skinName = type === 'npc' ? npcs[Math.floor(Math.random() * npcs.length)] : ANIMALS[Math.floor(Math.random() * ANIMALS.length)]

                const dx = Math.random() * NUM_CELLS;
                const dz = Math.random() * NUM_CELLS;

                const ax = (ox * NUM_CELLS) + dx;
                const az = (oz * NUM_CELLS) + dz;
                const position = new THREE.Vector3(ax, 0, az);
                const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0, 'YXZ'));
                const headRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
                  (-0.5 + Math.random()) * 2 * Math.PI/4,
                  (-0.5 + Math.random()) * 2 * Math.PI/2,
                  0,
                  'YXZ'
                ));

                const mob = new Mob(id, type, skinName, position, rotation, headRotation, 100);
                result[i] = mob;
              }
              return result;
            })();
            this.mobs = mobs;

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
            const {mobs} = this;
            for (let i = 0; i < mobs.length; i++) {
              const mob = mobs[i];
              mob.destroy();
            }

            this.emit('destroy');
          }
        }

        const connections = [];

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
                  const index = ox + ':' + oz;
                  let trackedChunk = trackedChunks[index];
                  if (!trackedChunk) {
                    trackedChunk = new TrackedChunk(ox, oz);
                    trackedChunks[index] = trackedChunk;
                    trackedChunk.on('destroy', () => {
                      delete trackedChunks[index];

                      const {mobs} = trackedChunk;
                      for (let i = 0; i < mobs.length; i++) {
                        const mob = mobs[i];
                        const {id} = mob;
                        delete trackedMobs[id];
                      }
                    });

                    const {mobs} = trackedChunk;
                    for (let i = 0; i < mobs.length; i++) {
                      const mob = mobs[i];
                      const {id} = mob;
                      trackedMobs[id] = mob;

                      mob.on('die', () => {
                        mobs.splice(mobs.indexOf(mob), 1);
                        delete trackedMobs[id];
                      });
                    }
                  }

                  const {mobs} = trackedChunk;
                  const  mobCleanups = Array(mobs.length);
                  for (let i = 0; i < mobs.length; i++) {
                    const mob = mobs[i];
                    const {id, type, skinName, position, rotation, headRotation} = mob;

                    const e = {
                      type: 'mobAdd',
                      id,
                      spec: {
                        type: type,
                        skinName: skinName,
                        position: position.toArray(),
                        rotation: rotation.toArray(),
                        headRotation: headRotation.toArray(),
                      },
                    };
                    const es = JSON.stringify(e);
                    c.send(es);

                    const _animation = animation => {
                      const {mode, positionStart, positionEnd, rotationStart, rotationEnd, headRotationStart, headRotationEnd, duration} = animation;
                      const e = {
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
                      };
                      const es = JSON.stringify(e);
                      c.send(es);
                    };
                    mob.on('animation', _animation);
                    const _die = () => {
                      live = false;
                    };
                    mob.on('die', _die);

                    let live = true;
                    const mobCleanup = () => {
                      if (live) {
                        if (c.readyState === ws.OPEN) {
                          const e = {
                            type: 'mobRemove',
                            id,
                          };
                          const es = JSON.stringify(e);
                          c.send(es);
                        }

                        mob.removeListener('animation', _animation);
                        mob.removeListener('die', _die);

                        live = false;
                      }
                    };
                    mobCleanups[i] = mobCleanup;
                  }

                  trackedChunk[localCleanupSymbol] = () => {
                    for (let i = 0; i < mobCleanups.length; i++) {
                      const mobCleanup = mobCleanups[i];
                      mobCleanup();
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
                trackedChunk[localCleanupSymbol]();
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
            if (route.handle.name === 'serveMobNpcImg' || route.handle.name === 'serveMobAnimalImg' || route.handle.name === 'serveMobSfx') {
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

module.exports = Mobs;
