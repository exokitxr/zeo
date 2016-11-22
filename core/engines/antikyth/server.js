const Antikyth = require('antikyth');

const OPEN = 1; // ws.OPEN
const engineKey = null;

class Context {
  constructor() {
    this.objects = new Map();

    const engine = new Antikyth(opts);
    engine.clientId = id;
    this.setEngine(engine);
  }

  getEngine() {
    return this.objects.get(engineKey);
  }

  setEngine(engine) {
    this.objects.set(engineKey, engine);
  }

  hasRunnableObjects() {
    const {objects} = this;

    const _hasInstanceOf = type => {
      for (k of objects) {
        const v = objects.get(k);
        if (v instanceof type) {
          return true;
        }
      }
      return false;
    };

    return _hasInstanceOf(Antikyth.World) && _hasInstanceOf(Antikyth.Body);
  }

  create(type, id, opts) {
    const object = (() => {
      switch (type) {
        case 'world': {
          const world = new Antikyth.World(opts);
          world.clientId = id;
          return world;
        }
        case 'plane': {
          const plane = new Antikyth.Plane(opts);
          plane.clientId = id;
          return plane;
        }
        case 'box': {
          const box = new Antikyth.Box(opts);
          box.clientId = id;
          return box;
        }
        case 'sphere': {
          const sphere = new Antikyth.Sphere(opts);
          sphere.clientId = id;
          return sphere;
        }
        case 'convexHull': {
          const convexHull = new Antikyth.ConvexHull(opts);
          convexHull.clientId = id;
          return convexHull;
        }
        case 'triangleMesh': {
          const triangleMesh = new Antikyth.TriangleMesh(opts);
          triangleMesh.clientId = id;
          return triangleMesh;
        }
        default: return null;
      }
    })();

    const {clientId} = object;
    this.objects.set(clientId, object);

    const engine = this.getEngine();
    if (!engine.running && this.hasRunnableObjects()) {
      engine.start();
    }
  }

  destroy(id) {
    const {objects} = this;

    const object = objects.get(id);
    if (object instanceof Antikyth) {
      object.stop();
      object.destroy();
    }

    objects.delete(id);

    const engine = this.getEngine();
    if (engine.running && !this.hasRunnableObjects()) {
      engine.stop();
    }
  }

  add(parentId, childId) {
    const {objects} = this;

    const parent = objects.get(parentId);
    const child = objects.get(childId);
    parent.add(child);
  }

  remove(parentId, childId) {
    const {objects} = this;

    const parent = objects.get(parentId);
    const child = objects.get(childId);
    parent.remove(child);
  }

  setPosition(id, position) {
    const {objects} = this;

    const object = objects.get(id);
    object.setPosition(position);
  }

  setRotation(id, rotation) {
    const {objects} = this;

    const object = objects.get(id);
    object.setRotation(rotation);
  }

  setLinearVelocity(id, linearVelocity) {
    const {objects} = this;

    const object = objects.get(id);
    object.setLinearVelocity(linearVelocity);
  }

  setAngularVelocity(id, angularVelocity) {
    const {objects} = this;

    const object = objects.get(id);
    object.setAngularVelocity(angularVelocity);
  }

  requestUpdate(id, cb) {
    const {objects} = this;

    const object = objects.get(id);
    object.requestUpdate();
    object.once('update', updates => {
      cb(null, updates);
    });
  }
}

class AntikythServer {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {wss} = archae.getCore();

    const context = new Context();

    const connections = [];

    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      if (url === '/archae/antikythWs') {
        c.on('message', s => {
          const m = JSON.parse(s);
          if (typeof m === 'object' && m && typeof m.method === 'string' && typeof m.id === 'string' && Array.isArray(m.args)) {
            const {method, id, args} = m;

            const cb = (err = null, result = null) => {
              if (c.readyState === OPEN) {
                const e = {
                  id: id,
                  error: err,
                  result: result,
                };
                const es = JSON.stringify(e);
                c.send(es);
              }
            };

            if (method === 'create') {
              const [type, id, opts] = args;
              context.create(type, id, opts);

              cb();
            } else if (method === 'destroy') {
              const [id] = args;
              context.destroy(id);

              cb();
            } else if (method === 'add') {
              const [parentId, childId] = args;
              context.add(parentId, childId);

              cb();
            } else if (method === 'remove') {
              const [parentId, childId] = args;
              context.remove(parentId, childId);

              cb();
            } else if (method === 'setPosition') {
              const [id, position] = args;
              context.setPosition(id, position);

              cb();
            } else if (method === 'setRotation') {
              const [id, rotation] = args;
              context.setRotation(id, rotation);

              cb();
            } else if (method === 'setLinearVelocity') {
              const [id, linearVelocity] = args;
              context.setLinearVelocity(id, linearVelocity);

              cb();
            } else if (method === 'setAngularVelocity') {
              const [id, angularVelocity] = args;
              context.setAngularVelocity(id, angularVelocity);

              cb();
            } else if (method === 'requestUpdate') {
              const [id] = args;
              context.requestUpdate(id, updates => {
                if (live) {
                  cb(null, updates);
                }
              });

              cb();
            } else {
              const err = new Error('no such method:' + JSON.stringify(method));
              cb(err.stack);
            }
          }
        });
        c.on('close', () => {
          connections.splice(connections.indexOf(c), 1);
        });

        connections.push(c);
      }
    });

    let live = true;
    this._cleanup = () => {
      for (let i = 0; i < connections.length; i++) {
        const connection = connections[i];
        connection.close();
      }
      connections = [];

      live = false;
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = AntikythServer;
