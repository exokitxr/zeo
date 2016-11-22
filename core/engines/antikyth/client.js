const idUtils = require('./lib/idUtils');

const FRAME_RATE = 60;
const TICK_TIME = 1000 / FRAME_RATE;

const engineKey = null;

class AnyikythClient {
  mount() {
    return new Promise((accept, reject) => {
      const engine = new Engine({
        id: null,
      });

      class Entity {
        constructor(id = idUtils.makeId()) {
          this.id = id;
        }

        add(child) {
          const {id: parentId} = this;
          const {id: childId} = child;

          _request('add', [parentId, childId], _warnError);
        }

        remove(child) {
          const {id: parentId} = this;
          const {id: childId} = child;

          _request('remove', [parentId, childId], _warnError);
        }
      }

      class Engine extends Entity {
        constructor(opts = {}) {
          super(opts.id);

          this.worlds = new Map();
        }

        add(world) {
          Entity.prototype.add.call(this, world);

          const {id: worldId} = world;
          this.worlds.set(worldId, world);
        }

        remove(world) {
          Entity.prototype.remove.call(this, world);

          const {id: worldId} = world;
          this.worlds.delete(worldId);
        }

        destroy() {
          this.worlds.forEach(world => {
            world.destroy();
          });
        }
      }

      class World extends Entity {
        constructor(opts = {}) {
          super(opts.id);

          const {id} = this;

          this.bodies = new Map();
          this.running = false;
          this.timeout = null;

          _request('create', ['world', id, _except(opts, ['id'])], _warnError);

          engine.add(this);
        }

        add(body) {
          Entity.prototype.add.call(this, body);

          const {id: bodyId} = body;
          this.bodies.set(bodyId, body);

          if (!this.running) {
            this.start();
          }
        }

        remove(body) {
          Entity.prototype.remove.call(this, body);

          const {id: bodyId} = body;
          this.bodies.delete(bodyId);

          if (this.bodies.size === 0) {
            this.stop();
          }
        }

        start() {
          let lastUpdateTime = null;
          const _recurse = () => {
            const timeUntilNextUpdate = (() => {
              if (lastUpdateTime === null) {
                return 0;
              } else {
                const now = Date.now();
                const timeSinceLastUpdate = now - lastUpdateTime;
                return Math.max(TICK_TIME - timeSinceLastUpdate, 0);
              }
            })();

            const _requestUpdate = () => {
              _request('requestUpdate', [this.id], (err, updates) => {
                for (let i = 0; i < updates.length; i++) {
                  const update = updates[i];
                  const {id} = update;

                  const body = this.bodies.get(id);
                  if (body) {
                    const {position, rotation, linearVelocity, angularVelocity} = update;
                    body.update({position, rotation, linearVelocity, angularVelocity});
                  } else {
                    console.warn('invalid body update:', JSON.stringify(id));
                  }
                }

                lastUpdateTime = Date.now();

                _recurse();
              });
            };

            if (timeUntilNextUpdate === 0) {
              _requestUpdate();
            } else {
              this.timeout = setTimeout(() => {
                _requestUpdate();

                this.imeout = null;
              }, FRAME_RATE);
            }
          };
          _recurse();

          this.running = true;
        }

        stop() {
          if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
          }

          this.running = false;
        }

        destroy() {
          if (this.running) {
            this.stop();
          }
        }
      }

      class Body extends Entity {
        constructor(type, opts = {}) {
          super(opts.id);

          const {id} = this;

          _request('create', [type, id, _except(opts, ['id'])], _warnError);
        }

        update({position, rotation, linearVelocity, angularVelocity}) {
          // XXX copy vectors here
          this.position = position;
          this.rotation = rotation;
          this.linearVelocity = linearVelocity;
          this.angularVelocity = angularVelocity;
        }

        setPosition(position) {
          const {id} = this;

          _request('setPosition', [id, position], _warnError);
        }

        setRotation(rotation) {
          const {id} = this;

          _request('setRotation', [id, rotation], _warnError);
        }

        setLinearVelocity(linearVelocity) {
          const {id} = this;

          _request('setLinearVelocity', [id, linearVelocity], _warnError);
        }

        setAngularVelocity(angularVelocity) {
          const {id} = this;

          _request('setAngularVelocity', [id, angularVelocity], _warnError);
        }
      }

      class Plane extends Body {
        constructor(opts = {}) {
          super('plane', opts);
        }
      }

      class Box extends Body {
        constructor(opts = {}) {
          super('box', opts);
        }
      }

      class Sphere extends Body {
        constructor(opts = {}) {
          super('sphere', opts);
        }
      }

      class ConvexHull extends Body {
        constructor(opts = {}) {
          super('convexHull', opts);
        }
      }

      class TriangleMesh extends Body {
        constructor(opts = {}) {
          super('triangleMesh', opts);
        }
      }

      const _requestWorld = worldId => new Promise((accept, reject) => {
        const _acceptWorld = () => {
          const world = new World({
            id: worldId,
          });
          world.Plane = Plane;
          world.Box = Box;
          world.Sphere = Sphere;
          world.ConvexHull = ConvexHull;
          world.TriangleMesh = TriangleMesh;

          world

          accept(world);
        };

        if (!connected) {
          _connect(err => {
            if (!err) {
              _acceptWorld();
            } else {
              reject(err);
            }
          });
        } else {
          _acceptWorld();
        }
      });
      const _releaseWorld = worldId => new Promise((accept, reject) => {
        _request('remove', [null, worldId], err => { // XXX this needs to destroy bodies attached to the world as well
          if (!err) {
            accept();
          } else {
            reject(err);
          }
        });
      });

      let connection = null;
      let connecting = false;
      let connectCbs = [];
      const _connect = cb => { // XXX queue here instead of blocking
        if (!connecting) {
          const cbs = err => {
            const oldConnectCbs = connectCbs;
            connectCbs = [];

            for (let i = 0; i < oldConnectCbs.length; i++) {
              const cb = oldConnectCbs[i];
              cb(err);
            }
          };

          connection = new WebSocket('ws://' + location.host + '/archae/antikythWs');
          connection.onopen = () => {
            connecting = false;

            cbs();
          };
          connection.onerror = err => {
            connection = null;
            connecting = false;

            cbs(err);
          };
          connection.onmessage = msg => {
            const m = JSON.parse(msg.data);
            const {id} = m;

            const requestHandler = requestHandlers.get(id);
            if (requestHandler) {
              const {error, result} = m;
              requestHandler(error, result);
            } else {
              console.warn('unregistered handler:', JSON.stringify(id));
            }
          };

          connecting = true;
        };

        connectCbs.push(cb);
      };

      const requestHandlers = new Map();
      const _request = (method, args, cb) => {
        const id = idUitls.makeId();

        const e = {
          method,
          id,
          args,
        };
        const es = JSON.stringify(e);
        connection.send(es);

        const requestHandler = (err, result) => {
          if (!err) {
            cb(null, result);
          } else {
            cb(err);
          }

          requestHandlers.delete(id);
        };
        requestHandlers.set(id, requestHandler);
      };

      this._cleanup = () => {
        connection.close();

        engine.destroy();
      };

      return {
        requestWorld: _requestWorld,
        releaseWorld: _releaseWorld,
      };
    });
  },
  unmount() {
    this._cleanup();
  },
});

const _except = (o, excepts) => {
  const result = {};

  for (const k in o) {
    if (!excepts.includes(k)) {
      result[k] = o[k];
    }
  }

  return result;
};

const _warnError = err => {
  if (err) {
    console.warn(err);
  }
};

module.exports = AnyikythClient;
