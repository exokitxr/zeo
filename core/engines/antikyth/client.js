const idUtils = require('./lib/idUtils');

const FRAME_RATE = 60;
const TICK_TIME = 1000 / FRAME_RATE;

const engineKey = null;

class AnyikythClient {
  mount() {
    return new Promise((accept, reject) => {
      const worlds = new Map();
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
        }
      }

      class World extends Entity {
        constructor(opts = {}) {
          super(opts.id);

          const {id} = this;

          _request('create', ['world', id, _except(opts, ['id'])], _warnError);

          this.bodies = new Map();
          this.timeout = null;
          this.listen();

          worlds.set(id, this);
        }

        add(body) {
          Entity.prototype.add.call(this, body);

          const {id: bodyId} = body;
          this.bodies.set(bodyId, body);
        }

        remove(body) {
          Entity.prototype.remove.call(this, body);

          const {id: bodyId} = body;
          this.bodies.delete(bodyId);
        }

        listen() {
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
        }

        destroy() {
          if (this.timeout) {
            clearTimeout(this.timeout);
          }

          worlds.delete(id);
        }
      }
      Engine.World = World;

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

      class Sphere extends Body {
        constructor(opts = {}) {
          super('sphere', opts);
        }
      }

      class Box extends Body {
        constructor(opts = {}) {
          super('box', opts);
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

      const _requestWorld = new Promise((accept, reject) => {
        const world = new World();
        world.Plane = Plane;
        world.Sphere = Sphere;
        world.Box = Box;
        world.ConvexHull = ConvexHull;
        world.TriangleMesh = TriangleMesh;

        accept(world);
      });
      const _releaseWorld = new Promise((acept, reject) => {
        // XXX
      });

      const connection = new WebSocket('ws://' + location.host + '/archae/antikythWs');
      connection.onopen = () => {
        const api = {
          requestWorld: _requestWorld,
          releaseWorld: _releaseWorld,
        };
        accept(api);
      };
      connection.onerror = err => {
        reject(err);
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

        worlds.forEach(world => {
          world.destroy();
        });
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
