const idUtils = require('./lib/idUtils');

const FRAME_RATE = 60;
const TICK_TIME = 1000 / FRAME_RATE;

const engineKey = null;

class AnyikythClient {
  mount() {
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

        const position = new THREE.Vector3();
        if (opts.position) {
          position.fromArray(opts.position);
        }
        this.position = position;

        const rotation = new THREE.Quaternion();
        if (opts.rotation) {
          rotation.fromArray(opts.rotation);
        }
        this.rotation = rotation;

        const linearVelocity = new THREE.Vector3();
        if (opts.linearVelocity) {
          linearVelocity.fromArray(opts.linearVelocity);
        }
        this.linearVelocity = linearVelocity;

        const angularVelocity = new THREE.Vector3();
        if (opts.angularVelocity) {
          angularVelocity.fromArray(opts.angularVelocity);
        }
        this.angularVelocity = angularVelocity;

        _request('create', [type, id, _except(opts, ['id'])], _warnError);
      }

      update({position, rotation, linearVelocity, angularVelocity}) {
        this.position.fromArray(position);
        this.rotation.fromArray(rotation);
        this.linearVelocity.fromArray(linearVelocity);
        this.angularVelocity.fromArray(angularVelocity);
      }

      setObject(object) {
        const {position, rotation} = object;

        this.position = position;
        this.rotation = rotation;
        this.linearVelocity = new THREE.Vector3();
        this.angularVelocity = new THREE.Vector3();
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

    const engine = new Engine({
      id: null,
    });

    const _makeBody = mesh => {
      const {geometry} = mesh;
      const {type} = geometry;

      switch (type) {
        case 'Plane': {
          const position = mesh.position.toArray();
          const rotation = mesh.rotation.toArray();

          return new Plane({
            position,
            rotation,
            dimensions: [0, 0, 1],
            mass: 1,
          });
        }
        case 'Box': {
          const position = mesh.position.toArray();
          const rotation = mesh.rotation.toArray();
          const {parameters: {width, height, depth}} = geometry;

          return new Box({
            position,
            rotation,
            dimensions: [width, height, depth],
            mass: 1,
          });
        }
        case 'Sphere': {
          const position = mesh.position.toArray();
          const rotation = mesh.rotation.toArray();
          const {parameters: {radius}} = geometry;

          return new Box({
            position,
            rotation,
            size: radius,
            mass: 1,
          });
        }
        default: throw new Error('unsupported mesh type: ' + JSON.stringify(type));
      }
    };
    const _makeConvexHullBody = mesh => {
      const position = mesh.position.toArray();
      const rotation = mesh.rotation.toArray();
      const points = _getGeometryPoints(mesh.geometry);

      return new ConvexHull({
        position,
        rotation,
        points,
        mass: 1,
      });
    };
    const _makeTriangleMeshBody = mesh => {
      const position = mesh.position.toArray();
      const rotation = mesh.rotation.toArray();
      const points = _getGeometryPoints(mesh.geometry);

      return new TriangleMesh({
        position,
        rotation,
        points,
        mass: 1,
      });
    };

    const _requestWorld = worldId => new Promise((accept, reject) => {
      const world = new World({
        id: worldId,
      });
      world.Plane = Plane;
      world.Box = Box;
      world.Sphere = Sphere;
      world.ConvexHull = ConvexHull;
      world.TriangleMesh = TriangleMesh;
      world.makeBody = _makeBody;
      world.makeConvexHullBody = _makeConvexHullBody;
      world.makeTriangleMeshBody = _makeTriangleMeshBody;

      accept(world);
    });
    const _releaseWorld = worldId => new Promise((accept, reject) => {
      _request('remove', [null, worldId], err => {
        if (!err) {
          _request('destroy', [worldId], err => {
            if (!err) {
              accept();
            } else {
              reject(err);
            }
          });
        } else {
          reject(err);
        }
      });
    });

    let connection = null;
    let queue = [];
    const _ensureConnection = () => {
      if (!connection) {
        connection = new WebSocket('ws://' + location.host + '/archae/antikythWs');
        connection.onopen = () => {
          if (queue.length > 0) {
            for (let i = 0; i < queue.length; i++) {
              const e = queue[i];
              const es = JSON.stringify(e);
              connection.send(es);
            }

            queue = [];
          }
        };
        connection.onerror = err => {
          connection = null;

          console.warn(err);
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
      }
    };

    const requestHandlers = new Map();
    const _request = (method, args, cb) => {
      _ensureConnection();

      const id = idUtils.makeId();

      const e = {
        method,
        id,
        args,
      };
      if (connection.readyState === WebSocket.OPEN) {
        const es = JSON.stringify(e);
        connection.send(es);
      } else {
        queue.push(e);
      }

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
  }

  unmount() {
    this._cleanup();
  }
}

const _except = (o, excepts) => {
  const result = {};

  for (const k in o) {
    if (!excepts.includes(k)) {
      result[k] = o[k];
    }
  }

  return result;
};

const _getGeometryPoints = geometry => {
  if (!(geometry instanceof BufferGeometry)) {
    geometry = new THREE.BufferGeometry().fromGeometry(geometry);
  }
  return Array.from(geometry.getAttribute('position').array);
};

const _warnError = err => {
  if (err) {
    console.warn(err);
  }
};

module.exports = AnyikythClient;
